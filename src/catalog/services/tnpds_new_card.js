/**
 * src/catalog/services/tnpds_new_card.js
 * 
 * Modular Service Plugin: New Smart Ration Card (புதிய குடும்ப அட்டை)
 * Portal: TNPDS (Civil Supplies & Consumer Protection, Tamil Nadu)
 */

module.exports = {
    id: 'TNPDS_NEW_CARD',
    aliases: ['NEW_RATION_CARD', 'NEW_SMART_CARD', 'NEW_CARD', 'புதிய ரேஷன் கார்டு', 'புதிய குடும்ப அட்டை'],
    code: 'TNPDS_NFC',
    portal: 'TNPDS',
    portalName: 'TNPDS (Civil Supplies & Consumer Protection)',
    nameTam: 'புதிய ஸ்மார்ட் குடும்ப அட்டை',
    nameEng: 'New Smart Ration Card',
    category: 'CIVIL_SUPPLIES',
    portalUrl: 'https://www.tnpds.gov.in/pages/newsmartcard',
    descriptionTam: 'தமிழ்நாடு அரசு குடிமைப் பொருள் வழங்கல் துறை புதிய மின்னணு குடும்ப அட்டை விண்ணப்பம்',

    prerequisites: [],

    bucketA: [
        { key: 'fullNameEng', label: 'குடும்பத் தலைவர் பெயர் (ஆங்கிலம்)' },
        { key: 'fullNameTam', label: 'குடும்பத் தலைவர் பெயர் (தமிழ்)' },
        { key: 'fatherNameEng', label: 'தந்தை / கணவர் பெயர் (ஆங்கிலம்)' },
        { key: 'fatherNameTam', label: 'தந்தை / கணவர் பெயர் (தமிழ்)' },
        { key: 'headDob', label: 'பிறந்த தேதி', altKeys: ['dob'] },
        { key: 'headGender', label: 'பாலினம்', altKeys: ['gender'] },
        { key: 'doorNo', label: 'கதவு எண்' },
        { key: 'streetEng', label: 'தெருப் பெயர் (ஆங்கிலம்)' },
        { key: 'streetTam', label: 'தெருப் பெயர் (தமிழ்)' },
        { key: 'district', label: 'மாவட்டம்' },
        { key: 'taluk', label: 'வட்டம் (Taluk)' },
        { key: 'village', label: 'வருவாய் கிராமம் (Village)' },
        { key: 'pincode', label: 'அஞ்சல் குறியீட்டு எண் (Pincode)' },
        { key: 'headAadhaar', label: 'குடும்பத் தலைவர் ஆதார் எண்' }
    ],

    bucketB: [
        {
            key: 'cardType',
            altKeys: ['cardTypeTam'],
            labelTam: 'அட்டை வகை',
            labelEng: 'Card Type Option',
            promptTam: 'குடும்ப அட்டை வகை எதுவாக இருக்க வேண்டும்? கீழே உள்ளதைத் தேர்ந்தெடுக்கவும்:',
            mandatory: true,
            default: 'அரிசி அட்டை (Rice Option)',
            type: 'options',
            options: [
                { label: 'அரிசி அட்டை (Rice Card - All Commodities)', value: 'Rice Card' },
                { label: 'சர்க்கரை அட்டை (Sugar Card)', value: 'Sugar Card' },
                { label: 'பண்டமில்லா அட்டை (No Commodity Card)', value: 'No Commodity' }
            ]
        },
        {
            key: 'gasDetails.cylinders',
            altKeys: ['gasCylinders', 'cylinders'],
            labelTam: 'எரிவாயு இணைப்பு எண்ணிக்கை',
            labelEng: 'LPG Cylinders Count',
            promptTam: 'வீட்டில் எத்தனை சிலிண்டர் இணைப்பு உள்ளது? (0, 1 அல்லது 2):',
            mandatory: true,
            default: '0',
            type: 'options',
            options: [
                { label: 'இணைப்பு இல்லை (0 Cylinders)', value: '0' },
                { label: '1 சிலிண்டர் (Single Cylinder)', value: '1' },
                { label: '2 சிலிண்டர்கள் (Double Cylinder)', value: '2' }
            ]
        }
    ],

    requiredDocuments: [
        {
            key: 'profilePhoto',
            labelTam: 'குடும்பத் தலைவர் பாஸ்போர்ட் புகைப்படம்',
            labelEng: 'Head Passport Photo',
            format: 'image',
            maxSizeKB: 50,
            mandatory: true
        },
        {
            key: 'headAadhaar',
            labelTam: 'தலைவர் ஆதார் அட்டை (2-in-1 PDF)',
            labelEng: 'Head Aadhaar Card',
            format: 'pdf',
            maxSizeKB: 200,
            mandatory: true,
            isDualSided: true
        },
        {
            key: 'residenceProof',
            altKeys: ['gasBook'],
            labelTam: 'குடியிருப்புச் சான்று / கேஸ் புக் (A4 PDF)',
            labelEng: 'Residence Proof / Gas Book',
            format: 'pdf',
            maxSizeKB: 200,
            mandatory: true
        }
    ],

    getRunner: () => {
        const { submitTnpdsApplication } = require('../../../tnpds_automation');
        return submitTnpdsApplication;
    }
};
