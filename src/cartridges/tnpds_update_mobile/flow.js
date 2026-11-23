const { renderSubserviceReadySummary } = require('../../core/fsm/fsm_summary_formatter');

function enterService(sess) {
    sess.intakeState = 'RATION_CHANGE_MOBILE';
    sess.subService = 'UPDATE_MOBILE';
    sess.pluginId = 'TNPDS_UPDATE_MOBILE';
    if (sess.citizenProfile) {
        sess.citizenProfile.subService = 'UPDATE_MOBILE';
        sess.citizenProfile.pluginId = 'TNPDS_UPDATE_MOBILE';
    }
    sess.chatHistory.push({
        sender: 'bot',
        text: `📱 **கைபேசி எண் மாற்றம் / பதிவு (Update Registered Mobile Number)**\n\n` +
              `ரேஷன் கார்டில் பதிவு செய்யப்பட்டுள்ள பழைய எண்ணை மாற்றி புதிய மொபைல் எண்ணைப் பதிவு செய்யலாம்.\n\n` +
              `குடும்பத் தலைவரின் **ஆதார் அட்டையைப்** பதிவேற்றவும் (அல்லது புதிய மொபைல் எண்ணைத் தட்டச்சு செய்யவும்):`,
        options: [
            { label: "📷 தலைவர் ஆதார் அட்டை", value: "TRIGGER_FILE_UPLOAD" },
            { label: "🔙 ரேஷன் கார்டு சேவைகள்", value: "ரேஷன் கார்டு" }
        ]
    });
    return true;
}

function handleFlow(text, sess) {
    if (!sess) return false;
    if (sess.intakeState === 'RATION_CHANGE_MOBILE') {
        sess.subService = 'UPDATE_MOBILE';
        const newMob = (text || '').replace(/\D/g, '');
        if (newMob.length === 10) {
            sess.subServiceData = { ...(sess.subServiceData || {}), newMobile: newMob };
        }
        sess.intakeState = 'READY_TO_APPLY';
        sess.step = 'READY';
        sess.chatHistory.push(renderSubserviceReadySummary(sess));
        return true;
    }
    return false;
}

function onDocumentDeleted(sess) {
    if (!sess) return false;
    sess.subService = 'UPDATE_MOBILE';
    return true;
}

module.exports = {
    enterService,
    handleFlow,
    handleMinorRationSubservices: handleFlow,
    onDocumentDeleted
};
