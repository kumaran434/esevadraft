const { createFreshProfile } = require('./storage_service');
const { isProfileDataComplete } = require('./profile_helpers');

function mergeDraftIntoSession(sess, draft, cleanMobile) {
    if (!draft) return sess;
    const prof = draft.citizenProfile || {};
    const hasDraftData = prof && (
        prof.fullNameTam || prof.fullNameEng || prof.headDob || prof.headGender ||
        prof.headAadhaar || prof.fatherNameTam || prof.fatherNameEng || prof.doorNo ||
        prof.streetTam || prof.pincode || (prof.members && prof.members.length > 0) ||
        prof.headPhotoPath || prof.isExtracted
    );
    if (!hasDraftData) return sess;

    const fresh = createFreshProfile(cleanMobile);
    const prevProf = sess.citizenProfile || {};
    const draftProf = draft.citizenProfile || {};
    const mergedGas = Object.assign({}, fresh.gasDetails || {}, prevProf.gasDetails || {}, draftProf.gasDetails || {});
    if (draftProf.gasDetails?.consumerNumber && !mergedGas.consumerNumber) mergedGas.consumerNumber = draftProf.gasDetails.consumerNumber;
    if (draftProf.gasDetails?.agencyName && !mergedGas.agencyName) mergedGas.agencyName = draftProf.gasDetails.agencyName;
    if (draftProf.gasDetails?.cylinders && (!mergedGas.cylinders || mergedGas.cylinders === '0')) mergedGas.cylinders = draftProf.gasDetails.cylinders;
    if (draftProf.gasDetails?.oilCompany && !mergedGas.oilCompany) mergedGas.oilCompany = draftProf.gasDetails.oilCompany;
    if (draftProf.gasDetails?.oilCompanyDisplay && !mergedGas.oilCompanyDisplay) mergedGas.oilCompanyDisplay = draftProf.gasDetails.oilCompanyDisplay;
    
    const gasDoc = draft.documents?.gasBook || draftProf.documents?.gasBook || draftProf.residenceProof?.docPath || draftProf.gasDetails?.gasBookPath || null;
    if (gasDoc) {
        mergedGas.gasBookPath = gasDoc;
        mergedGas.hasGas = true;
        if (!mergedGas.cylinders || mergedGas.cylinders === '0') mergedGas.cylinders = '1';
        if (!mergedGas.oilCompany) mergedGas.oilCompany = 'IOC';
        if (!mergedGas.oilCompanyDisplay) mergedGas.oilCompanyDisplay = 'Indane Gas (IOCL)';
    }

    const mergedResidence = draftProf.residenceProof || prevProf.residenceProof || (gasDoc ? { type: 'GAS_BOOK', typeTam: 'எரிவாயு நுகர்வோர் அட்டை', docPath: gasDoc } : null);

    sess.citizenProfile = {
        ...fresh,
        ...prevProf,
        ...draftProf,
        gasDetails: mergedGas,
        residenceProof: mergedResidence,
        cardTypeTam: draftProf.cardTypeTam || prevProf.cardTypeTam || 'அரிசி அட்டை'
    };
    sess.intakeState = draft.intakeState || 'MEMBER_COUNT';
    sess.step = draft.step || 'draft';
    sess.subService = draft.subService || draftProf.subService || 
                      ((draft.intakeState === 'READY_TO_APPLY_CAN' || draftProf.intakeState === 'READY_TO_APPLY_CAN' || draft.serviceId === 'TNEGA_CAN_REGISTER') ? 'CAN_REGISTER' : sess.subService) || null;
    sess.subServiceData = draft.subServiceData || draftProf.subServiceData || sess.subServiceData || null;
    sess.tempUploads = draft.documents || sess.tempUploads || {};
    sess.applicationNumber = draft.applicationNumber || null;
    sess.applicationPdfUrl = draft.applicationPdfUrl || null;
    if (draft.operatorUid) sess.operatorUid = draft.operatorUid;

    if (draft.chatHistory && draft.chatHistory.length > 0) {
        sess.chatHistory = draft.chatHistory;
    }

    const lastMsgInDraft = Array.isArray(sess.chatHistory) && sess.chatHistory.length > 0 ? sess.chatHistory[sess.chatHistory.length - 1] : null;
    const isSubServiceReady = sess.intakeState === 'RATION_ADD_MEMBER_READY' || sess.intakeState === 'RATION_CHANGE_ADDRESS_READY' || sess.subService === 'ADD_MEMBER' || sess.subService === 'CHANGE_ADDRESS';
    const isBrowsingServices = sess.intakeState === 'SERVICE_SELECTION' || 
                               sess.intakeState === 'RATION_CARD_SERVICES' ||
                               (sess.intakeState && sess.intakeState.startsWith('RATION_')) ||
                               (sess.intakeState && sess.intakeState.startsWith('INCOME_')) ||
                               (sess.intakeState && sess.intakeState.startsWith('CAN_')) ||
                               sess.intakeState === 'READY_TO_APPLY_INCOME' ||
                               sess.intakeState === 'READY_TO_APPLY_CAN' ||
                               sess.intakeState === 'RESIDENCE_INTAKE' ||
                               sess.intakeState === 'READY_TO_APPLY_RESIDENCE' ||
                               sess.subService === 'INCOME' ||
                               sess.subService === 'CAN_REGISTER' ||
                               (lastMsgInDraft && lastMsgInDraft.text && (
                                   lastMsgInDraft.text.includes('குடும்ப அட்டை (Ration Card) சேவைகள்') ||
                                   lastMsgInDraft.text.includes('எந்த அரசு சேவைக்கு விண்ணப்பிக்க விரும்புகிறீர்கள்')
                               ));

    const isProfileComplete = !isBrowsingServices && isProfileDataComplete(sess.citizenProfile, sess.tempUploads);

    if (isProfileComplete) {
        sess.intakeState = 'READY_TO_APPLY';
        sess.step = 'READY';
        sess.targetMemberCount = (sess.citizenProfile.members && sess.citizenProfile.members.length) || 1;
    }

    sess.chatHistory = sess.chatHistory.filter(m => {
        if (!m || !m.text) return false;
        if (isProfileComplete && (m.actionRequired === 'upload' || m.uploadPrompt)) return false;
        if (m.text.includes('CONTINUE_INTAKE') || 
            m.text.includes('முந்தைய விண்ணப்ப வரைவு') ||
            m.text.includes('விண்ணப்பம் பாதி நிரப்பப்பட்டுள்ளது') ||
            (!isSubServiceReady && m.text.includes('விண்ணப்பம் தயார்')) ||
            (isProfileComplete && (m.text.includes('பதிவேற்றவும்') || m.text.includes('உறுப்பினர் 2')))) {
            return false;
        }
        return true;
    });

    return sess;
}

module.exports = {
    mergeDraftIntoSession
};
