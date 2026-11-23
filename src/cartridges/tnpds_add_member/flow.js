const adultFsm = require('../../core/fsm/fsm_add_member_adult');
const childFsm = require('../../core/fsm/fsm_add_member_child');
const docFsm = require('../../core/fsm/fsm_member_doc_upload');
const { renderSubserviceReadySummary } = require('../../core/fsm/fsm_summary_formatter');
const { getVerifiedRationCardDocs } = require('../../services/profile_helpers');

function cleanupAddMemberUploads(sess) {
    if (sess.tempUploads) {
        delete sess.tempUploads.memberAadhaar;
        delete sess.tempUploads.memberAadhaarFront;
        delete sess.tempUploads.memberAadhaarBack;
        delete sess.tempUploads.birthCertificate;
        delete sess.tempUploads.surrenderProof;
    }
    if (sess.citizenProfile && sess.citizenProfile.documents) {
        delete sess.citizenProfile.documents.memberAadhaar;
        delete sess.citizenProfile.documents.memberAadhaarFront;
        delete sess.citizenProfile.documents.memberAadhaarBack;
        delete sess.citizenProfile.documents.memberAadhaars;
        delete sess.citizenProfile.documents.birthCertificate;
        delete sess.citizenProfile.documents.surrenderProof;
    }
    if (sess.documents) {
        delete sess.documents.memberAadhaar;
        delete sess.documents.memberAadhaarFront;
        delete sess.documents.memberAadhaarBack;
        delete sess.documents.memberAadhaars;
        delete sess.documents.birthCertificate;
        delete sess.documents.surrenderProof;
    }
}

