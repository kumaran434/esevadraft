// ============================================================================
// eSevaDraft Universal Dual-Listener OTP Handshake Engine
// Common standard across ALL government portals (TNPDS, TNeGA, NVSP, Revenue)
// Universal Law: Operator/Citizen may enter OTP in Chat/UI OR directly in Chrome.
// Listens on 3 Channels simultaneously with Early Memory & Anti-Collision (< 300 lines)
// ============================================================================

const fs = require('fs');
const path = require('path');

class UniversalOtpListener {
    constructor(options = {}) {
        this.cachedOtp = '';
        this.cachedTimestamp = 0;
        this.isWaiting = false;
        this.currentOtpType = 'otp';
        this.activeResolver = null;
        this.activePage = options.page || null;
        this.dataDir = options.dataDir || path.join(process.cwd(), 'data');
    }

    setPage(page) {
        this.activePage = page;
    }

    /**
     * Caches OTP if operator enters it before the portal input field appears on screen.
     */
    cacheEarlyOtp(otp) {
        if (!otp) return;
        const clean = String(otp).replace(/\D/g, '');
        if (clean.length >= 6 && clean.length <= 8) {
            this.cachedOtp = clean;
            this.cachedTimestamp = Date.now();
        }
    }

    /**
     * Resolves OTP through UI/Chat channel
     */
    resolveFromChat(otpValue) {
        if (typeof this.activeResolver === 'function') {
            this.activeResolver(String(otpValue).trim(), 'chat');
            return true;
        }
        this.cacheEarlyOtp(otpValue);
        return false;
    }

