module.exports = {
    id: 'TNEGA_LEGAL_HEIR',
    aliases: ['TNEGA_LEGAL_HEIR', 'LEGAL_HEIR', 'LEGAL_HEIR_CERTIFICATE', 'REV-114', 'வாரிசு சான்றிதழ்', 'சட்ட வாரிசு சான்றிதழ்'],
    code: 'REV-114',
    portal: 'TNEGA',
    portalName: 'TNeGA Revenue Department (e-Sevai)',
    subService: 'LEGAL_HEIR',
    nameTam: 'சட்ட வாரிசு சான்றிதழ்',
    nameEng: 'Legal Heir Certificate',
    category: 'REVENUE',
    portalUrl: 'https://www.tnesevai.tn.gov.in',
    ownedStates: [
        'LEGAL_HEIR_INTAKE',
        'LEGAL_HEIR_CAN_GATE',
        'LEGAL_HEIR_CAN_WAIT',
        'LEGAL_HEIR_AADHAAR_WAIT',
        'LEGAL_HEIR_AADHAAR_BACK_WAIT',
        'LEGAL_HEIR_SMARTCARD_WAIT',
        'LEGAL_HEIR_SMARTCARD_BACK_WAIT',
        'LEGAL_HEIR_DEATH_CERT_WAIT',
        'LEGAL_HEIR_DECEASED_ADDR_WAIT',
        'LEGAL_HEIR_BIRTH_TC_WAIT',
        'LEGAL_HEIR_CHILD_PROOF_WAIT',
        'LEGAL_HEIR_HEIRS_WAIT',
        'LEGAL_HEIR_DECEASED_NAME_WAIT',
        'LEGAL_HEIR_DEATH_DATE_WAIT',
        'LEGAL_HEIR_DEATH_CERT_NO_WAIT',
        'LEGAL_HEIR_DECEASED_PARENTS_WAIT',
        'READY_TO_APPLY_LEGAL_HEIR',
        'READY_TO_SUBMIT_LEGAL_HEIR'
    ],
    prerequisites: [
        {
            key: 'canNumber',
            labelTam: '13-இலக்க CAN பதிவு எண்',
            promptTam: 'வாரிசு சான்றிதழ் விண்ணப்பிக்க 13-இலக்க CAN எண் கட்டாயமாகும்.',
            fallbackServiceId: 'TNEGA_CAN_REGISTER'
        }
    ],
    bucketA: [
        { key: 'fullNameEng', label: 'விண்ணப்பதாரர் பெயர் (ஆங்கிலம்)' },
        { key: 'fullNameTam', label: 'விண்ணப்பதாரர் பெயர் (தமிழ்)' },
        { key: 'headAadhaar', label: 'ஆதார் எண்', altKeys: ['aadhaar'] },
        { key: 'district', label: 'மாவட்டம்' },
        { key: 'taluk', label: 'வட்டம்' },
        { key: 'village', label: 'கிராமம்' }
    ],
    bucketB: [
        { key: 'deceasedNameEng', labelTam: 'இறந்தவரின் பெயர்', promptTam: 'இறந்தவரின் பெயரை உள்ளிடவும்:', mandatory: true, type: 'text' },
        { key: 'dateOfDeath', labelTam: 'இறந்த தேதி', promptTam: 'இறந்த தேதி மற்றும் இடம் உள்ளிடவும்:', mandatory: true, type: 'text' },
        { key: 'deathCertificateNo', labelTam: 'இறப்புச் சான்றிதழ் எண்', promptTam: 'இறப்புச் சான்றிதழ் பதிவு எண்ணை உள்ளிடவும்:', mandatory: true, type: 'text' },
        { key: 'deceasedFatherNameEng', labelTam: 'இறந்தவரின் தந்தை பெயர்', promptTam: 'இறந்தவரின் தந்தை & தாய் பெயரை உள்ளிடவும்:', mandatory: true, type: 'text' }
    ],
    requiredDocuments: [
        { key: 'deathCertificate', labelTam: 'இறப்புச் சான்றிதழ்', format: 'pdf', maxSizeKB: 200, mandatory: true },
        { key: 'headAadhaar', labelTam: 'ஆதார் அட்டை / உறவுமுறைச் சான்று', format: 'pdf', maxSizeKB: 200, mandatory: true },
        { key: 'smartCard', labelTam: 'குடும்ப ஸ்மார்ட் ரேஷன் கார்டு', format: 'pdf', maxSizeKB: 200, mandatory: true },
        { key: 'birthCertificate', labelTam: 'வாரிசுகளின் பிறப்புச் சான்றிதழ் / பள்ளி TC', format: 'pdf', maxSizeKB: 200, mandatory: true }
    ],
    schema: {
        serviceCode: 'REV-114',
        bucketA_DocumentExtracted: [
            'fullNameEng', 'fullNameTam', 'fatherNameEng', 'fatherNameTam',
            'motherNameEng', 'motherNameTam', 'headAadhaar', 'headDob', 'headGender',
            'doorNo', 'streetTam', 'village', 'taluk', 'district', 'pincode'
        ],
        bucketB_UserPrompted: [
            { key: 'deathCertificate', state: 'LEGAL_HEIR_DEATH_CERT_WAIT', label: 'இறப்புச் சான்றிதழ் (Death Certificate)' },
            { key: 'headAadhaarDocPath', state: 'LEGAL_HEIR_AADHAAR_WAIT', label: 'வாரிசு உறவுமுறைச் சான்று (ஆதார் / ஸ்மார்ட் கார்டு)' },
            { key: 'smartCard', state: 'LEGAL_HEIR_SMARTCARD_WAIT', label: 'குடும்ப ஸ்மார்ட் ரேஷன் கார்டு (Smart Ration Card)' },
            { key: 'deceasedAddressProof', state: 'LEGAL_HEIR_DECEASED_ADDR_WAIT', label: 'இறந்தவரின் முகவரிச் சான்று (Deceased Address Proof)' },
            { key: 'birthCertificate', state: 'LEGAL_HEIR_CHILD_PROOF_WAIT', label: 'வாரிசுகளின் பிறப்புச் சான்றிதழ் / பள்ளி TC' },
            { key: 'canNumber', state: 'LEGAL_HEIR_CAN_GATE', label: '13/15-இலக்க CAN எண்' },
            { key: 'deceasedNameTam', state: 'LEGAL_HEIR_DECEASED_NAME_WAIT', label: 'இறந்தவரின் பெயர் (Deceased Name)' },
            { key: 'dateOfDeath', state: 'LEGAL_HEIR_DEATH_DATE_WAIT', label: 'இறந்த தேதி & இடம் (Date & Place of Death)' },
            { key: 'deathCertificateNo', state: 'LEGAL_HEIR_DEATH_CERT_NO_WAIT', label: 'இறப்புச் சான்றிதழ் எண் (Death Certificate No.)' },
            { key: 'deceasedParents', state: 'LEGAL_HEIR_DECEASED_PARENTS_WAIT', label: 'இறந்தவரின் தந்தை & தாய் பெயர்' }
        ]
    }
};