function enterService(sess, { isDirectOperator = false } = {}) {
    sess.service = 'ரேஷன் கார்டு';
    sess.subService = 'ADD_MEMBER';
    sess.pluginId = 'TNPDS_ADD_MEMBER';
    if (sess.citizenProfile) {
        sess.citizenProfile.subService = 'ADD_MEMBER';
        sess.citizenProfile.pluginId = 'TNPDS_ADD_MEMBER';
    }
    if (isDirectOperator) {
        sess.subServiceData = sess.subServiceData || {};
        if (sess.citizenProfile?.rationCardNo) sess.subServiceData.rationCardNo = sess.citizenProfile.rationCardNo;
        if (sess.citizenProfile?.district) sess.subServiceData.district = sess.citizenProfile.district;
        if (sess.citizenProfile?.taluk) sess.subServiceData.taluk = sess.citizenProfile.taluk;
        if (sess.citizenProfile?.village) sess.subServiceData.village = sess.citizenProfile.village;
        sess.chatHistory = [];
    }

    const subData = sess.subServiceData || sess.citizenProfile?.subServiceData || {};
    const tempMem = sess.tempMember || sess.citizenProfile?.tempMember || null;
    if (tempMem) {
        const isHead = (tempMem.nameTam && tempMem.nameTam === sess.citizenProfile?.fullNameTam) ||
                       (tempMem.aadhaarNo && tempMem.aadhaarNo === sess.citizenProfile?.headAadhaar);
        if (!isHead) {
            if (!subData.memberName) subData.memberName = tempMem.nameTam || tempMem.nameEng || tempMem.name || '';
            if (!subData.memberNameTam) subData.memberNameTam = tempMem.nameTam || '';
            if (!subData.memberNameEng) subData.memberNameEng = tempMem.nameEng || '';
            if (!subData.aadhaarNo) subData.aadhaarNo = tempMem.aadhaarNo || tempMem.aadhaarNumber || '';
            if (!subData.relationshipTam) subData.relationshipTam = tempMem.relationshipTam || tempMem.relationship || '';
            if (!subData.dob) subData.dob = tempMem.dob || '';
            if (!subData.genderTam) subData.genderTam = tempMem.genderTam || (tempMem.gender === 'Female' ? 'பெண்' : (tempMem.gender === 'Male' ? 'ஆண்' : ''));
            if (!subData.gender) subData.gender = tempMem.gender || '';
            if (!subData.docPath && tempMem.docPath && tempMem.docPath !== sess.citizenProfile?.headAadhaarDocPath) {
                subData.docPath = tempMem.docPath;
            }
        }
    }

    const { memberAadhaarDoc, hasMemberAadhaarDoc } = getVerifiedRationCardDocs(sess.citizenProfile, sess.tempUploads);
    let existingMemDoc = subData.aadhaarDocPath || subData.docPath;
    if (!existingMemDoc && hasMemberAadhaarDoc) existingMemDoc = memberAadhaarDoc;

    if (existingMemDoc && sess.citizenProfile) {
        const prof = sess.citizenProfile;
        if (!subData.memberNameTam && prof.fullNameTam) subData.memberNameTam = prof.fullNameTam;
        if (!subData.memberNameEng && prof.fullNameEng) subData.memberNameEng = prof.fullNameEng;
        if (!subData.memberName) subData.memberName = subData.memberNameTam || subData.memberNameEng || '';
        if (!subData.fatherNameTam && prof.fatherNameTam) subData.fatherNameTam = prof.fatherNameTam;
        if (!subData.fatherNameEng && prof.fatherNameEng) subData.fatherNameEng = prof.fatherNameEng;
        if (!subData.dob && prof.dob) subData.dob = prof.dob;
        if (!subData.gender && prof.gender) subData.gender = prof.gender;
        if (!subData.genderTam && (prof.genderTam || prof.gender)) {
            subData.genderTam = prof.genderTam || (prof.gender === 'Female' ? 'பெண்' : (prof.gender === 'Male' ? 'ஆண்' : prof.gender));
        }
        if (!subData.aadhaarNo && (prof.headAadhaar || prof.aadhaarNumber)) {
            subData.aadhaarNo = prof.headAadhaar || prof.aadhaarNumber;
        }
        subData.docPath = existingMemDoc;
        subData.aadhaarDocPath = existingMemDoc;
        if (!sess.tempUploads) sess.tempUploads = {};
        sess.tempUploads.memberAadhaar = existingMemDoc;
        if (!prof.documents) prof.documents = {};
        prof.documents.memberAadhaar = existingMemDoc;
    }
    if (existingMemDoc && !subData.docPath) subData.docPath = existingMemDoc;

    const memberName = subData.memberName || subData.memberNameTam || subData.memberNameEng || '';
    const aadhaarNo = subData.aadhaarNo || subData.aadhaarNumber || '';
    const relTam = subData.relationshipTam || '';

    if (memberName && aadhaarNo && relTam && existingMemDoc) {
        sess.subServiceData = subData;
        sess.intakeState = 'READY_TO_APPLY';
        sess.step = 'READY';
        sess.chatHistory.push(renderSubserviceReadySummary(sess));
        return true;
    }

    if (existingMemDoc && ((existingMemDoc && !relTam) || (memberName && aadhaarNo && !relTam))) {
        sess.subServiceData = subData;
        sess.intakeState = 'RATION_ADD_MEMBER_RELATION';
        const nameDisplay = subData.memberNameTam && subData.memberNameEng
            ? `${subData.memberNameTam} (${subData.memberNameEng})`
            : (memberName || 'புதிய குடும்ப உறுப்பினர்');
        const aadhaarDisplay = aadhaarNo ? `\n• 🪪 **ஆதார் எண்:** ${aadhaarNo.replace(/(\d{4})/g, '$1 ').trim()}` : '';
        const dobDisplay = subData.dob ? `\n• 📅 **பிறந்த தேதி:** ${subData.dob}` : '';
        const genderDisplay = subData.genderTam ? `\n• ⚧ **பாலினம்:** ${subData.genderTam}` : '';
        sess.chatHistory.push({
            sender: 'bot',
            text: `✅ **ஆதார் அட்டை விவரங்கள் ஏற்கெனவே பெறப்பட்டுள்ளன!** 🪪\n\n` +
                  `• 👤 **உறுப்பினர் பெயர்:** ${nameDisplay}${aadhaarDisplay}${dobDisplay}${genderDisplay}\n\n` +
                  `❓ **குடும்பத் தலைவருடன் இவரின் உறவுமுறை என்ன?**\n\n` +
                  `கீழே உள்ள விருப்பத்தைத் தேர்ந்தெடுக்கவும் (அல்லது நேரடியாக தட்டச்சு செய்யவும்):`,
            options: [
                { label: "👦 மகன் (Son)", value: "மகன்" },
                { label: "👧 மகள் (Daughter)", value: "மகள்" },
                { label: "👰 மனைவி (Wife)", value: "மனைவி" },
                { label: "🤵 கணவர் (Husband)", value: "கணவர்" },
                { label: "👵 தாய் (Mother)", value: "தாய்" },
                { label: "👴 தந்தை (Father)", value: "தந்தை" },
                { label: "👫 மருமகள் (Daughter-in-law)", value: "மருமகள்" },
                { label: "👫 மருமகன் (Son-in-law)", value: "மருமகன்" },
                { label: "🔄 புதிய ஆவணம் மாற்று", value: "RATION_ADD_MEMBER_RESET" },
                { label: "🔙 பின்செல்ல", value: "ரேஷன் கார்டு" }
            ]
        });
        return true;
    }

    sess.intakeState = 'RATION_ADD_MEMBER_TYPE';
    sess.step = 'RATION_ADD_MEMBER_TYPE';
    sess.chatHistory.push({
        sender: 'bot',
        text: `➕ **குடும்ப உறுப்பினர் சேர்க்கை (Add Family Member)**\n\n` +
              `சேர்க்கப்பட வேண்டிய புதிய உறுப்பினரின் **ஆதார் அட்டையைப்** பதிவேற்றவும் (அல்லது புகைப்படம் எடுக்கவும்):`,
        actionRequired: 'upload',
        uploadPrompt: 'உறுப்பினர் ஆதார் அட்டை',
        options: [
            { label: "📷 ஆதார் அட்டை பதிவேற்றவும்", value: "TRIGGER_FILE_UPLOAD" },
            { label: "🔙 ரேஷன் கார்டு சேவைகள்", value: "ரேஷன் கார்டு" }
        ]
    });
    return true;
}

