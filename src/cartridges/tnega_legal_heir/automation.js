const { startTnegaLegalHeirFlow } = require('../../portal/tnega/tnega_legal_heir');
const { launchCartridgeChatTask } = require('../_tnega_upload_utils');

async function run(payload, onProgress, options) {
    return startTnegaLegalHeirFlow(payload, onProgress, options);
}

function startFromChat({ sess, req, res, targetMobile, activeMobile, isMockTest, runAutomationTask }) {
    sess.subService = 'LEGAL_HEIR';
    if (sess.citizenProfile) sess.citizenProfile.subService = 'LEGAL_HEIR';
    const p = sess.citizenProfile || {};
    const modeText = isMockTest ? '🧪 சுயகற்றல் சோதனை முறை (Mock Sandbox)' : '🚀 நேரலை உற்பத்தி முறை (Live Production)';
    return launchCartridgeChatTask({
        sess, res, runAutomationTask,
        runner: startTnegaLegalHeirFlow,
        payload: p,
        targetMob: p.mobileNumber || targetMobile || activeMobile,
        isMockTest,
        req,
        bannerText: `${modeText}யில் தமிழ்நாடு அரசு **TNeGA சட்ட வாரிசு சான்றிதழ் (REV-114)** ஆட்டோமேஷன் தொடங்கப்படுகிறது! 🛡️\n\n` +
            `• 🔢 **CAN எண்:** **${p.canNumber || 'தேடப்படும்'}** ✅\n` +
            `• 👤 **விண்ணப்பதாரர்:** ${p.fullNameTam || p.fullNameEng || 'விண்ணப்பதாரர்'}\n` +
            `• 🕊️ **இறந்தவர்:** ${p.deceasedNameTam || p.deceasedNameEng || p.fatherNameTam || '—'} (தேதி: ${p.dateOfDeath || '15-Jan-2025'})\n` +
            `• 📜 **இறப்புச் சான்றிதழ் எண்:** ${p.deathCertificateNo || 'DC-2025-88412'}\n\n` +
            `Chrome உலாவியில் TNeGA REV-114 படிவம் திறக்கப்பட்டு, ஆப்ரேட்டர் Submit-க்குப் பிறகு 4 ஆவணங்களும் பதிவேற்றப்பட்டு **Pre-Submit Gate** வரை தானாக இயங்கும்...`,
        extraJson: { subService: 'LEGAL_HEIR', serviceId: 'LEGAL_HEIR_CERTIFICATE', targetService: 'LEGAL_HEIR' }
    });
}

module.exports = {
    runnerName: 'startTnegaLegalHeirFlow',
    chatStartTriggers: ['START_LEGAL_HEIR_APPLY'],
    readyStates: ['READY_TO_SUBMIT_LEGAL_HEIR', 'READY_TO_APPLY_LEGAL_HEIR'],
    run,
    startFromChat,
    startTnegaLegalHeirFlow
};
