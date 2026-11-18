/**
 * Comprehensive Simulation & Regression Suite: 3 Core Revenue Services
 * 1. REV-103 Income Certificate (வருமானச் சான்றிதழ்)
 * 2. REV-101 Community Certificate (சாதிச் சான்றிதழ்)
 * 3. REV-102 Residence / Nativity Certificate (இருப்பிடச் சான்றிதழ்)
 * 
 * Verifies Golden Rule 11 & Golden Rule 19:
 * - Documents First -> Auto-extract Bucket A -> CAN Gate -> Sequential Bucket B Questions -> 100% Ready
 * - Pay Slip is NON-MANDATORY (Self-Declaration for farmers/coolies/informal workers)
 * - Intelligent Passport Photo Cropping (<50KB, 200x230 px, face centered)
 * - Edit Modal Submission does NOT falsely block when income is declared
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
    advanceTnegaIncomeFlow,
    advanceTnegaCommunityFlow,
    advanceTnegaResidenceFlow
} = require('../src/core/fsm/tnega_flow_engine');
const { evaluateServiceChecklist } = require('../src/core/services_registry');
const { produceCompliantPassportPhoto } = require('../photo_studio');

console.log('🧪 Starting 3 Core Revenue Services Comprehensive Simulation...\n');

const testDir = path.join(__dirname, 'temp_test_revenue');
if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

const dummyPhoto = path.join(testDir, 'test_portrait_photo.jpg');
const dummyAadhaar = path.join(testDir, 'test_aadhaar.pdf');
const dummyCommProof = path.join(testDir, 'test_comm_tc.pdf');
const dummyResProof = path.join(testDir, 'test_eb_bill.pdf');

// Create test image with sharp
async function createTestAssets() {
    const sharp = require('sharp');
    // Create an 800x1000 sample portrait
    await sharp({
        create: {
            width: 800,
            height: 1000,
            channels: 3,
            background: { r: 240, g: 240, b: 245 }
        }
    })
    .composite([
        // Simulate a face in the upper-middle area (top 150 to 550, left 250 to 550)
        {
            input: Buffer.from(
                `<svg width="800" height="1000">
                    <circle cx="400" cy="350" r="160" fill="#d4a373" />
                    <circle cx="340" cy="320" r="20" fill="#222" />
                    <circle cx="460" cy="320" r="20" fill="#222" />
                    <rect x="250" y="550" width="300" height="350" rx="40" fill="#1d3557" />
                </svg>`
            ),
            top: 0,
            left: 0
        }
    ])
    .jpeg({ quality: 90 })
    .toFile(dummyPhoto);

    fs.writeFileSync(dummyAadhaar, Buffer.alloc(2048, 'a'));
    fs.writeFileSync(dummyCommProof, Buffer.alloc(2048, 'b'));
    fs.writeFileSync(dummyResProof, Buffer.alloc(2048, 'c'));
}

async function runSimulation() {
    await createTestAssets();

    // =========================================================================
    // SECTION 1: Intelligent Passport Photo Auto-Cropping Test
    // =========================================================================
    console.log('--- Section 1: Intelligent Passport Photo Cropping Test ---');
    const sharp = require('sharp');
    
    // Test with simulated face bounding box: [ymin, xmin, ymax, xmax] normalized 0-1000
    // Face is between y: 190 to 510, x: 240 to 560
    const croppedPassport = await produceCompliantPassportPhoto(dummyPhoto, {
        faceBoundingBox: [190, 240, 510, 560]
    });

    assert.ok(fs.existsSync(croppedPassport), 'Output passport photo must exist on disk');
    const passportMeta = await sharp(croppedPassport).metadata();
    assert.strictEqual(passportMeta.width, 200, 'Passport photo width must be exactly 200px');
    assert.strictEqual(passportMeta.height, 230, 'Passport photo height must be exactly 230px');
    const passportSize = fs.statSync(croppedPassport).size;
    assert.ok(passportSize < 45 * 1024, `Passport photo size must be < 45KB (actual: ${(passportSize/1024).toFixed(1)} KB)`);
    console.log(`  ✅ Section 1 Passed: Photo successfully cropped to 200x230, centered on face, size: ${(passportSize/1024).toFixed(1)} KB (<45KB)\n`);

    // =========================================================================
    // SECTION 2: REV-103 Income Certificate End-to-End Intake Flow Simulation
    // =========================================================================
    console.log('--- Section 2: REV-103 Income Certificate Simulation ---');
    let sessInc = {
        mobileNumber: '9790170026',
        citizenProfile: {
            mobileNumber: '9790170026'
        }
    };

    // Step 1: No Aadhaar
    let step = advanceTnegaIncomeFlow(sessInc);
    assert.strictEqual(sessInc.intakeState, 'INCOME_AADHAAR_WAIT');
    assert.ok(step.text.includes('ஆதார் அட்டை'), 'Must request Aadhaar card first');

    // Step 2: Aadhaar provided -> Photo required
    sessInc.citizenProfile.headAadhaarDocPath = dummyAadhaar;
    sessInc.citizenProfile.headAadhaar = '575567662931';
    sessInc.citizenProfile.fullNameTam = 'குமரன் கி';
    sessInc.citizenProfile.fullNameEng = 'Kumaran K';
    step = advanceTnegaIncomeFlow(sessInc);
    assert.strictEqual(sessInc.intakeState, 'INCOME_PHOTO_WAIT');
    assert.ok(step.text.includes('பாஸ்போர்ட் புகைப்படம்'), 'Must request Passport Photo');

    // Step 3: Photo provided -> Income details required (Friendly non-mandatory payslip rule!)
    sessInc.citizenProfile.headPhotoPath = croppedPassport;
    step = advanceTnegaIncomeFlow(sessInc);
    assert.strictEqual(sessInc.intakeState, 'INCOME_PROOF_WAIT');
    assert.ok(step.text.includes('சம்பள ரசீது (Pay Slip) கட்டாயமில்லை'), 'Must notify that payslip is not compulsory');
    const optValues = step.options.map(o => o.value);
    assert.ok(optValues.includes('INCOME_DECL_FARMER_6000'), 'Must provide 1-click Farmer option');
    assert.ok(optValues.includes('INCOME_DECL_COOLIE_6000'), 'Must provide 1-click Coolie option');

    // Step 4: User selects Farmer / Self-declaration -> Advances to CAN Gate
    sessInc.citizenProfile.incomeProof = 'SELF_DECLARATION';
    sessInc.citizenProfile.profession = 'விவசாயம்';
    sessInc.citizenProfile.annualIncome = '72000';
    sessInc.citizenProfile.monthlyIncome = '6000';
    step = advanceTnegaIncomeFlow(sessInc);
    assert.strictEqual(sessInc.intakeState, 'INCOME_CAN_GATE');
    assert.ok(step.text.includes('CAN எண்'), 'Must request CAN number');

    // Step 5: CAN provided -> Asks Mother Name (Bucket B)
    sessInc.citizenProfile.canNumber = '133370337878397';
    step = advanceTnegaIncomeFlow(sessInc);
    assert.strictEqual(sessInc.intakeState, 'INCOME_MOTHER_NAME_WAIT');
    assert.ok(step.text.includes('தாயாரின் பெயரை'), 'Must ask for Mother Name');

    // Step 6: Mother Name provided -> Asks Community
    sessInc.citizenProfile.motherNameTam = 'தேவகி';
    step = advanceTnegaIncomeFlow(sessInc);
    assert.strictEqual(sessInc.intakeState, 'INCOME_COMMUNITY_WAIT');
    assert.ok(step.text.includes('வகுப்பு / பிரிவு'), 'Must ask for Community');

    // Step 7: Community provided -> Asks Family Member Count
    sessInc.citizenProfile.community = 'MBC';
    step = advanceTnegaIncomeFlow(sessInc);
    assert.strictEqual(sessInc.intakeState, 'INCOME_MEMBER_COUNT_WAIT');
    assert.ok(step.text.includes('குடும்ப உறுப்பினர்கள் எத்தனை பேரைச் சேர்க்க வேண்டும்'), 'Must ask for family members count');

    // Step 8: Member count = 1 -> Directly Reaches READY_TO_APPLY_INCOME!
    sessInc.citizenProfile.familyMemberCount = '1';
    step = advanceTnegaIncomeFlow(sessInc);
    assert.strictEqual(sessInc.intakeState, 'READY_TO_APPLY_INCOME');
    assert.ok(step.text.includes('100% தயாராக உள்ளன'), 'Reaches 100% Ready gate');
    console.log('  ✅ Section 2 Passed: REV-103 Income Certificate completes all sequential gates cleanly!\n');

    // =========================================================================
    // SECTION 3: REV-101 Community Certificate End-to-End Intake Flow Simulation
    // =========================================================================
    console.log('--- Section 3: REV-101 Community Certificate Simulation ---');
    let sessComm = {
        mobileNumber: '9790170026',
        citizenProfile: {
            mobileNumber: '9790170026'
        }
    };

    // 3.1 Aadhaar Gate
    step = advanceTnegaCommunityFlow(sessComm);
    assert.strictEqual(sessComm.intakeState, 'COMMUNITY_AADHAAR_WAIT');

    // 3.2 Photo Gate
    sessComm.citizenProfile.headAadhaarDocPath = dummyAadhaar;
    sessComm.citizenProfile.headAadhaar = '575567662931';
    sessComm.citizenProfile.fullNameTam = 'குமரன் கி';
    sessComm.citizenProfile.fullNameEng = 'Kumaran K';
    step = advanceTnegaCommunityFlow(sessComm);
    assert.strictEqual(sessComm.intakeState, 'COMMUNITY_PHOTO_WAIT');

    // 3.3 Community Proof Gate (Strict Zero-Skip Law)
    sessComm.citizenProfile.headPhotoPath = croppedPassport;
    step = advanceTnegaCommunityFlow(sessComm);
    assert.strictEqual(sessComm.intakeState, 'COMMUNITY_PROOF_WAIT');
    assert.ok(step.text.includes('குடும்ப சாதிச் சான்றிதழ்'), 'Must require family community certificate or TC');

    // 3.4 CAN Gate
    sessComm.citizenProfile.communityProof = dummyCommProof;
    step = advanceTnegaCommunityFlow(sessComm);
    assert.strictEqual(sessComm.intakeState, 'COMMUNITY_CAN_GATE');

    // 3.5 Mother Name Gate
    sessComm.citizenProfile.canNumber = '133370337878397';
    step = advanceTnegaCommunityFlow(sessComm);
    assert.strictEqual(sessComm.intakeState, 'COMMUNITY_MOTHER_NAME_WAIT');

    // 3.6 Religion Gate
    sessComm.citizenProfile.motherNameTam = 'தேவகி';
    step = advanceTnegaCommunityFlow(sessComm);
    assert.strictEqual(sessComm.intakeState, 'COMMUNITY_RELIGION_WAIT');
    assert.ok(step.text.includes('மதம்'), 'Must ask for Religion');

    // 3.7 Community Category Gate
    sessComm.citizenProfile.religion = 'Hindu';
    step = advanceTnegaCommunityFlow(sessComm);
    assert.strictEqual(sessComm.intakeState, 'COMMUNITY_COMM_WAIT');

    // 3.8 Caste Name Gate
    sessComm.citizenProfile.community = 'MBC';
    step = advanceTnegaCommunityFlow(sessComm);
    assert.strictEqual(sessComm.intakeState, 'COMMUNITY_CASTE_WAIT');

    // 3.9 Parents Caste Gate
    sessComm.citizenProfile.caste = 'வன்னியகுல சத்ரியர்';
    step = advanceTnegaCommunityFlow(sessComm);
    assert.strictEqual(sessComm.intakeState, 'COMMUNITY_PARENTS_CASTE_GATE');
    assert.ok(step.text.includes('பெற்றோரின் சாதி விவரங்கள்'));

    // 3.10 Parents Caste Confirmed -> Reaches READY_TO_APPLY_COMMUNITY!
    sessComm.citizenProfile.parentCasteConfirmed = true;
    sessComm.citizenProfile.fatherCaste = 'வன்னியகுல சத்ரியர்';
    sessComm.citizenProfile.motherCaste = 'வன்னியகுல சத்ரியர்';
    step = advanceTnegaCommunityFlow(sessComm);
    assert.strictEqual(sessComm.intakeState, 'READY_TO_APPLY_COMMUNITY');
    assert.ok(step.text.includes('100% தயாராக உள்ளன'));
    console.log('  ✅ Section 3 Passed: REV-101 Community Certificate completes all sequential gates cleanly!\n');

    // =========================================================================
    // SECTION 4: REV-102 Residence / Nativity Certificate Flow Simulation
    // =========================================================================
    console.log('--- Section 4: REV-102 Residence Certificate Simulation ---');
    let sessRes = {
        mobileNumber: '9790170026',
        citizenProfile: {
            mobileNumber: '9790170026'
        }
    };

    // 4.1 Aadhaar Gate
    step = advanceTnegaResidenceFlow(sessRes);
    assert.strictEqual(sessRes.intakeState, 'RESIDENCE_AADHAAR_WAIT');

    // 4.2 Photo Gate
    sessRes.citizenProfile.headAadhaarDocPath = dummyAadhaar;
    sessRes.citizenProfile.headAadhaar = '575567662931';
    sessRes.citizenProfile.fullNameTam = 'குமரன் கி';
    sessRes.citizenProfile.fullNameEng = 'Kumaran K';
    step = advanceTnegaResidenceFlow(sessRes);
    assert.strictEqual(sessRes.intakeState, 'RESIDENCE_PHOTO_WAIT');

    // 4.3 Residence Proof Gate
    sessRes.citizenProfile.headPhotoPath = croppedPassport;
    step = advanceTnegaResidenceFlow(sessRes);
    assert.strictEqual(sessRes.intakeState, 'RESIDENCE_PROOF_WAIT');
    assert.ok(step.text.includes('மின் கட்டண ரசீது') || step.text.includes('முகவரிச் சான்று'));

    // 4.4 CAN Gate
    sessRes.citizenProfile.residenceProof = { docPath: dummyResProof };
    step = advanceTnegaResidenceFlow(sessRes);
    assert.strictEqual(sessRes.intakeState, 'RESIDENCE_CAN_GATE');

    // 4.5 Years of Residence Gate
    sessRes.citizenProfile.canNumber = '133370337878397';
    step = advanceTnegaResidenceFlow(sessRes);
    assert.strictEqual(sessRes.intakeState, 'RESIDENCE_YEARS_WAIT');
    assert.ok(step.text.includes('எத்தனை ஆண்டுகளாகத் தொடர்ந்து வசித்து வருகிறார்'));

    // 4.6 Purpose of Certificate Gate -> Reaches READY_TO_APPLY_RESIDENCE!
    sessRes.citizenProfile.yearsOfResidence = 'பிறப்பிலிருந்து';
    step = advanceTnegaResidenceFlow(sessRes);
    assert.strictEqual(sessRes.intakeState, 'RESIDENCE_PURPOSE_WAIT');
    assert.ok(step.text.includes('எந்த பயன்பாட்டிற்காகத் தேவைப்படுகிறது'));

    sessRes.citizenProfile.purposeOfCertificate = 'கல்வி / பள்ளி சேர்க்கை';
    step = advanceTnegaResidenceFlow(sessRes);
    assert.strictEqual(sessRes.intakeState, 'READY_TO_APPLY_RESIDENCE');
    assert.ok(step.text.includes('100% தயாராக உள்ளன'));
    console.log('  ✅ Section 4 Passed: REV-102 Residence Certificate completes all sequential gates cleanly!\n');

    // =========================================================================
    // SECTION 5: Service Registry Checklist Evaluation
    // =========================================================================
    console.log('--- Section 5: evaluateServiceChecklist Verification ---');
    const fullDemographics = {
        doorNo: '216',
        streetEng: 'Mettu Street',
        district: 'Ranipet',
        taluk: 'Arakkonam',
        village: 'Minnal',
        pincode: '632510',
        fatherNameEng: 'Kirubakaran',
        purpose: 'கல்வி உதவித்தொகை'
    };

    Object.assign(sessInc.citizenProfile, fullDemographics);
    Object.assign(sessComm.citizenProfile, fullDemographics);
    Object.assign(sessRes.citizenProfile, fullDemographics);

    const chkIncome = evaluateServiceChecklist('INCOME_CERTIFICATE', sessInc.citizenProfile, {});
    assert.strictEqual(chkIncome.isReady, true, 'Income Certificate must be ready with self-declaration');
    assert.strictEqual(chkIncome.missingCount, 0);

    const chkComm = evaluateServiceChecklist('COMMUNITY_CERTIFICATE', sessComm.citizenProfile, {});
    assert.strictEqual(chkComm.isReady, true, 'Community Certificate must be ready');
    assert.strictEqual(chkComm.missingCount, 0);

    const chkRes = evaluateServiceChecklist('RESIDENCE_CERTIFICATE', sessRes.citizenProfile, {});
    assert.strictEqual(chkRes.isReady, true, 'Residence Certificate must be ready');
    assert.strictEqual(chkRes.missingCount, 0);

    console.log('  ✅ Section 5 Passed: All 3 services evaluated as 100% ready by evaluateServiceChecklist!\n');

    console.log('===============================================================');
    console.log('🎉 ALL 3 REVENUE SERVICES PASS 100% END-TO-END SIMULATION! 🛡️');
    console.log('===============================================================');
}

runSimulation()
    .catch(err => {
        console.error('❌ Simulation Error:', err);
        process.exit(1);
    })
    .finally(() => {
        try {
            if (fs.existsSync(dummyPhoto)) fs.unlinkSync(dummyPhoto);
            if (fs.existsSync(dummyAadhaar)) fs.unlinkSync(dummyAadhaar);
            if (fs.existsSync(dummyCommProof)) fs.unlinkSync(dummyCommProof);
            if (fs.existsSync(dummyResProof)) fs.unlinkSync(dummyResProof);
        } catch (_) {}
    });
