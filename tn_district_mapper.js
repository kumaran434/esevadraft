/**
 * Tamil Nadu 38-District, 315-Taluk & Revenue Village Master Resolver
 *
 * Replaces error-prone PIN-code guessing with official Tamil Nadu administrative
 * hierarchy resolution:
 *   TIER 1A: Operator-Verified Learned Village->Taluk Memory (Self-Learning)
 *   TIER 1B: Official Revenue Village & Confirmed Hamlet Lexicon (Hamlet-Only Street Rule)
 *   TIER 2 : Complete 38-District / 315-Taluk Official Tamil Nadu Master Registry
 *   TIER 3 : Official 38-District Normalization Passthrough (Zero Blind PIN Overwrite)
 */

function safeRequireStaticData(relPath, fallbackVal) {
    const pathMod = require('path');
    const candidates = [
        relPath,
        pathMod.join(__dirname, relPath),
        process.resourcesPath ? pathMod.join(process.resourcesPath, relPath) : '',
        pathMod.join(process.cwd(), relPath)
    ].filter(Boolean);
    for (const c of candidates) {
        try {
            return require(c);
        } catch (_) {}
    }
    console.warn(`⚠️ [tn_district_mapper] Optional static dataset not found: ${relPath}`);
    return fallbackVal;
}

const TN_ALL_TALUKS_MASTER = safeRequireStaticData('./data/tn_all_taluks_master.json', { districts: [] });
const TN_BIFURCATED_TALUKS = safeRequireStaticData('./data/tn_bifurcated_taluks', {});
const TN_PINCODE_TALUK_MAP = safeRequireStaticData('./data/tn_pincode_taluk_map', {});
const TN_VILLAGE_LEXICON = safeRequireStaticData('./data/tn_village_lexicon.json', { villages: [] });

let aiCorrectionMemory = null;
try {
    aiCorrectionMemory = require('./src/services/ai_correction_memory');
} catch (_) {}

function cleanStr(s) {
    return String(s || '').trim().toLowerCase().replace(/[^a-z0-9\u0B80-\u0BFF]/g, '');
}

