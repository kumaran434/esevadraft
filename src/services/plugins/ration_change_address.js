// ============================================================================
// eSevaDraft Service Plugin: RATION_CHANGE_ADDRESS (குடும்ப அட்டை முகவரி மாற்றம்)
// Strict Address Proof & Zero-Head-Photo Invariant
// ============================================================================

const fs = require('fs');
const { produceDualSidedDocument } = require('../document_stitcher');

const RATION_CHANGE_ADDRESS_PLUGIN = {
    id: 'CHANGE_ADDRESS',
    serviceCode: 'TNPDS_CHG_ADDR',
    nameTamil: 'குடும்ப அட்டை முகவரி மாற்றம்',
    nameEnglish: 'Ration Card Address Change',
    portal: 'TNPDS (Civil Supplies & Consumer Protection)',
    portalUrl: 'https://www.tnpds.gov.in',

    contract: {
        requiresHeadPhoto: false,
        requiresHeadAadhaar: false,
        requiredFields: ['newDoorNo', 'newStreet', 'newDistrict', 'newTaluk', 'newVillage', 'newPincode'],
        allowedDocuments: ['newAddressProof'],
        forbiddenDocuments: ['profilePhoto', 'headPhotoPath']
    },

    sanitizePayload(draftData = {}) {
        const sanitized = JSON.parse(JSON.stringify(draftData));
        const prof = sanitized.citizenProfile || {};
        const docs = sanitized.documents || {};

        delete prof.headPhotoPath;
        delete docs.profilePhoto;
        if (prof.documents) delete prof.documents.profilePhoto;

        sanitized.citizenProfile = prof;
        sanitized.documents = docs;
        return sanitized;
    },

    async processAddressProof(frontPath, backPath) {
        if (!frontPath) return null;
        if (backPath && fs.existsSync(frontPath) && fs.existsSync(backPath)) {
            return await produceDualSidedDocument(frontPath, backPath);
        }
        return frontPath;
    }
};

module.exports = RATION_CHANGE_ADDRESS_PLUGIN;
