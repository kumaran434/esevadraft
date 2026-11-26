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
        ownedDocTypes: ['smartCard', 'rationCard', 'applicationPdf'],
        editModal: {
            layoutMode: 'UPDATE_MOBILE',
            title: '📱 கைபேசி எண் மாற்ற விண்ணப்பம் (Update Mobile Number)',
            subtitle: 'தற்போதைய பதிவு எண் & புதிய 10-இலக்க கைபேசி எண்ணைச் சரிபார்க்கவும்',
            submitButtonHtml: '<i class="fa-solid fa-mobile-screen-button"></i> 🚀 கைபேசி எண் மாற்றம் செய்ய (Update Mobile in TNPDS)',
            isRationHead: false,
            showMasterButton: false,
            showGasToggle: false,
            customWrapMode: 'updateMobile',
            docBoxes: {
                photo: false,
                headAadhaar: false,
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
                ration: false,
                smartCardNo: false,
                canNo: false
            },
            dynamicDocs: []
        },
        renderCustomView: async function (ctx) {
            const { data, sData } = ctx;
            const regMob = String(data.mobileNumber || '').replace(/\D/g, '').slice(-10);
            const oldEl = document.getElementById('editUpdateOldMobile');
            if (oldEl) oldEl.value = regMob ? `+91 ${regMob}` : '—';

            const newEl = document.getElementById('editUpdateNewMobile');
            if (newEl) {
                const candidate = String(sData.newMobile || sData.newMobileNumber || '').replace(/\D/g, '').slice(-10);
                newEl.value = (sData.isMobileUpdateEntered && /^[6-9]\d{9}$/.test(candidate) && candidate !== regMob) ? candidate : '';
            }

            const cardEl = document.getElementById('editUpdateMobileCardNo');
            if (cardEl) cardEl.value = data.smartCardNumber || data.rationCardNo || sData.smartCardNumber || '';
            return true;
        },
        populateEditFields: function (data, { safeSetVal }) {
            const sData = data?.subServiceData || {};
            const regMob = String(data?.mobileNumber || '').replace(/\D/g, '').slice(-10);
            const candidate = String(sData.newMobile || sData.newMobileNumber || '').replace(/\D/g, '').slice(-10);
            const validNewMob = (sData.isMobileUpdateEntered && /^[6-9]\d{9}$/.test(candidate) && candidate !== regMob) ? candidate : '';
            safeSetVal('editUpdateOldMobile', regMob ? `+91 ${regMob}` : '');
            safeSetVal('editUpdateNewMobile', validNewMob);
            safeSetVal('editUpdateMobileCardNo', data?.smartCardNumber || data?.rationCardNo || sData.smartCardNumber || '');
        },
        collectEditFields: function (ctx) {
            const { sData = {}, forceMasterProfile } = ctx || {};
            if (forceMasterProfile) return null;
            const newMob = String(document.getElementById('editUpdateNewMobile')?.value || '').replace(/\D/g, '').slice(-10);
            const cardNo = String(document.getElementById('editUpdateMobileCardNo')?.value || '').trim();
            return {
                overrideUpdated: {
                    subService: 'UPDATE_MOBILE',
                    smartCardNumber: cardNo,
                    rationCardNo: cardNo,
                    subServiceData: {
                        ...sData,
                        smartCardNumber: cardNo,
                        newMobile: newMob,
                        isMobileUpdateEntered: Boolean(newMob)
                    }
                }
            };
        },
        sidebar: {
            headTitle: '👤 வாடிக்கையாளர் விவரங்கள்',
            boxId: 'sidebarUpdateMobileBox'
        },
        populateSidebar: function (a, subData, { setVal, activeCustMob }) {
            const rawReg = (a?.mobileNumber && !/^walkin_/i.test(String(a.mobileNumber))) ? a.mobileNumber : (activeCustMob || '');
            const regMob = String(rawReg).replace(/\D/g, '').slice(-10);
            const candidateNew = String(subData?.newMobile || subData?.newMobileNumber || '').replace(/\D/g, '').slice(-10);
            const hasValidNew = Boolean(subData?.isMobileUpdateEntered && /^[6-9]\d{9}$/.test(candidateNew) && candidateNew !== regMob);
            const cardNo = a?.smartCardNumber || a?.rationCardNo || subData?.smartCardNumber || '—';

            setVal('infoUpdateOldMobile', regMob ? `+91 ${regMob}` : '—');
            setVal('infoUpdateNewMobile', hasValidNew ? `+91 ${candidateNew} ✅` : 'புதிய எண் உள்ளிட வேண்டும் ⚠️');
            setVal('infoUpdateMobileCard', cardNo || '—');
            return true;
        },
        validatePreSubmit: function (dataObj = {}) {
            const regMob = String(dataObj.mobileNumber || '').replace(/\D/g, '').slice(-10);
            const newMob = String(dataObj.subServiceData?.newMobile || '').replace(/\D/g, '').slice(-10);
            if (!/^[6-9]\d{9}$/.test(newMob)) {
                return { valid: false, errorMessage: '⚠️ தயவுசெய்து சரியான 10-இலக்க புதிய கைபேசி எண்ணை (New Mobile Number) உள்ளிடவும்.' };
            }
            if (regMob && newMob === regMob) {
                return { valid: false, errorMessage: '⚠️ பழைய பதிவு எண்ணும் புதிய கைபேசி எண்ணும் ஒன்றாக இருக்கக்கூடாது.' };
            }
            return { valid: true };
        }
    };
}));
