module.exports = {
    id: 'TNPDS_CHANGE_HEAD',
    portal: 'TNPDS',
    portalName: 'TNPDS (Tamil Nadu Public Distribution System)',
    subService: 'CHANGE_HEAD',
    code: 'TNPDS-HEAD',
    nameTam: 'குடும்பத் தலைவர் மாற்றம்',
    nameEng: 'Change Family Head',
    aliases: ['TNPDS_CHANGE_HEAD', 'CHANGE_HEAD', 'குடும்பத் தலைவர் மாற்றம்'],
    ownedStates: [
        'RATION_CHANGE_HEAD',
        'RATION_CHANGE_HEAD_REASON',
        'RATION_CHANGE_HEAD_NAME',
        'RATION_CHANGE_HEAD_DOC'
    ],
    bucketA: [{ key: 'smartCardNumber', label: 'ஸ்மார்ட் கார்டு எண்' }],
    bucketB: [
        { key: 'newHeadName', labelTam: 'புதிய குடும்பத் தலைவர் பெயர்', promptTam: 'புதிய குடும்பத் தலைவரின் பெயரை உள்ளிடவும்:', mandatory: true, type: 'text' },
        { key: 'reason', labelTam: 'காரணம்', promptTam: 'மாற்றத்திற்கான காரணத்தைத் தேர்ந்தெடுக்கவும்:', mandatory: true, type: 'text' }
    ],
    requiredDocuments: [
        { key: 'headChangeProof', labelTam: 'குடும்பத் தலைவர் மாற்ற ஆவணம்', format: 'pdf', maxSizeKB: 200, mandatory: true }
    ],
    schema: {
        serviceCode: 'TNPDS-HEAD',
        bucketA_DocumentExtracted: ['smartCardNumber'],
        bucketB_UserPrompted: [
            { key: 'newHeadName', state: 'RATION_CHANGE_HEAD_NAME', label: 'புதிய குடும்பத் தலைவர் பெயர்' },
            { key: 'reason', state: 'RATION_CHANGE_HEAD_REASON', label: 'காரணம்' }
        ]
    }
};
