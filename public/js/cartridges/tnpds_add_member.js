// =============================================================================
// UI Cartridge: TNPDS_ADD_MEMBER (குடும்ப உறுப்பினர் சேர்க்கை)
// Completely isolated Edit Modal renderer, collector & Pre-Submit validator.
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
        id: 'TNPDS_ADD_MEMBER',
        ownedDocTypes: ['smartCard', 'rationCard', 'memberAadhaar', 'applicationPdf'],
        editModal: {
            layoutMode: 'ADD_MEMBER',
            title: '✏️ சேர்க்கப்படும் குடும்ப உறுப்பினர் விவரங்கள் (Add Member Details)',
            subtitle: 'ஸ்மார்ட் கார்டு எண் & புதிய உறுப்பினர் விவரங்களை மட்டும் சரிபார்க்கவும்',
            submitButtonHtml: '<i class="fa-solid fa-user-plus"></i> 🚀 குடும்ப உறுப்பினர் சேர்க்க (Add Member in TNPDS)',
            isRationHead: false,
            showMasterButton: false,
            showGasToggle: false,
            customWrapMode: 'addMember'
        },
        renderCustomView: async function (ctx) {
            const { data, sData, activeCustMob, renderDocPreview, updateDualSideButtonStates } = ctx;

            let memAadhaarPath = sData.aadhaarDocPath || sData.docPath || data.tempMember?.docPath || data.documents?.memberAadhaar || '';
            const headAadhDoc = data.citizenProfile?.headAadhaarDocPath || data.headAadhaarDocPath || data.documents?.headAadhaar || data.members?.[0]?.docPath || '';
            if (memAadhaarPath && headAadhDoc && memAadhaarPath === headAadhDoc) {
                memAadhaarPath = '';
            }

            if (!memAadhaarPath && activeCustMob) {
                try {
                    const docListRes = await fetch(`/api/drafts/${encodeURIComponent(activeCustMob)}/documents-list?subService=ADD_MEMBER`);
                    const docListJson = await docListRes.json();
                    if (docListJson && Array.isArray(docListJson.documents)) {
                        const foundAadh = docListJson.documents.find(d => d.type === 'memberAadhaar');
                        if (foundAadh && !memAadhaarPath) memAadhaarPath = foundAadh.previewUrl;
                    }
                } catch (e) {
                    console.warn('Failed to fetch doc list for Add Member preview:', e);
                }
            }

            renderDocPreview(memAadhaarPath, 'editAddMemberAadhaarPreview', 'editAddMemberAadhaarPlaceholder', 'editAddMemberAadhaarPdfBadge', 'editAddMemberAadhaarStatus', 'editAddMemberAadhaarViewBtn', 'உறுப்பினர் ஆதார் அட்டை தேவை', 'editAddMemberAadhaarDeleteBtn');
            const memDocStr = String(memAadhaarPath || '');
            const hasMemBack = Boolean(sData.aadhaarBackPath || memDocStr.includes('merged') || memDocStr.includes('dual') || memDocStr.includes('2in1') || memDocStr.endsWith('.pdf'));
            updateDualSideButtonStates('memberAadhaar', Boolean(memAadhaarPath), hasMemBack);

            const proofBox = document.getElementById('editAddMemberProofBox');
            if (proofBox) {
                proofBox.style.display = 'none';
            }

            const cardEl = document.getElementById('editAddMemberCardNo');
            if (cardEl) cardEl.value = data.smartCardNumber || data.rationCardNo || sData.smartCardNumber || '';

            const relEl = document.getElementById('editAddMemberRel');
            if (relEl) {
                const relVal = sData.relationshipTam || sData.relationship || 'மகன்';
                relEl.value = relVal;
                if (!relEl.value && relVal) {
                    for (const opt of relEl.options) {
                        if (opt.text.includes(relVal) || opt.value.includes(relVal)) {
                            relEl.value = opt.value;
                            break;
                        }
                    }
                }
            }

            const nameTamEl = document.getElementById('editAddMemberNameTam');
            if (nameTamEl) nameTamEl.value = sData.memberNameTam || '';
            const nameEngEl = document.getElementById('editAddMemberNameEng');
            if (nameEngEl) nameEngEl.value = sData.memberNameEng || '';
            const fatTamEl = document.getElementById('editAddMemberFatherTam');
            if (fatTamEl) fatTamEl.value = sData.fatherNameTam || '';
            const fatEngEl = document.getElementById('editAddMemberFatherEng');
            if (fatEngEl) fatEngEl.value = sData.fatherNameEng || '';
            const dobEl = document.getElementById('editAddMemberDob');
            if (dobEl) dobEl.value = sData.dob || '';
            const genEl = document.getElementById('editAddMemberGender');
            if (genEl) genEl.value = sData.gender || 'Male';
            const aadhEl = document.getElementById('editAddMemberAadhaar');
            if (aadhEl) {
                const rawAadh = sData.aadhaarNo || '';
                aadhEl.value = rawAadh ? rawAadh.replace(/(\d{4})/g, '$1 ').trim() : '';
            }
            return true;
        },
        collectEditFields: function (ctx) {
            const { data, sData, forceMasterProfile } = ctx;
            if (forceMasterProfile) return null;
            const hasAddCtx = Boolean(sData.memberName || sData.memberNameTam || sData.aadhaarNo || sData.relationship || sData.smartCardNumber || data?.tempMember || document.getElementById('editAddMemberFieldsWrap')?.style.display !== 'none');
            if (!hasAddCtx) return null;

            const memCard = document.getElementById('editAddMemberCardNo')?.value.trim() || '';
            const memRel = document.getElementById('editAddMemberRel')?.value || 'மகன்';
            const memNameTam = document.getElementById('editAddMemberNameTam')?.value.trim() || '';
            const memNameEng = document.getElementById('editAddMemberNameEng')?.value.trim() || '';
            const memFatherTam = document.getElementById('editAddMemberFatherTam')?.value.trim() || '';
            const memFatherEng = document.getElementById('editAddMemberFatherEng')?.value.trim() || '';
            const memDob = document.getElementById('editAddMemberDob')?.value.trim() || '';
            const memGender = document.getElementById('editAddMemberGender')?.value || 'Male';
            const memAadhaar = (document.getElementById('editAddMemberAadhaar')?.value || '').replace(/\s+/g, '');

            const updatedSubServiceData = {
                ...sData,
                smartCardNumber: memCard,
                relationshipTam: memRel,
                relationship: memRel,
                memberNameTam: memNameTam,
                memberNameEng: memNameEng,
                memberName: memNameTam || memNameEng || '',
                fatherNameTam: memFatherTam,
                fatherNameEng: memFatherEng,
                dob: memDob,
                gender: memGender,
                genderTam: memGender === 'Female' ? 'பெண்' : 'ஆண்',
                aadhaarNo: memAadhaar
            };
            return {
                overrideUpdated: {
                    subService: 'ADD_MEMBER',
                    smartCardNumber: memCard,
                    rationCardNo: memCard,
                    subServiceData: updatedSubServiceData
                }
            };
        },
        sidebar: {
            headTitle: '👤 குடும்பத் தலைவர் விவரங்கள்',
            boxId: 'sidebarAddMemberBox',
            showMembersContainer: false
        },
        populateSidebar: function (a, subData, { setVal, activeCustMob }) {
            if (!subData) return false;
            const list = Array.isArray(subData.addMembersList) ? subData.addMembersList : [];
            const cleanHeadAadh = String(a?.headAadhaar || '').replace(/\D/g, '');
            const cleanMemAadh = String(subData.aadhaarNo || '').replace(/\D/g, '');
            const hasValidNewMember = Boolean(
                list.length > 0 ||
                ((subData.memberNameTam || subData.memberNameEng || subData.memberName) &&
                 (!cleanHeadAadh || !cleanMemAadh || cleanMemAadh !== cleanHeadAadh))
            );
            const cleanMob = (a.mobileNumber && !/^walkin_/i.test(String(a.mobileNumber))) ? a.mobileNumber : ((activeCustMob && !/^walkin_/i.test(String(activeCustMob))) ? activeCustMob : '');
            const mobDisp = cleanMob ? `+91 ${cleanMob}` : '—';

            // Remove any extra multi-member cards rendered previously inside sidebarAddMemberBox
            const boxEl = document.getElementById('sidebarAddMemberBox');
            if (boxEl) {
                boxEl.querySelectorAll('.extra-add-member-item').forEach(el => el.remove());
            }

            if (!hasValidNewMember) {
                const countNote = subData.targetAddCount ? ` (${subData.targetAddCount} நபர்${subData.targetAddCount > 1 ? 'கள்' : ''})` : '';
                setVal('infoAddMemberName', `புதிய உறுப்பினர் தேவை${countNote} ⚠️`);
                setVal('infoAddMemberRel', subData.relationshipTam || '—');
                setVal('infoAddMemberDobGender', '—');
                setVal('infoAddMemberAadhaar', '—');
                setVal('infoAddMemberMobile', mobDisp);
                setVal('infoAddMemberDoc', 'ஆவணம் பதிவேற்றவும் ⚠️');
                return true;
            }

            // Primary card shows Member 1 (or currently extracted member if list is empty)
            const firstM = list.length > 0 ? list[0] : subData;
            const addName = firstM.memberNameTam ? (firstM.memberNameEng ? `${firstM.memberNameTam} (${firstM.memberNameEng})` : firstM.memberNameTam) : (firstM.memberName || '—');
            const addRel = firstM.relationshipTam || firstM.relationship || 'உறுப்பினர்';
            const addDob = firstM.dob || '—';
            const addGender = firstM.genderTam || firstM.gender || '—';
            const addAadhaar = firstM.aadhaarNo ? String(firstM.aadhaarNo).replace(/(\d{4})/g, '$1 ').trim() : '—';
            setVal('infoAddMemberName', list.length > 1 ? `1. ${addName}` : addName);
            setVal('infoAddMemberRel', addRel);
            setVal('infoAddMemberDobGender', `${addDob} | ${addGender}`);
            setVal('infoAddMemberAadhaar', addAadhaar);
            setVal('infoAddMemberMobile', mobDisp);
            setVal('infoAddMemberDoc', 'ஆதார் அட்டை (Aadhaar Card) ✅');

            // Render clean 1-to-1 entries for additional added members (Member 2, 3...) without duplicating Member 1
            if (boxEl && list.length > 1) {
                list.slice(1).forEach((m, i) => {
                    const mName = m.memberNameTam ? (m.memberNameEng ? `${m.memberNameTam} (${m.memberNameEng})` : m.memberNameTam) : (m.memberName || '—');
                    const mAadh = m.aadhaarNo ? String(m.aadhaarNo).replace(/(\d{4})/g, '$1 ').trim() : '—';
                    const div = document.createElement('div');
                    div.className = 'extra-add-member-item';
                    div.style.cssText = 'margin-top:8px; padding-top:8px; border-top:1px dashed #cbd5e1; font-size:12px;';
                    div.innerHTML = `<div class="card-row"><strong>${i + 2}. ${mName}</strong> (${m.relationshipTam || 'உறுப்பினர்'})</div>` +
                                    `<div class="card-row">பிறந்த தேதி: <strong>${m.dob || '—'} | ${m.genderTam || m.gender || '—'}</strong></div>` +
                                    `<div class="card-row">ஆதார் எண்: <strong>${mAadh}</strong> ✅</div>`;
                    boxEl.appendChild(div);
                });
            }
            return true;
        },
        validatePreSubmit: function (dataObj = {}, docs = {}) {
            const sData = dataObj.subServiceData || {};
            const memName = (sData.memberNameTam || sData.memberNameEng || sData.memberName || '').trim();
            if (!memName) {
                return { valid: false, errorMessage: '⚠️ சேர்க்கப்பட வேண்டிய புதிய உறுப்பினரின் பெயரை உள்ளிடவும்.' };
            }
            const cleanHeadAadh = String(dataObj.headAadhaar || '').replace(/\D/g, '');
            const cleanMemAadh = String(sData.aadhaarNo || sData.aadhaarNumber || '').replace(/\D/g, '');
            if (cleanHeadAadh && cleanMemAadh && cleanMemAadh === cleanHeadAadh) {
                return { valid: false, errorMessage: '⚠️ குடும்பத் தலைவரின் ஆதார் எண்ணையே புதிய உறுப்பினராகச் சேர்க்க முடியாது! புதிய உறுப்பினரின் ஆதார் எண்ணை உள்ளிடவும்.' };
            }
            if (cleanMemAadh.length !== 12) {
                return { valid: false, errorMessage: '⚠️ புதிய உறுப்பினரின் சரியான 12-இலக்க ஆதார் எண்ணை உள்ளிடவும் (குழந்தைக்கும் ஆதார் கட்டாயம்).' };
            }
            if (!sData.dob) {
                return { valid: false, errorMessage: '⚠️ புதிய உறுப்பினரின் பிறந்த தேதியை (DD/MM/YYYY) உள்ளிடவும்.' };
            }
            const hasMemDoc = Boolean(sData.aadhaarDocPath || sData.docPath || docs.memberAadhaar);
            if (!hasMemDoc) {
                return { valid: false, errorMessage: '⚠️ புதிய உறுப்பினரின் ஆதார் அட்டையைப் பதிவேற்றவும் (குழந்தையாக இருந்தாலும் ஆதார் அட்டை கட்டாயம்).' };
            }
            return { valid: true };
        }
    };
}));
