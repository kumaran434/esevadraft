const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const { 
    startTnpdsRationCardFlow, 
    startTnpdsAddMemberFlow, 
    startTnpdsAddressChangeFlow,
    startTnpdsRemoveMemberFlow, 
    startTnpdsMobileChangeFlow,
    startTnpdsChangeHeadFlow,
    stopTnpdsAutomation, 
    getLiveOtpStatus, 
    getLiveApprovalStatus,
    provideOperatorApproval,
    updateLivePortalField
} = require('../../tnpds_automation');

const { 
    stopTnegaAutomation,
    startTnegaCanRegisterFlow,
    startTnegaCanSearchFlow,
    getLiveTnegaStatus,
    provideCanOtp
} = require('../../tnega_can_automation');
const { saveStepCheckpoint, getStepCheckpoint, clearStepCheckpoint } = require('../services/automation_checkpoint_service');
const { saveCitizenDraft, logOperatorCorrection } = require('../../firestore_db');
const { saveCitizenProfile } = require('../../database');
const storageService = require('../services/storage_service');
const { 
    sessions,
    getOrCreateSession, 
    getActiveMobile, 
    persistSessions, 
    getSessionState 
} = storageService;

// 1. GET /api/automation/progress
router.get('/api/automation/progress', (req, res) => {
    const targetMobile = req.query.mobile || getActiveMobile();
    const sess = targetMobile ? getOrCreateSession(targetMobile) : storageService.getSessionState();
    if (!sess) {
        return res.json({ step: 0, total: 0, percentage: 0, stepMessage: '', isRunning: false, isWaitingForApproval: false });
    }
    const step = sess.automationStep || 0;
    const total = sess.automationTotal || 51;
    const pct = total > 0 ? Math.round((step / total) * 100) : 0;
    const isLocalReq = req.headers['x-dev-mode'] === 'true' || (req.headers.host && (req.headers.host.includes('localhost') || req.headers.host.includes('127.0.0.1')));
    const approvalStatus = (!isLocalReq && !sess.isMockSandbox) ? getLiveApprovalStatus() : { isWaitingForApproval: false, fullSnapshotUrl: null, auditResult: null };
    const isActuallyRunning = Boolean(sess.isAutomating === true || sess.isAutomationRunning === true || (step > 0 && step < total));
    res.json({
        step: (isActuallyRunning || step > 0) ? step : 0,
        total,
        percentage: (isActuallyRunning || step > 0) ? pct : 0,
        stepMessage: sess.automationCurrentStepMsg || '',
        isRunning: isActuallyRunning || (step > 0 && step < total),
        isWaitingForApproval: Boolean(approvalStatus.isWaitingForApproval),
        approvalSnapshotUrl: approvalStatus.fullSnapshotUrl,
        auditResult: approvalStatus.auditResult,
        applicationNumber: sess.applicationNumber || null
    });
});

