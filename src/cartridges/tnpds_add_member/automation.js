const { startTnpdsAddMemberFlow } = require('../../portal/tnpds/flows/add_member_flow');
const { persistSessions, ensureValidTnpdsChatMobile, ensureTnpdsSharedContext } = require('../_tnpds_subservice_utils');

async function run(payload, onProgress, options, sharedContext) {
    return startTnpdsAddMemberFlow(payload, onProgress, options, ensureTnpdsSharedContext(payload, options, sharedContext));
}

function startFromChat({ sess, req, res, targetMobile, activeMobile, isMockTest, runAutomationTask }) {
    sess.subService = 'ADD_MEMBER';
    if (sess.citizenProfile) sess.citizenProfile.subService = 'ADD_MEMBER';
    sess.subServiceData = sess.subServiceData || sess.citizenProfile?.subServiceData || {};
    if (isMockTest) {
        if (!sess.subServiceData.memberName) sess.subServiceData.memberName = sess.subServiceData.isChild ? 'கவின் குமார்' : 'பிரியா';
        if (!sess.subServiceData.relationshipTam) sess.subServiceData.relationshipTam = sess.subServiceData.isChild ? 'மகன்' : 'மகள்';
        if (!sess.subServiceData.aadhaarNo) sess.subServiceData.aadhaarNo = '987654321096';
        if (!sess.subServiceData.docType) sess.subServiceData.docType = 'Aadhaar Card';
        if (!sess.subServiceData.docPath) sess.subServiceData.docPath = 'uploads/test_sample_doc.jpg';
    } else if (!sess.subServiceData.memberName && !sess.subServiceData.memberNameTam && !sess.subServiceData.memberNameEng) {
        sess.intakeState = 'RATION_ADD_MEMBER_TYPE';
        sess.chatHistory.push({
            sender: 'bot',
            text: `⚠️ **சேர்க்கப்பட வேண்டிய புதிய குடும்ப உறுப்பினர் விவரங்கள் இன்னும் முழுமையாகப் பெறப்படவில்லை!**\n\nதயவுசெய்து புதிய உறுப்பினரின் **ஆதார் அட்டையைப்** பதிவேற்றவும் (குழந்தையாக இருந்தாலும் ஆதார் அட்டை கட்டாயம்):`,
            actionRequired: 'upload',
            uploadPrompt: 'உறுப்பினர் ஆதார் அட்டை',
            options: [
                { label: "📷 ஆதார் அட்டை பதிவேற்றவும்", value: "TRIGGER_FILE_UPLOAD" },
                { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
            ]
        });
        persistSessions();
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState });
        return true;
    }
    sess.intakeState = 'READY_TO_APPLY';

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
