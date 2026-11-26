/**
 * Universal Operator Co-Pilot Watcher for Government OTP Modals & Inline OTP Pages.
 *
 * Ensures seamless human + bot collaboration inside Chrome across ALL services:
 * - Supports both Bootstrap/PrimeNG OTP modals AND inline page OTP screens (/auth/login, TNeGA).
 * - Tracks human (isTrusted) clicks on Resend / Submit buttons and Enter key presses.
 * - Never clicks Submit twice if the operator already clicked Submit in Chrome.
 * - Never clicks Resend automatically once the operator takes manual Resend control
 *   (or while timer > 0, or while operator is typing, or while Resend button is disabled/hidden).
 * - Guarantees strictly ONE atomic Resend click per timer expiration cycle (even across
 *   decreasing timers like 120s -> 60s -> 45s -> 30s and slow server API responses).
 */

const activeResendPageLocks = new WeakSet();
const trackerByPage = new WeakMap();

async function installOtpModalCopilot(page, options = {}) {
    if (!page || page.isClosed()) return;
    const { forceReset = false, allowInlinePage = true } = options;
    await page.evaluate(({ forceResetFlag, allowInline }) => {
        const isVisEl = (m) => {
            if (!m) return false;
            const s = window.getComputedStyle(m);
            return (m.offsetParent !== null || s.display !== 'none' || m.classList.contains('show') || m.classList.contains('in') || m.classList.contains('d-block')) &&
                s.visibility !== 'hidden' &&
                !m.classList.contains('hidden');
        };

        const detectActiveContainerTag = () => {
            const modals = Array.from(document.querySelectorAll('.modal, div[role="dialog"], .modal-dialog'));
            for (let i = modals.length - 1; i >= 0; i--) {
                const m = modals[i];
                if (!isVisEl(m)) continue;
                const txt = (m.innerText || '');
                if (txt.includes('வெளியேற விரும்புகிறீர்களா') || txt.includes('நீங்கள் வெளியேற')) continue;
                const hasOtpHint = Boolean(m.querySelector('input[formcontrolname*="otp" i], input#otp, input[name*="otp" i], input[placeholder*="OTP" i], input[placeholder*="கடவுச்சொல்" i]')) ||
                    txt.includes('OTP') || txt.includes('கடவுச்சொல்');
                if (hasOtpHint) {
                    if (!m.__esevaCopilotTag) {
                        m.__esevaCopilotTag = `modal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
                    }
                    return m.__esevaCopilotTag;
                }
            }
            if (allowInline) {
                const inlineInp = Array.from(document.querySelectorAll(
                    'input[formcontrolname*="otp" i], input[name*="otp" i], input#otp, input#txtOTP, input[placeholder*="OTP" i], input[placeholder*="கடவுச்சொல்" i]'
                )).find(inp => !inp.disabled && !inp.readOnly && (inp.offsetWidth > 0 || inp.offsetHeight > 0));
                if (inlineInp) {
                    const host = inlineInp.closest('form, .card, .login-box, .auth-box, table, section') || document.body;
                    if (!host.__esevaCopilotTag) {
                        host.__esevaCopilotTag = `inline_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
                    }
                    return host.__esevaCopilotTag;
                }
            }
            return '';
        };

        const currentTag = detectActiveContainerTag();
        const resetCounters = (cp, tag) => {
            cp.activeContainerTag = tag || '';
            cp.humanResendAt = 0;
            cp.humanResendCount = 0;
            cp.humanSubmitAt = 0;
            cp.humanSubmittedOtp = '';
            cp.lastHumanTypeAt = 0;
            cp.timerZeroSinceAt = 0;
            cp.resendUnlockedSinceAt = 0;
            cp.sawResendDisabled = false;
            cp.sawPositiveTimer = false;
            cp.botResendAt = 0;
            cp.botResendCount = 0;
            cp.botResendInFlightUntil = 0;
            cp.botResendCyclePendingReset = false;
            cp.botClickingResendNow = false;
        };

        if (!window.__esevaOtpCopilot) {
            window.__esevaOtpCopilot = {};
            resetCounters(window.__esevaOtpCopilot, currentTag);
        } else if (forceResetFlag || (currentTag && window.__esevaOtpCopilot.activeContainerTag && window.__esevaOtpCopilot.activeContainerTag !== currentTag)) {
            resetCounters(window.__esevaOtpCopilot, currentTag);
        } else if (currentTag && !window.__esevaOtpCopilot.activeContainerTag) {
            window.__esevaOtpCopilot.activeContainerTag = currentTag;
        }

        if (window.__esevaOtpCopilotBound) return;
        window.__esevaOtpCopilotBound = true;

        const isResendControl = (btn) => {
            if (!btn) return false;
            const txt = (btn.innerText || btn.value || btn.textContent || '').trim().toLowerCase();
            const bId = (btn.id || '').toLowerCase();
            if (bId === 'btnsendotp') return false;
            if (txt.includes('ரத்து') || txt.includes('cancel') || txt.includes('close') || txt.includes('இல்லை') || txt.includes('பின்செல்') || txt.includes('back')) {
                return false;
            }
            if (txt.includes('மீண்டும் முயற்சி') || txt.includes('மீண்டும் தொடங்க')) return false;
            return txt.includes('மீண்டும் அனுப்') || txt.includes('மீண்டும்') || txt.includes('மறுமுறை') || txt.includes('resend') || txt.includes('re-generate') || bId.includes('resend');
        };

        const findOtpContainerForNode = (el) => {
            if (!el) return null;
            const modal = el.closest ? el.closest('.modal, div[role="dialog"], .modal-dialog') : null;
            if (modal && isVisEl(modal)) return modal;
            const host = el.closest ? el.closest('form, .card, .login-box, .auth-box, table, section') : null;
            if (host && host.querySelector('input[formcontrolname*="otp" i], input[name*="otp" i], input#otp, input#txtOTP, input[placeholder*="OTP" i], input[placeholder*="கடவுச்சொல்" i]')) {
                return host;
            }
            if (document.querySelector('input[formcontrolname*="otp" i], input[name*="otp" i], input#otp, input#txtOTP, input[placeholder*="OTP" i], input[placeholder*="கடவுச்சொல்" i]')) {
                return document.body;
            }
            return null;
        };

        document.addEventListener('click', (e) => {
            if (!e.isTrusted) return;
            if (window.__esevaOtpCopilot && window.__esevaOtpCopilot.botClickingResendNow) return;
            const btn = e.target && e.target.closest ? e.target.closest('button, input[type="submit"], input[type="button"], a.btn, a, [role="button"]') : null;
            if (!btn) return;
            const container = findOtpContainerForNode(btn);
            if (!container) return;

            const txt = (btn.innerText || btn.value || btn.textContent || '').trim().toLowerCase();
            const cls = (btn.className || '').toLowerCase();

            if (isResendControl(btn)) {
                window.__esevaOtpCopilot.humanResendAt = Date.now();
                window.__esevaOtpCopilot.humanResendCount += 1;
                window.__esevaOtpCopilot.humanSubmitAt = 0;
                window.__esevaOtpCopilot.humanSubmittedOtp = '';
                window.__esevaOtpCopilot.timerZeroSinceAt = 0;
                window.__esevaOtpCopilot.resendUnlockedSinceAt = 0;
                window.__esevaOtpCopilot.botResendCyclePendingReset = true;
                return;
            }

            if (txt.includes('ரத்து') || txt.includes('cancel') || txt.includes('close') || txt.includes('இல்லை')) {
                return;
            }

            if (
                txt.includes('சமர்ப்பி') ||
                txt.includes('பதிவு செய்') ||
                txt.includes('உள்நுழைக') ||
                txt.includes('submit') ||
                txt.includes('verify') ||
                txt.includes('confirm') ||
                txt.includes('login') ||
                txt.includes('சரிபார்') ||
                cls.includes('btn-success') ||
                cls.includes('subbtn') ||
                btn.type === 'submit'
            ) {
                const inp = container.querySelector('input[formcontrolname="mobileOtp"], input[formcontrolname="otp"], input#otp, input#txtOTP, input[name*="otp" i], input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([readonly]):not([disabled])');
                const val = inp ? String(inp.value || '').replace(/\D/g, '') : '';
                window.__esevaOtpCopilot.humanSubmitAt = Date.now();
                window.__esevaOtpCopilot.humanSubmittedOtp = val;
            }
        }, true);

        document.addEventListener('input', (e) => {
            if (!e.isTrusted) return;
            const inp = e.target && e.target.closest ? e.target.closest('input') : null;
            if (!inp) return;
            const container = findOtpContainerForNode(inp);
            if (!container) return;
            window.__esevaOtpCopilot.lastHumanTypeAt = Date.now();
        }, true);

        document.addEventListener('keydown', (e) => {
            if (!e.isTrusted || e.key !== 'Enter') return;
            const inp = e.target && e.target.closest ? e.target.closest('input') : null;
            if (!inp) return;
            const container = findOtpContainerForNode(inp);
            if (!container) return;
            const val = String(inp.value || '').replace(/\D/g, '');
            if (val.length >= 4) {
                window.__esevaOtpCopilot.humanSubmitAt = Date.now();
                window.__esevaOtpCopilot.humanSubmittedOtp = val;
            }
        }, true);
    }, { forceResetFlag: forceReset, allowInline: allowInlinePage }).catch(() => {});
}

