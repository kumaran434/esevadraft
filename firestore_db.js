const fs = require('fs');
const path = require('path');
const { Firestore } = require('@google-cloud/firestore');

const LOCAL_DRAFTS_DIR = path.join(__dirname, 'data', 'drafts');
if (!fs.existsSync(LOCAL_DRAFTS_DIR)) {
    fs.mkdirSync(LOCAL_DRAFTS_DIR, { recursive: true });
}

let firestoreInstance = null;
let firestoreAvailable = false;

if (process.env.K_SERVICE || process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GAE_SERVICE) {
    try {
        firestoreInstance = new Firestore({
            projectId: process.env.GOOGLE_CLOUD_PROJECT || 'gen-lang-client-0792225149'
        });
        firestoreAvailable = true;
        console.log('📦 Firestore client initialized for project: gen-lang-client-0792225149');
    } catch (e) {
        console.warn('⚠️ Firestore init fallback to local disk:', e.message);
        firestoreAvailable = false;
    }
} else {
    console.log('📦 Local disk mode active for drafts and user profiles.');
    firestoreAvailable = false;
}

const COLLECTION_NAME = 'eseva_drafts';

function fileToBase64(filePath) {
    if (!filePath || !fs.existsSync(filePath)) return null;
    try {
        const buf = fs.readFileSync(filePath);
        return buf.toString('base64');
    } catch (e) {
        return null;
    }
}

