/**
 * src/catalog/services/tnega_income.js
 * 
 * Modular Service Plugin: Income Certificate (வருமானச் சான்றிதழ் REV-103)
 * Portal: TNeGA (Tamil Nadu e-Governance Agency)
 */

module.exports = {
    id: 'TNEGA_INCOME',
    aliases: ['INCOME_CERTIFICATE', 'INCOME', 'வருமானச் சான்றிதழ்', 'REV-103'],
    code: 'REV-103',
    portal: 'TNEGA',
    portalName: 'TNeGA Revenue Department (e-Sevai)',
    nameTam: 'வருமானச் சான்றிதழ்',
    nameEng: 'Income Certificate',
    category: 'REVENUE',
    portalUrl: 'https://www.tnesevai.tn.gov.in',
    descriptionTam: 'தமிழ்நாடு அரசு வருவாய்த் துறை வழங்கும் அதிகாரப்பூர்வ வருமானச் சான்றிதழ்',

    prerequisites: [
        {
            key: 'canNumber',
            labelTam: '13-இலக்க CAN பதிவு எண்',
            labelEng: '13-digit CAN Number',
            promptTam: 'வருமானச் சான்றிதழ் விண்ணப்பிக்க 13-இலக்க CAN எண் கட்டாயமாகும்.',
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
            key: 'annualIncome',
            altKeys: ['income', 'monthlyIncome'],
            labelTam: 'குடும்ப மொத்த ஆண்டு வருமானம்',
            labelEng: 'Annual Family Income',
            promptTam: 'குடும்பத்தின் மொத்த ஆண்டு வருமானம் எவ்வளவு? (எ.கா: 60000 அல்லது 72000):',
            mandatory: true,
            type: 'number'
        },
        {
            key: 'profession',
            altKeys: ['occupation', 'headProfession'],
            labelTam: 'தொழில் / வாழ்வாதாரம்',
            labelEng: 'Occupation',
            promptTam: 'விண்ணப்பதாரரின் தொழில் என்ன? (எ.கா: கூலி, விவசாயம், தனியார் வேலை):',
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
            key: 'incomeProof',
            labelTam: 'சம்பளச் சான்று அல்லது சுய அறிவிப்புப் படிவம் (Self-declaration)',
            labelEng: 'Salary Slip / Self Declaration',
            format: 'pdf',
            maxSizeKB: 200,
            mandatory: false
        }
    ],

    getRunner: () => {
        const { startTnegaIncomeCertificateFlow } = require('../../portal/tnega/tnega_income_certificate');
        return startTnegaIncomeCertificateFlow;
    }
};
