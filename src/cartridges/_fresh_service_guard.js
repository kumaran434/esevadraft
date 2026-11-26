/**
 * Universal "100% Pure Fresh Service Run + Read-Only Archive Locker" Guard
 * =========================================================================
 * Golden Rule 24 (Pure Fresh Intake Law):
 *   1. Before starting ANY service, archiveCustomerDocumentsAndResults(sess)
 *      safely copies every uploaded document & submitted End-Result Receipt PDF
 *      into Read-Only Archive Locker arrays (savedVaultDocs[] & submittedApplications[])
 *      which sync to BOTH PC & Cloud (and delete from both when customer is deleted).
 *   2. Then purge ALL active working profile fields, working docs, base64 buffers,
 *      and stale answers from the live session so EVERY single service (all 14+ services)
 *      ALWAYS starts 100% Pure Fresh from Step 1 — ZERO auto-skip, ZERO draft carryover,
 *      ZERO cross-service confusion!
 */

const ACTIVE_WORKING_PROFILE_FIELDS = [
    // Identity & Basic Demographics (cleared from active working session; archived safely on disk/Cloud)
    'fullNameTam', 'fullNameEng', 'headNameTam', 'headNameEng', 'name',
    'fatherNameTam', 'fatherNameEng', 'fatherOrHusbandName', 'fatherOrHusbandNameTam', 'fatherOrHusbandNameEng',
    'motherNameTam', 'motherNameEng', 'motherName',
    'dob', 'headDob', 'gender', 'headGender', 'headGenderTam', 'genderTam',
    'headAadhaar', 'aadhaarNumber', 'aadhaar',
    'headAadhaarDocPath', 'headPhotoPath', 'profilePhoto', 'photoPath', 'headPhoto', 'photo',
    'smartCard', 'rationCard', 'smartCardDocPath', 'rationCardDocPath', 'smartCardNumber', 'rationCardNo', 'rationCardNumber',
    'smartCardMembers', 'members',
    'residenceProof', 'gasDetails', 'gasBook',
    'doorNo', 'streetTam', 'streetEng', 'areaTam', 'areaEng',
    'village', 'villageTam', 'taluk', 'talukTam', 'district', 'districtTam', 'pincode',
    'canNumber', 'can', 'religion', 'community', 'socialCategory', 'maritalStatus',
    'relationship', 'headRelationship', 'isExtracted', 'districtAutoCorrected', 'districtCorrectionReason',
    'applicationNumber', 'applicationPdfUrl'
];

