/**
 * src/catalog/services/tnpds_remove_member.js
 * 
 * Modular Service Plugin: Remove Family Member (உறுப்பினர் நீக்கம்)
 * Portal: TNPDS (Civil Supplies & Consumer Protection, Tamil Nadu)
 */

module.exports = {
    id: 'TNPDS_REMOVE_MEMBER',
    aliases: ['REMOVE_MEMBER', 'RATION_REMOVE_MEMBER', 'உறுப்பினர் நீக்கம்'],
    code: 'TNPDS_REM_MEM',
    portal: 'TNPDS',
    portalName: 'TNPDS (Civil Supplies & Consumer Protection)',
    nameTam: 'குடும்ப உறுப்பினர் நீக்கம்',
    nameEng: 'Remove Family Member',
    category: 'CIVIL_SUPPLIES',
    portalUrl: 'https://www.tnpds.gov.in',
    descriptionTam: 'குடும்ப அட்டையிலிருந்து உறுப்பினரை நீக்குதல் (திருமணம் / இறப்பு / தனி அட்டை)',

    prerequisites: [
        {
            key: 'smartCardNumber',
            altKeys: ['rationCardNumber'],
            labelTam: 'ஸ்மார்ட் குடும்ப அட்டை எண்',
            labelEng: 'Smart Ration Card Number',
            promptTam: 'உறுப்பினர் நீக்கம் செய்ய ஸ்மார்ட் கார்டு எண் தேவை.'
        }
    ],

    bucketA: [],

    bucketB: [
        {
            key: 'subServiceData.memberToRemove',
            labelTam: 'நீக்கப்பட வேண்டிய உறுப்பினர்',
            labelEng: 'Member to Remove',
            promptTam: 'குடும்ப அட்டையிலிருந்து எந்த உறுப்பினரை நீக்க வேண்டும்?',
            mandatory: true,
            type: 'text'
        },
        {
            key: 'subServiceData.removalReason',
            labelTam: 'நீக்குவதற்கான காரணம்',
            labelEng: 'Reason for Removal',
            promptTam: 'உறுப்பினர் நீக்கத்திற்கான காரணம் எது? கீழே உள்ளதைத் தேர்ந்தெடுக்கவும்:',
            mandatory: true,
            type: 'options',
            options: [
                { label: 'திருமணம் (Marriage)', value: 'Marriage' },
                { label: 'இறப்பு (Death)', value: 'Death' },
                { label: 'தனி குடும்ப அட்டை (Separate Card)', value: 'Separate Card' },
                { label: 'பிற காரணங்கள் (Other Reason)', value: 'Other' }
            ]
        }
    ],

    requiredDocuments: [
        {
            key: 'removalProof',
            labelTam: 'நீக்கத்திற்கான ஆதார ஆவணம் (திருமணப் பத்திரிகை / இறப்புச் சான்று)',
            labelEng: 'Supporting Proof Document',
            format: 'pdf',
            maxSizeKB: 200,
            mandatory: true
        }
    ],

    getRunner: () => {
        const { runRemoveMemberFlow } = require('../../portal/tnpds_remove_member_flow');
        return runRemoveMemberFlow;
    }
};
