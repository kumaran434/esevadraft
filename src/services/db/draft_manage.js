// =========================================================================
// Citizen Draft Management (List, Trash, Restore, Delete)
// =========================================================================
const fs = require('fs');
const path = require('path');
const {
    LOCAL_DRAFTS_DIR,
    APPDATA_DRAFTS_DIR,
    STORAGE_BUCKET,
    COLLECTION_NAME,
    normalizeOperatorUid,
    getFirestoreInstance,
    isFirestoreAvailable,
    isStorageAvailable
} = require('./firestore_client');

const SYNTHETIC_TEST_MOBILES = new Set([
    '9790170099', '9840011223', '9111223344', '9333222111', '9444332211',
    '9555444333', '9777666555', '9876500050', '9991112244', '9998881122',
    '9123456780', '9955553661', '9999999999', '9999999988', '911133222111'
]);

function isMeaningfulDraft(d) {
    if (!d || !d.mobileNumber) return false;
    const cleanMob = String(d.mobileNumber).trim();
    if (cleanMob.startsWith('walkin_')) return false;
    const isTestRun = process.env.REGRESSION_TEST === 'true' || process.env.NODE_ENV === 'test';
    if (!isTestRun) {
        if (/^99999000\d{2}$/.test(cleanMob) || SYNTHETIC_TEST_MOBILES.has(cleanMob)) return false;
        const profCheck = d.citizenProfile || {};
        const hAadhaar = String(profCheck.headAadhaar || d.headAadhaar || '').replace(/\D/g, '');
        if (hAadhaar === '123456789012' || hAadhaar === '987654321012') return false;
    }
    const prof = d.citizenProfile || {};
    const hasName = !!((prof.fullNameTam && prof.fullNameTam.trim()) || (prof.fullNameEng && prof.fullNameEng.trim()) || (d.name && d.name.trim() && !d.name.startsWith('வாடிக்கையாளர் (+91')));
    const hasAadhaar = !!(prof.headAadhaar && prof.headAadhaar.trim());
    const hasMembers = Array.isArray(prof.members) && prof.members.length > 0;
    const hasSubService = !!(prof.subServiceData || prof.tempMember);
    const hasDocs = (d.documents && Object.keys(d.documents).some(k => !!d.documents[k])) ||
                    (d.base64Docs && Object.keys(d.base64Docs).length > 0) ||
                    (prof.documents && Object.keys(prof.documents).some(k => !!prof.documents[k]));
    const hasAppNo = !!d.applicationNumber;
    const hasCan = !!(prof.canNumber || d.canNumber);

    return hasName || hasAadhaar || hasMembers || hasSubService || hasDocs || hasAppNo || hasCan;
}

function extractDraftDisplayName(d) {
    if (!d) return 'வாடிக்கையாளர்';
    const prof = d.citizenProfile || {};
    const tam = prof.fullNameTam && prof.fullNameTam !== 'வாடிக்கையாளர்' ? prof.fullNameTam.trim() : '';
    const eng = prof.fullNameEng && prof.fullNameEng !== 'வாடிக்கையாளர்' ? prof.fullNameEng.trim() : '';
    if (tam) return tam;
    if (eng) return eng;

    const sub = prof.subServiceData || prof.tempMember;
    if (sub) {
        const subTam = (sub.memberNameTam || sub.nameTam) && (sub.memberNameTam !== 'வாடிக்கையாளர்' && sub.nameTam !== 'வாடிக்கையாளர்') ? (sub.memberNameTam || sub.nameTam).trim() : '';
        const subEng = (sub.memberNameEng || sub.nameEng || sub.memberName || sub.name) && (sub.memberNameEng !== 'வாடிக்கையாளர்' && sub.nameEng !== 'வாடிக்கையாளர்') ? (sub.memberNameEng || sub.nameEng || sub.memberName || sub.name).trim() : '';
        if (subTam) return subTam;
        if (subEng) return subEng;
    }

    if (Array.isArray(prof.members) && prof.members.length > 0) {
        for (const m of prof.members) {
            const mTam = m.nameTam && m.nameTam !== 'வாடிக்கையாளர்' ? m.nameTam.trim() : '';
            const mEng = (m.nameEng || m.name) && (m.nameEng !== 'வாடிக்கையாளர்' && m.name !== 'வாடிக்கையாளர்') ? (m.nameEng || m.name).trim() : '';
            if (mTam) return mTam;
            if (mEng) return mEng;
        }
    }

    if (d.name && d.name !== 'வாடிக்கையாளர்' && !d.name.startsWith('வாடிக்கையாளர் (+91')) {
        return d.name.trim();
    }
    return 'வாடிக்கையாளர்';
}

