// =============================================================================
// UI Cartridge: TNEGA_CAN_REGISTER (புதிய CAN பதிவு)
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
        id: 'TNEGA_CAN_REGISTER',
        ownedDocTypes: ['profilePhoto', 'headPhoto', 'headAadhaar', 'smartCard', 'rationCard', 'applicationPdf'],
        editModal: {
            layoutMode: 'CAN',
            title: '📝 புதிய CAN பதிவு விவரங்கள் (New CAN Registration)',
            subtitle: 'CAN பதிவிற்கான விவரங்கள் மற்றும் பதிவேற்றப்பட்ட ஆவணங்களைச் சரிபார்க்கவும்',
            submitButtonHtml: '<i class="fa-solid fa-play"></i> 🚀 புதிய CAN பதிவு தொடங்க (Start CAN Automation)',
            isRationHead: false,
            showMasterButton: true,
            showGasToggle: false,
            customWrapMode: 'newCard',
            docBoxes: {
                photo: true,
                headAadhaar: true,
                residence: false,
                smartCard: false,
                universalDocs: false,
                membersAadhaar: false
            },
            fieldWraps: {
                community: true,
                income: false,
                residence: false,
                firstGraduate: false,
                obc: false,
                legalHeir: false,
                widow: false,
                ration: false,
                smartCardNo: false,
                canNo: false
            },
            dynamicDocs: []
        },
        populateEditFields: function (data, { safeSetVal }) {
            safeSetVal('editReligion', data.religion || 'Hindu');
            safeSetVal('editCommunity', data.community || 'MBC');
            safeSetVal('editCaste', data.caste || '');
        },
        collectEditFields: function () {
            const religion = document.getElementById('editReligion')?.value || 'Hindu';
            const community = document.getElementById('editCommunity')?.value || 'MBC';
            const caste = document.getElementById('editCaste')?.value?.trim() || '';
            return {
                subService: 'CAN_REGISTER',
                subServiceData: { religion, community, caste },
                fields: { religion, community, caste }
            };
        },
        sidebar: {
            headTitle: '👤 வாடிக்கையாளர் விவரங்கள் (CAN பதிவு)',
            boxId: null
        },
        validatePreSubmit: function () {
            return { valid: true };
        }
    };
}));
