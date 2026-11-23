const baseManifest = require('../../catalog/services/tnega_first_graduate');

module.exports = {
    ...baseManifest,
    id: 'TNEGA_FIRST_GRADUATE',
    portal: 'TNEGA',
    subService: 'FIRST_GRADUATE',
    code: 'REV-104',
    ownedStates: [
        'FIRST_GRADUATE_INTAKE',
        'FIRST_GRADUATE_CAN_GATE',
        'FIRST_GRADUATE_CAN_WAIT',
        'FIRST_GRADUATE_PHOTO_WAIT',
        'FIRST_GRADUATE_AADHAAR_WAIT',
        'FIRST_GRADUATE_AADHAAR_BACK_WAIT',
        'FIRST_GRADUATE_SMARTCARD_WAIT',
        'FIRST_GRADUATE_SMARTCARD_BACK_WAIT',
        'FIRST_GRADUATE_APPLICANT_PROOF_WAIT',
        'FIRST_GRADUATE_FATHER_PROOF_WAIT',
        'FIRST_GRADUATE_MOTHER_PROOF_WAIT',
        'FIRST_GRADUATE_PARENTS_PROOF_WAIT',
        'FIRST_GRADUATE_MOTHER_NAME_WAIT',
        'FIRST_GRADUATE_PARENT_EDU_WAIT',
        'FIRST_GRADUATE_COURSE_WAIT',
        'FIRST_GRADUATE_YOP_WAIT',
        'FIRST_GRADUATE_COLLEGE_WAIT',
        'FIRST_GRADUATE_FAMILY_CHECK_GATE',
        'READY_TO_APPLY_FIRST_GRADUATE'
    ],
    schema: {
        serviceCode: 'REV-104',
        bucketA_DocumentExtracted: [
            'fullNameEng', 'fullNameTam', 'fatherNameEng', 'fatherNameTam',
            'headAadhaar', 'headDob', 'headGender',
            'doorNo', 'streetTam', 'village', 'taluk', 'district', 'pincode'
        ],
        bucketB_UserPrompted: [
            { key: 'headAadhaarDocPath', state: 'FIRST_GRADUATE_AADHAAR_WAIT', label: 'மாணவர் ஆதார் அட்டை (Aadhaar Card)' },
            { key: 'headPhotoPath', state: 'FIRST_GRADUATE_PHOTO_WAIT', label: 'மாணவர் பாஸ்போர்ட் புகைப்படம் (Photo <50KB)' },
            { key: 'applicantEducationProof', state: 'FIRST_GRADUATE_APPLICANT_PROOF_WAIT', label: 'மாணவரின் 12-ஆம் வகுப்பு TC / மதிப்பெண் பட்டியல்' },
            { key: 'smartCard', state: 'FIRST_GRADUATE_SMARTCARD_WAIT', label: 'குடும்ப அட்டை (Smart Card)' },
            { key: 'fatherEducationProof', state: 'FIRST_GRADUATE_FATHER_PROOF_WAIT', label: 'தந்தையின் பள்ளி மாற்றுச் சான்றிதழ் (Father TC)' },
            { key: 'motherEducationProof', state: 'FIRST_GRADUATE_MOTHER_PROOF_WAIT', label: 'தாயாரின் பள்ளி மாற்றுச் சான்றிதழ் (Mother TC)' },
            { key: 'canNumber', state: 'FIRST_GRADUATE_CAN_GATE', label: '13/15-இலக்க CAN எண்' },
            { key: 'motherNameTam', state: 'FIRST_GRADUATE_MOTHER_NAME_WAIT', label: 'தாயாரின் பெயர் (Mother Name)' },
            { key: 'fatherEducation', state: 'FIRST_GRADUATE_PARENT_EDU_WAIT', label: 'தந்தை & தாய் கல்வித் தகுதி' },
            { key: 'currentCourse', state: 'FIRST_GRADUATE_COURSE_WAIT', label: 'படிக்கும் படிப்பு / பட்டம் (Degree/Course)' },
            { key: 'yearOfPassing', state: 'FIRST_GRADUATE_YOP_WAIT', label: '12-ஆம் வகுப்பு தேர்ச்சி ஆண்டு (Year of Passing)' },
            { key: 'institutionName', state: 'FIRST_GRADUATE_COLLEGE_WAIT', label: 'கல்லூரி / கல்வி நிறுவனம் (College Name)' },
            { key: 'familyGraduateConfirmed', state: 'FIRST_GRADUATE_FAMILY_CHECK_GATE', label: 'குடும்பத்தில் முதல் பட்டதாரி உறுதிப்படுத்தல்' }
        ]
    }
};
