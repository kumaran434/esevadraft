// =============================================================================
// UI Cartridge: TNEGA_RESIDENCE (இருப்பிடச் சான்றிதழ் - REV-102)
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
        id: 'TNEGA_RESIDENCE',
        ownedDocTypes: ['profilePhoto', 'headPhoto', 'headAadhaar', 'smartCard', 'rationCard', 'residenceProof', 'nativityProof', 'applicationPdf'],
        editModal: {
            layoutMode: 'RESIDENCE',
            title: '🏠 இருப்பிடச் சான்றிதழ் விண்ணப்ப விவரங்கள் (Residence Certificate)',
            subtitle: 'இருப்பிடச் சான்றிதழ் விண்ணப்ப விவரங்கள் மற்றும் பதிவேற்றப்பட்ட ஆவணங்களைச் சரிபார்க்கவும்',
            submitButtonHtml: '<i class="fa-solid fa-play"></i> 🚀 இருப்பிடச் சான்றிதழ் விண்ணப்பிக்க (Start Residence Apply)',
            isRationHead: false,
            showMasterButton: false,
            showGasToggle: false,
            customWrapMode: 'newCard',
            docBoxes: {
                photo: true,
                headAadhaar: true,
                residence: true,
                smartCard: true,
                universalDocs: false,
                membersAadhaar: false
            },
            fieldWraps: {
                community: false,
                income: false,
                residence: true,
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
        populateEditFields: function (data, { safeSetVal }) {
            safeSetVal('editResidenceYears', data.residenceYears || '10');
            safeSetVal('editResidencePurpose', data.residencePurpose || 'கல்வி / வேலைவாய்ப்பு');
        },
        collectEditFields: function ({ data, sData }) {
            const residenceYears = document.getElementById('editResidenceYears')?.value?.trim() || data?.residenceYears || '';
            const residencePurpose = document.getElementById('editResidencePurpose')?.value?.trim() || data?.residencePurpose || '';
            const canNumber = document.getElementById('editCanNumber')?.value?.replace(/\s+/g, '') || data?.canNumber || '';
            return {
                subService: 'RESIDENCE',
                subServiceData: {
                    ...(sData || {}),
                    residenceYears,
                    residencePurpose,
                    canNumber
                },
                fields: { residenceYears, residencePurpose }
            };
        },
        sidebar: {
            headTitle: '👤 விண்ணப்பதாரர் விவரங்கள் (இருப்பிடம்)',
            boxId: 'sidebarResidenceBox'
        },
        populateSidebar: function (a, subData, { setVal }) {
            setVal('infoResidenceCanNo', a.canNumber || '—');
            setVal('infoResidenceYears', a.yearsOfResidence || '—');
            setVal('infoResidencePurpose', a.purposeOfCertificate || '—');
            return true;
        },
        validatePreSubmit: function (data, docs, { hasPhoto, hasSmartCard }) {
            if (!hasSmartCard) {
                return {
                    valid: false,
                    errorMessage: '⚠️ அனைத்து வருவாய்த் துறை சேவைகளுக்கும் குடும்ப ஸ்மார்ட் ரேஷன் கார்டு (Smart Card) கட்டாயம் தேவை.\n\nதயவுசெய்து ரேஷன் கார்டு (முழு அட்டை OR முன்பக்கம்+பின்பக்கம்) பதிவேற்றிய பிறகு விண்ணப்பிக்கவும்.'
                };
            }
            if (!hasPhoto) {
                return {
                    valid: false,
                    errorMessage: '⚠️ இருப்பிடச் சான்றிதழ் (REV-102) விண்ணப்பிக்க விண்ணப்பதாரரின் பாஸ்போர்ட் புகைப்படம் கட்டாயம் தேவை.\n\nதயவுசெய்து புகைப்படத்தைப் பதிவேற்றவும்.'
                };
            }
            const b64 = data?.base64Docs || {};
            const hasRes = Boolean(
                data?.residenceProof?.docPath || data?.residenceProof ||
                docs?.residenceProof || docs?.gasBook ||
                b64.residenceProofBase64 || b64.gasBookBase64
            );
            if (!hasRes) {
                return {
                    valid: false,
                    errorMessage: '⚠️ இருப்பிடச் சான்றிதழ் (REV-102) விண்ணப்பிக்க இருப்பிட ஆதாரம் (மின் கட்டணம்/கேஸ்/வரி ரசீது) கட்டாயம் தேவை.\n\nதயவுசெய்து ஆவணங்களைப் பதிவேற்றிய பிறகு விண்ணப்பிக்கவும்.'
                };
            }
            return { valid: true };
        }
    };
}));
