/**
 * src/catalog/services/tnega_obc.js
 * 
 * Modular Service Plugin: OBC Certificate (இதர பிற்படுத்தப்பட்டோர் சான்றிதழ் REV-115)
 * Portal: TNeGA (Tamil Nadu e-Governance Agency - Revenue Department)
 */

module.exports = {
    id: 'TNEGA_OBC',
    aliases: ['OBC', 'OBC_CERTIFICATE', 'TNEGA_OBC_CERTIFICATE', 'இதர பிற்படுத்தப்பட்டோர் சான்றிதழ்', 'OBC சான்றிதழ்', 'REV-115'],
    code: 'REV-115',
    portal: 'TNEGA',
    portalName: 'TNeGA Revenue Department (e-Sevai)',
    nameTam: 'OBC சான்றிதழ் (இதர பிற்படுத்தப்பட்டோர்)',
    nameEng: 'OBC Certificate (Other Backward Classes)',
    category: 'REVENUE',
    portalUrl: 'https://www.tnesevai.tn.gov.in',
    descriptionTam: 'மத்திய அரசு கல்வி/வேலைவாய்ப்புக்கான அதிகாரப்பூர்வ OBC சான்றிதழ் (REV-115 Other Backward Classes Certificate)',

    prerequisites: [
        {
            key: 'canNumber',
            labelTam: '13-இலக்க CAN பதிவு எண்',
            labelEng: '13-digit CAN Number',
            promptTam: 'OBC சான்றிதழ் விண்ணப்பிக்க 13-இலக்க CAN எண் கட்டாயமாகும்.',
            fallbackServiceId: 'TNEGA_CAN_REGISTER'
        }
    ],

    bucketA: [
        { key: 'fullNameEng', label: 'விண்ணப்பதாரர் பெயர் (ஆங்கிலம்)' },
        { key: 'fullNameTam', label: 'விண்ணப்பதாரர் பெயர் (தமிழ்)' },
        { key: 'fatherNameEng', label: 'தந்தை பெயர்' },
        { key: 'fatherNameTam', label: 'தந்தை பெயர் (தமிழ்)' },
        { key: 'motherNameEng', label: 'தாயின் பெயர்' },
        { key: 'motherNameTam', label: 'தாயின் பெயர் (தமிழ்)' },
        { key: 'headAadhaar', label: 'ஆதார் எண்', altKeys: ['aadhaar'] },
        { key: 'doorNo', label: 'கதவு எண்' },
        { key: 'streetEng', label: 'தெருப் பெயர்' },
        { key: 'streetTam', label: 'தெருப் பெயர் (தமிழ்)' },
        { key: 'district', label: 'மாவட்டம்' },
        { key: 'taluk', label: 'வட்டம்' },
        { key: 'village', label: 'வருவாய் கிராமம்' },
        { key: 'pincode', label: 'பின்கோடு' }
    ],

    bucketB: [
        {
            key: 'caste',
            altKeys: ['subCaste'],
            labelTam: 'உட்பிரிவு / சாதி (OBC Caste)',
            labelEng: 'OBC Caste / Sub-Caste',
            promptTam: 'விண்ணப்பதாரரின் சரியான OBC சாதிப் பெயரைக் குறிப்பிடவும் (எ.கா: Vanniyar / Agamudayar / Yadav):',
            mandatory: true,
            type: 'text'
        },
        {
            key: 'occupation',
            altKeys: ['applicantOccupation'],
            labelTam: 'விண்ணப்பதாரரின் தொழில் / நிலை',
            labelEng: 'Applicant Occupational Group',
            promptTam: 'விண்ணப்பதாரரின் தற்போதைய பணி/நிலையைத் தேர்ந்தெடுக்கவும் (Student / Service / Business / Agriculture):',
            mandatory: true,
            type: 'text'
        },
        {
            key: 'fatherOccupation',
            labelTam: 'தந்தையின் பணி / தொழில்',
            labelEng: "Father's Occupation / Status",
            promptTam: 'தந்தையின் தொழில் மற்றும் பணி நிலையைக் குறிப்பிடவும் (எ.கா: விவசாயம் / தனியார் பணி / சுயதொழில் / காலமானார்):',
            mandatory: true,
            type: 'text'
        },
        {
            key: 'motherOccupation',
            labelTam: 'தாயின் பணி / தொழில்',
            labelEng: "Mother's Occupation / Status",
            promptTam: 'தாயின் தொழில் மற்றும் பணி நிலையைக் குறிப்பிடவும் (எ.கா: இல்லத்தரசி / விவசாயம் / சுயதொழில் / காலமானார்):',
            mandatory: true,
            type: 'text'
        },
        {
            key: 'annualIncome',
            altKeys: ['familyAnnualIncome'],
            labelTam: 'குடும்ப ஆண்டு வருமானம் (ரூ)',
            labelEng: 'Annual Family Income (Rs)',
            promptTam: 'குடும்பத்தின் மொத்த ஆண்டு வருமானத்தை ரூபாயில் உள்ளிடவும் (எ.கா: 72000):',
            mandatory: true,
            type: 'number'
        }
    ],

    requiredDocuments: [
        {
            key: 'profilePhoto',
            altKeys: ['photo', 'headPhoto'],
            labelTam: 'விண்ணப்பதாரர் பாஸ்போர்ட் புகைப்படம் (<250x250px, <50KB)',
            labelEng: 'Applicant Passport Photo',
            format: 'image',
            maxSizeKB: 50,
            mandatory: true
        },
        {
            key: 'headAadhaar',
            altKeys: ['aadhaar', 'smartCard'],
            labelTam: 'முகவரி ஆதாரம் (ஆதார் அட்டை / ஸ்மார்ட் கார்டு)',
            labelEng: 'Any Address Proof (Aadhaar)',
            format: 'pdf',
            maxSizeKB: 200,
            mandatory: true,
            isDualSided: true
        },
        {
            key: 'communityCertificate',
            altKeys: ['fatherCommunityCertificate', 'casteCertificate'],
            labelTam: 'சாதிச் சான்றிதழ் (Community Certificate)',
            labelEng: 'Community Certificate',
            format: 'pdf',
            maxSizeKB: 200,
            mandatory: true
        },
        {
            key: 'incomeTaxReturn',
            altKeys: ['incomeCertificate', 'salarySlip', 'incomeProof'],
            labelTam: 'வருமான வரி / வருமானச் சான்று (ITR / Income Proof)',
            labelEng: 'Income Tax Return / Proof of Income',
            format: 'pdf',
            maxSizeKB: 200,
            mandatory: true
        },
        {
            key: 'selfDeclaration',
            labelTam: 'சுய உறுதிமொழிப் படிவம் (போர்ட்டலில் தானாகத் தரவிறக்கப்படும்)',
            labelEng: 'Self-Declaration of Applicant',
            format: 'pdf',
            maxSizeKB: 200,
            mandatory: false
        }
    ],

    getRunner: () => {
        const { startTnegaObcCertificateFlow } = require('../../portal/tnega/tnega_obc_certificate');
        return startTnegaObcCertificateFlow;
    }
};
