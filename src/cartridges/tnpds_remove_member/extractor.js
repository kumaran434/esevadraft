const {
    extractAndNormalizeSmartCard,
    extractAndNormalizeGenericDoc,
    hydrateBase64DocCache
} = require('../../services/doc_upload_primitives');

function extractRemoveMemberProofFields(subServiceData, extracted) {
    if (!subServiceData || !extracted) return;
    if (extracted.fullNameEng && !subServiceData.memberName) subServiceData.memberName = extracted.fullNameEng;
    if (extracted.fullNameTam && !subServiceData.memberNameTam) subServiceData.memberNameTam = extracted.fullNameTam;
}

async function processEditModalUpload({ sess, docType, uploadedFile }) {
    let optimizedPath = uploadedFile.path;
    let extractedData = null;

    if (docType === 'smartCard' || docType === 'smartCardFront' || docType === 'smartCardBack' || docType === 'rationCard' || docType === 'rationCardFront' || docType === 'rationCardBack') {
        ({ optimizedPath, extractedData } = await extractAndNormalizeSmartCard(sess, docType, uploadedFile));
    } else {
        ({ optimizedPath, extractedData } = await extractAndNormalizeGenericDoc(sess, docType, uploadedFile));
        sess.subServiceData = sess.subServiceData || {};
        sess.citizenProfile.subServiceData = sess.citizenProfile.subServiceData || {};
        sess.subServiceData.proofDocPath = optimizedPath;
        sess.citizenProfile.subServiceData.proofDocPath = optimizedPath;
        if (extractedData) {
            extractRemoveMemberProofFields(sess.subServiceData, extractedData);
            extractRemoveMemberProofFields(sess.citizenProfile.subServiceData, extractedData);
        }
    }

    hydrateBase64DocCache(sess, docType, optimizedPath);
    return { optimizedPath, extractedData };
}

module.exports = { extractRemoveMemberProofFields, processEditModalUpload };
