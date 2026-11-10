/**
 * eSevaDraft - Universal Government Automation Engine Core (SDK)
 * (அனைத்து அரசு போர்ட்டல்களுக்குமான பொதுவான ஆட்டோமேஷன் நோய் எதிர்ப்பு என்ஜின்)
 */

const {
    loadImmuneMemory,
    registerNewImmuneRule,
    diagnoseAutomationIncident,
    autoCaptureAndLockImmuneIncident,
    withAutoImmuneBoundary,
    MEMORY_FILE_PATH,
    INCIDENT_LOG_PATH
} = require('./src/services/automation_immune_diagnoser');

async function smartFill(page, locatorOrSelector, value, options = {}) {
    if (!page || page.isClosed()) return false;
    const loc = typeof locatorOrSelector === 'string' ? page.locator(locatorOrSelector).first() : locatorOrSelector;
    if (await loc.count() === 0) return false;

    await loc.click().catch(() => {});
    await loc.fill('');
    await loc.pressSequentially(String(value), { delay: options.delay || 75 });
    await loc.dispatchEvent('input').catch(() => {});
    await loc.dispatchEvent('change').catch(() => {});
    if (options.blur) {
        await loc.dispatchEvent('blur').catch(() => {});
    }
    await page.waitForTimeout(options.waitAfter || 200);
    return true;
}

async function clickScopedSubmit(page, inputLocatorOrSelector, options = {}) {
    if (!page || page.isClosed()) return false;

    let container = null;
    let inputEl = null;

    if (inputLocatorOrSelector) {
        inputEl = typeof inputLocatorOrSelector === 'string' ? page.locator(inputLocatorOrSelector).first() : inputLocatorOrSelector;
        if (await inputEl.count() > 0) {
            container = inputEl.locator('xpath=ancestor::form | ancestor::div[contains(@class,"form-group")] | ancestor::div[contains(@class,"row")] | ancestor::div[contains(@class,"modal")]').first();
        }
    }

    const searchScope = (container && await container.count() > 0) ? container : page;

    const primarySelectors = [
        '#btnLogin:visible',
        'button.subbtn:visible',
        'button[type="button"].subbtn:visible',
        'button.btn-success:has-text("உள்நுழைக"):visible',
        'button:has-text("உள்நுழைக"):visible',
        'button:has-text("Verify"):visible',
        'button:has-text("சரிபார்"):visible',
        'button:has-text("சமர்ப்பிக்க"):visible',
        'button[type="submit"]:visible',
        'input[type="submit"]:visible'
    ];

    for (const sel of primarySelectors) {
        try {
            const btn = searchScope.locator(sel).first();
            if (await btn.count() > 0 && await btn.isVisible().catch(() => false)) {
                const btnId = (await btn.getAttribute('id').catch(() => '')) || '';
                const btnClass = (await btn.getAttribute('class').catch(() => '')) || '';
                const btnText = (await btn.innerText().catch(() => '')) || '';
                const btnVal = (await btn.getAttribute('value').catch(() => '')) || '';
                const isSubBtn = btnClass.includes('subbtn');
                const idLower = btnId.toLowerCase();
                const combinedText = (btnText + ' ' + btnVal).trim();

                if (!options.isSendOtpAction && (
                    idLower === 'btnsendotp' ||
                    idLower.includes('sendotp') ||
                    idLower.includes('resend') ||
                    (!isSubBtn && combinedText.includes('பதிவு செய்ய')) ||
                    combinedText.includes('மறுமுறை') ||
                    combinedText.includes('மீண்டும்') ||
                    combinedText.includes('அனுப்ப') ||
                    combinedText.includes('Send OTP')
                )) {
                    continue;
                }
                if (!isSubBtn && !options.isSendOtpAction && (btnId === 'btnSendOtp' || btnText.includes('பதிவு செய்ய') || btnVal.includes('பதிவு செய்ய'))) {
                    continue;
                }

                await btn.hover().catch(() => {});
                await page.waitForTimeout(100);
                await btn.click({ delay: 80, force: options.force || false }).catch(() => {});
                return true;
            }
        } catch (e) {}
    }

    const clickedDom = await page.evaluate((isSend) => {
        const isSendOtp = (el) => {
            if (!el) return true;
            const id = (el.id || '').toLowerCase();
            const txt = (el.innerText || el.value || '').trim();
            const isSub = el.classList && el.classList.contains('subbtn');
            return id === 'btnsendotp' || id.includes('sendotp') || id.includes('resend') || (!isSub && txt.includes('பதிவு செய்ய')) || txt.includes('மறுமுறை') || txt.includes('மீண்டும்') || txt.includes('அனுப்ப');
        };

        const subBtn = Array.from(document.querySelectorAll('button.subbtn:not([disabled]), button[class*="subbtn"]:not([disabled]), #btnLogin:not([disabled])'))
            .find(b => (isSend ? isSendOtp(b) : !isSendOtp(b)));
        if (subBtn) {
            subBtn.click();
            return true;
        }

        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]'));
        const targetBtn = buttons.find(b => {
            const text = (b.innerText || b.value || '').trim();
            const isSub = b.classList.contains('subbtn');
            if (!isSend && isSendOtp(b)) return false;
            if (isSub && (isSend || !isSendOtp(b))) return true;
            return text.includes('உள்நுழைக') || text.includes('Verify') || text.includes('சரிபார்') || text.includes('சமர்ப்பிக்க');
        });

        if (targetBtn && !targetBtn.disabled) {
            targetBtn.click();
            return true;
        }
        return false;
    }, Boolean(options.isSendOtpAction)).catch(() => false);

    if (clickedDom) return true;

    if (inputEl && await inputEl.count() > 0) {
        await inputEl.press('Enter').catch(() => {});
    }

    return false;
}

async function safeExtractGovtError(page) {
    if (!page || page.isClosed()) return '';
    return await page.evaluate(() => {
        const alerts = Array.from(document.querySelectorAll('#errorShow, .alert-danger, .error-box:not(.error-box-sucess), .error-msg, .toast-error, snack-bar-container, .alert, .toast'));
        for (const el of alerts) {
            const txt = (el.innerText ? el.innerText.trim() : '');
            if (!txt || txt === '*' || txt.length < 2 || /^[*•\s]+$/.test(txt)) {
                continue;
            }
            if (txt.includes('அனுப்பப்பட்டுள்ளது') || txt.includes('sent') || txt.includes('வெற்றிகரமாக') || txt.includes('success')) {
                continue;
            }
            return txt;
        }
        return '';
    }).catch(() => '');
}

async function applyRadwareStealth(context) {
    if (!context) return;
    await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined
        });
    });
}

function applyDryRunGuard(options = {}) {
    const isLiveRequested = options.enableFinalSubmit === true;
    const isMock = options.isMockSandbox === true;
    return {
        canSubmitLive: isLiveRequested && !isMock,
        reason: isMock ? 'Mock sandbox active' : (isLiveRequested ? 'Live mode confirmed' : 'Dry-run safety lock active')
    };
}

module.exports = {
    loadImmuneMemory,
    registerNewImmuneRule,
    diagnoseAutomationIncident,
    autoCaptureAndLockImmuneIncident,
    withAutoImmuneBoundary,
    smartFill,
    clickScopedSubmit,
    safeExtractGovtError,
    applyRadwareStealth,
    applyDryRunGuard,
    MEMORY_FILE_PATH,
    INCIDENT_LOG_PATH
};
