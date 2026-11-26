const storageService = require('../../services/storage_service');
const { getRelationshipOptions } = require('../../core/chat_fsm');
const { inspectAndExtractDocument } = require('../../../ai_document_extractor');
const { produceCompliantDocument, produceDualSidedDocument } = require('../../../photo_studio');
const { saveCitizenDraft } = require('../../../firestore_db');
const { normalizeTamilInitialsFromEnglish, ensureBilingualPair } = require('../../utils/bilingual_helper');
const { isDoubleSidedCardComplete } = require('../../services/document_validator');

const { persistSessions } = storageService;

async function handleMemberAadhaar(ctx, req, res) {
    const { text, uploadedFile, sess } = ctx;
    const activeMobile = ctx.targetMobile || sess.mobileNumber || sess.citizenProfile?.mobileNumber || storageService.getActiveMobile();

    if (typeof sess.currentMemberIdx !== 'number' || isNaN(sess.currentMemberIdx) || sess.currentMemberIdx < 1) {
        const existingMembers = Array.isArray(sess.citizenProfile?.members) ? sess.citizenProfile.members.length : 1;
        sess.currentMemberIdx = Math.max(1, existingMembers);
    }

    // STATE 6: MEMBER_AADHAAR_FRONT (Supports both Aadhaar Card AND Child Birth Certificate)
    if (sess.intakeState === 'MEMBER_AADHAAR_FRONT') {
        if (!uploadedFile) {
            if (text === 'MEMBER_BIRTH_CERT_UPLOAD' || (text && (text.includes('பிறப்பு') || text.toLowerCase().includes('birth')))) {
                sess.tempUploads = sess.tempUploads || {};
                sess.tempUploads.expectingMemberDocType = 'BIRTH_CERTIFICATE';
                persistSessions(activeMobile);
                sess.chatHistory.push({
                    sender: 'bot',
                    text: `📜 உறுப்பினர் ${sess.currentMemberIdx + 1} (சிறிய குழந்தை / ஆதார் இல்லாதவர்) **பிறப்புச் சான்றிதழை (Birth Certificate)** பதிவேற்றவும்.\n\n` +
                          `*(குழந்தையின் பெயர், பிறந்த தேதி, பாலினம் தானாகப் பிரித்தெடுக்கப்பட்டு ஆதார் எண் இல்லாமல் சேர்க்கப்படும் ✅)*`,
                    actionRequired: 'upload',
                    uploadPrompt: `உறுப்பினர் ${sess.currentMemberIdx + 1} பிறப்புச் சான்றிதழ்`
                });
                res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState });
                return true;
            }
            sess.chatHistory.push({
                sender: 'bot',
                text: `👥 உறுப்பினர் ${sess.currentMemberIdx + 1}-ன் **ஆதார் அட்டையைப் (முன்பக்கம் / முழு அட்டை)** அல்லது ஆதார் இல்லாத குழந்தை எனில் **பிறப்புச் சான்றிதழைப்** பதிவேற்றவும்.`,
                actionRequired: 'upload',
                uploadPrompt: `உறுப்பினர் ${sess.currentMemberIdx + 1} ஆதார் / பிறப்புச் சான்றிதழ்`,
                options: [
                    { label: "🪪 ஆதார் அட்டை பதிவேற்றவும்", value: "TRIGGER_FILE_UPLOAD" },
                    { label: "📜 பிறப்புச் சான்றிதழ் (ஆதார் இல்லாத குழந்தை)", value: "MEMBER_BIRTH_CERT_UPLOAD" }
                ]
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState });
            return true;
        }

        const extracted = await inspectAndExtractDocument(uploadedFile.path);

        if (extracted && extracted.isQualityAcceptable === false) {
            sess.chatHistory.push({
                sender: 'bot',
                text: `⚠️ **உறுப்பினர் ஆவணம் தெளிவாக இல்லை (Document Not Clear):**\n\n` +
                      `${extracted.feedbackTamil || 'ஆவணத்தில் உள்ள விவரங்கள் மங்கலாக உள்ளன.'}\n\n` +
                      `🛑 அரசு TNPDS இணையதளத்தில் நிராகரிக்கப்படாமல் இருக்க, அனைத்து விவரங்களும் தெளிவாகத் தெரியும்படி **தெளிவான ஆவணத்தை** மீண்டும் பதிவேற்றவும்:`,
                actionRequired: 'upload',
                uploadPrompt: `உறுப்பினர் ${sess.currentMemberIdx + 1} ஆவணம்`
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState });
            return true;
        }

        const cleanExtAadhaar = String(extracted.aadhaarNumber || '').replace(/\D/g, '');
        const isBirthCert = extracted.documentType === 'BIRTH_CERTIFICATE' ||
            sess.tempUploads?.expectingMemberDocType === 'BIRTH_CERTIFICATE';
        if (sess.tempUploads) sess.tempUploads.expectingMemberDocType = null;

        const compliantPdf = await produceCompliantDocument(uploadedFile.path);
        sess.tempUploads = sess.tempUploads || {};
        sess.tempUploads.currentMemberFront = uploadedFile.path;
        sess.tempUploads.currentMemberFrontBoundingBox = extracted.documentBoundingBox || null;
        sess.tempUploads.currentMemberDoc = compliantPdf;

        const rawMemEng = extracted.fullNameEng || `Member ${sess.currentMemberIdx + 1}`;
        let rawMemTam = extracted.fullNameTam || `உறுப்பினர் ${sess.currentMemberIdx + 1}`;
        if (extracted.fullNameEng && extracted.fullNameTam) {
            rawMemTam = normalizeTamilInitialsFromEnglish(rawMemEng, rawMemTam);
        } else if (extracted.fullNameEng && !extracted.fullNameTam) {
            rawMemTam = ensureBilingualPair(rawMemEng, '').tam;
        }

        const memAadhaarVal = isBirthCert ? '' : (cleanExtAadhaar.length === 12 ? cleanExtAadhaar : '');

        sess.tempMember = {
            nameEng: rawMemEng,
            nameTam: rawMemTam,
            dob: extracted.dob || '01/01/2020',
            gender: extracted.gender || 'Female',
            genderTam: extracted.gender === 'Male' ? 'ஆண்' : 'பெண்',
            aadhaarNumber: memAadhaarVal,
            hasAadhaar: !isBirthCert,
            certificateNumber: isBirthCert ? (extracted.certificateNumber || '') : '',
            docType: isBirthCert ? 'BIRTH_CERTIFICATE' : 'AADHAAR_CARD',
            docPath: compliantPdf,
            birthCertificatePath: isBirthCert ? compliantPdf : '',
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

        // Instantly reflect in citizenProfile.members and documents so right sidebar updates immediately!
        sess.citizenProfile = sess.citizenProfile || {};
        sess.citizenProfile.members = Array.isArray(sess.citizenProfile.members) ? sess.citizenProfile.members : [];
        if (sess.citizenProfile.members.length > sess.currentMemberIdx) {
            sess.citizenProfile.members[sess.currentMemberIdx] = {
                ...sess.citizenProfile.members[sess.currentMemberIdx],
                ...sess.tempMember
            };
        } else {
            sess.citizenProfile.members.push(sess.tempMember);
        }
        sess.citizenProfile.tempMember = sess.tempMember;
        sess.citizenProfile.documents = sess.citizenProfile.documents || {};
        const memDocSlotKey = `memberDoc_${sess.currentMemberIdx}`;
        const memDocKey = `memberAadhaar${Math.max(0, sess.currentMemberIdx - 1)}`;
        const memFrontKey = `memberFront_${sess.currentMemberIdx}`;
        sess.citizenProfile.documents[memDocSlotKey] = compliantPdf;
        sess.citizenProfile.documents[memDocKey] = compliantPdf;
        sess.citizenProfile.documents[memFrontKey] = uploadedFile.path;
        if (!isBirthCert) {
            sess.citizenProfile.documents.memberAadhaar = compliantPdf;
        }
        sess.tempUploads = sess.tempUploads || {};
        sess.tempUploads[memDocSlotKey] = compliantPdf;
        sess.tempUploads[memDocKey] = compliantPdf;
        sess.tempUploads[memFrontKey] = uploadedFile.path;

        const hasBothSides = isBirthCert || isDoubleSidedCardComplete(extracted, uploadedFile.path, 'aadhaar');

        if (!hasBothSides) {
            sess.intakeState = 'MEMBER_AADHAAR_BACK';
            sess.chatHistory.push({
                sender: 'bot',
                text: `🪪 **உறுப்பினர் ${sess.currentMemberIdx + 1}-ன் ஆதார் அட்டை முன்பக்கம் பெறப்பட்டது!** ✅\n\n` +
                      `• 👤 **பெயர்:** ${sess.tempMember.nameTam} (${sess.tempMember.nameEng})\n` +
                      `• 🪪 **ஆதார் எண்:** ${(sess.tempMember.aadhaarNumber || '').replace(/(\d{4})/g, '$1 ').trim() || '*(எண் தெளிவாக இல்லை — Edit-ல் சரிபார்க்கவும்)*'}\n` +
                      `• 🎂 **பிறந்த தேதி:** ${sess.tempMember.dob} | **பாலினம்:** ${sess.tempMember.genderTam}\n\n` +
                      `🔄 **இப்போது உறுப்பினர் ${sess.currentMemberIdx + 1}-ன் ஆதார் அட்டையின் பின்பக்கத்தையும் (Back Side / முகவரி பகுதி) பதிவேற்றவும்:**\n` +
                      `*(AI தானாக முன் + பின் பக்கங்களை ஒரே 2-in-1 A4 PDF ஆவணமாக இணைக்கும் ✨)*`,
                actionRequired: 'upload',
                uploadPrompt: `உறுப்பினர் ${sess.currentMemberIdx + 1} ஆதார் பின்பக்கம்`,
                options: [
                    { label: "📷 ஆதார் பின்பக்கம் பதிவேற்றவும்", value: "TRIGGER_FILE_UPLOAD" },
                    { label: "⏭️ பின்பக்கம் தேவையில்லை — தொடர்க", value: "MEMBER_AADHAAR_SKIP_BACK" }
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

        sess.intakeState = 'MEMBER_RELATIONSHIP';
        sess.chatHistory.push({
            sender: 'bot',
            text: (isBirthCert
                ? `📜 **உறுப்பினர் ${sess.currentMemberIdx + 1}-ன் பிறப்புச் சான்றிதழ் (Birth Certificate) வெற்றிகரமாகப் பெறப்பட்டது!** ✅\n\n`
                : `📄 **உறுப்பினர் ${sess.currentMemberIdx + 1}-ன் முழு ஆதார் அட்டை (இரு பக்கங்களும்) வெற்றிகரமாகப் பெறப்பட்டது!** ✅\n\n`) +
                  `• 👤 **பெயர்:** ${sess.tempMember.nameTam} (${sess.tempMember.nameEng})\n` +
                  (isBirthCert
                      ? `• 📜 **ஆவணம்:** பிறப்புச் சான்றிதழ் (ஆதார் எண் இல்லாத குழந்தை)\n`
                      : `• 🪪 **ஆதார் எண்:** ${(sess.tempMember.aadhaarNumber || '').replace(/(\d{4})/g, '$1 ').trim() || '*(எண் தெளிவாக இல்லை — Edit-ல் சரிபார்க்கவும்)*'}\n`) +
                  `• 🎂 **பிறந்த தேதி:** ${sess.tempMember.dob} | **பாலினம்:** ${sess.tempMember.genderTam}\n\n` +
                  `🤝 **குடும்பத் தலைவருடனான இவரின் உறவுமுறை என்ன?** கீழே உள்ளதில் ஒன்றைத் தேர்ந்தெடுக்கவும்:`,
            options: getRelationshipOptions(sess.citizenProfile?.headGender)
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

    // STATE 7: MEMBER_AADHAAR_BACK
    if (sess.intakeState === 'MEMBER_AADHAAR_BACK') {
        if (!uploadedFile) {
            const isExplicitSkip = text === 'MEMBER_AADHAAR_SKIP_BACK' || text === 'MEMBER_DOC_COMPLETE' ||
                (text && /பின்பக்கம் தேவையில்லை|skip|முழு ஆவணம் முடிந்தது/i.test(text));
            if (isExplicitSkip && sess.tempMember && (sess.tempMember.nameTam || sess.tempMember.nameEng)) {
                sess.intakeState = 'MEMBER_RELATIONSHIP';
                sess.chatHistory.push({
                    sender: 'bot',
                    text: `✅ **உறுப்பினர் ${sess.currentMemberIdx + 1} (${sess.tempMember.nameTam || sess.tempMember.nameEng}) ஆதார் விவரங்கள் உறுதி செய்யப்பட்டன!** 📄\n\n` +
                          `• 🪪 **ஆதார் எண்:** ${(sess.tempMember.aadhaarNumber || '').replace(/(\d{4})/g, '$1 ').trim() || '—'}\n` +
                          `• 🎂 **பிறந்த தேதி:** ${sess.tempMember.dob || '—'}\n\n` +
                          `🤝 **குடும்பத் தலைவருடனான இவரின் உறவுமுறை என்ன?** கீழே உள்ளதில் ஒன்றைத் தேர்ந்தெடுக்கவும்:`,
                    options: getRelationshipOptions(sess.citizenProfile?.headGender)
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

            sess.chatHistory.push({
                sender: 'bot',
                text: `🔄 தயவுசெய்து உறுப்பினர் ${sess.currentMemberIdx + 1}-ன் ஆதார் அட்டையின் **பின்பக்கத்தை (Back Side)** பதிவேற்றவும்:`,
                actionRequired: 'upload',
                uploadPrompt: `உறுப்பினர் ${sess.currentMemberIdx + 1} ஆதார் பின்பக்கம்`,
                options: [
                    { label: "📷 ஆதார் பின்பக்கம் பதிவேற்றவும்", value: "TRIGGER_FILE_UPLOAD" },
                    { label: "⏭️ பின்பக்கம் தேவையில்லை — தொடர்க", value: "MEMBER_AADHAAR_SKIP_BACK" }
                ]
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState });
            return true;
        }

        sess.tempUploads = sess.tempUploads || {};
        sess.tempUploads.currentMemberBack = uploadedFile.path;

        const backRawExtracted = await inspectAndExtractDocument(uploadedFile.path).catch(() => ({}));
        const fs = require('fs');
        const path = require('path');
        const memFrontKey = `memberFront_${sess.currentMemberIdx}`;
        const memFrontPath = sess.tempUploads.currentMemberFront || sess.citizenProfile?.documents?.[memFrontKey] || sess.tempUploads[memFrontKey] || null;
        let finalDocPdf = null;
        if (memFrontPath && fs.existsSync(memFrontPath)) {
            try {
                finalDocPdf = await produceDualSidedDocument(
                    memFrontPath,
                    sess.tempUploads.currentMemberBack,
                    null,
                    {
                        frontBoundingBox: sess.tempUploads.currentMemberFrontBoundingBox || null,
                        backBoundingBox: backRawExtracted?.documentBoundingBox || null
                    }
                );
            } catch (_) {}
        }
        if (!finalDocPdf || !fs.existsSync(finalDocPdf)) {
            finalDocPdf = await produceCompliantDocument((memFrontPath && fs.existsSync(memFrontPath)) ? memFrontPath : uploadedFile.path);
        }

        const extracted = await inspectAndExtractDocument(finalDocPdf || uploadedFile.path).catch(() => backRawExtracted || {});
        const mergedExtracted = { ...(backRawExtracted || {}), ...(extracted || {}) };
        sess.tempMember = sess.tempMember || {};
        const prevNameEng = sess.tempMember.nameEng && !sess.tempMember.nameEng.startsWith('Member ') ? sess.tempMember.nameEng : '';
        const prevNameTam = sess.tempMember.nameTam && !sess.tempMember.nameTam.startsWith('உறுப்பினர் ') ? sess.tempMember.nameTam : '';
        if (!prevNameEng && mergedExtracted.fullNameEng) sess.tempMember.nameEng = mergedExtracted.fullNameEng;
        if (!prevNameTam && mergedExtracted.fullNameTam) sess.tempMember.nameTam = mergedExtracted.fullNameTam;
        if (!sess.tempMember.dob && mergedExtracted.dob) sess.tempMember.dob = mergedExtracted.dob;
        if (!sess.tempMember.gender && mergedExtracted.gender) {
            sess.tempMember.gender = mergedExtracted.gender;
            sess.tempMember.genderTam = mergedExtracted.gender === 'Male' ? 'ஆண்' : 'பெண்';
        }
        const backAadhaarDigits = String(mergedExtracted.aadhaarNumber || '').replace(/\D/g, '');
        if (!sess.tempMember.aadhaarNumber && backAadhaarDigits.length === 12) {
            sess.tempMember.aadhaarNumber = backAadhaarDigits;
        }
        sess.tempMember.address = {
            ...(sess.tempMember.address || {}),
            doorNo: mergedExtracted.doorNo || sess.tempMember.address?.doorNo || '',
            streetEng: mergedExtracted.streetEng || sess.tempMember.address?.streetEng || '',
            streetTam: mergedExtracted.streetTam || sess.tempMember.address?.streetTam || '',
            areaEng: mergedExtracted.areaEng || sess.tempMember.address?.areaEng || '',
            areaTam: mergedExtracted.areaTam || sess.tempMember.address?.areaTam || '',
            pincode: mergedExtracted.pincode || sess.tempMember.address?.pincode || '',
            district: mergedExtracted.district || sess.tempMember.address?.district || '',
            taluk: mergedExtracted.taluk || sess.tempMember.address?.taluk || '',
            village: mergedExtracted.village || sess.tempMember.address?.village || ''
        };

        sess.tempMember.nameEng = sess.tempMember.nameEng || `Member ${sess.currentMemberIdx + 1}`;
        sess.tempMember.nameTam = sess.tempMember.nameTam || `உறுப்பினர் ${sess.currentMemberIdx + 1}`;
        sess.tempMember.dob = sess.tempMember.dob || '01/01/2000';
        sess.tempMember.gender = sess.tempMember.gender || 'Female';
        sess.tempMember.genderTam = sess.tempMember.genderTam || 'பெண்';
        sess.tempMember.aadhaarNumber = sess.tempMember.aadhaarNumber || '';
        sess.tempMember.docType = 'AADHAAR_CARD';
        sess.tempMember.docPath = finalDocPdf;

        // Instantly reflect in citizenProfile.members and documents so right sidebar updates immediately!
        sess.citizenProfile = sess.citizenProfile || {};
        sess.citizenProfile.members = Array.isArray(sess.citizenProfile.members) ? sess.citizenProfile.members : [];
        if (sess.citizenProfile.members.length > sess.currentMemberIdx) {
            sess.citizenProfile.members[sess.currentMemberIdx] = {
                ...sess.citizenProfile.members[sess.currentMemberIdx],
                ...sess.tempMember
            };
        } else {
            sess.citizenProfile.members.push(sess.tempMember);
        }
        sess.citizenProfile.tempMember = sess.tempMember;
        sess.citizenProfile.documents = sess.citizenProfile.documents || {};
        const memDocSlotKeyMerged = `memberDoc_${sess.currentMemberIdx}`;
        const memDocKeyMerged = `memberAadhaar${Math.max(0, sess.currentMemberIdx - 1)}`;
        sess.citizenProfile.documents[memDocSlotKeyMerged] = finalDocPdf;
        sess.citizenProfile.documents[memDocKeyMerged] = finalDocPdf;
        sess.citizenProfile.documents.memberAadhaar = finalDocPdf;
        sess.tempUploads = sess.tempUploads || {};
        sess.tempUploads[memDocSlotKeyMerged] = finalDocPdf;
        sess.tempUploads[memDocKeyMerged] = finalDocPdf;
        sess.tempUploads.memberAadhaar = finalDocPdf;

        if (finalDocPdf && fs.existsSync(finalDocPdf) && sess.currentMemberIdx >= 1) {
            try {
                const memB64 = fs.readFileSync(finalDocPdf).toString('base64');
                const slotIdx = sess.currentMemberIdx - 1;
                const entry = {
                    name: path.basename(finalDocPdf),
                    docType: 'AADHAAR_CARD',
                    memberIdx: sess.currentMemberIdx,
                    base64: memB64
                };
                sess.base64Docs = sess.base64Docs || {};
                sess.citizenProfile.base64Docs = sess.citizenProfile.base64Docs || {};
                if (!Array.isArray(sess.base64Docs.memberAadhaarsBase64)) sess.base64Docs.memberAadhaarsBase64 = [];
                if (!Array.isArray(sess.citizenProfile.base64Docs.memberAadhaarsBase64)) sess.citizenProfile.base64Docs.memberAadhaarsBase64 = [];
                sess.base64Docs.memberAadhaarsBase64[slotIdx] = entry;
                sess.citizenProfile.base64Docs.memberAadhaarsBase64[slotIdx] = entry;
            } catch (_) {}
        }

        sess.intakeState = 'MEMBER_RELATIONSHIP';
        sess.chatHistory.push({
            sender: 'bot',
            text: `✅ **உறுப்பினர் ${sess.currentMemberIdx + 1} (${sess.tempMember.nameTam || sess.tempMember.nameEng}) ஆதார் ஆவணம் வெற்றிகரமாகச் சேர்க்கப்பட்டது!** 📄\n\n` +
                  `• 🪪 **ஆதார் எண்:** ${sess.tempMember.aadhaarNumber.replace(/(\d{4})/g, '$1 ').trim()}\n` +
                  `• 🎂 **பிறந்த தேதி:** ${sess.tempMember.dob} | **பாலினம்:** ${sess.tempMember.genderTam}\n\n` +
                  `🤝 **குடும்பத் தலைவருடனான இவரின் உறவுமுறை என்ன?** கீழே உள்ளதில் ஒன்றைத் தேர்ந்தெடுக்கவும்:`,
            options: getRelationshipOptions(sess.citizenProfile?.headGender)
        });
        persistSessions(activeMobile);
        if (activeMobile) {
            saveCitizenDraft(activeMobile, {
                citizenProfile: sess.citizenProfile,
                documents: sess.tempUploads,
                base64Docs: sess.base64Docs || {},
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
    handleMemberAadhaar
};
