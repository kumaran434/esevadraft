const { applyExtractedIncomeDetails, applyExtractedSmartCardDetails } = require('../../services/profile_helpers');
const {
    extractAndNormalizePhoto,
    extractAndNormalizeHeadAadhaar,
    extractAndNormalizeSmartCard,
    extractAndNormalizeGenericDoc,
    hydrateBase64DocCache
} = require('../../services/doc_upload_primitives');

function extractObcCommunityFields(profile, extracted) {
    if (!profile || !extracted) return '';
    let extraInfo = '';
    if (extracted.caste || extracted.subCaste) {
        const c = extracted.caste || extracted.subCaste;
        profile.caste = c;
        if (extracted.community) profile.community = extracted.community;
        profile.fatherCaste = extracted.fatherCaste || c;
        profile.motherCaste = extracted.motherCaste || c;
        profile.requestedCaste = c;
        profile.parentCasteConfirmed = true;
        extraInfo += `\n• 🏷️ **சாதி:** **${c}** (தானாகப் பிரித்தெடுக்கப்பட்டது ✅)`;
    }
    if (extracted.certificateNumber) {
        profile.communityCertNumber = String(extracted.certificateNumber).trim();
    }
    applyExtractedIncomeDetails(profile, extracted);
    return extraInfo;
}

function extractObcIncomeFields(profile, extracted) {
    if (!profile || !extracted) return '';
    applyExtractedIncomeDetails(profile, extracted);
    if (extracted.certificateNumber) {
        profile.incomeCertNumber = String(extracted.certificateNumber).trim();
    }
    let extraInc = '';
    if (profile.annualIncome) extraInc += `\n• 💰 **ஆண்டு வருமானம்:** ₹${profile.annualIncome}`;
    if (profile.fatherOccupation) extraInc += `\n• 👨 **தந்தை பணி:** ${profile.fatherOccupation}`;
    if (profile.motherOccupation) extraInc += `\n• 👩 **தாய் பணி:** ${profile.motherOccupation}`;
    if (extraInc) extraInc += ` (தானாகப் பிரித்தெடுக்கப்பட்டது ✅)`;
    return extraInc;
}

function applyDocumentUpload(sess, { canonicalKey, optimizedPath, b64, bName, extractedOther, isCommunityDoc, isIncomeDoc, isSmartCardDoc } = {}) {
    if (!sess || !sess.citizenProfile) return false;
    sess.citizenProfile.documents = sess.citizenProfile.documents || {};
    sess.base64Docs = sess.base64Docs || {};
    sess.citizenProfile.base64Docs = sess.citizenProfile.base64Docs || {};

    let handled = false;
    if (extractedOther && extractedOther.isQualityAcceptable !== false) {
        if (isCommunityDoc) {
            extractObcCommunityFields(sess.citizenProfile, extractedOther);
            handled = true;
        } else if (isIncomeDoc) {
            extractObcIncomeFields(sess.citizenProfile, extractedOther);
            handled = true;
        } else {
            applyExtractedIncomeDetails(sess.citizenProfile, extractedOther);
        }
        if (extractedOther.smartCardNumber) {
            sess.citizenProfile.smartCardNumber = extractedOther.smartCardNumber;
            sess.citizenProfile.rationCardNo = extractedOther.smartCardNumber;
        }
        if (isSmartCardDoc) {
            applyExtractedSmartCardDetails(sess.citizenProfile, extractedOther);
            handled = true;
        }
    }

    if (canonicalKey === 'communityProof' || canonicalKey === 'familyCommunityProof' || canonicalKey === 'communityCertificate') {
        if (optimizedPath) {
            sess.citizenProfile.communityProof = optimizedPath;
            sess.citizenProfile.communityCertificate = optimizedPath;
            sess.citizenProfile.communityCertificatePath = optimizedPath;
            sess.citizenProfile.familyCommunityProofPath = optimizedPath;
            sess.citizenProfile.documents.communityProof = optimizedPath;
            sess.citizenProfile.documents.communityCertificate = optimizedPath;
        }
        if (b64) {
            sess.base64Docs.communityProofBase64 = b64;
            sess.base64Docs.communityProofName = bName;
            sess.citizenProfile.base64Docs.communityProofBase64 = b64;
            sess.citizenProfile.base64Docs.communityProofName = bName;
        }
        sess.citizenProfile.communityProofSkipped = false;
        handled = true;
    }

    if (canonicalKey === 'incomeTaxReturn' || canonicalKey === 'incomeProof' || canonicalKey === 'salaryCertificate') {
        if (optimizedPath) {
            sess.citizenProfile.incomeTaxReturn = optimizedPath;
            sess.citizenProfile.incomeProof = optimizedPath;
            sess.citizenProfile.salaryCertificatePath = optimizedPath;
            sess.citizenProfile.documents.incomeTaxReturn = optimizedPath;
            sess.citizenProfile.documents.incomeProof = optimizedPath;
        }
        if (b64) {
            sess.base64Docs.incomeTaxReturnBase64 = b64;
            sess.base64Docs.incomeProofBase64 = b64;
            sess.citizenProfile.base64Docs.incomeTaxReturnBase64 = b64;
            sess.citizenProfile.base64Docs.incomeProofBase64 = b64;
        }
        handled = true;
    }
    return handled;
}

async function processEditModalUpload({ sess, docType, uploadedFile }) {
    let optimizedPath = uploadedFile.path;
    let extractedData = null;
    const isCommunityDoc = ['communityProof', 'communityCertificate', 'familyCommunityProof'].includes(docType);
    const isIncomeDoc = ['incomeTaxReturn', 'incomeProof', 'salarySlip', 'salaryCertificate'].includes(docType);
    const isSmartCardDoc = ['smartCard', 'smartCardFront', 'smartCardBack', 'rationCard', 'rationCardFront', 'rationCardBack'].includes(docType);

    if (docType === 'headPhoto' || docType === 'profilePhoto') {
        ({ optimizedPath, extractedData } = await extractAndNormalizePhoto(sess, uploadedFile));
    } else if (docType === 'headAadhaar' || docType === 'headAadhaarFront' || docType === 'headAadhaarBack') {
        ({ optimizedPath, extractedData } = await extractAndNormalizeHeadAadhaar(sess, docType, uploadedFile, { updateMembersZero: false }));
    } else if (isSmartCardDoc) {
        ({ optimizedPath, extractedData } = await extractAndNormalizeSmartCard(sess, docType, uploadedFile));
    } else {
        ({ optimizedPath, extractedData } = await extractAndNormalizeGenericDoc(sess, docType, uploadedFile, {
            validateAs: isCommunityDoc ? 'communityProof' : (isIncomeDoc ? 'incomeProof' : null),
            ocrOpts: { isTnega: isCommunityDoc || isIncomeDoc }
        }));
    }

    const { canonicalKey, b64, bName } = hydrateBase64DocCache(sess, docType, optimizedPath);
    applyDocumentUpload(sess, {
        docType,
        canonicalKey,
        optimizedPath,
        b64,
        bName,
        extractedOther: extractedData,
        isCommunityDoc: isCommunityDoc || extractedData?.documentType === 'COMMUNITY_CERTIFICATE',
        isIncomeDoc: isIncomeDoc || extractedData?.documentType === 'INCOME_CERTIFICATE',
        isSmartCardDoc
    });
    return { optimizedPath, extractedData };
}

module.exports = { extractObcCommunityFields, extractObcIncomeFields, applyDocumentUpload, processEditModalUpload };
