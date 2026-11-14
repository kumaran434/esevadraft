// =========================================================================
// User Profile Store (eSeva Operators & Admins)
// =========================================================================
const fs = require('fs');
const path = require('path');
const https = require('https');
const { getFirestoreInstance, isFirestoreAvailable } = require('./firestore_client');

const USERS_COLLECTION = 'eseva_users';
const LOCAL_USERS_DIR = path.join(__dirname, '..', '..', '..', 'data', 'users');
if (!fs.existsSync(LOCAL_USERS_DIR)) {
    try { fs.mkdirSync(LOCAL_USERS_DIR, { recursive: true }); } catch (_) {}
}

const APPDATA_DATA_DIR = path.join(process.env.APPDATA || 'C:\\Users\\ADMIN\\AppData\\Roaming', 'esevadraft-desktop', 'data');
const APPDATA_USERS_DIR = path.join(APPDATA_DATA_DIR, 'users');
if (!fs.existsSync(APPDATA_USERS_DIR)) {
    try { fs.mkdirSync(APPDATA_USERS_DIR, { recursive: true }); } catch (_) {}
}
const OPERATOR_SESSION_FILE = path.join(APPDATA_DATA_DIR, 'operator_auth_session.json');

function isTestMode() {
    return !!(
        process.env.REGRESSION_TEST === 'true' ||
        process.env.NODE_ENV === 'test' ||
        process.env.ESEVA_TEST_MODE === '1' ||
        process.argv.some(a => a.includes('regression_suite') || a.includes('test_'))
    );
}

function fetchCloudJson(urlPath, method = 'GET', bodyObj = null) {
    if (isTestMode()) return Promise.resolve(null);
    return new Promise((resolve) => {
        try {
            const baseUrl = process.env.ESEVA_CLOUD_URL || 'https://esevadraft.in';
            const urlObj = new URL(urlPath, baseUrl);
            const postData = bodyObj ? JSON.stringify(bodyObj) : null;
            const req = https.request({
                hostname: urlObj.hostname,
                port: urlObj.port || 443,
                path: urlObj.pathname + urlObj.search,
                method,
                headers: postData ? {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                } : {},
                timeout: 3500
            }, (res) => {
                if (res.statusCode !== 200) {
                    res.resume();
                    return resolve(null);
                }
                let raw = '';
                res.on('data', c => { raw += c; });
                res.on('end', () => {
                    try { resolve(JSON.parse(raw)); } catch (_) { resolve(null); }
                });
            });
            req.on('error', () => resolve(null));
            req.on('timeout', () => { req.destroy(); resolve(null); });
            if (postData) req.write(postData);
            req.end();
        } catch (_) {
            resolve(null);
        }
    });
}

function saveActiveOperatorSession(sessionData = {}) {
    if (isTestMode()) return;
    if (!sessionData || !sessionData.operatorUid) return;
    try {
        if (!fs.existsSync(APPDATA_DATA_DIR)) {
            fs.mkdirSync(APPDATA_DATA_DIR, { recursive: true });
        }
        const payload = {
            operatorUid: sessionData.operatorUid,
            displayName: sessionData.displayName || 'இ-சேவை மையம்',
            mobileNumber: sessionData.mobileNumber || '',
            email: sessionData.email || '',
            role: sessionData.role || 'operator',
            isAdmin: !!sessionData.isAdmin,
            updatedAt: new Date().toISOString()
        };
        fs.writeFileSync(OPERATOR_SESSION_FILE, JSON.stringify(payload, null, 2), 'utf8');
    } catch (_) {}
}

function getActiveOperatorSession() {
    if (isTestMode()) return null;
    try {
        if (fs.existsSync(OPERATOR_SESSION_FILE)) {
            const parsed = JSON.parse(fs.readFileSync(OPERATOR_SESSION_FILE, 'utf8'));
            if (parsed && parsed.operatorUid) return parsed;
        }
    } catch (_) {}
    return null;
}

function clearActiveOperatorSession() {
    if (isTestMode()) return;
    try {
        if (fs.existsSync(OPERATOR_SESSION_FILE)) {
            fs.unlinkSync(OPERATOR_SESSION_FILE);
        }
    } catch (_) {}
}

