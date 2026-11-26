// =============================================================================
// UI Cartridge: TNEGA_WIDOW (விதவைச் சான்றிதழ் - REV-109)
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
        id: 'TNEGA_WIDOW',
        ownedDocTypes: ['profilePhoto', 'headPhoto', 'headAadhaar', 'smartCard', 'rationCard', 'deathCertificate', 'widowMarriageProof', 'applicationPdf'],
        editModal: {
            layoutMode: 'WIDOW',
            title: '🕊️ விதவைச் சான்றிதழ் விண்ணப்ப விவரங்கள் (Widow Certificate - REV-109)',
            subtitle: 'கணவர் விவரங்கள், இறப்புச் சான்றிதழ் & 4 கட்டாய ஆவணங்களைச் சரிபார்க்கவும்',
            submitButtonHtml: '<i class="fa-solid fa-play"></i> 🚀 விதவைச் சான்றிதழ் விண்ணப்பிக்க (Start Widow Apply)',
            isRationHead: false,
            showMasterButton: false,
            showGasToggle: false,
            customWrapMode: 'newCard',
            docBoxes: {
                photo: true,
                headAadhaar: true,
                residence: false,
                smartCard: true,
                universalDocs: true,
                membersAadhaar: false
            },
            fieldWraps: {
                community: false,
                income: false,
                residence: false,
                firstGraduate: false,
                obc: false,
                legalHeir: false,
                widow: true,
                ration: false,
                smartCardNo: false,
                canNo: true
            },
            dynamicDocs: [
                {
                    type: 'deathCertificate',
                    title: '📜 கணவரின் இறப்புச் சான்றிதழ் (Death Certificate of Husband)',
                    titleEng: 'Death Certificate of Husband',
                    icon: 'fa-file-medical',
                    defaultPrompt: 'கணவரின் இறப்புச் சான்றிதழ் தேவை'
                },
                {
                    type: 'marriageProof',
                    title: '💍 திருமண ஆதாரம் (Marriage Proof / Smart Card)',
                    titleEng: 'Marriage Registration Certificate / Proof',
                    icon: 'fa-ring',
                    defaultPrompt: 'திருமணச் சான்றிதழ் அல்லது ஸ்மார்ட் கார்டு தேவை'
                }
            ]
        },
        populateEditFields: function (data, { safeSetVal }) {
            safeSetVal('editWidowSpouseNameEng', data.spouseNameEng || data.husbandNameEng || data.fatherNameEng || '');
            safeSetVal('editWidowSpouseNameTam', data.spouseNameTam || data.husbandNameTam || data.fatherNameTam || '');
            safeSetVal('editWidowDateOfDeath', data.dateOfDeath || '');
            safeSetVal('editWidowDeathCertNo', data.deathCertificateNo || '');
            safeSetVal('editWidowDateOfMarriage', data.dateOfMarriage || '');
        },
        collectEditFields: function ({ data, sData }) {
            const spouseNameEng = document.getElementById('editWidowSpouseNameEng')?.value?.trim() || data?.spouseNameEng || '';
            const spouseNameTam = document.getElementById('editWidowSpouseNameTam')?.value?.trim() || data?.spouseNameTam || spouseNameEng;
            const dateOfDeath = document.getElementById('editWidowDateOfDeath')?.value?.trim() || data?.dateOfDeath || '';
            const deathCertificateNo = document.getElementById('editWidowDeathCertNo')?.value?.trim() || data?.deathCertificateNo || '';
            const dateOfMarriage = document.getElementById('editWidowDateOfMarriage')?.value?.trim() || data?.dateOfMarriage || '';
            const canNumber = document.getElementById('editCanNumber')?.value?.replace(/\s+/g, '') || data?.canNumber || '';
            return {
                subService: 'WIDOW',
                subServiceData: {
                    ...(sData || {}),
                    spouseNameEng,
                    spouseNameTam,
                    dateOfDeath,
                    deathCertificateNo,
                    dateOfMarriage,
                    canNumber
                },
                fields: {
                    spouseNameEng,
                    spouseNameTam,
                    dateOfDeath,
                    deathCertificateNo,
                    dateOfMarriage
                }
            };
        },
        sidebar: {
            headTitle: '👤 விண்ணப்பதாரர் விவரங்கள் (விதவைச் சான்றிதழ்)',
            boxId: 'sidebarWidowBox'
        },
        populateSidebar: function (a, subData, { setVal }) {
            setVal('infoWidowCanNo', a.canNumber || '—');
            setVal('infoWidowSpouse', a.spouseNameTam || a.spouseNameEng || a.husbandNameTam || a.husbandNameEng || '—');
            setVal('infoWidowDod', a.dateOfDeath || '—');
            setVal('infoWidowDcNo', a.deathCertificateNo || '—');
            setVal('infoWidowMarDate', a.dateOfMarriage || '—');
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
                    errorMessage: '⚠️ விதவைச் சான்றிதழ் (REV-109) விண்ணப்பிக்க விண்ணப்பதாரரின் பாஸ்போர்ட் புகைப்படம் (<50KB) கட்டாயம் தேவை.\n\nதயவுசெய்து புகைப்படத்தைப் பதிவேற்றவும்.'
                };
            }
            const hasDeathCert = Boolean(data?.deathCertificate?.docPath || data?.deathCertificate || docs?.deathCertificate);
            if (!hasDeathCert) {
                return {
                    valid: false,
                    errorMessage: '⚠️ விதவைச் சான்றிதழ் (REV-109) விண்ணப்பிக்க கணவரின் இறப்புச் சான்றிதழ் (Death Certificate <200KB) கட்டாயம் தேவை.\n\nதயவுசெய்து ஆவணத்தைப் பதிவேற்றிய பிறகு விண்ணப்பிக்கவும்.'
                };
            }
            return { valid: true };
        }
    };
}));
