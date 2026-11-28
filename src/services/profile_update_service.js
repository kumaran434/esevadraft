const path = require('path');
const fs = require('fs');
const { syncFatherOrHusband, normalizeDobWithYearFallback } = require('./profile_helpers');
const { resolveTnDistrict, isOfficialTnTaluk, lookupTnTaluk } = require('../../tn_district_mapper');
const { ensureBilingualPair } = require('../utils/bilingual_helper');
const { normalizeRelationshipPair } = require('../portal/tnpds/helpers/relationship_matcher');
const { recordVerifiedVillageTaluk, recordInitialCorrection, recordFieldCorrection } = require('./ai_correction_memory');

function applyProfileUpdates(sess, updated) {
    const prevForLearning = (updated && updated.fromEditModal && sess && sess.citizenProfile)
        ? {
            fullNameEng: sess.citizenProfile.fullNameEng || '',
            fullNameTam: sess.citizenProfile.fullNameTam || '',
            fatherNameEng: sess.citizenProfile.fatherNameEng || '',
            fatherNameTam: sess.citizenProfile.fatherNameTam || '',
            streetEng: sess.citizenProfile.streetEng || '',
            streetTam: sess.citizenProfile.streetTam || '',
            areaTam: sess.citizenProfile.areaTam || '',
            village: sess.citizenProfile.village || '',
            taluk: sess.citizenProfile.taluk || '',
            district: sess.citizenProfile.district || '',
            members: Array.isArray(sess.citizenProfile.members)
                ? sess.citizenProfile.members.map(m => ({ nameEng: m?.nameEng || '', nameTam: m?.nameTam || '' }))
                : []
        }
        : null;
    if (updated && updated.fromEditModal) {
        sess.citizenProfile._editedInModalAt = new Date().toISOString();
        const prevEdited = Array.isArray(sess.citizenProfile._operatorEditedFields) ? sess.citizenProfile._operatorEditedFields : [];
        const newEdited = Object.keys(updated).filter(k => updated[k] !== undefined && !['fromEditModal', 'silent', 'draftId', 'mobileNumber', 'oldMobileNumber'].includes(k));
        sess.citizenProfile._operatorEditedFields = Array.from(new Set([...prevEdited, ...newEdited]));
    }
    if (updated.fullNameTam !== undefined) sess.citizenProfile.fullNameTam = updated.fullNameTam;
    if (updated.fullNameEng !== undefined) sess.citizenProfile.fullNameEng = updated.fullNameEng;
    if (updated.relationshipUserEdited) {
        sess.citizenProfile._relationshipEditedByOperator = true;
    }
    if (updated.relationship !== undefined) {
        sess.citizenProfile.relationship = updated.relationship;
        sess.citizenProfile.headRelationship = updated.relationship;
    }
    if (updated.headRelationship !== undefined) {
        sess.citizenProfile.headRelationship = updated.headRelationship;
        if (!sess.citizenProfile.relationship) sess.citizenProfile.relationship = updated.headRelationship;
    }
    if (updated.maritalStatus !== undefined) sess.citizenProfile.maritalStatus = updated.maritalStatus;
    if (updated.fatherNameTam !== undefined) sess.citizenProfile.fatherNameTam = updated.fatherNameTam;
    if (updated.fatherNameEng !== undefined) sess.citizenProfile.fatherNameEng = updated.fatherNameEng;
    if (updated.spouseNameTam !== undefined) sess.citizenProfile.spouseNameTam = updated.spouseNameTam;
    if (updated.spouseNameEng !== undefined) {
        sess.citizenProfile.spouseNameEng = updated.spouseNameEng;
        sess.citizenProfile.spouseName = updated.spouseNameEng;
    }
    if ((sess.citizenProfile.relationship === 'Husband' || sess.citizenProfile.headRelationship === 'Husband') && (sess.citizenProfile.fatherNameEng || sess.citizenProfile.fatherNameTam)) {
        sess.citizenProfile.spouseNameEng = sess.citizenProfile.fatherNameEng || sess.citizenProfile.spouseNameEng || '';
        sess.citizenProfile.spouseNameTam = sess.citizenProfile.fatherNameTam || sess.citizenProfile.spouseNameTam || '';
        sess.citizenProfile.spouseName = sess.citizenProfile.spouseNameEng || sess.citizenProfile.spouseNameTam;
        if (!sess.citizenProfile.maritalStatus) sess.citizenProfile.maritalStatus = 'Married';
    } else if (updated.relationshipUserEdited && sess.citizenProfile.relationship === 'Father') {
        delete sess.citizenProfile.spouseNameEng;
        delete sess.citizenProfile.spouseNameTam;
        delete sess.citizenProfile.spouseName;
    }
    if (updated.motherNameTam !== undefined) sess.citizenProfile.motherNameTam = updated.motherNameTam;
    if (updated.motherNameEng !== undefined) sess.citizenProfile.motherNameEng = updated.motherNameEng;
    if (updated.motherName !== undefined) sess.citizenProfile.motherName = updated.motherName;
    if (sess.citizenProfile.motherNameEng || sess.citizenProfile.motherNameTam || sess.citizenProfile.motherName) {
        const mPair = ensureBilingualPair(
            sess.citizenProfile.motherNameEng || sess.citizenProfile.motherName,
            sess.citizenProfile.motherNameTam || sess.citizenProfile.motherName
        );
        sess.citizenProfile.motherNameEng = mPair.eng;
        sess.citizenProfile.motherNameTam = mPair.tam;
    }
    if (updated.community !== undefined) sess.citizenProfile.community = updated.community;
    if (updated.caste !== undefined) sess.citizenProfile.caste = updated.caste;
    if (updated.religion !== undefined) sess.citizenProfile.religion = updated.religion;
    if (updated.fatherCaste !== undefined) sess.citizenProfile.fatherCaste = updated.fatherCaste;
    if (updated.motherCaste !== undefined) sess.citizenProfile.motherCaste = updated.motherCaste;
    if (updated.fatherCommunity !== undefined) sess.citizenProfile.fatherCommunity = updated.fatherCommunity;
    if (updated.motherCommunity !== undefined) sess.citizenProfile.motherCommunity = updated.motherCommunity;
    if (updated.residenceYears !== undefined) sess.citizenProfile.residenceYears = updated.residenceYears;
    if (updated.residencePurpose !== undefined) sess.citizenProfile.residencePurpose = updated.residencePurpose;
    if (updated.canNumber !== undefined) sess.citizenProfile.canNumber = updated.canNumber;
    if (updated.annualIncome !== undefined) sess.citizenProfile.annualIncome = updated.annualIncome;
    if (updated.monthlyIncome !== undefined) sess.citizenProfile.monthlyIncome = updated.monthlyIncome;
    if (updated.familyMemberCount !== undefined) sess.citizenProfile.familyMemberCount = Number(updated.familyMemberCount) || 1;
    if (Array.isArray(updated.incomeMembers)) sess.citizenProfile.incomeMembers = updated.incomeMembers;
    if (updated.profession !== undefined) sess.citizenProfile.profession = updated.profession;
    if (updated.headDob !== undefined) sess.citizenProfile.headDob = normalizeDobWithYearFallback(updated.headDob);
    if (updated.dob !== undefined) sess.citizenProfile.dob = normalizeDobWithYearFallback(updated.dob);
    if (updated.headGender !== undefined) sess.citizenProfile.headGender = updated.headGender;
    if (updated.headGenderTam !== undefined) sess.citizenProfile.headGenderTam = updated.headGenderTam;
    if (updated.doorNo !== undefined) sess.citizenProfile.doorNo = updated.doorNo;
    const prevStreetEngClean = String(sess.citizenProfile.streetEng || '').trim();
    if (updated.streetTam !== undefined) sess.citizenProfile.streetTam = updated.streetTam;
    if (updated.streetEng !== undefined) {
        const upStreetEng = String(updated.streetEng || '').trim();
        if (upStreetEng) {
            sess.citizenProfile.streetEng = upStreetEng;
        } else if (updated.streetTam && !/[\u0B80-\u0BFF]/.test(String(updated.streetTam))) {
            sess.citizenProfile.streetEng = updated.streetTam;
        } else if (updated.streetTam === '') {
            sess.citizenProfile.streetEng = '';
        } else if (!prevStreetEngClean || /[\u0B80-\u0BFF]/.test(prevStreetEngClean)) {
            sess.citizenProfile.streetEng = updated.streetTam || '';
        }
    }
    if (sess.citizenProfile.streetEng || sess.citizenProfile.streetTam) {
        const opEditedStreetTam = Boolean(updated.fromEditModal && updated.streetTam && /[\u0B80-\u0BFF]/.test(String(updated.streetTam)));
        const sPair = ensureBilingualPair(sess.citizenProfile.streetEng, sess.citizenProfile.streetTam);
        if (!opEditedStreetTam || !sess.citizenProfile.streetEng || /[\u0B80-\u0BFF]/.test(sess.citizenProfile.streetEng)) {
            sess.citizenProfile.streetEng = sPair.eng;
        }
        if (!opEditedStreetTam) {
            sess.citizenProfile.streetTam = sPair.tam;
        }
    }
    const prevAreaEngClean = String(sess.citizenProfile.areaEng || '').trim();
    if (updated.areaTam !== undefined) sess.citizenProfile.areaTam = updated.areaTam;
    if (updated.areaEng !== undefined) {
        const upAreaEng = String(updated.areaEng || '').trim();
        if (upAreaEng) {
            sess.citizenProfile.areaEng = upAreaEng;
        } else if (updated.areaTam && !/[\u0B80-\u0BFF]/.test(String(updated.areaTam))) {
            sess.citizenProfile.areaEng = updated.areaTam;
        } else if (updated.areaTam === '') {
            sess.citizenProfile.areaEng = '';
        } else if (!prevAreaEngClean || /[\u0B80-\u0BFF]/.test(prevAreaEngClean)) {
            sess.citizenProfile.areaEng = updated.areaTam || '';
        }
    }
    if (sess.citizenProfile.areaEng || sess.citizenProfile.areaTam) {
        const opEditedAreaTam = Boolean(updated.fromEditModal && updated.areaTam && /[\u0B80-\u0BFF]/.test(String(updated.areaTam)));
        const aPair = ensureBilingualPair(sess.citizenProfile.areaEng, sess.citizenProfile.areaTam);
        if (!opEditedAreaTam || !sess.citizenProfile.areaEng || /[\u0B80-\u0BFF]/.test(sess.citizenProfile.areaEng)) {
            sess.citizenProfile.areaEng = aPair.eng;
        }
        if (!opEditedAreaTam) {
            sess.citizenProfile.areaTam = aPair.tam;
        }
    }
    if (updated.pincode !== undefined) sess.citizenProfile.pincode = updated.pincode;
    if (updated.district !== undefined) sess.citizenProfile.district = updated.district;
    if (updated.taluk !== undefined) sess.citizenProfile.taluk = updated.taluk;
    if (updated.village !== undefined) sess.citizenProfile.village = updated.village;

    const profAddrText = [sess.citizenProfile.streetEng, sess.citizenProfile.streetTam, sess.citizenProfile.areaEng, sess.citizenProfile.areaTam].filter(Boolean).join(' ');
    const resolvedLoc = resolveTnDistrict(
        sess.citizenProfile.district,
        sess.citizenProfile.taluk,
        sess.citizenProfile.village,
        sess.citizenProfile.pincode,
        profAddrText
    );
    const preserveOperatorJurisdiction = Boolean(updated && updated.fromEditModal);
    if (!preserveOperatorJurisdiction) {
        sess.citizenProfile.district = resolvedLoc.district;
        sess.citizenProfile.districtTam = resolvedLoc.districtTam;
        if (resolvedLoc.taluk) sess.citizenProfile.taluk = resolvedLoc.taluk;
        if (resolvedLoc.talukTam) sess.citizenProfile.talukTam = resolvedLoc.talukTam;
        if (resolvedLoc.village && (resolvedLoc.wasAutoCorrected || !sess.citizenProfile.village)) sess.citizenProfile.village = resolvedLoc.village;
        if (resolvedLoc.villageTam && resolvedLoc.wasAutoCorrected) sess.citizenProfile.villageTam = resolvedLoc.villageTam;
    } else {
        if (!sess.citizenProfile.district && resolvedLoc.district) sess.citizenProfile.district = resolvedLoc.district;
        if (!sess.citizenProfile.districtTam && resolvedLoc.districtTam) sess.citizenProfile.districtTam = resolvedLoc.districtTam;
        if (!sess.citizenProfile.taluk && resolvedLoc.taluk) {
            sess.citizenProfile.taluk = resolvedLoc.taluk;
            if (resolvedLoc.talukTam) sess.citizenProfile.talukTam = resolvedLoc.talukTam;
        }
        if (!sess.citizenProfile.village && resolvedLoc.village) {
            sess.citizenProfile.village = resolvedLoc.village;
            if (resolvedLoc.villageTam) sess.citizenProfile.villageTam = resolvedLoc.villageTam;
        }
    }
    if (resolvedLoc.areaEng && !sess.citizenProfile.areaEng) sess.citizenProfile.areaEng = resolvedLoc.areaEng;
    if (resolvedLoc.areaTam && !sess.citizenProfile.areaTam) sess.citizenProfile.areaTam = resolvedLoc.areaTam;
    if (resolvedLoc.isHamlet && !preserveOperatorJurisdiction) {
        const normCmp = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9\u0B80-\u0BFF]/g, '');
        const hEng = resolvedLoc.areaEng || sess.citizenProfile.areaEng || '';
        const hTam = resolvedLoc.areaTam || sess.citizenProfile.areaTam || '';
        if (hEng && sess.citizenProfile.streetEng && !normCmp(sess.citizenProfile.streetEng).includes(normCmp(hEng))) {
            sess.citizenProfile.streetEng = `${sess.citizenProfile.streetEng}, ${hEng}`;
        }
        if (hTam && sess.citizenProfile.streetTam && !normCmp(sess.citizenProfile.streetTam).includes(normCmp(hTam))) {
            sess.citizenProfile.streetTam = `${sess.citizenProfile.streetTam}, ${hTam}`;
        }
    }
    if (resolvedLoc.wasAutoCorrected && !preserveOperatorJurisdiction) {
        sess.citizenProfile.districtAutoCorrected = true;
        sess.citizenProfile.districtCorrectionReason = resolvedLoc.reason;
    }
    if (updated.headAadhaar !== undefined) sess.citizenProfile.headAadhaar = updated.headAadhaar;
    if (updated.rationCardNo !== undefined) sess.citizenProfile.rationCardNo = updated.rationCardNo;
    if (updated.smartCardNumber !== undefined) sess.citizenProfile.smartCardNumber = updated.smartCardNumber;

    // Explicit Document Path & Deletion Handlers
    if (updated.headPhotoPath === null || updated.headPhotoPath === '') {
        delete sess.citizenProfile.headPhotoPath;
        delete sess.citizenProfile.profilePhoto;
        delete sess.citizenProfile.headPhoto;
        if (sess.citizenProfile.documents) {
            delete sess.citizenProfile.documents.profilePhoto;
            delete sess.citizenProfile.documents.headPhoto;
        }
        if (sess.tempUploads) {
            delete sess.tempUploads.profilePhoto;
            delete sess.tempUploads.headPhoto;
        }
        if (sess.base64Docs) {
            delete sess.base64Docs.profilePhotoBase64;
            delete sess.base64Docs.profilePhotoName;
            delete sess.base64Docs.headPhotoBase64;
            delete sess.base64Docs.headPhotoName;
        }
    } else if (updated.headPhotoPath !== undefined) {
        sess.citizenProfile.headPhotoPath = updated.headPhotoPath;
        sess.citizenProfile.profilePhoto = updated.headPhotoPath;
        if (!sess.citizenProfile.documents) sess.citizenProfile.documents = {};
        sess.citizenProfile.documents.profilePhoto = updated.headPhotoPath;
        if (!sess.tempUploads) sess.tempUploads = {};
        sess.tempUploads.profilePhoto = updated.headPhotoPath;
    }

    const resolvedCommPath = updated.communityProof || updated.communityCertificatePath || updated.familyCommunityProofPath || updated.communityCertificate;
    const isExplicitCommDelete = !resolvedCommPath && (
        updated.communityProof === null ||
        updated.communityProof === '' ||
        updated.communityCertificatePath === null ||
        updated.familyCommunityProofPath === null
    );
    if (isExplicitCommDelete) {
        delete sess.citizenProfile.communityProof;
        delete sess.citizenProfile.communityCertificatePath;
        delete sess.citizenProfile.familyCommunityProofPath;
        if (sess.citizenProfile.documents) {
            delete sess.citizenProfile.documents.communityProof;
            delete sess.citizenProfile.documents.communityCertificate;
            delete sess.citizenProfile.documents.familyCommunityProof;
        }
        if (sess.tempUploads) {
            delete sess.tempUploads.communityProof;
            delete sess.tempUploads.communityCertificate;
            delete sess.tempUploads.familyCommunityProof;
        }
        if (sess.base64Docs) {
            delete sess.base64Docs.communityProofBase64;
            delete sess.base64Docs.communityProofName;
            delete sess.base64Docs.communityCertificateBase64;
            delete sess.base64Docs.communityCertificateName;
        }
    } else if (resolvedCommPath) {
        const commPath = resolvedCommPath;
        sess.citizenProfile.communityProof = commPath;
        sess.citizenProfile.communityCertificatePath = commPath;
        sess.citizenProfile.familyCommunityProofPath = commPath;
        if (!sess.citizenProfile.documents) sess.citizenProfile.documents = {};
        sess.citizenProfile.documents.communityProof = commPath;
        if (!sess.tempUploads) sess.tempUploads = {};
        sess.tempUploads.communityProof = commPath;
    }

    if (updated.smartCardDocPath === null || updated.smartCardDocPath === '') {
        delete sess.citizenProfile.smartCardDocPath;
        delete sess.citizenProfile.smartCardFront;
        delete sess.citizenProfile.smartCardBack;
        if (sess.citizenProfile.documents) {
            delete sess.citizenProfile.documents.smartCard;
            delete sess.citizenProfile.documents.smartCardFront;
            delete sess.citizenProfile.documents.smartCardBack;
        }
        if (sess.tempUploads) {
            delete sess.tempUploads.smartCard;
            delete sess.tempUploads.smartCardFront;
            delete sess.tempUploads.smartCardBack;
        }
    }

    const prevSubService = sess.subService || sess.citizenProfile?.subService || null;
    const isSubServiceChanged = Boolean(updated.subService && prevSubService && updated.subService !== prevSubService);
    if (updated.subService !== undefined) {
        sess.citizenProfile.subService = updated.subService;
        sess.subService = updated.subService;
        if (!updated.subService) {
            sess.citizenProfile.subServiceData = null;
            sess.subServiceData = null;
        } else if (isSubServiceChanged) {
            sess.citizenProfile.subServiceData = {};
            sess.subServiceData = {};
        }
    }
    if (updated.subServiceData) {
        const baseSubData = isSubServiceChanged ? {} : (sess.citizenProfile.subServiceData || {});
        const mergedSubData = {
            ...baseSubData,
            ...updated.subServiceData
        };
        const activeSubSvc = sess.subService || sess.citizenProfile?.subService;
        if (activeSubSvc === 'UPDATE_MOBILE') {
            for (const staleKey of ['memberName', 'memberNameTam', 'memberNameEng', 'relationshipTam', 'relationshipEng', 'aadhaarNo', 'docPath', 'aadhaarDocPath', 'doorNo', 'streetTam', 'streetEng', 'areaTam', 'areaEng', 'pincode', 'proofType', 'addressProofDocPath', 'isNewAddressEntered']) {
                delete mergedSubData[staleKey];
            }
        } else if (activeSubSvc === 'ADD_MEMBER') {
            const relPair = normalizeRelationshipPair(
                mergedSubData.relationshipTam || mergedSubData.relationship,
                mergedSubData.relationshipEng
            );
            if (relPair.key) {
                mergedSubData.relationshipTam = relPair.tam;
                mergedSubData.relationshipEng = relPair.eng;
                mergedSubData.relationship = relPair.tam;
            }
            if (Array.isArray(mergedSubData.addMembersList) && mergedSubData.addMembersList.length > 0) {
                mergedSubData.addMembersList = mergedSubData.addMembersList.map((m, idx) => idx === 0 ? {
                    ...m,
                    memberName: mergedSubData.memberName || mergedSubData.memberNameTam || mergedSubData.memberNameEng || m.memberName || '',
                    memberNameTam: mergedSubData.memberNameTam !== undefined ? mergedSubData.memberNameTam : (m.memberNameTam || ''),
                    memberNameEng: mergedSubData.memberNameEng !== undefined ? mergedSubData.memberNameEng : (m.memberNameEng || ''),
                    fatherNameTam: mergedSubData.fatherNameTam !== undefined ? mergedSubData.fatherNameTam : (m.fatherNameTam || ''),
                    fatherNameEng: mergedSubData.fatherNameEng !== undefined ? mergedSubData.fatherNameEng : (m.fatherNameEng || ''),
                    dob: mergedSubData.dob !== undefined ? mergedSubData.dob : (m.dob || ''),
                    gender: mergedSubData.gender !== undefined ? mergedSubData.gender : (m.gender || ''),
                    genderTam: mergedSubData.genderTam !== undefined ? mergedSubData.genderTam : (m.genderTam || ''),
                    aadhaarNo: mergedSubData.aadhaarNo !== undefined ? mergedSubData.aadhaarNo : (m.aadhaarNo || ''),
                    relationshipTam: mergedSubData.relationshipTam || m.relationshipTam || '',
                    relationshipEng: mergedSubData.relationshipEng || m.relationshipEng || '',
                    relationship: mergedSubData.relationship || mergedSubData.relationshipTam || m.relationship || '',
                    isChild: mergedSubData.isChild !== undefined ? Boolean(mergedSubData.isChild) : Boolean(m.isChild)
                } : m);
            }
            sess.citizenProfile.tempMember = {
                ...(sess.citizenProfile.tempMember || {}),
                nameTam: mergedSubData.memberNameTam || mergedSubData.memberName || '',
                nameEng: mergedSubData.memberNameEng || '',
                dob: mergedSubData.dob || '',
                aadhaarNo: mergedSubData.aadhaarNo || '',
                gender: mergedSubData.gender || '',
                genderTam: mergedSubData.genderTam || '',
                relationshipTam: mergedSubData.relationshipTam || '',
                relationshipEng: mergedSubData.relationshipEng || '',
                docPath: mergedSubData.docPath || mergedSubData.aadhaarDocPath || sess.citizenProfile.tempMember?.docPath || ''
            };
        }
        sess.citizenProfile.subServiceData = mergedSubData;
        sess.subServiceData = { ...mergedSubData };
    }
    if (updated.gasDetails) {
        const prevGas = sess.citizenProfile.gasDetails || {};
        if (updated.gasDetails.hasGas === false) {
            sess.citizenProfile.gasDetails = {
                ...prevGas,
                ...updated.gasDetails,
                hasGas: false
            };
        } else {
            const newGas = { ...prevGas, ...updated.gasDetails };
            if (!newGas.consumerNumber && prevGas.consumerNumber && !updated.fromEditModal) newGas.consumerNumber = prevGas.consumerNumber;
            if (!newGas.agencyName && prevGas.agencyName && !updated.fromEditModal) newGas.agencyName = prevGas.agencyName;
            if ((!newGas.cylinders || newGas.cylinders === '0') && prevGas.cylinders && prevGas.cylinders !== '0') newGas.cylinders = prevGas.cylinders;
            if (!newGas.oilCompany && prevGas.oilCompany) newGas.oilCompany = prevGas.oilCompany;
            if (!newGas.oilCompanyDisplay && prevGas.oilCompanyDisplay) newGas.oilCompanyDisplay = prevGas.oilCompanyDisplay;
            if (!newGas.gasBookPath && prevGas.gasBookPath) newGas.gasBookPath = prevGas.gasBookPath;
            if (updated.gasDetails.hasGas !== false && prevGas.hasGas) newGas.hasGas = true;

            sess.citizenProfile.gasDetails = newGas;
            if (newGas.gasBookPath) {
                if (!sess.tempUploads) sess.tempUploads = {};
                sess.tempUploads.gasBook = newGas.gasBookPath;
                sess.tempUploads.residenceProof = newGas.gasBookPath;
                if (!sess.citizenProfile.documents) sess.citizenProfile.documents = {};
                sess.citizenProfile.documents.gasBook = newGas.gasBookPath;
                sess.citizenProfile.documents.residenceProof = newGas.gasBookPath;
                sess.citizenProfile.gasDetails.hasGas = true;
            }
        }
    }
    if (updated.residenceProof) {
        sess.citizenProfile.residenceProof = {
            ...(sess.citizenProfile.residenceProof || {}),
            ...updated.residenceProof
        };
        if (updated.residenceProof.docPath) {
            if (!sess.tempUploads) sess.tempUploads = {};
            sess.tempUploads.residenceProof = updated.residenceProof.docPath;
            if (!sess.citizenProfile.documents) sess.citizenProfile.documents = {};
            sess.citizenProfile.documents.residenceProof = updated.residenceProof.docPath;
        }
    }
    if (updated.documents) {
        sess.citizenProfile.documents = {
            ...(sess.citizenProfile.documents || {}),
            ...updated.documents
        };
        if (!sess.tempUploads) sess.tempUploads = {};
        Object.assign(sess.tempUploads, updated.documents);
    }

    if (updated.members && Array.isArray(updated.members) && updated.members.length > 0) {
        const prevMembers = Array.isArray(sess.citizenProfile.members) ? sess.citizenProfile.members : [];
        sess.citizenProfile.members = updated.members.map((editedMem, idx) => {
            const prevMem = prevMembers[idx] || {};
            const merged = { ...prevMem, ...editedMem };
            if (!merged.docPath && prevMem.docPath && editedMem.docPath !== null && editedMem.docPath !== '') {
                merged.docPath = prevMem.docPath;
            }
            if (merged.docType === 'BIRTH_CERTIFICATE' && !merged.birthCertificatePath && prevMem.birthCertificatePath && editedMem.birthCertificatePath !== null) {
                merged.birthCertificatePath = prevMem.birthCertificatePath;
            }
            if (idx > 0) merged._editedInModal = Boolean(updated.fromEditModal);
            return merged;
        });
    }

    if (sess.citizenProfile.members && sess.citizenProfile.members.length > 0) {
        sess.citizenProfile.members[0].nameEng = sess.citizenProfile.fullNameEng !== undefined ? sess.citizenProfile.fullNameEng : sess.citizenProfile.members[0].nameEng;
        sess.citizenProfile.members[0].nameTam = sess.citizenProfile.fullNameTam !== undefined ? sess.citizenProfile.fullNameTam : sess.citizenProfile.members[0].nameTam;
        sess.citizenProfile.members[0].dob = sess.citizenProfile.headDob !== undefined ? sess.citizenProfile.headDob : sess.citizenProfile.members[0].dob;
        sess.citizenProfile.members[0].gender = sess.citizenProfile.headGender !== undefined ? sess.citizenProfile.headGender : sess.citizenProfile.members[0].gender;
        sess.citizenProfile.members[0].genderTam = sess.citizenProfile.headGenderTam !== undefined ? sess.citizenProfile.headGenderTam : sess.citizenProfile.members[0].genderTam;
        sess.citizenProfile.members[0].aadhaarNumber = sess.citizenProfile.headAadhaar !== undefined ? sess.citizenProfile.headAadhaar : sess.citizenProfile.members[0].aadhaarNumber;
    }

    // Dynamic Extensible Master Profile Property Accumulation
    // Ensures any new field from future services (e.g., voterEpicNo, surveyNumber, pattaNumber, firstGraduateDegree, etc.)
    // automatically persists into sess.citizenProfile without requiring code changes!
    const explicitlyHandledKeys = new Set([
        'fullNameTam', 'fullNameEng', 'fatherNameTam', 'fatherNameEng', 'motherNameTam', 'motherNameEng', 'motherName',
        'community', 'caste', 'religion', 'fatherCaste', 'motherCaste', 'fatherCommunity', 'motherCommunity',
        'residenceYears', 'residencePurpose', 'canNumber', 'annualIncome', 'profession',
        'headDob', 'dob', 'headGender', 'headGenderTam', 'doorNo', 'streetTam', 'streetEng',
        'areaTam', 'areaEng', 'pincode', 'district', 'taluk', 'village', 'headAadhaar',
        'rationCardNo', 'subService', 'subServiceData', 'gasDetails', 'residenceProof', 'documents', 'members',
        'headPhotoPath', 'profilePhoto', 'headPhoto', 'communityProof', 'communityCertificatePath', 'familyCommunityProofPath', 'smartCardDocPath',
        'step', 'mobileNumber', 'mobile', 'oldMobileNumber', 'oldMobile', 'draftId', 'fromEditModal', 'silent',
        'relationship', 'headRelationship', 'relationshipUserEdited', 'maritalStatus', 'spouseNameTam', 'spouseNameEng', 'spouseName',
        'operatorUid', 'operatorName', 'operatorMobile', 'chatHistory', 'status', 'intakeState', 'isDeleted', 'isTrashed',
        'tempUploads', 'base64Docs', 'storageUrls', 'createdAt', 'updatedAt'
    ]);
    for (const [k, v] of Object.entries(updated)) {
        if (!explicitlyHandledKeys.has(k) && v !== undefined && v !== null && v !== '') {
            sess.citizenProfile[k] = v;
        }
    }

    syncFatherOrHusband(sess.citizenProfile);

    // Self-Learning AI Memory: Capture verified operator corrections from Edit Modal saves
    if (prevForLearning && updated && updated.fromEditModal) {
        try {
            const mobLearn = sess.citizenProfile.mobileNumber || updated.mobileNumber || '';
            const curProf = sess.citizenProfile;
            if (curProf.village && curProf.taluk && isOfficialTnTaluk(curProf.taluk)) {
                const tInfo = lookupTnTaluk(curProf.taluk, curProf.district || '', '');
                if (tInfo) {
                    recordVerifiedVillageTaluk({
                        village: curProf.village,
                        villageTam: curProf.villageTam || '',
                        taluk: tInfo.taluk,
                        talukTam: tInfo.talukTam,
                        district: tInfo.district,
                        districtTam: tInfo.districtTam,
                        isHamlet: false,
                        mobile: mobLearn
                    });
                }
            }
            // 2. Learn Tamil Initial preferences ONLY (never store personal full names!)
            if (prevForLearning.fullNameTam && curProf.fullNameTam && prevForLearning.fullNameTam !== curProf.fullNameTam) {
                recordInitialCorrection({
                    engName: curProf.fullNameEng || prevForLearning.fullNameEng,
                    beforeTam: prevForLearning.fullNameTam,
                    afterTam: curProf.fullNameTam,
                    mobile: mobLearn
                });
            }
            if (prevForLearning.fatherNameTam && curProf.fatherNameTam && prevForLearning.fatherNameTam !== curProf.fatherNameTam) {
                recordInitialCorrection({
                    engName: curProf.fatherNameEng || prevForLearning.fatherNameEng,
                    beforeTam: prevForLearning.fatherNameTam,
                    afterTam: curProf.fatherNameTam,
                    mobile: mobLearn
                });
            }
            if (Array.isArray(curProf.members) && Array.isArray(prevForLearning.members)) {
                for (let mi = 1; mi < curProf.members.length; mi++) {
                    const pM = prevForLearning.members[mi];
                    const cM = curProf.members[mi];
                    if (pM && cM && pM.nameTam && cM.nameTam && pM.nameTam !== cM.nameTam) {
                        recordInitialCorrection({
                            engName: cM.nameEng || pM.nameEng,
                            beforeTam: pM.nameTam,
                            afterTam: cM.nameTam,
                            mobile: mobLearn
                        });
                    }
                }
            }
            // 3. Learn recurring street/area/village spelling corrections (2-Time Safe Auto-Filter in AI prompt)
            for (const fk of ['streetTam', 'streetEng', 'areaTam', 'village']) {
                if (prevForLearning[fk] && curProf[fk] && prevForLearning[fk] !== curProf[fk]) {
                    recordFieldCorrection({
                        fieldKey: fk,
                        beforeVal: prevForLearning[fk],
                        afterVal: curProf[fk],
                        mobile: mobLearn
                    });
                }
            }
        } catch (_) {}
    }
}

module.exports = {
    applyProfileUpdates
};
