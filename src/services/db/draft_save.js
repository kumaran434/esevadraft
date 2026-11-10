// =========================================================================
// Save Citizen Draft Implementation
// =========================================================================
const fs = require('fs');
const path = require('path');
const { 
    LOCAL_DRAFTS_DIR, 
    APPDATA_DRAFTS_DIR, 
    COLLECTION_NAME, 
    normalizeOperatorUid, 
    syncFatherOrHusband, 
    getFirestoreInstance, 
    isFirestoreAvailable,
    isStorageAvailable 
} = require('./firestore_client');
const { processDraftDocuments } = require('./draft_doc_handler');

async function saveCitizenDraft(mobileNumber, draftData, options = {}) {
    if (!mobileNumber) return;
    const cleanMob = String(mobileNumber).trim();
    const shouldSyncCloudSync = options && options.syncCloud === true;

    // 1. Load existing draft from local disk or AppData to prevent wiping out extracted fields!
    let existingDraft = null;
    const localFile = path.join(LOCAL_DRAFTS_DIR, `${cleanMob}.json`);
    const appDataFile = path.join(APPDATA_DRAFTS_DIR, `${cleanMob}.json`);

    const candidates = [localFile, appDataFile].filter(p => fs.existsSync(p));
    for (const c of candidates) {
        try {
            const parsed = JSON.parse(fs.readFileSync(c, 'utf8'));
            if (parsed && (parsed.citizenProfile || parsed.mobileNumber)) {
                if (parsed.isDeleted === true || parsed.status === 'TRASHED') {
                    continue; // Skip trashed/deleted drafts so old deleted data is never merged back!
                }
                if (!existingDraft) {
                    existingDraft = parsed;
                } else {
                    const exCount = Object.values(existingDraft.citizenProfile || {}).filter(v => v !== '' && v !== null && v !== undefined).length;
                    const candCount = Object.values(parsed.citizenProfile || {}).filter(v => v !== '' && v !== null && v !== undefined).length;
                    if (candCount > exCount) existingDraft = parsed;
                }
            }
        } catch (_) {}
    }

    const existingProfile = existingDraft?.citizenProfile || {};
    const incomingProfile = draftData.citizenProfile || {};

    // Intelligent Non-Destructive Merge:
    // Never let an incoming empty string or null overwrite an existing non-empty extracted field!
    const mergedProfile = { ...existingProfile };
    for (const [k, v] of Object.entries(incomingProfile)) {
        if (v !== '' && v !== null && v !== undefined) {
            mergedProfile[k] = v;
        } else if (mergedProfile[k] === undefined) {
            mergedProfile[k] = v;
        }
    }

    // Handle subService and subServiceData: allow explicit clearing when null is passed
    if (draftData.subService === null || incomingProfile.subService === null) {
        mergedProfile.subService = null;
        delete mergedProfile.subService;
    }
    if (draftData.subServiceData === null || incomingProfile.subServiceData === null) {
        mergedProfile.subServiceData = null;
        delete mergedProfile.subServiceData;
    } else if (!mergedProfile.subServiceData && existingProfile.subServiceData) {
        mergedProfile.subServiceData = existingProfile.subServiceData;
    }
    // Preserve members if incoming has empty array but existing has members
    if ((!mergedProfile.members || mergedProfile.members.length === 0) && existingProfile.members && existingProfile.members.length > 0) {
        mergedProfile.members = existingProfile.members;
    }
    // Preserve gasDetails if existing has gas details
    if (existingProfile.gasDetails && (!mergedProfile.gasDetails || !mergedProfile.gasDetails.consumerNumber)) {
        mergedProfile.gasDetails = { ...(existingProfile.gasDetails || {}), ...(mergedProfile.gasDetails || {}) };
    }
    // Preserve residenceProof
    if (existingProfile.residenceProof && !mergedProfile.residenceProof) {
        mergedProfile.residenceProof = existingProfile.residenceProof;
    }

    syncFatherOrHusband(mergedProfile);

    // Merge documents package: never let an empty doc object overwrite existing uploaded docs!
    const incomingDocs = draftData.documents || {};
    const mergedDocs = {
        ...(existingDraft?.documents || {}),
        ...(existingProfile.documents || {})
    };
    for (const [dk, dv] of Object.entries(incomingDocs)) {
        if (dv) mergedDocs[dk] = dv;
    }
    mergedProfile.documents = mergedDocs;
    const docPackage = mergedDocs;

    // Gating check on mergedProfile
    const hasRealName = !!((mergedProfile.fullNameTam && mergedProfile.fullNameTam.trim()) || (mergedProfile.fullNameEng && mergedProfile.fullNameEng.trim()) || (draftData.name && draftData.name.trim() && !draftData.name.startsWith('வாடிக்கையாளர் (+91')));
    const hasAadhaar = !!(mergedProfile.headAadhaar && mergedProfile.headAadhaar.trim());
    const hasMembers = Array.isArray(mergedProfile.members) && mergedProfile.members.length > 0;
    const hasAppNo = !!(draftData.applicationNumber || mergedProfile.applicationNumber || existingDraft?.applicationNumber);
    const hasDocs = Object.keys(docPackage).some(k => !!docPackage[k]) ||
                    (draftData.base64Docs && Object.keys(draftData.base64Docs).length > 0) ||
                    (existingDraft?.base64Docs && Object.keys(existingDraft.base64Docs).length > 0);
    const hasCan = !!(mergedProfile.canNumber || draftData.canNumber || existingDraft?.canNumber);
    const hasSubService = !!mergedProfile.subServiceData;

    if (!hasRealName && !hasAadhaar && !hasMembers && !hasDocs && !hasAppNo && !hasCan && !hasSubService) {
        console.log(`[DRAFT GATE] Skipping save for empty draft ${cleanMob} (no actual customer details provided).`);
        return null;
    }

    // Resolve operator details
    const resolvedOperatorUid = normalizeOperatorUid(draftData.operatorUid) || normalizeOperatorUid(existingDraft?.operatorUid) || null;
    const resolvedOperatorName = draftData.operatorName || existingDraft?.operatorName || null;
    const resolvedOperatorMobile = draftData.operatorMobile || existingDraft?.operatorMobile || null;

    const { storageUrls, base64Docs } = await processDraftDocuments(cleanMob, mergedProfile, docPackage, draftData, { uploadToCloud: shouldSyncCloudSync });

    const mergedChatHistory = (Array.isArray(draftData.chatHistory) && draftData.chatHistory.length > 0)
        ? draftData.chatHistory
        : (Array.isArray(existingDraft?.chatHistory) && existingDraft.chatHistory.length > 0 ? existingDraft.chatHistory : []);

    const mergedStorageUrls = { ...(existingDraft?.storageUrls || {}), ...(storageUrls || {}) };
    const mergedBase64Docs = { ...(existingDraft?.base64Docs || {}), ...(base64Docs || {}) };

    const isAddMemDraft = mergedProfile.subService === 'ADD_MEMBER' ||
        draftData.subService === 'ADD_MEMBER' ||
        Boolean(mergedProfile.subServiceData?.memberName) ||
        (draftData.intakeState && String(draftData.intakeState).startsWith('RATION_ADD_MEMBER')) ||
        (mergedProfile.intakeState && String(mergedProfile.intakeState).startsWith('RATION_ADD_MEMBER'));

    const hasMasterProfileDocs = Boolean(
        mergedProfile.headPhotoPath ||
        incomingProfile.headAadhaarDocPath ||
        existingProfile.headAadhaarDocPath ||
        docPackage.profilePhoto ||
        docPackage.gasBook ||
        docPackage.residenceProof ||
        (docPackage.headAadhaar && docPackage.headAadhaar !== mergedProfile.subServiceData?.docPath)
    );
    if (isAddMemDraft && !hasMasterProfileDocs) {
        delete docPackage.headAadhaar;
        delete docPackage.headAadhaarFront;
        delete docPackage.headAadhaarBack;
        delete docPackage.profilePhoto;
        if (mergedProfile.documents) {
            delete mergedProfile.documents.headAadhaar;
            delete mergedProfile.documents.headAadhaarFront;
            delete mergedProfile.documents.headAadhaarBack;
            delete mergedProfile.documents.profilePhoto;
        }
        delete mergedProfile.headAadhaarDocPath;
        delete mergedProfile.headPhotoPath;
        delete mergedStorageUrls.headAadhaar;
        delete mergedStorageUrls.headAadhaarFront;
        delete mergedStorageUrls.headAadhaarBack;
        delete mergedStorageUrls.profilePhoto;
        delete mergedBase64Docs.headAadhaarBase64;
        delete mergedBase64Docs.headAadhaarName;
        delete mergedBase64Docs.headAadhaarFrontBase64;
        delete mergedBase64Docs.headAadhaarFrontName;
        delete mergedBase64Docs.headAadhaarBackBase64;
        delete mergedBase64Docs.headAadhaarBackName;
        delete mergedBase64Docs.profilePhotoBase64;
        delete mergedBase64Docs.profilePhotoName;
    }

    const resolvedCanNumber = draftData.canNumber || mergedProfile.canNumber || existingDraft?.canNumber || existingProfile.canNumber || null;
    if (resolvedCanNumber) {
        mergedProfile.canNumber = resolvedCanNumber;
    }

    const payload = {
        mobileNumber: cleanMob,
        operatorUid: resolvedOperatorUid,
        operatorName: resolvedOperatorName,
        operatorMobile: resolvedOperatorMobile,
        canNumber: resolvedCanNumber,
        citizenProfile: mergedProfile,
        subService: draftData.subService !== undefined ? draftData.subService : (mergedProfile.subService || existingDraft?.subService || null),
        subServiceData: draftData.subServiceData !== undefined ? draftData.subServiceData : (mergedProfile.subServiceData || existingDraft?.subServiceData || null),
        documents: docPackage,
        chatHistory: mergedChatHistory,
        intakeState: draftData.intakeState || existingDraft?.intakeState || 'INTAKE_TYPE',
        targetMemberCount: draftData.targetMemberCount !== undefined ? draftData.targetMemberCount : (existingDraft?.targetMemberCount !== undefined ? existingDraft.targetMemberCount : null),
        currentMemberIdx: draftData.currentMemberIdx !== undefined ? draftData.currentMemberIdx : (existingDraft?.currentMemberIdx !== undefined ? existingDraft.currentMemberIdx : 0),
        tempMember: draftData.tempMember || existingDraft?.tempMember || null,
        tempUploads: draftData.tempUploads || existingDraft?.tempUploads || null,
        step: draftData.step || existingDraft?.step || 'draft',
        status: draftData.status || existingDraft?.status || 'DRAFT_SAVED',
        applicationNumber: draftData.applicationNumber || existingDraft?.applicationNumber || null,
        applicationPdfUrl: draftData.applicationPdfUrl || existingDraft?.applicationPdfUrl || null,
        storageUrls: mergedStorageUrls,
        base64Docs: mergedBase64Docs,
        lastUpdated: new Date().toISOString()
    };

    // Single Local Disk Law:
    // When running inside the installed Desktop App (Electron / DESKTOP_RUNTIME), save exclusively to AppData (C: drive).
    // When running in workspace / test suite, save strictly to LOCAL_DRAFTS_DIR (data/drafts).
    // Customer drafts are NEVER written to multiple local disks simultaneously!
    const isDesktopApp = !!(process.versions.electron || process.env.DESKTOP_RUNTIME === '1' || process.env.IS_DESKTOP);
    const targetLocalDir = (isDesktopApp && APPDATA_DRAFTS_DIR && fs.existsSync(APPDATA_DRAFTS_DIR)) 
        ? APPDATA_DRAFTS_DIR 
        : LOCAL_DRAFTS_DIR;

    const fileTarget = path.join(targetLocalDir, `${cleanMob}.json`);
    try {
        fs.writeFileSync(fileTarget, JSON.stringify(payload, null, 2), 'utf8');
    } catch (e) {
        console.warn('Local draft write error:', e.message);
    }

    if (shouldSyncCloudSync) {
        const firestore = getFirestoreInstance();
        if (isFirestoreAvailable() && firestore) {
            try {
                await firestore.collection(COLLECTION_NAME).doc(String(cleanMob)).set(payload, { merge: true });
                console.log(`☁️ Draft safely synced to Firestore for +91 ${cleanMob}`);
            } catch (e) {
                console.warn(`Firestore save fallback to local: ${e.message}`);
            }
        }
    } else {
        // WhatsApp Desktop Standard: Non-blocking Background Cloud Backup
        setImmediate(async () => {
            try {
                const firestore = getFirestoreInstance();
                const storageAvail = isStorageAvailable();
                const firestoreAvail = isFirestoreAvailable() && firestore;
                if (!storageAvail && !firestoreAvail) return;

                if (storageAvail) {
                    const cloudRes = await processDraftDocuments(cleanMob, mergedProfile, docPackage, draftData, { uploadToCloud: true });
                    if (cloudRes && cloudRes.storageUrls && Object.keys(cloudRes.storageUrls).length > 0) {
                        payload.storageUrls = { ...(payload.storageUrls || {}), ...cloudRes.storageUrls };
                        try {
                            fs.writeFileSync(fileTarget, JSON.stringify(payload, null, 2), 'utf8');
                        } catch (_) {}
                    }
                }

                if (firestoreAvail) {
                    await firestore.collection(COLLECTION_NAME).doc(String(cleanMob)).set(payload, { merge: true });
                    console.log(`☁️ [Background Sync] Draft safely backed up to Firestore for +91 ${cleanMob}`);
                }
            } catch (e) {
                console.warn(`[Background Sync] Cloud backup error for +91 ${cleanMob}: ${e.message}`);
            }
        });
    }

    return payload;
}

module.exports = { saveCitizenDraft };
