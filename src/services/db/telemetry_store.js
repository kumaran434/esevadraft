// =========================================================================
// Operator Error & Correction Telemetry Store (Per-Operator Cloud Partitioned)
// =========================================================================
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { getFirestoreInstance, isFirestoreAvailable } = require('./firestore_client');

const CORRECTIONS_COLLECTION = 'operator_corrections';
const LOCAL_CORRECTIONS_DIR = path.join(__dirname, '..', '..', '..', 'data', 'corrections');
if (!fs.existsSync(LOCAL_CORRECTIONS_DIR)) {
    try { fs.mkdirSync(LOCAL_CORRECTIONS_DIR, { recursive: true }); } catch (_) {}
}

const TELEMETRY_COLLECTION = 'eseva_operator_errors';
const LOCAL_TELEMETRY_DIR = path.join(__dirname, '..', '..', '..', 'data', 'telemetry');
if (!fs.existsSync(LOCAL_TELEMETRY_DIR)) {
    try { fs.mkdirSync(LOCAL_TELEMETRY_DIR, { recursive: true }); } catch (_) {}
}

function isTestMode() {
    return Boolean(
        process.env.REGRESSION_TEST === 'true' ||
        process.env.NODE_ENV === 'test' ||
        process.env.ESEVA_TEST_MODE === '1' ||
        process.env.ESEVA_SKIP_CLOUD_SYNC === '1' ||
        process.argv.some(a => a.includes('regression_suite') || a.includes('test_'))
    );
}

function sanitizeOperatorKey(uid, mobile, name) {
    const cleanUid = String(uid || '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
    if (cleanUid && cleanUid.toLowerCase() !== 'unknown' && cleanUid.toLowerCase() !== 'anonymous') {
        return cleanUid.slice(0, 80);
    }
    const digits = String(mobile || '').replace(/\D/g, '').slice(-10);
    if (digits.length === 10) return `mob_${digits}`;
    const slug = String(name || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);
    if (slug && slug !== 'unknown' && slug !== 'admin') return `op_${slug}`;
    return 'anonymous';
}

function maskCustomerMobile(mobile) {
    const digits = String(mobile || '').replace(/\D/g, '');
    if (digits.length >= 10) {
        const last10 = digits.slice(-10);
        return `${last10.slice(0, 2)}******${last10.slice(-2)}`;
    }
    return '';
}

function maskSensitiveTokens(text) {
    return String(text || '')
        .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, 'XXXX-XXXX-XXXX')
        .replace(/\b(otp|pin|passcode|password)\s*[:=]\s*[^\s,;]+/gi, '$1:[REDACTED]')
        .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[EMAIL]');
}

function resolveFallbackOperatorSession() {
    try {
        const { getActiveOperatorSession } = require('./user_profile_store');
        if (typeof getActiveOperatorSession === 'function') {
            return getActiveOperatorSession() || {};
        }
    } catch (_) {}
    return {};
}

function relayTelemetryToCloud(payload) {
    return new Promise((resolve) => {
        try {
            const baseUrl = process.env.ESEVA_DEV_URL || 'https://esevadraft.in';
            const targetUrl = `${baseUrl}/api/telemetry/error`;
            const urlObj = new URL(targetUrl);
            const postData = JSON.stringify(payload);
            const client = urlObj.protocol === 'https:' ? https : http;
            const req = client.request({
                hostname: urlObj.hostname,
                port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
                path: urlObj.pathname,
                method: 'POST',
                timeout: 6000,
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData, 'utf8'),
                    'User-Agent': 'eSevaDraft-Telemetry/1.0'
                }
            }, (resp) => {
                let raw = '';
                resp.on('data', c => { raw += c; });
                resp.on('end', () => {
                    try {
                        const parsed = JSON.parse(raw || '{}');
                        resolve(Boolean(resp.statusCode >= 200 && resp.statusCode < 300 && parsed.success));
                    } catch (_) {
                        resolve(resp.statusCode >= 200 && resp.statusCode < 300);
                    }
                });
            });
            req.on('timeout', () => { req.destroy(); resolve(false); });
            req.on('error', () => resolve(false));
            req.write(postData);
            req.end();
        } catch (_) {
            resolve(false);
        }
    });
}

