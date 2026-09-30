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

// =============================================================================
// 1. MASTER DISTRICT BIFURCATION REGISTRY
// =============================================================================
const TN_BIFURCATED_TALUKS = {
    // 1. Ranipet (இராணிப்பேட்டை) - Carved out of Vellore in Nov 2019
    'ranipet': {
        nameEng: 'Ranipet',
        nameTam: 'இராணிப்பேட்டை',
        parentDistrict: 'Vellore',
        parentDistrictTam: 'வேலூர்',
        taluks: ['nemili', 'arakkonam', 'arakonam', 'sholinghur', 'sholingur', 'shozhingur', 'walajah', 'walajapet', 'arcot', 'kalavai'],
        taluksTam: ['நேமிலி', 'அரக்கோணம்', 'சோளிங்கர்', 'வாலாஜா', 'ஆற்காடு', 'கலவை'],
        pincodePrefixes: ['631051', '631052', '631053', '632508', '631102', '631055', '631001', '631002', '631003', '631004', '631054', '631151', '631152', '631058', '632510', '632505', '632509', '632513', '632501', '632514', '632518', '632503', '632504', '632511', '632512', '632506']
    },

    // 2. Tirupathur (திருப்பத்தூர்) - Carved out of Vellore in Nov 2019
    'tirupathur': {
        nameEng: 'Tirupathur',
        nameTam: 'திருப்பத்தூர்',
        parentDistrict: 'Vellore',
        parentDistrictTam: 'வேலூர்',
        taluks: ['tirupathur', 'tirupattur', 'vaniyambadi', 'ambur', 'natrampalli', 'jolarpet'],
        taluksTam: ['திருப்பத்தூர்', 'வாணியம்பாடி', 'ஆம்பூர்', 'நாட்டறம்பள்ளி', 'ஜோலார்பேட்டை'],
        pincodePrefixes: ['635601', '635602', '635603', '635851', '635751', '635752', '635753', '635802', '635804', '635812', '635852', '635854']
    },

    // 3. Vellore (வேலூர்) - Retained residual taluks
    'vellore': {
        nameEng: 'Vellore',
        nameTam: 'வேலூர்',
        parentDistrict: null,
        taluks: ['vellore', 'katpadi', 'anaicut', 'gudiyatham', 'gudiyattam', 'pernambut', 'peranambattu', 'kv kuppam', 'k.v.kuppam'],
        taluksTam: ['வேலூர்', 'காட்பாடி', 'அணைக்கட்டு', 'குடியாத்தம்', 'பேரணாம்பட்டு', 'கே.வி. குப்பம்'],
        pincodePrefixes: ['632001', '632002', '632003', '632004', '632006', '632007', '632009', '632014', '632059', '632101', '632103', '632104', '632106', '632107', '632201', '632209', '632601', '632602', '632604', '635810', '635811']
    },

    // 4. Chengalpattu (செங்கல்பட்டு) - Carved out of Kanchipuram in Nov 2019
    'chengalpattu': {
        nameEng: 'Chengalpattu',
        nameTam: 'செங்கல்பட்டு',
        parentDistrict: 'Kanchipuram',
        parentDistrictTam: 'காஞ்சிபுரம்',
        taluks: ['chengalpattu', 'tambaram', 'pallavaram', 'vandalur', 'madurantakam', 'cheyyur', 'tiruporur', 'thirukalukundram'],
        taluksTam: ['செங்கல்பட்டு', 'தாம்பரம்', 'பல்லாவரம்', 'வண்டலூர்', 'மதுராந்தகம்', 'செய்யூர்', 'திருப்போரூர்', 'திருக்கழுக்குன்றம்'],
        pincodePrefixes: ['603001', '603002', '603003', '600044', '600045', '600047', '600048', '600059', '600073', '600117', '603102', '603103', '603104', '603105', '603109', '603110', '603112', '603202', '603210', '603302', '603303', '603304', '603306', '603307', '603312']
    },

    // 5. Tenkasi (தென்காசி) - Carved out of Tirunelveli in Nov 2019
    'tenkasi': {
        nameEng: 'Tenkasi',
        nameTam: 'தென்காசி',
        parentDistrict: 'Tirunelveli',
        parentDistrictTam: 'திருநெல்வேலி',
        taluks: ['tenkasi', 'sengottai', 'kadayanallur', 'sankarankovil', 'sivagiri', 'alangulam', 'veerakeralamputhur', 'thiruvengadam'],
        taluksTam: ['தென்காசி', 'செங்கோட்டை', 'கடையநல்லூர்', 'சங்கரன்கோவில்', 'சிவகிரி', 'ஆலங்குளம்', 'வீரகேரளம்புதூர்', 'திருவேங்கடம்'],
        pincodePrefixes: ['627811', '627802', '627818', '627809', '627813', '627751', '627759', '627756', '627753', '627757', '627760', '627851', '627854', '627859', '627719', '627861']
    },

    // 6. Kallakurichi (கள்ளக்குறிச்சி) - Carved out of Villupuram in Nov 2019
    'kallakurichi': {
        nameEng: 'Kallakurichi',
        nameTam: 'கள்ளக்குறிச்சி',
        parentDistrict: 'Villupuram',
        parentDistrictTam: 'விழுப்புரம்',
        taluks: ['kallakurichi', 'sankarapuram', 'tirukkoyilur', 'thirukovilur', 'ulundurpet', 'chinnasalem', 'kalvarayan hills', 'kalvarayan'],
        taluksTam: ['கள்ளக்குறிச்சி', 'சங்கராபுரம்', 'திருக்கோவிலூர்', 'உளுந்தூர்பேட்டை', 'சின்னசேலம்', 'கல்வராயன் மலை'],
        pincodePrefixes: ['606202', '606213', '606401', '606402', '605757', '605766', '605803', '606107', '607204', '606201', '606207']
    },

    // 7. Mayiladuthurai (மயிலாடுதுறை) - Carved out of Nagapattinam in Dec 2020
    'mayiladuthurai': {
        nameEng: 'Mayiladuthurai',
        nameTam: 'மயிலாடுதுறை',
        parentDistrict: 'Nagapattinam',
        parentDistrictTam: 'நாகப்பட்டினம்',
        taluks: ['mayiladuthurai', 'sirkazhi', 'sirkaazhi', 'tharangambadi', 'kuthalam'],
        taluksTam: ['மயிலாடுதுறை', 'சீர்காழி', 'தரங்கம்பாடி', 'குத்தாலம்'],
        pincodePrefixes: ['609001', '609003', '609110', '609111', '609112', '609115', '609118', '609203', '609305', '609307', '609313', '609801', '609805']
    },

    // 8. Tiruppur (திருப்பூர்) - Carved out of Coimbatore & Erode
    'tiruppur': {
        nameEng: 'Tiruppur',
        nameTam: 'திருப்பூர்',
        parentDistrict: 'Coimbatore',
        parentDistrictTam: 'கோயம்புத்தூர்',
        taluks: ['tiruppur', 'avinashi', 'palladam', 'dharapuram', 'kangeyam', 'udumalaipettai', 'madathukulam', 'uthukuli'],
        taluksTam: ['திருப்பூர்', 'அவிநாசி', 'பல்லடம்', 'தாராபுரம்', 'காங்கேயம்', 'உடுமலைப்பேட்டை', 'மடத்துக்குளம்', 'ஊத்துக்குளி'],
        pincodePrefixes: ['641601', '641602', '641603', '641604', '641607', '641654', '641664', '638656', '638701', '642126', '642203', '638752']
    },

    // 9. Krishnagiri (கிருஷ்ணகிரி) - Carved out of Dharmapuri
    'krishnagiri': {
        nameEng: 'Krishnagiri',
        nameTam: 'கிருஷ்ணகிரி',
        parentDistrict: 'Dharmapuri',
        parentDistrictTam: 'தருமபுரி',
        taluks: ['krishnagiri', 'hosur', 'denkanikottai', 'pochampalli', 'uthangarai', 'shoolagiri', 'bargur'],
        taluksTam: ['கிருஷ்ணகிரி', 'ஓசூர்', 'தேன்கனிக்கோட்டை', 'போச்சம்பள்ளி', 'ஊத்தங்கரை', 'சூளகிரி', 'பர்கூர்'],
        pincodePrefixes: ['635001', '635002', '635109', '635126', '635107', '635206', '635207', '635117', '635108']
    },

    // 10. Ariyalur (அரியலூர்) - Carved out of Perambalur
    'ariyalur': {
        nameEng: 'Ariyalur',
        nameTam: 'அரியலூர்',
        parentDistrict: 'Perambalur',
        parentDistrictTam: 'பெரம்பலூர்',
        taluks: ['ariyalur', 'udayarpalayam', 'sendurai', 'andimadam', 'jayankondam'],
        taluksTam: ['அரியலூர்', 'உடையார்பாளையம்', 'செந்துறை', 'ஆண்டிமடம்', 'ஜெயங்கொண்டம்'],
        pincodePrefixes: ['621704', '621713', '621804', '621714', '621801', '621802']
    }
};

