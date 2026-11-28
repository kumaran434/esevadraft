/**
 * Tamil Nadu 38-District, 318-Taluk & 18,595 Official Revenue Village Master Resolver
 *
 * Replaces error-prone PIN-code guessing with official Tamil Nadu administrative
 * hierarchy resolution + Universal Auto-Hamlet Detection:
 *   TIER 1A: Operator-Verified Learned Village->Taluk Memory (Self-Learning)
 *   TIER 1B: Curated Confirmed Hamlet & Special Lexicon (District-Aware)
 *   TIER 1C: Complete 18,595 Official LGD Revenue Villages Master + Auto-Hamlet Detection
 *            (Resolves District/Taluk even when Taluk is missing on Aadhaar & even for
 *             Old Undivided Districts like Vellore, Kanchipuram, Villupuram, Tirunelveli, Nagapattinam!)
 *   TIER 2 : Complete 38-District / 318-Taluk Official Tamil Nadu Master Registry
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
const TN_ALL_VILLAGES_MASTER = safeRequireStaticData('./data/tn_all_villages_master.json', { districts: [], taluks: [], villages: [] });
const TN_BIFURCATED_TALUKS = safeRequireStaticData('./data/tn_bifurcated_taluks', {});
const TN_PINCODE_TALUK_MAP = safeRequireStaticData('./data/tn_pincode_taluk_map', {});
const TN_VILLAGE_LEXICON = safeRequireStaticData('./data/tn_village_lexicon.json', []);

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

function toTitleCaseSimple(str) {
    return String(str || '')
        .trim()
        .replace(/\s+/g, ' ')
        .split(' ')
        .map(w => {
            if (!w) return '';
            if (w.length === 1 && /[a-zA-Z]/.test(w)) return w.toUpperCase();
            return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
        })
        .join(' ');
}

// =============================================================================
// 1. Build fast lookup indexes over all 38 districts and 318 official TN taluks
// =============================================================================
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

// =============================================================================
// 2. Build O(1) lookup index over all 18,595 official LGD TN Revenue Villages
// =============================================================================
const REVENUE_VILLAGES_BY_KEY = new Map();
const MASTER_DISTRICTS = Array.isArray(TN_ALL_VILLAGES_MASTER.districts) ? TN_ALL_VILLAGES_MASTER.districts : [];
const MASTER_TALUKS = Array.isArray(TN_ALL_VILLAGES_MASTER.taluks) ? TN_ALL_VILLAGES_MASTER.taluks : [];
const MASTER_VILLAGES = Array.isArray(TN_ALL_VILLAGES_MASTER.villages) ? TN_ALL_VILLAGES_MASTER.villages : [];

for (let i = 0; i < MASTER_VILLAGES.length; i++) {
    const row = MASTER_VILLAGES[i];
    if (!Array.isArray(row) || row.length < 2) continue;
    const [tIdx, vEng, vTam = '', pin = ''] = row;
    const tRow = MASTER_TALUKS[tIdx];
    if (!tRow) continue;
    const dRow = MASTER_DISTRICTS[tRow[0]];
    if (!dRow) continue;

    const record = {
        district: dRow[0],
        districtTam: dRow[1] || dRow[0],
        parentDistrict: dRow[2] || '',
        taluk: tRow[1],
        talukTam: tRow[2] || tRow[1],
        village: vEng,
        villageTam: vTam || '',
        pincode: pin || ''
    };

    const keys = new Set();
    const kEng = cleanStr(vEng);
    const kTam = cleanStr(vTam);
    if (kEng && kEng.length >= 2) keys.add(kEng);
    if (kTam && kTam.length >= 2) keys.add(kTam);

    for (const k of keys) {
        if (!REVENUE_VILLAGES_BY_KEY.has(k)) REVENUE_VILLAGES_BY_KEY.set(k, []);
        REVENUE_VILLAGES_BY_KEY.get(k).push(record);
    }
}

function normalizeTnDistrictName(district = '') {
    const k = cleanStr(district);
    if (!k) return null;
    return DISTRICT_BY_KEY.get(k) || null;
}

/**
 * Checks if a candidate record's modern district OR its old undivided parent district
 * is compatible with the Aadhaar/citizen's districtHint (e.g. "Vellore" matches Ranipet, Tirupattur & Vellore!).
 */
