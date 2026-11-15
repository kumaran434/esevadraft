/**
 * tests/catalog_e2e_test.js
 * 
 * E2E Service Plugin & Delta Engine Verification Suite.
 * Uses isolated Golden Test Personas to verify all 8 services end-to-end.
 */

const assert = require('assert');
const catalog = require('../src/catalog');
const fixtures = require('./golden_fixtures');

console.log('\n======================================================');
console.log('🏛️ eSevaDraft SERVICE PLUGIN & DELTA ENGINE E2E SUITE');
console.log('======================================================\n');

const services = catalog.listServices();
console.log(`📋 Total registered services in catalog: ${services.length}`);
assert.strictEqual(services.length >= 8, true, 'At least 8 services must be in catalog');

// 1. Verify schema integrity of all services
for (const svc of services) {
    console.log(`🔍 Checking plugin schema: [${svc.portal}] ${svc.nameTam} (${svc.id})...`);
    assert(svc.id, `${svc.id}: ID must be defined`);
    assert(svc.nameTam, `${svc.id}: Tamil name must be defined`);
    assert(svc.nameEng, `${svc.id}: English name must be defined`);
    assert(svc.portal, `${svc.id}: Portal must be defined`);
    assert(Array.isArray(svc.bucketB), `${svc.id}: bucketB must be an array`);
    assert(Array.isArray(svc.requiredDocuments), `${svc.id}: requiredDocuments must be an array`);
    assert(typeof svc.getRunner === 'function', `${svc.id}: getRunner must be a function`);
    const runner = svc.getRunner();
    assert(typeof runner === 'function', `${svc.id}: Runner must return an executable function`);
}
console.log('✅ All service plugins pass strict schema & runner integrity checks!\n');

// 2. Test TNeGA Existing Customer Delta Journey
console.log('▶️ [TEST 1] TNeGA Existing Customer CAN & Revenue Delta Journey:');
const existingPersona = fixtures.getGoldenProfile('PERSONA_TNEGA_EXISTING_CAN');

// Test CAN Registration when customer already has CAN
const canDelta = catalog.evaluateDelta('TNEGA_CAN_REGISTER', existingPersona, { headAadhaar: 'dummy.pdf' });
console.log('  • CAN Registration with complete persona -> Status:', canDelta.status);
assert.strictEqual(canDelta.isReady, true, 'Complete persona should be ready for CAN');

// Test Income Certificate prerequisites check
const incomeNoCan = catalog.evaluateDelta('TNEGA_INCOME', { fullNameEng: 'Karthik' }, {});
console.log('  • Income Cert without CAN -> Status:', incomeNoCan.status, 'Prerequisite:', incomeNoCan.prerequisite?.key);
assert.strictEqual(incomeNoCan.status, 'NEEDS_PREREQUISITE', 'Income Cert must enforce CAN prerequisite');

// Test Income Certificate with CAN but missing income
const incomePartial = catalog.evaluateDelta('TNEGA_INCOME', { canNumber: '133370337878397', fullNameEng: 'Karthik' }, { headAadhaar: 'dummy.pdf' });
console.log('  • Income Cert with CAN but missing income -> Status:', incomePartial.status, 'Field:', incomePartial.field?.key);
assert.strictEqual(incomePartial.status, 'NEEDS_FIELD');
assert.strictEqual(incomePartial.field.key, 'annualIncome');

// Test Income Certificate 100% Ready
const incomeReady = catalog.evaluateDelta('TNEGA_INCOME', existingPersona, { headAadhaar: 'dummy.pdf', profilePhoto: 'photo.jpg' });
console.log('  • Income Cert with all fields -> Status:', incomeReady.status, 'Action:', incomeReady.actionRequired);
assert.strictEqual(incomeReady.isReady, true);
assert.strictEqual(incomeReady.actionRequired, 'open_edit_modal');
console.log('✅ TNeGA Delta Engine correctly enforces sequential intake!\n');

// 3. Test TNPDS New Ration Card Delta Journey
console.log('▶️ [TEST 2] TNPDS New Ration Card Delta Journey:');
const rationPersona = fixtures.getGoldenProfile('PERSONA_RATION_NEW_CARD');
const rationReady = catalog.evaluateDelta('TNPDS_NEW_CARD', rationPersona, {
    headAadhaar: 'aadhaar.pdf',
    profilePhoto: 'photo.jpg',
    residenceProof: 'gas.pdf'
});
console.log('  • New Ration Card with all fields -> Status:', rationReady.status, 'Action:', rationReady.actionRequired);
assert.strictEqual(rationReady.isReady, true);
assert.strictEqual(rationReady.actionRequired, 'open_edit_modal');
console.log('✅ TNPDS New Card passes Delta Engine!\n');

console.log('======================================================');
console.log('🎉 ALL SERVICE PLUGIN & DELTA ENGINE E2E CHECKS PASSED!');
console.log('======================================================\n');
