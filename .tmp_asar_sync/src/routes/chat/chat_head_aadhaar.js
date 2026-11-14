const fs = require('fs');
const path = require('path');
const storageService = require('../../services/storage_service');
const { updateHeadMember, isProfileDataComplete } = require('../../services/profile_helpers');
const { saveCitizenProfile } = require('../../../database');
const { saveCitizenDraft } = require('../../../firestore_db');
const { inspectAndExtractDocument } = require('../../../ai_document_extractor');
const { produceCompliantDocument, produceDualSidedDocument } = require('../../../photo_studio');

const { persistSessions } = storageService;

async function handleHeadAadhaar(ctx, req, res) {
    const { text, uploadedFile, sess } = ctx;
    const activeMobile = ctx.targetMobile || sess.mobileNumber || sess.citizenProfile?.mobileNumber || storageService.getActiveMobile();

    // STATE 4: HEAD_AADHAAR_FRONT
    if (sess.intakeState === 'HEAD_AADHAAR_FRONT') {
        if (!uploadedFile) {
            sess.chatHistory.push({
                sender: 'bot',
                text: `🪪 தயவுசெய்து குடும்பத் தலைவரின் **ஆதார் அட்டைப் புகைப்படத்தை (முன்பக்கம் அல்லது முழு ஆதார் அட்டை)** பதிவேற்றவும்.`,
                actionRequired: 'upload',
                uploadPrompt: 'ஆதார் அட்டை பதிவேற்றவும்'
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState });
            return true;
        }

        const extracted = await inspectAndExtractDocument(uploadedFile.path);

        if (extracted && extracted.isQualityAcceptable === false) {
            sess.chatHistory.push({
                sender: 'bot',
                text: `⚠️ **ஆதார் அட்டை தெளிவாக இல்லை (Document Not Clear):**\n\n` +
                      `${extracted.feedbackTamil || 'ஆவணத்தில் உள்ள எழுத்துக்கள் அல்லது விவரங்கள் மங்கலாக உள்ளன.'}\n\n` +
                      `🛑 அரசு TNPDS இணையதளத்தில் நிராகரிக்கப்படாமல் இருக்க, எழுத்துக்களும் எண்களும் தெளிவாகத் தெரியும்படி **தெளிவான ஆதார் ஆவணத்தை** மீண்டும் பதிவேற்றவும்:`,
                actionRequired: 'upload',
                uploadPrompt: 'தெளிவான ஆதார் பதிவேற்றவும்'
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState });
            return true;
        }

        const hasAddress = !!(extracted.hasAddress || extracted.doorNo || extracted.streetTam || extracted.streetEng || extracted.pincode);
        const isFullAadhaar = !!(extracted.isFullAadhaar || extracted.documentType === 'AADHAAR_FULL' || (hasAddress && (extracted.fullNameEng || extracted.fullNameTam || extracted.aadhaarNumber)));

        if (isFullAadhaar) {
            const fullPdf = await produceCompliantDocument(uploadedFile.path);
            sess.tempUploads.headAadhaar = fullPdf;
            sess.tempUploads.headAadhaarFront = uploadedFile.path;
        sess.tempUploads.headAadhaarFrontBoundingBox = extracted.documentBoundingBox || null;
        if (extracted.extractedFacePhotoPath && !sess.citizenProfile.headPhotoPath) {
            sess.citizenProfile.headPhotoPath = extracted.extractedFacePhotoPath;
            sess.tempUploads.profilePhoto = extracted.extractedFacePhotoPath;
            sess.citizenProfile.documents = sess.citizenProfile.documents || {};
            sess.citizenProfile.documents.profilePhoto = extracted.extractedFacePhotoPath;
        }
            sess.tempUploads.headAadhaarBack = null;
            sess.citizenProfile.headAadhaarDocPath = fullPdf;
            sess.citizenProfile.documents = sess.citizenProfile.documents || {};
            sess.citizenProfile.documents.headAadhaar = fullPdf;

            sess.citizenProfile.fullNameEng = extracted.fullNameEng || sess.citizenProfile.fullNameEng || '';
            sess.citizenProfile.fullNameTam = extracted.fullNameTam || sess.citizenProfile.fullNameTam || '';
            sess.citizenProfile.fatherNameEng = extracted.fatherNameEng || sess.citizenProfile.fatherNameEng || '';
            sess.citizenProfile.fatherNameTam = extracted.fatherNameTam || sess.citizenProfile.fatherNameTam || '';
            sess.citizenProfile.headDob = extracted.dob || sess.citizenProfile.headDob || '';
            sess.citizenProfile.headGender = extracted.gender || 'Male';
            sess.citizenProfile.headGenderTam = extracted.gender === 'Female' ? 'பெண்' : 'ஆண்';
            sess.citizenProfile.headAadhaar = (extracted.aadhaarNumber && extracted.aadhaarNumber.length === 12) ? extracted.aadhaarNumber : (sess.citizenProfile.headAadhaar || '');
            sess.citizenProfile.doorNo = extracted.doorNo || sess.citizenProfile.doorNo || '';
            sess.citizenProfile.streetEng = extracted.streetEng || sess.citizenProfile.streetEng || '';
            sess.citizenProfile.streetTam = extracted.streetTam || sess.citizenProfile.streetTam || '';
            sess.citizenProfile.areaEng = extracted.areaEng || sess.citizenProfile.areaEng || '';
            sess.citizenProfile.areaTam = extracted.areaTam || sess.citizenProfile.areaTam || '';
            sess.citizenProfile.pincode = extracted.pincode || sess.citizenProfile.pincode || '';
            sess.citizenProfile.district = extracted.district || sess.citizenProfile.district || 'Ranipet';
            sess.citizenProfile.taluk = extracted.taluk || sess.citizenProfile.taluk || 'Arakkonam';
            sess.citizenProfile.village = extracted.village || sess.citizenProfile.village || 'Minnal';

            updateHeadMember(sess.citizenProfile, fullPdf);
            if (activeMobile) saveCitizenProfile(activeMobile, sess.citizenProfile);

            const formattedAadhaar = (sess.citizenProfile.headAadhaar || '').replace(/(\d{4})/g, '$1 ').trim();
            sess.intakeState = 'HEAD_DETAILS_VERIFY';
            sess.chatHistory.push({
                sender: 'bot',
                text: `📄 **முழு ஆதார் அட்டை (முன்பக்கம் மற்றும் முகவரி இரண்டும் உள்ள ஆவணம்) வெற்றிகரமாகக் கண்டறியப்பட்டது!**\n\n` +
                      `💡 *ஒரே ஆவணத்தில் அனைத்து விவரங்களும் உள்ளதால், பின்பக்கத்தை மீண்டும் பதிவேற்றத் தேவையில்லை.* ✅\n\n` +
                      `💡 **ஆதார் பெயர் சரிபார்ப்பு:** வாடிக்கையாளர் பெயர் ஆதார் அட்டையின்படி **${sess.citizenProfile.fullNameTam || ''} (${sess.citizenProfile.fullNameEng || ''})** எனத் தானாகவே துல்லியமாகப் புதுப்பிக்கப்பட்டது! ✅\n\n` +
                      `🔍 **படி 2/6: ஆவணத்திலிருந்து பெறப்பட்ட விவரங்கள் (Verification & Spelling Check):**\n\n` +
                      `• 👤 **பெயர் (தமிழ்):** ${sess.citizenProfile.fullNameTam || '—'}\n` +
                      `• 🔤 **Name (English):** ${sess.citizenProfile.fullNameEng || '—'}\n` +
                      `• 👨‍👧 **தந்தை/கணவர் பெயர்:** ${sess.citizenProfile.fatherNameTam || '—'} (${sess.citizenProfile.fatherNameEng || '—'})\n` +
                      `• 🎂 **பிறந்த தேதி (DOB):** ${sess.citizenProfile.headDob || '—'}\n` +
                      `• ⚧️ **பாலினம் (Gender):** ${sess.citizenProfile.headGenderTam || '—'} (${sess.citizenProfile.headGender || '—'})\n` +
                      `• 🪪 **ஆதார் எண்:** ${formattedAadhaar || '—'}\n` +
                      `• 🏠 **முகவரி:** ${sess.citizenProfile.doorNo ? sess.citizenProfile.doorNo + ', ' : ''}${sess.citizenProfile.streetTam || sess.citizenProfile.streetEng || '—'}, ${sess.citizenProfile.pincode || '—'}\n` +
                      `• 🏛️ **மாவட்டம் / வட்டம் / கிராமம்:** ${sess.citizenProfile.district}, ${sess.citizenProfile.taluk}, ${sess.citizenProfile.village}\n\n` +
                      `விவரங்கள் சரியாக இருந்தால் **'விவரங்கள் அனைத்தும் சரி'** என்பதைத் தொடரவும்:`,
                options: [
                    { label: "✅ விவரங்கள் அனைத்தும் சரி (All Correct - Continue)", value: "HEAD_DETAILS_CONFIRMED" },
                    { label: "✏️ விவரங்களைச் சரிபார் / திருத்து (Review / Edit Details)", value: "TRIGGER_EDIT_MODAL" }
                ]
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState });
            return true;
        }

        sess.tempUploads.headAadhaarFront = uploadedFile.path;
        sess.tempUploads.headAadhaarFrontBoundingBox = extracted.documentBoundingBox || null;
        if (extracted.extractedFacePhotoPath && !sess.citizenProfile.headPhotoPath) {
            sess.citizenProfile.headPhotoPath = extracted.extractedFacePhotoPath;
            sess.tempUploads.profilePhoto = extracted.extractedFacePhotoPath;
            sess.citizenProfile.documents = sess.citizenProfile.documents || {};
            sess.citizenProfile.documents.profilePhoto = extracted.extractedFacePhotoPath;
        }
        if (extracted.fullNameEng) sess.citizenProfile.fullNameEng = extracted.fullNameEng;
        if (extracted.fullNameTam) sess.citizenProfile.fullNameTam = extracted.fullNameTam;
        if (extracted.aadhaarNumber) sess.citizenProfile.headAadhaar = extracted.aadhaarNumber;
        if (extracted.dob) sess.citizenProfile.headDob = extracted.dob;
        if (extracted.gender) {
            sess.citizenProfile.headGender = extracted.gender;
            sess.citizenProfile.headGenderTam = extracted.gender === 'Female' ? 'பெண்' : 'ஆண்';
        }
        if (sess.citizenProfile.members && sess.citizenProfile.members.length > 0) {
            sess.citizenProfile.members[0].nameEng = sess.citizenProfile.fullNameEng;
            sess.citizenProfile.members[0].nameTam = sess.citizenProfile.fullNameTam;
            sess.citizenProfile.members[0].aadhaarNumber = sess.citizenProfile.headAadhaar;
            sess.citizenProfile.members[0].dob = sess.citizenProfile.headDob;
            sess.citizenProfile.members[0].gender = sess.citizenProfile.headGender;
            sess.citizenProfile.members[0].genderTam = sess.citizenProfile.headGenderTam;
        }
        if (activeMobile) saveCitizenProfile(activeMobile, sess.citizenProfile);
        persistSessions();

        sess.intakeState = 'HEAD_AADHAAR_BACK';
        const detectedFrontName = sess.citizenProfile.fullNameTam ? `${sess.citizenProfile.fullNameTam} (${sess.citizenProfile.fullNameEng})` : (sess.citizenProfile.fullNameEng || '');
        sess.chatHistory.push({
            sender: 'bot',
            text: `✅ **குடும்பத் தலைவர் ஆதார் முன்பக்கம் பெறப்பட்டது!**\n\n` +
                  (detectedFrontName ? `💡 **ஆதார் பெயர் சரிபார்ப்பு:** வாடிக்கையாளர் பெயர் ஆதார் அட்டையின்படி **${detectedFrontName}** எனத் தானாகவே புதுப்பிக்கப்பட்டது! ✅\n\n` : '') +
                  `🔄 **இது முன்பக்கம் மட்டுமே என்பதால், முகவரி மற்றும் தந்தை/கணவர் பெயர் உள்ள பின்பக்கத்தைப் (Back Side) பதிவேற்றவும்:**`,
            actionRequired: 'upload',
            uploadPrompt: 'ஆதார் பின்பக்கம் பதிவேற்றவும்'
        });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState });
        return true;
    }

    // STATE 5: HEAD_AADHAAR_BACK
    if (sess.intakeState === 'HEAD_AADHAAR_BACK') {
        if (!uploadedFile) {
            sess.chatHistory.push({
                sender: 'bot',
                text: `🔄 தயவுசெய்து குடும்பத் தலைவரின் ஆதார் அட்டையின் **பின்பக்கப் புகைப்படத்தைப்** பதிவேற்றவும்.`,
                actionRequired: 'upload',
                uploadPrompt: 'ஆதார் பின்பக்கம் பதிவேற்றவும்'
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState });
            return true;
        }

        sess.tempUploads.headAadhaarBack = uploadedFile.path;
        let extractedBack = null;
        try {
            extractedBack = await inspectAndExtractDocument(uploadedFile.path, { skipFaceExtraction: true });
        } catch (_) {}

        sess.tempUploads.headAadhaarBackBoundingBox = extractedBack?.documentBoundingBox || null;

        const mergedPdf = await produceDualSidedDocument(
            sess.tempUploads.headAadhaarFront,
            sess.tempUploads.headAadhaarBack,
            null,
            {
                frontBoundingBox: sess.tempUploads.headAadhaarFrontBoundingBox,
                backBoundingBox: sess.tempUploads.headAadhaarBackBoundingBox
            }
        );

        const extracted = extractedBack || await inspectAndExtractDocument(mergedPdf);
        sess.citizenProfile.fullNameEng = extracted.fullNameEng || sess.citizenProfile.fullNameEng || '';
        sess.citizenProfile.fullNameTam = extracted.fullNameTam || sess.citizenProfile.fullNameTam || '';
        sess.citizenProfile.fatherNameEng = extracted.fatherNameEng || sess.citizenProfile.fatherNameEng || '';
        sess.citizenProfile.fatherNameTam = extracted.fatherNameTam || sess.citizenProfile.fatherNameTam || '';
        sess.citizenProfile.headDob = extracted.dob || sess.citizenProfile.headDob || '';
        sess.citizenProfile.headGender = extracted.gender || 'Male';
        sess.citizenProfile.headGenderTam = extracted.gender === 'Female' ? 'பெண்' : 'ஆண்';
        sess.citizenProfile.headAadhaar = (extracted.aadhaarNumber && extracted.aadhaarNumber.length === 12) ? extracted.aadhaarNumber : (sess.citizenProfile.headAadhaar || '');
        sess.citizenProfile.doorNo = extracted.doorNo || sess.citizenProfile.doorNo || '';
        sess.citizenProfile.streetEng = extracted.streetEng || sess.citizenProfile.streetEng || '';
        sess.citizenProfile.streetTam = extracted.streetTam || sess.citizenProfile.streetTam || '';
        sess.citizenProfile.areaEng = extracted.areaEng || sess.citizenProfile.areaEng || '';
        sess.citizenProfile.areaTam = extracted.areaTam || sess.citizenProfile.areaTam || '';
        sess.citizenProfile.pincode = extracted.pincode || sess.citizenProfile.pincode || '';
        sess.citizenProfile.district = extracted.district || 'Ranipet';
        sess.citizenProfile.taluk = extracted.taluk || 'Arakkonam';
        sess.citizenProfile.village = extracted.village || 'Minnal';

        sess.tempUploads.headAadhaar = mergedPdf;
        sess.citizenProfile.headAadhaarDocPath = mergedPdf;
        sess.citizenProfile.documents = sess.citizenProfile.documents || {};
        sess.citizenProfile.documents.headAadhaar = mergedPdf;

        updateHeadMember(sess.citizenProfile, mergedPdf);
        if (activeMobile) saveCitizenProfile(activeMobile, sess.citizenProfile);

        const formattedAadhaar = (sess.citizenProfile.headAadhaar || '').replace(/(\d{4})/g, '$1 ').trim();
        sess.intakeState = 'HEAD_DETAILS_VERIFY';
        sess.chatHistory.push({
            sender: 'bot',
            text: `📄 **குடும்பத் தலைவர் ஆதார் அட்டை வெற்றிகரமாக 2-in-1 அரசு A4 PDF-ஆக இணைக்கப்பட்டது!**\n\n` +
                  `💡 **ஆதார் பெயர் சரிபார்ப்பு:** வாடிக்கையாளர் பெயர் ஆதார் அட்டையின்படி **${sess.citizenProfile.fullNameTam || ''} (${sess.citizenProfile.fullNameEng || ''})** எனத் தானாகவே துல்லியமாகப் புதுப்பிக்கப்பட்டது! ✅\n\n` +
                  `🔍 **படி 2/6: ஆவணத்திலிருந்து பெறப்பட்ட விவரங்கள் (Verification & Spelling Check):**\n\n` +
                  `• 👤 **பெயர் (தமிழ்):** ${sess.citizenProfile.fullNameTam || '—'}\n` +
                  `• 🔤 **Name (English):** ${sess.citizenProfile.fullNameEng || '—'}\n` +
                  `• 👨‍👧 **தந்தை/கணவர் பெயர்:** ${sess.citizenProfile.fatherNameTam || '—'} (${sess.citizenProfile.fatherNameEng || '—'})\n` +
                  `• 🎂 **பிறந்த தேதி (DOB):** ${sess.citizenProfile.headDob || '—'}\n` +
                  `• ⚧️ **பாலினம் (Gender):** ${sess.citizenProfile.headGenderTam || '—'} (${sess.citizenProfile.headGender || '—'})\n` +
                  `• 🪪 **ஆதார் எண்:** ${formattedAadhaar || '—'}\n` +
                  `• 🏠 **முகவரி:** ${sess.citizenProfile.doorNo ? sess.citizenProfile.doorNo + ', ' : ''}${sess.citizenProfile.streetTam || sess.citizenProfile.streetEng || '—'}, ${sess.citizenProfile.pincode || '—'}\n\n` +
                  `விவரங்கள் சரியாக இருந்தால் **'விவரங்கள் அனைத்தும் சரி'** என்பதைத் தொடரவும்:`,
            options: [
                { label: "✅ விவரங்கள் அனைத்தும் சரி (All Correct - Continue)", value: "HEAD_DETAILS_CONFIRMED" },
                { label: "✏️ விவரங்களைச் சரிபார் / திருத்து (Review / Edit Details)", value: "TRIGGER_EDIT_MODAL" }
            ]
        });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState });
        return true;
    }

    // STATE 5.5: HEAD_DETAILS_VERIFY
    if (sess.intakeState === 'HEAD_DETAILS_VERIFY') {
        if (text === 'TRIGGER_EDIT_MODAL' || text.includes('திருத்து') || text.toLowerCase().includes('edit')) {
            sess.chatHistory.push({
                sender: 'bot',
                text: `✏️ **விவரங்களைத் திருத்தும் சாளரம் (Edit Window) திறக்கப்பட்டுள்ளது!**\n\nதிரையில் தோன்றும் படிவத்தில் சரியான எழுத்துக் கூட்டலை உள்ளிட்டு **'சேமி & உறுதிப்படுத்து'** பட்டனை அழுத்தவும்.`,
                actionRequired: 'open_edit_modal',
                options: [
                    { label: "✅ திருத்தம் முடிந்தது / விவரங்கள் சரி (Proceed)", value: "HEAD_DETAILS_CONFIRMED" },
                    { label: "✏️ மீண்டும் படிவத்தைத் திற (Open Edit Window)", value: "TRIGGER_EDIT_MODAL" }
                ]
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState });
            return true;
        }

        if (text === 'HEAD_DETAILS_CONFIRMED' || text.includes('சரி') || text.includes('Correct') || text.toLowerCase().includes('ok') || text.toLowerCase().includes('continue')) {
            const existingMembers = Array.isArray(sess.citizenProfile?.members) ? sess.citizenProfile.members : [];
            const existingCount = existingMembers.length;
            const isProfileComplete = isProfileDataComplete(sess.citizenProfile, sess.tempUploads);

            if (isProfileComplete && (!sess.targetMemberCount || existingCount >= sess.targetMemberCount)) {
                sess.intakeState = 'READY_TO_APPLY';
                sess.step = 'READY';
                sess.targetMemberCount = existingCount;
                sess.chatHistory.push({
                    sender: 'bot',
                    text: `✅ **குடும்பத் தலைவர் மற்றும் ${existingCount} உறுப்பினர்களின் விவரங்கள் ஏற்கெனவே தயார் நிலையில் உள்ளன!** 🛡️\n\n` +
                          `• 👤 **குடும்பத் தலைவர்:** ${sess.citizenProfile.fullNameTam || sess.citizenProfile.fullNameEng}\n` +
                          `• 👥 **மொத்த உறுப்பினர்கள் (${existingCount}):** ${existingMembers.map(m => m.nameTam || m.nameEng).filter(Boolean).join(', ')}\n\n` +
                          `அரசு TNPDS இணையதளத்தில் உங்கள் புதிய ரேஷன் கார்டை விண்ணப்பிக்கத் தொடங்குங்கள்:`,
                    options: [
                        { label: "🚀 TNPDS போர்ட்டலில் விண்ணப்பி (Submit to Portal)", value: "CONFIRM_SUBMIT" },
                        { label: "✏️ விவரங்களைச் சரிபார் / திருத்து (Review Details)", value: "TRIGGER_EDIT_MODAL" }
                    ]
                });
                persistSessions();
                res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState });
                return true;
            }

            if (sess.targetMemberCount > 1 && existingCount < sess.targetMemberCount) {
                const nextMemberIdx = existingCount >= 1 ? existingCount : 1;
                sess.currentMemberIdx = nextMemberIdx;
                sess.tempUploads.currentMemberFront = null;
                sess.tempUploads.currentMemberBack = null;
                sess.intakeState = 'MEMBER_AADHAAR_FRONT';
                sess.chatHistory.push({
                    sender: 'bot',
                    text: `✅ **குடும்பத் தலைவர் விவரங்கள் 100% உறுதி செய்யப்பட்டன!**\n\n` +
                          `👥 **படி 3/6: குடும்ப உறுப்பினர் ${nextMemberIdx + 1}-ன் ஆதார் அட்டை**\n\n` +
                          `உறுப்பினர் ${nextMemberIdx + 1}-ன் ஆதார் அட்டையின் **முன்பக்கத்தைப் (Front Side)** பதிவேற்றவும்:`,
                    actionRequired: 'upload',
                    uploadPrompt: `உறுப்பினர் ${nextMemberIdx + 1} ஆதார் முன்பக்கம்`
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
                sess.intakeState = 'MOBILE_NUMBER';
                const hasValidCurrentMob = activeMobile && /^[6-9]\d{9}$/.test(activeMobile);
                sess.chatHistory.push({
                    sender: 'bot',
                    text: `✅ **குடும்பத் தலைவர் விவரங்கள் 100% உறுதி செய்யப்பட்டன!**\n\n` +
                          `📱 **படி 4/6: ரேஷன் கார்டு பதிவு கைபேசி எண்**\n\n` +
                          `ரேஷன் கடை பொருட்கள் தகவல், மாதாந்திர OTP மற்றும் அரசு அறிவிப்புகள் வர வேண்டிய **குடும்பத் தலைவரின் 10-இலக்க மொபைல் எண்ணை** உள்ளிடவும்:\n\n` +
                          (hasValidCurrentMob ? `*(உள்நுழைந்த எண்: +91 ${activeMobile})*` : `*(10 இலக்க மொபைல் எண்ணைத் தட்டச்சு செய்யவும்)*`),
                    options: hasValidCurrentMob ? [{ label: `+91 ${activeMobile} (இந்த எண்ணையே பயன்படுத்து)`, value: activeMobile }] : []
                });
            }
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState });
            return true;
        }

        sess.chatHistory.push({
            sender: 'bot',
            text: `விவரங்களைச் சரிபார்த்து **'விவரங்கள் அனைத்தும் சரி'** அல்லது **'விவரங்களைச் சரிபார் / திருத்து'** என்பதைத் தேர்ந்தெடுக்கவும்:`,
            options: [
                { label: "✅ விவரங்கள் அனைத்தும் சரி (All Correct - Continue)", value: "HEAD_DETAILS_CONFIRMED" },
                { label: "✏️ விவரங்களைச் சரிபார் / திருத்து (Review / Edit Details)", value: "TRIGGER_EDIT_MODAL" }
            ]
        });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState });
        return true;
    }

    return false;
}

module.exports = {
    handleHeadAadhaar
};
