/**
 * eSevaDraft FSM Minor Subservices Handlers
 * Handles Remove Member, Change Head, Change Address, Change Card Type, Update Mobile, and LPG Update.
 */

const { renderSubserviceReadySummary } = require('./fsm_summary_formatter');

function handleMinorRationSubservices(text, sess, currentState, uploadedDoc = null, extractedDoc = null) {
    // Subservice 3: Remove Member
    if (currentState === 'RATION_REMOVE_MEMBER' || currentState === 'RATION_REMOVE_MEMBER_REASON') {
        sess.subService = 'REMOVE_MEMBER';
        let reason = 'காரணம் குறிப்பிடப்படவில்லை';
        let docType = 'இறப்புச் சான்றிதழ்';
        if (text === 'REMOVE_REASON_DEATH' || text.includes('இறப்பு')) {
            reason = 'இறப்பு (Death of Member)';
            docType = 'இறப்புச் சான்றிதழ் (Death Certificate)';
        } else if (text === 'REMOVE_REASON_MARRIAGE' || text.includes('திருமணம்')) {
            reason = 'திருமணம் (Marriage)';
            docType = 'திருமண அழைப்பிதழ் / சான்றிதழ் (Marriage Certificate)';
        } else if (text === 'REMOVE_REASON_SPLIT' || text.includes('பிரிப்பு')) {
            reason = 'தனி அட்டை பிரிப்பு (Separate Card)';
            docType = 'தனி அட்டை சான்று / வாடகை ஒப்பந்தம் (Split Proof)';
        } else if (text && text !== 'TRIGGER_FILE_UPLOAD' && text !== 'REMOVE_DOC_CONFIRMED') {
            reason = text;
            docType = 'இதர ஆவணம் (Other Document)';
        }

        sess.subServiceData = { ...(sess.subServiceData || {}), reason, docType };
        sess.intakeState = 'RATION_REMOVE_MEMBER_DOC';

        // Provide 1-click option chips for existing members if available
        const memberOptions = [];
        const existingMembers = (sess.citizenProfile && Array.isArray(sess.citizenProfile.members)) ? sess.citizenProfile.members : [];
        existingMembers.forEach((m, idx) => {
            const mName = m.nameTam || m.nameEng || m.name;
            if (mName && mName !== 'வாடிக்கையாளர்') {
                memberOptions.push({
                    label: `👤 ${mName} (${m.relationshipTam || m.relationship || 'உறுப்பினர்'})`,
                    value: `REMOVE_SELECT_MEMBER_${idx}`
                });
            }
        });

        const defaultOptions = [
            ...memberOptions,
            { label: "📷 சான்றிதழ் பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
            { label: "✅ சான்றிதழ் தயார் - தொடரவும்", value: "REMOVE_DOC_CONFIRMED" },
            { label: "🔙 ரேஷன் கார்டு சேவைகள்", value: "ரேஷன் கார்டு" }
        ];

        sess.chatHistory.push({
            sender: 'bot',
            text: `➖ **${reason} காரணமாக உறுப்பினர் நீக்கம்**\n\n` +
                  (memberOptions.length > 0 ? `கீழே உள்ள பட்டியலில் நீக்கப்பட வேண்டிய உறுப்பினரைத் தேர்ந்தெடுக்கவும் (அல்லது பெயரைத் தட்டச்சு செய்யவும்):\n\n` : `நீக்கப்பட வேண்டிய நபரின் பெயரைத் தட்டச்சு செய்யவும்:\n\n`) +
                  `📄 **தேவையான ஆவணம்:** ${docType} பதிவேற்றப்பட வேண்டும்.`,
            actionRequired: 'upload',
            uploadPrompt: `${docType} பதிவேற்றுக`,
            options: defaultOptions
        });
        return true;
    }

    if (currentState === 'RATION_REMOVE_MEMBER_DOC') {
        sess.subServiceData = sess.subServiceData || {};
        if (text && text.startsWith('REMOVE_SELECT_MEMBER_')) {
            const mIdx = parseInt(text.replace('REMOVE_SELECT_MEMBER_', ''), 10);
            const existingMembers = (sess.citizenProfile && Array.isArray(sess.citizenProfile.members)) ? sess.citizenProfile.members : [];
            const selectedMember = existingMembers[mIdx];
            if (selectedMember) {
                sess.subServiceData.memberName = selectedMember.nameEng || selectedMember.nameTam || selectedMember.name;
                sess.subServiceData.memberNameTam = selectedMember.nameTam || selectedMember.name;
                sess.subServiceData.memberNameEng = selectedMember.nameEng || selectedMember.name;
                sess.subServiceData.relationshipTam = selectedMember.relationshipTam || selectedMember.relationship || '';
                sess.subServiceData.aadhaarNo = selectedMember.aadhaarNumber || '';
            }
        } else if (text && text !== 'TRIGGER_FILE_UPLOAD' && text !== 'REMOVE_DOC_CONFIRMED') {
            sess.subServiceData.memberName = text;
            sess.subServiceData.memberNameTam = text;
            sess.subServiceData.memberNameEng = text;
        }

        sess.intakeState = 'READY_TO_APPLY';
        sess.step = 'READY';
        sess.chatHistory.push(renderSubserviceReadySummary(sess));
        return true;
    }

    // Subservice 4: Change Head
    if (currentState === 'RATION_CHANGE_HEAD' || currentState === 'RATION_CHANGE_HEAD_REASON') {
        sess.subService = 'CHANGE_HEAD';
        let reason = text.includes('இறப்பு') ? 'முந்தைய தலைவர் இறப்பு' : 'குடும்ப விருப்ப மாற்றம் / முதியவர்';
        sess.subServiceData = { ...(sess.subServiceData || {}), reason };
        sess.intakeState = 'RATION_CHANGE_HEAD_DOC';
        sess.chatHistory.push({
            sender: 'bot',
            text: `👤 **புதிய குடும்பத் தலைவரின் விவரங்கள்**\n\n` +
                  `புதிய தலைவராகப் போகும் நபரின் **ஆதார் அட்டையைப்** பதிவேற்றவும் (அல்லது பெயரைத் தட்டச்சு செய்யவும்):`,
            actionRequired: 'upload',
            uploadPrompt: 'புதிய தலைவர் ஆதார் அட்டை',
            options: [
                { label: "📷 புதிய தலைவர் ஆதார் பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                { label: "✅ ஆதார் தயார் - தொடரவும்", value: "HEAD_DOC_CONFIRMED" },
                { label: "🔙 ரேஷன் கார்டு சேவைகள்", value: "ரேஷன் கார்டு" }
            ]
        });
        return true;
    }

    if (currentState === 'RATION_CHANGE_HEAD_DOC') {
        if (text && text !== 'TRIGGER_FILE_UPLOAD' && text !== 'HEAD_DOC_CONFIRMED') {
            sess.subServiceData = sess.subServiceData || {};
            sess.subServiceData.newHeadName = text;
        }
        sess.intakeState = 'READY_TO_APPLY';
        sess.step = 'READY';
        sess.chatHistory.push(renderSubserviceReadySummary(sess));
        return true;
    }

    // Subservice 5: Change Address
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

    // Subservice 6: Change Card Type
    if (currentState === 'RATION_CHANGE_CARD_TYPE') {
        sess.subService = 'CHANGE_CARD_TYPE';
        let cardType = 'அரிசி அட்டை (Rice Card - PHH/NPHH)';
        if (text === 'CARD_TYPE_SUGAR' || text.includes('சர்க்கரை')) cardType = 'சர்க்கரை அட்டை (Sugar Card - NPHHS)';
        else if (text === 'CARD_TYPE_NO_COMMODITY' || text.includes('பண்டமில்லா')) cardType = 'பண்டமில்லா அட்டை (No Commodity - NC)';

        sess.subServiceData = { ...(sess.subServiceData || {}), cardType };
        sess.intakeState = 'READY_TO_APPLY';
        sess.step = 'READY';
        sess.chatHistory.push(renderSubserviceReadySummary(sess));
        return true;
    }

    // Subservice 7: Update Mobile
    if (currentState === 'RATION_CHANGE_MOBILE') {
        sess.subService = 'UPDATE_MOBILE';
        let newMob = text.replace(/\D/g, '');
        if (newMob.length === 10) {
            sess.subServiceData = { ...(sess.subServiceData || {}), newMobile: newMob };
        }
        sess.intakeState = 'READY_TO_APPLY';
        sess.step = 'READY';
        sess.chatHistory.push(renderSubserviceReadySummary(sess));
        return true;
    }

    // Subservice 8: LPG Update
    if (currentState === 'RATION_LPG_UPDATE') {
        sess.subService = 'LPG_UPDATE';
        let cyl = '1 சிலிண்டர் (Single Cylinder)';
        if (text === 'LPG_CYL_0' || text.includes('இல்லை')) cyl = '0 சிலிண்டர் (No Cylinder)';
        else if (text === 'LPG_CYL_2' || text.includes('இரண்டு')) cyl = '2 சிலிண்டர்கள் (Double Cylinders)';

        sess.subServiceData = { ...(sess.subServiceData || {}), cylinders: cyl };
        sess.intakeState = 'READY_TO_APPLY';
        sess.step = 'READY';
        sess.chatHistory.push(renderSubserviceReadySummary(sess));
        return true;
    }

    return false;
}

module.exports = { handleMinorRationSubservices };