async function saveUserProfile(uid, profileData = {}) {
    if (!uid) return null;
    let existing = {};
    for (const dir of [APPDATA_USERS_DIR, LOCAL_USERS_DIR]) {
        try {
            const f = path.join(dir, `${uid}.json`);
            if (fs.existsSync(f)) {
                existing = { ...JSON.parse(fs.readFileSync(f, 'utf8')), ...existing };
            }
        } catch (_) {}
    }

    const roleVal = profileData.role || existing.role || 'operator';
    const isAdminVal = (typeof profileData.isAdmin === 'boolean')
        ? profileData.isAdmin
        : ((typeof existing.isAdmin === 'boolean') ? existing.isAdmin : (roleVal === 'admin'));

    if (profileData.mobileNumber) {
        const digits = String(profileData.mobileNumber).replace(/\D/g, '');
        profileData.mobileNumber = digits.length >= 10 ? digits.slice(-10) : digits;
    }

    const payload = {
        ...existing,
        ...profileData,
        uid,
        role: roleVal,
        isAdmin: isAdminVal,
        updatedAt: new Date().toISOString()
    };

    const dirsToWrite = isTestMode() ? [LOCAL_USERS_DIR] : [APPDATA_USERS_DIR, LOCAL_USERS_DIR];
    for (const dir of dirsToWrite) {
        try {
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            const localFile = path.join(dir, `${uid}.json`);
            fs.writeFileSync(localFile, JSON.stringify(payload, null, 2), 'utf8');
        } catch (_) {}
    }

    setImmediate(async () => {
        const firestore = getFirestoreInstance();
        if (isFirestoreAvailable() && firestore) {
            try {
                await firestore.collection(USERS_COLLECTION).doc(uid).set(payload, { merge: true });
            } catch (e) {
                console.warn(`Firestore save user profile error: ${e.message}`);
            }
        } else if (!isTestMode() && process.env.DESKTOP_RUNTIME === '1') {
            await fetchCloudJson('/api/auth/sync-profile', 'POST', payload);
        }
    });
    return payload;
}

async function deleteUserProfile(uid) {
    if (!uid) return false;
    const dirsToDelete = isTestMode() ? [LOCAL_USERS_DIR] : [APPDATA_USERS_DIR, LOCAL_USERS_DIR];
    for (const dir of dirsToDelete) {
        try {
            const localFile = path.join(dir, `${uid}.json`);
            if (fs.existsSync(localFile)) {
                fs.unlinkSync(localFile);
            }
        } catch (_) {}
    }

    const firestore = getFirestoreInstance();
    if (isFirestoreAvailable() && firestore) {
        try {
            await firestore.collection(USERS_COLLECTION).doc(uid).delete();
        } catch (e) {
            console.warn(`Firestore delete user profile error: ${e.message}`);
        }
    }
    return true;
}

const KUMARAN_UID = 'z9TSOApH0Hh69Du0xPK2GDxK2kr2';
const KNOWN_OPERATOR_NAMES = {
    'PlzEG1ptSyQMBe2QFjf8AUS7TJr2': 'SUMAN',
    'plzeg1ptsyqmbe2qfjf8aus7tjr2': 'SUMAN'
};

function sanitizeOperatorDisplayName(uid, displayName) {
    const cleanUid = String(uid || '').trim();
    if (KNOWN_OPERATOR_NAMES[cleanUid] && (!displayName || displayName === 'குமரன் இ-சேவை மையம்' || displayName === 'பயனர்' || displayName === 'மையம்')) {
        return KNOWN_OPERATOR_NAMES[cleanUid];
    }
    if (cleanUid && cleanUid !== KUMARAN_UID && displayName === 'குமரன் இ-சேவை மையம்') {
        return KNOWN_OPERATOR_NAMES[cleanUid] || 'இ-சேவை மையம்';
    }
    return displayName;
}

async function getUserProfile(uid) {
    if (!uid) return null;
    let localCached = null;
    const searchDirs = isTestMode() ? [LOCAL_USERS_DIR] : [APPDATA_USERS_DIR, LOCAL_USERS_DIR];
    for (const dir of searchDirs) {
        try {
            const localFile = path.join(dir, `${uid}.json`);
            if (fs.existsSync(localFile)) {
                localCached = JSON.parse(fs.readFileSync(localFile, 'utf8'));
                break;
            }
        } catch (_) {}
    }

    const isPollutedKumaranName = localCached && uid !== KUMARAN_UID && localCached.displayName === 'குமரன் இ-சேவை மையம்';
    if (localCached && !isPollutedKumaranName) {
        return localCached;
    }

    const firestore = getFirestoreInstance();
    if (isFirestoreAvailable() && firestore) {
        try {
            const doc = await firestore.collection(USERS_COLLECTION).doc(uid).get();
            if (doc.exists) {
                const data = doc.data();
                data.displayName = sanitizeOperatorDisplayName(uid, data.displayName);
                try {
                    if (!isTestMode()) {
                        fs.writeFileSync(path.join(APPDATA_USERS_DIR, `${uid}.json`), JSON.stringify(data, null, 2), 'utf8');
                    }
                } catch (_) {}
                return data;
            }
        } catch (e) {
            console.warn(`Firestore get user profile error: ${e.message}`);
        }
    } else if (!isTestMode() && process.env.DESKTOP_RUNTIME === '1') {
        const cloudData = await fetchCloudJson(`/api/auth/profile?uid=${encodeURIComponent(uid)}`);
        if (cloudData && cloudData.found && cloudData.profile) {
            cloudData.profile.displayName = sanitizeOperatorDisplayName(uid, cloudData.profile.displayName);
            try {
                fs.writeFileSync(path.join(APPDATA_USERS_DIR, `${uid}.json`), JSON.stringify(cloudData.profile, null, 2), 'utf8');
            } catch (_) {}
            return cloudData.profile;
        }
    }

    if (localCached) {
        localCached.displayName = sanitizeOperatorDisplayName(uid, localCached.displayName);
        return localCached;
    }
    return null;
}

