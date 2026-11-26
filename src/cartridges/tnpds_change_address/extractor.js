const {
    extractAndNormalizeSmartCard,
    extractAndNormalizeGenericDoc,
    hydrateBase64DocCache
} = require('../../services/doc_upload_primitives');

function extractNewAddressProofFields(subServiceData, extracted) {
    if (!subServiceData || !extracted) return;
    if (extracted.doorNo && !subServiceData.doorNo) subServiceData.doorNo = extracted.doorNo;
    if (extracted.streetEng && !subServiceData.streetEng) subServiceData.streetEng = extracted.streetEng;
    if (extracted.streetTam && !subServiceData.streetTam) subServiceData.streetTam = extracted.streetTam;
    if (extracted.district && !subServiceData.district) subServiceData.district = extracted.district;
    if (extracted.taluk && !subServiceData.taluk) subServiceData.taluk = extracted.taluk;
    if (extracted.village && !subServiceData.village) subServiceData.village = extracted.village;
    if (extracted.pincode && !subServiceData.pincode) subServiceData.pincode = extracted.pincode;
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
        sess.subServiceData.addressDocPath = optimizedPath;
        sess.subServiceData.addressProofDocPath = optimizedPath;
        sess.citizenProfile.subServiceData.addressDocPath = optimizedPath;
        sess.citizenProfile.subServiceData.addressProofDocPath = optimizedPath;
        if (extractedData) {
            extractNewAddressProofFields(sess.subServiceData, extractedData);
            extractNewAddressProofFields(sess.citizenProfile.subServiceData, extractedData);
        }
    }

    hydrateBase64DocCache(sess, docType, optimizedPath);
    return { optimizedPath, extractedData };
}

module.exports = { extractNewAddressProofFields, processEditModalUpload };
