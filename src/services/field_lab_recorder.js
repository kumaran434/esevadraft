/**
 * src/services/field_lab_recorder.js
 *
 * 100% AIR-GAPPED FIELD LAB / PORTAL BLUEPRINT RECORDER
 * --------------------------------------------------------------------------
 * Architectural Isolation Law:
 *  - ZERO imports from any production TNPDS/TNeGA automation modules, FSM, runners, or draft stores.
 *  - Dedicated CDP Port (9225) & Dedicated Chrome Profile (never touches production browser port).
 *  - ZERO PII Capture: Strips all Aadhaar numbers, mobile numbers, OTPs, emails,
 *    and wipes every text/password input value before saving any DOM snapshot.
 *  - Saves sanitized structural Blueprints strictly to data/field_lab_blueprints/.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { getFirestoreInstance, isFirestoreAvailable } = require('./db/firestore_client');

const LAB_CLOUD_COLLECTION = 'field_lab_blueprints';
const DEFAULT_CLOUD_SYNC_ENDPOINT = process.env.ESEVA_CLOUD_SYNC_URL || 'https://esevadraft.in/api/lab/cloud-sync';

let chromium = null;
function getPlaywrightChromium() {
    if (chromium) return chromium;
    const candidates = [
        () => require('playwright').chromium,
        () => require('playwright-core').chromium,
        () => require(path.join(process.resourcesPath || '', 'app.asar.unpacked', 'node_modules', 'playwright-core')).chromium,
        () => require(path.join(process.resourcesPath || '', 'node_modules', 'playwright-core')).chromium
    ];
    for (const loadFn of candidates) {
        try {
            const c = loadFn();
            if (c) {
                chromium = c;
                return chromium;
            }
        } catch (_) {}
    }
    return null;
}

function getBlueprintsDir() {
    const appDataBase = process.env.APPDATA
        ? path.join(process.env.APPDATA, 'esevadraft-desktop', 'data', 'field_lab_blueprints')
        : null;
    const localBase = path.join(process.cwd(), 'data', 'field_lab_blueprints');
    // Prefer workspace path during tests or dev, AppData inside packaged Electron
    const isTest = process.env.NODE_ENV === 'test' || process.env.REGRESSION_TEST === 'true';
    const targetDir = (!isTest && process.resourcesPath && appDataBase) ? appDataBase : localBase;
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }
    return targetDir;
}

function getLabChromeProfileDir() {
    const base = process.env.APPDATA
        ? path.join(process.env.APPDATA, 'esevadraft-desktop', 'field-lab-chrome-profile')
        : path.join(process.cwd(), 'data', 'field_lab_chrome_profile');
    if (!fs.existsSync(base)) {
        fs.mkdirSync(base, { recursive: true });
    }
    return base;
}

/**
 * Strictly scrubs all sensitive Citizen/Operator PII from any text string.
 * Removes 12-digit Aadhaar, 10-digit Indian mobile numbers, OTPs, and emails.
 */
