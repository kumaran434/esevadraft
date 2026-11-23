const { startTnpdsMobileChangeFlow } = require('../../portal/tnpds/flows/mobile_change_flow');
const { persistSessions, ensureValidTnpdsChatMobile, ensureTnpdsSharedContext } = require('../_tnpds_subservice_utils');

async function run(payload, onProgress, options, sharedContext) {
    return startTnpdsMobileChangeFlow(payload, onProgress, options, ensureTnpdsSharedContext(payload, options, sharedContext));
}

function startFromChat({ sess, req, res, targetMobile, activeMobile, isMockTest, runAutomationTask }) {
    sess.subService = 'UPDATE_MOBILE';
    if (sess.citizenProfile) sess.citizenProfile.subService = 'UPDATE_MOBILE';
    if (!ensureValidTnpdsChatMobile({ sess, activeMobile, isMockTest, res })) return true;

    const targetMob = targetMobile || activeMobile;
    const modeText = isMockTest ? '🧪 சுயகற்றல் சோதனை முறை (Mock Sandbox)' : '🚀 நேரலை முறை (Live Production)';
    sess.chatHistory.push({
        sender: 'bot',
        text: `${modeText}யில் தமிழ்நாடு அரசு TNPDS கைபேசி எண் மாற்றம் ஆட்டோமேஷன் தொடங்கப்படுகிறது...`
    });

    const flowProfile = {
        ...(sess.citizenProfile || {}),
        mobileNumber: sess.citizenProfile?.mobileNumber || targetMob,
        subService: 'UPDATE_MOBILE',
        subServiceData: sess.subServiceData,
        intakeState: sess.intakeState
    };
    runAutomationTask(startTnpdsMobileChangeFlow, flowProfile, sess, targetMob, isMockTest, false, false, req);
    sess.isAutomating = true;
    sess.isAutomationRunning = true;
    sess.automationStep = 0;
    sess.automationTotal = 51;
    persistSessions();
    res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: isMockTest ? 'mock_running' : 'filling_form' });
    return true;
}

module.exports = {
    runnerName: 'startTnpdsMobileChangeFlow',
    run,
    startFromChat,
    startTnpdsMobileChangeFlow
};
