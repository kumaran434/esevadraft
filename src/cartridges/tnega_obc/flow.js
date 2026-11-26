const { isPhysicalDocValid, hasValidSmartCard, buildSmartCardPromptStep } = require('../_tnega_upload_utils');
const { resetTransientServiceInputs } = require('../_fresh_service_guard');

function advanceFlow(sess, prefixMessage = '') {
    sess.subService = 'OBC';
    if (!sess.citizenProfile) sess.citizenProfile = {};
    sess.citizenProfile.subService = 'OBC';

    const p = sess.citizenProfile;
    const docs = p.documents || {};
    const tu = sess.tempUploads || {};
    const b64 = sess.draftData?.base64Docs || {};

    const hasPhoto = isPhysicalDocValid(p.headPhotoPath || docs.profilePhoto || tu.profilePhoto, b64.profilePhotoBase64 || b64.photoBase64);
    if (!hasPhoto) {
        sess.intakeState = 'OBC_PHOTO_WAIT';
        const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `📜 **OBC சான்றிதழ் (REV-115 Other Backward Classes Certificate)**\n\n` +
            `📸 முதலில் விண்ணப்பதாரரின் **பாஸ்போர்ட் புகைப்படத்தை** (Photo <250x250px, <50KB) பதிவேற்றவும்:`;
        return {
            text,
            options: [
                { label: "📸 புகைப்படம் பதிவேற்றுக (Upload Photo)", value: "TRIGGER_FILE_UPLOAD" },
                { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
            ],
            step: sess.intakeState
        };
    }

    const hasAadhaarDoc = isPhysicalDocValid(p.headAadhaarDocPath || docs.headAadhaar || tu.headAadhaar, b64.headAadhaarBase64);
    const hasBasicDemographics = Boolean(p.headAadhaar || p.aadhaarNumber || p.fullNameTam || p.fullNameEng);
    if (!hasAadhaarDoc || !hasBasicDemographics) {
        sess.intakeState = 'OBC_AADHAAR_WAIT';
        const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `📜 **OBC சான்றிதழ் (REV-115) — ஆவணச் சரிபார்ப்பு**\n\n` +
            `📄 பெயர் மற்றும் முகவரி விவரங்களைத் தானாகப் பெற விண்ணப்பதாரரின் **ஆதார் அட்டை (படம் அல்லது 2-in-1 PDF)** பதிவேற்றவும்:`;
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
        return buildSmartCardPromptStep(sess, 'OBC_SMARTCARD_WAIT', prefixMessage, 'OBC சான்றிதழ் (REV-115)');
    }

    const hasCommDoc = isPhysicalDocValid(
        p.communityCertificate || p.communityCertificatePath || p.communityProof || p.familyCommunityProofPath || docs.communityCertificate || docs.communityProof || tu.communityCertificate || tu.communityProof,
        b64.communityCertificateBase64 || b64.communityProofBase64
    );
    if (!hasCommDoc) {
        sess.intakeState = 'OBC_COMMUNITY_PROOF_WAIT';
        const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `📜 **கட்டாய ஆவணம் 3/4: சாதிச் சான்றிதழ் (Community Certificate)**\n\n` +
            `REV-115 OBC சான்றிதழுக்கு விண்ணப்பதாரரின் (அல்லது தந்தை/உடன்பிறந்தோரின்) **சாதிச் சான்றிதழை** பதிவேற்றவும்.\n` +
            `*(சாதிப் பெயர் தானாகப் பிரித்தெடுக்கப்படும் ✨)*`;
        return {
            text,
            options: [
                { label: "📜 சாதிச் சான்றிதழ் பதிவேற்றுக (Upload Community Cert)", value: "TRIGGER_FILE_UPLOAD" },
                { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
            ],
            step: sess.intakeState
        };
    }

    const hasIncomeDoc = isPhysicalDocValid(
        p.incomeTaxReturn || p.incomeProof || p.salarySlip || p.incomeCertificate || docs.incomeTaxReturn || docs.incomeProof || docs.salarySlip || docs.incomeCertificate || tu.incomeTaxReturn || tu.incomeProof,
        b64.incomeTaxReturnBase64 || b64.incomeProofBase64 || b64.salarySlipBase64
    );
    if (!hasIncomeDoc) {
        sess.intakeState = 'OBC_INCOME_PROOF_WAIT';
        const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `📜 **கட்டாய ஆவணம் 4/4: வருமான வரி / வருமானச் சான்று (ITR / Income Proof)**\n\n` +
            `TNeGA OBC போர்ட்டலில் பதிவேற்ற **வருமான வரி படிவம் (ITR) அல்லது வருமானச் சான்றிதழ் / சம்பளச் சான்று** பதிவேற்றவும்:`;
        return {
            text,
            options: [
                { label: "💰 வருமான / ITR சான்று பதிவேற்றுக (Upload ITR / Income Proof)", value: "TRIGGER_FILE_UPLOAD" },
                { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
            ],
            step: sess.intakeState
        };
    }

    const hasValidCan = Boolean(p.canNumber && /^\d{11,15}$/.test(String(p.canNumber).trim()));
    if (!hasValidCan) {
        sess.intakeState = 'OBC_CAN_GATE';
        const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `✅ தேவையான ஆவணங்கள் அனைத்தும் பெறப்பட்டன!\n\n` +
            `🔢 **அடுத்த படி: CAN எண் சரிபார்ப்பு (REV-115)**\n` +
            `விண்ணப்பதாரருக்கு ஏற்கனவே 13-இலக்க CAN எண் உள்ளதா, அல்லது மொபைல்/ஆதார் மூலம் போர்ட்டலில் தேடவா?`;
        return {
            text,
            options: [
                { label: "🔍 போர்ட்டலில் CAN எண் தேடு (Auto CAN Search)", value: "TRIGGER_CAN_SEARCH" },
                { label: "🔢 என்னிடம் CAN எண் உள்ளது (Enter CAN)", value: "CAN_DIRECT_INPUT" },
                { label: "📝 புதிய CAN பதிவு செய் (Register New CAN)", value: "CAN_REGISTER_PROMPT" }
            ],
            step: sess.intakeState
        };
    }

    if (!p.motherNameTam && !p.motherNameEng) {
        sess.intakeState = 'OBC_MOTHER_NAME_WAIT';
        const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `✅ **CAN எண் (${p.canNumber}) & ஆவணங்கள் தயார்!**\n\n` +
            `👩 தயவுசெய்து **தாயாரின் பெயரை (Mother's Name)** உள்ளிடவும்:`;
        return {
            text,
            options: [{ label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }],
            step: sess.intakeState
        };
    }

    if (!p.caste && !p.subCaste) {
        sess.intakeState = 'OBC_CASTE_WAIT';
        const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `🏷️ **விண்ணப்பதாரரின் OBC சாதிப் பெயர் (Caste / Sub-Caste)** என்ன?\n` +
            `கீழே தேர்ந்தெடுக்கவும் அல்லது தட்டச்சு செய்யவும்:`;
        return {
            text,
            options: [
                { label: "வன்னியர் (Vanniyar)", value: "OBC_CASTE:Vanniyar" },
                { label: "அகமுடையார் (Agamudayar)", value: "OBC_CASTE:Agamudayar" },
                { label: "கவுண்டர் (Gounder)", value: "OBC_CASTE:Gounder" },
                { label: "முதலியார் (Mudaliyar)", value: "OBC_CASTE:Mudaliyar" },
                { label: "யாதவர் (Yadav)", value: "OBC_CASTE:Yadav" }
            ],
            step: sess.intakeState
        };
    }

    if (!p.occupation && !p.applicantOccupation && !p.profession) {
        sess.intakeState = 'OBC_OCCUPATION_WAIT';
        const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `💼 **விண்ணப்பதாரரின் தற்போதைய பணி / நிலை (Occupational Group)** எது?`;
        return {
            text,
            options: [
                { label: "🎓 மாணவர் (Student)", value: "OBC_OCC:Student" },
                { label: "💼 பணி / வேலை (Service)", value: "OBC_OCC:Service" },
                { label: "🏪 வியாபாரம் / சுயதொழில் (Business)", value: "OBC_OCC:Business" },
                { label: "🌾 விவசாயம் (Agriculture)", value: "OBC_OCC:Agriculture" }
            ],
            step: sess.intakeState
        };
    }

    if (!p.fatherOccupation && p.fatherAlive === undefined) {
        sess.intakeState = 'OBC_FATHER_OCC_WAIT';
        const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `👨‍👧 **தந்தையின் (${p.fatherNameTam || p.fatherNameEng || 'தந்தை'}) தொழில் / பணி நிலை** என்ன?`;
        return {
            text,
            options: [
                { label: "🌾 விவசாயம் (Self Employed - Agriculture)", value: "OBC_FA_OCC:Self Employed|Farmer" },
                { label: "🏪 சுயதொழில் / வியாபாரம் (Self Employed)", value: "OBC_FA_OCC:Self Employed|Business" },
                { label: "💼 தனியார் பணி (Employed - Private)", value: "OBC_FA_OCC:Employed|Private Service" },
                { label: "🏛️ அரசுப் பணி (Employed - Govt)", value: "OBC_FA_OCC:Employed|Government Service" },
                { label: "🕊️ காலமானார் (Deceased / No)", value: "OBC_FA_OCC:Deceased" }
            ],
            step: sess.intakeState
        };
    }

    if (!p.motherOccupation && p.motherAlive === undefined) {
        sess.intakeState = 'OBC_MOTHER_OCC_WAIT';
        const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `👩 **தாயின் (${p.motherNameTam || p.motherNameEng || 'தாய்'}) தொழில் / பணி நிலை** என்ன?`;
        return {
            text,
            options: [
                { label: "🏠 இல்லத்தரசி (Homemaker / Unemployed)", value: "OBC_MO_OCC:Unemployed|Homemaker" },
                { label: "🌾 விவசாயம் (Self Employed - Agriculture)", value: "OBC_MO_OCC:Self Employed|Farmer" },
                { label: "💼 தனியார் / அரசுப் பணி (Employed)", value: "OBC_MO_OCC:Employed|Service" },
                { label: "🕊️ காலமானார் (Deceased / No)", value: "OBC_MO_OCC:Deceased" }
            ],
            step: sess.intakeState
        };
    }

    if (!p.annualIncome && !p.familyAnnualIncome) {
        sess.intakeState = 'OBC_INCOME_WAIT';
        const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `💰 **குடும்பத்தின் மொத்த ஆண்டு வருமானம் (Annual Income)** எவ்வளவு?`;
        return {
            text,
            options: [
                { label: "₹72,000 / ஆண்டு", value: "OBC_INCOME:72000" },
                { label: "₹96,000 / ஆண்டு", value: "OBC_INCOME:96000" },
                { label: "₹1,20,000 / ஆண்டு", value: "OBC_INCOME:120000" },
                { label: "₹2,40,000 / ஆண்டு", value: "OBC_INCOME:240000" }
            ],
            step: sess.intakeState
        };
    }

    sess.intakeState = 'READY_TO_SUBMIT_OBC';
    const occDisp = p.occupation || p.applicantOccupation || p.profession || 'Service';
    const incDisp = p.annualIncome || p.familyAnnualIncome || '72000';
    const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
        `🎉 **OBC சான்றிதழ் (REV-115) விண்ணப்பத்திற்கான விவரங்கள் 100% தயாராக உள்ளன!** 🛡️\n\n` +
        `📋 **விவரங்கள் சுருக்கம்:**\n` +
        `• 🔢 **CAN எண்:** **${p.canNumber}** ✅\n` +
        `• 👤 **விண்ணப்பதாரர்:** ${p.fullNameTam || p.fullNameEng}\n` +
        `• 🏷️ **OBC சாதி:** **${p.caste || p.subCaste}** ✅\n` +
        `• 💼 **பணி நிலை:** ${occDisp} | 👨 தந்தை: ${p.fatherOccupation || (p.fatherAlive === false ? 'காலமானார்' : '—')} | 👩 தாய்: ${p.motherOccupation || (p.motherAlive === false ? 'காலமானார்' : '—')} ✅\n` +
        `• 💰 **குடும்ப ஆண்டு வருமானம்:** ₹${incDisp} ✅\n` +
        `• 📁 **ஆவணங்கள் (4/4 தயார்):** புகைப்படம் ✅ | ஆதார் ✅ | சாதிச் சான்றிதழ் ✅ | வருமான/ITR சான்று ✅\n` +
        `• 🏠 **முகவரி:** ${p.doorNo ? p.doorNo + ', ' : ''}${p.streetTam || p.streetEng || ''}, ${p.village || ''} - ${p.pincode || ''}\n\n` +
        `இப்போது இ-சேவை (TNeGA REV-115) போர்ட்டலில் நேரடி ஆட்டோமேஷன் தொடங்கலாம்!`;

    return {
        text,
        options: [
            { label: "🚀 இ-சேவை போர்ட்டலில் விண்ணப்பிக்கத் தொடங்கு (REV-115)", value: "START_OBC_APPLY" },
            { label: "✏️ விவரங்களைச் சரிபார் / திருத்து (Edit Details)", value: "TRIGGER_EDIT_MODAL" },
            { label: "🔄 புதிய விண்ணப்பம் தொடங்க (Reset)", value: "reset" }
        ],
        step: sess.intakeState,
        actionRequired: 'open_edit_modal'
    };
}

function enterService(sess, { greeting = '', isDirectOperator = false, cleanMobile = '', createAppFn = null } = {}) {
    resetTransientServiceInputs(sess);
    sess.subService = 'OBC';
    sess.pluginId = 'TNEGA_OBC';
    if (sess.citizenProfile) {
        sess.citizenProfile.subService = 'OBC';
        sess.citizenProfile.pluginId = 'TNEGA_OBC';
    }
    if (isDirectOperator) {
        sess.intakeState = 'OBC_INTAKE';
        if (createAppFn && cleanMobile) { try { createAppFn(cleanMobile, 'OBC_CERTIFICATE', sess.citizenProfile); } catch (_) {} }
    }
    const flowStep = advanceFlow(sess, greeting);
    const botMsg = { sender: 'bot', text: flowStep.text, options: flowStep.options };
    if (isDirectOperator) sess.chatHistory = [botMsg];
    else sess.chatHistory.push(botMsg);
    return true;
}

function onDocumentDeleted(sess, docType) {
    if (!sess) return false;
    sess.subService = 'OBC';
    sess.chatHistory = Array.isArray(sess.chatHistory) ? sess.chatHistory : [];
    const p = sess.citizenProfile || {};
    if (docType === 'communityCertificate' || docType === 'communityProof' || docType === 'familyCommunityProof') {
        delete p.communityCertificate;
        delete p.communityProof;
        delete p.communityCertificatePath;
        delete p.familyCommunityProofPath;
    } else if (docType === 'incomeTaxReturn' || docType === 'incomeProof' || docType === 'salaryCertificate') {
        delete p.incomeTaxReturn;
        delete p.incomeProof;
        delete p.salaryCertificate;
        delete p.salaryCertificatePath;
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
    const flowStep = advanceFlow(sess, `🔄 ஆவண மாற்றங்களுக்கு ஏற்ப OBC சான்றிதழ் (REV-115) நிலை புதுப்பிக்கப்பட்டது.`);
    sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
    return true;
}

module.exports = { advanceFlow, enterService, onDocumentDeleted };
