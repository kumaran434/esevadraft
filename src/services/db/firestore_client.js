// =========================================================================
// Firestore & Storage Client Base
// =========================================================================
const fs = require('fs');
const path = require('path');
let Firestore = null;
let Storage = null;

const LOCAL_DATA_DIR = path.join(__dirname, '..', '..', '..', 'data');
const APPDATA_DATA_DIR = path.join(process.env.APPDATA || 'C:\\Users\\ADMIN\\AppData\\Roaming', 'esevadraft-desktop', 'data');

const LOCAL_DRAFTS_DIR = path.join(LOCAL_DATA_DIR, 'drafts');
const APPDATA_DRAFTS_DIR = path.join(APPDATA_DATA_DIR, 'drafts');
const APPDATA_SUITE_DRAFTS_DIR = null;

function isDesktopRuntime() {
    if (process.env.REGRESSION_TEST === 'true' || process.env.NODE_ENV === 'test') return false;
    if (Array.isArray(process.argv) && process.argv.some(a => /regression_suite|simulate_tnega_flows/i.test(String(a)))) return false;
    return !!(process.versions.electron || process.env.DESKTOP_RUNTIME === '1' || process.env.IS_DESKTOP);
}

/**
 * Single Canonical Active Data Directory Law:
 * - Desktop App runtime -> strictly AppData/Roaming/esevadraft-desktop/data
 * - Workspace / Test / Server runtime -> strictly <repo>/data
 * NEVER cross-reads or duplicates between two local directories.
 */
function getActiveDataDir() {
    const dir = isDesktopRuntime() ? APPDATA_DATA_DIR : LOCAL_DATA_DIR;
    if (!fs.existsSync(dir)) {
        try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
    }
    return dir;
}

function getActiveDraftsDir() {
    const dir = path.join(getActiveDataDir(), 'drafts');
    if (!fs.existsSync(dir)) {
        try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
    }
    return dir;
}

function getActiveUploadsDir() {
    const dir = path.join(getActiveDataDir(), 'uploads');
    if (!fs.existsSync(dir)) {
        try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
    }
    return dir;
}

// Ensure active drafts directory exists on boot
getActiveDraftsDir();

const _deletedDraftFence = new Map();

function isSpecificDraftId(key) {
    return typeof key === 'string' && /^[0-9]{10}_[a-z0-9_-]+$/i.test(key.trim());
}

function extractMobileFromDraftKey(key) {
    if (!key) return '';
    const s = String(key).trim();
    const m = s.match(/^([0-9]{10})_[a-z0-9_-]+$/i);
    if (m) return m[1];
    if (s.startsWith('walkin_')) return s;
    const digits = s.replace(/\D/g, '');
    return digits.length >= 10 ? digits.slice(-10) : s;
}

function generateUniqueDraftId(mobile) {
    const cleanMob = extractMobileFromDraftKey(mobile);
    if (!cleanMob || cleanMob.startsWith('walkin_')) return cleanMob || `walkin_${Date.now()}`;
    global.__esevaDraftIdSeq = ((global.__esevaDraftIdSeq || 0) + 1) % 1000;
    return `${cleanMob}_${Date.now()}${String(global.__esevaDraftIdSeq).padStart(3, '0')}`;
}

// Single-Source Central Router stored on `global` so Electron app.asar & resources/src ALWAYS share the exact same Map!
const _activeDraftIdByMobile = global.__esevaActiveDraftIdByMobile || (global.__esevaActiveDraftIdByMobile = new Map());

function makeOperatorDraftRouteKey(mobile, operatorUid = null) {
    const cleanMob = extractMobileFromDraftKey(mobile);
    if (!cleanMob || cleanMob.startsWith('walkin_')) return null;
    const normOp = normalizeOperatorUid(operatorUid);
    return normOp ? `${normOp}::${cleanMob}` : cleanMob;
}

function setActiveDraftIdForMobile(mobile, draftId, operatorUid = null) {
    const routeKey = makeOperatorDraftRouteKey(mobile, operatorUid);
    if (!routeKey) return;
    if (draftId && isSpecificDraftId(String(draftId).trim())) {
        _activeDraftIdByMobile.set(routeKey, String(draftId).trim());
    } else {
        _activeDraftIdByMobile.delete(routeKey);
    }
}

function getActiveDraftIdForMobile(mobile, operatorUid = null) {
    const routeKey = makeOperatorDraftRouteKey(mobile, operatorUid);
    if (!routeKey) return null;
    return _activeDraftIdByMobile.get(routeKey) || null;
}

