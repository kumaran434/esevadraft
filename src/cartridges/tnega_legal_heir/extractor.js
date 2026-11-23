const {
    extractAndNormalizePhoto,
    extractAndNormalizeHeadAadhaar,
    extractAndNormalizeSmartCard,
    extractAndNormalizeGenericDoc,
    hydrateBase64DocCache
} = require('../../services/doc_upload_primitives');

function extractDeceasedDeathCertFields(profile, extracted) {
    if (!profile || !extracted) return;
    if (extracted.fullNameEng && !profile.deceasedNameEng) profile.deceasedNameEng = extracted.fullNameEng;
    if (extracted.fullNameTam && !profile.deceasedNameTam) profile.deceasedNameTam = extracted.fullNameTam;
    if (extracted.dateOfDeath && !profile.dateOfDeath) profile.dateOfDeath = extracted.dateOfDeath;
    if (extracted.deathCertificateNo && !profile.deathCertificateNo) profile.deathCertificateNo = extracted.deathCertificateNo;
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
        if (docType === 'deathCertificate' && extractedData) {
            extractDeceasedDeathCertFields(sess.citizenProfile, extractedData);
        }
    }

    hydrateBase64DocCache(sess, docType, optimizedPath);
    return { optimizedPath, extractedData };
}

module.exports = { extractDeceasedDeathCertFields, processEditModalUpload };
