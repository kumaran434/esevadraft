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

module.exports = {
    syncFatherOrHusband,
    isValidAadhaarVerhoeff,
    isProfileDataComplete,
    getVerifiedRationCardDocs,
    updateHeadMember
};
