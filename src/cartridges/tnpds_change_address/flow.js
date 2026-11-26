const { renderSubserviceReadySummary } = require('../../core/fsm/fsm_summary_formatter');
const { getVerifiedRationCardDocs } = require('../../services/profile_helpers');
const { resetTransientServiceInputs } = require('../_fresh_service_guard');

function enterService(sess, { isDirectOperator = false } = {}) {
    const rawSubData = sess.subServiceData || sess.citizenProfile?.subServiceData || {};
    const preservedCard = {
        ...(rawSubData.smartCardNumber ? { smartCardNumber: rawSubData.smartCardNumber } : {}),
        ...(rawSubData.rationCardNo ? { rationCardNo: rawSubData.rationCardNo } : {})
    };
    resetTransientServiceInputs(sess);
    sess.service = 'ரேஷன் கார்டு';
    sess.subService = 'CHANGE_ADDRESS';
    sess.pluginId = 'TNPDS_CHANGE_ADDRESS';
    if (sess.citizenProfile) {
        sess.citizenProfile.subService = 'CHANGE_ADDRESS';
        sess.citizenProfile.pluginId = 'TNPDS_CHANGE_ADDRESS';
    }
    if (isDirectOperator) {
        sess.chatHistory = [];
    }

    // Golden Rule 24 (Always-Fresh Service Run): always ask cleanly for NEW address proof; never confuse with old Master address or stale attempts!
    const subData = { ...preservedCard };
    sess.subServiceData = subData;
    if (sess.citizenProfile) sess.citizenProfile.subServiceData = subData;

    sess.intakeState = 'RATION_CHANGE_ADDRESS_DOC';
    sess.step = 'RATION_CHANGE_ADDRESS_DOC';
    sess.chatHistory.push({
        sender: 'bot',
        text: `📍 **முகவரி மாற்றம் (Change Address)**\n\n` +
              `புதிய முகவரிக்கு மாற்ற, **புதிய முகவரிக்கான சான்று ஆவணத்தைத்** தேர்ந்தெடுத்துப் பதிவேற்றவும் (ஆவணத்தில் இருந்து புதிய முகவரி தானாகப் பெறப்படும்):`,
        actionRequired: 'upload',
        uploadPrompt: 'புதிய முகவரிச் சான்று பதிவேற்றுக',
        options: [
            { label: "⚡ மின் கட்டண ரசீது (EB Bill)", value: "ADDR_PROOF_EB" },
            { label: "⛽ எரிவாயு நுகர்வோர் அட்டை (Gas Bill)", value: "ADDR_PROOF_GAS" },
            { label: "📄 வாடகை ஒப்பந்தம் (Rental Agreement)", value: "ADDR_PROOF_RENT" },
            { label: "🏛️ சொத்து வரி ரசீது (Property Tax)", value: "ADDR_PROOF_TAX" },
            { label: "🪪 புதிய முகவரி ஆதார் அட்டை (Aadhaar)", value: "ADDR_PROOF_AADHAAR" },
            { label: "✏️ புதிய முகவரியைப் படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" },
            { label: "🔙 ரேஷன் கார்டு சேவைகள்", value: "ரேஷன் கார்டு" }
        ]
    });
    return true;
}

function applyExtractedAddressToSubData(subData, extractedDoc) {
    if (!extractedDoc || !subData) return;
    if (extractedDoc.doorNo) { subData.doorNo = extractedDoc.doorNo; subData.newDoorNo = extractedDoc.doorNo; }
    if (extractedDoc.streetTam) subData.streetTam = extractedDoc.streetTam;
    if (extractedDoc.streetEng) { subData.streetEng = extractedDoc.streetEng; subData.newStreet = extractedDoc.streetEng; }
    if (!subData.streetTam && subData.streetEng) subData.streetTam = subData.streetEng;
    if (extractedDoc.areaTam) subData.areaTam = extractedDoc.areaTam;
    if (extractedDoc.areaEng) subData.areaEng = extractedDoc.areaEng;
    if (extractedDoc.pincode) { subData.pincode = extractedDoc.pincode; subData.newPincode = extractedDoc.pincode; }
    if (extractedDoc.district) { subData.district = extractedDoc.district; subData.newDistrict = extractedDoc.district; }
    if (extractedDoc.taluk) { subData.taluk = extractedDoc.taluk; subData.newTaluk = extractedDoc.taluk; }
    if (extractedDoc.village) { subData.village = extractedDoc.village; subData.newVillage = extractedDoc.village; }
}