function base64ToFile(base64Data, targetPath) {
    if (!base64Data || !targetPath) return null;
    try {
        const dir = path.dirname(targetPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        if (!fs.existsSync(targetPath)) {
            fs.writeFileSync(targetPath, Buffer.from(base64Data, 'base64'));
        }
        return targetPath;
    } catch (e) {
        console.error('Failed to restore base64 to file:', e.message);
        return null;
    }
}

async function saveCitizenDraft(mobileNumber, draftData) {
    if (!mobileNumber) return;
    const cleanMob = String(mobileNumber).trim();

    // Preserve existing operator details if not explicitly provided
    let existingOperatorUid = null;
    let existingOperatorName = null;
    let existingOperatorMobile = null;

    try {
        const localFile = path.join(LOCAL_DRAFTS_DIR, `${cleanMob}.json`);
        if (fs.existsSync(localFile)) {
            const existing = JSON.parse(fs.readFileSync(localFile, 'utf8'));
            existingOperatorUid = existing.operatorUid;
            existingOperatorName = existing.operatorName;
            existingOperatorMobile = existing.operatorMobile;
        }
    } catch (e) {}

    const resolvedOperatorUid = draftData.operatorUid || existingOperatorUid || null;
    const resolvedOperatorName = draftData.operatorName || existingOperatorName || null;
    const resolvedOperatorMobile = draftData.operatorMobile || existingOperatorMobile || null;

    const docPackage = { ...(draftData.documents || {}) };
    const base64Docs = {};

    if (docPackage.profilePhoto) {
        base64Docs.profilePhotoBase64 = fileToBase64(docPackage.profilePhoto);
        base64Docs.profilePhotoName = path.basename(docPackage.profilePhoto);
    }
    const aadhaarPath = docPackage.headAadhaar || docPackage.headAadhaarFront;
    if (aadhaarPath) {
        base64Docs.headAadhaarBase64 = fileToBase64(aadhaarPath);
        base64Docs.headAadhaarName = path.basename(aadhaarPath);
    }
    if (docPackage.residenceProof) {
        base64Docs.residenceProofBase64 = fileToBase64(docPackage.residenceProof);
        base64Docs.residenceProofName = path.basename(docPackage.residenceProof);
    }
    if (docPackage.gasBook) {
        base64Docs.gasBookBase64 = fileToBase64(docPackage.gasBook);
        base64Docs.gasBookName = path.basename(docPackage.gasBook);
    }
    if (Array.isArray(docPackage.memberAadhaars)) {
        base64Docs.memberAadhaarsBase64 = docPackage.memberAadhaars.map(mPath => ({
            name: path.basename(mPath),
            base64: fileToBase64(mPath)
        }));
    }

    const payload = {
        mobileNumber: cleanMob,
        operatorUid: resolvedOperatorUid,
        operatorName: resolvedOperatorName,
        operatorMobile: resolvedOperatorMobile,
        citizenProfile: draftData.citizenProfile || {},
        chatHistory: draftData.chatHistory || [],
        intakeState: draftData.intakeState || 'INTAKE_TYPE',
        step: draftData.step || 'draft',
        status: draftData.status || 'DRAFT_SAVED',
        applicationNumber: draftData.applicationNumber || null,
        applicationPdfUrl: draftData.applicationPdfUrl || null,
        base64Docs,
        lastUpdated: new Date().toISOString()
    };

    try {
        const localFile = path.join(LOCAL_DRAFTS_DIR, `${mobileNumber}.json`);
        fs.writeFileSync(localFile, JSON.stringify(payload, null, 2), 'utf8');
    } catch (e) {
        console.warn('Local draft write error:', e.message);
    }

    if (firestoreAvailable && firestoreInstance) {
        try {
            await firestoreInstance.collection(COLLECTION_NAME).doc(String(mobileNumber)).set(payload, { merge: true });
            console.log(`☁️ Draft safely synced to Firestore for +91 ${mobileNumber}`);
        } catch (e) {
            console.warn(`Firestore save fallback to local: ${e.message}`);
        }
    }

    return payload;
}

async function getCitizenDraft(mobileNumber) {
    if (!mobileNumber) return null;
    const cleanMobile = String(mobileNumber).trim();
    let data = null;

    if (firestoreAvailable && firestoreInstance) {
        try {
            const doc = await firestoreInstance.collection(COLLECTION_NAME).doc(cleanMobile).get();
            if (doc.exists) {
                data = doc.data();
                console.log(`☁️ Restored draft from Firestore for +91 ${cleanMobile}`);
            }
        } catch (e) {
            console.warn(`Firestore read fallback: ${e.message}`);
        }
    }

    if (!data) {
        const localFile = path.join(LOCAL_DRAFTS_DIR, `${cleanMobile}.json`);
        if (fs.existsSync(localFile)) {
            try {
                data = JSON.parse(fs.readFileSync(localFile, 'utf8'));
                console.log(`📁 Restored draft from local disk for +91 ${cleanMobile}`);
            } catch (e) {
                console.warn('Failed to parse local draft:', e.message);
            }
        }
    }

    if (!data) return null;

    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const restoredDocs = {};
    const b64 = data.base64Docs || {};

    if (b64.profilePhotoBase64 && b64.profilePhotoName) {
        const target = path.join(uploadsDir, b64.profilePhotoName);
        restoredDocs.profilePhoto = base64ToFile(b64.profilePhotoBase64, target);
    }
    if (b64.headAadhaarBase64 && b64.headAadhaarName) {
        const target = path.join(uploadsDir, b64.headAadhaarName);
        restoredDocs.headAadhaar = base64ToFile(b64.headAadhaarBase64, target);
    }
    if (b64.residenceProofBase64 && b64.residenceProofName) {
        const target = path.join(uploadsDir, b64.residenceProofName);
        restoredDocs.residenceProof = base64ToFile(b64.residenceProofBase64, target);
    }
    if (b64.gasBookBase64 && b64.gasBookName) {
        const target = path.join(uploadsDir, b64.gasBookName);
        restoredDocs.gasBook = base64ToFile(b64.gasBookBase64, target);
    }
    if (Array.isArray(b64.memberAadhaarsBase64)) {
        restoredDocs.memberAadhaars = b64.memberAadhaarsBase64.map(item => {
            const target = path.join(uploadsDir, item.name);
            return base64ToFile(item.base64, target);
        }).filter(Boolean);
    }

    data.documents = restoredDocs;
    return data;
}

async function listAllDrafts(operatorUid = null) {
    const drafts = [];
    const seenMobiles = new Set();

    if (firestoreAvailable && firestoreInstance) {
        try {
            let col = firestoreInstance.collection(COLLECTION_NAME);
            let snapshot;
            if (operatorUid) {
                snapshot = await col.where('operatorUid', '==', operatorUid).get();
            } else {
                snapshot = await col.get();
            }
            snapshot.forEach(doc => {
                const d = doc.data();
                seenMobiles.add(d.mobileNumber);
                const prof = d.citizenProfile || {};
                const name = prof.fullNameTam || prof.fullNameEng || (d.mobileNumber ? `வாடிக்கையாளர் (+91 ${d.mobileNumber})` : '—');
                drafts.push({
                    mobileNumber: d.mobileNumber,
                    operatorUid: d.operatorUid || null,
                    name: name,
                    membersCount: (prof.members && prof.members.length) || 1,
                    district: prof.district || '—',
                    taluk: prof.taluk || '—',
                    status: d.status || 'DRAFT_SAVED',
                    applicationNumber: d.applicationNumber || null,
                    lastUpdated: d.lastUpdated
                });
            });
        } catch (e) {
            console.warn('Failed to list Firestore drafts:', e.message);
        }
    }

    if (fs.existsSync(LOCAL_DRAFTS_DIR)) {
        const files = fs.readdirSync(LOCAL_DRAFTS_DIR);
        files.forEach(f => {
            if (f.endsWith('.json')) {
                const mob = f.replace('.json', '');
                if (!seenMobiles.has(mob)) {
                    try {
                        const d = JSON.parse(fs.readFileSync(path.join(LOCAL_DRAFTS_DIR, f), 'utf8'));
                        if (!operatorUid || d.operatorUid === operatorUid) {
                            const prof = d.citizenProfile || {};
                            const name = prof.fullNameTam || prof.fullNameEng || (d.mobileNumber ? `வாடிக்கையாளர் (+91 ${d.mobileNumber})` : '—');
                            drafts.push({
                                mobileNumber: d.mobileNumber,
                                operatorUid: d.operatorUid || null,
                                name: name,
                                membersCount: (prof.members && prof.members.length) || 1,
                                district: prof.district || '—',
                                taluk: prof.taluk || '—',
                                status: d.status || 'DRAFT_SAVED',
                                applicationNumber: d.applicationNumber || null,
                                lastUpdated: d.lastUpdated
                            });
                        }
                    } catch (e) {}
                }
            }
        });
    }

    return drafts.sort((a, b) => new Date(b.lastUpdated || 0) - new Date(a.lastUpdated || 0));
}

async function deleteCitizenDraft(mobileNumber) {
    if (!mobileNumber) return false;
    const cleanMobile = String(mobileNumber).trim();

    if (firestoreAvailable && firestoreInstance) {
        try {
            await firestoreInstance.collection(COLLECTION_NAME).doc(cleanMobile).delete();
            console.log(`🗑️ Deleted draft from Firestore for +91 ${cleanMobile}`);
        } catch (e) {
            console.warn(`Firestore delete error: ${e.message}`);
        }
    }

    try {
        const localFile = path.join(LOCAL_DRAFTS_DIR, `${cleanMobile}.json`);
        if (fs.existsSync(localFile)) {
            fs.unlinkSync(localFile);
            console.log(`🗑️ Deleted draft from local disk for +91 ${cleanMobile}`);
        }
    } catch (e) {
        console.warn(`Local file delete error: ${e.message}`);
    }

    return true;
}

const USERS_COLLECTION = 'eseva_users';
const LOCAL_USERS_DIR = path.join(__dirname, 'data', 'users');
if (!fs.existsSync(LOCAL_USERS_DIR)) {
    try { fs.mkdirSync(LOCAL_USERS_DIR, { recursive: true }); } catch (e) {}
}

async function saveUserProfile(uid, profileData) {
    if (!uid) return null;
    const payload = {
        ...profileData,
        updatedAt: new Date().toISOString()
    };
    try {
        const localFile = path.join(LOCAL_USERS_DIR, `${uid}.json`);
        fs.writeFileSync(localFile, JSON.stringify(payload, null, 2), 'utf8');
    } catch (e) {}

    if (firestoreAvailable && firestoreInstance) {
        try {
            await firestoreInstance.collection(USERS_COLLECTION).doc(uid).set(payload, { merge: true });
        } catch (e) {
            console.warn(`Firestore save user profile error: ${e.message}`);
        }
    }
    return payload;
}

async function getUserProfile(uid) {
    if (!uid) return null;
    try {
        const localFile = path.join(LOCAL_USERS_DIR, `${uid}.json`);
        if (fs.existsSync(localFile)) {
            return JSON.parse(fs.readFileSync(localFile, 'utf8'));
        }
    } catch (e) {}

    if (firestoreAvailable && firestoreInstance) {
        try {
            const doc = await firestoreInstance.collection(USERS_COLLECTION).doc(uid).get();
            if (doc.exists) {
                return doc.data();
            }
        } catch (e) {
            console.warn(`Firestore get user profile error: ${e.message}`);
        }
    }
    return null;
}

async function lookupUserByMobile(mobileNumber) {
    if (!mobileNumber) return null;
    const cleanMobile = String(mobileNumber).replace(/\D/g, '');
    if (cleanMobile.length !== 10) return null;

    try {
        if (fs.existsSync(LOCAL_USERS_DIR)) {
            const files = fs.readdirSync(LOCAL_USERS_DIR);
            for (const f of files) {
                if (f.endsWith('.json')) {
                    const data = JSON.parse(fs.readFileSync(path.join(LOCAL_USERS_DIR, f), 'utf8'));
                    if (data.mobileNumber === cleanMobile || (data.email && data.email.includes(cleanMobile))) {
                        return data;
                    }
                }
            }
        }
    } catch (e) {}

    if (firestoreAvailable && firestoreInstance) {
        try {
            const snap = await firestoreInstance.collection(USERS_COLLECTION)
                .where('mobileNumber', '==', cleanMobile)
                .limit(1)
                .get();
            if (!snap.empty) {
                return snap.docs[0].data();
            }
        } catch (e) {
            console.warn(`Firestore lookupUserByMobile error: ${e.message}`);
        }
    }
    return null;
}

const CORRECTIONS_COLLECTION = 'operator_corrections';
const LOCAL_CORRECTIONS_DIR = path.join(__dirname, 'data', 'corrections');
if (!fs.existsSync(LOCAL_CORRECTIONS_DIR)) {
    try { fs.mkdirSync(LOCAL_CORRECTIONS_DIR, { recursive: true }); } catch (e) {}
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
    } catch (e) {}

    if (firestoreAvailable && firestoreInstance) {
        try {
            await firestoreInstance.collection(CORRECTIONS_COLLECTION).doc(id).set(payload);
        } catch (e) {
            console.warn(`Firestore log correction error: ${e.message}`);
        }
    }
    return payload;
}

module.exports = {
    saveCitizenDraft,
    getCitizenDraft,
    listAllDrafts,
    deleteCitizenDraft,
    saveUserProfile,
    getUserProfile,
    lookupUserByMobile,
    logOperatorCorrection
};
