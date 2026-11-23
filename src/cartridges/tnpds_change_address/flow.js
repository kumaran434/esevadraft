const { renderSubserviceReadySummary } = require('../../core/fsm/fsm_summary_formatter');
const { getVerifiedRationCardDocs } = require('../../services/profile_helpers');

function enterService(sess, { isDirectOperator = false } = {}) {
    sess.service = 'ரேஷன் கார்டு';
    sess.subService = 'CHANGE_ADDRESS';
    sess.pluginId = 'TNPDS_CHANGE_ADDRESS';
    if (sess.citizenProfile) {
        sess.citizenProfile.subService = 'CHANGE_ADDRESS';
        sess.citizenProfile.pluginId = 'TNPDS_CHANGE_ADDRESS';
    }
    if (isDirectOperator) {
        sess.subServiceData = sess.subServiceData || {};
        sess.chatHistory = [];
    }

    const subData = sess.subServiceData || sess.citizenProfile?.subServiceData || {};
    const { residenceDoc, hasResidenceDoc } = getVerifiedRationCardDocs(sess.citizenProfile, sess.tempUploads);

    if (hasResidenceDoc && sess.citizenProfile) {
        const prof = sess.citizenProfile;
        if (!subData.doorNo) subData.doorNo = prof.doorNo || '1';
        if (!subData.streetTam) subData.streetTam = prof.streetTam || prof.areaTam || prof.village || prof.taluk || 'முகவரி';
        if (!subData.streetEng) subData.streetEng = prof.streetEng || prof.areaEng || prof.village || prof.taluk || 'Address';
        if (!subData.areaTam && prof.areaTam) subData.areaTam = prof.areaTam;
        if (!subData.areaEng && prof.areaEng) subData.areaEng = prof.areaEng;
        if (!subData.pincode && prof.pincode) subData.pincode = prof.pincode;
        if (!subData.district && prof.district) subData.district = prof.district;
        if (!subData.taluk && prof.taluk) subData.taluk = prof.taluk;
        if (!subData.village && prof.village) subData.village = prof.village;
        if (!subData.rationCardNo && prof.rationCardNo) subData.rationCardNo = prof.rationCardNo;
        if (!subData.proofType) subData.proofType = prof.residenceProofType || 'Gas Bill (எரிவாயு ரசீது)';
        subData.addressProofDocPath = residenceDoc;
        subData.docPath = residenceDoc;
        if (!sess.tempUploads) sess.tempUploads = {};
        sess.tempUploads.newAddressProof = residenceDoc;
        if (!prof.documents) prof.documents = {};
        prof.documents.newAddressProof = residenceDoc;
    }

    const hasAddressDoc = sess.citizenProfile ? hasResidenceDoc : true;
    const doorNo = subData.doorNo || '';
    const streetTam = subData.streetTam || subData.streetEng || '';

    if (doorNo && streetTam && hasAddressDoc) {
        sess.subServiceData = subData;
        sess.intakeState = 'READY_TO_APPLY';
        sess.step = 'READY';
        sess.chatHistory.push(renderSubserviceReadySummary(sess));
        return true;
    }

    sess.intakeState = 'RATION_CHANGE_ADDRESS_DOC';
    sess.chatHistory.push({
        sender: 'bot',
        text: `📍 **முகவரி மாற்றம் (Change Address)**\n\n` +
              `ஒரே வட்டத்திற்குள் அல்லது வேறு மாவட்டம்/வட்டத்திற்கு குடும்ப அட்டையின் முகவரியை மாற்றலாம்.\n\n` +
              `📋 **புதிய முகவரிக்கான சான்றாக எந்த ஆவணத்தைப் பதிவேற்ற விரும்புகிறீர்கள்?**`,
        actionRequired: 'upload',
        uploadPrompt: 'முகவரிச் சான்று / எரிவாயு புத்தகம் பதிவேற்றுக',
        options: [
            { label: "⛽ எரிவாயு நுகர்வோர் அட்டை (Gas Bill)", value: "ADDR_PROOF_GAS" },
            { label: "⚡ மின் கட்டண ரசீது (EB Bill)", value: "ADDR_PROOF_EB" },
            { label: "📄 வாடகை ஒப்பந்தம் (Rental Agreement)", value: "ADDR_PROOF_RENT" },
            { label: "🏛️ சொத்து வரி ரசீது (Property Tax)", value: "ADDR_PROOF_TAX" },
            { label: "🪪 புதிய முகவரி ஆதார் அட்டை (Aadhaar)", value: "ADDR_PROOF_AADHAAR" },
            { label: "📷 ஆவணத்தைப் பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
            { label: "🔙 ரேஷன் கார்டு சேவைகள்", value: "ரேஷன் கார்டு" }
        ]
    });
    return true;
}

function handleFlow(text, sess, uploadedDoc = null) {
    if (!sess) return false;
    const currentState = sess.intakeState;

    if (text === 'RATION_CHANGE_ADDRESS_RESET' || (text && text.includes('முகவரியை மாற்று'))) {
        sess.subService = 'CHANGE_ADDRESS';
        sess.subServiceData = {};
        sess.intakeState = 'RATION_CHANGE_ADDRESS_DOC';
        sess.chatHistory.push({
            sender: 'bot',
            text: `📍 **முகவரி மாற்றம் (Change Address - புதுப்பித்தல்)**\n\n` +
                  `📋 **புதிய முகவரிக்கான சான்றாக எந்த ஆவணத்தைப் பதிவேற்ற விரும்புகிறீர்கள்?**`,
            options: [
                { label: "⚡ மின் கட்டண ரசீது (EB Bill)", value: "ADDR_PROOF_EB" },
                { label: "⛽ எரிவாயு நுகர்வோர் அட்டை (Gas Bill)", value: "ADDR_PROOF_GAS" },
                { label: "📄 வாடகை ஒப்பந்தம் (Rental Agreement)", value: "ADDR_PROOF_RENT" },
                { label: "🏛️ சொத்து வரி ரசீது (Property Tax)", value: "ADDR_PROOF_TAX" },
                { label: "🪪 புதிய முகவரி ஆதார் அட்டை (Aadhaar)", value: "ADDR_PROOF_AADHAAR" },
                { label: "🔙 ரேஷன் கார்டு சேவைகள்", value: "ரேஷன் கார்டு" }
            ]
        });
        return true;
    }

    if (currentState === 'RATION_CHANGE_ADDRESS' || currentState === 'RATION_CHANGE_ADDRESS_DOC') {
        sess.subService = 'CHANGE_ADDRESS';
        if (uploadedDoc && uploadedDoc.path) {
            sess.subServiceData = sess.subServiceData || {};
            sess.subServiceData.addressProofDocPath = uploadedDoc.path;
            sess.subServiceData.docPath = uploadedDoc.path;
            if (!sess.subServiceData.proofType) sess.subServiceData.proofType = 'எரிவாயு ரசீது (Gas Bill)';
            if (!sess.tempUploads) sess.tempUploads = {};
            sess.tempUploads.residenceProof = uploadedDoc.path;
            sess.tempUploads.gasBook = uploadedDoc.path;
            sess.tempUploads.newAddressProof = uploadedDoc.path;
            if (sess.citizenProfile) {
                sess.citizenProfile.residenceProof = uploadedDoc.path;
                if (!sess.citizenProfile.documents) sess.citizenProfile.documents = {};
                sess.citizenProfile.documents.residenceProof = uploadedDoc.path;
                sess.citizenProfile.documents.gasBook = uploadedDoc.path;
                sess.citizenProfile.documents.newAddressProof = uploadedDoc.path;
            }
            sess.intakeState = 'READY_TO_APPLY';
            sess.step = 'READY';
            sess.chatHistory.push(renderSubserviceReadySummary(sess));
            return true;
        }
        let proof = 'மின் கட்டண ரசீது (EB Bill)';
        if (text === 'ADDR_PROOF_GAS' || text.includes('எரிவாயு')) proof = 'எரிவாயு ரசீது (Gas Bill)';
        else if (text === 'ADDR_PROOF_RENT' || text.includes('வாடகை')) proof = 'வாடகை ஒப்பந்தம் (Rental Agreement)';
        else if (text === 'ADDR_PROOF_TAX' || text.includes('வரி')) proof = 'சொத்து வரி ரசீது (Property Tax)';
        else if (text === 'ADDR_PROOF_AADHAAR' || text.includes('ஆதார்')) proof = 'புதிய முகவரி ஆதார் அட்டை';

        sess.subServiceData = { ...(sess.subServiceData || {}), proofType: proof };
        sess.intakeState = 'RATION_CHANGE_ADDRESS_UPLOAD';
        sess.chatHistory.push({
            sender: 'bot',
            text: `📍 **முகவரி மாற்றம் — ${proof}**\n\n` +
                  `தேர்ந்தெடுக்கப்பட்ட முகவரிச் சான்றைப் பதிவேற்றவும் (மற்றும் புதிய முகவரியைத் தட்டச்சு செய்யவும்):`,
            actionRequired: 'upload',
            uploadPrompt: 'முகவரிச் சான்று பதிவேற்றுக',
            options: [
                { label: "📷 சான்று பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                { label: "✅ சான்று தயார் - தொடரவும்", value: "ADDR_DOC_CONFIRMED" },
                { label: "🔙 ரேஷன் கார்டு சேவைகள்", value: "ரேஷன் கார்டு" }
            ]
        });
        return true;
    }

    if (currentState === 'RATION_CHANGE_ADDRESS_UPLOAD') {
        sess.subServiceData = sess.subServiceData || {};
        if (uploadedDoc && uploadedDoc.path) {
            sess.subServiceData.addressProofDocPath = uploadedDoc.path;
            sess.subServiceData.docPath = uploadedDoc.path;
            if (!sess.tempUploads) sess.tempUploads = {};
            sess.tempUploads.residenceProof = uploadedDoc.path;
            sess.tempUploads.gasBook = uploadedDoc.path;
            sess.tempUploads.newAddressProof = uploadedDoc.path;
            if (sess.citizenProfile) {
                sess.citizenProfile.residenceProof = uploadedDoc.path;
                if (!sess.citizenProfile.documents) sess.citizenProfile.documents = {};
                sess.citizenProfile.documents.residenceProof = uploadedDoc.path;
                sess.citizenProfile.documents.gasBook = uploadedDoc.path;
                sess.citizenProfile.documents.newAddressProof = uploadedDoc.path;
            }
        }
        if (text && text !== 'TRIGGER_FILE_UPLOAD' && text !== 'ADDR_DOC_CONFIRMED') {
            sess.subServiceData.newAddress = text;
        }
        sess.intakeState = 'READY_TO_APPLY';
        sess.step = 'READY';
        sess.chatHistory.push(renderSubserviceReadySummary(sess));
        return true;
    }

    return false;
}

function onDocumentDeleted(sess, docType) {
    if (!sess) return false;
    sess.subService = 'CHANGE_ADDRESS';
    if (sess.subServiceData && (docType === 'addressProof' || docType === 'residenceProof' || docType === 'newAddressProof')) {
        delete sess.subServiceData.addressDocPath;
        delete sess.subServiceData.addressProofDocPath;
        delete sess.subServiceData.docPath;
        sess.intakeState = 'RATION_CHANGE_ADDRESS_DOC';
    }
    return true;
}

module.exports = {
    enterService,
    handleFlow,
    handleMinorRationSubservices: handleFlow,
    onDocumentDeleted
};
