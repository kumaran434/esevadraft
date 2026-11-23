// =============================================================================
// UI Cartridge: TNEGA_CAN_SEARCH (CAN எண் தேடல்)
// =============================================================================
(function (root, factory) {
    const mod = factory();
    if (typeof module === 'object' && module.exports) module.exports = mod;
    else {
        root.ESEVA_UI_CARTRIDGES = root.ESEVA_UI_CARTRIDGES || {};
        root.ESEVA_UI_CARTRIDGES[mod.id] = mod;
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    return {
        id: 'TNEGA_CAN_SEARCH',
        ownedDocTypes: ['profilePhoto', 'headPhoto', 'headAadhaar', 'smartCard', 'rationCard', 'applicationPdf'],
        editModal: {
            layoutMode: 'CAN',
            title: '🔍 CAN எண் தேடல் விவரங்கள் (CAN Number Search)',
            subtitle: 'CAN பதிவிற்கான விவரங்கள் மற்றும் பதிவேற்றப்பட்ட ஆவணங்களைச் சரிபார்க்கவும்',
            submitButtonHtml: '<i class="fa-solid fa-magnifying-glass"></i> 🔍 CAN எண் தேடலைத் தொடங்கு',
            isRationHead: false,
            showMasterButton: true,
            showGasToggle: false,
            customWrapMode: 'newCard',
            docBoxes: {
                photo: false,
                headAadhaar: true,
                residence: false,
                smartCard: false,
                universalDocs: false,
                membersAadhaar: false
            },
            fieldWraps: {
                community: false,
                income: false,
                residence: false,
                firstGraduate: false,
                obc: false,
                legalHeir: false,
                widow: false,
                ration: false,
                smartCardNo: false,
                canNo: true
            },
            dynamicDocs: []
        },
        populateEditFields: function () {},
        collectEditFields: function () {
            return { subService: 'CAN_SEARCH', subServiceData: {}, fields: {} };
        },
        sidebar: {
            headTitle: '👤 வாடிக்கையாளர் விவரங்கள் (CAN தேடல்)',
            boxId: null
        },
        validatePreSubmit: function () {
            return { valid: true };
        }
    };
}));
