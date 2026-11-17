/**
 * Comprehensive Simulation & Regression Suite: TNeGA First Graduate Certificate (REV-104)
 * 
 * Verifies Golden Rule 4 (Zero Pollution Law - using strictly data/golden_samples/first_graduate/),
 * Golden Rule 11 (Document-First 2-Phase Intake Architecture),
 * and Pre-Submit Human Gate (100% Ready Station).
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
    advanceTnegaFirstGraduateFlow
} = require('../src/core/fsm/tnega_flow_engine');
const { evaluateServiceChecklist } = require('../src/core/services_registry');
const { getService, evaluateDelta } = require('../src/catalog');
const { startTnegaFirstGraduateFlow } = require('../src/portal/tnega/tnega_first_graduate');

console.log('🧪 Starting First Graduate Certificate (REV-104) Comprehensive Simulation...\n');

const goldenDir = path.join(__dirname, '..', 'data', 'golden_samples', 'first_graduate');

async function runFirstGraduateSimulation() {
    // -------------------------------------------------------------------------
    // TEST 1: Golden Sample Document Assets Verification
    // -------------------------------------------------------------------------
    console.log('Test 1: Verifying Golden Sample Assets in data/golden_samples/first_graduate/...');
    assert(fs.existsSync(goldenDir), 'Golden directory must exist');

    const expectedDocs = [
        'student_passport_photo.jpg',
        'student_aadhaar.jpg',
        'student_12th_tc.jpg',
        'family_smart_card.jpg',
        'father_tc.jpg',
        'mother_tc.jpg'
    ];

    for (const docName of expectedDocs) {
        const fullPath = path.join(goldenDir, docName);
        assert(fs.existsSync(fullPath), `Asset ${docName} must exist on disk`);
        const sz = fs.statSync(fullPath).size;
        assert(sz > 500, `Asset ${docName} must not be empty (got ${sz} bytes)`);
    }
    console.log('  ✅ All 6 Golden Sample Documents verified on disk with valid file sizes.\n');

    // -------------------------------------------------------------------------
    // TEST 2: Service Catalog & Registry Metadata Verification
    // -------------------------------------------------------------------------
    console.log('Test 2: Verifying Universal Catalog & Registry Registration...');
    const catalogSvc = getService('FIRST_GRADUATE');
    assert(catalogSvc, 'Catalog must recognize FIRST_GRADUATE');
    assert.strictEqual(catalogSvc.code, 'REV-104', 'Service code must be REV-104');
    assert.strictEqual(catalogSvc.portal, 'TNEGA', 'Portal must be TNEGA');

    const chkEmpty = evaluateServiceChecklist('FIRST_GRADUATE_CERTIFICATE', {}, {});
    assert.strictEqual(chkEmpty.isReady, false, 'Empty profile must not be ready');
    assert(chkEmpty.missingCount > 0, 'Empty profile must report missing items');
    console.log('  ✅ Service Catalog & Registry checklist matrix verified.\n');

    // -------------------------------------------------------------------------
    // TEST 3: Document-First FSM Flow Engine Simulation
    // -------------------------------------------------------------------------
    console.log('Test 3: Simulating Document-First Intake Journey...');
    const sess = {
        chatHistory: [],
        tempUploads: {},
        citizenProfile: {}
    };

    // Step 3.1: Initial State -> Aadhaar Gate
    let step = advanceTnegaFirstGraduateFlow(sess);
    assert.strictEqual(sess.intakeState, 'FIRST_GRADUATE_AADHAAR_WAIT');
    assert(step.text.includes('ஆதார் அட்டை'), 'Must prompt for Aadhaar card');
    console.log('  ✅ Step 3.1: Enforces Student Aadhaar Card first.');

    // Step 3.2: Upload Student Aadhaar
    sess.citizenProfile.headAadhaarDocPath = path.join(goldenDir, 'student_aadhaar.jpg');
    sess.citizenProfile.fullNameTam = 'சூர்யா கி';
    sess.citizenProfile.fullNameEng = 'Surya K';
    sess.citizenProfile.fatherNameTam = 'கிருபாகரன்';
    sess.citizenProfile.fatherNameEng = 'Kirubakaran';
    sess.citizenProfile.headAadhaar = '575567662931';
    sess.citizenProfile.doorNo = '216';
    sess.citizenProfile.streetTam = 'மேட்டு தெரு';
    sess.citizenProfile.streetEng = 'Mettu Street';
    sess.citizenProfile.district = 'Ranipet';
    sess.citizenProfile.taluk = 'Arakkonam';
    sess.citizenProfile.village = 'Minnal';
    sess.citizenProfile.pincode = '632510';

    step = advanceTnegaFirstGraduateFlow(sess);
    assert.strictEqual(sess.intakeState, 'FIRST_GRADUATE_PHOTO_WAIT');
    assert(step.text.includes('பாஸ்போர்ட் புகைப்படம்'), 'Must prompt for Student Passport Photo');
    console.log('  ✅ Step 3.2: Enforces Student Passport Photo (<50KB direct photo).');

    // Step 3.3: Upload Student Passport Photo
    sess.citizenProfile.headPhotoPath = path.join(goldenDir, 'student_passport_photo.jpg');
    step = advanceTnegaFirstGraduateFlow(sess);
    assert.strictEqual(sess.intakeState, 'FIRST_GRADUATE_APPLICANT_PROOF_WAIT');
    assert(step.text.includes('12-ஆம் வகுப்பு'), 'Must prompt for 12th TC / Marksheet');
    console.log('  ✅ Step 3.3: Enforces Applicant 12th Transfer Certificate (TC).');

    // Step 3.4: Upload Student 12th TC
    sess.citizenProfile.applicantEducationProof = path.join(goldenDir, 'student_12th_tc.jpg');
    step = advanceTnegaFirstGraduateFlow(sess);
    assert.strictEqual(sess.intakeState, 'FIRST_GRADUATE_SMARTCARD_WAIT');
    assert(step.text.includes('ஸ்மார்ட்'), 'Must prompt for Family Smart Card');
    console.log('  ✅ Step 3.4: Enforces Family Smart Ration Card.');

    // Step 3.5: Upload Family Smart Card
    sess.citizenProfile.smartCard = path.join(goldenDir, 'family_smart_card.jpg');
    step = advanceTnegaFirstGraduateFlow(sess);
    assert.strictEqual(sess.intakeState, 'FIRST_GRADUATE_FATHER_PROOF_WAIT');
    assert(step.text.includes('தந்தையின்'), 'Must prompt for Father Transfer Certificate');
    console.log('  ✅ Step 3.5: Enforces Father Educational Proof (Father TC).');

    // Step 3.6: Upload Father TC
    sess.citizenProfile.fatherEducationProof = path.join(goldenDir, 'father_tc.jpg');
    step = advanceTnegaFirstGraduateFlow(sess);
    assert.strictEqual(sess.intakeState, 'FIRST_GRADUATE_MOTHER_PROOF_WAIT');
    assert(step.text.includes('தாயாரின்'), 'Must prompt for Mother Transfer Certificate');
    console.log('  ✅ Step 3.6: Enforces Mother Educational Proof (Mother TC).');

    // Step 3.7: Upload Mother TC
    sess.citizenProfile.motherEducationProof = path.join(goldenDir, 'mother_tc.jpg');
    step = advanceTnegaFirstGraduateFlow(sess);
    assert.strictEqual(sess.intakeState, 'FIRST_GRADUATE_CAN_GATE');
    assert(step.text.includes('CAN எண்'), 'Must prompt for 13-digit CAN Number');
    console.log('  ✅ Step 3.7: Enforces CAN Gate only after all documents are physically on disk.');

    // Step 3.8: Enter CAN Number
    sess.citizenProfile.canNumber = '133370337878397';
    step = advanceTnegaFirstGraduateFlow(sess);
    assert.strictEqual(sess.intakeState, 'FIRST_GRADUATE_MOTHER_NAME_WAIT');
    assert(step.text.includes('தாயின் பெயர்'), 'Must prompt for Mother Name');
    console.log('  ✅ Step 3.8: Sequentially prompts Mother Name.');

    // Step 3.9: Enter Mother Name -> Course Wait
    sess.citizenProfile.motherNameTam = 'தேவகி';
    sess.citizenProfile.motherNameEng = 'Devaki';
    step = advanceTnegaFirstGraduateFlow(sess);
    assert.strictEqual(sess.intakeState, 'FIRST_GRADUATE_COURSE_WAIT');
    assert(step.text.includes('படிக்கும்') && step.text.includes('படிப்பு'), 'Must prompt for Degree / Course Name');
    console.log('  ✅ Step 3.9: Sequentially prompts Degree / Course Name.');

    // Step 3.10: Select Course Name -> College Wait
    sess.citizenProfile.currentCourse = 'B.E. Computer Science and Engineering';
    step = advanceTnegaFirstGraduateFlow(sess);
    assert.strictEqual(sess.intakeState, 'FIRST_GRADUATE_COLLEGE_WAIT');
    assert(step.text.includes('கல்லூரி') || step.text.includes('கல்வி'), 'Must prompt for College / Institution Name');
    console.log('  ✅ Step 3.10: Sequentially prompts College / Institution Name.');

    // Step 3.11: Select College Name -> Parents' Education Wait
    sess.citizenProfile.institutionName = 'Government College of Technology, Coimbatore';
    step = advanceTnegaFirstGraduateFlow(sess);
    assert.strictEqual(sess.intakeState, 'FIRST_GRADUATE_PARENT_EDU_WAIT');
    assert(step.text.includes('பெற்றோரின் கல்வித் தகுதி'), 'Must prompt for Parent Education Levels');
    console.log('  ✅ Step 3.11: Sequentially prompts Parent Education Levels.');

    // Step 3.12: Enter Parent Education Levels -> Year of Passing Wait
    sess.citizenProfile.fatherEducation = '10th Standard';
    sess.citizenProfile.motherEducation = '8th Standard';
    step = advanceTnegaFirstGraduateFlow(sess);
    assert.strictEqual(sess.intakeState, 'FIRST_GRADUATE_YOP_WAIT');
    assert(step.text.includes('தேர்ச்சி'), 'Must prompt for Year of Passing');
    console.log('  ✅ Step 3.12: Sequentially prompts Year of Passing.');

    // Step 3.13: Enter Year of Passing -> Family Check Gate
    sess.citizenProfile.yearOfPassing = '2024';
    step = advanceTnegaFirstGraduateFlow(sess);
    assert.strictEqual(sess.intakeState, 'FIRST_GRADUATE_FAMILY_CHECK_GATE');
    assert(step.text.includes('வேறு யாரும் பட்டப்படிப்பு'), 'Must prompt for Graduate Eligibility Confirmation');
    console.log('  ✅ Step 3.13: Enforces First Graduate Family Eligibility Confirmation Gate.');

    // Step 3.14: Confirm Family Graduate Eligibility -> 100% Ready Station
    sess.citizenProfile.familyGraduateConfirmed = true;
    step = advanceTnegaFirstGraduateFlow(sess);
    assert.strictEqual(sess.intakeState, 'READY_TO_APPLY_FIRST_GRADUATE');
    assert(step.text.includes('100% தயாராக உள்ளன'), 'Must declare 100% Ready Station');
    assert(step.options.some(o => o.value === 'START_FIRST_GRADUATE_APPLY'), 'Must include 1-click START_FIRST_GRADUATE_APPLY button');
    console.log('  ✅ Step 3.14: Reached 100% Ready Station with 1-click START_FIRST_GRADUATE_APPLY button.\n');

    // -------------------------------------------------------------------------
    // TEST 4: Full Checklist Verification at Ready Station
    // -------------------------------------------------------------------------
    console.log('Test 4: Evaluating Service Checklist on Complete Surya K Profile...');
    const chkFull = evaluateServiceChecklist('FIRST_GRADUATE_CERTIFICATE', sess.citizenProfile, {});
    assert.strictEqual(chkFull.isReady, true, 'Profile must be 100% ready');
    assert.strictEqual(chkFull.missingCount, 0, 'Missing count must be exactly 0');
    console.log(`  ✅ Checklist evaluation: ${chkFull.summaryTamil}\n`);

    // -------------------------------------------------------------------------
    // TEST 5: Mock Sandbox Automation Runner Execution
    // -------------------------------------------------------------------------
    console.log('Test 5: Executing Mock Sandbox Automation Runner...');
    const progressLogs = [];
    const runnerRes = await startTnegaFirstGraduateFlow(
        sess.citizenProfile,
        (msg) => progressLogs.push(msg),
        { isMockSandbox: true }
    );

    assert(runnerRes.success, 'Runner must succeed in mock sandbox');
    assert(runnerRes.isMockSandbox, 'Must flag as mock sandbox');
    assert.strictEqual(runnerRes.canNumber, '133370337878397');
    assert(progressLogs.length >= 4, 'Must log all automation stages');
    console.log('  ✅ Mock Sandbox Automation executed cleanly with all progress updates:');
    progressLogs.forEach(l => console.log(`     • ${l}`));

    console.log('\n🎉 ALL FIRST GRADUATE CERTIFICATE TESTS PASSED 100%!\n');
}

runFirstGraduateSimulation().catch(err => {
    console.error('❌ Simulation Error:', err);
    process.exit(1);
});
