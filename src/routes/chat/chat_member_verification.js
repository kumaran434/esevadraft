const storageService = require('../../services/storage_service');
const { mapRelationshipToEng } = require('../../core/chat_fsm');
const { isProfileDataComplete } = require('../../services/profile_helpers');
const { saveCitizenProfile } = require('../../../database');
const { saveCitizenDraft } = require('../../../firestore_db');

const { persistSessions } = storageService;

async function handleMemberVerification(ctx, req, res) {
    const { text, sess } = ctx;
    const activeMobile = sess.mobileNumber || sess.citizenProfile?.mobileNumber || storageService.getActiveMobile();

    // STATE 8: MEMBER_RELATIONSHIP
    if (sess.intakeState === 'MEMBER_RELATIONSHIP') {
        const relInfo = mapRelationshipToEng(text);
        sess.tempMember = sess.tempMember || {};
        sess.tempMember.relationship = relInfo.eng;
        sess.tempMember.relationshipTam = relInfo.tam;
        sess.tempMember.gender = relInfo.gender;
        sess.tempMember.genderTam = relInfo.genderTam;
        sess.tempMember.relationshipIndex = sess.currentMemberIdx;

        if ((relInfo.eng === 'Husband' || relInfo.tam === 'கணவர்') && sess.citizenProfile?.headGender === 'Female') {
            if (sess.tempMember.nameEng) sess.citizenProfile.fatherNameEng = sess.tempMember.nameEng;
            if (sess.tempMember.nameTam) sess.citizenProfile.fatherNameTam = sess.tempMember.nameTam;
            if (activeMobile) saveCitizenProfile(activeMobile, sess.citizenProfile);
        }

        const formattedMemberAadhaar = (sess.tempMember.aadhaarNumber || '').replace(/(\d{4})/g, '$1 ').trim();
        sess.intakeState = 'MEMBER_DETAILS_VERIFY';
        sess.chatHistory.push({
            sender: 'bot',
            text: `🔍 **உறுப்பினர் ${sess.currentMemberIdx + 1} (${relInfo.tam}) விவரங்கள் சரிபார்ப்பு (Member Verification):**\n\n` +
                  `• 👤 **பெயர் (தமிழ்):** ${sess.tempMember.nameTam || '—'}\n` +
                  `• 🔤 **Name (English):** ${sess.tempMember.nameEng || '—'}\n` +
                  `• 🤝 **உறவுமுறை:** ${relInfo.tam} (${relInfo.eng})\n` +
                  `• 🎂 **பிறந்த தேதி:** ${sess.tempMember.dob || '—'}\n` +
                  `• ⚧️ **பாலினம்:** ${sess.tempMember.genderTam || '—'} (${sess.tempMember.gender || '—'})\n` +
                  `• 🪪 **ஆதார் எண்:** ${formattedMemberAadhaar || '—'}\n\n` +
                  `விவரங்கள் சரியாக இருந்தால் **'உறுப்பினர் விவரங்கள் சரி'** என்பதைத் தேர்ந்தெடுக்கவும், அல்லது ஏதேனும் மாற்றங்கள் இருந்தால் **'விவரங்களைச் சரிபார் / திருத்து'** என்பதைத் தேர்ந்தெடுக்கவும்:`,
            options: [
                { label: "✅ உறுப்பினர் விவரங்கள் சரி (Details Correct - Continue)", value: "MEMBER_DETAILS_CONFIRMED" },
                { label: "✏️ விவரங்களைச் சரிபார் / திருத்து (Review / Edit Details)", value: "TRIGGER_EDIT_MODAL" }
            ]
        });
        persistSessions(activeMobile);
        if (activeMobile) {
            saveCitizenDraft(activeMobile, {
                citizenProfile: sess.citizenProfile,
                chatHistory: sess.chatHistory,
                intakeState: sess.intakeState,
                targetMemberCount: sess.targetMemberCount,
                currentMemberIdx: sess.currentMemberIdx,
                tempMember: sess.tempMember,
                tempUploads: sess.tempUploads,
                step: sess.step || 'draft'
            }).catch(() => {});
        }
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState });
        return true;
    }

    // STATE 8.5: MEMBER_DETAILS_VERIFY
    if (sess.intakeState === 'MEMBER_DETAILS_VERIFY') {
        if (text === 'TRIGGER_EDIT_MODAL' || text.includes('திருத்து') || text.toLowerCase().includes('edit')) {
            sess.chatHistory.push({
                sender: 'bot',
                text: `✏️ திருத்தம் செய்த பின் **'உறுப்பினர் விவரங்கள் சரி'** என்பதைத் தேர்ந்தெடுக்கவும்.`,
                actionRequired: 'open_edit_modal',
                options: [
                    { label: "✅ உறுப்பினர் விவரங்கள் சரி (Details Correct - Continue)", value: "MEMBER_DETAILS_CONFIRMED" },
                    { label: "✏️ மீண்டும் படிவத்தைத் திற (Open Edit Window)", value: "TRIGGER_EDIT_MODAL" }
                ]
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState });
            return true;
        }

        if (text === 'MEMBER_DETAILS_CONFIRMED' || text.includes('சரி') || text.includes('Correct') || text.toLowerCase().includes('ok') || text.toLowerCase().includes('continue')) {
            const confirmedRelTam = sess.tempMember?.relationshipTam || 'உறுப்பினர்';
            if (sess.tempMember) {
                sess.citizenProfile.members = sess.citizenProfile.members || [];
                sess.citizenProfile.members.push(sess.tempMember);
                if (activeMobile) saveCitizenProfile(activeMobile, sess.citizenProfile);
            }

            const isHusband = sess.tempMember?.relationship === 'Husband' || sess.tempMember?.relationshipTam === 'கணவர்';
            const isFemaleHead = sess.citizenProfile?.headGender === 'Female';
            const hasExistingAddress = !!(sess.citizenProfile?.doorNo && sess.citizenProfile?.pincode);

            if (isHusband && isFemaleHead && !hasExistingAddress) {
                sess.intakeState = 'ADDRESS_CHOICE';

                const memAddr = sess.tempMember?.address || {};
                let headAddrStr = `${sess.citizenProfile.doorNo ? sess.citizenProfile.doorNo + ', ' : ''}${sess.citizenProfile.streetTam || ''}, ${sess.citizenProfile.pincode || ''}`;
                let memAddrStr = `${memAddr.doorNo ? memAddr.doorNo + ', ' : ''}${memAddr.streetTam || ''}, ${memAddr.pincode || ''}`;

                sess.chatHistory.push({
                    sender: 'bot',
                    text: `🏠 **ரேஷன் கார்டு குடும்ப முகவரி தேர்வு (Family Address Gate):**\n\n` +
                          `திருமணத்திற்குப் பின் புதிய ரேஷன் கார்டு விண்ணப்பிக்கும்போது, குடும்பத் தலைவி (${sess.citizenProfile.fullNameTam}) அவர்களின் பிறந்த வீட்டு ஆதார் முகவரிக்குப் பதிலாகக் கணவர் (${sess.tempMember?.nameTam || 'கணவர்'}) அவர்களின் ஆதார் முகவரி அல்லது புதிய குடியிருப்பு முகவரியைப் பயன்படுத்துவது வழக்கமாகும்.\n\n` +
                          `• 👩 **குடும்பத் தலைவி பிறந்த வீட்டு முகவரி:** ${headAddrStr || '—'}\n` +
                          `• 👨 **கணவர் (${sess.tempMember?.nameTam || 'கணவர்'}) ஆதார் முகவரி:** ${memAddrStr || '(இன்னும் உள்ளிடப்படவில்லை)'}\n\n` +
                          `புதிய ரேஷன் கார்டிற்கு எந்த முகவரியைக் குடும்ப முகவரியாகப் பயன்படுத்த விரும்புகிறீர்கள்?`,
                    options: [
                        { label: `👨 கணவர் (${sess.tempMember?.nameTam || 'கணவர்'}) ஆதார் முகவரியைப் பயன்படுத்து`, value: "USE_MEMBER_ADDRESS" },
                        { label: `👩 குடும்பத் தலைவி (${sess.citizenProfile.fullNameTam}) பிறந்த வீட்டு முகவரி`, value: "USE_HEAD_ADDRESS" },
                        { label: "✏️ புதிய முகவரியைத் தட்டச்சு செய்ய / திருத்த (District, Taluk, Village)", value: "TRIGGER_EDIT_MODAL" }
                    ]
                });
                res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState });
                return true;
            }

            sess.currentMemberIdx++;
            if (sess.currentMemberIdx < sess.targetMemberCount) {
                sess.intakeState = 'MEMBER_AADHAAR_FRONT';
                sess.tempUploads = sess.tempUploads || {};
                sess.tempUploads.currentMemberFront = null;
                sess.tempUploads.currentMemberBack = null;
                sess.tempMember = null;
                sess.chatHistory.push({
                    sender: 'bot',
                    text: `✅ **உறுப்பினர் ${sess.currentMemberIdx} (${confirmedRelTam}) வெற்றிகரமாகச் சேர்க்கப்பட்டார்!**\n\n` +
                          `👥 **படி 3/6: குடும்ப உறுப்பினர் ${sess.currentMemberIdx + 1}-ன் ஆதார் அட்டை**\n\n` +
                          `உறுப்பினர் ${sess.currentMemberIdx + 1}-ன் ஆதார் அட்டையின் **முன்பக்கத்தைப் (Front Side)** பதிவேற்றவும்:`,
                    actionRequired: 'upload',
                    uploadPrompt: `உறுப்பினர் ${sess.currentMemberIdx + 1} ஆதார் முன்பக்கம்`
                });
                persistSessions(activeMobile);
                if (activeMobile) {
                    saveCitizenDraft(activeMobile, {
                        citizenProfile: sess.citizenProfile,
                        chatHistory: sess.chatHistory,
                        intakeState: sess.intakeState,
                        targetMemberCount: sess.targetMemberCount,
                        currentMemberIdx: sess.currentMemberIdx,
                        tempMember: sess.tempMember,
                        tempUploads: sess.tempUploads,
                        step: sess.step || 'draft'
                    }).catch(() => {});
                }
            } else {
                const isComplete = isProfileDataComplete(sess.citizenProfile, sess.tempUploads);
                if (isComplete) {
                    sess.intakeState = 'READY_TO_APPLY';
                    sess.step = 'READY';
                    let membersSummary = '';
                    sess.citizenProfile.members.forEach((m, idx) => {
                        membersSummary += `  ${idx + 1}. **${m.nameTam || m.nameEng}** (${m.relationshipTam || (idx === 0 ? 'தலைவர்' : 'உறுப்பினர்')}) | ஆதார்: ${(m.aadhaarNumber || '').replace(/(\d{4})/g, '$1 ').trim()} ✅\n`;
                    });
                    sess.chatHistory.push({
                        sender: 'bot',
                        text: `🎉 **அனைத்து ${sess.citizenProfile.members.length} உறுப்பினர்களின் விவரங்களும் ஆவணங்களும் வெற்றிகரமாகப் புதுப்பிக்கப்பட்டன!** 🛡️\n\n` +
                              `• 👤 **குடும்பத் தலைவர்:** ${sess.citizenProfile.fullNameTam || sess.citizenProfile.fullNameEng}\n` +
                              `• 👥 **மொத்த உறுப்பினர்கள் (${sess.citizenProfile.members.length}):**\n${membersSummary}` +
                              `\nஇப்போது அரசு TNPDS போர்ட்டலில் உங்கள் ரேஷன் கார்டு விண்ணப்பத்தைத் தொடங்கலாம்:`,
                        options: [
                            { label: "🚀 TNPDS போர்ட்டலில் விண்ணப்பி (Submit to Portal)", value: "CONFIRM_SUBMIT" },
                            { label: "✏️ விவரங்களைச் சரிபார் / திருத்து (Review Details)", value: "TRIGGER_EDIT_MODAL" }
                        ]
                    });
                    persistSessions();
                    if (activeMobile) {
                        saveCitizenDraft(activeMobile, {
                            operatorUid: sess.operatorUid,
                            citizenProfile: sess.citizenProfile,
                            intakeState: sess.intakeState,
                            step: sess.step,
                            chatHistory: sess.chatHistory
                        }).catch(() => {});
                    }
                    res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState });
                    return true;
                } else {
                    sess.intakeState = 'MOBILE_NUMBER';
                    const hasValidCurrentMob = activeMobile && /^[6-9]\d{9}$/.test(activeMobile);
                    sess.chatHistory.push({
                        sender: 'bot',
                        text: `🎉 **அனைத்து ${sess.targetMemberCount} உறுப்பினர்களின் ஆதார் ஆவணங்களும் வெற்றிகரமாகச் சேர்க்கப்பட்டன!**\n\n` +
                              `📱 **படி 4/6: ரேஷன் கார்டு பதிவு கைபேசி எண்**\n\n` +
                              `ரேஷன் கடை பொருட்கள் தகவல், மாதாந்திர OTP மற்றும் அரசு அறிவிப்புகள் வர வேண்டிய **குடும்பத் தலைவரின் 10-இலக்க மொபைல் எண்ணை** உள்ளிடவும்:\n\n` +
                              (hasValidCurrentMob ? `*(உள்நுழைந்த எண்: +91 ${activeMobile})*` : `*(10 இலக்க மொபைல் எண்ணைத் தட்டச்சு செய்யவும்)*`),
                        options: hasValidCurrentMob ? [{ label: `+91 ${activeMobile} (இந்த எண்ணையே பயன்படுத்து)`, value: activeMobile }] : []
                    });
                }
            }
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState });
            return true;
        }

        sess.chatHistory.push({
            sender: 'bot',
            text: `உறுப்பினர் விவரங்களைச் சரிபார்த்து **'உறுப்பினர் விவரங்கள் சரி'** அல்லது **'விவரங்களைச் சரிபார் / திருத்து'** என்பதைத் தேர்ந்தெடுக்கவும்:`,
            options: [
                { label: "✅ உறுப்பினர் விவரங்கள் சரி (Details Correct - Continue)", value: "MEMBER_DETAILS_CONFIRMED" },
                { label: "✏️ விவரங்களைச் சரிபார் / திருத்து (Review / Edit Details)", value: "TRIGGER_EDIT_MODAL" }
            ]
        });
        persistSessions(activeMobile);
        if (activeMobile) {
            saveCitizenDraft(activeMobile, {
                citizenProfile: sess.citizenProfile,
                chatHistory: sess.chatHistory,
                intakeState: sess.intakeState,
                targetMemberCount: sess.targetMemberCount,
                currentMemberIdx: sess.currentMemberIdx,
                tempMember: sess.tempMember,
                tempUploads: sess.tempUploads,
                step: sess.step || 'draft'
            }).catch(() => {});
        }
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState });
        return true;
    }

    return false;
}

module.exports = {
    handleMemberVerification
};