const TRANSIENT_PROFILE_FIELDS = [
    // TNPDS Modification working state
    'subServiceData',
    'tempMember',
    'tempUploads',

    // Common service selection / transient state
    'selectedMember',

    // TNeGA Income Certificate (REV-103)
    'familyMemberCount',
    'annualIncome',
    'monthlyIncome',
    'profession',
    'occupation',
    'incomeMembers',
    'incomeMembersConfirmed',
    'incomeSelectedIndices',
    'incomeExtraAddedMembers',
    'salaryProofPrompted',
    'incomeProof',
    'incomeProofType',
    'salaryProofType',
    'salaryCertificate',
    'salaryCertificatePath',
    'incomeTaxReturn',
    'salarySlip',
    'incomeCertificate',
    'incomePurpose',

    // TNeGA Community / OBC Certificates (REV-101, REV-115)
    'caste',
    'subCaste',
    'requestedCaste',
    'requestedCommunity',
    'fatherCommunity',
    'motherCommunity',
    'communityProof',
    'communityCertificate',
    'communityCertificatePath',
    'familyCommunityProofPath',
    'communityProofSkipped',
    'parentCasteConfirmed',
    'fatherCaste',
    'motherCaste',
    'applicantOccupation',
    'fatherOccupation',
    'fatherAlive',
    'fatherEmploymentNature',
    'motherOccupation',
    'motherAlive',
    'motherEmploymentNature',
    'familyAnnualIncome',
    'communityCertNumber',
    'incomeCertNumber',

    // TNeGA Residence Certificate (REV-102)
    'yearsOfResidence',
    'purposeOfCertificate',

    // TNeGA First Graduate Certificate (REV-104)
    'currentCourse',
    'degreeCourse',
    'courseName',
    'institutionName',
    'collegeName',
    'schoolCollegeName',
    'yearOfPassing',
    'passingYear',
    'fatherEducation',
    'motherEducation',
    'familyGraduateConfirmed',
    'applicantEducationProof',
    'studentTc',
    'twelfthMarksheet',
    'fatherEducationProof',
    'fatherEducationProofPath',
    'fatherTc',
    'motherEducationProof',
    'motherEducationProofPath',
    'motherTc',

    // TNeGA Legal Heir Certificate (REV-114)
    'deathCertificate',
    'deathCertificatePath',
    'deceasedNameTam',
    'deceasedNameEng',
    'deceasedDateOfDeath',
    'placeOfDeath',
    'deathCertificateNo',
    'deceasedFatherNameTam',
    'deceasedFatherNameEng',
    'deceasedMotherNameTam',
    'deceasedMotherNameEng',
    'deceasedAddressProof',
    'legalHeirProof',
    'legalHeirs',
    'heirsList',
    'legalHeirsConfirmed',
    'birthCertificate',

    // TNeGA Widow Certificate (REV-109)
    'husbandDeathCertificate',
    'spouseNameTam',
    'spouseNameEng',
    'husbandNameTam',
    'husbandNameEng',
    'marriageProof',
    'marriageCertificate',
    'marriageDate',
    'dateOfMarriage',
    'dateOfMarriageSkipped',
    'dateOfDeath'
];

const TRANSIENT_SESSION_FIELDS = [
    'selectedMember',
    'tempMember',
    'annualIncome',
    'profession',
    'familyMemberCount',
    'incomeMembers',
    'caste',
    'subCaste',
    'communityProof',
    'communityProofSkipped',
    'yearsOfResidence',
    'purposeOfCertificate',
    'currentCourse',
    'institutionName',
    'fatherEducation',
    'motherEducation',
    'familyGraduateConfirmed',
    'smartCardSelectedIndices',
    'pendingIncomeMemberIndex',
    'pendingIncomeMember'
];

const TRANSIENT_DOC_KEYS = [
    // TNPDS sub-service working docs
    'memberAadhaar',
    'memberAadhaarFront',
    'memberAadhaarBack',
    'memberAadhaars',
    'mergedAadhaar',
    'birthCertificate',
    'surrenderProof',
    'removeProof',
    'newAddressProof',

    // TNeGA service-specific working docs (never part of the 5 Vault basics)
    'incomeProof',
    'salaryCertificate',
    'incomeTaxReturn',
    'salarySlip',
    'incomeCertificate',
    'communityProof',
    'communityCertificate',
    'applicantEducationProof',
    'studentTc',
    'fatherEducationProof',
    'fatherTc',
    'motherEducationProof',
    'motherTc',
    'deathCertificate',
    'husbandDeathCertificate',
    'deceasedAddressProof',
    'legalHeirProof',
    'marriageProof',
    'marriageCertificate'
];

const path = require('path');

const ARCHIVABLE_DOC_LABELS = {
    profilePhoto: 'பாஸ்போர்ட் புகைப்படம்',
    headAadhaar: 'ஆதார் அட்டை',
    smartCard: 'ஸ்மார்ட் ரேஷன் கார்டு',
    gasBook: 'எரிவாயு அட்டை / ரசீது',
    residenceProof: 'குடியிருப்புச் சான்று',
    memberAadhaar: 'உறுப்பினர் ஆதார் அட்டை',
    birthCertificate: 'பிறப்புச் சான்றிதழ்',
    surrenderProof: 'நீக்கல் / திருமணச் சான்று',
    removeProof: 'உறுப்பினர் நீக்கல் சான்று',
    newAddressProof: 'புதிய முகவரிச் சான்று',
    incomeProof: 'வருமானச் சான்று / Pay Slip',
    salaryCertificate: 'சம்பளச் சான்று',
    incomeTaxReturn: 'வருமான வரி படிவம் (ITR)',
    communityProof: 'குடும்ப சாதிச் சான்றிதழ்',
    communityCertificate: 'சாதிச் சான்றிதழ்',
    applicantEducationProof: 'மாணவர் 12th TC / மதிப்பெண் பட்டியல்',
    fatherEducationProof: 'தந்தையின் பள்ளி TC',
    motherEducationProof: 'தாயின் பள்ளி TC',
    deathCertificate: 'இறப்புச் சான்றிதழ்',
    deceasedAddressProof: 'இறந்தவர் முகவரிச் சான்று',
    marriageProof: 'திருமண ஆதாரம்'
};

