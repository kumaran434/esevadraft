/**
 * TNPDS New Smart Ration Card — Dedicated Isolated OTP Configuration & Watcher
 * (புதிய ரேஷன் கார்டு ஆட்டோமேஷனுக்கான பிரத்யேக OTP கட்டுப்பாடு — பொது வாட்ச்மேன் கிடையாது)
 *
 * OTP Rules for TNPDS_NEW_CARD (/pages/newsmartcard):
 * 1. Stage 1 (Step 20-21 — Mobile Number Verification Modal "OTP சரிபார்ப்பு"):
 *    - Strictly 6 digits (e.g., 293614).
 *    - Never uses the 7-digit /auth/login screen.
 * 2. Stage 2 (Step 35-36 — Head & Family Member Aadhaar OTP Modal):
 *    - Accepts 7 digits immediately (or 6 digits if portal input maxlength=6 / after 1.6s debounce).
 */

const fs = require('fs');
const path = require('path');

const NEW_CARD_OTP_CONFIG = {
    serviceId: 'TNPDS_NEW_CARD',
    requiresPortalLoginOtp: false,
    stages: {
        mobileVerify: {
            otpType: 'new_card_mobile_otp',
            digits: 6,
            descriptionTam: 'புதிய ரேஷன் கார்டு கைபேசி எண் சரிபார்ப்பு OTP (6 இலக்கம்)'
        },
        aadhaarVerify: {
            otpType: 'new_card_aadhaar_otp',
            digits: [7, 6],
            minDigits: 6,
            maxDigits: 7,
            descriptionTam: 'குடும்பத் தலைவர் & உறுப்பினர் ஆதார் சரிபார்ப்பு OTP (7 அல்லது 6 இலக்கம்)'
        }
    }
};

function isValidNewCardMobileOtp(val) {
    const clean = String(val || '').replace(/\D/g, '');
    return clean.length === NEW_CARD_OTP_CONFIG.stages.mobileVerify.digits;
}

function isValidNewCardAadhaarOtp(val) {
    const clean = String(val || '').replace(/\D/g, '');
    const { minDigits, maxDigits } = NEW_CARD_OTP_CONFIG.stages.aadhaarVerify;
    return clean.length >= minDigits && clean.length <= maxDigits;
}

/**
 * Dedicated 6-Digit Mobile OTP Watcher for TNPDS New Ration Card (/pages/newsmartcard).
 * Runs independently inside the New Card flow without relying on the shared login watchman.
 */
