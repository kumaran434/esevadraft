// =============================================================================
// UI Cartridge: TNPDS_UPDATE_MOBILE (கைபேசி எண் மாற்றம்)
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
        id: 'TNPDS_UPDATE_MOBILE',
        ownedDocTypes: ['smartCard', 'rationCard', 'headAadhaar', 'applicationPdf'],
        editModal: {
            layoutMode: 'NEW_CARD',
            title: '📱 கைபேசி எண் மாற்ற விண்ணப்பம் (Update Mobile Number)',
            subtitle: 'புதிய கைபேசி எண் & குடும்ப அட்டை விவரங்களைச் சரிபார்க்கவும்',
            submitButtonHtml: '<i class="fa-solid fa-play"></i> 🚀 அரசு போர்ட்டலில் சமர்ப்பி (Submit Application)',
            isRationHead: true,
            showMasterButton: false,
            showGasToggle: false,
            customWrapMode: 'newCard',
            docBoxes: {
                photo: false,
                headAadhaar: true,
                residence: false,
                smartCard: true,
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
                ration: true,
                smartCardNo: true,
                canNo: false
            },
            dynamicDocs: []
        },
        populateEditFields: function () {},
        collectEditFields: function () {
            return { subService: 'UPDATE_MOBILE', subServiceData: {}, fields: {} };
        },
        sidebar: {
            headTitle: '👤 வாடிக்கையாளர் விவரங்கள்',
            boxId: null
        },
        validatePreSubmit: function () {
            return { valid: true };
        }
    };
}));
