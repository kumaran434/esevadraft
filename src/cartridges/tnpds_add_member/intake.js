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
            if (sess.intakeState === 'RATION_ADD_MEMBER_CHILD_RELATION' || sess.subServiceData?.isChild) {
                sess.tempUploads.birthCertificate = uploadedFile.path;
            } else if (sess.intakeState === 'RATION_ADD_MEMBER_RELATION' || sess.intakeState === 'RATION_ADD_MEMBER_ADULT_SURRENDER' || sess.intakeState === 'RATION_ADD_MEMBER_SON_RELATION') {
                sess.tempUploads.memberAadhaar = sess.subServiceData?.docPath || uploadedFile.path;
            } else if (sess.intakeState === 'RATION_ADD_MEMBER_ADULT_RELATION') {
                sess.tempUploads.surrenderProof = uploadedFile.path;
            }

            // Strictly isolate Add Member slot from Head Photo/Head Aadhaar pollution
            if (sess.citizenProfile) {
                delete sess.citizenProfile.headPhotoPath;
                delete sess.citizenProfile.headAadhaarDocPath;
                if (sess.citizenProfile.documents) {
                    delete sess.citizenProfile.documents.profilePhoto;
                    delete sess.citizenProfile.documents.headAadhaar;
                    delete sess.citizenProfile.documents.headAadhaarFront;
                    delete sess.citizenProfile.documents.headAadhaarBack;
                }
                if (sess.citizenProfile.base64Docs) {
                    delete sess.citizenProfile.base64Docs.profilePhotoBase64;
                    delete sess.citizenProfile.base64Docs.profilePhotoName;
                    delete sess.citizenProfile.base64Docs.headAadhaarBase64;
                    delete sess.citizenProfile.base64Docs.headAadhaarName;
                }
            }
            if (sess.tempUploads) {
                delete sess.tempUploads.profilePhoto;
                delete sess.tempUploads.headAadhaar;
                delete sess.tempUploads.headAadhaarFront;
                delete sess.tempUploads.headAadhaarBack;
            }
            if (sess.base64Docs) {
                delete sess.base64Docs.profilePhotoBase64;
                delete sess.base64Docs.profilePhotoName;
                delete sess.base64Docs.headAadhaarBase64;
                delete sess.base64Docs.headAadhaarName;
            }
        },
        afterFlowFn: async (sess) => {
            if (sess.subServiceData?.docPath) {
                sess.tempUploads = sess.tempUploads || {};
                sess.tempUploads.memberAadhaar = sess.subServiceData.docPath;
                sess.citizenProfile = sess.citizenProfile || {};
                sess.citizenProfile.documents = sess.citizenProfile.documents || {};
                sess.citizenProfile.documents.memberAadhaar = sess.subServiceData.docPath;
                if (sess.subServiceData.isChild) {
                    sess.tempUploads.birthCertificate = sess.subServiceData.docPath;
                }
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
                sess.citizenProfile.members = [{
                    nameTam: sess.subServiceData.memberNameTam || sess.subServiceData.memberName,
                    nameEng: sess.subServiceData.memberNameEng || '',
                    dob: sess.subServiceData.dob || '',
                    aadhaarNumber: sess.subServiceData.aadhaarNo || '',
                    aadhaarNo: sess.subServiceData.aadhaarNo || '',
                    gender: sess.subServiceData.gender || '',
                    genderTam: sess.subServiceData.genderTam || '',
                    relationshipTam: sess.subServiceData.relationshipTam || '',
                    relationshipEng: sess.subServiceData.relationshipEng || '',
                    relationship: sess.subServiceData.relationshipTam || '',
                    docPath: sess.subServiceData.docPath || '',
                    isChild: Boolean(sess.subServiceData.isChild)
                }];
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
