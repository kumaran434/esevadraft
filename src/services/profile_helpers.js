// =========================================================================
// Profile Helpers & UIDAI Verhoeff Checksum Engine
// =========================================================================

function syncFatherOrHusband(prof) {
    if (!prof) return;
    let eng = (prof.fatherNameEng || prof.fatherOrHusbandNameEng || prof.husbandNameEng || '').trim();
    let tam = (prof.fatherNameTam || prof.fatherOrHusbandNameTam || prof.husbandNameTam || '').trim();

    if ((!eng || !tam) && Array.isArray(prof.members)) {
        const husband = prof.members.find(m => m && (
            (m.relationship && m.relationship.toLowerCase() === 'husband') ||
            (m.relationshipTam && m.relationshipTam.includes('கணவர்'))
        ));
        const father = prof.members.find(m => m && (
            (m.relationship && m.relationship.toLowerCase() === 'father') ||
            (m.relationshipTam && m.relationshipTam.includes('தந்தை'))
        ));
        const rel = husband || father;
        if (rel) {
            if (!eng && (rel.nameEng || rel.fullNameEng)) eng = (rel.nameEng || rel.fullNameEng).trim();
            if (!tam && (rel.nameTam || rel.fullNameTam)) tam = (rel.nameTam || rel.fullNameTam).trim();
        }
    }

    if (eng && !tam) tam = eng;
    if (tam && !eng) eng = tam;

    if (eng) prof.fatherNameEng = eng;
    if (tam) prof.fatherNameTam = tam;
}