// =============================================================================
// 2. MASTER 6-DIGIT POSTAL PINCODE DATABASE (EXACT TALUK & DISTRICT MAPPING)
// =============================================================================
const TN_PINCODE_TALUK_MAP = {
    // --- RANIPET DISTRICT ---
    // Nemili Taluk
    '631051': { district: 'Ranipet', districtTam: 'இராணிப்பேட்டை', taluk: 'Nemili', talukTam: 'நேமிலி', villages: ['Nemili', 'Melvenkatapuram', 'Kilvenkatapuram', 'Sirukarumbur', 'Attupakkam', 'Nagavedu', 'Ochalam', 'Sayanoor', 'Paranji', 'Chitteri', 'Poigai'] },
    '631052': { district: 'Ranipet', districtTam: 'இராணிப்பேட்டை', taluk: 'Nemili', talukTam: 'நேமிலி', villages: ['Panapakkam', 'Jagirthandalam', 'Thirupparkadal', 'Veliyanallur'] },
    '631053': { district: 'Ranipet', districtTam: 'இராணிப்பேட்டை', taluk: 'Nemili', talukTam: 'நேமிலி', villages: ['Banavaram', 'Melkalathur', 'Mahendravadi', 'Kattupakkam', 'Pudupattu'] },
    '632508': { district: 'Ranipet', districtTam: 'இராணிப்பேட்டை', taluk: 'Nemili', talukTam: 'நேமிலி', villages: ['Kaveripakkam', 'Alapakkam', 'Thandalam', 'Kodambakkam', 'Pallur', 'Iluppai'] },
    '631102': { district: 'Ranipet', districtTam: 'இராணிப்பேட்டை', taluk: 'Nemili', talukTam: 'நேமிலி', villages: ['Thirumalpur', 'Siruvalayam'] },
    '631055': { district: 'Ranipet', districtTam: 'இராணிப்பேட்டை', taluk: 'Nemili', talukTam: 'நேமிலி', villages: ['Kavanoor', 'Asamandhur'] },

    // Arakkonam Taluk
    '631001': { district: 'Ranipet', districtTam: 'இராணிப்பேட்டை', taluk: 'Arakkonam', talukTam: 'அரக்கோணம்', villages: ['Arakkonam Town'] },
    '631002': { district: 'Ranipet', districtTam: 'இராணிப்பேட்டை', taluk: 'Arakkonam', talukTam: 'அரக்கோணம்', villages: ['Minnal', 'Narasingapuram', 'Arakkonam West'] },
    '631003': { district: 'Ranipet', districtTam: 'இராணிப்பேட்டை', taluk: 'Arakkonam', talukTam: 'அரக்கோணம்', villages: ['Sembedu', 'Mosur', 'Arakkonam North'] },
    '631004': { district: 'Ranipet', districtTam: 'இராணிப்பேட்டை', taluk: 'Arakkonam', talukTam: 'அரக்கோணம்', villages: ['INS Rajali'] },
    '631054': { district: 'Ranipet', districtTam: 'இராணிப்பேட்டை', taluk: 'Arakkonam', talukTam: 'அரக்கோணம்', villages: ['Thakkolam'] },
    '631151': { district: 'Ranipet', districtTam: 'இராணிப்பேட்டை', taluk: 'Arakkonam', talukTam: 'அரக்கோணம்', villages: ['Mudhur'] },
    '631152': { district: 'Ranipet', districtTam: 'இராணிப்பேட்டை', taluk: 'Arakkonam', talukTam: 'அரக்கோணம்', villages: ['Seyyur'] },
    '631058': { district: 'Ranipet', districtTam: 'இராணிப்பேட்டை', taluk: 'Arakkonam', talukTam: 'அரக்கோணம்', villages: ['Itchiputhur', 'Anverthikanpettai'] },

    // Sholinghur Taluk
    '632510': { district: 'Ranipet', districtTam: 'இராணிப்பேட்டை', taluk: 'Sholinghur', talukTam: 'சோளிங்கர்', villages: ['Sholinghur', 'Kunnathur', 'Kondapalayam', 'Rendadi', 'Pandiyanallur', 'Thalikkal'] },
    '632505': { district: 'Ranipet', districtTam: 'இராணிப்பேட்டை', taluk: 'Sholinghur', talukTam: 'சோளிங்கர்', villages: ['Govindacheri'] },
    '632509': { district: 'Ranipet', districtTam: 'இராணிப்பேட்டை', taluk: 'Sholinghur', talukTam: 'சோளிங்கர்', villages: ['Paradarami'] },

    // Walajah Taluk
    '632513': { district: 'Ranipet', districtTam: 'இராணிப்பேட்டை', taluk: 'Walajah', talukTam: 'வாலாஜா', villages: ['Walajah', 'Walajapet'] },
    '632501': { district: 'Ranipet', districtTam: 'இராணிப்பேட்டை', taluk: 'Walajah', talukTam: 'வாலாஜா', villages: ['Ranipet', 'Navalpur', 'BHEL'] },
    '632514': { district: 'Ranipet', districtTam: 'இராணிப்பேட்டை', taluk: 'Walajah', talukTam: 'வாலாஜா', villages: ['Seekarajapuram'] },
    '632518': { district: 'Ranipet', districtTam: 'இராணிப்பேட்டை', taluk: 'Walajah', talukTam: 'வாலாஜா', villages: ['Chennasamudram'] },

    // Arcot Taluk
    '632503': { district: 'Ranipet', districtTam: 'இராணிப்பேட்டை', taluk: 'Arcot', talukTam: 'ஆற்காடு', villages: ['Arcot', 'Timiri'] },
    '632504': { district: 'Ranipet', districtTam: 'இராணிப்பேட்டை', taluk: 'Arcot', talukTam: 'ஆற்காடு', villages: ['Melvisharam'] },
    '632511': { district: 'Ranipet', districtTam: 'இராணிப்பேட்டை', taluk: 'Arcot', talukTam: 'ஆற்காடு', villages: ['Vilapakkam'] },
    '632512': { district: 'Ranipet', districtTam: 'இராணிப்பேட்டை', taluk: 'Arcot', talukTam: 'ஆற்காடு', villages: ['Tajpura', 'Valavanur'] },

    // Kalavai Taluk
    '632506': { district: 'Ranipet', districtTam: 'இராணிப்பேட்டை', taluk: 'Kalavai', talukTam: 'கலவை', villages: ['Kalavai'] },

    // --- TIRUPATHUR DISTRICT ---
    '635601': { district: 'Tirupathur', districtTam: 'திருப்பத்தூர்', taluk: 'Tirupathur', talukTam: 'திருப்பத்தூர்', villages: ['Tirupathur Town'] },
    '635602': { district: 'Tirupathur', districtTam: 'திருப்பத்தூர்', taluk: 'Tirupathur', talukTam: 'திருப்பத்தூர்', villages: ['Kandili', 'Kurisilappattu'] },
    '635603': { district: 'Tirupathur', districtTam: 'திருப்பத்தூர்', taluk: 'Tirupathur', talukTam: 'திருப்பத்தூர்', villages: ['Alangayam'] },
    '635851': { district: 'Tirupathur', districtTam: 'திருப்பத்தூர்', taluk: 'Jolarpet', talukTam: 'ஜோலார்பேட்டை', villages: ['Jolarpet', 'Yelagiri Hills'] },
    '635751': { district: 'Tirupathur', districtTam: 'திருப்பத்தூர்', taluk: 'Vaniyambadi', talukTam: 'வாணியம்பாடி', villages: ['Vaniyambadi'] },
    '635752': { district: 'Tirupathur', districtTam: 'திருப்பத்தூர்', taluk: 'Vaniyambadi', talukTam: 'வாணியம்பாடி', villages: ['Uthayendram'] },
    '635753': { district: 'Tirupathur', districtTam: 'திருப்பத்தூர்', taluk: 'Vaniyambadi', talukTam: 'வாணியம்பாடி', villages: ['Madhanur'] },
    '635802': { district: 'Tirupathur', districtTam: 'திருப்பத்தூர்', taluk: 'Ambur', talukTam: 'ஆம்பூர்', villages: ['Ambur Town'] },
    '635804': { district: 'Tirupathur', districtTam: 'திருப்பத்தூர்', taluk: 'Ambur', talukTam: 'ஆம்பூர்', villages: ['Vadakkupattu', 'Thuthipet'] },
    '635812': { district: 'Tirupathur', districtTam: 'திருப்பத்தூர்', taluk: 'Ambur', talukTam: 'ஆம்பூர்', villages: ['Mittaalam'] },
    '635852': { district: 'Tirupathur', districtTam: 'திருப்பத்தூர்', taluk: 'Natrampalli', talukTam: 'நாட்டறம்பள்ளி', villages: ['Natrampalli'] },
    '635854': { district: 'Tirupathur', districtTam: 'திருப்பத்தூர்', taluk: 'Natrampalli', talukTam: 'நாட்டறம்பள்ளி', villages: ['Pachur'] },

    // --- CHENGALPATTU DISTRICT ---
    '603001': { district: 'Chengalpattu', districtTam: 'செங்கல்பட்டு', taluk: 'Chengalpattu', talukTam: 'செங்கல்பட்டு', villages: ['Chengalpattu Town'] },
    '603002': { district: 'Chengalpattu', districtTam: 'செங்கல்பட்டு', taluk: 'Chengalpattu', talukTam: 'செங்கல்பட்டு', villages: ['Chengalpattu Bazaar'] },
    '603003': { district: 'Chengalpattu', districtTam: 'செங்கல்பட்டு', taluk: 'Chengalpattu', talukTam: 'செங்கல்பட்டு', villages: ['Pulipakkam', 'Singaperumal Koil'] },
    '600045': { district: 'Chengalpattu', districtTam: 'செங்கல்பட்டு', taluk: 'Tambaram', talukTam: 'தாம்பரம்', villages: ['Tambaram Town', 'East Tambaram'] },
    '600059': { district: 'Chengalpattu', districtTam: 'செங்கல்பட்டு', taluk: 'Tambaram', talukTam: 'தாம்பரம்', villages: ['West Tambaram', 'Camp Road'] },
    '600047': { district: 'Chengalpattu', districtTam: 'செங்கல்பட்டு', taluk: 'Tambaram', talukTam: 'தாம்பரம்', villages: ['Perungalathur'] },
    '600073': { district: 'Chengalpattu', districtTam: 'செங்கல்பட்டு', taluk: 'Tambaram', talukTam: 'தாம்பரம்', villages: ['Selaiyur', 'Madambakkam'] },
    '600044': { district: 'Chengalpattu', districtTam: 'செங்கல்பட்டு', taluk: 'Pallavaram', talukTam: 'பல்லாவரம்', villages: ['Chromepet', 'Radha Nagar'] },
    '600043': { district: 'Chengalpattu', districtTam: 'செங்கல்பட்டு', taluk: 'Pallavaram', talukTam: 'பல்லாவரம்', villages: ['Pallavaram Town', 'Cantonment'] },
    '600117': { district: 'Chengalpattu', districtTam: 'செங்கல்பட்டு', taluk: 'Pallavaram', talukTam: 'பல்லாவரம்', villages: ['Keelkattalai'] },
    '600048': { district: 'Chengalpattu', districtTam: 'செங்கல்பட்டு', taluk: 'Vandalur', talukTam: 'வண்டலூர்', villages: ['Vandalur', 'Urapakkam'] },
    '603202': { district: 'Chengalpattu', districtTam: 'செங்கல்பட்டு', taluk: 'Vandalur', talukTam: 'வண்டலூர்', villages: ['Guduvanchery'] },
    '603210': { district: 'Chengalpattu', districtTam: 'செங்கல்பட்டு', taluk: 'Vandalur', talukTam: 'வண்டலூர்', villages: ['Maraimalai Nagar'] },
    '603306': { district: 'Chengalpattu', districtTam: 'செங்கல்பட்டு', taluk: 'Madurantakam', talukTam: 'மதுராந்தகம்', villages: ['Madurantakam Town'] },
    '603303': { district: 'Chengalpattu', districtTam: 'செங்கல்பட்டு', taluk: 'Madurantakam', talukTam: 'மதுராந்தகம்', villages: ['Acharapakkam'] },
    '603304': { district: 'Chengalpattu', districtTam: 'செங்கல்பட்டு', taluk: 'Cheyyur', talukTam: 'செய்யூர்', villages: ['Cheyyur Town'] },
    '603302': { district: 'Chengalpattu', districtTam: 'செங்கல்பட்டு', taluk: 'Cheyyur', talukTam: 'செய்யூர்', villages: ['Pavunjur'] },
    '603110': { district: 'Chengalpattu', districtTam: 'செங்கல்பட்டு', taluk: 'Tiruporur', talukTam: 'திருப்போரூர்', villages: ['Tiruporur Town'] },
    '603103': { district: 'Chengalpattu', districtTam: 'செங்கல்பட்டு', taluk: 'Tiruporur', talukTam: 'திருப்போரூர்', villages: ['Kelambakkam'] },
    '603112': { district: 'Chengalpattu', districtTam: 'செங்கல்பட்டு', taluk: 'Tiruporur', talukTam: 'திருப்போரூர்', villages: ['Kovalam'] },
    '603109': { district: 'Chengalpattu', districtTam: 'செங்கல்பட்டு', taluk: 'Thirukalukundram', talukTam: 'திருக்கழுக்குன்றம்', villages: ['Thirukalukundram Town'] },
    '603104': { district: 'Chengalpattu', districtTam: 'செங்கல்பட்டு', taluk: 'Thirukalukundram', talukTam: 'திருக்கழுக்குன்றம்', villages: ['Mamallapuram', 'Mahabalipuram'] },

    // --- KALLAKURICHI DISTRICT ---
    '606202': { district: 'Kallakurichi', districtTam: 'கள்ளக்குறிச்சி', taluk: 'Kallakurichi', talukTam: 'கள்ளக்குறிச்சி', villages: ['Kallakurichi Town'] },
    '606213': { district: 'Kallakurichi', districtTam: 'கள்ளக்குறிச்சி', taluk: 'Kallakurichi', talukTam: 'கள்ளக்குறிச்சி', villages: ['Siruvangur'] },
    '606401': { district: 'Kallakurichi', districtTam: 'கள்ளக்குறிச்சி', taluk: 'Sankarapuram', talukTam: 'சங்கராபுரம்', villages: ['Sankarapuram Town'] },
    '606402': { district: 'Kallakurichi', districtTam: 'கள்ளக்குறிச்சி', taluk: 'Sankarapuram', talukTam: 'சங்கராபுரம்', villages: ['Vadaponparappi'] },
    '605757': { district: 'Kallakurichi', districtTam: 'கள்ளக்குறிச்சி', taluk: 'Tirukkoyilur', talukTam: 'திருக்கோவிலூர்', villages: ['Tirukkoyilur Town'] },
    '605766': { district: 'Kallakurichi', districtTam: 'கள்ளக்குறிச்சி', taluk: 'Tirukkoyilur', talukTam: 'திருக்கோவிலூர்', villages: ['Manalurpet'] },
    '606107': { district: 'Kallakurichi', districtTam: 'கள்ளக்குறிச்சி', taluk: 'Ulundurpet', talukTam: 'உளுந்தூர்பேட்டை', villages: ['Ulundurpet Town'] },
    '607204': { district: 'Kallakurichi', districtTam: 'கள்ளக்குறிச்சி', taluk: 'Ulundurpet', talukTam: 'உளுந்தூர்பேட்டை', villages: ['Elavanasurkottai'] },
    '606201': { district: 'Kallakurichi', districtTam: 'கள்ளக்குறிச்சி', taluk: 'Chinnasalem', talukTam: 'சின்னசேலம்', villages: ['Chinnasalem Town'] },
    '606207': { district: 'Kallakurichi', districtTam: 'கள்ளக்குறிச்சி', taluk: 'Kalvarayan Hills', talukTam: 'கல்வராயன் மலை', villages: ['Vellimalai'] },

    // --- TENKASI DISTRICT ---
    '627811': { district: 'Tenkasi', districtTam: 'தென்காசி', taluk: 'Tenkasi', talukTam: 'தென்காசி', villages: ['Tenkasi Town'] },
    '627802': { district: 'Tenkasi', districtTam: 'தென்காசி', taluk: 'Tenkasi', talukTam: 'தென்காசி', villages: ['Courtallam', 'Kutralam'] },
    '627818': { district: 'Tenkasi', districtTam: 'தென்காசி', taluk: 'Tenkasi', talukTam: 'தென்காசி', villages: ['Melagaram'] },
    '627809': { district: 'Tenkasi', districtTam: 'தென்காசி', taluk: 'Sengottai', talukTam: 'செங்கோட்டை', villages: ['Sengottai Town'] },
    '627813': { district: 'Tenkasi', districtTam: 'தென்காசி', taluk: 'Sengottai', talukTam: 'செங்கோட்டை', villages: ['Puliyarai'] },
    '627751': { district: 'Tenkasi', districtTam: 'தென்காசி', taluk: 'Kadayanallur', talukTam: 'கடையநல்லூர்', villages: ['Kadayanallur Town'] },
    '627759': { district: 'Tenkasi', districtTam: 'தென்காசி', taluk: 'Kadayanallur', talukTam: 'கடையநல்லூர்', villages: ['Chokkampatti'] },
    '627756': { district: 'Tenkasi', districtTam: 'தென்காசி', taluk: 'Sankarankovil', talukTam: 'சங்கரன்கோவில்', villages: ['Sankarankovil Town'] },
    '627753': { district: 'Tenkasi', districtTam: 'தென்காசி', taluk: 'Sankarankovil', talukTam: 'சங்கரன்கோவில்', villages: ['Karivalamvandanallur'] },
    '627757': { district: 'Tenkasi', districtTam: 'தென்காசி', taluk: 'Sivagiri', talukTam: 'சிவகிரி', villages: ['Sivagiri Town'] },
    '627760': { district: 'Tenkasi', districtTam: 'தென்காசி', taluk: 'Sivagiri', talukTam: 'சிவகிரி', villages: ['Vasudevanallur'] },
    '627851': { district: 'Tenkasi', districtTam: 'தென்காசி', taluk: 'Alangulam', talukTam: 'ஆலங்குளம்', villages: ['Alangulam Town'] },
    '627854': { district: 'Tenkasi', districtTam: 'தென்காசி', taluk: 'Alangulam', talukTam: 'ஆலங்குளம்', villages: ['Pavoorchatram'] },
    '627859': { district: 'Tenkasi', districtTam: 'தென்காசி', taluk: 'Veerakeralamputhur', talukTam: 'வீரகேரளம்புதூர்', villages: ['Veerakeralamputhur Town', 'Surandai'] },
    '627719': { district: 'Tenkasi', districtTam: 'தென்காசி', taluk: 'Thiruvengadam', talukTam: 'திருவேங்கடம்', villages: ['Thiruvengadam Town'] },

    // --- MAYILADUTHURAI DISTRICT ---
    '609001': { district: 'Mayiladuthurai', districtTam: 'மயிலாடுதுறை', taluk: 'Mayiladuthurai', talukTam: 'மயிலாடுதுறை', villages: ['Mayiladuthurai Town'] },
    '609003': { district: 'Mayiladuthurai', districtTam: 'மயிலாடுதுறை', taluk: 'Mayiladuthurai', talukTam: 'மயிலாடுதுறை', villages: ['Kornad'] },
    '609118': { district: 'Mayiladuthurai', districtTam: 'மயிலாடுதுறை', taluk: 'Mayiladuthurai', talukTam: 'மயிலாடுதுறை', villages: ['Manalmedu'] },
    '609110': { district: 'Mayiladuthurai', districtTam: 'மயிலாடுதுறை', taluk: 'Sirkazhi', talukTam: 'சீர்காழி', villages: ['Sirkazhi Town'] },
    '609111': { district: 'Mayiladuthurai', districtTam: 'மயிலாடுதுறை', taluk: 'Sirkazhi', talukTam: 'சீர்காழி', villages: ['Kollidam'] },
    '609115': { district: 'Mayiladuthurai', districtTam: 'மயிலாடுதுறை', taluk: 'Sirkazhi', talukTam: 'சீர்காழி', villages: ['Vaitheeswarankoil'] },
    '609307': { district: 'Mayiladuthurai', districtTam: 'மயிலாடுதுறை', taluk: 'Tharangambadi', talukTam: 'தரங்கம்பாடி', villages: ['Tharangambadi Town', 'Tranquebar', 'Porayar'] },
    '609305': { district: 'Mayiladuthurai', districtTam: 'மயிலாடுதுறை', taluk: 'Tharangambadi', talukTam: 'தரங்கம்பாடி', villages: ['Sembanarkoil'] },
    '609313': { district: 'Mayiladuthurai', districtTam: 'மயிலாடுதுறை', taluk: 'Tharangambadi', talukTam: 'தரங்கம்பாடி', villages: ['Poompuhar'] },
    '609801': { district: 'Mayiladuthurai', districtTam: 'மயிலாடுதுறை', taluk: 'Kuthalam', talukTam: 'குத்தாலம்', villages: ['Kuthalam Town'] },
    '609805': { district: 'Mayiladuthurai', districtTam: 'மயிலாடுதுறை', taluk: 'Kuthalam', talukTam: 'குத்தாலம்', villages: ['Komal'] },

    // --- TIRUPPUR DISTRICT ---
    '641601': { district: 'Tiruppur', districtTam: 'திருப்பூர்', taluk: 'Tiruppur', talukTam: 'திருப்பூர்', villages: ['Tiruppur Town'] },
    '641654': { district: 'Tiruppur', districtTam: 'திருப்பூர்', taluk: 'Avinashi', talukTam: 'அவிநாசி', villages: ['Avinashi Town'] },
    '641664': { district: 'Tiruppur', districtTam: 'திருப்பூர்', taluk: 'Palladam', talukTam: 'பல்லடம்', villages: ['Palladam Town'] },
    '638656': { district: 'Tiruppur', districtTam: 'திருப்பூர்', taluk: 'Dharapuram', talukTam: 'தாராபுரம்', villages: ['Dharapuram Town'] },
    '638701': { district: 'Tiruppur', districtTam: 'திருப்பூர்', taluk: 'Kangeyam', talukTam: 'காங்கேயம்', villages: ['Kangeyam Town'] },
    '642126': { district: 'Tiruppur', districtTam: 'திருப்பூர்', taluk: 'Udumalaipettai', talukTam: 'உடுமலைப்பேட்டை', villages: ['Udumalaipettai Town'] },

    // --- KRISHNAGIRI DISTRICT ---
    '635001': { district: 'Krishnagiri', districtTam: 'கிருஷ்ணகிரி', taluk: 'Krishnagiri', talukTam: 'கிருஷ்ணகிரி', villages: ['Krishnagiri Town'] },
    '635109': { district: 'Krishnagiri', districtTam: 'கிருஷ்ணகிரி', taluk: 'Hosur', talukTam: 'ஓசூர்', villages: ['Hosur Town'] },
    '635107': { district: 'Krishnagiri', districtTam: 'கிருஷ்ணகிரி', taluk: 'Denkanikottai', talukTam: 'தேன்கனிக்கோட்டை', villages: ['Denkanikottai Town'] },
    '635206': { district: 'Krishnagiri', districtTam: 'கிருஷ்ணகிரி', taluk: 'Pochampalli', talukTam: 'போச்சம்பள்ளி', villages: ['Pochampalli Town'] },
    '635207': { district: 'Krishnagiri', districtTam: 'கிருஷ்ணகிரி', taluk: 'Uthangarai', talukTam: 'ஊத்தங்கரை', villages: ['Uthangarai Town'] },

    // --- ARIYALUR DISTRICT ---
    '621704': { district: 'Ariyalur', districtTam: 'அரியலூர்', taluk: 'Ariyalur', talukTam: 'அரியலூர்', villages: ['Ariyalur Town'] },
    '621804': { district: 'Ariyalur', districtTam: 'அரியலூர்', taluk: 'Udayarpalayam', talukTam: 'உடையார்பாளையம்', villages: ['Udayarpalayam Town'] },
    '621714': { district: 'Ariyalur', districtTam: 'அரியலூர்', taluk: 'Sendurai', talukTam: 'செந்துறை', villages: ['Sendurai Town'] },
    '621801': { district: 'Ariyalur', districtTam: 'அரியலூர்', taluk: 'Andimadam', talukTam: 'ஆண்டிமடம்', villages: ['Andimadam Town'] },
    '621802': { district: 'Ariyalur', districtTam: 'அரியலூர்', taluk: 'Jayankondam', talukTam: 'ஜெயங்கொண்டம்', villages: ['Jayankondam Town'] }
};

