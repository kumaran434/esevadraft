const fs = require('fs');
const path = require('path');

const { produceCompliantPassportPhoto, produceCompliantDocument, produceDualSidedDocument } = require('../../photo_studio');
const { inspectAndExtractDocument } = require('../../ai_document_extractor');
const { validateUploadedDocument } = require('./document_validator');
const { applyExtractedAadhaarRelationsAndDob, applyExtractedSmartCardDetails } = require('./profile_helpers');

async function extractAndNormalizePhoto(sess, uploadedFile) {
    let extractedPhoto = null;
    try {
        extractedPhoto = await inspectAndExtractDocument(uploadedFile.path);
    } catch (_) {}

    const validation = validateUploadedDocument('profilePhoto', extractedPhoto);
    if (!validation.valid) {
        try { if (fs.existsSync(uploadedFile.path)) fs.unlinkSync(uploadedFile.path); } catch (_) {}
        const err = new Error(validation.errorTamil);
        err.status = 400;
        throw err;
    }

    let optimizedPath = uploadedFile.path;
    try {
        optimizedPath = await produceCompliantPassportPhoto(uploadedFile.path, {
            sess,
            faceBoundingBox: extractedPhoto?.faceBoundingBox
        });
    } catch (_) {
        optimizedPath = uploadedFile.path;
    }

    sess.tempUploads = sess.tempUploads || {};
    sess.citizenProfile.documents = sess.citizenProfile.documents || {};
    sess.citizenProfile.headPhotoPath = optimizedPath;
    sess.tempUploads.profilePhoto = optimizedPath;
    sess.citizenProfile.documents.profilePhoto = optimizedPath;

    return { optimizedPath, extractedData: extractedPhoto || null };
}

async function extractAndNormalizeHeadAadhaar(sess, docType, uploadedFile, { updateMembersZero = false } = {}) {
    const isBackSide = (docType === 'headAadhaarBack');
    let extractedAadhaar = null;
    try {
        extractedAadhaar = await inspectAndExtractDocument(uploadedFile.path, { skipFaceExtraction: true });
    } catch (_) {}

    const validation = validateUploadedDocument(docType, extractedAadhaar);
    if (!validation.valid) {
        try { if (fs.existsSync(uploadedFile.path)) fs.unlinkSync(uploadedFile.path); } catch (_) {}
        const err = new Error(validation.errorTamil);
        err.status = 400;
        throw err;
    }

    let optimizedPath = uploadedFile.path;
    try {
        optimizedPath = await produceCompliantDocument(uploadedFile.path, {
            sess,
            boundingBox: extractedAadhaar?.documentBoundingBox
        });
    } catch (_) {
        optimizedPath = uploadedFile.path;
    }

    sess.tempUploads = sess.tempUploads || {};
    sess.citizenProfile.documents = sess.citizenProfile.documents || {};
    if (isBackSide) {
        sess.tempUploads.headAadhaarBack = optimizedPath;
        sess.citizenProfile.documents.headAadhaarBack = optimizedPath;
    } else {
        sess.tempUploads.headAadhaarFront = optimizedPath;
        sess.citizenProfile.documents.headAadhaarFront = optimizedPath;
        sess.citizenProfile.documents.headAadhaar = optimizedPath;
        sess.citizenProfile.headAadhaarDocPath = optimizedPath;
    }

    const frontCandidate = sess.tempUploads.headAadhaarFront || sess.citizenProfile.documents?.headAadhaarFront || (!isBackSide ? optimizedPath : sess.citizenProfile.headAadhaarDocPath);
    const backCandidate = sess.tempUploads.headAadhaarBack || sess.citizenProfile.documents?.headAadhaarBack || (isBackSide ? optimizedPath : null);

    if (frontCandidate && backCandidate && frontCandidate !== backCandidate && fs.existsSync(frontCandidate) && fs.existsSync(backCandidate)) {
        try {
            const mergedPdf = await produceDualSidedDocument(frontCandidate, backCandidate, undefined, { sess });
            if (mergedPdf && fs.existsSync(mergedPdf)) {
                optimizedPath = mergedPdf;
                sess.tempUploads.headAadhaar = mergedPdf;
                sess.citizenProfile.headAadhaarDocPath = mergedPdf;
                sess.citizenProfile.documents.headAadhaar = mergedPdf;
            }
        } catch (_) {}
    } else if (!sess.citizenProfile.headAadhaarDocPath) {
        sess.tempUploads.headAadhaar = optimizedPath;
        sess.citizenProfile.headAadhaarDocPath = optimizedPath;
        sess.citizenProfile.documents.headAadhaar = optimizedPath;
    }

    let extractedData = null;
    if (extractedAadhaar && extractedAadhaar.isQualityAcceptable !== false) {
        extractedData = extractedAadhaar;
        if (extractedAadhaar.fullNameTam) sess.citizenProfile.fullNameTam = extractedAadhaar.fullNameTam;
        if (extractedAadhaar.fullNameEng) sess.citizenProfile.fullNameEng = extractedAadhaar.fullNameEng;
        applyExtractedAadhaarRelationsAndDob(sess.citizenProfile, extractedAadhaar);
        if (extractedAadhaar.gender) {
            sess.citizenProfile.headGender = extractedAadhaar.gender;
            sess.citizenProfile.headGenderTam = extractedAadhaar.genderTam || (extractedAadhaar.gender === 'Female' ? 'பெண்' : 'ஆண்');
        }
        if (extractedAadhaar.aadhaarNumber) {
            sess.citizenProfile.headAadhaar = String(extractedAadhaar.aadhaarNumber).replace(/\s+/g, '');
        }
        if (extractedAadhaar.doorNo) sess.citizenProfile.doorNo = extractedAadhaar.doorNo;
        if (extractedAadhaar.streetTam) sess.citizenProfile.streetTam = extractedAadhaar.streetTam;
        if (extractedAadhaar.streetEng) sess.citizenProfile.streetEng = extractedAadhaar.streetEng;
        if (extractedAadhaar.areaTam) sess.citizenProfile.areaTam = extractedAadhaar.areaTam;
        if (extractedAadhaar.areaEng) sess.citizenProfile.areaEng = extractedAadhaar.areaEng;
        if (extractedAadhaar.pincode) sess.citizenProfile.pincode = extractedAadhaar.pincode;
        if (extractedAadhaar.district) sess.citizenProfile.district = extractedAadhaar.district;
        if (extractedAadhaar.districtTam) sess.citizenProfile.districtTam = extractedAadhaar.districtTam;
        if (extractedAadhaar.taluk) sess.citizenProfile.taluk = extractedAadhaar.taluk;
        if (extractedAadhaar.talukTam) sess.citizenProfile.talukTam = extractedAadhaar.talukTam;
        if (extractedAadhaar.village) sess.citizenProfile.village = extractedAadhaar.village;
        if (extractedAadhaar.villageTam) sess.citizenProfile.villageTam = extractedAadhaar.villageTam;

        if (updateMembersZero && sess.citizenProfile.members && sess.citizenProfile.members.length > 0) {
            if (sess.citizenProfile.fullNameTam) sess.citizenProfile.members[0].nameTam = sess.citizenProfile.fullNameTam;
            if (sess.citizenProfile.fullNameEng) sess.citizenProfile.members[0].nameEng = sess.citizenProfile.fullNameEng;
            if (sess.citizenProfile.headDob) sess.citizenProfile.members[0].dob = sess.citizenProfile.headDob;
            if (sess.citizenProfile.headGender) sess.citizenProfile.members[0].gender = sess.citizenProfile.headGender;
            if (sess.citizenProfile.headAadhaar) sess.citizenProfile.members[0].aadhaarNumber = sess.citizenProfile.headAadhaar;
        }
    }

    return { optimizedPath, extractedData };
}

