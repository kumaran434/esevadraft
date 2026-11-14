const express = require('express');
const router = express.Router();

const { 
    getUserProfile, 
    saveUserProfile, 
    lookupUserByMobile, 
    saveActiveOperatorSession,
    getActiveOperatorSession,
    clearActiveOperatorSession,
    listAllDrafts, 
    getCitizenDraft, 
    saveCitizenDraft 
} = require('../../firestore_db');

const { getInitialWelcomeMessage } = require('../core/chat_fsm');
const storageService = require('../services/storage_service');
const { 
    sessions, 
    createFreshProfile, 
    getOrCreateSession, 
    setActiveSession, 
    persistSessions,
    getActiveMobile,
    setActiveMobile,
    setSessionState
} = storageService;
const { isProfileDataComplete } = require('../services/profile_helpers');
const { mergeDraftIntoSession } = require('../services/session_draft_merger');

// 1. GET /api/auth/session
router.get('/api/auth/session', async (req, res) => {
    const opUid = req.headers['x-operator-uid'] || null;
    const reqRole = req.query.role || null;
    const targetMobile = (req.query.mobile || req.headers['x-session-mobile'] || '').trim();

    // 1. Operator session check: UID must be provided and valid, or restored from local desktop disk session
    if (opUid) {
        let opProfile = null;
        try { opProfile = await getUserProfile(opUid); } catch (e) {}
        if (opProfile && (opProfile.role === 'operator' || opProfile.role === 'admin')) {
            return res.json({
                isLoggedIn: true,
                operatorUid: opUid,
                mobileNumber: opProfile.mobileNumber || null,
                email: opProfile.email || null,
                displayName: opProfile.displayName || 'இ-சேவை மையம்',
                role: opProfile.role || 'operator',
                isAdmin: opProfile.isAdmin === true || opProfile.role === 'admin',
                citizenProfile: null,
                resumedSession: false,
                intakeState: 'SERVICE_SELECTION',
                chatHistory: [getInitialWelcomeMessage()],
                applicationNumber: null,
                applicationPdfUrl: null
            });
        }
    }

    if ((reqRole === 'operator' || process.env.DESKTOP_RUNTIME === '1') && !targetMobile) {
        const diskOp = typeof getActiveOperatorSession === 'function' ? getActiveOperatorSession() : null;
        if (diskOp && diskOp.operatorUid) {
            return res.json({
                isLoggedIn: true,
                operatorUid: diskOp.operatorUid,
                mobileNumber: diskOp.mobileNumber || null,
                email: diskOp.email || null,
                displayName: diskOp.displayName || 'இ-சேவை மையம்',
                role: diskOp.role || 'operator',
                isAdmin: !!diskOp.isAdmin,
                citizenProfile: null,
                resumedSession: false,
                intakeState: 'SERVICE_SELECTION',
                chatHistory: [getInitialWelcomeMessage()],
                applicationNumber: null,
                applicationPdfUrl: null
            });
        }
    }

    if (reqRole === 'operator') {
        return res.json({ isLoggedIn: false, role: 'operator' });
    }

    // 2. Citizen session check - ONLY if an explicit 10-digit mobile is provided by THIS client
    if (targetMobile && /^\d{10}$/.test(targetMobile)) {
        const sess = getOrCreateSession(targetMobile);
        return res.json({
            isLoggedIn: true,
            mobileNumber: targetMobile,
            role: 'citizen',
            displayName: (sess && sess.citizenProfile && sess.citizenProfile.fullNameTam) ? sess.citizenProfile.fullNameTam : 'பொதுமக்கள்',
            citizenProfile: sess ? sess.citizenProfile : null,
            resumedSession: !!(sessions.has(targetMobile) && sess && sess.intakeState !== 'SERVICE_SELECTION'),
            intakeState: sess ? sess.intakeState : 'SERVICE_SELECTION',
            chatHistory: sess ? sess.chatHistory : [],
            applicationNumber: sess ? (sess.applicationNumber || null) : null,
            applicationPdfUrl: sess ? (sess.applicationPdfUrl || null) : null
        });
    }

    // 3. No authenticated session exists for this client (NEVER leak server-global activeMobile)
    return res.json({
        isLoggedIn: false,
        mobileNumber: null,
        role: null,
        displayName: null,
        citizenProfile: null,
        resumedSession: false,
        intakeState: 'SERVICE_SELECTION',
        chatHistory: [],
        applicationNumber: null,
        applicationPdfUrl: null
    });
});

