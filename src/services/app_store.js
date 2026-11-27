// =========================================================================
// eSevaDraft Clean Single-Source Application Store (app_store.js)
// =========================================================================
// Architecture Law:
//   - 1 Application = 1 Independent JSON File (<draftId>.json) + 1 Firestore Doc
//   - Unlimited independent applications under the same 10-digit mobile number
//   - ZERO cross-application merging, ZERO duplicate <mobile>.json cards
//   - Strict operator multi-tenant boundary & delete fence (zero resurrection)
// =========================================================================
const fs = require('fs');
const path = require('path');
const {
    getActiveDataDir,
    getActiveDraftsDir,
    getActiveUploadsDir,
    COLLECTION_NAME,
    normalizeOperatorUid,
    isSpecificDraftId,
    extractMobileFromDraftKey,
    getActiveDraftIdForMobile,
    clearActiveDraftId,
    markDraftDeleted,
    isDraftStaleDueToDelete,
    deleteStoragePrefix,
    downloadDocFromStorage,
    base64ToFile,
    syncFatherOrHusband,
    getFirestoreInstance,
    isFirestoreAvailable,
    isStorageAvailable
} = require('./db/firestore_client');
const { processDraftDocuments } = require('./db/draft_doc_handler');

const _latestSaveSeq = new Map();
const _lastCloudHash = new Map();
const _loggedRestores = new Set();

const SYNTHETIC_TEST_MOBILES = new Set([
    '9790170099', '9840011223', '9111223344', '9333222111', '9444332211',
    '9555444333', '9777666555', '9876500050', '9991112244', '9998881122',
    '9123456780', '9955553661', '9999999999', '9999999988', '911133222111'
]);

const ALIAS_TO_CANONICAL = {
    headPhoto: 'profilePhoto',
    headAadhaarFront: 'headAadhaar',
    headAadhaarBack: 'headAadhaar',
    communityCertificate: 'communityProof',
    familyCommunityProof: 'communityProof',
    rationCard: 'smartCard'
};

function isInternalTempDocKey(k) {
    if (!k || typeof k !== 'string') return true;
    if (k.endsWith('Base64') || k.endsWith('Name') || k.endsWith('BoundingBox')) return true;
    if (/^(temp_|currentMember|memberDoc_|memberFront_|memberBack_|memberAadhaar\d+|memberAadhaar_|headAadhaarFront|headAadhaarBack|mergedAadhaar|smartCardFront|smartCardBack|rationCardFront|rationCardBack|gasBookFront|gasBookBack|residenceProofFront|residenceProofBack)/i.test(k)) return true;
    return k === 'memberAadhaars';
}

function isAddMemberContext(d) {
    if (!d) return false;
    const sub = d.subService || d.citizenProfile?.subService;
    const st = String(d.intakeState || d.citizenProfile?.intakeState || '');
    return sub === 'ADD_MEMBER' || Boolean(d.citizenProfile?.subServiceData?.memberName) || st.startsWith('RATION_ADD_MEMBER');
}

function resolveStorageKey(rawParam, draftData) {
    const explicitId = (draftData && draftData.draftId) ? String(draftData.draftId).trim() : '';
    if (explicitId && isSpecificDraftId(explicitId)) return explicitId;
    if (isSpecificDraftId(rawParam)) return rawParam;
    const routed = getActiveDraftIdForMobile(explicitId || rawParam, draftData?.operatorUid || null);
    if (routed) return routed;
    return explicitId || rawParam;
}

function readLocalJson(filePath) {
    if (!filePath || !fs.existsSync(filePath)) return null;
    try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch (_) { return null; }
}

function buildMasterCloudPayload(payload) {
    const cleanProfile = { ...(payload.citizenProfile || {}) };
    // Never strip subService, subServiceData, tempMember, or saved documents from a draft's own cloud backup!
    // Strip only heavy raw base64 buffers so Firestore 1MB doc limit is never exceeded.
    delete cleanProfile.base64Docs;

    const cleanDocs = {};
    for (const [k, v] of Object.entries(payload.documents || {})) {
        if (v !== null && v !== undefined && v !== '') cleanDocs[k] = v;
    }
    const cleanUrls = { ...(payload.storageUrls || {}) };
    cleanProfile.documents = { ...cleanDocs };

    const resolvedSubService = payload.subService !== undefined ? payload.subService : (cleanProfile.subService || null);
    const resolvedSubData = payload.subServiceData !== undefined ? payload.subServiceData : (cleanProfile.subServiceData || null);

    return {
        draftId: payload.draftId || payload.mobileNumber,
        mobileNumber: payload.mobileNumber,
        operatorUid: payload.operatorUid || null,
        operatorName: payload.operatorName || null,
        operatorMobile: payload.operatorMobile || null,
        canNumber: payload.canNumber || null,
        citizenProfile: cleanProfile,
        subService: resolvedSubService,
        subServiceData: resolvedSubData,
        documents: cleanDocs,
        chatHistory: Array.isArray(payload.chatHistory) ? payload.chatHistory.slice(-40) : [],
        intakeState: payload.intakeState || cleanProfile.intakeState || 'SERVICE_SELECTION',
        targetMemberCount: payload.targetMemberCount !== undefined ? payload.targetMemberCount : null,
        currentMemberIdx: payload.currentMemberIdx !== undefined ? payload.currentMemberIdx : 0,
        tempMember: payload.tempMember !== undefined ? payload.tempMember : (cleanProfile.tempMember || null),
        tempUploads: payload.tempUploads || cleanDocs || null,
        step: payload.step || 'draft',
        status: payload.applicationNumber ? 'SUBMITTED' : (payload.status || 'DRAFT_SAVED'),
        applicationNumber: payload.applicationNumber || null,
        applicationPdfUrl: payload.applicationPdfUrl || null,
        storageUrls: cleanUrls,
        lastUpdated: payload.lastUpdated
    };
}

function getStableFingerprint(obj) {
    const { lastUpdated, ...stable } = obj || {};
    try { return JSON.stringify(stable); } catch (_) { return ''; }
}

