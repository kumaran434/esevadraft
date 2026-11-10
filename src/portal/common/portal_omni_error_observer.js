// ============================================================================
// eSevaDraft Portal Omni-Error Observer & Real-Time Telemetry Sentinel
// Strictly Modular (< 300 lines) | Zero-Monolith Law
// Enforces 100% DOM, Dialog, Network, and Countdown Error Transparency
// ============================================================================

const fs = require('fs');
const path = require('path');

class PortalOmniErrorObserver {
    constructor(page, options = {}) {
        this.page = page;
        this.onProgress = options.onProgress || console.log;
        this.logDiag = options.logDiag || (() => {});
        this.seenMessages = new Set();
        this.lastError = null;
        this.activePollingInterval = null;
        this.isDestroyed = false;
        this.telemetryDir = options.telemetryDir || path.join(process.cwd(), 'data', 'telemetry');
        
        try {
            fs.mkdirSync(this.telemetryDir, { recursive: true });
        } catch (_) {}
    }

    /**
     * Attaches all native browser-level listeners (Dialogs, Network failures, Console errors)
     */
    attachBrowserListeners() {
        if (!this.page || this.page.isClosed()) return;

        // 1. Native JavaScript Dialogs (alert, confirm, prompt) — OBSERVE ONLY.
        // Never auto-accept: accepting a TNPDS confirm() (e.g. exit prompt) could navigate away.
        this._onDialog = async (dialog) => {
            if (this.isDestroyed) return;
            const msg = (dialog.message() || '').trim();
            this.broadcastError(`[Browser Dialog ${dialog.type().toUpperCase()}] ${msg}`);
            // If we are the only listener, mimic Playwright's default (auto-dismiss) so the page never hangs.
            try {
                if (this.page.listenerCount && this.page.listenerCount('dialog') === 1) await dialog.dismiss().catch(() => {});
            } catch (_) {}
        };
        this.page.on('dialog', this._onDialog);

        // 2. Unhandled Page JS Exceptions
        this._onPageError = (err) => {
            const msg = err.message || String(err);
            if (!msg.includes('Permissions policy') && !msg.includes('recaptcha')) {
                this.broadcastError(`[Page JavaScript Exception] ${msg}`);
            }
        };
        this.page.on('pageerror', this._onPageError);

        // 3. Backend API Response Failures (HTTP 4xx, 5xx, or JSON errors)
        this._onResponse = async (response) => {
            if (this.isDestroyed) return;
            try {
                const url = response.url();
                const status = response.status();
                if (!url.includes('tnpds.gov.in') && !url.includes('tnega.tn.gov.in')) return;

                if (status >= 400) {
                    let errBody = '';
                    try { errBody = await response.text(); } catch (_) {}
                    const cleanBody = errBody.substring(0, 150).replace(/\s+/g, ' ');
                    this.broadcastError(`[Govt API Error ${status}] URL: ${url} | Response: ${cleanBody}`);
                    return;
                }

                // Check JSON responses for explicit failure messages
                const contentType = response.headers()['content-type'] || '';
                if (contentType.includes('application/json') && (url.includes('otp') || url.includes('member') || url.includes('card') || url.includes('validate') || url.includes('save'))) {
                    try {
                        const json = await response.json();
                        if (json && (json.status === 'FAIL' || json.statusCode === -1 || json.valid === false || json.error)) {
                            const errDesc = json.message || json.error || json.statusMessage || JSON.stringify(json);
                            this.broadcastError(`[Govt API Failure Response] URL: ${url} | Message: ${errDesc}`);
                        }
                    } catch (_) {}
                }
            } catch (_) {}
        };
        this.page.on('response', this._onResponse);
    }

    detachBrowserListeners() {
        if (!this.page) return;
        try { if (this._onDialog) this.page.off('dialog', this._onDialog); } catch (_) {}
        try { if (this._onPageError) this.page.off('pageerror', this._onPageError); } catch (_) {}
        try { if (this._onResponse) this.page.off('response', this._onResponse); } catch (_) {}
    }

