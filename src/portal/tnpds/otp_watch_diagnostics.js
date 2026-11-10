// ============================================================================
// OTP Watch Diagnostics (< 100 lines)
// Takes a compact, exception-safe snapshot of the OTP modal state so that every
// OTP wait leaves a real trail in the desktop session log (no silent waits).
// IMPORTANT: Only standard CSS selectors here — Playwright pseudo selectors such
// as ':has-text()' throw SyntaxError inside page.evaluate().
// ============================================================================

async function snapshotOtpDomState(page) {
    if (!page || page.isClosed()) return { ok: false, error: 'PAGE_CLOSED' };
    try {
        return await page.evaluate(() => {
            const isShown = (el) => !!el && (el.offsetParent !== null || getComputedStyle(el).display !== 'none') && (el.offsetWidth > 0 || el.offsetHeight > 0);
            const modals = Array.from(document.querySelectorAll('.modal, div[role="dialog"]')).filter(isShown);
            const modal = modals.find(m => m.querySelector('input')) || modals[0] || null;
            const modalText = modal ? (modal.innerText || '').replace(/\s+/g, ' ').trim() : '';
            const timerMatch = modalText.match(/(?:மீதமுள்ள|remaining)\s*:\s*(\d+)/i);
            const otpInputs = Array.from(document.querySelectorAll('input[formcontrolname*="otp" i], input[placeholder*="OTP" i], input[placeholder*="கடவுச்சொல்" i]'));
            const otpInp = otpInputs.find(isShown) || otpInputs[0] || null;
            const btns = modal ? Array.from(modal.querySelectorAll('button')) : [];
            const verifyBtn = btns.find(b => (b.innerText || '').includes('பதிவு செய்') || /verify/i.test(b.innerText || ''));
            const resendBtn = btns.find(b => (b.innerText || '').includes('மீண்டும்') || /resend/i.test(b.innerText || ''));
            const errNodes = Array.from(document.querySelectorAll('.p-toast-detail, .alert-danger, .text-danger, .invalid-feedback, .swal2-html-container, div[role="alert"]')).filter(isShown);
            return {
                ok: true,
                url: location.pathname,
                modalOpen: !!modal,
                otpField: otpInp ? (otpInp.getAttribute('formcontrolname') || otpInp.id || 'input') : null,
                otpDigits: otpInp ? (otpInp.value || '').replace(/\D/g, '').length : 0,
                timerSec: timerMatch ? parseInt(timerMatch[1], 10) : null,
                verifyBtn: verifyBtn ? (verifyBtn.disabled ? 'disabled' : 'enabled') : (modal ? 'hidden' : null),
                resendBtn: resendBtn ? (resendBtn.disabled ? 'disabled' : 'enabled') : null,
                errors: errNodes.map(e => (e.innerText || '').trim()).filter(t => t.length > 2).slice(0, 3)
            };
        });
    } catch (e) {
        return { ok: false, error: String(e && e.message ? e.message : e).split('\n')[0].slice(0, 300) };
    }
}

module.exports = { snapshotOtpDomState };
