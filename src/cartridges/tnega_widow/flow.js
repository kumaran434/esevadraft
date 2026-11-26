const { isPhysicalDocValid, hasValidSmartCard, buildSmartCardPromptStep } = require('../_tnega_upload_utils');
const { resetTransientServiceInputs } = require('../_fresh_service_guard');

function advanceFlow(sess, prefixMessage = '') {
    sess.subService = 'WIDOW';
    if (!sess.citizenProfile) sess.citizenProfile = {};
    sess.citizenProfile.subService = 'WIDOW';

    const p = sess.citizenProfile;
    const docs = p.documents || {};
    const tu = sess.tempUploads || {};
    const b64 = sess.draftData?.base64Docs || {};

    const hasDeathCert = isPhysicalDocValid(
        p.deathCertificate || p.deathCertificatePath || p.husbandDeathCertificate || docs.deathCertificate || docs.husbandDeathCertificate || tu.deathCertificate,
        b64.deathCertificateBase64 || b64.husbandDeathCertificateBase64
    );
    if (!hasDeathCert) {
        sess.intakeState = 'WIDOW_DEATH_CERT_WAIT';
        const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `🕊️ **விதவைச் சான்றிதழ் (REV-109 Widow Certificate)**\n\n` +
            `📜 **ஆவணம் 1/4: கணவரின் இறப்புச் சான்றிதழ் (Death Certificate of Husband)**\n` +
            `முதலில் கணவரின் **இறப்புச் சான்றிதழைப்** பதிவேற்றவும் (கணவர் பெயர், இறந்த தேதி, சான்றிதழ் எண் ஆகியவை தானாகப் பிரித்தெடுக்கப்படும் ✨):`;
        return {
            text,
            options: [
                { label: "📜 இறப்புச் சான்றிதழ் பதிவேற்றுக (Upload Death Cert)", value: "TRIGGER_FILE_UPLOAD" },
                { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
            ],
            step: sess.intakeState
        };
    }

    const hasPhoto = isPhysicalDocValid(
        p.profilePhoto || p.headPhotoPath || p.headPhoto || p.photo || docs.profilePhoto || docs.headPhoto || tu.profilePhoto || tu.headPhoto,
        b64.profilePhotoBase64 || b64.headPhotoBase64 || b64.photoBase64
    );
    if (!hasPhoto) {
        sess.intakeState = 'WIDOW_PHOTO_WAIT';
        const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `📷 **ஆவணம் 2/4: விண்ணப்பதாரர் பாஸ்போர்ட் புகைப்படம் (Photo <50KB)**\n\n` +
            `TNeGA REV-109 போர்ட்டலில் பதிவேற்ற விண்ணப்பதாரரின் **பாஸ்போர்ட் அளவு புகைப்படத்தைப்** பதிவேற்றவும் (<50KB அளவிற்கு தானாகச் சுருக்கப்படும் ✨):`;
        return {
            text,
            options: [
                { label: "📷 பாஸ்போர்ட் புகைப்படம் பதிவேற்றுக (Upload Photo)", value: "TRIGGER_FILE_UPLOAD" },
                { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
            ],
            step: sess.intakeState
        };
    }

    const hasAadhaarDoc = isPhysicalDocValid(
        p.headAadhaarDocPath || docs.headAadhaar || tu.headAadhaar || p.smartCard || docs.smartCard || tu.smartCard || p.residenceProof?.docPath || p.residenceProof || docs.residenceProof,
        b64.headAadhaarBase64 || b64.smartCardBase64 || b64.residenceProofBase64
    );
    const hasBasicDemographics = Boolean(p.headAadhaar || p.aadhaarNumber || p.fullNameTam || p.fullNameEng);
    if (!hasAadhaarDoc || !hasBasicDemographics) {
        sess.intakeState = 'WIDOW_AADHAAR_WAIT';
        const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `🪪 **ஆவணம் 3/4: விண்ணப்பதாரர் முகவரிச் சான்று (ஆதார் அட்டை / ஸ்மார்ட் கார்டு)**\n\n` +
            `விண்ணப்பதாரரின் பெயர் மற்றும் முகவரியை உறுதிப்படுத்த **ஆதார் அட்டை (அல்லது ஸ்மார்ட் கார்டு)** பதிவேற்றவும்:`;
        return {
            text,
            options: [
                { label: "🪪 ஆதார் / முகவரிச் சான்று பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
            ],
            step: sess.intakeState
        };
    }

    if (!hasValidSmartCard(p, sess)) {
        return buildSmartCardPromptStep(sess, 'WIDOW_SMARTCARD_WAIT', prefixMessage, 'விதவைச் சான்றிதழ் (REV-109)');
    }

    const hasMarriageProof = isPhysicalDocValid(
        p.marriageProof || p.marriageCertificate || docs.marriageProof || docs.marriageCertificate || tu.marriageProof,
        b64.marriageProofBase64 || b64.marriageCertificateBase64
    );
    if (!hasMarriageProof) {
        sess.intakeState = 'WIDOW_MARRIAGE_PROOF_WAIT';
        const hasSmartCardForReuse = hasValidSmartCard(p, sess);
        const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `💍 **ஆவணம் 4/4: திருமண ஆதாரம் (Marriage Proof — Code 201)**\n\n` +
            `திருமணத்தை உறுதிப்படுத்த **திருமணப் பதிவுச் சான்றிதழ் / திருமண அழைப்பிதழ் / குடும்ப ஸ்மார்ட் கார்டு** பதிவேற்றவும்:`;
        return {
            text,
            options: [
                { label: "💍 திருமண ஆதாரம் / அழைப்பிதழ் பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                ...(hasSmartCardForReuse ? [{ label: "📑 பதிவேற்றிய குடும்ப ஸ்மார்ட் கார்டையே திருமண ஆதாரமாகப் பயன்படுத்துக", value: "WD_MAR_PROOF_USE_SMARTCARD" }] : []),
                { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
            ],
            step: sess.intakeState
        };
    }

    const hasValidCan = Boolean(p.canNumber && /^\d{11,15}$/.test(String(p.canNumber).trim()));
    if (!hasValidCan) {
        sess.intakeState = 'WIDOW_CAN_GATE';
        const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `✅ **4/4 கட்டாய ஆவணங்களும் பெறப்பட்டன!**\n\n` +
            `🔢 **அடுத்த படி: CAN எண் சரிபார்ப்பு (REV-109)**\n` +
            `விண்ணப்பதாரருக்கு ஏற்கனவே 13/15-இலக்க CAN எண் உள்ளதா, அல்லது மொபைல்/ஆதார் மூலம் போர்ட்டலில் தேடவா?`;
        return {
            text,
            options: [
                { label: "🔍 போர்ட்டலில் CAN எண் தேடு (Auto CAN Search)", value: "START_CAN_SEARCH" },
                { label: "🔢 என்னிடம் CAN எண் உள்ளது (Enter CAN)", value: "CAN_DIRECT_INPUT" },
                { label: "📝 புதிய CAN பதிவு செய் (Register New CAN)", value: "CAN_REGISTER_PROMPT" }
            ],
            step: sess.intakeState
        };
    }

    if (!p.spouseNameTam && !p.spouseNameEng && !p.husbandNameTam && !p.husbandNameEng) {
        sess.intakeState = 'WIDOW_SPOUSE_NAME_WAIT';
        const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `🕊️ **காலமான கணவரின் பெயர் (Spouse's Name)** என்ன?\n` +
            `இறப்புச் சான்றிதழில் உள்ளபடி கணவரின் முழுப் பெயரைக் கீழே தட்டச்சு செய்யவும்:`;
        return {
            text,
            options: [{ label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }],
            step: sess.intakeState
        };
    }

    if (!p.dateOfDeath) {
        sess.intakeState = 'WIDOW_DEATH_DATE_WAIT';
        const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `📅 **கணவர் இறந்த தேதி (Date of Death)** என்ன?\n` +
            `இறப்புச் சான்றிதழில் உள்ளபடி தேதியைத் தட்டச்சு செய்யவும் *(எ.கா: 15-01-2025)*:`;
        return {
            text,
            options: [
                { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
            ],
            step: sess.intakeState
        };
    }

    if (!p.deathCertificateNo) {
        sess.intakeState = 'WIDOW_DEATH_CERT_NO_WAIT';
        const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `🔢 **இறப்புச் சான்றிதழ் பதிவு எண் (Death Certificate Registration No.)** என்ன?\n` +
            `சான்றிதழில் உள்ள பதிவு எண்ணைக் கீழே தட்டச்சு செய்யவும்:`;
        return {
            text,
            options: [
                { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
            ],
            step: sess.intakeState
        };
    }

    if (!p.dateOfMarriage && !p.dateOfMarriageSkipped) {
        sess.intakeState = 'WIDOW_MARRIAGE_DATE_WAIT';
        const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `💍 **திருமணத் தேதி (Date of Marriage — விருப்பம்)** உள்ளிட விரும்புகிறீர்களா?\n` +
            `*(எ.கா: 12-May-1990 — தெரியாவிட்டால் தவிர்க்கலாம்)*:`;
        return {
            text,
            options: [
                { label: "⏭️ தவிர்க்கவும் (Skip Marriage Date)", value: "WD_MAR_SKIP" },
                { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
            ],
            step: sess.intakeState
        };
    }

    sess.intakeState = 'READY_TO_SUBMIT_WIDOW';
    const spouseDisplay = p.spouseNameTam || p.spouseNameEng || p.husbandNameTam || p.husbandNameEng || '—';
    const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
        `🎉 **விதவைச் சான்றிதழ் (REV-109) விண்ணப்பத்திற்கான விவரங்கள் 100% தயாராக உள்ளன!** 🛡️\n\n` +
        `📋 **விவரங்கள் சுருக்கம்:**\n` +
        `• 🔢 **CAN எண்:** **${p.canNumber}** ✅\n` +
        `• 👤 **விண்ணப்பதாரர்:** ${p.fullNameTam || p.fullNameEng}\n` +
        `• 🕊️ **கணவர் பெயர்:** ${spouseDisplay}\n` +
        `• 📅 **இறந்த தேதி:** **${p.dateOfDeath}**` + (p.dateOfMarriage ? ` | 💍 திருமணத் தேதி: ${p.dateOfMarriage}` : '') + `\n` +
        `• 📜 **இறப்புச் சான்றிதழ் எண்:** **${p.deathCertificateNo}** ✅\n` +
        `• 📁 **ஆவணங்கள் (4/4 தயார்):** புகைப்படம் (<50KB) ✅ | முகவரிச் சான்று ✅ | இறப்புச் சான்றிதழ் ✅ | திருமண ஆதாரம் ✅\n\n` +
        `இப்போது இ-சேவை (TNeGA REV-109) போர்ட்டலில் நேரடி ஆட்டோமேஷன் தொடங்கலாம்!`;

    return {
        text,
        options: [
            { label: "🚀 இ-சேவை போர்ட்டலில் விண்ணப்பிக்கத் தொடங்கு (REV-109)", value: "START_WIDOW_APPLY" },
            { label: "✏️ விவரங்களைச் சரிபார் / திருத்து (Edit Details)", value: "TRIGGER_EDIT_MODAL" },
            { label: "🔄 புதிய விண்ணப்பம் தொடங்க (Reset)", value: "reset" }
        ],
        step: sess.intakeState,
        actionRequired: 'open_edit_modal'
    };
}

function enterService(sess, { greeting = '', isDirectOperator = false, cleanMobile = '', createAppFn = null } = {}) {
    resetTransientServiceInputs(sess);
    sess.subService = 'WIDOW';
    sess.pluginId = 'TNEGA_WIDOW';
    if (sess.citizenProfile) {
        sess.citizenProfile.subService = 'WIDOW';
        sess.citizenProfile.pluginId = 'TNEGA_WIDOW';
    }
    if (isDirectOperator) {
        sess.intakeState = 'WIDOW_INTAKE';
        if (createAppFn && cleanMobile) { try { createAppFn(cleanMobile, 'WIDOW_CERTIFICATE', sess.citizenProfile); } catch (_) {} }
    }
    const flowStep = advanceFlow(sess, greeting);
    const botMsg = { sender: 'bot', text: flowStep.text, options: flowStep.options };
    if (isDirectOperator) sess.chatHistory = [botMsg];
    else sess.chatHistory.push(botMsg);
    return true;
}

function onDocumentDeleted(sess, docType) {
    if (!sess) return false;
    sess.subService = 'WIDOW';
    sess.chatHistory = Array.isArray(sess.chatHistory) ? sess.chatHistory : [];
    const p = sess.citizenProfile || {};
    if (docType === 'deathCertificate' || docType === 'husbandDeathCertificate') {
        delete p.deathCertificate;
        delete p.deathCertificatePath;
        delete p.husbandDeathCertificate;
    } else if (docType === 'marriageProof' || docType === 'marriageCertificate' || docType === 'widowMarriageProof') {
        delete p.marriageProof;
        delete p.marriageCertificate;
        delete p.widowMarriageProof;
    } else if (docType === 'smartCard' || docType === 'rationCard') {
        delete p.smartCard;
        delete p.rationCard;
        delete p.smartCardDocPath;
    } else if (docType === 'headPhoto' || docType === 'profilePhoto') {
        delete p.headPhotoPath;
        delete p.profilePhoto;
    } else if (docType === 'headAadhaar') {
        delete p.headAadhaarDocPath;
    }
    const flowStep = advanceFlow(sess, `🗑️ **தேர்ந்தெடுக்கப்பட்ட ஆவணம் நீக்கப்பட்டது!**`);
    sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
    return true;
}

module.exports = { advanceFlow, enterService, onDocumentDeleted };
