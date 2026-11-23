/**
 * src/cartridges/_tnega_upload_utils.js
 *
 * Pure, stateless document normalization & upload utilities for TNeGA Cartridges.
 * Zero service-specific branching: every caller explicitly supplies its own
 * backWaitState and advanceFlowFn.
 */
const fs = require('fs');
const storageService = require('../services/storage_service');
const { inspectAndExtractDocument } = require('../../ai_document_extractor');
const { validateUploadedDocument, isDoubleSidedCardComplete } = require('../services/document_validator');
const { produceCompliantDocument, produceDualSidedDocument, produceCompliantPassportPhoto } = require('../../photo_studio');
const { saveCitizenProfile } = require('../../database');
const { applyExtractedAadhaarRelationsAndDob, applyExtractedSmartCardDetails } = require('../services/profile_helpers');
const { searchCitizenCan } = require('../../tnega_can_automation');

const persistSessions = (...a) => storageService.persistSessions(...a);

function isPhysicalDocValid(docPath, b64Data) {
    if (b64Data && typeof b64Data === 'string' && b64Data.length > 200) return true;
    if (docPath && typeof docPath === 'string') {
        const cleanPath = docPath.trim();
        if (cleanPath.length > 0 && fs.existsSync(cleanPath)) {
            try {
                const stat = fs.statSync(cleanPath);
                return stat.size > 100;
            } catch (_) {
                return false;
            }
        }
    }
    return false;
}

function hasValidSmartCard(p = {}, sess = {}) {
    return isPhysicalDocValid(
        p.smartCard || p.rationCard || p.smartCardPath || p.rationCardPath || p.smartCardDocPath || p.rationCardDocPath || p.documents?.smartCard || p.documents?.rationCard || sess.tempUploads?.smartCard,
        sess.draftData?.base64Docs?.smartCardBase64 || sess.draftData?.base64Docs?.rationCardBase64
    );
}