    /**
     * Core Promise: Waits for OTP across all 3 Channels concurrently:
     * Channel 1: UI / Chat input
     * Channel 2: Real Google Chrome website DOM listener
     * Channel 3: Disk IPC (pending_otp.txt) / SMS Webhook
     */
    waitForOtp(promptMsg, onProgress = () => {}, otpType = 'otp', options = {}) {
        // 1. Check early cached OTP within 30 seconds
        if (this.cachedOtp && (Date.now() - this.cachedTimestamp) < 30000) {
            const early = this.cachedOtp;
            this.cachedOtp = '';
            onProgress(`🔑 [e-Seva] நீங்கள் உள்ளிட்ட OTP (${early}) ஏற்றுக்கொள்ளப்பட்டு அரசு போர்ட்டலில் செலுத்தப்படுகிறது...`);
            return Promise.resolve(early);
        }

        // 2. Fast CI Test Gate
        const isCiTest = options.fastTest === true || process.env.REGRESSION_TEST === 'true';
        if (isCiTest && options.isMock) {
            return Promise.resolve('123456');
        }

        this.isWaiting = true;
        this.currentOtpType = otpType;

        return new Promise((resolve) => {
            onProgress(promptMsg);

            let timer = null;
            let isResolved = false;
            const startTime = Date.now();

            let errorObserver = null;
            const cleanupAndFinish = (val, source) => {
                if (isResolved) return;
                isResolved = true;
                if (timer) clearInterval(timer);
                if (errorObserver) {
                    try { errorObserver.destroy(); } catch (_) {}
                    errorObserver = null;
                }
                this.isWaiting = false;
                this.activeResolver = null;

                if (source === 'portal') {
                    if (val === 'ALREADY_VERIFIED_ON_PORTAL') {
                        onProgress('⚡ [Dual Listener] நிஜ அரசு குரோம் பிரவுசரிலேயே நேரடியாக OTP உள்ளிட்டு உறுதி செய்யப்பட்டுவிட்டது! ஆட்டோமேஷன் தானாகத் தொடர்கிறது...');
                    } else {
                        onProgress(`⚡ [Dual Listener] நிஜ அரசு குரோம் பிரவுசரிலேயே நேரடியாக OTP (${val}) உள்ளிட்டுவிட்டார்! ஆட்டோமேஷன் தானாகத் தொடர்கிறது...`);
                    }
                }
                resolve(val);
            };

            // Channel 1: Resolver callback from Chat / REST API
            this.activeResolver = (val, src) => cleanupAndFinish(val, src || 'chat');

            // Channel 2 & 3: Chrome DOM & Disk IPC watcher
            const page = this.activePage;
            if (page && !page.isClosed()) {
                try {
                    const { createPortalErrorObserver } = require('./portal_omni_error_observer');
                    errorObserver = createPortalErrorObserver(page, { onProgress });
                } catch (_) {}

                timer = setInterval(async () => {
                    if (isResolved || !page || page.isClosed()) {
                        if (timer) clearInterval(timer);
                        if (errorObserver) { try { errorObserver.destroy(); } catch (_) {} errorObserver = null; }
                        return;
                    }
                    try {
                        // Check if errorObserver caught timer expiration
                        if (errorObserver && errorObserver.lastError && errorObserver.lastError.message.includes('0 நொடிகள்')) {
                            // Expired notice already logged by observer
                        }
                        // Channel 3: Disk IPC check
                        const ipcPath = path.join(this.dataDir, 'pending_otp.txt');
                        if (fs.existsSync(ipcPath)) {
                            try {
                                const st = fs.statSync(ipcPath);
                                if (st.mtimeMs >= (startTime - 5000)) {
                                    const diskOtp = fs.readFileSync(ipcPath, 'utf8').trim().replace(/\D/g, '');
                                    if (diskOtp.length >= 6 && diskOtp.length <= 8) {
                                        try { fs.unlinkSync(ipcPath); } catch (_) {}
                                        cleanupAndFinish(diskOtp, 'portal');
                                        return;
                                    }
                                }
                            } catch (_) {}
                        }

                        // Channel 2: Inspect Chrome DOM
                        const detected = await page.evaluate((type) => {
                            const u = window.location.href.toLowerCase();

                            const isLoginPage = (type === 'login_otp' || u.includes('/auth/login')) && type !== 'aadhaar_otp';
                            const isAadhaarOtp = (type === 'aadhaar_otp');

                            // Priority 0: Handle non-modal login page directly
                            if (isLoginPage) {
                                const isPastLogin = !u.includes('/auth/login') && !u.includes('newsmartcard') && (
                                    u.includes('/dashboard') ||
                                    u.includes('/cardmaintenance') ||
                                    Boolean(document.querySelector('#btnLogout, a[href*="logout"], .user-profile, .logged-user'))
                                );
                                if (isPastLogin) return 'ALREADY_VERIFIED_ON_PORTAL';

                                const isSubmitting = Boolean(
                                    document.querySelector('.subbtn[disabled]:not(#btnSendOtp), .spinner-border, .loading')
                                );
                                if (isSubmitting) return 'ALREADY_VERIFIED_ON_PORTAL';

                                const inputs = Array.from(document.querySelectorAll('input[placeholder*="OTP" i], input[formcontrolname*="otp" i], #otp, input[placeholder*="கடவுச்சொல்"]'));
                                for (const inp of inputs) {
                                    if (inp.disabled || inp.readOnly) continue;
                                    const val = (inp.value || '').replace(/\D/g, '');
                                    // TNPDS login SMS OTP is strictly 7 digits! Never truncate at 6 digits.
                                    if (val.length === 7 || val.length > 7) {
                                        return val.slice(0, 7);
                                    }
                                }
                                return null;
                            }

                                // Auto-dismiss accidental exit modal immediately
                                const exitModals = Array.from(document.querySelectorAll('.modal, div[role="dialog"]'));
                                for (const m of exitModals) {
                                    const txt = (m.innerText || '').trim();
                                    if (txt.includes('வெளியேற விரும்புகிறீர்களா') || txt.includes('நீங்கள் வெளியேற')) {
                                        const noBtn = Array.from(m.querySelectorAll('button, a')).find(b => {
                                            const bt = (b.innerText || '').trim();
                                            return bt === 'இல்லை' || bt === 'No' || bt.includes('இல்லை');
                                        });
                                        if (noBtn) noBtn.click();
                                    }
                                }

                                // 0. Check if post-OTP stage is genuinely unlocked (e.g., Member section visible)
                                const dobInp = document.querySelector('input[formcontrolname="dateOfBirth"]');
                                const isDobVisible = dobInp && (dobInp.offsetParent !== null || window.getComputedStyle(dobInp).display !== 'none');
                                const addMemBtn = Array.from(document.querySelectorAll('button')).find(b => (b.innerText || '').includes('உறுப்பினரை சேர்க்க'));
                                const isAddMemVisible = addMemBtn && (addMemBtn.offsetParent !== null || window.getComputedStyle(addMemBtn).display !== 'none');
                                if (isDobVisible || isAddMemVisible) {
                                    return 'ALREADY_VERIFIED_ON_PORTAL';
                                }

                                // 1. Inspect any visible modal inputs strictly
                                const allModals = Array.from(document.querySelectorAll('.modal, div[role="dialog"]'));
                                const visibleModals = allModals.filter(m => (m.offsetParent !== null || window.getComputedStyle(m).display !== 'none') && (m.offsetWidth > 0 || m.offsetHeight > 0));
                                const isModalOpen = visibleModals.length > 0;
                                for (const modal of visibleModals) {
                                    const modalInputs = Array.from(modal.querySelectorAll('input:not([disabled])'));
                                    for (const inp of modalInputs) {
                                        if (inp.disabled || inp.readOnly) continue;
                                        const fn = (inp.getAttribute('formcontrolname') || '').toLowerCase();
                                        if (isAadhaarOtp && fn.includes('aadhaar') && !fn.includes('otp')) continue;
                                        const val = (inp.value || '').replace(/\D/g, '');
                                        if (isAadhaarOtp) {
                                            if (val.length === 6) return val;
                                        } else {
                                            if (val.length === 7 || val.length === 6) return val;
                                        }
                                    }
                                }

                                // 2. Fallback check on main page
                                const inputs = Array.from(document.querySelectorAll('input[placeholder*="OTP" i], input[formcontrolname*="otp" i], #otp, input[placeholder*="கடவுச்சொல்"]'));
                                for (const inp of inputs) {
                                    if (inp.disabled || inp.readOnly) continue;
                                    const val = (inp.value || '').replace(/\D/g, '');
                                    if (val.length === 6 || val.length === 7) {
                                        return val;
                                    }
                                }
                                return null;
                            }, otpType).catch(() => null);

                        if (detected) {
                            cleanupAndFinish(detected, 'portal');
                        }
                    } catch (_) {}
                }, 500);
            }
        });
    }
}

module.exports = {
    UniversalOtpListener
};
