/**
 * eSevaDraft Strict AI Document Verification Engine
 * Module: src/services/document_validator.js
 * 
 * Enforces Golden Rule 14: Strict AI Document Verification & Wrong-Document Rejection Law.
 * Inspects uploaded documents via Vision AI and strictly validates whether the document
 * matches the required slot (e.g. Community Certificate, School TC, Aadhaar, Gas Book, Photo).
 * Completely rejects mismatched documents with clear, actionable Tamil feedback.
 */

const DOC_NAMES_TAMIL = {
    'AADHAAR_FULL': 'முழு ஆதார் அட்டை (Aadhaar Full Letter)',
    'AADHAAR_FRONT': 'ஆதார் அட்டை முன்பக்கம் (Aadhaar Front)',
    'AADHAAR_BACK': 'ஆதார் அட்டை பின்பக்கம் (Aadhaar Back)',
    'SMART_CARD': 'ஸ்மார்ட் குடும்ப அட்டை (Smart Ration Card)',
    'SMART_CARD_FRONT': 'ஸ்மார்ட் குடும்ப அட்டை முன்பக்கம் (Smart Card Front)',
    'SMART_CARD_BACK': 'ஸ்மார்ட் குடும்ப அட்டை பின்பக்கம் (Smart Card Back)',
    'COMMUNITY_CERTIFICATE': 'சாதிச் சான்றிதழ் (Community Certificate)',
    'TRANSFER_CERTIFICATE': 'பள்ளி / கல்லூரி மாற்றுச் சான்றிதழ் (School / College TC)',
    'SCHOOL_TC': 'பள்ளி மாற்றுச் சான்றிதழ் (School TC)',
    'GAS_BOOK': 'எரிவாயு நுகர்வோர் அட்டை (Gas Book)',
    'PROPERTY_TAX': 'சொத்து வரி / வீட்டு வரி ரசீது (Property Tax)',
    'EB_BILL': 'மின் கட்டண ரசீது (EB Bill)',
    'RENT_AGREEMENT': 'வாடகை ஒப்பந்தம் (Rent Agreement)',
    'WATER_TAX': 'குடிநீர் வரி ரசீது (Water Tax)',
    'BANK_PASSBOOK': 'வங்கி கணக்குப் புத்தகம் (Bank Passbook)',
    'BIRTH_CERTIFICATE': 'பிறப்புச் சான்றிதழ் (Birth Certificate)',
    'DEATH_CERTIFICATE': 'இறப்புச் சான்றிதழ் (Death Certificate)',
    'PASSPORT_PHOTO': 'முகப் புகைப்படம் (Passport Photo)',
    'UNKNOWN': 'அடையாளம் தெரியாத ஆவணம்'
};

function getDocNameTamil(docType) {
    return DOC_NAMES_TAMIL[docType] || docType || 'ஆவணம்';
}

/**
 * Validates an uploaded document against its intended slot.
 * @param {string} slotName - The target document slot (e.g., 'communityProof', 'headAadhaar', 'residenceProof', etc.)
 * @param {object} extracted - Result from inspectAndExtractDocument
 * @returns {{ valid: boolean, detectedType: string, detectedNameTamil: string, errorTamil?: string }}
 */
