/**
 * src/catalog/services/tnpds_add_member.js
 * 
 * Modular Service Plugin: Add Family Member (உறுப்பினர் சேர்க்கை)
 * Portal: TNPDS (Civil Supplies & Consumer Protection, Tamil Nadu)
 */

module.exports = {
    id: 'TNPDS_ADD_MEMBER',
    aliases: ['ADD_MEMBER', 'RATION_ADD_MEMBER', 'உறுப்பினர் சேர்க்கை'],
    code: 'TNPDS_ADD_MEM',
    portal: 'TNPDS',
    portalName: 'TNPDS (Civil Supplies & Consumer Protection)',
    nameTam: 'குடும்ப உறுப்பினர் சேர்க்கை',
    nameEng: 'Add Family Member',
    category: 'CIVIL_SUPPLIES',
    portalUrl: 'https://www.tnpds.gov.in',
    descriptionTam: 'ஏற்கனவே உள்ள குடும்ப அட்டையில் புதிய குடும்ப உறுப்பினரைச் சேர்த்தல்',

    prerequisites: [
        {
            key: 'smartCardNumber',
            altKeys: ['rationCardNumber'],
            labelTam: 'ஸ்மார்ட் குடும்ப அட்டை எண்',
            labelEng: 'Smart Ration Card Number',
            promptTam: 'உறுப்பினர் சேர்க்கை செய்ய ஸ்மார்ட் கார்டுடன் இணைக்கப்பட்ட பதிவு எண் அல்லது குடும்ப அட்டை எண் தேவை.'
        }
    ],

    bucketA: [],

    bucketB: [
        {
            key: 'subServiceData.memberName',
            labelTam: 'சேர்க்கப்பட வேண்டிய உறுப்பினர் பெயர்',
            labelEng: 'Member Name to Add',
            promptTam: 'சேர்க்கப்பட வேண்டிய குடும்ப உறுப்பினரின் பெயரை உள்ளிடவும்:',
            mandatory: true,
            type: 'text'
        },
        {
            key: 'subServiceData.relationship',
            labelTam: 'உறவுமுறை',
            labelEng: 'Relationship to Family Head',
            promptTam: 'குடும்பத் தலைவருடன் இந்த உறுப்பினரின் உறவுமுறை என்ன? (மகன், மகள், மனைவி, தாய், தந்தை):',
            mandatory: true,
            type: 'options',
            options: [
                { label: 'மகன் (Son)', value: 'Son' },
                { label: 'மகள் (Daughter)', value: 'Daughter' },
                { label: 'மனைவி (Wife)', value: 'Wife' },
                { label: 'கணவர் (Husband)', value: 'Husband' },
                { label: 'தாய் (Mother)', value: 'Mother' },
                { label: 'தந்தை (Father)', value: 'Father' }
            ]
        },
        {
            key: 'subServiceData.aadhaarNo',
            labelTam: 'உறுப்பினர் ஆதார் எண்',
            labelEng: 'Member Aadhaar Number',
            promptTam: 'புதிய உறுப்பினரின் 12-இலக்க ஆதார் எண்ணை உள்ளிடவும்:',
            mandatory: true,
            type: 'aadhaar'
        }
    ],

    requiredDocuments: [
        {
            key: 'memberAadhaar',
            labelTam: 'உறுப்பினர் ஆதார் அட்டை (2-in-1 PDF)',
            labelEng: 'Member Aadhaar Card',
            format: 'pdf',
            maxSizeKB: 200,
            mandatory: true,
            isDualSided: true
        }
    ],

    getRunner: () => {
        const { runAddMemberFlow } = require('../../portal/tnpds/add_member/add_member_pipeline');
        return runAddMemberFlow;
    }
};
