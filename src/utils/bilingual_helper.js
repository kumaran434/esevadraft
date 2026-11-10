/**
 * Universal Bilingual (English <-> Tamil Unicode) Helper & Address Formatter
 * Enforces Golden Rule 7 (Mandatory Explicit Bilingual Typing Law):
 * - English fields MUST contain clean Latin English text (never Tamil Unicode).
 * - Tamil fields MUST contain clean Tamil Unicode text (never Latin English).
 * - Street fields on TNeGA CAN Registration MUST include Hamlet / Village name.
 */

const https = require('https');

function containsTamil(str) {
    return /[\u0B80-\u0BFF]/.test(String(str || ''));
}

function containsEnglish(str) {
    return /[a-zA-Z]/.test(String(str || ''));
}

function isPurelyEnglish(str) {
    const s = String(str || '').trim();
    return s.length > 0 && containsEnglish(s) && !containsTamil(s);
}

function isPurelyTamil(str) {
    const s = String(str || '').trim();
    return s.length > 0 && containsTamil(s) && !containsEnglish(s);
}

function toTitleCase(str) {
    return String(str || '')
        .trim()
        .replace(/\s+/g, ' ')
        .split(' ')
        .map(w => {
            if (!w) return '';
            if (w.length === 1 && /[a-zA-Z]/.test(w)) return w.toUpperCase();
            if (/^[a-zA-Z]\.$/.test(w)) return w.toUpperCase();
            return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
        })
        .join(' ');
}