// =========================================================================
// 1. SAVE APPLICATION (1 File = 1 Application — Zero Cross-App Pollution)
// =========================================================================
async function saveApp(keyOrMobile, draftData = {}, options = {}) {
    if (!keyOrMobile) return null;
    const rawParam = String(keyOrMobile).trim();
    const storageKey = resolveStorageKey(rawParam, draftData);
    const cleanMob = extractMobileFromDraftKey(
        (draftData.mobileNumber && !isSpecificDraftId(draftData.mobileNumber) ? draftData.mobileNumber : '') ||
        (draftData.citizenProfile?.mobileNumber && !isSpecificDraftId(draftData.citizenProfile.mobileNumber) ? draftData.citizenProfile.mobileNumber : '') ||
        storageKey
    );

    const saveStartedAt = Date.now();
    const mySaveSeq = (_latestSaveSeq.get(storageKey) || 0) + 1;
    _latestSaveSeq.set(storageKey, mySaveSeq);
    const shouldSyncCloudSync = options && options.syncCloud === true;

    const activeFile = path.join(getActiveDraftsDir(), `${storageKey}.json`);
    const parsedExisting = readLocalJson(activeFile);
    const existing = (parsedExisting && !parsedExisting.isDeleted && parsedExisting.status !== 'TRASHED') ? parsedExisting : null;
    const existingProf = existing?.citizenProfile || {};
    const incomingProf = draftData.citizenProfile || {};

    // Clean single-app profile merge (null = explicit delete; fromEditModal allows empty-string clears on text fields)
    const isAuthoritativeEdit = Boolean(
        draftData.fromEditModal === true ||
        options.fromEditModal === true ||
        (incomingProf._editedInModalAt && (!existingProf._editedInModalAt || String(incomingProf._editedInModalAt) >= String(existingProf._editedInModalAt)))
    );
    const DOC_PATH_PROTECTED_KEYS = new Set([
        'headPhotoPath', 'profilePhoto', 'headPhoto', 'headAadhaarDocPath', 'headAadhaarPdfPath',
        'smartCardDocPath', 'rationCardDocPath', 'communityProof', 'communityCertificatePath', 'familyCommunityProofPath',
        'incomeProof', 'salaryCertificatePath', 'residenceProof', 'documents', 'base64Docs', 'savedVaultDocs'
    ]);
    const mergedProfile = { ...existingProf };
    for (const [k, v] of Object.entries(incomingProf)) {
        if (v === null) delete mergedProfile[k];
        else if (v !== '' && v !== undefined) mergedProfile[k] = v;
        else if (v === '' && isAuthoritativeEdit && !DOC_PATH_PROTECTED_KEYS.has(k)) mergedProfile[k] = '';
        else if (mergedProfile[k] === undefined) mergedProfile[k] = v;
    }

    if (draftData.subService === null || incomingProf.subService === null) delete mergedProfile.subService;
    if (draftData.subServiceData === null || incomingProf.subServiceData === null) delete mergedProfile.subServiceData;
    else if (!mergedProfile.subServiceData && existingProf.subServiceData) mergedProfile.subServiceData = existingProf.subServiceData;

    if ((!mergedProfile.members || mergedProfile.members.length === 0) && existingProf.members?.length > 0) {
        mergedProfile.members = existingProf.members;
    }
    if (incomingProf.gasDetails && incomingProf.gasDetails.hasGas === false) {
        mergedProfile.gasDetails = { ...incomingProf.gasDetails, hasGas: false };
    } else if (existingProf.gasDetails && (!mergedProfile.gasDetails || (!mergedProfile.gasDetails.consumerNumber && !isAuthoritativeEdit))) {
        mergedProfile.gasDetails = { ...existingProf.gasDetails, ...(mergedProfile.gasDetails || {}) };
    }
    if (existingProf.residenceProof && !mergedProfile.residenceProof) {
        mergedProfile.residenceProof = existingProf.residenceProof;
    }

    // Preserve submitted application receipts within this record
    {
        const appsMap = new Map();
        for (const a of [...(existingProf.submittedApplications || []), ...(mergedProfile.submittedApplications || [])]) {
            if (a && a.applicationNumber) appsMap.set(String(a.applicationNumber).trim(), a);
        }
        const curAppNo = String(draftData.applicationNumber || mergedProfile.applicationNumber || '').trim();
        if (curAppNo) {
            const prev = appsMap.get(curAppNo) || {};
            appsMap.set(curAppNo, {
                ...prev,
                applicationNumber: curAppNo,
                service: draftData.subService || mergedProfile.subService || prev.service || 'NEW_CARD',
                pdfUrl: draftData.applicationPdfUrl || mergedProfile.applicationPdfUrl || prev.pdfUrl || `/receipts/Application_${curAppNo}.pdf`,
                submittedAt: draftData.submittedAt || mergedProfile.submittedAt || prev.submittedAt || new Date().toISOString()
            });
        }
        if (appsMap.size > 0) mergedProfile.submittedApplications = Array.from(appsMap.values()).slice(-30);
    }

    syncFatherOrHusband(mergedProfile);

    // Merge documents & honor explicit deletions
    const incomingDocs = {
        ...(incomingProf.documents && typeof incomingProf.documents === 'object' ? incomingProf.documents : {}),
        ...(draftData.documents && typeof draftData.documents === 'object' ? draftData.documents : {})
    };
    const docPackage = { ...(existing?.documents || {}), ...(existingProf.documents || {}) };
    const explicitlyDeletedKeys = new Set();
    for (const [dk, dv] of Object.entries(incomingDocs)) {
        if (dv === null) { delete docPackage[dk]; explicitlyDeletedKeys.add(dk); }
        else if (dv) docPackage[dk] = dv;
    }

    if (Array.isArray(draftData.deletedDocTypes)) {
        for (const dt of draftData.deletedDocTypes) {
            delete docPackage[dt];
            explicitlyDeletedKeys.add(dt);
            if (dt === 'headPhoto' || dt === 'profilePhoto') {
                delete mergedProfile.headPhotoPath; delete mergedProfile.profilePhoto;
                delete docPackage.profilePhoto; delete docPackage.headPhoto;
                explicitlyDeletedKeys.add('profilePhoto'); explicitlyDeletedKeys.add('headPhoto');
            }
            if (dt === 'headAadhaar' || dt === 'headAadhaarFront' || dt === 'headAadhaarBack') {
                explicitlyDeletedKeys.add('headAadhaar'); explicitlyDeletedKeys.add('headAadhaarFront'); explicitlyDeletedKeys.add('headAadhaarBack');
            }
            if (dt === 'gasBook' || dt === 'residenceProof') {
                explicitlyDeletedKeys.add('gasBook'); explicitlyDeletedKeys.add('residenceProof');
            }
            if (dt === 'communityProof' || dt === 'communityCertificate' || dt === 'familyCommunityProof') {
                delete mergedProfile.communityCertificatePath; delete mergedProfile.familyCommunityProofPath; delete mergedProfile.communityProof;
                delete docPackage.communityProof; delete docPackage.communityCertificate; delete docPackage.familyCommunityProof;
                explicitlyDeletedKeys.add('communityProof'); explicitlyDeletedKeys.add('communityCertificate'); explicitlyDeletedKeys.add('familyCommunityProof');
            }
        }
    }

    if (!mergedProfile.headPhotoPath) { delete docPackage.profilePhoto; delete docPackage.headPhoto; }
    if (!mergedProfile.communityCertificatePath && !mergedProfile.familyCommunityProofPath && !mergedProfile.communityProof && !draftData.communityProof) {
        delete docPackage.communityProof; delete docPackage.communityCertificate; delete docPackage.familyCommunityProof;
    }
    for (const [dk, dv] of Object.entries(docPackage)) {
        if (dv === null || dv === undefined || dv === '') delete docPackage[dk];
    }
    mergedProfile.documents = { ...docPackage };

    // Empty-draft gate: NEVER write blank/ghost files to disk
    const hasRealName = Boolean((mergedProfile.fullNameTam && mergedProfile.fullNameTam.trim()) || (mergedProfile.fullNameEng && mergedProfile.fullNameEng.trim()) || (draftData.name && draftData.name.trim() && !draftData.name.startsWith('வாடிக்கையாளர் (+91')));
    const hasAadhaar = Boolean(mergedProfile.headAadhaar && mergedProfile.headAadhaar.trim());
    const hasMembers = Array.isArray(mergedProfile.members) && mergedProfile.members.length > 0;
    const hasAppNo = Boolean(draftData.applicationNumber || mergedProfile.applicationNumber || existing?.applicationNumber);
    const hasDocs = Object.keys(docPackage).length > 0 || (draftData.base64Docs && Object.keys(draftData.base64Docs).length > 0) || (existing?.base64Docs && Object.keys(existing.base64Docs).length > 0);
    const hasCan = Boolean(mergedProfile.canNumber || draftData.canNumber || existing?.canNumber);
    const hasSubService = Boolean(mergedProfile.subServiceData && Object.keys(mergedProfile.subServiceData).length > 0);

    if (!hasRealName && !hasAadhaar && !hasMembers && !hasDocs && !hasAppNo && !hasCan && !hasSubService && !(existing && options && options.allowResetUpdate)) {
        console.log(`[DRAFT GATE] Skipping save for empty draft ${storageKey} (no actual customer details provided).`);
        return null;
    }

    const { storageUrls, base64Docs } = await processDraftDocuments(storageKey, mergedProfile, docPackage, draftData, { uploadToCloud: shouldSyncCloudSync });
    const mergedStorageUrls = { ...(existing?.storageUrls || {}), ...(storageUrls || {}) };
    const mergedBase64Docs = { ...(existing?.base64Docs || {}), ...(base64Docs || {}) };

    // Prevent resurrecting deleted photo/community/transient add-member docs
    if (!mergedProfile.headPhotoPath) {
        for (const k of ['profilePhoto', 'headPhoto']) { delete docPackage[k]; delete mergedStorageUrls[k]; }
        for (const bk of ['profilePhotoBase64', 'profilePhotoName', 'headPhotoBase64', 'headPhotoName']) delete mergedBase64Docs[bk];
    }
    if (!mergedProfile.communityCertificatePath && !mergedProfile.familyCommunityProofPath && !mergedProfile.communityProof && !draftData.communityProof) {
        for (const k of ['communityProof', 'communityCertificate', 'familyCommunityProof']) { delete docPackage[k]; delete mergedStorageUrls[k]; }
        for (const bk of ['communityProofBase64', 'communityProofName', 'communityCertificateBase64', 'familyCommunityProofBase64']) delete mergedBase64Docs[bk];
    }

    const isLeavingAddMember = (draftData.subService !== undefined && draftData.subService !== 'ADD_MEMBER');
    if (isLeavingAddMember) {
        delete mergedProfile.tempMember;
        if (String(draftData.subService || '').toUpperCase() === 'NEW_CARD') {
            mergedProfile.subServiceData = {};
        }
        for (const k of ['memberAadhaar', 'memberAadhaarFront', 'memberAadhaarBack', 'mergedAadhaar', 'birthCertificate', 'surrenderProof']) {
            delete docPackage[k]; delete mergedStorageUrls[k];
        }
        for (const bk of ['memberAadhaarBase64', 'memberAadhaarName', 'memberAadhaarFrontBase64', 'memberAadhaarFrontName', 'memberAadhaarBackBase64', 'memberAadhaarBackName', 'memberAadhaarsBase64', 'birthCertificateBase64', 'surrenderProofBase64']) {
            delete mergedBase64Docs[bk];
        }
    }

    // Never duplicate Head Aadhaar as Member Aadhaar on walk-in Add Member drafts
    const isAddMem = isAddMemberContext({ subService: draftData.subService || mergedProfile.subService, intakeState: draftData.intakeState || mergedProfile.intakeState, citizenProfile: mergedProfile });
    const hasMasterDocs = Boolean(mergedProfile.headPhotoPath || incomingProf.headAadhaarDocPath || existingProf.headAadhaarDocPath || docPackage.profilePhoto || docPackage.gasBook || docPackage.residenceProof || (docPackage.headAadhaar && docPackage.headAadhaar !== mergedProfile.subServiceData?.docPath));
    if (isAddMem && !hasMasterDocs) {
        for (const k of ['headAadhaar', 'headAadhaarFront', 'headAadhaarBack', 'profilePhoto']) {
            delete docPackage[k]; delete mergedStorageUrls[k];
            if (mergedProfile.documents) delete mergedProfile.documents[k];
        }
        delete mergedProfile.headAadhaarDocPath; delete mergedProfile.headPhotoPath;
        for (const bk of ['headAadhaarBase64', 'headAadhaarName', 'headAadhaarFrontBase64', 'headAadhaarFrontName', 'headAadhaarBackBase64', 'headAadhaarBackName', 'profilePhotoBase64', 'profilePhotoName']) delete mergedBase64Docs[bk];
    }

    // Archive clean non-temp documents into savedVaultDocs[]
    {
        const headBase = (docPackage.headAadhaar || mergedProfile.headAadhaarDocPath) ? path.basename(String(docPackage.headAadhaar || mergedProfile.headAadhaarDocPath)) : '';
        const vaultList = [...(existingProf.savedVaultDocs || []), ...(mergedProfile.savedVaultDocs || [])].filter(v => {
            if (!v || !v.docType || isInternalTempDocKey(v.docType) || explicitlyDeletedKeys.has(v.docType)) return false;
            if ((v.docType === 'memberAadhaar' || v.docType === 'memberAadhaarFront' || v.docType === 'memberAadhaarBack') && headBase && v.fileName && path.basename(String(v.fileName)) === headBase) return false;
            return true;
        });
        const vaultMap = new Map();
        for (const v of vaultList) vaultMap.set(`${v.docType}:${v.fileName || v.localPath || v.cloudUrl || ''}`, v);
        const nowIso = new Date().toISOString();
        const svcTag = draftData.subService || mergedProfile.subService || 'GENERAL';
        for (const [dk, dv] of Object.entries(docPackage)) {
            if (!dv || typeof dv !== 'string' || dv === 'SELF_DECLARATION' || isInternalTempDocKey(dk) || explicitlyDeletedKeys.has(dk)) continue;
            const fName = path.basename(dv);
            if (!fName || fName.length < 3) continue;
            const canon = ALIAS_TO_CANONICAL[dk] || dk;
            if (isInternalTempDocKey(canon) || explicitlyDeletedKeys.has(canon)) continue;
            if ((canon === 'memberAadhaar' || canon === 'memberAadhaarFront' || canon === 'memberAadhaarBack') && headBase && fName === headBase) continue;
            const vKey = `${canon}:${fName}`;
            if (!vaultMap.has(vKey)) {
                const cloudHref = mergedStorageUrls[canon] || mergedStorageUrls[dk] || existing?.storageUrls?.[canon] || existing?.storageUrls?.[dk] || null;
                vaultMap.set(vKey, {
                    docType: canon,
                    fileName: fName,
                    localPath: dv,
                    cloudUrl: (cloudHref && (String(cloudHref).startsWith('http') || String(cloudHref).startsWith('gs://'))) ? cloudHref : null,
                    service: svcTag,
                    savedAt: nowIso
                });
            }
        }
        mergedProfile.savedVaultDocs = Array.from(vaultMap.values()).slice(-40);
    }

    const resolvedCan = draftData.canNumber || mergedProfile.canNumber || existing?.canNumber || existingProf.canNumber || null;
    if (resolvedCan) mergedProfile.canNumber = resolvedCan;
    mergedProfile.documents = { ...docPackage };

    const payload = {
        draftId: storageKey,
        mobileNumber: cleanMob,
        operatorUid: normalizeOperatorUid(draftData.operatorUid) || normalizeOperatorUid(existing?.operatorUid) || null,
        operatorName: draftData.operatorName || existing?.operatorName || null,
        operatorMobile: draftData.operatorMobile || existing?.operatorMobile || null,
        canNumber: resolvedCan,
        citizenProfile: mergedProfile,
        subService: draftData.subService !== undefined ? draftData.subService : (mergedProfile.subService || existing?.subService || null),
        subServiceData: draftData.subServiceData !== undefined ? draftData.subServiceData : (mergedProfile.subServiceData || existing?.subServiceData || null),
        documents: docPackage,
        chatHistory: (Array.isArray(draftData.chatHistory) && draftData.chatHistory.length > 0) ? draftData.chatHistory : (Array.isArray(existing?.chatHistory) ? existing.chatHistory : []),
        intakeState: draftData.intakeState || existing?.intakeState || 'INTAKE_TYPE',
        targetMemberCount: draftData.targetMemberCount !== undefined ? draftData.targetMemberCount : (existing?.targetMemberCount !== undefined ? existing.targetMemberCount : null),
        currentMemberIdx: draftData.currentMemberIdx !== undefined ? draftData.currentMemberIdx : (existing?.currentMemberIdx !== undefined ? existing.currentMemberIdx : 0),
        tempMember: draftData.tempMember !== undefined ? draftData.tempMember : (isLeavingAddMember ? null : (existing?.tempMember || null)),
        tempUploads: draftData.tempUploads || existing?.tempUploads || null,
        step: draftData.step || existing?.step || 'draft',
        status: draftData.status || existing?.status || 'DRAFT_SAVED',
        applicationNumber: draftData.applicationNumber || existing?.applicationNumber || null,
        applicationPdfUrl: draftData.applicationPdfUrl || existing?.applicationPdfUrl || null,
        storageUrls: mergedStorageUrls,
        base64Docs: mergedBase64Docs,
        lastUpdated: new Date().toISOString()
    };

    if (isDraftStaleDueToDelete(storageKey, saveStartedAt) || _latestSaveSeq.get(storageKey) !== mySaveSeq) return null;

    try { fs.writeFileSync(activeFile, JSON.stringify(payload, null, 2), 'utf8'); } catch (e) { console.warn('Local app_store write error:', e.message); }
    if (options && options.localOnly === true) return payload;

    const syncToCloud = async () => {
        if (isDraftStaleDueToDelete(storageKey, saveStartedAt) || _latestSaveSeq.get(storageKey) !== mySaveSeq) return;
        const firestore = getFirestoreInstance();
        const storageAvail = isStorageAvailable();
        const firestoreAvail = isFirestoreAvailable() && firestore;
        if (!storageAvail && !firestoreAvail) return;

        if (storageAvail && !shouldSyncCloudSync) {
            const cloudRes = await processDraftDocuments(storageKey, mergedProfile, docPackage, draftData, { uploadToCloud: true });
            if (isDraftStaleDueToDelete(storageKey, saveStartedAt) || _latestSaveSeq.get(storageKey) !== mySaveSeq) return;
            if (cloudRes?.storageUrls && Object.keys(cloudRes.storageUrls).length > 0) {
                payload.storageUrls = { ...(payload.storageUrls || {}), ...cloudRes.storageUrls };
                for (const v of (payload.citizenProfile?.savedVaultDocs || [])) {
                    if (v && v.docType && cloudRes.storageUrls[v.docType] && !v.cloudUrl) v.cloudUrl = cloudRes.storageUrls[v.docType];
                }
                try { fs.writeFileSync(activeFile, JSON.stringify(payload, null, 2), 'utf8'); } catch (_) {}
            }
        }
        if (isDraftStaleDueToDelete(storageKey, saveStartedAt) || _latestSaveSeq.get(storageKey) !== mySaveSeq) return;
        if (firestoreAvail) {
            const cloudPayload = buildMasterCloudPayload(payload);
            const fp = getStableFingerprint(cloudPayload);
            if (!shouldSyncCloudSync && fp && _lastCloudHash.get(storageKey) === fp) return;
            await firestore.collection(COLLECTION_NAME).doc(String(storageKey)).set(cloudPayload);
            _lastCloudHash.set(storageKey, fp);
        }
    };

    if (shouldSyncCloudSync) {
        try { await syncToCloud(); } catch (e) { console.warn('Cloud sync warning:', e.message); }
    } else {
        setImmediate(() => { syncToCloud().catch(e => console.warn(`[AppStore Cloud Sync] ${storageKey}: ${e.message}`)); });
    }
    return payload;
}

