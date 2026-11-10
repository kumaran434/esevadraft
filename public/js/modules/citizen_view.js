// eSevaDraft Domain Module: citizen_view.js

        function citizenSwitchSubTab(subTab) {
            currentCitizenSubTab = subTab;
            const servicesView = document.getElementById('citizenServicesView');
            const chatArea = document.querySelector('.citizen-chat-area');
            const docsView = document.getElementById('citizenDocsView');
            const profileView = document.getElementById('citizenProfileView');
            const mTitle = document.getElementById('cMobileHeaderTitle');
            const mSub = document.getElementById('cMobileHeaderSub');

            // Reset all bottom nav active states
            const navBtns = ['Services', 'Chat', 'Docs', 'Profile'];
            navBtns.forEach(name => {
                const b = document.getElementById(`btnCitizenNav${name}`);
                if (b) b.classList.remove('active');
            });

            // Hide all views first
            if (servicesView) servicesView.style.display = 'none';
            if (chatArea) chatArea.style.display = 'none';
            if (docsView) docsView.style.display = 'none';
            if (profileView) profileView.style.display = 'none';

            if (subTab === 'services') {
                if (servicesView) servicesView.style.display = 'flex';
                const b = document.getElementById('btnCitizenNavServices');
                if (b) b.classList.add('active');
                if (mTitle) mTitle.innerText = 'eSevaDraft சேவைகள்';
                if (mSub) mSub.innerText = 'தமிழ்நாடு அரசு சேவைகள் ஏஐ';
                updateCitizenServicesDraftCard();
            } else if (subTab === 'chat') {
                if (chatArea) chatArea.style.display = 'flex';
                const b = document.getElementById('btnCitizenNavChat');
                if (b) b.classList.add('active');
                if (mTitle) mTitle.innerText = 'விண்ணப்ப மையம்';
                if (mSub) mSub.innerText = 'நேரடி AI வழிகாட்டல்';
                const msgBox = document.getElementById('chatMessages');
                if (msgBox) msgBox.scrollTop = msgBox.scrollHeight;
            } else if (subTab === 'docs') {
                if (docsView) docsView.style.display = 'flex';
                const b = document.getElementById('btnCitizenNavDocs');
                if (b) b.classList.add('active');
                if (mTitle) mTitle.innerText = 'ஆவணங்கள் & விண்ணப்பங்கள்';
                if (mSub) mSub.innerText = 'சேமிக்கப்பட்ட படிவங்கள்';
                renderCitizenDocsView();
            } else if (subTab === 'profile') {
                if (profileView) profileView.style.display = 'flex';
                const b = document.getElementById('btnCitizenNavProfile');
                if (b) b.classList.add('active');
                if (mTitle) mTitle.innerText = 'பயனர் சுயவிவரம்';
                if (mSub) mSub.innerText = 'குடிமக்கள் கணக்கு';
                renderCitizenProfileView();
            }
        }

        async function citizenStartService(serviceName) {
            const isOp = localStorage.getItem('eseva_user_role') === 'operator';
            const userMob = isOp ? (localStorage.getItem('eseva_active_customer_mobile') || '') : (localStorage.getItem('eseva_user_mobile') || '');

            // RULE: If operator has no active customer selected, always prompt for customer mobile first!
            if (isOp && (!userMob || userMob.startsWith('walkin_'))) {
                if (typeof startDirectApplyService === 'function') {
                    startDirectApplyService(serviceName);
                } else if (typeof openNewCustomerModal === 'function') {
                    window.pendingSelectedService = serviceName;
                    openNewCustomerModal();
                }
                return;
            }

            citizenSwitchSubTab('chat');
            const opUid = localStorage.getItem('eseva_operator_uid') || '';

            const rBanner = document.getElementById('resumeBanner');
            if (rBanner) rBanner.classList.remove('show');
            const aBanner = document.getElementById('appNumberBanner');
            if (aBanner) aBanner.classList.remove('show');

            try {
                const res = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-session-mobile': userMob, 'x-operator-uid': opUid },
                    body: JSON.stringify({ message: serviceName, mobileNumber: userMob })
                });
                const data = await res.json();
                renderMessages(data.chatHistory, true);
                updateSidebar(data);
            } catch (e) {
                console.error('Failed to start service:', e);
            }
        }

        async function renderCitizenDocsView() {
            try {
                // 1. Check submitted application info
                const refNoEl = document.getElementById('appRefNoDisplay');
                const pdfBtn = document.getElementById('downloadAppPdfBtn');
                const cDocsRef = document.getElementById('cDocsAppRefNo');
                const cDocsPdfBtn = document.getElementById('cDocsPdfDownloadBtn');
                const cDocsBadge = document.getElementById('cDocsAppBadge');
                
                const hasAppNo = refNoEl && refNoEl.innerText && refNoEl.innerText.trim() !== '' && refNoEl.innerText.trim() !== '—';
                if (hasAppNo) {
                    if (cDocsRef) cDocsRef.innerText = refNoEl.innerText.trim();
                    if (cDocsBadge) {
                        cDocsBadge.innerText = 'சமர்ப்பிக்கப்பட்டது';
                        cDocsBadge.style.background = '#dcfce7';
                        cDocsBadge.style.color = '#15803d';
                    }
                    if (cDocsPdfBtn) {
                        if (pdfBtn && pdfBtn.href && pdfBtn.href !== '#' && !pdfBtn.href.endsWith('#')) {
                            cDocsPdfBtn.href = pdfBtn.href;
                            cDocsPdfBtn.style.display = 'inline-flex';
                        } else {
                            cDocsPdfBtn.href = '/api/download-official-pdf';
                            cDocsPdfBtn.style.display = 'inline-flex';
                        }
                    }
                } else {
                    if (cDocsRef) cDocsRef.innerText = 'வரைவு நிலையிலுள்ளது (Draft in progress)';
                    if (cDocsBadge) {
                        cDocsBadge.innerText = 'வரைவு (Draft)';
                        cDocsBadge.style.background = '#fef3c7';
                        cDocsBadge.style.color = '#92400e';
                    }
                    if (cDocsPdfBtn) {
                        cDocsPdfBtn.href = '#';
                        cDocsPdfBtn.onclick = (e) => { e.preventDefault(); citizenSwitchSubTab('chat'); };
                    }
                }

                // 2. Fetch document locker
                const res = await fetch('/api/documents');
                const data = await res.json();
                const listEl = document.getElementById('citizenDocsList');
                if (listEl) {
                    if (data.documents && data.documents.length > 0) {
                        listEl.innerHTML = data.documents.map(d => `
                            <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <div style="width: 32px; height: 32px; border-radius: 6px; background: #eff6ff; color: #2563eb; display: flex; align-items: center; justify-content: center; font-size: 15px;">
                                        <i class="fa-solid ${d.type && d.type.includes('pdf') ? 'fa-file-pdf' : 'fa-file-image'}"></i>
                                    </div>
                                    <div>
                                        <strong style="font-size: 12px; color: #0f172a; display: block;">${d.title || d.filename}</strong>
                                        <span style="font-size: 10px; color: #64748b;">${d.filename}</span>
                                    </div>
                                </div>
                                <a href="/api/documents/download/${encodeURIComponent(d.filename)}" download class="btn-download-doc" style="padding: 5px 10px; font-size: 11px; height: 30px; border-radius: 6px;">
                                    <i class="fa-solid fa-download"></i> பதிவிறக்கு
                                </a>
                            </div>
                        `).join('');
                    } else {
                        listEl.innerHTML = `
                            <div style="text-align: center; padding: 20px 10px; color: #94a3b8; font-size: 12px;">
                                <i class="fa-solid fa-cloud-arrow-up" style="font-size: 28px; margin-bottom: 6px; display: block; color: #cbd5e1;"></i>
                                இதுவரை ஆவணங்கள் எதுவும் பதிவேற்றப்படவில்லை.<br>விண்ணப்ப உரையாடலில் நீங்கள் இணைக்கும் ஆதார் சான்றிதழ்கள் இங்கு தானாகவே சேமிக்கப்படும்.
                            </div>
                        `;
                    }
                }
            } catch (e) {
                console.warn('renderCitizenDocsView error:', e);
            }
        }


        function renderCitizenProfileView() {
            const userName = localStorage.getItem('eseva_user_name') || 'பொதுமக்கள் பயனர்';
            const userMob = localStorage.getItem('eseva_user_mobile') || localStorage.getItem('eseva_operator_mobile') || '—';
            const profName = document.getElementById('cProfileName');
            const profMob = document.getElementById('cProfileMobile');
            const profMobDet = document.getElementById('cProfileMobileDetail');
            if (profName) profName.innerText = userName;
            if (profMob) profMob.innerText = userMob !== '—' ? `+91 ${userMob}` : '—';
            if (profMobDet) profMobDet.innerText = userMob !== '—' ? `+91 ${userMob}` : '—';
        }

        function updateCitizenServicesDraftCard() {
            const draftCard = document.getElementById('cActiveDraftCard');
            const draftDesc = document.getElementById('cActiveDraftDesc');
            const draftBadge = document.getElementById('cActiveDraftBadge');
            const refNoEl = document.getElementById('appRefNoDisplay');
            const hasAppNo = refNoEl && refNoEl.innerText && refNoEl.innerText.trim() !== '' && refNoEl.innerText.trim() !== '—';

            if (hasAppNo) {
                if (draftCard) draftCard.style.display = 'block';
                if (draftBadge) {
                    draftBadge.innerText = 'சமர்ப்பிக்கப்பட்டது';
                    draftBadge.style.background = '#dcfce7';
                    draftBadge.style.color = '#15803d';
                }
                if (draftDesc) draftDesc.innerHTML = `விண்ணப்ப எண்: <b>${refNoEl.innerText.trim()}</b><br>TNPDS அரசு போர்ட்டலில் சரிபார்ப்பு நிலையில் உள்ளது.`;
            } else {
                const headNameEl = document.getElementById('infoHeadName');
                const hasHead = headNameEl && headNameEl.innerText && headNameEl.innerText.trim() !== '—';
                if (hasHead) {
                    if (draftCard) draftCard.style.display = 'block';
                    if (draftBadge) {
                        draftBadge.innerText = 'வரைவு (DRAFT)';
                        draftBadge.style.background = '#fef3c7';
                        draftBadge.style.color = '#92400e';
                    }
                    if (draftDesc) draftDesc.innerHTML = `குடும்பத் தலைவர்: <b>${headNameEl.innerText.trim()}</b><br>விண்ணப்பம் பாதி நிரப்பப்பட்டுள்ளது. தொடர பொத்தானை அழுத்தவும்.`;
                } else if (draftCard) {
                    draftCard.style.display = 'none';
                }
            }
        }

        // Universal Auto-Telemetry Error Capture (Captures client errors silently to /api/operator/telemetry-log)
        window.reportUiError = function(type, message, extraData) {
            try {
                const payload = {
                    type: type || 'CLIENT_UI_ERROR',
                    message: typeof message === 'string' ? message : (message && message.message) || JSON.stringify(message || {}),
                    role: localStorage.getItem('eseva_user_role') || 'operator',
                    activeMobile: localStorage.getItem('eseva_active_customer_mobile') || '',
                    time: new Date().toISOString(),
                    ...(extraData || {})
                };
                window.__lastRecordedError = payload;
                console.warn('🚨 [Auto-Telemetry] Recording UI Error:', payload.type, payload.message);
                fetch('/api/operator/telemetry-log', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }).catch(() => {});
            } catch (_) {}
        };

        // Auto-capture any alert dialog displaying errors
        if (typeof window !== 'undefined' && window.alert) {
            const originalAlert = window.alert;
            window.alert = function(msg) {
                try {
                    const str = String(msg || '');
                    if (str.includes('பிழை') || str.toLowerCase().includes('error') || str.includes('⚠️')) {
                        window.reportUiError('USER_ALERT_SHOWN', str, { url: window.location.href });
                    }
                } catch (_) {}
                return originalAlert.apply(this, arguments);
            };
        }

        window.addEventListener('error', function(e) {
            window.reportUiError('UNHANDLED_ERROR', e.message, {
                filename: e.filename,
                lineno: e.lineno,
                colno: e.colno
            });
        });

        window.addEventListener('unhandledrejection', function(e) {
            window.reportUiError('PROMISE_REJECTION', e.reason ? (e.reason.message || String(e.reason)) : 'Unknown rejection', {
                stack: e.reason ? e.reason.stack : null
            });
        });

        window.addEventListener('DOMContentLoaded', () => {
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('dev') === 'true' || urlParams.get('test') === 'true') {
                const bar = document.getElementById('localRoleSwitcherBar');
                if (bar) bar.style.display = 'flex';
            }
            if (typeof syncDevMockUI === 'function') {
                syncDevMockUI();
            }

            // In Desktop App, ensure Operator account type is pre-selected by default
            if (isRunningInDesktopApp()) {
                const radioOp = document.querySelector('input[name="loginRole"][value="operator"]');
                if (radioOp) {
                    radioOp.checked = true;
                    toggleLoginRoleSelection('operator');
                }
            }

            // Smart auto-detect: typing 10 digits looks up whether phone belongs to an operator
            const loginInput = document.getElementById('loginIdentifier');
            if (loginInput) {
                loginInput.addEventListener('input', async (e) => {
                    const clean = (e.target.value || '').replace(/\D/g, '');
                    if (clean.length === 10) {
                        try {
                            const res = await fetch(`/api/auth/lookup-mobile?mobile=${clean}`);
                            const data = await res.json();
                            if (data && data.found && data.role) {
                                const radio = document.querySelector(`input[name="loginRole"][value="${data.role}"]`);
                                if (radio) {
                                    radio.checked = true;
                                    toggleLoginRoleSelection(data.role);
                                }
                            }
                        } catch (err) {}
                    }
                });
            }

            // Live 51-step Desktop Automation Streamer:
            // Broadcasts each step (Step 1 to 51) live into the chat interface without wiping chat!
            if (window.esevaDesktopBridge && window.esevaDesktopBridge.onAutomationUpdate && !window.__desktopUpdateListenerRegistered) {
                window.__desktopUpdateListenerRegistered = true;
                window.esevaDesktopBridge.onAutomationUpdate((stepMessage) => {
                    appendLiveAutomationStep(stepMessage);
                });
            }
            if (window.esevaDesktopBridge && window.esevaDesktopBridge.onAutomationFinished && !window.__desktopFinishedListenerRegistered) {
                window.__desktopFinishedListenerRegistered = true;
                window.esevaDesktopBridge.onAutomationFinished((res) => {
                    handleAutomationFinished(res);
                });
            }
        });

        // Global shortcut Ctrl+Alt+D or Ctrl+Shift+D toggles Developer Mock Mode
        window.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && (e.altKey || e.shiftKey) && (e.key === 'D' || e.key === 'd')) {
                e.preventDefault();
                if (typeof toggleDevMockMode === 'function') {
                    toggleDevMockMode();
                }
            }
        });


        function switchToRole(targetRole) {
            localStorage.setItem('eseva_user_role', targetRole);
            if (targetRole === 'operator') {
                localStorage.setItem('eseva_allow_web_desk', 'true');
                applyRoleUi('operator', localStorage.getItem('eseva_operator_name') || 'ஆபரேட்டர் மையம்');
                switchTab('citizen');
                fetchOperatorDrafts();
            } else {
                applyRoleUi('citizen', localStorage.getItem('eseva_user_name') || 'பொதுமக்கள்');
                switchTab('citizen');
                citizenSwitchSubTab('services');
            }
            updateSwitcherButtonsUi(targetRole);
        }

        function updateSwitcherButtonsUi(role) {
            const btnOp = document.getElementById('switcherBtnOperator');
            const btnCit = document.getElementById('switcherBtnCitizen');
            if (!btnOp || !btnCit) return;
            if (role === 'operator') {
                btnOp.style.background = '#10b981';
                btnOp.style.color = '#064e3b';
                btnOp.style.boxShadow = '0 1px 4px rgba(0,0,0,0.2)';
                btnCit.style.background = 'transparent';
                btnCit.style.color = '#94a3b8';
                btnCit.style.boxShadow = 'none';
            } else {
                btnCit.style.background = '#10b981';
                btnCit.style.color = '#064e3b';
                btnCit.style.boxShadow = '0 1px 4px rgba(0,0,0,0.2)';
                btnOp.style.background = 'transparent';
                btnOp.style.color = '#94a3b8';
                btnOp.style.boxShadow = 'none';
            }
        }

        function applyRoleUi(role, displayName) {
            const isOp = (role === 'operator');
            const citizenNavBtn = document.getElementById('tabBtnCitizen');
            const opNavBtn = document.getElementById('tabBtnOperator');
            const portalNavBtn = document.getElementById('tabBtnPortal');
            const lockerNavBtn = document.getElementById('tabBtnLocker');
            const adminNavBtn = document.getElementById('tabBtnAdmin');
            const resetNavBtn = document.getElementById('tabBtnReset');
            const viewToggleBtn = document.getElementById('viewToggleBtn');
            const btnNewCustomerNav = document.getElementById('btnNewCustomerNav');
            const btnDraftsNav = document.getElementById('btnDraftsNav');
            const btnDesktopAppNav = document.getElementById('btnDesktopAppNav');
            const btnLogoutNav = document.getElementById('btnLogoutNav');
            const badge = document.getElementById('authProfileBadge');
            const nameEl = document.getElementById('authProfileName');
            const backBtn = document.getElementById('btnBackToOperator');
            const saveDraftBtn = document.getElementById('btnSaveDraftTop');
            const navTabs = document.getElementById('mainNavTabs');
            const webDlView = document.getElementById('operatorWebDownloadView');
            const workArea = document.getElementById('operatorDesktopWorkArea');
            const desktopNavbar = document.querySelector('.navbar');
            const citizenPanel = document.getElementById('panel-citizen');
            const mHeader = document.getElementById('citizenMobileHeader');
            const bNav = document.getElementById('citizenBottomNav');
            const btnBackServices = document.getElementById('btnBackToServices');
            const sidebar = document.querySelector('.citizen-sidebar');
            const chatArea = document.querySelector('.citizen-chat-area');

            const opName = displayName || localStorage.getItem('eseva_operator_name') || 'குமரன் இ-சேவை மையம்';
            const citName = displayName || localStorage.getItem('eseva_user_name') || 'பொதுமக்கள்';
            const name = isOp ? opName : citName;
            if (isOp && opName) localStorage.setItem('eseva_operator_name', opName);

            const isOperatorWorkspaceAllowed = isRunningInDesktopApp() || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || localStorage.getItem('eseva_allow_web_desk') === 'true';

            updateSwitcherButtonsUi(role);

            const iconHtml = isOp 
                ? '<i class="fa-solid fa-store" style="color: #fde047; font-size: 13px;"></i>' 
                : '<i class="fa-solid fa-user" style="color: #6ee7b7; font-size: 13px;"></i>';

            // Profile Badge & Logout
            if (badge) {
                const tooltipText = `${name} (சுயவிவரம்)`;
                badge.setAttribute('data-tooltip', tooltipText);
                badge.setAttribute('title', tooltipText);
                badge.innerHTML = `${iconHtml}<span id="authProfileName" style="display: none;">${name}</span>`;
                badge.style.display = 'inline-flex';
            }
            if (btnLogoutNav) btnLogoutNav.style.display = 'inline-flex';
            const resetHeaderBtn = document.getElementById('btnHeaderReset');
            const homeHeaderBtn = document.getElementById('btnHeaderHome');
            const toolsHeaderBtn = document.getElementById('btnHeaderTools');
            if (toolsHeaderBtn) toolsHeaderBtn.style.display = 'inline-flex';

            if (isOp) {
                // Restore Operator layout
                if (desktopNavbar) desktopNavbar.style.display = 'flex';
                if (citizenPanel) citizenPanel.classList.remove('citizen-mode');
                if (mHeader) mHeader.style.display = 'none';
                if (bNav) bNav.style.display = 'none';
                if (btnBackServices) btnBackServices.style.display = 'none';
                if (sidebar) sidebar.style.display = 'flex';
                if (chatArea) chatArea.style.display = 'flex';
                const sView = document.getElementById('citizenServicesView');
                if (sView) sView.style.display = 'none';
                const dView = document.getElementById('citizenDocsView');
                if (dView) dView.style.display = 'none';
                const pView = document.getElementById('citizenProfileView');
                if (pView) pView.style.display = 'none';

                if (isOperatorWorkspaceAllowed) {
                    // Operator active workspace: Show workspace actions
                    if (navTabs) navTabs.style.display = 'none';
                    if (btnNewCustomerNav) btnNewCustomerNav.style.display = 'none';
                    if (btnDraftsNav) btnDraftsNav.style.display = 'none';
                    if (btnDesktopAppNav) btnDesktopAppNav.style.display = 'none';
                    if (viewToggleBtn) viewToggleBtn.style.display = 'none';
                    if (backBtn) backBtn.style.display = 'inline-flex';
                    if (saveDraftBtn) saveDraftBtn.style.display = 'inline-flex';
                    if (resetHeaderBtn) resetHeaderBtn.style.display = 'inline-flex';
                    if (homeHeaderBtn) homeHeaderBtn.style.display = 'inline-flex';

                    if (webDlView) webDlView.style.display = 'none';
                    if (workArea) workArea.style.display = 'block';

                    // USER REQUIREMENT: Website/App MUST open to Chat Interface first!
                    switchTab('citizen');
                    const activeCustMob = localStorage.getItem('eseva_active_customer_mobile');
                    if (!activeCustMob && typeof resetSidebarToOperatorView === 'function') {
                        resetSidebarToOperatorView(name);
                    }
                    fetchOperatorDrafts();
                } else {
                    // Web Browser download view: Clean header with NO clutter (hide chat reset/save/home)
                    if (navTabs) navTabs.style.display = 'none';
                    if (btnNewCustomerNav) btnNewCustomerNav.style.display = 'none';
                    if (btnDraftsNav) btnDraftsNav.style.display = 'none';
                    if (btnDesktopAppNav) btnDesktopAppNav.style.display = 'none';
                    if (viewToggleBtn) viewToggleBtn.style.display = 'none';
                    if (backBtn) backBtn.style.display = 'none';
                    if (saveDraftBtn) saveDraftBtn.style.display = 'none';
                    if (resetHeaderBtn) resetHeaderBtn.style.display = 'none';
                    if (homeHeaderBtn) homeHeaderBtn.style.display = 'none';

                    if (webDlView) webDlView.style.display = 'block';
                    if (workArea) workArea.style.display = 'none';

                    switchTab('citizen');
                }
            } else {
                // 3. CITIZEN MODE: Dedicated clean Mobile App experience
                if (desktopNavbar) desktopNavbar.style.display = 'none';
                if (navTabs) navTabs.style.display = 'none';
                if (btnNewCustomerNav) btnNewCustomerNav.style.display = 'none';
                if (btnDraftsNav) btnDraftsNav.style.display = 'none';
                if (btnDesktopAppNav) btnDesktopAppNav.style.display = 'none';
                if (viewToggleBtn) viewToggleBtn.style.display = 'none';
                if (backBtn) backBtn.style.display = 'none';
                if (saveDraftBtn) saveDraftBtn.style.display = 'none';

                if (citizenPanel) citizenPanel.classList.add('citizen-mode');
                if (mHeader) mHeader.style.display = 'flex';
                if (bNav) bNav.style.display = 'flex';
                if (btnBackServices) btnBackServices.style.display = 'inline-flex';
                if (sidebar) sidebar.style.display = 'none';

                const cWelcome = document.getElementById('cWelcomeUserName');
                if (cWelcome) cWelcome.innerText = name;

                switchTab('citizen');
                citizenSwitchSubTab('services');
                updateCitizenServicesDraftCard();
            }
        }

        window.openWebOperatorDesk = function() {
            localStorage.setItem('eseva_allow_web_desk', 'true');
            applyRoleUi('operator');
            if (typeof fetchOperatorDrafts === 'function') fetchOperatorDrafts();
        };
        window.showWebDownloadPrompt = function() {
            localStorage.removeItem('eseva_allow_web_desk');
            applyRoleUi('operator');
        };
