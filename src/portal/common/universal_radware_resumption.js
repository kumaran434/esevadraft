// ============================================================================
// eSevaDraft Universal Radware Immunity & Seamless Post-Refresh Resumption Engine
// Common standard across ALL government portals (TNPDS, TNeGA, NVSP, Revenue)
// Zero-Halt Invariant: When anti-bot challenge clears and page reloads,
// automation seamlessly resumes execution from where it left off! (< 300 lines)
// ============================================================================

const fs = require('fs');
const path = require('path');

/**
 * Checks if Radware / Perfdrive bot protection challenge is active on the page.
 */
async function isRadwareChallenge(page) {
    if (!page || page.isClosed()) return false;
    try {
        const curUrl = page.url().toLowerCase();
        if (curUrl.includes('perfdrive') || curUrl.includes('validate.perfdrive') || curUrl.includes('captcha')) {
            return true;
        }

        return await page.evaluate(() => {
            // If legitimate inputs or logged-in indicators exist, challenge is NOT active
            const isGovtPageReady = Boolean(
                document.querySelector('input[formcontrolname], input[name*="mob"], input[placeholder*="கைபேசி"], input[placeholder*="OTP"], #nameTam, select[formcontrolname="serviceType"], select[formcontrolname="service"], #btnLogout, a[href*="logout"], .user-profile')
            );
            const bodyText = (document.body && document.body.innerText) || '';
            const pageTitle = document.title || '';
            const isPerfdrive = window.location.hostname.includes('perfdrive') || window.location.href.includes('validate.');
            const hasFrame = Boolean(document.querySelector('iframe[src*="perfdrive"], iframe[src*="validate."], iframe[src*="hcaptcha"]'));

            if (isPerfdrive || hasFrame || bodyText.includes('ANOMALY DETECTED') || bodyText.includes('Radware Captcha') || bodyText.includes('think that you are a bot') || pageTitle.includes('Radware')) {
                return !isGovtPageReady || isPerfdrive;
            }
            return false;
        }).catch(() => false);
    } catch (_) {
        return false;
    }
}

/**
 * Automatically attempts to click the Radware 'I am human' checkbox if visible,
 * without disturbing active image puzzle modals.
 */
async function tryAutoClickRadwareChallenge(page) {
    if (!page || page.isClosed()) return false;
    try {
        // 1. Check if user is actively solving an image challenge modal
        const isPuzzleActive = await page.evaluate(() => {
            const iframes = Array.from(document.querySelectorAll('iframe'));
            return iframes.some(f => {
                const s = (f.src || '').toLowerCase();
                const t = (f.title || '').toLowerCase();
                return s.includes('challenge') || s.includes('captcha/v1') || t.includes('challenge') || t.includes('captcha');
            });
        }).catch(() => false);

        if (isPuzzleActive) return false;

        // 2. Check if token already solved
        const isSolved = await page.evaluate(() => {
            const h = document.querySelector('[name="h-captcha-response"], textarea[id*="h-captcha-response"]');
            if (h && h.value && h.value.trim().length > 20) return true;
            const c = document.querySelector('#cf_input, [name="cfi"]');
            if (c && c.value && c.value.trim().length > 20) return true;
            return false;
        }).catch(() => false);

        // 3. Click submit if token verified
        if (isSolved) {
            const subBtn = page.locator('input[type="submit"][value*="Submit"], button[type="submit"]:has-text("Submit"), input.btn-success, button.btn-success').first();
            if (await subBtn.count() > 0 && await subBtn.isVisible().catch(() => false)) {
                await subBtn.click().catch(() => {});
                return true;
            }
        }

        // 4. Try clicking the checkbox directly inside iframe or page
        const frames = page.frames();
        for (const frame of frames) {
            try {
                const check = frame.locator('#checkbox, input[type="checkbox"], .ctp-checkbox-label, [role="checkbox"]').first();
                if (await check.count() > 0 && await check.isVisible().catch(() => false)) {
                    await check.click({ delay: 50 }).catch(() => {});
                    return true;
                }
            } catch (_) {}
        }
    } catch (_) {}
    return false;
}

