/**
 * src/catalog/services/tnega_can_register.js
 * 
 * Modular Service Plugin: New CAN Registration (புதிய CAN பதிவு)
 * Portal: TNeGA (Tamil Nadu e-Governance Agency)
 */

module.exports = {
    id: 'TNEGA_CAN_REGISTER',
    aliases: ['NEW_CAN_REGISTRATION', 'CAN_REGISTRATION', 'CAN_REGISTER', 'புதிய CAN பதிவு'],
    code: 'CAN-001',
    portal: 'TNEGA',
    portalName: 'TNeGA (e-Sevai Portal)',
    nameTam: 'புதிய CAN பதிவு',
    nameEng: 'New CAN Registration',
    category: 'REVENUE',
    portalUrl: 'https://www.tnesevai.tn.gov.in',
    descriptionTam: 'தமிழ்நாடு அரசு வருவாய்த் துறை சான்றிதழ்களுக்கான 13-இலக்க நிரந்தர குடிமக்கள் பதிவு எண் (CAN)',

    prerequisites: [],

    bucketA: [
        { key: 'fullNameEng', label: 'விண்ணப்பதாரர் பெயர் (ஆங்கிலம்)', type: 'string' },
        { key: 'fullNameTam', label: 'விண்ணப்பதாரர் பெயர் (தமிழ்)', type: 'string' },
        { key: 'dob', label: 'பிறந்த தேதி', altKeys: ['headDob'], type: 'date' },
        { key: 'gender', label: 'பாலினம்', altKeys: ['headGender'], type: 'string' },
        { key: 'headAadhaar', label: 'ஆதார் எண்', altKeys: ['aadhaar', 'aadhaarNumber'], type: 'aadhaar' },
        { key: 'doorNo', label: 'கதவு எண்', type: 'string' },
        { key: 'streetEng', label: 'தெருப் பெயர் (ஆங்கிலம்)', type: 'string' },
        { key: 'streetTam', label: 'தெருப் பெயர் (தமிழ்)', type: 'string' },
        { key: 'village', label: 'வருவாய் கிராமம்', type: 'string' },
        { key: 'taluk', label: 'வட்டம் (Taluk)', type: 'string' },
        { key: 'district', label: 'மாவட்டம்', type: 'string' },
        { key: 'pincode', label: 'அஞ்சல் குறியீட்டு எண் (Pincode)', type: 'pincode' }
    ],

    bucketB: [
        {
            key: 'motherNameTam',
            altKeys: ['motherName', 'motherNameEng'],
            labelTam: 'தாயின் பெயர்',
            labelEng: "Mother's Name",
            promptTam: 'TNeGA போர்ட்டலில் புதிய CAN பதிவு செய்ய தாயின் பெயர் கட்டாயமாகும். தயவுசெய்து தாயின் பெயரை உள்ளிடவும் (எ.கா: தேவகி அல்லது Devaki):',
            mandatory: true,
            type: 'text'
        },
        {
            key: 'community',
            labelTam: 'வகுப்பு / பிரிவு',
            labelEng: 'Community',
            promptTam: '🏛️ விண்ணப்பதாரரின் வகுப்பு / பிரிவு (Community) எது? கீழே உள்ள பிரிவைத் தேர்ந்தெடுக்கவும்:',
            mandatory: true,
            type: 'options',
            options: [
                { label: 'BC (பிற்படுத்தப்பட்டோர்)', value: 'BC' },
                { label: 'MBC (மிகவும் பிற்படுத்தப்பட்டோர்)', value: 'MBC' },
                { label: 'SC (ஆதிதிராவிடர்)', value: 'SC' },
                { label: 'ST (பழங்குடியினர்)', value: 'ST' },
                { label: 'OC / Others (பொதுப் பிரிவு)', value: 'OC' }
            ]
        }
    ],

    requiredDocuments: [
        {
            key: 'headAadhaar',
            labelTam: 'விண்ணப்பதாரர் ஆதார் அட்டை (2-in-1 PDF)',
            labelEng: 'Applicant Aadhaar Card',
            format: 'pdf',
            maxSizeKB: 200,
            mandatory: true,
            isDualSided: true
        }
    ],

    getRunner: () => {
        const { startTnegaCanRegisterFlow } = require('../../portal/tnega/tnega_can_register');
        return startTnegaCanRegisterFlow;
    }
};
