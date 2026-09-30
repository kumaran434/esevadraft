// ============================================================================
// eSevaDraft Universal Service Checklist Matrix & Registry
// Official Tamil Nadu e-Sevai, TNeGA & Government Portal Specifications
// ============================================================================

const SERVICES_REGISTRY = {
    NEW_RATION_CARD: {
        id: 'NEW_RATION_CARD',
        code: 'TNPDS_NFC',
        nameTamil: 'புதிய ஸ்மார்ட் ரேஷன் கார்டு',
        nameEnglish: 'New Smart Ration Card',
        portal: 'TNPDS (Civil Supplies & Consumer Protection)',
        portalUrl: 'https://www.tnpds.gov.in/pages/newsmartcard',
        totalSteps: 51,
        requiresFamilyMembers: true,
        commonFields: [
            { key: 'fullNameEng', label: 'குடும்பத் தலைவர் பெயர் (ஆங்கிலம்)' },
            { key: 'fullNameTam', label: 'குடும்பத் தலைவர் பெயர் (தமிழ்)' },
            { key: 'fatherNameEng', label: 'தந்தை / கணவர் பெயர் (ஆங்கிலம்)' },
            { key: 'fatherNameTam', label: 'தந்தை / கணவர் பெயர் (தமிழ்)' },
            { key: 'headDob', label: 'பிறந்த தேதி' },
            { key: 'headGender', label: 'பாலினம்' },
            { key: 'doorNo', label: 'கதவு எண்' },
            { key: 'streetEng', label: 'தெருப் பெயர் (ஆங்கிலம்)' },
            { key: 'streetTam', label: 'தெருப் பெயர் (தமிழ்)' },
            { key: 'district', label: 'மாவட்டம்' },
            { key: 'taluk', label: 'வட்டம் (Taluk)' },
            { key: 'village', label: 'வருவாய் கிராமம் (Village)' },
            { key: 'pincode', label: 'அஞ்சல் குறியீட்டு எண் (Pincode)' },
            { key: 'headAadhaar', label: 'குடும்பத் தலைவர் ஆதார் எண்' }
        ],
        specificFields: [
            { key: 'cardType', label: 'அட்டை வகை (அரிசி / சர்க்கரை / பண்டமில்லா)', default: 'RICE' },
            { key: 'gasDetails.cylinderCount', label: 'எரிவாயு இணைப்பு எண்ணிக்கை', default: '1' }
        ],
        requiredDocuments: [
            { key: 'profilePhoto', label: 'குடும்பத் தலைவர் பாஸ்போர்ட் புகைப்படம் (வெள்ளை பின்னணி)', format: 'image' },
            { key: 'headAadhaar', label: 'குடும்பத் தலைவர் அசல் ஆதார் அட்டை', format: 'pdf' },
            { key: 'gasBook', label: 'எரிவாயு நுகர்வோர் அட்டை / குடியிருப்புச் சான்று', format: 'pdf' },
            { key: 'memberAadhaars', label: 'குடும்ப உறுப்பினர்களின் தனித்தனி ஆதார் அட்டைகள்', format: 'pdf', multiple: true }
        ]
    },

    INCOME_CERTIFICATE: {
        id: 'INCOME_CERTIFICATE',
        code: 'REV-103',
        nameTamil: 'வருமானச் சான்றிதழ்',
        nameEnglish: 'Income Certificate',
        portal: 'TNeGA Revenue Department (e-Sevai)',
        portalUrl: 'https://www.tnesevai.tn.gov.in',
        totalSteps: 18,
        requiresFamilyMembers: false,
        commonFields: [
            { key: 'fullNameEng', label: 'விண்ணப்பதாரர் பெயர் (ஆங்கிலம்)' },
            { key: 'fullNameTam', label: 'விண்ணப்பதாரர் பெயர் (தமிழ்)' },
            { key: 'fatherNameEng', label: 'தந்தை / கணவர் பெயர்' },
            { key: 'doorNo', label: 'கதவு எண்' },
            { key: 'streetEng', label: 'தெருப் பெயர்' },
            { key: 'district', label: 'மாவட்டம்' },
            { key: 'taluk', label: 'வட்டம்' },
            { key: 'village', label: 'வருவாய் கிராமம்' },
            { key: 'pincode', label: 'பின்கோடு' },
            { key: 'headAadhaar', label: 'ஆதார் எண்' }
        ],
        specificFields: [
            { key: 'annualIncome', label: 'குடும்ப மொத்த ஆண்டு வருமானம் (Annual Income)', mandatory: true },
            { key: 'profession', label: 'தொழில் (Occupation / Profession)', mandatory: true },
            { key: 'purpose', label: 'சான்றிதழ் தேவைப்படும் நோக்கம் (Purpose)', mandatory: false }
        ],
        requiredDocuments: [
            { key: 'profilePhoto', label: 'விண்ணப்பதாரர் புகைப்படம்', format: 'image' },
            { key: 'headAadhaar', label: 'ஆதார் அட்டை', format: 'pdf' },
            { key: 'incomeProof', label: 'சம்பளச் சான்று அல்லது சுய அறிவிப்புப் படிவம் (Self-declaration)', format: 'pdf' },
            { key: 'rationCard', label: 'குடும்ப ரேஷன் கார்டு', format: 'pdf', optional: true }
        ]
    },

    RESIDENCE_CERTIFICATE: {
        id: 'RESIDENCE_CERTIFICATE',
        code: 'REV-101',
        nameTamil: 'இருப்பிடச் சான்றிதழ்',
        nameEnglish: 'Residence / Nativity Certificate',
        portal: 'TNeGA Revenue Department (e-Sevai)',
        portalUrl: 'https://www.tnesevai.tn.gov.in',
        totalSteps: 16,
        requiresFamilyMembers: false,
        commonFields: [
            { key: 'fullNameEng', label: 'விண்ணப்பதாரர் பெயர்' },
            { key: 'fatherNameEng', label: 'தந்தை / கணவர் பெயர்' },
            { key: 'doorNo', label: 'கதவு எண்' },
            { key: 'streetEng', label: 'தெருப் பெயர்' },
            { key: 'district', label: 'மாவட்டம்' },
            { key: 'taluk', label: 'வட்டம்' },
            { key: 'village', label: 'வருவாய் கிராமம்' },
            { key: 'pincode', label: 'பின்கோடு' },
            { key: 'headAadhaar', label: 'ஆதார் எண்' }
        ],
        specificFields: [
            { key: 'yearsOfResidence', label: 'தமிழ்நாட்டில் தொடர்ந்து வசிக்கும் வருடங்கள் (Years of Continuous Residence)', mandatory: true, default: '5+' }
        ],
        requiredDocuments: [
            { key: 'profilePhoto', label: 'விண்ணப்பதாரர் புகைப்படம்', format: 'image' },
            { key: 'headAadhaar', label: 'ஆதார் அட்டை', format: 'pdf' },
            { key: 'residenceProof', label: 'முகவரிச் சான்று (மின் கட்டணம் / வீட்டு வரி / கேஸ் அட்டை)', format: 'pdf' }
        ]
    },

    COMMUNITY_CERTIFICATE: {
        id: 'COMMUNITY_CERTIFICATE',
        code: 'REV-102',
        nameTamil: 'சாதிச் சான்றிதழ்',
        nameEnglish: 'Community Certificate',
        portal: 'TNeGA Revenue Department (e-Sevai)',
        portalUrl: 'https://www.tnesevai.tn.gov.in',
        totalSteps: 20,
        requiresFamilyMembers: false,
        commonFields: [
            { key: 'fullNameEng', label: 'விண்ணப்பதாரர் பெயர்' },
            { key: 'fatherNameEng', label: 'தந்தை / கணவர் பெயர்' },
            { key: 'doorNo', label: 'கதவு எண்' },
            { key: 'streetEng', label: 'தெருப் பெயர்' },
            { key: 'district', label: 'மாவட்டம்' },
            { key: 'taluk', label: 'வட்டம்' },
            { key: 'village', label: 'வருவாய் கிராமம்' },
            { key: 'pincode', label: 'பின்கோடு' },
            { key: 'headAadhaar', label: 'ஆதார் எண்' }
        ],
        specificFields: [
            { key: 'religion', label: 'மதம் (Religion)', mandatory: true, default: 'இந்து (Hindu)' },
            { key: 'community', label: 'சமூகம் (Community - BC/MBC/SC/ST)', mandatory: true },
            { key: 'subCaste', label: 'உட்சாதி பிரிவு (Sub-Caste)', mandatory: true }
        ],
        requiredDocuments: [
            { key: 'profilePhoto', label: 'விண்ணப்பதாரர் புகைப்படம்', format: 'image' },
            { key: 'headAadhaar', label: 'ஆதார் அட்டை', format: 'pdf' },
            { key: 'communityProof', label: 'பள்ளி மாற்றுச் சான்றிதழ் (TC) அல்லது பெற்றோர் சாதிச் சான்றிதழ்', format: 'pdf' }
        ]
    },

    VOTER_ID: {
        id: 'VOTER_ID',
        code: 'NVSP-FORM-6',
        nameTamil: 'புதிய வாக்காளர் அட்டை',
        nameEnglish: 'New Voter ID (Form 6)',
        portal: 'Election Commission of India (ECI / NVSP)',
        portalUrl: 'https://voters.eci.gov.in',
        totalSteps: 24,
        requiresFamilyMembers: false,
        commonFields: [
            { key: 'fullNameEng', label: 'விண்ணப்பதாரர் பெயர்' },
            { key: 'headDob', label: 'பிறந்த தேதி' },
            { key: 'headGender', label: 'பாலினம்' },
            { key: 'doorNo', label: 'கதவு எண்' },
            { key: 'streetEng', label: 'தெருப் பெயர்' },
            { key: 'district', label: 'மாவட்டம்' },
            { key: 'taluk', label: 'வட்டம்' },
            { key: 'village', label: 'கிராமம் / வார்டு' },
            { key: 'pincode', label: 'பின்கோடு' },
            { key: 'headAadhaar', label: 'ஆதார் எண்' }
        ],
        specificFields: [
            { key: 'assemblyConstituency', label: 'சட்டமன்றத் தொகுதி (Assembly Constituency)', mandatory: true }
        ],
        requiredDocuments: [
            { key: 'profilePhoto', label: 'பாஸ்போர்ட் புகைப்படம்', format: 'image' },
            { key: 'headAadhaar', label: 'ஆதார் அட்டை (வயது மற்றும் இருப்பிடச் சான்று)', format: 'pdf' }
        ]
    }
};

