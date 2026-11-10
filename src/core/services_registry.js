// ============================================================================
// eSevaDraft Universal Service Checklist Matrix & Registry
// Official Tamil Nadu e-Sevai, TNeGA & Government Portal Specifications
// ============================================================================

const { SERVICES_REGISTRY } = require('./services_data');


/**
 * Helper to safely extract nested or direct values from profile
 */
function getProfileValue(profile, key) {
    if (!profile) return null;
    if (key === 'motherNameTam') return profile.motherNameTam || profile.motherName || profile.motherNameEng || null;
    if (key === 'motherNameEng') return profile.motherNameEng || profile.motherName || profile.motherNameTam || null;
    if (key === 'fatherNameEng') return profile.fatherNameEng || profile.fatherName || profile.fatherNameTam || null;
    if (key === 'fatherNameTam') return profile.fatherNameTam || profile.fatherName || profile.fatherNameEng || null;
    if (key === 'canNumber') return profile.canNumber || profile.can || null;
    if (key === 'community') return profile.community || profile.caste || profile.socialCategory || null;
    if (key === 'headAadhaar') return profile.headAadhaar || profile.aadhaarNumber || profile.aadhaar || null;
    if (key === 'fullNameEng') return profile.fullNameEng || profile.fullName || profile.headNameEng || null;
    if (key === 'fullNameTam') return profile.fullNameTam || profile.fullName || profile.headNameTam || null;
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
