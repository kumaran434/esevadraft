const { startTnpdsRemoveMemberFlow } = require('../../portal/tnpds/flows/remove_member_flow');
const { persistSessions, ensureValidTnpdsChatMobile, ensureTnpdsSharedContext } = require('../_tnpds_subservice_utils');

async function run(payload, onProgress, options, sharedContext) {
    return startTnpdsRemoveMemberFlow(payload, onProgress, options, ensureTnpdsSharedContext(payload, options, sharedContext));
}

function startFromChat({ sess, req, res, targetMobile, activeMobile, isMockTest, runAutomationTask }) {
    sess.subService = 'REMOVE_MEMBER';
    if (sess.citizenProfile) sess.citizenProfile.subService = 'REMOVE_MEMBER';
    if (!ensureValidTnpdsChatMobile({ sess, activeMobile, isMockTest, res })) return true;

    const targetMob = targetMobile || activeMobile;
    const modeText = isMockTest ? '🧪 சுயகற்றல் சோதனை முறை (Mock Sandbox)' : '🚀 நேரலை முறை (Live Production)';
    const memName = sess.subServiceData?.memberNameTam || sess.subServiceData?.memberName || 'உறுப்பினர்';
    sess.chatHistory.push({
        sender: 'bot',
        text: `${modeText}யில் தமிழ்நாடு அரசு TNPDS குடும்ப உறுப்பினர் நீக்கம் ஆட்டோமேஷன் தொடங்கப்படுகிறது...\n\nநீக்கப்படும் உறுப்பினர்: ${memName}`
    });

    const flowProfile = {
        ...(sess.citizenProfile || {}),
        mobileNumber: sess.citizenProfile?.mobileNumber || targetMob,
        subService: 'REMOVE_MEMBER',
        subServiceData: sess.subServiceData,
        intakeState: sess.intakeState
    };
    runAutomationTask(startTnpdsRemoveMemberFlow, flowProfile, sess, targetMob, isMockTest, false, false, req);
    sess.isAutomating = true;
    sess.isAutomationRunning = true;
    sess.automationStep = 0;
    sess.automationTotal = 51;
    persistSessions();
    res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: isMockTest ? 'mock_running' : 'filling_form' });
    return true;
}

module.exports = {
    runnerName: 'startTnpdsRemoveMemberFlow',
    run,
    startFromChat,
    startTnpdsRemoveMemberFlow
};