/**
 * Helper to safely extract nested or direct values from profile
 */
function getProfileValue(profile, key) {
    if (!profile) return null;
    if (key.includes('.')) {
        const parts = key.split('.');
        let val = profile;
        for (const p of parts) {
            if (val && typeof val === 'object') val = val[p];
            else return null;
        }
        return val || null;
    }
    return profile[key] || null;
}

/**
 * Evaluates the real-time checklist for a given service against a citizen profile and uploaded docs.
 * Returns completedItems, missingItems, isReady, and a user-friendly Tamil summary.
 */
function evaluateServiceChecklist(serviceId, profile = {}, base64Docs = {}) {
    const sId = (serviceId || '').trim().toUpperCase();
    const service = SERVICES_REGISTRY[sId] || SERVICES_REGISTRY.NEW_RATION_CARD;

    const completed = [];
    const missing = [];

    // 1. Audit Common Profile Fields
    for (const field of service.commonFields) {
        const val = getProfileValue(profile, field.key);
        if (val && String(val).trim().length > 0 && String(val).trim() !== 'FATHER') {
            completed.push({
                category: 'COMMON_FIELD',
                key: field.key,
                label: field.label,
                value: String(val).trim(),
                status: 'DONE'
            });
        } else {
            missing.push({
                category: 'COMMON_FIELD',
                key: field.key,
                label: field.label,
                status: 'PENDING'
            });
        }
    }

    // 2. Audit Service Specific Delta Fields
    for (const field of service.specificFields) {
        const val = getProfileValue(profile, field.key) || field.default;
        if (val && String(val).trim().length > 0) {
            completed.push({
                category: 'SPECIFIC_FIELD',
                key: field.key,
                label: field.label,
                value: String(val).trim(),
                status: 'DONE'
            });
        } else {
            missing.push({
                category: 'SPECIFIC_FIELD',
                key: field.key,
                label: field.label,
                status: 'PENDING'
            });
        }
    }

    // 3. Audit Mandatory Documents
    for (const doc of service.requiredDocuments) {
        let isPresent = false;
        if (doc.key === 'memberAadhaars') {
            const memCount = (profile.members && profile.members.length > 1) ? profile.members.length - 1 : 0;
            const b64Count = (base64Docs.memberAadhaarsBase64 && Array.isArray(base64Docs.memberAadhaarsBase64)) ? base64Docs.memberAadhaarsBase64.length : 0;
            isPresent = memCount === 0 || b64Count >= memCount;
        } else {
            const b64 = base64Docs[`${doc.key}Base64`] || base64Docs[doc.key];
            const directPath = profile[doc.key] || profile.documents?.[doc.key];
            isPresent = Boolean((b64 && b64.length > 50) || directPath || doc.optional);
        }

        if (isPresent) {
            completed.push({
                category: 'DOCUMENT',
                key: doc.key,
                label: doc.label,
                status: 'DONE'
            });
        } else {
            missing.push({
                category: 'DOCUMENT',
                key: doc.key,
                label: doc.label,
                status: 'PENDING'
            });
        }
    }

    const totalItems = completed.length + missing.length;
    const isReady = missing.length === 0;
    const summaryTamil = isReady
        ? `🎉 அனைத்து ${totalItems} விவரங்களும் தயாராக உள்ளன! விண்ணப்பம் சமர்ப்பிக்கப்படலாம்.`
        : `📋 ${completed.length}/${totalItems} விவரங்கள் பூர்த்தியாகியுள்ளன (${missing.length} விவரங்கள் விடுபட்டுள்ளன).`;

    return {
        serviceId: service.id,
        serviceName: service.nameTamil,
        portal: service.portal,
        isReady,
        totalItems,
        completedCount: completed.length,
        missingCount: missing.length,
        completedItems: completed,
        missingItems: missing,
        summaryTamil
    };
}

function getAllServices() {
    return Object.values(SERVICES_REGISTRY).map(s => ({
        id: s.id,
        code: s.code,
        nameTamil: s.nameTamil,
        nameEnglish: s.nameEnglish,
        portal: s.portal,
        portalUrl: s.portalUrl,
        totalSteps: s.totalSteps,
        requiresFamilyMembers: s.requiresFamilyMembers
    }));
}

function getServiceMetadata(serviceId) {
    const sId = (serviceId || '').trim().toUpperCase();
    return SERVICES_REGISTRY[sId] || null;
}

module.exports = {
    SERVICES_REGISTRY,
    evaluateServiceChecklist,
    getAllServices,
    getServiceMetadata
};
