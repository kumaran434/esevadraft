// ============================================================================
// eSevaDraft Instant Service Contract & Plugin Quick Test (< 1 Second Execution)
// Validates all service contracts, document integrity, and zero-head-photo invariants
// ============================================================================

const assert = require('assert');
const { 
    getServicePlugin, 
    validateServiceContract 
} = require('../src/services/plugins');

console.log('⚡ ============================================================');
console.log('⚡ RUNNING E-SEVA INSTANT SERVICE CONTRACT QUICK-TEST (<1 SEC)');
console.log('⚡ ============================================================');

let passCount = 0;
function test(name, fn) {
    try {
        fn();
        console.log(`  ✅ PASS: ${name}`);
        passCount++;
    } catch (err) {
        console.error(`  ❌ FAIL: ${name}`);
        console.error(`     Error: ${err.message}`);
        process.exit(1);
    }
}

// 1. ADD MEMBER CONTRACT TESTS
test('[Add Member] Eradicates Head Photo & Head Aadhaar from payload', () => {
    const inputProfile = {
        headPhotoPath: '/uploads/head_photo.jpg',
        fullNameTam: 'வாடிக்கையாளர்',
        subServiceData: {
            memberName: 'குமரன் கி',
            aadhaarNo: '575567662931',
            relationship: 'மகன்',
            docPath: '/uploads/member_doc.pdf'
        }
    };
    const inputDocs = {
        profilePhoto: '/uploads/head_photo.jpg',
        headAadhaar: '/uploads/head_aadhaar.pdf',
        memberAadhaar: '/uploads/member_doc.pdf'
    };

    const result = validateServiceContract('ADD_MEMBER', inputProfile, inputDocs);
    assert.strictEqual(result.isValid, true, 'Add Member should be valid');
    assert.strictEqual(result.sanitizedProfile.headPhotoPath, undefined, 'Head photo path must be deleted');
    assert.strictEqual(result.sanitizedDocuments.profilePhoto, undefined, 'Profile photo must be deleted');
    assert.strictEqual(result.sanitizedDocuments.headAadhaar, undefined, 'Head Aadhaar must be deleted');
    assert.strictEqual(result.sanitizedDocuments.memberAadhaar, '/uploads/member_doc.pdf', 'Member Aadhaar preserved');
});

test('[Add Member Plugin] sanitizePayload cleanses profile completely', () => {
    const plugin = getServicePlugin('ADD_MEMBER');
    assert.ok(plugin, 'Add Member plugin must exist');
    assert.strictEqual(plugin.contract.requiresHeadPhoto, false, 'Must not require head photo');
    assert.strictEqual(plugin.contract.requiresHeadAadhaar, false, 'Must not require head aadhaar');

    const sanitized = plugin.sanitizePayload({
        citizenProfile: {
            headPhotoPath: '/uploads/head.jpg',
            documents: { profilePhoto: '/uploads/head.jpg', headAadhaar: '/uploads/head.pdf' }
        },
        documents: { profilePhoto: '/uploads/head.jpg', headAadhaar: '/uploads/head.pdf', memberAadhaar: '/uploads/mem.pdf' }
    });

    assert.strictEqual(sanitized.citizenProfile.headPhotoPath, undefined);
    assert.strictEqual(sanitized.documents.profilePhoto, undefined);
    assert.strictEqual(sanitized.documents.headAadhaar, undefined);
    assert.strictEqual(sanitized.documents.memberAadhaar, '/uploads/mem.pdf');
});

test('[Add Member] Fails if member details are missing', () => {
    const invalidProfile = {
        subServiceData: {}
    };
    const result = validateServiceContract('ADD_MEMBER', invalidProfile, {});
    assert.strictEqual(result.isValid, false, 'Must be invalid without member details');
    assert.ok(result.errors.length >= 2, 'Must report missing member errors');
});

// 2. NEW RATION CARD CONTRACT TESTS
test('[New Ration Card] Requires Head Photo and Head Aadhaar', () => {
    const plugin = getServicePlugin('NEW_RATION_CARD');
    assert.ok(plugin, 'New Ration Card plugin must exist');
    assert.strictEqual(plugin.contract.requiresHeadPhoto, true, 'New Card requires head photo');
    assert.strictEqual(plugin.contract.requiresHeadAadhaar, true, 'New Card requires head aadhaar');

    const validNewCardProfile = {
        fullNameTam: 'சுரேஷ் குமார்',
        fullNameEng: 'Suresh Kumar',
        headAadhaar: '123456789012',
        headPhotoPath: '/uploads/suresh_photo.jpg'
    };
    const validDocs = {
        profilePhoto: '/uploads/suresh_photo.jpg',
        headAadhaar: '/uploads/suresh_aadhaar.pdf'
    };
    const result = validateServiceContract('NEW_RATION_CARD', validNewCardProfile, validDocs);
    assert.strictEqual(result.isValid, true, 'Valid new card must pass');
});

