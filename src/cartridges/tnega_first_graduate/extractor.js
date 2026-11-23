const { applyExtractedIncomeDetails } = require('../../services/profile_helpers');
const {
    extractAndNormalizePhoto,
    extractAndNormalizeHeadAadhaar,
    extractAndNormalizeSmartCard,
    extractAndNormalizeGenericDoc,
    hydrateBase64DocCache
} = require('../../services/doc_upload_primitives');

function extractStudentTcFields(profile, extracted) {
    if (!profile || !extracted) return '';
    if (extracted.fullNameTam || extracted.fullNameEng) {
        if (extracted.fullNameTam) profile.fullNameTam = extracted.fullNameTam;
        if (extracted.fullNameEng) profile.fullNameEng = extracted.fullNameEng;
        if (extracted.fatherNameTam) profile.fatherNameTam = extracted.fatherNameTam;
        if (extracted.fatherNameEng) profile.fatherNameEng = extracted.fatherNameEng;
        if (extracted.dob) profile.dob = extracted.dob;
        if (extracted.community) profile.community = extracted.community;
        if (extracted.caste) profile.caste = extracted.caste;
        return `\n\n📄 **மாற்றுச் சான்றிதழிலிருந்து (TC) விவரங்கள் தானாகப் பெறப்பட்டன:**\n• மாணவர்: **${extracted.fullNameTam || extracted.fullNameEng}** | பிறந்த தேதி: **${extracted.dob || '—'}**\n• தந்தை: **${extracted.fatherNameTam || extracted.fatherNameEng || '—'}** ✅`;
    }
    return '';
}

function applyDocumentUpload(sess, { canonicalKey, optimizedPath, b64, extractedOther, isIncomeDoc } = {}) {
    if (!sess || !sess.citizenProfile) return false;
    sess.citizenProfile.documents = sess.citizenProfile.documents || {};
    sess.base64Docs = sess.base64Docs || {};
    sess.citizenProfile.base64Docs = sess.citizenProfile.base64Docs || {};

    let handled = false;
    if (extractedOther && extractedOther.isQualityAcceptable !== false) {
        if (canonicalKey === 'applicantEducationProof' || canonicalKey === 'studentTc') {
            extractStudentTcFields(sess.citizenProfile, extractedOther);
            handled = true;
        }
        applyExtractedIncomeDetails(sess.citizenProfile, extractedOther);
        if (isIncomeDoc && extractedOther.certificateNumber) {
            sess.citizenProfile.incomeCertNumber = String(extractedOther.certificateNumber).trim();
        }
    }

    if (canonicalKey === 'applicantEducationProof' || canonicalKey === 'studentTc') {
        if (optimizedPath) {
            sess.citizenProfile.applicantEducationProof = optimizedPath;
            sess.citizenProfile.studentTc = optimizedPath;
            sess.citizenProfile.documents.applicantEducationProof = optimizedPath;
        }
        handled = true;
    }
    if (canonicalKey === 'fatherEducationProof' || canonicalKey === 'fatherTc') {
        if (optimizedPath) {
            sess.citizenProfile.fatherEducationProof = optimizedPath;
            sess.citizenProfile.fatherTc = optimizedPath;
            sess.citizenProfile.documents.fatherEducationProof = optimizedPath;
        }
        handled = true;
    }
    if (canonicalKey === 'motherEducationProof' || canonicalKey === 'motherTc') {
        if (optimizedPath) {
            sess.citizenProfile.motherEducationProof = optimizedPath;
            sess.citizenProfile.motherTc = optimizedPath;
            sess.citizenProfile.documents.motherEducationProof = optimizedPath;
        }
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
    const isIncomeDoc = ['incomeTaxReturn', 'incomeProof', 'salarySlip', 'salaryCertificate'].includes(docType);

    if (docType === 'headPhoto' || docType === 'profilePhoto') {
        ({ optimizedPath, extractedData } = await extractAndNormalizePhoto(sess, uploadedFile));
    } else if (docType === 'headAadhaar' || docType === 'headAadhaarFront' || docType === 'headAadhaarBack') {
        ({ optimizedPath, extractedData } = await extractAndNormalizeHeadAadhaar(sess, docType, uploadedFile, { updateMembersZero: false }));
    } else if (docType === 'smartCard' || docType === 'smartCardFront' || docType === 'smartCardBack' || docType === 'rationCard' || docType === 'rationCardFront' || docType === 'rationCardBack') {
        ({ optimizedPath, extractedData } = await extractAndNormalizeSmartCard(sess, docType, uploadedFile));
    } else {
        ({ optimizedPath, extractedData } = await extractAndNormalizeGenericDoc(sess, docType, uploadedFile, {
            validateAs: isIncomeDoc ? 'incomeProof' : null,
            ocrOpts: { isTnega: true }
        }));
    }

    const { canonicalKey, b64 } = hydrateBase64DocCache(sess, docType, optimizedPath);
    applyDocumentUpload(sess, {
        docType,
        canonicalKey,
        optimizedPath,
        b64,
        extractedOther: extractedData,
        isIncomeDoc: isIncomeDoc || extractedData?.documentType === 'INCOME_CERTIFICATE'
    });
    return { optimizedPath, extractedData };
}

module.exports = { extractStudentTcFields, applyDocumentUpload, processEditModalUpload };
