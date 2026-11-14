// ============================================================================
// eSevaDraft Service Plugin: RATION_ADD_MEMBER (குடும்ப உறுப்பினர் சேர்க்கை)
// Zero-Head-Photo Invariant & Dedicated Dual-Sided Member Document Processor
// ============================================================================

const path = require('path');
const fs = require('fs');
const { produceDualSidedDocument } = require('../document_stitcher');

const RATION_ADD_MEMBER_PLUGIN = {
    id: 'ADD_MEMBER',
    serviceCode: 'TNPDS_ADD_MEM',
    nameTamil: 'குடும்ப உறுப்பினர் சேர்க்கை',
    nameEnglish: 'Add Family Member',
    portal: 'TNPDS (Tamil Nadu Public Distribution System)',
    portalUrl: 'https://www.tnpds.gov.in',

    // Strict Schema Contracts
    contract: {
        requiresHeadPhoto: false,
        requiresHeadAadhaar: false,
        requiredMemberFields: ['nameTam', 'nameEng', 'dob', 'gender', 'relationship', 'aadhaarNo'],
        allowedDocuments: ['memberAadhaar', 'birthCertificate', 'surrenderProof'],
        forbiddenDocuments: ['profilePhoto', 'headPhotoPath', 'headAadhaar']
    },

    /**
     * Sanitizes draft data specifically for Add Member service.
     * Guarantees that family head photo and head Aadhaar are completely eradicated.
     */
    sanitizePayload(draftData = {}) {
        const sanitized = JSON.parse(JSON.stringify(draftData));
        const prof = sanitized.citizenProfile || {};
        const docs = sanitized.documents || {};

        // 1. Eradicate Head Photo
        delete prof.headPhotoPath;
        delete docs.profilePhoto;
        if (prof.documents) delete prof.documents.profilePhoto;
        if (sanitized.base64Docs) {
            delete sanitized.base64Docs.profilePhotoBase64;
            delete sanitized.base64Docs.profilePhotoName;
        }
        if (prof.base64Docs) {
            delete prof.base64Docs.profilePhotoBase64;
            delete prof.base64Docs.profilePhotoName;
        }
        if (sanitized.tempUploads) {
            delete sanitized.tempUploads.profilePhoto;
        }

        // 2. Eradicate Head Aadhaar from member payload
        delete docs.headAadhaar;
        delete docs.headAadhaarFront;
        delete docs.headAadhaarBack;
        if (prof.documents) {
            delete prof.documents.headAadhaar;
            delete prof.documents.headAadhaarFront;
            delete prof.documents.headAadhaarBack;
        }

        // 3. Ensure Member Document is set
        const subData = prof.subServiceData || {};
        if (!docs.memberAadhaar && subData.docPath) {
            docs.memberAadhaar = subData.docPath;
        }

        sanitized.citizenProfile = prof;
        sanitized.documents = docs;
        return sanitized;
    },

    /**
     * Processes member Aadhaar cards (auto-crops and merges Front & Back into 2-in-1 A4 PDF).
     */
    async processMemberDocument(frontPath, backPath) {
        if (!frontPath) return null;
        if (backPath && fs.existsSync(frontPath) && fs.existsSync(backPath)) {
            return await produceDualSidedDocument(frontPath, backPath);
        }
        return frontPath;
    }
};

module.exports = RATION_ADD_MEMBER_PLUGIN;