function isDistrictCompatible(recordDistrict, recordParentDistrict, districtHint = '') {
    const dNorm = normalizeTnDistrictName(districtHint);
    const hintClean = dNorm ? cleanStr(dNorm.district) : cleanStr(districtHint);
    if (!hintClean) return true;

    const recDistClean = cleanStr(recordDistrict);
    const recParentClean = cleanStr(recordParentDistrict);

    if (recDistClean === hintClean) return true;
    if (recParentClean && recParentClean === hintClean) return true;
    // Also handle reverse: hint is child district (Ranipet) while record has same parent
    if (dNorm && dNorm.parentDistrict && cleanStr(dNorm.parentDistrict) === recDistClean) return false;
    return false;
}

function pickBestTalukCandidate(candidates, districtHint = '') {
    if (!Array.isArray(candidates) || candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];
    const dNorm = normalizeTnDistrictName(districtHint);
    const dClean = dNorm ? cleanStr(dNorm.district) : cleanStr(districtHint);
    if (dClean) {
        const exactDist = candidates.find(c => cleanStr(c.district) === dClean || cleanStr(c.districtTam) === dClean);
        if (exactDist) return exactDist;
        const parentMatch = candidates.find(c => c.parentDistrict && cleanStr(c.parentDistrict) === dClean);
        if (parentMatch) return parentMatch;
    }
    return candidates.find(c => Boolean(c.parentDistrict)) || candidates[0];
}

function isOfficialTnTaluk(name = '') {
    const k = cleanStr(name);
    return Boolean(k && TALUK_BY_KEY.has(k));
}

function isOfficialTnRevenueVillage(name = '', districtHint = '') {
    const k = cleanStr(name);
    if (!k || !REVENUE_VILLAGES_BY_KEY.has(k)) return false;
    const list = REVENUE_VILLAGES_BY_KEY.get(k);
    if (!districtHint) return list.length > 0;
    return list.some(c => isDistrictCompatible(c.district, c.parentDistrict, districtHint));
}

/**
 * Lookup Taluk across ALL 38 Districts / 318 Official Tamil Nadu Taluks
 */