// 2. GET /api/automation/live-status
router.get('/api/automation/live-status', async (req, res) => {
    const targetMobile = req.query.mobile || req.headers['x-session-mobile'] || getActiveMobile();
    const sess = targetMobile ? getOrCreateSession(targetMobile) : storageService.getSessionState();

    if (!sess) {
        return res.json({
            step: 0,
            total: 51,
            percentage: 0,
            isRunning: false,
            latestSnapshotUrl: null,
            isWaitingForOtp: false,
            isWaitingForApproval: false,
            applicationNumber: null
        });
    }

    const step = sess.automationStep || 0;
    const total = sess.automationTotal || 51;
    const pct = total > 0 ? Math.round((step / total) * 100) : 0;
    const isRunning = step > 0 && step < total;

    let otpStatus = { isWaitingForOtp: false, seconds: null, otpType: '' };
    try {
        otpStatus = await getLiveOtpStatus();
    } catch (e) {}

    try {
        if (typeof getLiveTnegaStatus === 'function') {
            const tnegaStatus = getLiveTnegaStatus();
            if (tnegaStatus && tnegaStatus.isWaitingForCanOtp) {
                otpStatus.isWaitingForOtp = true;
                otpStatus.otpType = 'can_otp';
            }
        }
    } catch (e) {}

    const isLocalReq = req.headers['x-dev-mode'] === 'true' || (req.headers.host && (req.headers.host.includes('localhost') || req.headers.host.includes('127.0.0.1')));
    const approvalStatus = (!isLocalReq && !sess.isMockSandbox) ? getLiveApprovalStatus() : { isWaitingForApproval: false, fullSnapshotUrl: null, auditResult: null };

    const latestSnapPath = path.join(__dirname, '..', '..', 'public', 'previews', 'latest.png');
    const hasSnapshot = fs.existsSync(latestSnapPath);

    let lastProgressMsg = '';
    if (sess.chatHistory && sess.chatHistory.length > 0) {
        for (let i = sess.chatHistory.length - 1; i >= 0; i--) {
            const m = sess.chatHistory[i];
            if (m.sender === 'bot' && (m.text.includes('படி') || m.text.includes('TNPDS') || m.text.includes('OTP') || m.text.includes('ஆட்டோமேஷன்'))) {
                lastProgressMsg = m.text;
                break;
            }
        }
    }

    res.json({
        step,
        total,
        percentage: pct,
        isRunning,
        lastProgressMsg,
        isWaitingForOtp: otpStatus.isWaitingForOtp,
        otpType: otpStatus.otpType,
        otpSeconds: otpStatus.seconds,
        isWaitingForApproval: approvalStatus.isWaitingForApproval,
        approvalSnapshotUrl: approvalStatus.fullSnapshotUrl,
        auditResult: approvalStatus.auditResult,
        latestSnapshotUrl: hasSnapshot ? `/previews/latest.png?t=${Date.now()}` : null,
        applicationNumber: sess.applicationNumber || null,
        applicationPdfUrl: sess.applicationPdfUrl || null
    });
});

