const {
    extractAndNormalizePhoto,
    extractAndNormalizeHeadAadhaar,
    extractAndNormalizeSmartCard,
    extractAndNormalizeGenericDoc,
    hydrateBase64DocCache
} = require('../../services/doc_upload_primitives');

function extractWidowDeathAndAadhaarFields(profile, ext, kind) {
    if (!profile || !ext) return;
    if (kind === 'deathCertificate') {
        if (ext.fullNameEng && !profile.spouseNameEng) profile.spouseNameEng = ext.fullNameEng;
        if (ext.fullNameTam && !profile.spouseNameTam) profile.spouseNameTam = ext.fullNameTam;
        if (ext.dateOfDeath && !profile.dateOfDeath) profile.dateOfDeath = ext.dateOfDeath;
        if (ext.deathCertificateNo && !profile.deathCertificateNo) profile.deathCertificateNo = ext.deathCertificateNo;
    } else if (kind === 'aadhaar') {
        if (ext.fullNameEng && !profile.fullNameEng) profile.fullNameEng = ext.fullNameEng;
        if (ext.fullNameTam && !profile.fullNameTam) profile.fullNameTam = ext.fullNameTam;
        if (ext.aadhaarNumber && !profile.headAadhaar) profile.headAadhaar = ext.aadhaarNumber;
        if (ext.doorNo && !profile.doorNo) profile.doorNo = ext.doorNo;
        if (ext.streetEng && !profile.streetEng) profile.streetEng = ext.streetEng;
        if (ext.streetTam && !profile.streetTam) profile.streetTam = ext.streetTam;
        if (ext.district && !profile.district) profile.district = ext.district;
        if (ext.taluk && !profile.taluk) profile.taluk = ext.taluk;
        if (ext.village && !profile.village) profile.village = ext.village;
        if (ext.pincode && !profile.pincode) profile.pincode = ext.pincode;
    }
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
            extractWidowDeathAndAadhaarFields(sess.citizenProfile, extractedData, 'deathCertificate');
        }
    }

    hydrateBase64DocCache(sess, docType, optimizedPath);
    return { optimizedPath, extractedData };
}

module.exports = { extractWidowDeathAndAadhaarFields, processEditModalUpload };
