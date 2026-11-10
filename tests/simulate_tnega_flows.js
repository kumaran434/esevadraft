/**
 * Automated Live Simulation: TNeGA Income Certificate & CAN Intake Flow
 * Verifies clean, step-by-step sequential gating with ZERO option-dumping.
 * Simulates both Existing Customer (with data) and Fresh Customer flows.
 */

const assert = require('assert');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 3012;
const baseUrl = `http://127.0.0.1:${PORT}`;
let serverProcess = null;

function request(method, pathUrl, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(pathUrl, baseUrl);
        const payload = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Connection': 'close',
                ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
                ...headers
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let parsed = data;
                try { parsed = JSON.parse(data); } catch (_) {}
                resolve({ status: res.statusCode, body: parsed });
            });
        });

        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
    });
}

async function isServerRunning() {
    try {
        const res = await request('GET', '/api/chat/history');
        return res.status === 200;
    } catch (_) {
        return false;
    }
}

async function startTestServer() {
    const fs = require('fs');
    const draftsDir = path.join(__dirname, '..', 'data', 'drafts');
    const sessionsFile = path.join(__dirname, '..', 'data', 'sessions.json');
    ['9790170099.json', '9840011223.json'].forEach(f => {
        const p = path.join(draftsDir, f);
        if (fs.existsSync(p)) fs.unlinkSync(p);
    });
    if (fs.existsSync(sessionsFile)) {
        try {
            const sessData = JSON.parse(fs.readFileSync(sessionsFile, 'utf8'));
            delete sessData['9790170099'];
            delete sessData['9840011223'];
            fs.writeFileSync(sessionsFile, JSON.stringify(sessData, null, 2), 'utf8');
        } catch (_) {}
    }

    console.log(`🚀 Spawning temporary server for simulation on port ${PORT}...`);
    serverProcess = spawn(process.execPath, [path.resolve(__dirname, '..', 'server.js')], {
        cwd: path.resolve(__dirname, '..'),
        env: { ...process.env, PORT: String(PORT), REGRESSION_TEST: 'true', NODE_ENV: 'test' },
        stdio: 'ignore'
    });

    for (let i = 0; i < 40; i++) {
        await new Promise(r => setTimeout(r, 300));
        if (await isServerRunning()) {
            console.log(`\n🚀 [TNeGA Simulation Runner] Server active on ${baseUrl}\n`);
            return;
        }
    }
    throw new Error('Could not start server on port ' + PORT);
}

function stopTestServer() {
    if (serverProcess) {
        console.log(`🛑 [TNeGA Simulation Runner] Stopping server on port ${PORT}...`);
        try { serverProcess.kill(); } catch (_) {}
    }
}