function extractDraftServiceName(d) {
    if (!d) return 'புதிய குடும்ப அட்டை';
    const prof = d.citizenProfile || {};
    const sub = prof.subService || d.subService || (prof.subServiceData && prof.subServiceData.subService);
    if (sub === 'ADD_MEMBER') return 'குடும்ப உறுப்பினர் சேர்க்கை';
    if (sub === 'REMOVE_MEMBER') return 'குடும்ப உறுப்பினர் நீக்கம்';
    if (sub === 'ADDRESS_CHANGE' || sub === 'CHANGE_ADDRESS') return 'முகவரி மாற்றம்';
    if (prof.subServiceData && prof.subServiceData.reason) return 'குடும்ப உறுப்பினர் நீக்கம்';
    if (prof.subServiceData && (prof.subServiceData.memberName || prof.subServiceData.smartCardNumber)) return 'குடும்ப உறுப்பினர் சேர்க்கை';
    if (d.serviceName) return d.serviceName;
    if (prof.canNumber || d.canNumber) return 'TNeGA வருவாய் சேவை';
    return 'புதிய குடும்ப அட்டை';
}

async function listAllDrafts(operatorUid = null) {
    const drafts = [];
    const seenMobiles = new Set();
    const targetUid = operatorUid ? String(operatorUid).trim() : null;
    const normTarget = normalizeOperatorUid(targetUid);
    const isTestRun = process.env.REGRESSION_TEST === 'true' || process.env.NODE_ENV === 'test';

    // STRICT ZERO-LEAKAGE BOUNDARY: In production, unauthenticated requests without operatorUid get 0 drafts!
    if (!normTarget && !isTestRun) {
        return [];
    }

    const isDesktopLocal = !process.env.K_SERVICE && !process.env.GAE_SERVICE;

    // 1. FAST LOCAL DISK FIRST (0ms Latency - Instant Operator Desk & Search)
    const localDirs = [APPDATA_DRAFTS_DIR, LOCAL_DRAFTS_DIR].filter(d => d && fs.existsSync(d));
    for (const dir of localDirs) {
        try {
            const files = fs.readdirSync(dir);
            files.forEach(f => {
                if (f.endsWith('.json')) {
                    const mob = f.replace('.json', '');
                    try {
                        const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
                        if (!isMeaningfulDraft(d)) return;
                        const normDocOp = normalizeOperatorUid(d.operatorUid);
                        // STRICT TENANT BOUNDARY: When operator is specified, ONLY return drafts strictly belonging to them!
                        // Drafts with null operatorUid or different operatorUid are strictly blocked!
                        if (normTarget) {
                            if (!normDocOp || normDocOp !== normTarget) return;
                        }

                        const prof = d.citizenProfile || {};
                        const name = extractDraftDisplayName(d);
                        const draftEntry = {
                            mobileNumber: mob,
                            operatorUid: d.operatorUid || null,
                            name: name,
                            serviceName: extractDraftServiceName(d),
                            subService: prof.subService || d.subService || (prof.subServiceData && prof.subServiceData.subService) || null,
                            membersCount: (prof.members && prof.members.length) || 1,
                            district: prof.district || '—',
                            taluk: prof.taluk || '—',
                            status: d.status || 'DRAFT_SAVED',
                            isDeleted: !!(d.isDeleted || d.status === 'TRASHED'),
                            trashedAt: d.trashedAt || null,
                            applicationNumber: d.applicationNumber || null,
                            canNumber: prof.canNumber || d.canNumber || null,
                            headAadhaar: prof.headAadhaar || d.headAadhaar || null,
                            lastUpdated: d.lastUpdated
                        };

                        if (!seenMobiles.has(mob)) {
                            seenMobiles.add(mob);
                            drafts.push(draftEntry);
                        } else {
                            // If already seen, replace if current file has richer data
                            const existingIdx = drafts.findIndex(x => x.mobileNumber === mob);
                            if (existingIdx !== -1) {
                                const current = drafts[existingIdx];
                                const hasBetterDistrict = (current.district === '—' || !current.district) && prof.district && prof.district !== '—';
                                const hasBetterTaluk = (current.taluk === '—' || !current.taluk) && prof.taluk && prof.taluk !== '—';
                                const hasBetterName = (current.name === 'வாடிக்கையாளர்' || !current.name) && name && name !== 'வாடிக்கையாளர்';
                                if (hasBetterDistrict || hasBetterTaluk || hasBetterName) {
                                    drafts[existingIdx] = draftEntry;
                                }
                            }
                        }
                    } catch (_) {}
                }
            });
        } catch (_) {}
    }

    // 2. CLOUD FIRESTORE FALLBACK (Only when local disk is empty e.g. new PC login, or running on pure web cloud)
    const shouldFetchCloudSync = (!isDesktopLocal) || (drafts.length === 0);
    const firestore = getFirestoreInstance();

    if (shouldFetchCloudSync && isFirestoreAvailable() && firestore) {
        try {
            const col = firestore.collection(COLLECTION_NAME);
            const fetchPromise = col.get();
            const snapshot = isDesktopLocal 
                ? await Promise.race([
                    fetchPromise,
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Cloud sync timeout in desktop local mode')), 1500))
                  ])
                : await fetchPromise;
            snapshot.forEach(doc => {
                const d = doc.data();
                if (!isMeaningfulDraft(d)) {
                    col.doc(doc.id).delete().catch(() => {});
                    return;
                }
                const normDocOp = normalizeOperatorUid(d.operatorUid);
                // STRICT TENANT BOUNDARY: Cloud drafts belong to specific operators.
                if (normTarget) {
                    if (!normDocOp || normDocOp !== normTarget) return;
                }

                // Ensure Cloud draft is also cached to the local disk directory ONLY IF owned by target operator!
                if (!d.isDeleted && d.status !== 'TRASHED' && d.mobileNumber) {
                    const isDesktopApp = !!(process.versions.electron || process.env.DESKTOP_RUNTIME === '1' || process.env.IS_DESKTOP);
                    const targetLocalDir = (isDesktopApp && APPDATA_DRAFTS_DIR && fs.existsSync(APPDATA_DRAFTS_DIR)) ? APPDATA_DRAFTS_DIR : LOCAL_DRAFTS_DIR;
                    const localTargetFile = path.join(targetLocalDir, `${d.mobileNumber}.json`);
                    if (!fs.existsSync(localTargetFile)) {
                        try { fs.writeFileSync(localTargetFile, JSON.stringify(d, null, 2), 'utf8'); } catch (_) {}
                    }
                }

                if (!seenMobiles.has(d.mobileNumber)) {
                    seenMobiles.add(d.mobileNumber);
                    const prof = d.citizenProfile || {};
                    const name = extractDraftDisplayName(d);
                    drafts.push({
                        mobileNumber: d.mobileNumber,
                        operatorUid: d.operatorUid || null,
                        name: name,
                        serviceName: extractDraftServiceName(d),
                        subService: prof.subService || d.subService || (prof.subServiceData && prof.subServiceData.subService) || null,
                        membersCount: (prof.members && prof.members.length) || 1,
                        district: prof.district || '—',
                        taluk: prof.taluk || '—',
                        status: d.status || 'DRAFT_SAVED',
                        isDeleted: !!(d.isDeleted || d.status === 'TRASHED'),
                        trashedAt: d.trashedAt || null,
                        applicationNumber: d.applicationNumber || null,
                        canNumber: prof.canNumber || d.canNumber || null,
                        headAadhaar: prof.headAadhaar || d.headAadhaar || null,
                        lastUpdated: d.lastUpdated
                    });
                }
            });
        } catch (e) {
            console.warn('Failed to list Firestore drafts:', e.message);
        }
    } else if (isFirestoreAvailable() && firestore) {
        // WhatsApp Desktop Standard: Local drafts returned immediately; silent background sync to local disk
        setImmediate(async () => {
            try {
                const col = firestore.collection(COLLECTION_NAME);
                const snapshot = await col.get();
                snapshot.forEach(doc => {
                    const d = doc.data();
                    if (d && !d.isDeleted && d.status !== 'TRASHED' && d.mobileNumber) {
                        const normDocOp = normalizeOperatorUid(d.operatorUid);
                        // STRICT TENANT BOUNDARY: NEVER cache another operator's draft to local disk!
                        if (normTarget && normDocOp !== normTarget) return;

                        const isDesktopApp = !!(process.versions.electron || process.env.DESKTOP_RUNTIME === '1' || process.env.IS_DESKTOP);
                        const targetLocalDir = (isDesktopApp && APPDATA_DRAFTS_DIR && fs.existsSync(APPDATA_DRAFTS_DIR)) ? APPDATA_DRAFTS_DIR : LOCAL_DRAFTS_DIR;
                        const localTargetFile = path.join(targetLocalDir, `${d.mobileNumber}.json`);
                        if (!fs.existsSync(localTargetFile)) {
                            try { fs.writeFileSync(localTargetFile, JSON.stringify(d, null, 2), 'utf8'); } catch (_) {}
                        }
                    }
                });
            } catch (_) {}
        });
    }

    return drafts.sort((a, b) => new Date(b.lastUpdated || 0) - new Date(a.lastUpdated || 0));
}

