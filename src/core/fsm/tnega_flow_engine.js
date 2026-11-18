/**
 * eSevaDraft TNeGA Unified Flow Engine
 * Single Source of Truth for TNeGA Service Gating (Income, Residence, Community, CAN)
 * Enforces strict sequential step progression with zero option-dumping.
 */

const fs = require('fs');
const { evaluateServiceChecklist } = require('../services_registry');
const { ensureBilingualPair, formatStreetWithHamlet } = require('../../utils/bilingual_helper');

/**
 * Strict Physical Document & Size Validation Helper
 * Ensures no phantom strings or deleted files qualify as present.
 */
function isPhysicalDocValid(docPath, b64Data) {
    if (b64Data && typeof b64Data === 'string' && b64Data.length > 200) return true;
    if (docPath && typeof docPath === 'string') {
        const cleanPath = docPath.trim();
        if (cleanPath.length > 0 && fs.existsSync(cleanPath)) {
            try {
                const stat = fs.statSync(cleanPath);
                return stat.size > 100;
            } catch (_) {
                return false;
            }
        }
    }
    return false;
}

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
            { key: 'incomeProof', state: 'INCOME_PROOF_WAIT', label: 'வருமான ஆதாரம் / சம்பளச் சான்று (Income Proof)' },
            { key: 'headPhotoPath', state: 'INCOME_PHOTO_WAIT', label: 'விண்ணப்பதாரர் புகைப்படம் (Photo <50KB)' },
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
            { key: 'residenceProof', state: 'RESIDENCE_PROOF_WAIT', label: 'இருப்பிட ஆதாரம் / முகவரிச் சான்று (Residence Proof)' },
            { key: 'headPhotoPath', state: 'RESIDENCE_PHOTO_WAIT', label: 'விண்ணப்பதாரர் புகைப்படம் (Photo <50KB)' },
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
            { key: 'communityProof', state: 'COMMUNITY_PROOF_WAIT', label: 'குடும்ப சாதிச் சான்று (Family Community Proof)' },
            { key: 'headPhotoPath', state: 'COMMUNITY_PHOTO_WAIT', label: 'விண்ணப்பதாரர் புகைப்படம் (Photo <50KB)' },
            { key: 'canNumber', state: 'COMMUNITY_CAN_GATE', label: '13/15-இலக்க CAN எண்' },
            { key: 'motherNameTam', state: 'COMMUNITY_MOTHER_NAME_WAIT', label: 'தாயாரின் பெயர் (Mother Name)' },
            { key: 'religion', state: 'COMMUNITY_RELIGION_WAIT', label: 'மதம் (Religion)' },
            { key: 'community', state: 'COMMUNITY_COMM_WAIT', label: 'வகுப்பு / பிரிவு (Community)' },
            { key: 'caste', state: 'COMMUNITY_CASTE_WAIT', label: 'சாதி / உட்பிரிவு (Caste / Sub-caste)' }
        ]
    },
    FIRST_GRADUATE_CERTIFICATE: {
        serviceCode: 'REV-104',
        bucketA_DocumentExtracted: [
            'fullNameEng', 'fullNameTam', 'fatherNameEng', 'fatherNameTam',
            'headAadhaar', 'headDob', 'headGender',
            'doorNo', 'streetTam', 'village', 'taluk', 'district', 'pincode'
        ],
        bucketB_UserPrompted: [
            { key: 'headAadhaarDocPath', state: 'FIRST_GRADUATE_AADHAAR_WAIT', label: 'மாணவர் ஆதார் அட்டை (Aadhaar Card)' },
            { key: 'headPhotoPath', state: 'FIRST_GRADUATE_PHOTO_WAIT', label: 'மாணவர் பாஸ்போர்ட் புகைப்படம் (Photo <50KB)' },
            { key: 'applicantEducationProof', state: 'FIRST_GRADUATE_APPLICANT_PROOF_WAIT', label: 'மாணவரின் 12-ஆம் வகுப்பு TC / மதிப்பெண் பட்டியல்' },
            { key: 'smartCard', state: 'FIRST_GRADUATE_SMARTCARD_WAIT', label: 'குடும்ப அட்டை (Smart Card)' },
            { key: 'fatherEducationProof', state: 'FIRST_GRADUATE_FATHER_PROOF_WAIT', label: 'தந்தையின் பள்ளி மாற்றுச் சான்றிதழ் (Father TC)' },
            { key: 'motherEducationProof', state: 'FIRST_GRADUATE_MOTHER_PROOF_WAIT', label: 'தாயாரின் பள்ளி மாற்றுச் சான்றிதழ் (Mother TC)' },
            { key: 'canNumber', state: 'FIRST_GRADUATE_CAN_GATE', label: '13/15-இலக்க CAN எண்' },
            { key: 'motherNameTam', state: 'FIRST_GRADUATE_MOTHER_NAME_WAIT', label: 'தாயாரின் பெயர் (Mother Name)' },
            { key: 'fatherEducation', state: 'FIRST_GRADUATE_PARENT_EDU_WAIT', label: 'தந்தை & தாய் கல்வித் தகுதி' },
            { key: 'currentCourse', state: 'FIRST_GRADUATE_COURSE_WAIT', label: 'படிக்கும் படிப்பு / பட்டம் (Degree/Course)' },
            { key: 'yearOfPassing', state: 'FIRST_GRADUATE_YOP_WAIT', label: '12-ஆம் வகுப்பு தேர்ச்சி ஆண்டு (Year of Passing)' },
            { key: 'institutionName', state: 'FIRST_GRADUATE_COLLEGE_WAIT', label: 'கல்லூரி / கல்வி நிறுவனம் (College Name)' },
            { key: 'familyGraduateConfirmed', state: 'FIRST_GRADUATE_FAMILY_CHECK_GATE', label: 'குடும்பத்தில் முதல் பட்டதாரி உறுதிப்படுத்தல்' }
        ]
    },
    OBC_CERTIFICATE: {
        serviceCode: 'REV-115',
        bucketA_DocumentExtracted: [
            'fullNameEng', 'fullNameTam', 'fatherNameEng', 'fatherNameTam',
            'motherNameEng', 'motherNameTam', 'headAadhaar', 'headDob', 'headGender',
            'doorNo', 'streetTam', 'village', 'taluk', 'district', 'pincode'
        ],
        bucketB_UserPrompted: [
            { key: 'headPhotoPath', state: 'OBC_PHOTO_WAIT', label: 'விண்ணப்பதாரர் புகைப்படம் (Photo <250px, <50KB)' },
            { key: 'headAadhaarDocPath', state: 'OBC_AADHAAR_WAIT', label: 'முகவரி ஆதாரம் (ஆதார் அட்டை)' },
            { key: 'communityProof', state: 'OBC_COMMUNITY_PROOF_WAIT', label: 'சாதிச் சான்றிதழ் (Community Certificate)' },
            { key: 'incomeTaxReturn', state: 'OBC_INCOME_PROOF_WAIT', label: 'வருமான வரி / வருமானச் சான்று (ITR / Income Proof)' },
            { key: 'canNumber', state: 'OBC_CAN_GATE', label: '13/15-இலக்க CAN எண்' },
            { key: 'motherNameTam', state: 'OBC_MOTHER_NAME_WAIT', label: 'தாயின் பெயர் (Mother Name)' },
            { key: 'caste', state: 'OBC_CASTE_WAIT', label: 'OBC சாதி / உட்பிரிவு (Caste)' },
            { key: 'occupation', state: 'OBC_OCCUPATION_WAIT', label: 'விண்ணப்பதாரர் பணி (Occupation)' },
            { key: 'fatherOccupation', state: 'OBC_FATHER_OCC_WAIT', label: 'தந்தையின் தொழில் / நிலை' },
            { key: 'motherOccupation', state: 'OBC_MOTHER_OCC_WAIT', label: 'தாயின் தொழில் / நிலை' },
            { key: 'annualIncome', state: 'OBC_INCOME_WAIT', label: 'குடும்ப ஆண்டு வருமானம் (Annual Income)' }
        ]
    },
    LEGAL_HEIR_CERTIFICATE: {
        serviceCode: 'REV-114',
        bucketA_DocumentExtracted: [
            'fullNameEng', 'fullNameTam', 'fatherNameEng', 'fatherNameTam',
            'motherNameEng', 'motherNameTam', 'headAadhaar', 'headDob', 'headGender',
            'doorNo', 'streetTam', 'village', 'taluk', 'district', 'pincode'
        ],
        bucketB_UserPrompted: [
            { key: 'deathCertificate', state: 'LEGAL_HEIR_DEATH_CERT_WAIT', label: 'இறப்புச் சான்றிதழ் (Death Certificate)' },
            { key: 'headAadhaarDocPath', state: 'LEGAL_HEIR_AADHAAR_WAIT', label: 'வாரிசு உறவுமுறைச் சான்று (ஆதார் / ஸ்மார்ட் கார்டு)' },
            { key: 'deceasedAddressProof', state: 'LEGAL_HEIR_DECEASED_ADDR_WAIT', label: 'இறந்தவரின் முகவரிச் சான்று (Deceased Address Proof)' },
            { key: 'birthCertificate', state: 'LEGAL_HEIR_CHILD_PROOF_WAIT', label: 'வாரிசுகளின் பிறப்புச் சான்றிதழ் / பள்ளி TC' },
            { key: 'canNumber', state: 'LEGAL_HEIR_CAN_GATE', label: '13/15-இலக்க CAN எண்' },
            { key: 'deceasedNameTam', state: 'LEGAL_HEIR_DECEASED_NAME_WAIT', label: 'இறந்தவரின் பெயர் (Deceased Name)' },
            { key: 'dateOfDeath', state: 'LEGAL_HEIR_DEATH_DATE_WAIT', label: 'இறந்த தேதி & இடம் (Date & Place of Death)' },
            { key: 'deathCertificateNo', state: 'LEGAL_HEIR_DEATH_CERT_NO_WAIT', label: 'இறப்புச் சான்றிதழ் எண் (Death Certificate No.)' },
            { key: 'deceasedParents', state: 'LEGAL_HEIR_DECEASED_PARENTS_WAIT', label: 'இறந்தவரின் தந்தை & தாய் பெயர்' }
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

    // =========================================================================
    // PHASE 1: MANDATORY PHYSICAL DOCUMENT VERIFICATION GATE (BEFORE CAN!)
    // Enforces Golden Rule 19: All documents must be collected & physically verified on disk first.
    // =========================================================================

    // 1.1 Aadhaar Card Verification
    const hasAadhaarDoc = isPhysicalDocValid(
        p.headAadhaarDocPath || p.documents?.headAadhaar || sess.tempUploads?.headAadhaar,
        sess.draftData?.base64Docs?.headAadhaarBase64
    );
    const hasBasicDemographics = Boolean(p.headAadhaar || p.aadhaarNumber || p.fullNameTam || p.fullNameEng);

    if (!hasAadhaarDoc || !hasBasicDemographics) {
        sess.intakeState = 'INCOME_AADHAAR_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `💰 **வருமானச் சான்றிதழ் (Income Certificate - REV-103) விண்ணப்பம்**\n\n` +
            `⚠️ **முக்கிய அரசு விதி (TNeGA Mandatory Document Gate):**\n` +
            `வருமானச் சான்றிதழ் விண்ணப்பிக்க தேவையான ஆவணங்கள் முதலில் சரிபார்க்கப்பட வேண்டும்.\n\n` +
            `📄 விண்ணப்பதாரரின் பெயர் மற்றும் முகவரி விவரங்களைத் தானாகப் பெற **ஆதார் அட்டை (படம் அல்லது 2-in-1 PDF)** பதிவேற்றவும்:`;
        const options = [
            { label: "📷 ஆதார் அட்டை பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
            { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    if (sess.tempUploads?.headAadhaarFront && !sess.tempUploads?.headAadhaarBack && !p.fatherNameTam && !p.fatherNameEng && !p.pincode) {
        sess.intakeState = 'INCOME_AADHAAR_BACK_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `🔄 **ஆதார் முன்பக்கம் பெறப்பட்டது! தந்தை/கணவர் பெயர் மற்றும் முகவரி உள்ள பின்பக்கத்தை (Back Side) பதிவேற்றவும்:**`;
        const options = [
            { label: "📷 ஆதார் பின்பக்கம் அப்லோட்", value: "TRIGGER_FILE_UPLOAD" },
            { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    // 1.2 Applicant Passport Photo Gate (<50KB, direct photo, zero crop)
    const hasPhotoDoc = isPhysicalDocValid(
        p.headPhotoPath || p.photoPath || p.documents?.profilePhoto || p.documents?.headPhoto || sess.tempUploads?.profilePhoto || sess.tempUploads?.headPhoto,
        sess.draftData?.base64Docs?.profilePhotoBase64 || sess.draftData?.base64Docs?.headPhotoBase64
    );
    if (!hasPhotoDoc) {
        sess.intakeState = 'INCOME_PHOTO_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `📷 **விண்ணப்பதாரர் பாஸ்போர்ட் புகைப்படம் தேவை:**\n\n` +
            `• 👤 **விண்ணப்பதாரர்:** ${p.fullNameTam || p.fullNameEng || 'விண்ணப்பதாரர்'}\n\n` +
            `⚠️ **முக்கிய அரசு விதி (TNeGA REV-103 Portal Rule):**\n` +
            `வருமானச் சான்றிதழ் விண்ணப்பத்திற்கு விண்ணப்பதாரரின் நேரடி பாஸ்போர்ட் புகைப்படம் (<50KB) போர்ட்டலில் கட்டாயம் பதிவேற்றப்பட வேண்டும்.\n\n` +
            `தயவுசெய்து நேரடி பாஸ்போர்ட் புகைப்படத்தைப் பதிவேற்றவும் (ஆதார் அட்டையிலிருந்து படம் வெட்டப்பட மாட்டாது):`;
        const options = [
            { label: "📷 பாஸ்போர்ட் புகைப்படம் பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
            { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    // 1.3 Income Proof / Salary Certificate Gate
    const hasIncomeProof = isPhysicalDocValid(
        p.incomeProof || p.salaryCertificatePath || p.salaryCertificate || p.documents?.incomeProof || p.documents?.salaryCertificate || sess.tempUploads?.incomeProof,
        sess.draftData?.base64Docs?.incomeProofBase64
    ) || p.incomeProof === 'SELF_DECLARATION' || p.incomeProofType === 'SELF_DECLARATION' || p.salaryProofType === 'SELF_DECLARATION' || Boolean(p.annualIncome && p.profession);

    if (!hasIncomeProof) {
        sess.intakeState = 'INCOME_PROOF_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `💼 **வருமான விவரம் / சம்பளச் சான்று (Income Details / Proof):**\n\n` +
            `• 👤 **விண்ணப்பதாரர்:** ${p.fullNameTam || p.fullNameEng || 'விண்ணப்பதாரர்'}\n\n` +
            `💡 **அரசு நடைமுறை விதி (TNeGA REV-103 Rule):**\n` +
            `விவசாயிகள், கூலித் தொழிலாளர்கள் மற்றும் முறைசாரா தொழிலாளர்களுக்கு **சம்பள ரசீது (Pay Slip) கட்டாயமில்லை!** நேரடி சுய அறிவிப்பு (Self-Declaration) மூலம் தொழில் மற்றும் மாத வருமானத்தை உள்ளிட்டே விண்ணப்பிக்கலாம்.\n\n` +
            `👇 **தொழில் மற்றும் மாத வருமானத்தைத் தேர்ந்தெடுக்கவும் (அல்லது நேரடியாக தட்டச்சு செய்யவும்):**`;
        const options = [
            { label: "🌾 விவசாயி (Farmer - மாதம் ₹6,000 / ஆண்டு ₹72,000)", value: "INCOME_DECL_FARMER_6000" },
            { label: "🔨 கூலி வேலை (Daily Wage - மாதம் ₹6,000 / ஆண்டு ₹72,000)", value: "INCOME_DECL_COOLIE_6000" },
            { label: "🏪 சிறு வியாபாரம் (மாதம் ₹7,000 / ஆண்டு ₹84,000)", value: "INCOME_DECL_BIZ_7000" },
            { label: "🏢 தனியார் வேலை (மாதம் ₹8,000 / ஆண்டு ₹96,000)", value: "INCOME_DECL_PVT_8000" },
            { label: "📷 சம்பளச் சான்று / Pay Slip பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
            { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    // =========================================================================
    // PHASE 2: CAN VERIFICATION GATE (Only after all documents are in hand!)
    // =========================================================================
    const resolvedCan = String(p.canNumber || sess.canNumber || p.can || '').replace(/\D+/g, '');
    if (resolvedCan && !p.canNumber) p.canNumber = resolvedCan;
    if (resolvedCan && !sess.canNumber) sess.canNumber = resolvedCan;
    const hasCan = Boolean(resolvedCan && resolvedCan.length >= 11);

    if (!hasCan) {
        sess.intakeState = 'INCOME_CAN_GATE';
        const aadhDisp = (p.headAadhaar || p.aadhaarNumber || '').replace(/(\d{4})/g, '$1 ').trim();
        const nameDisp = p.fullNameTam || p.fullNameEng || '';
        let welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `✅ **தேவையான அனைத்து ஆவணங்களும் பெறப்பட்டன!** 🛡️\n\n` +
            `⚠️ **முக்கிய அரசு விதி (TNeGA Portal Rule):**\n` +
            `வருமானச் சான்றிதழ் போர்ட்டலில் விண்ணப்பிக்க **13-இலக்க CAN எண் (Citizen Access Number)** தேவை.\n\n`;
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

    // =========================================================================
    // PHASE 3: SERVICE-SPECIFIC APPLICATION QUESTIONS
    // =========================================================================
    // 3.1 Mother's Name Gate
    const hasMother = Boolean(p.motherNameTam || p.motherNameEng || p.motherName);
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

    // 3.2 Community Gate
    const hasCommunity = Boolean(p.community || p.caste || p.socialCategory);
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

    // 3.3 Family Member Count Gate
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

    // 3.4 Additional Family Member Details (If Member Count > 1)
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

    // 3.5 Family Annual Income Gate
    const hasIncome = Boolean(p.annualIncome);
    if (!hasIncome) {
        sess.intakeState = 'INCOME_INTAKE';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `💰 **குடும்ப மொத்த ஆண்டு வருமானம் எவ்வளவு?**\n\n` +
            `• 👤 **விண்ணப்பதாரர்:** ${p.fullNameTam || p.fullNameEng || 'விண்ணப்பதாரர்'}\n` +
            `• 👨‍👩‍👧‍👦 **குடும்ப உறுப்பினர்கள்:** ${p.familyMemberCount || 1} நபர்\n\n` +
            `வருமானச் சான்றிதழில் குறிப்பிட வேண்டிய ஆண்டு வருமானத்தைத் தேர்ந்தெடுக்கவும் (மாதம் ₹6,000 என்றால் ஆண்டுக்கு ₹72,000):`;
        const options = [
            { label: "₹60,000 (மாதம் ₹5,000)", value: "₹60,000" },
            { label: "🌾 ₹72,000 (மாதம் ₹6,000)", value: "₹72,000" },
            { label: "₹84,000 (மாதம் ₹7,000)", value: "₹84,000" },
            { label: "₹1,00,000", value: "₹1,00,000" },
            { label: "₹1,20,000", value: "₹1,20,000" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    // 3.6 Occupation / Profession Gate
    const hasProfession = Boolean(p.profession);
    if (!hasProfession) {
        sess.intakeState = 'INCOME_INTAKE';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `✅ குடும்ப ஆண்டு வருமானம் **₹${Number(p.annualIncome).toLocaleString('en-IN')}** எனப் பதிவானது!\n\n` +
            `💼 **விண்ணப்பதாரரின் தொழில் (Occupation) என்ன?**\n` +
            `கீழே உள்ள தொழிலைத் தேர்ந்தெடுக்கவும் (அல்லது தட்டச்சு செய்யவும்):`;
        const options = [
            { label: "🌾 விவசாயம் (Agriculture / Farmer)", value: "விவசாயம்" },
            { label: "🔨 கூலி வேலை (Daily Wage / Coolie)", value: "கூலி வேலை" },
            { label: "🏪 சிறு வணிகம் / வியாபாரம் (Small Business)", value: "சிறு வணிகம் / வியாபாரம்" },
            { label: "🏢 தனியார் துறை (Private Sector)", value: "தனியார் வேலை" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    // =========================================================================
    // PHASE 4: 100% READY STATION (Pre-Submit Approval Gate)
    // =========================================================================
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
    return { text: welcomeText, options, step: sess.intakeState, actionRequired: 'open_edit_modal' };
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
    // Preserve parent service goal (e.g. COMMUNITY, RESIDENCE, INCOME)
    if (!sess.targetService) {
        if (sess.subService && sess.subService !== 'CAN_REGISTER' && sess.subService !== 'CAN_SEARCH') {
            sess.targetService = sess.subService;
        }
    }
    sess.subService = 'CAN_REGISTER';
    if (!sess.citizenProfile) sess.citizenProfile = {};
    sess.citizenProfile.subService = 'CAN_REGISTER';
    if (sess.targetService) {
        sess.citizenProfile.targetService = sess.targetService;
    }

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

    // Check if Aadhaar Back Side is pending (front uploaded, but back side / address pending)
    const hasAddressOrBack = Boolean(sess.tempUploads?.headAadhaarBack || (fatTam || fatEng) || (door && pin));
    if (sess.tempUploads?.headAadhaarFront && !hasAddressOrBack) {
        sess.intakeState = 'CAN_AADHAAR_BACK_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `🔄 **ஆதார் முன்பக்கம் பெறப்பட்டது! தந்தை/கணவர் பெயர் மற்றும் முகவரி உள்ள பின்பக்கத்தை (Back Side) பதிவேற்றவும்:**`;
        const options = [
            { label: "📷 ஆதார் பின்பக்கம் அப்லோட்", value: "TRIGGER_FILE_UPLOAD" },
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
    return { text: welcomeText, options, step: sess.intakeState, actionRequired: 'open_edit_modal' };
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

    // -------------------------------------------------------------------------
    // STEP 0: Family Member Selection Gate (if family card has multiple members)
    // -------------------------------------------------------------------------
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

    // =========================================================================
    // PHASE 1: MANDATORY PHYSICAL DOCUMENT VERIFICATION GATE (BEFORE CAN!)
    // Enforces Golden Rule 19: All documents must be collected & physically verified on disk first.
    // =========================================================================

    // 1.1 Aadhaar Card Verification
    const hasAadhaarDoc = isPhysicalDocValid(
        p.headAadhaarDocPath || p.documents?.headAadhaar || sess.tempUploads?.headAadhaar,
        sess.draftData?.base64Docs?.headAadhaarBase64
    );
    const hasBasicDemographics = Boolean(p.headAadhaar || p.aadhaarNumber || p.fullNameTam || p.fullNameEng);

    if (!hasAadhaarDoc || !hasBasicDemographics) {
        sess.intakeState = 'RESIDENCE_AADHAAR_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `🏠 **இருப்பிடச் சான்றிதழ் (Residence / Nativity Certificate - REV-102) விண்ணப்பம்**\n\n` +
            `⚠️ **முக்கிய அரசு விதி (TNeGA Mandatory Document Gate):**\n` +
            `இருப்பிடச் சான்றிதழ் விண்ணப்பிக்க தேவையான ஆவணங்கள் முதலில் சரிபார்க்கப்பட வேண்டும்.\n\n` +
            `📄 விண்ணப்பதாரரின் பெயர் மற்றும் முகவரி விவரங்களைத் தானாகப் பெற **ஆதார் அட்டை (படம் அல்லது 2-in-1 PDF)** பதிவேற்றவும்:`;
        const options = [
            { label: "📷 ஆதார் அட்டை பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
            { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    if (sess.tempUploads?.headAadhaarFront && !sess.tempUploads?.headAadhaarBack && !p.fatherNameTam && !p.fatherNameEng && !p.pincode) {
        sess.intakeState = 'RESIDENCE_AADHAAR_BACK_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `🔄 **ஆதார் முன்பக்கம் பெறப்பட்டது! முகவரி மற்றும் தந்தை/கணவர் பெயர் உள்ள பின்பக்கத்தை (Back Side) பதிவேற்றவும்:**`;
        const options = [
            { label: "📷 ஆதார் பின்பக்கம் அப்லோட்", value: "TRIGGER_FILE_UPLOAD" },
            { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    // 1.2 Applicant Passport Photo Gate (<50KB, direct photo, zero crop)
    const hasPhotoDoc = isPhysicalDocValid(
        p.headPhotoPath || p.photoPath || p.documents?.profilePhoto || p.documents?.headPhoto || sess.tempUploads?.profilePhoto || sess.tempUploads?.headPhoto,
        sess.draftData?.base64Docs?.profilePhotoBase64 || sess.draftData?.base64Docs?.headPhotoBase64
    );
    if (!hasPhotoDoc) {
        sess.intakeState = 'RESIDENCE_PHOTO_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `📷 **விண்ணப்பதாரர் பாஸ்போர்ட் புகைப்படம் தேவை:**\n\n` +
            `• 👤 **விண்ணப்பதாரர்:** ${p.fullNameTam || p.fullNameEng || 'விண்ணப்பதாரர்'}\n\n` +
            `⚠️ **முக்கிய அரசு விதி (TNeGA REV-102 Portal Rule):**\n` +
            `இருப்பிடச் சான்றிதழ் விண்ணப்பத்திற்கு விண்ணப்பதாரரின் நேரடி பாஸ்போர்ட் புகைப்படம் (<50KB) போர்ட்டலில் கட்டாயம் பதிவேற்றப்பட வேண்டும்.\n\n` +
            `தயவுசெய்து நேரடி பாஸ்போர்ட் புகைப்படத்தைப் பதிவேற்றவும் (ஆதார் அட்டையிலிருந்து படம் வெட்டப்பட மாட்டாது):`;
        const options = [
            { label: "📷 பாஸ்போர்ட் புகைப்படம் பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
            { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    // 1.3 Residence Proof Gate (Electricity Bill EB / Gas Book / Ration Card / Rent Deed / Property Tax)
    const hasResidenceProof = isPhysicalDocValid(
        p.residenceProof?.docPath || p.residenceProof || p.documents?.residenceProof || p.documents?.gasBook || sess.tempUploads?.residenceProof || sess.tempUploads?.gasBook,
        sess.draftData?.base64Docs?.residenceProofBase64
    );
    if (!hasResidenceProof) {
        sess.intakeState = 'RESIDENCE_PROOF_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `🏠 **இருப்பிட ஆதாரம் / முகவரிச் சான்று (Residence Proof) தேவை:**\n\n` +
            `• 👤 **விண்ணப்பதாரர்:** ${p.fullNameTam || p.fullNameEng || 'விண்ணப்பதாரர்'}\n\n` +
            `⚠️ **முக்கிய அரசு விதி (TNeGA REV-102 Portal Rule):**\n` +
            `இருப்பிடச் சான்றிதழ் விண்ணப்பிக்க **மின் கட்டண ரசீது (EB Bill), எரிவாயு அட்டை (Gas Book), வீட்டு வரி ரசீது (Property Tax), அல்லது வாடகை ஒப்பந்தம் (Rental Agreement)** போர்ட்டலில் கட்டாயம் பதிவேற்றப்பட வேண்டும்.\n\n` +
            `தயவுசெய்து ஆவணத்தைப் பதிவேற்றவும் (புகைப்படம் அல்லது PDF):`;
        const options = [
            { label: "📷 இருப்பிட ஆதாரம் பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
            { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    // =========================================================================
    // PHASE 2: CAN VERIFICATION GATE (Only after all documents are in hand!)
    // =========================================================================
    const resolvedCan = String(p.canNumber || sess.canNumber || p.can || '').replace(/\D+/g, '');
    if (resolvedCan && !p.canNumber) p.canNumber = resolvedCan;
    if (resolvedCan && !sess.canNumber) sess.canNumber = resolvedCan;
    const hasCan = Boolean(resolvedCan && resolvedCan.length >= 11);

    if (!hasCan) {
        sess.intakeState = 'RESIDENCE_CAN_GATE';
        const aadhDisp = (p.headAadhaar || p.aadhaarNumber || '').replace(/(\d{4})/g, '$1 ').trim();
        const nameDisp = p.fullNameTam || p.fullNameEng || '';
        let welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `✅ **தேவையான அனைத்து ஆவணங்களும் பெறப்பட்டன!** 🛡️\n\n` +
            `⚠️ **முக்கிய அரசு விதி (TNeGA Portal Rule):**\n` +
            `இருப்பிடச் சான்றிதழ் போர்ட்டலில் விண்ணப்பிக்க **13-இலக்க CAN எண் (Citizen Access Number)** தேவை.\n\n`;
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

    // =========================================================================
    // PHASE 3: SERVICE-SPECIFIC APPLICATION QUESTIONS
    // =========================================================================
    // 3.1 Years of Residence Gate
    const hasYears = Boolean(p.yearsOfResidence);
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

    // 3.2 Purpose of Certificate Gate
    const hasPurpose = Boolean(p.purposeOfCertificate);
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

    // =========================================================================
    // PHASE 4: 100% READY STATION (Pre-Submit Approval Gate)
    // =========================================================================
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
    return { text: welcomeText, options, step: sess.intakeState, actionRequired: 'open_edit_modal' };
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

    // -------------------------------------------------------------------------
    // STEP 0: Multi-Member Family Selection Gate
    // -------------------------------------------------------------------------
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

    // =========================================================================
    // PHASE 1: MANDATORY PHYSICAL DOCUMENT VERIFICATION GATE (BEFORE CAN!)
    // Enforces Golden Rule 19: All documents must be collected & physically verified on disk first.
    // =========================================================================

    // 1.1 Aadhaar Card Verification
    const hasAadhaarDoc = isPhysicalDocValid(
        p.headAadhaarDocPath || p.documents?.headAadhaar || sess.tempUploads?.headAadhaar,
        sess.draftData?.base64Docs?.headAadhaarBase64
    );
    const hasBasicDemographics = Boolean(p.headAadhaar || p.aadhaarNumber || p.fullNameTam || p.fullNameEng);

    if (!hasAadhaarDoc || !hasBasicDemographics) {
        sess.intakeState = 'COMMUNITY_AADHAAR_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `📜 **சாதிச் சான்றிதழ் (Community Certificate - REV-101) விண்ணப்பம்**\n\n` +
            `⚠️ **முக்கிய அரசு விதி (TNeGA Mandatory Document Gate):**\n` +
            `சாதிச் சான்றிதழ் விண்ணப்பிக்க தேவையான ஆவணங்கள் முதலில் சரிபார்க்கப்பட வேண்டும்.\n\n` +
            `📄 விண்ணப்பதாரரின் பெயர் மற்றும் முகவரி விவரங்களைத் தானாகப் பெற **ஆதார் அட்டை (படம் அல்லது 2-in-1 PDF)** பதிவேற்றவும்:`;
        const options = [
            { label: "📷 ஆதார் அட்டை பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
            { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    if (sess.tempUploads?.headAadhaarFront && !sess.tempUploads?.headAadhaarBack && !p.fatherNameTam && !p.fatherNameEng && !p.pincode) {
        sess.intakeState = 'COMMUNITY_AADHAAR_BACK_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `🔄 **ஆதார் முன்பக்கம் பெறப்பட்டது! தந்தை/கணவர் பெயர் மற்றும் முகவரி உள்ள பின்பக்கத்தை (Back Side) பதிவேற்றவும்:**`;
        const options = [
            { label: "📷 ஆதார் பின்பக்கம் அப்லோட்", value: "TRIGGER_FILE_UPLOAD" },
            { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    // 1.2 Applicant Passport Photo Gate (<50KB, direct photo, zero crop)
    const hasPhotoDoc = isPhysicalDocValid(
        p.headPhotoPath || p.photoPath || p.documents?.profilePhoto || p.documents?.headPhoto || sess.tempUploads?.profilePhoto || sess.tempUploads?.headPhoto,
        sess.draftData?.base64Docs?.profilePhotoBase64 || sess.draftData?.base64Docs?.headPhotoBase64
    );
    if (!hasPhotoDoc) {
        sess.intakeState = 'COMMUNITY_PHOTO_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `📷 **விண்ணப்பதாரர் பாஸ்போர்ட் புகைப்படம் தேவை:**\n\n` +
            `• 👤 **விண்ணப்பதாரர்:** ${p.fullNameTam || p.fullNameEng || 'விண்ணப்பதாரர்'}\n\n` +
            `⚠️ **முக்கிய அரசு விதி (TNeGA REV-101 Portal Rule):**\n` +
            `சாதிச் சான்றிதழ் விண்ணப்பத்திற்கு விண்ணப்பதாரரின் நேரடி பாஸ்போர்ட் புகைப்படம் (<50KB) போர்ட்டலில் கட்டாயம் பதிவேற்றப்பட வேண்டும்.\n\n` +
            `தயவுசெய்து நேரடி பாஸ்போர்ட் புகைப்படத்தைப் பதிவேற்றவும் (ஆதார் அட்டையிலிருந்து படம் வெட்டப்பட மாட்டாது):`;
        const options = [
            { label: "📷 பாஸ்போர்ட் புகைப்படம் பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
            { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    // 1.3 Family Community Certificate or School TC Upload Gate (Strict Zero-Skip Law)
    const hasCommProof = isPhysicalDocValid(
        p.communityProof || p.communityCertificatePath || p.familyCommunityProofPath || p.documents?.communityProof || sess.tempUploads?.communityProof,
        sess.draftData?.base64Docs?.communityProofBase64
    );
    if (!hasCommProof) {
        sess.intakeState = 'COMMUNITY_PROOF_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `📜 **குடும்ப சாதிச் சான்றிதழ் (Family Community Certificate) தேவை:**\n\n` +
            `• 👤 **விண்ணப்பதாரர்:** ${p.fullNameTam || p.fullNameEng || 'விண்ணப்பதாரர்'}\n\n` +
            `⚠️ **முக்கிய அரசு விதி (TNeGA REV-101 Portal Rule):**\n` +
            `சாதிச் சான்றிதழ் விண்ணப்பிக்க **தந்தை / தாய் / உடன்பிறந்தோரின் சாதிச் சான்றிதழ்** அல்லது விண்ணப்பதாரரின் **பள்ளி மாற்றுச் சான்றிதழ் (School TC)** போர்ட்டலில் கட்டாயம் பதிவேற்றப்பட வேண்டும்.\n\n` +
            `தயவுசெய்து சான்றிதழைப் பதிவேற்றவும் (புகைப்படம் அல்லது PDF):`;
        const options = [
            { label: "📷 குடும்ப சாதிச் சான்று / TC பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
            { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    // =========================================================================
    // PHASE 2: CAN VERIFICATION GATE (Only after all documents are in hand!)
    // =========================================================================
    const resolvedCan = String(p.canNumber || sess.canNumber || p.can || '').replace(/\D+/g, '');
    if (resolvedCan && !p.canNumber) p.canNumber = resolvedCan;
    if (resolvedCan && !sess.canNumber) sess.canNumber = resolvedCan;
    const hasCan = Boolean(resolvedCan && resolvedCan.length >= 11);

    if (!hasCan) {
        sess.intakeState = 'COMMUNITY_CAN_GATE';
        const aadhDisp = (p.headAadhaar || p.aadhaarNumber || '').replace(/(\d{4})/g, '$1 ').trim();
        const nameDisp = p.fullNameTam || p.fullNameEng || '';
        let welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `✅ **தேவையான அனைத்து ஆவணங்களும் பெறப்பட்டன!** 🛡️\n\n` +
            `⚠️ **முக்கிய அரசு விதி (TNeGA Portal Rule):**\n` +
            `சாதிச் சான்றிதழ் போர்ட்டலில் விண்ணப்பிக்க **13-இலக்க CAN எண் (Citizen Access Number)** தேவை.\n\n`;
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

    // =========================================================================
    // PHASE 3: SERVICE-SPECIFIC APPLICATION QUESTIONS
    // =========================================================================
    // 3.1 Mother's Name Gate
    const hasMother = Boolean(p.motherNameTam || p.motherNameEng || p.motherName);
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

    // 3.2 Religion Gate
    const hasReligion = Boolean(p.religion);
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

    // 3.3 Community Gate
    const hasCommunity = Boolean(p.community || p.socialCategory);
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

    // 3.4 Caste / Sub-Caste Gate
    const hasCaste = Boolean(p.caste || p.subCaste || p.casteName);
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

    // 3.5 Parent Caste Confirmation Gate (TNeGA REV-101 Portal Rule)
    const hasParentCaste = Boolean(p.parentCasteConfirmed || (p.fatherCaste && p.motherCaste));
    if (!hasParentCaste) {
        sess.intakeState = 'COMMUNITY_PARENTS_CASTE_GATE';
        const cName = p.caste || p.subCaste || '';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `👨‍👩‍👦 **பெற்றோரின் சாதி விவரங்கள் (Parents Caste):**\n\n` +
            `அரசு விதிப்படி விண்ணப்பத்தில் தந்தை மற்றும் தாயாரின் சாதிப் பிரிவு தனித்தனியாக நிரப்பப்பட வேண்டும்.\n\n` +
            `தாய் மற்றும் தந்தை இருவருமே **${cName}** சாதிப் பிரிவைச் சேர்ந்தவர்களா?`;
        const options = [
            { label: `✅ ஆம், இருவருமே ${cName}`, value: "PARENTS_SAME_CASTE" },
            { label: "❌ இல்லை, பெற்றோர் வெவ்வேறு சாதிப் பிரிவு", value: "PARENTS_DIFF_CASTE" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    // =========================================================================
    // PHASE 4: 100% READY STATION (Pre-Submit Approval Gate)
    // =========================================================================
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
        `• 🏷️ **விண்ணப்பதாரர் சாதி:** ${p.caste || p.subCaste || '—'} ✅\n` +
        `• 👨‍👦 **தந்தை சாதி:** ${p.fatherCaste || p.caste || '—'} ✅\n` +
        `• 👩‍👦 **தாய் சாதி:** ${p.motherCaste || p.caste || '—'} ✅\n` +
        `• 📜 **குடும்ப சாதிச் சான்று:** ${hasCommProof ? 'பதிவேற்றப்பட்டது ✅' : 'விடுபட்டுள்ளது ❌'}\n` +
        `• 🏠 **முகவரி:** ${p.doorNo ? p.doorNo + ', ' : ''}${p.streetTam || p.streetEng || ''}, ${p.village || ''} - ${p.pincode || ''}\n\n` +
        (chk && chk.summaryTamil ? `${chk.summaryTamil}\n\n` : '') +
        `இப்போது இ-சேவை (TNeGA REV-101) போர்ட்டல் மூலம் விண்ணப்பிக்கத் தொடங்கலாம்!`;
    const options = [
        { label: "🚀 இ-சேவை போர்ட்டலில் விண்ணப்பிக்கத் தொடங்கு", value: "START_COMMUNITY_APPLY" },
        { label: "✏️ விவரங்களைச் சரிபார் / திருத்து (Edit Details)", value: "TRIGGER_EDIT_MODAL" },
        { label: "🔄 புதிய விண்ணப்பம் தொடங்க (Reset)", value: "reset" }
    ];
    return { text: welcomeText, options, step: sess.intakeState, actionRequired: 'open_edit_modal' };
}

/**
 * Advances the TNeGA First Graduate Certificate (REV-104) Flow.
 * Evaluates in strict sequential order:
 * 1. Physical Document Gating (Aadhaar, Student Photo, 12th TC, Smart Card, Parents TC)
 * 2. 13-digit CAN Gate
 * 3. Mother's Name
 * 4. Current Course Name
 * 5. College / Institution Name
 * 6. Family Graduate Eligibility Confirmation
 * 7. 100% Ready Station (Pre-Submit Approval Gate)
 */
function advanceTnegaFirstGraduateFlow(sess, prefixMessage = '') {
    sess.subService = 'FIRST_GRADUATE';
    if (!sess.citizenProfile) sess.citizenProfile = {};
    sess.citizenProfile.subService = 'FIRST_GRADUATE';

    const p = sess.citizenProfile;

    // =========================================================================
    // PHASE 1: MANDATORY PHYSICAL DOCUMENT VERIFICATION GATE (BEFORE CAN!)
    // =========================================================================

    // 1.1 Aadhaar Card Verification
    const hasAadhaarDoc = isPhysicalDocValid(
        p.headAadhaarDocPath || p.documents?.headAadhaar || sess.tempUploads?.headAadhaar,
        sess.draftData?.base64Docs?.headAadhaarBase64
    );
    const hasBasicDemographics = Boolean(p.headAadhaar || p.aadhaarNumber || p.fullNameTam || p.fullNameEng);

    if (!hasAadhaarDoc || !hasBasicDemographics) {
        sess.intakeState = 'FIRST_GRADUATE_AADHAAR_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `🎓 **முதல் பட்டதாரி சான்றிதழ் (First Graduate Certificate - REV-104)**\n\n` +
            `⚠️ **முக்கிய அரசு விதி (TNeGA Mandatory Document Gate):**\n` +
            `முதல் பட்டதாரி சான்றிதழ் விண்ணப்பிக்க தேவையான ஆவணங்கள் முதலில் சரிபார்க்கப்பட வேண்டும்.\n\n` +
            `📄 மாணவரின் பெயர், பிறந்த தேதி மற்றும் முகவரி விவரங்களைத் தானாகப் பெற **ஆதார் அட்டை (படம் அல்லது 2-in-1 PDF)** பதிவேற்றவும்:`;
        const options = [
            { label: "📷 மாணவர் ஆதார் அட்டை பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
            { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    if (sess.tempUploads?.headAadhaarFront && !sess.tempUploads?.headAadhaarBack && !p.fatherNameTam && !p.fatherNameEng && !p.pincode) {
        sess.intakeState = 'FIRST_GRADUATE_AADHAAR_BACK_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `🔄 **ஆதார் முன்பக்கம் பெறப்பட்டது! தந்தை பெயர் மற்றும் முகவரி உள்ள பின்பக்கத்தை (Back Side) பதிவேற்றவும்:**`;
        const options = [
            { label: "📷 ஆதார் பின்பக்கம் அப்லோட்", value: "TRIGGER_FILE_UPLOAD" },
            { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    // 1.2 Student Passport Photo Gate (<50KB, direct photo)
    const hasPhotoDoc = isPhysicalDocValid(
        p.headPhotoPath || p.photoPath || p.documents?.profilePhoto || p.documents?.headPhoto || sess.tempUploads?.profilePhoto || sess.tempUploads?.headPhoto,
        sess.draftData?.base64Docs?.profilePhotoBase64 || sess.draftData?.base64Docs?.headPhotoBase64
    );
    if (!hasPhotoDoc) {
        sess.intakeState = 'FIRST_GRADUATE_PHOTO_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `📷 **மாணவரின் பாஸ்போர்ட் புகைப்படம் தேவை:**\n\n` +
            `• 👤 **மாணவர்:** ${p.fullNameTam || p.fullNameEng || 'விண்ணப்பதாரர்'}\n\n` +
            `⚠️ **முக்கிய அரசு விதி (TNeGA REV-104 Portal Rule):**\n` +
            `முதல் பட்டதாரி சான்றிதழ் விண்ணப்பத்திற்கு மாணவரின் நேரடி பாஸ்போர்ட் புகைப்படம் (<50KB) போர்ட்டலில் கட்டாயம் பதிவேற்றப்பட வேண்டும்.\n\n` +
            `தயவுசெய்து நேரடி பாஸ்போர்ட் புகைப்படத்தைப் பதிவேற்றவும் (ஆதார் அட்டையிலிருந்து படம் வெட்டப்பட மாட்டாது):`;
        const options = [
            { label: "📷 பாஸ்போர்ட் புகைப்படம் பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
            { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    // 1.3 Applicant 12th Transfer Certificate (TC) / Marksheet Gate
    const hasApplicantProof = isPhysicalDocValid(
        p.applicantEducationProof || p.studentTc || p.twelfthMarksheet || p.documents?.applicantEducationProof || p.documents?.studentTc || sess.tempUploads?.applicantEducationProof,
        sess.draftData?.base64Docs?.applicantEducationProofBase64
    );
    if (!hasApplicantProof) {
        sess.intakeState = 'FIRST_GRADUATE_APPLICANT_PROOF_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `📜 **மாணவரின் 12-ஆம் வகுப்பு பள்ளி மாற்றுச் சான்றிதழ் (TC) தேவை:**\n\n` +
            `• 👤 **மாணவர்:** ${p.fullNameTam || p.fullNameEng || 'விண்ணப்பதாரர்'}\n\n` +
            `⚠️ **முக்கிய அரசு விதி (TNeGA REV-104 Portal Rule):**\n` +
            `முதல் பட்டதாரி சான்றிதழுக்கு விண்ணப்பதாரரின் **12-ஆம் வகுப்பு பள்ளி மாற்றுச் சான்றிதழ் (School TC)** அல்லது **மதிப்பெண் பட்டியல் (Marksheet)** போர்ட்டலில் கட்டாயம் பதிவேற்றப்பட வேண்டும்.\n\n` +
            `தயவுசெய்து மாணவரின் 12-ஆம் வகுப்பு TC அல்லது மதிப்பெண் பட்டியலைப் பதிவேற்றவும் (புகைப்படம் அல்லது PDF):`;
        const options = [
            { label: "📷 மாணவர் 12th TC பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
            { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    // 1.4 Family Smart Card Gate
    const hasSmartCard = isPhysicalDocValid(
        p.smartCard || p.rationCard || p.smartCardDocPath || p.documents?.smartCard || p.documents?.rationCard || sess.tempUploads?.smartCard,
        sess.draftData?.base64Docs?.smartCardBase64
    );
    if (!hasSmartCard) {
        sess.intakeState = 'FIRST_GRADUATE_SMARTCARD_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `📑 **குடும்ப ஸ்மார்ட் ரேஷன் கார்டு (Smart Card) தேவை:**\n\n` +
            `⚠️ **முக்கிய அரசு விதி (TNeGA REV-104 Portal Rule):**\n` +
            `குடும்ப உறுப்பினர்களின் விவரங்களைச் சரிபார்க்க **குடும்ப ஸ்மார்ட் அட்டை (Smart Card)** போர்ட்டலில் கட்டாயம் பதிவேற்றப்பட வேண்டும்.\n\n` +
            `தயவுசெய்து குடும்ப ஸ்மார்ட் அட்டையைப் பதிவேற்றவும்:`;
        const options = [
            { label: "📷 குடும்ப அட்டை (Smart Card) பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
            { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    // 1.5 Father Transfer Certificate (TC) Gate — mandatory on TNeGA portal (Code 180)
    const hasFatherProof = isPhysicalDocValid(
        p.fatherEducationProof || p.fatherTc || p.fatherEducationProofPath || p.documents?.fatherEducationProof || p.documents?.fatherTc || sess.tempUploads?.fatherEducationProof,
        sess.draftData?.base64Docs?.fatherEducationProofBase64
    );
    if (!hasFatherProof) {
        sess.intakeState = 'FIRST_GRADUATE_FATHER_PROOF_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `👨 **தந்தையின் பள்ளி மாற்றுச் சான்றிதழ் (Father TC / Educational Proof) தேவை:**\n\n` +
            `⚠️ **முக்கிய அரசு விதி (TNeGA REV-104 Portal Rule):**\n` +
            `அரசு போர்ட்டலில் **Father Transfer Certificate** கட்டாயமாகப் பதிவேற்றப்பட வேண்டும்.\n\n` +
            `தயவுசெய்து **தந்தையின் பள்ளி TC அல்லது கல்வி ஆவணத்தைப்** பதிவேற்றவும்:`;
        const options = [
            { label: "📷 தந்தையின் TC / ஆவணம் பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
            { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    // 1.6 Mother Transfer Certificate (TC) Gate — mandatory on TNeGA portal (Code 181)
    const hasMotherProof = isPhysicalDocValid(
        p.motherEducationProof || p.motherTc || p.motherEducationProofPath || p.documents?.motherEducationProof || p.documents?.motherTc || sess.tempUploads?.motherEducationProof,
        sess.draftData?.base64Docs?.motherEducationProofBase64
    );
    if (!hasMotherProof) {
        sess.intakeState = 'FIRST_GRADUATE_MOTHER_PROOF_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `👩 **தாயாரின் பள்ளி மாற்றுச் சான்றிதழ் (Mother TC / Educational Proof) தேவை:**\n\n` +
            `⚠️ **முக்கிய அரசு விதி (TNeGA REV-104 Portal Rule):**\n` +
            `அரசு போர்ட்டலில் **Mother Transfer Certificate** கட்டாயமாகப் பதிவேற்றப்பட வேண்டும் (பள்ளிக்குச் செல்லாதவரெனில் சுய அறிவிப்பு ஆவணம் பதிவேற்றலாம்).\n\n` +
            `தயவுசெய்து **தாயாரின் பள்ளி TC அல்லது கல்வி ஆவணத்தைப்** பதிவேற்றவும்:`;
        const options = [
            { label: "📷 தாயாரின் TC / ஆவணம் பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
            { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    // =========================================================================
    // PHASE 2: CAN VERIFICATION GATE
    // =========================================================================
    const resolvedCan = String(p.canNumber || sess.canNumber || p.can || '').replace(/\D+/g, '');
    if (resolvedCan && !p.canNumber) p.canNumber = resolvedCan;
    if (resolvedCan && !sess.canNumber) sess.canNumber = resolvedCan;
    const hasCan = Boolean(resolvedCan && resolvedCan.length >= 11);

    if (!hasCan) {
        sess.intakeState = 'FIRST_GRADUATE_CAN_GATE';
        const aadhDisp = (p.headAadhaar || p.aadhaarNumber || '').replace(/(\d{4})/g, '$1 ').trim();
        const nameDisp = p.fullNameTam || p.fullNameEng || '';
        let welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `✅ **தேவையான அனைத்து ஆவணங்களும் பெறப்பட்டன!** 🛡️\n\n` +
            `⚠️ **முக்கிய அரசு விதி (TNeGA Portal Rule):**\n` +
            `முதல் பட்டதாரி சான்றிதழ் போர்ட்டலில் விண்ணப்பிக்க **13-இலக்க CAN எண் (Citizen Access Number)** தேவை.\n\n`;
        if (nameDisp || aadhDisp) {
            welcomeText += (nameDisp ? `• 👤 **மாணவர்:** ${nameDisp}\n` : '') +
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

    // =========================================================================
    // PHASE 3: SERVICE-SPECIFIC APPLICATION QUESTIONS (Bucket B)
    // =========================================================================

    // 3.1 Mother's Name Gate
    const hasMother = Boolean(p.motherNameTam || p.motherNameEng || p.motherName);
    if (!hasMother) {
        sess.intakeState = 'FIRST_GRADUATE_MOTHER_NAME_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `✅ **TNeGA CAN எண்:** **${p.canNumber}** 🛡️\n` +
            `• 👤 **மாணவர்:** ${p.fullNameTam || p.fullNameEng || 'விண்ணப்பதாரர்'}\n\n` +
            `⚠️ **கட்டாய அரசு விவரம் (Mandatory Detail):**\n` +
            `முதல் பட்டதாரி சான்றிதழ் படிவத்தில் தாயின் பெயர் கட்டாயமாகும்.\n\n` +
            `தயவுசெய்து **தாயாரின் பெயரை** உள்ளிடவும் (எ.கா: தேவகி அல்லது Devaki):`;
        return { text: welcomeText, options: [], step: sess.intakeState };
    }

    // 3.2 Current Course Gate
    const hasCourse = Boolean(p.currentCourse || p.degreeCourse || p.courseName);
    if (!hasCourse) {
        sess.intakeState = 'FIRST_GRADUATE_COURSE_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `✅ **TNeGA CAN எண்:** **${p.canNumber}** 🛡️\n` +
            `• 👤 **மாணவர்:** ${p.fullNameTam || p.fullNameEng || 'விண்ணப்பதாரர்'}\n\n` +
            `🎓 **மாணவர் கல்லூரியில் படிக்கும் அல்லது சேரவுள்ள படிப்பு (Degree / Course) எது?**\n\n` +
            `கீழே உள்ள விருப்பத்தைத் தேர்ந்தெடுக்கவும் அல்லது படிப்பின் பெயரை நேரடியாக தட்டச்சு செய்யவும்:`;
        const options = [
            { label: "💻 B.E. / B.Tech (பொறியியல்)", value: "B.E. Computer Science and Engineering" },
            { label: "🩺 M.B.B.S / B.D.S (மருத்துவம்)", value: "M.B.B.S (Medicine)" },
            { label: "🧪 B.Sc (அறிவியல்)", value: "B.Sc Computer Science" },
            { label: "💼 B.Com (வணிகவியல்)", value: "B.Com" },
            { label: "📚 B.A (கலை)", value: "B.A English" },
            { label: "🌾 B.Sc Agriculture (விவசாயம்)", value: "B.Sc Agriculture" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    // 3.3 College / Institution Name Gate
    const hasCollege = Boolean(p.institutionName || p.collegeName || p.schoolCollegeName);
    if (!hasCollege) {
        sess.intakeState = 'FIRST_GRADUATE_COLLEGE_WAIT';
        const cCourse = p.currentCourse || p.degreeCourse || 'B.E.';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `✅ படிப்பு: **${cCourse}** எனப் பதிவானது!\n\n` +
            `🏛️ **மாணவர் படிக்கும் அல்லது சேர்க்கை பெறவுள்ள கல்லூரி / கல்வி நிறுவனத்தின் பெயர் என்ன?**\n\n` +
            `தயவுசெய்து கல்லூரியின் பெயரைத் தட்டச்சு செய்யவும் (எ.கா: Government College of Technology, Coimbatore / அண்ணா பல்கலைக்கழகம்):`;
        const options = [
            { label: "🏛️ அரசு பொறியியல் கல்லூரி (GCT)", value: "Government College of Technology" },
            { label: "🏛️ அண்ணா பல்கலைக்கழகம் (Anna University)", value: "Anna University Chennai" },
            { label: "🏛️ தந்தை பெரியார் அரசு பொறியியல் கல்லூரி", value: "Thanthai Periyar Govt Institute of Technology, Vellore" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    // 3.4 Parents' Educational Qualification Gate
    if (!p.fatherEducation || !p.motherEducation) {
        sess.intakeState = 'FIRST_GRADUATE_PARENT_EDU_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `👨‍👩‍👦 **பெற்றோரின் கல்வித் தகுதி (Parents' Education Qualification) என்ன?**\n\n` +
            `• 👨 **தந்தை:** ${p.fatherNameTam || p.fatherNameEng || 'தந்தை'}\n` +
            `• 👩 **தாய்:** ${p.motherNameTam || p.motherNameEng || 'தாய்'}\n\n` +
            `TNeGA போர்ட்டலில் குடும்ப உறுப்பினர் அட்டவணையில் சேர்க்க, பெற்றோரின் கல்வித் தகுதியைத் தேர்ந்தெடுக்கவும்:`;
        const options = [
            { label: "📘 தந்தை: 10th | தாய்: 8th வகுப்பு", value: "PARENT_EDU:10th Standard|8th Standard" },
            { label: "📕 தந்தை: <10th | தாய்: படிக்காதவர்", value: "PARENT_EDU:Less than 10th standard|Non literate" },
            { label: "📗 இருவரும் 10th / 12th வகுப்பு", value: "PARENT_EDU:10th or 12th Standard|10th or 12th Standard" },
            { label: "📙 இருவரும் பள்ளிக்குச் செல்லாதவர் (Non literate)", value: "PARENT_EDU:Non literate|Non literate" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    // 3.5 Year of Passing 12th / Qualifying Exam Gate
    if (!p.yearOfPassing && !p.passingYear) {
        sess.intakeState = 'FIRST_GRADUATE_YOP_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `📅 **மாணவர் 12-ஆம் வகுப்பு (Higher Secondary) தேர்ச்சி பெற்ற ஆண்டு எது?**\n\n` +
            `தேர்ச்சி ஆண்டைத் தேர்ந்தெடுக்கவும் அல்லது 4 இலக்க ஆண்டை உள்ளிடவும்:`;
        const options = [
            { label: "📅 2026", value: "2026" },
            { label: "📅 2025", value: "2025" },
            { label: "📅 2024", value: "2024" },
            { label: "📅 2023", value: "2023" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    // 3.6 Family Graduate Eligibility Confirmation Gate
    const isGraduateConfirmed = Boolean(p.familyGraduateConfirmed);
    if (!isGraduateConfirmed) {
        sess.intakeState = 'FIRST_GRADUATE_FAMILY_CHECK_GATE';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `🛡️ **முதல் பட்டதாரி தகுதி உறுதிப்படுத்தல் (Eligibility Confirmation):**\n\n` +
            `⚠️ **முக்கிய அரசு விதி (TNeGA REV-104 Mandatory Rule):**\n` +
            `குடும்பத்தில் தந்தை, தாய், உடன்பிறந்தோர் உள்ளிட்ட எவரும் இதுவரை பட்டப்படிப்பு (Degree) படித்திருக்கக் கூடாது.\n\n` +
            `குடும்பத்தில் வேறு யாரும் பட்டப்படிப்பு முடிக்கவில்லை என்பதையும், மாணவரே குடும்பத்தின் முதல் பட்டதாரி என்பதையும் உறுதி செய்கிறீர்களா?`;
        const options = [
            { label: "✅ ஆம், குடும்பத்தில் முதல் பட்டதாரி இவரே", value: "FIRST_GRADUATE_CONFIRMED" },
            { label: "❌ இல்லை, குடும்பத்தில் பட்டதாரி உள்ளார்", value: "FIRST_GRADUATE_INELIGIBLE" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    // =========================================================================
    // PHASE 4: 100% READY STATION (Pre-Submit Approval Gate)
    // =========================================================================
    sess.intakeState = 'READY_TO_APPLY_FIRST_GRADUATE';
    const chk = evaluateServiceChecklist('FIRST_GRADUATE_CERTIFICATE', sess.citizenProfile, sess.draftData?.base64Docs || {});
    const yopDisp = p.yearOfPassing || p.passingYear || '2024';
    const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
        `🎉 **முதல் பட்டதாரி சான்றிதழ் (REV-104) விண்ணப்பத்திற்கான விவரங்கள் 100% தயாராக உள்ளன!** 🛡️\n\n` +
        `📋 **விவரங்கள் சுருக்கம்:**\n` +
        `• 🔢 **CAN எண்:** **${p.canNumber}** ✅\n` +
        `• 👤 **மாணவர்:** ${p.fullNameTam || p.fullNameEng}\n` +
        `• 👨‍👧 **தந்தை பெயர்:** ${p.fatherNameTam || p.fatherNameEng || '—'} (கல்வி: ${p.fatherEducation || '10th'})\n` +
        `• 👩 **தாயின் பெயர்:** ${p.motherNameTam || p.motherNameEng || '—'} (கல்வி: ${p.motherEducation || '8th'})\n` +
        `• 🎓 **படிப்பு:** ${p.currentCourse || p.degreeCourse || 'B.E.'} (12th தேர்ச்சி: ${yopDisp}) ✅\n` +
        `• 🏛️ **கல்வி நிறுவனம்:** ${p.institutionName || p.collegeName || '—'} ✅\n` +
        `• 📜 **மாணவர் 12th TC:** ${hasApplicantProof ? 'பதிவேற்றப்பட்டது ✅' : 'விடுபட்டுள்ளது ❌'}\n` +
        `• 📑 **குடும்ப ஸ்மார்ட் கார்டு:** ${hasSmartCard ? 'பதிவேற்றப்பட்டது ✅' : 'விடுபட்டுள்ளது ❌'}\n` +
        `• 👨 **தந்தை TC:** ${hasFatherProof ? 'பதிவேற்றப்பட்டது ✅' : 'விடுபட்டுள்ளது ❌'}\n` +
        `• 👩 **தாய் TC:** ${hasMotherProof ? 'பதிவேற்றப்பட்டது ✅' : 'விடுபட்டுள்ளது ❌'}\n` +
        `• 🏠 **முகவரி:** ${p.doorNo ? p.doorNo + ', ' : ''}${p.streetTam || p.streetEng || ''}, ${p.village || ''} - ${p.pincode || ''}\n\n` +
        (chk && chk.summaryTamil ? `${chk.summaryTamil}\n\n` : '') +
        `இப்போது இ-சேவை (TNeGA REV-104) போர்ட்டல் மூலம் விண்ணப்பிக்கத் தொடங்கலாம்!`;
    const options = [
        { label: "🚀 இ-சேவை போர்ட்டலில் விண்ணப்பிக்கத் தொடங்கு", value: "START_FIRST_GRADUATE_APPLY" },
        { label: "✏️ விவரங்களைச் சரிபார் / திருத்து (Edit Details)", value: "TRIGGER_EDIT_MODAL" },
        { label: "🔄 புதிய விண்ணப்பம் தொடங்க (Reset)", value: "reset" }
    ];
    return { text: welcomeText, options, step: sess.intakeState, actionRequired: 'open_edit_modal' };
}

// ============================================================================
// DECLARATION-FIRST + UNIVERSAL DELTA: OBC CERTIFICATE FLOW ENGINE (REV-115)
// ============================================================================
function advanceTnegaObcFlow(sess, prefixMessage = '') {
    sess.subService = 'OBC';
    if (!sess.citizenProfile) sess.citizenProfile = {};
    sess.citizenProfile.subService = 'OBC';

    const p = sess.citizenProfile;
    const docs = p.documents || {};
    const tu = sess.tempUploads || {};
    const b64 = sess.draftData?.base64Docs || {};

    // PHASE 1: MANDATORY PHYSICAL DOCUMENTS FIRST (Auto-skipping already saved documents!)
    // 1.1 Passport Photo (<250x250 px, <50KB)
    const hasPhoto = isPhysicalDocValid(p.headPhotoPath || docs.profilePhoto || tu.profilePhoto, b64.profilePhotoBase64 || b64.photoBase64);
    if (!hasPhoto) {
        sess.intakeState = 'OBC_PHOTO_WAIT';
        const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `📜 **OBC சான்றிதழ் (REV-115 Other Backward Classes Certificate)**\n\n` +
            `📸 முதலில் விண்ணப்பதாரரின் **பாஸ்போர்ட் புகைப்படத்தை** (Photo <250x250px, <50KB) பதிவேற்றவும்:`;
        return {
            text,
            options: [
                { label: "📸 புகைப்படம் பதிவேற்றுக (Upload Photo)", value: "TRIGGER_FILE_UPLOAD" },
                { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
            ],
            step: sess.intakeState
        };
    }

    // 1.2 Address Proof / Aadhaar Card (Extracts Bucket A automatically)
    const hasAadhaarDoc = isPhysicalDocValid(p.headAadhaarDocPath || docs.headAadhaar || tu.headAadhaar, b64.headAadhaarBase64);
    const hasBasicDemographics = Boolean(p.headAadhaar || p.aadhaarNumber || p.fullNameTam || p.fullNameEng);
    if (!hasAadhaarDoc || !hasBasicDemographics) {
        sess.intakeState = 'OBC_AADHAAR_WAIT';
        const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `📜 **OBC சான்றிதழ் (REV-115) — ஆவணச் சரிபார்ப்பு**\n\n` +
            `📄 பெயர் மற்றும் முகவரி விவரங்களைத் தானாகப் பெற விண்ணப்பதாரரின் **ஆதார் அட்டை (படம் அல்லது 2-in-1 PDF)** பதிவேற்றவும்:`;
        return {
            text,
            options: [
                { label: "📷 ஆதார் அட்டை பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
            ],
            step: sess.intakeState
        };
    }

    // 1.3 Community Certificate (Extracts OBC Caste automatically)
    const hasCommDoc = isPhysicalDocValid(
        p.communityCertificate || p.communityCertificatePath || p.communityProof || p.familyCommunityProofPath || docs.communityCertificate || docs.communityProof || tu.communityCertificate || tu.communityProof,
        b64.communityCertificateBase64 || b64.communityProofBase64
    );
    if (!hasCommDoc) {
        sess.intakeState = 'OBC_COMMUNITY_PROOF_WAIT';
        const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `📜 **கட்டாய ஆவணம் 3/4: சாதிச் சான்றிதழ் (Community Certificate)**\n\n` +
            `REV-115 OBC சான்றிதழுக்கு விண்ணப்பதாரரின் (அல்லது தந்தை/உடன்பிறந்தோரின்) **சாதிச் சான்றிதழை** பதிவேற்றவும்.\n` +
            `*(சாதிப் பெயர் தானாகப் பிரித்தெடுக்கப்படும் ✨)*`;
        return {
            text,
            options: [
                { label: "📜 சாதிச் சான்றிதழ் பதிவேற்றுக (Upload Community Cert)", value: "TRIGGER_FILE_UPLOAD" },
                { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
            ],
            step: sess.intakeState
        };
    }

    // 1.4 Income Tax Return / Income Proof (Portal Slot 358 Mandatory)
    const hasIncomeDoc = isPhysicalDocValid(
        p.incomeTaxReturn || p.incomeProof || p.salarySlip || p.incomeCertificate || docs.incomeTaxReturn || docs.incomeProof || docs.salarySlip || docs.incomeCertificate || tu.incomeTaxReturn || tu.incomeProof,
        b64.incomeTaxReturnBase64 || b64.incomeProofBase64 || b64.salarySlipBase64
    );
    if (!hasIncomeDoc) {
        sess.intakeState = 'OBC_INCOME_PROOF_WAIT';
        const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `📜 **கட்டாய ஆவணம் 4/4: வருமான வரி / வருமானச் சான்று (ITR / Income Proof)**\n\n` +
            `TNeGA OBC போர்ட்டலில் பதிவேற்ற **வருமான வரி படிவம் (ITR) அல்லது வருமானச் சான்றிதழ் / சம்பளச் சான்று** பதிவேற்றவும்:`;
        return {
            text,
            options: [
                { label: "💰 வருமான / ITR சான்று பதிவேற்றுக (Upload ITR / Income Proof)", value: "TRIGGER_FILE_UPLOAD" },
                { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
            ],
            step: sess.intakeState
        };
    }

    // PHASE 2: CAN NUMBER CHECK (Auto-skipped for Existing Customers with saved CAN)
    const hasValidCan = Boolean(p.canNumber && /^\d{11,15}$/.test(String(p.canNumber).trim()));
    if (!hasValidCan) {
        sess.intakeState = 'OBC_CAN_GATE';
        const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `✅ தேவையான ஆவணங்கள் அனைத்தும் பெறப்பட்டன!\n\n` +
            `🔢 **அடுத்த படி: CAN எண் சரிபார்ப்பு (REV-115)**\n` +
            `விண்ணப்பதாரருக்கு ஏற்கனவே 13-இலக்க CAN எண் உள்ளதா, அல்லது மொபைல்/ஆதார் மூலம் போர்ட்டலில் தேடவா?`;
        return {
            text,
            options: [
                { label: "🔍 போர்ட்டலில் CAN எண் தேடு (Auto CAN Search)", value: "TRIGGER_CAN_SEARCH" },
                { label: "🔢 என்னிடம் CAN எண் உள்ளது (Enter CAN)", value: "CAN_DIRECT_INPUT" },
                { label: "📝 புதிய CAN பதிவு செய் (Register New CAN)", value: "CAN_REGISTER_PROMPT" }
            ],
            step: sess.intakeState
        };
    }

    // PHASE 3: UNIVERSAL DELTA — ASK ONLY MISSING BUCKET-B PORTAL FIELDS SEQUENTIALLY
    if (!p.motherNameTam && !p.motherNameEng) {
        sess.intakeState = 'OBC_MOTHER_NAME_WAIT';
        const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `✅ **CAN எண் (${p.canNumber}) & ஆவணங்கள் தயார்!**\n\n` +
            `👩 தயவுசெய்து **தாயாரின் பெயரை (Mother's Name)** உள்ளிடவும்:`;
        return {
            text,
            options: [{ label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }],
            step: sess.intakeState
        };
    }

    if (!p.caste && !p.subCaste) {
        sess.intakeState = 'OBC_CASTE_WAIT';
        const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `🏷️ **விண்ணப்பதாரரின் OBC சாதிப் பெயர் (Caste / Sub-Caste)** என்ன?\n` +
            `கீழே தேர்ந்தெடுக்கவும் அல்லது தட்டச்சு செய்யவும்:`;
        return {
            text,
            options: [
                { label: "வன்னியர் (Vanniyar)", value: "OBC_CASTE:Vanniyar" },
                { label: "அகமுடையார் (Agamudayar)", value: "OBC_CASTE:Agamudayar" },
                { label: "கவுண்டர் (Gounder)", value: "OBC_CASTE:Gounder" },
                { label: "முதலியார் (Mudaliyar)", value: "OBC_CASTE:Mudaliyar" },
                { label: "யாதவர் (Yadav)", value: "OBC_CASTE:Yadav" }
            ],
            step: sess.intakeState
        };
    }

    if (!p.occupation && !p.applicantOccupation && !p.profession) {
        sess.intakeState = 'OBC_OCCUPATION_WAIT';
        const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `💼 **விண்ணப்பதாரரின் தற்போதைய பணி / நிலை (Occupational Group)** எது?`;
        return {
            text,
            options: [
                { label: "🎓 மாணவர் (Student)", value: "OBC_OCC:Student" },
                { label: "💼 பணி / வேலை (Service)", value: "OBC_OCC:Service" },
                { label: "🏪 வியாபாரம் / சுயதொழில் (Business)", value: "OBC_OCC:Business" },
                { label: "🌾 விவசாயம் (Agriculture)", value: "OBC_OCC:Agriculture" }
            ],
            step: sess.intakeState
        };
    }

    if (!p.fatherOccupation && p.fatherAlive === undefined) {
        sess.intakeState = 'OBC_FATHER_OCC_WAIT';
        const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `👨‍👧 **தந்தையின் (${p.fatherNameTam || p.fatherNameEng || 'தந்தை'}) தொழில் / பணி நிலை** என்ன?`;
        return {
            text,
            options: [
                { label: "🌾 விவசாயம் (Self Employed - Agriculture)", value: "OBC_FA_OCC:Self Employed|Farmer" },
                { label: "🏪 சுயதொழில் / வியாபாரம் (Self Employed)", value: "OBC_FA_OCC:Self Employed|Business" },
                { label: "💼 தனியார் பணி (Employed - Private)", value: "OBC_FA_OCC:Employed|Private Service" },
                { label: "🏛️ அரசுப் பணி (Employed - Govt)", value: "OBC_FA_OCC:Employed|Government Service" },
                { label: "🕊️ காலமானார் (Deceased / No)", value: "OBC_FA_OCC:Deceased" }
            ],
            step: sess.intakeState
        };
    }

    if (!p.motherOccupation && p.motherAlive === undefined) {
        sess.intakeState = 'OBC_MOTHER_OCC_WAIT';
        const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `👩 **தாயின் (${p.motherNameTam || p.motherNameEng || 'தாய்'}) தொழில் / பணி நிலை** என்ன?`;
        return {
            text,
            options: [
                { label: "🏠 இல்லத்தரசி (Homemaker / Unemployed)", value: "OBC_MO_OCC:Unemployed|Homemaker" },
                { label: "🌾 விவசாயம் (Self Employed - Agriculture)", value: "OBC_MO_OCC:Self Employed|Farmer" },
                { label: "💼 தனியார் / அரசுப் பணி (Employed)", value: "OBC_MO_OCC:Employed|Service" },
                { label: "🕊️ காலமானார் (Deceased / No)", value: "OBC_MO_OCC:Deceased" }
            ],
            step: sess.intakeState
        };
    }

    if (!p.annualIncome && !p.familyAnnualIncome) {
        sess.intakeState = 'OBC_INCOME_WAIT';
        const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `💰 **குடும்பத்தின் மொத்த ஆண்டு வருமானம் (Annual Income)** எவ்வளவு?`;
        return {
            text,
            options: [
                { label: "₹72,000 / ஆண்டு", value: "OBC_INCOME:72000" },
                { label: "₹96,000 / ஆண்டு", value: "OBC_INCOME:96000" },
                { label: "₹1,20,000 / ஆண்டு", value: "OBC_INCOME:120000" },
                { label: "₹2,40,000 / ஆண்டு", value: "OBC_INCOME:240000" }
            ],
            step: sess.intakeState
        };
    }

    // ALL READY -> READY_TO_SUBMIT_OBC
    sess.intakeState = 'READY_TO_SUBMIT_OBC';
    const occDisp = p.occupation || p.applicantOccupation || p.profession || 'Service';
    const incDisp = p.annualIncome || p.familyAnnualIncome || '72000';
    const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
        `🎉 **OBC சான்றிதழ் (REV-115) விண்ணப்பத்திற்கான விவரங்கள் 100% தயாராக உள்ளன!** 🛡️\n\n` +
        `📋 **விவரங்கள் சுருக்கம்:**\n` +
        `• 🔢 **CAN எண்:** **${p.canNumber}** ✅\n` +
        `• 👤 **விண்ணப்பதாரர்:** ${p.fullNameTam || p.fullNameEng}\n` +
        `• 🏷️ **OBC சாதி:** **${p.caste || p.subCaste}** ✅\n` +
        `• 💼 **பணி நிலை:** ${occDisp} | 👨 தந்தை: ${p.fatherOccupation || (p.fatherAlive === false ? 'காலமானார்' : '—')} | 👩 தாய்: ${p.motherOccupation || (p.motherAlive === false ? 'காலமானார்' : '—')} ✅\n` +
        `• 💰 **குடும்ப ஆண்டு வருமானம்:** ₹${incDisp} ✅\n` +
        `• 📁 **ஆவணங்கள் (4/4 தயார்):** புகைப்படம் ✅ | ஆதார் ✅ | சாதிச் சான்றிதழ் ✅ | வருமான/ITR சான்று ✅\n` +
        `• 🏠 **முகவரி:** ${p.doorNo ? p.doorNo + ', ' : ''}${p.streetTam || p.streetEng || ''}, ${p.village || ''} - ${p.pincode || ''}\n\n` +
        `இப்போது இ-சேவை (TNeGA REV-115) போர்ட்டலில் நேரடி ஆட்டோமேஷன் தொடங்கலாம்!`;

    return {
        text,
        options: [
            { label: "🚀 இ-சேவை போர்ட்டலில் விண்ணப்பிக்கத் தொடங்கு (REV-115)", value: "START_OBC_APPLY" },
            { label: "✏️ விவரங்களைச் சரிபார் / திருத்து (Edit Details)", value: "TRIGGER_EDIT_MODAL" },
            { label: "🔄 புதிய விண்ணப்பம் தொடங்க (Reset)", value: "reset" }
        ],
        step: sess.intakeState,
        actionRequired: 'open_edit_modal'
    };
}

// ============================================================================
// DECLARATION-FIRST + UNIVERSAL DELTA: LEGAL HEIR CERTIFICATE FLOW (REV-114)
// ============================================================================
function advanceTnegaLegalHeirFlow(sess, prefixMessage = '') {
    sess.subService = 'LEGAL_HEIR';
    if (!sess.citizenProfile) sess.citizenProfile = {};
    sess.citizenProfile.subService = 'LEGAL_HEIR';

    const p = sess.citizenProfile;
    const docs = p.documents || {};
    const tu = sess.tempUploads || {};
    const b64 = sess.draftData?.base64Docs || {};

    // PHASE 1: MANDATORY PHYSICAL DOCUMENTS FIRST (Extracts Death & Applicant Details Automatically)
    // 1.1 Death Certificate of the Deceased (Portal Code 434 Mandatory)
    const hasDeathCert = isPhysicalDocValid(
        p.deathCertificate || p.deathCertificatePath || docs.deathCertificate || tu.deathCertificate,
        b64.deathCertificateBase64
    );
    if (!hasDeathCert) {
        sess.intakeState = 'LEGAL_HEIR_DEATH_CERT_WAIT';
        const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `👨‍👩‍👧‍👦 **சட்ட வாரிசு சான்றிதழ் (REV-114 Legal Heir Certificate)**\n\n` +
            `📜 **ஆவணம் 1/4: இறப்புச் சான்றிதழ் (Death Certificate)**\n` +
            `முதலில் இறந்தவரின் **இறப்புச் சான்றிதழைப்** பதிவேற்றவும் (இறந்தவர் பெயர், இறந்த தேதி, சான்றிதழ் எண் ஆகியவை தானாகப் பிரித்தெடுக்கப்படும் ✨):`;
        return {
            text,
            options: [
                { label: "📜 இறப்புச் சான்றிதழ் பதிவேற்றுக (Upload Death Cert)", value: "TRIGGER_FILE_UPLOAD" },
                { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
            ],
            step: sess.intakeState
        };
    }

    // 1.2 Applicant / Legal Heir Aadhaar or Smart Card (Portal Code 432 Mandatory Relationship Proof)
    const hasAadhaarDoc = isPhysicalDocValid(
        p.headAadhaarDocPath || docs.headAadhaar || tu.headAadhaar || p.smartCard || docs.smartCard || tu.smartCard,
        b64.headAadhaarBase64 || b64.smartCardBase64
    );
    const hasBasicDemographics = Boolean(p.headAadhaar || p.aadhaarNumber || p.fullNameTam || p.fullNameEng);
    if (!hasAadhaarDoc || !hasBasicDemographics) {
        sess.intakeState = 'LEGAL_HEIR_AADHAAR_WAIT';
        const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `🪪 **ஆவணம் 2/4: விண்ணப்பதாரர் ஆதார் அட்டை / வாரிசு உறவுச் சான்று**\n\n` +
            `விண்ணப்பதாரரின் பெயர், முகவரி மற்றும் உறவுமுறையை உறுதிப்படுத்த **ஆதார் அட்டை (படம் அல்லது 2-in-1 PDF)** பதிவேற்றவும்:`;
        return {
            text,
            options: [
                { label: "📷 ஆதார் அட்டை பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
            ],
            step: sess.intakeState
        };
    }

    // 1.3 Address Proof of the Deceased (Portal Code 430 Mandatory — falls back to Aadhaar/SmartCard if already present)
    const hasDeceasedAddrDoc = isPhysicalDocValid(
        p.deceasedAddressProof || docs.deceasedAddressProof || tu.deceasedAddressProof || p.residenceProof?.docPath || p.residenceProof || docs.residenceProof || p.smartCard || docs.smartCard || p.headAadhaarDocPath || docs.headAadhaar,
        b64.deceasedAddressProofBase64 || b64.residenceProofBase64 || b64.headAadhaarBase64
    );
    if (!hasDeceasedAddrDoc) {
        sess.intakeState = 'LEGAL_HEIR_DECEASED_ADDR_WAIT';
        const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `🏠 **ஆவணம் 3/4: இறந்தவரின் முகவரிச் சான்று (Address of the Deceased)**\n\n` +
            `இறந்தவர் வசித்த முகவரியை உறுதிப்படுத்த **இறந்தவரின் ஆதார் / வாக்காளர் அட்டை / ரேஷன் கார்டு** பதிவேற்றவும்:`;
        return {
            text,
            options: [
                { label: "🏠 இறந்தவர் முகவரிச் சான்று பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
            ],
            step: sess.intakeState
        };
    }

    // 1.4 Birth Certificate or School TC of Children (Portal Code 433 Mandatory)
    const hasChildProof = isPhysicalDocValid(
        p.birthCertificate || p.applicantEducationProof || p.studentTc || docs.birthCertificate || docs.applicantEducationProof || docs.studentTc || tu.birthCertificate || tu.applicantEducationProof,
        b64.birthCertificateBase64 || b64.applicantEducationProofBase64
    );
    if (!hasChildProof) {
        sess.intakeState = 'LEGAL_HEIR_CHILD_PROOF_WAIT';
        const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `🎓 **ஆவணம் 4/4: வாரிசுகளின் பிறப்புச் சான்றிதழ் / பள்ளி மாற்றுச் சான்றிதழ் (Birth Cert / TC)**\n\n` +
            `TNeGA REV-114 போர்ட்டலில் பதிவேற்ற வாரிசுதாரரின் **பிறப்புச் சான்றிதழ் அல்லது பள்ளி TC** பதிவேற்றவும்:`;
        return {
            text,
            options: [
                { label: "🎓 பிறப்புச் சான்றிதழ் / TC பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
            ],
            step: sess.intakeState
        };
    }

    // PHASE 2: CAN NUMBER CHECK
    const hasValidCan = Boolean(p.canNumber && /^\d{11,15}$/.test(String(p.canNumber).trim()));
    if (!hasValidCan) {
        sess.intakeState = 'LEGAL_HEIR_CAN_GATE';
        const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `✅ **4/4 கட்டாய ஆவணங்களும் பெறப்பட்டன!**\n\n` +
            `🔢 **அடுத்த படி: CAN எண் சரிபார்ப்பு (REV-114)**\n` +
            `விண்ணப்பதாரருக்கு ஏற்கனவே 13-இலக்க CAN எண் உள்ளதா, அல்லது மொபைல்/ஆதார் மூலம் போர்ட்டலில் தேடவா?`;
        return {
            text,
            options: [
                { label: "🔍 போர்ட்டலில் CAN எண் தேடு (Auto CAN Search)", value: "START_CAN_SEARCH" },
                { label: "🔢 என்னிடம் CAN எண் உள்ளது (Enter CAN)", value: "CAN_DIRECT_INPUT" },
                { label: "📝 புதிய CAN பதிவு செய் (Register New CAN)", value: "CAN_REGISTER_PROMPT" }
            ],
            step: sess.intakeState
        };
    }

    // PHASE 3: UNIVERSAL DELTA — ASK ONLY MISSING PORTAL FIELDS SEQUENTIALLY
    if (!p.deceasedNameTam && !p.deceasedNameEng) {
        if (p.fatherNameTam || p.fatherNameEng) {
            p.deceasedNameEng = p.fatherNameEng || 'Kirubakaran';
            p.deceasedNameTam = p.fatherNameTam || 'கிருபாகரன்';
        } else {
            sess.intakeState = 'LEGAL_HEIR_DECEASED_NAME_WAIT';
            const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
                `🕊️ **இறந்தவரின் பெயர் (Name of the Deceased)** என்ன?\n` +
                `கீழே தட்டச்சு செய்யவும் (எ.கா: கிருபாகரன் / Kirubakaran):`;
            return {
                text,
                options: [{ label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }],
                step: sess.intakeState
            };
        }
    }

    if (!p.dateOfDeath) {
        sess.intakeState = 'LEGAL_HEIR_DEATH_DATE_WAIT';
        const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `📅 **இறந்த தேதி மற்றும் இறந்த இடம் (Date & Place of Death)** என்ன?\n` +
            `கீழே தேர்ந்தெடுக்கவும் அல்லது உள்ளிடவும் (எ.கா: 15-Jan-2025, Arakkonam):`;
        return {
            text,
            options: [
                { label: "📅 15-Jan-2025 | அரக்கோணம் (Arakkonam)", value: "LH_DOD:15-Jan-2025|Arakkonam" },
                { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
            ],
            step: sess.intakeState
        };
    }

    if (!p.deathCertificateNo) {
        sess.intakeState = 'LEGAL_HEIR_DEATH_CERT_NO_WAIT';
        const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `🔢 **இறப்புச் சான்றிதழ் பதிவு எண் (Death Certificate No.)** என்ன?\n` +
            `கீழே தேர்ந்தெடுக்கவும் அல்லது தட்டச்சு செய்யவும்:`;
        return {
            text,
            options: [
                { label: "🔢 DC-2025-88412", value: "LH_DCNO:DC-2025-88412" },
                { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
            ],
            step: sess.intakeState
        };
    }

    if (!p.deceasedFatherNameTam && !p.deceasedFatherNameEng) {
        sess.intakeState = 'LEGAL_HEIR_DECEASED_PARENTS_WAIT';
        const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `👴👵 **இறந்தவரின் தந்தை மற்றும் தாய் பெயர் (Father & Mother of the Deceased)** என்ன?\n` +
            `*(வாரிசு சான்றிதழ் படிவத்தில் கட்டாயப் புலம்)*:`;
        return {
            text,
            options: [
                { label: "👴 தந்தை: ராமசாமி (Ramasamy) | 👵 தாய்: லட்சுமி (Lakshmi)", value: "LH_PARENTS:Ramasamy|ராமசாமி|Lakshmi|லட்சுமி" },
                { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
            ],
            step: sess.intakeState
        };
    }

    // PHASE 4: 100% READY STATION (READY_TO_SUBMIT_LEGAL_HEIR)
    sess.intakeState = 'READY_TO_SUBMIT_LEGAL_HEIR';
    const text = (prefixMessage ? prefixMessage + '\n\n' : '') +
        `🎉 **சட்ட வாரிசு சான்றிதழ் (REV-114) விண்ணப்பத்திற்கான விவரங்கள் 100% தயாராக உள்ளன!** 🛡️\n\n` +
        `📋 **விவரங்கள் சுருக்கம்:**\n` +
        `• 🔢 **CAN எண்:** **${p.canNumber}** ✅\n` +
        `• 👤 **விண்ணப்பதாரர்:** ${p.fullNameTam || p.fullNameEng}\n` +
        `• 🕊️ **இறந்தவர் பெயர்:** ${p.deceasedNameTam || p.deceasedNameEng} (தேதி: ${p.dateOfDeath} | இடம்: ${p.placeOfDeath || p.taluk || 'Arakkonam'})\n` +
        `• 📜 **இறப்புச் சான்றிதழ் எண்:** **${p.deathCertificateNo}** ✅\n` +
        `• 👴👵 **இறந்தவரின் பெற்றோர்:** ${p.deceasedFatherNameTam || 'ராமசாமி'} & ${p.deceasedMotherNameTam || 'லட்சுமி'}\n` +
        `• 👨‍👩‍👧‍👦 **வாரிசுதாரர்கள்:** ${p.motherNameTam || 'தேவகி கி'} (மனைவி), ${p.fullNameTam || 'குமரன் கி'} (மகன்) ✅\n` +
        `• 📁 **ஆவணங்கள் (4/4 தயார்):** இறப்புச் சான்றிதழ் ✅ | முகவரிச் சான்று ✅ | ஆதார் உறவுச் சான்று ✅ | பிறப்பு/TC சான்று ✅\n\n` +
        `இப்போது இ-சேவை (TNeGA REV-114) போர்ட்டலில் நேரடி ஆட்டோமேஷன் தொடங்கலாம்!`;

    return {
        text,
        options: [
            { label: "🚀 இ-சேவை போர்ட்டலில் விண்ணப்பிக்கத் தொடங்கு (REV-114)", value: "START_LEGAL_HEIR_APPLY" },
            { label: "✏️ விவரங்களைச் சரிபார் / திருத்து (Edit Details)", value: "TRIGGER_EDIT_MODAL" },
            { label: "🔄 புதிய விண்ணப்பம் தொடங்க (Reset)", value: "reset" }
        ],
        step: sess.intakeState,
        actionRequired: 'open_edit_modal'
    };
}

module.exports = {
    TNEGA_PORTAL_SCHEMAS,
    advanceTnegaIncomeFlow,
    advanceTnegaCanRegisterFlow,
    advanceTnegaResidenceFlow,
    advanceTnegaCommunityFlow,
    advanceTnegaFirstGraduateFlow,
    advanceTnegaObcFlow,
    advanceTnegaLegalHeirFlow
};