// =============================================================================
// 3. MASTER REVENUE VILLAGE & TOWN LEXICON (NAMED REVERSE LOOKUP)
// =============================================================================
const TN_VILLAGE_LEXICON = [
    // --- NEMILI TALUK (RANIPET DISTRICT) ---
    {
        names: ['kaveripakkam', 'kaveripak', 'cauverypakkam', 'காவேரிப்பாக்கம்', 'காவேரிபாக்'],
        district: 'Ranipet',
        districtTam: 'இராணிப்பேட்டை',
        taluk: 'Nemili',
        talukTam: 'நேமிலி',
        village: 'Kaveripakkam',
        villageTam: 'காவேரிப்பாக்கம்',
        isHamlet: false
    },
    {
        names: ['panapakkam', 'பனப்பாக்கம்', 'panapakka'],
        district: 'Ranipet',
        districtTam: 'இராணிப்பேட்டை',
        taluk: 'Nemili',
        talukTam: 'நேமிலி',
        village: 'Panapakkam',
        villageTam: 'பனப்பாக்கம்',
        isHamlet: false
    },
    {
        names: ['banavaram', 'பனாவரம்', 'banavaram'],
        district: 'Ranipet',
        districtTam: 'இராணிப்பேட்டை',
        taluk: 'Nemili',
        talukTam: 'நேமிலி',
        village: 'Banavaram',
        villageTam: 'பனாவரம்',
        isHamlet: false
    },
    {
        names: ['thirumalpur', 'tirumalpur', 'திருமால்பூர்', 'திருமல்பூர்'],
        district: 'Ranipet',
        districtTam: 'இராணிப்பேட்டை',
        taluk: 'Nemili',
        talukTam: 'நேமிலி',
        village: 'Thirumalpur',
        villageTam: 'திருமால்பூர்',
        isHamlet: false
    },
    {
        names: ['melvenkatapuram', 'mel venkatapuram', 'மேல்வெங்கடாபுரம்', 'மேல் வெங்கடாபுரம்'],
        district: 'Ranipet',
        districtTam: 'இராணிப்பேட்டை',
        taluk: 'Nemili',
        talukTam: 'நேமிலி',
        village: 'Melvenkatapuram',
        villageTam: 'மேல்வெங்கடாபுரம்',
        isHamlet: false
    },
    {
        names: ['kilvenkatapuram', 'keelvenkatapuram', 'கீழ்வெங்கடாபுரம்'],
        district: 'Ranipet',
        districtTam: 'இராணிப்பேட்டை',
        taluk: 'Nemili',
        talukTam: 'நேமிலி',
        village: 'Kilvenkatapuram',
        villageTam: 'கீழ்வெங்கடாபுரம்',
        isHamlet: false
    },
    {
        names: ['sirukarumbur', 'sirukarumbur', 'சிறுகரும்பூர்'],
        district: 'Ranipet',
        districtTam: 'இராணிப்பேட்டை',
        taluk: 'Nemili',
        talukTam: 'நேமிலி',
        village: 'Sirukarumbur',
        villageTam: 'சிறுகரும்பூர்',
        isHamlet: false
    },
    {
        names: ['attupakkam', 'aattupakkam', 'ஆட்டுப்பாக்கம்'],
        district: 'Ranipet',
        districtTam: 'இராணிப்பேட்டை',
        taluk: 'Nemili',
        talukTam: 'நேமிலி',
        village: 'Attupakkam',
        villageTam: 'ஆட்டுப்பாக்கம்',
        isHamlet: false
    },
    {
        names: ['nagavedu', 'நாகவேடு'],
        district: 'Ranipet',
        districtTam: 'இராணிப்பேட்டை',
        taluk: 'Nemili',
        talukTam: 'நேமிலி',
        village: 'Nagavedu',
        villageTam: 'நாகவேடு',
        isHamlet: false
    },
    {
        names: ['ochalam', 'ஒச்சாலம்'],
        district: 'Ranipet',
        districtTam: 'இராணிப்பேட்டை',
        taluk: 'Nemili',
        talukTam: 'நேமிலி',
        village: 'Ochalam',
        villageTam: 'ஒச்சாலம்',
        isHamlet: false
    },
    {
        names: ['asamandhur', 'asamanthur', 'அசமந்தூர்'],
        district: 'Ranipet',
        districtTam: 'இராணிப்பேட்டை',
        taluk: 'Nemili',
        talukTam: 'நேமிலி',
        village: 'Asamandhur',
        villageTam: 'அசமந்தூர்',
        isHamlet: false
    },
    {
        names: ['paranji', 'பரஞ்சி'],
        district: 'Ranipet',
        districtTam: 'இராணிப்பேட்டை',
        taluk: 'Nemili',
        talukTam: 'நேமிலி',
        village: 'Paranji',
        villageTam: 'பரஞ்சி',
        isHamlet: false
    },
    {
        names: ['sayanoor', 'sayanavaram', 'சயனூர்', 'சயனாவரம்'],
        district: 'Ranipet',
        districtTam: 'இராணிப்பேட்டை',
        taluk: 'Nemili',
        talukTam: 'நேமிலி',
        village: 'Sayanoor',
        villageTam: 'சயனூர்',
        isHamlet: false
    },
    {
        names: ['mahendravadi', 'மகேந்திரவாடி'],
        district: 'Ranipet',
        districtTam: 'இராணிப்பேட்டை',
        taluk: 'Nemili',
        talukTam: 'நேமிலி',
        village: 'Mahendravadi',
        villageTam: 'மகேந்திரவாடி',
        isHamlet: false
    },
    {
        names: ['kattupakkam', 'காட்டுப்பாக்கம்'],
        district: 'Ranipet',
        districtTam: 'இராணிப்பேட்டை',
        taluk: 'Nemili',
        talukTam: 'நேமிலி',
        village: 'Kattupakkam',
        villageTam: 'காட்டுப்பாக்கம்',
        isHamlet: false
    },
    {
        names: ['thandalam', 'தண்டலம்'],
        district: 'Ranipet',
        districtTam: 'இராணிப்பேட்டை',
        taluk: 'Nemili',
        talukTam: 'நேமிலி',
        village: 'Thandalam',
        villageTam: 'தண்டலம்',
        isHamlet: false
    },
    {
        names: ['pallur', 'பள்ளூர்'],
        district: 'Ranipet',
        districtTam: 'இராணிப்பேட்டை',
        taluk: 'Nemili',
        talukTam: 'நேமிலி',
        village: 'Pallur',
        villageTam: 'பள்ளூர்',
        isHamlet: false
    },
    {
        names: ['pudupattu', 'புதுப்பட்டு'],
        district: 'Ranipet',
        districtTam: 'இராணிப்பேட்டை',
        taluk: 'Nemili',
        talukTam: 'நேமிலி',
        village: 'Pudupattu',
        villageTam: 'புதுப்பட்டு',
        isHamlet: false
    },
    {
        names: ['veliyanallur', 'வெளியநல்லூர்'],
        district: 'Ranipet',
        districtTam: 'இராணிப்பேட்டை',
        taluk: 'Nemili',
        talukTam: 'நேமிலி',
        village: 'Veliyanallur',
        villageTam: 'வெளியநல்லூர்',
        isHamlet: false
    },
    {
        names: ['alapakkam', 'ஆலப்பாக்கம்'],
        district: 'Ranipet',
        districtTam: 'இராணிப்பேட்டை',
        taluk: 'Nemili',
        talukTam: 'நேமிலி',
        village: 'Alapakkam',
        villageTam: 'ஆலப்பாக்கம்',
        isHamlet: false
    },
    {
        names: ['kavanoor', 'kavanur', 'கவனூர்'],
        district: 'Ranipet',
        districtTam: 'இராணிப்பேட்டை',
        taluk: 'Nemili',
        talukTam: 'நேமிலி',
        village: 'Kavanoor',
        villageTam: 'கவனூர்',
        isHamlet: false
    },
    {
        names: ['jagirthandalam', 'ஜாகீர்தண்டலம்'],
        district: 'Ranipet',
        districtTam: 'இராணிப்பேட்டை',
        taluk: 'Nemili',
        talukTam: 'நேமிலி',
        village: 'Jagirthandalam',
        villageTam: 'ஜாகீர்தண்டலம்',
        isHamlet: false
    },
    {
        names: ['thirupparkadal', 'திருப்பாற்கடல்'],
        district: 'Ranipet',
        districtTam: 'இராணிப்பேட்டை',
        taluk: 'Nemili',
        talukTam: 'நேமிலி',
        village: 'Thirupparkadal',
        villageTam: 'திருப்பாற்கடல்',
        isHamlet: false
    },
    {
        names: ['nemili', 'நேமிலி', 'நெமிலி'],
        district: 'Ranipet',
        districtTam: 'இராணிப்பேட்டை',
        taluk: 'Nemili',
        talukTam: 'நேமிலி',
        village: 'Nemili',
        villageTam: 'நேமிலி',
        isHamlet: false
    },

    // --- ARAKKONAM TALUK (RANIPET DISTRICT) ---
    {
        names: ['narasingapuram', 'நரசிங்கபுரம்'],
        district: 'Ranipet',
        districtTam: 'இராணிப்பேட்டை',
        taluk: 'Arakkonam',
        talukTam: 'அரக்கோணம்',
        village: 'Minnal',
        villageTam: 'மின்னல்',
        areaEng: 'NARASINGAPURAM',
        areaTam: 'நரசிங்கபுரம்',
        isHamlet: true
    },
    {
        names: ['minnal', 'மின்னல்'],
        district: 'Ranipet',
        districtTam: 'இராணிப்பேட்டை',
        taluk: 'Arakkonam',
        talukTam: 'அரக்கோணம்',
        village: 'Minnal',
        villageTam: 'மின்னல்',
        isHamlet: false
    },
    {
        names: ['anverthikanpettai', 'anverthikanpet', 'anwarthikanpet', 'அன்வர்த்திகான்பேட்டை'],
        district: 'Ranipet',
        districtTam: 'இராணிப்பேட்டை',
        taluk: 'Arakkonam',
        talukTam: 'அரக்கோணம்',
        village: 'Anverthikanpettai',
        villageTam: 'அன்வர்த்திகான்பேட்டை',
        isHamlet: false
    },
    {
        names: ['thakkolam', 'தக்கோலம்'],
        district: 'Ranipet',
        districtTam: 'இராணிப்பேட்டை',
        taluk: 'Arakkonam',
        talukTam: 'அரக்கோணம்',
        village: 'Thakkolam',
        villageTam: 'தக்கோலம்',
        isHamlet: false
    },
    {
        names: ['mosur', 'மோசூர்'],
        district: 'Ranipet',
        districtTam: 'இராணிப்பேட்டை',
        taluk: 'Arakkonam',
        talukTam: 'அரக்கோணம்',
        village: 'Mosur',
        villageTam: 'மோசூர்',
        isHamlet: false
    },
    {
        names: ['sembedu', 'செம்பேடு'],
        district: 'Ranipet',
        districtTam: 'இராணிப்பேட்டை',
        taluk: 'Arakkonam',
        talukTam: 'அரக்கோணம்',
        village: 'Sembedu',
        villageTam: 'செம்பேடு',
        isHamlet: false
    },

    // --- SHOLINGHUR TALUK (RANIPET DISTRICT) ---
    {
        names: ['kunnathur colony', 'குன்னத்தூர் காலனி'],
        district: 'Ranipet',
        districtTam: 'இராணிப்பேட்டை',
        taluk: 'Sholinghur',
        talukTam: 'சோளிங்கர்',
        village: 'Kunnathur',
        villageTam: 'குன்னத்தூர்',
        areaEng: 'KUNNATHUR COLONY',
        areaTam: 'குன்னத்தூர் காலனி',
        isHamlet: true
    },
    {
        names: ['kunnathur', 'gunnathur', 'குன்னத்தூர்'],
        district: 'Ranipet',
        districtTam: 'இராணிப்பேட்டை',
        taluk: 'Sholinghur',
        talukTam: 'சோளிங்கர்',
        village: 'Kunnathur',
        villageTam: 'குன்னத்தூர்',
        isHamlet: false
    },
    {
        names: ['sholinghur', 'sholingur', 'shozhingur', 'சோளிங்கர்', 'சோளிங்கூர்'],
        district: 'Ranipet',
        districtTam: 'இராணிப்பேட்டை',
        taluk: 'Sholinghur',
        talukTam: 'சோளிங்கர்',
        village: 'Sholinghur',
        villageTam: 'சோளிங்கர்',
        isHamlet: false
    },
    {
        names: ['kondapalayam', 'கொண்டபாளையம்'],
        district: 'Ranipet',
        districtTam: 'இராணிப்பேட்டை',
        taluk: 'Sholinghur',
        talukTam: 'சோளிங்கர்',
        village: 'Kondapalayam',
        villageTam: 'கொண்டபாளையம்',
        isHamlet: false
    },
    {
        names: ['rendadi', 'ரெண்டாடி'],
        district: 'Ranipet',
        districtTam: 'இராணிப்பேட்டை',
        taluk: 'Sholinghur',
        talukTam: 'சோளிங்கர்',
        village: 'Rendadi',
        villageTam: 'ரெண்டாடி',
        isHamlet: false
    },
    {
        names: ['pandiyanallur', 'பாண்டியநல்லூர்'],
        district: 'Ranipet',
        districtTam: 'இராணிப்பேட்டை',
        taluk: 'Sholinghur',
        talukTam: 'சோளிங்கர்',
        village: 'Pandiyanallur',
        villageTam: 'பாண்டியநல்லூர்',
        isHamlet: false
    },

    // --- WALAJAH TALUK (RANIPET DISTRICT) ---
    {
        names: ['walajah', 'walajapet', 'வாலாஜா', 'வாலாஜாபேட்டை'],
        district: 'Ranipet',
        districtTam: 'இராணிப்பேட்டை',
        taluk: 'Walajah',
        talukTam: 'வாலாஜா',
        village: 'Walajah',
        villageTam: 'வாலாஜா',
        isHamlet: false
    },
    {
        names: ['ranipet town', 'navalpur', 'நாவல்பூர்'],
        district: 'Ranipet',
        districtTam: 'இராணிப்பேட்டை',
        taluk: 'Walajah',
        talukTam: 'வாலாஜா',
        village: 'Ranipet',
        villageTam: 'இராணிப்பேட்டை',
        isHamlet: false
    },

    // --- ARCOT TALUK (RANIPET DISTRICT) ---
    {
        names: ['arcot', 'ஆற்காடு'],
        district: 'Ranipet',
        districtTam: 'இராணிப்பேட்டை',
        taluk: 'Arcot',
        talukTam: 'ஆற்காடு',
        village: 'Arcot',
        villageTam: 'ஆற்காடு',
        isHamlet: false
    },
    {
        names: ['timiri', 'திமிரி'],
        district: 'Ranipet',
        districtTam: 'இராணிப்பேட்டை',
        taluk: 'Arcot',
        talukTam: 'ஆற்காடு',
        village: 'Timiri',
        villageTam: 'திமிரி',
        isHamlet: false
    },
    {
        names: ['melvisharam', 'மேல்விஷாரம்'],
        district: 'Ranipet',
        districtTam: 'இராணிப்பேட்டை',
        taluk: 'Arcot',
        talukTam: 'ஆற்காடு',
        village: 'Melvisharam',
        villageTam: 'மேல்விஷாரம்',
        isHamlet: false
    },

    // --- KALAVAI TALUK (RANIPET DISTRICT) ---
    {
        names: ['kalavai', 'கலவை'],
        district: 'Ranipet',
        districtTam: 'இராணிப்பேட்டை',
        taluk: 'Kalavai',
        talukTam: 'கலவை',
        village: 'Kalavai',
        villageTam: 'கலவை',
        isHamlet: false
    },

    // --- CHENGALPATTU DISTRICT ---
    {
        names: ['tambaram', 'தாம்பரம்'],
        district: 'Chengalpattu',
        districtTam: 'செங்கல்பட்டு',
        taluk: 'Tambaram',
        talukTam: 'தாம்பரம்',
        village: 'Tambaram',
        villageTam: 'தாம்பரம்',
        isHamlet: false
    },
    {
        names: ['chromepet', 'குரோம்பேட்டை'],
        district: 'Chengalpattu',
        districtTam: 'செங்கல்பட்டு',
        taluk: 'Pallavaram',
        talukTam: 'பல்லாவரம்',
        village: 'Chromepet',
        villageTam: 'குரோம்பேட்டை',
        isHamlet: false
    },
    {
        names: ['pallavaram', 'பல்லாவரம்'],
        district: 'Chengalpattu',
        districtTam: 'செங்கல்பட்டு',
        taluk: 'Pallavaram',
        talukTam: 'பல்லாவரம்',
        village: 'Pallavaram',
        villageTam: 'பல்லாவரம்',
        isHamlet: false
    },
    {
        names: ['vandalur', 'வண்டலூர்'],
        district: 'Chengalpattu',
        districtTam: 'செங்கல்பட்டு',
        taluk: 'Vandalur',
        talukTam: 'வண்டலூர்',
        village: 'Vandalur',
        villageTam: 'வண்டலூர்',
        isHamlet: false
    },
    {
        names: ['guduvanchery', 'கூடுவாஞ்சேரி'],
        district: 'Chengalpattu',
        districtTam: 'செங்கல்பட்டு',
        taluk: 'Vandalur',
        talukTam: 'வண்டலூர்',
        village: 'Guduvanchery',
        villageTam: 'கூடுவாஞ்சேரி',
        isHamlet: false
    },
    {
        names: ['maraimalai nagar', 'மறைமலை நகர்'],
        district: 'Chengalpattu',
        districtTam: 'செங்கல்பட்டு',
        taluk: 'Vandalur',
        talukTam: 'வண்டலூர்',
        village: 'Maraimalai Nagar',
        villageTam: 'மறைமலை நகர்',
        isHamlet: false
    },
    {
        names: ['madurantakam', 'மதுராந்தகம்'],
        district: 'Chengalpattu',
        districtTam: 'செங்கல்பட்டு',
        taluk: 'Madurantakam',
        talukTam: 'மதுராந்தகம்',
        village: 'Madurantakam',
        villageTam: 'மதுராந்தகம்',
        isHamlet: false
    },
    {
        names: ['tiruporur', 'திருப்போரூர்'],
        district: 'Chengalpattu',
        districtTam: 'செங்கல்பட்டு',
        taluk: 'Tiruporur',
        talukTam: 'திருப்போரூர்',
        village: 'Tiruporur',
        villageTam: 'திருப்போரூர்',
        isHamlet: false
    },
    {
        names: ['kelambakkam', 'கேளம்பாக்கம்'],
        district: 'Chengalpattu',
        districtTam: 'செங்கல்பட்டு',
        taluk: 'Tiruporur',
        talukTam: 'திருப்போரூர்',
        village: 'Kelambakkam',
        villageTam: 'கேளம்பாக்கம்',
        isHamlet: false
    },
    {
        names: ['thirukalukundram', 'திருக்கழுக்குன்றம்'],
        district: 'Chengalpattu',
        districtTam: 'செங்கல்பட்டு',
        taluk: 'Thirukalukundram',
        talukTam: 'திருக்கழுக்குன்றம்',
        village: 'Thirukalukundram',
        villageTam: 'திருக்கழுக்குன்றம்',
        isHamlet: false
    },
    {
        names: ['mamallapuram', 'mahabalipuram', 'மாமல்லபுரம்', 'மகாபலிபுரம்'],
        district: 'Chengalpattu',
        districtTam: 'செங்கல்பட்டு',
        taluk: 'Thirukalukundram',
        talukTam: 'திருக்கழுக்குன்றம்',
        village: 'Mamallapuram',
        villageTam: 'மாமல்லபுரம்',
        isHamlet: false
    },

    // --- KALLAKURICHI DISTRICT ---
    {
        names: ['kallakurichi', 'கள்ளக்குறிச்சி'],
        district: 'Kallakurichi',
        districtTam: 'கள்ளக்குறிச்சி',
        taluk: 'Kallakurichi',
        talukTam: 'கள்ளக்குறிச்சி',
        village: 'Kallakurichi',
        villageTam: 'கள்ளக்குறிச்சி',
        isHamlet: false
    },
    {
        names: ['tirukkoyilur', 'thirukovilur', 'திருக்கோவிலூர்', 'திருக்கோயிலூர்'],
        district: 'Kallakurichi',
        districtTam: 'கள்ளக்குறிச்சி',
        taluk: 'Tirukkoyilur',
        talukTam: 'திருக்கோவிலூர்',
        village: 'Tirukkoyilur',
        villageTam: 'திருக்கோவிலூர்',
        isHamlet: false
    },
    {
        names: ['sankarapuram', 'சங்கராபுரம்'],
        district: 'Kallakurichi',
        districtTam: 'கள்ளக்குறிச்சி',
        taluk: 'Sankarapuram',
        talukTam: 'சங்கராபுரம்',
        village: 'Sankarapuram',
        villageTam: 'சங்கராபுரம்',
        isHamlet: false
    },
    {
        names: ['ulundurpet', 'உளுந்தூர்பேட்டை'],
        district: 'Kallakurichi',
        districtTam: 'கள்ளக்குறிச்சி',
        taluk: 'Ulundurpet',
        talukTam: 'உளுந்தூர்பேட்டை',
        village: 'Ulundurpet',
        villageTam: 'உளுந்தூர்பேட்டை',
        isHamlet: false
    },
    {
        names: ['chinnasalem', 'சின்னசேலம்'],
        district: 'Kallakurichi',
        districtTam: 'கள்ளக்குறிச்சி',
        taluk: 'Chinnasalem',
        talukTam: 'சின்னசேலம்',
        village: 'Chinnasalem',
        villageTam: 'சின்னசேலம்',
        isHamlet: false
    },

    // --- TENKASI DISTRICT ---
    {
        names: ['tenkasi', 'தென்காசி'],
        district: 'Tenkasi',
        districtTam: 'தென்காசி',
        taluk: 'Tenkasi',
        talukTam: 'தென்காசி',
        village: 'Tenkasi',
        villageTam: 'தென்காசி',
        isHamlet: false
    },
    {
        names: ['sengottai', 'shencottah', 'செங்கோட்டை'],
        district: 'Tenkasi',
        districtTam: 'தென்காசி',
        taluk: 'Sengottai',
        talukTam: 'செங்கோட்டை',
        village: 'Sengottai',
        villageTam: 'செங்கோட்டை',
        isHamlet: false
    },
    {
        names: ['kadayanallur', 'கடையநல்லூர்'],
        district: 'Tenkasi',
        districtTam: 'தென்காசி',
        taluk: 'Kadayanallur',
        talukTam: 'கடையநல்லூர்',
        village: 'Kadayanallur',
        villageTam: 'கடையநல்லூர்',
        isHamlet: false
    },
    {
        names: ['sankarankovil', 'sankarankoil', 'சங்கரன்கோவில்'],
        district: 'Tenkasi',
        districtTam: 'தென்காசி',
        taluk: 'Sankarankovil',
        talukTam: 'சங்கரன்கோவில்',
        village: 'Sankarankovil',
        villageTam: 'சங்கரன்கோவில்',
        isHamlet: false
    },
    {
        names: ['sivagiri', 'சிவகிரி'],
        district: 'Tenkasi',
        districtTam: 'தென்காசி',
        taluk: 'Sivagiri',
        talukTam: 'சிவகிரி',
        village: 'Sivagiri',
        villageTam: 'சிவகிரி',
        isHamlet: false
    },
    {
        names: ['alangulam', 'ஆலங்குளம்'],
        district: 'Tenkasi',
        districtTam: 'தென்காசி',
        taluk: 'Alangulam',
        talukTam: 'ஆலங்குளம்',
        village: 'Alangulam',
        villageTam: 'ஆலங்குளம்',
        isHamlet: false
    },
    {
        names: ['veerakeralamputhur', 'veerakeralampudur', 'வீரகேரளம்புதூர்'],
        district: 'Tenkasi',
        districtTam: 'தென்காசி',
        taluk: 'Veerakeralamputhur',
        talukTam: 'வீரகேரளம்புதூர்',
        village: 'Veerakeralamputhur',
        villageTam: 'வீரகேரளம்புதூர்',
        isHamlet: false
    },
    {
        names: ['thiruvengadam', 'திருவேங்கடம்'],
        district: 'Tenkasi',
        districtTam: 'தென்காசி',
        taluk: 'Thiruvengadam',
        talukTam: 'திருவேங்கடம்',
        village: 'Thiruvengadam',
        villageTam: 'திருவேங்கடம்',
        isHamlet: false
    },

    // --- MAYILADUTHURAI DISTRICT ---
    {
        names: ['mayiladuthurai', 'mayuram', 'மயிலாடுதுறை'],
        district: 'Mayiladuthurai',
        districtTam: 'மயிலாடுதுறை',
        taluk: 'Mayiladuthurai',
        talukTam: 'மயிலாடுதுறை',
        village: 'Mayiladuthurai',
        villageTam: 'மயிலாடுதுறை',
        isHamlet: false
    },
    {
        names: ['sirkazhi', 'sirkaazhi', 'shiyali', 'சீர்காழி'],
        district: 'Mayiladuthurai',
        districtTam: 'மயிலாடுதுறை',
        taluk: 'Sirkazhi',
        talukTam: 'சீர்காழி',
        village: 'Sirkazhi',
        villageTam: 'சீர்காழி',
        isHamlet: false
    },
    {
        names: ['tharangambadi', 'tranquebar', 'தரங்கம்பாடி'],
        district: 'Mayiladuthurai',
        districtTam: 'மயிலாடுதுறை',
        taluk: 'Tharangambadi',
        talukTam: 'தரங்கம்பாடி',
        village: 'Tharangambadi',
        villageTam: 'தரங்கம்பாடி',
        isHamlet: false
    },
    {
        names: ['kuthalam', 'குத்தாலம்'],
        district: 'Mayiladuthurai',
        districtTam: 'மயிலாடுதுறை',
        taluk: 'Kuthalam',
        talukTam: 'குத்தாலம்',
        village: 'Kuthalam',
        villageTam: 'குத்தாலம்',
        isHamlet: false
    },

    // --- TIRUPATHUR DISTRICT ---
    {
        names: ['tirupathur', 'tirupattur', 'திருப்பத்தூர்'],
        district: 'Tirupathur',
        districtTam: 'திருப்பத்தூர்',
        taluk: 'Tirupathur',
        talukTam: 'திருப்பத்தூர்',
        village: 'Tirupathur',
        villageTam: 'திருப்பத்தூர்',
        isHamlet: false
    },
    {
        names: ['jolarpet', 'jolarpettai', 'ஜோலார்பேட்டை'],
        district: 'Tirupathur',
        districtTam: 'திருப்பத்தூர்',
        taluk: 'Jolarpet',
        talukTam: 'ஜோலார்பேட்டை',
        village: 'Jolarpet',
        villageTam: 'ஜோலார்பேட்டை',
        isHamlet: false
    },
    {
        names: ['vaniyambadi', 'வாணியம்பாடி'],
        district: 'Tirupathur',
        districtTam: 'திருப்பத்தூர்',
        taluk: 'Vaniyambadi',
        talukTam: 'வாணியம்பாடி',
        village: 'Vaniyambadi',
        villageTam: 'வாணியம்பாடி',
        isHamlet: false
    },
    {
        names: ['ambur', 'ஆம்பூர்'],
        district: 'Tirupathur',
        districtTam: 'திருப்பத்தூர்',
        taluk: 'Ambur',
        talukTam: 'ஆம்பூர்',
        village: 'Ambur',
        villageTam: 'ஆம்பூர்',
        isHamlet: false
    },
    {
        names: ['natrampalli', 'நாட்டறம்பள்ளி'],
        district: 'Tirupathur',
        districtTam: 'திருப்பத்தூர்',
        taluk: 'Natrampalli',
        talukTam: 'நாட்டறம்பள்ளி',
        village: 'Natrampalli',
        villageTam: 'நாட்டறம்பள்ளி',
        isHamlet: false
    }
];

// =============================================================================
// 4. SMART RESOLUTION HELPER FUNCTIONS
// =============================================================================

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
 * 
 * @param {string} district - Citizen/OCR supplied District
 * @param {string} taluk - Citizen/OCR supplied Taluk
 * @param {string} village - Citizen/OCR supplied Village/Town
 * @param {string} pincode - Citizen/OCR supplied 6-digit Pincode
 * @param {string} fullAddressText - Additional address text for context
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
        
        // Check if district was old parent district or incorrect
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