async function trashCitizenDraft(mobileNumber) {
    if (!mobileNumber) return false;
    const cleanMobile = String(mobileNumber).trim();
    const nowIso = new Date().toISOString();

    const firestore = getFirestoreInstance();
    if (isFirestoreAvailable() && firestore) {
        try {
            await firestore.collection(COLLECTION_NAME).doc(cleanMobile).set({
                isDeleted: true,
                status: 'TRASHED',
                trashedAt: nowIso,
                lastUpdated: nowIso
            }, { merge: true });
        } catch (e) {
            console.warn(`Firestore trash error: ${e.message}`);
        }
    }

    try {
        const filesToTrash = [
            path.join(LOCAL_DRAFTS_DIR, `${cleanMobile}.json`),
            APPDATA_DRAFTS_DIR ? path.join(APPDATA_DRAFTS_DIR, `${cleanMobile}.json`) : null
        ].filter(Boolean);
        for (const file of filesToTrash) {
            if (fs.existsSync(file)) {
                const draft = JSON.parse(fs.readFileSync(file, 'utf8'));
                draft.isDeleted = true;
                draft.status = 'TRASHED';
                draft.trashedAt = nowIso;
                draft.lastUpdated = nowIso;
                fs.writeFileSync(file, JSON.stringify(draft, null, 2), 'utf8');
            }
        }
    } catch (e) {
        console.warn(`Local file trash error: ${e.message}`);
    }

    return true;
}

