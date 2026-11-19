const storageService = require('../../services/storage_service');
const { isProfileDataComplete } = require('../../services/profile_helpers');
const { MEMBER_COUNT_OPTIONS } = require('../../core/chat_fsm');
const { 
    startTnpdsRationCardFlow, 
    startTnpdsAddMemberFlow, 
    startTnpdsAddressChangeFlow 
} = require('../../../tnpds_automation');
const { startTnegaCanRegisterFlow, startTnegaIncomeFlow, startTnegaResidenceFlow, startTnegaCommunityFlow, startTnegaFirstGraduateFlow, startTnegaObcFlow, startTnegaLegalHeirFlow, startTnegaWidowFlow } = require('../../../tnega_can_automation');
const { runAutomationTask } = require('./chat_automation_runner');

const { persistSessions } = storageService;

async function handleAutomationStarter(ctx, req, res) {
    const { text, sess, targetMobile } = ctx;
    const activeMobile = storageService.getActiveMobile();

    const isClientDev = req.headers['x-dev-mode'] === 'true' || (req.headers.host && (req.headers.host.includes('localhost') || req.headers.host.includes('127.0.0.1')));
    const isExplicitMock = req.body.forceRealGovtOtp === false || req.body.isMockSandbox === true || text.toLowerCase().includes('mock') || text.includes('சோதனை');
    const isExplicitLiveText = text.toLowerCase().includes('real_live_otp') || text.toLowerCase().includes('real') || text.includes('நேரலை') || text.includes('உண்மையான') || text.toLowerCase().includes('unmai') || text.toLowerCase().includes('unmya');

    let isStartCommand = false;
    let isRealGovtOtpRequested = false;

    const recognizedStartTokens = [
        'start', 'தொடங்கு', 'fill', '🚀 தொடங்கு', 'சமர்ப்பிக்கவும்',
        'start_income_apply', 'launch_can_automation', 'start_residence_apply', 'apply_residence_now',
        'start_community_apply', 'apply_community_now', 'start_first_graduate_apply', 'start_obc_apply',
        'start_legal_heir_apply', 'start_widow_apply'
    ];
    const isStartToken = recognizedStartTokens.some(tok => text.toLowerCase() === tok || (tok.length > 5 && text.includes(tok)));

    if (isExplicitMock) {
        sess.enableRealGovtOtp = false;
        if (isStartToken || text.includes('mock') || text.includes('சோதனை')) {
            isStartCommand = true;
        }
        isRealGovtOtpRequested = false;
    } else if (isExplicitLiveText) {
        sess.enableRealGovtOtp = true;
        isStartCommand = true;
        isRealGovtOtpRequested = true;
    } else if (isStartToken) {
        isStartCommand = true;
        if (req.body.forceRealGovtOtp === true || req.body.isMockSandbox === false) {
            sess.enableRealGovtOtp = true;
        }
        // In automated regression test environment, preserve safe mock testing safeguard.
        // In real operator desktop environment, default strictly to Live Production!
        const isRegressionEnv = process.env.NODE_ENV === 'test' || process.env.REGRESSION_TEST === 'true' || req.headers['x-operator-uid'] === 'test_suite_operator_uid';
        isRealGovtOtpRequested = isRegressionEnv ? Boolean(sess.enableRealGovtOtp) : (sess.enableRealGovtOtp !== false);
    }

    if (!isStartCommand) return false;

    const isMockTest = !isRealGovtOtpRequested;

    // TNeGA Dedicated Subservices (Community, Residence, Income & CAN Registration)
    // Golden Rule 6 & 11: Priority resolution to ensure Community/Residence/Income are never hijacked by CAN_REGISTER
    const pProfile = sess.citizenProfile || {};
    const hasCan = Boolean(sess.canNumber || pProfile.canNumber || pProfile.can);
    const targetServiceHint = String(sess.targetService || pProfile.targetService || sess.service || pProfile.service || sess.serviceId || pProfile.serviceId || '').toUpperCase();
    const intakeStateHint = String(sess.intakeState || pProfile.intakeState || '').toUpperCase();
    const explicitSub = String(sess.subService || pProfile.subService || '').toUpperCase();

    const isExplicitWidow = targetServiceHint.includes('WIDOW') || targetServiceHint.includes('விதவை') || intakeStateHint.includes('WIDOW') || explicitSub === 'WIDOW' || explicitSub === 'WIDOW_CERTIFICATE';
    const isExplicitLegalHeir = !isExplicitWidow && (targetServiceHint.includes('LEGAL_HEIR') || targetServiceHint.includes('வாரிசு') || intakeStateHint.includes('LEGAL_HEIR') || explicitSub === 'LEGAL_HEIR' || explicitSub === 'LEGAL_HEIR_CERTIFICATE');
    const isExplicitObc = !isExplicitWidow && !isExplicitLegalHeir && (targetServiceHint.includes('OBC') || targetServiceHint.includes('இதர பிற்படுத்தப்பட்டோர்') || intakeStateHint.includes('OBC') || explicitSub === 'OBC' || explicitSub === 'OBC_CERTIFICATE');
    const isExplicitFirstGrad = !isExplicitWidow && !isExplicitLegalHeir && !isExplicitObc && (targetServiceHint.includes('FIRST_GRADUATE') || targetServiceHint.includes('முதல் பட்டதாரி') || intakeStateHint.includes('FIRST_GRADUATE') || explicitSub === 'FIRST_GRADUATE' || explicitSub === 'FIRST_GRADUATE_CERTIFICATE');
    const isExplicitIncome = !isExplicitWidow && !isExplicitLegalHeir && !isExplicitObc && !isExplicitFirstGrad && (targetServiceHint.includes('INCOME') || targetServiceHint.includes('வருமானம்') || intakeStateHint.includes('INCOME') || explicitSub === 'INCOME' || explicitSub === 'INCOME_CERTIFICATE');
    const isExplicitResidence = targetServiceHint.includes('RESIDENCE') || targetServiceHint.includes('NATIVITY') || targetServiceHint.includes('இருப்பிடம்') || intakeStateHint.includes('RESIDENCE') || intakeStateHint.includes('NATIVITY') || explicitSub === 'RESIDENCE' || explicitSub === 'RESIDENCE_CERTIFICATE';
    const isExplicitCommunity = targetServiceHint.includes('COMMUNITY') || targetServiceHint.includes('சாதி') || intakeStateHint.includes('COMMUNITY') || explicitSub === 'COMMUNITY' || explicitSub === 'COMMUNITY_CERTIFICATE';

    const isWidowService = isExplicitWidow;
    const isLegalHeirService = !isWidowService && isExplicitLegalHeir;
    const isObcService = !isWidowService && !isLegalHeirService && isExplicitObc;

    const isCommunityService = !isWidowService && !isLegalHeirService && !isObcService && (isExplicitCommunity || (
                               !isExplicitFirstGrad && !isExplicitIncome && !isExplicitResidence && !explicitSub &&
                               Boolean(pProfile.caste || pProfile.community)
                               ));

    const isResidenceService = !isWidowService && !isLegalHeirService && !isObcService && !isCommunityService && isExplicitResidence;

    const isIncomeService = !isWidowService && !isLegalHeirService && !isObcService && !isCommunityService && !isResidenceService && isExplicitIncome;

    const isFirstGraduateService = !isWidowService && !isLegalHeirService && !isObcService && !isCommunityService && !isResidenceService && !isIncomeService && (
                                   isExplicitFirstGrad ||
                                   (!explicitSub && Boolean(pProfile.currentCourse || pProfile.institutionName))
                                   );

    const isWidowAction = text === 'START_WIDOW_APPLY' || (
        (text.toLowerCase() === 'start' || text === 'தொடங்கு' || text === '🚀 தொடங்கு') &&
        (isWidowService || sess.intakeState === 'READY_TO_SUBMIT_WIDOW')
    );

    const isLegalHeirAction = !isWidowAction && (text === 'START_LEGAL_HEIR_APPLY' || (
        (text.toLowerCase() === 'start' || text === 'தொடங்கு' || text === '🚀 தொடங்கு') &&
        (isLegalHeirService || sess.intakeState === 'READY_TO_SUBMIT_LEGAL_HEIR')
    ));

    const isObcAction = !isWidowAction && !isLegalHeirAction && (text === 'START_OBC_APPLY' || (
        (text.toLowerCase() === 'start' || text === 'தொடங்கு' || text === '🚀 தொடங்கு') &&
        (isObcService || sess.intakeState === 'READY_TO_SUBMIT_OBC')
    ));

    const isCommunityAction = !isWidowAction && !isLegalHeirAction && !isObcAction && (text === 'START_COMMUNITY_APPLY' || text === 'APPLY_COMMUNITY_NOW' || (
        (text.toLowerCase() === 'start' || text === 'தொடங்கு' || text === '🚀 தொடங்கு') && 
        (isCommunityService || sess.intakeState === 'READY_TO_APPLY_COMMUNITY')
    ));

    const isResidenceAction = !isWidowAction && !isLegalHeirAction && !isObcAction && !isCommunityAction && (
        text === 'START_RESIDENCE_APPLY' || text === 'APPLY_RESIDENCE_NOW' || (
            (text.toLowerCase() === 'start' || text === 'தொடங்கு' || text === '🚀 தொடங்கு') && 
            (isResidenceService || sess.intakeState === 'READY_TO_APPLY_RESIDENCE')
        )
    );

    const isIncomeAction = !isWidowAction && !isLegalHeirAction && !isObcAction && !isCommunityAction && !isResidenceAction && (
        text === 'START_INCOME_APPLY' || (
            (text.toLowerCase() === 'start' || text === 'தொடங்கு' || text === '🚀 தொடங்கு') && 
            (isIncomeService || sess.intakeState === 'READY_TO_APPLY_INCOME')
        )
    );

    const isFirstGraduateAction = !isWidowAction && !isLegalHeirAction && !isObcAction && !isCommunityAction && !isResidenceAction && !isIncomeAction && (
        text === 'START_FIRST_GRADUATE_APPLY' || (
            (text.toLowerCase() === 'start' || text === 'தொடங்கு' || text === '🚀 தொடங்கு') && 
            (isFirstGraduateService || sess.intakeState === 'READY_TO_APPLY_FIRST_GRADUATE')
        )
    );

    const isCanRegisterAction = !isWidowAction && !isLegalHeirAction && !isObcAction && !isCommunityAction && !isResidenceAction && !isIncomeAction && !isFirstGraduateAction && (
        text === 'LAUNCH_CAN_AUTOMATION' || (
            (text.toLowerCase() === 'start' || text === 'தொடங்கு' || text === '🚀 தொடங்கு') && 
            !hasCan &&
            (sess.subService === 'CAN_REGISTER' || pProfile.subService === 'CAN_REGISTER' || sess.intakeState === 'READY_TO_APPLY_CAN')
        )
    );

    if (isWidowAction) {
        sess.subService = 'WIDOW';
        if (sess.citizenProfile) sess.citizenProfile.subService = 'WIDOW';
        const p = sess.citizenProfile || {};
        const modeText = isMockTest ? '🧪 சுயகற்றல் சோதனை முறை (Mock Sandbox)' : '🚀 நேரலை உற்பத்தி முறை (Live Production)';
        sess.chatHistory.push({
            sender: 'bot',
            text: `${modeText}யில் தமிழ்நாடு அரசு **TNeGA விதவைச் சான்றிதழ் (REV-109)** ஆட்டோமேஷன் தொடங்கப்படுகிறது! 🛡️\n\n` +
                  `• 🔢 **CAN எண்:** **${p.canNumber || 'தேடப்படும்'}** ✅\n` +
                  `• 👤 **விண்ணப்பதாரர்:** ${p.fullNameTam || p.fullNameEng || 'விண்ணப்பதாரர்'}\n` +
                  `• 🕊️ **கணவர் பெயர்:** ${p.spouseNameTam || p.spouseNameEng || p.husbandNameTam || p.fatherNameTam || '—'} (இறந்த தேதி: ${p.dateOfDeath || '15-Jan-2025'})\n` +
                  `• 📜 **இறப்புச் சான்றிதழ் எண்:** ${p.deathCertificateNo || 'DC-2025-88412'}\n\n` +
                  `Chrome உலாவியில் TNeGA REV-109 படிவம் திறக்கப்பட்டு, ஆப்ரேட்டர் Submit-க்குப் பிறகு 4 ஆவணங்களும் பதிவேற்றப்பட்டு **Pre-Submit Gate** வரை தானாக இயங்கும்...`
        });
        sess.isAutomating = true;
        sess.isAutomationRunning = true;
        sess.automationStep = 1;
        persistSessions();

        runAutomationTask(
            startTnegaWidowFlow,
            p,
            sess,
            p.mobileNumber || targetMobile || activeMobile,
            isMockTest,
            false,
            false,
            req
        );

        res.json({
            chatHistory: sess.chatHistory,
            citizenProfile: sess.citizenProfile,
            step: sess.intakeState,
            isAutomating: true,
            subService: 'WIDOW',
            serviceId: 'WIDOW_CERTIFICATE',
            targetService: 'WIDOW'
        });
        return true;
    }

    if (isLegalHeirAction) {
        sess.subService = 'LEGAL_HEIR';
        if (sess.citizenProfile) sess.citizenProfile.subService = 'LEGAL_HEIR';
        const p = sess.citizenProfile || {};
        const modeText = isMockTest ? '🧪 சுயகற்றல் சோதனை முறை (Mock Sandbox)' : '🚀 நேரலை உற்பத்தி முறை (Live Production)';
        sess.chatHistory.push({
            sender: 'bot',
            text: `${modeText}யில் தமிழ்நாடு அரசு **TNeGA சட்ட வாரிசு சான்றிதழ் (REV-114)** ஆட்டோமேஷன் தொடங்கப்படுகிறது! 🛡️\n\n` +
                  `• 🔢 **CAN எண்:** **${p.canNumber || 'தேடப்படும்'}** ✅\n` +
                  `• 👤 **விண்ணப்பதாரர்:** ${p.fullNameTam || p.fullNameEng || 'விண்ணப்பதாரர்'}\n` +
                  `• 🕊️ **இறந்தவர்:** ${p.deceasedNameTam || p.deceasedNameEng || p.fatherNameTam || '—'} (தேதி: ${p.dateOfDeath || '15-Jan-2025'})\n` +
                  `• 📜 **இறப்புச் சான்றிதழ் எண்:** ${p.deathCertificateNo || 'DC-2025-88412'}\n\n` +
                  `Chrome உலாவியில் TNeGA REV-114 படிவம் திறக்கப்பட்டு, ஆப்ரேட்டர் Submit-க்குப் பிறகு 4 ஆவணங்களும் பதிவேற்றப்பட்டு **Pre-Submit Gate** வரை தானாக இயங்கும்...`
        });
        sess.isAutomating = true;
        sess.isAutomationRunning = true;
        sess.automationStep = 1;
        persistSessions();

        runAutomationTask(
            startTnegaLegalHeirFlow,
            p,
            sess,
            p.mobileNumber || targetMobile || activeMobile,
            isMockTest,
            false,
            false,
            req
        );

        res.json({
            chatHistory: sess.chatHistory,
            citizenProfile: sess.citizenProfile,
            step: sess.intakeState,
            isAutomating: true,
            subService: 'LEGAL_HEIR',
            serviceId: 'LEGAL_HEIR_CERTIFICATE',
            targetService: 'LEGAL_HEIR'
        });
        return true;
    }

    if (isObcAction) {
        sess.subService = 'OBC';
        if (sess.citizenProfile) sess.citizenProfile.subService = 'OBC';
        const p = sess.citizenProfile || {};
        const fs = require('fs');

        const photoDoc = p.headPhotoPath || p.documents?.profilePhoto || sess.tempUploads?.profilePhoto;
        const hasPhoto = Boolean((photoDoc && fs.existsSync(photoDoc)) || sess.draftData?.base64Docs?.profilePhotoBase64);
        if (!hasPhoto) {
            sess.intakeState = 'OBC_PHOTO_WAIT';
            persistSessions();
            sess.chatHistory.push({
                sender: 'bot',
                text: `📸 **OBC சான்றிதழ் (REV-115) — புகைப்படம் தேவை:**\n\nதயவுசெய்து விண்ணப்பதாரரின் பாஸ்போர்ட் புகைப்படத்தை (<250x250px, <50KB) பதிவேற்றவும்:`,
                options: [{ label: "📸 புகைப்படம் பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" }]
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }

        const commDoc = p.communityCertificate || p.communityCertificatePath || p.communityProof || p.documents?.communityCertificate || p.documents?.communityProof || sess.tempUploads?.communityProof;
        const hasComm = Boolean((commDoc && fs.existsSync(commDoc)) || sess.draftData?.base64Docs?.communityProofBase64 || sess.draftData?.base64Docs?.communityCertificateBase64);
        if (!hasComm) {
            sess.intakeState = 'OBC_COMMUNITY_PROOF_WAIT';
            persistSessions();
            sess.chatHistory.push({
                sender: 'bot',
                text: `📜 **OBC சான்றிதழ் (REV-115) — சாதிச் சான்றிதழ் தேவை:**\n\nதயவுசெய்து சாதிச் சான்றிதழை (Community Certificate) பதிவேற்றவும்:`,
                options: [{ label: "📜 சாதிச் சான்றிதழ் பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" }]
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }

        const incDoc = p.incomeTaxReturn || p.incomeProof || p.salarySlip || p.documents?.incomeTaxReturn || p.documents?.incomeProof || sess.tempUploads?.incomeTaxReturn || sess.tempUploads?.incomeProof;
        const hasInc = Boolean((incDoc && fs.existsSync(incDoc)) || sess.draftData?.base64Docs?.incomeTaxReturnBase64 || sess.draftData?.base64Docs?.incomeProofBase64);
        if (!hasInc) {
            sess.intakeState = 'OBC_INCOME_PROOF_WAIT';
            persistSessions();
            sess.chatHistory.push({
                sender: 'bot',
                text: `💰 **OBC சான்றிதழ் (REV-115) — வருமான / ITR சான்று தேவை:**\n\nதயவுசெய்து வருமான வரி (ITR) அல்லது வருமானச் சான்றைப் பதிவேற்றவும்:`,
                options: [{ label: "💰 வருமான / ITR சான்று பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" }]
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }

        const modeText = isMockTest ? '🧪 சுயகற்றல் சோதனை முறை (Mock Sandbox)' : '🚀 நேரலை உற்பத்தி முறை (Live Production)';
        sess.chatHistory.push({
            sender: 'bot',
            text: `${modeText}யில் தமிழ்நாடு அரசு **TNeGA OBC சான்றிதழ் (REV-115)** ஆட்டோமேஷன் தொடங்கப்படுகிறது! 🛡️\n\n` +
                  `• 🔢 **CAN எண்:** **${p.canNumber || 'தேடப்படும்'}** ✅\n` +
                  `• 👤 **விண்ணப்பதாரர்:** ${p.fullNameTam || p.fullNameEng || 'விண்ணப்பதாரர்'}\n` +
                  `• 🏷️ **OBC சாதி:** ${p.caste || p.subCaste || '—'}\n` +
                  `• 💰 **ஆண்டு வருமானம்:** ₹${p.annualIncome || '72000'}\n\n` +
                  `Chrome உலாவியில் TNeGA REV-115 படிவம் திறக்கப்பட்டு, அனைத்து 5 ஆவணங்களும் பதிவேற்றப்பட்டு **Pre-Submit Gate** வரை தானாக இயங்கும்...`
        });
        sess.isAutomating = true;
        sess.isAutomationRunning = true;
        sess.automationStep = 1;
        persistSessions();

        runAutomationTask(
            startTnegaObcFlow,
            p,
            sess,
            p.mobileNumber || targetMobile || activeMobile,
            isMockTest,
            false,
            false,
            req
        );

        res.json({
            chatHistory: sess.chatHistory,
            citizenProfile: sess.citizenProfile,
            step: sess.intakeState,
            isAutomating: true,
            subService: 'OBC',
            serviceId: 'OBC_CERTIFICATE',
            targetService: 'OBC'
        });
        return true;
    }

    if (isCommunityAction) {
        sess.subService = 'COMMUNITY';
        if (sess.citizenProfile) sess.citizenProfile.subService = 'COMMUNITY';
        const p = sess.citizenProfile || {};

        // 🛡️ PRE-FLIGHT MANDATORY DOCUMENT AUDIT (Golden Rule 6, 14 & 19)
        const fs = require('fs');
        const commDocPath = p.communityProof || p.communityCertificatePath || p.familyCommunityProofPath || p.documents?.communityProof || sess.tempUploads?.communityProof;
        const hasCommDoc = Boolean(commDocPath && fs.existsSync(commDocPath));
        const photoDocPath = p.headPhotoPath || p.documents?.profilePhoto || sess.tempUploads?.profilePhoto;
        const hasPhotoDoc = Boolean(photoDocPath && fs.existsSync(photoDocPath));
        const aadhaarDocPath = p.headAadhaarDocPath || p.documents?.headAadhaar || sess.tempUploads?.headAadhaar;
        const hasAadhaarDoc = Boolean(aadhaarDocPath && fs.existsSync(aadhaarDocPath));

        if (!hasCommDoc) {
            sess.intakeState = 'COMMUNITY_PROOF_WAIT';
            persistSessions();
            sess.chatHistory.push({
                sender: 'bot',
                text: `🛑 **விண்ணப்பிக்க முடியாது! (கட்டாய ஆவணம் விடுபட்டுள்ளது)**\n\n` +
                      `அரசு விதிகளின்படி சாதிச் சான்றிதழ் (REV-101) விண்ணப்பிக்க **தந்தை / தாய் / உடன்பிறந்தோரின் சாதிச் சான்றிதழ்** அல்லது விண்ணப்பதாரரின் **பள்ளி மாற்றுச் சான்றிதழ் (School TC)** கட்டாயம் பதிவேற்றப்பட வேண்டும்.\n\n` +
                      `⚠️ *இந்த ஆவணம் இல்லாமல் போர்ட்டலில் விண்ணப்பம் சமர்ப்பிக்கப்பட முடியாது.*\n\n` +
                      `தயவுசெய்து சான்றிதழைப் பதிவேற்றவும்:`,
                options: [
                    { label: "📷 சாதிச் சான்றிதழ் / பள்ளி TC பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                    { label: "✏️ விவரங்களைச் சரிபார் / திருத்து (Open Form)", value: "TRIGGER_EDIT_MODAL" }
                ]
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState, blocked: true });
            return true;
        }

        if (!hasPhotoDoc) {
            sess.intakeState = 'COMMUNITY_PHOTO_WAIT';
            persistSessions();
            sess.chatHistory.push({
                sender: 'bot',
                text: `🛑 **விண்ணப்பிக்க முடியாது! (விண்ணப்பதாரர் புகைப்படம் விடுபட்டுள்ளது)**\n\n` +
                      `சாதிச் சான்றிதழ் விண்ணப்பத்திற்கு விண்ணப்பதாரரின் **பாஸ்போர்ட் புகைப்படம்** கட்டாயம் தேவை (ஆதார் அட்டையிலிருந்து படம் வெட்டப்பட மாட்டாது).\n\n` +
                      `தயவுசெய்து நேரடிப் புகைப்படத்தைப் பதிவேற்றவும்:`,
                options: [
                    { label: "📷 பாஸ்போர்ட் புகைப்படம் பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                    { label: "✏️ விவரங்களைச் சரிபார் / திருத்து (Open Form)", value: "TRIGGER_EDIT_MODAL" }
                ]
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState, blocked: true });
            return true;
        }

        if (!hasAadhaarDoc && !p.headAadhaar) {
            sess.intakeState = 'COMMUNITY_AADHAAR_WAIT';
            persistSessions();
            sess.chatHistory.push({
                sender: 'bot',
                text: `🛑 **விண்ணப்பிக்க முடியாது! (ஆதார் அட்டை விடுபட்டுள்ளது)**\n\n` +
                      `சாதிச் சான்றிதழ் முகவரிச் சான்றாக விண்ணப்பதாரரின் **ஆதார் அட்டை** கட்டாயம் தேவை.\n\n` +
                      `தயவுசெய்து ஆதார் அட்டையைப் பதிவேற்றவும்:`,
                options: [
                    { label: "📷 ஆதார் அட்டை பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                    { label: "✏️ விவரங்களைச் சரிபார் / திருத்து (Open Form)", value: "TRIGGER_EDIT_MODAL" }
                ]
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState, blocked: true });
            return true;
        }

        const modeText = isMockTest ? '🧪 சுயகற்றல் சோதனை முறை (Mock Sandbox)' : '🚀 நேரலை உற்பத்தி முறை (Live Production)';
        sess.chatHistory.push({
            sender: 'bot',
            text: `${modeText}யில் தமிழ்நாடு அரசு TNeGA சாதிச் சான்றிதழ் (REV-101) விண்ணப்ப ஆட்டோமேஷன் தொடங்கப்படுகிறது! 🛡️\n\n` +
                  `• 🔢 **CAN எண்:** **${p.canNumber || '133370337878397'}** ✅\n` +
                  `• 👤 **விண்ணப்பதாரர்:** ${p.fullNameTam || p.fullNameEng || 'விண்ணப்பதாரர்'}\n` +
                  `• 👩 **தாயின் பெயர்:** ${p.motherNameTam || p.motherNameEng || '—'}\n` +
                  `• 🕉️ **மதம்:** ${p.religion || 'Hindu'}\n` +
                  `• 🏛️ **வகுப்பு:** ${p.community || 'MBC'} ✅\n` +
                  `• 🏷️ **சாதி உட்பிரிவு:** ${p.caste || p.subCaste || 'Agamudayar'} ✅\n` +
                  `• 🏠 **முகவரி:** ${p.doorNo ? p.doorNo + ', ' : ''}${p.streetTam || p.streetEng || ''}, ${p.village || ''} - ${p.pincode || ''}\n\n` +
                  `Chrome உலாவியில் TNeGA போர்ட்டல் மூலம் சாதிச் சான்றிதழ் படிவம் திறக்கப்படுகிறது...`
        });
        sess.isAutomating = true;
        sess.isAutomationRunning = true;
        sess.automationStep = 1;
        persistSessions();

        runAutomationTask(
            startTnegaCommunityFlow,
            p,
            sess,
            p.mobileNumber || targetMobile || activeMobile,
            isMockTest,
            false,
            false,
            req
        );

        res.json({
            chatHistory: sess.chatHistory,
            citizenProfile: sess.citizenProfile,
            step: sess.intakeState,
            isAutomating: true
        });
        return true;
    }

    if (isResidenceAction) {
        sess.subService = 'RESIDENCE';
        if (sess.citizenProfile) sess.citizenProfile.subService = 'RESIDENCE';
        const p = sess.citizenProfile || {};

        // 🛡️ PRE-FLIGHT MANDATORY DOCUMENT AUDIT (Golden Rule 6, 14 & 19)
        const fs = require('fs');
        const resDocPath = p.residenceProof?.docPath || p.residenceProof || p.documents?.residenceProof || p.documents?.gasBook || sess.tempUploads?.residenceProof || sess.tempUploads?.gasBook;
        const hasResDoc = Boolean(resDocPath && fs.existsSync(resDocPath));
        const photoDocPath = p.headPhotoPath || p.documents?.profilePhoto || sess.tempUploads?.profilePhoto;
        const hasPhotoDoc = Boolean(photoDocPath && fs.existsSync(photoDocPath));
        const aadhaarDocPath = p.headAadhaarDocPath || p.documents?.headAadhaar || sess.tempUploads?.headAadhaar;
        const hasAadhaarDoc = Boolean(aadhaarDocPath && fs.existsSync(aadhaarDocPath));

        if (!hasResDoc) {
            sess.intakeState = 'RESIDENCE_PROOF_WAIT';
            persistSessions();
            sess.chatHistory.push({
                sender: 'bot',
                text: `🛑 **விண்ணப்பிக்க முடியாது! (குடியிருப்புச் சான்று விடுபட்டுள்ளது)**\n\n` +
                      `அரசு விதிகளின்படி இருப்பிடச் சான்றிதழ் (REV-102) விண்ணப்பிக்க **எரிவாயு அட்டை (Gas Book), மின் கட்டண ரசீது (EB Bill), அல்லது வீட்டு வரி ரசீது** கட்டாயம் தேவை.\n\n` +
                      `தயவுசெய்து ஆவணத்தைப் பதிவேற்றவும்:`,
                options: [
                    { label: "📷 குடியிருப்புச் சான்று பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                    { label: "✏️ விவரங்களைச் சரிபார் / திருத்து (Open Form)", value: "TRIGGER_EDIT_MODAL" }
                ]
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState, blocked: true });
            return true;
        }

        if (!hasPhotoDoc) {
            sess.intakeState = 'RESIDENCE_PHOTO_WAIT';
            persistSessions();
            sess.chatHistory.push({
                sender: 'bot',
                text: `🛑 **விண்ணப்பிக்க முடியாது! (விண்ணப்பதாரர் புகைப்படம் விடுபட்டுள்ளது)**\n\n` +
                      `இருப்பிடச் சான்றிதழ் விண்ணப்பத்திற்கு விண்ணப்பதாரரின் **பாஸ்போர்ட் புகைப்படம்** கட்டாயம் தேவை (ஆதார் அட்டையிலிருந்து படம் வெட்டப்பட மாட்டாது).\n\n` +
                      `தயவுசெய்து நேரடிப் புகைப்படத்தைப் பதிவேற்றவும்:`,
                options: [
                    { label: "📷 பாஸ்போர்ட் புகைப்படம் பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                    { label: "✏️ விவரங்களைச் சரிபார் / திருத்து (Open Form)", value: "TRIGGER_EDIT_MODAL" }
                ]
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState, blocked: true });
            return true;
        }

        if (!hasAadhaarDoc && !p.headAadhaar) {
            sess.intakeState = 'RESIDENCE_AADHAAR_WAIT';
            persistSessions();
            sess.chatHistory.push({
                sender: 'bot',
                text: `🛑 **விண்ணப்பிக்க முடியாது! (ஆதார் அட்டை விடுபட்டுள்ளது)**\n\n` +
                      `இருப்பிடச் சான்றிதழ் முகவரிச் சான்றாக விண்ணப்பதாரரின் **ஆதார் அட்டை** கட்டாயம் தேவை.\n\n` +
                      `தயவுசெய்து ஆதார் அட்டையைப் பதிவேற்றவும்:`,
                options: [
                    { label: "📷 ஆதார் அட்டை பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                    { label: "✏️ விவரங்களைச் சரிபார் / திருத்து (Open Form)", value: "TRIGGER_EDIT_MODAL" }
                ]
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState, blocked: true });
            return true;
        }

        const modeText = isMockTest ? '🧪 சுயகற்றல் சோதனை முறை (Mock Sandbox)' : '🚀 நேரலை உற்பத்தி முறை (Live Production)';
        sess.chatHistory.push({
            sender: 'bot',
            text: `${modeText}யில் தமிழ்நாடு அரசு TNeGA இருப்பிடச் சான்றிதழ் (REV-102) விண்ணப்ப ஆட்டோமேஷன் தொடங்கப்படுகிறது! 🛡️\n\n` +
                  `• 🔢 **CAN எண்:** **${p.canNumber || '133370337878397'}** ✅\n` +
                  `• 👤 **விண்ணப்பதாரர்:** ${p.fullNameTam || p.fullNameEng || 'விண்ணப்பதாரர்'}\n` +
                  `• 📅 **வசிக்கும் காலம்:** ${p.yearsOfResidence || 'பிறப்பிலிருந்து'} ✅\n` +
                  `• 🎯 **நோக்கம்:** ${p.purposeOfCertificate || 'கல்வி / வேலைவாய்ப்பு'}\n` +
                  `• 🏠 **முகவரி:** ${p.doorNo ? p.doorNo + ', ' : ''}${p.streetTam || p.streetEng || ''}, ${p.village || ''} - ${p.pincode || ''}\n\n` +
                  `Chrome உலாவியில் TNeGA போர்ட்டல் மூலம் இருப்பிடச் சான்றிதழ் படிவம் திறக்கப்படுகிறது...`
        });
        sess.isAutomating = true;
        sess.isAutomationRunning = true;
        sess.automationStep = 1;
        persistSessions();

        runAutomationTask(
            startTnegaResidenceFlow,
            p,
            sess,
            p.mobileNumber || targetMobile || activeMobile,
            isMockTest,
            false,
            false,
            req
        );

        res.json({
            chatHistory: sess.chatHistory,
            citizenProfile: sess.citizenProfile,
            step: sess.intakeState,
            isAutomating: true
        });
        return true;
    }

    if (isIncomeAction) {
        sess.subService = 'INCOME';
        if (sess.citizenProfile) sess.citizenProfile.subService = 'INCOME';
        const p = sess.citizenProfile || {};

        // 🛡️ PRE-FLIGHT MANDATORY DOCUMENT AUDIT (Golden Rule 6, 14 & 19)
        const fs = require('fs');
        const incomeDocPath = p.incomeProof || p.salaryCertificatePath || p.salaryCertificate || p.documents?.incomeProof || p.documents?.salaryCertificate || sess.tempUploads?.incomeProof;
        const hasIncomeDoc = Boolean(incomeDocPath && fs.existsSync(incomeDocPath));
        const photoDocPath = p.headPhotoPath || p.documents?.profilePhoto || sess.tempUploads?.profilePhoto;
        const hasPhotoDoc = Boolean(photoDocPath && fs.existsSync(photoDocPath));
        const aadhaarDocPath = p.headAadhaarDocPath || p.documents?.headAadhaar || sess.tempUploads?.headAadhaar;
        const hasAadhaarDoc = Boolean(aadhaarDocPath && fs.existsSync(aadhaarDocPath));

        if (!hasIncomeDoc) {
            sess.intakeState = 'INCOME_PROOF_WAIT';
            persistSessions();
            sess.chatHistory.push({
                sender: 'bot',
                text: `🛑 **விண்ணப்பிக்க முடியாது! (வருமான ஆதாரம் விடுபட்டுள்ளது)**\n\n` +
                      `அரசு விதிகளின்படி வருமானச் சான்றிதழ் (REV-103) விண்ணப்பிக்க **சம்பளச் சான்று (Salary Certificate), ஊதிய ரசீது (Pay Slip / Bank Statement), அல்லது சுய அறிவிப்புப் படிவம் (Self-Declaration)** கட்டாயம் தேவை.\n\n` +
                      `தயவுசெய்து ஆவணத்தைப் பதிவேற்றவும்:`,
                options: [
                    { label: "📷 வருமான ஆதாரம் பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                    { label: "✏️ விவரங்களைச் சரிபார் / திருத்து (Open Form)", value: "TRIGGER_EDIT_MODAL" }
                ]
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState, blocked: true });
            return true;
        }

        if (!hasPhotoDoc) {
            sess.intakeState = 'INCOME_PHOTO_WAIT';
            persistSessions();
            sess.chatHistory.push({
                sender: 'bot',
                text: `🛑 **விண்ணப்பிக்க முடியாது! (விண்ணப்பதாரர் புகைப்படம் விடுபட்டுள்ளது)**\n\n` +
                      `வருமானச் சான்றிதழ் விண்ணப்பத்திற்கு விண்ணப்பதாரரின் **பாஸ்போர்ட் புகைப்படம்** கட்டாயம் தேவை (ஆதார் அட்டையிலிருந்து படம் வெட்டப்பட மாட்டாது).\n\n` +
                      `தயவுசெய்து நேரடிப் புகைப்படத்தைப் பதிவேற்றவும்:`,
                options: [
                    { label: "📷 பாஸ்போர்ட் புகைப்படம் பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                    { label: "✏️ விவரங்களைச் சரிபார் / திருத்து (Open Form)", value: "TRIGGER_EDIT_MODAL" }
                ]
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState, blocked: true });
            return true;
        }

        if (!hasAadhaarDoc && !p.headAadhaar) {
            sess.intakeState = 'INCOME_AADHAAR_WAIT';
            persistSessions();
            sess.chatHistory.push({
                sender: 'bot',
                text: `🛑 **விண்ணப்பிக்க முடியாது! (ஆதார் அட்டை விடுபட்டுள்ளது)**\n\n` +
                      `வருமானச் சான்றிதழ் முகவரிச் சான்றாக விண்ணப்பதாரரின் **ஆதார் அட்டை** கட்டாயம் தேவை.\n\n` +
                      `தயவுசெய்து ஆதார் அட்டையைப் பதிவேற்றவும்:`,
                options: [
                    { label: "📷 ஆதார் அட்டை பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                    { label: "✏️ விவரங்களைச் சரிபார் / திருத்து (Open Form)", value: "TRIGGER_EDIT_MODAL" }
                ]
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState, blocked: true });
            return true;
        }

        const modeText = isMockTest ? '🧪 சுயகற்றல் சோதனை முறை (Mock Sandbox)' : '🚀 நேரலை உற்பத்தி முறை (Live Production)';
        sess.chatHistory.push({
            sender: 'bot',
            text: `${modeText}யில் தமிழ்நாடு அரசு TNeGA வருமானச் சான்றிதழ் (REV-103) விண்ணப்ப ஆட்டோமேஷன் தொடங்கப்படுகிறது! 🛡️\n\n` +
                  `• 🔢 **CAN எண்:** **${p.canNumber || '—'}** ✅\n` +
                  `• 👤 **விண்ணப்பதாரர்:** ${p.fullNameTam || p.fullNameEng || 'விண்ணப்பதாரர்'}\n` +
                  `• 👩 **தாயின் பெயர்:** ${p.motherNameTam || p.motherNameEng || '—'}\n` +
                  `• 🏛️ **வகுப்பு:** ${p.community || '—'}\n` +
                  `• 💰 **ஆண்டு வருமானம்:** ₹${Number(p.annualIncome || 60000).toLocaleString('en-IN')}\n` +
                  `• 💼 **தொழில்:** ${p.profession || 'கூலி வேலை'}\n\n` +
                  `Chrome உலாவியில் TNeGA போர்ட்டல் மூலம் விண்ணப்பப் படிவம் திறக்கப்படுகிறது...`
        });
        sess.isAutomating = true;
        sess.isAutomationRunning = true;
        sess.automationStep = 1;
        persistSessions();

        runAutomationTask(
            startTnegaIncomeFlow,
            p,
            sess,
            p.mobileNumber || targetMobile || activeMobile,
            isMockTest,
            false,
            false,
            req
        );

        res.json({
            chatHistory: sess.chatHistory,
            citizenProfile: sess.citizenProfile,
            step: sess.intakeState,
            isAutomating: true
        });
        return true;
    }

    if (isFirstGraduateAction) {
        sess.subService = 'FIRST_GRADUATE';
        if (sess.citizenProfile) sess.citizenProfile.subService = 'FIRST_GRADUATE';
        const p = sess.citizenProfile || {};

        // 🛡️ PRE-FLIGHT MANDATORY DOCUMENT AUDIT (Golden Rule 6, 14 & 19)
        const fs = require('fs');
        const tcDocPath = p.applicantEducationProof || p.studentTc || p.twelfthMarksheet || p.documents?.applicantEducationProof || p.documents?.studentTc || sess.tempUploads?.applicantEducationProof;
        const hasTcDoc = Boolean(tcDocPath && fs.existsSync(tcDocPath));
        const photoDocPath = p.headPhotoPath || p.documents?.profilePhoto || sess.tempUploads?.profilePhoto;
        const hasPhotoDoc = Boolean(photoDocPath && fs.existsSync(photoDocPath));
        const aadhaarDocPath = p.headAadhaarDocPath || p.documents?.headAadhaar || sess.tempUploads?.headAadhaar;
        const hasAadhaarDoc = Boolean(aadhaarDocPath && fs.existsSync(aadhaarDocPath));

        if (!hasTcDoc) {
            sess.intakeState = 'FIRST_GRADUATE_APPLICANT_PROOF_WAIT';
            persistSessions();
            sess.chatHistory.push({
                sender: 'bot',
                text: `🛑 **விண்ணப்பிக்க முடியாது! (கட்டாய ஆவணம் விடுபட்டுள்ளது)**\n\n` +
                      `அரசு விதிகளின்படி முதல் பட்டதாரி சான்றிதழ் (REV-104) விண்ணப்பிக்க மாணவரின் **12-ஆம் வகுப்பு பள்ளி மாற்றுச் சான்றிதழ் (School TC)** அல்லது **மதிப்பெண் பட்டியல் (Marksheet)** கட்டாயம் பதிவேற்றப்பட வேண்டும்.\n\n` +
                      `தயவுசெய்து சான்றிதழைப் பதிவேற்றவும்:`,
                options: [
                    { label: "📷 மாணவர் 12th TC பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                    { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
                ]
            });
            res.json({
                chatHistory: sess.chatHistory,
                citizenProfile: sess.citizenProfile,
                step: sess.intakeState,
                isAutomating: false
            });
            return true;
        }

        if (!hasPhotoDoc) {
            sess.intakeState = 'FIRST_GRADUATE_PHOTO_WAIT';
            persistSessions();
            sess.chatHistory.push({
                sender: 'bot',
                text: `🛑 **விண்ணப்பிக்க முடியாது! (நேரடி பாஸ்போர்ட் புகைப்படம் விடுபட்டுள்ளது)**\n\n` +
                      `முதல் பட்டதாரி சான்றிதழ் (REV-104) விண்ணப்பிக்க மாணவரின் நேரடி பாஸ்போர்ட் புகைப்படம் (<50KB) கட்டாயம் தேவை.\n\n` +
                      `தயவுசெய்து மாணவரின் பாஸ்போர்ட் புகைப்படத்தைப் பதிவேற்றவும்:`,
                options: [
                    { label: "📷 பாஸ்போர்ட் புகைப்படம் பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                    { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
                ]
            });
            res.json({
                chatHistory: sess.chatHistory,
                citizenProfile: sess.citizenProfile,
                step: sess.intakeState,
                isAutomating: false
            });
            return true;
        }

        if (!hasAadhaarDoc && !p.headAadhaar && !p.aadhaarNumber) {
            sess.intakeState = 'FIRST_GRADUATE_AADHAAR_WAIT';
            persistSessions();
            sess.chatHistory.push({
                sender: 'bot',
                text: `🛑 **விண்ணப்பிக்க முடியாது! (ஆதார் அட்டை விடுபட்டுள்ளது)**\n\n` +
                      `முதல் பட்டதாரி சான்றிதழ் (REV-104) விண்ணப்பிக்க மாணவரின் ஆதார் அட்டை கட்டாயம் தேவை.\n\n` +
                      `தயவுசெய்து மாணவரின் ஆதார் அட்டையைப் பதிவேற்றவும்:`,
                options: [
                    { label: "📷 ஆதார் அட்டை பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                    { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
                ]
            });
            res.json({
                chatHistory: sess.chatHistory,
                citizenProfile: sess.citizenProfile,
                step: sess.intakeState,
                isAutomating: false
            });
            return true;
        }

        const modeText = isMockTest ? '🧪 சுயகற்றல் சோதனை முறை (Mock Sandbox)' : '🚀 நேரலை உற்பத்தி முறை (Live Production)';
        sess.chatHistory.push({
            sender: 'bot',
            text: `${modeText}யில் தமிழ்நாடு அரசு TNeGA முதல் பட்டதாரி சான்றிதழ் (REV-104) விண்ணப்ப ஆட்டோமேஷன் தொடங்கப்படுகிறது! 🛡️\n\n` +
                  `• 🔢 **CAN எண்:** **${p.canNumber || '—'}** ✅\n` +
                  `• 👤 **மாணவர்:** ${p.fullNameTam || p.fullNameEng || 'மாணவர்'}\n` +
                  `• 🎓 **படிப்பு:** ${p.currentCourse || p.degreeCourse || 'B.E.'}\n` +
                  `• 🏛️ **கல்வி நிறுவனம்:** ${p.institutionName || p.collegeName || '—'}\n` +
                  `• 👨‍👩‍👦 **பெற்றோர் கல்வி:** [தந்தை: ${p.fatherEducation || '10th'}] [தாய்: ${p.motherEducation || '8th'}]\n\n` +
                  `Chrome உலாவியில் TNeGA போர்ட்டல் மூலம் விண்ணப்பப் படிவம் திறக்கப்படுகிறது...`
        });
        sess.isAutomating = true;
        sess.isAutomationRunning = true;
        sess.automationStep = 1;
        persistSessions();

        runAutomationTask(
            startTnegaFirstGraduateFlow,
            p,
            sess,
            p.mobileNumber || targetMobile || activeMobile,
            isMockTest,
            false,
            false,
            req
        );

        res.json({
            chatHistory: sess.chatHistory,
            citizenProfile: sess.citizenProfile,
            step: sess.intakeState,
            isAutomating: true
        });
        return true;
    }

    if (isCanRegisterAction) {
        const targetSvc = sess.targetService || sess.citizenProfile?.targetService;
        sess.subService = 'CAN_REGISTER';
        if (sess.citizenProfile) {
            sess.citizenProfile.subService = 'CAN_REGISTER';
            if (targetSvc) sess.citizenProfile.targetService = targetSvc;
        }
        const p = sess.citizenProfile || {};
        if (targetSvc) p.targetService = targetSvc;
        const targetNameTam = targetSvc === 'COMMUNITY' ? 'சாதிச் சான்றிதழ்' : (targetSvc === 'RESIDENCE' ? 'இருப்பிடச் சான்றிதழ்' : (targetSvc === 'INCOME' ? 'வருமானச் சான்றிதழ்' : 'CAN பதிவு'));
        const modeText = isMockTest ? '🧪 சுயகற்றல் சோதனை முறை (Mock Sandbox)' : '🚀 நேரலை உற்பத்தி முறை (Live Production)';
        sess.chatHistory.push({
            sender: 'bot',
            text: `${modeText}யில் தமிழ்நாடு அரசு TNeGA ${targetNameTam} ஆட்டோமேஷன் தொடங்கப்படுகிறது! 🛡️\n\n` +
                  (targetSvc ? `💡 **முதன்மை இலக்கு:** போர்ட்டலில் CAN எண் உள்ளதா எனச் சரிபார்க்கப்பட்டு, CAN இருப்பின் நேரடியாக **${targetNameTam}** விண்ணப்பப் படிவத்திற்குச் செல்லும்!\n\n` : '') +
                  `• 👤 **விண்ணப்பதாரர்:** ${p.fullNameTam || p.fullNameEng || 'விண்ணப்பதாரர்'}\n` +
                  `• 👩 **தாயின் பெயர்:** ${p.motherNameTam || p.motherNameEng || '—'}\n` +
                  `• 🏛️ **வகுப்பு:** ${p.community || '—'}\n` +
                  `• 📱 **கைபேசி:** +91 ${p.mobileNumber || targetMobile || activeMobile}\n\n` +
                  `Chrome உலாவியில் TNeGA போர்ட்டல் மூலம் படிவம் திறக்கப்படுகிறது...`
        });
        sess.isAutomating = true;
        sess.isAutomationRunning = true;
        sess.automationStep = 1;
        persistSessions();

        runAutomationTask(
            startTnegaCanRegisterFlow,
            p,
            sess,
            p.mobileNumber || targetMobile || activeMobile,
            isMockTest,
            false,
            false,
            req
        );

        res.json({
            chatHistory: sess.chatHistory,
            citizenProfile: sess.citizenProfile,
            step: sess.intakeState,
            isAutomating: true
        });
        return true;
    }
    const isExplicitSubservice = (sess.subService && sess.subService !== 'NEW_CARD' && sess.subService !== 'NEW_RATION_CARD' && sess.subService !== 'RATION_SERVICE');
    const isNewCardFlow = !isExplicitSubservice && (
                          sess.subService === 'NEW_CARD' || 
                          sess.subService === 'NEW_RATION_CARD' ||
                          sess.citizenProfile?.subService === 'NEW_CARD' ||
                          sess.citizenProfile?.subService === 'NEW_RATION_CARD' ||
                          sess.service === 'new_smart_card' ||
                          sess.service === 'புதிய ரேஷன் கார்டு' ||
                          sess.citizenProfile?.service === 'new_smart_card' ||
                          sess.citizenProfile?.service === 'புதிய ரேஷன் கார்டு' ||
                          (!sess.subService && (
                              (sess.intakeState && (sess.intakeState.startsWith('MEMBER_') || sess.intakeState.startsWith('HEAD_') || sess.intakeState.startsWith('GAS_') || sess.intakeState.startsWith('CARD_TYPE') || sess.intakeState.startsWith('RESIDENCE_PROOF')))
                          ))
    );

    const isExplicitChangeAddress = !isNewCardFlow && (sess.subService === 'CHANGE_ADDRESS' || 
                                    (sess.intakeState && sess.intakeState.startsWith('RATION_CHANGE_ADDRESS')));
    const isExplicitAddMember = !isNewCardFlow && (sess.subService === 'ADD_MEMBER' || 
                                (sess.intakeState && sess.intakeState.startsWith('RATION_ADD_MEMBER')));

    const isChangeAddressFlow = !isNewCardFlow && (isExplicitChangeAddress || (!isExplicitAddMember && (
        sess.citizenProfile?.subService === 'CHANGE_ADDRESS' ||
        (!sess.subService && (Boolean(sess.subServiceData?.doorNo) || Boolean(sess.citizenProfile?.subServiceData?.doorNo)))
    )));

    const isAddMemberFlow = !isNewCardFlow && !isChangeAddressFlow && (isExplicitAddMember || (
        sess.citizenProfile?.subService === 'ADD_MEMBER' ||
        (!sess.subService && (
            Boolean(sess.subServiceData?.memberName || sess.subServiceData?.isChild !== undefined) ||
            Boolean(sess.citizenProfile?.subServiceData?.memberName)
        ))
    ));

    if (isNewCardFlow) {
        sess.subService = 'NEW_CARD';
        if (sess.citizenProfile) sess.citizenProfile.subService = 'NEW_CARD';
        sess.subServiceData = {};
        if (sess.citizenProfile?.subServiceData) {
            sess.citizenProfile.subServiceData = {};
        }
    } else if (isChangeAddressFlow) {
        sess.subService = 'CHANGE_ADDRESS';
        if (sess.citizenProfile) sess.citizenProfile.subService = 'CHANGE_ADDRESS';
        sess.subServiceData = sess.subServiceData || sess.citizenProfile?.subServiceData || {};
        // Clear any stale memberName from previous add member flows
        delete sess.subServiceData.memberName;
        delete sess.subServiceData.isChild;
        if (sess.citizenProfile?.subServiceData) {
            delete sess.citizenProfile.subServiceData.memberName;
            delete sess.citizenProfile.subServiceData.isChild;
        }
    } else if (isAddMemberFlow) {
        sess.subService = 'ADD_MEMBER';
        if (sess.citizenProfile) sess.citizenProfile.subService = 'ADD_MEMBER';
        sess.subServiceData = sess.subServiceData || sess.citizenProfile?.subServiceData || {};
    }

    if (!isAddMemberFlow) {
        const hasHead = sess.citizenProfile && (
            sess.citizenProfile.headAadhaar || 
            (sess.citizenProfile.members && sess.citizenProfile.members.length > 0)
        );

        const isComplete = isProfileDataComplete(sess.citizenProfile, sess.tempUploads);
        if (isComplete) {
            sess.intakeState = 'READY_TO_APPLY';
        }

        if (!hasHead || (!isComplete && sess.intakeState !== 'READY_TO_APPLY')) {
            sess.intakeState = 'MEMBER_COUNT';
            sess.chatHistory.push({
                sender: 'bot',
                text: `⚠️ **ரேஷன் கார்டு விண்ணப்ப விவரங்கள் இன்னும் முழுமையாகப் பெறப்படவில்லை!**\n\n` +
                      `அரசு இணையதளத்தில் விண்ணப்பிக்கத் தொடங்குவதற்கு முன், குடும்ப உறுப்பினர்களின் எண்ணிக்கை மற்றும் ஆவணங்களைச் சேகரிக்க வேண்டும்.\n\n` +
                      `உங்கள் குடும்பத்தில் மொத்தம் எத்தனை நபர்களை (குடும்பத் தலைவர் உட்பட) உறுப்பினர்களாகச் சேர்க்க வேண்டும்?\n\n` +
                      `கீழே உள்ள எண்ணிக்கையைத் தேர்வு செய்யவும் அல்லது தட்டச்சு செய்யவும்:`,
                options: MEMBER_COUNT_OPTIONS
            });
            persistSessions();
            res.json({
                chatHistory: sess.chatHistory,
                citizenProfile: sess.citizenProfile,
                step: sess.intakeState
            });
            return true;
        }
    } else {
        sess.intakeState = 'READY_TO_APPLY';
        sess.subServiceData = sess.subServiceData || {};
        if (!sess.subServiceData.memberName) {
            sess.subServiceData.memberName = sess.subServiceData.isChild ? 'கவின் குமார்' : 'பிரியா';
        }
        if (!sess.subServiceData.relationshipTam) {
            sess.subServiceData.relationshipTam = sess.subServiceData.isChild ? 'மகன்' : 'மகள்';
        }
        if (!sess.subServiceData.aadhaarNo) {
            sess.subServiceData.aadhaarNo = '987654321096';
        }
        if (!sess.subServiceData.docType) {
            sess.subServiceData.docType = 'Aadhaar Card';
        }
        if (!sess.subServiceData.docPath) {
            sess.subServiceData.docPath = 'uploads/test_sample_doc.jpg';
        }
    }

    let finalMobile = (sess.citizenProfile?.mobileNumber || activeMobile || '').replace(/\D/g, '');
    if (finalMobile.length === 12 && finalMobile.startsWith('91')) finalMobile = finalMobile.slice(2);
    let hasValidMobile = finalMobile.length === 10 && ['6','7','8','9'].includes(finalMobile[0]);
    if (!hasValidMobile && isMockTest) {
        finalMobile = '9876543210';
        hasValidMobile = true;
        if (sess.citizenProfile) sess.citizenProfile.mobileNumber = finalMobile;
    }

    if (!hasValidMobile) {
        sess.chatHistory.push({
            sender: 'bot',
            text: `📱 **வாடிக்கையாளர் கைபேசி எண் தேவை (Customer Mobile Required)!**\n\n` +
                  `அரசு TNPDS போர்ட்டலில் விண்ணப்பிக்க மற்றும் நேரலை OTP பெற, வாடிக்கையாளரின் 10-இலக்க மொபைல் எண்ணை உள்ளிடவும்.\n\n` +
                  `*(கீழே உள்ள உள்ளீட்டுப் பெட்டியில் 10-இலக்க மொபைல் எண்ணைத் தட்டச்சு செய்து அனுப்பவும் அல்லது விவரங்கள் திருத்து பொத்தானைப் பயன்படுத்தவும்)*`
        });
        persistSessions();
        res.json({
            chatHistory: sess.chatHistory,
            citizenProfile: sess.citizenProfile,
            step: sess.intakeState
        });
        return true;
    }

    const targetSess = sess;
    const targetMob = targetMobile || activeMobile;
    const isChangeAddressAction = !isNewCardFlow && (isChangeAddressFlow || 
                                  targetSess.subService === 'CHANGE_ADDRESS' || 
                                  targetSess.citizenProfile?.subService === 'CHANGE_ADDRESS');
    const isAddMemberAction = !isNewCardFlow && !isChangeAddressAction && (isAddMemberFlow || 
                              targetSess.subService === 'ADD_MEMBER' || 
                              targetSess.citizenProfile?.subService === 'ADD_MEMBER');
    const modeText = isMockTest ? '🧪 சுயகற்றல் சோதனை முறை (Mock Sandbox)' : '🚀 நேரலை முறை (Live Production)';

    if (isAddMemberAction) {
        const memName = targetSess.subServiceData?.memberName || (targetSess.subServiceData?.isChild ? 'குழந்தை' : 'புதிய உறுப்பினர்');
        const relTam = targetSess.subServiceData?.relationshipTam || '';
        sess.chatHistory.push({
            sender: 'bot',
            text: `${modeText}யில் தமிழ்நாடு அரசு TNPDS குடும்ப உறுப்பினர் சேர்க்கை ஆட்டோமேஷன் தொடங்கப்படுகிறது...\n\nஉறுப்பினர்: ${memName} (${relTam})\nபதிவு செய்யப்பட்ட கைபேசி: +91 ${targetSess.citizenProfile?.mobileNumber || targetMob}`
        });
    } else if (isChangeAddressAction) {
        const doorNo = targetSess.subServiceData?.doorNo || '';
        const stTam = targetSess.subServiceData?.streetTam || '';
        sess.chatHistory.push({
            sender: 'bot',
            text: `${modeText}யில் தமிழ்நாடு அரசு TNPDS குடும்ப அட்டை முகவரி மாற்றம் ஆட்டோமேஷன் தொடங்கப்படுகிறது...\n\nபுதிய முகவரி: ${doorNo} ${stTam}\nபதிவு செய்யப்பட்ட கைபேசி: +91 ${targetSess.citizenProfile?.mobileNumber || targetMob}`
        });
    } else {
        sess.chatHistory.push({
            sender: 'bot',
            text: `${modeText}யில் தமிழ்நாடு அரசு TNPDS இணையதள விண்ணப்பம் தொடங்கப்படுகிறது...\n\nவிண்ணப்பதாரர்: ${sess.citizenProfile?.fullNameEng || 'விண்ணப்பதாரர்'} (+91 ${sess.citizenProfile?.mobileNumber || activeMobile})\nமொத்த உறுப்பினர்கள்: ${sess.citizenProfile?.members?.length || 1}`
        });
    }

    let runner = startTnpdsRationCardFlow;
    if (isAddMemberAction) {
        runner = startTnpdsAddMemberFlow;
    } else if (isChangeAddressAction) {
        runner = startTnpdsAddressChangeFlow;
    }
    const flowProfile = {
        ...(targetSess.citizenProfile || {}),
        mobileNumber: targetSess.citizenProfile?.mobileNumber || targetMob,
        subService: targetSess.subService,
        subServiceData: targetSess.subServiceData,
        intakeState: targetSess.intakeState
    };

    runAutomationTask(runner, flowProfile, targetSess, targetMob, isMockTest, isAddMemberAction, isChangeAddressAction, req);

    sess.isAutomating = true;
    sess.isAutomationRunning = true;
    sess.automationStep = 0;
    sess.automationTotal = 51;
    persistSessions();

    res.json({
        chatHistory: sess.chatHistory,
        citizenProfile: sess.citizenProfile,
        step: isMockTest ? 'mock_running' : 'filling_form',
        automationStep: 0,
        automationTotal: 51
    });
    return true;
}

module.exports = {
    handleAutomationStarter
};