// 2. GET /api/auth/lookup-mobile
router.get('/api/auth/lookup-mobile', async (req, res) => {
    const rawMobile = String(req.query.mobile || '').trim();
    const digitsOnly = rawMobile.replace(/\D/g, '');
    const cleanMobile = digitsOnly.length >= 10 ? digitsOnly.slice(-10) : digitsOnly;
    if (cleanMobile.length !== 10 && rawMobile.length < 3) {
        return res.status(400).json({ error: '10-இலக்க மொபைல் எண் தேவை.' });
    }
    try {
        const user = await lookupUserByMobile(cleanMobile.length === 10 ? cleanMobile : rawMobile);
        if (user) {
            return res.json({
                found: true,
                uid: user.uid || null,
                authEmail: user.email || (cleanMobile.length === 10 ? `${cleanMobile}@esevadraft.in` : `${rawMobile.toLowerCase()}@esevadraft.in`),
                role: user.role || 'citizen',
                displayName: user.displayName || 'பயனர்',
                mobileNumber: user.mobileNumber || (cleanMobile.length === 10 ? cleanMobile : null)
            });
        }
        return res.json({ found: false });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 2.5 GET /api/auth/profile & POST /api/auth/sync-profile (Cloud-Desktop Operator Profile Sync)
router.get('/api/auth/profile', async (req, res) => {
    const uid = String(req.query.uid || '').trim();
    if (!uid) return res.status(400).json({ found: false });
    try {
        const profile = await getUserProfile(uid);
        if (profile) return res.json({ found: true, profile });
        return res.json({ found: false });
    } catch (e) {
        res.status(500).json({ found: false, error: e.message });
    }
});

router.post('/api/auth/sync-profile', async (req, res) => {
    const body = req.body || {};
    const uid = body.uid || body.firebaseUid || body.operatorUid;
    if (!uid) return res.status(400).json({ success: false });
    try {
        const saved = await saveUserProfile(uid, body);
        res.json({ success: true, profile: saved });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 3. POST /api/auth/login
router.post('/api/auth/login', async (req, res) => {
    const { displayName, email, firebaseUid, role, operatorUid, isCustomerSession, customerMobile } = req.body;
    const rawMobile = customerMobile || req.body.mobileNumber || req.body.mobile || '';
    let cleanMobile = rawMobile.replace(/\D/g, '');
    
    if (!cleanMobile && email) {
        cleanMobile = '9876543210';
    }
    
    if (cleanMobile.length !== 10) {
        return res.status(400).json({ error: 'சரியான 10-இலக்க மொபைல் எண்ணை உள்ளிடவும்.' });
    }

    let userRole = role || 'citizen';
    let storedProfile = null;
    if (firebaseUid) {
        try {
            storedProfile = await getUserProfile(firebaseUid);
            if (storedProfile && (storedProfile.role === 'operator' || storedProfile.role === 'admin')) {
                userRole = storedProfile.role;
            } else if (role) {
                userRole = role;
            }
            const isGenericDisplay = !displayName || ['பயனர்', 'மையம்', 'இ-சேவை மையம்', 'குமரன் இ-சேவை மையம்'].includes(displayName);
            const savedName = (storedProfile && storedProfile.displayName && (isGenericDisplay || storedProfile.displayName !== 'மையம்'))
                ? storedProfile.displayName
                : (displayName || (userRole === 'operator' ? 'இ-சேவை மையம்' : 'பயனர்'));
            const savedIsAdmin = (storedProfile && typeof storedProfile.isAdmin === 'boolean') ? storedProfile.isAdmin : (userRole === 'admin');
            await saveUserProfile(firebaseUid, { 
                role: userRole, 
                isAdmin: savedIsAdmin, 
                displayName: savedName, 
                email: email || (storedProfile && storedProfile.email) || null, 
                mobileNumber: cleanMobile || (storedProfile && storedProfile.mobileNumber) || null 
            });
        } catch (e) {
            if (role) userRole = role;
        }
    }
    if (!userRole) userRole = 'citizen';

    if ((userRole === 'operator' || userRole === 'admin') && !isCustomerSession && !customerMobile) {
        if (getActiveMobile() === cleanMobile) {
            setActiveMobile(null);
            setSessionState(null);
        }
        let drafts = [];
        try {
            drafts = await listAllDrafts(firebaseUid || operatorUid);
        } catch (e) {}

        const finalOperatorName = (storedProfile && storedProfile.displayName) || (displayName && displayName !== 'பயனர்' && displayName !== 'மையம்' ? displayName : 'குமரன் இ-சேவை மையம்');
        if (typeof saveActiveOperatorSession === 'function' && (firebaseUid || operatorUid)) {
            saveActiveOperatorSession({
                operatorUid: firebaseUid || operatorUid,
                displayName: finalOperatorName,
                mobileNumber: cleanMobile,
                email: email || (storedProfile && storedProfile.email) || `${cleanMobile}@esevadraft.in`,
                role: userRole,
                isAdmin: userRole === 'admin'
            });
        }
        return res.json({
            success: true,
            isOperatorOnly: true,
            role: 'operator',
            displayName: finalOperatorName,
            operatorName: finalOperatorName,
            operatorUid: firebaseUid || operatorUid,
            operatorMobile: cleanMobile,
            chatHistory: [getInitialWelcomeMessage()],
            drafts: drafts
        });
    }

    const sess = setActiveSession(cleanMobile);
    if (displayName) sess.operatorName = displayName;
    if (email) sess.operatorEmail = email;
    if (firebaseUid) sess.firebaseUid = firebaseUid;
    if (operatorUid) sess.operatorUid = operatorUid;
    sess.role = userRole;

    let draft = null;
    try {
        draft = await getCitizenDraft(cleanMobile);
    } catch (e) {
        console.warn('Draft check error:', e.message);
    }

    const hasDraftData = mergeDraftIntoSession(sess, draft, cleanMobile);
    const isProfileComplete = isProfileDataComplete(sess.citizenProfile, sess.tempUploads);
    const lastMsgInDraft = Array.isArray(sess.chatHistory) && sess.chatHistory.length > 0 ? sess.chatHistory[sess.chatHistory.length - 1] : null;
    const isBrowsingServices = sess.intakeState === 'SERVICE_SELECTION' || 
                               sess.intakeState === 'RATION_CARD_SERVICES' ||
                               (sess.intakeState && sess.intakeState.startsWith('RATION_')) ||
                               (lastMsgInDraft && lastMsgInDraft.text && (
                                   lastMsgInDraft.text.includes('குடும்ப அட்டை (Ration Card) சேவைகள்') ||
                                   lastMsgInDraft.text.includes('எந்த அரசு சேவைக்கு விண்ணப்பிக்க விரும்புகிறீர்கள்')
                               ));

    if (draft) {
        // Sanitize chat history: Filter out stale aborted error messages and mock runs from past sessions
        if (Array.isArray(sess.chatHistory)) {
            sess.chatHistory = sess.chatHistory.filter(m => {
                if (!m || !m.text) return false;
                const txt = String(m.text);
                const isStaleError = txt.includes('ஆட்டோமேஷன் பிழையினால் நிறுத்தப்பட்டது') || 
                                     txt.includes('Target page, context or browser has been closed') ||
                                     txt.includes('சுயகற்றல் சோதனை முறை (Mock Sandbox)') ||
                                     (m.sender === 'user' && txt.trim().toLowerCase() === 'start');
                return !isStaleError;
            });
        }

        if (draft.status === 'SUBMITTED' || draft.applicationNumber) {
            sess.intakeState = 'SUBMITTED';
            sess.step = 'submitted';
            sess.applicationNumber = draft.applicationNumber;
            sess.applicationPdfUrl = draft.applicationPdfUrl || `/receipts/Application_${draft.applicationNumber}.pdf`;

            const hasCompletedMsg = sess.chatHistory.some(m => m && m.text && (m.text.includes('வெற்றிகரமாக அரசு போர்ட்டலில் சமர்ப்பிக்கப்பட்டுவிட்டது') || m.text.includes('பதிவு குறிப்பு எண்')));
            if (!hasCompletedMsg) {
                const headName = sess.citizenProfile.fullNameTam || sess.citizenProfile.fullNameEng || 'விண்ணப்பதாரர்';
                sess.chatHistory.push({
                    sender: 'bot',
                    text: `🎉 **அற்புதம்! புதிய ஸ்மார்ட் ரேஷன் கார்டு விண்ணப்பம் அரசு போர்ட்டலில் வெற்றிகரமாகச் சமர்ப்பிக்கப்பட்டுவிட்டது!** 📑\n\n` +
                          `• 👤 **குடும்பத் தலைவர்:** ${headName}\n` +
                          `• 📄 **அரசு பதிவு எண் (Application Ref No):** 👉 **${draft.applicationNumber}**\n` +
                          `• 📱 **கைபேசி எண்:** +91 ${cleanMobile}\n\n` +
                          `📥 **அதிகாரப்பூர்வ TNPDS விண்ணப்ப படிவம் (Application PDF) தயாராக உள்ளது!**\n\n` +
                          `கீழே உள்ள பொத்தானை அழுத்தி விண்ணப்ப படிவத்தைப் பதிவிறக்கம் செய்து வாடிக்கையாளருக்கு வழங்கலாம்:`,
                    applicationNumber: draft.applicationNumber,
                    applicationPdfUrl: sess.applicationPdfUrl,
                    options: [
                        { label: "📥 விண்ணப்ப PDF பதிவிறக்கு (Download PDF)", value: `DOWNLOAD_PDF_${draft.applicationNumber}` }
                    ]
                });
            }
        } else {
            // If the draft already has an active subService, strictly preserve it!
            if (draft && draft.subService) {
                sess.subService = draft.subService;
                sess.intakeState = draft.intakeState || 'READY_TO_APPLY';
                sess.step = draft.step || 'draft';
                if (sess.citizenProfile) {
                    sess.citizenProfile.subService = draft.subService;
                    sess.citizenProfile.subServiceData = draft.subServiceData || draft.citizenProfile?.subServiceData || null;
                }
                const welcomeObj = getInitialWelcomeMessage(sess.citizenProfile, cleanMobile);
                sess.chatHistory = [welcomeObj];
            } else {
                // Initialize customer session at clean Service Selection with Master Profile loaded
                sess.intakeState = 'SERVICE_SELECTION';
                sess.step = 'SERVICE_SELECTION';
                sess.subService = null;
                if (sess.citizenProfile) {
                    sess.citizenProfile.subService = null;
                    sess.citizenProfile.subServiceData = null;
                }

                const welcomeObj = getInitialWelcomeMessage(sess.citizenProfile, cleanMobile);

                // If there was an unsubmitted previous draft that is ready, offer it as an optional choice without hijacking the intake
                if (draft && (draft.intakeState === 'READY_TO_APPLY' || sess.intakeState === 'READY_TO_APPLY')) {
                    const draftSvcLabel = draft.serviceName || 'முந்தைய விண்ணப்பம்';
                    welcomeObj.options = [
                        { label: `🚀 ${draftSvcLabel} - சமர்ப்பிக்கவும்`, value: "CONFIRM_SUBMIT" },
                        ...welcomeObj.options
                    ];
                }

                sess.chatHistory = [welcomeObj];
            }
        }
    } else {
        sess.citizenProfile = createFreshProfile(cleanMobile);
        sess.subService = null;
        sess.subServiceData = null;
        sess.intakeState = 'SERVICE_SELECTION';
        sess.targetMemberCount = 1;
        sess.currentMemberIdx = 1;
        sess.tempUploads = {};
        sess.tempMember = null;
        sess.chatHistory = [getInitialWelcomeMessage()];
        sess.applicationNumber = null;
        sess.applicationPdfUrl = null;
    }

    persistSessions();

    res.json({
        success: true,
        isLoggedIn: true,
        role: userRole,
        resumedSession: !!(draft && hasDraftData),
        citizenProfile: sess.citizenProfile,
        chatHistory: sess.chatHistory,
        intakeState: sess.intakeState,
        applicationNumber: sess.applicationNumber || null,
        applicationPdfUrl: sess.applicationPdfUrl || null
    });
});

// 4. POST /api/auth/logout
router.post('/api/auth/logout', async (req, res) => {
    try {
        const { stopTnpdsAutomation } = require('../../tnpds_automation');
        await stopTnpdsAutomation();
    } catch (e) {}
    if (typeof clearActiveOperatorSession === 'function') {
        clearActiveOperatorSession();
    }
    const activeMob = getActiveMobile();
    if (activeMob && sessions.has(activeMob)) {
        persistSessions();
    }
    setActiveMobile(null);
    setSessionState(null);
    res.json({ success: true, isLoggedIn: false, message: 'Logged out successfully' });
});

module.exports = router;