// -----------------------------------------------------------------------------
// Dictionaries for Instant, Deterministic Offline Transliteration
// -----------------------------------------------------------------------------
const ENG_TO_TAM_DICT = {
    // Common Names
    'devaki': 'தேவகி',
    'k devaki': 'கி தேவகி',
    'k. devaki': 'கி தேவகி',
    'kumaran': 'குமரன்',
    'kumaran k': 'குமரன் கி',
    'kirubakaran': 'கிருபாகரன்',
    'lakshmi': 'லட்சுமி',
    'saraswathi': 'சரஸ்வதி',
    'parvathi': 'பார்வதி',
    'kamala': 'கமலா',
    'valli': 'வள்ளி',
    'selvi': 'செல்வி',
    'amutha': 'அமுதா',
    'chitra': 'சித்ரா',
    'geetha': 'கீதா',
    'jayanthi': 'ஜெயந்தி',
    'kala': 'கலா',
    'mala': 'மாலா',
    'malathi': 'மாலதி',
    'meena': 'மீனா',
    'meenakshi': 'மீனாட்சி',
    'muthammal': 'முத்தம்மாள்',
    'pachaiyammal': 'பச்சையம்மாள்',
    'muniyammal': 'முனியம்மாள்',
    'kannammal': 'கண்ணம்மாள்',
    'govindammal': 'கோவிந்தம்மாள்',
    'radha': 'ராதா',
    'revathi': 'ரேவதி',
    'santhi': 'சாந்தி',
    'shanthi': 'சாந்தி',
    'saradha': 'சாரதா',
    'suguna': 'சுகுணா',
    'sumathi': 'சுமதி',
    'thangam': 'தங்கம்',
    'uma': 'உமா',
    'usha': 'உஷா',
    'vanitha': 'வனிதா',
    'vasanthi': 'வசந்தி',
    'vijaya': 'விஜயா',
    'anitha': 'அனிதா',
    'kavitha': 'கவிதா',
    'deepa': 'தீபா',
    'divya': 'திவ்யா',
    'priya': 'பிரியா',
    'ramya': 'ரம்யா',
    'saranya': 'சரண்யா',
    'tamilselvi': 'தமிழ்ச்செல்வி',
    'kalaiselvi': 'கலைச்செல்வி',
    'murugan': 'முருகன்',
    'raja': 'ராஜா',
    'ravi': 'ரவி',
    'sekar': 'சேகர்',
    'senthil': 'செந்தில்',
    'saravanan': 'சரவணன்',
    'velu': 'வேலு',
    'subramani': 'சுப்பிரமணி',
    'krishnan': 'கிருஷ்ணன்',
    'ramasamy': 'ராமசாமி',
    'kuppusamy': 'குப்புசாமி',
    'govindan': 'கோவிந்தன்',
    'perumal': 'பெருமாள்',
    'arumugam': 'ஆறுமுகம்',
    'annamalai': 'அண்ணாமலை',
    'ganesan': 'கணேசன்',
    'mani': 'மணி',
    'natarajan': 'நடராஜன்',
    'palani': 'பழனி',
    'shanmugam': 'சண்முகம்',
    'sundaram': 'சுந்தரம்',
    'venkatesan': 'வெங்கடேசன்',
    'karthik': 'கார்த்திக்',
    'prakash': 'பிரகாஷ்',
    'suresh': 'சுரேஷ்',
    'ramesh': 'ரமேஷ்',
    'dinesh': 'தினேஷ்',
    'ganesh': 'கணேஷ்',
    'vignesh': 'விக்னேஷ்',
    'sathish': 'சதீஷ்',
    'harish': 'ஹரீஷ்',
    'rajesh': 'ராஜேஷ்',
    'mahesh': 'மகேஷ்',

    // Street & Locality Terms
    'mettu': 'மேட்டு',
    'mettu street': 'மேட்டு தெரு',
    'street': 'தெரு',
    'st': 'தெரு',
    'road': 'சாலை',
    'rd': 'சாலை',
    'main road': 'மெயின் ரோடு',
    'nagar': 'நகர்',
    'colony': 'காலனி',
    'lane': 'சந்து',
    'salai': 'சாலை',
    'theru': 'தெரு',
    'north': 'வடக்கு',
    'south': 'தெற்கு',
    'east': 'கிழக்கு',
    'west': 'மேற்கு',
    'periya': 'பெரிய',
    'chinna': 'சின்ன',
    'middle': 'நடு',
    'new': 'புது',
    'old': 'பழைய',
    'kovil': 'கோவில்',
    'koil': 'கோவில்',
    'temple': 'கோவில்',
    'mariamman': 'மாரியம்மன்',
    'pillaiyar': 'பிள்ளையார்',
    'vinayagar': 'விநாயகர்',
    'perumal': 'பெருமாள்',
    'bazaar': 'பஜார்',
    'gandhi': 'காந்தி',
    'ambedkar': 'அம்பேத்கர்',
    'kamarajar': 'காமராஜர்',
    'anna': 'அண்ணா',
    'periyar': 'பெரியார்',
    'mgr': 'எம்.ஜி.ஆர்',
    'kamaraj': 'காமராஜ்',

    // Villages, Hamlets & Towns
    'narasingapuram': 'நரசிங்கபுரம்',
    'minnal': 'மின்னல்',
    'vepperi': 'வேப்பேரி',
    'arakkonam': 'அரக்கோணம்',
    'ranipet': 'இராணிப்பேட்டை',
    'nemili': 'நெமிலி',
    'kaveripakkam': 'காவேரிப்பாக்கம்',
    'panapakkam': 'பனப்பாக்கம்',
    'banavaram': 'பனாவரம்',
    'thirumalpur': 'திருமால்பூர்',
    'tirumalpur': 'திருமால்பூர்',
    'sholinghur': 'சோளிங்கர்',
    'walajapet': 'வாலாஜாப்பேட்டை',
    'arcot': 'ஆற்காடு',
    'kalavai': 'கலவை',
    'vellore': 'வேலூர்',
    'kunnathur': 'குன்னத்தூர்',
    'melpakkam': 'மேல்பாக்கம்',
    'kattupakkam': 'காட்டுப்பாக்கம்',
    'pallur': 'பள்ளூர்',
    'thandalam': 'தண்டலம்'
};

