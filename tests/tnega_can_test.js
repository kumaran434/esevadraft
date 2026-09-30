const assert = require('assert');
const {
    loginTnegaOperator,
    searchCitizenCan,
    generateCanOtp,
    provideCanOtp,
    registerNewCan,
    stopTnegaAutomation,
    getLiveTnegaStatus
} = require('../tnega_can_automation');

async function runTnegaCanTests() {
    console.log('\n======================================================');
    console.log('🏛️ TNeGA e-Sevai CAN AUTOMATION MODULE TEST SUITE');
    console.log('======================================================\n');

    const logs = [];
    const onProgress = (msg) => logs.push(msg);

    // TEST 1: Operator Login in Mock Sandbox
    console.log('[TEST 1] TNeGA Operator Login (Safe Mock Sandbox)');
    const loginRes = await loginTnegaOperator({ username: 'TNTACCHN001-01' }, onProgress, { isMockSandbox: true });
    assert(loginRes.success === true, 'Login must succeed');
    assert(loginRes.sessionActive === true, 'Session must be active');
    console.log('  ✅ PASS: Operator Login simulated successfully');

    // TEST 2: Existing Citizen CAN Search (Aadhaar / Mobile)
    console.log('\n[TEST 2] Existing Citizen CAN Search (Kumaran / 9790170026)');
    const searchRes = await searchCitizenCan({ mobile: '9790170026', aadhaar: '987654321012' }, onProgress, { isMockSandbox: true });
    assert(searchRes.success === true, 'Search must succeed');
    assert(searchRes.found === true, 'Citizen must be found');
    assert(searchRes.canNumber === '1330109988771', 'Must match expected CAN number');
    assert(searchRes.citizenName.includes('குமரன்'), 'Must match citizen name');
    console.log('  ✅ PASS: Found existing CAN: 1330109988771 for 9790170026');

    // TEST 3: CAN OTP Generation and Verification
    console.log('\n[TEST 3] CAN OTP Verification Flow');
    const otpPromise = generateCanOtp(searchRes.canNumber, onProgress, { isMockSandbox: true });
    assert(getLiveTnegaStatus().isWaitingForCanOtp === true, 'Must set isWaitingForCanOtp = true');
    
    // Provide OTP
    const provideRes = provideCanOtp('654321');
    assert(provideRes.success === true, 'OTP submission must succeed');
    
    const otpRes = await otpPromise;
    assert(otpRes.success === true && otpRes.otpVerified === true, 'OTP must be verified');
    assert(getLiveTnegaStatus().isWaitingForCanOtp === false, 'Waiting flag must reset');
    console.log('  ✅ PASS: CAN OTP verified successfully');

    // TEST 4: New Citizen CAN Search (Not Found Scenario)
    console.log('\n[TEST 4] New Citizen CAN Search (Unregistered Citizen)');
    const notFoundRes = await searchCitizenCan({ mobile: '9123456780', aadhaar: '223344556677' }, onProgress, { isMockSandbox: true });
    assert(notFoundRes.success === true, 'Search must succeed');
    assert(notFoundRes.found === false, 'Citizen must not be found');
    console.log('  ✅ PASS: Unregistered citizen correctly returns found=false');

    // TEST 5: Automated New CAN Registration
    console.log('\n[TEST 5] Automated New CAN Registration');
    const newCitizenProfile = {
        fullNameTam: 'சுரேஷ் வி',
        fullNameEng: 'Suresh V',
        fatherNameTam: 'வெங்கடேசன்',
        fatherNameEng: 'Venkatesan',
        dob: '20/08/1995',
        gender: 'Male',
        mobile: '9123456780',
        headAadhaar: '223344556677',
        doorNo: '45/B',
        streetEng: 'Anna Street',
        district: 'Ranipet',
        taluk: 'Arakkonam',
        village: 'Minnal',
        pincode: '631001'
    };

    const regRes = await registerNewCan(newCitizenProfile, onProgress, { isMockSandbox: true });
    assert(regRes.success === true, 'Registration must succeed');
    assert(regRes.canNumber && regRes.canNumber.startsWith('133'), 'Must generate valid 13-digit CAN starting with 133');
    assert(regRes.canNumber.length === 13, 'CAN number must be exactly 13 digits');
    console.log(`  ✅ PASS: New CAN generated: ${regRes.canNumber}`);

    // TEST 6: Stop and Cleanup
    console.log('\n[TEST 6] Engine Cleanup');
    await stopTnegaAutomation();
    assert(getLiveTnegaStatus().step === 'IDLE', 'State must reset to IDLE');
    console.log('  ✅ PASS: TNeGA engine cleanly stopped and reset');

    console.log('\n======================================================');
    console.log('🎉 ALL TNeGA CAN AUTOMATION TESTS PASSED (6/6)!');
    console.log('======================================================\n');
}

runTnegaCanTests().catch(err => {
    console.error('❌ TNeGA CAN TEST FAILED:', err);
    process.exit(1);
});
