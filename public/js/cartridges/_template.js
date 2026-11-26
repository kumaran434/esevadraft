// =============================================================================
// Golden UI Cartridge Template (Dynamic Render Mode — Zero index.html Bloat!)
// Copy & register in service_plugins.js for Services #15..#50+.
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
        id: 'TEMPLATE_SERVICE',
        ownedDocTypes: ['profilePhoto', 'headPhoto', 'headAadhaar', 'smartCard', 'rationCard', 'applicationPdf'],
        editModal: {
            layoutMode: 'TEMPLATE_SERVICE',
            title: '📄 புதிய சேவை விவரங்கள்',
            subtitle: 'விவரங்களைச் சரிபார்க்கவும்',
            submitButtonHtml: '<i class="fa-solid fa-play"></i> விண்ணப்பிக்கத் தொடங்கு',
            isRationHead: false,
            showMasterButton: false,
            showGasToggle: false,
            docBoxes: { photo: true, headAadhaar: true, residence: false, smartCard: true, universalDocs: true, membersAadhaar: false },
            fieldWraps: {},
            dynamicDocs: []
        },
        renderDynamicEditFields: function (containerEl, data, { safeSetVal }) {
            containerEl.innerHTML = `<div style="grid-column:span 2;font-size:12px;color:#334155;">Custom Cartridge fields render dynamically here without touching index.html!</div>`;
        },
        collectEditFields: function () {
            return { subService: 'TEMPLATE_SERVICE', subServiceData: {}, fields: {} };
        },
        renderDynamicSidebar: function (boxEl, a) {
            boxEl.innerHTML = `<h4>📄 சேவை விவரங்கள்</h4><div class="card-row">CAN: <strong>${a.canNumber || '—'}</strong></div>`;
            return true;
        },
        validatePreSubmit: function () {
            return { valid: true };
        }
    };
}));
