/**
 * eSevaDraft Storage & Session Service
 *
 * Single Canonical Store Law:
 * Manages in-memory active sessions hydrated directly from the ONE active drafts directory
 * (getActiveDraftsDir()/<mobile>.json) + Firestore cloud backup.
 * NEVER writes redundant sessions.json or sessions.json.bak copies on disk.
 */

const fs = require('fs');
const path = require('path');
const { 
    saveCitizenDraft, 
    deleteCitizenDraft
} = require('../../firestore_db');
const { saveCitizenProfile } = require('../../database');
const { getActiveDraftsDir, isSpecificDraftId, extractMobileFromDraftKey, getActiveDraftIdForMobile, normalizeOperatorUid } = require('./db/firestore_client');
const { getInitialWelcomeMessage } = require('../core/chat_fsm');

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
    if (!mobile || (!/^[0-9]{10}$/.test(mobile) && !isSpecificDraftId(mobile))) return false;
    const activeDraft = path.join(getActiveDraftsDir(), `${mobile}.json`);
    if (!fs.existsSync(activeDraft)) return false;
    try {
        const parsed = JSON.parse(fs.readFileSync(activeDraft, 'utf8'));
        if (parsed && (parsed.isDeleted === true || parsed.status === 'TRASHED')) return false;
    } catch (_) {}
    return true;
}

/**
 * Single Canonical Store Law:
 * Sessions are pure in-memory working state hydrated on-demand from the single active draft file
 * (getActiveDraftsDir()/<mobile>.json). Never reads or writes redundant sessions.json / sessions.json.bak.
 */
function loadPersistedSessions() {
    // No-op: lazy on-demand hydration from the single canonical draft file prevents stale session resurrection.
}

