/**
 * TNPDS Change Family Head — Dedicated Isolated OTP Configuration
 * (குடும்பத் தலைவர் மாற்றம் ஆட்டோமேஷனுக்கான பிரத்யேக OTP கட்டுப்பாடு)
 *
 * OTP Rules for TNPDS_CHANGE_HEAD:
 * - Stage 1 (Step 3 — Citizen Portal Login /auth/login): Strictly 7-digit Login SMS OTP.
 * - No 2nd OTP stage during form submission.
 */

const CHANGE_HEAD_OTP_CONFIG = {
    serviceId: 'TNPDS_CHANGE_HEAD',
    requiresPortalLoginOtp: true,
    stages: {
        citizenLogin: {
            otpType: 'login_otp',
            digits: 7,
            descriptionTam: 'குடும்பத் தலைவர் மாற்றம் போர்ட்டல் உள்நுழைவு OTP (7 இலக்கம்)'
        }
    }
};

async function waitForChangeHeadLoginOtp(page, userMobile, onProgress, requestOtpFromUser) {
    return await requestOtpFromUser(
        `📱 உங்கள் கைபேசிக்கு (+91 ${userMobile}) வந்த அரசு ${CHANGE_HEAD_OTP_CONFIG.stages.citizenLogin.digits}-இலக்க Login SMS OTP எண்ணை உள்ளிடவும் (Step 3):`,
        onProgress,
        CHANGE_HEAD_OTP_CONFIG.stages.citizenLogin.otpType,
        page
    );
}

module.exports = {
    CHANGE_HEAD_OTP_CONFIG,
    waitForChangeHeadLoginOtp
};
