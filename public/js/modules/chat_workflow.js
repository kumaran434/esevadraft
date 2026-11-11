// eSevaDraft Domain Module: chat_workflow.js

        async function fetchHistory(forceScroll = false) {
            if (window.isScreenResetting) return;
            const authScreen = document.getElementById('authScreen');
            if (authScreen && authScreen.style.display !== 'none') return;

            try {
                const isOp = localStorage.getItem('eseva_user_role') === 'operator';
                const activeCustMob = localStorage.getItem('eseva_active_customer_mobile') || '';
                const opUid = localStorage.getItem('eseva_operator_uid') || '';

                const noCustBanner = document.getElementById('noCustomerAlertBanner');
                const activeTitle = document.getElementById('activeCustomerTitle');
                const saveBtn = document.getElementById('btnSaveDraftTop');

                // If operator is logged in and has NO customer selected, KEEP SIDEBAR DASHED and DO NOT poll customer data!
                if (isOp && !activeCustMob) {
                    resetSidebarToOperatorView();
                    if (noCustBanner) noCustBanner.style.display = 'flex';
                    if (activeTitle) activeTitle.innerHTML = `<i class="fa-solid fa-robot"></i> eSevaDraft ஏஐ உரையாடல் மையம்`;
                    if (saveBtn) saveBtn.style.display = 'none';
                    if (!chatMessages || chatMessages.children.length === 0) {
                        renderDefaultWelcomeMessage();
                    }
                    return;
                }

                if (noCustBanner) noCustBanner.style.display = 'none';
                if (saveBtn && isOp) saveBtn.style.display = 'inline-flex';
                const clearHeader = document.getElementById('btnClearScreenHeader') || document.getElementById('btnDeleteDraftHeader');
                const clearSidebar = document.getElementById('btnClearScreenSidebar') || document.getElementById('btnDeleteDraftSidebar');
                if (clearHeader) clearHeader.style.display = 'inline-flex';
                if (clearSidebar) clearSidebar.style.display = 'inline-flex';

                const url = activeCustMob ? `/api/chat/history?mobile=${encodeURIComponent(activeCustMob)}` : '/api/chat/history';
                const res = await fetch(url, {
                    headers: {
                        'x-session-mobile': activeCustMob,
                        'x-operator-uid': opUid
                    }
                });
                const data = await res.json();
                if (window.isScreenResetting) return;
                const currentCustMob = localStorage.getItem('eseva_active_customer_mobile') || '';
                if (isOp && !currentCustMob) return; // Do not render stale history if customer was cleared mid-flight
                if (data.chatHistory) renderMessages(data.chatHistory, forceScroll);
                updateSidebar(data);
                const banner = document.getElementById('appNumberBanner');
                const isSubmittedSession = (data.step === 'submitted') || (data.status === 'SUBMITTED' && !data.subService && (!data.intakeState || !data.intakeState.startsWith('RATION_')));
                if (data.applicationNumber && isSubmittedSession) {
                    const refDisplay = document.getElementById('appRefNoDisplay');
                    const refInput = document.getElementById('tnpdsRefDownloadInput');
                    const dlBtn = document.getElementById('downloadAppPdfBtn');
                    if (banner && refDisplay) {
                        refDisplay.innerText = data.applicationNumber;
                        if (refInput) refInput.value = data.applicationNumber;
                        banner.classList.add('show');
                        banner.style.display = 'block';
                        if (dlBtn) {
                            dlBtn.onclick = (e) => {
                                e.preventDefault();
                                downloadTnpdsPdfFromInput(data.applicationNumber);
                            };
                            dlBtn.style.display = 'inline-flex';
                        }
                    }
                } else if (banner) {
                    banner.classList.remove('show');
                    banner.style.display = 'none';
                }
            } catch (e) {
                console.error('History fetch failed:', e);
            }
        }

        let otpCountdownInterval = null;
        let otpSecondsLeft = 0;
        let otpTotalSeconds = 60;
        let currentOtpActivePrompt = '';

        function formatTimerDisplay(totalSecs) {
            const m = Math.floor(totalSecs / 60);
            const s = totalSecs % 60;
            return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }

        function formatMessageText(text) {
            if (!text) return '';
            let safe = text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
            safe = safe.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            safe = safe.replace(/\n/g, '<br>');
            return safe;
        }

        async function resetIntakeChat() {
            try {
                window.isScreenResetting = true;
                setTimeout(() => { window.isScreenResetting = false; }, 3000);

                if (otpCountdownInterval) {
                    clearInterval(otpCountdownInterval);
                    otpCountdownInterval = null;
                }
                otpSecondsLeft = 0;

                // Hide all banners and progress bars
                const rBanner = document.getElementById('resumeBanner');
                if (rBanner) { rBanner.classList.remove('show'); rBanner.style.display = 'none'; }
                const aBanner = document.getElementById('appNumberBanner');
                if (aBanner) { aBanner.classList.remove('show'); aBanner.style.display = 'none'; }
                const pBar = document.getElementById('automationProgressBar');
                if (pBar) pBar.classList.remove('active');

                const isOp = localStorage.getItem('eseva_user_role') === 'operator';
                const oldMob = localStorage.getItem('eseva_active_customer_mobile') || '';
                lastRenderedChatHistoryJson = '';
                lastRenderedChatHistoryLength = 0;
                currentCitizenData = null;

                if (isOp) {
                    localStorage.removeItem('eseva_active_customer_mobile');
                    localStorage.removeItem('eseva_active_customer_name');
                    resetSidebarToOperatorView();
                    const titleEl = document.getElementById('activeCustomerTitle');
                    if (titleEl) {
                        titleEl.innerHTML = `<i class="fa-solid fa-robot"></i> eSevaDraft ஏஐ உரையாடல் மையம்`;
                    }
                    renderDefaultWelcomeMessage();
                    fetch('/api/chat/reset', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'x-session-mobile': oldMob },
                        body: JSON.stringify({ isOp: true, forceClean: true, mobileNumber: oldMob })
                    }).catch(e => console.warn('Reset notify warn:', e));
                } else {
                    const res = await fetch('/api/chat/reset', { method: 'POST' });
                    const data = await res.json();
                    renderMessages(data.chatHistory, true);
                    updateSidebar({ citizenProfile: null });
                }
            } catch (e) {
                console.error('Reset failed:', e);
                alert('மீட்டமைப்பில் பிழை: ' + e.message);
            }
        }


        function renderDefaultWelcomeMessage() {
            lastRenderedChatHistoryJson = '';
            lastRenderedChatHistoryLength = 0;
            renderMessages([
                {
                    sender: 'bot',
                    text: `வணக்கம்! 🙏 **eSevaDraft (https://esevadraft.in/)** தமிழ்நாடு அரசு சேவைகள் ஏஐ உதவி மையத்திற்கு வரவேற்கிறோம்!\n\n` +
                          `நீங்கள் இன்று எந்த அரசு சேவைக்கு விண்ணப்பிக்க விரும்புகிறீர்கள்?\n` +
                          `கீழே உள்ள விருப்பங்களில் ஒன்றைத் தேர்ந்தெடுக்கவும்:`,
                    options: [
                        { label: "🏛️ ரேஷன் கார்டு (Ration Card)", value: "ரேஷன் கார்டு" },
                        { label: "📜 வருமானச் சான்றிதழ் (Income Certificate)", value: "வருமானச் சான்றிதழ்" },
                        { label: "🏠 இருப்பிடச் சான்றிதழ் (Residence Certificate)", value: "இருப்பிடச் சான்றிதழ்" },
                        { label: "📜 சாதிச் சான்றிதழ் (Community Certificate)", value: "சாதிச் சான்றிதழ்" },
                        { label: "🗳️ புதிய வாக்காளர் அட்டை (New Voter ID)", value: "புதிய வாக்காளர் அட்டை" }
                    ]
                }
            ], true);
        }

        let lastRenderedChatHistoryJson = '';
        let lastRenderedChatHistoryLength = 0;
        let isUserScrolledUp = false;

        function setupChatScrollListener() {
            const chatBox = document.getElementById('chatMessages');
            if (!chatBox) return;
            chatBox.addEventListener('scroll', () => {
                const distFromBottom = chatBox.scrollHeight - chatBox.scrollTop - chatBox.clientHeight;
                const threshold = 45;
                const btn = document.getElementById('chatScrollBottomBtn');
                if (distFromBottom > threshold) {
                    isUserScrolledUp = true;
                    if (btn) btn.style.display = 'inline-flex';
                } else {
                    isUserScrolledUp = false;
                    if (btn) {
                        btn.style.display = 'none';
                        btn.classList.remove('has-new-msg');
                        const txt = document.getElementById('chatScrollBottomText');
                        if (txt) txt.innerText = 'கீழே செல்';
                    }
                }
            });
        }
        if (typeof document !== 'undefined') {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', setupChatScrollListener);
            } else {
                setupChatScrollListener();
            }
        }

        function scrollToChatBottom(smooth = true) {
            const chatBox = document.getElementById('chatMessages');
            if (!chatBox) return;
            if (smooth) {
                chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
            } else {
                chatBox.scrollTop = chatBox.scrollHeight;
            }
            isUserScrolledUp = false;
            const btn = document.getElementById('chatScrollBottomBtn');
            if (btn) {
                btn.style.display = 'none';
                btn.classList.remove('has-new-msg');
                const txt = document.getElementById('chatScrollBottomText');
                if (txt) txt.innerText = 'கீழே செல்';
            }
        }

        function renderMessages(history, forceScroll = false) {
            if (!history) return;
            const chatBox = document.getElementById('chatMessages') || chatMessages;
            if (!chatBox) return;

            const historyJson = JSON.stringify(history);
            // If the history has NOT changed at all and forceScroll is false, do NOT wipe DOM or hijack user scroll!
            if (historyJson === lastRenderedChatHistoryJson && !forceScroll) {
                return;
            }

            const distFromBottom = chatBox.scrollHeight - chatBox.scrollTop - chatBox.clientHeight;
            const wasNearBottom = distFromBottom <= 45;
            const prevScrollTop = chatBox.scrollTop;
            const isNewMessageAdded = (history.length > lastRenderedChatHistoryLength) && lastRenderedChatHistoryLength > 0;

            lastRenderedChatHistoryJson = historyJson;
            lastRenderedChatHistoryLength = history.length;

            // Preserve active live milestone steps across history renders
            const existingMilestones = Array.from(chatBox.querySelectorAll('.live-milestone-step'));
            const existingStepper = chatBox.querySelector('#liveAutomationStepperCard');

            chatBox.innerHTML = '';

            let hasActiveOtpPrompt = false;
            let activeOtpPromptText = '';

            history.forEach(msg => {
                const bubble = document.createElement('div');
                bubble.className = `msg-bubble ${msg.sender === 'bot' ? 'msg-bot' : 'msg-user'}`;
                
                const textContainer = document.createElement('div');
                textContainer.innerHTML = formatMessageText(msg.text);
                bubble.appendChild(textContainer);


                // 1. If message has preview image (Portal Screenshot Before Final Submit)
                if (msg.previewImage) {
                    const imgContainer = document.createElement('div');
                    imgContainer.style.marginTop = '10px';
                    imgContainer.style.position = 'relative';

                    const img = document.createElement('img');
                    img.src = msg.previewImage;
                    img.style.maxWidth = '100%';
                    img.style.borderRadius = '8px';
                    img.style.border = '2px solid #059669';
                    img.style.boxShadow = '0 4px 14px rgba(0,0,0,0.18)';
                    img.style.cursor = 'zoom-in';
                    img.title = 'அரசு போர்ட்டல் ஸ்கிரீன்ஷாட்டைப் பெரிதாக்க கிளிக் செய்யவும்';
                    img.onclick = () => openImageZoomModal(msg.previewImage);
                    imgContainer.appendChild(img);

                    const zoomBtnWrap = document.createElement('div');
                    zoomBtnWrap.style.marginTop = '6px';
                    zoomBtnWrap.style.display = 'flex';
                    zoomBtnWrap.style.gap = '8px';
                    zoomBtnWrap.innerHTML = `
                        <button onclick="openImageZoomModal('${msg.previewImage}')" style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 5px 12px; font-size: 11.5px; font-weight: 700; color: #334155; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">
                            <i class="fa-solid fa-magnifying-glass-plus" style="color: #0284c7;"></i> 🔍 முழுப் பக்கமாகப் பெரிதாக்கு (Zoom)
                        </button>
                    `;
                    imgContainer.appendChild(zoomBtnWrap);

                    bubble.appendChild(imgContainer);
                }

                // 2. If message has interactive option chips
                if (msg.options && Array.isArray(msg.options) && msg.options.length > 0) {
                    const optionsWrap = document.createElement('div');
                    optionsWrap.className = 'chat-options-container';
                    msg.options.forEach(opt => {
                        const val = (opt.value !== undefined) ? opt.value : (opt.text || opt);
                        const isMockOpt = (val === 'Mock Test' || String(opt.label || '').includes('Mock') || String(opt.label || '').includes('சுயகற்றல்'));
                        if (isMockOpt && !isDevMockModeActive()) {
                            return;
                        }
                        const btn = document.createElement('button');
                        btn.className = 'chat-option-chip';
                        btn.innerText = opt.label || opt.text || opt;
                        btn.onclick = () => {
                            if (val === 'TRIGGER_FILE_UPLOAD') {
                                const fi = bubble.querySelector('input[type="file"]') || document.getElementById('fileUploadInput');
                                if (fi) fi.click();
                                return;
                            }
                            if (val === 'OPEN_REVIEW_TAB' || val === 'OPEN_OFFICIAL_PORTAL') {
                                openOfficialPortal();
                                return;
                            }
                            if (val === 'TRIGGER_EDIT_MODAL') {
                                openEditModal();
                                return;
                            }
                            if (val === 'CONFIRM_SUBMIT' || val === 'Start') {
                                openPreSubmitModal();
                                return;
                            }
                            if (val === 'START_NEW_CUSTOMER' || val === 'RESET_SCREEN') {
                                if (typeof clearAutomationScreenSession === 'function') {
                                    clearAutomationScreenSession();
                                    return;
                                }
                            }
                            sendTextMessage(val);
                        };
                        optionsWrap.appendChild(btn);
                    });
                    bubble.appendChild(optionsWrap);
                }

                // 3. If message requires inline photo/document upload
                if (msg.actionRequired === 'upload') {
                    const uploadWrap = document.createElement('div');
                    uploadWrap.style.marginTop = '6px';
                    uploadWrap.innerHTML = `
                        <label class="chat-inline-upload-btn">
                            <i class="fa-solid fa-camera"></i> ${msg.uploadPrompt || 'கோப்பைத் தேர்ந்தெடுக்கவும் / புகைப்படம் எடுக்கவும்'}
                            <input type="file" accept="image/*,.pdf" style="display:none;" onchange="handleFileUpload(event)">
                        </label>
                    `;
                    bubble.appendChild(uploadWrap);
                }

                // 3b. If message requires opening edit modal
                if (msg.actionRequired === 'open_edit_modal') {
                    if (typeof openEditModal === 'function') {
                        setTimeout(() => openEditModal(), 150);
                    }
                }

                // 4. If confirmation submit buttons
                if (msg.showConfirmButtons) {
                    const confirmWrap = document.createElement('div');
                    confirmWrap.style.marginTop = '12px';
                    confirmWrap.innerHTML = `
                        <div style="background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 10px; padding: 12px; margin-bottom: 8px;">
                            <div style="display: flex; align-items: center; gap: 8px; font-weight: 800; color: #166534; font-size: 12.5px; margin-bottom: 4px;">
                                <i class="fa-solid fa-clipboard-check" style="font-size: 16px;"></i> TNPDS அரசு போர்ட்டல் இறுதி சரிபார்ப்பு தயார்!
                            </div>
                            <div style="font-size: 11.5px; color: #15803d; line-height: 1.4;">
                                மேலே உள்ள ஸ்கிரீன்ஷாட்டில் அனைத்து விவரங்களும் (பெயர், முகவரி, குடும்ப உறுப்பினர்கள், ஆவணங்கள்) சரியாக உள்ளதா என சரிபார்த்துவிட்டு அரசு தளத்தில் Submit செய்யவும்.
                            </div>
                        </div>
                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            <button onclick="confirmFinalSubmit()" id="btnChatFinalConfirmSubmit" style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); color: white; border: none; padding: 10px 22px; border-radius: 8px; font-weight: 800; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(22,163,74,0.35);">
                                <i class="fa-solid fa-check-double"></i> ✅ எல்லாம் சரியாக உள்ளது — அரசு போர்ட்டலில் Submit செய்!
                            </button>
                            <button onclick="openHitlApprovalModal()" style="background: white; border: 1.5px solid #0284c7; color: #0369a1; padding: 10px 16px; border-radius: 8px; font-weight: 700; font-size: 12.5px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                                <i class="fa-solid fa-sliders"></i> விவரங்களை மாற்ற வேண்டுமா? (Edit / Correct)
                            </button>
                        </div>
                    `;
                    bubble.appendChild(confirmWrap);
                }

                // 4.5. If application PDF download
                if (msg.applicationPdfUrl) {
                    const pdfWrap = document.createElement('div');
                    pdfWrap.style.marginTop = '12px';
                    pdfWrap.innerHTML = `
                        <div style="background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 10px; padding: 12px; box-shadow: 0 2px 8px rgba(22,163,74,0.15);">
                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                                <i class="fa-solid fa-file-pdf" style="font-size: 26px; color: #dc2626;"></i>
                                <div>
                                    <div style="font-weight: 700; color: #166534; font-size: 13px;">அதிகாரப்பூர்வ அரசு விண்ணப்ப படிவம் தயார்!</div>
                                    <div style="font-size: 11px; color: #15803d;">பதிவு குறிப்பு எண்: <b>${msg.applicationNumber || '04260902721244'}</b></div>
                                </div>
                            </div>
                            <a href="${msg.applicationPdfUrl}" target="_blank" download="New_Card_Application.pdf" style="display: inline-flex; align-items: center; justify-content: center; gap: 6px; width: 100%; box-sizing: border-box; background: #16a34a; color: white; text-decoration: none; padding: 9px 16px; border-radius: 8px; font-weight: 700; font-size: 12.5px; box-shadow: 0 2px 6px rgba(22,163,74,0.3);">
                                <i class="fa-solid fa-download"></i> விண்ணப்பத்தைப் பதிவிறக்கம் செய்க (Download PDF)
                            </a>
                        </div>
                    `;
                    bubble.appendChild(pdfWrap);
                }

                // 5. If OTP prompt in chat message (ONLY when NO live automation is running, and only for the active latest message)
                const isLiveAutomating = Boolean(
                    document.getElementById('liveAutomationStepperCard') ||
                    document.getElementById('liveAutomationStatusCard') || 
                    (document.getElementById('automationProgressBar') && document.getElementById('automationProgressBar').classList.contains('active'))
                );
                const isLastMsg = (msg === history[history.length - 1]);
                const isOtpMsg = !isLiveAutomating && isLastMsg && msg.sender === 'bot' && (
                    msg.text.includes('OTP SMS') || 
                    msg.text.includes('ஆதார் சரிபார்ப்பு OTP') || 
                    msg.text.includes('ஆதார் OTP') ||
                    msg.text.includes('OTP எண்ணை இங்கே') ||
                    msg.text.includes('கைபேசி கடவுச்சொல்')
                );

                if (isOtpMsg) {
                    hasActiveOtpPrompt = true;
                    activeOtpPromptText = msg.text;
                    if (typeof window.renderGlobalOtpCard === 'function') {
                        const isLoginOtp = msg.text.includes('7-இலக்க') || msg.text.includes('படி 3') || msg.text.includes('Login OTP') || msg.text.includes('மொபைல்') || msg.text.includes('கைபேசி');
                        const otpType = isLoginOtp ? 'login_otp' : 'aadhaar_otp';
                        const otpWrap = document.createElement('div');
                        otpWrap.className = 'live-otp-card-wrap';
                        otpWrap.dataset.otpType = otpType;
                        otpWrap.style.marginTop = '10px';
                        window.renderGlobalOtpCard(otpWrap, (code) => {
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
                        }, () => {
                            requestResendOtp();
                        }, { digits: 6, type: otpType });
                        bubble.appendChild(otpWrap);
                    }
                }

                chatMessages.appendChild(bubble);
            });

            // Re-attach active live stepper card if present
            if (existingStepper && !chatBox.contains(existingStepper)) {
                chatBox.appendChild(existingStepper);
            }

            if (hasActiveOtpPrompt) {
                if (activeOtpPromptText !== currentOtpActivePrompt) {
                    currentOtpActivePrompt = activeOtpPromptText;
                    startOtpTimer(60);
                } else {
                    updateOtpTimerUi();
                }
            } else {
                currentOtpActivePrompt = '';
                stopOtpTimer();
            }

            if (forceScroll || wasNearBottom || lastRenderedChatHistoryLength <= 1) {
                chatBox.scrollTop = chatBox.scrollHeight;
                const btn = document.getElementById('chatScrollBottomBtn');
                if (btn) {
                    btn.style.display = 'none';
                    btn.classList.remove('has-new-msg');
                }
            } else {
                // User was reading scrolled-up messages; preserve their scroll view!
                chatBox.scrollTop = prevScrollTop;
                const btn = document.getElementById('chatScrollBottomBtn');
                if (btn) {
                    btn.style.display = 'inline-flex';
                    if (isNewMessageAdded) {
                        btn.classList.add('has-new-msg');
                        const txt = document.getElementById('chatScrollBottomText');
                        if (txt) txt.innerText = '⬇️ புதிய செய்தி (கீழே பார்க்கவும்)';
                    }
                }
            }
        }


        function startOtpTimer(initialSecs) {
            otpSecondsLeft = (typeof initialSecs === 'number' && initialSecs > 0) ? initialSecs : 60;
            otpTotalSeconds = Math.max(otpTotalSeconds, otpSecondsLeft);
            updateOtpTimerUi();

            if (otpCountdownInterval) clearInterval(otpCountdownInterval);
            otpCountdownInterval = setInterval(() => {
                if (otpSecondsLeft > 0) {
                    otpSecondsLeft--;
                    updateOtpTimerUi();
                } else {
                    clearInterval(otpCountdownInterval);
                    otpCountdownInterval = null;
                    updateOtpTimerUi();
                }
            }, 1000);
        }

        function stopOtpTimer() {
            if (otpCountdownInterval) {
                clearInterval(otpCountdownInterval);
                otpCountdownInterval = null;
            }
            otpSecondsLeft = 0;
        }

        function updateOtpTimerUi() {
            const badge = document.getElementById('liveOtpBadge');
            const fill = document.getElementById('otpProgressFill');
            const btn = document.getElementById('resendOtpBtn');

            if (!btn) return;

            if (otpSecondsLeft > 0) {
                const formatted = formatTimerDisplay(otpSecondsLeft);
                if (badge) {
                    badge.innerText = `${formatted} (${otpSecondsLeft}s)`;
                    badge.style.background = '#fee2e2';
                    badge.style.color = '#b91c1c';
                }
                if (fill) {
                    const pct = Math.max(0, Math.min(100, (otpSecondsLeft / otpTotalSeconds) * 100));
                    fill.style.width = `${pct}%`;
                    fill.style.background = '#ef4444';
                }
                btn.disabled = true;
                btn.style.background = '#f1f5f9';
                btn.style.color = '#94a3b8';
                btn.style.borderColor = '#cbd5e1';
                btn.style.cursor = 'not-allowed';
                btn.innerHTML = `🔒 புதிய OTP பெற காத்திருக்கவும் (${formatted})`;
            } else {
                if (badge) {
                    badge.innerText = 'டைமர் முடிந்தது (Ready)';
                    badge.style.background = '#dcfce7';
                    badge.style.color = '#15803d';
                }
                if (fill) {
                    fill.style.width = '0%';
                }
                btn.disabled = false;
                btn.style.background = '#ea580c';
                btn.style.color = '#ffffff';
                btn.style.borderColor = '#c2410c';
                btn.style.cursor = 'pointer';
                btn.innerHTML = '🔄 OTP வரவில்லையா? மீண்டும் அனுப்பு (Resend OTP)';
            }
        }

        async function requestResendOtp() {
            const btn = document.getElementById('resendOtpBtn');
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '⏳ அரசு போர்ட்டலில் கிளிக் செய்யப்படுகிறது...';
            }

            try {
                const res = await fetch('/api/chat/resend-otp', { method: 'POST' });
                const data = await res.json();
                startOtpTimer(60);
                fetchHistory();
            } catch (e) {
                alert('பிழை: ' + e.message);
                if (btn) btn.disabled = false;
            }
        }

        function openPreSubmitModal() {
            // Operator Request: Completely bypass preSubmitModal and open unified Review & Edit Modal
            return openEditModal();
            const chatText = document.getElementById('chatMessages')?.innerText || '';
            const sData = data.subServiceData || window.lastSubServiceData || {};
            const isAddMember = data.subService === 'ADD_MEMBER' || 
                                Boolean(sData && Object.keys(sData).length > 0) ||
                                (window.lastReceivedChatOptions && window.lastReceivedChatOptions.some(o => (o.label || '').includes('உறுப்பினர்'))) ||
                                chatText.includes('குடும்ப உறுப்பினர் சேர்க்கை') ||
                                chatText.includes('குழந்தை சேர்க்கை');

            if (isAddMember) {
                const isAdultInChat = chatText.includes('பெரியவர்') || chatText.includes('மகன் / மகள் சேர்க்கை (5 வயதுக்கு மேற்பட்டவர்)') || chatText.includes('மகள்') || chatText.includes('மகன்');
                const isChild = sData.isChild === true || (!isAdultInChat && sData.isChild !== false && chatText.includes('குழந்தை'));

                let memName = sData.memberNameTam ? (sData.memberNameEng ? `${sData.memberNameTam} (${sData.memberNameEng})` : sData.memberNameTam) : (sData.memberName || '');
                if (!memName) {
                    const match = chatText.match(/சேர்க்கப்படும் நபர்:\s*([^\n\r(]+)/);
                    if (match && match[1]) memName = match[1].trim();
                }
                if (!memName) memName = isChild ? 'கவின் குமார்' : 'புதிய உறுப்பினர்';

                let memRel = sData.relationshipTam || sData.relationship || '';
                if (!memRel) {
                    const relMatch = chatText.match(/சேர்க்கப்படும் நபர்:[^\n\r(]+\(([^)]+)\)/);
                    if (relMatch && relMatch[1]) memRel = relMatch[1].trim();
                }
                if (!memRel) memRel = isChild ? 'மகன்' : 'உறுப்பினர்';

                let aadhaarDisplay = '';
                const rawAadh = sData.aadhaarNo || '';
                if (rawAadh) {
                    aadhaarDisplay = ` | <b>ஆதார்:</b> ${rawAadh.replace(/(\d{4})/g, '$1 ').trim()} ✅`;
                } else {
                    const aadhMatch = chatText.match(/ஆதார் எண்:\s*([\d\s]+)/);
                    if (aadhMatch && aadhMatch[1]) aadhaarDisplay = ` | <b>ஆதார்:</b> ${aadhMatch[1].trim()} ✅`;
                }

                let dobDisplay = '';
                const rawDob = sData.dob || '';
                if (rawDob) {
                    dobDisplay = ` | <b>பிறந்த தேதி:</b> ${rawDob}`;
                } else {
                    const dobMatch = chatText.match(/பிறந்த தேதி:\s*([^\n\r]+)/);
                    if (dobMatch && dobMatch[1]) dobDisplay = ` | <b>பிறந்த தேதி:</b> ${dobMatch[1].trim()}`;
                }

                const docLabel = isChild 
                    ? 'பிறப்புச் சான்றிதழ் (Birth Certificate)' 
                    : (sData.memberCategory === 'SON_DAUGHTER' || !sData.surrenderDocPath ? 'ஆதார் அட்டை (Aadhaar Card)' : 'ஆதார் அட்டை & நீக்கல் சான்று');

                document.getElementById('confirmHeadSummary').innerHTML = `
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <span style="font-size: 13px; font-weight: 800; color: #1e3a8a;">👶/👤 புதிய உறுப்பினர் சேர்க்கை (Add Member)</span>
                        <span style="background: ${isChild ? '#e0f2fe' : '#fef3c7'}; color: ${isChild ? '#0369a1' : '#92400e'}; padding: 2px 8px; border-radius: 4px; font-weight: 800;">${isChild ? 'குழந்தை' : 'பெரியவர்'}</span>
                    </div>
                    <div style="margin-top: 4px; font-size: 11px; color: #64748b;">
                        குடும்ப அட்டை எண்: <b>${data.smartCardNumber || data.rationCardNo || '05/G/0458921'}</b>
                    </div>
                `;

                document.getElementById('confirmMembersSummary').innerHTML = `
                    <div style="font-size: 12px; margin-bottom: 2px;">
                        • <b>பெயர்:</b> ${memName} | <b>உறவுமுறை:</b> ${memRel}${aadhaarDisplay}${dobDisplay}
                    </div>
                    <div style="font-size: 11.5px; color: #16a34a; font-weight: 700;">
                        • 📄 இணைக்கப்பட்ட சான்று: ${docLabel} ✅
                    </div>
                `;

                document.getElementById('confirmAddressSummary').innerHTML = `
                    <div style="font-size: 11.5px; color: #475569;">
                        🏛️ <b>சேவை:</b> தமிழ்நாடு அரசு TNPDS குடும்ப அட்டை உறுப்பினர் சேர்க்கை
                    </div>
                `;

                const gasBox = document.getElementById('confirmGasBox');
                if (gasBox) gasBox.style.display = 'none';

                const rawMob = data.mobileNumber || localStorage.getItem('eseva_active_customer_mobile') || '9876543210';
                let cleanMob = rawMob.replace(/\D/g, '');
                if (cleanMob.length === 12 && cleanMob.startsWith('91')) cleanMob = cleanMob.slice(2);
                if (!cleanMob || cleanMob.length !== 10) cleanMob = '9876543210';

                const confirmMobileWrap = document.getElementById('confirmMobileWrap');
                if (confirmMobileWrap) confirmMobileWrap.style.display = 'block';
                const confirmMobileSummary = document.getElementById('confirmMobileSummary');
                if (confirmMobileSummary) confirmMobileSummary.innerText = `+91 ${cleanMob}`;

                syncDevMockUI();
                document.getElementById('preSubmitModal').style.display = 'flex';
                return;
            }

            openEditModal();
            return;
            const headName = data.fullNameTam ? `${data.fullNameTam} (${data.fullNameEng || ''})` : (data.fullNameEng || '—');
            const fatherHusband = data.fatherNameTam ? `${data.fatherNameTam} (${data.fatherNameEng || ''})` : (data.fatherNameEng || '—');
            const genderBadge = (data.headGender === 'Female' || data.headGenderTam === 'பெண்') 
                ? '<span style="background: #fce7f3; color: #9d174d; padding: 2px 8px; border-radius: 4px; font-weight: 800;">பெண் (Female)</span>' 
                : '<span style="background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 4px; font-weight: 800;">ஆண் (Male)</span>';
            
            document.getElementById('confirmHeadSummary').innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <span style="font-size: 13px; font-weight: 800;">${headName}</span>
                    ${genderBadge}
                </div>
                <div style="margin-top: 4px; font-size: 11px; color: #64748b;">
                    பிறந்த தேதி: <b>${data.headDob || '—'}</b> | தந்தை/கணவர்: <b>${fatherHusband}</b> | ஆதார்: <b>${data.headAadhaar ? data.headAadhaar.replace(/(\d{4})/g, '$1 ').trim() : '—'}</b>
                </div>
            `;

            const members = data.members || [];
            let memHtml = '';
            if (members.length === 0) {
                memHtml = '—';
            } else {
                members.forEach((m, idx) => {
                    const memGender = (m.gender === 'Female' || m.genderTam === 'பெண்') ? 'பெண்' : 'ஆண்';
                    memHtml += `<div style="margin-bottom: 3px;">${idx + 1}. <b>${m.nameTam || m.nameEng}</b> (${m.relationshipTam || 'தலைவர்'} - ${memGender}) - <small style="color:#64748b;">ஆதார்: ${m.aadhaarNumber ? m.aadhaarNumber.replace(/(\d{4})/g, '$1 ').trim() : '—'}</small></div>`;
                });
            }
            document.getElementById('confirmMembersSummary').innerHTML = memHtml;

            const fullAddr = [data.doorNo, data.streetTam || data.streetEng, data.areaTam || data.areaEng].filter(Boolean).join(', ');
            document.getElementById('confirmAddressSummary').innerHTML = `
                <div><b>முகவரி (கதவு எண், தெரு, பகுதி):</b> ${fullAddr || '—'}</div>
                <div style="margin-top: 6px; background: #e0e7ff; color: #3730a3; padding: 6px 10px; border-radius: 6px; font-size: 12px; border: 1px solid #c7d2fe;">
                    🏛️ <b>மாவட்டம்:</b> <span style="font-weight: 800; color: #1e1b4b;">${data.district || 'Ranipet'}</span> | <b>வட்டம்:</b> <span style="font-weight: 800; color: #1e1b4b;">${data.taluk || 'Arakkonam'}</span> | <b>வருவாய் கிராமம்:</b> <span style="font-weight: 800; color: #1e1b4b;">${data.village || 'Anverthikanpettai'}</span>
                </div>
                ${(data.districtAutoCorrected && data.districtCorrectionReason) ? `
                <div style="margin-top: 6px; background: #ecfdf5; color: #065f46; padding: 6px 10px; border-radius: 6px; font-size: 11.5px; border: 1px solid #a7f3d0; display: flex; align-items: center; gap: 6px;">
                    <span>💡</span> <span>${data.districtCorrectionReason}</span>
                </div>` : ''}
                <div style="margin-top: 4px; font-size: 11px; color: #64748b;">📮 பின்கோடு: <b>${data.pincode || '—'}</b></div>
            `;

            // Gas Status
            const hasGas = !!(data.gasDetails && data.gasDetails.hasGas === true && data.gasDetails.consumerNumber);
            const gasBox = document.getElementById('confirmGasBox');
            const gasTitle = document.getElementById('confirmGasTitle');
            const gasDesc = document.getElementById('confirmGasDesc');

            if (hasGas) {
                gasBox.style.background = '#f0fdf4';
                gasBox.style.borderColor = '#86efac';
                gasTitle.style.color = '#166534';
                gasTitle.innerHTML = '🔥 4. எரிவாயு இணைப்பு (Gas Connection): <span style="color: #16a34a; font-weight: 700;">✅ உள்ளது (Yes)</span>';
                gasDesc.style.color = '#15803d';
                gasDesc.innerHTML = `நிறுவனம்: <b>${data.gasDetails.oilCompanyDisplay || data.gasDetails.oilCompany || '—'}</b> | நுகர்வோர் எண்: <b>${data.gasDetails.consumerNumber}</b> | சிலிண்டர்: <b>${data.gasDetails.cylinders || '1'}</b>`;
            } else {
                gasBox.style.background = '#fffbeb';
                gasBox.style.borderColor = '#fde047';
                gasTitle.style.color = '#854d0e';
                gasTitle.innerHTML = '🔥 4. எரிவாயு இணைப்பு (Gas Connection): <span style="color: #dc2626; font-weight: 700;">❌ இல்லை (No Gas Connection)</span>';
                gasDesc.style.color = '#92400e';
                gasDesc.innerHTML = `💡 <b>அரசு TNPDS படிவத்தில் எரிவாயு இணைப்பு அறிவிப்புப் பெட்டி (Checkbox) டிக் செய்யப்படாது (Unchecked).</b> எரிவாயு இணைப்பு இல்லாத குடும்பமாகச் சமர்ப்பிக்கப்படும்.`;
            }

            const rawMob = data.mobileNumber || localStorage.getItem('eseva_active_customer_mobile') || '';
            let cleanMob = rawMob.replace(/\D/g, '');
            if (cleanMob.length === 12 && cleanMob.startsWith('91')) cleanMob = cleanMob.slice(2);
            const isRealMobile = cleanMob.length === 10 && ['6','7','8','9'].includes(cleanMob[0]);

            const confirmMobileWrap = document.getElementById('confirmMobileWrap');
            const confirmMobileInputWrap = document.getElementById('confirmMobileInputWrap');
            const preSubmitMobileInput = document.getElementById('preSubmitMobileInput');

            if (isRealMobile) {
                if (confirmMobileWrap) confirmMobileWrap.style.display = 'block';
                if (confirmMobileInputWrap) confirmMobileInputWrap.style.display = 'none';
                document.getElementById('confirmMobileSummary').innerText = `+91 ${cleanMob}`;
            } else {
                if (confirmMobileWrap) confirmMobileWrap.style.display = 'none';
                if (confirmMobileInputWrap) confirmMobileInputWrap.style.display = 'block';
                if (preSubmitMobileInput) {
                    preSubmitMobileInput.value = '';
                    setTimeout(() => preSubmitMobileInput.focus(), 200);
                }
            }
            syncDevMockUI();
            document.getElementById('preSubmitModal').style.display = 'flex';
        }


        function closePreSubmitModal() {
            document.getElementById('preSubmitModal').style.display = 'none';
        }

        function isDevMockModeActive() {
            // ⛔ PRODUCTION LOCK: Dev Mock Mode can ONLY activate on localhost.
            // On esevadraft.in or any non-local URL, always return false — no exceptions.
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            if (!isLocal) return false;

            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.has('dev') || urlParams.has('mock')) {
                const val = (urlParams.get('dev') || urlParams.get('mock') || '').toLowerCase();
                const active = (val === '1' || val === 'true' || val === '');
                localStorage.setItem('eseva_dev_mock_mode', active ? 'true' : 'false');
                return active;
            }
            const stored = localStorage.getItem('eseva_dev_mock_mode');
            if (stored === 'false') {
                return false;
            }
            // On localhost, ALWAYS default to TRUE for safe zero-OTP testing
            return true;
        }

        function toggleDevMockMode() {
            const current = isDevMockModeActive();
            const next = !current;
            localStorage.setItem('eseva_dev_mock_mode', next ? 'true' : 'false');
            syncDevMockUI();
            alert(next 
                ? '🛠️ டெவலப்பர் சோதனை முறை இயக்கப்பட்டது (Dev Mock Mode: ON)\n\nவாடிக்கையாளர் எண்ணிற்கு அரசு OTP அனுப்பப்படாது. பாதுகாப்பான மாதிரி சோதனை முறையில் இயங்கும்.'
                : '🚀 நேரலை முறை இயக்கப்பட்டது (Live Production Mode: ON)\n\nஅரசு TNPDS இணையதளத்தில் இருந்து வாடிக்கையாளர் எண்ணிற்கு நேரலை SMS OTP அனுப்பப்படும்.');
        }

        function syncDevMockUI() {
            const isDev = isDevMockModeActive();
            const badge = document.getElementById('devMockModeBadge');
            if (badge) {
                if (isDev) {
                    // On localhost: remove the CSS !important rule so badge can show
                    badge.style.removeProperty('display');
                    badge.style.display = 'inline-flex';
                } else {
                    // On production: CSS !important already hides it; belt-and-suspenders
                    badge.style.display = 'none';
                }
                badge.innerHTML = `<i class="fa-solid fa-flask" style="color: #d97706;"></i><span>Dev Mock: <b style="color: #b45309;">${isDev ? 'ON' : 'OFF'}</b></span>`;
            }
            const mockBtn = document.getElementById('btnPreSubmitMock');
            if (mockBtn) {
                mockBtn.style.display = isDev ? 'inline-flex' : 'none';
            }
            const devBanner = document.getElementById('devMockBanner');
            if (devBanner) {
                devBanner.style.display = isDev ? 'flex' : 'none';
            }
            const realBtn = document.getElementById('btnPreSubmitReal');
            if (realBtn) {
                if (isDev) {
                    realBtn.innerHTML = `<i class="fa-solid fa-satellite-dish"></i> நேரலை முறை (Live OTP)`;
                } else {
                    realBtn.innerHTML = `🚀 அரசு போர்ட்டலில் சமர்ப்பி (Submit Application)`;
                }
            }
            const demoBtn = document.getElementById('btnDemoTestKumaran');
            if (demoBtn) {
                demoBtn.style.display = isDev ? 'inline-flex' : 'none';
            }
        }

        function handlePreSubmitClick() {
            if (isDevMockModeActive()) {
                // In developer mode, submit safely runs Mock Test (Zero OTP dispatched)
                proceedConfirmedSubmit(false);
            } else {
                // In regular operator mode, submit directly triggers real government OTP
                proceedConfirmedSubmit(true);
            }
        }

        function openOfficialPortal() {
            window.open('https://www.tnpds.gov.in/pages/register/cardreg-home.xhtml', '_blank');
        }

        function openReviewTab() {
            openOfficialPortal();
        }
