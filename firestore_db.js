const fs = require('fs');
const path = require('path');
const { Firestore } = require('@google-cloud/firestore');
const { Storage } = require('@google-cloud/storage');

const LOCAL_DRAFTS_DIR = path.join(__dirname, 'data', 'drafts');
if (!fs.existsSync(LOCAL_DRAFTS_DIR)) {
    fs.mkdirSync(LOCAL_DRAFTS_DIR, { recursive: true });
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

if (process.env.K_SERVICE || process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GAE_SERVICE) {
    try {
        firestoreInstance = new Firestore({ projectId: PROJECT_ID });
        firestoreAvailable = true;
        console.log('📦 Firestore client initialized for project:', PROJECT_ID);
    } catch (e) {
        console.warn('⚠️ Firestore init fallback to local disk:', e.message);
        firestoreAvailable = false;
    }

    try {
        storageInstance = new Storage({ projectId: PROJECT_ID });
        storageAvailable = true;
        console.log('🗄️ Firebase Storage client initialized. Bucket:', STORAGE_BUCKET);
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
const _loggedRestores = new Set();

// ─── Firebase Storage Helpers ────────────────────────────────────────────────

async function uploadDocToStorage(localFilePath, storagePath) {
    if (!storageAvailable || !storageInstance) return null;
    if (!localFilePath || !fs.existsSync(localFilePath)) return null;
    try {
        const bucket = storageInstance.bucket(STORAGE_BUCKET);
        await bucket.upload(localFilePath, {
            destination: storagePath,
            metadata: { cacheControl: 'private, max-age=0' }
        });
        const url = `gs://${STORAGE_BUCKET}/${storagePath}`;
        console.log(`🗄️ Document uploaded to Storage: ${url}`);
        return url;
    } catch (e) {
        console.warn('⚠️ Storage upload failed, keeping local path:', e.message);
        return null;
    }
}

async function downloadDocFromStorage(storageUrl, targetLocalPath) {
    if (!storageAvailable || !storageInstance) return null;
    if (!storageUrl || !storageUrl.startsWith('gs://')) return null;
    try {
        if (fs.existsSync(targetLocalPath)) return targetLocalPath;
        const withoutScheme = storageUrl.replace('gs://', '');
        const slashIdx = withoutScheme.indexOf('/');
        const bucketName = withoutScheme.substring(0, slashIdx);
        const filePath = withoutScheme.substring(slashIdx + 1);
        const dir = path.dirname(targetLocalPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        await storageInstance.bucket(bucketName).file(filePath).download({ destination: targetLocalPath });
        console.log(`🗄️ Document downloaded from Storage: ${storageUrl}`);
        return targetLocalPath;
    } catch (e) {
        console.warn('⚠️ Storage download failed:', e.message);
        return null;
    }
}

// Legacy base64 helpers (kept for reading old drafts that still have base64 data)
function fileToBase64(filePath) {
    if (!filePath || !fs.existsSync(filePath)) return null;
    try { return fs.readFileSync(filePath).toString('base64'); } catch (e) { return null; }
}

function base64ToFile(base64Data, targetPath) {
    if (!base64Data || !targetPath) return null;
    try {
        const dir = path.dirname(targetPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        if (!fs.existsSync(targetPath)) fs.writeFileSync(targetPath, Buffer.from(base64Data, 'base64'));
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

async function saveCitizenDraft(mobileNumber, draftData) {
    if (!mobileNumber) return;
    const cleanMob = String(mobileNumber).trim();

    const docPackage = { ...(draftData.documents || {}) };

    // STRICT GATING: Never save empty drafts to disk or Firestore!
    const prof = draftData.citizenProfile || {};
    syncFatherOrHusband(prof);
    const hasRealName = !!((prof.fullNameTam && prof.fullNameTam.trim()) || (prof.fullNameEng && prof.fullNameEng.trim()) || (draftData.name && draftData.name.trim() && !draftData.name.startsWith('வாடிக்கையாளர் (+91')));
    const hasAadhaar = !!(prof.headAadhaar && prof.headAadhaar.trim());
    const hasMembers = Array.isArray(prof.members) && prof.members.length > 0;
    const hasAppNo = !!(draftData.applicationNumber || prof.applicationNumber);
    const hasDocs = (draftData.documents && Object.keys(draftData.documents).some(k => !!draftData.documents[k])) ||
                    (draftData.base64Docs && Object.keys(draftData.base64Docs).length > 0) ||
                    (prof.documents && Object.keys(prof.documents).some(k => !!prof.documents[k]));
    const hasCan = !!(prof.canNumber || draftData.canNumber);
    if (!hasRealName && !hasAadhaar && !hasMembers && !hasDocs && !hasAppNo && !hasCan) {
        console.log(`[DRAFT GATE] Skipping save for empty draft ${cleanMob} (no actual customer details provided).`);
        return null;
    }

    // Preserve existing operator details if not explicitly provided
    let existingOperatorUid = null;
    let existingOperatorName = null;
    let existingOperatorMobile = null;

    if (!draftData.operatorUid) {
        if (firestoreAvailable && firestoreInstance) {
            try {
                const existingDoc = await firestoreInstance.collection(COLLECTION_NAME).doc(cleanMob).get();
                if (existingDoc.exists) {
                    const ex = existingDoc.data();
                    existingOperatorUid = ex.operatorUid;
                    existingOperatorName = ex.operatorName;
                    existingOperatorMobile = ex.operatorMobile;
                }
            } catch (e) {}
        }
        if (!existingOperatorUid) {
            try {
                const localFile = path.join(LOCAL_DRAFTS_DIR, `${cleanMob}.json`);
                if (fs.existsSync(localFile)) {
                    const existing = JSON.parse(fs.readFileSync(localFile, 'utf8'));
                    existingOperatorUid = existing.operatorUid;
                    existingOperatorName = existing.operatorName;
                    existingOperatorMobile = existing.operatorMobile;
                }
            } catch (e) {}
        }
    }

    const resolvedOperatorUid = normalizeOperatorUid(draftData.operatorUid) || normalizeOperatorUid(existingOperatorUid) || null;
    const resolvedOperatorName = draftData.operatorName || existingOperatorName || null;
    const resolvedOperatorMobile = draftData.operatorMobile || existingOperatorMobile || null;

    // ─── Upload documents to Firebase Storage AND preserve base64 for universal access ───
    const storageUrls = {};   // gs:// URLs stored in Firestore (Cloud Run)
    const base64Docs = Object.assign({}, draftData.base64Docs || {}); // base64 available to any operator client

    async function handleDoc(localPath, docType) {
        if (!localPath || !fs.existsSync(localPath)) return;
        const fileName = path.basename(localPath);
        const storagePath = `drafts/${cleanMob}/${docType}/${fileName}`;
        if (storageAvailable) {
            const url = await uploadDocToStorage(localPath, storagePath);
            if (url) { storageUrls[docType] = url; }
        }
        // ALWAYS preserve base64 inside Firestore & local disk so desktop automation on any client can consume it instantly without credentials!
        const b64 = fileToBase64(localPath);
        if (b64) {
            base64Docs[`${docType}Base64`] = b64;
            base64Docs[`${docType}Name`] = fileName;
        }
    }

    // Make sure citizenProfile document paths are always captured in docPackage
    if (prof.headPhotoPath) docPackage.profilePhoto = prof.headPhotoPath;
    if (prof.members?.[0]?.docPath || prof.headAadhaarDocPath) {
        docPackage.headAadhaar = prof.members?.[0]?.docPath || prof.headAadhaarDocPath;
    }
    if (prof.residenceProof?.docPath) {
        docPackage.residenceProof = prof.residenceProof.docPath;
    }
    if (prof.gasDetails?.gasBookPath) {
        docPackage.gasBook = prof.gasDetails.gasBookPath;
    }

    await handleDoc(docPackage.profilePhoto, 'profilePhoto');
    await handleDoc(docPackage.headAadhaar || docPackage.headAadhaarFront, 'headAadhaar');
    await handleDoc(docPackage.residenceProof, 'residenceProof');
    await handleDoc(docPackage.gasBook, 'gasBook');

    if (Array.isArray(prof.members) && prof.members.length > 1) {
        docPackage.memberAadhaars = [];
        for (let i = 1; i < prof.members.length; i++) {
            const mDoc = prof.members[i]?.docPath || docPackage[`memberAadhaar_${i}`];
            if (mDoc) docPackage.memberAadhaars.push(mDoc);
        }
    }

    if (Array.isArray(docPackage.memberAadhaars) && docPackage.memberAadhaars.length > 0) {
        const memberUrls = [];
        const memberBase64s = Array.isArray(base64Docs.memberAadhaarsBase64) ? [...base64Docs.memberAadhaarsBase64] : [];
        for (let i = 0; i < docPackage.memberAadhaars.length; i++) {
            const mPath = docPackage.memberAadhaars[i];
            if (!mPath || !fs.existsSync(mPath)) continue;
            const fileName = path.basename(mPath);
            const storagePath = `drafts/${cleanMob}/memberAadhaars/member_${i}_${fileName}`;
            if (storageAvailable) {
                const url = await uploadDocToStorage(mPath, storagePath);
                if (url) { memberUrls.push(url); }
            }
            const b64 = fileToBase64(mPath);
            if (b64) {
                memberBase64s.push({ name: fileName, base64: b64 });
            }
        }
        if (memberUrls.length > 0) storageUrls.memberAadhaars = memberUrls;
        if (memberBase64s.length > 0) base64Docs.memberAadhaarsBase64 = memberBase64s;
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
        storageUrls,   // Firebase Storage gs:// URLs (Cloud Run mode)
        base64Docs,    // Fallback base64 (localhost mode)
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
                if (!_loggedRestores.has(cleanMobile)) {
                    _loggedRestores.add(cleanMobile);
                    console.log(`☁️ Restored draft from Firestore for +91 ${cleanMobile}`);
                }
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
                if (!_loggedRestores.has(cleanMobile)) {
                    _loggedRestores.add(cleanMobile);
                    console.log(`📁 Restored draft from local disk for +91 ${cleanMobile}`);
                }
            } catch (e) {
                console.warn('Failed to parse local draft:', e.message);
            }
        }
    }

    if (!data) return null;

    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const restoredDocs = {};
    const urls = data.storageUrls || {};
    const b64 = data.base64Docs || {};

    // ─── Restore from Firebase Storage URLs (Cloud Run mode) ─────────────
    async function restoreDoc(docType, fallbackB64Key, fallbackNameKey) {
        if (urls[docType]) {
            const fileName = urls[docType].split('/').pop();
            const target = path.join(uploadsDir, fileName);
            const restored = await downloadDocFromStorage(urls[docType], target);
            if (restored) return restored;
        }
        // Legacy base64 fallback
        if (b64[fallbackB64Key] && b64[fallbackNameKey]) {
            const target = path.join(uploadsDir, b64[fallbackNameKey]);
            return base64ToFile(b64[fallbackB64Key], target);
        }
        return null;
    }

    restoredDocs.profilePhoto = await restoreDoc('profilePhoto', 'profilePhotoBase64', 'profilePhotoName');
    restoredDocs.headAadhaar = await restoreDoc('headAadhaar', 'headAadhaarBase64', 'headAadhaarName');
    restoredDocs.residenceProof = await restoreDoc('residenceProof', 'residenceProofBase64', 'residenceProofName');
    restoredDocs.gasBook = await restoreDoc('gasBook', 'gasBookBase64', 'gasBookName');

    // Member Aadhaar documents
    if (Array.isArray(urls.memberAadhaars) && urls.memberAadhaars.length > 0) {
        restoredDocs.memberAadhaars = (await Promise.all(
            urls.memberAadhaars.map(async url => {
                const fileName = url.split('/').pop();
                return await downloadDocFromStorage(url, path.join(uploadsDir, fileName));
            })
        )).filter(Boolean);
    } else if (Array.isArray(b64.memberAadhaarsBase64)) {
        restoredDocs.memberAadhaars = b64.memberAadhaarsBase64.map(item =>
            base64ToFile(item.base64, path.join(uploadsDir, item.name))
        ).filter(Boolean);
    }

    // Remove null entries
    Object.keys(restoredDocs).forEach(k => { if (!restoredDocs[k]) delete restoredDocs[k]; });

    data.documents = restoredDocs;
    if (restoredDocs.profilePhoto && data.citizenProfile) {
        data.citizenProfile.headPhotoPath = restoredDocs.profilePhoto;
    }
    if (restoredDocs.headAadhaar && data.citizenProfile && Array.isArray(data.citizenProfile.members) && data.citizenProfile.members.length > 0) {
        data.citizenProfile.members[0].docPath = restoredDocs.headAadhaar;
    }
    if (Array.isArray(restoredDocs.memberAadhaars) && data.citizenProfile && Array.isArray(data.citizenProfile.members)) {
        restoredDocs.memberAadhaars.forEach((mDocPath, idx) => {
            if (data.citizenProfile.members[idx + 1]) {
                data.citizenProfile.members[idx + 1].docPath = mDocPath;
            }
        });
    }
    if (restoredDocs.residenceProof && data.citizenProfile) {
        if (!data.citizenProfile.residenceProof) data.citizenProfile.residenceProof = {};
        data.citizenProfile.residenceProof.docPath = restoredDocs.residenceProof;
    }
    if (restoredDocs.gasBook && data.citizenProfile && data.citizenProfile.gasDetails) {
        data.citizenProfile.gasDetails.gasBookPath = restoredDocs.gasBook;
    }

    // Ensure data.base64Docs is ALWAYS completely populated from restored files so any client has instant access
    data.base64Docs = data.base64Docs || {};
    const docKeys = ['profilePhoto', 'headAadhaar', 'residenceProof', 'gasBook'];
    for (const key of docKeys) {
        const filePath = restoredDocs[key];
        if (filePath && fs.existsSync(filePath)) {
            const b64Key = `${key}Base64`;
            const nameKey = `${key}Name`;
            if (!data.base64Docs[b64Key]) {
                data.base64Docs[b64Key] = fileToBase64(filePath);
                data.base64Docs[nameKey] = path.basename(filePath);
            }
        }
    }
    if (Array.isArray(restoredDocs.memberAadhaars) && restoredDocs.memberAadhaars.length > 0) {
        if (!Array.isArray(data.base64Docs.memberAadhaarsBase64) || data.base64Docs.memberAadhaarsBase64.length === 0) {
            data.base64Docs.memberAadhaarsBase64 = restoredDocs.memberAadhaars.map(mPath => {
                if (mPath && fs.existsSync(mPath)) {
                    return { name: path.basename(mPath), base64: fileToBase64(mPath) };
                }
                return null;
            }).filter(Boolean);
        }
    }

    if (data && data.citizenProfile) {
        syncFatherOrHusband(data.citizenProfile);
    }

    return data;
}

function isMeaningfulDraft(d) {
    if (!d || !d.mobileNumber) return false;
    const prof = d.citizenProfile || {};
    const hasName = !!((prof.fullNameTam && prof.fullNameTam.trim()) || (prof.fullNameEng && prof.fullNameEng.trim()) || (d.name && d.name.trim() && !d.name.startsWith('வாடிக்கையாளர் (+91')));
    const hasAadhaar = !!(prof.headAadhaar && prof.headAadhaar.trim());
    const hasMembers = Array.isArray(prof.members) && prof.members.length > 0;
    const hasDocs = (d.documents && Object.keys(d.documents).some(k => !!d.documents[k])) ||
                    (d.base64Docs && Object.keys(d.base64Docs).length > 0);
    const hasAppNo = !!d.applicationNumber;
    const hasCan = !!(prof.canNumber || d.canNumber);

    return hasName || hasAadhaar || hasMembers || hasDocs || hasAppNo || hasCan;
}

async function listAllDrafts(operatorUid = null) {
    const drafts = [];
    const seenMobiles = new Set();
    const targetUid = operatorUid ? String(operatorUid).trim() : null;

    if (firestoreAvailable && firestoreInstance) {
        try {
            let col = firestoreInstance.collection(COLLECTION_NAME);
            let snapshot = await col.get();
            snapshot.forEach(doc => {
                const d = doc.data();
                if (!isMeaningfulDraft(d)) {
                    return;
                }
                // STRICT OPERATOR ISOLATION:
                // If draft is explicitly tagged to another operator, skip it.
                // Unassigned drafts (!d.operatorUid) remain visible to prevent customer data loss!
                const normTarget = normalizeOperatorUid(targetUid);
                const normDocOp = normalizeOperatorUid(d.operatorUid);
                if (normTarget && normDocOp && normDocOp !== normTarget) {
                    return;
                }
                seenMobiles.add(d.mobileNumber);
                const prof = d.citizenProfile || {};
                const name = prof.fullNameTam || prof.fullNameEng || d.name || 'வாடிக்கையாளர்';
                drafts.push({
                    mobileNumber: d.mobileNumber,
                    operatorUid: d.operatorUid || null,
                    name: name,
                    membersCount: (prof.members && prof.members.length) || 1,
                    district: prof.district || '—',
                    taluk: prof.taluk || '—',
                    status: d.status || 'DRAFT_SAVED',
                    isDeleted: !!(d.isDeleted || d.status === 'TRASHED'),
                    trashedAt: d.trashedAt || null,
                    applicationNumber: d.applicationNumber || null,
                    canNumber: prof.canNumber || d.canNumber || null,
                    headAadhaar: prof.headAadhaar || d.headAadhaar || null,
                    lastUpdated: d.lastUpdated
                });
            });
        } catch (e) {
            console.warn('Failed to list Firestore drafts:', e.message);
        }
    }

    // Local disk directory drafts (ONLY for offline / dev testing when Firestore is NOT active)
    if (!firestoreAvailable && fs.existsSync(LOCAL_DRAFTS_DIR)) {
        const files = fs.readdirSync(LOCAL_DRAFTS_DIR);
        files.forEach(f => {
            if (f.endsWith('.json')) {
                const mob = f.replace('.json', '');
                if (!seenMobiles.has(mob)) {
                    try {
                        const d = JSON.parse(fs.readFileSync(path.join(LOCAL_DRAFTS_DIR, f), 'utf8'));
                        if (!isMeaningfulDraft(d)) return;
                        const normTarget = normalizeOperatorUid(targetUid);
                        const normDocOp = normalizeOperatorUid(d.operatorUid);
                        if (normTarget && normDocOp && normDocOp !== normTarget) return;
                        seenMobiles.add(mob);
                        const prof = d.citizenProfile || {};
                        const name = prof.fullNameTam || prof.fullNameEng || d.name || 'வாடிக்கையாளர்';
                        drafts.push({
                            mobileNumber: mob,
                            operatorUid: d.operatorUid || null,
                            name: name,
                            membersCount: (prof.members && prof.members.length) || 1,
                            district: prof.district || '—',
                            taluk: prof.taluk || '—',
                            status: d.status || 'DRAFT_SAVED',
                            isDeleted: !!(d.isDeleted || d.status === 'TRASHED'),
                            trashedAt: d.trashedAt || null,
                            applicationNumber: d.applicationNumber || null,
                            canNumber: prof.canNumber || d.canNumber || null,
                            headAadhaar: prof.headAadhaar || d.headAadhaar || null,
                            lastUpdated: d.lastUpdated
                        });
                    } catch (e) {}
                }
            }
        });
    }

    return drafts.sort((a, b) => new Date(b.lastUpdated || 0) - new Date(a.lastUpdated || 0));
}

async function trashCitizenDraft(mobileNumber) {
    if (!mobileNumber) return false;
    const cleanMobile = String(mobileNumber).trim();
    const nowIso = new Date().toISOString();

    if (firestoreAvailable && firestoreInstance) {
        try {
            await firestoreInstance.collection(COLLECTION_NAME).doc(cleanMobile).set({
                isDeleted: true,
                status: 'TRASHED',
                trashedAt: nowIso,
                lastUpdated: nowIso
            }, { merge: true });
            console.log(`🗑️ Moved draft to Trash in Firestore for +91 ${cleanMobile}`);
        } catch (e) {
            console.warn(`Firestore trash error: ${e.message}`);
        }
    }

    try {
        const localFile = path.join(LOCAL_DRAFTS_DIR, `${cleanMobile}.json`);
        if (fs.existsSync(localFile)) {
            const draft = JSON.parse(fs.readFileSync(localFile, 'utf8'));
            draft.isDeleted = true;
            draft.status = 'TRASHED';
            draft.trashedAt = nowIso;
            draft.lastUpdated = nowIso;
            fs.writeFileSync(localFile, JSON.stringify(draft, null, 2), 'utf8');
            console.log(`🗑️ Moved draft to Trash on local disk for +91 ${cleanMobile}`);
        }
    } catch (e) {
        console.warn(`Local file trash error: ${e.message}`);
    }

    return true;
}

async function restoreCitizenDraft(mobileNumber) {
    if (!mobileNumber) return false;
    const cleanMobile = String(mobileNumber).trim();
    const nowIso = new Date().toISOString();

    if (firestoreAvailable && firestoreInstance) {
        try {
            await firestoreInstance.collection(COLLECTION_NAME).doc(cleanMobile).set({
                isDeleted: false,
                status: 'DRAFT_SAVED',
                trashedAt: null,
                lastUpdated: nowIso
            }, { merge: true });
            console.log(`♻️ Restored draft from Trash in Firestore for +91 ${cleanMobile}`);
        } catch (e) {
            console.warn(`Firestore restore error: ${e.message}`);
        }
    }

    try {
        const localFile = path.join(LOCAL_DRAFTS_DIR, `${cleanMobile}.json`);
        if (fs.existsSync(localFile)) {
            const draft = JSON.parse(fs.readFileSync(localFile, 'utf8'));
            draft.isDeleted = false;
            draft.status = 'DRAFT_SAVED';
            draft.trashedAt = null;
            draft.lastUpdated = nowIso;
            fs.writeFileSync(localFile, JSON.stringify(draft, null, 2), 'utf8');
            console.log(`♻️ Restored draft from Trash on local disk for +91 ${cleanMobile}`);
        }
    } catch (e) {
        console.warn(`Local file restore error: ${e.message}`);
    }

    return true;
}

async function deleteCitizenDraft(mobileNumber, options = {}) {
    if (!mobileNumber) return false;
    const cleanMobile = String(mobileNumber).trim();

    // 1. Purge all uploaded documents from Cloud Storage
    if (storageAvailable && storageInstance) {
        try {
            const bucket = storageInstance.bucket(STORAGE_BUCKET);
            await bucket.deleteFiles({ prefix: `drafts/${cleanMobile}/` });
            console.log(`🗑️ Deleted all storage files for +91 ${cleanMobile}`);
        } catch (e) {
            console.warn(`Storage delete error for +91 ${cleanMobile}:`, e.message);
        }
    }

    // 2. Delete Firestore document
    if (firestoreAvailable && firestoreInstance) {
        try {
            await firestoreInstance.collection(COLLECTION_NAME).doc(cleanMobile).delete();
            console.log(`🗑️ Deleted draft from Firestore for +91 ${cleanMobile}`);
        } catch (e) {
            console.warn(`Firestore delete error: ${e.message}`);
        }
    }

    // 3. Delete local disk json file
    try {
        const localFile = path.join(LOCAL_DRAFTS_DIR, `${cleanMobile}.json`);
        if (fs.existsSync(localFile)) {
            fs.unlinkSync(localFile);
            console.log(`🗑️ Deleted draft from local disk for +91 ${cleanMobile}`);
        }
    } catch (e) {
        console.warn(`Local file delete error: ${e.message}`);
    }

    // 4. Purge from data/citizens.json if present
    try {
        const citizensFile = path.join(__dirname, 'data', 'citizens.json');
        if (fs.existsSync(citizensFile)) {
            const citizens = JSON.parse(fs.readFileSync(citizensFile, 'utf8'));
            if (citizens[cleanMobile]) {
                delete citizens[cleanMobile];
                fs.writeFileSync(citizensFile, JSON.stringify(citizens, null, 2), 'utf8');
            }
        }
    } catch (e) {}

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

// ─── Operator Error Telemetry (Zero-Cost Remote Diagnostics) ─────────────────
const TELEMETRY_COLLECTION = 'eseva_operator_telemetry';
const LOCAL_TELEMETRY_DIR = path.join(__dirname, 'data', 'telemetry');
if (!fs.existsSync(LOCAL_TELEMETRY_DIR)) {
    try { fs.mkdirSync(LOCAL_TELEMETRY_DIR, { recursive: true }); } catch (e) {}
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

    // 1. Save to local disk fallback
    try {
        const localFile = path.join(LOCAL_TELEMETRY_DIR, `${id}.json`);
        fs.writeFileSync(localFile, JSON.stringify(payload, null, 2), 'utf8');
    } catch (e) {}

    // 2. Save to Firestore if available (zero-cost: <400 bytes, free tier 20k writes/day)
    if (firestoreAvailable && firestoreInstance) {
        try {
            await firestoreInstance.collection(TELEMETRY_COLLECTION).doc(id).set(payload);
            console.log(`📡 [Telemetry] Error logged to Firestore: [${payload.errorType}] ${payload.errorMessage.substring(0, 80)}`);
        } catch (e) {
            console.warn(`Firestore logOperatorError error: ${e.message}`);
        }
    }
    return payload;
}

async function listOperatorErrors(limitCount = 30) {
    // 1. Try Firestore first
    if (firestoreAvailable && firestoreInstance) {
        try {
            const snap = await firestoreInstance.collection(TELEMETRY_COLLECTION)
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

    // 2. Fallback to local disk telemetry files
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
    } catch (e) {}

    return [];
}

module.exports = {
    saveCitizenDraft,
    getCitizenDraft,
    listAllDrafts,
    trashCitizenDraft,
    restoreCitizenDraft,
    deleteCitizenDraft,
    saveUserProfile,
    getUserProfile,
    lookupUserByMobile,
    logOperatorCorrection,
    logOperatorError,
    listOperatorErrors,
    downloadDocFromStorage,
    fileToBase64,
    STORAGE_BUCKET
};
