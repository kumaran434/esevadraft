/**
 * Targeted Test: TNeGA Income Certificate (REV-103) Self-Declaration & Pay Slip Non-Mandatory Gate
 * 
 * Verifies Founder Request:
 * 1. Pay slip is NOT mandatory for farmers, coolies, and informal workers.
 * 2. Upload pay slip option remains available for those who have it.
 * 3. 1-click quick chips provided:
 *    - "🌾 விவசாயி (Farmer - மாதம் ₹6,000 / ஆண்டு ₹72,000)"
 *    - "🔨 கூலி வேலை (Daily Wage - மாதம் ₹6,000 / ஆண்டு ₹72,000)"
 * 4. Natural text typing supported:
 *    - "விவசாயி மாசம் 6000" -> auto calculates annual ₹72,000 and sets profession "விவசாயம்"
 *    - "விவசாயி" -> prompts for monthly salary with chips
 *    - "6000" -> prompts for profession with chips
 * 5. Advances cleanly without blocking on physical payslip file.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { advanceTnegaIncomeFlow } = require('../src/core/fsm/tnega_flow_engine');
const { handleTnegaIntake } = require('../src/routes/chat/chat_tnega_intake');

console.log('🧪 Starting Income Certificate Self-Declaration & Friendly Intake Tests...\n');

const testDir = path.join(__dirname, 'temp_test_docs');
if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

const dummyPhoto = path.join(testDir, 'test_photo.jpg');
const dummyAadhaar = path.join(testDir, 'test_aadhaar.pdf');
fs.writeFileSync(dummyPhoto, Buffer.alloc(1024, 'a'));
fs.writeFileSync(dummyAadhaar, Buffer.alloc(2048, 'b'));

async function runTests() {
    // -------------------------------------------------------------------------
    // TEST 1: Initial Prompt displays friendly rule and 1-click options
    // -------------------------------------------------------------------------
    console.log('Test 1: Initial Prompt displays friendly rule and 1-click options...');
    const sess1 = {
        mobileNumber: '9988771122',
        chatHistory: [],
        citizenProfile: {
            mobileNumber: '9988771122',
            fullNameTam: 'குமரன் கி',
            fullNameEng: 'Kumaran K',
            headAadhaar: '575567662931',
            headAadhaarDocPath: dummyAadhaar,
            headPhotoPath: dummyPhoto
        }
    };

    const step1 = advanceTnegaIncomeFlow(sess1);
    assert.strictEqual(sess1.intakeState, 'INCOME_PROOF_WAIT');
    assert.ok(step1.text.includes('சம்பள ரசீது (Pay Slip) கட்டாயமில்லை'), 'Must inform user that payslip is not mandatory');
    assert.ok(step1.text.includes('சுய அறிவிப்பு'), 'Mentions self-declaration');
    
    const optValues = (step1.options || []).map(o => o.value);
    assert.ok(optValues.includes('INCOME_DECL_FARMER_6000'), 'Must include 1-click Farmer option');
    assert.ok(optValues.includes('INCOME_DECL_COOLIE_6000'), 'Must include 1-click Coolie option');
    assert.ok(optValues.includes('TRIGGER_FILE_UPLOAD'), 'Must still offer pay slip file upload');
    assert.ok(optValues.includes('TRIGGER_EDIT_MODAL'), 'Must offer Edit Modal');
    console.log('  ✅ Test 1 Passed: Friendly prompt and 1-click options presented.\n');

    // -------------------------------------------------------------------------
    // TEST 2: 1-Click "INCOME_DECL_FARMER_6000" selection
    // -------------------------------------------------------------------------
    console.log('Test 2: Selecting 1-click "INCOME_DECL_FARMER_6000"...');
    let responseData2 = null;
    const fakeRes2 = {
        json: (data) => { responseData2 = data; }
    };
    const ctx2 = {
        text: 'INCOME_DECL_FARMER_6000',
        uploadedFile: null,
        sess: sess1
    };

    const handled2 = await handleTnegaIntake(ctx2, {}, fakeRes2);
    assert.strictEqual(handled2, true, 'handleTnegaIntake must handle the request');
    assert.strictEqual(sess1.citizenProfile.profession, 'விவசாயம்', 'Profession must be விவசாயம்');
    assert.strictEqual(sess1.citizenProfile.monthlyIncome, 6000, 'Monthly income must be 6000');
    assert.strictEqual(sess1.citizenProfile.annualIncome, '72000', 'Annual income must be 72000 (6000 * 12)');
    assert.strictEqual(sess1.citizenProfile.incomeProof, 'SELF_DECLARATION', 'Must mark incomeProof as SELF_DECLARATION');
    // Advances past document gate to CAN gate!
    assert.strictEqual(sess1.intakeState, 'INCOME_CAN_GATE', 'Must advance to CAN gate without blocking for payslip file');
    console.log('  ✅ Test 2 Passed: 1-click farmer option immediately records ₹6,000/month & ₹72,000/year and advances to CAN!\n');

    // -------------------------------------------------------------------------
    // TEST 3: Natural typing "விவசாயி மாசம் 6000"
    // -------------------------------------------------------------------------
    console.log('Test 3: Natural typing "விவசாயி மாசம் 6000"...');
    const sess3 = {
        mobileNumber: '9988771133',
        chatHistory: [],
        intakeState: 'INCOME_PROOF_WAIT',
        citizenProfile: {
            mobileNumber: '9988771133',
            fullNameTam: 'சுரேஷ்',
            headAadhaar: '575567662931',
            headAadhaarDocPath: dummyAadhaar,
            headPhotoPath: dummyPhoto,
            canNumber: '133370337878397' // Has CAN
        }
    };

    let responseData3 = null;
    const fakeRes3 = { json: (d) => { responseData3 = d; } };
    const ctx3 = {
        text: 'விவசாயி மாசம் 6000',
        uploadedFile: null,
        sess: sess3
    };

    const handled3 = await handleTnegaIntake(ctx3, {}, fakeRes3);
    assert.strictEqual(handled3, true);
    assert.strictEqual(sess3.citizenProfile.profession, 'விவசாயம்');
    assert.strictEqual(sess3.citizenProfile.monthlyIncome, 6000);
    assert.strictEqual(sess3.citizenProfile.annualIncome, '72000');
    // Since CAN already exists, advances straight to Mother Name gate!
    assert.strictEqual(sess3.intakeState, 'INCOME_MOTHER_NAME_WAIT');
    console.log('  ✅ Test 3 Passed: Typed text "விவசாயி மாசம் 6000" parsed and advanced to Mother Name!\n');

    // -------------------------------------------------------------------------
    // TEST 4: Typing "கூலி வேலை 5000"
    // -------------------------------------------------------------------------
    console.log('Test 4: Typing "கூலி வேலை 5000"...');
    const sess4 = {
        mobileNumber: '9988771144',
        chatHistory: [],
        intakeState: 'INCOME_PROOF_WAIT',
        citizenProfile: {
            mobileNumber: '9988771144',
            fullNameTam: 'முருகன்',
            headAadhaar: '575567662931',
            headAadhaarDocPath: dummyAadhaar,
            headPhotoPath: dummyPhoto,
            canNumber: '133370337878397'
        }
    };

    let responseData4 = null;
    const fakeRes4 = { json: (d) => { responseData4 = d; } };
    const ctx4 = {
        text: 'கூலி வேலை 5000',
        uploadedFile: null,
        sess: sess4
    };

    const handled4 = await handleTnegaIntake(ctx4, {}, fakeRes4);
    assert.strictEqual(handled4, true);
    assert.strictEqual(sess4.citizenProfile.profession, 'கூலி வேலை');
    assert.strictEqual(sess4.citizenProfile.monthlyIncome, 5000);
    assert.strictEqual(sess4.citizenProfile.annualIncome, '60000');
    assert.strictEqual(sess4.intakeState, 'INCOME_MOTHER_NAME_WAIT');
    console.log('  ✅ Test 4 Passed: Typed text "கூலி வேலை 5000" recorded monthly ₹5000 & annual ₹60000!\n');

    // -------------------------------------------------------------------------
    // TEST 5: Typing "விவசாயி" alone prompts for monthly income with chips
    // -------------------------------------------------------------------------
    console.log('Test 5: Typing "விவசாயி" alone prompts for monthly income...');
    const sess5 = {
        mobileNumber: '9988771155',
        chatHistory: [],
        intakeState: 'INCOME_PROOF_WAIT',
        citizenProfile: {
            mobileNumber: '9988771155',
            headAadhaar: '575567662931',
            headAadhaarDocPath: dummyAadhaar,
            headPhotoPath: dummyPhoto
        }
    };

    let responseData5 = null;
    const fakeRes5 = { json: (d) => { responseData5 = d; } };
    const ctx5 = {
        text: 'விவசாயி',
        uploadedFile: null,
        sess: sess5
    };

    const handled5 = await handleTnegaIntake(ctx5, {}, fakeRes5);
    assert.strictEqual(handled5, true);
    assert.strictEqual(sess5.citizenProfile.profession, 'விவசாயம்');
    assert.strictEqual(sess5.intakeState, 'INCOME_MONTHLY_WAIT');
    const lastMsg5 = sess5.chatHistory[sess5.chatHistory.length - 1];
    assert.ok(lastMsg5.text.includes('மாத வருமானம்'), 'Must ask for monthly salary');
    assert.ok(lastMsg5.options.some(o => o.value === 'INCOME_AMOUNT_6000'), 'Offers ₹6,000 option');

    // Next step: user clicks INCOME_AMOUNT_6000
    const ctx5b = {
        text: 'INCOME_AMOUNT_6000',
        uploadedFile: null,
        sess: sess5
    };
    const handled5b = await handleTnegaIntake(ctx5b, {}, fakeRes5);
    assert.strictEqual(handled5b, true);
    assert.strictEqual(sess5.citizenProfile.monthlyIncome, 6000);
    assert.strictEqual(sess5.citizenProfile.annualIncome, '72000');
    assert.strictEqual(sess5.intakeState, 'INCOME_CAN_GATE');
    console.log('  ✅ Test 5 Passed: Typing "விவசாயி" -> prompt monthly income -> click ₹6,000 advances cleanly!\n');

    console.log('======================================================');
    console.log('🎉 ALL INCOME SELF-DECLARATION TESTS PASSED 100%!');
    console.log('======================================================\n');
}

runTests().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
