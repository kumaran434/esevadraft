const { applyExtractedIncomeDetails } = require('../../services/profile_helpers');
const {
    extractAndNormalizePhoto,
    extractAndNormalizeHeadAadhaar,
    extractAndNormalizeSmartCard,
    extractAndNormalizeGenericDoc,
    hydrateBase64DocCache
} = require('../../services/doc_upload_primitives');

function extractIncomeAndProfession(inputStr) {
    if (!inputStr || typeof inputStr !== 'string') return null;
    const clean = inputStr.trim();

    let detectedProf = null;
    if (/விவசாய|farmer|agri|பயிர்த்/i.test(clean)) detectedProf = 'விவசாயம்';
    else if (/கூலி|coolie|daily wage|labour|சுமை|தொழிலாளி/i.test(clean)) detectedProf = 'கூலி வேலை';
    else if (/வியாபார|வணிக|business|கடை|shop/i.test(clean)) detectedProf = 'சிறு வணிகம் / வியாபாரம்';
    else if (/தனியார்|private/i.test(clean)) detectedProf = 'தனியார் வேலை';
    else if (/அரசு|govt/i.test(clean)) detectedProf = 'அரசு ஊழியர்';
    else if (/ஓட்டுநர்|driver|டிரைவர்/i.test(clean)) detectedProf = 'ஓட்டுநர் (Driver)';
    else if (/தையல்|tailor/i.test(clean)) detectedProf = 'தையல் கலைஞர்';
    else if (/கட்டிட|mason|construction/i.test(clean)) detectedProf = 'கட்டிடத் தொழிலாளி';
    else if (/இல்லத்தரசி|குடும்பத் தலைவி|housewife|homemaker/i.test(clean)) detectedProf = 'இல்லத்தரசி / குடும்பத் தலைவி';

    const numMatch = clean.replace(/,/g, '').match(/\b\d{4,7}\b/);
    let detectedMonthly = null;
    let detectedAnnual = null;

    if (numMatch) {
        const val = parseInt(numMatch[0], 10);
        if (val <= 25000) {
            detectedMonthly = val;
            detectedAnnual = val * 12;
        } else {
            detectedAnnual = val;
            detectedMonthly = Math.round(val / 12);
        }
    }

    return {
        profession: detectedProf,
        monthlyIncome: detectedMonthly,
        annualIncome: detectedAnnual
    };
}

function applyDocumentUpload(sess, { canonicalKey, optimizedPath, b64, extractedOther, isIncomeDoc } = {}) {
    if (!sess || !sess.citizenProfile) return false;
    sess.citizenProfile.documents = sess.citizenProfile.documents || {};
    sess.base64Docs = sess.base64Docs || {};
    sess.citizenProfile.base64Docs = sess.citizenProfile.base64Docs || {};

    let handled = false;
    if (extractedOther && extractedOther.isQualityAcceptable !== false) {
        applyExtractedIncomeDetails(sess.citizenProfile, extractedOther);
        if (isIncomeDoc && extractedOther.certificateNumber) {
            sess.citizenProfile.incomeCertNumber = String(extractedOther.certificateNumber).trim();
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
            ocrOpts: { isTnega: isIncomeDoc }
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

module.exports = { extractIncomeAndProfession, applyDocumentUpload, processEditModalUpload };
