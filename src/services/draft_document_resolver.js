const path = require('path');
const fs = require('fs');
const { getCitizenDraft, saveCitizenDraft, downloadDocFromStorage } = require('../../firestore_db');
const { produceDualSidedDocument, extractFacePassportFromDocument } = require('../../photo_studio');
const storageService = require('./storage_service');

const { resolveOrRestoreFile } = require('./draft_file_restorer');

async function resolveDraftDocument(cleanMob, docType, req, res) {
    const sessions = storageService.sessions;
    const getActiveMobile = storageService.getActiveMobile;
    const getOrCreateSession = storageService.getOrCreateSession;
    let draft = (cleanMob !== 'active_session') ? await getCitizenDraft(cleanMob) : null;
    const activeMob = typeof getActiveMobile === 'function' ? getActiveMobile() : null;
    if (!draft && activeMob && activeMob !== cleanMob) {
        try { draft = await getCitizenDraft(activeMob); } catch (e) {}
    }
    const sess = (cleanMob && cleanMob !== 'active_session' && sessions && sessions.has(cleanMob))
        ? sessions.get(cleanMob)
        : ((sessions && sessions.get(activeMob)) || (storageService.getSessionState && storageService.getSessionState()) || ((typeof getOrCreateSession === 'function') ? getOrCreateSession(cleanMob) : null));
    if (!draft && !sess) return res.status(404).send('Draft not found.');

    const b64Docs = (draft && draft.base64Docs) || (draft?.citizenProfile?.base64Docs) || (sess && sess.base64Docs) || {};

    const docs = {
        ...(draft?.citizenProfile?.documents || {}),
        ...(draft?.documents || {}),
        ...(sess?.tempUploads || {})
    };
    let docPath = docs[docType] || (draft?.citizenProfile && draft.citizenProfile[docType]) || (sess?.citizenProfile && sess.citizenProfile[docType]);
    if (docType === 'profilePhoto' && !docPath) docPath = draft?.citizenProfile?.headPhotoPath || sess?.citizenProfile?.headPhotoPath;
    if (docType === 'headAadhaar' && !docPath) docPath = draft?.citizenProfile?.headAadhaarDocPath || sess?.citizenProfile?.headAadhaarDocPath || sess?.tempUploads?.headAadhaarFront;
    if ((docType === 'smartCard' || docType === 'rationCard') && !docPath) docPath = draft?.citizenProfile?.smartCardDocPath || draft?.citizenProfile?.rationCardDocPath || sess?.citizenProfile?.smartCardDocPath || sess?.tempUploads?.smartCard;
    if (docType === 'gasBook' && !docPath) docPath = draft?.citizenProfile?.gasDetails?.gasBookPath || sess?.citizenProfile?.gasDetails?.gasBookPath || docs.residenceProof || draft?.citizenProfile?.residenceProof?.docPath || sess?.citizenProfile?.residenceProof?.docPath;
    if (docType === 'residenceProof' && !docPath) docPath = draft?.citizenProfile?.residenceProof?.docPath || sess?.citizenProfile?.residenceProof?.docPath || docs.gasBook || draft?.citizenProfile?.gasDetails?.gasBookPath || sess?.citizenProfile?.gasDetails?.gasBookPath;
    if (docType === 'communityProof' && !docPath) docPath = docs.communityProof || draft?.citizenProfile?.communityCertificatePath || draft?.citizenProfile?.familyCommunityProofPath || draft?.citizenProfile?.communityProof || sess?.citizenProfile?.communityCertificatePath || sess?.tempUploads?.communityProof;

    if ((docType === 'gasBook' || docType === 'residenceProof') && (!docPath || !fs.existsSync(docPath))) {
        const appDataDir = path.join(process.env.APPDATA || 'C:\\Users\\ADMIN\\AppData\\Roaming', 'esevadraft-desktop', 'data', 'uploads', cleanMob);
        const localDataDir = path.join(__dirname, '..', '..', 'data', 'uploads', cleanMob);
        for (const d of [appDataDir, localDataDir]) {
            if (fs.existsSync(d)) {
                for (const gn of ['gas.jpg', 'gas.jpeg', 'gas.png', 'gas.pdf', 'gasBook.jpg', 'gasBook.jpeg', 'gasBook.pdf', 'residenceProof.jpg', 'residenceProof.pdf']) {
                    const gp = path.join(d, gn);
                    if (fs.existsSync(gp) && fs.statSync(gp).size > 100) {
                        docPath = gp;
                        break;
                    }
                }
            }
            if (docPath && fs.existsSync(docPath)) break;
        }
    }

    if (docType.toLowerCase().includes('member')) {
        const idxMatch = docType.match(/\d+/);
        const idx = idxMatch ? parseInt(idxMatch[0], 10) : 0;
        const mem = draft?.citizenProfile?.members?.[idx + 1] || draft?.citizenProfile?.members?.[idx] || sess?.citizenProfile?.members?.[idx + 1];
        if (mem && mem.docPath) docPath = mem.docPath;
        if (!docPath && docs.memberAadhaars && docs.memberAadhaars[idx]) {
            docPath = docs.memberAadhaars[idx];
        }
        if (!docPath && docs[`memberAadhaar_${idx}`]) {
            docPath = docs[`memberAadhaar_${idx}`];
        }
        if (!docPath && docs.memberAadhaars && docs.memberAadhaars.length > 0) {
            docPath = docs.memberAadhaars[0];
        }
        if (!docPath) {
            docPath = docs.memberAadhaar || sess?.subServiceData?.docPath || draft?.citizenProfile?.subServiceData?.docPath || sess?.citizenProfile?.subServiceData?.docPath;
        }
        const headCand = docs.headAadhaar || draft?.storageUrls?.headAadhaar;
        const isHeadPdf = typeof headCand === 'string' && (headCand.toLowerCase().endsWith('.pdf') || headCand.toLowerCase().includes('merged'));
        const isDocPathPdf = typeof docPath === 'string' && docPath.toLowerCase().endsWith('.pdf');
        if (!isDocPathPdf && isHeadPdf) {
            docPath = headCand;
        }
    }

    if (docType === 'birthCertificate' && !docPath) {
        docPath = docs.birthCertificate || sess?.subServiceData?.docPath || draft?.citizenProfile?.subServiceData?.docPath || sess?.citizenProfile?.subServiceData?.docPath;
    }

    if (typeof docPath === 'object' && docPath !== null) {
        docPath = docPath.path || docPath.url || docPath.docPath || null;
    }

    const isAadhaarReq = docType === 'headAadhaar' || docType.toLowerCase().includes('member');
    {
        const isHead = docType === 'headAadhaar';
        const sUrls = draft?.storageUrls || {};
        let fCand = isAadhaarReq
            ? (isHead
                ? (docs.headAadhaarFront || draft?.citizenProfile?.documents?.headAadhaarFront || draft?.documents?.headAadhaarFront || sess?.tempUploads?.headAadhaarFront || docs.headAadhaar)
                : (docs.memberAadhaarFront || draft?.citizenProfile?.documents?.memberAadhaarFront || draft?.documents?.memberAadhaarFront || docs[`memberAadhaarFront_0`] || sess?.tempUploads?.memberAadhaarFront || docs.memberAadhaar || docs.headAadhaarFront || docs.headAadhaar))
            : (docs[`${docType}Front`] || draft?.citizenProfile?.documents?.[`${docType}Front`] || draft?.documents?.[`${docType}Front`] || sess?.tempUploads?.[`${docType}Front`] || docs[docType]);
        let bCand = isAadhaarReq
            ? (isHead
                ? (docs.headAadhaarBack || draft?.citizenProfile?.documents?.headAadhaarBack || draft?.documents?.headAadhaarBack || sess?.tempUploads?.headAadhaarBack)
                : (docs.memberAadhaarBack || draft?.citizenProfile?.documents?.memberAadhaarBack || draft?.documents?.memberAadhaarBack || docs[`memberAadhaarBack_0`] || sess?.tempUploads?.memberAadhaarBack || docs.headAadhaarBack))
            : (docs[`${docType}Back`] || draft?.citizenProfile?.documents?.[`${docType}Back`] || draft?.documents?.[`${docType}Back`] || sess?.tempUploads?.[`${docType}Back`]);
        if (typeof fCand === 'object' && fCand !== null) fCand = fCand.path || fCand.url || fCand.docPath || null;
        if (typeof bCand === 'object' && bCand !== null) bCand = bCand.path || bCand.url || bCand.docPath || null;
        const fB64 = isAadhaarReq
            ? (isHead ? (b64Docs.headAadhaarFrontBase64 || b64Docs.headAadhaarBase64) : (b64Docs.memberAadhaarFrontBase64 || b64Docs.memberAadhaarBase64 || b64Docs.headAadhaarFrontBase64 || b64Docs.headAadhaarBase64))
            : (b64Docs[`${docType}FrontBase64`] || b64Docs[`${docType}Base64`]);
        const bB64 = isAadhaarReq
            ? (isHead ? b64Docs.headAadhaarBackBase64 : (b64Docs.memberAadhaarBackBase64 || b64Docs.headAadhaarBackBase64))
            : b64Docs[`${docType}BackBase64`];
        const fStorage = isAadhaarReq
            ? (isHead ? (sUrls.headAadhaarFront || sUrls.headAadhaar) : (sUrls.memberAadhaarFront || sUrls.memberAadhaar || sUrls.headAadhaarFront || sUrls.headAadhaar))
            : (sUrls[`${docType}Front`] || sUrls[docType]);
        const bStorage = isAadhaarReq
            ? (isHead ? sUrls.headAadhaarBack : (sUrls.memberAadhaarBack || sUrls.headAadhaarBack))
            : sUrls[`${docType}Back`];

        const hasFront = !!(fCand || fB64 || fStorage);
        const hasBack = !!(bCand || bB64 || bStorage);
        const isAlreadyMerged = typeof docPath === 'string' && docPath.toLowerCase().endsWith('.pdf') && (docPath.toLowerCase().includes('merged') || docPath.toLowerCase().includes('dual') || docPath.toLowerCase().includes('2in1'));

        if (hasFront && hasBack && !isAlreadyMerged) {
            const resolvedFront = await resolveOrRestoreFile(fCand, fB64, `${cleanMob}_front`, fStorage);
            const resolvedBack = await resolveOrRestoreFile(bCand, bB64, `${cleanMob}_back`, bStorage);
            if (resolvedFront && resolvedBack && resolvedFront !== resolvedBack) {
                console.log(`✨ [Dual-Side Merger] Dynamically cropping & merging Front + Back into 2-in-1 Government PDF for ${cleanMob} (${docType})...`);
                const mergedPdf = await produceDualSidedDocument(resolvedFront, resolvedBack);
                if (mergedPdf && fs.existsSync(mergedPdf)) {
                    docPath = mergedPdf;
                    const mB64 = fs.readFileSync(mergedPdf).toString('base64');
                    const mName = path.basename(mergedPdf);
                    b64Docs[`${docType}Base64`] = mB64;
                    b64Docs[`${docType}Name`] = mName;
                    if (docType.toLowerCase().includes('member')) {
                        b64Docs.memberAadhaarsBase64 = [{ name: mName, base64: mB64 }];
                    }
                    if (draft) {
                        draft.documents = draft.documents || {};
                        draft.documents[docType] = mergedPdf;
                        if (draft.citizenProfile) {
                            draft.citizenProfile.documents = draft.citizenProfile.documents || {};
                            draft.citizenProfile.documents[docType] = mergedPdf;
                        }
                        draft.base64Docs = draft.base64Docs || {};
                        draft.base64Docs[`${docType}Base64`] = mB64;
                        draft.base64Docs[`${docType}Name`] = mName;
                        if (docType.toLowerCase().includes('member')) {
                            draft.base64Docs.memberAadhaarsBase64 = [{ name: mName, base64: mB64 }];
                        }
                        try { await saveCitizenDraft(cleanMob, draft); } catch (e) {}
                    }
                }
            }
        }
    }

    const isAddMemberDraft = (draft?.subService === 'ADD_MEMBER') || (draft?.citizenProfile?.subService === 'ADD_MEMBER');
    if (!isAddMemberDraft && docType === 'profilePhoto' && (!docPath || !fs.existsSync(docPath)) && !b64Docs.profilePhotoBase64) {
        const fCand = docs.headAadhaarFront || docs.headAadhaar;
        const fB64 = b64Docs.headAadhaarFrontBase64 || b64Docs.headAadhaarBase64;
        const candidateFront = await resolveOrRestoreFile(fCand, fB64, `${cleanMob}_face_source`);
        if (candidateFront && fs.existsSync(candidateFront) && !candidateFront.toLowerCase().endsWith('.pdf')) {
            const extractedFace = await extractFacePassportFromDocument(candidateFront);
            if (extractedFace && fs.existsSync(extractedFace)) {
                docPath = extractedFace;
                const faceB64 = fs.readFileSync(extractedFace).toString('base64');
                b64Docs.profilePhotoBase64 = faceB64;
                if (draft) {
                    draft.citizenProfile = draft.citizenProfile || {};
                    draft.citizenProfile.headPhotoPath = extractedFace;
                    draft.documents = draft.documents || {};
                    draft.documents.profilePhoto = extractedFace;
                    draft.base64Docs = draft.base64Docs || {};
                    draft.base64Docs.profilePhotoBase64 = faceB64;
                    try { await saveCitizenDraft(cleanMob, draft); } catch (e) {}
                }
            }
        }
    }

    let resolvedExistingPath = null;
    if (docPath) {
        if (fs.existsSync(docPath)) {
            resolvedExistingPath = path.resolve(docPath);
        } else if (typeof docPath === 'string' && docPath.startsWith('gs://') && typeof downloadDocFromStorage === 'function') {
            try {
                const fName = docPath.split('/').pop() || `${docType}.pdf`;
                const target = path.join(__dirname, '..', '..', 'uploads', fName);
                const dl = await downloadDocFromStorage(docPath, target);
                if (dl && fs.existsSync(dl)) resolvedExistingPath = dl;
            } catch (e) {}
        } else {
            const baseName = path.basename(docPath);
            const localUploadPath = path.join(__dirname, '..', '..', 'uploads', baseName);
            if (fs.existsSync(localUploadPath)) {
                resolvedExistingPath = path.resolve(localUploadPath);
            } else {
                const localCompressedPath = path.join(__dirname, '..', '..', 'compressed', baseName);
                if (fs.existsSync(localCompressedPath)) {
                    resolvedExistingPath = path.resolve(localCompressedPath);
                }
            }
        }
    }

    let sUrl = draft?.storageUrls?.[docType];
    if (docType.toLowerCase().includes('member') && (!sUrl || !sUrl.toLowerCase().endsWith('.pdf'))) {
        if (draft?.storageUrls?.headAadhaar && draft.storageUrls.headAadhaar.toLowerCase().endsWith('.pdf')) {
            sUrl = draft.storageUrls.headAadhaar;
        }
    }
    if (!resolvedExistingPath && sUrl && typeof downloadDocFromStorage === 'function') {
        try {
            const fName = sUrl.split('/').pop() || `${docType}.jpeg`;
            const target = path.join(__dirname, '..', '..', 'uploads', fName);
            const dl = await downloadDocFromStorage(sUrl, target);
            if (dl && fs.existsSync(dl)) resolvedExistingPath = dl;
        } catch (e) {}
    }

    if (resolvedExistingPath) {
        if (req.query.download === '1') {
            const isPdf = resolvedExistingPath.toLowerCase().endsWith('.pdf');
            const dlName = isPdf ? `${cleanMob}_${docType}_merged_2in1.pdf` : path.basename(resolvedExistingPath);
            return res.download(resolvedExistingPath, dlName);
        }
        return res.sendFile(resolvedExistingPath);
    }

    const b64Key = `${docType}Base64`;
    if (b64Docs && b64Docs[b64Key]) {
        const rawB64 = b64Docs[b64Key];
        const clean = typeof rawB64 === 'string' && rawB64.includes('base64,') ? rawB64.split('base64,')[1] : rawB64;
        const buf = Buffer.from(clean, 'base64');
        const isPdf = buf.length > 4 && buf.slice(0, 4).toString() === '%PDF';
        const ext = isPdf ? 'pdf' : 'jpg';
        const mime = isPdf ? 'application/pdf' : 'image/jpeg';
        res.setHeader('Content-Type', mime);
        if (req.query.download === '1') {
            res.setHeader('Content-Disposition', `attachment; filename="${cleanMob}_${docType}.${ext}"`);
        }
        return res.send(buf);
    }

    if (docType.toLowerCase().includes('member') && b64Docs && Array.isArray(b64Docs.memberAadhaarsBase64)) {
        const idxMatch = docType.match(/\d+/);
        const queryIdx = req.query.index !== undefined ? parseInt(req.query.index, 10) : null;
        const idx = queryIdx !== null ? queryIdx : (idxMatch ? parseInt(idxMatch[0], 10) : 0);
        const item = b64Docs.memberAadhaarsBase64[idx];
        if (item) {
            const rawB64 = typeof item === 'object' ? (item.base64 || item.data) : item;
            if (rawB64) {
                const clean = rawB64.includes('base64,') ? rawB64.split('base64,')[1] : rawB64;
                const buf = Buffer.from(clean, 'base64');
                const isPdf = buf.length > 4 && buf.slice(0, 4).toString() === '%PDF';
                const ext = isPdf ? 'pdf' : 'jpg';
                const mime = isPdf ? 'application/pdf' : 'image/jpeg';
                res.setHeader('Content-Type', mime);
                if (req.query.download === '1') {
                    res.setHeader('Content-Disposition', `attachment; filename="${cleanMob}_member_${idx}.${ext}"`);
                }
                return res.send(buf);
            }
        }
    }

    const storageUrls = (draft && draft.storageUrls) || {};
    let gsUrl = storageUrls[docType];
    if (!gsUrl && docType.toLowerCase().includes('member') && Array.isArray(storageUrls.memberAadhaars)) {
        const idxMatch = docType.match(/\d+/);
        const queryIdx = req.query.index !== undefined ? parseInt(req.query.index, 10) : null;
        const idx = queryIdx !== null ? queryIdx : (idxMatch ? parseInt(idxMatch[0], 10) : 0);
        gsUrl = storageUrls.memberAadhaars[idx];
    }
    if (gsUrl && gsUrl.startsWith('gs://') && downloadDocFromStorage) {
        const targetPath = path.join(__dirname, '..', '..', 'uploads', `${cleanMob}_${docType}_download.jpg`);
        const downloaded = await downloadDocFromStorage(gsUrl, targetPath);
        if (downloaded && fs.existsSync(downloaded)) {
            if (req.query.download === '1') return res.download(path.resolve(downloaded), path.basename(downloaded));
            return res.sendFile(path.resolve(downloaded));
        }
    }

    return res.status(404).send(`Document ${docType} not found.`);
}