function persistSessions(currentActiveMobileOrSession) {
    try {
        let curState = null;
        let targetKey = null;
        if (currentActiveMobileOrSession && typeof currentActiveMobileOrSession === 'object') {
            curState = currentActiveMobileOrSession;
            targetKey = curState.draftId || curState.mobileNumber || curState.citizenProfile?.mobileNumber || activeMobile;
        } else {
            const targetActive = currentActiveMobileOrSession || activeMobile;
            if (targetActive && sessions.has(targetActive)) {
                curState = sessions.get(targetActive);
                targetKey = targetActive;
            } else if (!currentActiveMobileOrSession && sessionState) {
                curState = sessionState;
                targetKey = curState.draftId || curState.mobileNumber || activeMobile;
            }
        }
        if (curState && targetKey) {
            const saveKey = curState.draftId || targetKey;
            const cleanMob = extractMobileFromDraftKey(curState.citizenProfile?.mobileNumber || targetKey);
            const shouldSave = Boolean(
                currentActiveMobileOrSession ||
                hasActiveDraftOnDisk(saveKey) ||
                (curState.draftId && (
                    curState.citizenProfile?.fullNameTam ||
                    curState.citizenProfile?.fullNameEng ||
                    curState.citizenProfile?.headAadhaar ||
                    curState.subServiceData ||
                    curState.applicationNumber ||
                    Object.keys(curState.tempUploads || {}).length > 0
                ))
            );
            if (!shouldSave) return;
            saveCitizenDraft(saveKey, {
                draftId: saveKey,
                mobileNumber: cleanMob,
                operatorUid: curState.operatorUid || null,
                operatorName: curState.operatorName || null,
                operatorMobile: curState.operatorMobile || null,
                citizenProfile: curState.citizenProfile,
                subService: curState.subService || curState.citizenProfile?.subService || null,
                subServiceData: curState.subServiceData || curState.citizenProfile?.subServiceData || null,
                documents: curState.tempUploads || {},
                base64Docs: curState.base64Docs || curState.citizenProfile?.base64Docs || {},
                chatHistory: curState.chatHistory,
                intakeState: curState.intakeState,
                targetMemberCount: curState.targetMemberCount !== undefined ? curState.targetMemberCount : null,
                currentMemberIdx: curState.currentMemberIdx !== undefined ? curState.currentMemberIdx : 0,
                tempMember: curState.tempMember || null,
                tempUploads: curState.tempUploads || null,
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
            if (hasActiveDraftOnDisk(mobile)) {
                // Hydrate strictly from the ONE canonical active draft file on disk
                const dPath = path.join(getActiveDraftsDir(), `${mobile}.json`);
                if (fs.existsSync(dPath)) {
                    const parsed = JSON.parse(fs.readFileSync(dPath, 'utf-8'));
                    if (parsed && !parsed.isDeleted && parsed.status !== 'TRASHED' && (parsed.citizenProfile || parsed.mobileNumber)) {
                        resurrected = {
                            draftId: parsed.draftId || mobile,
                            operatorUid: parsed.operatorUid || null,
                            operatorName: parsed.operatorName || null,
                            operatorMobile: parsed.operatorMobile || null,
                            intakeState: parsed.intakeState || 'SERVICE_SELECTION',
                            targetMemberCount: parsed.targetMemberCount !== undefined ? parsed.targetMemberCount : 1,
                            currentMemberIdx: parsed.currentMemberIdx !== undefined ? parsed.currentMemberIdx : 0,
                            tempUploads: parsed.tempUploads || parsed.documents || {},
                            tempMember: parsed.tempMember || null,
                            step: parsed.step || 'READY',
                            subService: parsed.subService || parsed.citizenProfile?.subService || null,
                            subServiceData: parsed.subServiceData || parsed.citizenProfile?.subServiceData || null,
                            citizenProfile: parsed.citizenProfile || createFreshProfile(mobile),
                            chatHistory: Array.isArray(parsed.chatHistory) && parsed.chatHistory.length > 0 ? parsed.chatHistory : [getInitialWelcomeMessage()],
                            applicationNumber: parsed.applicationNumber || null,
                            applicationPdfUrl: parsed.applicationPdfUrl || null,
                            isAutomating: false,
                            isAutomationRunning: false,
                            automationStep: 0
                        };
                    }
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
    return freshSession;
}

function purgeSession(mobile) {
    if (!mobile) return;
    const rawKey = String(mobile).trim();
    if (isSpecificDraftId(rawKey)) {
        const parentMob = extractMobileFromDraftKey(rawKey);
        sessions.delete(rawKey);
        sessionAccessTimestamps.delete(rawKey);
        if (parentMob && sessions.has(parentMob) && sessions.get(parentMob)?.draftId === rawKey) {
            sessions.delete(parentMob);
            sessionAccessTimestamps.delete(parentMob);
            if (activeMobile === parentMob || activeMobile === rawKey) {
                activeMobile = null;
                sessionState = null;
            }
        } else if (activeMobile === rawKey) {
            activeMobile = null;
            sessionState = null;
        }
        return;
    }
    const cleanDigits = String(mobile).replace(/\D/g, '').slice(-10);
    const keys = Array.from(new Set([cleanDigits, rawKey, `+91 ${cleanDigits}`, `+91${cleanDigits}`, `91${cleanDigits}`].filter(Boolean)));
    for (const k of keys) {
        sessions.delete(k);
        sessionAccessTimestamps.delete(k);
    }
    for (const [sk, sv] of Array.from(sessions.entries())) {
        if (isSpecificDraftId(sk) && extractMobileFromDraftKey(sk) === cleanDigits) {
            sessions.delete(sk);
            sessionAccessTimestamps.delete(sk);
        }
    }
    if (activeMobile && (keys.includes(String(activeMobile).trim()) || extractMobileFromDraftKey(activeMobile) === cleanDigits)) {
        activeMobile = null;
        sessionState = null;
    }
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

function makeScopedSessionKey(mobile, operatorUid = null) {
    const clean = String(mobile || '').trim();
    if (!clean) return '';
    if (isSpecificDraftId(clean) || clean.startsWith('walkin_')) return clean;
    const normOp = normalizeOperatorUid(operatorUid);
    return normOp ? `${normOp}::${clean}` : clean;
}

/**
 * Resolves an isolated in-memory session for (draftId, mobile, operatorUid).
 * Guarantees two operators using the SAME customer mobile number NEVER share or overwrite sessions.
 */
function resolveSessionForRequest({ draftId = '', mobile = '', operatorUid = null } = {}) {
    const reqDraftId = String(draftId || '').trim();
    const rawMob = String(mobile || '').trim();
    const normOp = normalizeOperatorUid(operatorUid);

    if (reqDraftId && isSpecificDraftId(reqDraftId)) {
        if (sessions.has(reqDraftId)) {
            const s = sessions.get(reqDraftId);
            const sOp = normalizeOperatorUid(s?.operatorUid);
            if (!normOp || !sOp || sOp === normOp) {
                touchSession(reqDraftId);
                return s;
            }
        }
        const hydrated = getOrCreateSession(reqDraftId);
        const hOp = normalizeOperatorUid(hydrated?.operatorUid);
        if (normOp && hOp && hOp !== normOp) {
            return null;
        }
        if (normOp && !hOp) hydrated.operatorUid = normOp;
        return hydrated;
    }

    if (normOp && rawMob && !rawMob.startsWith('walkin_')) {
        const routedId = getActiveDraftIdForMobile(rawMob, normOp);
        if (routedId && sessions.has(routedId)) {
            const rs = sessions.get(routedId);
            touchSession(routedId);
            return rs;
        }
        const scopedKey = makeScopedSessionKey(rawMob, normOp);
        if (sessions.has(scopedKey)) {
            touchSession(scopedKey);
            return sessions.get(scopedKey);
        }
        if (sessions.has(rawMob)) {
            const bare = sessions.get(rawMob);
            const bareOp = normalizeOperatorUid(bare?.operatorUid);
            if (!bareOp || bareOp === normOp) {
                if (normOp && !bareOp) bare.operatorUid = normOp;
                sessions.set(scopedKey, bare);
                touchSession(scopedKey);
                return bare;
            }
        }
        if (routedId) {
            const hyd = getOrCreateSession(routedId);
            if (hyd && (!normalizeOperatorUid(hyd.operatorUid) || normalizeOperatorUid(hyd.operatorUid) === normOp)) {
                hyd.operatorUid = hyd.operatorUid || normOp;
                sessions.set(scopedKey, hyd);
                return hyd;
            }
        }
        // Check if this operator has a draft file on disk before creating an empty scoped shell
        let opDraftFile = null;
        try {
            const draftsDir = getActiveDraftsDir();
            if (fs.existsSync(draftsDir)) {
                const mobDigits = extractMobileFromDraftKey(rawMob);
                let newestTs = -1;
                for (const f of fs.readdirSync(draftsDir).filter(x => (x === `${mobDigits}.json` || x.startsWith(`${mobDigits}_`)) && x.endsWith('.json'))) {
                    try {
                        const p = JSON.parse(fs.readFileSync(path.join(draftsDir, f), 'utf8'));
                        if (!p || p.isDeleted || p.status === 'TRASHED') continue;
                        if (normalizeOperatorUid(p.operatorUid) !== normOp) continue;
                        const ts = new Date(p.lastUpdated || 0).getTime();
                        if (ts >= newestTs) { newestTs = ts; opDraftFile = p; }
                    } catch (_) {}
                }
            }
        } catch (_) {}

        if (opDraftFile) {
            const dId = opDraftFile.draftId || rawMob;
            const hyd = getOrCreateSession(dId);
            sessions.set(scopedKey, hyd);
            return hyd;
        }

        const freshProfile = createFreshProfile(rawMob);
        const freshScoped = {
            draftId: routedId || undefined,
            mobileNumber: rawMob,
            operatorUid: normOp,
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
        sessions.set(scopedKey, freshScoped);
        touchSession(scopedKey);
        return freshScoped;
    }

    const fallbackKey = reqDraftId || rawMob || activeMobile || 'walkin_session';
    return getOrCreateSession(fallbackKey);
}

function resolveSession(req) {
    const mob = resolveMobile(req);
    const reqDraftId = req && ((req.headers && req.headers['x-draft-id']) || (req.query && req.query.draftId) || (req.body && req.body.draftId) || '');
    const opUid = req && ((req.headers && req.headers['x-operator-uid']) || (req.query && req.query.operatorUid) || (req.body && req.body.operatorUid) || null);
    if (reqDraftId || opUid) {
        return resolveSessionForRequest({ draftId: reqDraftId, mobile: mob, operatorUid: opUid }) || getOrCreateSession('walkin_session');
    }
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
    resolveSession,
    makeScopedSessionKey,
    resolveSessionForRequest
};