function validateUploadedDocument(slotName, extracted) {
    if (!extracted) {
        return { valid: true, detectedType: 'UNKNOWN', detectedNameTamil: 'ஆவணம்' };
    }

    const docType = String(extracted.documentType || 'UNKNOWN').trim();
    const detectedNameTamil = getDocNameTamil(docType);

    // 1. COMMUNITY PROOF (TNeGA REV-101 / REV-115 OBC Community Certificate / TC)
    if (slotName === 'communityProof' || slotName === 'communityCertificate' || slotName === 'COMMUNITY_PROOF_WAIT' || slotName === 'OBC_COMMUNITY_PROOF_WAIT') {
        const isAadhaar = docType.startsWith('AADHAAR_') || extracted.isFullAadhaar || (extracted.aadhaarNumber && !extracted.caste);
        const isPhoto = docType === 'PASSPORT_PHOTO';
        const isUtility = docType === 'EB_BILL' || docType === 'GAS_BOOK' || docType === 'PROPERTY_TAX' || docType === 'WATER_TAX';
        const isRation = docType === 'SMART_CARD';

        if (isAadhaar || isPhoto || isUtility || isRation) {
            return {
                valid: false,
                detectedType: docType,
                detectedNameTamil,
                errorTamil: `❌ **தவறான ஆவணம்! (${detectedNameTamil} நிராகரிக்கப்பட்டது)**\n\n` +
                            `நீங்கள் பதிவேற்றியது **${detectedNameTamil}** ஆகும்.\n\n` +
                            `⚠️ இங்கு **தந்தை / தாய் / உடன்பிறந்தோரின் சாதிச் சான்றிதழ்** அல்லது விண்ணப்பதாரரின் **பள்ளி மாற்றுச் சான்றிதழ் (School TC)** மட்டுமே பதிவேற்றப்பட வேண்டும்.\n\n` +
                            `🛑 ஆதார் அட்டை அல்லது பிற ஆவணங்கள் சாதிச் சான்றாக ஏற்றுக்கொள்ளப்படாது.\n\n` +
                            `தயவுசெய்து சரியான சாதிச் சான்றிதழ் அல்லது டிசி (TC) ஆவணத்தைப் பதிவேற்றவும் (அல்லது ஆவணம் இல்லையெனில் 'ஏற்கெனவே உள்ளது / பிறகு பதிவேற்றுக' என்பதைத் தொடரவும்).`
            };
        }

        const isKnownCommunityDoc = docType === 'COMMUNITY_CERTIFICATE' || 
                                    docType === 'TRANSFER_CERTIFICATE' || 
                                    docType === 'SCHOOL_TC' ||
                                    Boolean(extracted.caste || extracted.subCaste);

        if (!isKnownCommunityDoc && docType === 'UNKNOWN') {
            return {
                valid: false,
                detectedType: docType,
                detectedNameTamil,
                errorTamil: `❌ **சாதி விவரங்கள் இல்லாத ஆவணம்!**\n\n` +
                            `பதிவேற்றப்பட்ட ஆவணத்தில் சாதிப் பிரிவு அல்லது பள்ளி மாற்றுச் சான்றிதழ் (TC) விவரங்கள் எதுவும் கண்டறியப்படவில்லை.\n\n` +
                            `தயவுசெய்து தெளிவான **சாதிச் சான்றிதழ் (Community Certificate)** அல்லது **பள்ளி மாற்றுச் சான்றிதழ் (School TC)** ஆவணத்தைப் பதிவேற்றவும்.`
            };
        }

        return { valid: true, detectedType: docType, detectedNameTamil };
    }

    // 2. HEAD AADHAAR FRONT (TNPDS / TNeGA)
    if (slotName === 'headAadhaar' || slotName === 'headAadhaarFront' || slotName === 'HEAD_AADHAAR_FRONT') {
        const isAadhaar = docType.startsWith('AADHAAR_') || extracted.isFullAadhaar || Boolean(extracted.aadhaarNumber);
        if (!isAadhaar && docType !== 'UNKNOWN') {
            return {
                valid: false,
                detectedType: docType,
                detectedNameTamil,
                errorTamil: `❌ **தவறான ஆவணம்!** நீங்கள் பதிவேற்றியது **${detectedNameTamil}**.\n\n` +
                            `இங்கு குடும்பத் தலைவரின் **ஆதார் அட்டை (முன்பக்கம் அல்லது முழு ஆதார்)** மட்டுமே பதிவேற்றப்பட வேண்டும்.`
            };
        }
        return { valid: true, detectedType: docType, detectedNameTamil };
    }

    // 3. HEAD AADHAAR BACK
    if (slotName === 'headAadhaarBack' || slotName === 'HEAD_AADHAAR_BACK') {
        const isBackOrFull = docType === 'AADHAAR_BACK' || docType === 'AADHAAR_FULL' || Boolean(extracted.hasAddress);
        if (!isBackOrFull && docType !== 'UNKNOWN') {
            return {
                valid: false,
                detectedType: docType,
                detectedNameTamil,
                errorTamil: `❌ **தவறான ஆவணம்!** நீங்கள் பதிவேற்றியது **${detectedNameTamil}**.\n\n` +
                            `இங்கு முகவரி உள்ள **ஆதார் பின்பக்கத்தை (Back Side)** மட்டுமே பதிவேற்ற வேண்டும்.`
            };
        }
        return { valid: true, detectedType: docType, detectedNameTamil };
    }

    // 4. PASSPORT PHOTO
    if (slotName === 'profilePhoto' || slotName === 'headPhoto' || slotName === 'HEAD_PHOTO') {
        const isDoc = docType.startsWith('AADHAAR_') || docType === 'EB_BILL' || docType === 'GAS_BOOK' || docType === 'SMART_CARD' || docType === 'COMMUNITY_CERTIFICATE';
        if (isDoc || (extracted.faceDetected === false && docType !== 'PASSPORT_PHOTO' && docType !== 'UNKNOWN')) {
            return {
                valid: false,
                detectedType: docType,
                detectedNameTamil,
                errorTamil: `❌ **தவறான ஆவணம்!** நீங்கள் பதிவேற்றியது **${detectedNameTamil}**.\n\n` +
                            `இங்கு விண்ணப்பதாரரின் **முகப் புகைப்படம் (Passport Size Photo)** மட்டுமே பதிவேற்றப்பட வேண்டும்.`
            };
        }
        return { valid: true, detectedType: docType, detectedNameTamil };
    }

    // 5. RESIDENCE PROOF (TNPDS New Card / TNeGA REV-102)
    if (slotName === 'residenceProof' || slotName === 'gasBook' || slotName === 'RESIDENCE_PROOF_DOC' || slotName === 'RESIDENCE_PROOF_WAIT') {
        const isDisallowed = docType.startsWith('AADHAAR_') || docType === 'PASSPORT_PHOTO' || docType === 'COMMUNITY_CERTIFICATE';
        if (isDisallowed) {
            return {
                valid: false,
                detectedType: docType,
                detectedNameTamil,
                errorTamil: `❌ **தவறான ஆவணம்!** நீங்கள் பதிவேற்றியது **${detectedNameTamil}**.\n\n` +
                            `இங்கு எரிவாயு அட்டை (Gas Book), மின்கட்டண ரசீது (EB Bill), வீட்டு வரி ரசீது (Property Tax), அல்லது வாடகை ஒப்பந்தம் மட்டுமே பதிவேற்றப்பட வேண்டும்.`
            };
        }
        return { valid: true, detectedType: docType, detectedNameTamil };
    }

    // 6. INCOME PROOF (TNeGA REV-103 / REV-115 OBC ITR & Income Proof)
    if (slotName === 'incomeProof' || slotName === 'incomeTaxReturn' || slotName === 'salaryCertificate' || slotName === 'INCOME_PROOF_WAIT' || slotName === 'OBC_INCOME_PROOF_WAIT') {
        const isDisallowed = docType.startsWith('AADHAAR_') || docType === 'PASSPORT_PHOTO' || docType === 'COMMUNITY_CERTIFICATE';
        if (isDisallowed) {
            return {
                valid: false,
                detectedType: docType,
                detectedNameTamil,
                errorTamil: `❌ **தவறான ஆவணம்! (${detectedNameTamil} நிராகரிக்கப்பட்டது)**\n\n` +
                            `நீங்கள் பதிவேற்றியது **${detectedNameTamil}** ஆகும்.\n\n` +
                            `⚠️ இங்கு **சம்பளச் சான்று (Salary Certificate), ஊதிய ரசீது (Pay Slip / Bank Statement), அல்லது சுய அறிவிப்புப் படிவம் (Self-Declaration)** மட்டுமே பதிவேற்றப்பட வேண்டும்.\n\n` +
                            `தயவுசெய்து சரியான வருமான ஆதார ஆவணத்தைப் பதிவேற்றவும்.`
            };
        }
        return { valid: true, detectedType: docType, detectedNameTamil };
    }

    // 7. APPLICANT 12TH TC / MARKSHEET (TNeGA REV-104 First Graduate)
    if (slotName === 'applicantEducationProof' || slotName === 'studentTc' || slotName === 'FIRST_GRADUATE_APPLICANT_PROOF_WAIT') {
        const isPhoto = docType === 'PASSPORT_PHOTO';
        const isAadhaar = docType.startsWith('AADHAAR_') || extracted.isFullAadhaar;
        if (isPhoto || isAadhaar) {
            return {
                valid: false,
                detectedType: docType,
                detectedNameTamil,
                errorTamil: `❌ **தவறான ஆவணம்! (${detectedNameTamil} நிராகரிக்கப்பட்டது)**\n\n` +
                            `நீங்கள் பதிவேற்றியது **${detectedNameTamil}** ஆகும்.\n\n` +
                            `⚠️ இங்கு மாணவரின் **12-ஆம் வகுப்பு பள்ளி மாற்றுச் சான்றிதழ் (12th Transfer Certificate - TC)** அல்லது **மதிப்பெண் பட்டியல் (Marksheet)** மட்டுமே பதிவேற்றப்பட வேண்டும்.\n\n` +
                            `தயவுசெய்து சரியான கல்வி ஆவணத்தைப் பதிவேற்றவும்.`
            };
        }
        return { valid: true, detectedType: docType, detectedNameTamil };
    }

    // 8. FAMILY SMART CARD (All 7 TNeGA Revenue Services — Front, Back, or Combined 2-in-1)
    if (slotName === 'smartCard' || slotName === 'smartCardBack' || slotName === 'rationCard' || slotName.endsWith('_SMARTCARD_WAIT') || slotName.endsWith('_SMARTCARD_BACK_WAIT')) {
        const isDisallowed = docType === 'PASSPORT_PHOTO' || docType.startsWith('AADHAAR_');
        if (isDisallowed) {
            return {
                valid: false,
                detectedType: docType,
                detectedNameTamil,
                errorTamil: `❌ **தவறான ஆவணம்!** குடும்ப ரேஷன் அட்டைக்குப் பதிலாக **${detectedNameTamil}** பதிவேற்றப்பட்டுள்ளது.\n\n` +
                            `தயவுசெய்து **குடும்ப ஸ்மார்ட் ரேஷன் கார்டு (Smart Card)** ஆவணத்தைப் பதிவேற்றவும்.`
            };
        }
        return { valid: true, detectedType: docType, detectedNameTamil };
    }

    // 9. PARENTS EDUCATION PROOF (Father / Mother TC or Declaration - TNeGA REV-104)
    if (slotName === 'fatherEducationProof' || slotName === 'motherEducationProof' || slotName === 'fatherTc' || slotName === 'motherTc' || slotName === 'FIRST_GRADUATE_PARENTS_PROOF_WAIT') {
        const isPhoto = docType === 'PASSPORT_PHOTO';
        if (isPhoto) {
            return {
                valid: false,
                detectedType: docType,
                detectedNameTamil,
                errorTamil: `❌ **தவறான ஆவணம்!** பெற்றோர் கல்வி ஆவணத்திற்கு பதிலாக **${detectedNameTamil}** பதிவேற்றப்பட்டுள்ளது.\n\n` +
                            `தயவுசெய்து பெற்றோரின் பள்ளி மாற்றுச் சான்றிதழ் (TC) அல்லது கல்வி ஆவணத்தைப் பதிவேற்றவும்.`
            };
        }
        return { valid: true, detectedType: docType, detectedNameTamil };
    }

    return { valid: true, detectedType: docType, detectedNameTamil };
}

module.exports = {
    validateUploadedDocument,
    getDocNameTamil,
    DOC_NAMES_TAMIL
};
