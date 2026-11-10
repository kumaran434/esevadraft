/**
 * eSevaDraft FSM Options & Service Registry
 */

const SERVICE_OPTIONS = [
    { label: "🏛️ ரேஷன் கார்டு (Ration Card)", value: "ரேஷன் கார்டு" },
    { label: "📜 வருமானச் சான்றிதழ் (Income Certificate)", value: "வருமானச் சான்றிதழ்" },
    { label: "🏠 இருப்பிடச் சான்றிதழ் (Residence Certificate)", value: "இருப்பிடச் சான்றிதழ்" },
    { label: "📜 சாதிச் சான்றிதழ் (Community Certificate)", value: "சாதிச் சான்றிதழ்" },
    { label: "🗳️ புதிய வாக்காளர் அட்டை (New Voter ID)", value: "புதிய வாக்காளர் அட்டை" }
];

const RATION_CARD_SERVICE_OPTIONS = [
    { label: "🏛️ 1. புதிய குடும்ப அட்டை (Apply New Smart Card)", value: "புதிய ரேஷன் கார்டு" },
    { label: "➕ 2. குடும்ப உறுப்பினர் சேர்க்க (Add Member)", value: "குடும்ப உறுப்பினர் சேர்க்க" },
    { label: "➖ 3. குடும்ப உறுப்பினர் நீக்க (Remove Member)", value: "குடும்ப உறுப்பினர் நீக்க" },
    { label: "👤 4. குடும்பத் தலைவர் மாற்றம் (Change Head)", value: "குடும்பத் தலைவர் மாற்றம்" },
    { label: "📍 5. முகவரி மாற்றம் (Change Address)", value: "முகவரி மாற்றம்" },
    { label: "📇 6. குடும்ப அட்டை வகை மாற்றம் (Change Card Type)", value: "குடும்ப அட்டை வகை மாற்றம்" },
    { label: "📱 7. கைபேசி எண் மாற்றம் / பதிவு (Update Mobile)", value: "கைபேசி எண் மாற்றம்" },
    { label: "⛽ 8. எரிவாயு (LPG) விவரங்கள் திருத்தம் (LPG Details)", value: "எரிவாயு விவரங்கள் திருத்தம்" }
];

const MEMBER_COUNT_OPTIONS = [
    { label: "1 உறுப்பினர் (தலைவர் மட்டும்)", value: "1 உறுப்பினர்" },
    { label: "2 உறுப்பினர்கள்", value: "2 உறுப்பினர்கள்" },
    { label: "3 உறுப்பினர்கள்", value: "3 உறுப்பினர்கள்" },
    { label: "4 உறுப்பினர்கள்", value: "4 உறுப்பினர்கள்" },
    { label: "5 உறுப்பினர்கள்", value: "5 உறுப்பினர்கள்" }
];

const RESIDENCE_PROOF_OPTIONS = [
    { label: "⛽ எரிவாயு நுகர்வோர் அட்டை (Gas Book)", value: "எரிவாயு நுகர்வோர் அட்டை" },
    { label: "🏛️ சொத்து வரி ரசீது (Property Tax)", value: "சொத்து வரி ரசீது" },
    { label: "⚡ மின் கட்டண ரசீது (Electricity / EB Bill)", value: "மின் கட்டண ரசீது" },
    { label: "📄 வாடகை ஒப்பந்தம் (Rental Agreement)", value: "வாடகை ஒப்பந்தம்" },
    { label: "💧 குடிநீர் வரி ரசீது (Water Tax Bill)", value: "குடிநீர் வரி ரசீது" }
];

const RELATIONSHIP_OPTIONS = [
    { label: "கணவர் (Husband)", value: "கணவர்" },
    { label: "மனைவி (Wife)", value: "மனைவி" },
    { label: "மகன் (Son)", value: "மகன்" },
    { label: "மகள் (Daughter)", value: "மகள்" },
    { label: "மருமகள் (Daughter-in-law)", value: "மருமகள்" },
    { label: "மருமகன் (Son-in-law)", value: "மருமகன்" },
    { label: "தந்தை (Father)", value: "தந்தை" },
    { label: "தாய் (Mother)", value: "தாய்" },
    { label: "சகோதரன் (Brother)", value: "சகோதரன்" },
    { label: "சகோதரி (Sister)", value: "சகோதரி" },
    { label: "மாமனார் (Father-in-law)", value: "மாமனார்" },
    { label: "மாமியார் (Mother-in-law)", value: "மாமியார்" }
];

