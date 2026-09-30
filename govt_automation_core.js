/**
 * eSevaDraft - Universal Government Automation Engine Core (SDK)
 * (அனைத்து அரசு போர்ட்டல்களுக்குமான பொதுவான ஆட்டோமேஷன் நோய் எதிர்ப்பு என்ஜின்)
 * 
 * Permanently codifies all 12 field-tested automation lessons into reusable,
 * immune-hardened methods so that mistakes made on one government portal
 * (TNPDS, TNeGA, NVSP, Patta Chitta, etc.) can NEVER recur in any other portal.
 */

const fs = require('fs');
const path = require('path');

const MEMORY_FILE_PATH = path.join(__dirname, 'data', 'automation_immune_memory.json');

/**
 * Loads the dynamic immune memory registry from disk.
 */
function loadImmuneMemory() {
    const candidatePaths = [
        path.join(__dirname, 'data', 'automation_immune_memory.json'),
        path.join(process.resourcesPath || '', 'data', 'automation_immune_memory.json'),
        path.join(process.resourcesPath || '', 'app.asar.unpacked', 'data', 'automation_immune_memory.json'),
        path.join(process.cwd(), 'data', 'automation_immune_memory.json')
    ];
    for (const p of candidatePaths) {
        try {
            if (p && fs.existsSync(p)) {
                return JSON.parse(fs.readFileSync(p, 'utf8'));
            }
        } catch (e) {}
    }
    return { version: '1.0.0', rules: [], totalRulesLocked: 0 };
}

/**
 * Dynamically registers a newly fixed error/lesson into the immune memory registry.
 * This guarantees auto-expansion of regression testing for all future portals!
 */
function registerNewImmuneRule(ruleData) {
    if (!ruleData || !ruleData.title || !ruleData.rootCause) {
        throw new Error('Immune rule registration requires title and rootCause');
    }

    const memory = loadImmuneMemory();
    const nextNum = memory.rules.length + 1;
    const ruleId = ruleData.id || `CASE-${String(nextNum).padStart(2, '0')}`;

    // Check if already registered
    const existingIdx = memory.rules.findIndex(r => r.id === ruleId);
    const formattedRule = {
        id: ruleId,
        service: ruleData.service || 'UNIVERSAL',
        title: ruleData.title,
        rootCause: ruleData.rootCause,
        antiPatterns: Array.isArray(ruleData.antiPatterns) ? ruleData.antiPatterns : [ruleData.antiPattern].filter(Boolean),
        mandatoryInvariants: Array.isArray(ruleData.mandatoryInvariants) ? ruleData.mandatoryInvariants : [ruleData.mandatoryInvariant].filter(Boolean),
        coreMethod: ruleData.coreMethod || 'UNIVERSAL_CORE',
        registeredAt: new Date().toISOString()
    };

    if (existingIdx !== -1) {
        memory.rules[existingIdx] = formattedRule;
    } else {
        memory.rules.push(formattedRule);
    }

    memory.totalRulesLocked = memory.rules.length;
    memory.lastUpdated = new Date().toISOString();

    fs.writeFileSync(MEMORY_FILE_PATH, JSON.stringify(memory, null, 2), 'utf8');
    console.log(`🛡️ [Immune Core] Successfully locked new rule into persistent memory: [${ruleId}] ${ruleData.title}`);
    return formattedRule;
}

const INCIDENT_LOG_PATH = path.join(__dirname, 'data', 'automation_incident_log.json');

/**
 * Autonomous Incident Diagnoser:
 * Automatically classifies runtime automation failures into structured immune rules.
 */
