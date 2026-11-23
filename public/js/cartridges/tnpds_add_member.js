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
        ownedDocTypes: ['smartCard', 'rationCard', 'memberAadhaar', 'birthCertificate', 'surrenderProof', 'applicationPdf'],
        editModal: {
            layoutMode: 'ADD_MEMBER',
            title: '✏️ சேர்க்கப்படும் குடும்ப உறுப்பினர் விவரங்கள் (Add Member Details)',
            subtitle: 'ஸ்மார்ட் கார்டு எண் & புதிய உறுப்பினர் விவரங்களை மட்டும் சரிபார்க்கவும்',
            submitButtonHtml: '<i class="fa-solid fa-user-plus"></i> 🚀 குடும்ப உறுப்பினர் சேர்க்க (Add Member in TNPDS)',
            isRationHead: false,
            showMasterButton: true,
            showGasToggle: false,
            customWrapMode: 'addMember'
        },
        renderCustomView: async function (ctx) {
            const { data, sData, activeCustMob, renderDocPreview, updateDualSideButtonStates } = ctx;

            let memAadhaarPath = sData.aadhaarDocPath || sData.docPath || data.tempMember?.docPath || data.documents?.memberAadhaar || '';
            const headAadhDoc = data.citizenProfile?.headAadhaarDocPath || data.headAadhaarDocPath || data.documents?.headAadhaar || '';
            if (!sData.docPath && !data.documents?.memberAadhaar && memAadhaarPath && headAadhDoc && memAadhaarPath === headAadhDoc) {
                memAadhaarPath = '';
            }
            let proofPath = sData.proofDocPath || sData.birthDocPath || sData.surrenderDocPath || data.documents?.birthCertificate || data.documents?.surrenderProof || '';

            if ((!memAadhaarPath || !proofPath) && activeCustMob) {
                try {
                    const docListRes = await fetch(`/api/drafts/${encodeURIComponent(activeCustMob)}/documents-list`);
                    const docListJson = await docListRes.json();
                    if (docListJson && Array.isArray(docListJson.documents)) {
                        const foundAadh = docListJson.documents.find(d => d.type === 'memberAadhaar');
                        if (foundAadh && !memAadhaarPath) memAadhaarPath = foundAadh.previewUrl;
                        const foundProof = docListJson.documents.find(d => d.type === 'birthCertificate' || d.type === 'surrenderProof');
                        if (foundProof && !proofPath) proofPath = foundProof.previewUrl;
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
                const proofTitle = document.getElementById('editAddMemberProofTitle');
                if (proofTitle) {
                    proofTitle.innerText = sData.isChild ? '📄 குழந்தையின் பிறப்புச் சான்றிதழ்' : '📄 உறவுமுறை / நீக்கல் சான்று';
                }
                renderDocPreview(proofPath, 'editAddMemberProofPreview', 'editAddMemberProofPlaceholder', 'editAddMemberProofPdfBadge', 'editAddMemberProofStatus', 'editAddMemberProofViewBtn', sData.isChild ? 'பிறப்புச் சான்றிதழ் தேவை' : 'உறவுமுறை சான்று தேவை', 'editAddMemberProofDeleteBtn');
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
                fatherNameTam: memFatherTam,
                fatherNameEng: memFatherEng,
                dob: memDob,
                gender: memGender,
                aadhaarNo: memAadhaar
            };
            const updatedMember = {
                nameTam: memNameTam,
                nameEng: memNameEng,
                name: memNameEng || memNameTam,
                fatherNameTam: memFatherTam,
                fatherNameEng: memFatherEng,
                dob: memDob,
                gender: memGender,
                relationshipTam: memRel,
                relationship: memRel,
                aadhaarNumber: memAadhaar,
                docPath: sData.aadhaarDocPath || sData.docPath || ''
            };
            let existingMembers = (data && Array.isArray(data.members)) ? [...data.members] : [];
            if (existingMembers.length > 0) {
                const foundIdx = existingMembers.findIndex((m, idx) => idx > 0 && ((m.aadhaarNumber && m.aadhaarNumber === memAadhaar) || (m.nameEng && m.nameEng === memNameEng)));
                if (foundIdx !== -1) existingMembers[foundIdx] = { ...existingMembers[foundIdx], ...updatedMember };
                else existingMembers.push(updatedMember);
            } else {
                existingMembers = [updatedMember];
            }

            return {
                overrideUpdated: {
                    subService: 'ADD_MEMBER',
                    smartCardNumber: memCard,
                    rationCardNo: memCard,
                    fullNameTam: memNameTam,
                    fullNameEng: memNameEng,
                    subServiceData: updatedSubServiceData,
                    members: existingMembers
                }
            };
        },
        sidebar: {
            headTitle: '👤 குடும்பத் தலைவர் விவரங்கள்',
            boxId: 'sidebarAddMemberBox',
            showMembersContainer: true
        },
        populateSidebar: function (a, subData, { setVal, activeCustMob }) {
            if (!subData) return false;
            const addName = subData.memberNameTam ? (subData.memberNameEng ? `${subData.memberNameTam} (${subData.memberNameEng})` : subData.memberNameTam) : (subData.memberName || '—');
            const addRel = subData.relationshipTam || subData.relationship || (subData.isChild ? 'மகன்/மகள்' : 'உறுப்பினர்');
            const addDob = subData.dob || '—';
            const addGender = subData.genderTam || subData.gender || '—';
            const addAadhaar = subData.aadhaarNo ? subData.aadhaarNo.replace(/(\d{4})/g, '$1 ').trim() : '—';
            const cleanAddMob = (a.mobileNumber && !/^walkin_/i.test(String(a.mobileNumber))) ? a.mobileNumber : ((activeCustMob && !/^walkin_/i.test(String(activeCustMob))) ? activeCustMob : '');
            const addMob = cleanAddMob ? `+91 ${cleanAddMob}` : '—';
            const addDoc = subData.isChild ? 'பிறப்புச் சான்றிதழ் (Birth Certificate)' : 'ஆதார் அட்டை (Aadhaar Card)';
            setVal('infoAddMemberName', addName);
            setVal('infoAddMemberRel', addRel);
            setVal('infoAddMemberDobGender', `${addDob} | ${addGender}`);
            setVal('infoAddMemberAadhaar', addAadhaar);
            setVal('infoAddMemberMobile', addMob);
            setVal('infoAddMemberDoc', `${addDoc} ✅`);
            return true;
        },
        validatePreSubmit: function () {
            return { valid: true };
        }
    };
}));