// =========================================================================
// 2. GET APPLICATION (Exact draftId lookup + clean local/cloud restore)
// =========================================================================
async function getApp(keyOrMobile, operatorUid = null) {
    if (!keyOrMobile) return null;
    const rawKey = String(keyOrMobile).trim();
    const targetOp = operatorUid ? String(operatorUid).trim() : null;
    const activeDraftsDir = getActiveDraftsDir();
    let data = null;
    let resolvedId = rawKey;

    const directFile = path.join(activeDraftsDir, `${rawKey}.json`);
    const parsedDirect = readLocalJson(directFile);
    if (parsedDirect && (!targetOp || (parsedDirect.operatorUid && String(parsedDirect.operatorUid).trim() === targetOp))) {
        data = parsedDirect;
    }

    // Backward-compatible fallback: if a plain 10-digit mobile was queried and <mob>.json doesn't exist, return newest <mob>_*.json
    if (!data && !isSpecificDraftId(rawKey) && /^[0-9]{10}$/.test(rawKey) && fs.existsSync(activeDraftsDir)) {
        try {
            let newestTs = -1;
            for (const f of fs.readdirSync(activeDraftsDir).filter(x => x.startsWith(`${rawKey}_`) && x.endsWith('.json'))) {
                const parsed = readLocalJson(path.join(activeDraftsDir, f));
                if (!parsed || parsed.isDeleted || parsed.status === 'TRASHED') continue;
                if (targetOp && (!parsed.operatorUid || String(parsed.operatorUid).trim() !== targetOp)) continue;
                const ts = new Date(parsed.lastUpdated || 0).getTime();
                if (ts >= newestTs) { newestTs = ts; data = parsed; resolvedId = f.replace('.json', ''); }
            }
        } catch (_) {}
    }

    if (data && !_loggedRestores.has(resolvedId)) {
        _loggedRestores.add(resolvedId);
        console.log(`📁 Restored draft from local disk for +91 ${resolvedId}`);
    }

    // Cloud Firestore fallback ONLY when missing locally
    if (!data) {
        const firestore = getFirestoreInstance();
        if (isFirestoreAvailable() && firestore) {
            try {
                const doc = await firestore.collection(COLLECTION_NAME).doc(rawKey).get();
                if (doc.exists) {
                    const docData = doc.data();
                    const docOp = docData.operatorUid ? String(docData.operatorUid).trim() : null;
                    if (!targetOp || (docOp && docOp === targetOp)) {
                        if (!docData.isDeleted && docData.status !== 'TRASHED' && !isDraftStaleDueToDelete(rawKey, docData.lastUpdated)) {
                            data = docData;
                            if (!fs.existsSync(directFile)) {
                                try { fs.writeFileSync(directFile, JSON.stringify(data, null, 2), 'utf8'); } catch (_) {}
                            }
                        }
                    }
                }
            } catch (_) {}
        }
    }

    if (!data || data.isDeleted === true || data.status === 'TRASHED') return null;
    if (targetOp && data.operatorUid && String(data.operatorUid).trim() !== targetOp) return null;

    data.draftId = data.draftId || resolvedId;
    data.mobileNumber = extractMobileFromDraftKey(data.mobileNumber || data.citizenProfile?.mobileNumber || resolvedId);

    // Restore missing local doc files from Storage / base64 if needed
    const uploadsDir = getActiveUploadsDir();
    const urls = data.storageUrls || {};
    const b64 = data.base64Docs || {};
    const isAddMem = isAddMemberContext(data);
    const restoredDocs = {};

    async function ensureDocFile(docType, b64Key, nameKey) {
        if (docType === 'profilePhoto' && (!data.citizenProfile?.headPhotoPath && !data.documents?.profilePhoto)) return null;
        const existingLocal = data.documents?.[docType] || data.citizenProfile?.documents?.[docType] ||
            (docType === 'profilePhoto' && data.citizenProfile?.headPhotoPath) ||
            (docType === 'headAadhaar' && (data.citizenProfile?.headAadhaarDocPath || (!isAddMem && data.citizenProfile?.members?.[0]?.docPath))) ||
            ((docType === 'gasBook' || docType === 'residenceProof') && (data.citizenProfile?.gasDetails?.gasBookPath || data.citizenProfile?.residenceProof?.docPath));

        if (existingLocal && typeof existingLocal === 'string') {
            if (fs.existsSync(existingLocal)) return existingLocal;
            const inUp = path.join(uploadsDir, path.basename(existingLocal));
            if (fs.existsSync(inUp)) return inUp;
            const rel = path.resolve(path.join(__dirname, '..', '..', existingLocal.replace(/^[/\\]+/, '')));
            if (fs.existsSync(rel)) return rel;
        }
        const url = urls[docType];
        if (url && typeof url === 'string' && (url.startsWith('http') || url.startsWith('gs://'))) {
            const target = path.join(uploadsDir, url.split('/').pop());
            if (fs.existsSync(target) && fs.statSync(target).size > 100) return target;
            const dl = await downloadDocFromStorage(url, target);
            if (dl) return dl;
        }
        if (b64[b64Key]) {
            const target = path.join(uploadsDir, `${data.draftId}_${(nameKey && b64[nameKey]) || `${docType}.jpg`}`);
            const f = base64ToFile(b64[b64Key], target);
            if (f) return f;
        }
        return null;
    }

    const docSpecs = [
        ['profilePhoto', 'profilePhotoBase64', 'profilePhotoName'],
        ['headAadhaar', 'headAadhaarBase64', 'headAadhaarName'],
        ['gasBook', 'gasBookBase64', 'gasBookName'],
        ['residenceProof', 'residenceProofBase64', 'residenceProofName'],
        ['smartCard', 'smartCardBase64', 'smartCardName'],
        ['memberAadhaar', 'memberAadhaarBase64', 'memberAadhaarName'],
        ['communityProof', 'communityProofBase64', 'communityProofName']
    ];
    for (const [dt, bk, nk] of docSpecs) {
        const p = await ensureDocFile(dt, bk, nk);
        if (p) restoredDocs[dt] = p;
    }
    if (data.documents) {
        for (const [k, v] of Object.entries(data.documents)) {
            if (!restoredDocs[k] && v) restoredDocs[k] = v;
        }
    }
    data.documents = restoredDocs;
    if (data.citizenProfile) {
        data.citizenProfile.documents = { ...(data.citizenProfile.documents || {}), ...restoredDocs };
        if (restoredDocs.profilePhoto) data.citizenProfile.headPhotoPath = restoredDocs.profilePhoto;
        if (restoredDocs.headAadhaar) data.citizenProfile.headAadhaarDocPath = restoredDocs.headAadhaar;
        syncFatherOrHusband(data.citizenProfile);
    }
    return data;
}

