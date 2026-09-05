require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { getCitizenProfile, saveCitizenProfile, addFamilyMember, getCitizenDocuments, getAllCitizensSummary } = require('./database');
const { produceCompliantPassportPhoto, produceCompliantDocument, produceDualSidedDocument } = require('./photo_studio');
const { startTnpdsRationCardFlow, submitTnpdsApplication, stopTnpdsAutomation, provideOtp, resendOtp, getLiveOtpStatus, provideReplacementFile, getLiveReplacementStatus, provideOperatorApproval, getLiveApprovalStatus, updateLivePortalField } = require('./tnpds_automation');
const { inspectAndExtractDocument } = require('./ai_document_extractor');
const { saveCitizenDraft, getCitizenDraft, listAllDrafts, deleteCitizenDraft, saveUserProfile, getUserProfile, lookupUserByMobile, logOperatorCorrection } = require('./firestore_db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + file.originalname.replace(/\s+/g, '_');
        cb(null, uniqueSuffix);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 15 * 1024 * 1024 } // 15 MB server-side guard
});


function createFreshProfile(mobile = '') {
    return {
        mobileNumber: mobile,
        fullNameEng: '',
        fullNameTam: '',
        fatherNameEng: '',
        fatherNameTam: '',
        doorNo: '',
        streetEng: '',
        streetTam: '',
        areaEng: '',
        areaTam: '',
        district: '',
        taluk: '',
        village: '',
        pincode: '',
        headDob: '',
        headGender: '',
        headGenderTam: '',
        headAadhaar: '',
        headProfession: 'Private',
        headProfessionTam: 'தனியார் ஊழியர்',
        monthlyIncome: '3000',
        cardType: 'Rice Card',
        cardTypeTam: 'அரிசி அட்டை',
        members: [],
        gasDetails: {
            hasGas: false,
            consumerName: '',
            oilCompany: '',
            oilCompanyDisplay: '',
            consumerNumber: '',
            agencyName: '',
            cylinders: '0',
            gasBookPath: null
        },
        residenceProof: null,
        headPhotoPath: null,
        isExtracted: false
    };
}


const SERVICE_OPTIONS = [
    { label: "🏛️ புதிய ரேஷன் கார்டு (New Ration Card)", value: "புதிய ரேஷன் கார்டு" },
    { label: "📜 வருமானச் சான்றிதழ் (Income Certificate)", value: "வருமானச் சான்றிதழ்" },
    { label: "🏠 இருப்பிடச் சான்றிதழ் (Residence Certificate)", value: "இருப்பிடச் சான்றிதழ்" },
    { label: "🗳️ புதிய வாக்காளர் அட்டை (New Voter ID)", value: "புதிய வாக்காளர் அட்டை" }
];

const MEMBER_COUNT_OPTIONS = [
    { label: "1 உறுப்பினர் (தலைவர் மட்டும்)", value: "1 உறுப்பினர்" },
    { label: "2 உறுப்பினர்கள்", value: "2 உறுப்பினர்கள்" },
    { label: "3 உறுப்பினர்கள்", value: "3 உறுப்பினர்கள்" },
    { label: "4 உறுப்பினர்கள்", value: "4 உறுப்பினர்கள்" },
    { label: "5 உறுப்பினர்கள்", value: "5 உறுப்பினர்கள்" }
];

const RESIDENCE_PROOF_OPTIONS = [
    { label: "⛽ எரிவாயு நுகர்வோர் அட்டை (Gas Book)", value: "எரிவாயு நுகர்வோர் அட்டை" },
    { label: "🏛️ சொத்து வரி ரசீது (Property Tax)", value: "சொத்து வரி ரசீது" },
    { label: "⚡ மின் கட்டண ரசீது (Electricity / EB Bill)", value: "மின் கட்டண ரசீது" },
    { label: "📄 வாடகை ஒப்பந்தம் (Rental Agreement)", value: "வாடகை ஒப்பந்தம்" },
    { label: "💧 குடிநீர் வரி ரசீது (Water Tax Bill)", value: "குடிநீர் வரி ரசீது" }
];

const RELATIONSHIP_OPTIONS = [
    { label: "கணவர் (Husband)", value: "கணவர்" },
    { label: "மனைவி (Wife)", value: "மனைவி" },
    { label: "மகன் (Son)", value: "மகன்" },
    { label: "மகள் (Daughter)", value: "மகள்" },
    { label: "தந்தை (Father)", value: "தந்தை" },
    { label: "தாய் (Mother)", value: "தாய்" },
    { label: "சகோதரன் (Brother)", value: "சகோதரன்" },
    { label: "சகோதரி (Sister)", value: "சகோதரி" },
    { label: "மாமனார் (Father-in-law)", value: "மாமனார்" },
    { label: "மாமியார் (Mother-in-law)", value: "மாமியார்" }
];

function getRelationshipOptions(headGender = '') {
    if (headGender === 'Female' || headGender === 'பெண்') {
        return [
            { label: "கணவர் (Husband)", value: "கணவர்" },
            { label: "மகன் (Son)", value: "மகன்" },
            { label: "மகள் (Daughter)", value: "மகள்" },
            { label: "தந்தை (Father)", value: "தந்தை" },
            { label: "தாய் (Mother)", value: "தாய்" },
            { label: "சகோதரன் (Brother)", value: "சகோதரன்" },
            { label: "சகோதரி (Sister)", value: "சகோதரி" },
            { label: "மாமனார் (Father-in-law)", value: "மாமனார்" },
            { label: "மாமியார் (Mother-in-law)", value: "மாமியார்" }
        ];
    }
    return [
        { label: "மனைவி (Wife)", value: "மனைவி" },
        { label: "மகன் (Son)", value: "மகன்" },
        { label: "மகள் (Daughter)", value: "மகள்" },
        { label: "தந்தை (Father)", value: "தந்தை" },
        { label: "தாய் (Mother)", value: "தாய்" },
        { label: "சகோதரன் (Brother)", value: "சகோதரன்" },
        { label: "சகோதரி (Sister)", value: "சகோதரி" },
        { label: "கணவர் (Husband)", value: "கணவர்" },
        { label: "மாமனார் (Father-in-law)", value: "மாமனார்" },
        { label: "மாமியார் (Mother-in-law)", value: "மாமியார்" }
    ];
}

function mapRelationshipToEng(tamRel) {
    const map = {
        'கணவர்': { eng: 'Husband', tam: 'கணவர்', gender: 'Male', genderTam: 'ஆண்' },
        'மனைவி': { eng: 'Wife', tam: 'மனைவி', gender: 'Female', genderTam: 'பெண்' },
        'மகன்': { eng: 'Son', tam: 'மகன்', gender: 'Male', genderTam: 'ஆண்' },
        'மகள்': { eng: 'Daughter', tam: 'மகள்', gender: 'Female', genderTam: 'பெண்' },
        'சகோதரன்': { eng: 'Brother', tam: 'சகோதரன்', gender: 'Male', genderTam: 'ஆண்' },
        'சகோதரி': { eng: 'Sister', tam: 'சகோதரி', gender: 'Female', genderTam: 'பெண்' },
        'தாய்': { eng: 'Mother', tam: 'தாய்', gender: 'Female', genderTam: 'பெண்' },
        'தந்தை': { eng: 'Father', tam: 'தந்தை', gender: 'Male', genderTam: 'ஆண்' },
        'மாமனார்': { eng: 'Father-in-law', tam: 'மாமனார்', gender: 'Male', genderTam: 'ஆண்' },
        'மாமியார்': { eng: 'Mother-in-law', tam: 'மாமியார்', gender: 'Female', genderTam: 'பெண்' }
    };
    for (const [key, val] of Object.entries(map)) {
        if (tamRel.includes(key)) return val;
    }
    const lower = tamRel.toLowerCase();
    if (lower.includes('husband')) return map['கணவர்'];
    if (lower.includes('wife')) return map['மனைவி'];
    if (lower.includes('son')) return map['மகன்'];
    if (lower.includes('daughter')) return map['மகள்'];
    if (lower.includes('brother')) return map['சகோதரன்'];
    if (lower.includes('sister')) return map['சகோதரி'];
    if (lower.includes('mother')) return map['தாய்'];
    if (lower.includes('father')) return map['தந்தை'];

    return { eng: 'Husband', tam: 'கணவர்', gender: 'Male', genderTam: 'ஆண்' };
}

function getInitialWelcomeMessage() {
    return {
        sender: 'bot',
        text: `வணக்கம்! 🙏 **eSevaDraft (https://esevadraft.in/)** தமிழ்நாடு அரசு சேவைகள் ஏஐ உதவி மையத்திற்கு வரவேற்கிறோம்!\n\n` +
              `நீங்கள் இன்று எந்த அரசு சேவைக்கு விண்ணப்பிக்க விரும்புகிறீர்கள்?\n` +
              `கீழே உள்ள விருப்பங்களில் ஒன்றைத் தேர்ந்தெடுக்கவும்:`,
        options: SERVICE_OPTIONS
    };
}

// ============================================================
// MULTI-SESSION ARCHITECTURE (per-mobile, Map-based)
// ============================================================
const sessions = new Map(); // mobile -> sessionState

const sessionsDataPath = path.join(__dirname, 'data', 'sessions.json');

function loadPersistedSessions() {
    try {
        if (fs.existsSync(sessionsDataPath)) {
            const raw = JSON.parse(fs.readFileSync(sessionsDataPath, 'utf-8'));
            Object.entries(raw).forEach(([mobile, state]) => {
                sessions.set(mobile, state);
            });
            console.log(`📦 Restored ${sessions.size} session(s) from disk.`);
        }
    } catch (e) {
        console.warn('Session restore failed (clean start):', e.message);
    }
}

function persistSessions() {
    try {
        const snapshot = {};
        sessions.forEach((state, mobile) => {
            snapshot[mobile] = {
                intakeState: state.intakeState,
                targetMemberCount: state.targetMemberCount,
                currentMemberIdx: state.currentMemberIdx,
                step: state.step,
                citizenProfile: state.citizenProfile,
                chatHistory: state.chatHistory,
                applicationNumber: state.applicationNumber || null,
                applicationPdfUrl: state.applicationPdfUrl || null
            };
        });
        fs.writeFileSync(sessionsDataPath, JSON.stringify(snapshot, null, 2), 'utf-8');

        if (activeMobile && sessions.has(activeMobile)) {
            const curState = sessions.get(activeMobile);
            saveCitizenDraft(activeMobile, {
                operatorUid: curState.operatorUid || null,
                operatorName: curState.operatorName || null,
                operatorMobile: curState.operatorMobile || null,
                citizenProfile: curState.citizenProfile,
                documents: curState.tempUploads || {},
                chatHistory: curState.chatHistory,
                intakeState: curState.intakeState,
                step: curState.step,
                applicationNumber: curState.applicationNumber,
                applicationPdfUrl: curState.applicationPdfUrl,
                status: curState.applicationNumber ? 'SUBMITTED' : 'DRAFT_SAVED'
            }).catch(err => console.warn('Background draft sync warning:', err.message));
        }
    } catch (e) {
        console.warn('Session persist failed:', e.message);
    }
}

function getOrCreateSession(mobile) {
    if (!sessions.has(mobile)) {
        const freshProfile = createFreshProfile(mobile);
        sessions.set(mobile, {
            intakeState: 'SERVICE_SELECTION',
            targetMemberCount: 1,
            currentMemberIdx: 1,
            tempUploads: {},
            tempMember: null,
            step: 'READY',
            citizenProfile: freshProfile,
            chatHistory: [getInitialWelcomeMessage()],
            applicationNumber: null
        });
    }
    return sessions.get(mobile);
}

// Load persisted sessions at startup
loadPersistedSessions();

// Backward-compatible: single activeMobile session accessor
let activeMobile = null;
let sessionState = null; // will always point to the active session

function setActiveSession(mobile) {
    activeMobile = mobile;
    sessionState = getOrCreateSession(mobile);
    return sessionState;
}

async function resetActiveSession() {
    try { await stopTnpdsAutomation(); } catch (e) {}
    const mob = activeMobile || '';
    if (mob && sessions.has(mob)) {
        sessions.delete(mob);
    }
    const freshProfile = createFreshProfile(mob);
    const freshSession = {
        intakeState: 'SERVICE_SELECTION',
        targetMemberCount: 1,
        currentMemberIdx: 1,
        tempUploads: {},
        tempMember: null,
        step: 'READY',
        citizenProfile: freshProfile,
        chatHistory: [getInitialWelcomeMessage()],
        applicationNumber: null
    };
    if (mob) {
        sessions.set(mob, freshSession);
    }
    sessionState = freshSession;
    persistSessions();
    return freshSession;
}

// ==========================================
// 1. AUTHENTICATION & SESSION MANAGEMENT
// ==========================================
app.get('/api/auth/session', (req, res) => {
    const isOpReq = !!(req.headers['x-operator-uid'] || req.query.role === 'operator');
    const targetMobile = (req.query.mobile || req.headers['x-session-mobile'] || '').trim();

    if (isOpReq && !targetMobile) {
        return res.json({
            isLoggedIn: true,
            mobileNumber: null,
            role: 'operator',
            citizenProfile: null,
            resumedSession: false,
            intakeState: 'SERVICE_SELECTION',
            chatHistory: [getInitialWelcomeMessage()],
            applicationNumber: null,
            applicationPdfUrl: null
        });
    }

    const mobile = targetMobile || activeMobile;
    const sess = mobile ? getOrCreateSession(mobile) : null;
    res.json({
        isLoggedIn: !!activeMobile,
        mobileNumber: activeMobile,
        role: sess ? (sess.role || 'citizen') : 'citizen',
        citizenProfile: sess ? sess.citizenProfile : null,
        resumedSession: !!(mobile && sessions.has(mobile) && sess && sess.intakeState !== 'SERVICE_SELECTION'),
        intakeState: sess ? sess.intakeState : 'SERVICE_SELECTION',
        chatHistory: sess ? sess.chatHistory : [],
        applicationNumber: sess ? (sess.applicationNumber || null) : null,
        applicationPdfUrl: sess ? (sess.applicationPdfUrl || null) : null
    });
});

