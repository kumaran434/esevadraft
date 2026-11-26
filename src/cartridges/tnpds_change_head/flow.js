const { renderSubserviceReadySummary } = require('../../core/fsm/fsm_summary_formatter');
const { resetTransientServiceInputs } = require('../_fresh_service_guard');

function enterService(sess) {
    resetTransientServiceInputs(sess);
    sess.intakeState = 'RATION_CHANGE_HEAD_REASON';
    sess.step = 'RATION_CHANGE_HEAD_REASON';
    sess.subService = 'CHANGE_HEAD';
    sess.pluginId = 'TNPDS_CHANGE_HEAD';
    // 2-Lane Always-Fresh Rule: clear stale previous change-head state cleanly
    sess.subServiceData = {};
    if (sess.citizenProfile) {
        sess.citizenProfile.subService = 'CHANGE_HEAD';
        sess.citizenProfile.pluginId = 'TNPDS_CHANGE_HEAD';
        sess.citizenProfile.subServiceData = {};
    }
    sess.chatHistory.push({
        sender: 'bot',
        text: `👤 **குடும்பத் தலைவர் மாற்றம் (Change Family Head)**\n\n` +
              `1️⃣ **தலைவர் மாற்றத்திற்கான காரணம் என்ன?**\n\n` +
              `கீழே உள்ள காரணங்களில் ஒன்றைத் தேர்ந்தெடுக்கவும்:`,
        options: [
            { label: "🕊️ முந்தைய தலைவர் இறந்துவிட்டார் (Death of Head)", value: "HEAD_REASON_DEATH" },
            { label: "👴 முதியவர் / குடும்ப விருப்ப மாற்றம் (Mutual Consent / Age)", value: "HEAD_REASON_CONSENT" },
            { label: "🔙 ரேஷன் கார்டு சேவைகள்", value: "ரேஷன் கார்டு" }
        ]
    });
    return true;
}

function collectEligibleNewHeads(sess) {
    const out = [];
    const seen = new Set();
    const headAadh = String(sess?.citizenProfile?.headAadhaar || '').replace(/\D/g, '');
    const headName = String(sess?.citizenProfile?.fullNameTam || sess?.citizenProfile?.fullNameEng || '').trim().toLowerCase();
    const pushM = (m) => {
        if (!m) return;
        const name = String(m.nameTam || m.memberNameTam || m.nameEng || m.memberNameEng || m.name || m.memberName || '').trim();
        if (!name || name === 'வாடிக்கையாளர்' || name === 'புதிய குடும்ப உறுப்பினர்') return;
        const mAadh = String(m.aadhaarNumber || m.aadhaarNo || '').replace(/\D/g, '');
        if ((headAadh && mAadh && mAadh === headAadh) || (headName && name.toLowerCase() === headName)) return;
        if (m.relationship === 'Family Head' || m.relationshipTam === 'குடும்ப தலைவர்') return;
        const key = name.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        out.push({
            nameTam: m.nameTam || m.memberNameTam || name,
            nameEng: m.nameEng || m.memberNameEng || name,
            relationshipTam: m.relationshipTam || m.relationship || 'உறுப்பினர்',
            aadhaarNo: mAadh
        });
    };
    if (Array.isArray(sess?.citizenProfile?.members)) sess.citizenProfile.members.forEach(pushM);
    if (Array.isArray(sess?.citizenProfile?.savedFamilyMembers)) sess.citizenProfile.savedFamilyMembers.forEach(pushM);
    return out;
}

function handleFlow(text, sess, uploadedDoc = null, extractedDoc = null) {
    if (!sess) return false;
    const currentState = sess.intakeState;

    if (currentState === 'RATION_CHANGE_HEAD' || currentState === 'RATION_CHANGE_HEAD_REASON') {
        sess.subService = 'CHANGE_HEAD';
        const isDeath = Boolean(text && (text === 'HEAD_REASON_DEATH' || text.includes('இறப்பு')));
        const reason = isDeath ? 'முந்தைய தலைவர் இறப்பு' : 'குடும்ப விருப்ப மாற்றம் / முதியவர்';
        sess.subServiceData = { ...(sess.subServiceData || {}), reason, isDeath };
        if (sess.citizenProfile) sess.citizenProfile.subServiceData = sess.subServiceData;
        sess.intakeState = 'RATION_CHANGE_HEAD_DOC';

        const candidates = collectEligibleNewHeads(sess);
        const candOpts = candidates.slice(0, 4).map((m, i) => ({
            label: `👤 ${m.nameTam} (${m.relationshipTam})`,
            value: `HEAD_SELECT_MEMBER_${i}`
        }));

        sess.chatHistory.push({
            sender: 'bot',
            text: `👤 **புதிய குடும்பத் தலைவரின் விவரங்கள்**\n\n` +
                  (candOpts.length > 0 ? `2️⃣ **புதிய தலைவராகப் போகும் நபரைத் தேர்ந்தெடுக்கவும்** (அல்லது ஆதார் அட்டை பதிவேற்றவும் / பெயர் தட்டச்சு செய்யவும்):` : `2️⃣ **புதிய தலைவராகப் போகும் நபரின் ஆதார் அட்டையைப் பதிவேற்றவும்** (அல்லது பெயரைத் தட்டச்சு செய்யவும்):`),
            actionRequired: 'upload',
            uploadPrompt: isDeath ? 'இறப்புச் சான்றிதழ் / புதிய தலைவர் ஆதார்' : 'புதிய தலைவர் ஆதார் அட்டை',
            options: [
                ...candOpts,
                { label: "📷 புதிய தலைவர் ஆதார் / சான்று பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                { label: "✅ ஆதார் தயார் - தொடரவும்", value: "HEAD_DOC_CONFIRMED" },
                { label: "🔙 ரேஷன் கார்டு சேவைகள்", value: "ரேஷன் கார்டு" }
            ]
        });
        return true;
    }

    if (currentState === 'RATION_CHANGE_HEAD_DOC') {
        sess.subServiceData = sess.subServiceData || {};
        if (uploadedDoc && uploadedDoc.path) {
            sess.subServiceData.proofDocPath = uploadedDoc.path;
            sess.subServiceData.docPath = uploadedDoc.path;
            if (extractedDoc && (extractedDoc.fullNameTam || extractedDoc.fullNameEng)) {
                sess.subServiceData.newHeadName = extractedDoc.fullNameTam || extractedDoc.fullNameEng;
                sess.subServiceData.newHeadNameTam = extractedDoc.fullNameTam || extractedDoc.fullNameEng;
                sess.subServiceData.newHeadNameEng = extractedDoc.fullNameEng || extractedDoc.fullNameTam;
                if (extractedDoc.aadhaarNumber) sess.subServiceData.newHeadAadhaar = extractedDoc.aadhaarNumber;
            }
        }
        if (text && text.startsWith('HEAD_SELECT_MEMBER_')) {
            const idx = parseInt(text.replace('HEAD_SELECT_MEMBER_', ''), 10);
            const candidates = collectEligibleNewHeads(sess);
            const sel = candidates[idx];
            if (sel) {
                sess.subServiceData.newHeadName = sel.nameTam;
                sess.subServiceData.newHeadNameTam = sel.nameTam;
                sess.subServiceData.newHeadNameEng = sel.nameEng;
                sess.subServiceData.newHeadAadhaar = sel.aadhaarNo || '';
            }
        } else if (text && text !== 'TRIGGER_FILE_UPLOAD' && text !== 'HEAD_DOC_CONFIRMED') {
            sess.subServiceData.newHeadName = text;
            sess.subServiceData.newHeadNameTam = text;
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
