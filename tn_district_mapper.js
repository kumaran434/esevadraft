/**
 * Tamil Nadu District, Taluk & Village Reverse Resolver
 * 
 * Handles Tamil Nadu district bifurcations where citizens' Aadhaar cards
 * still reflect old parent district names (e.g. Vellore instead of Ranipet/Tirupathur,
 * Kanchipuram instead of Chengalpattu, Villupuram instead of Kallakurichi,
 * Tirunelveli instead of Tenkasi, Nagapattinam instead of Mayiladuthurai).
 * 
 * Accurately auto-resolves District, Taluk, and Revenue Village based on:
 * 1. Specific Village / Hamlet / Town names (English & Tamil)
 * 2. Exact 6-Digit Postal PIN Codes
 * 3. Taluk Names
 * 4. 4-Digit PIN Code Prefixes
 */

const TN_BIFURCATED_TALUKS = require('./data/tn_bifurcated_taluks');
const TN_PINCODE_TALUK_MAP = require('./data/tn_pincode_taluk_map');
const TN_VILLAGE_LEXICON = require('./data/tn_village_lexicon');

function cleanStr(s) {
    return (s || '').trim().toLowerCase().replace(/[^a-z0-9\u0B80-\u0BFF]/g, '');
}

/**
 * Lookup Village in Master Lexicon
 */
function lookupTnVillage(villageName = '', fullAddress = '') {
    const vClean = cleanStr(villageName);
    const addrClean = cleanStr(fullAddress);

    // 1. Direct match on villageName
    if (vClean) {
        for (const item of TN_VILLAGE_LEXICON) {
            if (item.names.some(n => {
                const nClean = cleanStr(n);
                return vClean === nClean || vClean.includes(nClean) || nClean.includes(vClean);
            })) {
                return item;
            }
        }
    }

    // 2. Scan fullAddress string if village name didn't match directly
    if (addrClean) {
        for (const item of TN_VILLAGE_LEXICON) {
            if (item.names.some(n => {
                const nClean = cleanStr(n);
                return nClean.length >= 4 && addrClean.includes(nClean);
            })) {
                return item;
            }
        }
    }

    return null;
}

/**
 * Lookup Pincode in Master 6-Digit Map
 */
function lookupTnPincode(pincode = '') {
    const pin = (pincode || '').trim().replace(/\D/g, '');
    if (pin.length === 6 && TN_PINCODE_TALUK_MAP[pin]) {
        return TN_PINCODE_TALUK_MAP[pin];
    }
    return null;
}

/**
 * Universal Tamil Nadu District, Taluk & Village Reverse Resolver
 */
