/**
 * eSevaDraft Cloud-Synced Self-Learning AI Correction & Jurisdiction Memory Engine
 *
 * Automatically learns from ALL operators' Edit Modal saves and shares across all PCs:
 * 1. villageToTaluk: Verified standalone Revenue Village -> Official TN Taluk & District
 *    (shared immediately via Firestore / Cloud Relay across every operator).
 * 2. initialMap: Learns recurring Tamil initial preferences (e.g. A->ஆ, S->சு, V->வே)
 *    without ever storing personal customer full names.
 * 3. fieldCorrections (streetTam, streetEng, areaTam, village): Applies a 2-Time Safe Auto-Filter
 *    (only corrections confirmed >= 2 times are automatically promoted into Gemini AI prompts!).
 * 4. Strictly ignores regression/test runs & sensitive digits (Aadhaar/mobile) to guarantee zero pollution.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const MEMORY_PATH = path.join(__dirname, '..', '..', 'data', 'tn_learned_corrections.json');
const FIRESTORE_COLLECTION = 'eseva_ai_learning_memory';
const FIRESTORE_DOC_ID = 'global_tn_v1';
const CLOUD_PULL_TTL_MS = 15 * 60 * 1000; // Refresh shared cloud memory every 15 minutes
const MIN_PROMOTE_COUNT = 2; // 2-Time Safe Auto-Filter so a single typo never corrupts AI!

function isTestRun(mobile = '') {
    const cleanMob = String(mobile || '').replace(/\D/g, '');
    return Boolean(
        process.env.REGRESSION_TEST === 'true' ||
        process.env.NODE_ENV === 'test' ||
        process.env.ESEVA_TEST_MODE === '1' ||
        process.env.ESEVA_SKIP_CLOUD_SYNC === '1' ||
        process.argv.some(a => a.includes('regression_suite') || a.includes('test_')) ||
        cleanMob.startsWith('999990') ||
        cleanMob.startsWith('988877')
    );
}

function normKey(s) {
    return String(s || '').trim().toLowerCase().replace(/[^a-z0-9\u0B80-\u0BFF]/g, '');
}

function emptyMemory() {
    return {
        villageToTaluk: {},
        initialMap: {},
        fieldCorrections: {}
    };
}

let cachedMemory = null;
let cachedMtime = 0;
let lastCloudPullAt = 0;
let cloudPullInFlight = false;

function loadMemory() {
    try {
        if (fs.existsSync(MEMORY_PATH)) {
            const st = fs.statSync(MEMORY_PATH);
            if (cachedMemory && st.mtimeMs === cachedMtime) {
                return cachedMemory;
            }
            const parsed = JSON.parse(fs.readFileSync(MEMORY_PATH, 'utf8'));
            if (parsed && typeof parsed === 'object') {
                cachedMemory = {
                    villageToTaluk: parsed.villageToTaluk || {},
                    initialMap: parsed.initialMap || {},
                    fieldCorrections: parsed.fieldCorrections || {}
                };
                cachedMtime = st.mtimeMs;
                return cachedMemory;
            }
        }
    } catch (_) {}
    return cachedMemory || emptyMemory();
}

function saveMemoryLocal(mem) {
    try {
        const dir = path.dirname(MEMORY_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(MEMORY_PATH, JSON.stringify(mem, null, 2), 'utf8');
        const st = fs.statSync(MEMORY_PATH);
        cachedMemory = mem;
        cachedMtime = st.mtimeMs;
        return true;
    } catch (_) {
        return false;
    }
}

function mergeMemoryObjects(base, incoming) {
    const out = {
        villageToTaluk: { ...(base?.villageToTaluk || {}) },
        initialMap: JSON.parse(JSON.stringify(base?.initialMap || {})),
        fieldCorrections: JSON.parse(JSON.stringify(base?.fieldCorrections || {}))
    };
    if (!incoming || typeof incoming !== 'object') return out;

    // 1. Merge villageToTaluk (prefer higher count or newer updatedAt)
    for (const [k, v] of Object.entries(incoming.villageToTaluk || {})) {
        if (!k || !v || !v.taluk || !v.district) continue;
        const prev = out.villageToTaluk[k];
        if (!prev || (v.count || 1) >= (prev.count || 1) || String(v.updatedAt || '') > String(prev.updatedAt || '')) {
            out.villageToTaluk[k] = {
                ...v,
                count: Math.max(prev?.count || 0, v.count || 1)
            };
        }
    }

    // 2. Merge initialMap ({ "S": { "சு": 3 } })
    for (const [letter, mapObj] of Object.entries(incoming.initialMap || {})) {
        if (!/^[A-Z]$/.test(letter) || !mapObj || typeof mapObj !== 'object') continue;
        out.initialMap[letter] = out.initialMap[letter] || {};
        for (const [tamInit, cnt] of Object.entries(mapObj)) {
            if (!tamInit || tamInit.length > 6 || !/[\u0B80-\u0BFF]/.test(tamInit)) continue;
            out.initialMap[letter][tamInit] = Math.max(out.initialMap[letter][tamInit] || 0, Number(cnt) || 1);
        }
    }

    // 3. Merge fieldCorrections
    const allowedFields = new Set(['streetTam', 'streetEng', 'areaTam', 'village']);
    for (const [fk, arr] of Object.entries(incoming.fieldCorrections || {})) {
        if (!allowedFields.has(fk) || !Array.isArray(arr)) continue;
        const curList = Array.isArray(out.fieldCorrections[fk]) ? out.fieldCorrections[fk] : [];
        for (const item of arr) {
            if (!item || !item.from || !item.to || item.from === item.to) continue;
            const match = curList.find(x => x.from === item.from && x.to === item.to);
            if (match) {
                match.count = Math.max(match.count || 1, item.count || 1);
                if (String(item.updatedAt || '') > String(match.updatedAt || '')) match.updatedAt = item.updatedAt;
            } else {
                curList.push({ from: item.from, to: item.to, count: item.count || 1, updatedAt: item.updatedAt || new Date().toISOString() });
            }
        }
        curList.sort((a, b) => (b.count || 1) - (a.count || 1) || String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
        out.fieldCorrections[fk] = curList.slice(0, 30);
    }

    return out;
}

function getFirestoreHelper() {
    try {
        return require('./db/firestore_client');
    } catch (_) {
        return null;
    }
}

function relayHttpRequest(method, urlPath, payload = null) {
    return new Promise((resolve) => {
        try {
            const baseUrl = process.env.ESEVA_DEV_URL || 'https://esevadraft.in';
            const urlObj = new URL(`${baseUrl}${urlPath}`);
            const body = payload ? JSON.stringify(payload) : null;
            const client = urlObj.protocol === 'https:' ? https : http;
            const req = client.request({
                hostname: urlObj.hostname,
                port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
                path: urlObj.pathname,
                method,
                timeout: 5000,
                headers: {
                    'User-Agent': 'eSevaDraft-LearningSync/1.0',
                    ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body, 'utf8') } : {})
                }
            }, (resp) => {
                let raw = '';
                resp.on('data', c => { raw += c; });
                resp.on('end', () => {
                    try {
                        resolve({ ok: resp.statusCode >= 200 && resp.statusCode < 300, body: JSON.parse(raw || '{}') });
                    } catch (_) {
                        resolve({ ok: false, body: null });
                    }
                });
            });
            req.on('timeout', () => { req.destroy(); resolve({ ok: false, body: null }); });
            req.on('error', () => resolve({ ok: false, body: null }));
            if (body) req.write(body);
            req.end();
        } catch (_) {
            resolve({ ok: false, body: null });
        }
    });
}

async function pushUpdateToCloud(deltaPayload) {
    if (isTestRun()) return false;
    try {
        const fsHelper = getFirestoreHelper();
        const db = fsHelper?.getFirestoreInstance ? fsHelper.getFirestoreInstance() : null;
        if (fsHelper?.isFirestoreAvailable && fsHelper.isFirestoreAvailable() && db) {
            const docRef = db.collection(FIRESTORE_COLLECTION).doc(FIRESTORE_DOC_ID);
            const snap = await docRef.get().catch(() => null);
            const remoteData = (snap && snap.exists) ? snap.data() : emptyMemory();
            const merged = mergeMemoryObjects(remoteData, deltaPayload);
            await docRef.set({ ...merged, updatedAt: new Date().toISOString() }, { merge: true });
            saveMemoryLocal(mergeMemoryObjects(loadMemory(), merged));
            return true;
        }
        if (process.env.DESKTOP_RUNTIME === '1' && !deltaPayload.__fromCloudRelay) {
            const res = await relayHttpRequest('POST', '/api/learning/memory', { ...deltaPayload, __fromCloudRelay: true });
            return Boolean(res && res.ok);
        }
    } catch (_) {}
    return false;
}

async function syncMemoryFromCloudIfStale(force = false) {
    if (isTestRun()) return loadMemory();
    if (!force && (cloudPullInFlight || (Date.now() - lastCloudPullAt < CLOUD_PULL_TTL_MS))) {
        return loadMemory();
    }
    cloudPullInFlight = true;
    try {
        const fsHelper = getFirestoreHelper();
        const db = fsHelper?.getFirestoreInstance ? fsHelper.getFirestoreInstance() : null;
        let remoteMem = null;
        if (fsHelper?.isFirestoreAvailable && fsHelper.isFirestoreAvailable() && db) {
            const snap = await db.collection(FIRESTORE_COLLECTION).doc(FIRESTORE_DOC_ID).get().catch(() => null);
            if (snap && snap.exists) remoteMem = snap.data();
        } else if (process.env.DESKTOP_RUNTIME === '1') {
            const res = await relayHttpRequest('GET', '/api/learning/memory');
            if (res && res.ok && res.body && res.body.memory) {
                remoteMem = res.body.memory;
            }
        }
        if (remoteMem) {
            const merged = mergeMemoryObjects(loadMemory(), remoteMem);
            saveMemoryLocal(merged);
        }
        lastCloudPullAt = Date.now();
    } catch (_) {
    } finally {
        cloudPullInFlight = false;
    }
    return loadMemory();
}

function lookupLearnedVillage(villageName = '') {
    const key = normKey(villageName);
    if (!key || key.length < 3) return null;
    const mem = loadMemory();
    return mem.villageToTaluk[key] || null;
}

function recordVerifiedVillageTaluk({ village, villageTam, taluk, talukTam, district, districtTam, isHamlet = false, areaEng = '', areaTam = '', mobile = '', _bypassTestGuard = false } = {}) {
    if (!_bypassTestGuard && isTestRun(mobile)) return false;
    const vKey = normKey(village);
    const tClean = String(taluk || '').trim();
    const dClean = String(district || '').trim();
    if (!vKey || vKey.length < 3 || !tClean || !dClean) return false;

    const mem = loadMemory();
    const prev = mem.villageToTaluk[vKey] || { count: 0 };
    const entry = {
        village: String(village || '').trim(),
        villageTam: String(villageTam || prev.villageTam || '').trim(),
        taluk: tClean,
        talukTam: String(talukTam || prev.talukTam || '').trim(),
        district: dClean,
        districtTam: String(districtTam || prev.districtTam || '').trim(),
        isHamlet: Boolean(isHamlet),
        areaEng: isHamlet ? String(areaEng || '').trim() : '',
        areaTam: isHamlet ? String(areaTam || '').trim() : '',
        count: (prev.count || 0) + 1,
        updatedAt: new Date().toISOString()
    };
    mem.villageToTaluk[vKey] = entry;
    saveMemoryLocal(mem);
    if (!_bypassTestGuard) {
        pushUpdateToCloud({ villageToTaluk: { [vKey]: entry } }).catch(() => {});
    }
    return true;
}

/**
 * Extracts and learns ONLY the single-letter English Initial -> Tamil Initial mapping
 * (e.g., "S Prasanth" edited from "எஸ் பிரசாந்த்" -> "சு பிரசாந்த்" learns "S" -> "சு")
 * without storing any customer's personal full name!
 */
