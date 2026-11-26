// =========================================================================
// Draft Document Handler & Auto-Merger Bridge
// =========================================================================
const fs = require('fs');
const path = require('path');
const { getActiveUploadsDir, uploadDocToStorage, fileToBase64, isStorageAvailable } = require('./firestore_client');

async function processDraftDocuments(cleanMob, prof, docPackage, draftData, options = {}) {
    const storageUrls = {};
    const base64Docs = Object.assign({}, draftData.base64Docs || {});
    const shouldUploadToCloud = options.uploadToCloud !== false;

    async function handleDoc(localPath, docType) {
        let effectivePath = localPath;
        if ((!effectivePath || !fs.existsSync(effectivePath)) && base64Docs[`${docType}Base64`]) {
            try {
                const b64Data = base64Docs[`${docType}Base64`];
                const raw = b64Data.includes('base64,') ? b64Data.split('base64,')[1] : b64Data;
                const fName = base64Docs[`${docType}Name`] || `${docType}.jpg`;
                const baseUploadDir = getActiveUploadsDir();
                const tempP = path.join(baseUploadDir, `${cleanMob}_${docType}_${fName}`);
                const tempPDir = path.dirname(tempP);
                if (!fs.existsSync(tempPDir)) fs.mkdirSync(tempPDir, { recursive: true });
                fs.writeFileSync(tempP, Buffer.from(raw, 'base64'));
                effectivePath = tempP;
            } catch (_) {}
        }
        if (!effectivePath || !fs.existsSync(effectivePath)) return;
        const fileName = path.basename(effectivePath);
        const storagePath = `drafts/${cleanMob}/${docType}/${fileName}`;
        // Complete PC + Cloud Sync: upload every customer document (Master + Service Proofs + Receipts) to Cloud Storage!
        // Deleted cleanly from both PC & Cloud when operator deletes the draft.
        if (shouldUploadToCloud && isStorageAvailable()) {
            const url = await uploadDocToStorage(effectivePath, storagePath);
            if (url) { storageUrls[docType] = url; }
        }
        const b64 = fileToBase64(effectivePath);
        if (b64) {
            base64Docs[`${docType}Base64`] = b64;
            base64Docs[`${docType}Name`] = fileName;
        }
    }

    const isAddMemService = prof.subService === 'ADD_MEMBER' ||
        draftData.subService === 'ADD_MEMBER' ||
        Boolean(prof.subServiceData?.memberName) ||
        (prof.intakeState && String(prof.intakeState).startsWith('RATION_ADD_MEMBER')) ||
        (draftData.intakeState && String(draftData.intakeState).startsWith('RATION_ADD_MEMBER'));

    if (prof.headPhotoPath) docPackage.profilePhoto = prof.headPhotoPath;
    if (prof.headAadhaarDocPath || (!isAddMemService && prof.members?.[0]?.docPath)) {
        docPackage.headAadhaar = prof.headAadhaarDocPath || prof.members?.[0]?.docPath;
    }
    if (prof.residenceProof?.docPath) {
        docPackage.residenceProof = prof.residenceProof.docPath;
    }
    if (prof.gasDetails?.gasBookPath) {
        docPackage.gasBook = prof.gasDetails.gasBookPath;
    }
    if (docPackage.gasBook && !docPackage.residenceProof) {
        docPackage.residenceProof = docPackage.gasBook;
    }
    if (docPackage.residenceProof && !docPackage.gasBook && (prof.gasDetails?.hasGas || prof.residenceProof?.type === 'GAS_BOOK')) {
        docPackage.gasBook = docPackage.residenceProof;
    }
    if (docPackage.gasBook) {
        prof.gasDetails = prof.gasDetails || {};
        prof.gasDetails.gasBookPath = docPackage.gasBook;
        prof.gasDetails.hasGas = true;
    }
    if (docPackage.residenceProof) {
        prof.residenceProof = prof.residenceProof || {};
        prof.residenceProof.docPath = docPackage.residenceProof;
        prof.residenceProof.type = prof.residenceProof.type || 'GAS_BOOK';
        prof.residenceProof.typeTam = prof.residenceProof.typeTam || 'எரிவாயு நுகர்வோர் அட்டை';
    }
    if (base64Docs.gasBookBase64 && !base64Docs.residenceProofBase64) {
        base64Docs.residenceProofBase64 = base64Docs.gasBookBase64;
        base64Docs.residenceProofName = base64Docs.gasBookName || 'gasBook.jpg';
    }
    if (base64Docs.residenceProofBase64 && !base64Docs.gasBookBase64 && (prof.gasDetails?.hasGas || prof.residenceProof?.type === 'GAS_BOOK')) {
        base64Docs.gasBookBase64 = base64Docs.residenceProofBase64;
        base64Docs.gasBookName = base64Docs.residenceProofName || 'residenceProof.jpg';
    }

    const headAadhaarFrontCand = draftData.documents?.headAadhaarFront || prof.documents?.headAadhaarFront || draftData.tempUploads?.headAadhaarFront || prof.headAadhaarDocPath || null;
    const headAadhaarBackCand = draftData.documents?.headAadhaarBack || prof.documents?.headAadhaarBack || draftData.tempUploads?.headAadhaarBack || null;
    const memberAadhaarFrontCand = draftData.documents?.memberAadhaarFront || prof.documents?.memberAadhaarFront || draftData.tempUploads?.memberAadhaarFront || null;
    const memberAadhaarBackCand = draftData.documents?.memberAadhaarBack || prof.documents?.memberAadhaarBack || draftData.tempUploads?.memberAadhaarBack || null;
    if (headAadhaarFrontCand) docPackage.headAadhaarFront = headAadhaarFrontCand; else delete docPackage.headAadhaarFront;
    if (headAadhaarBackCand) docPackage.headAadhaarBack = headAadhaarBackCand; else delete docPackage.headAadhaarBack;
    if (memberAadhaarFrontCand) docPackage.memberAadhaarFront = memberAadhaarFrontCand; else delete docPackage.memberAadhaarFront;
    if (memberAadhaarBackCand) docPackage.memberAadhaarBack = memberAadhaarBackCand; else delete docPackage.memberAadhaarBack;

    const hasExistingHeadMaster = Boolean(
        prof.headPhotoPath ||
        prof.headAadhaarDocPath ||
        (prof.headAadhaar && String(prof.headAadhaar).replace(/\D/g, '').length === 12)
    );

    if (isAddMemService) {
        // NEVER copy an existing customer's Master headAadhaar into transient memberAadhaar!
        if (!hasExistingHeadMaster) {
            if (!docPackage.memberAadhaarFront && docPackage.headAadhaarFront) docPackage.memberAadhaarFront = docPackage.headAadhaarFront;
            if (!docPackage.memberAadhaarBack && docPackage.headAadhaarBack) docPackage.memberAadhaarBack = docPackage.headAadhaarBack;
            if (!docPackage.memberAadhaar && docPackage.headAadhaar) docPackage.memberAadhaar = docPackage.headAadhaar;
            if (docPackage.headAadhaar && typeof docPackage.headAadhaar === 'string' && (docPackage.headAadhaar.toLowerCase().endsWith('.pdf') || docPackage.headAadhaar.toLowerCase().includes('merged'))) {
                docPackage.memberAadhaar = docPackage.headAadhaar;
            }
        }
        const memDocCand = prof.subServiceData?.docPath || prof.subServiceData?.aadhaarDocPath || docPackage.memberAadhaar || null;
        if (memDocCand) {
            docPackage.memberAadhaar = memDocCand;
        }
        if (!prof.headPhotoPath && !prof.headAadhaarDocPath) {
            delete docPackage.headAadhaar;
            delete docPackage.headAadhaarFront;
            delete docPackage.headAadhaarBack;
            delete docPackage.profilePhoto;
            if (prof.documents) {
                delete prof.documents.headAadhaar;
                delete prof.documents.headAadhaarFront;
                delete prof.documents.headAadhaarBack;
                delete prof.documents.profilePhoto;
            }
        }
    }
    if (isAddMemService && prof.subServiceData?.docPath && !docPackage.memberAadhaar) {
        docPackage.memberAadhaar = prof.subServiceData.docPath;
    }
    if (prof.subServiceData?.addressProofDocPath) docPackage.newAddressProof = prof.subServiceData.addressProofDocPath;

    try {
        const hasMasterProfileDocs = Boolean(prof.headPhotoPath || prof.headAadhaarDocPath);
        if (!hasMasterProfileDocs) {
            const { validateServiceContract } = require('../plugins');
            const targetService = prof.subService || draftData.subService || (isAddMemService ? 'ADD_MEMBER' : 'NEW_RATION_CARD');
            const validation = validateServiceContract(targetService, prof, docPackage);
            if (validation && validation.sanitizedDocuments) {
                Object.assign(docPackage, validation.sanitizedDocuments);
                Object.assign(prof, validation.sanitizedProfile);
            }
        }
    } catch (_) {}

    try {
        const { produceDualSidedDocument, extractFacePassportFromDocument } = require('../../../photo_studio');
        const headFront = docPackage.headAadhaarFront || prof.documents?.headAadhaarFront;
        const headBack = docPackage.headAadhaarBack || prof.documents?.headAadhaarBack;
        if (headFront && headBack && (!docPackage.headAadhaar || !docPackage.headAadhaar.toLowerCase().includes('merged'))) {
            const merged = await produceDualSidedDocument(headFront, headBack);
            if (merged) {
                docPackage.headAadhaar = merged;
            }
        }
        const memFront = docPackage.memberAadhaarFront || prof.documents?.memberAadhaarFront;
        const memBack = docPackage.memberAadhaarBack || prof.documents?.memberAadhaarBack;
        if (memFront && memBack && (!docPackage.memberAadhaar || !docPackage.memberAadhaar.toLowerCase().includes('merged'))) {
            const merged = await produceDualSidedDocument(memFront, memBack);
            if (merged) {
                docPackage.memberAadhaar = merged;
                if (prof.subServiceData) prof.subServiceData.docPath = merged;
            }
        }
        // Universal Front + Back auto-crop & merge for ALL other document types (rationCard, smartCard, residenceProof, gasBook, voterId, etc.)
        const allDocSources = { ...(prof.documents || {}), ...(draftData.documents || {}), ...(draftData.tempUploads || {}), ...docPackage };
        for (const key of Object.keys(allDocSources)) {
            if (key.endsWith('Back') && key !== 'headAadhaarBack' && key !== 'memberAadhaarBack') {
                const baseType = key.slice(0, -4);
                const fPath = allDocSources[`${baseType}Front`] || allDocSources[baseType];
                const bPath = allDocSources[key];
                const curMerged = docPackage[baseType];
                if (fPath && bPath && typeof fPath === 'string' && typeof bPath === 'string' && (!curMerged || !String(curMerged).toLowerCase().includes('merged'))) {
                    const merged = await produceDualSidedDocument(fPath, bPath);
                    if (merged) {
                        docPackage[baseType] = merged;
                        if (prof.documents) prof.documents[baseType] = merged;
                    }
                }
            }
        }
    } catch (_) {}

    await handleDoc(docPackage.profilePhoto, 'profilePhoto');
    await handleDoc(docPackage.headAadhaar || docPackage.headAadhaarFront, 'headAadhaar');
    await handleDoc(docPackage.headAadhaarFront, 'headAadhaarFront');
    await handleDoc(docPackage.headAadhaarBack, 'headAadhaarBack');
    await handleDoc(docPackage.residenceProof, 'residenceProof');
    await handleDoc(docPackage.gasBook, 'gasBook');
    await handleDoc(docPackage.memberAadhaar, 'memberAadhaar');
    await handleDoc(docPackage.memberAadhaarFront, 'memberAadhaarFront');
    await handleDoc(docPackage.memberAadhaarBack, 'memberAadhaarBack');
    await handleDoc(docPackage.birthCertificate, 'birthCertificate');
    await handleDoc(docPackage.newAddressProof, 'newAddressProof');
    await handleDoc(docPackage.surrenderProof, 'surrenderProof');

    // Sync ALL additional service documents (Smart Card, Income/Community/Education/Death/Marriage proofs, etc.)
    const EXTRA_ARCHIVE_DOC_KEYS = [
        'smartCard', 'rationCard', 'removeProof', 'incomeProof', 'salaryCertificate', 'incomeTaxReturn',
        'communityProof', 'communityCertificate', 'applicantEducationProof', 'fatherEducationProof',
        'motherEducationProof', 'deathCertificate', 'deceasedAddressProof', 'marriageProof', 'marriageCertificate',
        'panCard', 'voterId', 'bankPassbook', 'ebBill', 'propertyTax', 'canReceipt'
    ];
    for (const extraKey of EXTRA_ARCHIVE_DOC_KEYS) {
        const extraPath = docPackage[extraKey] || prof.documents?.[extraKey] || prof[extraKey];
        if (extraPath && typeof extraPath === 'string' && extraPath !== 'SELF_DECLARATION') {
            await handleDoc(extraPath, extraKey);
        }
    }

    // Sync End-Result Application Receipt PDF (if generated/downloaded locally) directly to Firebase Cloud Storage!
    const appNo = String(draftData.applicationNumber || prof.applicationNumber || '').trim();
    const rawAppPdf = draftData.applicationPdfUrl || prof.applicationPdfUrl || (appNo ? `/receipts/Application_${appNo}.pdf` : '');
    if (rawAppPdf && typeof rawAppPdf === 'string' && !rawAppPdf.startsWith('http')) {
        const pdfBase = path.basename(rawAppPdf);
        const receiptCandidates = [
            rawAppPdf,
            path.join(__dirname, '..', '..', '..', 'public', 'receipts', pdfBase),
            path.join(getActiveUploadsDir(), '..', 'receipts', pdfBase)
        ];
        const existingReceiptPdf = receiptCandidates.find(c => c && fs.existsSync(c));
        if (existingReceiptPdf) {
            await handleDoc(existingReceiptPdf, 'applicationPdf');
        }
    }

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
            if (shouldUploadToCloud && isStorageAvailable()) {
                const url = await uploadDocToStorage(mPath, storagePath);
                if (url) memberUrls.push(url);
            }
            const b64 = fileToBase64(mPath);
            if (b64) memberBase64s.push({ name: fileName, base64: b64 });
        }
        if (memberUrls.length > 0) storageUrls.memberAadhaars = memberUrls;
        if (memberBase64s.length > 0) base64Docs.memberAadhaarsBase64 = memberBase64s;
    } else if (docPackage.memberAadhaar && fs.existsSync(docPackage.memberAadhaar)) {
        const mB64 = fileToBase64(docPackage.memberAadhaar);
        if (mB64) {
            base64Docs.memberAadhaarsBase64 = [{ name: path.basename(docPackage.memberAadhaar), base64: mB64 }];
        }
    }

    if (isAddMemService && !hasExistingHeadMaster) {
        if (!storageUrls.memberAadhaar && storageUrls.headAadhaar) storageUrls.memberAadhaar = storageUrls.headAadhaar;
        delete storageUrls.headAadhaar;
        delete storageUrls.headAadhaarFront;
        delete storageUrls.headAadhaarBack;
        delete storageUrls.profilePhoto;
        delete base64Docs.headAadhaarBase64;
        delete base64Docs.headAadhaarFrontBase64;
        delete base64Docs.headAadhaarBackBase64;
        delete base64Docs.profilePhotoBase64;
    }

    return { storageUrls, base64Docs };
}

module.exports = { processDraftDocuments };
