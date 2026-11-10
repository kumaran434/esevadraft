// =========================================================================
// Get Citizen Draft Implementation
// =========================================================================
const fs = require('fs');
const path = require('path');
const {
    LOCAL_DRAFTS_DIR,
    APPDATA_DRAFTS_DIR,
    COLLECTION_NAME,
    downloadDocFromStorage,
    fileToBase64,
    base64ToFile,
    syncFatherOrHusband,
    getFirestoreInstance,
    isFirestoreAvailable
} = require('./firestore_client');

const _loggedRestores = new Set();

async function getCitizenDraft(mobileNumber, operatorUid = null) {
    if (!mobileNumber) return null;
    const cleanMobile = String(mobileNumber).trim();
    const targetOp = operatorUid ? String(operatorUid).trim() : null;
    let data = null;

    // 1. Fast Local Disk Check (0ms latency - picks richest draft between workspace and AppData)
    const localFile = path.join(LOCAL_DRAFTS_DIR, `${cleanMobile}.json`);
    const appDataFile = path.join(APPDATA_DRAFTS_DIR, `${cleanMobile}.json`);
    let localData = null;
    let appData = null;
    if (fs.existsSync(localFile)) {
        try { localData = JSON.parse(fs.readFileSync(localFile, 'utf8')); } catch (_) {}
    }
    if (fs.existsSync(appDataFile)) {
        try { appData = JSON.parse(fs.readFileSync(appDataFile, 'utf8')); } catch (_) {}
    }

    // STRICT TENANT BOUNDARY: Exclude drafts that belong to a different operator
    if (targetOp && localData && localData.operatorUid && String(localData.operatorUid).trim() !== targetOp) {
        localData = null;
    }
    if (targetOp && appData && appData.operatorUid && String(appData.operatorUid).trim() !== targetOp) {
        appData = null;
    }

    if (localData && appData) {
        const localScore = Object.values(localData.citizenProfile || {}).filter(v => v !== '' && v !== null && v !== undefined).length;
        const appScore = Object.values(appData.citizenProfile || {}).filter(v => v !== '' && v !== null && v !== undefined).length;
        data = (appScore >= localScore) ? appData : localData;
    } else {
        data = localData || appData;
    }

    if (data && !_loggedRestores.has(cleanMobile)) {
        _loggedRestores.add(cleanMobile);
        console.log(`📁 Restored draft from local disk for +91 ${cleanMobile}`);
    }

    // 2. Cloud Firestore Fallback (only if not found on local disk)
    if (!data) {
        const firestore = getFirestoreInstance();
        if (isFirestoreAvailable() && firestore) {
            try {
                const doc = await firestore.collection(COLLECTION_NAME).doc(cleanMobile).get();
                if (doc.exists) {
                    const docData = doc.data();
                    const docOp = docData.operatorUid ? String(docData.operatorUid).trim() : null;
                    // STRICT TENANT BOUNDARY: Never load or cache another operator's draft from cloud!
                    if (targetOp && docOp && docOp !== targetOp) {
                        console.warn(`🚨 [Tenant Boundary] Blocked cross-operator access to +91 ${cleanMobile} (owner: ${docOp}, requester: ${targetOp})`);
                    } else {
                        data = docData;
                        if (!_loggedRestores.has(cleanMobile)) {
                            _loggedRestores.add(cleanMobile);
                            console.log(`☁️ Restored draft from Firestore for +91 ${cleanMobile}`);
                        }
                        // Cache to local disk ONLY IF owned by current operator
                        try {
                            const isDesktopApp = !!(process.versions.electron || process.env.DESKTOP_RUNTIME === '1' || process.env.IS_DESKTOP);
                            const targetLocalDir = (isDesktopApp && APPDATA_DRAFTS_DIR && fs.existsSync(APPDATA_DRAFTS_DIR)) ? APPDATA_DRAFTS_DIR : LOCAL_DRAFTS_DIR;
                            const cacheFile = path.join(targetLocalDir, `${cleanMobile}.json`);
                            if (!fs.existsSync(cacheFile)) {
                                fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2), 'utf8');
                            }
                        } catch (_) {}
                    }
                }
            } catch (e) {
                console.warn(`Firestore read fallback: ${e.message}`);
            }
        }
    }

    if (!data) return null;
    if (data.isDeleted === true || data.status === 'TRASHED') {
        return null; // Deleted drafts must NEVER be returned or resurrected!
    }

    // STRICT TENANT BOUNDARY: Final assertion
    if (targetOp && data.operatorUid && String(data.operatorUid).trim() !== targetOp) {
        return null;
    }

    const uploadsDir = path.join(__dirname, '..', '..', '..', 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const restoredDocs = {};
    const urls = data.storageUrls || {};
    const b64 = data.base64Docs || {};

    const isAddMemService = data.subService === 'ADD_MEMBER' ||
        data.citizenProfile?.subService === 'ADD_MEMBER' ||
        Boolean(data.citizenProfile?.subServiceData?.memberName) ||
        (data.intakeState && String(data.intakeState).startsWith('RATION_ADD_MEMBER')) ||
        (data.citizenProfile?.intakeState && String(data.citizenProfile.intakeState).startsWith('RATION_ADD_MEMBER'));

    async function restoreDoc(docType, fallbackB64Key, fallbackNameKey) {
        const existingLocal = (data.documents && data.documents[docType]) || 
                              (data.citizenProfile && data.citizenProfile.documents && data.citizenProfile.documents[docType]) ||
                              ((docType === 'gasBook' || docType === 'residenceProof') && (data.citizenProfile?.gasDetails?.gasBookPath || data.documents?.gasBook || data.documents?.residenceProof || data.citizenProfile?.residenceProof?.docPath)) ||
                              (docType === 'profilePhoto' && data.citizenProfile?.headPhotoPath) ||
                              (docType === 'headAadhaar' && (data.citizenProfile?.headAadhaarDocPath || (!isAddMemService && data.citizenProfile?.members?.[0]?.docPath)));
        if (existingLocal && typeof existingLocal === 'string') {
            if (fs.existsSync(existingLocal)) return existingLocal;
            const inUploads = path.join(uploadsDir, path.basename(existingLocal));
            if (fs.existsSync(inUploads)) return inUploads;
            const relPath = path.resolve(path.join(__dirname, '..', '..', '..', existingLocal.replace(/^[/\\]+/, '')));
            if (fs.existsSync(relPath)) return relPath;
        }

        const appDataUploads = path.join(process.env.APPDATA || 'C:\\Users\\ADMIN\\AppData\\Roaming', 'esevadraft-desktop', 'data', 'uploads', cleanMobile);
        if (fs.existsSync(appDataUploads)) {
            if (docType === 'gasBook' || docType === 'residenceProof') {
                for (const gn of ['gas.jpg', 'gas.jpeg', 'gas.png', 'gas.pdf', 'gasBook.jpg', 'gasBook.jpeg', 'gasBook.png', 'gasBook.pdf', 'residenceProof.jpg', 'residenceProof.jpeg', 'residenceProof.pdf']) {
                    const gp = path.join(appDataUploads, gn);
                    if (fs.existsSync(gp) && fs.statSync(gp).size > 100) return gp;
                }
            } else if (docType === 'profilePhoto') {
                const pp = path.join(appDataUploads, 'photo.jpg');
                if (fs.existsSync(pp) && fs.statSync(pp).size > 100) return pp;
            } else if (docType === 'headAadhaar') {
                const ap = path.join(appDataUploads, 'aadhaar.jpg');
                if (fs.existsSync(ap) && fs.statSync(ap).size > 100) return ap;
            }
        }

        const effectiveUrl = urls[docType] || 
                             ((docType === 'gasBook' || docType === 'residenceProof') ? (urls.gasBook || urls.residenceProof) : null);
        if (effectiveUrl) {
            const fileName = effectiveUrl.split('/').pop();
            const target = path.join(uploadsDir, fileName);
            if (fs.existsSync(target) && fs.statSync(target).size > 100) return target;
            const restored = await downloadDocFromStorage(effectiveUrl, target);
            if (restored) return restored;
        }

        const b64Key = b64[fallbackB64Key] ? fallbackB64Key : 
                       (docType === 'gasBook' && b64.residenceProofBase64 ? 'residenceProofBase64' : 
                       (docType === 'residenceProof' && b64.gasBookBase64 ? 'gasBookBase64' : null));
        const b64NameKey = b64Key ? (fallbackNameKey && b64[fallbackNameKey] ? fallbackNameKey : (b64Key === 'residenceProofBase64' ? 'residenceProofName' : 'gasBookName')) : null;

        if (b64Key && b64[b64Key]) {
            const targetName = (b64NameKey && b64[b64NameKey]) || `${docType}.jpg`;
            const target = path.join(uploadsDir, targetName);
            return base64ToFile(b64[b64Key], target);
        }
        return (existingLocal && typeof existingLocal === 'string' && fs.existsSync(existingLocal)) ? existingLocal : null;
    }

    restoredDocs.profilePhoto = await restoreDoc('profilePhoto', 'profilePhotoBase64', 'profilePhotoName');
    restoredDocs.headAadhaar = await restoreDoc('headAadhaar', 'headAadhaarBase64', 'headAadhaarName');
    restoredDocs.headAadhaarFront = await restoreDoc('headAadhaarFront', 'headAadhaarFrontBase64', 'headAadhaarFrontName');
    restoredDocs.headAadhaarBack = await restoreDoc('headAadhaarBack', 'headAadhaarBackBase64', 'headAadhaarBackName');
    restoredDocs.memberAadhaar = await restoreDoc('memberAadhaar', 'memberAadhaarBase64', 'memberAadhaarName');
    restoredDocs.memberAadhaarFront = await restoreDoc('memberAadhaarFront', 'memberAadhaarFrontBase64', 'memberAadhaarFrontName');
    restoredDocs.memberAadhaarBack = await restoreDoc('memberAadhaarBack', 'memberAadhaarBackBase64', 'memberAadhaarBackName');
    restoredDocs.residenceProof = await restoreDoc('residenceProof', 'residenceProofBase64', 'residenceProofName');
    restoredDocs.gasBook = await restoreDoc('gasBook', 'gasBookBase64', 'gasBookName');
    restoredDocs.birthCertificate = await restoreDoc('birthCertificate', 'birthCertificateBase64', 'birthCertificateName');
    restoredDocs.newAddressProof = await restoreDoc('newAddressProof', 'newAddressProofBase64', 'newAddressProofName');
    restoredDocs.surrenderProof = await restoreDoc('surrenderProof', 'surrenderProofBase64', 'surrenderProofName');

    try {
        const { produceDualSidedDocument } = require('../../../photo_studio');
        if (restoredDocs.headAadhaarFront && restoredDocs.headAadhaarBack && (!restoredDocs.headAadhaar || !restoredDocs.headAadhaar.toLowerCase().includes('merged'))) {
            const merged = await produceDualSidedDocument(restoredDocs.headAadhaarFront, restoredDocs.headAadhaarBack);
            if (merged) restoredDocs.headAadhaar = merged;
        }
        if (restoredDocs.memberAadhaarFront && restoredDocs.memberAadhaarBack && (!restoredDocs.memberAadhaar || !restoredDocs.memberAadhaar.toLowerCase().includes('merged'))) {
            const merged = await produceDualSidedDocument(restoredDocs.memberAadhaarFront, restoredDocs.memberAadhaarBack);
            if (merged) restoredDocs.memberAadhaar = merged;
        }
    } catch (_) {}

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

    data.documents = Object.assign({}, data.documents || {}, restoredDocs);
    const hasMasterProfileDocs = Boolean(
        data.citizenProfile?.headPhotoPath ||
        data.citizenProfile?.headAadhaarDocPath ||
        restoredDocs.profilePhoto ||
        restoredDocs.gasBook ||
        restoredDocs.residenceProof ||
        (restoredDocs.headAadhaar && restoredDocs.headAadhaar !== data.citizenProfile?.subServiceData?.docPath)
    );
    if (isAddMemService && !hasMasterProfileDocs) {
        delete data.documents.headAadhaar;
        delete data.documents.headAadhaarFront;
        delete data.documents.headAadhaarBack;
        delete data.documents.profilePhoto;
        if (data.citizenProfile?.documents) {
            delete data.citizenProfile.documents.headAadhaar;
            delete data.citizenProfile.documents.headAadhaarFront;
            delete data.citizenProfile.documents.headAadhaarBack;
            delete data.citizenProfile.documents.profilePhoto;
        }
        if (data.base64Docs) {
            delete data.base64Docs.headAadhaarBase64;
            delete data.base64Docs.headAadhaarName;
            delete data.base64Docs.headAadhaarFrontBase64;
            delete data.base64Docs.headAadhaarBackBase64;
            delete data.base64Docs.profilePhotoBase64;
            delete data.base64Docs.profilePhotoName;
        }
    }
    Object.keys(data.documents).forEach(k => {
        if (!data.documents[k] || typeof data.documents[k] === 'boolean') {
            delete data.documents[k];
        } else if (Array.isArray(data.documents[k])) {
            data.documents[k] = data.documents[k].filter(item => typeof item === 'string' && item.length > 3);
            if (data.documents[k].length === 0) delete data.documents[k];
        }
    });

    if (!data.citizenProfile) data.citizenProfile = {};
    if (!data.citizenProfile.documents) data.citizenProfile.documents = {};
    Object.assign(data.citizenProfile.documents, data.documents);

    if (data.documents.profilePhoto) {
        data.citizenProfile.headPhotoPath = data.documents.profilePhoto;
    } else {
        delete data.citizenProfile.headPhotoPath;
    }
    if (data.documents.headAadhaar) {
        data.citizenProfile.headAadhaarDocPath = data.documents.headAadhaar;
    } else {
        delete data.citizenProfile.headAadhaarDocPath;
    }
    if (Array.isArray(data.documents.memberAadhaars) && Array.isArray(data.citizenProfile.members)) {
        data.documents.memberAadhaars.forEach((mDocPath, idx) => {
            if (data.citizenProfile.members[idx]) {
                data.citizenProfile.members[idx].docPath = mDocPath;
            }
        });
    }
    if (data.documents.residenceProof) {
        if (!data.citizenProfile.residenceProof) data.citizenProfile.residenceProof = {};
        data.citizenProfile.residenceProof.docPath = data.documents.residenceProof;
    } else if (data.citizenProfile.residenceProof) {
        delete data.citizenProfile.residenceProof.docPath;
    }
    if (data.documents.gasBook) {
        if (!data.citizenProfile.gasDetails) data.citizenProfile.gasDetails = {};
        data.citizenProfile.gasDetails.gasBookPath = data.documents.gasBook;
        data.citizenProfile.gasDetails.hasGas = true;
    } else if (data.citizenProfile.gasDetails) {
        delete data.citizenProfile.gasDetails.gasBookPath;
    }

    data.base64Docs = data.base64Docs || {};
    const docKeys = ['profilePhoto', 'headAadhaar', 'residenceProof', 'gasBook', 'memberAadhaar', 'birthCertificate', 'newAddressProof', 'surrenderProof', 'smartCard', 'rationCard'];
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
    data.base64Docs = data.base64Docs || {};
    if (restoredDocs.memberAadhaar && (!data.base64Docs.memberAadhaarsBase64 || data.base64Docs.memberAadhaarsBase64.length === 0)) {
        if (fs.existsSync(restoredDocs.memberAadhaar)) {
            data.base64Docs.memberAadhaarsBase64 = [{ name: path.basename(restoredDocs.memberAadhaar), base64: fileToBase64(restoredDocs.memberAadhaar) }];
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

module.exports = { getCitizenDraft };
