const { renderSubserviceReadySummary } = require('../../core/fsm/fsm_summary_formatter');
const { resetTransientServiceInputs } = require('../_fresh_service_guard');
const { extractMobileFromDraftKey } = require('../../services/db/firestore_client');

function enterService(sess) {
    const existingSub = sess.subServiceData || sess.citizenProfile?.subServiceData || {};
    const preservedCardNo = existingSub.smartCardNumber || sess.citizenProfile?.smartCardNumber || sess.citizenProfile?.rationCardNo || '';
    resetTransientServiceInputs(sess);
    sess.service = 'ரேஷன் கார்டு';
    sess.intakeState = 'RATION_CHANGE_MOBILE';
    sess.subService = 'UPDATE_MOBILE';
    sess.pluginId = 'TNPDS_UPDATE_MOBILE';

    const regMob = extractMobileFromDraftKey(sess.citizenProfile?.mobileNumber || sess.mobileNumber || '');

    // Golden Rule 24 (Always-Fresh Service Run): always ask cleanly for the new 10-digit mobile number (zero stale carryover!)
    sess.subServiceData = preservedCardNo ? { smartCardNumber: preservedCardNo } : {};
    if (sess.citizenProfile) {
        sess.citizenProfile.subService = 'UPDATE_MOBILE';
        sess.citizenProfile.pluginId = 'TNPDS_UPDATE_MOBILE';
        sess.citizenProfile.subServiceData = sess.subServiceData;
    }

    sess.step = 'RATION_CHANGE_MOBILE';
    sess.chatHistory.push({
        sender: 'bot',
        text: `📱 **கைபேசி எண் மாற்றம் / பதிவு (Update Registered Mobile Number)**\n\n` +
              (regMob && /^[6-9]\d{9}$/.test(regMob) ? `• 📞 **தற்போதைய பதிவு செய்யப்பட்ட எண்:** +91 ${regMob}\n\n` : '') +
              `ரேஷன் கார்டில் மாற்ற வேண்டிய **புதிய 10-இலக்க கைபேசி எண்ணை (New Mobile Number)** கீழே தட்டச்சு செய்யவும்:`,
        options: [
            { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" },
            { label: "🔙 ரேஷன் கார்டு சேவைகள்", value: "ரேஷன் கார்டு" }
        ]
    });
    return true;
}

function handleFlow(text, sess) {
    if (!sess) return false;
    if (sess.intakeState === 'RATION_CHANGE_MOBILE_RESUME_GATE') {
        const cleanTxt = String(text || '').trim();
        if (cleanTxt === 'UPDATE_MOBILE_RESUME' || /தொடர்க|continue|resume/i.test(cleanTxt)) {
            sess.intakeState = 'READY_TO_APPLY';
            sess.step = 'READY';
            sess.chatHistory.push(renderSubserviceReadySummary(sess));
            return true;
        }
        if (cleanTxt === 'UPDATE_MOBILE_START_NEW' || /வேறு|புதிய|fresh|new/i.test(cleanTxt)) {
            const regMob = extractMobileFromDraftKey(sess.citizenProfile?.mobileNumber || sess.mobileNumber || '');
            sess.subServiceData = {};
            if (sess.citizenProfile) sess.citizenProfile.subServiceData = {};
            sess.intakeState = 'RATION_CHANGE_MOBILE';
            sess.step = 'RATION_CHANGE_MOBILE';
            sess.chatHistory.push({
                sender: 'bot',
                text: `📱 **புதிய கைபேசி எண் மாற்றம்**\n\n` +
                      (regMob && /^[6-9]\d{9}$/.test(regMob) ? `• 📞 **தற்போதைய பதிவு எண்:** +91 ${regMob}\n\n` : '') +
                      `மாற்ற வேண்டிய **புதிய 10-இலக்க கைபேசி எண்ணை** கீழே தட்டச்சு செய்யவும்:`,
                options: [
                    { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" },
                    { label: "🔙 ரேஷன் கார்டு சேவைகள்", value: "ரேஷன் கார்டு" }
                ]
            });
            return true;
        }
    }
    if (sess.intakeState === 'RATION_CHANGE_MOBILE' || sess.intakeState === 'RATION_CHANGE_MOBILE_INPUT') {
        sess.subService = 'UPDATE_MOBILE';
        const regMob = extractMobileFromDraftKey(sess.citizenProfile?.mobileNumber || sess.mobileNumber || '');
        let newMob = String(text || '').replace(/\D/g, '');
        if (newMob.length === 12 && newMob.startsWith('91')) newMob = newMob.slice(2);

        if (!/^[6-9]\d{9}$/.test(newMob)) {
            sess.intakeState = 'RATION_CHANGE_MOBILE';
            sess.chatHistory.push({
                sender: 'bot',
                text: `⚠️ **செல்லுபடியாகும் 10-இலக்க புதிய கைபேசி எண் தேவை!**\n\nதயவுசெய்து 6, 7, 8 அல்லது 9-ல் தொடங்கும் சரியான 10-இலக்க புதிய மொபைல் எண்ணை (எ.கா: \`9842367866\`) தட்டச்சு செய்யவும்:`,
                options: [
                    { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" },
                    { label: "🔙 ரேஷன் கார்டு சேவைகள்", value: "ரேஷன் கார்டு" }
                ]
            });
            return true;
        }

        if (regMob && newMob === regMob) {
            sess.intakeState = 'RATION_CHANGE_MOBILE';
            sess.chatHistory.push({
                sender: 'bot',
                text: `⚠️ **பழைய எண்ணும் (+91 ${regMob}) புதிய எண்ணும் ஒன்றாக இருக்கக்கூடாது!**\n\nதயவுசெய்து வேறு புதிய 10-இலக்க மொபைல் எண்ணை உள்ளிடவும்:`
            });
            return true;
        }

        sess.subServiceData = {
            ...(sess.subServiceData || {}),
            newMobile: newMob,
            isMobileUpdateEntered: true
        };
        if (sess.citizenProfile) sess.citizenProfile.subServiceData = sess.subServiceData;
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