/**
 * Non-destructive Archive Vault Helper:
 * Before clearing transient working inputs for a fresh service run, archive EVERY
 * uploaded document & submitted End-Result Receipt PDF into customer's Read-Only
 * savedVaultDocs[] and submittedApplications[] (synced to both PC & Cloud,
 * deleted from both when operator deletes the customer).
 */
function archiveCustomerDocumentsAndResults(sess) {
    if (!sess || !sess.citizenProfile || typeof sess.citizenProfile !== 'object') return;
    const p = sess.citizenProfile;
    const nowIso = new Date().toISOString();
    const svc = sess.subService || p.subService || 'GENERAL';

    // 1. Archive uploaded documents into p.savedVaultDocs[]
    const existingVault = Array.isArray(p.savedVaultDocs) ? [...p.savedVaultDocs] : [];
    const seenVault = new Set(existingVault.map(v => `${v.docType}:${v.fileName || v.localPath || v.cloudUrl}`));

    const allDocSources = {
        ...(p.documents || {}),
        ...(sess.documents || {}),
        ...(sess.tempUploads || {})
    };
    const urlSources = {
        ...(p.storageUrls || {}),
        ...(sess.storageUrls || {})
    };

    const ALIAS_TO_CANONICAL = {
        headPhoto: 'profilePhoto',
        headAadhaarFront: 'headAadhaar',
        headAadhaarBack: 'headAadhaar',
        communityCertificate: 'communityProof',
        familyCommunityProof: 'communityProof',
        rationCard: 'smartCard'
    };
    const headAadhaarBase = (allDocSources.headAadhaar || p.headAadhaarDocPath)
        ? path.basename(String(allDocSources.headAadhaar || p.headAadhaarDocPath))
        : '';

    const isInternalTempKey = (k) => {
        if (!k || typeof k !== 'string') return true;
        if (k.endsWith('Base64') || k.endsWith('Name') || k.endsWith('BoundingBox')) return true;
        if (/^(temp_|currentMember|memberDoc_|memberFront_|memberBack_|memberAadhaar\d+|memberAadhaar_|headAadhaarFront|headAadhaarBack|mergedAadhaar|smartCardFront|smartCardBack|rationCardFront|rationCardBack|gasBookFront|gasBookBack|residenceProofFront|residenceProofBack)/i.test(k)) return true;
        if (k === 'memberAadhaars') return true;
        return false;
    };

    for (const [rawDocType, rawVal] of Object.entries(allDocSources)) {
        if (!rawVal || typeof rawVal !== 'string' || rawVal === 'SELF_DECLARATION') continue;
        if (isInternalTempKey(rawDocType)) continue;
        const fName = path.basename(rawVal);
        if (!fName || fName.length < 3) continue;
        const docType = ALIAS_TO_CANONICAL[rawDocType] || rawDocType;
        if (isInternalTempKey(docType)) continue;
        if ((docType === 'memberAadhaar' || docType === 'memberAadhaarFront' || docType === 'memberAadhaarBack') &&
            headAadhaarBase && fName === headAadhaarBase) {
            continue;
        }
        const dedupKey = `${docType}:${fName}`;
        const rawCloud = urlSources[docType] || urlSources[rawDocType];
        const cloudUrl = (typeof rawCloud === 'string' && (rawCloud.startsWith('http') || rawCloud.startsWith('gs://'))) ? rawCloud : null;
        if (seenVault.has(dedupKey)) {
            if (cloudUrl) {
                const hit = existingVault.find(v => `${v.docType}:${v.fileName || v.localPath || v.cloudUrl}` === dedupKey);
                if (hit && !hit.cloudUrl) hit.cloudUrl = cloudUrl;
            }
            continue;
        }
        seenVault.add(dedupKey);
        existingVault.push({
            docType,
            title: ARCHIVABLE_DOC_LABELS[docType] || docType,
            fileName: fName,
            localPath: rawVal,
            cloudUrl,
            service: svc,
            savedAt: nowIso
        });
    }
    if (existingVault.length > 0) {
        p.savedVaultDocs = existingVault.slice(-40);
    }

    // 2. Archive End-Result Application Receipt PDF into p.submittedApplications[]
    const appNo = String(sess.applicationNumber || p.applicationNumber || '').trim();
    const pdfUrl = sess.applicationPdfUrl || p.applicationPdfUrl || (appNo ? `/receipts/Application_${appNo}.pdf` : '');
    if (appNo) {
        const existingApps = Array.isArray(p.submittedApplications) ? [...p.submittedApplications] : [];
        const existingIdx = existingApps.findIndex(a => String(a.applicationNumber || '').trim() === appNo);
        const cloudPdf = (typeof urlSources.applicationPdf === 'string' && urlSources.applicationPdf.startsWith('http')) ? urlSources.applicationPdf : null;
        if (existingIdx === -1) {
            existingApps.push({
                applicationNumber: appNo,
                service: svc,
                pdfUrl,
                cloudPdfUrl: cloudPdf,
                submittedAt: p.submittedAt || nowIso
            });
        } else if (cloudPdf && !existingApps[existingIdx].cloudPdfUrl) {
            existingApps[existingIdx].cloudPdfUrl = cloudPdf;
        }
        p.submittedApplications = existingApps.slice(-30);
    }
}

