// =============================================================================
// UI Cartridge: TNEGA_LEGAL_HEIR (வாரிசு சான்றிதழ் - REV-114)
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
        id: 'TNEGA_LEGAL_HEIR',
        ownedDocTypes: ['profilePhoto', 'headPhoto', 'headAadhaar', 'smartCard', 'rationCard', 'deathCertificate', 'legalHeirProof', 'applicationPdf'],
        editModal: {
            layoutMode: 'LEGAL_HEIR',
            title: '👨‍👩‍👧‍👦 சட்ட வாரிசு சான்றிதழ் விண்ணப்ப விவரங்கள் (Legal Heir Certificate - REV-114)',
            subtitle: 'இறந்தவர் விவரங்கள், வாரிசுதாரர்கள் மற்றும் 4 ஆவணங்களைச் சரிபார்க்கவும்',
            submitButtonHtml: '<i class="fa-solid fa-play"></i> 🚀 வாரிசு சான்றிதழ் விண்ணப்பிக்க (Start Legal Heir Apply)',
            isRationHead: false,
            showMasterButton: true,
            showGasToggle: false,
            customWrapMode: 'newCard',
            docBoxes: {
                photo: false,
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
                legalHeir: true,
                widow: false,
                ration: false,
                smartCardNo: false,
                canNo: true
            },
            dynamicDocs: [
                {
                    type: 'deathCertificate',
                    title: '📜 இறப்புச் சான்றிதழ் (Death Certificate of Deceased)',
                    titleEng: 'Death Certificate',
                    icon: 'fa-file-medical',
                    defaultPrompt: 'இறப்புச் சான்றிதழ் தேவை'
                },
                {
                    type: 'deceasedAddressProof',
                    title: '🏠 இறந்தவரின் முகவரிச் சான்று (Deceased Address Proof)',
                    titleEng: 'Address Proof of Deceased',
                    icon: 'fa-house-user',
                    defaultPrompt: 'இறந்தவர் முகவரிச் சான்று தேவை'
                },
                {
                    type: 'birthCertificate',
                    title: '🎓 வாரிசுகளின் பிறப்புச் சான்றிதழ் / பள்ளி TC',
                    titleEng: 'Birth Certificate / Transfer Certificate',
                    icon: 'fa-graduation-cap',
                    defaultPrompt: 'பிறப்புச் சான்றிதழ் அல்லது பள்ளி TC தேவை'
                }
            ]
        },
        populateEditFields: function (data, { safeSetVal }) {
            safeSetVal('editLhDeceasedNameEng', data.deceasedNameEng || data.fatherNameEng || '');
            safeSetVal('editLhDeceasedNameTam', data.deceasedNameTam || data.fatherNameTam || '');
            safeSetVal('editLhDateOfDeath', data.dateOfDeath || '');
            safeSetVal('editLhPlaceOfDeath', data.placeOfDeath || data.taluk || '');
            safeSetVal('editLhDeathCertNo', data.deathCertificateNo || '');
            const parentsPair = (data.deceasedFatherNameEng || data.deceasedMotherNameEng)
                ? `${data.deceasedFatherNameEng || 'Ramasamy'} / ${data.deceasedMotherNameEng || 'Lakshmi'}`
                : '';
            safeSetVal('editLhDeceasedParents', parentsPair);
        },
        collectEditFields: function ({ data, sData }) {
            const deceasedNameEng = document.getElementById('editLhDeceasedNameEng')?.value?.trim() || data?.deceasedNameEng || '';
            const deceasedNameTam = document.getElementById('editLhDeceasedNameTam')?.value?.trim() || data?.deceasedNameTam || deceasedNameEng;
            const dateOfDeath = document.getElementById('editLhDateOfDeath')?.value?.trim() || data?.dateOfDeath || '';
            const placeOfDeath = document.getElementById('editLhPlaceOfDeath')?.value?.trim() || data?.placeOfDeath || '';
            const deathCertificateNo = document.getElementById('editLhDeathCertNo')?.value?.trim() || data?.deathCertificateNo || '';
            const lhParentsRaw = document.getElementById('editLhDeceasedParents')?.value?.trim() || '';
            const lhParentsSplit = lhParentsRaw.split('/').map(s => s.trim()).filter(Boolean);
            const deceasedFatherNameEng = lhParentsSplit[0] || data?.deceasedFatherNameEng || 'Ramasamy';
            const deceasedMotherNameEng = lhParentsSplit[1] || data?.deceasedMotherNameEng || 'Lakshmi';
            const canNumber = document.getElementById('editCanNumber')?.value?.replace(/\s+/g, '') || data?.canNumber || '';
            return {
                subService: 'LEGAL_HEIR',
                subServiceData: {
                    ...(sData || {}),
                    deceasedNameEng,
                    deceasedNameTam,
                    dateOfDeath,
                    placeOfDeath,
                    deathCertificateNo,
                    deceasedFatherNameEng,
                    deceasedMotherNameEng,
                    canNumber
                },
                fields: {
                    deceasedNameEng,
                    deceasedNameTam,
                    dateOfDeath,
                    placeOfDeath,
                    deathCertificateNo,
                    deceasedFatherNameEng,
                    deceasedMotherNameEng
                }
            };
        },
        sidebar: {
            headTitle: '👤 விண்ணப்பதாரர் விவரங்கள் (வாரிசு சான்றிதழ்)',
            boxId: null
        },
        validatePreSubmit: function (data, docs, { hasSmartCard }) {
            if (!hasSmartCard) {
                return {
                    valid: false,
                    errorMessage: '⚠️ அனைத்து வருவாய்த் துறை சேவைகளுக்கும் குடும்ப ஸ்மார்ட் ரேஷன் கார்டு (Smart Card) கட்டாயம் தேவை.\n\nதயவுசெய்து ரேஷன் கார்டு (முழு அட்டை OR முன்பக்கம்+பின்பக்கம்) பதிவேற்றிய பிறகு விண்ணப்பிக்கவும்.'
                };
            }
            const hasDeathCert = Boolean(data?.deathCertificate?.docPath || data?.deathCertificate || docs?.deathCertificate);
            if (!hasDeathCert) {
                return {
                    valid: false,
                    errorMessage: '⚠️ வாரிசு சான்றிதழ் (REV-114) விண்ணப்பிக்க இறப்புச் சான்றிதழ் (Death Certificate <200KB) கட்டாயம் தேவை.\n\nதயவுசெய்து ஆவணத்தைப் பதிவேற்றிய பிறகு விண்ணப்பிக்கவும்.'
                };
            }
            const hasBirthOrTc = Boolean(data?.birthCertificate?.docPath || data?.birthCertificate || docs?.birthCertificate || data?.studentTc || docs?.studentTc);
            if (!hasBirthOrTc) {
                return {
                    valid: false,
                    errorMessage: '⚠️ வாரிசு சான்றிதழ் (REV-114) விண்ணப்பிக்க வாரிசுகளின் பிறப்புச் சான்றிதழ் அல்லது பள்ளி TC கட்டாயம் தேவை.\n\nதயவுசெய்து ஆவணத்தைப் பதிவேற்றிய பிறகு விண்ணப்பிக்கவும்.'
                };
            }
            return { valid: true };
        }
    };
}));