async function extractAndNormalizeSmartCard(sess, docType, uploadedFile) {
    let extractedOther = null;
    try {
        extractedOther = await inspectAndExtractDocument(uploadedFile.path, { skipFaceExtraction: true });
    } catch (_) {}

    let optimizedPath = uploadedFile.path;
    try {
        optimizedPath = await produceCompliantDocument(uploadedFile.path, {
            sess,
            boundingBox: extractedOther?.documentBoundingBox
        });
    } catch (_) {
        optimizedPath = uploadedFile.path;
    }

    sess.tempUploads = sess.tempUploads || {};
    sess.citizenProfile.documents = sess.citizenProfile.documents || {};
    sess.tempUploads[docType] = optimizedPath;
    sess.citizenProfile.documents[docType] = optimizedPath;

    if (docType.endsWith('Back')) {
        sess.tempUploads.smartCardBack = optimizedPath;
        sess.citizenProfile.documents.smartCardBack = optimizedPath;
    } else {
        sess.tempUploads.smartCardFront = optimizedPath;
        sess.citizenProfile.documents.smartCardFront = optimizedPath;
    }

    const scFront = sess.tempUploads.smartCardFront || sess.citizenProfile.documents.smartCardFront || (!docType.endsWith('Back') ? optimizedPath : sess.citizenProfile.smartCardDocPath);
    const scBack = sess.tempUploads.smartCardBack || sess.citizenProfile.documents.smartCardBack || (docType.endsWith('Back') ? optimizedPath : null);
    if (scFront && scBack && scFront !== scBack && fs.existsSync(scFront) && fs.existsSync(scBack)) {
        try {
            const mergedSc = await produceDualSidedDocument(scFront, scBack, undefined, { sess });
            if (mergedSc && fs.existsSync(mergedSc)) optimizedPath = mergedSc;
        } catch (_) {}
    }
    sess.tempUploads.smartCard = optimizedPath;
    sess.tempUploads.rationCard = optimizedPath;
    sess.citizenProfile.documents.smartCard = optimizedPath;
    sess.citizenProfile.documents.rationCard = optimizedPath;
    sess.citizenProfile.smartCardDocPath = optimizedPath;
    sess.citizenProfile.rationCardDocPath = optimizedPath;

    let extractedData = null;
    if (extractedOther && extractedOther.isQualityAcceptable !== false) {
        extractedData = extractedOther;
        if (extractedOther.smartCardNumber) {
            sess.citizenProfile.smartCardNumber = extractedOther.smartCardNumber;
            sess.citizenProfile.rationCardNo = extractedOther.smartCardNumber;
        }
        applyExtractedSmartCardDetails(sess.citizenProfile, extractedOther);
    }

    return { optimizedPath, extractedData };
}

