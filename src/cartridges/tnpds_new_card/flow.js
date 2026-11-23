const newCardFsm = require('../../core/fsm/fsm_new_card_intake');

function enterService(sess, { greeting } = {}) {
    sess.service = 'ரேஷன் கார்டு';
    sess.subService = 'NEW_CARD';
    sess.pluginId = 'TNPDS_NEW_CARD';
    sess.targetService = null;
    sess.serviceId = null;
    sess.subServiceData = null;
    if (sess.citizenProfile) {
        sess.citizenProfile.service = 'ரேஷன் கார்டு';
        sess.citizenProfile.subService = 'NEW_CARD';
        sess.citizenProfile.pluginId = 'TNPDS_NEW_CARD';
        sess.citizenProfile.targetService = null;
        sess.citizenProfile.serviceId = null;
        sess.citizenProfile.subServiceData = null;
    }
    if (greeting) {
        sess.chatHistory = [];
    }
    newCardFsm.handleNewRationCardIntake(sess);
    if (greeting && sess.intakeState === 'MEMBER_COUNT' && Array.isArray(sess.chatHistory) && sess.chatHistory.length > 0) {
        sess.chatHistory[0].text = `${greeting}\n\n${sess.chatHistory[0].text}`;
    }
    return true;
}

function onDocumentDeleted(sess, docType) {
    if (!sess) return false;
    sess.subService = sess.subService || 'NEW_CARD';
    sess.chatHistory = Array.isArray(sess.chatHistory) ? sess.chatHistory : [];
    const isRes = docType === 'residenceProof' || docType === 'gasBook';
    const isPhoto = docType === 'headPhoto' || docType === 'profilePhoto';
    const isHeadAadh = docType === 'headAadhaar' || docType === 'headAadhaarFront' || docType === 'headAadhaarBack';

    if (isRes) {
        sess.intakeState = 'RESIDENCE_PROOF_DOC';
        if (sess.citizenProfile) {
            delete sess.citizenProfile.residenceProof;
            if (sess.citizenProfile.gasDetails) {
                delete sess.citizenProfile.gasDetails.gasBookPath;
                sess.citizenProfile.gasDetails.hasGas = false;
            }
        }
        sess.chatHistory.push({
            sender: 'bot',
            text: `🗑️ **குடியிருப்புச் சான்று / கேஸ் புக் ஆவணம் நீக்கப்பட்டது!**\n\nதயவுசெய்து புதிய குடியிருப்புச் சான்று (கேஸ் புக் / EB ரசீது) ஆவணத்தைப் பதிவேற்றவும்:`,
            options: [
                { label: "📷 கேஸ் புக் / குடியிருப்புச் சான்று பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
            ]
        });
        return true;
    }
    if (isPhoto) {
        sess.intakeState = 'HEAD_PHOTO';
        if (sess.citizenProfile) {
            delete sess.citizenProfile.headPhotoPath;
            delete sess.citizenProfile.profilePhoto;
        }
        sess.chatHistory.push({
            sender: 'bot',
            text: `🗑️ **விண்ணப்பதாரர் புகைப்படம் நீக்கப்பட்டது!**\n\nதயவுசெய்து புதிய பாஸ்போர்ட் புகைப்படத்தைப் பதிவேற்றவும்:`,
            options: [
                { label: "📷 பாஸ்போர்ட் புகைப்படம் பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
            ]
        });
        return true;
    }
    if (isHeadAadh) {
        sess.intakeState = 'HEAD_AADHAAR_FRONT';
        if (sess.citizenProfile) delete sess.citizenProfile.headAadhaarDocPath;
        sess.chatHistory.push({
            sender: 'bot',
            text: `🗑️ **குடும்பத் தலைவர் ஆதார் அட்டை நீக்கப்பட்டது!**\n\nதயவுசெய்து புதிய ஆதார் அட்டையைப் பதிவேற்றவும்:`,
            options: [
                { label: "📷 ஆதார் அட்டை பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
            ]
        });
        return true;
    }
    return true;
}

module.exports = {
    ...newCardFsm,
    enterService,
    onDocumentDeleted
};
