// =============================================================================
// UI Cartridge: TNPDS_CHANGE_HEAD (குடும்பத் தலைவர் மாற்றம்)
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
        id: 'TNPDS_CHANGE_HEAD',
        ownedDocTypes: ['smartCard', 'rationCard', 'changeHeadProof', 'deathCertificate', 'consentLetter', 'applicationPdf'],
        editModal: {
            layoutMode: 'NEW_CARD',
            title: '👑 குடும்பத் தலைவர் மாற்ற விண்ணப்பம் (Family Head Change)',
            subtitle: 'புதிய தலைவர் பெயர் & தொடர்புடைய ஆவணங்களைச் சரிபார்க்கவும்',
            submitButtonHtml: '<i class="fa-solid fa-play"></i> 🚀 அரசு போர்ட்டலில் சமர்ப்பி (Submit Application)',
            isRationHead: true,
            showMasterButton: false,
            showGasToggle: false,
            customWrapMode: 'newCard',
            docBoxes: {
                photo: true,
                headAadhaar: true,
                residence: false,
                smartCard: true,
                universalDocs: false,
                membersAadhaar: true
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
            return { subService: 'CHANGE_HEAD', subServiceData: {}, fields: {} };
        },
        sidebar: {
            headTitle: '👤 குடும்பத் தலைவர் / அட்டை விவரங்கள்',
            boxId: null
        },
        validatePreSubmit: function () {
            return { valid: true };
        }
    };
}));
