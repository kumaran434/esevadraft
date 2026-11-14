const path = require('path');
const fs = require('fs');
const { syncFatherOrHusband } = require('./profile_helpers');
const { resolveTnDistrict } = require('../../tn_district_mapper');
const { ensureBilingualPair } = require('../utils/bilingual_helper');

function applyProfileUpdates(sess, updated) {
    if (updated.fullNameTam !== undefined) sess.citizenProfile.fullNameTam = updated.fullNameTam;
    if (updated.fullNameEng !== undefined) sess.citizenProfile.fullNameEng = updated.fullNameEng;
    if (updated.fatherNameTam !== undefined) sess.citizenProfile.fatherNameTam = updated.fatherNameTam;
    if (updated.fatherNameEng !== undefined) sess.citizenProfile.fatherNameEng = updated.fatherNameEng;
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
    if (updated.canNumber !== undefined) sess.citizenProfile.canNumber = updated.canNumber;
    if (updated.annualIncome !== undefined) sess.citizenProfile.annualIncome = updated.annualIncome;
    if (updated.profession !== undefined) sess.citizenProfile.profession = updated.profession;
    if (updated.headDob !== undefined) sess.citizenProfile.headDob = updated.headDob;
    if (updated.dob !== undefined) sess.citizenProfile.dob = updated.dob;
    if (updated.headGender !== undefined) sess.citizenProfile.headGender = updated.headGender;
    if (updated.headGenderTam !== undefined) sess.citizenProfile.headGenderTam = updated.headGenderTam;
    if (updated.doorNo !== undefined) sess.citizenProfile.doorNo = updated.doorNo;
    if (updated.streetTam !== undefined) sess.citizenProfile.streetTam = updated.streetTam;
    if (updated.streetEng !== undefined) sess.citizenProfile.streetEng = updated.streetEng || updated.streetTam;
    if (sess.citizenProfile.streetEng || sess.citizenProfile.streetTam) {
        const sPair = ensureBilingualPair(sess.citizenProfile.streetEng, sess.citizenProfile.streetTam);
        sess.citizenProfile.streetEng = sPair.eng;
        sess.citizenProfile.streetTam = sPair.tam;
    }
    if (updated.areaTam !== undefined) sess.citizenProfile.areaTam = updated.areaTam;
    if (updated.areaEng !== undefined) sess.citizenProfile.areaEng = updated.areaEng || updated.areaTam;
    if (sess.citizenProfile.areaEng || sess.citizenProfile.areaTam) {
        const aPair = ensureBilingualPair(sess.citizenProfile.areaEng, sess.citizenProfile.areaTam);
        sess.citizenProfile.areaEng = aPair.eng;
        sess.citizenProfile.areaTam = aPair.tam;
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
    sess.citizenProfile.district = resolvedLoc.district;
    sess.citizenProfile.districtTam = resolvedLoc.districtTam;
    if (resolvedLoc.taluk) sess.citizenProfile.taluk = resolvedLoc.taluk;
    if (resolvedLoc.talukTam) sess.citizenProfile.talukTam = resolvedLoc.talukTam;
    if (resolvedLoc.village && (resolvedLoc.wasAutoCorrected || !sess.citizenProfile.village)) sess.citizenProfile.village = resolvedLoc.village;
    if (resolvedLoc.villageTam && resolvedLoc.wasAutoCorrected) sess.citizenProfile.villageTam = resolvedLoc.villageTam;
    if (resolvedLoc.areaEng && !sess.citizenProfile.areaEng) sess.citizenProfile.areaEng = resolvedLoc.areaEng;
    if (resolvedLoc.areaTam && !sess.citizenProfile.areaTam) sess.citizenProfile.areaTam = resolvedLoc.areaTam;
    if (resolvedLoc.wasAutoCorrected) {
        sess.citizenProfile.districtAutoCorrected = true;
        sess.citizenProfile.districtCorrectionReason = resolvedLoc.reason;
    }
    if (updated.headAadhaar !== undefined) sess.citizenProfile.headAadhaar = updated.headAadhaar;
    if (updated.rationCardNo !== undefined) sess.citizenProfile.rationCardNo = updated.rationCardNo;
    if (updated.subService !== undefined) {
        sess.citizenProfile.subService = updated.subService;
        sess.subService = updated.subService;
        if (!updated.subService) {
            sess.citizenProfile.subServiceData = null;
            sess.subServiceData = null;
        }
    }
    if (updated.subServiceData) {
        sess.citizenProfile.subServiceData = {
            ...(sess.citizenProfile.subServiceData || {}),
            ...updated.subServiceData
        };
        if (sess.subServiceData) {
            sess.subServiceData = {
                ...sess.subServiceData,
                ...updated.subServiceData
            };
        }
    }
    if (updated.gasDetails) {
        const prevGas = sess.citizenProfile.gasDetails || {};
        const newGas = { ...prevGas, ...updated.gasDetails };
        if (!newGas.consumerNumber && prevGas.consumerNumber) newGas.consumerNumber = prevGas.consumerNumber;
        if (!newGas.agencyName && prevGas.agencyName) newGas.agencyName = prevGas.agencyName;
        if ((!newGas.cylinders || newGas.cylinders === '0') && prevGas.cylinders && prevGas.cylinders !== '0') newGas.cylinders = prevGas.cylinders;
        if (!newGas.oilCompany && prevGas.oilCompany) newGas.oilCompany = prevGas.oilCompany;
        if (!newGas.oilCompanyDisplay && prevGas.oilCompanyDisplay) newGas.oilCompanyDisplay = prevGas.oilCompanyDisplay;
        if (!newGas.gasBookPath && prevGas.gasBookPath) newGas.gasBookPath = prevGas.gasBookPath;
        if (prevGas.hasGas) newGas.hasGas = true;

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
        sess.citizenProfile.members = updated.members;
    }

    if (sess.citizenProfile.members && sess.citizenProfile.members.length > 0) {
        sess.citizenProfile.members[0].nameEng = sess.citizenProfile.fullNameEng || sess.citizenProfile.members[0].nameEng;
        sess.citizenProfile.members[0].nameTam = sess.citizenProfile.fullNameTam || sess.citizenProfile.members[0].nameTam;
        sess.citizenProfile.members[0].dob = sess.citizenProfile.headDob || sess.citizenProfile.members[0].dob;
        sess.citizenProfile.members[0].gender = sess.citizenProfile.headGender || sess.citizenProfile.members[0].gender;
        sess.citizenProfile.members[0].genderTam = sess.citizenProfile.headGenderTam || sess.citizenProfile.members[0].genderTam;
        sess.citizenProfile.members[0].aadhaarNumber = sess.citizenProfile.headAadhaar || sess.citizenProfile.members[0].aadhaarNumber;
    }

    syncFatherOrHusband(sess.citizenProfile);
}

module.exports = {
    applyProfileUpdates
};
