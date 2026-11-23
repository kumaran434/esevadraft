const { renderSubserviceReadySummary } = require('../../core/fsm/fsm_summary_formatter');

function enterService(sess) {
    sess.intakeState = 'RATION_REMOVE_MEMBER_REASON';
    sess.subService = 'REMOVE_MEMBER';
    sess.pluginId = 'TNPDS_REMOVE_MEMBER';
    if (sess.citizenProfile) {
        sess.citizenProfile.subService = 'REMOVE_MEMBER';
        sess.citizenProfile.pluginId = 'TNPDS_REMOVE_MEMBER';
    }
    sess.chatHistory.push({
        sender: 'bot',
        text: `➖ **குடும்ப உறுப்பினர் நீக்கம் (Remove Family Member)**\n\n` +
              `குடும்ப அட்டையிலிருந்து உறுப்பினரை நீக்குவதற்கான காரணம் என்ன?\n\n` +
              `கீழே உள்ள காரணங்களில் ஒன்றைத் தேர்ந்தெடுக்கவும்:`,
        options: [
            { label: "🕊️ இறப்பு காரணமாக (Death of Member)", value: "REMOVE_REASON_DEATH" },
            { label: "💍 திருமணம் காரணமாக (Marriage)", value: "REMOVE_REASON_MARRIAGE" },
            { label: "📄 தனி அட்டை பிரிப்பு (Separate Card)", value: "REMOVE_REASON_SPLIT" },
            { label: "🔙 ரேஷன் கார்டு சேவைகள்", value: "ரேஷன் கார்டு" }
        ]
    });
    return true;
}

function handleFlow(text, sess) {
    if (!sess) return false;
    const currentState = sess.intakeState;

    if (text === 'RATION_REMOVE_MEMBER_RESET' || (text && text.includes('உறுப்பினர் நீக்கத்தை மாற்று'))) {
        sess.subServiceData = {};
        return enterService(sess);
    }

    if (currentState === 'RATION_REMOVE_MEMBER' || currentState === 'RATION_REMOVE_MEMBER_REASON') {
        sess.subService = 'REMOVE_MEMBER';
        let reason = 'காரணம் குறிப்பிடப்படவில்லை';
        let docType = 'இறப்புச் சான்றிதழ்';
        if (text === 'REMOVE_REASON_DEATH' || text.includes('இறப்பு')) {
            reason = 'இறப்பு (Death of Member)';
            docType = 'இறப்புச் சான்றிதழ் (Death Certificate)';
        } else if (text === 'REMOVE_REASON_MARRIAGE' || text.includes('திருமணம்')) {
            reason = 'திருமணம் (Marriage)';
            docType = 'திருமண அழைப்பிதழ் / சான்றிதழ் (Marriage Certificate)';
        } else if (text === 'REMOVE_REASON_SPLIT' || text.includes('பிரிப்பு')) {
            reason = 'தனி அட்டை பிரிப்பு (Separate Card)';
            docType = 'தனி அட்டை சான்று / வாடகை ஒப்பந்தம் (Split Proof)';
        } else if (text && text !== 'TRIGGER_FILE_UPLOAD' && text !== 'REMOVE_DOC_CONFIRMED') {
            reason = text;
            docType = 'இதர ஆவணம் (Other Document)';
        }

        sess.subServiceData = { ...(sess.subServiceData || {}), reason, docType };
        sess.intakeState = 'RATION_REMOVE_MEMBER_DOC';

        const memberOptions = [];
        const existingMembers = (sess.citizenProfile && Array.isArray(sess.citizenProfile.members)) ? sess.citizenProfile.members : [];
        existingMembers.forEach((m, idx) => {
            const mName = m.nameTam || m.nameEng || m.name;
            if (mName && mName !== 'வாடிக்கையாளர்') {
                memberOptions.push({
                    label: `👤 ${mName} (${m.relationshipTam || m.relationship || 'உறுப்பினர்'})`,
                    value: `REMOVE_SELECT_MEMBER_${idx}`
                });
            }
        });

        const defaultOptions = [
            ...memberOptions,
            { label: "📷 சான்றிதழ் பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
            { label: "✅ சான்றிதழ் தயார் - தொடரவும்", value: "REMOVE_DOC_CONFIRMED" },
            { label: "🔙 ரேஷன் கார்டு சேவைகள்", value: "ரேஷன் கார்டு" }
        ];

        sess.chatHistory.push({
            sender: 'bot',
            text: `➖ **${reason} காரணமாக உறுப்பினர் நீக்கம்**\n\n` +
                  (memberOptions.length > 0 ? `கீழே உள்ள பட்டியலில் நீக்கப்பட வேண்டிய உறுப்பினரைத் தேர்ந்தெடுக்கவும் (அல்லது பெயரைத் தட்டச்சு செய்யவும்):\n\n` : `நீக்கப்பட வேண்டிய நபரின் பெயரைத் தட்டச்சு செய்யவும்:\n\n`) +
                  `📄 **தேவையான ஆவணம்:** ${docType} பதிவேற்றப்பட வேண்டும்.`,
            actionRequired: 'upload',
            uploadPrompt: `${docType} பதிவேற்றுக`,
            options: defaultOptions
        });
        return true;
    }

    if (currentState === 'RATION_REMOVE_MEMBER_DOC') {
        sess.subServiceData = sess.subServiceData || {};
        if (text && text.startsWith('REMOVE_SELECT_MEMBER_')) {
            const mIdx = parseInt(text.replace('REMOVE_SELECT_MEMBER_', ''), 10);
            const existingMembers = (sess.citizenProfile && Array.isArray(sess.citizenProfile.members)) ? sess.citizenProfile.members : [];
            const selectedMember = existingMembers[mIdx];
            if (selectedMember) {
                sess.subServiceData.memberName = selectedMember.nameEng || selectedMember.nameTam || selectedMember.name;
                sess.subServiceData.memberNameTam = selectedMember.nameTam || selectedMember.name;
                sess.subServiceData.memberNameEng = selectedMember.nameEng || selectedMember.name;
                sess.subServiceData.relationshipTam = selectedMember.relationshipTam || selectedMember.relationship || '';
                sess.subServiceData.aadhaarNo = selectedMember.aadhaarNumber || '';
            }
        } else if (text && text !== 'TRIGGER_FILE_UPLOAD' && text !== 'REMOVE_DOC_CONFIRMED') {
            sess.subServiceData.memberName = text;
            sess.subServiceData.memberNameTam = text;
            sess.subServiceData.memberNameEng = text;
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
    sess.subService = 'REMOVE_MEMBER';
    if (sess.subServiceData && (docType === 'removeProof' || docType === 'deathCertificate' || docType === 'marriageCertificate')) {
        delete sess.subServiceData.proofDocPath;
        delete sess.subServiceData.deathCertDocPath;
        sess.intakeState = 'RATION_REMOVE_MEMBER_DOC';
    }
    return true;
}

module.exports = {
    enterService,
    handleFlow,
    handleMinorRationSubservices: handleFlow,
    onDocumentDeleted
};