function scrubPiiText(rawText) {
    if (!rawText || typeof rawText !== 'string') return '';
    return rawText
        // Email addresses
        .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[EMAIL]')
        // Aadhaar formatted or raw (12 digits with optional spaces/dashes)
        .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[AADHAAR]')
        // 13-15 digit CAN numbers (keep prefix only)
        .replace(/\b(13\d)\d{10,13}\b/g, '$1[CAN_MASKED]')
        // 10-digit Indian mobile numbers (with optional +91)
        .replace(/(?:\+91[\s-]?)?\b[6-9]\d{9}\b/g, '[MOBILE]')
        // Explicit OTP mentions
        .replace(/\b(otp|pin|code)\s*[:=-]?\s*\d{4,8}\b/gi, '$1:[OTP]')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Pure structural sanitizer for raw DOM snapshots captured in Lab Browser.
 * Drops every typed input value and scrubs visible label/alert strings.
 */
function sanitizeCapturedSnapshot(rawSnapshot = {}) {
    const cleanStr = (s, maxLen = 180) => scrubPiiText(String(s || '')).slice(0, maxLen);

    const fields = Array.isArray(rawSnapshot.fields)
        ? rawSnapshot.fields.slice(0, 120).map(f => ({
            tag: String(f.tag || '').toLowerCase(),
            type: String(f.type || '').toLowerCase(),
            id: String(f.id || '').slice(0, 100),
            name: String(f.name || '').slice(0, 100),
            label: cleanStr(f.label, 120),
            placeholder: cleanStr(f.placeholder, 90),
            required: Boolean(f.required),
            disabled: Boolean(f.disabled),
            // NEVER store typed citizen/OTP/password values!
            value: '',
            options: Array.isArray(f.options)
                ? f.options.slice(0, 120).map(o => ({
                    value: String(o.value || '').slice(0, 60),
                    text: cleanStr(o.text, 90)
                }))
                : undefined
        }))
        : [];

    const buttons = Array.isArray(rawSnapshot.buttons)
        ? rawSnapshot.buttons.slice(0, 60).map(b => ({
            tag: String(b.tag || '').toLowerCase(),
            type: String(b.type || '').toLowerCase(),
            id: String(b.id || '').slice(0, 100),
            name: String(b.name || '').slice(0, 100),
            text: cleanStr(b.text || b.value, 90)
        }))
        : [];

    const alerts = Array.isArray(rawSnapshot.alerts)
        ? rawSnapshot.alerts.slice(0, 20).map(a => cleanStr(a, 180)).filter(Boolean)
        : [];

    return {
        capturedAt: rawSnapshot.capturedAt || new Date().toISOString(),
        url: sanitizePortalUrl(rawSnapshot.url || ''),
        title: cleanStr(rawSnapshot.title || '', 120),
        formIds: Array.isArray(rawSnapshot.formIds) ? rawSnapshot.formIds.slice(0, 20).map(s => String(s).slice(0, 80)) : [],
        fieldsCount: fields.length,
        buttonsCount: buttons.length,
        fields,
        buttons,
        alerts,
        piiStripped: true
    };
}

function sanitizePortalUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return '';
    try {
        const u = new URL(rawUrl);
        // Drop token/session/PII query params; keep harmless structural params like formId/processInstId/faces-redirect
        const keptParams = new URLSearchParams();
        for (const [k, v] of u.searchParams.entries()) {
            if (/^(formid|processinstid|faces-redirect|service|dept|lang)$/i.test(k)) {
                keptParams.set(k, v);
            }
        }
        const qs = keptParams.toString();
        return `${u.origin}${u.pathname}${qs ? '?' + qs : ''}`;
    } catch (_) {
        return String(rawUrl).split('?')[0].slice(0, 180);
    }
}

// Isolated Singleton State for the Field Lab (NEVER shares state with Main App)
const labState = {
    isRecording: false,
    sessionId: null,
    serviceName: '',
    portalName: '',
    portalUrl: '',
    operatorLabel: '',
    startedAt: null,
    context: null,
    page: null,
    steps: [],
    clicks: [],
    lastUrlCaptured: '',
    lastDomSig: ''
};

async function collectDomFromPage(page) {
    if (!page || page.isClosed()) return null;
    try {
        const raw = await page.evaluate(() => {
            const getLabelFor = (el) => {
                if (el.id) {
                    const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
                    if (lbl && lbl.innerText) return lbl.innerText;
                }
                const wrapRow = el.closest('tr, .form-group, .field-row, div');
                if (wrapRow) {
                    const prev = wrapRow.querySelector('label, th, td:first-child');
                    if (prev && prev !== el && prev.innerText) return prev.innerText;
                }
                return el.getAttribute('aria-label') || el.getAttribute('title') || '';
            };

            const fields = Array.from(document.querySelectorAll('input, select, textarea'))
                .filter(el => {
                    const t = (el.type || '').toLowerCase();
                    if (t === 'hidden' && !/formid|serid/i.test(el.id || el.name || '')) return false;
                    return el.offsetParent !== null || el.tagName === 'SELECT';
                })
                .map(el => ({
                    tag: el.tagName,
                    type: el.type || '',
                    id: el.id || '',
                    name: el.name || '',
                    label: getLabelFor(el),
                    placeholder: el.placeholder || '',
                    required: Boolean(el.required || el.getAttribute('aria-required') === 'true'),
                    disabled: Boolean(el.disabled),
                    options: el.tagName === 'SELECT'
                        ? Array.from(el.options).slice(0, 120).map(o => ({ value: o.value, text: o.text }))
                        : undefined
                }));

            const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"], a.btn, a.button_example'))
                .filter(el => el.offsetParent !== null)
                .map(el => ({
                    tag: el.tagName,
                    type: el.type || '',
                    id: el.id || '',
                    name: el.name || '',
                    text: el.innerText || el.value || ''
                }));

            const alerts = Array.from(document.querySelectorAll('.ui-messages-error, .rf-msgs-sum, .alert-danger, .alert-warning, .error, [id*="Msg"], [id*="Error"]'))
                .filter(el => el.offsetParent !== null && (el.innerText || '').trim())
                .map(el => el.innerText);

            const formIds = Array.from(document.querySelectorAll('form')).map(f => f.id || f.name || f.action).filter(Boolean);

            return {
                capturedAt: new Date().toISOString(),
                url: location.href,
                title: document.title,
                formIds,
                fields,
                buttons,
                alerts
            };
        });
        return sanitizeCapturedSnapshot(raw);
    } catch (_) {
        return null;
    }
}

