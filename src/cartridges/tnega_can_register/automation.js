const { startTnegaCanRegisterFlow, searchCitizenCan, registerNewCan } = require('../../portal/tnega/tnega_can_register');
const { launchCartridgeChatTask } = require('../_tnega_upload_utils');

async function run(payload, onProgress, options) {
    return startTnegaCanRegisterFlow(payload, onProgress, options);
}

function startFromChat({ sess, req, res, targetMobile, activeMobile, isMockTest, runAutomationTask }) {
    const targetSvc = sess.targetService || sess.citizenProfile?.targetService;
    sess.subService = 'CAN_REGISTER';
    if (sess.citizenProfile) {
        sess.citizenProfile.subService = 'CAN_REGISTER';
        if (targetSvc) sess.citizenProfile.targetService = targetSvc;
    }
    const p = sess.citizenProfile || {};
    if (targetSvc) p.targetService = targetSvc;
    const targetNameTam = targetSvc === 'COMMUNITY' ? 'சாதிச் சான்றிதழ்' : (targetSvc === 'RESIDENCE' ? 'இருப்பிடச் சான்றிதழ்' : (targetSvc === 'INCOME' ? 'வருமானச் சான்றிதழ்' : 'CAN பதிவு'));
    const modeText = isMockTest ? '🧪 சுயகற்றல் சோதனை முறை (Mock Sandbox)' : '🚀 நேரலை உற்பத்தி முறை (Live Production)';
    return launchCartridgeChatTask({
        sess, res, runAutomationTask,
        runner: startTnegaCanRegisterFlow,
        payload: p,
        targetMob: p.mobileNumber || targetMobile || activeMobile,
        isMockTest,
        req,
        bannerText: `${modeText}யில் தமிழ்நாடு அரசு TNeGA ${targetNameTam} ஆட்டோமேஷன் தொடங்கப்படுகிறது! 🛡️\n\n` +
            (targetSvc ? `💡 **முதன்மை இலக்கு:** போர்ட்டலில் CAN எண் உள்ளதா எனச் சரிபார்க்கப்பட்டு, CAN இருப்பின் நேரடியாக **${targetNameTam}** விண்ணப்பப் படிவத்திற்குச் செல்லும்!\n\n` : '') +
            `• 👤 **விண்ணப்பதாரர்:** ${p.fullNameTam || p.fullNameEng || 'விண்ணப்பதாரர்'}\n` +
            `• 👩 **தாயின் பெயர்:** ${p.motherNameTam || p.motherNameEng || '—'}\n` +
            `• 🏛️ **வகுப்பு:** ${p.community || '—'}\n` +
            `• 📱 **கைபேசி:** +91 ${p.mobileNumber || targetMobile || activeMobile}\n\n` +
            `Chrome உலாவியில் TNeGA போர்ட்டல் மூலம் படிவம் திறக்கப்படுகிறது...`
    });
}

module.exports = {
    runnerName: 'startTnegaCanRegisterFlow',
    chatStartTriggers: ['LAUNCH_CAN_AUTOMATION'],
    readyStates: ['READY_TO_APPLY_CAN'],
    run,
    startFromChat,
    startTnegaCanRegisterFlow,
    searchCitizenCan,
    registerNewCan
};
