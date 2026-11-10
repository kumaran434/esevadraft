/**
 * TNPDS Add Member — Step 1: Login & Session Authentication (Modular Step < 300 lines)
 * 
 * Responsibilities:
 * 1. Checks if existing logged-in session is already active on TNPDS.
 * 2. Pre-emptively audits Radware anomaly and clears it before sending OTP.
 * 3. Fills registered ration card mobile number with authentic human kinetics.
 * 4. Auto-solves Captcha via AI OCR and submits for SMS OTP.
 * 5. Verifies OTP via Triple Listener (Chat, Chrome portal, and Disk IPC).
 * 6. Enforces Strict Zero-Step-Skip Login Gate before moving to service navigation.
 */

async function ensureAuthenticatedSession(page, mobileNumber, helpers = {}) {
    const {
        onProgress = () => {},
        showBrowserHud = async () => {},
        humanType = async () => {},
        humanClick = async () => {},
        autoSolveCaptcha = async () => '',
        requestOtpFromUser = async () => '',
        submitOtpOnPortal = async () => {},
        captureTelemetry = async () => {},
        saveTnpdsCookies = async () => {},
        tryAutoClickCaptcha = async () => {},
        dismissSessionConflictOrAlertModals = async () => false,
        addMemberResumption = null,
        isTestSuite = false,
        options = {}
    } = helpers;

    console.log(`🔐 [Add Member: Step 1] Verifying portal session for +91 ${mobileNumber}...`);
    if (onProgress) onProgress(`[படி 1/12] 🌐 TNPDS முகப்புப் பக்கம் & அமர்வு சரிபார்க்கப்படுகிறது...`);

    // 1. Check if already authenticated on portal
    const isAlreadyLoggedIn = await page.evaluate(() => {
        const u = window.location.href.toLowerCase();
        if (u.includes('/auth/login') || u.includes('perfdrive')) return false;
        const hasMember = Boolean(document.querySelector('input[formcontrolname="nameTam"], #nameTam, #btnLogout, a[href*="logout"], .user-profile'));
        const isPages = u.includes('/pages/') || u.includes('/dashboard') || u.includes('/service-request');
        return hasMember || isPages;
    }).catch(() => false);

    if (isAlreadyLoggedIn) {
        console.log('✅ [Add Member: Step 1] Already authenticated on portal.');
        if (onProgress) onProgress('✅ [படி 1/12] ஏற்கனவே உள்நுழைவு செய்யப்பட்டுள்ளது!');
        await showBrowserHud('[படி 1/12] ஏற்கனவே உள்நுழைந்துள்ளது', page.url(), 'success');
        return { authenticated: true, reusedSession: true };
    }

    // 2. Clear any active Radware challenge if present
    if (addMemberResumption && await addMemberResumption.isRadwareChallengeActive(page)) {
        if (onProgress) onProgress('🛡️ [பாதுகாப்பு சோதனை] Radware மனித சரிபார்ப்பு திரையில் உள்ளது. காத்திருக்கிறது...');
        await showBrowserHud('🛡️ மனித சரிபார்ப்பு தேவை', 'Chrome-ல் "I am human" கிளிக் செய்யவும்', 'warning');
        await addMemberResumption.clearRadwareAndSettle(page, onProgress, tryAutoClickCaptcha, saveTnpdsCookies);
    }

    // 3. Ensure mobile number is filled
    const ensureMobileFilled = async () => {
        const curMobInput = page.locator('input[placeholder*="கைபேசி"], input[formcontrolname="mobNumber"]:not([disabled]), input[formcontrolname="mobileno"], input[name*="mobNumber"], input[type="tel"]').first();
        if (await curMobInput.count() === 0 || !(await curMobInput.isVisible().catch(() => false))) return false;
        if (await curMobInput.isDisabled().catch(() => false)) return true;

        const curVal = await curMobInput.inputValue().catch(() => '');
        const cleanCur = curVal.replace(/\D/g, '');
        const targetClean = String(mobileNumber).replace(/\D/g, '');
        const normCur = cleanCur.length > 10 && cleanCur.startsWith('91') ? cleanCur.slice(-10) : cleanCur;
        const normTarget = targetClean.length > 10 && targetClean.startsWith('91') ? targetClean.slice(-10) : targetClean;

        if (normCur !== normTarget && normTarget.length >= 10) {
            if (onProgress) onProgress(`📱 [கைபேசி எண் உறுதி] பதிவு செய்யப்பட்ட கைபேசி எண் (+91 ${mobileNumber}) போர்ட்டலில் உள்ளிடப்படுகிறது...`);
            await showBrowserHud('[படி 2/12] கைபேசி எண் உள்ளிடப்படுகிறது', `+91 ${mobileNumber}`);
            await humanType(page, curMobInput, targetClean);
            await page.waitForTimeout(300);
        }
        return true;
    };

    await ensureMobileFilled();

    // 4. Check if OTP field is ALREADY visible (e.g. from previous submit or operator pre-action)
    let hasOtpInput = await page.evaluate(() => {
        const el = document.querySelector('input[formcontrolname="otp"], input[placeholder*="OTP"], input[name*="otp"], #otp');
        return Boolean(el && (el.offsetWidth > 0 || el.offsetHeight > 0));
    }).catch(() => false);

    // 5. If OTP not visible, solve Captcha and submit
    if (!hasOtpInput) {
        if (onProgress) onProgress('[படி 2/12] 🔐 கேப்ட்சா குறியீடு AI OCR மூலம் சரிபார்க்கப்படுகிறது...');
        await showBrowserHud('[படி 2/12] கேப்ட்சா குறியீடு', 'AI OCR சரிபார்க்கிறது...');
        await autoSolveCaptcha(page, onProgress, options);

        // Wait for OTP input to appear
        for (let waitOtp = 0; waitOtp < 30; waitOtp++) {
            await page.waitForTimeout(1000);
            hasOtpInput = await page.evaluate(() => {
                const el = document.querySelector('input[formcontrolname="otp"], input[placeholder*="OTP"], input[name*="otp"], #otp');
                return Boolean(el && (el.offsetWidth > 0 || el.offsetHeight > 0));
            }).catch(() => false);
            if (hasOtpInput) break;

            if (addMemberResumption && await addMemberResumption.isRadwareChallengeActive(page)) {
                await addMemberResumption.clearRadwareAndSettle(page, onProgress, tryAutoClickCaptcha, saveTnpdsCookies);
            }
        }
    }

    // 6. Request and Submit OTP (Triple Listener)
    if (hasOtpInput) {
        if (onProgress) onProgress(`📱 [படி 3/12] அரசு TNPDS உங்கள் கைபேசிக்கு (+91 ${mobileNumber}) SMS OTP அனுப்பியுள்ளது.`);
        await showBrowserHud('[படி 3/12] OTP உள்ளிடவும்', 'Chrome அல்லது Chat-ல் OTP உள்ளிடவும்', 'info');

        const otpVal = await requestOtpFromUser(`📱 உங்கள் கைபேசிக்கு (+91 ${mobileNumber}) வந்த அரசு SMS OTP எண்ணை உள்ளிடவும்:`, onProgress, 'otp');
        await showBrowserHud('[படி 3/12] OTP சரிபார்க்கப்படுகிறது', `OTP: ${otpVal}`);

        if (otpVal && otpVal !== 'ALREADY_VERIFIED_ON_PORTAL') {
            await submitOtpOnPortal(page, otpVal);
        }
    }

    // 7. Verify Login Completed Gate
    let isLoginComplete = false;
    for (let waitAuth = 0; waitAuth < 60; waitAuth++) {
        await dismissSessionConflictOrAlertModals(page, onProgress);

        isLoginComplete = await page.evaluate(() => {
            const u = window.location.href.toLowerCase();
            if (!u.includes('tnpds.gov.in') || u.includes('/auth/login') || u.includes('perfdrive')) return false;
            const hasMember = Boolean(document.querySelector('input[formcontrolname="nameTam"], #nameTam, #btnLogout, a[href*="logout"], .user-profile'));
            const isPages = u.includes('/pages/') || u.includes('/dashboard') || u.includes('/service-request');
            return hasMember || isPages;
        }).catch(() => false);

        if (isLoginComplete) break;

        // Auto-heal Radware challenge if it appeared after OTP submit
        if (addMemberResumption && await addMemberResumption.isRadwareChallengeActive(page)) {
            await addMemberResumption.clearRadwareAndSettle(page, onProgress, tryAutoClickCaptcha, saveTnpdsCookies);
            waitAuth = 0;
            continue;
        }

        await page.waitForTimeout(1000);
    }

    if (!isLoginComplete) {
        throw new Error('LOGIN_AUTHENTICATION_GATE_HALT: Could not complete login authentication on TNPDS portal. Zero-Step-Skip enforced.');
    }

    await saveTnpdsCookies();
    console.log('✅ [Add Member: Step 1] Login authentication successfully verified.');
    if (onProgress) onProgress('✅ [படி 1/12] உள்நுழைவு வெற்றிகரமாக முடிந்தது!');
    return { authenticated: true, reusedSession: false };
}

module.exports = {
    ensureAuthenticatedSession
};