/**
 * Waits for Radware challenge to clear, allows post-refresh DOM to settle,
 * and executes post-challenge session cookie preservation.
 */
async function waitForRadwareClearanceAndSettle(page, onProgress = () => {}, options = {}) {
    if (!page || page.isClosed()) return false;

    const hadChallenge = await isRadwareChallenge(page);
    if (!hadChallenge) return false;

    onProgress('🛡️ [அரசு பாதுகாப்பு தணிக்கை] Radware மனித சரிபார்ப்பு திரையில் உள்ளது. ஆட்டோமேஷன் நிறுத்தப்படாமல் காத்திருக்கிறது...');

    await tryAutoClickRadwareChallenge(page);

    // Poll until challenge is cleared (up to 150 seconds)
    for (let i = 0; i < 150; i++) {
        await page.waitForTimeout(1000).catch(() => {});
        const stillActive = await isRadwareChallenge(page);
        if (!stillActive) {
            onProgress('✅ [பாதுகாப்பு தீர்வு] Radware சரிபார்ப்பு முடிந்தது! அரசு போர்டல் தளம் புதுப்பிக்கப்பட்டு நிலைபெறுகிறது...');
            break;
        }
        if (i % 5 === 0) {
            await tryAutoClickRadwareChallenge(page);
        }
    }

    // Wait for post-challenge URL navigation and reload settlement
    try {
        await page.waitForURL(url => !url.href.includes('perfdrive') && !url.href.includes('validate.'), { timeout: 15000 }).catch(() => {});
        await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
    } catch (_) {}

    await page.waitForTimeout(2000).catch(() => {});

    // Save session cookies if callback supplied
    if (typeof options.saveCookies === 'function') {
        await options.saveCookies().catch(() => {});
    }

    return true;
}

/**
 * Universal Post-Refresh Resumption Detector:
 * Automatically inspects the current DOM after a page refresh to determine the exact step.
 * Returns the matched step key from the portal's step contract matrix.
 */
async function detectPostRefreshStep(page, stepRules = []) {
    if (!page || page.isClosed()) return null;
    try {
        for (const rule of stepRules) {
            const isMatch = await page.evaluate(rule.selectorOrFn).catch(() => false);
            if (isMatch) {
                return rule.stepName;
            }
        }
    } catch (_) {}
    return null;
}

/**
 * 1. Universal Anti-Bot Stealth Shield (தடுப்புக் கவசம்):
 * Injects clean anti-automation fingerprint masking into Playwright Context or Page
 * while strictly preserving native Chrome PluginArray and window.chrome prototypes
 * so Radware Bot Manager (validate.perfdrive.com) instanceof checks never flag anomalies.
 */
async function injectRadwareStealthShield(contextOrPage) {
    if (!contextOrPage || typeof contextOrPage.addInitScript !== 'function') return false;
    try {
        await contextOrPage.addInitScript(() => {
            try {
                Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => undefined });
                delete Object.getPrototypeOf(navigator).webdriver;
            } catch (_) {}
            try {
                Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en', 'ta'] });
                Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
                Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
            } catch (_) {}
            try {
                Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });
                Object.defineProperty(document, 'hidden', { get: () => false });
                document.hasFocus = () => true;
            } catch (_) {}
        });
        return true;
    } catch (_) {
        return false;
    }
}

/**
 * 2. Early Step-1 Human Kinetics Warmup & Pre-Emptive Radware Clearance:
 * Performs natural human mouse movement & scroll right when the portal opens at Step 1,
 * and immediately resolves any early Radware challenge before form filling begins.
 */