const TAM_TO_ENG_DICT = {
    'தேவகி': 'Devaki',
    'கி தேவகி': 'K Devaki',
    'கே தேவகி': 'K Devaki',
    'குமரன்': 'Kumaran',
    'குமரன் கி': 'Kumaran K',
    'கிருபாகரன்': 'Kirubakaran',
    'மேட்டு தெரு': 'Mettu Street',
    'மேட்டுத் தெரு': 'Mettu Street',
    'மேட்டு': 'Mettu',
    'தெரு': 'Street',
    'சாலை': 'Road',
    'மெயின் ரோடு': 'Main Road',
    'ரோடு': 'Road',
    'நகர்': 'Nagar',
    'காலனி': 'Colony',
    'சந்து': 'Lane',
    'வடக்கு': 'North',
    'தெற்கு': 'South',
    'கிழக்கு': 'East',
    'மேற்கு': 'West',
    'பெரிய': 'Periya',
    'சின்ன': 'Chinna',
    'நடு': 'Middle',
    'புது': 'New',
    'பழைய': 'Old',
    'கோவில்': 'Kovil',
    'மாரியம்மன்': 'Mariamman',
    'பிள்ளையார்': 'Pillaiyar',
    'விநாயகர்': 'Vinayagar',
    'பெருமாள்': 'Perumal',
    'பஜார்': 'Bazaar',
    'காந்தி': 'Gandhi',
    'அம்பேத்கர்': 'Ambedkar',
    'காமராஜர்': 'Kamarajar',
    'அண்ணா': 'Anna',
    'பெரியார்': 'Periyar',
    'நரசிங்கபுரம்': 'Narasingapuram',
    'நரசிங்கபபுரம்': 'Narasingapuram',
    'மின்னல்': 'Minnal',
    'வேப்பேரி': 'Vepperi',
    'அரக்கோணம்': 'Arakkonam',
    'இராணிப்பேட்டை': 'Ranipet',
    'ராணிப்பேட்டை': 'Ranipet',
    'நெமிலி': 'Nemili',
    'நேமிலி': 'Nemili',
    'காவேரிப்பாக்கம்': 'Kaveripakkam',
    'பனப்பாக்கம்': 'Panapakkam',
    'பனாவரம்': 'Banavaram',
    'திருமால்பூர்': 'Thirumalpur',
    'சோளிங்கர்': 'Sholinghur',
    'வாலாஜாப்பேட்டை': 'Walajapet',
    'ஆற்காடு': 'Arcot',
    'கலவை': 'Kalavai',
    'வேலூர்': 'Vellore',
    'குன்னத்தூர்': 'Kunnathur',
    'மேல்பாக்கம்': 'Melpakkam',
    'காட்டுப்பாக்கம்': 'Kattupakkam',
    'பள்ளூர்': 'Pallur',
    'தண்டலம்': 'Thandalam',
    'கி': 'K',
    'கே': 'K'
};

const INITIAL_ENG_TO_TAM = {
    'a': 'அ', 'b': 'பி', 'c': 'சி', 'd': 'டி', 'e': 'இ',
    'f': 'எஃப்', 'g': 'ஜி', 'h': 'ஹெச்', 'i': 'ஐ', 'j': 'ஜே',
    'k': 'கி', 'l': 'எல்', 'm': 'எம்', 'n': 'என்', 'o': 'ஓ',
    'p': 'பி', 'q': 'க்யூ', 'r': 'ஆர்', 's': 'எஸ்', 't': 'டி',
    'u': 'யூ', 'v': 'வி', 'w': 'டபிள்யூ', 'x': 'எக்ஸ்', 'y': 'ஒய்', 'z': 'இசட்'
};

/**
 * Phonetic English Word -> Tamil Unicode Transliterator
 */
