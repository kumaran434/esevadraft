/**
 * Zero-Touch Operator Chrome Edit Tracker
 * Wraps Playwright Chromium so whenever a human operator manually edits
 * any portal field in Chrome, the exact Before -> After diff is captured
 * without modifying any frozen TNeGA or TNPDS engine code.
 */

function maskAadhaarAndDigits(val) {
    return String(val || '')
        .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, 'XXXX-XXXX-XXXX')
        .trim()
        .slice(0, 200);
}

const CHROME_EDIT_INIT_SCRIPT = () => {
    try {
        if (window.__esevaEditTrackerInstalled) return;
        window.__esevaEditTrackerInstalled = true;

        const SENSITIVE_RE = /password|passwd|pwd|otp|pin|passcode|captcha|verificationcode/i;

        const isIgnoredField = (el) => {
            if (!el || !el.tagName) return true;
            const tag = el.tagName.toUpperCase();
            if (tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'TEXTAREA') return true;
            const type = String(el.type || '').toLowerCase();
            if (['hidden', 'file', 'password', 'submit', 'button', 'reset', 'image'].includes(type)) return true;
            const meta = `${el.id || ''} ${el.name || ''} ${el.getAttribute('formcontrolname') || ''} ${el.placeholder || ''}`;
            return SENSITIVE_RE.test(meta);
        };

        const getFieldValue = (el) => {
            if (!el) return '';
            if (el.tagName === 'SELECT') {
                const opt = el.options && el.selectedIndex >= 0 ? el.options[el.selectedIndex] : null;
                return (opt ? `${opt.text || opt.value}` : el.value || '').trim();
            }
            if (el.type === 'checkbox' || el.type === 'radio') {
                return el.checked ? 'checked' : 'unchecked';
            }
            return String(el.value || '').trim();
        };

        const getFieldLabel = (el) => {
            try {
                if (el.id) {
                    const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
                    if (lbl && lbl.innerText) return lbl.innerText.trim().slice(0, 80);
                }
                const fg = el.closest('.form-group, td, tr, .col-md-4, .col-md-6, div');
                if (fg) {
                    const lbl = fg.querySelector('label, th');
                    if (lbl && lbl.innerText) return lbl.innerText.trim().slice(0, 80);
                    if (fg.tagName === 'TD' && fg.previousElementSibling && fg.previousElementSibling.innerText) {
                        return fg.previousElementSibling.innerText.trim().slice(0, 80);
                    }
                }
                return (el.getAttribute('formcontrolname') || el.name || el.id || el.placeholder || el.tagName).slice(0, 80);
            } catch (_) {
                return String(el.id || el.name || 'field').slice(0, 80);
            }
        };

        document.addEventListener('focusin', (e) => {
            try {
                const el = e.target;
                if (!e.isTrusted || isIgnoredField(el)) return;
                if (el.dataset.esevaEditBaseline === undefined) {
                    el.dataset.esevaEditBaseline = getFieldValue(el);
                }
            } catch (_) {}
        }, true);

        const handleHumanCommit = (e) => {
            try {
                const el = e.target;
                if (!e.isTrusted || isIgnoredField(el)) return;
                const afterVal = getFieldValue(el);
                const beforeVal = el.dataset.esevaEditBaseline !== undefined ? el.dataset.esevaEditBaseline : '';
                if (afterVal === beforeVal) return;
                el.dataset.esevaEditBaseline = afterVal;

                const fieldKey = (el.getAttribute('formcontrolname') || el.id || el.name || getFieldLabel(el)).slice(0, 80);
                if (typeof window.__esevaRecordFieldEdit === 'function') {
                    window.__esevaRecordFieldEdit({
                        fieldKey,
                        fieldLabel: getFieldLabel(el),
                        beforeVal,
                        afterVal,
                        url: window.location.pathname || window.location.href || ''
                    });
                }
            } catch (_) {}
        };

        document.addEventListener('change', handleHumanCommit, true);
        document.addEventListener('blur', handleHumanCommit, true);
    } catch (_) {}
};

async function attachTrackerToContext(context, onEditCallback) {
    if (!context || context.__esevaTrackerAttached) return context;
    context.__esevaTrackerAttached = true;

    try {
        if (typeof context.exposeFunction === 'function') {
            await context.exposeFunction('__esevaRecordFieldEdit', (payload = {}) => {
                try {
                    const cleanEvent = {
                        fieldKey: String(payload.fieldKey || '').slice(0, 80),
                        fieldLabel: String(payload.fieldLabel || payload.fieldKey || '').slice(0, 80),
                        beforeVal: maskAadhaarAndDigits(payload.beforeVal),
                        afterVal: maskAadhaarAndDigits(payload.afterVal),
                        url: String(payload.url || '').slice(0, 120),
                        editedAt: new Date().toISOString()
                    };
                    if (typeof onEditCallback === 'function') onEditCallback(cleanEvent);
                } catch (_) {}
            }).catch(() => {});
        }
        if (typeof context.addInitScript === 'function') {
            await context.addInitScript(CHROME_EDIT_INIT_SCRIPT).catch(() => {});
        }
    } catch (_) {}
    return context;
}

function wrapChromiumWithEditTracker(rawChromium, onEditCallback) {
    if (!rawChromium || typeof rawChromium !== 'object') return rawChromium;
    return new Proxy(rawChromium, {
        get(target, prop) {
            if (prop === 'launchPersistentContext') {
                return async (...args) => {
                    const ctx = await target.launchPersistentContext(...args);
                    await attachTrackerToContext(ctx, onEditCallback);
                    return ctx;
                };
            }
            if (prop === 'launch') {
                return async (...args) => {
                    const browser = await target.launch(...args);
                    if (!browser || typeof browser !== 'object') return browser;
                    return new Proxy(browser, {
                        get(bTarget, bProp) {
                            if (bProp === 'newContext') {
                                return async (...cArgs) => {
                                    const ctx = await bTarget.newContext(...cArgs);
                                    await attachTrackerToContext(ctx, onEditCallback);
                                    return ctx;
                                };
                            }
                            if (bProp === 'newPage') {
                                return async (...pArgs) => {
                                    const page = await bTarget.newPage(...pArgs);
                                    if (page && typeof page.context === 'function') {
                                        await attachTrackerToContext(page.context(), onEditCallback);
                                        await page.evaluate(CHROME_EDIT_INIT_SCRIPT).catch(() => {});
                                    }
                                    return page;
                                };
                            }
                            const val = Reflect.get(bTarget, bProp);
                            return typeof val === 'function' ? val.bind(bTarget) : val;
                        }
                    });
                };
            }
            const val = Reflect.get(target, prop);
            return typeof val === 'function' ? val.bind(target) : val;
        }
    });
}

module.exports = {
    CHROME_EDIT_INIT_SCRIPT,
    attachTrackerToContext,
    wrapChromiumWithEditTracker
};
