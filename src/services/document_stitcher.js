/**
 * eSevaDraft Document Stitcher & Processing Service (Modular Architecture)
 * 
 * Handles:
 * 1. Automatic 2-in-1 Front + Back Document Merging (Aadhaar, Voter ID, Ration Card, etc.).
 * 2. Strict Government Portal Size Compliance (< 240 KB for TNPDS / TNeGA).
 * 3. High Clarity & Needle-Sharp OCR restoration.
 * 4. Draft and Base64 state synchronization.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { 
    produceCompliantPassportPhoto, 
    produceCompliantDocument, 
    produceDualSidedDocument,
    cropDocumentToExactBoundary
} = require('../../photo_studio');

/**
 * Resolves front and back file paths from draft / citizenProfile universally for ANY document type
 * (Aadhaar, Ration Card, Smart Card, Voter ID, PAN, Driving License, Residence Proof, Gas Book, or generic <docType>Front/<docType>Back).
 */
function resolveDualSidedPaths(draft, docType) {
    if (!draft || !docType) return { front: null, back: null };

    const docs = draft.documents || {};
    const cpDocs = (draft.citizenProfile && draft.citizenProfile.documents) || {};
    const tempUploads = draft.tempUploads || {};
    const mergedDocs = { ...cpDocs, ...tempUploads, ...docs };

    let front = null;
    let back = null;

    if (docType === 'aadhaar' || docType === 'headAadhaar') {
        front = mergedDocs.headAadhaarFront || mergedDocs.aadhaarFront || mergedDocs.headAadhaar || mergedDocs.aadhaar || null;
        back = mergedDocs.headAadhaarBack || mergedDocs.aadhaarBack || null;
    } else if (docType === 'memberAadhaar') {
        front = mergedDocs.memberAadhaarFront || mergedDocs.memberAadhaar || null;
        back = mergedDocs.memberAadhaarBack || null;
    } else if (docType === 'rationCard' || docType === 'smartCard') {
        front = mergedDocs.rationCardFront || mergedDocs.smartCardFront || mergedDocs.rationCard || mergedDocs.smartCard || null;
        back = mergedDocs.rationCardBack || mergedDocs.smartCardBack || null;
    } else if (docType === 'residenceProof' || docType === 'gasBook') {
        front = mergedDocs[`${docType}Front`] || mergedDocs.residenceProofFront || mergedDocs.gasBookFront || mergedDocs[docType] || mergedDocs.residenceProof || mergedDocs.gasBook || null;
        back = mergedDocs[`${docType}Back`] || mergedDocs.residenceProofBack || mergedDocs.gasBookBack || null;
    } else {
        // Universal support for ANY current or future document type (<docType>Front + <docType>Back)
        front = mergedDocs[`${docType}Front`] || mergedDocs[docType] || null;
        back = mergedDocs[`${docType}Back`] || null;
    }

    return { front, back };
}

/**
 * Merges front and back documents into an official 2-in-1 government PDF
 * after cropping each side to its exact document boundary.
 * Updates draft documents and base64Docs cache in place.
 */
async function stitchDualSidedDocument(draft, docType) {
    if (!draft) return null;

    const { front, back } = resolveDualSidedPaths(draft, docType);
    if (!front || !fs.existsSync(front)) return null;

    // If back side exists and front is not already merged PDF:
    if (back && fs.existsSync(back) && !front.toLowerCase().endsWith('.pdf')) {
        console.log(`📑 [DocumentStitcher] Auto-cropping & Merging Front + Back for ${docType}...`);
        const mergedPdf = await produceDualSidedDocument(front, back);
        if (mergedPdf && fs.existsSync(mergedPdf)) {
            const mB64 = fs.readFileSync(mergedPdf).toString('base64');
            const mName = path.basename(mergedPdf);

            // Synchronize with draft
            draft.documents = draft.documents || {};
            draft.documents[docType] = mergedPdf;

            if (draft.citizenProfile) {
                draft.citizenProfile.documents = draft.citizenProfile.documents || {};
                draft.citizenProfile.documents[docType] = mergedPdf;
            }

            draft.base64Docs = draft.base64Docs || {};
            draft.base64Docs[`${docType}Base64`] = mB64;
            draft.base64Docs[`${docType}Name`] = mName;

            console.log(`✅ [DocumentStitcher] Successfully cropped & merged ${docType} into 2-in-1 PDF: ${mName}`);
            return mergedPdf;
        }
    }

    // Single-sided compliance fallback (also auto-crops to exact boundary)
    return await produceCompliantDocument(front);
}

module.exports = {
    resolveDualSidedPaths,
    stitchDualSidedDocument,
    produceCompliantPassportPhoto,
    produceCompliantDocument,
    produceDualSidedDocument,
    cropDocumentToExactBoundary
};
