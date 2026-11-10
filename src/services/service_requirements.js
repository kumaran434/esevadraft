/**
 * eSevaDraft Service Requirements & Declarative Checklist Engine
 * Implements Document-First Extraction and Missing-Field-Only Prompts.
 * Adheres to Golden Rule 1 (Purpose-Driven Functional Modularity).
 */

const SERVICE_SCHEMAS = {
    'INCOME_CERT': {
        titleTam: 'வருமானச் சான்றிதழ்',
        mandatoryDocs: ['applicantAadhaar', 'incomeProof'],
        optionalDocs: ['salarySlip', 'bankPassbook'],
        mandatoryFields: ['fullNameTam', 'fatherNameTam', 'doorNo', 'streetTam', 'village', 'taluk', 'district', 'annualIncome', 'occupation'],
        docLabelsTam: {
            applicantAadhaar: 'விண்ணப்பதாரர் ஆதார் அட்டை',
            incomeProof: 'வருமானச் சான்று / சம்பள ரசீது / VAO அறிக்கை',
            salarySlip: 'சம்பள ரசீது (Salary Slip)',
            bankPassbook: 'வங்கி கணக்குப் புத்தகம் (Bank Passbook)'
        },
        fieldLabelsTam: {
            fullNameTam: 'விண்ணப்பதாரர் பெயர் (தமிழ்)',
            fatherNameTam: 'தந்தை / கணவர் பெயர் (தமிழ்)',
            doorNo: 'கதவு எண்',
            streetTam: 'தெரு / பகுதி',
            village: 'கிராமம்',
            taluk: 'வட்டம்',
            district: 'மாவட்டம்',
            annualIncome: 'ஆண்டு வருமானம் (ரூபாய்)',
            occupation: 'குடும்பத் தொழில்'
        }
    },
    'RATION_NEW': {
        titleTam: 'புதிய குடும்ப அட்டை',
        mandatoryDocs: ['headPhoto', 'residenceProof'],
        optionalDocs: ['gasBook'],
        mandatoryFields: ['fullNameTam', 'fatherNameTam', 'doorNo', 'streetTam', 'village', 'taluk', 'district', 'mobileNumber'],
        docLabelsTam: {
            headPhoto: 'குடும்பத் தலைவர் புகைப்படம்',
            residenceProof: 'இருப்பிடச் சான்று (மின் கட்டணம் / வாடகை ஒப்பந்தம்)',
            gasBook: 'எரிவாயு நுகர்வோர் அட்டை (Gas Book)'
        },
        fieldLabelsTam: {
            fullNameTam: 'குடும்பத் தலைவர் பெயர் (தமிழ்)',
            fatherNameTam: 'தந்தை / கணவர் பெயர் (தமிழ்)',
            doorNo: 'கதவு எண்',
            streetTam: 'தெரு / பகுதி',
            village: 'கிராமம்',
            taluk: 'வட்டம்',
            district: 'மாவட்டம்',
            mobileNumber: 'கைபேசி எண்'
        }
    },
    'REMOVE_MEMBER': {
        titleTam: 'குடும்ப உறுப்பினர் நீக்கம்',
        mandatoryDocs: ['removeProof'],
        optionalDocs: [],
        mandatoryFields: ['smartCardNumber', 'memberName', 'reason'],
        docLabelsTam: {
            removeProof: 'இறப்புச் சான்றிதழ் / திருமண அழைப்பிதழ்'
        },
        fieldLabelsTam: {
            smartCardNumber: 'ஸ்மார்ட் கார்டு எண்',
            memberName: 'நீக்கப்பட வேண்டிய உறுப்பினர் பெயர்',
            reason: 'நீக்குவதற்கான காரணம்'
        }
    },
    'ADD_MEMBER': {
        titleTam: 'குடும்ப உறுப்பினர் சேர்க்கை',
        mandatoryDocs: ['memberAadhaar'],
        optionalDocs: ['birthCertificate', 'surrenderProof'],
        mandatoryFields: ['smartCardNumber', 'memberName', 'aadhaarNo', 'relationshipTam'],
        docLabelsTam: {
            memberAadhaar: 'உறுப்பினர் ஆதார் அட்டை',
            birthCertificate: 'குழந்தை பிறப்புச் சான்றிதழ்',
            surrenderProof: 'பெயர் நீக்கல் சான்று (திருமணமானவர்களுக்கு)'
        },
        fieldLabelsTam: {
            smartCardNumber: 'ஸ்மார்ட் கார்டு எண்',
            memberName: 'சேர்க்கப்பட வேண்டிய உறுப்பினர் பெயர்',
            aadhaarNo: 'ஆதார் எண்',
            relationshipTam: 'உறவுமுறை'
        }
    }
};

