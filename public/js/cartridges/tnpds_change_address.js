// =============================================================================
// UI Cartridge: TNPDS_CHANGE_ADDRESS (முகவரி மாற்றம்)
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
        id: 'TNPDS_CHANGE_ADDRESS',
        ownedDocTypes: ['smartCard', 'rationCard', 'newAddressProof', 'addressProof', 'residenceProof', 'applicationPdf'],
        editModal: {
            layoutMode: 'CHANGE_ADDRESS',
            title: '✏️ குடும்ப அட்டை புதிய முகவரி விவரங்கள் (Change Address Details)',
            subtitle: 'புதிய முகவரி மற்றும் முகவரிச் சான்றை மட்டும் சரிபார்க்கவும்',
            submitButtonHtml: '<i class="fa-solid fa-map-location-dot"></i> 🚀 முகவரி மாற்றம் செய்ய (Change Address in TNPDS)',
            isRationHead: false,
            showMasterButton: true,
            showGasToggle: false,
            customWrapMode: 'changeAddress'
        },
        renderCustomView: async function (ctx) {
            const { data, sData, activeCustMob, renderDocPreview } = ctx;

            const cardEl = document.getElementById('editAddressCardNo');
            if (cardEl) cardEl.value = data.smartCardNumber || data.rationCardNo || sData.smartCardNumber || '';

            const proofTypeEl = document.getElementById('editAddressProofType');
            if (proofTypeEl) {
                const val = sData.proofType || data.residenceProof?.typeTam || '';
                if (val) {
                    proofTypeEl.value = val;
                    if (!proofTypeEl.value) {
                        for (const opt of proofTypeEl.options) {
                            if (opt.value.includes(val) || opt.text.includes(val)) {
                                proofTypeEl.value = opt.value;
                                break;
                            }
                        }
                    }
                }
            }

            const setIf = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
            setIf('editAddressDoorNo', sData.doorNo || sData.newDoorNo || data.doorNo || '');
            setIf('editAddressStreetTam', sData.streetTam || sData.newStreet || data.streetTam || data.streetEng || '');
            setIf('editAddressStreetEng', sData.streetEng || data.streetEng || '');
            setIf('editAddressAreaTam', sData.areaTam || data.areaTam || data.village || '');
            setIf('editAddressPin', sData.pincode || sData.newPincode || data.pincode || '');
            setIf('editAddressDistrict', sData.district || sData.newDistrict || data.district || '');
            setIf('editAddressTaluk', sData.taluk || sData.newTaluk || data.taluk || '');
            setIf('editAddressVillage', sData.village || sData.newVillage || data.village || '');

            let addrDocPath = sData.docPath || data.residenceProof?.docPath || data.gasDetails?.gasBookPath || data.documents?.residenceProof || data.documents?.gasBook || '';
            if (!addrDocPath && activeCustMob) {
                try {
                    const docListRes = await fetch(`/api/drafts/${encodeURIComponent(activeCustMob)}/documents-list`);
                    const docListJson = await docListRes.json();
                    if (docListJson && Array.isArray(docListJson.documents)) {
                        const foundDoc = docListJson.documents.find(d => d.type === 'gasBook' || d.type === 'residenceProof' || d.type === 'headAadhaar');
                        if (foundDoc) addrDocPath = foundDoc.previewUrl;
                    }
                } catch (e) {
                    console.warn('Failed to fetch doc list for Change Address preview:', e);
                }
            }
            renderDocPreview(addrDocPath, 'editAddressProofPreview', 'editAddressProofPlaceholder', 'editAddressProofPdfBadge', 'editAddressProofStatus', 'editAddressProofViewBtn', 'முகவரிச் சான்று தேவை', 'editAddressProofDeleteBtn');
            return true;
        },
        collectEditFields: function (ctx) {
            const { sData, forceMasterProfile } = ctx;
            if (forceMasterProfile) return null;

            const cardNo = document.getElementById('editAddressCardNo')?.value.trim() || '';
            const proofType = document.getElementById('editAddressProofType')?.value || 'எரிவாயு நுகர்வோர் அட்டை';
            const doorNo = document.getElementById('editAddressDoorNo')?.value.trim() || '';
            const streetTam = document.getElementById('editAddressStreetTam')?.value.trim() || '';
            const streetEng = document.getElementById('editAddressStreetEng')?.value.trim() || '';
            const areaTam = document.getElementById('editAddressAreaTam')?.value.trim() || '';
            const pin = document.getElementById('editAddressPin')?.value.trim() || '';
            const district = document.getElementById('editAddressDistrict')?.value.trim() || '';
            const taluk = document.getElementById('editAddressTaluk')?.value.trim() || '';
            const village = document.getElementById('editAddressVillage')?.value.trim() || '';

            return {
                overrideUpdated: {
                    subService: 'CHANGE_ADDRESS',
                    smartCardNumber: cardNo,
                    rationCardNo: cardNo,
                    doorNo,
                    streetTam,
                    streetEng,
                    areaTam,
                    pincode: pin,
                    district,
                    taluk,
                    village,
                    subServiceData: {
                        ...sData,
                        subService: 'CHANGE_ADDRESS',
                        smartCardNumber: cardNo,
                        rationCardNo: cardNo,
                        proofType,
                        doorNo,
                        newDoorNo: doorNo,
                        streetTam,
                        streetEng,
                        newStreet: streetEng || streetTam,
                        areaTam,
                        pincode: pin,
                        newPincode: pin,
                        district,
                        newDistrict: district,
                        taluk,
                        newTaluk: taluk,
                        village,
                        newVillage: village
                    }
                }
            };
        },
        sidebar: {
            headTitle: '👤 குடும்பத் தலைவர் / அட்டை விவரங்கள்',
            boxId: 'sidebarChangeAddressBox'
        },
        populateSidebar: function (a, subData, { setVal }) {
            if (!subData) return false;
            const dNo = subData.doorNo || '—';
            const street = subData.streetTam ? (subData.streetEng ? `${subData.streetTam} (${subData.streetEng})` : subData.streetTam) : (subData.streetEng || '');
            const area = subData.areaTam ? (subData.areaEng ? `${subData.areaTam} (${subData.areaEng})` : subData.areaTam) : (subData.areaEng || '—');
            const taluk = subData.taluk || a.taluk || '—';
            const dist = subData.district || a.district || '—';
            const pin = subData.pincode || a.pincode || '—';
            const proof = subData.proofType || 'மின் கட்டண ரசீது (EB Bill)';
            setVal('infoChangeAddressStreet', `${dNo}, ${street}`.trim());
            setVal('infoChangeAddressArea', area);
            setVal('infoChangeAddressTalukDist', `${taluk} / ${dist}`);
            setVal('infoChangeAddressPin', pin);
            setVal('infoChangeAddressProof', `${proof} ✅`);
            return true;
        },
        validatePreSubmit: function () {
            return { valid: true };
        }
    };
}));
