const { ensureBilingualPair, formatStreetWithHamlet } = require('../../utils/bilingual_helper');
const { resetTransientServiceInputs } = require('../_fresh_service_guard');

function advanceFlow(sess, prefixMessage = '') {
    if (!sess.targetService) {
        if (sess.subService && sess.subService !== 'CAN_REGISTER' && sess.subService !== 'CAN_SEARCH') {
            sess.targetService = sess.subService;
        }
    }
    sess.subService = 'CAN_REGISTER';
    if (!sess.citizenProfile) sess.citizenProfile = {};
    sess.citizenProfile.subService = 'CAN_REGISTER';
    if (sess.targetService) {
        sess.citizenProfile.targetService = sess.targetService;
    }

    const p = sess.citizenProfile;
    const mob = p.mobileNumber || sess.mobileNumber || '';
    const nameTam = p.fullNameTam || p.headNameTam || '';
    const nameEng = p.fullNameEng || p.headNameEng || '';
    const fatTam = p.fatherNameTam || '';
    const fatEng = p.fatherNameEng || '';
    const rawMotEng = p.motherNameEng || p.motherName || '';
    const rawMotTam = p.motherNameTam || p.motherName || '';
    const motPair = (rawMotEng || rawMotTam) ? ensureBilingualPair(rawMotEng, rawMotTam) : { eng: '', tam: '' };
    const motTam = motPair.tam;
    const motEng = motPair.eng;
    if (motTam) p.motherNameTam = motTam;
    if (motEng) p.motherNameEng = motEng;
    const comm = p.community || p.caste || '';
    const aadh = p.headAadhaar || p.aadhaar || '';
    const aadhDisp = aadh ? aadh.replace(/(\d{4})/g, '$1 ').trim() : '—';
    const door = p.doorNo || '';
    const vil = p.villageTam || p.village || '';
    const tal = p.talukTam || p.taluk || '';
    const dist = p.districtTam || p.district || '';
    const pin = p.pincode || '';
    const dob = p.dob || p.headDob || '';
    const gen = p.genderTam || p.headGenderTam || (p.headGender === 'Female' ? 'பெண்' : 'ஆண்');

    const { fullStreetTam } = formatStreetWithHamlet(p, { village: p.village, villageTam: p.villageTam, areaEng: p.areaEng, areaTam: p.areaTam });
    let stTam = fullStreetTam || p.streetTam || p.streetEng || '';

    if (!mob || (!nameTam && !nameEng) || !aadh) {
        sess.intakeState = 'CAN_REGISTER_INTAKE';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `📝 **புதிய CAN பதிவிற்கு தேவையான தகவல்கள்:**\n\n` +
            `விண்ணப்பதாரரின் ஆதார் அட்டை படம் / PDF பதிவேற்றவும் (அல்லது விவரங்களை உள்ளிடவும்):`;
        const options = [
            { label: "📷 ஆதார் அட்டை அப்லோட்", value: "TRIGGER_FILE_UPLOAD" },
            { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    const hasAddressOrBack = Boolean(sess.tempUploads?.headAadhaarBack || (fatTam || fatEng) || (door && pin));
    if (sess.tempUploads?.headAadhaarFront && !hasAddressOrBack) {
        sess.intakeState = 'CAN_AADHAAR_BACK_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `🔄 **ஆதார் முன்பக்கம் பெறப்பட்டது! தந்தை/கணவர் பெயர் மற்றும் முகவரி உள்ள பின்பக்கத்தை (Back Side) பதிவேற்றவும்:**`;
        const options = [
            { label: "📷 ஆதார் பின்பக்கம் அப்லோட்", value: "TRIGGER_FILE_UPLOAD" },
            { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    if (!motTam && !motEng) {
        sess.intakeState = 'CAN_MOTHER_NAME_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `📝 **புதிய CAN பதிவு (New CAN Registration)**\n\n` +
            `• 👤 **விண்ணப்பதாரர்:** ${nameTam || nameEng}\n` +
            `• 👨 **தந்தை/கணவர்:** ${fatTam || fatEng || '—'}\n\n` +
            `⚠️ **கட்டாய அரசு விவரம் (Mandatory Detail):**\n` +
            `TNeGA போர்ட்டலில் புதிய CAN பதிவு செய்ய தாயின் பெயர் கட்டாயமாகும்.\n\n` +
            `தயவுசெய்து **தாயாரின் பெயரை** உள்ளிடவும் (எ.கா: தேவகி அல்லது Devaki):`;
        return { text: welcomeText, options: [], step: sess.intakeState };
    }

    if (!comm) {
        sess.intakeState = 'CAN_COMMUNITY_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `📝 **புதிய CAN பதிவு (New CAN Registration)**\n\n` +
            `• 👤 **விண்ணப்பதாரர்:** ${nameTam || nameEng}\n` +
            `• 👩 **தாயின் பெயர்:** ${motTam || motEng}\n\n` +
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

    sess.intakeState = 'READY_TO_APPLY_CAN';
    const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
        `📝 **புதிய CAN பதிவு (New CAN Registration) விவரங்கள்:**\n\n` +
        `• 👤 **விண்ணப்பதாரர் பெயர்:** ${nameTam} (${nameEng})\n` +
        `• 👨 **தந்தை/கணவர் பெயர்:** ${fatTam} (${fatEng})\n` +
        `• 👩 **தாயின் பெயர்:** ${motTam || motEng}${motTam && motEng ? ` (${motEng})` : ''}\n` +
        `• 🏛️ **வகுப்பு:** ${comm}\n` +
        `• 🪪 **ஆதார் எண்:** ${aadhDisp}\n` +
        `• 📱 **கைபேசி எண்:** +91 ${mob}\n` +
        `• 🎂 **பிறந்த தேதி & பாலினம்:** ${dob} | ${gen}\n` +
        `• 🏠 **முகவரி:** ${door ? door + ', ' : ''}${stTam}, ${vil}, ${tal}, ${dist} - ${pin}\n\n` +
        `'புதிய CAN பதிவு தொடங்கு' பொத்தானை அழுத்தவும்:`;
    const options = [
        { label: "🚀 புதிய CAN பதிவு தொடங்கு (Start CAN Registration)", value: "START_CAN_REGISTER" },
        { label: "✏️ விவரங்களை மாற்று (Edit Details)", value: "TRIGGER_EDIT_MODAL" }
    ];
    return { text: welcomeText, options, step: sess.intakeState, actionRequired: 'open_edit_modal' };
}

function enterService(sess, { greeting = '', isDirectOperator = false } = {}) {
    resetTransientServiceInputs(sess);
    sess.subService = 'CAN_REGISTER';
    sess.pluginId = 'TNEGA_CAN_REGISTER';
    if (sess.citizenProfile) {
        sess.citizenProfile.subService = 'CAN_REGISTER';
        sess.citizenProfile.pluginId = 'TNEGA_CAN_REGISTER';
    }
    sess.intakeState = 'CAN_REGISTER_INTAKE';
    const flowStep = advanceFlow(sess, greeting);
    const botMsg = { sender: 'bot', text: flowStep.text, options: flowStep.options };
    if (isDirectOperator) sess.chatHistory = [botMsg];
    else sess.chatHistory.push(botMsg);
    return true;
}

function onDocumentDeleted(sess, docType) {
    if (!sess) return false;
    sess.subService = 'CAN_REGISTER';
    sess.chatHistory = Array.isArray(sess.chatHistory) ? sess.chatHistory : [];
    const p = sess.citizenProfile || {};
    if (docType === 'smartCard' || docType === 'rationCard') {
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