async function removeDraftDocument(cleanMob, docType, memberIndex = 0) {
    if (!cleanMob || !docType) return false;
    let draft = null;
    try { draft = await getCitizenDraft(cleanMob); } catch (e) {}
    const sess = storageService.getOrCreateSession ? storageService.getOrCreateSession(cleanMob) : (storageService.sessions?.get(cleanMob) || null);

    const isPhoto = docType === 'headPhoto' || docType === 'profilePhoto';
    const isHeadAadhaar = docType === 'headAadhaar' || (docType === 'memberAadhaar' && (!memberIndex || memberIndex === 0));
    const isResidence = docType === 'residenceProof' || docType === 'gasBook' || docType === 'newAddressProof';
    const isSmartCard = docType === 'smartCard' || docType === 'rationCard';

    function purgeBase64Keys(target) {
        if (!target || typeof target !== 'object') return;
        delete target[docType];
        if (isPhoto) {
            delete target.profilePhotoBase64;
            delete target.profilePhotoName;
            delete target.headPhotoBase64;
            delete target.headPhotoName;
            delete target.profilePhoto;
            delete target.headPhoto;
        }
        if (isHeadAadhaar || docType === 'memberAadhaar') {
            delete target.headAadhaarBase64;
            delete target.headAadhaarName;
            delete target.headAadhaarFrontBase64;
            delete target.headAadhaarFrontName;
            delete target.headAadhaarBackBase64;
            delete target.headAadhaarBackName;
            delete target.mergedAadhaarBase64;
            delete target.mergedAadhaarName;
            delete target.headAadhaar;
            delete target.headAadhaarFront;
            delete target.headAadhaarBack;
            delete target.memberAadhaarBase64;
            delete target.memberAadhaarName;
            delete target.memberAadhaarsBase64;
            delete target.memberAadhaarFrontBase64;
            delete target.memberAadhaarFrontName;
            delete target.memberAadhaarBackBase64;
            delete target.memberAadhaarBackName;
            delete target.memberAadhaar;
        }
        if (isResidence) {
            delete target.residenceProofBase64;
            delete target.residenceProofName;
            delete target.gasBookBase64;
            delete target.gasBookName;
            delete target.residenceProof;
            delete target.gasBook;
            delete target.newAddressProofBase64;
            delete target.newAddressProofName;
            delete target.newAddressProof;
        }
        if (isSmartCard) {
            delete target.smartCardBase64;
            delete target.smartCardName;
            delete target.rationCardBase64;
            delete target.rationCardName;
            delete target.smartCard;
            delete target.rationCard;
        }
        if (docType === 'birthCertificate') {
            delete target.birthCertificateBase64;
            delete target.birthCertificateName;
            delete target.birthCertificate;
        } else if (docType === 'surrenderProof') {
            delete target.surrenderProofBase64;
            delete target.surrenderProofName;
            delete target.surrenderProof;
        } else if (docType === 'removeProof') {
            delete target.removeProofBase64;
            delete target.removeProofName;
            delete target.removeProof;
        }
    }

    function purgeDocMapKeys(docMap) {
        if (!docMap || typeof docMap !== 'object') return;
        delete docMap[docType];
        if (isPhoto) {
            delete docMap.profilePhoto;
            delete docMap.headPhoto;
        }
        if (isHeadAadhaar) {
            delete docMap.headAadhaar;
            delete docMap.headAadhaarFront;
            delete docMap.headAadhaarBack;
            delete docMap.mergedAadhaar;
            delete docMap.memberAadhaar;
            delete docMap.memberAadhaarFront;
            delete docMap.memberAadhaarBack;
            delete docMap.memberAadhaars;
            delete docMap.memberAadhaar_0;
        } else if (docType === 'memberAadhaar') {
            delete docMap.memberAadhaar;
            delete docMap.memberAadhaarFront;
            delete docMap.memberAadhaarBack;
            delete docMap.memberAadhaars;
            delete docMap[`memberAadhaar_${memberIndex}`];
        }
        if (isResidence) {
            delete docMap.residenceProof;
            delete docMap.gasBook;
            delete docMap.newAddressProof;
        }
        if (isSmartCard) {
            delete docMap.smartCard;
            delete docMap.rationCard;
            delete docMap.smartCardFront;
            delete docMap.smartCardBack;
        }
        if (docType === 'memberProof') delete docMap.relationshipProof;
        if (docType === 'removeProof') delete docMap.deathCertificate;
    }

    function purgeProfileObject(prof) {
        if (!prof || typeof prof !== 'object') return;
        if (prof.base64Docs) purgeBase64Keys(prof.base64Docs);
        if (prof.documents) purgeDocMapKeys(prof.documents);
        if (prof.tempUploads) purgeDocMapKeys(prof.tempUploads);

        if (isPhoto) {
            delete prof.headPhotoPath;
        }
        if (isHeadAadhaar) {
            delete prof.headAadhaarDocPath;
            delete prof.headAadhaarPdfPath;
            if (Array.isArray(prof.members) && prof.members[0]) {
                delete prof.members[0].docPath;
                delete prof.members[0].aadhaarDocPath;
            }
            if (prof.subServiceData) {
                delete prof.subServiceData.docPath;
                delete prof.subServiceData.aadhaarDocPath;
                delete prof.subServiceData.memberDocPath;
            }
            if (prof.tempMember) {
                delete prof.tempMember.docPath;
            }
        } else if (docType === 'memberAadhaar') {
            if (memberIndex > 0 && Array.isArray(prof.members) && prof.members[memberIndex]) {
                delete prof.members[memberIndex].docPath;
                delete prof.members[memberIndex].aadhaarDocPath;
            }
            if (prof.subServiceData) {
                delete prof.subServiceData.docPath;
                delete prof.subServiceData.aadhaarDocPath;
                delete prof.subServiceData.memberDocPath;
            }
            if (prof.tempMember) {
                delete prof.tempMember.docPath;
            }
        }
        if (isResidence) {
            if (prof.gasDetails) {
                delete prof.gasDetails.gasBookPath;
                prof.gasDetails.hasGas = false;
            }
            delete prof.residenceProof;
            if (prof.subServiceData) {
                delete prof.subServiceData.addressProofDocPath;
                if (prof.subService === 'CHANGE_ADDRESS') {
                    delete prof.subServiceData.docPath;
                }
            }
        }
        if (isSmartCard) {
            delete prof.smartCardDocPath;
            delete prof.rationCardDocPath;
        }
        if (docType === 'memberProof' && prof.subServiceData) {
            delete prof.subServiceData.proofDocPath;
        }
        if (docType === 'removeProof' && prof.subServiceData) {
            delete prof.subServiceData.deathCertDocPath;
        }
    }

    const unlinkSafe = (f) => {
        try {
            if (!f || typeof f !== 'string') return;
            const bName = path.basename(f);
            if (bName.startsWith('test_')) return; // Preserve shared unit test fixtures
            if (fs.existsSync(f)) {
                fs.unlinkSync(f);
            }
        } catch (_) {}
    };

    // 1. Physical File Clean-up
    if (isPhoto) {
        unlinkSafe(draft?.documents?.profilePhoto);
        unlinkSafe(draft?.citizenProfile?.headPhotoPath);
    } else if (isHeadAadhaar) {
        unlinkSafe(draft?.documents?.headAadhaar);
        unlinkSafe(draft?.documents?.headAadhaarFront);
        unlinkSafe(draft?.documents?.headAadhaarBack);
        unlinkSafe(draft?.documents?.memberAadhaar);
        unlinkSafe(draft?.citizenProfile?.headAadhaarDocPath);
        if (draft?.citizenProfile?.members?.[0]?.docPath) unlinkSafe(draft.citizenProfile.members[0].docPath);
    } else if (isResidence) {
        unlinkSafe(draft?.documents?.residenceProof);
        unlinkSafe(draft?.documents?.gasBook);
        unlinkSafe(draft?.citizenProfile?.residenceProof?.docPath);
        unlinkSafe(draft?.citizenProfile?.gasDetails?.gasBookPath);
    }

    // 2. Session Clean-up
    if (sess) {
        if (sess.tempUploads) purgeDocMapKeys(sess.tempUploads);
        if (sess.documents) purgeDocMapKeys(sess.documents);
        if (sess.base64Docs) purgeBase64Keys(sess.base64Docs);
        if (sess.citizenProfile) purgeProfileObject(sess.citizenProfile);
        if (sess.subServiceData) {
            if (isHeadAadhaar || docType === 'memberAadhaar') {
                delete sess.subServiceData.docPath;
                delete sess.subServiceData.aadhaarDocPath;
                delete sess.subServiceData.memberDocPath;
            }
            if (isResidence) {
                delete sess.subServiceData.addressProofDocPath;
                if (sess.subService === 'CHANGE_ADDRESS') delete sess.subServiceData.docPath;
            }
        }
        if ((isPhoto || isHeadAadhaar || isResidence) && sess.intakeState === 'READY_TO_APPLY') {
            sess.intakeState = 'SERVICE_SELECTION';
            sess.step = 'SERVICE_SELECTION';
        }
    }

    // 3. Draft Object Clean-up & Persistent Disk Write
    if (draft) {
        if (draft.documents) purgeDocMapKeys(draft.documents);
        if (draft.base64Docs) purgeBase64Keys(draft.base64Docs);
        if (draft.citizenProfile) purgeProfileObject(draft.citizenProfile);
        if (draft.subServiceData) {
            if (isHeadAadhaar || docType === 'memberAadhaar') {
                delete draft.subServiceData.docPath;
                delete draft.subServiceData.aadhaarDocPath;
                delete draft.subServiceData.memberDocPath;
            }
            if (isResidence) {
                delete draft.subServiceData.addressProofDocPath;
                if (draft.subService === 'CHANGE_ADDRESS') delete draft.subServiceData.docPath;
            }
        }
        if ((isPhoto || isHeadAadhaar || isResidence) && draft.intakeState === 'READY_TO_APPLY') {
            draft.intakeState = 'SERVICE_SELECTION';
            draft.step = 'SERVICE_SELECTION';
        }
        draft.lastUpdated = new Date().toISOString();

        const draftsDirs = Array.from(new Set([
            path.resolve(__dirname, '..', '..', 'data', 'drafts'),
            path.join('d:', 'downloads', 'ai assitant 2', 'data', 'drafts'),
            path.join(process.env.APPDATA || 'C:\\Users\\ADMIN\\AppData\\Roaming', 'esevadraft-desktop', 'data', 'drafts'),
            path.join(process.env.LOCALAPPDATA || 'C:\\Users\\ADMIN\\AppData\\Local', 'Programs', 'eSevaDraft Desktop', 'resources', 'data', 'drafts')
        ]));
        for (const dDir of draftsDirs) {
            const targetFile = path.join(dDir, `${cleanMob}.json`);
            if (fs.existsSync(targetFile)) {
                try {
                    fs.writeFileSync(targetFile, JSON.stringify(draft, null, 2), 'utf8');
                } catch (_) {}
            }
        }
    }

    // 4. Master Citizen & Database Clean-up across all data directories (prevents resurrection on /api/operator/new-customer)
    const dataDirs = Array.from(new Set([
        path.resolve(__dirname, '..', '..', 'data'),
        path.join('d:', 'downloads', 'ai assitant 2', 'data'),
        path.join(process.env.APPDATA || 'C:\\Users\\ADMIN\\AppData\\Roaming', 'esevadraft-desktop', 'data'),
        path.join(process.env.LOCALAPPDATA || 'C:\\Users\\ADMIN\\AppData\\Local', 'Programs', 'eSevaDraft Desktop', 'resources', 'data')
    ]));

    for (const dataDir of dataDirs) {
        try {
            const masterFile = path.join(dataDir, 'citizens', `${cleanMob}.json`);
            if (fs.existsSync(masterFile)) {
                const masterObj = JSON.parse(fs.readFileSync(masterFile, 'utf8'));
                if (isPhoto) {
                    unlinkSafe(masterObj?.documents?.profilePhoto);
                    unlinkSafe(masterObj?.headPhotoPath);
                } else if (isHeadAadhaar) {
                    unlinkSafe(masterObj?.documents?.headAadhaar);
                    unlinkSafe(masterObj?.headAadhaarDocPath);
                } else if (isResidence) {
                    unlinkSafe(masterObj?.documents?.residenceProof);
                    unlinkSafe(masterObj?.documents?.gasBook);
                    unlinkSafe(masterObj?.residenceProof?.docPath);
                    unlinkSafe(masterObj?.gasDetails?.gasBookPath);
                }
                purgeProfileObject(masterObj);
                fs.writeFileSync(masterFile, JSON.stringify(masterObj, null, 2), 'utf8');
            }
        } catch (_) {}

        try {
            const dbFile = path.join(dataDir, 'citizens.json');
            if (fs.existsSync(dbFile)) {
                const dbObj = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
                if (dbObj && dbObj[cleanMob]) {
                    purgeProfileObject(dbObj[cleanMob]);
                    fs.writeFileSync(dbFile, JSON.stringify(dbObj, null, 2), 'utf8');
                }
            }
        } catch (_) {}
    }

    if (storageService.persistSessions) storageService.persistSessions();
    return true;
}

const { extractDraftDocumentsList, fileOrDataExists } = require('./draft_document_list');

module.exports = {
    resolveOrRestoreFile,
    resolveDraftDocument,
    extractDraftDocumentsList,
    fileOrDataExists,
    removeDraftDocument
};