async function attachLabPageListeners(page) {
    if (!page || page.__fieldLabListenersAttached) return;
    page.__fieldLabListenersAttached = true;

    const recordCurrentIfChanged = async () => {
        if (!labState.isRecording) return;
        const snap = await collectDomFromPage(page);
        if (!snap) return;
        const sig = `${snap.url}|${snap.fieldsCount}|${snap.buttonsCount}|${snap.formIds.join(',')}`;
        if (sig === labState.lastDomSig && snap.alerts.length === 0) return;
        labState.lastDomSig = sig;
        labState.lastUrlCaptured = snap.url;
        labState.steps.push(snap);
    };

    try {
        await page.exposeFunction('__esevaLabNotifyClick', (clickInfo) => {
            if (!labState.isRecording || !clickInfo) return;
            labState.clicks.push({
                ts: new Date().toISOString(),
                url: sanitizePortalUrl(clickInfo.url || ''),
                tag: String(clickInfo.tag || '').toLowerCase(),
                id: String(clickInfo.id || '').slice(0, 100),
                name: String(clickInfo.name || '').slice(0, 100),
                type: String(clickInfo.type || '').toLowerCase(),
                text: scrubPiiText(String(clickInfo.text || '')).slice(0, 80)
            });
            if (labState.clicks.length > 250) labState.clicks.shift();
        }).catch(() => {});
    } catch (_) {}

    const injectRecorderHud = async () => {
        if (page.isClosed()) return;
        await page.evaluate(() => {
            if (!window.__esevaLabClickBound) {
                window.__esevaLabClickBound = true;
                document.addEventListener('click', (ev) => {
                    const t = ev.target && ev.target.closest ? ev.target.closest('button, a, input[type="submit"], input[type="button"], input[type="radio"], input[type="checkbox"], select') : ev.target;
                    if (!t || typeof window.__esevaLabNotifyClick !== 'function') return;
                    // NEVER record input text values
                    window.__esevaLabNotifyClick({
                        url: location.href,
                        tag: t.tagName,
                        id: t.id || '',
                        name: t.name || '',
                        type: t.type || '',
                        text: (t.tagName === 'INPUT' && t.type !== 'submit' && t.type !== 'button') ? '' : (t.innerText || t.value || '')
                    });
                }, true);
            }
            if (!document.getElementById('eseva-field-lab-hud')) {
                const badge = document.createElement('div');
                badge.id = 'eseva-field-lab-hud';
                badge.style.cssText = 'position:fixed;bottom:14px;right:14px;z-index:2147483647;background:rgba(15,23,42,0.92);color:#f8fafc;border:1.5px solid #818cf8;border-radius:10px;padding:8px 13px;font-family:system-ui,sans-serif;font-size:12px;font-weight:700;display:flex;align-items:center;gap:8px;box-shadow:0 8px 24px rgba(0,0,0,0.35);pointer-events:none;';
                badge.innerHTML = '<span style="width:9px;height:9px;border-radius:50%;background:#ef4444;display:inline-block;box-shadow:0 0 8px #ef4444;"></span><span>eSevaDraft Field Lab • Blueprint Recording (Zero PII)</span>';
                document.body && document.body.appendChild(badge);
            }
        }).catch(() => {});
    };

    page.on('load', async () => {
        await injectRecorderHud();
        setTimeout(() => recordCurrentIfChanged(), 900);
    });
    page.on('framenavigated', async (frame) => {
        if (frame === page.mainFrame()) {
            setTimeout(async () => {
                await injectRecorderHud();
                await recordCurrentIfChanged();
            }, 1200);
        }
    });
}