function extractInitialCorrectionPair(engName = '', beforeTam = '', afterTam = '') {
    const cleanEng = String(engName || '').replace(/([A-Za-z])\.([A-Za-z])/g, '$1 $2').replace(/\.+/g, ' ').trim();
    const engTokens = cleanEng.split(/\s+/).filter(Boolean);
    if (engTokens.length < 2) return null;

    const cleanBefore = String(beforeTam || '').replace(/\.+/g, ' ').trim().split(/\s+/).filter(Boolean);
    const cleanAfter = String(afterTam || '').replace(/\.+/g, ' ').trim().split(/\s+/).filter(Boolean);
    if (cleanBefore.length < 2 || cleanAfter.length < 2) return null;

    const pairs = [];
    if (/^[A-Za-z]$/.test(engTokens[0])) {
        const bTok = cleanBefore[0];
        const aTok = cleanAfter[0];
        if (bTok !== aTok && aTok.length <= 4 && /[\u0B80-\u0BFF]/.test(aTok) && !/[A-Za-z0-9]/.test(aTok)) {
            pairs.push({ letter: engTokens[0].toUpperCase(), tamilInitial: aTok });
        }
    }
    const lastEng = engTokens[engTokens.length - 1];
    if (/^[A-Za-z]$/.test(lastEng)) {
        const bTok = cleanBefore[cleanBefore.length - 1];
        const aTok = cleanAfter[cleanAfter.length - 1];
        if (bTok !== aTok && aTok.length <= 4 && /[\u0B80-\u0BFF]/.test(aTok) && !/[A-Za-z0-9]/.test(aTok)) {
            pairs.push({ letter: lastEng.toUpperCase(), tamilInitial: aTok });
        }
    }
    return pairs.length > 0 ? pairs : null;
}

