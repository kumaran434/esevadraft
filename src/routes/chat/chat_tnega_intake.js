const fs = require('fs');
const storageService = require('../../services/storage_service');
const { inspectAndExtractDocument } = require('../../../ai_document_extractor');
const { validateUploadedDocument } = require('../../services/document_validator');
const { evaluateServiceChecklist } = require('../../core/services_registry');
const { searchCitizenCan, registerNewCan } = require('../../../tnega_can_automation');
const { advanceTnegaIncomeFlow, advanceTnegaCanRegisterFlow, advanceTnegaResidenceFlow, advanceTnegaCommunityFlow, advanceTnegaFirstGraduateFlow, advanceTnegaObcFlow } = require('../../core/fsm/tnega_flow_engine');
const { ensureBilingualPair } = require('../../utils/bilingual_helper');
const { produceCompliantDocument, produceDualSidedDocument, produceCompliantPassportPhoto } = require('../../../photo_studio');
const { saveCitizenProfile } = require('../../../database');
const { persistSessions } = storageService;

function extractIncomeAndProfession(inputStr) {
    if (!inputStr || typeof inputStr !== 'string') return null;
    const clean = inputStr.trim();

    // 1. Occupation Detection
    let detectedProf = null;
    if (/விவசாய|farmer|agri|பயிர்த்/i.test(clean)) {
        detectedProf = 'விவசாயம்';
    } else if (/கூலி|coolie|daily wage|labour|சுமை|தொழிலாளி/i.test(clean)) {
        detectedProf = 'கூலி வேலை';
    } else if (/வியாபார|வணிக|business|கடை|shop/i.test(clean)) {
        detectedProf = 'சிறு வணிகம் / வியாபாரம்';
    } else if (/தனியார்|private/i.test(clean)) {
        detectedProf = 'தனியார் வேலை';
    } else if (/அரசு|govt/i.test(clean)) {
        detectedProf = 'அரசு ஊழியர்';
    } else if (/ஓட்டுநர்|driver|டிரைவர்/i.test(clean)) {
        detectedProf = 'ஓட்டுநர் (Driver)';
    } else if (/தையல்|tailor/i.test(clean)) {
        detectedProf = 'தையல் கலைஞர்';
    } else if (/கட்டிட|mason|construction/i.test(clean)) {
        detectedProf = 'கட்டிடத் தொழிலாளி';
    } else if (/இல்லத்தரசி|குடும்பத் தலைவி|housewife|homemaker/i.test(clean)) {
        detectedProf = 'இல்லத்தரசி / குடும்பத் தலைவி';
    }

    // 2. Income Number Detection (matches 4 to 7 digits like 5000, 6000, 7000, 8000, 10000, 60000, 72000, 120000)
    const numMatch = clean.replace(/,/g, '').match(/\b\d{4,7}\b/);
    let detectedMonthly = null;
    let detectedAnnual = null;

    if (numMatch) {
        const val = parseInt(numMatch[0], 10);
        if (val <= 25000) {
            detectedMonthly = val;
            detectedAnnual = val * 12;
        } else {
            detectedAnnual = val;
            detectedMonthly = Math.round(val / 12);
        }
    }

    return {
        profession: detectedProf,
        monthlyIncome: detectedMonthly,
        annualIncome: detectedAnnual
    };
}

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
            const isObcFlow = sess.subService === 'OBC' || (sess.intakeState && sess.intakeState.startsWith('OBC'));
            const isFirstGraduateFlow = !isObcFlow && (sess.subService === 'FIRST_GRADUATE' || (sess.intakeState && sess.intakeState.startsWith('FIRST_GRADUATE')));
            const isCommunityFlow = !isObcFlow && !isFirstGraduateFlow && (sess.subService === 'COMMUNITY' || (sess.intakeState && sess.intakeState.startsWith('COMMUNITY')));
            const isResidenceFlow = !isObcFlow && !isFirstGraduateFlow && !isCommunityFlow && (sess.subService === 'RESIDENCE' || (sess.intakeState && sess.intakeState.startsWith('RESIDENCE')));
            const flowStep = isObcFlow
                ? advanceTnegaObcFlow(sess, `✅ CAN எண் **${matchedCan[1]}** வெற்றிகரமாகப் பொருத்தப்பட்டது! 🛡️`)
                : (isFirstGraduateFlow
                ? advanceTnegaFirstGraduateFlow(sess, `✅ CAN எண் **${matchedCan[1]}** வெற்றிகரமாகப் பொருத்தப்பட்டது! 🛡️`)
                : (isCommunityFlow
                    ? advanceTnegaCommunityFlow(sess, `✅ CAN எண் **${matchedCan[1]}** வெற்றிகரமாகப் பொருத்தப்பட்டது! 🛡️`)
                    : (isResidenceFlow
                        ? advanceTnegaResidenceFlow(sess, `✅ CAN எண் **${matchedCan[1]}** வெற்றிகரமாகப் பொருத்தப்பட்டது! 🛡️`)
                        : advanceTnegaIncomeFlow(sess, `✅ CAN எண் **${matchedCan[1]}** வெற்றிகரமாகப் பொருத்தப்பட்டது! 🛡️`))));
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
            const isObcFlow = sess.subService === 'OBC' || (sess.intakeState && sess.intakeState.startsWith('OBC'));
            const isFirstGraduateFlow = !isObcFlow && (sess.subService === 'FIRST_GRADUATE' || (sess.intakeState && sess.intakeState.startsWith('FIRST_GRADUATE')));
            const isCommunityFlow = !isObcFlow && !isFirstGraduateFlow && (sess.subService === 'COMMUNITY' || (sess.intakeState && sess.intakeState.startsWith('COMMUNITY')));
            const isResidenceFlow = !isObcFlow && !isFirstGraduateFlow && !isCommunityFlow && (sess.subService === 'RESIDENCE' || (sess.intakeState && sess.intakeState.startsWith('RESIDENCE')));
            const flowStep = isObcFlow
                ? advanceTnegaObcFlow(
                    sess,
                    `🎉 **வாடிக்கையாளரின் CAN எண் கண்டறியப்பட்டது!**\n\n` +
                    `• 🔢 **CAN எண்:** **${searchRes.canNumber}** ✅\n` +
                    `• 👤 **பெயர்:** ${searchRes.citizenName || p.fullNameTam || '—'}\n` +
                    `• 👨 **தந்தை/கணவர்:** ${searchRes.fatherName || p.fatherNameTam || '—'}\n` +
                    `• 🏛️ **வட்டம் & மாவட்டம்:** ${searchRes.taluk || p.taluk || ''}, ${searchRes.district || p.district || ''}` +
                    familyListText
                )
                : (isFirstGraduateFlow
                ? advanceTnegaFirstGraduateFlow(
                    sess,
                    `🎉 **மாணவரின் CAN எண் கண்டறியப்பட்டது!**\n\n` +
                    `• 🔢 **CAN எண்:** **${searchRes.canNumber}** ✅\n` +
                    `• 👤 **பெயர்:** ${searchRes.citizenName || p.fullNameTam || '—'}\n` +
                    `• 👨 **தந்தை/கணவர்:** ${searchRes.fatherName || p.fatherNameTam || '—'}\n` +
                    `• 🏛️ **வட்டம் & மாவட்டம்:** ${searchRes.taluk || p.taluk || ''}, ${searchRes.district || p.district || ''}` +
                    familyListText
                )
                : (isCommunityFlow
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
                        ))));
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
            let extractedBack = null;
            try {
                extractedBack = await inspectAndExtractDocument(uploadedFile.path, { skipFaceExtraction: true });
            } catch (_) {}

            const validation = validateUploadedDocument('headAadhaarBack', extractedBack);
            if (!validation.valid) {
                try { if (fs.existsSync(uploadedFile.path)) fs.unlinkSync(uploadedFile.path); } catch(_) {}
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

        const validation = validateUploadedDocument('headAadhaar', extracted);
        if (!validation.valid) {
            try { if (fs.existsSync(uploadedFile.path)) fs.unlinkSync(uploadedFile.path); } catch(_) {}
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
    if ((sess.intakeState === 'COMMUNITY_MOTHER_NAME_WAIT' || sess.intakeState === 'INCOME_MOTHER_NAME_WAIT' || sess.intakeState === 'FIRST_GRADUATE_MOTHER_NAME_WAIT' || sess.intakeState === 'OBC_MOTHER_NAME_WAIT') && text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
        const { eng, tam } = ensureBilingualPair(text.trim(), text.trim());
        sess.citizenProfile.motherNameEng = eng;
        sess.citizenProfile.motherNameTam = tam;
        persistSessions();

        const p = sess.citizenProfile;
        const isObcFlow = sess.subService === 'OBC' || (sess.intakeState && sess.intakeState.startsWith('OBC'));
        const isFirstGraduateFlow = !isObcFlow && (sess.subService === 'FIRST_GRADUATE' || (sess.intakeState && sess.intakeState.startsWith('FIRST_GRADUATE')));
        const isCommunityFlow = !isObcFlow && !isFirstGraduateFlow && (sess.subService === 'COMMUNITY' || (sess.intakeState && sess.intakeState.startsWith('COMMUNITY')));
        const flowStep = isObcFlow
            ? advanceTnegaObcFlow(sess, `✅ தாயின் பெயர் **${p.motherNameTam || p.motherNameEng}** எனப் பதிவானது!`)
            : (isFirstGraduateFlow
                ? advanceTnegaFirstGraduateFlow(sess, `✅ தாயின் பெயர் **${p.motherNameTam || p.motherNameEng}** எனப் பதிவானது!`)
                : (isCommunityFlow
                    ? advanceTnegaCommunityFlow(sess, `✅ தாயின் பெயர் **${p.motherNameTam || p.motherNameEng}** எனப் பதிவானது!`)
                    : advanceTnegaIncomeFlow(sess, `✅ தாயின் பெயர் **${p.motherNameTam || p.motherNameEng}** எனப் பதிவானது!`)));
        sess.chatHistory.push({
            sender: 'bot',
            text: flowStep.text,
            options: flowStep.options
        });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    // -------------------------------------------------------------------------
    // FIRST GRADUATE: CURRENT COURSE INTAKE GATE
    // -------------------------------------------------------------------------
    if (sess.intakeState === 'FIRST_GRADUATE_COURSE_WAIT' && text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
        sess.citizenProfile.currentCourse = text.trim();
        sess.citizenProfile.degreeCourse = text.trim();
        persistSessions();
        const flowStep = advanceTnegaFirstGraduateFlow(sess, `✅ படிப்பு **${text.trim()}** எனப் பதிவானது!`);
        sess.chatHistory.push({
            sender: 'bot',
            text: flowStep.text,
            options: flowStep.options
        });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    // -------------------------------------------------------------------------
    // FIRST GRADUATE: COLLEGE / INSTITUTION NAME INTAKE GATE
    // -------------------------------------------------------------------------
    if (sess.intakeState === 'FIRST_GRADUATE_COLLEGE_WAIT' && text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
        sess.citizenProfile.institutionName = text.trim();
        sess.citizenProfile.collegeName = text.trim();
        persistSessions();
        const flowStep = advanceTnegaFirstGraduateFlow(sess, `✅ கல்லூரி **${text.trim()}** எனப் பதிவானது!`);
        sess.chatHistory.push({
            sender: 'bot',
            text: flowStep.text,
            options: flowStep.options
        });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    // -------------------------------------------------------------------------
    // FIRST GRADUATE: PARENTS' EDUCATION QUALIFICATION INTAKE GATE
    // -------------------------------------------------------------------------
    if ((sess.intakeState === 'FIRST_GRADUATE_PARENT_EDU_WAIT' || (text && text.startsWith('PARENT_EDU:'))) && text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
        let fEdu = '10th Standard';
        let mEdu = '8th Standard';
        if (text.startsWith('PARENT_EDU:')) {
            const parts = text.replace('PARENT_EDU:', '').split('|');
            if (parts[0]) fEdu = parts[0].trim();
            if (parts[1]) mEdu = parts[1].trim();
        } else {
            fEdu = text.trim();
            mEdu = text.trim();
        }
        sess.citizenProfile.fatherEducation = fEdu;
        sess.citizenProfile.motherEducation = mEdu;
        persistSessions();
        const flowStep = advanceTnegaFirstGraduateFlow(sess, `✅ பெற்றோர் கல்வி: **தந்தை (${fEdu}) | தாய் (${mEdu})** எனப் பதிவானது!`);
        sess.chatHistory.push({
            sender: 'bot',
            text: flowStep.text,
            options: flowStep.options
        });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    // -------------------------------------------------------------------------
    // FIRST GRADUATE: YEAR OF PASSING 12TH INTAKE GATE
    // -------------------------------------------------------------------------
    if (sess.intakeState === 'FIRST_GRADUATE_YOP_WAIT' && text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
        const yopMatch = text.match(/\b(19|20)\d{2}\b/);
        const cleanYop = yopMatch ? yopMatch[0] : text.trim();
        sess.citizenProfile.yearOfPassing = cleanYop;
        sess.citizenProfile.passingYear = cleanYop;
        persistSessions();
        const flowStep = advanceTnegaFirstGraduateFlow(sess, `✅ 12-ஆம் வகுப்பு தேர்ச்சி ஆண்டு **${cleanYop}** எனப் பதிவானது!`);
        sess.chatHistory.push({
            sender: 'bot',
            text: flowStep.text,
            options: flowStep.options
        });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    // -------------------------------------------------------------------------
    // FIRST GRADUATE: ELIGIBILITY CONFIRMATION GATE
    // -------------------------------------------------------------------------
    if (sess.intakeState === 'FIRST_GRADUATE_FAMILY_CHECK_GATE' || text === 'FIRST_GRADUATE_CONFIRMED' || text === 'FIRST_GRADUATE_INELIGIBLE') {
        if (text === 'FIRST_GRADUATE_INELIGIBLE') {
            sess.chatHistory.push({
                sender: 'bot',
                text: `⚠️ **அரசு விதிப்படி (TNeGA REV-104 Rule):**\n\nகுடும்பத்தில் ஏற்கனவே ஒருவர் பட்டப்படிப்பு முடித்திருந்தால் முதல் பட்டதாரி கல்விக் கட்டணச் சலுகை பெற இயலாது.\n\nவேறு ஏதேனும் சான்றிதழ் சேவை தேவைப்படுகிறதா?`,
                options: [
                    { label: "📜 சாதிச் சான்றிதழ்", value: "சாதிச் சான்றிதழ்" },
                    { label: "💰 வருமானச் சான்றிதழ்", value: "வருமானச் சான்றிதழ்" },
                    { label: "🏠 இருப்பிடச் சான்றிதழ்", value: "இருப்பிடச் சான்றிதழ்" },
                    { label: "🔄 மீண்டும் சேவைகளைத் தேர்ந்தெடு", value: "reset" }
                ]
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }

        sess.citizenProfile.familyGraduateConfirmed = true;
        persistSessions();
        const flowStep = advanceTnegaFirstGraduateFlow(sess, `✅ குடும்பத்தில் முதல் பட்டதாரி தகுதி உறுதிப்படுத்தப்பட்டது! 🛡️`);
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
    // PARENTS CASTE INTAKE GATE (TNeGA REV-101 Community Certificate)
    // -------------------------------------------------------------------------
    if (sess.intakeState === 'COMMUNITY_PARENTS_CASTE_GATE' || text === 'PARENTS_SAME_CASTE' || text === 'PARENTS_DIFF_CASTE' || (sess.subService === 'COMMUNITY' && (text.includes('இருவருமே') || text.includes('வெவ்வேறு சாதி')))) {
        if (text === 'PARENTS_SAME_CASTE' || text.includes('இருவருமே') || text.includes('ஆம்')) {
            const c = sess.citizenProfile.caste || sess.citizenProfile.subCaste || 'வன்னியகுல சத்ரியர்';
            sess.citizenProfile.fatherCaste = c;
            sess.citizenProfile.motherCaste = c;
            sess.citizenProfile.requestedCaste = c;
            sess.citizenProfile.fatherCommunity = sess.citizenProfile.community || 'MBC';
            sess.citizenProfile.motherCommunity = sess.citizenProfile.community || 'MBC';
            sess.citizenProfile.requestedCommunity = sess.citizenProfile.community || 'MBC';
            sess.citizenProfile.parentCasteConfirmed = true;
            persistSessions();

            const flowStep = advanceTnegaCommunityFlow(sess, `✅ தந்தை மற்றும் தாய் இருவரின் சாதியும் **${c}** எனப் பதிவானது!`);
            sess.chatHistory.push({
                sender: 'bot',
                text: flowStep.text,
                options: flowStep.options
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        } else if (text === 'PARENTS_DIFF_CASTE' || text.includes('வெவ்வேறு சாதி') || text.includes('இல்லை')) {
            sess.intakeState = 'COMMUNITY_FATHER_CASTE_WAIT';
            persistSessions();

            sess.chatHistory.push({
                sender: 'bot',
                text: `👨 **தந்தையின் சாதி உட்பிரிவு (Father's Caste) என்ன?**\n\nதட்டச்சு செய்யவும் அல்லது விருப்பத்தைத் தேர்ந்தெடுக்கவும்:`,
                options: [
                    { label: "வன்னியகுல சத்ரியர்", value: "FATHER_CASTE_வன்னியகுல சத்ரியர்" },
                    { label: "அகமுடையார்", value: "FATHER_CASTE_அகமுடையார்" },
                    { label: "கொங்கு வேளாளர்", value: "FATHER_CASTE_கொங்கு வேளாளர்" },
                    { label: "நாடார்", value: "FATHER_CASTE_நாடார்" }
                ]
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }
    }

    if (sess.intakeState === 'COMMUNITY_FATHER_CASTE_WAIT' && text && !text.startsWith('TRIGGER_')) {
        const cleaned = text.replace('FATHER_CASTE_', '').trim();
        sess.citizenProfile.fatherCaste = cleaned;
        sess.intakeState = 'COMMUNITY_MOTHER_CASTE_WAIT';
        persistSessions();

        sess.chatHistory.push({
            sender: 'bot',
            text: `✅ தந்தையின் சாதி: **${cleaned}** எனப் பதிவானது!\n\n👩 **தாயின் சாதி உட்பிரிவு (Mother's Caste) என்ன?**`,
            options: [
                { label: "வன்னியகுல சத்ரியர்", value: "MOTHER_CASTE_வன்னியகுல சத்ரியர்" },
                { label: "அகமுடையார்", value: "MOTHER_CASTE_அகமுடையார்" },
                { label: "கொங்கு வேளாளர்", value: "MOTHER_CASTE_கொங்கு வேளாளர்" },
                { label: "நாடார்", value: "MOTHER_CASTE_நாடார்" }
            ]
        });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    if (sess.intakeState === 'COMMUNITY_MOTHER_CASTE_WAIT' && text && !text.startsWith('TRIGGER_')) {
        const cleaned = text.replace('MOTHER_CASTE_', '').trim();
        sess.citizenProfile.motherCaste = cleaned;
        sess.citizenProfile.requestedCaste = sess.citizenProfile.caste || sess.citizenProfile.fatherCaste || cleaned;
        sess.citizenProfile.parentCasteConfirmed = true;
        persistSessions();

        const flowStep = advanceTnegaCommunityFlow(sess, `✅ தாயின் சாதி: **${cleaned}** எனப் பதிவானது!`);
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

    // -------------------------------------------------------------------------
    // INCOME PROOF DOCUMENT UPLOAD / SELF-DECLARATION GATE (TNeGA REV-103)
    // -------------------------------------------------------------------------
    if (sess.intakeState === 'INCOME_PROOF_WAIT') {
        if (uploadedFile) {
            let extracted = null;
            try {
                extracted = await inspectAndExtractDocument(uploadedFile.path, { isTnega: true });
            } catch (_) {}

            const validation = validateUploadedDocument('incomeProof', extracted);
            if (!validation.valid) {
                try {
                    if (fs.existsSync(uploadedFile.path)) fs.unlinkSync(uploadedFile.path);
                } catch (_) {}

                delete sess.citizenProfile.incomeProof;
                delete sess.citizenProfile.salaryCertificatePath;
                if (sess.tempUploads) delete sess.tempUploads.incomeProof;
                if (sess.citizenProfile.documents) delete sess.citizenProfile.documents.incomeProof;
                persistSessions();

                sess.chatHistory.push({
                    sender: 'bot',
                    text: validation.errorTamil,
                    options: [
                        { label: "🌾 விவசாயி (Farmer - மாதம் ₹6,000 / ஆண்டு ₹72,000)", value: "INCOME_DECL_FARMER_6000" },
                        { label: "🔨 கூலி வேலை (Daily Wage - மாதம் ₹6,000 / ஆண்டு ₹72,000)", value: "INCOME_DECL_COOLIE_6000" },
                        { label: "📷 சம்பளச் சான்று / Pay Slip பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                        { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
                    ]
                });
                res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
                return true;
            }

            const compliantProof = await produceCompliantDocument(uploadedFile.path);
            sess.citizenProfile.incomeProof = compliantProof;
            sess.citizenProfile.salaryCertificatePath = compliantProof;
            if (!sess.tempUploads) sess.tempUploads = {};
            sess.tempUploads.incomeProof = compliantProof;
            if (!sess.citizenProfile.documents) sess.citizenProfile.documents = {};
            sess.citizenProfile.documents.incomeProof = compliantProof;

            persistSessions();

            const flowStep = advanceTnegaIncomeFlow(sess, `✅ **வருமான ஆதாரம் / சம்பளச் சான்று வெற்றிகரமாகப் பெறப்பட்டது!** 🛡️`);
            sess.chatHistory.push({
                sender: 'bot',
                text: flowStep.text,
                options: flowStep.options
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }

        if (text && !text.startsWith('TRIGGER_')) {
            let prof = null;
            let mInc = null;
            let aInc = null;

            if (text === 'INCOME_DECL_FARMER_6000') {
                prof = 'விவசாயம்';
                mInc = 6000;
                aInc = 72000;
            } else if (text === 'INCOME_DECL_COOLIE_6000') {
                prof = 'கூலி வேலை';
                mInc = 6000;
                aInc = 72000;
            } else if (text === 'INCOME_DECL_BIZ_7000') {
                prof = 'சிறு வணிகம் / வியாபாரம்';
                mInc = 7000;
                aInc = 84000;
            } else if (text === 'INCOME_DECL_PVT_8000') {
                prof = 'தனியார் வேலை';
                mInc = 8000;
                aInc = 96000;
            } else {
                const parsed = extractIncomeAndProfession(text);
                if (parsed) {
                    prof = parsed.profession;
                    mInc = parsed.monthlyIncome;
                    aInc = parsed.annualIncome;
                }
            }

            if (prof && aInc) {
                sess.citizenProfile.profession = prof;
                sess.citizenProfile.monthlyIncome = mInc;
                sess.citizenProfile.annualIncome = String(aInc);
                sess.citizenProfile.incomeProof = 'SELF_DECLARATION';
                sess.citizenProfile.incomeProofType = 'SELF_DECLARATION';
                sess.citizenProfile.salaryCertificate = 'SELF_DECLARATION';
                sess.citizenProfile.salaryCertificatePath = 'SELF_DECLARATION';
                persistSessions();

                const flowStep = advanceTnegaIncomeFlow(
                    sess,
                    `✅ தொழில்: **${prof}** | மாத வருமானம்: **₹${Number(mInc).toLocaleString('en-IN')}** (ஆண்டு வருமானம்: **₹${Number(aInc).toLocaleString('en-IN')}** - சுய அறிவிப்பு) வெற்றிகரமாகப் பதிவானது! 🛡️`
                );
                sess.chatHistory.push({
                    sender: 'bot',
                    text: flowStep.text,
                    options: flowStep.options
                });
                res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
                return true;
            } else if (prof && !aInc) {
                sess.citizenProfile.profession = prof;
                sess.intakeState = 'INCOME_MONTHLY_WAIT';
                persistSessions();

                sess.chatHistory.push({
                    sender: 'bot',
                    text: `🌾 தொழில்: **${prof}** எனப் பதிவானது!\n\n${prof} தொழிலில் தோராயமான **மாத வருமானம்** எவ்வளவு? கீழே தேர்ந்தெடுக்கவும் அல்லது தொகையை உள்ளிடவும்:`,
                    options: [
                        { label: "₹5,000 / மாதம் (ஆண்டுக்கு ₹60,000)", value: "INCOME_AMOUNT_5000" },
                        { label: "🌾 ₹6,000 / மாதம் (ஆண்டுக்கு ₹72,000)", value: "INCOME_AMOUNT_6000" },
                        { label: "₹7,000 / மாதம் (ஆண்டுக்கு ₹84,000)", value: "INCOME_AMOUNT_7000" },
                        { label: "₹8,000 / மாதம் (ஆண்டுக்கு ₹96,000)", value: "INCOME_AMOUNT_8000" },
                        { label: "₹10,000 / மாதம் (ஆண்டுக்கு ₹1,20,000)", value: "INCOME_AMOUNT_10000" }
                    ]
                });
                res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
                return true;
            } else if (!prof && aInc) {
                sess.citizenProfile.monthlyIncome = mInc;
                sess.citizenProfile.annualIncome = String(aInc);
                sess.intakeState = 'INCOME_PROFESSION_WAIT';
                persistSessions();

                sess.chatHistory.push({
                    sender: 'bot',
                    text: `💰 மாத வருமானம்: **₹${Number(mInc).toLocaleString('en-IN')}** (ஆண்டு: **₹${Number(aInc).toLocaleString('en-IN')}**) எனப் பதிவானது!\n\nவிண்ணப்பதாரரின் **தொழில் (Occupation)** என்ன? கீழே உள்ள தொழிலைத் தேர்ந்தெடுக்கவும்:`,
                    options: [
                        { label: "🌾 விவசாயி (Farmer / Agriculture)", value: "INCOME_PROF_FARMER" },
                        { label: "🔨 கூலி வேலை (Daily Wage / Coolie)", value: "INCOME_PROF_COOLIE" },
                        { label: "🏪 சிறு வணிகம் / வியாபாரம் (Small Business)", value: "INCOME_PROF_BIZ" },
                        { label: "🏢 தனியார் வேலை (Private Sector)", value: "INCOME_PROF_PVT" }
                    ]
                });
                res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
                return true;
            }
        }
    }

    // -------------------------------------------------------------------------
    // INCOME MONTHLY SALARY WAIT GATE
    // -------------------------------------------------------------------------
    if (sess.intakeState === 'INCOME_MONTHLY_WAIT' && text && !text.startsWith('TRIGGER_')) {
        let mInc = null;
        let aInc = null;

        if (text === 'INCOME_AMOUNT_5000') { mInc = 5000; aInc = 60000; }
        else if (text === 'INCOME_AMOUNT_6000') { mInc = 6000; aInc = 72000; }
        else if (text === 'INCOME_AMOUNT_7000') { mInc = 7000; aInc = 84000; }
        else if (text === 'INCOME_AMOUNT_8000') { mInc = 8000; aInc = 96000; }
        else if (text === 'INCOME_AMOUNT_10000') { mInc = 10000; aInc = 120000; }
        else {
            const parsed = extractIncomeAndProfession(text);
            if (parsed && parsed.annualIncome) {
                mInc = parsed.monthlyIncome;
                aInc = parsed.annualIncome;
            }
        }

        if (aInc) {
            sess.citizenProfile.monthlyIncome = mInc;
            sess.citizenProfile.annualIncome = String(aInc);
            sess.citizenProfile.incomeProof = 'SELF_DECLARATION';
            sess.citizenProfile.incomeProofType = 'SELF_DECLARATION';
            sess.citizenProfile.salaryCertificate = 'SELF_DECLARATION';
            sess.citizenProfile.salaryCertificatePath = 'SELF_DECLARATION';
            persistSessions();

            const prof = sess.citizenProfile.profession || 'விவசாயம்';
            const flowStep = advanceTnegaIncomeFlow(
                sess,
                `✅ தொழில்: **${prof}** | மாத வருமானம்: **₹${Number(mInc).toLocaleString('en-IN')}** (ஆண்டு வருமானம்: **₹${Number(aInc).toLocaleString('en-IN')}** - சுய அறிவிப்பு) வெற்றிகரமாகப் பதிவானது! 🛡️`
            );
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
    // INCOME PROFESSION WAIT GATE
    // -------------------------------------------------------------------------
    if (sess.intakeState === 'INCOME_PROFESSION_WAIT' && text && !text.startsWith('TRIGGER_')) {
        let prof = null;
        if (text === 'INCOME_PROF_FARMER' || text.includes('விவசாய')) prof = 'விவசாயம்';
        else if (text === 'INCOME_PROF_COOLIE' || text.includes('கூலி')) prof = 'கூலி வேலை';
        else if (text === 'INCOME_PROF_BIZ' || text.includes('வியாபார')) prof = 'சிறு வணிகம் / வியாபாரம்';
        else if (text === 'INCOME_PROF_PVT' || text.includes('தனியார்')) prof = 'தனியார் வேலை';
        else {
            const parsed = extractIncomeAndProfession(text);
            prof = (parsed && parsed.profession) ? parsed.profession : text.trim();
        }

        if (prof) {
            sess.citizenProfile.profession = prof;
            sess.citizenProfile.incomeProof = 'SELF_DECLARATION';
            sess.citizenProfile.incomeProofType = 'SELF_DECLARATION';
            sess.citizenProfile.salaryCertificate = 'SELF_DECLARATION';
            sess.citizenProfile.salaryCertificatePath = 'SELF_DECLARATION';
            persistSessions();

            const mInc = sess.citizenProfile.monthlyIncome || 6000;
            const aInc = sess.citizenProfile.annualIncome || 72000;
            const flowStep = advanceTnegaIncomeFlow(
                sess,
                `✅ தொழில்: **${prof}** | மாத வருமானம்: **₹${Number(mInc).toLocaleString('en-IN')}** (ஆண்டு வருமானம்: **₹${Number(aInc).toLocaleString('en-IN')}** - சுய அறிவிப்பு) வெற்றிகரமாகப் பதிவானது! 🛡️`
            );
            sess.chatHistory.push({
                sender: 'bot',
                text: flowStep.text,
                options: flowStep.options
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }
    }

    // STATE: INCOME_INTAKE, INCOME_AADHAAR_WAIT, or INCOME_AADHAAR_BACK_WAIT
    if (sess.intakeState === 'INCOME_INTAKE' || sess.intakeState === 'INCOME_AADHAAR_WAIT' || sess.intakeState === 'INCOME_AADHAAR_BACK_WAIT') {
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
            const val = parseInt(hasIncomeNum[0], 10);
            if (val <= 25000) {
                sess.citizenProfile.monthlyIncome = val;
                sess.citizenProfile.annualIncome = String(val * 12);
            } else {
                sess.citizenProfile.annualIncome = String(val);
                sess.citizenProfile.monthlyIncome = Math.round(val / 12);
            }
            if (!sess.citizenProfile.incomeProof) {
                sess.citizenProfile.incomeProof = 'SELF_DECLARATION';
                sess.citizenProfile.incomeProofType = 'SELF_DECLARATION';
            }
            persistSessions();

            const flowStep = advanceTnegaIncomeFlow(sess, `✅ குடும்ப ஆண்டு வருமானம் **₹${Number(sess.citizenProfile.annualIncome).toLocaleString('en-IN')}** எனப் பதிவானது!`);
            sess.chatHistory.push({
                sender: 'bot',
                text: flowStep.text,
                options: flowStep.options
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        } else if (text && (text.includes('வேலை') || text.includes('தொழில்') || text.includes('விவசாயம்') || text.includes('விவசாயி') || text.includes('வியாபாரம்') || text.includes('கூலி') || text.includes('Private') || text.includes('Business'))) {
            let prof = text.trim();
            if (prof.includes('விவசாய')) prof = 'விவசாயம்';
            else if (prof.includes('கூலி')) prof = 'கூலி வேலை';
            else if (prof.includes('வியாபார')) prof = 'சிறு வணிகம் / வியாபாரம்';
            else if (prof.includes('தனியார்')) prof = 'தனியார் வேலை';
            sess.citizenProfile.profession = prof;
            if (!sess.citizenProfile.incomeProof) {
                sess.citizenProfile.incomeProof = 'SELF_DECLARATION';
                sess.citizenProfile.incomeProofType = 'SELF_DECLARATION';
            }
            persistSessions();

            const flowStep = advanceTnegaIncomeFlow(sess, `✅ தொழில்: **${prof}** எனப் பதிவானது!`);
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
    // FIRST GRADUATE CERTIFICATE INTAKE GATES (TNeGA REV-104)
    // -------------------------------------------------------------------------
    if (sess.intakeState === 'FIRST_GRADUATE_AADHAAR_WAIT' || sess.intakeState === 'FIRST_GRADUATE_AADHAAR_BACK_WAIT' || sess.intakeState === 'FIRST_GRADUATE_INTAKE') {
        if (uploadedFile || sess.intakeState === 'FIRST_GRADUATE_AADHAAR_BACK_WAIT') {
            const handled = await handleTnegaAadhaarUploadHelper({
                ctx,
                req,
                res,
                backWaitState: 'FIRST_GRADUATE_AADHAAR_BACK_WAIT',
                advanceFlowFn: advanceTnegaFirstGraduateFlow
            });
            if (handled) return true;
        }

        if (text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
            persistSessions();
            const flowStep = advanceTnegaFirstGraduateFlow(sess);
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
    // FIRST GRADUATE: APPLICANT 12TH TC / MARKSHEET UPLOAD GATE
    // -------------------------------------------------------------------------
    if (sess.intakeState === 'FIRST_GRADUATE_APPLICANT_PROOF_WAIT') {
        if (uploadedFile) {
            let extracted = null;
            try {
                extracted = await inspectAndExtractDocument(uploadedFile.path, { isTnega: true });
            } catch (_) {}

            const validation = validateUploadedDocument('applicantEducationProof', extracted);
            if (!validation.valid) {
                try { if (fs.existsSync(uploadedFile.path)) fs.unlinkSync(uploadedFile.path); } catch (_) {}
                delete sess.citizenProfile.applicantEducationProof;
                delete sess.citizenProfile.studentTc;
                if (sess.tempUploads) delete sess.tempUploads.applicantEducationProof;
                if (sess.citizenProfile.documents) delete sess.citizenProfile.documents.applicantEducationProof;
                persistSessions();

                sess.chatHistory.push({
                    sender: 'bot',
                    text: validation.errorTamil,
                    options: [
                        { label: "📷 மாணவர் 12th TC பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                        { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
                    ]
                });
                res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
                return true;
            }

            const compliantProof = await produceCompliantDocument(uploadedFile.path);
            sess.citizenProfile.applicantEducationProof = compliantProof;
            sess.citizenProfile.studentTc = compliantProof;
            if (!sess.tempUploads) sess.tempUploads = {};
            sess.tempUploads.applicantEducationProof = compliantProof;
            if (!sess.citizenProfile.documents) sess.citizenProfile.documents = {};
            sess.citizenProfile.documents.applicantEducationProof = compliantProof;

            let extraInfo = '';
            if (extracted && (extracted.fullNameTam || extracted.fullNameEng)) {
                if (extracted.fullNameTam) sess.citizenProfile.fullNameTam = extracted.fullNameTam;
                if (extracted.fullNameEng) sess.citizenProfile.fullNameEng = extracted.fullNameEng;
                if (extracted.fatherNameTam) sess.citizenProfile.fatherNameTam = extracted.fatherNameTam;
                if (extracted.fatherNameEng) sess.citizenProfile.fatherNameEng = extracted.fatherNameEng;
                if (extracted.dob) sess.citizenProfile.dob = extracted.dob;
                if (extracted.community) sess.citizenProfile.community = extracted.community;
                if (extracted.caste) sess.citizenProfile.caste = extracted.caste;
                extraInfo = `\n\n📄 **மாற்றுச் சான்றிதழிலிருந்து (TC) விவரங்கள் தானாகப் பெறப்பட்டன:**\n• மாணவர்: **${extracted.fullNameTam || extracted.fullNameEng}** | பிறந்த தேதி: **${extracted.dob || '—'}**\n• தந்தை: **${extracted.fatherNameTam || extracted.fatherNameEng || '—'}** ✅`;
            }

            persistSessions();
            const flowStep = advanceTnegaFirstGraduateFlow(sess, `✅ **மாணவரின் 12-ஆம் வகுப்பு மாற்றுச் சான்றிதழ் (TC) வெற்றிகரமாகப் பெறப்பட்டது!** 🛡️${extraInfo}`);
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
    // FIRST GRADUATE: FAMILY SMART CARD UPLOAD GATE
    // -------------------------------------------------------------------------
    if (sess.intakeState === 'FIRST_GRADUATE_SMARTCARD_WAIT') {
        if (uploadedFile) {
            let extracted = null;
            try {
                extracted = await inspectAndExtractDocument(uploadedFile.path, { isTnega: true });
            } catch (_) {}

            const validation = validateUploadedDocument('smartCard', extracted);
            if (!validation.valid) {
                try { if (fs.existsSync(uploadedFile.path)) fs.unlinkSync(uploadedFile.path); } catch (_) {}
                delete sess.citizenProfile.smartCard;
                delete sess.citizenProfile.rationCard;
                if (sess.tempUploads) delete sess.tempUploads.smartCard;
                if (sess.citizenProfile.documents) delete sess.citizenProfile.documents.smartCard;
                persistSessions();

                sess.chatHistory.push({
                    sender: 'bot',
                    text: validation.errorTamil,
                    options: [
                        { label: "📷 குடும்ப அட்டை பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                        { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
                    ]
                });
                res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
                return true;
            }

            const compliantProof = await produceCompliantDocument(uploadedFile.path);
            sess.citizenProfile.smartCard = compliantProof;
            sess.citizenProfile.rationCard = compliantProof;
            if (!sess.tempUploads) sess.tempUploads = {};
            sess.tempUploads.smartCard = compliantProof;
            if (!sess.citizenProfile.documents) sess.citizenProfile.documents = {};
            sess.citizenProfile.documents.smartCard = compliantProof;

            persistSessions();
            const flowStep = advanceTnegaFirstGraduateFlow(sess, `✅ **குடும்ப ஸ்மார்ட் அட்டை வெற்றிகரமாகப் பெறப்பட்டது!** 🛡️`);
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
    // FIRST GRADUATE: FATHER & MOTHER EDUCATION PROOF UPLOAD GATES
    // -------------------------------------------------------------------------
    if (sess.intakeState === 'FIRST_GRADUATE_FATHER_PROOF_WAIT' || sess.intakeState === 'FIRST_GRADUATE_PARENTS_PROOF_WAIT') {
        if (uploadedFile) {
            let extracted = null;
            try {
                extracted = await inspectAndExtractDocument(uploadedFile.path, { isTnega: true });
            } catch (_) {}

            const validation = validateUploadedDocument('fatherEducationProof', extracted);
            if (!validation.valid) {
                try { if (fs.existsSync(uploadedFile.path)) fs.unlinkSync(uploadedFile.path); } catch (_) {}
                delete sess.citizenProfile.fatherEducationProof;
                if (sess.tempUploads) delete sess.tempUploads.fatherEducationProof;
                if (sess.citizenProfile.documents) delete sess.citizenProfile.documents.fatherEducationProof;
                persistSessions();

                sess.chatHistory.push({
                    sender: 'bot',
                    text: validation.errorTamil,
                    options: [
                        { label: "📷 தந்தையின் TC / ஆவணம் பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                        { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
                    ]
                });
                res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
                return true;
            }

            const compliantProof = await produceCompliantDocument(uploadedFile.path);
            sess.citizenProfile.fatherEducationProof = compliantProof;
            sess.citizenProfile.fatherTc = compliantProof;
            if (!sess.tempUploads) sess.tempUploads = {};
            sess.tempUploads.fatherEducationProof = compliantProof;
            if (!sess.citizenProfile.documents) sess.citizenProfile.documents = {};
            sess.citizenProfile.documents.fatherEducationProof = compliantProof;
            if (sess.intakeState === 'FIRST_GRADUATE_PARENTS_PROOF_WAIT') {
                sess.citizenProfile.motherEducationProof = compliantProof;
                sess.citizenProfile.documents.motherEducationProof = compliantProof;
            }

            persistSessions();
            const flowStep = advanceTnegaFirstGraduateFlow(sess, `✅ **தந்தையின் கல்வி ஆவணம் (Father TC) வெற்றிகரமாகப் பெறப்பட்டது!** 🛡️`);
            sess.chatHistory.push({
                sender: 'bot',
                text: flowStep.text,
                options: flowStep.options
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }
    }

    if (sess.intakeState === 'FIRST_GRADUATE_MOTHER_PROOF_WAIT') {
        if (uploadedFile) {
            let extracted = null;
            try {
                extracted = await inspectAndExtractDocument(uploadedFile.path, { isTnega: true });
            } catch (_) {}

            const validation = validateUploadedDocument('motherEducationProof', extracted);
            if (!validation.valid) {
                try { if (fs.existsSync(uploadedFile.path)) fs.unlinkSync(uploadedFile.path); } catch (_) {}
                delete sess.citizenProfile.motherEducationProof;
                if (sess.tempUploads) delete sess.tempUploads.motherEducationProof;
                if (sess.citizenProfile.documents) delete sess.citizenProfile.documents.motherEducationProof;
                persistSessions();

                sess.chatHistory.push({
                    sender: 'bot',
                    text: validation.errorTamil,
                    options: [
                        { label: "📷 தாயாரின் TC / ஆவணம் பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                        { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
                    ]
                });
                res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
                return true;
            }

            const compliantProof = await produceCompliantDocument(uploadedFile.path);
            sess.citizenProfile.motherEducationProof = compliantProof;
            sess.citizenProfile.motherTc = compliantProof;
            if (!sess.tempUploads) sess.tempUploads = {};
            sess.tempUploads.motherEducationProof = compliantProof;
            if (!sess.citizenProfile.documents) sess.citizenProfile.documents = {};
            sess.citizenProfile.documents.motherEducationProof = compliantProof;

            persistSessions();
            const flowStep = advanceTnegaFirstGraduateFlow(sess, `✅ **தாயாரின் கல்வி ஆவணம் (Mother TC) வெற்றிகரமாகப் பெறப்பட்டது!** 🛡️`);
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
    // OBC CERTIFICATE INTAKE GATES (TNeGA REV-115 — Document-First + Delta)
    // -------------------------------------------------------------------------
    if (sess.intakeState === 'OBC_AADHAAR_WAIT' || sess.intakeState === 'OBC_AADHAAR_BACK_WAIT' || sess.intakeState === 'OBC_INTAKE') {
        if (uploadedFile || sess.intakeState === 'OBC_AADHAAR_BACK_WAIT') {
            const handled = await handleTnegaAadhaarUploadHelper({
                ctx,
                req,
                res,
                backWaitState: 'OBC_AADHAAR_BACK_WAIT',
                advanceFlowFn: advanceTnegaObcFlow
            });
            if (handled) return true;
        }
    }

    if (sess.intakeState === 'OBC_COMMUNITY_PROOF_WAIT' && uploadedFile) {
        let extracted = null;
        try {
            extracted = await inspectAndExtractDocument(uploadedFile.path, { isTnega: true });
        } catch (_) {}

        const validation = validateUploadedDocument('communityProof', extracted);
        if (!validation.valid) {
            try { if (fs.existsSync(uploadedFile.path)) fs.unlinkSync(uploadedFile.path); } catch (_) {}
            sess.chatHistory.push({
                sender: 'bot',
                text: validation.errorTamil,
                options: [
                    { label: "📜 சாதிச் சான்றிதழ் பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                    { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
                ]
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }

        const compliantProof = await produceCompliantDocument(uploadedFile.path);
        sess.citizenProfile.communityProof = compliantProof;
        sess.citizenProfile.communityCertificate = compliantProof;
        sess.citizenProfile.communityCertificatePath = compliantProof;
        if (!sess.tempUploads) sess.tempUploads = {};
        sess.tempUploads.communityCertificate = compliantProof;
        sess.tempUploads.communityProof = compliantProof;
        if (!sess.citizenProfile.documents) sess.citizenProfile.documents = {};
        sess.citizenProfile.documents.communityCertificate = compliantProof;
        sess.citizenProfile.documents.communityProof = compliantProof;

        let extraInfo = '';
        if (extracted && (extracted.caste || extracted.subCaste)) {
            const c = extracted.caste || extracted.subCaste;
            sess.citizenProfile.caste = c;
            if (extracted.community) sess.citizenProfile.community = extracted.community;
            extraInfo = `\n• 🏷️ **சாதி:** **${c}** (தானாகப் பிரித்தெடுக்கப்பட்டது ✅)`;
        }
        persistSessions();
        const flowStep = advanceTnegaObcFlow(sess, `✅ **சாதிச் சான்றிதழ் (Community Certificate) வெற்றிகரமாகப் பெறப்பட்டது!**${extraInfo}`);
        sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    if (sess.intakeState === 'OBC_INCOME_PROOF_WAIT' && uploadedFile) {
        let extracted = null;
        try {
            extracted = await inspectAndExtractDocument(uploadedFile.path, { isTnega: true });
        } catch (_) {}

        const validation = validateUploadedDocument('incomeProof', extracted);
        if (!validation.valid) {
            try { if (fs.existsSync(uploadedFile.path)) fs.unlinkSync(uploadedFile.path); } catch (_) {}
            sess.chatHistory.push({
                sender: 'bot',
                text: validation.errorTamil,
                options: [
                    { label: "💰 வருமான / ITR சான்று பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                    { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
                ]
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }

        const compliantProof = await produceCompliantDocument(uploadedFile.path);
        sess.citizenProfile.incomeTaxReturn = compliantProof;
        sess.citizenProfile.incomeProof = compliantProof;
        if (!sess.tempUploads) sess.tempUploads = {};
        sess.tempUploads.incomeTaxReturn = compliantProof;
        sess.tempUploads.incomeProof = compliantProof;
        if (!sess.citizenProfile.documents) sess.citizenProfile.documents = {};
        sess.citizenProfile.documents.incomeTaxReturn = compliantProof;
        sess.citizenProfile.documents.incomeProof = compliantProof;

        let extraInc = '';
        if (extracted && extracted.annualIncome) {
            const cleanInc = String(extracted.annualIncome).replace(/\D+/g, '');
            if (cleanInc) {
                sess.citizenProfile.annualIncome = cleanInc;
                extraInc = `\n• 💰 **ஆண்டு வருமானம்:** ₹${cleanInc} (தானாகப் பிரித்தெடுக்கப்பட்டது ✅)`;
            }
        }
        persistSessions();
        const flowStep = advanceTnegaObcFlow(sess, `✅ **வருமான வரி / வருமானச் சான்று வெற்றிகரமாகப் பெறப்பட்டது!**${extraInc}`);
        sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    if ((sess.intakeState === 'OBC_CASTE_WAIT' || (text && text.startsWith('OBC_CASTE:'))) && text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
        const val = text.startsWith('OBC_CASTE:') ? text.replace('OBC_CASTE:', '').trim() : text.trim();
        sess.citizenProfile.caste = val;
        persistSessions();
        const flowStep = advanceTnegaObcFlow(sess, `✅ OBC சாதி **${val}** எனப் பதிவானது!`);
        sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    if ((sess.intakeState === 'OBC_OCCUPATION_WAIT' || (text && text.startsWith('OBC_OCC:'))) && text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
        const val = text.startsWith('OBC_OCC:') ? text.replace('OBC_OCC:', '').trim() : text.trim();
        sess.citizenProfile.occupation = val;
        sess.citizenProfile.applicantOccupation = val;
        persistSessions();
        const flowStep = advanceTnegaObcFlow(sess, `✅ விண்ணப்பதாரர் பணி **${val}** எனப் பதிவானது!`);
        sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    if ((sess.intakeState === 'OBC_FATHER_OCC_WAIT' || (text && text.startsWith('OBC_FA_OCC:'))) && text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
        const raw = text.startsWith('OBC_FA_OCC:') ? text.replace('OBC_FA_OCC:', '').trim() : text.trim();
        if (/deceased|காலமான/i.test(raw)) {
            sess.citizenProfile.fatherAlive = false;
            sess.citizenProfile.fatherOccupation = 'Deceased';
        } else if (raw.includes('|')) {
            const [nat, occ] = raw.split('|');
            sess.citizenProfile.fatherAlive = true;
            sess.citizenProfile.fatherEmploymentNature = nat.trim();
            sess.citizenProfile.fatherOccupation = occ.trim();
        } else {
            sess.citizenProfile.fatherAlive = true;
            sess.citizenProfile.fatherOccupation = raw;
        }
        persistSessions();
        const flowStep = advanceTnegaObcFlow(sess, `✅ தந்தையின் பணி நிலை **${sess.citizenProfile.fatherOccupation}** எனப் பதிவானது!`);
        sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    if ((sess.intakeState === 'OBC_MOTHER_OCC_WAIT' || (text && text.startsWith('OBC_MO_OCC:'))) && text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
        const raw = text.startsWith('OBC_MO_OCC:') ? text.replace('OBC_MO_OCC:', '').trim() : text.trim();
        if (/deceased|காலமான/i.test(raw)) {
            sess.citizenProfile.motherAlive = false;
            sess.citizenProfile.motherOccupation = 'Deceased';
        } else if (raw.includes('|')) {
            const [nat, occ] = raw.split('|');
            sess.citizenProfile.motherAlive = true;
            sess.citizenProfile.motherEmploymentNature = nat.trim();
            sess.citizenProfile.motherOccupation = occ.trim();
        } else {
            sess.citizenProfile.motherAlive = true;
            sess.citizenProfile.motherOccupation = raw;
        }
        persistSessions();
        const flowStep = advanceTnegaObcFlow(sess, `✅ தாயின் பணி நிலை **${sess.citizenProfile.motherOccupation}** எனப் பதிவானது!`);
        sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    if ((sess.intakeState === 'OBC_INCOME_WAIT' || (text && text.startsWith('OBC_INCOME:'))) && text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
        const cleanInc = text.replace('OBC_INCOME:', '').replace(/\D+/g, '') || text.trim();
        sess.citizenProfile.annualIncome = cleanInc;
        persistSessions();
        const flowStep = advanceTnegaObcFlow(sess, `✅ குடும்ப ஆண்டு வருமானம் **₹${cleanInc}** எனப் பதிவானது!`);
        sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
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
            let extracted = null;
            try {
                extracted = await inspectAndExtractDocument(uploadedFile.path, { isTnega: true });
            } catch (_) {}

            const validation = validateUploadedDocument('communityProof', extracted);
            if (!validation.valid) {
                try {
                    if (fs.existsSync(uploadedFile.path)) fs.unlinkSync(uploadedFile.path);
                } catch (_) {}

                delete sess.citizenProfile.communityProof;
                delete sess.citizenProfile.communityCertificatePath;
                delete sess.citizenProfile.familyCommunityProofPath;
                if (sess.tempUploads) delete sess.tempUploads.communityProof;
                if (sess.citizenProfile.documents) delete sess.citizenProfile.documents.communityProof;
                persistSessions();

                sess.chatHistory.push({
                    sender: 'bot',
                    text: validation.errorTamil,
                    options: [
                        { label: "📷 சாதிச் சான்றிதழ் / பள்ளி TC பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                        { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
                    ]
                });
                res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
                return true;
            }

            const compliantProof = await produceCompliantDocument(uploadedFile.path);
            sess.citizenProfile.communityProof = compliantProof;
            sess.citizenProfile.communityCertificatePath = compliantProof;
            sess.citizenProfile.familyCommunityProofPath = compliantProof;
            if (!sess.tempUploads) sess.tempUploads = {};
            sess.tempUploads.communityProof = compliantProof;
            if (!sess.citizenProfile.documents) sess.citizenProfile.documents = {};
            sess.citizenProfile.documents.communityProof = compliantProof;
            delete sess.citizenProfile.communityProofSkipped;

            let extraInfo = '';
            if (extracted && (extracted.caste || extracted.subCaste)) {
                const c = extracted.caste || extracted.subCaste;
                sess.citizenProfile.caste = c;
                if (extracted.community) sess.citizenProfile.community = extracted.community;
                sess.citizenProfile.fatherCaste = extracted.fatherCaste || c;
                sess.citizenProfile.motherCaste = extracted.motherCaste || c;
                sess.citizenProfile.requestedCaste = c;
                sess.citizenProfile.parentCasteConfirmed = true;
                extraInfo = `\n\n📄 **சான்றிதழிலிருந்து விவரங்கள் தானாகப் பெறப்பட்டன:**\n• வகுப்பு: **${sess.citizenProfile.community}** | சாதி: **${c}**\n• தந்தை சாதி: **${sess.citizenProfile.fatherCaste}** | தாய் சாதி: **${sess.citizenProfile.motherCaste}** ✅`;
            } else if (!sess.citizenProfile.caste) {
                extraInfo = `\n\n⚠️ **குறிப்பு:** பதிவேற்றப்பட்ட ஆவணத்தில் சாதி விவரங்கள் இல்லை. எனவே அடுத்த படியில் பெற்றோர் மற்றும் விண்ணப்பதாரரின் சாதி விவரங்களை உள்ளிடவும்.`;
            }

            persistSessions();

            const flowStep = advanceTnegaCommunityFlow(sess, `✅ **குடும்ப சாதிச் சான்றிதழ் / பள்ளி TC வெற்றிகரமாகப் பெறப்பட்டது!** 🛡️${extraInfo}`);
            sess.chatHistory.push({
                sender: 'bot',
                text: flowStep.text,
                options: flowStep.options
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }

        if (text === 'SKIP_COMMUNITY_PROOF' || text.includes('ஏற்கெனவே உள்ளது') || text.includes('பிறகு பதிவேற்றுக') || text === 'CONTINUE_WITHOUT_COMM_PROOF') {
            sess.chatHistory.push({
                sender: 'bot',
                text: `🛑 **கட்டாய ஆவணம் தேவை (Mandatory Document Gate):**\n\n` +
                      `அரசு விதிகளின்படி சாதிச் சான்றிதழ் (REV-101) விண்ணப்பிக்க **தந்தை / தாய் / உடன்பிறந்தோரின் சாதிச் சான்றிதழ்** அல்லது விண்ணப்பதாரரின் **பள்ளி மாற்றுச் சான்றிதழ் (School TC)** போர்ட்டலில் கட்டாயம் பதிவேற்றப்பட வேண்டும்.\n\n` +
                      `⚠️ *இந்த ஆவணம் இல்லாமல் விண்ணப்பத்தைத் தொடர முடியாது.*\n\n` +
                      `தயவுசெய்து சான்றிதழைப் பதிவேற்றவும்:`,
                options: [
                    { label: "📷 சாதிச் சான்றிதழ் / பள்ளி TC பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                    { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
                ]
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }
    }

    // -------------------------------------------------------------------------
    // RESIDENCE PROOF DOCUMENT UPLOAD GATE (TNeGA REV-102)
    // -------------------------------------------------------------------------
    if (sess.intakeState === 'RESIDENCE_PROOF_WAIT' || sess.intakeState === 'RESIDENCE_PROOF_DOC') {
        if (uploadedFile) {
            let extracted = null;
            try {
                extracted = await inspectAndExtractDocument(uploadedFile.path, { isTnega: true });
            } catch (_) {}

            const validation = validateUploadedDocument('residenceProof', extracted);
            if (!validation.valid) {
                try {
                    if (fs.existsSync(uploadedFile.path)) fs.unlinkSync(uploadedFile.path);
                } catch (_) {}

                delete sess.citizenProfile.residenceProof;
                if (sess.tempUploads) delete sess.tempUploads.residenceProof;
                if (sess.citizenProfile.documents) delete sess.citizenProfile.documents.residenceProof;
                persistSessions();

                sess.chatHistory.push({
                    sender: 'bot',
                    text: validation.errorTamil,
                    options: [
                        { label: "📷 இருப்பிட ஆதாரம் பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                        { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
                    ]
                });
                res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
                return true;
            }

            const compliantProof = await produceCompliantDocument(uploadedFile.path);
            sess.citizenProfile.residenceProof = compliantProof;
            if (!sess.tempUploads) sess.tempUploads = {};
            sess.tempUploads.residenceProof = compliantProof;
            if (!sess.citizenProfile.documents) sess.citizenProfile.documents = {};
            sess.citizenProfile.documents.residenceProof = compliantProof;

            persistSessions();

            const flowStep = advanceTnegaResidenceFlow(sess, `✅ **இருப்பிட ஆதாரம் வெற்றிகரமாகப் பெறப்பட்டது!** 🛡️`);
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
    // MANDATORY APPLICANT PASSPORT PHOTO GATE (TNeGA Revenue Services)
    // -------------------------------------------------------------------------
    if (['COMMUNITY_PHOTO_WAIT', 'INCOME_PHOTO_WAIT', 'RESIDENCE_PHOTO_WAIT', 'FIRST_GRADUATE_PHOTO_WAIT', 'OBC_PHOTO_WAIT'].includes(sess.intakeState)) {
        if (text === 'TRIGGER_FILE_UPLOAD' || text?.includes('புகைப்படம் பதிவேற்றுக') || text === 'UPLOAD_PHOTO') {
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
            try {
                extracted = await inspectAndExtractDocument(uploadedFile.path, { isTnega: true });
            } catch (_) {}

            // Zero-Crop Law: Reject Aadhaar/Certificates uploaded in photo field
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

            // Quality Check
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
                const { saveCitizenDraft } = require('../../../firestore_db');
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

            const flowStep = sess.intakeState === 'OBC_PHOTO_WAIT'
                ? advanceTnegaObcFlow(sess, `✨ **ஏஐ போட்டோ ஸ்டுடியோ:** விண்ணப்பதாரர் பாஸ்போர்ட் புகைப்படம் (<50KB) தயார் செய்யப்பட்டு சேமிக்கப்பட்டது! 📸`)
                : (sess.intakeState === 'COMMUNITY_PHOTO_WAIT'
                    ? advanceTnegaCommunityFlow(sess, `✨ **ஏஐ போட்டோ ஸ்டுடியோ:** விண்ணப்பதாரர் பாஸ்போர்ட் புகைப்படம் அரசு விதிகளுக்கு ஏற்ப (<50KB) தயார் செய்யப்பட்டு சேமிக்கப்பட்டது! 📸`)
                    : (sess.intakeState === 'FIRST_GRADUATE_PHOTO_WAIT'
                        ? advanceTnegaFirstGraduateFlow(sess, `✨ **ஏஐ போட்டோ ஸ்டுடியோ:** மாணவர் பாஸ்போர்ட் புகைப்படம் அரசு விதிகளுக்கு ஏற்ப (<50KB) தயார் செய்யப்பட்டு சேமிக்கப்பட்டது! 📸`)
                        : (sess.intakeState === 'INCOME_PHOTO_WAIT'
                            ? advanceTnegaIncomeFlow(sess, `✨ **ஏஐ போட்டோ ஸ்டுடியோ:** விண்ணப்பதாரர் பாஸ்போர்ட் புகைப்படம் அரசு விதிகளுக்கு ஏற்ப (<50KB) தயார் செய்யப்பட்டு சேமிக்கப்பட்டது! 📸`)
                            : advanceTnegaResidenceFlow(sess, `✨ **ஏஐ போட்டோ ஸ்டுடியோ:** விண்ணப்பதாரர் பாஸ்போர்ட் புகைப்படம் அரசு விதிகளுக்கு ஏற்ப (<50KB) தயார் செய்யப்பட்டு சேமிக்கப்பட்டது! 📸`))));

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