function getRelationshipOptions(headGender = '') {
    if (headGender === 'Female' || headGender === 'பெண்') {
        return [
            { label: "கணவர் (Husband)", value: "கணவர்" },
            { label: "மகன் (Son)", value: "மகன்" },
            { label: "மகள் (Daughter)", value: "மகள்" },
            { label: "மருமகள் (Daughter-in-law)", value: "மருமகள்" },
            { label: "மருமகன் (Son-in-law)", value: "மருமகன்" },
            { label: "தந்தை (Father)", value: "தந்தை" },
            { label: "தாய் (Mother)", value: "தாய்" },
            { label: "சகோதரன் (Brother)", value: "சகோதரன்" },
            { label: "சகோதரி (Sister)", value: "சகோதரி" },
            { label: "மாமனார் (Father-in-law)", value: "மாமனார்" },
            { label: "மாமியார் (Mother-in-law)", value: "மாமியார்" }
        ];
    }
    return [
        { label: "மனைவி (Wife)", value: "மனைவி" },
        { label: "மகன் (Son)", value: "மகன்" },
        { label: "மகள் (Daughter)", value: "மகள்" },
        { label: "மருமகள் (Daughter-in-law)", value: "மருமகள்" },
        { label: "மருமகன் (Son-in-law)", value: "மருமகன்" },
        { label: "தந்தை (Father)", value: "தந்தை" },
        { label: "தாய் (Mother)", value: "தாய்" },
        { label: "சகோதரன் (Brother)", value: "சகோதரன்" },
        { label: "சகோதரி (Sister)", value: "சகோதரி" },
        { label: "கணவர் (Husband)", value: "கணவர்" },
        { label: "மாமனார் (Father-in-law)", value: "மாமனார்" },
        { label: "மாமியார் (Mother-in-law)", value: "மாமியார்" }
    ];
}

function mapRelationshipToEng(tamRel) {
    const map = {
        'கணவர்': { eng: 'Husband', tam: 'கணவர்', gender: 'Male', genderTam: 'ஆண்' },
        'மனைவி': { eng: 'Wife', tam: 'மனைவி', gender: 'Female', genderTam: 'பெண்' },
        'மகன்': { eng: 'Son', tam: 'மகன்', gender: 'Male', genderTam: 'ஆண்' },
        'மகள்': { eng: 'Daughter', tam: 'மகள்', gender: 'Female', genderTam: 'பெண்' },
        'மருமகள்': { eng: 'Daughter-in-law', tam: 'மருமகள்', gender: 'Female', genderTam: 'பெண்' },
        'மருமகன்': { eng: 'Son-in-law', tam: 'மருமகன்', gender: 'Male', genderTam: 'ஆண்' },
        'சகோதரன்': { eng: 'Brother', tam: 'சகோதரன்', gender: 'Male', genderTam: 'ஆண்' },
        'சகோதரி': { eng: 'Sister', tam: 'சகோதரி', gender: 'Female', genderTam: 'பெண்' },
        'தாய்': { eng: 'Mother', tam: 'தாய்', gender: 'Female', genderTam: 'பெண்' },
        'தந்தை': { eng: 'Father', tam: 'தந்தை', gender: 'Male', genderTam: 'ஆண்' },
        'மாமனார்': { eng: 'Father-in-law', tam: 'மாமனார்', gender: 'Male', genderTam: 'ஆண்' },
        'மாமியார்': { eng: 'Mother-in-law', tam: 'மாமியார்', gender: 'Female', genderTam: 'பெண்' }
    };
    for (const [key, val] of Object.entries(map)) {
        if (tamRel.includes(key)) return val;
    }
    const lower = tamRel.toLowerCase();
    if (lower.includes('daughter-in-law') || lower.includes('daughter in law')) return map['மருமகள்'];
    if (lower.includes('son-in-law') || lower.includes('son in law')) return map['மருமகன்'];
    if (lower.includes('husband')) return map['கணவர்'];
    if (lower.includes('wife')) return map['மனைவி'];
    if (lower.includes('son')) return map['மகன்'];
    if (lower.includes('daughter')) return map['மகள்'];
    if (lower.includes('brother')) return map['சகோதரன்'];
    if (lower.includes('sister')) return map['சகோதரி'];
    if (lower.includes('mother')) return map['தாய்'];
    if (lower.includes('father')) return map['தந்தை'];

    return { eng: 'Husband', tam: 'கணவர்', gender: 'Male', genderTam: 'ஆண்' };
}

function getInitialWelcomeMessage(citizenProfile = null, phone = '') {
    const resolvedName = citizenProfile ? (citizenProfile.fullNameTam || citizenProfile.fullNameEng || '') : '';
    const namePart = resolvedName ? ` திரு/திருமதி **${resolvedName}**` : '';
    const phonePart = phone ? ` (+91 ${phone})` : '';
    const greeting = (resolvedName || phone) 
        ? `வணக்கம்${namePart}!${phonePart} 🙏\n\n**eSevaDraft (https://esevadraft.in/)** தமிழ்நாடு அரசு சேவைகள் ஏஐ உதவி மையத்திற்கு வரவேற்கிறோம்!\n\n`
        : `வணக்கம்! 🙏 **eSevaDraft (https://esevadraft.in/)** தமிழ்நாடு அரசு சேவைகள் ஏஐ உதவி மையத்திற்கு வரவேற்கிறோம்!\n\n`;

    return {
        sender: 'bot',
        text: greeting +
              `வாடிக்கையாளர் இன்று எந்த அரசு சேவைக்கு விண்ணப்பிக்க விரும்புகிறார்?\n\n` +
              `கீழே உள்ள விருப்பங்களில் ஒன்றைத் தேர்ந்தெடுக்கவும்:`,
        options: SERVICE_OPTIONS
    };
}

module.exports = {
    SERVICE_OPTIONS,
    RATION_CARD_SERVICE_OPTIONS,
    MEMBER_COUNT_OPTIONS,
    RESIDENCE_PROOF_OPTIONS,
    RELATIONSHIP_OPTIONS,
    getRelationshipOptions,
    mapRelationshipToEng,
    getInitialWelcomeMessage
};