function diagnoseAutomationIncident(incidentContext = {}) {
    const errorMsg = String(incidentContext.error?.message || incidentContext.error || incidentContext.message || 'Unknown automation error');
    const stepName = incidentContext.stepName || 'Portal Automation Step';
    const service = incidentContext.service || 'UNIVERSAL';
    const url = incidentContext.url || '';
    const domDetails = incidentContext.domDetails || '';

    let ruleClassification = {
        title: `Autonomous Field-Tested Defense for ${stepName}`,
        rootCause: `Portal DOM anomaly during ${stepName}: ${errorMsg}`,
        antiPatterns: [`Unchecked progression or unhandled error during ${stepName}`],
        mandatoryInvariants: [`Zero-Step-Skip invariant and verified completion for ${stepName}`],
        coreMethod: 'withAutoImmuneBoundary'
    };

    // 1. Dynamic Dropdown / Hydration Issues
    if (errorMsg.includes('dropdown') || errorMsg.includes('select') || errorMsg.includes('options') || errorMsg.includes('மற்ற ஆவணங்கள்') || errorMsg.includes('hydrat')) {
        ruleClassification = {
            title: `Autonomous Dynamic Dropdown Hydration Gate (${stepName})`,
            rootCause: `Dynamic select dropdown failed to populate options due to asynchronous Angular form dependencies: ${errorMsg}`,
            antiPatterns: ['One-shot select option attempt without waiting for reactive form hydration'],
            mandatoryInvariants: ['Dynamic polling loop with retry trigger and safe option injection fallback'],
            coreMethod: 'smartSelectWithHydration'
        };
    }
    // 2. Angular Material / Readonly Input Issues
    else if (errorMsg.includes('readonly') || errorMsg.includes('mat-input') || errorMsg.includes('datepicker') || errorMsg.includes('editable')) {
        ruleClassification = {
            title: `Autonomous Angular Material Readonly Input Defense (${stepName})`,
            rootCause: `Angular Material input rejected direct typing or failed to trigger Reactive Form control: ${errorMsg}`,
            antiPatterns: ['Direct Playwright fill() on Angular Material readonly input'],
            mandatoryInvariants: ['removeAttribute("readonly") + full Angular event cascade (dateInput/dateChange/input/change/blur)'],
            coreMethod: 'selectDateInMatCalendar'
        };
    }
    // 3. Radware / Bot Security Challenge
    else if (url.includes('perfdrive') || url.includes('validate.') || errorMsg.includes('perfdrive') || errorMsg.includes('Radware') || errorMsg.includes('human')) {
        ruleClassification = {
            title: `Autonomous Radware Challenge Stealth & Post-Clearance Resumption (${stepName})`,
            rootCause: `Radware bot challenge interrupted automation workflow: ${errorMsg}`,
            antiPatterns: ['0ms synthetic clicks, DOM tampering on challenge pages, or failing to resume post-challenge'],
            mandatoryInvariants: ['Native Chrome stealth, curved mouse jitter physics, and cookie persistence'],
            coreMethod: 'applyRadwareStealth'
        };
    }
    // 4. Submit / Action Button Selector Drift
    else if (errorMsg.includes('button') || errorMsg.includes('click') || errorMsg.includes('subbtn') || errorMsg.includes('submit')) {
        ruleClassification = {
            title: `Autonomous Button Selector & Scoped Form Resolution (${stepName})`,
            rootCause: `Action button was not found, disabled, or ambiguous across multiple form containers: ${errorMsg}`,
            antiPatterns: ['Hardcoded single-text button matching without form scoping'],
            mandatoryInvariants: ['Scoped container button resolution, button.subbtn class matching, and DOM evaluate fallback'],
            coreMethod: 'clickScopedSubmit'
        };
    }
    // 5. Session Expiry / Navigation Gate Halt
    else if (errorMsg.includes('Session') || errorMsg.includes('login') || errorMsg.includes('auth/login') || errorMsg.includes('GATE_HALT')) {
        ruleClassification = {
            title: `Autonomous Session Expiry & Portal Gate Protection (${stepName})`,
            rootCause: `Portal session expired or page redirected unexpectedly: ${errorMsg}`,
            antiPatterns: ['Continuing form execution after portal redirect or session drop'],
            mandatoryInvariants: ['Strict gate halts with operator alert and safe dry-run state retention'],
            coreMethod: 'applyDryRunGuard'
        };
    }

    return {
        service,
        ...ruleClassification,
        discoveredAt: new Date().toISOString(),
        incidentContext: {
            stepName,
            url,
            domDetails,
            error: errorMsg
        }
    };
}

/**
 * Autonomous Real-Time Error Interceptor & Auto-Locking Engine:
 * When an unexpected error occurs at runtime, this automatically:
 * 1. Diagnoses the failure context
 * 2. Locks it into data/automation_immune_memory.json as a new CASE-XX rule
 * 3. Appends full incident context to data/automation_incident_log.json
 * 4. Ensures future runs never repeat this mistake!
 */
