const fs = require('fs');
const path = require('path');
const { resolveTnDistrict } = require('./tn_district_mapper');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const dbFilePath = path.join(dataDir, 'citizens.json');
const dbBackupPath = path.join(dataDir, 'citizens.json.bak');
const draftsDir = path.join(dataDir, 'drafts');
const appDataDraftsDir = path.join(process.env.APPDATA || 'C:\\Users\\ADMIN\\AppData\\Roaming', 'esevadraft-desktop', 'data', 'drafts');

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

function findDraftFile(cleanMob) {
    const fileName = `${cleanMob}.json`;
    const localP = path.join(draftsDir, fileName);
    if (fs.existsSync(localP)) return localP;
    const appDataP = path.join(appDataDraftsDir, fileName);
    if (fs.existsSync(appDataP)) return appDataP;
    return null;
}

function maskAadhaar(aadhaar) {
    if (!aadhaar || typeof aadhaar !== 'string') return aadhaar || '';
    const clean = String(aadhaar).replace(/\D/g, '');
    if (clean.length === 12) {
        return `XXXX-XXXX-${clean.slice(8)}`;
    }
    return aadhaar;
}

// Clean fresh initial database (no demo data)
const initialDatabase = {};

function loadDatabase() {
    try {
        if (!fs.existsSync(dbFilePath)) {
            safeWriteJsonSync(dbFilePath, initialDatabase);
            return initialDatabase;
        }
        const data = fs.readFileSync(dbFilePath, 'utf-8');
        if (!data || !data.trim()) {
            throw new Error('citizens.json is empty');
        }
        return JSON.parse(data);
    } catch (e) {
        console.error('Error loading database, attempting backup restore:', e.message);
        if (fs.existsSync(dbBackupPath)) {
            try {
                const bakData = fs.readFileSync(dbBackupPath, 'utf-8');
                const parsedBak = JSON.parse(bakData);
                console.log('🛡️ [Database Rescue] Successfully recovered citizens database from citizens.json.bak!');
                safeWriteJsonSync(dbFilePath, parsedBak);
                return parsedBak;
            } catch (bakErr) {
                console.error('Backup rescue failed:', bakErr.message);
            }
        }
        return initialDatabase;
    }
}

function saveDatabase(db) {
    try {
        const success = safeWriteJsonSync(dbFilePath, db);
        if (success) {
            try { fs.copyFileSync(dbFilePath, dbBackupPath); } catch (_) {}
        }
        return success;
    } catch (e) {
        console.error('Error saving database:', e.message);
        return false;
    }
}

function getCitizenProfile(mobileNumber) {
    if (!mobileNumber) return null;
    const cleanMob = String(mobileNumber).trim();
    const isTestEnv = !!(process.env.ESEVA_TEST_MODE === '1' || process.argv.some(a => a.includes('test')));
    const filterDummyProfile = (prof) => {
        if (!prof || isTestEnv) return prof;
        const aadh = String(prof.headAadhaar || prof.aadhaarNumber || '').replace(/\D/g, '');
        if (aadh === '123456789012' || aadh === '987654321012') return null;
        return prof;
    };
    // 1. Check drafts directory first (primary single source of truth across workspace & AppData)
    const draftPath = findDraftFile(cleanMob);
    if (draftPath) {
        try {
            const draft = JSON.parse(fs.readFileSync(draftPath, 'utf8'));
            if (draft && draft.citizenProfile) {
                return filterDummyProfile(draft.citizenProfile);
            }
        } catch (_) {}
    }
    // 2. Fall back to citizens.json
    const db = loadDatabase();
    return filterDummyProfile(db[cleanMob] || null);
}

function saveCitizenProfile(mobileNumber, profileData) {
    if (!mobileNumber) return null;
    const cleanMob = String(mobileNumber).trim();
    const db = loadDatabase();
    const cleanData = { ...profileData };
    if (cleanData.district || cleanData.taluk || cleanData.village || cleanData.pincode) {
        const fullAddr = [cleanData.streetEng, cleanData.streetTam, cleanData.areaEng, cleanData.areaTam].filter(Boolean).join(' ');
        const resolved = resolveTnDistrict(cleanData.district, cleanData.taluk, cleanData.village, cleanData.pincode, fullAddr);
        cleanData.district = resolved.district;
        cleanData.districtTam = resolved.districtTam;
        if (resolved.taluk) cleanData.taluk = resolved.taluk;
        if (resolved.talukTam) cleanData.talukTam = resolved.talukTam;
        if (resolved.village && (!cleanData.village || resolved.wasAutoCorrected)) {
            cleanData.village = resolved.village;
            if (resolved.villageTam) cleanData.villageTam = resolved.villageTam;
        }
        if (resolved.wasAutoCorrected) {
            cleanData.districtAutoCorrected = true;
            cleanData.districtCorrectionReason = resolved.reason;
        }
    }
    db[cleanMob] = {
        ...(db[cleanMob] || {}),
        ...cleanData,
        isExtracted: true,
        lastUpdated: new Date().toISOString()
    };
    saveDatabase(db);

    // Also keep local & AppData drafts synchronized if present
    const targetPaths = [path.join(draftsDir, `${cleanMob}.json`), path.join(appDataDraftsDir, `${cleanMob}.json`)];
    for (const dPath of targetPaths) {
        if (fs.existsSync(dPath)) {
            try {
                const draft = JSON.parse(fs.readFileSync(dPath, 'utf8'));
                draft.citizenProfile = { ...(draft.citizenProfile || {}), ...cleanData };
                safeWriteJsonSync(dPath, draft);
            } catch (_) {}
        }
    }

    return db[cleanMob];
}