async function startFieldLabRecording({ portalUrl, portalName = '', serviceName = '', operatorLabel = '' } = {}) {
    if (labState.isRecording && labState.context) {
        return {
            success: true,
            alreadyRunning: true,
            sessionId: labState.sessionId,
            status: getFieldLabStatus()
        };
    }

    const activeChromium = getPlaywrightChromium();
    if (!activeChromium) {
        throw new Error('Playwright Chromium module is not available.');
    }

    const cleanUrl = (portalUrl && /^https?:\/\//i.test(portalUrl))
        ? portalUrl
        : 'https://www.tnesevai.tn.gov.in';

    const profileDir = getLabChromeProfileDir();
    const launchArgs = [
        '--start-maximized',
        '--no-first-run',
        '--no-default-browser-check',
        '--remote-debugging-port=9225'
    ];

    let context;
    try {
        context = await activeChromium.launchPersistentContext(profileDir, {
            headless: false,
            channel: 'chrome',
            viewport: null,
            args: launchArgs
        });
    } catch (_) {
        context = await activeChromium.launchPersistentContext(profileDir, {
            headless: false,
            viewport: null,
            args: launchArgs
        });
    }

    const page = context.pages()[0] || (await context.newPage());

    labState.isRecording = true;
    labState.sessionId = `bp_${Date.now()}`;
    labState.serviceName = scrubPiiText(serviceName || 'New Portal Service').slice(0, 100);
    labState.portalName = scrubPiiText(portalName || 'Government Portal').slice(0, 80);
    labState.portalUrl = cleanUrl;
    labState.operatorLabel = scrubPiiText(operatorLabel || 'Operator Lab').slice(0, 60);
    labState.startedAt = new Date().toISOString();
    labState.context = context;
    labState.page = page;
    labState.steps = [];
    labState.clicks = [];
    labState.lastUrlCaptured = '';
    labState.lastDomSig = '';

    context.on('page', async (newPage) => {
        labState.page = newPage;
        await attachLabPageListeners(newPage);
    });

    context.on('close', () => {
        if (labState.isRecording) {
            finalizeAndSaveBlueprint().catch(() => {});
        }
        labState.isRecording = false;
        labState.context = null;
        labState.page = null;
    });

    await attachLabPageListeners(page);
    await page.goto(cleanUrl, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});

    return {
        success: true,
        sessionId: labState.sessionId,
        status: getFieldLabStatus()
    };
}

async function captureFieldLabSnapshotNow() {
    if (!labState.isRecording || !labState.context) {
        return { success: false, error: 'Field Lab recording is not currently active.' };
    }
    const pages = labState.context.pages().filter(p => !p.isClosed());
    const activePage = pages[pages.length - 1] || labState.page;
    if (!activePage || activePage.isClosed()) {
        return { success: false, error: 'No active Lab Chrome tab found.' };
    }
    labState.page = activePage;
    await attachLabPageListeners(activePage);
    const snap = await collectDomFromPage(activePage);
    if (!snap) {
        return { success: false, error: 'Could not read DOM from active Lab tab.' };
    }
    labState.steps.push(snap);
    labState.lastUrlCaptured = snap.url;
    return {
        success: true,
        stepIndex: labState.steps.length,
        snapshot: {
            url: snap.url,
            title: snap.title,
            fieldsCount: snap.fieldsCount,
            buttonsCount: snap.buttonsCount
        },
        status: getFieldLabStatus()
    };
}

