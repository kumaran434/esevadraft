const express = require('express');
const router = express.Router();

const chatMainRouter = require('./chat/chat_main_route');
router.use(chatMainRouter);

const { getInitialWelcomeMessage } = require('../core/chat_fsm');
const { getCitizenDraft, saveCitizenDraft } = require('../../firestore_db');
const { saveCitizenProfile } = require('../../database');
const { isProfileDataComplete } = require('../services/profile_helpers');
const { extractDraftDocumentsList } = require('../services/draft_document_resolver');

const { 
    resendOtp, 
    getLiveOtpStatus, 
    stopTnpdsAutomation, 
    submitTnpdsApplication 
} = require('../../tnpds_automation');
const { stopTnegaAutomation } = require('../../tnega_can_automation');

const storageService = require('../services/storage_service');
const { 
    sessions, 
    createFreshProfile, 
    getOrCreateSession, 
    getActiveMobile, 
    setActiveMobile, 
    setSessionState, 
    persistSessions 
} = storageService;

// 1. GET /api/chat/history
router.get('/api/chat/history', async (req, res) => {
    const isOpReq = !!(req.headers['x-operator-uid'] || req.query.role === 'operator');
    const reqOpUid = req.headers['x-operator-uid'] || req.query.operatorUid || null;
    const targetMobile = (req.query.mobile || req.headers['x-session-mobile'] || '').trim();

    if (isOpReq && !targetMobile) {
        return res.json({
            chatHistory: [getInitialWelcomeMessage()],
            citizenProfile: null,
            step: 'READY',
            noCustomerActive: true
        });
    }

    const mobile = targetMobile || getActiveMobile();
    const sess = mobile ? getOrCreateSession(mobile) : storageService.getSessionState();
    if (!sess) {
        return res.json({ chatHistory: [getInitialWelcomeMessage()], citizenProfile: null, step: 'READY' });
    }

    // STRICT TENANT BOUNDARY: Check if session belongs to another operator
    if (isOpReq && reqOpUid && sess.operatorUid) {
        const normSessOp = String(sess.operatorUid).trim();
        const normReqOp = String(reqOpUid).trim();
        if (normSessOp && normReqOp && normSessOp !== normReqOp) {
            return res.status(403).json({
                error: 'இந்த வாடிக்கையாளர் விவரங்கள் மற்றொரு மையத்திற்குரியவை.',
                chatHistory: [getInitialWelcomeMessage()],
                citizenProfile: null,
                step: 'READY',
                noCustomerActive: true
            });
        }
    }

    if (reqOpUid && (!sess.operatorUid || sess.operatorUid === 'null')) {
        sess.operatorUid = reqOpUid;
    }

    const needsDraftRestore = mobile && (
        !sess._draftChecked || 
        !sess.citizenProfile || 
        !sess.citizenProfile.fullNameEng ||
        (sess.citizenProfile.gasDetails && !sess.citizenProfile.gasDetails.consumerNumber)
    );
    if (needsDraftRestore) {
        sess._draftChecked = true;
        try {
            const draft = await getCitizenDraft(mobile, reqOpUid);
            if (draft && draft.citizenProfile && (draft.citizenProfile.fullNameEng || draft.citizenProfile.fullNameTam)) {
                const fresh = createFreshProfile(mobile);
                const prevProf = sess.citizenProfile || {};
                const draftProf = draft.citizenProfile || {};
                const mergedGas = Object.assign({}, fresh.gasDetails || {}, prevProf.gasDetails || {}, draftProf.gasDetails || {});
                if (draftProf.gasDetails?.consumerNumber && !mergedGas.consumerNumber) mergedGas.consumerNumber = draftProf.gasDetails.consumerNumber;
                if (draftProf.gasDetails?.agencyName && !mergedGas.agencyName) mergedGas.agencyName = draftProf.gasDetails.agencyName;
                if (draftProf.gasDetails?.cylinders && (!mergedGas.cylinders || mergedGas.cylinders === '0')) mergedGas.cylinders = draftProf.gasDetails.cylinders;
                if (draftProf.gasDetails?.oilCompany && !mergedGas.oilCompany) mergedGas.oilCompany = draftProf.gasDetails.oilCompany;
                if (draftProf.gasDetails?.oilCompanyDisplay && !mergedGas.oilCompanyDisplay) mergedGas.oilCompanyDisplay = draftProf.gasDetails.oilCompanyDisplay;
                
                const gasDoc = draft.documents?.gasBook || draftProf.documents?.gasBook || draftProf.residenceProof?.docPath || draftProf.gasDetails?.gasBookPath || null;
                if (gasDoc) {
                    mergedGas.gasBookPath = gasDoc;
                    mergedGas.hasGas = true;
                    if (!mergedGas.cylinders || mergedGas.cylinders === '0') mergedGas.cylinders = '1';
                    if (!mergedGas.oilCompany) mergedGas.oilCompany = 'IOC';
                    if (!mergedGas.oilCompanyDisplay) mergedGas.oilCompanyDisplay = 'Indane Gas (IOCL)';
                }

                const mergedResidence = draftProf.residenceProof || prevProf.residenceProof || (gasDoc ? { type: 'GAS_BOOK', typeTam: 'எரிவாயு நுகர்வோர் அட்டை', docPath: gasDoc } : null);

                sess.citizenProfile = {
                    ...fresh,
                    ...prevProf,
                    ...draftProf,
                    gasDetails: mergedGas,
                    residenceProof: mergedResidence,
                    cardTypeTam: draftProf.cardTypeTam || prevProf.cardTypeTam || 'அரிசி அட்டை'
                };
                sess.intakeState = sess.intakeState || draft.intakeState;
                sess.step = sess.step || draft.step;
                sess.subService = draft.subService || draftProf.subService || sess.subService || null;
                sess.subServiceData = draft.subServiceData || draftProf.subServiceData || sess.subServiceData || null;
                sess.tempUploads = draft.documents || sess.tempUploads || {};
                const isSubServiceActive = !!(sess.subService || sess.citizenProfile?.subService || (sess.intakeState && (sess.intakeState.startsWith('RATION_ADD_MEMBER') || sess.intakeState.startsWith('RATION_CHANGE_ADDRESS') || sess.intakeState.startsWith('RATION_REMOVE_MEMBER'))));
                if (!isSubServiceActive) {
                    sess.applicationNumber = draft.applicationNumber || sess.applicationNumber;
                    sess.applicationPdfUrl = draft.applicationPdfUrl || sess.applicationPdfUrl;
                } else {
                    sess.applicationNumber = null;
                    sess.applicationPdfUrl = null;
                }
                if (sess.intakeState === 'SERVICE_SELECTION' || draft.intakeState === 'SERVICE_SELECTION') {
                    sess.intakeState = 'SERVICE_SELECTION';
                    sess.step = 'SERVICE_SELECTION';
                    sess.subService = null;
                    sess.subServiceData = null;
                    sess.chatHistory = [getInitialWelcomeMessage(sess.citizenProfile, mobile)];
                } else if (draft.chatHistory && draft.chatHistory.length > 0 && (!isSubServiceActive || !sess.chatHistory || sess.chatHistory.length <= 1)) {
                    sess.chatHistory = draft.chatHistory;
                }
            }
        } catch (e) {}
    }

    const lastMsgInHist = Array.isArray(sess.chatHistory) && sess.chatHistory.length > 0 ? sess.chatHistory[sess.chatHistory.length - 1] : null;
    const isSubServiceReady = sess.intakeState === 'RATION_ADD_MEMBER_READY' || sess.intakeState === 'RATION_CHANGE_ADDRESS_READY' || sess.intakeState === 'RATION_REMOVE_MEMBER_READY';
    const isReadyToApply = (sess.intakeState === 'READY_TO_APPLY' || sess.step === 'ready_to_apply' || sess.step === 'READY_TO_APPLY') && sess.intakeState !== 'SERVICE_SELECTION' && sess.step !== 'SERVICE_SELECTION';
    const isBrowsingServices = !isReadyToApply && (
                               sess.intakeState === 'SERVICE_SELECTION' || 
                               sess.step === 'SERVICE_SELECTION' ||
                               sess.intakeState === 'RATION_CARD_SERVICES' ||
                               sess.step === 'RATION_CARD_SERVICES' ||
                               (sess.intakeState && sess.intakeState.startsWith('RATION_') && !isSubServiceReady) ||
                               (sess.intakeState && ['INCOME_INTAKE', 'RESIDENCE_INTAKE', 'COMMUNITY_INTAKE', 'VOTER_INTAKE'].includes(sess.intakeState)) ||
                               (lastMsgInHist && lastMsgInHist.text && (
                                   lastMsgInHist.text.includes('குடும்ப அட்டை (Ration Card) சேவைகள்') ||
                                   lastMsgInHist.text.includes('எந்த அரசு சேவைக்கு விண்ணப்பிக்க')
                               )));

    if (isBrowsingServices && !isSubServiceReady) {
        sess.intakeState = sess.intakeState || 'SERVICE_SELECTION';
        sess.step = sess.step || 'SERVICE_SELECTION';
        if (Array.isArray(sess.chatHistory)) {
            sess.chatHistory = sess.chatHistory.filter(m => {
                if (!m || !m.text) return false;
                if (m.text.includes('விண்ணப்பம் தயார்') || 
                    (m.options && m.options.some(o => o.value === 'CONFIRM_SUBMIT'))) {
                    return false;
                }
                return true;
            });
            if (sess.chatHistory.length === 0 || sess.intakeState === 'SERVICE_SELECTION') {
                sess.chatHistory = [getInitialWelcomeMessage(sess.citizenProfile, mobile)];
            }
        }
    } else if (sess.citizenProfile && !isBrowsingServices && (sess.intakeState === 'READY_TO_APPLY' || sess.step === 'ready_to_apply')) {
        const memCount = sess.citizenProfile.members ? sess.citizenProfile.members.length : 1;
        const targetCount = sess.targetMemberCount || memCount;
        if (targetCount <= memCount) {
            sess.targetMemberCount = memCount;
            sess.intakeState = 'READY_TO_APPLY';
            sess.step = 'READY';
            const headName = sess.citizenProfile.fullNameTam || sess.citizenProfile.fullNameEng || 'வாடிக்கையாளர்';
            const dist = sess.citizenProfile.district || 'இராணிப்பேட்டை';
            const tlk = sess.citizenProfile.taluk || 'அரக்கோணம்';

            if (Array.isArray(sess.chatHistory)) {
                sess.chatHistory = sess.chatHistory.filter(m => {
                    if (!m || !m.text) return false;
                    if (m.actionRequired === 'upload' || m.uploadPrompt) return false;
                    if (m.text.includes('CONTINUE_INTAKE') || 
                        m.text.includes('முந்தைய விண்ணப்ப வரைவு') ||
                        m.text.includes('விண்ணப்பம் பாதி நிரப்பப்பட்டுள்ளது') ||
                        m.text.includes('விண்ணப்பம் தயார்') ||
                        m.text.includes('பதிவேற்றவும்') ||
                        m.text.includes('உறுப்பினர் 2')) {
                        return false;
                    }
                    return true;
                });

                const lastMsg = sess.chatHistory[sess.chatHistory.length - 1];
                const hasFinalCard = lastMsg && lastMsg.options && lastMsg.options.some(o => o.value === 'CONFIRM_SUBMIT');
                const hasActiveLiveRun = sess.chatHistory.some(m => m && m.text && (
                    m.text.includes('Final Submit Approval Required') ||
                    m.text.includes('இறுதி சமர்ப்பிப்பு ஒப்புதல் தேவை') ||
                    m.text.includes('படிவம் 100% பூர்த்தி') ||
                    m.text.includes('Approval Station') ||
                    m.text.includes('சமர்ப்பிக்கப்படுகிறது')
                ));
                if (hasFinalCard) {
                    lastMsg.options = lastMsg.options.filter(o => !o.value.startsWith('ADD_MEMBER_'));
                } else if (!hasActiveLiveRun) {
                    sess.chatHistory.push({
                        sender: 'bot',
                        text: `✅ **வாடிக்கையாளர் (${headName}) விண்ணப்பம் தயார்! (Application Ready)** 🎯\n\n` +
                              `• 👤 **குடும்பத் தலைவர்:** ${headName}\n` +
                              `• 👥 **மொத்த உறுப்பினர்கள்:** ${memCount} நபர்(கள்)\n` +
                              `• 🏛️ **இருப்பிடம்:** ${tlk}, ${dist}\n` +
                              `• 📄 **ஆவணங்கள்:** புகைப்படங்கள் & சான்றிதழ்கள் அனைத்தும் ஏற்கெனவே தயார்! ✅\n\n` +
                              `💡 *வலதுபுறம் உள்ள விவரங்களைச் சரிபார்த்துவிட்டு, வாடிக்கையாளர் OTP சொல்லத் தயாராக இருந்தால் கீழே உள்ள பச்சை பொத்தானை அழுத்தி நேரடியாக TNPDS போர்ட்டலில் விண்ணப்பிக்கலாம்.*`,
                        options: [
                            { label: "🚀 TNPDS போர்ட்டலில் விண்ணப்பி (Submit to Portal)", value: "CONFIRM_SUBMIT" },
                            { label: "✏️ விவரங்களைச் சரிபார் / திருத்து (Review Details)", value: "TRIGGER_EDIT_MODAL" },
                            { label: "➕ புதிய வாடிக்கையாளர் விண்ணப்பம்", value: "START_NEW_CUSTOMER" }
                        ]
                    });
                }
            }
        }
    }

    if (sess.intakeState === 'READY_TO_APPLY' || sess.step === 'READY') {
        const firstSummary = (Array.isArray(sess.chatHistory) ? sess.chatHistory : []).find(m => m && m.text && m.text.includes('விவரங்கள் தயாராக உள்ளன'));
        if (firstSummary) {
            sess.chatHistory = [firstSummary];
        }
    }

    const activeSub = sess.subService || sess.citizenProfile?.subService || null;
    const docsList = extractDraftDocumentsList(sess, sess.draftData || null, mobile, activeSub);
    const cleanChatHistory = (Array.isArray(sess.chatHistory) ? sess.chatHistory : []).filter(m => {
        if (!m || !m.text) return false;
        const t = m.text;
        if (t.includes('[படி ') || 
            t.includes('[Step ') || 
            t.includes('Toast Message') || 
            t.includes('பூட்டப்பட்டது') || 
            t.includes('சரிபார்க்கப்படுகிறது') ||
            t.includes('Google Chrome') ||
            t.includes('Strict Gate Halt') ||
            t.includes('OTP_NOT_VERIFIED') ||
            t.includes('தட்டச்சு செய்யப்படுகிறது') ||
            t.includes('அரசு TNPDS போர்ட்டல் உங்கள் கைபேசி எண்ணிற்கு')) {
            return false;
        }
        return true;
    });
    sess.chatHistory = cleanChatHistory;

    res.json({
        chatHistory: cleanChatHistory,
        citizenProfile: sess.citizenProfile,
        subService: sess.subService || sess.citizenProfile?.subService || null,
        subServiceData: sess.subServiceData || sess.citizenProfile?.subServiceData || null,
        documents: sess.tempUploads || sess.citizenProfile?.documents || {},
        documentsList: docsList,
        step: sess.step === 'submitted' ? 'submitted' : (sess.intakeState || sess.step),
        intakeState: sess.intakeState,
        applicationNumber: (sess.step === 'submitted' || (!sess.subService && (!sess.intakeState || !sess.intakeState.startsWith('RATION_')))) ? (sess.applicationNumber || null) : null,
        applicationPdfUrl: (sess.step === 'submitted' || (!sess.subService && (!sess.intakeState || !sess.intakeState.startsWith('RATION_')))) ? (sess.applicationPdfUrl || null) : null
    });
});