async function lookupUserByMobile(mobileNumber) {
    if (!mobileNumber) return null;
    const rawStr = String(mobileNumber).trim();
    const digitsOnly = rawStr.replace(/\D/g, '');
    const cleanMobile = digitsOnly.length >= 10 ? digitsOnly.slice(-10) : digitsOnly;
    const lowerIdentifier = rawStr.toLowerCase();

    const searchDirs = isTestMode() ? [LOCAL_USERS_DIR] : [APPDATA_USERS_DIR, LOCAL_USERS_DIR];
    for (const dir of searchDirs) {
        try {
            if (fs.existsSync(dir)) {
                const files = fs.readdirSync(dir);
                for (const f of files) {
                    if (f.endsWith('.json')) {
                        const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
                        const profileMob = String(data.mobileNumber || '').replace(/\D/g, '').slice(-10);
                        const profileName = String(data.displayName || data.centerName || '').trim().toLowerCase();
                        const profileEmail = String(data.email || '').trim().toLowerCase();
                        if ((cleanMobile.length === 10 && profileMob === cleanMobile) ||
                            (lowerIdentifier.length >= 3 && (profileName === lowerIdentifier || profileEmail === lowerIdentifier || profileEmail.split('@')[0] === lowerIdentifier))) {
                            if (!data.email && profileMob) {
                                data.email = `${profileMob}@esevadraft.in`;
                            }
                            return data;
                        }
                    }
                }
            }
        } catch (_) {}
    }

    const firestore = getFirestoreInstance();
    if (isFirestoreAvailable() && firestore) {
        try {
            let snap = null;
            if (cleanMobile.length === 10) {
                snap = await firestore.collection(USERS_COLLECTION)
                    .where('mobileNumber', '==', cleanMobile)
                    .limit(1)
                    .get();
                if (snap.empty) {
                    snap = await firestore.collection(USERS_COLLECTION)
                        .where('mobileNumber', '==', `+91${cleanMobile}`)
                        .limit(1)
                        .get();
                }
            }
            if (!snap || snap.empty) {
                const allSnap = await firestore.collection(USERS_COLLECTION).limit(50).get();
                for (const doc of allSnap.docs) {
                    const d = doc.data();
                    const pMob = String(d.mobileNumber || '').replace(/\D/g, '').slice(-10);
                    const pName = String(d.displayName || d.centerName || '').trim().toLowerCase();
                    const pEmail = String(d.email || '').trim().toLowerCase();
                    if ((cleanMobile.length === 10 && pMob === cleanMobile) ||
                        (lowerIdentifier.length >= 3 && (pName === lowerIdentifier || pEmail === lowerIdentifier || pEmail.split('@')[0] === lowerIdentifier))) {
                        if (!d.email && pMob) d.email = `${pMob}@esevadraft.in`;
                        try {
                            if (!isTestMode()) {
                                fs.writeFileSync(path.join(APPDATA_USERS_DIR, `${doc.id}.json`), JSON.stringify({ ...d, uid: doc.id }, null, 2), 'utf8');
                            }
                        } catch (_) {}
                        return { ...d, uid: doc.id };
                    }
                }
            } else if (!snap.empty) {
                const doc = snap.docs[0];
                const data = doc.data();
                if (!data.email) {
                    data.email = `${cleanMobile}@esevadraft.in`;
                }
                try {
                    if (!isTestMode()) {
                        fs.writeFileSync(path.join(APPDATA_USERS_DIR, `${doc.id}.json`), JSON.stringify({ ...data, uid: doc.id }, null, 2), 'utf8');
                    }
                } catch (_) {}
                return { ...data, uid: doc.id };
            }
        } catch (e) {
            console.warn(`Firestore lookupUserByMobile error: ${e.message}`);
        }
    } else if (!isTestMode() && process.env.DESKTOP_RUNTIME === '1') {
        const cloudLookup = await fetchCloudJson(`/api/auth/lookup-mobile?mobile=${encodeURIComponent(rawStr)}`);
        if (cloudLookup && cloudLookup.found) {
            if (cloudLookup.uid) {
                try {
                    const cachedProfile = {
                        uid: cloudLookup.uid,
                        email: cloudLookup.authEmail,
                        role: cloudLookup.role || 'operator',
                        displayName: cloudLookup.displayName || 'மையம்',
                        mobileNumber: cloudLookup.mobileNumber || cleanMobile
                    };
                    fs.writeFileSync(path.join(APPDATA_USERS_DIR, `${cloudLookup.uid}.json`), JSON.stringify(cachedProfile, null, 2), 'utf8');
                } catch (_) {}
            }
            return {
                uid: cloudLookup.uid || null,
                email: cloudLookup.authEmail || `${cleanMobile}@esevadraft.in`,
                role: cloudLookup.role || 'operator',
                displayName: cloudLookup.displayName || 'மையம்',
                mobileNumber: cloudLookup.mobileNumber || cleanMobile
            };
        }
    }
    return null;
}

module.exports = {
    saveUserProfile,
    deleteUserProfile,
    getUserProfile,
    lookupUserByMobile,
    saveActiveOperatorSession,
    getActiveOperatorSession,
    clearActiveOperatorSession
};
