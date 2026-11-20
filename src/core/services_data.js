// ============================================================================
// eSevaDraft Universal Service Checklist Matrix & Registry Definitions
// Official Tamil Nadu e-Sevai, TNeGA & Government Portal Specifications
// ============================================================================

const SERVICES_REGISTRY = {
    NEW_RATION_CARD: {
        id: 'NEW_RATION_CARD',
        code: 'TNPDS_NFC',
        nameTamil: 'புதிய ஸ்மார்ட் ரேஷன் கார்டு',
        nameEnglish: 'New Smart Ration Card',
        portal: 'TNPDS (Civil Supplies & Consumer Protection)',
        portalUrl: 'https://www.tnpds.gov.in/pages/newsmartcard',
        totalSteps: 51,
        requiresFamilyMembers: true,
        commonFields: [
            { key: 'fullNameEng', label: 'குடும்பத் தலைவர் பெயர் (ஆங்கிலம்)' },
            { key: 'fullNameTam', label: 'குடும்பத் தலைவர் பெயர் (தமிழ்)' },
            { key: 'fatherNameEng', label: 'தந்தை / கணவர் பெயர் (ஆங்கிலம்)' },
            { key: 'fatherNameTam', label: 'தந்தை / கணவர் பெயர் (தமிழ்)' },
            { key: 'headDob', label: 'பிறந்த தேதி' },
            { key: 'headGender', label: 'பாலினம்' },
            { key: 'doorNo', label: 'கதவு எண்' },
            { key: 'streetEng', label: 'தெருப் பெயர் (ஆங்கிலம்)' },
            { key: 'streetTam', label: 'தெருப் பெயர் (தமிழ்)' },
            { key: 'district', label: 'மாவட்டம்' },
            { key: 'taluk', label: 'வட்டம் (Taluk)' },
            { key: 'village', label: 'வருவாய் கிராமம் (Village)' },
            { key: 'pincode', label: 'அஞ்சல் குறியீட்டு எண் (Pincode)' },
            { key: 'headAadhaar', label: 'குடும்பத் தலைவர் ஆதார் எண்' }
        ],
        specificFields: [
            { key: 'cardType', label: 'அட்டை வகை (அரிசி / சர்க்கரை / பண்டமில்லா)', default: 'RICE' },
            { key: 'gasDetails.cylinderCount', label: 'எரிவாயு இணைப்பு எண்ணிக்கை', default: '1' }
        ],
        requiredDocuments: [
            { key: 'profilePhoto', label: 'குடும்பத் தலைவர் பாஸ்போர்ட் புகைப்படம் (வெள்ளை பின்னணி)', format: 'image' },
            { key: 'headAadhaar', label: 'குடும்பத் தலைவர் அசல் ஆதார் அட்டை', format: 'pdf' },
            { key: 'gasBook', label: 'எரிவாயு நுகர்வோர் அட்டை / குடியிருப்புச் சான்று', format: 'pdf' },
            { key: 'memberAadhaars', label: 'குடும்ப உறுப்பினர்களின் தனித்தனி ஆதார் அட்டைகள்', format: 'pdf', multiple: true }
        ]
    },

    ADD_MEMBER: {
        id: 'ADD_MEMBER',
        code: 'TNPDS_ADD_MEM',
        nameTamil: 'குடும்ப உறுப்பினர் சேர்க்கை',
        nameEnglish: 'Add Family Member',
        portal: 'TNPDS (Civil Supplies & Consumer Protection)',
        portalUrl: 'https://www.tnpds.gov.in',
        totalSteps: 8,
        requiresFamilyMembers: false,
        commonFields: [],
        specificFields: [
            { key: 'subServiceData.memberName', label: 'உறுப்பினர் பெயர்' },
            { key: 'subServiceData.aadhaarNo', label: 'உறுப்பினர் ஆதார் எண்' },
            { key: 'subServiceData.relationship', label: 'உறவுமுறை' }
        ],
        requiredDocuments: [
            { key: 'memberAadhaar', label: 'உறுப்பினர் ஆதார் அட்டை (2-in-1 PDF)', format: 'pdf' }
        ],
        prohibitedDocuments: ['profilePhoto', 'headAadhaar']
    },

    CHANGE_ADDRESS: {
        id: 'CHANGE_ADDRESS',
        code: 'TNPDS_CHG_ADDR',
        nameTamil: 'குடும்ப அட்டை முகவரி மாற்றம்',
        nameEnglish: 'Ration Card Address Change',
        portal: 'TNPDS (Civil Supplies & Consumer Protection)',
        portalUrl: 'https://www.tnpds.gov.in',
        totalSteps: 7,
        requiresFamilyMembers: false,
        commonFields: [],
        specificFields: [
            { key: 'subServiceData.newDoorNo', label: 'புதிய கதவு எண்' },
            { key: 'subServiceData.newStreet', label: 'புதிய தெருப் பெயர்' }
        ],
        requiredDocuments: [
            { key: 'newAddressProof', label: 'புதிய முகவரிச் சான்று', format: 'pdf' }
        ],
        prohibitedDocuments: ['profilePhoto']
    },

    UPDATE_MOBILE: {
        id: 'UPDATE_MOBILE',
        code: 'TNPDS_UPD_MOB',
        nameTamil: 'கைபேசி எண் மாற்றம்',
        nameEnglish: 'Update Mobile Number',
        portal: 'TNPDS (Civil Supplies & Consumer Protection)',
        portalUrl: 'https://www.tnpds.gov.in',
        totalSteps: 10,
        requiresFamilyMembers: false,
        commonFields: [],
        specificFields: [
            { key: 'subServiceData.newMobile', label: 'புதிய கைபேசி எண்' }
        ],
        requiredDocuments: [],
        prohibitedDocuments: ['profilePhoto', 'headAadhaar']
    },

    CHANGE_HEAD: {
        id: 'CHANGE_HEAD',
        code: 'TNPDS_CHG_HEAD',
        nameTamil: 'குடும்பத் தலைவர் மாற்றம்',
        nameEnglish: 'Change Family Head',
        portal: 'TNPDS (Civil Supplies & Consumer Protection)',
        portalUrl: 'https://www.tnpds.gov.in',
        totalSteps: 10,
        requiresFamilyMembers: true,
        commonFields: [],
        specificFields: [
            { key: 'subServiceData.newHeadName', label: 'புதிய குடும்பத் தலைவர் பெயர்' },
            { key: 'subServiceData.reason', label: 'காரணம்' }
        ],
        requiredDocuments: ['headPhoto', 'supportingDoc'],
        prohibitedDocuments: []
    },

    INCOME_CERTIFICATE: {
        id: 'INCOME_CERTIFICATE',
        code: 'REV-103',
        nameTamil: 'வருமானச் சான்றிதழ்',
        nameEnglish: 'Income Certificate',
        portal: 'TNeGA Revenue Department (e-Sevai)',
        portalUrl: 'https://www.tnesevai.tn.gov.in',
        totalSteps: 18,
        requiresFamilyMembers: false,
        commonFields: [
            { key: 'canNumber', label: '13-இலக்க CAN எண்' },
            { key: 'fullNameEng', label: 'விண்ணப்பதாரர் பெயர் (ஆங்கிலம்)' },
            { key: 'fullNameTam', label: 'விண்ணப்பதாரர் பெயர் (தமிழ்)' },
            { key: 'fatherNameEng', label: 'தந்தை / கணவர் பெயர்' },
            { key: 'motherNameTam', label: 'தாயின் பெயர் (Mother Name)' },
            { key: 'community', label: 'வகுப்பு / பிரிவு (Community)' },
            { key: 'doorNo', label: 'கதவு எண்' },
            { key: 'streetEng', label: 'தெருப் பெயர்' },
            { key: 'district', label: 'மாவட்டம்' },
            { key: 'taluk', label: 'வட்டம்' },
            { key: 'village', label: 'வருவாய் கிராமம்' },
            { key: 'pincode', label: 'பின்கோடு' },
            { key: 'headAadhaar', label: 'ஆதார் எண்' }
        ],
        specificFields: [
            { key: 'annualIncome', label: 'குடும்ப மொத்த ஆண்டு வருமானம் (Annual Income)', mandatory: true },
            { key: 'profession', label: 'தொழில் (Occupation / Profession)', mandatory: true },
            { key: 'purpose', label: 'சான்றிதழ் தேவைப்படும் நோக்கம் (Purpose)', mandatory: false }
        ],
        requiredDocuments: [
            { key: 'profilePhoto', label: 'விண்ணப்பதாரர் புகைப்படம்', format: 'image' },
            { key: 'headAadhaar', label: 'ஆதார் அட்டை', format: 'pdf' },
            { key: 'incomeProof', label: 'சம்பளச் சான்று அல்லது சுய அறிவிப்புப் படிவம் (Self-declaration)', format: 'pdf', optional: true },
            { key: 'smartCard', label: 'குடும்ப ஸ்மார்ட் ரேஷன் கார்டு (Smart Ration Card)', format: 'pdf' }
        ]
    },

    RESIDENCE_CERTIFICATE: {
        id: 'RESIDENCE_CERTIFICATE',
        code: 'REV-101',
        nameTamil: 'இருப்பிடச் சான்றிதழ்',
        nameEnglish: 'Residence / Nativity Certificate',
        portal: 'TNeGA Revenue Department (e-Sevai)',
        portalUrl: 'https://www.tnesevai.tn.gov.in',
        totalSteps: 16,
        requiresFamilyMembers: false,
        commonFields: [
            { key: 'fullNameEng', label: 'விண்ணப்பதாரர் பெயர்' },
            { key: 'fatherNameEng', label: 'தந்தை / கணவர் பெயர்' },
            { key: 'doorNo', label: 'கதவு எண்' },
            { key: 'streetEng', label: 'தெருப் பெயர்' },
            { key: 'district', label: 'மாவட்டம்' },
            { key: 'taluk', label: 'வட்டம்' },
            { key: 'village', label: 'வருவாய் கிராமம்' },
            { key: 'pincode', label: 'பின்கோடு' },
            { key: 'headAadhaar', label: 'ஆதார் எண்' }
        ],
        specificFields: [
            { key: 'yearsOfResidence', label: 'தமிழ்நாட்டில் தொடர்ந்து வசிக்கும் வருடங்கள் (Years of Continuous Residence)', mandatory: true, default: '5+' }
        ],
        requiredDocuments: [
            { key: 'profilePhoto', label: 'விண்ணப்பதாரர் புகைப்படம்', format: 'image' },
            { key: 'headAadhaar', label: 'ஆதார் அட்டை', format: 'pdf' },
            { key: 'smartCard', label: 'குடும்ப ஸ்மார்ட் ரேஷன் கார்டு', format: 'pdf' },
            { key: 'residenceProof', label: 'முகவரிச் சான்று (மின் கட்டணம் / வீட்டு வரி / கேஸ் அட்டை)', format: 'pdf' }
        ]
    },

    COMMUNITY_CERTIFICATE: {
        id: 'COMMUNITY_CERTIFICATE',
        code: 'REV-101',
        nameTamil: 'சாதிச் சான்றிதழ்',
        nameEnglish: 'Community Certificate',
        portal: 'TNeGA Revenue Department (e-Sevai)',
        portalUrl: 'https://www.tnesevai.tn.gov.in',
        totalSteps: 20,
        requiresFamilyMembers: false,
        commonFields: [
            { key: 'canNumber', label: '13-இலக்க CAN எண்' },
            { key: 'fullNameEng', label: 'விண்ணப்பதாரர் பெயர்' },
            { key: 'fatherNameEng', label: 'தந்தை / கணவர் பெயர்' },
            { key: 'motherNameTam', label: 'தாயின் பெயர் (Mother Name)' },
            { key: 'doorNo', label: 'கதவு எண்' },
            { key: 'streetEng', label: 'தெருப் பெயர்' },
            { key: 'district', label: 'மாவட்டம்' },
            { key: 'taluk', label: 'வட்டம்' },
            { key: 'village', label: 'வருவாய் கிராமம்' },
            { key: 'pincode', label: 'பின்கோடு' },
            { key: 'headAadhaar', label: 'ஆதார் எண்' }
        ],
        specificFields: [
            { key: 'religion', label: 'மதம் (Religion)', mandatory: true, default: 'இந்து (Hindu)' },
            { key: 'community', label: 'சமூகம் (Community - BC/MBC/SC/ST)', mandatory: true },
            { key: 'caste', label: 'உட்சாதி பிரிவு (Sub-Caste)', mandatory: true }
        ],
        requiredDocuments: [
            { key: 'profilePhoto', label: 'விண்ணப்பதாரர் புகைப்படம்', format: 'image' },
            { key: 'headAadhaar', label: 'ஆதார் அட்டை', format: 'pdf' },
            { key: 'smartCard', label: 'குடும்ப ஸ்மார்ட் ரேஷன் கார்டு', format: 'pdf' },
            { key: 'communityProof', label: 'பள்ளி மாற்றுச் சான்றிதழ் (TC) அல்லது பெற்றோர் சாதிச் சான்றிதழ்', format: 'pdf' }
        ]
    },

    VOTER_ID: {
        id: 'VOTER_ID',
        code: 'NVSP-FORM-6',
        nameTamil: 'புதிய வாக்காளர் அட்டை',
        nameEnglish: 'New Voter ID (Form 6)',
        portal: 'Election Commission of India (ECI / NVSP)',
        portalUrl: 'https://voters.eci.gov.in',
        totalSteps: 24,
        requiresFamilyMembers: false,
        commonFields: [
            { key: 'fullNameEng', label: 'விண்ணப்பதாரர் பெயர்' },
            { key: 'headDob', label: 'பிறந்த தேதி' },
            { key: 'headGender', label: 'பாலினம்' },
            { key: 'doorNo', label: 'கதவு எண்' },
            { key: 'streetEng', label: 'தெருப் பெயர்' },
            { key: 'district', label: 'மாவட்டம்' },
            { key: 'taluk', label: 'வட்டம்' },
            { key: 'village', label: 'கிராமம் / வார்டு' },
            { key: 'pincode', label: 'பின்கோடு' },
            { key: 'headAadhaar', label: 'ஆதார் எண்' }
        ],
        specificFields: [
            { key: 'assemblyConstituency', label: 'சட்டமன்றத் தொகுதி (Assembly Constituency)', mandatory: true }
        ],
        requiredDocuments: [
            { key: 'profilePhoto', label: 'பாஸ்போர்ட் புகைப்படம்', format: 'image' },
            { key: 'headAadhaar', label: 'ஆதார் அட்டை (வயது மற்றும் இருப்பிடச் சான்று)', format: 'pdf' }
        ]
    },

    FIRST_GRADUATE_CERTIFICATE: {
        id: 'FIRST_GRADUATE_CERTIFICATE',
        code: 'REV-104',
        nameTamil: 'முதல் பட்டதாரி சான்றிதழ்',
        nameEnglish: 'First Graduate Certificate',
        portal: 'TNeGA Revenue Department (e-Sevai)',
        portalUrl: 'https://www.tnesevai.tn.gov.in',
        totalSteps: 22,
        requiresFamilyMembers: false,
        commonFields: [
            { key: 'canNumber', label: '13-இலக்க CAN எண்' },
            { key: 'fullNameEng', label: 'விண்ணப்பதாரர் பெயர் (ஆங்கிலம்)' },
            { key: 'fullNameTam', label: 'விண்ணப்பதாரர் பெயர் (தமிழ்)' },
            { key: 'fatherNameEng', label: 'தந்தை பெயர்' },
            { key: 'motherNameTam', label: 'தாயின் பெயர் (Mother Name)' },
            { key: 'doorNo', label: 'கதவு எண்' },
            { key: 'streetEng', label: 'தெருப் பெயர்' },
            { key: 'district', label: 'மாவட்டம்' },
            { key: 'taluk', label: 'வட்டம்' },
            { key: 'village', label: 'வருவாய் கிராமம்' },
            { key: 'pincode', label: 'பின்கோடு' },
            { key: 'headAadhaar', label: 'ஆதார் எண்' }
        ],
        specificFields: [
            { key: 'currentCourse', label: 'படிக்கும் படிப்பு / பட்டம் (Degree/Course)', mandatory: true },
            { key: 'institutionName', label: 'கல்லூரி / கல்வி நிறுவனம் (College Name)', mandatory: true },
            { key: 'fatherEducation', label: 'தந்தையின் கல்வித் தகுதி', mandatory: true },
            { key: 'motherEducation', label: 'தாயின் கல்வித் தகுதி', mandatory: true },
            { key: 'yearOfPassing', label: '12-ஆம் வகுப்பு தேர்ச்சி ஆண்டு', mandatory: true }
        ],
        requiredDocuments: [
            { key: 'profilePhoto', label: 'விண்ணப்பதாரர் பாஸ்போர்ட் புகைப்படம்', format: 'image' },
            { key: 'headAadhaar', label: 'ஆதார் அட்டை (Any Address Proof)', format: 'pdf' },
            { key: 'applicantEducationProof', label: 'மாணவரின் 12-ஆம் வகுப்பு மாற்றுச் சான்றிதழ் (Applicant TC)', format: 'pdf' },
            { key: 'smartCard', label: 'குடும்ப அட்டை (Family or Smart Card)', format: 'pdf' },
            { key: 'fatherEducationProof', label: 'தந்தையின் பள்ளி மாற்றுச் சான்றிதழ் (Father TC)', format: 'pdf' },
            { key: 'motherEducationProof', label: 'தாயின் பள்ளி மாற்றுச் சான்றிதழ் (Mother TC)', format: 'pdf' },
            { key: 'selfDeclaration', label: 'சுய உறுதிமொழிப் படிவம் (Self-Declaration Form)', format: 'pdf', optional: true }
        ]
    },
    OBC_CERTIFICATE: {
        id: 'OBC_CERTIFICATE',
        nameTamil: 'OBC சான்றிதழ் (REV-115)',
        nameEnglish: 'OBC Certificate (Other Backward Classes)',
        portal: 'TNeGA (Revenue Department)',
        portalUrl: 'https://www.tnesevai.tn.gov.in/',
        totalSteps: 14,
        requiresFamilyMembers: false,
        requiredDocs: [
            { id: 'profilePhoto', nameTamil: 'விண்ணப்பதாரர் பாஸ்போர்ட் புகைப்படம் (<250x250px, <50KB)', mandatory: true },
            { id: 'headAadhaar', nameTamil: 'முகவரி ஆதாரம் (ஆதார் அட்டை / ஸ்மார்ட் கார்டு)', mandatory: true },
            { id: 'communityCertificate', nameTamil: 'சாதிச் சான்றிதழ் (Community Certificate)', mandatory: true },
            { id: 'incomeTaxReturn', nameTamil: 'வருமான வரி / வருமானச் சான்று (ITR / Income Proof)', mandatory: true }
        ],
        requiredFields: [
            { key: 'canNumber', labelTamil: '13-இலக்க CAN எண்' },
            { key: 'fullNameTam', labelTamil: 'விண்ணப்பதாரர் பெயர் (தமிழ்)' },
            { key: 'fatherNameTam', labelTamil: 'தந்தை பெயர் (தமிழ்)' },
            { key: 'motherNameTam', labelTamil: 'தாயின் பெயர் (தமிழ்)' },
            { key: 'caste', labelTamil: 'OBC சாதி / உட்பிரிவு (Caste)' },
            { key: 'occupation', labelTamil: 'விண்ணப்பதாரர் பணி (Occupation)' },
            { key: 'fatherOccupation', labelTamil: 'தந்தையின் தொழில் / நிலை' },
            { key: 'motherOccupation', labelTamil: 'தாயின் தொழில் / நிலை' },
            { key: 'annualIncome', labelTamil: 'குடும்ப ஆண்டு வருமானம் (ரூ)' }
        ]
    },
    LEGAL_HEIR_CERTIFICATE: {
        id: 'LEGAL_HEIR_CERTIFICATE',
        code: 'REV-114',
        nameTamil: 'சட்ட வாரிசு சான்றிதழ் (REV-114)',
        nameEnglish: 'Legal Heir Certificate',
        portal: 'TNeGA Revenue Department (e-Sevai)',
        portalUrl: 'https://www.tnesevai.tn.gov.in',
        totalSteps: 18,
        requiresFamilyMembers: true,
        commonFields: [
            { key: 'canNumber', label: '13-இலக்க CAN எண்' },
            { key: 'fullNameEng', label: 'விண்ணப்பதாரர் பெயர் (ஆங்கிலம்)' },
            { key: 'fullNameTam', label: 'விண்ணப்பதாரர் பெயர் (தமிழ்)' },
            { key: 'doorNo', label: 'கதவு எண்' },
            { key: 'streetEng', label: 'தெருப் பெயர்' },
            { key: 'district', label: 'மாவட்டம்' },
            { key: 'taluk', label: 'வட்டம்' },
            { key: 'village', label: 'வருவாய் கிராமம்' },
            { key: 'pincode', label: 'பின்கோடு' },
            { key: 'headAadhaar', label: 'ஆதார் எண்' }
        ],
        specificFields: [
            { key: 'deceasedNameTam', label: 'இறந்தவரின் பெயர் (Deceased Name)', mandatory: true },
            { key: 'dateOfDeath', label: 'இறந்த தேதி (Date of Death)', mandatory: true },
            { key: 'placeOfDeath', label: 'இறந்த இடம் (Place of Death)', mandatory: true },
            { key: 'deathCertificateNo', label: 'இறப்புச் சான்றிதழ் எண் (Death Certificate No.)', mandatory: true }
        ],
        requiredDocuments: [
            { key: 'deathCertificate', label: 'இறப்புச் சான்றிதழ் (Death Certificate of the deceased)', format: 'pdf' },
            { key: 'deceasedAddressProof', label: 'இறந்தவரின் முகவரிச் சான்று (Address Proof of Deceased)', format: 'pdf' },
            { key: 'headAadhaar', label: 'வாரிசு உறவுமுறைச் சான்று (ஆதார் / ஸ்மார்ட் கார்டு)', format: 'pdf' },
            { key: 'smartCard', label: 'குடும்ப ஸ்மார்ட் ரேஷன் கார்டு', format: 'pdf' },
            { key: 'birthCertificate', label: 'வாரிசுகளின் பிறப்புச் சான்றிதழ் / பள்ளி TC', format: 'pdf' }
        ]
    },
    WIDOW_CERTIFICATE: {
        id: 'WIDOW_CERTIFICATE',
        code: 'REV-109',
        nameTamil: 'விதவைச் சான்றிதழ் (REV-109)',
        nameEnglish: 'Widow Certificate',
        portal: 'TNeGA Revenue Department (e-Sevai)',
        portalUrl: 'https://www.tnesevai.tn.gov.in',
        totalSteps: 14,
        requiresFamilyMembers: false,
        commonFields: [
            { key: 'canNumber', label: '13-இலக்க CAN எண்' },
            { key: 'fullNameEng', label: 'விண்ணப்பதாரர் பெயர் (ஆங்கிலம்)' },
            { key: 'fullNameTam', label: 'விண்ணப்பதாரர் பெயர் (தமிழ்)' },
            { key: 'doorNo', label: 'கதவு எண்' },
            { key: 'streetEng', label: 'தெருப் பெயர்' },
            { key: 'district', label: 'மாவட்டம்' },
            { key: 'taluk', label: 'வட்டம்' },
            { key: 'village', label: 'வருவாய் கிராமம்' },
            { key: 'pincode', label: 'பின்கோடு' },
            { key: 'headAadhaar', label: 'ஆதார் எண்' }
        ],
        specificFields: [
            { key: 'spouseNameEng', label: 'கணவரின் பெயர் (Spouse Name)', mandatory: true },
            { key: 'dateOfDeath', label: 'கணவர் இறந்த தேதி (Date of Death)', mandatory: true },
            { key: 'deathCertificateNo', label: 'இறப்புச் சான்றிதழ் எண் (Death Certificate No.)', mandatory: true },
            { key: 'dateOfMarriage', label: 'திருமணத் தேதி (Date of Marriage - விருப்பம்)', mandatory: false }
        ],
        requiredDocuments: [
            { key: 'profilePhoto', label: 'விண்ணப்பதாரர் பாஸ்போர்ட் புகைப்படம் (<50KB)', format: 'image' },
            { key: 'headAadhaar', label: 'முகவரி ஆதாரம் (ஆதார் / ஸ்மார்ட் கார்டு)', format: 'pdf' },
            { key: 'deathCertificate', label: 'கணவரின் இறப்புச் சான்றிதழ் (Death Certificate of Husband)', format: 'pdf' },
            { key: 'smartCard', label: 'குடும்ப ஸ்மார்ட் ரேஷன் கார்டு', format: 'pdf' },
            { key: 'marriageProof', label: 'திருமண ஆதாரம் (திருமண சான்றிதழ் / ஸ்மார்ட் கார்டு)', format: 'pdf' }
        ]
    }
};

module.exports = {
    SERVICES_REGISTRY
};
