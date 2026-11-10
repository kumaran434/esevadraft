/**
 * eSevaDraft Citizen Master Service
 * Manages unified Master Citizen Profiles with Multi-Factor Indexing (Mobile, Aadhaar, Smart Card).
 * Adheres to Golden Rule 1 (Purpose-Driven Functional Modularity).
 */

const fs = require('fs');
const path = require('path');
const { getCitizenProfile, saveCitizenProfile } = require('../../../database');
const { LOCAL_DRAFTS_DIR, APPDATA_DRAFTS_DIR } = require('./firestore_client');

const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data');
const CITIZENS_DIR = path.join(DATA_DIR, 'citizens');
const AADHAAR_INDEX_FILE = path.join(DATA_DIR, 'aadhaar_citizen_index.json');

if (!fs.existsSync(CITIZENS_DIR)) {
    try { fs.mkdirSync(CITIZENS_DIR, { recursive: true }); } catch (_) {}
}

function normalizeCleanMobile(val) {
    if (!val) return '';
    const clean = String(val).trim().replace(/\D/g, '');
    if (clean.length === 12 && clean.startsWith('91')) return clean.slice(2);
    if (clean.length === 10 && ['6', '7', '8', '9'].includes(clean[0])) return clean;
    return clean;
}

function normalizeCleanAadhaar(val) {
    if (!val) return '';
    const clean = String(val).trim().replace(/\D/g, '');
    return clean.length === 12 ? clean : '';
}

function normalizeCleanCard(val) {
    if (!val) return '';
    return String(val).trim().replace(/\D/g, '');
}

function loadAadhaarIndex() {
    if (!fs.existsSync(AADHAAR_INDEX_FILE)) return {};
    try {
        return JSON.parse(fs.readFileSync(AADHAAR_INDEX_FILE, 'utf8')) || {};
    } catch (_) {
        return {};
    }
}

function saveAadhaarIndex(idx) {
    try {
        fs.writeFileSync(AADHAAR_INDEX_FILE, JSON.stringify(idx, null, 2), 'utf8');
    } catch (_) {}
}

function getMasterFile(mobile) {
    const cleanMob = normalizeCleanMobile(mobile);
    if (!cleanMob) return null;
    return path.join(CITIZENS_DIR, `${cleanMob}.json`);
}

/**
 * Looks up citizen by 10-digit mobile, 12-digit Aadhaar, or Smart Card number.
 */
