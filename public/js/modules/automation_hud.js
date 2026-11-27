// eSevaDraft Domain Module: automation_hud.js

        function dismissLiveStepperCard() {
            window.isAutomationManuallyStopped = true;
            document.querySelectorAll('#liveAutomationStepperCard, .live-automation-stepper, #liveAutomationStatusCard').forEach(el => el.remove());
            const pBar = document.getElementById('automationProgressBar');
            if (pBar) {
                pBar.classList.remove('active');
                pBar.dataset.lastLocalUpdate = String(Date.now() + 60000);
            }
            const headerStopBtn = document.getElementById('btnStopAutomationHeader');
            if (headerStopBtn) headerStopBtn.style.display = 'none';
        }

        function markLiveStepperFinished(stepperCard, isSuccess = true) {
            if (!stepperCard) return;
            stepperCard.dataset.finished = 'true';
            const pulseRing = stepperCard.querySelector('.live-stepper-pulse-ring');
            if (pulseRing) {
                pulseRing.innerHTML = isSuccess
                    ? '<i class="fa-solid fa-circle-check" style="color:#16a34a;font-size:16px;"></i>'
                    : '<i class="fa-solid fa-circle-stop" style="color:#dc2626;font-size:16px;"></i>';
            }
            const heading = stepperCard.querySelector('.live-stepper-heading');
            if (heading) {
                heading.innerText = isSuccess
                    ? 'அரசு போர்ட்டல் செயல்முறை நிறைவுற்றது ✓'
                    : 'அரசு போர்ட்டல் இயக்கம் நிறுத்தப்பட்டது';
            }
            const sub = stepperCard.querySelector('.live-stepper-sub');
            if (sub) {
                sub.innerText = isSuccess ? 'Pre-Submit நிலை — முடிந்தது' : 'நிறுத்தப்பட்டது';
            }
        }

        async function syncAutomationProgress() {
            const authScreen = document.getElementById('authScreen');
            if (authScreen && authScreen.style.display !== 'none') return;
            const isOp = localStorage.getItem('eseva_user_role') === 'operator';
            const activeCustMob = localStorage.getItem('eseva_active_customer_mobile') || '';
            if (window.isScreenResetting || window.isAutomationManuallyStopped || (isOp && !activeCustMob)) {
                const pBar = document.getElementById('automationProgressBar');
                if (pBar) pBar.classList.remove('active');
                const headerStopBtn = document.getElementById('btnStopAutomationHeader');
                if (headerStopBtn) headerStopBtn.style.display = 'none';
                if (isOp && !activeCustMob) {
                    document.querySelectorAll('#liveAutomationStepperCard, .live-automation-stepper').forEach(el => el.remove());
                }
                return;
            }

            try {
                const activeMob = activeCustMob || localStorage.getItem('eseva_user_mobile') || '';
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
                    if (chatBox && data.isRunning && data.step > 0) {
                        const stepper = chatBox.querySelector('#liveAutomationStepperCard');
                        const msgWantsOtp = Boolean(data.stepMessage && /OTP தேவை|OTP சரிபார்ப்பு|ஆதார் OTP|மொபைல் OTP|SMS OTP/.test(data.stepMessage));
                        if (!stepper || stepper.dataset.currentStep !== String(data.step) || (data.step === 21 && msgWantsOtp && !stepper.querySelector('#globalOtpCardContainer'))) {
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
            if (msg.includes('தொடங்குகிறது') || msg.includes('தொடங்கப்படுகிறது') || msg.includes('Google Chrome') || msg.includes('தளம் திறக்க')) {
                window.isAutomationManuallyStopped = false;
            }
            if (window.isAutomationManuallyStopped) return;
            console.log('[Live Automation Step]', msg);

            if (/பிரவுசர் மூடப்பட்டதால் ஆட்டோமேஷன்|Target page, context or browser has been closed|Target closed|Browser has been closed|ஆட்டோமேஷன் நிறுத்தப்பட்டது/i.test(msg)) {
                window.isAutomationManuallyStopped = true;
                const pBar = document.getElementById('automationProgressBar');
                if (pBar) {
                    pBar.classList.remove('active');
                    pBar.dataset.lastLocalUpdate = String(Date.now() + 60000);
                }
                const headerStopBtn = document.getElementById('btnStopAutomationHeader');
                if (headerStopBtn) headerStopBtn.style.display = 'none';
                const stepper = document.getElementById('liveAutomationStepperCard');
                if (stepper) stepper.remove();
                const activeMob = localStorage.getItem('eseva_active_customer_mobile') || localStorage.getItem('eseva_user_mobile') || '';
                const activeName = localStorage.getItem('eseva_active_customer_name') || 'வாடிக்கையாளர்';
                renderAutomationStoppedCard(activeMob, activeName, null);
                return;
            }

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
            const isApproval = (stepNum === 48 || msg.includes('Pre-Submit Human Gate') || msg.includes('மனிதப் பூட்டு') || msg.includes('ஒப்புதல் தேவை') || msg.includes('CONFIRM_FINAL_PORTAL_SUBMIT'));
            const isCopilotWait = msg.includes('Co-Pilot காத்திருப்பு') || msg.includes('Co-Pilot தொடர்கிறது');
            const isCaptcha = (msg.includes('I am human') || msg.includes('Captcha') || msg.includes('மனித சரிபார்ப்பு'));
            const isError = !isCopilotWait && !isApproval && (
                msg.includes('ஆட்டோமேஷன் நிறுத்தப்பட்டது') ||
                msg.includes('ஆட்டோமேஷன் பிழையினால்') ||
                msg.includes('Strict Gate Halt') ||
                msg.includes('⚠️ பிழை:') ||
                msg.includes('Chrome திறக்க முடியவில்லை') ||
                msg.includes('❌')
            );
            const isSuccess = (stepNum === 51 || msg.includes('பதிவு எண் பெறப்பட்டது') || msg.includes('விண்ணப்பம் வெற்றிகரமாக சமர்ப்பிக்கப்பட்டது'));
            const isDoneMessage = msg.startsWith('✓') || msg.includes('சரிபார்க்கப்பட்டது!') || msg.includes('பூர்த்தி செய்யப்பட்டது!') || msg.includes('வெற்றிகரமாக');

            // Find matching canonical entry (ONLY use 51-step New Card registry when totalSteps === 51!)
            const is51StepNewCard = (totalSteps === 51);
            let matchedCanonical = null;
            if (stepNum > 0) {
                if (is51StepNewCard) {
                    matchedCanonical = CANONICAL_STEP_REGISTRY.find(c => stepNum >= c.step && stepNum <= c.maxStep);
                } else {
                    const cleanStepLabel = msg
                        .replace(/^\[\s*(?:படி|படிகள்|Step)\s*\d+(?:\s*-\s*\d+)?\s*\/\s*\d+\]\s*/i, '')
                        .replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\s]+/u, '')
                        .replace(/\*\*/g, '')
                        .trim()
                        .slice(0, 72) || `படி ${stepNum}/${totalSteps}`;
                    matchedCanonical = {
                        id: `sub_step_${stepNum}`,
                        step: stepNum,
                        maxStep: stepNum,
                        num: stepNum,
                        icon: 'fa-bolt',
                        label: cleanStepLabel
                    };
                }
            }
            if (!matchedCanonical && !isCaptcha && !isError && !isApproval && !isCopilotWait && stepNum === 0) {
                return; // non-step raw log
            }

            // Extract detail from parentheses if present (e.g. Ranipet, Kumaran K, 9790170026)
            let detail = '';
            const parenMatch = is51StepNewCard ? msg.match(/\(([^)]+)\)/) : null;
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
                stepperCard.innerHTML = `
                    <div class="live-stepper-header">
                        <div class="live-stepper-title-group">
                            <span class="live-stepper-pulse-ring" aria-hidden="true">
                                <span class="status-dot-pulse"></span>
                            </span>
                            <div class="live-stepper-title-meta">
                                <span class="live-stepper-heading">அரசு போர்ட்டல் நேரலை இயக்கம்</span>
                                <span class="live-stepper-sub">Live Stepper Pipeline</span>
                            </div>
                        </div>
                        <div style="display:flex;align-items:center;gap:6px;">
                            <span id="stepperStepBadge" class="live-stepper-badge">படி ${stepNum > 0 ? stepNum : 1}/${totalSteps || 51}</span>
                            <button type="button" onclick="dismissLiveStepperCard()" title="மூடு (Close)" style="border:1px solid #cbd5e1;background:#ffffff;color:#475569;border-radius:6px;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px;">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                    </div>
                    <div id="stepperItemsList" class="live-stepper-list"></div>
                    <div id="stepperActionContainer" class="live-stepper-actions"></div>
                `;
                chatBox.appendChild(stepperCard);
            }

            stepperCard.dataset.currentStep = String(stepNum);
            stepperCard.dataset.totalSteps = String(totalSteps || 51);

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
                if (is51StepNewCard) {
                    const targetIdx = CANONICAL_STEP_REGISTRY.indexOf(matchedCanonical);

                    // 1. Backfill all prior steps if missing
                    for (let i = 0; i < targetIdx; i++) {
                        const prior = CANONICAL_STEP_REGISTRY[i];
                        let priorRow = itemsList.querySelector(`.stepper-row[data-step-id="${prior.id}"]`);
                        if (!priorRow) {
                            priorRow = document.createElement('div');
                            priorRow.className = 'stepper-row is-done';
                            priorRow.dataset.stepId = prior.id;
                            priorRow.innerHTML = `
                                <div class="stepper-row-left">
                                    <span class="stepper-badge"><i class="fa-solid fa-check"></i></span>
                                    <span class="stepper-label">${prior.label}</span>
                                </div>
                                <span class="stepper-status">முடிந்தது ✓</span>
                            `;
                            itemsList.appendChild(priorRow);
                        } else {
                            priorRow.className = 'stepper-row is-done';
                            const pBadge = priorRow.querySelector('.stepper-badge');
                            const pStatus = priorRow.querySelector('.stepper-status');
                            if (pBadge && !pBadge.innerHTML.includes('fa-check')) {
                                pBadge.innerHTML = '<i class="fa-solid fa-check"></i>';
                            }
                            if (pStatus && pStatus.innerText !== 'முடிந்தது ✓') {
                                pStatus.innerText = 'முடிந்தது ✓';
                            }
                        }
                    }
                } else {
                    // For non-51-step flows (e.g. 12-step TNPDS sub-services), mark all prior rendered rows as done
                    itemsList.querySelectorAll('.stepper-row').forEach(prevRow => {
                        if (prevRow.dataset.stepId !== matchedCanonical.id) {
                            prevRow.className = 'stepper-row is-done';
                            const pBadge = prevRow.querySelector('.stepper-badge');
                            const pStatus = prevRow.querySelector('.stepper-status');
                            if (pBadge) pBadge.innerHTML = '<i class="fa-solid fa-check"></i>';
                            if (pStatus) pStatus.innerText = 'முடிந்தது ✓';
                        }
                    });
                }

                // 2. Render or Update Current Step Row
                let curRow = itemsList.querySelector(`.stepper-row[data-step-id="${matchedCanonical.id}"]`);
                const rowLabelText = `${matchedCanonical.label}${detail}`;
                const isFinalStepReached = stepNum >= (totalSteps || 51);
                const rowStatusText = isOtp ? 'OTP தேவை' : (isApproval ? 'ஒப்புதல் தேவை' : (isError ? 'பிழை' : (isDoneMessage || isSuccess || isFinalStepReached ? 'முடிந்தது ✓' : 'இயங்குகிறது...')));
                const rowStateClass = isOtp ? 'is-otp' : (isApproval ? 'is-approval' : (isError ? 'is-error' : (isDoneMessage || isSuccess || isFinalStepReached ? 'is-done' : 'is-running')));

                let badgeHtml = `${matchedCanonical.num}`;
                if (isOtp) {
                    badgeHtml = '<i class="fa-solid fa-key"></i>';
                } else if (isApproval) {
                    badgeHtml = '<i class="fa-solid fa-clipboard-check"></i>';
                } else if (isDoneMessage || isSuccess || isFinalStepReached) {
                    badgeHtml = '<i class="fa-solid fa-check"></i>';
                } else if (isError) {
                    badgeHtml = '<i class="fa-solid fa-xmark"></i>';
                }

                if (!curRow) {
                    curRow = document.createElement('div');
                    curRow.className = `stepper-row ${rowStateClass}`;
                    curRow.dataset.stepId = matchedCanonical.id;
                    curRow.innerHTML = `
                        <div class="stepper-row-left">
                            <span class="stepper-badge">${badgeHtml}</span>
                            <span class="stepper-label">${rowLabelText}</span>
                        </div>
                        <span class="stepper-status">${rowStatusText}</span>
                    `;
                    itemsList.appendChild(curRow);
                } else {
                    curRow.className = `stepper-row ${rowStateClass}`;
                    const b = curRow.querySelector('.stepper-badge');
                    const l = curRow.querySelector('.stepper-label');
                    const s = curRow.querySelector('.stepper-status');
                    if (b) b.innerHTML = badgeHtml;
                    if (l && (detail || !is51StepNewCard)) l.innerText = rowLabelText;
                    if (s) s.innerText = rowStatusText;
                }

                if (isFinalStepReached || isSuccess) {
                    markLiveStepperFinished(stepperCard, true);
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
                if (!actionContainer.querySelector('#livePreSubmitHumanGateNotice')) {
                    actionContainer.innerHTML = `
                        <div class="stepper-approval-card" id="livePreSubmitHumanGateNotice">
                            <div class="stepper-approval-notice">
                                <span class="stepper-approval-icon" aria-hidden="true"><i class="fa-solid fa-shield-check"></i></span>
                                <div class="stepper-approval-text">
                                    <strong>🛡️ இறுதிச் சமர்ப்பிப்பு மனிதப் பூட்டு:</strong> அனைத்து விவரங்களும் ஆவணங்களும் Chrome போர்ட்டலில் 100% நிரப்பப்பட்டுவிட்டன! ஆட்டோமேஷன் இறுதிச் சமர்ப்பிப்பை அழுத்தாது — நீங்களே Chrome திரையில் சரிபார்த்து <strong>"பதிவு செய் / சமர்ப்பி"</strong> அழுத்தவும். நீங்கள் சமர்ப்பித்ததும் அரசு குறிப்பு எண்ணை எடுத்து விண்ணப்ப PDF-ஐ ஆப் தானாகவே பதிவிறக்கித் தரும்!
                                </div>
                            </div>
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

            if (!res || !res.success || res.stopped || res.browserClosed) {
                window.isAutomationManuallyStopped = true;
                const pBar = document.getElementById('automationProgressBar');
                if (pBar) {
                    pBar.classList.remove('active');
                    pBar.dataset.lastLocalUpdate = String(Date.now() + 60000);
                }
                const headerStopBtn = document.getElementById('btnStopAutomationHeader');
                if (headerStopBtn) headerStopBtn.style.display = 'none';
                const stepper = document.getElementById('liveAutomationStepperCard');
                if (stepper) stepper.remove();
                if (window.isScreenResetting || res?.silent || (res?.stopped && !res?.wasRunning)) {
                    return;
                }
                const activeMob = localStorage.getItem('eseva_active_customer_mobile') || localStorage.getItem('eseva_user_mobile') || '';
                const activeName = localStorage.getItem('eseva_active_customer_name') || 'வாடிக்கையாளர்';
                renderAutomationStoppedCard(activeMob, activeName, res);
                return;
            }

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
                const stepperDone = document.getElementById('liveAutomationStepperCard');
                if (stepperDone) markLiveStepperFinished(stepperDone, true);
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
            window.isAutomationManuallyStopped = true;
            const activeMob = localStorage.getItem('eseva_active_customer_mobile') || localStorage.getItem('eseva_user_mobile') || '';
            const activeName = localStorage.getItem('eseva_active_customer_name') || currentCitizenData?.fullNameTam || currentCitizenData?.fullNameEng || 'வாடிக்கையாளர்';

            // 1. Immediately hide progress bar, Stop button, and approval modal (0ms UI latency)
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

            const stepper = document.getElementById('liveAutomationStepperCard');
            if (stepper) stepper.remove();

            renderAutomationStoppedCard(activeMob, activeName);

            const stopBtns = [document.getElementById('btnStopAutomationProgress'), document.getElementById('btnStopAutomationHeader')];
            stopBtns.forEach(btn => {
                if (btn) {
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> நிறுத்தப்படுகிறது...';
                }
            });

            try {
                // 2. Terminate local Playwright browser via Desktop Bridge
                if (window.esevaDesktopBridge && window.esevaDesktopBridge.stopLiveAutomation) {
                    await window.esevaDesktopBridge.stopLiveAutomation().catch(e => console.warn('[Desktop Bridge] Stop warn:', e));
                }

                // 3. Terminate server automation & TNeGA automation
                await fetch('/api/automation/stop', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-session-mobile': activeMob },
                    body: JSON.stringify({ mobileNumber: activeMob })
                }).catch(() => {});

                await fetch('/api/tnega/stop', { method: 'POST' }).catch(() => {});
            } catch (e) {
                console.error('[Stop Automation Error]', e);
            } finally {
                stopBtns.forEach(btn => {
                    if (btn) {
                        btn.disabled = false;
                        btn.innerHTML = '<i class="fa-solid fa-circle-stop" style="color: #dc2626;"></i> நிறுத்து (Stop)';
                    }
                });
            }
        }

        async function submitMidRunFaultFeedback(runId, serviceName, lastStep, reasonText, cardEl) {
            const activeMob = localStorage.getItem('eseva_active_customer_mobile') || localStorage.getItem('eseva_user_mobile') || '';
            const cleaned = String(reasonText || '').trim() || 'Pre-Submit முன் நின்றது (காரணம் குறிப்பிடப்படவில்லை)';
            if (cardEl) {
                cardEl.querySelectorAll('button, input').forEach(el => { el.disabled = true; });
            }
            try {
                await fetch('/api/operator/telemetry-log', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-operator-uid': localStorage.getItem('eseva_operator_uid') || ''
                    },
                    body: JSON.stringify({
                        type: 'OPERATOR_MID_RUN_FEEDBACK',
                        runId: runId || '',
                        serviceName: serviceName || '',
                        step: lastStep || 'MID_RUN_STOPPED',
                        message: cleaned,
                        mobile: activeMob,
                        operatorUid: localStorage.getItem('eseva_operator_uid') || '',
                        operatorName: localStorage.getItem('eseva_operator_name') || '',
                        operatorMobile: localStorage.getItem('eseva_operator_mobile') || ''
                    })
                }).catch(() => {});
                if (cardEl) {
                    cardEl.innerHTML = `<div style="font-size:11.5px;font-weight:700;color:#15803d;padding:2px 4px;">✅ உங்கள் தகவல் சேமிக்கப்பட்டது! ("${cleaned.replace(/[<>&"]/g, '')}")</div>`;
                }
            } catch (_) {
                if (cardEl) {
                    cardEl.querySelectorAll('button, input').forEach(el => { el.disabled = false; });
                }
            }
        }

        function renderAutomationStoppedCard(activeMob, activeName, stopMeta = null) {
            const chatBox = document.getElementById('chatMessages') || chatMessages;
            if (!chatBox) return;

            // Remove any old stopped cards or stepper cards
            chatBox.querySelectorAll('.live-automation-stepper, #liveAutomationStepperCard, .automation-stopped-pill').forEach(el => el.remove());

            const safeRunId = String(stopMeta?.runId || Date.now()).replace(/[^a-zA-Z0-9_-]/g, '');
            const promptFault = Boolean(stopMeta && stopMeta.promptFaultReason);

            const stoppedCard = document.createElement('div');
            stoppedCard.className = 'automation-stopped-pill';
            stoppedCard.innerHTML = `
                <div class="stopped-banner-box">
                    <div class="stopped-banner-left">
                        <span class="stopped-banner-icon" aria-hidden="true">
                            <i class="fa-solid fa-circle-stop"></i>
                        </span>
                        <span class="stopped-banner-title">ஆட்டோமேஷன் நிறுத்தப்பட்டது</span>
                    </div>
                    <div class="stopped-banner-actions">
                        <button type="button" onclick="clearAutomationScreenSession()" class="stopped-btn stopped-btn-clear">
                            <i class="fa-solid fa-broom"></i> <span>துடை (Clear)</span>
                        </button>
                        <button type="button" onclick="proceedConfirmedSubmit(true)" class="stopped-btn stopped-btn-restart">
                            <i class="fa-solid fa-rotate-right"></i> <span>மீண்டும் தொடங்கு</span>
                        </button>
                    </div>
                </div>
                ${promptFault ? `
                <div id="midRunFaultCard_${safeRunId}" class="mid-run-fault-card">
                    <div class="mid-run-fault-title">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                        <span>ஆட்டோமேஷன் Pre-Submit நிலையை அடையும் முன் பாதியில் நின்றது — என்ன காரணம்? (விரும்பினால்)</span>
                    </div>
                    <div class="mid-run-chips-row">
                        <button type="button" class="mid-run-chip" data-msg="OTP வரவில்லை">OTP வரவில்லை</button>
                        <button type="button" class="mid-run-chip" data-msg="பக்கம் திறக்கவில்லை / Slow">பக்கம் திறக்கவில்லை / Slow</button>
                        <button type="button" class="mid-run-chip" data-msg="தவறான விவரம் / CAN பிழை">தவறான விவரம்</button>
                        <button type="button" class="mid-run-chip mid-run-chip-neutral" data-msg="வேலை முடிந்து நானே மூடினேன்">வேலை முடிந்து நானே மூடினேன்</button>
                    </div>
                    <div class="mid-run-fault-input-row">
                        <input type="text" id="midRunFaultInput_${safeRunId}" class="mid-run-fault-input" placeholder="வேறு காரணம் இருந்தால் இங்கே தட்டச்சு செய்க...">
                        <button type="button" id="midRunFaultSend_${safeRunId}" class="mid-run-fault-send"><i class="fa-solid fa-paper-plane"></i> அனுப்பு</button>
                    </div>
                </div>
                ` : ''}
            `;

            chatBox.appendChild(stoppedCard);
            if (promptFault) {
                const faultCard = document.getElementById(`midRunFaultCard_${safeRunId}`);
                const noteIn = document.getElementById(`midRunFaultInput_${safeRunId}`);
                const sendBtn = document.getElementById(`midRunFaultSend_${safeRunId}`);
                const svc = stopMeta?.serviceName || '';
                const step = stopMeta?.lastStep || '';
                if (faultCard) {
                    faultCard.querySelectorAll('.mid-run-chip').forEach(ch => {
                        ch.addEventListener('click', () => {
                            const msg = ch.getAttribute('data-msg') || ch.textContent || '';
                            submitMidRunFaultFeedback(safeRunId, svc, step, msg, faultCard);
                        });
                    });
                    if (sendBtn && noteIn) {
                        sendBtn.addEventListener('click', () => submitMidRunFaultFeedback(safeRunId, svc, step, noteIn.value, faultCard));
                        noteIn.addEventListener('keydown', (e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                submitMidRunFaultFeedback(safeRunId, svc, step, noteIn.value, faultCard);
                            }
                        });
                    }
                }
            }
            scrollToChatBottom(true);
        }

        async function clearAutomationScreenSession() {
            // 1. Instantly set reset lock and wipe active session from client (0ms UI latency)
            window.isScreenResetting = true;
            window.isAutomationManuallyStopped = true;
            setTimeout(() => { window.isScreenResetting = false; }, 3000);

            const activeMob = localStorage.getItem('eseva_active_customer_mobile') || '';
            localStorage.removeItem('eseva_active_customer_mobile');
            localStorage.removeItem('eseva_active_draft_id');
            localStorage.removeItem('eseva_active_customer_name');
            currentCitizenData = null;
            window.currentCitizenData = null;
            window.lastSubService = null;
            window.lastSubServiceData = null;
            if (typeof resetSidebarDocsCache === 'function') resetSidebarDocsCache();
            if (typeof clearCustomerDocCache === 'function' && activeMob) clearCustomerDocCache(activeMob);
            lastRenderedChatHistoryJson = '';
            lastRenderedChatHistoryLength = 0;

            // 2. Hide progress bar, action buttons, and any live stepper cards immediately
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
            const rBanner = document.getElementById('resumeBanner');
            if (rBanner) { rBanner.classList.remove('show'); rBanner.style.display = 'none'; }
            const aBanner = document.getElementById('appNumberBanner');
            if (aBanner) { aBanner.classList.remove('show'); aBanner.style.display = 'none'; }
            const saveTopBtn = document.getElementById('btnSaveDraftTop');
            if (saveTopBtn) saveTopBtn.style.display = 'none';
            const titleEl = document.getElementById('activeCustomerTitle');
            if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-robot"></i> eSevaDraft ஏஐ உரையாடல் மையம்`;
            document.querySelectorAll('#liveAutomationStepperCard, .live-automation-stepper, #liveAutomationStatusCard, .automation-stopped-pill, .compact-otp-card, #globalOtpCardContainer').forEach(el => el.remove());

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

        // Register global automation listeners immediately on desktop bridge (unified guard flag)
        if (typeof window !== 'undefined' && window.esevaDesktopBridge) {
            if (window.esevaDesktopBridge.onAutomationUpdate && !window.__desktopUpdateListenerRegistered) {
                window.__desktopUpdateListenerRegistered = true;
                window.esevaDesktopBridge.onAutomationUpdate((msg) => {
                    appendLiveAutomationStep(msg);
                });
            }
            if (window.esevaDesktopBridge.onAutomationFinished && !window.__desktopFinishedListenerRegistered) {
                window.__desktopFinishedListenerRegistered = true;
                window.esevaDesktopBridge.onAutomationFinished((res) => {
                    handleAutomationFinished(res);
                });
            }
        }
