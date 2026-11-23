module.exports = {
    id: 'TNPDS_UPDATE_MOBILE',
    portal: 'TNPDS',
    portalName: 'TNPDS (Tamil Nadu Public Distribution System)',
    subService: 'UPDATE_MOBILE',
    code: 'TNPDS-MOB',
    nameTam: 'கைபேசி எண் மாற்றம்',
    nameEng: 'Update Registered Mobile Number',
    aliases: ['TNPDS_UPDATE_MOBILE', 'UPDATE_MOBILE', 'CHANGE_MOBILE', 'கைபேசி எண் மாற்றம்', 'மொபைல் எண் மாற்றம்'],
    ownedStates: [
        'RATION_CHANGE_MOBILE',
        'RATION_CHANGE_MOBILE_INPUT'
    ],
    bucketA: [{ key: 'smartCardNumber', label: 'ஸ்மார்ட் கார்டு எண்' }],
    bucketB: [{ key: 'newMobile', labelTam: 'புதிய கைபேசி எண்', promptTam: 'புதிய 10-இலக்க கைபேசி எண்ணை உள்ளிடவும்:', mandatory: true, type: 'text' }],
    requiredDocuments: [],
    schema: {
        serviceCode: 'TNPDS-MOB',
        bucketA_DocumentExtracted: ['smartCardNumber'],
        bucketB_UserPrompted: [{ key: 'newMobile', state: 'RATION_CHANGE_MOBILE_INPUT', label: 'புதிய கைபேசி எண்' }]
    }
};
