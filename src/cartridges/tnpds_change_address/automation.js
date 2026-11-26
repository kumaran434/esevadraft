const { startTnpdsAddressChangeFlow } = require('../../portal/tnpds/flows/address_change_flow');
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

    const sData = sess.subServiceData;
    const hasNewAddressFields = Boolean(
        sData.doorNo && (sData.streetTam || sData.streetEng) &&
        (sData.addressProofDocPath || sData.docPath || sess.tempUploads?.newAddressProof || sess.citizenProfile?.documents?.newAddressProof)
    );

    if (!isMockTest && !hasNewAddressFields) {
        sess.intakeState = 'RATION_CHANGE_ADDRESS_DOC';
        sess.chatHistory.push({
            sender: 'bot',
            text: `⚠️ **புதிய முகவரி விவரங்கள் மற்றும் முகவரிச் சான்று இன்னும் முழுமையாகப் பெறப்படவில்லை!**\n\n` +
                  `தயவுசெய்து புதிய முகவரிக்கான சான்று ஆவணத்தைப் பதிவேற்றவும் அல்லது படிவத்தில் நிரப்பவும்:`,
            options: [
                { label: "✏️ புதிய முகவரியைப் படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" },
                { label: "⚡ மின் கட்டண ரசீது (EB Bill)", value: "ADDR_PROOF_EB" },
                { label: "🪪 புதிய முகவரி ஆதார் அட்டை (Aadhaar)", value: "ADDR_PROOF_AADHAAR" }
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
