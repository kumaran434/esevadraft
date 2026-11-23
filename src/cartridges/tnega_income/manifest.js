const baseManifest = require('../../catalog/services/tnega_income');

module.exports = {
    ...baseManifest,
    id: 'TNEGA_INCOME',
    portal: 'TNEGA',
    subService: 'INCOME',
    code: 'REV-103',
    ownedStates: [
        'INCOME_INTAKE',
        'INCOME_CAN_GATE',
        'INCOME_CAN_WAIT',
        'INCOME_PHOTO_WAIT',
        'INCOME_AADHAAR_WAIT',
        'INCOME_AADHAAR_BACK_WAIT',
        'INCOME_SMARTCARD_WAIT',
        'INCOME_SMARTCARD_BACK_WAIT',
        'INCOME_PROOF_WAIT',
        'INCOME_MONTHLY_WAIT',
        'INCOME_PROFESSION_WAIT',
        'INCOME_MOTHER_NAME_WAIT',
        'INCOME_COMMUNITY_WAIT',
        'INCOME_MEMBER_COUNT_WAIT',
        'INCOME_SELECT_MEMBERS_WAIT',
        'INCOME_EXTRA_NEWBORN_WAIT',
        'INCOME_ADDITIONAL_MEMBER_WAIT',
        'INCOME_ADDITIONAL_MEMBER_WORK_WAIT',
        'INCOME_SALARY_DOC_OPTIONAL_WAIT',
        'READY_TO_APPLY_INCOME'
    ],
    schema: {
        serviceCode: 'REV-103',
        bucketA_DocumentExtracted: [
            'fullNameEng', 'fullNameTam', 'fatherNameEng', 'fatherNameTam',
            'headAadhaar', 'headDob', 'headGender',
            'doorNo', 'streetTam', 'village', 'taluk', 'district', 'pincode'
        ],
        bucketB_UserPrompted: [
            { key: 'smartCard', state: 'INCOME_SMARTCARD_WAIT', label: 'குடும்ப ஸ்மார்ட் ரேஷன் கார்டு (Smart Ration Card)' },
            { key: 'incomeProof', state: 'INCOME_PROOF_WAIT', label: 'வருமான ஆதாரம் / சம்பளச் சான்று (Income Proof)' },
            { key: 'headPhotoPath', state: 'INCOME_PHOTO_WAIT', label: 'விண்ணப்பதாரர் புகைப்படம் (Photo <50KB)' },
            { key: 'canNumber', state: 'INCOME_CAN_GATE', label: '13/15-இலக்க CAN எண்' },
            { key: 'motherNameTam', state: 'INCOME_MOTHER_NAME_WAIT', label: 'தாயாரின் பெயர் (Mother Name)' },
            { key: 'community', state: 'INCOME_COMMUNITY_WAIT', label: 'வகுப்பு / பிரிவு (Community)' },
            { key: 'annualIncome', state: 'INCOME_INTAKE', label: 'குடும்ப ஆண்டு வருமானம் (Annual Income)' },
            { key: 'profession', state: 'INCOME_INTAKE', label: 'தொழில் (Occupation)' }
        ]
    }
};
