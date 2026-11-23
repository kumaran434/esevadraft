const baseManifest = require('../../catalog/services/tnega_residence');

module.exports = {
    ...baseManifest,
    id: 'TNEGA_RESIDENCE',
    portal: 'TNEGA',
    subService: 'RESIDENCE',
    code: 'REV-102',
    ownedStates: [
        'RESIDENCE_INTAKE',
        'RESIDENCE_CAN_GATE',
        'RESIDENCE_CAN_WAIT',
        'RESIDENCE_PHOTO_WAIT',
        'RESIDENCE_AADHAAR_WAIT',
        'RESIDENCE_AADHAAR_BACK_WAIT',
        'RESIDENCE_SMARTCARD_WAIT',
        'RESIDENCE_SMARTCARD_BACK_WAIT',
        'RESIDENCE_PROOF_WAIT',
        'RESIDENCE_YEARS_WAIT',
        'RESIDENCE_PURPOSE_WAIT',
        'READY_TO_APPLY_RESIDENCE'
    ],
    schema: {
        serviceCode: 'REV-102',
        bucketA_DocumentExtracted: [
            'fullNameEng', 'fullNameTam', 'fatherNameEng', 'fatherNameTam',
            'headAadhaar', 'headDob', 'headGender',
            'doorNo', 'streetTam', 'village', 'taluk', 'district', 'pincode'
        ],
        bucketB_UserPrompted: [
            { key: 'smartCard', state: 'RESIDENCE_SMARTCARD_WAIT', label: 'குடும்ப ஸ்மார்ட் ரேஷன் கார்டு (Smart Ration Card)' },
            { key: 'residenceProof', state: 'RESIDENCE_PROOF_WAIT', label: 'இருப்பிட ஆதாரம் / முகவரிச் சான்று (Residence Proof)' },
            { key: 'headPhotoPath', state: 'RESIDENCE_PHOTO_WAIT', label: 'விண்ணப்பதாரர் புகைப்படம் (Photo <50KB)' },
            { key: 'canNumber', state: 'RESIDENCE_CAN_GATE', label: '13/15-இலக்க CAN எண்' },
            { key: 'yearsOfResidence', state: 'RESIDENCE_YEARS_WAIT', label: 'வசிக்கும் காலம் (Years of Continuous Residence)' },
            { key: 'purposeOfCertificate', state: 'RESIDENCE_PURPOSE_WAIT', label: 'சான்றிதழ் பயன்பாடு / நோக்கம் (Purpose)' }
        ]
    }
};
