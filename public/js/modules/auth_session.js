// eSevaDraft Domain Module: auth_session.js

        async function checkSession() {
            try {
                const opUid = localStorage.getItem('eseva_operator_uid') || '';
                const userRole = localStorage.getItem('eseva_user_role') || '';
                const activeCustMobile = localStorage.getItem('eseva_active_customer_mobile') || '';
                const citizenMobile = localStorage.getItem('eseva_user_mobile') || '';
                
                // 1. Operators: Instant UI boot when cached operator UID exists; Firebase onAuthStateChanged verifies in background.
                if (userRole === 'operator' || opUid) {
                    if (opUid) {
                        const dispName = localStorage.getItem('eseva_operator_name') || localStorage.getItem('eseva_user_name') || 'குமரன் இ-சேவை மையம்';
                        const screen = document.getElementById('authScreen');
                        if (screen) screen.style.display = 'none';
                        const badge = document.getElementById('authProfileBadge');
                        const nameEl = document.getElementById('authProfileName');
                        if (badge) {
                            if (nameEl) nameEl.innerText = dispName;
                            badge.setAttribute('data-tooltip', `${dispName} (சுயவிவரம்)`);
                            badge.setAttribute('title', `${dispName} (சுயவிவரம்)`);
                            badge.style.display = 'inline-flex';
                        }
                        localStorage.removeItem('eseva_active_customer_mobile');
                        localStorage.removeItem('eseva_active_customer_name');
                        applyRoleUi('operator', dispName);
                        resetSidebarToOperatorView(dispName);
                        renderDefaultWelcomeMessage();
                        switchTab('citizen');
                        fetchOperatorDrafts();
                        window._instantOperatorBootDone = true;
                    }
                    console.log('Operator session detected. Awaiting Firebase Auth state verification...');
                    return;
                }

                // 2. Anonymous visitor without stored credentials: KEEP AUTH SCREEN VISIBLE!
                // NEVER auto-login or switch to citizen mode!
                if (!citizenMobile && !activeCustMobile) {
                    console.log('No stored session credentials found. Displaying sign-in screen.');
                    const screen = document.getElementById('authScreen');
                    if (screen) screen.style.display = 'flex';
                    if (typeof updateHeaderNavigationState === 'function') updateHeaderNavigationState('auth');
                    return;
                }

                const targetMobile = activeCustMobile || citizenMobile;
                const res = await fetch(`/api/auth/session?mobile=${encodeURIComponent(targetMobile)}`, {
                    headers: {
                        'x-operator-uid': opUid,
                        'x-session-mobile': targetMobile
                    }
                });
                const data = await res.json();
                if (data.isLoggedIn && data.role === 'citizen') {
                    const screen = document.getElementById('authScreen');
                    if (screen) screen.style.display = 'none';
                    const name = data.displayName || localStorage.getItem('eseva_user_name') || 'பொதுமக்கள்';
                    applyRoleUi('citizen', name);
                    if (data.resumedSession) {
                        const rBanner = document.getElementById('resumeBanner');
                        if (rBanner) rBanner.classList.add('show');
                    }
                    if (data.chatHistory && data.chatHistory.length > 0) {
                        renderMessages(data.chatHistory, true);
                    } else if (!chatMessages || chatMessages.children.length === 0) {
                        renderDefaultWelcomeMessage();
                    }
                    fetchHistory();
                } else {
                    const screen = document.getElementById('authScreen');
                    if (screen) screen.style.display = 'flex';
                }
            } catch (e) {
                console.error('Check session failed:', e);
                const screen = document.getElementById('authScreen');
                if (screen) screen.style.display = 'flex';
            }
        }

        function dismissResumeBanner() {
            const rBanner = document.getElementById('resumeBanner');
            if (rBanner) rBanner.classList.remove('show');
        }

        function switchAuthTab(tab) {
            const loginForm = document.getElementById('authFormLogin');
            const signupForm = document.getElementById('authFormSignup');
            const btnLogin = document.getElementById('tabBtnLogin');
            const btnSignup = document.getElementById('tabBtnSignup');
            hideAuthError();

            [btnLogin, btnSignup].forEach(b => {
                if (b) {
                    b.style.background = 'transparent';
                    b.style.color = '#64748b';
                    b.style.boxShadow = 'none';
                    b.style.fontWeight = '600';
                }
            });

            if (tab === 'login') {
                loginForm.style.display = 'block';
                signupForm.style.display = 'none';
                btnLogin.style.background = 'white';
                btnLogin.style.color = 'var(--primary)';
                btnLogin.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
                btnLogin.style.fontWeight = '700';
            } else if (tab === 'signup') {
                loginForm.style.display = 'none';
                signupForm.style.display = 'block';
                btnSignup.style.background = 'white';
                btnSignup.style.color = 'var(--primary)';
                btnSignup.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
                btnSignup.style.fontWeight = '700';
            }
        }

        function toggleRoleSelection(role) {
            const lblCitizen = document.getElementById('lblRoleCitizen');
            const lblOperator = document.getElementById('lblRoleOperator');
            const nameLabel = document.getElementById('signupNameLabel');
            const nameInput = document.getElementById('signupName');

            if (role === 'operator') {
                if (lblOperator) { lblOperator.style.borderColor = 'var(--primary)'; lblOperator.style.background = '#f0fdf4'; }
                if (lblCitizen) { lblCitizen.style.borderColor = '#cbd5e1'; lblCitizen.style.background = '#f8fafc'; }
                if (nameLabel) nameLabel.innerText = 'மையம் / உரிமையாளர் பெயர்:';
                if (nameInput) nameInput.placeholder = 'எ.கா: குமார் இ-சேவை மையம்';
            } else {
                if (lblCitizen) { lblCitizen.style.borderColor = 'var(--primary)'; lblCitizen.style.background = '#f0fdf4'; }
                if (lblOperator) { lblOperator.style.borderColor = '#cbd5e1'; lblOperator.style.background = '#f8fafc'; }
                if (nameLabel) nameLabel.innerText = 'உங்கள் முழுப் பெயர்:';
                if (nameInput) nameInput.placeholder = 'எ.கா: குமார்';
            }
        }


        function togglePasswordVisibility(inputId, btn) {
            const input = document.getElementById(inputId);
            if (!input) return;
            const icon = btn.querySelector('i');
            if (input.type === 'password') {
                input.type = 'text';
                if (icon) {
                    icon.classList.remove('fa-eye');
                    icon.classList.add('fa-eye-slash');
                }
                btn.setAttribute('title', 'கடவுச்சொல்லை மறைக்க');
            } else {
                input.type = 'password';
                if (icon) {
                    icon.classList.remove('fa-eye-slash');
                    icon.classList.add('fa-eye');
                }
                btn.setAttribute('title', 'கடவுச்சொல்லைக் காட்ட');
            }
        }

        function showAuthError(msg) {
            const err = document.getElementById('authErrorMsg');
            if (err) {
                err.innerText = '⚠️ ' + msg;
                err.style.display = 'block';
            }
        }

        function hideAuthError() {
            const err = document.getElementById('authErrorMsg');
            if (err) err.style.display = 'none';
        }

        async function handleFirebaseLogin() {
            hideAuthError();
            const rawInput = document.getElementById('loginIdentifier')?.value.trim();
            const password = document.getElementById('loginPassword')?.value;
            if (!rawInput || !password) {
                showAuthError('கைபேசி எண் அல்லது மின்னஞ்சல் மற்றும் கடவுச்சொல்லை உள்ளிடவும்.');
                return;
            }

            let authEmail = rawInput;
            const cleanMobile = rawInput.replace(/\D/g, '');
            let detectedRole = null;
            let detectedName = null;

            if (!rawInput.includes('@')) {
                if (cleanMobile.length !== 10) {
                    showAuthError('சரியான 10-இலக்க மொபைல் எண்ணை உள்ளிடவும்.');
                    return;
                }
                authEmail = `${cleanMobile}@esevadraft.in`;

                // Smart Lookup: check if user registered with a custom email or previously created account
                try {
                    const lRes = await fetch(`/api/auth/lookup-mobile?mobile=${cleanMobile}`);
                    const lData = await lRes.json();
                    if (lData.found) {
                        if (lData.authEmail) authEmail = lData.authEmail;
                        if (lData.role) detectedRole = lData.role;
                        if (lData.displayName) detectedName = lData.displayName;
                    }
                } catch (e) {}
            }

            const btn = document.getElementById('btnLoginSubmit');
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> சரிபார்க்கிறது...';
            }
            try {
                if (!window.signInWithEmailAndPassword || !window.fbAuth) {
                    throw new Error('Firebase Auth தயாராகவில்லை. சிறிது நேரத்தில் மீண்டும் முயலவும்.');
                }

                let userCred;
                try {
                    userCred = await window.signInWithEmailAndPassword(window.fbAuth, authEmail, password);
                } catch (firstErr) {
                    if (firstErr.code === 'auth/user-not-found') {
                        try {
                            userCred = await window.createUserWithEmailAndPassword(window.fbAuth, authEmail, password);
                        } catch (createErr) {
                            throw firstErr;
                        }
                    } else {
                        throw firstErr;
                    }
                }

                console.log('Firebase login success:', userCred.user.email);
                const user = userCred.user;
                const uid = user.uid;
                const email = user.email;
                const dispName = detectedName || user.displayName || localStorage.getItem('eseva_user_name') || 'மையம்';
                // Dedicated Operator Desk Login: role is always guaranteed to be 'operator'
                let chosenRole = 'operator';

                if (cleanMobile) {
                    localStorage.setItem('eseva_user_mobile', cleanMobile);
                    localStorage.setItem('eseva_operator_mobile', cleanMobile);
                }
                localStorage.setItem('eseva_user_role', chosenRole);

                // DIRECTLY COMPLETE AUTH SESSION AND TRANSITION UI!
                await completeAuthSession(cleanMobile, dispName, email, uid, chosenRole);

            } catch (e) {
                console.error('Login error:', e);
                let msg = e.message;
                if (e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password' || e.code === 'auth/user-not-found') {
                    msg = 'தவறான கைபேசி எண் அல்லது கடவுச்சொல்! சரியான கடவுச்சொல்லை உள்ளிடவும்.';
                } else if (e.code === 'auth/invalid-email') {
                    msg = 'மின்னஞ்சல் அல்லது கைபேசி எண் சரியான வடிவில் இல்லை.';
                }
                showAuthError(msg);
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i> உள்நுழைக (Sign In)';
                }
            }
        }


        async function handleFirebaseSignup() {
            hideAuthError();
            // Operator Portal: Every signup is an Operator signup
            const role = 'operator';
            const name = document.getElementById('signupName')?.value.trim();
            const mobile = document.getElementById('signupMobile')?.value.trim();
            const cleanMobile = (mobile || '').replace(/\D/g, '');
            const password = document.getElementById('signupPassword')?.value;
            const confirmPassword = document.getElementById('signupConfirmPassword')?.value;

            if (!name) return showAuthError('மையம் அல்லது உரிமையாளரின் பெயரை உள்ளிடவும்.');
            if (cleanMobile.length !== 10) return showAuthError('சரியான 10-இலக்க மொபைல் எண்ணை உள்ளிடவும்.');
            if (!password || password.length < 6) return showAuthError('ரகசியக் கடவுச்சொல் குறைந்தது 6 எழுத்துகள் இருக்க வேண்டும்.');
            if (password !== confirmPassword) return showAuthError('கடவுச்சொல் மற்றும் உறுதிப்படுத்தல் கடவுச்சொல் பொருந்தவில்லை.');

            const authEmail = `${cleanMobile}@esevadraft.in`;

            const btn = document.getElementById('btnSignupSubmit');
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> மையம் பதிவு செய்கிறது...';
            }

            try {
                if (!window.createUserWithEmailAndPassword || !window.fbAuth) {
                    throw new Error('Firebase Auth தயாராகவில்லை. சிறிது நேரத்தில் மீண்டும் முயலவும்.');
                }
                localStorage.setItem('eseva_user_mobile', cleanMobile);
                localStorage.setItem('eseva_user_name', name);
                localStorage.setItem('eseva_operator_name', name);
                localStorage.setItem('eseva_operator_mobile', cleanMobile);
                localStorage.setItem('eseva_user_role', 'operator');

                const userCred = await window.createUserWithEmailAndPassword(window.fbAuth, authEmail, password);
                console.log('Firebase operator signup success:', userCred.user.email);
                await completeAuthSession(cleanMobile, name, userCred.user.email, userCred.user.uid, 'operator');
            } catch (e) {
                console.error('Signup error:', e);
                let msg = e.message;
                if (e.code === 'auth/email-already-in-use') {
                    msg = 'இந்த கைபேசி எண்ணில் ஏற்கனவே ஒரு கணக்கு உள்ளது. தயவுசெய்து உள்நுழையவும் (Sign In).';
                } else if (e.code === 'auth/weak-password') {
                    msg = 'கடவுச்சொல் மிகவும் எளிதாக உள்ளது. வலுவான கடவுச்சொல்லை உள்ளிடவும்.';
                }
                showAuthError(msg);
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fa-solid fa-store"></i> புதிய மையம் பதிவு செய் (Register Operator)';
                }
            }
        }

        async function handleFirebaseGoogleLogin() {
            hideAuthError();
            try {
                if (!window.signInWithPopup || !window.fbAuth || !window.GoogleAuthProvider) {
                    throw new Error('Firebase Auth தயாராகவில்லை.');
                }
                const provider = new window.GoogleAuthProvider();
                const result = await window.signInWithPopup(window.fbAuth, provider);
                const user = result.user;
                const mobile = user.phoneNumber ? user.phoneNumber.replace(/\D/g, '').slice(-10) : '';
                await completeAuthSession(mobile || '9876543210', user.displayName || 'Google பயனர்', user.email, user.uid);
            } catch (e) {
                console.error('Google login error:', e);
                showAuthError(e.message || 'Google உள்நுழைவில் பிழை ஏற்பட்டது.');
            }
        }

        async function handleForgotPassword() {
            const rawInput = prompt('உங்கள் 10-இலக்க மொபைல் எண் அல்லது மின்னஞ்சலை உள்ளிடவும்:');
            if (!rawInput) return;
            let email = rawInput.trim();
            if (!email.includes('@')) {
                const clean = email.replace(/\D/g, '');
                if (clean.length === 10) email = `${clean}@esevadraft.in`;
            }
            try {
                if (!window.sendPasswordResetEmail || !window.fbAuth) throw new Error('Firebase Auth தயாராகவில்லை.');
                await window.sendPasswordResetEmail(window.fbAuth, email);
                alert('✅ கடவுச்சொல் மீட்டமைக்கும் இணைப்பு அனுப்பப்பட்டது. இன்பாக்ஸைச் சரிபார்க்கவும்.');
            } catch (e) {
                alert('பிழை: ' + e.message);
            }
        }

        async function completeAuthSession(mobileNumber, displayName, email, uid, overrideRole) {
            try {
                let roleToSubmit = overrideRole || localStorage.getItem('eseva_user_role');
                if (!roleToSubmit) {
                    roleToSubmit = (localStorage.getItem('eseva_operator_uid') || uid || isRunningInDesktopApp()) ? 'operator' : 'citizen';
                }
                localStorage.setItem('eseva_user_role', roleToSubmit);

                if (roleToSubmit === 'citizen') {
                    if (!uid && !localStorage.getItem('eseva_operator_uid')) {
                        localStorage.removeItem('eseva_operator_uid');
                        localStorage.removeItem('eseva_operator_name');
                        localStorage.removeItem('eseva_operator_mobile');
                    }
                    localStorage.removeItem('eseva_active_customer_mobile');
                    localStorage.removeItem('eseva_active_customer_name');
                    if (mobileNumber) localStorage.setItem('eseva_user_mobile', mobileNumber);
                    if (displayName && displayName !== 'மையம்' && displayName !== 'குமரன் இ-சேவை மையம்') {
                        localStorage.setItem('eseva_user_name', displayName);
                    } else {
                        localStorage.setItem('eseva_user_name', 'விண்ணப்பதாரர்');
                    }
                } else {
                    if (uid) localStorage.setItem('eseva_operator_uid', uid);
                    if (displayName) localStorage.setItem('eseva_operator_name', displayName);
                    if (mobileNumber) localStorage.setItem('eseva_operator_mobile', mobileNumber);
                }

                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'x-operator-uid': uid || '',
                        'x-session-mobile': mobileNumber || ''
                    },
                    body: JSON.stringify({ 
                        mobileNumber: mobileNumber || '9876543210',
                        displayName: displayName || 'பயனர்',
                        email: email || null,
                        firebaseUid: uid || null,
                        operatorUid: uid || null,
                        role: roleToSubmit
                    })
                });
                const data = await res.json();
                if (data.success) {
                    const screen = document.getElementById('authScreen');
                    if (screen) screen.style.display = 'none';
                    const actualRole = data.role || roleToSubmit || 'citizen';
                    localStorage.setItem('eseva_user_role', actualRole);
                    const finalName = data.displayName || displayName || 'பயனர்';
                    applyRoleUi(actualRole, finalName);

                    if (actualRole === 'operator') {
                        if (!window._instantOperatorBootDone || !localStorage.getItem('eseva_active_customer_mobile')) {
                            localStorage.removeItem('eseva_active_customer_mobile');
                            localStorage.removeItem('eseva_active_customer_name');
                            resetSidebarToOperatorView(finalName);
                            if (data.chatHistory && data.chatHistory.length > 0) {
                                renderMessages(data.chatHistory, true);
                            } else {
                                renderDefaultWelcomeMessage();
                            }
                            switchTab('citizen');
                        }
                        fetchOperatorDrafts();
                    } else {
                        if (data.resumedSession) {
                            const rBanner = document.getElementById('resumeBanner');
                            if (rBanner) rBanner.classList.add('show');
                        } else {
                            const rBanner = document.getElementById('resumeBanner');
                            if (rBanner) rBanner.classList.remove('show');
                        }
                        if (data.chatHistory && data.chatHistory.length > 0) {
                            renderMessages(data.chatHistory, true);
                        } else {
                            renderDefaultWelcomeMessage();
                        }
                        if (data.citizenProfile) updateSidebar(data);
                        updateCitizenServicesDraftCard();
                    }
                } else {
                    showAuthError(data.error || 'உள்நுழைவில் பிழை');
                }
            } catch (e) {
                showAuthError('சர்வர் இணைப்புப் பிழை: ' + e.message);
            }
        }


        async function logoutUser() {
            try {
                if (window.fbAuth && window.fbSignOut) {
                    await window.fbSignOut(window.fbAuth);
                }
                await fetch('/api/auth/logout', { method: 'POST' });
            } catch (e) {}
            localStorage.clear();
            sessionStorage.clear();

            const desktopNavbar = document.querySelector('.navbar');
            if (desktopNavbar) desktopNavbar.style.display = 'flex';
            const citizenPanel = document.getElementById('panel-citizen');
            if (citizenPanel) citizenPanel.classList.remove('citizen-mode');
            const mHeader = document.getElementById('citizenMobileHeader');
            if (mHeader) mHeader.style.display = 'none';
            const bNav = document.getElementById('citizenBottomNav');
            if (bNav) bNav.style.display = 'none';

            // Deactivate all panels to prevent ghost view
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active-panel'));

            const badge = document.getElementById('authProfileBadge');
            if (badge) badge.style.display = 'none';
            const navTabs = document.getElementById('mainNavTabs');
            if (navTabs) navTabs.style.display = 'none';
            const btnNewCustomer = document.getElementById('btnNewCustomerNav');
            if (btnNewCustomer) btnNewCustomer.style.display = 'none';
            const btnLogout = document.getElementById('btnLogoutNav');
            if (btnLogout) btnLogout.style.display = 'none';
            const btnHome = document.getElementById('btnHeaderHome');
            if (btnHome) btnHome.style.display = 'none';
            const btnTools = document.getElementById('btnHeaderTools');
            if (btnTools) btnTools.style.display = 'none';
            const btnReset = document.getElementById('btnHeaderReset');
            if (btnReset) btnReset.style.display = 'none';
            const btnSave = document.getElementById('btnSaveDraftTop');
            if (btnSave) btnSave.style.display = 'none';
            const btnBack = document.getElementById('btnBackToOperator');
            if (btnBack) btnBack.style.display = 'none';

            const screen = document.getElementById('authScreen');
            if (screen) screen.style.display = 'flex';

            if (typeof updateHeaderNavigationState === 'function') {
                updateHeaderNavigationState('auth');
            }

            if (isRunningInDesktopApp()) {
                const radioOp = document.querySelector('input[name="loginRole"][value="operator"]');
                if (radioOp) radioOp.checked = true;
                toggleLoginRoleSelection('operator');
            }
        }

        function goToHomePage() {
            const modals = ['operatorDraftsModal', 'newCustomerModal', 'tnegaCanSearchModal', 'directApplyServiceModal'];
            modals.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });
            const isOp = localStorage.getItem('eseva_user_role') === 'operator';
            if (isOp) {
                switchTab('citizen');
                const chatArea = document.getElementById('chatInterfaceArea');
                if (chatArea) chatArea.style.display = 'flex';
                const sView = document.getElementById('citizenServicesView');
                if (sView) sView.style.display = 'none';

                const activeCust = (localStorage.getItem('eseva_active_customer_mobile') || '').replace(/\D/g, '').slice(-10);
                const draftList = window.allOperatorDrafts || (typeof allOperatorDrafts !== 'undefined' ? allOperatorDrafts : []);
                const draftExists = activeCust && Array.isArray(draftList) && draftList.some(d => (d.mobileNumber || '').replace(/\D/g, '').slice(-10) === activeCust);

                if (!activeCust || !draftExists) {
                    if (typeof clearAutomationScreenSession === 'function') {
                        clearAutomationScreenSession();
                    } else if (typeof resetIntakeChat === 'function') {
                        resetIntakeChat();
                    } else {
                        localStorage.removeItem('eseva_active_customer_mobile');
                        localStorage.removeItem('eseva_active_customer_name');
                        currentCitizenData = null;
                        lastRenderedChatHistoryJson = '';
                        lastRenderedChatHistoryLength = 0;
                        if (typeof resetSidebarToOperatorView === 'function') resetSidebarToOperatorView();
                        const titleEl = document.getElementById('activeCustomerTitle');
                        if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-robot"></i> eSevaDraft ஏஐ உரையாடல் மையம்`;
                        if (typeof renderDefaultWelcomeMessage === 'function') renderDefaultWelcomeMessage();
                    }
                }
            } else {
                switchTab('citizen');
                if (typeof citizenSwitchSubTab === 'function') {
                    citizenSwitchSubTab('services');
                }
            }
        }

        function switchTab(tabId) {
            document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active-panel'));
            
            const btn = Array.from(document.querySelectorAll('.nav-tab')).find(b => b.getAttribute('onclick') && b.getAttribute('onclick').includes(tabId));
            if (btn) btn.classList.add('active');
            
            const panel = document.getElementById(`panel-${tabId}`);
            if (panel) panel.classList.add('active-panel');

            if (window.recordFlightEvent) {
                window.recordFlightEvent('NAV', 'Switched tab to: ' + tabId, { tabId });
            }

            if (tabId === 'operator') {
                const backBtn = document.getElementById('btnBackToOperator');
                if (backBtn) backBtn.style.display = 'none';
                const saveBtn = document.getElementById('btnSaveDraftTop');
                if (saveBtn) saveBtn.style.display = 'none';

                const isOpAllowed = isRunningInDesktopApp() || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || localStorage.getItem('eseva_allow_web_desk') === 'true';
                const isOp = localStorage.getItem('eseva_user_role') === 'operator';
                const navTabs = document.getElementById('mainNavTabs');
                const webDlView = document.getElementById('operatorWebDownloadView');
                const workArea = document.getElementById('operatorDesktopWorkArea');

                if (isOp && !isOpAllowed) {
                    if (navTabs) navTabs.style.display = 'none';
                    if (webDlView) webDlView.style.display = 'block';
                    if (workArea) workArea.style.display = 'none';
                } else {
                    if (webDlView) webDlView.style.display = 'none';
                    if (workArea) workArea.style.display = 'block';
                    fetchOperatorDrafts();
                }
            } else if (tabId === 'citizen') {
                const isOp = localStorage.getItem('eseva_user_role') === 'operator';
                const activeCustMob = localStorage.getItem('eseva_active_customer_mobile');
                const backBtn = document.getElementById('btnBackToOperator');
                const saveBtn = document.getElementById('btnSaveDraftTop');
                const clearHeader = document.getElementById('btnClearScreenHeader') || document.getElementById('btnDeleteDraftHeader');
                const clearSidebar = document.getElementById('btnClearScreenSidebar') || document.getElementById('btnDeleteDraftSidebar');
                if (isOp) {
                    if (backBtn) backBtn.style.display = 'inline-flex';
                    if (saveBtn && activeCustMob) saveBtn.style.display = 'inline-flex';
                    if (clearHeader && activeCustMob) clearHeader.style.display = 'inline-flex';
                    if (clearSidebar && activeCustMob) clearSidebar.style.display = 'inline-flex';
                } else {
                    if (backBtn) backBtn.style.display = 'none';
                    if (saveBtn) saveBtn.style.display = 'none';
                    if (clearHeader) clearHeader.style.display = 'none';
                    if (clearSidebar) clearSidebar.style.display = 'none';
                }
                const noCustBanner = document.getElementById('noCustomerAlertBanner');
                if (isOp && !activeCustMob) {
                    resetSidebarToOperatorView();
                    if (noCustBanner) noCustBanner.style.display = 'flex';
                } else if (noCustBanner) {
                    noCustBanner.style.display = 'none';
                }
            }
            if (tabId === 'locker') fetchDocuments();
            if (tabId === 'admin') fetchAdminStats();
        }
