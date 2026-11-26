/**
 * Canonical TNPDS Relationship Normalizer & Dropdown Option Matcher
 * Eliminates substring collisions ("Grand Son" / "Son-in-law" matching "Son",
 * "மருமகன்" matching "மகன்", "Grand Daughter" matching "Daughter", or empty strings matching index 0).
 */

const RELATIONSHIP_DEFS = [
    { key: 'GRAND_SON', eng: 'Grand Son', tam: 'பேரன்', gender: 'Male', genderTam: 'ஆண்', tamAliases: ['பேரன்', 'பெயரன்', 'கிராண்ட்சன்'], engRegex: /\bgrand\s*son\b/i },
    { key: 'GRAND_DAUGHTER', eng: 'Grand Daughter', tam: 'பேத்தி', gender: 'Female', genderTam: 'பெண்', tamAliases: ['பேத்தி', 'பெயர்த்தி', 'கிராண்ட்டாட்டர்'], engRegex: /\bgrand\s*daughter\b/i },
    { key: 'SON_IN_LAW', eng: 'Son-in-law', tam: 'மருமகன்', gender: 'Male', genderTam: 'ஆண்', tamAliases: ['மருமகன்'], engRegex: /\bson\s*in\s*law\b/i },
    { key: 'DAUGHTER_IN_LAW', eng: 'Daughter-in-law', tam: 'மருமகள்', gender: 'Female', genderTam: 'பெண்', tamAliases: ['மருமகள்'], engRegex: /\bdaughter\s*in\s*law\b/i },
    { key: 'FATHER_IN_LAW', eng: 'Father-in-law', tam: 'மாமனார்', gender: 'Male', genderTam: 'ஆண்', tamAliases: ['மாமனார்'], engRegex: /\bfather\s*in\s*law\b/i },
    { key: 'MOTHER_IN_LAW', eng: 'Mother-in-law', tam: 'மாமியார்', gender: 'Female', genderTam: 'பெண்', tamAliases: ['மாமியார்'], engRegex: /\bmother\s*in\s*law\b/i },
    { key: 'HUSBAND', eng: 'Husband', tam: 'கணவர்', gender: 'Male', genderTam: 'ஆண்', tamAliases: ['கணவர்', 'கணவன்'], engRegex: /\bhusband\b/i },
    { key: 'WIFE', eng: 'Wife', tam: 'மனைவி', gender: 'Female', genderTam: 'பெண்', tamAliases: ['மனைவி'], engRegex: /\bwife\b/i },
    { key: 'SON', eng: 'Son', tam: 'மகன்', gender: 'Male', genderTam: 'ஆண்', tamAliases: ['மகன்', 'குமாரன்', 'பையன்'], engRegex: /\bson\b/i },
    { key: 'DAUGHTER', eng: 'Daughter', tam: 'மகள்', gender: 'Female', genderTam: 'பெண்', tamAliases: ['மகள்', 'புதல்வி'], engRegex: /\bdaughter\b/i },
    { key: 'FATHER', eng: 'Father', tam: 'தந்தை', gender: 'Male', genderTam: 'ஆண்', tamAliases: ['தந்தை', 'அப்பா'], engRegex: /\bfather\b/i },
    { key: 'MOTHER', eng: 'Mother', tam: 'தாய்', gender: 'Female', genderTam: 'பெண்', tamAliases: ['தாய்', 'அம்மா'], engRegex: /\bmother\b/i },
    { key: 'BROTHER', eng: 'Brother', tam: 'சகோதரர்', gender: 'Male', genderTam: 'ஆண்', tamAliases: ['சகோதரர்', 'சகோதரன்', 'அண்ணன்', 'தம்பி'], engRegex: /\bbrother\b/i },
    { key: 'SISTER', eng: 'Sister', tam: 'சகோதரி', gender: 'Female', genderTam: 'பெண்', tamAliases: ['சகோதரி', 'அக்கா', 'தங்கை'], engRegex: /\bsister\b/i },
    { key: 'OTHERS', eng: 'Others', tam: 'மற்றவை', gender: 'Male', genderTam: 'ஆண்', tamAliases: ['மற்றவை', 'இதர', 'பிற'], engRegex: /\bothers?\b/i }
];

