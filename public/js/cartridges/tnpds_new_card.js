// =============================================================================
// UI Cartridge: TNPDS_NEW_CARD (புதிய ஸ்மார்ட் ரேஷன் கார்டு)
// Completely isolated Edit Modal config, field mapping & Pre-Submit validation.
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
        id: 'TNPDS_NEW_CARD',
        ownedDocTypes: ['profilePhoto', 'headPhoto', 'headAadhaar', 'memberAadhaar', 'birthCertificate', 'gasBook', 'residenceProof', 'applicationPdf'],
        editModal: {
            layoutMode: 'NEW_CARD',
            title: '✏️ புதிய குடும்ப அட்டை விண்ணப்ப விவரங்கள் (New Ration Card)',
            subtitle: 'அனைத்து விவரங்களையும் சரிபார்த்து திருத்தவும்',
            submitButtonHtml: '<i class="fa-solid fa-play"></i> 🚀 அரசு போர்ட்டலில் சமர்ப்பி (Submit Application)',
            isRationHead: true,
            showMasterButton: false,
            showGasToggle: true,
            customWrapMode: 'newCard',
            docBoxes: {
                photo: true,
                headAadhaar: true,
                residence: true,
                smartCard: false,
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
                smartCardNo: false,
                canNo: false
            },
            dynamicDocs: []
        },
        populateEditFields: function () {},
        collectEditFields: function () {
            return { subService: 'NEW_CARD', subServiceData: {}, fields: {} };
        },
        sidebar: {
            headTitle: '👤 1. குடும்பத் தலைவர்',
            boxId: null,
            isNewRationCard: true,
            showMembersContainer: true
        },
        validatePreSubmit: function () {
            // New Ration Card handles residence proof/head/gas verification via ration flow; never demands an existing Smart Card
            return { valid: true };
        }
    };
}));
