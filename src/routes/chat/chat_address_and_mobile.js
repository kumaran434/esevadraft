const storageService = require('../../services/storage_service');
const { RESIDENCE_PROOF_OPTIONS } = require('../../core/chat_fsm');
const { saveCitizenProfile } = require('../../../database');
const { saveCitizenDraft } = require('../../../firestore_db');
const { resolveTnDistrict } = require('../../../tn_district_mapper');

const { sessions, persistSessions } = storageService;

async function handleAddressAndMobile(ctx, req, res) {
    const { text, sess } = ctx;
    let activeMobile = storageService.getActiveMobile();
    const reqOpUid = req.headers['x-operator-uid'] || null;

    // STATE 8.6: ADDRESS_CHOICE
    if (sess.intakeState === 'ADDRESS_CHOICE') {
        if (text === 'USE_MEMBER_ADDRESS' || text.includes('கணவர்') || text.includes('உறுப்பினர்')) {
            const lastMem = sess.citizenProfile.members.find(m => m.relationship === 'Husband' || m.relationshipTam === 'கணவர்') || sess.citizenProfile.members[sess.citizenProfile.members.length - 1];
            if (lastMem && lastMem.address && (lastMem.address.doorNo || lastMem.address.streetTam || lastMem.address.pincode)) {
                if (lastMem.address.doorNo) sess.citizenProfile.doorNo = lastMem.address.doorNo;
                if (lastMem.address.streetTam) sess.citizenProfile.streetTam = lastMem.address.streetTam;
                if (lastMem.address.streetEng) sess.citizenProfile.streetEng = lastMem.address.streetEng || lastMem.address.streetTam;
                if (lastMem.address.areaEng) sess.citizenProfile.areaEng = lastMem.address.areaEng;
                if (lastMem.address.areaTam) sess.citizenProfile.areaTam = lastMem.address.areaTam;
                if (lastMem.address.pincode) sess.citizenProfile.pincode = lastMem.address.pincode;

                const memAddrText = [lastMem.address.streetEng, lastMem.address.streetTam, lastMem.address.areaEng, lastMem.address.areaTam].filter(Boolean).join(' ');
                const resolved = resolveTnDistrict(lastMem.address.district, lastMem.address.taluk, lastMem.address.village, lastMem.address.pincode, memAddrText);
                sess.citizenProfile.district = resolved.district;
                sess.citizenProfile.districtTam = resolved.districtTam;
                sess.citizenProfile.taluk = resolved.taluk || lastMem.address.taluk;
                sess.citizenProfile.talukTam = resolved.talukTam || sess.citizenProfile.talukTam;
                sess.citizenProfile.village = resolved.village || lastMem.address.village;
                if (resolved.villageTam) sess.citizenProfile.villageTam = resolved.villageTam;
                if (resolved.wasAutoCorrected) {
                    sess.citizenProfile.districtAutoCorrected = true;
                    sess.citizenProfile.districtCorrectionReason = resolved.reason;
                }
                if (resolved.areaEng && (!sess.citizenProfile.areaEng || sess.citizenProfile.areaEng.toUpperCase() === 'ARAKONAM')) {
                    sess.citizenProfile.areaEng = resolved.areaEng;
                }
                if (resolved.areaTam && !sess.citizenProfile.areaTam) {
                    sess.citizenProfile.areaTam = resolved.areaTam;
                }
                if (activeMobile) saveCitizenProfile(activeMobile, sess.citizenProfile);

                const autoNote = resolved.wasAutoCorrected ? `\n\n💡 **மாவட்ட தானியங்கி சரிபார்ப்பு:** ${resolved.reason}` : '';
                sess.chatHistory.push({
                    sender: 'bot',
                    text: `✅ **ரேஷன் கார்டு குடும்ப முகவரியாகக் கணவர் (${lastMem.nameTam}) அவர்களின் ஆதார் முகவரி வெற்றிகரமாகப் பயன்படுத்தப்பட்டது!** 🏠\n\n` +
                          `• 🏠 **முகவரி:** ${sess.citizenProfile.doorNo ? sess.citizenProfile.doorNo + ', ' : ''}${sess.citizenProfile.streetTam}, ${sess.citizenProfile.pincode}\n` +
                          `• 🏛️ **மாவட்டம்/வட்டம்/கிராமம்:** ${sess.citizenProfile.district || '—'}, ${sess.citizenProfile.taluk || '—'}, ${sess.citizenProfile.village || '—'}` + autoNote + `\n\n` +
                          `💡 *விவரங்கள் ஏதேனும் மாற்றப்பட வேண்டுமெனில் 'விவரங்களைத் திருத்து' பொத்தானைப் பயன்படுத்தவும்.*`,
                    options: [
                        { label: "✏️ முகவரியைத் திருத்து (Edit Address / District)", value: "TRIGGER_EDIT_MODAL" }
                    ]
                });
            } else {
                sess.chatHistory.push({
                    sender: 'bot',
                    text: `✏️ கணவர் ஆதார் முகவரியை அல்லது புதிய முகவரியைத் தட்டச்சு செய்யப் படிவப் பெட்டி திறக்கப்படுகிறது...`,
                    actionRequired: 'open_edit_modal'
                });
            }
        } else if (text === 'USE_HEAD_ADDRESS' || text.includes('தலைவி')) {
            sess.chatHistory.push({
                sender: 'bot',
                text: `✅ **குடும்பத் தலைவி (${sess.citizenProfile.fullNameTam}) அவர்களின் ஆதார் முகவரியே தொடரப்படுகிறது.** 🏠`
            });
        } else if (text === 'TRIGGER_EDIT_MODAL' || text.includes('திருத்து') || text.toLowerCase().includes('edit')) {
            sess.chatHistory.push({
                sender: 'bot',
                text: `✏️ திருத்தம் செய்த பின் தொடரலாம்.`,
                actionRequired: 'open_edit_modal'
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
            sess.chatHistory.push({
                sender: 'bot',
                text: `👥 **படி 3/6: குடும்ப உறுப்பினர் ${sess.currentMemberIdx + 1}-ன் ஆதார் அட்டை**\n\n` +
                      `உறுப்பினர் ${sess.currentMemberIdx + 1}-ன் ஆதார் அட்டையின் **முன்பக்கத்தைப் (Front Side)** பதிவேற்றவும்:`,
                actionRequired: 'upload',
                uploadPrompt: `உறுப்பினர் ${sess.currentMemberIdx + 1} ஆதார் முன்பக்கம்`
            });
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
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState });
        return true;
    }

    // STATE 9: MOBILE_NUMBER
    if (sess.intakeState === 'MOBILE_NUMBER') {
        let cleanDigits = text.replace(/\D/g, '');
        if (cleanDigits.length === 12 && cleanDigits.startsWith('91')) {
            cleanDigits = cleanDigits.slice(2);
        }
        if (cleanDigits.length === 10 && /^[6-9]\d{9}$/.test(cleanDigits)) {
            const oldKey = activeMobile;
            activeMobile = cleanDigits;
            storageService.setActiveMobile(cleanDigits);
            sess.citizenProfile.mobileNumber = cleanDigits;
            sessions.set(cleanDigits, sess);
            if (oldKey && oldKey !== cleanDigits && sessions.has(oldKey)) {
                sessions.delete(oldKey);
            }
            saveCitizenProfile(activeMobile, sess.citizenProfile);

            try {
                await saveCitizenDraft(cleanDigits, {
                    operatorUid: reqOpUid || sess.operatorUid || null,
                    operatorName: sess.operatorName || null,
                    operatorMobile: sess.operatorMobile || null,
                    citizenProfile: sess.citizenProfile,
                    documents: {},
                    chatHistory: sess.chatHistory,
                    intakeState: 'RESIDENCE_PROOF_TYPE',
                    status: 'DRAFT_SAVED'
                });
            } catch (e) {
                console.error('Draft save failed:', e);
            }
            persistSessions();

            sess.intakeState = 'RESIDENCE_PROOF_TYPE';
            sess.chatHistory.push({
                sender: 'bot',
                text: `✅ **ரேஷன் கார்டு மொபைல் எண் உறுதி செய்யப்பட்டது:** +91 ${cleanDigits}\n\n` +
                      `🏠 **படி 5/6: குடும்பத்தின் குடியிருப்புச் சான்று (Residence Proof)**\n\n` +
                      `உங்கள் குடும்பத்தின் முகவரிச் சான்றாக கீழே உள்ளவற்றில் எந்த ஆவணத்தைப் பதிவேற்ற விரும்புகிறீர்கள்?`,
                options: RESIDENCE_PROOF_OPTIONS
            });
        } else {
            const hasValidCurrentMob = activeMobile && /^[6-9]\d{9}$/.test(activeMobile);
            sess.chatHistory.push({
                sender: 'bot',
                text: `⚠️ சரியான 10-இலக்க மொபைல் எண்ணை உள்ளிடவும் (எ.கா: 9876543210):`,
                options: hasValidCurrentMob ? [{ label: `+91 ${activeMobile} (இந்த எண்ணையே பயன்படுத்து)`, value: activeMobile }] : []
            });
        }
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, activeMobile: activeMobile });
        return true;
    }

    return false;
}

module.exports = {
    handleAddressAndMobile
};
