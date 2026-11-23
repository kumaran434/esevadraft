// =============================================================================
// UI Cartridge: TNPDS_REMOVE_MEMBER (குடும்ப உறுப்பினர் நீக்கம்)
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
        id: 'TNPDS_REMOVE_MEMBER',
        ownedDocTypes: ['smartCard', 'rationCard', 'removeProof', 'deathCertificate', 'marriageCertificate', 'applicationPdf'],
        editModal: {
            layoutMode: 'REMOVE_MEMBER',
            title: '✏️ நீக்கப்படும் குடும்ப உறுப்பினர் விவரங்கள் (Remove Member Details)',
            subtitle: 'குடும்ப அட்டை எண் & நீக்கப்படும் உறுப்பினர் விவரங்களை மட்டும் சரிபார்க்கவும்',
            submitButtonHtml: '<i class="fa-solid fa-user-minus"></i> 🚀 குடும்ப உறுப்பினர் நீக்க (Remove Member in TNPDS)',
            isRationHead: false,
            showMasterButton: true,
            showGasToggle: false,
            customWrapMode: 'removeMember'
        },
        renderCustomView: async function (ctx) {
            const { data, sData, renderDocPreview } = ctx;
            const proofPath = sData.docPath || sData.removeProofDocPath || data.documents?.removeProof || '';
            renderDocPreview(proofPath, 'editRemoveMemberProofPreview', 'editRemoveMemberProofPlaceholder', 'editRemoveMemberProofPdfBadge', 'editRemoveMemberProofStatus', 'editRemoveMemberProofViewBtn', 'நீக்கல் சான்றிதழ் தேவை', 'editRemoveMemberProofDeleteBtn');

            const proofTitle = document.getElementById('editRemoveMemberProofTitle');
            if (proofTitle) proofTitle.innerText = `📄 ${sData.docType || 'நீக்கல் சான்றிதழ் / ஆவணம்'}`;

            const cardEl = document.getElementById('editRemoveMemberCardNo');
            if (cardEl) cardEl.value = data.smartCardNumber || data.rationCardNo || sData.smartCardNumber || '';

            const reasonEl = document.getElementById('editRemoveMemberReason');
            if (reasonEl && sData.reason) {
                reasonEl.value = sData.reason;
                if (!reasonEl.value) {
                    for (const opt of reasonEl.options) {
                        if (opt.text.includes(sData.reason) || opt.value.includes(sData.reason)) {
                            reasonEl.value = opt.value;
                            break;
                        }
                    }
                }
            }

            const nameTamEl = document.getElementById('editRemoveMemberNameTam');
            if (nameTamEl) nameTamEl.value = sData.memberNameTam || sData.memberName || '';
            const nameEngEl = document.getElementById('editRemoveMemberNameEng');
            if (nameEngEl) nameEngEl.value = sData.memberNameEng || sData.memberName || '';

            const docTypeEl = document.getElementById('editRemoveMemberDocType');
            if (docTypeEl && sData.docType) {
                docTypeEl.value = sData.docType;
                if (!docTypeEl.value) {
                    for (const opt of docTypeEl.options) {
                        if (opt.text.includes(sData.docType) || opt.value.includes(sData.docType)) {
                            docTypeEl.value = opt.value;
                            break;
                        }
                    }
                }
            }

            const aadhEl = document.getElementById('editRemoveMemberAadhaar');
            if (aadhEl) {
                const rawAadh = sData.aadhaarNo || '';
                aadhEl.value = rawAadh ? rawAadh.replace(/(\d{4})/g, '$1 ').trim() : '';
            }
            return true;
        },
        collectEditFields: function (ctx) {
            const { sData, forceMasterProfile } = ctx;
            if (forceMasterProfile) return null;

            const cardNo = document.getElementById('editRemoveMemberCardNo')?.value.trim() || '';
            const reason = document.getElementById('editRemoveMemberReason')?.value || 'இறப்பு (Death of Member)';
            const nameTam = document.getElementById('editRemoveMemberNameTam')?.value.trim() || '';
            const nameEng = document.getElementById('editRemoveMemberNameEng')?.value.trim() || '';
            const docType = document.getElementById('editRemoveMemberDocType')?.value || 'இறப்புச் சான்றிதழ் (Death Certificate)';
            const aadhaarNo = (document.getElementById('editRemoveMemberAadhaar')?.value || '').replace(/\s+/g, '');

            return {
                overrideUpdated: {
                    subService: 'REMOVE_MEMBER',
                    smartCardNumber: cardNo,
                    rationCardNo: cardNo,
                    fullNameTam: nameTam,
                    fullNameEng: nameEng,
                    subServiceData: {
                        ...sData,
                        subService: 'REMOVE_MEMBER',
                        smartCardNumber: cardNo,
                        rationCardNo: cardNo,
                        reason,
                        memberNameTam: nameTam,
                        memberNameEng: nameEng,
                        memberName: nameEng || nameTam,
                        docType,
                        aadhaarNo
                    }
                }
            };
        },
        sidebar: {
            headTitle: '👤 குடும்பத் தலைவர் / அட்டை விவரங்கள்',
            boxId: 'sidebarRemoveMemberBox'
        },
        populateSidebar: function (a, subData, { setVal }) {
            const remName = subData?.memberNameTam || subData?.memberNameEng || subData?.memberName || '—';
            setVal('infoRemoveMemberName', remName);
            setVal('infoRemoveReason', subData?.reason || '—');
            setVal('infoRemoveSmartCard', a.smartCardNumber || a.rationCardNo || subData?.smartCardNumber || '—');
            return true;
        },
        validatePreSubmit: function () {
            return { valid: true };
        }
    };
}));
