const fs = require('fs');
const path = require('path');
const { normalizeOilCompanyCode, applyExtractedGasDetails } = require('../../services/profile_helpers');
const { inspectAndExtractDocument } = require('../../../ai_document_extractor');
const { produceCompliantDocument, produceDualSidedDocument } = require('../../../photo_studio');
const { validateUploadedDocument } = require('../../services/document_validator');
const {
    extractAndNormalizePhoto,
    extractAndNormalizeHeadAadhaar,
    extractAndNormalizeGenericDoc,
    hydrateBase64DocCache
} = require('../../services/doc_upload_primitives');

async function processEditModalUpload({ sess, docType, uploadedFile, memberIndex = 0, targetMobile }) {
    let optimizedPath = uploadedFile.path;
    let extractedData = null;

    if (docType === 'headPhoto' || docType === 'profilePhoto') {
        ({ optimizedPath, extractedData } = await extractAndNormalizePhoto(sess, uploadedFile));
    } else if (docType === 'headAadhaar' || docType === 'headAadhaarFront' || docType === 'headAadhaarBack') {
        ({ optimizedPath, extractedData } = await extractAndNormalizeHeadAadhaar(sess, docType, uploadedFile, { updateMembersZero: true }));
    } else if (docType === 'memberAadhaar' || docType === 'memberAadhaarFront' || docType === 'memberAadhaarBack') {
        const isBackSide = (docType === 'memberAadhaarBack');
        let extractedMember = null;
        try {
            extractedMember = await inspectAndExtractDocument(uploadedFile.path, { skipFaceExtraction: true, isAddMember: true });
        } catch (_) {}

        try {
            optimizedPath = await produceCompliantDocument(uploadedFile.path, {
                boundingBox: extractedMember?.documentBoundingBox
            });
        } catch (_) {
            optimizedPath = uploadedFile.path;
        }

        const fKey = `memberAadhaarFront_${memberIndex}`;
        const bKey = `memberAadhaarBack_${memberIndex}`;
        const isBirthCertDoc = extractedMember?.documentType === 'BIRTH_CERTIFICATE';
        sess.tempUploads = sess.tempUploads || {};
        sess.citizenProfile.documents = sess.citizenProfile.documents || {};

        if (isBackSide) {
            sess.tempUploads[bKey] = optimizedPath;
            if (memberIndex === 0) sess.tempUploads.memberAadhaarBack = optimizedPath;
        } else {
            sess.tempUploads[fKey] = optimizedPath;
            if (isBirthCertDoc || (uploadedFile.path || '').toLowerCase().endsWith('.pdf')) {
                delete sess.tempUploads[bKey];
            }
            if (memberIndex === 0) sess.tempUploads.memberAadhaarFront = optimizedPath;
        }

        const mFront = memberIndex > 0
            ? (sess.tempUploads[fKey] || (!isBackSide ? optimizedPath : (sess.citizenProfile.members?.[memberIndex]?.docPath || null)))
            : (sess.tempUploads[fKey] || sess.tempUploads.memberAadhaarFront || (!isBackSide ? optimizedPath : (sess.citizenProfile.members?.[memberIndex]?.docPath || null)));
        const mBack = memberIndex > 0
            ? (sess.tempUploads[bKey] || (isBackSide ? optimizedPath : null))
            : (sess.tempUploads[bKey] || sess.tempUploads.memberAadhaarBack || (isBackSide ? optimizedPath : null));

        if (!isBirthCertDoc && mFront && mBack && mFront !== mBack && fs.existsSync(mFront) && fs.existsSync(mBack)) {
            try {
                const mergedPdf = await produceDualSidedDocument(mFront, mBack);
                if (mergedPdf && fs.existsSync(mergedPdf)) optimizedPath = mergedPdf;
            } catch (_) {}
        }

        if (sess.citizenProfile.members && sess.citizenProfile.members[memberIndex]) {
            sess.citizenProfile.members[memberIndex].docPath = optimizedPath;
            sess.citizenProfile.members[memberIndex].docType = isBirthCertDoc ? 'BIRTH_CERTIFICATE' : 'AADHAAR_CARD';
            sess.citizenProfile.members[memberIndex].hasAadhaar = !isBirthCertDoc;
            if (isBirthCertDoc) {
                sess.citizenProfile.members[memberIndex].birthCertificatePath = optimizedPath;
                sess.citizenProfile.members[memberIndex].aadhaarNumber = '';
            }
        }
        sess.citizenProfile.documents[`memberDoc_${memberIndex}`] = optimizedPath;
        if (memberIndex > 0) sess.citizenProfile.documents[`memberAadhaar${memberIndex - 1}`] = optimizedPath;
        sess.tempUploads[`memberAadhaar_${memberIndex}`] = optimizedPath;

        if (extractedMember && extractedMember.isQualityAcceptable !== false) {
            extractedData = extractedMember;
            if (sess.citizenProfile.members && sess.citizenProfile.members[memberIndex]) {
                if (extractedMember.fullNameTam) sess.citizenProfile.members[memberIndex].nameTam = extractedMember.fullNameTam;
                if (extractedMember.fullNameEng) sess.citizenProfile.members[memberIndex].nameEng = extractedMember.fullNameEng;
                if (extractedMember.dob) sess.citizenProfile.members[memberIndex].dob = extractedMember.dob;
                if (extractedMember.gender) {
                    sess.citizenProfile.members[memberIndex].gender = extractedMember.gender;
                    sess.citizenProfile.members[memberIndex].genderTam = extractedMember.genderTam || (extractedMember.gender === 'Female' ? 'பெண்' : 'ஆண்');
                }
                if (isBirthCertDoc) {
                    sess.citizenProfile.members[memberIndex].aadhaarNumber = '';
                } else if (extractedMember.aadhaarNumber && /^\d{12}$/.test(String(extractedMember.aadhaarNumber).replace(/\D/g, ''))) {
                    sess.citizenProfile.members[memberIndex].aadhaarNumber = String(extractedMember.aadhaarNumber).replace(/\D/g, '');
                }
            }
        }
    } else if (docType === 'residenceProof' || docType === 'gasBook') {
        let extracted = null;
        try {
            extracted = await inspectAndExtractDocument(uploadedFile.path, { skipFaceExtraction: true });
        } catch (_) {}

        const validation = validateUploadedDocument('residenceProof', extracted);
        if (!validation.valid) {
            try { if (fs.existsSync(uploadedFile.path)) fs.unlinkSync(uploadedFile.path); } catch (_) {}
            const err = new Error(validation.errorTamil);
            err.status = 400;
            throw err;
        }

        try {
            optimizedPath = await produceCompliantDocument(uploadedFile.path, {
                boundingBox: extracted?.documentBoundingBox
            });
        } catch (_) {
            optimizedPath = uploadedFile.path;
        }
        sess.tempUploads = sess.tempUploads || {};
        sess.citizenProfile.documents = sess.citizenProfile.documents || {};
        const frontKey = `${docType}Front`;
        const backKey = `${docType}Back`;
        if (!sess.tempUploads[frontKey]) sess.tempUploads[frontKey] = optimizedPath;
        if (sess.tempUploads[frontKey] && sess.tempUploads[backKey]) {
            try {
                const mergedPdf = await produceDualSidedDocument(sess.tempUploads[frontKey], sess.tempUploads[backKey]);
                if (mergedPdf && fs.existsSync(mergedPdf)) optimizedPath = mergedPdf;
            } catch (_) {}
        }
        sess.tempUploads.residenceProof = optimizedPath;
        sess.tempUploads.gasBook = optimizedPath;
        sess.citizenProfile.documents.gasBook = optimizedPath;
        sess.citizenProfile.documents.residenceProof = optimizedPath;
        sess.citizenProfile.gasDetails = { ...(sess.citizenProfile.gasDetails || {}), gasBookPath: optimizedPath, hasGas: true };
        sess.citizenProfile.residenceProof = { ...(sess.citizenProfile.residenceProof || {}), docPath: optimizedPath };

        try {
            const appDataUp = path.join(process.env.APPDATA || 'C:\\Users\\ADMIN\\AppData\\Roaming', 'esevadraft-desktop', 'data', 'uploads', targetMobile);
            const localDataUp = path.join(__dirname, '..', '..', '..', 'data', 'uploads', targetMobile);
            for (const d of [appDataUp, localDataUp]) {
                if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
                const ext = path.extname(optimizedPath) || '.jpg';
                const targetGasFile = path.join(d, `gas${ext}`);
                if (optimizedPath !== targetGasFile) fs.copyFileSync(optimizedPath, targetGasFile);
            }
        } catch (_) {}

        if (extracted) {
            const isGasDoc = docType === 'gasBook' ||
                extracted?.documentType === 'GAS_BOOK' ||
                extracted?.residenceProofCategory === 'GAS_BOOK' ||
                !!(extracted?.gasDetails?.consumerNumber);

            if (isGasDoc) {
                sess.citizenProfile.residenceProof.type = 'GAS_BOOK';
                sess.citizenProfile.residenceProof.typeTam = 'எரிவாயு நுகர்வோர் அட்டை';
            } else if (extracted.residenceProofCategory && extracted.residenceProofCategory !== 'NONE') {
                sess.citizenProfile.residenceProof.type = extracted.residenceProofCategory;
                if (extracted.residenceProofNameTamil) {
                    sess.citizenProfile.residenceProof.typeTam = extracted.residenceProofNameTamil;
                }
            }
            applyExtractedGasDetails(sess.citizenProfile, extracted, isGasDoc ? optimizedPath : null, isGasDoc);
            if (extracted.isQualityAcceptable !== false) extractedData = extracted;
        }
    } else {
        ({ optimizedPath, extractedData } = await extractAndNormalizeGenericDoc(sess, docType, uploadedFile));
    }

    const { b64, bName } = hydrateBase64DocCache(sess, docType, optimizedPath);
    if (b64 && (docType === 'residenceProof' || docType === 'gasBook')) {
        sess.base64Docs.gasBookBase64 = b64;
        sess.base64Docs.gasBookName = bName;
        sess.base64Docs.residenceProofBase64 = b64;
        sess.base64Docs.residenceProofName = bName;
        sess.citizenProfile.base64Docs.gasBookBase64 = b64;
        sess.citizenProfile.base64Docs.gasBookName = bName;
        sess.citizenProfile.base64Docs.residenceProofBase64 = b64;
        sess.citizenProfile.base64Docs.residenceProofName = bName;
    }

    return { optimizedPath, extractedData };
}

module.exports = {
    normalizeOilCompanyCode,
    applyExtractedGasDetails,
    processEditModalUpload
};
