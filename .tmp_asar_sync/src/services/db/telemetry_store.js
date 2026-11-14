// =========================================================================
// Operator Error & Correction Telemetry Store
// =========================================================================
const fs = require('fs');
const path = require('path');
const { getFirestoreInstance, isFirestoreAvailable } = require('./firestore_client');

const CORRECTIONS_COLLECTION = 'operator_corrections';
const LOCAL_CORRECTIONS_DIR = path.join(__dirname, '..', '..', '..', 'data', 'corrections');
if (!fs.existsSync(LOCAL_CORRECTIONS_DIR)) {
    try { fs.mkdirSync(LOCAL_CORRECTIONS_DIR, { recursive: true }); } catch (_) {}
}

const TELEMETRY_COLLECTION = 'eseva_operator_telemetry';
const LOCAL_TELEMETRY_DIR = path.join(__dirname, '..', '..', '..', 'data', 'telemetry');
if (!fs.existsSync(LOCAL_TELEMETRY_DIR)) {
    try { fs.mkdirSync(LOCAL_TELEMETRY_DIR, { recursive: true }); } catch (_) {}
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
            await firestore.collection(CORRECTIONS_COLLECTION).doc(id).set(payload);
        } catch (e) {
            console.warn(`Firestore log correction error: ${e.message}`);
        }
    }
    return payload;
}

async function logOperatorError(data = {}) {
    const id = `err_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const payload = {
        id,
        operatorMobile: data.operatorMobile || 'unknown',
        operatorName: data.operatorName || 'unknown',
        customerMobile: data.customerMobile || '',
        step: data.step || 'UNKNOWN_STEP',
        errorType: data.errorType || 'AUTOMATION_ERROR',
        errorMessage: String(data.errorMessage || data.message || 'Unknown error').substring(0, 1000),
        errorStack: data.errorStack ? String(data.errorStack).substring(0, 2000) : '',
        appVersion: data.appVersion || '1.1.1',
        platform: data.platform || process.platform,
        arch: data.arch || process.arch,
        chromeFound: typeof data.chromeFound === 'boolean' ? data.chromeFound : null,
        extraInfo: data.extraInfo || {},
        timestamp: new Date().toISOString()
    };

    try {
        const localFile = path.join(LOCAL_TELEMETRY_DIR, `${id}.json`);
        fs.writeFileSync(localFile, JSON.stringify(payload, null, 2), 'utf8');
    } catch (_) {}

    const firestore = getFirestoreInstance();
    if (isFirestoreAvailable() && firestore) {
        try {
            await firestore.collection(TELEMETRY_COLLECTION).doc(id).set(payload);
            console.log(`📡 [Telemetry] Error logged to Firestore: [${payload.errorType}] ${payload.errorMessage.substring(0, 80)}`);
        } catch (e) {
            console.warn(`Firestore logOperatorError error: ${e.message}`);
        }
    }
    return payload;
}

async function listOperatorErrors(limitCount = 30) {
    const firestore = getFirestoreInstance();
    if (isFirestoreAvailable() && firestore) {
        try {
            const snap = await firestore.collection(TELEMETRY_COLLECTION)
                .orderBy('timestamp', 'desc')
                .limit(limitCount)
                .get();
            if (!snap.empty) {
                return snap.docs.map(d => d.data());
            }
        } catch (e) {
            console.warn(`Firestore listOperatorErrors query error: ${e.message}`);
        }
    }

    try {
        if (fs.existsSync(LOCAL_TELEMETRY_DIR)) {
            const files = fs.readdirSync(LOCAL_TELEMETRY_DIR)
                .filter(f => f.endsWith('.json'))
                .map(f => {
                    try {
                        return JSON.parse(fs.readFileSync(path.join(LOCAL_TELEMETRY_DIR, f), 'utf8'));
                    } catch { return null; }
                })
                .filter(Boolean)
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                .slice(0, limitCount);
            return files;
        }
    } catch (_) {}

    return [];
}

module.exports = {
    logOperatorCorrection,
    logOperatorError,
    listOperatorErrors
};
