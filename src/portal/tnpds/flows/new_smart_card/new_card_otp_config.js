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
const {
    installOtpModalCopilot,
    tryCopilotAutoResendIfExpired
} = require('../../../common/otp_copilot_watcher');

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

function isNewCardMobileVerifiedInDomCode() {
    // Runs inside page.evaluate() — strict check against TNPDS Angular template (isMobileVerified + showMobileNoEditButton)
    return (() => {
        const isShown = (el) => {
            if (!el) return false;
            const s = window.getComputedStyle(el);
            return (el.offsetParent !== null || s.display !== 'none' || el.classList.contains('show')) &&
                   s.visibility !== 'hidden' && (el.offsetWidth > 0 || el.offsetHeight > 0);
        };
        const visOtpModals = Array.from(document.querySelectorAll('.modal, div[role="dialog"]')).filter(m => {
            if (!isShown(m)) return false;
            const t = (m.innerText || '');
            return t.includes('OTP') || t.includes('கடவுச்சொல்');
        });
        if (visOtpModals.length > 0) return false;

        const hasGenOtpBtn = Array.from(document.querySelectorAll('button')).some(b => {
            if (!isShown(b)) return false;
            const t = (b.innerText || '').trim().toLowerCase();
            return t.includes('otp ஐ உருவாக்கு') || t.includes('generate otp');
        });
        if (hasGenOtpBtn) return false;

        const mobInp = document.querySelector('input[formcontrolname="mobileNumber"]');
        const mobDisabled = Boolean(mobInp && mobInp.disabled);
        const mobSection = mobInp ? (mobInp.closest('.row, .form-group, div') || mobInp.parentElement) : null;
        const scope = (mobSection && mobSection.parentElement) || document;
        const hasEditBtn = Array.from(scope.querySelectorAll('button')).some(b => {
            if (!isShown(b)) return false;
            const t = (b.innerText || '').trim();
            return t === 'திருத்தம்' || /^edit$/i.test(t);
        });
        const hasTickImg = Boolean(mobSection && mobSection.querySelector('img'));
        return Boolean(mobInp && (mobDisabled || hasEditBtn || hasTickImg));
    })();
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
    await installOtpModalCopilot(page, { forceReset: false, allowInlinePage: false }).catch(() => {});

    const pendingOtpPaths = [
        path.join(process.cwd(), 'data', 'pending_otp.txt'),
        path.join(process.env.APPDATA || '', 'esevadraft-desktop', 'data', 'pending_otp.txt'),
        path.join(process.env.APPDATA || '', 'esevadraft-desktop', 'pending_otp.txt')
    ];

    return new Promise((resolve) => {
        let settled = false;
        let pollTimer = null;
        let isTickRunning = false;
        let closedUnverifiedTicks = 0;
        const seenToasts = new Set();

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

        // Dedicated New Ration Card 6-digit Chrome Modal, Resend Co-Pilot & Disk IPC poller
        pollTimer = setInterval(async () => {
            if (settled || isTickRunning) return;
            if (!page || page.isClosed()) {
                return finish('CLOSED');
            }
            isTickRunning = true;

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

                    const visibleModals = Array.from(document.querySelectorAll('.modal, div[role="dialog"]')).filter(m => {
                        if (!isShown(m)) return false;
                        const t = (m.innerText || '');
                        return !t.includes('வெளியேற விரும்புகிறீர்களா') && !t.includes('நீங்கள் வெளியேற');
                    });
                    if (visibleModals.length === 0) {
                        const hasGenOtpBtn = Array.from(document.querySelectorAll('button')).some(b => {
                            if (!isShown(b)) return false;
                            const t = (b.innerText || '').trim().toLowerCase();
                            return t.includes('otp ஐ உருவாக்கு') || t.includes('generate otp');
                        });
                        const mobInp = document.querySelector('input[formcontrolname="mobileNumber"]');
                        const mobDisabled = Boolean(mobInp && mobInp.disabled);
                        const mobWrap = mobInp ? (mobInp.closest('.row, .form-group, div')?.parentElement || document) : document;
                        const hasMobEditBtn = Array.from(mobWrap.querySelectorAll('button')).some(b => {
                            if (!isShown(b)) return false;
                            const t = (b.innerText || '').trim();
                            return t === 'திருத்தம்' || /^edit$/i.test(t);
                        });
                        const hasTickImg = Boolean(mobInp && mobInp.parentElement && mobInp.parentElement.parentElement && mobInp.parentElement.parentElement.querySelector('img'));
                        // STRICT GATE: ONLY verified if "OTP ஐ உருவாக்கு" disappeared AND mobile is disabled / "திருத்தம்" / tick icon is present!
                        // NEVER treat "உறுப்பினரை சேர்க்க" button as verified (it is always visible on page!).
                        if (mobInp && !hasGenOtpBtn && (mobDisabled || hasMobEditBtn || hasTickImg)) {
                            return 'ALREADY_VERIFIED_ON_PORTAL';
                        }
                        if (mobInp && hasGenOtpBtn) {
                            return '__MODAL_CLOSED_UNVERIFIED__';
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

                if (domDetected === '__MODAL_CLOSED_UNVERIFIED__') {
                    closedUnverifiedTicks++;
                    if (closedUnverifiedTicks >= 4) {
                        onProgress('⚠️ [படி 20/51] மொபைல் OTP சாளரம் சரிபார்க்கப்படாமல் மூடப்பட்டுவிட்டது (OTP Verify ஆகவில்லை).');
                        return finish('MODAL_CLOSED_UNVERIFIED');
                    }
                } else {
                    closedUnverifiedTicks = 0;
                    if (domDetected) {
                        if (typeof sharedContext.provideOtp === 'function' && domDetected !== 'ALREADY_VERIFIED_ON_PORTAL') {
                            try { sharedContext.provideOtp(domDetected); } catch (_) {}
                        }
                        return finish(domDetected);
                    }
                }

                // 3. Capture transient ngx-toastr / PrimeNG portal alerts during OTP wait so errors never go silent
                const liveToasts = await page.evaluate(() => {
                    return Array.from(document.querySelectorAll('#toast-container .toast, .toast-message, .p-toast-message, .alert-danger'))
                        .map(el => ({
                            cls: (el.className || '').toString(),
                            text: (el.innerText || '').trim().replace(/\s+/g, ' ')
                        }))
                        .filter(t => t.text.length > 3);
                }).catch(() => []);
                for (const t of liveToasts) {
                    if (!seenToasts.has(t.text)) {
                        seenToasts.add(t.text);
                        const isErr = /error|danger|முடிந்து|பிழை|தவற|வரம்பு|failed|invalid/i.test(t.cls + ' ' + t.text);
                        onProgress(isErr ? `🚨 [அரசு TNPDS அறிவிப்பு]: ${t.text}` : `ℹ️ [அரசு TNPDS அறிவிப்பு]: ${t.text}`);
                    }
                }

                // 4. Co-Pilot Single-Click Resend when initial Mobile OTP countdown expires (and human did not click Resend)
                await tryCopilotAutoResendIfExpired(page, {
                    allowInlinePage: false,
                    graceAfterZeroMs: 4000,
                    maxAutoResends: 2,
                    onProgress,
                    showBrowserHud: sharedContext.showBrowserHud,
                    clearStaleOtpState: sharedContext.clearStaleOtpState,
                    stageLabel: 'படி 20/51 மொபைல் OTP'
                });
            } catch (_) {} finally {
                isTickRunning = false;
            }
        }, 450);
    });
}

module.exports = {
    NEW_CARD_OTP_CONFIG,
    isValidNewCardMobileOtp,
    isValidNewCardAadhaarOtp,
    isNewCardMobileVerifiedInDomCode,
    waitForNewCardMobileOtp
};