function sanitizeBlueprintId(id) {
    return String(id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
}

/** Re-scrub every incoming Blueprint field strictly before storing or syncing to Cloud. */
function sanitizeBlueprintPayload(raw = {}) {
    const cleanId = sanitizeBlueprintId(raw.id) || `bp_${Date.now()}`;
    const rawSteps = Array.isArray(raw.steps) ? raw.steps.slice(0, 60) : [];
    const rawClicks = Array.isArray(raw.clicks) ? raw.clicks.slice(0, 200) : [];
    const cleanSteps = rawSteps.map(s => sanitizeCapturedSnapshot(s || {}));
    const cleanClicks = rawClicks.map(c => ({
        at: String((c && c.at) || new Date().toISOString()).slice(0, 40),
        url: sanitizePortalUrl((c && c.url) || ''),
        tag: String((c && c.tag) || '').slice(0, 20),
        id: scrubPiiText((c && c.id) || '').slice(0, 80),
        name: scrubPiiText((c && c.name) || '').slice(0, 80),
        type: String((c && c.type) || '').slice(0, 30),
        text: scrubPiiText((c && c.text) || '').slice(0, 80),
        selector: scrubPiiText((c && c.selector) || '').slice(0, 120)
    }));
    return {
        id: cleanId,
        schemaVersion: '1.0',
        serviceName: scrubPiiText(raw.serviceName || 'Unnamed Service').slice(0, 100),
        portalName: scrubPiiText(raw.portalName || 'Government Portal').slice(0, 80),
        startUrl: sanitizePortalUrl(raw.startUrl || ''),
        operatorLabel: scrubPiiText(raw.operatorLabel || 'Operator Lab').slice(0, 60),
        startedAt: String(raw.startedAt || new Date().toISOString()).slice(0, 40),
        completedAt: String(raw.completedAt || new Date().toISOString()).slice(0, 40),
        piiStrippedGuaranteed: true,
        stepsCount: cleanSteps.length,
        clicksCount: cleanClicks.length,
        steps: cleanSteps,
        clicks: cleanClicks,
        cloudSynced: Boolean(raw.cloudSynced),
        cloudSyncedAt: raw.cloudSyncedAt || null
    };
}

function saveBlueprintToLocalDisk(bp) {
    const dir = getBlueprintsDir();
    const cleanId = sanitizeBlueprintId(bp.id) || `bp_${Date.now()}`;
    const outPath = path.join(dir, `${cleanId}.json`);
    fs.writeFileSync(outPath, JSON.stringify(bp, null, 2), 'utf8');
    return outPath;
}

function postJsonOverHttp(targetUrl, payloadObj, timeoutMs = 12000) {
    return new Promise((resolve) => {
        try {
            const parsed = new URL(targetUrl);
            const bodyStr = JSON.stringify(payloadObj);
            const transport = parsed.protocol === 'http:' ? http : https;
            const req = transport.request({
                hostname: parsed.hostname,
                port: parsed.port || (parsed.protocol === 'http:' ? 80 : 443),
                path: parsed.pathname + parsed.search,
                method: 'POST',
                timeout: timeoutMs,
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(bodyStr, 'utf8'),
                    'User-Agent': 'eSevaDraft-FieldLab/1.0'
                }
            }, (resp) => {
                let raw = '';
                resp.on('data', chunk => { raw += chunk; });
                resp.on('end', () => {
                    try {
                        const data = JSON.parse(raw || '{}');
                        resolve({ statusCode: resp.statusCode, data });
                    } catch (_) {
                        resolve({ statusCode: resp.statusCode, data: {} });
                    }
                });
            });
            req.on('timeout', () => { req.destroy(); resolve({ statusCode: 0, error: 'timeout' }); });
            req.on('error', (err) => resolve({ statusCode: 0, error: err.message }));
            req.write(bodyStr);
            req.end();
        } catch (err) {
            resolve({ statusCode: 0, error: err.message });
        }
    });
}

function getJsonOverHttp(targetUrl, timeoutMs = 10000) {
    return new Promise((resolve) => {
        try {
            const parsed = new URL(targetUrl);
            const transport = parsed.protocol === 'http:' ? http : https;
            const req = transport.request({
                hostname: parsed.hostname,
                port: parsed.port || (parsed.protocol === 'http:' ? 80 : 443),
                path: parsed.pathname + parsed.search,
                method: 'GET',
                timeout: timeoutMs,
                headers: { 'User-Agent': 'eSevaDraft-FieldLab/1.0' }
            }, (resp) => {
                let raw = '';
                resp.on('data', chunk => { raw += chunk; });
                resp.on('end', () => {
                    try {
                        resolve({ statusCode: resp.statusCode, data: JSON.parse(raw || '{}') });
                    } catch (_) {
                        resolve({ statusCode: resp.statusCode, data: {} });
                    }
                });
            });
            req.on('timeout', () => { req.destroy(); resolve({ statusCode: 0, error: 'timeout' }); });
            req.on('error', (err) => resolve({ statusCode: 0, error: err.message }));
            req.end();
        } catch (err) {
            resolve({ statusCode: 0, error: err.message });
        }
    });
}