async function waitForNewCardMobileOtp(page, userMobile, onProgress = () => {}, sharedContext = {}) {
    const promptMsg = `📲 **அரசு TNPDS போர்ட்டல் உங்கள் கைபேசி எண்ணிற்கு (${userMobile}) 6-இலக்க மொபைல் OTP SMS அனுப்பியுள்ளது!**`;
    const expectedLen = NEW_CARD_OTP_CONFIG.stages.mobileVerify.digits; // Strictly 6

    if (typeof sharedContext.clearStaleOtpState === 'function') {
        sharedContext.clearStaleOtpState();
    }

    onProgress(promptMsg);

    const pendingOtpPaths = [
        path.join(process.cwd(), 'data', 'pending_otp.txt'),
        path.join(process.env.APPDATA || '', 'esevadraft-desktop', 'data', 'pending_otp.txt'),
        path.join(process.env.APPDATA || '', 'esevadraft-desktop', 'pending_otp.txt')
    ];

    return new Promise((resolve) => {
        let settled = false;
        let pollTimer = null;

        const finish = (otpVal) => {
            if (settled) return;
            settled = true;
            if (pollTimer) clearInterval(pollTimer);
            resolve(otpVal);
        };

        // Also listen to App Chat / sharedContext.requestOtpFromUser in parallel if operator types in chat
        if (typeof sharedContext.requestOtpFromUser === 'function') {
            Promise.resolve(
                sharedContext.requestOtpFromUser(promptMsg, () => {}, NEW_CARD_OTP_CONFIG.stages.mobileVerify.otpType, page)
            ).then((chatOtp) => {
                if (settled || !chatOtp) return;
                if (chatOtp === 'ALREADY_VERIFIED_ON_PORTAL' || chatOtp === 'CLOSED') {
                    return finish(chatOtp);
                }
                const clean = String(chatOtp).replace(/\D/g, '');
                if (clean.length === expectedLen) {
                    finish(clean);
                }
            }).catch(() => {});
        }

        // Dedicated New Ration Card 6-digit Chrome Modal & Disk IPC poller
        pollTimer = setInterval(async () => {
            if (settled) return;
            if (!page || page.isClosed()) {
                return finish('CLOSED');
            }

            try {
                // 1. Check Disk IPC (data/pending_otp.txt) for 6-digit mobile OTP
                for (const pPath of pendingOtpPaths) {
                    if (fs.existsSync(pPath)) {
                        try {
                            const diskVal = fs.readFileSync(pPath, 'utf8').trim().replace(/\D/g, '');
                            if (diskVal.length === expectedLen) {
                                try { fs.unlinkSync(pPath); } catch (_) {}
                                if (typeof sharedContext.provideOtp === 'function') {
                                    try { sharedContext.provideOtp(diskVal); } catch (_) {}
                                }
                                return finish(diskVal);
                            }
                        } catch (_) {}
                    }
                }

                // 2. Inspect New Ration Card Chrome DOM Modal directly for 6-digit OTP (or Radware / Page Refresh wipe!)
                const domDetected = await page.evaluate((targetDigits) => {
                    const bt = (document.body && document.body.innerText) || '';
                    const isPerf = window.location.hostname.includes('perfdrive') || window.location.href.includes('validate.');
                    const hasChallengeFrame = Array.from(document.querySelectorAll('iframe[src*="perfdrive"], iframe[src*="validate."], iframe[src*="hcaptcha"]'))
                        .some(f => f.offsetWidth > 0 && f.offsetHeight > 0);
                    if (isPerf || hasChallengeFrame || bt.includes('ANOMALY DETECTED') || bt.includes('Radware Captcha') || bt.includes('think that you are a bot')) {
                        return 'RADWARE_PAGE_REFRESH_DETECTED';
                    }

                    // If /pages/newsmartcard refreshed and wiped NameOfFamilyHead back to blank while waiting for OTP:
                    const nameInps = Array.from(document.querySelectorAll('input[formcontrolname="NameOfFamilyHead"]'));
                    if (nameInps.length > 0 && !nameInps.some(el => el.value && el.value.trim().length > 0)) {
                        return 'RADWARE_PAGE_REFRESH_DETECTED';
                    }

                    const isShown = (el) => {
                        if (!el) return false;
                        const s = window.getComputedStyle(el);
                        return (el.offsetParent !== null || s.display !== 'none' || el.classList.contains('show')) &&
                               s.visibility !== 'hidden' && (el.offsetWidth > 0 || el.offsetHeight > 0);
                    };

                    const visibleModals = Array.from(document.querySelectorAll('.modal, div[role="dialog"]')).filter(isShown);
                    if (visibleModals.length === 0) {
                        const dobInp = document.querySelector('input[formcontrolname="dateOfBirth"]');
                        const addMemBtn = Array.from(document.querySelectorAll('button')).find(b => (b.innerText || '').includes('உறுப்பினரை சேர்க்க'));
                        if (isShown(dobInp) || isShown(addMemBtn)) {
                            return 'ALREADY_VERIFIED_ON_PORTAL';
                        }
                    }

                    for (const modal of visibleModals) {
                        const candidates = Array.from(
                            modal.querySelectorAll('input:not([disabled]):not([readonly]):not([type="hidden"])')
                        );
                        for (const inp of candidates) {
                            const fcn = (inp.getAttribute('formcontrolname') || inp.name || inp.id || '').toLowerCase();
                            const tp = (inp.type || '').toLowerCase();
                            if (tp === 'checkbox' || tp === 'radio' || tp === 'button' || tp === 'submit') continue;
                            if ((fcn.includes('mob') && !fcn.includes('otp')) || inp.getAttribute('maxlength') === '10') continue;

                            const val = (inp.value || '').replace(/\D/g, '');
                            if (val.length === targetDigits) {
                                inp.dispatchEvent(new Event('input', { bubbles: true }));
                                inp.dispatchEvent(new Event('change', { bubbles: true }));
                                inp.dispatchEvent(new Event('blur', { bubbles: true }));
                                return val;
                            }
                        }
                    }
                    return null;
                }, expectedLen).catch(() => null);

                if (domDetected) {
                    if (typeof sharedContext.provideOtp === 'function' && domDetected !== 'ALREADY_VERIFIED_ON_PORTAL') {
                        try { sharedContext.provideOtp(domDetected); } catch (_) {}
                    }
                    return finish(domDetected);
                }
            } catch (_) {}
        }, 400);
    });
}

module.exports = {
    NEW_CARD_OTP_CONFIG,
    isValidNewCardMobileOtp,
    isValidNewCardAadhaarOtp,
    waitForNewCardMobileOtp
};