function lookupCitizen(query) {
    if (!query) return null;
    const raw = String(query).trim();
    const cleanMob = normalizeCleanMobile(raw);
    const cleanAadhaar = normalizeCleanAadhaar(raw);
    const cleanCard = normalizeCleanCard(raw);

    // 1. Check direct mobile match
    if (cleanMob && cleanMob.length === 10) {
        const masterP = getMasterFile(cleanMob);
        if (masterP && fs.existsSync(masterP)) {
            try {
                const c = JSON.parse(fs.readFileSync(masterP, 'utf8'));
                if (c) return { citizen: c, foundBy: 'mobile', mobileNumber: cleanMob };
            } catch (_) {}
        }
        const profile = getCitizenProfile(cleanMob);
        if (profile && (profile.fullNameEng || profile.fullNameTam || profile.headAadhaar)) {
            return { citizen: profile, foundBy: 'mobile', mobileNumber: cleanMob };
        }
    }

    // 2. Check Aadhaar Index (Head or Family Member)
    if (cleanAadhaar) {
        const idx = loadAadhaarIndex();
        const linked = idx[cleanAadhaar];
        if (linked && linked.mobileNumber) {
            const masterP = getMasterFile(linked.mobileNumber);
            let citizen = null;
            if (masterP && fs.existsSync(masterP)) {
                try { citizen = JSON.parse(fs.readFileSync(masterP, 'utf8')); } catch (_) {}
            }
            if (!citizen) citizen = getCitizenProfile(linked.mobileNumber);
            if (citizen) {
                return {
                    citizen,
                    foundBy: linked.isMember ? 'member_aadhaar' : 'head_aadhaar',
                    mobileNumber: linked.mobileNumber,
                    matchedMember: linked.memberData || null
                };
            }
        }
    }

    // 3. Scan local drafts for smart card or aadhaar match
    const candidateDirs = [CITIZENS_DIR, LOCAL_DRAFTS_DIR, APPDATA_DRAFTS_DIR].filter(d => d && fs.existsSync(d));
    for (const dir of candidateDirs) {
        try {
            const files = fs.readdirSync(dir);
            for (const f of files) {
                if (!f.endsWith('.json')) continue;
                try {
                    const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
                    const prof = data.citizenProfile || data;
                    const mob = normalizeCleanMobile(prof.mobileNumber || data.mobileNumber || f.replace('.json', ''));
                    
                    // Match Head Aadhaar
                    const hAadhaar = normalizeCleanAadhaar(prof.headAadhaar || prof.aadhaarNumber);
                    if (cleanAadhaar && hAadhaar === cleanAadhaar) {
                        return { citizen: prof, foundBy: 'head_aadhaar', mobileNumber: mob };
                    }

                    // Match Smart Card
                    const cNo = normalizeCleanCard(prof.smartCardNumber || prof.subServiceData?.smartCardNumber);
                    if (cleanCard && cleanCard.length >= 10 && cNo === cleanCard) {
                        return { citizen: prof, foundBy: 'smart_card', mobileNumber: mob };
                    }

                    // Match Family Members Aadhaar
                    if (cleanAadhaar && Array.isArray(prof.members)) {
                        for (const m of prof.members) {
                            const mAadhaar = normalizeCleanAadhaar(m.aadhaarNumber || m.aadhaarNo);
                            if (mAadhaar === cleanAadhaar) {
                                return {
                                    citizen: prof,
                                    foundBy: 'member_aadhaar',
                                    mobileNumber: mob,
                                    matchedMember: m
                                };
                            }
                        }
                    }
                } catch (_) {}
            }
        } catch (_) {}
    }

    return null;
}

/**
 * Saves/Updates Master Citizen Profile and updates indexes.
 */
function saveCitizenMaster(mobileNumber, citizenData) {
    const cleanMob = normalizeCleanMobile(mobileNumber || citizenData?.mobileNumber);
    if (!cleanMob) return null;

    const masterFile = getMasterFile(cleanMob);
    let existing = {};
    if (masterFile && fs.existsSync(masterFile)) {
        try { existing = JSON.parse(fs.readFileSync(masterFile, 'utf8')) || {}; } catch (_) {}
    } else {
        const legacy = getCitizenProfile(cleanMob);
        if (legacy) existing = { ...legacy };
    }

    const merged = {
        ...existing,
        ...citizenData,
        mobileNumber: cleanMob,
        lastUpdated: new Date().toISOString()
    };

    if (masterFile) {
        try {
            fs.writeFileSync(masterFile, JSON.stringify(merged, null, 2), 'utf8');
        } catch (_) {}
    }

    // Keep citizens.json synced
    saveCitizenProfile(cleanMob, merged);

    // Update Aadhaar Index
    const idx = loadAadhaarIndex();
    const hAadhaar = normalizeCleanAadhaar(merged.headAadhaar || merged.aadhaarNumber);
    if (hAadhaar) {
        idx[hAadhaar] = { mobileNumber: cleanMob, isMember: false, name: merged.fullNameTam || merged.fullNameEng };
    }
    if (Array.isArray(merged.members)) {
        merged.members.forEach(m => {
            const mAadhaar = normalizeCleanAadhaar(m.aadhaarNumber || m.aadhaarNo);
            if (mAadhaar) {
                idx[mAadhaar] = {
                    mobileNumber: cleanMob,
                    isMember: true,
                    name: m.nameTam || m.nameEng || m.name,
                    memberData: m
                };
            }
        });
    }
    saveAadhaarIndex(idx);

    return merged;
}

module.exports = {
    normalizeCleanMobile,
    normalizeCleanAadhaar,
    normalizeCleanCard,
    lookupCitizen,
    saveCitizenMaster,
    getMasterFile
};