// =========================================================================
// 3. LIST APPLICATIONS (1 File = 1 Independent Card — Unlimited per Mobile)
// =========================================================================
function isMeaningfulApp(d) {
    if (!d || (!d.mobileNumber && !d.draftId)) return false;
    const cleanMob = extractMobileFromDraftKey(d.mobileNumber || d.draftId);
    if (!cleanMob || cleanMob.startsWith('walkin_')) return false;
    const isTestRun = process.env.REGRESSION_TEST === 'true' || process.env.NODE_ENV === 'test';
    const prof = d.citizenProfile || {};
    if (!isTestRun) {
        if (/^99999000\d{2}$/.test(cleanMob) || SYNTHETIC_TEST_MOBILES.has(cleanMob)) return false;
        const aadh = String(prof.headAadhaar || d.headAadhaar || '').replace(/\D/g, '');
        if (aadh === '123456789012' || aadh === '987654321012') return false;
    }
    return Boolean(
        (prof.fullNameTam && prof.fullNameTam.trim()) ||
        (prof.fullNameEng && prof.fullNameEng.trim()) ||
        (d.name && d.name.trim() && !d.name.startsWith('வாடிக்கையாளர் (+91')) ||
        (prof.headAadhaar && prof.headAadhaar.trim()) ||
        (Array.isArray(prof.members) && prof.members.length > 0) ||
        Boolean(d.subService || prof.subService) ||
        (prof.subServiceData && Object.keys(prof.subServiceData).length > 0) ||
        (d.subServiceData && Object.keys(d.subServiceData).length > 0) ||
        (Array.isArray(prof.savedFamilyMembers) && prof.savedFamilyMembers.length > 0) ||
        (Array.isArray(prof.savedVaultDocs) && prof.savedVaultDocs.length > 0) ||
        prof.tempMember ||
        (d.documents && Object.keys(d.documents).some(k => Boolean(d.documents[k]))) ||
        (d.base64Docs && Object.keys(d.base64Docs).length > 0) ||
        (prof.documents && Object.keys(prof.documents).some(k => Boolean(prof.documents[k]))) ||
        d.applicationNumber || prof.canNumber || d.canNumber
    );
}