function clearActiveDraftId(keyOrMobile, operatorUid = null) {
    if (!keyOrMobile) return;
    const raw = String(keyOrMobile).trim();
    const routeKey = makeOperatorDraftRouteKey(raw, operatorUid);
    if (!routeKey) return;
    if (isSpecificDraftId(raw)) {
        if (_activeDraftIdByMobile.get(routeKey) === raw) {
            _activeDraftIdByMobile.delete(routeKey);
        }
    } else {
        _activeDraftIdByMobile.delete(routeKey);
    }
}

function normalizeFenceKeys(keyOrKeys) {
    const rawList = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
    const out = new Set();
    for (const item of rawList) {
        if (!item) continue;
        const s = String(item).trim();
        if (s) out.add(s);
        // Only add 10-digit mobile alias when fencing a plain mobile key (NEVER fence sibling apps when deleting 1 specific draftId!)
        if (!isSpecificDraftId(s)) {
            const digits = s.replace(/\D/g, '').slice(-10);
            if (digits) out.add(digits);
        }
    }
    return Array.from(out);
}

/**
 * Records deletion timestamp so any in-flight save/cloud-sync started before delete
 * cannot resurrect the draft on local disk or Firestore.
 */
function markDraftDeleted(keyOrKeys) {
    const now = Date.now();
    for (const k of normalizeFenceKeys(keyOrKeys)) {
        _deletedDraftFence.set(k, now);
    }
    if (_deletedDraftFence.size > 500) {
        const cutoff = now - 300000;
        for (const [k, ts] of _deletedDraftFence.entries()) {
            if (ts < cutoff) _deletedDraftFence.delete(k);
        }
    }
    return now;
}

function isDraftStaleDueToDelete(mobileOrKey, operationStartedAtMs) {
    if (!mobileOrKey || !operationStartedAtMs) return false;
    for (const k of normalizeFenceKeys(mobileOrKey)) {
        const delTs = _deletedDraftFence.get(k);
        if (delTs && operationStartedAtMs <= delTs) {
            return true;
        }
    }
    return false;
}

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'gen-lang-client-0792225149';
const STORAGE_BUCKET = process.env.STORAGE_BUCKET || 'gen-lang-client-0792225149.firebasestorage.app';

function normalizeOperatorUid(uid) {
    if (!uid) return null;
    return String(uid).trim();
}

let firestoreInstance = null;
let firestoreAvailable = false;
let storageInstance = null;
let storageAvailable = false;

const isTestEnv = !!(
    process.env.REGRESSION_TEST === 'true' ||
    process.env.NODE_ENV === 'test' ||
    process.env.ESEVA_TEST_MODE === '1' ||
    process.argv.some(a => a.includes('regression_suite') || a.includes('test_'))
);

if (!isTestEnv && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
        const appData = process.env.APPDATA || 'C:\\Users\\ADMIN\\AppData\\Roaming';
        const directAdc = path.join(appData, 'gcloud', 'application_default_credentials.json');
        if (fs.existsSync(directAdc)) {
            process.env.GOOGLE_APPLICATION_CREDENTIALS = directAdc;
        } else {
            const legacyDir = path.join(appData, 'gcloud', 'legacy_credentials');
            if (fs.existsSync(legacyDir)) {
                const accounts = fs.readdirSync(legacyDir);
                for (const acc of accounts) {
                    const candidateAdc = path.join(legacyDir, acc, 'adc.json');
                    if (fs.existsSync(candidateAdc)) {
                        process.env.GOOGLE_APPLICATION_CREDENTIALS = candidateAdc;
                        break;
                    }
                }
            }
        }
    } catch (_) {}
}

if (!isTestEnv && (process.env.K_SERVICE || process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GAE_SERVICE)) {
    try {
        Firestore = require('@google-cloud/firestore').Firestore;
        firestoreInstance = new Firestore({ projectId: PROJECT_ID, ignoreUndefinedProperties: true });
        firestoreAvailable = true;
        console.log('☁️ [Local + Cloud Sync] Firestore client initialized for project:', PROJECT_ID);
    } catch (e) {
        console.warn('⚠️ Firestore init fallback to local disk:', e.message);
        firestoreAvailable = false;
    }

    try {
        Storage = require('@google-cloud/storage').Storage;
        storageInstance = new Storage({ projectId: PROJECT_ID });
        storageAvailable = true;
        console.log('🗄️ [Local + Cloud Sync] Firebase Storage client initialized. Bucket:', STORAGE_BUCKET);
    } catch (e) {
        console.warn('⚠️ Storage init failed:', e.message);
        storageAvailable = false;
    }
} else {
    console.log('📦 Local disk mode active for drafts, user profiles, and documents.');
    firestoreAvailable = false;
    storageAvailable = false;
}

const COLLECTION_NAME = 'eseva_drafts';