function resetTransientServiceInputs(sess, { preserveSubServiceData = false } = {}) {
    if (!sess) return;

    // Step 1: Always archive uploaded docs & End-Result PDFs first so NOTHING is ever lost!
    archiveCustomerDocumentsAndResults(sess);

    // Step 2: Pure Fresh Intake — clear ALL active working fields & working docs so EVERY service starts 100% fresh at Step 1!
    // Read-Only Archive Locker (savedVaultDocs[], submittedApplications[], savedFamilyMembers[]) & mobileNumber remain 100% intact.
    for (const k of TRANSIENT_SESSION_FIELDS) {
        delete sess[k];
    }
    delete sess.canNumber;
    delete sess.applicationNumber;
    delete sess.applicationPdfUrl;
    sess.targetMemberCount = 1;
    sess.currentMemberIdx = 1;
    sess._draftChecked = true;
    sess._isPureFreshSession = true;
    if (!preserveSubServiceData) {
        sess.subServiceData = {};
    }

    const p = sess.citizenProfile;
    if (p && typeof p === 'object') {
        for (const k of ACTIVE_WORKING_PROFILE_FIELDS) {
            delete p[k];
        }
        for (const k of TRANSIENT_PROFILE_FIELDS) {
            if (k === 'subServiceData' && preserveSubServiceData) continue;
            delete p[k];
        }
        if (!preserveSubServiceData) {
            p.subServiceData = {};
        }
        p.documents = {};
        p.base64Docs = {};
        p.members = [];
    }

    sess.tempUploads = {};
    sess.documents = {};
    sess.base64Docs = {};
    sess.storageUrls = {};
    if (sess.draftData && typeof sess.draftData === 'object') {
        sess.draftData.base64Docs = {};
        sess.draftData.documents = {};
    }
}

module.exports = {
    ACTIVE_WORKING_PROFILE_FIELDS,
    TRANSIENT_PROFILE_FIELDS,
    TRANSIENT_SESSION_FIELDS,
    TRANSIENT_DOC_KEYS,
    archiveCustomerDocumentsAndResults,
    resetTransientServiceInputs
};