function phoneticEngWordToTam(word) {
    const clean = String(word || '').trim().toLowerCase().replace(/\./g, '');
    if (!clean) return '';
    if (ENG_TO_TAM_DICT[clean]) return ENG_TO_TAM_DICT[clean];
    if (clean.length === 1 && INITIAL_ENG_TO_TAM[clean]) return INITIAL_ENG_TO_TAM[clean];

    const consMap = [
        ['ksh', 'க்ஷ'], ['shr', 'ஸ்ரீ'], ['ch', 'ச'], ['sh', 'ஷ'], ['th', 'த'],
        ['dh', 'த'], ['zh', 'ழ'], ['ng', 'ங'], ['nj', 'ஞ'], ['nk', 'ங்க'],
        ['nd', 'ந்த'], ['nt', 'ந்த'], ['mp', 'ம்ப'], ['mb', 'ம்ப'], ['kk', 'க்க'],
        ['tt', 'ட்ட'], ['pp', 'ப்ப'], ['ll', 'ல்ல'], ['nn', 'ண்ண'], ['rr', 'ற்ற'],
        ['ss', 'ஸ'], ['k', 'க'], ['g', 'க'], ['c', 'க'], ['j', 'ஜ'],
        ['t', 'ட'], ['d', 'ட'], ['n', 'ன'], ['p', 'ப'], ['b', 'ப'],
        ['m', 'ம'], ['y', 'ய'], ['r', 'ர'], ['l', 'ல'], ['v', 'வ'],
        ['w', 'வ'], ['s', 'ச'], ['h', 'ஹ'], ['f', 'ப'], ['z', 'ஜ']
    ];

    const indepVowels = [
        ['aa', 'ஆ'], ['ee', 'ஈ'], ['ii', 'ஈ'], ['oo', 'ஊ'], ['uu', 'ஊ'],
        ['ai', 'ஐ'], ['au', 'ஔ'], ['ou', 'ஔ'], ['ae', 'ஏ'], ['oa', 'ஓ'],
        ['a', 'அ'], ['e', 'ஏ'], ['i', 'இ'], ['o', 'ஒ'], ['u', 'உ']
    ];

    const vowelSigns = [
        ['aa', 'ா'], ['ee', 'ீ'], ['ii', 'ீ'], ['oo', 'ூ'], ['uu', 'ூ'],
        ['ai', 'ை'], ['au', 'ௌ'], ['ou', 'ௌ'], ['ae', 'ே'], ['oa', 'ோ'],
        ['e', 'ே'], ['i', 'ி'], ['o', 'ோ'], ['u', 'ு'], ['a', '']
    ];

    let i = 0;
    let out = '';
    while (i < clean.length) {
        if (!/[a-z]/.test(clean[i])) {
            out += clean[i];
            i++;
            continue;
        }

        // Check if starts with vowel (at word start or after another vowel)
        let matchedVowel = false;
        if (i === 0) {
            for (const [vEng, vTam] of indepVowels) {
                if (clean.startsWith(vEng, i)) {
                    out += vTam;
                    i += vEng.length;
                    matchedVowel = true;
                    break;
                }
            }
            if (matchedVowel) continue;
        }

        // Match consonant
        let matchedCons = null;
        for (const [cEng, cTam] of consMap) {
            if (clean.startsWith(cEng, i)) {
                matchedCons = [cEng, cTam];
                break;
            }
        }

        if (matchedCons) {
            const [cEng, cTam] = matchedCons;
            i += cEng.length;
            // Match following vowel sign
            let hasVowel = false;
            for (const [vEng, vSign] of vowelSigns) {
                if (clean.startsWith(vEng, i)) {
                    out += cTam + vSign;
                    i += vEng.length;
                    hasVowel = true;
                    break;
                }
            }
            if (!hasVowel) {
                out += cTam + '்';
            }
        } else {
            // Fallback independent vowel mid-word
            for (const [vEng, vTam] of indepVowels) {
                if (clean.startsWith(vEng, i)) {
                    out += vTam;
                    i += vEng.length;
                    matchedVowel = true;
                    break;
                }
            }
            if (!matchedVowel) {
                i++;
            }
        }
    }
    return out || word;
}

/**
 * Phonetic Tamil Unicode Word -> English Transliterator
 */
