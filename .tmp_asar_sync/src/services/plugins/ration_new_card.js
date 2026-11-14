// ============================================================================
// eSevaDraft Service Plugin: RATION_NEW_CARD (புதிய ஸ்மார்ட் ரேஷன் கார்டு)
// Complete Family Head & Multi-Member Document Processor
// ============================================================================

const fs = require('fs');
const { produceDualSidedDocument } = require('../document_stitcher');

const RATION_NEW_CARD_PLUGIN = {
    id: 'NEW_RATION_CARD',
    serviceCode: 'TNPDS_NFC',
    nameTamil: 'புதிய ஸ்மார்ட் ரேஷன் கார்டு',
    nameEnglish: 'New Smart Ration Card',
    portal: 'TNPDS (Civil Supplies & Consumer Protection)',
    portalUrl: 'https://www.tnpds.gov.in/pages/newsmartcard',

    // Strict Schema Contracts
    contract: {
        requiresHeadPhoto: true,
        requiresHeadAadhaar: true,
        requiredHeadFields: ['fullNameTam', 'fullNameEng', 'fatherNameTam', 'doorNo', 'streetTam', 'district', 'taluk', 'village', 'pincode', 'headAadhaar'],
        allowedDocuments: ['profilePhoto', 'headAadhaar', 'gasBook', 'residenceProof', 'memberAadhaars']
    },

    /**
     * Sanitizes draft data specifically for New Ration Card.
     */
    sanitizePayload(draftData = {}) {
        const sanitized = JSON.parse(JSON.stringify(draftData));
        return sanitized;
    },

    /**
     * Processes Family Head Aadhaar (crops and merges Front & Back into 2-in-1 A4 PDF).
     */
    async processHeadDocument(frontPath, backPath) {
        if (!frontPath) return null;
        if (backPath && fs.existsSync(frontPath) && fs.existsSync(backPath)) {
            return await produceDualSidedDocument(frontPath, backPath);
        }
        return frontPath;
    }
};

module.exports = RATION_NEW_CARD_PLUGIN;
