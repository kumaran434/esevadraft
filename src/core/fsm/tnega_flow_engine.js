/**
 * eSevaDraft TNeGA Unified Flow Engine
 * Single Source of Truth for TNeGA Service Gating (Income, Residence, Community, CAN)
 * Enforces strict sequential step progression with zero option-dumping.
 */

const { evaluateServiceChecklist } = require('../services_registry');
const { ensureBilingualPair, formatStreetWithHamlet } = require('../../utils/bilingual_helper');

/**
 * PHASE 1 VERIFIED PORTAL MASTER SCHEMAS (TNeGA e-Sevai Portal DOM)
 * Explicitly separates:
 * - bucketA_DocumentExtracted: Fields auto-extracted from Aadhaar/Documents (skipped if already on file)
 * - bucketB_UserPrompted: Fields NOT on Aadhaar that must be asked step-by-step if missing from profile
 */
const TNEGA_PORTAL_SCHEMAS = {
    CAN_REGISTER: {
        serviceCode: 'TNEGA_CAN',
        bucketA_DocumentExtracted: [
            'fullNameEng', 'fullNameTam', 'fatherNameEng', 'fatherNameTam',
            'headAadhaar', 'headDob', 'headGender',
            'doorNo', 'streetTam', 'village', 'taluk', 'district', 'pincode'
        ],
        bucketB_UserPrompted: [
            { key: 'motherNameTam', state: 'CAN_MOTHER_NAME_WAIT', label: 'தாயாரின் பெயர் (Mother Name)' },
            { key: 'community', state: 'CAN_COMMUNITY_WAIT', label: 'வகுப்பு / பிரிவு (Community)' }
        ]
    },
    INCOME_CERTIFICATE: {
        serviceCode: 'REV-103',
        bucketA_DocumentExtracted: [
            'fullNameEng', 'fullNameTam', 'fatherNameEng', 'fatherNameTam',
            'headAadhaar', 'headDob', 'headGender',
            'doorNo', 'streetTam', 'village', 'taluk', 'district', 'pincode'
        ],
        bucketB_UserPrompted: [
            { key: 'canNumber', state: 'INCOME_CAN_GATE', label: '13/15-இலக்க CAN எண்' },
            { key: 'motherNameTam', state: 'INCOME_MOTHER_NAME_WAIT', label: 'தாயாரின் பெயர் (Mother Name)' },
            { key: 'community', state: 'INCOME_COMMUNITY_WAIT', label: 'வகுப்பு / பிரிவு (Community)' },
            { key: 'annualIncome', state: 'INCOME_INTAKE', label: 'குடும்ப ஆண்டு வருமானம் (Annual Income)' },
            { key: 'profession', state: 'INCOME_INTAKE', label: 'தொழில் (Occupation)' }
        ]
    },
    RESIDENCE_CERTIFICATE: {
        serviceCode: 'REV-102',
        bucketA_DocumentExtracted: [
            'fullNameEng', 'fullNameTam', 'fatherNameEng', 'fatherNameTam',
            'headAadhaar', 'headDob', 'headGender',
            'doorNo', 'streetTam', 'village', 'taluk', 'district', 'pincode'
        ],
        bucketB_UserPrompted: [
            { key: 'canNumber', state: 'RESIDENCE_CAN_GATE', label: '13/15-இலக்க CAN எண்' },
            { key: 'yearsOfResidence', state: 'RESIDENCE_YEARS_WAIT', label: 'வசிக்கும் காலம் (Years of Continuous Residence)' },
            { key: 'purposeOfCertificate', state: 'RESIDENCE_PURPOSE_WAIT', label: 'சான்றிதழ் பயன்பாடு / நோக்கம் (Purpose)' }
        ]
    },
    COMMUNITY_CERTIFICATE: {
        serviceCode: 'REV-101',
        bucketA_DocumentExtracted: [
            'fullNameEng', 'fullNameTam', 'fatherNameEng', 'fatherNameTam',
            'headAadhaar', 'headDob', 'headGender',
            'doorNo', 'streetTam', 'village', 'taluk', 'district', 'pincode'
        ],
        bucketB_UserPrompted: [
            { key: 'canNumber', state: 'COMMUNITY_CAN_GATE', label: '13/15-இலக்க CAN எண்' },
            { key: 'motherNameTam', state: 'COMMUNITY_MOTHER_NAME_WAIT', label: 'தாயாரின் பெயர் (Mother Name)' },
            { key: 'religion', state: 'COMMUNITY_RELIGION_WAIT', label: 'மதம் (Religion)' },
            { key: 'community', state: 'COMMUNITY_COMM_WAIT', label: 'வகுப்பு / பிரிவு (Community)' },
            { key: 'caste', state: 'COMMUNITY_CASTE_WAIT', label: 'சாதி / உட்பிரிவு (Caste / Sub-caste)' }
        ]
    }
};

/**
 * Advances the TNeGA Income Certificate (REV-103) Flow.
 * Evaluates demographics in strict sequential order:
 * 1. Multi-member family selection (if applicable)
 * 2. Basic applicant demographics (if fresh customer)
 * 3. 13/15-digit CAN Number verification gate (strict prerequisite)
 * 4. Mother's Name (mandatory government field)
 * 5. Community / Caste (mandatory government field)
 * 6. Family Annual Income (4 clean amount chips)
 * 7. Occupation / Profession (4 clean profession chips)
 * 8. Final Ready Station with complete summary and START_INCOME_APPLY
 *
 * @param {Object} sess - The active user session object
 * @param {string} [prefixMessage] - Optional confirmation message from preceding step
 * @returns {Object} { text, options, step }
 */
