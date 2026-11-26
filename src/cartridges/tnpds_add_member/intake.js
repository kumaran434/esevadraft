const fs = require('fs');
const path = require('path');
const { handleFlow } = require('./flow');
const { runTnpdsSubserviceTurn } = require('../_tnpds_subservice_utils');

async function handleIntake(ctx, req, res) {
    return runTnpdsSubserviceTurn({
        ctx,
        req,
        res,
        handleFlowFn: handleFlow,
        onUploadedFn: async (sess, uploadedFile) => {
            sess.tempUploads = sess.tempUploads || {};
            if (sess.intakeState === 'RATION_ADD_MEMBER_ADULT_RELATION') {
                sess.tempUploads.surrenderProof = uploadedFile.path;
            } else {
                sess.tempUploads.memberAadhaar = sess.subServiceData?.docPath || uploadedFile.path;
            }
            // Non-destructive Master Profile preservation: NEVER delete headPhotoPath or headAadhaar from citizenProfile!
        },
        afterFlowFn: async (sess) => {
            if (sess.subServiceData?.docPath) {
                sess.tempUploads = sess.tempUploads || {};
                sess.tempUploads.memberAadhaar = sess.subServiceData.docPath;
                sess.citizenProfile = sess.citizenProfile || {};
                sess.citizenProfile.documents = sess.citizenProfile.documents || {};
                sess.citizenProfile.documents.memberAadhaar = sess.subServiceData.docPath;
                sess.base64Docs = sess.base64Docs || {};
                sess.citizenProfile.base64Docs = sess.citizenProfile.base64Docs || {};
                if (fs.existsSync(sess.subServiceData.docPath)) {
                    try {
                        const b64 = fs.readFileSync(sess.subServiceData.docPath).toString('base64');
                        const bName = path.basename(sess.subServiceData.docPath);
                        sess.base64Docs.memberAadhaarBase64 = b64;
                        sess.base64Docs.memberAadhaarName = bName;
                        sess.base64Docs.memberAadhaarsBase64 = [{ name: bName, base64: b64 }];
                        sess.citizenProfile.base64Docs.memberAadhaarBase64 = b64;
                        sess.citizenProfile.base64Docs.memberAadhaarName = bName;
                        sess.citizenProfile.base64Docs.memberAadhaarsBase64 = [{ name: bName, base64: b64 }];
                    } catch (_) {}
                }
            }

            if (sess.subServiceData) {
                sess.citizenProfile = sess.citizenProfile || {};
                sess.citizenProfile.tempMember = {
                    nameTam: sess.subServiceData.memberNameTam || sess.subServiceData.memberName,
                    nameEng: sess.subServiceData.memberNameEng || '',
                    dob: sess.subServiceData.dob || '',
                    aadhaarNo: sess.subServiceData.aadhaarNo || '',
                    gender: sess.subServiceData.gender || '',
                    genderTam: sess.subServiceData.genderTam || '',
                    relationshipTam: sess.subServiceData.relationshipTam || '',
                    relationshipEng: sess.subServiceData.relationshipEng || '',
                    docPath: sess.subServiceData.docPath || ''
                };
            }
        }
    });
}

module.exports = { handleIntake };
