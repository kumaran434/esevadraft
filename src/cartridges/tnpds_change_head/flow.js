const { renderSubserviceReadySummary } = require('../../core/fsm/fsm_summary_formatter');

function enterService(sess) {
    sess.intakeState = 'RATION_CHANGE_HEAD_REASON';
    sess.subService = 'CHANGE_HEAD';
    sess.pluginId = 'TNPDS_CHANGE_HEAD';
    if (sess.citizenProfile) {
        sess.citizenProfile.subService = 'CHANGE_HEAD';
        sess.citizenProfile.pluginId = 'TNPDS_CHANGE_HEAD';
    }
    sess.chatHistory.push({
        sender: 'bot',
        text: `👤 **குடும்பத் தலைவர் மாற்றம் (Change Family Head)**\n\n` +
              `தலைவர் மாற்றத்திற்கான காரணம் என்ன?\n\n` +
              `கீழே உள்ள காரணங்களில் ஒன்றைத் தேர்ந்தெடுக்கவும்:`,
        options: [
            { label: "🕊️ முந்தைய தலைவர் இறந்துவிட்டார் (Death of Head)", value: "HEAD_REASON_DEATH" },
            { label: "👴 முதியவர் / குடும்ப விருப்ப மாற்றம் (Mutual Consent / Age)", value: "HEAD_REASON_CONSENT" },
            { label: "🔙 ரேஷன் கார்டு சேவைகள்", value: "ரேஷன் கார்டு" }
        ]
    });
    return true;
}

function handleFlow(text, sess) {
    if (!sess) return false;
    const currentState = sess.intakeState;

    if (currentState === 'RATION_CHANGE_HEAD' || currentState === 'RATION_CHANGE_HEAD_REASON') {
        sess.subService = 'CHANGE_HEAD';
        const reason = (text && text.includes('இறப்பு')) ? 'முந்தைய தலைவர் இறப்பு' : 'குடும்ப விருப்ப மாற்றம் / முதியவர்';
        sess.subServiceData = { ...(sess.subServiceData || {}), reason };
        sess.intakeState = 'RATION_CHANGE_HEAD_DOC';
        sess.chatHistory.push({
            sender: 'bot',
            text: `👤 **புதிய குடும்பத் தலைவரின் விவரங்கள்**\n\n` +
                  `புதிய தலைவராகப் போகும் நபரின் **ஆதார் அட்டையைப்** பதிவேற்றவும் (அல்லது பெயரைத் தட்டச்சு செய்யவும்):`,
            actionRequired: 'upload',
            uploadPrompt: 'புதிய தலைவர் ஆதார் அட்டை',
            options: [
                { label: "📷 புதிய தலைவர் ஆதார் பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                { label: "✅ ஆதார் தயார் - தொடரவும்", value: "HEAD_DOC_CONFIRMED" },
                { label: "🔙 ரேஷன் கார்டு சேவைகள்", value: "ரேஷன் கார்டு" }
            ]
        });
        return true;
    }

    if (currentState === 'RATION_CHANGE_HEAD_DOC') {
        if (text && text !== 'TRIGGER_FILE_UPLOAD' && text !== 'HEAD_DOC_CONFIRMED') {
            sess.subServiceData = sess.subServiceData || {};
            sess.subServiceData.newHeadName = text;
        }
        sess.intakeState = 'READY_TO_APPLY';
        sess.step = 'READY';
        sess.chatHistory.push(renderSubserviceReadySummary(sess));
        return true;
    }

    return false;
}

function onDocumentDeleted(sess, docType) {
    if (!sess) return false;
    sess.subService = 'CHANGE_HEAD';
    if (sess.subServiceData && docType !== 'smartCard' && docType !== 'rationCard') {
        delete sess.subServiceData.proofDocPath;
        sess.intakeState = 'RATION_CHANGE_HEAD_DOC';
    }
    return true;
}

module.exports = {
    enterService,
    handleFlow,
    handleMinorRationSubservices: handleFlow,
    onDocumentDeleted
};
