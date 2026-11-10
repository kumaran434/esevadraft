// =========================================================================
// Firestore & Storage Client Base
// =========================================================================
const fs = require('fs');
const path = require('path');
let Firestore = null;
let Storage = null;

const LOCAL_DRAFTS_DIR = path.join(__dirname, '..', '..', '..', 'data', 'drafts');
if (!fs.existsSync(LOCAL_DRAFTS_DIR)) {
    try { fs.mkdirSync(LOCAL_DRAFTS_DIR, { recursive: true }); } catch (_) {}
}
const APPDATA_DRAFTS_DIR = path.join(process.env.APPDATA || 'C:\\Users\\ADMIN\\AppData\\Roaming', 'esevadraft-desktop', 'data', 'drafts');
if (!fs.existsSync(APPDATA_DRAFTS_DIR)) {
    try { fs.mkdirSync(APPDATA_DRAFTS_DIR, { recursive: true }); } catch (_) {}
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
        firestoreInstance = new Firestore({ projectId: PROJECT_ID });
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
    if (!storageAvailable || !storageInstance) return false;
    if (!storageUrl || !storageUrl.startsWith('gs://')) return false;
    try {
        const parts = storageUrl.replace('gs://', '').split('/');
        const bucketName = parts[0];
        const filePath = parts.slice(1).join('/');
        const targetDir = path.dirname(targetLocalPath);
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

        const bucket = storageInstance.bucket(bucketName);
        await bucket.file(filePath).download({ destination: targetLocalPath });
        return fs.existsSync(targetLocalPath);
    } catch (e) {
        console.warn(`Storage download failed for ${storageUrl}:`, e.message);
        return false;
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

module.exports = {
    LOCAL_DRAFTS_DIR,
    APPDATA_DRAFTS_DIR,
    PROJECT_ID,
    STORAGE_BUCKET,
    COLLECTION_NAME,
    normalizeOperatorUid,
    uploadDocToStorage,
    downloadDocFromStorage,
    fileToBase64,
    base64ToFile,
    syncFatherOrHusband,
    getFirestoreInstance: () => firestoreInstance,
    isFirestoreAvailable: () => firestoreAvailable,
    isStorageAvailable: () => storageAvailable
};
