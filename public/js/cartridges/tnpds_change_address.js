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
            showMasterButton: false,
            showGasToggle: false,
            customWrapMode: 'changeAddress'
        },
        renderCustomView: async function (ctx) {
            const { data, sData, activeCustMob, renderDocPreview } = ctx;

            const cardEl = document.getElementById('editAddressCardNo');
            if (cardEl) cardEl.value = data.smartCardNumber || data.rationCardNo || sData.smartCardNumber || '';

            const proofTypeEl = document.getElementById('editAddressProofType');
            if (proofTypeEl) {
                const val = sData.proofType || '';
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
            setIf('editAddressDoorNo', sData.doorNo || sData.newDoorNo || '');
            setIf('editAddressStreetTam', sData.streetTam || sData.newStreet || '');
            setIf('editAddressStreetEng', sData.streetEng || '');
            setIf('editAddressAreaTam', sData.areaTam || '');
            setIf('editAddressPin', sData.pincode || sData.newPincode || '');
            setIf('editAddressDistrict', sData.district || sData.newDistrict || '');
            setIf('editAddressTaluk', sData.taluk || sData.newTaluk || '');
            setIf('editAddressVillage', sData.village || sData.newVillage || '');

            let addrDocPath = sData.addressProofDocPath || sData.docPath || data.documents?.newAddressProof || '';
            if (!addrDocPath && activeCustMob) {
                try {
                    const docListRes = await fetch(`/api/drafts/${encodeURIComponent(activeCustMob)}/documents-list?subService=CHANGE_ADDRESS`);
                    const docListJson = await docListRes.json();
                    if (docListJson && Array.isArray(docListJson.documents)) {
                        const foundDoc = docListJson.documents.find(d => d.type === 'newAddressProof' || d.type === 'residenceProof' || d.type === 'gasBook');
                        if (foundDoc) addrDocPath = foundDoc.previewUrl;
                    }
                } catch (e) {
                    console.warn('Failed to fetch doc list for Change Address preview:', e);
                }
            }
            renderDocPreview(addrDocPath, 'editAddressProofPreview', 'editAddressProofPlaceholder', 'editAddressProofPdfBadge', 'editAddressProofStatus', 'editAddressProofViewBtn', 'புதிய முகவரிச் சான்று தேவை', 'editAddressProofDeleteBtn');
            return true;
        },
        collectEditFields: function (ctx) {
            const { sData, forceMasterProfile } = ctx;
            if (forceMasterProfile) return null;

            const cardNo = document.getElementById('editAddressCardNo')?.value.trim() || '';
            const proofType = document.getElementById('editAddressProofType')?.value || 'மின்சார ரசீது';
            const doorNo = document.getElementById('editAddressDoorNo')?.value.trim() || '';
            const streetTam = document.getElementById('editAddressStreetTam')?.value.trim() || '';
            const streetEng = document.getElementById('editAddressStreetEng')?.value.trim() || streetTam;
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
                        newVillage: village,
                        isNewAddressEntered: Boolean(doorNo && (streetTam || streetEng))
                    }
                }
            };
        },
        sidebar: {
            headTitle: '👤 குடும்பத் தலைவர் / அட்டை விவரங்கள்',
            boxId: 'sidebarChangeAddressBox'
        },
        populateSidebar: function (a, subData, { setVal }) {
            if (!subData) {
                setVal('infoChangeAddressStreet', 'புதிய முகவரி உள்ளிடவும் ⚠️');
                setVal('infoChangeAddressArea', '—');
                setVal('infoChangeAddressTalukDist', '—');
                setVal('infoChangeAddressPin', '—');
                setVal('infoChangeAddressProof', 'புதிய சான்று தேவை ⚠️');
                return true;
            }
            const dNo = subData.doorNo || '';
            const street = subData.streetTam ? (subData.streetEng && subData.streetEng !== subData.streetTam ? `${subData.streetTam} (${subData.streetEng})` : subData.streetTam) : (subData.streetEng || '');
            const area = subData.areaTam ? (subData.areaEng ? `${subData.areaTam} (${subData.areaEng})` : subData.areaTam) : (subData.areaEng || '—');
            const taluk = subData.taluk || '';
            const dist = subData.district || '';
            const pin = subData.pincode || '—';
            const proof = subData.proofType || '';
            const hasDoc = Boolean(subData.addressProofDocPath || subData.docPath || a?.documents?.newAddressProof);
            setVal('infoChangeAddressStreet', (dNo || street) ? `${dNo}${dNo && street ? ', ' : ''}${street}` : 'புதிய முகவரி உள்ளிடவும் ⚠️');
            setVal('infoChangeAddressArea', area);
            setVal('infoChangeAddressTalukDist', (taluk || dist) ? `${taluk}${taluk && dist ? ' / ' : ''}${dist}` : '—');
            setVal('infoChangeAddressPin', pin);
            setVal('infoChangeAddressProof', proof ? `${proof}${hasDoc ? ' ✅' : ' ⚠️'}` : (hasDoc ? 'புதிய சான்று ✅' : 'புதிய சான்று தேவை ⚠️'));
            return true;
        },
        validatePreSubmit: function (dataObj = {}, docs = {}) {
            const sData = dataObj.subServiceData || {};
            if (!sData.doorNo || !(sData.streetTam || sData.streetEng)) {
                return { valid: false, errorMessage: '⚠️ புதிய வீட்டின் கதவு எண் மற்றும் தெருப் பெயரை உள்ளிடவும்.' };
            }
            if (!/^\d{6}$/.test(String(sData.pincode || '').trim())) {
                return { valid: false, errorMessage: '⚠️ சரியான 6-இலக்க பின்கோடு (Pincode) உள்ளிடவும்.' };
            }
            if (!sData.district || !sData.taluk) {
                return { valid: false, errorMessage: '⚠️ புதிய மாவட்டம் மற்றும் வட்டம் (Taluk) விவரங்களை உள்ளிடவும்.' };
            }
            const hasProof = Boolean(sData.addressProofDocPath || sData.docPath || docs.newAddressProof);
            if (!hasProof) {
                return { valid: false, errorMessage: '⚠️ புதிய முகவரிக்கான சான்று ஆவணத்தைப் பதிவேற்றவும்.' };
            }
            return { valid: true };
        }
    };
}));
