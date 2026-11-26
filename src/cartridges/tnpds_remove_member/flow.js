const { renderSubserviceReadySummary } = require('../../core/fsm/fsm_summary_formatter');
const { resetTransientServiceInputs } = require('../_fresh_service_guard');

function enterService(sess) {
    resetTransientServiceInputs(sess);
    sess.intakeState = 'RATION_REMOVE_MEMBER_REASON';
    sess.step = 'RATION_REMOVE_MEMBER_REASON';
    sess.subService = 'REMOVE_MEMBER';
    sess.pluginId = 'TNPDS_REMOVE_MEMBER';
    // 2-Lane Always-Fresh Rule: clear stale previous removal attempt cleanly while keeping Master Profile intact
    sess.subServiceData = {};
    if (sess.citizenProfile) {
        sess.citizenProfile.subService = 'REMOVE_MEMBER';
        sess.citizenProfile.pluginId = 'TNPDS_REMOVE_MEMBER';
        sess.citizenProfile.subServiceData = {};
    }
    sess.chatHistory.push({
        sender: 'bot',
        text: `➖ **குடும்ப உறுப்பினர் நீக்கம் (Remove Family Member)**\n\n` +
              `1️⃣ **குடும்ப அட்டையிலிருந்து உறுப்பினரை நீக்குவதற்கான காரணம் என்ன?**\n\n` +
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

function collectKnownFamilyMembers(sess) {
    const out = [];
    const seen = new Set();
    const pushM = (m) => {
        if (!m) return;
        const name = String(m.nameTam || m.memberNameTam || m.nameEng || m.memberNameEng || m.name || m.memberName || '').trim();
        if (!name || name === 'வாடிக்கையாளர்' || name === 'புதிய குடும்ப உறுப்பினர்') return;
        const key = name.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        out.push({
            nameTam: m.nameTam || m.memberNameTam || name,
            nameEng: m.nameEng || m.memberNameEng || name,
            relationshipTam: m.relationshipTam || m.relationship || 'உறுப்பினர்',
            aadhaarNumber: m.aadhaarNumber || m.aadhaarNo || ''
        });
    };
    if (Array.isArray(sess?.citizenProfile?.members)) sess.citizenProfile.members.forEach(pushM);
    if (Array.isArray(sess?.citizenProfile?.savedFamilyMembers)) sess.citizenProfile.savedFamilyMembers.forEach(pushM);
    return out;
}

function handleFlow(text, sess, uploadedDoc = null, extractedDoc = null) {
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
        if (sess.citizenProfile) sess.citizenProfile.subServiceData = sess.subServiceData;
        sess.intakeState = 'RATION_REMOVE_MEMBER_DOC';

        const knownMembers = collectKnownFamilyMembers(sess);
        const memberOptions = knownMembers.slice(0, 5).map((m, idx) => ({
            label: `👤 ${m.nameTam} (${m.relationshipTam})`,
            value: `REMOVE_SELECT_MEMBER_${idx}`
        }));

        const defaultOptions = [
            ...memberOptions,
            { label: "📷 சான்றிதழ் பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
            { label: "✅ சான்றிதழ் தயார் - தொடரவும்", value: "REMOVE_DOC_CONFIRMED" },
            { label: "🔙 ரேஷன் கார்டு சேவைகள்", value: "ரேஷன் கார்டு" }
        ];

        sess.chatHistory.push({
            sender: 'bot',
            text: `➖ **${reason} காரணமாக உறுப்பினர் நீக்கம்**\n\n` +
                  (memberOptions.length > 0 ? `2️⃣ **கீழே உள்ள பட்டியலில் நீக்கப்பட வேண்டிய உறுப்பினரைத் தேர்ந்தெடுக்கவும்** (அல்லது வேறு நபரின் பெயரைத் தட்டச்சு செய்யவும்):\n\n` : `2️⃣ **நீக்கப்பட வேண்டிய நபரின் பெயரைத் தட்டச்சு செய்யவும்** (அல்லது சான்றிதழைப் பதிவேற்றவும்):\n\n`) +
                  `📄 **தேவையான ஆவணம்:** ${docType} பதிவேற்றப்பட வேண்டும்.`,
            actionRequired: 'upload',
            uploadPrompt: `${docType} பதிவேற்றுக`,
            options: defaultOptions
        });
        return true;
    }

    if (currentState === 'RATION_REMOVE_MEMBER_DOC') {
        sess.subServiceData = sess.subServiceData || {};
        if (uploadedDoc && uploadedDoc.path) {
            sess.subServiceData.proofDocPath = uploadedDoc.path;
            sess.subServiceData.docPath = uploadedDoc.path;
            sess.tempUploads = sess.tempUploads || {};
            sess.tempUploads.removeProof = uploadedDoc.path;
            if (sess.citizenProfile) {
                sess.citizenProfile.documents = sess.citizenProfile.documents || {};
                sess.citizenProfile.documents.removeProof = uploadedDoc.path;
            }
            if (extractedDoc && !sess.subServiceData.memberNameTam && (extractedDoc.fullNameTam || extractedDoc.fullNameEng)) {
                sess.subServiceData.memberNameTam = extractedDoc.fullNameTam || extractedDoc.fullNameEng;
                sess.subServiceData.memberNameEng = extractedDoc.fullNameEng || extractedDoc.fullNameTam;
                sess.subServiceData.memberName = sess.subServiceData.memberNameTam;
            }
        }
        if (text && text.startsWith('REMOVE_SELECT_MEMBER_')) {
            const mIdx = parseInt(text.replace('REMOVE_SELECT_MEMBER_', ''), 10);
            const knownMembers = collectKnownFamilyMembers(sess);
            const selectedMember = knownMembers[mIdx];
            if (selectedMember) {
                sess.subServiceData.memberName = selectedMember.nameEng || selectedMember.nameTam;
                sess.subServiceData.memberNameTam = selectedMember.nameTam;
                sess.subServiceData.memberNameEng = selectedMember.nameEng;
                sess.subServiceData.relationshipTam = selectedMember.relationshipTam || '';
                sess.subServiceData.aadhaarNo = selectedMember.aadhaarNumber || '';
            }
        } else if (text && text !== 'TRIGGER_FILE_UPLOAD' && text !== 'REMOVE_DOC_CONFIRMED') {
            sess.subServiceData.memberName = text;
            sess.subServiceData.memberNameTam = text;
            sess.subServiceData.memberNameEng = text;
        }
        if (sess.citizenProfile) sess.citizenProfile.subServiceData = sess.subServiceData;

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
