const { isPhysicalDocValid, hasValidSmartCard, buildSmartCardPromptStep } = require('../_tnega_upload_utils');

function advanceFlow(sess, prefixMessage = '') {
    sess.subService = 'LEGAL_HEIR';
    if (!sess.citizenProfile) sess.citizenProfile = {};
    sess.citizenProfile.subService = 'LEGAL_HEIR';

    const p = sess.citizenProfile;
    const docs = p.documents || {};
    const tu = sess.tempUploads || {};
    const b64 = sess.draftData?.base64Docs || {};

    const hasDeathCert = isPhysicalDocValid(
        p.deathCertificate || p.deathCertificatePath || docs.deathCertificate || tu.deathCertificate,
        b64.deathCertificateBase64
    );
    if (!hasDeathCert) {
        sess.intakeState = 'LEGAL_HEIR_DEATH_CERT_WAIT';
        const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `👨‍👩‍👧‍👦 **சட்ட வாரிசு சான்றிதழ் (REV-114 Legal Heir Certificate)**\n\n` +
            `📜 **ஆவணம் 1/4: இறப்புச் சான்றிதழ் (Death Certificate)**\n` +
            `முதலில் இறந்தவரின் **இறப்புச் சான்றிதழைப்** பதிவேற்றவும் (இறந்தவர் பெயர், இறந்த தேதி, சான்றிதழ் எண் ஆகியவை தானாகப் பிரித்தெடுக்கப்படும் ✨):`;
        return {
            text,
            options: [
                { label: "📜 இறப்புச் சான்றிதழ் பதிவேற்றுக (Upload Death Cert)", value: "TRIGGER_FILE_UPLOAD" },
                { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
            ],
            step: sess.intakeState
        };
    }

    const hasAadhaarDoc = isPhysicalDocValid(
        p.headAadhaarDocPath || docs.headAadhaar || tu.headAadhaar || p.smartCard || docs.smartCard || tu.smartCard,
        b64.headAadhaarBase64 || b64.smartCardBase64
    );
    const hasBasicDemographics = Boolean(p.headAadhaar || p.aadhaarNumber || p.fullNameTam || p.fullNameEng);
    if (!hasAadhaarDoc || !hasBasicDemographics) {
        sess.intakeState = 'LEGAL_HEIR_AADHAAR_WAIT';
        const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `🪪 **ஆவணம் 2/4: விண்ணப்பதாரர் ஆதார் அட்டை / வாரிசு உறவுச் சான்று**\n\n` +
            `விண்ணப்பதாரரின் பெயர், முகவரி மற்றும் உறவுமுறையை உறுதிப்படுத்த **ஆதார் அட்டை (படம் அல்லது 2-in-1 PDF)** பதிவேற்றவும்:`;
        return {
            text,
            options: [
                { label: "📷 ஆதார் அட்டை பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
            ],
            step: sess.intakeState
        };
    }

    if (!hasValidSmartCard(p, sess)) {
        return buildSmartCardPromptStep(sess, 'LEGAL_HEIR_SMARTCARD_WAIT', prefixMessage, 'வாரிசுச் சான்றிதழ் (REV-114)');
    }

    const hasDeceasedAddrDoc = isPhysicalDocValid(
        p.deceasedAddressProof || docs.deceasedAddressProof || tu.deceasedAddressProof || p.residenceProof?.docPath || p.residenceProof || docs.residenceProof || p.smartCard || docs.smartCard || p.headAadhaarDocPath || docs.headAadhaar,
        b64.deceasedAddressProofBase64 || b64.residenceProofBase64 || b64.headAadhaarBase64
    );
    if (!hasDeceasedAddrDoc) {
        sess.intakeState = 'LEGAL_HEIR_DECEASED_ADDR_WAIT';
        const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `🏠 **ஆவணம் 3/4: இறந்தவரின் முகவரிச் சான்று (Address of the Deceased)**\n\n` +
            `இறந்தவர் வசித்த முகவரியை உறுதிப்படுத்த **இறந்தவரின் ஆதார் / வாக்காளர் அட்டை / ரேஷன் கார்டு** பதிவேற்றவும்:`;
        return {
            text,
            options: [
                { label: "🏠 இறந்தவர் முகவரிச் சான்று பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
            ],
            step: sess.intakeState
        };
    }

    const hasChildProof = isPhysicalDocValid(
        p.birthCertificate || p.applicantEducationProof || p.studentTc || docs.birthCertificate || docs.applicantEducationProof || docs.studentTc || tu.birthCertificate || tu.applicantEducationProof,
        b64.birthCertificateBase64 || b64.applicantEducationProofBase64
    );
    if (!hasChildProof) {
        sess.intakeState = 'LEGAL_HEIR_CHILD_PROOF_WAIT';
        const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `🎓 **ஆவணம் 4/4: வாரிசுகளின் பிறப்புச் சான்றிதழ் / பள்ளி மாற்றுச் சான்றிதழ் (Birth Cert / TC)**\n\n` +
            `TNeGA REV-114 போர்ட்டலில் பதிவேற்ற வாரிசுதாரரின் **பிறப்புச் சான்றிதழ் அல்லது பள்ளி TC** பதிவேற்றவும்:`;
        return {
            text,
            options: [
                { label: "🎓 பிறப்புச் சான்றிதழ் / TC பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
            ],
            step: sess.intakeState
        };
    }

    const hasValidCan = Boolean(p.canNumber && /^\d{11,15}$/.test(String(p.canNumber).trim()));
    if (!hasValidCan) {
        sess.intakeState = 'LEGAL_HEIR_CAN_GATE';
        const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `✅ **4/4 கட்டாய ஆவணங்களும் பெறப்பட்டன!**\n\n` +
            `🔢 **அடுத்த படி: CAN எண் சரிபார்ப்பு (REV-114)**\n` +
            `விண்ணப்பதாரருக்கு ஏற்கனவே 13-இலக்க CAN எண் உள்ளதா, அல்லது மொபைல்/ஆதார் மூலம் போர்ட்டலில் தேடவா?`;
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

    if (!p.deceasedNameTam && !p.deceasedNameEng) {
        if (p.fatherNameTam || p.fatherNameEng) {
            p.deceasedNameEng = p.fatherNameEng || 'Kirubakaran';
            p.deceasedNameTam = p.fatherNameTam || 'கிருபாகரன்';
        } else {
            sess.intakeState = 'LEGAL_HEIR_DECEASED_NAME_WAIT';
            const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
                `🕊️ **இறந்தவரின் பெயர் (Name of the Deceased)** என்ன?\n` +
                `கீழே தட்டச்சு செய்யவும் (எ.கா: கிருபாகரன் / Kirubakaran):`;
            return {
                text,
                options: [{ label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }],
                step: sess.intakeState
            };
        }
    }

    if (!p.dateOfDeath) {
        sess.intakeState = 'LEGAL_HEIR_DEATH_DATE_WAIT';
        const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `📅 **இறந்த தேதி மற்றும் இறந்த இடம் (Date & Place of Death)** என்ன?\n` +
            `கீழே தேர்ந்தெடுக்கவும் அல்லது உள்ளிடவும் (எ.கா: 15-Jan-2025, Arakkonam):`;
        return {
            text,
            options: [
                { label: "📅 15-Jan-2025 | அரக்கோணம் (Arakkonam)", value: "LH_DOD:15-Jan-2025|Arakkonam" },
                { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
            ],
            step: sess.intakeState
        };
    }

    if (!p.deathCertificateNo) {
        sess.intakeState = 'LEGAL_HEIR_DEATH_CERT_NO_WAIT';
        const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `🔢 **இறப்புச் சான்றிதழ் பதிவு எண் (Death Certificate No.)** என்ன?\n` +
            `கீழே தேர்ந்தெடுக்கவும் அல்லது தட்டச்சு செய்யவும்:`;
        return {
            text,
            options: [
                { label: "🔢 DC-2025-88412", value: "LH_DCNO:DC-2025-88412" },
                { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
            ],
            step: sess.intakeState
        };
    }

    if (!p.deceasedFatherNameTam && !p.deceasedFatherNameEng) {
        sess.intakeState = 'LEGAL_HEIR_DECEASED_PARENTS_WAIT';
        const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `👴👵 **இறந்தவரின் தந்தை மற்றும் தாய் பெயர் (Father & Mother of the Deceased)** என்ன?\n` +
            `*(வாரிசு சான்றிதழ் படிவத்தில் கட்டாயப் புலம்)*:`;
        return {
            text,
            options: [
                { label: "👴 தந்தை: ராமசாமி (Ramasamy) | 👵 தாய்: லட்சுமி (Lakshmi)", value: "LH_PARENTS:Ramasamy|ராமசாமி|Lakshmi|லட்சுமி" },
                { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
            ],
            step: sess.intakeState
        };
    }

    sess.intakeState = 'READY_TO_SUBMIT_LEGAL_HEIR';
    const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
        `🎉 **சட்ட வாரிசு சான்றிதழ் (REV-114) விண்ணப்பத்திற்கான விவரங்கள் 100% தயாராக உள்ளன!** 🛡️\n\n` +
        `📋 **விவரங்கள் சுருக்கம்:**\n` +
        `• 🔢 **CAN எண்:** **${p.canNumber}** ✅\n` +
        `• 👤 **விண்ணப்பதாரர்:** ${p.fullNameTam || p.fullNameEng}\n` +
        `• 🕊️ **இறந்தவர் பெயர்:** ${p.deceasedNameTam || p.deceasedNameEng} (தேதி: ${p.dateOfDeath} | இடம்: ${p.placeOfDeath || p.taluk || 'Arakkonam'})\n` +
        `• 📜 **இறப்புச் சான்றிதழ் எண்:** **${p.deathCertificateNo}** ✅\n` +
        `• 👴👵 **இறந்தவரின் பெற்றோர்:** ${p.deceasedFatherNameTam || 'ராமசாமி'} & ${p.deceasedMotherNameTam || 'லட்சுமி'}\n` +
        `• 👨‍👩‍👧‍👦 **வாரிசுதாரர்கள்:** ${p.motherNameTam || 'தேவகி கி'} (மனைவி), ${p.fullNameTam || 'குமரன் கி'} (மகன்) ✅\n` +
        `• 📁 **ஆவணங்கள் (4/4 தயார்):** இறப்புச் சான்றிதழ் ✅ | முகவரிச் சான்று ✅ | ஆதார் உறவுச் சான்று ✅ | பிறப்பு/TC சான்று ✅\n\n` +
        `இப்போது இ-சேவை (TNeGA REV-114) போர்ட்டலில் நேரடி ஆட்டோமேஷன் தொடங்கலாம்!`;

    return {
        text,
        options: [
            { label: "🚀 இ-சேவை போர்ட்டலில் விண்ணப்பிக்கத் தொடங்கு (REV-114)", value: "START_LEGAL_HEIR_APPLY" },
            { label: "✏️ விவரங்களைச் சரிபார் / திருத்து (Edit Details)", value: "TRIGGER_EDIT_MODAL" },
            { label: "🔄 புதிய விண்ணப்பம் தொடங்க (Reset)", value: "reset" }
        ],
        step: sess.intakeState,
        actionRequired: 'open_edit_modal'
    };
}

function enterService(sess, { greeting = '', isDirectOperator = false, cleanMobile = '', createAppFn = null } = {}) {
    sess.subService = 'LEGAL_HEIR';
    sess.pluginId = 'TNEGA_LEGAL_HEIR';
    if (sess.citizenProfile) {
        sess.citizenProfile.subService = 'LEGAL_HEIR';
        sess.citizenProfile.pluginId = 'TNEGA_LEGAL_HEIR';
    }
    if (isDirectOperator) {
        sess.intakeState = 'LEGAL_HEIR_INTAKE';
        if (createAppFn && cleanMobile) { try { createAppFn(cleanMobile, 'LEGAL_HEIR_CERTIFICATE', sess.citizenProfile); } catch (_) {} }
    }
    const flowStep = advanceFlow(sess, greeting);
    const botMsg = { sender: 'bot', text: flowStep.text, options: flowStep.options };
    if (isDirectOperator) sess.chatHistory = [botMsg];
    else sess.chatHistory.push(botMsg);
    return true;
}

function onDocumentDeleted(sess, docType) {
    if (!sess) return false;
    sess.subService = 'LEGAL_HEIR';
    sess.chatHistory = Array.isArray(sess.chatHistory) ? sess.chatHistory : [];
    const p = sess.citizenProfile || {};
    if (docType === 'deathCertificate') {
        delete p.deathCertificate;
        delete p.deathCertificatePath;
    } else if (docType === 'legalHeirProof') {
        delete p.legalHeirProof;
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
