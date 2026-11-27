/**
 * Universal Strict Step-Completion Gate & Co-Pilot Pause-and-Auto-Resume Helper
 * Enforces Golden Rule 22 (Zero-Skip) + Golden Rule 25 (Zero-Kill Co-Pilot Pause,
 * Silent Cloud Error Telemetry, and Seamless Auto-Resume on Operator Completion).
 */

function reportNonFatalCopilotError({
    serviceName = 'AUTOMATION',
    step = 'UNKNOWN_STEP',
    errorType = 'COPILOT_STEP_STALLED',
    errorMessage = '',
    customerMobile = '',
    extraInfo = {}
} = {}) {
    try {
        const telemetryStore = require('../../services/db/telemetry_store');
        if (telemetryStore && typeof telemetryStore.logOperatorError === 'function') {
            Promise.resolve(telemetryStore.logOperatorError({
                serviceName,
                step,
                errorType,
                errorMessage: String(errorMessage || `Step stalled: ${step}`).slice(0, 1200),
                customerMobile,
                extraInfo: {
                    nonFatalCopilotPause: true,
                    ...(extraInfo && typeof extraInfo === 'object' ? extraInfo : {})
                }
            })).catch(() => {});
        }
    } catch (_) {}
}

/**
 * Universal Co-Pilot Pause & Auto-Resume Gate (Golden Rule 25):
 * - NEVER skips Step N to advance to Step N+1.
 * - NEVER hard-kills the automation when Step N stalls on a portal error.
 * - Immediately logs the non-fatal error silently to Cloud Telemetry for later root-cause fix.
 * - Enters quiet Watch Mode (zero interfering clicks!) with a clear amber HUD until the
 *   human operator completes/fixes Step N, then immediately resumes Step N+1 automatically.
 */
async function waitForCopilotStepRecovery({
    page,
    stepLabel = 'படிநிலை',
    errorMessage = '',
    operatorHint = '',
    serviceName = 'TNPDS_AUTOMATION',
    customerMobile = '',
    checkCompletedFn,
    onProgress = () => {},
    showBrowserHud = async () => {},
    timeoutMs = 600000,
    pollIntervalMs = 1000,
    isMockSandboxMode = false,
    extraInfo = {}
} = {}) {
    if (isMockSandboxMode || !page || typeof checkCompletedFn !== 'function' || timeoutMs <= 0) {
        return { recovered: false, reason: 'mock_or_disabled', result: null };
    }
    if (typeof page.isClosed === 'function' && page.isClosed()) {
        return { recovered: false, reason: 'browser_closed', result: null };
    }

    const cleanErr = String(errorMessage || `${stepLabel} தானாக முடியவில்லை`).trim();
    const hintText = String(
        operatorHint ||
        'நீங்கள் கையால் இந்த ஒரு படியை முடித்தவுடன் ஆட்டோமேஷன் தானாகவே அடுத்த கட்டத்திற்குத் தொடரும்!'
    ).trim();

    // 1. Log silently to Cloud Telemetry immediately so engineering sees every stall later
    reportNonFatalCopilotError({
        serviceName,
        step: stepLabel,
        errorType: 'COPILOT_STEP_STALLED',
        errorMessage: cleanErr,
        customerMobile,
        extraInfo
    });

    // 2. Display clear Watch-Mode amber Co-Pilot banner (never interferes with operator clicks!)
    const hudSub = `${cleanErr} • ${hintText}`;
    await showBrowserHud(`🤝 [Co-Pilot காத்திருப்பு] ${stepLabel}`, hudSub, 'warning', page).catch(() => {});
    onProgress(`🤝 **[Co-Pilot காத்திருப்பு — ${stepLabel}]** ${cleanErr}\n👉 ${hintText} *(பிழை பின்னணியில் எரர் லாக்கில் பதிவு செய்யப்பட்டுவிட்டது — ஆட்டோமேஷன் கட் ஆகாது!)*`);

    // 3. Quiet Watch Loop: poll ONLY for genuine completion (zero auto-clicking while human works)
    const deadline = Date.now() + timeoutMs;
    const waitStep = Math.max(10, Math.min(pollIntervalMs, 2000));
    let lastHudRefreshAt = Date.now();

    while (Date.now() < deadline) {
        if (typeof page.isClosed === 'function' && page.isClosed()) {
            return { recovered: false, reason: 'browser_closed', result: null };
        }

        let checkRes = false;
        try {
            checkRes = await checkCompletedFn();
        } catch (_) {
            checkRes = false;
        }

        const isDone = Boolean(
            checkRes === true ||
            (checkRes && typeof checkRes === 'object' && (checkRes.completed === true || checkRes.ok === true))
        );
        if (isDone) {
            await showBrowserHud(
                `✅ [Co-Pilot தொடர்கிறது] ${stepLabel}`,
                'நீங்கள் இந்தப் படியை முடித்துவிட்டீர்கள் — ஆட்டோமேஷன் அடுத்த கட்டத்திற்குத் தானாகத் தொடர்கிறது!',
                'success',
                page
            ).catch(() => {});
            onProgress(`✅ **[Co-Pilot தொடர்கிறது — ${stepLabel}]** ஆபரேட்டர் இந்தப் படியை முடித்ததை ஆட்டோமேஷன் உணர்ந்தது — அடுத்த கட்டத்திற்குத் தானாகத் தொடர்கிறது!`);
            return { recovered: true, reason: 'operator_completed', result: checkRes };
        }

        if (Date.now() - lastHudRefreshAt >= 15000) {
            lastHudRefreshAt = Date.now();
            await showBrowserHud(`🤝 [Co-Pilot காத்திருப்பு] ${stepLabel}`, hudSub, 'warning', page).catch(() => {});
        }

        if (typeof page.waitForTimeout === 'function') {
            await page.waitForTimeout(waitStep).catch(() => {});
        } else {
            await new Promise((r) => setTimeout(r, waitStep));
        }
    }

    return { recovered: false, reason: 'timeout', result: null };
}

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