function extractDisplayName(d) {
    const prof = d?.citizenProfile || {};
    for (const cand of [prof.fullNameTam, prof.fullNameEng, prof.subServiceData?.memberNameTam, prof.subServiceData?.memberNameEng, prof.subServiceData?.memberName, prof.tempMember?.nameTam, prof.tempMember?.nameEng, prof.members?.[0]?.nameTam, prof.members?.[0]?.nameEng, d?.name]) {
        if (cand && typeof cand === 'string' && cand.trim() && cand.trim() !== 'வாடிக்கையாளர்' && !cand.startsWith('வாடிக்கையாளர் (+91')) {
            return cand.trim();
        }
    }
    return 'வாடிக்கையாளர்';
}

function extractServiceLabel(d) {
    const prof = d?.citizenProfile || {};
    const sub = String(prof.subService || d?.subService || prof.subServiceData?.subService || '').toUpperCase();
    const st = String(d?.intakeState || prof.intakeState || '').toUpperCase();
    const docs = d?.documents || prof.documents || {};
    if (sub === 'NEW_CARD' || sub === 'NEW_RATION_CARD' || sub === 'NEW_SMART_CARD') return 'புதிய குடும்ப அட்டை';
    if (sub === 'ADD_MEMBER' || st.includes('ADD_MEMBER') || (!sub && Boolean(docs.memberAadhaar))) return 'குடும்ப உறுப்பினர் சேர்க்கை';
    if (sub === 'REMOVE_MEMBER' || st.includes('REMOVE_MEMBER') || (!sub && Boolean(docs.removeProof))) return 'குடும்ப உறுப்பினர் நீக்கம்';
    if (sub === 'ADDRESS_CHANGE' || sub === 'CHANGE_ADDRESS' || st.includes('CHANGE_ADDRESS') || (!sub && Boolean(docs.newAddressProof))) return 'முகவரி மாற்றம்';
    if (sub === 'CHANGE_HEAD' || st.includes('CHANGE_HEAD')) return 'குடும்பத் தலைவர் மாற்றம்';
    if (sub === 'UPDATE_MOBILE' || sub === 'CHANGE_MOBILE' || st.includes('UPDATE_MOBILE')) return 'கைபேசி எண் மாற்றம்';
    if (sub === 'INCOME' || st.startsWith('INCOME_')) return 'வருமானச் சான்றிதழ்';
    if (sub === 'COMMUNITY' || st.startsWith('COMMUNITY_')) return 'சாதிச் சான்றிதழ்';
    if (sub === 'RESIDENCE' || st.startsWith('RESIDENCE_')) return 'இருப்பிடச் சான்றிதழ்';
    if (sub === 'FIRST_GRADUATE' || st.startsWith('FIRST_GRADUATE_')) return 'முதல் தலைமுறை பட்டதாரி';
    if (sub === 'OBC' || st.startsWith('OBC_')) return 'OBC சான்றிதழ்';
    if (sub === 'LEGAL_HEIR' || st.startsWith('LEGAL_HEIR_')) return 'வாரிசுச் சான்றிதழ்';
    if (sub === 'WIDOW' || st.startsWith('WIDOW_')) return 'விதவைச் சான்றிதழ்';
    if (sub === 'CAN_REGISTER' || st.startsWith('CAN_')) return 'TNeGA CAN பதிவு';
    if (d?.serviceName && d.serviceName !== 'மாஸ்டர் சுயவிவரம்') return d.serviceName;
    if (prof.canNumber || d?.canNumber) return 'TNeGA வருவாய் சேவை';
    return 'புதிய குடும்ப அட்டை';
}

