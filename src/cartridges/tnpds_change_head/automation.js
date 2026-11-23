const { startTnpdsChangeHeadFlow } = require('../../portal/tnpds/flows/change_head_flow');
const { persistSessions, ensureValidTnpdsChatMobile, ensureTnpdsSharedContext } = require('../_tnpds_subservice_utils');

async function run(payload, onProgress, options, sharedContext) {
    return startTnpdsChangeHeadFlow(payload, onProgress, options, ensureTnpdsSharedContext(payload, options, sharedContext));
}

function startFromChat({ sess, req, res, targetMobile, activeMobile, isMockTest, runAutomationTask }) {
    sess.subService = 'CHANGE_HEAD';
    if (sess.citizenProfile) sess.citizenProfile.subService = 'CHANGE_HEAD';
    if (!ensureValidTnpdsChatMobile({ sess, activeMobile, isMockTest, res })) return true;

    const targetMob = targetMobile || activeMobile;
    const modeText = isMockTest ? '🧪 சுயகற்றல் சோதனை முறை (Mock Sandbox)' : '🚀 நேரலை முறை (Live Production)';
    sess.chatHistory.push({
        sender: 'bot',
        text: `${modeText}யில் தமிழ்நாடு அரசு TNPDS குடும்பத் தலைவர் மாற்றம் ஆட்டோமேஷன் தொடங்கப்படுகிறது...`
    });

    const flowProfile = {
        ...(sess.citizenProfile || {}),
        mobileNumber: sess.citizenProfile?.mobileNumber || targetMob,
        subService: 'CHANGE_HEAD',
        subServiceData: sess.subServiceData,
        intakeState: sess.intakeState
    };
    runAutomationTask(startTnpdsChangeHeadFlow, flowProfile, sess, targetMob, isMockTest, false, false, req);
    sess.isAutomating = true;
    sess.isAutomationRunning = true;
    sess.automationStep = 0;
    sess.automationTotal = 51;
    persistSessions();
    res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: isMockTest ? 'mock_running' : 'filling_form' });
    return true;
}

module.exports = {
    runnerName: 'startTnpdsChangeHeadFlow',
    run,
    startFromChat,
    startTnpdsChangeHeadFlow
};