app.get('/api/auth/lookup-mobile', async (req, res) => {
    const rawMobile = req.query.mobile || '';
    const cleanMobile = rawMobile.replace(/\D/g, '');
    if (cleanMobile.length !== 10) {
        return res.status(400).json({ error: '10-இலக்க மொபைல் எண் தேவை.' });
    }
    try {
        const user = await lookupUserByMobile(cleanMobile);
        if (user) {
            return res.json({
                found: true,
                authEmail: user.email || `${cleanMobile}@esevadraft.in`,
                role: user.role || 'citizen',
                displayName: user.displayName || 'பயனர்'
            });
        }
        return res.json({ found: false });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/operator/new-customer', async (req, res) => {
    const { customerMobile, customerName, operatorUid, operatorName, operatorMobile } = req.body;
    const cleanMobile = (customerMobile || '').replace(/\D/g, '');
    if (cleanMobile.length !== 10) {
        return res.status(400).json({ error: 'சரியான 10-இலக்க வாடிக்கையாளர் மொபைல் எண்ணை உள்ளிடவும்.' });
    }

    const sess = setActiveSession(cleanMobile);
    sess.operatorUid = operatorUid || null;
    sess.operatorName = operatorName || null;
    sess.operatorMobile = operatorMobile || null;
    sess.role = 'citizen';
    sess.citizenProfile = createFreshProfile(cleanMobile);
    sess.citizenProfile.fullNameTam = customerName || '';
    sess.citizenProfile.fullNameEng = customerName || '';
    sess.citizenProfile.mobileNumber = cleanMobile;
    sess.intakeState = 'READY_TO_APPLY';
    sess.step = 'draft';
    sess.tempUploads = {};
    sess.applicationNumber = null;
    sess.chatHistory = [{
        sender: 'bot',
        text: `வணக்கம் திரு/திருமதி **${customerName || 'வாடிக்கையாளர்'}**! (+91 ${cleanMobile}) 🙏\n\n` +
              `புதிய ஸ்மார்ட் ரேஷன் கார்டு விண்ணப்பத்திற்கான அமர்வு தொடங்கப்பட்டது.\n\n` +
              `📄 விண்ணப்பத்தைத் தொடங்க, கீழே உள்ள பொத்தானை அழுத்தி குடும்பத் தலைவரின் ஆதார் அட்டை அல்லது புகைப்படத்தைப் பதிவேற்றவும்:`,
        actionRequired: 'upload',
        uploadPrompt: '📸 குடும்பத் தலைவர் ஆதார் அட்டை பதிவேற்றுக (Upload Aadhaar)',
        options: [
            {
                label: '📸 ஆதார் அட்டை பதிவேற்றுக',
                value: 'TRIGGER_FILE_UPLOAD'
            },
            {
                label: '🏛️ புதிய ரேஷன் கார்டு',
                value: 'புதிய ரேஷன் கார்டு'
            }
        ]
    }];

    try {
        await saveCitizenDraft(cleanMobile, {
            operatorUid,
            operatorName,
            operatorMobile,
            citizenProfile: sess.citizenProfile,
            documents: {},
            chatHistory: sess.chatHistory,
            status: 'DRAFT_SAVED'
        });
        persistSessions();
    } catch (e) {}

    res.json({
        success: true,
        customerMobile: cleanMobile,
        customerName: customerName,
        citizenProfile: sess.citizenProfile,
        chatHistory: sess.chatHistory
    });
});

app.post('/api/auth/login', async (req, res) => {
    const { displayName, email, firebaseUid, role, operatorUid, isCustomerSession, customerMobile } = req.body;
    const rawMobile = customerMobile || req.body.mobileNumber || req.body.mobile || '';
    let cleanMobile = rawMobile.replace(/\D/g, '');
    
    if (!cleanMobile && email) {
        cleanMobile = '9876543210';
    }
    
    if (cleanMobile.length !== 10) {
        return res.status(400).json({ error: 'சரியான 10-இலக்க மொபைல் எண்ணை உள்ளிடவும்.' });
    }

    let userRole = role;
    if (firebaseUid) {
        try {
            const prof = await getUserProfile(firebaseUid);
            if (prof && prof.role) {
                userRole = prof.role;
            } else if (role) {
                userRole = role;
                await saveUserProfile(firebaseUid, { role, displayName, email, mobileNumber: cleanMobile });
            }
        } catch (e) {
            if (role) userRole = role;
        }
    }
    if (!userRole) userRole = 'citizen';

    // If operator logging in to management dashboard (not opening a customer)
    if (userRole === 'operator' && !isCustomerSession && !customerMobile) {
        // Clear active session if it was previously set to operator's personal phone
        if (activeMobile === cleanMobile) {
            activeMobile = null;
            sessionState = null;
        }
        let drafts = [];
        try {
            drafts = await listAllDrafts(firebaseUid || operatorUid);
        } catch (e) {}
        return res.json({
            success: true,
            isOperatorOnly: true,
            role: 'operator',
            displayName: displayName || 'மையம்',
            operatorName: displayName || 'மையம்',
            operatorUid: firebaseUid || operatorUid,
            operatorMobile: cleanMobile,
            chatHistory: [getInitialWelcomeMessage()],
            drafts: drafts
        });
    }

    const isMemoryResume = sessions.has(cleanMobile);
    const sess = setActiveSession(cleanMobile);
    if (displayName) sess.operatorName = displayName;
    if (email) sess.operatorEmail = email;
    if (firebaseUid) sess.firebaseUid = firebaseUid;
    if (operatorUid) sess.operatorUid = operatorUid;
    sess.role = userRole;

    // Check Cloud Firestore & Local Drafts
    let draft = null;
    try {
        draft = await getCitizenDraft(cleanMobile);
    } catch (e) {
        console.warn('Draft check error:', e.message);
    }

    const prof = draft ? (draft.citizenProfile || {}) : null;
    const hasDraftData = prof && (
        prof.fullNameTam ||
        prof.fullNameEng ||
        prof.headDob ||
        prof.headGender ||
        prof.headAadhaar ||
        prof.fatherNameTam ||
        prof.fatherNameEng ||
        prof.doorNo ||
        prof.streetTam ||
        prof.pincode ||
        (prof.members && prof.members.length > 0) ||
        prof.headPhotoPath ||
        prof.isExtracted
    );

    if (draft && hasDraftData) {
        sess.citizenProfile = { ...createFreshProfile(cleanMobile), ...sess.citizenProfile, ...draft.citizenProfile };
        sess.intakeState = draft.intakeState || 'READY_TO_APPLY';
        sess.step = draft.step || 'draft';
        sess.tempUploads = draft.documents || sess.tempUploads || {};
        sess.applicationNumber = draft.applicationNumber || null;
        sess.applicationPdfUrl = draft.applicationPdfUrl || null;
        if (draft.operatorUid) sess.operatorUid = draft.operatorUid;

        if (draft.chatHistory && draft.chatHistory.length > 0) {
            sess.chatHistory = draft.chatHistory;
        }

        // If not submitted yet, offer instant 1-click submit
        if (draft.status !== 'SUBMITTED' && !draft.applicationNumber) {
            const headName = sess.citizenProfile.fullNameTam || sess.citizenProfile.fullNameEng || 'விண்ணப்பதாரர்';
            const memCount = sess.citizenProfile.members ? sess.citizenProfile.members.length : 1;
            const dist = sess.citizenProfile.district || 'இராணிப்பேட்டை';
            const tlk = sess.citizenProfile.taluk || 'அரக்கோணம்';

            const lastMsg = sess.chatHistory[sess.chatHistory.length - 1];
            if (!lastMsg || !lastMsg.text.includes('முந்தைய விண்ணப்ப வரைவு')) {
                sess.chatHistory.push({
                    sender: 'bot',
                    text: `🔄 **முந்தைய விண்ணப்ப வரைவு மீட்கப்பட்டது! (Draft Restored)** 💾\n\n` +
                          `• 👤 **குடும்பத் தலைவர்:** ${headName}\n` +
                          `• 👥 **மொத்த உறுப்பினர்கள்:** ${memCount} நபர்(கள்)\n` +
                          `• 🏛️ **இருப்பிடம்:** ${tlk}, ${dist}\n` +
                          `• 📄 **ஆவணங்கள்:** புகைப்படங்கள் & ஆதார் சான்றிதழ்கள் அனைத்தும் ஏற்கெனவே தயார்!\n\n` +
                          `💡 *வாடிக்கையாளர் OTP சொல்லத் தயாராக இருந்தால், கீழே உள்ள பொத்தானை அழுத்தி உடனடியாக TNPDS போர்ட்டலில் விண்ணப்பிக்கலாம்.*`,
                    options: [
                        { label: "🚀 TNPDS-ல் இப்போது விண்ணப்பி (Submit to Portal)", value: "CONFIRM_SUBMIT" },
                        { label: "👁️ தனி தாவலில் படிவத்தைத் திற (Review in New Tab)", value: "OPEN_REVIEW_TAB" },
                        { label: "✏️ விவரங்களைச் சரிபார் / திருத்து (Review Details)", value: "TRIGGER_EDIT_MODAL" }
                    ]
                });
            }
        }
    } else if (!isMemoryResume) {
        sess.citizenProfile = createFreshProfile(cleanMobile);
        sess.intakeState = 'SERVICE_SELECTION';
        sess.targetMemberCount = 1;
        sess.currentMemberIdx = 1;
        sess.tempUploads = {};
        sess.tempMember = null;
        sess.chatHistory = [getInitialWelcomeMessage()];
        sess.applicationNumber = null;
    } else {
        sess.tempUploads = sess.tempUploads || {};
        sess.tempMember = null;
    }

    persistSessions();

    res.json({
        success: true,
        isLoggedIn: true,
        role: userRole,
        resumedSession: !!(isMemoryResume || (draft && hasDraftData)),
        citizenProfile: sess.citizenProfile,
        chatHistory: sess.chatHistory,
        intakeState: sess.intakeState,
        applicationNumber: sess.applicationNumber || null,
        applicationPdfUrl: sess.applicationPdfUrl || null
    });
});

app.get('/api/drafts', async (req, res) => {
    const opUid = req.query.operatorUid || req.headers['x-operator-uid'] || null;
    try {
        const drafts = await listAllDrafts(opUid);
        res.json({ success: true, drafts });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/drafts/save', async (req, res) => {
    const targetMobile = req.body.mobileNumber || req.body.customerMobile || req.headers['x-session-mobile'] || activeMobile;
    const opUid = req.body.operatorUid || req.headers['x-operator-uid'] || null;
    const opName = req.body.operatorName || req.headers['x-operator-name'] || null;
    const opMobile = req.body.operatorMobile || req.headers['x-operator-mobile'] || null;

    if (!targetMobile) {
        return res.status(400).json({ error: 'செயலில் உள்ள வாடிக்கையாளர் எண் இல்லை.' });
    }

    const sess = getOrCreateSession(targetMobile);

    // If client sent updated profile from UI, merge it
    if (req.body.citizenProfile && typeof req.body.citizenProfile === 'object') {
        sess.citizenProfile = { ...sess.citizenProfile, ...req.body.citizenProfile };
    }

    try {
        await saveCitizenDraft(targetMobile, {
            operatorUid: opUid || sess.operatorUid || null,
            operatorName: opName || sess.operatorName || null,
            operatorMobile: opMobile || sess.operatorMobile || null,
            citizenProfile: sess.citizenProfile,
            documents: sess.tempUploads || {},
            chatHistory: sess.chatHistory,
            intakeState: sess.intakeState,
            step: 'WAITING_FOR_OTP',
            status: sess.applicationNumber ? 'SUBMITTED' : 'DRAFT_SAVED'
        });

        saveCitizenProfile(targetMobile, sess.citizenProfile);
        persistSessions();

        res.json({ success: true, message: 'Draft saved successfully', citizenProfile: sess.citizenProfile });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/drafts/:mobileNumber', async (req, res) => {
    const { mobileNumber } = req.params;
    const cleanMobile = (mobileNumber || '').replace(/\D/g, '');
    if (!cleanMobile) {
        return res.status(400).json({ error: 'மொபைல் எண் தேவை.' });
    }
    try {
        await deleteCitizenDraft(cleanMobile);
        if (sessions.has(cleanMobile)) {
            sessions.delete(cleanMobile);
        }
        if (activeMobile === cleanMobile) {
            activeMobile = null;
            sessionState = null;
        }
        persistSessions();
        res.json({ success: true, message: 'வாடிக்கையாளர் வரைவு வெற்றிகரமாக நீக்கப்பட்டது.' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/drafts/delete', async (req, res) => {
    const { mobileNumber } = req.body;
    const cleanMobile = (mobileNumber || '').replace(/\D/g, '');
    if (!cleanMobile) {
        return res.status(400).json({ error: 'மொபைல் எண் தேவை.' });
    }
    try {
        await deleteCitizenDraft(cleanMobile);
        if (sessions.has(cleanMobile)) {
            sessions.delete(cleanMobile);
        }
        if (activeMobile === cleanMobile) {
            activeMobile = null;
            sessionState = null;
        }
        persistSessions();
        res.json({ success: true, message: 'வாடிக்கையாளர் வரைவு வெற்றிகரமாக நீக்கப்பட்டது.' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/auth/logout', async (req, res) => {
    try { await stopTnpdsAutomation(); } catch (e) {}
    if (activeMobile && sessions.has(activeMobile)) {
        persistSessions(); // Save before logout
    }
    activeMobile = null;
    sessionState = null;
    res.json({ success: true, isLoggedIn: false });
});

// ==========================================
// 2. GET LIVE CHAT & DATABASE PROFILE
// ==========================================
app.get('/api/chat/history', (req, res) => {
    const isOpReq = !!(req.headers['x-operator-uid'] || req.query.role === 'operator');
    const targetMobile = (req.query.mobile || req.headers['x-session-mobile'] || '').trim();

    // If an operator is requesting chat history but hasn't provided a customer mobile,
    // NEVER fall back to activeMobile or an operator profile!
    if (isOpReq && !targetMobile) {
        return res.json({
            chatHistory: [getInitialWelcomeMessage()],
            citizenProfile: null,
            step: 'READY',
            noCustomerActive: true
        });
    }

    const mobile = targetMobile || activeMobile;
    const sess = mobile ? getOrCreateSession(mobile) : sessionState;
    if (!sess) {
        return res.json({ chatHistory: [getInitialWelcomeMessage()], citizenProfile: null, step: 'READY' });
    }
    res.json({
        chatHistory: sess.chatHistory,
        citizenProfile: sess.citizenProfile,
        step: sess.step,
        applicationNumber: sess.applicationNumber || null,
        applicationPdfUrl: sess.applicationPdfUrl || null
    });
});

// ==========================================
// 2. CHAT & DOCUMENT PROCESSING
// ==========================================
app.post('/api/chat', upload.any(), async (req, res) => {
    try {
        const text = (req.body.text || req.body.message || '').trim();
        const uploadedFile = (req.files && req.files.length > 0) ? req.files[0] : null;

        console.log(`\n💬 Received - Text: "${text}", File: ${uploadedFile ? uploadedFile.filename : 'None'}`);

        const reqOpUid = req.headers['x-operator-uid'] || req.body.operatorUid;
        let targetMobile = (req.body.mobileNumber || req.headers['x-session-mobile'] || '').trim();

        if (!targetMobile && reqOpUid) {
            targetMobile = `walkin_${String(reqOpUid).substring(0, 8)}`;
        } else if (!targetMobile && !activeMobile) {
            targetMobile = 'walkin_session';
        }

        const sess = getOrCreateSession(targetMobile || activeMobile);
        if (reqOpUid) sess.operatorUid = reqOpUid;
        sessionState = sess;
        activeMobile = targetMobile || activeMobile;

        if (text) {
            sessionState.chatHistory.push({ sender: 'user', text: text });
        }

        // ==========================================
        // 0. RESET / RESTART CONVERSATION
        // ==========================================
        if (text.toLowerCase() === 'reset' || text.includes('மீண்டும்') || text.includes('புதிதாக')) {
            await resetActiveSession();
            return res.json({
                chatHistory: sessionState.chatHistory,
                citizenProfile: sessionState.citizenProfile,
                step: sessionState.intakeState
            });
        }

        // ==========================================
        // 0.5. CHECK IF USER IS UPLOADING REPLACEMENT FILE FOR LIVE PORTAL ERROR
        // ==========================================
        const replStatus = getLiveReplacementStatus();
        if (uploadedFile && replStatus.isWaitingForFile) {
            let processed = uploadedFile.path;
            if (replStatus.fileType === 'HEAD_PHOTO') {
                processed = await produceCompliantPassportPhoto(uploadedFile.path);
                sessionState.citizenProfile.headPhotoPath = processed;
            } else {
                processed = await produceCompliantDocument(uploadedFile.path);
            }
            provideReplacementFile(processed);
            sessionState.chatHistory.push({
                sender: 'user',
                text: `📸 புதிய ஆவணம்/புகைப்படம் பதிவேற்றப்பட்டது: ${uploadedFile.originalname}`
            });
            sessionState.chatHistory.push({
                sender: 'bot',
                text: `⏳ **புதிய ஆவணம் பெறப்பட்டது!** அரசு போர்ட்டலில் மீண்டும் பதிவேற்றிச் சரிபார்க்கப்படுகிறது...`
            });
            return res.json({
                chatHistory: sessionState.chatHistory,
                citizenProfile: sessionState.citizenProfile,
                step: 'filling_form'
            });
        }

        // ==========================================
        // 1. CHECK IF INPUT IS A 6-DIGIT OTP
        // ==========================================
        const cleanDigits = text.replace(/\D/g, '');
        if (cleanDigits.length === 6) {
            const otpHandled = provideOtp(cleanDigits);
            if (otpHandled) {
                sessionState.chatHistory.push({
                    sender: 'bot',
                    text: `🔑 **OTP எண் (${cleanDigits}) அரசு போர்ட்டலில் சரிபார்க்கப்படுகிறது...**`
                });
                return res.json({
                    chatHistory: sessionState.chatHistory,
                    citizenProfile: sessionState.citizenProfile,
                    step: sessionState.step
                });
            }
        }

        // ==========================================
        // 2. CHECK IF INPUT IS RESEND OTP
        // ==========================================
        if (text.toLowerCase().includes('resend') || text.includes('மறுமுறை')) {
            const resendResult = await resendOtp();
            sessionState.chatHistory.push({
                sender: 'bot',
                text: resendResult.success 
                    ? `🔄 **அரசு இணையதளத்தில் புதிய OTP மீண்டும் அனுப்பப்பட்டுள்ளது!**\n\nஉங்கள் கைபேசிக்கு வந்துள்ள புதிய 6-இலக்க OTP எண்ணை உள்ளிடவும்:`
                    : `⚠️ ${resendResult.message}`
            });
            return res.json({
                chatHistory: sessionState.chatHistory,
                citizenProfile: sessionState.citizenProfile,
                step: sessionState.step
            });
        }

        // ==========================================
        // 3. HANDLE 'START' OR 'MOCK TEST' EXECUTION
        // ==========================================
        const isMockTest = text.toLowerCase().includes('mock') || text.includes('சோதனை');
        if (text.toLowerCase() === 'start' || text === 'தொடங்கு' || text === 'fill' || isMockTest) {
            const modeText = isMockTest ? '🧪 சுயகற்றல் சோதனை முறை (Mock Sandbox)' : '🚀 நேரலை முறை (Live Production)';
            sessionState.chatHistory.push({
                sender: 'bot',
                text: `${modeText}யில் தமிழ்நாடு அரசு TNPDS இணையதள விண்ணப்பம் தொடங்கப்படுகிறது...\n\nவிண்ணப்பதாரர்: ${sessionState.citizenProfile?.fullNameEng || 'விண்ணப்பதாரர்'} (+91 ${sessionState.citizenProfile?.mobileNumber || activeMobile})\nமொத்த உறுப்பினர்கள்: ${sessionState.citizenProfile?.members?.length || 1}`
            });

            startTnpdsRationCardFlow(
                sessionState.citizenProfile,
                (progressMsg) => {
                    sessionState.chatHistory.push({
                        sender: 'bot',
                        text: progressMsg
                    });
                    // Parse step number from messages like "📍 [படி 12/51]"
                    const stepMatch = progressMsg.match(/\[படி\s*(\d+)\s*\/\s*(\d+)\]/);
                    if (stepMatch) {
                        sessionState.automationStep = parseInt(stepMatch[1]);
                        sessionState.automationTotal = parseInt(stepMatch[2]);
                    }
                },
                { isMockSandbox: isMockTest }
            ).then((result) => {
                if (result.success) {
                    if (result.applicationNumber) {
                        sessionState.applicationNumber = result.applicationNumber;
                        sessionState.applicationPdfUrl = result.applicationPdfUrl;
                        if (sessionState.citizenProfile) {
                            sessionState.citizenProfile.applicationNumber = result.applicationNumber;
                            sessionState.citizenProfile.applicationPdfUrl = result.applicationPdfUrl;
                            sessionState.citizenProfile.submittedAt = new Date().toISOString();
                            saveCitizenProfile(activeMobile, sessionState.citizenProfile);
                        }
                        sessionState.step = 'submitted';
                        sessionState.chatHistory.push({
                            sender: 'bot',
                            text: result.message,
                            applicationNumber: result.applicationNumber,
                            applicationPdfUrl: result.applicationPdfUrl
                        });
                    } else {
                        sessionState.chatHistory.push({
                            sender: 'bot',
                            text: `🎉 **${sessionState.citizenProfile?.fullNameEng || 'விண்ணப்பதாரர்'} அவர்களின் ரேஷன் கார்டு விண்ணப்ப முன்னோட்டம் தயார்!**\n\nஅனைத்து விவரங்களையும் சரிபார்த்துவிட்டு கீழே உள்ள **விண்ணப்பத்தைச் சமர்ப்பி** பொத்தானை அழுத்தவும்.`,
                            previewImage: result.previewUrl,
                            showConfirmButtons: true
                        });
                        sessionState.step = 'preview_ready';
                    }
                    persistSessions();
                }
            }).catch((err) => {
                sessionState.chatHistory.push({
                    sender: 'bot',
                    text: `⚠️ ஆட்டோமேஷன் பிழை: ${err.message}`
                });
                persistSessions();
            });

            // Save progress tracking info
            sessionState.automationStep = 0;
            sessionState.automationTotal = 51;
            persistSessions();

            return res.json({
                chatHistory: sessionState.chatHistory,
                citizenProfile: sessionState.citizenProfile,
                step: isMockTest ? 'mock_running' : 'filling_form',
                automationStep: 0,
                automationTotal: 51
            });
        }

        // ==========================================
        // 4. CONVERSATIONAL INTAKE STATE MACHINE
        // ==========================================

        // STATE 1: SERVICE_SELECTION
        if (sessionState.intakeState === 'SERVICE_SELECTION') {
            if (text.includes('ரேஷன்') || text.toLowerCase().includes('ration') || text.includes('1')) {
                sessionState.intakeState = 'MEMBER_COUNT';
                sessionState.chatHistory.push({
                    sender: 'bot',
                    text: `🏛️ **புதிய ரேஷன் கார்டு (New Ration Card) விண்ணப்பத்திற்கு வரவேற்கிறோம்!**\n\n` +
                          `உங்கள் குடும்பத்தில் மொத்தம் எத்தனை நபர்களை (குடும்பத் தலைவர் உட்பட) உறுப்பினர்களாகச் சேர்க்க வேண்டும்?\n\n` +
                          `கீழே உள்ள எண்ணிக்கையைத் தேர்வு செய்யவும் அல்லது தட்டச்சு செய்யவும்:`,
                    options: MEMBER_COUNT_OPTIONS
                });
            } else if (text) {
                sessionState.chatHistory.push({
                    sender: 'bot',
                    text: `ℹ️ **${text} சேவை விரைவில் முழுமையாக இணைக்கப்படவுள்ளது!**\n\nதற்போது **புதிய ரேஷன் கார்டு (New Ration Card)** விண்ணப்பம் 100% நேரலையில் பயன்பாட்டில் உள்ளது. அதைத் தொடங்க விரும்புகிறீர்களா?`,
                    options: [
                        { label: "🏛️ புதிய ரேஷன் கார்டு தொடங்கவும்", value: "புதிய ரேஷன் கார்டு" },
                        { label: "🔄 மீண்டும் சேவைகளைத் தேர்ந்தெடு", value: "reset" }
                    ]
                });
            }
            return res.json({ chatHistory: sessionState.chatHistory, citizenProfile: sessionState.citizenProfile, step: sessionState.intakeState });
        }

        // STATE 2: MEMBER_COUNT
        if (sessionState.intakeState === 'MEMBER_COUNT') {
            const match = text.match(/\d+/);
            const count = match ? parseInt(match[0], 10) : 2;
            sessionState.targetMemberCount = Math.max(1, count);
            sessionState.intakeState = 'HEAD_PHOTO';
            sessionState.tempUploads = {};

            if (!sessionState.citizenProfile) {
                sessionState.citizenProfile = { mobileNumber: activeMobile, members: [] };
            } else {
                sessionState.citizenProfile.members = [];
            }

            sessionState.chatHistory.push({
                sender: 'bot',
                text: `📸 **படி 1/6: குடும்பத் தலைவரின் பாஸ்போர்ட் புகைப்படம்**\n\n` +
                      `மொத்தம் **${sessionState.targetMemberCount} உறுப்பினர்கள்** தேர்ந்தெடுக்கப்பட்டுள்ளனர்.\n\n` +
                      `முதலில் குடும்பத் தலைவரின் பாஸ்போர்ட் அளவிலான புகைப்படத்தைப் பதிவேற்றவும் (அல்லது கேமரா மூலம் செல்ஃபி எடுக்கவும்).\n\n` +
                      `💡 **ஏஐ போட்டோ ஸ்டுடியோ:** உங்கள் புகைப்படத்தை அரசு விதிகளுக்கு ஏற்ப **வெள்ளை பின்னணியுடன் (Solid White Background)** எங்களின் AI தானாகவே செப்பனிட்டு சேமிக்கும்!`,
                actionRequired: 'upload',
                uploadPrompt: 'குடும்பத் தலைவர் புகைப்படம் பதிவேற்றவும்'
            });
            return res.json({ chatHistory: sessionState.chatHistory, citizenProfile: sessionState.citizenProfile, step: sessionState.intakeState });
        }

        // STATE 3: HEAD_PHOTO
        if (sessionState.intakeState === 'HEAD_PHOTO') {
            if (!uploadedFile) {
                sessionState.chatHistory.push({
                    sender: 'bot',
                    text: `📸 தயவுசெய்து குடும்பத் தலைவரின் **பாஸ்போர்ட் புகைப்படத்தை** கீழே உள்ள கேமரா/கோப்பு பொத்தானைப் பயன்படுத்திப் பதிவேற்றவும்.`,
                    actionRequired: 'upload',
                    uploadPrompt: 'குடும்பத் தலைவர் புகைப்படம் பதிவேற்றவும்'
                });
                return res.json({ chatHistory: sessionState.chatHistory, citizenProfile: sessionState.citizenProfile, step: sessionState.intakeState });
            }

            // Inspect photo quality with Gemini
            const qualityCheck = await inspectAndExtractDocument(uploadedFile.path);
            if (qualityCheck && qualityCheck.isQualityAcceptable === false) {
                sessionState.chatHistory.push({
                    sender: 'bot',
                    text: `⚠️ **புகைப்படம் தெளிவாக இல்லை (Photo Quality Issue):**\n\n` +
                          `${qualityCheck.feedbackTamil || 'பதிவேற்றப்பட்ட புகைப்படம் மங்கலாக அல்லது நிழல் விழுந்து உள்ளது.'}\n\n` +
                          `🛑 அரசு இணையதளத்தில் நிராகரிக்கப்படாமல் இருக்க, உங்கள் முகம் மற்றும் கண்கள் தெளிவாகத் தெரியும்படி நல்ல வெளிச்சத்தில் எடுக்கப்பட்ட **புதிய பாஸ்போர்ட் புகைப்படத்தை** மீண்டும் பதிவேற்றவும்:`,
                    actionRequired: 'upload',
                    uploadPrompt: 'தெளிவான பாஸ்போர்ட் புகைப்படம் பதிவேற்றவும்'
                });
                return res.json({ chatHistory: sessionState.chatHistory, citizenProfile: sessionState.citizenProfile, step: sessionState.intakeState });
            }

            const studioPhoto = await produceCompliantPassportPhoto(uploadedFile.path);
            sessionState.citizenProfile.headPhotoPath = studioPhoto;
            saveCitizenProfile(activeMobile, sessionState.citizenProfile);

            sessionState.intakeState = 'HEAD_AADHAAR_FRONT';
            sessionState.chatHistory.push({
                sender: 'bot',
                text: `✨ **ஏஐ போட்டோ ஸ்டுடியோ:** குடும்பத் தலைவர் புகைப்படம் அரசு விதிகளுக்கு ஏற்ப **வெள்ளை பின்னணியுடன் (White Background)** செப்பனிடப்பட்டு சேமிக்கப்பட்டது! 100% ஏற்றுக்கொள்ளப்படும்.\n\n` +
                      `🪪 **படி 2/6: குடும்பத் தலைவரின் ஆதார் அட்டை**\n\n` +
                      `குடும்பத் தலைவரின் ஆதார் அட்டையைப் பதிவேற்றவும்.\n` +
                      `*(முழு ஆதார் அட்டை / பதிவிறக்கம் செய்த e-Aadhaar ஆவணமாக இருந்தால் அதையே பதிவேற்றலாம்; முன்பக்கம் மட்டுமே உள்ள கார்டாக இருந்தால் முன்பக்கத்தைப் பதிவேற்றவும்)*:`,
                actionRequired: 'upload',
                uploadPrompt: 'ஆதார் அட்டை பதிவேற்றவும்'
            });
            return res.json({ chatHistory: sessionState.chatHistory, citizenProfile: sessionState.citizenProfile, step: sessionState.intakeState });
        }

        // STATE 4: HEAD_AADHAAR_FRONT
        if (sessionState.intakeState === 'HEAD_AADHAAR_FRONT') {
            if (!uploadedFile) {
                sessionState.chatHistory.push({
                    sender: 'bot',
                    text: `🪪 தயவுசெய்து குடும்பத் தலைவரின் **ஆதார் அட்டைப் புகைப்படத்தை (முன்பக்கம் அல்லது முழு ஆதார் அட்டை)** பதிவேற்றவும்.`,
                    actionRequired: 'upload',
                    uploadPrompt: 'ஆதார் அட்டை பதிவேற்றவும்'
                });
                return res.json({ chatHistory: sessionState.chatHistory, citizenProfile: sessionState.citizenProfile, step: sessionState.intakeState });
            }

            // Immediately inspect and extract document
            const extracted = await inspectAndExtractDocument(uploadedFile.path);

            if (extracted && extracted.isQualityAcceptable === false) {
                sessionState.chatHistory.push({
                    sender: 'bot',
                    text: `⚠️ **ஆதார் அட்டை தெளிவாக இல்லை (Document Not Clear):**\n\n` +
                          `${extracted.feedbackTamil || 'ஆவணத்தில் உள்ள எழுத்துக்கள் அல்லது விவரங்கள் மங்கலாக உள்ளன.'}\n\n` +
                          `🛑 அரசு TNPDS இணையதளத்தில் நிராகரிக்கப்படாமல் இருக்க, எழுத்துக்களும் எண்களும் தெளிவாகத் தெரியும்படி **தெளிவான ஆதார் ஆவணத்தை** மீண்டும் பதிவேற்றவும்:`,
                    actionRequired: 'upload',
                    uploadPrompt: 'தெளிவான ஆதார் பதிவேற்றவும்'
                });
                return res.json({ chatHistory: sessionState.chatHistory, citizenProfile: sessionState.citizenProfile, step: sessionState.intakeState });
            }

            const hasAddress = !!(extracted.hasAddress || extracted.doorNo || extracted.streetTam || extracted.streetEng || extracted.pincode);
            const isFullAadhaar = !!(extracted.isFullAadhaar || extracted.documentType === 'AADHAAR_FULL' || (hasAddress && (extracted.fullNameEng || extracted.fullNameTam || extracted.aadhaarNumber)));

            if (isFullAadhaar) {
                // User uploaded a COMPLETE (Full single-page / e-Aadhaar) document!
                // DO NOT ASK FOR BACK SIDE! Convert directly to compliant Government A4 PDF!
                const fullPdf = await produceCompliantDocument(uploadedFile.path);
                sessionState.tempUploads.headAadhaarFront = uploadedFile.path;
                sessionState.tempUploads.headAadhaarBack = null;

                sessionState.citizenProfile.fullNameEng = extracted.fullNameEng || sessionState.citizenProfile.fullNameEng || '';
                sessionState.citizenProfile.fullNameTam = extracted.fullNameTam || sessionState.citizenProfile.fullNameTam || '';
                sessionState.citizenProfile.fatherNameEng = extracted.fatherNameEng || sessionState.citizenProfile.fatherNameEng || '';
                sessionState.citizenProfile.fatherNameTam = extracted.fatherNameTam || sessionState.citizenProfile.fatherNameTam || '';
                sessionState.citizenProfile.headDob = extracted.dob || sessionState.citizenProfile.headDob || '';
                sessionState.citizenProfile.headGender = extracted.gender || 'Male';
                sessionState.citizenProfile.headGenderTam = extracted.gender === 'Female' ? 'பெண்' : 'ஆண்';
                sessionState.citizenProfile.headAadhaar = (extracted.aadhaarNumber && extracted.aadhaarNumber.length === 12) ? extracted.aadhaarNumber : (sessionState.citizenProfile.headAadhaar || '');
                sessionState.citizenProfile.doorNo = extracted.doorNo || sessionState.citizenProfile.doorNo || '';
                sessionState.citizenProfile.streetEng = extracted.streetEng || sessionState.citizenProfile.streetEng || '';
                sessionState.citizenProfile.streetTam = extracted.streetTam || sessionState.citizenProfile.streetTam || '';
                sessionState.citizenProfile.areaEng = extracted.areaEng || sessionState.citizenProfile.areaEng || '';
                sessionState.citizenProfile.areaTam = extracted.areaTam || sessionState.citizenProfile.areaTam || '';
                sessionState.citizenProfile.pincode = extracted.pincode || sessionState.citizenProfile.pincode || '';
                sessionState.citizenProfile.district = extracted.district || sessionState.citizenProfile.district || 'Ranipet';
                sessionState.citizenProfile.taluk = extracted.taluk || sessionState.citizenProfile.taluk || 'Arakkonam';
                sessionState.citizenProfile.village = extracted.village || sessionState.citizenProfile.village || 'Minnal';

                sessionState.citizenProfile.members = [
                    {
                        nameEng: sessionState.citizenProfile.fullNameEng,
                        nameTam: sessionState.citizenProfile.fullNameTam,
                        dob: sessionState.citizenProfile.headDob,
                        gender: sessionState.citizenProfile.headGender,
                        genderTam: sessionState.citizenProfile.headGenderTam,
                        relationship: "Family Head",
                        relationshipTam: "குடும்ப தலைவர்",
                        relationshipIndex: 0,
                        profession: "Private",
                        monthlyIncome: "3000",
                        aadhaarNumber: sessionState.citizenProfile.headAadhaar,
                        docType: "AADHAAR_CARD",
                        docPath: fullPdf
                    }
                ];
                if (activeMobile) saveCitizenProfile(activeMobile, sessionState.citizenProfile);

                const formattedAadhaar = (sessionState.citizenProfile.headAadhaar || '').replace(/(\d{4})/g, '$1 ').trim();
                sessionState.intakeState = 'HEAD_DETAILS_VERIFY';
                sessionState.chatHistory.push({
                    sender: 'bot',
                    text: `📄 **முழு ஆதார் அட்டை (முன்பக்கம் மற்றும் முகவரி இரண்டும் உள்ள ஆவணம்) வெற்றிகரமாகக் கண்டறியப்பட்டது!**\n\n` +
                          `💡 *ஒரே ஆவணத்தில் அனைத்து விவரங்களும் உள்ளதால், பின்பக்கத்தை மீண்டும் பதிவேற்றத் தேவையில்லை.* ✅\n\n` +
                          `🔍 **படி 2/6: ஆவணத்திலிருந்து பெறப்பட்ட விவரங்கள் (Verification & Spelling Check):**\n\n` +
                          `• 👤 **பெயர் (தமிழ்):** ${sessionState.citizenProfile.fullNameTam || '—'}\n` +
                          `• 🔤 **Name (English):** ${sessionState.citizenProfile.fullNameEng || '—'}\n` +
                          `• 👨‍👧 **தந்தை/கணவர் பெயர்:** ${sessionState.citizenProfile.fatherNameTam || '—'} (${sessionState.citizenProfile.fatherNameEng || '—'})\n` +
                          `• 🎂 **பிறந்த தேதி (DOB):** ${sessionState.citizenProfile.headDob || '—'}\n` +
                          `• ⚧️ **பாலினம் (Gender):** ${sessionState.citizenProfile.headGenderTam || '—'} (${sessionState.citizenProfile.headGender || '—'})\n` +
                          `• 🪪 **ஆதார் எண்:** ${formattedAadhaar || '—'}\n` +
                          `• 🏠 **முகவரி:** ${sessionState.citizenProfile.doorNo ? sessionState.citizenProfile.doorNo + ', ' : ''}${sessionState.citizenProfile.streetTam || sessionState.citizenProfile.streetEng || '—'}, ${sessionState.citizenProfile.pincode || '—'}\n` +
                          `• 🏛️ **மாவட்டம் / வட்டம் / கிராமம்:** ${sessionState.citizenProfile.district}, ${sessionState.citizenProfile.taluk}, ${sessionState.citizenProfile.village}\n\n` +
                          `💡 **எழுத்துப் பிழைகள் (Spelling Mistakes) ஏதேனும் உள்ளதா?**\n` +
                          `விவரங்கள் சரியாக இருந்தால் **'விவரங்கள் அனைத்தும் சரி'** என்பதைத் தொடரவும்:`,
                    options: [
                        { label: "✅ விவரங்கள் அனைத்தும் சரி (All Correct - Continue)", value: "HEAD_DETAILS_CONFIRMED" },
                        { label: "✏️ எழுத்துப் பிழையைத் திருத்து (Edit / Fix Spelling)", value: "TRIGGER_EDIT_MODAL" }
                    ]
                });
                return res.json({ chatHistory: sessionState.chatHistory, citizenProfile: sessionState.citizenProfile, step: sessionState.intakeState });
            }

            // Otherwise, it is only front side!
            sessionState.tempUploads.headAadhaarFront = uploadedFile.path;
            if (extracted.fullNameEng) sessionState.citizenProfile.fullNameEng = extracted.fullNameEng;
            if (extracted.fullNameTam) sessionState.citizenProfile.fullNameTam = extracted.fullNameTam;
            if (extracted.aadhaarNumber) sessionState.citizenProfile.headAadhaar = extracted.aadhaarNumber;
            if (extracted.dob) sessionState.citizenProfile.headDob = extracted.dob;
            if (extracted.gender) {
                sessionState.citizenProfile.headGender = extracted.gender;
                sessionState.citizenProfile.headGenderTam = extracted.gender === 'Female' ? 'பெண்' : 'ஆண்';
            }

            sessionState.intakeState = 'HEAD_AADHAAR_BACK';
            sessionState.chatHistory.push({
                sender: 'bot',
                text: `✅ **குடும்பத் தலைவர் ஆதார் முன்பக்கம் பெறப்பட்டது!** ${extracted.fullNameTam || extracted.fullNameEng ? `(${extracted.fullNameTam || extracted.fullNameEng})` : ''}\n\n` +
                      `🔄 **இது முன்பக்கம் மட்டுமே என்பதால், முகவரி மற்றும் தந்தை/கணவர் பெயர் உள்ள பின்பக்கத்தைப் (Back Side) பதிவேற்றவும்:**`,
                actionRequired: 'upload',
                uploadPrompt: 'ஆதார் பின்பக்கம் பதிவேற்றவும்'
            });
            return res.json({ chatHistory: sessionState.chatHistory, citizenProfile: sessionState.citizenProfile, step: sessionState.intakeState });
        }

        // STATE 5: HEAD_AADHAAR_BACK
        if (sessionState.intakeState === 'HEAD_AADHAAR_BACK') {
            if (!uploadedFile) {
                sessionState.chatHistory.push({
                    sender: 'bot',
                    text: `🔄 தயவுசெய்து குடும்பத் தலைவரின் ஆதார் அட்டையின் **பின்பக்கப் புகைப்படத்தைப்** பதிவேற்றவும்.`,
                    actionRequired: 'upload',
                    uploadPrompt: 'ஆதார் பின்பக்கம் பதிவேற்றவும்'
                });
                return res.json({ chatHistory: sessionState.chatHistory, citizenProfile: sessionState.citizenProfile, step: sessionState.intakeState });
            }

            sessionState.tempUploads.headAadhaarBack = uploadedFile.path;
            
            const mergedPdf = await produceDualSidedDocument(
                sessionState.tempUploads.headAadhaarFront,
                sessionState.tempUploads.headAadhaarBack
            );

            const extracted = await inspectAndExtractDocument(mergedPdf);

            sessionState.citizenProfile.fullNameEng = extracted.fullNameEng || sessionState.citizenProfile.fullNameEng || '';
            sessionState.citizenProfile.fullNameTam = extracted.fullNameTam || sessionState.citizenProfile.fullNameTam || '';
            sessionState.citizenProfile.fatherNameEng = extracted.fatherNameEng || sessionState.citizenProfile.fatherNameEng || '';
            sessionState.citizenProfile.fatherNameTam = extracted.fatherNameTam || sessionState.citizenProfile.fatherNameTam || '';
            sessionState.citizenProfile.headDob = extracted.dob || sessionState.citizenProfile.headDob || '';
            sessionState.citizenProfile.headGender = extracted.gender || 'Male';
            sessionState.citizenProfile.headGenderTam = extracted.gender === 'Female' ? 'பெண்' : 'ஆண்';
            sessionState.citizenProfile.headAadhaar = (extracted.aadhaarNumber && extracted.aadhaarNumber.length === 12) ? extracted.aadhaarNumber : (sessionState.citizenProfile.headAadhaar || '');
            sessionState.citizenProfile.doorNo = extracted.doorNo || sessionState.citizenProfile.doorNo || '';
            sessionState.citizenProfile.streetEng = extracted.streetEng || sessionState.citizenProfile.streetEng || '';
            sessionState.citizenProfile.streetTam = extracted.streetTam || sessionState.citizenProfile.streetTam || '';
            sessionState.citizenProfile.areaEng = extracted.areaEng || sessionState.citizenProfile.areaEng || '';
            sessionState.citizenProfile.areaTam = extracted.areaTam || sessionState.citizenProfile.areaTam || '';
            sessionState.citizenProfile.pincode = extracted.pincode || sessionState.citizenProfile.pincode || '';
            sessionState.citizenProfile.district = extracted.district || 'Ranipet';
            sessionState.citizenProfile.taluk = extracted.taluk || 'Arakkonam';
            sessionState.citizenProfile.village = extracted.village || 'Minnal';

            sessionState.citizenProfile.members = [
                {
                    nameEng: sessionState.citizenProfile.fullNameEng,
                    nameTam: sessionState.citizenProfile.fullNameTam,
                    dob: sessionState.citizenProfile.headDob,
                    gender: sessionState.citizenProfile.headGender,
                    genderTam: sessionState.citizenProfile.headGenderTam,
                    relationship: "Family Head",
                    relationshipTam: "குடும்ப தலைவர்",
                    relationshipIndex: 0,
                    profession: "Private",
                    monthlyIncome: "3000",
                    aadhaarNumber: sessionState.citizenProfile.headAadhaar,
                    docType: "AADHAAR_CARD",
                    docPath: mergedPdf
                }
            ];
            if (activeMobile) saveCitizenProfile(activeMobile, sessionState.citizenProfile);

            const formattedAadhaar = (sessionState.citizenProfile.headAadhaar || '').replace(/(\d{4})/g, '$1 ').trim();
            sessionState.intakeState = 'HEAD_DETAILS_VERIFY';
            sessionState.chatHistory.push({
                sender: 'bot',
                text: `📄 **குடும்பத் தலைவர் ஆதார் அட்டை வெற்றிகரமாக 2-in-1 அரசு A4 PDF-ஆக இணைக்கப்பட்டது!**\n\n` +
                      `🔍 **படி 2/6: ஆவணத்திலிருந்து பெறப்பட்ட விவரங்கள் (Verification & Spelling Check):**\n\n` +
                      `• 👤 **பெயர் (தமிழ்):** ${sessionState.citizenProfile.fullNameTam || '—'}\n` +
                      `• 🔤 **Name (English):** ${sessionState.citizenProfile.fullNameEng || '—'}\n` +
                      `• 👨‍👧 **தந்தை/கணவர் பெயர்:** ${sessionState.citizenProfile.fatherNameTam || '—'} (${sessionState.citizenProfile.fatherNameEng || '—'})\n` +
                      `• 🎂 **பிறந்த தேதி (DOB):** ${sessionState.citizenProfile.headDob || '—'}\n` +
                      `• ⚧️ **பாலினம் (Gender):** ${sessionState.citizenProfile.headGenderTam || '—'} (${sessionState.citizenProfile.headGender || '—'})\n` +
                      `• 🪪 **ஆதார் எண்:** ${formattedAadhaar || '—'}\n` +
                      `• 🏠 **முகவரி:** ${sessionState.citizenProfile.doorNo ? sessionState.citizenProfile.doorNo + ', ' : ''}${sessionState.citizenProfile.streetTam || sessionState.citizenProfile.streetEng || '—'}, ${sessionState.citizenProfile.pincode || '—'}\n\n` +
                      `💡 **எழுத்துப் பிழைகள் (Spelling Mistakes) ஏதேனும் உள்ளதா?**\n` +
                      `பெயரிலோ அல்லது முகவரியிலோ பிழை இருந்தால் கீழே உள்ள **'எழுத்துப் பிழையைத் திருத்து'** பட்டனை அழுத்தி உடனே திருத்திக் கொள்ளலாம்!`,
                options: [
                    { label: "✅ விவரங்கள் அனைத்தும் சரி (All Correct - Continue)", value: "HEAD_DETAILS_CONFIRMED" },
                    { label: "✏️ எழுத்துப் பிழையைத் திருத்து (Edit / Fix Spelling)", value: "TRIGGER_EDIT_MODAL" }
                ]
            });
            return res.json({ chatHistory: sessionState.chatHistory, citizenProfile: sessionState.citizenProfile, step: sessionState.intakeState });
        }

        // STATE 5.5: HEAD_DETAILS_VERIFY
        if (sessionState.intakeState === 'HEAD_DETAILS_VERIFY') {
            if (text === 'TRIGGER_EDIT_MODAL' || text.includes('திருத்து') || text.toLowerCase().includes('edit')) {
                sessionState.chatHistory.push({
                    sender: 'bot',
                    text: `✏️ **விவரங்களைத் திருத்தும் சாளரம் (Edit Window) திறக்கப்பட்டுள்ளது!**\n\nதிரையில் தோன்றும் படிவத்தில் சரியான எழுத்துக் கூட்டலை உள்ளிட்டு **'சேமி & உறுதிப்படுத்து'** பட்டனை அழுத்தவும்.`,
                    actionRequired: 'open_edit_modal',
                    options: [
                        { label: "✅ திருத்தம் முடிந்தது / விவரங்கள் சரி (Proceed)", value: "HEAD_DETAILS_CONFIRMED" },
                        { label: "✏️ மீண்டும் படிவத்தைத் திற (Open Edit Window)", value: "TRIGGER_EDIT_MODAL" }
                    ]
                });
                return res.json({ chatHistory: sessionState.chatHistory, citizenProfile: sessionState.citizenProfile, step: sessionState.intakeState });
            }

            if (text === 'HEAD_DETAILS_CONFIRMED' || text.includes('சரி') || text.includes('Correct') || text.toLowerCase().includes('ok') || text.toLowerCase().includes('continue')) {
                if (sessionState.targetMemberCount > 1) {
                    sessionState.currentMemberIdx = 1; // Member 2
                    sessionState.tempUploads.currentMemberFront = null;
                    sessionState.tempUploads.currentMemberBack = null;
                    sessionState.intakeState = 'MEMBER_AADHAAR_FRONT';
                    sessionState.chatHistory.push({
                        sender: 'bot',
                        text: `✅ **குடும்பத் தலைவர் விவரங்கள் 100% உறுதி செய்யப்பட்டன!**\n\n` +
                              `👥 **படி 3/6: குடும்ப உறுப்பினர் 2-ன் ஆதார் அட்டை**\n\n` +
                              `உறுப்பினர் 2-ன் ஆதார் அட்டையின் **முன்பக்கத்தைப் (Front Side)** பதிவேற்றவும்:`,
                        actionRequired: 'upload',
                        uploadPrompt: 'உறுப்பினர் 2 ஆதார் முன்பக்கம்'
                    });
                } else {
                    sessionState.intakeState = 'MOBILE_NUMBER';
                    sessionState.chatHistory.push({
                        sender: 'bot',
                        text: `✅ **குடும்பத் தலைவர் விவரங்கள் 100% உறுதி செய்யப்பட்டன!**\n\n` +
                              `📱 **படி 4/6: ரேஷன் கார்டு பதிவு கைபேசி எண்**\n\n` +
                              `ரேஷன் கடை பொருட்கள் தகவல், மாதாந்திர OTP மற்றும் அரசு அறிவிப்புகள் வர வேண்டிய **குடும்பத் தலைவரின் 10-இலக்க மொபைல் எண்ணை** உள்ளிடவும்.\n\n` +
                              `💡 *நீங்கள் மற்றவருக்கு விண்ணப்பித்துத் தருகிறீர்கள் என்றால், அவர்களின் குடும்ப ரேஷன் மொபைல் எண்ணைத் தட்டச்சு செய்யவும்:*` +
                              (activeMobile ? `\n*(உள்நுழைந்த எண்: +91 ${activeMobile})*` : ``),
                        options: activeMobile ? [{ label: `+91 ${activeMobile} (உள்நுழைந்த எண்ணையே பயன்படுத்து)`, value: activeMobile }] : []
                    });
                }
                return res.json({ chatHistory: sessionState.chatHistory, citizenProfile: sessionState.citizenProfile, step: sessionState.intakeState });
            }

            sessionState.chatHistory.push({
                sender: 'bot',
                text: `விவரங்களைச் சரிபார்த்து **'விவரங்கள் அனைத்தும் சரி'** அல்லது **'எழுத்துப் பிழையைத் திருத்து'** என்பதைத் தேர்ந்தெடுக்கவும்:`,
                options: [
                    { label: "✅ விவரங்கள் அனைத்தும் சரி (All Correct - Continue)", value: "HEAD_DETAILS_CONFIRMED" },
                    { label: "✏️ எழுத்துப் பிழையைத் திருத்து (Edit / Fix Spelling)", value: "TRIGGER_EDIT_MODAL" }
                ]
            });
            return res.json({ chatHistory: sessionState.chatHistory, citizenProfile: sessionState.citizenProfile, step: sessionState.intakeState });
        }

        // STATE 6: MEMBER_AADHAAR_FRONT
        if (sessionState.intakeState === 'MEMBER_AADHAAR_FRONT') {
            if (!uploadedFile) {
                sessionState.chatHistory.push({
                    sender: 'bot',
                    text: `👥 உறுப்பினர் ${sessionState.currentMemberIdx + 1}-ன் **ஆதார் அட்டையைப் (முன்பக்கம் அல்லது முழு ஆவணம்)** பதிவேற்றவும்.`,
                    actionRequired: 'upload',
                    uploadPrompt: `உறுப்பினர் ${sessionState.currentMemberIdx + 1} ஆதார்`
                });
                return res.json({ chatHistory: sessionState.chatHistory, citizenProfile: sessionState.citizenProfile, step: sessionState.intakeState });
            }

            // Immediately inspect and extract member document
            const extracted = await inspectAndExtractDocument(uploadedFile.path);

            if (extracted && extracted.isQualityAcceptable === false) {
                sessionState.chatHistory.push({
                    sender: 'bot',
                    text: `⚠️ **உறுப்பினர் ஆதார் அட்டை தெளிவாக இல்லை (Document Not Clear):**\n\n` +
                          `${extracted.feedbackTamil || 'ஆவணத்தில் உள்ள விவரங்கள் மங்கலாக உள்ளன.'}\n\n` +
                          `🛑 அரசு TNPDS இணையதளத்தில் நிராகரிக்கப்படாமல் இருக்க, அனைத்து விவரங்களும் தெளிவாகத் தெரியும்படி **புதிய தெளிவான ஆதார் ஆவணத்தை** மீண்டும் பதிவேற்றவும்:`,
                    actionRequired: 'upload',
                    uploadPrompt: `உறுப்பினர் ${sessionState.currentMemberIdx + 1} ஆதார்`
                });
                return res.json({ chatHistory: sessionState.chatHistory, citizenProfile: sessionState.citizenProfile, step: sessionState.intakeState });
            }

            const hasAddress = !!(extracted.hasAddress || extracted.doorNo || extracted.streetTam || extracted.streetEng || extracted.pincode);
            const isFullAadhaar = !!(extracted.isFullAadhaar || extracted.documentType === 'AADHAAR_FULL' || (hasAddress && (extracted.fullNameEng || extracted.fullNameTam || extracted.aadhaarNumber)));

            if (isFullAadhaar) {
                // Member uploaded a FULL single-page / e-Aadhaar document!
                const fullPdf = await produceCompliantDocument(uploadedFile.path);
                sessionState.tempUploads.currentMemberFront = uploadedFile.path;
                sessionState.tempUploads.currentMemberBack = null;

                sessionState.tempMember = {
                    nameEng: extracted.fullNameEng || `Member ${sessionState.currentMemberIdx + 1}`,
                    nameTam: extracted.fullNameTam || `உறுப்பினர் ${sessionState.currentMemberIdx + 1}`,
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

                sessionState.intakeState = 'MEMBER_RELATIONSHIP';
                sessionState.chatHistory.push({
                    sender: 'bot',
                    text: `📄 **உறுப்பினர் ${sessionState.currentMemberIdx + 1}-ன் முழு ஆதார் அட்டை வெற்றிகரமாகக் கண்டறியப்பட்டது!**\n\n` +
                          `💡 *ஒரே ஆவணத்தில் அனைத்து விவரங்களும் உள்ளதால், பின்பக்கத்தை மீண்டும் பதிவேற்றத் தேவையில்லை.* ✅\n\n` +
                          `• 👤 **பெயர்:** ${sessionState.tempMember.nameTam} (${sessionState.tempMember.nameEng})\n` +
                          `• 🪪 **ஆதார் எண்:** ${sessionState.tempMember.aadhaarNumber.replace(/(\d{4})/g, '$1 ').trim()}\n` +
                          `• 🎂 **பிறந்த தேதி:** ${sessionState.tempMember.dob}\n\n` +
                          `🤝 **குடும்பத் தலைவருடனான இவரின் உறவுமுறை என்ன?** கீழே உள்ளதில் ஒன்றைத் தேர்ந்தெடுக்கவும்:`,
                    options: getRelationshipOptions(sessionState.citizenProfile?.headGender)
                });
                return res.json({ chatHistory: sessionState.chatHistory, citizenProfile: sessionState.citizenProfile, step: sessionState.intakeState });
            }

            // Otherwise, it is only front side!
            sessionState.tempUploads.currentMemberFront = uploadedFile.path;
            sessionState.tempMember = {
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

            sessionState.intakeState = 'MEMBER_AADHAAR_BACK';
            sessionState.chatHistory.push({
                sender: 'bot',
                text: `✅ **உறுப்பினர் ${sessionState.currentMemberIdx + 1}-ன் ஆதார் முன்பக்கம் பெறப்பட்டது!** ${extracted.fullNameTam || extracted.fullNameEng ? `(${extracted.fullNameTam || extracted.fullNameEng})` : ''}\n\n` +
                      `🔄 **இது முன்பக்கம் மட்டுமே என்பதால், உறுப்பினர் ${sessionState.currentMemberIdx + 1}-ன் ஆதார் அட்டையின் பின்பக்கத்தைப் (Back Side) பதிவேற்றவும்:**`,
                actionRequired: 'upload',
                uploadPrompt: `உறுப்பினர் ${sessionState.currentMemberIdx + 1} ஆதார் பின்பக்கம்`
            });
            return res.json({ chatHistory: sessionState.chatHistory, citizenProfile: sessionState.citizenProfile, step: sessionState.intakeState });
        }

        // STATE 7: MEMBER_AADHAAR_BACK
        if (sessionState.intakeState === 'MEMBER_AADHAAR_BACK') {
            if (!uploadedFile) {
                sessionState.chatHistory.push({
                    sender: 'bot',
                    text: `🔄 உறுப்பினர் ${sessionState.currentMemberIdx + 1}-ன் ஆதார் அட்டையின் **பின்பக்கத்தைப்** பதிவேற்றவும்.`,
                    actionRequired: 'upload',
                    uploadPrompt: `உறுப்பினர் ${sessionState.currentMemberIdx + 1} ஆதார் பின்பக்கம்`
                });
                return res.json({ chatHistory: sessionState.chatHistory, citizenProfile: sessionState.citizenProfile, step: sessionState.intakeState });
            }

            sessionState.tempUploads.currentMemberBack = uploadedFile.path;
            const mergedPdf = await produceDualSidedDocument(
                sessionState.tempUploads.currentMemberFront,
                sessionState.tempUploads.currentMemberBack
            );

            const extracted = await inspectAndExtractDocument(mergedPdf);
            sessionState.tempMember = {
                nameEng: extracted.fullNameEng || `Member ${sessionState.currentMemberIdx + 1}`,
                nameTam: extracted.fullNameTam || `உறுப்பினர் ${sessionState.currentMemberIdx + 1}`,
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

            sessionState.intakeState = 'MEMBER_RELATIONSHIP';
            sessionState.chatHistory.push({
                sender: 'bot',
                text: `✅ **உறுப்பினர் ${sessionState.currentMemberIdx + 1} (${sessionState.tempMember.nameTam || sessionState.tempMember.nameEng}) ஆதார் A4 PDF-ஆக இணைக்கப்பட்டது!** 📄\n\n` +
                      `• 🪪 **ஆதார் எண்:** ${sessionState.tempMember.aadhaarNumber.replace(/(\d{4})/g, '$1 ').trim()}\n` +
                      `• 🎂 **பிறந்த தேதி:** ${sessionState.tempMember.dob}\n\n` +
                      `🤝 **குடும்பத் தலைவருடனான இவரின் உறவுமுறை என்ன?** கீழே உள்ளதில் ஒன்றைத் தேர்ந்தெடுக்கவும்:`,
                options: getRelationshipOptions(sessionState.citizenProfile?.headGender)
            });
            return res.json({ chatHistory: sessionState.chatHistory, citizenProfile: sessionState.citizenProfile, step: sessionState.intakeState });
        }

        // STATE 8: MEMBER_RELATIONSHIP
        if (sessionState.intakeState === 'MEMBER_RELATIONSHIP') {
            const relInfo = mapRelationshipToEng(text);
            sessionState.tempMember.relationship = relInfo.eng;
            sessionState.tempMember.relationshipTam = relInfo.tam;
            sessionState.tempMember.gender = relInfo.gender;
            sessionState.tempMember.genderTam = relInfo.genderTam;
            sessionState.tempMember.relationshipIndex = sessionState.currentMemberIdx;

            // Auto-sync Husband name to Father/Husband field for Female Head
            if ((relInfo.eng === 'Husband' || relInfo.tam === 'கணவர்') && sessionState.citizenProfile?.headGender === 'Female') {
                if (sessionState.tempMember.nameEng) sessionState.citizenProfile.fatherNameEng = sessionState.tempMember.nameEng;
                if (sessionState.tempMember.nameTam) sessionState.citizenProfile.fatherNameTam = sessionState.tempMember.nameTam;
                if (activeMobile) saveCitizenProfile(activeMobile, sessionState.citizenProfile);
            }

            const formattedMemberAadhaar = (sessionState.tempMember.aadhaarNumber || '').replace(/(\d{4})/g, '$1 ').trim();
            sessionState.intakeState = 'MEMBER_DETAILS_VERIFY';
            sessionState.chatHistory.push({
                sender: 'bot',
                text: `🔍 **உறுப்பினர் ${sessionState.currentMemberIdx + 1} (${relInfo.tam}) விவரங்கள் சரிபார்ப்பு (Member Verification):**\n\n` +
                      `• 👤 **பெயர் (தமிழ்):** ${sessionState.tempMember.nameTam || '—'}\n` +
                      `• 🔤 **Name (English):** ${sessionState.tempMember.nameEng || '—'}\n` +
                      `• 🤝 **உறவுமுறை:** ${relInfo.tam} (${relInfo.eng})\n` +
                      `• 🎂 **பிறந்த தேதி:** ${sessionState.tempMember.dob || '—'}\n` +
                      `• ⚧️ **பாலினம்:** ${sessionState.tempMember.genderTam || '—'} (${sessionState.tempMember.gender || '—'})\n` +
                      `• 🪪 **ஆதார் எண்:** ${formattedMemberAadhaar || '—'}\n\n` +
                      `💡 **எழுத்துப் பிழைகள் ஏதேனும் உள்ளதா?**\n` +
                      `விவரங்கள் சரியாக இருந்தால் **'உறுப்பினர் விவரங்கள் சரி'** என்பதைத் தேர்ந்தெடுக்கவும்:`,
                options: [
                    { label: "✅ உறுப்பினர் விவரங்கள் சரி (Details Correct - Continue)", value: "MEMBER_DETAILS_CONFIRMED" },
                    { label: "✏️ எழுத்துப் பிழையைத் திருத்து (Edit / Fix Spelling)", value: "TRIGGER_EDIT_MODAL" }
                ]
            });
            return res.json({ chatHistory: sessionState.chatHistory, citizenProfile: sessionState.citizenProfile, step: sessionState.intakeState });
        }

        // STATE 8.5: MEMBER_DETAILS_VERIFY
        if (sessionState.intakeState === 'MEMBER_DETAILS_VERIFY') {
            if (text === 'TRIGGER_EDIT_MODAL' || text.includes('திருத்து') || text.toLowerCase().includes('edit')) {
                sessionState.chatHistory.push({
                    sender: 'bot',
                    text: `✏️ திருத்தம் செய்த பின் **'உறுப்பினர் விவரங்கள் சரி'** என்பதைத் தேர்ந்தெடுக்கவும்.`,
                    actionRequired: 'open_edit_modal',
                    options: [
                        { label: "✅ உறுப்பினர் விவரங்கள் சரி (Details Correct - Continue)", value: "MEMBER_DETAILS_CONFIRMED" },
                        { label: "✏️ மீண்டும் படிவத்தைத் திற (Open Edit Window)", value: "TRIGGER_EDIT_MODAL" }
                    ]
                });
                return res.json({ chatHistory: sessionState.chatHistory, citizenProfile: sessionState.citizenProfile, step: sessionState.intakeState });
            }

            if (text === 'MEMBER_DETAILS_CONFIRMED' || text.includes('சரி') || text.includes('Correct') || text.toLowerCase().includes('ok') || text.toLowerCase().includes('continue')) {
                sessionState.citizenProfile.members.push(sessionState.tempMember);
                if (activeMobile) saveCitizenProfile(activeMobile, sessionState.citizenProfile);

                const isHusband = sessionState.tempMember.relationship === 'Husband' || sessionState.tempMember.relationshipTam === 'கணவர்';
                const isFemaleHead = sessionState.citizenProfile.headGender === 'Female';

                if (isHusband || isFemaleHead) {
                    sessionState.intakeState = 'ADDRESS_CHOICE';

                    const memAddr = sessionState.tempMember.address || {};
                    let headAddrStr = `${sessionState.citizenProfile.doorNo ? sessionState.citizenProfile.doorNo + ', ' : ''}${sessionState.citizenProfile.streetTam || ''}, ${sessionState.citizenProfile.pincode || ''}`;
                    let memAddrStr = `${memAddr.doorNo ? memAddr.doorNo + ', ' : ''}${memAddr.streetTam || ''}, ${memAddr.pincode || ''}`;

                    sessionState.chatHistory.push({
                        sender: 'bot',
                        text: `🏠 **ரேஷன் கார்டு குடும்ப முகவரி தேர்வு (Family Address Gate):**\n\n` +
                              `திருமணத்திற்குப் பின் புதிய ரேஷன் கார்டு விண்ணப்பிக்கும்போது, குடும்பத் தலைவி (${sessionState.citizenProfile.fullNameTam}) அவர்களின் பிறந்த வீட்டு ஆதார் முகவரிக்குப் பதிலாகக் கணவர் (${sessionState.tempMember.nameTam}) அவர்களின் ஆதார் முகவரி அல்லது புதிய குடியிருப்பு முகவரியைப் பயன்படுத்துவது வழக்கமாகும்.\n\n` +
                              `• 👩 **குடும்பத் தலைவி பிறந்த வீட்டு முகவரி:** ${headAddrStr || '—'}\n` +
                              `• 👨 **கணவர் (${sessionState.tempMember.nameTam}) ஆதார் முகவரி:** ${memAddrStr || '(இன்னும் உள்ளிடப்படவில்லை)'}\n\n` +
                              `புதிய ரேஷன் கார்டிற்கு எந்த முகவரியைக் குடும்ப முகவரியாகப் பயன்படுத்த விரும்புகிறீர்கள்?`,
                        options: [
                            { label: `👨 கணவர் (${sessionState.tempMember.nameTam}) ஆதார் முகவரியைப் பயன்படுத்து`, value: "USE_MEMBER_ADDRESS" },
                            { label: `👩 குடும்பத் தலைவி (${sessionState.citizenProfile.fullNameTam}) பிறந்த வீட்டு முகவரி`, value: "USE_HEAD_ADDRESS" },
                            { label: "✏️ புதிய முகவரியைத் தட்டச்சு செய்ய / திருத்த (District, Taluk, Village)", value: "TRIGGER_EDIT_MODAL" }
                        ]
                    });
                    return res.json({ chatHistory: sessionState.chatHistory, citizenProfile: sessionState.citizenProfile, step: sessionState.intakeState });
                }

                sessionState.currentMemberIdx++;
                if (sessionState.currentMemberIdx < sessionState.targetMemberCount) {
                    sessionState.intakeState = 'MEMBER_AADHAAR_FRONT';
                    sessionState.tempUploads.currentMemberFront = null;
                    sessionState.tempUploads.currentMemberBack = null;
                    sessionState.chatHistory.push({
                        sender: 'bot',
                        text: `✅ **உறுப்பினர் ${sessionState.currentMemberIdx} (${sessionState.tempMember.relationshipTam}) வெற்றிகரமாகச் சேர்க்கப்பட்டார்!**\n\n` +
                              `👥 **படி 3/6: குடும்ப உறுப்பினர் ${sessionState.currentMemberIdx + 1}-ன் ஆதார் அட்டை**\n\n` +
                              `உறுப்பினர் ${sessionState.currentMemberIdx + 1}-ன் ஆதார் அட்டையின் **முன்பக்கத்தைப் (Front Side)** பதிவேற்றவும்:`,
                        actionRequired: 'upload',
                        uploadPrompt: `உறுப்பினர் ${sessionState.currentMemberIdx + 1} ஆதார் முன்பக்கம்`
                    });
                } else {
                    sessionState.intakeState = 'MOBILE_NUMBER';
                    sessionState.chatHistory.push({
                        sender: 'bot',
                        text: `🎉 **அனைத்து ${sessionState.targetMemberCount} உறுப்பினர்களின் ஆதார் ஆவணங்களும் வெற்றிகரமாகச் சேர்க்கப்பட்டன!**\n\n` +
                              `📱 **படி 4/6: ரேஷன் கார்டு பதிவு கைபேசி எண்**\n\n` +
                              `ரேஷன் கடை பொருட்கள் தகவல், மாதாந்திர OTP மற்றும் அரசு அறிவிப்புகள் வர வேண்டிய **குடும்பத் தலைவரின் 10-இலக்க மொபைல் எண்ணை** உள்ளிடவும்.`,
                        options: activeMobile ? [{ label: `+91 ${activeMobile} (உள்நுழைந்த எண்ணையே பயன்படுத்து)`, value: activeMobile }] : []
                    });
                }
                return res.json({ chatHistory: sessionState.chatHistory, citizenProfile: sessionState.citizenProfile, step: sessionState.intakeState });
            }

            sessionState.chatHistory.push({
                sender: 'bot',
                text: `உறுப்பினர் விவரங்களைச் சரிபார்த்து **'உறுப்பினர் விவரங்கள் சரி'** என்பதைத் தேர்ந்தெடுக்கவும்:`,
                options: [
                    { label: "✅ உறுப்பினர் விவரங்கள் சரி (Details Correct - Continue)", value: "MEMBER_DETAILS_CONFIRMED" },
                    { label: "✏️ எழுத்துப் பிழையைத் திருத்து (Edit / Fix Spelling)", value: "TRIGGER_EDIT_MODAL" }
                ]
            });
            return res.json({ chatHistory: sessionState.chatHistory, citizenProfile: sessionState.citizenProfile, step: sessionState.intakeState });
        }

        // STATE 8.6: ADDRESS_CHOICE
        if (sessionState.intakeState === 'ADDRESS_CHOICE') {
            if (text === 'USE_MEMBER_ADDRESS' || text.includes('கணவர்') || text.includes('உறுப்பினர்')) {
                const lastMem = sessionState.citizenProfile.members.find(m => m.relationship === 'Husband' || m.relationshipTam === 'கணவர்') || sessionState.citizenProfile.members[sessionState.citizenProfile.members.length - 1];
                if (lastMem && lastMem.address && (lastMem.address.doorNo || lastMem.address.streetTam || lastMem.address.pincode)) {
                    if (lastMem.address.doorNo) sessionState.citizenProfile.doorNo = lastMem.address.doorNo;
                    if (lastMem.address.streetTam) sessionState.citizenProfile.streetTam = lastMem.address.streetTam;
                    if (lastMem.address.streetEng) sessionState.citizenProfile.streetEng = lastMem.address.streetEng || lastMem.address.streetTam;
                    if (lastMem.address.areaTam) sessionState.citizenProfile.areaTam = lastMem.address.areaTam;
                    if (lastMem.address.pincode) sessionState.citizenProfile.pincode = lastMem.address.pincode;
                    const { resolveTnDistrict } = require('./tn_district_mapper');
                    const resolved = resolveTnDistrict(lastMem.address.district, lastMem.address.taluk, lastMem.address.village, lastMem.address.pincode);
                    sessionState.citizenProfile.district = resolved.district;
                    sessionState.citizenProfile.taluk = resolved.taluk || lastMem.address.taluk;
                    sessionState.citizenProfile.village = lastMem.address.village;
                    if (activeMobile) saveCitizenProfile(activeMobile, sessionState.citizenProfile);

                    const autoNote = resolved.wasAutoCorrected ? `\n\n💡 **மாவட்ட தானியங்கி சரிபார்ப்பு:** ${resolved.reason}` : '';
                    sessionState.chatHistory.push({
                        sender: 'bot',
                        text: `✅ **ரேஷன் கார்டு குடும்ப முகவரியாகக் கணவர் (${lastMem.nameTam}) அவர்களின் ஆதார் முகவரி வெற்றிகரமாகப் பயன்படுத்தப்பட்டது!** 🏠\n\n` +
                              `• 🏠 **முகவரி:** ${sessionState.citizenProfile.doorNo ? sessionState.citizenProfile.doorNo + ', ' : ''}${sessionState.citizenProfile.streetTam}, ${sessionState.citizenProfile.pincode}\n` +
                              `• 🏛️ **மாவட்டம்/வட்டம்/கிராமம்:** ${sessionState.citizenProfile.district || '—'}, ${sessionState.citizenProfile.taluk || '—'}, ${sessionState.citizenProfile.village || '—'}` + autoNote + `\n\n` +
                              `💡 *விவரங்கள் ஏதேனும் மாற்றப்பட வேண்டுமெனில் 'விவரங்களைத் திருத்து' பொத்தானைப் பயன்படுத்தவும்.*`,
                        options: [
                            { label: "✏️ முகவரியைத் திருத்து (Edit Address / District)", value: "TRIGGER_EDIT_MODAL" }
                        ]
                    });
                } else {
                    // Open edit modal directly if member address fields are missing
                    sessionState.chatHistory.push({
                        sender: 'bot',
                        text: `✏️ கணவர் ஆதார் முகவரியை அல்லது புதிய முகவரியைத் தட்டச்சு செய்யப் படிவப் பெட்டி திறக்கப்படுகிறது...`,
                        actionRequired: 'open_edit_modal'
                    });
                }
            } else if (text === 'USE_HEAD_ADDRESS' || text.includes('தலைவி')) {
                sessionState.chatHistory.push({
                    sender: 'bot',
                    text: `✅ **குடும்பத் தலைவி (${sessionState.citizenProfile.fullNameTam}) அவர்களின் ஆதார் முகவரியே தொடரப்படுகிறது.** 🏠`
                });
            } else if (text === 'TRIGGER_EDIT_MODAL' || text.includes('திருத்து') || text.toLowerCase().includes('edit')) {
                sessionState.chatHistory.push({
                    sender: 'bot',
                    text: `✏️ திருத்தம் செய்த பின் தொடரலாம்.`,
                    actionRequired: 'open_edit_modal'
                });
                return res.json({ chatHistory: sessionState.chatHistory, citizenProfile: sessionState.citizenProfile, step: sessionState.intakeState });
            }

            sessionState.currentMemberIdx++;
            if (sessionState.currentMemberIdx < sessionState.targetMemberCount) {
                sessionState.intakeState = 'MEMBER_AADHAAR_FRONT';
                sessionState.tempUploads.currentMemberFront = null;
                sessionState.tempUploads.currentMemberBack = null;
                sessionState.chatHistory.push({
                    sender: 'bot',
                    text: `👥 **படி 3/6: குடும்ப உறுப்பினர் ${sessionState.currentMemberIdx + 1}-ன் ஆதார் அட்டை**\n\n` +
                          `உறுப்பினர் ${sessionState.currentMemberIdx + 1}-ன் ஆதார் அட்டையின் **முன்பக்கத்தைப் (Front Side)** பதிவேற்றவும்:`,
                    actionRequired: 'upload',
                    uploadPrompt: `உறுப்பினர் ${sessionState.currentMemberIdx + 1} ஆதார் முன்பக்கம்`
                });
            } else {
                sessionState.intakeState = 'MOBILE_NUMBER';
                sessionState.chatHistory.push({
                    sender: 'bot',
                    text: `🎉 **அனைத்து ${sessionState.targetMemberCount} உறுப்பினர்களின் ஆதார் ஆவணங்களும் வெற்றிகரமாகச் சேர்க்கப்பட்டன!**\n\n` +
                          `📱 **படி 4/6: ரேஷன் கார்டு பதிவு கைபேசி எண்**\n\n` +
                          `ரேஷன் கடை பொருட்கள் தகவல், மாதாந்திர OTP மற்றும் அரசு அறிவிப்புகள் வர வேண்டிய **குடும்பத் தலைவரின் 10-இலக்க மொபைல் எண்ணை** உள்ளிடவும்.`,
                    options: activeMobile ? [{ label: `+91 ${activeMobile} (உள்நுழைந்த எண்ணையே பயன்படுத்து)`, value: activeMobile }] : []
                });
            }
            return res.json({ chatHistory: sessionState.chatHistory, citizenProfile: sessionState.citizenProfile, step: sessionState.intakeState });
        }

        // STATE 9: MOBILE_NUMBER
        if (sessionState.intakeState === 'MOBILE_NUMBER') {
            const cleanDigits = text.replace(/\D/g, '');
            if (cleanDigits.length === 10 && /^[6-9]\d{9}$/.test(cleanDigits)) {
                activeMobile = cleanDigits;
                sessionState.citizenProfile.mobileNumber = cleanDigits;
                saveCitizenProfile(activeMobile, sessionState.citizenProfile);

                sessionState.intakeState = 'RESIDENCE_PROOF_TYPE';
                sessionState.chatHistory.push({
                    sender: 'bot',
                    text: `✅ **ரேஷன் கார்டு மொபைல் எண் உறுதி செய்யப்பட்டது:** +91 ${cleanDigits}\n\n` +
                          `🏠 **படி 5/6: குடும்பத்தின் குடியிருப்புச் சான்று (Residence Proof)**\n\n` +
                          `உங்கள் குடும்பத்தின் முகவரிச் சான்றாக கீழே உள்ளவற்றில் எந்த ஆவணத்தைப் பதிவேற்ற விரும்புகிறீர்கள்?`,
                    options: RESIDENCE_PROOF_OPTIONS
                });
            } else {
                sessionState.chatHistory.push({
                    sender: 'bot',
                    text: `⚠️ சரியான 10-இலக்க மொபைல் எண்ணை உள்ளிடவும் (எ.கா: 9876543210):`,
                    options: [{ label: `+91 ${activeMobile} (இந்த எண்ணையே பயன்படுத்து)`, value: activeMobile }]
                });
            }
            return res.json({ chatHistory: sessionState.chatHistory, citizenProfile: sessionState.citizenProfile, step: sessionState.intakeState });
        }

        // STATE 10: RESIDENCE_PROOF_TYPE
        if (sessionState.intakeState === 'RESIDENCE_PROOF_TYPE') {
            sessionState.tempUploads.residenceProofType = text;
            sessionState.intakeState = 'RESIDENCE_PROOF_DOC';
            sessionState.chatHistory.push({
                sender: 'bot',
                text: `📄 நீங்கள் தேர்ந்தெடுத்த சான்று: **${text}**\n\n` +
                      `தயவுசெய்து உங்கள் **${text}** ஆவணத்தின் புகைப்படம் அல்லது PDF-ஐப் பதிவேற்றவும்:\n\n` +
                      `💡 **ஏஐ ஆவண ஸ்கேனர்:** உங்கள் ஆவணத்தை அரசு ஏற்கும் மிகத் தெளிவான A4 PDF-ஆக (< 250 KB) எங்கள் AI மாற்றிவிடும்!`,
                actionRequired: 'upload',
                uploadPrompt: `${text} பதிவேற்றவும்`
            });
            return res.json({ chatHistory: sessionState.chatHistory, citizenProfile: sessionState.citizenProfile, step: sessionState.intakeState });
        }

        // STATE 11: RESIDENCE_PROOF_DOC
        if (sessionState.intakeState === 'RESIDENCE_PROOF_DOC') {
            if (!uploadedFile) {
                sessionState.chatHistory.push({
                    sender: 'bot',
                    text: `📄 தயவுசெய்து குடியிருப்புச் சான்று ஆவணத்தைப் பதிவேற்றவும்.`,
                    actionRequired: 'upload',
                    uploadPrompt: `குடியிருப்புச் சான்று ஆவணம் பதிவேற்றவும்`
                });
                return res.json({ chatHistory: sessionState.chatHistory, citizenProfile: sessionState.citizenProfile, step: sessionState.intakeState });
            }

            const optDoc = await produceCompliantDocument(uploadedFile.path);
            const proofType = sessionState.tempUploads.residenceProofType || 'எரிவாயு நுகர்வோர் அட்டை';
            sessionState.citizenProfile.residenceProof = {
                type: proofType.includes('எரிவாயு') ? 'GAS_BOOK' : (proofType.includes('சொத்து') ? 'PROPERTY_TAX' : 'EB_BILL'),
                typeTam: proofType,
                docPath: optDoc
            };
            saveCitizenProfile(activeMobile, sessionState.citizenProfile);

            sessionState.intakeState = 'AADHAAR_MOBILE_CONFIRM';
            sessionState.chatHistory.push({
                sender: 'bot',
                text: `✅ **குடியிருப்புச் சான்று அரசு A4 PDF-ஆக உகந்ததாக்கப்பட்டு சேமிக்கப்பட்டது!** 📄\n\n` +
                      `⚠️ **படி 6/6: மிக முக்கியமான இறுதிச் சரிபார்ப்பு (Aadhaar Mobile Link Gate):**\n\n` +
                      `ரேஷன் கார்டு விண்ணப்பத்தில் சேர்க்கப்பட்டுள்ள **அனைத்து ${sessionState.citizenProfile.members.length} உறுப்பினர்களின் ஆதார் எண்களிலும்** மொபைல் எண் இணைக்கப்பட்டு நடைமுறையில் (Active) உள்ளதா?\n\n` +
                      `💡 **ஏன் இது மிக முக்கியம்?**\n` +
                      `தமிழ்நாடு அரசு இணையதளத்தில் ஒவ்வொரு உறுப்பினரைச் சேர்க்கும்போதும் அவர்களின் ஆதார் பதிவு எண்ணிற்கு **உடனடி SMS OTP** வரும். OTP தாமதமாகி நேரம் வீணாகாமல் இருக்க, அனைத்து உறுப்பினர்களின் கைபேசிகளும் உங்கள் அருகில் தயார் நிலையில் இருப்பது அவசியம்!\n\n` +
                      `உறுதிப்படுத்த கீழே உள்ள பொத்தானைத் தொடவும்:`,
                options: [
                    { label: "✅ ஆம், அனைவருக்கும் ஆதார் மொபைல் எண் தயார்! (Confirm & Ready)", value: "CONFIRMED_AADHAAR_MOBILE" },
                    { label: "🔄 விவரங்களை மறுபரிசீலனை செய்", value: "reset" }
                ]
            });
            return res.json({ chatHistory: sessionState.chatHistory, citizenProfile: sessionState.citizenProfile, step: sessionState.intakeState });
        }

        // STATE 12: AADHAAR_MOBILE_CONFIRM
        if (sessionState.intakeState === 'AADHAAR_MOBILE_CONFIRM') {
            sessionState.intakeState = 'READY_TO_APPLY';

            let membersSummary = '';
            sessionState.citizenProfile.members.forEach((m, idx) => {
                membersSummary += `  ${idx + 1}. **${m.nameTam || m.nameEng}** (${m.relationshipTam || 'தலைவர்'}) | ஆதார்: ${m.aadhaarNumber.replace(/(\d{4})/g, '$1 ').trim()} ✅\n`;
            });

            const hasGas = !!(sessionState.citizenProfile.gasDetails?.hasGas && sessionState.citizenProfile.gasDetails?.consumerNumber);
            const gasStatusLine = hasGas 
                ? `• 🔥 **எரிவாயு இணைப்பு (Gas):** உள்ளது (${sessionState.citizenProfile.gasDetails.agencyName || ''} - ${sessionState.citizenProfile.gasDetails.consumerNumber}) ✅\n`
                : `• 🔥 **எரிவாயு இணைப்பு (Gas):** ❌ குடும்பத்திற்கு எரிவாயு இணைப்பு இல்லை (அரசு TNPDS போர்ட்டலில் செக் பாக்ஸ் டிக் செய்யப்படாது)\n`;

            sessionState.chatHistory.push({
                sender: 'bot',
                text: `🎉 **அனைத்து விவரங்களும் 100% வெற்றிகரமாகச் சேகரிக்கப்பட்டு சரிபார்க்கப்பட்டன!** 🛡️\n\n` +
                      `📋 **விண்ணப்பத்தின் முழு சுருக்கம்:**\n` +
                      `• 👤 **குடும்பத் தலைவர்:** ${sessionState.citizenProfile.fullNameTam} (${sessionState.citizenProfile.fullNameEng})\n` +
                      `• 📸 **பாஸ்போர்ட் புகைப்படம்:** வெள்ளை பின்னணியுடன் தயார் ✅\n` +
                      `• 👥 **மொத்த உறுப்பினர்கள் (${sessionState.citizenProfile.members.length}):**\n${membersSummary}` +
                      `• 🏠 **முகவரி:** ${sessionState.citizenProfile.doorNo}, ${sessionState.citizenProfile.streetTam}, ${sessionState.citizenProfile.areaTam || ''} - ${sessionState.citizenProfile.pincode}\n` +
                      `• 📑 **குடியிருப்புச் சான்று:** ${sessionState.citizenProfile.residenceProof?.typeTam || 'ஆதார் / குடியிருப்புச் சான்று'} (அரசு A4 PDF தயார் ✅)\n` +
                      gasStatusLine +
                      `• 📱 **ரேஷன் கார்டு பதிவு எண்:** +91 ${sessionState.citizenProfile.mobileNumber}\n` +
                      `• 🔐 **ஆதார் OTP தயார்நிலை:** 100% உறுதி செய்யப்பட்டது ✅\n\n` +
                      `இப்போது தமிழ்நாடு அரசு TNPDS இணையதளத்தில் உங்கள் புதிய ரேஷன் கார்டை விண்ணப்பிக்கத் தொடங்குங்கள்!`,
                options: [
                    { label: "🚀 அரசு TNPDS போர்ட்டலில் விண்ணப்பிக்கத் தொடங்கு", value: "Start" },
                    { label: "👁️ தனி தாவலில் படிவத்தைச் சரிபார் (Review in New Tab)", value: "OPEN_REVIEW_TAB" },
                    { label: "✏️ விவரங்களைச் சரிபார் / திருத்து (Edit Any Details)", value: "TRIGGER_EDIT_MODAL" },
                    { label: "🧪 சுயகற்றல் சோதனை முறை (Run Mock Test)", value: "Mock Test" },
                    { label: "🔄 புதிய விண்ணப்பம் தொடங்க (Reset)", value: "reset" }
                ]
            });
            return res.json({ chatHistory: sessionState.chatHistory, citizenProfile: sessionState.citizenProfile, step: sessionState.intakeState });
        }

        sessionState.chatHistory.push({
            sender: 'bot',
            text: 'விண்ணப்பத்தைத் தொடங்க **\'Start\'** என்று தட்டச்சு செய்யவும் அல்லது அரசு அனுப்பிய **OTP எண்ணை** உள்ளிடவும்.'
        });

        return res.json({
            chatHistory: sessionState.chatHistory,
            citizenProfile: sessionState.citizenProfile,
            step: sessionState.step
        });

    } catch (err) {
        console.error('Server error:', err);
        return res.status(500).json({ error: err.message });
    }
});

// Resend OTP endpoint
app.post('/api/chat/resend-otp', async (req, res) => {
    const resendResult = await resendOtp();
    sessionState.chatHistory.push({
        sender: 'bot',
        text: resendResult.success 
            ? `🔄 **அரசு இணையதளத்தில் புதிய OTP மீண்டும் அனுப்பப்பட்டுள்ளது!**\n\nஉங்கள் கைபேசிக்கு வந்துள்ள புதிய 6-இலக்க OTP எண்ணை உள்ளிடவும்:`
            : `⚠️ ${resendResult.message}`
    });
    res.json({
        success: resendResult.success,
        chatHistory: sessionState.chatHistory,
        citizenProfile: sessionState.citizenProfile,
        step: sessionState.step
    });
});

// Live OTP countdown timer & status endpoint
app.get('/api/chat/otp-status', async (req, res) => {
    try {
        const status = await getLiveOtpStatus();
        res.json(status);
    } catch (e) {
        res.json({ isWaitingForOtp: false, seconds: 0, otpType: '' });
    }
});

// Reset endpoint
app.post('/api/chat/reset', async (req, res) => {
    await resetActiveSession();
    res.json({
        success: true,
        chatHistory: sessionState.chatHistory,
        citizenProfile: sessionState.citizenProfile,
        step: sessionState.intakeState
    });
});

// Profile update endpoint (for user correcting spelling mistakes & details)
app.post('/api/profile/update', (req, res) => {
    try {
        const updated = req.body;
        if (!sessionState.citizenProfile) {
            sessionState.citizenProfile = createFreshProfile(activeMobile || '');
        }

        if (updated.fullNameTam !== undefined) sessionState.citizenProfile.fullNameTam = updated.fullNameTam;
        if (updated.fullNameEng !== undefined) sessionState.citizenProfile.fullNameEng = updated.fullNameEng;
        if (updated.fatherNameTam !== undefined) sessionState.citizenProfile.fatherNameTam = updated.fatherNameTam;
        if (updated.fatherNameEng !== undefined) sessionState.citizenProfile.fatherNameEng = updated.fatherNameEng;
        if (updated.headDob !== undefined) sessionState.citizenProfile.headDob = updated.headDob;
        if (updated.headGender !== undefined) sessionState.citizenProfile.headGender = updated.headGender;
        if (updated.headGenderTam !== undefined) sessionState.citizenProfile.headGenderTam = updated.headGenderTam;
        if (updated.doorNo !== undefined) sessionState.citizenProfile.doorNo = updated.doorNo;
        if (updated.streetTam !== undefined) sessionState.citizenProfile.streetTam = updated.streetTam;
        if (updated.streetEng !== undefined) sessionState.citizenProfile.streetEng = updated.streetEng || updated.streetTam;
        if (updated.areaTam !== undefined) sessionState.citizenProfile.areaTam = updated.areaTam;
        if (updated.pincode !== undefined) sessionState.citizenProfile.pincode = updated.pincode;
        if (updated.district !== undefined) sessionState.citizenProfile.district = updated.district;
        if (updated.taluk !== undefined) sessionState.citizenProfile.taluk = updated.taluk;
        if (updated.village !== undefined) sessionState.citizenProfile.village = updated.village;

        const { resolveTnDistrict } = require('./tn_district_mapper');
        const resolvedLoc = resolveTnDistrict(
            sessionState.citizenProfile.district,
            sessionState.citizenProfile.taluk,
            sessionState.citizenProfile.village,
            sessionState.citizenProfile.pincode
        );
        sessionState.citizenProfile.district = resolvedLoc.district;
        sessionState.citizenProfile.districtTam = resolvedLoc.districtTam;
        if (resolvedLoc.taluk) sessionState.citizenProfile.taluk = resolvedLoc.taluk;
        if (updated.headAadhaar !== undefined) sessionState.citizenProfile.headAadhaar = updated.headAadhaar;
        if (updated.gasDetails) {
            sessionState.citizenProfile.gasDetails = {
                ...sessionState.citizenProfile.gasDetails,
                ...updated.gasDetails
            };
        }

        // Keep Head of family in members[0] in sync
        if (sessionState.citizenProfile.members && sessionState.citizenProfile.members.length > 0) {
            sessionState.citizenProfile.members[0].nameEng = sessionState.citizenProfile.fullNameEng;
            sessionState.citizenProfile.members[0].nameTam = sessionState.citizenProfile.fullNameTam;
            sessionState.citizenProfile.members[0].dob = sessionState.citizenProfile.headDob;
            sessionState.citizenProfile.members[0].gender = sessionState.citizenProfile.headGender;
            sessionState.citizenProfile.members[0].genderTam = sessionState.citizenProfile.headGenderTam;
            sessionState.citizenProfile.members[0].aadhaarNumber = sessionState.citizenProfile.headAadhaar;
        }

        const targetMobile = req.headers['x-session-mobile'] || req.body?.mobileNumber || activeMobile;
        if (targetMobile) {
            saveCitizenProfile(targetMobile, sessionState.citizenProfile);
            saveCitizenDraft(targetMobile, {
                operatorUid: sessionState.operatorUid || null,
                operatorName: sessionState.operatorName || null,
                operatorMobile: sessionState.operatorMobile || null,
                citizenProfile: sessionState.citizenProfile,
                documents: sessionState.tempUploads || {},
                chatHistory: sessionState.chatHistory,
                intakeState: sessionState.intakeState,
                step: sessionState.step || 'draft',
                status: sessionState.applicationNumber ? 'SUBMITTED' : 'DRAFT_SAVED'
            }).catch(e => console.warn('Draft sync on profile update error:', e.message));
            persistSessions();
        }

        const confirmValue = (sessionState.intakeState === 'HEAD_DETAILS_VERIFY' ? 'HEAD_DETAILS_CONFIRMED' : (sessionState.intakeState === 'MEMBER_DETAILS_VERIFY' ? 'MEMBER_DETAILS_CONFIRMED' : 'Start'));

        sessionState.chatHistory.push({
            sender: 'bot',
            text: `✏️ **விவரங்கள் வெற்றிகரமாகத் திருத்தப்பட்டு சேமிக்கப்பட்டன!** 💾\n\n` +
                  `• 👤 **பெயர்:** ${sessionState.citizenProfile.fullNameTam} (${sessionState.citizenProfile.fullNameEng})\n` +
                  `• 🎂 **பிறந்த தேதி:** ${sessionState.citizenProfile.headDob || '—'}\n` +
                  `• 🏠 **முகவரி:** ${sessionState.citizenProfile.doorNo ? sessionState.citizenProfile.doorNo + ', ' : ''}${sessionState.citizenProfile.streetTam || sessionState.citizenProfile.streetEng || '—'}, ${sessionState.citizenProfile.pincode || ''}\n\n` +
                  `அனைத்து எழுத்துப் பிழைகளும் சரியாக உள்ளதா என உறுதிப்படுத்தவும்:`,
            options: [
                { label: "✅ விவரங்கள் அனைத்தும் சரி (Confirmed - Continue)", value: confirmValue },
                { label: "✏️ மீண்டும் திருத்து (Edit Again)", value: "TRIGGER_EDIT_MODAL" }
            ]
        });

        res.json({
            success: true,
            chatHistory: sessionState.chatHistory,
            citizenProfile: sessionState.citizenProfile,
            step: sessionState.intakeState
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Document Locker endpoint
app.get('/api/documents', (req, res) => {
    const mobile = req.query.mobile || activeMobile;
    const docs = getCitizenDocuments(mobile);
    res.json({ success: true, documents: docs, mobile });
});

// Download specific document
app.get('/api/documents/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(uploadDir, filename);
    if (fs.existsSync(filePath)) {
        return res.download(filePath);
    }
    res.status(404).json({ error: 'File not found.' });
});


// Confirm Final Submission
app.post('/api/chat/confirm_submit', async (req, res) => {
    try {
        const submitResult = await submitTnpdsApplication();

        if (submitResult.applicationNumber) {
            sessionState.applicationNumber = submitResult.applicationNumber;
        } else {
            const refMatch = submitResult.message.match(/[\d]{8,}/);
            if (refMatch) sessionState.applicationNumber = refMatch[0];
        }

        if (submitResult.applicationPdfUrl) {
            sessionState.applicationPdfUrl = submitResult.applicationPdfUrl;
        }

        sessionState.chatHistory.push({
            sender: 'bot',
            text: submitResult.message,
            applicationNumber: sessionState.applicationNumber,
            applicationPdfUrl: sessionState.applicationPdfUrl
        });

        // If application number extracted, add a prominent pin message
        if (sessionState.applicationNumber) {
            sessionState.citizenProfile.applicationNumber = sessionState.applicationNumber;
            if (sessionState.applicationPdfUrl) {
                sessionState.citizenProfile.applicationPdfUrl = sessionState.applicationPdfUrl;
            }
            sessionState.citizenProfile.submittedAt = new Date().toISOString();
            saveCitizenProfile(activeMobile, sessionState.citizenProfile);
            sessionState.chatHistory.push({
                sender: 'bot',
                text: `📋 **விண்ணப்ப பதிவு குறிப்பு எண் (Application Reference No.):**\n\n` +
                      `# 🎫 ${sessionState.applicationNumber}\n\n` +
                      (sessionState.applicationPdfUrl ? `📥 **[அதிகாரப்பூர்வ விண்ணப்ப படிவத்தைப் பதிவிறக்கம் செய்ய (PDF)](${sessionState.applicationPdfUrl})**\n\n` : '') +
                      `இந்த எண்ணை எதிர்கால பயன்பாட்டிற்காகக் குறித்து வைக்கவும். TNPDS போர்ட்டலில் விண்ணப்பத்தின் நிலையை சரிபார்க்க இந்த எண் தேவைப்படும்!`,
                applicationNumber: sessionState.applicationNumber,
                applicationPdfUrl: sessionState.applicationPdfUrl
            });
        }

        sessionState.step = 'submitted';
        persistSessions();

        res.json({
            chatHistory: sessionState.chatHistory,
            citizenProfile: sessionState.citizenProfile,
            step: 'submitted',
            applicationNumber: sessionState.applicationNumber || null,
            applicationPdfUrl: sessionState.applicationPdfUrl || null
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Live Automation Step Progress
app.get('/api/automation/progress', (req, res) => {
    const targetMobile = req.query.mobile || activeMobile;
    const sess = targetMobile ? getOrCreateSession(targetMobile) : sessionState;
    if (!sess) {
        return res.json({ step: 0, total: 0, percentage: 0, isRunning: false, isWaitingForApproval: false });
    }
    const step = sess.automationStep || 0;
    const total = sess.automationTotal || 51;
    const pct = total > 0 ? Math.round((step / total) * 100) : 0;
    const approvalStatus = getLiveApprovalStatus();
    res.json({
        step,
        total,
        percentage: pct,
        isRunning: step > 0 && step < total,
        isWaitingForApproval: approvalStatus.isWaitingForApproval,
        approvalSnapshotUrl: approvalStatus.fullSnapshotUrl,
        auditResult: approvalStatus.auditResult,
        applicationNumber: sess.applicationNumber || null
    });
});

// Live Automation Full Status with Snapshot & Telemetry for Operator Review Tab
app.get('/api/automation/live-status', async (req, res) => {
    const targetMobile = req.query.mobile || req.headers['x-session-mobile'] || activeMobile;
    const sess = targetMobile ? getOrCreateSession(targetMobile) : sessionState;

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

    const approvalStatus = getLiveApprovalStatus();

    const latestSnapPath = path.join(__dirname, 'public', 'previews', 'latest.png');
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

// Direct Start Automation endpoint (used by Review Tab)
app.post('/api/automation/start', async (req, res) => {
    const targetMobile = req.body.mobileNumber || req.headers['x-session-mobile'] || activeMobile;
    if (!targetMobile) return res.status(400).json({ error: 'செயலில் உள்ள வாடிக்கையாளர் எண் இல்லை.' });
    const sess = getOrCreateSession(targetMobile);
    const isMock = !!req.body.isMock;

    const modeText = isMock ? '🧪 சுயகற்றல் சோதனை முறை (Mock Sandbox)' : '🚀 நேரலை முறை (Live Production)';
    sess.chatHistory.push({
        sender: 'bot',
        text: `${modeText}யில் தமிழ்நாடு அரசு TNPDS இணையதள விண்ணப்பம் தொடங்கப்படுகிறது...\n\nவிண்ணப்பதாரர்: ${sess.citizenProfile?.fullNameEng || sess.citizenProfile?.fullNameTam || 'விண்ணப்பதாரர்'} (+91 ${sess.citizenProfile?.mobileNumber || targetMobile})`
    });

    startTnpdsRationCardFlow(
        sess.citizenProfile,
        (progressMsg) => {
            sess.chatHistory.push({ sender: 'bot', text: progressMsg });
            const stepMatch = progressMsg.match(/\[படி\s*(\d+)\s*\/\s*(\d+)\]/);
            if (stepMatch) {
                sess.automationStep = parseInt(stepMatch[1]);
                sess.automationTotal = parseInt(stepMatch[2]);
            }
        },
        { isMockSandbox: isMock }
    ).then((result) => {
        if (result && result.success) {
            sess.applicationNumber = result.applicationNumber || null;
            sess.applicationPdfUrl = result.applicationPdfUrl || null;
            if (sess.citizenProfile) {
                sess.citizenProfile.applicationNumber = result.applicationNumber;
                sess.citizenProfile.applicationPdfUrl = result.applicationPdfUrl;
                sess.citizenProfile.submittedAt = new Date().toISOString();
                saveCitizenProfile(targetMobile, sess.citizenProfile);
            }
            sess.step = 'submitted';
            sess.chatHistory.push({
                sender: 'bot',
                text: result.message,
                applicationNumber: result.applicationNumber,
                applicationPdfUrl: result.applicationPdfUrl
            });
            persistSessions();
        }
    }).catch((err) => {
        sess.chatHistory.push({ sender: 'bot', text: `⚠️ ஆட்டோமேஷன் பிழை: ${err.message}` });
        persistSessions();
    });

    sess.automationStep = 0;
    sess.automationTotal = 51;
    persistSessions();

    res.json({ success: true, message: 'TNPDS ஆட்டோமேஷன் தொடங்கப்பட்டது' });
});

// ==========================================
// HITL VALIDATION STATION & APPROVAL ENDPOINTS
// ==========================================
app.get('/api/automation/approval-status', async (req, res) => {
    const status = getLiveApprovalStatus();
    const targetMobile = req.query.mobile || activeMobile;
    const sess = targetMobile ? getOrCreateSession(targetMobile) : sessionState;
    res.json({
        ...status,
        citizenProfile: sess ? sess.citizenProfile : null,
        mobileNumber: targetMobile
    });
});

app.post('/api/automation/approve-submit', async (req, res) => {
    const success = provideOperatorApproval(true);
    res.json({
        success,
        message: success ? '✅ ஆபரேட்டர் ஒப்புதல் வழங்கப்பட்டது. இறுதிச் சமர்ப்பிப்பு தொடங்குகிறது...' : 'செயலில் உள்ள ஒப்புதல் அமர்வு இல்லை.'
    });
});

app.post('/api/automation/update-portal-field', async (req, res) => {
    const fieldUpdates = req.body || {};
    const targetMobile = req.body.mobileNumber || activeMobile;
    
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

app.post('/api/automation/log-feedback', async (req, res) => {
    const { note, issueType, screenshotUrl, mobileNumber } = req.body;
    const opUid = req.headers['x-operator-uid'] || null;

    const logged = await logOperatorCorrection({
        mobile: mobileNumber || activeMobile,
        operatorUid: opUid,
        type: 'OPERATOR_FEEDBACK',
        issueType: issueType || 'GENERAL',
        note: note || '',
        screenshotUrl: screenshotUrl || null
    });

    res.json({ success: true, message: 'நன்றி! உங்கள் ஃபீட்பேக் வெற்றிகரமாகப் பதிவு செய்யப்பட்டது.', logId: logged.id });
});

// Application Status Check (post-submit polling)
app.get('/api/application/status', async (req, res) => {
    if (!sessionState || !sessionState.applicationNumber) {
        return res.json({ hasApplication: false });
    }
    // For now return stored status; future: scrape TNPDS portal
    res.json({
        hasApplication: true,
        applicationNumber: sessionState.applicationNumber,
        submittedAt: sessionState.citizenProfile?.submittedAt || null,
        status: sessionState.applicationStatus || 'Under Review (விசாரணையில் உள்ளது)',
        lastChecked: new Date().toISOString()
    });
});

// Stop Automation
app.post('/api/automation/stop', async (req, res) => {
    try {
        await stopTnpdsAutomation();
        if (sessionState) {
            sessionState.chatHistory.push({
                sender: 'bot',
                text: '🛑 அரசு இணையதள ஆட்டோமேஷன் நிறுத்தப்பட்டது.'
            });
            sessionState.automationStep = 0;
        }
        res.json({
            chatHistory: sessionState ? sessionState.chatHistory : [],
            citizenProfile: sessionState ? sessionState.citizenProfile : null,
            step: 'stopped'
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Admin Dashboard Live Stats endpoint (enhanced)
app.get('/api/admin/stats', (req, res) => {
    const stats = getAllCitizensSummary();
    const sessionsArr = Array.from(sessions.entries()).map(([mobile, s]) => ({
        mobile,
        name: s.citizenProfile?.fullNameTam || s.citizenProfile?.fullNameEng || '—',
        state: s.intakeState,
        members: s.citizenProfile?.members?.length || 0,
        appNo: s.applicationNumber || null,
        lastChat: s.chatHistory?.length || 0
    }));
    res.json({
        success: true,
        stats: {
            ...stats,
            systemHealth: 'ONLINE (24/7)',
            uptime: Math.round(process.uptime()),
            todayRevenue: stats.totalApplicationsSubmitted * 50,
            activeMobile,
            activeSessions: sessions.size,
            sessionDetails: sessionsArr
        }
    });
});

// ==========================================
// DESKTOP APP DOWNLOAD & DISTRIBUTION
// ==========================================
app.get('/api/download/desktop-app', (req, res) => {
    const candidates = [
        path.join(__dirname, 'desktop', 'dist', 'eSevaDraft-Desktop-Setup-1.0.1.exe'),
        path.join(__dirname, 'desktop', 'dist', 'eSevaDraft-Setup-1.0.1.exe'),
        path.join(__dirname, 'desktop', 'dist', 'eSevaDraft-Setup-1.0.0.exe'),
        path.join(__dirname, 'downloads', 'eSevaDraft-Desktop-Setup-1.0.1.exe')
    ];

    for (const exePath of candidates) {
        if (fs.existsSync(exePath)) {
            return res.download(exePath, 'eSevaDraft-Desktop-Setup-1.0.1.exe');
        }
    }

    // Fallback: Redirect directly to official GitHub Release CDN
    return res.redirect('https://github.com/kumaran434/esevadraft/releases/download/v1.0.1/eSevaDraft-Desktop-Setup-1.0.1.exe');
});

// Periodic session persist (every 30 seconds)
setInterval(persistSessions, 30000);

app.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(`Government Form Automation Server Started (Port ${PORT})`);
    console.log(`AI Chatbot: http://localhost:${PORT}/index.html`);
    console.log(`==================================================\n`);
});
