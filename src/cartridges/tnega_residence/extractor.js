const {
    extractAndNormalizePhoto,
    extractAndNormalizeHeadAadhaar,
    extractAndNormalizeSmartCard,
    extractAndNormalizeGenericDoc,
    hydrateBase64DocCache
} = require('../../services/doc_upload_primitives');

function applyResidenceProofFields(profile, compliantPath) {
    if (!profile) return;
    profile.residenceProof = compliantPath;
    if (!profile.documents) profile.documents = {};
    profile.documents.residenceProof = compliantPath;
}

async function processEditModalUpload({ sess, docType, uploadedFile }) {
    let optimizedPath = uploadedFile.path;
    let extractedData = null;

    if (docType === 'headPhoto' || docType === 'profilePhoto') {
        ({ optimizedPath, extractedData } = await extractAndNormalizePhoto(sess, uploadedFile));
    } else if (docType === 'headAadhaar' || docType === 'headAadhaarFront' || docType === 'headAadhaarBack') {
        ({ optimizedPath, extractedData } = await extractAndNormalizeHeadAadhaar(sess, docType, uploadedFile, { updateMembersZero: false }));
    } else if (docType === 'smartCard' || docType === 'smartCardFront' || docType === 'smartCardBack' || docType === 'rationCard' || docType === 'rationCardFront' || docType === 'rationCardBack') {
        ({ optimizedPath, extractedData } = await extractAndNormalizeSmartCard(sess, docType, uploadedFile));
    } else {
        ({ optimizedPath, extractedData } = await extractAndNormalizeGenericDoc(sess, docType, uploadedFile, { ocrOpts: { isTnega: true } }));
        if (docType === 'residenceProof' || docType === 'nativityProof') {
            applyResidenceProofFields(sess.citizenProfile, optimizedPath);
        }
    }

    hydrateBase64DocCache(sess, docType, optimizedPath);
    return { optimizedPath, extractedData };
}

module.exports = { applyResidenceProofFields, processEditModalUpload };
