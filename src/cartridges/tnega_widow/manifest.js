const baseManifest = require('../../catalog/services/tnega_widow');

module.exports = {
    ...baseManifest,
    id: 'TNEGA_WIDOW',
    portal: 'TNEGA',
    subService: 'WIDOW',
    code: 'REV-109',
    ownedStates: [
        'WIDOW_INTAKE',
        'WIDOW_CAN_GATE',
        'WIDOW_CAN_WAIT',
        'WIDOW_PHOTO_WAIT',
        'WIDOW_AADHAAR_WAIT',
        'WIDOW_AADHAAR_BACK_WAIT',
        'WIDOW_SMARTCARD_WAIT',
        'WIDOW_SMARTCARD_BACK_WAIT',
        'WIDOW_DEATH_CERT_WAIT',
        'WIDOW_MARRIAGE_PROOF_WAIT',
        'WIDOW_SPOUSE_NAME_WAIT',
        'WIDOW_DEATH_DATE_WAIT',
        'WIDOW_DEATH_CERT_NO_WAIT',
        'WIDOW_MARRIAGE_DATE_WAIT',
        'READY_TO_APPLY_WIDOW',
        'READY_TO_SUBMIT_WIDOW'
    ],
    schema: {
        serviceCode: 'REV-109',
        bucketA_DocumentExtracted: [
            'fullNameEng', 'fullNameTam', 'headAadhaar', 'headDob', 'headGender',
            'doorNo', 'streetEng', 'streetTam', 'village', 'taluk', 'district', 'pincode'
        ],
        bucketB_UserPrompted: [
            { key: 'profilePhoto', state: 'WIDOW_PHOTO_WAIT', label: 'விண்ணப்பதாரர் பாஸ்போர்ட் புகைப்படம் (<50KB)' },
            { key: 'headAadhaarDocPath', state: 'WIDOW_AADHAAR_WAIT', label: 'முகவரி ஆதாரம் (ஆதார் / ஸ்மார்ட் கார்டு)' },
            { key: 'smartCard', state: 'WIDOW_SMARTCARD_WAIT', label: 'குடும்ப ஸ்மார்ட் ரேஷன் கார்டு (Smart Ration Card)' },
            { key: 'deathCertificate', state: 'WIDOW_DEATH_CERT_WAIT', label: 'கணவரின் இறப்புச் சான்றிதழ் (Death Certificate of Husband)' },
            { key: 'marriageProof', state: 'WIDOW_MARRIAGE_PROOF_WAIT', label: 'திருமண ஆதாரம் (Marriage Certificate / Smart Card)' },
            { key: 'canNumber', state: 'WIDOW_CAN_GATE', label: '13/15-இலக்க CAN எண்' },
            { key: 'spouseNameTam', state: 'WIDOW_SPOUSE_NAME_WAIT', label: 'கணவரின் பெயர் (Spouse Name)' },
            { key: 'dateOfDeath', state: 'WIDOW_DEATH_DATE_WAIT', label: 'கணவர் இறந்த தேதி (Date of Death)' },
            { key: 'deathCertificateNo', state: 'WIDOW_DEATH_CERT_NO_WAIT', label: 'இறப்புச் சான்றிதழ் எண் (Death Certificate No.)' },
            { key: 'dateOfMarriage', state: 'WIDOW_MARRIAGE_DATE_WAIT', label: 'திருமணத் தேதி (Date of Marriage - விருப்பம்)' }
        ]
    }
};
