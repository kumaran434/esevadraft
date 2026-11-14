const storageService = require('../../services/storage_service');
const { updateHeadMember, getVerifiedRationCardDocs } = require('../../services/profile_helpers');
const { saveCitizenProfile } = require('../../../database');
const { saveCitizenDraft } = require('../../../firestore_db');
const { inspectAndExtractDocument } = require('../../../ai_document_extractor');
const { produceCompliantDocument, produceCompliantPassportPhoto } = require('../../../photo_studio');

const { persistSessions } = storageService;

async function handleHeadPhoto(ctx, req, res) {
    const { uploadedFile, sess } = ctx;
    const activeMobile = ctx.targetMobile || sess.mobileNumber || sess.citizenProfile?.mobileNumber || storageService.getActiveMobile();

    if (sess.intakeState !== 'HEAD_PHOTO') return false;

    if (!uploadedFile) {
        sess.chatHistory.push({
            sender: 'bot',
            text: `📸 தயவுசெய்து குடும்பத் தலைவரின் **பாஸ்போர்ட் புகைப்படத்தை** கீழே உள்ள கேமரா/கோப்பு பொத்தானைப் பயன்படுத்திப் பதிவேற்றவும்.`,
            actionRequired: 'upload',
            uploadPrompt: 'குடும்பத் தலைவர் புகைப்படம் பதிவேற்றவும்'
        });
        res.json({
        chatHistory: sess.chatHistory,
        citizenProfile: sess.citizenProfile,
        step: sess.intakeState,
        activeMobile: activeMobile,
        targetMemberCount: sess.targetMemberCount || 1,
        documents: sess.tempUploads || sess.citizenProfile?.documents || {}
    });
        return true;
    }

    const qualityCheck = await inspectAndExtractDocument(uploadedFile.path);
    if (qualityCheck && qualityCheck.isQualityAcceptable === false) {
        sess.chatHistory.push({
            sender: 'bot',
            text: `⚠️ **ஆவணம் / புகைப்படம் தெளிவாக இல்லை:**\n\n` +
                  `${qualityCheck.feedbackTamil || 'பதிவேற்றப்பட்ட ஆவணம் மங்கலாக அல்லது நிழல் விழுந்து உள்ளது.'}\n\n` +
                  `🛑 அரசு இணையதளத்தில் நிராகரிக்கப்படாமல் இருக்க, உங்கள் முகம் மற்றும் விவரங்கள் தெளிவாகத் தெரியும்படி நல்ல வெளிச்சத்தில் எடுக்கப்பட்ட **தெளிவான ஆவணத்தை** மீண்டும் பதிவேற்றவும்:`,
            actionRequired: 'upload',
            uploadPrompt: 'தெளிவான பாஸ்போர்ட் புகைப்படம் பதிவேற்றவும்'
        });
        res.json({
        chatHistory: sess.chatHistory,
        citizenProfile: sess.citizenProfile,
        step: sess.intakeState,
        activeMobile: activeMobile,
        targetMemberCount: sess.targetMemberCount || 1,
        documents: sess.tempUploads || sess.citizenProfile?.documents || {}
    });
        return true;
    }

    const isAadhaar = qualityCheck && (
        qualityCheck.aadhaarNumber || 
        (qualityCheck.documentType && qualityCheck.documentType.startsWith('AADHAAR')) || 
        qualityCheck.isFullAadhaar || 
        qualityCheck.hasAddress
    );

    if (isAadhaar) {
        if (qualityCheck.fullNameEng) sess.citizenProfile.fullNameEng = qualityCheck.fullNameEng;
        if (qualityCheck.fullNameTam) sess.citizenProfile.fullNameTam = qualityCheck.fullNameTam;
        if (qualityCheck.fatherNameEng) sess.citizenProfile.fatherNameEng = qualityCheck.fatherNameEng;
        if (qualityCheck.fatherNameTam) sess.citizenProfile.fatherNameTam = qualityCheck.fatherNameTam;
        if (qualityCheck.dob) sess.citizenProfile.headDob = qualityCheck.dob;
        if (qualityCheck.gender) {
            sess.citizenProfile.headGender = qualityCheck.gender;
            sess.citizenProfile.headGenderTam = qualityCheck.gender === 'Female' ? 'பெண்' : 'ஆண்';
        }
        if (qualityCheck.aadhaarNumber) sess.citizenProfile.headAadhaar = qualityCheck.aadhaarNumber;
        if (qualityCheck.doorNo) sess.citizenProfile.doorNo = qualityCheck.doorNo;
        if (qualityCheck.streetEng) sess.citizenProfile.streetEng = qualityCheck.streetEng;
        if (qualityCheck.streetTam) sess.citizenProfile.streetTam = qualityCheck.streetTam;
        if (qualityCheck.pincode) sess.citizenProfile.pincode = qualityCheck.pincode;
        if (qualityCheck.district) sess.citizenProfile.district = qualityCheck.district;
        if (qualityCheck.taluk) sess.citizenProfile.taluk = qualityCheck.taluk;
        if (qualityCheck.village) sess.citizenProfile.village = qualityCheck.village;

        const fullPdf = await produceCompliantDocument(uploadedFile.path);
        sess.tempUploads = sess.tempUploads || {};
        sess.tempUploads.headAadhaarFront = uploadedFile.path;
        updateHeadMember(sess.citizenProfile, fullPdf);
        if (activeMobile) {
            saveCitizenProfile(activeMobile, sess.citizenProfile);
            saveCitizenDraft(activeMobile, {
                operatorUid: sess.operatorUid || null,
                operatorName: sess.operatorName || null,
                operatorMobile: sess.operatorMobile || null,
                citizenProfile: sess.citizenProfile,
                documents: sess.citizenProfile.documents || {},
                tempUploads: sess.tempUploads || {},
                intakeState: sess.intakeState,
                step: sess.step,
                targetMemberCount: sess.targetMemberCount || 1,
                chatHistory: sess.chatHistory
            }).catch(() => {});
        }
        persistSessions();

        sess.chatHistory.push({
            sender: 'bot',
            text: `🪪 **குடும்பத் தலைவர் ஆதார் அட்டை விவரங்கள் வெற்றிகரமாகப் பெறப்பட்டன!** ✅\n\n` +
                  `• 👤 **பெயர்:** ${sess.citizenProfile.fullNameTam} (${sess.citizenProfile.fullNameEng})\n` +
                  `• 🪪 **ஆதார் எண்:** ${(sess.citizenProfile.headAadhaar || '').replace(/(\d{4})/g, '$1 ').trim()}\n\n` +
                  `📸 **அடுத்து: குடும்பத் தலைவரின் பாஸ்போர்ட் புகைப்படம்**\n\n` +
                  `குடும்பத் தலைவரின் பாஸ்போர்ட் அளவிலான புகைப்படத்தைப் பதிவேற்றவும் (அல்லது செல்ஃபி எடுக்கவும்):`,
            actionRequired: 'upload',
            uploadPrompt: 'குடும்பத் தலைவர் புகைப்படம் பதிவேற்றவும்'
        });
        res.json({
        chatHistory: sess.chatHistory,
        citizenProfile: sess.citizenProfile,
        step: sess.intakeState,
        activeMobile: activeMobile,
        targetMemberCount: sess.targetMemberCount || 1,
        documents: sess.tempUploads || sess.citizenProfile?.documents || {}
    });
        return true;
    }

    const studioPhoto = await produceCompliantPassportPhoto(uploadedFile.path);
    sess.citizenProfile.headPhotoPath = studioPhoto;
    sess.citizenProfile.documents = sess.citizenProfile.documents || {};
    sess.citizenProfile.documents.profilePhoto = studioPhoto;
    sess.tempUploads = sess.tempUploads || {};
    sess.tempUploads.profilePhoto = studioPhoto;
    if (activeMobile) {
        saveCitizenProfile(activeMobile, sess.citizenProfile);
        saveCitizenDraft(activeMobile, {
            operatorUid: sess.operatorUid || null,
            operatorName: sess.operatorName || null,
            operatorMobile: sess.operatorMobile || null,
            citizenProfile: sess.citizenProfile,
            documents: sess.citizenProfile.documents || {},
            tempUploads: sess.tempUploads || {},
            intakeState: sess.intakeState,
            step: sess.step,
            targetMemberCount: sess.targetMemberCount || 1,
            chatHistory: sess.chatHistory
        }).catch(() => {});
    }

    const { hasAadhaarDoc } = getVerifiedRationCardDocs(sess.citizenProfile, sess.tempUploads);
    if (sess.citizenProfile.headAadhaar && hasAadhaarDoc) {
        sess.intakeState = 'HEAD_DETAILS_VERIFY';
        sess.chatHistory.push({
            sender: 'bot',
            text: `✨ **ஏஐ போட்டோ ஸ்டுடியோ:** குடும்பத் தலைவர் புகைப்படம் வெள்ளை பின்னணியுடன் சேமிக்கப்பட்டது! 📸\n\n` +
                  `🔍 **குடும்பத் தலைவரின் விவரங்கள் சரிபார்ப்பு:**\n` +
                  `• 👤 **பெயர்:** ${sess.citizenProfile.fullNameTam} (${sess.citizenProfile.fullNameEng})\n` +
                  `• 🪪 **ஆதார் எண்:** ${(sess.citizenProfile.headAadhaar || '').replace(/(\d{4})/g, '$1 ').trim()}\n\n` +
                  `விவரங்கள் சரியாக இருந்தால் **'விவரங்கள் அனைத்தும் சரி'** என்பதைத் தொடரவும்:`,
            options: [
                { label: "✅ விவரங்கள் அனைத்தும் சரி (All Correct - Continue)", value: "HEAD_DETAILS_CONFIRMED" },
                { label: "✏️ விவரங்களைச் சரிபார் / திருத்து (Review / Edit Details)", value: "TRIGGER_EDIT_MODAL" }
            ]
        });
    } else {
        sess.intakeState = 'HEAD_AADHAAR_FRONT';
        sess.chatHistory.push({
            sender: 'bot',
            text: `✨ **ஏஐ போட்டோ ஸ்டுடியோ:** குடும்பத் தலைவர் புகைப்படம் அரசு விதிகளுக்கு ஏற்ப **வெள்ளை பின்னணியுடன் (White Background)** செப்பனிடப்பட்டு சேமிக்கப்பட்டது!\n\n` +
                  `🪪 **படி 2/6: குடும்பத் தலைவரின் ஆதார் அட்டை**\n\n` +
                  `குடும்பத் தலைவரின் ஆதார் அட்டையைப் பதிவேற்றவும்:`,
            actionRequired: 'upload',
            uploadPrompt: 'ஆதார் அட்டை பதிவேற்றவும்'
        });
    }
    persistSessions();
    res.json({
        chatHistory: sess.chatHistory,
        citizenProfile: sess.citizenProfile,
        step: sess.intakeState,
        activeMobile: activeMobile,
        targetMemberCount: sess.targetMemberCount || 1,
        documents: sess.tempUploads || sess.citizenProfile?.documents || {}
    });
    return true;
}

module.exports = {
    handleHeadPhoto
};
