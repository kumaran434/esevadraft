const { startTnegaWidowFlow } = require('../../portal/tnega/tnega_widow_certificate');
const { launchCartridgeChatTask } = require('../_tnega_upload_utils');

async function run(payload, onProgress, options) {
    return startTnegaWidowFlow(payload, onProgress, options);
}

function startFromChat({ sess, req, res, targetMobile, activeMobile, isMockTest, runAutomationTask }) {
    sess.subService = 'WIDOW';
    if (sess.citizenProfile) sess.citizenProfile.subService = 'WIDOW';
    const p = sess.citizenProfile || {};
    const modeText = isMockTest ? '🧪 சுயகற்றல் சோதனை முறை (Mock Sandbox)' : '🚀 நேரலை உற்பத்தி முறை (Live Production)';
    return launchCartridgeChatTask({
        sess, res, runAutomationTask,
        runner: startTnegaWidowFlow,
        payload: p,
        targetMob: p.mobileNumber || targetMobile || activeMobile,
        isMockTest,
        req,
        bannerText: `${modeText}யில் தமிழ்நாடு அரசு **TNeGA விதவைச் சான்றிதழ் (REV-109)** ஆட்டோமேஷன் தொடங்கப்படுகிறது! 🛡️\n\n` +
            `• 🔢 **CAN எண்:** **${p.canNumber || 'தேடப்படும்'}** ✅\n` +
            `• 👤 **விண்ணப்பதாரர்:** ${p.fullNameTam || p.fullNameEng || 'விண்ணப்பதாரர்'}\n` +
            `• 🕊️ **கணவர் பெயர்:** ${p.spouseNameTam || p.spouseNameEng || p.husbandNameTam || p.fatherNameTam || '—'} (இறந்த தேதி: ${p.dateOfDeath || '15-Jan-2025'})\n` +
            `• 📜 **இறப்புச் சான்றிதழ் எண்:** ${p.deathCertificateNo || 'DC-2025-88412'}\n\n` +
            `Chrome உலாவியில் TNeGA REV-109 படிவம் திறக்கப்பட்டு, ஆப்ரேட்டர் Submit-க்குப் பிறகு 4 ஆவணங்களும் பதிவேற்றப்பட்டு **Pre-Submit Gate** வரை தானாக இயங்கும்...`,
        extraJson: { subService: 'WIDOW', serviceId: 'WIDOW_CERTIFICATE', targetService: 'WIDOW' }
    });
}

module.exports = {
    runnerName: 'startTnegaWidowFlow',
    chatStartTriggers: ['START_WIDOW_APPLY'],
    readyStates: ['READY_TO_SUBMIT_WIDOW', 'READY_TO_APPLY_WIDOW'],
    run,
    startFromChat,
    startTnegaWidowFlow
};
