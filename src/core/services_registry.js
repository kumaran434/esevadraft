// ============================================================================
// eSevaDraft Universal Service Checklist Matrix & Registry
// Official Tamil Nadu e-Sevai, TNeGA & Government Portal Specifications
// ============================================================================

const fs = require('fs');
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
    if (key === 'streetEng') return profile.streetEng || profile.street || profile.streetTam || null;
    if (key === 'streetTam') return profile.streetTam || profile.street || profile.streetEng || null;
    if (key === 'canNumber') return profile.canNumber || profile.can || null;
    if (key === 'community') return profile.community || profile.caste || profile.socialCategory || null;
    if (key === 'headAadhaar') return profile.headAadhaar || profile.aadhaarNumber || profile.aadhaar || null;
    if (key === 'fullNameEng') return profile.fullNameEng || profile.fullName || profile.headNameEng || null;
    if (key === 'fullNameTam') return profile.fullNameTam || profile.fullName || profile.headNameTam || null;
    if (key === 'currentCourse') return profile.currentCourse || profile.degreeCourse || profile.courseName || null;
    if (key === 'institutionName') return profile.institutionName || profile.collegeName || profile.schoolCollegeName || null;
    if (key === 'fatherEducation') return profile.fatherEducation || profile.fatherQualification || null;
    if (key === 'motherEducation') return profile.motherEducation || profile.motherQualification || null;
    if (key === 'yearOfPassing') return profile.yearOfPassing || profile.passingYear || null;
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
            let candidatePaths = [
                profile[doc.key],
                profile.documents?.[doc.key]
            ];
            let candidateB64 = [
                base64Docs[`${doc.key}Base64`],
                base64Docs[doc.key]
            ];

            if (doc.key === 'profilePhoto' || doc.key === 'headPhoto') {
                candidatePaths.push(profile.headPhotoPath, profile.headPhoto, profile.profilePhoto, profile.photoPath, profile.documents?.profilePhoto, profile.documents?.headPhoto);
                candidateB64.push(base64Docs.profilePhotoBase64, base64Docs.headPhotoBase64, base64Docs.profilePhoto, base64Docs.headPhoto);
            } else if (doc.key === 'headAadhaar') {
                candidatePaths.push(profile.headAadhaarDocPath, profile.aadhaarDocPath, profile.documents?.headAadhaar);
                candidateB64.push(base64Docs.headAadhaarBase64, base64Docs.aadhaarBase64);
            } else if (doc.key === 'communityProof') {
                candidatePaths.push(profile.communityProof, profile.communityCertificatePath, profile.familyCommunityProofPath, profile.documents?.communityProof, profile.documents?.communityCertificate, profile.documents?.familyCommunityProof);
                candidateB64.push(base64Docs.communityProofBase64, base64Docs.familyCommunityProofBase64, base64Docs.communityCertificateBase64);
            } else if (doc.key === 'incomeProof') {
                candidatePaths.push(profile.incomeProof, profile.salaryCertificate, profile.salaryCertificatePath, profile.documents?.incomeProof, profile.documents?.salaryCertificate);
                candidateB64.push(base64Docs.incomeProofBase64, base64Docs.salaryCertificateBase64);
                if (profile.incomeProof === 'SELF_DECLARATION' || profile.incomeProofType === 'SELF_DECLARATION' || profile.salaryProofType === 'SELF_DECLARATION' || Boolean(profile.annualIncome && profile.profession)) {
                    isPresent = true;
                }
            } else if (doc.key === 'residenceProof') {
                candidatePaths.push(profile.residenceProof?.docPath, profile.residenceProof, profile.gasDetails?.gasBookPath, profile.gasBook, profile.documents?.residenceProof, profile.documents?.gasBook);
                candidateB64.push(base64Docs.residenceProofBase64, base64Docs.gasBookBase64);
            } else if (doc.key === 'applicantEducationProof') {
                candidatePaths.push(profile.applicantEducationProof, profile.studentTc, profile.twelfthMarksheet, profile.bonafideCertificate, profile.documents?.applicantEducationProof, profile.documents?.studentTc);
                candidateB64.push(base64Docs.applicantEducationProofBase64, base64Docs.studentTcBase64);
            } else if (doc.key === 'smartCard') {
                candidatePaths.push(profile.smartCard, profile.rationCard, profile.smartCardDocPath, profile.documents?.smartCard, profile.documents?.rationCard);
                candidateB64.push(base64Docs.smartCardBase64, base64Docs.rationCardBase64);
            } else if (doc.key === 'fatherEducationProof') {
                candidatePaths.push(profile.fatherEducationProof, profile.fatherTc, profile.fatherEducationProofPath, profile.documents?.fatherEducationProof, profile.documents?.fatherTc);
                candidateB64.push(base64Docs.fatherEducationProofBase64, base64Docs.fatherTcBase64);
            } else if (doc.key === 'motherEducationProof') {
                candidatePaths.push(profile.motherEducationProof, profile.motherTc, profile.motherEducationProofPath, profile.documents?.motherEducationProof, profile.documents?.motherTc);
                candidateB64.push(base64Docs.motherEducationProofBase64, base64Docs.motherTcBase64);
            } else if (doc.key === 'selfDeclaration') {
                candidatePaths.push(profile.selfDeclaration, profile.selfDeclarationPath, profile.documents?.selfDeclaration);
                candidateB64.push(base64Docs.selfDeclarationBase64);
            } else if (doc.key === 'deathCertificate') {
                candidatePaths.push(profile.deathCertificate, profile.deathCertificatePath, profile.documents?.deathCertificate);
                candidateB64.push(base64Docs.deathCertificateBase64);
            } else if (doc.key === 'deceasedAddressProof') {
                candidatePaths.push(profile.deceasedAddressProof, profile.residenceProof?.docPath, profile.residenceProof, profile.smartCard, profile.headAadhaarDocPath, profile.documents?.deceasedAddressProof, profile.documents?.residenceProof, profile.documents?.smartCard, profile.documents?.headAadhaar);
                candidateB64.push(base64Docs.deceasedAddressProofBase64, base64Docs.residenceProofBase64, base64Docs.headAadhaarBase64);
            } else if (doc.key === 'birthCertificate') {
                candidatePaths.push(profile.birthCertificate, profile.applicantEducationProof, profile.studentTc, profile.documents?.birthCertificate, profile.documents?.applicantEducationProof, profile.documents?.studentTc);
                candidateB64.push(base64Docs.birthCertificateBase64, base64Docs.applicantEducationProofBase64, base64Docs.studentTcBase64);
            }

            const hasValidPath = candidatePaths.some(p => Boolean(p && typeof p === 'string' && fs.existsSync(p)));
            const hasValidB64 = candidateB64.some(b => Boolean(b && typeof b === 'string' && b.length > 50));
            isPresent = Boolean(hasValidB64 || hasValidPath || doc.optional);
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

const catalog = require('../catalog');

module.exports = {
    SERVICES_REGISTRY,
    evaluateServiceChecklist,
    getAllServices,
    getServiceMetadata,
    catalog,
    getService: catalog.getService,
    evaluateDelta: catalog.evaluateDelta
};