function computeHasIncompleteWork(d) {
    if (!d || d.isDeleted || d.status === 'TRASHED') return false;
    if (d.status === 'SUBMITTED' || d.status === 'COMPLETED' || d.certificateReady === true || d.applicationNumber) return false;
    const st = String(d.intakeState || d.step || '').trim().toUpperCase();
    if (new Set(['', 'SERVICE_SELECTION', 'RATION_CARD_SERVICES', 'REVENUE_DEPARTMENT_SERVICES', 'INTAKE_TYPE', 'SUBMITTED', 'COMPLETED', 'READY']).has(st)) return false;
    return Boolean(d.subService || d.citizenProfile?.subService || (Array.isArray(d.chatHistory) && d.chatHistory.length > 0));
}

function toCardSummary(draftId, d) {
    const prof = d.citizenProfile || {};
    return {
        draftId,
        mobileNumber: extractMobileFromDraftKey(d.mobileNumber || prof.mobileNumber || draftId),
        operatorUid: d.operatorUid || null,
        name: extractDisplayName(d),
        serviceName: extractServiceLabel(d),
        subService: prof.subService || d.subService || prof.subServiceData?.subService || null,
        membersCount: (prof.members && prof.members.length) || 1,
        district: prof.district || '—',
        taluk: prof.taluk || '—',
        status: d.status || 'DRAFT_SAVED',
        intakeState: d.intakeState || null,
        hasIncompleteWork: computeHasIncompleteWork(d),
        isDeleted: Boolean(d.isDeleted || d.status === 'TRASHED'),
        trashedAt: d.trashedAt || null,
        applicationNumber: d.applicationNumber || null,
        canNumber: prof.canNumber || d.canNumber || null,
        headAadhaar: prof.headAadhaar || d.headAadhaar || null,
        lastUpdated: d.lastUpdated
    };
}

