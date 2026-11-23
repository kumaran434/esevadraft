/**
 * TNPDS Address Change — Dedicated Isolated OTP Configuration
 * (முகவரி மாற்றம் ஆட்டோமேஷனுக்கான பிரத்யேக OTP கட்டுப்பாடு)
 *
 * OTP Rules for TNPDS_CHANGE_ADDRESS:
 * - Stage 1 (Step 3 — Citizen Portal Login /auth/login): Strictly 7-digit Login SMS OTP.
 * - No 2nd OTP stage during form submission.
 */

const ADDRESS_CHANGE_OTP_CONFIG = {
    serviceId: 'TNPDS_CHANGE_ADDRESS',
    requiresPortalLoginOtp: true,
    stages: {
        citizenLogin: {
            otpType: 'login_otp',
            digits: 7,
            descriptionTam: 'முகவரி மாற்றம் போர்ட்டல் உள்நுழைவு OTP (7 இலக்கம்)'
        }
    }
};

async function waitForAddressChangeLoginOtp(page, userMobile, onProgress, requestOtpFromUser) {
    return await requestOtpFromUser(
        `📱 உங்கள் கைபேசிக்கு (+91 ${userMobile}) வந்த அரசு ${ADDRESS_CHANGE_OTP_CONFIG.stages.citizenLogin.digits}-இலக்க SMS OTP எண்ணை உள்ளிடவும் (Step 3 Login OTP):`,
        onProgress,
        ADDRESS_CHANGE_OTP_CONFIG.stages.citizenLogin.otpType,
        page
    );
}

module.exports = {
    ADDRESS_CHANGE_OTP_CONFIG,
    waitForAddressChangeLoginOtp
};
