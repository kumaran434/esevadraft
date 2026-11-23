const baseManifest = require('../../catalog/services/tnega_community');

module.exports = {
    ...baseManifest,
    id: 'TNEGA_COMMUNITY',
    portal: 'TNEGA',
    subService: 'COMMUNITY',
    code: 'REV-101',
    ownedStates: [
        'COMMUNITY_INTAKE',
        'COMMUNITY_CAN_GATE',
        'COMMUNITY_CAN_WAIT',
        'COMMUNITY_PHOTO_WAIT',
        'COMMUNITY_AADHAAR_WAIT',
        'COMMUNITY_AADHAAR_BACK_WAIT',
        'COMMUNITY_SMARTCARD_WAIT',
        'COMMUNITY_SMARTCARD_BACK_WAIT',
        'COMMUNITY_PROOF_WAIT',
        'COMMUNITY_MOTHER_NAME_WAIT',
        'COMMUNITY_RELIGION_WAIT',
        'COMMUNITY_COMM_WAIT',
        'COMMUNITY_CASTE_WAIT',
        'COMMUNITY_PARENTS_CASTE_GATE',
        'COMMUNITY_FATHER_CASTE_WAIT',
        'COMMUNITY_MOTHER_CASTE_WAIT',
        'READY_TO_APPLY_COMMUNITY'
    ],
    schema: {
        serviceCode: 'REV-101',
        bucketA_DocumentExtracted: [
            'fullNameEng', 'fullNameTam', 'fatherNameEng', 'fatherNameTam',
            'headAadhaar', 'headDob', 'headGender',
            'doorNo', 'streetTam', 'village', 'taluk', 'district', 'pincode'
        ],
        bucketB_UserPrompted: [
            { key: 'smartCard', state: 'COMMUNITY_SMARTCARD_WAIT', label: 'குடும்ப ஸ்மார்ட் ரேஷன் கார்டு (Smart Ration Card)' },
            { key: 'communityProof', state: 'COMMUNITY_PROOF_WAIT', label: 'குடும்ப சாதிச் சான்று (Family Community Proof)' },
            { key: 'headPhotoPath', state: 'COMMUNITY_PHOTO_WAIT', label: 'விண்ணப்பதாரர் புகைப்படம் (Photo <50KB)' },
            { key: 'canNumber', state: 'COMMUNITY_CAN_GATE', label: '13/15-இலக்க CAN எண்' },
            { key: 'motherNameTam', state: 'COMMUNITY_MOTHER_NAME_WAIT', label: 'தாயாரின் பெயர் (Mother Name)' },
            { key: 'religion', state: 'COMMUNITY_RELIGION_WAIT', label: 'மதம் (Religion)' },
            { key: 'community', state: 'COMMUNITY_COMM_WAIT', label: 'வகுப்பு / பிரிவு (Community)' },
            { key: 'caste', state: 'COMMUNITY_CASTE_WAIT', label: 'சாதி / உட்பிரிவு (Caste / Sub-caste)' }
        ]
    }
};
