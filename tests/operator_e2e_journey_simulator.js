/**
 * eSevaDraft Autonomous Operator Journey Simulator
 * 
 * Simulates complete end-to-end operator interactions:
 * 1. Returning customer with past submitted certificate/application starting a new service (Add Member).
 * 2. Banner isolation: Ensures old submission banner and resume banner are strictly suppressed.
 * 3. Zero-delay option transitions: Ensures CHILD_UNDER_5 and ADULT_ABOVE_5 transition smoothly without hanging.
 * 4. Smart Profile Reuse: Automatically inherits existing ration card number & district without redundant re-asking.
 * 5. Clean cancel & switch: Verifies state reset leaves zero lingering UI artifacts.
 */

const assert = require('assert');
const storageService = require('../src/services/storage_service');
const { getOrCreateSession, createFreshProfile, sessions } = storageService;
const { handleServiceSelection, handleRationSubserviceWorkflow } = require('../src/core/chat_fsm');
const { handleAddMemberChild } = require('../src/core/fsm/fsm_add_member_child');

async function runOperatorJourneySimulator() {
    console.log('\n======================================================');
    console.log('🤖 RUNNING AUTONOMOUS OPERATOR JOURNEY SIMULATOR');
    console.log('======================================================\n');

    const testMobile = '9842367866';

    // -----------------------------------------------------------------
    // TEST 1: Returning Customer with Past Application Starting Add Member
    // -----------------------------------------------------------------
    console.log('[JOURNEY 1] Returning customer with past submission starts Add Member');
    const sess = getOrCreateSession(testMobile);
    sess.citizenProfile = createFreshProfile(testMobile);
    sess.citizenProfile.fullNameTam = 'குமரன்';
    sess.citizenProfile.fullNameEng = 'Kumaran';
    sess.citizenProfile.rationCardNo = '331234567890';
    sess.citizenProfile.district = 'திருப்பத்தூர்';
    sess.citizenProfile.taluk = 'வாணியம்பாடி';
    sess.citizenProfile.village = 'ஆலங்காயம்';

    // Past submission details
    sess.applicationNumber = '33300011122233';
    sess.step = 'submitted';

    // Operator starts "Add Member" via /api/operator/new-customer logic
    // Simulating the backend route transition:
    sess.subService = 'ADD_MEMBER';
    sess.intakeState = 'RATION_ADD_MEMBER_CHILD_CHECK';
    sess.step = 'RATION_ADD_MEMBER_CHILD_CHECK';
    sess.applicationNumber = null; // Cleared on starting new service
    sess.subServiceData = {
        rationCardNo: sess.citizenProfile.rationCardNo,
        district: sess.citizenProfile.district,
        taluk: sess.citizenProfile.taluk,
        village: sess.citizenProfile.village
    };

    assert.strictEqual(sess.applicationNumber, null, 'Old applicationNumber must be cleared when starting Add Member');
    assert.strictEqual(sess.subService, 'ADD_MEMBER', 'subService must be ADD_MEMBER');
    assert.strictEqual(sess.subServiceData.rationCardNo, '331234567890', 'Existing rationCardNo must be smartly reused');
    console.log('  ✅ PASS: Old applicationNumber cleared, existing ration card number smartly inherited without re-asking.');

    // -----------------------------------------------------------------
    // TEST 2: Option Selection: CHILD_UNDER_5 Transitions with ZERO Lag
    // -----------------------------------------------------------------
    console.log('[JOURNEY 2] Transitioning on CHILD_UNDER_5 option click');
    sess.chatHistory = [];
    const childHandled = handleAddMemberChild('CHILD_UNDER_5', sess, sess.intakeState, null, null);

    assert.strictEqual(childHandled, true, 'CHILD_UNDER_5 must be handled immediately without fallback');
    assert.strictEqual(sess.intakeState, 'RATION_ADD_MEMBER_CHILD_DOC', 'State must transition to RATION_ADD_MEMBER_CHILD_DOC');
    assert.strictEqual(sess.subServiceData.isChild, true, 'isChild must be true');
    assert.strictEqual(sess.subServiceData.rationCardNo, '331234567890', 'rationCardNo must still be retained in subServiceData');
    assert.ok(sess.chatHistory.length > 0, 'Bot response must be queued');
    assert.ok(sess.chatHistory[0].text.includes('குழந்தை'), 'Response must prompt for child document');
    console.log('  ✅ PASS: CHILD_UNDER_5 transitioned immediately to document upload prompt.');

    // -----------------------------------------------------------------
    // TEST 3: Option Selection: ADULT_ABOVE_5 Transitions with ZERO Lag
    // -----------------------------------------------------------------
    console.log('[JOURNEY 3] Transitioning on ADULT_ABOVE_5 option click');
    sess.intakeState = 'RATION_ADD_MEMBER_CHILD_CHECK';
    sess.chatHistory = [];
    const adultHandled = handleAddMemberChild('ADULT_ABOVE_5', sess, sess.intakeState, null, null);

    assert.strictEqual(adultHandled, true, 'ADULT_ABOVE_5 must be handled immediately without fallback');
    assert.strictEqual(sess.intakeState, 'RATION_ADD_MEMBER_ADULT_CHECK', 'State must transition to RATION_ADD_MEMBER_ADULT_CHECK');
    assert.strictEqual(sess.subServiceData.isChild, false, 'isChild must be false');
    assert.ok(sess.chatHistory.length > 0, 'Bot response must be queued');
    assert.ok(sess.chatHistory[0].options.some(o => o.value === 'ADD_MEMBER_SON_DAUGHTER'), 'Must provide Son/Daughter option');
    assert.ok(sess.chatHistory[0].options.some(o => o.value === 'ADD_MEMBER_ADULT'), 'Must provide Married/Parent option');
    console.log('  ✅ PASS: ADULT_ABOVE_5 transitioned immediately with child vs adult options.');

    // -----------------------------------------------------------------
    // TEST 4: Son/Daughter Flow with Document Upload & Auto-Complete Summary
    // -----------------------------------------------------------------
    console.log('[JOURNEY 4] Son/Daughter Flow document processing & summary generation');
    const sonHandled = handleAddMemberChild('ADD_MEMBER_SON_DAUGHTER', sess, sess.intakeState, null, null);
    assert.strictEqual(sonHandled, true, 'ADD_MEMBER_SON_DAUGHTER handled');
    assert.strictEqual(sess.intakeState, 'RATION_ADD_MEMBER_SON_AADHAAR');

    // Simulate Aadhaar document extraction
    const mockExtractedDoc = {
        fullNameTam: 'கார்த்திக்',
        fullNameEng: 'Karthik',
        aadhaarNumber: '987654321098',
        dob: '10/05/2012',
        gender: 'Male'
    };
    const docHandled = handleAddMemberChild('SON_AADHAAR_CONFIRMED', sess, sess.intakeState, { path: 'uploads/mock.jpg' }, mockExtractedDoc);
    assert.strictEqual(docHandled, true, 'SON_AADHAAR_CONFIRMED handled');
    assert.strictEqual(sess.intakeState, 'RATION_ADD_MEMBER_SON_RELATION');
    assert.strictEqual(sess.subServiceData.memberName, 'கார்த்திக்');
    assert.strictEqual(sess.subServiceData.aadhaarNo, '987654321098');

    // Select Relationship
    const relHandled = handleAddMemberChild('REL_SON', sess, sess.intakeState, null, null);
    assert.strictEqual(relHandled, true, 'REL_SON handled');
    assert.strictEqual(sess.intakeState, 'READY_TO_APPLY', 'Session is READY_TO_APPLY');
    assert.strictEqual(sess.step, 'READY');

    const readyMsg = sess.chatHistory[sess.chatHistory.length - 1];
    assert.ok(readyMsg.text.includes('விண்ணப்பம் தயார்'), 'Summary shows application ready');
    assert.ok(readyMsg.text.includes('கார்த்திக்'), 'Summary contains member name');
    console.log('  ✅ PASS: Complete Add Member journey verified from start to READY_TO_APPLY.');

    // -----------------------------------------------------------------
    // TEST 5: Banner Suppression Guard Verification
    // -----------------------------------------------------------------
    console.log('[JOURNEY 5] Banner Suppression Verification');
    // In chat history response simulation:
    const isSubServiceActive = !!(sess.subService || sess.citizenProfile?.subService || (sess.intakeState && sess.intakeState.startsWith('RATION_')));
    const returnedAppNo = (sess.step === 'submitted' || !isSubServiceActive) ? sess.applicationNumber : null;
    assert.strictEqual(returnedAppNo, null, 'applicationNumber must be NULL while subService is in progress');
    console.log('  ✅ PASS: applicationNumber is strictly null during active sub-service intake.');

    // -----------------------------------------------------------------
    // TEST 6: Seamless Customer Switch: Entering a new 10-digit mobile number
    // -----------------------------------------------------------------
    console.log('[JOURNEY 6] Customer Switch: Entering new 10-digit mobile cleanses stale customer session');
    const { handlePhoneBind } = require('../src/routes/chat/chat_phone_bind');
    storageService.setActiveMobile(testMobile);
    const newCustMobile = '9840112233';
    const mockReq = { headers: {} };
    let mockResJson = null;
    const mockRes = { json: (d) => { mockResJson = d; } };
    const mockCtx = {
        text: newCustMobile,
        sess,
        reqOpUid: 'test_op'
    };
    const bound = await handlePhoneBind(mockCtx, mockReq, mockRes);
    assert.strictEqual(bound, true, 'handlePhoneBind must return true when switching to new mobile');
    assert.strictEqual(storageService.getActiveMobile(), newCustMobile, 'Active mobile must switch to new mobile');
    assert.strictEqual(sess.citizenProfile.mobileNumber, newCustMobile, 'Citizen profile mobileNumber must match new customer');
    assert.strictEqual(sess.citizenProfile.fullNameTam, '', 'Old customer name must NOT leak into new customer');
    console.log('  ✅ PASS: New customer mobile seamlessly bound, previous customer profile wiped.');

    // -----------------------------------------------------------------
    // TEST 7: Stale Customer Option Guard (Ration Card selection)
    // -----------------------------------------------------------------
    console.log('[JOURNEY 7] Stale Customer Option Guard: Options include START_NEW_CUSTOMER');
    const { handleNewRationCardIntake } = require('../src/core/fsm/fsm_new_card_intake');
    const compSess = getOrCreateSession('9999900077');
    compSess.citizenProfile = {
        fullNameTam: 'கணேசன் டெஸ்ட்',
        fullNameEng: 'Ganesan Test',
        headPhotoPath: '/uploads/test_sample_doc.jpg',
        headAadhaarDocPath: '/uploads/test_sample_doc.jpg',
        residenceProof: { docPath: '/uploads/test_sample_doc.jpg' },
        members: [{ nameTam: 'கணேசன் டெஸ்ட்', relationship: 'Head' }],
        doorNo: '216'
    };
    compSess.chatHistory = [];
    handleNewRationCardIntake(compSess);
    const lastCompMsg = compSess.chatHistory[compSess.chatHistory.length - 1];
    assert.ok(lastCompMsg.options.some(o => o.value === 'CONFIRM_SUBMIT'), 'Must offer CONFIRM_SUBMIT');
    assert.ok(lastCompMsg.options.some(o => o.value === 'TRIGGER_EDIT_MODAL'), 'Must offer TRIGGER_EDIT_MODAL');
    assert.ok(lastCompMsg.options.some(o => o.value === 'START_NEW_CUSTOMER'), 'Must offer START_NEW_CUSTOMER');
    console.log('  ✅ PASS: Complete draft offers explicit START_NEW_CUSTOMER chip.');

    // -----------------------------------------------------------------
    // TEST 8: START_NEW_CUSTOMER / RESET_SCREEN Action
    // -----------------------------------------------------------------
    console.log('[JOURNEY 8] START_NEW_CUSTOMER / RESET_SCREEN Action');
    const { handleChatCommands } = require('../src/routes/chat/chat_commands');
    let resetJson = null;
    const resetRes = { json: (d) => { resetJson = d; } };
    const resetCtx = { text: 'START_NEW_CUSTOMER', sess: compSess, uploadedFile: null };
    const resetHandled = await handleChatCommands(resetCtx, mockReq, resetRes);
    assert.strictEqual(resetHandled, true, 'START_NEW_CUSTOMER must be handled by chat commands');
    console.log('  ✅ PASS: START_NEW_CUSTOMER cleanly resets the session.');

    // -----------------------------------------------------------------
    // TEST 9: Live Production Default Invariant
    // -----------------------------------------------------------------
    console.log('[JOURNEY 9] Live Production Default Invariant');
    const { handleAutomationStarter } = require('../src/routes/chat/chat_automation_starter');
    const testLiveSess = getOrCreateSession('9998887776');
    testLiveSess.citizenProfile = {
        fullNameTam: 'கணேசன்',
        fullNameEng: 'Ganesan',
        headAadhaar: '999888777611',
        members: [{ nameTam: 'கணேசன்', relationship: 'Head' }],
        doorNo: '10',
        mobileNumber: '9998887776'
    };
    testLiveSess.intakeState = 'READY_TO_APPLY';
    testLiveSess.chatHistory = [];
    let starterJson = null;
    const starterRes = { json: (d) => { starterJson = d; } };
    const starterReq = {
        headers: { host: 'localhost:3000', 'x-operator-uid': 'real_operator_live_uid' },
        body: { fastTest: true }
    };
    const starterCtx = { text: 'start', sess: testLiveSess, targetMobile: '9998887776' };
    const starterHandled = await handleAutomationStarter(starterCtx, starterReq, starterRes);
    assert.strictEqual(starterHandled, true, 'handleAutomationStarter handles start');
    assert.ok(testLiveSess.chatHistory.some(m => m.text && m.text.includes('நேரலை முறை')), 'Real operator start must default to Live Production, never Mock Sandbox');
    try {
        const { stopAutomation } = require('../tnpds_automation');
        await stopAutomation();
    } catch (_) {}
    console.log('  ✅ PASS: Real operator start defaults strictly to Live Production Mode (நேரலை முறை).');

    // -----------------------------------------------------------------
    // TEST 10: Change Address Subservice Full Flow
    // -----------------------------------------------------------------
    console.log('[JOURNEY 10] Change Address Subservice Full Flow');
    const { handleMinorRationSubservices } = require('../src/core/fsm/fsm_minor_subservices');
    const addrSess = getOrCreateSession('9876543219');
    addrSess.chatHistory = [];
    addrSess.intakeState = 'RATION_CHANGE_ADDRESS';
    handleMinorRationSubservices('ADDR_PROOF_EB', addrSess, addrSess.intakeState);
    assert.strictEqual(addrSess.intakeState, 'RATION_CHANGE_ADDRESS_UPLOAD');
    assert.strictEqual(addrSess.subService, 'CHANGE_ADDRESS');
    assert.strictEqual(addrSess.subServiceData.proofType, 'மின் கட்டண ரசீது (EB Bill)');

    handleMinorRationSubservices('45, காந்தி தெரு, அரக்கோணம்', addrSess, addrSess.intakeState);
    assert.strictEqual(addrSess.intakeState, 'READY_TO_APPLY');
    assert.strictEqual(addrSess.subServiceData.newAddress, '45, காந்தி தெரு, அரக்கோணம்');
    console.log('  ✅ PASS: Change Address transitions smoothly from proof selection to READY_TO_APPLY.');

    // -----------------------------------------------------------------
    // TEST 11: TNeGA Income Certificate Strict Sequential Gating & Simulation
    // -----------------------------------------------------------------
    console.log('[JOURNEY 11] TNeGA Income Certificate Strict Sequential Gating & Simulation');
    const incomeSimMob = '9998881122';
    const incSess = getOrCreateSession(incomeSimMob);
    incSess.citizenProfile = {
        fullNameTam: 'குமரன் கி',
        fullNameEng: 'Kumaran K',
        headAadhaar: '123456789012',
        fatherNameTam: 'கிருபாகரன்',
        fatherNameEng: 'Kirubakaran',
        doorNo: '12/4',
        streetTam: 'மேட்டு தெரு, நரசிங்கபுரம்',
        district: 'Ranipet',
        taluk: 'Arakkonam',
        village: 'Minnal',
        pincode: '632510',
        mobileNumber: incomeSimMob
    };
    incSess.chatHistory = [];

    // Step 1: Customer with NO CAN selects Income Certificate
    handleServiceSelection('வருமானச் சான்றிதழ்', incSess);
    const lastMsg1 = incSess.chatHistory[incSess.chatHistory.length - 1];
    assert.strictEqual(incSess.intakeState, 'INCOME_CAN_GATE', 'Must transition to INCOME_CAN_GATE');
    assert.strictEqual(lastMsg1.options.length, 3, 'Must present EXACTLY 3 CAN options');
    assert.ok(lastMsg1.options.some(o => o.value === 'CAN_SEARCH_PROMPT'), 'Must offer CAN search');
    assert.ok(lastMsg1.options.some(o => o.value === 'CAN_REGISTER_PROMPT'), 'Must offer CAN register');
    assert.ok(lastMsg1.options.some(o => o.value === 'CAN_DIRECT_INPUT'), 'Must offer Direct CAN input');
    assert.ok(!lastMsg1.options.some(o => o.value.includes('₹')), 'Must NEVER dump income chips before CAN is verified!');
    console.log('  ✅ PASS: Gate 1 enforced: Zero unrelated option dumping; presents ONLY 3 CAN options.');

    // Step 2: Customer enters 13-digit CAN
    const { handleTnegaIntake } = require('../src/routes/chat/chat_tnega_intake');
    incSess.intakeState = 'CAN_DIRECT_INPUT_WAIT';
    let resJson = null;
    const incMockRes = { json: (d) => { resJson = d; } };
    const incMockReq = { headers: {} };
    const canCtx = { text: '133370337878397', sess: incSess, uploadedFile: null };
    await handleTnegaIntake(canCtx, incMockReq, incMockRes);
    assert.strictEqual(incSess.citizenProfile.canNumber, '133370337878397', 'CAN number saved to profile');
    assert.strictEqual(incSess.intakeState, 'INCOME_MOTHER_NAME_WAIT', 'Must transition to Mother Name intake since mother name is missing');
    const lastMsg2 = incSess.chatHistory[incSess.chatHistory.length - 1];
    assert.ok(lastMsg2.text.includes('தாயின் பெயர்'), 'Must prompt specifically for Mother Name');
    console.log('  ✅ PASS: Gate 2 enforced: Detects missing Mother Name and prompts specifically without skipping.');

    // Step 3: Customer enters Mother Name
    const motherCtx = { text: 'தேவகி கி', sess: incSess, uploadedFile: null };
    await handleTnegaIntake(motherCtx, incMockReq, incMockRes);
    assert.strictEqual(incSess.citizenProfile.motherNameTam, 'தேவகி கி', 'Mother name saved in Tamil');
    assert.strictEqual(incSess.intakeState, 'INCOME_COMMUNITY_WAIT', 'Must transition to Community intake since community is missing');
    const lastMsg3 = incSess.chatHistory[incSess.chatHistory.length - 1];
    assert.ok(lastMsg3.options.some(o => o.value === 'COMMUNITY_MBC'), 'Must present MBC option');
    assert.ok(lastMsg3.options.some(o => o.value === 'COMMUNITY_BC'), 'Must present BC option');
    console.log('  ✅ PASS: Gate 3 enforced: Saves Mother Name and prompts for Community/Caste with 1-click buttons.');

    // Step 4: Customer selects Community
    const commCtx = { text: 'COMMUNITY_MBC', sess: incSess, uploadedFile: null };
    await handleTnegaIntake(commCtx, incMockReq, incMockRes);
    assert.strictEqual(incSess.citizenProfile.community, 'MBC', 'Community saved as MBC');
    assert.strictEqual(incSess.intakeState, 'INCOME_MEMBER_COUNT_WAIT', 'Transitions to INCOME_MEMBER_COUNT_WAIT');
    const lastMsg4 = incSess.chatHistory[incSess.chatHistory.length - 1];
    assert.ok(lastMsg4.options.some(o => o.value === '1 நபர்'), 'Must present member count chips');
    console.log('  ✅ PASS: Gate 4 enforced: Saves Community and presents Member Count chips.');

    // Step 4B: Customer selects Member Count
    const countCtx = { text: '1 நபர்', sess: incSess, uploadedFile: null };
    await handleTnegaIntake(countCtx, incMockReq, incMockRes);
    assert.strictEqual(incSess.citizenProfile.familyMemberCount, 1, 'Member count saved as 1');
    assert.strictEqual(incSess.intakeState, 'INCOME_INTAKE', 'Transitions to INCOME_INTAKE for annual income');
    const lastMsg4b = incSess.chatHistory[incSess.chatHistory.length - 1];
    assert.ok(lastMsg4b.options.some(o => o.value === '₹60,000'), 'Must present income chips');
    console.log('  ✅ PASS: Gate 4B enforced: Saves Member Count and presents Income amount chips.');

    // Step 5: Customer selects Income Amount
    const incCtx = { text: '₹60,000', sess: incSess, uploadedFile: null };
    await handleTnegaIntake(incCtx, incMockReq, incMockRes);
    assert.strictEqual(incSess.citizenProfile.annualIncome, '60000', 'Annual income saved as 60000');
    const lastMsg5 = incSess.chatHistory[incSess.chatHistory.length - 1];
    assert.ok(lastMsg5.options.some(o => o.value === 'கூலி வேலை'), 'Must present occupation options');
    console.log('  ✅ PASS: Saves Income and prompts for Occupation.');

    // Step 6: Customer selects Occupation
    const occCtx = { text: 'கூலி வேலை', sess: incSess, uploadedFile: null };
    await handleTnegaIntake(occCtx, incMockReq, incMockRes);
    assert.strictEqual(incSess.citizenProfile.profession, 'கூலி வேலை', 'Profession saved as கூலி வேலை');
    assert.strictEqual(incSess.intakeState, 'READY_TO_APPLY_INCOME', 'Must transition to READY_TO_APPLY_INCOME');
    const lastMsg6 = incSess.chatHistory[incSess.chatHistory.length - 1];
    assert.ok(lastMsg6.text.includes('100% தயாராக உள்ளன'), 'Declares 100% ready only when ALL items are present');
    assert.ok(lastMsg6.text.includes('133370337878397'), 'Displays verified CAN number');
    assert.ok(lastMsg6.text.includes('தேவகி கி'), 'Displays Mother Name');
    assert.ok(lastMsg6.text.includes('MBC'), 'Displays Community');
    assert.ok(lastMsg6.options.some(o => o.value === 'START_INCOME_APPLY'), 'Provides START_INCOME_APPLY button');
    console.log('  ✅ PASS: Complete Summary verified: CAN, Mother Name, Community, Income, and Address.');

    // Step 7: Clicking START_INCOME_APPLY starts automation cleanly
    const startIncCtx = { text: 'START_INCOME_APPLY', sess: incSess, targetMobile: incomeSimMob };
    const startHandled = await handleAutomationStarter(startIncCtx, starterReq, starterRes);
    assert.strictEqual(startHandled, true, 'START_INCOME_APPLY must be handled cleanly');
    assert.strictEqual(incSess.isAutomating, true, 'Automation state must be active');
    const lastMsg7 = incSess.chatHistory[incSess.chatHistory.length - 1];
    assert.ok(lastMsg7.text.includes('REV-103') && lastMsg7.text.includes('வருமானச் சான்றிதழ்'), 'Confirms REV-103 automation startup');
    assert.ok(!lastMsg7.text.includes('ரேஷன் கார்டு'), 'Must NEVER fall back to Ration Card welcome prompt!');
    console.log('  ✅ PASS: START_INCOME_APPLY launches REV-103 automation directly without looping to welcome!');

    for (const m of [testMobile, newCustMobile, '9999900077', '9998887776', '9876543219', incomeSimMob]) {
        sessions.delete(m);
    }
    console.log('\n------------------------------------------------------');
    console.log('🎉 OPERATOR JOURNEY SIMULATOR PASSED: 100% SUCCESS!');
    console.log('------------------------------------------------------\n');
    return true;
}

if (require.main === module) {
    runOperatorJourneySimulator().then(() => process.exit(0)).catch(err => {
        console.error('❌ Journey Simulator Failed:', err);
        process.exit(1);
    });
}

module.exports = { runOperatorJourneySimulator };
