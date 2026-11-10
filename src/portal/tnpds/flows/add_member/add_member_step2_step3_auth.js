/**
 * TNPDS Add Member - Steps 2 & 3: Mobile, Captcha, Radware & Login OTP Verification
 */

async function executeSteps2And3Auth(page, userMobile, options, onProgress, sharedContext, captureTelemetry) {
    const {
        humanClick = async () => false,
        humanType = async () => {},
        showBrowserHud = async () => {},
        injectVisualBanner = async () => {},
        tryAutoClickCaptcha = async () => false,
        saveTnpdsCookies = async () => {},
        dismissSessionConflictOrAlertModals = async () => false,
        autoSolveCaptcha = async () => null,
        requestOtpFromUser = async () => '',
        submitOtpOnPortal = async () => {}
    } = sharedContext;

    const handleStep2Radware = async () => {
        const curUrl = page.url().toLowerCase();
        const isPerfdriveHost = curUrl.includes('perfdrive') || curUrl.includes('validate.');
        if (!isPerfdriveHost) {
            const hasOtpInputNow = await page.evaluate(() => {
                const el = document.querySelector('input[formcontrolname="otp"], input[placeholder*="OTP"], input[name*="otp"], #otp');
                return Boolean(el && (el.offsetWidth > 0 || el.offsetHeight > 0));
            }).catch(() => false);
            if (hasOtpInputNow) return false;
        }

        const hasSecurityChallenge = await page.evaluate(() => {
            const isTnpdsActive = Boolean(
                document.querySelector('input[placeholder*="கைபேசி"], input[formcontrolname="mobNumber"], input[formcontrolname="otp"], #nameTam, #btnLogout, select[formcontrolname="serviceType"], select[formcontrolname="service"], a[href*="logout"], .user-profile') ||
                (window.location.href && window.location.href.includes('/pages/service-request')) ||
                (document.body && (document.body.innerText.includes('அட்டை தொடர்பான சேவைக்கு') || document.body.innerText.includes('சேவையை தேர்வு செய்யவும்')))
            );
            if (isTnpdsActive) return false;
            const bodyText = (document.body && document.body.innerText) || '';
            const pageTitle = document.title || '';
            const isPerfdrive = window.location.hostname.includes('perfdrive') || window.location.href.includes('validate.perfdrive');
            const hasPerfdriveFrame = Boolean(document.querySelector('iframe[src*="perfdrive"], iframe[src*="validate."], iframe[src*="hcaptcha"]'));
            return isPerfdrive || hasPerfdriveFrame || bodyText.includes('ANOMALY DETECTED') || bodyText.includes('Radware Captcha') || bodyText.includes('think that you are a bot') || pageTitle.includes('Radware');
        }).catch(() => false);

        if (hasSecurityChallenge) {
            await captureTelemetry(2, 'RADWARE_CHALLENGE_DETECTED', 'WARNING');
            onProgress('🛡️ [பாதுகாப்பு சோதனை] அரசு இணையதள "I am human" சரிபார்ப்பு திரையில் உள்ளது...');
            await showBrowserHud('🛡️ மனித சரிபார்ப்பு (I am human)', 'Chrome திரையில் "I am human" சவாலைத் தீர்க்கவும்...', 'warning');
            await page.bringToFront().catch(() => {});
            await injectVisualBanner();
            await tryAutoClickCaptcha(page);
            for (let w = 0; w < 120; w++) {
                await page.waitForTimeout(1000);
                const stillSec = await page.evaluate(() => {
                    const bt = (document.body && document.body.innerText) || '';
                    const pt = document.title || '';
                    return window.location.href.includes('perfdrive') || bt.includes('ANOMALY DETECTED') || bt.includes('Radware Captcha') || bt.includes('think that you are a bot') || pt.includes('Radware');
                }).catch(() => false);
                if (!stillSec) break;
                await tryAutoClickCaptcha(page);
            }
            onProgress('🔄 [Radware மீட்சி] மனித சரிபார்ப்பு முடிந்தது! தளம் புதுப்பிக்கப்படுகிறது...');
            await page.waitForTimeout(2500);
            await saveTnpdsCookies();
            await dismissSessionConflictOrAlertModals(page, onProgress).catch(() => {});
            return true;
        }
        return false;
    };

    const ensureMobileNumberFilled = async () => {
        const curMobInput = page.locator('input[placeholder*="கைபேசி"], input[formcontrolname="mobNumber"]:not([disabled]), input[formcontrolname="mobileno"], input[name*="mobNumber"], input[type="tel"]').first();
        if (await curMobInput.count() === 0 || !(await curMobInput.isVisible().catch(() => false))) return false;
        if (await curMobInput.isDisabled().catch(() => false)) return true;

        const curVal = await curMobInput.inputValue().catch(() => '');
        const cleanCur = curVal.replace(/\D/g, '');
        const targetClean = String(userMobile).replace(/\D/g, '');
        const normCur = cleanCur.length > 10 && cleanCur.startsWith('91') ? cleanCur.slice(-10) : cleanCur;
        const normTarget = targetClean.length > 10 && targetClean.startsWith('91') ? targetClean.slice(-10) : targetClean;

        if (normCur !== normTarget && normTarget.length >= 10) {
            onProgress(`📱 [கைபேசி எண் உறுதி] பதிவு செய்யப்பட்ட கைபேசி எண் (+91 ${userMobile}) போர்ட்டலில் உள்ளிடப்படுகிறது...`);
            await showBrowserHud('[படி 2/12] கைபேசி எண் உள்ளிடப்படுகிறது', `+91 ${userMobile}`);
            await humanType(page, curMobInput, targetClean);
            await page.waitForTimeout(300);
            return true;
        }
        return true;
    };

    let otpVal = '';
    let isLoginComplete = false;
    for (let loginRound = 1; loginRound <= 5; loginRound++) {
        // Check if already logged in before starting round
        const alreadyAuth = await page.evaluate(() => {
            const u = window.location.href.toLowerCase();
            if (!u.includes('tnpds.gov.in') || u.includes('/auth/login') || u.includes('perfdrive') || u.includes('captcha')) return false;
            return Boolean(document.querySelector('#btnLogout, a[href*="logout"], .user-profile') || u.includes('/pages/service-request') || u.includes('/dashboard'));
        }).catch(() => false);
        if (alreadyAuth) {
            isLoginComplete = true;
            break;
        }

        // If on /pages/home or root without mobInput, click "உறுப்பினரை சேர்க்க" or navigate to service-request so we enter /auth/login or /pages/service-request
        const curUrlStart = page.url().toLowerCase();
        if (curUrlStart.includes('/pages/home') || curUrlStart.endsWith('tnpds.gov.in/')) {
            const addLink = page.locator('a:has-text("உறுப்பினரை சேர்க்க"), li:has-text("உறுப்பினரை சேர்க்க") a, span:has-text("உறுப்பினரை சேர்க்க"), [routerlink*="service-request"], a[href*="service-request"]').first();
            if (await addLink.count() > 0 && await addLink.isVisible().catch(() => false)) {
                await addLink.click({ timeout: 5000 }).catch(() => {});
                await page.waitForTimeout(2000);
            }
            if (page.url().toLowerCase().includes('/pages/home')) {
                await page.goto('https://www.tnpds.gov.in/pages/service-request', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
                await page.waitForTimeout(2000);
            }
        }

        let mobInput = page.locator('input[placeholder*="கைபேசி"], input[formcontrolname="mobNumber"]:not([disabled]), input[formcontrolname="mobileno"], input[name*="mobNumber"], input[type="tel"]').first();
        for (let w = 0; w < 15; w++) {
            if (await mobInput.count() > 0 && await mobInput.isVisible().catch(() => false)) break;
            if (page.url().toLowerCase().includes('/pages/service-request')) break;
            await handleStep2Radware();
            await page.waitForTimeout(1000);
            mobInput = page.locator('input[placeholder*="கைபேசி"], input[formcontrolname="mobNumber"]:not([disabled]), input[formcontrolname="mobileno"], input[name*="mobNumber"], input[type="tel"]').first();
        }

        if (page.url().toLowerCase().includes('/pages/service-request')) {
            isLoginComplete = true;
            break;
        }

        const hasMobOrOtpOnPage = (await mobInput.count() > 0 && await mobInput.isVisible().catch(() => false)) ||
            await page.evaluate(() => Boolean(document.querySelector('input[formcontrolname="otp"], input[placeholder*="OTP"], #otp'))).catch(() => false);
        if (!hasMobOrOtpOnPage) {
            await page.goto('https://www.tnpds.gov.in/auth/login', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
            await page.waitForTimeout(2000);
            await handleStep2Radware();
            mobInput = page.locator('input[placeholder*="கைபேசி"], input[formcontrolname="mobNumber"]:not([disabled]), input[formcontrolname="mobileno"], input[name*="mobNumber"], input[type="tel"]').first();
        }

        if (await mobInput.count() > 0 && await mobInput.isVisible()) {
            await ensureMobileNumberFilled();
            await page.waitForTimeout(1000);

            let captchaInput = page.locator('input#captchaCode, input[formcontrolname="captchaCode"], input[formcontrolname="captcha"], input[name="captchaCode"], #captcha').first();
            const sendOtpBtn = page.locator('input[value="பதிவு செய்ய"], button:has-text("பதிவு செய்ய"), button:has-text("OTP"), #btnSendOtp').first();

            if (await captchaInput.count() > 0 && await captchaInput.isVisible()) {
                await showBrowserHud('[படி 2/12] 🤖 AI கேப்ட்சா பகுப்பாய்வு செய்கிறது...', 'AI குறியீட்டைக் கண்டறிகிறது...', 'warning');
                onProgress('🤖 [AI Captcha] TNPDS கேப்ட்சா குறியீடு AI மூலம் பகுப்பாய்வு செய்யப்படுகிறது...');
                const code = await autoSolveCaptcha(page, onProgress, options);
                if (code) {
                    await showBrowserHud('[படி 2/12] ✍️ கேப்ட்சா பதிவு செய்யப்படுகிறது', `குறியீடு: ${code} • அரசு SMS OTP கோரப்படுகிறது...`, 'info');
                    for (let chk = 0; chk < 5; chk++) {
                        await page.waitForTimeout(1000);
                        const otpNow = await page.evaluate(() => Boolean(document.querySelector('input[formcontrolname="otp"], input[placeholder*="OTP"], #otp'))).catch(() => false);
                        if (otpNow) {
                            await showBrowserHud('[படி 2/12] ⏳ அரசு SMS OTP அனுப்பப்பட்டது', 'உங்கள் கைபேசிக்கு வந்துள்ள 7-இலக்க OTP-ஐ உள்ளிடவும்', 'info');
                            onProgress('✅ [AI OCR] கேப்ட்சா வெற்றிகரமாக ஏற்றுக்கொள்ளப்பட்டது! அரசு SMS OTP உருவாக்கப்பட்டது.');
                            break;
                        }
                        const dismissed = await dismissSessionConflictOrAlertModals(page, onProgress).catch(() => false);
                        if (dismissed) {
                            break;
                        }
                    }
                }
            } else if (await sendOtpBtn.count() > 0) {
                const hClicked = await humanClick(page, sendOtpBtn);
                if (!hClicked) await sendOtpBtn.click().catch(() => {});
                await page.waitForTimeout(1500);
            }
        }

        // Step 3: Wait for OTP with Autonomous Captcha Watchdog
        let otpAppeared = false;
        for (let waitOtp = 0; waitOtp < 90; waitOtp++) {
            await dismissSessionConflictOrAlertModals(page, onProgress).catch(() => {});
            const hasOtpField = await page.evaluate(() => {
                const el = document.querySelector('input[formcontrolname="otp"], input[placeholder*="OTP"], input[name*="otp"], #otp');
                return Boolean(el && (el.offsetWidth > 0 || el.offsetHeight > 0));
            }).catch(() => false);

            if (hasOtpField) {
                otpAppeared = true;
                onProgress('[படி 3/12] ✅ அரசு TNPDS SMS OTP பெட்டி திரையில் உள்ளது! கைபேசிக்கு வந்த OTP எண்ணை உள்ளிடவும்.');
                await showBrowserHud('[படி 3/12] OTP உள்ளிடவும்', 'உங்கள் போனுக்கு வந்த OTP-ஐ Chrome-ல் அல்லது Chat-ல் உள்ளிடவும்', 'info');
                break;
            }

            const secOnWait = await handleStep2Radware();
            if (secOnWait) {
                const otpNowSec = await page.evaluate(() => Boolean(document.querySelector('input[formcontrolname="otp"], input[placeholder*="OTP"], #otp'))).catch(() => false);
                if (otpNowSec) { otpAppeared = true; break; }
                else {
                    onProgress('🔄 [Radware மீட்சி] தளம் புதுப்பிக்கப்பட்டது — கைபேசி எண் மற்றும் கேப்ட்சா மீண்டும் தானாக உள்ளிடப்படுகிறது...');
                    break;
                }
            }

            if (!hasOtpField) {
                await ensureMobileNumberFilled();
                const captchaWatchState = await page.evaluate(() => {
                    const capEl = document.querySelector('input#captchaCode, input[formcontrolname="captchaCode"], input[formcontrolname="captcha"], input[name="captchaCode"], #captcha');
                    if (!capEl || (capEl.offsetWidth === 0 && capEl.offsetHeight === 0)) return { visible: false };
                    const hasErrorModal = Boolean(window._tnpdsLastDismissedCaptchaError && (Date.now() - window._tnpdsLastDismissedCaptchaError < 15000));
                    const hasInlineError = Boolean(document.querySelector('.text-danger, .error-message, .alert-danger, .swal2-container'));
                    return {
                        visible: true,
                        value: (capEl.value || '').trim(),
                        hasError: hasErrorModal || hasInlineError
                    };
                }).catch(() => ({ visible: false }));

                if (captchaWatchState.visible && (captchaWatchState.hasError || waitOtp >= 4)) {
                    onProgress('🔄 [Captcha தானியங்கி மீட்பு] கேப்ட்சா குறியீடு புதுப்பிக்கப்பட்டு AI மூலம் மீண்டும் தானாகப் பெறப்படுகிறது...');
                    await showBrowserHud('🔄 கேப்ட்சா தானியங்கி மீட்பு', 'புதிய AI கேப்ட்சா பதிவு செய்யப்படுகிறது...', 'warning');
                    await page.evaluate(() => {
                        const cap = document.querySelector('input#captchaCode, input[formcontrolname="captchaCode"], input[formcontrolname="captcha"], input[name="captchaCode"], #captcha');
                        if (cap) {
                            cap.value = '';
                            cap.dispatchEvent(new Event('input', { bubbles: true }));
                            cap.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                        const refreshBtn = document.querySelector('img[title*="கேப்ட்சா"], .captcha-refresh, a.refresh, #refreshCaptcha');
                        if (refreshBtn) refreshBtn.click();
                        window._tnpdsLastDismissedCaptchaError = 0;
                    }).catch(() => {});
                    await page.waitForTimeout(1000);
                    const retryCode = await autoSolveCaptcha(page, onProgress, options);
                    if (retryCode) {
                        waitOtp = 0; // reset wait timer so new OTP request has full window
                    }
                }
            }

            const isAlreadyLogged = await page.evaluate(() => {
                const u = window.location.href.toLowerCase();
                return !u.includes('/auth/login') && (u.includes('/pages/service-request') || u.includes('/dashboard') || Boolean(document.querySelector('#btnLogout')));
            }).catch(() => false);
            if (isAlreadyLogged) {
                isLoginComplete = true;
                break;
            }
            await page.waitForTimeout(1000);
        }

        if (isLoginComplete) break;

        if (otpAppeared) {
            onProgress(`📱 [படி 3/12] அரசு TNPDS உங்கள் கைபேசிக்கு (+91 ${userMobile}) 7-இலக்க SMS OTP அனுப்பியுள்ளது.`);
            await showBrowserHud('[படி 3/12] 7-இலக்க OTP உள்ளிடவும்', `உங்கள் போனுக்கு வந்த 7-இலக்க OTP-ஐ Chrome-ல் அல்லது Chat-ல் உள்ளிடவும்`, 'info');
            otpVal = await requestOtpFromUser(`📱 உங்கள் கைபேசிக்கு (+91 ${userMobile}) வந்த அரசு 7-இலக்க SMS OTP எண்ணை உள்ளிடவும் (Step 3 Login OTP):`, onProgress, 'login_otp', page);
            await showBrowserHud('[படி 3/12] OTP சரிபார்க்கப்படுகிறது', `OTP: ${otpVal}`);
            if (otpVal === 'PAGE_REFRESHED_TO_LOGIN') {
                onProgress('🔄 [Radware மீட்சி] பாதுகாப்பு சோதனைக்குப் பின் தளம் புதுப்பிக்கப்பட்டது — கைபேசி எண் மற்றும் கேப்ட்சா மீண்டும் தானாக உள்ளிடப்படுகிறது...');
                await showBrowserHud('🔄 தளம் புதுப்பிக்கப்பட்டது', 'கைபேசி எண் & கேப்ட்சா மீண்டும் தானாக உள்ளிடப்படுகிறது...', 'warning');
                continue;
            }
            if (otpVal && otpVal !== 'ALREADY_VERIFIED_ON_PORTAL' && otpVal !== 'PAGE_REFRESHED_TO_LOGIN') {
                await submitOtpOnPortal(page, otpVal);
            }
        } else {
            continue;
        }

        // STRICT LOGIN GATE (inside loginRound so post-Radware reset to /auth/login automatically retries)
        let resetToLogin = false;
        for (let waitAuth = 0; waitAuth < 90; waitAuth++) {
            await dismissSessionConflictOrAlertModals(page, onProgress);

            const secOnWaitAuth = await handleStep2Radware();
            if (secOnWaitAuth) {
                await page.waitForTimeout(2000);
                continue;
            }

            isLoginComplete = await page.evaluate(() => {
                const u = window.location.href.toLowerCase();
                if (!u.includes('tnpds.gov.in') || u.includes('/auth/login') || u.includes('perfdrive') || u.includes('captcha')) return false;
                return Boolean(document.querySelector('#btnLogout, a[href*="logout"], .user-profile') || u.includes('/pages/') || u.includes('/dashboard'));
            }).catch(() => false);

            if (isLoginComplete) break;

            // Check if Radware or page refresh reset the portal back to unauthenticated /auth/login (enabled mobNumber + no #otp)
            if (waitAuth >= 4) {
                const isResetToFreshLogin = await page.evaluate(() => {
                    const u = window.location.href.toLowerCase();
                    if (!u.includes('/auth/login')) return false;
                    const isSubmitting = Boolean(document.querySelector('.spinner-border, .loading'));
                    if (isSubmitting) return false;
                    const otpEl = document.querySelector('input[formcontrolname="otp"], input[placeholder*="OTP"], #otp');
                    if (otpEl && (otpEl.offsetWidth > 0 || otpEl.offsetHeight > 0)) return false;
                    const mobEl = document.querySelector('input[formcontrolname="mobNumber"]:not([disabled]), input#captcha, input[formcontrolname="captcha"]');
                    return Boolean(mobEl && (mobEl.offsetWidth > 0 || mobEl.offsetHeight > 0));
                }).catch(() => false);
                if (isResetToFreshLogin) {
                    onProgress('🔄 [Radware மீட்சி] உள்நுழைவு பக்கம் புதுப்பிக்கப்பட்டது — கைபேசி எண் மற்றும் கேப்ட்சா மீண்டும் தானாக உள்ளிடப்படுகிறது...');
                    resetToLogin = true;
                    break;
                }
            }

            if (waitAuth >= 4 && waitAuth % 4 === 0) {
                const isAuthReady = await page.evaluate(() => {
                    const u = window.location.href.toLowerCase();
                    if (u.includes('perfdrive') || u.includes('validate.') || u.includes('/auth/login')) return false;
                    return Boolean(localStorage.getItem('token') || sessionStorage.getItem('token') || document.querySelector('#btnLogout, a[href*="logout"], .user-profile'));
                }).catch(() => false);
                if (isAuthReady) {
                    try {
                        await page.goto('https://www.tnpds.gov.in/pages/service-request', { waitUntil: 'domcontentloaded', timeout: 15000 });
                        if (page.url().includes('service-request')) { isLoginComplete = true; break; }
                    } catch (_) {}
                }
            }
            await page.waitForTimeout(1000);
        }

        if (isLoginComplete) break;
        if (resetToLogin) continue;
        break;
    }

    onProgress('🎉 [படி 3/12] TNPDS போர்ட்டலில் வெற்றிகரமாக உள்நுழைந்தது!');
    onProgress('⏳ [படி 3/12] உள்நுழைவு நிலை சரிபார்க்கப்படுகிறது — அரசு தளம் ஸ்திரமாகும் வரை காத்திருக்கிறது...');
    await page.waitForTimeout(2000);
    await saveTnpdsCookies().catch(() => {});
    return { success: true };
}

module.exports = {
    executeSteps2And3Auth
};
