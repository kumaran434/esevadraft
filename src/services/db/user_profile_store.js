// =========================================================================
// User Profile Store (eSeva Operators & Admins)
// =========================================================================
const fs = require('fs');
const path = require('path');
const { getFirestoreInstance, isFirestoreAvailable } = require('./firestore_client');

const USERS_COLLECTION = 'eseva_users';
const LOCAL_USERS_DIR = path.join(__dirname, '..', '..', '..', 'data', 'users');
if (!fs.existsSync(LOCAL_USERS_DIR)) {
    try { fs.mkdirSync(LOCAL_USERS_DIR, { recursive: true }); } catch (_) {}
}

async function saveUserProfile(uid, profileData = {}) {
    if (!uid) return null;
    let existing = {};
    try {
        const localFile = path.join(LOCAL_USERS_DIR, `${uid}.json`);
        if (fs.existsSync(localFile)) {
            existing = JSON.parse(fs.readFileSync(localFile, 'utf8'));
        }
    } catch (_) {}

    const roleVal = profileData.role || existing.role || 'operator';
    const isAdminVal = (typeof profileData.isAdmin === 'boolean')
        ? profileData.isAdmin
        : ((typeof existing.isAdmin === 'boolean') ? existing.isAdmin : (roleVal === 'admin'));

    const payload = {
        ...existing,
        ...profileData,
        role: roleVal,
        isAdmin: isAdminVal,
        updatedAt: new Date().toISOString()
    };
    try {
        const localFile = path.join(LOCAL_USERS_DIR, `${uid}.json`);
        fs.writeFileSync(localFile, JSON.stringify(payload, null, 2), 'utf8');
    } catch (_) {}

    setImmediate(async () => {
        const firestore = getFirestoreInstance();
        if (isFirestoreAvailable() && firestore) {
            try {
                await firestore.collection(USERS_COLLECTION).doc(uid).set(payload, { merge: true });
            } catch (e) {
                console.warn(`Firestore save user profile error: ${e.message}`);
            }
        }
    });
    return payload;
}

async function deleteUserProfile(uid) {
    if (!uid) return false;
    try {
        const localFile = path.join(LOCAL_USERS_DIR, `${uid}.json`);
        if (fs.existsSync(localFile)) {
            fs.unlinkSync(localFile);
        }
    } catch (_) {}

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

async function getUserProfile(uid) {
    if (!uid) return null;
    try {
        const localFile = path.join(LOCAL_USERS_DIR, `${uid}.json`);
        if (fs.existsSync(localFile)) {
            return JSON.parse(fs.readFileSync(localFile, 'utf8'));
        }
    } catch (_) {}

    const firestore = getFirestoreInstance();
    if (isFirestoreAvailable() && firestore) {
        try {
            const doc = await firestore.collection(USERS_COLLECTION).doc(uid).get();
            if (doc.exists) {
                return doc.data();
            }
        } catch (e) {
            console.warn(`Firestore get user profile error: ${e.message}`);
        }
    }
    return null;
}

async function lookupUserByMobile(mobileNumber) {
    if (!mobileNumber) return null;
    const cleanMobile = String(mobileNumber).replace(/\D/g, '');
    if (cleanMobile.length !== 10) return null;

    try {
        if (fs.existsSync(LOCAL_USERS_DIR)) {
            const files = fs.readdirSync(LOCAL_USERS_DIR);
            for (const f of files) {
                if (f.endsWith('.json')) {
                    const data = JSON.parse(fs.readFileSync(path.join(LOCAL_USERS_DIR, f), 'utf8'));
                    if (data.mobileNumber === cleanMobile || (data.email && data.email.includes(cleanMobile))) {
                        return data;
                    }
                }
            }
        }
    } catch (_) {}

    const firestore = getFirestoreInstance();
    if (isFirestoreAvailable() && firestore) {
        try {
            const snap = await firestore.collection(USERS_COLLECTION)
                .where('mobileNumber', '==', cleanMobile)
                .limit(1)
                .get();
            if (!snap.empty) {
                return snap.docs[0].data();
            }
        } catch (e) {
            console.warn(`Firestore lookupUserByMobile error: ${e.message}`);
        }
    }
    return null;
}

module.exports = {
    saveUserProfile,
    deleteUserProfile,
    getUserProfile,
    lookupUserByMobile
};
