const storageService = require('../../services/storage_service');
const { isProfileDataComplete } = require('../../services/profile_helpers');
const { 
    getLiveReplacementStatus, 
    provideReplacementFile, 
    getLiveOtpStatus, 
    provideOtp, 
    resendOtp 
} = require('../../../tnpds_automation');
const { produceCompliantPassportPhoto, produceCompliantDocument } = require('../../../photo_studio');

const { persistSessions, resetActiveSession } = storageService;

async function handleChatCommands(ctx, req, res) {
    const { text, uploadedFile, sess } = ctx;
    const activeMobile = storageService.getActiveMobile();

    // 1. RESET / RESTART CONVERSATION
    if (text.toLowerCase() === 'reset' || text.includes('மீண்டும்') || text.includes('புதிதாக') || text === 'START_NEW_CUSTOMER' || text === 'RESET_SCREEN') {
        await resetActiveSession();
        const freshSess = storageService.getOrCreateSession(activeMobile);
        res.json({
            chatHistory: freshSess.chatHistory,
            citizenProfile: freshSess.citizenProfile,
            step: freshSess.intakeState
        });
        return true;
    }

    // 2. REPLACEMENT FILE FOR LIVE PORTAL ERROR
    const replStatus = getLiveReplacementStatus();
    if (uploadedFile && replStatus.isWaitingForFile) {
        let processed = uploadedFile.path;
        if (replStatus.fileType === 'HEAD_PHOTO') {
            processed = await produceCompliantPassportPhoto(uploadedFile.path);
            sess.citizenProfile.headPhotoPath = processed;
        } else {
            processed = await produceCompliantDocument(uploadedFile.path);
        }
        provideReplacementFile(processed);
        sess.chatHistory.push({
            sender: 'user',
            text: `📸 புதிய ஆவணம்/புகைப்படம் பதிவேற்றப்பட்டது: ${uploadedFile.originalname}`
        });
        sess.chatHistory.push({
            sender: 'bot',
            text: `⏳ **புதிய ஆவணம் பெறப்பட்டது!** அரசு போர்ட்டலில் மீண்டும் பதிவேற்றிச் சரிபார்க்கப்படுகிறது...`
        });
        res.json({
            chatHistory: sess.chatHistory,
            citizenProfile: sess.citizenProfile,
            step: 'filling_form'
        });
        return true;
    }

    // 3. CHANGE / UPDATE HEAD PHOTO ONLY
    if (text === 'CHANGE_HEAD_PHOTO' || text.includes('போட்டோ மாற்று') || text.includes('புகைப்படம் மாற்று') || text.toLowerCase().includes('change photo')) {
        sess.intakeState = 'HEAD_PHOTO';
        sess.chatHistory.push({
            sender: 'user',
            text: '📸 பாஸ்போர்ட் புகைப்படத்தை மாற்று'
        });
        sess.chatHistory.push({
            sender: 'bot',
            text: `📸 **குடும்பத் தலைவர் (${sess.citizenProfile?.fullNameTam || sess.citizenProfile?.fullNameEng || 'விண்ணப்பதாரர்'}) புதிய பாஸ்போர்ட் புகைப்படத்தைப் பதிவேற்றவும்:**\n\n💡 *ஏஐ போட்டோ ஸ்டுடியோ உடனடியாக வெள்ளை பின்னணியுடன் (< 50 KB) அரசு TNPDS தரத்திற்கு மாற்றும். மற்ற அனைத்து முகவரி மற்றும் குடும்ப விவரங்களும் வரைவில் அப்படியே பாதுகாப்பாக இருக்கும்!*`,
            actionRequired: 'upload',
            uploadPrompt: 'புதிய பாஸ்போர்ட் புகைப்படம் தேர்ந்தெடுக்கவும்'
        });
        persistSessions();
        res.json({
            chatHistory: sess.chatHistory,
            citizenProfile: sess.citizenProfile,
            step: sess.intakeState
        });
        return true;
    }

    // 4. HANDLE CONTINUE_INTAKE FOR RESUMED DRAFTS
    if (text === 'CONTINUE_INTAKE' || text.includes('விட்ட இடத்திலிருந்து')) {
        const isComplete = isProfileDataComplete(sess.citizenProfile, sess.tempUploads);
        if (isComplete) {
            sess.intakeState = 'READY_TO_APPLY';
            sess.step = 'READY';
            sess.chatHistory.push({
                sender: 'bot',
                text: `✅ **அனைத்து விவரங்களும் ஏற்கெனவே முழுமையாகப் பெறப்பட்டுவிட்டன!** வலதுபுறம் உள்ள விவரங்களைச் சரிபார்த்துவிட்டு நேரடியாகப் போர்ட்டலில் விண்ணப்பிக்கலாம்.`,
                options: [
                    { label: "🚀 TNPDS-ல் இப்போது விண்ணப்பி (Submit to Portal)", value: "CONFIRM_SUBMIT" },
                    { label: "✏️ விவரங்களைச் சரிபார் / திருத்து (Review Details)", value: "TRIGGER_EDIT_MODAL" },
                    { label: "📸 பாஸ்போர்ட் புகைப்படத்தை மாற்று (Change Photo)", value: "CHANGE_HEAD_PHOTO" }
                ]
            });
        } else {
            const prof = sess.citizenProfile || {};
            const docs = sess.tempUploads || {};
            const hasPhoto = !!(prof.headPhotoPath || docs.profilePhoto || docs.headPhoto || (prof.documents && prof.documents.profilePhoto));
            const hasAadhaar = !!(prof.headAadhaar && /^\d{12}$/.test(prof.headAadhaar.replace(/\s+/g, '')));
            const hasAddress = !!(prof.doorNo && prof.pincode);
            const hasProof = !!(prof.residenceProof || (prof.gasDetails && prof.gasDetails.hasGas) || docs.residenceProof || docs.gasBook);

            if (!hasAadhaar) {
                sess.intakeState = 'HEAD_AADHAAR_FRONT';
                sess.chatHistory.push({
                    sender: 'bot',
                    text: `🪪 குடும்பத் தலைவரின் **ஆதார் அட்டைப் புகைப்படத்தை** (முன்பக்கம் அல்லது முழு ஆதார் அட்டை) பதிவேற்றவும்:`,
                    actionRequired: 'upload',
                    uploadPrompt: 'ஆதார் அட்டை பதிவேற்றவும்'
                });
            } else if (!hasPhoto) {
                sess.intakeState = 'HEAD_PHOTO';
                sess.chatHistory.push({
                    sender: 'bot',
                    text: `📸 குடும்பத் தலைவரின் **பாஸ்போர்ட் அளவிலான புகைப்படத்தைப்** பதிவேற்றவும்:`,
                    actionRequired: 'upload',
                    uploadPrompt: 'பாஸ்போர்ட் புகைப்படம் பதிவேற்றவும்'
                });
            } else if (!hasAddress) {
                sess.intakeState = 'ADDRESS_DOOR_NO';
                sess.chatHistory.push({
                    sender: 'bot',
                    text: `🏠 குடும்பத் தலைவரின் **கதவு எண்ணை (Door No)** உள்ளிடவும்:`
                });
            } else if (!hasProof) {
                sess.intakeState = 'RESIDENCE_PROOF_DOC';
                sess.chatHistory.push({
                    sender: 'bot',
                    text: `📄 **குடியிருப்புச் சான்று ஆவணத்தைப்** (மின் கட்டண ரசீது / எரிவாயு அட்டை / வாடகை ஒப்பந்தம்) பதிவேற்றவும்:`,
                    actionRequired: 'upload',
                    uploadPrompt: 'குடியிருப்புச் சான்று பதிவேற்றவும்'
                });
            } else {
                sess.intakeState = 'READY_TO_APPLY';
                sess.step = 'READY';
                sess.chatHistory.push({
                    sender: 'bot',
                    text: `✅ **அனைத்து விவரங்களும் முழுமையாகப் பெறப்பட்டுவிட்டன!** TNPDS போர்ட்டலில் விண்ணப்பிக்கலாம்.`,
                    options: [
                        { label: "🚀 TNPDS-ல் இப்போது விண்ணப்பி (Submit to Portal)", value: "CONFIRM_SUBMIT" },
                        { label: "✏️ விவரங்களைச் சரிபார் / திருத்து (Review Details)", value: "TRIGGER_EDIT_MODAL" }
                    ]
                });
            }
        }
        persistSessions();
        res.json({
            chatHistory: sess.chatHistory,
            citizenProfile: sess.citizenProfile,
            step: sess.intakeState
        });
        return true;
    }

    // 5. LIVE OTP WAITING
    const liveOtpStatus = getLiveOtpStatus();
    let tnegaStatus = { isWaitingForCanOtp: false };
    try {
        const { getLiveTnegaStatus } = require('../../../tnega_can_automation');
        tnegaStatus = getLiveTnegaStatus();
    } catch (_) {}

    const isWaitingAnyOtp = liveOtpStatus.isWaitingForOtp || tnegaStatus.isWaitingForCanOtp;
    const cleanDigits = text.replace(/\D/g, '');

    if (isWaitingAnyOtp && (cleanDigits.length === 4 || cleanDigits.length === 6 || cleanDigits.length === 7)) {
        if (tnegaStatus.isWaitingForCanOtp) {
            try {
                const { provideCanOtp } = require('../../../tnega_can_automation');
                provideCanOtp(cleanDigits);
            } catch (_) {}
        }
        if (liveOtpStatus.isWaitingForOtp) {
            provideOtp(cleanDigits);
        }
        sess.chatHistory.push({
            sender: 'bot',
            text: `⚡ **OTP பெறப்பட்டது (${cleanDigits})!** அரசு போர்ட்டலில் சரிபார்க்கப்படுகிறது...`
        });
        sess.step = 'filling_form';
        persistSessions();
        res.json({
            chatHistory: sess.chatHistory,
            citizenProfile: sess.citizenProfile,
            step: sess.step
        });
        return true;
    } else if (isWaitingAnyOtp && cleanDigits.length > 0 && !text.toLowerCase().includes('resend') && !text.includes('மறுமுறை')) {
        sess.chatHistory.push({
            sender: 'bot',
            text: `⚠️ **தவறான OTP வடிவம்:** நீங்கள் உள்ளிட்டது ${cleanDigits.length} இலக்கங்கள் ("${text.trim()}"). அரசு OTP 4 அல்லது 6 இலக்கங்களாக இருக்க வேண்டும்.\n\nதயவுசெய்து உங்கள் மொபைலுக்கு (+91 ${activeMobile}) வந்த சரியான OTP எண்ணை உள்ளிடவும்:`
        });
        persistSessions();
        res.json({
            chatHistory: sess.chatHistory,
            citizenProfile: sess.citizenProfile,
            step: sess.intakeState
        });
        return true;
    }

    // 6. RESEND OTP
    if (text.toLowerCase().includes('resend') || text.includes('மறுமுறை')) {
        const resendResult = await resendOtp();
        sess.chatHistory.push({
            sender: 'bot',
            text: resendResult.success 
                ? `🔄 **அரசு இணையதளத்தில் புதிய OTP மீண்டும் அனுப்பப்பட்டுள்ளது!**\n\nஉங்கள் கைபேசிக்கு வந்துள்ள புதிய 6-இலக்க OTP எண்ணை உள்ளிடவும்:`
                : `⚠️ ${resendResult.message}`
        });
        persistSessions();
        res.json({
            chatHistory: sess.chatHistory,
            citizenProfile: sess.citizenProfile,
            step: sess.step
        });
        return true;
    }

    return false;
}

module.exports = {
    handleChatCommands
};