async function verifyServerUploadConfirmed(page, inputSelector = 'input[type="file"]', waitMs = 8000, preExistingToasts = []) {
    if (!page || page.isClosed()) return false;
    const deadline = Date.now() + waitMs;
    const prevSet = Array.isArray(preExistingToasts) ? preExistingToasts : [];
    while (Date.now() < deadline) {
        const confirmed = await page.evaluate(({ sel, prevToasts }) => {
            const toasts = Array.from(document.querySelectorAll('.p-toast-message, .toast, .alert-success')).map(t => (t.innerText || '').trim()).filter(Boolean);
            if (toasts.some(t => !prevToasts.includes(t) && (t.includes('வெற்றிகரமாக') || /uploaded\s*successfully/i.test(t)))) return true;
            if (document.querySelector('div[style*="69f777"]')) return true;

            const inputs = Array.from(document.querySelectorAll(sel));
            const targetInp = inputs[inputs.length - 1];
            let container = targetInp ? (targetInp.closest('.form-group, .input-group, .col-md-4, .col-md-6, .col-sm-6') || targetInp.parentElement) : null;
            for (let i = 0; i < 2 && container; i++) {
                const hasClearBtn = Array.from(container.querySelectorAll('button, a')).some(b => {
                    const txt = (b.innerText || '').trim().toLowerCase();
                    return b.offsetParent !== null && (txt === 'x' || txt === '×');
                });
                const greenEl = Array.from(container.querySelectorAll('.badge-success, .badge.bg-success, .bg-success, .text-success, i.fa-check, i.fa-check-circle, .alert-success'))
                    .filter(el => el.offsetParent !== null);
                if (hasClearBtn || greenEl.length > 0) return true;
                container = container.parentElement;
            }
            return false;
        }, { sel: inputSelector, prevToasts: prevSet }).catch(() => false);
        if (confirmed) return true;
        await page.waitForTimeout(500);
    }
    return false;
}

async function enforceStrictStepGate(stepLabel, isCompletedFn, {
    page = null,
    serviceName = 'AUTOMATION',
    customerMobile = '',
    onProgress = () => {},
    showBrowserHud = async () => {},
    failMessage = '',
    operatorHint = '',
    allowCopilotPause = true,
    isMockSandboxMode = false,
    timeoutMs = 600000,
    pollIntervalMs = 1000
} = {}) {
    let ok = false;
    try {
        ok = Boolean(await isCompletedFn());
    } catch (_) {
        ok = false;
    }
    if (ok) return { success: true };

    const msg = failMessage || `${stepLabel} முழுமையாக முடிந்து உறுதி செய்யப்படவில்லை!`;

    // Golden Rule 25: If live page is available, NEVER hard-kill — pause in Watch Mode & auto-resume when operator finishes!
    if (page && allowCopilotPause && !isMockSandboxMode) {
        const rec = await waitForCopilotStepRecovery({
            page,
            stepLabel,
            errorMessage: msg,
            operatorHint,
            serviceName,
            customerMobile,
            checkCompletedFn: isCompletedFn,
            onProgress,
            showBrowserHud,
            timeoutMs,
            pollIntervalMs,
            isMockSandboxMode
        });
        if (rec.recovered) {
            return { success: true, recoveredByOperator: true, result: rec.result };
        }
    }

    await showBrowserHud(`🔴 ${stepLabel} நிறுத்தம்`, msg, 'error', page).catch(() => {});
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
    reportNonFatalCopilotError,
    waitForCopilotStepRecovery,
    waitForOtpModalOpened,
    verifyServerUploadConfirmed,
    enforceStrictStepGate,
    fillAndVerifyInput,
    selectAndVerifyOption
};
