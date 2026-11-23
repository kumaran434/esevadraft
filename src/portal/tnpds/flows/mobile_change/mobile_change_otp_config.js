/**
 * TNPDS Mobile Number Update — Dedicated Isolated OTP Configuration & Modal Watcher
 * (கைபேசி எண் மாற்றம் ஆட்டோமேஷனுக்கான பிரத்யேக OTP கட்டுப்பாடு)
 *
 * OTP Rules for TNPDS_UPDATE_MOBILE:
 * 1. Stage 1 (Step 3 — Citizen Portal Login /auth/login): Strictly 7-digit Login SMS OTP.
 * 2. Stage 2 (Step 10 — New Mobile Verification Modal): Strictly 6-digit New Mobile SMS OTP.
 */

const fs = require('fs');
const path = require('path');

const MOBILE_CHANGE_OTP_CONFIG = {
    serviceId: 'TNPDS_UPDATE_MOBILE',
    requiresPortalLoginOtp: true,
    stages: {
        citizenLogin: {
            otpType: 'login_otp',
            digits: 7,
            descriptionTam: 'கைபேசி எண் மாற்றம் போர்ட்டல் உள்நுழைவு OTP (7 இலக்கம்)'
        },
        newMobileVerify: {
            otpType: 'mobile_update_otp',
            digits: 6,
            descriptionTam: 'புதிய கைபேசி எண் சரிபார்ப்பு OTP (6 இலக்கம்)'
        }
    }
};

async function waitForMobileChangeLoginOtp(page, userMobile, onProgress, requestOtpFromUser) {
    return await requestOtpFromUser(
        `📱 உங்கள் கைபேசிக்கு (+91 ${userMobile}) வந்த அரசு ${MOBILE_CHANGE_OTP_CONFIG.stages.citizenLogin.digits}-இலக்க Login SMS OTP எண்ணை உள்ளிடவும் (Step 3):`,
        onProgress,
        MOBILE_CHANGE_OTP_CONFIG.stages.citizenLogin.otpType,
        page
    );
}

/**
 * Dedicated 6-Digit New Mobile OTP Watcher for Step 10 of TNPDS Mobile Update.
 */
async function waitForMobileChangeNewNumberOtp(page, newMobile, onProgress = () => {}, requestOtpFromUser = null) {
    const expectedLen = MOBILE_CHANGE_OTP_CONFIG.stages.newMobileVerify.digits; // Strictly 6
    const promptMsg = `📱 உங்கள் புதிய கைபேசி எண்ணிற்கு (+91 ${newMobile}) வந்த அரசு ${expectedLen}-இலக்க SMS OTP எண்ணை உள்ளிடவும்:`;

    const pendingOtpPaths = [
        path.join(process.cwd(), 'data', 'pending_otp.txt'),
        path.join(process.env.APPDATA || '', 'esevadraft-desktop', 'data', 'pending_otp.txt'),
        path.join(process.env.APPDATA || '', 'esevadraft-desktop', 'pending_otp.txt')
    ];

    return new Promise((resolve) => {
        let settled = false;
        let timer = null;
        const finish = (val) => {
            if (settled) return;
            settled = true;
            if (timer) clearInterval(timer);
            resolve(val);
        };

        if (typeof requestOtpFromUser === 'function') {
            Promise.resolve(
                requestOtpFromUser(promptMsg, onProgress, MOBILE_CHANGE_OTP_CONFIG.stages.newMobileVerify.otpType, page)
            ).then((val) => {
                if (!settled && val) finish(val);
            }).catch(() => {});
        } else {
            onProgress(promptMsg);
        }

        timer = setInterval(async () => {
            if (settled || !page || page.isClosed()) return finish('CLOSED');
            try {
                for (const pPath of pendingOtpPaths) {
                    if (fs.existsSync(pPath)) {
                        const diskVal = fs.readFileSync(pPath, 'utf8').trim().replace(/\D/g, '');
                        if (diskVal.length === expectedLen) {
                            try { fs.unlinkSync(pPath); } catch (_) {}
                            return finish(diskVal);
                        }
                    }
                }
                const domOtp = await page.evaluate((targetLen) => {
                    const inp = document.querySelector('input[formcontrolname="otp"], .modal input[placeholder*="OTP"], .modal input:not([readonly]):not([disabled]):not([type="hidden"])');
                    if (!inp) return null;
                    const v = (inp.value || '').replace(/\D/g, '');
                    return v.length === targetLen ? v : null;
                }, expectedLen).catch(() => null);
                if (domOtp) return finish(domOtp);
            } catch (_) {}
        }, 450);
    });
}

module.exports = {
    MOBILE_CHANGE_OTP_CONFIG,
    waitForMobileChangeLoginOtp,
    waitForMobileChangeNewNumberOtp
};
