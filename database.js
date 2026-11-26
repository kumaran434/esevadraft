/**
 * eSevaDraft Unified Citizen Database Facade
 *
 * Single Canonical Store Law:
 * Every customer record lives in STRICTLY ONE local JSON file inside getActiveDraftsDir()
 * (AppData/Roaming/esevadraft-desktop/data/drafts/<mobile>.json in Desktop mode;
 * <repo>/data/drafts/<mobile>.json in workspace/test mode).
 * NEVER duplicates customer data into citizens.json or citizens.json.bak.
 */
const fs = require('fs');
const path = require('path');
const { resolveTnDistrict } = require('./tn_district_mapper');
const { getActiveDraftsDir, isSpecificDraftId, extractMobileFromDraftKey, getActiveDraftIdForMobile } = require('./src/services/db/firestore_client');

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

function getDraftFilePath(cleanMob) {
    return path.join(getActiveDraftsDir(), `${cleanMob}.json`);
}

function findDraftFile(cleanMob) {
    const p = getDraftFilePath(cleanMob);
    return fs.existsSync(p) ? p : null;
}

function maskAadhaar(aadhaar) {
    if (!aadhaar || typeof aadhaar !== 'string') return aadhaar || '';
    const clean = String(aadhaar).replace(/\D/g, '');
    if (clean.length === 12) {
        return `XXXX-XXXX-${clean.slice(8)}`;
    }
    return aadhaar;
}

function loadDatabase() {
    const db = {};
    const dir = getActiveDraftsDir();
    if (!fs.existsSync(dir)) return db;
    try {
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
        for (const f of files) {
            try {
                const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
                if (!d || d.isDeleted === true || d.status === 'TRASHED') continue;
                const mob = String(d.mobileNumber || f.replace('.json', '')).trim();
                if (mob && d.citizenProfile) {
                    db[mob] = { ...d.citizenProfile, mobileNumber: mob, lastUpdated: d.lastUpdated || d.citizenProfile.lastUpdated };
                }
            } catch (_) {}
        }
    } catch (_) {}
    return db;
}

function getCitizenProfile(mobileNumber) {
    if (!mobileNumber) return null;
    const cleanMob = String(mobileNumber).trim();
    const isTestEnv = !!(process.env.ESEVA_TEST_MODE === '1' || process.env.REGRESSION_TEST === 'true' || process.argv.some(a => a.includes('test')));
    const filterDummyProfile = (prof) => {
        if (!prof || isTestEnv) return prof;
        const aadh = String(prof.headAadhaar || prof.aadhaarNumber || '').replace(/\D/g, '');
        if (aadh === '123456789012' || aadh === '987654321012') return null;
        return prof;
    };
    const draftPath = findDraftFile(cleanMob);
    if (draftPath) {
        try {
            const draft = JSON.parse(fs.readFileSync(draftPath, 'utf8'));
            if (draft && !draft.isDeleted && draft.status !== 'TRASHED' && draft.citizenProfile) {
                return filterDummyProfile(draft.citizenProfile);
            }
        } catch (_) {}
    }
    return null;
}

function saveCitizenProfile(mobileNumber, profileData) {
    if (!mobileNumber) return null;
    const rawKey = String(mobileNumber).trim();
    const routedActiveId = !isSpecificDraftId(rawKey) ? getActiveDraftIdForMobile(rawKey) : null;
    const cleanMob = routedActiveId || rawKey;
    const cleanData = { ...(profileData || {}) };
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

    const nowIso = new Date().toISOString();
    const dPath = getDraftFilePath(cleanMob);
    let draft = null;
    if (fs.existsSync(dPath)) {
        try {
            const parsed = JSON.parse(fs.readFileSync(dPath, 'utf8'));
            if (parsed && !parsed.isDeleted && parsed.status !== 'TRASHED') {
                draft = parsed;
            }
        } catch (_) {}
    }

    const displayMob = extractMobileFromDraftKey(cleanData.mobileNumber || cleanMob);
    const mergedProfile = {
        ...((draft && draft.citizenProfile) || {}),
        ...cleanData,
        mobileNumber: displayMob,
        isExtracted: true,
        lastUpdated: nowIso
    };

    const updatedDraft = {
        ...(draft || {
            draftId: cleanMob,
            mobileNumber: displayMob,
            intakeState: 'SERVICE_SELECTION',
            step: 'draft',
            status: 'DRAFT_SAVED'
        }),
        draftId: (draft && draft.draftId) || cleanMob,
        mobileNumber: displayMob,
        name: mergedProfile.fullNameTam || mergedProfile.fullNameEng || (draft && draft.name) || '',
        citizenProfile: mergedProfile,
        lastUpdated: nowIso
    };

    safeWriteJsonSync(dPath, updatedDraft);
    return mergedProfile;
}

function addFamilyMember(mobileNumber, memberData) {
    if (!mobileNumber) return null;
    const cleanMob = String(mobileNumber).trim();
    const existing = getCitizenProfile(cleanMob);
    if (!existing) return null;
    const members = Array.isArray(existing.members) ? [...existing.members] : [];
    members.push(memberData);
    return saveCitizenProfile(cleanMob, { ...existing, members });
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

    const resPath = typeof profile.residenceProof === 'string' ? profile.residenceProof : profile.residenceProof?.docPath;
    if (resPath && fs.existsSync(resPath)) {
        docs.push({
            id: 'residence_proof',
            title: 'இருப்பிடச் சான்று ஆவணம்',
            type: resPath.endsWith('.pdf') ? 'application/pdf' : 'image/png',
            filename: path.basename(resPath),
            path: resPath
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
            const mDoc = m.aadhaarDocPath || m.docPath;
            if (mDoc && fs.existsSync(mDoc)) {
                docs.push({
                    id: `member_aadhaar_${idx + 1}`,
                    title: `உறுப்பினர் ஆதார் - ${m.name || m.nameEng || idx + 1}`,
                    type: mDoc.endsWith('.pdf') ? 'application/pdf' : 'image/png',
                    filename: path.basename(mDoc),
                    path: mDoc
                });
            }
        });
    }

    return docs;
}

function getAllCitizensSummary() {
    const citizens = [];
    const dir = getActiveDraftsDir();
    if (fs.existsSync(dir)) {
        try {
            const draftFiles = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
            for (const df of draftFiles) {
                try {
                    const d = JSON.parse(fs.readFileSync(path.join(dir, df), 'utf8'));
                    if (!d || d.isDeleted === true || d.status === 'TRASHED') continue;
                    const mob = d.mobileNumber || df.replace('.json', '');
                    const prof = d.citizenProfile || {};
                    citizens.push({
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
            }
        } catch (_) {}
    }

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
        const dir = getActiveDraftsDir();
        for (const k of keysToClean) {
            const fPath = path.join(dir, `${k}.json`);
            if (fs.existsSync(fPath)) {
                try { fs.unlinkSync(fPath); } catch (_) {}
            }
        }
        return true;
    } catch (e) {
        console.error('Error deleting citizen profile:', e.message);
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
