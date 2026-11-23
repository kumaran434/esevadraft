/**
 * TNPDS Add Family Member — Dedicated Isolated OTP Configuration & Handlers
 * (குடும்ப உறுப்பினர் சேர்க்கை ஆட்டோமேஷனுக்கான பிரத்யேக OTP கட்டுப்பாடு)
 *
 * OTP Rules for TNPDS_ADD_MEMBER:
 * 1. Stage 1 (Step 3 — Citizen Portal Login /auth/login):
 *    - Strictly 7-digit Login SMS OTP.
 * 2. Stage 2 (Step 9b — New Member Aadhaar e-KYC Modal):
 *    - Accepts 6 or 7 digits (UIDAI / TNPDS Aadhaar OTP).
 */

const ADD_MEMBER_OTP_CONFIG = {
    serviceId: 'TNPDS_ADD_MEMBER',
    requiresPortalLoginOtp: true,
    stages: {
        citizenLogin: {
            otpType: 'login_otp',
            digits: 7,
            descriptionTam: 'உறுப்பினர் சேர்க்கை போர்ட்டல் உள்நுழைவு OTP (7 இலக்கம்)'
        },
        memberAadhaarVerify: {
            otpType: 'aadhaar_otp',
            digits: [6, 7],
            minDigits: 6,
            maxDigits: 7,
            descriptionTam: 'புதிய உறுப்பினர் ஆதார் சரிபார்ப்பு OTP (6 அல்லது 7 இலக்கம்)'
        }
    }
};

function isValidAddMemberAadhaarOtp(val) {
    const clean = String(val || '').replace(/\D/g, '');
    const { minDigits, maxDigits } = ADD_MEMBER_OTP_CONFIG.stages.memberAadhaarVerify;
    return clean.length >= minDigits && clean.length <= maxDigits;
}

async function waitForAddMemberLoginOtp(page, userMobile, onProgress, requestOtpFromUser) {
    return await requestOtpFromUser(
        `📱 உங்கள் கைபேசிக்கு (+91 ${userMobile}) வந்த அரசு ${ADD_MEMBER_OTP_CONFIG.stages.citizenLogin.digits}-இலக்க SMS OTP எண்ணை உள்ளிடவும் (Step 3 Login OTP):`,
        onProgress,
        ADD_MEMBER_OTP_CONFIG.stages.citizenLogin.otpType,
        page
    );
}

module.exports = {
    ADD_MEMBER_OTP_CONFIG,
    isValidAddMemberAadhaarOtp,
    waitForAddMemberLoginOtp
};