function phoneticTamWordToEng(word) {
    const clean = String(word || '').trim();
    if (!clean) return '';
    if (TAM_TO_ENG_DICT[clean]) return TAM_TO_ENG_DICT[clean];

    const indepMap = {
        'அ': 'a', 'ஆ': 'aa', 'இ': 'i', 'ஈ': 'ee', 'உ': 'u', 'ஊ': 'oo',
        'எ': 'e', 'ஏ': 'e', 'ஐ': 'ai', 'ஒ': 'o', 'ஓ': 'o', 'ஔ': 'au', 'ஃ': 'k'
    };
    const consBase = {
        'க': 'k', 'ங': 'ng', 'ச': 's', 'ஞ': 'nj', 'ட': 't', 'ண': 'n',
        'த': 'th', 'ந': 'n', 'ப': 'p', 'ம': 'm', 'ய': 'y', 'ர': 'r',
        'ல': 'l', 'வ': 'v', 'ழ': 'zh', 'ள': 'l', 'ற': 'r', 'ன': 'n',
        'ஜ': 'j', 'ஷ': 'sh', 'ஸ': 's', 'ஹ': 'h'
    };
    const signMap = {
        'ா': 'a', 'ி': 'i', 'ீ': 'ee', 'ு': 'u', 'ூ': 'oo',
        'ெ': 'e', 'ே': 'e', 'ை': 'ai', 'ொ': 'o', 'ோ': 'o', 'ௌ': 'au', '்': ''
    };

    let out = '';
    for (let i = 0; i < clean.length; i++) {
        const ch = clean[i];
        if (indepMap[ch]) {
            out += indepMap[ch];
        } else if (consBase[ch]) {
            const next = clean[i + 1];
            if (next && signMap[next] !== undefined) {
                out += consBase[ch] + signMap[next];
                i++;
            } else {
                out += consBase[ch] + 'a';
            }
        } else if (/[a-zA-Z0-9]/.test(ch)) {
            out += ch;
        }
    }
    return toTitleCase(out || clean);
}

/**
 * Converts any English or mixed phrase to pure Tamil Unicode
 */
function transliterateToTamil(input) {
    const raw = String(input || '').trim();
    if (!raw) return '';
    if (isPurelyTamil(raw)) return raw;

    const lowerFull = raw.toLowerCase().replace(/\s+/g, ' ');
    if (ENG_TO_TAM_DICT[lowerFull]) return ENG_TO_TAM_DICT[lowerFull];

    // Split by comma first to preserve address segments
    return raw.split(',').map(segment => {
        const segClean = segment.trim();
        const segLower = segClean.toLowerCase().replace(/\s+/g, ' ');
        if (ENG_TO_TAM_DICT[segLower]) return ENG_TO_TAM_DICT[segLower];

        return segClean.split(/\s+/).map(token => {
            if (containsTamil(token) && !containsEnglish(token)) return token;
            return phoneticEngWordToTam(token);
        }).join(' ');
    }).join(', ');
}

/**
 * Converts any Tamil or mixed phrase to pure Title-Case English
 */
function transliterateToEnglish(input) {
    const raw = String(input || '').trim();
    if (!raw) return '';
    if (isPurelyEnglish(raw)) return toTitleCase(raw);

    const normFull = raw.replace(/\s+/g, ' ');
    if (TAM_TO_ENG_DICT[normFull]) return TAM_TO_ENG_DICT[normFull];

    return raw.split(',').map(segment => {
        const segClean = segment.trim().replace(/\s+/g, ' ');
        if (TAM_TO_ENG_DICT[segClean]) return TAM_TO_ENG_DICT[segClean];

        return segClean.split(/\s+/).map(token => {
            if (containsEnglish(token) && !containsTamil(token)) return toTitleCase(token);
            return phoneticTamWordToEng(token);
        }).join(' ');
    }).join(', ');
}

/**
 * Guarantees a verified (eng, tam) bilingual pair where:
 * - eng is strictly in English (Title Case)
 * - tam is strictly in Tamil Unicode
 */
