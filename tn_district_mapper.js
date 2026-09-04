/**
 * Tamil Nadu District & Taluk Resolver
 * Handles recent district bifurcations where citizens' Aadhaar cards
 * still reflect old parent district names (e.g., Vellore instead of Ranipet/Tirupathur).
 */

const TN_BIFURCATED_TALUKS = {
    // 1. Ranipet (இராணிப்பேட்டை) - Carved out of Vellore in 2019
    'ranipet': {
        nameEng: 'Ranipet',
        nameTam: 'இராணிப்பேட்டை',
        parentDistrict: 'Vellore',
        taluks: ['arakkonam', 'arakonam', 'nemili', 'walajah', 'walajapet', 'arcot', 'sholinghur', 'kalavai'],
        pincodePrefixes: ['632502', '632510', '632513', '631001', '631002', '631003', '631004', '632503', '632501', '632511', '632512', '632508']
    },

    // 2. Tirupathur (திருப்பத்தூர்) - Carved out of Vellore in 2019
    'tirupathur': {
        nameEng: 'Tirupathur',
        nameTam: 'திருப்பத்தூர்',
        parentDistrict: 'Vellore',
        taluks: ['tirupathur', 'tirupattur', 'vaniyambadi', 'ambur', 'natrampalli'],
        pincodePrefixes: ['635601', '635602', '635751', '635802', '635852', '635854']
    },

    // 3. Vellore (வேலூர்) - Retained residual taluks
    'vellore': {
        nameEng: 'Vellore',
        nameTam: 'வேலூர்',
        parentDistrict: null,
        taluks: ['vellore', 'katpadi', 'anaicut', 'gudiyatham', 'gudiyattam', 'pernambut', 'peranambattu', 'kv kuppam', 'k.v.kuppam'],
        pincodePrefixes: ['632001', '632002', '632003', '632004', '632006', '632009', '632014', '632059', '632103']
    },

    // 4. Chengalpattu (செங்கல்பட்டு) - Carved out of Kanchipuram in 2019
    'chengalpattu': {
        nameEng: 'Chengalpattu',
        nameTam: 'செங்கல்பட்டு',
        parentDistrict: 'Kanchipuram',
        taluks: ['chengalpattu', 'tambaram', 'pallavaram', 'vandalur', 'madurantakam', 'cheyyur', 'tiruporur', 'thirukalukundram'],
        pincodePrefixes: ['603001', '603002', '603003', '600045', '600044', '600048', '603104', '603105', '603109']
    },

    // 5. Tenkasi (தென்காசி) - Carved out of Tirunelveli in 2019
    'tenkasi': {
        nameEng: 'Tenkasi',
        nameTam: 'தென்காசி',
        parentDistrict: 'Tirunelveli',
        taluks: ['tenkasi', 'sengottai', 'kadayanallur', 'sankarankovil', 'sivagiri', 'alangulam', 'veerakeralamputhur', 'thiruvengadam'],
        pincodePrefixes: ['627811', '627809', '627751', '627756', '627757', '627861', '627859']
    },

    // 6. Kallakurichi (கள்ளக்குறிச்சி) - Carved out of Villupuram in 2019
    'kallakurichi': {
        nameEng: 'Kallakurichi',
        nameTam: 'கள்ளக்குறிச்சி',
        parentDistrict: 'Villupuram',
        taluks: ['kallakurichi', 'sankarapuram', 'tirukkoyilur', 'thirukovilur', 'ulundurpet', 'chinnasalem', 'kalvarayan hills'],
        pincodePrefixes: ['606202', '606206', '606213', '606107', '606401']
    },

    // 7. Mayiladuthurai (மயிலாடுதுறை) - Carved out of Nagapattinam in 2020
    'mayiladuthurai': {
        nameEng: 'Mayiladuthurai',
        nameTam: 'மயிலாடுதுறை',
        parentDistrict: 'Nagapattinam',
        taluks: ['mayiladuthurai', 'sirkazhi', 'tharangambadi', 'kuthalam'],
        pincodePrefixes: ['609001', '609110', '609111', '609112', '609118', '609307']
    }
};

function resolveTnDistrict(district = '', taluk = '', village = '', pincode = '') {
    const dLower = (district || '').trim().toLowerCase().replace(/[^a-z]/g, '');
    const tLower = (taluk || '').trim().toLowerCase().replace(/[^a-z]/g, '');
    const vLower = (village || '').trim().toLowerCase().replace(/[^a-z]/g, '');
    const pinStr = (pincode || '').trim().replace(/\D/g, '');

    for (const [distKey, info] of Object.entries(TN_BIFURCATED_TALUKS)) {
        if (tLower && info.taluks.some(t => tLower.includes(t) || t.includes(tLower))) {
            const wasCorrected = info.parentDistrict && dLower.includes(info.parentDistrict.toLowerCase());
            return {
                district: info.nameEng,
                districtTam: info.nameTam,
                taluk: taluk || info.taluks[0],
                wasAutoCorrected: !!wasCorrected,
                originalDistrict: district,
                reason: wasCorrected 
                    ? `ஆதார் அட்டையில் '${district}' என இருந்தாலும், தமிழக அரசு போர்ட்டலில் '${taluk}' தாலுகா '${info.nameTam}' மாவட்டத்தின் கீழ் உள்ளது.`
                    : null
            };
        }
    }

    if (vLower.includes('anverthikanpet') || vLower.includes('anwarthikan') || vLower.includes('minnal')) {
        return {
            district: 'Ranipet',
            districtTam: 'இராணிப்பேட்டை',
            taluk: 'Arakkonam',
            wasAutoCorrected: true,
            originalDistrict: district,
            reason: `கிராமம் '${village}' என்பது இராணிப்பேட்டை மாவட்ட அரக்கோணம் தாலுகாவைச் சேர்ந்தது.`
        };
    }

    if (pinStr.length >= 4) {
        for (const [distKey, info] of Object.entries(TN_BIFURCATED_TALUKS)) {
            if (info.pincodePrefixes.some(pfx => pinStr.startsWith(pfx.substring(0, 4)))) {
                const wasCorrected = info.parentDistrict && dLower.includes(info.parentDistrict.toLowerCase());
                return {
                    district: info.nameEng,
                    districtTam: info.nameTam,
                    taluk: taluk || info.taluks[0],
                    wasAutoCorrected: !!wasCorrected,
                    originalDistrict: district,
                    reason: wasCorrected 
                        ? `பின்கோடு (${pinStr}) தமிழக அரசு போர்ட்டலில் '${info.nameTam}' மாவட்டத்தின் கீழ் உள்ளது.`
                        : null
                };
            }
        }
    }

    return {
        district: district || 'Ranipet',
        districtTam: district || 'இராணிப்பேட்டை',
        taluk: taluk || 'Arakkonam',
        wasAutoCorrected: false,
        originalDistrict: district,
        reason: null
    };
}

module.exports = {
    TN_BIFURCATED_TALUKS,
    resolveTnDistrict
};
