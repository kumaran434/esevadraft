const fs = require('fs');
const {
    extractAndNormalizePhoto,
    extractAndNormalizeHeadAadhaar,
    extractAndNormalizeSmartCard,
    extractAndNormalizeGenericDoc,
    hydrateBase64DocCache
} = require('./doc_upload_primitives');

/**
 * Pure Edit-Modal Document Upload Switchboard.
 * Zero service-specific branching: resolves the active service Cartridge and
 * delegates document validation, extraction, normalization and saving strictly
 * to that Cartridge's own `extractor.processEditModalUpload`.
 */
async function processUploadedDocument(sess, docType, uploadedFile, memberIndex = 0, targetMobile = '', intendedProofType = '') {
    if (!sess.citizenProfile) sess.citizenProfile = {};
    if (!sess.citizenProfile.documents) sess.citizenProfile.documents = {};
    if (!sess.tempUploads) sess.tempUploads = {};

    const { resolveCartridge, getCartridgeById } = require('../cartridges');
    let activeCart = resolveCartridge(sess);
    if ((!activeCart || activeCart.id !== 'TNPDS_NEW_CARD') && memberIndex >= 1 && docType.startsWith('memberAadhaar')) {
        activeCart = getCartridgeById('TNPDS_NEW_CARD') || activeCart;
    }

    let optimizedPath = uploadedFile.path;
    let extractedData = null;

    if (activeCart && activeCart.extractor && typeof activeCart.extractor.processEditModalUpload === 'function') {
        ({ optimizedPath, extractedData } = await activeCart.extractor.processEditModalUpload({
            sess,
            docType,
            uploadedFile,
            memberIndex,
            targetMobile,
            intendedProofType
        }));
    } else {
        // Pure pre-service Master Profile fallback (strictly no subServiceData / ration member rules)
        if (docType === 'headPhoto' || docType === 'profilePhoto') {
            ({ optimizedPath, extractedData } = await extractAndNormalizePhoto(sess, uploadedFile));
        } else if (docType === 'headAadhaar' || docType === 'headAadhaarFront' || docType === 'headAadhaarBack') {
            ({ optimizedPath, extractedData } = await extractAndNormalizeHeadAadhaar(sess, docType, uploadedFile, { updateMembersZero: false }));
        } else if (docType === 'smartCard' || docType === 'smartCardFront' || docType === 'smartCardBack' || docType === 'rationCard' || docType === 'rationCardFront' || docType === 'rationCardBack') {
            ({ optimizedPath, extractedData } = await extractAndNormalizeSmartCard(sess, docType, uploadedFile));
        } else {
            ({ optimizedPath, extractedData } = await extractAndNormalizeGenericDoc(sess, docType, uploadedFile));
        }
        hydrateBase64DocCache(sess, docType, optimizedPath);
    }

    let fileSizeKB = null;
    try {
        if (fs.existsSync(optimizedPath)) {
            fileSizeKB = Number((fs.statSync(optimizedPath).size / 1024).toFixed(1));
        }
    } catch (_) {}

    return { optimizedPath, extractedData, fileSizeKB };
}

module.exports = {
    processUploadedDocument
};