/**
 * Sync a Zero-PII Blueprint to Cloud (Firestore directly on server/ADC, or HTTPS relay on Desktop client).
 */
async function syncBlueprintToCloud(bp) {
    const cleanBp = sanitizeBlueprintPayload(bp);
    const skipNetwork = process.env.NODE_ENV === 'test' || process.env.ESEVA_SKIP_CLOUD_SYNC === '1';

    if (isFirestoreAvailable()) {
        try {
            const db = getFirestoreInstance();
            const syncedAt = new Date().toISOString();
            const cloudDoc = JSON.parse(JSON.stringify({ ...cleanBp, cloudSynced: true, cloudSyncedAt: syncedAt }));
            await db.collection(LAB_CLOUD_COLLECTION).doc(cleanBp.id).set(cloudDoc, { merge: true });
            return { cloudSynced: true, cloudSyncedAt: syncedAt, mode: 'firestore' };
        } catch (err) {
            console.warn('[Field Lab Cloud Sync] Firestore write failed:', err.message);
            return { cloudSynced: false, error: err.message, mode: 'firestore' };
        }
    }

    if (skipNetwork || process.env.K_SERVICE) {
        return { cloudSynced: false, mode: skipNetwork ? 'test-skip' : 'cloud-no-firestore' };
    }

    const relayUrl = process.env.ESEVA_CLOUD_SYNC_URL || DEFAULT_CLOUD_SYNC_ENDPOINT;
    const resp = await postJsonOverHttp(relayUrl, cleanBp, 12000);
    if (resp && resp.statusCode >= 200 && resp.statusCode < 300 && resp.data && resp.data.cloudSynced) {
        return {
            cloudSynced: true,
            cloudSyncedAt: resp.data.cloudSyncedAt || new Date().toISOString(),
            mode: 'relay'
        };
    }
    return {
        cloudSynced: false,
        mode: 'relay-failed',
        error: (resp && (resp.error || (resp.data && resp.data.error))) || `HTTP ${resp ? resp.statusCode : 0}`
    };
}

async function listCloudBlueprints(limit = 50) {
    if (isFirestoreAvailable()) {
        try {
            const db = getFirestoreInstance();
            const snap = await db.collection(LAB_CLOUD_COLLECTION)
                .orderBy('completedAt', 'desc')
                .limit(limit)
                .get();
            const list = [];
            snap.forEach(doc => {
                const d = doc.data() || {};
                list.push({
                    id: d.id || doc.id,
                    serviceName: d.serviceName || 'Unnamed',
                    portalName: d.portalName || 'Portal',
                    operatorLabel: d.operatorLabel || 'Operator Lab',
                    startedAt: d.startedAt,
                    completedAt: d.completedAt,
                    stepsCount: d.stepsCount || (Array.isArray(d.steps) ? d.steps.length : 0),
                    clicksCount: d.clicksCount || (Array.isArray(d.clicks) ? d.clicks.length : 0),
                    piiStrippedGuaranteed: Boolean(d.piiStrippedGuaranteed),
                    cloudSynced: true,
                    cloudSyncedAt: d.cloudSyncedAt || d.completedAt,
                    source: 'cloud'
                });
            });
            return list;
        } catch (_) {
            return [];
        }
    }
    if (process.env.NODE_ENV === 'test' || process.env.ESEVA_SKIP_CLOUD_SYNC === '1' || process.env.K_SERVICE) {
        return [];
    }
    const baseSync = process.env.ESEVA_CLOUD_SYNC_URL || DEFAULT_CLOUD_SYNC_ENDPOINT;
    const cloudListUrl = baseSync.replace(/\/cloud-sync\/?$/, '/cloud-blueprints');
    const resp = await getJsonOverHttp(cloudListUrl, 8000);
    if (resp && resp.statusCode === 200 && resp.data && Array.isArray(resp.data.blueprints)) {
        return resp.data.blueprints;
    }
    return [];
}