/**
 * Evaluates readiness of a citizen application against declarative service schema.
 */
function evaluateServiceReadiness(serviceCode, masterProfile = {}, appData = {}) {
    const sCode = (serviceCode || '').toUpperCase();
    const schema = SERVICE_SCHEMAS[sCode];
    if (!schema) {
        return { isReady: true, missingDocs: [], missingFields: [], fulfilledDocs: [], fulfilledFields: [] };
    }

    const combinedDocs = { ...(masterProfile.documents || {}), ...(appData.documents || {}) };
    const combinedFields = { ...masterProfile, ...(appData.formData || {}), ...(appData.serviceData || {}) };

    // Support residence proof variations
    if (masterProfile.residenceProof?.docPath) combinedDocs.residenceProof = masterProfile.residenceProof.docPath;
    if (masterProfile.headPhotoPath) combinedDocs.headPhoto = masterProfile.headPhotoPath;
    if (masterProfile.gasDetails?.gasBookPath) combinedDocs.gasBook = masterProfile.gasDetails.gasBookPath;
    if (masterProfile.headAadhaar || masterProfile.aadhaarNumber) combinedDocs.applicantAadhaar = true;

    const fulfilledDocs = [];
    const missingDocs = [];

    schema.mandatoryDocs.forEach(dKey => {
        const hasDoc = !!combinedDocs[dKey];
        const item = { key: dKey, labelTam: schema.docLabelsTam[dKey] || dKey, present: hasDoc };
        if (hasDoc) fulfilledDocs.push(item);
        else missingDocs.push(item);
    });

    const fulfilledFields = [];
    const missingFields = [];

    schema.mandatoryFields.forEach(fKey => {
        let val = combinedFields[fKey];
        if (fKey === 'memberName' && (combinedFields.memberNameTam || combinedFields.memberNameEng)) val = true;
        if (fKey === 'smartCardNumber' && (combinedFields.smartCardNumber || masterProfile.smartCardNumber)) val = true;
        const hasField = val !== undefined && val !== null && String(val).trim() !== '';
        const item = { key: fKey, labelTam: schema.fieldLabelsTam[fKey] || fKey, value: val || null, present: hasField };
        if (hasField) fulfilledFields.push(item);
        else missingFields.push(item);
    });

    const isReady = missingDocs.length === 0 && missingFields.length === 0;

    return {
        serviceCode: sCode,
        titleTam: schema.titleTam,
        isReady,
        missingDocs,
        missingFields,
        fulfilledDocs,
        fulfilledFields,
        // Document-first indicator: if docs are missing, prompt for doc upload next!
        nextAction: missingDocs.length > 0 ? 'UPLOAD_DOCUMENT' : (missingFields.length > 0 ? 'PROMPT_FIELD' : 'READY_TO_APPLY'),
        nextItem: missingDocs.length > 0 ? missingDocs[0] : (missingFields.length > 0 ? missingFields[0] : null)
    };
}

module.exports = {
    SERVICE_SCHEMAS,
    evaluateServiceReadiness
};
