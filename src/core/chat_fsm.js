/**
 * eSevaDraft Finite State Machine (FSM) & Dialog Engine
 * 
 * Handles service selection, question branching, relationship mapping,
 * and conversational transitions in accordance with FEATURE_LOCK.md.
 */

const {
    SERVICE_OPTIONS,
    RATION_CARD_SERVICE_OPTIONS,
    MEMBER_COUNT_OPTIONS,
    RESIDENCE_PROOF_OPTIONS,
    RELATIONSHIP_OPTIONS,
    getRelationshipOptions,
    mapRelationshipToEng,
    getInitialWelcomeMessage
} = require('./fsm/fsm_options_registry');

const { renderSubserviceReadySummary } = require('./fsm/fsm_summary_formatter');
const { handleNonRationServiceSelection } = require('./fsm/fsm_other_services');
const { handleRationSubserviceMenuPrompts } = require('./fsm/fsm_subservice_prompts');
const { handleMinorRationSubservices } = require('./fsm/fsm_minor_subservices');
const { handleAddMemberChild } = require('./fsm/fsm_add_member_child');
const { handleAddMemberAdult } = require('./fsm/fsm_add_member_adult');
const { handleMemberDocUpload } = require('./fsm/fsm_member_doc_upload');
const { handleNewRationCardIntake } = require('./fsm/fsm_new_card_intake');
const { getVerifiedRationCardDocs } = require('../services/profile_helpers');

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

/**
 * Evaluates user input when state is SERVICE_SELECTION and transitions accordingly.
 */