async function extractAndNormalizeGenericDoc(sess, docType, uploadedFile, { validateAs = null, ocrOpts = {} } = {}) {
    let extractedOther = null;
    try {
        extractedOther = await inspectAndExtractDocument(uploadedFile.path, { skipFaceExtraction: true, ...ocrOpts });
    } catch (_) {}

    if (validateAs) {
        const validation = validateUploadedDocument(validateAs, extractedOther);
        if (!validation.valid) {
            try { if (fs.existsSync(uploadedFile.path)) fs.unlinkSync(uploadedFile.path); } catch (_) {}
            const err = new Error(validation.errorTamil);
            err.status = 400;
            throw err;
        }
    }

    let optimizedPath = uploadedFile.path;
    try {
        optimizedPath = await produceCompliantDocument(uploadedFile.path, {
            sess,
            boundingBox: extractedOther?.documentBoundingBox
        });
    } catch (_) {
        optimizedPath = uploadedFile.path;
    }

    sess.tempUploads = sess.tempUploads || {};
    sess.citizenProfile.documents = sess.citizenProfile.documents || {};
    sess.tempUploads[docType] = optimizedPath;
    sess.citizenProfile.documents[docType] = optimizedPath;

    const baseDocType = docType.replace(/(Front|Back)$/, '');
    const fKey = `${baseDocType}Front`;
    const bKey = `${baseDocType}Back`;
    if (docType === baseDocType && !sess.tempUploads[fKey]) {
        sess.tempUploads[fKey] = optimizedPath;
    }
    const fPath = sess.tempUploads[fKey] || sess.citizenProfile.documents[fKey] || sess.tempUploads[baseDocType];
    const bPath = sess.tempUploads[bKey] || sess.citizenProfile.documents[bKey];
    if (fPath && bPath && fPath !== bPath) {
        try {
            const mergedPdf = await produceDualSidedDocument(fPath, bPath, undefined, { sess });
            if (mergedPdf && fs.existsSync(mergedPdf)) {
                optimizedPath = mergedPdf;
                sess.tempUploads[baseDocType] = mergedPdf;
                sess.citizenProfile.documents[baseDocType] = mergedPdf;
            }
        } catch (_) {}
    }

    const extractedData = (extractedOther && extractedOther.isQualityAcceptable !== false) ? extractedOther : null;
    return { optimizedPath, extractedData, canonicalKey: baseDocType };
}

function hydrateBase64DocCache(sess, docType, optimizedPath, { aliasSmartCard = false } = {}) {
    sess.base64Docs = sess.base64Docs || {};
    sess.citizenProfile.base64Docs = sess.citizenProfile.base64Docs || {};
    const canonicalKey = docType.replace(/(Front|Back)$/, '');
    let b64 = null;
    let bName = null;

    try {
        if (optimizedPath && fs.existsSync(optimizedPath)) {
            b64 = fs.readFileSync(optimizedPath).toString('base64');
            bName = path.basename(optimizedPath);
            sess.base64Docs[`${docType}Base64`] = b64;
            sess.base64Docs[`${docType}Name`] = bName;
            sess.base64Docs[`${canonicalKey}Base64`] = b64;
            sess.base64Docs[`${canonicalKey}Name`] = bName;
            sess.citizenProfile.base64Docs[`${docType}Base64`] = b64;
            sess.citizenProfile.base64Docs[`${docType}Name`] = bName;
            sess.citizenProfile.base64Docs[`${canonicalKey}Base64`] = b64;
            sess.citizenProfile.base64Docs[`${canonicalKey}Name`] = bName;

            if (aliasSmartCard || canonicalKey === 'smartCard' || canonicalKey === 'rationCard') {
                sess.base64Docs.smartCardBase64 = b64;
                sess.base64Docs.smartCardName = bName;
                sess.base64Docs.rationCardBase64 = b64;
                sess.base64Docs.rationCardName = bName;
                sess.citizenProfile.base64Docs.smartCardBase64 = b64;
                sess.citizenProfile.base64Docs.smartCardName = bName;
                sess.citizenProfile.base64Docs.rationCardBase64 = b64;
                sess.citizenProfile.base64Docs.rationCardName = bName;
            }
        }
    } catch (_) {}

    return { canonicalKey, b64, bName };
}

module.exports = {
    extractAndNormalizePhoto,
    extractAndNormalizeHeadAadhaar,
    extractAndNormalizeSmartCard,
    extractAndNormalizeGenericDoc,
    hydrateBase64DocCache
};