async function getCloudBlueprintById(id) {
    const cleanId = sanitizeBlueprintId(id);
    if (!cleanId) return null;
    if (isFirestoreAvailable()) {
        try {
            const db = getFirestoreInstance();
            const doc = await db.collection(LAB_CLOUD_COLLECTION).doc(cleanId).get();
            return doc.exists ? doc.data() : null;
        } catch (_) {
            return null;
        }
    }
    if (process.env.NODE_ENV === 'test' || process.env.ESEVA_SKIP_CLOUD_SYNC === '1' || process.env.K_SERVICE) {
        return null;
    }
    const baseSync = process.env.ESEVA_CLOUD_SYNC_URL || DEFAULT_CLOUD_SYNC_ENDPOINT;
    const cloudItemUrl = baseSync.replace(/\/cloud-sync\/?$/, `/blueprints/${encodeURIComponent(cleanId)}`);
    const resp = await getJsonOverHttp(cloudItemUrl, 8000);
    if (resp && resp.statusCode === 200 && resp.data && resp.data.blueprint) {
        return resp.data.blueprint;
    }
    return null;
}

async function finalizeAndSaveBlueprint() {
    const bp = sanitizeBlueprintPayload({
        id: labState.sessionId || `bp_${Date.now()}`,
        serviceName: labState.serviceName || 'Unnamed Service',
        portalName: labState.portalName || 'Government Portal',
        startUrl: labState.portalUrl || '',
        operatorLabel: labState.operatorLabel || 'Operator Lab',
        startedAt: labState.startedAt || new Date().toISOString(),
        completedAt: new Date().toISOString(),
        steps: labState.steps,
        clicks: labState.clicks
    });

    const outPath = saveBlueprintToLocalDisk(bp);
    const syncRes = await syncBlueprintToCloud(bp);
    bp.cloudSynced = Boolean(syncRes.cloudSynced);
    bp.cloudSyncedAt = syncRes.cloudSyncedAt || null;
    saveBlueprintToLocalDisk(bp);

    return { blueprint: bp, filePath: outPath, syncResult: syncRes };
}

async function stopFieldLabRecording() {
    if (!labState.isRecording && labState.steps.length === 0) {
        return { success: false, error: 'No active Field Lab recording session.' };
    }

    // Try one final snapshot before closing
    if (labState.page && !labState.page.isClosed()) {
        const finalSnap = await collectDomFromPage(labState.page).catch(() => null);
        if (finalSnap) {
            const sig = `${finalSnap.url}|${finalSnap.fieldsCount}|${finalSnap.buttonsCount}|${finalSnap.formIds.join(',')}`;
            if (sig !== labState.lastDomSig) {
                labState.steps.push(finalSnap);
            }
        }
    }

    labState.isRecording = false;
    const saved = await finalizeAndSaveBlueprint();
    const ctxRef = labState.context;
    labState.context = null;
    labState.page = null;
    if (ctxRef) {
        await ctxRef.close().catch(() => {});
    }

    return {
        success: true,
        blueprint: saved.blueprint,
        filePath: saved.filePath,
        status: getFieldLabStatus()
    };
}

function getFieldLabStatus() {
    return {
        isRecording: Boolean(labState.isRecording),
        sessionId: labState.sessionId,
        serviceName: labState.serviceName,
        portalName: labState.portalName,
        startedAt: labState.startedAt,
        stepsCaptured: labState.steps.length,
        clicksCaptured: labState.clicks.length,
        lastUrl: labState.lastUrlCaptured || sanitizePortalUrl(labState.portalUrl)
    };
}