function handleServiceSelection(text, sess) {
    const isAlreadyInRationMenu = sess.intakeState === 'RATION_CARD_SERVICES';

    const isNewRationCard = text === 'புதிய ரேஷன் கார்டு' || 
                           text === 'புதிய குடும்ப அட்டை' || 
                           text.includes('புதிய ரேஷன்') || 
                           text.includes('புதிய குடும்ப') || 
                           text.includes('New Ration Card') ||
                           (isAlreadyInRationMenu && (text === '1' || text.startsWith('1.') || text.includes('1. புதிய')));

    const isRationCardCategory = !isNewRationCard && !isAlreadyInRationMenu && (
        text === 'ரேஷன் கார்டு' || 
        text === 'ரேஷன்' || 
        text.toLowerCase() === 'ration' || 
        text.toLowerCase() === 'ration card' || 
        text.includes('குடும்ப அட்டை சேவைகள்') ||
        text === '1'
    );

    if (isRationCardCategory) {
        sess.intakeState = 'RATION_CARD_SERVICES';
        sess.step = 'RATION_CARD_SERVICES';
        sess.service = 'ரேஷன் கார்டு';
        sess.subService = null;
        if (sess.citizenProfile) sess.citizenProfile.subService = null;
        sess.chatHistory.push({
            sender: 'bot',
            text: `🏛️ **குடும்ப அட்டை (Ration Card) சேவைகள்**\n\n` +
                  `நீங்கள் குடும்ப அட்டையில் எந்த சேவையைச் செய்ய விரும்புகிறீர்கள்?\n\n` +
                  `கீழே உள்ள விருப்பங்களில் ஒன்றைத் தேர்ந்தெடுக்கவும்:`,
            options: RATION_CARD_SERVICE_OPTIONS
        });
        return true;
    } else if (isNewRationCard) {
        return handleNewRationCardIntake(sess);
    } else if (text.includes('உறுப்பினர் சேர்க்க') || text === 'குடும்ப உறுப்பினர் சேர்க்க' || text.startsWith('2.') || (isAlreadyInRationMenu && text === '2')) {
        sess.service = 'ரேஷன் கார்டு';
        sess.subService = 'ADD_MEMBER';
        if (sess.citizenProfile) sess.citizenProfile.subService = 'ADD_MEMBER';
        const subData = sess.subServiceData || sess.citizenProfile?.subServiceData || {};

        // Resolve existing member document for the member being added
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
        if (!existingMemDoc && hasMemberAadhaarDoc) {
            existingMemDoc = memberAadhaarDoc;
        }
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
        if (existingMemDoc && !subData.docPath) {
            subData.docPath = existingMemDoc;
        }

        const memberName = subData.memberName || subData.memberNameTam || subData.memberNameEng || '';
        const aadhaarNo = subData.aadhaarNo || subData.aadhaarNumber || '';
        const relTam = subData.relationshipTam || '';

        // Case 1: All required details already exist (Name, Aadhaar, Relationship, Doc) -> Direct Submit
        if (memberName && aadhaarNo && relTam && existingMemDoc) {
            sess.subServiceData = subData;
            sess.intakeState = 'READY_TO_APPLY';
            sess.step = 'READY';
            sess.chatHistory.push(renderSubserviceReadySummary(sess));
            return true;
        }

        // Case 2: Aadhaar is present/scanned with verified member details -> Ask only relationship
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
    } else if (text.includes('முகவரி மாற்றம்') || text === 'முகவரி மாற்றம்' || text.startsWith('5.') || (isAlreadyInRationMenu && text === '5')) {
        sess.service = 'ரேஷன் கார்டு';
        sess.subService = 'CHANGE_ADDRESS';
        if (sess.citizenProfile) sess.citizenProfile.subService = 'CHANGE_ADDRESS';
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

        // Case 1: Address & Residence Proof Document already exist -> Direct Submit
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

    if (handleRationSubserviceMenuPrompts(text, sess, isAlreadyInRationMenu)) {
        return true;
    }

    return handleNonRationServiceSelection(text, sess);
}

async function handleRationSubserviceWorkflow(text, sess, uploadedDoc = null, extractedDoc = null) {
    if (!sess) return false;
    const currentState = sess.intakeState;

    if (text === 'RATION_ADD_MEMBER_RESET' || text.includes('புதிய ஆவணம் மாற்று')) {
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

    if (text === 'RATION_CHANGE_ADDRESS_RESET' || text.includes('முகவரியை மாற்று')) {
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

    if (text === 'RATION_REMOVE_MEMBER_RESET' || text.includes('உறுப்பினர் நீக்கத்தை மாற்று')) {
        sess.subService = 'REMOVE_MEMBER';
        sess.subServiceData = {};
        sess.intakeState = 'RATION_REMOVE_MEMBER_REASON';
        sess.chatHistory.push({
            sender: 'bot',
            text: `➖ **குடும்ப உறுப்பினர் நீக்கம் (Remove Family Member - புதுப்பித்தல்)**\n\n` +
                  `குடும்ப அட்டையிலிருந்து உறுப்பினரை நீக்குவதற்கான காரணம் என்ன?\n\n` +
                  `கீழே உள்ள காரணங்களில் ஒன்றைத் தேர்ந்தெடுக்கவும்:`,
            options: [
                { label: "🕊️ இறப்பு காரணமாக (Death of Member)", value: "REMOVE_REASON_DEATH" },
                { label: "💍 திருமணம் காரணமாக (Marriage)", value: "REMOVE_REASON_MARRIAGE" },
                { label: "📄 தனி அட்டை பிரிப்பு (Separate Card)", value: "REMOVE_REASON_SPLIT" },
                { label: "🔙 ரேஷன் கார்டு சேவைகள்", value: "ரேஷன் கார்டு" }
            ]
        });
        return true;
    }

    if (handleAddMemberChild(text, sess, currentState, uploadedDoc, extractedDoc)) {
        return true;
    }

    if (handleAddMemberAdult(text, sess, currentState, uploadedDoc, extractedDoc)) {
        return true;
    }

    const docUploadResult = await handleMemberDocUpload(text, sess, currentState, uploadedDoc, extractedDoc);
    if (docUploadResult) {
        return true;
    }

    if (handleMinorRationSubservices(text, sess, currentState, uploadedDoc, extractedDoc)) {
        return true;
    }

    return false;
}

module.exports = {
    SERVICE_OPTIONS,
    RATION_CARD_SERVICE_OPTIONS,
    MEMBER_COUNT_OPTIONS,
    RESIDENCE_PROOF_OPTIONS,
    RELATIONSHIP_OPTIONS,
    getRelationshipOptions,
    mapRelationshipToEng,
    getInitialWelcomeMessage,
    handleServiceSelection,
    handleRationSubserviceWorkflow,
    renderSubserviceReadySummary
};
