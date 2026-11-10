const storageService = require('../../services/storage_service');
const { MEMBER_COUNT_OPTIONS } = require('../../core/chat_fsm');
const { updateHeadMember } = require('../../services/profile_helpers');
const { saveCitizenProfile } = require('../../../database');
const { inspectAndExtractDocument } = require('../../../ai_document_extractor');
const { produceCompliantDocument } = require('../../../photo_studio');

const { createFreshProfile, persistSessions } = storageService;

async function handleMemberCount(ctx, req, res) {
    const { text, uploadedFile, sess } = ctx;
    const activeMobile = storageService.getActiveMobile();

    if (sess.intakeState !== 'MEMBER_COUNT') return false;

    if (uploadedFile) {
        const extracted = await inspectAndExtractDocument(uploadedFile.path);
        const isAadhaar = extracted && (
            extracted.aadhaarNumber || 
            (extracted.documentType && extracted.documentType.startsWith('AADHAAR')) || 
            extracted.isFullAadhaar || 
            extracted.hasAddress
        );

        if (!sess.citizenProfile) {
            sess.citizenProfile = createFreshProfile(activeMobile);
        }

        if (isAadhaar) {
            if (extracted.fullNameEng) sess.citizenProfile.fullNameEng = extracted.fullNameEng;
            if (extracted.fullNameTam) sess.citizenProfile.fullNameTam = extracted.fullNameTam;
            if (extracted.fatherNameEng) sess.citizenProfile.fatherNameEng = extracted.fatherNameEng;
            if (extracted.fatherNameTam) sess.citizenProfile.fatherNameTam = extracted.fatherNameTam;
            if (extracted.dob) sess.citizenProfile.headDob = extracted.dob;
            if (extracted.gender) {
                sess.citizenProfile.headGender = extracted.gender;
                sess.citizenProfile.headGenderTam = extracted.gender === 'Female' ? 'பெண்' : 'ஆண்';
            }
            if (extracted.aadhaarNumber) sess.citizenProfile.headAadhaar = extracted.aadhaarNumber;
            if (extracted.doorNo) sess.citizenProfile.doorNo = extracted.doorNo;
            if (extracted.streetEng) sess.citizenProfile.streetEng = extracted.streetEng;
            if (extracted.streetTam) sess.citizenProfile.streetTam = extracted.streetTam;
            if (extracted.pincode) sess.citizenProfile.pincode = extracted.pincode;
            if (extracted.district) sess.citizenProfile.district = extracted.district;
            if (extracted.taluk) sess.citizenProfile.taluk = extracted.taluk;
            if (extracted.village) sess.citizenProfile.village = extracted.village;

            const fullPdf = await produceCompliantDocument(uploadedFile.path);
            sess.tempUploads = sess.tempUploads || {};
            sess.tempUploads.headAadhaarFront = uploadedFile.path;
            updateHeadMember(sess.citizenProfile, fullPdf);
            if (activeMobile) saveCitizenProfile(activeMobile, sess.citizenProfile);
            persistSessions();

            sess.chatHistory.push({
                sender: 'bot',
                text: `🪪 **குடும்பத் தலைவர் ஆதார் அட்டை விவரங்கள் வெற்றிகரமாகப் பெறப்பட்டன!** ✅\n\n` +
                      `💡 **ஆதார் பெயர் சரிபார்ப்பு:** வாடிக்கையாளர் பெயர் ஆதார் அட்டையின்படி **${sess.citizenProfile.fullNameTam || ''} (${sess.citizenProfile.fullNameEng || ''})** எனத் தானாகவே துல்லியமாகப் புதுப்பிக்கப்பட்டது! ✅\n\n` +
                      `• 👤 **பெயர்:** ${sess.citizenProfile.fullNameTam} (${sess.citizenProfile.fullNameEng})\n` +
                      `• 🪪 **ஆதார் எண்:** ${(sess.citizenProfile.headAadhaar || '').replace(/(\d{4})/g, '$1 ').trim()}\n` +
                      `• 🎂 **பிறந்த தேதி:** ${sess.citizenProfile.headDob}\n\n` +
                      `📸 அடுத்ததாகக் குடும்பத் தலைவரின் **பாஸ்போர்ட் புகைப்படத்தைப்** பதிவேற்றவும்:`,
                actionRequired: 'upload',
                uploadPrompt: 'குடும்பத் தலைவர் புகைப்படம் பதிவேற்றவும்'
            });
            sess.intakeState = 'HEAD_PHOTO';
            persistSessions();
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState });
            return true;
        }
    }

    const countMatch = text.match(/\d+/);
    if (!countMatch) {
        sess.chatHistory.push({
            sender: 'bot',
            text: `⚠️ தயவுசெய்து குடும்ப உறுப்பினர்களின் எண்ணிக்கையைக் கீழே உள்ளதில் தேர்ந்தெடுக்கவும்:`,
            options: MEMBER_COUNT_OPTIONS
        });
        persistSessions();
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState });
        return true;
    }

    sess.targetMemberCount = parseInt(countMatch[0]);
    if (sess.targetMemberCount < 1) sess.targetMemberCount = 1;
    if (sess.targetMemberCount > 10) sess.targetMemberCount = 10;
    sess.currentMemberIdx = 0;

    if (!sess.citizenProfile) {
        sess.citizenProfile = createFreshProfile(activeMobile);
    }

    const existingCount = sess.citizenProfile.members ? sess.citizenProfile.members.length : 0;
    if (existingCount > 0 && sess.targetMemberCount <= existingCount) {
        sess.citizenProfile.members = sess.citizenProfile.members.slice(0, sess.targetMemberCount);
        if (activeMobile) saveCitizenProfile(activeMobile, sess.citizenProfile);
        sess.intakeState = 'READY_TO_APPLY';
        sess.step = 'READY';

        let membersSummary = '';
        sess.citizenProfile.members.forEach((m, idx) => {
            membersSummary += `  ${idx + 1}. **${m.nameTam || m.nameEng}** (${m.relationshipTam || (idx === 0 ? 'தலைவர்' : 'உறுப்பினர்')}) | ஆதார்: ${(m.aadhaarNumber || '').replace(/(\d{4})/g, '$1 ').trim()} ✅\n`;
        });

        sess.chatHistory.push({
            sender: 'bot',
            text: `✅ ஏற்கெனவே உள்ள ${sess.citizenProfile.members.length} உறுப்பினர்களின் விவரங்கள் மற்றும் ஆவணங்கள் தயாராக உள்ளன! 🛡️\n\n` +
                  `• 👤 **குடும்பத் தலைவர்:** ${sess.citizenProfile.fullNameTam || sess.citizenProfile.fullNameEng}\n` +
                  `• 👥 **உறுப்பினர்கள்:**\n${membersSummary}` +
                  `\nஇப்போது அரசு TNPDS போர்ட்டலில் விண்ணப்பத்தைத் தொடங்கலாம்:`,
            options: [
                { label: "🚀 TNPDS போர்ட்டலில் விண்ணப்பி (Submit to Portal)", value: "CONFIRM_SUBMIT" },
                { label: "✏️ விவரங்களைச் சரிபார் / திருத்து (Review Details)", value: "TRIGGER_EDIT_MODAL" }
            ]
        });
        persistSessions();
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState });
        return true;
    } else if (existingCount > 0 && sess.targetMemberCount > existingCount) {
        sess.currentMemberIdx = existingCount;
        sess.tempUploads.currentMemberFront = null;
        sess.tempUploads.currentMemberBack = null;
        sess.tempMember = null;
        sess.intakeState = 'MEMBER_AADHAAR_FRONT';
        sess.chatHistory.push({
            sender: 'bot',
            text: `✅ **ஏற்கெனவே உள்ள ${existingCount} உறுப்பினர்களின் விவரங்கள் பாதுகாக்கப்பட்டுள்ளன!** 👥\n\n` +
                  `👥 **படி 3/6: கூடுதல் குடும்ப உறுப்பினர் ${sess.currentMemberIdx + 1}-ன் ஆதார் அட்டை**\n\n` +
                  `கூடுதல் உறுப்பினர் ${sess.currentMemberIdx + 1}-ன் ஆதார் அட்டையைப் (முன்பக்கம் அல்லது முழு ஆதார் அட்டை) பதிவேற்றவும்:`,
            actionRequired: 'upload',
            uploadPrompt: `உறுப்பினர் ${sess.currentMemberIdx + 1} ஆதார்`
        });
        persistSessions();
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState });
        return true;
    }

    if (sess.citizenProfile.headPhotoPath && sess.citizenProfile.headAadhaar) {
        sess.intakeState = 'HEAD_DETAILS_VERIFY';
        sess.chatHistory.push({
            sender: 'bot',
            text: `✅ மொத்தம் **${sess.targetMemberCount} உறுப்பினர்கள்** தேர்ந்தெடுக்கப்பட்டுள்ளனர்.\n\nகுடும்பத் தலைவரின் விவரங்களைச் சரிபார்த்து உறுதிப்படுத்தவும்:`,
            options: [
                { label: "✅ விவரங்கள் அனைத்தும் சரி (All Correct - Continue)", value: "HEAD_DETAILS_CONFIRMED" },
                { label: "✏️ விவரங்களைச் சரிபார் / திருத்து (Review / Edit Details)", value: "TRIGGER_EDIT_MODAL" }
            ]
        });
    } else {
        sess.intakeState = 'HEAD_PHOTO';
        sess.chatHistory.push({
            sender: 'bot',
            text: `📸 **படி 1/6: குடும்பத் தலைவரின் பாஸ்போர்ட் புகைப்படம்**\n\n` +
                  `மொத்தம் **${sess.targetMemberCount} உறுப்பினர்கள்** தேர்ந்தெடுக்கப்பட்டுள்ளனர்.\n\n` +
                  `முதலில் குடும்பத் தலைவரின் பாஸ்போர்ட் அளவிலான புகைப்படத்தைப் பதிவேற்றவும் (அல்லது கேமரா மூலம் செல்ஃபி எடுக்கவும்).\n\n` +
                  `💡 **ஏஐ போட்டோ ஸ்டுடியோ:** உங்கள் புகைப்படத்தை அரசு விதிகளுக்கு ஏற்ப **வெள்ளை பின்னணியுடன் (Solid White Background)** எங்களின் AI தானாகவே செப்பனிட்டு சேமிக்கும்!`,
            actionRequired: 'upload',
            uploadPrompt: 'குடும்பத் தலைவர் புகைப்படம் பதிவேற்றவும்'
        });
    }
    persistSessions();
    res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState });
    return true;
}

module.exports = {
    handleMemberCount
};
