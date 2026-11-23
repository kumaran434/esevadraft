const baseManifest = require('../../catalog/services/tnpds_remove_member');

module.exports = {
    ...baseManifest,
    id: 'TNPDS_REMOVE_MEMBER',
    portal: 'TNPDS',
    subService: 'REMOVE_MEMBER',
    code: 'TNPDS-REM',
    ownedStates: [
        'RATION_REMOVE_MEMBER',
        'RATION_REMOVE_MEMBER_REASON',
        'RATION_REMOVE_MEMBER_DOC'
    ],
    schema: {
        serviceCode: 'TNPDS-REM',
        bucketA_DocumentExtracted: ['smartCardNumber'],
        bucketB_UserPrompted: baseManifest.bucketB || []
    }
};
