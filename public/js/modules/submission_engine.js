// eSevaDraft Domain Module: submission_engine.js

        async function proceedConfirmedSubmit(isRealLive = null) {
            const activeMob = localStorage.getItem('eseva_active_customer_mobile') || '';
            if (activeMob && (!currentCitizenData || !currentCitizenData.subService || !currentCitizenData.headAadhaar)) {
                try {
                    const dRes = await fetch(`/api/drafts/${activeMob}`);
                    const dJson = await dRes.json();
                    if (dJson && dJson.draft) {
                        currentCitizenData = Object.assign({}, currentCitizenData || {}, dJson.draft, dJson.draft.citizenProfile || {});
                    }
                } catch (_) {}
            }

            const chatText = document.getElementById('chatMessages')?.innerText || '';
            const isAddMember = (currentCitizenData && (currentCitizenData.subService === 'ADD_MEMBER' || Boolean(currentCitizenData.subServiceData?.memberName))) || 
                                (window.lastReceivedChatOptions && window.lastReceivedChatOptions.some(o => (o.label || '').includes('உறுப்பினர்'))) ||
                                chatText.includes('குடும்ப உறுப்பினர் சேர்க்கை') ||
                                chatText.includes('குழந்தை சேர்க்கை') ||
                                chatText.includes('குமரன்');

            const hasHead = currentCitizenData && (currentCitizenData.headAadhaar || (currentCitizenData.members && currentCitizenData.members.length > 0));
            if (!hasHead && !isAddMember) {
                alert('⚠️ ரேஷன் கார்டு விண்ணப்பத்தைத் தொடங்குவதற்கு முன், குடும்ப உறுப்பினர்களின் எண்ணிக்கை மற்றும் ஆவணங்களைச் சேகரிக்க வேண்டும்.');
                return;
            }

            if (isAddMember && currentCitizenData) {
                currentCitizenData.subService = 'ADD_MEMBER';
            }

            // Check if phone number is needed
            const rawMob = currentCitizenData?.mobileNumber || localStorage.getItem('eseva_active_customer_mobile') || '';
            let cleanMob = rawMob.replace(/\D/g, '');
            if (cleanMob.length === 12 && cleanMob.startsWith('91')) cleanMob = cleanMob.slice(2);
            let isRealMobile = cleanMob.length === 10 && ['6','7','8','9'].includes(cleanMob[0]);

            if (!isRealMobile) {
                if (isDevMockModeActive()) {
                    cleanMob = '9876543210';
                    isRealMobile = true;
                    if (currentCitizenData) currentCitizenData.mobileNumber = cleanMob;
                } else {
                    const inputEl = document.getElementById('preSubmitMobileInput');
                    const entered = (inputEl?.value || '').replace(/\D/g, '');
                    if (entered.length !== 10 || !['6','7','8','9'].includes(entered[0])) {
                        alert('⚠️ TNPDS போர்ட்டலில் விண்ணப்பிக்க வாடிக்கையாளரின் சரியான 10-இலக்க மொபைல் எண்ணை உள்ளிடவும்!');
                        if (inputEl) inputEl.focus();
                        return;
                    }
                    cleanMob = entered;
                }
                // Save and bind phone number
                try {
                    const activeCustMob = localStorage.getItem('eseva_active_customer_mobile') || '';
                    const opUid = localStorage.getItem('eseva_operator_uid') || '';
                    const res = await fetch('/api/profile/update', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-session-mobile': activeCustMob,
                            'x-operator-uid': opUid
                        },
                        body: JSON.stringify({ mobileNumber: entered })
                    });
                    const updateRes = await res.json();
                    if (updateRes.updatedMobile) {
                        localStorage.setItem('eseva_active_customer_mobile', updateRes.updatedMobile);
                        const titleEl = document.getElementById('activeCustomerTitle');
                        if (titleEl) {
                            titleEl.innerHTML = `<i class="fa-solid fa-user-check" style="color: #16a34a;"></i> வாடிக்கையாளர்: <b>+91 ${updateRes.updatedMobile}</b>`;
                        }
                    }
                } catch (e) {
                    console.warn('Profile update on pre-submit warning:', e);
                }
            }

            closePreSubmitModal();

            const isDev = isDevMockModeActive();
            const runAsRealLive = (isRealLive === true) || (!isDev && isRealLive !== false);

            // ✅ DESKTOP APP: Launch LOCAL visible Chrome via Electron IPC
            // Cloud Run runs headless (operator can't see). Desktop App uses local Playwright.
            const isDesktopApp = !!(window.esevaDesktopBridge && window.esevaDesktopBridge.isDesktopApp);

            if (isDesktopApp && runAsRealLive) {
                const activeMob = localStorage.getItem('eseva_active_customer_mobile') || '';
                let draftData = Object.assign({}, currentCitizenData || {});
                if (activeMob) {
                    try {
                        const dRes = await fetch(`/api/drafts/${activeMob}`);
                        const dJson = await dRes.json();
                        if (dJson && dJson.draft) {
                            const prof = dJson.draft.citizenProfile || {};
                            let fEng = (prof.fatherNameEng || draftData.fatherNameEng || '').trim();
                            let fTam = (prof.fatherNameTam || draftData.fatherNameTam || '').trim();
                            const mList = (prof.members && prof.members.length > 0) ? prof.members : (draftData.members || []);
                            if ((!fEng || !fTam) && Array.isArray(mList)) {
                                const husb = mList.find(m => m && (m.relationship === 'Husband' || m.relationshipTam === 'கணவர்'));
                                const fath = mList.find(m => m && (m.relationship === 'Father' || m.relationshipTam === 'தந்தை'));
                                const cand = husb || fath;
                                if (cand) {
                                    if (!fEng) fEng = (cand.nameEng || cand.fullNameEng || '').trim();
                                    if (!fTam) fTam = (cand.nameTam || cand.fullNameTam || '').trim();
                                }
                            }
                            if (fEng && !fTam) fTam = fEng;
                            if (fTam && !fEng) fEng = fTam;

                            draftData = Object.assign({}, draftData, dJson.draft, prof, {
                                subService: dJson.draft.subService || prof.subService || draftData.subService,
                                subServiceData: dJson.draft.subServiceData || prof.subServiceData || draftData.subServiceData,
                                intakeState: dJson.draft.intakeState || draftData.intakeState,
                                fullNameEng: prof.fullNameEng || draftData.fullNameEng,
                                fullNameTam: prof.fullNameTam || draftData.fullNameTam,
                                fatherNameEng: fEng,
                                fatherNameTam: fTam,
                                doorNo: prof.doorNo || draftData.doorNo,
                                streetTam: prof.streetTam || draftData.streetTam,
                                streetEng: prof.streetEng || draftData.streetEng,
                                areaTam: prof.areaTam || draftData.areaTam,
                                areaEng: prof.areaEng || draftData.areaEng,
                                district: prof.district || draftData.district,
                                taluk: prof.taluk || draftData.taluk,
                                village: prof.village || draftData.village,
                                pincode: prof.pincode || draftData.pincode,
                                headAadhaar: prof.headAadhaar || draftData.headAadhaar,
                                headDob: prof.headDob || draftData.headDob,
                                headGender: prof.headGender || draftData.headGender,
                                gasDetails: Object.assign({}, draftData.gasDetails || {}, prof.gasDetails || {}),
                                headPhotoPath: prof.headPhotoPath || dJson.draft.documents?.profilePhoto || draftData.headPhotoPath,
                                members: (prof.members && prof.members.length > 0) ? prof.members : draftData.members,
                                documents: dJson.draft.documents || draftData.documents,
                                base64Docs: dJson.draft.base64Docs || draftData.base64Docs || {}
                            });
                            currentCitizenData = draftData;
                        }
                    } catch (e) {
                        console.warn('Draft fetch error in desktop submit:', e);
                    }
                }
                draftData.mobileNumber = activeMob;
                draftData.operatorMobile = localStorage.getItem('eseva_user_mobile') || '';
                draftData.operatorUid = localStorage.getItem('eseva_operator_uid') || '';
                draftData.isMockSandbox = false;
                draftData.forceRealGovtOtp = true;

                // Wire real-time live automation updates into chat stream
                if (window.esevaDesktopBridge && window.esevaDesktopBridge.onAutomationUpdate && !window.__desktopUpdateListenerRegistered) {
                    window.__desktopUpdateListenerRegistered = true;
                    window.esevaDesktopBridge.onAutomationUpdate((msg) => {
                        appendLiveAutomationStep(msg);
                    });
                }
                if (window.esevaDesktopBridge && window.esevaDesktopBridge.onAutomationFinished && !window.__desktopFinishedListenerRegistered) {
                    window.__desktopFinishedListenerRegistered = true;
                    window.esevaDesktopBridge.onAutomationFinished((res) => {
                        handleAutomationFinished(res);
                    });
                }

                // Immediately show Stop Automation and Delete buttons, and activate progress bar
                const headerStop = document.getElementById('btnStopAutomationHeader');
                if (headerStop) headerStop.style.display = 'inline-flex';
                const headerClear = document.getElementById('btnClearScreenHeader') || document.getElementById('btnDeleteDraftHeader');
                if (headerClear) headerClear.style.display = 'inline-flex';
                const sidebarClear = document.getElementById('btnClearScreenSidebar') || document.getElementById('btnDeleteDraftSidebar');
                if (sidebarClear) sidebarClear.style.display = 'inline-flex';
                const pBar = document.getElementById('automationProgressBar');
                if (pBar) pBar.classList.add('active');

                appendLiveAutomationStep('🚀 **நேரலை முறை** — Chrome சாளரம் திறக்கப்படுகிறது...\n\nTNPDS போர்ட்டல் தோன்றும். கேப்ட்சா (I am human) வந்தால் நீங்களே திக் செய்யவும்.');

                try {
                    const result = await window.esevaDesktopBridge.startLiveAutomation(draftData);
                    if (result && result.success) {
                        appendLiveAutomationStep('✅ TNPDS Chrome சாளரம் திறக்கப்பட்டது! படிவம் நிரப்பப்படுகிறது — கேப்ட்சா வந்தால் திக் செய்யவும்.');
                    } else {
                        appendLiveAutomationStep(`⚠️ Chrome திறக்க முடியவில்லை: ${result?.error || 'Chrome நிறுவப்பட்டுள்ளதா சரிபார்க்கவும்.'}`);
                    }
                } catch (e) {
                    appendLiveAutomationStep(`⚠️ பிழை: ${e.message}`);
                }
            } else if (runAsRealLive) {
                sendTextMessage('Start', true, { forceRealGovtOtp: true, isMockSandbox: false });
            } else {
                sendTextMessage('Mock Test', true, { forceRealGovtOtp: false, isMockSandbox: true });
            }
        }

        async function sendTextMessage(overrideText, bypassConfirm, extraPayload = {}) {
            const text = overrideText || userInput.value.trim();
            if (!text) return;

            if (text.startsWith('DOWNLOAD_PDF_')) {
                const ref = text.replace('DOWNLOAD_PDF_', '').trim();
                downloadTnpdsPdfFromInput(ref);
                return;
            }

            const isOp = localStorage.getItem('eseva_user_role') === 'operator';
            const activeCustMob = localStorage.getItem('eseva_active_customer_mobile') || '';
            const opUid = localStorage.getItem('eseva_operator_uid') || '';

            // If operator is active and NO valid customer mobile is set yet (or is an old walkin_ dummy),
            // prompt for real 10-digit customer mobile number before proceeding!
            if (isOp && (!activeCustMob || activeCustMob.startsWith('walkin_'))) {
                window.pendingSelectedService = text;
                if (!overrideText && userInput) userInput.value = '';
                openNewCustomerModal();
                return;
            }

            let currentCustMob = isOp ? activeCustMob : (localStorage.getItem('eseva_user_mobile') || activeCustMob);

            // Pre-submit confirmation gate & Desktop App live browser trigger
            const lowerText = text.toLowerCase();
            const isSubmitCmd = lowerText === 'start' || 
                                lowerText === 'தொடங்கு' || 
                                lowerText === 'fill' ||
                                lowerText.includes('real_live_otp') ||
                                lowerText.includes('real govt otp') ||
                                lowerText.includes('நேரலை tnpds') ||
                                lowerText.includes('submit to portal') ||
                                lowerText.includes('போர்ட்டலில் விண்ணப்பி') ||
                                lowerText.includes('விண்ணப்பிக்கத் தொடங்கு') || 
                                lowerText.includes('நேரலை விண்ணப்பம்');
            if (isSubmitCmd) {
                if (window.esevaDesktopBridge && window.esevaDesktopBridge.isDesktopApp) {
                    if (!overrideText && userInput) userInput.value = '';
                    const isRealLive = lowerText.includes('real') || lowerText.includes('நேரலை') || lowerText.includes('submit') || lowerText.includes('start') || !lowerText.includes('mock');
                    await proceedConfirmedSubmit(isRealLive);
                    return;
                }
                if (!bypassConfirm) {
                    const isSpecialSub = currentCitizenData && (currentCitizenData.subService === 'ADD_MEMBER' || currentCitizenData.subService === 'CHANGE_ADDRESS');
                    const hasHead = currentCitizenData && (currentCitizenData.headAadhaar || (currentCitizenData.members && currentCitizenData.members.length > 0) || isSpecialSub);
                    if (hasHead && !isSpecialSub) {
                        openPreSubmitModal();
                        return;
                    }
                }
            }

            if (!overrideText) userInput.value = '';

            try {
                const isDev = isDevMockModeActive();
                const res = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'x-session-mobile': currentCustMob,
                        'x-operator-uid': opUid,
                        'x-dev-mode': isDev ? 'true' : 'false'
                    },
                    body: JSON.stringify({ message: text, mobileNumber: currentCustMob, ...extraPayload })
                });
                const data = await res.json();
                if (data.activeMobile && /^[6-9]\d{9}$/.test(data.activeMobile)) {
                    localStorage.setItem('eseva_active_customer_mobile', data.activeMobile);
                }
                renderMessages(data.chatHistory, true);
                updateSidebar(data);
            } catch (e) {
                console.error('Send message failed:', e);
            }
        }

        function handleKeyPress(e) {
            if (e.key === 'Enter') sendTextMessage();
        }

        async function handleFileUpload(event) {
            const file = event.target.files[0];
            if (!file) return;

            // Reset file input so user can re-select same file if needed
            event.target.value = '';

            const isOp = localStorage.getItem('eseva_user_role') === 'operator';
            const activeCustMob = localStorage.getItem('eseva_active_customer_mobile') || '';
            const opUid = localStorage.getItem('eseva_operator_uid') || '';

            let currentCustMob = isOp ? activeCustMob : (localStorage.getItem('eseva_user_mobile') || activeCustMob);
            if (isOp && (!activeCustMob || activeCustMob.startsWith('walkin_'))) {
                alert('தயவுசெய்து முதலில் வாடிக்கையாளரின் 10-இலக்க மொபைல் எண்ணைப் பதிவு செய்யவும்.');
                openNewCustomerModal();
                return;
            }

            // Setup AI Extraction Scanner Modal
            const modal = document.getElementById('aiExtractionModal');
            const previewImg = document.getElementById('aiScanPreviewImg');
            const previewIcon = document.getElementById('aiScanPreviewIcon');
            const badge = document.getElementById('aiScanStatusBadge');
            const stepUpload = document.getElementById('aiStepUpload');
            const stepDetect = document.getElementById('aiStepDetect');
            const stepVision = document.getElementById('aiStepVision');
            const stepExtract = document.getElementById('aiStepExtract');
            const stepOptimize = document.getElementById('aiStepOptimize');


            function setStepState(el, state) {
                if (!el) return;
                const icon = el.querySelector('.step-icon');
                if (state === 'pending') {
                    el.style.opacity = '0.35';
                    el.classList.remove('active', 'done');
                    if (icon) icon.className = 'fa-regular fa-circle step-icon';
                    if (icon) icon.style.color = '#94a3b8';
                } else if (state === 'active') {
                    el.style.opacity = '1';
                    el.classList.add('active');
                    el.classList.remove('done');
                    if (icon) icon.className = 'fa-solid fa-circle-notch fa-spin step-icon';
                    if (icon) icon.style.color = '#3b82f6';
                } else if (state === 'done') {
                    el.style.opacity = '1';
                    el.classList.remove('active');
                    el.classList.add('done');
                    if (icon) icon.className = 'fa-solid fa-circle-check step-icon';
                    if (icon) icon.style.color = '#16a34a';
                }
            }

            [stepUpload, stepDetect, stepVision, stepExtract, stepOptimize].forEach(s => setStepState(s, 'pending'));
            setStepState(stepUpload, 'active');
            if (badge) {
                badge.innerText = 'AI SCANNING ACTIVE...';
                badge.style.color = '#4ade80';
            }

            if (file.type && file.type.startsWith('image/')) {
                previewImg.src = URL.createObjectURL(file);
                previewImg.style.display = 'block';
                previewIcon.style.display = 'none';
            } else {
                previewImg.style.display = 'none';
                previewIcon.style.display = 'block';
            }

            if (modal) modal.style.display = 'flex';

            // Progressive step simulator during AI vision analysis
            const timers = [];
            timers.push(setTimeout(() => {
                setStepState(stepUpload, 'done');
                setStepState(stepDetect, 'active');
            }, 600));

            timers.push(setTimeout(() => {
                setStepState(stepDetect, 'done');
                setStepState(stepVision, 'active');
            }, 1600));

            timers.push(setTimeout(() => {
                setStepState(stepVision, 'done');
                setStepState(stepExtract, 'active');
            }, 2800));

            timers.push(setTimeout(() => {
                setStepState(stepExtract, 'done');
                setStepState(stepOptimize, 'active');
            }, 4000));

            const formData = new FormData();
            formData.append('file', file);
            if (currentCustMob) formData.append('mobileNumber', currentCustMob);

            try {
                const res = await fetch('/api/chat', { 
                    method: 'POST', 
                    headers: {
                        'x-session-mobile': currentCustMob,
                        'x-operator-uid': opUid
                    },
                    body: formData 
                });
                const data = await res.json();
                if (data.activeMobile && /^[6-9]\d{9}$/.test(data.activeMobile)) {
                    localStorage.setItem('eseva_active_customer_mobile', data.activeMobile);
                }

                // Clear ongoing timers
                timers.forEach(t => clearTimeout(t));

                // Mark all steps completed with green checkmarks
                [stepUpload, stepDetect, stepVision, stepExtract, stepOptimize].forEach(s => setStepState(s, 'done'));
                if (badge) {
                    badge.innerText = '✅ EXTRACTION COMPLETE!';
                    badge.style.color = '#4ade80';
                }

                // Short delay so user clearly experiences the completed state
                setTimeout(() => {
                    if (modal) modal.style.display = 'none';
                    renderMessages(data.chatHistory, true);
                    updateSidebar(data);
                }, 600);

            } catch (e) {
                timers.forEach(t => clearTimeout(t));
                if (modal) modal.style.display = 'none';
                alert('பதிவேற்றம் தோல்வி: ' + e.message);
            }
        }

        function setVal(elementId, val) {
            const el = document.getElementById(elementId);
            if (!el) return;
            const targetText = (val && String(val).trim() !== '') ? String(val).trim() : '—';
            const targetClass = targetText !== '—' ? 'badge-green' : 'badge-empty';
            if (el.innerText !== targetText) el.innerText = targetText;
            if (el.className !== targetClass) el.className = targetClass;
        }


        function extractDocumentsFromProfile(prof, mobile, appNo, appPdf) {
            if (!prof) return [];
            const docs = [];
            const cleanMob = mobile || prof.mobileNumber || 'active_session';
            const cacheBust = prof._updatedAt ? new Date(prof._updatedAt).getTime() : Date.now();
            const dMap = prof.documents || {};
            const b64Map = prof.base64Docs || {};
            const sData = prof.subServiceData || window.lastSubServiceData;
            const isAddMember = prof.subService === 'ADD_MEMBER' || window.lastSubService === 'ADD_MEMBER' || Boolean(sData?.memberName || sData?.memberNameTam || sData?.memberNameEng) || (prof.intakeState && String(prof.intakeState).startsWith('RATION_ADD_MEMBER'));

            const isNewRationCard = !isAddMember && (prof.service === 'new_smart_card' || prof.service === 'புதிய ரேஷன் கார்டு' || prof.selectedService === 'NEW_RATION_CARD' || prof.subService === 'NEW_CARD' || !prof.subService);

            // 1. Photo
            if (!isAddMember && (prof.headPhotoPath || dMap.profilePhoto || prof.headPhoto || b64Map.profilePhotoBase64)) {
                docs.push({
                    type: 'profilePhoto',
                    title: isNewRationCard ? 'குடும்பத் தலைவர் புகைப்படம்' : 'விண்ணப்பதாரர் புகைப்படம்',
                    titleEng: isNewRationCard ? 'Head Passport Photo' : 'Applicant Photo',
                    downloadUrl: `/api/drafts/${encodeURIComponent(cleanMob)}/doc/profilePhoto?download=1&_t=${cacheBust}`,
                    previewUrl: `/api/drafts/${encodeURIComponent(cleanMob)}/doc/profilePhoto?_t=${cacheBust}`,
                    icon: 'fa-user',
                    isPdf: false
                });
            }

            // 2. Aadhaar
            if (!isAddMember && (prof.headAadhaar || prof.headAadhaarDocPath || dMap.headAadhaar || b64Map.headAadhaarBase64)) {
                const headName = prof.fullNameTam || prof.fullNameEng || (isNewRationCard ? 'தலைவர்' : 'விண்ணப்பதாரர்');
                const hDocStr = String(prof.headAadhaarDocPath || dMap.headAadhaar || '');
                docs.push({
                    type: 'headAadhaar',
                    title: isNewRationCard ? `குடும்பத் தலைவர் ஆதார் (${headName})` : `விண்ணப்பதாரர் ஆதார் (${headName})`,
                    titleEng: isNewRationCard ? 'Head of Family Aadhaar' : 'Applicant Aadhaar',
                    downloadUrl: `/api/drafts/${encodeURIComponent(cleanMob)}/doc/headAadhaar?download=1&_t=${cacheBust}`,
                    previewUrl: `/api/drafts/${encodeURIComponent(cleanMob)}/doc/headAadhaar?_t=${cacheBust}`,
                    icon: 'fa-id-card',
                    isPdf: hDocStr.toLowerCase().endsWith('.pdf') || hDocStr.toLowerCase().includes('merged')
                });
            }

            // 3. Smart Ration Card (if present on profile)
            if (prof.smartCardDocPath || dMap.smartCard || dMap.rationCard || b64Map.smartCardBase64) {
                const cardNo = prof.smartCardNumber || prof.rationCardNumber || prof.rationCardNo || '';
                const cardDocStr = String(prof.smartCardDocPath || dMap.smartCard || dMap.rationCard || '');
                docs.push({
                    type: 'smartCard',
                    title: cardNo ? `ஸ்மார்ட் ரேஷன் கார்டு (${cardNo})` : 'ஸ்மார்ட் ரேஷன் கார்டு',
                    titleEng: 'Smart Ration Card',
                    downloadUrl: `/api/drafts/${encodeURIComponent(cleanMob)}/doc/smartCard?download=1&_t=${cacheBust}`,
                    previewUrl: `/api/drafts/${encodeURIComponent(cleanMob)}/doc/smartCard?_t=${cacheBust}`,
                    icon: 'fa-address-card',
                    isPdf: cardDocStr.toLowerCase().endsWith('.pdf')
                });
            }

            // 3. Member Aadhaars (Only for New Smart Card)
            if (!isAddMember && prof.members && prof.members.length > 1) {
                prof.members.slice(1).forEach((m, idx) => {
                    const hasDoc = m.docPath || m.aadhaarNumber || (dMap.memberAadhaars && dMap.memberAadhaars[idx]) || dMap[`memberAadhaar_${idx}`] || (b64Map.memberAadhaarsBase64 && b64Map.memberAadhaarsBase64[idx]);
                    if (hasDoc) {
                        const mName = m.nameTam || m.nameEng || `உறுப்பினர் ${idx + 2}`;
                        const mDocStr = String(m.docPath || dMap[`memberAadhaar_${idx}`] || '');
                        docs.push({
                            type: `memberAadhaar${idx}`,
                            title: `உறுப்பினர் ஆதார் (${mName})`,
                            titleEng: `Member Aadhaar (${m.nameEng || idx + 2})`,
                            downloadUrl: `/api/drafts/${encodeURIComponent(cleanMob)}/doc/memberAadhaar${idx}?download=1&index=${idx}&_t=${cacheBust}`,
                            previewUrl: `/api/drafts/${encodeURIComponent(cleanMob)}/doc/memberAadhaar${idx}?index=${idx}&_t=${cacheBust}`,
                            icon: 'fa-address-card',
                            isPdf: mDocStr.toLowerCase().endsWith('.pdf') || mDocStr.toLowerCase().includes('merged'),
                            memberIndex: idx + 1
                        });
                    }
                });
            }

            // 4. Gas Book / Receipt (Strictly ONLY for New Smart Card)
            if (isNewRationCard && ((prof.gasDetails && (prof.gasDetails.gasBookPath || (prof.gasDetails.hasGas && prof.gasDetails.consumerNumber))) || dMap.gasBook || b64Map.gasBookBase64)) {
                const gasDocStr = String(prof.gasDetails?.gasBookPath || dMap.gasBook || '');
                docs.push({
                    type: 'gasBook',
                    title: 'எரிவாயு இணைப்பு அட்டை / ரசீது',
                    titleEng: 'Gas Consumer Book / Receipt',
                    downloadUrl: `/api/drafts/${encodeURIComponent(cleanMob)}/doc/gasBook?download=1&_t=${cacheBust}`,
                    previewUrl: `/api/drafts/${encodeURIComponent(cleanMob)}/doc/gasBook?_t=${cacheBust}`,
                    icon: 'fa-fire',
                    isPdf: gasDocStr.toLowerCase().endsWith('.pdf')
                });
            }

            // 5. Residence Proof (Strictly ONLY for New Smart Card)
            if (isNewRationCard && ((prof.residenceProof && (prof.residenceProof.docPath || prof.residenceProof.typeTam || prof.residenceProof.type)) || dMap.residenceProof || b64Map.residenceProofBase64)) {
                const proofName = (prof.residenceProof && (prof.residenceProof.typeTam || prof.residenceProof.type)) || 'குடியிருப்புச் சான்று';
                const resDocStr = String(prof.residenceProof?.docPath || dMap.residenceProof || '');
                docs.push({
                    type: 'residenceProof',
                    title: `குடியிருப்புச் சான்று (${proofName})`,
                    titleEng: 'Residence Proof',
                    downloadUrl: `/api/drafts/${encodeURIComponent(cleanMob)}/doc/residenceProof?download=1&_t=${cacheBust}`,
                    previewUrl: `/api/drafts/${encodeURIComponent(cleanMob)}/doc/residenceProof?_t=${cacheBust}`,
                    icon: 'fa-house',
                    isPdf: resDocStr.toLowerCase().endsWith('.pdf')
                });
            }

            // 5.5 Community Proof (Family Community Certificate or School TC)
            if (prof.communityCertificatePath || prof.familyCommunityProofPath || prof.communityProof || dMap.communityProof || b64Map.communityProofBase64) {
                docs.push({
                    type: 'communityProof',
                    title: 'குடும்ப சாதிச் சான்றிதழ் / பள்ளி TC',
                    titleEng: 'Family Community Certificate / TC',
                    downloadUrl: `/api/drafts/${encodeURIComponent(cleanMob)}/doc/communityProof?download=1&_t=${cacheBust}`,
                    previewUrl: `/api/drafts/${encodeURIComponent(cleanMob)}/doc/communityProof?_t=${cacheBust}`,
                    icon: 'fa-certificate'
                });
            }

            // 6. Subservice Documents
            const hasRealSubMemberDoc = Boolean(
                (typeof sData?.docPath === 'string' && sData.docPath.length > 5 && sData.docPath !== 'uploads/test_sample_doc.jpg') ||
                (typeof dMap.subServiceMemberDoc === 'string' && dMap.subServiceMemberDoc.length > 5) ||
                (typeof dMap.memberAadhaarFront === 'string' && dMap.memberAadhaarFront.length > 5) ||
                (typeof dMap.memberAadhaar === 'string' && dMap.memberAadhaar !== 'true' && dMap.memberAadhaar.length > 5) ||
                (typeof b64Map.memberAadhaarBase64 === 'string' && b64Map.memberAadhaarBase64.length > 20) ||
                (typeof b64Map.memberAadhaarFrontBase64 === 'string' && b64Map.memberAadhaarFrontBase64.length > 20) ||
                (isAddMember && (prof.headAadhaarDocPath || dMap.headAadhaar))
            );

            if (isAddMember && hasRealSubMemberDoc) {
                const sName = sData?.memberNameTam || sData?.memberName || prof.fullNameTam || prof.fullNameEng || '';
                const isChild = Boolean(sData?.isChild);
                const memLabel = sName ? ` (${sName})` : '';
                if (isChild) {
                    docs.push({
                        type: 'birthCertificate',
                        title: `குழந்தையின் பிறப்புச் சான்றிதழ்${memLabel}`,
                        titleEng: `Child Birth Certificate${memLabel}`,
                        downloadUrl: `/api/drafts/${encodeURIComponent(cleanMob)}/doc/birthCertificate?download=1`,
                        previewUrl: `/api/drafts/${encodeURIComponent(cleanMob)}/doc/birthCertificate`,
                        icon: 'fa-file-lines'
                    });
                } else {
                    docs.push({
                        type: 'memberAadhaar',
                        title: `உறுப்பினர் ஆதார் அட்டை${memLabel}`,
                        titleEng: `Member Aadhaar Card${memLabel}`,
                        downloadUrl: `/api/drafts/${encodeURIComponent(cleanMob)}/doc/memberAadhaar?download=1`,
                        previewUrl: `/api/drafts/${encodeURIComponent(cleanMob)}/doc/memberAadhaar`,
                        icon: 'fa-id-card'
                    });
                }
            }
            if (!isAddMember && (dMap.birthCertificate || b64Map.birthCertificateBase64)) {
                docs.push({
                    type: 'birthCertificate',
                    title: 'குழந்தையின் பிறப்புச் சான்றிதழ்',
                    titleEng: 'Child Birth Certificate',
                    downloadUrl: `/api/drafts/${encodeURIComponent(cleanMob)}/doc/birthCertificate?download=1`,
                    icon: 'fa-file-lines'
                });
            }
            if (dMap.surrenderProof || b64Map.surrenderProofBase64) {
                docs.push({
                    type: 'surrenderProof',
                    title: 'பழைய அட்டை நீக்கல் / திருமணச் சான்று',
                    titleEng: 'Surrender / Marriage Certificate',
                    downloadUrl: `/api/drafts/${encodeURIComponent(cleanMob)}/doc/surrenderProof?download=1`,
                    icon: 'fa-file-signature'
                });
            }
            if (dMap.removeProof || b64Map.removeProofBase64) {
                docs.push({
                    type: 'removeProof',
                    title: 'உறுப்பினர் நீக்கல் சான்றிதழ்',
                    titleEng: 'Member Removal Proof',
                    downloadUrl: `/api/drafts/${encodeURIComponent(cleanMob)}/doc/removeProof?download=1`,
                    icon: 'fa-file-shield'
                });
            }
            const isNewAddrDuplicate = Boolean(
                ((prof.gasDetails?.gasBookPath || dMap.gasBook) && dMap.newAddressProof && (
                    (prof.gasDetails?.gasBookPath && String(prof.gasDetails.gasBookPath).split(/[\\/]/).pop() === String(dMap.newAddressProof).split(/[\\/]/).pop()) ||
                    (dMap.gasBook && String(dMap.gasBook).split(/[\\/]/).pop() === String(dMap.newAddressProof).split(/[\\/]/).pop())
                )) ||
                (dMap.residenceProof && String(dMap.residenceProof).split(/[\\/]/).pop() === String(dMap.newAddressProof).split(/[\\/]/).pop()) ||
                (!String(prof.subService || '').toUpperCase().includes('CHANGE_ADDRESS') && (dMap.gasBook || prof.gasDetails?.gasBookPath || dMap.residenceProof))
            );
            if (!isNewAddrDuplicate && (dMap.newAddressProof || b64Map.newAddressProofBase64)) {
                docs.push({
                    type: 'newAddressProof',
                    title: 'புதிய முகவரிச் சான்று',
                    titleEng: 'New Address Proof',
                    downloadUrl: `/api/drafts/${encodeURIComponent(cleanMob)}/doc/newAddressProof?download=1`,
                    icon: 'fa-location-dot'
                });
            }

            // 7. Submitted Application PDF
            const aNo = appNo || prof.applicationNumber;
            const aPdf = appPdf || prof.applicationPdfUrl;
            if (aNo || aPdf) {
                docs.push({
                    type: 'applicationPdf',
                    title: `சமர்ப்பிக்கப்பட்ட TNPDS விண்ணப்பம் (${aNo || 'PDF'})`,
                    titleEng: 'Submitted TNPDS Application PDF',
                    downloadUrl: aPdf || `/receipts/Application_${aNo}.pdf`,
                    icon: 'fa-file-pdf'
                });
            }

            return docs;
        }