async function restoreCitizenDraft(mobileNumber) {
    if (!mobileNumber) return false;
    const cleanMobile = String(mobileNumber).trim();
    const nowIso = new Date().toISOString();

    const firestore = getFirestoreInstance();
    if (isFirestoreAvailable() && firestore) {
        try {
            await firestore.collection(COLLECTION_NAME).doc(cleanMobile).set({
                isDeleted: false,
                status: 'DRAFT_SAVED',
                trashedAt: null,
                lastUpdated: nowIso
            }, { merge: true });
        } catch (e) {
            console.warn(`Firestore restore error: ${e.message}`);
        }
    }

    try {
        const filesToRestore = [
            path.join(LOCAL_DRAFTS_DIR, `${cleanMobile}.json`),
            APPDATA_DRAFTS_DIR ? path.join(APPDATA_DRAFTS_DIR, `${cleanMobile}.json`) : null
        ].filter(Boolean);
        for (const file of filesToRestore) {
            if (fs.existsSync(file)) {
                const draft = JSON.parse(fs.readFileSync(file, 'utf8'));
                draft.isDeleted = false;
                draft.status = 'DRAFT_SAVED';
                draft.trashedAt = null;
                draft.lastUpdated = nowIso;
                fs.writeFileSync(file, JSON.stringify(draft, null, 2), 'utf8');
            }
        }
    } catch (e) {
        console.warn(`Local file restore error: ${e.message}`);
    }

    return true;
}

