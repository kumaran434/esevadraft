const path = require('path');
const fs = require('fs');

const { produceCompliantPassportPhoto, produceCompliantDocument, produceDualSidedDocument, extractFacePassportFromDocument } = require('../../photo_studio');
const { inspectAndExtractDocument } = require('../../ai_document_extractor');

async function processUploadedDocument(sess, docType, uploadedFile, memberIndex, targetMobile) {
    let optimizedPath = uploadedFile.path;
    let extractedData = null;

    if (docType === 'headPhoto') {
        try {
            optimizedPath = await produceCompliantPassportPhoto(uploadedFile.path);
        } catch (e) {
            optimizedPath = uploadedFile.path;
        }
        sess.citizenProfile.headPhotoPath = optimizedPath;
        sess.tempUploads.profilePhoto = optimizedPath;
        sess.citizenProfile.documents.profilePhoto = optimizedPath;
    } else if (docType === 'headAadhaar' || docType === 'headAadhaarFront' || docType === 'headAadhaarBack') {
        const isBackSide = (docType === 'headAadhaarBack');
        let extractedAadhaar = null;
        try {
            extractedAadhaar = await inspectAndExtractDocument(uploadedFile.path, { skipFaceExtraction: isBackSide });
        } catch (aErr) {}

        try {
            optimizedPath = await produceCompliantDocument(uploadedFile.path, {
                boundingBox: extractedAadhaar?.documentBoundingBox
            });
        } catch (e) {
            optimizedPath = uploadedFile.path;
        }

        if (isBackSide) {
            sess.tempUploads.headAadhaarBack = optimizedPath;
            sess.citizenProfile.documents.headAadhaarBack = optimizedPath;
        } else {
            sess.tempUploads.headAadhaarFront = optimizedPath;
            sess.citizenProfile.documents.headAadhaarFront = optimizedPath;
            sess.citizenProfile.documents.headAadhaar = optimizedPath;
            sess.citizenProfile.headAadhaarDocPath = optimizedPath;
        }

        const frontCandidate = sess.tempUploads.headAadhaarFront || sess.citizenProfile.documents?.headAadhaarFront || (!isBackSide ? optimizedPath : sess.citizenProfile.headAadhaarDocPath);
        const backCandidate = sess.tempUploads.headAadhaarBack || sess.citizenProfile.documents?.headAadhaarBack || (isBackSide ? optimizedPath : null);

        if (frontCandidate && backCandidate && frontCandidate !== backCandidate && fs.existsSync(frontCandidate) && fs.existsSync(backCandidate)) {
            try {
                const mergedPdf = await produceDualSidedDocument(frontCandidate, backCandidate);
                if (mergedPdf && fs.existsSync(mergedPdf)) {
                    optimizedPath = mergedPdf;
                    sess.tempUploads.headAadhaar = mergedPdf;
                    sess.citizenProfile.headAadhaarDocPath = mergedPdf;
                    sess.citizenProfile.documents.headAadhaar = mergedPdf;
                }
            } catch (e) {}
        } else if (!sess.citizenProfile.headAadhaarDocPath) {
            sess.tempUploads.headAadhaar = optimizedPath;
            sess.citizenProfile.headAadhaarDocPath = optimizedPath;
            sess.citizenProfile.documents.headAadhaar = optimizedPath;
        }

        if (extractedAadhaar && extractedAadhaar.isQualityAcceptable !== false) {
            extractedData = extractedAadhaar;
            if (extractedAadhaar.fullNameTam) sess.citizenProfile.fullNameTam = extractedAadhaar.fullNameTam;
            if (extractedAadhaar.fullNameEng) sess.citizenProfile.fullNameEng = extractedAadhaar.fullNameEng;
            if (extractedAadhaar.fatherNameTam) sess.citizenProfile.fatherNameTam = extractedAadhaar.fatherNameTam;
            if (extractedAadhaar.fatherNameEng) sess.citizenProfile.fatherNameEng = extractedAadhaar.fatherNameEng;
            if (extractedAadhaar.dob) {
                sess.citizenProfile.headDob = extractedAadhaar.dob;
                sess.citizenProfile.dob = extractedAadhaar.dob;
            }
            if (extractedAadhaar.gender) {
                sess.citizenProfile.headGender = extractedAadhaar.gender;
                sess.citizenProfile.headGenderTam = extractedAadhaar.genderTam || (extractedAadhaar.gender === 'Female' ? 'பெண்' : 'ஆண்');
            }
            if (extractedAadhaar.aadhaarNumber) {
                sess.citizenProfile.headAadhaar = String(extractedAadhaar.aadhaarNumber).replace(/\s+/g, '');
            }
            if (extractedAadhaar.doorNo) sess.citizenProfile.doorNo = extractedAadhaar.doorNo;
            if (extractedAadhaar.streetTam) sess.citizenProfile.streetTam = extractedAadhaar.streetTam;
            if (extractedAadhaar.streetEng) sess.citizenProfile.streetEng = extractedAadhaar.streetEng;
            if (extractedAadhaar.areaTam) sess.citizenProfile.areaTam = extractedAadhaar.areaTam;
            if (extractedAadhaar.areaEng) sess.citizenProfile.areaEng = extractedAadhaar.areaEng;
            if (extractedAadhaar.pincode) sess.citizenProfile.pincode = extractedAadhaar.pincode;
            if (extractedAadhaar.district) sess.citizenProfile.district = extractedAadhaar.district;
            if (extractedAadhaar.districtTam) sess.citizenProfile.districtTam = extractedAadhaar.districtTam;
            if (extractedAadhaar.taluk) sess.citizenProfile.taluk = extractedAadhaar.taluk;
            if (extractedAadhaar.talukTam) sess.citizenProfile.talukTam = extractedAadhaar.talukTam;
            if (extractedAadhaar.village) sess.citizenProfile.village = extractedAadhaar.village;
            if (extractedAadhaar.villageTam) sess.citizenProfile.villageTam = extractedAadhaar.villageTam;

            if (sess.citizenProfile.members && sess.citizenProfile.members.length > 0) {
                if (sess.citizenProfile.fullNameTam) sess.citizenProfile.members[0].nameTam = sess.citizenProfile.fullNameTam;
                if (sess.citizenProfile.fullNameEng) sess.citizenProfile.members[0].nameEng = sess.citizenProfile.fullNameEng;
                if (sess.citizenProfile.headDob) sess.citizenProfile.members[0].dob = sess.citizenProfile.headDob;
                if (sess.citizenProfile.headGender) sess.citizenProfile.members[0].gender = sess.citizenProfile.headGender;
                if (sess.citizenProfile.headAadhaar) sess.citizenProfile.members[0].aadhaarNumber = sess.citizenProfile.headAadhaar;
            }

            if (extractedAadhaar.extractedFacePhotoPath && !sess.citizenProfile.headPhotoPath) {
                sess.citizenProfile.headPhotoPath = extractedAadhaar.extractedFacePhotoPath;
                sess.tempUploads.profilePhoto = extractedAadhaar.extractedFacePhotoPath;
                sess.citizenProfile.documents.profilePhoto = extractedAadhaar.extractedFacePhotoPath;
            }
        }

        if (!sess.citizenProfile.headPhotoPath && !optimizedPath.toLowerCase().endsWith('.pdf')) {
            try {
                const extractedFace = await extractFacePassportFromDocument(optimizedPath);
                if (extractedFace) {
                    sess.citizenProfile.headPhotoPath = extractedFace;
                    sess.tempUploads.profilePhoto = extractedFace;
                    sess.citizenProfile.documents.profilePhoto = extractedFace;
                }
            } catch (e) {}
        }
    } else if (docType === 'memberAadhaar' || docType === 'memberAadhaarFront' || docType === 'memberAadhaarBack') {
        const isBackSide = (docType === 'memberAadhaarBack');
        let extractedMember = null;
        try {
            extractedMember = await inspectAndExtractDocument(uploadedFile.path, { skipFaceExtraction: true, isAddMember: true });
        } catch (mErr) {}

        try {
            optimizedPath = await produceCompliantDocument(uploadedFile.path, {
                boundingBox: extractedMember?.documentBoundingBox
            });
        } catch (e) {
            optimizedPath = uploadedFile.path;
        }

        const fKey = `memberAadhaarFront_${memberIndex}`;
        const bKey = `memberAadhaarBack_${memberIndex}`;
        if (isBackSide) {
            sess.tempUploads[bKey] = optimizedPath;
            sess.tempUploads.memberAadhaarBack = optimizedPath;
        } else {
            sess.tempUploads[fKey] = optimizedPath;
            sess.tempUploads.memberAadhaarFront = optimizedPath;
        }

        const mFront = sess.tempUploads[fKey] || sess.tempUploads.memberAadhaarFront || (!isBackSide ? optimizedPath : (sess.citizenProfile.members?.[memberIndex]?.docPath || null));
        const mBack = sess.tempUploads[bKey] || sess.tempUploads.memberAadhaarBack || (isBackSide ? optimizedPath : null);
        if (mFront && mBack && mFront !== mBack && fs.existsSync(mFront) && fs.existsSync(mBack)) {
            try {
                const mergedPdf = await produceDualSidedDocument(mFront, mBack);
                if (mergedPdf && fs.existsSync(mergedPdf)) {
                    optimizedPath = mergedPdf;
                    sess.tempUploads.memberAadhaar = mergedPdf;
                    sess.citizenProfile.documents.memberAadhaar = mergedPdf;
                }
            } catch (e) {}
        }

        if (sess.citizenProfile.members && sess.citizenProfile.members[memberIndex]) {
            sess.citizenProfile.members[memberIndex].docPath = optimizedPath;
            sess.citizenProfile.members[memberIndex].docType = 'AADHAAR_CARD';
        }
        sess.tempUploads[`memberAadhaar_${memberIndex}`] = optimizedPath;

        if (extractedMember && extractedMember.isQualityAcceptable !== false) {
            extractedData = extractedMember;
            const isAddMemService = sess.citizenProfile.subService === 'ADD_MEMBER' || (sess.intakeState && sess.intakeState.startsWith('RATION_ADD_MEMBER')) || memberIndex === 0;
            if (isAddMemService) {
                sess.citizenProfile.subServiceData = {
                    ...(sess.citizenProfile.subServiceData || {}),
                    memberNameTam: extractedMember.fullNameTam || sess.citizenProfile.subServiceData?.memberNameTam || '',
                    memberNameEng: extractedMember.fullNameEng || sess.citizenProfile.subServiceData?.memberNameEng || '',
                    memberName: extractedMember.fullNameEng || extractedMember.fullNameTam || sess.citizenProfile.subServiceData?.memberName || '',
                    fatherNameTam: extractedMember.fatherNameTam || sess.citizenProfile.subServiceData?.fatherNameTam || '',
                    fatherNameEng: extractedMember.fatherNameEng || sess.citizenProfile.subServiceData?.fatherNameEng || '',
                    dob: extractedMember.dob || sess.citizenProfile.subServiceData?.dob || '',
                    gender: extractedMember.gender || sess.citizenProfile.subServiceData?.gender || 'Male',
                    genderTam: extractedMember.genderTam || (extractedMember.gender === 'Female' ? 'பெண்' : 'ஆண்'),
                    aadhaarNo: extractedMember.aadhaarNumber ? String(extractedMember.aadhaarNumber).replace(/\s+/g, '') : (sess.citizenProfile.subServiceData?.aadhaarNo || ''),
                    docPath: optimizedPath
                };
                sess.subServiceData = sess.citizenProfile.subServiceData;
            }

            if (sess.citizenProfile.members && sess.citizenProfile.members[memberIndex]) {
                if (extractedMember.fullNameTam) sess.citizenProfile.members[memberIndex].nameTam = extractedMember.fullNameTam;
                if (extractedMember.fullNameEng) sess.citizenProfile.members[memberIndex].nameEng = extractedMember.fullNameEng;
                if (extractedMember.dob) sess.citizenProfile.members[memberIndex].dob = extractedMember.dob;
                if (extractedMember.gender) {
                    sess.citizenProfile.members[memberIndex].gender = extractedMember.gender;
                    sess.citizenProfile.members[memberIndex].genderTam = extractedMember.genderTam || (extractedMember.gender === 'Female' ? 'பெண்' : 'ஆண்');
                }
                if (extractedMember.aadhaarNumber) {
                    sess.citizenProfile.members[memberIndex].aadhaarNumber = String(extractedMember.aadhaarNumber).replace(/\s+/g, '');
                }
            }
        }

        if (sess.citizenProfile.subService === 'ADD_MEMBER' || (sess.intakeState && sess.intakeState.startsWith('RATION_ADD_MEMBER'))) {
            delete sess.citizenProfile.headPhotoPath;
            if (sess.tempUploads) delete sess.tempUploads.profilePhoto;
            if (sess.citizenProfile.documents) delete sess.citizenProfile.documents.profilePhoto;
        }
    } else if (docType === 'residenceProof' || docType === 'gasBook') {
        let extracted = null;
        try {
            extracted = await inspectAndExtractDocument(uploadedFile.path, { skipFaceExtraction: true });
        } catch (extErr) {}

        try {
            optimizedPath = await produceCompliantDocument(uploadedFile.path, {
                boundingBox: extracted?.documentBoundingBox
            });
        } catch (e) {
            optimizedPath = uploadedFile.path;
        }
        const frontKey = `${docType}Front`;
        const backKey = `${docType}Back`;
        if (!sess.tempUploads[frontKey]) {
            sess.tempUploads[frontKey] = optimizedPath;
        }
        if (sess.tempUploads[frontKey] && sess.tempUploads[backKey]) {
            try {
                const mergedPdf = await produceDualSidedDocument(sess.tempUploads[frontKey], sess.tempUploads[backKey]);
                if (mergedPdf && fs.existsSync(mergedPdf)) {
                    optimizedPath = mergedPdf;
                }
            } catch (_) {}
        }
        sess.tempUploads.residenceProof = optimizedPath;
        sess.tempUploads.gasBook = optimizedPath;
        if (!sess.citizenProfile.documents) sess.citizenProfile.documents = {};
        sess.citizenProfile.documents.gasBook = optimizedPath;
        sess.citizenProfile.documents.residenceProof = optimizedPath;
        if (!sess.citizenProfile.gasDetails) sess.citizenProfile.gasDetails = {};
        sess.citizenProfile.gasDetails.gasBookPath = optimizedPath;
        sess.citizenProfile.gasDetails.hasGas = true;
        if (!sess.citizenProfile.residenceProof) sess.citizenProfile.residenceProof = {};
        sess.citizenProfile.residenceProof.docPath = optimizedPath;

        try {
            const appDataUp = path.join(process.env.APPDATA || 'C:\\Users\\ADMIN\\AppData\\Roaming', 'esevadraft-desktop', 'data', 'uploads', targetMobile);
            const localDataUp = path.join(__dirname, '..', '..', 'data', 'uploads', targetMobile);
            for (const d of [appDataUp, localDataUp]) {
                if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
                const ext = path.extname(optimizedPath) || '.jpg';
                const targetGasFile = path.join(d, `gas${ext}`);
                if (optimizedPath !== targetGasFile) fs.copyFileSync(optimizedPath, targetGasFile);
            }
        } catch (_) {}

        if (extracted) {
            const isGasDoc = docType === 'gasBook' ||
                             extracted?.documentType === 'GAS_BOOK' || 
                             extracted?.residenceProofCategory === 'GAS_BOOK' ||
                             !!(extracted?.gasDetails?.consumerNumber);

            if (isGasDoc) {
                sess.citizenProfile.residenceProof.type = 'GAS_BOOK';
                sess.citizenProfile.residenceProof.typeTam = 'எரிவாயு நுகர்வோர் அட்டை';
            } else if (extracted.residenceProofCategory && extracted.residenceProofCategory !== 'NONE') {
                sess.citizenProfile.residenceProof.type = extracted.residenceProofCategory;
                if (extracted.residenceProofNameTamil) {
                    sess.citizenProfile.residenceProof.typeTam = extracted.residenceProofNameTamil;
                }
            }

            const gas = extracted?.gasDetails || {};
            const co = gas.oilCompany || sess.citizenProfile.gasDetails?.oilCompany || 'IOC';
            const coDisplay = gas.oilCompanyDisplay || (co === 'IOC' ? 'Indane Gas (IOCL)' : (co === 'HPC' ? 'HP Gas (HPC)' : 'Bharat Gas (BPCL)'));
            const consumerNo = String(gas.consumerNumber || '').trim();
            const agency = String(gas.agencyName || '').trim();
            const cylinders = String(gas.cylinders || sess.citizenProfile.gasDetails?.cylinders || '1');
            const consumerName = gas.consumerName || extracted.fullNameTam || sess.citizenProfile.fullNameTam || '';

            if (isGasDoc || consumerNo) {
                sess.citizenProfile.gasDetails = {
                    ...(sess.citizenProfile.gasDetails || {}),
                    hasGas: true,
                    consumerName: consumerName || sess.citizenProfile.gasDetails?.consumerName || '',
                    oilCompany: co,
                    oilCompanyDisplay: coDisplay,
                    consumerNumber: consumerNo || sess.citizenProfile.gasDetails?.consumerNumber || '',
                    agencyName: agency || sess.citizenProfile.gasDetails?.agencyName || '',
                    cylinders: cylinders,
                    gasBookPath: optimizedPath
                };
            }

            if (extracted.isQualityAcceptable !== false) {
                extractedData = extracted;
                if (extracted.doorNo) sess.citizenProfile.doorNo = extracted.doorNo;
                if (extracted.streetTam) sess.citizenProfile.streetTam = extracted.streetTam;
                if (extracted.streetEng) sess.citizenProfile.streetEng = extracted.streetEng;
                if (extracted.areaTam) sess.citizenProfile.areaTam = extracted.areaTam;
                if (extracted.areaEng) sess.citizenProfile.areaEng = extracted.areaEng;
                if (extracted.pincode) sess.citizenProfile.pincode = extracted.pincode;
                if (extracted.district) sess.citizenProfile.district = extracted.district;
                if (extracted.districtTam) sess.citizenProfile.districtTam = extracted.districtTam;
                if (extracted.taluk) sess.citizenProfile.taluk = extracted.taluk;
                if (extracted.talukTam) sess.citizenProfile.talukTam = extracted.talukTam;
                if (extracted.village) sess.citizenProfile.village = extracted.village;
                if (extracted.villageTam) sess.citizenProfile.villageTam = extracted.villageTam;
            }
        } else {
            sess.citizenProfile.gasDetails = {
                ...(sess.citizenProfile.gasDetails || {}),
                hasGas: true,
                gasBookPath: optimizedPath
            };
        }
    } else {
        let extractedOther = null;
        try {
            extractedOther = await inspectAndExtractDocument(uploadedFile.path, { skipFaceExtraction: true });
        } catch (_) {}

        try {
            optimizedPath = await produceCompliantDocument(uploadedFile.path, {
                boundingBox: extractedOther?.documentBoundingBox
            });
        } catch (e) {
            optimizedPath = uploadedFile.path;
        }
        sess.tempUploads = sess.tempUploads || {};
        sess.citizenProfile.documents = sess.citizenProfile.documents || {};
        sess.tempUploads[docType] = optimizedPath;
        sess.citizenProfile.documents[docType] = optimizedPath;

        const isSmartCardDoc = (docType === 'smartCard' || docType === 'smartCardFront' || docType === 'smartCardBack' || docType === 'rationCard' || docType === 'rationCardFront' || docType === 'rationCardBack');
        if (isSmartCardDoc) {
            if (docType.endsWith('Back')) {
                sess.tempUploads.smartCardBack = optimizedPath;
                sess.citizenProfile.documents.smartCardBack = optimizedPath;
            } else {
                sess.tempUploads.smartCardFront = optimizedPath;
                sess.citizenProfile.documents.smartCardFront = optimizedPath;
            }
            const scFront = sess.tempUploads.smartCardFront || sess.citizenProfile.documents.smartCardFront || (!docType.endsWith('Back') ? optimizedPath : sess.citizenProfile.smartCardDocPath);
            const scBack = sess.tempUploads.smartCardBack || sess.citizenProfile.documents.smartCardBack || (docType.endsWith('Back') ? optimizedPath : null);
            if (scFront && scBack && scFront !== scBack && fs.existsSync(scFront) && fs.existsSync(scBack)) {
                try {
                    const mergedSc = await produceDualSidedDocument(scFront, scBack);
                    if (mergedSc && fs.existsSync(mergedSc)) {
                        optimizedPath = mergedSc;
                    }
                } catch (_) {}
            }
            sess.tempUploads.smartCard = optimizedPath;
            sess.tempUploads.rationCard = optimizedPath;
            sess.citizenProfile.documents.smartCard = optimizedPath;
            sess.citizenProfile.documents.rationCard = optimizedPath;
            sess.citizenProfile.smartCardDocPath = optimizedPath;
            sess.citizenProfile.rationCardDocPath = optimizedPath;
        }

        if (extractedOther && extractedOther.isQualityAcceptable !== false) {
            extractedData = extractedOther;
            if (extractedOther.smartCardNumber) {
                sess.citizenProfile.smartCardNumber = extractedOther.smartCardNumber;
                sess.citizenProfile.rationCardNo = extractedOther.smartCardNumber;
            }
            if (isSmartCardDoc) {
                if (extractedOther.doorNo) sess.citizenProfile.doorNo = extractedOther.doorNo;
                if (extractedOther.streetTam) sess.citizenProfile.streetTam = extractedOther.streetTam;
                if (extractedOther.streetEng) sess.citizenProfile.streetEng = extractedOther.streetEng;
                if (extractedOther.areaTam) sess.citizenProfile.areaTam = extractedOther.areaTam;
                if (extractedOther.areaEng) sess.citizenProfile.areaEng = extractedOther.areaEng;
                if (extractedOther.pincode) sess.citizenProfile.pincode = extractedOther.pincode;
                if (extractedOther.district) sess.citizenProfile.district = extractedOther.district;
                if (extractedOther.taluk) sess.citizenProfile.taluk = extractedOther.taluk;
                if (extractedOther.village) sess.citizenProfile.village = extractedOther.village;
            }
        }

        if (!isSmartCardDoc) {
            const baseDocType = docType.replace(/(Front|Back)$/, '');
            const fKey = `${baseDocType}Front`;
            const bKey = `${baseDocType}Back`;
            if (docType === baseDocType && !sess.tempUploads[fKey]) {
                sess.tempUploads[fKey] = optimizedPath;
            }
            const fPath = sess.tempUploads[fKey] || sess.citizenProfile.documents[fKey] || sess.tempUploads[baseDocType];
            const bPath = sess.tempUploads[bKey] || sess.citizenProfile.documents[bKey];
            if (fPath && bPath && fPath !== bPath) {
                try {
                    const mergedPdf = await produceDualSidedDocument(fPath, bPath);
                    if (mergedPdf && fs.existsSync(mergedPdf)) {
                        optimizedPath = mergedPdf;
                        sess.tempUploads[baseDocType] = mergedPdf;
                        sess.citizenProfile.documents[baseDocType] = mergedPdf;
                    }
                } catch (_) {}
            }
        }
    }

    sess.base64Docs = sess.base64Docs || {};
    sess.citizenProfile.base64Docs = sess.citizenProfile.base64Docs || {};
    try {
        if (fs.existsSync(optimizedPath)) {
            const b64 = fs.readFileSync(optimizedPath).toString('base64');
            const bName = path.basename(optimizedPath);
            const canonicalKey = docType.replace(/(Front|Back)$/, '');
            sess.base64Docs[`${docType}Base64`] = b64;
            sess.base64Docs[`${docType}Name`] = bName;
            sess.base64Docs[`${canonicalKey}Base64`] = b64;
            sess.base64Docs[`${canonicalKey}Name`] = bName;
            sess.citizenProfile.base64Docs[`${docType}Base64`] = b64;
            sess.citizenProfile.base64Docs[`${docType}Name`] = bName;
            sess.citizenProfile.base64Docs[`${canonicalKey}Base64`] = b64;
            sess.citizenProfile.base64Docs[`${canonicalKey}Name`] = bName;
            if (canonicalKey === 'smartCard' || canonicalKey === 'rationCard') {
                sess.base64Docs.smartCardBase64 = b64;
                sess.base64Docs.smartCardName = bName;
                sess.base64Docs.rationCardBase64 = b64;
                sess.base64Docs.rationCardName = bName;
                sess.citizenProfile.base64Docs.smartCardBase64 = b64;
                sess.citizenProfile.base64Docs.smartCardName = bName;
                sess.citizenProfile.base64Docs.rationCardBase64 = b64;
                sess.citizenProfile.base64Docs.rationCardName = bName;
            }
            if (docType === 'residenceProof' || docType === 'gasBook' || canonicalKey === 'residenceProof') {
                sess.base64Docs.gasBookBase64 = b64;
                sess.base64Docs.gasBookName = bName;
                sess.base64Docs.residenceProofBase64 = b64;
                sess.base64Docs.residenceProofName = bName;
                sess.citizenProfile.base64Docs.gasBookBase64 = b64;
                sess.citizenProfile.base64Docs.gasBookName = bName;
                sess.citizenProfile.base64Docs.residenceProofBase64 = b64;
                sess.citizenProfile.base64Docs.residenceProofName = bName;
            }
            if (canonicalKey === 'memberAadhaar') {
                sess.base64Docs.memberAadhaarsBase64 = [{ name: bName, base64: b64 }];
                sess.citizenProfile.base64Docs.memberAadhaarsBase64 = [{ name: bName, base64: b64 }];
            }
        }
    } catch (bErr) {}

    let fileSizeKB = null;
    try {
        if (fs.existsSync(optimizedPath)) {
            fileSizeKB = Number((fs.statSync(optimizedPath).size / 1024).toFixed(1));
        }
    } catch (_) {}

    return { optimizedPath, extractedData, fileSizeKB };
}

module.exports = {
    processUploadedDocument
};
