// eSevaDraft Domain Module: edit_modal_manager.js

        function formatDocUrl(docPath) {
            if (typeof window.formatDocUrl === 'function' && window.formatDocUrl !== formatDocUrl) return window.formatDocUrl(docPath);
            if (!docPath || typeof docPath !== 'string') return '';
            if (docPath.startsWith('http://') || docPath.startsWith('https://') || docPath.startsWith('data:') || docPath.startsWith('/api/')) return docPath;
            const clean = docPath.replace(/\\/g, '/').replace(/^\/app\//, '');
            const upIdx = clean.toLowerCase().indexOf('uploads/');
            if (upIdx !== -1) return '/' + clean.substring(upIdx);
            const compIdx = clean.toLowerCase().indexOf('compressed/');
            if (compIdx !== -1) return '/' + clean.substring(compIdx);
            const stripped = clean.startsWith('/') ? clean.substring(1) : clean;
            return '/uploads/' + stripped;
        }
        window.formatDocUrl = window.formatDocUrl || formatDocUrl;

        function isPdfPath(docPath) {
            if (typeof window.isPdfPath === 'function' && window.isPdfPath !== isPdfPath) return window.isPdfPath(docPath);
            if (!docPath || typeof docPath !== 'string') return false;
            return docPath.toLowerCase().endsWith('.pdf') || docPath.includes('application/pdf');
        }
        window.isPdfPath = window.isPdfPath || isPdfPath;

        window.applyIncomePreset = function(prof, monthly) {
            const mInput = document.getElementById('editMonthlyIncome');
            const aInput = document.getElementById('editAnnualIncome');
            const oInput = document.getElementById('editOccupation');
            if (mInput) mInput.value = monthly;
            if (aInput) aInput.value = monthly * 12;
            if (oInput) oInput.value = prof;
        };

        window.collectEditIncomeMembers = function() {
            const listEl = document.getElementById('editIncomeMembersList');
            if (!listEl) return Array.isArray(window.currentCitizenData?.incomeMembers) ? window.currentCitizenData.incomeMembers : [];
            const rows = listEl.querySelectorAll('.edit-income-member-row');
            const out = [];
            rows.forEach((row) => {
                const rel = row.querySelector('.im-rel')?.value || 'Husband';
                const name = row.querySelector('.im-name')?.value?.trim() || '';
                const age = row.querySelector('.im-age')?.value?.trim() || '';
                const prof = row.querySelector('.im-prof')?.value?.trim() || 'கூலி வேலை';
                const mon = row.querySelector('.im-mon')?.value?.trim() || '0';
                if (name || rel) {
                    out.push({
                        name: name || rel,
                        nameEng: name || '',
                        nameTam: name || '',
                        relationship: rel,
                        age: age || '',
                        profession: prof,
                        monthlyIncome: mon || '0'
                    });
                }
            });
            return out;
        };

        window.renderEditIncomeMembersList = function(countVal, existingList = null) {
            const wrap = document.getElementById('editIncomeMembersWrap');
            const listEl = document.getElementById('editIncomeMembersList');
            if (!wrap || !listEl) return;
            const total = Math.max(1, parseInt(countVal || '1', 10) || 1);
            const needed = total - 1;
            if (needed <= 0) {
                wrap.style.display = 'none';
                listEl.innerHTML = '';
                return;
            }
            const prevDom = listEl.querySelectorAll('.edit-income-member-row').length > 0 ? window.collectEditIncomeMembers() : null;
            const source = Array.isArray(existingList) ? existingList : (prevDom || window.currentCitizenData?.incomeMembers || []);
            wrap.style.display = 'block';
            const relOpts = [
                { v: 'Husband', l: 'கணவர் (Husband)' },
                { v: 'Wife', l: 'மனைவி (Wife)' },
                { v: 'Son', l: 'மகன் (Son)' },
                { v: 'Daughter', l: 'மகள் (Daughter)' },
                { v: 'Father', l: 'தந்தை (Father)' },
                { v: 'Mother', l: 'தாய் (Mother)' },
                { v: 'Mother-in-law', l: 'மாமியார் (Mother-in-law)' },
                { v: 'Father-in-law', l: 'மாமனார் (Father-in-law)' }
            ];
            let html = '';
            for (let i = 0; i < needed; i++) {
                const m = source[i] || {};
                const relDef = m.relationship || ((window.currentCitizenData?.relationship === 'Husband' && i === 0) ? 'Husband' : 'Son');
                const safeName = (m.nameTam || m.nameEng || m.name || ((relDef === 'Husband' && i === 0) ? (window.currentCitizenData?.spouseNameEng || window.currentCitizenData?.fatherNameEng || '') : '')).replace(/"/g, '&quot;');
                const safeAge = String(m.age || '').replace(/"/g, '&quot;');
                const safeProf = String(m.profession || 'கூலி வேலை').replace(/"/g, '&quot;');
                const safeMon = String(m.monthlyIncome || '0').replace(/"/g, '&quot;');
                html += `
                    <div class="edit-income-member-row" style="display:grid;grid-template-columns:1.1fr 1.3fr 0.6fr 1.2fr 0.8fr;gap:6px;align-items:center;background:#f8fafc;padding:6px;border-radius:6px;border:1px solid #e2e8f0;">
                        <select class="im-rel" style="padding:5px;border:1px solid #cbd5e1;border-radius:5px;font-size:11.5px;">
                            ${relOpts.map(o => `<option value="${o.v}" ${relDef === o.v ? 'selected' : ''}>${o.l}</option>`).join('')}
                        </select>
                        <input type="text" class="im-name" value="${safeName}" placeholder="உறுப்பினர் பெயர்" style="padding:5px;border:1px solid #cbd5e1;border-radius:5px;font-size:11.5px;">
                        <input type="number" class="im-age" value="${safeAge}" placeholder="வயது" style="padding:5px;border:1px solid #cbd5e1;border-radius:5px;font-size:11.5px;">
                        <input type="text" class="im-prof" value="${safeProf}" placeholder="தொழில்" style="padding:5px;border:1px solid #cbd5e1;border-radius:5px;font-size:11.5px;">
                        <input type="number" class="im-mon" value="${safeMon}" placeholder="மாத ₹" style="padding:5px;border:1px solid #cbd5e1;border-radius:5px;font-size:11.5px;">
                    </div>
                `;
            }
            listEl.innerHTML = html;
        };

        function renderDocPreview(docPath, imgId, phId, pdfId, statusId, viewBtnId, defaultPrompt, deleteBtnId = null, forcedIsPdf = false) {
            if (typeof window.renderDocPreview === 'function' && window.renderDocPreview !== renderDocPreview) {
                return window.renderDocPreview(docPath, imgId, phId, pdfId, statusId, viewBtnId, defaultPrompt, deleteBtnId, forcedIsPdf);
            }
            const imgEl = document.getElementById(imgId);
            const phEl = document.getElementById(phId);
            const pdfEl = pdfId ? document.getElementById(pdfId) : null;
            const stEl = document.getElementById(statusId);
            const vbEl = viewBtnId ? document.getElementById(viewBtnId) : null;
            const delEl = deleteBtnId ? document.getElementById(deleteBtnId) : null;
            if (docPath) {
                const url = formatDocUrl(docPath);
                const isPdf = Boolean(forcedIsPdf) || isPdfPath(docPath) || isPdfPath(url);
                if (isPdf) {
                    const previewUrl = url + (url.includes('?') ? '&' : '?') + 'preview=1';
                    if (imgEl) {
                        imgEl.src = previewUrl;
                        imgEl.onload = () => {
                            imgEl.style.display = 'block';
                            if (pdfEl) pdfEl.style.display = 'none';
                            if (phEl) phEl.style.display = 'none';
                        };
                        imgEl.onerror = () => {
                            imgEl.style.display = 'none';
                            if (pdfEl) pdfEl.style.display = 'flex';
                            if (phEl) phEl.style.display = 'none';
                        };
                    } else if (pdfEl) {
                        pdfEl.style.display = 'flex';
                        if (phEl) phEl.style.display = 'none';
                    }
                } else {
                    if (imgEl) { imgEl.src = url; imgEl.style.display = 'block'; }
                    if (phEl) phEl.style.display = 'none';
                    if (pdfEl) pdfEl.style.display = 'none';
                }
                if (stEl) {
                    const pathStr = typeof docPath === 'object' ? (docPath?.path || docPath?.docPath || '') : String(docPath || '');
                    const isDualMerged = pathStr.includes('merged') || pathStr.includes('dual') || pathStr.includes('2in1') || url.includes('headAadhaar') || url.includes('smartCard');
                    if (isDualMerged && isPdf) {
                        stEl.innerText = '✅ 2-in-1 A4 PDF இணைக்கப்பட்டது';
                    } else {
                        const fname = pathStr.split('/').pop().split('\\').pop() || 'ஆவணம் இணைக்கப்பட்டது';
                        stEl.innerText = `✅ ${fname.length > 20 ? fname.substring(0, 18) + '...' : fname}`;
                    }
                    stEl.style.color = '#16a34a';
                }
                if (vbEl) { vbEl.href = url; vbEl.style.display = 'inline-flex'; }
                if (delEl) delEl.style.display = 'inline-flex';
            } else {
                if (imgEl) imgEl.style.display = 'none';
                if (phEl) phEl.style.display = 'block';
                if (pdfEl) pdfEl.style.display = 'none';
                if (stEl) { stEl.innerText = defaultPrompt; stEl.style.color = '#64748b'; }
                if (vbEl) vbEl.style.display = 'none';
                if (delEl) delEl.style.display = 'none';
            }
        }
        window.renderDocPreview = window.renderDocPreview || renderDocPreview;

        function updateDualSideButtonStates(docType, hasFront, hasBack) {
            let fBtn = null;
            let bBtn = null;
            if (docType === 'headAadhaar') {
                fBtn = document.getElementById('editHeadAadhaarFrontBtn');
                bBtn = document.getElementById('editHeadAadhaarBackBtn');
            } else if (docType === 'smartCard' || docType === 'rationCard') {
                fBtn = document.getElementById('editSmartCardFrontBtn');
                bBtn = document.getElementById('editSmartCardBackBtn');
            } else if (docType === 'memberAadhaar') {
                fBtn = document.getElementById('editAddMemberAadhaarFrontBtn');
                bBtn = document.getElementById('editAddMemberAadhaarBackBtn');
            }
            if (fBtn) {
                if (hasFront) {
                    fBtn.innerHTML = '<i class="fa-solid fa-check"></i> முன்பக்கம்';
                    fBtn.style.background = '#f0fdf4';
                    fBtn.style.borderColor = '#86efac';
                    fBtn.style.color = '#166534';
                    fBtn.title = 'முன்பக்கம் இணைக்கப்பட்டுள்ளது (மாற்ற கிளிக் செய்யவும்)';
                } else {
                    fBtn.innerHTML = '<i class="fa-solid fa-file-arrow-up"></i> முன்பக்கம்';
                    fBtn.style.background = '#eff6ff';
                    fBtn.style.borderColor = '#93c5fd';
                    fBtn.style.color = '#1d4ed8';
                    fBtn.title = 'முன்பக்கம் தேர்ந்தெடுக்கவும்';
                }
            }
            if (bBtn) {
                if (hasBack) {
                    bBtn.innerHTML = '<i class="fa-solid fa-check"></i> பின்பக்கம்';
                    bBtn.style.background = '#f0fdf4';
                    bBtn.style.borderColor = '#86efac';
                    bBtn.style.color = '#166534';
                    bBtn.title = 'பின்பக்கம் இணைக்கப்பட்டுள்ளது (மாற்ற கிளிக் செய்யவும்)';
                } else {
                    bBtn.innerHTML = '<i class="fa-solid fa-plus"></i> பின்பக்கம்';
                    bBtn.style.background = '#eef2ff';
                    bBtn.style.borderColor = '#a5b4fc';
                    bBtn.style.color = '#4338ca';
                    bBtn.title = 'பின்பக்கம் (2-in-1 ஆகத் தானாக இணைக்கப்படும்)';
                }
            }
        }
        window.updateDualSideButtonStates = updateDualSideButtonStates;

        let currentEditModalIsMasterProfile = false;
        window.forceMasterProfile = false;
        let originalEditingMobile = '';

        async function handleEditDocChosen(docType, event, memberIndex = 0) {
            const files = event.target.files ? Array.from(event.target.files) : [];
            if (files.length === 0) return;

            // If user selected 2 files at once (Front + Back) on a Front input, upload Front first then Back automatically!
            if (files.length >= 2 && !docType.endsWith('Back') && (docType === 'headAadhaar' || docType === 'smartCard' || docType === 'memberAadhaar' || docType === 'residenceProof')) {
                await uploadSingleEditDocFile(docType, files[0], memberIndex, false);
                await uploadSingleEditDocFile(`${docType}Back`, files[1], memberIndex, true);
                event.target.value = '';
                return;
            }

            await uploadSingleEditDocFile(docType, files[0], memberIndex, docType.endsWith('Back'));
            event.target.value = '';
        }

        async function uploadSingleEditDocFile(docType, file, memberIndex = 0, isSecondSide = false) {
            if (!file) return;
            const baseType = docType.replace(/(Front|Back)$/, '');
            const key = memberIndex > 0 ? `${docType}_${memberIndex}` : docType;
            pendingDocUploads[key] = { file, docType, memberIndex };

            const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

            let imgId = '';
            let phId = '';
            let pdfId = '';
            let statusId = '';
            let viewBtnId = '';
            let delBtnId = '';

            if (baseType === 'headPhoto') {
                imgId = 'editPhotoPreview';
                phId = 'editPhotoPlaceholder';
                statusId = 'editPhotoStatus';
                viewBtnId = 'editPhotoViewBtn';
                delBtnId = 'editPhotoDeleteBtn';
            } else if (baseType === 'headAadhaar') {
                imgId = 'editHeadAadhaarPreview';
                phId = 'editHeadAadhaarPlaceholder';
                pdfId = 'editHeadAadhaarPdfBadge';
                statusId = 'editHeadAadhaarStatus';
                viewBtnId = 'editHeadAadhaarViewBtn';
                delBtnId = 'editHeadAadhaarDeleteBtn';
            } else if (baseType === 'smartCard' || baseType === 'rationCard') {
                imgId = 'editSmartCardPreview';
                phId = 'editSmartCardPlaceholder';
                pdfId = 'editSmartCardPdfBadge';
                statusId = 'editSmartCardStatus';
                viewBtnId = 'editSmartCardViewBtn';
                delBtnId = 'editSmartCardDeleteBtn';
            } else if (baseType === 'residenceProof' || baseType === 'gasBook') {
                const isAddrMode = document.getElementById('editChangeAddressDocBoxesWrap')?.style.display === 'grid';
                imgId = isAddrMode ? 'editAddressProofPreview' : 'editResidencePreview';
                phId = isAddrMode ? 'editAddressProofPlaceholder' : 'editResidencePlaceholder';
                pdfId = isAddrMode ? 'editAddressProofPdfBadge' : 'editResidencePdfBadge';
                statusId = isAddrMode ? 'editAddressProofStatus' : 'editResidenceDocStatus';
                viewBtnId = isAddrMode ? 'editAddressProofViewBtn' : 'editResidenceViewBtn';
                delBtnId = isAddrMode ? 'editAddressProofDeleteBtn' : 'editResidenceDeleteBtn';
            } else if (baseType === 'memberAadhaar') {
                if (memberIndex === 0) {
                    imgId = 'editAddMemberAadhaarPreview';
                    phId = 'editAddMemberAadhaarPlaceholder';
                    pdfId = 'editAddMemberAadhaarPdfBadge';
                    statusId = 'editAddMemberAadhaarStatus';
                    viewBtnId = 'editAddMemberAadhaarViewBtn';
                    delBtnId = 'editAddMemberAadhaarDeleteBtn';
                } else {
                    imgId = `editMemberAadhaarPreview_${memberIndex}`;
                    phId = `editMemberAadhaarPlaceholder_${memberIndex}`;
                    pdfId = `editMemberAadhaarPdfBadge_${memberIndex}`;
                    statusId = `editMemberAadhaarStatus_${memberIndex}`;
                    viewBtnId = `editMemberAadhaarViewBtn_${memberIndex}`;
                }
            } else if (baseType === 'memberProof') {
                imgId = 'editAddMemberProofPreview';
                phId = 'editAddMemberProofPlaceholder';
                pdfId = 'editAddMemberProofPdfBadge';
                statusId = 'editAddMemberProofStatus';
                viewBtnId = 'editAddMemberProofViewBtn';
                delBtnId = 'editAddMemberProofDeleteBtn';
            } else if (baseType === 'removeProof') {
                imgId = 'editRemoveMemberProofPreview';
                phId = 'editRemoveMemberProofPlaceholder';
                pdfId = 'editRemoveMemberProofPdfBadge';
                statusId = 'editRemoveMemberProofStatus';
                viewBtnId = 'editRemoveMemberProofViewBtn';
                delBtnId = 'editRemoveMemberProofDeleteBtn';
            } else {
                imgId = `editDocPreview_${baseType}`;
                phId = `editDocPlaceholder_${baseType}`;
                pdfId = `editDocPdfBadge_${baseType}`;
                statusId = `editDocStatus_${baseType}`;
                viewBtnId = `editDocViewBtn_${baseType}`;
                delBtnId = `editDocDeleteBtn_${baseType}`;
            }

            const imgEl = imgId ? document.getElementById(imgId) : null;
            const phEl = phId ? document.getElementById(phId) : null;
            const pdfEl = pdfId ? document.getElementById(pdfId) : null;
            const stEl = statusId ? document.getElementById(statusId) : null;
            const vbEl = viewBtnId ? document.getElementById(viewBtnId) : null;
            const dbEl = delBtnId ? document.getElementById(delBtnId) : null;

            if (stEl) {
                stEl.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="color: #2563eb;"></i> ${isSecondSide ? 'பின்பக்கம் இணைக்கப்பட்டு விவரங்கள் படிக்கப்படுகின்றன...' : 'அரசு தரத்திற்கு மாற்றப்பட்டு விவரங்கள் படிக்கப்படுகின்றன...'}`;
                stEl.style.color = '#2563eb';
                stEl.style.fontWeight = '700';
            }

            // 1. Instant local preview
            if (isPdf) {
                if (imgEl) imgEl.style.display = 'none';
                if (phEl) phEl.style.display = 'none';
                if (pdfEl) pdfEl.style.display = 'flex';
                if (vbEl) {
                    const blobUrl = URL.createObjectURL(file);
                    vbEl.href = blobUrl;
                    vbEl.style.display = 'inline-flex';
                }
            } else {
                const reader = new FileReader();
                reader.onload = (e) => {
                    // If uploading back side of a dual-sided card, do not overwrite thumbnail with raw back image;
                    // Keep existing front or wait for server to return 2-in-1 merged preview!
                    if (!isSecondSide) {
                        if (imgEl) {
                            imgEl.src = e.target.result;
                            imgEl.style.display = 'block';
                        }
                        if (phEl) phEl.style.display = 'none';
                        if (pdfEl) pdfEl.style.display = 'none';
                        if (vbEl) {
                            vbEl.href = e.target.result;
                            vbEl.style.display = 'inline-flex';
                        }
                    }
                };
                reader.readAsDataURL(file);
            }
            if (dbEl) dbEl.style.display = 'inline-flex';

            // 2. Immediate auto-upload & size optimization to server/storage
            try {
                const enteredMob = (document.getElementById('editMobile')?.value || '').replace(/\D/g, '');
                const activeCustMob = originalEditingMobile || localStorage.getItem('eseva_active_customer_mobile') || (currentCitizenData && currentCitizenData.mobileNumber) || '';
                const targetMob = enteredMob || activeCustMob;
                const opUid = localStorage.getItem('eseva_operator_uid') || '';
                const isMobileChanged = Boolean(originalEditingMobile && enteredMob && enteredMob.length === 10 && originalEditingMobile !== enteredMob);

                const activeDraftId = (localStorage.getItem('eseva_active_draft_id') || '').trim();
                const fd = new FormData();
                fd.append('file', file);
                fd.append('docType', docType);
                fd.append('mobileNumber', targetMob);
                if (activeDraftId) fd.append('draftId', activeDraftId);
                if (isMobileChanged) {
                    fd.append('oldMobileNumber', originalEditingMobile);
                }
                if (memberIndex) {
                    fd.append('memberIndex', String(memberIndex));
                    const memProofTypeEl = document.getElementById(`editMemberDocType_${memberIndex}`);
                    if (memProofTypeEl && memProofTypeEl.value) {
                        fd.append('intendedProofType', memProofTypeEl.value);
                    }
                }

                const upRes = await fetch('/api/drafts/upload-document', {
                    method: 'POST',
                    headers: {
                        'x-session-mobile': targetMob,
                        'x-draft-id': activeDraftId,
                        ...(isMobileChanged ? { 'x-old-session-mobile': originalEditingMobile } : {}),
                        'x-operator-uid': opUid
                    },
                    body: fd
                });
                const upData = await upRes.json();
                if (upData.success) {
                    delete pendingDocUploads[key];
                    if (upData.citizenProfile) currentCitizenData = upData.citizenProfile;
                    const finalUrl = formatDocUrl(upData.relativeUrl || upData.filePath);
                    if (vbEl) {
                        vbEl.href = finalUrl;
                        vbEl.style.display = 'inline-flex';
                    }
                    const sizeText = upData.fileSizeKB ? ` (${upData.fileSizeKB} KB)` : '';
                    if (stEl) {
                        stEl.innerText = isSecondSide
                            ? `✅ முன்பக்கம் + பின்பக்கம் இணைக்கப்பட்டது${sizeText}`
                            : `✅ சேமிக்கப்பட்டது${sizeText}: ${file.name}`;
                        stEl.style.color = '#16a34a';
                        stEl.style.fontWeight = '700';
                    }
                    const isReturnedPdf = isPdfPath(upData.relativeUrl || upData.filePath);
                    const previewToLoad = upData.previewUrl ? formatDocUrl(upData.previewUrl) : (finalUrl + (finalUrl.includes('?') ? '&' : '?') + 'preview=1');
                    if (imgEl && (finalUrl || upData.previewUrl)) {
                        imgEl.src = previewToLoad + (previewToLoad.includes('?') ? '&' : '?') + 't=' + Date.now();
                        imgEl.onload = () => {
                            imgEl.style.display = 'block';
                            if (pdfEl) pdfEl.style.display = 'none';
                            if (phEl) phEl.style.display = 'none';
                        };
                        imgEl.onerror = () => {
                            if (isReturnedPdf) {
                                imgEl.style.display = 'none';
                                if (pdfEl) pdfEl.style.display = 'flex';
                            }
                        };
                    }
                    if (baseType === 'headAadhaar' || baseType === 'smartCard' || baseType === 'memberAadhaar') {
                        updateDualSideButtonStates(baseType, true, isSecondSide || Boolean(upData.citizenProfile?.documents?.[baseType + 'Back']));
                    }
                    if (upData.citizenProfile) {
                        syncEditModalInputsFromProfile(upData.citizenProfile, baseType, memberIndex);
                        updateSidebar({ citizenProfile: upData.citizenProfile });
                    }
                    fetchOperatorDrafts();
                } else {
                    delete pendingDocUploads[key];
                    if (stEl) {
                        stEl.innerText = `⚠️ ${upData.error || 'சேமிக்க முடியவில்லை'}`;
                        stEl.style.color = '#dc2626';
                        stEl.style.fontWeight = '700';
                    }
                    const inputEl = document.getElementById(`docUploadInput_${key}`);
                    if (inputEl) inputEl.value = '';
                    if (typeof showEsevaToast === 'function') {
                        showEsevaToast(upData.error || 'தவறான ஆவணம்! சேமிக்க முடியவில்லை', 'error');
                    } else if (window.showAppToast) {
                        window.showAppToast(upData.error || 'தவறான ஆவணம்! சேமிக்க முடியவில்லை', 'error');
                    }
                }
            } catch (err) {
                console.warn('Doc background upload fallback:', err);
                delete pendingDocUploads[key];
                if (stEl) {
                    stEl.innerText = `⚠️ ${err.message || 'பிழை ஏற்பட்டது'}`;
                    stEl.style.color = '#dc2626';
                }
            }
        }

        function syncEditModalInputsFromProfile(prof, docType, memberIndex = 0) {
            if (!prof || typeof prof !== 'object') return;
            const flash = (el) => {
                if (!el) return;
                el.style.transition = 'background-color 0.4s ease';
                const origBg = el.style.backgroundColor || '';
                el.style.backgroundColor = '#fef08a';
                setTimeout(() => { el.style.backgroundColor = origBg; }, 1200);
            };

            const setVal = (id, val) => {
                const el = document.getElementById(id);
                if (el && val !== undefined && val !== null && String(val).trim() !== '') {
                    if (el.value !== String(val)) {
                        el.value = String(val);
                        flash(el);
                    }
                }
            };

            if (docType === 'headAadhaar') {
                setVal('editNameTam', prof.fullNameTam);
                setVal('editNameEng', prof.fullNameEng);
                setVal('editFatherTam', prof.fatherNameTam);
                setVal('editFatherEng', prof.fatherNameEng);
                setVal('editDob', prof.headDob || prof.dob);
                if (prof.headGender) {
                    const gEl = document.getElementById('editGender');
                    if (gEl && gEl.value !== prof.headGender) {
                        gEl.value = prof.headGender;
                        flash(gEl);
                    }
                }
                if (prof.headAadhaar) {
                    setVal('editAadhaar', prof.headAadhaar.replace(/(\d{4})/g, '$1 ').trim());
                }
                setVal('editDoorNo', prof.doorNo);
                setVal('editStreetTam', prof.streetTam);
                setVal('editAreaTam', prof.areaTam);
                setVal('editPin', prof.pincode);
                setVal('editDistrict', prof.district);
                setVal('editTaluk', prof.taluk);
                setVal('editVillage', prof.village);
            } else if (docType === 'residenceProof' || docType === 'gasBook') {
                setVal('editDoorNo', prof.doorNo);
                setVal('editStreetTam', prof.streetTam);
                setVal('editAreaTam', prof.areaTam);
                setVal('editPin', prof.pincode);
                setVal('editDistrict', prof.district);
                setVal('editTaluk', prof.taluk);
                setVal('editVillage', prof.village);

                const gas = prof.gasDetails;
                if (gas && (gas.hasGas || gas.consumerNumber || gas.agencyName || gas.oilCompany || gas.gasBookPath)) {
                    const chk = document.getElementById('editHasGas');
                    if (chk) {
                        chk.checked = true;
                        if (typeof toggleGasFields === 'function') toggleGasFields(true);
                    }
                    const coEl = document.getElementById('editGasCompany');
                    if (coEl) {
                        const rawCo = `${gas.oilCompany || ''} ${gas.oilCompanyDisplay || ''} ${gas.agencyName || ''}`.toLowerCase();
                        let mappedCo = 'IOC';
                        if (/\bhp\b|hp\s*gas|hindustan|hpcl|\bhpc\b/.test(rawCo)) mappedCo = 'HPC';
                        else if (/bharat|bpcl|\bbpc\b/.test(rawCo)) mappedCo = 'BPC';
                        coEl.value = mappedCo;
                        flash(coEl);
                    }
                    setVal('editGasNo', gas.consumerNumber);
                    setVal('editGasAgency', gas.agencyName);
                    setVal('editGasCyl', gas.cylinders || '1');
                }
            } else if (docType === 'memberAadhaar') {
                const sData = prof.subServiceData || {};
                setVal('editAddMemberNameTam', sData.memberNameTam);
                setVal('editAddMemberNameEng', sData.memberNameEng || sData.memberName);
                setVal('editAddMemberFatherTam', sData.fatherNameTam);
                setVal('editAddMemberFatherEng', sData.fatherNameEng);
                setVal('editAddMemberDob', sData.dob);
                if (sData.gender) {
                    const gEl = document.getElementById('editAddMemberGender');
                    if (gEl) { gEl.value = sData.gender; flash(gEl); }
                }
                if (sData.aadhaarNo) {
                    setVal('editAddMemberAadhaar', sData.aadhaarNo.replace(/(\d{4})/g, '$1 ').trim());
                }

                if (memberIndex > 0 && Array.isArray(prof.members) && prof.members[memberIndex]) {
                    const m = prof.members[memberIndex];
                    const isBirthCert = m.docType === 'BIRTH_CERTIFICATE' || m.hasAadhaar === false;
                    const dtEl = document.getElementById(`editMemberDocType_${memberIndex}`);
                    if (dtEl) {
                        dtEl.value = isBirthCert ? 'BIRTH_CERTIFICATE' : 'AADHAAR_CARD';
                        flash(dtEl);
                    }
                    setVal(`editMemberNameTam_${memberIndex}`, m.nameTam);
                    setVal(`editMemberNameEng_${memberIndex}`, m.nameEng || m.name);
                    setVal(`editMemberDob_${memberIndex}`, m.dob);
                    if (m.gender) {
                        const mgEl = document.getElementById(`editMemberGender_${memberIndex}`);
                        if (mgEl) { mgEl.value = m.gender; flash(mgEl); }
                    }
                    const mAadhInput = document.getElementById(`editMemberAadhaar_${memberIndex}`);
                    if (mAadhInput) {
                        if (isBirthCert) {
                            mAadhInput.value = '';
                            mAadhInput.disabled = true;
                            mAadhInput.placeholder = 'பிறப்புச் சான்றிதழ் (ஆதார் தேவையில்லை)';
                        } else {
                            mAadhInput.disabled = false;
                            mAadhInput.placeholder = '1234 5678 9012';
                            if (m.aadhaarNumber) {
                                setVal(`editMemberAadhaar_${memberIndex}`, m.aadhaarNumber.replace(/(\d{4})/g, '$1 ').trim());
                            }
                        }
                    }
                }
            } else if (docType === 'smartCard' || docType === 'rationCard') {
                const cardNo = prof.smartCardNumber || prof.rationCardNo || '';
                setVal('editSmartCardNo', cardNo);
                setVal('editAddMemberCardNo', cardNo);
                setVal('editRemoveMemberCardNo', cardNo);
                setVal('editDoorNo', prof.doorNo);
                setVal('editStreetTam', prof.streetTam);
                setVal('editAreaTam', prof.areaTam);
                setVal('editPin', prof.pincode);
                setVal('editDistrict', prof.district);
                setVal('editTaluk', prof.taluk);
                setVal('editVillage', prof.village);
                if (Array.isArray(prof.smartCardMembers) && prof.smartCardMembers.length > 0 && currentCitizenData) {
                    currentCitizenData.smartCardMembers = prof.smartCardMembers;
                }
            } else {
                const syncPlugin = (window.ESEVA_PLUGINS && typeof window.ESEVA_PLUGINS.resolveServicePlugin === 'function')
                    ? window.ESEVA_PLUGINS.resolveServicePlugin(currentCitizenData || prof)
                    : null;
                if (typeof syncPlugin?.uiCartridge?.syncFromUpload === 'function') {
                    syncPlugin.uiCartridge.syncFromUpload(docType, prof, { setVal, flash });
                }
            }
        }
        window.syncEditModalInputsFromProfile = syncEditModalInputsFromProfile;

        async function handleEditDocDelete(docType, memberIndex = 0) {
            const confirmed = typeof showInAppConfirmModal === 'function'
                ? await showInAppConfirmModal('🗑️ ஆவணம் நீக்கவா?', 'இந்த ஆவணத்தை நிச்சயமாக நீக்க வேண்டுமா?', '🗑️ நீக்கு')
                : confirm('இந்த ஆவணத்தை நிச்சயமாக நீக்க வேண்டுமா? (Are you sure you want to delete this document?)');
            if (!confirmed) {
                return;
            }

            const activeCustMob = localStorage.getItem('eseva_active_customer_mobile') || (currentCitizenData && currentCitizenData.mobileNumber) || '';
            const key = memberIndex > 0 ? `${docType}_${memberIndex}` : docType;
            if (pendingDocUploads && pendingDocUploads[key]) {
                delete pendingDocUploads[key];
            }

            // 1. Immediately update UI to clear the preview
            if (docType === 'headPhoto') {
                renderDocPreview('', 'editPhotoPreview', 'editPhotoPlaceholder', null, 'editPhotoStatus', 'editPhotoViewBtn', 'பாஸ்போர்ட் புகைப்படம் தேவை', 'editPhotoDeleteBtn');
                const fin = document.getElementById('editPhotoFileInput');
                if (fin) fin.value = '';
                if (currentCitizenData) {
                    delete currentCitizenData.headPhotoPath;
                    delete currentCitizenData.profilePhoto;
                    delete currentCitizenData.headPhoto;
                    if (currentCitizenData.documents) {
                        delete currentCitizenData.documents.profilePhoto;
                        delete currentCitizenData.documents.headPhoto;
                    }
                    if (currentCitizenData.base64Docs) {
                        delete currentCitizenData.base64Docs.profilePhotoBase64;
                        delete currentCitizenData.base64Docs.profilePhotoName;
                        delete currentCitizenData.base64Docs.headPhotoBase64;
                        delete currentCitizenData.base64Docs.headPhotoName;
                    }
                    if (currentCitizenData.storageUrls) {
                        delete currentCitizenData.storageUrls.profilePhoto;
                        delete currentCitizenData.storageUrls.headPhoto;
                    }
                }
                if (pendingDocUploads) {
                    delete pendingDocUploads.profilePhoto;
                    delete pendingDocUploads.headPhoto;
                }
            } else if (docType === 'headAadhaar') {
                renderDocPreview('', 'editHeadAadhaarPreview', 'editHeadAadhaarPlaceholder', 'editHeadAadhaarPdfBadge', 'editHeadAadhaarStatus', 'editHeadAadhaarViewBtn', 'ஆதார் அட்டை தேவை', 'editHeadAadhaarDeleteBtn');
                updateDualSideButtonStates('headAadhaar', false, false);
                const fin = document.getElementById('editHeadAadhaarInput');
                if (fin) fin.value = '';
                const finBack = document.getElementById('editHeadAadhaarBackInput');
                if (finBack) finBack.value = '';
                if (currentCitizenData) {
                    delete currentCitizenData.headAadhaarDocPath;
                    if (currentCitizenData.members && currentCitizenData.members[0]) delete currentCitizenData.members[0].docPath;
                    if (currentCitizenData.documents) {
                        delete currentCitizenData.documents.headAadhaar;
                        delete currentCitizenData.documents.headAadhaarFront;
                        delete currentCitizenData.documents.headAadhaarBack;
                    }
                }
            } else if (docType === 'residenceProof') {
                renderDocPreview('', 'editResidencePreview', 'editResidencePlaceholder', 'editResidencePdfBadge', 'editResidenceDocStatus', 'editResidenceViewBtn', 'கேஸ் புக் / இருப்பிடம் தேவை', 'editResidenceDeleteBtn');
                renderDocPreview('', 'editAddressProofPreview', 'editAddressProofPlaceholder', 'editAddressProofPdfBadge', 'editAddressProofStatus', 'editAddressProofViewBtn', 'முகவரிச் சான்று தேவை', 'editAddressProofDeleteBtn');
                const fin = document.getElementById('editResidenceDocInput');
                if (fin) fin.value = '';
                const finAddr = document.getElementById('editAddressProofInput');
                if (finAddr) finAddr.value = '';
                if (currentCitizenData) {
                    if (currentCitizenData.gasDetails) delete currentCitizenData.gasDetails.gasBookPath;
                    if (currentCitizenData.residenceProof) delete currentCitizenData.residenceProof.docPath;
                    if (currentCitizenData.documents) {
                        delete currentCitizenData.documents.gasBook;
                        delete currentCitizenData.documents.residenceProof;
                    }
                }
            } else if (docType === 'smartCard' || docType === 'rationCard') {
                renderDocPreview('', 'editSmartCardPreview', 'editSmartCardPlaceholder', 'editSmartCardPdfBadge', 'editSmartCardStatus', 'editSmartCardViewBtn', 'ஸ்மார்ட் கார்டு தேவை', 'editSmartCardDeleteBtn');
                updateDualSideButtonStates('smartCard', false, false);
                const fin = document.getElementById('editSmartCardInput');
                if (fin) fin.value = '';
                const finBack = document.getElementById('editSmartCardBackInput');
                if (finBack) finBack.value = '';
                if (currentCitizenData) {
                    delete currentCitizenData.smartCardDocPath;
                    delete currentCitizenData.rationCardDocPath;
                    if (currentCitizenData.documents) {
                        delete currentCitizenData.documents.smartCard;
                        delete currentCitizenData.documents.smartCardFront;
                        delete currentCitizenData.documents.smartCardBack;
                        delete currentCitizenData.documents.rationCard;
                    }
                }
            } else if (docType === 'memberAadhaar') {
                if (memberIndex === 0) {
                    renderDocPreview('', 'editAddMemberAadhaarPreview', 'editAddMemberAadhaarPlaceholder', 'editAddMemberAadhaarPdfBadge', 'editAddMemberAadhaarStatus', 'editAddMemberAadhaarViewBtn', 'உறுப்பினர் ஆதார் அட்டை தேவை', 'editAddMemberAadhaarDeleteBtn');
                    updateDualSideButtonStates('memberAadhaar', false, false);
                    const fin = document.getElementById('editAddMemberAadhaarInput');
                    if (fin) fin.value = '';
                    const finBack = document.getElementById('editAddMemberAadhaarBackInput');
                    if (finBack) finBack.value = '';
                    if (currentCitizenData && currentCitizenData.subServiceData) {
                        delete currentCitizenData.subServiceData.docPath;
                        delete currentCitizenData.subServiceData.memberDocPath;
                        if (currentCitizenData.documents) {
                            delete currentCitizenData.documents.memberAadhaar;
                            delete currentCitizenData.documents.memberAadhaarFront;
                            delete currentCitizenData.documents.memberAadhaarBack;
                        }
                    }
                } else {
                    const imgEl = document.getElementById(`editMemberAadhaarPreview_${memberIndex}`);
                    const phEl = document.getElementById(`editMemberAadhaarPlaceholder_${memberIndex}`);
                    const pdfEl = document.getElementById(`editMemberAadhaarPdfBadge_${memberIndex}`);
                    const stEl = document.getElementById(`editMemberAadhaarStatus_${memberIndex}`);
                    const vbEl = document.getElementById(`editMemberAadhaarViewBtn_${memberIndex}`);
                    if (imgEl) imgEl.style.display = 'none';
                    if (phEl) phEl.style.display = 'block';
                    if (pdfEl) pdfEl.style.display = 'none';
                    if (stEl) { stEl.innerText = 'ஆதார் அட்டை தேவை'; stEl.style.color = '#64748b'; stEl.style.fontWeight = 'normal'; }
                    if (vbEl) vbEl.style.display = 'none';
                    if (currentCitizenData && currentCitizenData.members && currentCitizenData.members[memberIndex]) {
                        delete currentCitizenData.members[memberIndex].docPath;
                        delete currentCitizenData.members[memberIndex].birthCertificatePath;
                        delete currentCitizenData.members[memberIndex].proofType;
                    }
                    if (currentCitizenData && currentCitizenData.documents) {
                        delete currentCitizenData.documents[`memberDoc_${memberIndex}`];
                        delete currentCitizenData.documents[`memberAadhaar${memberIndex - 1}`];
                    }
                }
            } else if (docType === 'memberProof') {
                renderDocPreview('', 'editAddMemberProofPreview', 'editAddMemberProofPlaceholder', 'editAddMemberProofPdfBadge', 'editAddMemberProofStatus', 'editAddMemberProofViewBtn', 'சான்றிதழ் ஆவணம் தேவை', 'editAddMemberProofDeleteBtn');
                const fin = document.getElementById('editAddMemberProofInput');
                if (fin) fin.value = '';
                if (currentCitizenData && currentCitizenData.subServiceData) {
                    delete currentCitizenData.subServiceData.proofDocPath;
                }
            } else if (docType === 'removeProof') {
                renderDocPreview('', 'editRemoveMemberProofPreview', 'editRemoveMemberProofPlaceholder', 'editRemoveMemberProofPdfBadge', 'editRemoveMemberProofStatus', 'editRemoveMemberProofViewBtn', 'நீக்கல் சான்றிதழ் தேவை', 'editRemoveMemberProofDeleteBtn');
                const fin = document.getElementById('editRemoveMemberProofInput');
                if (fin) fin.value = '';
                if (currentCitizenData && currentCitizenData.subServiceData) {
                    delete currentCitizenData.subServiceData.deathCertDocPath;
                }
            } else {
                renderDocPreview('', `editDocPreview_${docType}`, `editDocPlaceholder_${docType}`, `editDocPdfBadge_${docType}`, `editDocStatus_${docType}`, `editDocViewBtn_${docType}`, 'ஆவணம் தேவை', `editDocDeleteBtn_${docType}`);
                const fin = document.getElementById(`editUniversalDocInput_${docType}`);
                if (fin) fin.value = '';
                if (currentCitizenData) {
                    if (currentCitizenData.documents) delete currentCitizenData.documents[docType];
                    if (currentCitizenData[docType]) delete currentCitizenData[docType];
                    if (docType === 'communityProof' || docType === 'communityCertificate' || docType === 'familyCommunityProof') {
                        delete currentCitizenData.communityProof;
                        delete currentCitizenData.communityCertificatePath;
                        delete currentCitizenData.familyCommunityProofPath;
                        if (currentCitizenData.documents) {
                            delete currentCitizenData.documents.communityProof;
                            delete currentCitizenData.documents.communityCertificate;
                            delete currentCitizenData.documents.familyCommunityProof;
                        }
                        if (currentCitizenData.base64Docs) {
                            delete currentCitizenData.base64Docs.communityProofBase64;
                            delete currentCitizenData.base64Docs.communityProofName;
                            delete currentCitizenData.base64Docs.familyCommunityProofBase64;
                            delete currentCitizenData.base64Docs.familyCommunityProofName;
                            delete currentCitizenData.base64Docs.communityCertificateBase64;
                            delete currentCitizenData.base64Docs.communityCertificateName;
                        }
                        if (currentCitizenData.storageUrls) {
                            delete currentCitizenData.storageUrls.communityProof;
                            delete currentCitizenData.storageUrls.communityCertificate;
                            delete currentCitizenData.storageUrls.familyCommunityProof;
                        }
                        if (pendingDocUploads) {
                            delete pendingDocUploads.communityProof;
                            delete pendingDocUploads.communityCertificate;
                            delete pendingDocUploads.familyCommunityProof;
                        }
                    }
                }
            }

            // 2. Call backend to delete document from draft & disk
            const activeDraftId = (localStorage.getItem('eseva_active_draft_id') || '').trim();
            if (activeCustMob || activeDraftId) {
                try {
                    const res = await fetch('/api/drafts/delete-document', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-session-mobile': activeCustMob,
                            'x-draft-id': activeDraftId
                        },
                        body: JSON.stringify({ mobileNumber: activeCustMob, draftId: activeDraftId || undefined, docType, memberIndex })
                    });
                    const d = await res.json();
                    if (d.success) {
                        if (typeof showEsevaToast === 'function') {
                            showEsevaToast('🗑️ ஆவணம் வெற்றிகரமாக நீக்கப்பட்டது!', 'success');
                        }
                        if (typeof clearCustomerDocCache === 'function') clearCustomerDocCache(activeDraftId || activeCustMob);
                        if (typeof resetSidebarDocsCache === 'function') resetSidebarDocsCache();
                        if (typeof fetchSidebarDocuments === 'function') await fetchSidebarDocuments(activeDraftId || activeCustMob);
                        if (typeof updateSidebar === 'function') updateSidebar({ citizenProfile: d.citizenProfile || currentCitizenData });
                        if (typeof fetchOperatorDrafts === 'function') fetchOperatorDrafts();
                        if (d.chatHistory && typeof renderMessages === 'function') {
                            renderMessages(d.chatHistory, true);
                        } else {
                            try {
                                const chatRes = await fetch(`/api/chat/history?mobile=${encodeURIComponent(activeCustMob)}${activeDraftId ? `&draftId=${encodeURIComponent(activeDraftId)}` : ''}`);
                                const chatData = await chatRes.json();
                                if (chatData && chatData.chatHistory && typeof renderMessages === 'function') {
                                    renderMessages(chatData.chatHistory, true);
                                }
                            } catch (_) {}
                        }
                    }
                } catch (e) {
                    console.warn('Failed to delete doc on server:', e);
                }
            }
        }
        window.handleEditDocDelete = handleEditDocDelete;


        async function openEditModal(targetMobile, forceMasterProfile = false) {
            const modalEl = document.getElementById('editModal');
            if (modalEl) modalEl.style.display = 'flex'; // Instantly display modal to eliminate any lag or unresponsive click perception!
            try {
                currentEditModalIsMasterProfile = Boolean(forceMasterProfile);
                window.forceMasterProfile = currentEditModalIsMasterProfile;
                const rawTargetKey = targetMobile ? String(targetMobile).trim() : '';
                const targetIsDraftId = /^[0-9]{10}_[a-z0-9_-]+$/i.test(rawTargetKey);
                if (rawTargetKey) {
                    const cleanMob = targetIsDraftId ? rawTargetKey.split('_')[0] : rawTargetKey.replace(/\D/g, '').slice(-10);
                    if (cleanMob) localStorage.setItem('eseva_active_customer_mobile', cleanMob);
                    if (targetIsDraftId) localStorage.setItem('eseva_active_draft_id', rawTargetKey);
                }
                let data = currentCitizenData || {};
                const activeDraftKey = targetIsDraftId ? rawTargetKey : ((rawTargetKey ? rawTargetKey.replace(/\D/g, '').slice(-10) : '') || localStorage.getItem('eseva_active_draft_id') || localStorage.getItem('eseva_active_customer_mobile') || data.mobileNumber || '');
                const activeCustMob = targetIsDraftId ? rawTargetKey.split('_')[0] : ((rawTargetKey ? rawTargetKey.replace(/\D/g, '').slice(-10) : '') || localStorage.getItem('eseva_active_customer_mobile') || data.mobileNumber || '');
                originalEditingMobile = activeCustMob;

            // Only pull disk draft when explicitly opening a saved draft from Drafts Desk (targetMobile passed)
            // NEVER overwrite an active Pure Fresh chat session with an old saved customer draft!
            if (activeDraftKey && targetMobile) {
                try {
                    const opUidEdit = localStorage.getItem('eseva_operator_uid') || '';
                    const dRes = await fetch(`/api/drafts/${encodeURIComponent(activeDraftKey)}`, {
                        headers: opUidEdit ? { 'x-operator-uid': opUidEdit } : {}
                    });
                    const dJson = await dRes.json();
                    if (dJson && dJson.draft && dJson.draft.citizenProfile) {
                        data = Object.assign({}, dJson.draft, dJson.draft.citizenProfile, {
                            service: dJson.draft.service || data.service,
                            serviceId: dJson.draft.serviceId || data.serviceId,
                            subService: dJson.draft.subService || dJson.draft.citizenProfile?.subService || data.subService,
                            targetService: dJson.draft.targetService || dJson.draft.citizenProfile?.targetService || data.targetService,
                            intakeState: dJson.draft.intakeState || dJson.draft.citizenProfile?.intakeState || data.intakeState,
                            subServiceData: dJson.draft.subServiceData || dJson.draft.citizenProfile?.subServiceData || data.subServiceData,
                            canNumber: dJson.draft.canNumber || dJson.draft.citizenProfile?.canNumber || data.canNumber,
                            caste: dJson.draft.citizenProfile?.caste || dJson.draft.caste || data.caste,
                            community: dJson.draft.citizenProfile?.community || dJson.draft.community || data.community,
                            headPhotoPath: dJson.draft.citizenProfile.headPhotoPath || dJson.draft.documents?.profilePhoto || data.headPhotoPath,
                            members: dJson.draft.citizenProfile.members || data.members,
                            documents: dJson.draft.documents || data.documents
                        });
                        currentCitizenData = data;
                        if (typeof updateSidebar === 'function') {
                            updateSidebar({ citizenProfile: data, documents: dJson.draft.documents });
                        }
                    }
                } catch (e) {
                    console.warn('Failed to load draft for edit modal:', e);
                }
            }

            const mob = (data.mobileNumber && !data.mobileNumber.startsWith('walkin_')) ? data.mobileNumber : (activeCustMob && !activeCustMob.startsWith('walkin_') ? activeCustMob : '');
            const editMobEl = document.getElementById('editMobile');
            if (editMobEl) editMobEl.value = mob;

            pendingDocUploads = {};

            // Authoritative A-to-Z Service Plugin + Cartridge Resolution (Zero cross-service guesswork)
            const rawExplicitSub = String(data.subService || '').toUpperCase();
            const localActiveSvc = rawExplicitSub || String(data.targetService || localStorage.getItem('eseva_active_service') || window.pendingSelectedService || window.lastSubService || '').toUpperCase();
            const sData = data.subServiceData || window.lastSubServiceData || {};

            const resolvedPlugin = (window.ESEVA_PLUGINS && typeof window.ESEVA_PLUGINS.resolveServicePlugin === 'function')
                ? window.ESEVA_PLUGINS.resolveServicePlugin(data, { localActiveSvc })
                : null;
            const defaultNewCardPlugin = window.ESEVA_PLUGINS?.getPluginById ? window.ESEVA_PLUGINS.getPluginById('TNPDS_NEW_CARD') : null;
            const activePlugin = forceMasterProfile ? null : (resolvedPlugin || defaultNewCardPlugin);
            const modalCfg = activePlugin?.editModal || {};
            const hasActiveSub = Boolean(resolvedPlugin && resolvedPlugin.id !== 'TNPDS_NEW_CARD');

            const titleEl = document.getElementById('editModalTitle');
            const subTitleEl = document.getElementById('editModalSubtitle');
            const btnMaster = document.getElementById('btnSwitchToMasterProfile');
            const btnSubSvc = document.getElementById('btnSwitchToSubService');
            const submitBtn = document.getElementById('btnSubmitFromEditModal');

            if (forceMasterProfile) {
                if (titleEl) titleEl.innerHTML = '👤 விண்ணப்ப விவரங்கள் (Application Details)';
                if (subTitleEl) subTitleEl.innerText = 'வாடிக்கையாளரின் நிரந்தர சுயவிவரம் மற்றும் அனைத்து அசல் ஆவணங்கள்';
                if (btnMaster) btnMaster.style.display = 'none';
                if (btnSubSvc) btnSubSvc.style.display = hasActiveSub ? 'inline-flex' : 'none';
                if (submitBtn) {
                    submitBtn.innerHTML = (!rawExplicitSub && !hasActiveSub)
                        ? '<i class="fa-solid fa-floppy-disk"></i> 💾 மாற்றங்களைச் சேமி (Save Changes)'
                        : '<i class="fa-solid fa-play"></i> 🚀 அரசு போர்ட்டலில் சமர்ப்பி (Submit Application)';
                }
            } else {
                if (titleEl && modalCfg.title) titleEl.innerHTML = modalCfg.title;
                if (subTitleEl && modalCfg.subtitle) subTitleEl.innerText = modalCfg.subtitle;
                if (btnMaster) btnMaster.style.display = modalCfg.showMasterButton ? 'inline-flex' : 'none';
                if (btnSubSvc) btnSubSvc.style.display = 'none';
                if (submitBtn) submitBtn.innerHTML = modalCfg.submitButtonHtml || '<i class="fa-solid fa-play"></i> 🚀 அரசு போர்ட்டலில் சமர்ப்பி (Submit Application)';
            }

            const wrapMode = forceMasterProfile ? 'newCard' : (modalCfg.customWrapMode || 'newCard');
            const setWrap = (id, displayVal) => {
                const el = document.getElementById(id);
                if (el) el.style.display = displayVal;
            };
            setWrap('editNewCardDocBoxesWrap', wrapMode === 'newCard' ? 'grid' : 'none');
            setWrap('editAddMemberDocBoxesWrap', wrapMode === 'addMember' ? 'grid' : 'none');
            setWrap('editRemoveMemberDocBoxesWrap', wrapMode === 'removeMember' ? 'grid' : 'none');
            setWrap('editChangeAddressDocBoxesWrap', wrapMode === 'changeAddress' ? 'grid' : 'none');
            setWrap('editNewCardFieldsWrap', wrapMode === 'newCard' ? 'contents' : 'none');
            setWrap('editAddMemberFieldsWrap', wrapMode === 'addMember' ? 'grid' : 'none');
            setWrap('editRemoveMemberFieldsWrap', wrapMode === 'removeMember' ? 'grid' : 'none');
            setWrap('editChangeAddressFieldsWrap', wrapMode === 'changeAddress' ? 'grid' : 'none');
            setWrap('editUpdateMobileFieldsWrap', wrapMode === 'updateMobile' ? 'grid' : 'none');
            const isRationFieldsVisible = (wrapMode === 'newCard') && (forceMasterProfile || Boolean(modalCfg.showGasToggle));
            setWrap('editRationFieldsWrap', isRationFieldsVisible ? 'contents' : 'none');

            if (!forceMasterProfile && activePlugin?.uiCartridge && typeof activePlugin.uiCartridge.renderCustomView === 'function') {
                const handled = await activePlugin.uiCartridge.renderCustomView({
                    data,
                    sData,
                    activeCustMob,
                    renderDocPreview,
                    updateDualSideButtonStates
                });
                if (handled) {
                    document.getElementById('editModal').style.display = 'flex';
                    return;
                }
            }

            // Custom sub-service layouts handled above by activePlugin.uiCartridge.renderCustomView

            // Physical disk document verification: single source of truth from backend documents-list
            let verifiedPhysicalDocs = [];
            const docsTargetKey = activeDraftKey || activeCustMob;
            if (docsTargetKey) {
                try {
                    const docListRes = await fetch(`/api/drafts/${encodeURIComponent(docsTargetKey)}/documents-list`);
                    const docListJson = await docListRes.json();
                    if (docListJson && docListJson.success && Array.isArray(docListJson.documents)) {
                        verifiedPhysicalDocs = docListJson.documents;
                    }
                } catch (e) {
                    console.warn('Failed to fetch verified docs list:', e);
                }
            }
            const getVerifiedDoc = (type) => verifiedPhysicalDocs.find(d => d.type === type);

            const isRationHead = !forceMasterProfile && Boolean(modalCfg.isRationHead);
            const photoLabelEl = document.getElementById('editPhotoLabel');
            if (photoLabelEl) {
                photoLabelEl.innerHTML = isRationHead ? '📸 குடும்பத் தலைவர் புகைப்படம்' : '📸 விண்ணப்பதாரர் புகைப்படம் (Applicant Photo)';
            }
            const headAadhLabelEl = document.getElementById('editHeadAadhaarLabel');
            if (headAadhLabelEl) {
                headAadhLabelEl.innerHTML = isRationHead ? '🪪 குடும்பத் தலைவர் ஆதார் அட்டை' : '🪪 விண்ணப்பதாரர் ஆதார் அட்டை (Applicant Aadhaar)';
            }
            const resLabelEl = document.getElementById('editResidenceLabel');
            if (resLabelEl) {
                resLabelEl.innerHTML = isRationHead ? '🔥 கேஸ் புக் / இருப்பிடச் சான்று' : '🏠 இருப்பிடச் சான்று / முகவரி ஆவணம் (Residence Proof)';
            }

            const gasToggleWrap = document.getElementById('editGasToggleWrap');
            if (gasToggleWrap) {
                gasToggleWrap.style.display = (forceMasterProfile || modalCfg.showGasToggle) ? 'block' : 'none';
            }
            const gasFieldsWrap = document.getElementById('gasFieldsWrap');
            if (gasFieldsWrap && !forceMasterProfile && !modalCfg.showGasToggle) {
                gasFieldsWrap.style.display = 'none';
            }

            // Service-Scoped Document Boxes Visibility Control (Pure Cartridge Schema)
            const photoDocBox = document.getElementById('editPhotoDocBox');
            const headAadhaarDocBox = document.getElementById('editHeadAadhaarDocBox');
            const residenceDocBox = document.getElementById('editResidenceDocBox');
            const smartCardDocBox = document.getElementById('editSmartCardBox');
            const universalDocsContainer = document.getElementById('editUniversalDocsContainer');
            const membersAadhaarContainer = document.getElementById('editMembersAadhaarContainer');

            if (forceMasterProfile) {
                if (photoDocBox) photoDocBox.style.display = 'flex';
                if (headAadhaarDocBox) headAadhaarDocBox.style.display = 'flex';
                const hasResidenceOnRecord = Boolean(getVerifiedDoc('residenceProof') || getVerifiedDoc('gasBook') || data.documents?.residenceProof || data.documents?.gasBook || data.gasDetails?.consumerNumber);
                if (residenceDocBox) residenceDocBox.style.display = hasResidenceOnRecord ? 'flex' : 'none';
                const hasSmartCardOnRecord = Boolean(getVerifiedDoc('smartCard') || getVerifiedDoc('rationCard') || data.documents?.smartCard || data.smartCardNumber || data.rationCardNo);
                if (smartCardDocBox) smartCardDocBox.style.display = hasSmartCardOnRecord ? 'flex' : 'none';
                if (universalDocsContainer) universalDocsContainer.style.display = 'grid';
                if (membersAadhaarContainer) membersAadhaarContainer.style.display = (data.members && data.members.length > 1) ? 'flex' : 'none';
            } else {
                const db = modalCfg.docBoxes || {};
                if (photoDocBox) photoDocBox.style.display = db.photo === false ? 'none' : 'flex';
                if (headAadhaarDocBox) headAadhaarDocBox.style.display = db.headAadhaar === false ? 'none' : 'flex';
                if (residenceDocBox) residenceDocBox.style.display = db.residence ? 'flex' : 'none';
                if (smartCardDocBox) smartCardDocBox.style.display = db.smartCard ? 'flex' : 'none';
                if (universalDocsContainer) universalDocsContainer.style.display = db.universalDocs ? 'grid' : 'none';
                if (membersAadhaarContainer) membersAadhaarContainer.style.display = db.membersAadhaar ? 'flex' : 'none';
            }

            // Service-Scoped Form Fields Visibility Control (Pure Cartridge Schema)
            const fwMap = {
                editCommunityFieldsWrap: ['community', 'grid'],
                editIncomeFieldsWrap: ['income', 'grid'],
                editResidenceFieldsWrap: ['residence', 'grid'],
                editFirstGraduateFieldsWrap: ['firstGraduate', 'grid'],
                editObcFieldsWrap: ['obc', 'grid'],
                editLegalHeirFieldsWrap: ['legalHeir', 'grid'],
                editWidowFieldsWrap: ['widow', 'grid'],
                editRationFieldsWrap: ['ration', 'contents'],
                editSmartCardNoWrap: ['smartCardNo', 'block'],
                editCanNumberWrap: ['canNo', 'block']
            };
            const fwCfg = modalCfg.fieldWraps || {};
            for (const [elId, [key, visDisplay]] of Object.entries(fwMap)) {
                const el = document.getElementById(elId);
                if (el) {
                    el.style.display = (forceMasterProfile || fwCfg[key]) ? visDisplay : 'none';
                }
            }

            // 1. Photo (Strict Physical Disk Verification)
            const foundPhoto = getVerifiedDoc('profilePhoto') || getVerifiedDoc('headPhoto');
            renderDocPreview(foundPhoto ? foundPhoto.previewUrl : '', 'editPhotoPreview', 'editPhotoPlaceholder', null, 'editPhotoStatus', 'editPhotoViewBtn', 'பாஸ்போர்ட் புகைப்படம் தேவை', 'editPhotoDeleteBtn', foundPhoto ? foundPhoto.isPdf : false);

            // 2. Aadhaar (Strict Physical Disk Verification)
            const dMap = Object.assign({}, currentCitizenData?.documents || {}, data?.documents || {});
            const foundHeadAadh = getVerifiedDoc('headAadhaar');
            const headAadhFallbackPath = dMap.headAadhaar || data?.headAadhaarDocPath || currentCitizenData?.headAadhaarDocPath || data?.members?.[0]?.docPath || dMap.headAadhaarFront;
            const fallbackAadhUrl = headAadhFallbackPath ? `/api/drafts/${encodeURIComponent(activeCustMob)}/doc/headAadhaar` : '';
            const headAadhUrl = foundHeadAadh ? foundHeadAadh.previewUrl : fallbackAadhUrl;
            const headAadhIsPdf = foundHeadAadh ? foundHeadAadh.isPdf : Boolean(String(headAadhFallbackPath || '').toLowerCase().endsWith('.pdf'));
            renderDocPreview(headAadhUrl, 'editHeadAadhaarPreview', 'editHeadAadhaarPlaceholder', 'editHeadAadhaarPdfBadge', 'editHeadAadhaarStatus', 'editHeadAadhaarViewBtn', 'ஆதார் அட்டை தேவை', 'editHeadAadhaarDeleteBtn', headAadhIsPdf);
            const aadhStr = String(foundHeadAadh ? (foundHeadAadh.previewUrl || foundHeadAadh.path || '') : (headAadhFallbackPath || ''));
            const hasAadhBack = Boolean(dMap.headAadhaarBack || aadhStr.includes('merged') || aadhStr.includes('dual') || aadhStr.includes('2in1') || aadhStr.endsWith('.pdf'));
            const hasAadhFront = Boolean(foundHeadAadh || dMap.headAadhaarFront || dMap.headAadhaar || data?.headAadhaarDocPath || currentCitizenData?.headAadhaarDocPath || data?.members?.[0]?.docPath);
            updateDualSideButtonStates('headAadhaar', hasAadhFront, hasAadhBack);

            // 3. Residence Proof / Gas Book (Strict Physical Disk Verification)
            const foundResidence = getVerifiedDoc('residenceProof') || getVerifiedDoc('gasBook');
            const fallbackResUrl = (dMap.residenceProof || dMap.gasBook || currentCitizenData?.residenceProof?.docPath) ? `/api/drafts/${encodeURIComponent(activeCustMob)}/doc/residenceProof` : '';
            renderDocPreview(foundResidence ? foundResidence.previewUrl : fallbackResUrl, 'editResidencePreview', 'editResidencePlaceholder', 'editResidencePdfBadge', 'editResidenceDocStatus', 'editResidenceViewBtn', 'கேஸ் புக் / இருப்பிடம் தேவை', 'editResidenceDeleteBtn', foundResidence ? foundResidence.isPdf : false);

            // 4. Smart Ration Card (Strict Physical Disk Verification)
            const foundSmartCard = getVerifiedDoc('smartCard') || getVerifiedDoc('rationCard');
            const fallbackScUrl = (dMap.smartCard || dMap.rationCard || currentCitizenData?.smartCardDocPath) ? `/api/drafts/${encodeURIComponent(activeCustMob)}/doc/smartCard` : '';
            const scUrl = foundSmartCard ? foundSmartCard.previewUrl : fallbackScUrl;
            const scIsPdf = foundSmartCard ? foundSmartCard.isPdf : Boolean(String(dMap.smartCard || currentCitizenData?.smartCardDocPath || '').toLowerCase().endsWith('.pdf'));
            renderDocPreview(scUrl, 'editSmartCardPreview', 'editSmartCardPlaceholder', 'editSmartCardPdfBadge', 'editSmartCardStatus', 'editSmartCardViewBtn', 'ஸ்மார்ட் கார்டு தேவை', 'editSmartCardDeleteBtn', scIsPdf);
            const scStr = String(foundSmartCard ? (foundSmartCard.previewUrl || foundSmartCard.path || '') : (dMap.smartCard || currentCitizenData?.smartCardDocPath || ''));
            const hasScBack = Boolean(dMap.smartCardBack || scStr.includes('merged') || scStr.includes('dual') || scStr.includes('2in1') || scStr.endsWith('.pdf'));
            const hasScFront = Boolean(foundSmartCard || dMap.smartCardFront || dMap.smartCard || currentCitizenData?.smartCardDocPath);
            updateDualSideButtonStates('smartCard', hasScFront, hasScBack);

            // 5. Universal / Dynamic Additional Documents (Declared purely by active UI Cartridge)
            const universalContainer = document.getElementById('editUniversalDocsContainer');
            if (universalContainer) {
                universalContainer.innerHTML = '';
                const dynamicDocTypesToShow = forceMasterProfile ? [] : [...(modalCfg.dynamicDocs || [])];

                if (forceMasterProfile) {
                    const standardTypes = new Set(['profilePhoto', 'headPhoto', 'headAadhaar', 'residenceProof', 'gasBook', 'smartCard', 'rationCard', 'applicationPdf']);
                    for (const vDoc of verifiedPhysicalDocs) {
                        if (!standardTypes.has(vDoc.type) && !vDoc.type.startsWith('memberAadhaar')) {
                            if (!dynamicDocTypesToShow.some(d => d.type === vDoc.type)) {
                                dynamicDocTypesToShow.push({
                                    type: vDoc.type,
                                    title: vDoc.title || `📄 ஆவணம் (${vDoc.type})`,
                                    titleEng: vDoc.titleEng || vDoc.type,
                                    icon: vDoc.icon || 'fa-file-lines',
                                    defaultPrompt: `${vDoc.title || vDoc.type} தேவை`
                                });
                            }
                        }
                    }
                }

                for (const dMeta of dynamicDocTypesToShow) {
                    const docType = dMeta.type;
                    const vDoc = getVerifiedDoc(docType);
                    const docUrl = vDoc ? vDoc.previewUrl : (dMap[docType] ? `/api/drafts/${encodeURIComponent(activeCustMob)}/doc/${docType}` : '');
                    const isPdf = vDoc ? Boolean(vDoc.isPdf) : Boolean(String(dMap[docType] || '').toLowerCase().endsWith('.pdf'));
                    const hasDoc = Boolean(docUrl);

                    const cardEl = document.createElement('div');
                    cardEl.id = `editDocBox_${docType}`;
                    cardEl.style.cssText = 'background: white; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 10px; display: flex; gap: 12px; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.04);';
                    cardEl.innerHTML = `
                        <div style="width: 72px; height: 88px; border-radius: 8px; overflow: hidden; background: #f8fafc; display: flex; align-items: center; justify-content: center; border: 1.5px solid #cbd5e1; flex-shrink: 0; position: relative;">
                            <img id="editDocPreview_${docType}" src="${hasDoc && !isPdf ? docUrl : ''}" style="width: 100%; height: 100%; object-fit: contain; background: #ffffff; display: ${hasDoc && !isPdf ? 'block' : 'none'};">
                            <i id="editDocPlaceholder_${docType}" class="fa-solid ${dMeta.icon || 'fa-file-lines'}" style="font-size: 26px; color: #0284c7; display: ${hasDoc ? 'none' : 'block'};"></i>
                            <div id="editDocPdfBadge_${docType}" style="display: ${hasDoc && isPdf ? 'flex' : 'none'}; width: 100%; height: 100%; background: #fee2e2; color: #dc2626; font-weight: 800; font-size: 13px; align-items: center; justify-content: center; flex-direction: column; gap: 2px;">
                                <i class="fa-solid fa-file-pdf" style="font-size: 24px;"></i>
                                <span>PDF</span>
                            </div>
                        </div>
                        <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center;">
                            <div style="font-weight: 700; font-size: 12px; color: #0f172a; margin-bottom: 2px;">${dMeta.title}</div>
                            <div id="editDocStatus_${docType}" style="font-size: 11px; color: ${hasDoc ? '#16a34a' : '#64748b'}; margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: ${hasDoc ? '700' : 'normal'};">
                                ${hasDoc ? '✅ சேமிக்கப்பட்டது (அரசு தரத்தில் இணைக்கப்பட்டது)' : dMeta.defaultPrompt}
                            </div>
                            <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
                                <input type="file" id="editUniversalDocInput_${docType}" accept="image/*,application/pdf" style="display: none;" onchange="handleEditDocChosen('${docType}', event)">
                                <button type="button" onclick="document.getElementById('editUniversalDocInput_${docType}').click()" style="height: 32px; padding: 0 12px; background: #eff6ff; border: 1.5px solid #93c5fd; color: #1d4ed8; border-radius: 7px; font-size: 11px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">
                                    <i class="fa-solid fa-file-arrow-up"></i> மாற்று
                                </button>
                                <a id="editDocViewBtn_${docType}" href="${hasDoc ? docUrl : '#'}" target="_blank" style="display: ${hasDoc ? 'inline-flex' : 'none'}; height: 32px; padding: 0 10px; background: #f8fafc; border: 1.5px solid #cbd5e1; color: #334155; border-radius: 7px; font-size: 11px; font-weight: 600; text-decoration: none; align-items: center; gap: 4px;">
                                    <i class="fa-solid fa-eye"></i> பார்
                                </a>
                                <button type="button" id="editDocDeleteBtn_${docType}" onclick="handleEditDocDelete('${docType}')" style="display: ${hasDoc ? 'inline-flex' : 'none'}; height: 32px; padding: 0 9px; background: #fef2f2; border: 1.5px solid #fca5a5; color: #b91c1c; border-radius: 7px; font-size: 11px; font-weight: 700; cursor: pointer; align-items: center; gap: 4px;">
                                    <i class="fa-solid fa-trash-can"></i>
                                </button>
                            </div>
                        </div>
                    `;
                    universalContainer.appendChild(cardEl);
                }
            }

            // 4. Family Members Aadhaar
            const membersContainer = document.getElementById('editMembersAadhaarContainer');
            if (membersContainer) {
                membersContainer.innerHTML = '';
                const members = (data.members || []).slice(1);
                if (members.length > 0) {
                    let memHtml = `<div style="font-weight: 700; color: #1e293b; font-size: 12px; margin-top: 4px;">👥 குடும்ப உறுப்பினர்கள் ஆவணங்கள் (Family Members — Aadhaar / Birth Certificate):</div>`;
                    members.forEach((m, idx) => {
                        const mIdx = idx + 1;
                        const mName = m.nameTam ? `${m.nameTam} (${m.nameEng || ''})` : (m.nameEng || `உறுப்பினர் ${mIdx}`);
                        const mRel = m.relationshipTam || m.relationship || '';
                        const isMemBirthCert = m.docType === 'BIRTH_CERTIFICATE' || m.hasAadhaar === false;
                        const mDoc = m.docPath || (isMemBirthCert ? m.birthCertificatePath : '') || '';
                        const mDocStr = typeof mDoc === 'object' ? (mDoc?.path || mDoc?.docPath || '') : String(mDoc || '');
                        const mUrl = formatDocUrl(mDocStr);
                        const isPdf = isPdfPath(mDocStr);
                        const isImg = mDocStr && !isPdf;
                        const mFileName = mDocStr ? mDocStr.split('/').pop().split('\\').pop() : '';

                        memHtml += `
                            <div style="background: white; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); margin-bottom: 8px;">
                                <div style="display: flex; gap: 12px; align-items: center;">
                                    <div style="width: 72px; height: 88px; border-radius: 8px; overflow: hidden; background: #eff6ff; display: flex; align-items: center; justify-content: center; border: 1.5px solid #bfdbfe; flex-shrink: 0; position: relative;">
                                        <img id="editMemberAadhaarPreview_${mIdx}" src="${isImg ? mUrl : ''}" style="width: 100%; height: 100%; object-fit: contain; background: #ffffff; display: ${isImg ? 'block' : 'none'};">
                                        <i id="editMemberAadhaarPlaceholder_${mIdx}" class="fa-solid ${isMemBirthCert ? 'fa-baby' : 'fa-id-card'}" style="font-size: 26px; color: #2563eb; display: ${!mDoc ? 'block' : 'none'};"></i>
                                        <div id="editMemberAadhaarPdfBadge_${mIdx}" style="display: ${isPdf ? 'flex' : 'none'}; width: 100%; height: 100%; background: #fee2e2; color: #dc2626; font-weight: 800; font-size: 13px; align-items: center; justify-content: center; flex-direction: column; gap: 2px;">
                                            <i class="fa-solid fa-file-pdf" style="font-size: 24px;"></i>
                                            <span>PDF</span>
                                        </div>
                                    </div>
                                    <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center;">
                                        <div style="font-weight: 700; font-size: 12.5px; color: #0f172a; margin-bottom: 2px;">👥 உறுப்பினர் ${mIdx + 1}: ${mName} ${mRel ? `(${mRel})` : ''}</div>
                                        <div id="editMemberAadhaarStatus_${mIdx}" style="font-size: 11px; color: ${mDoc ? '#16a34a' : '#64748b'}; margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                            ${mDoc ? `✅ ${mFileName.length > 20 ? mFileName.substring(0, 18) + '...' : mFileName}` : (isMemBirthCert ? 'பிறப்புச் சான்றிதழ் தேவை' : 'ஆதார் அட்டை தேவை')}
                                        </div>
                                        <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
                                            <input type="file" id="editMemberAadhaarInput_${mIdx}" accept="image/*,application/pdf" multiple style="display: none;" onchange="handleEditDocChosen('memberAadhaar', event, ${mIdx})">
                                            <input type="file" id="editMemberAadhaarBackInput_${mIdx}" accept="image/*,application/pdf" style="display: none;" onchange="handleEditDocChosen('memberAadhaarBack', event, ${mIdx})">
                                            <button type="button" onclick="document.getElementById('editMemberAadhaarInput_${mIdx}').click()" style="height: 32px; padding: 0 10px; background: #eff6ff; border: 1.5px solid #93c5fd; color: #1d4ed8; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                                                <i class="fa-solid fa-file-arrow-up"></i> ${isMemBirthCert ? 'பிறப்புச் சான்றிதழ்' : 'முன்பக்கம் / ஆவணம்'}
                                            </button>
                                            <button type="button" onclick="document.getElementById('editMemberAadhaarBackInput_${mIdx}').click()" style="height: 32px; padding: 0 10px; background: #eef2ff; border: 1.5px solid #a5b4fc; color: #4338ca; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                                                <i class="fa-solid fa-plus"></i> பின்பக்கம்
                                            </button>
                                            <a id="editMemberAadhaarViewBtn_${mIdx}" href="${mUrl || '#'}" target="_blank" style="display: ${mDoc ? 'inline-flex' : 'none'}; height: 32px; padding: 0 9px; background: #f8fafc; border: 1.5px solid #cbd5e1; color: #334155; border-radius: 6px; font-size: 11px; font-weight: 600; text-decoration: none; align-items: center; gap: 4px;">
                                                <i class="fa-solid fa-eye"></i> பார்
                                            </a>
                                            <button type="button" onclick="handleEditDocDelete('memberAadhaar', ${mIdx})" style="display: ${mDoc ? 'inline-flex' : 'none'}; height: 32px; padding: 0 9px; background: #fef2f2; border: 1.5px solid #fca5a5; color: #b91c1c; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; align-items: center; gap: 4px;">
                                                <i class="fa-solid fa-trash-can"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; width: 100%; padding-top: 8px; border-top: 1px dashed #e2e8f0;">
                                    <div style="grid-column: span 2;">
                                        <label style="font-size: 11px; font-weight: 700; color: #475569;">சான்று வகை (Document Proof Type):</label>
                                        <select id="editMemberDocType_${mIdx}" onchange="(function(sel,i){var a=document.getElementById('editMemberAadhaar_'+i); if(a){if(sel.value==='BIRTH_CERTIFICATE'){a.value='';a.disabled=true;a.placeholder='பிறப்புச் சான்றிதழ் (ஆதார் தேவையில்லை)';}else{a.disabled=false;a.placeholder='1234 5678 9012';}}})(this,${mIdx})" style="width: 100%; padding: 5px 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px; font-weight: 700; background: #f8fafc;">
                                            <option value="AADHAAR_CARD" ${!isMemBirthCert ? 'selected' : ''}>🪪 ஆதார் அட்டை (Aadhaar Card)</option>
                                            <option value="BIRTH_CERTIFICATE" ${isMemBirthCert ? 'selected' : ''}>📜 பிறப்புச் சான்றிதழ் (Birth Certificate - ஆதார் இல்லாத குழந்தை)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style="font-size: 11px; font-weight: 700; color: #475569;">பெயர் (தமிழ்):</label>
                                        <input type="text" id="editMemberNameTam_${mIdx}" value="${m.nameTam || ''}" style="width: 100%; padding: 5px 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px; font-weight: 700;">
                                    </div>
                                    <div>
                                        <label style="font-size: 11px; font-weight: 700; color: #475569;">Name (English):</label>
                                        <input type="text" id="editMemberNameEng_${mIdx}" value="${m.nameEng || m.name || ''}" style="width: 100%; padding: 5px 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px; font-weight: 700;">
                                    </div>
                                    <div>
                                        <label style="font-size: 11px; font-weight: 700; color: #475569;">உறவுமுறை (Relationship):</label>
                                        <select id="editMemberRel_${mIdx}" style="width: 100%; padding: 5px 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px; font-weight: 700;">
                                            <option value="மனைவி" ${mRel.includes('மனைவி') || /\bwife\b/i.test(mRel) ? 'selected' : ''}>மனைவி (Wife)</option>
                                            <option value="கணவர்" ${mRel.includes('கணவர்') || mRel.includes('கணவன்') || /\bhusband\b/i.test(mRel) ? 'selected' : ''}>கணவர் (Husband)</option>
                                            <option value="மகன்" ${(!mRel.includes('மருமகன்') && !/\bgrand\s*-?\s*son\b/i.test(mRel) && !/\bson[-\s]in[-\s]law\b/i.test(mRel) && (mRel.includes('மகன்') || /\bson\b/i.test(mRel))) ? 'selected' : ''}>மகன் (Son)</option>
                                            <option value="மகள்" ${(!mRel.includes('மருமகள்') && !/\bgrand\s*-?\s*daughter\b/i.test(mRel) && !/\bdaughter[-\s]in[-\s]law\b/i.test(mRel) && (mRel.includes('மகள்') || /\bdaughter\b/i.test(mRel))) ? 'selected' : ''}>மகள் (Daughter)</option>
                                            <option value="தந்தை" ${!mRel.includes('மாமனார்') && !/\bfather[-\s]in[-\s]law\b/i.test(mRel) && (mRel.includes('தந்தை') || /\bfather\b/i.test(mRel)) ? 'selected' : ''}>தந்தை (Father)</option>
                                            <option value="தாய்" ${!mRel.includes('மாமியார்') && !/\bmother[-\s]in[-\s]law\b/i.test(mRel) && (mRel.includes('தாய்') || /\bmother\b/i.test(mRel)) ? 'selected' : ''}>தாய் (Mother)</option>
                                            <option value="மருமகன்" ${mRel.includes('மருமகன்') || /\bson[-\s]in[-\s]law\b/i.test(mRel) ? 'selected' : ''}>மருமகன் (Son-in-law)</option>
                                            <option value="மருமகள்" ${mRel.includes('மருமகள்') || /\bdaughter[-\s]in[-\s]law\b/i.test(mRel) ? 'selected' : ''}>மருமகள் (Daughter-in-law)</option>
                                            <option value="பேரன்" ${mRel.includes('பேரன்') || /\bgrand\s*-?\s*son\b/i.test(mRel) ? 'selected' : ''}>பேரன் (Grandson)</option>
                                            <option value="பேத்தி" ${mRel.includes('பேத்தி') || /\bgrand\s*-?\s*daughter\b/i.test(mRel) ? 'selected' : ''}>பேத்தி (Granddaughter)</option>
                                            <option value="சகோதரர்" ${mRel.includes('சகோதர') || /\bbrother\b/i.test(mRel) ? 'selected' : ''}>சகோதரர் (Brother)</option>
                                            <option value="சகோதரி" ${mRel.includes('சகோதரி') || /\bsister\b/i.test(mRel) ? 'selected' : ''}>சகோதரி (Sister)</option>
                                            <option value="மற்றவை" ${!['மனைவி','கணவர்','கணவன்','மகன்','மகள்','தந்தை','தாய்','மருமகன்','மருமகள்','பேரன்','பேத்தி','சகோதர','சகோதரி'].some(x => mRel.includes(x)) && !/\b(wife|husband|son|daughter|father|mother|grandson|granddaughter|brother|sister)\b/i.test(mRel) ? 'selected' : ''}>மற்றவை (Others)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style="font-size: 11px; font-weight: 700; color: #475569;">பிறந்த தேதி (DD/MM/YYYY):</label>
                                        <input type="text" id="editMemberDob_${mIdx}" value="${m.dob || ''}" placeholder="DD/MM/YYYY" style="width: 100%; padding: 5px 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px;">
                                    </div>
                                    <div>
                                        <label style="font-size: 11px; font-weight: 700; color: #475569;">பாலினம் (Gender):</label>
                                        <select id="editMemberGender_${mIdx}" style="width: 100%; padding: 5px 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px;">
                                            <option value="Male" ${m.gender === 'Male' ? 'selected' : ''}>ஆண் (Male)</option>
                                            <option value="Female" ${m.gender === 'Female' ? 'selected' : ''}>பெண் (Female)</option>
                                            <option value="Transgender" ${m.gender === 'Transgender' ? 'selected' : ''}>மூன்றாம் பாலினம் (Transgender)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style="font-size: 11px; font-weight: 700; color: #475569;">12-இலக்க ஆதார் எண்:</label>
                                        <input type="text" id="editMemberAadhaar_${mIdx}" value="${isMemBirthCert ? '' : (m.aadhaarNumber || '').replace(/(\d{4})/g, '$1 ').trim()}" placeholder="${isMemBirthCert ? 'பிறப்புச் சான்றிதழ் (ஆதார் தேவையில்லை)' : '1234 5678 9012'}" ${isMemBirthCert ? 'disabled' : ''} maxlength="14" style="width: 100%; padding: 5px 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px; font-weight: 700; letter-spacing: 0.5px;">
                                    </div>
                                </div>
                            </div>
                        `;
                    });
                    membersContainer.innerHTML = memHtml;
                }
            }

                const safeSetVal = (id, val) => {
                    const el = document.getElementById(id);
                    if (el) el.value = (val !== undefined && val !== null) ? val : '';
                };

                safeSetVal('editNameTam', data.fullNameTam);
                safeSetVal('editNameEng', data.fullNameEng);
                const resolvedRel = data.relationship || data.headRelationship || ((data.spouseNameEng || data.spouseNameTam || data.spouseName) ? 'Husband' : 'Father');
                safeSetVal('editRelationship', resolvedRel);
                safeSetVal('editFatherTam', data.fatherNameTam || data.spouseNameTam);
                safeSetVal('editFatherEng', data.fatherNameEng || data.spouseNameEng);
                safeSetVal('editMotherTam', data.motherNameTam || data.motherName);
                safeSetVal('editMotherEng', data.motherNameEng || data.motherName);
                const rawDobInit = String(data.headDob || data.dob || '').trim();
                safeSetVal('editDob', /^\d{4}$/.test(rawDobInit) ? `01/01/${rawDobInit}` : rawDobInit);
                safeSetVal('editGender', data.headGender || 'Male');
                safeSetVal('editDoorNo', data.doorNo);
                safeSetVal('editStreetTam', data.streetTam || data.streetEng);
                safeSetVal('editAreaTam', data.areaTam || data.hamletTam || data.hamlet);
                safeSetVal('editPin', data.pincode);
                safeSetVal('editDistrict', data.district);
                safeSetVal('editTaluk', data.taluk);
                safeSetVal('editVillage', data.village);
                safeSetVal('editAadhaar', data.headAadhaar);
                safeSetVal('editSmartCardNo', data.smartCardNumber || data.rationCardNumber || data.rationCardNo);
                safeSetVal('editCanNumber', data.canNumber);

                // Service-Specific Fields Population (Strictly Delegated to UI Cartridges)
                if (forceMasterProfile && window.ESEVA_PLUGINS?.SERVICE_PLUGINS) {
                    for (const p of window.ESEVA_PLUGINS.SERVICE_PLUGINS) {
                        if (typeof p.uiCartridge?.populateEditFields === 'function') {
                            p.uiCartridge.populateEditFields(data, { safeSetVal });
                        }
                    }
                } else if (activePlugin?.uiCartridge && typeof activePlugin.uiCartridge.populateEditFields === 'function') {
                    activePlugin.uiCartridge.populateEditFields(data, { safeSetVal });
                }
                
                const hasGas = Boolean(
                    (data.gasDetails && (data.gasDetails.hasGas || data.gasDetails.consumerNumber || data.gasDetails.agencyName || data.gasDetails.gasBookPath)) ||
                    data.residenceProof?.type === 'GAS_BOOK' ||
                    data.documents?.gasBook
                );
                const editHasGasEl = document.getElementById('editHasGas');
                if (editHasGasEl) editHasGasEl.checked = hasGas;
                if (typeof toggleGasFields === 'function') {
                    toggleGasFields(hasGas);
                } else {
                    const wrap = document.getElementById('gasFieldsWrap');
                    if (wrap) wrap.style.display = hasGas ? 'grid' : 'none';
                }

                const rawOpenCo = `${data.gasDetails?.oilCompany || ''} ${data.gasDetails?.oilCompanyDisplay || ''} ${data.gasDetails?.agencyName || ''}`.toLowerCase();
                let mappedOpenCo = 'IOC';
                if (/\bhp\b|hp\s*gas|hindustan|hpcl|\bhpc\b/.test(rawOpenCo)) mappedOpenCo = 'HPC';
                else if (/bharat|bpcl|\bbpc\b/.test(rawOpenCo)) mappedOpenCo = 'BPC';
                safeSetVal('editGasCompany', mappedOpenCo);
                safeSetVal('editGasNo', data.gasDetails?.consumerNumber || '');
                safeSetVal('editGasAgency', data.gasDetails?.agencyName || '');
                safeSetVal('editGasCyl', data.gasDetails?.cylinders || '1');

                // Dynamic Master Profile Accumulated Custom Fields
                const customWrap = document.getElementById('editDynamicCustomFieldsWrap');
                if (customWrap) {
                    customWrap.innerHTML = '';
                    const standardKeySet = new Set([
                        'fullNameTam', 'fullNameEng', 'fatherNameTam', 'fatherNameEng', 'motherNameTam', 'motherNameEng', 'motherName',
                        'headDob', 'dob', 'headGender', 'headGenderTam', 'doorNo', 'streetTam', 'streetEng', 'areaTam', 'areaEng',
                        'pincode', 'district', 'taluk', 'village', 'districtTam', 'talukTam', 'villageTam',
                        'headAadhaar', 'smartCardNumber', 'rationCardNo', 'canNumber', 'religion', 'community', 'caste',
                        'fatherCaste', 'motherCaste', 'fatherCommunity', 'motherCommunity', 'annualIncome', 'profession',
                        'residenceYears', 'residencePurpose', 'gasDetails', 'residenceProof', 'documents', 'members',
                        'subService', 'subServiceData', 'step', 'intakeState', 'status', 'chatHistory', 'createdAt', 'updatedAt',
                        'isDeleted', 'isTrashed', 'tempUploads', 'base64Docs', 'storageUrls', 'mobileNumber', 'headPhotoPath',
                        'operatorUid', 'districtAutoCorrected', 'districtCorrectionReason', 'tempMember', 'selectedService',
                        'serviceId', 'service', 'targetService', 'serviceName', 'applicationNumber', 'applicationPdfUrl'
                    ]);

                    const customEntries = Object.entries(data).filter(([k, v]) => {
                        return !standardKeySet.has(k) && v !== undefined && v !== null && typeof v !== 'object' && String(v).trim() !== '';
                    });

                    if (!forceMasterProfile && activePlugin?.uiCartridge && typeof activePlugin.uiCartridge.renderDynamicEditFields === 'function') {
                        customWrap.style.display = 'grid';
                        activePlugin.uiCartridge.renderDynamicEditFields(customWrap, data, { safeSetVal });
                    } else if (forceMasterProfile && customEntries.length > 0) {
                        customWrap.style.display = 'grid';
                        let cHtml = `<div style="grid-column: span 2; font-weight: 700; color: #1e293b; font-size: 12px; display: flex; align-items: center; gap: 6px;">
                            <i class="fa-solid fa-layer-group" style="color: #0284c7;"></i> கூடுதல் மாஸ்டர் விவரங்கள் (Additional Accumulated Profile Details):
                        </div>`;
                        for (const [k, v] of customEntries) {
                            const labelText = k.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                            cHtml += `
                                <div>
                                    <label style="font-size: 11px; font-weight: 600; color: #475569;">${labelText}:</label>
                                    <input type="text" id="editCustomField_${k}" data-custom-key="${k}" value="${v}" style="width: 100%; padding: 6px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px;">
                                </div>
                            `;
                        }
                        customWrap.innerHTML = cHtml;
                    } else {
                        customWrap.style.display = 'none';
                    }
                }
            } catch (err) {
                console.error('Error populating edit modal fields:', err);
            } finally {
                if (modalEl) modalEl.style.display = 'flex';
            }
        }
        window.openEditModal = openEditModal;

        async function openEditModalForDoc(docType, memberIndex) {
            try {
                await openEditModal();
            } catch (e) {
                console.error('Error opening edit modal for doc:', e);
                const modal = document.getElementById('editModal');
                if (modal) modal.style.display = 'flex';
            }

            // Scroll & Highlight targeted document section in modal
            setTimeout(() => {
                let targetEl = null;
                const dType = String(docType || '').toLowerCase();
                const mIdx = memberIndex || (dType.match(/\d+/) ? Number(dType.match(/\d+/)[0]) + 1 : '');

                if (dType.includes('photo')) {
                    targetEl = document.getElementById('editPhotoPreview')?.closest('div[style*="border"]') || document.getElementById('editPhotoFileInput')?.parentElement;
                } else if (dType.includes('head') || (dType.includes('aadhaar') && !dType.includes('member'))) {
                    targetEl = document.getElementById('editHeadAadhaarPreview')?.closest('div[style*="border"]') || document.getElementById('editHeadAadhaarInput')?.parentElement;
                } else if (dType.includes('gas') || dType.includes('residence') || dType.includes('address')) {
                    targetEl = document.getElementById('editResidencePreview')?.closest('div[style*="border"]') || document.getElementById('editResidenceDocInput')?.parentElement;
                } else if (dType.includes('smart') || dType.includes('ration')) {
                    targetEl = document.getElementById('editSmartCardBox') || document.getElementById('editSmartCardPreview')?.closest('div[style*="border"]');
                } else if (dType.includes('member')) {
                    if (mIdx) {
                        targetEl = document.getElementById(`editMemberAadhaarPreview_${mIdx}`)?.closest('div[style*="border"]') || document.getElementById(`editMemberAadhaarInput_${mIdx}`)?.parentElement;
                    }
                    if (!targetEl) {
                        targetEl = document.getElementById('editMembersAadhaarContainer');
                    }
                } else if (dType.includes('community') || dType.includes('tc') || dType.includes('school')) {
                    targetEl = document.getElementById('editDocBox_communityProof') || document.getElementById('editDocPreview_communityProof')?.closest('div[style*="border"]');
                } else {
                    targetEl = document.getElementById(`editDocBox_${docType}`) ||
                               document.getElementById(`editDocBox_${dType}`) ||
                               document.getElementById(`editDocPreview_${docType}`)?.closest('div[style*="border"]') ||
                               document.getElementById(`editDocPreview_${dType}`)?.closest('div[style*="border"]');
                }

                if (!targetEl) {
                    if (document.getElementById('editAddMemberAadhaarPreview')?.offsetParent) {
                        targetEl = document.getElementById('editAddMemberAadhaarPreview').closest('div[style*="border"]');
                    } else if (document.getElementById('editRemoveMemberProofPreview')?.offsetParent) {
                        targetEl = document.getElementById('editRemoveMemberProofPreview').closest('div[style*="border"]');
                    }
                }

                if (targetEl) {
                    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    const origShadow = targetEl.style.boxShadow;
                    const origBorder = targetEl.style.borderColor;
                    const origTransform = targetEl.style.transform;
                    targetEl.style.transition = 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
                    targetEl.style.boxShadow = '0 0 0 3.5px #2563eb, 0 8px 24px rgba(37,99,235,0.3)';
                    targetEl.style.borderColor = '#2563eb';
                    targetEl.style.transform = 'scale(1.02)';
                    setTimeout(() => {
                        targetEl.style.boxShadow = origShadow;
                        targetEl.style.borderColor = origBorder;
                        targetEl.style.transform = origTransform;
                    }, 2200);
                }
            }, 120);
        }
        window.openEditModalForDoc = openEditModalForDoc;

        function closeEditModal(opts = {}) {
            const modalEl = document.getElementById('editModal');
            if (modalEl) modalEl.style.display = 'none';
            currentEditModalIsMasterProfile = false;
            window.forceMasterProfile = false;
            if (opts && opts.skipHistoryRefresh) return;
            const activeCustMob = localStorage.getItem('eseva_active_customer_mobile') || (currentCitizenData && currentCitizenData.mobileNumber) || '';
            const activeDraftId = (localStorage.getItem('eseva_active_draft_id') || '').trim();
            if (activeCustMob) {
                fetch(`/api/chat/history?mobile=${encodeURIComponent(activeCustMob)}${activeDraftId ? `&draftId=${encodeURIComponent(activeDraftId)}` : ''}`, {
                    headers: { 'x-session-mobile': activeCustMob, 'x-draft-id': activeDraftId }
                })
                    .then(r => r.json())
                    .then(cd => {
                        if (cd && cd.chatHistory && typeof renderMessages === 'function') {
                            renderMessages(cd.chatHistory, true);
                        }
                    })
                    .catch(() => {});
            }
        }
        window.closeEditModal = closeEditModal;

        async function submitDirectlyFromEditModal(mode = null) {
            const btn = document.getElementById('btnSubmitFromEditModal');
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> சேமித்து சமர்ப்பிக்கப்படுகிறது...';
            }
            try {
                const wasMasterOnly = Boolean(currentEditModalIsMasterProfile && !currentCitizenData?.subService);
                // 1. Save all edited fields & pending uploads silently (without re-thrashing chat DOM before submit)
                await saveEditedProfile(true);
                closeEditModal({ skipHistoryRefresh: true });

                if (wasMasterOnly) {
                    if (typeof showEsevaToast === 'function') {
                        showEsevaToast('✅ விவரங்கள் வெற்றிகரமாகச் சேமிக்கப்பட்டன!', 'success');
                    }
                    return;
                }

                // 2. Direct portal submit to physical visible Chrome (ONLY allowed from Edit Modal!)
                const runRealLive = mode === 'dryRun' ? 'dryRun' : true;
                await proceedConfirmedSubmit(runRealLive, { fromEditModal: true });
            } catch (e) {
                alert('பிழை: ' + e.message);
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '🚀 அரசு போர்ட்டலில் சமர்ப்பி (Submit Application)';
                }
            }
        }

        async function saveEditedProfile(silent = false) {
            const forceMasterProfile = Boolean(currentEditModalIsMasterProfile || window.forceMasterProfile);
            const saveBtn = document.getElementById('btnSaveEditDraft');
            if (saveBtn && !silent) {
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> சேமிக்கப்படுகிறது...';
            }

            const enteredMob = (document.getElementById('editMobile')?.value || '').replace(/\D/g, '');
            const activeCustMob = originalEditingMobile || localStorage.getItem('eseva_active_customer_mobile') || (currentCitizenData && currentCitizenData.mobileNumber) || '';
            const activeDraftId = (localStorage.getItem('eseva_active_draft_id') || '').trim();
            const targetMob = enteredMob || activeCustMob;
            const opUid = localStorage.getItem('eseva_operator_uid') || '';
            const isMobileChanged = Boolean(originalEditingMobile && enteredMob && enteredMob.length === 10 && originalEditingMobile !== enteredMob);

            // 1. Upload any pending documents/photos first
            const pendingKeys = Object.keys(pendingDocUploads);
            if (pendingKeys.length > 0) {
                for (const key of pendingKeys) {
                    const item = pendingDocUploads[key];
                    try {
                        const fd = new FormData();
                        fd.append('file', item.file);
                        fd.append('docType', item.docType);
                        fd.append('mobileNumber', targetMob);
                        if (activeDraftId) fd.append('draftId', activeDraftId);
                        if (isMobileChanged) {
                            fd.append('oldMobileNumber', originalEditingMobile);
                        }
                        if (item.memberIndex) {
                            fd.append('memberIndex', String(item.memberIndex));
                            const pTypeEl = document.getElementById(`editMemberDocType_${item.memberIndex}`);
                            if (pTypeEl && pTypeEl.value) fd.append('intendedProofType', pTypeEl.value);
                        }

                        const upRes = await fetch('/api/drafts/upload-document', {
                            method: 'POST',
                            headers: {
                                'x-session-mobile': targetMob,
                                'x-draft-id': activeDraftId,
                                ...(isMobileChanged ? { 'x-old-session-mobile': originalEditingMobile } : {}),
                                'x-operator-uid': opUid
                            },
                            body: fd
                        });
                        const upData = await upRes.json();
                        if (upData.success && upData.citizenProfile) {
                            currentCitizenData = upData.citizenProfile;
                        }
                    } catch (uploadErr) {
                        console.warn(`Doc upload error for ${key}:`, uploadErr);
                    }
                }
                pendingDocUploads = {};
            }

            // 2. Update profile details strictly via Active Service UI Cartridge
            const sData = (currentCitizenData && currentCitizenData.subServiceData) || {};
            const resolvedPlugin = (!forceMasterProfile && window.ESEVA_PLUGINS?.resolveServicePlugin)
                ? window.ESEVA_PLUGINS.resolveServicePlugin(currentCitizenData || {})
                : null;
            const defaultNewCardPlugin = window.ESEVA_PLUGINS?.getPluginById ? window.ESEVA_PLUGINS.getPluginById('TNPDS_NEW_CARD') : null;
            const activePlugin = forceMasterProfile ? null : (resolvedPlugin || defaultNewCardPlugin);

            const cartridgeCollected = (!forceMasterProfile && activePlugin?.uiCartridge && typeof activePlugin.uiCartridge.collectEditFields === 'function')
                ? activePlugin.uiCartridge.collectEditFields({ data: currentCitizenData, sData, forceMasterProfile })
                : null;

            let updated = {};
            if (cartridgeCollected && cartridgeCollected.overrideUpdated) {
                updated = cartridgeCollected.overrideUpdated;
            } else {
                const hasGas = document.getElementById('editHasGas')?.checked || false;
                const gasCo = document.getElementById('editGasCompany')?.value || 'IOC';
                const gasCoDisplay = document.getElementById('editGasCompany')?.options[document.getElementById('editGasCompany')?.selectedIndex]?.text || 'Indane Gas (IOCL)';

                const existingMembers = (currentCitizenData && Array.isArray(currentCitizenData.members)) ? [...currentCitizenData.members] : [];
                if (existingMembers.length > 0) {
                    existingMembers[0] = {
                        ...existingMembers[0],
                        nameTam: document.getElementById('editNameTam').value.trim(),
                        nameEng: document.getElementById('editNameEng').value.trim(),
                        name: document.getElementById('editNameEng').value.trim() || document.getElementById('editNameTam').value.trim(),
                        dob: document.getElementById('editDob').value.trim(),
                        gender: document.getElementById('editGender').value,
                        genderTam: document.getElementById('editGender').value === 'Female' ? 'பெண்' : 'ஆண்',
                        aadhaarNumber: document.getElementById('editAadhaar').value.replace(/\s+/g, '')
                    };
                }
                for (let idx = 1; idx < existingMembers.length; idx++) {
                    const mNameTamEl = document.getElementById(`editMemberNameTam_${idx}`);
                    const mNameEngEl = document.getElementById(`editMemberNameEng_${idx}`);
                    const mRelEl = document.getElementById(`editMemberRel_${idx}`);
                    const mDobEl = document.getElementById(`editMemberDob_${idx}`);
                    const mGenEl = document.getElementById(`editMemberGender_${idx}`);
                    const mAadhEl = document.getElementById(`editMemberAadhaar_${idx}`);
                    const mDocTypeEl = document.getElementById(`editMemberDocType_${idx}`);

                    if (mNameTamEl || mNameEngEl || mAadhEl || mDocTypeEl) {
                        const resolvedDocType = mDocTypeEl ? mDocTypeEl.value : (existingMembers[idx].docType || 'AADHAAR_CARD');
                        const isBc = resolvedDocType === 'BIRTH_CERTIFICATE';
                        const relTamVal = mRelEl ? mRelEl.value : existingMembers[idx].relationshipTam;
                        const relEngMap = {
                            'மனைவி': 'Wife', 'கணவர்': 'Husband', 'கணவன்': 'Husband',
                            'மகன்': 'Son', 'மகள்': 'Daughter', 'தந்தை': 'Father', 'தாய்': 'Mother',
                            'மாமனார்': 'Father-in-law', 'மாமியார்': 'Mother-in-law',
                            'மருமகன்': 'Son-in-law', 'மருமகள்': 'Daughter-in-law',
                            'பேரன்': 'Grand Son', 'பேத்தி': 'Grand Daughter',
                            'சகோதரர்': 'Brother', 'சகோதரன்': 'Brother', 'சகோதரி': 'Sister',
                            'மற்றவை': 'Others'
                        };
                        existingMembers[idx] = {
                            ...existingMembers[idx],
                            docType: resolvedDocType,
                            proofType: resolvedDocType,
                            hasAadhaar: !isBc,
                            nameTam: mNameTamEl ? mNameTamEl.value.trim() : existingMembers[idx].nameTam,
                            nameEng: mNameEngEl ? mNameEngEl.value.trim() : existingMembers[idx].nameEng,
                            name: (mNameEngEl && mNameEngEl.value.trim()) || (mNameTamEl && mNameTamEl.value.trim()) || existingMembers[idx].name,
                            relationshipTam: relTamVal,
                            relationshipEng: mRelEl ? (relEngMap[relTamVal] || relTamVal) : existingMembers[idx].relationshipEng,
                            relationship: relTamVal,
                            dob: mDobEl ? mDobEl.value.trim() : existingMembers[idx].dob,
                            gender: mGenEl ? mGenEl.value : existingMembers[idx].gender,
                            genderTam: mGenEl ? (mGenEl.value === 'Female' ? 'பெண்' : 'ஆண்') : existingMembers[idx].genderTam,
                            aadhaarNumber: isBc ? '' : (mAadhEl ? mAadhEl.value.replace(/\s+/g, '') : existingMembers[idx].aadhaarNumber)
                        };
                        if (!isBc) {
                            delete existingMembers[idx].birthCertificatePath;
                        }
                    }
                }

                const keepSub = forceMasterProfile ? (currentCitizenData?.subService || null) : (cartridgeCollected?.subService || currentCitizenData?.subService || null);
                const keepSubData = (keepSub === 'NEW_CARD' || !keepSub) ? {} : (forceMasterProfile ? (currentCitizenData?.subServiceData || null) : (cartridgeCollected?.subServiceData || currentCitizenData?.subServiceData || null));

                // Collect Master Vault extension fields cleanly ONLY when forceMasterProfile is true
                const vaultMergedFields = {};
                if (forceMasterProfile && window.ESEVA_PLUGINS?.SERVICE_PLUGINS) {
                    for (const p of window.ESEVA_PLUGINS.SERVICE_PLUGINS) {
                        if (!p.uiCartridge?.renderCustomView && typeof p.uiCartridge?.collectEditFields === 'function') {
                            const cRes = p.uiCartridge.collectEditFields({ data: currentCitizenData, sData, forceMasterProfile });
                            if (cRes && cRes.fields) Object.assign(vaultMergedFields, cRes.fields);
                        }
                    }
                }

                const relSelectVal = document.getElementById('editRelationship')?.value || currentCitizenData?.relationship || 'Father';
                const rawDobSave = (document.getElementById('editDob')?.value || '').trim();
                const normDobSave = /^\d{4}$/.test(rawDobSave) ? `01/01/${rawDobSave}` : rawDobSave;
                const fTamSave = document.getElementById('editFatherTam').value.trim();
                const fEngSave = document.getElementById('editFatherEng').value.trim();
                const canVal = document.getElementById('editCanNumber')?.value?.replace(/\s+/g, '') || currentCitizenData?.canNumber || '';

                updated = {
                    subService: keepSub,
                    subServiceData: keepSubData,
                    pluginId: activePlugin?.id || currentCitizenData?.pluginId || undefined,
                    fullNameTam: document.getElementById('editNameTam').value.trim(),
                    fullNameEng: document.getElementById('editNameEng').value.trim(),
                    relationship: relSelectVal,
                    headRelationship: relSelectVal,
                    maritalStatus: relSelectVal === 'Husband' ? 'Married' : (currentCitizenData?.maritalStatus || ''),
                    spouseNameTam: relSelectVal === 'Husband' ? fTamSave : (currentCitizenData?.spouseNameTam || ''),
                    spouseNameEng: relSelectVal === 'Husband' ? fEngSave : (currentCitizenData?.spouseNameEng || ''),
                    fatherNameTam: fTamSave,
                    fatherNameEng: fEngSave,
                    motherNameTam: document.getElementById('editMotherTam')?.value.trim() || currentCitizenData?.motherNameTam || '',
                    motherNameEng: document.getElementById('editMotherEng')?.value.trim() || currentCitizenData?.motherNameEng || '',
                    headDob: normDobSave,
                    dob: normDobSave,
                    headGender: document.getElementById('editGender').value,
                    headGenderTam: document.getElementById('editGender').value === 'Female' ? 'பெண்' : 'ஆண்',
                    doorNo: document.getElementById('editDoorNo').value.trim(),
                    streetTam: document.getElementById('editStreetTam').value.trim(),
                    streetEng: document.getElementById('editStreetEng')?.value.trim() || document.getElementById('editStreetTam').value.trim(),
                    areaTam: document.getElementById('editAreaTam').value.trim(),
                    areaEng: document.getElementById('editAreaEng')?.value.trim() || document.getElementById('editAreaTam').value.trim(),
                    pincode: document.getElementById('editPin').value.trim(),
                    district: document.getElementById('editDistrict').value.trim(),
                    taluk: document.getElementById('editTaluk').value.trim(),
                    village: document.getElementById('editVillage').value.trim(),
                    headAadhaar: document.getElementById('editAadhaar').value.replace(/\s+/g, ''),
                    smartCardNumber: document.getElementById('editSmartCardNo')?.value.trim() || currentCitizenData?.smartCardNumber || '',
                    rationCardNo: document.getElementById('editSmartCardNo')?.value.trim() || currentCitizenData?.rationCardNo || '',
                    canNumber: canVal,
                    ...vaultMergedFields,
                    ...(cartridgeCollected?.fields || {}),
                    members: existingMembers,
                    gasDetails: (document.getElementById('editGasToggleWrap')?.style.display !== 'none')
                        ? {
                            ...(currentCitizenData ? currentCitizenData.gasDetails : {}),
                            hasGas: hasGas,
                            oilCompany: hasGas ? gasCo : '',
                            oilCompanyDisplay: hasGas ? gasCoDisplay : '',
                            consumerNumber: hasGas ? document.getElementById('editGasNo').value.trim() : '',
                            agencyName: hasGas ? document.getElementById('editGasAgency').value.trim() : '',
                            cylinders: hasGas ? document.getElementById('editGasCyl').value.trim() : '0'
                        }
                        : (currentCitizenData?.gasDetails || undefined)
                };
            }

            // Harvest dynamic accumulated custom fields
            const customInputs = document.querySelectorAll('#editDynamicCustomFieldsWrap input[data-custom-key]');
            customInputs.forEach(inp => {
                const k = inp.getAttribute('data-custom-key');
                if (k) {
                    updated[k] = inp.value.trim();
                }
            });

            const safeIncVal = updated?.annualIncome || currentCitizenData?.annualIncome || '';
            try {
                const editDraftId = localStorage.getItem('eseva_active_draft_id') || '';
                const res = await fetch('/api/profile/update', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'x-session-mobile': targetMob,
                        ...(editDraftId && !isMobileChanged ? { 'x-draft-id': editDraftId } : {}),
                        ...(isMobileChanged ? { 'x-old-session-mobile': originalEditingMobile } : {}),
                        'x-operator-uid': opUid
                    },
                    body: JSON.stringify({ 
                        ...updated, 
                        headPhotoPath: currentCitizenData?.headPhotoPath || currentCitizenData?.documents?.profilePhoto || currentCitizenData?.documents?.headPhoto || null,
                        profilePhoto: currentCitizenData?.headPhotoPath || currentCitizenData?.documents?.profilePhoto || currentCitizenData?.documents?.headPhoto || null,
                        incomeProof: (currentCitizenData?.incomeProof || currentCitizenData?.salaryCertificatePath || currentCitizenData?.documents?.incomeProof || currentCitizenData?.documents?.salaryCertificate || (safeIncVal ? 'SELF_DECLARATION' : null)),
                        incomeProofType: (currentCitizenData?.incomeProofType || (safeIncVal ? 'SELF_DECLARATION' : null)),
                        salaryCertificatePath: currentCitizenData?.salaryCertificatePath || currentCitizenData?.documents?.salaryCertificate || null,
                        communityProof: (currentCitizenData?.communityCertificatePath || currentCitizenData?.familyCommunityProofPath || currentCitizenData?.communityProof || currentCitizenData?.communityCertificate || currentCitizenData?.documents?.communityProof || currentCitizenData?.documents?.communityCertificate || currentCitizenData?.documents?.familyCommunityProof) || null,
                        communityCertificate: currentCitizenData?.communityCertificate || currentCitizenData?.communityCertificatePath || currentCitizenData?.documents?.communityCertificate || currentCitizenData?.documents?.communityProof || null,
                        communityCertificatePath: currentCitizenData?.communityCertificatePath || currentCitizenData?.communityCertificate || currentCitizenData?.documents?.communityCertificate || currentCitizenData?.documents?.communityProof || null,
                        familyCommunityProofPath: currentCitizenData?.familyCommunityProofPath || currentCitizenData?.documents?.familyCommunityProof || null,
                        incomeTaxReturn: currentCitizenData?.incomeTaxReturn || currentCitizenData?.incomeProof || currentCitizenData?.documents?.incomeTaxReturn || currentCitizenData?.documents?.incomeProof || null,
                        mobileNumber: targetMob, 
                        oldMobileNumber: isMobileChanged ? originalEditingMobile : undefined,
                        fromEditModal: true, 
                        silent: true 
                    })
                });
                const data = await res.json();
                if (!silent) {
                    closeEditModal();
                }
                if (data.updatedMobile) {
                    localStorage.setItem('eseva_active_customer_mobile', data.updatedMobile);
                    originalEditingMobile = data.updatedMobile;
                    const titleEl = document.getElementById('activeCustomerTitle');
                    if (titleEl) {
                        titleEl.innerHTML = `<i class="fa-solid fa-user-check" style="color: #16a34a;"></i> வாடிக்கையாளர்: <b>+91 ${data.updatedMobile}</b>`;
                    }
                }
                // Do not spam chat interface with duplicate confirmation prompts
                if (data.citizenProfile) {
                    currentCitizenData = data.citizenProfile;
                    updateSidebar(data);
                }
                if (!silent && data.chatHistory && typeof renderMessages === 'function') {
                    renderMessages(data.chatHistory, true);
                }
                fetchOperatorDrafts();
                if (!silent) {
                    showEsevaToast('✅ அனைத்து விவரங்களும் ஆவணங்களும் வெற்றிகரமாகச் சேமிக்கப்பட்டன!', 'success');
                }
            } catch (e) {
                alert('பிழை: ' + e.message);
            } finally {
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = '💾 வரைவாக சேமி (Save Draft)';
                }
            }
        }

        let esevaToastTimeout = null;

        function showEsevaToast(message, type = 'success') {
            let t = document.getElementById('esevaGlobalToast');
            if (!t) {
                t = document.createElement('div');
                t.id = 'esevaGlobalToast';
                t.style.position = 'fixed';
                t.style.bottom = '24px';
                t.style.right = '24px';
                t.style.zIndex = '999999';
                t.style.padding = '12px 20px';
                t.style.borderRadius = '8px';
                t.style.boxShadow = '0 10px 25px rgba(0,0,0,0.15)';
                t.style.fontWeight = '700';
                t.style.fontSize = '13px';
                t.style.display = 'flex';
                t.style.alignItems = 'center';
                t.style.gap = '10px';
                t.style.transition = 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
                document.body.appendChild(t);
            }
            if (esevaToastTimeout) {
                clearTimeout(esevaToastTimeout);
                esevaToastTimeout = null;
            }
            t.style.background = type === 'success' ? '#166534' : '#991b1b';
            t.style.color = '#ffffff';
            t.innerHTML = `<i class="${type === 'success' ? 'fa-solid fa-circle-check' : 'fa-solid fa-triangle-exclamation'}"></i> ${message}`;
            t.style.display = 'flex';
            t.style.opacity = '1';
            t.style.transform = 'translateY(0)';
            esevaToastTimeout = setTimeout(() => {
                if (t) {
                    t.style.opacity = '0';
                    t.style.transform = 'translateY(12px)';
                    setTimeout(() => { if (t) t.style.display = 'none'; }, 300);
                }
                esevaToastTimeout = null;
            }, 2200);
        }
        window.showEsevaToast = showEsevaToast;

        async function syncPortalOtpTimer() {
            const authScreen = document.getElementById('authScreen');
            if (authScreen && authScreen.style.display !== 'none') return;

            try {
                const res = await fetch('/api/chat/otp-status');
                const data = await res.json();
                if (data.isWaitingForOtp && typeof data.seconds === 'number' && data.seconds > 0) {
                    if (Math.abs(data.seconds - otpSecondsLeft) > 2) {
                        otpSecondsLeft = data.seconds;
                        if (data.seconds > otpTotalSeconds) otpTotalSeconds = data.seconds;
                        updateOtpTimerUi();
                    }
                }
            } catch (e) {}
        }

        // Initialize session check & setup listeners
        checkSession();
        setupChatScrollListener();
        
        // Delay recurring background poll intervals by 3s so initial UI render & click events are completely instantaneous (<50ms)
        setTimeout(() => {
            setInterval(fetchHistory, 2500);
            setInterval(syncPortalOtpTimer, 2000);
            setInterval(syncAutomationProgress, 1500);
        }, 3000);

        // On page load: sync Dev Mock badge and show dev buttons only on localhost
        (function initDevVisibility() {
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            // Show auth screen dev test buttons only on localhost
            const devAuthBtns = document.getElementById('devOnlyAuthButtons');
            if (devAuthBtns) {
                devAuthBtns.style.display = isLocal ? 'block' : 'none';
            }
            // Clear any stale eseva_dev_mock_mode stored on non-local machines so operators don't get stuck in dev mode
            if (!isLocal) {
                const storedMode = localStorage.getItem('eseva_dev_mock_mode');
                if (storedMode === 'true') {
                    localStorage.removeItem('eseva_dev_mock_mode');
                }
            }
            // Sync badge & toggle buttons based on actual dev mode state
            syncDevMockUI();
        })();

        // (Note: #btnSidebarEdit and #btnSidebarSave already wire onclick handlers directly in index.html;
        // removed redundant addEventListener bindings here to prevent double-firing clicks.)