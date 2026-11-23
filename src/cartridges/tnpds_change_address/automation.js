const { startTnpdsAddressChangeFlow } = require('../../portal/tnpds/flows/address_change_flow');
const { isProfileDataComplete } = require('../../services/profile_helpers');
const { MEMBER_COUNT_OPTIONS } = require('../../core/fsm/fsm_options_registry');
const { persistSessions, ensureValidTnpdsChatMobile, ensureTnpdsSharedContext } = require('../_tnpds_subservice_utils');

async function run(payload, onProgress, options, sharedContext) {
    return startTnpdsAddressChangeFlow(payload, onProgress, options, ensureTnpdsSharedContext(payload, options, sharedContext));
}

function startFromChat({ sess, req, res, targetMobile, activeMobile, isMockTest, runAutomationTask }) {
    sess.subService = 'CHANGE_ADDRESS';
    if (sess.citizenProfile) sess.citizenProfile.subService = 'CHANGE_ADDRESS';
    sess.subServiceData = sess.subServiceData || sess.citizenProfile?.subServiceData || {};
    delete sess.subServiceData.memberName;
    delete sess.subServiceData.isChild;
    if (sess.citizenProfile?.subServiceData) {
        delete sess.citizenProfile.subServiceData.memberName;
        delete sess.citizenProfile.subServiceData.isChild;
    }

    const hasHead = sess.citizenProfile && (
        sess.citizenProfile.headAadhaar ||
        (sess.citizenProfile.members && sess.citizenProfile.members.length > 0)
    );
    const isComplete = isProfileDataComplete(sess.citizenProfile, sess.tempUploads);
    if (isComplete) sess.intakeState = 'READY_TO_APPLY';

    if (!hasHead || (!isComplete && sess.intakeState !== 'READY_TO_APPLY')) {
        sess.intakeState = 'MEMBER_COUNT';
        sess.chatHistory.push({
            sender: 'bot',
            text: `⚠️ **முகவரி மாற்ற விண்ணப்ப விவரங்கள் இன்னும் முழுமையாகப் பெறப்படவில்லை!**\n\n` +
                  `தயவுசெய்து விண்ணப்ப விவரங்களைப் பூர்த்தி செய்யவும்:`,
            options: MEMBER_COUNT_OPTIONS
        });
        persistSessions();
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState });
        return true;
    }

    if (!ensureValidTnpdsChatMobile({ sess, activeMobile, isMockTest, res })) return true;

    const targetMob = targetMobile || activeMobile;
    const modeText = isMockTest ? '🧪 சுயகற்றல் சோதனை முறை (Mock Sandbox)' : '🚀 நேரலை முறை (Live Production)';
    const doorNo = sess.subServiceData?.doorNo || '';
    const stTam = sess.subServiceData?.streetTam || '';
    sess.chatHistory.push({
        sender: 'bot',
        text: `${modeText}யில் தமிழ்நாடு அரசு TNPDS குடும்ப அட்டை முகவரி மாற்றம் ஆட்டோமேஷன் தொடங்கப்படுகிறது...\n\nபுதிய முகவரி: ${doorNo} ${stTam}\nபதிவு செய்யப்பட்ட கைபேசி: +91 ${sess.citizenProfile?.mobileNumber || targetMob}`
    });

    const flowProfile = {
        ...(sess.citizenProfile || {}),
        mobileNumber: sess.citizenProfile?.mobileNumber || targetMob,
        subService: sess.subService,
        subServiceData: sess.subServiceData,
        intakeState: sess.intakeState
    };
    runAutomationTask(startTnpdsAddressChangeFlow, flowProfile, sess, targetMob, isMockTest, false, true, req);
    sess.isAutomating = true;
    sess.isAutomationRunning = true;
    sess.automationStep = 0;
    sess.automationTotal = 51;
    persistSessions();
    res.json({
        chatHistory: sess.chatHistory,
        citizenProfile: sess.citizenProfile,
        step: isMockTest ? 'mock_running' : 'filling_form',
        automationStep: 0,
        automationTotal: 51
    });
    return true;
}

module.exports = {
    runnerName: 'startTnpdsAddressChangeFlow',
    run,
    startFromChat,
    startTnpdsAddressChangeFlow
};
