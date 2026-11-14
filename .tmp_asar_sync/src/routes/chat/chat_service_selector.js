const fs = require('fs');
const path = require('path');
const storageService = require('../../services/storage_service');
const { 
    handleServiceSelection, 
    handleRationSubserviceWorkflow 
} = require('../../core/chat_fsm');
const { inspectAndExtractDocument } = require('../../../ai_document_extractor');

const { persistSessions } = storageService;

async function handleServiceSelector(ctx, req, res) {
    const { text, uploadedFile, sess } = ctx;

    const isCanAction = text === 'CAN_REGISTER_PROMPT' || 
                        text === 'CAN_SEARCH_PROMPT' || 
                        text === 'CAN_DIRECT_INPUT' || 
                        text === 'START_CAN_SEARCH' || 
                        text === 'START_CAN_REGISTER' ||
                        text === 'LAUNCH_CAN_AUTOMATION' ||
                        text === 'START_INCOME_APPLY' ||
                        text === 'START_RESIDENCE_APPLY' ||
                        text === 'START_COMMUNITY_APPLY' ||
                        (text && text.startsWith('SELECT_MEMBER_')) ||
                        (text && text.startsWith('COMMUNITY_')) ||
                        (text && text.startsWith('RELIGION_')) ||
                        text === 'CAN_SEARCH_OTHER' ||
                        text === 'என்னிடம் CAN உள்ளது' ||
                        text === 'CAN_DIRECT';
    if (isCanAction) {
        return false;
    }

    // STATE 1: SERVICE_SELECTION OR EXPLICIT SERVICE SWITCH
    const isExplicitServiceSwitch = text === 'வருமானச் சான்றிதழ்' || 
                                    text === 'இருப்பிடச் சான்றிதழ்' || 
                                    text === 'புதிய ரேஷன் கார்டு' || 
                                    text === 'புதிய குடும்ப அட்டை' ||
                                    text === 'ரேஷன் கார்டு' ||
                                    text === 'புதிய வாக்காளர் அட்டை' || 
                                    text === 'சாதிச் சான்றிதழ்' || 
                                    text.includes('வருமானச் சான்றிதழ்') || 
                                    text.includes('இருப்பிடச் சான்றிதழ்') || 
                                    text.includes('புதிய ரேஷன் கார்டு') || 
                                    text.includes('ரேஷன் கார்டு') ||
                                    text.includes('புதிய வாக்காளர் அட்டை') || 
                                    text.includes('சாதிச் சான்றிதழ்') ||
                                    (text.toLowerCase() === 'community' || text.toLowerCase() === 'community certificate') ||
                                    text === 'NEW_RATION_CARD' || 
                                    text === 'INCOME_CERTIFICATE' || 
                                    text === 'RESIDENCE_CERTIFICATE' || 
                                    text === 'COMMUNITY_CERTIFICATE' || 
                                    text === 'VOTER_ID' ||
                                    text === 'குடும்ப உறுப்பினர் சேர்க்க' ||
                                    text === 'குடும்ப உறுப்பினர் நீக்க' ||
                                    text === 'குடும்பத் தலைவர் மாற்றம்' ||
                                    text === 'முகவரி மாற்றம்' ||
                                    text === 'குடும்ப அட்டை வகை மாற்றம்' ||
                                    text === 'கைபேசி எண் மாற்றம்' ||
                                    text === 'எரிவாயு விவரங்கள் திருத்தம்' ||
                                    text.startsWith('1.') || text.startsWith('2.') || text.startsWith('3.') ||
                                    text.startsWith('4.') || text.startsWith('5.') || text.startsWith('6.') ||
                                    text.startsWith('7.') || text.startsWith('8.');

    if (sess.intakeState === 'SERVICE_SELECTION' || sess.intakeState === 'RATION_CARD_SERVICES' || isExplicitServiceSwitch) {
        handleServiceSelection(text, sess);
        persistSessions();
        const lastBotMsg = sess.chatHistory[sess.chatHistory.length - 1];
        res.json({
            chatHistory: sess.chatHistory,
            citizenProfile: sess.citizenProfile,
            step: sess.intakeState,
            intakeState: sess.intakeState,
            subService: sess.subService || sess.citizenProfile?.subService,
            subServiceData: sess.subServiceData || sess.citizenProfile?.subServiceData,
            botResponse: lastBotMsg ? lastBotMsg.text : ''
        });
        return true;
    }

    // STATE: RATION CARD SUBSERVICES WORKFLOW
    if ((sess.intakeState && sess.intakeState.startsWith('RATION_') && sess.intakeState !== 'RATION_CARD_SERVICES') || (text && (text.startsWith('ADD_MEMBER_') || text.startsWith('REMOVE_') || text.startsWith('HEAD_') || text.startsWith('ADDR_') || text === 'CHILD_UNDER_5' || text === 'ADULT_ABOVE_5' || text === 'RATION_ADD_MEMBER_RESET' || text === 'RATION_CHANGE_ADDRESS_RESET'))) {
        let extractedDoc = null;
        if (uploadedFile) {
            try {
                extractedDoc = await inspectAndExtractDocument(uploadedFile.path, { skipFaceExtraction: true, subService: sess.subService || 'ADD_MEMBER' });
            } catch (ocrErr) {
                console.warn(`⚠️ [Subservice AI OCR] Extraction error:`, ocrErr.message);
            }
        }
        const handled = await handleRationSubserviceWorkflow(text, sess, uploadedFile, extractedDoc);
        if (handled) {
            if (uploadedFile) {
                sess.tempUploads = sess.tempUploads || {};
                if (sess.intakeState === 'RATION_ADD_MEMBER_CHILD_RELATION' || sess.subServiceData?.isChild) {
                    sess.tempUploads.birthCertificate = uploadedFile.path;
                } else if (sess.intakeState === 'RATION_ADD_MEMBER_RELATION' || sess.intakeState === 'RATION_ADD_MEMBER_ADULT_SURRENDER' || sess.intakeState === 'RATION_ADD_MEMBER_SON_RELATION') {
                    sess.tempUploads.memberAadhaar = sess.subServiceData?.docPath || uploadedFile.path;
                } else if (sess.intakeState === 'RATION_ADD_MEMBER_ADULT_RELATION') {
                    sess.tempUploads.surrenderProof = uploadedFile.path;
                } else if (sess.subService === 'REMOVE_MEMBER') {
                    sess.tempUploads.removeProof = uploadedFile.path;
                } else if (sess.subService === 'CHANGE_HEAD') {
                    sess.tempUploads.headAadhaar = uploadedFile.path;
                } else if (sess.subService === 'CHANGE_ADDRESS') {
                    sess.tempUploads.newAddressProof = uploadedFile.path;
                } else if (sess.subService === 'LPG_UPDATE') {
                    sess.tempUploads.gasBook = uploadedFile.path;
                }
            }

            const isSubAddMember = sess.subService === 'ADD_MEMBER' || (sess.intakeState && sess.intakeState.startsWith('RATION_ADD_MEMBER'));
            if (isSubAddMember) {
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
            } else if (extractedDoc?.extractedFacePhotoPath && !sess.citizenProfile?.headPhotoPath) {
                sess.citizenProfile = sess.citizenProfile || {};
                sess.citizenProfile.headPhotoPath = extractedDoc.extractedFacePhotoPath;
                sess.tempUploads = sess.tempUploads || {};
                sess.tempUploads.profilePhoto = extractedDoc.extractedFacePhotoPath;
                if (fs.existsSync(extractedDoc.extractedFacePhotoPath)) {
                    try {
                        const b64 = fs.readFileSync(extractedDoc.extractedFacePhotoPath).toString('base64');
                        const bName = path.basename(extractedDoc.extractedFacePhotoPath);
                        sess.base64Docs = sess.base64Docs || {};
                        sess.citizenProfile.base64Docs = sess.citizenProfile.base64Docs || {};
                        sess.base64Docs.profilePhotoBase64 = b64;
                        sess.base64Docs.profilePhotoName = bName;
                        sess.citizenProfile.base64Docs.profilePhotoBase64 = b64;
                        sess.citizenProfile.base64Docs.profilePhotoName = bName;
                    } catch (e) {}
                }
            }

            sess.citizenProfile = sess.citizenProfile || {};
            sess.citizenProfile.subService = sess.subService;
            sess.citizenProfile.subServiceData = sess.subServiceData;
            sess.citizenProfile.documents = sess.tempUploads || {};
            if (sess.subServiceData?.docPath) {
                sess.tempUploads = sess.tempUploads || {};
                sess.tempUploads.memberAadhaar = sess.subServiceData.docPath;
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
                    } catch (e) {}
                }
            }
            if (sess.subService === 'ADD_MEMBER' && sess.subServiceData) {
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

            persistSessions();
            const lastBotMsg = sess.chatHistory[sess.chatHistory.length - 1];
            res.json({
                chatHistory: sess.chatHistory,
                citizenProfile: sess.citizenProfile,
                step: sess.intakeState,
                intakeState: sess.intakeState,
                subService: sess.subService,
                subServiceData: sess.subServiceData,
                documents: sess.tempUploads || {},
                botResponse: lastBotMsg ? lastBotMsg.text : ''
            });
            return true;
        }
    }

    return false;
}

module.exports = {
    handleServiceSelector
};
