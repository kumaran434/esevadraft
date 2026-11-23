const {
    extractAndNormalizePhoto,
    extractAndNormalizeHeadAadhaar,
    extractAndNormalizeSmartCard,
    extractAndNormalizeGenericDoc,
    hydrateBase64DocCache
} = require('../../services/doc_upload_primitives');

function extractCommunityProofFields(profile, extracted) {
    if (!profile || !extracted) return '';
    if (extracted.caste || extracted.subCaste) {
        const c = extracted.caste || extracted.subCaste;
        profile.caste = c;
        if (extracted.community) profile.community = extracted.community;
        profile.fatherCaste = extracted.fatherCaste || c;
        profile.motherCaste = extracted.motherCaste || c;
        profile.requestedCaste = c;
        profile.parentCasteConfirmed = true;
        return `\n\n📄 **சான்றிதழிலிருந்து விவரங்கள் தானாகப் பெறப்பட்டன:**\n• வகுப்பு: **${profile.community}** | சாதி: **${c}**\n• தந்தை சாதி: **${profile.fatherCaste}** | தாய் சாதி: **${profile.motherCaste}** ✅`;
    }
    return '';
}

function applyDocumentUpload(sess, { canonicalKey, optimizedPath, b64, bName, extractedOther, isCommunityDoc } = {}) {
    if (!sess || !sess.citizenProfile) return false;
    sess.citizenProfile.documents = sess.citizenProfile.documents || {};
    sess.base64Docs = sess.base64Docs || {};
    sess.citizenProfile.base64Docs = sess.citizenProfile.base64Docs || {};

    let handled = false;
    if (extractedOther && extractedOther.isQualityAcceptable !== false && isCommunityDoc) {
        extractCommunityProofFields(sess.citizenProfile, extractedOther);
        if (extractedOther.certificateNumber) {
            sess.citizenProfile.communityCertNumber = String(extractedOther.certificateNumber).trim();
        }
        handled = true;
    }

    if (canonicalKey === 'communityProof' || canonicalKey === 'familyCommunityProof' || canonicalKey === 'communityCertificate') {
        if (optimizedPath) {
            sess.citizenProfile.communityProof = optimizedPath;
            sess.citizenProfile.communityCertificate = optimizedPath;
            sess.citizenProfile.communityCertificatePath = optimizedPath;
            sess.citizenProfile.familyCommunityProofPath = optimizedPath;
            sess.citizenProfile.documents.communityProof = optimizedPath;
            sess.citizenProfile.documents.communityCertificate = optimizedPath;
        }
        if (b64) {
            sess.base64Docs.communityProofBase64 = b64;
            sess.base64Docs.communityProofName = bName;
            sess.citizenProfile.base64Docs.communityProofBase64 = b64;
            sess.citizenProfile.base64Docs.communityProofName = bName;
        }
        sess.citizenProfile.communityProofSkipped = false;
        handled = true;
    }
    return handled;
}

async function processEditModalUpload({ sess, docType, uploadedFile }) {
    let optimizedPath = uploadedFile.path;
    let extractedData = null;
    const isCommunityDoc = ['communityProof', 'communityCertificate', 'familyCommunityProof'].includes(docType);

    if (docType === 'headPhoto' || docType === 'profilePhoto') {
        ({ optimizedPath, extractedData } = await extractAndNormalizePhoto(sess, uploadedFile));
    } else if (docType === 'headAadhaar' || docType === 'headAadhaarFront' || docType === 'headAadhaarBack') {
        ({ optimizedPath, extractedData } = await extractAndNormalizeHeadAadhaar(sess, docType, uploadedFile, { updateMembersZero: false }));
    } else if (docType === 'smartCard' || docType === 'smartCardFront' || docType === 'smartCardBack' || docType === 'rationCard' || docType === 'rationCardFront' || docType === 'rationCardBack') {
        ({ optimizedPath, extractedData } = await extractAndNormalizeSmartCard(sess, docType, uploadedFile));
    } else {
        ({ optimizedPath, extractedData } = await extractAndNormalizeGenericDoc(sess, docType, uploadedFile, {
            validateAs: isCommunityDoc ? 'communityProof' : null,
            ocrOpts: { isTnega: isCommunityDoc }
        }));
    }

    const { canonicalKey, b64, bName } = hydrateBase64DocCache(sess, docType, optimizedPath);
    applyDocumentUpload(sess, {
        docType,
        canonicalKey,
        optimizedPath,
        b64,
        bName,
        extractedOther: extractedData,
        isCommunityDoc: isCommunityDoc || extractedData?.documentType === 'COMMUNITY_CERTIFICATE'
    });
    return { optimizedPath, extractedData };
}

module.exports = { extractCommunityProofFields, applyDocumentUpload, processEditModalUpload };