    /**
     * Broadcasts and records any observed error across UI, Session Log, and Disk
     */
    broadcastError(rawMessage) {
        if (!rawMessage || this.isDestroyed) return;
        const msg = String(rawMessage).trim();
        if (msg.length < 3 || this.seenMessages.has(msg)) return;

        this.seenMessages.add(msg);
        this.lastError = { message: msg, timestamp: Date.now() };

        // 1. Emit to active progress listener
        this.onProgress(`🚨 **[அரசு போர்ட்டல் பிழை / Portal Alert]:**\n"${msg}"`);

        // 2. Log to diagnostic telemetry
        this.logDiag(0, 'portal_error', msg);

        // 3. Save to disk persistent incident file
        try {
            const errPath = path.join(this.telemetryDir, 'last_portal_error.json');
            fs.writeFileSync(errPath, JSON.stringify({
                message: msg,
                url: this.page ? this.page.url() : 'unknown',
                time: new Date().toISOString()
            }, null, 2), 'utf8');
        } catch (_) {}
    }

    /**
     * Scans the active DOM for all error alerts, toasts, tooltips, validation tags, and countdown status
     */
    async scanDomErrors() {
        if (!this.page || this.page.isClosed() || this.isDestroyed) {
            return { hasErrors: false, errors: [], timerRemaining: null, isTimerExpired: false };
        }

        try {
            const domState = await this.page.evaluate(() => {
                const results = {
                    errors: [],
                    timerRemaining: null,
                    isTimerExpired: false,
                    modalTitle: '',
                    isModalVisible: false,
                    isSubmitDisabled: false,
                    typedOtp: ''
                };

                // 1. Check all visible modals & countdown timer
                const modals = Array.from(document.querySelectorAll('.modal.show, div.modal[style*="display: block"], div[role="dialog"]:not([style*="display: none"]), .modal-dialog, .modal'));
                const visibleModal = modals.find(m => m.offsetParent !== null || window.getComputedStyle(m).display !== 'none');
                
                if (visibleModal) {
                    results.isModalVisible = true;
                    const mText = (visibleModal.innerText || visibleModal.textContent || '').trim();
                    
                    // Match Tamil / English timer: "மீதமுள்ள : 45 நொடிகள்" or "Remaining : 0 seconds"
                    const timerMatch = mText.match(/(?:மீதமுள்ள|remaining)\s*:\s*(\d+)\s*(?:நொடிகள்|seconds|s)/i);
                    if (timerMatch) {
                        results.timerRemaining = parseInt(timerMatch[1], 10);
                        if (results.timerRemaining === 0) {
                            results.isTimerExpired = true;
                        }
                    } else if (mText.includes('0 நொடிகள்') || mText.includes('0 seconds') || mText.includes('காலாவதி')) {
                        results.isTimerExpired = true;
                        results.timerRemaining = 0;
                    }

                    // Check submit button state inside modal
                    const subBtn = Array.from(visibleModal.querySelectorAll('button')).find(b => {
                        const t = (b.innerText || '');
                        return t.includes('பதிவு செய்') || t.includes('Verify');
                    }) || visibleModal.querySelector('button[type="submit"]');
                    if (subBtn) {
                        results.isSubmitDisabled = subBtn.disabled || subBtn.getAttribute('aria-disabled') === 'true' || subBtn.classList.contains('disabled');
                    }

                    // Check OTP input value inside modal
                    const otpInp = visibleModal.querySelector('input[formcontrolname*="otp" i], input[placeholder*="OTP" i], input');
                    if (otpInp) {
                        results.typedOtp = (otpInp.value || '').replace(/\D/g, '');
                    }
                }

                // 2. Check PrimeNG Toasts, Alerts, SweetAlerts, and Danger Banners
                const errorSelectors = [
                    '.p-toast-detail',
                    '.p-toast-summary',
                    '.p-toast-message',
                    '.toast-message',
                    '.alert-danger',
                    '.alert-warning',
                    '.swal2-html-container',
                    '.swal2-title',
                    '.mat-snack-bar-container',
                    '.invalid-feedback',
                    '.text-danger',
                    '.error-msg',
                    'div[role="alert"]'
                ];

                const candidateNodes = Array.from(document.querySelectorAll(errorSelectors.join(', ')));
                for (const el of candidateNodes) {
                    if (el.offsetParent === null && window.getComputedStyle(el).display === 'none') continue;
                    const txt = (el.innerText || el.textContent || '').trim();
                    if (!txt || txt.length < 3) continue;

                    // Filter out harmless status messages
                    if (txt.includes('அனுப்பப்பட்டுள்ளது') || txt.includes('கைபேசி கடவுச்சொல்லை உள்ளிடவும்') || txt.includes('OTP sent successfully')) {
                        continue;
                    }

                    // Identify genuine errors
                    const isKnownError = 
                        txt.includes('ஏற்கனவே உள்ளது') ||
                        txt.includes('ஏற்கனவே பதிவு') ||
                        txt.includes('தவறான') ||
                        txt.includes('செல்லாது') ||
                        txt.includes('காலாவதி') ||
                        txt.includes('தவறு') ||
                        txt.includes('தோல்வி') ||
                        txt.includes('failed') ||
                        txt.includes('invalid') ||
                        txt.includes('already exists') ||
                        txt.includes('expired') ||
                        txt.includes('error');

                    if (isKnownError) {
                        results.errors.push(txt);
                    }
                }

                return results;
            }).catch(() => null);

            if (!domState) return { hasErrors: false, errors: [], timerRemaining: null, isTimerExpired: false };

            // Broadcast any newly discovered errors
            if (domState.errors && domState.errors.length > 0) {
                for (const err of domState.errors) {
                    this.broadcastError(err);
                }
            }

            // Broadcast timer expiry
            if (domState.isTimerExpired && !this.seenMessages.has('TIMER_EXPIRED')) {
                this.seenMessages.add('TIMER_EXPIRED');
                this.broadcastError('⚠️ [OTP காலாவதி] 120 விநாடிகள் முடிந்துவிட்டது (0 நொடிகள்)! பழைய OTP செல்லாது, புதிய OTP உருவாக்கப்பட வேண்டும்.');
            }

            return {
                hasErrors: domState.errors.length > 0,
                errors: domState.errors,
                timerRemaining: domState.timerRemaining,
                isTimerExpired: domState.isTimerExpired,
                isSubmitDisabled: domState.isSubmitDisabled,
                typedOtp: domState.typedOtp,
                isModalVisible: domState.isModalVisible
            };
        } catch (_) {
            return { hasErrors: false, errors: [], timerRemaining: null, isTimerExpired: false };
        }
    }

    /**
     * Starts background polling for DOM errors every 300ms
     */
    startContinuousPolling(intervalMs = 300) {
        if (this.activePollingInterval) clearInterval(this.activePollingInterval);
        this.activePollingInterval = setInterval(async () => {
            if (this.isDestroyed || !this.page || this.page.isClosed()) {
                this.stopContinuousPolling();
                return;
            }
            await this.scanDomErrors();
        }, intervalMs);
    }

    stopContinuousPolling() {
        if (this.activePollingInterval) {
            clearInterval(this.activePollingInterval);
            this.activePollingInterval = null;
        }
    }

    destroy() {
        this.isDestroyed = true;
        this.stopContinuousPolling();
        this.detachBrowserListeners();
    }
}

/**
 * Factory function to attach observer and immediately begin monitoring
 */
function createPortalErrorObserver(page, options = {}) {
    const observer = new PortalOmniErrorObserver(page, options);
    observer.attachBrowserListeners();
    observer.startContinuousPolling(350);
    return observer;
}

module.exports = {
    PortalOmniErrorObserver,
    createPortalErrorObserver
};