async function performEarlyStep1RadwareWarmup(page, onProgress = () => {}, options = {}) {
    if (!page || page.isClosed()) return false;
    try {
        // Gentle human mouse movement warmup so Perfdrive behavioral sensor sees organic kinetics
        await page.mouse.move(180, 220, { steps: 6 }).catch(() => {});
        await page.waitForTimeout(120).catch(() => {});
        await page.mouse.move(420, 310, { steps: 8 }).catch(() => {});
        await page.waitForTimeout(120).catch(() => {});
        await page.mouse.move(310, 260, { steps: 5 }).catch(() => {});
    } catch (_) {}

    if (await isRadwareChallenge(page)) {
        onProgress('🛡️ [படி 1 ஆரம்ப பாதுகாப்பு சோதனை] ஆட்டோமேஷன் தொடக்கத்திலேயே Radware சரிபார்ப்பு கண்டறியப்பட்டது — இங்கே தீர்க்கப்பட்டால் நடுவில் தொந்தரவு வராது...');
        await waitForRadwareClearanceAndSettle(page, onProgress, options);
        return true;
    }
    return false;
}

/**
 * 3. Universal Any-Step Radware Guard & Resume-From-Interrupted-Step Wrapper:
 * Runs a step function. If Radware triggers before, during, or right after the step
 * (or if a Radware refresh wipes the form), it waits for Radware clearance, runs
 * `recoverWipedState()` to restore prior steps, and resumes the exact interrupted step!
 */
async function executeStepWithRadwareResumption(page, stepConfig = {}) {
    const {
        stepName = 'Step',
        runStep = async () => {},
        isFormWipedAfterRefresh = async () => false,
        recoverWipedState = async () => {},
        onProgress = () => {},
        saveCookies = null,
        maxRetries = 3
    } = stepConfig;

    let stateAlreadyRecovered = false;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        // Pre-step check: Did Radware appear before starting this step?
        if (await isRadwareChallenge(page)) {
            onProgress(`🛡️ [Radware மீட்பு - ${stepName}] பாதுகாப்பு சோதனை கண்டறியப்பட்டது! தீர்க்கப்பட்டதும் விட்ட இடத்திலிருந்து (${stepName}) தொடரும்...`);
            await waitForRadwareClearanceAndSettle(page, onProgress, { saveCookies });
            await recoverWipedState(page);
        } else if (!stateAlreadyRecovered && await isFormWipedAfterRefresh(page).catch(() => false)) {
            onProgress(`🔄 [தானியங்கி மீட்பு - ${stepName}] பக்கம் புதுப்பிக்கப்பட்டதால் அழிந்த விவரங்கள் மீண்டும் நிரப்பப்பட்டு ${stepName} தொடர்கிறது...`);
            await recoverWipedState(page);
        }
        stateAlreadyRecovered = false;

        let stepError = null;
        let result;
        try {
            result = await runStep();
        } catch (err) {
            stepError = err;
        }

        // Post-step check: Did Radware trigger during the step execution?
        const radwareNow = await isRadwareChallenge(page);
        const wipedNow = !radwareNow && (await isFormWipedAfterRefresh(page).catch(() => false));

        if (radwareNow || (stepError && wipedNow)) {
            if (radwareNow) {
                onProgress(`🛡️ [Radware இடைமறிப்பு - ${stepName}] ${stepName} நடக்கும்போது Radware வந்தது! சவாலைத் தீர்த்ததும் விட்ட இடத்திலிருந்து (${stepName}) தானாகத் தொடரும்...`);
                await waitForRadwareClearanceAndSettle(page, onProgress, { saveCookies });
            } else {
                onProgress(`🔄 [தானியங்கி மீட்பு - ${stepName}] பக்கம் புதுப்பிக்கப்பட்டது கண்டறியப்பட்டது — விட்ட இடத்திலிருந்து (${stepName}) மீண்டும் தொடர்கிறது...`);
            }
            if (attempt < maxRetries) {
                await recoverWipedState(page);
                stateAlreadyRecovered = true;
                continue;
            }
        }

        if (stepError) {
            throw stepError;
        }

        return result;
    }
}

/**
 * 4. Mid-Page Radware / Page-Refresh Detector Guard:
 * Call between or inside steps on the same page. If Radware appears OR the page
 * refreshed (wiping earlier steps on that page), throws a RADWARE_PAGE_REFRESH signal
 * so `executePageBlockWithRadwareRestart` restarts from the FIRST step of that page!
 */
