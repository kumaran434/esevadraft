const fs = require('fs');
const path = require('path');

const MEMORY_FILE_PATH = path.join(__dirname, '..', '..', 'data', 'automation_immune_memory.json');
const INCIDENT_LOG_PATH = path.join(__dirname, '..', '..', 'data', 'automation_incident_log.json');

function loadImmuneMemory() {
    const candidatePaths = [
        MEMORY_FILE_PATH,
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

function registerNewImmuneRule(ruleData) {
    if (!ruleData || !ruleData.title || !ruleData.rootCause) {
        throw new Error('Immune rule registration requires title and rootCause');
    }

    const memory = loadImmuneMemory();
    const nextNum = memory.rules.length + 1;
    const ruleId = ruleData.id || `CASE-${String(nextNum).padStart(2, '0')}`;

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

    if (errorMsg.includes('dropdown') || errorMsg.includes('select') || errorMsg.includes('options') || errorMsg.includes('மற்ற ஆவணங்கள்') || errorMsg.includes('hydrat')) {
        ruleClassification = {
            title: `Autonomous Dynamic Dropdown Hydration Gate (${stepName})`,
            rootCause: `Dynamic select dropdown failed to populate options due to asynchronous Angular form dependencies: ${errorMsg}`,
            antiPatterns: ['One-shot select option attempt without waiting for reactive form hydration'],
            mandatoryInvariants: ['Dynamic polling loop with retry trigger and safe option injection fallback'],
            coreMethod: 'smartSelectWithHydration'
        };
    } else if (errorMsg.includes('readonly') || errorMsg.includes('mat-input') || errorMsg.includes('datepicker') || errorMsg.includes('editable')) {
        ruleClassification = {
            title: `Autonomous Angular Material Readonly Input Defense (${stepName})`,
            rootCause: `Angular Material input rejected direct typing or failed to trigger Reactive Form control: ${errorMsg}`,
            antiPatterns: ['Direct Playwright fill() on Angular Material readonly input'],
            mandatoryInvariants: ['removeAttribute("readonly") + full Angular event cascade (dateInput/dateChange/input/change/blur)'],
            coreMethod: 'selectDateInMatCalendar'
        };
    } else if (url.includes('perfdrive') || url.includes('validate.') || errorMsg.includes('perfdrive') || errorMsg.includes('Radware') || errorMsg.includes('human')) {
        ruleClassification = {
            title: `Autonomous Radware Challenge Stealth & Post-Clearance Resumption (${stepName})`,
            rootCause: `Radware bot challenge interrupted automation workflow: ${errorMsg}`,
            antiPatterns: ['0ms synthetic clicks, DOM tampering on challenge pages, or failing to resume post-challenge'],
            mandatoryInvariants: ['Native Chrome stealth, curved mouse jitter physics, and cookie persistence'],
            coreMethod: 'applyRadwareStealth'
        };
    } else if (errorMsg.includes('button') || errorMsg.includes('click') || errorMsg.includes('subbtn') || errorMsg.includes('submit')) {
        ruleClassification = {
            title: `Autonomous Button Selector & Scoped Form Resolution (${stepName})`,
            rootCause: `Action button was not found, disabled, or ambiguous across multiple form containers: ${errorMsg}`,
            antiPatterns: ['Hardcoded single-text button matching without form scoping'],
            mandatoryInvariants: ['Scoped container button resolution, button.subbtn class matching, and DOM evaluate fallback'],
            coreMethod: 'clickScopedSubmit'
        };
    } else if (errorMsg.includes('Session') || errorMsg.includes('login') || errorMsg.includes('auth/login') || errorMsg.includes('GATE_HALT')) {
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

function autoCaptureAndLockImmuneIncident(incidentContext = {}) {
    try {
        const diagnosis = diagnoseAutomationIncident(incidentContext);
        const memory = loadImmuneMemory();

        let existingRule = memory.rules.find(r => 
            r.title.toLowerCase().trim() === diagnosis.title.toLowerCase().trim() ||
            (r.rootCause && diagnosis.rootCause && r.rootCause.slice(0, 40) === diagnosis.rootCause.slice(0, 40))
        );

        let lockedRule = existingRule;
        if (!existingRule) {
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

module.exports = {
    loadImmuneMemory,
    registerNewImmuneRule,
    diagnoseAutomationIncident,
    autoCaptureAndLockImmuneIncident,
    withAutoImmuneBoundary,
    MEMORY_FILE_PATH,
    INCIDENT_LOG_PATH
};