async function deleteCitizenDraft(mobileNumber, options = {}) {
    if (!mobileNumber) return false;
    const cleanDigits = String(mobileNumber).replace(/\D/g, '').slice(-10);
    const rawKey = String(mobileNumber).trim();
    const keysToClean = Array.from(new Set([
        cleanDigits, 
        rawKey, 
        `+91${cleanDigits}`, 
        `+91 ${cleanDigits}`,
        `91${cleanDigits}`
    ].filter(Boolean)));

    const firestore = getFirestoreInstance();
    if (isFirestoreAvailable() && firestore) {
        for (const k of keysToClean) {
            try {
                await firestore.collection(COLLECTION_NAME).doc(k).delete();
            } catch (e) {
                console.warn(`Firestore delete error: ${e.message}`);
            }
        }
    }

    // 0. Collect all physical document and photo file paths owned by this customer before deleting JSON
    const filesToPurge = new Set();
    const draftDirCandidates = [
        LOCAL_DRAFTS_DIR,
        APPDATA_DRAFTS_DIR,
        path.join(__dirname, '..', '..', '..', 'data', 'drafts'),
        path.join(process.cwd(), 'data', 'drafts'),
        path.join(process.env.APPDATA || 'C:\\Users\\ADMIN\\AppData\\Roaming', 'esevadraft-desktop', 'data', 'drafts'),
        path.join(process.env.LOCALAPPDATA || 'C:\\Users\\ADMIN\\AppData\\Local', 'Programs', 'eSevaDraft Desktop', 'resources', 'data', 'drafts')
    ].filter(Boolean);

    for (const dDir of draftDirCandidates) {
        for (const k of keysToClean) {
            const fPath = path.join(dDir, `${k}.json`);
            if (fs.existsSync(fPath)) {
                try {
                    const parsed = JSON.parse(fs.readFileSync(fPath, 'utf8'));
                    const prof = parsed.citizenProfile || {};
                    const docs = parsed.documents || prof.documents || {};
                    if (prof.headPhotoPath) filesToPurge.add(prof.headPhotoPath);
                    if (prof.headAadhaarDocPath) filesToPurge.add(prof.headAadhaarDocPath);
                    if (prof.residenceProof?.docPath) filesToPurge.add(prof.residenceProof.docPath);
                    if (prof.gasDetails?.gasBookPath) filesToPurge.add(prof.gasDetails.gasBookPath);
                    for (const dp of Object.values(docs)) {
                        if (typeof dp === 'string') filesToPurge.add(dp);
                    }
                    if (Array.isArray(prof.members)) {
                        for (const m of prof.members) {
                            if (m.docPath) filesToPurge.add(m.docPath);
                        }
                    }
                } catch (_) {}
            }
        }
    }

    // Delete collected physical files so stale photos/PDFs never linger on disk
    for (const fp of filesToPurge) {
        if (fp && typeof fp === 'string' && fs.existsSync(fp)) {
            const base = path.basename(fp).toLowerCase();
            if (base.startsWith('test_') || base.includes('sample')) continue;
            try { fs.unlinkSync(fp); } catch (_) {}
        }
    }

    // 1. Delete all Draft JSON files across every known disk location
    for (const dDir of draftDirCandidates) {
        for (const k of keysToClean) {
            const fPath = path.join(dDir, `${k}.json`);
            if (fs.existsSync(fPath)) {
                try { fs.unlinkSync(fPath); } catch (_) {}
            }
        }
    }

    // 1b. Delete all Citizen JSON files across every known disk location
    const citizenDirCandidates = [
        path.join(__dirname, '..', '..', '..', 'data', 'citizens'),
        path.join(process.cwd(), 'data', 'citizens'),
        path.join(process.env.APPDATA || 'C:\\Users\\ADMIN\\AppData\\Roaming', 'esevadraft-desktop', 'data', 'citizens'),
        path.join(process.env.LOCALAPPDATA || 'C:\\Users\\ADMIN\\AppData\\Local', 'Programs', 'eSevaDraft Desktop', 'resources', 'data', 'citizens')
    ].filter(Boolean);

    for (const cDir of citizenDirCandidates) {
        for (const k of keysToClean) {
            const fPath = path.join(cDir, `${k}.json`);
            if (fs.existsSync(fPath)) {
                try { fs.unlinkSync(fPath); } catch (_) {}
            }
        }
    }

    // 1c. Also remove from citizens.json single database file if present
    const singleCitizensFiles = [
        path.join(__dirname, '..', '..', '..', 'data', 'citizens.json'),
        path.join(process.cwd(), 'data', 'citizens.json'),
        path.join(process.env.APPDATA || 'C:\\Users\\ADMIN\\AppData\\Roaming', 'esevadraft-desktop', 'data', 'citizens.json')
    ].filter(Boolean);
    for (const cFile of singleCitizensFiles) {
        if (fs.existsSync(cFile)) {
            try {
                const cData = JSON.parse(fs.readFileSync(cFile, 'utf8'));
                let changed = false;
                for (const k of keysToClean) {
                    if (cData[k]) {
                        delete cData[k];
                        changed = true;
                    }
                }
                if (changed) {
                    fs.writeFileSync(cFile, JSON.stringify(cData, null, 2), 'utf8');
                }
            } catch (_) {}
        }
    }

    // 2. Delete all Upload Folders and files across every known disk location (unless preserveUploads requested)
    if (!options || !options.preserveUploads) {
        const uploadDirCandidates = [
            path.join(__dirname, '..', '..', '..', 'data', 'uploads'),
            path.join(__dirname, '..', '..', '..', 'uploads'),
            path.join(process.cwd(), 'data', 'uploads'),
            path.join(process.cwd(), 'uploads'),
            path.join(process.env.APPDATA || 'C:\\Users\\ADMIN\\AppData\\Roaming', 'esevadraft-desktop', 'data', 'uploads'),
            path.join(process.env.APPDATA || 'C:\\Users\\ADMIN\\AppData\\Roaming', 'esevadraft-desktop', 'uploads'),
            path.join(process.env.LOCALAPPDATA || 'C:\\Users\\ADMIN\\AppData\\Local', 'Programs', 'eSevaDraft Desktop', 'resources', 'data', 'uploads'),
            path.join(process.env.LOCALAPPDATA || 'C:\\Users\\ADMIN\\AppData\\Local', 'Programs', 'eSevaDraft Desktop', 'resources', 'uploads')
        ].filter(Boolean);

        for (const uBase of uploadDirCandidates) {
            for (const k of keysToClean) {
                const uDir = path.join(uBase, k);
                if (fs.existsSync(uDir)) {
                    try { fs.rmSync(uDir, { recursive: true, force: true }); } catch (_) {}
                }
            }
        }
    }

    // 3. Purge citizens.json, citizens.json.bak, sessions.json, and sessions.json.bak
    const metaFiles = [
        path.join(__dirname, '..', '..', '..', 'data', 'citizens.json'),
        path.join(__dirname, '..', '..', '..', 'data', 'citizens.json.bak'),
        path.join(__dirname, '..', '..', '..', 'data', 'sessions.json'),
        path.join(__dirname, '..', '..', '..', 'data', 'sessions.json.bak'),
        path.join(process.env.APPDATA || 'C:\\Users\\ADMIN\\AppData\\Roaming', 'esevadraft-desktop', 'data', 'citizens.json'),
        path.join(process.env.APPDATA || 'C:\\Users\\ADMIN\\AppData\\Roaming', 'esevadraft-desktop', 'data', 'citizens.json.bak'),
        path.join(process.env.APPDATA || 'C:\\Users\\ADMIN\\AppData\\Roaming', 'esevadraft-desktop', 'data', 'sessions.json'),
        path.join(process.env.APPDATA || 'C:\\Users\\ADMIN\\AppData\\Roaming', 'esevadraft-desktop', 'data', 'sessions.json.bak'),
        path.join(process.env.LOCALAPPDATA || 'C:\\Users\\ADMIN\\AppData\\Local', 'Programs', 'eSevaDraft Desktop', 'resources', 'data', 'citizens.json'),
        path.join(process.env.LOCALAPPDATA || 'C:\\Users\\ADMIN\\AppData\\Local', 'Programs', 'eSevaDraft Desktop', 'resources', 'data', 'citizens.json.bak'),
        path.join(process.env.LOCALAPPDATA || 'C:\\Users\\ADMIN\\AppData\\Local', 'Programs', 'eSevaDraft Desktop', 'resources', 'data', 'sessions.json'),
        path.join(process.env.LOCALAPPDATA || 'C:\\Users\\ADMIN\\AppData\\Local', 'Programs', 'eSevaDraft Desktop', 'resources', 'data', 'sessions.json.bak')
    ];
    for (const mf of metaFiles) {
        if (fs.existsSync(mf)) {
            try {
                const data = JSON.parse(fs.readFileSync(mf, 'utf8'));
                let changed = false;
                for (const k of keysToClean) {
                    if (data[k]) { delete data[k]; changed = true; }
                }
                if (changed) fs.writeFileSync(mf, JSON.stringify(data, null, 2), 'utf8');
            } catch (_) {}
        }
    }

    // 3b. Purge aadhaar_citizen_index.json entries belonging to this customer
    const aadhaarIdxFiles = [
        path.join(__dirname, '..', '..', '..', 'data', 'aadhaar_citizen_index.json'),
        path.join(process.env.APPDATA || 'C:\\Users\\ADMIN\\AppData\\Roaming', 'esevadraft-desktop', 'data', 'aadhaar_citizen_index.json'),
        path.join(process.env.LOCALAPPDATA || 'C:\\Users\\ADMIN\\AppData\\Local', 'Programs', 'eSevaDraft Desktop', 'resources', 'data', 'aadhaar_citizen_index.json')
    ];
    for (const aif of aadhaarIdxFiles) {
        if (fs.existsSync(aif)) {
            try {
                const idx = JSON.parse(fs.readFileSync(aif, 'utf8'));
                let changed = false;
                for (const [aadhaarKey, entry] of Object.entries(idx)) {
                    if (entry && keysToClean.includes(String(entry.mobileNumber || '').trim())) {
                        delete idx[aadhaarKey];
                        changed = true;
                    }
                }
                if (changed) fs.writeFileSync(aif, JSON.stringify(idx, null, 2), 'utf8');
            } catch (_) {}
        }
    }

    // 3c. Purge applications/ JSON files belonging to this customer
    const appDirs = [
        path.join(__dirname, '..', '..', '..', 'data', 'applications'),
        path.join(process.env.APPDATA || 'C:\\Users\\ADMIN\\AppData\\Roaming', 'esevadraft-desktop', 'data', 'applications'),
        path.join(process.env.LOCALAPPDATA || 'C:\\Users\\ADMIN\\AppData\\Local', 'Programs', 'eSevaDraft Desktop', 'resources', 'data', 'applications')
    ];
    for (const ad of appDirs) {
        if (fs.existsSync(ad)) {
            try {
                const files = fs.readdirSync(ad).filter(f => f.endsWith('.json'));
                for (const f of files) {
                    const fp = path.join(ad, f);
                    try {
                        const appObj = JSON.parse(fs.readFileSync(fp, 'utf8'));
                        if (appObj && keysToClean.includes(String(appObj.mobileNumber || '').trim())) {
                            fs.unlinkSync(fp);
                        }
                    } catch (_) {}
                }
            } catch (_) {}
        }
    }

    // 3d. Purge checkpoints/ JSON files belonging to this customer
    const checkpointDirs = [
        path.join(__dirname, '..', '..', '..', 'data', 'checkpoints'),
        path.join(process.env.APPDATA || 'C:\\Users\\ADMIN\\AppData\\Roaming', 'esevadraft-desktop', 'data', 'checkpoints'),
        path.join(process.env.LOCALAPPDATA || 'C:\\Users\\ADMIN\\AppData\\Local', 'Programs', 'eSevaDraft Desktop', 'resources', 'data', 'checkpoints')
    ];
    for (const cd of checkpointDirs) {
        if (fs.existsSync(cd)) {
            try {
                const files = fs.readdirSync(cd).filter(f => f.endsWith('.json'));
                for (const f of files) {
                    if (keysToClean.some(k => f.startsWith(`${k}_`) || f === `${k}.json`)) {
                        try { fs.unlinkSync(path.join(cd, f)); } catch (_) {}
                    }
                }
            } catch (_) {}
        }
    }

    // 4. Purge in-memory sessions
    try {
        const storageService = require('../storage_service');
        if (storageService && typeof storageService.purgeSession === 'function') {
            for (const k of keysToClean) storageService.purgeSession(k);
        }
    } catch (_) {}

    return true;
}

