const {
    extractAndNormalizeSmartCard,
    extractAndNormalizeGenericDoc,
    hydrateBase64DocCache
} = require('../../services/doc_upload_primitives');

function extractNewAddressProofFields(subServiceData, extracted, { overwrite = false } = {}) {
    if (!subServiceData || !extracted) return;
    const setField = (key, val) => {
        if (!val) return;
        if (overwrite || !subServiceData[key]) subServiceData[key] = val;
    };
    setField('doorNo', extracted.doorNo);
    setField('newDoorNo', extracted.doorNo);
    setField('streetEng', extracted.streetEng);
    setField('newStreet', extracted.streetEng || extracted.streetTam);
    setField('streetTam', extracted.streetTam);
    setField('areaEng', extracted.areaEng);
    setField('areaTam', extracted.areaTam);
    setField('district', extracted.district);
    setField('newDistrict', extracted.district);
    setField('districtTam', extracted.districtTam);
    setField('taluk', extracted.taluk);
    setField('newTaluk', extracted.taluk);
    setField('talukTam', extracted.talukTam);
    setField('village', extracted.village);
    setField('newVillage', extracted.village);
    setField('villageTam', extracted.villageTam);
    setField('pincode', extracted.pincode);
    setField('newPincode', extracted.pincode);

    const dt = String(extracted.documentType || '').toUpperCase();
    if (dt.includes('GAS')) setField('proofType', 'எரிவாயு நுகர்வோர் அட்டை (Gas Bill)');
    else if (dt.includes('EB')) setField('proofType', 'மின்சார ரசீது (EB Bill)');
    else if (dt.includes('TAX')) setField('proofType', 'சொத்து வரி ரசீது (Property Tax)');
    else if (dt.includes('RENT')) setField('proofType', 'வாடகை ஒப்பந்தம் (Rental Agreement)');
    else if (dt.includes('AADHAAR')) setField('proofType', 'ஆதார் அட்டை (Aadhaar)');

    if (subServiceData.doorNo && (subServiceData.streetTam || subServiceData.streetEng)) {
        subServiceData.isNewAddressEntered = true;
    }
}

async function processEditModalUpload({ sess, docType, uploadedFile }) {
    let optimizedPath = uploadedFile.path;
    let extractedData = null;

    if (docType === 'smartCard' || docType === 'smartCardFront' || docType === 'smartCardBack' || docType === 'rationCard' || docType === 'rationCardFront' || docType === 'rationCardBack') {
        ({ optimizedPath, extractedData } = await extractAndNormalizeSmartCard(sess, docType, uploadedFile));
    } else {
        ({ optimizedPath, extractedData } = await extractAndNormalizeGenericDoc(sess, docType, uploadedFile, {
            ocrOpts: { subService: 'CHANGE_ADDRESS' }
        }));
        sess.subServiceData = sess.subServiceData || {};
        sess.citizenProfile.subServiceData = sess.citizenProfile.subServiceData || {};
        sess.subServiceData.addressDocPath = optimizedPath;
        sess.subServiceData.addressProofDocPath = optimizedPath;
        sess.subServiceData.docPath = optimizedPath;
        sess.citizenProfile.subServiceData.addressDocPath = optimizedPath;
        sess.citizenProfile.subServiceData.addressProofDocPath = optimizedPath;
        sess.citizenProfile.subServiceData.docPath = optimizedPath;
        if (extractedData) {
            extractNewAddressProofFields(sess.subServiceData, extractedData, { overwrite: true });
            extractNewAddressProofFields(sess.citizenProfile.subServiceData, extractedData, { overwrite: true });
        }
    }

    hydrateBase64DocCache(sess, docType, optimizedPath);
    return { optimizedPath, extractedData };
}

module.exports = { extractNewAddressProofFields, processEditModalUpload };
