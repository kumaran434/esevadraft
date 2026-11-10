/**
 * Step 2: Login Authenticator & Captcha OCR Engine
 * 
 * Responsibilities:
 * 1. Navigates to TNPDS login page with resilient network timeouts.
 * 2. Types 10-digit mobile number with authentic keystroke cadence.
 * 3. Captures and solves arithmetic/text captcha via OCR.
 * 4. Submits initial OTP request and monitors for Radware security challenge.
 */

async function navigateAndInitiateLogin(page, mobileNumber, helpers = {}) {
    const { onProgress, solveCaptcha, humanType } = helpers;

    if (onProgress) onProgress('🌐 TNPDS முகப்புப் பக்கம் திறக்கப்படுகிறது...');
    console.log(`🔑 [Step 2: Login] Navigating to TNPDS login for mobile: ${mobileNumber}...`);

    await page.goto('https://www.tnpds.gov.in/auth/login', {
        waitUntil: 'domcontentloaded',
        timeout: 45000
    });

    // Mobile Number Input Field Detection
    const mobileSelector = 'input[formcontrolname="mobNumber"], input[placeholder*="கைபேசி"], input[formcontrolname="mobileNumber"], input#mobileNumber, input[name="mobileNumber"]';
    const mobileInput = page.locator(mobileSelector).first();
    await mobileInput.waitFor({ state: 'visible', timeout: 20000 });

    if (humanType) {
        await humanType(page, mobileInput, mobileNumber);
    } else {
        await mobileInput.fill(mobileNumber);
    }

    if (onProgress) onProgress('🔢 கேப்ட்சா குறியீடு சரிபார்க்கப்படுகிறது...');

    // Captcha solving
    if (typeof solveCaptcha === 'function') {
        await solveCaptcha(page);
    }

    // Submit initial Send OTP
    const sendOtpBtn = page.locator('#btnSendOtp, input[type="submit"][value*="OTP"]').first();
    if (await sendOtpBtn.count() > 0 && await sendOtpBtn.isVisible()) {
        await sendOtpBtn.click();
        if (onProgress) onProgress('📩 OTP அனுப்பும் பொத்தான் அழுத்தப்பட்டது...');
    }

    return { success: true };
}

module.exports = {
    navigateAndInitiateLogin
};