async function handleFlow(text, sess, uploadedDoc = null, extractedDoc = null) {
    if (!sess) return false;
    const currentState = sess.intakeState;

    if (text === 'RATION_ADD_MEMBER_RESET' || (text && text.includes('புதிய ஆவணம் மாற்று'))) {
        sess.subService = 'ADD_MEMBER';
        sess.subServiceData = {};
        cleanupAddMemberUploads(sess);
        sess.intakeState = 'RATION_ADD_MEMBER_TYPE';
        sess.step = 'RATION_ADD_MEMBER_TYPE';
        sess.chatHistory.push({
            sender: 'bot',
            text: `➕ **புதிய உறுப்பினர் சேர்க்கை (Add Member - புதுப்பித்தல்)**\n\n` +
                  `சேர்க்கப்பட வேண்டிய புதிய உறுப்பினரின் **ஆதார் அட்டையைப்** பதிவேற்றவும் (அல்லது புகைப்படம் எடுக்கவும்):`,
            actionRequired: 'upload',
            uploadPrompt: 'உறுப்பினர் ஆதார் அட்டை',
            options: [
                { label: "📷 ஆதார் அட்டை பதிவேற்றவும்", value: "TRIGGER_FILE_UPLOAD" },
                { label: "🔙 ரேஷன் கார்டு சேவைகள்", value: "ரேஷன் கார்டு" }
            ]
        });
        return true;
    }

    if (await childFsm.handleAddMemberChild(text, sess, currentState, uploadedDoc, extractedDoc)) return true;
    if (await adultFsm.handleAddMemberAdult(text, sess, currentState, uploadedDoc, extractedDoc)) return true;
    if (await docFsm.handleMemberDocUpload(text, sess, currentState, uploadedDoc, extractedDoc)) return true;
    return false;
}

function onDocumentDeleted(sess, docType) {
    if (!sess) return false;
    sess.subService = 'ADD_MEMBER';
    sess.chatHistory = Array.isArray(sess.chatHistory) ? sess.chatHistory : [];
    if (docType === 'memberAadhaar' || docType === 'memberAadhaarFront' || docType === 'memberAadhaarBack') {
        cleanupAddMemberUploads(sess);
        if (sess.subServiceData) {
            delete sess.subServiceData.docPath;
            delete sess.subServiceData.aadhaarDocPath;
        }
        sess.intakeState = 'RATION_ADD_MEMBER_TYPE';
        sess.chatHistory.push({
            sender: 'bot',
            text: `🗑️ **புதிய உறுப்பினர் ஆதார் அட்டை நீக்கப்பட்டது!**\n\nசேர்க்கப்பட வேண்டிய உறுப்பினரின் புதிய **ஆதார் அட்டையைப்** பதிவேற்றவும்:`,
            options: [
                { label: "📷 ஆதார் அட்டை பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
            ]
        });
        return true;
    }
    if (docType === 'memberProof' || docType === 'birthCertificate' || docType === 'surrenderProof') {
        if (sess.subServiceData) {
            delete sess.subServiceData.proofDocPath;
            delete sess.subServiceData.birthDocPath;
            delete sess.subServiceData.surrenderDocPath;
        }
    }
    return true;
}

module.exports = {
    ...adultFsm,
    ...childFsm,
    ...docFsm,
    cleanupAddMemberUploads,
    enterService,
    handleFlow,
    onDocumentDeleted
};