const verhoeffD = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
    [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
    [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
    [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
    [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
];
const verhoeffP = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
    [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
    [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
    [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
];

function isValidAadhaarVerhoeff(num) {
    if (!num) return false;
    const clean = String(num).replace(/\D/g, '');
    if (clean.length !== 12) return false;
    if (/^(\d)\1{11}$/.test(clean)) return false;
    let c = 0;
    const rev = clean.split('').reverse().map(Number);
    for (let i = 0; i < rev.length; i++) {
        c = verhoeffD[c][verhoeffP[i % 8][rev[i]]];
    }
    return c === 0;
}

function getVerifiedRationCardDocs(prof, docs = {}) {
    const { fileOrDataExists } = require('./draft_document_resolver');
    const p = prof || {};
    const d = { ...(p.documents || {}), ...(docs || {}) };
    const findValid = (candidates) => {
        for (const c of candidates) {
            if (!c) continue;
            const pathStr = typeof c === 'object' ? (c.path || c.docPath || '') : String(c);
            if (pathStr && fileOrDataExists(pathStr)) return pathStr;
        }
        return null;
    };
    const photoDoc = findValid([
        p.headPhotoPath,
        d.profilePhoto,
        d.headPhoto
    ]);
    const aadhaarDoc = findValid([
        p.headAadhaarDocPath,
        p.headAadhaarPdfPath,
        d.headAadhaar,
        d.headAadhaarFront,
        p.members?.[0]?.docPath
    ]);
    const residenceDoc = findValid([
        typeof p.residenceProof === 'object' ? p.residenceProof?.docPath : p.residenceProof,
        p.gasDetails?.gasBookPath,
        d.residenceProof,
        d.gasBook
    ]);
    const memberAadhaarDoc = findValid([
        p.subServiceData?.aadhaarDocPath,
        p.subServiceData?.docPath,
        p.tempMember?.docPath,
        d.memberAadhaar,
        d.memberAadhaarFront,
        aadhaarDoc
    ]);
    return {
        photoDoc,
        aadhaarDoc,
        residenceDoc,
        memberAadhaarDoc,
        hasPhotoDoc: !!photoDoc,
        hasAadhaarDoc: !!aadhaarDoc,
        hasResidenceDoc: !!residenceDoc,
        hasMemberAadhaarDoc: !!memberAadhaarDoc
    };
}

function isProfileDataComplete(prof, docs = {}) {
    if (!prof) return false;
    syncFatherOrHusband(prof);
    const hasName = !!((prof.fullNameTam && prof.fullNameTam.trim()) || (prof.fullNameEng && prof.fullNameEng.trim()));
    const hasFather = !!((prof.fatherNameTam && prof.fatherNameTam.trim()) || (prof.fatherNameEng && prof.fatherNameEng.trim()));
    const rawAadhaar = (prof.headAadhaar || '').replace(/\s+/g, '');
    const hasAadhaar = isValidAadhaarVerhoeff(rawAadhaar) || /^\d{12}$/.test(rawAadhaar);
    const hasAddress = !!(prof.doorNo && prof.pincode);
    const hasMembers = Array.isArray(prof.members) && prof.members.length > 0;
    const { hasPhotoDoc, hasAadhaarDoc, hasResidenceDoc } = getVerifiedRationCardDocs(prof, docs);
    return hasName && hasFather && hasAadhaar && hasPhotoDoc && hasAadhaarDoc && hasAddress && hasMembers && hasResidenceDoc;
}

function updateHeadMember(prof, docPath) {
    if (!prof) return;
    const headMember = {
        nameEng: prof.fullNameEng || '',
        nameTam: prof.fullNameTam || '',
        dob: prof.headDob || '',
        gender: prof.headGender || 'Male',
        genderTam: prof.headGenderTam || (prof.headGender === 'Female' ? 'பெண்' : 'ஆண்'),
        relationship: "Family Head",
        relationshipTam: "குடும்ப தலைவர்",
        relationshipIndex: 0,
        profession: prof.headProfession || "Private",
        monthlyIncome: prof.monthlyIncome || "3000",
        aadhaarNumber: prof.headAadhaar || '',
        docType: "AADHAAR_CARD",
        docPath: docPath || prof.headAadhaarPdfPath || ''
    };
    if (Array.isArray(prof.members) && prof.members.length > 0) {
        prof.members[0] = { ...prof.members[0], ...headMember };
    } else {
        prof.members = [headMember];
    }
}

/**
 * Normalizes DOB to strict DD/MM/YYYY.
 * When older Aadhaar cards print ONLY a 4-digit birth year (e.g., "1968"), defaults day & month to "01/01/1968".
 */
function normalizeDobWithYearFallback(rawDob) {
    if (!rawDob) return '';
    const clean = String(rawDob).trim();
    if (!clean) return '';
    if (/^\d{4}$/.test(clean)) {
        return `01/01/${clean}`;
    }
    const isoMatch = clean.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (isoMatch) {
        return `${isoMatch[3].padStart(2, '0')}/${isoMatch[2].padStart(2, '0')}/${isoMatch[1]}`;
    }
    const dmyMatch = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (dmyMatch) {
        return `${dmyMatch[1].padStart(2, '0')}/${dmyMatch[2].padStart(2, '0')}/${dmyMatch[3]}`;
    }
    return clean;
}

/**
 * Applies AI-extracted Aadhaar relationship (W/o Husband vs S/o or D/o Father) and DOB safely to citizenProfile.
 */
function applyExtractedAadhaarRelationsAndDob(targetProfile, extracted) {
    if (!targetProfile || !extracted) return;

    if (extracted.dob) {
        const cleanRawDob = String(extracted.dob).trim();
        const normalizedDob = normalizeDobWithYearFallback(cleanRawDob);
        if (normalizedDob) {
            targetProfile.headDob = normalizedDob;
            targetProfile.dob = normalizedDob;
        }
        if (/^\d{4}$/.test(cleanRawDob) || extracted.dobIsYearOnly === true) {
            targetProfile.dobIsYearOnly = true;
        }
    }

    const relHint = String(extracted.relationship || extracted.relationType || '').toLowerCase();
    const hasSpouse = Boolean(extracted.spouseNameEng || extracted.spouseNameTam || relHint.includes('husband') || relHint.includes('spouse') || relHint.includes('கணவர்'));

    if (hasSpouse) {
        targetProfile.relationship = 'Husband';
        targetProfile.headRelationship = 'Husband';
        targetProfile.maritalStatus = extracted.maritalStatus || 'Married';
        const hEng = extracted.spouseNameEng || extracted.fatherNameEng || '';
        const hTam = extracted.spouseNameTam || extracted.fatherNameTam || '';
        if (hEng) {
            targetProfile.spouseNameEng = hEng;
            targetProfile.spouseName = hEng;
            targetProfile.fatherNameEng = hEng;
        }
        if (hTam) {
            targetProfile.spouseNameTam = hTam;
            targetProfile.fatherNameTam = hTam;
        }
        if (extracted.birthFatherNameEng) targetProfile.birthFatherNameEng = extracted.birthFatherNameEng;
        if (extracted.birthFatherNameTam) targetProfile.birthFatherNameTam = extracted.birthFatherNameTam;
    } else {
        if (extracted.fatherNameEng) targetProfile.fatherNameEng = extracted.fatherNameEng;
        if (extracted.fatherNameTam) targetProfile.fatherNameTam = extracted.fatherNameTam;
        if (relHint.includes('mother') || relHint.includes('தாய்')) {
            targetProfile.relationship = 'Mother';
            targetProfile.headRelationship = 'Mother';
        } else if (relHint.includes('guardian')) {
            targetProfile.relationship = 'Guardian';
            targetProfile.headRelationship = 'Guardian';
        } else if (relHint.includes('father') || relHint.includes('தந்தை') || (!targetProfile.relationship && (extracted.fatherNameEng || extracted.fatherNameTam))) {
            targetProfile.relationship = 'Father';
            targetProfile.headRelationship = 'Father';
        }
        if (extracted.maritalStatus && !targetProfile.maritalStatus) {
            targetProfile.maritalStatus = extracted.maritalStatus;
        }
    }
}

/**
 * Applies Smart Ration Card details (card number + family members list + address) cleanly to citizenProfile.
 */
function applyExtractedSmartCardDetails(targetProfile, extracted) {
    if (!targetProfile || !extracted) return;
    if (extracted.smartCardNumber) {
        const cleanSc = String(extracted.smartCardNumber).trim();
        targetProfile.smartCardNumber = cleanSc;
        targetProfile.rationCardNo = cleanSc;
    }
    if (Array.isArray(extracted.smartCardMembers) && extracted.smartCardMembers.length > 0) {
        targetProfile.smartCardMembers = extracted.smartCardMembers
            .filter(m => m && (m.nameTam || m.nameEng || m.name))
            .map(m => ({
                nameEng: m.nameEng || m.name || '',
                nameTam: m.nameTam || m.name || '',
                name: m.nameTam || m.nameEng || m.name || '',
                relationship: m.relationship || 'Member',
                age: m.age ? String(m.age) : '',
                gender: m.gender || ''
            }));
    }
    if (extracted.doorNo && !targetProfile.doorNo) targetProfile.doorNo = extracted.doorNo;
    if (extracted.streetTam && !targetProfile.streetTam) targetProfile.streetTam = extracted.streetTam;
    if (extracted.streetEng && !targetProfile.streetEng) targetProfile.streetEng = extracted.streetEng;
    if (extracted.areaTam && !targetProfile.areaTam) targetProfile.areaTam = extracted.areaTam;
    if (extracted.areaEng && !targetProfile.areaEng) targetProfile.areaEng = extracted.areaEng;
    if (extracted.pincode && !targetProfile.pincode) targetProfile.pincode = extracted.pincode;
    if (extracted.district && !targetProfile.district) targetProfile.district = extracted.district;
    if (extracted.taluk && !targetProfile.taluk) targetProfile.taluk = extracted.taluk;
    if (extracted.village && !targetProfile.village) targetProfile.village = extracted.village;
}

/**
 * Applies Income Certificate / Salary Slip / Community Certificate occupation & annual income details cleanly to citizenProfile.
 */
function applyExtractedIncomeDetails(targetProfile, extracted) {
    if (!targetProfile || !extracted) return;
    if (extracted.annualIncome) {
        const cleanInc = String(extracted.annualIncome).replace(/\D+/g, '');
        if (cleanInc && Number(cleanInc) > 0) {
            targetProfile.annualIncome = cleanInc;
            targetProfile.monthlyIncome = String(Math.round(Number(cleanInc) / 12));
        }
    }
    const appOcc = extracted.applicantOccupation || extracted.occupation;
    if (appOcc && String(appOcc).trim()) {
        const cleanOcc = String(appOcc).trim();
        targetProfile.occupation = cleanOcc;
        targetProfile.applicantOccupation = cleanOcc;
        if (!targetProfile.profession) targetProfile.profession = cleanOcc;
    }
    if (extracted.fatherOccupation && String(extracted.fatherOccupation).trim()) {
        targetProfile.fatherOccupation = String(extracted.fatherOccupation).trim();
        if (/deceased|late|dead|காலமான/i.test(targetProfile.fatherOccupation)) {
            targetProfile.fatherAlive = false;
        } else if (extracted.fatherAlive !== undefined && extracted.fatherAlive !== null) {
            targetProfile.fatherAlive = Boolean(extracted.fatherAlive);
        }
    } else if (extracted.fatherAlive === false) {
        targetProfile.fatherAlive = false;
        targetProfile.fatherOccupation = 'Deceased';
    }
    if (extracted.fatherEmploymentNature) {
        targetProfile.fatherEmploymentNature = String(extracted.fatherEmploymentNature).trim();
    }
    if (extracted.motherOccupation && String(extracted.motherOccupation).trim()) {
        targetProfile.motherOccupation = String(extracted.motherOccupation).trim();
        if (/deceased|late|dead|காலமான/i.test(targetProfile.motherOccupation)) {
            targetProfile.motherAlive = false;
        } else if (extracted.motherAlive !== undefined && extracted.motherAlive !== null) {
            targetProfile.motherAlive = Boolean(extracted.motherAlive);
        }
    } else if (extracted.motherAlive === false) {
        targetProfile.motherAlive = false;
        targetProfile.motherOccupation = 'Deceased';
    }
    if (extracted.motherEmploymentNature) {
        targetProfile.motherEmploymentNature = String(extracted.motherEmploymentNature).trim();
    }
    if (extracted.certificateNumber && String(extracted.certificateNumber).trim()) {
        const cNo = String(extracted.certificateNumber).trim();
        const dt = String(extracted.documentType || '').toUpperCase();
        if (dt.includes('INCOME')) targetProfile.incomeCertNumber = cNo;
        else if (dt.includes('COMMUNITY')) targetProfile.communityCertNumber = cNo;
    }
}

/**
 * Normalizes any oil company name/brand variation to canonical portal codes ('IOC' | 'HPC' | 'BPC').
 */
function normalizeOilCompanyCode(rawCompany = '', rawDisplay = '', fallbackAgency = '') {
    const combined = `${rawCompany} ${rawDisplay} ${fallbackAgency}`.toLowerCase();
    if (/indane|iocl|indian\s*oil|\bioc\b/.test(combined)) {
        return { code: 'IOC', display: 'Indane Gas (IOCL)' };
    }
    if (/\bhp\b|hp\s*gas|hindustan|hpcl|\bhpc\b/.test(combined)) {
        return { code: 'HPC', display: 'HP Gas (HPC)' };
    }
    if (/bharat|bpcl|\bbpc\b/.test(combined)) {
        return { code: 'BPC', display: 'Bharat Gas (BPCL)' };
    }
    return { code: 'IOC', display: 'Indane Gas (IOCL)' };
}

/**
 * Normalizes and applies extracted LPG Gas Book & residence address fields onto citizenProfile.
 */
function applyExtractedGasDetails(targetProfile, extracted, gasBookPath = null, isGasDoc = false) {
    if (!targetProfile) return null;
    const prevGas = targetProfile.gasDetails || {};
    const gas = extracted?.gasDetails || {};
    const rawNo = String(gas.consumerNumber || gas.consumerNo || gas.lpgId || prevGas.consumerNumber || '').trim();
    const agency = String(gas.agencyName || prevGas.agencyName || '').trim();
    const { code, display } = normalizeOilCompanyCode(
        gas.oilCompany || prevGas.oilCompany || '',
        gas.oilCompanyDisplay || prevGas.oilCompanyDisplay || '',
        agency
    );
    const cylDigits = String(gas.cylinders || prevGas.cylinders || '1').replace(/\D/g, '') || '1';
    const consumerName = String(gas.consumerName || extracted?.fullNameTam || prevGas.consumerName || targetProfile.fullNameTam || '').trim();
    const hasGas = Boolean(isGasDoc || gas.hasGas || rawNo || agency || prevGas.hasGas);

    if (hasGas || rawNo) {
        targetProfile.gasDetails = {
            ...prevGas,
            hasGas: true,
            consumerName,
            oilCompany: code,
            oilCompanyDisplay: display,
            consumerNumber: rawNo,
            agencyName: agency,
            cylinders: cylDigits,
            ...(gasBookPath ? { gasBookPath } : {})
        };
    }

    if (extracted && extracted.isQualityAcceptable !== false) {
        if (extracted.doorNo && !targetProfile.doorNo) targetProfile.doorNo = extracted.doorNo;
        if (extracted.streetTam && !targetProfile.streetTam) targetProfile.streetTam = extracted.streetTam;
        if (extracted.streetEng && !targetProfile.streetEng) targetProfile.streetEng = extracted.streetEng;
        if (extracted.areaTam && !targetProfile.areaTam) targetProfile.areaTam = extracted.areaTam;
        if (extracted.areaEng && !targetProfile.areaEng) targetProfile.areaEng = extracted.areaEng;
        if (extracted.pincode && !targetProfile.pincode) targetProfile.pincode = extracted.pincode;
        if (extracted.district && !targetProfile.district) targetProfile.district = extracted.district;
        if (extracted.districtTam && !targetProfile.districtTam) targetProfile.districtTam = extracted.districtTam;
        if (extracted.taluk && !targetProfile.taluk) targetProfile.taluk = extracted.taluk;
        if (extracted.talukTam && !targetProfile.talukTam) targetProfile.talukTam = extracted.talukTam;
        if (extracted.village && !targetProfile.village) targetProfile.village = extracted.village;
        if (extracted.villageTam && !targetProfile.villageTam) targetProfile.villageTam = extracted.villageTam;
    }

    return targetProfile.gasDetails || null;
}

module.exports = {
    syncFatherOrHusband,
    isValidAadhaarVerhoeff,
    isProfileDataComplete,
    getVerifiedRationCardDocs,
    updateHeadMember,
    normalizeDobWithYearFallback,
    applyExtractedAadhaarRelationsAndDob,
    applyExtractedSmartCardDetails,
    applyExtractedIncomeDetails,
    normalizeOilCompanyCode,
    applyExtractedGasDetails
};
