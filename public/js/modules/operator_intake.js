// eSevaDraft Domain Module: operator_intake.js

        // 🛡️ Electron Windows Anti-Freeze Guard:
        // Native browser alert() permanently kills Chromium <input> keyboard focus on Windows Electron!
        // Route alert() cleanly to non-blocking in-app toast inside Desktop App & auto-restore focus after file pickers.
        (function installElectronFocusShield() {
            if (window.__esevaElectronFocusShieldInstalled) return;
            window.__esevaElectronFocusShieldInstalled = true;
            const restoreDesktopFocus = () => {
                if (window.esevaDesktopBridge && typeof window.esevaDesktopBridge.restoreFocus === 'function') {
                    window.esevaDesktopBridge.restoreFocus().catch(() => {});
                } else if (window.esevaDesktopBridge && window.esevaDesktopBridge.isDesktopApp) {
                    fetch('/api/desktop/window-action?action=focus').catch(() => {});
                }
            };
            window.restoreDesktopKeyboardFocus = restoreDesktopFocus;
            if (window.esevaDesktopBridge && window.esevaDesktopBridge.isDesktopApp) {
                window._nativeBrowserAlert = window.alert;
                window.alert = function(msg) {
                    const text = String(msg || '').trim();
                    if (typeof window.showInAppToast === 'function') {
                        window.showInAppToast(text, true);
                    } else if (typeof window.showEsevaToast === 'function') {
                        window.showEsevaToast(text, 'error');
                    }
                    setTimeout(restoreDesktopFocus, 50);
                };
                // After any native Windows file picker closes, restore Chromium WebContents keyboard focus
                document.addEventListener('change', (e) => {
                    if (e.target && e.target.type === 'file') {
                        setTimeout(restoreDesktopFocus, 120);
                    }
                }, true);
            }
        })();

        function openNewCustomerModal() {
            const mobInput = document.getElementById('newCustomerMobileInput');
            const svcBadge = document.getElementById('modalSelectedServiceBadge');
            const box = document.getElementById('customerSuggestionsBox');
            const clearBtn = document.getElementById('clearCustomerMobileBtn');
            if (mobInput) {
                mobInput.value = '';
                mobInput.disabled = false;
                mobInput.readOnly = false;
                mobInput.style.pointerEvents = 'auto';
            }
            if (clearBtn) clearBtn.style.display = 'none';
            if (box) { box.style.display = 'none'; box.innerHTML = ''; }
            if (svcBadge) {
                if (window.pendingSelectedService) {
                    svcBadge.innerHTML = `<i class="fa-solid fa-bullseye"></i> தேர்ந்தெடுக்கப்பட்ட சேவை: <b>${window.pendingSelectedService}</b>`;
                    svcBadge.style.display = 'block';
                } else {
                    svcBadge.style.display = 'none';
                }
            }
            const modal = document.getElementById('newCustomerModal');
            if (modal) modal.style.display = 'flex';
            if (typeof window.restoreDesktopKeyboardFocus === 'function') {
                window.restoreDesktopKeyboardFocus();
            } else {
                fetch('/api/desktop/window-action?action=focus').catch(() => {});
            }
            if (mobInput) {
                setTimeout(() => {
                    const el = document.getElementById('newCustomerMobileInput');
                    if (el) {
                        el.disabled = false;
                        el.readOnly = false;
                        el.focus();
                    }
                }, 60);
                setTimeout(() => {
                    const el = document.getElementById('newCustomerMobileInput');
                    if (el && document.activeElement !== el) {
                        el.focus();
                    }
                }, 200);
            }
        }

        function closeNewCustomerModal() {
            window.pendingSelectedService = null;
            document.getElementById('newCustomerModal').style.display = 'none';
            const box = document.getElementById('customerSuggestionsBox');
            if (box) { box.style.display = 'none'; box.innerHTML = ''; }
        }

        // Pure Fresh Mobile Entry: NEVER show old-customer suggestions or auto-restore popups while typing
        function handleNewCustomerMobileInput(rawVal) {
            const box = document.getElementById('customerSuggestionsBox');
            if (box) {
                box.style.display = 'none';
                box.innerHTML = '';
            }
        }

        document.addEventListener('click', function(e) {
            const wrap = document.getElementById('newCustomerInputWrap');
            const box = document.getElementById('customerSuggestionsBox');
            if (box && wrap && !wrap.contains(e.target) && !box.contains(e.target)) {
                box.style.display = 'none';
            }
        });


        function selectExistingCustomerSuggestion(mobile) {
            const mobInput = document.getElementById('newCustomerMobileInput');
            if (mobInput) mobInput.value = mobile;

            showCustomerLoading('புதிய சேவை அமர்வு தொடங்குகிறது...', `+91 ${mobile} தயாராகிறது`);

            startCustomerSessionFromModal();
        }

        // Option 1: Always start a 100% Pure Fresh service session bound to the 10-digit mobile number
        // (Zero auto-resume / zero old-draft pre-fill confusion; past docs remain safely in Drafts Desk Locker)
        async function startCustomerSessionFromModal() {
            const mobInput = document.getElementById('newCustomerMobileInput');
            let mob = (mobInput ? mobInput.value : '').trim().replace(/\D/g, '');
            if (mob.length > 10) mob = mob.slice(-10);

            if (mob.length !== 10) {
                if (typeof showInAppToast === 'function') showInAppToast('சரியான 10-இலக்க வாடிக்கையாளர் மொபைல் எண்ணை உள்ளிடவும்.', true);
                fetch('/api/desktop/window-action?action=focus').catch(() => {});
                if (mobInput) mobInput.focus();
                return;
            }

            const targetService = window.pendingSelectedService || null;

            closeNewCustomerModal();
            showCustomerLoading('புதிய சேவை அமர்வு தொடங்குகிறது...', `+91 ${mob} தயாராகிறது`);

            if (typeof clearCustomerDocCache === 'function') clearCustomerDocCache(mob);
            if (typeof resetSidebarDocsCache === 'function') resetSidebarDocsCache();
            currentCitizenData = null;
            window.currentCitizenData = null;
            window.lastSubService = null;
            window.lastSubServiceData = null;

            if (window.recordFlightEvent) {
                window.recordFlightEvent('SESSION_START', `Starting fresh customer session: +91 ${mob}`, { targetService });
            }

            const opUid = localStorage.getItem('eseva_operator_uid') || '';
            const opName = localStorage.getItem('eseva_operator_name') || '';
            const opMob = localStorage.getItem('eseva_operator_mobile') || '';

            try {
                const res = await fetch('/api/operator/new-customer', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        customerMobile: mob,
                        customerName: '',
                        serviceName: targetService,
                        operatorUid: opUid,
                        operatorName: opName,
                        operatorMobile: opMob
                    })
                });
                const data = await res.json();
                if (data.success) {
                    hideCustomerLoading();
                    localStorage.setItem('eseva_active_customer_mobile', mob);
                    localStorage.setItem('eseva_active_draft_id', data.draftId || mob);
                    const custName = (typeof resolveCustomerDisplayName === 'function') 
                        ? resolveCustomerDisplayName(data.citizenProfile, '')
                        : ((data.citizenProfile && (data.citizenProfile.fullNameTam || data.citizenProfile.fullNameEng)) || 'வாடிக்கையாளர்');
                    if (custName && custName !== 'வாடிக்கையாளர்') {
                        localStorage.setItem('eseva_active_customer_name', custName);
                    } else {
                        localStorage.removeItem('eseva_active_customer_name');
                    }

                    const rBanner = document.getElementById('resumeBanner');
                    if (rBanner) { rBanner.classList.remove('show'); rBanner.style.display = 'none'; }
                    const aBanner = document.getElementById('appNumberBanner');
                    if (aBanner) { aBanner.classList.remove('show'); aBanner.style.display = 'none'; }

                    switchTab('citizen');
                    if (typeof renderActiveCustomerHeader === 'function') {
                        renderActiveCustomerHeader(custName, mob);
                    } else {
                        const titleEl = document.getElementById('activeCustomerTitle');
                        if (titleEl) {
                            const nameDisplay = (custName && custName !== 'வாடிக்கையாளர்') ? `<b>${custName}</b> ` : '';
                            titleEl.innerHTML = `<i class="fa-solid fa-user-check" style="color: #16a34a; flex-shrink: 0;"></i> <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">வாடிக்கையாளர்: ${nameDisplay}(+91 ${mob})</span>`;
                        }
                    }
                    lastRenderedChatHistoryJson = '';
                    lastRenderedChatHistoryLength = 0;
                    if (data.chatHistory) renderMessages(data.chatHistory, true);
                    resetSidebarToOperatorView();
                    if (data.citizenProfile) {
                        data.citizenProfile.intakeState = data.step || 'SERVICE_SELECTION';
                        data.citizenProfile.step = data.step || 'SERVICE_SELECTION';
                    }
                    currentCitizenData = data.citizenProfile || {};
                    window.currentCitizenData = currentCitizenData;
                    updateSidebar({
                        citizenProfile: data.citizenProfile,
                        subService: data.subService || data.citizenProfile?.subService || null,
                        subServiceData: data.subServiceData || null,
                        documentsList: Array.isArray(data.documentsList) ? data.documentsList : [],
                        step: data.step || 'SERVICE_SELECTION'
                    });

                    if (window.pendingSelectedService) {
                        window.pendingSelectedService = null;
                    }
                } else {
                    if (typeof showInAppToast === 'function') showInAppToast('பிழை: ' + (data.error || 'வாடிக்கையாளர் அமர்வைத் தொடங்க முடியவில்லை'), true);
                }
            } catch (e) {
                if (typeof showInAppToast === 'function') showInAppToast('பிழை: ' + e.message, true);
            } finally {
                hideCustomerLoading();
            }
        }

        // RULE: Every application MUST start with the customer's real mobile number.
        // startDirectApplyService() now always opens the phone number modal first.
        // If a specific service is chosen (pill click), it is stored as pendingSelectedService
        // so startCustomerSessionFromModal() can route directly to that service after number entry.
        function startDirectApplyService(serviceName) {
            const isCategory = serviceName === 'ரேஷன் கார்டு' || 
                               serviceName === 'வருவாய்த் துறை' || 
                               serviceName === 'வருவாய்த் துறை சான்றிதழ்கள்' || 
                               serviceName === 'வருவாய் துறை' ||
                               serviceName === 'RATION_CARD_SERVICES' ||
                               serviceName === 'REVENUE_DEPARTMENT_SERVICES' ||
                               serviceName === 'MAIN_MENU';
            if (isCategory) {
                switchTab('citizen');
                if (typeof citizenStartService === 'function') {
                    citizenStartService(serviceName);
                } else if (typeof sendTextMessage === 'function') {
                    sendTextMessage(serviceName);
                }
                return;
            }
            // Store which service was chosen (or null for generic SERVICE_SELECTION)
            window.pendingSelectedService = serviceName || null;
            // Open the phone number modal so intake is bound directly to the chosen subservice
            openNewCustomerModal();
        }


        async function backToOperatorDashboard() {
            const activeCustMob = localStorage.getItem('eseva_active_customer_mobile') || '';
            const isWalkin = activeCustMob.startsWith('walkin_');
            const hasData = currentCitizenData && (
                (currentCitizenData.fullNameTam && currentCitizenData.fullNameTam.trim()) ||
                (currentCitizenData.fullNameEng && currentCitizenData.fullNameEng.trim()) ||
                (currentCitizenData.headAadhaar && currentCitizenData.headAadhaar.trim()) ||
                (currentCitizenData.mobileNumber && /^[6-9]\d{9}$/.test(currentCitizenData.mobileNumber)) ||
                (currentCitizenData.members && currentCitizenData.members.length > 0)
            );

            if (isWalkin && !hasData) {
                // Silently purge empty walk-in session from server memory/drafts
                try {
                    await fetch(`/api/drafts/${activeCustMob}`, { method: 'DELETE' });
                } catch (e) {}
                localStorage.removeItem('eseva_active_customer_mobile');
                localStorage.removeItem('eseva_active_draft_id');
                localStorage.removeItem('eseva_active_customer_name');
                currentCitizenData = null;
                lastRenderedChatHistoryJson = '';
                lastRenderedChatHistoryLength = 0;
                resetSidebarToOperatorView();
                const titleEl = document.getElementById('activeCustomerTitle');
                if (titleEl) {
                    titleEl.innerHTML = `<i class="fa-solid fa-robot"></i> eSevaDraft ஏஐ உரையாடல் மையம்`;
                }
                if (typeof renderDefaultWelcomeMessage === 'function') {
                    renderDefaultWelcomeMessage();
                }
            } else if (activeCustMob) {
                // Non-destructive navigation: silently save active customer draft & KEEP customer active
                // so returning Home NEVER clears the operator's in-progress work!
                try {
                    await saveCurrentDraftManually({ silent: true });
                } catch (e) {}
            }

            switchTab('operator');
            fetchOperatorDrafts();
        }


        function resetSidebarToOperatorView(operatorName) {
            const opCard = document.getElementById('sidebarOperatorDeskCard');
            const custBox = document.getElementById('sidebarCustomerDetailsBox');
            if (opCard) opCard.style.display = 'flex';
            if (custBox) custBox.style.display = 'none';

            const sidebarTitle = document.getElementById('sidebarTitleText');
            if (sidebarTitle) sidebarTitle.innerText = '🏪 இ-சேவை மையம் மேசை';

            const opNameDisplay = document.getElementById('sidebarOperatorNameDisplay');
            if (opNameDisplay) {
                opNameDisplay.innerText = localStorage.getItem('eseva_operator_name') || operatorName || 'குமரன் இ-சேவை மையம்';
            }

            const statusBox = document.getElementById('sidebarAppStatusBox');
            if (statusBox) statusBox.style.display = 'none';

            setVal('infoHeadName', '—');
            setVal('infoHeadFather', '—');
            setVal('infoHeadDob', '—');
            setVal('infoHeadGender', '—');
            setVal('infoHeadAadhaar', '—');
            setVal('infoHeadMobile', '—');
            setVal('infoAddress', '—');
            setVal('infoPin', '—');
            setVal('infoAreaRegion', '—');
            setVal('infoResidenceProof', '—');
            setVal('infoCardType', '—');
            setVal('infoGasCompany', '—');
            setVal('infoGasNo', '—');
            setVal('infoGasAgency', '—');
            setVal('infoGasCyl', '—');

            const membersContainer = document.getElementById('membersSidebarContainer');
            if (membersContainer) membersContainer.innerHTML = '';
            
            const docsList = document.getElementById('sidebarDocsList');
            if (docsList) docsList.innerHTML = '<div style="font-size: 11px; color: #94a3b8; padding: 2px 0;">வாடிக்கையாளர் தேர்ந்தெடுக்கப்படவில்லை.</div>';
            const docsCount = document.getElementById('sidebarDocsCount');
            if (docsCount) docsCount.innerText = '0';

            const clearHeader = document.getElementById('btnClearScreenHeader') || document.getElementById('btnDeleteDraftHeader');
            if (clearHeader) clearHeader.style.display = 'none';
            const clearSidebar = document.getElementById('btnClearScreenSidebar') || document.getElementById('btnDeleteDraftSidebar');
            if (clearSidebar) clearSidebar.style.display = 'none';
            const stopHeader = document.getElementById('btnStopAutomationHeader');
            if (stopHeader) stopHeader.style.display = 'none';

            const addrBox = document.getElementById('sidebarAddressBox');
            if (addrBox) addrBox.style.display = 'none';
            const gasBox = document.getElementById('gasSidebarBox');
            if (gasBox) gasBox.style.display = 'none';
            const docsBox = document.getElementById('sidebarDocumentsBox');
            if (docsBox) docsBox.style.display = 'none';
            const incomeBox = document.getElementById('sidebarIncomeBox');
            if (incomeBox) incomeBox.style.display = 'none';
            const removeBox = document.getElementById('sidebarRemoveMemberBox');
            if (removeBox) removeBox.style.display = 'none';
            const promptBox = document.getElementById('sidebarServiceSelectionPromptBox');
            if (promptBox) promptBox.style.display = 'none';

            if (typeof resetSidebarDocsCache === 'function') resetSidebarDocsCache();
            currentCitizenData = null;
        }

        function notifySaveStatus(msg, type = 'success') {
            if (typeof window.showEsevaToast === 'function') {
                window.showEsevaToast(msg, type);
            } else if (typeof showEsevaToast === 'function') {
                showEsevaToast(msg, type);
            } else {
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
                t.style.background = type === 'success' ? '#166534' : '#991b1b';
                t.style.color = '#ffffff';
                t.innerHTML = `<i class="${type === 'success' ? 'fa-solid fa-circle-check' : 'fa-solid fa-triangle-exclamation'}"></i> ${msg}`;
                t.style.display = 'flex';
                t.style.opacity = '1';
                t.style.transform = 'translateY(0)';
                setTimeout(() => {
                    if (t) {
                        t.style.opacity = '0';
                        t.style.transform = 'translateY(12px)';
                        setTimeout(() => { if (t) t.style.display = 'none'; }, 300);
                    }
                }, 2200);
            }
        }

        async function saveCurrentDraftManually(options = {}) {
            const isSilent = options && options.silent === true;
            const activeCustMob = localStorage.getItem('eseva_active_customer_mobile') || (currentCitizenData && currentCitizenData.mobileNumber) || '';
            const opUid = localStorage.getItem('eseva_operator_uid') || '';
            const opName = localStorage.getItem('eseva_operator_name') || '';
            const opMob = localStorage.getItem('eseva_operator_mobile') || '';

            const btn = document.getElementById('btnSidebarSave');
            const origHtml = '<i class="fa-solid fa-floppy-disk"></i> சேமி (Save)';
            const origBg = '#059669';

            if (!activeCustMob) {
                if (!isSilent) {
                    notifySaveStatus('⚠️ செயலில் உள்ள வாடிக்கையாளர் எண் இல்லை!', 'error');
                }
                return;
            }

            // Gating: Do not save empty walkin session with no data
            if (activeCustMob.startsWith('walkin_')) {
                const hasData = currentCitizenData && (
                    (currentCitizenData.fullNameTam && currentCitizenData.fullNameTam.trim()) ||
                    (currentCitizenData.fullNameEng && currentCitizenData.fullNameEng.trim()) ||
                    (currentCitizenData.headAadhaar && currentCitizenData.headAadhaar.trim()) ||
                    (currentCitizenData.mobileNumber && /^[6-9]\d{9}$/.test(currentCitizenData.mobileNumber)) ||
                    (currentCitizenData.members && currentCitizenData.members.length > 0)
                );
                if (!hasData) {
                    if (!isSilent) {
                        notifySaveStatus('⚠️ வெற்று வரைவைச் சேமிக்க முடியாது!', 'error');
                    }
                    return;
                }
            }

            // 1. Immediate Visual Feedback (Spinner & Saving...)
            if (btn && !isSilent) {
                btn.disabled = true;
                btn.style.transition = 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
                btn.style.background = '#047857';
                btn.style.transform = 'scale(0.97)';
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>சேமிக்கிறது...</span>';
            }

            const activeDraftId = localStorage.getItem('eseva_active_draft_id') || '';
            try {
                const res = await fetch('/api/drafts/save', { 
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'x-operator-uid': opUid,
                        'x-session-mobile': activeCustMob,
                        ...(activeDraftId ? { 'x-draft-id': activeDraftId } : {})
                    },
                    body: JSON.stringify({
                        draftId: activeDraftId || undefined,
                        mobileNumber: activeCustMob,
                        operatorUid: opUid,
                        operatorName: opName,
                        operatorMobile: opMob,
                        citizenProfile: currentCitizenData || {}
                    })
                });
                const data = await res.json();
                if (data.success) {
                    if (data.draftId) {
                        localStorage.setItem('eseva_active_draft_id', data.draftId);
                    }
                    if (data.citizenProfile) {
                        currentCitizenData = data.citizenProfile;
                    }
                    if (typeof fetchOperatorDrafts === 'function') {
                        fetchOperatorDrafts();
                    }

                    // 2. High-Vibrancy Success Animation (Green pulse + Checkmark + Glow)
                    if (btn && !isSilent) {
                        btn.style.background = '#10b981'; // Emerald 500
                        btn.style.transform = 'scale(1.05)';
                        btn.style.boxShadow = '0 0 16px rgba(16, 185, 129, 0.6)';
                        btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> <span>சேமிக்கப்பட்டது! ✅</span>';
                        setTimeout(() => {
                            if (btn) btn.style.transform = 'scale(1)';
                        }, 180);
                    }

                    // 3. Sleek Toast Alert
                    if (!isSilent) {
                        notifySaveStatus('✅ வாடிக்கையாளர் விவரங்கள் மற்றும் ஆவணங்கள் பத்திரமாகச் சேமிக்கப்பட்டன!', 'success');
                    }

                    // 4. Smooth Reset back to idle state after 2 seconds
                    if (btn && !isSilent) {
                        setTimeout(() => {
                            if (btn) {
                                btn.disabled = false;
                                btn.style.background = origBg;
                                btn.style.boxShadow = '0 1px 3px rgba(5,150,105,0.25)';
                                btn.style.transform = 'scale(1)';
                                btn.innerHTML = origHtml;
                            }
                        }, 2000);
                    }
                } else {
                    throw new Error(data.error || 'சேமிக்க முடியவில்லை');
                }
            } catch (e) {
                if (btn && !isSilent) {
                    btn.style.background = '#dc2626';
                    btn.style.transform = 'scale(1)';
                    btn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> <span>பிழை!</span>';
                    setTimeout(() => {
                        if (btn) {
                            btn.disabled = false;
                            btn.style.background = origBg;
                            btn.innerHTML = origHtml;
                        }
                    }, 2200);
                }
                if (!isSilent) {
                    notifySaveStatus('❌ பிழை: ' + (e.message || 'சேமிக்க முடியவில்லை'), 'error');
                }
            }
        }
        window.saveCurrentDraftManually = saveCurrentDraftManually;
        const chatMessages = document.getElementById('chatMessages');
        const userInput = document.getElementById('userInput');
        const authScreen = document.getElementById('authScreen');
        const viewportWrapper = document.getElementById('viewportWrapper');
        const viewToggleBtn = document.getElementById('viewToggleBtn');
        let currentCitizenData = null;
        let isMobileMockup = false;

        function toggleMobileMockupMode() {
            isMobileMockup = !isMobileMockup;
            if (isMobileMockup) {
                viewportWrapper.classList.add('mobile-mockup-mode');
                viewportWrapper.classList.add('mobile-view-active');
                viewToggleBtn.innerHTML = '<i class="fa-solid fa-desktop"></i> <span>டெஸ்க்டாப் பார்வை</span>';
            } else {
                viewportWrapper.classList.remove('mobile-mockup-mode');
                viewportWrapper.classList.remove('mobile-view-active');
                viewToggleBtn.innerHTML = '<i class="fa-solid fa-mobile-screen"></i> <span>மொபைல் பார்வை</span>';
            }
        }

        function isRunningInDesktopApp() {
            if (window.esevaDesktopBridge && window.esevaDesktopBridge.isDesktopApp) return true;
            const ua = (navigator.userAgent || '').toLowerCase();
            if (ua.includes('electron') || ua.includes('esevadraft') || ua.includes('esevadraft desktop')) return true;
            if (typeof window.process === 'object' && window.process && window.process.versions && window.process.versions.electron) return true;
            return false;
        }

        function toggleLoginRoleSelection(role) {
            const lblCitizen = document.getElementById('lblLoginRoleCitizen');
            const lblOp = document.getElementById('lblLoginRoleOperator');
            if (role === 'citizen') {
                if (lblCitizen) {
                    lblCitizen.style.borderColor = 'var(--primary)';
                    lblCitizen.style.background = '#ecfdf5';
                    lblCitizen.style.fontWeight = '700';
                }
                if (lblOp) {
                    lblOp.style.borderColor = '#cbd5e1';
                    lblOp.style.background = '#f8fafc';
                    lblOp.style.fontWeight = '600';
                }
                localStorage.setItem('eseva_user_role', 'citizen');
            } else {
                if (lblOp) {
                    lblOp.style.borderColor = 'var(--primary)';
                    lblOp.style.background = '#ecfdf5';
                    lblOp.style.fontWeight = '700';
                }
                if (lblCitizen) {
                    lblCitizen.style.borderColor = '#cbd5e1';
                    lblCitizen.style.background = '#f8fafc';
                    lblCitizen.style.fontWeight = '600';
                }
                localStorage.setItem('eseva_user_role', 'operator');
            }
        }

        let currentCitizenSubTab = 'services';
