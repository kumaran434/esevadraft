/**
 * src/catalog/services/tnega_community.js
 * 
 * Modular Service Plugin: Community Certificate (சாதிச் சான்றிதழ் REV-101)
 * Portal: TNeGA (Tamil Nadu e-Governance Agency)
 */

module.exports = {
    id: 'TNEGA_COMMUNITY',
    aliases: ['COMMUNITY_CERTIFICATE', 'COMMUNITY', 'CASTE_CERTIFICATE', 'சாதிச் சான்றிதழ்', 'REV-101'],
    code: 'REV-101',
    portal: 'TNEGA',
    portalName: 'TNeGA Revenue Department (e-Sevai)',
    nameTam: 'சாதிச் சான்றிதழ்',
    nameEng: 'Community Certificate',
    category: 'REVENUE',
    portalUrl: 'https://www.tnesevai.tn.gov.in',
    descriptionTam: 'தமிழ்நாடு அரசு வருவாய்த் துறை வழங்கும் அதிகாரப்பூர்வ சாதிச் சான்றிதழ் (BC/MBC/SC/ST)',

    prerequisites: [
        {
            key: 'canNumber',
            labelTam: '13-இலக்க CAN பதிவு எண்',
            labelEng: '13-digit CAN Number',
            promptTam: 'சாதிச் சான்றிதழ் விண்ணப்பிக்க 13-இலக்க CAN எண் கட்டாயமாகும்.',
            fallbackServiceId: 'TNEGA_CAN_REGISTER'
        }
    ],

    bucketA: [
        { key: 'fullNameEng', label: 'விண்ணப்பதாரர் பெயர் (ஆங்கிலம்)' },
        { key: 'fullNameTam', label: 'விண்ணப்பதாரர் பெயர் (தமிழ்)' },
        { key: 'fatherNameEng', label: 'தந்தை / கணவர் பெயர்' },
        { key: 'headAadhaar', label: 'ஆதார் எண்', altKeys: ['aadhaar'] },
        { key: 'district', label: 'மாவட்டம்' },
        { key: 'taluk', label: 'வட்டம்' },
        { key: 'village', label: 'கிராமம்' }
    ],

    bucketB: [
        {
            key: 'religion',
            labelTam: 'மதம்',
            labelEng: 'Religion',
            promptTam: 'விண்ணப்பதாரரின் மதம் எது? கீழே உள்ளதைத் தேர்ந்தெடுக்கவும்:',
            mandatory: true,
            default: 'இந்து (Hindu)',
            type: 'options',
            options: [
                { label: 'இந்து (Hindu)', value: 'Hindu' },
                { label: 'கிறிஸ்தவர் (Christian)', value: 'Christian' },
                { label: 'முஸ்லிம் (Muslim)', value: 'Muslim' },
                { label: 'மற்றவை (Others)', value: 'Others' }
            ]
        },
        {
            key: 'community',
            labelTam: 'பிரிவு / சமூகம்',
            labelEng: 'Community Category',
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
        },
        {
            key: 'caste',
            altKeys: ['subCaste'],
            labelTam: 'உட்சாதிப் பிரிவு',
            labelEng: 'Sub-Caste',
            promptTam: 'விண்ணப்பதாரரின் குறிப்பிட்ட உட்சாதிப் பெயர் (Sub-Caste) என்ன? (எ.கா: வன்னியர், நாடார், ஆதிதிராவிடர், தேவர்):',
            mandatory: true,
            type: 'text'
        }
    ],

    requiredDocuments: [
        {
            key: 'profilePhoto',
            labelTam: 'விண்ணப்பதாரர் பாஸ்போர்ட் புகைப்படம்',
            labelEng: 'Passport Photo',
            format: 'image',
            maxSizeKB: 50,
            mandatory: true
        },
        {
            key: 'headAadhaar',
            labelTam: 'ஆதார் அட்டை (2-in-1 PDF)',
            labelEng: 'Aadhaar Card',
            format: 'pdf',
            maxSizeKB: 200,
            mandatory: true,
            isDualSided: true
        },
        {
            key: 'communityProof',
            labelTam: 'குடும்ப சாதிச் சான்றிதழ் அல்லது பள்ளி TC (Transfer Certificate)',
            labelEng: 'Community Proof / TC',
            format: 'pdf',
            maxSizeKB: 200,
            mandatory: true
        }
    ],

    getRunner: () => {
        const { startTnegaCommunityCertificateFlow } = require('../../portal/tnega/tnega_community_certificate');
        return startTnegaCommunityCertificateFlow;
    }
};
