const baseManifest = require('../../catalog/services/tnega_can_register');

module.exports = {
    ...baseManifest,
    id: 'TNEGA_CAN_REGISTER',
    portal: 'TNEGA',
    subService: 'CAN_REGISTER',
    code: 'TNEGA-CAN',
    ownedStates: [
        'CAN_REGISTER_INTAKE',
        'CAN_AADHAAR_BACK_WAIT',
        'CAN_MOTHER_NAME_WAIT',
        'CAN_COMMUNITY_WAIT',
        'READY_TO_APPLY_CAN'
    ],
    schema: {
        serviceCode: 'TNEGA_CAN',
        bucketA_DocumentExtracted: [
            'fullNameEng', 'fullNameTam', 'fatherNameEng', 'fatherNameTam',
            'headAadhaar', 'headDob', 'headGender',
            'doorNo', 'streetTam', 'village', 'taluk', 'district', 'pincode'
        ],
        bucketB_UserPrompted: [
            { key: 'motherNameTam', state: 'CAN_MOTHER_NAME_WAIT', label: 'தாயாரின் பெயர் (Mother Name)' },
            { key: 'community', state: 'CAN_COMMUNITY_WAIT', label: 'வகுப்பு / பிரிவு (Community)' }
        ]
    }
};
