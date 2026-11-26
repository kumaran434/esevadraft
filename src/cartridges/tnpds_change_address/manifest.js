const baseManifest = require('../../catalog/services/tnpds_change_address');
const servicePlugin = require('../../services/plugins/ration_change_address');

module.exports = {
    ...baseManifest,
    servicePlugin,
    id: 'TNPDS_CHANGE_ADDRESS',
    portal: 'TNPDS',
    subService: 'CHANGE_ADDRESS',
    code: 'TNPDS-ADDR',
    ownedStates: [
        'RATION_CHANGE_ADDRESS',
        'RATION_CHANGE_ADDRESS_RESUME_GATE',
        'RATION_CHANGE_ADDRESS_DOC',
        'RATION_CHANGE_ADDRESS_UPLOAD',
        'RATION_CHANGE_ADDRESS_CONFIRM',
        'RATION_CHANGE_ADDRESS_EDIT',
        'RATION_CHANGE_ADDRESS_MANUAL_ENTRY'
    ],
    schema: {
        serviceCode: 'TNPDS-ADDR',
        bucketA_DocumentExtracted: ['doorNo', 'streetTam', 'streetEng', 'village', 'taluk', 'district', 'pincode'],
        bucketB_UserPrompted: baseManifest.bucketB || []
    }
};