function migrateCustomerUploads(oldMobile, newMobile) {
    if (!oldMobile || !newMobile) return false;
    const cleanOld = String(oldMobile).replace(/\D/g, '').slice(-10);
    const cleanNew = String(newMobile).replace(/\D/g, '').slice(-10);
    if (!cleanOld || !cleanNew || cleanOld === cleanNew) return false;

    const uploadDirCandidates = [
        path.join(__dirname, '..', '..', '..', 'data', 'uploads'),
        path.join(__dirname, '..', '..', '..', 'uploads'),
        path.join(process.cwd(), 'data', 'uploads'),
        path.join(process.cwd(), 'uploads'),
        path.join(process.env.APPDATA || 'C:\\Users\\ADMIN\\AppData\\Roaming', 'esevadraft-desktop', 'data', 'uploads'),
        path.join(process.env.APPDATA || 'C:\\Users\\ADMIN\\AppData\\Roaming', 'esevadraft-desktop', 'uploads'),
        path.join(process.env.LOCALAPPDATA || 'C:\\Users\\ADMIN\\AppData\\Local', 'Programs', 'eSevaDraft Desktop', 'resources', 'data', 'uploads'),
        path.join(process.env.LOCALAPPDATA || 'C:\\Users\\ADMIN\\AppData\\Local', 'Programs', 'eSevaDraft Desktop', 'resources', 'uploads')
    ].filter(Boolean);

    for (const uBase of uploadDirCandidates) {
        const oldDir = path.join(uBase, cleanOld);
        const newDir = path.join(uBase, cleanNew);
        if (fs.existsSync(oldDir)) {
            if (!fs.existsSync(newDir)) {
                try { fs.mkdirSync(newDir, { recursive: true }); } catch (_) {}
            }
            try {
                const files = fs.readdirSync(oldDir);
                for (const file of files) {
                    const src = path.join(oldDir, file);
                    const dest = path.join(newDir, file);
                    if (fs.existsSync(src) && !fs.existsSync(dest)) {
                        try { fs.copyFileSync(src, dest); } catch (_) {}
                    }
                }
            } catch (_) {}
        }
    }
    return true;
}

module.exports = {
    isMeaningfulDraft,
    listAllDrafts,
    trashCitizenDraft,
    restoreCitizenDraft,
    deleteCitizenDraft,
    migrateCustomerUploads
};