async function resetHumanSubmitWatch(page) {
    if (!page || page.isClosed()) return;
    await page.evaluate(() => {
        if (window.__esevaOtpCopilot) {
            window.__esevaOtpCopilot.humanSubmitAt = 0;
            window.__esevaOtpCopilot.humanSubmittedOtp = '';
        }
    }).catch(() => {});
}

async function readOtpModalCopilotState(page, options = {}) {
    if (!page || page.isClosed()) return { open: false };
    const { allowInlinePage = false } = options;
    return await page.evaluate(({ allowInline }) => {
        const isVisModal = (m) => {
            if (!m) return false;
            const s = window.getComputedStyle(m);
            return (m.offsetParent !== null || s.display !== 'none' || m.classList.contains('show') || m.classList.contains('in') || m.classList.contains('d-block')) &&
                s.visibility !== 'hidden' &&
                !m.classList.contains('hidden');
        };

        const isBtnClickable = (b) => {
            if (!b) return false;
            if (b.disabled || b.hasAttribute('disabled')) return false;
            if ((b.getAttribute('aria-disabled') || '').toLowerCase() === 'true') return false;
            if (b.classList.contains('disabled') || b.classList.contains('p-disabled')) return false;
            const cs = window.getComputedStyle(b);
            if (cs.display === 'none' || cs.visibility === 'hidden' || cs.pointerEvents === 'none' || parseFloat(cs.opacity || '1') === 0) {
                return false;
            }
            const rect = b.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        };

        const isResendControl = (b) => {
            if (!b) return false;
            const bt = (b.innerText || b.value || b.textContent || '').trim().toLowerCase();
            const bId = (b.id || '').toLowerCase();
            if (bId === 'btnsendotp') return false;
            if (bt.includes('ரத்து') || bt.includes('cancel') || bt.includes('close') || bt.includes('இல்லை') || bt.includes('பின்செல்') || bt.includes('back')) {
                return false;
            }
            if (bt.includes('மீண்டும் முயற்சி') || bt.includes('மீண்டும் தொடங்க')) return false;
            return bt.includes('மீண்டும் அனுப்') || bt.includes('மீண்டும்') || bt.includes('மறுமுறை') || bt.includes('resend') || bt.includes('re-generate') || bId.includes('resend');
        };

        const parseCountdownSec = (rootEl) => {
            if (!rootEl) return null;
            const raw = String(rootEl.innerText || '').replace(/\s+/g, ' ').trim();
            if (!raw) return null;

            const labeledMatch = raw.match(/(?:மீதமுள்ள(?:\s*நேரம்)?|remaining(?:\s*time)?)\s*[:\-]?\s*(\d{1,3})\s*(?:நொடிகளில்|நொடிகள்|நொடி|seconds|second|secs|sec)?(?=$|[^a-zA-Z0-9\u0B80-\u0BFF])/i);
            if (labeledMatch) {
                const val = parseInt(labeledMatch[1], 10);
                if (!Number.isNaN(val)) return val;
            }

            const mmss = raw.match(/(?:மீதமுள்ள|remaining|time|expires|resend|நேரம்|காலாவதி)?[^0-9:]*\b(\d{1,2})\s*:\s*(\d{2})\b/i);
            if (mmss) {
                const mins = parseInt(mmss[1], 10);
                const secs = parseInt(mmss[2], 10);
                if (!Number.isNaN(mins) && !Number.isNaN(secs) && secs < 60 && mins <= 15) {
                    return (mins * 60) + secs;
                }
            }

            const secMatches = Array.from(raw.matchAll(/(\d+)\s*(?:நொடிகளில்|நொடிகள்|நொடி|seconds|second|secs|sec)(?=$|[^a-zA-Z0-9\u0B80-\u0BFF])/gi));
            if (secMatches.length > 0) {
                const val = parseInt(secMatches[secMatches.length - 1][1], 10);
                if (!Number.isNaN(val)) return val;
            }

            const timerSpans = Array.from(rootEl.querySelectorAll('span.text-danger, .timer, [class*="timer" i], [class*="count" i], span'));
            const digitSpan = timerSpans.find(s => /^\d{1,3}$/.test((s.innerText || '').trim()));
            if (digitSpan) {
                return parseInt(digitSpan.innerText.trim(), 10);
            }

            if (/(?:^|[^\d])0\s*(?:நொடிகளில்|நொடிகள்|நொடி|seconds|second|secs|sec)(?=$|[^a-zA-Z0-9\u0B80-\u0BFF])/i.test(raw) ||
                /(?:^|[^\d])00\s*:\s*00(?=$|[^\d])/.test(raw) ||
                /காலாவதியாகி|காலாவதியானது|expired/i.test(raw)) {
                return 0;
            }

            return null;
        };

        const modals = Array.from(document.querySelectorAll('.modal, div[role="dialog"], .modal-dialog'));
        let container = null;
        let containerKind = 'modal';

        for (let i = modals.length - 1; i >= 0; i--) {
            const m = modals[i];
            if (!isVisModal(m)) continue;
            const txt = (m.innerText || '');
            if (txt.includes('வெளியேற விரும்புகிறீர்களா') || txt.includes('நீங்கள் வெளியேற')) continue;
            const hasInp = Boolean(m.querySelector('input[formcontrolname="otp"], input[formcontrolname="mobileOtp"], input#otp, input[name*="otp" i], input:not([type="hidden"]):not([disabled]):not([readonly])'));
            const hasRes = Array.from(m.querySelectorAll('button, a, input[type="button"], input[type="submit"], [role="button"]')).some(isResendControl);
            if ((hasInp || hasRes) && (txt.includes('OTP') || txt.includes('கடவுச்சொல்') || m.querySelector('input[formcontrolname*="otp" i], input#otp'))) {
                container = m;
                break;
            }
        }

        if (!container && allowInline) {
            const inlineInp = Array.from(document.querySelectorAll(
                'input[formcontrolname*="otp" i], input[name*="otp" i], input#otp, input#txtOTP, input[placeholder*="OTP" i], input[placeholder*="கடவுச்சொல்" i]'
            )).find(inp => !inp.disabled && !inp.readOnly && (inp.offsetWidth > 0 || inp.offsetHeight > 0));
            if (inlineInp) {
                container = inlineInp.closest('form, .card, .login-box, .auth-box, table, section') || document.body;
                containerKind = 'inline';
            }
        }

        if (!container) return { open: false };

        if (!container.__esevaCopilotTag) {
            container.__esevaCopilotTag = `${containerKind}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        }

        const targetInp = container.querySelector('input[formcontrolname="mobileOtp"], input[formcontrolname="otp"], input#otp, input#txtOTP, input[name*="otp" i]') ||
            container.querySelector('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([disabled]):not([readonly])');
        const otpVal = targetInp ? String(targetInp.value || '').replace(/\D/g, '') : '';
        const otpMaxLen = targetInp ? Number(targetInp.getAttribute('maxlength') || 0) : 0;

        const timerVal = parseCountdownSec(container);

        const candidateControls = Array.from(container.querySelectorAll('button, a, input[type="button"], input[type="submit"], [role="button"]'));
        const resendBtn = candidateControls.find(isResendControl);
        const hasResendBtn = isBtnClickable(resendBtn);

        const submitBtn = candidateControls.find(b => {
            const bt = (b.innerText || b.value || '').trim().toLowerCase();
            const bId = (b.id || '').toLowerCase();
            if (bId === 'btnsendotp' || isResendControl(b)) return false;
            if (bt.includes('ரத்து') || bt.includes('cancel') || bt.includes('இல்லை') || bt.includes('மீண்டும்') || bt.includes('resend')) return false;
            return bt.includes('சமர்ப்பிக்கவும்') || bt.includes('பதிவு செய்') || bt.includes('உள்நுழைக') || bt.includes('submit') || bt.includes('verify') || bt.includes('confirm') || bt.includes('சரிபார்') || (b.className || '').includes('btn-success') || (b.className || '').includes('subbtn');
        });

        const cp = window.__esevaOtpCopilot || {
            activeContainerTag: container.__esevaCopilotTag,
            humanResendAt: 0,
            humanResendCount: 0,
            humanSubmitAt: 0,
            humanSubmittedOtp: '',
            lastHumanTypeAt: 0,
            timerZeroSinceAt: 0,
            resendUnlockedSinceAt: 0,
            sawResendDisabled: false,
            sawPositiveTimer: false,
            botResendAt: 0,
            botResendCount: 0,
            botResendInFlightUntil: 0,
            botResendCyclePendingReset: false
        };

        if (!window.__esevaOtpCopilot) {
            window.__esevaOtpCopilot = cp;
        } else if (cp.activeContainerTag && cp.activeContainerTag !== container.__esevaCopilotTag) {
            cp.activeContainerTag = container.__esevaCopilotTag;
            cp.humanResendAt = 0;
            cp.humanResendCount = 0;
            cp.humanSubmitAt = 0;
            cp.humanSubmittedOtp = '';
            cp.lastHumanTypeAt = 0;
            cp.timerZeroSinceAt = 0;
            cp.resendUnlockedSinceAt = 0;
            cp.sawResendDisabled = false;
            cp.sawPositiveTimer = false;
            cp.botResendAt = 0;
            cp.botResendCount = 0;
            cp.botResendInFlightUntil = 0;
            cp.botResendCyclePendingReset = false;
        } else {
            cp.activeContainerTag = container.__esevaCopilotTag;
        }

        const nowTs = Date.now();
        if (timerVal !== null && timerVal > 0) {
            cp.sawPositiveTimer = true;
            cp.timerZeroSinceAt = 0;
            cp.botResendCyclePendingReset = false;
        } else if (timerVal === 0) {
            if (!cp.timerZeroSinceAt) cp.timerZeroSinceAt = nowTs;
        } else {
            cp.timerZeroSinceAt = 0;
        }

        if (!hasResendBtn) {
            cp.sawResendDisabled = true;
            cp.resendUnlockedSinceAt = 0;
            if (cp.botResendAt > 0 && (nowTs - cp.botResendAt >= 800)) {
                cp.botResendCyclePendingReset = false;
            }
        } else if (!cp.resendUnlockedSinceAt) {
            cp.resendUnlockedSinceAt = nowTs;
        }

        return {
            open: true,
            containerKind,
            otpVal,
            otpMaxLen,
            timerVal,
            hasResendBtn,
            hasSubmitBtn: Boolean(submitBtn && (submitBtn.offsetParent !== null || window.getComputedStyle(submitBtn).display !== 'none')),
            submitDisabled: Boolean(submitBtn && submitBtn.disabled),
            humanResendAt: cp.humanResendAt || 0,
            humanResendCount: cp.humanResendCount || 0,
            humanSubmitAt: cp.humanSubmitAt || 0,
            humanSubmittedOtp: cp.humanSubmittedOtp || '',
            lastHumanTypeAt: cp.lastHumanTypeAt || 0,
            timerZeroSinceAt: cp.timerZeroSinceAt || 0,
            resendUnlockedSinceAt: cp.resendUnlockedSinceAt || 0,
            sawResendDisabled: Boolean(cp.sawResendDisabled),
            sawPositiveTimer: Boolean(cp.sawPositiveTimer),
            botResendAt: cp.botResendAt || 0,
            botResendCount: cp.botResendCount || 0,
            botResendInFlightUntil: cp.botResendInFlightUntil || 0,
            botResendCyclePendingReset: Boolean(cp.botResendCyclePendingReset)
        };
    }, { allowInline: allowInlinePage }).catch(() => ({ open: false }));
}

async function performVisibleModalOtpSubmit(page, otpToVerify) {
    if (!page || page.isClosed()) return false;
    await page.evaluate((val) => {
        const isVisModal = (m) => {
            if (!m) return false;
            const s = window.getComputedStyle(m);
            return (m.offsetParent !== null || s.display !== 'none' || m.classList.contains('show') || m.classList.contains('d-block')) && s.visibility !== 'hidden';
        };
        const modals = Array.from(document.querySelectorAll('.modal, div[role="dialog"], .modal-dialog')).filter(isVisModal);
        const modal = modals[modals.length - 1] || document;
        const targetInp = modal.querySelector('input[formcontrolname="mobileOtp"], input[formcontrolname="otp"], input#otp, input#txtOTP') ||
            modal.querySelector('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([disabled]):not([readonly])');
        if (targetInp) {
            if (targetInp.value !== val) {
                targetInp.value = val;
            }
            targetInp.dispatchEvent(new Event('input', { bubbles: true }));
            targetInp.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (window.__tnpdsComp && window.__tnpdsComp.otpForm) {
            try {
                window.__tnpdsComp.otpForm.get('otp')?.setValue(val);
                window.__tnpdsComp.otpForm.get('otp')?.setErrors(null);
                window.__tnpdsComp.otpForm.updateValueAndValidity();
            } catch (_) {}
        }
    }, otpToVerify).catch(() => {});

    await page.waitForTimeout(350);

    try {
        const visBtn = page.locator('.modal.show, .modal.d-block, div[role="dialog"]')
            .locator('button:has-text("சமர்ப்பிக்கவும்"), button:has-text("பதிவு செய்"), button:has-text("Submit"), button.btn-success')
            .filter({ visible: true })
            .last();
        if (await visBtn.count() > 0 && await visBtn.isVisible().catch(() => false)) {
            await visBtn.evaluate(b => { b.disabled = false; b.removeAttribute('disabled'); b.classList.remove('disabled'); }).catch(() => {});
            await visBtn.click({ delay: 60 }).catch(() => {});
            return true;
        }
    } catch (_) {}

    return await page.evaluate(() => {
        const isVisModal = (m) => {
            if (!m) return false;
            const s = window.getComputedStyle(m);
            return (m.offsetParent !== null || s.display !== 'none' || m.classList.contains('show') || m.classList.contains('d-block')) && s.visibility !== 'hidden';
        };
        const modals = Array.from(document.querySelectorAll('.modal, div[role="dialog"], .modal-dialog')).filter(isVisModal);
        const modal = modals[modals.length - 1];
        if (!modal) return false;
        const btns = Array.from(modal.querySelectorAll('button'));
        const submitBtn = btns.find(b => {
            const bt = (b.innerText || '').trim().toLowerCase();
            if (bt.includes('ரத்து') || bt.includes('cancel') || bt.includes('இல்லை') || bt.includes('மீண்டும்') || bt.includes('resend')) return false;
            return (bt.includes('சமர்ப்பிக்கவும்') || bt.includes('பதிவு செய்') || bt.includes('submit') || bt.includes('verify') || bt.includes('சரிபார்') || (b.className || '').includes('btn-success')) && b.offsetParent !== null;
        });
        if (!submitBtn) return false;
        submitBtn.disabled = false;
        submitBtn.removeAttribute('disabled');
        submitBtn.classList.remove('disabled');
        submitBtn.click();
        return true;
    }).catch(() => false);
}

async function performVisibleModalResendWithResult(page, options = {}) {
    if (!page || page.isClosed()) return { clicked: false, confirmed: false, error: null, reason: 'page_closed' };
    if (activeResendPageLocks.has(page)) return { clicked: false, confirmed: false, error: null, reason: 'page_lock' };

    const { allowInlinePage = false, ignoreTimer = false, verifyTimeoutMs = 3000 } = options;
    activeResendPageLocks.add(page);
    let respListener = null;
    try {
        const prep = await page.evaluate(({ allowInline, skipTimerCheck }) => {
            const isVisModal = (m) => {
                if (!m) return false;
                const s = window.getComputedStyle(m);
                return (m.offsetParent !== null || s.display !== 'none' || m.classList.contains('show') || m.classList.contains('in') || m.classList.contains('d-block')) &&
                    s.visibility !== 'hidden' &&
                    !m.classList.contains('hidden');
            };

            const isBtnClickable = (b) => {
                if (!b) return false;
                if (b.disabled || b.hasAttribute('disabled')) return false;
                if ((b.getAttribute('aria-disabled') || '').toLowerCase() === 'true') return false;
                if (b.classList.contains('disabled') || b.classList.contains('p-disabled')) return false;
                const cs = window.getComputedStyle(b);
                if (cs.display === 'none' || cs.visibility === 'hidden' || cs.pointerEvents === 'none' || parseFloat(cs.opacity || '1') === 0) {
                    return false;
                }
                const rect = b.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0;
            };

            const isResendControl = (b) => {
                if (!b) return false;
                const bt = (b.innerText || b.value || b.textContent || '').trim().toLowerCase();
                const bId = (b.id || '').toLowerCase();
                if (bId === 'btnsendotp') return false;
                if (bt.includes('ரத்து') || bt.includes('cancel') || bt.includes('close') || bt.includes('இல்லை') || bt.includes('பின்செல்') || bt.includes('back')) {
                    return false;
                }
                if (bt.includes('மீண்டும் முயற்சி') || bt.includes('மீண்டும் தொடங்க')) return false;
                return bt.includes('மீண்டும் அனுப்') || bt.includes('மீண்டும்') || bt.includes('மறுமுறை') || bt.includes('resend') || bt.includes('re-generate') || bId.includes('resend');
            };

            const parseCountdownSec = (rootEl) => {
                if (!rootEl) return null;
                const raw = String(rootEl.innerText || '').replace(/\s+/g, ' ').trim();
                if (!raw) return null;
                const labeledMatch = raw.match(/(?:மீதமுள்ள(?:\s*நேரம்)?|remaining(?:\s*time)?)\s*[:\-]?\s*(\d{1,3})\s*(?:நொடிகளில்|நொடிகள்|நொடி|seconds|second|secs|sec)?(?=$|[^a-zA-Z0-9\u0B80-\u0BFF])/i);
                if (labeledMatch) return parseInt(labeledMatch[1], 10);
                const mmss = raw.match(/(?:மீதமுள்ள|remaining|time|expires|resend|நேரம்|காலாவதி)?[^0-9:]*\b(\d{1,2})\s*:\s*(\d{2})\b/i);
                if (mmss) {
                    const mins = parseInt(mmss[1], 10);
                    const secs = parseInt(mmss[2], 10);
                    if (!Number.isNaN(mins) && !Number.isNaN(secs) && secs < 60 && mins <= 15) return (mins * 60) + secs;
                }
                const secMatches = Array.from(raw.matchAll(/(\d+)\s*(?:நொடிகளில்|நொடிகள்|நொடி|seconds|second|secs|sec)(?=$|[^a-zA-Z0-9\u0B80-\u0BFF])/gi));
                if (secMatches.length > 0) return parseInt(secMatches[secMatches.length - 1][1], 10);
                const timerSpans = Array.from(rootEl.querySelectorAll('span.text-danger, .timer, [class*="timer" i], [class*="count" i], span'));
                const digitSpan = timerSpans.find(s => /^\d{1,3}$/.test((s.innerText || '').trim()));
                if (digitSpan) return parseInt(digitSpan.innerText.trim(), 10);
                if (/(?:^|[^\d])0\s*(?:நொடிகளில்|நொடிகள்|நொடி|seconds|second|secs|sec)(?=$|[^a-zA-Z0-9\u0B80-\u0BFF])/i.test(raw) ||
                    /(?:^|[^\d])00\s*:\s*00(?=$|[^\d])/.test(raw) ||
                    /காலாவதியாகி|காலாவதியானது|expired/i.test(raw)) {
                    return 0;
                }
                return null;
            };

            const nowTs = Date.now();
            const cp = window.__esevaOtpCopilot || {};
            if (!skipTimerCheck) {
                if ((cp.botResendInFlightUntil || 0) > nowTs) return { ready: false, reason: 'in_flight_lock' };
                if (cp.botResendCyclePendingReset) return { ready: false, reason: 'pending_timer_reset' };
                if ((cp.humanResendCount || 0) > 0 || (cp.humanResendAt || 0) > 0) return { ready: false, reason: 'human_yield' };
            }

            const modals = Array.from(document.querySelectorAll('.modal, div[role="dialog"], .modal-dialog')).filter(m => {
                if (!isVisModal(m)) return false;
                const t = (m.innerText || '');
                return !t.includes('வெளியேற விரும்புகிறீர்களா') && !t.includes('நீங்கள் வெளியேற');
            });

            let container = modals.length > 0 ? modals[modals.length - 1] : null;
            if (!container && allowInline) {
                const inlineInp = Array.from(document.querySelectorAll(
                    'input[formcontrolname*="otp" i], input[name*="otp" i], input#otp, input#txtOTP, input[placeholder*="OTP" i], input[placeholder*="கடவுச்சொல்" i]'
                )).find(inp => !inp.disabled && !inp.readOnly && (inp.offsetWidth > 0 || inp.offsetHeight > 0));
                if (inlineInp) {
                    container = inlineInp.closest('form, .card, .login-box, .auth-box, table, section') || document.body;
                }
            }
            if (!container) return { ready: false, reason: 'no_container' };

            if (!skipTimerCheck) {
                const liveTimer = parseCountdownSec(container);
                if (liveTimer !== null && liveTimer > 0) return { ready: false, reason: 'timer_still_running' };
            }

            const resendBtn = Array.from(container.querySelectorAll('button, a, input[type="button"], input[type="submit"], [role="button"]')).find(isResendControl);
            if (!isBtnClickable(resendBtn)) return { ready: false, reason: 'button_not_clickable' };

            document.querySelectorAll('[data-eseva-resend-target="1"]').forEach(el => el.removeAttribute('data-eseva-resend-target'));
            resendBtn.setAttribute('data-eseva-resend-target', '1');

            if (window.__esevaOtpCopilot) {
                window.__esevaOtpCopilot.botClickingResendNow = true;
                window.__esevaOtpCopilot.botResendInFlightUntil = nowTs + 15000;
                window.__esevaOtpCopilot.botResendAt = nowTs;
                window.__esevaOtpCopilot.botResendCount = (window.__esevaOtpCopilot.botResendCount || 0) + 1;
                window.__esevaOtpCopilot.botResendCyclePendingReset = true;
                window.__esevaOtpCopilot.timerZeroSinceAt = 0;
                window.__esevaOtpCopilot.resendUnlockedSinceAt = 0;
                window.__esevaOtpCopilot.humanSubmitAt = 0;
                window.__esevaOtpCopilot.humanSubmittedOtp = '';
            }

            return { ready: true };
        }, { allowInline: allowInlinePage, skipTimerCheck: ignoreTimer }).catch(() => ({ ready: false }));

        if (!prep || !prep.ready) {
            return { clicked: false, confirmed: false, error: null, reason: (prep && prep.reason) || 'not_ready' };
        }

        const apiResult = { seen: false, httpStatus: 0, statusCode: null, errorDesc: '' };
        if (typeof page.on === 'function') {
            respListener = async (response) => {
                try {
                    const url = (response.url() || '').toLowerCase();
                    if (!/verifymobilenumber|requestotp|sendotp|resend|changemobile\/sendotp/.test(url)) return;
                    const httpStatus = response.status();
                    apiResult.seen = true;
                    apiResult.httpStatus = httpStatus;
                    if (httpStatus >= 400) {
                        apiResult.errorDesc = `HTTP ${httpStatus}`;
                        return;
                    }
                    const ct = (response.headers && response.headers()['content-type']) || '';
                    if (ct.includes('json')) {
                        const json = await response.json().catch(() => null);
                        if (json) {
                            apiResult.statusCode = json.statusCode ?? null;
                            if (json.statusCode !== undefined && ![0, 200].includes(json.statusCode)) {
                                apiResult.errorDesc = json.errorDescription || json.message || `Status ${json.statusCode}`;
                            }
                        }
                    }
                } catch (_) {}
            };
            page.on('response', respListener);
        }

        let clicked = false;
        try {
            if (typeof page.locator === 'function') {
                const targetLoc = page.locator('[data-eseva-resend-target="1"]').first();
                if (await targetLoc.count().catch(() => 0) > 0) {
                    await targetLoc.scrollIntoViewIfNeeded().catch(() => {});
                    await targetLoc.click({ delay: 60, timeout: 2500 }).then(() => { clicked = true; }).catch(() => {});
                }
            }
            if (!clicked) {
                clicked = await page.evaluate(() => {
                    const btn = document.querySelector('[data-eseva-resend-target="1"]');
                    if (!btn || btn.disabled) return false;
                    btn.click();
                    return true;
                }).catch(() => false);
            }
        } finally {
            await page.evaluate(() => {
                if (window.__esevaOtpCopilot) window.__esevaOtpCopilot.botClickingResendNow = false;
                document.querySelectorAll('[data-eseva-resend-target="1"]').forEach(el => el.removeAttribute('data-eseva-resend-target'));
            }).catch(() => {});
        }

        if (!clicked) {
            return { clicked: false, confirmed: false, error: null, reason: 'click_failed' };
        }

        // Verify portal outcome (countdown restarted, resend disabled, toast shown, or API status)
        let confirmed = false;
        let detectedError = '';
        let detectedToast = '';
        const deadline = Date.now() + Math.max(0, verifyTimeoutMs);

        do {
            const snap = await page.evaluate(() => {
                const errToasts = Array.from(document.querySelectorAll('#toast-container .toast-error, .toast-error, .p-toast-message-error, .alert-danger'))
                    .map(t => (t.innerText || '').trim()).filter(Boolean);
                const okToasts = Array.from(document.querySelectorAll('#toast-container .toast-success, .toast-success, .p-toast-message-success, .alert-success'))
                    .map(t => (t.innerText || '').trim()).filter(Boolean);
                const anyToasts = Array.from(document.querySelectorAll('#toast-container .toast-message, .toast-message, .p-toast-detail'))
                    .map(t => (t.innerText || '').trim()).filter(Boolean);
                return { errToasts, okToasts, anyToasts };
            }).catch(() => ({ errToasts: [], okToasts: [], anyToasts: [] }));

            const liveState = await readOtpModalCopilotState(page, { allowInlinePage });
            if (snap.errToasts.length > 0) {
                detectedError = snap.errToasts.join(' | ');
                break;
            }
            if (apiResult.seen && apiResult.errorDesc) {
                detectedError = snap.anyToasts[0] || apiResult.errorDesc;
                break;
            }
            if ((liveState.timerVal !== null && liveState.timerVal > 0) || !liveState.hasResendBtn || snap.okToasts.length > 0) {
                confirmed = true;
                detectedToast = snap.okToasts[0] || '';
                break;
            }
            if (Date.now() >= deadline) break;
            await page.waitForTimeout(250).catch(() => {});
        } while (Date.now() < deadline);

        return {
            clicked: true,
            confirmed,
            error: detectedError || null,
            toastText: detectedToast || null,
            apiStatus: apiResult.seen ? (apiResult.statusCode ?? apiResult.httpStatus) : null
        };
    } finally {
        if (respListener && typeof page.off === 'function') {
            try { page.off('response', respListener); } catch (_) {}
        }
        activeResendPageLocks.delete(page);
    }
}

async function performVisibleModalResend(page, options = {}) {
    const res = await performVisibleModalResendWithResult(page, options);
    return Boolean(res && res.clicked);
}

/**
 * Evaluates Co-Pilot decision on whether Bot should auto-click Resend.
 * Strictly obeys:
 * - Never clicks after human already clicked Resend manually.
 * - Never double-clicks during the same expired timer cycle.
 * - Works cleanly with shrinking portal countdowns (120s -> 60s -> 45s -> 30s).
 */
function shouldBotTriggerResend(modalState, lastBotResendAt, nowMs = Date.now(), graceAfterZeroMs = 10000, maxAutoResends = 2) {
    if (!modalState || !modalState.open || !modalState.hasResendBtn) return false;
    if (modalState.humanResendCount > 0 || modalState.humanResendAt > 0) return false;
    if (modalState.botResendCyclePendingReset) return false;
    if ((modalState.botResendInFlightUntil || 0) > nowMs) return false;
    if ((modalState.botResendCount || 0) >= maxAutoResends) return false;
    if (modalState.otpVal && modalState.otpVal.length > 0) return false;
    if (modalState.lastHumanTypeAt && (nowMs - modalState.lastHumanTypeAt < 15000)) return false;

    if (modalState.timerVal !== null && modalState.timerVal !== undefined) {
        if (modalState.timerVal !== 0) return false;
        if (modalState.timerZeroSinceAt && (nowMs - modalState.timerZeroSinceAt < graceAfterZeroMs)) return false;
    } else {
        // Inline/timerless screens: ONLY trigger if we genuinely saw Resend disabled/hidden first AND it stayed unlocked for graceAfterZeroMs
        if (!modalState.sawResendDisabled || !modalState.resendUnlockedSinceAt) return false;
        if (nowMs - modalState.resendUnlockedSinceAt < graceAfterZeroMs) return false;
    }

    const latestResendAt = Math.max(lastBotResendAt || 0, modalState.botResendAt || 0, modalState.humanResendAt || 0);
    if (latestResendAt > 0 && (nowMs - latestResendAt < 18000)) return false;
    return true;
}

/**
 * Evaluates Co-Pilot decision on whether Bot should submit OTP in Chrome.
 * Strictly avoids double-submitting when human already pressed Submit/Enter or is still typing!
 */
function shouldBotTriggerSubmit(modalState, lastSubmittedOtp, minLen = 6, nowMs = Date.now()) {
    if (!modalState || !modalState.open || !modalState.hasSubmitBtn) return { submit: false, reason: 'closed' };
    if (!modalState.otpVal || modalState.otpVal.length < minLen) return { submit: false, reason: 'incomplete' };
    if (modalState.humanSubmitAt > 0 && (nowMs - modalState.humanSubmitAt < 6500) && modalState.humanSubmittedOtp === modalState.otpVal) {
        return { submit: false, reason: 'human_already_submitted' };
    }
    if (modalState.lastHumanTypeAt > 0 && (nowMs - modalState.lastHumanTypeAt < 1600)) {
        return { submit: false, reason: 'human_still_typing' };
    }
    if (modalState.otpVal === lastSubmittedOtp) return { submit: false, reason: 'already_submitted' };
    return { submit: true, reason: 'ready' };
}

/**
 * Single unified Co-Pilot Resend orchestrator usable by every OTP wait loop across all services.
 */
async function tryCopilotAutoResendIfExpired(page, options = {}) {
    if (!page || page.isClosed()) return { resent: false, humanResent: false, state: { open: false } };
    const {
        allowInlinePage = false,
        graceAfterZeroMs = 4000,
        maxAutoResends = 2,
        onProgress = null,
        showBrowserHud = null,
        clearStaleOtpState = null,
        stageLabel = 'OTP'
    } = options;

    let tracker = trackerByPage.get(page);
    if (!tracker) {
        tracker = { lastBotResendAt: 0, notedHumanResendAt: 0, activeTag: '' };
        trackerByPage.set(page, tracker);
    }

    await installOtpModalCopilot(page, { forceReset: false, allowInlinePage });
    const modalState = await readOtpModalCopilotState(page, { allowInlinePage });
    if (!modalState.open) {
        return { resent: false, humanResent: false, state: modalState };
    }

    if (modalState.humanResendAt > tracker.notedHumanResendAt) {
        tracker.notedHumanResendAt = modalState.humanResendAt;
        if (typeof clearStaleOtpState === 'function') {
            try { clearStaleOtpState(); } catch (_) {}
        }
        if (typeof onProgress === 'function') {
            onProgress(`⌨️ [Co-Pilot] ஆப்ரேட்டர் நேரடியாக "மீண்டும் அனுப்பு" அழுத்தினார் — புது ${stageLabel}-க்காகக் காத்திருக்கிறது (ஆப் மீண்டும் அழுத்தாது).`);
        }
        if (typeof showBrowserHud === 'function') {
            await showBrowserHud('[Co-Pilot] புது OTP அனுப்பப்பட்டது', 'புதிய SMS OTP-ஐ உள்ளிடவும்', 'info').catch(() => {});
        }
        return { resent: false, humanResent: true, state: modalState };
    }

    if (shouldBotTriggerResend(modalState, tracker.lastBotResendAt, Date.now(), graceAfterZeroMs, maxAutoResends)) {
        const resendRes = await performVisibleModalResendWithResult(page, { allowInlinePage });
        if (resendRes && resendRes.clicked) {
            tracker.lastBotResendAt = Date.now();
            if (typeof clearStaleOtpState === 'function') {
                try { clearStaleOtpState(); } catch (_) {}
            }
            if (resendRes.error) {
                if (typeof onProgress === 'function') {
                    onProgress(`🚨 [${stageLabel} போர்ட்டல் பிழை] "மீண்டும் அனுப்பு" அழுத்தப்பட்டது, ஆனால் அரசு போர்ட்டல் மறுத்தது: "${resendRes.error}"`);
                }
                if (typeof showBrowserHud === 'function') {
                    await showBrowserHud('🔴 போர்ட்டல் OTP பிழை', resendRes.error, 'error').catch(() => {});
                }
                return { resent: false, blockedByPortal: true, error: resendRes.error, humanResent: false, state: modalState };
            }
            if (resendRes.confirmed) {
                if (typeof onProgress === 'function') {
                    onProgress(`🔄 [${stageLabel} மீண்டும் அனுப்பு] "மீண்டும் அனுப்பு" 1 முறை அழுத்தப்பட்டு புதிய OTP அனுப்பப்பட்டது (கவுண்டவுன் மீண்டும் தொடங்கியது)! இனி வரும் புதிய OTP-ஐ மட்டும் உள்ளிடவும்.`);
                }
                if (typeof showBrowserHud === 'function') {
                    await showBrowserHud('🔔 புதிய OTP அனுப்பப்பட்டது', 'புதிய SMS OTP-ஐ மட்டும் உள்ளிடவும்!', 'warning').catch(() => {});
                }
                return { resent: true, confirmed: true, humanResent: false, state: modalState };
            }
            if (typeof onProgress === 'function') {
                onProgress(`⚠️ [${stageLabel} மீண்டும் அனுப்பு] "மீண்டும் அனுப்பு" அழுத்தப்பட்டது, ஆனால் போர்ட்டல் கவுண்டவுன் இன்னும் 0-ல் உள்ளது — Chrome திரையைச் சரிபார்க்கவும்.`);
            }
            if (typeof showBrowserHud === 'function') {
                await showBrowserHud('⚠️ OTP பதில் நிலுவையில் உள்ளது', 'Chrome திரையைச் சரிபார்க்கவும்', 'warning').catch(() => {});
            }
            return { resent: true, confirmed: false, humanResent: false, state: modalState };
        }
    }

    return { resent: false, humanResent: false, state: modalState };
}

module.exports = {
    installOtpModalCopilot,
    resetHumanSubmitWatch,
    readOtpModalCopilotState,
    performVisibleModalOtpSubmit,
    performVisibleModalResend,
    performVisibleModalResendWithResult,
    shouldBotTriggerResend,
    shouldBotTriggerSubmit,
    tryCopilotAutoResendIfExpired
};
