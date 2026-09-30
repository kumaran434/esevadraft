/**
 * eSevaDraft Enterprise Automation Standard
 * Module: portal_action_guards.js
 * 
 * Strict Invariants:
 * 1. Mobile number MUST be 10 digits before submit.
 * 2. Captcha code MUST be 4-8 alphanumeric characters before submit.
 * 3. Mobile input must NEVER equal the captcha code.
 * 4. Submit button must NEVER be clicked if either assertion fails.
 */

class PortalActionGuards {
    /**
     * Validates that mobile number is properly formatted (10 digits).
     */
    static normalizeMobile(val) {
        if (!val) return '';
        const digits = String(val).replace(/\D/g, '');
        return digits.length > 10 && digits.startsWith('91') ? digits.slice(-10) : digits;
    }

    /**
     * Validates and verifies that mobile input contains the exact intended 10-digit customer number.
     * Prevents captcha codes from ever being typed or persisting in the mobile box.
     */
    static async verifyMobileInput(page, mobInputLocator, expectedMobile) {
        const normExpected = this.normalizeMobile(expectedMobile);
        if (normExpected.length < 10) return true; // mock or unspecified

        const curVal = await mobInputLocator.inputValue().catch(() => '');
        const normCur = this.normalizeMobile(curVal);

        if (normCur !== normExpected) {
            return {
                valid: false,
                current: normCur,
                expected: normExpected,
                reason: `Mobile input mismatch: expected "${normExpected}", got "${normCur}"`
            };
        }
        return { valid: true, current: normCur };
    }

    /**
     * Validates that captcha input contains a valid 4-8 char code.
     */
    static async verifyCaptchaInput(page, captchaInputLocator) {
        const curVal = (await captchaInputLocator.inputValue().catch(() => '')).trim();
        const clean = curVal.replace(/[^a-zA-Z0-9]/g, '');

        if (clean.length < 4 || clean.length > 8) {
            return {
                valid: false,
                current: clean,
                reason: `Captcha input invalid: length ${clean.length} (expected 4-8 chars)`
            };
        }
        return { valid: true, current: clean };
    }

    /**
     * Hardened Gate: Checks that mobile is NOT overwritten with captcha,
     * and both fields are strictly valid before clicking submit.
     */
    static async assertPreSubmitCleanliness({ mobLocator, capLocator, expectedMobile }) {
        const mobCheck = await this.verifyMobileInput(null, mobLocator, expectedMobile);
        if (!mobCheck.valid) {
            throw new Error(`[Strict Value Guard] SUBMIT_BLOCKED: ${mobCheck.reason}`);
        }

        const capCheck = await this.verifyCaptchaInput(null, capLocator);
        if (!capCheck.valid) {
            throw new Error(`[Strict Value Guard] SUBMIT_BLOCKED: ${capCheck.reason}`);
        }

        // Cross-contamination check: Mobile must NEVER equal captcha
        if (mobCheck.current === capCheck.current) {
            throw new Error(`[Strict Value Guard] SUBMIT_BLOCKED: Cross-contamination detected! Mobile number box contains captcha code (${mobCheck.current}).`);
        }

        return true;
    }
}

module.exports = { PortalActionGuards };
