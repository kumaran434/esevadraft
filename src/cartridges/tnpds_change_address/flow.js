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

function applyExtractedAddressToSubData(subData, extractedDoc, { overwrite = false } = {}) {
    if (!extractedDoc || !subData) return;
    const setField = (k, v) => {
        if (!v) return;
        if (overwrite || !subData[k]) subData[k] = v;
    };
    setField('doorNo', extractedDoc.doorNo);
    setField('newDoorNo', extractedDoc.doorNo);
    setField('streetTam', extractedDoc.streetTam);
    setField('streetEng', extractedDoc.streetEng);
    setField('newStreet', extractedDoc.streetEng || extractedDoc.streetTam);
    if (!subData.streetTam && subData.streetEng) subData.streetTam = subData.streetEng;
    setField('areaTam', extractedDoc.areaTam);
    setField('areaEng', extractedDoc.areaEng);
    setField('pincode', extractedDoc.pincode);
    setField('newPincode', extractedDoc.pincode);
    setField('district', extractedDoc.district);
    setField('newDistrict', extractedDoc.district);
    setField('districtTam', extractedDoc.districtTam);
    setField('taluk', extractedDoc.taluk);
    setField('newTaluk', extractedDoc.taluk);
    setField('talukTam', extractedDoc.talukTam);
    setField('village', extractedDoc.village);
    setField('newVillage', extractedDoc.village);
    setField('villageTam', extractedDoc.villageTam);

    const dt = String(extractedDoc.documentType || '').toUpperCase();
    if (dt.includes('GAS')) subData.proofType = 'எரிவாயு நுகர்வோர் அட்டை (Gas Bill)';
    else if (dt.includes('EB')) subData.proofType = 'மின் கட்டண ரசீது (EB Bill)';
    else if (dt.includes('TAX')) subData.proofType = 'சொத்து வரி ரசீது (Property Tax)';
    else if (dt.includes('RENT')) subData.proofType = 'வாடகை ஒப்பந்தம் (Rental Agreement)';
    else if (dt.includes('AADHAAR')) subData.proofType = 'ஆதார் அட்டை (Aadhaar)';
}

function formatExtractedAddressPreview(sData = {}) {
    const door = sData.doorNo || '⚠️ பெறப்படவில்லை';
    const stTam = sData.streetTam || '⚠️ பெறப்படவில்லை';
    const stEng = sData.streetEng && sData.streetEng !== sData.streetTam ? ` (${sData.streetEng})` : '';
    const loc = [sData.village || sData.areaTam, sData.taluk, sData.district].filter(Boolean).join(', ') || '—';
    const pin = sData.pincode || '—';
    return `• 🏠 **கதவு எண்:** ${door}\n` +
           `• 🛣️ **தெரு:** ${stTam}${stEng}\n` +
           `• 📍 **கிராமம் / வட்டம் / மாவட்டம்:** ${loc}\n` +
           `• 📮 **பின்கோடு:** ${pin}`;
}