async function uploadDocToStorage(localFilePath, storagePath) {
    if (!storageAvailable || !storageInstance) return null;
    if (!localFilePath || !fs.existsSync(localFilePath)) return null;
    try {
        const bucket = storageInstance.bucket(STORAGE_BUCKET);
        await bucket.upload(localFilePath, { destination: storagePath });
        return `gs://${STORAGE_BUCKET}/${storagePath}`;
    } catch (e) {
        console.warn(`Storage upload failed for ${storagePath}:`, e.message);
        return null;
    }
}

async function downloadDocFromStorage(storageUrl, targetLocalPath) {
    if (!storageAvailable || !storageInstance) return null;
    if (!storageUrl || !storageUrl.startsWith('gs://')) return null;
    try {
        const parts = storageUrl.replace('gs://', '').split('/');
        const bucketName = parts[0];
        const filePath = parts.slice(1).join('/');
        const targetDir = path.dirname(targetLocalPath);
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

        const bucket = storageInstance.bucket(bucketName);
        await bucket.file(filePath).download({ destination: targetLocalPath });
        return fs.existsSync(targetLocalPath) ? targetLocalPath : null;
    } catch (e) {
        console.warn(`Storage download failed for ${storageUrl}:`, e.message);
        return null;
    }
}

function fileToBase64(filePath) {
    if (!filePath || !fs.existsSync(filePath)) return null;
    try { return fs.readFileSync(filePath).toString('base64'); } catch (e) { return null; }
}

function base64ToFile(base64Data, targetPath) {
    if (!base64Data) return null;
    try {
        const raw = base64Data.includes('base64,') ? base64Data.split('base64,')[1] : base64Data;
        const targetDir = path.dirname(targetPath);
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
        fs.writeFileSync(targetPath, Buffer.from(raw, 'base64'));
        return targetPath;
    } catch (e) { return null; }
}

function syncFatherOrHusband(prof) {
    if (!prof) return;
    let eng = (prof.fatherNameEng || prof.fatherOrHusbandNameEng || prof.husbandNameEng || '').trim();
    let tam = (prof.fatherNameTam || prof.fatherOrHusbandNameTam || prof.husbandNameTam || '').trim();

    if ((!eng || !tam) && Array.isArray(prof.members)) {
        const husband = prof.members.find(m => m && (
            (m.relationship && m.relationship.toLowerCase() === 'husband') ||
            (m.relationshipTam && m.relationshipTam.includes('கணவர்'))
        ));
        const father = prof.members.find(m => m && (
            (m.relationship && m.relationship.toLowerCase() === 'father') ||
            (m.relationshipTam && m.relationshipTam.includes('தந்தை'))
        ));
        const rel = husband || father;
        if (rel) {
            if (!eng && (rel.nameEng || rel.fullNameEng)) eng = (rel.nameEng || rel.fullNameEng).trim();
            if (!tam && (rel.nameTam || rel.fullNameTam)) tam = (rel.nameTam || rel.fullNameTam).trim();
        }
    }

    if (eng && !tam) tam = eng;
    if (tam && !eng) eng = tam;

    if (eng) prof.fatherNameEng = eng;
    if (tam) prof.fatherNameTam = tam;
}

async function deleteStoragePrefix(prefix) {
    if (!storageAvailable || !storageInstance || !prefix) return false;
    try {
        const bucket = storageInstance.bucket(STORAGE_BUCKET);
        await bucket.deleteFiles({ prefix, force: true });
        return true;
    } catch (e) {
        console.warn(`Storage delete prefix warning (${prefix}):`, e.message);
        return false;
    }
}

module.exports = {
    LOCAL_DRAFTS_DIR,
    APPDATA_DRAFTS_DIR,
    APPDATA_SUITE_DRAFTS_DIR,
    isDesktopRuntime,
    getActiveDataDir,
    getActiveDraftsDir,
    getActiveUploadsDir,
    PROJECT_ID,
    STORAGE_BUCKET,
    COLLECTION_NAME,
    normalizeOperatorUid,
    isSpecificDraftId,
    extractMobileFromDraftKey,
    generateUniqueDraftId,
    makeOperatorDraftRouteKey,
    setActiveDraftIdForMobile,
    getActiveDraftIdForMobile,
    clearActiveDraftId,
    markDraftDeleted,
    isDraftStaleDueToDelete,
    deleteStoragePrefix,
    uploadDocToStorage,
    downloadDocFromStorage,
    fileToBase64,
    base64ToFile,
    syncFatherOrHusband,
    getFirestoreInstance: () => firestoreInstance,
    isFirestoreAvailable: () => firestoreAvailable,
    isStorageAvailable: () => storageAvailable
};