function advanceTnegaIncomeFlow(sess, prefixMessage = '') {
    sess.subService = 'INCOME';
    if (!sess.citizenProfile) sess.citizenProfile = {};
    sess.citizenProfile.subService = 'INCOME';

    // Clear conflicting previous subservice data from Add Member / Remove Member so HUD stays clean
    if (sess.citizenProfile.subServiceData && (sess.citizenProfile.subServiceData.memberName || sess.citizenProfile.subServiceData.isChild !== undefined)) {
        sess.citizenProfile.subServiceData = {};
    }
    if (sess.subServiceData && (sess.subServiceData.memberName || sess.subServiceData.isChild !== undefined)) {
        sess.subServiceData = {};
    }

    const p = sess.citizenProfile;
    const members = p.members || [];
    const hasFamily = members.length > 1;
    const hasCan = Boolean(p.canNumber && String(p.canNumber).length >= 13);
    const hasMother = Boolean(p.motherNameTam || p.motherNameEng || p.motherName);
    const hasCommunity = Boolean(p.community || p.caste || p.socialCategory);
    const hasIncome = Boolean(p.annualIncome);
    const hasProfession = Boolean(p.profession);
    const hasBasicDemographics = Boolean(p.headAadhaar || p.aadhaarNumber || p.fullNameTam || p.fullNameEng);

    // -------------------------------------------------------------------------
    // STEP 0: Multi-Member Family Card Gate
    // -------------------------------------------------------------------------
    if (hasFamily && !sess.selectedMember) {
        sess.intakeState = 'INCOME_INTAKE';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `📜 **வருமானச் சான்றிதழ் (Income Certificate)**\n\n` +
            `இந்த குடும்பத்தில் **யாருக்கு வருமானச் சான்றிதழ்** தேவைப்படுகிறது? கீழே உள்ள நபரைத் தேர்ந்தெடுக்கவும்:`;
        const options = members.map((m, idx) => ({
            label: `👤 ${m.nameTam || m.nameEng} (${m.relationshipTam || (idx === 0 ? 'தலைவர்' : 'உறுப்பினர்')})`,
            value: `SELECT_MEMBER_${idx}`
        }));
        return { text: welcomeText, options, step: sess.intakeState };
    }

    // -------------------------------------------------------------------------
    // STEP 1: Strict CAN Verification Gate (Government Prerequisite)
    // -------------------------------------------------------------------------
    if (!hasCan) {
        sess.intakeState = 'INCOME_CAN_GATE';
        const aadhDisp = (p.headAadhaar || p.aadhaarNumber || '').replace(/(\d{4})/g, '$1 ').trim();
        const nameDisp = p.fullNameTam || p.fullNameEng || '';
        let welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `📜 **வருமானச் சான்றிதழ் (Income Certificate) விண்ணப்பத்திற்கு வரவேற்கிறோம்!**\n\n` +
            `⚠️ **முக்கிய அரசு விதி (TNeGA Portal Rule):**\n` +
            `வருமானச் சான்றிதழ் விண்ணப்பிக்க **13-இலக்க CAN எண் (Citizen Access Number)** கட்டாயம் தேவை.\n\n`;
        if (nameDisp || aadhDisp) {
            welcomeText += (nameDisp ? `• 👤 **விண்ணப்பதாரர்:** ${nameDisp}\n` : '') +
                           (aadhDisp ? `• 🪪 **ஆதார் எண்:** ${aadhDisp}\n\n` : '\n');
        }
        welcomeText += `உங்களிடம் ஏற்கெனவே CAN எண் உள்ளதா அல்லது போர்ட்டலில் தேட / புதிதாகப் பதிவு செய்ய வேண்டுமா?`;
        const options = [
            { label: "🔍 CAN எண் தேடு (Search CAN)", value: "CAN_SEARCH_PROMPT" },
            { label: "📝 புதிய CAN பதிவு செய் (Register New CAN)", value: "CAN_REGISTER_PROMPT" },
            { label: "🔢 என்னிடம் CAN எண் உள்ளது (Direct Input)", value: "CAN_DIRECT_INPUT" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    // -------------------------------------------------------------------------
    // STEP 3: Mandatory Mother's Name Gate
    // -------------------------------------------------------------------------
    if (!hasMother) {
        sess.intakeState = 'INCOME_MOTHER_NAME_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `✅ **TNeGA CAN எண் இணைக்கப்பட்டுள்ளது:** **${p.canNumber}** 🛡️\n` +
            `• 👤 **விண்ணப்பதாரர்:** ${p.fullNameTam || p.fullNameEng || 'விண்ணப்பதாரர்'}\n\n` +
            `⚠️ **கட்டாய அரசு விவரம் (Mandatory Detail):**\n` +
            `இ-சேவை (TNeGA) போர்ட்டலில் தாயின் பெயர் கட்டாயமாகும்.\n\n` +
            `தயவுசெய்து **தாயாரின் பெயரை** உள்ளிடவும் (எ.கா: தேவகி அல்லது Devaki):`;
        return { text: welcomeText, options: [], step: sess.intakeState };
    }

    // -------------------------------------------------------------------------
    // STEP 4: Mandatory Community / Caste Gate
    // -------------------------------------------------------------------------
    if (!hasCommunity) {
        sess.intakeState = 'INCOME_COMMUNITY_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `✅ **TNeGA CAN எண்:** **${p.canNumber}** 🛡️\n` +
            `• 👤 **விண்ணப்பதாரர்:** ${p.fullNameTam || p.fullNameEng || 'விண்ணப்பதாரர்'}\n` +
            `• 👩 **தாயின் பெயர்:** ${p.motherNameTam || p.motherNameEng}\n\n` +
            `🏛️ **விண்ணப்பதாரரின் வகுப்பு / பிரிவு (Community) எது?**\n` +
            `கீழே உள்ள பிரிவைத் தேர்ந்தெடுக்கவும்:`;
        const options = [
            { label: "MBC (மிகவும் பிற்படுத்தப்பட்டோர்)", value: "COMMUNITY_MBC" },
            { label: "BC (பிற்படுத்தப்பட்டோர்)", value: "COMMUNITY_BC" },
            { label: "BCM (பிற்படுத்தப்பட்ட முஸ்லிம்)", value: "COMMUNITY_BCM" },
            { label: "SC (பட்டியலினத்தவர்)", value: "COMMUNITY_SC" },
            { label: "ST (பழங்குடியினர்)", value: "COMMUNITY_ST" },
            { label: "OC (பொதுப் பிரிவு)", value: "COMMUNITY_OC" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    // -------------------------------------------------------------------------
    // STEP 5: Family Member Count Gate (Mandatory Portal Field)
    // -------------------------------------------------------------------------
    if (!p.familyMemberCount) {
        sess.intakeState = 'INCOME_MEMBER_COUNT_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `👨‍👩‍👧‍👦 **வருமானச் சான்றிதழில் குடும்ப உறுப்பினர்கள் எத்தனை பேரைச் சேர்க்க வேண்டும்?**\n\n` +
            `• 👤 **விண்ணப்பதாரர்:** ${p.fullNameTam || p.fullNameEng || 'விண்ணப்பதாரர்'}\n` +
            `• 🔢 **CAN எண்:** **${p.canNumber}** ✅\n` +
            `• 👩 **தாயின் பெயர்:** ${p.motherNameTam || p.motherNameEng || '—'}\n` +
            `• 🏛️ **வகுப்பு:** ${p.community || 'MBC'}\n\n` +
            `வருமானச் சான்றிதழில் சேர்க்க வேண்டிய மொத்த குடும்ப உறுப்பினர்களின் எண்ணிக்கையைத் தேர்ந்தெடுக்கவும்:`;
        const options = [
            { label: "👤 1 நபர் (விண்ணப்பதாரர் மட்டும்)", value: "1 நபர்" },
            { label: "👥 2 நபர்கள் (விண்ணப்பதாரர் + குடும்ப நபர்)", value: "2 நபர்கள்" },
            { label: "👨‍👩‍👧 3 நபர்கள்", value: "3 நபர்கள்" },
            { label: "👨‍👩‍👧‍👦 4 நபர்கள்", value: "4 நபர்கள்" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    // -------------------------------------------------------------------------
    // STEP 6: Additional Family Member Details (If Member Count > 1)
    // -------------------------------------------------------------------------
    const neededAddl = Number(p.familyMemberCount) - 1;
    const currentAddl = (p.incomeMembers || []).length;
    if (neededAddl > 0 && currentAddl < neededAddl) {
        sess.intakeState = 'INCOME_ADDITIONAL_MEMBER_WAIT';
        const motherName = p.motherNameTam || p.motherNameEng || 'தேவகி';
        const fatherName = p.fatherNameTam || p.fatherNameEng || 'கிருபாகரன்';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `👥 **கூடுதல் குடும்ப உறுப்பினர் விவரங்கள் (${currentAddl + 1}/${neededAddl}):**\n\n` +
            `அடுத்த குடும்ப உறுப்பினரின் உறவுமுறை, பெயர் மற்றும் தொழில் விவரத்தைத் தேர்ந்தெடுக்கவும் (அல்லது தட்டச்சு செய்யவும்):`;
        const options = [
            { label: `👵 தாய் - ${motherName} (கூலி வேலை)`, value: `தாய் - ${motherName} (கூலி வேலை)` },
            { label: `👴 தந்தை - ${fatherName} (விவசாயம்)`, value: `தந்தை - ${fatherName} (விவசாயம்)` },
            { label: "👰 மனைவி (குடும்பத் தலைவி)", value: "மனைவி (குடும்பத் தலைவி)" },
            { label: "👦 மகன் / மகள்", value: "மகன்" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    // -------------------------------------------------------------------------
    // STEP 7: Family Annual Income Gate
    // -------------------------------------------------------------------------
    if (!hasIncome) {
        sess.intakeState = 'INCOME_INTAKE';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `💰 **குடும்ப மொத்த ஆண்டு வருமானம் எவ்வளவு?**\n\n` +
            `• 👤 **விண்ணப்பதாரர்:** ${p.fullNameTam || p.fullNameEng || 'விண்ணப்பதாரர்'}\n` +
            `• 👨‍👩‍👧‍👦 **குடும்ப உறுப்பினர்கள்:** ${p.familyMemberCount || 1} நபர்\n\n` +
            `வருமானச் சான்றிதழில் குறிப்பிட வேண்டிய ஆண்டு வருமானத்தைத் தேர்ந்தெடுக்கவும்:`;
        const options = [
            { label: "₹60,000", value: "₹60,000" },
            { label: "₹72,000", value: "₹72,000" },
            { label: "₹1,00,000", value: "₹1,00,000" },
            { label: "₹1,20,000", value: "₹1,20,000" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    // -------------------------------------------------------------------------
    // STEP 8: Occupation / Profession Gate
    // -------------------------------------------------------------------------
    if (!hasProfession) {
        sess.intakeState = 'INCOME_INTAKE';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `✅ குடும்ப ஆண்டு வருமானம் **₹${Number(p.annualIncome).toLocaleString('en-IN')}** எனப் பதிவானது!\n\n` +
            `💼 **விண்ணப்பதாரரின் தொழில் (Occupation) என்ன?**\n` +
            `கீழே உள்ள தொழிலைத் தேர்ந்தெடுக்கவும்:`;
        const options = [
            { label: "கூலி வேலை (Daily Wage / Coolie)", value: "கூலி வேலை" },
            { label: "தனியார் துறை (Private Sector)", value: "தனியார் வேலை" },
            { label: "விவசாயம் (Agriculture / Farmer)", value: "விவசாயம்" },
            { label: "சிறு வணிகம் / வியாபாரம் (Small Business)", value: "வியாபாரம்" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    // -------------------------------------------------------------------------
    // STEP 9: Bucket A Document Gate (If Brand-New Customer has no Aadhaar/Name on file)
    // -------------------------------------------------------------------------
    if (!hasBasicDemographics) {
        sess.intakeState = 'INCOME_AADHAAR_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `📄 **விண்ணப்பதாரர் ஆதார் அட்டை தேவை (Bucket A - Document Extraction):**\n\n` +
            `• 🔢 **CAN எண்:** **${p.canNumber}** ✅\n` +
            `• 👩 **தாயின் பெயர்:** ${p.motherNameTam || p.motherNameEng}\n` +
            `• 🏛️ **வகுப்பு:** ${p.community} | 💰 **வருமானம்:** ₹${Number(p.annualIncome).toLocaleString('en-IN')}\n\n` +
            `விண்ணப்பதாரரின் பெயர், தந்தை பெயர் மற்றும் முகவரி விவரங்களைத் தானாகப் பெற **ஆதார் அட்டை (படம் / PDF)** பதிவேற்றவும்:`;
        const options = [
            { label: "📷 ஆதார் அட்டை பதிவேற்றுக (Upload Aadhaar)", value: "TRIGGER_FILE_UPLOAD" },
            { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    // -------------------------------------------------------------------------
    // STEP 10: All 100% Ready Station (Pre-Submit Approval Gate)
    // -------------------------------------------------------------------------
    sess.intakeState = 'READY_TO_APPLY_INCOME';
    const chk = evaluateServiceChecklist('INCOME_CERTIFICATE', sess.citizenProfile, sess.draftData?.base64Docs || {});
    const addlSummary = (p.incomeMembers && p.incomeMembers.length > 0)
        ? p.incomeMembers.map((m, idx) => `• 👥 **உறுப்பினர் ${idx + 2}:** ${m.name} (${m.relationship} - ${m.profession})`).join('\n') + '\n'
        : '';

    const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
        `🎉 **வருமானச் சான்றிதழ் விண்ணப்பத்திற்கான அனைத்து விவரங்களும் 100% தயாராக உள்ளன!** 🛡️\n\n` +
        `📋 **விவரங்கள் சுருக்கம்:**\n` +
        `• 🔢 **CAN எண்:** **${p.canNumber}** ✅\n` +
        `• 👤 **விண்ணப்பதாரர்:** ${p.fullNameTam || p.fullNameEng}\n` +
        `• 👨‍👧 **தந்தை/கணவர்:** ${p.fatherNameTam || p.fatherNameEng || '—'}\n` +
        `• 👩 **தாயின் பெயர்:** ${p.motherNameTam || p.motherNameEng}\n` +
        `• 🏛️ **வகுப்பு:** ${p.community}\n` +
        `• 👨‍👩‍👧‍👦 **மொத்த குடும்ப உறுப்பினர்கள்:** ${p.familyMemberCount || 1} நபர்\n` +
        addlSummary +
        `• 💰 **ஆண்டு வருமானம்:** ₹${Number(p.annualIncome).toLocaleString('en-IN')}\n` +
        `• 💼 **தொழில்:** ${p.profession}\n` +
        `• 🏠 **முகவரி:** ${p.doorNo ? p.doorNo + ', ' : ''}${p.streetTam || p.streetEng || ''}, ${p.village || ''} - ${p.pincode || ''}\n\n` +
        (chk && chk.summaryTamil ? `${chk.summaryTamil}\n\n` : '') +
        `இப்போது இ-சேவை (TNeGA REV-103) போர்ட்டல் மூலம் விண்ணப்பிக்கத் தொடங்கலாம்!`;
    const options = [
        { label: "🚀 இ-சேவை போர்ட்டலில் விண்ணப்பிக்கத் தொடங்கு", value: "START_INCOME_APPLY" },
        { label: "✏️ விவரங்களைச் சரிபார் / திருத்து (Edit Details)", value: "TRIGGER_EDIT_MODAL" },
        { label: "🔄 புதிய விண்ணப்பம் தொடங்க (Reset)", value: "reset" }
    ];
    return { text: welcomeText, options, step: sess.intakeState };
}

/**
 * Advances the TNeGA CAN Registration Flow.
 * Strictly checks mandatory Mother Name and Community before allowing automation start.
 *
 * @param {Object} sess - The active user session object
 * @param {string} [prefixMessage] - Optional confirmation message
 * @returns {Object} { text, options, step }
 */
function advanceTnegaCanRegisterFlow(sess, prefixMessage = '') {
    sess.subService = 'CAN_REGISTER';
    if (!sess.citizenProfile) sess.citizenProfile = {};
    sess.citizenProfile.subService = 'CAN_REGISTER';

    const p = sess.citizenProfile;
    const mob = p.mobileNumber || sess.mobileNumber || '';
    const nameTam = p.fullNameTam || p.headNameTam || '';
    const nameEng = p.fullNameEng || p.headNameEng || '';
    const fatTam = p.fatherNameTam || '';
    const fatEng = p.fatherNameEng || '';
    const rawMotEng = p.motherNameEng || p.motherName || '';
    const rawMotTam = p.motherNameTam || p.motherName || '';
    const motPair = (rawMotEng || rawMotTam) ? ensureBilingualPair(rawMotEng, rawMotTam) : { eng: '', tam: '' };
    const motTam = motPair.tam;
    const motEng = motPair.eng;
    if (motTam) p.motherNameTam = motTam;
    if (motEng) p.motherNameEng = motEng;
    const comm = p.community || p.caste || '';
    const aadh = p.headAadhaar || p.aadhaar || '';
    const aadhDisp = aadh ? aadh.replace(/(\d{4})/g, '$1 ').trim() : '—';
    const door = p.doorNo || '';
    const vil = p.villageTam || p.village || '';
    const tal = p.talukTam || p.taluk || '';
    const dist = p.districtTam || p.district || '';
    const pin = p.pincode || '';
    const dob = p.dob || p.headDob || '';
    const gen = p.genderTam || p.headGenderTam || (p.headGender === 'Female' ? 'பெண்' : 'ஆண்');

    const { fullStreetTam } = formatStreetWithHamlet(p, { village: p.village, villageTam: p.villageTam, areaEng: p.areaEng, areaTam: p.areaTam });
    let stTam = fullStreetTam || p.streetTam || p.streetEng || '';

    // Check basic details
    if (!mob || (!nameTam && !nameEng) || !aadh) {
        sess.intakeState = 'CAN_REGISTER_INTAKE';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `📝 **புதிய CAN பதிவிற்கு தேவையான தகவல்கள்:**\n\n` +
            `விண்ணப்பதாரரின் ஆதார் அட்டை படம் / PDF பதிவேற்றவும் (அல்லது விவரங்களை உள்ளிடவும்):`;
        const options = [
            { label: "📷 ஆதார் அட்டை அப்லோட்", value: "TRIGGER_FILE_UPLOAD" },
            { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    // Check Mother's Name
    if (!motTam && !motEng) {
        sess.intakeState = 'CAN_MOTHER_NAME_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `📝 **புதிய CAN பதிவு (New CAN Registration)**\n\n` +
            `• 👤 **விண்ணப்பதாரர்:** ${nameTam || nameEng}\n` +
            `• 👨 **தந்தை/கணவர்:** ${fatTam || fatEng || '—'}\n\n` +
            `⚠️ **கட்டாய அரசு விவரம் (Mandatory Detail):**\n` +
            `TNeGA போர்ட்டலில் புதிய CAN பதிவு செய்ய தாயின் பெயர் கட்டாயமாகும்.\n\n` +
            `தயவுசெய்து **தாயாரின் பெயரை** உள்ளிடவும் (எ.கா: தேவகி அல்லது Devaki):`;
        return { text: welcomeText, options: [], step: sess.intakeState };
    }

    // Check Community
    if (!comm) {
        sess.intakeState = 'CAN_COMMUNITY_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `📝 **புதிய CAN பதிவு (New CAN Registration)**\n\n` +
            `• 👤 **விண்ணப்பதாரர்:** ${nameTam || nameEng}\n` +
            `• 👩 **தாயின் பெயர்:** ${motTam || motEng}\n\n` +
            `🏛️ **விண்ணப்பதாரரின் வகுப்பு / பிரிவு (Community) எது?**\n` +
            `கீழே உள்ள பிரிவைத் தேர்ந்தெடுக்கவும்:`;
        const options = [
            { label: "MBC (மிகவும் பிற்படுத்தப்பட்டோர்)", value: "COMMUNITY_MBC" },
            { label: "BC (பிற்படுத்தப்பட்டோர்)", value: "COMMUNITY_BC" },
            { label: "BCM (பிற்படுத்தப்பட்ட முஸ்லிம்)", value: "COMMUNITY_BCM" },
            { label: "SC (பட்டியலினத்தவர்)", value: "COMMUNITY_SC" },
            { label: "ST (பழங்குடியினர்)", value: "COMMUNITY_ST" },
            { label: "OC (பொதுப் பிரிவு)", value: "COMMUNITY_OC" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    // All CAN prerequisites satisfied -> Ready for physical automation
    sess.intakeState = 'READY_TO_APPLY_CAN';
    const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
        `📝 **புதிய CAN பதிவு (New CAN Registration) விவரங்கள்:**\n\n` +
        `• 👤 **விண்ணப்பதாரர் பெயர்:** ${nameTam} (${nameEng})\n` +
        `• 👨 **தந்தை/கணவர் பெயர்:** ${fatTam} (${fatEng})\n` +
        `• 👩 **தாயின் பெயர்:** ${motTam || motEng}${motTam && motEng ? ` (${motEng})` : ''}\n` +
        `• 🏛️ **வகுப்பு:** ${comm}\n` +
        `• 🪪 **ஆதார் எண்:** ${aadhDisp}\n` +
        `• 📱 **கைபேசி எண்:** +91 ${mob}\n` +
        `• 🎂 **பிறந்த தேதி & பாலினம்:** ${dob} | ${gen}\n` +
        `• 🏠 **முகவரி:** ${door ? door + ', ' : ''}${stTam}, ${vil}, ${tal}, ${dist} - ${pin}\n\n` +
        `'புதிய CAN பதிவு தொடங்கு' பொத்தானை அழுத்தவும்:`;
    const options = [
        { label: "🚀 புதிய CAN பதிவு தொடங்கு (Start CAN Registration)", value: "START_CAN_REGISTER" },
        { label: "✏️ விவரங்களை மாற்று (Edit Details)", value: "TRIGGER_EDIT_MODAL" }
    ];
    return { text: welcomeText, options, step: sess.intakeState };
}

/**
 * Advances the TNeGA Residence / Nativity Certificate (REV-102) Flow.
 * Strictly adheres to Golden Rule 11 (Universal Delta Intake Engine):
 * 1. Multi-member family selection (if family profile has > 1 member and none selected)
 * 2. 13/15-digit CAN verification gate (mandatory government prerequisite)
 * 3. Continuous Residence Duration (தமிழ்நாட்டில் தொடர்ந்து வசிக்கும் காலம்)
 * 4. Purpose of Certificate (சான்றிதழ் பயன்பாடு / நோக்கம்)
 * 5. Bucket A Demographics check (if brand-new customer with no Aadhaar on file)
 * 6. 100% Ready Station with summary and START_RESIDENCE_APPLY
 */
function advanceTnegaResidenceFlow(sess, prefixMessage = '') {
    sess.subService = 'RESIDENCE';
    if (!sess.citizenProfile) sess.citizenProfile = {};
    sess.citizenProfile.subService = 'RESIDENCE';

    const p = sess.citizenProfile;
    const members = p.members || [];
    const hasFamily = members.length > 1;
    const hasCan = Boolean(p.canNumber && String(p.canNumber).length >= 13);
    const hasYears = Boolean(p.yearsOfResidence);
    const hasPurpose = Boolean(p.purposeOfCertificate);
    const hasBasicDemographics = Boolean(p.headAadhaar || p.aadhaarNumber || p.fullNameTam || p.fullNameEng);

    // STEP 0: Family Member Selection Gate (if family card has multiple members)
    if (hasFamily && !sess.selectedMember) {
        sess.intakeState = 'RESIDENCE_INTAKE';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `🏠 **இருப்பிடச் சான்றிதழ் (Residence / Nativity Certificate)**\n\n` +
            `இந்த குடும்பத்தில் **யாருக்கு இருப்பிடச் சான்றிதழ்** தேவைப்படுகிறது? கீழே உள்ள நபரைத் தேர்ந்தெடுக்கவும்:`;
        const options = members.map((m, idx) => ({
            label: `👤 ${m.nameTam || m.nameEng} (${m.relationshipTam || (idx === 0 ? 'தலைவர்' : 'உறுப்பினர்')})`,
            value: `SELECT_MEMBER_${idx}`
        }));
        return { text: welcomeText, options, step: sess.intakeState };
    }

    // STEP 1: Strict CAN Verification Gate
    if (!hasCan) {
        sess.intakeState = 'RESIDENCE_CAN_GATE';
        const aadhDisp = (p.headAadhaar || p.aadhaarNumber || '').replace(/(\d{4})/g, '$1 ').trim();
        const nameDisp = p.fullNameTam || p.fullNameEng || '';
        let welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `🏠 **இருப்பிடச் சான்றிதழ் (Residence Certificate) விண்ணப்பத்திற்கு வரவேற்கிறோம்!**\n\n` +
            `⚠️ **முக்கிய அரசு விதி (TNeGA Portal Rule):**\n` +
            `இருப்பிடச் சான்றிதழ் விண்ணப்பிக்க **13-இலக்க CAN எண் (Citizen Access Number)** கட்டாயம் தேவை.\n\n`;
        if (nameDisp || aadhDisp) {
            welcomeText += (nameDisp ? `• 👤 **விண்ணப்பதாரர்:** ${nameDisp}\n` : '') +
                           (aadhDisp ? `• 🪪 **ஆதார் எண்:** ${aadhDisp}\n\n` : '\n');
        }
        welcomeText += `உங்களிடம் ஏற்கெனவே CAN எண் உள்ளதா அல்லது போர்ட்டலில் தேட / புதிதாகப் பதிவு செய்ய வேண்டுமா?`;
        const options = [
            { label: "🔍 CAN எண் தேடு (Search CAN)", value: "CAN_SEARCH_PROMPT" },
            { label: "📝 புதிய CAN பதிவு செய் (Register New CAN)", value: "CAN_REGISTER_PROMPT" },
            { label: "🔢 என்னிடம் CAN எண் உள்ளது (Direct Input)", value: "CAN_DIRECT_INPUT" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    // STEP 2: Years of Residence Gate (வசிக்கும் காலம்)
    if (!hasYears) {
        sess.intakeState = 'RESIDENCE_YEARS_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `✅ **TNeGA CAN எண்:** **${p.canNumber}** 🛡️\n` +
            `• 👤 **விண்ணப்பதாரர்:** ${p.fullNameTam || p.fullNameEng || 'விண்ணப்பதாரர்'}\n\n` +
            `🏠 **விண்ணப்பதாரர் தமிழ்நாட்டில் எத்தனை ஆண்டுகளாகத் தொடர்ந்து வசித்து வருகிறார்?**\n\n` +
            `கீழே உள்ள விருப்பங்களில் ஒன்றைத் தேர்ந்தெடுக்கவும் (அல்லது தட்டச்சு செய்யவும்):`;
        const options = [
            { label: "🌟 பிறப்பிலிருந்து (Since Birth)", value: "பிறப்பிலிருந்து" },
            { label: "🔟 10+ ஆண்டுகள் (10+ Years)", value: "10 ஆண்டுகள்" },
            { label: "5️⃣ 5+ ஆண்டுகள் (5+ Years)", value: "5 ஆண்டுகள்" },
            { label: "1️⃣ 1+ ஆண்டுகள் (1+ Years)", value: "1 ஆண்டு" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    // STEP 3: Purpose of Certificate Gate (சான்றிதழ் பயன்பாடு)
    if (!hasPurpose) {
        sess.intakeState = 'RESIDENCE_PURPOSE_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `✅ வசிக்கும் காலம்: **${p.yearsOfResidence}** எனப் பதிவானது!\n\n` +
            `🎯 **இருப்பிடச் சான்றிதழ் எந்த பயன்பாட்டிற்காகத் தேவைப்படுகிறது?**\n\n` +
            `கீழே உள்ள பயன்பாட்டைத் தேர்ந்தெடுக்கவும்:`;
        const options = [
            { label: "🎓 கல்வி / கல்லூரி சேர்க்கை (Education)", value: "கல்வி பயன்பாடு" },
            { label: "💼 வேலைவாய்ப்பு (Employment)", value: "வேலைவாய்ப்பு" },
            { label: "🏛️ அரசு நலத்திட்டம் / உதவித்தொகை (Govt Scheme)", value: "அரசு நலத்திட்டம்" },
            { label: "📋 பொது பயன்பாடு (General Purpose)", value: "பொது பயன்பாடு" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    // STEP 4: Basic Demographics check (if brand-new customer has no Aadhaar on file)
    if (!hasBasicDemographics) {
        sess.intakeState = 'RESIDENCE_AADHAAR_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `📄 **விண்ணப்பதாரர் ஆதார் அட்டை தேவை:**\n\n` +
            `• 🔢 **CAN எண்:** **${p.canNumber}** ✅\n` +
            `• 📅 **வசிக்கும் காலம்:** ${p.yearsOfResidence}\n` +
            `• 🎯 **நோக்கம்:** ${p.purposeOfCertificate}\n\n` +
            `விண்ணப்பதாரரின் முகவரி விவரங்களைத் தானாகப் பெற **ஆதார் அட்டை (படம் / PDF)** பதிவேற்றவும்:`;
        const options = [
            { label: "📷 ஆதார் அட்டை பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
            { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    // STEP 5: 100% Ready Station
    sess.intakeState = 'READY_TO_APPLY_RESIDENCE';
    const chk = evaluateServiceChecklist('RESIDENCE_CERTIFICATE', sess.citizenProfile, sess.draftData?.base64Docs || {});
    const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
        `🎉 **இருப்பிடச் சான்றிதழ் (REV-102) விண்ணப்பத்திற்கான விவரங்கள் 100% தயாராக உள்ளன!** 🛡️\n\n` +
        `📋 **விவரங்கள் சுருக்கம்:**\n` +
        `• 🔢 **CAN எண்:** **${p.canNumber}** ✅\n` +
        `• 👤 **விண்ணப்பதாரர்:** ${p.fullNameTam || p.fullNameEng}\n` +
        `• 👨‍👧 **தந்தை/கணவர்:** ${p.fatherNameTam || p.fatherNameEng || '—'}\n` +
        `• 📅 **வசிக்கும் காலம்:** ${p.yearsOfResidence} ✅\n` +
        `• 🎯 **சான்றிதழ் நோக்கம்:** ${p.purposeOfCertificate} ✅\n` +
        `• 🏠 **முகவரி:** ${p.doorNo ? p.doorNo + ', ' : ''}${p.streetTam || p.streetEng || ''}, ${p.village || ''} - ${p.pincode || ''}\n\n` +
        (chk && chk.summaryTamil ? `${chk.summaryTamil}\n\n` : '') +
        `இப்போது இ-சேவை (TNeGA REV-102) போர்ட்டல் மூலம் விண்ணப்பிக்கத் தொடங்கலாம்!`;
    const options = [
        { label: "🚀 இ-சேவை போர்ட்டலில் விண்ணப்பிக்கத் தொடங்கு", value: "START_RESIDENCE_APPLY" },
        { label: "✏️ விவரங்களைச் சரிபார் / திருத்து (Edit Details)", value: "TRIGGER_EDIT_MODAL" },
        { label: "🔄 புதிய விண்ணப்பம் தொடங்க (Reset)", value: "reset" }
    ];
    return { text: welcomeText, options, step: sess.intakeState };
}

/**
 * Advances the TNeGA Community Certificate (REV-101) Flow.
 * Strictly adheres to Golden Rule 11 (Universal Delta Intake Engine):
 * 1. Multi-member family selection (if family profile has > 1 member and none selected)
 * 2. 13/15-digit CAN verification gate (mandatory government prerequisite)
 * 3. Mandatory Mother's Name (Government field)
 * 4. Religion selection (இந்து, இஸ்லாம், கிறிஸ்தவம், etc.)
 * 5. Community selection (MBC, BC, BCM, SC, ST, OC)
 * 6. Caste / Sub-caste (வன்னியகுல சத்ரியர், அகமுடையார், கொங்கு வேளாளர், etc.)
 * 7. Bucket A Demographics check (if brand-new customer with no Aadhaar on file)
 * 8. 100% Ready Station with summary and START_COMMUNITY_APPLY
 */
function advanceTnegaCommunityFlow(sess, prefixMessage = '') {
    sess.subService = 'COMMUNITY';
    if (!sess.citizenProfile) sess.citizenProfile = {};
    sess.citizenProfile.subService = 'COMMUNITY';

    const p = sess.citizenProfile;
    const members = p.members || [];
    const hasFamily = members.length > 1;
    const hasCan = Boolean(p.canNumber && String(p.canNumber).length >= 13);
    const hasMother = Boolean(p.motherNameTam || p.motherNameEng || p.motherName);
    const hasReligion = Boolean(p.religion);
    const hasCommunity = Boolean(p.community || p.socialCategory);
    const hasCaste = Boolean(p.caste || p.subCaste || p.casteName);
    const hasBasicDemographics = Boolean(p.headAadhaar || p.aadhaarNumber || p.fullNameTam || p.fullNameEng);
    const hasCommunityProof = Boolean(
        p.communityProof ||
        p.communityCertificatePath ||
        p.familyCommunityProofPath ||
        p.communityProofSkipped ||
        (sess.tempUploads && sess.tempUploads.communityProof) ||
        (p.documents && (p.documents.communityProof || p.documents.communityCertificate))
    );

    // STEP 0: Multi-Member Family Selection Gate
    if (hasFamily && !sess.selectedMember) {
        sess.intakeState = 'COMMUNITY_INTAKE';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `📜 **சாதிச் சான்றிதழ் (Community Certificate)**\n\n` +
            `இந்த குடும்பத்தில் **யாருக்கு சாதிச் சான்றிதழ்** தேவைப்படுகிறது? கீழே உள்ள நபரைத் தேர்ந்தெடுக்கவும்:`;
        const options = members.map((m, idx) => ({
            label: `👤 ${m.nameTam || m.nameEng} (${m.relationshipTam || (idx === 0 ? 'தலைவர்' : 'உறுப்பினர்')})`,
            value: `SELECT_MEMBER_${idx}`
        }));
        return { text: welcomeText, options, step: sess.intakeState };
    }

    // STEP 1: Strict CAN Verification Gate
    if (!hasCan) {
        sess.intakeState = 'COMMUNITY_CAN_GATE';
        const aadhDisp = (p.headAadhaar || p.aadhaarNumber || '').replace(/(\d{4})/g, '$1 ').trim();
        const nameDisp = p.fullNameTam || p.fullNameEng || '';
        let welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `📜 **சாதிச் சான்றிதழ் (Community Certificate) விண்ணப்பத்திற்கு வரவேற்கிறோம்!**\n\n` +
            `⚠️ **முக்கிய அரசு விதி (TNeGA Portal Rule):**\n` +
            `சாதிச் சான்றிதழ் விண்ணப்பிக்க **13-இலக்க CAN எண் (Citizen Access Number)** கட்டாயம் தேவை.\n\n`;
        if (nameDisp || aadhDisp) {
            welcomeText += (nameDisp ? `• 👤 **விண்ணப்பதாரர்:** ${nameDisp}\n` : '') +
                           (aadhDisp ? `• 🪪 **ஆதார் எண்:** ${aadhDisp}\n\n` : '\n');
        }
        welcomeText += `உங்களிடம் ஏற்கெனவே CAN எண் உள்ளதா அல்லது போர்ட்டலில் தேட / புதிதாகப் பதிவு செய்ய வேண்டுமா?`;
        const options = [
            { label: "🔍 CAN எண் தேடு (Search CAN)", value: "CAN_SEARCH_PROMPT" },
            { label: "📝 புதிய CAN பதிவு செய் (Register New CAN)", value: "CAN_REGISTER_PROMPT" },
            { label: "🔢 என்னிடம் CAN எண் உள்ளது (Direct Input)", value: "CAN_DIRECT_INPUT" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    // STEP 2: Mandatory Mother's Name Gate
    if (!hasMother) {
        sess.intakeState = 'COMMUNITY_MOTHER_NAME_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `✅ **TNeGA CAN எண்:** **${p.canNumber}** 🛡️\n` +
            `• 👤 **விண்ணப்பதாரர்:** ${p.fullNameTam || p.fullNameEng || 'விண்ணப்பதாரர்'}\n\n` +
            `⚠️ **கட்டாய அரசு விவரம் (Mandatory Detail):**\n` +
            `சாதிச் சான்றிதழ் படிவத்தில் தாயின் பெயர் கட்டாயமாகும்.\n\n` +
            `தயவுசெய்து **தாயாரின் பெயரை** உள்ளிடவும் (எ.கா: தேவகி அல்லது Devaki):`;
        return { text: welcomeText, options: [], step: sess.intakeState };
    }

    // STEP 3: Religion Gate
    if (!hasReligion) {
        sess.intakeState = 'COMMUNITY_RELIGION_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `✅ **TNeGA CAN எண்:** **${p.canNumber}** 🛡️\n` +
            `• 👤 **விண்ணப்பதாரர்:** ${p.fullNameTam || p.fullNameEng || 'விண்ணப்பதாரர்'}\n\n` +
            `🏛️ **விண்ணப்பதாரரின் மதம் (Religion) எது?**\n` +
            `கீழே உள்ள மதத்தைத் தேர்ந்தெடுக்கவும்:`;
        const options = [
            { label: "🕉️ இந்து (Hindu)", value: "RELIGION_HINDU" },
            { label: "☪️ இஸ்லாம் (Muslim)", value: "RELIGION_MUSLIM" },
            { label: "✝️ கிறிஸ்தவம் (Christian)", value: "RELIGION_CHRISTIAN" },
            { label: "🪯 சீக்கியம் (Sikh)", value: "RELIGION_SIKH" },
            { label: "☸️ சமணம் / பௌத்தம் (Jain / Buddhist)", value: "RELIGION_JAIN" },
            { label: "🌐 இதர / பிற (Others)", value: "RELIGION_OTHERS" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    // STEP 4: Community Gate
    if (!hasCommunity) {
        sess.intakeState = 'COMMUNITY_COMM_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `✅ **மதம்:** **${p.religion || 'Hindu'}** எனப் பதிவானது!\n\n` +
            `🏛️ **விண்ணப்பதாரரின் வகுப்பு / பிரிவு (Community) எது?**\n` +
            `கீழே உள்ள பிரிவைத் தேர்ந்தெடுக்கவும்:`;
        const options = [
            { label: "MBC (மிகவும் பிற்படுத்தப்பட்டோர்)", value: "COMMUNITY_MBC" },
            { label: "BC (பிற்படுத்தப்பட்டோர்)", value: "COMMUNITY_BC" },
            { label: "BCM (பிற்படுத்தப்பட்ட முஸ்லிம்)", value: "COMMUNITY_BCM" },
            { label: "SC (பட்டியலினத்தவர்)", value: "COMMUNITY_SC" },
            { label: "ST (பழங்குடியினர்)", value: "COMMUNITY_ST" },
            { label: "OC (பொதுப் பிரிவு)", value: "COMMUNITY_OC" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    // STEP 5: Caste / Sub-Caste Gate
    if (!hasCaste) {
        sess.intakeState = 'COMMUNITY_CASTE_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `✅ பிரிவு: **${p.community}** எனப் பதிவானது!\n\n` +
            `🏷️ **விண்ணப்பதாரரின் சாதி உட்பிரிவு (Caste / Sub-caste) என்ன?**\n\n` +
            `கீழே உள்ள விருப்பத்தைத் தேர்ந்தெடுக்கவும் அல்லது உங்கள் சாதியை நேரடியாக தட்டச்சு செய்யவும்:`;
        let options = [];
        if (p.community === 'MBC') {
            options = [
                { label: "வன்னியகுல சத்ரியர் (Vanniakula Kshatriya)", value: "வன்னியகுல சத்ரியர்" },
                { label: "அகமுடையார் (Agamudayar)", value: "அகமுடையார்" },
                { label: "மருத்துவர் (Maruthuvar)", value: "மருத்துவர்" },
                { label: "நாவிதர் / வண்ணார் (Vannar)", value: "வண்ணார்" }
            ];
        } else if (p.community === 'BC') {
            options = [
                { label: "கொங்கு வேளாளர் (Kongu Vellalar)", value: "கொங்கு வேளாளர்" },
                { label: "நாடார் (Nadar)", value: "நாடார்" },
                { label: "செட்டியார் (Chettiar)", value: "செட்டியார்" },
                { label: "முக்குலத்தோர் / தேவர் (Mukkulathor)", value: "முக்குலத்தோர்" }
            ];
        } else if (p.community === 'SC') {
            options = [
                { label: "ஆதி திராவிடர் (Adi Dravidar)", value: "ஆதி திராவிடர்" },
                { label: "பறையர் (Paraiyar)", value: "பறையர்" },
                { label: "அருந்ததியர் (Arunthathiyar)", value: "அருந்ததியர்" }
            ];
        } else {
            options = [
                { label: "அகமுடையார் (Agamudayar)", value: "அகமுடையார்" },
                { label: "வன்னியகுல சத்ரியர் (Vanniakula Kshatriya)", value: "வன்னியகுல சத்ரியர்" },
                { label: "நாடார் (Nadar)", value: "நாடார்" },
                { label: "ஆதி திராவிடர் (Adi Dravidar)", value: "ஆதி திராவிடர்" }
            ];
        }
        return { text: welcomeText, options, step: sess.intakeState };
    }

    // STEP 6: Bucket A Demographics check (for brand-new customer with no Aadhaar on file)
    if (!hasBasicDemographics) {
        sess.intakeState = 'COMMUNITY_AADHAAR_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `📄 **விண்ணப்பதாரர் ஆதார் அட்டை தேவை:**\n\n` +
            `• 🔢 **CAN எண்:** **${p.canNumber}** ✅\n` +
            `• 🏛️ **வகுப்பு:** ${p.community} | சாதி: ${p.caste || p.subCaste}\n\n` +
            `விண்ணப்பதாரரின் முகவரி விவரங்களைத் தானாகப் பெற **ஆதார் அட்டை (படம் / PDF)** பதிவேற்றவும்:`;
        const options = [
            { label: "📷 ஆதார் அட்டை பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
            { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    // STEP 6.5: Family Community Certificate or School TC Upload Gate
    if (!hasCommunityProof) {
        sess.intakeState = 'COMMUNITY_PROOF_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `📜 **குடும்ப சாதிச் சான்றிதழ் (Family Community Certificate) தேவை:**\n\n` +
            `⚠️ **முக்கிய அரசு விதி (TNeGA REV-101 Portal Rule):**\n` +
            `சாதிச் சான்றிதழ் விண்ணப்பிக்க **தந்தை / தாய் / உடன்பிறந்தோரின் சாதிச் சான்றிதழ்** அல்லது விண்ணப்பதாரரின் **பள்ளி மாற்றுச் சான்றிதழ் (School TC)** போர்ட்டலில் கட்டாயம் பதிவேற்றப்பட வேண்டும்.\n\n` +
            `தயவுசெய்து சான்றிதழைப் பதிவேற்றவும் (புகைப்படம் அல்லது PDF):`;
        const options = [
            { label: "📷 குடும்ப சாதிச் சான்று பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
            { label: "⏩ ஏற்கெனவே உள்ளது / பிறகு பதிவேற்றுக", value: "SKIP_COMMUNITY_PROOF" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    // STEP 7: 100% Ready Station (Pre-Submit Approval Gate)
    sess.intakeState = 'READY_TO_APPLY_COMMUNITY';
    const chk = evaluateServiceChecklist('COMMUNITY_CERTIFICATE', sess.citizenProfile, sess.draftData?.base64Docs || {});
    const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
        `🎉 **சாதிச் சான்றிதழ் (REV-101) விண்ணப்பத்திற்கான விவரங்கள் 100% தயாராக உள்ளன!** 🛡️\n\n` +
        `📋 **விவரங்கள் சுருக்கம்:**\n` +
        `• 🔢 **CAN எண்:** **${p.canNumber}** ✅\n` +
        `• 👤 **விண்ணப்பதாரர்:** ${p.fullNameTam || p.fullNameEng}\n` +
        `• 👨‍👧 **தந்தை/கணவர்:** ${p.fatherNameTam || p.fatherNameEng || '—'}\n` +
        `• 👩 **தாயின் பெயர்:** ${p.motherNameTam || p.motherNameEng || '—'}\n` +
        `• 🕉️ **மதம்:** ${p.religion || 'Hindu'}\n` +
        `• 🏛️ **வகுப்பு / பிரிவு:** ${p.community || 'MBC'} ✅\n` +
        `• 🏷️ **சாதி உட்பிரிவு:** ${p.caste || p.subCaste || '—'} ✅\n` +
        `• 📜 **குடும்ப சாதிச் சான்று:** ${p.communityProof ? 'பதிவேற்றப்பட்டது ✅' : (p.communityProofSkipped ? 'பிறகு பதிவேற்றப்படும் ⏳' : '—')}\n` +
        `• 🏠 **முகவரி:** ${p.doorNo ? p.doorNo + ', ' : ''}${p.streetTam || p.streetEng || ''}, ${p.village || ''} - ${p.pincode || ''}\n\n` +
        (chk && chk.summaryTamil ? `${chk.summaryTamil}\n\n` : '') +
        `இப்போது இ-சேவை (TNeGA REV-101) போர்ட்டல் மூலம் விண்ணப்பிக்கத் தொடங்கலாம்!`;
    const options = [
        { label: "🚀 இ-சேவை போர்ட்டலில் விண்ணப்பிக்கத் தொடங்கு", value: "START_COMMUNITY_APPLY" },
        { label: "✏️ விவரங்களைச் சரிபார் / திருத்து (Edit Details)", value: "TRIGGER_EDIT_MODAL" },
        { label: "🔄 புதிய விண்ணப்பம் தொடங்க (Reset)", value: "reset" }
    ];
    return { text: welcomeText, options, step: sess.intakeState };
}

module.exports = {
    TNEGA_PORTAL_SCHEMAS,
    advanceTnegaIncomeFlow,
    advanceTnegaCanRegisterFlow,
    advanceTnegaResidenceFlow,
    advanceTnegaCommunityFlow
};
