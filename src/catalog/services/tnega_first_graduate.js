/**
 * src/catalog/services/tnega_first_graduate.js
 * 
 * Modular Service Plugin: First Graduate Certificate (முதல் பட்டதாரி சான்றிதழ் REV-104)
 * Portal: TNeGA (Tamil Nadu e-Governance Agency - Revenue Department)
 */

module.exports = {
    id: 'TNEGA_FIRST_GRADUATE',
    aliases: ['FIRST_GRADUATE', 'FIRST_GRADUATE_CERTIFICATE', 'முதல் பட்டதாரி', 'முதல் பட்டதாரி சான்றிதழ்', 'REV-104'],
    code: 'REV-104',
    portal: 'TNEGA',
    portalName: 'TNeGA Revenue Department (e-Sevai)',
    nameTam: 'முதல் பட்டதாரி சான்றிதழ்',
    nameEng: 'First Graduate Certificate',
    category: 'REVENUE',
    portalUrl: 'https://www.tnesevai.tn.gov.in',
    descriptionTam: 'தமிழ்நாடு அரசு வருவாய்த் துறை வழங்கும் அதிகாரப்பூர்வ முதல் பட்டதாரி சான்றிதழ் (கல்லூரிக் கட்டணச் சலுகை)',

    prerequisites: [
        {
            key: 'canNumber',
            labelTam: '13-இலக்க CAN பதிவு எண்',
            labelEng: '13-digit CAN Number',
            promptTam: 'முதல் பட்டதாரி சான்றிதழ் விண்ணப்பிக்க 13-இலக்க CAN எண் கட்டாயமாகும்.',
            fallbackServiceId: 'TNEGA_CAN_REGISTER'
        }
    ],

    bucketA: [
        { key: 'fullNameEng', label: 'விண்ணப்பதாரர் பெயர் (ஆங்கிலம்)' },
        { key: 'fullNameTam', label: 'விண்ணப்பதாரர் பெயர் (தமிழ்)' },
        { key: 'fatherNameEng', label: 'தந்தை பெயர்' },
        { key: 'fatherNameTam', label: 'தந்தை பெயர் (தமிழ்)' },
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
            key: 'currentCourse',
            altKeys: ['degreeCourse', 'courseName'],
            labelTam: 'படிக்கும் படிப்பு / பட்டம்',
            labelEng: 'Degree / Course Name',
            promptTam: 'மாணவர் கல்லூரியில் படிக்கும் அல்லது சேரவுள்ள படிப்பு எது? (எ.கா: B.E. / B.Tech / M.B.B.S / B.Sc):',
            mandatory: true,
            type: 'text'
        },
        {
            key: 'institutionName',
            altKeys: ['collegeName', 'schoolCollegeName'],
            labelTam: 'கல்லூரி / கல்வி நிறுவனத்தின் பெயர்',
            labelEng: 'College / Institution Name',
            promptTam: 'கல்லூரி அல்லது கல்வி நிறுவனத்தின் பெயரை உள்ளிடவும்:',
            mandatory: true,
            type: 'text'
        },
        {
            key: 'fatherEducation',
            labelTam: 'தந்தையின் கல்வித் தகுதி',
            labelEng: "Father's Educational Qualification",
            promptTam: 'தந்தையின் கல்வித் தகுதியைத் தேர்ந்தெடுக்கவும் (எ.கா: 10th / 8th / எழுதப் படிக்கத் தெரியாதவர்):',
            mandatory: true,
            type: 'text'
        },
        {
            key: 'motherEducation',
            labelTam: 'தாயின் கல்வித் தகுதி',
            labelEng: "Mother's Educational Qualification",
            promptTam: 'தாயின் கல்வித் தகுதியைத் தேர்ந்தெடுக்கவும் (எ.கா: 8th / 5th / எழுதப் படிக்கத் தெரியாதவர்):',
            mandatory: true,
            type: 'text'
        },
        {
            key: 'familyGraduateConfirmed',
            labelTam: 'குடும்பத்தில் முதல் பட்டதாரி உறுதிப்படுத்தல்',
            labelEng: 'First Graduate Eligibility Confirmation',
            promptTam: 'குடும்பத்தில் வேறு யாரும் பட்டப்படிப்பு முடிக்கவில்லை என்பதை உறுதி செய்கிறீர்களா?',
            mandatory: true,
            type: 'boolean'
        }
    ],

    requiredDocuments: [
        {
            key: 'profilePhoto',
            labelTam: 'விண்ணப்பதாரர் பாஸ்போர்ட் புகைப்படம்',
            labelEng: 'Applicant Passport Photo',
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
            key: 'applicantEducationProof',
            altKeys: ['studentTc', 'twelfthMarksheet', 'bonafideCertificate'],
            labelTam: 'மாணவரின் 12-ஆம் வகுப்பு மாற்றுச் சான்றிதழ் (TC) / மதிப்பெண் பட்டியல்',
            labelEng: '12th Transfer Certificate (TC) / Marksheet',
            format: 'pdf',
            maxSizeKB: 200,
            mandatory: true
        },
        {
            key: 'smartCard',
            altKeys: ['rationCard'],
            labelTam: 'குடும்ப அட்டை (Smart Card / Ration Card)',
            labelEng: 'Family Smart Ration Card',
            format: 'pdf',
            maxSizeKB: 200,
            mandatory: true
        },
        {
            key: 'fatherEducationProof',
            altKeys: ['fatherTc'],
            labelTam: 'தந்தையின் பள்ளி மாற்றுச் சான்றிதழ் (TC) / கல்வி ஆவணம்',
            labelEng: "Father's School TC / Educational Proof",
            format: 'pdf',
            maxSizeKB: 200,
            mandatory: true
        },
        {
            key: 'motherEducationProof',
            altKeys: ['motherTc'],
            labelTam: 'தாயின் பள்ளி மாற்றுச் சான்றிதழ் (TC) / கல்வி ஆவணம்',
            labelEng: "Mother's School TC / Educational Proof",
            format: 'pdf',
            maxSizeKB: 200,
            mandatory: false
        },
        {
            key: 'selfDeclaration',
            labelTam: 'சுய உறுதிமொழிப் படிவம் (Self-Declaration Form)',
            labelEng: 'Joint Declaration Form',
            format: 'pdf',
            maxSizeKB: 200,
            mandatory: false
        }
    ],

    getRunner: () => {
        const { startTnegaFirstGraduateFlow } = require('../../portal/tnega/tnega_first_graduate');
        return startTnegaFirstGraduateFlow;
    }
};
