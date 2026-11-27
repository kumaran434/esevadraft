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
    resolveSessionForRequest,
    makeScopedSessionKey,
    getActiveMobile, 
    setActiveMobile, 
    setSessionState, 
    persistSessions 
} = storageService;
const { normalizeOperatorUid } = require('../services/db/firestore_client');

// 1. GET /api/chat/history
router.get('/api/chat/history', async (req, res) => {
    const isOpReq = !!(req.headers['x-operator-uid'] || req.query.role === 'operator');
    const reqOpUid = req.headers['x-operator-uid'] || req.query.operatorUid || null;
    const requestedDraftId = String(req.query.draftId || req.headers['x-draft-id'] || '').trim();
    const targetMobile = (req.query.mobile || req.headers['x-session-mobile'] || '').trim();

    if (isOpReq && !targetMobile && !requestedDraftId) {
        return res.json({
            chatHistory: [getInitialWelcomeMessage()],
            citizenProfile: null,
            step: 'READY',
            noCustomerActive: true
        });
    }

    const mobile = targetMobile || getActiveMobile();
    const sess = (requestedDraftId || reqOpUid)
        ? resolveSessionForRequest({ draftId: requestedDraftId, mobile, operatorUid: reqOpUid })
        : (mobile ? getOrCreateSession(mobile) : storageService.getSessionState());
    if (sess === null && requestedDraftId) {
        return res.status(403).json({
            error: 'இந்த வாடிக்கையாளர் விவரங்கள் மற்றொரு மையத்திற்குரியவை.',
            chatHistory: [getInitialWelcomeMessage()],
            citizenProfile: null,
            step: 'READY',
            noCustomerActive: true
        });
    }
    if (!sess) {
        return res.json({ chatHistory: [getInitialWelcomeMessage()], citizenProfile: null, step: 'READY' });
    }

    // STRICT TENANT BOUNDARY: Only reject if explicitly requesting another operator's draftId
    if (isOpReq && reqOpUid && sess.operatorUid) {
        const normSessOp = normalizeOperatorUid(sess.operatorUid);
        const normReqOp = normalizeOperatorUid(reqOpUid);
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

    // Golden Rule 24 (100% Pure Fresh Mode):
    // NEVER resurrect an old saved draft from disk into a fresh session during /api/chat/history polling!
    const needsDraftRestore = mobile && !sess._isPureFreshSession && (
        !sess._draftChecked ||
        !sess.citizenProfile ||
        (
            !sess.citizenProfile.fullNameEng &&
            !sess.citizenProfile.fullNameTam &&
            !sess.subService &&
            (!Array.isArray(sess.citizenProfile.members) || sess.citizenProfile.members.length === 0)
        )
    );
    if (needsDraftRestore) {
        sess._draftChecked = true;
        try {
            const lookupKey = requestedDraftId || sess.draftId || mobile;
            const draft = await getCitizenDraft(lookupKey, reqOpUid);
            if (draft && draft.citizenProfile && (draft.citizenProfile.fullNameEng || draft.citizenProfile.fullNameTam || draft.subService || draft.citizenProfile.subService || (draft.subServiceData && Object.keys(draft.subServiceData).length > 0))) {
                if (draft.draftId && !sess.draftId) sess.draftId = draft.draftId;
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
                const restoredTempUploads = {};
                for (const [k, v] of Object.entries(draft.documents || {})) {
                    if (v !== null && v !== undefined && v !== '') restoredTempUploads[k] = v;
                }
                for (const [k, v] of Object.entries(sess.tempUploads || {})) {
                    if (v !== null && v !== undefined && v !== '') restoredTempUploads[k] = v;
                }
                sess.tempUploads = restoredTempUploads;
                const isSubServiceActive = !!(sess.subService || sess.citizenProfile?.subService || (sess.intakeState && (sess.intakeState.startsWith('RATION_ADD_MEMBER') || sess.intakeState.startsWith('RATION_CHANGE_ADDRESS') || sess.intakeState.startsWith('RATION_REMOVE_MEMBER'))));
                if (!isSubServiceActive) {
                    sess.applicationNumber = draft.applicationNumber || sess.applicationNumber;
                    sess.applicationPdfUrl = draft.applicationPdfUrl || sess.applicationPdfUrl;
                } else {
                    sess.applicationNumber = null;
                    sess.applicationPdfUrl = null;
                }
                const hasRestoredSubSvc = Boolean(
                    (sess.subService && sess.subService !== 'NEW_CARD' && sess.subServiceData && Object.keys(sess.subServiceData).length > 0) ||
                    (draft.subService && draft.subService !== 'NEW_CARD' && (draft.subServiceData || draftProf.subServiceData))
                );
                if (!hasRestoredSubSvc && (sess.intakeState === 'SERVICE_SELECTION' || draft.intakeState === 'SERVICE_SELECTION')) {
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

    const isSubSvcActive = Boolean(
        sess.subService &&
        !['NEW_CARD', 'NEW_RATION_CARD', 'NEW_SMART_CARD'].includes(String(sess.subService).toUpperCase())
    );
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
    } else if (sess.citizenProfile && !isBrowsingServices && !isSubSvcActive && (sess.intakeState === 'READY_TO_APPLY' || sess.step === 'ready_to_apply')) {
        const memCount = sess.citizenProfile.members ? sess.citizenProfile.members.length : 1;
        const targetCount = sess.targetMemberCount || memCount;
        if (targetCount <= memCount) {
            sess.targetMemberCount = memCount;
            sess.intakeState = 'READY_TO_APPLY';
            sess.step = 'READY';
            const headName = sess.citizenProfile.fullNameTam || sess.citizenProfile.fullNameEng || 'வாடிக்கையாளர்';
            const dist = sess.citizenProfile.district || '';
            const tlk = sess.citizenProfile.taluk || '';

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
    const docsList = extractDraftDocumentsList(sess, sess._isPureFreshSession ? null : (sess.draftData || null), sess.draftId || mobile, activeSub);
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

    // Sync active session state to draft storage so API & edit modal are always 100% in sync
    const mergedCleanDocs = {};
    for (const [k, v] of Object.entries({ ...(sess.citizenProfile?.documents || {}), ...(sess.tempUploads || {}) })) {
        if (v !== null && v !== undefined && v !== '') mergedCleanDocs[k] = v;
    }
    const hasMeaningfulPollData = Boolean(
        sess.citizenProfile &&
        (sess.citizenProfile.fullNameEng || sess.citizenProfile.fullNameTam || sess.citizenProfile.headAadhaar ||
         (sess.subServiceData && Object.keys(sess.subServiceData).length > 0) ||
         (sess.citizenProfile.subServiceData && Object.keys(sess.citizenProfile.subServiceData).length > 0))
    );
    const isEmptyMenuShell = (sess.intakeState === 'SERVICE_SELECTION' && !sess.subService && !sess.subServiceData && !sess.citizenProfile?.subServiceData);
    if (mobile && !sess._isPureFreshSession && hasMeaningfulPollData && !isEmptyMenuShell) {
        const saveKey = sess.draftId || mobile;
        saveCitizenDraft(saveKey, {
            draftId: saveKey,
            mobileNumber: mobile,
            operatorUid: sess.operatorUid || reqOpUid || null,
            operatorName: sess.operatorName || null,
            operatorMobile: sess.operatorMobile || null,
            subService: sess.subService || sess.citizenProfile?.subService || null,
            subServiceData: sess.subServiceData || sess.citizenProfile?.subServiceData || null,
            intakeState: sess.intakeState,
            step: sess.intakeState || sess.step,
            citizenProfile: sess.citizenProfile,
            documents: mergedCleanDocs,
            base64Docs: sess.base64Docs || sess.citizenProfile?.base64Docs || {},
            tempUploads: mergedCleanDocs,
            chatHistory: cleanChatHistory
        }).catch(err => console.warn('Background draft sync from chat error:', err.message));
    }

    res.json({
        chatHistory: cleanChatHistory,
        citizenProfile: sess.citizenProfile,
        subService: sess.subService || sess.citizenProfile?.subService || null,
        subServiceData: sess.subServiceData || sess.citizenProfile?.subServiceData || null,
        documents: mergedCleanDocs,
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
        const reqDraftId = String(req.body.draftId || req.headers['x-draft-id'] || '').trim();
        const reqOpUid = req.headers['x-operator-uid'] || req.body.operatorUid || null;
        if (targetMobile && text) {
            const sess = (typeof resolveSessionForRequest === 'function' && (reqDraftId || reqOpUid))
                ? resolveSessionForRequest({ draftId: reqDraftId, mobile: targetMobile, operatorUid: reqOpUid })
                : getOrCreateSession(targetMobile);
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
            persistSessions(sess);
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 5. POST /api/chat/reset
router.post('/api/chat/reset', async (req, res) => {
    const forceClean = req.body?.forceClean === true || req.body?.isOp === true;
    const reqOpUid = normalizeOperatorUid(req.headers['x-operator-uid'] || req.body?.operatorUid || null);
    const reqDraftId = String(req.body?.draftId || req.headers['x-draft-id'] || '').trim();
    const targetMobile = (req.body?.mobileNumber || req.headers['x-session-mobile'] || getActiveMobile() || '').trim();
    try {
        await stopTnpdsAutomation().catch(e => console.warn('TNPDS stop warn on reset:', e.message));
        if (typeof stopTnegaAutomation === 'function') {
            await stopTnegaAutomation().catch(e => console.warn('TNeGA stop warn on reset:', e.message));
        }
    } catch (e) {}

    if (reqDraftId && sessions.has(reqDraftId)) {
        const prevD = sessions.get(reqDraftId);
        if (!reqOpUid || !normalizeOperatorUid(prevD?.operatorUid) || normalizeOperatorUid(prevD?.operatorUid) === reqOpUid) {
            sessions.delete(reqDraftId);
        }
    }
    if (reqOpUid && targetMobile) {
        const scopedKey = makeScopedSessionKey(targetMobile, reqOpUid);
        if (sessions.has(scopedKey)) sessions.delete(scopedKey);
    }
    if (targetMobile && sessions.has(targetMobile)) {
        const prev = sessions.get(targetMobile);
        if (!reqOpUid || !normalizeOperatorUid(prev?.operatorUid) || normalizeOperatorUid(prev?.operatorUid) === reqOpUid) {
            sessions.delete(targetMobile);
        }
    }
    if (forceClean) {
        setActiveMobile(null);
    }
    // 1 Application = 1 Independent File Law:
    // Clicking "துடை (Clear)" ONLY clears the active screen in memory & detaches the active draftId router.
    // It MUST NEVER overwrite or corrupt already-saved application files on disk (e.g. wiping subService='CHANGE_ADDRESS' to null)!
    if (targetMobile) {
        try {
            const { clearActiveDraftId } = require('../services/db/firestore_client');
            clearActiveDraftId(targetMobile, reqOpUid);
            if (forceClean && !reqOpUid) storageService.purgeSession(targetMobile);
        } catch (_) {}
    }
    const { generateUniqueDraftId, setActiveDraftIdForMobile } = require('../services/db/firestore_client');
    const nextFreshDraftId = (targetMobile && !forceClean && !String(targetMobile).startsWith('walkin_'))
        ? generateUniqueDraftId(targetMobile)
        : null;
    if (nextFreshDraftId) {
        setActiveDraftIdForMobile(targetMobile, nextFreshDraftId, reqOpUid);
    }
    const freshSession = {
        draftId: nextFreshDraftId || undefined,
        mobileNumber: forceClean ? '' : targetMobile,
        operatorUid: reqOpUid || null,
        intakeState: 'SERVICE_SELECTION',
        targetMemberCount: 1,
        currentMemberIdx: 1,
        tempUploads: {},
        tempMember: null,
        step: 'SERVICE_SELECTION',
        subService: null,
        subServiceData: null,
        citizenProfile: createFreshProfile(forceClean ? '' : targetMobile),
        chatHistory: [getInitialWelcomeMessage(null, forceClean ? '' : targetMobile)],
        applicationNumber: null,
        automationStep: 0,
        automationTotal: 51,
        isAutomating: false,
        isAutomationRunning: false,
        _draftChecked: true,
        _isPureFreshSession: true
    };
    if (targetMobile) {
        if (reqOpUid) {
            sessions.set(makeScopedSessionKey(targetMobile, reqOpUid), freshSession);
        }
        const bareExisting = sessions.get(targetMobile);
        if (!bareExisting || !reqOpUid || !normalizeOperatorUid(bareExisting?.operatorUid) || normalizeOperatorUid(bareExisting?.operatorUid) === reqOpUid) {
            sessions.set(targetMobile, freshSession);
        }
        if (nextFreshDraftId) sessions.set(nextFreshDraftId, freshSession);
    }
    setSessionState(freshSession);
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
                const refMatch = String(submitResult.message || '').match(/[\d]{8,}/);
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
