// eSevaDraft Domain Module: auth_session.js

        async function checkSession() {
            try {
                let opUid = localStorage.getItem('eseva_operator_uid') || '';
                let userRole = localStorage.getItem('eseva_user_role') || '';
                const activeCustMobile = localStorage.getItem('eseva_active_customer_mobile') || '';
                const citizenMobile = localStorage.getItem('eseva_user_mobile') || '';

                // 0. Desktop Disk Session Recovery: If localStorage lost operator UID (e.g. after close/restart or port switch),
                // check local server's persistent disk session (operator_auth_session.json) first!
                if (!opUid && !citizenMobile) {
                    try {
                        const diskRes = await fetch('/api/auth/session?role=operator');
                        const diskData = await diskRes.json();
                        if (diskData && diskData.isLoggedIn && diskData.operatorUid && (diskData.role === 'operator' || diskData.role === 'admin')) {
                            opUid = diskData.operatorUid;
                            userRole = 'operator';
                            localStorage.setItem('eseva_operator_uid', opUid);
                            localStorage.setItem('eseva_user_role', 'operator');
                            if (diskData.displayName) {
                                localStorage.setItem('eseva_operator_name', diskData.displayName);
                                localStorage.setItem('eseva_user_name', diskData.displayName);
                            }
                            if (diskData.mobileNumber && diskData.mobileNumber !== '9876543210') {
                                localStorage.setItem('eseva_operator_mobile', diskData.mobileNumber);
                                localStorage.setItem('eseva_user_mobile', diskData.mobileNumber);
                                localStorage.setItem('eseva_last_mobile', diskData.mobileNumber);
                            }
                            if (diskData.email) {
                                localStorage.setItem('eseva_auth_email', diskData.email);
                                localStorage.setItem('eseva_last_auth_email', diskData.email);
                            }
                        }
                    } catch (_) {}
                }
                
                // 1. Operators: Instant UI boot when cached operator UID exists; Firebase onAuthStateChanged verifies in background.
                if (userRole === 'operator' || opUid) {
                    if (opUid) {
                        let storedOpName = localStorage.getItem('eseva_operator_name') || localStorage.getItem('eseva_user_name') || '';
                        if (opUid !== 'z9TSOApH0Hh69Du0xPK2GDxK2kr2' && storedOpName === 'குமரன் இ-சேவை மையம்') {
                            storedOpName = (opUid === 'PlzEG1ptSyQMBe2QFjf8AUS7TJr2') ? 'SUMAN' : 'இ-சேவை மையம்';
                            localStorage.setItem('eseva_operator_name', storedOpName);
                        }
                        const dispName = storedOpName || (opUid === 'z9TSOApH0Hh69Du0xPK2GDxK2kr2' ? 'குமரன் இ-சேவை மையம்' : 'இ-சேவை மையம்');
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
            const rawInput = (document.getElementById('loginIdentifier')?.value || '').trim().replace(/[\u200B-\u200D\uFEFF]/g, '');
            const rawPassword = (document.getElementById('loginPassword')?.value || '').replace(/[\u200B-\u200D\uFEFF]/g, '');
            if (!rawInput || !rawPassword) {
                showAuthError('கைபேசி எண் அல்லது மின்னஞ்சல் மற்றும் கடவுச்சொல்லை உள்ளிடவும்.');
                return;
            }

            const isEmail = rawInput.includes('@');
            let cleanMobile = '';
            let primaryEmail = '';
            let altEmail = null;
            let detectedRole = null;
            let detectedName = null;
            let lookupFound = false;

            if (isEmail) {
                primaryEmail = rawInput.trim().toLowerCase().replace(/\s+/g, '');
            } else {
                const digitsOnly = rawInput.replace(/\D/g, '');
                if (digitsOnly.length >= 10) {
                    cleanMobile = digitsOnly.slice(-10);
                    primaryEmail = `${cleanMobile}@esevadraft.in`;

                    // Smart Lookup: check if user registered with a custom email or previously created account
                    try {
                        const lRes = await fetch(`/api/auth/lookup-mobile?mobile=${cleanMobile}`);
                        const lData = await lRes.json();
                        if (lData && lData.found) {
                            lookupFound = true;
                            if (lData.authEmail && lData.authEmail.trim().toLowerCase() !== primaryEmail) {
                                altEmail = lData.authEmail.trim().toLowerCase();
                            }
                            if (lData.role) detectedRole = lData.role;
                            if (lData.displayName) detectedName = lData.displayName;
                        }
                    } catch (e) {}
                } else {
                    // Alphanumeric username/centerName support (e.g. "kumaran", "SUMAN", "admin")
                    const cleanUser = rawInput.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
                    if (cleanUser && cleanUser.length >= 3) {
                        primaryEmail = `${cleanUser}@esevadraft.in`;
                        try {
                            const lRes = await fetch(`/api/auth/lookup-mobile?mobile=${encodeURIComponent(rawInput.trim())}`);
                            const lData = await lRes.json();
                            if (lData && lData.found) {
                                lookupFound = true;
                                if (lData.authEmail) primaryEmail = lData.authEmail.trim().toLowerCase();
                                if (lData.mobileNumber) cleanMobile = String(lData.mobileNumber).replace(/\D/g, '').slice(-10);
                                if (lData.role) detectedRole = lData.role;
                                if (lData.displayName) detectedName = lData.displayName;
                            }
                        } catch (_) {}
                    } else {
                        showAuthError('சரியான 10-இலக்க மொபைல் எண் அல்லது மின்னஞ்சலை உள்ளிடவும்.');
                        return;
                    }
                }
            }

            // Resilient Whitespace, Space & First-Letter Case Tolerance Engine:
            const trimmedPass = rawPassword.trim();
            const passwordCandidates = [];
            if (trimmedPass) passwordCandidates.push(trimmedPass);
            if (rawPassword && !passwordCandidates.includes(rawPassword)) passwordCandidates.push(rawPassword);
            if (trimmedPass && !passwordCandidates.includes(trimmedPass + ' ')) passwordCandidates.push(trimmedPass + ' ');
            if (trimmedPass && !passwordCandidates.includes(' ' + trimmedPass)) passwordCandidates.push(' ' + trimmedPass);
            const noSpacePass = rawPassword.replace(/\s+/g, '');
            if (noSpacePass && !passwordCandidates.includes(noSpacePass)) passwordCandidates.push(noSpacePass);
            if (trimmedPass && trimmedPass.length > 0) {
                const firstChar = trimmedPass.charAt(0);
                const toggledFirst = (firstChar === firstChar.toUpperCase() ? firstChar.toLowerCase() : firstChar.toUpperCase()) + trimmedPass.slice(1);
                if (!passwordCandidates.includes(toggledFirst)) passwordCandidates.push(toggledFirst);
            }

            const emailCandidates = [primaryEmail];
            if (cleanMobile) {
                const comEmail = `${cleanMobile}@esevadraft.com`;
                if (!emailCandidates.includes(comEmail)) emailCandidates.push(comEmail);
            }
            if (altEmail && !emailCandidates.includes(altEmail)) emailCandidates.push(altEmail);
            const savedLastEmail = localStorage.getItem('eseva_last_auth_email') || localStorage.getItem('eseva_auth_email');
            if (savedLastEmail && !emailCandidates.includes(savedLastEmail.toLowerCase().trim())) {
                emailCandidates.push(savedLastEmail.toLowerCase().trim());
            }

            const btn = document.getElementById('btnLoginSubmit');
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> சரிபார்க்கிறது...';
            }

            let userCred = null;
            let lastAuthErr = null;
            const fbApiKey = window.firebaseApiKey || 'AIzaSyDliMuHXhnuE_k8TGaQVOnSAU56WNW-beA';

            async function restSignInFallback(email, password) {
                const resp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${fbApiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password, returnSecureToken: true })
                });
                const json = await resp.json();
                if (resp.ok && json && json.localId) {
                    return {
                        user: {
                            uid: json.localId,
                            email: json.email || email,
                            displayName: json.displayName || null
                        }
                    };
                }
                const errMsg = json?.error?.message || 'INVALID_LOGIN_CREDENTIALS';
                const errObj = new Error(errMsg);
                if (errMsg.includes('TOO_MANY_ATTEMPTS')) errObj.code = 'auth/too-many-requests';
                else if (errMsg.includes('INVALID_EMAIL')) errObj.code = 'auth/invalid-email';
                else errObj.code = 'auth/invalid-credential';
                throw errObj;
            }

            try {
                for (const emailToTry of emailCandidates) {
                    for (const passToTry of passwordCandidates) {
                        try {
                            if (window.signInWithEmailAndPassword && window.fbAuth) {
                                userCred = await window.signInWithEmailAndPassword(window.fbAuth, emailToTry, passToTry);
                            } else {
                                userCred = await restSignInFallback(emailToTry, passToTry);
                            }
                            if (userCred && userCred.user) break;
                        } catch (err) {
                            // If modular SDK failed due to local IndexedDB/persistence lock, retry via direct HTTPS REST API
                            if (err.code !== 'auth/invalid-credential' && err.code !== 'auth/wrong-password' && err.code !== 'auth/user-not-found' && err.code !== 'auth/invalid-email' && err.code !== 'auth/too-many-requests') {
                                try {
                                    userCred = await restSignInFallback(emailToTry, passToTry);
                                    if (userCred && userCred.user) break;
                                } catch (restErr) {
                                    lastAuthErr = restErr;
                                }
                            } else {
                                lastAuthErr = err;
                            }
                            if (lastAuthErr && (lastAuthErr.code === 'auth/too-many-requests' || lastAuthErr.code === 'auth/network-request-failed')) {
                                throw lastAuthErr;
                            }
                        }
                    }
                    if (userCred && userCred.user) break;
                }

                // If account does not exist yet in Firebase Auth and operator typed a valid 10-digit mobile + password (>=6 chars),
                // attempt auto-provisioning; if account already exists in Firebase, it throws email-already-in-use so we know password was wrong.
                if ((!userCred || !userCred.user) && cleanMobile.length === 10 && trimmedPass.length >= 6 && !lookupFound) {
                    try {
                        if (window.createUserWithEmailAndPassword && window.fbAuth) {
                            userCred = await window.createUserWithEmailAndPassword(window.fbAuth, primaryEmail, trimmedPass);
                        } else {
                            const sResp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${fbApiKey}`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ email: primaryEmail, password: trimmedPass, returnSecureToken: true })
                            });
                            const sJson = await sResp.json();
                            if (sResp.ok && sJson && sJson.localId) {
                                userCred = { user: { uid: sJson.localId, email: sJson.email || primaryEmail, displayName: null } };
                            }
                        }
                    } catch (_) {
                        // Email already exists -> keep original invalid-credential error
                    }
                }

                if (!userCred || !userCred.user) {
                    if (lastAuthErr) throw lastAuthErr;
                    throw new Error('உள்நுழைவு தோல்வியடைந்தது. சரியான விவரங்களை உள்ளிடவும்.');
                }

                console.log('Firebase login success:', userCred.user.email);
                const user = userCred.user;
                const uid = user.uid;
                const email = user.email;
                const dispName = detectedName || user.displayName || localStorage.getItem('eseva_user_name') || 'மையம்';
                let chosenRole = 'operator';

                if (email) {
                    localStorage.setItem('eseva_last_auth_email', email);
                    localStorage.setItem('eseva_auth_email', email);
                }
                if (cleanMobile && cleanMobile !== '9876543210') {
                    localStorage.setItem('eseva_user_mobile', cleanMobile);
                    localStorage.setItem('eseva_operator_mobile', cleanMobile);
                    localStorage.setItem('eseva_last_mobile', cleanMobile);
                }
                localStorage.setItem('eseva_user_role', chosenRole);

                // DIRECTLY COMPLETE AUTH SESSION AND TRANSITION UI!
                await completeAuthSession(cleanMobile, dispName, email, uid, chosenRole);

            } catch (e) {
                console.error('Login error:', e);
                let msg = e.message;
                if (e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password' || e.code === 'auth/user-not-found') {
                    msg = 'தவறான கைபேசி எண் அல்லது கடவுச்சொல்! சரியான கடவுச்சொல்லை உள்ளிடவும்.';
                } else if (e.code === 'auth/too-many-requests') {
                    msg = 'தொடர்ச்சியாக தவறான கடவுச்சொல் உள்ளிடப்பட்டதால் கணக்கு தற்காலிகமாகப் பாதுகாக்கப்பட்டுள்ளது. 2 நிமிடங்கள் கழித்து மீண்டும் முயலவும் அல்லது "கடவுச்சொல் மறந்துவிட்டதா?" என்பதைப் பயன்படுத்தவும்.';
                } else if (e.code === 'auth/invalid-email') {
                    msg = 'மின்னஞ்சல் அல்லது கைபேசி எண் சரியான வடிவில் இல்லை.';
                } else if (e.code === 'auth/network-request-failed') {
                    msg = 'இணைய இணைப்பு துண்டிக்கப்பட்டுள்ளது. இணைய இணைப்பைச் சரிபார்க்கவும்.';
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
            const name = (document.getElementById('signupName')?.value || '').trim();
            const mobile = (document.getElementById('signupMobile')?.value || '').trim();
            const digitsOnly = mobile.replace(/\D/g, '');
            const cleanMobile = digitsOnly.length >= 10 ? digitsOnly.slice(-10) : digitsOnly;
            const password = (document.getElementById('signupPassword')?.value || '').trim();
            const confirmPassword = (document.getElementById('signupConfirmPassword')?.value || '').trim();

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
                localStorage.setItem('eseva_user_mobile', cleanMobile);
                localStorage.setItem('eseva_user_name', name);
                localStorage.setItem('eseva_operator_name', name);
                localStorage.setItem('eseva_operator_mobile', cleanMobile);
                localStorage.setItem('eseva_user_role', 'operator');

                let userCred = null;
                const fbApiKey = window.firebaseApiKey || 'AIzaSyDliMuHXhnuE_k8TGaQVOnSAU56WNW-beA';
                try {
                    if (window.createUserWithEmailAndPassword && window.fbAuth) {
                        userCred = await window.createUserWithEmailAndPassword(window.fbAuth, authEmail, password);
                    } else {
                        const sResp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${fbApiKey}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email: authEmail, password, returnSecureToken: true })
                        });
                        const sJson = await sResp.json();
                        if (sResp.ok && sJson && sJson.localId) {
                            userCred = { user: { uid: sJson.localId, email: sJson.email || authEmail } };
                        } else {
                            const errObj = new Error(sJson?.error?.message || 'SIGNUP_FAILED');
                            if (String(sJson?.error?.message || '').includes('EMAIL_EXISTS')) errObj.code = 'auth/email-already-in-use';
                            throw errObj;
                        }
                    }
                } catch (signupErr) {
                    if (signupErr.code === 'auth/email-already-in-use') {
                        // If operator already registered this number and entered the right password in signup, sign them in seamlessly!
                        try {
                            if (window.signInWithEmailAndPassword && window.fbAuth) {
                                userCred = await window.signInWithEmailAndPassword(window.fbAuth, authEmail, password);
                            }
                        } catch (_) {}
                        if (!userCred) throw signupErr;
                    } else {
                        throw signupErr;
                    }
                }
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
                const digitsOnly = email.replace(/\D/g, '');
                const clean = digitsOnly.length >= 10 ? digitsOnly.slice(-10) : digitsOnly;
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
                    if (actualRole === 'operator' && finalName) {
                        localStorage.setItem('eseva_operator_name', finalName);
                        const nameEl = document.getElementById('authProfileName');
                        const badge = document.getElementById('authProfileBadge');
                        if (nameEl) nameEl.innerText = finalName;
                        if (badge) {
                            badge.setAttribute('data-tooltip', `${finalName} (சுயவிவரம்)`);
                            badge.setAttribute('title', `${finalName} (சுயவிவரம்)`);
                        }
                    }
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
            let lastOpMobile = localStorage.getItem('eseva_last_mobile') || localStorage.getItem('eseva_operator_mobile') || localStorage.getItem('eseva_user_mobile') || '';
            if (lastOpMobile === '9876543210') lastOpMobile = '';
            const lastAuthEmail = localStorage.getItem('eseva_last_auth_email') || localStorage.getItem('eseva_auth_email') || '';
            try {
                if (window.fbAuth && window.fbSignOut) {
                    await window.fbSignOut(window.fbAuth);
                }
                await fetch('/api/auth/logout', { method: 'POST' });
            } catch (e) {}
            localStorage.clear();
            sessionStorage.clear();
            if (lastOpMobile) localStorage.setItem('eseva_last_mobile', lastOpMobile);
            if (lastAuthEmail) localStorage.setItem('eseva_last_auth_email', lastAuthEmail);
            hideAuthError();

            const passInput = document.getElementById('loginPassword');
            if (passInput) passInput.value = '';
            const idInput = document.getElementById('loginIdentifier');
            if (idInput && !idInput.value) {
                idInput.value = lastOpMobile || lastAuthEmail || '';
            }

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
