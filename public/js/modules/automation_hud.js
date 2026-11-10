// eSevaDraft Domain Module: automation_hud.js

        async function syncAutomationProgress() {
            const authScreen = document.getElementById('authScreen');
            if (authScreen && authScreen.style.display !== 'none') return;

            try {
                const activeMob = localStorage.getItem('eseva_active_customer_mobile') || localStorage.getItem('eseva_user_mobile') || '';
                const url = activeMob ? `/api/automation/progress?mobile=${encodeURIComponent(activeMob)}` : '/api/automation/progress';
                const res = await fetch(url, {
                    headers: { 'x-session-mobile': activeMob }
                });
                const data = await res.json();
                const pBar = document.getElementById('automationProgressBar');
                const label = document.getElementById('apbStepLabel');
                const pct = document.getElementById('apbPct');
                const fill = document.getElementById('apbFill');

                if (!pBar) return;

                // Do not override local real-time desktop step updates if updated recently
                const lastLocalTime = parseInt(pBar.dataset.lastLocalUpdate || '0', 10);
                if (Date.now() - lastLocalTime < 15000 && !data.isRunning && data.step === 0) {
                    return;
                }

                // Handle HITL Approval Station Modal (Disabled on Localhost / Dev Mock Mode)
                if (isDevMockModeActive()) {
                    if (isHitlModalOpen) closeHitlApprovalModal();
                } else if (data.isWaitingForApproval && !isHitlModalOpen) {
                    openHitlApprovalModal(data);
                } else if (!data.isWaitingForApproval && isHitlModalOpen && data.step >= 49) {
                    closeHitlApprovalModal();
                }

                const headerStopBtn = document.getElementById('btnStopAutomationHeader');
                if (data.isRunning || (data.step > 0 && data.step < data.total)) {
                    pBar.classList.add('active');
                    pBar.dataset.lastLocalUpdate = String(Date.now());
                    if (headerStopBtn) headerStopBtn.style.display = 'inline-flex';
                    if (label) label.innerText = `படி ${data.step}/${data.total}`;
                    if (pct) pct.innerText = `${data.percentage}%`;
                    if (fill) fill.style.width = `${data.percentage}%`;

                    // Self-healing Milestone & Stepper Sync:
                    const chatBox = document.getElementById('chatMessages') || chatMessages;
                    if (chatBox && data.step > 0) {
                        const stepper = chatBox.querySelector('#liveAutomationStepperCard');
                        if (!stepper || stepper.dataset.currentStep !== String(data.step) || (data.step === 21 && !stepper.querySelector('#globalOtpCardContainer'))) {
                            appendLiveAutomationStep(data.stepMessage || `[படி ${data.step}/${data.total}]`);
                        }
                    }
                } else if (data.step >= data.total && data.total > 0) {
                    if (headerStopBtn) headerStopBtn.style.display = 'none';
                    if (label) label.innerText = `படி ${data.total}/${data.total} (முடிந்தது!)`;
                    if (pct) pct.innerText = `100%`;
                    if (fill) fill.style.width = `100%`;
                    setTimeout(() => { pBar.classList.remove('active'); }, 6000);
                } else {
                    pBar.classList.remove('active');
                    if (headerStopBtn) headerStopBtn.style.display = 'none';
                }
            } catch (e) {}
        }

        // =========================================================================
        // Live Desktop Automation Streamer, Approval Gate & 1-Click PDF Downloader
        // =========================================================================
        function updateAutomationProgressBar(stepNum, totalSteps = 51, stepText = '') {
            const pBar = document.getElementById('automationProgressBar');
            const label = document.getElementById('apbStepLabel');
            const pct = document.getElementById('apbPct');
            const fill = document.getElementById('apbFill');
            const headerStopBtn = document.getElementById('btnStopAutomationHeader');
            if (!pBar) return;

            pBar.classList.add('active');
            pBar.dataset.lastLocalUpdate = String(Date.now());
            if (headerStopBtn && stepNum < (totalSteps || 51)) headerStopBtn.style.display = 'inline-flex';
            const total = totalSteps || 51;
            const percentage = Math.min(100, Math.max(0, Math.round((stepNum / total) * 100)));
            if (label) {
                if (stepNum === 0) {
                    label.innerText = 'ஆரம்பிக்கிறது...';
                } else {
                    label.innerText = `படி ${stepNum}/${total}`;
                }
            }
            if (pct) pct.innerText = `${percentage}%`;
            if (fill) fill.style.width = `${Math.max(4, percentage)}%`;

            if (stepNum >= total && total > 0) {
                if (headerStopBtn) headerStopBtn.style.display = 'none';
                setTimeout(() => { pBar.classList.remove('active'); }, 8000);
            }
        }

        const CANONICAL_STEP_REGISTRY = [
            { id: 'step_1', step: 1, maxStep: 1, num: 1, icon: 'fa-globe', label: 'TNPDS அரசு தளம் திறக்கப்பட்டது' },
            { id: 'step_2', step: 2, maxStep: 2, num: 2, icon: 'fa-user-tag', label: 'குடும்பத் தலைவர் தலைப்பு தெரிவு' },
            { id: 'step_3', step: 3, maxStep: 3, num: 3, icon: 'fa-camera', label: 'பாஸ்போர்ட் புகைப்படம் பதிவேற்றம்' },
            { id: 'step_4', step: 4, maxStep: 4, num: 4, icon: 'fa-user', label: 'தலைவர் பெயர் - ஆங்கிலம்' },
            { id: 'step_5', step: 5, maxStep: 5, num: 5, icon: 'fa-user-group', label: 'தந்தை / கணவர் பெயர் - ஆங்கிலம்' },
            { id: 'step_6', step: 6, maxStep: 6, num: 6, icon: 'fa-door-open', label: 'கதவு எண் - ஆங்கிலம்' },
            { id: 'step_7', step: 7, maxStep: 7, num: 7, icon: 'fa-road', label: 'தெருப் பெயர் - ஆங்கிலம்' },
            { id: 'step_8', step: 8, maxStep: 8, num: 8, icon: 'fa-location-dot', label: 'பகுதி / கிராமம் - ஆங்கிலம்' },
            { id: 'step_9_13', step: 9, maxStep: 13, num: 9, icon: 'fa-pen-fancy', label: 'தமிழ் பெயர் & முகவரி விவரங்கள்' },
            { id: 'step_14', step: 14, maxStep: 14, num: 10, icon: 'fa-landmark', label: 'மாவட்டம் தெரிவு (District)' },
            { id: 'step_15', step: 15, maxStep: 15, num: 11, icon: 'fa-building', label: 'வட்டம் தெரிவு (Taluk)' },
            { id: 'step_16', step: 16, maxStep: 16, num: 12, icon: 'fa-wheat-awn', label: 'கிராமம் தெரிவு (Village)' },
            { id: 'step_17', step: 17, maxStep: 17, num: 13, icon: 'fa-envelope', label: 'அஞ்சல் குறியீட்டு எண் (Pincode)' },
            { id: 'step_18', step: 18, maxStep: 18, num: 14, icon: 'fa-mobile-screen', label: 'கைபேசி எண் உள்ளீடு' },
            { id: 'step_19', step: 19, maxStep: 19, num: 15, icon: 'fa-paper-plane', label: 'SMS OTP கோரப்பட்டது' },
            { id: 'step_21', step: 21, maxStep: 21, num: 16, icon: 'fa-key', label: 'TNPDS கைபேசி SMS OTP சரிபார்ப்பு' },
            { id: 'step_22', step: 22, maxStep: 22, num: 17, icon: 'fa-users', label: 'குடும்ப உறுப்பினர் சேர்க்கைப் படிவம் திறப்பு' },
            { id: 'step_23_28', step: 23, maxStep: 28, num: 18, icon: 'fa-address-card', label: 'உறுப்பினர் விவரங்கள் பூர்த்தி' },
            { id: 'step_32_34', step: 32, maxStep: 34, num: 19, icon: 'fa-file-shield', label: 'தலைவர் ஆதார் ஆவணம் பதிவேற்றம்' },
            { id: 'step_35', step: 35, maxStep: 36, num: 20, icon: 'fa-id-badge', label: 'தலைவர் ஆதார் SMS OTP சரிபார்ப்பு' },
            { id: 'step_37', step: 37, maxStep: 37, num: 21, icon: 'fa-bowl-rice', label: 'அட்டை வகை தெரிவு (அரிசி அட்டை)' },
            { id: 'step_41_46', step: 41, maxStep: 46, num: 22, icon: 'fa-fire-burner', label: 'எரிவாயு இணைப்பு விவரங்கள்' },
            { id: 'step_47', step: 47, maxStep: 47, num: 23, icon: 'fa-certificate', label: 'சுய அறிவிப்பு உறுதிமொழி தெரிவு' },
            { id: 'step_48', step: 48, maxStep: 48, num: 24, icon: 'fa-shield-halved', label: 'இறுதி சரிபார்ப்பு & ஆப்ரேட்டர் ஒப்புதல்' },
            { id: 'step_49_50', step: 49, maxStep: 50, num: 25, icon: 'fa-paper-plane', label: 'அரசு தளத்தில் இறுதி சமர்ப்பிப்பு' },
            { id: 'step_51', step: 51, maxStep: 51, num: 26, icon: 'fa-award', label: 'விண்ணப்பம் சமர்ப்பிக்கப்பட்டு பதிவு எண் பெறப்பட்டது' }
        ];

        function appendLiveAutomationStep(msg) {
            if (!msg || typeof msg !== 'string' || window.isScreenResetting || msg.includes('Chrome Console') || msg.includes('Failed to load resource')) return;
            console.log('[Live Automation Step]', msg);

            // 1. Extract step number if present, e.g. [படி 21/51] or [படிகள் 23-35/51] or Step 21/51
            const stepMatch = msg.match(/(?:\[\s*(?:படி|படிகள்|Step)\s*|(?:படி|படிகள்|Step)\s+)(\d+)(?:\s*-\s*(\d+))?\s*\/\s*(\d+)\]?/i);
            let stepNum = 0;
            let stepEnd = 0;
            let totalSteps = 51;
            if (stepMatch) {
                stepNum = parseInt(stepMatch[1], 10);
                stepEnd = stepMatch[2] ? parseInt(stepMatch[2], 10) : stepNum;
                totalSteps = parseInt(stepMatch[3], 10) || 51;
            } else {
                if (msg.includes('Google Chrome') || msg.includes('TNPDS போர்ட்டல்') || msg.includes('தளம் திறக்க')) stepNum = 1;
                else if ((msg.includes('மொபைல் OTP') || msg.includes('கைபேசி SMS OTP') || msg.includes('OTP SMS')) && !msg.includes('ஆதார்')) stepNum = 21;
                else if (msg.includes('ஆதார் OTP') || msg.includes('ஆதார் சரிபார்ப்பு')) stepNum = 35;
                else if (msg.includes('CONFIRM_FINAL_PORTAL_SUBMIT') || msg.includes('இறுதி சமர்ப்பிப்பு ஒப்புதல்') || msg.includes('ஒப்புதல் தேவை')) stepNum = 48;
                else if (msg.includes('விண்ணப்பம் வெற்றிகரமாக') || msg.includes('பதிவு எண் பெறப்பட்டது')) stepNum = 51;
            }

            // Always update top bar
            updateAutomationProgressBar(stepNum, totalSteps, msg);

            // Ensure action buttons
            const headerStopBtn = document.getElementById('btnStopAutomationHeader');
            if (headerStopBtn) headerStopBtn.style.display = 'inline-flex';
            const headerClearBtn = document.getElementById('btnClearScreenHeader') || document.getElementById('btnDeleteDraftHeader');
            if (headerClearBtn) headerClearBtn.style.display = 'inline-flex';
            const sidebarClearBtn = document.getElementById('btnClearScreenSidebar') || document.getElementById('btnDeleteDraftSidebar');
            if (sidebarClearBtn) sidebarClearBtn.style.display = 'inline-flex';

            const chatBox = document.getElementById('chatMessages') || chatMessages;
            if (!chatBox) return;

            // Remove legacy persistent card if any was present
            const oldCard = document.getElementById('liveAutomationStatusCard');
            if (oldCard) oldCard.remove();

            // On fresh start (Step 1), clean any old live steps from chat
            if (stepNum === 1) {
                chatBox.querySelectorAll('.live-milestone-step, .compact-otp-card, #globalOtpCardContainer').forEach(el => el.remove());
            }

            // Flags
            const isOtp = (
                stepNum === 21 || 
                stepNum === 35 || 
                stepNum === 36 || 
                msg.includes('OTP தேவை') || 
                msg.includes('OTP சரிபார்ப்பு') || 
                msg.includes('ஆதார் OTP') || 
                msg.includes('மொபைல் OTP') || 
                msg.includes('SMS OTP')
            );
            const isApproval = (stepNum === 48 || msg.includes('ஒப்புதல் தேவை') || msg.includes('CONFIRM_FINAL_PORTAL_SUBMIT'));
            const isCaptcha = (msg.includes('I am human') || msg.includes('Captcha') || msg.includes('மனித சரிபார்ப்பு'));
            const isError = (msg.includes('ஆட்டோமேஷன் நிறுத்தப்பட்டது') || msg.includes('ஆட்டோமேஷன் பிழையினால்') || msg.includes('Strict Gate Halt'));
            const isSuccess = (stepNum === 51 || msg.includes('பதிவு எண் பெறப்பட்டது') || msg.includes('விண்ணப்பம் வெற்றிகரமாக சமர்ப்பிக்கப்பட்டது'));
            const isDoneMessage = msg.startsWith('✓') || msg.includes('சரிபார்க்கப்பட்டது!') || msg.includes('பூர்த்தி செய்யப்பட்டது!') || msg.includes('வெற்றிகரமாக');

            // Find matching canonical entry
            let matchedCanonical = null;
            if (stepNum > 0) {
                matchedCanonical = CANONICAL_STEP_REGISTRY.find(c => stepNum >= c.step && stepNum <= c.maxStep);
            }
            if (!matchedCanonical && !isCaptcha && !isError && stepNum === 0) {
                return; // non-step raw log
            }

            // Extract detail from parentheses if present (e.g. Ranipet, Kumaran K, 9790170026)
            let detail = '';
            const parenMatch = msg.match(/\(([^)]+)\)/);
            if (parenMatch && parenMatch[1] && !parenMatch[1].includes('/') && parenMatch[1].length < 35) {
                const val = parenMatch[1].trim();
                // Never show raw 6-digit OTP codes or OTP-related numbers in stepper titles
                if (!/^\d{6}$/.test(val) && !msg.includes('OTP')) {
                    detail = ` (${val})`;
                }
            }

            // Ensure Stepper Card is Mounted
            let stepperCard = document.getElementById('liveAutomationStepperCard');
            if (!stepperCard) {
                chatBox.querySelectorAll('.live-milestone-step, .compact-otp-card, #globalOtpCardContainer').forEach(el => el.remove());

                stepperCard = document.createElement('div');
                stepperCard.id = 'liveAutomationStepperCard';
                stepperCard.className = 'live-automation-stepper';
                stepperCard.style.cssText = 'background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 12px; padding: 12px 14px; margin: 8px 0; box-shadow: 0 4px 12px rgba(15,23,42,0.06); max-width: 540px;';
                stepperCard.innerHTML = `
                    <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1.5px solid #f1f5f9; padding-bottom: 8px; margin-bottom: 8px;">
                        <span style="font-weight: 800; font-size: 13px; color: #0f172a; display: flex; align-items: center; gap: 7px;">
                            <span class="status-dot-pulse" style="background: #16a34a; width: 8px; height: 8px; border-radius: 50%; display: inline-block;"></span>
                            ⚡ அரசு போர்ட்டல் நேரலை இயக்கம் (Live Stepper)
                        </span>
                        <span id="stepperStepBadge" style="background: #ecfdf5; color: #166534; border: 1px solid #a7f3d0; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 6px;">படி ${stepNum > 0 ? stepNum : 1}/51</span>
                    </div>
                    <div id="stepperItemsList" style="display: flex; flex-direction: column; gap: 4px; max-height: 240px; overflow-y: auto; padding-right: 2px;"></div>
                    <div id="stepperActionContainer" style="margin-top: 8px;"></div>
                `;
                chatBox.appendChild(stepperCard);
            }

            stepperCard.dataset.currentStep = String(stepNum);

            // Update Progress Badge
            const badge = stepperCard.querySelector('#stepperStepBadge');
            if (badge && stepNum > 0) {
                const percentage = Math.min(100, Math.max(0, Math.round((stepNum / (totalSteps || 51)) * 100)));
                badge.innerText = `படி ${stepNum}/${totalSteps || 51} (${percentage}%)`;
            }

            const itemsList = stepperCard.querySelector('#stepperItemsList');
            const actionContainer = stepperCard.querySelector('#stepperActionContainer');

            if (stepNum === 1 && itemsList) {
                itemsList.innerHTML = '';
                if (actionContainer) actionContainer.innerHTML = '';
            }

            if (itemsList && matchedCanonical) {
                const targetIdx = CANONICAL_STEP_REGISTRY.indexOf(matchedCanonical);

                // 1. Backfill all prior steps if missing
                for (let i = 0; i < targetIdx; i++) {
                    const prior = CANONICAL_STEP_REGISTRY[i];
                    let priorRow = itemsList.querySelector(`.stepper-row[data-step-id="${prior.id}"]`);
                    if (!priorRow) {
                        priorRow = document.createElement('div');
                        priorRow.className = 'stepper-row';
                        priorRow.dataset.stepId = prior.id;
                        priorRow.style.cssText = 'display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 3px 6px; border-radius: 6px; background: #f8fafc; font-size: 12px;';
                        priorRow.innerHTML = `
                            <div style="display: flex; align-items: center; gap: 7px; min-width: 0;">
                                <span class="stepper-badge" style="width: 18px; height: 18px; border-radius: 50%; background: #dcfce7; color: #16a34a; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; flex-shrink: 0;"><i class="fa-solid fa-check"></i></span>
                                <span class="stepper-label" style="color: #334155; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${prior.label}</span>
                            </div>
                            <span class="stepper-status" style="font-size: 11px; font-weight: 700; color: #16a34a; flex-shrink: 0;">முடிந்தது ✓</span>
                        `;
                        itemsList.appendChild(priorRow);
                    } else {
                        // Ensure prior row is marked completed
                        const pBadge = priorRow.querySelector('.stepper-badge');
                        const pStatus = priorRow.querySelector('.stepper-status');
                        if (pBadge && !pBadge.innerHTML.includes('fa-check')) {
                            pBadge.style.background = '#dcfce7';
                            pBadge.style.color = '#16a34a';
                            pBadge.innerHTML = '<i class="fa-solid fa-check"></i>';
                        }
                        if (pStatus && pStatus.innerText !== 'முடிந்தது ✓') {
                            pStatus.innerText = 'முடிந்தது ✓';
                            pStatus.style.color = '#16a34a';
                        }
                        priorRow.style.background = '#f8fafc';
                        priorRow.style.border = 'none';
                    }
                }

                // 2. Render or Update Current Step Row
                let curRow = itemsList.querySelector(`.stepper-row[data-step-id="${matchedCanonical.id}"]`);
                const rowLabelText = `${matchedCanonical.label}${detail}`;
                const rowStatusText = isOtp ? 'OTP தேவை' : (isApproval ? 'ஒப்புதல் தேவை' : (isError ? 'பிழை' : (isDoneMessage || isSuccess ? 'முடிந்தது ✓' : 'இயங்குகிறது...')));
                const rowStatusColor = isOtp ? '#d97706' : (isApproval ? '#7c3aed' : (isError ? '#dc2626' : (isDoneMessage || isSuccess ? '#16a34a' : '#2563eb')));
                const rowBgColor = isOtp ? '#fffbeb' : (isApproval ? '#faf5ff' : (isError ? '#fef2f2' : (isDoneMessage || isSuccess ? '#f8fafc' : '#f0f9ff')));
                const rowBorder = isOtp ? '1px solid #fde68a' : (isApproval ? '1px solid #e9d5ff' : (isError ? '1px solid #fecaca' : 'none'));

                let badgeHtml = `${matchedCanonical.num}`;
                let badgeBg = '#e0f2fe';
                let badgeColor = '#0284c7';
                if (isOtp) {
                    badgeHtml = '<i class="fa-solid fa-key"></i>';
                    badgeBg = '#fef3c7';
                    badgeColor = '#d97706';
                } else if (isApproval) {
                    badgeHtml = '<i class="fa-solid fa-clipboard-check"></i>';
                    badgeBg = '#ede9fe';
                    badgeColor = '#7c3aed';
                } else if (isDoneMessage || isSuccess) {
                    badgeHtml = '<i class="fa-solid fa-check"></i>';
                    badgeBg = '#dcfce7';
                    badgeColor = '#16a34a';
                } else if (isError) {
                    badgeHtml = '<i class="fa-solid fa-xmark"></i>';
                    badgeBg = '#fee2e2';
                    badgeColor = '#dc2626';
                }

                if (!curRow) {
                    curRow = document.createElement('div');
                    curRow.className = 'stepper-row';
                    curRow.dataset.stepId = matchedCanonical.id;
                    curRow.style.cssText = `display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 4px 6px; border-radius: 6px; background: ${rowBgColor}; border: ${rowBorder}; font-size: 12px;`;
                    curRow.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 7px; min-width: 0;">
                            <span class="stepper-badge" style="width: 18px; height: 18px; border-radius: 50%; background: ${badgeBg}; color: ${badgeColor}; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; flex-shrink: 0;">${badgeHtml}</span>
                            <span class="stepper-label" style="color: #0f172a; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${rowLabelText}</span>
                        </div>
                        <span class="stepper-status" style="font-size: 11px; font-weight: 700; color: ${rowStatusColor}; flex-shrink: 0;">${rowStatusText}</span>
                    `;
                    itemsList.appendChild(curRow);
                } else {
                    curRow.style.background = rowBgColor;
                    curRow.style.border = rowBorder;
                    const b = curRow.querySelector('.stepper-badge');
                    const l = curRow.querySelector('.stepper-label');
                    const s = curRow.querySelector('.stepper-status');
                    if (b) {
                        b.innerHTML = badgeHtml;
                        b.style.background = badgeBg;
                        b.style.color = badgeColor;
                    }
                    if (l && detail) l.innerText = rowLabelText;
                    if (s) {
                        s.innerText = rowStatusText;
                        s.style.color = rowStatusColor;
                    }
                }

                // Smooth scroll to keep latest step visible
                itemsList.scrollTop = itemsList.scrollHeight;
            }

            // Handle Action Container: OTP Toolbar or Approval Station
            if (isOtp && actionContainer && typeof window.renderGlobalOtpCard === 'function') {
                const existingOtp = actionContainer.querySelector('#globalOtpCardContainer');
                if (!existingOtp) {
                    actionContainer.innerHTML = '';
                    const isAadhaarOtp = (stepNum === 35 || stepNum === 36 || msg.includes('ஆதார்'));
                    const otpType = isAadhaarOtp ? 'aadhaar_otp' : 'mobile_otp';
                    window.renderGlobalOtpCard(actionContainer, (code) => {
                        const activeMob = localStorage.getItem('eseva_active_customer_mobile') || localStorage.getItem('eseva_user_mobile') || '';
                        if (window.esevaDesktopBridge && typeof window.esevaDesktopBridge.submitOtp === 'function') {
                            window.esevaDesktopBridge.submitOtp(code).catch(() => {});
                        }
                        if (window.esevaDesktopBridge && typeof window.esevaDesktopBridge.provideLiveOtp === 'function') {
                            window.esevaDesktopBridge.provideLiveOtp(code).catch(() => {});
                        }
                        fetch('/api/automation/otp_webhook', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ otp: code, mobile: activeMob })
                        }).catch(() => {});
                        fetch('/api/chat', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'x-session-mobile': activeMob },
                            body: JSON.stringify({ message: code, mobile: activeMob })
                        }).catch(() => {});
                    }, null, { digits: 6, type: otpType, title: isAadhaarOtp ? 'ஆதார் SMS OTP' : 'TNPDS கைபேசி SMS OTP' });
                }
            } else if (isApproval && actionContainer) {
                if (!actionContainer.querySelector('#btnLiveConfirmPortalSubmit')) {
                    actionContainer.innerHTML = `
                        <div style="background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 8px; padding: 8px 10px; margin-bottom: 6px;">
                            <div style="font-size: 11.5px; color: #166534; line-height: 1.4;">
                                அனைத்து விவரங்கள் மற்றும் ஆவணங்கள் Chrome போர்ட்டலில் சரியாக நிரப்பப்பட்டுள்ளன. இறுதி சமர்ப்பிப்பை முடிக்க உங்கள் ஒப்புதல் தேவை!
                            </div>
                        </div>
                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            <button onclick="approveFinalPortalSubmit()" id="btnLiveConfirmPortalSubmit" style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); color: white; border: none; padding: 7px 16px; border-radius: 6px; font-weight: 800; font-size: 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(22,163,74,0.3);">
                                <i class="fa-solid fa-check-double"></i> ✅ உறுதி செய்து சமர்ப்பிக்கவும்
                            </button>
                        </div>
                    `;
                }
            } else if (!isOtp && !isApproval && actionContainer) {
                actionContainer.innerHTML = '';
            }

            scrollToChatBottom(true);
        }


        async function approveFinalPortalSubmit() {
            const btn = document.getElementById('btnLiveConfirmPortalSubmit') || document.getElementById('btnChatFinalConfirmSubmit') || document.getElementById('btnHitlApproveSubmit');
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> அரசு போர்ட்டலில் சமர்ப்பிக்கப்படுகிறது...';
            }

            try {
                let approved = false;
                if (window.esevaDesktopBridge && window.esevaDesktopBridge.approveFinalSubmit) {
                    approved = await window.esevaDesktopBridge.approveFinalSubmit();
                } else {
                    const res = await fetch('/api/automation/approve-submit', { method: 'POST' });
                    const data = await res.json();
                    approved = data && data.success;
                }

                appendLiveAutomationStep('✅ ஆப்ரேட்டர் ஒப்புதல் பெறப்பட்டது! TNPDS தளத்தில் பதிவு எண் பெறப்படுகிறது...');
            } catch (e) {
                console.error('Approval failed:', e);
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> ⚠️ மீண்டும் சமர்ப்பிக்கவும்';
                }
            }
        }

        async function handleAutomationFinished(res) {
            console.log('[Automation Finished Event]', res);
            updateAutomationProgressBar(51, 51, 'முடிந்தது');

            if (res && res.success && (res.isTnegaCan || res.canNumber)) {
                const activeMob = localStorage.getItem('eseva_active_customer_mobile') || res.mobile || '';
                if (res.canNumber && activeMob) {
                    try {
                        await fetch('/api/operator/link-can', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ mobileNumber: activeMob, canNumber: res.canNumber })
                        });
                    } catch (_) {}
                }
                appendLiveAutomationStep(res.message || `🎉 **TNeGA CAN செயல்முறை வெற்றிகரமாக நிறைவுற்றது!**\n\n• 🔢 **CAN எண்:** **${res.canNumber || '—'}**`);
                updateAutomationProgressBar(51, 51, 'முழு வெற்றி (Success)');
                await fetchHistory(true);
                if (typeof fetchOperatorDrafts === 'function') {
                    fetchOperatorDrafts();
                }
                return;
            }

            if (res && res.success && res.applicationNumber) {
                const appNo = String(res.applicationNumber).replace(/\D/g, '').trim();
                localStorage.setItem('eseva_last_app_ref', appNo);

                const activeMob = localStorage.getItem('eseva_active_customer_mobile') || '';
                const opUid = localStorage.getItem('eseva_operator_uid') || '';

                // 1. Tell the server immediately that this customer application is submitted!
                try {
                    await fetch('/api/operator/submit-complete', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-session-mobile': activeMob,
                            'x-operator-uid': opUid
                        },
                        body: JSON.stringify({
                            mobileNumber: activeMob,
                            applicationNumber: appNo,
                            applicationPdfUrl: res.applicationPdfUrl || `/receipts/Application_${appNo}.pdf`,
                            customerName: localStorage.getItem('eseva_active_customer_name') || ''
                        })
                    });
                } catch (e) {
                    console.warn('submit-complete sync warning:', e);
                }

                // 2. Update top banner
                const banner = document.getElementById('appNumberBanner');
                const refDisplay = document.getElementById('appRefNoDisplay');
                const refInput = document.getElementById('tnpdsRefDownloadInput');
                const dlBtn = document.getElementById('downloadAppPdfBtn');

                if (refDisplay) refDisplay.innerText = appNo;
                if (refInput) refInput.value = appNo;
                if (banner) {
                    banner.classList.add('show');
                    banner.style.display = 'block';
                }
                if (dlBtn) {
                    dlBtn.onclick = (e) => {
                        e.preventDefault();
                        downloadTnpdsPdfFromInput(appNo);
                    };
                    dlBtn.style.display = 'inline-flex';
                }

                // 3. Update citizenDocsView
                const cDocsRef = document.getElementById('cDocsAppRefNo');
                if (cDocsRef) cDocsRef.innerText = appNo;

                // 4. Immediately refresh history & sidebar so the UI locks into SUBMITTED state permanently
                await fetchHistory(true);
                if (typeof fetchOperatorDrafts === 'function') {
                    fetchOperatorDrafts();
                }
            } else if (res && res.success) {
                appendLiveAutomationStep(res.message || '🎉 **குடும்ப உறுப்பினர் சேர்க்கை மாதிரி ஒத்திகை 100% வெற்றிகரமாக முடிந்தது!**\n\n• உறுப்பினர் விவரங்கள் போர்ட்டலில் சரிபார்க்கப்பட்டன.\n• சுய அறிவிப்பு Checkbox [✓] திக் செய்யப்பட்டுவிட்டது.\n• அசல் கார்டில் மாற்றமின்றி இறுதி சமர்ப்பிப்புக்கு முன் பாதுகாப்பாக நிறுத்தப்பட்டது.');
                updateAutomationProgressBar(51, 51, 'முழு வெற்றி (Success)');
            } else if (res && !res.success) {
                if (window.isScreenResetting || res?.silent || (res?.stopped && !res?.wasRunning)) {
                    return;
                }
                appendLiveAutomationStep(`⚠️ ஆட்டோமேஷன் நிறைவு நிலை: ${res?.message || res?.error || 'தெரியாத பிழை'}`);
            }
        }

        async function downloadTnpdsPdfFromInput(forcedRefNo) {
            const inputEl = document.getElementById('tnpdsRefDownloadInput');
            const displayEl = document.getElementById('appRefNoDisplay');
            const rawRef = forcedRefNo || (inputEl ? inputEl.value : '') || (displayEl ? displayEl.innerText : '') || localStorage.getItem('eseva_last_app_ref') || '';
            const refNo = String(rawRef).replace(/\D/g, '').trim();

            if (!refNo || refNo.length < 10 || refNo.length > 20) {
                alert('⚠️ தயவுசெய்து சரியான TNPDS விண்ணப்ப குறிப்பு எண்ணை (Application Ref No) உள்ளிடவும்!\n(எடுத்துக்காட்டு: 04260902721244)');
                if (inputEl) {
                    inputEl.focus();
                    inputEl.select();
                }
                return;
            }

            const btn = document.getElementById('btnDownloadTnpdsPdf');
            const origHtml = btn ? btn.innerHTML : '';
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> பதிவிறக்குகிறது...';
            }

            try {
                if (window.esevaDesktopBridge && window.esevaDesktopBridge.downloadTnpdsPdf) {
                    const res = await window.esevaDesktopBridge.downloadTnpdsPdf(refNo);
                    if (res && res.success) {
                        alert(`✅ விண்ணப்ப PDF வெற்றிகரமாக உங்கள் கணினியில் திறக்கப்பட்டது!\nகோப்பு: ${res.pdfPath || res.pdfUrl}`);
                    } else {
                        alert(`⚠️ PDF பதிவிறக்க முடியவில்லை: ${res?.message || res?.error || 'போர்ட்டலில் இருந்து பெற முடியவில்லை.'}`);
                    }
                } else {
                    const resp = await fetch('/api/tnpds/download-pdf', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ appRefNo: refNo, applicationNumber: refNo, refNo: refNo })
                    });
                    const data = await resp.json();
                    if (data && data.success) {
                        const targetUrl = data.pdfUrl || data.downloadUrl || `/receipts/Application_${refNo}.pdf`;
                        window.open(targetUrl, '_blank');
                    } else {
                        alert(`⚠️ PDF பதிவிறக்க முடியவில்லை: ${data?.error || data?.message || 'போர்ட்டலில் இருந்து பெற முடியவில்லை.'}`);
                    }
                }
            } catch (e) {
                alert('பதிவிறக்க பிழை: ' + e.message);
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = origHtml;
                }
            }
        }

        // =========================================================================
        // Stop Automation & Stopped Draft Deletion / Cleanup Engine
        // =========================================================================

        async function stopLiveAutomationUser() {
            const activeMob = localStorage.getItem('eseva_active_customer_mobile') || localStorage.getItem('eseva_user_mobile') || '';
            const activeName = localStorage.getItem('eseva_active_customer_name') || currentCitizenData?.fullNameTam || currentCitizenData?.fullNameEng || 'வாடிக்கையாளர்';

            const stopBtns = [document.getElementById('btnStopAutomationProgress'), document.getElementById('btnStopAutomationHeader')];
            stopBtns.forEach(btn => {
                if (btn) {
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> நிறுத்தப்படுகிறது...';
                }
            });

            try {
                // 1. Terminate local Playwright browser via Desktop Bridge
                if (window.esevaDesktopBridge && window.esevaDesktopBridge.stopLiveAutomation) {
                    await window.esevaDesktopBridge.stopLiveAutomation().catch(e => console.warn('[Desktop Bridge] Stop warn:', e));
                }

                // 2. Terminate server automation & TNeGA automation
                await fetch('/api/automation/stop', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-session-mobile': activeMob },
                    body: JSON.stringify({ mobileNumber: activeMob })
                }).catch(() => {});

                await fetch('/api/tnega/stop', { method: 'POST' }).catch(() => {});

                // 3. Immediately hide progress bar and approval modal
                const pBar = document.getElementById('automationProgressBar');
                if (pBar) {
                    pBar.classList.remove('active');
                    pBar.dataset.lastLocalUpdate = String(Date.now() + 60000);
                }
                const headerStopBtn = document.getElementById('btnStopAutomationHeader');
                if (headerStopBtn) headerStopBtn.style.display = 'none';
                if (typeof closeHitlApprovalModal === 'function') closeHitlApprovalModal();

                const fill = document.getElementById('apbFill');
                if (fill) fill.style.width = '0%';

                // Remove live automation stepper from chat
                const stepper = document.getElementById('liveAutomationStepperCard');
                if (stepper) stepper.remove();

                // 4. Render Simple Stopped Notification Pill
                renderAutomationStoppedCard(activeMob, activeName);

            } catch (e) {
                console.error('[Stop Automation Error]', e);
                alert('ஆட்டோமேஷனை நிறுத்துவதில் பிழை: ' + e.message);
            } finally {
                stopBtns.forEach(btn => {
                    if (btn) {
                        btn.disabled = false;
                        btn.innerHTML = '<i class="fa-solid fa-circle-stop" style="color: #dc2626;"></i> நிறுத்து (Stop)';
                    }
                });
            }
        }

        function renderAutomationStoppedCard(activeMob, activeName) {
            const chatBox = document.getElementById('chatMessages') || chatMessages;
            if (!chatBox) return;

            // Remove any old stopped cards or stepper cards
            chatBox.querySelectorAll('.live-automation-stepper, #liveAutomationStepperCard, .automation-stopped-pill').forEach(el => el.remove());

            const stoppedCard = document.createElement('div');
            stoppedCard.className = 'automation-stopped-pill';
            stoppedCard.style.cssText = 'max-width: 520px; margin: 8px 0;';
            stoppedCard.innerHTML = `
                <div style="background: #fef2f2; border: 1.5px solid #fca5a5; border-radius: 8px; padding: 8px 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px; box-shadow: 0 1px 4px rgba(239,68,68,0.08);">
                    <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; color: #991b1b;">
                        <i class="fa-solid fa-circle-stop" style="color: #dc2626; font-size: 14px;"></i>
                        <span>🛑 ஆட்டோமேஷன் நிறுத்தப்பட்டது</span>
                    </div>
                    <div style="display: flex; gap: 6px;">
                        <button type="button" onclick="clearAutomationScreenSession()" style="height: 28px; padding: 0 10px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 11px; font-weight: 700; color: #334155; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                            <i class="fa-solid fa-broom"></i> துடை (Clear)
                        </button>
                        <button type="button" onclick="startTnpdsAutomationFlow(true)" style="height: 28px; padding: 0 10px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; font-size: 11px; font-weight: 700; color: #1d4ed8; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                            <i class="fa-solid fa-rotate-right"></i> மீண்டும் தொடங்கு
                        </button>
                    </div>
                </div>
            `;

            chatBox.appendChild(stoppedCard);
            scrollToChatBottom(true);
        }

        async function clearAutomationScreenSession() {
            // 1. Instantly set reset lock and wipe active session from client (0ms UI latency)
            window.isScreenResetting = true;
            setTimeout(() => { window.isScreenResetting = false; }, 3000);

            const activeMob = localStorage.getItem('eseva_active_customer_mobile') || '';
            localStorage.removeItem('eseva_active_customer_mobile');
            localStorage.removeItem('eseva_active_customer_name');
            currentCitizenData = null;
            lastRenderedChatHistoryJson = '';
            lastRenderedChatHistoryLength = 0;

            // 2. Hide progress bar and action buttons immediately
            const pBar = document.getElementById('automationProgressBar');
            if (pBar) {
                pBar.classList.remove('active');
                pBar.dataset.lastLocalUpdate = String(Date.now() + 60000);
            }
            const headerStopBtn = document.getElementById('btnStopAutomationHeader');
            if (headerStopBtn) headerStopBtn.style.display = 'none';
            const clearHeaderBtn = document.getElementById('btnClearScreenHeader') || document.getElementById('btnDeleteDraftHeader');
            if (clearHeaderBtn) clearHeaderBtn.style.display = 'none';
            const clearSidebarBtn = document.getElementById('btnClearScreenSidebar') || document.getElementById('btnDeleteDraftSidebar');
            if (clearSidebarBtn) clearSidebarBtn.style.display = 'none';

            // Clean chat messages immediately
            const chatBox = document.getElementById('chatMessages') || chatMessages;
            if (chatBox) chatBox.innerHTML = '';

            // 3. Reset sidebar and render fresh welcome message immediately
            if (typeof resetSidebarToOperatorView === 'function') {
                resetSidebarToOperatorView();
            }
            renderDefaultWelcomeMessage();

            // 4. Background teardown (non-blocking, customer data safe on disk/cloud)
            if (window.esevaDesktopBridge && window.esevaDesktopBridge.stopLiveAutomation) {
                window.esevaDesktopBridge.stopLiveAutomation({ silent: true }).catch(e => console.warn('[Desktop Bridge] Stop warn:', e));
            }

            fetch('/api/automation/stop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-session-mobile': activeMob },
                body: JSON.stringify({ mobileNumber: activeMob })
            }).catch(() => {});
            fetch('/api/tnega/stop', { method: 'POST' }).catch(() => {});
            fetch('/api/chat/reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-session-mobile': activeMob },
                body: JSON.stringify({ isOp: true, forceClean: true, mobileNumber: activeMob })
            }).catch(() => {});

            if (typeof fetchOperatorDrafts === 'function') {
                fetchOperatorDrafts();
            }
        }

        // Register global automation listeners immediately on desktop bridge
        if (typeof window !== 'undefined' && window.esevaDesktopBridge) {
            if (window.esevaDesktopBridge.onAutomationUpdate && !window.__globalDesktopUpdateListenerRegistered) {
                window.__globalDesktopUpdateListenerRegistered = true;
                window.esevaDesktopBridge.onAutomationUpdate((msg) => {
                    appendLiveAutomationStep(msg);
                });
            }
            if (window.esevaDesktopBridge.onAutomationFinished && !window.__globalDesktopFinishedListenerRegistered) {
                window.__globalDesktopFinishedListenerRegistered = true;
                window.esevaDesktopBridge.onAutomationFinished((res) => {
                    handleAutomationFinished(res);
                });
            }
        }
