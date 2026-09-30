/**
 * eSevaDraft Storage & Session Service
 * 
 * Manages in-memory active sessions, local disk persistence (data/sessions.json),
 * Firestore drafts sync, walk-in session hygiene, and phone re-keying.
 */

const fs = require('fs');
const path = require('path');
const { 
    saveCitizenDraft, 
    deleteCitizenDraft, 
    saveCitizenProfile 
} = require('../../firestore_db');
const { getInitialWelcomeMessage } = require('../core/chat_fsm');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const SESSIONS_DATA_PATH = path.join(DATA_DIR, 'sessions.json');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-memory sessions map (mobile/sessionId -> sessionState)
const sessions = new Map();
let activeMobile = null;
let sessionState = null;

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

function loadPersistedSessions() {
    try {
        if (fs.existsSync(SESSIONS_DATA_PATH)) {
            const raw = JSON.parse(fs.readFileSync(SESSIONS_DATA_PATH, 'utf-8'));
            Object.entries(raw).forEach(([mobile, state]) => {
                sessions.set(mobile, state);
            });
            console.log(`📦 Restored ${sessions.size} session(s) from disk.`);
        }
    } catch (e) {
        console.warn('Session restore failed (clean start):', e.message);
    }
}

function persistSessions(currentActiveMobile) {
    try {
        const targetActive = currentActiveMobile || activeMobile;
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
        fs.writeFileSync(SESSIONS_DATA_PATH, JSON.stringify(snapshot, null, 2), 'utf-8');

        if (targetActive && sessions.has(targetActive)) {
            const curState = sessions.get(targetActive);
            saveCitizenDraft(targetActive, {
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

function setActiveSession(mobile) {
    activeMobile = mobile;
    sessionState = getOrCreateSession(mobile);
    return sessionState;
}

function getActiveMobile() {
    return activeMobile;
}

function setActiveMobile(mobile) {
    activeMobile = mobile;
}

function getSessionState() {
    return sessionState;
}

function setSessionState(state) {
    sessionState = state;
}

async function resetActiveSession(stopTnpdsFn) {
    if (typeof stopTnpdsFn === 'function') {
        try { await stopTnpdsFn(); } catch (e) {}
    }
    const mob = activeMobile || '';
    if (mob && sessions.has(mob)) {
        sessions.delete(mob);
    }
    if (mob && mob.startsWith('walkin_')) {
        try { await deleteCitizenDraft(mob); } catch (e) {}
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

async function rekeySession(oldKey, newMobile, reqOpUid) {
    if (!newMobile) return null;
    const sess = sessions.get(oldKey) || sessionState || getOrCreateSession(newMobile);
    sess.citizenProfile.mobileNumber = newMobile;
    sessions.set(newMobile, sess);
    if (oldKey && oldKey !== newMobile && sessions.has(oldKey)) {
        sessions.delete(oldKey);
    }
    activeMobile = newMobile;
    sessionState = sess;

    saveCitizenProfile(newMobile, sess.citizenProfile);

    try {
        await saveCitizenDraft(newMobile, {
            operatorUid: reqOpUid || sess.operatorUid || null,
            operatorName: sess.operatorName || null,
            operatorMobile: sess.operatorMobile || null,
            citizenProfile: sess.citizenProfile,
            documents: {},
            chatHistory: sess.chatHistory,
            intakeState: sess.intakeState,
            status: 'DRAFT_SAVED'
        });
    } catch (e) {
        console.error('Draft save failed on phone bind:', e);
    }

    return sess;
}

// Initial restore on load
loadPersistedSessions();

module.exports = {
    sessions,
    createFreshProfile,
    loadPersistedSessions,
    persistSessions,
    getOrCreateSession,
    setActiveSession,
    getActiveMobile,
    setActiveMobile,
    getSessionState,
    setSessionState,
    resetActiveSession,
    rekeySession
};
