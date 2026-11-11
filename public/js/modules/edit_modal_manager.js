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
                    if (imgEl) imgEl.style.display = 'none';
                    if (phEl) phEl.style.display = 'none';
                    if (pdfEl) pdfEl.style.display = 'flex';
                } else {
                    if (imgEl) { imgEl.src = url; imgEl.style.display = 'block'; }
                    if (phEl) phEl.style.display = 'none';
                    if (pdfEl) pdfEl.style.display = 'none';
                }
                if (stEl) {
                    const pathStr = typeof docPath === 'object' ? (docPath?.path || docPath?.docPath || '') : String(docPath || '');
                    const fname = pathStr.split('/').pop().split('\\').pop();
                    stEl.innerText = `✅ ${fname.length > 20 ? fname.substring(0, 18) + '...' : fname}`;
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

                const fd = new FormData();
                fd.append('file', file);
                fd.append('docType', docType);
                fd.append('mobileNumber', targetMob);
                if (isMobileChanged) {
                    fd.append('oldMobileNumber', originalEditingMobile);
                }
                if (memberIndex) fd.append('memberIndex', String(memberIndex));

                const upRes = await fetch('/api/drafts/upload-document', {
                    method: 'POST',
                    headers: {
                        'x-session-mobile': targetMob,
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
                    if (!isReturnedPdf && imgEl && finalUrl) {
                        imgEl.src = finalUrl + (finalUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
                        imgEl.style.display = 'block';
                        if (pdfEl) pdfEl.style.display = 'none';
                    }
                    if (upData.citizenProfile) {
                        syncEditModalInputsFromProfile(upData.citizenProfile, baseType, memberIndex);
                        updateSidebar({ citizenProfile: upData.citizenProfile });
                    }
                    fetchOperatorDrafts();
                } else {
                    if (stEl) {
                        stEl.innerText = `⚠️ ${upData.error || 'சேமிக்க முடியவில்லை'}`;
                        stEl.style.color = '#dc2626';
                    }
                }
            } catch (err) {
                console.warn('Doc background upload fallback:', err);
                if (stEl) {
                    stEl.innerText = `✅ புதிய கோப்பு: ${file.name}`;
                    stEl.style.color = '#16a34a';
                    stEl.style.fontWeight = '700';
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
                if (gas && (gas.hasGas || gas.consumerNumber)) {
                    const chk = document.getElementById('editHasGas');
                    if (chk) {
                        chk.checked = true;
                        if (typeof toggleGasFields === 'function') toggleGasFields(true);
                    }
                    if (gas.oilCompany) {
                        const coEl = document.getElementById('editGasCompany');
                        if (coEl) {
                            coEl.value = gas.oilCompany;
                            flash(coEl);
                        }
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
                    setVal(`editMemberNameTam_${memberIndex}`, m.nameTam);
                    setVal(`editMemberNameEng_${memberIndex}`, m.nameEng || m.name);
                    setVal(`editMemberDob_${memberIndex}`, m.dob);
                    if (m.gender) {
                        const mgEl = document.getElementById(`editMemberGender_${memberIndex}`);
                        if (mgEl) { mgEl.value = m.gender; flash(mgEl); }
                    }
                    if (m.aadhaarNumber) {
                        setVal(`editMemberAadhaar_${memberIndex}`, m.aadhaarNumber.replace(/(\d{4})/g, '$1 ').trim());
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
            }
        }
        window.syncEditModalInputsFromProfile = syncEditModalInputsFromProfile;

        async function handleEditDocDelete(docType, memberIndex = 0) {
            if (!confirm('இந்த ஆவணத்தை நிச்சயமாக நீக்க வேண்டுமா? (Are you sure you want to delete this document?)')) {
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
                    if (currentCitizenData.documents) delete currentCitizenData.documents.profilePhoto;
                }
            } else if (docType === 'headAadhaar') {
                renderDocPreview('', 'editHeadAadhaarPreview', 'editHeadAadhaarPlaceholder', 'editHeadAadhaarPdfBadge', 'editHeadAadhaarStatus', 'editHeadAadhaarViewBtn', 'ஆதார் அட்டை தேவை', 'editHeadAadhaarDeleteBtn');
                const fin = document.getElementById('editHeadAadhaarInput');
                if (fin) fin.value = '';
                if (currentCitizenData) {
                    delete currentCitizenData.headAadhaarDocPath;
                    if (currentCitizenData.members && currentCitizenData.members[0]) delete currentCitizenData.members[0].docPath;
                    if (currentCitizenData.documents) delete currentCitizenData.documents.headAadhaar;
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
                const fin = document.getElementById('editSmartCardInput');
                if (fin) fin.value = '';
                if (currentCitizenData) {
                    delete currentCitizenData.smartCardDocPath;
                    delete currentCitizenData.rationCardDocPath;
                    if (currentCitizenData.documents) {
                        delete currentCitizenData.documents.smartCard;
                        delete currentCitizenData.documents.rationCard;
                    }
                }
            } else if (docType === 'memberAadhaar') {
                if (memberIndex === 0) {
                    renderDocPreview('', 'editAddMemberAadhaarPreview', 'editAddMemberAadhaarPlaceholder', 'editAddMemberAadhaarPdfBadge', 'editAddMemberAadhaarStatus', 'editAddMemberAadhaarViewBtn', 'உறுப்பினர் ஆதார் அட்டை தேவை', 'editAddMemberAadhaarDeleteBtn');
                    const fin = document.getElementById('editAddMemberAadhaarInput');
                    if (fin) fin.value = '';
                    if (currentCitizenData && currentCitizenData.subServiceData) {
                        delete currentCitizenData.subServiceData.docPath;
                        delete currentCitizenData.subServiceData.memberDocPath;
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
            }

            // 2. Call backend to delete document from draft & disk
            if (activeCustMob) {
                try {
                    const res = await fetch('/api/drafts/delete-document', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ mobileNumber: activeCustMob, docType, memberIndex })
                    });
                    const d = await res.json();
                    if (d.success) {
                        if (typeof showEsevaToast === 'function') {
                            showEsevaToast('🗑️ ஆவணம் வெற்றிகரமாக நீக்கப்பட்டது!', 'success');
                        }
                        if (typeof fetchOperatorDrafts === 'function') fetchOperatorDrafts();
                        if (typeof resetSidebarDocsCache === 'function') resetSidebarDocsCache();
                        if (typeof updateSidebarDocumentsList === 'function') updateSidebarDocumentsList(activeCustMob, true);
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
                if (targetMobile) {
                    const cleanMob = String(targetMobile).replace(/\D/g, '');
                    localStorage.setItem('eseva_active_customer_mobile', cleanMob);
                }
                let data = currentCitizenData || {};
                const activeCustMob = (targetMobile ? String(targetMobile).replace(/\D/g, '') : '') || localStorage.getItem('eseva_active_customer_mobile') || data.mobileNumber || '';
                originalEditingMobile = activeCustMob;

            // If data is empty, missing name/fields, or targetMobile explicitly supplied, pull directly from draft API
            if (activeCustMob && (!data.fullNameEng && !data.fullNameTam || targetMobile)) {
                try {
                    const dRes = await fetch(`/api/drafts/${activeCustMob}`);
                    const dJson = await dRes.json();
                    if (dJson && dJson.draft && dJson.draft.citizenProfile) {
                        data = Object.assign({}, dJson.draft.citizenProfile, {
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

            // Subservice mode determination: strictly based on active citizen subService state, NEVER scraping chat text DOM!
            const curSub = String(data.subService || window.lastSubService || '').toUpperCase();
            const curIntake = String(data.intakeState || '').toUpperCase();
            const sData = data.subServiceData || window.lastSubServiceData || {};

            const isAddMember = !forceMasterProfile && (curSub === 'ADD_MEMBER' || curIntake.startsWith('RATION_ADD_MEMBER'));
            const isRemoveMember = !forceMasterProfile && !isAddMember && (curSub === 'REMOVE_MEMBER' || curIntake.startsWith('RATION_REMOVE_MEMBER'));
            const isChangeAddress = !forceMasterProfile && !isAddMember && !isRemoveMember && (curSub === 'CHANGE_ADDRESS' || curSub === 'ADDRESS_CHANGE' || curIntake.startsWith('RATION_CHANGE_ADDRESS'));
            const hasActiveSub = Boolean(curSub === 'ADD_MEMBER' || curSub === 'CHANGE_ADDRESS' || curSub === 'ADDRESS_CHANGE' || curSub === 'REMOVE_MEMBER' || curIntake.startsWith('RATION_ADD_MEMBER') || curIntake.startsWith('RATION_CHANGE_ADDRESS') || curIntake.startsWith('RATION_REMOVE_MEMBER'));

            const titleEl = document.getElementById('editModalTitle');
            const subTitleEl = document.getElementById('editModalSubtitle');
            const btnMaster = document.getElementById('btnSwitchToMasterProfile');
            const btnSubSvc = document.getElementById('btnSwitchToSubService');

            if (isAddMember) {
                // Configure UI elements for Add Member mode
                if (titleEl) titleEl.innerHTML = '✏️ சேர்க்கப்படும் குடும்ப உறுப்பினர் விவரங்கள் (Add Member Details)';
                if (subTitleEl) subTitleEl.innerText = 'ஸ்மார்ட் கார்டு எண் & புதிய உறுப்பினர் விவரங்களை மட்டும் சரிபார்க்கவும்';
                if (btnMaster) btnMaster.style.display = 'inline-flex';
                if (btnSubSvc) btnSubSvc.style.display = 'none';

                if (document.getElementById('editNewCardDocBoxesWrap')) document.getElementById('editNewCardDocBoxesWrap').style.display = 'none';
                if (document.getElementById('editAddMemberDocBoxesWrap')) document.getElementById('editAddMemberDocBoxesWrap').style.display = 'grid';
                if (document.getElementById('editRemoveMemberDocBoxesWrap')) document.getElementById('editRemoveMemberDocBoxesWrap').style.display = 'none';
                if (document.getElementById('editChangeAddressDocBoxesWrap')) document.getElementById('editChangeAddressDocBoxesWrap').style.display = 'none';

                if (document.getElementById('editNewCardFieldsWrap')) document.getElementById('editNewCardFieldsWrap').style.display = 'none';
                if (document.getElementById('editAddMemberFieldsWrap')) document.getElementById('editAddMemberFieldsWrap').style.display = 'grid';
                if (document.getElementById('editRemoveMemberFieldsWrap')) document.getElementById('editRemoveMemberFieldsWrap').style.display = 'none';
                if (document.getElementById('editChangeAddressFieldsWrap')) document.getElementById('editChangeAddressFieldsWrap').style.display = 'none';

                // Resolve member Aadhaar and proof documents
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
                        if (docListJson && docListJson.documents && Array.isArray(docListJson.documents)) {
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

                const proofBox = document.getElementById('editAddMemberProofBox');
                if (proofBox) {
                    const proofTitle = document.getElementById('editAddMemberProofTitle');
                    if (proofTitle) {
                        proofTitle.innerText = sData.isChild ? '📄 குழந்தையின் பிறப்புச் சான்றிதழ்' : '📄 உறவுமுறை / நீக்கல் சான்று';
                    }
                    renderDocPreview(proofPath, 'editAddMemberProofPreview', 'editAddMemberProofPlaceholder', 'editAddMemberProofPdfBadge', 'editAddMemberProofStatus', 'editAddMemberProofViewBtn', sData.isChild ? 'பிறப்புச் சான்றிதழ் தேவை' : 'உறவுமுறை சான்று தேவை', 'editAddMemberProofDeleteBtn');
                }

                // Populate Add Member input fields
                const cardEl = document.getElementById('editAddMemberCardNo');
                if (cardEl) cardEl.value = data.smartCardNumber || data.rationCardNo || sData.smartCardNumber || '';

                const relEl = document.getElementById('editAddMemberRel');
                if (relEl) {
                    const relVal = sData.relationshipTam || sData.relationship || 'மகன்';
                    relEl.value = relVal;
                    if (!relEl.value && relVal) {
                        for (let opt of relEl.options) {
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

                document.getElementById('editModal').style.display = 'flex';
                return;
            }

            if (isChangeAddress) {
                // Configure UI elements for Change Address mode
                if (titleEl) titleEl.innerHTML = '✏️ குடும்ப அட்டை புதிய முகவரி விவரங்கள் (Change Address Details)';
                if (subTitleEl) subTitleEl.innerText = 'புதிய முகவரி மற்றும் முகவரிச் சான்றை மட்டும் சரிபார்க்கவும்';
                if (btnMaster) btnMaster.style.display = 'inline-flex';
                if (btnSubSvc) btnSubSvc.style.display = 'none';

                if (document.getElementById('editNewCardDocBoxesWrap')) document.getElementById('editNewCardDocBoxesWrap').style.display = 'none';
                if (document.getElementById('editAddMemberDocBoxesWrap')) document.getElementById('editAddMemberDocBoxesWrap').style.display = 'none';
                if (document.getElementById('editRemoveMemberDocBoxesWrap')) document.getElementById('editRemoveMemberDocBoxesWrap').style.display = 'none';
                if (document.getElementById('editChangeAddressDocBoxesWrap')) document.getElementById('editChangeAddressDocBoxesWrap').style.display = 'grid';

                if (document.getElementById('editNewCardFieldsWrap')) document.getElementById('editNewCardFieldsWrap').style.display = 'none';
                if (document.getElementById('editAddMemberFieldsWrap')) document.getElementById('editAddMemberFieldsWrap').style.display = 'none';
                if (document.getElementById('editRemoveMemberFieldsWrap')) document.getElementById('editRemoveMemberFieldsWrap').style.display = 'none';
                if (document.getElementById('editChangeAddressFieldsWrap')) document.getElementById('editChangeAddressFieldsWrap').style.display = 'grid';

                // Populate Change Address fields
                const cardEl = document.getElementById('editAddressCardNo');
                if (cardEl) cardEl.value = data.smartCardNumber || data.rationCardNo || sData.smartCardNumber || '';

                const proofTypeEl = document.getElementById('editAddressProofType');
                if (proofTypeEl) {
                    const val = sData.proofType || data.residenceProof?.typeTam || '';
                    if (val) {
                        proofTypeEl.value = val;
                        if (!proofTypeEl.value) {
                            for (let opt of proofTypeEl.options) {
                                if (opt.value.includes(val) || opt.text.includes(val)) {
                                    proofTypeEl.value = opt.value;
                                    break;
                                }
                            }
                        }
                    }
                }

                const doorEl = document.getElementById('editAddressDoorNo');
                if (doorEl) doorEl.value = sData.doorNo || sData.newDoorNo || data.doorNo || '';

                const stTamEl = document.getElementById('editAddressStreetTam');
                if (stTamEl) stTamEl.value = sData.streetTam || sData.newStreet || data.streetTam || data.streetEng || '';

                const stEngEl = document.getElementById('editAddressStreetEng');
                if (stEngEl) stEngEl.value = sData.streetEng || data.streetEng || '';

                const areaEl = document.getElementById('editAddressAreaTam');
                if (areaEl) areaEl.value = sData.areaTam || data.areaTam || data.village || '';

                const pinEl = document.getElementById('editAddressPin');
                if (pinEl) pinEl.value = sData.pincode || sData.newPincode || data.pincode || '';

                const distEl = document.getElementById('editAddressDistrict');
                if (distEl) distEl.value = sData.district || sData.newDistrict || data.district || '';

                const talukEl = document.getElementById('editAddressTaluk');
                if (talukEl) talukEl.value = sData.taluk || sData.newTaluk || data.taluk || '';

                const villEl = document.getElementById('editAddressVillage');
                if (villEl) villEl.value = sData.village || sData.newVillage || data.village || '';

                // Address proof document preview
                let addrDocPath = sData.docPath || data.residenceProof?.docPath || data.gasDetails?.gasBookPath || data.documents?.residenceProof || data.documents?.gasBook || '';
                if (!addrDocPath && activeCustMob) {
                    try {
                        const docListRes = await fetch(`/api/drafts/${encodeURIComponent(activeCustMob)}/documents-list`);
                        const docListJson = await docListRes.json();
                        if (docListJson && docListJson.documents && Array.isArray(docListJson.documents)) {
                            const foundDoc = docListJson.documents.find(d => d.type === 'gasBook' || d.type === 'residenceProof' || d.type === 'headAadhaar');
                            if (foundDoc) addrDocPath = foundDoc.previewUrl;
                        }
                    } catch (e) {
                        console.warn('Failed to fetch doc list for Change Address preview:', e);
                    }
                }

                renderDocPreview(addrDocPath, 'editAddressProofPreview', 'editAddressProofPlaceholder', 'editAddressProofPdfBadge', 'editAddressProofStatus', 'editAddressProofViewBtn', 'முகவரிச் சான்று தேவை', 'editAddressProofDeleteBtn');

                document.getElementById('editModal').style.display = 'flex';
                return;
            }

            if (isRemoveMember) {
                // Configure UI elements for Remove Member mode
                if (titleEl) titleEl.innerHTML = '✏️ நீக்கப்படும் குடும்ப உறுப்பினர் விவரங்கள் (Remove Member Details)';
                if (subTitleEl) subTitleEl.innerText = 'குடும்ப அட்டை எண் & நீக்கப்படும் உறுப்பினர் விவரங்களை மட்டும் சரிபார்க்கவும்';
                if (btnMaster) btnMaster.style.display = 'inline-flex';
                if (btnSubSvc) btnSubSvc.style.display = 'none';

                if (document.getElementById('editNewCardDocBoxesWrap')) document.getElementById('editNewCardDocBoxesWrap').style.display = 'none';
                if (document.getElementById('editAddMemberDocBoxesWrap')) document.getElementById('editAddMemberDocBoxesWrap').style.display = 'none';
                if (document.getElementById('editRemoveMemberDocBoxesWrap')) document.getElementById('editRemoveMemberDocBoxesWrap').style.display = 'grid';
                if (document.getElementById('editChangeAddressDocBoxesWrap')) document.getElementById('editChangeAddressDocBoxesWrap').style.display = 'none';

                if (document.getElementById('editNewCardFieldsWrap')) document.getElementById('editNewCardFieldsWrap').style.display = 'none';
                if (document.getElementById('editAddMemberFieldsWrap')) document.getElementById('editAddMemberFieldsWrap').style.display = 'none';
                if (document.getElementById('editRemoveMemberFieldsWrap')) document.getElementById('editRemoveMemberFieldsWrap').style.display = 'grid';
                if (document.getElementById('editChangeAddressFieldsWrap')) document.getElementById('editChangeAddressFieldsWrap').style.display = 'none';

                let proofPath = sData.docPath || sData.removeProofDocPath || data.documents?.removeProof || '';
                renderDocPreview(proofPath, 'editRemoveMemberProofPreview', 'editRemoveMemberProofPlaceholder', 'editRemoveMemberProofPdfBadge', 'editRemoveMemberProofStatus', 'editRemoveMemberProofViewBtn', 'நீக்கல் சான்றிதழ் தேவை', 'editRemoveMemberProofDeleteBtn');

                const proofTitle = document.getElementById('editRemoveMemberProofTitle');
                if (proofTitle) {
                    proofTitle.innerText = `📄 ${sData.docType || 'நீக்கல் சான்றிதழ் / ஆவணம்'}`;
                }

                // Populate fields
                const cardEl = document.getElementById('editRemoveMemberCardNo');
                if (cardEl) cardEl.value = data.smartCardNumber || data.rationCardNo || sData.smartCardNumber || '';

                const reasonEl = document.getElementById('editRemoveMemberReason');
                if (reasonEl && sData.reason) {
                    reasonEl.value = sData.reason;
                    if (!reasonEl.value) {
                        for (let opt of reasonEl.options) {
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
                        for (let opt of docTypeEl.options) {
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

                document.getElementById('editModal').style.display = 'flex';
                return;
            }

            // Physical disk document verification: single source of truth from backend documents-list
            let verifiedPhysicalDocs = [];
            if (activeCustMob) {
                try {
                    const docListRes = await fetch(`/api/drafts/${encodeURIComponent(activeCustMob)}/documents-list`);
                    const docListJson = await docListRes.json();
                    if (docListJson && docListJson.success && Array.isArray(docListJson.documents)) {
                        verifiedPhysicalDocs = docListJson.documents;
                    }
                } catch (e) {
                    console.warn('Failed to fetch verified docs list:', e);
                }
            }
            const getVerifiedDoc = (type) => verifiedPhysicalDocs.find(d => d.type === type);

            // Subservice vs Master vs New Ration Card Mode Dynamic Labeling
            const isRationHead = !forceMasterProfile && (
                String(data.service || '').toLowerCase().includes('ration') || 
                String(data.service || '').includes('ரேஷன்') || 
                String(data.service || '').includes('smart_card')
            ) && !isAddMember && !isRemoveMember && !isChangeAddress;

            if (forceMasterProfile) {
                if (titleEl) titleEl.innerHTML = '👤 வாடிக்கையாளர் மாஸ்டர் சுயவிவரம் (Citizen Master Profile Vault)';
                if (subTitleEl) subTitleEl.innerText = 'குடும்பத் தலைவரின் நிரந்தர சுயவிவரம் மற்றும் அனைத்து அசல் ஆவணங்கள்';
                if (hasActiveSub) {
                    if (btnMaster) btnMaster.style.display = 'none';
                    if (btnSubSvc) btnSubSvc.style.display = 'inline-flex';
                } else {
                    if (btnMaster) btnMaster.style.display = 'none';
                    if (btnSubSvc) btnSubSvc.style.display = 'none';
                }
            } else {
                if (titleEl) titleEl.innerHTML = '✏️ புதிய குடும்ப அட்டை விண்ணப்ப விவரங்கள் (New Ration Card)';
                if (subTitleEl) subTitleEl.innerText = 'அனைத்து விவரங்களையும் சரிபார்த்து திருத்தவும்';
                if (btnMaster) btnMaster.style.display = 'none';
                if (btnSubSvc) btnSubSvc.style.display = 'none';
            }

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
                gasToggleWrap.style.display = isRationHead ? 'block' : 'none';
            }
            const gasFieldsWrap = document.getElementById('gasFieldsWrap');
            if (gasFieldsWrap && !isRationHead) {
                gasFieldsWrap.style.display = 'none';
            }

            // Normal New Ration Card Mode or Master Profile Vault Mode
            if (document.getElementById('editNewCardDocBoxesWrap')) document.getElementById('editNewCardDocBoxesWrap').style.display = 'grid';
            if (document.getElementById('editAddMemberDocBoxesWrap')) document.getElementById('editAddMemberDocBoxesWrap').style.display = 'none';
            if (document.getElementById('editRemoveMemberDocBoxesWrap')) document.getElementById('editRemoveMemberDocBoxesWrap').style.display = 'none';
            if (document.getElementById('editChangeAddressDocBoxesWrap')) document.getElementById('editChangeAddressDocBoxesWrap').style.display = 'none';
            if (document.getElementById('editNewCardFieldsWrap')) document.getElementById('editNewCardFieldsWrap').style.display = 'contents';
            if (document.getElementById('editAddMemberFieldsWrap')) document.getElementById('editAddMemberFieldsWrap').style.display = 'none';
            if (document.getElementById('editRemoveMemberFieldsWrap')) document.getElementById('editRemoveMemberFieldsWrap').style.display = 'none';
            if (document.getElementById('editChangeAddressFieldsWrap')) document.getElementById('editChangeAddressFieldsWrap').style.display = 'none';
            if (document.getElementById('editAddMemberFieldsWrap')) document.getElementById('editAddMemberFieldsWrap').style.display = 'none';
            if (document.getElementById('editRemoveMemberFieldsWrap')) document.getElementById('editRemoveMemberFieldsWrap').style.display = 'none';

            // 1. Photo (Strict Physical Disk Verification)
            const foundPhoto = getVerifiedDoc('profilePhoto') || getVerifiedDoc('headPhoto');
            renderDocPreview(foundPhoto ? foundPhoto.previewUrl : '', 'editPhotoPreview', 'editPhotoPlaceholder', null, 'editPhotoStatus', 'editPhotoViewBtn', 'பாஸ்போர்ட் புகைப்படம் தேவை', 'editPhotoDeleteBtn', foundPhoto ? foundPhoto.isPdf : false);

            // 2. Aadhaar (Strict Physical Disk Verification)
            const foundHeadAadh = getVerifiedDoc('headAadhaar');
            renderDocPreview(foundHeadAadh ? foundHeadAadh.previewUrl : '', 'editHeadAadhaarPreview', 'editHeadAadhaarPlaceholder', 'editHeadAadhaarPdfBadge', 'editHeadAadhaarStatus', 'editHeadAadhaarViewBtn', 'ஆதார் அட்டை தேவை', 'editHeadAadhaarDeleteBtn', foundHeadAadh ? foundHeadAadh.isPdf : false);

            // 3. Residence Proof / Gas Book (Strict Physical Disk Verification)
            const foundResidence = getVerifiedDoc('residenceProof') || getVerifiedDoc('gasBook');
            renderDocPreview(foundResidence ? foundResidence.previewUrl : '', 'editResidencePreview', 'editResidencePlaceholder', 'editResidencePdfBadge', 'editResidenceDocStatus', 'editResidenceViewBtn', 'கேஸ் புக் / இருப்பிடம் தேவை', 'editResidenceDeleteBtn', foundResidence ? foundResidence.isPdf : false);

            // 4. Smart Ration Card (Strict Physical Disk Verification)
            const foundSmartCard = getVerifiedDoc('smartCard') || getVerifiedDoc('rationCard');
            renderDocPreview(foundSmartCard ? foundSmartCard.previewUrl : '', 'editSmartCardPreview', 'editSmartCardPlaceholder', 'editSmartCardPdfBadge', 'editSmartCardStatus', 'editSmartCardViewBtn', 'ஸ்மார்ட் கார்டு தேவை', 'editSmartCardDeleteBtn', foundSmartCard ? foundSmartCard.isPdf : false);

            // 4. Family Members Aadhaar
            const membersContainer = document.getElementById('editMembersAadhaarContainer');
            if (membersContainer) {
                membersContainer.innerHTML = '';
                const members = (data.members || []).slice(1);
                if (members.length > 0) {
                    let memHtml = `<div style="font-weight: 700; color: #1e293b; font-size: 12px; margin-top: 4px;">👥 குடும்ப உறுப்பினர்கள் ஆதார் (Family Members Aadhaar):</div>`;
                    members.forEach((m, idx) => {
                        const mIdx = idx + 1;
                        const mName = m.nameTam ? `${m.nameTam} (${m.nameEng || ''})` : (m.nameEng || `உறுப்பினர் ${mIdx}`);
                        const mRel = m.relationshipTam || m.relationship || '';
                        const mDoc = m.docPath || '';
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
                                        <i id="editMemberAadhaarPlaceholder_${mIdx}" class="fa-solid fa-id-card" style="font-size: 26px; color: #2563eb; display: ${!mDoc ? 'block' : 'none'};"></i>
                                        <div id="editMemberAadhaarPdfBadge_${mIdx}" style="display: ${isPdf ? 'flex' : 'none'}; width: 100%; height: 100%; background: #fee2e2; color: #dc2626; font-weight: 800; font-size: 13px; align-items: center; justify-content: center; flex-direction: column; gap: 2px;">
                                            <i class="fa-solid fa-file-pdf" style="font-size: 24px;"></i>
                                            <span>PDF</span>
                                        </div>
                                    </div>
                                    <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center;">
                                        <div style="font-weight: 700; font-size: 12.5px; color: #0f172a; margin-bottom: 2px;">👥 உறுப்பினர் ${mIdx + 1}: ${mName} ${mRel ? `(${mRel})` : ''}</div>
                                        <div id="editMemberAadhaarStatus_${mIdx}" style="font-size: 11px; color: ${mDoc ? '#16a34a' : '#64748b'}; margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                            ${mDoc ? `✅ ${mFileName.length > 20 ? mFileName.substring(0, 18) + '...' : mFileName}` : 'ஆதார் அட்டை தேவை'}
                                        </div>
                                        <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
                                            <input type="file" id="editMemberAadhaarInput_${mIdx}" accept="image/*,application/pdf" multiple style="display: none;" onchange="handleEditDocChosen('memberAadhaar', event, ${mIdx})">
                                            <input type="file" id="editMemberAadhaarBackInput_${mIdx}" accept="image/*,application/pdf" style="display: none;" onchange="handleEditDocChosen('memberAadhaarBack', event, ${mIdx})">
                                            <button type="button" onclick="document.getElementById('editMemberAadhaarInput_${mIdx}').click()" style="height: 32px; padding: 0 10px; background: #eff6ff; border: 1.5px solid #93c5fd; color: #1d4ed8; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                                                <i class="fa-solid fa-file-arrow-up"></i> முன்பக்கம்
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
                                            <option value="மனைவி" ${mRel.includes('மனைவி') || mRel.toLowerCase().includes('wife') ? 'selected' : ''}>மனைவி (Wife)</option>
                                            <option value="கணவர்" ${mRel.includes('கணவர்') || mRel.toLowerCase().includes('husband') ? 'selected' : ''}>கணவர் (Husband)</option>
                                            <option value="மகன்" ${mRel.includes('மகன்') || mRel.toLowerCase().includes('son') ? 'selected' : ''}>மகன் (Son)</option>
                                            <option value="மகள்" ${mRel.includes('மகள்') || mRel.toLowerCase().includes('daughter') ? 'selected' : ''}>மகள் (Daughter)</option>
                                            <option value="தந்தை" ${mRel.includes('தந்தை') || mRel.toLowerCase().includes('father') ? 'selected' : ''}>தந்தை (Father)</option>
                                            <option value="தாய்" ${mRel.includes('தாய்') || mRel.toLowerCase().includes('mother') ? 'selected' : ''}>தாய் (Mother)</option>
                                            <option value="சகோதரர்" ${mRel.includes('சகோதர') || mRel.toLowerCase().includes('brother') ? 'selected' : ''}>சகோதரர் (Brother)</option>
                                            <option value="சகோதரி" ${mRel.includes('சகோதரி') || mRel.toLowerCase().includes('sister') ? 'selected' : ''}>சகோதரி (Sister)</option>
                                            <option value="மற்றவை" ${!['மனைவி','கணவர்','மகன்','மகள்','தந்தை','தாய்','சகோதரர்','சகோதரி'].some(x => mRel.includes(x)) ? 'selected' : ''}>மற்றவை (Others)</option>
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
                                        <input type="text" id="editMemberAadhaar_${mIdx}" value="${(m.aadhaarNumber || '').replace(/(\d{4})/g, '$1 ').trim()}" placeholder="1234 5678 9012" maxlength="14" style="width: 100%; padding: 5px 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px; font-weight: 700; letter-spacing: 0.5px;">
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
                safeSetVal('editFatherTam', data.fatherNameTam);
                safeSetVal('editFatherEng', data.fatherNameEng);
                safeSetVal('editMotherTam', data.motherNameTam || data.motherName);
                safeSetVal('editMotherEng', data.motherNameEng || data.motherName);
                safeSetVal('editDob', data.headDob);
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
                
                const hasGas = !!(data.gasDetails && data.gasDetails.hasGas && data.gasDetails.consumerNumber);
                const editHasGasEl = document.getElementById('editHasGas');
                if (editHasGasEl) editHasGasEl.checked = hasGas;
                if (typeof toggleGasFields === 'function') {
                    toggleGasFields(hasGas);
                } else {
                    const wrap = document.getElementById('gasFieldsWrap');
                    if (wrap) wrap.style.display = hasGas ? 'grid' : 'none';
                }

                safeSetVal('editGasCompany', data.gasDetails?.oilCompany || 'IOC');
                safeSetVal('editGasNo', data.gasDetails?.consumerNumber || '');
                safeSetVal('editGasAgency', data.gasDetails?.agencyName || '');
                safeSetVal('editGasCyl', data.gasDetails?.cylinders || '1');
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

        function closeEditModal() {
            const modalEl = document.getElementById('editModal');
            if (modalEl) modalEl.style.display = 'none';
            currentEditModalIsMasterProfile = false;
            window.forceMasterProfile = false;
        }
        window.closeEditModal = closeEditModal;

        async function submitDirectlyFromEditModal() {
            const btn = document.getElementById('btnSubmitFromEditModal');
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> சேமித்து சமர்ப்பிக்கப்படுகிறது...';
            }
            try {
                // 1. Save all edited fields & pending uploads silently
                await saveEditedProfile(true);
                closeEditModal();
                // 2. Direct portal submit
                proceedConfirmedSubmit(true);
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
                        if (isMobileChanged) {
                            fd.append('oldMobileNumber', originalEditingMobile);
                        }
                        if (item.memberIndex) fd.append('memberIndex', String(item.memberIndex));

                        const upRes = await fetch('/api/drafts/upload-document', {
                            method: 'POST',
                            headers: {
                                'x-session-mobile': targetMob,
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

            // 2. Update profile details
            const curSub = String(currentCitizenData?.subService || window.lastSubService || '').toUpperCase();
            const curIntake = String(currentCitizenData?.intakeState || '').toUpperCase();
            const sData = (currentCitizenData && currentCitizenData.subServiceData) || window.lastSubServiceData || {};
            const isAddMember = !forceMasterProfile && (curSub === 'ADD_MEMBER' || curIntake.startsWith('RATION_ADD_MEMBER')) && 
                                Boolean(sData.memberName || sData.memberNameTam || sData.aadhaarNo || sData.relationship || sData.smartCardNumber || currentCitizenData.tempMember);
            const isRemoveMember = !forceMasterProfile && !isAddMember && (curSub === 'REMOVE_MEMBER' || curIntake.startsWith('RATION_REMOVE_MEMBER'));
            const isChangeAddress = !forceMasterProfile && !isAddMember && !isRemoveMember && (curSub === 'CHANGE_ADDRESS' || curSub === 'ADDRESS_CHANGE' || curIntake.startsWith('RATION_CHANGE_ADDRESS'));

            let updated = {};
            if (isAddMember) {
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

                let existingMembers = (currentCitizenData && Array.isArray(currentCitizenData.members)) ? [...currentCitizenData.members] : [];
                if (existingMembers.length > 0) {
                    const foundIdx = existingMembers.findIndex((m, idx) => idx > 0 && ((m.aadhaarNumber && m.aadhaarNumber === memAadhaar) || (m.nameEng && m.nameEng === memNameEng)));
                    if (foundIdx !== -1) {
                        existingMembers[foundIdx] = { ...existingMembers[foundIdx], ...updatedMember };
                    } else {
                        existingMembers.push(updatedMember);
                    }
                } else {
                    existingMembers = [updatedMember];
                }

                updated = {
                    subService: 'ADD_MEMBER',
                    smartCardNumber: memCard,
                    rationCardNo: memCard,
                    fullNameTam: memNameTam,
                    fullNameEng: memNameEng,
                    subServiceData: updatedSubServiceData,
                    members: existingMembers
                };
            } else if (isChangeAddress) {
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

                const updatedSubServiceData = {
                    ...sData,
                    subService: 'CHANGE_ADDRESS',
                    smartCardNumber: cardNo,
                    rationCardNo: cardNo,
                    proofType: proofType,
                    doorNo: doorNo,
                    newDoorNo: doorNo,
                    streetTam: streetTam,
                    streetEng: streetEng,
                    newStreet: streetEng || streetTam,
                    areaTam: areaTam,
                    pincode: pin,
                    newPincode: pin,
                    district: district,
                    newDistrict: district,
                    taluk: taluk,
                    newTaluk: taluk,
                    village: village,
                    newVillage: village
                };

                updated = {
                    subService: 'CHANGE_ADDRESS',
                    smartCardNumber: cardNo,
                    rationCardNo: cardNo,
                    doorNo: doorNo,
                    streetTam: streetTam,
                    streetEng: streetEng,
                    areaTam: areaTam,
                    pincode: pin,
                    district: district,
                    taluk: taluk,
                    village: village,
                    subServiceData: updatedSubServiceData
                };
            } else if (isRemoveMember) {
                const cardNo = document.getElementById('editRemoveMemberCardNo')?.value.trim() || '';
                const reason = document.getElementById('editRemoveMemberReason')?.value || 'இறப்பு (Death of Member)';
                const nameTam = document.getElementById('editRemoveMemberNameTam')?.value.trim() || '';
                const nameEng = document.getElementById('editRemoveMemberNameEng')?.value.trim() || '';
                const docType = document.getElementById('editRemoveMemberDocType')?.value || 'இறப்புச் சான்றிதழ் (Death Certificate)';
                const aadhaarNo = (document.getElementById('editRemoveMemberAadhaar')?.value || '').replace(/\s+/g, '');

                const updatedSubServiceData = {
                    ...sData,
                    subService: 'REMOVE_MEMBER',
                    smartCardNumber: cardNo,
                    rationCardNo: cardNo,
                    reason: reason,
                    memberNameTam: nameTam,
                    memberNameEng: nameEng,
                    memberName: nameEng || nameTam,
                    docType: docType,
                    aadhaarNo: aadhaarNo
                };

                updated = {
                    subService: 'REMOVE_MEMBER',
                    smartCardNumber: cardNo,
                    rationCardNo: cardNo,
                    fullNameTam: nameTam,
                    fullNameEng: nameEng,
                    subServiceData: updatedSubServiceData
                };
            } else {
                const hasGas = document.getElementById('editHasGas').checked;
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

                    if (mNameTamEl || mNameEngEl || mAadhEl) {
                        existingMembers[idx] = {
                            ...existingMembers[idx],
                            nameTam: mNameTamEl ? mNameTamEl.value.trim() : existingMembers[idx].nameTam,
                            nameEng: mNameEngEl ? mNameEngEl.value.trim() : existingMembers[idx].nameEng,
                            name: (mNameEngEl && mNameEngEl.value.trim()) || (mNameTamEl && mNameTamEl.value.trim()) || existingMembers[idx].name,
                            relationshipTam: mRelEl ? mRelEl.value : existingMembers[idx].relationshipTam,
                            relationship: mRelEl ? mRelEl.value : existingMembers[idx].relationship,
                            dob: mDobEl ? mDobEl.value.trim() : existingMembers[idx].dob,
                            gender: mGenEl ? mGenEl.value : existingMembers[idx].gender,
                            genderTam: mGenEl ? (mGenEl.value === 'Female' ? 'பெண்' : 'ஆண்') : existingMembers[idx].genderTam,
                            aadhaarNumber: mAadhEl ? mAadhEl.value.replace(/\s+/g, '') : existingMembers[idx].aadhaarNumber
                        };
                    }
                }

                const keepSub = forceMasterProfile ? (currentCitizenData?.subService || null) : null;
                const keepSubData = forceMasterProfile ? (currentCitizenData?.subServiceData || null) : null;

                updated = {
                    subService: keepSub,
                    subServiceData: keepSubData,
                    fullNameTam: document.getElementById('editNameTam').value.trim(),
                    fullNameEng: document.getElementById('editNameEng').value.trim(),
                    fatherNameTam: document.getElementById('editFatherTam').value.trim(),
                    fatherNameEng: document.getElementById('editFatherEng').value.trim(),
                    motherNameTam: document.getElementById('editMotherTam')?.value.trim() || currentCitizenData?.motherNameTam || '',
                    motherNameEng: document.getElementById('editMotherEng')?.value.trim() || currentCitizenData?.motherNameEng || '',
                    headDob: document.getElementById('editDob').value.trim(),
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
                    canNumber: document.getElementById('editCanNumber')?.value.replace(/\s+/g, '') || currentCitizenData?.canNumber || '',
                    members: existingMembers,
                    gasDetails: {
                        ...(currentCitizenData ? currentCitizenData.gasDetails : {}),
                        hasGas: hasGas,
                        oilCompany: hasGas ? gasCo : '',
                        oilCompanyDisplay: hasGas ? gasCoDisplay : '',
                        consumerNumber: hasGas ? document.getElementById('editGasNo').value.trim() : '',
                        agencyName: hasGas ? document.getElementById('editGasAgency').value.trim() : '',
                        cylinders: hasGas ? document.getElementById('editGasCyl').value.trim() : '0'
                    }
                };
            }

            try {
                const res = await fetch('/api/profile/update', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'x-session-mobile': targetMob,
                        ...(isMobileChanged ? { 'x-old-session-mobile': originalEditingMobile } : {}),
                        'x-operator-uid': opUid
                    },
                    body: JSON.stringify({ 
                        ...updated, 
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

        // Initialize session check & poll history
        checkSession();
        setupChatScrollListener();
        setInterval(fetchHistory, 2500);
        setInterval(syncPortalOtpTimer, 2000);
        setInterval(syncAutomationProgress, 1500);

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