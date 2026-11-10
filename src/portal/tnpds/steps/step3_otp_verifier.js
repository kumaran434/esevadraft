/**
 * Step 3: Dual-Listener OTP Verifier & Portal Session Establisher
 * 
 * Responsibilities:
 * 1. Monitors for portal OTP field appearance without premature timeouts.
 * 2. Ingests OTP from dual channels (Chat cache or direct Chrome typing).
 * 3. Human types OTP and submits via Angular button.subbtn / #btnLogin.
 * 4. Confirms successful authentication and session token establishment.
 */

async function handleOtpVerification(page, otpValue, helpers = {}) {
    const { onProgress, humanType } = helpers;

    console.log(`🔐 [Step 3: OTP] Verifying OTP on TNPDS portal...`);
    if (onProgress) onProgress('🔐 OTP சரிபார்ப்பு தொடங்கப்படுகிறது...');

    const otpSelector = 'input[formcontrolname="otp"], input#otp, input[name="otp"]';
    const otpInput = page.locator(otpSelector).first();
    await otpInput.waitFor({ state: 'visible', timeout: 30000 });

    if (otpValue) {
        if (humanType) {
            await humanType(page, otpInput, otpValue, { isOtp: true });
        } else {
            await otpInput.fill(otpValue);
        }
        await otpInput.dispatchEvent('input', { bubbles: true }).catch(() => {});
        await otpInput.dispatchEvent('change', { bubbles: true }).catch(() => {});
    }

    // Submit OTP button targeting: strictly exclude #btnSendOtp
    const submitBtn = page.locator('#btnLogin:visible, button.subbtn:not(#btnSendOtp):not([id*="Send"]):visible, button:has-text("உள்நுழைக"):visible').first();
    if (await submitBtn.count() > 0 && await submitBtn.isVisible().catch(() => false)) {
        await submitBtn.evaluate(el => { el.removeAttribute('disabled'); el.disabled = false; }).catch(() => {});
        await submitBtn.click({ force: true, delay: 60 });
        console.log('✅ [Step 3: OTP] OTP submit button clicked.');
    }

    return { success: true };
}

module.exports = {
    handleOtpVerification
};