async function listApps(operatorUid = null) {
    const syncStartedAt = Date.now();
    const normTarget = normalizeOperatorUid(operatorUid);
    const isTestRun = process.env.REGRESSION_TEST === 'true' || process.env.NODE_ENV === 'test';
    if (!normTarget && !isTestRun) return [];

    const drafts = [];
    const seenIds = new Set();
    const activeDraftsDir = getActiveDraftsDir();

    if (fs.existsSync(activeDraftsDir)) {
        for (const f of fs.readdirSync(activeDraftsDir).filter(x => x.endsWith('.json'))) {
            const fileId = f.replace('.json', '');
            const d = readLocalJson(path.join(activeDraftsDir, f));
            if (!isMeaningfulApp(d)) continue;
            const docOp = normalizeOperatorUid(d.operatorUid);
            if (normTarget && (!docOp || docOp !== normTarget)) continue;
            const draftId = String(d.draftId || fileId).trim();
            if (!seenIds.has(draftId)) {
                seenIds.add(draftId);
                drafts.push(toCardSummary(draftId, d));
            }
        }
    }

    const isDesktopLocal = !process.env.K_SERVICE && !process.env.GAE_SERVICE;
    const firestore = getFirestoreInstance();
    if (isFirestoreAvailable() && firestore) {
        try {
            const col = firestore.collection(COLLECTION_NAME);
            const queryRef = normTarget ? col.where('operatorUid', '==', normTarget) : col;
            const snap = isDesktopLocal
                ? await Promise.race([queryRef.get(), new Promise((_, rej) => setTimeout(() => rej(new Error('Cloud sync timeout')), 4500))])
                : await queryRef.get();
            snap.forEach(doc => {
                const d = doc.data();
                if (!isMeaningfulApp(d)) return;
                const docOp = normalizeOperatorUid(d.operatorUid);
                if (normTarget && (!docOp || docOp !== normTarget)) return;
                const draftId = String(d.draftId || doc.id || d.mobileNumber).trim();
                if (isDraftStaleDueToDelete(draftId, syncStartedAt)) return;
                const displayMob = extractMobileFromDraftKey(d.mobileNumber || d.citizenProfile?.mobileNumber || draftId);
                if (!d.isDeleted && d.status !== 'TRASHED') {
                    const localTarget = path.join(activeDraftsDir, `${draftId}.json`);
                    if (!fs.existsSync(localTarget) && !isDraftStaleDueToDelete(draftId, syncStartedAt)) {
                        try { fs.writeFileSync(localTarget, JSON.stringify({ ...d, draftId, mobileNumber: displayMob }, null, 2), 'utf8'); } catch (_) {}
                    }
                }
                if (!seenIds.has(draftId)) {
                    seenIds.add(draftId);
                    drafts.push(toCardSummary(draftId, d));
                }
            });
        } catch (e) {
            console.warn('AppStore cloud list warning:', e.message);
        }
    }

    return drafts.sort((a, b) => new Date(b.lastUpdated || 0) - new Date(a.lastUpdated || 0));
}

// =========================================================================
// 4. TRASH / RESTORE / PERMANENT DELETE (Isolated Per Application)
// =========================================================================
async function setTrashState(keyOrMobile, isTrashed) {
    if (!keyOrMobile) return false;
    const key = String(keyOrMobile).trim();
    const nowIso = new Date().toISOString();
    const fPath = path.join(getActiveDraftsDir(), `${key}.json`);
    const parsed = readLocalJson(fPath);
    const restoredStatus = (parsed && (parsed.applicationNumber || parsed.citizenProfile?.applicationNumber)) ? 'SUBMITTED' : 'DRAFT_SAVED';
    const patch = {
        isDeleted: isTrashed,
        status: isTrashed ? 'TRASHED' : restoredStatus,
        trashedAt: isTrashed ? nowIso : null,
        lastUpdated: nowIso
    };
    const firestore = getFirestoreInstance();
    if (isFirestoreAvailable() && firestore) {
        try { await firestore.collection(COLLECTION_NAME).doc(key).set(patch, { merge: true }); } catch (_) {}
    }
    if (parsed) {
        try { fs.writeFileSync(fPath, JSON.stringify({ ...parsed, ...patch }, null, 2), 'utf8'); } catch (_) {}
    }
    return true;
}

const trashApp = (key) => setTrashState(key, true);
const restoreApp = (key) => setTrashState(key, false);

