/**
 * Universal Operator Co-Pilot Watcher for Government OTP Modals.
 *
 * Ensures seamless human + bot collaboration inside Chrome:
 * - Tracks human (isTrusted) clicks on Resend / Submit buttons and Enter key presses.
 * - Never clicks Submit twice if the operator already clicked Submit in Chrome.
 * - Never clicks Resend automatically once the operator takes manual Resend control
 *   (or while timer > 0, or while operator is typing).
 * - Always operates strictly on the currently VISIBLE OTP modal (never hidden DOM modals).
 */

async function installOtpModalCopilot(page) {
    if (!page || page.isClosed()) return;
    await page.evaluate(() => {
        if (!window.__esevaOtpCopilot) {
            window.__esevaOtpCopilot = {
                humanResendAt: 0,
                humanResendCount: 0,
                humanSubmitAt: 0,
                humanSubmittedOtp: '',
                lastHumanTypeAt: 0,
                timerZeroSinceAt: 0
            };
        } else {
            // Reset per-modal session counters when installing for a newly opened modal
            window.__esevaOtpCopilot.humanResendAt = 0;
            window.__esevaOtpCopilot.humanResendCount = 0;
            window.__esevaOtpCopilot.humanSubmitAt = 0;
            window.__esevaOtpCopilot.humanSubmittedOtp = '';
            window.__esevaOtpCopilot.lastHumanTypeAt = 0;
            window.__esevaOtpCopilot.timerZeroSinceAt = 0;
        }

        if (window.__esevaOtpCopilotBound) return;
        window.__esevaOtpCopilotBound = true;

        const isVisibleModal = (m) => {
            if (!m) return false;
            const s = window.getComputedStyle(m);
            return (m.offsetParent !== null || s.display !== 'none' || m.classList.contains('show') || m.classList.contains('in') || m.classList.contains('d-block')) &&
                s.visibility !== 'hidden' &&
                !m.classList.contains('hidden');
        };

        document.addEventListener('click', (e) => {
            if (!e.isTrusted) return;
            const btn = e.target && e.target.closest ? e.target.closest('button, input[type="submit"], input[type="button"], a.btn') : null;
            if (!btn) return;
            const modal = btn.closest('.modal, div[role="dialog"], .modal-dialog');
            if (!modal || !isVisibleModal(modal)) return;

            const txt = (btn.innerText || btn.value || btn.textContent || '').trim().toLowerCase();
            const bId = (btn.id || '').toLowerCase();
            const cls = (btn.className || '').toLowerCase();

            if (txt.includes('மீண்டும்') || txt.includes('மறுமுறை') || txt.includes('resend') || bId.includes('resend')) {
                window.__esevaOtpCopilot.humanResendAt = Date.now();
                window.__esevaOtpCopilot.humanResendCount += 1;
                window.__esevaOtpCopilot.humanSubmitAt = 0;
                window.__esevaOtpCopilot.humanSubmittedOtp = '';
                window.__esevaOtpCopilot.timerZeroSinceAt = 0;
                return;
            }

            if (txt.includes('ரத்து') || txt.includes('cancel') || txt.includes('close') || txt.includes('இல்லை')) {
                return;
            }

            if (
                txt.includes('சமர்ப்பி') ||
                txt.includes('பதிவு செய்') ||
                txt.includes('submit') ||
                txt.includes('verify') ||
                txt.includes('சரிபார்') ||
                cls.includes('btn-success') ||
                btn.type === 'submit'
            ) {
                const inp = modal.querySelector('input[formcontrolname="mobileOtp"], input[formcontrolname="otp"], input#otp, input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([readonly]):not([disabled])');
                const val = inp ? String(inp.value || '').replace(/\D/g, '') : '';
                window.__esevaOtpCopilot.humanSubmitAt = Date.now();
                window.__esevaOtpCopilot.humanSubmittedOtp = val;
            }
        }, true);

        document.addEventListener('input', (e) => {
            if (!e.isTrusted) return;
            const inp = e.target && e.target.closest ? e.target.closest('input') : null;
            if (!inp) return;
            const modal = inp.closest('.modal, div[role="dialog"], .modal-dialog');
            if (!modal || !isVisibleModal(modal)) return;
            window.__esevaOtpCopilot.lastHumanTypeAt = Date.now();
        }, true);

        document.addEventListener('keydown', (e) => {
            if (!e.isTrusted || e.key !== 'Enter') return;
            const inp = e.target && e.target.closest ? e.target.closest('input') : null;
            if (!inp) return;
            const modal = inp.closest('.modal, div[role="dialog"], .modal-dialog');
            if (!modal || !isVisibleModal(modal)) return;
            const val = String(inp.value || '').replace(/\D/g, '');
            if (val.length >= 4) {
                window.__esevaOtpCopilot.humanSubmitAt = Date.now();
                window.__esevaOtpCopilot.humanSubmittedOtp = val;
            }
        }, true);
    }).catch(() => {});
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

async function readOtpModalCopilotState(page) {
    if (!page || page.isClosed()) return { open: false };
    return await page.evaluate(() => {
        const isVisModal = (m) => {
            if (!m) return false;
            const s = window.getComputedStyle(m);
            return (m.offsetParent !== null || s.display !== 'none' || m.classList.contains('show') || m.classList.contains('in') || m.classList.contains('d-block')) &&
                s.visibility !== 'hidden' &&
                !m.classList.contains('hidden');
        };

        const modals = Array.from(document.querySelectorAll('.modal, div[role="dialog"], .modal-dialog'));
        let modal = null;
        for (let i = modals.length - 1; i >= 0; i--) {
            const m = modals[i];
            if (!isVisModal(m)) continue;
            const txt = (m.innerText || '');
            const hasInp = Boolean(m.querySelector('input[formcontrolname="otp"], input[formcontrolname="mobileOtp"], input#otp, input:not([type="hidden"]):not([disabled]):not([readonly])'));
            if (hasInp && (txt.includes('OTP') || txt.includes('கடவுச்சொல்') || m.querySelector('input[formcontrolname*="otp" i], input#otp'))) {
                modal = m;
                break;
            }
        }
        if (!modal) return { open: false };

        const targetInp = modal.querySelector('input[formcontrolname="mobileOtp"], input[formcontrolname="otp"], input#otp') ||
            modal.querySelector('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([disabled]):not([readonly])');
        const otpVal = targetInp ? String(targetInp.value || '').replace(/\D/g, '') : '';
        const otpMaxLen = targetInp ? Number(targetInp.getAttribute('maxlength') || 0) : 0;

        const mText = (modal.innerText || '');
        const spans = Array.from(modal.querySelectorAll('span.text-danger, span'));
        const timerSpan = spans.find(s => /^\d+$/.test((s.innerText || '').trim()));
        let timerVal = timerSpan ? parseInt(timerSpan.innerText.trim(), 10) : null;
        if (timerVal === null && (mText.includes('0 நொடிகள்') || mText.includes('0 seconds') || mText.includes('காலாவதி'))) {
            timerVal = 0;
        }

        const resendBtn = Array.from(modal.querySelectorAll('button, a')).find(b => {
            const bt = (b.innerText || '').trim().toLowerCase();
            return bt.includes('மீண்டும் அனுப்பவும்') || bt.includes('மீண்டும்') || bt.includes('மறுமுறை') || bt.includes('resend');
        });

        const submitBtn = Array.from(modal.querySelectorAll('button')).find(b => {
            const bt = (b.innerText || '').trim().toLowerCase();
            if (bt.includes('ரத்து') || bt.includes('cancel') || bt.includes('இல்லை') || bt.includes('மீண்டும்') || bt.includes('resend')) return false;
            return bt.includes('சமர்ப்பிக்கவும்') || bt.includes('பதிவு செய்') || bt.includes('submit') || bt.includes('verify') || bt.includes('சரிபார்') || (b.className || '').includes('btn-success');
        });

        const cp = window.__esevaOtpCopilot || {
            humanResendAt: 0,
            humanResendCount: 0,
            humanSubmitAt: 0,
            humanSubmittedOtp: '',
            lastHumanTypeAt: 0,
            timerZeroSinceAt: 0
        };

        if (timerVal === 0 && !cp.timerZeroSinceAt) {
            cp.timerZeroSinceAt = Date.now();
        } else if (timerVal !== 0) {
            cp.timerZeroSinceAt = 0;
        }

        return {
            open: true,
            otpVal,
            otpMaxLen,
            timerVal,
            hasResendBtn: Boolean(resendBtn && !resendBtn.disabled && resendBtn.offsetParent !== null),
            hasSubmitBtn: Boolean(submitBtn && submitBtn.offsetParent !== null),
            submitDisabled: Boolean(submitBtn && submitBtn.disabled),
            humanResendAt: cp.humanResendAt || 0,
            humanResendCount: cp.humanResendCount || 0,
            humanSubmitAt: cp.humanSubmitAt || 0,
            humanSubmittedOtp: cp.humanSubmittedOtp || '',
            lastHumanTypeAt: cp.lastHumanTypeAt || 0,
            timerZeroSinceAt: cp.timerZeroSinceAt || 0
        };
    }).catch(() => ({ open: false }));
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
        const targetInp = modal.querySelector('input[formcontrolname="mobileOtp"], input[formcontrolname="otp"], input#otp') ||
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

async function performVisibleModalResend(page) {
    if (!page || page.isClosed()) return false;
    return await page.evaluate(() => {
        const isVisModal = (m) => {
            if (!m) return false;
            const s = window.getComputedStyle(m);
            return (m.offsetParent !== null || s.display !== 'none' || m.classList.contains('show') || m.classList.contains('d-block')) && s.visibility !== 'hidden';
        };
        const modals = Array.from(document.querySelectorAll('.modal, div[role="dialog"], .modal-dialog')).filter(isVisModal);
        const modal = modals[modals.length - 1];
        if (!modal) return false;
        const resendBtn = Array.from(modal.querySelectorAll('button, a')).find(b => {
            const bt = (b.innerText || '').trim().toLowerCase();
            return (bt.includes('மீண்டும் அனுப்பவும்') || bt.includes('மீண்டும்') || bt.includes('மறுமுறை') || bt.includes('resend')) && b.offsetParent !== null;
        });
        if (!resendBtn || resendBtn.disabled) return false;
        if (window.__esevaOtpCopilot) {
            window.__esevaOtpCopilot.timerZeroSinceAt = 0;
            window.__esevaOtpCopilot.humanSubmitAt = 0;
            window.__esevaOtpCopilot.humanSubmittedOtp = '';
        }
        resendBtn.click();
        return true;
    }).catch(() => false);
}

/**
 * Evaluates Co-Pilot decision on whether Bot should auto-click Resend.
 * Strictly obeys: If human already clicked Resend manually, Bot yields permanently for this modal!
 */
function shouldBotTriggerResend(modalState, lastBotResendAt, nowMs = Date.now(), graceAfterZeroMs = 10000) {
    if (!modalState || !modalState.open || !modalState.hasResendBtn) return false;
    if (modalState.timerVal !== 0) return false;
    if (modalState.humanResendCount > 0 || modalState.humanResendAt > 0) return false;
    if (modalState.otpVal && modalState.otpVal.length > 0) return false;
    if (modalState.lastHumanTypeAt && (nowMs - modalState.lastHumanTypeAt < 15000)) return false;
    if (modalState.timerZeroSinceAt && (nowMs - modalState.timerZeroSinceAt < graceAfterZeroMs)) return false;
    const latestResendAt = Math.max(lastBotResendAt || 0, modalState.humanResendAt || 0);
    if (latestResendAt > 0 && (nowMs - latestResendAt < 65000)) return false;
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

module.exports = {
    installOtpModalCopilot,
    resetHumanSubmitWatch,
    readOtpModalCopilotState,
    performVisibleModalOtpSubmit,
    performVisibleModalResend,
    shouldBotTriggerResend,
    shouldBotTriggerSubmit
};