test('[New Ration Card] Fails if head photo is missing', () => {
    const invalidProfile = {
        fullNameTam: 'சுரேஷ் குமார்',
        headAadhaar: '123456789012'
    };
    const result = validateServiceContract('NEW_RATION_CARD', invalidProfile, {});
    assert.strictEqual(result.isValid, false, 'Must fail without photo and aadhaar doc');
    assert.ok(result.errors.some(e => e.includes('புகைப்படம்')));
});

// 3. CHANGE ADDRESS CONTRACT TESTS
test('[Change Address] Eradicates Head Photo and requires address proof', () => {
    const plugin = getServicePlugin('CHANGE_ADDRESS');
    assert.ok(plugin, 'Change Address plugin must exist');
    assert.strictEqual(plugin.contract.requiresHeadPhoto, false, 'Change address does not require photo');

    const validAddrProfile = {
        doorNo: '12',
        streetTam: 'காந்தி தெரு',
        headPhotoPath: '/uploads/stale_photo.jpg',
        subServiceData: {
            newDoorNo: '12A',
            newStreet: 'நேரு தெரு',
            addressProofDocPath: '/uploads/eb_bill.pdf'
        }
    };
    const validDocs = {
        profilePhoto: '/uploads/stale_photo.jpg',
        newAddressProof: '/uploads/eb_bill.pdf'
    };

    const result = validateServiceContract('CHANGE_ADDRESS', validAddrProfile, validDocs);
    assert.strictEqual(result.isValid, true, 'Valid address change must pass');
    assert.strictEqual(result.sanitizedProfile.headPhotoPath, undefined, 'Head photo eradicated');
    assert.strictEqual(result.sanitizedDocuments.profilePhoto, undefined, 'Profile photo eradicated');
});

// 4. DECLARATIVE FLOW ENGINE TESTS (Pillar 1)
const { FlowEngine } = require('../src/core/flow_engine');
test('[FlowEngine] Declaratively steps through questions and extracts values', () => {
    const incomeFlowDef = {
        serviceId: 'INCOME_CERTIFICATE',
        initialState: 'ANNUAL_INCOME',
        completionState: 'READY_TO_APPLY',
        steps: {
            ANNUAL_INCOME: {
                prompt: 'வருமானம் எவ்வளவு?',
                type: 'number',
                min: 1000,
                targetField: 'subServiceData.annualIncome',
                nextState: 'OCCUPATION'
            },
            OCCUPATION: {
                prompt: 'தொழில் என்ன?',
                type: 'options',
                options: [{ label: 'விவசாயம்', value: 'விவசாயம்' }],
                targetField: 'subServiceData.occupation',
                nextState: 'READY_TO_APPLY'
            }
        }
    };
    const engine = new FlowEngine(incomeFlowDef);
    const init = engine.getInitialPrompt();
    assert.strictEqual(init.state, 'ANNUAL_INCOME');

    const step1 = engine.processInput('ANNUAL_INCOME', '60000', {});
    assert.strictEqual(step1.success, true);
    assert.strictEqual(step1.currentState, 'OCCUPATION');
    assert.strictEqual(step1.sessionData.subServiceData.annualIncome, 60000);

    const step2 = engine.processInput('OCCUPATION', 'விவசாயம்', step1.sessionData);
    assert.strictEqual(step2.success, true);
    assert.strictEqual(step2.isCompleted, true);
    assert.strictEqual(step2.sessionData.subServiceData.occupation, 'விவசாயம்');
});

// 5. GOVT DOCUMENT POLICY MATRIX TESTS (Pillar 2)
const { getPortalDocumentPolicy } = require('../src/services/govt_document_policy');
test('[Govt Document Policy] Resolves correct size ceilings per portal', () => {
    const tnpds = getPortalDocumentPolicy('TNPDS');
    assert.strictEqual(tnpds.maxSizeKB, 240, 'TNPDS must have 240 KB ceiling');
    assert.strictEqual(tnpds.preferredFormat, 'pdf');

    const tnega = getPortalDocumentPolicy('TNEGA');
    assert.strictEqual(tnega.maxSizeKB, 190, 'TNeGA must have 190 KB ceiling');

    const nvsp = getPortalDocumentPolicy('VOTER_ID');
    assert.strictEqual(nvsp.maxSizeKB, 2000, 'NVSP Voter ID must have 2000 KB ceiling');
});

// 6. UNIVERSAL BASE PORTAL RUNNER TESTS (Pillar 3)
const { BasePortalRunner } = require('../src/portal/common/base_portal_runner');
test('[BasePortalRunner] Provides 5-phase lifecycle contracts and dry run safety', async () => {
    const runner = new BasePortalRunner({
        portalId: 'TNPDS',
        portalName: 'TNPDS Portal',
        isDryRun: true
    });
    assert.strictEqual(runner.isDryRun, true);
    assert.strictEqual(runner.policy.maxSizeKB, 240);

    const dryResult = await runner.executeReviewAndSubmit();
    assert.strictEqual(dryResult.submitted, false, 'Dry run must halt submit');
    assert.strictEqual(dryResult.isDryRun, true);
});

console.log('⚡ ============================================================');
console.log(`🎉 ALL ${passCount} INSTANT SERVICE & ARCHITECTURE CHECKS PASSED (100% SUCCESS)`);
console.log('⚡ ============================================================');