function buildSmartCardPromptStep(sess, waitState, prefixMessage, svcLabel, isIncome = false) {
    sess.intakeState = waitState;
    const extraHint = isIncome
        ? '\n💡 *பின்பக்கத்தில் உள்ள குடும்ப உறுப்பினர்கள் பட்டியலை AI தானாகப் படித்துக் காட்டும்!*'
        : '';
    const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
        `📑 **குடும்ப ஸ்மார்ட் ரேஷன் கார்டு (Smart Card) தேவை — ${svcLabel}:**\n\n` +
        `⚠️ **கட்டாய அரசு முகவரி & குடும்ப ஆவணம்:**\n` +
        `வருவாய்த் துறை சேவைகளுக்கு **குடும்ப ஸ்மார்ட் ரேஷன் கார்டு** (முழு அட்டை OR முன்பக்கம் + பின்பக்கம்) கட்டாயம் தேவை.${extraHint}\n\n` +
        `தயவுசெய்து **ரேஷன் கார்டு (முன்பக்கம் / முழுப் படம் அல்லது PDF)** பதிவேற்றவும்:`;
    const options = [
        { label: "📷 குடும்ப அட்டை (Smart Card) பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
        { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
    ];
    return { text: welcomeText, options, step: sess.intakeState };
}

async function handleTnegaAadhaarUploadHelper({ ctx, req, res, backWaitState, advanceFlowFn }) {
    const { text, uploadedFile, sess } = ctx;
    const activeMobile = ctx.targetMobile || sess.mobileNumber || sess.citizenProfile?.mobileNumber || storageService.getActiveMobile();
    if (!sess.citizenProfile) sess.citizenProfile = {};
    if (!sess.tempUploads) sess.tempUploads = {};

    if (sess.intakeState === backWaitState) {
        if (uploadedFile) {
            let extractedBack = null;
            try {
                extractedBack = await inspectAndExtractDocument(uploadedFile.path, { skipFaceExtraction: true });
            } catch (_) {}

            const validation = validateUploadedDocument('headAadhaarBack', extractedBack);
            if (!validation.valid) {
                try { if (fs.existsSync(uploadedFile.path)) fs.unlinkSync(uploadedFile.path); } catch (_) {}
                sess.chatHistory.push({
                    sender: 'bot',
                    text: validation.errorTamil,
                    options: [
                        { label: "📷 ஆதார் பின்பக்கம் அப்லோட்", value: "TRIGGER_FILE_UPLOAD" },
                        { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
                    ]
                });
                res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
                return true;
            }

            sess.tempUploads.headAadhaarBack = uploadedFile.path;
            sess.tempUploads.headAadhaarBackBoundingBox = extractedBack?.documentBoundingBox || null;

            const mergedPdf = await produceDualSidedDocument(
                sess.tempUploads.headAadhaarFront,
                sess.tempUploads.headAadhaarBack,
                produceCompliantDocument,
                {
                    frontBoundingBox: sess.tempUploads.headAadhaarFrontBoundingBox,
                    backBoundingBox: sess.tempUploads.headAadhaarBackBoundingBox
                }
            );

            sess.tempUploads.headAadhaar = mergedPdf;
            sess.citizenProfile.headAadhaarDocPath = mergedPdf;
            if (!sess.citizenProfile.documents) sess.citizenProfile.documents = {};
            sess.citizenProfile.documents.headAadhaar = mergedPdf;
            sess.citizenProfile.documents.headAadhaarFront = sess.tempUploads.headAadhaarFront;
            sess.citizenProfile.documents.headAadhaarBack = sess.tempUploads.headAadhaarBack;

            const extracted = extractedBack || await inspectAndExtractDocument(mergedPdf, { skipFaceExtraction: true }).catch(() => null);
            if (extracted) {
                if (extracted.fullNameEng && !sess.citizenProfile.fullNameEng) sess.citizenProfile.fullNameEng = extracted.fullNameEng;
                if (extracted.fullNameTam && !sess.citizenProfile.fullNameTam) sess.citizenProfile.fullNameTam = extracted.fullNameTam;
                applyExtractedAadhaarRelationsAndDob(sess.citizenProfile, extracted);
                if (extracted.doorNo) sess.citizenProfile.doorNo = extracted.doorNo;
                if (extracted.streetTam) sess.citizenProfile.streetTam = extracted.streetTam;
                if (extracted.streetEng) sess.citizenProfile.streetEng = extracted.streetEng;
                if (extracted.areaTam) sess.citizenProfile.areaTam = extracted.areaTam;
                if (extracted.areaEng) sess.citizenProfile.areaEng = extracted.areaEng;
                if (extracted.village) sess.citizenProfile.village = extracted.village;
                if (extracted.taluk) sess.citizenProfile.taluk = extracted.taluk;
                if (extracted.district) sess.citizenProfile.district = extracted.district;
                if (extracted.pincode) sess.citizenProfile.pincode = extracted.pincode;
            }

            if (activeMobile) saveCitizenProfile(activeMobile, sess.citizenProfile);
            persistSessions();

            const fatherDisp = sess.citizenProfile.fatherNameTam
                ? `${sess.citizenProfile.fatherNameTam}${sess.citizenProfile.fatherNameEng ? ` (${sess.citizenProfile.fatherNameEng})` : ''}`
                : (sess.citizenProfile.fatherNameEng || '—');
            const addrDisp = `${sess.citizenProfile.doorNo ? sess.citizenProfile.doorNo + ', ' : ''}${sess.citizenProfile.streetTam || sess.citizenProfile.streetEng || '—'}, ${sess.citizenProfile.pincode || '—'}`;

            const flowStep = advanceFlowFn(
                sess,
                `📄 **ஆதார் அட்டை வெற்றிகரமாக 2-in-1 அரசு A4 PDF-ஆக இணைக்கப்பட்டது!** ✅\n\n` +
                `• 👨 **தந்தை/கணவர் பெயர்:** ${fatherDisp}\n` +
                `• 🏠 **முகவரி:** ${addrDisp}`
            );
            sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }

        if (text === 'TRIGGER_EDIT_MODAL' || text.includes('திருத்து') || text.toLowerCase().includes('edit')) {
            return false;
        }

        if (text === 'AADHAAR_SKIP_BACK' || (text && /பின்பக்கம் தேவையில்லை|skip/i.test(text))) {
            const frontSrc = sess.tempUploads?.headAadhaarFront || sess.citizenProfile?.headAadhaarDocPath;
            const compliantFront = frontSrc ? await produceCompliantDocument(frontSrc).catch(() => frontSrc) : frontSrc;
            if (compliantFront) {
                sess.tempUploads.headAadhaar = compliantFront;
                sess.citizenProfile.headAadhaarDocPath = compliantFront;
                if (!sess.citizenProfile.documents) sess.citizenProfile.documents = {};
                sess.citizenProfile.documents.headAadhaar = compliantFront;
            }
            if (activeMobile) saveCitizenProfile(activeMobile, sess.citizenProfile);
            persistSessions();
            const flowStep = advanceFlowFn(sess, `✅ **ஆதார் அட்டை ஆவணம் உறுதி செய்யப்பட்டது!**`);
            sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }

        sess.chatHistory.push({
            sender: 'bot',
            text: `🔄 தயவுசெய்து விண்ணப்பதாரரின் ஆதார் அட்டையின் **பின்பக்கப் புகைப்படத்தைப் (Back Side)** பதிவேற்றவும்.`,
            actionRequired: 'upload',
            uploadPrompt: 'ஆதார் பின்பக்கம் பதிவேற்றவும்',
            options: [
                { label: "📷 ஆதார் பின்பக்கம் அப்லோட்", value: "TRIGGER_FILE_UPLOAD" },
                { label: "⏭️ பின்பக்கம் தேவையில்லை — தொடர்க", value: "AADHAAR_SKIP_BACK" },
                { label: "✏️ விவரங்களைச் சரிபார் / திருத்து (Open Form)", value: "TRIGGER_EDIT_MODAL" }
            ]
        });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    if (uploadedFile) {
        const extracted = await inspectAndExtractDocument(uploadedFile.path);

        const validation = validateUploadedDocument('headAadhaar', extracted);
        if (!validation.valid) {
            try { if (fs.existsSync(uploadedFile.path)) fs.unlinkSync(uploadedFile.path); } catch (_) {}
            sess.chatHistory.push({
                sender: 'bot',
                text: validation.errorTamil,
                options: [
                    { label: "📷 ஆதார் அட்டை அப்லோட்", value: "TRIGGER_FILE_UPLOAD" },
                    { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
                ]
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }

        if (extracted && extracted.isQualityAcceptable === false) {
            sess.chatHistory.push({
                sender: 'bot',
                text: `⚠️ **ஆதார் அட்டை தெளிவாக இல்லை (Document Not Clear):**\n\n` +
                      `${extracted.feedbackTamil || 'ஆவணத்தில் உள்ள எழுத்துக்கள் அல்லது விவரங்கள் மங்கலாக உள்ளன.'}\n\n` +
                      `🛑 அரசு போர்ட்டலில் நிராகரிக்கப்படாமல் இருக்க, எழுத்துக்களும் எண்களும் தெளிவாகத் தெரியும்படி **தெளிவான ஆதார் ஆவணத்தை** மீண்டும் பதிவேற்றவும்:`,
                actionRequired: 'upload',
                uploadPrompt: 'தெளிவான ஆதார் பதிவேற்றவும்',
                options: [
                    { label: "📷 தெளிவான ஆதார் அப்லோட்", value: "TRIGGER_FILE_UPLOAD" },
                    { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
                ]
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }

        const isFullAadhaar = isDoubleSidedCardComplete(extracted, uploadedFile.originalname || uploadedFile.path, 'aadhaar');

        if (isFullAadhaar) {
            const fullPdf = await produceCompliantDocument(uploadedFile.path);
            sess.tempUploads.headAadhaar = fullPdf;
            sess.tempUploads.headAadhaarFront = uploadedFile.path;
            sess.tempUploads.headAadhaarBack = null;
            sess.tempUploads.headAadhaarFrontBoundingBox = extracted.documentBoundingBox || null;

            sess.citizenProfile.headAadhaarDocPath = fullPdf;
            if (!sess.citizenProfile.documents) sess.citizenProfile.documents = {};
            sess.citizenProfile.documents.headAadhaar = fullPdf;

            if (extracted.fullNameEng) sess.citizenProfile.fullNameEng = extracted.fullNameEng;
            if (extracted.fullNameTam) sess.citizenProfile.fullNameTam = extracted.fullNameTam;
            applyExtractedAadhaarRelationsAndDob(sess.citizenProfile, extracted);
            if (extracted.aadhaarNumber) sess.citizenProfile.headAadhaar = extracted.aadhaarNumber;
            if (extracted.gender) {
                sess.citizenProfile.headGender = extracted.gender;
                sess.citizenProfile.headGenderTam = extracted.gender === 'Female' ? 'பெண்' : 'ஆண்';
            }
            if (extracted.doorNo) sess.citizenProfile.doorNo = extracted.doorNo;
            if (extracted.streetTam) sess.citizenProfile.streetTam = extracted.streetTam;
            if (extracted.streetEng) sess.citizenProfile.streetEng = extracted.streetEng;
            if (extracted.areaTam) sess.citizenProfile.areaTam = extracted.areaTam;
            if (extracted.areaEng) sess.citizenProfile.areaEng = extracted.areaEng;
            if (extracted.village) sess.citizenProfile.village = extracted.village;
            if (extracted.taluk) sess.citizenProfile.taluk = extracted.taluk;
            if (extracted.district) sess.citizenProfile.district = extracted.district;
            if (extracted.pincode) sess.citizenProfile.pincode = extracted.pincode;

            if (activeMobile) saveCitizenProfile(activeMobile, sess.citizenProfile);
            persistSessions();

            const flowStep = advanceFlowFn(
                sess,
                `📄 **முழு ஆதார் அட்டை (முன்பக்கம் மற்றும் முகவரி இரண்டும் உள்ள ஆவணம்) வெற்றிகரமாகக் கண்டறியப்பட்டது!**\n\n` +
                `💡 *ஒரே ஆவணத்தில் அனைத்து விவரங்களும் உள்ளதால், பின்பக்கத்தை மீண்டும் பதிவேற்றத் தேவையில்லை.* ✅`
            );
            sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }

        sess.tempUploads.headAadhaarFront = uploadedFile.path;
        sess.tempUploads.headAadhaarFrontBoundingBox = extracted.documentBoundingBox || null;
        if (extracted.fullNameEng) sess.citizenProfile.fullNameEng = extracted.fullNameEng;
        if (extracted.fullNameTam) sess.citizenProfile.fullNameTam = extracted.fullNameTam;
        applyExtractedAadhaarRelationsAndDob(sess.citizenProfile, extracted);
        if (extracted.aadhaarNumber) sess.citizenProfile.headAadhaar = extracted.aadhaarNumber;
        if (extracted.gender) {
            sess.citizenProfile.headGender = extracted.gender;
            sess.citizenProfile.headGenderTam = extracted.gender === 'Female' ? 'பெண்' : 'ஆண்';
        }
        if (!sess.citizenProfile.documents) sess.citizenProfile.documents = {};
        sess.citizenProfile.documents.headAadhaar = uploadedFile.path;
        sess.citizenProfile.headAadhaarDocPath = uploadedFile.path;

        sess.intakeState = backWaitState;
        if (activeMobile) saveCitizenProfile(activeMobile, sess.citizenProfile);
        persistSessions();

        const detectedName = sess.citizenProfile.fullNameTam
            ? `${sess.citizenProfile.fullNameTam}${sess.citizenProfile.fullNameEng ? ` (${sess.citizenProfile.fullNameEng})` : ''}`
            : (sess.citizenProfile.fullNameEng || '—');
        const aadhDisp = sess.citizenProfile.headAadhaar ? sess.citizenProfile.headAadhaar.replace(/(\d{4})/g, '$1 ').trim() : '—';

        sess.chatHistory.push({
            sender: 'bot',
            text: `✅ **விண்ணப்பதாரர் ஆதார் முன்பக்கம் பெறப்பட்டது!**\n\n` +
                  `• 👤 **பெயர்:** ${detectedName}\n` +
                  `• 🪪 **ஆதார் எண்:** ${aadhDisp}\n` +
                  `• 🎂 **பிறந்த தேதி & பாலினம்:** ${sess.citizenProfile.headDob || '—'} | ${sess.citizenProfile.headGenderTam || '—'}\n\n` +
                  `🔄 **இது அடையாள முன்பக்கம் மட்டுமே என்பதால், தந்தை/கணவர் பெயர் மற்றும் முகவரி உள்ள பின்பக்கத்தைப் (Back Side) பதிவேற்றவும்:**`,
            actionRequired: 'upload',
            uploadPrompt: 'ஆதார் பின்பக்கம் பதிவேற்றவும்',
            options: [
                { label: "📷 ஆதார் பின்பக்கம் அப்லோட்", value: "TRIGGER_FILE_UPLOAD" },
                { label: "⏭️ பின்பக்கம் தேவையில்லை — தொடர்க", value: "AADHAAR_SKIP_BACK" },
                { label: "✏️ விவரங்களைச் சரிபார் / திருத்து (Open Form)", value: "TRIGGER_EDIT_MODAL" }
            ]
        });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    return null;
}

async function handleTnegaSmartCardUploadHelper({ ctx, req, res, backWaitState, advanceFlowFn }) {
    const { text, uploadedFile, sess } = ctx;
    const activeMobile = ctx.targetMobile || sess.mobileNumber || sess.citizenProfile?.mobileNumber || storageService.getActiveMobile();
    if (!sess.citizenProfile) sess.citizenProfile = {};
    if (!sess.tempUploads) sess.tempUploads = {};
    if (!sess.citizenProfile.documents) sess.citizenProfile.documents = {};

    const syncSmartCardToProfile = async (finalPath, extracted) => {
        sess.tempUploads.smartCard = finalPath;
        sess.citizenProfile.smartCard = finalPath;
        sess.citizenProfile.rationCard = finalPath;
        sess.citizenProfile.documents.smartCard = finalPath;
        if (extracted) applyExtractedSmartCardDetails(sess.citizenProfile, extracted);
        if (activeMobile) saveCitizenProfile(activeMobile, sess.citizenProfile);
        persistSessions();
    };

    if (sess.intakeState === backWaitState) {
        if (text === 'TRIGGER_EDIT_MODAL' || (text && (text.includes('திருத்து') || text.toLowerCase().includes('edit')))) {
            return false;
        }
        if (text === 'SMARTCARD_SKIP_BACK') {
            const frontPath = sess.tempUploads.smartCardFront || sess.citizenProfile.smartCard;
            const compliantFront = frontPath ? await produceCompliantDocument(frontPath).catch(() => frontPath) : frontPath;
            if (compliantFront) await syncSmartCardToProfile(compliantFront, null);
            const flowStep = advanceFlowFn(sess, `✅ **குடும்ப ஸ்மார்ட் ரேஷன் கார்டு சேமிக்கப்பட்டது!** 🛡️`);
            sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }
        if (uploadedFile) {
            let extractedBack = null;
            try { extractedBack = await inspectAndExtractDocument(uploadedFile.path, { isTnega: true }); } catch (_) {}
            const validation = validateUploadedDocument('smartCardBack', extractedBack);
            if (!validation.valid) {
                try { if (fs.existsSync(uploadedFile.path)) fs.unlinkSync(uploadedFile.path); } catch (_) {}
                sess.chatHistory.push({
                    sender: 'bot',
                    text: validation.errorTamil,
                    options: [
                        { label: "📷 ரேஷன் கார்டு பின்பக்கம் அப்லோட்", value: "TRIGGER_FILE_UPLOAD" },
                        { label: "⏭️ பின்பக்கம் தேவையில்லை — தொடர்க", value: "SMARTCARD_SKIP_BACK" }
                    ]
                });
                res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
                return true;
            }
            sess.tempUploads.smartCardBack = uploadedFile.path;
            sess.tempUploads.smartCardBackBoundingBox = extractedBack?.documentBoundingBox || null;
            const mergedPdf = await produceDualSidedDocument(
                sess.tempUploads.smartCardFront,
                sess.tempUploads.smartCardBack,
                produceCompliantDocument,
                {
                    frontBoundingBox: sess.tempUploads.smartCardFrontBoundingBox,
                    backBoundingBox: sess.tempUploads.smartCardBackBoundingBox
                }
            );
            sess.citizenProfile.documents.smartCardFront = sess.tempUploads.smartCardFront;
            sess.citizenProfile.documents.smartCardBack = sess.tempUploads.smartCardBack;
            await syncSmartCardToProfile(mergedPdf, extractedBack);

            const mCount = Array.isArray(sess.citizenProfile.smartCardMembers) ? sess.citizenProfile.smartCardMembers.length : 0;
            const flowStep = advanceFlowFn(
                sess,
                `📄 **ஸ்மார்ட் ரேஷன் கார்டு 2-in-1 அரசு A4 PDF-ஆக இணைக்கப்பட்டது!** ✅` +
                (mCount > 0 ? `\n👨‍👩‍👧‍👦 *பின்பக்கத்தில் ${mCount} குடும்ப உறுப்பினர்கள் கண்டறியப்பட்டனர்!*` : '')
            );
            sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }
        sess.chatHistory.push({
            sender: 'bot',
            text: `🔄 தயவுசெய்து குடும்ப ஸ்மார்ட் ரேஷன் கார்டின் **பின்பக்கப் புகைப்படத்தை (Back Side — குடும்ப உறுப்பினர்கள் பட்டியல் உள்ள பக்கம்)** பதிவேற்றவும்:`,
            actionRequired: 'upload',
            uploadPrompt: 'ரேஷன் கார்டு பின்பக்கம் பதிவேற்றவும்',
            options: [
                { label: "📷 ரேஷன் கார்டு பின்பக்கம் அப்லோட்", value: "TRIGGER_FILE_UPLOAD" },
                { label: "⏭️ பின்பக்கம் தேவையில்லை — தொடர்க", value: "SMARTCARD_SKIP_BACK" }
            ]
        });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    if (uploadedFile) {
        let extracted = null;
        try { extracted = await inspectAndExtractDocument(uploadedFile.path, { isTnega: true }); } catch (_) {}

        const validation = validateUploadedDocument('smartCard', extracted);
        if (!validation.valid) {
            try { if (fs.existsSync(uploadedFile.path)) fs.unlinkSync(uploadedFile.path); } catch (_) {}
            delete sess.citizenProfile.smartCard;
            delete sess.citizenProfile.rationCard;
            delete sess.tempUploads.smartCard;
            delete sess.citizenProfile.documents.smartCard;
            persistSessions();
            sess.chatHistory.push({
                sender: 'bot',
                text: validation.errorTamil,
                options: [
                    { label: "📷 குடும்ப அட்டை (Smart Card) பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                    { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
                ]
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }

        const isFullCard = isDoubleSidedCardComplete(extracted, uploadedFile.originalname || uploadedFile.path, 'smartCard');

        if (isFullCard) {
            const fullPdf = await produceCompliantDocument(uploadedFile.path);
            sess.tempUploads.smartCardFront = uploadedFile.path;
            sess.tempUploads.smartCardBack = null;
            await syncSmartCardToProfile(fullPdf, extracted);
            const mCount = Array.isArray(sess.citizenProfile.smartCardMembers) ? sess.citizenProfile.smartCardMembers.length : 0;
            const flowStep = advanceFlowFn(
                sess,
                `✅ **முழு குடும்ப ஸ்மார்ட் ரேஷன் கார்டு வெற்றிகரமாகப் பெறப்பட்டது!** 🛡️` +
                (mCount > 0 ? `\n👨‍👩‍👧‍👦 *${mCount} குடும்ப உறுப்பினர்கள் தானாகப் படிக்கப்பட்டனர்.*` : '')
            );
            sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }

        sess.tempUploads.smartCardFront = uploadedFile.path;
        sess.tempUploads.smartCardFrontBoundingBox = extracted?.documentBoundingBox || null;
        if (extracted) applyExtractedSmartCardDetails(sess.citizenProfile, extracted);
        sess.citizenProfile.smartCard = uploadedFile.path;
        sess.citizenProfile.documents.smartCard = uploadedFile.path;
        sess.intakeState = backWaitState;
        if (activeMobile) saveCitizenProfile(activeMobile, sess.citizenProfile);
        persistSessions();

        sess.chatHistory.push({
            sender: 'bot',
            text: `✅ **ஸ்மார்ட் ரேஷன் கார்டு முன்பக்கம் பெறப்பட்டது!**` +
                  (sess.citizenProfile.smartCardNumber ? ` (எண்: **${sess.citizenProfile.smartCardNumber}**)` : '') +
                  `\n\n🔄 **குடும்ப உறுப்பினர்கள் பெயர் உள்ள பின்பக்கத்தையும் (Back Side) பதிவேற்றவும் (AI தானாக 2-in-1 PDF ஆக இணைத்து உறுப்பினர்களைக் காட்டும்):**`,
            actionRequired: 'upload',
            uploadPrompt: 'ரேஷன் கார்டு பின்பக்கம் பதிவேற்றவும்',
            options: [
                { label: "📷 ரேஷன் கார்டு பின்பக்கம் அப்லோட்", value: "TRIGGER_FILE_UPLOAD" },
                { label: "⏭️ பின்பக்கம் தேவையில்லை — தொடர்க", value: "SMARTCARD_SKIP_BACK" }
            ]
        });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    return null;
}

async function handleTnegaPassportPhotoUpload({ ctx, req, res, photoWaitState, advanceFlowFn, bannerText }) {
    const { text, uploadedFile, sess } = ctx;
    if (sess.intakeState !== photoWaitState) return false;

    if (text === 'TRIGGER_FILE_UPLOAD' || (text && text.includes('புகைப்படம் பதிவேற்றுக')) || text === 'UPLOAD_PHOTO') {
        sess.chatHistory.push({
            sender: 'bot',
            text: `📸 தயவுசெய்து விண்ணப்பதாரரின் **பாஸ்போர்ட் புகைப்படத்தை** கீழே உள்ள கோப்பு/கேமரா பொத்தானைப் பயன்படுத்திப் பதிவேற்றவும்.\n\n(அரசு போர்ட்டல் விதிகளுக்கு ஏற்ப <50KB அளவிற்கு வெள்ளை பின்னணியுடன் தானாக செப்பனிடப்படும் ✨).`,
            actionRequired: 'upload',
            uploadPrompt: 'பாஸ்போர்ட் புகைப்படம் பதிவேற்றவும்'
        });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    if (uploadedFile) {
        let extracted = null;
        try { extracted = await inspectAndExtractDocument(uploadedFile.path, { isTnega: true }); } catch (_) {}

        const isAadhaarOrCert = extracted && (
            extracted.aadhaarNumber ||
            extracted.isFullAadhaar ||
            (extracted.documentType && (extracted.documentType.includes('AADHAAR') || extracted.documentType.includes('COMMUNITY') || extracted.documentType.includes('RATION')))
        );

        if (isAadhaarOrCert) {
            try { if (fs.existsSync(uploadedFile.path)) fs.unlinkSync(uploadedFile.path); } catch (_) {}
            sess.chatHistory.push({
                sender: 'bot',
                text: `⚠️ **ஆதார் அட்டை / அரசு ஆவணம் கண்டறியப்பட்டது:**\n\n` +
                      `அரசு விதிப்படி விண்ணப்பத்திற்கு விண்ணப்பதாரரின் **நேரடி பாஸ்போர்ட் அளவிலான புகைப்படம்** மட்டுமே ஏற்கப்படும். ஆதார் அட்டையிலிருந்து படம் வெட்டப்பட மாட்டாது (Zero-Cropping Law).\n\n` +
                      `தயவுசெய்து விண்ணப்பதாரரின் நேரடி பாஸ்போர்ட் புகைப்படத்தைப் பதிவேற்றவும் (அல்லது செல்ஃபி எடுக்கவும்):`,
                actionRequired: 'upload',
                uploadPrompt: 'நேரடி பாஸ்போர்ட் புகைப்படம் பதிவேற்றவும்'
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }

        if (extracted && extracted.isQualityAcceptable === false) {
            sess.chatHistory.push({
                sender: 'bot',
                text: `⚠️ **புகைப்படம் தெளிவாக இல்லை:**\n\n${extracted.feedbackTamil || 'மங்கலாக உள்ளது.'}\n\nதயவுசெய்து தெளிவான பாஸ்போர்ட் புகைப்படத்தை மீண்டும் பதிவேற்றவும்:`,
                actionRequired: 'upload',
                uploadPrompt: 'தெளிவான பாஸ்போர்ட் புகைப்படம் பதிவேற்றவும்'
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }

        const studioPhoto = await produceCompliantPassportPhoto(uploadedFile.path, {
            faceBoundingBox: extracted?.faceBoundingBox
        });
        sess.citizenProfile.headPhotoPath = studioPhoto;
        if (!sess.citizenProfile.documents) sess.citizenProfile.documents = {};
        sess.citizenProfile.documents.profilePhoto = studioPhoto;
        if (!sess.tempUploads) sess.tempUploads = {};
        sess.tempUploads.profilePhoto = studioPhoto;

        const activeMobile = ctx.targetMobile || sess.mobileNumber || sess.citizenProfile?.mobileNumber || storageService.getActiveMobile();
        if (activeMobile) {
            saveCitizenProfile(activeMobile, sess.citizenProfile);
            const { saveCitizenDraft } = require('../../firestore_db');
            saveCitizenDraft(activeMobile, {
                operatorUid: sess.operatorUid || null,
                operatorName: sess.operatorName || null,
                operatorMobile: sess.operatorMobile || null,
                citizenProfile: sess.citizenProfile,
                documents: sess.citizenProfile.documents || {},
                tempUploads: sess.tempUploads || {},
                intakeState: sess.intakeState,
                step: sess.step,
                chatHistory: sess.chatHistory
            }).catch(() => {});
        }
        persistSessions();

        const flowStep = advanceFlowFn(
            sess,
            bannerText || `✨ **ஏஐ போட்டோ ஸ்டுடியோ:** விண்ணப்பதாரர் பாஸ்போர்ட் புகைப்படம் அரசு விதிகளுக்கு ஏற்ப (<50KB) தயார் செய்யப்பட்டு சேமிக்கப்பட்டது! 📸`
        );
        sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    return false;
}

async function handleCanActionsForCartridge({ ctx, req, res, advanceFlowFn, isFirstGraduate = false }) {
    const { text, sess } = ctx;

    if (text === 'CAN_DIRECT_INPUT' || text === 'என்னிடம் CAN உள்ளது' || text === 'CAN_DIRECT') {
        sess.intakeState = 'CAN_DIRECT_INPUT_WAIT';
        persistSessions();
        sess.chatHistory.push({
            sender: 'bot',
            text: `🔢 **உங்களுடைய 13-இலக்க TNeGA CAN எண்ணை உள்ளிடவும்:**\n\n(எடுத்துக்காட்டு: 1330109988771)`
        });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState });
        return true;
    }

    if (sess.intakeState === 'CAN_DIRECT_INPUT_WAIT' && text && !text.startsWith('TRIGGER_')) {
        const matchedCan = (text || '').match(/\b(13\d{11,13}|\d{13,15})\b/);
        if (matchedCan) {
            sess.citizenProfile.canNumber = matchedCan[1];
            persistSessions();
            const flowStep = advanceFlowFn(sess, `✅ CAN எண் **${matchedCan[1]}** வெற்றிகரமாகப் பொருத்தப்பட்டது! 🛡️`);
            sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        } else {
            sess.chatHistory.push({
                sender: 'bot',
                text: `⚠️ CAN எண் சரியாக 13 அல்லது 15 இலக்கங்களைக் கொண்டிருக்க வேண்டும் (எ.கா: 1330109988771 அல்லது 133370337878397). தயவுசெய்து மீண்டும் உள்ளிடவும்:`
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }
    }

    if (text === 'CAN_SEARCH_PROMPT' || text === 'TRIGGER_CAN_SEARCH' || (sess.intakeState === 'CAN_SEARCH_INTAKE' && text === 'CAN_SEARCH_OTHER')) {
        sess.intakeState = 'CAN_SEARCH_INTAKE';
        persistSessions();
        const mob = sess.citizenProfile?.mobileNumber || sess.mobileNumber || '';
        const aadh = sess.citizenProfile?.headAadhaar || sess.citizenProfile?.aadhaar || '';
        const aadhDisp = aadh ? aadh.replace(/(\d{4})/g, '$1 ').trim() : '—';

        if (mob || aadh) {
            sess.chatHistory.push({
                sender: 'bot',
                text: `🔍 **TNeGA CAN எண் தேடல் (CAN Number Search)**\n\n` +
                      (mob ? `• 📱 **பதிவு செய்யப்பட்ட கைபேசி எண்:** +91 ${mob}\n` : '') +
                      (aadh ? `• 🪪 **ஆதார் எண்:** ${aadhDisp}\n` : '') +
                      `\nஇந்த விவரங்களைக் கொண்டு TNeGA போர்ட்டலில் CAN எண் தேடலாமா?`,
                options: [
                    { label: "🔍 இப்போது CAN எண் தேடு (Search Now)", value: "START_CAN_SEARCH" },
                    { label: "📝 புதிய CAN பதிவு செய் (Register New CAN)", value: "CAN_REGISTER_PROMPT" },
                    { label: "🔢 என்னிடம் CAN எண் உள்ளது", value: "CAN_DIRECT_INPUT" }
                ]
            });
        } else {
            sess.chatHistory.push({
                sender: 'bot',
                text: `🔍 CAN எண் தேட, விண்ணப்பதாரரின் 10-இலக்க கைபேசி எண் அல்லது 12-இலக்க ஆதார் எண்ணை உள்ளிடவும்:`
            });
        }
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    if (text === 'START_CAN_SEARCH' || (sess.intakeState === 'CAN_SEARCH_INTAKE' && text && (text.match(/^\d{10}$/) || text.match(/^\d{12}$/)))) {
        if (text.match(/^\d{10}$/)) sess.citizenProfile.mobileNumber = text;
        if (text.match(/^\d{12}$/)) sess.citizenProfile.headAadhaar = text;
        persistSessions();

        const mob = sess.citizenProfile?.mobileNumber || sess.mobileNumber || '';
        const aadh = sess.citizenProfile?.headAadhaar || sess.citizenProfile?.aadhaar || '';
        sess.chatHistory.push({
            sender: 'bot',
            text: `🔍 போர்ட்டலில் CAN எண் தேடப்படுகிறது (+91 ${mob || '—'}, ஆதார்: ${aadh || '—'})...`
        });

        const isRegressionEnv = process.env.NODE_ENV === 'test' || process.env.REGRESSION_TEST === 'true' || req.headers['x-operator-uid'] === 'test_suite_operator_uid' || req.headers['x-dev-mode'] === 'true';
        const p = sess.citizenProfile || {};
        const searchRes = await searchCitizenCan(
            { aadhaar: aadh, mobile: mob, applicantName: p.fullNameEng || p.headNameEng || '' },
            () => {},
            { isMockSandbox: isRegressionEnv, operatorUid: sess.operatorUid || req.headers['x-operator-uid'] || 'admin' }
        );
        if (searchRes && searchRes.found && searchRes.canNumber) {
            sess.citizenProfile.canNumber = searchRes.canNumber;
            persistSessions();
            const familyListText = (searchRes.records && searchRes.records.length > 1)
                ? `\n\n📋 **இந்த மொபைல் எண்ணில் உள்ள அனைத்து குடும்ப CAN எண்கள்:**\n` +
                  searchRes.records.map((r, idx) => `${idx + 1}. **${r.canNumber}** — ${r.name} (தந்தை/கணவர்: ${r.fatherName})`).join('\n')
                : '';
            const canFoundBanner =
                `🎉 **${isFirstGraduate ? 'மாணவரின்' : 'வாடிக்கையாளரின்'} CAN எண் கண்டறியப்பட்டது!**\n\n` +
                `• 🔢 **CAN எண்:** **${searchRes.canNumber}** ✅\n` +
                `• 👤 **பெயர்:** ${searchRes.citizenName || p.fullNameTam || '—'}\n` +
                `• 👨 **தந்தை/கணவர்:** ${searchRes.fatherName || p.fatherNameTam || '—'}\n` +
                `• 🏛️ **வட்டம் & மாவட்டம்:** ${searchRes.taluk || p.taluk || ''}, ${searchRes.district || p.district || ''}` +
                familyListText;
            const flowStep = advanceFlowFn(sess, canFoundBanner);
            sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
        } else {
            sess.chatHistory.push({
                sender: 'bot',
                text: `⚠️ இந்த விவரங்களில் TNeGA போர்ட்டலில் CAN எண் எதுவும் பதிவு செய்யப்படவில்லை.\n\nஉடனடியாக புதிய 13-இலக்க CAN எண்ணைப் பதிவு செய்யலாமா?`,
                options: [
                    { label: "📝 புதிய CAN பதிவு செய் (Register New CAN)", value: "CAN_REGISTER_PROMPT" },
                    { label: "🔢 என்னிடம் CAN எண் உள்ளது (Direct Input)", value: "CAN_DIRECT_INPUT" }
                ]
            });
        }
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    return false;
}

function handleMemberSelectForCartridge({ ctx, req, res, resetIntakeState, advanceFlowFn, bannerSuffix = 'தேர்ந்தெடுக்கப்பட்டார்! அவரது விவரங்கள் தானாகப் பொருத்தப்பட்டுவிட்டன.' }) {
    const { text, sess } = ctx;
    if (!text) return false;
    const members = sess.citizenProfile?.members || [];
    let idx = -1;
    if (text.startsWith('SELECT_MEMBER_')) {
        idx = parseInt(text.replace('SELECT_MEMBER_', ''), 10);
    } else if (sess.intakeState && sess.intakeState.endsWith('_INTAKE') && members.some(m => (m.nameTam && text.includes(m.nameTam)) || (m.nameEng && text.includes(m.nameEng)))) {
        idx = members.findIndex(m => (m.nameTam && text.includes(m.nameTam)) || (m.nameEng && text.includes(m.nameEng)));
    }
    if (idx < 0 || !members[idx]) return false;

    const selectedMem = members[idx];
    sess.selectedMember = selectedMem;
    if (selectedMem.nameEng) sess.citizenProfile.fullNameEng = selectedMem.nameEng;
    if (selectedMem.nameTam) sess.citizenProfile.fullNameTam = selectedMem.nameTam;
    if (selectedMem.fatherNameEng) sess.citizenProfile.fatherNameEng = selectedMem.fatherNameEng;
    if (selectedMem.fatherNameTam) sess.citizenProfile.fatherNameTam = selectedMem.fatherNameTam;
    if (selectedMem.aadhaarNumber || selectedMem.aadhaar) sess.citizenProfile.headAadhaar = selectedMem.aadhaarNumber || selectedMem.aadhaar;
    if (selectedMem.dob) sess.citizenProfile.headDob = selectedMem.dob;
    if (selectedMem.gender) {
        sess.citizenProfile.headGender = selectedMem.gender;
        sess.citizenProfile.headGenderTam = selectedMem.genderTam || (selectedMem.gender === 'Female' ? 'பெண்' : 'ஆண்');
    }
    if (selectedMem.canNumber) {
        sess.citizenProfile.canNumber = selectedMem.canNumber;
    }
    sess.intakeState = resetIntakeState;
    persistSessions();

    const flowStep = advanceFlowFn(sess, `✅ உறுப்பினர் **${selectedMem.nameTam || selectedMem.nameEng}** ${bannerSuffix}`);
    sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
    res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
    return true;
}

function blockChatStartMissingDoc({ sess, res, nextState, text, uploadLabel, formLabel = '✏️ விவரங்களைச் சரிபார் / திருத்து (Open Form)', extraJson = { blocked: true } }) {
    sess.intakeState = nextState;
    persistSessions();
    sess.chatHistory.push({
        sender: 'bot',
        text,
        options: [
            { label: uploadLabel, value: "TRIGGER_FILE_UPLOAD" },
            { label: formLabel, value: "TRIGGER_EDIT_MODAL" }
        ]
    });
    res.json({
        chatHistory: sess.chatHistory,
        citizenProfile: sess.citizenProfile,
        step: sess.intakeState,
        intakeState: sess.intakeState,
        ...extraJson
    });
    return true;
}

function launchCartridgeChatTask({ sess, res, runAutomationTask, runner, payload, targetMob, isMockTest, isAddMemberAction = false, isChangeAddressAction = false, req, bannerText, stepOverride, extraJson = {} }) {
    sess.chatHistory.push({ sender: 'bot', text: bannerText });
    sess.isAutomating = true;
    sess.isAutomationRunning = true;
    sess.automationStep = stepOverride ?? 1;
    persistSessions();

    runAutomationTask(runner, payload, sess, targetMob, isMockTest, isAddMemberAction, isChangeAddressAction, req);

    res.json({
        chatHistory: sess.chatHistory,
        citizenProfile: sess.citizenProfile,
        step: sess.intakeState,
        isAutomating: true,
        ...extraJson
    });
    return true;
}

module.exports = {
    isPhysicalDocValid,
    hasValidSmartCard,
    buildSmartCardPromptStep,
    handleTnegaAadhaarUploadHelper,
    handleTnegaSmartCardUploadHelper,
    handleTnegaPassportPhotoUpload,
    handleCanActionsForCartridge,
    handleMemberSelectForCartridge,
    blockChatStartMissingDoc,
    launchCartridgeChatTask
};