function lookupTnTaluk(talukText = '', districtHint = '', fullAddressText = '') {
    const strippedTaluk = String(talukText || '').replace(/\b(taluk|taluka|tk|t\.k\.?|வட்டம்)\b/gi, '').trim();
    const tClean = cleanStr(strippedTaluk);
    if (tClean && TALUK_BY_KEY.has(tClean)) {
        return pickBestTalukCandidate(TALUK_BY_KEY.get(tClean), districtHint);
    }

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
            const dNorm = normalizeTnDistrictName(districtHint);
            const dClean = dNorm ? cleanStr(dNorm.district) : cleanStr(districtHint);
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
 * Lookup Village in Curated Master Lexicon (District-Aware so Tiruppur/Chengalpattu Kunnathur
 * is NEVER hijacked by Ranipet's Kunnathur entry!)
 */
function lookupTnVillage(villageName = '', fullAddress = '', districtHint = '') {
    const vClean = cleanStr(villageName);
    const addrClean = cleanStr(fullAddress);
    const list = Array.isArray(TN_VILLAGE_LEXICON) ? TN_VILLAGE_LEXICON : (TN_VILLAGE_LEXICON.villages || []);

    const isItemCompatible = (item) => {
        if (!districtHint) return true;
        const distMeta = normalizeTnDistrictName(item.district);
        const parentDist = distMeta?.parentDistrict || TN_BIFURCATED_TALUKS[String(item.district || '').toLowerCase()]?.parentDistrict || '';
        return isDistrictCompatible(item.district, parentDist, districtHint);
    };

    // 0. Check Confirmed Hamlet entries FIRST across BOTH villageName and fullAddress
    //    (So "Kunnathur Colony, Kunnathur" returns the Confirmed Hamlet entry with isHamlet: true
    //     rather than short-circuiting on the bare non-hamlet "Kunnathur" entry!)
    const hamletSearchTarget = [vClean, addrClean].filter(Boolean).join(' ');
    if (hamletSearchTarget) {
        for (const item of list) {
            if (!item.isHamlet) continue;
            if (!isItemCompatible(item)) continue;
            if (item.names.some(n => {
                const nClean = cleanStr(n);
                return nClean.length >= 4 && hamletSearchTarget.includes(nClean);
            })) {
                const directHit = Boolean(vClean && item.names.some(n => {
                    const nClean = cleanStr(n);
                    return vClean === nClean || (nClean.length >= 4 && vClean.includes(nClean));
                }));
                return { item, matchedDirect: directHit };
            }
        }
    }

    // 1. Direct match on villageName (non-hamlet curated entries)
    if (vClean) {
        for (const item of list) {
            if (item.isHamlet) continue;
            if (!isItemCompatible(item)) continue;
            if (item.names.some(n => {
                const nClean = cleanStr(n);
                return vClean === nClean || (nClean.length >= 4 && vClean.includes(nClean));
            })) {
                return { item, matchedDirect: true };
            }
        }
    }

    // 2. Scan fullAddress string for non-hamlet entries ONLY when villageName was NOT already supplied
    if (addrClean && !vClean) {
        for (const item of list) {
            if (item.isHamlet) continue;
            if (!isItemCompatible(item)) continue;
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

// =============================================================================
// 3. Complete 18,595 Official Revenue Villages Lookup + Auto-Hamlet Detection
// =============================================================================
const HAMLET_SUFFIX_PATTERNS = [
    { re: /\s+(?:new\s+colony|old\s+colony|a\.?\s*d\.?\s*colony|adi\s*dravidar\s*colony|h\.?\s*c\.?\s*colony|colony)$/i, tamSuffix: 'காலனி' },
    { re: /\s+(?:புதிய\s+காலனி|பழைய\s+காலனி|ஆதி\s*திராவிடர்\s+காலனி|காலனி)$/, tamSuffix: 'காலனி' },
    { re: /\s+(?:pudur|pudhur|puthur)$/i, tamSuffix: 'புதூர்' },
    { re: /\s+(?:புதூர்)$/, tamSuffix: 'புதூர்' },
    { re: /\s+(?:mottur|motur)$/i, tamSuffix: 'மோட்டூர்' },
    { re: /\s+(?:மோட்டூர்)$/, tamSuffix: 'மோட்டூர்' },
    { re: /\s+(?:medu)$/i, tamSuffix: 'மேடு' },
    { re: /\s+(?:மேடு)$/, tamSuffix: 'மேடு' },
    { re: /\s+(?:kuppam)$/i, tamSuffix: 'குப்பம்' },
    { re: /\s+(?:குப்பம்)$/, tamSuffix: 'குப்பம்' },
    { re: /\s+(?:cheri)$/i, tamSuffix: 'சேரி' },
    { re: /\s+(?:சேரி)$/, tamSuffix: 'சேரி' },
    { re: /\s+(?:kandigai|kandikai)$/i, tamSuffix: 'கண்டிகை' },
    { re: /\s+(?:கண்டிகை)$/, tamSuffix: 'கண்டிகை' },
    { re: /\s+(?:thangal|tangal)$/i, tamSuffix: 'தாங்கல்' },
    { re: /\s+(?:தாங்கல்)$/, tamSuffix: 'தாங்கல்' },
    { re: /\s+(?:hamlet)$/i, tamSuffix: '' },
    { re: /\s+(?:குக்கிராமம்)$/, tamSuffix: '' }
];

const STREET_OR_NOISE_RE = /\b(?:street|st\.?|road|rd\.?|lane|salai|theru|cross|main|ward|block|flat|floor|door|plot|house|no\.?|po|post|tk|taluk|taluka|dist|district|tamil\s*nadu|india)\b|தெரு|சாலை|ரோடு|சந்து|வடக்கு|தெற்கு|கிழக்கு|மேற்கு|மெயின்|வார்டு|கதவு|வட்டம்|மாவட்டம்|தமிழ்நாடு/i;

function isHamletLikeToken(token = '') {
    const t = String(token || '').trim();
    if (!t || t.length < 4) return false;
    if (/^\d/.test(t)) return false;
    if (STREET_OR_NOISE_RE.test(t)) return false;
    return HAMLET_SUFFIX_PATTERNS.some(p => p.re.test(t)) ||
        /\b(?:colony|nagar|puram|pudur|mottur|medu|kuppam|cheri|thangal|kandigai|patti|palayam|pettai|hamlet)\b|காலனி|நகர்|புரம்|புதூர்|மோட்டூர்|மேடு|குப்பம்|சேரி|தாங்கல்|கண்டிகை|பட்டி|பாளையம்|பேட்டை/i.test(t);
}

function buildBilingualHamletFromRoot(rawToken, revRecord, matchedSuffix = null) {
    const trimmed = String(rawToken || '').trim();
    const isTamil = /[\u0B80-\u0BFF]/.test(trimmed);
    let areaEng = '';
    let areaTam = '';

    if (isTamil) {
        areaTam = trimmed;
        if (matchedSuffix) {
            const engSuffixMap = {
                'காலனி': 'Colony',
                'புதூர்': 'Pudur',
                'மோட்டூர்': 'Mottur',
                'மேடு': 'Medu',
                'குப்பம்': 'Kuppam',
                'சேரி': 'Cheri',
                'கண்டிகை': 'Kandigai',
                'தாங்கல்': 'Thangal'
            };
            const sufEng = engSuffixMap[matchedSuffix.tamSuffix] || '';
            areaEng = sufEng ? `${revRecord.village} ${sufEng}` : revRecord.village;
        }
    } else {
        areaEng = toTitleCaseSimple(trimmed);
        if (matchedSuffix && matchedSuffix.tamSuffix && revRecord.villageTam) {
            const extraPrefix = /new\s+colony/i.test(trimmed) ? 'புதிய '
                : /old\s+colony/i.test(trimmed) ? 'பழைய '
                : '';
            areaTam = `${revRecord.villageTam} ${extraPrefix}${matchedSuffix.tamSuffix}`.trim();
        }
    }
    return { areaEng, areaTam };
}

/**
 * Picks the single unambiguous Official Revenue Village candidate using:
 *   1. Explicit Taluk hint
 *   2. District OR Old Undivided Parent District (Vellore -> Ranipet/Tirupattur/Vellore, etc.)
 *   3. Exact 6-digit Pincode tie-breaker
 * NEVER blindly guesses when multiple taluks remain tied!
 */
function disambiguateRevenueVillage(candidates, { districtHint = '', talukHint = '', pincode = '' } = {}) {
    if (!Array.isArray(candidates) || candidates.length === 0) return { match: null, ambiguousTaluks: [] };

    let pool = candidates.slice();
    const pin = String(pincode || '').trim().replace(/\D/g, '');
    const tClean = cleanStr(String(talukHint || '').replace(/\b(taluk|taluka|tk|t\.k\.?|வட்டம்)\b/gi, ''));
    const dNorm = normalizeTnDistrictName(districtHint);
    const hasKnownDistrictHint = Boolean(dNorm || cleanStr(districtHint));

    // 1. District / Old Parent District filter (strict: NEVER cross-match a different district!)
    if (hasKnownDistrictHint) {
        const distFiltered = pool.filter(c => isDistrictCompatible(c.district, c.parentDistrict, districtHint));
        if (distFiltered.length === 0) {
            return { match: null, ambiguousTaluks: [] };
        }
        pool = distFiltered;
    }

    // 2. Explicit Taluk filter
    if (tClean) {
        const talukObj = lookupTnTaluk(talukHint, districtHint, '');
        const targetTalukClean = talukObj ? cleanStr(talukObj.taluk) : tClean;
        const talukFiltered = pool.filter(c => cleanStr(c.taluk) === targetTalukClean || cleanStr(c.talukTam) === targetTalukClean);
        if (talukFiltered.length === 1) return { match: talukFiltered[0], ambiguousTaluks: [] };
        if (talukFiltered.length > 1) pool = talukFiltered;
    }

    // 3. Unique match after District/Taluk filter -> 100% confident!
    if (pool.length === 1) {
        return { match: pool[0], ambiguousTaluks: [] };
    }

    // Check if all remaining candidates belong to the EXACT SAME district + taluk
    const uniqueJurisdictions = new Set(pool.map(c => `${cleanStr(c.district)}|${cleanStr(c.taluk)}`));
    if (uniqueJurisdictions.size === 1) {
        return { match: pool[0], ambiguousTaluks: [] };
    }

    // 4. Exact 6-digit Pincode tie-breaker (breaks same-district duplicate village ties!)
    if (pin.length === 6) {
        const pinFiltered = pool.filter(c => c.pincode && c.pincode === pin);
        if (pinFiltered.length === 1) {
            return { match: pinFiltered[0], ambiguousTaluks: [] };
        }
        const pinJurisdictions = new Set(pinFiltered.map(c => `${cleanStr(c.district)}|${cleanStr(c.taluk)}`));
        if (pinFiltered.length > 0 && pinJurisdictions.size === 1) {
            return { match: pinFiltered[0], ambiguousTaluks: [] };
        }
    }

    // Still tied across multiple taluks -> NEVER blindly guess!
    const ambiguousTaluks = Array.from(new Set(pool.map(c => c.taluk))).sort();
    return { match: null, ambiguousTaluks };
}

/**
 * Looks up Official TN Revenue Village across all 18,595 LGD entries AND detects
 * unlisted Hamlets/Colonies automatically (e.g. "Kunnathur Colony, Kunnathur, Vellore"
 * or "Palayapalayam Colony, Nagapattinam" -> resolves modern District + Taluk + Revenue Village + Hamlet!).
 */
function lookupOfficialTnRevenueVillage(villageName = '', fullAddress = '', districtHint = '', talukHint = '', pincode = '') {
    if (REVENUE_VILLAGES_BY_KEY.size === 0) return null;

    const opts = { districtHint, talukHint, pincode };
    const cleanToken = (tok) => String(tok || '')
        .replace(/^(?:c\/o|s\/o|w\/o|d\/o)\s*[:.\-]?\s*/i, '')
        .replace(/\b(?:post|p\.?o\.?|tk|taluk|taluka|dist|district|tamil\s*nadu)\b\.?/gi, '')
        .replace(/\b\d{6}\b/g, '')
        .replace(/^[\s,\-:]+|[\s,\-:]+$/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    // Build ordered address segments (comma/pipe/newline split)
    const rawSegments = String(fullAddress || '')
        .split(/[,|\n;]+/)
        .map(cleanToken)
        .filter(s => s.length >= 2);

    const directVillage = cleanToken(villageName);

    // Helper: try exact match on a single token
    const tryExactToken = (tok) => {
        const k = cleanStr(tok);
        if (!k || k.length < 3 || !REVENUE_VILLAGES_BY_KEY.has(k)) return null;
        return disambiguateRevenueVillage(REVENUE_VILLAGES_BY_KEY.get(k), opts);
    };

    // Helper: try stripping a Hamlet/Colony suffix (e.g., "Kunnathur Colony" -> "Kunnathur")
    const tryHamletSuffixStrip = (tok) => {
        const trimmed = cleanToken(tok);
        if (!trimmed || STREET_OR_NOISE_RE.test(trimmed)) return null;
        for (const pat of HAMLET_SUFFIX_PATTERNS) {
            if (pat.re.test(trimmed)) {
                const root = trimmed.replace(pat.re, '').trim();
                const rootRes = tryExactToken(root);
                if (rootRes && rootRes.match) {
                    const biling = buildBilingualHamletFromRoot(trimmed, rootRes.match, pat);
                    return {
                        record: rootRes.match,
                        isHamlet: true,
                        areaEng: biling.areaEng,
                        areaTam: biling.areaTam,
                        ambiguousTaluks: []
                    };
                }
            }
        }
        return null;
    };

    // Helper: scan sibling segments for a non-revenue-village Hamlet/Colony token
    const findSiblingHamlet = (revRecord) => {
        const revEngClean = cleanStr(revRecord.village);
        const revTamClean = cleanStr(revRecord.villageTam);
        const distClean = cleanStr(revRecord.district);
        const distTamClean = cleanStr(revRecord.districtTam);
        const parentClean = cleanStr(revRecord.parentDistrict);
        const talukClean = cleanStr(revRecord.taluk);
        const talukTamClean = cleanStr(revRecord.talukTam);

        let foundEng = '';
        let foundTam = '';

        for (const seg of rawSegments) {
            const sc = cleanStr(seg);
            if (!sc || sc.length < 4) continue;
            if (sc === revEngClean || sc === revTamClean || sc === distClean || sc === distTamClean ||
                (parentClean && sc === parentClean) || sc === talukClean || sc === talukTamClean) {
                continue;
            }
            if (!isHamletLikeToken(seg)) continue;
            // Must NOT itself be a different official Revenue Village in this district
            if (isOfficialTnRevenueVillage(seg, revRecord.district)) continue;

            if (/[\u0B80-\u0BFF]/.test(seg)) {
                if (!foundTam) foundTam = seg;
            } else {
                if (!foundEng) foundEng = toTitleCaseSimple(seg);
            }
        }

        // Also check directVillage if it was a hamlet name while fullAddress carried the parent village
        if (!foundEng && !foundTam && directVillage && isHamletLikeToken(directVillage)) {
            const dc = cleanStr(directVillage);
            if (dc !== revEngClean && dc !== revTamClean && !isOfficialTnRevenueVillage(directVillage, revRecord.district)) {
                if (/[\u0B80-\u0BFF]/.test(directVillage)) foundTam = directVillage;
                else foundEng = toTitleCaseSimple(directVillage);
            }
        }

        if (foundEng || foundTam) {
            // Try deriving missing twin if it's "<RevVillage> <HamletSuffix>"
            if (foundEng && !foundTam) {
                for (const pat of HAMLET_SUFFIX_PATTERNS) {
                    if (pat.re.test(foundEng)) {
                        const biling = buildBilingualHamletFromRoot(foundEng, revRecord, pat);
                        if (biling.areaTam) foundTam = biling.areaTam;
                        break;
                    }
                }
            }
            if (foundTam && !foundEng) {
                for (const pat of HAMLET_SUFFIX_PATTERNS) {
                    if (pat.re.test(foundTam)) {
                        const biling = buildBilingualHamletFromRoot(foundTam, revRecord, pat);
                        if (biling.areaEng) foundEng = biling.areaEng;
                        break;
                    }
                }
            }
            return { isHamlet: true, areaEng: foundEng, areaTam: foundTam };
        }
        return { isHamlet: false, areaEng: '', areaTam: '' };
    };

    // STEP 1: Direct village exact match in 18,595 master
    if (directVillage) {
        const directRes = tryExactToken(directVillage);
        if (directRes && directRes.match) {
            const sib = findSiblingHamlet(directRes.match);
            return {
                record: directRes.match,
                isHamlet: sib.isHamlet,
                areaEng: sib.areaEng,
                areaTam: sib.areaTam,
                ambiguousTaluks: []
            };
        }
        if (directRes && directRes.ambiguousTaluks.length > 1) {
            return {
                record: null,
                isHamlet: false,
                areaEng: '',
                areaTam: '',
                ambiguousTaluks: directRes.ambiguousTaluks
            };
        }

        // STEP 2: Direct village is a Hamlet/Colony suffix of an official Revenue Village (e.g. "Kunnathur Colony")
        const suffixRes = tryHamletSuffixStrip(directVillage);
        if (suffixRes) return suffixRes;
    }

    // STEP 3: Scan comma-separated segments of fullAddress (right-to-left: village usually appears before taluk/district)
    // Guard: When a distinct non-hamlet villageName was explicitly provided (e.g. "Periyavarikkam" with "Ambur Taluk"),
    // NEVER allow a Taluk token inside fullAddress (like "Ambur") to overwrite the citizen's explicit village!
    const dHintNorm = normalizeTnDistrictName(districtHint);
    const skipDistClean = dHintNorm ? cleanStr(dHintNorm.district) : cleanStr(districtHint);
    const skipTalukClean = cleanStr(String(talukHint || '').replace(/\b(taluk|taluka|tk|t\.k\.?|வட்டம்)\b/gi, ''));
    const hasExplicitNonHamletVillage = Boolean(directVillage && !isHamletLikeToken(directVillage));

    for (let i = rawSegments.length - 1; i >= 0; i--) {
        const seg = rawSegments[i];
        const sc = cleanStr(seg);
        if (!sc || sc.length < 3) continue;
        if (skipDistClean && sc === skipDistClean) continue;
        if (hasExplicitNonHamletVillage && ((skipTalukClean && sc === skipTalukClean) || isOfficialTnTaluk(seg))) continue;
        if (STREET_OR_NOISE_RE.test(seg)) continue;
        if (DISTRICT_BY_KEY.has(sc) && sc !== cleanStr(directVillage)) continue;

        const segRes = tryExactToken(seg);
        if (segRes && segRes.match) {
            const sib = findSiblingHamlet(segRes.match);
            return {
                record: segRes.match,
                isHamlet: sib.isHamlet,
                areaEng: sib.areaEng,
                areaTam: sib.areaTam,
                ambiguousTaluks: []
            };
        }
    }

    // STEP 4: Scan address segments for Hamlet/Colony suffix pattern (e.g. "Gandhi Street, Palayapalayam Colony, Nagapattinam")
    for (let i = rawSegments.length - 1; i >= 0; i--) {
        const seg = rawSegments[i];
        const suffixRes = tryHamletSuffixStrip(seg);
        if (suffixRes) return suffixRes;
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
 * Universal Tamil Nadu District, Taluk & 18,595 Revenue Village Master Resolver
 * Priority:
 *   1A. Operator-Verified Learned Village Memory
 *   1B. Curated Confirmed Hamlet & Special Lexicon (District-Aware)
 *   1C. Complete 18,595 Official LGD Revenue Villages Master + Universal Auto-Hamlet Detection
 *   2.  Complete Official 38-District / 318-Taluk Master Registry
 *   3.  Normalized 38-District Passthrough (ZERO blind PIN-code guessing/overwriting!)
 */
function resolveTnDistrict(district = '', taluk = '', village = '', pincode = '', fullAddressText = '') {
    const dClean = cleanStr(district);
    const tClean = cleanStr(taluk);
    const vClean = cleanStr(village);
    const combinedAddr = [village, fullAddressText].filter(Boolean).join(', ');

    // -------------------------------------------------------------------------
    // TIER 1A: Operator-Verified Learned Village->Taluk Memory
    // -------------------------------------------------------------------------
    if (vClean && aiCorrectionMemory && typeof aiCorrectionMemory.lookupLearnedVillage === 'function') {
        const learned = aiCorrectionMemory.lookupLearnedVillage(village);
        if (learned && learned.taluk && learned.district) {
            const distMeta = normalizeTnDistrictName(learned.district);
            const parentDist = distMeta?.parentDistrict || '';
            if (!dClean || isDistrictCompatible(learned.district, parentDist, district)) {
                const expectedDistClean = cleanStr(learned.district);
                const parentDistClean = cleanStr(parentDist);
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
    }

    // -------------------------------------------------------------------------
    // TIER 1B: Curated Revenue Village / Confirmed Hamlet Lexicon (District-Aware)
    // -------------------------------------------------------------------------
    const villageLookup = lookupTnVillage(village, combinedAddr, district);
    const villageMatch = villageLookup ? (villageLookup.item || villageLookup) : null;
    const matchedDirect = villageLookup ? Boolean(villageLookup.matchedDirect) : false;
    if (villageMatch) {
        const expectedDistClean = cleanStr(villageMatch.district);
        const distMeta = normalizeTnDistrictName(villageMatch.district);
        const parentDistClean = cleanStr(distMeta?.parentDistrict || TN_BIFURCATED_TALUKS[villageMatch.district.toLowerCase()]?.parentDistrict || '');

        const wasDistrictCorrected = !dClean.includes(expectedDistClean) || Boolean(parentDistClean && dClean.includes(parentDistClean));
        const wasTalukFilled = !tClean || !tClean.includes(cleanStr(villageMatch.taluk));

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
    // TIER 1C: Complete 18,595 Official LGD Revenue Villages Master + Auto-Hamlet
    // -------------------------------------------------------------------------
    const officialRes = lookupOfficialTnRevenueVillage(village, combinedAddr, district, taluk, pincode);
    if (officialRes && officialRes.record) {
        const rec = officialRes.record;
        const expectedDistClean = cleanStr(rec.district);
        const parentDistClean = cleanStr(rec.parentDistrict || '');
        const wasDistrictCorrected = Boolean(dClean && !dClean.includes(expectedDistClean)) || Boolean(parentDistClean && dClean.includes(parentDistClean));
        const wasTalukFilled = !tClean || !tClean.includes(cleanStr(rec.taluk));

        let reason = null;
        if (wasDistrictCorrected || wasTalukFilled || officialRes.isHamlet) {
            reason = officialRes.isHamlet
                ? `${officialRes.areaTam || officialRes.areaEng} என்பது ${rec.districtTam} மாவட்டம், ${rec.talukTam} வட்டம், ${rec.villageTam || rec.village} வருவாய் கிராமத்தின் கீழ் உள்ள துணைக் கிராமம் (Hamlet/Colony) ஆகும்.`
                : `தமிழக அரசு 18,595 வருவாய் கிராமப் பட்டியலின்படி '${rec.villageTam || rec.village}' கிராமம் '${rec.districtTam}' மாவட்டம், '${rec.talukTam}' வட்டத்தின் கீழ் வருகிறது.`;
        }

        return {
            district: rec.district,
            districtTam: rec.districtTam,
            taluk: rec.taluk,
            talukTam: rec.talukTam,
            village: rec.village,
            villageTam: rec.villageTam || '',
            areaEng: officialRes.isHamlet ? (officialRes.areaEng || undefined) : undefined,
            areaTam: officialRes.isHamlet ? (officialRes.areaTam || undefined) : undefined,
            isHamlet: Boolean(officialRes.isHamlet),
            wasAutoCorrected: wasDistrictCorrected || Boolean(officialRes.isHamlet),
            originalDistrict: district,
            reason
        };
    }

    // -------------------------------------------------------------------------
    // TIER 2: Complete Official 38-District / 318-Taluk Master Registry
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
                ? `தமிழக அரசு 38 மாவட்ட / 318 தாலுகா பட்டியலின்படி '${talukMatch.talukTam}' வட்டம் '${talukMatch.districtTam}' மாவட்டத்தின் கீழ் உள்ளது.`
                : null
        };
    }

    // -------------------------------------------------------------------------
    // TIER 3: Official 38-District Normalization Passthrough (NO Blind PIN Guess!)
    // -------------------------------------------------------------------------
    const normDist = normalizeTnDistrictName(district);
    const resObj = {
        district: normDist ? normDist.district : (district || ''),
        districtTam: normDist ? normDist.districtTam : (district || ''),
        taluk: taluk || '',
        talukTam: taluk || '',
        village: village || '',
        villageTam: '',
        isHamlet: false,
        wasAutoCorrected: false,
        originalDistrict: district,
        reason: null
    };
    if (officialRes && Array.isArray(officialRes.ambiguousTaluks) && officialRes.ambiguousTaluks.length > 1) {
        resObj.ambiguousTaluks = officialRes.ambiguousTaluks;
    }
    return resObj;
}

module.exports = {
    TN_ALL_TALUKS_MASTER,
    TN_ALL_VILLAGES_MASTER,
    TN_BIFURCATED_TALUKS,
    TN_PINCODE_TALUK_MAP,
    TN_VILLAGE_LEXICON,
    normalizeTnDistrictName,
    isOfficialTnTaluk,
    isOfficialTnRevenueVillage,
    lookupTnTaluk,
    lookupTnVillage,
    lookupOfficialTnRevenueVillage,
    lookupTnPincode,
    resolveTnDistrict
};