function normalizeRawText(raw) {
    return String(raw || '')
        .replace(/[_/\-]+/g, ' ')
        .replace(/[()]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function classifyRelationship(rawText) {
    const clean = normalizeRawText(rawText);
    if (!clean) return null;

    // 1. Check exact Tamil alias or token match first (compound defs are ordered before simple defs)
    for (const def of RELATIONSHIP_DEFS) {
        if (def.tamAliases.some(alias => clean.includes(alias))) {
            return def;
        }
    }

    // 2. Check English normalized regex (handles Grand Son / Grandson before Son, etc.)
    const spacedCompound = clean
        .replace(/grandson/gi, 'grand son')
        .replace(/granddaughter/gi, 'grand daughter');
    for (const def of RELATIONSHIP_DEFS) {
        if (def.engRegex.test(spacedCompound)) {
            return def;
        }
    }
    return null;
}

/**
 * Normalizes a (relTam, relEng) pair into consistent canonical fields.
 * Prioritizes Tamil if explicitly provided (since Edit Modal / chat options store Tamil cleanly),
 * falling back to English when Tamil is absent or unmapped.
 */
function normalizeRelationshipPair(relTam, relEng) {
    const tamStr = String(relTam || '').trim();
    const engStr = String(relEng || '').trim();
    const defFromTam = classifyRelationship(tamStr);
    const defFromEng = classifyRelationship(engStr);
    const def = defFromTam || defFromEng;

    if (def) {
        return {
            key: def.key,
            tam: def.tam,
            eng: def.eng,
            gender: def.gender,
            genderTam: def.genderTam
        };
    }

    return {
        key: null,
        tam: tamStr,
        eng: engStr,
        gender: '',
        genderTam: ''
    };
}

function isPlaceholderOption(opt) {
    const text = String(opt?.text || '').trim();
    const val = String(opt?.value ?? '').trim();
    if (!text && !val) return true;
    const valLower = val.toLowerCase();
    if (valLower === '0' || valLower === 'null' || valLower === 'undefined') return true;
    if (/^(select|choose|--|\s*தேர்ந்தெடுக்க|\s*தேர்வு\s*செய்ய)/i.test(text)) return true;
    return false;
}

/**
 * Finds the exact matching <option> from a dropdown list for the target relationship.
 * Never allows substring collisions (e.g. Son matching Grand Son, Daughter matching Grand Daughter).
 */
function findBestRelationshipOption(options = [], relTam = '', relEng = '') {
    const normalizedOpts = (Array.isArray(options) ? options : []).map((o, idx) => (
        typeof o === 'string'
            ? { index: idx, value: o, text: o }
            : { index: typeof o.index === 'number' ? o.index : idx, value: String(o.value ?? ''), text: String(o.text ?? o.label ?? '').trim() }
    ));

    const nonPlaceholder = normalizedOpts.filter(o => !isPlaceholderOption(o));
    const target = normalizeRelationshipPair(relTam, relEng);
    const rawTamNorm = normalizeRawText(relTam).toLowerCase();
    const rawEngNorm = normalizeRawText(relEng).toLowerCase();

    // Priority 1: Exact normalized text/value equality with target labels
    const exactLabels = new Set([
        target.tam && normalizeRawText(target.tam).toLowerCase(),
        target.eng && normalizeRawText(target.eng).toLowerCase(),
        rawTamNorm,
        rawEngNorm
    ].filter(Boolean));

    for (const opt of nonPlaceholder) {
        const tNorm = normalizeRawText(opt.text).toLowerCase();
        const vNorm = normalizeRawText(opt.value).toLowerCase();
        if (tNorm && exactLabels.has(tNorm)) return opt;
        if (vNorm && exactLabels.has(vNorm)) return opt;
    }

    // Priority 2: Canonical key match on option text, then on option value
    if (target.key) {
        for (const opt of nonPlaceholder) {
            const cls = classifyRelationship(opt.text);
            if (cls && cls.key === target.key) return opt;
        }
        for (const opt of nonPlaceholder) {
            const cls = classifyRelationship(opt.value);
            if (cls && cls.key === target.key) return opt;
        }
    }

    return null;
}

module.exports = {
    RELATIONSHIP_DEFS,
    classifyRelationship,
    normalizeRelationshipPair,
    findBestRelationshipOption
};