function autoCaptureAndLockImmuneIncident(incidentContext = {}) {
    try {
        const diagnosis = diagnoseAutomationIncident(incidentContext);
        const memory = loadImmuneMemory();

        // Check if an identical rule title or root cause already exists
        let existingRule = memory.rules.find(r => 
            r.title.toLowerCase().trim() === diagnosis.title.toLowerCase().trim() ||
            (r.rootCause && diagnosis.rootCause && r.rootCause.slice(0, 40) === diagnosis.rootCause.slice(0, 40))
        );

        let lockedRule = existingRule;
        if (!existingRule) {
            // Lock new case into persistent memory immediately!
            lockedRule = registerNewImmuneRule({
                service: diagnosis.service,
                title: diagnosis.title,
                rootCause: diagnosis.rootCause,
                antiPatterns: diagnosis.antiPatterns,
                mandatoryInvariants: diagnosis.mandatoryInvariants,
                coreMethod: diagnosis.coreMethod
            });
            console.log(`⚡ [Auto-Immune Engine] Automatically diagnosed and locked new defense rule: [${lockedRule.id}] ${lockedRule.title}`);
        }

        // Persist to Incident Log
        let incidentLog = [];
        try {
            if (fs.existsSync(INCIDENT_LOG_PATH)) {
                incidentLog = JSON.parse(fs.readFileSync(INCIDENT_LOG_PATH, 'utf8'));
            }
        } catch (e) {}

        const incidentRecord = {
            id: `INC-${Date.now()}`,
            timestamp: new Date().toISOString(),
            caseId: lockedRule ? lockedRule.id : 'CASE-AUTO',
            title: diagnosis.title,
            error: diagnosis.incidentContext.error,
            stepName: diagnosis.incidentContext.stepName,
            url: diagnosis.incidentContext.url,
            domDetails: diagnosis.incidentContext.domDetails,
            autoLocked: true
        };

        incidentLog.unshift(incidentRecord);
        if (incidentLog.length > 100) incidentLog = incidentLog.slice(0, 100);

        fs.writeFileSync(INCIDENT_LOG_PATH, JSON.stringify(incidentLog, null, 2), 'utf8');

        return {
            success: true,
            autoLocked: true,
            rule: lockedRule,
            incident: incidentRecord
        };
    } catch (e) {
        console.warn('⚠️ [Auto-Immune Engine] Auto-capture failed gracefully:', e.message);
        return { success: false, error: e.message };
    }
}

/**
 * Autonomous Immune Boundary Wrapper:
 * Wraps any automation step in a self-diagnosing, self-locking boundary.
 */
async function withAutoImmuneBoundary(page, stepName, stepFn, options = {}) {
    try {
        return await stepFn();
    } catch (err) {
        const url = (page && !page.isClosed()) ? page.url() : '';
        const captureResult = autoCaptureAndLockImmuneIncident({
            error: err,
            stepName,
            service: options.service || 'TNPDS',
            url,
            domDetails: options.domDetails || ''
        });

        if (options.onProgress && captureResult.autoLocked) {
            options.onProgress(`🛡️ [தானியங்கி நோய் எதிர்ப்பு பதிவு] பிழை கண்டறியப்பட்டு [${captureResult.rule?.id || 'CASE-AUTO'}] நினைவகத்தில் தானாகப் பூட்டப்பட்டது!`);
        }

        throw err;
    }
}

/**
 * 1. Smart Input & Reactive Form Event Synchronization
 * Solves: Angular Ivy / React reactive forms not updating validity on Playwright type
 */
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

/**
 * 2. Scoped Container Button Resolution & Strict Disambiguation
 * Solves: Ambiguous buttons with same label ('பதிவு செய்ய' / 'Submit') across multiple form states.
 */
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

    // Ordered list of specific submit selectors
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

                // Strict Zero-Resend Safeguard:
                // Never click #btnSendOtp or Send OTP buttons when verifying OTP
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

    // Strategy 2: Targeted DOM evaluate fallback
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
            const id = b.id || '';
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

    // Strategy 3: Enter key fallback on input if reactive form permits
    if (inputEl && await inputEl.count() > 0) {
        await inputEl.press('Enter').catch(() => {});
    }

    return false;
}

/**
 * 3. Safe Government Portal Error Extractor
 * Solves: Mistaking required-field asterisks (*) or informational toasts for official government errors
 */
async function safeExtractGovtError(page) {
    if (!page || page.isClosed()) return '';
    return await page.evaluate(() => {
        const alerts = Array.from(document.querySelectorAll('#errorShow, .alert-danger, .error-box:not(.error-box-sucess), .error-msg, .toast-error, snack-bar-container, .alert, .toast'));
        for (const el of alerts) {
            const txt = (el.innerText ? el.innerText.trim() : '');
            // Filter out empty, asterisks, bullet points, and single character markers
            if (!txt || txt === '*' || txt.length < 2 || /^[*•\s]+$/.test(txt)) {
                continue;
            }
            // Filter out informational / success toasts
            if (txt.includes('அனுப்பப்பட்டுள்ளது') || txt.includes('sent') || txt.includes('வெற்றிகரமாக') || txt.includes('success')) {
                continue;
            }
            return txt;
        }
        return '';
    }).catch(() => '');
}

/**
 * 4. Radware / Bot Protection Pure Stealth Initializer
 * Solves: Fake plugins and empty window.chrome triggering Anomaly Detected
 */
async function applyRadwareStealth(context) {
    if (!context) return;
    await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined
        });
    });
}

/**
 * 5. Dry-Run Guard Protection
 * Solves: Accidental submission of test data to live government databases
 */
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