async function assertNoRadwareOrPageRefresh(page, checkPageIntactFn = null, stepLabel = 'Step') {
    if (!page || page.isClosed()) return;
    if (await isRadwareChallenge(page)) {
        const err = new Error(`RADWARE_PAGE_REFRESH_DETECTED:${stepLabel}`);
        err.isRadwarePageRefresh = true;
        err.stepLabel = stepLabel;
        throw err;
    }
    if (typeof checkPageIntactFn === 'function') {
        const intact = await checkPageIntactFn(page).catch(() => true);
        if (!intact) {
            const err = new Error(`RADWARE_PAGE_REFRESH_DETECTED:${stepLabel}`);
            err.isRadwarePageRefresh = true;
            err.stepLabel = stepLabel;
            throw err;
        }
    }
}

/**
 * 5. Universal Page-Block Runner (பக்கத்தின் ஆரம்ப படியிலிருந்து தொடங்கும் எஞ்சின்):
 * When a page has multiple steps (e.g. Step 4 -> Step 5 -> Step 6 -> Step 7 -> Step 8 -> Step 9),
 * if Radware triggers at Step 5 (or any step on that page) and refreshes the page,
 * it NEVER resumes just Step 5 in isolation — it waits for Radware clearance and
 * restarts from the BEGINNING STEP of that current page all the way to completion!
 */
async function executePageBlockWithRadwareRestart(page, blockConfig = {}) {
    const {
        pageName = 'Current Page',
        firstStepName = 'ஆரம்ப படி',
        runPageStepsFromStart = async () => {},
        onSessionExpiredReLogin = null,
        onProgress = () => {},
        saveCookies = null,
        maxPageRestarts = 4
    } = blockConfig;

    for (let cycle = 1; cycle <= maxPageRestarts; cycle++) {
        if (await isRadwareChallenge(page)) {
            onProgress(`🛡️ [Radware பாதுகாப்பு - ${pageName}] சவால் தீர்க்கப்படும் வரை காத்திருக்கிறது... முடிந்ததும் இப்பக்கத்தின் ஆரம்ப படியிலிருந்து (${firstStepName}) தொடங்கும்.`);
            await waitForRadwareClearanceAndSettle(page, onProgress, { saveCookies });
        }

        if (typeof onSessionExpiredReLogin === 'function') {
            await onSessionExpiredReLogin(page);
        }

        try {
            const res = await runPageStepsFromStart(cycle);
            if (await isRadwareChallenge(page)) {
                const err = new Error(`RADWARE_PAGE_REFRESH_DETECTED:${pageName}`);
                err.isRadwarePageRefresh = true;
                throw err;
            }
            return res;
        } catch (err) {
            const radwareActive = await isRadwareChallenge(page);
            if ((err && err.isRadwarePageRefresh) || radwareActive) {
                const interruptedAt = (err && err.stepLabel) || pageName;
                if (radwareActive) {
                    onProgress(`🛡️ [Radware இடைமறிப்பு - ${interruptedAt}] Radware கண்டறியப்பட்டது! சவால் தீர்க்கப்படும் வரை காத்திருக்கிறது...`);
                    await waitForRadwareClearanceAndSettle(page, onProgress, { saveCookies });
                }
                if (cycle < maxPageRestarts) {
                    onProgress(`🔄 [பக்க ஆரம்ப மீட்பு] ${interruptedAt}-ல் பக்கம் புதுப்பிக்கப்பட்டதால், வெறும் அந்தப் படியை மட்டும் தொடங்காமல் இப்பக்கத்தின் ஆரம்ப படியிலிருந்து (${firstStepName}) மீண்டும் தொடங்கி முடிக்கப்படுகிறது...`);
                    continue;
                }
            }
            throw err;
        }
    }
}

module.exports = {
    isRadwareChallenge,
    tryAutoClickRadwareChallenge,
    waitForRadwareClearanceAndSettle,
    detectPostRefreshStep,
    injectRadwareStealthShield,
    performEarlyStep1RadwareWarmup,
    executeStepWithRadwareResumption,
    assertNoRadwareOrPageRefresh,
    executePageBlockWithRadwareRestart
};