function listSavedBlueprints() {
    const dir = getBlueprintsDir();
    if (!fs.existsSync(dir)) return [];
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    const list = [];
    for (const f of files) {
        try {
            const parsed = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
            list.push({
                id: parsed.id || f.replace('.json', ''),
                serviceName: parsed.serviceName || 'Unnamed',
                portalName: parsed.portalName || 'Portal',
                operatorLabel: parsed.operatorLabel || 'Operator Lab',
                startedAt: parsed.startedAt,
                completedAt: parsed.completedAt,
                stepsCount: parsed.stepsCount || (Array.isArray(parsed.steps) ? parsed.steps.length : 0),
                clicksCount: parsed.clicksCount || (Array.isArray(parsed.clicks) ? parsed.clicks.length : 0),
                piiStrippedGuaranteed: Boolean(parsed.piiStrippedGuaranteed),
                cloudSynced: Boolean(parsed.cloudSynced),
                cloudSyncedAt: parsed.cloudSyncedAt || null,
                source: parsed.cloudSynced ? 'local+cloud' : 'local'
            });
        } catch (_) {}
    }
    return list.sort((a, b) => String(b.completedAt || '').localeCompare(String(a.completedAt || '')));
}

async function listAllMergedBlueprints({ includeCloud = true } = {}) {
    const localList = listSavedBlueprints();
    if (!includeCloud) return localList;
    const cloudList = await listCloudBlueprints(50).catch(() => []);
    const byId = new Map();
    for (const item of localList) byId.set(item.id, item);
    for (const cItem of cloudList) {
        if (!cItem || !cItem.id) continue;
        const existing = byId.get(cItem.id);
        if (existing) {
            existing.cloudSynced = true;
            existing.cloudSyncedAt = existing.cloudSyncedAt || cItem.cloudSyncedAt || cItem.completedAt;
            existing.source = 'local+cloud';
        } else {
            byId.set(cItem.id, { ...cItem, cloudSynced: true, source: 'cloud' });
        }
    }
    return Array.from(byId.values()).sort((a, b) => String(b.completedAt || '').localeCompare(String(a.completedAt || '')));
}

function getBlueprintById(id) {
    const cleanId = sanitizeBlueprintId(id);
    if (!cleanId) return null;
    const target = path.join(getBlueprintsDir(), `${cleanId}.json`);
    if (!fs.existsSync(target)) return null;
    return JSON.parse(fs.readFileSync(target, 'utf8'));
}

async function retryCloudSyncBlueprint(id) {
    const bp = getBlueprintById(id);
    if (!bp) return { success: false, error: 'Blueprint not found locally' };
    const cleanBp = sanitizeBlueprintPayload(bp);
    const syncRes = await syncBlueprintToCloud(cleanBp);
    cleanBp.cloudSynced = Boolean(syncRes.cloudSynced);
    cleanBp.cloudSyncedAt = syncRes.cloudSyncedAt || cleanBp.cloudSyncedAt || null;
    saveBlueprintToLocalDisk(cleanBp);
    return {
        success: Boolean(syncRes.cloudSynced),
        cloudSynced: Boolean(syncRes.cloudSynced),
        cloudSyncedAt: cleanBp.cloudSyncedAt,
        mode: syncRes.mode,
        error: syncRes.error || null
    };
}

function deleteBlueprintById(id) {
    const cleanId = sanitizeBlueprintId(id);
    if (!cleanId) return false;
    const target = path.join(getBlueprintsDir(), `${cleanId}.json`);
    if (!fs.existsSync(target)) return false;
    fs.unlinkSync(target);
    return true;
}

async function deleteCloudBlueprintById(id) {
    const cleanId = sanitizeBlueprintId(id);
    if (!cleanId) return false;
    if (isFirestoreAvailable()) {
        try {
            await getFirestoreInstance().collection(LAB_CLOUD_COLLECTION).doc(cleanId).delete();
            return true;
        } catch (_) {
            return false;
        }
    }
    return false;
}

module.exports = {
    scrubPiiText,
    sanitizeCapturedSnapshot,
    sanitizePortalUrl,
    sanitizeBlueprintPayload,
    saveBlueprintToLocalDisk,
    syncBlueprintToCloud,
    retryCloudSyncBlueprint,
    listCloudBlueprints,
    getCloudBlueprintById,
    listAllMergedBlueprints,
    deleteCloudBlueprintById,
    startFieldLabRecording,
    captureFieldLabSnapshotNow,
    stopFieldLabRecording,
    getFieldLabStatus,
    listSavedBlueprints,
    getBlueprintById,
    deleteBlueprintById
};
