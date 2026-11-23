const baseManifest = require('../../catalog/services/tnpds_new_card');

module.exports = {
    ...baseManifest,
    id: 'TNPDS_NEW_CARD',
    portal: 'TNPDS',
    subService: 'NEW_CARD',
    code: 'TNPDS-NEW',
    ownedStates: [
        'MEMBER_COUNT',
        'HEAD_PHOTO',
        'HEAD_AADHAAR_FRONT',
        'HEAD_AADHAAR_BACK',
        'HEAD_DETAILS_VERIFY',
        'MEMBER_AADHAAR_FRONT',
        'MEMBER_AADHAAR_BACK',
        'MEMBER_RELATIONSHIP',
        'MEMBER_DETAILS_VERIFY',
        'ADDRESS_CHOICE',
        'MOBILE_NUMBER',
        'RESIDENCE_PROOF_TYPE',
        'RESIDENCE_PROOF_DOC',
        'AADHAAR_MOBILE_CONFIRM',
        'CONFIRM_SUBMIT'
    ],
    schema: {
        serviceCode: 'TNPDS-NEW',
        bucketA_DocumentExtracted: [
            'fullNameEng', 'fullNameTam', 'fatherNameEng', 'fatherNameTam',
            'headAadhaar', 'headDob', 'headGender',
            'doorNo', 'streetTam', 'streetEng', 'village', 'taluk', 'district', 'pincode'
        ],
        bucketB_UserPrompted: baseManifest.bucketB || []
    }
};