function recordInitialCorrection({ engName, beforeTam, afterTam, mobile = '', _bypassTestGuard = false } = {}) {
    if (!_bypassTestGuard && isTestRun(mobile)) return false;
    const pairs = extractInitialCorrectionPair(engName, beforeTam, afterTam);
    if (!pairs) return false;

    const mem = loadMemory();
    const deltaInit = {};
    for (const { letter, tamilInitial } of pairs) {
        mem.initialMap[letter] = mem.initialMap[letter] || {};
        mem.initialMap[letter][tamilInitial] = (mem.initialMap[letter][tamilInitial] || 0) + 1;
        deltaInit[letter] = { ...(deltaInit[letter] || {}), [tamilInitial]: mem.initialMap[letter][tamilInitial] };
    }
    saveMemoryLocal(mem);
    if (!_bypassTestGuard) {
        pushUpdateToCloud({ initialMap: deltaInit }).catch(() => {});
    }
    return true;
}

function recordFieldCorrection({ fieldKey, beforeVal, afterVal, mobile = '', _bypassTestGuard = false } = {}) {
    if (!_bypassTestGuard && isTestRun(mobile)) return false;
    const allowedFields = new Set(['streetTam', 'streetEng', 'areaTam', 'village']);
    const k = String(fieldKey || '').trim();
    if (!allowedFields.has(k)) return false;

    const fromStr = String(beforeVal || '').replace(/\s+/g, ' ').trim();
    const toStr = String(afterVal || '').replace(/\s+/g, ' ').trim();
    if (!fromStr || !toStr || fromStr === toStr) return false;
    if (fromStr.length > 80 || toStr.length > 80) return false;
    if (/\d{6,}/.test(fromStr) || /\d{6,}/.test(toStr)) return false;

    const mem = loadMemory();
    const list = Array.isArray(mem.fieldCorrections[k]) ? mem.fieldCorrections[k] : [];
    let updatedItem = list.find(x => x.from === fromStr && x.to === toStr);
    if (updatedItem) {
        updatedItem.count = (updatedItem.count || 1) + 1;
        updatedItem.updatedAt = new Date().toISOString();
    } else {
        updatedItem = { from: fromStr, to: toStr, count: 1, updatedAt: new Date().toISOString() };
        list.push(updatedItem);
    }
    list.sort((a, b) => (b.count || 1) - (a.count || 1) || String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    mem.fieldCorrections[k] = list.slice(0, 30);
    saveMemoryLocal(mem);
    if (!_bypassTestGuard) {
        pushUpdateToCloud({ fieldCorrections: { [k]: [updatedItem] } }).catch(() => {});
    }
    return true;
}

function applyIncomingCloudRelayUpdate(payload = {}) {
    if (!payload || typeof payload !== 'object') return loadMemory();
    const merged = mergeMemoryObjects(loadMemory(), payload);
    saveMemoryLocal(merged);
    // Persist merged state to Firestore asynchronously on Cloud Run
    pushUpdateToCloud({ ...merged, __fromCloudRelay: true }).catch(() => {});
    return merged;
}

/**
 * Builds compact, zero-noise AI prompt hints:
 * - Village -> Taluk entries (verified against official 315 TN taluks)
 * - Initial rules confirmed >= MIN_PROMOTE_COUNT (2-Time Auto-Filter)
 * - Street / Area / Village spelling corrections confirmed >= MIN_PROMOTE_COUNT (2-Time Auto-Filter)
 */
function buildDynamicAiPromptHints(maxItems = 14, customMem = null) {
    const mem = customMem || loadMemory();
    const lines = [];

    const villageEntries = Object.values(mem.villageToTaluk || {})
        .sort((a, b) => (b.count || 1) - (a.count || 1))
        .slice(0, 6);
    for (const v of villageEntries) {
        lines.push(`- Village "${v.village}"${v.villageTam ? ` (${v.villageTam})` : ''} belongs strictly to Taluk "${v.taluk}", District "${v.district}"${v.isHamlet ? ' [Hamlet]' : ' [Standalone Revenue Village — NEVER append to street]'}.`);
    }

    // Promoted initial preferences (confirmed >= 2 times)
    const initHints = [];
    for (const [letter, counts] of Object.entries(mem.initialMap || {})) {
        const sorted = Object.entries(counts || {})
            .filter(([, c]) => Number(c) >= MIN_PROMOTE_COUNT)
            .sort((a, b) => b[1] - a[1]);
        if (sorted.length > 0) {
            initHints.push(`${letter} -> ${sorted.slice(0, 2).map(([t]) => t).join('/')}`);
        }
    }
    if (initHints.length > 0) {
        lines.push(`- Operator-verified Tamil initial preferences (preserve printed Aadhaar Tamil initial first!): ${initHints.slice(0, 10).join(', ')}.`);
    }

    // Promoted street/area/village spelling corrections (strictly count >= 2!)
    const trackedFields = ['streetTam', 'areaTam', 'village', 'streetEng'];
    let added = 0;
    for (const fk of trackedFields) {
        const list = (mem.fieldCorrections?.[fk] || []).filter(item => (item.count || 0) >= MIN_PROMOTE_COUNT);
        for (const item of list.slice(0, 3)) {
            if (added >= maxItems) break;
            lines.push(`- Learned ${fk} correction: prefer "${item.to}" instead of "${item.from}".`);
            added++;
        }
    }

    if (lines.length === 0) return '';
    return `\nLEARNED OPERATOR CORRECTIONS (Auto-learned & shared across Tamil Nadu operators):\n${lines.join('\n')}\n`;
}

module.exports = {
    MEMORY_PATH,
    MIN_PROMOTE_COUNT,
    loadMemory,
    saveMemoryLocal,
    mergeMemoryObjects,
    syncMemoryFromCloudIfStale,
    lookupLearnedVillage,
    recordVerifiedVillageTaluk,
    extractInitialCorrectionPair,
    recordInitialCorrection,
    recordFieldCorrection,
    applyIncomingCloudRelayUpdate,
    buildDynamicAiPromptHints
};
