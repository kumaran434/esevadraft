        import { initializeApp } from "/vendor/firebase/firebase-app.js";
        import { 
            getAuth, 
            createUserWithEmailAndPassword, 
            signInWithEmailAndPassword, 
            signInWithPopup, 
            GoogleAuthProvider, 
            sendPasswordResetEmail, 
            onAuthStateChanged, 
            signOut 
        } from "/vendor/firebase/firebase-auth.js";

        const firebaseConfig = {
            projectId: "gen-lang-client-0792225149",
            appId: "1:1005276687942:web:e06ce50821b270078c2447",
            apiKey: "AIzaSyDliMuHXhnuE_k8TGaQVOnSAU56WNW-beA",
            authDomain: "gen-lang-client-0792225149.firebaseapp.com",
            storageBucket: "gen-lang-client-0792225149.firebasestorage.app",
            messagingSenderId: "1005276687942"
        };

        const fbApp = initializeApp(firebaseConfig);
        const fbAuth = getAuth(fbApp);
        window.fbAuth = fbAuth;
        window.GoogleAuthProvider = GoogleAuthProvider;
        window.signInWithPopup = signInWithPopup;
        window.signInWithEmailAndPassword = signInWithEmailAndPassword;
        window.createUserWithEmailAndPassword = createUserWithEmailAndPassword;
        window.sendPasswordResetEmail = sendPasswordResetEmail;
        window.fbSignOut = signOut;

        onAuthStateChanged(fbAuth, async (user) => {
            if (user) {
                console.log('Firebase user state active:', user.email || user.uid);

                // Authenticated Firebase users in eSevaDraft are operators unless specifically saved otherwise
                const role = localStorage.getItem('eseva_user_role') || 'operator';
                let mob = (role === 'operator' ? localStorage.getItem('eseva_operator_mobile') : localStorage.getItem('eseva_user_mobile'));
                if (!mob && user.email && user.email.includes('@esevadraft.in')) {
                    mob = user.email.split('@')[0];
                }
                if (!mob) mob = '9876543210';
                const dispName = (role === 'operator' ? localStorage.getItem('eseva_operator_name') : localStorage.getItem('eseva_user_name'))
                    || user.displayName 
                    || (role === 'operator' ? 'குமரன் இ-சேவை மையம்' : 'விண்ணப்பதாரர்');

                if (role === 'operator') {
                    localStorage.setItem('eseva_operator_uid', user.uid);
                    localStorage.setItem('eseva_operator_name', dispName);
                    localStorage.setItem('eseva_operator_mobile', mob);
                }
                localStorage.setItem('eseva_user_role', role);

                const badge = document.getElementById('authProfileBadge');
                const nameEl = document.getElementById('authProfileName');
                if (badge) {
                    if (nameEl) nameEl.innerText = dispName;
                    badge.setAttribute('data-tooltip', `${dispName} (சுயவிவரம்)`);
                    badge.setAttribute('title', `${dispName} (சுயவிவரம்)`);
                    badge.style.display = 'inline-flex';
                }

                // ⚡ INSTANT UI RENDER: Don't block screen on remote Google US API round-trip
                await completeAuthSession(mob, dispName, user.email, user.uid, role);

                // Background reload check (non-blocking)
                user.reload().catch(async (reloadErr) => {
                    console.warn('Firebase user reload check:', reloadErr.code || reloadErr.message);
                    if (reloadErr.code === 'auth/user-disabled' || reloadErr.code === 'auth/user-not-found') {
                        await logoutUser();
                    }
                });
            } else {
                console.log('Firebase user logged out / no session');
                const badge = document.getElementById('authProfileBadge');
                if (badge) badge.style.display = 'none';
                if (localStorage.getItem('eseva_operator_uid') || localStorage.getItem('eseva_user_role') === 'operator') {
                    await logoutUser();
                }
            }
        });

        // Periodic heartbeat: Verify Firebase user existence every 60s
        setInterval(async () => {
            if (window.fbAuth && window.fbAuth.currentUser) {
                try {
                    await window.fbAuth.currentUser.reload();
                } catch (e) {
                    if (e.code === 'auth/user-disabled' || e.code === 'auth/user-not-found') {
                        console.warn('Periodic auth verification detected user removal:', e.code);
                        await logoutUser();
                    }
                }
            }
        }, 60000);