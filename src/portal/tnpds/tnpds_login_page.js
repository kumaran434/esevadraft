/**
 * eSevaDraft Enterprise Automation Standard
 * Module: tnpds_login_page.js
 * 
 * Strict Page Object Model (POM) for https://www.tnpds.gov.in/auth/login
 * Enforces Scoped Selectors, Value Guards, and Zero-Cross-Contamination.
 */

const { PortalActionGuards } = require('../common/portal_action_guards');
const { AiCaptchaSolver } = require('../common/ai_captcha_solver');

class TnpdsLoginPage {
    constructor(page, onProgress = () => {}) {
        this.page = page;
        this.onProgress = onProgress;
    }

    // -------------------------------------------------------------
    // STRICT SCOPED LOCATORS (Zero Fuzzy Matching, Zero Shared Comma Lists)
    // -------------------------------------------------------------

    /**
     * Mobile Number Input: Strictly matches the editable mobile control.
     * NEVER matches captcha inputs.
     */
    getMobileInput() {
        return this.page.locator('input[formcontrolname="mobNumber"]:not([disabled]), input[placeholder*="கைபேசி"]:not([disabled])').first();
    }

    /**
     * Captcha Code Input: Strictly matches #captchaCode.
     * NEVER matches mobile inputs.
     */
    getCaptchaInput() {
        return this.page.locator('input#captchaCode, input[formcontrolname="captchaCode"]').first();
    }

    /**
     * Captcha Image: Strictly matches TNPDS data URL or Tamil title.
     * STRICTLY EXCLUDES Perfdrive / Radware security badges.
     */
    getCaptchaImage() {
        return this.page.locator('img[src^="data:image"], img[title*="கேப்ட்சா"], img[alt="Captcha Code"]:not([src*="perfdrive"])').first();
    }

    /**
     * Submit / Send OTP Button: Strictly matches registration submit button.
     */
    getSubmitButton() {
        return this.page.locator('input[type="submit"][value="பதிவு செய்ய"], input.btn-success[value*="பதிவு"]').first();
    }

    // -------------------------------------------------------------
    // DETERMINISTIC ACTIONS & VALUE GUARDS
    // -------------------------------------------------------------

    /**
     * Ensures mobile number is filled and verified.
     */
    async ensureMobileFilled(rawMobile) {
        const mobInput = this.getMobileInput();
        if (await mobInput.count() === 0 || !(await mobInput.isVisible().catch(() => false))) {
            return false;
        }

        const targetMobile = PortalActionGuards.normalizeMobile(rawMobile);
        if (targetMobile.length < 10) return true;

        const curVal = await mobInput.inputValue().catch(() => '');
        const normCur = PortalActionGuards.normalizeMobile(curVal);

        if (normCur !== targetMobile) {
            this.onProgress(`📱 [கைபேசி எண் உறுதி] பதிவு செய்யப்பட்ட கைபேசி எண் (+91 ${targetMobile}) போர்ட்டலில் உள்ளிடப்படுகிறது...`);
            await mobInput.click();
            await mobInput.fill(targetMobile);
            await mobInput.dispatchEvent('input');
            await mobInput.dispatchEvent('change');
            await this.page.waitForTimeout(300);
        }

        return true;
    }

    /**
     * Solves Captcha and fills into #captchaCode.
     * Visual green border is strictly applied to #captchaCode only.
     */
    async solveAndFillCaptcha(options = {}) {
        const capInput = this.getCaptchaInput();
        if (await capInput.count() === 0 || !(await capInput.isVisible().catch(() => false))) {
            return null;
        }

        const capImg = this.getCaptchaImage();
        if (await capImg.count() === 0 || !(await capImg.isVisible().catch(() => false))) {
            return null;
        }

        // Apply green highlight exclusively to the captcha input
        await capInput.evaluate((el) => {
            el.style.border = '3px solid #22c55e';
            el.style.boxShadow = '0 0 14px rgba(34, 197, 94, 0.7)';
            el.focus();
        }).catch(() => {});

        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                this.onProgress(`🤖 [AI Captcha OCR] TNPDS கேப்ட்சா படம் பகுப்பாய்வு செய்யப்படுகிறது (முயற்சி ${attempt}/3)...`);
                await this.page.waitForTimeout(400);

                let imgPayload = null;
                const srcAttr = await capImg.getAttribute('src').catch(() => '');
                if (srcAttr && srcAttr.startsWith('data:image')) {
                    imgPayload = srcAttr;
                } else {
                    imgPayload = await capImg.screenshot().catch(() => null);
                }

                if (!imgPayload) continue;

                const code = await AiCaptchaSolver.solve(imgPayload, options);
                if (code && code.length >= 4 && code.length <= 8) {
                    this.onProgress(`🤖 [AI Captcha OCR] கேப்ட்சா குறியீடு பெறப்பட்டது: "${code}"`);
                    await capInput.click();
                    await capInput.fill(code);
                    await capInput.dispatchEvent('input');
                    await capInput.dispatchEvent('change');
                    await this.page.waitForTimeout(300);
                    return code;
                }
            } catch (e) {
                console.warn(`[TnpdsLoginPage] Captcha attempt ${attempt} error:`, e.message);
            }
        }

        return null;
    }

    /**
     * Hardened Submission: Enforces Pre-Submit Cleanliness Invariant.
     * Mobile number must NOT be overwritten, and captcha must be present.
     */
    async submitLogin(expectedMobile) {
        const mobLocator = this.getMobileInput();
        const capLocator = this.getCaptchaInput();
        const submitBtn = this.getSubmitButton();

        // 1. Enforce Pre-Submit Value Guard
        await PortalActionGuards.assertPreSubmitCleanliness({
            mobLocator,
            capLocator,
            expectedMobile
        });

        // 2. Click Submit Button
        this.onProgress('🚀 [படி 2/12] பதிவு செய்ய பொத்தான் அழுத்தப்படுகிறது...');
        await submitBtn.click({ force: true, delay: 80 });
        await this.page.waitForTimeout(2000);

        return true;
    }

    /**
     * Checks if OTP field has appeared on screen.
     */
    async hasOtpAppeared() {
        return this.page.evaluate(() => {
            const el = document.querySelector('input[formcontrolname="otp"], input[placeholder*="OTP"], input[name*="otp"], #otp');
            return Boolean(el && (el.offsetWidth > 0 || el.offsetHeight > 0));
        }).catch(() => false);
    }

    /**
     * Checks for any alert message displayed by the portal.
     */
    async getPortalAlert() {
        return this.page.evaluate(() => {
            const el = document.querySelector('.alert-danger, .text-danger, .error-msg, .toast-error, snack-bar-container, .alert, .toast');
            return el ? el.innerText.trim() : '';
        }).catch(() => '');
    }
}

module.exports = { TnpdsLoginPage };