// 3. POST /api/automation/start
router.post('/api/automation/start', async (req, res) => {
    const targetMobile = req.body.mobileNumber || req.headers['x-session-mobile'] || getActiveMobile();
    if (!targetMobile) return res.status(400).json({ error: 'செயலில் உள்ள வாடிக்கையாளர் எண் இல்லை.' });
    const sess = getOrCreateSession(targetMobile);
    const isRealGovtOtp = req.body.forceRealGovtOtp === true || sess.enableRealGovtOtp === true || req.body.isMockSandbox === false;
    const isMock = !isRealGovtOtp;
    const isPublishMode = req.body.enableFinalSubmit === true || req.body.isPublish === true;
    const isDryRunMode = req.body.isDryRun === true || req.body.dryRun === true || (!isPublishMode && !isMock);
    const enableSubmit = isPublishMode && !isDryRunMode;
    const explicitSubService = req.body.subService || req.body.service || sess.subService || sess.citizenProfile?.subService || '';

    const isCanRegisterFlow = (
        sess.subService === 'CAN_REGISTER' ||
        sess.citizenProfile?.subService === 'CAN_REGISTER' ||
        req.body.service === 'CAN_REGISTER' ||
        req.body.service === 'TNEGA_CAN_REGISTER' ||
        req.body.subService === 'CAN_REGISTER' ||
        (sess.intakeState && sess.intakeState.startsWith('READY_TO_APPLY_CAN')) ||
        (sess.intakeState && sess.intakeState.startsWith('CAN_REGISTER_INTAKE'))
    );
    if (isCanRegisterFlow) {
        sess.subService = 'CAN_REGISTER';
    }

    const isExplicitSubservice = (sess.subService && sess.subService !== 'NEW_CARD' && sess.subService !== 'NEW_RATION_CARD' && sess.subService !== 'RATION_SERVICE') ||
                                 (req.body.subService && req.body.subService !== 'NEW_CARD' && req.body.subService !== 'NEW_RATION_CARD');

    const isNewCardFlow = !isExplicitSubservice && (
                          sess.subService === 'NEW_CARD' || 
                          sess.subService === 'NEW_RATION_CARD' ||
                          req.body.subService === 'NEW_CARD' ||
                          req.body.subService === 'NEW_RATION_CARD' ||
                          req.body.service === 'NEW_RATION_CARD' ||
                          req.body.service === 'new_smart_card' ||
                          sess.service === 'new_smart_card' ||
                          sess.service === 'புதிய ரேஷன் கார்டு' ||
                          sess.citizenProfile?.subService === 'NEW_CARD' ||
                          sess.citizenProfile?.subService === 'NEW_RATION_CARD' ||
                          sess.citizenProfile?.service === 'new_smart_card' ||
                          sess.citizenProfile?.service === 'புதிய ரேஷன் கார்டு' ||
                          (!sess.subService && (
                              (sess.intakeState && (sess.intakeState.startsWith('MEMBER_') || sess.intakeState.startsWith('HEAD_') || sess.intakeState.startsWith('GAS_') || sess.intakeState.startsWith('CARD_TYPE') || sess.intakeState.startsWith('RESIDENCE_PROOF')))
                          ))
    );

    if (isNewCardFlow) {
        sess.subService = 'NEW_CARD';
        if (sess.citizenProfile) sess.citizenProfile.subService = 'NEW_CARD';
        sess.subServiceData = {};
        if (sess.citizenProfile?.subServiceData) {
            sess.citizenProfile.subServiceData = {};
        }
    }

    const isCanSearchFlow = !isNewCardFlow && !isCanRegisterFlow && (
        sess.subService === 'CAN_SEARCH' ||
        sess.citizenProfile?.subService === 'CAN_SEARCH' ||
        req.body.service === 'CAN_SEARCH' ||
        req.body.service === 'TNEGA_CAN_SEARCH' ||
        req.body.subService === 'CAN_SEARCH' ||
        (sess.intakeState && sess.intakeState.startsWith('CAN_SEARCH_INTAKE'))
    );
    if (isCanSearchFlow) {
        sess.subService = 'CAN_SEARCH';
    }

    const isRemoveMemberFlow = !isNewCardFlow && !isCanRegisterFlow && !isCanSearchFlow && (
                               sess.subService === 'REMOVE_MEMBER' || 
                               sess.citizenProfile?.subService === 'REMOVE_MEMBER' ||
                               (sess.intakeState && sess.intakeState.startsWith('RATION_REMOVE_MEMBER')) ||
                               (!sess.subService && Boolean(sess.subServiceData?.memberName) && Boolean(sess.subServiceData?.reason))
                               ) && sess.subService !== 'CHANGE_HEAD';
    if (isRemoveMemberFlow) {
        sess.subService = 'REMOVE_MEMBER';
        sess.subServiceData = sess.subServiceData || sess.citizenProfile?.subServiceData || {};
    }

    const isAddMemberFlow = !isNewCardFlow && !isCanRegisterFlow && !isCanSearchFlow && !isRemoveMemberFlow && (
                            sess.subService === 'ADD_MEMBER' || 
                            sess.citizenProfile?.subService === 'ADD_MEMBER' ||
                            (sess.intakeState && sess.intakeState.startsWith('RATION_ADD_MEMBER')) ||
                            (!sess.subService && (
                                Boolean(sess.subServiceData?.memberName || sess.subServiceData?.isChild !== undefined) ||
                                Boolean(sess.citizenProfile?.subServiceData?.memberName)
                            ))
    );
    if (isAddMemberFlow) {
        sess.subService = 'ADD_MEMBER';
        sess.subServiceData = sess.subServiceData || sess.citizenProfile?.subServiceData || {};
    }
    const isChangeAddressFlow = !isNewCardFlow && !isCanRegisterFlow && !isCanSearchFlow && !isRemoveMemberFlow && !isAddMemberFlow && (
                                sess.subService === 'CHANGE_ADDRESS' || 
                                sess.citizenProfile?.subService === 'CHANGE_ADDRESS' ||
                                (sess.intakeState && sess.intakeState.startsWith('RATION_CHANGE_ADDRESS')) ||
                                (!sess.subService && (
                                    Boolean(sess.subServiceData?.doorNo) ||
                                    Boolean(sess.citizenProfile?.subServiceData?.doorNo)
                                ))
    );
    if (isChangeAddressFlow) {
        sess.subService = 'CHANGE_ADDRESS';
        sess.subServiceData = sess.subServiceData || sess.citizenProfile?.subServiceData || {};
    }

    const isMobileChangeFlow = !isNewCardFlow && !isCanRegisterFlow && !isCanSearchFlow && !isRemoveMemberFlow && !isAddMemberFlow && !isChangeAddressFlow && (
                                sess.subService === 'UPDATE_MOBILE' ||
                                sess.subService === 'CHANGE_MOBILE' ||
                                sess.subService === 'CHANGE_OF_MOBILE_NUMBER' ||
                                sess.citizenProfile?.subService === 'UPDATE_MOBILE' ||
                                sess.citizenProfile?.subService === 'CHANGE_MOBILE' ||
                                sess.citizenProfile?.subService === 'CHANGE_OF_MOBILE_NUMBER' ||
                                (!sess.subService && (
                                    Boolean(sess.subServiceData?.newMobile) ||
                                    Boolean(sess.citizenProfile?.subServiceData?.newMobile)
                                )) ||
                                (sess.intakeState && sess.intakeState.startsWith('RATION_CHANGE_MOBILE'))
    );
    if (isMobileChangeFlow) {
        sess.subService = 'UPDATE_MOBILE';
        sess.subServiceData = sess.subServiceData || sess.citizenProfile?.subServiceData || {};
    }

    const isChangeHeadFlow = !isNewCardFlow && !isCanRegisterFlow && !isCanSearchFlow && !isRemoveMemberFlow && !isAddMemberFlow && !isChangeAddressFlow && !isMobileChangeFlow && (
                                sess.subService === 'CHANGE_HEAD' ||
                                sess.subService === 'FAMILY_HEAD_MEMBER_CHANGE' ||
                                sess.citizenProfile?.subService === 'CHANGE_HEAD' ||
                                sess.citizenProfile?.subService === 'FAMILY_HEAD_MEMBER_CHANGE' ||
                                (!sess.subService && (
                                    Boolean(sess.subServiceData?.newHeadName) ||
                                    Boolean(sess.citizenProfile?.subServiceData?.newHeadName)
                                )) ||
                                (sess.intakeState && sess.intakeState.startsWith('RATION_CHANGE_HEAD'))
    );
    if (isChangeHeadFlow) {
        sess.subService = 'CHANGE_HEAD';
        sess.subServiceData = sess.subServiceData || sess.citizenProfile?.subServiceData || {};
    }

    const isIncomeFlow = !isCanRegisterFlow && !isCanSearchFlow && !isRemoveMemberFlow && !isAddMemberFlow && !isChangeAddressFlow && !isMobileChangeFlow && !isChangeHeadFlow && (
        explicitSubService === 'INCOME' ||
        explicitSubService === 'INCOME_CERTIFICATE' ||
        sess.subService === 'INCOME' ||
        sess.subService === 'INCOME_CERTIFICATE' ||
        sess.citizenProfile?.subService === 'INCOME' ||
        sess.citizenProfile?.subService === 'INCOME_CERTIFICATE' ||
        (sess.intakeState && sess.intakeState.startsWith('READY_TO_APPLY_INCOME')) ||
        (sess.intakeState && sess.intakeState.startsWith('INCOME_'))
    );
    if (isIncomeFlow) {
        sess.subService = 'INCOME';
    }

    const modeText = isMock ? '🧪 சுயகற்றல் சோதனை முறை (Mock Sandbox)' :
                     isDryRunMode ? '🛡️ நேரலை ஒத்திகை முறை (Live Portal Dry-Run Guard: இறுதிச் சமர்ப்பிப்பு செய்யப்படாது)' :
                     '🚀 நேரலை உற்பத்தி முறை (Live Production)';
    if (isIncomeFlow) {
        sess.chatHistory.push({
            sender: 'bot',
            text: `${modeText}யில் தமிழ்நாடு அரசு TNeGA வருமானச் சான்றிதழ் (REV-103) விண்ணப்பப் பணி தொடங்கப்படுகிறது...\n\nவிண்ணப்பதாரர்: ${sess.citizenProfile?.fullNameEng || sess.citizenProfile?.fullNameTam || 'விண்ணப்பதாரர்'} (+91 ${sess.citizenProfile?.mobileNumber || targetMobile})\nCAN எண்: ${sess.citizenProfile?.canNumber || '—'}`
        });
    } else if (isRemoveMemberFlow) {
        const memName = sess.subServiceData?.memberName || sess.subServiceData?.memberNameTam || 'குடும்ப உறுப்பினர்';
        const reason = sess.subServiceData?.reason || 'இறப்பு / திருமணம்';
        sess.chatHistory.push({
            sender: 'bot',
            text: `${modeText}யில் தமிழ்நாடு அரசு TNPDS குடும்ப உறுப்பினர் நீக்கம் தொடங்கப்படுகிறது...\n\nநீக்கப்பட வேண்டியவர்: ${memName} (${reason})\nபதிவு செய்யப்பட்ட கைபேசி: +91 ${sess.citizenProfile?.mobileNumber || targetMobile}`
        });
    } else if (isAddMemberFlow) {
        const memName = sess.subServiceData?.memberName || (sess.subServiceData?.isChild ? 'குழந்தை' : 'புதிய உறுப்பினர்');
        const relTam = sess.subServiceData?.relationshipTam || '';
        sess.chatHistory.push({
            sender: 'bot',
            text: `${modeText}யில் தமிழ்நாடு அரசு TNPDS குடும்ப உறுப்பினர் சேர்க்கை தொடங்கப்படுகிறது...\n\nஉறுப்பினர்: ${memName} (${relTam})\nபதிவு செய்யப்பட்ட கைபேசி: +91 ${sess.citizenProfile?.mobileNumber || targetMobile}`
        });
    } else if (isChangeAddressFlow) {
        const doorNo = sess.subServiceData?.doorNo || '';
        const stTam = sess.subServiceData?.streetTam || '';
        sess.chatHistory.push({
            sender: 'bot',
            text: `${modeText}யில் தமிழ்நாடு அரசு TNPDS குடும்ப அட்டை முகவரி மாற்றம் தொடங்கப்படுகிறது...\n\nபுதிய முகவரி: ${doorNo} ${stTam}\nபதிவு செய்யப்பட்ட கைபேசி: +91 ${sess.citizenProfile?.mobileNumber || targetMobile}`
        });
    } else if (isMobileChangeFlow) {
        const newMob = sess.subServiceData?.newMobile || '';
        sess.chatHistory.push({
            sender: 'bot',
            text: `${modeText}யில் தமிழ்நாடு அரசு TNPDS குடும்ப அட்டை கைபேசி எண் மாற்றம் தொடங்கப்படுகிறது...\n\nபுதிய கைபேசி எண்: +91 ${newMob}\nதற்போதைய பதிவு செய்யப்பட்ட கைபேசி: +91 ${sess.citizenProfile?.mobileNumber || targetMobile}`
        });
    } else if (isChangeHeadFlow) {
        const newHead = sess.subServiceData?.newHeadName || sess.subServiceData?.targetMemberName || 'புதிய குடும்பத் தலைவர்';
        sess.chatHistory.push({
            sender: 'bot',
            text: `${modeText}யில் தமிழ்நாடு அரசு TNPDS குடும்பத் தலைவர் மாற்றப் பணி தொடங்கப்படுகிறது...\n\nபுதிய குடும்பத் தலைவர்: ${newHead}\nபதிவு செய்யப்பட்ட கைபேசி எண்: +91 ${sess.citizenProfile?.mobileNumber || targetMobile}`
        });
    } else if (isCanRegisterFlow) {
        sess.chatHistory.push({
            sender: 'bot',
            text: `${modeText}யில் தமிழ்நாடு அரசு TNeGA புதிய CAN பதிவு தொடங்கப்படுகிறது...\n\nவிண்ணப்பதாரர்: ${sess.citizenProfile?.fullNameEng || sess.citizenProfile?.fullNameTam || 'விண்ணப்பதாரர்'} (+91 ${sess.citizenProfile?.mobileNumber || targetMobile})`
        });
    } else if (isCanSearchFlow) {
        sess.chatHistory.push({
            sender: 'bot',
            text: `${modeText}யில் தமிழ்நாடு அரசு TNeGA CAN எண் தேடல் தொடங்கப்படுகிறது...\n\nவிண்ணப்பதாரர்: ${sess.citizenProfile?.fullNameEng || sess.citizenProfile?.fullNameTam || 'விண்ணப்பதாரர்'} (+91 ${sess.citizenProfile?.mobileNumber || targetMobile})`
        });
    } else {
        sess.chatHistory.push({
            sender: 'bot',
            text: `${modeText}யில் தமிழ்நாடு அரசு TNPDS இணையதள விண்ணப்பம் தொடங்கப்படுகிறது...\n\nவிண்ணப்பதாரர்: ${sess.citizenProfile?.fullNameEng || sess.citizenProfile?.fullNameTam || 'விண்ணப்பதாரர்'} (+91 ${sess.citizenProfile?.mobileNumber || targetMobile})`
        });
    }

    let runner = startTnpdsRationCardFlow;
    if (isRemoveMemberFlow) {
        runner = startTnpdsRemoveMemberFlow;
    } else if (isAddMemberFlow) {
        runner = startTnpdsAddMemberFlow;
    } else if (isChangeAddressFlow) {
        runner = startTnpdsAddressChangeFlow;
    } else if (isMobileChangeFlow) {
        runner = startTnpdsMobileChangeFlow;
    } else if (isChangeHeadFlow) {
        runner = startTnpdsChangeHeadFlow;
    } else if (isCanRegisterFlow) {
        runner = (prof, onProg, opts) => startTnegaCanRegisterFlow(prof, onProg, { isMockSandbox: isMock, ...opts });
    } else if (isCanSearchFlow) {
        runner = (prof, onProg, opts) => startTnegaCanSearchFlow(prof, onProg, { isMockSandbox: isMock, ...opts });
    } else if (isIncomeFlow) {
        runner = (prof, onProg, opts) => startTnegaCanRegisterFlow(prof, onProg, { isMockSandbox: isMock, ...opts });
    }
    const flowProfile = {
        ...(sess.citizenProfile || {}),
        mobileNumber: sess.citizenProfile?.mobileNumber || targetMobile,
        subService: sess.subService,
        subServiceData: sess.subServiceData,
        intakeState: sess.intakeState
    };

    runner(
        flowProfile,
        (progressMsg) => {
            const stepMatch = progressMsg.match(/(?:\[\s*(?:படி|படிகள்|Step)\s*|(?:படி|படிகள்|Step)\s+)(\d+)(?:\s*-\s*\d+)?\s*\/\s*(\d+)\]?/i);
            if (stepMatch) {
                sess.automationStep = parseInt(stepMatch[1], 10);
                sess.automationTotal = parseInt(stepMatch[2], 10) || 51;
                saveStepCheckpoint(targetMobile, flowProfile.subService || 'new_ration_card', stepMatch[1], progressMsg);
            }
            sess.automationCurrentStepMsg = progressMsg;
            const isPermanentMilestone = progressMsg.includes('பதிவு எண் பெறப்பட்டது') ||
                progressMsg.includes('விண்ணப்பம் வெற்றிகரமாக சமர்ப்பிக்கப்பட்டது') ||
                progressMsg.includes('கடும் பூட்டு நிறுத்தம்') ||
                progressMsg.includes('ஆட்டோமேஷன் பிழையினால் நிறுத்தப்பட்டது');
            if (isPermanentMilestone && sess && sess.chatHistory) {
                const lastMsg = sess.chatHistory[sess.chatHistory.length - 1];
                if (!lastMsg || lastMsg.text !== progressMsg) {
                    sess.chatHistory.push({ sender: 'bot', text: progressMsg });
                }
            }
        },
        {
            isMockSandbox: isMock,
            forceRealGovtOtp: !isMock,
            enableFinalSubmit: enableSubmit,
            isDryRun: isDryRunMode,
            fastTest: (req.headers['x-operator-uid'] === 'test_suite_operator_uid' || req.body?.fastTest === true || process.env.NODE_ENV === 'test' || process.env.REGRESSION_TEST === 'true'),
            draftData: sess,
            subServiceData: sess.subServiceData,
            keepBrowserOpen: true,
            operatorName: sess.operatorName || req.body?.operatorName || (req.headers['x-user-role'] === 'admin' ? 'admin' : (req.headers['x-operator-name'] || 'admin')),
            automationName: isRemoveMemberFlow ? 'remove_member' : (isAddMemberFlow ? 'add_member' : (isChangeAddressFlow ? 'change_address' : (isMobileChangeFlow ? 'mobile_change' : (isChangeHeadFlow ? 'change_head' : 'new_ration_card'))))
        }
    ).then((result) => {
        if (result && result.success) {
            clearStepCheckpoint(targetMobile, flowProfile.subService || 'new_ration_card');
            sess.applicationNumber = result.applicationNumber || result.canNumber || null;
            sess.applicationPdfUrl = result.applicationPdfUrl || result.receiptPdf || null;
            if (sess.citizenProfile) {
                sess.citizenProfile.applicationNumber = sess.applicationNumber;
                sess.citizenProfile.applicationPdfUrl = sess.applicationPdfUrl;
                if (result.canNumber) sess.citizenProfile.canNumber = result.canNumber;
                sess.citizenProfile.submittedAt = new Date().toISOString();
                saveCitizenProfile(targetMobile, sess.citizenProfile);
            }
            sess.step = 'submitted';
            sess.intakeState = 'submitted';
            sess.chatHistory.push({
                sender: 'bot',
                text: result.message || `🎉 புதிய CAN பதிவு வெற்றிகரமாக முடிந்தது! CAN எண்: ${result.canNumber || result.applicationNumber}`,
                applicationNumber: sess.applicationNumber,
                applicationPdfUrl: sess.applicationPdfUrl
            });
            saveCitizenDraft(targetMobile, {
                operatorUid: sess.operatorUid || null,
                citizenProfile: sess.citizenProfile,
                intakeState: 'submitted',
                step: 'submitted',
                applicationNumber: sess.applicationNumber,
                applicationPdfUrl: sess.applicationPdfUrl,
                chatHistory: sess.chatHistory,
                documents: sess.tempUploads || {}
            }).catch(() => {});
            persistSessions();
        } else if (result && !result.success) {
            sess.chatHistory.push({
                sender: 'bot',
                text: `⚠️ ஆட்டோமேஷன் நிறுத்தம்: ${result.message || 'செயல்முறை இடைநிறுத்தப்பட்டது.'}`
            });
            persistSessions();
        }
    }).catch((err) => {
        sess.chatHistory.push({
            sender: 'bot',
            text: `❌ ஆட்டோமேஷன் பிழை: ${err.message}`
        });
        persistSessions();
    });

    res.json({
        success: true,
        message: 'TNPDS Automation started.',
        step: 1
    });
});

