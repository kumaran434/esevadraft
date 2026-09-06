/**
 * eSevaDraft Automated Regression Test Suite (Automated Quality Gate)
 * 
 * Tests the locked behaviors defined in FEATURE_LOCK.md:
 * 1. Service Selection first question on Generic Intake
 * 2. Service Transitions (Ration Card, Income Certificate, Residence Certificate)
 * 3. 1-Click Operator Desk Shortcuts (Bypass directly into specific service)
 * 4. Walk-in gating (no empty draft pollution)
 * 5. Phone number re-keying from walk-in to 10-digit mobile
 * 6. Clean draft deletion
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://127.0.0.1:${PORT}`;

let serverProcess = null;

function request(method, pathUrl, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(pathUrl, BASE_URL);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ status: res.statusCode, body: parsed, raw: data });
                } catch (e) {
                    resolve({ status: res.statusCode, body: null, raw: data });
                }
            });
        });

        req.on('error', (err) => reject(err));
        if (body) {
            req.write(typeof body === 'string' ? body : JSON.stringify(body));
        }
        req.end();
    });
}

async function isServerRunning() {
    try {
        const res = await request('GET', '/api/chat/history');
        return res.status === 200;
    } catch (e) {
        return false;
    }
}

async function ensureServer() {
    if (await isServerRunning()) {
        console.log('⚡ Connected to running eSevaDraft server on port ' + PORT);
        return;
    }

    console.log('🚀 Spawning temporary server for regression test suite...');
    serverProcess = spawn('node', ['server.js'], {
        cwd: path.resolve(__dirname, '..'),
        stdio: 'pipe'
    });

    let started = false;
    for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 500));
        if (await isServerRunning()) {
            started = true;
            break;
        }
    }

    if (!started) {
        if (serverProcess) serverProcess.kill();
        throw new Error('Could not start server for regression tests');
    }
    console.log('✅ Temporary server is ready.');
}

async function cleanup() {
    if (serverProcess) {
        console.log('🛑 Shutting down temporary server...');
        serverProcess.kill();
    }
}

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
    if (!condition) {
        failedCount++;
        console.error(`❌ FAIL: ${message}`);
        throw new Error(`Assertion failed: ${message}`);
    } else {
        passedCount++;
        console.log(`  ✅ PASS: ${message}`);
    }
}

async function runTests() {
    console.log('\n======================================================');
    console.log('🔒 eSevaDraft AUTOMATED REGRESSION SUITE (FEATURE LOCK)');
    console.log('======================================================\n');

    try {
        await ensureServer();

        // ----------------------------------------------------------------
        // TEST 1: Generic Walk-in MUST start at SERVICE_SELECTION
        // ----------------------------------------------------------------
        console.log('\n[TEST 1] Generic Walk-in Intake Prompt Gating');
        const res1 = await request('POST', '/api/operator/new-customer', {
            isWalkin: true
        });
        assert(res1.status === 200, 'Endpoint returned 200 OK');
        assert(res1.body.success === true, 'Response marked success');
        const sessionKey1 = res1.body.customerMobile;
        assert(typeof sessionKey1 === 'string' && sessionKey1.startsWith('walkin_'), 'Generated valid walkin_ session ID');
        assert(res1.body.intakeState === 'SERVICE_SELECTION', 'Direct response intakeState is SERVICE_SELECTION');

        // Check chat history for SERVICE_SELECTION message
        const chatRes1 = await request('GET', `/api/chat/history?mobile=${sessionKey1}`);
        assert(chatRes1.status === 200, 'Chat history endpoint returned 200');
        const firstMsg = chatRes1.body.chatHistory && chatRes1.body.chatHistory[0];
        assert(firstMsg && firstMsg.text.includes('எந்த அரசு சேவைக்கு விண்ணப்பிக்க விரும்புகிறார்'), 'First message asks what service customer wants');
        assert(firstMsg.options && firstMsg.options.length >= 4, 'Provides 4 service options (Ration, Income, Residence, Voter)');

        // ----------------------------------------------------------------
        // TEST 2: Service Transition -> Ration Card (Member Count)
        // ----------------------------------------------------------------
        console.log('\n[TEST 2] Service Transition: Selecting "புதிய ரேஷன் கார்டு"');
        const res2 = await request('POST', '/api/chat', {
            message: 'புதிய ரேஷன் கார்டு',
            mobile: sessionKey1
        });
        assert(res2.status === 200, 'Chat endpoint returned 200 OK');
        assert(res2.body.intakeState === 'MEMBER_COUNT', 'State transitioned cleanly to MEMBER_COUNT');
        assert(res2.body.botResponse && res2.body.botResponse.includes('குடும்பத்தில் மொத்தம் எத்தனை நபர்களை'), 'Chat response asks for Member Count');

        // ----------------------------------------------------------------
        // TEST 3: Service Transition -> Income Certificate
        // ----------------------------------------------------------------
        console.log('\n[TEST 3] Service Transition: Selecting "வருமானச் சான்றிதழ்"');
        const res3_init = await request('POST', '/api/operator/new-customer', { isWalkin: true });
        const sessionKey3 = res3_init.body.customerMobile;
        const res3_chat = await request('POST', '/api/chat', {
            message: 'வருமானச் சான்றிதழ்',
            mobile: sessionKey3
        });
        assert(res3_chat.status === 200, 'Chat returned 200 OK for Income Cert');
        assert(res3_chat.body.intakeState === 'INCOME_INTAKE', 'State transitioned cleanly to INCOME_INTAKE');
        assert(res3_chat.body.botResponse && (res3_chat.body.botResponse.includes('ஆண்டு வருமானத்தை') || res3_chat.body.botResponse.includes('வருமானச் சான்றிதழ்')), 'Chat response asks for annual income');

        // ----------------------------------------------------------------
        // TEST 4: Service Transition -> Residence Certificate
        // ----------------------------------------------------------------
        console.log('\n[TEST 4] Service Transition: Selecting "இருப்பிடச் சான்றிதழ்"');
        const res4_init = await request('POST', '/api/operator/new-customer', { isWalkin: true });
        const sessionKey4 = res4_init.body.customerMobile;
        const res4_chat = await request('POST', '/api/chat', {
            message: 'இருப்பிடச் சான்றிதழ்',
            mobile: sessionKey4
        });
        assert(res4_chat.status === 200, 'Chat returned 200 OK for Residence Cert');
        assert(res4_chat.body.intakeState === 'RESIDENCE_INTAKE', 'State transitioned cleanly to RESIDENCE_INTAKE');

        // ----------------------------------------------------------------
        // TEST 5: Operator Desk 1-Click Shortcut: Ration Card
        // ----------------------------------------------------------------
        console.log('\n[TEST 5] Operator 1-Click Desk Shortcut: Ration Card direct launch');
        const res5 = await request('POST', '/api/operator/new-customer', {
            isWalkin: true,
            serviceName: 'புதிய ரேஷன் கார்டு'
        });
        assert(res5.status === 200, 'Returned 200 OK');
        const chatRes5 = await request('GET', `/api/chat/history?mobile=${res5.body.customerMobile}`);
        const firstMsg5 = chatRes5.body.chatHistory && chatRes5.body.chatHistory[0];
        assert(firstMsg5 && firstMsg5.text.includes('உறுப்பினர்களாகச் சேர்க்க வேண்டும்'), 'Bypasses service selection and displays Member Count prompt directly');

        // ----------------------------------------------------------------
        // TEST 6: Operator Desk 1-Click Shortcut: Income Certificate
        // ----------------------------------------------------------------
        console.log('\n[TEST 6] Operator 1-Click Desk Shortcut: Income Certificate direct launch');
        const res6 = await request('POST', '/api/operator/new-customer', {
            isWalkin: true,
            serviceName: 'வருமானச் சான்றிதழ்'
        });
        assert(res6.status === 200, 'Returned 200 OK');
        const chatRes6 = await request('GET', `/api/chat/history?mobile=${res6.body.customerMobile}`);
        const firstMsg6 = chatRes6.body.chatHistory && chatRes6.body.chatHistory[0];
        assert(firstMsg6 && firstMsg6.text.includes('வருமானச் சான்றிதழ்'), 'Bypasses service selection and displays Income Certificate prompt directly');

        // ----------------------------------------------------------------
        // TEST 7: Walk-in Gating (No Empty Draft Pollution)
        // ----------------------------------------------------------------
        console.log('\n[TEST 7] Walk-in Gating: Empty walk-in sessions must NOT write permanent drafts to disk');
        const draftsDir = path.resolve(__dirname, '..', 'data', 'drafts');
        const emptyWalkinKey = res5.body.customerMobile;
        const emptyDraftFile = path.join(draftsDir, `${emptyWalkinKey}.json`);
        assert(!fs.existsSync(emptyDraftFile), 'Empty walk-in session has not written a file to disk');

        // ----------------------------------------------------------------
        // TEST 8: Phone Number Re-keying
        // ----------------------------------------------------------------
        console.log('\n[TEST 8] Phone Re-keying: Updating mobile number renames session and draft');
        const testMobile = '9991112233';
        const testDraftFile = path.join(draftsDir, `${testMobile}.json`);
        if (fs.existsSync(testDraftFile)) fs.unlinkSync(testDraftFile);

        const res8_profile = await request('POST', '/api/profile/update', {
            mobileNumber: testMobile,
            fullNameTam: 'கார்த்திக்',
            fullNameEng: 'Karthik'
        }, {
            'x-session-mobile': emptyWalkinKey
        });
        assert(res8_profile.status === 200, 'Profile update returned 200 OK');
        assert(fs.existsSync(testDraftFile), 'New draft file 9991112233.json created on disk');
        assert(!fs.existsSync(emptyDraftFile), 'Old temporary walkin file does not linger on disk');

        // ----------------------------------------------------------------
        // TEST 9: Draft Deletion
        // ----------------------------------------------------------------
        console.log('\n[TEST 9] Draft Deletion: Deleting draft removes it from disk and session list');
        const res9_del = await request('POST', '/api/drafts/delete', {
            mobileNumber: testMobile
        });
        assert(res9_del.status === 200, 'Draft delete returned 200 OK');
        assert(!fs.existsSync(testDraftFile), 'Draft file 9991112233.json deleted from disk');

        console.log('\n======================================================');
        console.log(`🎉 ALL ${passedCount} REGRESSION CHECKS PASSED WITH 100% SUCCESS!`);
        console.log('======================================================\n');
        process.exitCode = 0;
    } catch (err) {
        console.error('\n🚨 REGRESSION TEST FAILED!');
        console.error(err.message);
        process.exitCode = 1;
    } finally {
        await cleanup();
    }
}

runTests();