function handleFlow(text, sess, uploadedDoc = null, extractedDoc = null) {
    if (!sess) return false;
    const currentState = sess.intakeState;

    if (currentState === 'RATION_CHANGE_ADDRESS_RESUME_GATE') {
        const cleanTxt = String(text || '').trim();
        if (cleanTxt === 'CHANGE_ADDRESS_RESUME' || /தொடர்க|continue|resume/i.test(cleanTxt)) {
            sess.intakeState = 'READY_TO_APPLY';
            sess.step = 'READY';
            sess.chatHistory.push(renderSubserviceReadySummary(sess));
            return true;
        }
        if (cleanTxt === 'CHANGE_ADDRESS_START_NEW' || /வேறு|புதிய|fresh|new/i.test(cleanTxt)) {
            sess.subServiceData = {};
            if (sess.citizenProfile) sess.citizenProfile.subServiceData = {};
            if (sess.tempUploads) delete sess.tempUploads.newAddressProof;
            sess.intakeState = 'RATION_CHANGE_ADDRESS_DOC';
            sess.step = 'RATION_CHANGE_ADDRESS_DOC';
            sess.chatHistory.push({
                sender: 'bot',
                text: `📍 **புதிய முகவரி மாற்றம்**\n\n**புதிய முகவரிக்கான சான்று ஆவணத்தைத்** தேர்ந்தெடுத்துப் பதிவேற்றவும்:`,
                actionRequired: 'upload',
                uploadPrompt: 'புதிய முகவரிச் சான்று பதிவேற்றுக',
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
    }

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
            sess.subServiceData.isNewAddressEntered = true;
            if (!sess.subServiceData.proofType) sess.subServiceData.proofType = 'ஆதார் அட்டை';
            applyExtractedAddressToSubData(sess.subServiceData, extractedDoc);
            if (!sess.tempUploads) sess.tempUploads = {};
            sess.tempUploads.newAddressProof = uploadedDoc.path;
            if (sess.citizenProfile) {
                if (!sess.citizenProfile.documents) sess.citizenProfile.documents = {};
                sess.citizenProfile.documents.newAddressProof = uploadedDoc.path;
            }
            sess.intakeState = 'READY_TO_APPLY';
            sess.step = 'READY';
            sess.chatHistory.push(renderSubserviceReadySummary(sess));
            return true;
        }
        let proof = 'மின் கட்டண ரசீது (EB Bill)';
        if (text === 'ADDR_PROOF_GAS' || text.includes('எரிவாயு')) proof = 'எரிவாயு நுகர்வோர் அட்டை (Gas Bill)';
        else if (text === 'ADDR_PROOF_RENT' || text.includes('வாடகை')) proof = 'வாடகை ஒப்பந்தம் (Rental Agreement)';
        else if (text === 'ADDR_PROOF_TAX' || text.includes('வரி')) proof = 'சொத்து வரி ரசீது (Property Tax)';
        else if (text === 'ADDR_PROOF_AADHAAR' || text.includes('ஆதார்')) proof = 'ஆதார் அட்டை (Aadhaar)';

        sess.subServiceData = { ...(sess.subServiceData || {}), proofType: proof };
        sess.intakeState = 'RATION_CHANGE_ADDRESS_UPLOAD';
        sess.chatHistory.push({
            sender: 'bot',
            text: `📍 **முகவரி மாற்றம் — ${proof}**\n\n` +
                  `தேர்ந்தெடுக்கப்பட்ட புதிய முகவரிச் சான்றைப் பதிவேற்றவும் (அல்லது புதிய முகவரியைக் கீழே தட்டச்சு செய்யவும் / படிவத்தில் நிரப்பவும்):`,
            actionRequired: 'upload',
            uploadPrompt: 'புதிய முகவரிச் சான்று பதிவேற்றுக',
            options: [
                { label: "📷 சான்று பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                { label: "✅ சான்று தயார் - தொடரவும்", value: "ADDR_DOC_CONFIRMED" },
                { label: "✏️ புதிய முகவரி படிவத்தில் நிரப்பு (Edit Form)", value: "TRIGGER_EDIT_MODAL" },
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
            sess.subServiceData.isNewAddressEntered = true;
            applyExtractedAddressToSubData(sess.subServiceData, extractedDoc);
            if (!sess.tempUploads) sess.tempUploads = {};
            sess.tempUploads.newAddressProof = uploadedDoc.path;
            if (sess.citizenProfile) {
                if (!sess.citizenProfile.documents) sess.citizenProfile.documents = {};
                sess.citizenProfile.documents.newAddressProof = uploadedDoc.path;
            }
        }
        if (text && text !== 'TRIGGER_FILE_UPLOAD' && text !== 'ADDR_DOC_CONFIRMED') {
            sess.subServiceData.newAddress = text;
            sess.subServiceData.streetTam = sess.subServiceData.streetTam || text;
            sess.subServiceData.streetEng = sess.subServiceData.streetEng || text;
            sess.subServiceData.isNewAddressEntered = true;
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
