const baseManifest = require('../../catalog/services/tnpds_add_member');
const servicePlugin = require('../../services/plugins/ration_add_member');

module.exports = {
    ...baseManifest,
    servicePlugin,
    id: 'TNPDS_ADD_MEMBER',
    portal: 'TNPDS',
    subService: 'ADD_MEMBER',
    code: 'TNPDS-ADD',
    ownedStates: [
        'RATION_ADD_MEMBER',
        'RATION_ADD_MEMBER_TYPE',
        'RATION_ADD_MEMBER_DOC',
        'RATION_ADD_MEMBER_DOC_FRONT',
        'RATION_ADD_MEMBER_DOC_BACK',
        'RATION_ADD_MEMBER_BACK',
        'RATION_ADD_MEMBER_CHILD_RELATION',
        'RATION_ADD_MEMBER_RELATION',
        'RATION_ADD_MEMBER_ADULT_AADHAAR',
        'RATION_ADD_MEMBER_ADULT_AADHAAR_BACK',
        'RATION_ADD_MEMBER_ADULT_RELATION',
        'RATION_ADD_MEMBER_ADULT_SURRENDER',
        'RATION_ADD_MEMBER_SON_AADHAAR',
        'RATION_ADD_MEMBER_SON_AADHAAR_BACK',
        'RATION_ADD_MEMBER_SON_RELATION'
    ],
    schema: {
        serviceCode: 'TNPDS-ADD',
        bucketA_DocumentExtracted: ['memberNameTam', 'memberNameEng', 'dob', 'gender', 'aadhaarNumber'],
        bucketB_UserPrompted: baseManifest.bucketB || []
    }
};
