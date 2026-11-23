const baseManifest = require('../../catalog/services/tnega_obc');

module.exports = {
    ...baseManifest,
    id: 'TNEGA_OBC',
    portal: 'TNEGA',
    subService: 'OBC',
    code: 'REV-115',
    ownedStates: [
        'OBC_INTAKE',
        'OBC_CAN_GATE',
        'OBC_CAN_WAIT',
        'OBC_PHOTO_WAIT',
        'OBC_AADHAAR_WAIT',
        'OBC_AADHAAR_BACK_WAIT',
        'OBC_SMARTCARD_WAIT',
        'OBC_SMARTCARD_BACK_WAIT',
        'OBC_COMMUNITY_PROOF_WAIT',
        'OBC_INCOME_PROOF_WAIT',
        'OBC_MOTHER_NAME_WAIT',
        'OBC_CASTE_WAIT',
        'OBC_OCCUPATION_WAIT',
        'OBC_FATHER_OCC_WAIT',
        'OBC_MOTHER_OCC_WAIT',
        'OBC_INCOME_WAIT',
        'OBC_FATHER_OCCUPATION_WAIT',
        'OBC_MOTHER_OCCUPATION_WAIT',
        'OBC_ANNUAL_INCOME_WAIT',
        'READY_TO_APPLY_OBC',
        'READY_TO_SUBMIT_OBC'
    ],
    schema: {
        serviceCode: 'REV-115',
        bucketA_DocumentExtracted: [
            'fullNameEng', 'fullNameTam', 'fatherNameEng', 'fatherNameTam',
            'motherNameEng', 'motherNameTam', 'headAadhaar', 'headDob', 'headGender',
            'doorNo', 'streetTam', 'village', 'taluk', 'district', 'pincode'
        ],
        bucketB_UserPrompted: [
            { key: 'headPhotoPath', state: 'OBC_PHOTO_WAIT', label: 'விண்ணப்பதாரர் புகைப்படம் (Photo <250px, <50KB)' },
            { key: 'headAadhaarDocPath', state: 'OBC_AADHAAR_WAIT', label: 'முகவரி ஆதாரம் (ஆதார் அட்டை)' },
            { key: 'smartCard', state: 'OBC_SMARTCARD_WAIT', label: 'குடும்ப ஸ்மார்ட் ரேஷன் கார்டு (Smart Ration Card)' },
            { key: 'communityProof', state: 'OBC_COMMUNITY_PROOF_WAIT', label: 'சாதிச் சான்றிதழ் (Community Certificate)' },
            { key: 'incomeTaxReturn', state: 'OBC_INCOME_PROOF_WAIT', label: 'வருமான வரி / வருமானச் சான்று (ITR / Income Proof)' },
            { key: 'canNumber', state: 'OBC_CAN_GATE', label: '13/15-இலக்க CAN எண்' },
            { key: 'motherNameTam', state: 'OBC_MOTHER_NAME_WAIT', label: 'தாயின் பெயர் (Mother Name)' },
            { key: 'caste', state: 'OBC_CASTE_WAIT', label: 'OBC சாதி / உட்பிரிவு (Caste)' },
            { key: 'occupation', state: 'OBC_OCCUPATION_WAIT', label: 'விண்ணப்பதாரர் பணி (Occupation)' },
            { key: 'fatherOccupation', state: 'OBC_FATHER_OCC_WAIT', label: 'தந்தையின் தொழில் / நிலை' },
            { key: 'motherOccupation', state: 'OBC_MOTHER_OCC_WAIT', label: 'தாயின் தொழில் / நிலை' },
            { key: 'annualIncome', state: 'OBC_INCOME_WAIT', label: 'குடும்ப ஆண்டு வருமானம் (Annual Income)' }
        ]
    }
};
