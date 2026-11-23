const {
    extractAndNormalizeHeadAadhaar,
    extractAndNormalizeSmartCard,
    extractAndNormalizeGenericDoc,
    hydrateBase64DocCache
} = require('../../services/doc_upload_primitives');

function extractMobileNumber(text) {
    const clean = String(text || '').replace(/\D/g, '').slice(-10);
    return /^[6-9]\d{9}$/.test(clean) ? clean : null;
}

async function processEditModalUpload({ sess, docType, uploadedFile }) {
    let optimizedPath = uploadedFile.path;
    let extractedData = null;

    if (docType === 'smartCard' || docType === 'smartCardFront' || docType === 'smartCardBack' || docType === 'rationCard' || docType === 'rationCardFront' || docType === 'rationCardBack') {
        ({ optimizedPath, extractedData } = await extractAndNormalizeSmartCard(sess, docType, uploadedFile));
    } else if (docType === 'headAadhaar' || docType === 'headAadhaarFront' || docType === 'headAadhaarBack') {
        ({ optimizedPath, extractedData } = await extractAndNormalizeHeadAadhaar(sess, docType, uploadedFile, { updateMembersZero: false }));
    } else {
        ({ optimizedPath, extractedData } = await extractAndNormalizeGenericDoc(sess, docType, uploadedFile));
    }

    hydrateBase64DocCache(sess, docType, optimizedPath);
    return { optimizedPath, extractedData };
}

module.exports = { extractMobileNumber, processEditModalUpload };
