/**
 * src/catalog/services/tnega_widow.js
 *
 * Modular Service Plugin: Widow Certificate (விதவைச் சான்றிதழ் REV-109)
 * Portal: TNeGA (Tamil Nadu e-Governance Agency - Revenue Department)
 */

module.exports = {
    id: 'TNEGA_WIDOW',
    aliases: ['WIDOW', 'WIDOW_CERTIFICATE', 'TNEGA_WIDOW_CERTIFICATE', 'விதவைச் சான்றிதழ்', 'விதவை சான்றிதழ்', 'REV-109'],
    code: 'REV-109',
    portal: 'TNEGA',
    portalName: 'TNeGA Revenue Department (e-Sevai)',
    nameTam: 'விதவைச் சான்றிதழ் (REV-109)',
    nameEng: 'Widow Certificate (REV-109)',
    category: 'REVENUE',
    portalUrl: 'https://www.tnesevai.tn.gov.in',
    descriptionTam: 'தமிழ்நாடு வருவாய்த் துறை அதிகாரப்பூர்வ விதவைச் சான்றிதழ் (REV-109 Widow Certificate)',

    prerequisites: [
        {
            key: 'canNumber',
            labelTam: '13-இலக்க CAN பதிவு எண்',
            labelEng: '13-digit CAN Number',
            promptTam: 'விதவைச் சான்றிதழ் விண்ணப்பிக்க விண்ணப்பதாரரின் 13-இலக்க CAN எண் கட்டாயமாகும்.',
            fallbackServiceId: 'TNEGA_CAN_REGISTER'
        }
    ],

    bucketA: [
        { key: 'fullNameEng', label: 'விண்ணப்பதாரர் பெயர் (ஆங்கிலம்)' },
        { key: 'fullNameTam', label: 'விண்ணப்பதாரர் பெயர் (தமிழ்)' },
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
            key: 'spouseNameEng',
            altKeys: ['husbandNameEng'],
            labelTam: 'கணவரின் பெயர் (ஆங்கிலம்)',
            labelEng: "Spouse's Name (English)",
            promptTam: 'காலமான கணவரின் பெயரை உள்ளிடவும்:',
            mandatory: true,
            type: 'text'
        },
        {
            key: 'dateOfDeath',
            labelTam: 'கணவர் இறந்த தேதி (Date of Death)',
            labelEng: 'Date of Death (dd-MMM-yyyy)',
            promptTam: 'கணவர் இறந்த தேதியை உள்ளிடவும் (எ.கா: 15-Jan-2025):',
            mandatory: true,
            type: 'date'
        },
        {
            key: 'deathCertificateNo',
            labelTam: 'இறப்புச் சான்றிதழ் எண் (Death Certificate No.)',
            labelEng: 'Death Certificate Number',
            promptTam: 'கணவரின் இறப்புச் சான்றிதழ் எண்ணை உள்ளிடவும்:',
            mandatory: true,
            type: 'text'
        },
        {
            key: 'dateOfMarriage',
            labelTam: 'திருமணத் தேதி (Date of Marriage - விருப்பம்)',
            labelEng: 'Date of Marriage (Optional)',
            promptTam: 'திருமணத் தேதியை உள்ளிடவும் (தெரியாவிட்டால் தவிர்க்கலாம்):',
            mandatory: false,
            type: 'date'
        }
    ],

    requiredDocuments: [
        {
            key: 'profilePhoto',
            altKeys: ['photo', 'headPhoto'],
            labelTam: 'விண்ணப்பதாரர் பாஸ்போர்ட் புகைப்படம் (<50KB)',
            labelEng: 'Applicant Passport Photo',
            format: 'image',
            maxSizeKB: 50,
            mandatory: true
        },
        {
            key: 'headAadhaar',
            altKeys: ['aadhaar', 'smartCard'],
            labelTam: 'முகவரி ஆதாரம் (ஆதார் / ஸ்மார்ட் கார்டு)',
            labelEng: 'Any Address Proof (Aadhaar)',
            format: 'pdf',
            maxSizeKB: 200,
            mandatory: true,
            isDualSided: true
        },
        {
            key: 'deathCertificate',
            altKeys: ['husbandDeathCertificate', 'deathCertificatePath'],
            labelTam: 'கணவரின் இறப்புச் சான்றிதழ் (Death Certificate of Husband)',
            labelEng: 'Death Certificate of Husband',
            format: 'pdf',
            maxSizeKB: 200,
            mandatory: true
        },
        {
            key: 'marriageProof',
            altKeys: ['marriageCertificate', 'smartCard', 'rationCard'],
            labelTam: 'திருமண ஆதாரம் (திருமண சான்றிதழ் / ஸ்மார்ட் கார்டு / திருமண அழைப்பிதழ்)',
            labelEng: 'Marriage Registration Certificate or Marriage Proof',
            format: 'pdf',
            maxSizeKB: 200,
            mandatory: true
        },
        {
            key: 'selfDeclaration',
            labelTam: 'சுய உறுதிமொழிப் படிவம் (போர்ட்டலில் தானாகத் தரவிறக்கப்படும்)',
            labelEng: 'Self Declaration of Applicant',
            format: 'pdf',
            maxSizeKB: 200,
            mandatory: false
        }
    ],

    getRunner: () => {
        const { startTnegaWidowFlow } = require('../../portal/tnega/tnega_widow_certificate');
        return startTnegaWidowFlow;
    }
};
