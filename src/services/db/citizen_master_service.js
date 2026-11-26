/**
 * eSevaDraft Citizen Master Service
 *
 * Single Canonical Store Law:
 * Reads and writes Master Citizen Profiles directly inside the ONE active drafts directory
 * (getActiveDraftsDir()/<mobile>.json) with a lightweight Aadhaar lookup index inside getActiveDataDir().
 * NEVER creates duplicate data/citizens/*.json files or cross-reads two local directories.
 */

const fs = require('fs');
const path = require('path');
const { getCitizenProfile, saveCitizenProfile } = require('../../../database');
const { getActiveDataDir, getActiveDraftsDir } = require('./firestore_client');

function getAadhaarIndexFile() {
    return path.join(getActiveDataDir(), 'aadhaar_citizen_index.json');
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
    const idxFile = getAadhaarIndexFile();
    if (!fs.existsSync(idxFile)) return {};
    try {
        return JSON.parse(fs.readFileSync(idxFile, 'utf8')) || {};
    } catch (_) {
        return {};
    }
}

function saveAadhaarIndex(idx) {
    try {
        const idxFile = getAadhaarIndexFile();
        fs.mkdirSync(path.dirname(idxFile), { recursive: true });
        fs.writeFileSync(idxFile, JSON.stringify(idx, null, 2), 'utf8');
    } catch (_) {}
}

function getMasterFile(mobile) {
    const cleanMob = normalizeCleanMobile(mobile);
    if (!cleanMob) return null;
    return path.join(getActiveDraftsDir(), `${cleanMob}.json`);
}

/**
 * Looks up citizen by 10-digit mobile, 12-digit Aadhaar, or Smart Card number
 * strictly inside the single active drafts directory.
 */
function lookupCitizen(query) {
    if (!query) return null;
    const raw = String(query).trim();
    const cleanMob = normalizeCleanMobile(raw);
    const cleanAadhaar = normalizeCleanAadhaar(raw);
    const cleanCard = normalizeCleanCard(raw);

    // 1. Direct mobile match in single active drafts directory
    if (cleanMob && cleanMob.length === 10) {
        const profile = getCitizenProfile(cleanMob);
        if (profile && (profile.fullNameEng || profile.fullNameTam || profile.headAadhaar)) {
            return { citizen: profile, foundBy: 'mobile', mobileNumber: cleanMob };
        }
    }

    // 2. Check Aadhaar Index (Head or Family Member) -> resolves to single active draft
    if (cleanAadhaar) {
        const idx = loadAadhaarIndex();
        const linked = idx[cleanAadhaar];
        if (linked && linked.mobileNumber) {
            const citizen = getCitizenProfile(linked.mobileNumber);
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

    // 3. Scan strictly the single active drafts directory for Smart Card or Aadhaar match
    const activeDir = getActiveDraftsDir();
    if (activeDir && fs.existsSync(activeDir)) {
        try {
            const files = fs.readdirSync(activeDir);
            for (const f of files) {
                if (!f.endsWith('.json')) continue;
                try {
                    const data = JSON.parse(fs.readFileSync(path.join(activeDir, f), 'utf8'));
                    if (!data || data.isDeleted === true || data.status === 'TRASHED') continue;
                    const prof = data.citizenProfile || data;
                    const mob = normalizeCleanMobile(prof.mobileNumber || data.mobileNumber || f.replace('.json', ''));

                    const hAadhaar = normalizeCleanAadhaar(prof.headAadhaar || prof.aadhaarNumber);
                    if (cleanAadhaar && hAadhaar === cleanAadhaar) {
                        return { citizen: prof, foundBy: 'head_aadhaar', mobileNumber: mob };
                    }

                    const cNo = normalizeCleanCard(prof.smartCardNumber || prof.subServiceData?.smartCardNumber);
                    if (cleanCard && cleanCard.length >= 10 && cNo === cleanCard) {
                        return { citizen: prof, foundBy: 'smart_card', mobileNumber: mob };
                    }

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
 * Saves/Updates Master Citizen Profile strictly inside the single active drafts directory
 * and refreshes the lightweight Aadhaar lookup index.
 */
function saveCitizenMaster(mobileNumber, citizenData) {
    const cleanMob = normalizeCleanMobile(mobileNumber || citizenData?.mobileNumber);
    if (!cleanMob) return null;

    const existing = getCitizenProfile(cleanMob) || {};
    const merged = {
        ...existing,
        ...citizenData,
        mobileNumber: cleanMob,
        lastUpdated: new Date().toISOString()
    };

    const saved = saveCitizenProfile(cleanMob, merged) || merged;

    // Update lightweight Aadhaar lookup index inside active data directory
    const idx = loadAadhaarIndex();
    const hAadhaar = normalizeCleanAadhaar(saved.headAadhaar || saved.aadhaarNumber);
    if (hAadhaar) {
        idx[hAadhaar] = { mobileNumber: cleanMob, isMember: false, name: saved.fullNameTam || saved.fullNameEng };
    }
    if (Array.isArray(saved.members)) {
        saved.members.forEach(m => {
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

    return saved;
}

module.exports = {
    normalizeCleanMobile,
    normalizeCleanAadhaar,
    normalizeCleanCard,
    lookupCitizen,
    saveCitizenMaster,
    getMasterFile
};