async function runSimulation() {
    await startTestServer();

    try {
        console.log('======================================================================');
        console.log('🎭 TNeGA LIVE CONVERSATIONAL SIMULATION (INCOME CERT & CAN)');
        console.log('======================================================================\n');

        const fs = require('fs');
        const draftsDir = path.join(__dirname, '..', 'data', 'drafts');
        ['9790170099.json', '9840011223.json'].forEach(f => {
            const p = path.join(draftsDir, f);
            if (fs.existsSync(p)) fs.unlinkSync(p);
        });

        // =====================================================================
        // JOURNEY 1: EXISTING CUSTOMER (Kumaran K - with partial data, missing CAN/Mother/Caste)
        // =====================================================================
        console.log('▶️ [SIMULATION 1] Existing Customer: Kumaran K (+91 9790170026)');
        console.log('   Known: Name, Father, Aadhaar, Address | Missing: CAN, Mother Name, Caste\n');

        const simMob1 = '9790170099';
        // Initialize customer profile with known demographics (top-level fields)
        await request('POST', '/api/profile/update', {
            mobileNumber: simMob1,
            fullNameTam: 'குமரன் கி',
            fullNameEng: 'Kumaran K',
            fatherNameTam: 'கிருபாகரன்',
            fatherNameEng: 'Kirubakaran',
            headAadhaar: '123456789012',
            headDob: '1993-06-10',
            headGenderTam: 'ஆண்',
            doorNo: '12/4',
            streetTam: 'மேட்டு தெரு, நரசிங்கபுரம்',
            streetEng: 'Mettu Street, Narasingapuram',
            village: 'Minnal',
            taluk: 'Arakkonam',
            district: 'Ranipet',
            pincode: '632510'
        }, { 'x-session-mobile': simMob1 });

        // STEP 1: Select "வருமானச் சான்றிதழ்"
        console.log('Step 1: Selecting "வருமானச் சான்றிதழ்"...');
        const res1 = await request('POST', '/api/chat', { text: 'வருமானச் சான்றிதழ்' }, { 'x-session-mobile': simMob1 });
        assert.strictEqual(res1.status, 200, 'Step 1 returns 200');
        const lastMsg1 = res1.body.chatHistory[res1.body.chatHistory.length - 1];
        console.log(`🤖 Bot Output: "${lastMsg1.text.substring(0, 100)}..."`);
        console.log(`   Options Presented:`, (lastMsg1.options || []).map(o => o.label));

        assert.strictEqual(res1.body.intakeState, 'INCOME_CAN_GATE', 'State must be INCOME_CAN_GATE');
        assert.strictEqual(lastMsg1.options.length, 3, 'Must present EXACTLY 3 CAN options (Zero option dumping)');
        assert(lastMsg1.options.some(o => o.value === 'CAN_SEARCH_PROMPT'), 'Has CAN Search option');
        assert(lastMsg1.options.some(o => o.value === 'CAN_REGISTER_PROMPT'), 'Has CAN Register option');
        assert(lastMsg1.options.some(o => o.value === 'CAN_DIRECT_INPUT'), 'Has Direct CAN Input option');
        // Critical: Verify NO income chips (₹60,000) are dumped at this stage!
        assert(!lastMsg1.options.some(o => o.value.includes('₹')), 'Strictly ZERO income chips during CAN gate');
        console.log('   ✅ STEP 1 PASSED: Strict CAN verification gate enforced with 0 income chips.\n');

        // STEP 2: Operator clicks "என்னிடம் CAN எண் உள்ளது (Direct Input)"
        console.log('Step 2: Clicking "CAN_DIRECT_INPUT"...');
        const res2 = await request('POST', '/api/chat', { text: 'CAN_DIRECT_INPUT' }, { 'x-session-mobile': simMob1 });
        assert.strictEqual(res2.status, 200);
        assert.strictEqual(res2.body.step, 'CAN_DIRECT_INPUT_WAIT');
        console.log('   ✅ STEP 2 PASSED: Transitions to CAN_DIRECT_INPUT_WAIT.\n');

        // STEP 3: Operator submits the official 15-digit CAN "133370337878397"
        console.log('Step 3: Submitting 15-digit CAN "133370337878397"...');
        const res3 = await request('POST', '/api/chat', { text: '133370337878397' }, { 'x-session-mobile': simMob1 });
        assert.strictEqual(res3.status, 200);
        const lastMsg3 = res3.body.chatHistory[res3.body.chatHistory.length - 1];
        console.log(`🤖 Bot Output: "${lastMsg3.text.substring(0, 120)}..."`);
        assert.strictEqual(res3.body.citizenProfile.canNumber, '133370337878397', 'CAN number saved to profile');
        assert.strictEqual(res3.body.intakeState, 'INCOME_MOTHER_NAME_WAIT', 'Must transition to INCOME_MOTHER_NAME_WAIT');
        assert(lastMsg3.text.includes('தாயாரின் பெயரை'), 'Prompt must strictly request Mother Name');
        console.log('   ✅ STEP 3 PASSED: CAN verified; dynamically transitions to Mother Name Gate.\n');

        // STEP 4: Operator enters Mother's Name "தேவகி கி"
        console.log('Step 4: Submitting Mother\'s Name "தேவகி கி"...');
        const res4 = await request('POST', '/api/chat', { text: 'தேவகி கி' }, { 'x-session-mobile': simMob1 });
        assert.strictEqual(res4.status, 200);
        const lastMsg4 = res4.body.chatHistory[res4.body.chatHistory.length - 1];
        console.log(`🤖 Bot Output: "${lastMsg4.text.substring(0, 100)}..."`);
        console.log(`   Options Presented:`, (lastMsg4.options || []).map(o => o.label));
        assert.strictEqual(res4.body.citizenProfile.motherNameTam, 'தேவகி கி', 'Mother name saved in Tamil');
        assert.strictEqual(res4.body.intakeState, 'INCOME_COMMUNITY_WAIT', 'Must transition to INCOME_COMMUNITY_WAIT');
        assert.strictEqual(lastMsg4.options.length, 6, 'Must present EXACTLY 6 community chips');
        assert(lastMsg4.options.some(o => o.value === 'COMMUNITY_MBC'), 'Has MBC chip');
        console.log('   ✅ STEP 4 PASSED: Mother Name saved; dynamically transitions to Community Gate.\n');

        // STEP 5: Operator clicks "COMMUNITY_MBC"
        console.log('Step 5: Clicking "COMMUNITY_MBC"...');
        const res5 = await request('POST', '/api/chat', { text: 'COMMUNITY_MBC' }, { 'x-session-mobile': simMob1 });
        assert.strictEqual(res5.status, 200);
        const lastMsg5 = res5.body.chatHistory[res5.body.chatHistory.length - 1];
        console.log(`🤖 Bot Output: "${lastMsg5.text.substring(0, 120)}..."`);
        console.log(`   Options Presented:`, (lastMsg5.options || []).map(o => o.label));
        assert.strictEqual(res5.body.citizenProfile.community, 'MBC', 'Community saved as MBC');
        assert.strictEqual(res5.body.intakeState, 'INCOME_MEMBER_COUNT_WAIT', 'Transitions to Family Member Count intake');
        assert.strictEqual(lastMsg5.options.length, 4, 'Must present EXACTLY 4 member count chips');
        assert(lastMsg5.options.some(o => o.value === '1 நபர்'), 'Has 1 நபர் chip');
        console.log('   ✅ STEP 5 PASSED: Community saved; dynamically transitions to Member Count Gate.\n');

        // STEP 5B: Operator selects member count "1 நபர்"
        console.log('Step 5B: Selecting "1 நபர்"...');
        const res5b = await request('POST', '/api/chat', { text: '1 நபர்' }, { 'x-session-mobile': simMob1 });
        assert.strictEqual(res5b.status, 200);
        const lastMsg5b = res5b.body.chatHistory[res5b.body.chatHistory.length - 1];
        console.log(`🤖 Bot Output: "${lastMsg5b.text.substring(0, 120)}..."`);
        console.log(`   Options Presented:`, (lastMsg5b.options || []).map(o => o.label));
        assert.strictEqual(res5b.body.citizenProfile.familyMemberCount, 1, 'Member count saved as 1');
        assert.strictEqual(res5b.body.intakeState, 'INCOME_INTAKE', 'Transitions to Annual Income intake');
        assert.strictEqual(lastMsg5b.options.length, 4, 'Must present EXACTLY 4 income chips');
        assert(lastMsg5b.options.some(o => o.value === '₹60,000'), 'Has ₹60,000 chip');
        console.log('   ✅ STEP 5B PASSED: Member count saved; dynamically transitions to Income Amount.\n');

        // STEP 6: Operator selects income "₹60,000"
        console.log('Step 6: Selecting "₹60,000"...');
        const res6 = await request('POST', '/api/chat', { text: '₹60,000' }, { 'x-session-mobile': simMob1 });
        assert.strictEqual(res6.status, 200);
        const lastMsg6 = res6.body.chatHistory[res6.body.chatHistory.length - 1];
        console.log(`🤖 Bot Output: "${lastMsg6.text}"`);
        console.log(`   Options Presented:`, (lastMsg6.options || []).map(o => o.label));
        assert.strictEqual(res6.body.citizenProfile.annualIncome, '60000', 'Annual Income saved');
        assert.strictEqual(lastMsg6.options.length, 4, 'Must present EXACTLY 4 occupation chips');
        assert(lastMsg6.options.some(o => o.value === 'கூலி வேலை'), 'Has Coolie occupation chip');
        console.log('   ✅ STEP 6 PASSED: Income recorded; dynamically transitions to Profession Gate.\n');

        // STEP 7: Operator selects profession "கூலி வேலை"
        console.log('Step 7: Selecting "கூலி வேலை"...');
        const res7 = await request('POST', '/api/chat', { text: 'கூலி வேலை' }, { 'x-session-mobile': simMob1 });
        assert.strictEqual(res7.status, 200);
        const lastMsg7 = res7.body.chatHistory[res7.body.chatHistory.length - 1];
        console.log(`🤖 Bot Output: "${lastMsg7.text.substring(0, 160)}..."`);
        console.log(`   Options Presented:`, (lastMsg7.options || []).map(o => o.label));
        assert.strictEqual(res7.body.intakeState, 'READY_TO_APPLY_INCOME', 'State is READY_TO_APPLY_INCOME');
        assert(lastMsg7.text.includes('133370337878397'), 'Summary contains official CAN number');
        assert(lastMsg7.text.includes('தேவகி கி'), 'Summary contains Mother Name');
        assert(lastMsg7.text.includes('MBC'), 'Summary contains Community');
        assert(lastMsg7.options.some(o => o.value === 'START_INCOME_APPLY'), 'Offers START_INCOME_APPLY button');
        console.log('   ✅ STEP 7 PASSED: 100% Ready Station reached with all verified fields.\n');

        // STEP 8: Operator clicks "START_INCOME_APPLY"
        console.log('Step 8: Clicking "START_INCOME_APPLY"...');
        const res8 = await request('POST', '/api/chat', { text: 'START_INCOME_APPLY' }, { 'x-session-mobile': simMob1 });
        assert.strictEqual(res8.status, 200);
        assert.strictEqual(res8.body.isAutomating, true, 'isAutomating must be true');
        const lastMsg8 = res8.body.chatHistory[res8.body.chatHistory.length - 1];
        console.log(`🤖 Bot Output: "${lastMsg8.text.substring(0, 120)}..."`);
        assert(!lastMsg8.text.includes('புதிய ரேஷன் கார்டு விண்ணப்பத்தைத் தொடங்க'), 'NEVER loop back to welcome screen!');
        assert(lastMsg8.text.includes('வருமானச் சான்றிதழ் (REV-103) விண்ணப்ப ஆட்டோமேஷன் தொடங்கப்படுகிறது'), 'Confirms REV-103 startup');
        console.log('   ✅ STEP 8 PASSED: Launches REV-103 automation directly without welcome loop!\n');

        // =====================================================================
        // JOURNEY 2: CAN REGISTRATION FLOW (Verifies Mother Name & Caste Enforcement)
        // =====================================================================
        console.log('----------------------------------------------------------------------');
        console.log('▶️ [SIMULATION 2] CAN Registration Flow: Enforcing Mother Name & Caste');
        console.log('----------------------------------------------------------------------\n');

        const simMob2 = '9840011223';
        // Fresh customer with partial details (Name, Father, Aadhaar) but no Mother or Caste
        await request('POST', '/api/profile/update', {
            mobileNumber: simMob2,
            fullNameTam: 'கார்த்திக் எஸ்',
            fullNameEng: 'Karthik S',
            fatherNameTam: 'சுரேஷ்',
            fatherNameEng: 'Suresh',
            headAadhaar: '987654321099',
            district: 'Ranipet',
            taluk: 'Arakkonam',
            village: 'Minnal',
            pincode: '632510'
        }, { 'x-session-mobile': simMob2 });

        // Trigger CAN Registration
        console.log('Step 1: Selecting "CAN_REGISTER_PROMPT"...');
        const canRes1 = await request('POST', '/api/chat', { text: 'CAN_REGISTER_PROMPT' }, { 'x-session-mobile': simMob2 });
        assert.strictEqual(canRes1.status, 200);
        const canMsg1 = canRes1.body.chatHistory[canRes1.body.chatHistory.length - 1];
        console.log(`🤖 Bot Output: "${canMsg1.text.substring(0, 120)}..."`);
        // Must prompt for Mother's Name first!
        assert.strictEqual(canRes1.body.intakeState, 'CAN_MOTHER_NAME_WAIT', 'CAN registration blocks until Mother Name is provided');
        assert(canMsg1.text.includes('தாயின் பெயர் கட்டாயமாகும்'), 'Warns that Mother Name is mandatory in portal');
        console.log('   ✅ CAN STEP 1 PASSED: Mother Name mandatory gate enforced.\n');

        // Provide Mother's Name
        console.log('Step 2: Submitting Mother\'s Name "பார்வதி"...');
        const canRes2 = await request('POST', '/api/chat', { text: 'பார்வதி' }, { 'x-session-mobile': simMob2 });
        assert.strictEqual(canRes2.status, 200);
        const canMsg2 = canRes2.body.chatHistory[canRes2.body.chatHistory.length - 1];
        console.log(`🤖 Bot Output: "${canMsg2.text.substring(0, 100)}..."`);
        assert.strictEqual(canRes2.body.intakeState, 'CAN_COMMUNITY_WAIT', 'CAN registration blocks until Community is provided');
        assert.strictEqual(canMsg2.options.length, 6, 'Presents 6 Community chips');
        console.log('   ✅ CAN STEP 2 PASSED: Community mandatory gate enforced.\n');

        // Select Community BC
        console.log('Step 3: Selecting "COMMUNITY_BC"...');
        const canRes3 = await request('POST', '/api/chat', { text: 'COMMUNITY_BC' }, { 'x-session-mobile': simMob2 });
        assert.strictEqual(canRes3.status, 200);
        const canMsg3 = canRes3.body.chatHistory[canRes3.body.chatHistory.length - 1];
        console.log(`🤖 Bot Output: "${canMsg3.text.substring(0, 120)}..."`);
        assert.strictEqual(canRes3.body.intakeState, 'READY_TO_APPLY_CAN', 'Transitions to READY_TO_APPLY_CAN');
        assert(canMsg3.options.some(o => o.value === 'START_CAN_REGISTER'), 'Offers START_CAN_REGISTER');
        console.log('   ✅ CAN STEP 3 PASSED: Ready for CAN verification summary.\n');

        // Step 4: Click START_CAN_REGISTER to open final automation launcher
        console.log('Step 4: Clicking "START_CAN_REGISTER"...');
        const canRes4 = await request('POST', '/api/chat', { text: 'START_CAN_REGISTER' }, { 'x-session-mobile': simMob2 });
        assert.strictEqual(canRes4.status, 200);
        const canMsg4 = canRes4.body.chatHistory[canRes4.body.chatHistory.length - 1];
        assert.strictEqual(canRes4.body.step, 'READY_TO_APPLY_CAN', 'State remains READY_TO_APPLY_CAN');
        assert(canMsg4.options.some(o => o.value === 'LAUNCH_CAN_AUTOMATION'), 'Offers LAUNCH_CAN_AUTOMATION');
        console.log('   ✅ CAN STEP 4 PASSED: Ready for CAN physical automation launch.\n');

        // =====================================================================
        // JOURNEY 3: FRESH WALK-IN CUSTOMER (Zero Details in System)
        // =====================================================================
        console.log('----------------------------------------------------------------------');
        console.log('▶️ [SIMULATION 3] Fresh Customer: Walk-in with Zero Existing Data');
        console.log('----------------------------------------------------------------------\n');

        const simMob3 = '912' + Math.floor(1000000 + Math.random() * 9000000);
        // Step 1: Selecting "வருமானச் சான்றிதழ்" with zero data
        console.log('Step 1: Selecting "வருமானச் சான்றிதழ்" as fresh customer...');
        const freshRes1 = await request('POST', '/api/chat', { text: 'வருமானச் சான்றிதழ்' }, { 'x-session-mobile': simMob3 });
        assert.strictEqual(freshRes1.status, 200);
        const freshMsg1 = freshRes1.body.chatHistory[freshRes1.body.chatHistory.length - 1];
        console.log(`🤖 Bot Output: "${freshMsg1.text.substring(0, 120)}..."`);
        console.log(`   Options Presented:`, (freshMsg1.options || []).map(o => o.label));
        assert.strictEqual(freshRes1.body.intakeState, 'INCOME_CAN_GATE', 'Fresh customer without data enters INCOME_CAN_GATE');
        assert.strictEqual(freshMsg1.options.length, 3, 'Presents 3 CAN options');
        console.log('   ✅ FRESH STEP 1 PASSED: Fresh customer greeted with CAN verification gate.\n');

        // Step 2: Fresh customer clicks CAN_REGISTER_PROMPT -> Must ask for Aadhaar Upload (Bucket A)
        console.log('Step 2: Fresh customer clicks "CAN_REGISTER_PROMPT" (0 details on file)...');
        const freshRes2 = await request('POST', '/api/chat', { text: 'CAN_REGISTER_PROMPT' }, { 'x-session-mobile': simMob3 });
        assert.strictEqual(freshRes2.status, 200);
        const freshMsg2 = freshRes2.body.chatHistory[freshRes2.body.chatHistory.length - 1];
        console.log(`🤖 Bot Output: "${freshMsg2.text.substring(0, 120)}..."`);
        assert.strictEqual(freshRes2.body.intakeState, 'CAN_REGISTER_INTAKE', 'Fresh customer with 0 details enters CAN_REGISTER_INTAKE (Bucket A Aadhaar prompt)');
        assert(freshMsg2.options.some(o => o.value === 'TRIGGER_FILE_UPLOAD'), 'Prompts for Aadhaar upload (Bucket A)');
        console.log('   ✅ FRESH STEP 2 PASSED: Fresh customer prompted for Aadhaar upload (Bucket A) before Bucket B questions!\n');

        // =====================================================================
        console.log('----------------------------------------------------------------------');
        console.log('▶️ [SIMULATION 4] Residence Certificate Flow (REV-102) Delta Engine');
        console.log('----------------------------------------------------------------------\n');

        const simMob4 = '9842367866'; // Customer Kumaran K (known CAN 133370337878397)
        // Step 1: Selecting "இருப்பிடச் சான்றிதழ்"
        console.log('Step 1: Selecting "இருப்பிடச் சான்றிதழ்" for Kumaran K...');
        const resRes1 = await request('POST', '/api/chat', { text: 'இருப்பிடச் சான்றிதழ்' }, { 'x-session-mobile': simMob4 });
        assert.strictEqual(resRes1.status, 200);
        const resMsg1 = resRes1.body.chatHistory[resRes1.body.chatHistory.length - 1];
        console.log(`🤖 Bot Output: "${resMsg1.text.substring(0, 120)}..."`);
        console.log(`   Options Presented:`, (resMsg1.options || []).map(o => o.label));
        assert.strictEqual(resRes1.body.intakeState, 'RESIDENCE_YEARS_WAIT', 'Skips CAN and asks Years of Residence');
        console.log('   ✅ RESIDENCE STEP 1 PASSED: Asks Years of Residence with options.\n');

        // Step 2: Selecting "பிறப்பிலிருந்து"
        console.log('Step 2: Selecting "பிறப்பிலிருந்து"...');
        const resRes2 = await request('POST', '/api/chat', { text: 'பிறப்பிலிருந்து' }, { 'x-session-mobile': simMob4 });
        assert.strictEqual(resRes2.status, 200);
        const resMsg2 = resRes2.body.chatHistory[resRes2.body.chatHistory.length - 1];
        console.log(`🤖 Bot Output: "${resMsg2.text.substring(0, 120)}..."`);
        assert.strictEqual(resRes2.body.intakeState, 'RESIDENCE_PURPOSE_WAIT', 'Asks Purpose of Certificate');
        console.log('   ✅ RESIDENCE STEP 2 PASSED: Transitions to Purpose of Certificate.\n');

        // Step 3: Selecting "கல்வி பயன்பாடு"
        console.log('Step 3: Selecting "கல்வி பயன்பாடு"...');
        const resRes3 = await request('POST', '/api/chat', { text: 'கல்வி பயன்பாடு' }, { 'x-session-mobile': simMob4 });
        assert.strictEqual(resRes3.status, 200);
        const resMsg3 = resRes3.body.chatHistory[resRes3.body.chatHistory.length - 1];
        console.log(`🤖 Bot Output: "${resMsg3.text.substring(0, 120)}..."`);
        assert.strictEqual(resRes3.body.intakeState, 'READY_TO_APPLY_RESIDENCE', 'Reaches 100% Ready Station');
        assert(resMsg3.options.some(o => o.value === 'START_RESIDENCE_APPLY'), 'Includes START_RESIDENCE_APPLY button');
        console.log('   ✅ RESIDENCE STEP 3 PASSED: 100% Ready Station reached with START_RESIDENCE_APPLY.\n');

        // Step 4: Clicking "START_RESIDENCE_APPLY" in mock test mode
        console.log('Step 4: Clicking "START_RESIDENCE_APPLY"...');
        const resRes4 = await request('POST', '/api/chat', { text: 'START_RESIDENCE_APPLY' }, { 'x-session-mobile': simMob4 });
        assert.strictEqual(resRes4.status, 200);
        const resMsg4 = resRes4.body.chatHistory[resRes4.body.chatHistory.length - 1];
        console.log(`🤖 Bot Output: "${resMsg4.text.substring(0, 120)}..."`);
        assert(resRes4.body.isAutomating === true, 'Sets isAutomating to true');
        console.log('   ✅ RESIDENCE STEP 4 PASSED: Successfully dispatches startTnegaResidenceFlow automation!\n');

        // Cleanup simulation files
        ['9790170099.json', '9840011223.json', '9123456780.json'].forEach(f => {
            const p = path.join(draftsDir, f);
            if (fs.existsSync(p)) fs.unlinkSync(p);
        });

        console.log('======================================================================');
        console.log('🎉 ALL TNeGA LIVE CONVERSATIONAL SIMULATIONS PASSED 100%!');
        console.log('======================================================================\n');
    } finally {
        await stopTestServer();
    }
}

runSimulation().catch(err => {
    console.error('❌ Simulation Error:', err);
    process.exit(1);
});
