const { startTnpdsRationCardFlow } = require('../../portal/tnpds/flows/new_smart_card_flow');
const { isProfileDataComplete } = require('../../services/profile_helpers');
const { MEMBER_COUNT_OPTIONS } = require('../../core/fsm/fsm_options_registry');
const { persistSessions, ensureValidTnpdsChatMobile, ensureTnpdsSharedContext } = require('../_tnpds_subservice_utils');

async function run(payload, onProgress, options, sharedContext) {
    return startTnpdsRationCardFlow(payload, onProgress, options, ensureTnpdsSharedContext(payload, options, sharedContext));
}

function startFromChat({ sess, req, res, targetMobile, activeMobile, isMockTest, runAutomationTask }) {
    sess.subService = 'NEW_CARD';
    if (sess.citizenProfile) sess.citizenProfile.subService = 'NEW_CARD';
    sess.subServiceData = {};
    if (sess.citizenProfile?.subServiceData) sess.citizenProfile.subServiceData = {};

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
            text: `⚠️ **ரேஷன் கார்டு விண்ணப்ப விவரங்கள் இன்னும் முழுமையாகப் பெறப்படவில்லை!**\n\n` +
                  `அரசு இணையதளத்தில் விண்ணப்பிக்கத் தொடங்குவதற்கு முன், குடும்ப உறுப்பினர்களின் எண்ணிக்கை மற்றும் ஆவணங்களைச் சேகரிக்க வேண்டும்.\n\n` +
                  `உங்கள் குடும்பத்தில் மொத்தம் எத்தனை நபர்களை (குடும்பத் தலைவர் உட்பட) உறுப்பினர்களாகச் சேர்க்க வேண்டும்?\n\n` +
                  `கீழே உள்ள எண்ணிக்கையைத் தேர்வு செய்யவும் அல்லது தட்டச்சு செய்யவும்:`,
            options: MEMBER_COUNT_OPTIONS
        });
        persistSessions();
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState });
        return true;
    }

    if (!ensureValidTnpdsChatMobile({ sess, activeMobile, isMockTest, res })) return true;

    const targetMob = targetMobile || activeMobile;
    const modeText = isMockTest ? '🧪 சுயகற்றல் சோதனை முறை (Mock Sandbox)' : '🚀 நேரலை முறை (Live Production)';
    sess.chatHistory.push({
        sender: 'bot',
        text: `${modeText}யில் தமிழ்நாடு அரசு TNPDS இணையதள விண்ணப்பம் தொடங்கப்படுகிறது...\n\nவிண்ணப்பதாரர்: ${sess.citizenProfile?.fullNameEng || 'விண்ணப்பதாரர்'} (+91 ${sess.citizenProfile?.mobileNumber || activeMobile})\nமொத்த உறுப்பினர்கள்: ${sess.citizenProfile?.members?.length || 1}`
    });

    const flowProfile = {
        ...(sess.citizenProfile || {}),
        mobileNumber: sess.citizenProfile?.mobileNumber || targetMob,
        subService: sess.subService,
        subServiceData: sess.subServiceData,
        intakeState: sess.intakeState
    };
    runAutomationTask(startTnpdsRationCardFlow, flowProfile, sess, targetMob, isMockTest, false, false, req);
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
    runnerName: 'startTnpdsRationCardFlow',
    run,
    startFromChat,
    startTnpdsRationCardFlow
};