// 4. GET /api/automation/checkpoint
router.get('/api/automation/checkpoint', (req, res) => {
    const targetMobile = req.query.mobile || req.headers['x-session-mobile'] || getActiveMobile();
    const service = req.query.service || 'new_ration_card';
    const result = getStepCheckpoint(targetMobile, service);
    res.json(result);
});

// 5. GET /api/application/status
router.get('/api/application/status', async (req, res) => {
    const state = storageService.getSessionState();
    if (!state || !state.applicationNumber) {
        return res.json({ hasApplication: false });
    }
    res.json({
        hasApplication: true,
        applicationNumber: state.applicationNumber,
        submittedAt: state.citizenProfile?.submittedAt || null,
        status: state.applicationStatus || 'Under Review (விசாரணையில் உள்ளது)',
        lastChecked: new Date().toISOString()
    });
});

// 6. POST /api/automation/stop
router.post('/api/automation/stop', async (req, res) => {
    try {
        console.log('[AUTOMATION STOP] Request received to stop all running automations');
        await stopTnpdsAutomation().catch(e => console.warn('TNPDS stop warn:', e.message));
        if (typeof stopTnegaAutomation === 'function') {
            await stopTnegaAutomation().catch(e => console.warn('TNeGA stop warn:', e.message));
        }
        const targetMobile = req.body?.mobileNumber || req.headers['x-session-mobile'] || getActiveMobile();
        const sess = targetMobile ? getOrCreateSession(targetMobile) : storageService.getSessionState();
        if (sess) {
            sess.chatHistory.push({
                sender: 'bot',
                text: '🛑 அரசு இணையதள ஆட்டோமேஷன் நிறுத்தப்பட்டது.'
            });
            sess.automationStep = 0;
            sess.isAutomating = false;
            sess.isAutomationRunning = false;
        }
        const activeState = storageService.getSessionState();
        if (activeState && activeState !== sess) {
            activeState.chatHistory.push({
                sender: 'bot',
                text: '🛑 அரசு இணையதள ஆட்டோமேஷன் நிறுத்தப்பட்டது.'
            });
            activeState.automationStep = 0;
            activeState.isAutomating = false;
            activeState.isAutomationRunning = false;
        }
        res.json({
            success: true,
            chatHistory: sess ? sess.chatHistory : (activeState ? activeState.chatHistory : []),
            citizenProfile: sess ? sess.citizenProfile : (activeState ? activeState.citizenProfile : null),
            step: 'stopped'
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 7. GET /api/automation/approval-status
router.get('/api/automation/approval-status', async (req, res) => {
    const status = getLiveApprovalStatus();
    const targetMobile = req.query.mobile || getActiveMobile();
    const sess = targetMobile ? getOrCreateSession(targetMobile) : storageService.getSessionState();
    res.json({
        ...status,
        citizenProfile: sess ? sess.citizenProfile : null,
        mobileNumber: targetMobile
    });
});

// 8. POST /api/automation/approve-submit
router.post('/api/automation/approve-submit', async (req, res) => {
    const success = provideOperatorApproval(true);
    res.json({
        success,
        message: success ? '✅ ஆபரேட்டர் ஒப்புதல் வழங்கப்பட்டது. இறுதிச் சமர்ப்பிப்பு தொடங்குகிறது...' : 'செயலில் உள்ள ஒப்புதல் அமர்வு இல்லை.'
    });
});

// 9. POST /api/automation/update-portal-field
router.post('/api/automation/update-portal-field', async (req, res) => {
    const fieldUpdates = req.body || {};
    const targetMobile = req.body.mobileNumber || getActiveMobile();
    
    const result = await updateLivePortalField(fieldUpdates);

    if (targetMobile && sessions.has(targetMobile)) {
        const sess = sessions.get(targetMobile);
        if (sess.citizenProfile) {
            if (fieldUpdates.doorNo) sess.citizenProfile.doorNo = fieldUpdates.doorNo;
            if (fieldUpdates.street) sess.citizenProfile.streetTam = fieldUpdates.street;
            if (fieldUpdates.taluk) sess.citizenProfile.taluk = fieldUpdates.taluk;
            if (fieldUpdates.village) sess.citizenProfile.village = fieldUpdates.village;
            saveCitizenProfile(targetMobile, sess.citizenProfile);
        }
    }

    await logOperatorCorrection({
        mobile: targetMobile,
        operatorUid: req.headers['x-operator-uid'] || null,
        type: 'FIELD_UPDATE_ON_PORTAL',
        fieldUpdates,
        resultSuccess: result.success
    });

    res.json(result);
});

// 10. POST /api/automation/log-feedback
router.post('/api/automation/log-feedback', async (req, res) => {
    const { note, issueType, screenshotUrl, mobileNumber } = req.body;
    const opUid = req.headers['x-operator-uid'] || null;

    const logged = await logOperatorCorrection({
        mobile: mobileNumber || getActiveMobile(),
        operatorUid: opUid,
        type: 'OPERATOR_FEEDBACK',
        issueType: issueType || 'GENERAL',
        note: note || '',
        screenshotUrl: screenshotUrl || null
    });

    res.json({ success: true, message: 'நன்றி! உங்கள் ஃபீட்பேக் வெற்றிகரமாகப் பதிவு செய்யப்பட்டது.', logId: logged ? logged.id : null });
});

// 11. GET /api/automation/logs
router.get('/api/automation/logs', (req, res) => {
    try {
        let listOperatorLogs = null;
        try {
            listOperatorLogs = require('../services/automation_logger').listOperatorLogs;
        } catch (e) {}
        if (!listOperatorLogs) {
            return res.json({ success: true, count: 0, logs: [] });
        }
        const operatorFilter = req.query.operator || null;
        const serviceFilter = req.query.service || null;
        const logs = listOperatorLogs(null, operatorFilter, serviceFilter);
        res.json({ success: true, count: logs.length, logs });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 12. GET /api/automation/logs/latest
router.get('/api/automation/logs/latest', (req, res) => {
    try {
        let getLatestAutomationRun = null;
        try {
            getLatestAutomationRun = require('../services/automation_logger').getLatestAutomationRun;
        } catch (e) {}
        if (!getLatestAutomationRun) {
            return res.json({ success: false, error: 'Logger module not available' });
        }
        const operatorFilter = req.query.operator || null;
        const latest = getLatestAutomationRun(operatorFilter);
        res.json({ success: true, latest });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

module.exports = router;
