/**
 * src/catalog/services/tnega_residence.js
 * 
 * Modular Service Plugin: Residence / Nativity Certificate (இருப்பிடச் சான்றிதழ் REV-102)
 * Portal: TNeGA (Tamil Nadu e-Governance Agency)
 */

module.exports = {
    id: 'TNEGA_RESIDENCE',
    aliases: ['RESIDENCE_CERTIFICATE', 'RESIDENCE', 'NATIVITY_CERTIFICATE', 'இருப்பிடச் சான்றிதழ்', 'REV-102'],
    code: 'REV-102',
    portal: 'TNEGA',
    portalName: 'TNeGA Revenue Department (e-Sevai)',
    nameTam: 'இருப்பிடச் சான்றிதழ்',
    nameEng: 'Residence Certificate',
    category: 'REVENUE',
    portalUrl: 'https://www.tnesevai.tn.gov.in',
    descriptionTam: 'தமிழ்நாடு அரசு வருவாய்த் துறை வழங்கும் அதிகாரப்பூர்வ இருப்பிடச் சான்றிதழ்',

    prerequisites: [
        {
            key: 'canNumber',
            labelTam: '13-இலக்க CAN பதிவு எண்',
            labelEng: '13-digit CAN Number',
            promptTam: 'இருப்பிடச் சான்றிதழ் விண்ணப்பிக்க 13-இலக்க CAN எண் கட்டாயமாகும்.',
            fallbackServiceId: 'TNEGA_CAN_REGISTER'
        }
    ],

    bucketA: [
        { key: 'fullNameEng', label: 'விண்ணப்பதாரர் பெயர் (ஆங்கிலம்)' },
        { key: 'fullNameTam', label: 'விண்ணப்பதாரர் பெயர் (தமிழ்)' },
        { key: 'fatherNameEng', label: 'தந்தை / கணவர் பெயர்' },
        { key: 'headAadhaar', label: 'ஆதார் எண்', altKeys: ['aadhaar'] },
        { key: 'doorNo', label: 'கதவு எண்' },
        { key: 'streetEng', label: 'தெருப் பெயர்' },
        { key: 'district', label: 'மாவட்டம்' },
        { key: 'taluk', label: 'வட்டம்' },
        { key: 'village', label: 'கிராமம்' },
        { key: 'pincode', label: 'பின்கோடு' }
    ],

    bucketB: [
        {
            key: 'yearsOfResidence',
            altKeys: ['residenceYears', 'yearsInAddress'],
            labelTam: 'தொடர்ந்து வசிக்கும் வருடங்கள்',
            labelEng: 'Years of Continuous Residence',
            promptTam: 'விண்ணப்பதாரர் தமிழ்நாட்டில் தொடர்ந்து எத்தனை வருடங்களாக வசித்து வருகிறார்? (எ.கா: 5 அல்லது 10):',
            mandatory: true,
            default: '5',
            type: 'number'
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
            key: 'residenceProof',
            labelTam: 'முகவரிச் சான்று (மின் கட்டணம் / வீட்டு வரி / கேஸ் அட்டை / ரேஷன் கார்டு)',
            labelEng: 'Address Proof',
            format: 'pdf',
            maxSizeKB: 200,
            mandatory: true
        }
    ],

    getRunner: () => {
        const { startTnegaResidenceCertificateFlow } = require('../../portal/tnega/tnega_residence_certificate');
        return startTnegaResidenceCertificateFlow;
    }
};