function resolveTnDistrict(district = '', taluk = '', village = '', pincode = '', fullAddressText = '') {
    const dClean = cleanStr(district);
    const tClean = cleanStr(taluk);
    const vClean = cleanStr(village);
    const pinStr = (pincode || '').trim().replace(/\D/g, '');
    const combinedAddr = [village, taluk, fullAddressText].filter(Boolean).join(' ');

    // -------------------------------------------------------------------------
    // TIER 1: Match by Village / Town / Hamlet Lexicon (Highest Precision)
    // -------------------------------------------------------------------------
    const villageMatch = lookupTnVillage(village, combinedAddr);
    if (villageMatch) {
        const expectedDistClean = cleanStr(villageMatch.district);
        const parentDistClean = cleanStr(TN_BIFURCATED_TALUKS[villageMatch.district.toLowerCase()]?.parentDistrict || '');
        
        const wasDistrictCorrected = !dClean.includes(expectedDistClean) || (parentDistClean && dClean.includes(parentDistClean));
        const wasTalukFilled = !tClean || !tClean.includes(cleanStr(villageMatch.taluk));

        let reason = null;
        if (wasDistrictCorrected || wasTalukFilled) {
            reason = villageMatch.isHamlet
                ? `${villageMatch.areaTam || village} என்பது ${villageMatch.talukTam} வட்டம் ${villageMatch.villageTam} வருவாய் கிராமத்தின் கீழ் உள்ள துணைக் கிராமம் (Hamlet Village) ஆகும். இது ${villageMatch.districtTam} மாவட்டத்தின் கீழ் வருகிறது.`
                : `ஆதார் அட்டையில் '${district || 'பழைய மாவட்டம்'}' என இருந்தாலும், ${villageMatch.villageTam} (${villageMatch.village}) தமிழக அரசு விதிகளின்படி ${villageMatch.districtTam} மாவட்டம், ${villageMatch.talukTam} வட்டத்தின் கீழ் வருகிறது.`;
        }

        return {
            district: villageMatch.district,
            districtTam: villageMatch.districtTam,
            taluk: villageMatch.taluk,
            talukTam: villageMatch.talukTam,
            village: villageMatch.village,
            villageTam: villageMatch.villageTam,
            areaEng: villageMatch.areaEng || undefined,
            areaTam: villageMatch.areaTam || undefined,
            wasAutoCorrected: wasDistrictCorrected || villageMatch.isHamlet,
            originalDistrict: district,
            reason: reason
        };
    }

    // -------------------------------------------------------------------------
    // TIER 2: Match by Exact 6-Digit Postal PIN Code
    // -------------------------------------------------------------------------
    const pinMatch = lookupTnPincode(pinStr);
    if (pinMatch) {
        const expectedDistClean = cleanStr(pinMatch.district);
        const parentDistClean = cleanStr(TN_BIFURCATED_TALUKS[pinMatch.district.toLowerCase()]?.parentDistrict || '');
        
        const wasDistrictCorrected = !dClean.includes(expectedDistClean) || (parentDistClean && dClean.includes(parentDistClean));
        const wasTalukFilled = !tClean || !tClean.includes(cleanStr(pinMatch.taluk));

        let reason = null;
        if (wasDistrictCorrected || wasTalukFilled) {
            reason = `ஆதார் அட்டையில் '${district || 'பழைய மாவட்டம்'}' என இருந்தாலும், பின்கோடு (${pinStr}) தமிழக அரசு போர்ட்டலில் '${pinMatch.districtTam}' மாவட்டம், '${pinMatch.talukTam}' வட்டத்தின் கீழ் வருகிறது.`;
        }

        const autoVillage = village || (pinMatch.villages && pinMatch.villages[0]) || '';
        return {
            district: pinMatch.district,
            districtTam: pinMatch.districtTam,
            taluk: pinMatch.taluk,
            talukTam: pinMatch.talukTam,
            village: autoVillage,
            wasAutoCorrected: wasDistrictCorrected,
            originalDistrict: district,
            reason: reason
        };
    }

    // -------------------------------------------------------------------------
    // TIER 3: Match by Taluk Name against Bifurcation Registry
    // -------------------------------------------------------------------------
    for (const [distKey, info] of Object.entries(TN_BIFURCATED_TALUKS)) {
        if (tClean) {
            const matchedTaluk = info.taluks.find(t => tClean.includes(cleanStr(t)) || cleanStr(t).includes(tClean));
            if (matchedTaluk) {
                const parentDistClean = cleanStr(info.parentDistrict || '');
                const wasCorrected = parentDistClean && dClean.includes(parentDistClean);
                const talukIdx = info.taluks.indexOf(matchedTaluk);
                const talukTamName = (info.taluksTam && info.taluksTam[talukIdx]) || matchedTaluk;

                return {
                    district: info.nameEng,
                    districtTam: info.nameTam,
                    taluk: taluk || matchedTaluk,
                    talukTam: talukTamName,
                    village: village,
                    wasAutoCorrected: !!wasCorrected,
                    originalDistrict: district,
                    reason: wasCorrected 
                        ? `ஆதார் அட்டையில் '${district}' என இருந்தாலும், தமிழக அரசு போர்ட்டலில் '${taluk}' வட்டம் '${info.nameTam}' மாவட்டத்தின் கீழ் உள்ளது.`
                        : null
                };
            }
        }
    }

    // -------------------------------------------------------------------------
    // TIER 4: 4-Digit Pincode Prefix Fallback
    // -------------------------------------------------------------------------
    if (pinStr.length >= 4) {
        for (const [distKey, info] of Object.entries(TN_BIFURCATED_TALUKS)) {
            if (info.pincodePrefixes.some(pfx => pinStr.startsWith(pfx.substring(0, 4)))) {
                const parentDistClean = cleanStr(info.parentDistrict || '');
                const wasCorrected = parentDistClean && dClean.includes(parentDistClean);
                return {
                    district: info.nameEng,
                    districtTam: info.nameTam,
                    taluk: taluk || info.taluks[0],
                    talukTam: (info.taluksTam && info.taluksTam[0]) || taluk,
                    village: village,
                    wasAutoCorrected: !!wasCorrected,
                    originalDistrict: district,
                    reason: wasCorrected 
                        ? `பின்கோடு (${pinStr}) தமிழக அரசு போர்ட்டலில் '${info.nameTam}' மாவட்டத்தின் கீழ் வருகிறது.`
                        : null
                };
            }
        }
    }

    // -------------------------------------------------------------------------
    // TIER 5: Default Passthrough
    // -------------------------------------------------------------------------
    return {
        district: district || 'Ranipet',
        districtTam: district || 'இராணிப்பேட்டை',
        taluk: taluk || 'Arakkonam',
        talukTam: taluk || 'அரக்கோணம்',
        village: village,
        wasAutoCorrected: false,
        originalDistrict: district,
        reason: null
    };
}

module.exports = {
    TN_BIFURCATED_TALUKS,
    TN_PINCODE_TALUK_MAP,
    TN_VILLAGE_LEXICON,
    lookupTnVillage,
    lookupTnPincode,
    resolveTnDistrict
};
