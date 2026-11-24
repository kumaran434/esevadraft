/**
 * Universal Strict Step-Completion Gate Helper (Golden Rule 22)
 * Ensures Step N never advances to Step N+1 without genuine server/DOM confirmation.
 */

async function waitForOtpModalOpened(page, timeoutMs = 10000) {
    if (!page || page.isClosed()) return false;
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const opened = await page.evaluate(() => {
            const modals = Array.from(document.querySelectorAll('.modal, div[role="dialog"], .modal-dialog'));
            return modals.some(m => {
                const s = window.getComputedStyle(m);
                const isVis = (m.offsetParent !== null || s.display !== 'none' || m.classList.contains('show') || m.classList.contains('in'))
                    && s.visibility !== 'hidden' && !m.classList.contains('hidden');
                if (!isVis) return false;
                const txt = (m.innerText || '').trim();
                if (txt.includes('வெளியேற விரும்புகிறீர்களா')) return false;
                const hasOtpInp = Boolean(m.querySelector('input:not([type="hidden"]):not([disabled]):not([readonly])'));
                return txt.includes('OTP') || txt.includes('கடவுச்சொல்') || hasOtpInp;
            });
        }).catch(() => false);
        if (opened) return true;
        await page.waitForTimeout(500);
    }
    return false;
}

async function verifyServerUploadConfirmed(page, inputSelector = 'input[type="file"]', waitMs = 8000) {
    if (!page || page.isClosed()) return false;
    const deadline = Date.now() + waitMs;
    while (Date.now() < deadline) {
        const confirmed = await page.evaluate((sel) => {
            const toasts = Array.from(document.querySelectorAll('.p-toast-message, .toast, .alert-success')).map(t => (t.innerText || '').trim());
            if (toasts.some(t => t.includes('வெற்றிகரமாக') || /uploaded\s*successfully/i.test(t))) return true;
            if (document.querySelector('div[style*="69f777"]')) return true;

            const inputs = Array.from(document.querySelectorAll(sel));
            const targetInp = inputs[inputs.length - 1];
            let container = targetInp ? targetInp.parentElement : null;
            for (let i = 0; i < 4 && container; i++) {
                const hasClearBtn = Array.from(container.querySelectorAll('button, a')).some(b => {
                    const txt = (b.innerText || '').trim().toLowerCase();
                    return b.offsetParent !== null && (txt === 'x' || txt === '×');
                });
                const uploadBtn = Array.from(container.querySelectorAll('button, div.btn')).find(b => {
                    const t = (b.innerText || '').toLowerCase();
                    return t.includes('பதிவேற்ற') || t.includes('upload');
                });
                const isUploadDisabled = uploadBtn ? (uploadBtn.disabled || uploadBtn.getAttribute('disabled') !== null) : false;
                const greenEl = container.querySelectorAll('.badge-success, .badge.bg-success, .bg-success, .text-success, i.fa-check, i.fa-check-circle, .alert-success');
                if (hasClearBtn || isUploadDisabled || greenEl.length > 0) return true;
                container = container.parentElement;
            }
            return false;
        }, inputSelector).catch(() => false);
        if (confirmed) return true;
        await page.waitForTimeout(500);
    }
    return false;
}

async function enforceStrictStepGate(stepLabel, isCompletedFn, { onProgress = () => {}, showBrowserHud = async () => {}, failMessage = '' } = {}) {
    let ok = false;
    try {
        ok = Boolean(await isCompletedFn());
    } catch (_) {
        ok = false;
    }
    if (ok) return { success: true };

    const msg = failMessage || `${stepLabel} முழுமையாக முடிந்து உறுதி செய்யப்படவில்லை! அடுத்த படிக்குச் செல்லாமல் செயல்முறை பாதுகாப்பாக நிறுத்தப்படுகிறது.`;
    await showBrowserHud(`🔴 ${stepLabel} நிறுத்தம்`, msg, 'error').catch(() => {});
    onProgress(`⚠️ **கடும் பூட்டு நிறுத்தம் (Strict Gate Halt):** ${msg}`);
    return { success: false, step: stepLabel, message: msg };
}

async function fillAndVerifyInput(page, locator, value, stepLabel, { required = true, domSelector = null } = {}) {
    const targetVal = String(value ?? '').trim();
    if (required && !targetVal) {
        throw new Error(`${stepLabel} பிழை: கட்டாய மதிப்பு காலியாக உள்ளது.`);
    }
    if (await locator.count() === 0) {
        if (required) throw new Error(`${stepLabel} பிழை: உள்ளீட்டுக் களம் திரையில் இல்லை.`);
        return '';
    }
    await locator.evaluate(el => {
        el.disabled = false;
        el.removeAttribute('disabled');
        el.removeAttribute('readonly');
        el.readOnly = false;
    }).catch(() => {});
    await locator.fill(targetVal).catch(() => {});
    await locator.dispatchEvent('input').catch(() => {});
    await locator.dispatchEvent('change').catch(() => {});
    await locator.dispatchEvent('blur').catch(() => {});

    let actual = (await locator.inputValue().catch(() => '')).trim();
    if (!actual && targetVal && domSelector) {
        await page.evaluate(({ sel, val }) => {
            const el = document.querySelector(sel);
            if (el) {
                el.disabled = false;
                el.removeAttribute('disabled');
                el.removeAttribute('readonly');
                el.value = val;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                el.dispatchEvent(new Event('blur', { bubbles: true }));
            }
        }, { sel: domSelector, val: targetVal }).catch(() => {});
        actual = (await locator.inputValue().catch(() => '')).trim();
    }
    if (required && !actual) {
        throw new Error(`${stepLabel} பிழை: மதிப்பு (${targetVal}) உள்ளிடப்படவில்லை — அடுத்த படிக்குச் செல்ல முடியாது.`);
    }
    return actual;
}

async function selectAndVerifyOption(locator, stepLabel, { value = null, index = null, required = true } = {}) {
    if (await locator.count() === 0) {
        if (required) throw new Error(`${stepLabel} பிழை: தேர்வுப் பட்டியல் திரையில் இல்லை.`);
        return '';
    }
    await locator.evaluate(el => {
        el.disabled = false;
        el.removeAttribute('disabled');
    }).catch(() => {});
    if (value !== null && value !== undefined) {
        await locator.selectOption(value).catch(() => {});
    } else if (index !== null && index !== undefined) {
        await locator.selectOption({ index }).catch(() => {});
    }
    await locator.dispatchEvent('input').catch(() => {});
    await locator.dispatchEvent('change').catch(() => {});

    const selected = await locator.evaluate(sel => {
        if (!sel || sel.selectedIndex < 0) return { ok: false, val: '', text: '' };
        const opt = sel.options[sel.selectedIndex];
        const text = (opt?.text || '').trim();
        const val = String(sel.value || '').trim();
        const isPlaceholder = !val || val === '0' || text.includes('தேர்ந்தெடுக்கவும்') || /^select\b/i.test(text);
        return { ok: !isPlaceholder, val, text };
    }).catch(() => ({ ok: false, val: '', text: '' }));

    if (required && !selected.ok) {
        throw new Error(`${stepLabel} பிழை: சரியான விருப்பம் தேர்ந்தெடுக்கப்படவில்லை — அடுத்த படிக்குச் செல்ல முடியாது.`);
    }
    return selected.text || selected.val;
}

module.exports = {
    waitForOtpModalOpened,
    verifyServerUploadConfirmed,
    enforceStrictStepGate,
    fillAndVerifyInput,
    selectAndVerifyOption
};