async function deleteApp(keyOrMobile, options = {}) {
    if (!keyOrMobile) return false;
    const rawKey = String(keyOrMobile).trim();
    const isSingle = isSpecificDraftId(rawKey);
    const wipeAllSiblings = !isSingle && options?.wipeAllSiblings === true;
    const cleanMob = extractMobileFromDraftKey(rawKey);
    const keysToClean = isSingle ? [rawKey] : Array.from(new Set([cleanMob, rawKey, `+91${cleanMob}`, `+91 ${cleanMob}`, `91${cleanMob}`].filter(Boolean)));

    // Only fence the exact key being deleted unless explicit wipeAllSiblings is requested (NEVER fence sibling draftIds!)
    markDraftDeleted(wipeAllSiblings ? keysToClean : [rawKey]);
    clearActiveDraftId(rawKey);

    try {
        const storageService = require('./storage_service');
        if (storageService && typeof storageService.purgeSession === 'function') {
            if (wipeAllSiblings) {
                for (const k of keysToClean) storageService.purgeSession(k);
            } else {
                storageService.purgeSession(rawKey);
            }
        }
    } catch (_) {}

    const firestore = getFirestoreInstance();
    if (isFirestoreAvailable() && firestore) {
        const col = firestore.collection(COLLECTION_NAME);
        for (const k of (wipeAllSiblings ? keysToClean : [rawKey])) {
            try { await col.doc(k).delete(); } catch (_) {}
        }
        if (wipeAllSiblings) {
            try {
                const snap = await col.where('mobileNumber', 'in', keysToClean.slice(0, 10)).get();
                for (const doc of snap.docs) await doc.ref.delete().catch(() => {});
            } catch (_) {}
        }
    }

    if (isStorageAvailable() && !options?.preserveUploads) {
        if (isSingle || !wipeAllSiblings) await deleteStoragePrefix(`drafts/${rawKey}/`).catch(() => {});
        else if (cleanMob) {
            await deleteStoragePrefix(`drafts/${cleanMob}/`).catch(() => {});
            await deleteStoragePrefix(`citizens/${cleanMob}/`).catch(() => {});
        }
    }

    const activeDataDir = getActiveDataDir();
    const activeDraftsDir = getActiveDraftsDir();
    const activeUploadsDir = getActiveUploadsDir();

    const filesToDelete = new Set((wipeAllSiblings ? keysToClean : [rawKey]).map(k => path.join(activeDraftsDir, `${k}.json`)));
    if (wipeAllSiblings && cleanMob && fs.existsSync(activeDraftsDir)) {
        for (const f of fs.readdirSync(activeDraftsDir)) {
            if (f.startsWith(`${cleanMob}_`) && f.endsWith('.json')) filesToDelete.add(path.join(activeDraftsDir, f));
        }
    }

    // Collect physical files referenced inside target draft(s) before deleting draft JSONs
    const collectRefs = (obj, outSet) => {
        if (!obj) return;
        const prof = obj.citizenProfile || {};
        for (const p of [prof.headPhotoPath, prof.headAadhaarDocPath, prof.residenceProof?.docPath, prof.gasDetails?.gasBookPath, ...Object.values(obj.documents || {}), ...Object.values(prof.documents || {})]) {
            if (typeof p === 'string') outSet.add(path.resolve(p));
        }
        for (const m of (prof.members || [])) if (m?.docPath && typeof m.docPath === 'string') outSet.add(path.resolve(m.docPath));
        for (const v of (prof.savedVaultDocs || [])) if (v?.localPath && typeof v.localPath === 'string') outSet.add(path.resolve(v.localPath));
    };

    const referencedFiles = new Set();
    for (const fp of filesToDelete) {
        collectRefs(readLocalJson(fp), referencedFiles);
    }
    for (const fp of filesToDelete) { if (fs.existsSync(fp)) { try { fs.unlinkSync(fp); } catch (_) {} } }

    // ALWAYS check ALL remaining drafts for this mobile (both <mob>.json & <mob>_*.json) before deleting any upload file!
    const remainingSiblings = (cleanMob && fs.existsSync(activeDraftsDir))
        ? fs.readdirSync(activeDraftsDir).filter(f => (f === `${cleanMob}.json` || f.startsWith(`${cleanMob}_`)) && f.endsWith('.json'))
        : [];
    const hasSiblings = remainingSiblings.length > 0;
    const siblingProtectedFiles = new Set();
    for (const sf of remainingSiblings) {
        collectRefs(readLocalJson(path.join(activeDraftsDir, sf)), siblingProtectedFiles);
    }

    if (!options?.preserveUploads) {
        for (const fp of referencedFiles) {
            if (!fp || siblingProtectedFiles.has(fp) || !fs.existsSync(fp)) continue;
            const low = fp.toLowerCase();
            const base = path.basename(fp).toLowerCase();
            if (base.startsWith('test_') || base.includes('sample') || low.includes('golden_samples')) continue;
            try { fs.unlinkSync(fp); } catch (_) {}
        }
    }

    if (!options?.preserveUploads && !hasSiblings) {
        for (const k of keysToClean) {
            const uDir = path.join(activeUploadsDir, k);
            if (fs.existsSync(uDir)) { try { fs.rmSync(uDir, { recursive: true, force: true }); } catch (_) {} }
        }
        if (cleanMob && fs.existsSync(activeUploadsDir)) {
            for (const f of fs.readdirSync(activeUploadsDir)) {
                if ((f.startsWith(`${cleanMob}_`) || f.includes(`_${cleanMob}_`) || f.includes(`_${cleanMob}.`)) && !f.toLowerCase().startsWith('test_') && !f.toLowerCase().includes('sample')) {
                    try { fs.rmSync(path.join(activeUploadsDir, f), { recursive: true, force: true }); } catch (_) {}
                }
            }
        }
    }

    if (!hasSiblings) {
        const aif = path.join(activeDataDir, 'aadhaar_citizen_index.json');
        const idx = readLocalJson(aif);
        if (idx) {
            let changed = false;
            for (const [ak, entry] of Object.entries(idx)) {
                const em = String(entry?.mobileNumber || '').trim();
                if (keysToClean.includes(em) || (cleanMob && em.replace(/\D/g, '').slice(-10) === cleanMob)) { delete idx[ak]; changed = true; }
            }
            if (changed) { try { fs.writeFileSync(aif, JSON.stringify(idx, null, 2), 'utf8'); } catch (_) {} }
        }
        const appDir = path.join(activeDataDir, 'applications');
        if (fs.existsSync(appDir)) {
            for (const f of fs.readdirSync(appDir).filter(x => x.endsWith('.json'))) {
                const fp = path.join(appDir, f);
                if (cleanMob && (f.startsWith(`APP_${cleanMob}_`) || f.includes(`_${cleanMob}_`))) { try { fs.unlinkSync(fp); } catch (_) {} continue; }
                const obj = readLocalJson(fp);
                const am = String(obj?.mobileNumber || '').trim();
                if (obj && (keysToClean.includes(am) || (cleanMob && am.replace(/\D/g, '').slice(-10) === cleanMob))) {
                    try { fs.unlinkSync(fp); } catch (_) {}
                }
            }
        }
    }
    return true;
}

function migrateCustomerUploads(oldMobile, newMobile) {
    const cleanOld = extractMobileFromDraftKey(oldMobile);
    const cleanNew = extractMobileFromDraftKey(newMobile);
    if (!cleanOld || !cleanNew || cleanOld === cleanNew) return false;
    const uploadsDir = getActiveUploadsDir();
    const oldDir = path.join(uploadsDir, cleanOld);
    const newDir = path.join(uploadsDir, cleanNew);
    if (!fs.existsSync(oldDir)) return false;
    try {
        if (!fs.existsSync(newDir)) fs.mkdirSync(newDir, { recursive: true });
        for (const f of fs.readdirSync(oldDir)) {
            try { fs.copyFileSync(path.join(oldDir, f), path.join(newDir, f)); } catch (_) {}
        }
        fs.rmSync(oldDir, { recursive: true, force: true });
        return true;
    } catch (_) { return false; }
}

module.exports = {
    saveApp,
    getApp,
    listApps,
    trashApp,
    restoreApp,
    deleteApp,
    // Drop-in aliases for all existing routes & cartridges
    saveCitizenDraft: saveApp,
    getCitizenDraft: getApp,
    listAllDrafts: listApps,
    trashCitizenDraft: trashApp,
    restoreCitizenDraft: restoreApp,
    deleteCitizenDraft: deleteApp,
    migrateCustomerUploads,
    buildMasterCloudPayload,
    isInternalTempDocKey
};
