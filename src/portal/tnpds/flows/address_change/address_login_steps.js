// =========================================================================
// TNPDS Address Change — Login & Authentication Steps (Steps 1, 2, 3)
// =========================================================================
const { performEarlyStep1RadwareWarmup } = require('../../../common/universal_radware_resumption');

async function executeAddressLoginSteps({ page, userMobile, onProgress, options, sharedContext }) {
    const {
        saveTnpdsCookies = async () => {},
        showBrowserHud = async () => {},
        forceWindowToFront = () => {},
        injectVisualBanner = async () => {},
        humanClick = async () => false,
        humanType = async () => {},
        tryAutoClickCaptcha = async () => false,
        dismissSessionConflictOrAlertModals = async () => false,
        submitOtpOnPortal = async () => {},
        requestOtpFromUser = async () => '',
        autoSolveCaptcha = async () => null
    } = sharedContext;

    const officialGovtUrl = 'https://www.tnpds.gov.in';
    onProgress('[படி 1/12] 🌐 தமிழ்நாடு அரசு அதிகாரப்பூர்வ TNPDS போர்டல் திறக்கப்படுகிறது (' + officialGovtUrl + ')...');
    try {
        await page.goto(officialGovtUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
    } catch (_) {
        onProgress('⚠️ அரசு இணையதள இணைப்பு தாமதம். மீண்டும் இணைக்கப்படுகிறது...');
        try { await page.goto(officialGovtUrl, { waitUntil: 'commit', timeout: 20000 }); } catch (e2) {}
    }
    await page.bringToFront().catch(() => {});
    forceWindowToFront();
    await page.waitForTimeout(1500);
    await performEarlyStep1RadwareWarmup(page, onProgress, { saveCookies: saveTnpdsCookies });

    const handleRadware = async () => {
        const hasSecurityChallenge = await page.evaluate(() => {
            const isTnpdsActive = Boolean(document.querySelector('input[placeholder*="கைபேசி"], input[formcontrolname="mobNumber"], input[formcontrolname="otp"], #nameTam, #btnLogout'));
            if (isTnpdsActive) return false;
            const bodyText = (document.body && document.body.innerText) || '';
            const isPerfdrive = window.location.hostname.includes('perfdrive') || window.location.href.includes('validate.perfdrive');
            const hasPerfdriveFrame = Boolean(document.querySelector('iframe[src*="perfdrive"], iframe[src*="validate."]'));
            return isPerfdrive || hasPerfdriveFrame || bodyText.includes('ANOMALY DETECTED') || bodyText.includes('Radware Captcha');
        }).catch(() => false);

        if (hasSecurityChallenge) {
            onProgress('🛡️ [பாதுகாப்பு சோதனை] அரசு இணையதள "I am human" சரிபார்ப்பு திரையில் உள்ளது. (Google Chrome-ல் சரிபார்க்கவும்)...');
            await showBrowserHud('🛡️ மனித சரிபார்ப்பு (I am human)', 'Chrome திரையில் "I am human" சவாலைத் தீர்க்கவும்...', 'warning');
            await page.bringToFront().catch(() => {});
            await injectVisualBanner();
            await tryAutoClickCaptcha();
            for (let w = 0; w < 120; w++) {
                await page.waitForTimeout(1000);
                const stillSec = await page.evaluate(() => {
                    const bodyText = (document.body && document.body.innerText) || '';
                    return window.location.href.includes('perfdrive') || bodyText.includes('ANOMALY DETECTED') || bodyText.includes('Radware Captcha');
                }).catch(() => false);
                if (!stillSec) break;
                await tryAutoClickCaptcha();
            }
            onProgress('🔄 [Radware மீட்சி] மனித சரிபார்ப்பு முடிந்தது! தளம் புதுப்பிக்கப்பட்டு நிலைபெறும் வரை காத்திருக்கிறது...');
            try {
                await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
                await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
            } catch (_) {}
            await page.waitForTimeout(2500);
            await saveTnpdsCookies();
            await dismissSessionConflictOrAlertModals(page, onProgress).catch(() => {});
            return true;
        }
        return false;
    };

    await handleRadware();

    let isAlreadyAuthenticated = await page.evaluate(() => {
        const u = window.location.href.toLowerCase();
        if (u.includes('/auth/login') || u.includes('/pages/home') || u.includes('perfdrive')) return false;
        return Boolean(document.querySelector('#btnLogout, a[href*="logout"], .user-profile, #nameTam, .logout')) || u.includes('/pages/service-request') || u.includes('/pages/cardmaintenance');
    }).catch(() => false);

    if (isAlreadyAuthenticated) {
        onProgress('⚡ [Session Cookie Reuse] ஏற்கனவே உள்நுழைந்த அமர்வு கண்டறியப்பட்டது! மீண்டும் OTP தேவையின்றி தொடர்கிறது...');
        await showBrowserHud('[படி 3/12] Session Active', 'ஏற்கனவே உள்நுழைந்த அமர்வு பயன்படுத்தப்படுகிறது', 'success');
        return { success: true };
    }

    for (let loginRound = 1; loginRound <= 5; loginRound++) {
        isAlreadyAuthenticated = await page.evaluate(() => {
            const u = window.location.href.toLowerCase();
            if (u.includes('/auth/login') || u.includes('/pages/home') || u.includes('perfdrive')) return false;
            return Boolean(document.querySelector('#btnLogout, a[href*="logout"], .user-profile, #nameTam, .logout')) || u.includes('/pages/service-request') || u.includes('/pages/cardmaintenance');
        }).catch(() => false);

        if (isAlreadyAuthenticated) break;

        const curUrl = page.url();
        if (!curUrl.includes('/auth/login') && !curUrl.includes('/service-request') && !curUrl.includes('/cardmaintenance')) {
            try {
                const addrLink = page.locator('a:has-text("முகவரி மாற்றம்"), a:has-text("Change of Address"), [routerlink*="service-request"], a[href*="service-request"]').first();
                if (await addrLink.count() > 0 && await addrLink.isVisible().catch(() => false)) {
                    onProgress('[படி 1/12] 🔗 முகப்பில் "முகவரி மாற்றம்" இணைப்பு கிளிக் செய்யப்படுகிறது...');
                    await addrLink.click({ force: true }).catch(() => {});
                    await page.waitForTimeout(2500);
                } else {
                    onProgress('[படி 1/12] 🔗 TNPDS உள்நுழைவுப் பக்கத்திற்கு (auth/login) செல்லப்படுகிறது...');
                    await page.goto('https://www.tnpds.gov.in/auth/login', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
                    await page.waitForTimeout(2500);
                }
            } catch (_) {}
        }

        const ensureMobile = async () => {
            const curMobInput = page.locator('input[placeholder*="கைபேசி"], input[formcontrolname="mobNumber"]:not([disabled]), input[formcontrolname="mobileno"], input[name*="mobNumber"], input[type="tel"]').first();
            if (await curMobInput.count() === 0 || !(await curMobInput.isVisible().catch(() => false))) return false;
            const isDisabled = await curMobInput.isDisabled().catch(() => false);
            if (isDisabled) return true;
            const curVal = await curMobInput.inputValue().catch(() => '');
            const cleanCur = curVal.replace(/\D/g, '');
            const targetClean = String(userMobile).replace(/\D/g, '');
            if (cleanCur !== targetClean && targetClean.length >= 10) {
                onProgress(`📱 [கைபேசி எண் உறுதி] பதிவு செய்யப்பட்ட கைபேசி எண் (+91 ${userMobile}) போர்ட்டலில் உள்ளிடப்படுகிறது...`);
                await showBrowserHud('[படி 2/12] கைபேசி எண்', `+91 ${userMobile}`);
                await humanType(page, curMobInput, targetClean);
                await page.waitForTimeout(300);
            }
            return true;
        };

        await dismissSessionConflictOrAlertModals(page, onProgress).catch(() => {});

        let mobInput = page.locator('input[placeholder*="கைபேசி"], input[formcontrolname="mobNumber"]:not([disabled]), input[formcontrolname="mobileno"], input[name*="mobNumber"], input[type="tel"]').first();
        for (let w = 0; w < 15; w++) {
            if (await mobInput.count() > 0 && await mobInput.isVisible().catch(() => false)) break;
            await handleRadware();
            await page.waitForTimeout(1000);
            mobInput = page.locator('input[placeholder*="கைபேசி"], input[formcontrolname="mobNumber"]:not([disabled]), input[formcontrolname="mobileno"], input[name*="mobNumber"], input[type="tel"]').first();
        }

        if (await mobInput.count() > 0 && await mobInput.isVisible().catch(() => false)) {
            await ensureMobile();
            const sendOtpBtn = page.locator('input[type="submit"][value="பதிவு செய்ய"], input.btn-success[value*="பதிவு"], button:has-text("பதிவு செய்ய"), #btnSendOtp').first();

            let autoSolvedCaptcha = false;
            for (let attempt = 1; attempt <= 3; attempt++) {
                await handleRadware();
                await ensureMobile();
                await showBrowserHud('🤖 [படி 2/12] AI கேப்ட்சா பகுப்பாய்வு செய்கிறது...', 'AI குறியீட்டைக் கண்டறிகிறது • தயவுசெய்து எதையும் தொடாதீர்கள்!', 'warning');
                const code = await autoSolveCaptcha(page, onProgress, options);
                if (code && await sendOtpBtn.count() > 0) {
                    autoSolvedCaptcha = true;
                    await showBrowserHud('✍️ [படி 2/12] கேப்ட்சா பதிவு செய்யப்படுகிறது', `குறியீடு: ${code} • சமர்ப்பிக்கப்படுகிறது...`, 'info');
                    await ensureMobile();
                    const hClicked = await humanClick(page, sendOtpBtn);
                    if (!hClicked) await sendOtpBtn.click().catch(() => {});
                    await page.waitForTimeout(1500);

                    let otpDetected = false;
                    for (let chk = 0; chk < 6; chk++) {
                        await page.waitForTimeout(1000);
                        const otpNow = await page.evaluate(() => {
                            return Boolean(document.querySelector('input[formcontrolname="otp"], input[placeholder*="OTP"], input[name*="otp"], #otp'));
                        }).catch(() => false);
                        if (otpNow) {
                            otpDetected = true;
                            onProgress('✅ [AI OCR] கேப்ட்சா வெற்றிகரமாக ஏற்றுக்கொள்ளப்பட்டது! அரசு SMS OTP உருவாக்கப்பட்டது.');
                            break;
                        }
                        await dismissSessionConflictOrAlertModals(page, onProgress).catch(() => {});
                    }
                    if (otpDetected) break;

                    const errAlert = await page.evaluate(() => {
                        const el = document.querySelector('.alert-danger, .text-danger, .error-msg, .toast-error, snack-bar-container, .alert-warning');
                        if (!el) return '';
                        const txt = el.innerText.trim();
                        if (txt.includes('அனுப்பப்பட்டுள்ளது') || txt.includes('OTP sent') || txt.includes('வெற்றிகர') || txt.includes('கடவுச்சொல்லை உள்ளிடவும்') || txt.includes('வெளியேற விரும்புகிறீர்களா')) return '';
                        return txt;
                    }).catch(() => '');

                    if (errAlert) {
                        if (errAlert.includes('பதிவுசெய்யப்படவில்லை') || errAlert.includes('not registered') || errAlert.includes('தவறான கைபேசி')) {
                            onProgress(`❌ [அரசு TNPDS பிழை] நீங்கள் உள்ளிட்ட கைபேசி எண் (+91 ${userMobile}) தமிழ்நாடு அரசு குடும்ப அட்டையில் பதிவுசெய்யப்படவில்லை!`);
                            await showBrowserHud('❌ எண் பதிவுசெய்யப்படவில்லை', `+91 ${userMobile} TNPDS-ல் இல்லை`, 'error');
                            return { success: false, message: `கைபேசி எண் (+91 ${userMobile}) TNPDS குடும்ப அட்டையில் பதிவுசெய்யப்படவில்லை.` };
                        }
                        if (errAlert.includes('வரம்பை மீறிவிட்டது') || errAlert.includes('15 நிமிடங்களுக்கு') || errAlert.includes('exceeded') || errAlert.includes('maximum limit')) {
                            onProgress(`⏳ [அரசு TNPDS பாதுகாப்பு வரம்பு] இந்த கைபேசி எண்ணிற்கு (+91 ${userMobile}) அரசு சர்வரில் OTP அனுப்பும் வரம்பு தற்காலிகமாக மீறிவிட்டது! தயவுசெய்து 15 நிமிடங்கள் கழித்து மீண்டும் முயற்சிக்கவும்.`);
                            await showBrowserHud('⏳ 15 நிமிடம் காத்திருக்கவும்', 'OTP வரம்பு மீறிவிட்டது - 15 நிமிடம் கழித்து முயற்சிக்கவும்', 'error');
                            return { success: false, message: 'அரசு TNPDS OTP வரம்பு தற்காலிகமாக மீறிவிட்டது. தயவுசெய்து 15 நிமிடங்கள் கழித்து முயற்சிக்கவும்.' };
                        }
                    }
                    break;
                }
            }

            if (!autoSolvedCaptcha && await sendOtpBtn.count() > 0) {
                onProgress('⌨️ [படி 2/12] Google Chrome திரையில் தோன்றும் கேப்ட்சா (Captcha) குறியீட்டை உள்ளிட்டு "பதிவு செய்ய" பொத்தானை அழுத்தவும்...');
                await showBrowserHud('[படி 2/12] Captcha உள்ளிடவும்', 'திரையில் தோன்றும் Captcha குறியீட்டை உள்ளிட்டு பதிவு செய்ய அழுத்தவும்');
            }

            let otpAppeared = false;
            for (let w = 0; w < 90; w++) {
                await dismissSessionConflictOrAlertModals(page, onProgress).catch(() => {});
                otpAppeared = await page.evaluate(() => {
                    const el = document.querySelector('input[formcontrolname="otp"], input[placeholder*="OTP"], input[name*="otp"], #otp');
                    return Boolean(el && (el.offsetWidth > 0 || el.offsetHeight > 0));
                }).catch(() => false);
                if (otpAppeared) break;
                await handleRadware();
                await page.waitForTimeout(1000);
            }

            if (otpAppeared) {
                onProgress(`📱 [படி 3/12] அரசு TNPDS உங்கள் கைபேசிக்கு (+91 ${userMobile}) அனுப்பிய அரசு 7-இலக்க SMS OTP-க்காகக் காத்திருக்கிறது...`);
                onProgress('👉 7-இலக்க OTP எண்ணை சாட்டிலோ அல்லது உங்கள் கண்முன்னே தெரியும் Google Chrome உலாவியிலோ உள்ளிடலாம்.');
                const otpVal = await requestOtpFromUser(`📱 உங்கள் கைபேசிக்கு (+91 ${userMobile}) வந்த அரசு 7-இலக்க SMS OTP எண்ணை உள்ளிடவும் (Step 3 Login OTP):`, onProgress, 'login_otp', page);
                if (otpVal === 'PAGE_REFRESHED_TO_LOGIN') {
                    onProgress('🔄 [Login Page Recover] OTP காத்திருப்பின்போது TNPDS தளம் Login முகப்பிற்கு திரும்பியதால் கைபேசி எண் & கேப்ட்சா மீண்டும் தானாக உள்ளிடப்படுகிறது...');
                    continue;
                }
                await showBrowserHud('[படி 3/12] 7-இலக்க OTP சரிபார்க்கப்படுகிறது', `OTP: ${otpVal}`);
                if (otpVal && otpVal !== 'ALREADY_VERIFIED_ON_PORTAL') {
                    await submitOtpOnPortal(page, otpVal);
                }
            } else {
                continue;
            }
        }

        let resetToLogin = false;
        for (let waitAuth = 0; waitAuth < 60; waitAuth++) {
            await dismissSessionConflictOrAlertModals(page, onProgress);
            isAlreadyAuthenticated = await page.evaluate(() => {
                const u = window.location.href.toLowerCase();
                if (!u.includes('tnpds.gov.in') || u.includes('/auth/login') || u.includes('/pages/home') || u.includes('perfdrive')) return false;
                return Boolean(document.querySelector('#btnLogout, a[href*="logout"], .user-profile, #nameTam, .logout')) || u.includes('/pages/cardmaintenance') || u.includes('/pages/service-request');
            }).catch(() => false);
            if (isAlreadyAuthenticated) break;

            const isBackAtLogin = await page.evaluate(() => {
                const u = window.location.href.toLowerCase();
                return u.includes('/auth/login') && Boolean(document.querySelector('input[formcontrolname="mobNumber"]:not([disabled])'));
            }).catch(() => false);
            if (isBackAtLogin && waitAuth > 5) {
                resetToLogin = true;
                break;
            }
            await page.waitForTimeout(1000);
        }

        if (resetToLogin) {
            onProgress('🔄 [Login Retry] உள்நுழைவு அமர்வு மீளமைக்கப்பட்டது — மீண்டும் முயற்சிக்கப்படுகிறது...');
            continue;
        }

        if (isAlreadyAuthenticated) break;
    }

    if (!isAlreadyAuthenticated) {
        throw new Error('TNPDS_LOGIN_GATE_HALT: User has not completed portal login. Session could not be verified.');
    }

    onProgress('🎉 [படி 3/12] TNPDS போர்ட்டலில் வெற்றிகரமாக உள்நுழைந்தது!');
    await saveTnpdsCookies();

    return { success: true };
}

module.exports = { executeAddressLoginSteps };
