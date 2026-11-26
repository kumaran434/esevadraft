const { evaluateServiceChecklist } = require('../../core/services_registry');
const { isPhysicalDocValid, hasValidSmartCard, buildSmartCardPromptStep } = require('../_tnega_upload_utils');
const { resetTransientServiceInputs } = require('../_fresh_service_guard');

function advanceFlow(sess, prefixMessage = '') {
    sess.subService = 'COMMUNITY';
    if (!sess.citizenProfile) sess.citizenProfile = {};
    sess.citizenProfile.subService = 'COMMUNITY';

    const p = sess.citizenProfile;
    const members = p.members || [];
    const hasFamily = members.length > 1;

    if (hasFamily && !sess.selectedMember) {
        sess.intakeState = 'COMMUNITY_INTAKE';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `📜 **சாதிச் சான்றிதழ் (Community Certificate)**\n\n` +
            `இந்த குடும்பத்தில் **யாருக்கு சாதிச் சான்றிதழ்** தேவைப்படுகிறது? கீழே உள்ள நபரைத் தேர்ந்தெடுக்கவும்:`;
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
        sess.intakeState = 'COMMUNITY_AADHAAR_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `📜 **சாதிச் சான்றிதழ் (Community Certificate - REV-101) விண்ணப்பம்**\n\n` +
            `⚠️ **முக்கிய அரசு விதி (TNeGA Mandatory Document Gate):**\n` +
            `சாதிச் சான்றிதழ் விண்ணப்பிக்க தேவையான ஆவணங்கள் முதலில் சரிபார்க்கப்பட வேண்டும்.\n\n` +
            `📄 விண்ணப்பதாரரின் பெயர் மற்றும் முகவரி விவரங்களைத் தானாகப் பெற **ஆதார் அட்டை (படம் அல்லது 2-in-1 PDF)** பதிவேற்றவும்:`;
        const options = [
            { label: "📷 ஆதார் அட்டை பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
            { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    if (sess.tempUploads?.headAadhaarFront && !sess.tempUploads?.headAadhaarBack && !p.fatherNameTam && !p.fatherNameEng && !p.pincode) {
        sess.intakeState = 'COMMUNITY_AADHAAR_BACK_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `🔄 **ஆதார் முன்பக்கம் பெறப்பட்டது! தந்தை/கணவர் பெயர் மற்றும் முகவரி உள்ள பின்பக்கத்தை (Back Side) பதிவேற்றவும்:**`;
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
        sess.intakeState = 'COMMUNITY_PHOTO_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `📷 **விண்ணப்பதாரர் பாஸ்போர்ட் புகைப்படம் தேவை:**\n\n` +
            `• 👤 **விண்ணப்பதாரர்:** ${p.fullNameTam || p.fullNameEng || 'விண்ணப்பதாரர்'}\n\n` +
            `⚠️ **முக்கிய அரசு விதி (TNeGA REV-101 Portal Rule):**\n` +
            `சாதிச் சான்றிதழ் விண்ணப்பத்திற்கு விண்ணப்பதாரரின் நேரடி பாஸ்போர்ட் புகைப்படம் (<50KB) போர்ட்டலில் கட்டாயம் பதிவேற்றப்பட வேண்டும்.\n\n` +
            `தயவுசெய்து நேரடி பாஸ்போர்ட் புகைப்படத்தைப் பதிவேற்றவும் (ஆதார் அட்டையிலிருந்து படம் வெட்டப்பட மாட்டாது):`;
        const options = [
            { label: "📷 பாஸ்போர்ட் புகைப்படம் பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
            { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    if (!hasValidSmartCard(p, sess)) {
        return buildSmartCardPromptStep(sess, 'COMMUNITY_SMARTCARD_WAIT', prefixMessage, 'சாதிச் சான்றிதழ் (REV-101)');
    }

    const hasCommProof = isPhysicalDocValid(
        p.communityProof || p.communityCertificatePath || p.familyCommunityProofPath || p.documents?.communityProof || sess.tempUploads?.communityProof,
        sess.draftData?.base64Docs?.communityProofBase64
    );
    if (!hasCommProof) {
        sess.intakeState = 'COMMUNITY_PROOF_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `📜 **குடும்ப சாதிச் சான்றிதழ் (Family Community Certificate) தேவை:**\n\n` +
            `• 👤 **விண்ணப்பதாரர்:** ${p.fullNameTam || p.fullNameEng || 'விண்ணப்பதாரர்'}\n\n` +
            `⚠️ **முக்கிய அரசு விதி (TNeGA REV-101 Portal Rule):**\n` +
            `சாதிச் சான்றிதழ் விண்ணப்பிக்க **தந்தை / தாய் / உடன்பிறந்தோரின் சாதிச் சான்றிதழ்** அல்லது விண்ணப்பதாரரின் **பள்ளி மாற்றுச் சான்றிதழ் (School TC)** போர்ட்டலில் கட்டாயம் பதிவேற்றப்பட வேண்டும்.\n\n` +
            `தயவுசெய்து சான்றிதழைப் பதிவேற்றவும் (புகைப்படம் அல்லது PDF):`;
        const options = [
            { label: "📷 குடும்ப சாதிச் சான்று / TC பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
            { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    const resolvedCan = String(p.canNumber || sess.canNumber || p.can || '').replace(/\D+/g, '');
    if (resolvedCan && !p.canNumber) p.canNumber = resolvedCan;
    if (resolvedCan && !sess.canNumber) sess.canNumber = resolvedCan;
    const hasCan = Boolean(resolvedCan && resolvedCan.length >= 11);

    if (!hasCan) {
        sess.intakeState = 'COMMUNITY_CAN_GATE';
        const aadhDisp = (p.headAadhaar || p.aadhaarNumber || '').replace(/(\d{4})/g, '$1 ').trim();
        const nameDisp = p.fullNameTam || p.fullNameEng || '';
        let welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `✅ **தேவையான அனைத்து ஆவணங்களும் பெறப்பட்டன!** 🛡️\n\n` +
            `⚠️ **முக்கிய அரசு விதி (TNeGA Portal Rule):**\n` +
            `சாதிச் சான்றிதழ் போர்ட்டலில் விண்ணப்பிக்க **13-இலக்க CAN எண் (Citizen Access Number)** தேவை.\n\n`;
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

    const hasMother = Boolean(p.motherNameTam || p.motherNameEng || p.motherName);
    if (!hasMother) {
        sess.intakeState = 'COMMUNITY_MOTHER_NAME_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `✅ **TNeGA CAN எண்:** **${p.canNumber}** 🛡️\n` +
            `• 👤 **விண்ணப்பதாரர்:** ${p.fullNameTam || p.fullNameEng || 'விண்ணப்பதாரர்'}\n\n` +
            `⚠️ **கட்டாய அரசு விவரம் (Mandatory Detail):**\n` +
            `சாதிச் சான்றிதழ் படிவத்தில் தாயின் பெயர் கட்டாயமாகும்.\n\n` +
            `தயவுசெய்து **தாயாரின் பெயரை** உள்ளிடவும் (எ.கா: தேவகி அல்லது Devaki):`;
        return { text: welcomeText, options: [], step: sess.intakeState };
    }

    const hasReligion = Boolean(p.religion);
    if (!hasReligion) {
        sess.intakeState = 'COMMUNITY_RELIGION_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `✅ **TNeGA CAN எண்:** **${p.canNumber}** 🛡️\n` +
            `• 👤 **விண்ணப்பதாரர்:** ${p.fullNameTam || p.fullNameEng || 'விண்ணப்பதாரர்'}\n\n` +
            `🏛️ **விண்ணப்பதாரரின் மதம் (Religion) எது?**\n` +
            `கீழே உள்ள மதத்தைத் தேர்ந்தெடுக்கவும்:`;
        const options = [
            { label: "🕉️ இந்து (Hindu)", value: "RELIGION_HINDU" },
            { label: "☪️ இஸ்லாம் (Muslim)", value: "RELIGION_MUSLIM" },
            { label: "✝️ கிறிஸ்தவம் (Christian)", value: "RELIGION_CHRISTIAN" },
            { label: "🪯 சீக்கியம் (Sikh)", value: "RELIGION_SIKH" },
            { label: "☸️ சமணம் / பௌத்தம் (Jain / Buddhist)", value: "RELIGION_JAIN" },
            { label: "🌐 இதர / பிற (Others)", value: "RELIGION_OTHERS" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    const hasCommunity = Boolean(p.community || p.socialCategory);
    if (!hasCommunity) {
        sess.intakeState = 'COMMUNITY_COMM_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `✅ **மதம்:** **${p.religion || 'Hindu'}** எனப் பதிவானது!\n\n` +
            `🏛️ **விண்ணப்பதாரரின் வகுப்பு / பிரிவு (Community) எது?**\n` +
            `கீழே உள்ள பிரிவைத் தேர்ந்தெடுக்கவும்:`;
        const options = [
            { label: "MBC (மிகவும் பிற்படுத்தப்பட்டோர்)", value: "COMMUNITY_MBC" },
            { label: "BC (பிற்படுத்தப்பட்டோர்)", value: "COMMUNITY_BC" },
            { label: "BCM (பிற்படுத்தப்பட்ட முஸ்லிம்)", value: "COMMUNITY_BCM" },
            { label: "SC (பட்டியலினத்தவர்)", value: "COMMUNITY_SC" },
            { label: "ST (பழங்குடியினர்)", value: "COMMUNITY_ST" },
            { label: "OC (பொதுப் பிரிவு)", value: "COMMUNITY_OC" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    const hasCaste = Boolean(p.caste || p.subCaste || p.casteName);
    if (!hasCaste) {
        sess.intakeState = 'COMMUNITY_CASTE_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `✅ பிரிவு: **${p.community}** எனப் பதிவானது!\n\n` +
            `🏷️ **விண்ணப்பதாரரின் சாதி உட்பிரிவு (Caste / Sub-caste) என்ன?**\n\n` +
            `கீழே உள்ள விருப்பத்தைத் தேர்ந்தெடுக்கவும் அல்லது உங்கள் சாதியை நேரடியாக தட்டச்சு செய்யவும்:`;
        let options = [];
        if (p.community === 'MBC') {
            options = [
                { label: "வன்னியகுல சத்ரியர் (Vanniakula Kshatriya)", value: "வன்னியகுல சத்ரியர்" },
                { label: "அகமுடையார் (Agamudayar)", value: "அகமுடையார்" },
                { label: "மருத்துவர் (Maruthuvar)", value: "மருத்துவர்" },
                { label: "நாவிதர் / வண்ணார் (Vannar)", value: "வண்ணார்" }
            ];
        } else if (p.community === 'BC') {
            options = [
                { label: "கொங்கு வேளாளர் (Kongu Vellalar)", value: "கொங்கு வேளாளர்" },
                { label: "நாடார் (Nadar)", value: "நாடார்" },
                { label: "செட்டியார் (Chettiar)", value: "செட்டியார்" },
                { label: "முக்குலத்தோர் / தேவர் (Mukkulathor)", value: "முக்குலத்தோர்" }
            ];
        } else if (p.community === 'SC') {
            options = [
                { label: "ஆதி திராவிடர் (Adi Dravidar)", value: "ஆதி திராவிடர்" },
                { label: "பறையர் (Paraiyar)", value: "பறையர்" },
                { label: "அருந்ததியர் (Arunthathiyar)", value: "அருந்ததியர்" }
            ];
        } else {
            options = [
                { label: "அகமுடையார் (Agamudayar)", value: "அகமுடையார்" },
                { label: "வன்னியகுல சத்ரியர் (Vanniakula Kshatriya)", value: "வன்னியகுல சத்ரியர்" },
                { label: "நாடார் (Nadar)", value: "நாடார்" },
                { label: "ஆதி திராவிடர் (Adi Dravidar)", value: "ஆதி திராவிடர்" }
            ];
        }
        return { text: welcomeText, options, step: sess.intakeState };
    }

    const hasParentCaste = Boolean(p.parentCasteConfirmed || (p.fatherCaste && p.motherCaste));
    if (!hasParentCaste) {
        sess.intakeState = 'COMMUNITY_PARENTS_CASTE_GATE';
        const cName = p.caste || p.subCaste || '';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `👨‍👩‍👦 **பெற்றோரின் சாதி விவரங்கள் (Parents Caste):**\n\n` +
            `அரசு விதிப்படி விண்ணப்பத்தில் தந்தை மற்றும் தாயாரின் சாதிப் பிரிவு தனித்தனியாக நிரப்பப்பட வேண்டும்.\n\n` +
            `தாய் மற்றும் தந்தை இருவருமே **${cName}** சாதிப் பிரிவைச் சேர்ந்தவர்களா?`;
        const options = [
            { label: `✅ ஆம், இருவருமே ${cName}`, value: "PARENTS_SAME_CASTE" },
            { label: "❌ இல்லை, பெற்றோர் வெவ்வேறு சாதிப் பிரிவு", value: "PARENTS_DIFF_CASTE" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    sess.intakeState = 'READY_TO_APPLY_COMMUNITY';
    const chk = evaluateServiceChecklist('COMMUNITY_CERTIFICATE', sess.citizenProfile, sess.draftData?.base64Docs || {});
    const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
        `🎉 **சாதிச் சான்றிதழ் (REV-101) விண்ணப்பத்திற்கான விவரங்கள் 100% தயாராக உள்ளன!** 🛡️\n\n` +
        `📋 **விவரங்கள் சுருக்கம்:**\n` +
        `• 🔢 **CAN எண்:** **${p.canNumber}** ✅\n` +
        `• 👤 **விண்ணப்பதாரர்:** ${p.fullNameTam || p.fullNameEng}\n` +
        `• 👨‍👧 **தந்தை/கணவர்:** ${p.fatherNameTam || p.fatherNameEng || '—'}\n` +
        `• 👩 **தாயின் பெயர்:** ${p.motherNameTam || p.motherNameEng || '—'}\n` +
        `• 🕉️ **மதம்:** ${p.religion || 'Hindu'}\n` +
        `• 🏛️ **வகுப்பு / பிரிவு:** ${p.community || 'MBC'} ✅\n` +
        `• 🏷️ **விண்ணப்பதாரர் சாதி:** ${p.caste || p.subCaste || '—'} ✅\n` +
        `• 👨‍👦 **தந்தை சாதி:** ${p.fatherCaste || p.caste || '—'} ✅\n` +
        `• 👩‍👦 **தாய் சாதி:** ${p.motherCaste || p.caste || '—'} ✅\n` +
        `• 📜 **குடும்ப சாதிச் சான்று:** ${hasCommProof ? 'பதிவேற்றப்பட்டது ✅' : 'விடுபட்டுள்ளது ❌'}\n` +
        `• 🏠 **முகவரி:** ${p.doorNo ? p.doorNo + ', ' : ''}${p.streetTam || p.streetEng || ''}, ${p.village || ''} - ${p.pincode || ''}\n\n` +
        (chk && chk.summaryTamil ? `${chk.summaryTamil}\n\n` : '') +
        `இப்போது இ-சேவை (TNeGA REV-101) போர்ட்டல் மூலம் விண்ணப்பிக்கத் தொடங்கலாம்!`;
    const options = [
        { label: "🚀 இ-சேவை போர்ட்டலில் விண்ணப்பிக்கத் தொடங்கு", value: "START_COMMUNITY_APPLY" },
        { label: "✏️ விவரங்களைச் சரிபார் / திருத்து (Edit Details)", value: "TRIGGER_EDIT_MODAL" },
        { label: "🔄 புதிய விண்ணப்பம் தொடங்க (Reset)", value: "reset" }
    ];
    return { text: welcomeText, options, step: sess.intakeState, actionRequired: 'open_edit_modal' };
}

function enterService(sess, { greeting = '', isDirectOperator = false, cleanMobile = '', createAppFn = null } = {}) {
    resetTransientServiceInputs(sess);
    sess.subService = 'COMMUNITY';
    sess.pluginId = 'TNEGA_COMMUNITY';
    if (sess.citizenProfile) {
        sess.citizenProfile.subService = 'COMMUNITY';
        sess.citizenProfile.pluginId = 'TNEGA_COMMUNITY';
    }
    if (isDirectOperator) {
        sess.intakeState = 'COMMUNITY_INTAKE';
        if (createAppFn && cleanMobile) { try { createAppFn(cleanMobile, 'COMMUNITY_CERT', sess.citizenProfile); } catch (_) {} }
    }
    const flowStep = advanceFlow(sess, greeting);
    const botMsg = { sender: 'bot', text: flowStep.text, options: flowStep.options };
    if (isDirectOperator) sess.chatHistory = [botMsg];
    else sess.chatHistory.push(botMsg);
    return true;
}

function onDocumentDeleted(sess, docType) {
    if (!sess) return false;
    sess.subService = 'COMMUNITY';
    sess.chatHistory = Array.isArray(sess.chatHistory) ? sess.chatHistory : [];
    const p = sess.citizenProfile || {};
    if (docType === 'communityProof' || docType === 'communityCertificate' || docType === 'familyCommunityProof') {
        delete p.communityProofSkipped;
        p.communityProofSkipped = false;
        delete p.communityProof;
        delete p.communityCertificate;
        delete p.communityCertificatePath;
        delete p.familyCommunityProofPath;
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