async function logOperatorCorrection(logData) {
    const id = `corr_${Date.now()}`;
    const payload = {
        ...logData,
        id,
        timestamp: new Date().toISOString()
    };
    try {
        const localFile = path.join(LOCAL_CORRECTIONS_DIR, `${id}.json`);
        fs.writeFileSync(localFile, JSON.stringify(payload, null, 2), 'utf8');
    } catch (_) {}

    const firestore = getFirestoreInstance();
    if (isFirestoreAvailable() && firestore) {
        try {
            await firestore.collection(CORRECTIONS_COLLECTION).doc(id).set(JSON.parse(JSON.stringify(payload)));
        } catch (e) {
            console.warn(`Firestore log correction error: ${e.message}`);
        }
    }
    return payload;
}

async function logOperatorError(data = {}) {
    const fallbackSess = resolveFallbackOperatorSession();
    const operatorUid = String(data.operatorUid || data.uid || fallbackSess.operatorUid || '').trim();
    const operatorMobile = String(data.operatorMobile || fallbackSess.mobileNumber || '').replace(/\D/g, '').slice(-10) || String(data.operatorMobile || 'unknown');
    const operatorName = String(data.operatorName || fallbackSess.displayName || 'unknown').trim() || 'unknown';
    const operatorKey = sanitizeOperatorKey(operatorUid, operatorMobile, operatorName);

    const id = `err_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = data.timestamp || new Date().toISOString();
    const rawActions = Array.isArray(data.lastUiActions) ? data.lastUiActions.slice(-10) : [];
    const rawRunTail = Array.isArray(data.runLogTail)
        ? data.runLogTail.slice(-25).map(l => maskSensitiveTokens(l).slice(0, 240))
        : (typeof data.runLogTail === 'string' ? maskSensitiveTokens(data.runLogTail).slice(0, 3000) : '');

    const payload = JSON.parse(JSON.stringify({
        id,
        operatorKey,
        operatorUid: operatorUid || null,
        operatorMobile,
        operatorName,
        customerMobile: maskCustomerMobile(data.customerMobile || data.activeMobile || ''),
        serviceName: String(data.serviceName || data.subService || '').slice(0, 80),
        step: String(data.step || 'UNKNOWN_STEP').slice(0, 100),
        errorType: String(data.errorType || data.type || 'AUTOMATION_ERROR').slice(0, 80),
        errorMessage: maskSensitiveTokens(data.errorMessage || data.message || 'Unknown error').substring(0, 1200),
        errorStack: data.errorStack ? maskSensitiveTokens(data.errorStack).substring(0, 2000) : '',
        appVersion: String(data.appVersion || '1.1.27').slice(0, 30),
        platform: String(data.platform || process.platform),
        arch: String(data.arch || process.arch),
        chromeFound: typeof data.chromeFound === 'boolean' ? data.chromeFound : null,
        lastUiActions: rawActions.map(a => ({
            time: String((a && a.time) || ''),
            cat: String((a && a.cat) || ''),
            action: maskSensitiveTokens((a && a.action) || '').slice(0, 150)
        })),
        runLogTail: rawRunTail,
        extraInfo: data.extraInfo && typeof data.extraInfo === 'object' ? data.extraInfo : {},
        timestamp
    }));

    // 1. Save locally (flat telemetry dir for test compatibility + isolated per-operator folder)
    try {
        const localFile = path.join(LOCAL_TELEMETRY_DIR, `${id}.json`);
        fs.writeFileSync(localFile, JSON.stringify(payload, null, 2), 'utf8');
        if (!isTestMode()) {
            const perOpDir = path.join(LOCAL_TELEMETRY_DIR, 'operators', operatorKey);
            fs.mkdirSync(perOpDir, { recursive: true });
            fs.writeFileSync(path.join(perOpDir, `${id}.json`), JSON.stringify(payload, null, 2), 'utf8');
        }
    } catch (_) {}

    // 2. Save directly to Firestore partitioned per-operator: eseva_operator_errors/{operatorKey}/logs/{id}
    let cloudSaved = false;
    const firestore = getFirestoreInstance();
    if (isFirestoreAvailable() && firestore && !isTestMode()) {
        try {
            const parentRef = firestore.collection(TELEMETRY_COLLECTION).doc(operatorKey);
            await parentRef.set({
                operatorKey,
                operatorUid: operatorUid || null,
                operatorName,
                operatorMobile,
                appVersion: payload.appVersion,
                lastErrorAt: timestamp,
                lastErrorType: payload.errorType,
                lastErrorMessage: payload.errorMessage.slice(0, 300),
                lastServiceName: payload.serviceName,
                lastStep: payload.step
            }, { merge: true });
            await parentRef.collection('logs').doc(id).set(payload);
            cloudSaved = true;
            console.log(`📡 [Telemetry] Error logged per-operator in Firestore (${operatorKey}): [${payload.errorType}] ${payload.errorMessage.substring(0, 80)}`);
        } catch (e) {
            console.warn(`Firestore logOperatorError error: ${e.message}`);
        }
    } else if (!isTestMode() && process.env.DESKTOP_RUNTIME === '1' && !data.__fromCloudRelay) {
        // 3. Distributed friend Desktop App -> HTTPS relay to Cloud Run
        cloudSaved = await relayTelemetryToCloud({ ...payload, __fromCloudRelay: true }).catch(() => false);
    }

    return { ...payload, cloudSaved };
}

async function listOperatorErrorSummaries(limitCount = 30) {
    const firestore = getFirestoreInstance();
    if (isFirestoreAvailable() && firestore && !isTestMode()) {
        try {
            const snap = await firestore.collection(TELEMETRY_COLLECTION)
                .orderBy('lastErrorAt', 'desc')
                .limit(limitCount)
                .get();
            return snap.docs.map(d => d.data());
        } catch (e) {
            console.warn(`Firestore listOperatorErrorSummaries query error: ${e.message}`);
        }
    }
    return [];
}

async function listOperatorErrors(limitCount = 30, filter = {}) {
    const filterUidOrKey = String(filter.operatorUid || filter.operatorKey || '').trim().toLowerCase();
    const filterText = String(filter.operator || '').trim().toLowerCase();

    const firestore = getFirestoreInstance();
    if (isFirestoreAvailable() && firestore && !isTestMode()) {
        try {
            const opSnap = await firestore.collection(TELEMETRY_COLLECTION)
                .orderBy('lastErrorAt', 'desc')
                .limit(20)
                .get();
            const collected = [];
            for (const opDoc of opSnap.docs) {
                const opMeta = opDoc.data() || {};
                const key = String(opDoc.id || '').toLowerCase();
                const name = String(opMeta.operatorName || '').toLowerCase();
                const mob = String(opMeta.operatorMobile || '').toLowerCase();
                if (filterUidOrKey && key !== filterUidOrKey && String(opMeta.operatorUid || '').toLowerCase() !== filterUidOrKey) {
                    continue;
                }
                if (filterText && !key.includes(filterText) && !name.includes(filterText) && !mob.includes(filterText)) {
                    continue;
                }
                const logSnap = await opDoc.ref.collection('logs')
                    .orderBy('timestamp', 'desc')
                    .limit(Math.min(limitCount, 20))
                    .get();
                logSnap.docs.forEach(d => collected.push(d.data()));
            }
            if (collected.length > 0) {
                return collected
                    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                    .slice(0, limitCount);
            }
        } catch (e) {
            console.warn(`Firestore listOperatorErrors query error: ${e.message}`);
        }
    }

    try {
        if (fs.existsSync(LOCAL_TELEMETRY_DIR)) {
            const files = fs.readdirSync(LOCAL_TELEMETRY_DIR)
                .filter(f => f.startsWith('err_') && f.endsWith('.json'))
                .map(f => {
                    try {
                        return JSON.parse(fs.readFileSync(path.join(LOCAL_TELEMETRY_DIR, f), 'utf8'));
                    } catch { return null; }
                })
                .filter(Boolean)
                .filter(item => {
                    if (filterUidOrKey) {
                        const k = String(item.operatorKey || '').toLowerCase();
                        const u = String(item.operatorUid || '').toLowerCase();
                        if (k !== filterUidOrKey && u !== filterUidOrKey) return false;
                    }
                    if (filterText) {
                        const blob = `${item.operatorKey || ''} ${item.operatorName || ''} ${item.operatorMobile || ''}`.toLowerCase();
                        if (!blob.includes(filterText)) return false;
                    }
                    return true;
                })
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                .slice(0, limitCount);
            return files;
        }
    } catch (_) {}

    return [];
}

module.exports = {
    sanitizeOperatorKey,
    logOperatorCorrection,
    logOperatorError,
    listOperatorErrors,
    listOperatorErrorSummaries
};