function addFamilyMember(mobileNumber, memberData) {
    const db = loadDatabase();
    if (!db[mobileNumber]) return null;
    if (!db[mobileNumber].members) db[mobileNumber].members = [];
    db[mobileNumber].members.push(memberData);
    db[mobileNumber].lastUpdated = new Date().toISOString();
    saveDatabase(db);
    return db[mobileNumber];
}

function getCitizenDocuments(mobileNumber) {
    const profile = getCitizenProfile(mobileNumber);
    if (!profile) return [];
    
    const docs = [];
    if (profile.headPhotoPath && fs.existsSync(profile.headPhotoPath)) {
        docs.push({
            id: 'photo',
            title: 'அரசு பாஸ்போர்ட் புகைப்படம்',
            type: 'image/png',
            filename: path.basename(profile.headPhotoPath),
            path: profile.headPhotoPath
        });
    }

    if (profile.residenceProof && fs.existsSync(profile.residenceProof)) {
        docs.push({
            id: 'residence_proof',
            title: 'இருப்பிடச் சான்று ஆவணம்',
            type: profile.residenceProof.endsWith('.pdf') ? 'application/pdf' : 'image/png',
            filename: path.basename(profile.residenceProof),
            path: profile.residenceProof
        });
    }

    if (profile.gasDetails && profile.gasDetails.gasBookPath && fs.existsSync(profile.gasDetails.gasBookPath)) {
        docs.push({
            id: 'gas_book',
            title: 'எரிவாயு இணைப்பு அட்டை / ரசீது',
            type: profile.gasDetails.gasBookPath.endsWith('.pdf') ? 'application/pdf' : 'image/png',
            filename: path.basename(profile.gasDetails.gasBookPath),
            path: profile.gasDetails.gasBookPath
        });
    }

    if (Array.isArray(profile.members)) {
        profile.members.forEach((m, idx) => {
            if (m.aadhaarDocPath && fs.existsSync(m.aadhaarDocPath)) {
                docs.push({
                    id: `member_aadhaar_${idx + 1}`,
                    title: `உறுப்பினர் ஆதார் - ${m.name || m.nameEng || idx + 1}`,
                    type: m.aadhaarDocPath.endsWith('.pdf') ? 'application/pdf' : 'image/png',
                    filename: path.basename(m.aadhaarDocPath),
                    path: m.aadhaarDocPath
                });
            }
        });
    }

    return docs;
}

function getAllCitizensSummary() {
    const db = loadDatabase();
    const citizensMap = new Map();

    // 1. From citizens.json
    Object.values(db).forEach(c => {
        if (c && c.mobileNumber) citizensMap.set(c.mobileNumber, c);
    });

    // 2. Merge drafts from data/drafts/ and AppData drafts
    const scanDirs = [draftsDir, appDataDraftsDir];
    for (const dir of scanDirs) {
        if (fs.existsSync(dir)) {
            try {
                const draftFiles = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
                draftFiles.forEach(df => {
                    try {
                        const d = JSON.parse(fs.readFileSync(path.join(dir, df), 'utf8'));
                        const mob = d.mobileNumber || df.replace('.json', '');
                        const prof = d.citizenProfile || {};
                        citizensMap.set(mob, {
                            fullNameTam: prof.fullNameTam || d.name,
                            fullNameEng: prof.fullNameEng || d.name,
                            mobileNumber: mob,
                            headAadhaar: prof.headAadhaar,
                            district: prof.district,
                            isSubmitted: d.status === 'SUBMITTED',
                            applicationNumber: d.applicationNumber,
                            lastUpdated: d.lastUpdated || prof.lastUpdated
                        });
                    } catch (_) {}
                });
            } catch (_) {}
        }
    }

    const citizens = Array.from(citizensMap.values());
    return {
        totalCitizens: citizens.length,
        totalApplicationsSubmitted: citizens.filter(c => c.applicationNumber || c.isSubmitted).length,
        citizensList: citizens.map(c => ({
            name: c.fullNameTam || c.fullNameEng || 'வாடிக்கையாளர்',
            mobile: c.mobileNumber,
            aadhaar: maskAadhaar(c.headAadhaar),
            district: c.district,
            lastUpdated: c.lastUpdated
        }))
    };
}

function deleteCitizenProfile(mobileNumber) {
    if (!mobileNumber) return false;
    const cleanMob = String(mobileNumber).trim().replace(/\D/g, '').slice(-10);
    const rawKey = String(mobileNumber).trim();
    const keysToClean = Array.from(new Set([cleanMob, rawKey].filter(Boolean)));
    try {
        const db = loadDatabase();
        let changed = false;
        for (const k of keysToClean) {
            if (db[k]) {
                delete db[k];
                changed = true;
            }
        }
        if (changed) {
            saveDatabase(db);
        }
        return true;
    } catch (e) {
        console.error('Error deleting citizen from database:', e.message);
        return false;
    }
}

module.exports = {
    getCitizenProfile,
    saveCitizenProfile,
    deleteCitizenProfile,
    addFamilyMember,
    getCitizenDocuments,
    getAllCitizensSummary,
    loadDatabase,
    maskAadhaar
};

