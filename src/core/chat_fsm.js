const path = require('path');
let photoStudio = null;
try {
    photoStudio = require(path.join(__dirname, '../../photo_studio'));
} catch (e) {
    try {
        photoStudio = require(path.join(__dirname, '../photo_studio'));
    } catch (e2) {}
}

/**
 * eSevaDraft Finite State Machine (FSM) & Dialog Engine
 * 
 * Handles service selection, question branching, relationship mapping,
 * and conversational transitions in accordance with FEATURE_LOCK.md.
 */

const SERVICE_OPTIONS = [
    { label: "🏛️ ரேஷன் கார்டு (Ration Card)", value: "ரேஷன் கார்டு" },
    { label: "📜 வருமானச் சான்றிதழ் (Income Certificate)", value: "வருமானச் சான்றிதழ்" },
    { label: "🏠 இருப்பிடச் சான்றிதழ் (Residence Certificate)", value: "இருப்பிடச் சான்றிதழ்" },
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

function getInitialWelcomeMessage() {
    return {
        sender: 'bot',
        text: `வணக்கம்! 🙏 **eSevaDraft (https://esevadraft.in/)** தமிழ்நாடு அரசு சேவைகள் ஏஐ உதவி மையத்திற்கு வரவேற்கிறோம்!\n\n` +
              `நீங்கள் இன்று எந்த அரசு சேவைக்கு விண்ணப்பிக்க விரும்புகிறீர்கள்?\n` +
              `கீழே உள்ள விருப்பங்களில் ஒன்றைத் தேர்ந்தெடுக்கவும்:`,
        options: SERVICE_OPTIONS
    };
}

/**
 * Evaluates user input when state is SERVICE_SELECTION and transitions accordingly.
 */
function handleServiceSelection(text, sess) {
    const isAlreadyInRationMenu = sess.intakeState === 'RATION_CARD_SERVICES';

    const isNewRationCard = text === 'புதிய ரேஷன் கார்டு' || 
                           text === 'புதிய குடும்ப அட்டை' || 
                           text.includes('புதிய ரேஷன்') || 
                           text.includes('புதிய குடும்ப') || 
                           text.includes('New Ration Card') ||
                           (isAlreadyInRationMenu && (text === '1' || text.startsWith('1.') || text.includes('1. புதிய')));

    const isRationCardCategory = !isNewRationCard && !isAlreadyInRationMenu && (
        text === 'ரேஷன் கார்டு' || 
        text === 'ரேஷன்' || 
        text.toLowerCase() === 'ration' || 
        text.toLowerCase() === 'ration card' || 
        text.includes('குடும்ப அட்டை சேவைகள்') ||
        text === '1'
    );

    if (isRationCardCategory) {
        sess.intakeState = 'RATION_CARD_SERVICES';
        sess.step = 'RATION_CARD_SERVICES';
        sess.chatHistory.push({
            sender: 'bot',
            text: `🏛️ **குடும்ப அட்டை (Ration Card) சேவைகள்**\n\n` +
                  `நீங்கள் குடும்ப அட்டையில் எந்த சேவையைச் செய்ய விரும்புகிறீர்கள்?\n\n` +
                  `கீழே உள்ள விருப்பங்களில் ஒன்றைத் தேர்ந்தெடுக்கவும்:`,
            options: RATION_CARD_SERVICE_OPTIONS
        });
        return true;
    } else if (isNewRationCard) {
        const prof = sess.citizenProfile || {};
        const existingMembers = Array.isArray(prof.members) ? prof.members : [];
        const existingCount = existingMembers.length;
        const headName = prof.fullNameTam || prof.fullNameEng || '';

        // If customer already has existing members recorded (e.g. 2 members like Bhavana + Suresh V)
        if (headName && existingCount >= 1) {
            const memberNames = existingMembers.map(m => m.nameTam || m.nameEng).filter(Boolean).join(', ');
            sess.intakeState = 'READY_TO_APPLY';
            sess.step = 'READY';
            sess.targetMemberCount = existingCount;
            sess.chatHistory.push({
                sender: 'bot',
                text: `🎉 **வாடிக்கையாளர் (${headName}) ரேஷன் கார்டு விவரங்கள் ஏற்கெனவே முழுமையாகச் சேமிக்கப்பட்டுள்ளன!** 💾\n\n` +
                      `• 👤 **குடும்பத் தலைவர்:** ${headName}\n` +
                      `• 👥 **பதிவு செய்யப்பட்ட உறுப்பினர்கள் (${existingCount}):** ${memberNames || headName}\n` +
                      (prof.doorNo ? `• 🏠 **முகவரி:** ${prof.doorNo}, ${prof.streetTam || prof.streetEng || ''}\n` : '') +
                      `\nநேரடியாக TNPDS போர்ட்டலில் விண்ணப்பிக்கலாம்:`,
                options: [
                    { label: "🚀 TNPDS போர்ட்டலில் விண்ணப்பி (Submit to Portal)", value: "CONFIRM_SUBMIT" },
                    { label: "✏️ விவரங்களைச் சரிபார் / திருத்து (Review Details)", value: "TRIGGER_EDIT_MODAL" }
                ]
            });
            return true;
        }

        sess.intakeState = 'MEMBER_COUNT';
        sess.chatHistory.push({
            sender: 'bot',
            text: `🏛️ **புதிய ரேஷன் கார்டு (New Ration Card) விண்ணப்பத்திற்கு வரவேற்கிறோம்!**\n\n` +
                  `உங்கள் குடும்பத்தில் மொத்தம் எத்தனை நபர்களை (குடும்பத் தலைவர் உட்பட) உறுப்பினர்களாகச் சேர்க்க வேண்டும்?\n\n` +
                  `கீழே உள்ள எண்ணிக்கையைத் தேர்வு செய்யவும் அல்லது தட்டச்சு செய்யவும்:`,
            options: MEMBER_COUNT_OPTIONS
        });
        return true;
    } else if (text.includes('உறுப்பினர் சேர்க்க') || text === 'குடும்ப உறுப்பினர் சேர்க்க' || text.startsWith('2.') || (isAlreadyInRationMenu && text === '2')) {
        sess.subService = 'ADD_MEMBER';
        const subData = sess.subServiceData || sess.citizenProfile?.subServiceData || {};
        const memberName = subData.memberName || subData.memberNameTam || subData.memberNameEng || '';
        const aadhaarNo = subData.aadhaarNo || subData.aadhaarNumber || '';
        const relTam = subData.relationshipTam || '';

        // Case 1: All required details already exist (Name, Aadhaar, Relationship) -> Direct Submit
        if (memberName && aadhaarNo && relTam) {
            sess.subServiceData = subData;
            sess.intakeState = 'READY_TO_APPLY';
            sess.step = 'READY';
            sess.chatHistory.push(renderSubserviceReadySummary(sess));
            return true;
        }

        // Case 2: Aadhaar is present/scanned but Relationship is missing -> Ask only relationship
        if (memberName && aadhaarNo && !relTam) {
            sess.subServiceData = subData;
            sess.intakeState = 'RATION_ADD_MEMBER_RELATION';
            const nameDisplay = subData.memberNameTam && subData.memberNameEng
                ? `${subData.memberNameTam} (${subData.memberNameEng})`
                : memberName;
            const aadhaarDisplay = `\n• 🪪 **ஆதார் எண்:** ${aadhaarNo.replace(/(\d{4})/g, '$1 ').trim()}`;
            const dobDisplay = subData.dob ? `\n• 📅 **பிறந்த தேதி:** ${subData.dob}` : '';
            const genderDisplay = subData.genderTam ? `\n• ⚧ **பாலினம்:** ${subData.genderTam}` : '';

            sess.chatHistory.push({
                sender: 'bot',
                text: `✅ **ஆதார் அட்டை விவரங்கள் ஏற்கெனவே பெறப்பட்டுள்ளன!** 🪪\n\n` +
                      `• 👤 **உறுப்பினர் பெயர்:** ${nameDisplay}${aadhaarDisplay}${dobDisplay}${genderDisplay}\n\n` +
                      `❓ **குடும்பத் தலைவருடன் இவரின் உறவுமுறை என்ன?**\n\n` +
                      `கீழே உள்ள விருப்பத்தைத் தேர்ந்தெடுக்கவும் (அல்லது நேரடியாக தட்டச்சு செய்யவும்):`,
                options: [
                    { label: "👦 மகன் (Son)", value: "மகன்" },
                    { label: "👧 மகள் (Daughter)", value: "மகள்" },
                    { label: "👰 மனைவி (Wife)", value: "மனைவி" },
                    { label: "🤵 கணவர் (Husband)", value: "கணவர்" },
                    { label: "👵 தாய் (Mother)", value: "தாய்" },
                    { label: "👴 தந்தை (Father)", value: "தந்தை" },
                    { label: "👫 மருமகள் (Daughter-in-law)", value: "மருமகள்" },
                    { label: "👫 மருமகன் (Son-in-law)", value: "மருமகன்" },
                    { label: "🔙 பின்செல்ல", value: "குடும்ப உறுப்பினர் சேர்க்க" }
                ]
            });
            return true;
        }

        // Case 3: Fresh start -> Prompt for member Aadhaar upload
        sess.intakeState = 'RATION_ADD_MEMBER_TYPE';
        sess.chatHistory.push({
            sender: 'bot',
            text: `➕ **குடும்ப உறுப்பினர் சேர்க்கை (Add Family Member)**\n\n` +
                  `தமிழ்நாடு அரசு TNPDS விதிகளின்படி புதிய உறுப்பினர் சேர்க்கைக்கு **ஆதார் அட்டை (Aadhaar Card)** கட்டாயமாகும்.\n\n` +
                  `🪪 சேர்க்கப்பட வேண்டிய புதிய உறுப்பினரின் **ஆதார் அட்டையைப்** பதிவேற்றவும் (அல்லது புகைப்படம் எடுக்கவும்):`,
            actionRequired: 'upload',
            uploadPrompt: 'உறுப்பினர் ஆதார் அட்டை',
            options: [
                { label: "📷 ஆதார் அட்டை பதிவேற்றவும்", value: "TRIGGER_FILE_UPLOAD" },
                { label: "🔙 ரேஷன் கார்டு சேவைகள்", value: "ரேஷன் கார்டு" }
            ]
        });
        return true;
    } else if (text.includes('உறுப்பினர் நீக்க') || text === 'குடும்ப உறுப்பினர் நீக்க' || text.startsWith('3.') || (isAlreadyInRationMenu && text === '3')) {
        sess.intakeState = 'RATION_REMOVE_MEMBER_REASON';
        sess.subService = 'REMOVE_MEMBER';
        sess.chatHistory.push({
            sender: 'bot',
            text: `➖ **குடும்ப உறுப்பினர் நீக்கம் (Remove Family Member)**\n\n` +
                  `குடும்ப அட்டையிலிருந்து உறுப்பினரை நீக்குவதற்கான காரணம் என்ன?\n\n` +
                  `கீழே உள்ள காரணங்களில் ஒன்றைத் தேர்ந்தெடுக்கவும்:`,
            options: [
                { label: "🕊️ இறப்பு காரணமாக (Death of Member)", value: "REMOVE_REASON_DEATH" },
                { label: "💍 திருமணம் காரணமாக (Marriage)", value: "REMOVE_REASON_MARRIAGE" },
                { label: "📄 தனி அட்டை பிரிப்பு (Separate Card)", value: "REMOVE_REASON_SPLIT" },
                { label: "🔙 ரேஷன் கார்டு சேவைகள்", value: "ரேஷன் கார்டு" }
            ]
        });
        return true;
    } else if (text.includes('தலைவர் மாற்றம்') || text === 'குடும்பத் தலைவர் மாற்றம்' || text.startsWith('4.') || (isAlreadyInRationMenu && text === '4')) {
        sess.intakeState = 'RATION_CHANGE_HEAD_REASON';
        sess.subService = 'CHANGE_HEAD';
        sess.chatHistory.push({
            sender: 'bot',
            text: `👤 **குடும்பத் தலைவர் மாற்றம் (Change Family Head)**\n\n` +
                  `தலைவர் மாற்றத்திற்கான காரணம் என்ன?\n\n` +
                  `கீழே உள்ள காரணங்களில் ஒன்றைத் தேர்ந்தெடுக்கவும்:`,
            options: [
                { label: "🕊️ முந்தைய தலைவர் இறந்துவிட்டார் (Death of Head)", value: "HEAD_REASON_DEATH" },
                { label: "👴 முதியவர் / குடும்ப விருப்ப மாற்றம் (Mutual Consent / Age)", value: "HEAD_REASON_CONSENT" },
                { label: "🔙 ரேஷன் கார்டு சேவைகள்", value: "ரேஷன் கார்டு" }
            ]
        });
        return true;
    } else if (text.includes('முகவரி மாற்றம்') || text === 'முகவரி மாற்றம்' || text.startsWith('5.') || (isAlreadyInRationMenu && text === '5')) {
        sess.subService = 'CHANGE_ADDRESS';
        const subData = sess.subServiceData || sess.citizenProfile?.subServiceData || {};
        const doorNo = subData.doorNo || '';
        const streetTam = subData.streetTam || subData.streetEng || '';

        // Case 1: Address already exists -> Direct Submit
        if (doorNo && streetTam) {
            sess.subServiceData = subData;
            sess.intakeState = 'READY_TO_APPLY';
            sess.step = 'READY';
            sess.chatHistory.push(renderSubserviceReadySummary(sess));
            return true;
        }

        // Case 2: Fresh start
        sess.intakeState = 'RATION_CHANGE_ADDRESS_DOC';
        sess.chatHistory.push({
            sender: 'bot',
            text: `📍 **முகவரி மாற்றம் (Change Address)**\n\n` +
                  `ஒரே வட்டத்திற்குள் அல்லது வேறு மாவட்டம்/வட்டத்திற்கு குடும்ப அட்டையின் முகவரியை மாற்றலாம்.\n\n` +
                  `📋 **புதிய முகவரிக்கான சான்றாக எந்த ஆவணத்தைப் பதிவேற்ற விரும்புகிறீர்கள்?**`,
            options: [
                { label: "⚡ மின் கட்டண ரசீது (EB Bill)", value: "ADDR_PROOF_EB" },
                { label: "⛽ எரிவாயு நுகர்வோர் அட்டை (Gas Bill)", value: "ADDR_PROOF_GAS" },
                { label: "📄 வாடகை ஒப்பந்தம் (Rental Agreement)", value: "ADDR_PROOF_RENT" },
                { label: "🏛️ சொத்து வரி ரசீது (Property Tax)", value: "ADDR_PROOF_TAX" },
                { label: "🪪 புதிய முகவரி ஆதார் அட்டை (Aadhaar)", value: "ADDR_PROOF_AADHAAR" },
                { label: "🔙 ரேஷன் கார்டு சேவைகள்", value: "ரேஷன் கார்டு" }
            ]
        });
        return true;
    } else if (text.includes('அட்டை வகை') || text === 'குடும்ப அட்டை வகை மாற்றம்' || text.startsWith('6.') || (isAlreadyInRationMenu && text === '6')) {
        sess.intakeState = 'RATION_CHANGE_CARD_TYPE';
        sess.subService = 'CHANGE_CARD_TYPE';
        sess.chatHistory.push({
            sender: 'bot',
            text: `📇 **குடும்ப அட்டை வகை மாற்றம் (Change Card Type)**\n\n` +
                  `சர்க்கரை அட்டை (Sugar Card) ➡️ அரிசி அட்டை (Rice Card) அல்லது பண்டமில்லா அட்டை ➡️ பண்டம் உள்ள அட்டையாக மாற்றலாம்.\n\n` +
                  `நீங்கள் எந்த வகை அட்டைக்கு மாற்ற விரும்புகிறீர்கள்?`,
            options: [
                { label: "🌾 அரிசி அட்டை (Rice Card - PHH/NPHH)", value: "CARD_TYPE_RICE" },
                { label: "🍬 சர்க்கரை அட்டை (Sugar Card - NPHHS)", value: "CARD_TYPE_SUGAR" },
                { label: "🚫 பண்டமில்லா அட்டை (No Commodity - NC)", value: "CARD_TYPE_NO_COMMODITY" },
                { label: "🔙 ரேஷன் கார்டு சேவைகள்", value: "ரேஷன் கார்டு" }
            ]
        });
        return true;
    } else if (text.includes('கைபேசி') || text === 'கைபேசி எண் மாற்றம்' || text.startsWith('7.') || (isAlreadyInRationMenu && text === '7')) {
        sess.intakeState = 'RATION_CHANGE_MOBILE';
        sess.subService = 'UPDATE_MOBILE';
        sess.chatHistory.push({
            sender: 'bot',
            text: `📱 **கைபேசி எண் மாற்றம் / பதிவு (Update Registered Mobile Number)**\n\n` +
                  `ரேஷன் கார்டில் பதிவு செய்யப்பட்டுள்ள பழைய எண்ணை மாற்றி புதிய மொபைல் எண்ணைப் பதிவு செய்யலாம்.\n\n` +
                  `குடும்பத் தலைவரின் **ஆதார் அட்டையைப்** பதிவேற்றவும் (அல்லது புதிய மொபைல் எண்ணைத் தட்டச்சு செய்யவும்):`,
            options: [
                { label: "📷 தலைவர் ஆதார் அட்டை", value: "TRIGGER_FILE_UPLOAD" },
                { label: "🔙 ரேஷன் கார்டு சேவைகள்", value: "ரேஷன் கார்டு" }
            ]
        });
        return true;
    } else if (text.includes('எரிவாயு') || text === 'எரிவாயு விவரங்கள் திருத்தம்' || text.startsWith('8.') || (isAlreadyInRationMenu && text === '8')) {
        sess.intakeState = 'RATION_LPG_UPDATE';
        sess.subService = 'LPG_UPDATE';
        sess.chatHistory.push({
            sender: 'bot',
            text: `⛽ **எரிவாயு (LPG) சிலிண்டர் விவரங்கள் திருத்தம் (LPG Details Update)**\n\n` +
                  `குடும்ப அட்டையில் உள்ள சிலிண்டர் எண்ணிக்கை (0, 1, 2) அல்லது எரிவாயு நிறுவன இணைப்பு விவரங்களைப் பதிவு/திருத்தம் செய்யலாம்.\n\n` +
                  `வீட்டில் உள்ள சிலிண்டர் எண்ணிக்கை எத்தனை?`,
            options: [
                { label: "0️⃣ சிலிண்டர் இல்லை (No Cylinder)", value: "LPG_CYL_0" },
                { label: "1️⃣ ஒரு சிலிண்டர் (Single Cylinder)", value: "LPG_CYL_1" },
                { label: "2️⃣ இரண்டு சிலிண்டர்கள் (Double Cylinders)", value: "LPG_CYL_2" },
                { label: "🔙 ரேஷன் கார்டு சேவைகள்", value: "ரேஷன் கார்டு" }
            ]
        });
        return true;
    } else if (text.includes('வருமான') || text.toLowerCase().includes('income')) {
        sess.intakeState = 'INCOME_INTAKE';
        const members = sess.citizenProfile?.members || [];
        const hasFamily = members.length > 1;
        let welcomeText = `📜 **வருமானச் சான்றிதழ் (Income Certificate) விண்ணப்பத்திற்கு வரவேற்கிறோம்!**\n\n`;
        let options = [];
        if (hasFamily) {
            welcomeText += `இந்த குடும்பத்தில் **யாருக்கு வருமானச் சான்றிதழ்** தேவைப்படுகிறது? கீழே உள்ள நபரைத் தேர்ந்தெடுக்கவும் (அல்லது குடும்ப ஆண்டு வருமானத்தைத் தட்டச்சு செய்யவும்):`;
            options = members.map((m, idx) => ({
                label: `👤 ${m.nameTam || m.nameEng} (${m.relationshipTam || (idx === 0 ? 'தலைவர்' : 'உறுப்பினர்')})`,
                value: `SELECT_MEMBER_${idx}`
            }));
            options.push({ label: "₹72,000", value: "₹72,000" });
            options.push({ label: "₹1,00,000", value: "₹1,00,000" });
        } else {
            welcomeText += `விண்ணப்பதாரரின் **ஆதார் அட்டை படம்** அல்லது PDF-ஐப் பதிவேற்றவும் (அல்லது குடும்ப ஆண்டு வருமானத்தைத் தேர்ந்தெடுக்கவும்):`;
            options = [
                { label: "📷 ஆதார் அட்டை அப்லோட்", value: "TRIGGER_FILE_UPLOAD" },
                { label: "₹60,000க்கு கீழ்", value: "₹60,000" },
                { label: "₹72,000", value: "₹72,000" },
                { label: "₹1,00,000", value: "₹1,00,000" },
                { label: "₹1,20,000", value: "₹1,20,000" }
            ];
        }
        sess.chatHistory.push({
            sender: 'bot',
            text: welcomeText,
            options
        });
        return true;
    } else if (text.includes('இருப்பிட') || text.toLowerCase().includes('residence')) {
        sess.intakeState = 'RESIDENCE_INTAKE';
        const members = sess.citizenProfile?.members || [];
        const hasFamily = members.length > 1;
        let welcomeText = `🏠 **இருப்பிடச் சான்றிதழ் (Residence Certificate) விண்ணப்பத்திற்கு வரவேற்கிறோம்!**\n\n`;
        let options = [];
        if (hasFamily) {
            welcomeText += `இந்த குடும்பத்தில் **யாருக்கு இருப்பிடச் சான்றிதழ்** தேவைப்படுகிறது? கீழே உள்ள நபரைத் தேர்ந்தெடுக்கவும்:`;
            options = members.map((m, idx) => ({
                label: `👤 ${m.nameTam || m.nameEng} (${m.relationshipTam || (idx === 0 ? 'தலைவர்' : 'உறுப்பினர்')})`,
                value: `SELECT_MEMBER_${idx}`
            }));
            options.push({ label: "📷 ஆதார் அட்டை பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" });
        } else {
            welcomeText += `விண்ணப்பதாரரின் ஆதார் அட்டை அல்லது முகவரிச் சான்றைப் பதிவேற்றவும்:`;
            options = [
                { label: "📷 ஆதார் அட்டை பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" }
            ];
        }
        sess.chatHistory.push({
            sender: 'bot',
            text: welcomeText,
            options
        });
        return true;
    } else if (text.includes('வாக்காளர்') || text.toLowerCase().includes('voter')) {
        sess.intakeState = 'VOTER_INTAKE';
        sess.chatHistory.push({
            sender: 'bot',
            text: `🗳️ **புதிய வாக்காளர் அட்டை (New Voter ID) விண்ணப்பத்திற்கு வரவேற்கிறோம்!**\n\n` +
                  `விண்ணப்பதாரரின் ஆதார் அட்டை அல்லது பிறப்புச் சான்றிதழைப் பதிவேற்றவும்:`,
            options: [
                { label: "📷 ஆதார் அட்டை பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" }
            ]
        });
        return true;
    } else if (text === 'CONTINUE_INTAKE' || text === 'CONFIRM_SUBMIT' || text === 'TRIGGER_EDIT_MODAL' || text === 'CHANGE_HEAD_PHOTO') {
        return false;
    } else if (text) {
        sess.chatHistory.push({
            sender: 'bot',
            text: `ℹ️ **${text} சேவை விரைவில் முழுமையாக இணைக்கப்படவுள்ளது!**\n\nதற்போது **புதிய ரேஷன் கார்டு (New Ration Card)** விண்ணப்பம் 100% நேரலையில் பயன்பாட்டில் உள்ளது. அதைத் தொடங்க விரும்புகிறீர்களா?`,
            options: [
                { label: "🏛️ புதிய ரேஷன் கார்டு தொடங்கவும்", value: "புதிய ரேஷன் கார்டு" },
                { label: "🔄 மீண்டும் சேவைகளைத் தேர்ந்தெடு", value: "reset" }
            ]
        });
        return true;
    }
    return false;
}

function renderSubserviceReadySummary(sess) {
    const subService = sess.subService || 'RATION_SERVICE';
    let svcNameTam = 'குடும்ப அட்டை சேவை';
    let detailsList = '';

    if (subService === 'ADD_MEMBER') {
        const isChild = sess.subServiceData?.isChild;
        svcNameTam = isChild ? 'குடும்ப உறுப்பினர் சேர்க்கை (குழந்தை)' : 'குடும்ப உறுப்பினர் சேர்க்கை (பெரியவர்)';
        const rel = sess.subServiceData?.relationshipTam || 'உறுப்பினர்';
        const name = sess.subServiceData?.memberName || (sess.tempMember && (sess.tempMember.nameTam || sess.tempMember.nameEng)) || 'புதிய உறுப்பினர்';
        const isSonDaughter = sess.subServiceData?.memberCategory === 'SON_DAUGHTER';
        let memberExtra = '';
        if (sess.subServiceData?.aadhaarNo) {
            memberExtra += `• 🪪 **ஆதார் எண்:** ${(sess.subServiceData.aadhaarNo || '').replace(/(\d{4})/g, '$1 ').trim()} ✅\n`;
        }
        if (sess.subServiceData?.dob) {
            memberExtra += `• 📅 **பிறந்த தேதி:** ${sess.subServiceData.dob}\n`;
        }
        detailsList = `• 👶/👤 **சேர்க்கப்படும் நபர்:** ${name} (${rel})\n` +
                      memberExtra +
                      (isChild ? `• 📄 **இணைக்கப்பட்ட ஆவணம்:** ஆதார் அட்டை (Aadhaar Card) ✅\n` 
                               : (isSonDaughter ? `• 📄 **இணைக்கப்பட்ட ஆவணம்:** ஆதார் அட்டை (Aadhaar Card) ✅\n`
                                                : `• 📄 **இணைக்கப்பட்ட ஆவணங்கள்:** ஆதார் அட்டை ✅, நீக்கல்/திருமணச் சான்று ✅\n`));
    } else if (subService === 'REMOVE_MEMBER') {
        svcNameTam = 'குடும்ப உறுப்பினர் நீக்கம்';
        const reason = sess.subServiceData?.reason || 'இறப்பு / திருமணம்';
        const name = sess.subServiceData?.memberName || 'கார்டில் உள்ள உறுப்பினர்';
        detailsList = `• 👤 **நீக்கப்படும் நபர்:** ${name}\n` +
                      `• 📋 **காரணம்:** ${reason}\n` +
                      `• 📄 **ஆவணம்:** சான்றிதழ் சரிபார்க்கப்பட்டது ✅\n`;
    } else if (subService === 'CHANGE_HEAD') {
        svcNameTam = 'குடும்பத் தலைவர் மாற்றம்';
        const reason = sess.subServiceData?.reason || 'குடும்ப விருப்பம்';
        detailsList = `• 👤 **புதிய குடும்பத் தலைவர்:** சரிபார்க்கப்பட்ட உறுப்பினர்\n` +
                      `• 📋 **காரணம்:** ${reason}\n` +
                      `• 📄 **ஆவணம்:** புதிய தலைவர் ஆதார் அட்டை ✅\n`;
    } else if (subService === 'CHANGE_ADDRESS') {
        svcNameTam = 'முகவரி மாற்றம்';
        const proof = sess.subServiceData?.proofType || 'மின் கட்டண ரசீது (EB Bill)';
        detailsList = `• 🏠 **சேவை:** புதிய முகவரி மாற்றம்\n` +
                      `• 📄 **முகவரிச் சான்று:** ${proof} ✅\n`;
    } else if (subService === 'CHANGE_CARD_TYPE') {
        svcNameTam = 'குடும்ப அட்டை வகை மாற்றம்';
        const cardType = sess.subServiceData?.cardType || 'அரிசி அட்டை (Rice Card)';
        detailsList = `• 📇 **புதிய அட்டை வகை:** ${cardType}\n` +
                      `• 📄 **சுய உறுதிமொழி:** பெறப்பட்டது ✅\n`;
    } else if (subService === 'UPDATE_MOBILE') {
        svcNameTam = 'கைபேசி எண் மாற்றம் / பதிவு';
        const newMob = sess.subServiceData?.newMobile || 'பதிவு செய்யப்பட்ட எண்';
        detailsList = `• 📱 **புதிய கைபேசி எண்:** ${newMob}\n` +
                      `• 📄 **சான்று:** தலைவரின் ஆதார் சரிபார்க்கப்பட்டது ✅\n`;
    } else if (subService === 'LPG_UPDATE') {
        svcNameTam = 'எரிவாயு (LPG) விவரங்கள் திருத்தம்';
        const cyl = sess.subServiceData?.cylinders || '1 சிலிண்டர்';
        detailsList = `• ⛽ **சிலிண்டர் எண்ணிக்கை:** ${cyl}\n` +
                      `• 📄 **சான்று:** எரிவாயு நுகர்வோர் அட்டை (Gas Book) ✅\n`;
    }

    return {
        sender: 'bot',
        text: `🎉 **${svcNameTam} விண்ணப்பம் தயார்! (Application Ready)** 🎯\n\n` +
              `• 🏛️ **அரசு சேவை:** ${svcNameTam}\n` +
              detailsList +
              `• 📱 **அங்கீகரிப்பு முறை:** குடும்ப அட்டை பதிவு மொபைல் எண் OTP மூலம்.\n\n` +
              `இப்போது TNPDS போர்ட்டலில் உள்நுழைந்து நேரடியாக விண்ணப்பிக்கலாம்:`,
        options: [
            { label: "📱 நேரலை TNPDS சமர்ப்பி (Real Govt OTP)", value: "REAL_LIVE_OTP" },
            { label: "🚀 TNPDS போர்ட்டலில் விண்ணப்பி (Submit to Portal)", value: "CONFIRM_SUBMIT" },
            { label: "✏️ விவரங்களைச் சரிபார் / திருத்து (Review Details)", value: "TRIGGER_EDIT_MODAL" },
            { label: "🔙 ரேஷன் கார்டு சேவைகள்", value: "ரேஷன் கார்டு" }
        ]
    };
}

async function handleRationSubserviceWorkflow(text, sess, uploadedDoc = null, extractedDoc = null) {
    if (!sess) return false;
    const currentState = sess.intakeState;

    if (text === 'RATION_ADD_MEMBER_RESET' || text.includes('புதிய ஆவணம் மாற்று')) {
        sess.subService = 'ADD_MEMBER';
        sess.subServiceData = {};
        sess.intakeState = 'RATION_ADD_MEMBER_TYPE';
        sess.chatHistory.push({
            sender: 'bot',
            text: `➕ **புதிய உறுப்பினர் சேர்க்கை (Add Member - புதுப்பித்தல்)**\n\n` +
                  `🪪 சேர்க்கப்பட வேண்டிய புதிய உறுப்பினரின் **ஆதார் அட்டையைப்** பதிவேற்றவும் (அல்லது புகைப்படம் எடுக்கவும்):`,
            actionRequired: 'upload',
            uploadPrompt: 'உறுப்பினர் ஆதார் அட்டை',
            options: [
                { label: "📷 ஆதார் அட்டை பதிவேற்றவும்", value: "TRIGGER_FILE_UPLOAD" },
                { label: "🔙 ரேஷன் கார்டு சேவைகள்", value: "ரேஷன் கார்டு" }
            ]
        });
        return true;
    }

    if (text === 'RATION_CHANGE_ADDRESS_RESET' || text.includes('முகவரியை மாற்று')) {
        sess.subService = 'CHANGE_ADDRESS';
        sess.subServiceData = {};
        sess.intakeState = 'RATION_CHANGE_ADDRESS_DOC';
        sess.chatHistory.push({
            sender: 'bot',
            text: `📍 **முகவரி மாற்றம் (Change Address - புதுப்பித்தல்)**\n\n` +
                  `📋 **புதிய முகவரிக்கான சான்றாக எந்த ஆவணத்தைப் பதிவேற்ற விரும்புகிறீர்கள்?**`,
            options: [
                { label: "⚡ மின் கட்டண ரசீது (EB Bill)", value: "ADDR_PROOF_EB" },
                { label: "⛽ எரிவாயு நுகர்வோர் அட்டை (Gas Bill)", value: "ADDR_PROOF_GAS" },
                { label: "📄 வாடகை ஒப்பந்தம் (Rental Agreement)", value: "ADDR_PROOF_RENT" },
                { label: "🏛️ சொத்து வரி ரசீது (Property Tax)", value: "ADDR_PROOF_TAX" },
                { label: "🪪 புதிய முகவரி ஆதார் அட்டை (Aadhaar)", value: "ADDR_PROOF_AADHAAR" },
                { label: "🔙 ரேஷன் கார்டு சேவைகள்", value: "ரேஷன் கார்டு" }
            ]
        });
        return true;
    }

    // Subservice 2: Add Member specific type triggers
    if (text === 'ADD_MEMBER_CHILD') {
        sess.subService = 'ADD_MEMBER';
        sess.intakeState = 'RATION_ADD_MEMBER_CHILD_DOC';
        sess.subServiceData = { isChild: true, docType: 'Aadhaar Card' };
        sess.chatHistory.push({
            sender: 'bot',
            text: `👶 **குழந்தை சேர்க்கை (Child Member)**\n\n` +
                  `தமிழ்நாடு அரசு TNPDS விதிகளின்படி அனைத்து உறுப்பினர்களுக்கும் **ஆதார் அட்டை (Aadhaar Card)** கட்டாயமாக்கப்பட்டுள்ளது.\n\n` +
                  `🪪 குழந்தையின் **ஆதார் அட்டையைப்** பதிவேற்றவும் (அல்லது புகைப்படம் எடுக்கவும்):`,
            actionRequired: 'upload',
            uploadPrompt: 'குழந்தை ஆதார் அட்டை',
            options: [
                { label: "✅ ஆதார் உள்ளது - தொடரவும்", value: "BIRTH_DOC_CONFIRMED" },
                { label: "🔙 பின்செல்ல", value: "குடும்ப உறுப்பினர் சேர்க்க" }
            ]
        });
        return true;
    } else if (text === 'ADD_MEMBER_SON_DAUGHTER') {
        sess.subService = 'ADD_MEMBER';
        sess.intakeState = 'RATION_ADD_MEMBER_SON_AADHAAR';
        sess.subServiceData = { isChild: false, memberCategory: 'SON_DAUGHTER', docType: 'Aadhaar Card' };
        sess.chatHistory.push({
            sender: 'bot',
            text: `👦 **மகன் / மகள் சேர்க்கை (5 வயதுக்கு மேற்பட்டவர்)**\n\n` +
                  `5 வயதுக்கு மேற்பட்ட திருமணமாகாத மகன்/மகளுக்கு **ஆதார் அட்டை (Aadhaar Card)** மட்டுமே போதுமானது.\n(வேறு குடும்ப அட்டையில் பெயர் இல்லாததால் பெயர் நீக்கல் சான்றிதழ் தேவையில்லை).\n\n` +
                  `🪪 மகன்/மகளின் **ஆதார் அட்டையைப்** பதிவேற்றவும்:`,
            actionRequired: 'upload',
            uploadPrompt: 'மகன்/மகள் ஆதார் அட்டை',
            options: [
                { label: "✅ ஆதார் உள்ளது - தொடரவும்", value: "SON_AADHAAR_CONFIRMED" },
                { label: "🔙 பின்செல்ல", value: "குடும்ப உறுப்பினர் சேர்க்க" }
            ]
        });
        return true;
    } else if (text === 'ADD_MEMBER_ADULT' || text === 'ADD_MEMBER_INLAW' || text === 'ADD_MEMBER_PARENT') {
        sess.subService = 'ADD_MEMBER';
        sess.intakeState = 'RATION_ADD_MEMBER_ADULT_AADHAAR';
        sess.subServiceData = { isChild: false, docType: 'Aadhaar Card' };
        sess.chatHistory.push({
            sender: 'bot',
            text: `👤 **திருமணமான உறுப்பினர் / பெற்றோர் சேர்க்கை**\n\n` +
                  `திருமணமான நபர் அல்லது பெற்றோரைச் சேர்க்க தமிழ்நாடு அரசு விதிகளின்படி **2 ஆவணங்கள்** தேவை:\n` +
                  `1. 🪪 **ஆதார் அட்டை (Aadhaar Card)**\n` +
                  `2. 📋 **பெயர் நீக்கல் சான்றிதழ் (Surrender Certificate)** அல்லது **திருமணப் பத்திரிகை (Marriage Certificate)**.\n\n` +
                  `படி 1/2: சேர்க்கப்பட வேண்டிய நபரின் **ஆதார் அட்டையைப்** பதிவேற்றவும்:`,
            actionRequired: 'upload',
            uploadPrompt: 'உறுப்பினர் ஆதார் அட்டை',
            options: [
                { label: "✅ ஆதார் உள்ளது - தொடரவும்", value: "ADULT_AADHAAR_CONFIRMED" },
                { label: "🔙 பின்செல்ல", value: "குடும்ப உறுப்பினர் சேர்க்க" }
            ]
        });
        return true;
    }

    // Subservice 2: Add Member
    if (currentState === 'RATION_ADD_MEMBER' || currentState === 'RATION_ADD_MEMBER_TYPE') {
        sess.subService = 'ADD_MEMBER';
        // 1. DIRECT AADHAAR CARD UPLOAD HANDLER
        if (uploadedDoc || extractedDoc || text === 'TRIGGER_FILE_UPLOAD') {
            sess.subServiceData = sess.subServiceData || {};
            sess.subServiceData.docType = 'Aadhaar Card';
            sess.subServiceData.docPath = uploadedDoc?.path || sess.subServiceData.docPath || 'uploads/test_sample_doc.jpg';
            sess.tempUploads = sess.tempUploads || {};
            if (uploadedDoc?.path) {
                sess.tempUploads.memberAadhaarFront = uploadedDoc.path;
            }
            
            let isRealExtracted = false;
            if (extractedDoc && (extractedDoc.fullNameTam || extractedDoc.fullNameEng || extractedDoc.aadhaarNumber)) {
                isRealExtracted = true;
                sess.subServiceData.memberNameTam = extractedDoc.fullNameTam || '';
                sess.subServiceData.memberNameEng = extractedDoc.fullNameEng || '';
                sess.subServiceData.memberName = extractedDoc.fullNameTam || extractedDoc.fullNameEng;
                if (extractedDoc.aadhaarNumber) sess.subServiceData.aadhaarNo = extractedDoc.aadhaarNumber;
                if (extractedDoc.dob) sess.subServiceData.dob = extractedDoc.dob;
                if (extractedDoc.gender) {
                    sess.subServiceData.gender = extractedDoc.gender;
                    sess.subServiceData.genderTam = extractedDoc.genderTam || (extractedDoc.gender === 'Female' ? 'பெண்' : 'ஆண்');
                }
                if (extractedDoc.fatherNameTam || extractedDoc.fatherNameEng) {
                    sess.subServiceData.fatherNameTam = extractedDoc.fatherNameTam || '';
                    sess.subServiceData.fatherNameEng = extractedDoc.fatherNameEng || '';
                }
            } else {
                const isBypass = text === 'TRIGGER_FILE_UPLOAD' || text === 'DEMO_BIRTH_CERT' || text === 'BIRTH_DOC_CONFIRMED' || text === 'DEMO_ADULT_AADHAAR' || text === 'SON_AADHAAR_CONFIRMED';
                sess.subServiceData.memberName = (!isBypass ? text : '') || sess.subServiceData.memberName || 'புதிய உறுப்பினர்';
                if (!sess.subServiceData.dob) sess.subServiceData.dob = '15/06/2023';
                if (!sess.subServiceData.aadhaarNo) sess.subServiceData.aadhaarNo = '987654321096';
            }

            if (sess.subServiceData.dob) {
                const parts = sess.subServiceData.dob.split('/');
                if (parts.length === 3) {
                    const birthYear = parseInt(parts[2]);
                    const currYear = new Date().getFullYear();
                    sess.subServiceData.isChild = (currYear - birthYear) < 5;
                }
            }

            const nameDisplay = sess.subServiceData.memberNameTam && sess.subServiceData.memberNameEng
                ? `${sess.subServiceData.memberNameTam} (${sess.subServiceData.memberNameEng})`
                : (sess.subServiceData.memberName || 'உறுப்பினர்');

            const aadhaarDisplay = sess.subServiceData.aadhaarNo
                ? `\n• 🪪 **ஆதார் எண்:** ${(sess.subServiceData.aadhaarNo || '').replace(/(\d{4})/g, '$1 ').trim()}`
                : '';

            const dobDisplay = sess.subServiceData.dob
                ? `\n• 📅 **பிறந்த தேதி:** ${sess.subServiceData.dob}`
                : '';

            const genderDisplay = sess.subServiceData.genderTam
                ? `\n• ⚧ **பாலினம்:** ${sess.subServiceData.genderTam}`
                : '';

            const isPdf = uploadedDoc?.path && uploadedDoc.path.toLowerCase().endsWith('.pdf');
            const hasBothSides = isPdf || (extractedDoc && (extractedDoc.address || extractedDoc.fatherNameEng || extractedDoc.fatherNameTam));

            if (!hasBothSides && uploadedDoc && !isPdf) {
                // Front photo uploaded -> Ask for back side photo for Xerox 2-in-1 merge
                sess.intakeState = 'RATION_ADD_MEMBER_BACK';
                const successPrefix = isRealExtracted ? '✅ **ஆதார் அட்டை முன்பக்கம் AI மூலம் படிக்கப்பட்டது!** 🪪' : '✅ **ஆதார் அட்டை முன்பக்கம் பெறப்பட்டது!** 🪪';
                sess.chatHistory.push({
                    sender: 'bot',
                    text: `${successPrefix}\n\n` +
                          `• 👤 **உறுப்பினர் பெயர்:** ${nameDisplay}${aadhaarDisplay}${dobDisplay}${genderDisplay}\n\n` +
                          `📌 இப்போது ஆதார் அட்டையின் **பின்பக்கத்தை (முகவரி / தந்தை பெயர் உள்ள பகுதி)** பதிவேற்றவும் (அல்லது புகைப்படம் எடுக்கவும்):`,
                    actionRequired: 'upload',
                    uploadPrompt: 'உறுப்பினர் ஆதார் பின்பக்கம்',
                    options: [
                        { label: "📷 பின்பக்கம் பதிவேற்றவும்", value: "TRIGGER_FILE_UPLOAD" },
                        { label: "✅ முழு ஆவணம் முடிந்தது (PDF / ஒற்றைப் பக்கம்)", value: "MEMBER_DOC_COMPLETE" },
                        { label: "🔙 பின்செல்ல", value: "குடும்ப உறுப்பினர் சேர்க்க" }
                    ]
                });
                return true;
            }

            // PDF or full e-Aadhaar -> Go directly to Relationship question
            const successPrefix = isRealExtracted ? '✅ **ஆதார் அட்டை AI மூலம் படிக்கப்பட்டது!** 🪪' : '✅ **ஆதார் அட்டை பெறப்பட்டது!** 🪪';

            sess.intakeState = 'RATION_ADD_MEMBER_RELATION';
            sess.chatHistory.push({
                sender: 'bot',
                text: `${successPrefix}\n\n` +
                      `• 👤 **உறுப்பினர் பெயர்:** ${nameDisplay}${aadhaarDisplay}${dobDisplay}${genderDisplay}\n\n` +
                      `❓ **குடும்பத் தலைவருடன் இவரின் உறவுமுறை என்ன?**\n\n` +
                      `கீழே உள்ள விருப்பத்தைத் தேர்ந்தெடுக்கவும் (அல்லது நேரடியாக தட்டச்சு செய்யவும்):`,
                options: [
                    { label: "👦 மகன் (Son)", value: "மகன்" },
                    { label: "👧 மகள் (Daughter)", value: "மகள்" },
                    { label: "👰 மனைவி (Wife)", value: "மனைவி" },
                    { label: "🤵 கணவர் (Husband)", value: "கணவர்" },
                    { label: "👵 தாய் (Mother)", value: "தாய்" },
                    { label: "👴 தந்தை (Father)", value: "தந்தை" },
                    { label: "👫 மருமகள் (Daughter-in-law)", value: "மருமகள்" },
                    { label: "👫 மருமகன் (Son-in-law)", value: "மருமகன்" },
                    { label: "🔙 பின்செல்ல", value: "குடும்ப உறுப்பினர் சேர்க்க" }
                ]
            });
            return true;
        }

        if (text === 'USE_DEMO_DATA' || text.includes('மாதிரி விவரங்கள்')) {
            sess.subServiceData = {
                isChild: true,
                docType: 'Aadhaar Card',
                docPath: 'uploads/test_sample_doc.jpg',
                memberName: 'கவின் குமார்',
                memberNameEng: 'Kavin Kumar',
                relationshipTam: 'மகன்',
                relationshipEng: 'Son',
                gender: 'Male',
                genderTam: 'ஆண்',
                dob: '15/06/2023',
                aadhaarNo: '987654321096',
                rationCardNo: sess.citizenProfile?.rationCardNo || '332145897210'
            };
            sess.intakeState = 'READY_TO_APPLY';
            sess.step = 'READY';
            sess.chatHistory.push(renderSubserviceReadySummary(sess));
            return true;
        }
    }

    // Subservice 2: Add Member - Back Side Upload & Dual-Sided Auto Merge
    if (currentState === 'RATION_ADD_MEMBER_BACK') {
        sess.subService = 'ADD_MEMBER';
        sess.subServiceData = sess.subServiceData || {};
        sess.tempUploads = sess.tempUploads || {};

        if (text === 'MEMBER_DOC_COMPLETE' || text.includes('முழு ஆவணம் முடிந்தது')) {
            sess.subServiceData.docPath = sess.tempUploads.memberAadhaarFront || sess.subServiceData.docPath || 'uploads/test_sample_doc.jpg';
        } else if (uploadedDoc || extractedDoc || text === 'TRIGGER_FILE_UPLOAD') {
            if (uploadedDoc?.path) {
                sess.tempUploads.memberAadhaarBack = uploadedDoc.path;
            }
            if (photoStudio && photoStudio.produceDualSidedDocument && sess.tempUploads.memberAadhaarFront && sess.tempUploads.memberAadhaarBack) {
                try {
                    const mergedPdf = await photoStudio.produceDualSidedDocument(
                        sess.tempUploads.memberAadhaarFront,
                        sess.tempUploads.memberAadhaarBack
                    );
                    if (mergedPdf) sess.subServiceData.docPath = mergedPdf;
                } catch (e) {
                    sess.subServiceData.docPath = sess.tempUploads.memberAadhaarBack || sess.tempUploads.memberAadhaarFront || uploadedDoc?.path;
                }
            } else {
                sess.subServiceData.docPath = sess.tempUploads.memberAadhaarBack || sess.tempUploads.memberAadhaarFront || uploadedDoc?.path || 'uploads/test_sample_doc.jpg';
            }

            if (extractedDoc) {
                if (extractedDoc.fatherNameTam || extractedDoc.fatherNameEng) {
                    sess.subServiceData.fatherNameTam = extractedDoc.fatherNameTam || '';
                    sess.subServiceData.fatherNameEng = extractedDoc.fatherNameEng || '';
                }
                if (extractedDoc.address || extractedDoc.doorNo || extractedDoc.pincode) {
                    sess.subServiceData.address = extractedDoc.address || `${extractedDoc.doorNo || ''}, ${extractedDoc.streetTam || extractedDoc.streetEng || ''}, ${extractedDoc.pincode || ''}`.trim();
                }
            }
        }

        const nameDisplay = sess.subServiceData.memberNameTam && sess.subServiceData.memberNameEng
            ? `${sess.subServiceData.memberNameTam} (${sess.subServiceData.memberNameEng})`
            : (sess.subServiceData.memberName || 'உறுப்பினர்');

        const aadhaarDisplay = sess.subServiceData.aadhaarNo
            ? `\n• 🪪 **ஆதார் எண்:** ${(sess.subServiceData.aadhaarNo || '').replace(/(\d{4})/g, '$1 ').trim()}`
            : '';

        const dobDisplay = sess.subServiceData.dob
            ? `\n• 📅 **பிறந்த தேதி:** ${sess.subServiceData.dob}`
            : '';

        const genderDisplay = sess.subServiceData.genderTam
            ? `\n• ⚧ **பாலினம்:** ${sess.subServiceData.genderTam}`
            : '';

        sess.intakeState = 'RATION_ADD_MEMBER_RELATION';
        sess.chatHistory.push({
            sender: 'bot',
            text: `✅ **ஆதார் அட்டை (முன்பக்கம் + பின்பக்கம்) 2-in-1 A4 PDF-ஆக இணைக்கப்பட்டது!** 📄\n\n` +
                  `• 👤 **உறுப்பினர் பெயர்:** ${nameDisplay}${aadhaarDisplay}${dobDisplay}${genderDisplay}\n\n` +
                  `❓ **குடும்பத் தலைவருடன் இவரின் உறவுமுறை என்ன?**\n\n` +
                  `கீழே உள்ள விருப்பத்தைத் தேர்ந்தெடுக்கவும் (அல்லது நேரடியாக தட்டச்சு செய்யவும்):`,
            options: [
                { label: "👦 மகன் (Son)", value: "மகன்" },
                { label: "👧 மகள் (Daughter)", value: "மகள்" },
                { label: "👰 மனைவி (Wife)", value: "மனைவி" },
                { label: "🤵 கணவர் (Husband)", value: "கணவர்" },
                { label: "👵 தாய் (Mother)", value: "தாய்" },
                { label: "👴 தந்தை (Father)", value: "தந்தை" },
                { label: "👫 மருமகள் (Daughter-in-law)", value: "மருமகள்" },
                { label: "👫 மருமகன் (Son-in-law)", value: "மருமகன்" },
                { label: "🔙 பின்செல்ல", value: "குடும்ப உறுப்பினர் சேர்க்க" }
            ]
        });
        return true;
    }

    if (currentState === 'RATION_ADD_MEMBER_CHILD_DOC') {
        if (text === 'USE_DEMO_DATA' || text.includes('மாதிரி விவரங்கள்')) {
            sess.subService = 'ADD_MEMBER';
            sess.subServiceData = {
                isChild: true,
                docType: 'Aadhaar Card',
                docPath: 'uploads/test_sample_doc.jpg',
                memberName: 'கவின் குமார்',
                memberNameEng: 'Kavin Kumar',
                relationshipTam: 'மகன்',
                relationshipEng: 'Son',
                gender: 'Male',
                genderTam: 'ஆண்',
                dob: '15/06/2023',
                aadhaarNo: '987654321096',
                rationCardNo: sess.citizenProfile?.rationCardNo || '332145897210'
            };
            sess.intakeState = 'READY_TO_APPLY';
            sess.step = 'READY';
            sess.chatHistory.push(renderSubserviceReadySummary(sess));
            return true;
        }
        sess.intakeState = 'RATION_ADD_MEMBER_CHILD_RELATION';
        sess.subServiceData = sess.subServiceData || {};
        sess.subServiceData.isChild = true;
        sess.subServiceData.docType = 'Aadhaar Card';
        sess.subServiceData.docPath = uploadedDoc?.path || sess.subServiceData.docPath || 'uploads/test_sample_doc.jpg';
        const isBypass = text === 'TRIGGER_FILE_UPLOAD' || text === 'DEMO_BIRTH_CERT' || text === 'BIRTH_DOC_CONFIRMED' || text === 'DEMO_ADULT_AADHAAR' || text === 'CHILD_AADHAAR_CONFIRMED';
        
        let isRealExtracted = false;
        if (extractedDoc && (extractedDoc.fullNameTam || extractedDoc.fullNameEng)) {
            isRealExtracted = true;
            sess.subServiceData.memberNameTam = extractedDoc.fullNameTam || '';
            sess.subServiceData.memberNameEng = extractedDoc.fullNameEng || '';
            sess.subServiceData.memberName = extractedDoc.fullNameTam || extractedDoc.fullNameEng;
            if (extractedDoc.dob) sess.subServiceData.dob = extractedDoc.dob;
            if (extractedDoc.aadhaarNumber || extractedDoc.aadhaarNo) {
                sess.subServiceData.aadhaarNo = extractedDoc.aadhaarNumber || extractedDoc.aadhaarNo;
            }
        } else {
            const childName = sess.tempMember?.nameTam || sess.tempMember?.nameEng || (!isBypass ? text : '') || sess.subServiceData.memberName || 'கவின் குமார்';
            sess.subServiceData.memberName = childName;
            if (!sess.subServiceData.dob) sess.subServiceData.dob = '15/06/2023';
            if (!sess.subServiceData.aadhaarNo) sess.subServiceData.aadhaarNo = '987654321096';
        }

        const successPrefix = isRealExtracted ? '✅ **குழந்தையின் ஆதார் அட்டை AI மூலம் படிக்கப்பட்டது!** 🪪' : '✅ **குழந்தையின் ஆதார் அட்டை பெறப்பட்டது!** 🪪';

        sess.chatHistory.push({
            sender: 'bot',
            text: `${successPrefix}\n\n` +
                  `• 👶 **குழந்தையின் பெயர்:** ${sess.subServiceData.memberName}\n\n` +
                  `குடும்பத் தலைவருடன் குழந்தையின் உறவுமுறை என்ன?\n\n` +
                  `கீழே உள்ள விருப்பத்தைத் தேர்வு செய்யவும்:`,
            options: [
                { label: "👦 மகன் (Son)", value: "CHILD_SON" },
                { label: "👧 மகள் (Daughter)", value: "CHILD_DAUGHTER" },
                { label: "🔙 பின்செல்ல", value: "ADD_MEMBER_CHILD" }
            ]
        });
        return true;
    }

    if (currentState === 'RATION_ADD_MEMBER_RELATION') {
        const raw = (text || '').toLowerCase().trim();
        let relTam = text ? text.trim() : 'மகன்';
        let relEng = 'Member';
        let gen = sess.subServiceData?.gender || 'Male';
        let genTam = sess.subServiceData?.genderTam || 'ஆண்';

        if (raw.includes('மகள்') || raw.includes('daughter') || raw === 'child_daughter' || raw === 'rel_daughter') {
            relTam = 'மகள்'; relEng = 'Daughter'; gen = 'Female'; genTam = 'பெண்';
        } else if (raw.includes('மகன்') || raw.includes('son') || raw === 'child_son' || raw === 'rel_son') {
            relTam = 'மகன்'; relEng = 'Son'; gen = 'Male'; genTam = 'ஆண்';
        } else if (raw.includes('மனைவி') || raw.includes('wife')) {
            relTam = 'மனைவி'; relEng = 'Wife'; gen = 'Female'; genTam = 'பெண்';
        } else if (raw.includes('கணவர்') || raw.includes('husband')) {
            relTam = 'கணவர்'; relEng = 'Husband'; gen = 'Male'; genTam = 'ஆண்';
        } else if (raw.includes('தாய்') || raw.includes('அம்மா') || raw.includes('mother')) {
            relTam = 'தாய்'; relEng = 'Mother'; gen = 'Female'; genTam = 'பெண்';
        } else if (raw.includes('தந்தை') || raw.includes('அப்பா') || raw.includes('father')) {
            relTam = 'தந்தை'; relEng = 'Father'; gen = 'Male'; genTam = 'ஆண்';
        } else if (raw.includes('மருமகள்') || raw.includes('daughter-in-law')) {
            relTam = 'மருமகள்'; relEng = 'Daughter-in-law'; gen = 'Female'; genTam = 'பெண்';
        } else if (raw.includes('மருமகன்') || raw.includes('son-in-law')) {
            relTam = 'மருமகன்'; relEng = 'Son-in-law'; gen = 'Male'; genTam = 'ஆண்';
        }

        sess.subServiceData = sess.subServiceData || {};
        sess.subServiceData.relationshipTam = relTam;
        sess.subServiceData.relationshipEng = relEng;
        if (!sess.subServiceData.gender) {
            sess.subServiceData.gender = gen;
            sess.subServiceData.genderTam = genTam;
        }

        if (sess.subServiceData.dob) {
            const parts = sess.subServiceData.dob.split('/');
            if (parts.length === 3) {
                const birthYear = parseInt(parts[2]);
                const currYear = new Date().getFullYear();
                sess.subServiceData.isChild = (currYear - birthYear) < 5;
            }
        }

        sess.intakeState = 'READY_TO_APPLY';
        sess.step = 'READY';
        sess.chatHistory.push(renderSubserviceReadySummary(sess));
        return true;
    }

    if (currentState === 'RATION_ADD_MEMBER_CHILD_RELATION') {
        const isSon = text === 'CHILD_SON' || text.includes('மகன்');
        const isDaughter = text === 'CHILD_DAUGHTER' || text.includes('மகள்');
        sess.subServiceData = sess.subServiceData || {};
        sess.subServiceData.isChild = true;
        sess.subServiceData.relationshipTam = isSon ? 'மகன்' : (isDaughter ? 'மகள்' : text);
        sess.subServiceData.relationshipEng = isSon ? 'Son' : (isDaughter ? 'Daughter' : 'Child');
        sess.intakeState = 'READY_TO_APPLY';
        sess.step = 'READY';
        sess.chatHistory.push(renderSubserviceReadySummary(sess));
        return true;
    }

    // Adult Son / Daughter (> 5 yrs) — Aadhaar Only Flow
    if (currentState === 'RATION_ADD_MEMBER_SON_AADHAAR') {
        if (text === 'USE_DEMO_DATA' || text.includes('மாதிரி விவரங்கள்')) {
            sess.subService = 'ADD_MEMBER';
            sess.subServiceData = {
                isChild: false,
                memberCategory: 'SON_DAUGHTER',
                docType: 'Aadhaar Card',
                docPath: 'uploads/test_sample_doc.jpg',
                memberName: 'கார்த்திக்',
                memberNameEng: 'Karthik',
                relationshipTam: 'மகன்',
                relationshipEng: 'Son',
                gender: 'Male',
                genderTam: 'ஆண்',
                dob: '10/05/2012',
                aadhaarNo: '987654321098',
                rationCardNo: sess.citizenProfile?.rationCardNo || '332145897210'
            };
            sess.intakeState = 'READY_TO_APPLY';
            sess.step = 'READY';
            sess.chatHistory.push(renderSubserviceReadySummary(sess));
            return true;
        }
        sess.intakeState = 'RATION_ADD_MEMBER_SON_RELATION';
        sess.subServiceData = sess.subServiceData || {};
        sess.subServiceData.isChild = false;
        sess.subServiceData.memberCategory = 'SON_DAUGHTER';
        sess.subServiceData.docType = 'Aadhaar Card';
        sess.subServiceData.docPath = uploadedDoc?.path || sess.subServiceData.docPath || 'uploads/test_sample_doc.jpg';
        const isBypass = text === 'TRIGGER_FILE_UPLOAD' || text === 'DEMO_ADULT_AADHAAR' || text === 'SON_AADHAAR_CONFIRMED';
        
        let isRealExtracted = false;
        if (extractedDoc && (extractedDoc.fullNameTam || extractedDoc.fullNameEng || extractedDoc.aadhaarNumber)) {
            isRealExtracted = true;
            sess.subServiceData.memberNameTam = extractedDoc.fullNameTam || '';
            sess.subServiceData.memberNameEng = extractedDoc.fullNameEng || '';
            sess.subServiceData.memberName = extractedDoc.fullNameTam || extractedDoc.fullNameEng;
            if (extractedDoc.aadhaarNumber) sess.subServiceData.aadhaarNo = extractedDoc.aadhaarNumber;
            if (extractedDoc.dob) sess.subServiceData.dob = extractedDoc.dob;
            if (extractedDoc.gender) {
                sess.subServiceData.gender = extractedDoc.gender;
                sess.subServiceData.genderTam = extractedDoc.genderTam || (extractedDoc.gender === 'Female' ? 'பெண்' : 'ஆண்');
            }
        } else {
            const memName = sess.tempMember?.nameTam || sess.tempMember?.nameEng || (!isBypass ? text : '') || sess.subServiceData.memberName || 'கார்த்திக்';
            sess.subServiceData.memberName = memName;
            if (text === 'DEMO_ADULT_AADHAAR') {
                sess.subServiceData.memberName = 'கார்த்திக்';
                sess.subServiceData.memberNameEng = 'Karthik';
                sess.subServiceData.aadhaarNo = '987654321098';
                sess.subServiceData.dob = '10/05/2012';
                sess.subServiceData.gender = 'Male';
                sess.subServiceData.genderTam = 'ஆண்';
            }
        }

        const nameDisplay = sess.subServiceData.memberNameTam && sess.subServiceData.memberNameEng
            ? `${sess.subServiceData.memberNameTam} (${sess.subServiceData.memberNameEng})`
            : (sess.subServiceData.memberName || 'உறுப்பினர்');

        const aadhaarDisplay = sess.subServiceData.aadhaarNo
            ? `\n• 🪪 **ஆதார் எண்:** ${(sess.subServiceData.aadhaarNo || '').replace(/(\d{4})/g, '$1 ').trim()}`
            : '';

        const dobDisplay = sess.subServiceData.dob
            ? `\n• 📅 **பிறந்த தேதி:** ${sess.subServiceData.dob}`
            : '';

        const successPrefix = isRealExtracted ? '✅ **ஆதார் அட்டை AI மூலம் படிக்கப்பட்டது!** 🪪' : '✅ **ஆதார் அட்டை பெறப்பட்டது!** 🪪';

        sess.chatHistory.push({
            sender: 'bot',
            text: `${successPrefix}\n\n` +
                  `• 👤 **உறுப்பினர் பெயர்:** ${nameDisplay}${aadhaarDisplay}${dobDisplay}\n\n` +
                  `குடும்பத் தலைவருடன் இவரின் உறவுமுறை என்ன?\n\n` +
                  `கீழே உள்ள விருப்பத்தைத் தேர்வு செய்யவும்:`,
            options: [
                { label: "👦 மகன் (Son)", value: "REL_SON" },
                { label: "👧 மகள் (Daughter)", value: "REL_DAUGHTER" },
                { label: "🔙 பின்செல்ல", value: "ADD_MEMBER_SON_DAUGHTER" }
            ]
        });
        return true;
    }

    if (currentState === 'RATION_ADD_MEMBER_SON_RELATION') {
        const isDaughter = text === 'REL_DAUGHTER' || text.includes('மகள்');
        sess.subServiceData = sess.subServiceData || {};
        sess.subServiceData.isChild = false;
        sess.subServiceData.memberCategory = 'SON_DAUGHTER';
        sess.subServiceData.relationshipTam = isDaughter ? 'மகள்' : 'மகன்';
        sess.subServiceData.relationshipEng = isDaughter ? 'Daughter' : 'Son';
        sess.subServiceData.gender = isDaughter ? 'Female' : 'Male';
        sess.subServiceData.genderTam = isDaughter ? 'பெண்' : 'ஆண்';
        sess.intakeState = 'READY_TO_APPLY';
        sess.step = 'READY';
        sess.chatHistory.push(renderSubserviceReadySummary(sess));
        return true;
    }

    if (currentState === 'RATION_ADD_MEMBER_ADULT_AADHAAR') {
        sess.intakeState = 'RATION_ADD_MEMBER_ADULT_SURRENDER';
        sess.subServiceData = sess.subServiceData || {};
        sess.subServiceData.isChild = false;
        sess.subServiceData.docType = 'Aadhaar Card';
        sess.subServiceData.docPath = uploadedDoc?.path || sess.subServiceData.docPath || 'uploads/kumaran_aadhaar_card.jpeg';
        const isBypass = text === 'TRIGGER_FILE_UPLOAD' || text === 'DEMO_ADULT_AADHAAR' || text === 'ADULT_AADHAAR_CONFIRMED';
        
        let isRealExtracted = false;
        if (extractedDoc && (extractedDoc.fullNameTam || extractedDoc.fullNameEng || extractedDoc.aadhaarNumber)) {
            isRealExtracted = true;
            sess.subServiceData.memberNameTam = extractedDoc.fullNameTam || '';
            sess.subServiceData.memberNameEng = extractedDoc.fullNameEng || '';
            sess.subServiceData.memberName = extractedDoc.fullNameTam || extractedDoc.fullNameEng;
            if (extractedDoc.aadhaarNumber) sess.subServiceData.aadhaarNo = extractedDoc.aadhaarNumber;
            if (extractedDoc.dob) sess.subServiceData.dob = extractedDoc.dob;
            if (extractedDoc.gender) {
                sess.subServiceData.gender = extractedDoc.gender;
                sess.subServiceData.genderTam = extractedDoc.genderTam || (extractedDoc.gender === 'Female' ? 'பெண்' : 'ஆண்');
            }
        } else {
            const memName = sess.tempMember?.nameTam || sess.tempMember?.nameEng || (!isBypass ? text : '') || sess.subServiceData.memberName || 'பிரியா';
            sess.subServiceData.memberName = memName;
            if (text === 'DEMO_ADULT_AADHAAR') {
                sess.subServiceData.memberName = 'பிரியா';
                sess.subServiceData.memberNameEng = 'Priya';
                sess.subServiceData.aadhaarNo = '987654321099';
                sess.subServiceData.dob = '10/05/1995';
                sess.subServiceData.gender = 'Female';
                sess.subServiceData.genderTam = 'பெண்';
            }
        }

        const nameDisplay = sess.subServiceData.memberNameTam && sess.subServiceData.memberNameEng
            ? `${sess.subServiceData.memberNameTam} (${sess.subServiceData.memberNameEng})`
            : (sess.subServiceData.memberName || 'உறுப்பினர்');

        const aadhaarDisplay = sess.subServiceData.aadhaarNo
            ? `\n• 🪪 **ஆதார் எண்:** ${(sess.subServiceData.aadhaarNo || '').replace(/(\d{4})/g, '$1 ').trim()}`
            : '';

        const dobDisplay = sess.subServiceData.dob
            ? `\n• 📅 **பிறந்த தேதி:** ${sess.subServiceData.dob}`
            : '';

        const successPrefix = isRealExtracted ? '✅ **உறுப்பினரின் ஆதார் அட்டை AI மூலம் படிக்கப்பட்டது!** 🪪' : '✅ **உறுப்பினரின் ஆதார் அட்டை பெறப்பட்டது!** 🪪';

        sess.chatHistory.push({
            sender: 'bot',
            text: `${successPrefix}\n\n` +
                  `• 👤 **உறுப்பினர் பெயர்:** ${nameDisplay}${aadhaarDisplay}${dobDisplay}\n\n` +
                  `📋 **படி 2/2: அடுத்த கட்ட ஆவணம்:**\n` +
                  `முந்தைய குடும்ப அட்டையிலிருந்து பெயர் நீக்கப்பட்ட சான்றிதழ் (Surrender Certificate) அல்லது திருமணப் பத்திரிகையைப் பதிவேற்றவும்:`,
            actionRequired: 'upload',
            uploadPrompt: 'நீக்கல் சான்று / திருமணப் பத்திரிகை',
            options: [
                { label: "🧪 மாதிரி சான்றிதழ் (Demo Surrender)", value: "DEMO_SURRENDER_DOC" },
                { label: "✅ ஆவணம் உள்ளது - தொடரவும்", value: "SURRENDER_DOC_CONFIRMED" },
                { label: "🔙 பின்செல்ல", value: "ADD_MEMBER_ADULT" }
            ]
        });
        return true;
    }

    if (currentState === 'RATION_ADD_MEMBER_ADULT_SURRENDER') {
        sess.intakeState = 'RATION_ADD_MEMBER_ADULT_RELATION';
        sess.subServiceData = sess.subServiceData || {};
        sess.subServiceData.surrenderDocPath = uploadedDoc?.path || sess.subServiceData.surrenderDocPath || 'uploads/priya_sister_aadhaar.pdf';
        sess.chatHistory.push({
            sender: 'bot',
            text: `✅ **நீக்கல் / திருமணச் சான்று உறுதி செய்யப்பட்டது!** 📋\n\n` +
                  `குடும்பத் தலைவருடன் இந்த உறுப்பினரின் உறவுமுறை என்ன?\n\n` +
                  `கீழே உள்ள விருப்பங்களில் ஒன்றைத் தேர்ந்தெடுக்கவும்:`,
            options: RELATIONSHIP_OPTIONS
        });
        return true;
    }

    if (currentState === 'RATION_ADD_MEMBER_ADULT_RELATION') {
        const rel = mapRelationshipToEng(text);
        sess.subServiceData = sess.subServiceData || {};
        sess.subServiceData.relationshipTam = rel.tam;
        sess.subServiceData.relationshipEng = rel.eng;
        sess.subServiceData.gender = rel.gender;
        sess.subServiceData.genderTam = rel.genderTam;
        sess.intakeState = 'READY_TO_APPLY';
        sess.step = 'READY';
        sess.chatHistory.push(renderSubserviceReadySummary(sess));
        return true;
    }

    // Subservice 3: Remove Member
    if (currentState === 'RATION_REMOVE_MEMBER' || currentState === 'RATION_REMOVE_MEMBER_REASON') {
        sess.subService = 'REMOVE_MEMBER';
        let reason = 'காரணம் குறிப்பிடப்படவில்லை';
        if (text === 'REMOVE_REASON_DEATH' || text.includes('இறப்பு')) reason = 'இறப்பு (Death of Member)';
        else if (text === 'REMOVE_REASON_MARRIAGE' || text.includes('திருமணம்')) reason = 'திருமணம் (Marriage)';
        else if (text === 'REMOVE_REASON_SPLIT' || text.includes('பிரிப்பு')) reason = 'தனி அட்டை பிரிப்பு (Separate Card)';

        sess.subServiceData = { ...(sess.subServiceData || {}), reason };
        sess.intakeState = 'RATION_REMOVE_MEMBER_DOC';
        sess.chatHistory.push({
            sender: 'bot',
            text: `➖ **${reason} காரணமாக உறுப்பினர் நீக்கம்**\n\n` +
                  `நீக்கப்பட வேண்டிய நபரின் பெயரைத் தட்டச்சு செய்யவும் மற்றும் தேவையான ஆவணத்தைப் பதிவேற்றவும்:`,
            actionRequired: 'upload',
            uploadPrompt: 'சான்றிதழ் / ஆவணம் பதிவேற்றுக',
            options: [
                { label: "📷 ஆவணம் பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                { label: "✅ ஆவணம் உள்ளது - தொடரவும்", value: "REMOVE_DOC_CONFIRMED" },
                { label: "🔙 ரேஷன் கார்டு சேவைகள்", value: "ரேஷன் கார்டு" }
            ]
        });
        return true;
    }

    if (currentState === 'RATION_REMOVE_MEMBER_DOC') {
        if (text && text !== 'TRIGGER_FILE_UPLOAD' && text !== 'REMOVE_DOC_CONFIRMED') {
            sess.subServiceData = sess.subServiceData || {};
            sess.subServiceData.memberName = text;
        }
        sess.intakeState = 'READY_TO_APPLY';
        sess.step = 'READY';
        sess.chatHistory.push(renderSubserviceReadySummary(sess));
        return true;
    }

    // Subservice 4: Change Head
    if (currentState === 'RATION_CHANGE_HEAD' || currentState === 'RATION_CHANGE_HEAD_REASON') {
        sess.subService = 'CHANGE_HEAD';
        let reason = text.includes('இறப்பு') ? 'முந்தைய தலைவர் இறப்பு' : 'குடும்ப விருப்ப மாற்றம் / முதியவர்';
        sess.subServiceData = { ...(sess.subServiceData || {}), reason };
        sess.intakeState = 'RATION_CHANGE_HEAD_DOC';
        sess.chatHistory.push({
            sender: 'bot',
            text: `👤 **புதிய குடும்பத் தலைவரின் விவரங்கள்**\n\n` +
                  `புதிய தலைவராகப் போகும் நபரின் **ஆதார் அட்டையைப்** பதிவேற்றவும் (அல்லது பெயரைத் தட்டச்சு செய்யவும்):`,
            actionRequired: 'upload',
            uploadPrompt: 'புதிய தலைவர் ஆதார் அட்டை',
            options: [
                { label: "📷 புதிய தலைவர் ஆதார் பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                { label: "✅ ஆதார் தயார் - தொடரவும்", value: "HEAD_DOC_CONFIRMED" },
                { label: "🔙 ரேஷன் கார்டு சேவைகள்", value: "ரேஷன் கார்டு" }
            ]
        });
        return true;
    }

    if (currentState === 'RATION_CHANGE_HEAD_DOC') {
        if (text && text !== 'TRIGGER_FILE_UPLOAD' && text !== 'HEAD_DOC_CONFIRMED') {
            sess.subServiceData = sess.subServiceData || {};
            sess.subServiceData.newHeadName = text;
        }
        sess.intakeState = 'READY_TO_APPLY';
        sess.step = 'READY';
        sess.chatHistory.push(renderSubserviceReadySummary(sess));
        return true;
    }

    // Subservice 5: Change Address
    if (currentState === 'RATION_CHANGE_ADDRESS' || currentState === 'RATION_CHANGE_ADDRESS_DOC') {
        sess.subService = 'CHANGE_ADDRESS';
        let proof = 'மின் கட்டண ரசீது (EB Bill)';
        if (text === 'ADDR_PROOF_GAS' || text.includes('எரிவாயு')) proof = 'எரிவாயு ரசீது (Gas Bill)';
        else if (text === 'ADDR_PROOF_RENT' || text.includes('வாடகை')) proof = 'வாடகை ஒப்பந்தம் (Rental Agreement)';
        else if (text === 'ADDR_PROOF_TAX' || text.includes('வரி')) proof = 'சொத்து வரி ரசீது (Property Tax)';
        else if (text === 'ADDR_PROOF_AADHAAR' || text.includes('ஆதார்')) proof = 'புதிய முகவரி ஆதார் அட்டை';

        sess.subServiceData = { ...(sess.subServiceData || {}), proofType: proof };
        sess.intakeState = 'RATION_CHANGE_ADDRESS_UPLOAD';
        sess.chatHistory.push({
            sender: 'bot',
            text: `📍 **முகவரி மாற்றம் — ${proof}**\n\n` +
                  `தேர்ந்தெடுக்கப்பட்ட முகவரிச் சான்றைப் பதிவேற்றவும் (மற்றும் புதிய முகவரியைத் தட்டச்சு செய்யவும்):`,
            actionRequired: 'upload',
            uploadPrompt: 'முகவரிச் சான்று பதிவேற்றுக',
            options: [
                { label: "📷 சான்று பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                { label: "✅ சான்று தயார் - தொடரவும்", value: "ADDR_DOC_CONFIRMED" },
                { label: "🔙 ரேஷன் கார்டு சேவைகள்", value: "ரேஷன் கார்டு" }
            ]
        });
        return true;
    }

    if (currentState === 'RATION_CHANGE_ADDRESS_UPLOAD') {
        if (text && text !== 'TRIGGER_FILE_UPLOAD' && text !== 'ADDR_DOC_CONFIRMED') {
            sess.subServiceData = sess.subServiceData || {};
            sess.subServiceData.newAddress = text;
        }
        sess.intakeState = 'READY_TO_APPLY';
        sess.step = 'READY';
        sess.chatHistory.push(renderSubserviceReadySummary(sess));
        return true;
    }

    // Subservice 6: Change Card Type
    if (currentState === 'RATION_CHANGE_CARD_TYPE') {
        sess.subService = 'CHANGE_CARD_TYPE';
        let cardType = 'அரிசி அட்டை (Rice Card - PHH/NPHH)';
        if (text === 'CARD_TYPE_SUGAR' || text.includes('சர்க்கரை')) cardType = 'சர்க்கரை அட்டை (Sugar Card - NPHHS)';
        else if (text === 'CARD_TYPE_NO_COMMODITY' || text.includes('பண்டமில்லா')) cardType = 'பண்டமில்லா அட்டை (No Commodity - NC)';

        sess.subServiceData = { ...(sess.subServiceData || {}), cardType };
        sess.intakeState = 'READY_TO_APPLY';
        sess.step = 'READY';
        sess.chatHistory.push(renderSubserviceReadySummary(sess));
        return true;
    }

    // Subservice 7: Update Mobile
    if (currentState === 'RATION_CHANGE_MOBILE') {
        sess.subService = 'UPDATE_MOBILE';
        let newMob = text.replace(/\D/g, '');
        if (newMob.length === 10) {
            sess.subServiceData = { ...(sess.subServiceData || {}), newMobile: newMob };
        }
        sess.intakeState = 'READY_TO_APPLY';
        sess.step = 'READY';
        sess.chatHistory.push(renderSubserviceReadySummary(sess));
        return true;
    }

    // Subservice 8: LPG Update
    if (currentState === 'RATION_LPG_UPDATE') {
        sess.subService = 'LPG_UPDATE';
        let cyl = '1 சிலிண்டர் (Single Cylinder)';
        if (text === 'LPG_CYL_0' || text.includes('இல்லை')) cyl = '0 சிலிண்டர் (No Cylinder)';
        else if (text === 'LPG_CYL_2' || text.includes('இரண்டு')) cyl = '2 சிலிண்டர்கள் (Double Cylinders)';

        sess.subServiceData = { ...(sess.subServiceData || {}), cylinders: cyl };
        sess.intakeState = 'READY_TO_APPLY';
        sess.step = 'READY';
        sess.chatHistory.push(renderSubserviceReadySummary(sess));
        return true;
    }

    return false;
}

module.exports = {
    SERVICE_OPTIONS,
    RATION_CARD_SERVICE_OPTIONS,
    MEMBER_COUNT_OPTIONS,
    RESIDENCE_PROOF_OPTIONS,
    RELATIONSHIP_OPTIONS,
    getRelationshipOptions,
    mapRelationshipToEng,
    getInitialWelcomeMessage,
    handleServiceSelection,
    handleRationSubserviceWorkflow,
    renderSubserviceReadySummary
};
