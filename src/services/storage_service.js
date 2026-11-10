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
const SESSIONS_BACKUP_PATH = path.join(DATA_DIR, 'sessions.json.bak');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

function safeWriteJsonSync(targetPath, data) {
    try {
        const dir = path.dirname(targetPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const tmpPath = `${targetPath}.tmp_${Date.now()}`;
        const content = JSON.stringify(data, null, 2);
        fs.writeFileSync(tmpPath, content, 'utf8');
        try {
            fs.copyFileSync(tmpPath, targetPath);
            fs.unlinkSync(tmpPath);
        } catch (_) {
            fs.writeFileSync(targetPath, content, 'utf8');
        }
        return true;
    } catch (e) {
        console.error(`Safe write error for ${targetPath}:`, e.message);
        return false;
    }
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

function hasActiveDraftOnDisk(mobile) {
    if (!mobile || !/^[0-9]{10}$/.test(mobile)) return false;
    const localDraft = path.join(DATA_DIR, 'drafts', `${mobile}.json`);
    const appDataDraft = path.join(process.env.APPDATA || 'C:\\Users\\ADMIN\\AppData\\Roaming', 'esevadraft-desktop', 'data', 'drafts', `${mobile}.json`);
    return fs.existsSync(localDraft) || fs.existsSync(appDataDraft);
}

function loadPersistedSessions() {
    const { isMeaningfulDraft } = require('./db/draft_manage');
    try {
        if (fs.existsSync(SESSIONS_DATA_PATH)) {
            const content = fs.readFileSync(SESSIONS_DATA_PATH, 'utf-8');
            if (!content || !content.trim()) throw new Error('sessions.json empty');
            const raw = JSON.parse(content);
            Object.entries(raw).forEach(([mobile, state]) => {
                if (!hasActiveDraftOnDisk(mobile)) return;
                if (!isMeaningfulDraft({ mobileNumber: mobile, ...state })) return;
                state.isAutomating = false;
                state.isAutomationRunning = false;
                state.automationStep = 0;
                sessions.set(mobile, state);
            });
            console.log(`📦 Restored ${sessions.size} session(s) from disk.`);
            return;
        }
    } catch (e) {
        console.warn('Session restore failed, checking backup:', e.message);
        if (fs.existsSync(SESSIONS_BACKUP_PATH)) {
            try {
                const bakContent = fs.readFileSync(SESSIONS_BACKUP_PATH, 'utf-8');
                const rawBak = JSON.parse(bakContent);
                Object.entries(rawBak).forEach(([mobile, state]) => {
                    if (!hasActiveDraftOnDisk(mobile)) return;
                    if (!isMeaningfulDraft({ mobileNumber: mobile, ...state })) return;
                    state.isAutomating = false;
                    state.isAutomationRunning = false;
                    state.automationStep = 0;
                    sessions.set(mobile, state);
                });
                console.log(`🛡️ [Sessions Rescue] Restored ${sessions.size} session(s) from sessions.json.bak!`);
                safeWriteJsonSync(SESSIONS_DATA_PATH, rawBak);
                return;
            } catch (_) {}
        }
    }
}

function persistSessions(currentActiveMobile) {
    try {
        const targetActive = currentActiveMobile || activeMobile;
        const snapshot = {};
        
        // Filter out dummy test sessions and unbounded walkin bloat
        const walkinEntries = [];
        sessions.forEach((state, mobile) => {
            const isPhone = /^[0-9]{10}$/.test(mobile);
            const isTarget = (mobile === targetActive);
            
            if (isPhone || isTarget) {
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
            } else if (mobile && mobile.startsWith('walkin_')) {
                const hasData = state.citizenProfile && (state.citizenProfile.fullNameEng || state.citizenProfile.fullNameTam || state.citizenProfile.headAadhaar);
                if (hasData) {
                    walkinEntries.push({ mobile, state });
                }
            }
        });

        // Retain at most 5 latest meaningful walkins on disk
        const recentWalkins = walkinEntries.slice(-5);
        recentWalkins.forEach(({ mobile, state }) => {
            snapshot[mobile] = {
                intakeState: state.intakeState,
                targetMemberCount: state.targetMemberCount,
                currentMemberIdx: state.currentMemberIdx,
                step: state.step,
                subService: state.subService || state.citizenProfile?.subService || null,
                subServiceData: state.subServiceData || state.citizenProfile?.subServiceData || null,
                citizenProfile: state.citizenProfile,
                chatHistory: state.chatHistory,
                applicationNumber: state.applicationNumber || null,
                applicationPdfUrl: state.applicationPdfUrl || null
            };
        });

        const success = safeWriteJsonSync(SESSIONS_DATA_PATH, snapshot);
        if (success) {
            try { fs.copyFileSync(SESSIONS_DATA_PATH, SESSIONS_BACKUP_PATH); } catch (_) {}
        }

        if (targetActive && sessions.has(targetActive) && (currentActiveMobile || hasActiveDraftOnDisk(targetActive))) {
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

const sessionAccessTimestamps = new Map();
const MAX_IN_MEMORY_SESSIONS = 25;

function touchSession(mobile) {
    if (mobile) sessionAccessTimestamps.set(mobile, Date.now());
}

function evictStaleSessions() {
    if (sessions.size <= MAX_IN_MEMORY_SESSIONS) return;
    persistSessions();
    const sorted = Array.from(sessionAccessTimestamps.entries()).sort((a, b) => a[1] - b[1]);
    for (const [mob] of sorted) {
        if (sessions.size <= MAX_IN_MEMORY_SESSIONS) break;
        if (mob !== activeMobile) {
            sessions.delete(mob);
            sessionAccessTimestamps.delete(mob);
        }
    }
}

function getOrCreateSession(mobile) {
    touchSession(mobile);
    if (!sessions.has(mobile)) {
        let resurrected = null;
        try {
            if (hasActiveDraftOnDisk(mobile) && fs.existsSync(SESSIONS_DATA_PATH)) {
                const { isMeaningfulDraft } = require('./db/draft_manage');
                const disk = JSON.parse(fs.readFileSync(SESSIONS_DATA_PATH, 'utf-8'));
                if (disk && disk[mobile] && isMeaningfulDraft({ mobileNumber: mobile, ...disk[mobile] })) {
                    resurrected = disk[mobile];
                    resurrected.isAutomating = false;
                    resurrected.isAutomationRunning = false;
                    resurrected.automationStep = 0;
                }
            }
        } catch (_) {}

        if (resurrected) {
            if (!resurrected.subService && resurrected.citizenProfile?.subService) {
                resurrected.subService = resurrected.citizenProfile.subService;
            }
            if (!resurrected.subService && (resurrected.intakeState === 'READY_TO_APPLY_CAN' || resurrected.citizenProfile?.intakeState === 'READY_TO_APPLY_CAN')) {
                resurrected.subService = 'CAN_REGISTER';
            }
            sessions.set(mobile, resurrected);
        } else {
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
        evictStaleSessions();
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

function purgeSession(mobile) {
    if (!mobile) return;
    const cleanMobile = String(mobile).trim();
    sessions.delete(cleanMobile);
    sessionAccessTimestamps.delete(cleanMobile);
    if (activeMobile === cleanMobile) {
        activeMobile = null;
        sessionState = null;
    }
    try {
        if (fs.existsSync(SESSIONS_DATA_PATH)) {
            const disk = JSON.parse(fs.readFileSync(SESSIONS_DATA_PATH, 'utf-8'));
            if (disk && disk[cleanMobile]) {
                delete disk[cleanMobile];
                safeWriteJsonSync(SESSIONS_DATA_PATH, disk);
            }
        }
    } catch (_) {}
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

function resolveMobile(req) {
    if (!req) return activeMobile;
    const fromHeaders = req.headers && req.headers['x-session-mobile'];
    const fromQuery = req.query && (req.query.mobile || req.query.mobileNumber);
    const fromBody = req.body && (req.body.mobile || req.body.mobileNumber || req.body.phone);
    const resolved = String(fromHeaders || fromQuery || fromBody || '').trim();
    return resolved || activeMobile;
}

function resolveSession(req) {
    const mob = resolveMobile(req);
    return mob ? getOrCreateSession(mob) : (sessionState || getOrCreateSession('walkin_session'));
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
    purgeSession,
    rekeySession,
    resolveMobile,
    resolveSession
};