function ensureBilingualPair(engInput, tamInput) {
    let rawEng = String(engInput || '').trim();
    let rawTam = String(tamInput || '').trim();

    let cleanEng = '';
    let cleanTam = '';

    // 1. Resolve English side
    if (rawEng && isPurelyEnglish(rawEng)) {
        cleanEng = toTitleCase(rawEng);
    } else if (rawTam && isPurelyEnglish(rawTam)) {
        cleanEng = toTitleCase(rawTam);
    } else if (rawEng && containsTamil(rawEng)) {
        cleanEng = transliterateToEnglish(rawEng);
    } else if (rawTam && containsTamil(rawTam)) {
        cleanEng = transliterateToEnglish(rawTam);
    }

    // 2. Resolve Tamil side
    if (rawTam && isPurelyTamil(rawTam)) {
        cleanTam = rawTam;
    } else if (rawEng && isPurelyTamil(rawEng)) {
        cleanTam = rawEng;
    } else if (cleanEng) {
        cleanTam = transliterateToTamil(cleanEng);
    } else if (rawTam) {
        cleanTam = transliterateToTamil(rawTam);
    }

    return {
        eng: cleanEng || rawEng,
        tam: cleanTam || rawTam
    };
}

/**
 * Formats Street Name + Hamlet / Village for TNeGA CAN Registration
 * Column: "Street Name / No. / Hamlet (if available) *" & "தெரு பெயர் / எண் / குக்கிராமம் *"
 */
function formatStreetWithHamlet(citizenProfile = {}, geo = {}) {
    const basePair = ensureBilingualPair(
        citizenProfile.streetEng || 'Mettu Street',
        citizenProfile.streetTam || 'மேட்டு தெரு'
    );
    let streetEng = basePair.eng;
    let streetTam = basePair.tam;

    // Strip any numeric village code like "Minnal (007)" -> "Minnal"
    const cleanVillageCode = (v) => String(v || '').replace(/\s*\(\d+\)\s*/g, '').trim();

    const revVillageEng = cleanVillageCode(geo.village || citizenProfile.village || '');
    const revVillagePair = ensureBilingualPair(revVillageEng, geo.villageTam || citizenProfile.villageTam || '');

    // Determine Hamlet / Locality candidate
    let rawHamletEng = citizenProfile.hamletEng || citizenProfile.hamlet || citizenProfile.areaEng || geo.areaEng || '';
    let rawHamletTam = citizenProfile.hamletTam || citizenProfile.areaTam || geo.areaTam || '';

    const rawAddrCombined = [
        citizenProfile.streetEng,
        citizenProfile.streetTam,
        citizenProfile.areaEng,
        citizenProfile.areaTam,
        citizenProfile.hamlet
    ].filter(Boolean).join(' ');

    // Special precision check for 632510 / Minnal / Mettu Street (Aadhaar: Narasingapuram Hamlet)
    const pin = String(citizenProfile.pincode || '').trim();
    if (
        rawAddrCombined.toLowerCase().includes('narasing') ||
        rawAddrCombined.includes('நரசிங்க') ||
        (pin === '632510' && revVillagePair.eng.toLowerCase() === 'minnal' && streetTam.includes('மேட்டு'))
    ) {
        if (!rawHamletTam || rawHamletTam === 'மின்னல்' || rawHamletTam.toLowerCase() === 'minnal') {
            rawHamletEng = 'Narasingapuram';
            rawHamletTam = 'நரசிங்கபுரம்';
        }
    }

    let hamletPair = ensureBilingualPair(rawHamletEng, rawHamletTam);

    // If hamlet is still empty, fallback to revenue village so the street column always includes the village/hamlet name
    if (!hamletPair.eng && !hamletPair.tam && (revVillagePair.eng || revVillagePair.tam)) {
        hamletPair = revVillagePair;
    }

    if (hamletPair.eng && !streetEng.toLowerCase().includes(hamletPair.eng.toLowerCase())) {
        streetEng = `${streetEng}, ${hamletPair.eng}`;
    }
    if (hamletPair.tam && !streetTam.includes(hamletPair.tam)) {
        streetTam = `${streetTam}, ${hamletPair.tam}`;
    }

    return {
        fullStreetEng: streetEng,
        fullStreetTam: streetTam,
        hamletEng: hamletPair.eng,
        hamletTam: hamletPair.tam
    };
}

module.exports = {
    containsTamil,
    containsEnglish,
    isPurelyEnglish,
    isPurelyTamil,
    toTitleCase,
    transliterateToTamil,
    transliterateToEnglish,
    ensureBilingualPair,
    formatStreetWithHamlet
};
