const { startTnpdsAddMemberFlow } = require('../../portal/tnpds/flows/add_member_flow');
const { persistSessions, ensureValidTnpdsChatMobile, ensureTnpdsSharedContext } = require('../_tnpds_subservice_utils');

async function run(payload, onProgress, options, sharedContext) {
    return startTnpdsAddMemberFlow(payload, onProgress, options, ensureTnpdsSharedContext(payload, options, sharedContext));
}

function startFromChat({ sess, req, res, targetMobile, activeMobile, isMockTest, runAutomationTask }) {
    sess.subService = 'ADD_MEMBER';
    if (sess.citizenProfile) sess.citizenProfile.subService = 'ADD_MEMBER';
    sess.intakeState = 'READY_TO_APPLY';
    sess.subServiceData = sess.subServiceData || sess.citizenProfile?.subServiceData || {};
    if (!sess.subServiceData.memberName) sess.subServiceData.memberName = sess.subServiceData.isChild ? 'கவின் குமார்' : 'பிரியா';
    if (!sess.subServiceData.relationshipTam) sess.subServiceData.relationshipTam = sess.subServiceData.isChild ? 'மகன்' : 'மகள்';
    if (!sess.subServiceData.aadhaarNo) sess.subServiceData.aadhaarNo = '987654321096';
    if (!sess.subServiceData.docType) sess.subServiceData.docType = 'Aadhaar Card';
    if (!sess.subServiceData.docPath) sess.subServiceData.docPath = 'uploads/test_sample_doc.jpg';

    if (!ensureValidTnpdsChatMobile({ sess, activeMobile, isMockTest, res })) return true;

    const targetMob = targetMobile || activeMobile;
    const modeText = isMockTest ? '🧪 சுயகற்றல் சோதனை முறை (Mock Sandbox)' : '🚀 நேரலை முறை (Live Production)';
    const memName = sess.subServiceData?.memberName || (sess.subServiceData?.isChild ? 'குழந்தை' : 'புதிய உறுப்பினர்');
    const relTam = sess.subServiceData?.relationshipTam || '';
    sess.chatHistory.push({
        sender: 'bot',
        text: `${modeText}யில் தமிழ்நாடு அரசு TNPDS குடும்ப உறுப்பினர் சேர்க்கை ஆட்டோமேஷன் தொடங்கப்படுகிறது...\n\nஉறுப்பினர்: ${memName} (${relTam})\nபதிவு செய்யப்பட்ட கைபேசி: +91 ${sess.citizenProfile?.mobileNumber || targetMob}`
    });

    const flowProfile = {
        ...(sess.citizenProfile || {}),
        mobileNumber: sess.citizenProfile?.mobileNumber || targetMob,
        subService: sess.subService,
        subServiceData: sess.subServiceData,
        intakeState: sess.intakeState
    };
    runAutomationTask(startTnpdsAddMemberFlow, flowProfile, sess, targetMob, isMockTest, true, false, req);
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
    runnerName: 'startTnpdsAddMemberFlow',
    run,
    startFromChat,
    startTnpdsAddMemberFlow
};
