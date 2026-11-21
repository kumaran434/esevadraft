// =============================================================================
// eSevaDraft A-to-Z Service Plugin Manifest & Strict Isolation Dispatcher
// Single Source of Truth shared identically across:
//   - Browser UI (Edit Modal, Sidebar Viewer, Pre-Submit Engine)
//   - Backend Express Chat & Draft Routers
//   - Desktop Electron Automation Runner
//
// Zero substring `.includes()` guesswork: every service plugin explicitly owns
// its aliases, exact intakeStates, Edit Modal layout, required documents,
// Smart Card policy, and target portal automation runner.
// =============================================================================
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.ESEVA_PLUGINS = factory();
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const MENU_ONLY_STATES = new Set([
        'SERVICE_SELECTION',
        'RATION_CARD_SERVICES',
        'REVENUE_DEPARTMENT_SERVICES'
    ]);

    const SERVICE_PLUGINS = [
        // =====================================================================
        // TNPDS RATION CARD PLUGINS (Civil Supplies — Zero Smart Card Required for New Card)
        // =====================================================================
        {
            id: 'TNPDS_NEW_CARD',
            portal: 'TNPDS',
            portalLabel: 'TNPDS',
            subService: 'NEW_CARD',
            code: 'TNPDS_NFC',
            nameTam: 'புதிய ஸ்மார்ட் ரேஷன் கார்டு',
            nameEng: 'New Smart Ration Card',
            runner: 'startTnpdsRationCardFlow',
            aliases: [
                'TNPDS_NEW_CARD', 'TNPDS_NFC', 'NEW_CARD', 'NEW_RATION_CARD',
                'NEW_SMART_CARD', 'NEW_CARD_REGISTER', 'RATION', 'NEW RATION CARD',
                'புதிய ரேஷன் கார்டு', 'புதிய குடும்ப அட்டை', 'புதிய ஸ்மார்ட் ரேஷன் கார்டு'
            ],
            ownedStates: [
                'MEMBER_COUNT',
                'HEAD_PHOTO',
                'HEAD_AADHAAR_FRONT',
                'HEAD_AADHAAR_BACK',
                'HEAD_DETAILS_VERIFY',
                'MEMBER_AADHAAR_FRONT',
                'MEMBER_AADHAAR_BACK',
                'MEMBER_RELATIONSHIP',
                'MEMBER_DETAILS_VERIFY',
                'ADDRESS_CHOICE',
                'MOBILE_NUMBER',
                'RESIDENCE_PROOF_TYPE',
                'RESIDENCE_PROOF_DOC',
                'AADHAAR_MOBILE_CONFIRM',
                'READY_TO_APPLY'
            ],
            preSubmit: {
                requireSmartCard: false,
                requirePhoto: false,
                requiredDocGroups: []
            },
            editModal: {
                layoutMode: 'NEW_CARD',
                title: '✏️ புதிய குடும்ப அட்டை விண்ணப்ப விவரங்கள் (New Ration Card)',
                subtitle: 'அனைத்து விவரங்களையும் சரிபார்த்து திருத்தவும்',
                submitButtonHtml: '<i class="fa-solid fa-play"></i> 🚀 அரசு போர்ட்டலில் சமர்ப்பி (Submit Application)',
                isRationHead: true,
                showGasToggle: true,
                showSmartCardBox: false,
                showResidenceBox: true,
                showMembersAadhaarContainer: true,
                showSmartCardNoWrap: false,
                showCanNoWrap: false
            }
        },
        {
            id: 'TNPDS_ADD_MEMBER',
            portal: 'TNPDS',
            portalLabel: 'TNPDS',
            subService: 'ADD_MEMBER',
            code: 'TNPDS_ADD_MEM',
            nameTam: 'குடும்ப உறுப்பினர் சேர்க்கை',
            nameEng: 'Add Family Member',
            runner: 'startTnpdsAddMemberFlow',
            aliases: [
                'TNPDS_ADD_MEMBER', 'ADD_MEMBER', 'குடும்ப உறுப்பினர் சேர்க்க',
                'குடும்ப உறுப்பினர் சேர்க்கை', 'உறுப்பினர் சேர்க்கை', 'ADD MEMBER'
            ],
            ownedStates: [
                'RATION_ADD_MEMBER_TYPE',
                'RATION_ADD_MEMBER_AADHAAR_FRONT',
                'RATION_ADD_MEMBER_AADHAAR_BACK',
                'RATION_ADD_MEMBER_DOC',
                'RATION_ADD_MEMBER_RELATION',
                'RATION_ADD_MEMBER_PROOF',
                'RATION_ADD_MEMBER_CHILD_BIRTH',
                'RATION_ADD_MEMBER_VERIFY'
            ],
            preSubmit: { requireSmartCard: false, requirePhoto: false, requiredDocGroups: [] },
            editModal: {
                layoutMode: 'ADD_MEMBER',
                submitButtonHtml: '<i class="fa-solid fa-user-plus"></i> 🚀 குடும்ப உறுப்பினர் சேர்க்க (Add Member in TNPDS)',
                isRationHead: false
            }
        },
        {
            id: 'TNPDS_REMOVE_MEMBER',
            portal: 'TNPDS',
            portalLabel: 'TNPDS',
            subService: 'REMOVE_MEMBER',
            code: 'TNPDS_REM_MEM',
            nameTam: 'குடும்ப உறுப்பினர் நீக்கம்',
            nameEng: 'Remove Family Member',
            runner: 'startTnpdsRemoveMemberFlow',
            aliases: [
                'TNPDS_REMOVE_MEMBER', 'REMOVE_MEMBER', 'குடும்ப உறுப்பினர் நீக்க',
                'குடும்ப உறுப்பினர் நீக்கம்', 'உறுப்பினர் நீக்கம்', 'REMOVE MEMBER'
            ],
            ownedStates: [
                'RATION_REMOVE_MEMBER_REASON',
                'RATION_REMOVE_MEMBER_NAME',
                'RATION_REMOVE_MEMBER_CARD',
                'RATION_REMOVE_MEMBER_DOC',
                'RATION_REMOVE_MEMBER_VERIFY'
            ],
            preSubmit: { requireSmartCard: false, requirePhoto: false, requiredDocGroups: [] },
            editModal: {
                layoutMode: 'REMOVE_MEMBER',
                submitButtonHtml: '<i class="fa-solid fa-user-minus"></i> 🚀 குடும்ப உறுப்பினர் நீக்க (Remove Member in TNPDS)',
                isRationHead: false
            }
        },
        {
            id: 'TNPDS_CHANGE_ADDRESS',
            portal: 'TNPDS',
            portalLabel: 'TNPDS',
            subService: 'CHANGE_ADDRESS',
            code: 'TNPDS_CHG_ADDR',
            nameTam: 'முகவரி மாற்றம்',
            nameEng: 'Change of Address',
            runner: 'startTnpdsAddressChangeFlow',
            aliases: [
                'TNPDS_CHANGE_ADDRESS', 'CHANGE_ADDRESS', 'ADDRESS_CHANGE',
                'முகவரி மாற்றம்', 'குடும்ப அட்டை முகவரி மாற்றம்', 'CHANGE ADDRESS'
            ],
            ownedStates: [
                'RATION_CHANGE_ADDRESS_DOC',
                'RATION_CHANGE_ADDRESS_UPLOAD',
                'RATION_CHANGE_ADDRESS_CARD',
                'RATION_CHANGE_ADDRESS_DOOR',
                'RATION_CHANGE_ADDRESS_VERIFY'
            ],
            preSubmit: { requireSmartCard: false, requirePhoto: false, requiredDocGroups: [] },
            editModal: {
                layoutMode: 'CHANGE_ADDRESS',
                submitButtonHtml: '<i class="fa-solid fa-map-location-dot"></i> 🚀 முகவரி மாற்றம் செய்ய (Change Address in TNPDS)',
                isRationHead: false
            }
        },
        {
            id: 'TNPDS_UPDATE_MOBILE',
            portal: 'TNPDS',
            portalLabel: 'TNPDS',
            subService: 'UPDATE_MOBILE',
            code: 'TNPDS_UPD_MOB',
            nameTam: 'கைபேசி எண் மாற்றம்',
            nameEng: 'Update Mobile Number',
            runner: 'startTnpdsMobileChangeFlow',
            aliases: [
                'TNPDS_UPDATE_MOBILE', 'UPDATE_MOBILE', 'CHANGE_MOBILE',
                'CHANGE_OF_MOBILE_NUMBER', 'கைபேசி எண் மாற்றம்'
            ],
            ownedStates: [
                'RATION_CHANGE_MOBILE_NUMBER',
                'RATION_CHANGE_MOBILE_CARD',
                'RATION_CHANGE_MOBILE_VERIFY'
            ],
            preSubmit: { requireSmartCard: false, requirePhoto: false, requiredDocGroups: [] },
            editModal: { layoutMode: 'NEW_CARD', isRationHead: true }
        },
        {
            id: 'TNPDS_CHANGE_HEAD',
            portal: 'TNPDS',
            portalLabel: 'TNPDS',
            subService: 'CHANGE_HEAD',
            code: 'TNPDS_CHG_HEAD',
            nameTam: 'குடும்பத் தலைவர் மாற்றம்',
            nameEng: 'Family Head Change',
            runner: 'startTnpdsChangeHeadFlow',
            aliases: [
                'TNPDS_CHANGE_HEAD', 'CHANGE_HEAD', 'FAMILY_HEAD_MEMBER_CHANGE', 'குடும்பத் தலைவர் மாற்றம்'
            ],
            ownedStates: [
                'RATION_CHANGE_HEAD_NAME',
                'RATION_CHANGE_HEAD_DOC',
                'RATION_CHANGE_HEAD_VERIFY'
            ],
            preSubmit: { requireSmartCard: false, requirePhoto: false, requiredDocGroups: [] },
            editModal: { layoutMode: 'NEW_CARD', isRationHead: true }
        },

        // =====================================================================
        // TNeGA REVENUE DEPARTMENT PLUGINS (CAN + 7 Mandatory-Smart-Card Certificates)
        // =====================================================================
        {
            id: 'TNEGA_CAN_REGISTER',
            portal: 'TNEGA',
            portalLabel: 'TNeGA',
            subService: 'CAN_REGISTER',
            code: 'CAN_REGISTER',
            nameTam: 'புதிய CAN பதிவு',
            nameEng: 'TNeGA CAN Registration',
            runner: 'startTnegaCanRegisterFlow',
            aliases: ['TNEGA_CAN_REGISTER', 'CAN_REGISTER', 'புதிய CAN பதிவு'],
            ownedStates: [
                'CAN_REGISTER_INTAKE',
                'CAN_AADHAAR_BACK_WAIT',
                'CAN_MOTHER_NAME_WAIT',
                'CAN_COMMUNITY_WAIT',
                'READY_TO_APPLY_CAN',
                'CAN_DIRECT_INPUT_WAIT'
            ],
            preSubmit: { requireSmartCard: false, requirePhoto: false, requiredDocGroups: [] },
            editModal: {
                layoutMode: 'CAN',
                title: '📝 புதிய CAN பதிவு விவரங்கள் (New CAN Registration)',
                subtitle: 'CAN பதிவிற்கான விவரங்கள் மற்றும் பதிவேற்றப்பட்ட ஆவணங்களைச் சரிபார்க்கவும்',
                submitButtonHtml: '<i class="fa-solid fa-play"></i> 🚀 புதிய CAN பதிவு தொடங்க (Start CAN Automation)',
                isRationHead: false,
                showGasToggle: false,
                showSmartCardBox: false,
                showResidenceBox: false,
                showMembersAadhaarContainer: false
            }
        },
        {
            id: 'TNEGA_CAN_SEARCH',
            portal: 'TNEGA',
            portalLabel: 'TNeGA',
            subService: 'CAN_SEARCH',
            code: 'CAN_SEARCH',
            nameTam: 'CAN எண் தேடல்',
            nameEng: 'TNeGA CAN Search',
            runner: 'startTnegaCanSearchFlow',
            aliases: ['TNEGA_CAN_SEARCH', 'CAN_SEARCH'],
            ownedStates: ['CAN_SEARCH_INTAKE'],
            preSubmit: { requireSmartCard: false, requirePhoto: false, requiredDocGroups: [] },
            editModal: { layoutMode: 'CAN', isRationHead: false }
        },
        {
            id: 'TNEGA_COMMUNITY',
            portal: 'TNEGA',
            portalLabel: 'TNeGA',
            subService: 'COMMUNITY',
            code: 'REV-101',
            nameTam: 'சாதிச் சான்றிதழ்',
            nameEng: 'Community Certificate',
            runner: 'startTnegaCommunityFlow',
            aliases: [
                'TNEGA_COMMUNITY', 'COMMUNITY', 'COMMUNITY_CERTIFICATE', 'COMMUNITY_CERT',
                'REV-101', 'REV_101', 'REV101', 'சாதிச் சான்றிதழ்', 'சாதி'
            ],
            ownedStates: [
                'COMMUNITY_INTAKE',
                'COMMUNITY_CAN_GATE',
                'COMMUNITY_CAN_WAIT',
                'COMMUNITY_PHOTO_WAIT',
                'COMMUNITY_AADHAAR_WAIT',
                'COMMUNITY_AADHAAR_BACK_WAIT',
                'COMMUNITY_SMARTCARD_WAIT',
                'COMMUNITY_SMARTCARD_BACK_WAIT',
                'COMMUNITY_PROOF_WAIT',
                'COMMUNITY_MOTHER_NAME_WAIT',
                'COMMUNITY_RELIGION_WAIT',
                'COMMUNITY_COMM_WAIT',
                'COMMUNITY_CASTE_WAIT',
                'COMMUNITY_PARENTS_CASTE_GATE',
                'READY_TO_APPLY_COMMUNITY'
            ],
            preSubmit: { requireSmartCard: true, requirePhoto: true, requireDocKeys: ['communityProof'] },
            editModal: {
                layoutMode: 'COMMUNITY',
                title: '📜 சாதிச் சான்றிதழ் விண்ணப்ப விவரங்கள் (Community Certificate)',
                subtitle: 'சாதிச் சான்றிதழ் விண்ணப்ப விவரங்கள் மற்றும் பதிவேற்றப்பட்ட ஆவணங்களைச் சரிபார்க்கவும்',
                submitButtonHtml: '<i class="fa-solid fa-play"></i> 🚀 சாதிச் சான்றிதழ் விண்ணப்பிக்க (Start Community Apply)',
                isRationHead: false,
                showGasToggle: false,
                showSmartCardBox: true,
                showResidenceBox: false,
                showUniversalDocs: true
            }
        },
        {
            id: 'TNEGA_RESIDENCE',
            portal: 'TNEGA',
            portalLabel: 'TNeGA',
            subService: 'RESIDENCE',
            code: 'REV-102',
            nameTam: 'இருப்பிடச் சான்றிதழ்',
            nameEng: 'Residence Certificate',
            runner: 'startTnegaResidenceFlow',
            aliases: [
                'TNEGA_RESIDENCE', 'RESIDENCE', 'RESIDENCE_CERTIFICATE', 'RESIDENCE_CERT',
                'NATIVITY', 'NATIVITY_CERTIFICATE', 'REV-102', 'REV_102', 'REV-116', 'REV_116',
                'இருப்பிடச் சான்றிதழ்', 'இருப்பிடம்'
            ],
            ownedStates: [
                'RESIDENCE_INTAKE',
                'RESIDENCE_CAN_GATE',
                'RESIDENCE_CAN_WAIT',
                'RESIDENCE_PHOTO_WAIT',
                'RESIDENCE_AADHAAR_WAIT',
                'RESIDENCE_AADHAAR_BACK_WAIT',
                'RESIDENCE_SMARTCARD_WAIT',
                'RESIDENCE_SMARTCARD_BACK_WAIT',
                'RESIDENCE_PROOF_WAIT',
                'RESIDENCE_YEARS_WAIT',
                'RESIDENCE_PURPOSE_WAIT',
                'READY_TO_APPLY_RESIDENCE'
            ],
            preSubmit: { requireSmartCard: true, requirePhoto: true, requireDocKeys: ['residenceProof'] },
            editModal: {
                layoutMode: 'RESIDENCE',
                title: '🏠 இருப்பிடச் சான்றிதழ் விண்ணப்ப விவரங்கள் (Residence Certificate)',
                subtitle: 'இருப்பிடச் சான்றிதழ் விண்ணப்ப விவரங்கள் மற்றும் பதிவேற்றப்பட்ட ஆவணங்களைச் சரிபார்க்கவும்',
                submitButtonHtml: '<i class="fa-solid fa-play"></i> 🚀 இருப்பிடச் சான்றிதழ் விண்ணப்பிக்க (Start Residence Apply)',
                isRationHead: false,
                showGasToggle: false,
                showSmartCardBox: true,
                showResidenceBox: true,
                showUniversalDocs: false
            }
        },
        {
            id: 'TNEGA_INCOME',
            portal: 'TNEGA',
            portalLabel: 'TNeGA',
            subService: 'INCOME',
            code: 'REV-103',
            nameTam: 'வருமானச் சான்றிதழ்',
            nameEng: 'Income Certificate',
            runner: 'startTnegaIncomeFlow',
            aliases: [
                'TNEGA_INCOME', 'INCOME', 'INCOME_CERTIFICATE', 'INCOME_CERT',
                'REV-103', 'REV_103', 'REV103', 'வருமானச் சான்றிதழ்', 'வருமானம்'
            ],
            ownedStates: [
                'INCOME_INTAKE',
                'INCOME_CAN_GATE',
                'INCOME_CAN_WAIT',
                'INCOME_PHOTO_WAIT',
                'INCOME_AADHAAR_WAIT',
                'INCOME_AADHAAR_BACK_WAIT',
                'INCOME_SMARTCARD_WAIT',
                'INCOME_SMARTCARD_BACK_WAIT',
                'INCOME_MOTHER_NAME_WAIT',
                'INCOME_COMMUNITY_WAIT',
                'INCOME_MEMBER_COUNT_WAIT',
                'INCOME_SELECT_MEMBERS_WAIT',
                'INCOME_EXTRA_NEWBORN_WAIT',
                'INCOME_ADDITIONAL_MEMBER_WAIT',
                'INCOME_ADDITIONAL_MEMBER_WORK_WAIT',
                'INCOME_SALARY_DOC_OPTIONAL_WAIT',
                'INCOME_PROOF_WAIT',
                'INCOME_MONTHLY_WAIT',
                'INCOME_PROFESSION_WAIT',
                'READY_TO_APPLY_INCOME'
            ],
            preSubmit: { requireSmartCard: true, requirePhoto: true, requireDocKeys: [] },
            editModal: {
                layoutMode: 'INCOME',
                title: '💰 வருமானச் சான்றிதழ் விண்ணப்ப விவரங்கள் (Income Certificate)',
                subtitle: 'வருமானச் சான்றிதழ் விண்ணப்ப விவரங்கள் மற்றும் பதிவேற்றப்பட்ட ஆவணங்களைச் சரிபார்க்கவும்',
                submitButtonHtml: '<i class="fa-solid fa-play"></i> 🚀 வருமானச் சான்றிதழ் விண்ணப்பிக்க (Start Income Apply)',
                isRationHead: false,
                showGasToggle: false,
                showSmartCardBox: true,
                showResidenceBox: false,
                showUniversalDocs: true
            }
        },
        {
            id: 'TNEGA_FIRST_GRADUATE',
            portal: 'TNEGA',
            portalLabel: 'TNeGA',
            subService: 'FIRST_GRADUATE',
            code: 'REV-104',
            nameTam: 'முதல் பட்டதாரி சான்றிதழ்',
            nameEng: 'First Graduate Certificate',
            runner: 'startTnegaFirstGraduateFlow',
            aliases: [
                'TNEGA_FIRST_GRADUATE', 'FIRST_GRADUATE', 'FIRST_GRADUATE_CERTIFICATE',
                'REV-104', 'REV_104', 'REV104', 'முதல் பட்டதாரி சான்றிதழ்', 'முதல் பட்டதாரி'
            ],
            ownedStates: [
                'FIRST_GRADUATE_INTAKE',
                'FIRST_GRADUATE_CAN_GATE',
                'FIRST_GRADUATE_CAN_WAIT',
                'FIRST_GRADUATE_PHOTO_WAIT',
                'FIRST_GRADUATE_AADHAAR_WAIT',
                'FIRST_GRADUATE_AADHAAR_BACK_WAIT',
                'FIRST_GRADUATE_SMARTCARD_WAIT',
                'FIRST_GRADUATE_SMARTCARD_BACK_WAIT',
                'FIRST_GRADUATE_MOTHER_NAME_WAIT',
                'FIRST_GRADUATE_APPLICANT_PROOF_WAIT',
                'FIRST_GRADUATE_FATHER_PROOF_WAIT',
                'FIRST_GRADUATE_PARENTS_PROOF_WAIT',
                'FIRST_GRADUATE_MOTHER_PROOF_WAIT',
                'FIRST_GRADUATE_COURSE_WAIT',
                'FIRST_GRADUATE_COLLEGE_WAIT',
                'FIRST_GRADUATE_PARENT_EDU_WAIT',
                'FIRST_GRADUATE_YOP_WAIT',
                'FIRST_GRADUATE_FAMILY_CHECK_GATE',
                'READY_TO_APPLY_FIRST_GRADUATE'
            ],
            preSubmit: { requireSmartCard: true, requirePhoto: true, requireDocKeys: ['applicantEducationProof'] },
            editModal: {
                layoutMode: 'FIRST_GRADUATE',
                title: '🎓 முதல் பட்டதாரி விண்ணப்ப விவரங்கள் (First Graduate Certificate - REV-104)',
                subtitle: 'முதல் பட்டதாரி விண்ணப்ப விவரங்கள் மற்றும் பதிவேற்றப்பட்ட ஆவணங்களைச் சரிபார்க்கவும்',
                submitButtonHtml: '<i class="fa-solid fa-play"></i> 🚀 முதல் பட்டதாரி விண்ணப்பிக்க (Start First Graduate Apply)',
                isRationHead: false,
                showGasToggle: false,
                showSmartCardBox: true,
                showResidenceBox: false,
                showUniversalDocs: true
            }
        },
        {
            id: 'TNEGA_OBC',
            portal: 'TNEGA',
            portalLabel: 'TNeGA',
            subService: 'OBC',
            code: 'REV-115',
            nameTam: 'OBC சான்றிதழ்',
            nameEng: 'OBC Certificate',
            runner: 'startTnegaObcFlow',
            aliases: [
                'TNEGA_OBC', 'TNEGA_OBC_CERTIFICATE', 'OBC', 'OBC_CERTIFICATE',
                'REV-115', 'REV_115', 'OBC சான்றிதழ்', 'இதர பிற்படுத்தப்பட்டோர் சான்றிதழ்'
            ],
            ownedStates: [
                'OBC_INTAKE',
                'OBC_CAN_GATE',
                'OBC_CAN_WAIT',
                'OBC_PHOTO_WAIT',
                'OBC_AADHAAR_WAIT',
                'OBC_AADHAAR_BACK_WAIT',
                'OBC_SMARTCARD_WAIT',
                'OBC_SMARTCARD_BACK_WAIT',
                'OBC_MOTHER_NAME_WAIT',
                'OBC_COMMUNITY_PROOF_WAIT',
                'OBC_INCOME_PROOF_WAIT',
                'OBC_OCCUPATION_WAIT',
                'OBC_FATHER_OCCUPATION_WAIT',
                'OBC_MOTHER_OCCUPATION_WAIT',
                'OBC_ANNUAL_INCOME_WAIT',
                'READY_TO_APPLY_OBC'
            ],
            preSubmit: { requireSmartCard: true, requirePhoto: true, requireDocKeys: ['communityCertificate', 'incomeTaxReturn'] },
            editModal: {
                layoutMode: 'OBC',
                title: '📜 OBC சான்றிதழ் விண்ணப்ப விவரங்கள் (Other Backward Classes - REV-115)',
                subtitle: 'OBC சான்றிதழ் விண்ணப்ப விவரங்கள் மற்றும் பதிவேற்றப்பட்ட ஆவணங்களைச் சரிபார்க்கவும்',
                submitButtonHtml: '<i class="fa-solid fa-play"></i> 🚀 OBC சான்றிதழ் விண்ணப்பிக்க (Start OBC Apply)',
                isRationHead: false,
                showGasToggle: false,
                showSmartCardBox: true,
                showResidenceBox: false,
                showUniversalDocs: true
            }
        },
        {
            id: 'TNEGA_LEGAL_HEIR',
            portal: 'TNEGA',
            portalLabel: 'TNeGA',
            subService: 'LEGAL_HEIR',
            code: 'REV-114',
            nameTam: 'வாரிசு சான்றிதழ்',
            nameEng: 'Legal Heir Certificate',
            runner: 'startTnegaLegalHeirFlow',
            aliases: [
                'TNEGA_LEGAL_HEIR', 'LEGAL_HEIR', 'LEGAL_HEIR_CERTIFICATE', 'LEGAL HEIR',
                'REV-114', 'REV_114', 'வாரிசு சான்றிதழ்', 'சட்ட வாரிசு சான்றிதழ்'
            ],
            ownedStates: [
                'LEGAL_HEIR_INTAKE',
                'LEGAL_HEIR_CAN_GATE',
                'LEGAL_HEIR_CAN_WAIT',
                'LEGAL_HEIR_AADHAAR_WAIT',
                'LEGAL_HEIR_AADHAAR_BACK_WAIT',
                'LEGAL_HEIR_SMARTCARD_WAIT',
                'LEGAL_HEIR_SMARTCARD_BACK_WAIT',
                'LEGAL_HEIR_DEATH_CERT_WAIT',
                'LEGAL_HEIR_DECEASED_ADDR_WAIT',
                'LEGAL_HEIR_BIRTH_TC_WAIT',
                'LEGAL_HEIR_HEIRS_WAIT',
                'READY_TO_APPLY_LEGAL_HEIR'
            ],
            preSubmit: { requireSmartCard: true, requirePhoto: false, requireDocKeys: ['deathCertificate', 'birthCertificate'] },
            editModal: {
                layoutMode: 'LEGAL_HEIR',
                title: '👨‍👩‍👧‍👦 சட்ட வாரிசு சான்றிதழ் விண்ணப்ப விவரங்கள் (Legal Heir Certificate - REV-114)',
                subtitle: 'இறந்தவர் விவரங்கள், வாரிசுதாரர்கள் மற்றும் 4 ஆவணங்களைச் சரிபார்க்கவும்',
                submitButtonHtml: '<i class="fa-solid fa-play"></i> 🚀 வாரிசு சான்றிதழ் விண்ணப்பிக்க (Start Legal Heir Apply)',
                isRationHead: false,
                showGasToggle: false,
                showSmartCardBox: true,
                showResidenceBox: false,
                showUniversalDocs: true
            }
        },
        {
            id: 'TNEGA_WIDOW',
            portal: 'TNEGA',
            portalLabel: 'TNeGA',
            subService: 'WIDOW',
            code: 'REV-109',
            nameTam: 'விதவைச் சான்றிதழ்',
            nameEng: 'Widow Certificate',
            runner: 'startTnegaWidowFlow',
            aliases: [
                'TNEGA_WIDOW', 'TNEGA_WIDOW_CERTIFICATE', 'WIDOW', 'WIDOW_CERTIFICATE',
                'REV-109', 'REV_109', 'விதவைச் சான்றிதழ்', 'விதவை சான்றிதழ்'
            ],
            ownedStates: [
                'WIDOW_INTAKE',
                'WIDOW_CAN_GATE',
                'WIDOW_CAN_WAIT',
                'WIDOW_PHOTO_WAIT',
                'WIDOW_AADHAAR_WAIT',
                'WIDOW_AADHAAR_BACK_WAIT',
                'WIDOW_SMARTCARD_WAIT',
                'WIDOW_SMARTCARD_BACK_WAIT',
                'WIDOW_DEATH_CERT_WAIT',
                'WIDOW_MARRIAGE_PROOF_WAIT',
                'WIDOW_MARRIAGE_DATE_WAIT',
                'READY_TO_APPLY_WIDOW'
            ],
            preSubmit: { requireSmartCard: true, requirePhoto: true, requireDocKeys: ['deathCertificate'] },
            editModal: {
                layoutMode: 'WIDOW',
                title: '🕊️ விதவைச் சான்றிதழ் விண்ணப்ப விவரங்கள் (Widow Certificate - REV-109)',
                subtitle: 'கணவர் விவரங்கள், இறப்புச் சான்றிதழ் & 4 கட்டாய ஆவணங்களைச் சரிபார்க்கவும்',
                submitButtonHtml: '<i class="fa-solid fa-play"></i> 🚀 விதவைச் சான்றிதழ் விண்ணப்பிக்க (Start Widow Apply)',
                isRationHead: false,
                showGasToggle: false,
                showSmartCardBox: true,
                showResidenceBox: false,
                showUniversalDocs: true
            }
        }
    ];

    const PLUGIN_BY_ID = new Map();
    const PLUGIN_BY_ALIAS = new Map();
    const PLUGIN_BY_STATE = new Map();

    for (const plugin of SERVICE_PLUGINS) {
        PLUGIN_BY_ID.set(plugin.id, plugin);
        PLUGIN_BY_ALIAS.set(plugin.id.toUpperCase(), plugin);
        if (plugin.subService) PLUGIN_BY_ALIAS.set(plugin.subService.toUpperCase(), plugin);
        if (plugin.code) PLUGIN_BY_ALIAS.set(plugin.code.toUpperCase(), plugin);
        if (Array.isArray(plugin.aliases)) {
            for (const a of plugin.aliases) {
                PLUGIN_BY_ALIAS.set(String(a).trim().toUpperCase(), plugin);
            }
        }
        if (Array.isArray(plugin.ownedStates)) {
            for (const st of plugin.ownedStates) {
                const up = String(st).trim().toUpperCase();
                if (PLUGIN_BY_STATE.has(up)) {
                    throw new Error(`Service Plugin Collision: state "${up}" is claimed by both ${PLUGIN_BY_STATE.get(up).id} and ${plugin.id}`);
                }
                PLUGIN_BY_STATE.set(up, plugin);
            }
        }
    }

    function getPluginById(id) {
        if (!id) return null;
        return PLUGIN_BY_ID.get(String(id).trim().toUpperCase()) || null;
    }

    function getPluginByAlias(raw) {
        if (!raw) return null;
        const up = String(raw).trim().toUpperCase();
        if (PLUGIN_BY_ALIAS.has(up)) return PLUGIN_BY_ALIAS.get(up);
        // Strip leading numbering like "1. புதிய குடும்ப அட்டை"
        const noNum = up.replace(/^\d+\.\s*/, '').trim();
        if (PLUGIN_BY_ALIAS.has(noNum)) return PLUGIN_BY_ALIAS.get(noNum);
        return null;
    }

    function getPluginByState(intakeState) {
        if (!intakeState) return null;
        const up = String(intakeState).trim().toUpperCase();
        if (PLUGIN_BY_STATE.has(up)) return PLUGIN_BY_STATE.get(up);
        // Prefix guard ONLY for explicit RATION_ namespaces
        if (up.startsWith('RATION_ADD_MEMBER')) return PLUGIN_BY_ID.get('TNPDS_ADD_MEMBER');
        if (up.startsWith('RATION_REMOVE_MEMBER')) return PLUGIN_BY_ID.get('TNPDS_REMOVE_MEMBER');
        if (up.startsWith('RATION_CHANGE_ADDRESS')) return PLUGIN_BY_ID.get('TNPDS_CHANGE_ADDRESS');
        if (up.startsWith('RATION_CHANGE_MOBILE')) return PLUGIN_BY_ID.get('TNPDS_UPDATE_MOBILE');
        if (up.startsWith('RATION_CHANGE_HEAD')) return PLUGIN_BY_ID.get('TNPDS_CHANGE_HEAD');
        return null;
    }

    /**
     * Authoritative Plugin Resolution without cross-service guesswork.
     * Priority:
     *   1. Explicit subService (or profile.subService) -> exact alias lookup
     *   2. Explicit pluginId (if subService is unset or agrees)
     *   3. Exact intakeState ownership (1-to-1 Map; RESIDENCE_PROOF_DOC -> TNPDS_NEW_CARD)
     *   4. Explicit targetService / serviceId / service (ONLY when 1-3 are unset)
     */
    function resolveServicePlugin(input = {}, extra = {}) {
        const src = input || {};
        const prof = src.citizenProfile || {};
        const rawIntake = String(src.intakeState || prof.intakeState || src.step || '').trim().toUpperCase();
        if (MENU_ONLY_STATES.has(rawIntake) && !src.subService && !prof.subService && !src.pluginId) {
            return null;
        }

        const rawSub = src.subService || prof.subService || '';
        const bySub = getPluginByAlias(rawSub);
        if (bySub) return bySub;

        const byId = getPluginById(src.pluginId || prof.pluginId);
        if (byId) return byId;

        const byState = getPluginByState(rawIntake);
        if (byState) return byState;

        const hintCandidates = [
            extra.overrideHint,
            src.targetService,
            prof.targetService,
            src.serviceId,
            prof.serviceId,
            src.service,
            prof.service,
            src.serviceName,
            extra.localActiveSvc
        ];
        for (const h of hintCandidates) {
            const found = getPluginByAlias(h);
            if (found) return found;
        }

        // Default fallback ONLY if Ration Card fields are present without certificate service
        if (src.subServiceData?.memberName || prof.subServiceData?.memberName) {
            return src.subServiceData?.reason ? PLUGIN_BY_ID.get('TNPDS_REMOVE_MEMBER') : PLUGIN_BY_ID.get('TNPDS_ADD_MEMBER');
        }
        return null;
    }

    function listPluginsByPortal(portal) {
        const up = String(portal || '').toUpperCase();
        return SERVICE_PLUGINS.filter(p => p.portal === up);
    }

    return {
        SERVICE_PLUGINS,
        PLUGIN_BY_ID,
        PLUGIN_BY_ALIAS,
        PLUGIN_BY_STATE,
        MENU_ONLY_STATES,
        getPluginById,
        getPluginByAlias,
        getPluginByState,
        resolveServicePlugin,
        listPluginsByPortal
    };
}));
