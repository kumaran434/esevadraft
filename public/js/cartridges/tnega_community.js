// =============================================================================
// UI Cartridge: TNEGA_COMMUNITY (சாதிச் சான்றிதழ் - REV-101)
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
        id: 'TNEGA_COMMUNITY',
        ownedDocTypes: ['profilePhoto', 'headPhoto', 'headAadhaar', 'smartCard', 'rationCard', 'communityProof', 'communityCertificate', 'familyCommunityProof', 'applicationPdf'],
        editModal: {
            layoutMode: 'COMMUNITY',
            title: '📜 சாதிச் சான்றிதழ் விண்ணப்ப விவரங்கள் (Community Certificate)',
            subtitle: 'சாதிச் சான்றிதழ் விண்ணப்ப விவரங்கள் மற்றும் பதிவேற்றப்பட்ட ஆவணங்களைச் சரிபார்க்கவும்',
            submitButtonHtml: '<i class="fa-solid fa-play"></i> 🚀 சாதிச் சான்றிதழ் விண்ணப்பிக்க (Start Community Apply)',
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
                community: true,
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
            dynamicDocs: [
                {
                    type: 'communityProof',
                    title: '📜 குடும்ப சாதிச் சான்றிதழ் (தந்தை/தாய்/TC)',
                    titleEng: 'Family Community Certificate / TC',
                    icon: 'fa-certificate',
                    defaultPrompt: 'சாதிச் சான்றிதழ் அல்லது பள்ளி TC தேவை'
                }
            ]
        },
        populateEditFields: function (data, { safeSetVal }) {
            safeSetVal('editReligion', data.religion || 'Hindu');
            safeSetVal('editCommunity', data.community || 'MBC');
            safeSetVal('editCaste', data.caste || '');
            safeSetVal('editFatherCaste', data.fatherCaste || data.caste || '');
            safeSetVal('editMotherCaste', data.motherCaste || data.caste || '');
        },
        collectEditFields: function ({ data, sData }) {
            const community = document.getElementById('editCommunity')?.value || data?.community || 'MBC';
            const caste = document.getElementById('editCaste')?.value?.trim() || data?.caste || '';
            const fatherCaste = document.getElementById('editFatherCaste')?.value?.trim() || data?.fatherCaste || caste;
            const motherCaste = document.getElementById('editMotherCaste')?.value?.trim() || data?.motherCaste || caste;
            const religion = document.getElementById('editReligion')?.value || data?.religion || 'Hindu';
            const canNumber = document.getElementById('editCanNumber')?.value?.replace(/\s+/g, '') || data?.canNumber || '';
            return {
                subService: 'COMMUNITY',
                subServiceData: {
                    ...(sData || {}),
                    community,
                    caste,
                    fatherCaste,
                    motherCaste,
                    religion,
                    canNumber
                },
                fields: { community, caste, fatherCaste, motherCaste, religion }
            };
        },
        sidebar: {
            headTitle: '👤 விண்ணப்பதாரர் விவரங்கள் (சாதிச் சான்றிதழ்)',
            boxId: 'sidebarCommunityBox'
        },
        populateSidebar: function (a, subData, { setVal }) {
            setVal('infoCommunityCanNo', a.canNumber || '—');
            setVal('infoCommunityMother', a.motherNameTam || a.motherNameEng || a.motherName || '—');
            setVal('infoCommunityReligion', a.religion || '—');
            setVal('infoCommunityCategory', a.community || a.socialCategory || '—');
            setVal('infoCommunityCaste', a.caste || a.subCaste || a.casteName || '—');
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
                    errorMessage: '⚠️ சாதிச் சான்றிதழ் (REV-101) விண்ணப்பிக்க விண்ணப்பதாரரின் பாஸ்போர்ட் புகைப்படம் கட்டாயம் தேவை.\n\nதயவுசெய்து புகைப்படத்தைப் பதிவேற்றவும்.'
                };
            }
            const b64 = data?.base64Docs || {};
            const hasComm = Boolean(
                data?.communityProof || data?.communityCertificatePath || data?.familyCommunityProofPath ||
                docs?.communityProof || b64.communityProofBase64
            );
            if (!hasComm) {
                return {
                    valid: false,
                    errorMessage: '⚠️ சாதிச் சான்றிதழ் (REV-101) விண்ணப்பிக்க "குடும்ப சாதிச் சான்றிதழ் அல்லது பள்ளி TC" ஆவணம் கட்டாயம் தேவை.\n\nதயவுசெய்து ஆவணத்தைப் பதிவேற்றிய பிறகு விண்ணப்பிக்கவும்.'
                };
            }
            return { valid: true };
        },
        syncFromUpload: function (docType, prof, { setVal }) {
            if (!['communityCertificate', 'communityProof', 'familyCommunityProof'].includes(docType)) return;
            if (prof.caste) setVal('editCaste', prof.caste);
            if (prof.community) setVal('editCommunity', prof.community);
        }
    };
}));