// 2. POST /api/chat/resend-otp
router.post('/api/chat/resend-otp', async (req, res) => {
    const resendResult = await resendOtp();
    const activeState = storageService.getSessionState();
    if (activeState) {
        activeState.chatHistory.push({
            sender: 'bot',
            text: resendResult.success 
                ? `🔄 **அரசு இணையதளத்தில் புதிய OTP மீண்டும் அனுப்பப்பட்டுள்ளது!**\n\nஉங்கள் கைபேசிக்கு வந்துள்ள புதிய 6-இலக்க OTP எண்ணை உள்ளிடவும்:`
                : `⚠️ ${resendResult.message}`
        });
    }
    res.json({
        success: resendResult.success,
        chatHistory: activeState ? activeState.chatHistory : [],
        citizenProfile: activeState ? activeState.citizenProfile : null,
        step: activeState ? activeState.step : 'WAITING_FOR_OTP'
    });
});

// 3. GET /api/chat/otp-status
router.get('/api/chat/otp-status', async (req, res) => {
    try {
        const status = await getLiveOtpStatus();
        res.json(status);
    } catch (e) {
        res.json({ isWaitingForOtp: false, seconds: 0, otpType: '' });
    }
});

// 4. POST /api/chat/live-step
router.post('/api/chat/live-step', async (req, res) => {
    try {
        const text = req.body.text || req.body.message || '';
        const targetMobile = req.body.mobile || req.body.mobileNumber || req.headers['x-session-mobile'] || getActiveMobile();
        if (targetMobile && text) {
            const sess = getOrCreateSession(targetMobile);
            const stepMatch = text.match(/(?:\[\s*(?:படி|படிகள்|Step)\s*|(?:படி|படிகள்|Step)\s+)(\d+)(?:\s*-\s*\d+)?\s*\/\s*(\d+)\]?/i);
            if (stepMatch) {
                sess.automationStep = parseInt(stepMatch[1], 10);
                sess.automationTotal = parseInt(stepMatch[2], 10) || 51;
            }
            sess.automationCurrentStepMsg = text;
            sess.isAutomating = true;
            sess.isAutomationRunning = true;

            // Clean any live step logs from chatHistory so history remains pristine
            if (Array.isArray(sess.chatHistory)) {
                sess.chatHistory = sess.chatHistory.filter(m => !m.text.includes('[படி ') && !m.text.includes('Toast Message') && !m.text.includes('சரிபார்க்கப்படுகிறது') && !m.text.includes('பூட்டப்பட்டது') && !m.text.includes('Google Chrome'));
            }
            persistSessions();
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 5. POST /api/chat/reset
router.post('/api/chat/reset', async (req, res) => {
    const forceClean = req.body?.forceClean === true || req.body?.isOp === true;
    const targetMobile = (req.body?.mobileNumber || req.headers['x-session-mobile'] || getActiveMobile() || '').trim();
    try {
        await stopTnpdsAutomation().catch(e => console.warn('TNPDS stop warn on reset:', e.message));
        if (typeof stopTnegaAutomation === 'function') {
            await stopTnegaAutomation().catch(e => console.warn('TNeGA stop warn on reset:', e.message));
        }
    } catch (e) {}

    let existingProfile = null;
    let existingDocs = {};
    if (targetMobile && sessions.has(targetMobile)) {
        const prev = sessions.get(targetMobile);
        if (!forceClean) {
            existingProfile = prev.citizenProfile;
            existingDocs = prev.tempUploads || {};
            delete existingDocs.memberAadhaarFront;
            delete existingDocs.memberAadhaarBack;
            delete existingDocs.memberAadhaar;
            delete existingDocs.memberAadhaars;
            if (existingProfile?.documents) {
                delete existingProfile.documents.memberAadhaarFront;
                delete existingProfile.documents.memberAadhaarBack;
                delete existingProfile.documents.memberAadhaar;
                delete existingProfile.documents.memberAadhaars;
            }
        }
        sessions.delete(targetMobile);
    }
    if (forceClean) {
        setActiveMobile(null);
    }
    if (targetMobile) {
        try {
            const diskDraft = await getCitizenDraft(targetMobile);
            if (diskDraft) {
                diskDraft.subService = null;
                diskDraft.subServiceData = null;
                if (diskDraft.citizenProfile) {
                    diskDraft.citizenProfile.subService = null;
                    diskDraft.citizenProfile.subServiceData = null;
                    if (diskDraft.citizenProfile.documents) {
                        delete diskDraft.citizenProfile.documents.memberAadhaarFront;
                        delete diskDraft.citizenProfile.documents.memberAadhaarBack;
                        delete diskDraft.citizenProfile.documents.memberAadhaar;
                        delete diskDraft.citizenProfile.documents.memberAadhaars;
                    }
                }
                if (diskDraft.documents) {
                    delete diskDraft.documents.memberAadhaarFront;
                    delete diskDraft.documents.memberAadhaarBack;
                    delete diskDraft.documents.memberAadhaar;
                    delete diskDraft.documents.memberAadhaars;
                }
                diskDraft.intakeState = 'SERVICE_SELECTION';
                diskDraft.step = 'SERVICE_SELECTION';
                diskDraft.chatHistory = [getInitialWelcomeMessage(diskDraft.citizenProfile, targetMobile)];
                await saveCitizenDraft(targetMobile, diskDraft);
            }
        } catch (e) {
            console.warn('Draft cleanup warn on reset:', e.message);
        }
    }
    const hasValidProfile = !forceClean && existingProfile && (existingProfile.fullNameEng || existingProfile.fullNameTam || (existingProfile.members && existingProfile.members.length > 0));
    if (existingProfile) {
        existingProfile.subService = null;
        existingProfile.subServiceData = null;
    }
    const freshSession = {
        intakeState: 'SERVICE_SELECTION',
        targetMemberCount: (hasValidProfile && existingProfile.members?.length) || 1,
        currentMemberIdx: (hasValidProfile && existingProfile.members?.length) || 1,
        tempUploads: hasValidProfile ? existingDocs : {},
        tempMember: null,
        step: 'SERVICE_SELECTION',
        subService: null,
        subServiceData: null,
        citizenProfile: hasValidProfile ? existingProfile : createFreshProfile(forceClean ? '' : targetMobile),
        chatHistory: [getInitialWelcomeMessage(hasValidProfile ? existingProfile : null, targetMobile)],
        applicationNumber: null,
        automationStep: 0,
        automationTotal: 51,
        isAutomating: false,
        isAutomationRunning: false
    };
    if (targetMobile && !forceClean) {
        sessions.set(targetMobile, freshSession);
    }
    setSessionState(freshSession);
    persistSessions();
    res.json({
        success: true,
        chatHistory: freshSession.chatHistory,
        citizenProfile: freshSession.citizenProfile,
        step: freshSession.intakeState
    });
});

// 6. POST /api/chat/confirm_submit
router.post('/api/chat/confirm_submit', async (req, res) => {
    try {
        const submitResult = await submitTnpdsApplication();
        const activeState = storageService.getSessionState();
        if (activeState) {
            if (submitResult.applicationNumber) {
                activeState.applicationNumber = submitResult.applicationNumber;
            } else {
                const refMatch = submitResult.message.match(/[\d]{8,}/);
                if (refMatch) activeState.applicationNumber = refMatch[0];
            }

            if (submitResult.applicationPdfUrl) {
                activeState.applicationPdfUrl = submitResult.applicationPdfUrl;
            }

            activeState.chatHistory.push({
                sender: 'bot',
                text: submitResult.message,
                applicationNumber: activeState.applicationNumber,
                applicationPdfUrl: activeState.applicationPdfUrl
            });

            if (activeState.applicationNumber) {
                activeState.citizenProfile.applicationNumber = activeState.applicationNumber;
                if (activeState.applicationPdfUrl) {
                    activeState.citizenProfile.applicationPdfUrl = activeState.applicationPdfUrl;
                }
                activeState.citizenProfile.submittedAt = new Date().toISOString();
                saveCitizenProfile(getActiveMobile(), activeState.citizenProfile);
                activeState.chatHistory.push({
                    sender: 'bot',
                    text: `📋 **விண்ணப்ப பதிவு குறிப்பு எண் (Application Reference No.):**\n\n` +
                          `# 🎫 ${activeState.applicationNumber}\n\n` +
                          (activeState.applicationPdfUrl ? `📥 **[அதிகாரப்பூர்வ விண்ணப்ப படிவத்தைப் பதிவிறக்கம் செய்ய (PDF)](${activeState.applicationPdfUrl})**\n\n` : '') +
                          `இந்த எண்ணை எதிர்கால பயன்பாட்டிற்காகக் குறித்து வைக்கவும். TNPDS போர்ட்டலில் விண்ணப்பத்தின் நிலையை சரிபார்க்க இந்த எண் தேவைப்படும்!`,
                    applicationNumber: activeState.applicationNumber,
                    applicationPdfUrl: activeState.applicationPdfUrl
                });
            }

            activeState.step = 'submitted';
            persistSessions();
        }

        res.json({
            chatHistory: activeState ? activeState.chatHistory : [],
            citizenProfile: activeState ? activeState.citizenProfile : null,
            step: 'submitted',
            applicationNumber: activeState?.applicationNumber || null,
            applicationPdfUrl: activeState?.applicationPdfUrl || null
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
