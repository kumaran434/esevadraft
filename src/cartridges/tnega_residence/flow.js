const { evaluateServiceChecklist } = require('../../core/services_registry');
const { isPhysicalDocValid, hasValidSmartCard, buildSmartCardPromptStep } = require('../_tnega_upload_utils');
const { resetTransientServiceInputs } = require('../_fresh_service_guard');

function advanceFlow(sess, prefixMessage = '') {
    sess.subService = 'RESIDENCE';
    if (!sess.citizenProfile) sess.citizenProfile = {};
    sess.citizenProfile.subService = 'RESIDENCE';

    const p = sess.citizenProfile;
    const members = p.members || [];
    const hasFamily = members.length > 1;

    if (hasFamily && !sess.selectedMember) {
        sess.intakeState = 'RESIDENCE_INTAKE';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `🏠 **இருப்பிடச் சான்றிதழ் (Residence / Nativity Certificate)**\n\n` +
            `இந்த குடும்பத்தில் **யாருக்கு இருப்பிடச் சான்றிதழ்** தேவைப்படுகிறது? கீழே உள்ள நபரைத் தேர்ந்தெடுக்கவும்:`;
        const options = members.map((m, idx) => ({
            label: `👤 ${m.nameTam || m.nameEng} (${m.relationshipTam || (idx === 0 ? 'தலைவர்' : 'உறுப்பினர்')})`,
            value: `SELECT_MEMBER_${idx}`
        }));
        return { text: welcomeText, options, step: sess.intakeState };
    }

    const hasAadhaarDoc = isPhysicalDocValid(
        p.headAadhaarDocPath || p.documents?.headAadhaar || sess.tempUploads?.headAadhaar,
        sess.draftData?.base64Docs?.headAadhaarBase64
    );
    const hasBasicDemographics = Boolean(p.headAadhaar || p.aadhaarNumber || p.fullNameTam || p.fullNameEng);

    if (!hasAadhaarDoc || !hasBasicDemographics) {
        sess.intakeState = 'RESIDENCE_AADHAAR_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `🏠 **இருப்பிடச் சான்றிதழ் (Residence / Nativity Certificate - REV-102) விண்ணப்பம்**\n\n` +
            `⚠️ **முக்கிய அரசு விதி (TNeGA Mandatory Document Gate):**\n` +
            `இருப்பிடச் சான்றிதழ் விண்ணப்பிக்க தேவையான ஆவணங்கள் முதலில் சரிபார்க்கப்பட வேண்டும்.\n\n` +
            `📄 விண்ணப்பதாரரின் பெயர் மற்றும் முகவரி விவரங்களைத் தானாகப் பெற **ஆதார் அட்டை (படம் அல்லது 2-in-1 PDF)** பதிவேற்றவும்:`;
        const options = [
            { label: "📷 ஆதார் அட்டை பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
            { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    if (sess.tempUploads?.headAadhaarFront && !sess.tempUploads?.headAadhaarBack && !p.fatherNameTam && !p.fatherNameEng && !p.pincode) {
        sess.intakeState = 'RESIDENCE_AADHAAR_BACK_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `🔄 **ஆதார் முன்பக்கம் பெறப்பட்டது! முகவரி மற்றும் தந்தை/கணவர் பெயர் உள்ள பின்பக்கத்தை (Back Side) பதிவேற்றவும்:**`;
        const options = [
            { label: "📷 ஆதார் பின்பக்கம் அப்லோட்", value: "TRIGGER_FILE_UPLOAD" },
            { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    const hasPhotoDoc = isPhysicalDocValid(
        p.headPhotoPath || p.photoPath || p.documents?.profilePhoto || p.documents?.headPhoto || sess.tempUploads?.profilePhoto || sess.tempUploads?.headPhoto,
        sess.draftData?.base64Docs?.profilePhotoBase64 || sess.draftData?.base64Docs?.headPhotoBase64
    );
    if (!hasPhotoDoc) {
        sess.intakeState = 'RESIDENCE_PHOTO_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `📷 **விண்ணப்பதாரர் பாஸ்போர்ட் புகைப்படம் தேவை:**\n\n` +
            `• 👤 **விண்ணப்பதாரர்:** ${p.fullNameTam || p.fullNameEng || 'விண்ணப்பதாரர்'}\n\n` +
            `⚠️ **முக்கிய அரசு விதி (TNeGA REV-102 Portal Rule):**\n` +
            `இருப்பிடச் சான்றிதழ் விண்ணப்பத்திற்கு விண்ணப்பதாரரின் நேரடி பாஸ்போர்ட் புகைப்படம் (<50KB) போர்ட்டலில் கட்டாயம் பதிவேற்றப்பட வேண்டும்.\n\n` +
            `தயவுசெய்து நேரடி பாஸ்போர்ட் புகைப்படத்தைப் பதிவேற்றவும் (ஆதார் அட்டையிலிருந்து படம் வெட்டப்பட மாட்டாது):`;
        const options = [
            { label: "📷 பாஸ்போர்ட் புகைப்படம் பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
            { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    if (!hasValidSmartCard(p, sess)) {
        return buildSmartCardPromptStep(sess, 'RESIDENCE_SMARTCARD_WAIT', prefixMessage, 'இருப்பிடச் சான்றிதழ் (REV-102)');
    }

    const hasResidenceProof = isPhysicalDocValid(
        p.residenceProof?.docPath || p.residenceProof || p.documents?.residenceProof || p.documents?.gasBook || sess.tempUploads?.residenceProof || sess.tempUploads?.gasBook,
        sess.draftData?.base64Docs?.residenceProofBase64
    );
    if (!hasResidenceProof) {
        sess.intakeState = 'RESIDENCE_PROOF_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `🏠 **இருப்பிட ஆதாரம் / முகவரிச் சான்று (Residence Proof) தேவை:**\n\n` +
            `• 👤 **விண்ணப்பதாரர்:** ${p.fullNameTam || p.fullNameEng || 'விண்ணப்பதாரர்'}\n\n` +
            `⚠️ **முக்கிய அரசு விதி (TNeGA REV-102 Portal Rule):**\n` +
            `இருப்பிடச் சான்றிதழ் விண்ணப்பிக்க **மின் கட்டண ரசீது (EB Bill), எரிவாயு அட்டை (Gas Book), வீட்டு வரி ரசீது (Property Tax), அல்லது வாடகை ஒப்பந்தம் (Rental Agreement)** போர்ட்டலில் கட்டாயம் பதிவேற்றப்பட வேண்டும்.\n\n` +
            `தயவுசெய்து ஆவணத்தைப் பதிவேற்றவும் (புகைப்படம் அல்லது PDF):`;
        const options = [
            { label: "📷 இருப்பிட ஆதாரம் பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
            { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    const resolvedCan = String(p.canNumber || sess.canNumber || p.can || '').replace(/\D+/g, '');
    if (resolvedCan && !p.canNumber) p.canNumber = resolvedCan;
    if (resolvedCan && !sess.canNumber) sess.canNumber = resolvedCan;
    const hasCan = Boolean(resolvedCan && resolvedCan.length >= 11);

    if (!hasCan) {
        sess.intakeState = 'RESIDENCE_CAN_GATE';
        const aadhDisp = (p.headAadhaar || p.aadhaarNumber || '').replace(/(\d{4})/g, '$1 ').trim();
        const nameDisp = p.fullNameTam || p.fullNameEng || '';
        let welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `✅ **தேவையான அனைத்து ஆவணங்களும் பெறப்பட்டன!** 🛡️\n\n` +
            `⚠️ **முக்கிய அரசு விதி (TNeGA Portal Rule):**\n` +
            `இருப்பிடச் சான்றிதழ் போர்ட்டலில் விண்ணப்பிக்க **13-இலக்க CAN எண் (Citizen Access Number)** தேவை.\n\n`;
        if (nameDisp || aadhDisp) {
            welcomeText += (nameDisp ? `• 👤 **விண்ணப்பதாரர்:** ${nameDisp}\n` : '') +
                           (aadhDisp ? `• 🪪 **ஆதார் எண்:** ${aadhDisp}\n\n` : '\n');
        }
        welcomeText += `உங்களிடம் ஏற்கெனவே CAN எண் உள்ளதா அல்லது போர்ட்டலில் தேட / புதிதாகப் பதிவு செய்ய வேண்டுமா?`;
        const options = [
            { label: "🔍 CAN எண் தேடு (Search CAN)", value: "CAN_SEARCH_PROMPT" },
            { label: "📝 புதிய CAN பதிவு செய் (Register New CAN)", value: "CAN_REGISTER_PROMPT" },
            { label: "🔢 என்னிடம் CAN எண் உள்ளது (Direct Input)", value: "CAN_DIRECT_INPUT" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    const hasYears = Boolean(p.yearsOfResidence);
    if (!hasYears) {
        sess.intakeState = 'RESIDENCE_YEARS_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `✅ **TNeGA CAN எண்:** **${p.canNumber}** 🛡️\n` +
            `• 👤 **விண்ணப்பதாரர்:** ${p.fullNameTam || p.fullNameEng || 'விண்ணப்பதாரர்'}\n\n` +
            `🏠 **விண்ணப்பதாரர் தமிழ்நாட்டில் எத்தனை ஆண்டுகளாகத் தொடர்ந்து வசித்து வருகிறார்?**\n\n` +
            `கீழே உள்ள விருப்பங்களில் ஒன்றைத் தேர்ந்தெடுக்கவும் (அல்லது தட்டச்சு செய்யவும்):`;
        const options = [
            { label: "🌟 பிறப்பிலிருந்து (Since Birth)", value: "பிறப்பிலிருந்து" },
            { label: "🔟 10+ ஆண்டுகள் (10+ Years)", value: "10 ஆண்டுகள்" },
            { label: "5️⃣ 5+ ஆண்டுகள் (5+ Years)", value: "5 ஆண்டுகள்" },
            { label: "1️⃣ 1+ ஆண்டுகள் (1+ Years)", value: "1 ஆண்டு" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    const hasPurpose = Boolean(p.purposeOfCertificate);
    if (!hasPurpose) {
        sess.intakeState = 'RESIDENCE_PURPOSE_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `✅ வசிக்கும் காலம்: **${p.yearsOfResidence}** எனப் பதிவானது!\n\n` +
            `🎯 **இருப்பிடச் சான்றிதழ் எந்த பயன்பாட்டிற்காகத் தேவைப்படுகிறது?**\n\n` +
            `கீழே உள்ள பயன்பாட்டைத் தேர்ந்தெடுக்கவும்:`;
        const options = [
            { label: "🎓 கல்வி / கல்லூரி சேர்க்கை (Education)", value: "கல்வி பயன்பாடு" },
            { label: "💼 வேலைவாய்ப்பு (Employment)", value: "வேலைவாய்ப்பு" },
            { label: "🏛️ அரசு நலத்திட்டம் / உதவித்தொகை (Govt Scheme)", value: "அரசு நலத்திட்டம்" },
            { label: "📋 பொது பயன்பாடு (General Purpose)", value: "பொது பயன்பாடு" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    sess.intakeState = 'READY_TO_APPLY_RESIDENCE';
    const chk = evaluateServiceChecklist('RESIDENCE_CERTIFICATE', sess.citizenProfile, sess.draftData?.base64Docs || {});
    const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
        `🎉 **இருப்பிடச் சான்றிதழ் (REV-102) விண்ணப்பத்திற்கான விவரங்கள் 100% தயாராக உள்ளன!** 🛡️\n\n` +
        `📋 **விவரங்கள் சுருக்கம்:**\n` +
        `• 🔢 **CAN எண்:** **${p.canNumber}** ✅\n` +
        `• 👤 **விண்ணப்பதாரர்:** ${p.fullNameTam || p.fullNameEng}\n` +
        `• 👨‍👧 **தந்தை/கணவர்:** ${p.fatherNameTam || p.fatherNameEng || '—'}\n` +
        `• 📅 **வசிக்கும் காலம்:** ${p.yearsOfResidence} ✅\n` +
        `• 🎯 **சான்றிதழ் நோக்கம்:** ${p.purposeOfCertificate} ✅\n` +
        `• 🏠 **முகவரி:** ${p.doorNo ? p.doorNo + ', ' : ''}${p.streetTam || p.streetEng || ''}, ${p.village || ''} - ${p.pincode || ''}\n\n` +
        (chk && chk.summaryTamil ? `${chk.summaryTamil}\n\n` : '') +
        `இப்போது இ-சேவை (TNeGA REV-102) போர்ட்டல் மூலம் விண்ணப்பிக்கத் தொடங்கலாம்!`;
    const options = [
        { label: "🚀 இ-சேவை போர்ட்டலில் விண்ணப்பிக்கத் தொடங்கு", value: "START_RESIDENCE_APPLY" },
        { label: "✏️ விவரங்களைச் சரிபார் / திருத்து (Edit Details)", value: "TRIGGER_EDIT_MODAL" },
        { label: "🔄 புதிய விண்ணப்பம் தொடங்க (Reset)", value: "reset" }
    ];
    return { text: welcomeText, options, step: sess.intakeState, actionRequired: 'open_edit_modal' };
}

function enterService(sess, { greeting = '', isDirectOperator = false, cleanMobile = '', createAppFn = null } = {}) {
    resetTransientServiceInputs(sess);
    sess.subService = 'RESIDENCE';
    sess.pluginId = 'TNEGA_RESIDENCE';
    if (sess.citizenProfile) {
        sess.citizenProfile.subService = 'RESIDENCE';
        sess.citizenProfile.pluginId = 'TNEGA_RESIDENCE';
    }
    if (isDirectOperator) {
        sess.intakeState = 'RESIDENCE_INTAKE';
        if (createAppFn && cleanMobile) { try { createAppFn(cleanMobile, 'RESIDENCE_CERT', sess.citizenProfile); } catch (_) {} }
    }
    const flowStep = advanceFlow(sess, greeting);
    const botMsg = { sender: 'bot', text: flowStep.text, options: flowStep.options };
    if (isDirectOperator) sess.chatHistory = [botMsg];
    else sess.chatHistory.push(botMsg);
    return true;
}

function onDocumentDeleted(sess, docType) {
    if (!sess) return false;
    sess.subService = 'RESIDENCE';
    sess.chatHistory = Array.isArray(sess.chatHistory) ? sess.chatHistory : [];
    const p = sess.citizenProfile || {};
    if (docType === 'residenceProof' || docType === 'gasBook' || docType === 'nativityProof') {
        delete p.residenceProof;
        if (p.gasDetails) {
            delete p.gasDetails.gasBookPath;
            p.gasDetails.hasGas = false;
        }
    } else if (docType === 'headPhoto' || docType === 'profilePhoto') {
        delete p.headPhotoPath;
        delete p.profilePhoto;
    } else if (docType === 'headAadhaar') {
        delete p.headAadhaarDocPath;
    } else if (docType === 'smartCard' || docType === 'rationCard') {
        delete p.smartCard;
        delete p.rationCard;
        delete p.smartCardDocPath;
    }
    const flowStep = advanceFlow(sess, `🗑️ **தேர்ந்தெடுக்கப்பட்ட ஆவணம் நீக்கப்பட்டது!**`);
    sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
    return true;
}

module.exports = { advanceFlow, enterService, onDocumentDeleted };