function shouldConfirmExtractedAddress(sData = {}, extractedDoc = null) {
    const dt = String(extractedDoc?.documentType || '').toUpperCase();
    const isAadhaar = dt.includes('AADHAAR');
    const hasDoorAndStreet = Boolean(String(sData.doorNo || '').trim() && String(sData.streetTam || sData.streetEng || '').trim());
    if (!hasDoorAndStreet) return true;
    if (!isAadhaar) return true;
    return false;
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
            applyExtractedAddressToSubData(sess.subServiceData, extractedDoc, { overwrite: true });
            if (!sess.tempUploads) sess.tempUploads = {};
            sess.tempUploads.newAddressProof = uploadedDoc.path;
            if (sess.citizenProfile) {
                if (!sess.citizenProfile.documents) sess.citizenProfile.documents = {};
                sess.citizenProfile.documents.newAddressProof = uploadedDoc.path;
            }
            if (shouldConfirmExtractedAddress(sess.subServiceData, extractedDoc)) {
                sess.intakeState = 'RATION_CHANGE_ADDRESS_CONFIRM';
                sess.step = 'RATION_CHANGE_ADDRESS_CONFIRM';
                sess.chatHistory.push({
                    sender: 'bot',
                    text: `🔍 **${sess.subServiceData.proofType || 'முகவரிச் சான்று'} — பிரித்தெடுக்கப்பட்ட முகவரியைச் சரிபார்க்கவும்!**\n\n` +
                          `${formatExtractedAddressPreview(sess.subServiceData)}\n\n` +
                          `⚠️ *குறிப்பு: Gas Book / EB Bill போன்ற ஆவணங்களில் கதவு எண் அல்லது தெரு மாறியிருக்க வாய்ப்புண்டு. சரியாக உள்ளதா எனச் சரிபார்த்துத் தொடரவும் (அல்லது எடிட் படிவத்தில் திருத்தவும்):*`,
                    options: [
                        { label: "✏️ முகவரியைத் திருத்து (Edit Form)", value: "TRIGGER_EDIT_MODAL" },
                        { label: "✅ முகவரி சரியானது - தொடரவும்", value: "ADDR_EXTRACT_CONFIRMED" },
                        { label: "🪪 பதிலாக ஆதார் அட்டை பதிவேற்றுக", value: "ADDR_PROOF_AADHAAR" },
                        { label: "🔙 ரேஷன் கார்டு சேவைகள்", value: "ரேஷன் கார்டு" }
                    ]
                });
                return true;
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
            applyExtractedAddressToSubData(sess.subServiceData, extractedDoc, { overwrite: true });
            if (!sess.tempUploads) sess.tempUploads = {};
            sess.tempUploads.newAddressProof = uploadedDoc.path;
            if (sess.citizenProfile) {
                if (!sess.citizenProfile.documents) sess.citizenProfile.documents = {};
                sess.citizenProfile.documents.newAddressProof = uploadedDoc.path;
            }
            if (shouldConfirmExtractedAddress(sess.subServiceData, extractedDoc)) {
                sess.intakeState = 'RATION_CHANGE_ADDRESS_CONFIRM';
                sess.step = 'RATION_CHANGE_ADDRESS_CONFIRM';
                sess.chatHistory.push({
                    sender: 'bot',
                    text: `🔍 **${sess.subServiceData.proofType || 'முகவரிச் சான்று'} — பிரித்தெடுக்கப்பட்ட முகவரியைச் சரிபார்க்கவும்!**\n\n` +
                          `${formatExtractedAddressPreview(sess.subServiceData)}\n\n` +
                          `⚠️ *குறிப்பு: Gas Book / EB Bill போன்ற ஆவணங்களில் கதவு எண் அல்லது தெரு மாறியிருக்க வாய்ப்புண்டு. சரியாக உள்ளதா எனச் சரிபார்த்துத் தொடரவும் (அல்லது எடிட் படிவத்தில் திருத்தவும்):*`,
                    options: [
                        { label: "✏️ முகவரியைத் திருத்து (Edit Form)", value: "TRIGGER_EDIT_MODAL" },
                        { label: "✅ முகவரி சரியானது - தொடரவும்", value: "ADDR_EXTRACT_CONFIRMED" },
                        { label: "🪪 பதிலாக ஆதார் அட்டை பதிவேற்றுக", value: "ADDR_PROOF_AADHAAR" },
                        { label: "🔙 ரேஷன் கார்டு சேவைகள்", value: "ரேஷன் கார்டு" }
                    ]
                });
                return true;
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

    if (currentState === 'RATION_CHANGE_ADDRESS_CONFIRM') {
        sess.subServiceData = sess.subServiceData || {};
        if (uploadedDoc && uploadedDoc.path) {
            sess.subServiceData.addressProofDocPath = uploadedDoc.path;
            sess.subServiceData.docPath = uploadedDoc.path;
            sess.subServiceData.isNewAddressEntered = true;
            applyExtractedAddressToSubData(sess.subServiceData, extractedDoc, { overwrite: true });
            if (!sess.tempUploads) sess.tempUploads = {};
            sess.tempUploads.newAddressProof = uploadedDoc.path;
            if (sess.citizenProfile) {
                if (!sess.citizenProfile.documents) sess.citizenProfile.documents = {};
                sess.citizenProfile.documents.newAddressProof = uploadedDoc.path;
            }
            if (shouldConfirmExtractedAddress(sess.subServiceData, extractedDoc)) {
                sess.chatHistory.push({
                    sender: 'bot',
                    text: `🔍 **புதிய ஆவணத்திலிருந்து பெறப்பட்ட முகவரியைச் சரிபார்க்கவும்!**\n\n` +
                          `${formatExtractedAddressPreview(sess.subServiceData)}`,
                    options: [
                        { label: "✏️ முகவரியைத் திருத்து (Edit Form)", value: "TRIGGER_EDIT_MODAL" },
                        { label: "✅ முகவரி சரியானது - தொடரவும்", value: "ADDR_EXTRACT_CONFIRMED" },
                        { label: "🪪 பதிலாக ஆதார் அட்டை பதிவேற்றுக", value: "ADDR_PROOF_AADHAAR" }
                    ]
                });
                return true;
            }
            sess.intakeState = 'READY_TO_APPLY';
            sess.step = 'READY';
            sess.chatHistory.push(renderSubserviceReadySummary(sess));
            return true;
        }
        if (text === 'ADDR_PROOF_AADHAAR' || /ஆதார்/i.test(text || '')) {
            sess.subServiceData.proofType = 'ஆதார் அட்டை (Aadhaar)';
            sess.intakeState = 'RATION_CHANGE_ADDRESS_UPLOAD';
            sess.step = 'RATION_CHANGE_ADDRESS_UPLOAD';
            sess.chatHistory.push({
                sender: 'bot',
                text: `🪪 **புதிய முகவரி உள்ள ஆதார் அட்டையைப் பதிவேற்றவும்:**`,
                actionRequired: 'upload',
                uploadPrompt: 'புதிய முகவரி ஆதார் பதிவேற்றுக',
                options: [
                    { label: "📷 ஆதார் பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                    { label: "✏️ புதிய முகவரி படிவத்தில் நிரப்பு (Edit Form)", value: "TRIGGER_EDIT_MODAL" }
                ]
            });
            return true;
        }
        if (text === 'ADDR_EXTRACT_CONFIRMED' || text === 'ADDR_DOC_CONFIRMED') {
            sess.intakeState = 'READY_TO_APPLY';
            sess.step = 'READY';
            sess.chatHistory.push(renderSubserviceReadySummary(sess));
            return true;
        }
        if (text && text !== 'TRIGGER_FILE_UPLOAD' && text !== 'TRIGGER_EDIT_MODAL') {
            sess.subServiceData.newAddress = text;
            sess.subServiceData.streetEng = text;
            sess.subServiceData.isNewAddressEntered = true;
            sess.intakeState = 'READY_TO_APPLY';
            sess.step = 'READY';
            sess.chatHistory.push(renderSubserviceReadySummary(sess));
            return true;
        }
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
