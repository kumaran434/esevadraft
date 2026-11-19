const assert = require('assert');
const { 
    SERVICE_OPTIONS, 
    REVENUE_DEPARTMENT_SERVICE_OPTIONS, 
    RATION_CARD_SERVICE_OPTIONS 
} = require('../src/core/fsm/fsm_options_registry');
const { handleServiceSelection } = require('../src/core/chat_fsm');
const storageService = require('../src/services/storage_service');

console.log('🧪 Starting Category Navigation & Two-Tier Service Selection Tests...\n');

// 1. Verify Options Registry structure
console.log('[TEST 1] Verifying Department Category Registry...');
assert(SERVICE_OPTIONS.some(o => o.value === 'ரேஷன் கார்டு'), 'SERVICE_OPTIONS must include ரேஷன் கார்டு');
assert(SERVICE_OPTIONS.some(o => o.value === 'வருவாய்த் துறை'), 'SERVICE_OPTIONS must include வருவாய்த் துறை');
assert(SERVICE_OPTIONS.some(o => o.value === 'புதிய வாக்காளர் அட்டை'), 'SERVICE_OPTIONS must include புதிய வாக்காளர் அட்டை');
console.log('  ✅ Top-level categories verified.');

assert(REVENUE_DEPARTMENT_SERVICE_OPTIONS.length >= 6, 'REVENUE_DEPARTMENT_SERVICE_OPTIONS has 5 certificates + Main Menu');
assert(REVENUE_DEPARTMENT_SERVICE_OPTIONS.some(o => o.value === 'சாதிச் சான்றிதழ்'), 'Contains Community');
assert(REVENUE_DEPARTMENT_SERVICE_OPTIONS.some(o => o.value === 'இருப்பிடச் சான்றிதழ்'), 'Contains Residence');
assert(REVENUE_DEPARTMENT_SERVICE_OPTIONS.some(o => o.value === 'வருமானச் சான்றிதழ்'), 'Contains Income');
assert(REVENUE_DEPARTMENT_SERVICE_OPTIONS.some(o => o.value === 'முதல் பட்டதாரி சான்றிதழ்'), 'Contains First Graduate');
assert(REVENUE_DEPARTMENT_SERVICE_OPTIONS.some(o => o.value === 'OBC சான்றிதழ்'), 'Contains OBC');
assert(REVENUE_DEPARTMENT_SERVICE_OPTIONS.some(o => o.value === 'MAIN_MENU'), 'Contains MAIN_MENU back option');
console.log('  ✅ Revenue Department sub-options verified.');

// 2. Chat FSM: Category Selection -> Subservice Display
console.log('\n[TEST 2] Testing Revenue Department Category Expansion in Chat FSM...');
const sess1 = { intakeState: 'SERVICE_SELECTION', chatHistory: [], citizenProfile: {} };
const handledRev = handleServiceSelection('வருவாய்த் துறை', sess1);
assert(handledRev === true, 'handleServiceSelection handles வருவாய்த் துறை');
assert.strictEqual(sess1.intakeState, 'REVENUE_DEPARTMENT_SERVICES', 'intakeState set to REVENUE_DEPARTMENT_SERVICES');
assert.strictEqual(sess1.subService, null, 'subService remains null at category stage');
const lastMsgRev = sess1.chatHistory[sess1.chatHistory.length - 1];
assert(lastMsgRev.text.includes('வருவாய்த் துறை சான்றிதழ்கள்'), 'Prompt contains Revenue Department header');
assert.strictEqual(lastMsgRev.options.length, REVENUE_DEPARTMENT_SERVICE_OPTIONS.length, 'Options contain all 5 certs + Back');
console.log('  ✅ Revenue Department expansion verified.');

// 3. Chat FSM: Selecting Certificate from Revenue Menu
console.log('\n[TEST 3] Testing Subservice Selection from Revenue Menu (e.g. வருமானச் சான்றிதழ்)...');
const handledIncome = handleServiceSelection('வருமானச் சான்றிதழ்', sess1);
assert(handledIncome === true, 'handleServiceSelection handles வருமானச் சான்றிதழ்');
assert.strictEqual(sess1.subService, 'INCOME', 'subService correctly set to INCOME');
console.log('  ✅ Concrete service transition verified.');

// 4. Chat FSM: Main Menu Back Button
console.log('\n[TEST 4] Testing Return to Main Menu...');
const sessBack = { intakeState: 'REVENUE_DEPARTMENT_SERVICES', chatHistory: [], citizenProfile: {} };
const handledBack = handleServiceSelection('MAIN_MENU', sessBack);
assert(handledBack === true, 'handleServiceSelection handles MAIN_MENU');
assert.strictEqual(sessBack.intakeState, 'SERVICE_SELECTION', 'intakeState reset to SERVICE_SELECTION');
const lastMsgBack = sessBack.chatHistory[sessBack.chatHistory.length - 1];
assert.strictEqual(lastMsgBack.options.length, SERVICE_OPTIONS.length, 'Main menu options restored');
console.log('  ✅ Back to main menu verified.');

// 5. Chat FSM: Ration Card Category Expansion
console.log('\n[TEST 5] Testing Ration Card Category Expansion...');
const sessRation = { intakeState: 'SERVICE_SELECTION', chatHistory: [], citizenProfile: {} };
const handledRation = handleServiceSelection('ரேஷன் கார்டு', sessRation);
assert(handledRation === true, 'handleServiceSelection handles ரேஷன் கார்டு');
assert.strictEqual(sessRation.intakeState, 'RATION_CARD_SERVICES', 'intakeState set to RATION_CARD_SERVICES');
assert.strictEqual(sessRation.subService, null, 'subService remains null at category stage');
const lastMsgRation = sessRation.chatHistory[sessRation.chatHistory.length - 1];
assert.strictEqual(lastMsgRation.options.length, RATION_CARD_SERVICE_OPTIONS.length, '4 completed subservices + Back present');
console.log('  ✅ Ration Card expansion verified.');

// 6. Chat FSM: Selecting Add Member from Ration Menu
console.log('\n[TEST 6] Testing Selecting Add Member from Ration Menu...');
const handledAddMember = handleServiceSelection('குடும்ப உறுப்பினர் சேர்க்க', sessRation);
assert(handledAddMember === true, 'handleServiceSelection handles Add Member');
assert.strictEqual(sessRation.subService, 'ADD_MEMBER', 'subService correctly set to ADD_MEMBER');
console.log('  ✅ Add Member subservice intake verified.');

console.log('\n🎉 ALL CATEGORY NAVIGATION & SUBSERVICE SELECTION TESTS PASSED 100%! 🛡️');
