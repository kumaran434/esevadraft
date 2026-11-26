/**
 * eSevaDraft FSM Options & Service Registry
 */

const SERVICE_OPTIONS = [
    { label: "🏛️ ரேஷன் கார்டு (Ration Card - TNPDS)", value: "ரேஷன் கார்டு" },
    { label: "🏛️ வருவாய்த் துறை சான்றிதழ்கள் (Revenue Department - e-Sevai / TNeGA)", value: "வருவாய்த் துறை" },
    { label: "🗳️ புதிய வாக்காளர் அட்டை (New Voter ID)", value: "புதிய வாக்காளர் அட்டை" }
];

const REVENUE_DEPARTMENT_SERVICE_OPTIONS = [
    { label: "📜 1. சாதிச் சான்றிதழ் (Community Certificate REV-101)", value: "சாதிச் சான்றிதழ்" },
    { label: "🏠 2. இருப்பிடச் சான்றிதழ் (Residence Certificate REV-102)", value: "இருப்பிடச் சான்றிதழ்" },
    { label: "💰 3. வருமானச் சான்றிதழ் (Income Certificate REV-103)", value: "வருமானச் சான்றிதழ்" },
    { label: "🎓 4. முதல் பட்டதாரி சான்றிதழ் (First Graduate REV-104)", value: "முதல் பட்டதாரி சான்றிதழ்" },
    { label: "📜 5. OBC சான்றிதழ் (OBC Certificate REV-115)", value: "OBC சான்றிதழ்" },
    { label: "👨‍👩‍👧‍👦 6. வாரிசு சான்றிதழ் (Legal Heir Certificate REV-114)", value: "வாரிசு சான்றிதழ்" },
    { label: "🕊️ 7. விதவைச் சான்றிதழ் (Widow Certificate REV-109)", value: "விதவைச் சான்றிதழ்" },
    { label: "🔙 முதன்மைப் பட்டியல் (Back to Main Menu)", value: "MAIN_MENU" }
];

const RATION_CARD_SERVICE_OPTIONS = [
    { label: "🏛️ 1. புதிய குடும்ப அட்டை (Apply New Smart Card)", value: "புதிய ரேஷன் கார்டு" },
    { label: "➕ 2. குடும்ப உறுப்பினர் சேர்க்க (Add Member)", value: "குடும்ப உறுப்பினர் சேர்க்க" },
    { label: "📍 3. முகவரி மாற்றம் (Change Address)", value: "முகவரி மாற்றம்" },
    { label: "📱 4. கைபேசி எண் மாற்றம் / பதிவு (Update Mobile)", value: "கைபேசி எண் மாற்றம்" },
    { label: "🔙 முதன்மைப் பட்டியல் (Back to Main Menu)", value: "MAIN_MENU" }
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
    const { normalizeRelationshipPair } = require('../../portal/tnpds/helpers/relationship_matcher');
    const raw = String(tamRel || '').trim();
    const res = normalizeRelationshipPair(raw, raw);
    if (res.key) {
        return { eng: res.eng, tam: res.tam, gender: res.gender, genderTam: res.genderTam };
    }
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
    REVENUE_DEPARTMENT_SERVICE_OPTIONS,
    RATION_CARD_SERVICE_OPTIONS,
    MEMBER_COUNT_OPTIONS,
    RESIDENCE_PROOF_OPTIONS,
    RELATIONSHIP_OPTIONS,
    getRelationshipOptions,
    mapRelationshipToEng,
    getInitialWelcomeMessage
};
