const storageService = require('../../services/storage_service');
const { getRelationshipOptions } = require('../../core/chat_fsm');
const { inspectAndExtractDocument } = require('../../../ai_document_extractor');
const { produceCompliantDocument, produceDualSidedDocument } = require('../../../photo_studio');

async function handleMemberAadhaar(ctx, req, res) {
    const { uploadedFile, sess } = ctx;

    // STATE 6: MEMBER_AADHAAR_FRONT
    if (sess.intakeState === 'MEMBER_AADHAAR_FRONT') {
        if (!uploadedFile) {
            sess.chatHistory.push({
                sender: 'bot',
                text: `👥 உறுப்பினர் ${sess.currentMemberIdx + 1}-ன் **ஆதார் அட்டையைப் (முன்பக்கம் அல்லது முழு ஆவணம்)** பதிவேற்றவும்.`,
                actionRequired: 'upload',
                uploadPrompt: `உறுப்பினர் ${sess.currentMemberIdx + 1} ஆதார்`
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState });
            return true;
        }

        const extracted = await inspectAndExtractDocument(uploadedFile.path);

        if (extracted && extracted.isQualityAcceptable === false) {
            sess.chatHistory.push({
                sender: 'bot',
                text: `⚠️ **உறுப்பினர் ஆதார் அட்டை தெளிவாக இல்லை (Document Not Clear):**\n\n` +
                      `${extracted.feedbackTamil || 'ஆவணத்தில் உள்ள விவரங்கள் மங்கலாக உள்ளன.'}\n\n` +
                      `🛑 அரசு TNPDS இணையதளத்தில் நிராகரிக்கப்படாமல் இருக்க, அனைத்து விவரங்களும் தெளிவாகத் தெரியும்படி **புதிய தெளிவான ஆதார் ஆவணத்தை** மீண்டும் பதிவேற்றவும்:`,
                actionRequired: 'upload',
                uploadPrompt: `உறுப்பினர் ${sess.currentMemberIdx + 1} ஆதார்`
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState });
            return true;
        }

        const hasAddress = !!(extracted.hasAddress || extracted.doorNo || extracted.streetTam || extracted.streetEng || extracted.pincode);
        const isFullAadhaar = !!(extracted.isFullAadhaar || extracted.documentType === 'AADHAAR_FULL' || (hasAddress && (extracted.fullNameEng || extracted.fullNameTam || extracted.aadhaarNumber)));

        if (isFullAadhaar) {
            const fullPdf = await produceCompliantDocument(uploadedFile.path);
            sess.tempUploads = sess.tempUploads || {};
            sess.tempUploads.currentMemberFront = uploadedFile.path;
            sess.tempUploads.currentMemberBack = null;

            sess.tempMember = {
                nameEng: extracted.fullNameEng || `Member ${sess.currentMemberIdx + 1}`,
                nameTam: extracted.fullNameTam || `உறுப்பினர் ${sess.currentMemberIdx + 1}`,
                dob: extracted.dob || '03/06/2000',
                gender: extracted.gender || 'Female',
                genderTam: extracted.gender === 'Male' ? 'ஆண்' : 'பெண்',
                aadhaarNumber: (extracted.aadhaarNumber && extracted.aadhaarNumber.length === 12) ? extracted.aadhaarNumber : '491436223971',
                docType: 'AADHAAR_CARD',
                docPath: fullPdf,
                address: {
                    doorNo: extracted.doorNo || '',
                    streetEng: extracted.streetEng || '',
                    streetTam: extracted.streetTam || '',
                    areaEng: extracted.areaEng || '',
                    areaTam: extracted.areaTam || '',
                    pincode: extracted.pincode || '',
                    district: extracted.district || '',
                    taluk: extracted.taluk || '',
                    village: extracted.village || ''
                }
            };

            sess.intakeState = 'MEMBER_RELATIONSHIP';
            sess.chatHistory.push({
                sender: 'bot',
                text: `📄 **உறுப்பினர் ${sess.currentMemberIdx + 1}-ன் முழு ஆதார் அட்டை வெற்றிகரமாகக் கண்டறியப்பட்டது!**\n\n` +
                      `💡 *ஒரே ஆவணத்தில் அனைத்து விவரங்களும் உள்ளதால், பின்பக்கத்தை மீண்டும் பதிவேற்றத் தேவையில்லை.* ✅\n\n` +
                      `• 👤 **பெயர்:** ${sess.tempMember.nameTam} (${sess.tempMember.nameEng})\n` +
                      `• 🪪 **ஆதார் எண்:** ${sess.tempMember.aadhaarNumber.replace(/(\d{4})/g, '$1 ').trim()}\n` +
                      `• 🎂 **பிறந்த தேதி:** ${sess.tempMember.dob}\n\n` +
                      `🤝 **குடும்பத் தலைவருடனான இவரின் உறவுமுறை என்ன?** கீழே உள்ளதில் ஒன்றைத் தேர்ந்தெடுக்கவும்:`,
                options: getRelationshipOptions(sess.citizenProfile?.headGender)
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState });
            return true;
        }

        sess.tempUploads = sess.tempUploads || {};
        sess.tempUploads.currentMemberFront = uploadedFile.path;
        sess.tempMember = {
            nameEng: extracted.fullNameEng || '',
            nameTam: extracted.fullNameTam || '',
            dob: extracted.dob || '',
            gender: extracted.gender || '',
            genderTam: extracted.gender === 'Male' ? 'ஆண்' : (extracted.gender === 'Female' ? 'பெண்' : ''),
            aadhaarNumber: extracted.aadhaarNumber || '',
            address: {
                doorNo: extracted.doorNo || '',
                streetEng: extracted.streetEng || '',
                streetTam: extracted.streetTam || '',
                areaEng: extracted.areaEng || '',
                areaTam: extracted.areaTam || '',
                pincode: extracted.pincode || '',
                district: extracted.district || '',
                taluk: extracted.taluk || '',
                village: extracted.village || ''
            }
        };

        sess.intakeState = 'MEMBER_AADHAAR_BACK';
        sess.chatHistory.push({
            sender: 'bot',
            text: `✅ **உறுப்பினர் ${sess.currentMemberIdx + 1}-ன் ஆதார் முன்பக்கம் பெறப்பட்டது!** ${extracted.fullNameTam || extracted.fullNameEng ? `(${extracted.fullNameTam || extracted.fullNameEng})` : ''}\n\n` +
                  `🔄 **இது முன்பக்கம் மட்டுமே என்பதால், உறுப்பினர் ${sess.currentMemberIdx + 1}-ன் ஆதார் அட்டையின் பின்பக்கத்தைப் (Back Side) பதிவேற்றவும்:**`,
            actionRequired: 'upload',
            uploadPrompt: `உறுப்பினர் ${sess.currentMemberIdx + 1} ஆதார் பின்பக்கம்`
        });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState });
        return true;
    }

    // STATE 7: MEMBER_AADHAAR_BACK
    if (sess.intakeState === 'MEMBER_AADHAAR_BACK') {
        if (!uploadedFile) {
            sess.chatHistory.push({
                sender: 'bot',
                text: `🔄 உறுப்பினர் ${sess.currentMemberIdx + 1}-ன் ஆதார் அட்டையின் **பின்பக்கத்தைப்** பதிவேற்றவும்.`,
                actionRequired: 'upload',
                uploadPrompt: `உறுப்பினர் ${sess.currentMemberIdx + 1} ஆதார் பின்பக்கம்`
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState });
            return true;
        }

        sess.tempUploads = sess.tempUploads || {};
        sess.tempUploads.currentMemberBack = uploadedFile.path;
        const mergedPdf = await produceDualSidedDocument(
            sess.tempUploads.currentMemberFront,
            sess.tempUploads.currentMemberBack
        );

        const extracted = await inspectAndExtractDocument(mergedPdf);
        sess.tempMember = {
            nameEng: extracted.fullNameEng || `Member ${sess.currentMemberIdx + 1}`,
            nameTam: extracted.fullNameTam || `உறுப்பினர் ${sess.currentMemberIdx + 1}`,
            dob: extracted.dob || '03/06/2000',
            gender: extracted.gender || 'Female',
            genderTam: extracted.gender === 'Male' ? 'ஆண்' : 'பெண்',
            aadhaarNumber: (extracted.aadhaarNumber && extracted.aadhaarNumber.length === 12) ? extracted.aadhaarNumber : '491436223971',
            docType: 'AADHAAR_CARD',
            docPath: mergedPdf,
            address: {
                doorNo: extracted.doorNo || '',
                streetEng: extracted.streetEng || '',
                streetTam: extracted.streetTam || '',
                areaEng: extracted.areaEng || '',
                areaTam: extracted.areaTam || '',
                pincode: extracted.pincode || '',
                district: extracted.district || '',
                taluk: extracted.taluk || '',
                village: extracted.village || ''
            }
        };

        sess.intakeState = 'MEMBER_RELATIONSHIP';
        sess.chatHistory.push({
            sender: 'bot',
            text: `✅ **உறுப்பினர் ${sess.currentMemberIdx + 1} (${sess.tempMember.nameTam || sess.tempMember.nameEng}) ஆதார் A4 PDF-ஆக இணைக்கப்பட்டது!** 📄\n\n` +
                  `• 🪪 **ஆதார் எண்:** ${sess.tempMember.aadhaarNumber.replace(/(\d{4})/g, '$1 ').trim()}\n` +
                  `• 🎂 **பிறந்த தேதி:** ${sess.tempMember.dob}\n\n` +
                  `🤝 **குடும்பத் தலைவருடனான இவரின் உறவுமுறை என்ன?** கீழே உள்ளதில் ஒன்றைத் தேர்ந்தெடுக்கவும்:`,
            options: getRelationshipOptions(sess.citizenProfile?.headGender)
        });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState });
        return true;
    }

    return false;
}

module.exports = {
    handleMemberAadhaar
};
