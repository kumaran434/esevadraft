/**
 * eSevaDraft Self-Learning AI Correction & Jurisdiction Memory Engine
 *
 * Captures verified operator corrections from Edit Modal saves so:
 * 1. Future Aadhaar AI extractions receive compact, high-signal learned hints
 *    (initials, Tamil spellings, street names, village->taluk mappings).
 * 2. tn_district_mapper automatically learns newly verified standalone Revenue Villages
 *    and their exact Taluk & District (replacing error-prone PIN-code guessing).
 * 3. Strictly ignores regression/test runs so test data never pollutes operator memory.
 */
const fs = require('fs');
const path = require('path');

const MEMORY_PATH = path.join(__dirname, '..', '..', 'data', 'tn_learned_corrections.json');

function isTestRun(mobile = '') {
    const cleanMob = String(mobile || '').replace(/\D/g, '');
    return Boolean(
        process.env.REGRESSION_TEST === 'true' ||
        process.env.NODE_ENV === 'test' ||
        process.env.ESEVA_TEST_MODE === '1' ||
        process.argv.some(a => a.includes('regression_suite') || a.includes('test_')) ||
        cleanMob.startsWith('999990') ||
        cleanMob.startsWith('988877')
    );
}

function normKey(s) {
    return String(s || '').trim().toLowerCase().replace(/[^a-z0-9\u0B80-\u0BFF]/g, '');
}

let cachedMemory = null;
let cachedMtime = 0;

function loadMemory() {
    try {
        if (fs.existsSync(MEMORY_PATH)) {
            const st = fs.statSync(MEMORY_PATH);
            if (cachedMemory && st.mtimeMs === cachedMtime) {
                return cachedMemory;
            }
            const parsed = JSON.parse(fs.readFileSync(MEMORY_PATH, 'utf8'));
            if (parsed && typeof parsed === 'object') {
                cachedMemory = {
                    villageToTaluk: parsed.villageToTaluk || {},
                    fieldCorrections: parsed.fieldCorrections || {}
                };
                cachedMtime = st.mtimeMs;
                return cachedMemory;
            }
        }
    } catch (_) {}
    return { villageToTaluk: {}, fieldCorrections: {} };
}

function saveMemory(mem) {
    try {
        const dir = path.dirname(MEMORY_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(MEMORY_PATH, JSON.stringify(mem, null, 2), 'utf8');
        const st = fs.statSync(MEMORY_PATH);
        cachedMemory = mem;
        cachedMtime = st.mtimeMs;
        return true;
    } catch (_) {
        return false;
    }
}

function lookupLearnedVillage(villageName = '') {
    const key = normKey(villageName);
    if (!key || key.length < 3) return null;
    const mem = loadMemory();
    return mem.villageToTaluk[key] || null;
}

function recordVerifiedVillageTaluk({ village, villageTam, taluk, talukTam, district, districtTam, isHamlet = false, areaEng = '', areaTam = '', mobile = '' } = {}) {
    if (isTestRun(mobile)) return false;
    const vKey = normKey(village);
    const tClean = String(taluk || '').trim();
    const dClean = String(district || '').trim();
    if (!vKey || vKey.length < 3 || !tClean || !dClean) return false;

    const mem = loadMemory();
    const prev = mem.villageToTaluk[vKey] || { count: 0 };
    mem.villageToTaluk[vKey] = {
        village: String(village || '').trim(),
        villageTam: String(villageTam || prev.villageTam || '').trim(),
        taluk: tClean,
        talukTam: String(talukTam || prev.talukTam || '').trim(),
        district: dClean,
        districtTam: String(districtTam || prev.districtTam || '').trim(),
        isHamlet: Boolean(isHamlet),
        areaEng: isHamlet ? String(areaEng || '').trim() : '',
        areaTam: isHamlet ? String(areaTam || '').trim() : '',
        count: (prev.count || 0) + 1,
        updatedAt: new Date().toISOString()
    };
    return saveMemory(mem);
}

function recordFieldCorrection({ fieldKey, beforeVal, afterVal, mobile = '' } = {}) {
    if (isTestRun(mobile)) return false;
    const k = String(fieldKey || '').trim();
    const fromStr = String(beforeVal || '').replace(/\s+/g, ' ').trim();
    const toStr = String(afterVal || '').replace(/\s+/g, ' ').trim();
    if (!k || !fromStr || !toStr || fromStr === toStr) return false;
    if (fromStr.length > 80 || toStr.length > 80) return false;
    // Never store sensitive Aadhaar/mobile digits in prompt learning memory
    if (/\d{6,}/.test(fromStr) || /\d{6,}/.test(toStr)) return false;

    const mem = loadMemory();
    const list = Array.isArray(mem.fieldCorrections[k]) ? mem.fieldCorrections[k] : [];
    const existing = list.find(x => x.from === fromStr && x.to === toStr);
    if (existing) {
        existing.count = (existing.count || 1) + 1;
        existing.updatedAt = new Date().toISOString();
    } else {
        list.push({ from: fromStr, to: toStr, count: 1, updatedAt: new Date().toISOString() });
    }
    // Keep top 25 most frequent / recent entries per field to keep prompt compact
    list.sort((a, b) => (b.count || 1) - (a.count || 1) || String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    mem.fieldCorrections[k] = list.slice(0, 25);
    return saveMemory(mem);
}

function buildDynamicAiPromptHints(maxItems = 14) {
    const mem = loadMemory();
    const lines = [];

    const villageEntries = Object.values(mem.villageToTaluk || {})
        .sort((a, b) => (b.count || 1) - (a.count || 1))
        .slice(0, 6);
    for (const v of villageEntries) {
        lines.push(`- Village "${v.village}"${v.villageTam ? ` (${v.villageTam})` : ''} belongs strictly to Taluk "${v.taluk}", District "${v.district}"${v.isHamlet ? ' [Hamlet]' : ' [Standalone Revenue Village — NEVER append to street]'}.`);
    }

    const trackedFields = ['streetTam', 'areaTam', 'fullNameTam', 'fatherNameTam', 'village'];
    let added = 0;
    for (const fk of trackedFields) {
        const list = mem.fieldCorrections[fk] || [];
        for (const item of list.slice(0, 3)) {
            if (added >= maxItems) break;
            lines.push(`- Learned ${fk} correction: prefer "${item.to}" instead of "${item.from}".`);
            added++;
        }
    }

    if (lines.length === 0) return '';
    return `\nLEARNED OPERATOR CORRECTIONS (Apply these verified Tamil Nadu operator preferences whenever matching text appears):\n${lines.join('\n')}\n`;
}

module.exports = {
    MEMORY_PATH,
    loadMemory,
    saveMemory,
    lookupLearnedVillage,
    recordVerifiedVillageTaluk,
    recordFieldCorrection,
    buildDynamicAiPromptHints
};
