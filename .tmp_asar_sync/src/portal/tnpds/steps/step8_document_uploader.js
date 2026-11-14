/**
 * Step 8: Document Uploader & Compliance Verifier
 * 
 * Responsibilities:
 * 1. Delegates to step8_upload_manager for polymorphic button clicking.
 * 2. Connects with document_stitcher for 2-in-1 Aadhaar merging.
 * 3. Enforces leaf-node badge verification.
 */

const { clickDocumentUploadButton, verifyDocumentUploadConfirmation } = require('../step8_upload_manager');
const { stitchDualSidedDocument } = require('../../../services/document_stitcher');

async function uploadSupportingDocument(page, targetFileInput, fileName, helpers = {}) {
    const { onProgress, scanAndBroadcastToasts } = helpers;

    console.log(`📤 [Step 8: Upload] Uploading document: ${fileName}...`);
    if (onProgress) onProgress(`📤 [துணை ஆவணம்] ${fileName} பதிவேற்றப்படுகிறது...`);

    const clicked = await clickDocumentUploadButton(page, targetFileInput);
    const verifyRes = await verifyDocumentUploadConfirmation(page, fileName, scanAndBroadcastToasts);

    return {
        clicked,
        ...verifyRes
    };
}

module.exports = {
    uploadSupportingDocument,
    stitchDualSidedDocument
};
