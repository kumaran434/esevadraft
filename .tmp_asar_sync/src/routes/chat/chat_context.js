const storageService = require('../../services/storage_service');
const { getCitizenDraft } = require('../../../firestore_db');
const { createFreshProfile, getOrCreateSession } = storageService;

async function resolveChatContext(req) {
    const text = (req.body.text || req.body.message || '').trim();
    const uploadedFile = (req.files && req.files.length > 0) ? req.files[0] : null;

    console.log(`\n💬 Received - Text: "${text}", File: ${uploadedFile ? uploadedFile.filename : 'None'}`);

    const isDevReq = req.headers['x-dev-mode'] === 'true' || req.body.isDevMode === true;
    const reqOpUid = req.headers['x-operator-uid'] || req.body.operatorUid;
    let targetMobile = (req.body.mobileNumber || req.body.mobile || req.headers['x-session-mobile'] || '').trim();

    if (!targetMobile && reqOpUid) {
        targetMobile = `walkin_${String(reqOpUid).substring(0, 8)}`;
    } else if (!targetMobile && !storageService.getActiveMobile()) {
        targetMobile = 'walkin_session';
    }

    const sess = getOrCreateSession(targetMobile || storageService.getActiveMobile());
    if (reqOpUid) sess.operatorUid = reqOpUid;
    storageService.setSessionState(sess);
    storageService.setActiveMobile(targetMobile || storageService.getActiveMobile());

    if (targetMobile && (!sess.citizenProfile || !sess.citizenProfile.fullNameEng) && (!sess.subServiceData || Object.keys(sess.subServiceData).length === 0)) {
        try {
            const existingDraft = await getCitizenDraft(targetMobile);
            if (existingDraft && existingDraft.citizenProfile && (existingDraft.citizenProfile.fullNameEng || existingDraft.citizenProfile.fullNameTam || existingDraft.subService || existingDraft.citizenProfile?.subService)) {
                sess.citizenProfile = {
                    ...createFreshProfile(targetMobile),
                    ...existingDraft.citizenProfile,
                    ...(sess.citizenProfile?.fullNameEng ? sess.citizenProfile : {})
                };
                sess.draftData = existingDraft;
                const isExplicitServiceIntent = text && (
                    text.includes('வருமான') || text.includes('இருப்பிட') || text.includes('சாதி') ||
                    text.includes('வாக்காளர்') || text.includes('ரேஷன்') || text.includes('உறுப்பினர்') ||
                    text.includes('INCOME') || text.includes('RATION')
                );
                if (!isExplicitServiceIntent) {
                    if (existingDraft.intakeState && (!sess.intakeState || sess.intakeState === 'START' || sess.intakeState === 'SERVICE_SELECTION')) {
                        sess.intakeState = existingDraft.intakeState;
                    }
                    if (existingDraft.targetMemberCount && (!sess.targetMemberCount || sess.targetMemberCount <= 1)) {
                        sess.targetMemberCount = existingDraft.targetMemberCount;
                    }
                    if (existingDraft.currentMemberIdx !== undefined && (!sess.currentMemberIdx || sess.currentMemberIdx === 0)) {
                        sess.currentMemberIdx = existingDraft.currentMemberIdx;
                    }
                    if (existingDraft.tempMember && !sess.tempMember) {
                        sess.tempMember = existingDraft.tempMember;
                    }
                    if (existingDraft.tempUploads && (!sess.tempUploads || Object.keys(sess.tempUploads).length === 0)) {
                        sess.tempUploads = existingDraft.tempUploads;
                    }
                    if (Array.isArray(existingDraft.chatHistory) && existingDraft.chatHistory.length > 0) {
                        if (!sess.chatHistory || sess.chatHistory.length <= 1) {
                            sess.chatHistory = [...existingDraft.chatHistory];
                        }
                    }
                    if (!sess.subService && (existingDraft.subService || existingDraft.citizenProfile?.subService)) {
                        sess.subService = existingDraft.subService || existingDraft.citizenProfile?.subService;
                    }
                    if (!sess.subServiceData && (existingDraft.subServiceData || existingDraft.citizenProfile?.subServiceData)) {
                        sess.subServiceData = existingDraft.subServiceData || existingDraft.citizenProfile?.subServiceData;
                    }
                }
            }
        } catch (dErr) {}
    }

    if (text) {
        sess.chatHistory.push({ sender: 'user', text: text });
    }

    return {
        text,
        uploadedFile,
        isDevReq,
        reqOpUid,
        targetMobile,
        sess
    };
}

module.exports = {
    resolveChatContext
};
