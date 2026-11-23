const fs = require('fs');
const { applyExtractedAadhaarRelationsAndDob } = require('../../services/profile_helpers');
const { inspectAndExtractDocument } = require('../../../ai_document_extractor');
const { produceCompliantDocument, produceDualSidedDocument } = require('../../../photo_studio');
const {
    extractAndNormalizeSmartCard,
    extractAndNormalizeGenericDoc,
    hydrateBase64DocCache
} = require('../../services/doc_upload_primitives');

function applyMemberDocFields(target, extracted) {
    if (!target || !extracted) return;
    applyExtractedAadhaarRelationsAndDob(target, extracted);
}

async function processEditModalUpload({ sess, docType, uploadedFile, memberIndex = 0 }) {
    let optimizedPath = uploadedFile.path;
    let extractedData = null;

    if (docType === 'smartCard' || docType === 'smartCardFront' || docType === 'smartCardBack' || docType === 'rationCard' || docType === 'rationCardFront' || docType === 'rationCardBack') {
        ({ optimizedPath, extractedData } = await extractAndNormalizeSmartCard(sess, docType, uploadedFile));
    } else if (docType === 'memberAadhaar' || docType === 'memberAadhaarFront' || docType === 'memberAadhaarBack') {
        const isBackSide = (docType === 'memberAadhaarBack');
        let extractedMember = null;
        try {
            extractedMember = await inspectAndExtractDocument(uploadedFile.path, { skipFaceExtraction: true, isAddMember: true });
        } catch (_) {}

        try {
            optimizedPath = await produceCompliantDocument(uploadedFile.path, {
                boundingBox: extractedMember?.documentBoundingBox
            });
        } catch (_) {
            optimizedPath = uploadedFile.path;
        }

        sess.tempUploads = sess.tempUploads || {};
        sess.citizenProfile.documents = sess.citizenProfile.documents || {};
        const isBirthCertDoc = extractedMember?.documentType === 'BIRTH_CERTIFICATE';

        if (isBackSide) {
            sess.tempUploads.memberAadhaarBack = optimizedPath;
            sess.tempUploads[`memberAadhaarBack_${memberIndex}`] = optimizedPath;
        } else {
            sess.tempUploads.memberAadhaarFront = optimizedPath;
            sess.tempUploads[`memberAadhaarFront_${memberIndex}`] = optimizedPath;
            if (isBirthCertDoc || (uploadedFile.path || '').toLowerCase().endsWith('.pdf')) {
                delete sess.tempUploads.memberAadhaarBack;
                delete sess.tempUploads[`memberAadhaarBack_${memberIndex}`];
            }
        }

        const mFront = sess.tempUploads.memberAadhaarFront || (!isBackSide ? optimizedPath : (sess.subServiceData?.docPath || null));
        const mBack = sess.tempUploads.memberAadhaarBack || (isBackSide ? optimizedPath : null);
        if (!isBirthCertDoc && mFront && mBack && mFront !== mBack && fs.existsSync(mFront) && fs.existsSync(mBack)) {
            try {
                const mergedPdf = await produceDualSidedDocument(mFront, mBack);
                if (mergedPdf && fs.existsSync(mergedPdf)) optimizedPath = mergedPdf;
            } catch (_) {}
        }

        sess.tempUploads.memberAadhaar = optimizedPath;
        sess.citizenProfile.documents.memberAadhaar = optimizedPath;
        sess.citizenProfile.documents[`memberDoc_${memberIndex}`] = optimizedPath;

        if (extractedMember && extractedMember.isQualityAcceptable !== false) {
            extractedData = extractedMember;
            sess.citizenProfile.subServiceData = {
                ...(sess.citizenProfile.subServiceData || {}),
                memberNameTam: extractedMember.fullNameTam || sess.citizenProfile.subServiceData?.memberNameTam || '',
                memberNameEng: extractedMember.fullNameEng || sess.citizenProfile.subServiceData?.memberNameEng || '',
                memberName: extractedMember.fullNameEng || extractedMember.fullNameTam || sess.citizenProfile.subServiceData?.memberName || '',
                fatherNameTam: extractedMember.fatherNameTam || sess.citizenProfile.subServiceData?.fatherNameTam || '',
                fatherNameEng: extractedMember.fatherNameEng || sess.citizenProfile.subServiceData?.fatherNameEng || '',
                dob: extractedMember.dob || sess.citizenProfile.subServiceData?.dob || '',
                gender: extractedMember.gender || sess.citizenProfile.subServiceData?.gender || 'Male',
                genderTam: extractedMember.genderTam || (extractedMember.gender === 'Female' ? 'பெண்' : 'ஆண்'),
                aadhaarNo: isBirthCertDoc ? '' : (extractedMember.aadhaarNumber ? String(extractedMember.aadhaarNumber).replace(/\s+/g, '') : (sess.citizenProfile.subServiceData?.aadhaarNo || '')),
                docPath: optimizedPath,
                isChild: isBirthCertDoc || Boolean(sess.citizenProfile.subServiceData?.isChild)
            };
            sess.subServiceData = sess.citizenProfile.subServiceData;
        } else {
            sess.citizenProfile.subServiceData = { ...(sess.citizenProfile.subServiceData || {}), docPath: optimizedPath };
            sess.subServiceData = sess.citizenProfile.subServiceData;
        }

        // Strict isolation: never let Add Member retain stale Head Photo/Aadhaar
        delete sess.citizenProfile.headPhotoPath;
        delete sess.tempUploads.profilePhoto;
        delete sess.citizenProfile.documents.profilePhoto;
    } else {
        ({ optimizedPath, extractedData } = await extractAndNormalizeGenericDoc(sess, docType, uploadedFile));
        if (docType === 'birthCertificate' || docType === 'surrenderProof') {
            sess.citizenProfile.subServiceData = {
                ...(sess.citizenProfile.subServiceData || {}),
                proofDocPath: optimizedPath,
                ...(docType === 'birthCertificate' ? { birthDocPath: optimizedPath, isChild: true } : { surrenderDocPath: optimizedPath })
            };
            sess.subServiceData = sess.citizenProfile.subServiceData;
        }
    }

    const { canonicalKey, b64, bName } = hydrateBase64DocCache(sess, docType, optimizedPath);
    if (b64 && canonicalKey === 'memberAadhaar') {
        sess.base64Docs.memberAadhaarsBase64 = [{ name: bName, base64: b64 }];
        sess.citizenProfile.base64Docs.memberAadhaarsBase64 = [{ name: bName, base64: b64 }];
    }

    return { optimizedPath, extractedData };
}

module.exports = { applyMemberDocFields, processEditModalUpload };