function escapeRegex(s) {
    return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Build fast lookup indexes over all 38 districts and 315 official Tamil Nadu taluks
const DISTRICT_BY_KEY = new Map();
const TALUK_ENTRIES = [];
const TALUK_BY_KEY = new Map();

for (const d of (TN_ALL_TALUKS_MASTER.districts || [])) {
    const distRecord = {
        district: d.district,
        districtTam: d.districtTam,
        parentDistrict: d.parentDistrict || '',
        aliases: d.aliases || []
    };
    const dKeys = new Set([cleanStr(d.district), cleanStr(d.districtTam), ...(d.aliases || []).map(cleanStr)].filter(Boolean));
    for (const k of dKeys) DISTRICT_BY_KEY.set(k, distRecord);

    for (const t of (d.taluks || [])) {
        const entry = {
            taluk: t.eng,
            talukTam: t.tam || t.eng,
            district: d.district,
            districtTam: d.districtTam,
            parentDistrict: d.parentDistrict || '',
            names: [t.eng, t.tam, ...(t.aliases || [])].filter(Boolean),
            cleanNames: Array.from(new Set([cleanStr(t.eng), cleanStr(t.tam), ...(t.aliases || []).map(cleanStr)].filter(Boolean)))
        };
        TALUK_ENTRIES.push(entry);
        for (const ck of entry.cleanNames) {
            if (!TALUK_BY_KEY.has(ck)) TALUK_BY_KEY.set(ck, []);
            TALUK_BY_KEY.get(ck).push(entry);
        }
    }
}

function normalizeTnDistrictName(district = '') {
    const k = cleanStr(district);
    if (!k) return null;
    return DISTRICT_BY_KEY.get(k) || null;
}

function pickBestTalukCandidate(candidates, districtHint = '') {
    if (!Array.isArray(candidates) || candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];
    const dClean = cleanStr(districtHint);
    if (dClean) {
        const exactDist = candidates.find(c => cleanStr(c.district) === dClean || cleanStr(c.districtTam) === dClean);
        if (exactDist) return exactDist;
        const parentMatch = candidates.find(c => c.parentDistrict && cleanStr(c.parentDistrict) === dClean);
        if (parentMatch) return parentMatch;
    }
    // Prefer bifurcated modern district entry if ambiguous
    return candidates.find(c => Boolean(c.parentDistrict)) || candidates[0];
}

function isOfficialTnTaluk(name = '') {
    const k = cleanStr(name);
    return Boolean(k && TALUK_BY_KEY.has(k));
}

/**
 * Lookup Taluk across ALL 38 Districts / 315 Official Tamil Nadu Taluks
 */
function lookupTnTaluk(talukText = '', districtHint = '', fullAddressText = '') {
    // 1. Direct match on explicit talukText (strips trailing "Taluk"/"Tk"/"வட்டம்")
    const strippedTaluk = String(talukText || '').replace(/\b(taluk|taluka|tk|t\.k\.?|வட்டம்)\b/gi, '').trim();
    const tClean = cleanStr(strippedTaluk);
    if (tClean && TALUK_BY_KEY.has(tClean)) {
        return pickBestTalukCandidate(TALUK_BY_KEY.get(tClean), districtHint);
    }

    // 2. Token/word-boundary scan in fullAddressText (handles "Soorai, Sholinghur Taluk", "Ambur, Vellore", etc.)
    const rawAddr = String(fullAddressText || '').trim();
    if (rawAddr) {
        const lowAddr = rawAddr.toLowerCase();
        const matches = [];
        for (const entry of TALUK_ENTRIES) {
            for (const rawName of entry.names) {
                const trimmed = String(rawName || '').trim();
                if (!trimmed) continue;
                const isTamil = /[\u0B80-\u0BFF]/.test(trimmed);
                if (isTamil) {
                    if (trimmed.length >= 3 && rawAddr.includes(trimmed)) {
                        matches.push({ entry, len: trimmed.length });
                        break;
                    }
                } else {
                    if (trimmed.length < 4) continue;
                    const re = new RegExp(`(?:^|[^a-z0-9])${escapeRegex(trimmed.toLowerCase())}(?:$|[^a-z0-9])`, 'i');
                    if (re.test(lowAddr)) {
                        matches.push({ entry, len: trimmed.length });
                        break;
                    }
                }
            }
        }
        if (matches.length > 0) {
            // Prefer explicit District/ParentDistrict match, then longest taluk name
            const dClean = cleanStr(districtHint);
            matches.sort((a, b) => {
                const aScore = (dClean && (cleanStr(a.entry.district) === dClean || cleanStr(a.entry.parentDistrict) === dClean)) ? 1 : 0;
                const bScore = (dClean && (cleanStr(b.entry.district) === dClean || cleanStr(b.entry.parentDistrict) === dClean)) ? 1 : 0;
                if (bScore !== aScore) return bScore - aScore;
                return b.len - a.len;
            });
            return matches[0].entry;
        }
    }

    return null;
}

/**
 * Lookup Village in Master Lexicon (Exact Revenue Villages + Confirmed Hamlets)
 */
function lookupTnVillage(villageName = '', fullAddress = '') {
    const vClean = cleanStr(villageName);
    const addrClean = cleanStr(fullAddress);

    // 1. Direct match on villageName (checks all entries including villages, towns, hamlets)
    if (vClean) {
        for (const item of TN_VILLAGE_LEXICON) {
            if (item.names.some(n => {
                const nClean = cleanStr(n);
                return vClean === nClean || (nClean.length >= 4 && vClean.includes(nClean));
            })) {
                return { item, matchedDirect: true };
            }
        }
    }

    // 2. Scan fullAddress string:
    //    - ALWAYS check Confirmed Hamlet villages (so Narasingapuram/Kunnathur Colony in street/area resolve to parent Revenue Village)
    //    - ONLY match non-hamlet entries when villageName was NOT already supplied!
    if (addrClean) {
        for (const item of TN_VILLAGE_LEXICON) {
            if (!item.isHamlet && vClean) continue;
            if (item.names.some(n => {
                const nClean = cleanStr(n);
                return nClean.length >= 4 && addrClean.includes(nClean);
            })) {
                return { item, matchedDirect: false };
            }
        }
    }

    return null;
}

/**
 * Legacy export kept only for backward compatibility (NOT used to blindly overwrite Taluk/Village!)
 */
function lookupTnPincode(pincode = '') {
    const pin = String(pincode || '').trim().replace(/\D/g, '');
    if (pin.length === 6 && TN_PINCODE_TALUK_MAP[pin]) {
        return TN_PINCODE_TALUK_MAP[pin];
    }
    return null;
}

/**
 * Universal Tamil Nadu District, Taluk & Village Master Resolver
 * Priority:
 *   1A. Operator-Verified Learned Village Memory
 *   1B. Master Revenue Village / Confirmed Hamlet Lexicon
 *   2.  Complete Official 38-District / 315-Taluk Master Registry
 *   3.  Normalized 38-District Passthrough (ZERO blind PIN-code guessing/overwriting!)
 */
function resolveTnDistrict(district = '', taluk = '', village = '', pincode = '', fullAddressText = '') {
    const dClean = cleanStr(district);
    const tClean = cleanStr(taluk);
    const vClean = cleanStr(village);
    const combinedAddr = [village, fullAddressText].filter(Boolean).join(' ');

    // -------------------------------------------------------------------------
    // TIER 1A: Operator-Verified Learned Village->Taluk Memory
    // -------------------------------------------------------------------------
    if (vClean && aiCorrectionMemory && typeof aiCorrectionMemory.lookupLearnedVillage === 'function') {
        const learned = aiCorrectionMemory.lookupLearnedVillage(village);
        if (learned && learned.taluk && learned.district) {
            const expectedDistClean = cleanStr(learned.district);
            const distMeta = normalizeTnDistrictName(learned.district);
            const parentDistClean = cleanStr(distMeta?.parentDistrict || '');
            const wasDistrictCorrected = Boolean(dClean && !dClean.includes(expectedDistClean)) || Boolean(parentDistClean && dClean.includes(parentDistClean));
            const wasTalukCorrected = !tClean || !tClean.includes(cleanStr(learned.taluk));
            return {
                district: learned.district,
                districtTam: learned.districtTam || distMeta?.districtTam || learned.district,
                taluk: learned.taluk,
                talukTam: learned.talukTam || learned.taluk,
                village: learned.village || village,
                villageTam: learned.villageTam || '',
                areaEng: learned.isHamlet ? (learned.areaEng || undefined) : undefined,
                areaTam: learned.isHamlet ? (learned.areaTam || undefined) : undefined,
                isHamlet: Boolean(learned.isHamlet),
                wasAutoCorrected: wasDistrictCorrected || Boolean(learned.isHamlet),
                originalDistrict: district,
                reason: (wasDistrictCorrected || wasTalukCorrected)
                    ? `ஆபரேட்டர் சரிபார்த்த பதிவின்படி ${learned.villageTam || learned.village} — ${learned.districtTam || learned.district} மாவட்டம், ${learned.talukTam || learned.taluk} வட்டத்தின் கீழ் வருகிறது.`
                    : null
            };
        }
    }

    // -------------------------------------------------------------------------
    // TIER 1B: Match by Revenue Village / Confirmed Hamlet Lexicon
    // -------------------------------------------------------------------------
    const villageLookup = lookupTnVillage(village, combinedAddr);
    const villageMatch = villageLookup ? (villageLookup.item || villageLookup) : null;
    const matchedDirect = villageLookup ? Boolean(villageLookup.matchedDirect) : false;
    if (villageMatch) {
        const expectedDistClean = cleanStr(villageMatch.district);
        const distMeta = normalizeTnDistrictName(villageMatch.district);
        const parentDistClean = cleanStr(distMeta?.parentDistrict || TN_BIFURCATED_TALUKS[villageMatch.district.toLowerCase()]?.parentDistrict || '');

        const wasDistrictCorrected = !dClean.includes(expectedDistClean) || Boolean(parentDistClean && dClean.includes(parentDistClean));
        const wasTalukFilled = !tClean || !tClean.includes(cleanStr(villageMatch.taluk));

        // Preserve citizen's standalone village unless this is a hamlet resolution OR village matched directly OR village was blank
        const preserveStandaloneVillage = Boolean(vClean && !matchedDirect && !villageMatch.isHamlet);
        const finalVillage = preserveStandaloneVillage ? village : villageMatch.village;
        const finalVillageTam = preserveStandaloneVillage ? '' : villageMatch.villageTam;

        let reason = null;
        if (wasDistrictCorrected || wasTalukFilled) {
            reason = villageMatch.isHamlet
                ? `${villageMatch.areaTam || village} என்பது ${villageMatch.talukTam} வட்டம் ${villageMatch.villageTam} வருவாய் கிராமத்தின் கீழ் உள்ள துணைக் கிராமம் (Hamlet Village) ஆகும். இது ${villageMatch.districtTam} மாவட்டத்தின் கீழ் வருகிறது.`
                : `ஆதார் அட்டையில் '${district || 'பழைய மாவட்டம்'}' என இருந்தாலும், ${finalVillageTam || finalVillage} தமிழக அரசு விதிகளின்படி ${villageMatch.districtTam} மாவட்டம், ${villageMatch.talukTam} வட்டத்தின் கீழ் வருகிறது.`;
        }

        return {
            district: villageMatch.district,
            districtTam: villageMatch.districtTam,
            taluk: villageMatch.taluk,
            talukTam: villageMatch.talukTam,
            village: finalVillage,
            villageTam: finalVillageTam,
            areaEng: villageMatch.isHamlet ? (villageMatch.areaEng || undefined) : undefined,
            areaTam: villageMatch.isHamlet ? (villageMatch.areaTam || undefined) : undefined,
            isHamlet: Boolean(villageMatch.isHamlet),
            wasAutoCorrected: wasDistrictCorrected || Boolean(villageMatch.isHamlet),
            originalDistrict: district,
            reason: reason
        };
    }

    // -------------------------------------------------------------------------
    // TIER 2: Complete Official 38-District / 315-Taluk Master Registry
    // (Matches explicit taluk, town/village taluk names, or taluk mentioned in address)
    // -------------------------------------------------------------------------
    const talukMatch = lookupTnTaluk(taluk, district, '')
        || lookupTnTaluk(village, district, '')
        || lookupTnTaluk('', district, fullAddressText);
    if (talukMatch) {
        const expectedDistClean = cleanStr(talukMatch.district);
        const parentDistClean = cleanStr(talukMatch.parentDistrict || '');
        const wasDistrictCorrected = Boolean(dClean && !dClean.includes(expectedDistClean)) || Boolean(parentDistClean && dClean.includes(parentDistClean));
        const wasTalukCorrected = !tClean || !tClean.includes(cleanStr(talukMatch.taluk));

        return {
            district: talukMatch.district,
            districtTam: talukMatch.districtTam,
            taluk: talukMatch.taluk,
            talukTam: talukMatch.talukTam,
            village: village || '',
            villageTam: '',
            isHamlet: false,
            wasAutoCorrected: wasDistrictCorrected,
            originalDistrict: district,
            reason: (wasDistrictCorrected || wasTalukCorrected)
                ? `தமிழக அரசு 38 மாவட்ட / 315 தாலுகா பட்டியலின்படி '${talukMatch.talukTam}' வட்டம் '${talukMatch.districtTam}' மாவட்டத்தின் கீழ் உள்ளது.`
                : null
        };
    }

    // -------------------------------------------------------------------------
    // TIER 3: Official 38-District Normalization Passthrough (NO Blind PIN Guess!)
    // -------------------------------------------------------------------------
    const normDist = normalizeTnDistrictName(district);
    return {
        district: normDist ? normDist.district : (district || ''),
        districtTam: normDist ? normDist.districtTam : (district || ''),
        taluk: taluk || '',
        talukTam: taluk || '',
        village: village || '',
        villageTam: village || '',
        isHamlet: false,
        wasAutoCorrected: false,
        originalDistrict: district,
        reason: null
    };
}

module.exports = {
    TN_ALL_TALUKS_MASTER,
    TN_BIFURCATED_TALUKS,
    TN_PINCODE_TALUK_MAP,
    TN_VILLAGE_LEXICON,
    normalizeTnDistrictName,
    isOfficialTnTaluk,
    lookupTnTaluk,
    lookupTnVillage,
    lookupTnPincode,
    resolveTnDistrict
};
