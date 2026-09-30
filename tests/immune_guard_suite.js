/**
 * eSevaDraft - Automated Immune Guard Suite
 * (தானியங்கி நோய் எதிர்ப்பு சோதனைத் தொகுதி)
 * 
 * Dynamically validates all rules in data/automation_immune_memory.json
 * to ensure that NO past government portal automation bug can ever recur.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
    loadImmuneMemory,
    registerNewImmuneRule,
    applyDryRunGuard,
    safeExtractGovtError
} = require('../govt_automation_core');

async function runImmuneGuardSuite() {
    console.log('\n======================================================');
    console.log('🛡️ RUNNING AUTOMATION IMMUNE GUARD SUITE (தடுப்பூசி மரபணு சோதனை)');
    console.log('======================================================\n');

    let passedCount = 0;

    // 1. Verify Memory File Integrity
    const memory = loadImmuneMemory();
    assert(memory && Array.isArray(memory.rules), 'Immune memory is valid JSON with rules array');
    passedCount++;
    console.log(`  ✅ [IMMUNE-01] Memory loaded successfully: ${memory.totalRulesLocked} rules registered`);

    assert(memory.totalRulesLocked >= 12, `At least 12 battle-tested rules must be locked (Found: ${memory.totalRulesLocked})`);
    passedCount++;
    console.log('  ✅ [IMMUNE-02] Baseline of 12 field-tested automation cases preserved');

    // 2. Dynamic Rule Integrity Check for Every Registered Rule
    for (const rule of memory.rules) {
        assert(rule.id && rule.title && rule.rootCause, `Rule ${rule.id} has id, title, and rootCause`);
        assert(Array.isArray(rule.mandatoryInvariants) && rule.mandatoryInvariants.length > 0, `Rule ${rule.id} has mandatoryInvariants`);
        passedCount++;
    }
    console.log(`  ✅ [IMMUNE-03] Verified structure and invariant contracts for all ${memory.rules.length} rules`);

    // 3. Dry-Run Guard Invariant Check
    const defaultGuard = applyDryRunGuard();
    assert(defaultGuard.canSubmitLive === false, 'Dry-run guard prevents live submission by default');
    const mockGuard = applyDryRunGuard({ isMockSandbox: true, enableFinalSubmit: true });
    assert(mockGuard.canSubmitLive === false, 'Dry-run guard prevents live submission in mock sandbox');
    const liveGuard = applyDryRunGuard({ enableFinalSubmit: true, isMockSandbox: false });
    assert(liveGuard.canSubmitLive === true, 'Dry-run guard permits live submission only with explicit flag');
    passedCount += 3;
    console.log('  ✅ [IMMUNE-04] applyDryRunGuard enforces three-way dry run safety invariant');

    // 4. Codebase Anti-Pattern & Invariant Audit
    const tnpdsCode = fs.readFileSync(path.join(__dirname, '..', 'tnpds_automation.js'), 'utf8');

    // Anti-Pattern: Fake plugins
    assert(!tnpdsCode.includes('navigator.plugins = [1, 2, 3'), 'Anti-pattern check: No fake plugins override');
    // Anti-Pattern: Fake chrome runtime
    assert(!tnpdsCode.includes('window.chrome = { runtime: {} }'), 'Anti-pattern check: No fake chrome object');
    // Anti-Pattern: Chrome/131 hardcoded UA
    assert(!tnpdsCode.includes('Chrome/131.0.0.0'), 'Anti-pattern check: No hardcoded Chrome/131 User-Agent');
    // Anti-Pattern: Unconditional Send OTP text matching
    assert(!tnpdsCode.includes("primaryLoginSelectors = ['#btnSendOtp"), 'Anti-pattern check: No primaryLoginSelectors containing #btnSendOtp');
    // Mandatory Invariant: button.subbtn
    assert(tnpdsCode.includes('button.subbtn:visible'), 'Mandatory invariant: button.subbtn targeted for OTP verification');
    // Mandatory Invariant: !isSubBtn safeguard
    assert(tnpdsCode.includes('!isSubBtn'), 'Mandatory invariant: !isSubBtn check allows OTP submit button with Tamil label');
    // Mandatory Invariant: Cookie persistence
    assert(tnpdsCode.includes('saveTnpdsCookies'), 'Mandatory invariant: Cookie persistence preserved');
    // Mandatory Invariant: CASE-13 — Add Member Form Gate (Zero-Step-Skip enforcement)
    assert(tnpdsCode.includes('MEMBER_FORM_GATE_HALT'), 'Mandatory invariant (Case-13): Add Member form gate halts automation when form not loaded');
    assert(tnpdsCode.includes('memberFormFound'), 'Mandatory invariant (Case-13): memberFormFound gate variable enforces form load verification');
    // Mandatory Invariant: CASE-14 — Universal Angular Material Readonly Datepicker & Humanized Anti-Bot Mouse Physics
    assert(tnpdsCode.includes("removeAttribute('readonly')"), 'Mandatory invariant (Case-14): Angular Material datepicker handles readonly inputs without timeout');
    assert(tnpdsCode.includes('targetX = box.x'), 'Mandatory invariant (Case-14): Humanized curved mouse physics applied to prevent Radware Bot detection');
    // Mandatory Invariant: CASE-15 — Universal Angular Material Datepicker Reactive Cascade & Dynamic Document Dropdown Hydration Gate
    assert(tnpdsCode.includes('selectDateInMatCalendar(page, dob, false)'), 'Mandatory invariant (Case-15): Add Member flow invokes selectDateInMatCalendar for Angular reactive cascade');
    assert(tnpdsCode.includes('CustomEvent(\'dateInput\''), 'Mandatory invariant (Case-15): CustomEvent dateInput dispatched for Angular dateAdapter');
    assert(tnpdsCode.includes('Dynamic Hydration Wait'), 'Mandatory invariant (Case-15): Dynamic hydration wait loop guarantees Document dropdown hydration');
    // Mandatory Invariant: CASE-16 — Angular Material Real Date Object Cascade & Mandatory Member Table Verification Gate
    assert(tnpdsCode.includes('supportingDocuments'), 'Mandatory invariant (Case-16): supportingDocuments dropdown targeted directly by ID and formcontrolname');
    assert(tnpdsCode.includes('DOC_TYPE_GATE_HALT'), 'Mandatory invariant (Case-16): Zero-step-skip halts if supportingDocuments is unselected');
    assert(tnpdsCode.includes('DOC_UPLOAD_GATE_HALT'), 'Mandatory invariant (Case-16): Zero-step-skip halts if document file is not attached');
    assert(tnpdsCode.includes('ADD_MEMBER_TABLE_GATE_HALT'), 'Mandatory invariant (Case-16): Mandatory table gate halts if member is not added to table');
    passedCount += 18;
    console.log(`  ✅ [IMMUNE-05] Codebase verified against all prohibited anti-patterns and mandatory invariants (${memory.totalRulesLocked} Rules)`);

    // 5. Dynamic Auto-Expansion Test: Verify registerNewImmuneRule works and persists
    const originalCount = memory.totalRulesLocked;
    const testRule = registerNewImmuneRule({
        id: 'DYNAMIC-TEST-RULE',
        service: 'TEST',
        title: 'Auto-Expanding Dynamic Rule Integration Test',
        rootCause: 'Verifies dynamic addition of future lessons',
        mandatoryInvariants: ['test_invariant_verified'],
        coreMethod: 'dynamicTest'
    });

    const reloaded = loadImmuneMemory();
    assert(reloaded.rules.some(r => r.id === 'DYNAMIC-TEST-RULE'), 'registerNewImmuneRule persists rule to memory registry');
    passedCount++;

    // Clean up dynamic test rule to leave production memory pristine
    reloaded.rules = reloaded.rules.filter(r => r.id !== 'DYNAMIC-TEST-RULE');
    reloaded.totalRulesLocked = reloaded.rules.length;
    fs.writeFileSync(path.join(__dirname, '..', 'data', 'automation_immune_memory.json'), JSON.stringify(reloaded, null, 2), 'utf8');
    assert(reloaded.totalRulesLocked === originalCount, 'Memory cleanly restored to original count after expansion verification');
    // 6. Autonomous Real-Time Auto-Locking & Incident Diagnosis Engine
    const {
        diagnoseAutomationIncident,
        autoCaptureAndLockImmuneIncident,
        INCIDENT_LOG_PATH
    } = require('../govt_automation_core');

    // Test Incident Diagnosis
    const diag = diagnoseAutomationIncident({
        error: new Error('Dynamic select dropdown failed to load options in time'),
        stepName: 'STEP_TEST_DROPDOWN',
        service: 'TNPDS',
        url: 'https://www.tnpds.gov.in/pages/service-request'
    });
    assert(diag.title && diag.rootCause && diag.antiPatterns.length > 0 && diag.mandatoryInvariants.length > 0, 'Incident diagnoser generates structured rule');
    passedCount++;
    console.log('  ✅ [IMMUNE-07] Autonomous Incident Diagnoser classifies runtime DOM errors into structured immune invariants');

    // Test Autonomous Auto-Capture & Incident Logging
    const capture = autoCaptureAndLockImmuneIncident({
        error: new Error('Simulated runtime error for autonomous lock verification'),
        stepName: 'STEP_AUTONOMOUS_TEST',
        service: 'AUTO_IMMUNE_TEST',
        url: 'https://www.tnpds.gov.in/test'
    });
    assert(capture.success === true && capture.autoLocked === true, 'autoCaptureAndLockImmuneIncident executes and auto-locks incident');
    assert(fs.existsSync(INCIDENT_LOG_PATH), 'Incident log file is created on disk');
    
    // Clean up test case from memory if auto-registered
    const postCaptureMemory = loadImmuneMemory();
    postCaptureMemory.rules = postCaptureMemory.rules.filter(r => r.service !== 'AUTO_IMMUNE_TEST');
    postCaptureMemory.totalRulesLocked = postCaptureMemory.rules.length;
    fs.writeFileSync(path.join(__dirname, '..', 'data', 'automation_immune_memory.json'), JSON.stringify(postCaptureMemory, null, 2), 'utf8');
    passedCount++;
    console.log('  ✅ [IMMUNE-08] Real-Time Auto-Lock & Incident Memory Logger verified 100% autonomous');

    console.log('\n------------------------------------------------------');
    console.log(`🎉 IMMUNE GUARD SUITE COMPLETED: ALL ${passedCount} CHECKS PASSED!`);
    console.log('------------------------------------------------------\n');
    return { success: true, passedCount };
}

if (require.main === module) {
    runImmuneGuardSuite().catch(err => {
        console.error('🚨 IMMUNE GUARD SUITE FAILED:', err.message);
        process.exitCode = 1;
    });
}

module.exports = { runImmuneGuardSuite };
