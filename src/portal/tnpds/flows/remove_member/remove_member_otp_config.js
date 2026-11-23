/**
 * TNPDS Remove Family Member — Dedicated Isolated OTP Configuration
 * (குடும்ப உறுப்பினர் நீக்கம் ஆட்டோமேஷனுக்கான பிரத்யேக OTP கட்டுப்பாடு)
 *
 * OTP Rules for TNPDS_REMOVE_MEMBER:
 * - Stage 1 (Step 3 — Citizen Portal Login /auth/login): Strictly 7-digit Login SMS OTP.
 * - No 2nd OTP stage during form submission.
 */

const REMOVE_MEMBER_OTP_CONFIG = {
    serviceId: 'TNPDS_REMOVE_MEMBER',
    requiresPortalLoginOtp: true,
    stages: {
        citizenLogin: {
            otpType: 'login_otp',
            digits: 7,
            descriptionTam: 'உறுப்பினர் நீக்கம் போர்ட்டல் உள்நுழைவு OTP (7 இலக்கம்)'
        }
    }
};

async function waitForRemoveMemberLoginOtp(page, userMobile, onProgress, requestOtpFromUser) {
    return await requestOtpFromUser(
        `📱 உங்கள் கைபேசிக்கு (+91 ${userMobile}) வந்த அரசு ${REMOVE_MEMBER_OTP_CONFIG.stages.citizenLogin.digits}-இலக்க SMS OTP எண்ணை உள்ளிடவும் (Step 3 Login OTP):`,
        onProgress,
        REMOVE_MEMBER_OTP_CONFIG.stages.citizenLogin.otpType,
        page
    );
}

module.exports = {
    REMOVE_MEMBER_OTP_CONFIG,
    waitForRemoveMemberLoginOtp
};
