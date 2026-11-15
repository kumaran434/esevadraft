const storageService = require('../../services/storage_service');
const { inspectAndExtractDocument } = require('../../../ai_document_extractor');
const { evaluateServiceChecklist } = require('../../core/services_registry');
const { searchCitizenCan, registerNewCan } = require('../../../tnega_can_automation');
const { advanceTnegaIncomeFlow, advanceTnegaCanRegisterFlow, advanceTnegaResidenceFlow, advanceTnegaCommunityFlow } = require('../../core/fsm/tnega_flow_engine');
const { ensureBilingualPair } = require('../../utils/bilingual_helper');
const { produceCompliantDocument, produceDualSidedDocument } = require('../../../photo_studio');
const { saveCitizenProfile } = require('../../../database');
const { persistSessions } = storageService;

async function handleTnegaIntake(ctx, req, res) {
    const { text, uploadedFile, sess } = ctx;

    // -------------------------------------------------------------------------
    // CAN DIRECT INPUT / SEARCH / REGISTRATION GATEWAY
    // -------------------------------------------------------------------------
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
            const isCommunityFlow = sess.subService === 'COMMUNITY' || (sess.intakeState && sess.intakeState.startsWith('COMMUNITY'));
            const isResidenceFlow = sess.subService === 'RESIDENCE' || (sess.intakeState && sess.intakeState.startsWith('RESIDENCE'));
            const flowStep = isCommunityFlow
                ? advanceTnegaCommunityFlow(sess, `✅ CAN எண் **${matchedCan[1]}** வெற்றிகரமாகப் பொருத்தப்பட்டது! 🛡️`)
                : (isResidenceFlow
                    ? advanceTnegaResidenceFlow(sess, `✅ CAN எண் **${matchedCan[1]}** வெற்றிகரமாகப் பொருத்தப்பட்டது! 🛡️`)
                    : advanceTnegaIncomeFlow(sess, `✅ CAN எண் **${matchedCan[1]}** வெற்றிகரமாகப் பொருத்தப்பட்டது! 🛡️`));
            sess.chatHistory.push({
                sender: 'bot',
                text: flowStep.text,
                options: flowStep.options
            });
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

    if (text === 'CAN_SEARCH_PROMPT' || (sess.intakeState === 'CAN_SEARCH_INTAKE' && text === 'CAN_SEARCH_OTHER')) {
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
            {
                aadhaar: aadh,
                mobile: mob,
                applicantName: p.fullNameEng || p.headNameEng || ''
            },
            (m) => {},
            { isMockSandbox: isRegressionEnv, operatorUid: sess.operatorUid || req.headers['x-operator-uid'] || 'admin' }
        );
        if (searchRes && searchRes.found && searchRes.canNumber) {
            sess.citizenProfile.canNumber = searchRes.canNumber;
            persistSessions();
            const familyListText = (searchRes.records && searchRes.records.length > 1)
                ? `\n\n📋 **இந்த மொபைல் எண்ணில் உள்ள அனைத்து குடும்ப CAN எண்கள்:**\n` +
                  searchRes.records.map((r, idx) => `${idx + 1}. **${r.canNumber}** — ${r.name} (தந்தை/கணவர்: ${r.fatherName})`).join('\n')
                : '';
            const isCommunityFlow = sess.subService === 'COMMUNITY' || (sess.intakeState && sess.intakeState.startsWith('COMMUNITY'));
            const isResidenceFlow = sess.subService === 'RESIDENCE' || (sess.intakeState && sess.intakeState.startsWith('RESIDENCE'));
            const flowStep = isCommunityFlow
                ? advanceTnegaCommunityFlow(
                    sess,
                    `🎉 **வாடிக்கையாளரின் CAN எண் கண்டறியப்பட்டது!**\n\n` +
                    `• 🔢 **CAN எண்:** **${searchRes.canNumber}** ✅\n` +
                    `• 👤 **பெயர்:** ${searchRes.citizenName || p.fullNameTam || '—'}\n` +
                    `• 👨 **தந்தை/கணவர்:** ${searchRes.fatherName || p.fatherNameTam || '—'}\n` +
                    `• 🏛️ **வட்டம் & மாவட்டம்:** ${searchRes.taluk || p.taluk || ''}, ${searchRes.district || p.district || ''}` +
                    familyListText
                )
                : (isResidenceFlow
                    ? advanceTnegaResidenceFlow(
                        sess,
                        `🎉 **வாடிக்கையாளரின் CAN எண் கண்டறியப்பட்டது!**\n\n` +
                        `• 🔢 **CAN எண்:** **${searchRes.canNumber}** ✅\n` +
                        `• 👤 **பெயர்:** ${searchRes.citizenName || p.fullNameTam || '—'}\n` +
                        `• 👨 **தந்தை/கணவர்:** ${searchRes.fatherName || p.fatherNameTam || '—'}\n` +
                        `• 🏛️ **வட்டம் & மாவட்டம்:** ${searchRes.taluk || p.taluk || ''}, ${searchRes.district || p.district || ''}` +
                        familyListText
                    )
                    : advanceTnegaIncomeFlow(
                        sess,
                        `🎉 **வாடிக்கையாளரின் CAN எண் கண்டறியப்பட்டது!**\n\n` +
                        `• 🔢 **CAN எண்:** **${searchRes.canNumber}** ✅\n` +
                        `• 👤 **பெயர்:** ${searchRes.citizenName || p.fullNameTam || '—'}\n` +
                        `• 👨 **தந்தை/கணவர்:** ${searchRes.fatherName || p.fatherNameTam || '—'}\n` +
                        `• 🏛️ **வட்டம் & மாவட்டம்:** ${searchRes.taluk || p.taluk || ''}, ${searchRes.district || p.district || ''}` +
                        familyListText
                    ));
            sess.chatHistory.push({
                sender: 'bot',
                text: flowStep.text,
                options: flowStep.options
            });
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

async function handleTnegaAadhaarUploadHelper({ ctx, req, res, backWaitState, advanceFlowFn }) {
    const { text, uploadedFile, sess } = ctx;
    const activeMobile = ctx.targetMobile || sess.mobileNumber || sess.citizenProfile?.mobileNumber || storageService.getActiveMobile();
    if (!sess.citizenProfile) sess.citizenProfile = {};
    if (!sess.tempUploads) sess.tempUploads = {};

    // -------------------------------------------------------------------------
    // Case 1: Currently waiting for Aadhaar Back Side
    // -------------------------------------------------------------------------
    if (sess.intakeState === backWaitState) {
        if (uploadedFile) {
            sess.tempUploads.headAadhaarBack = uploadedFile.path;
            let extractedBack = null;
            try {
                extractedBack = await inspectAndExtractDocument(uploadedFile.path, { skipFaceExtraction: true });
            } catch (_) {}

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
                if (extracted.fatherNameEng) sess.citizenProfile.fatherNameEng = extracted.fatherNameEng;
                if (extracted.fatherNameTam) sess.citizenProfile.fatherNameTam = extracted.fatherNameTam;
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
            sess.chatHistory.push({
                sender: 'bot',
                text: flowStep.text,
                options: flowStep.options
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }

        if (text === 'TRIGGER_EDIT_MODAL' || text.includes('திருத்து') || text.toLowerCase().includes('edit')) {
            return false;
        }

        sess.chatHistory.push({
            sender: 'bot',
            text: `🔄 தயவுசெய்து விண்ணப்பதாரரின் ஆதார் அட்டையின் **பின்பக்கப் புகைப்படத்தைப் (Back Side)** பதிவேற்றவும்.`,
            actionRequired: 'upload',
            uploadPrompt: 'ஆதார் பின்பக்கம் பதிவேற்றவும்',
            options: [
                { label: "📷 ஆதார் பின்பக்கம் அப்லோட்", value: "TRIGGER_FILE_UPLOAD" },
                { label: "✏️ விவரங்களைச் சரிபார் / திருத்து (Open Form)", value: "TRIGGER_EDIT_MODAL" }
            ]
        });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    // -------------------------------------------------------------------------
    // Case 2: Document uploaded (Full Sheet vs Front Card)
    // -------------------------------------------------------------------------
    if (uploadedFile) {
        const extracted = await inspectAndExtractDocument(uploadedFile.path);

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

        const hasAddress = !!(extracted.hasAddress || (extracted.doorNo && extracted.pincode) || (extracted.streetTam || extracted.streetEng));
        const isFullAadhaar = !!(extracted.isFullAadhaar || extracted.documentType === 'AADHAAR_FULL' || (hasAddress && (extracted.fullNameEng || extracted.fullNameTam || extracted.aadhaarNumber)));

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
            if (extracted.fatherNameEng) sess.citizenProfile.fatherNameEng = extracted.fatherNameEng;
            if (extracted.fatherNameTam) sess.citizenProfile.fatherNameTam = extracted.fatherNameTam;
            if (extracted.aadhaarNumber) sess.citizenProfile.headAadhaar = extracted.aadhaarNumber;
            if (extracted.dob) sess.citizenProfile.headDob = extracted.dob;
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
            sess.chatHistory.push({
                sender: 'bot',
                text: flowStep.text,
                options: flowStep.options
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }

        // Card front only
        sess.tempUploads.headAadhaarFront = uploadedFile.path;
        sess.tempUploads.headAadhaarFrontBoundingBox = extracted.documentBoundingBox || null;
        if (extracted.fullNameEng) sess.citizenProfile.fullNameEng = extracted.fullNameEng;
        if (extracted.fullNameTam) sess.citizenProfile.fullNameTam = extracted.fullNameTam;
        if (extracted.aadhaarNumber) sess.citizenProfile.headAadhaar = extracted.aadhaarNumber;
        if (extracted.dob) sess.citizenProfile.headDob = extracted.dob;
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
                { label: "✏️ விவரங்களைச் சரிபார் / திருத்து (Open Form)", value: "TRIGGER_EDIT_MODAL" }
            ]
        });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    return null;
}

    if (text === 'CAN_REGISTER_PROMPT' || text === 'START_CAN_REGISTER' || sess.intakeState === 'CAN_REGISTER_INTAKE' || sess.intakeState === 'CAN_AADHAAR_BACK_WAIT' || sess.intakeState === 'CAN_MOTHER_NAME_WAIT' || sess.intakeState === 'CAN_COMMUNITY_WAIT') {
        const activeMobile = ctx.targetMobile || sess.mobileNumber || sess.citizenProfile?.mobileNumber || storageService.getActiveMobile();

        // Preserve parent certificate goal if transitioning from Community, Residence, or Income
        if (!sess.targetService) {
            if (sess.subService && sess.subService !== 'CAN_REGISTER' && sess.subService !== 'CAN_SEARCH') {
                sess.targetService = sess.subService;
            } else if (sess.intakeState && sess.intakeState.includes('COMMUNITY')) {
                sess.targetService = 'COMMUNITY';
            } else if (sess.intakeState && sess.intakeState.includes('RESIDENCE')) {
                sess.targetService = 'RESIDENCE';
            } else if (sess.intakeState && sess.intakeState.includes('INCOME')) {
                sess.targetService = 'INCOME';
            }
        }
        if (sess.citizenProfile) {
            sess.citizenProfile.targetService = sess.targetService || sess.citizenProfile.targetService;
        }

        if (text === 'START_CAN_REGISTER') {
            sess.intakeState = 'READY_TO_APPLY_CAN';
            sess.subService = 'CAN_REGISTER';
            if (sess.citizenProfile) {
                sess.citizenProfile.subService = 'CAN_REGISTER';
                sess.citizenProfile.targetService = sess.targetService || sess.citizenProfile.targetService;
            }
            persistSessions();
            const p = sess.citizenProfile || {};
            const mob = p.mobileNumber || sess.mobileNumber || '';
            const nameTam = p.fullNameTam || p.headNameTam || '';
            const nameEng = p.fullNameEng || p.headNameEng || '';
            const aadh = p.headAadhaar || p.aadhaar || '';
            const aadhDisp = aadh ? aadh.replace(/(\d{4})/g, '$1 ').trim() : '—';
            const targetNameTam = sess.targetService === 'COMMUNITY' ? 'சாதிச் சான்றிதழ்' : (sess.targetService === 'RESIDENCE' ? 'இருப்பிடச் சான்றிதழ்' : (sess.targetService === 'INCOME' ? 'வருமானச் சான்றிதழ்' : 'CAN பதிவு'));
            sess.chatHistory.push({
                sender: 'bot',
                text: `📋 **விண்ணப்ப விவரங்களை ஒருமுறை சரிபார்க்கவும்:** 🛡️\n\n` +
                      `அரசு TNeGA போர்ட்டலில் ${targetNameTam} ஆட்டோமேஷன் தொடங்குவதற்கு முன், அனைத்து விவரங்களையும் (பெயர், முகவரி, ஆவணங்கள்) ஒருமுறை சரிபார்த்து உறுதிப்படுத்த **'விவரங்களைச் சரிபார்' (Edit / Review)** சாளரம் திறக்கப்பட்டுள்ளது.\n\n` +
                      (sess.targetService ? `💡 **முதன்மை இலக்கு:** போர்ட்டலில் CAN எண் உள்ளதா என முதலில் சரிபார்க்கப்பட்டு, CAN இருப்பின் நேரடியாக **${targetNameTam}** விண்ணப்பப் படிவத்திற்குச் செல்லும்!\n\n` : '') +
                      `• விண்ணப்பதாரர்: ${nameTam || nameEng}\n` +
                      `• கைபேசி: +91 ${mob}\n` +
                      `• ஆதார்: ${aadhDisp}\n\n` +
                      `சாளரத்தில் விவரங்கள் சரியாக உள்ளதா எனப் பார்த்துவிட்டு, அதில் உள்ள **'🚀 ஆட்டோமேஷன் தொடங்கு'** பொத்தானை அழுத்தவும்:`,
                actionRequired: 'open_edit_modal',
                options: [
                    { label: `🚀 ${targetNameTam} ஆட்டோமேஷன் தொடங்கு`, value: "LAUNCH_CAN_AUTOMATION" },
                    { label: "✏️ விவரங்களை மாற்று (Edit Details)", value: "TRIGGER_EDIT_MODAL" }
                ]
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState, actionRequired: 'open_edit_modal' });
            return true;
        }

        if (uploadedFile || sess.intakeState === 'CAN_AADHAAR_BACK_WAIT') {
            const handled = await handleTnegaAadhaarUploadHelper({
                ctx,
                req,
                res,
                backWaitState: 'CAN_AADHAAR_BACK_WAIT',
                advanceFlowFn: advanceTnegaCanRegisterFlow
            });
            if (handled) return true;
        }

        // Intake capture for text entries (e.g. Mother's Name)
        if (sess.intakeState === 'CAN_MOTHER_NAME_WAIT' && text && !text.startsWith('CAN_') && !text.startsWith('START_') && !text.startsWith('TRIGGER_') && !text.startsWith('LAUNCH_')) {
            const { eng, tam } = ensureBilingualPair(text.trim(), text.trim());
            sess.citizenProfile.motherNameEng = eng;
            sess.citizenProfile.motherNameTam = tam;
        }
        if (sess.intakeState === 'CAN_COMMUNITY_WAIT' && text && text.startsWith('COMMUNITY_')) {
            let comm = text.replace('COMMUNITY_', '');
            sess.citizenProfile.community = comm;
        }
        if (activeMobile) saveCitizenProfile(activeMobile, sess.citizenProfile);
        persistSessions();

        const flowStep = advanceTnegaCanRegisterFlow(sess);
        sess.chatHistory.push({
            sender: 'bot',
            text: flowStep.text,
            options: flowStep.options
        });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    // FAMILY MEMBER SELECTION (Delta Profile Reuse across Services)
    if (text && (text.startsWith('SELECT_MEMBER_') || (sess.intakeState === 'INCOME_INTAKE' && sess.citizenProfile?.members?.some((m, i) => text.includes(m.nameTam || '') || (m.nameEng && text.includes(m.nameEng)))))) {
        const members = sess.citizenProfile?.members || [];
        let idx = -1;
        if (text.startsWith('SELECT_MEMBER_')) {
            idx = parseInt(text.replace('SELECT_MEMBER_', ''), 10);
        } else {
            idx = members.findIndex(m => (m.nameTam && text.includes(m.nameTam)) || (m.nameEng && text.includes(m.nameEng)));
        }

        if (idx >= 0 && members[idx]) {
            const selectedMem = members[idx];
            sess.selectedMember = selectedMem;
            if (selectedMem.nameEng) sess.citizenProfile.fullNameEng = selectedMem.nameEng;
            if (selectedMem.nameTam) sess.citizenProfile.fullNameTam = selectedMem.nameTam;
            if (selectedMem.fatherNameEng) sess.citizenProfile.fatherNameEng = selectedMem.fatherNameEng;
            if (selectedMem.fatherNameTam) sess.citizenProfile.fatherNameTam = selectedMem.fatherNameTam;
            if (selectedMem.aadhaarNumber) sess.citizenProfile.headAadhaar = selectedMem.aadhaarNumber;
            if (selectedMem.dob) sess.citizenProfile.headDob = selectedMem.dob;
            if (selectedMem.gender) {
                sess.citizenProfile.headGender = selectedMem.gender;
                sess.citizenProfile.headGenderTam = selectedMem.genderTam || (selectedMem.gender === 'Female' ? 'பெண்' : 'ஆண்');
            }
            if (selectedMem.canNumber) {
                sess.citizenProfile.canNumber = selectedMem.canNumber;
            }
            const isCommunityFlow = sess.subService === 'COMMUNITY' || (sess.intakeState && sess.intakeState.startsWith('COMMUNITY'));
            const isResidenceFlow = sess.subService === 'RESIDENCE' || (sess.intakeState && sess.intakeState.startsWith('RESIDENCE'));
            sess.intakeState = isCommunityFlow ? 'COMMUNITY_INTAKE' : (isResidenceFlow ? 'RESIDENCE_INTAKE' : 'INCOME_INTAKE');
            persistSessions();

            const flowStep = isCommunityFlow
                ? advanceTnegaCommunityFlow(sess, `✅ உறுப்பினர் **${selectedMem.nameTam || selectedMem.nameEng}** தேர்ந்தெடுக்கப்பட்டார்! அவரது விவரங்கள் தானாகப் பொருத்தப்பட்டுவிட்டன.`)
                : (isResidenceFlow
                    ? advanceTnegaResidenceFlow(sess, `✅ உறுப்பினர் **${selectedMem.nameTam || selectedMem.nameEng}** தேர்ந்தெடுக்கப்பட்டார்! அவரது விவரங்கள் தானாகப் பொருத்தப்பட்டுவிட்டன.`)
                    : advanceTnegaIncomeFlow(sess, `✅ உறுப்பினர் **${selectedMem.nameTam || selectedMem.nameEng}** தேர்ந்தெடுக்கப்பட்டார்! அவரது ஆதார் மற்றும் குடும்ப முகவரி விவரங்கள் தானாகப் பொருத்தப்பட்டுவிட்டன.`));
            sess.chatHistory.push({
                sender: 'bot',
                text: flowStep.text,
                options: flowStep.options
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }
    }

    // -------------------------------------------------------------------------
    // MOTHER'S NAME INTAKE GATE (TNeGA Mandatory Field)
    // -------------------------------------------------------------------------
    if ((sess.intakeState === 'COMMUNITY_MOTHER_NAME_WAIT' || sess.intakeState === 'INCOME_MOTHER_NAME_WAIT') && text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
        const { eng, tam } = ensureBilingualPair(text.trim(), text.trim());
        sess.citizenProfile.motherNameEng = eng;
        sess.citizenProfile.motherNameTam = tam;
        persistSessions();

        const p = sess.citizenProfile;
        const isCommunityFlow = sess.subService === 'COMMUNITY' || (sess.intakeState && sess.intakeState.startsWith('COMMUNITY'));
        const flowStep = isCommunityFlow
            ? advanceTnegaCommunityFlow(sess, `✅ தாயின் பெயர் **${p.motherNameTam || p.motherNameEng}** எனப் பதிவானது!`)
            : advanceTnegaIncomeFlow(sess, `✅ தாயின் பெயர் **${p.motherNameTam || p.motherNameEng}** எனப் பதிவானது!`);
        sess.chatHistory.push({
            sender: 'bot',
            text: flowStep.text,
            options: flowStep.options
        });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    // -------------------------------------------------------------------------
    // RELIGION INTAKE GATE (TNeGA Community Certificate REV-101)
    // -------------------------------------------------------------------------
    if ((sess.intakeState === 'COMMUNITY_RELIGION_WAIT' || (sess.subService === 'COMMUNITY' && (text.startsWith('RELIGION_') || text.includes('இந்து') || text.includes('இஸ்லாம்') || text.includes('கிறிஸ்தவ')))) && text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
        let rel = 'Hindu';
        if (text.includes('HINDU') || text.includes('இந்து')) rel = 'Hindu';
        else if (text.includes('MUSLIM') || text.includes('இஸ்லாம்')) rel = 'Muslim';
        else if (text.includes('CHRISTIAN') || text.includes('கிறிஸ்தவ')) rel = 'Christian';
        else if (text.includes('SIKH') || text.includes('சீக்கிய')) rel = 'Sikh';
        else if (text.includes('JAIN') || text.includes('சமண')) rel = 'Jain';
        else rel = text.replace('RELIGION_', '');

        sess.citizenProfile.religion = rel;
        persistSessions();

        const flowStep = advanceTnegaCommunityFlow(sess, `✅ மதம் **${rel}** எனப் பதிவானது!`);
        sess.chatHistory.push({
            sender: 'bot',
            text: flowStep.text,
            options: flowStep.options
        });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    // -------------------------------------------------------------------------
    // COMMUNITY / CASTE INTAKE GATE (TNeGA Mandatory Field)
    // -------------------------------------------------------------------------
    if ((sess.intakeState === 'COMMUNITY_COMM_WAIT' || sess.intakeState === 'INCOME_COMMUNITY_WAIT' || text.startsWith('COMMUNITY_')) && text && sess.subService !== 'CAN_REGISTER') {
        let comm = 'MBC';
        if (text.includes('MBC') || text === 'COMMUNITY_MBC') comm = 'MBC';
        else if (text.includes('BCM') || text === 'COMMUNITY_BCM') comm = 'BCM';
        else if (text.includes('BC') || text === 'COMMUNITY_BC') comm = 'BC';
        else if (text.includes('SC') || text === 'COMMUNITY_SC') comm = 'SC';
        else if (text.includes('ST') || text === 'COMMUNITY_ST') comm = 'ST';
        else if (text.includes('OC') || text === 'COMMUNITY_OC') comm = 'OC';

        sess.citizenProfile.community = comm;
        persistSessions();

        const isCommunityFlow = sess.subService === 'COMMUNITY' || (sess.intakeState && sess.intakeState.startsWith('COMMUNITY'));
        const flowStep = isCommunityFlow
            ? advanceTnegaCommunityFlow(sess, `✅ வகுப்பு / பிரிவு **${comm}** எனப் பதிவானது!`)
            : advanceTnegaIncomeFlow(sess, `✅ வகுப்பு / பிரிவு **${comm}** எனப் பதிவானது!`);
        sess.chatHistory.push({
            sender: 'bot',
            text: flowStep.text,
            options: flowStep.options
        });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    // -------------------------------------------------------------------------
    // CASTE / SUB-CASTE INTAKE GATE (TNeGA REV-101)
    // -------------------------------------------------------------------------
    if ((sess.intakeState === 'COMMUNITY_CASTE_WAIT' || (sess.subService === 'COMMUNITY' && (text.includes('சத்ரியர்') || text.includes('வேளாளர்') || text.includes('நாடார்') || text.includes('அகமுடையார்') || text.includes('மருத்துவர்') || text.includes('வண்ணார்') || text.includes('செட்டியார்') || text.includes('தேவர்') || text.includes('திராவிடர்') || text.includes('பறையர்') || text.includes('அருந்ததியர்')))) && text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
        sess.citizenProfile.caste = text.trim();
        persistSessions();

        const flowStep = advanceTnegaCommunityFlow(sess, `✅ சாதி உட்பிரிவு **${text.trim()}** எனப் பதிவானது!`);
        sess.chatHistory.push({
            sender: 'bot',
            text: flowStep.text,
            options: flowStep.options
        });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    // -------------------------------------------------------------------------
    // FAMILY MEMBER COUNT INTAKE GATE (TNeGA Income Certificate)
    // -------------------------------------------------------------------------
    if ((sess.intakeState === 'INCOME_MEMBER_COUNT_WAIT' || (sess.subService === 'INCOME' && text && (text.includes('நபர்') || text.includes('நபர்கள்')))) && text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
        const countMatch = text.match(/\d+/);
        const count = countMatch ? parseInt(countMatch[0], 10) : (text.includes('1') ? 1 : (text.includes('2') ? 2 : (text.includes('3') ? 3 : (text.includes('4') ? 4 : 1))));
        sess.citizenProfile.familyMemberCount = count;
        if (count === 1) {
            sess.citizenProfile.incomeMembers = [];
        }
        persistSessions();

        const flowStep = advanceTnegaIncomeFlow(sess, `✅ குடும்ப உறுப்பினர்கள் எண்ணிக்கை **${count} நபர்** எனப் பதிவானது!`);
        sess.chatHistory.push({
            sender: 'bot',
            text: flowStep.text,
            options: flowStep.options
        });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    // -------------------------------------------------------------------------
    // ADDITIONAL MEMBER DETAILS GATE (TNeGA Income Certificate)
    // -------------------------------------------------------------------------
    if (sess.intakeState === 'INCOME_ADDITIONAL_MEMBER_WAIT' && text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
        const p = sess.citizenProfile;
        let memberName = 'தேவகி';
        let memberRel = 'Mother';
        let memberProf = 'கூலி வேலை';

        if (text.includes('தாய்') || text.includes('Mother')) {
            memberRel = 'Mother';
            memberName = p.motherNameTam || p.motherNameEng || 'தேவகி';
            memberProf = text.includes('கூலி') ? 'கூலி வேலை' : 'குடும்பத் தலைவி';
        } else if (text.includes('மனைவி') || text.includes('Wife')) {
            memberRel = 'Wife';
            memberName = 'மனைவி';
            memberProf = 'குடும்பத் தலைவி';
        } else if (text.includes('தந்தை') || text.includes('Father')) {
            memberRel = 'Father';
            memberName = p.fatherNameTam || p.fatherNameEng || 'கிருபாகரன்';
            memberProf = text.includes('விவசாயம்') ? 'விவசாயம்' : 'கூலி வேலை';
        } else {
            memberName = text.trim();
        }

        if (!sess.citizenProfile.incomeMembers) sess.citizenProfile.incomeMembers = [];
        sess.citizenProfile.incomeMembers.push({
            name: memberName,
            relationship: memberRel,
            profession: memberProf,
            monthlyIncome: '0'
        });
        persistSessions();

        const flowStep = advanceTnegaIncomeFlow(sess, `✅ கூடுதல் குடும்ப உறுப்பினர் **${memberName} (${memberRel} - ${memberProf})** சேர்க்கப்பட்டார்!`);
        sess.chatHistory.push({
            sender: 'bot',
            text: flowStep.text,
            options: flowStep.options
        });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    // STATE: INCOME_INTAKE, INCOME_AADHAAR_WAIT, or INCOME_AADHAAR_BACK_WAIT
    if (sess.intakeState === 'INCOME_INTAKE' || sess.intakeState === 'INCOME_AADHAAR_WAIT' || sess.intakeState === 'INCOME_AADHAAR_BACK_WAIT' || (sess.subService === 'INCOME' && (text.startsWith('₹') || (text.replace(/[,₹\s]/g, '').match(/\d{4,7}/))))) {
        if (uploadedFile || sess.intakeState === 'INCOME_AADHAAR_BACK_WAIT') {
            const handled = await handleTnegaAadhaarUploadHelper({
                ctx,
                req,
                res,
                backWaitState: 'INCOME_AADHAAR_BACK_WAIT',
                advanceFlowFn: advanceTnegaIncomeFlow
            });
            if (handled) return true;
        }

        const cleanDigits = (text || '').replace(/[,₹\s]/g, '');
        const hasIncomeNum = cleanDigits.match(/\d{4,7}/);

        if (hasIncomeNum) {
            sess.citizenProfile.annualIncome = hasIncomeNum[0];
            persistSessions();

            const flowStep = advanceTnegaIncomeFlow(sess);
            sess.chatHistory.push({
                sender: 'bot',
                text: flowStep.text,
                options: flowStep.options
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        } else if (text && (text.includes('வேலை') || text.includes('தொழில்') || text.includes('விவசாயம்') || text.includes('வியாபாரம்') || text.includes('கூலி') || text.includes('Private') || text.includes('Business'))) {
            sess.citizenProfile.profession = text;
            persistSessions();

            const flowStep = advanceTnegaIncomeFlow(sess);
            sess.chatHistory.push({
                sender: 'bot',
                text: flowStep.text,
                options: flowStep.options
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }
    }

    // -------------------------------------------------------------------------
    // FAMILY MEMBER SELECTION GATE (TNeGA Multi-Member Profiles)
    // -------------------------------------------------------------------------
    if (text && text.startsWith('SELECT_MEMBER_')) {
        const idx = parseInt(text.replace('SELECT_MEMBER_', ''), 10);
        const m = (sess.citizenProfile?.members || [])[idx];
        if (m) {
            sess.selectedMember = m;
            sess.citizenProfile.fullNameEng = m.nameEng || m.name;
            sess.citizenProfile.fullNameTam = m.nameTam || m.name;
            if (m.dob) sess.citizenProfile.headDob = m.dob;
            if (m.gender) sess.citizenProfile.headGender = m.gender;
            if (m.aadhaar) sess.citizenProfile.headAadhaar = m.aadhaar;
        }
        persistSessions();
        const isCommunityFlow = sess.subService === 'COMMUNITY' || (sess.intakeState && sess.intakeState.startsWith('COMMUNITY'));
        const isResidenceFlow = sess.subService === 'RESIDENCE' || (sess.intakeState && sess.intakeState.startsWith('RESIDENCE'));
        const flowStep = isCommunityFlow
            ? advanceTnegaCommunityFlow(sess, `✅ **${m ? (m.nameTam || m.nameEng) : 'உறுப்பினர்'}** தேர்ந்தெடுக்கப்பட்டார்!`)
            : (isResidenceFlow
                ? advanceTnegaResidenceFlow(sess, `✅ **${m ? (m.nameTam || m.nameEng) : 'உறுப்பினர்'}** தேர்ந்தெடுக்கப்பட்டார்!`)
                : advanceTnegaIncomeFlow(sess, `✅ **${m ? (m.nameTam || m.nameEng) : 'உறுப்பினர்'}** தேர்ந்தெடுக்கப்பட்டார்!`));
        sess.chatHistory.push({
            sender: 'bot',
            text: flowStep.text,
            options: flowStep.options
        });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    // -------------------------------------------------------------------------
    // RESIDENCE CERTIFICATE INTAKE GATES (TNeGA REV-102)
    // -------------------------------------------------------------------------
    // GATE 1: Years of Residence (தமிழ்நாட்டில் தொடர்ந்து வசிக்கும் காலம்)
    if ((sess.intakeState === 'RESIDENCE_YEARS_WAIT' || (sess.subService === 'RESIDENCE' && (text.includes('ஆண்டு') || text.includes('பிறப்பிலிருந்து') || text.includes('Years') || text.match(/^\d{1,2}$/)))) && text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
        sess.citizenProfile.yearsOfResidence = text.trim();
        persistSessions();

        const flowStep = advanceTnegaResidenceFlow(sess, `✅ தமிழ்நாட்டில் வசிக்கும் காலம் **${text.trim()}** எனப் பதிவானது!`);
        sess.chatHistory.push({
            sender: 'bot',
            text: flowStep.text,
            options: flowStep.options
        });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    // GATE 2: Purpose of Certificate (சான்றிதழ் பயன்பாடு / நோக்கம்)
    if ((sess.intakeState === 'RESIDENCE_PURPOSE_WAIT' || (sess.subService === 'RESIDENCE' && (text.includes('பயன்பாடு') || text.includes('கல்வி') || text.includes('வேலை') || text.includes('நலத்திட்டம்') || text.includes('பொது')))) && text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
        sess.citizenProfile.purposeOfCertificate = text.trim();
        persistSessions();

        const flowStep = advanceTnegaResidenceFlow(sess, `✅ சான்றிதழ் நோக்கம் **${text.trim()}** எனப் பதிவானது!`);
        sess.chatHistory.push({
            sender: 'bot',
            text: flowStep.text,
            options: flowStep.options
        });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    // GATE 3: Demographics / Aadhaar Upload
    if (sess.intakeState === 'RESIDENCE_AADHAAR_WAIT' || sess.intakeState === 'RESIDENCE_AADHAAR_BACK_WAIT' || sess.intakeState === 'RESIDENCE_INTAKE') {
        if (uploadedFile || sess.intakeState === 'RESIDENCE_AADHAAR_BACK_WAIT') {
            const handled = await handleTnegaAadhaarUploadHelper({
                ctx,
                req,
                res,
                backWaitState: 'RESIDENCE_AADHAAR_BACK_WAIT',
                advanceFlowFn: advanceTnegaResidenceFlow
            });
            if (handled) return true;
        }

        if (text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
            if (!sess.citizenProfile.yearsOfResidence) {
                sess.citizenProfile.yearsOfResidence = text.trim();
            } else if (!sess.citizenProfile.purposeOfCertificate) {
                sess.citizenProfile.purposeOfCertificate = text.trim();
            }
            persistSessions();
            const flowStep = advanceTnegaResidenceFlow(sess);
            sess.chatHistory.push({
                sender: 'bot',
                text: flowStep.text,
                options: flowStep.options
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }
    }

    // -------------------------------------------------------------------------
    // COMMUNITY CERTIFICATE INTAKE GATES (TNeGA REV-101)
    // -------------------------------------------------------------------------
    if (sess.intakeState === 'COMMUNITY_AADHAAR_WAIT' || sess.intakeState === 'COMMUNITY_AADHAAR_BACK_WAIT' || sess.intakeState === 'COMMUNITY_INTAKE') {
        if (uploadedFile || sess.intakeState === 'COMMUNITY_AADHAAR_BACK_WAIT') {
            const handled = await handleTnegaAadhaarUploadHelper({
                ctx,
                req,
                res,
                backWaitState: 'COMMUNITY_AADHAAR_BACK_WAIT',
                advanceFlowFn: advanceTnegaCommunityFlow
            });
            if (handled) return true;
        }

        if (text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
            if (!sess.citizenProfile.caste) {
                sess.citizenProfile.caste = text.trim();
            }
            persistSessions();
            const flowStep = advanceTnegaCommunityFlow(sess);
            sess.chatHistory.push({
                sender: 'bot',
                text: flowStep.text,
                options: flowStep.options
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }
    }

    // -------------------------------------------------------------------------
    // COMMUNITY PROOF DOCUMENT UPLOAD GATE (TNeGA REV-101)
    // -------------------------------------------------------------------------
    if (sess.intakeState === 'COMMUNITY_PROOF_WAIT') {
        if (uploadedFile) {
            sess.citizenProfile.communityProof = uploadedFile.path;
            sess.citizenProfile.communityCertificatePath = uploadedFile.path;
            sess.citizenProfile.familyCommunityProofPath = uploadedFile.path;
            if (!sess.tempUploads) sess.tempUploads = {};
            sess.tempUploads.communityProof = uploadedFile.path;
            if (!sess.citizenProfile.documents) sess.citizenProfile.documents = {};
            sess.citizenProfile.documents.communityProof = uploadedFile.path;
            persistSessions();

            const flowStep = advanceTnegaCommunityFlow(sess, `✅ **குடும்ப சாதிச் சான்றிதழ் / பள்ளி TC வெற்றிகரமாகப் பெறப்பட்டது!** 🛡️`);
            sess.chatHistory.push({
                sender: 'bot',
                text: flowStep.text,
                options: flowStep.options
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }

        if (text === 'SKIP_COMMUNITY_PROOF' || text.includes('ஏற்கெனவே உள்ளது') || text.includes('பிறகு பதிவேற்றுக') || text === 'CONTINUE_WITHOUT_COMM_PROOF') {
            sess.citizenProfile.communityProofSkipped = true;
            persistSessions();

            const flowStep = advanceTnegaCommunityFlow(sess);
            sess.chatHistory.push({
                sender: 'bot',
                text: flowStep.text,
                options: flowStep.options
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }
    }

    return false;
}

module.exports = {
    handleTnegaIntake
};
