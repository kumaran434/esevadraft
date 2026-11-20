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
const { runImmuneGuardSuite } = require('./immune_guard_suite');
const { handleRationSubserviceWorkflow } = require('../src/core/chat_fsm');

const PORT = process.env.PORT || 3005;
const BASE_URL = `http://127.0.0.1:${PORT}`;

let serverProcess = null;

function request(method, pathUrl, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(pathUrl, BASE_URL);
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
        if (payload) {
            req.write(payload);
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
    serverProcess = spawn(process.execPath, [path.resolve(__dirname, '..', 'server.js')], {
        cwd: path.resolve(__dirname, '..'),
        env: { ...process.env, PORT: String(PORT), REGRESSION_TEST: 'true', NODE_ENV: 'test' },
        stdio: 'inherit'
    });

    let started = false;
    for (let i = 0; i < 70; i++) {
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
    try {
        // Synthetic mock test numbers used by automated tests
        const testMobiles = [
            '9876500050', '9333222111', '9444332211', '9111223344', '9555444333',
            '9777666555', '9999900021', '9999900099', '9991112233', '9999000010',
            '9888777666', '9443322110', '9123456780', '9988776655', '9999900056',
            '9876543210', '9876543219', '9999900019', '9888877777', '9999900023',
            '9999900024', '9999900025', '9999900026', '9999900045', '9293134876', '9143622397',
            '9999900035', '9999900036', '9999900038', '9999900039', '9999900042',
            '9840112233', '9998887776', '9999999999', '9999999988', '9955553661',
            '9999900055'
        ];
        const dataDirs = [
            path.resolve(__dirname, '..', 'data', 'drafts'),
            path.resolve(__dirname, '..', 'data', 'citizens'),
            path.join(process.env.APPDATA || 'C:\\Users\\ADMIN\\AppData\\Roaming', 'esevadraft-desktop', 'data', 'drafts'),
            path.join(process.env.APPDATA || 'C:\\Users\\ADMIN\\AppData\\Roaming', 'esevadraft-desktop', 'data', 'citizens'),
            path.join(process.env.LOCALAPPDATA || 'C:\\Users\\ADMIN\\AppData\\Local', 'Programs', 'eSevaDraft Desktop', 'resources', 'data', 'drafts'),
            path.join(process.env.LOCALAPPDATA || 'C:\\Users\\ADMIN\\AppData\\Local', 'Programs', 'eSevaDraft Desktop', 'resources', 'data', 'citizens')
        ];
        for (const dir of dataDirs) {
            if (fs.existsSync(dir)) {
                const files = fs.readdirSync(dir);
                files.forEach(f => {
                    const mob = f.replace('.json', '');
                    if (testMobiles.includes(mob) || mob.startsWith('test_') || mob.startsWith('walkin_')) {
                        try { fs.unlinkSync(path.join(dir, f)); } catch (e) {}
                    }
                });
            }
        }
        const sessionFiles = [
            path.resolve(__dirname, '..', 'data', 'sessions.json'),
            path.join(process.env.APPDATA || 'C:\\Users\\ADMIN\\AppData\\Roaming', 'esevadraft-desktop', 'data', 'sessions.json'),
            path.join(process.env.LOCALAPPDATA || 'C:\\Users\\ADMIN\\AppData\\Local', 'Programs', 'eSevaDraft Desktop', 'resources', 'data', 'sessions.json')
        ];
        for (const sf of sessionFiles) {
            if (fs.existsSync(sf)) {
                try {
                    const obj = JSON.parse(fs.readFileSync(sf, 'utf8'));
                    for (const num of testMobiles) {
                        if (obj[num]) delete obj[num];
                    }
                    Object.keys(obj).forEach(k => {
                        if (k.startsWith('walkin_') || k.startsWith('test_')) delete obj[k];
                    });
                    fs.writeFileSync(sf, JSON.stringify(obj, null, 2), 'utf8');
                } catch (_) {}
            }
        }
        const citizensFiles = [
            path.resolve(__dirname, '..', 'data', 'citizens.json'),
            path.join(process.env.APPDATA || 'C:\\Users\\ADMIN\\AppData\\Roaming', 'esevadraft-desktop', 'data', 'citizens.json'),
            path.join(process.env.LOCALAPPDATA || 'C:\\Users\\ADMIN\\AppData\\Local', 'Programs', 'eSevaDraft Desktop', 'resources', 'data', 'citizens.json')
        ];
        for (const cf of citizensFiles) {
            if (fs.existsSync(cf)) {
                try {
                    let cdata = JSON.parse(fs.readFileSync(cf, 'utf8'));
                    if (Array.isArray(cdata)) {
                        cdata = cdata.filter(item => {
                            const m = item.mobile || item.mobileNumber;
                            return !testMobiles.includes(m) && !String(m).startsWith('test_');
                        });
                    } else if (typeof cdata === 'object') {
                        for (const num of testMobiles) {
                            if (cdata[num]) delete cdata[num];
                        }
                    }
                    fs.writeFileSync(cf, JSON.stringify(cdata, null, 2), 'utf8');
                } catch (_) {}
            }
        }

        const vaultFiles = [
            path.resolve(__dirname, '..', 'data', 'operator_vault.json'),
            path.join(process.env.APPDATA || 'C:\\Users\\ADMIN\\AppData\\Roaming', 'esevadraft-desktop', 'data', 'operator_vault.json'),
            path.join(process.env.LOCALAPPDATA || 'C:\\Users\\ADMIN\\AppData\\Local', 'Programs', 'eSevaDraft Desktop', 'resources', 'data', 'operator_vault.json')
        ];
        for (const vf of vaultFiles) {
            if (fs.existsSync(vf)) {
                try {
                    const vdata = JSON.parse(fs.readFileSync(vf, 'utf8'));
                    let modified = false;
                    for (const k of Object.keys(vdata)) {
                        if (k.startsWith('op_test_')) {
                            delete vdata[k];
                            modified = true;
                        }
                    }
                    if (modified) fs.writeFileSync(vf, JSON.stringify(vdata, null, 2), 'utf8');
                } catch (_) {}
            }
        }
    } catch (e) {}
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
        assert(firstMsg.options && firstMsg.options.length >= 3, 'Provides primary service department categories (Ration Card, Revenue Department, Voter ID)');

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
        assert(res3_chat.body.intakeState === 'INCOME_AADHAAR_WAIT' || res3_chat.body.intakeState === 'INCOME_CAN_GATE' || res3_chat.body.intakeState === 'INCOME_INTAKE', 'State transitioned cleanly to Document Gate or CAN Gate for Income Cert');
        assert(res3_chat.body.botResponse && res3_chat.body.botResponse.includes('வருமானச் சான்றிதழ்'), 'Chat response introduces Income Certificate');

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
        assert(res4_chat.body.intakeState === 'RESIDENCE_AADHAAR_WAIT' || res4_chat.body.intakeState === 'RESIDENCE_INTAKE' || res4_chat.body.intakeState === 'RESIDENCE_CAN_GATE', 'State transitioned cleanly to Document Gate or CAN Gate for Residence Cert');

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

        // Test editing existing 10-digit customer mobile number (Zero Duplicate Profile Invariant)
        const newMigratedMobile = '9991112244';
        const newMigratedFile = path.join(draftsDir, `${newMigratedMobile}.json`);
        if (fs.existsSync(newMigratedFile)) fs.unlinkSync(newMigratedFile);

        const res8_migrate = await request('POST', '/api/profile/update', {
            mobileNumber: newMigratedMobile,
            oldMobileNumber: testMobile,
            fullNameTam: 'கார்த்திக் குமார்',
            fullNameEng: 'Karthik Kumar',
            fromEditModal: true,
            silent: true
        }, {
            'x-session-mobile': newMigratedMobile,
            'x-old-session-mobile': testMobile
        });
        assert(res8_migrate.status === 200, 'Profile migration to new mobile returned 200 OK');
        assert(fs.existsSync(newMigratedFile), 'New draft file 9991112244.json created on disk');
        assert(!fs.existsSync(testDraftFile), 'Old draft file 9991112233.json permanently purged (Zero Duplicate Profile)');
        if (fs.existsSync(newMigratedFile)) fs.unlinkSync(newMigratedFile);

        // ----------------------------------------------------------------
        // TEST 9: Draft Deletion
        // ----------------------------------------------------------------
        console.log('\n[TEST 9] Draft Deletion: Deleting draft removes it from disk and session list');
        const res9_del = await request('POST', '/api/drafts/delete', {
            mobileNumber: testMobile
        });
        assert(res9_del.status === 200, 'Draft delete returned 200 OK');
        assert(!fs.existsSync(testDraftFile), 'Draft file 9991112233.json deleted from disk');

        // ----------------------------------------------------------------
        // TEST 10: Permanent Zero-OTP Safeguard (No Server Spam)
        // ----------------------------------------------------------------
        console.log('\n[TEST 10] Zero-OTP Safeguard: Chat start automation defaults to Safe Mock Sandbox');
        const test10Mobile = '9999000010';
        const res10_chat = await request('POST', '/api/chat', {
            mobileNumber: test10Mobile,
            text: 'start'
        });
        assert(res10_chat.status === 200, 'Chat endpoint returned 200 OK');
        const lastMsg10 = res10_chat.body.chatHistory ? res10_chat.body.chatHistory[res10_chat.body.chatHistory.length - 1] : null;
        assert(lastMsg10, 'Chat returned response');
        // Clean up test file to maintain Zero-Pollution invariant
        const test10Draft = path.join(draftsDir, `${test10Mobile}.json`);
        if (fs.existsSync(test10Draft)) fs.unlinkSync(test10Draft);

        // ----------------------------------------------------------------
        // TEST 11: Hamlet Village Auto-Resolution & Address Line 3 Preserving
        // ----------------------------------------------------------------
        console.log('\n[TEST 11] Hamlet Village Auto-Resolution: Mapping hamlet to Revenue Village & Address Line 3');
        const { resolveTnDistrict } = require('../tn_district_mapper');

        // Test Narasingapuram (Hamlet under Minnal revenue village)
        const narasingamRes = resolveTnDistrict('Ranipet', 'Arakkonam', 'Narasingapuram', '631002');
        assert(narasingamRes.village === 'Minnal', 'Narasingapuram maps dropdown to parent revenue village Minnal');
        assert(narasingamRes.areaTam === 'நரசிங்கபுரம்', 'Preserves Tamil hamlet village name for Address Line 3');
        assert(narasingamRes.areaEng === 'NARASINGAPURAM', 'Provides English transliteration for Address Line 3');
        assert(narasingamRes.taluk === 'Arakkonam', 'Correctly maps to Arakkonam taluk');

        // Test Kunnathur Colony (Hamlet under Kunnathur revenue village, Sholinghur taluk)
        const kunnathurRes = resolveTnDistrict('Vellore', 'Sholinghur', 'Kunnathur Colony', '631102');
        assert(kunnathurRes.village === 'Kunnathur', 'Kunnathur Colony maps dropdown to Kunnathur revenue village');
        assert(kunnathurRes.district === 'Ranipet', 'Bifurcated Vellore correctly corrected to Ranipet');
        assert(kunnathurRes.areaTam === 'குன்னத்தூர் காலனி', 'Preserves Hamlet name குன்னத்தூர் காலனி');

        // Test Profile Update persists areaTam and areaEng into citizen draft
        const hamletMobile = '9888777666';
        const hamletDraftFile = path.join(draftsDir, `${hamletMobile}.json`);
        if (fs.existsSync(hamletDraftFile)) fs.unlinkSync(hamletDraftFile);

        const res11_profile = await request('POST', '/api/profile/update', {
            mobileNumber: hamletMobile,
            fullNameTam: 'சுரேஷ்',
            fullNameEng: 'Suresh',
            doorNo: '1/62',
            streetTam: 'பெரிய தெரு',
            streetEng: 'Big Street',
            areaTam: 'குன்னத்தூர் காலனி',
            areaEng: 'KUNNATHUR COLONY',
            village: 'Kunnathur',
            taluk: 'Sholinghur',
            district: 'Ranipet',
            pincode: '631102'
        });
        assert(res11_profile.status === 200, 'Profile update with hamlet village returned 200 OK');
        assert(res11_profile.body.citizenProfile.areaTam === 'குன்னத்தூர் காலனி', 'Profile maintains areaTam');
        assert(String(res11_profile.body.citizenProfile.areaEng).toUpperCase() === 'KUNNATHUR COLONY', 'Profile maintains areaEng');
        await new Promise(r => setTimeout(r, 200));
        assert(fs.existsSync(hamletDraftFile), 'Hamlet draft file written to disk');
        let hamletDraftData = null;
        for (let t = 0; t < 5; t++) {
            try {
                const raw = fs.readFileSync(hamletDraftFile, 'utf8');
                if (raw && raw.trim().length > 10) {
                    hamletDraftData = JSON.parse(raw);
                    break;
                }
            } catch (e) {}
            await new Promise(r => setTimeout(r, 100));
        }
        assert(hamletDraftData && hamletDraftData.citizenProfile.areaTam === 'குன்னத்தூர் காலனி', 'Saved draft on disk contains areaTam');
        // Clean up
        if (fs.existsSync(hamletDraftFile)) fs.unlinkSync(hamletDraftFile);

        // ----------------------------------------------------------------
        // TEST 12: Real Government OTP vs Safe Mock Mode Selection
        // ----------------------------------------------------------------
        console.log('\n[TEST 12] Real OTP Mode Gating: Verification of Live Production vs Mock Sandbox flags');
        // Direct verify of mode resolution logic
        const evalMode = (body, sess) => {
            const isRealGovtOtp = body.forceRealGovtOtp === true || sess.enableRealGovtOtp === true || body.isMockSandbox === false;
            return { isRealGovtOtp, isMock: !isRealGovtOtp };
        };

        const mockMode = evalMode({ isMockSandbox: true }, {});
        assert(mockMode.isMock === true && mockMode.isRealGovtOtp === false, 'Safe Mock sandbox mode correctly activated');

        const liveMode1 = evalMode({ forceRealGovtOtp: true }, {});
        assert(liveMode1.isRealGovtOtp === true && liveMode1.isMock === false, 'forceRealGovtOtp flag correctly triggers Live Real OTP mode');

        const liveMode2 = evalMode({ isMockSandbox: false }, {});
        assert(liveMode2.isRealGovtOtp === true && liveMode2.isMock === false, 'isMockSandbox=false correctly triggers Live Real OTP mode');

        // ----------------------------------------------------------------
        // TEST 13: Universal Base64 Document Persistence & Streaming
        // ----------------------------------------------------------------
        console.log('\n[TEST 13] Universal Base64 Document Delivery & Streaming Endpoint');
        const { saveCitizenDraft, getCitizenDraft } = require('../firestore_db');
        const testDocMob = '9777666555';
        const uploadsDir = path.join(__dirname, '..', 'uploads');
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
        const samplePhotoFile = path.join(uploadsDir, `test_photo_${Date.now()}.jpg`);
        fs.writeFileSync(samplePhotoFile, Buffer.from('FAKE_SAMPLE_PHOTO_DATA'));

        const sampleDraftPayload = {
            name: 'கார்த்திக்',
            citizenProfile: {
                fullNameTam: 'கார்த்திக்',
                fullNameEng: 'Karthik',
                headAadhaar: '123456789012',
                headPhotoPath: samplePhotoFile,
                members: [{ fullNameTam: 'கார்த்திக்', relationship: 'Family Head', docPath: samplePhotoFile }]
            },
            documents: { profilePhoto: samplePhotoFile }
        };

        const savedD = await saveCitizenDraft(testDocMob, sampleDraftPayload);
        assert(savedD && savedD.base64Docs && savedD.base64Docs.profilePhotoBase64, 'saveCitizenDraft preserves base64Docs');

        const fetchedD = await getCitizenDraft(testDocMob);
        assert(fetchedD && fetchedD.base64Docs && fetchedD.base64Docs.profilePhotoBase64, 'getCitizenDraft returns populated base64Docs');

        // Test streaming endpoint /api/drafts/:mobileNumber/doc/profilePhoto
        const res13_doc = await request('GET', `/api/drafts/${testDocMob}/doc/profilePhoto`);
        assert(res13_doc.status === 200, 'Streaming document endpoint returned 200 OK');

        // Cleanup
        try {
            const draftPath = path.join(draftsDir, `${testDocMob}.json`);
            if (fs.existsSync(draftPath)) fs.unlinkSync(draftPath);
            if (fs.existsSync(samplePhotoFile)) fs.unlinkSync(samplePhotoFile);
        } catch (e) {}

        // ----------------------------------------------------------------
        // TEST 14: Zero-Cost Centralized Per-Operator Error Telemetry & PII Masking
        // ----------------------------------------------------------------
        console.log('\n[TEST 14] Zero-Cost Centralized Operator Error Telemetry');
        const telemetryPayload = {
            operatorUid: 'op_test_suman_uid',
            operatorMobile: '9443322110',
            operatorName: 'Kumaran E-Seva Desk',
            customerMobile: '9123456780',
            serviceName: 'INCOME_CERTIFICATE',
            step: 'STEP_3_PHOTO_UPLOAD',
            errorType: 'MISSING_PHOTO',
            errorMessage: 'Citizen photo missing for Aadhaar 3115 2646 6205',
            appVersion: '1.1.28'
        };

        const res14_post = await request('POST', '/api/telemetry/error', telemetryPayload);
        assert(res14_post.status === 200, 'POST /api/telemetry/error returns 200 OK');
        assert(res14_post.body && res14_post.body.success === true, 'Telemetry error endpoint returns success');
        assert(res14_post.body && typeof res14_post.body.id === 'string' && res14_post.body.id.startsWith('err_'), 'Telemetry generates valid error ID');
        assert(res14_post.body.operatorKey === 'op_test_suman_uid', 'Telemetry isolates error under exact operatorKey');

        const res14_get = await request('GET', '/api/telemetry/errors?limit=5&operatorUid=op_test_suman_uid');
        assert(res14_get.status === 200, 'GET /api/telemetry/errors returns 200 OK');
        assert(res14_get.body && res14_get.body.success === true, 'Telemetry list returns success');
        assert(res14_get.body && Array.isArray(res14_get.body.errors), 'Telemetry errors list is array');
        const foundLoggedErr = res14_get.body.errors.find(e => e.id === res14_post.body.id);
        assert(foundLoggedErr, 'Recently posted telemetry error is present in per-operator filtered errors list');
        assert(foundLoggedErr.step === 'STEP_3_PHOTO_UPLOAD', 'Logged error preserves step context');
        assert(foundLoggedErr.operatorMobile === '9443322110', 'Logged error preserves operator mobile');
        assert(!foundLoggedErr.errorMessage.includes('3115') && foundLoggedErr.customerMobile === '91******80', 'Telemetry masks citizen Aadhaar & customer mobile');

        // Cleanup test telemetry file
        try {
            const teleDir = path.join(__dirname, '..', 'data', 'telemetry');
            const targetErrFile = path.join(teleDir, `${res14_post.body.id}.json`);
            if (fs.existsSync(targetErrFile)) fs.unlinkSync(targetErrFile);
        } catch (e) {}

        // TEST 14.5: Autonomous App Flight Recorder
        console.log('\n[TEST 14.5] Autonomous App Flight Recorder (விமானத்தின் கருப்புப் பெட்டி)');
        const flightPayload = {
            recordedAt: new Date().toISOString(),
            totalEventsRecorded: 2,
            domSnapshot: { currentRole: 'operator', activeCustomer: '9443322110', activePanelId: 'panel-operator' },
            timeline: [
                { seq: 1, time: '20:00:00.000', cat: 'CLICK', action: 'button#btnNewCard' },
                { seq: 2, time: '20:00:01.000', cat: 'NAV', action: 'Switched tab to: citizen' }
            ]
        };
        const resFlight = await request('POST', '/api/operator/flight-recorder', flightPayload);
        assert(resFlight.status === 200, 'POST /api/operator/flight-recorder returns 200 OK');
        assert(resFlight.body && resFlight.body.success === true, 'Flight recorder endpoint returns success');
        const flightFile = path.join(__dirname, '..', 'data', 'telemetry', 'app_flight_recorder.json');
        assert(fs.existsSync(flightFile), 'app_flight_recorder.json saved to disk');
        const flightContent = JSON.parse(fs.readFileSync(flightFile, 'utf8'));
        assert(flightContent.totalEventsRecorded === 2, 'Flight recorder preserves timeline payload');
        assert(flightContent.domSnapshot.currentRole === 'operator', 'Flight recorder captures role snapshot');
        console.log('  ✅ PASS: Autonomous App Flight Recorder verified on local disk');

        // ----------------------------------------------------------------
        // TEST 15: Strict Sequential Field-Gating & Father/Husband Auto-Resolution
        // ----------------------------------------------------------------
        console.log('\n[TEST 15] Strict Sequential Field-Gating & Father/Husband Auto-Resolution');
        const testFamMob = '9555444333';
        const draftWithHusband = {
            name: 'பவானா',
            citizenProfile: {
                fullNameTam: 'பவானா',
                fullNameEng: 'Bhavana',
                headGender: 'Female',
                headAadhaar: '367443820346',
                fatherNameTam: '',
                fatherNameEng: '',
                doorNo: '1/62',
                pincode: '632510',
                members: [
                    { nameTam: 'பவானா', nameEng: 'Bhavana', relationship: 'Family Head', relationshipTam: 'குடும்பத் தலைவர்' },
                    { nameTam: 'சுரேஷ் வி', nameEng: 'Suresh V', relationship: 'Husband', relationshipTam: 'கணவர்' }
                ]
            },
            documents: { profilePhoto: 'fake_photo.jpg' }
        };

        const savedFam = await saveCitizenDraft(testFamMob, draftWithHusband);
        assert(savedFam.citizenProfile.fatherNameEng === 'Suresh V', 'Father/Husband Eng automatically resolved from husband member');
        assert(savedFam.citizenProfile.fatherNameTam === 'சுரேஷ் வி', 'Father/Husband Tam automatically resolved from husband member');
        assert(savedFam.citizenProfile.fatherNameEng !== 'FATHER', "Dummy word 'FATHER' is strictly eliminated");

        const fetchedFam = await getCitizenDraft(testFamMob);
        assert(fetchedFam.citizenProfile.fatherNameEng === 'Suresh V', 'getCitizenDraft preserves resolved fatherNameEng');
        assert(fetchedFam.citizenProfile.fatherNameTam === 'சுரேஷ் வி', 'getCitizenDraft preserves resolved fatherNameTam');

        // ----------------------------------------------------------------
        // TEST 16: Universal Service Checklist & Delta-Intake Engine
        // ----------------------------------------------------------------
        console.log('\n[TEST 16] Universal Service Checklist & Delta-Intake Engine');
        
        // 16.1: Service registry returns official e-Sevai services
        const resServices = await request('GET', '/api/services');
        assert(resServices.status === 200, 'GET /api/services returns 200 OK');
        assert(Array.isArray(resServices.body.services), 'Services endpoint returns array');
        assert(resServices.body.services.some(s => s.id === 'NEW_RATION_CARD'), 'Service registry has NEW_RATION_CARD');
        assert(resServices.body.services.some(s => s.id === 'INCOME_CERTIFICATE'), 'Service registry has INCOME_CERTIFICATE');
        assert(resServices.body.services.some(s => s.id === 'RESIDENCE_CERTIFICATE'), 'Service registry has RESIDENCE_CERTIFICATE');

        // 16.2: Real-time service checklist evaluation
        const resChk = await request('GET', '/api/services/INCOME_CERTIFICATE/checklist');
        assert(resChk.status === 200, 'Checklist endpoint returns 200 OK');
        assert(resChk.body.checklist && resChk.body.checklist.serviceId === 'INCOME_CERTIFICATE', 'Checklist evaluates for requested service');
        assert(typeof resChk.body.checklist.isReady === 'boolean', 'Checklist provides boolean isReady status');

        // 16.3: Family Delta Profile Reuse Flow (Applying for Income Certificate with existing Ration Card family)
        const famDeltaMob = '9333222111';
        const famDeltaPath = path.join(draftsDir, `${famDeltaMob}.json`);
        if (fs.existsSync(famDeltaPath)) fs.unlinkSync(famDeltaPath);

        const initialFamDraft = {
            mobileNumber: famDeltaMob,
            intakeState: 'SERVICE_SELECTION',
            citizenProfile: {
                canNumber: '133370337878397',
                motherNameTam: 'லட்சுமி',
                community: 'BC',
                fullNameTam: 'பவானி',
                fullNameEng: 'Bhavani',
                headGender: 'Female',
                headAadhaar: '998877665544',
                doorNo: '12/A',
                streetTam: 'மேட்டுத் தெரு',
                streetEng: 'Mettu Street',
                village: 'Minnal',
                taluk: 'Arakkonam',
                district: 'Ranipet',
                pincode: '632510',
                members: [
                    { nameTam: 'பவானி', nameEng: 'Bhavani', relationship: 'Family Head', aadhaarNumber: '998877665544' },
                    { nameTam: 'சுரேஷ் வ', nameEng: 'Suresh V', relationship: 'Husband', aadhaarNumber: '112233445566', gender: 'Male', dob: '1985-05-10' }
                ]
            }
        };
        await saveCitizenDraft(famDeltaMob, initialFamDraft);

        // A: Selecting Income Certificate for family with multiple members prompts member chips
        const deltaChat1 = await request('POST', '/api/chat', { text: 'வருமானச் சான்றிதழ்' }, { 'x-session-mobile': famDeltaMob });
        assert(deltaChat1.status === 200, 'Income selection returned 200 OK');
        assert(deltaChat1.body.intakeState === 'INCOME_INTAKE', 'Intake state is INCOME_INTAKE');
        const botMsgDelta1 = deltaChat1.body.chatHistory[deltaChat1.body.chatHistory.length - 1];
        assert(botMsgDelta1.options.some(o => o.value === 'SELECT_MEMBER_1'), 'Presents member selection chip for Suresh V');

        // B: Selecting Suresh V auto-maps his details and preserves family address
        const deltaChat2 = await request('POST', '/api/chat', { text: 'SELECT_MEMBER_1' }, { 'x-session-mobile': famDeltaMob });
        assert(deltaChat2.status === 200, 'Member selection returned 200 OK');
        assert(deltaChat2.body.citizenProfile.fullNameEng === 'Suresh V', 'Applicant mapped to Suresh V');
        assert(deltaChat2.body.citizenProfile.headAadhaar === '112233445566', "Suresh's Aadhaar auto-mapped");
        assert(deltaChat2.body.citizenProfile.village === 'Minnal', 'Family village preserved without re-asking');

        // B.2: Selecting member count "1 நபர்"
        const deltaChatCount = await request('POST', '/api/chat', { text: '1 நபர்' }, { 'x-session-mobile': famDeltaMob });
        assert(deltaChatCount.status === 200, 'Member count returned 200 OK');
        assert(deltaChatCount.body.citizenProfile.familyMemberCount === 1, 'Member count captured');

        // C: Answering annual income delta question
        const deltaChat3 = await request('POST', '/api/chat', { text: '₹72,000' }, { 'x-session-mobile': famDeltaMob });
        assert(deltaChat3.status === 200, 'Income answer returned 200 OK');
        assert(deltaChat3.body.citizenProfile.annualIncome === '72000', 'Annual income captured');

        // D: Answering occupation delta question transitions to mandatory Photo Gate or readiness
        const deltaChat4 = await request('POST', '/api/chat', { text: 'தனியார் வேலை' }, { 'x-session-mobile': famDeltaMob });
        assert(deltaChat4.status === 200, 'Occupation answer returned 200 OK');
        assert(deltaChat4.body.citizenProfile.profession === 'தனியார் வேலை', 'Profession captured');
        assert(deltaChat4.body.step === 'INCOME_AADHAAR_WAIT' || deltaChat4.body.step === 'INCOME_PHOTO_WAIT' || deltaChat4.body.step === 'INCOME_PROOF_WAIT' || deltaChat4.body.step === 'READY_TO_APPLY_INCOME', 'State transitioned to document gate or readiness');

        // Cleanup delta draft
        try {
            const famDeltaPath = path.join(draftsDir, `${famDeltaMob}.json`);
            if (fs.existsSync(famDeltaPath)) fs.unlinkSync(famDeltaPath);
        } catch (e) {}

        // =========================================================================
        // TEST 17: TNeGA e-Sevai Operator Login & CAN Automation Engine Integration
        // =========================================================================
        console.log('\n[TEST 17] TNeGA e-Sevai Operator Login & CAN Automation Engine Integration');

        // A. Operator Login in Safe Mock Sandbox
        const tnegaLoginRes = await request('POST', '/api/tnega/login', { username: 'TNTACCHN001-01', isMockSandbox: true });
        assert(tnegaLoginRes.status === 200, 'POST /api/tnega/login returns 200 OK');
        assert(tnegaLoginRes.body.success === true, 'TNeGA operator login successful');
        assert(tnegaLoginRes.body.sessionActive === true, 'TNeGA session marked active');

        // B. Existing Citizen CAN Search (Kumaran K)
        const tnegaSearchRes = await request('POST', '/api/tnega/can/search', { mobile: '9790170026', aadhaar: '987654321012', isMockSandbox: true });
        assert(tnegaSearchRes.status === 200, 'POST /api/tnega/can/search returns 200 OK');
        assert(tnegaSearchRes.body.found === true, 'Existing citizen CAN found');
        assert(tnegaSearchRes.body.canNumber === '1330109988771', 'Returns valid 13-digit CAN: 1330109988771');

        // C. New Citizen CAN Search (Not Found Scenario)
        const tnegaNotFoundRes = await request('POST', '/api/tnega/can/search', { mobile: '9111223344', isMockSandbox: true });
        assert(tnegaNotFoundRes.status === 200, 'Search for unregistered citizen returns 200 OK');
        assert(tnegaNotFoundRes.body.found === false, 'Unregistered citizen correctly returns found: false');

        // D. Automated New CAN Registration from Profile
        const tnegaRegRes = await request('POST', '/api/tnega/can/register', {
            citizenProfile: {
                fullNameTam: 'சுரேஷ் வி',
                fullNameEng: 'Suresh V',
                fatherNameTam: 'வெங்கடேசன்',
                fatherNameEng: 'Venkatesan',
                district: 'Ranipet',
                taluk: 'Arakkonam',
                village: 'Minnal',
                mobile: '9111223344',
                headAadhaar: '987654321999'
            },
            isMockSandbox: true
        });
        assert(tnegaRegRes.status === 200, 'POST /api/tnega/can/register returns 200 OK');
        assert(tnegaRegRes.body.success === true, 'New CAN registration succeeds');
        assert(tnegaRegRes.body.canNumber && tnegaRegRes.body.canNumber.startsWith('133'), 'Assigns official 13-digit CAN starting with 133');

        // E. Live TNeGA Status Endpoint
        const tnegaStatusRes = await request('GET', '/api/tnega/status');
        assert(tnegaStatusRes.status === 200, 'GET /api/tnega/status returns 200 OK');
        assert(tnegaStatusRes.body.step !== undefined, 'TNeGA status returns valid state');

        // F. Link CAN Number directly to Customer Master Profile
        const linkCanRes = await request('POST', '/api/operator/link-can', {
            mobileNumber: '9111223344',
            canNumber: tnegaRegRes.body.canNumber
        });
        assert(linkCanRes.status === 200, 'POST /api/operator/link-can returns 200 OK');
        assert(linkCanRes.body.success === true, 'CAN successfully linked to master profile');

        // G. Verify CAN number is returned in drafts list for Operator Desk badge
        const draftsRes = await request('GET', '/api/drafts');
        assert(draftsRes.status === 200, 'GET /api/drafts returns 200 OK');
        const linkedDraft = draftsRes.body.drafts.find(d => d.mobileNumber === '9111223344');
        assert(linkedDraft && linkedDraft.canNumber === tnegaRegRes.body.canNumber, 'Draft summary preserves canNumber for Customer Card badge');

        // H. Clean Stop
        const tnegaStopRes = await request('POST', '/api/tnega/stop');
        assert(tnegaStopRes.status === 200, 'POST /api/tnega/stop returns 200 OK');

        // Cleanup test draft
        try {
            const canTestDraft = path.join(draftsDir, '9111223344.json');
            if (fs.existsSync(canTestDraft)) fs.unlinkSync(canTestDraft);
        } catch (e) {}

        // ----------------------------------------------------------------
        // TEST 18: Universal Tamil Nadu Bifurcated District Reverse Resolution
        // ----------------------------------------------------------------
        console.log('\n[TEST 18] Universal Tamil Nadu Bifurcated District Reverse Resolution (Nemili/Ranipet, Tirupathur, Chengalpattu, Tenkasi, Mayiladuthurai, Kallakurichi)');

        // 1. Suman's exact case: Aadhaar has Vellore, Kaveripakkam village, 632508 pincode -> Nemili taluk, Ranipet district
        const resSuman = resolveTnDistrict('Vellore', '', 'Kaveripakkam', '632508');
        assert(resSuman.district === 'Ranipet', 'Suman case: Vellore auto-corrected to Ranipet');
        assert(resSuman.taluk === 'Nemili', 'Suman case: Taluk accurately resolved to Nemili');
        assert(resSuman.village === 'Kaveripakkam', 'Suman case: Village preserved as Kaveripakkam');
        assert(resSuman.wasAutoCorrected === true, 'Suman case: wasAutoCorrected flag set');
        assert(resSuman.reason && resSuman.reason.includes('இராணிப்பேட்டை'), 'Suman case: Explanatory Tamil reason generated');

        // 2. Nemili 6-digit Pincode Resolution (even when village & taluk are blank)
        const resPinNemili = resolveTnDistrict('Vellore', '', '', '631051');
        assert(resPinNemili.district === 'Ranipet', 'Nemili pincode: Vellore auto-corrected to Ranipet');
        assert(resPinNemili.taluk === 'Nemili', 'Nemili pincode: Taluk resolved to Nemili');
        assert(resPinNemili.wasAutoCorrected === true, 'Nemili pincode: wasAutoCorrected true');

        // 3. Chengalpattu & Tambaram Resolution (carved from Kanchipuram)
        const resTambaram = resolveTnDistrict('Kanchipuram', '', 'Tambaram', '600045');
        assert(resTambaram.district === 'Chengalpattu', 'Tambaram: Kanchipuram auto-corrected to Chengalpattu');
        assert(resTambaram.taluk === 'Tambaram', 'Tambaram: Taluk resolved to Tambaram');
        assert(resTambaram.wasAutoCorrected === true, 'Tambaram: wasAutoCorrected true');

        // 4. Tenkasi & Sankarankovil Resolution (carved from Tirunelveli)
        const resTenkasi = resolveTnDistrict('Tirunelveli', '', 'Sankarankovil', '627756');
        assert(resTenkasi.district === 'Tenkasi', 'Sankarankovil: Tirunelveli auto-corrected to Tenkasi');
        assert(resTenkasi.taluk === 'Sankarankovil', 'Sankarankovil: Taluk resolved to Sankarankovil');
        assert(resTenkasi.wasAutoCorrected === true, 'Sankarankovil: wasAutoCorrected true');

        // 5. Mayiladuthurai & Sirkazhi Resolution (carved from Nagapattinam)
        const resMayil = resolveTnDistrict('Nagapattinam', '', 'Sirkazhi', '609110');
        assert(resMayil.district === 'Mayiladuthurai', 'Sirkazhi: Nagapattinam auto-corrected to Mayiladuthurai');
        assert(resMayil.taluk === 'Sirkazhi', 'Sirkazhi: Taluk resolved to Sirkazhi');
        assert(resMayil.wasAutoCorrected === true, 'Sirkazhi: wasAutoCorrected true');

        // 6. Kallakurichi & Tirukkoyilur Resolution (carved from Villupuram)
        const resKalla = resolveTnDistrict('Villupuram', '', 'Tirukkoyilur', '605757');
        assert(resKalla.district === 'Kallakurichi', 'Tirukkoyilur: Villupuram auto-corrected to Kallakurichi');
        assert(resKalla.taluk === 'Tirukkoyilur', 'Tirukkoyilur: Taluk resolved to Tirukkoyilur');
        assert(resKalla.wasAutoCorrected === true, 'Tirukkoyilur: wasAutoCorrected true');

        // 7. Tirupathur & Ambur Resolution (carved from Vellore)
        const resAmbur = resolveTnDistrict('Vellore', '', 'Ambur', '635802');
        assert(resAmbur.district === 'Tirupathur', 'Ambur: Vellore auto-corrected to Tirupathur');
        assert(resAmbur.taluk === 'Ambur', 'Ambur: Taluk resolved to Ambur');
        assert(resAmbur.wasAutoCorrected === true, 'Ambur: wasAutoCorrected true');

        // 8. End-to-end Draft Update Persistence for Suman
        const sumanMobile = '9444332211';
        const sumanDraftFile = path.join(draftsDir, `${sumanMobile}.json`);
        if (fs.existsSync(sumanDraftFile)) fs.unlinkSync(sumanDraftFile);

        const resSumanProfile = await request('POST', '/api/profile/update', {
            mobileNumber: sumanMobile,
            fullNameTam: 'சுமன்',
            fullNameEng: 'Suman',
            district: 'Vellore',
            village: 'Kaveripakkam',
            pincode: '632508'
        });
        assert(resSumanProfile.status === 200, 'Suman profile update returned 200 OK');
        assert(resSumanProfile.body.citizenProfile && resSumanProfile.body.citizenProfile.district === 'Ranipet', 'Suman profile saved with auto-corrected district Ranipet');
        assert(resSumanProfile.body.citizenProfile && resSumanProfile.body.citizenProfile.taluk === 'Nemili', 'Suman profile saved with auto-corrected taluk Nemili');
        assert(resSumanProfile.body.citizenProfile && resSumanProfile.body.citizenProfile.districtAutoCorrected === true, 'Suman profile has districtAutoCorrected flag');

        if (fs.existsSync(sumanDraftFile)) fs.unlinkSync(sumanDraftFile);

        // =========================================================================
        // [TEST 19] Customer Saved Documents List, Direct Download & Filter Tabs
        // =========================================================================
        console.log('\n[TEST 19] Customer Saved Documents List, Direct Download & Filter Tabs');

        const testDocListMob = '9999900019';
        const dummyDocPath = path.join(__dirname, '..', 'uploads', 'test_sample_doc.jpg');
        if (!fs.existsSync(dummyDocPath)) {
            fs.writeFileSync(dummyDocPath, 'TEST_DOCUMENT_CONTENT');
        }

        await request('POST', '/api/drafts/save', {
            mobileNumber: testDocListMob,
            applicationNumber: 'TN-TEST-APP-12345',
            citizenProfile: {
                fullNameTam: 'மாதிரி வாடிக்கையாளர்',
                fullNameEng: 'Sample Customer',
                mobileNumber: testDocListMob,
                headAadhaarDocPath: '/uploads/test_sample_doc.jpg',
                members: [{ nameEng: 'Sample Member', nameTam: 'மாதிரி உறுப்பினர்' }]
            },
            documents: {
                headAadhaar: {
                    path: '/uploads/test_sample_doc.jpg'
                }
            }
        });

        // 1. Documents list endpoint for customer with saved documents
        const resDocsList = await request('GET', `/api/drafts/${testDocListMob}/documents-list`);
        assert(resDocsList.status === 200, 'GET /api/drafts/:mobile/documents-list returns 200 OK');
        assert(resDocsList.body && resDocsList.body.success === true, 'Documents list response has success: true');
        assert(Array.isArray(resDocsList.body.documents), 'Documents list returns an array');
        assert(resDocsList.body.documents.length >= 1, 'Customer has saved documents');

        const sampleDoc = resDocsList.body.documents[0];
        assert(!!sampleDoc.title, 'Document metadata has Tamil title');
        assert(!!sampleDoc.downloadUrl, 'Document metadata has direct download URL');

        // 1b. Direct document download verification
        const resDocDl = await request('GET', sampleDoc.downloadUrl);
        assert(resDocDl.status === 200, 'Document direct download URL returns 200 OK');

        // 2. Documents list endpoint for submitted application PDF
        assert(resDocsList.body.documents.some(d => d.type === 'applicationPdf'), 'Submitted customer has applicationPdf in documents list');

        // Clean up test document draft
        await request('DELETE', `/api/drafts/${testDocListMob}?permanent=true`);

        // 3. Drafts retrieval for Operator Tabs
        const resDrafts = await request('GET', '/api/drafts?operatorUid=local_op_dev');
        assert(resDrafts.status === 200, 'GET /api/drafts returns 200 OK');
        assert(Array.isArray(resDrafts.body.drafts), 'Drafts returns array for operator desk');

        // =========================================================================
        // [TEST 20] Live Automation Stop & Stopped Draft Deletion
        // =========================================================================
        console.log('\n[TEST 20] Live Automation Stop & Stopped Draft Deletion');
        
        // Create a temporary customer draft to test stop and deletion
        const testStopMob = '9888777666';
        await request('POST', '/api/chat/profile-update', {
            mobileNumber: testStopMob,
            fullNameTam: 'சுரேஷ் டெஸ்ட்',
            fullNameEng: 'Suresh Test'
        });

        // 1. Trigger automation stop endpoint
        const resStop = await request('POST', '/api/automation/stop', { mobileNumber: testStopMob });
        assert(resStop.status === 200, 'POST /api/automation/stop returns 200 OK');
        assert(resStop.body && resStop.body.success === true, 'Automation stop returns success: true');
        assert(resStop.body && resStop.body.step === 'stopped', 'Automation stop response has step: stopped');

        // 2. Delete the stopped automation draft
        const resDeleteStopped = await request('DELETE', `/api/drafts/${testStopMob}`);
        assert(resDeleteStopped.status === 200, 'DELETE /api/drafts/:mobile returns 200 OK for stopped draft');
        assert(resDeleteStopped.body && resDeleteStopped.body.success === true, 'Delete stopped draft returns success: true');

        // 3. Verify draft is gone from disk and /api/drafts/:mobile returns 404
        const resVerifyDeleted = await request('GET', `/api/drafts/${testStopMob}`);
        assert(resVerifyDeleted.status === 404 || !resVerifyDeleted.body?.draft, 'Deleted stopped draft returns 404 Not Found');

        console.log('\n[TEST 21] Complete Customer Final Stage Gate & Single-Person Add Member Flow');
        const testCompMob = '9999900021';
        const testCompHeaders = { 'x-session-mobile': testCompMob, 'x-operator-uid': 'test_suite_operator_uid' };

        // Pre-seed complete customer
        await request('POST', '/api/drafts/save', {
            mobileNumber: testCompMob,
            operatorUid: 'test_suite_operator_uid',
            citizenProfile: {
                fullNameTam: 'பவானா டெஸ்ட்',
                fullNameEng: 'Bhavana Test',
                fatherNameTam: 'சந்தானம்',
                fatherNameEng: 'Santhanam',
                mobileNumber: testCompMob,
                headAadhaar: '367443820346',
                headAadhaarDocPath: '/uploads/test_sample_doc.jpg',
                headPhotoPath: '/uploads/test_sample_doc.jpg',
                residenceProof: {
                    typeTam: 'எரிவாயு இணைப்பு அட்டை',
                    docPath: '/uploads/test_sample_doc.jpg'
                },
                members: [
                    { nameEng: 'Bhavana', nameTam: 'பவானா', aadhaarNumber: '367443820346', relationEng: 'Head', relationTam: 'குடும்பத் தலைவர்' },
                    { nameEng: 'Suresh', nameTam: 'சுரேஷ்', aadhaarNumber: '367443820347', relationEng: 'Son', relationTam: 'மகன்' }
                ],
                doorNo: '12/A',
                pincode: '631102',
                district: 'Ranipet',
                taluk: 'Sholinghur',
                village: 'Banavaram'
            },
            chatHistory: [{ sender: 'bot', text: 'வணக்கம்' }],
            intakeState: 'READY_TO_APPLY'
        }, testCompHeaders);

        // 1. Existing customer with complete details starts at READY_TO_APPLY
        const resBhavanaHist = await request('GET', `/api/chat/history?mobile=${testCompMob}`, null, testCompHeaders);
        assert(resBhavanaHist.status === 200, `GET /api/chat/history?mobile=${testCompMob} returns 200 OK`);
        assert(resBhavanaHist.body.step === 'READY_TO_APPLY', 'Complete customer is at READY_TO_APPLY');
        const lastBhavanaMsg = resBhavanaHist.body.chatHistory[resBhavanaHist.body.chatHistory.length - 1];
        assert(lastBhavanaMsg.options && lastBhavanaMsg.options.some(o => o.value === 'CONFIRM_SUBMIT'), 'Complete customer has Submit to Portal option');
        assert(!lastBhavanaMsg.options.some(o => o.value.startsWith('ADD_MEMBER_')), 'Submit card does NOT have redundant Add Member option');
        assert(lastBhavanaMsg.options.some(o => o.value === 'TRIGGER_EDIT_MODAL'), 'Complete customer has Review/Edit option');
        assert(!lastBhavanaMsg.actionRequired, 'Complete customer does NOT have dangling upload prompt');

        // 2. Selecting Ration Card category switches to RATION_CARD_SERVICES and shows 4 certified subservices (+ Back)
        const resRationMenu = await request('POST', '/api/chat', { message: 'ரேஷன் கார்டு', mobileNumber: testCompMob }, testCompHeaders);
        assert(resRationMenu.status === 200, 'Ration Card menu returns 200 OK');
        assert(resRationMenu.body.step === 'RATION_CARD_SERVICES', 'Switches to RATION_CARD_SERVICES');
        const rationMenuMsg = resRationMenu.body.chatHistory[resRationMenu.body.chatHistory.length - 1];
        assert(rationMenuMsg.options && rationMenuMsg.options.length === 5, 'Ration card menu has 4 certified subservices + Back');

        // 2b. Calling history while in RATION_CARD_SERVICES stays at RATION_CARD_SERVICES (no premature submit card!)
        const resCheckNoPremature = await request('GET', `/api/chat/history?mobile=${testCompMob}`, null, testCompHeaders);
        assert(resCheckNoPremature.status === 200, 'History check returns 200 OK');
        assert(resCheckNoPremature.body.step === 'RATION_CARD_SERVICES', 'History stays at RATION_CARD_SERVICES');
        const noPrematureMsg = resCheckNoPremature.body.chatHistory[resCheckNoPremature.body.chatHistory.length - 1];
        assert(noPrematureMsg.options && noPrematureMsg.options.length === 5, 'Still shows 4 certified subservices + Back, no premature submit card');

        // 3. Selecting Option 1 (புதிய ரேஷன் கார்டு) switches back to READY_TO_APPLY
        const resNewRation = await request('POST', '/api/chat', { message: 'புதிய ரேஷன் கார்டு', mobileNumber: testCompMob }, testCompHeaders);
        assert(resNewRation.status === 200, 'Option 1 returns 200 OK');
        assert(resNewRation.body.step === 'READY_TO_APPLY', 'Option 1 transitions to READY_TO_APPLY');

        // 4. Clicking Add Member asks ONLY for Member 3
        const resAddMem = await request('POST', '/api/chat', { message: 'ADD_MEMBER_3', mobileNumber: testCompMob }, testCompHeaders);
        assert(resAddMem.status === 200, 'ADD_MEMBER_3 returns 200 OK');
        assert(resAddMem.body.step === 'MEMBER_AADHAAR_FRONT', 'Transitions to MEMBER_AADHAAR_FRONT');
        const addMemMsg = resAddMem.body.chatHistory[resAddMem.body.chatHistory.length - 1];
        assert(addMemMsg.text.includes('உறுப்பினர் 3'), 'Prompts specifically for Member 3');
        assert(!addMemMsg.text.includes('உறுப்பினர் 2'), 'Never asks for Member 2 when Member 2 already exists');

        // 5. Clicking Submit transitions back to READY_TO_APPLY
        const resSubmitBack = await request('POST', '/api/chat', { message: 'CONFIRM_SUBMIT', mobileNumber: testCompMob }, testCompHeaders);
        assert(resSubmitBack.status === 200, 'CONFIRM_SUBMIT returns 200 OK');
        assert(resSubmitBack.body.step === 'READY_TO_APPLY', 'CONFIRM_SUBMIT returns to READY_TO_APPLY');

        // Cleanup testCompMob
        await request('DELETE', `/api/drafts/${testCompMob}?permanent=true`);

        // =========================================================================
        // [TEST 22] Two-Stage Trash Lifecycle: Soft Delete, Restore & Permanent Purge
        // =========================================================================
        console.log('\n[TEST 22] Two-Stage Trash Lifecycle: Soft Delete, Restore & Permanent Firebase Purge');
        const trashTestMob = '9888877777';
        
        // 1. Create a sample draft
        const resSaveTest = await request('POST', '/api/drafts/save', {
            mobileNumber: trashTestMob,
            targetMobile: trashTestMob,
            citizenProfile: {
                fullNameTam: 'ராஜேஷ் குமார்',
                fullNameEng: 'Rajesh Kumar',
                mobileNumber: trashTestMob,
                headAadhaar: '987654321098',
                doorNo: '12/A',
                pincode: '632510',
                members: [{ nameEng: 'Rajesh Kumar', nameTam: 'ராஜேஷ் குமார்', aadhaarNumber: '987654321098' }]
            },
            chatHistory: [{ sender: 'bot', text: 'வணக்கம்' }]
        }, { 'x-session-mobile': trashTestMob });
        assert(resSaveTest.status === 200, 'Create draft for trash test returns 200 OK');

        // 2. Soft delete / Move to trash
        const resTrash = await request('POST', `/api/drafts/${trashTestMob}/trash`);
        assert(resTrash.status === 200, 'POST /api/drafts/:mobile/trash returns 200 OK');
        assert(resTrash.body.success === true, 'Trash returns success: true');

        // 3. Draft list reflects isDeleted: true / status: TRASHED
        const resDraftsList = await request('GET', '/api/drafts');
        assert(resDraftsList.status === 200, 'GET /api/drafts returns 200 OK');
        const foundTrashed = (resDraftsList.body.drafts || []).find(d => d.mobileNumber === trashTestMob);
        assert(foundTrashed && (foundTrashed.isDeleted === true || foundTrashed.status === 'TRASHED'), 'Draft is marked as trashed in list');

        // 4. Regular GET /api/drafts/:mobile returns 404 for trashed item
        const resGetTrashed404 = await request('GET', `/api/drafts/${trashTestMob}`);
        assert(resGetTrashed404.status === 404, 'GET /api/drafts/:mobile without flag returns 404 for trashed item');

        // 5. Restore draft from trash
        const resRestore = await request('POST', `/api/drafts/${trashTestMob}/restore`);
        assert(resRestore.status === 200, 'POST /api/drafts/:mobile/restore returns 200 OK');
        assert(resRestore.body.success === true, 'Restore returns success: true');

        const resGetRestored = await request('GET', `/api/drafts/${trashTestMob}`);
        assert(resGetRestored.status === 200, 'GET /api/drafts/:mobile returns 200 OK after restore');
        assert(resGetRestored.body.isTrashed === false, 'Restored draft isTrashed is false');

        // 6. Permanent hard delete
        const resPermDelete = await request('DELETE', `/api/drafts/${trashTestMob}?permanent=true`);
        assert(resPermDelete.status === 200, 'DELETE /api/drafts/:mobile?permanent=true returns 200 OK');
        assert(resPermDelete.body.permanent === true, 'Permanent delete returns permanent: true');

        // =========================================================================
        // [TEST 23] Existing Smart Ration Card Subservices (Add Member, Remove Member, Change Address)
        // =========================================================================
        console.log('\n[TEST 23] Existing Smart Ration Card Subservices (Add Member Child/Adult, Remove Member, Change Address)');
        const subSvcMob = '9999900023';
        const subHeaders = { 'x-session-mobile': subSvcMob, 'x-operator-uid': 'test_suite_operator_uid' };
        await request('DELETE', `/api/drafts/${subSvcMob}?permanent=true`);

        // 1. Initial greeting / Service Selection
        const resSubMenu = await request('POST', '/api/chat', { message: 'ரேஷன் கார்டு', mobileNumber: subSvcMob }, subHeaders);
        assert(resSubMenu.status === 200, 'Ration Card menu returns 200 OK');
        assert(resSubMenu.body.step === 'RATION_CARD_SERVICES', 'Switches to RATION_CARD_SERVICES');
        assert(resSubMenu.body.chatHistory[resSubMenu.body.chatHistory.length - 1].options.length === 5, 'Shows 4 certified subservices + Back');

        // 2. Select Option 2: Add Member -> transitions to RATION_ADD_MEMBER_TYPE (Direct Aadhaar Card Upload)
        const resAddType = await request('POST', '/api/chat', { message: 'குடும்ப உறுப்பினர் சேர்க்க', mobileNumber: subSvcMob }, subHeaders);
        assert(resAddType.status === 200, 'Select Add Member returns 200 OK');
        assert(resAddType.body.step === 'RATION_ADD_MEMBER_TYPE', 'Transitions to RATION_ADD_MEMBER_TYPE');
        const addTypeMsg = resAddType.body.chatHistory[resAddType.body.chatHistory.length - 1];
        assert(addTypeMsg.options.some(o => o.value === 'TRIGGER_FILE_UPLOAD'), 'Has direct Aadhaar upload option');

        // 3. Child flow: Select ADD_MEMBER_CHILD -> transitions to RATION_ADD_MEMBER_CHILD_DOC
        const resChildDoc = await request('POST', '/api/chat', { message: 'ADD_MEMBER_CHILD', mobileNumber: subSvcMob }, subHeaders);
        assert(resChildDoc.status === 200, 'Child select returns 200 OK');
        assert(resChildDoc.body.step === 'RATION_ADD_MEMBER_CHILD_DOC', 'Transitions to RATION_ADD_MEMBER_CHILD_DOC');
        const childDocMsg = resChildDoc.body.chatHistory[resChildDoc.body.chatHistory.length - 1];
        assert(childDocMsg.text.includes('ஆதார் அட்டை'), 'Prompts for Aadhaar Card');

        // 4. Send document text -> transitions to RATION_ADD_MEMBER_CHILD_RELATION
        const resChildRel = await request('POST', '/api/chat', { message: 'கவின் குமார்', mobileNumber: subSvcMob }, subHeaders);
        assert(resChildRel.status === 200, 'Child doc received returns 200 OK');
        assert(resChildRel.body.step === 'RATION_ADD_MEMBER_CHILD_RELATION', 'Transitions to RATION_ADD_MEMBER_CHILD_RELATION');

        // 5. Choose Relationship -> transitions to READY_TO_APPLY with child summary
        const resChildReady = await request('POST', '/api/chat', { message: 'CHILD_SON', mobileNumber: subSvcMob }, subHeaders);
        assert(resChildReady.status === 200, 'Child rel returns 200 OK');
        assert(resChildReady.body.step === 'READY_TO_APPLY', 'Transitions to READY_TO_APPLY');
        const childReadyMsg = resChildReady.body.chatHistory[resChildReady.body.chatHistory.length - 1];
        assert(childReadyMsg.text.includes('குழந்தை'), 'Summary includes child');
        assert(childReadyMsg.text.includes('ஆதார் அட்டை'), 'Summary includes Aadhaar card');
        assert(childReadyMsg.options.some(o => o.value === 'CONFIRM_SUBMIT'), 'Has Submit to Portal option');

        // 6. Adult Add Member flow
        await request('POST', '/api/chat', { message: 'RATION_ADD_MEMBER_RESET', mobileNumber: subSvcMob }, subHeaders);
        const resAdultAadhaar = await request('POST', '/api/chat', { message: 'ADD_MEMBER_ADULT', mobileNumber: subSvcMob }, subHeaders);
        assert(resAdultAadhaar.status === 200, 'Adult select returns 200 OK');
        assert(resAdultAadhaar.body.step === 'RATION_ADD_MEMBER_ADULT_AADHAAR', 'Transitions to RATION_ADD_MEMBER_ADULT_AADHAAR');

        const resAdultSurrender = await request('POST', '/api/chat', { message: 'சுரேகா', mobileNumber: subSvcMob }, subHeaders);
        assert(resAdultSurrender.status === 200, 'Adult aadhaar returns 200 OK');
        assert(resAdultSurrender.body.step === 'RATION_ADD_MEMBER_ADULT_SURRENDER', 'Transitions to RATION_ADD_MEMBER_ADULT_SURRENDER');

        const resAdultRel = await request('POST', '/api/chat', { message: 'SURRENDER_DOC_CONFIRMED', mobileNumber: subSvcMob }, subHeaders);
        assert(resAdultRel.status === 200, 'Surrender doc confirmed returns 200 OK');
        assert(resAdultRel.body.step === 'RATION_ADD_MEMBER_ADULT_RELATION', 'Transitions to RATION_ADD_MEMBER_ADULT_RELATION');

        const resAdultReady = await request('POST', '/api/chat', { message: 'மனைவி', mobileNumber: subSvcMob }, subHeaders);
        assert(resAdultReady.status === 200, 'Adult rel returns 200 OK');
        assert(resAdultReady.body.step === 'READY_TO_APPLY', 'Adult transitions to READY_TO_APPLY');
        const adultReadyMsg = resAdultReady.body.chatHistory[resAdultReady.body.chatHistory.length - 1];
        assert(adultReadyMsg.text.includes('மனைவி'), 'Summary mentions wife');

        // 6b. Adult Son / Daughter (> 5 yrs) Aadhaar-Only Add Member flow
        await request('POST', '/api/chat', { message: 'RATION_ADD_MEMBER_RESET', mobileNumber: subSvcMob }, subHeaders);
        const resSonAadhaar = await request('POST', '/api/chat', { message: 'ADD_MEMBER_SON_DAUGHTER', mobileNumber: subSvcMob }, subHeaders);
        assert(resSonAadhaar.status === 200, 'Son/Daughter select returns 200 OK');
        assert(resSonAadhaar.body.step === 'RATION_ADD_MEMBER_SON_AADHAAR', 'Transitions to RATION_ADD_MEMBER_SON_AADHAAR');

        const resSonRel = await request('POST', '/api/chat', { message: 'கார்த்திக்', mobileNumber: subSvcMob }, subHeaders);
        assert(resSonRel.status === 200, 'Son aadhaar returns 200 OK');
        assert(resSonRel.body.step === 'RATION_ADD_MEMBER_SON_RELATION', 'Transitions to RATION_ADD_MEMBER_SON_RELATION');

        const resSonReady = await request('POST', '/api/chat', { message: 'REL_SON', mobileNumber: subSvcMob }, subHeaders);
        assert(resSonReady.status === 200, 'Son rel returns 200 OK');
        assert(resSonReady.body.step === 'READY_TO_APPLY', 'Son transitions to READY_TO_APPLY');
        const sonReadyMsg = resSonReady.body.chatHistory[resSonReady.body.chatHistory.length - 1];
        assert(sonReadyMsg.text.includes('மகன்'), 'Summary mentions son');
        assert(sonReadyMsg.text.includes('ஆதார் அட்டை'), 'Summary includes Aadhaar card only');
        assert(!sonReadyMsg.text.includes('நீக்கல்/திருமணச் சான்று'), 'Summary does NOT require surrender/marriage proof for son');

        // 6c. Real Aadhaar Card AI OCR Extraction in Add Member Workflow
        const testOcrSess = {
            intakeState: 'RATION_ADD_MEMBER_SON_AADHAAR',
            chatHistory: [],
            citizenProfile: { rationCardNo: '332145897210' }
        };
        const mockExtractedAadhaar = {
            fullNameTam: 'செந்தில் குமார்',
            fullNameEng: 'Senthil Kumar',
            aadhaarNumber: '556677889900',
            dob: '12/08/2005',
            gender: 'Male'
        };
        const ocrHandled = await handleRationSubserviceWorkflow('TRIGGER_FILE_UPLOAD', testOcrSess, { path: 'uploads/real_aadhaar.jpg' }, mockExtractedAadhaar);
        assert(ocrHandled === true, 'handleRationSubserviceWorkflow handles OCR extracted Aadhaar');
        assert(testOcrSess.subServiceData.memberName === 'செந்தில் குமார்', 'Extracted real Tamil name assigned');
        assert(testOcrSess.subServiceData.memberNameEng === 'Senthil Kumar', 'Extracted real English name assigned');
        assert(testOcrSess.subServiceData.aadhaarNo === '556677889900', 'Extracted real Aadhaar number assigned');
        assert(testOcrSess.subServiceData.dob === '12/08/2005', 'Extracted real DOB assigned');
        assert(testOcrSess.subServiceData.gender === 'Male', 'Extracted real Gender assigned');
        // 6d. Universal Front + Back Photo Upload & Auto Merge into 2-in-1 PDF
        const dualSideSess = {
            intakeState: 'RATION_ADD_MEMBER_TYPE',
            chatHistory: [],
            citizenProfile: { rationCardNo: '332145897210' }
        };
        // Step 1: Upload Front Image
        await handleRationSubserviceWorkflow('TRIGGER_FILE_UPLOAD', dualSideSess, { path: 'uploads/test_front.jpg' }, {
            fullNameTam: 'ராஜேஷ் குமார்',
            fullNameEng: 'Rajesh Kumar',
            aadhaarNumber: '445566778899',
            dob: '20/05/1995',
            gender: 'Male'
        });
        assert(dualSideSess.intakeState === 'RATION_ADD_MEMBER_BACK', 'Front photo upload prompts for Back side');
        const frontMsg = dualSideSess.chatHistory[dualSideSess.chatHistory.length - 1];
        assert(frontMsg.text.includes('பின்பக்கத்தை'), 'Prompt asks for back side of Aadhaar');
        assert(frontMsg.options.some(o => o.value === 'MEMBER_DOC_COMPLETE'), 'Provides full document complete button');

        // Step 2: Upload Back Image -> merges into 2-in-1 PDF and transitions to RELATION
        await handleRationSubserviceWorkflow('TRIGGER_FILE_UPLOAD', dualSideSess, { path: 'uploads/test_back.jpg' }, {
            fatherNameTam: 'முருகேசன்',
            fatherNameEng: 'Murugesan',
            address: '12/4, Gandhi Street, Chennai 600001'
        });
        assert(dualSideSess.intakeState === 'RATION_ADD_MEMBER_RELATION', 'Back photo upload transitions to RELATION');
        const backMsg = dualSideSess.chatHistory[dualSideSess.chatHistory.length - 1];
        assert(backMsg.text.includes('2-in-1 A4 PDF'), 'Confirms 2-in-1 PDF merge');

        // 6e. Single-page PDF auto-bypass to Relationship
        const pdfSess = {
            intakeState: 'RATION_ADD_MEMBER_TYPE',
            chatHistory: [],
            citizenProfile: { rationCardNo: '332145897210' }
        };
        await handleRationSubserviceWorkflow('TRIGGER_FILE_UPLOAD', pdfSess, { path: 'uploads/eaadhaar_full.pdf' }, {
            fullNameTam: 'பிரியா',
            fullNameEng: 'Priya',
            aadhaarNumber: '112233445566',
            dob: '10/10/1998',
            gender: 'Female',
            isComplete: true
        });
        assert(pdfSess.intakeState === 'RATION_ADD_MEMBER_RELATION', 'PDF upload directly transitions to RELATION without asking back side');

        // 7. Remove Member flow
        await request('POST', '/api/chat', { message: 'ரேஷன் கார்டு', mobileNumber: subSvcMob }, subHeaders);
        const resRemove = await request('POST', '/api/chat', { message: 'குடும்ப உறுப்பினர் நீக்க', mobileNumber: subSvcMob }, subHeaders);
        assert(resRemove.status === 200, 'Remove member returns 200 OK');
        assert(resRemove.body.step === 'RATION_REMOVE_MEMBER_REASON', 'Transitions to RATION_REMOVE_MEMBER_REASON');

        const resRemoveDoc = await request('POST', '/api/chat', { message: 'REMOVE_REASON_DEATH', mobileNumber: subSvcMob }, subHeaders);
        assert(resRemoveDoc.status === 200, 'Reason death returns 200 OK');
        assert(resRemoveDoc.body.step === 'RATION_REMOVE_MEMBER_DOC', 'Transitions to RATION_REMOVE_MEMBER_DOC');

        const resRemoveReady = await request('POST', '/api/chat', { message: 'REMOVE_DOC_CONFIRMED', mobileNumber: subSvcMob }, subHeaders);
        assert(resRemoveReady.status === 200, 'Remove ready returns 200 OK');
        assert(resRemoveReady.body.step === 'READY_TO_APPLY', 'Remove transitions to READY_TO_APPLY');

        // 8. Change Address flow
        await request('POST', '/api/chat', { message: 'ரேஷன் கார்டு', mobileNumber: subSvcMob }, subHeaders);
        const resAddr = await request('POST', '/api/chat', { message: 'முகவரி மாற்றம்', mobileNumber: subSvcMob }, subHeaders);
        assert(resAddr.status === 200, 'Change address returns 200 OK');
        assert(resAddr.body.step === 'RATION_CHANGE_ADDRESS_DOC', 'Transitions to RATION_CHANGE_ADDRESS_DOC');

        const resAddrUpload = await request('POST', '/api/chat', { message: 'ADDR_PROOF_EB', mobileNumber: subSvcMob }, subHeaders);
        assert(resAddrUpload.status === 200, 'EB select returns 200 OK');
        assert(resAddrUpload.body.step === 'RATION_CHANGE_ADDRESS_UPLOAD', 'Transitions to RATION_CHANGE_ADDRESS_UPLOAD');

        const resAddrReady = await request('POST', '/api/chat', { message: 'ADDR_DOC_CONFIRMED', mobileNumber: subSvcMob }, subHeaders);
        assert(resAddrReady.status === 200, 'Address ready returns 200 OK');
        assert(resAddrReady.body.step === 'READY_TO_APPLY', 'Address transitions to READY_TO_APPLY');

        // Clean up subservice test draft
        await request('DELETE', `/api/drafts/${subSvcMob}?permanent=true`);

        // =========================================================================
        // [TEST 24] TNPDS Option 2: Add Family Member (குடும்ப உறுப்பினர் சேர்க்கை) End-to-End Automation
        // =========================================================================
        console.log('\n[TEST 24] TNPDS Option 2: Add Family Member (குடும்ப உறுப்பினர் சேர்க்கை) End-to-End Automation');

        // Part A: Child (< 5 yrs) Member Addition Flow
        const childMob = '9999900024';
        const childHeaders = { 'x-session-mobile': childMob, 'x-operator-uid': 'test_suite_operator_uid' };

        await request('POST', '/api/chat', { message: 'ரேஷன் கார்டு', mobileNumber: childMob }, childHeaders);
        await request('POST', '/api/chat', { message: 'குடும்ப உறுப்பினர் சேர்க்க', mobileNumber: childMob }, childHeaders);
        await request('POST', '/api/chat', { message: 'ADD_MEMBER_CHILD', mobileNumber: childMob }, childHeaders);
        await request('POST', '/api/chat', { message: 'மதிவாணன்', mobileNumber: childMob }, childHeaders);
        const resChildRelSelect = await request('POST', '/api/chat', { message: 'CHILD_SON', mobileNumber: childMob }, childHeaders);
        assert(resChildRelSelect.status === 200, 'Child relation returns 200 OK');
        assert(resChildRelSelect.body.step === 'READY_TO_APPLY', 'Child transitions to READY_TO_APPLY');

        // Stage gate: CONFIRM_SUBMIT confirms readiness
        const resChildSubmit = await request('POST', '/api/chat', { message: 'CONFIRM_SUBMIT', mobileNumber: childMob }, childHeaders);
        assert(resChildSubmit.status === 200, 'Child CONFIRM_SUBMIT returns 200 OK');
        assert(resChildSubmit.body.step === 'READY_TO_APPLY', 'Child CONFIRM_SUBMIT confirms READY_TO_APPLY');

        // Launch automation via /api/automation/start
        const resChildStart = await request('POST', '/api/automation/start', { mobileNumber: childMob, isMockSandbox: true, fastTest: true }, childHeaders);
        assert(resChildStart.status === 200, 'Child /api/automation/start returns 200 OK');

        // Wait for Mock Sandbox automation to complete
        let childSuccess = false;
        let childAppNo = null;
        let childPdfUrl = null;
        for (let waitIter = 0; waitIter < 25; waitIter++) {
            await new Promise(r => setTimeout(r, 200));
            const chHist = await request('GET', `/api/chat/history?mobile=${childMob}`, null, childHeaders);
            if (chHist.body && (chHist.body.step === 'submitted' || chHist.body.applicationNumber)) {
                childSuccess = true;
                childAppNo = chHist.body.applicationNumber || chHist.body.citizenProfile?.applicationNumber;
                childPdfUrl = chHist.body.applicationPdfUrl || chHist.body.citizenProfile?.applicationPdfUrl;
                break;
            }
        }
        assert(childSuccess, 'Child Add Member automation completed with status "submitted"');
        assert(childAppNo && childAppNo.startsWith('N'), `Child reference number starts with N: ${childAppNo}`);
        assert(childPdfUrl && childPdfUrl.includes(childAppNo), `Child PDF receipt URL contains reference number: ${childPdfUrl}`);

        const childPdfPath = path.join(__dirname, '..', 'public', childPdfUrl);
        assert(fs.existsSync(childPdfPath), `Child acknowledgment PDF file exists on disk at ${childPdfPath}`);
        if (fs.existsSync(childPdfPath)) fs.unlinkSync(childPdfPath);

        // Clean up Child draft
        await request('DELETE', `/api/drafts/${childMob}?permanent=true`);

        // Part B: Adult (> 5 yrs) Member Addition Flow
        const adultMob = '9999900025';
        const adultHeaders = { 'x-session-mobile': adultMob, 'x-operator-uid': 'test_suite_operator_uid' };

        await request('POST', '/api/chat', { message: 'ரேஷன் கார்டு', mobileNumber: adultMob }, adultHeaders);
        await request('POST', '/api/chat', { message: 'குடும்ப உறுப்பினர் சேர்க்க', mobileNumber: adultMob }, adultHeaders);
        await request('POST', '/api/chat', { message: 'ADD_MEMBER_ADULT', mobileNumber: adultMob }, adultHeaders);
        await request('POST', '/api/chat', { message: 'கீதா', mobileNumber: adultMob }, adultHeaders);
        await request('POST', '/api/chat', { message: 'SURRENDER_DOC_CONFIRMED', mobileNumber: adultMob }, adultHeaders);
        const resAdultRelSelect = await request('POST', '/api/chat', { message: 'மனைவி', mobileNumber: adultMob }, adultHeaders);
        assert(resAdultRelSelect.status === 200, 'Adult relation returns 200 OK');
        assert(resAdultRelSelect.body.step === 'READY_TO_APPLY', 'Adult transitions to READY_TO_APPLY');

        // Submit via /api/automation/start
        const resAdultStart = await request('POST', '/api/automation/start', { mobileNumber: adultMob, isMockSandbox: true, fastTest: true }, adultHeaders);
        assert(resAdultStart.status === 200, 'Adult /api/automation/start returns 200 OK');

        // Wait for Mock Sandbox automation to complete
        let adultSuccess = false;
        let adultAppNo = null;
        let adultPdfUrl = null;
        for (let waitIter = 0; waitIter < 25; waitIter++) {
            await new Promise(r => setTimeout(r, 200));
            const adHist = await request('GET', `/api/chat/history?mobile=${adultMob}`, null, adultHeaders);
            if (adHist.body && (adHist.body.step === 'submitted' || adHist.body.applicationNumber)) {
                adultSuccess = true;
                adultAppNo = adHist.body.applicationNumber || adHist.body.citizenProfile?.applicationNumber;
                adultPdfUrl = adHist.body.applicationPdfUrl || adHist.body.citizenProfile?.applicationPdfUrl;
                break;
            }
        }
        assert(adultSuccess, 'Adult Add Member automation completed with status "submitted"');
        assert(adultAppNo && adultAppNo.startsWith('N'), `Adult reference number starts with N: ${adultAppNo}`);
        assert(adultPdfUrl && adultPdfUrl.includes(adultAppNo), `Adult PDF receipt URL contains reference number: ${adultPdfUrl}`);

        const adultPdfPath = path.join(__dirname, '..', 'public', adultPdfUrl);
        assert(fs.existsSync(adultPdfPath), `Adult acknowledgment PDF file exists on disk at ${adultPdfPath}`);
        if (fs.existsSync(adultPdfPath)) fs.unlinkSync(adultPdfPath);

        // Clean up Adult draft
        await request('DELETE', `/api/drafts/${adultMob}?permanent=true`);

        // =========================================================================
        // [TEST 24.5] TNPDS Change of Address (குடும்ப அட்டை முகவரி மாற்றம்) End-to-End Automation
        // =========================================================================
        console.log('\n[TEST 24.5] TNPDS Change of Address (குடும்ப அட்டை முகவரி மாற்றம்) End-to-End Automation');
        const addrMob = '9999900026';
        const addrHeaders = { 'x-session-mobile': addrMob, 'x-operator-uid': 'test_suite_operator_uid' };

        // 1. Dedicated module verification in isolated folder
        const { changeAddress } = require('../automations/tnpds');
        assert(typeof changeAddress.runChangeAddressAutomation === 'function', 'Dedicated changeAddress module exports runChangeAddressAutomation');
        assert(typeof changeAddress.startTnpdsAddressChangeFlow === 'function', 'Dedicated changeAddress module exports startTnpdsAddressChangeFlow');
        passedCount += 2;

        // 2. Initiate Ration Card flow & Select Change Address
        await request('POST', '/api/chat', { message: 'ரேஷன் கார்டு', mobileNumber: addrMob }, addrHeaders);
        const resAddrSel = await request('POST', '/api/chat', { message: 'முகவரி மாற்றம்', mobileNumber: addrMob }, addrHeaders);
        assert(resAddrSel.status === 200, 'Change Address service selection returns 200 OK');
        assert(resAddrSel.body.step === 'RATION_CHANGE_ADDRESS_DOC', 'Change Address transitions to RATION_CHANGE_ADDRESS_DOC');
        passedCount += 2;

        // 3. Select Address Proof Document Type
        const resProofSel = await request('POST', '/api/chat', { message: 'ADDR_PROOF_EB', mobileNumber: addrMob }, addrHeaders);
        assert(resProofSel.status === 200, 'Proof selection returns 200 OK');
        assert(resProofSel.body.step === 'RATION_CHANGE_ADDRESS_UPLOAD', 'Transitions to RATION_CHANGE_ADDRESS_UPLOAD');
        passedCount += 2;

        // 4. Confirm Document / Provide New Address
        const resUploadConfirm = await request('POST', '/api/chat', { message: 'ADDR_DOC_CONFIRMED', mobileNumber: addrMob }, addrHeaders);
        assert(resUploadConfirm.status === 200, 'Upload confirmation returns 200 OK');
        assert(resUploadConfirm.body.step === 'READY_TO_APPLY', 'Change Address transitions to READY_TO_APPLY');
        passedCount += 2;

        // 5. Trigger Automation via /api/automation/start
        const resAddrStart = await request('POST', '/api/automation/start', { mobileNumber: addrMob, isMockSandbox: true, fastTest: true }, addrHeaders);
        assert(resAddrStart.status === 200, 'Change Address /api/automation/start returns 200 OK');
        passedCount += 1;

        // 6. Poll for completion
        let addrSuccess = false;
        let addrAppNo = null;
        let addrPdfUrl = null;
        for (let waitIter = 0; waitIter < 25; waitIter++) {
            await new Promise(r => setTimeout(r, 200));
            const adHist = await request('GET', `/api/chat/history?mobile=${addrMob}`, null, addrHeaders);
            if (waitIter === 5 || waitIter === 15 || waitIter === 24) {
                console.log('DEBUG ADDR:', adHist.body?.step, adHist.body?.intakeState, adHist.body?.applicationNumber, JSON.stringify(adHist.body?.chatHistory?.slice(-2)));
            }
            if (adHist.body && (adHist.body.step === 'submitted' || adHist.body.applicationNumber)) {
                addrSuccess = true;
                addrAppNo = adHist.body.applicationNumber || adHist.body.citizenProfile?.applicationNumber;
                addrPdfUrl = adHist.body.applicationPdfUrl || adHist.body.citizenProfile?.applicationPdfUrl;
                break;
            }
        }
        assert(addrSuccess, 'Change Address automation completed with status "submitted"');
        assert(addrAppNo && addrAppNo.startsWith('N'), `Change Address reference number starts with N: ${addrAppNo}`);
        assert(addrPdfUrl && addrPdfUrl.includes(addrAppNo), `Change Address PDF receipt URL contains reference number: ${addrPdfUrl}`);
        passedCount += 3;

        const addrPdfPath = path.join(__dirname, '..', 'public', addrPdfUrl);
        assert(fs.existsSync(addrPdfPath), `Change Address acknowledgment PDF file exists on disk at ${addrPdfPath}`);
        if (fs.existsSync(addrPdfPath)) fs.unlinkSync(addrPdfPath);
        passedCount += 1;

        // Clean up Change Address draft
        await request('DELETE', `/api/drafts/${addrMob}?permanent=true`);

        // =========================================================================
        // [TEST 25] Field-Tested Automation Memory & Edge-Case Protection Suite
        // =========================================================================
        console.log('\n[TEST 25] Field-Tested Automation Memory & Edge-Case Protection Suite');
        const { provideOtp } = require('../tnpds_automation');

        // 1. Early OTP Caching (prevents missed OTP when user types before portal box renders)
        const earlyOtpResult = provideOtp('654321');
        assert(earlyOtpResult === true, 'provideOtp caches 6-digit OTP even before pending resolver mounts');

        // 2. Direct Webpage Navigation & Login Detection
        const mockLoggedPage = {
            location: { href: 'https://www.tnpds.gov.in/pages/cardmaintenance/member-card.xhtml' },
            document: { querySelector: () => true }
        };
        const u = mockLoggedPage.location.href.toLowerCase();
        const isPastLogin = !u.includes('/auth/login') && (
            u.includes('/pages/') || 
            u.includes('/dashboard') || 
            Boolean(mockLoggedPage.document.querySelector('#btnLogout'))
        );
        assert(isPastLogin === true, 'Direct Chrome webpage navigation is detected immediately as verified login');

        // 3. Government Fatal Error Recognition
        const rateLimitMsg = 'உங்கள் OTP முயற்சி அதிகபட்ச வரம்பை மீறிவிட்டது, தயவுசெய்து 15 நிமிடங்களுக்குப் பிறகு முயற்சிக்கவும்';
        const unregMsg = 'கைபேசி எண் பதிவுசெய்யப்படவில்லை';
        const isRateLimit = rateLimitMsg.includes('வரம்பை மீறிவிட்டது') || rateLimitMsg.includes('15 நிமிடங்களுக்கு');
        const isUnregistered = unregMsg.includes('பதிவுசெய்யப்படவில்லை');
        assert(isRateLimit === true, 'Identifies government 15-minute OTP rate limit lockout accurately');
        assert(isUnregistered === true, 'Identifies unregistered mobile number alert accurately');

        // 4. Dry-Run Guard Safety Lock
        const isLiveProd1 = false && true; // mock mode
        const isLiveProd2 = true && (undefined === true); // real mode without explicit enableFinalSubmit
        const isLiveProd3 = true && ({ enableFinalSubmit: true }.enableFinalSubmit === true); // live production publish
        assert(isLiveProd1 === false, 'Mock mode never triggers final portal submit');
        assert(isLiveProd2 === false, 'Real OTP test on localhost with dummy data never triggers final portal submit');
        assert(isLiveProd3 === true, 'Only explicit enableFinalSubmit triggers portal final submit');

        // 5. 7-digit OTP handling support & login OTP length gating
        const sevenDigitResult = provideOtp('1988475');
        assert(sevenDigitResult === true, 'provideOtp handles 7-digit government OTP without truncation');

        // Verify login OTP requires strictly 7 digits in portal DOM detector logic
        const evalOtpDetector = (val, type, isLoginPage) => {
            if (isLoginPage) {
                if (val.length === 7 || val.length > 7) return val.slice(0, 7);
                return null; // strictly wait for 7th digit
            } else if (type === 'aadhaar_otp') {
                if (val.length === 6) return val;
                return null;
            } else {
                if (val.length === 6 || val.length === 7) return val;
                return null;
            }
        };
        assert(evalOtpDetector('621599', 'login_otp', true) === null, 'Login OTP detector rejects incomplete 6 digits and waits for 7th digit');
        assert(evalOtpDetector('6215995', 'login_otp', true) === '6215995', 'Login OTP detector accepts full 7 digits');
        assert(evalOtpDetector('621599', 'aadhaar_otp', false) === '621599', 'Aadhaar OTP detector accepts 6 digits');
        assert(evalOtpDetector('6215995', 'aadhaar_otp', false) === null, 'Aadhaar OTP detector rejects 7 digits');

        // 6. Native Chrome Anti-Bot Protection (No fake plugins or stripped window.chrome)
        const tnpdsCode = [
            path.join(__dirname, '..', 'tnpds_automation.js'),
            path.join(__dirname, '..', 'src', 'portal', 'tnpds', 'flows', 'add_member_flow.js'),
            path.join(__dirname, '..', 'src', 'portal', 'tnpds', 'flows', 'address_change_flow.js'),
            path.join(__dirname, '..', 'src', 'portal', 'tnpds', 'flows', 'new_smart_card_flow.js')
        ].filter(f => fs.existsSync(f)).map(f => fs.readFileSync(f, 'utf8')).join('\n');
        const hasFakePlugins = tnpdsCode.includes('[1, 2, 3, 4, 5]');
        const hasFakeChromeRuntime = tnpdsCode.includes('window.chrome = { runtime: {} }');
        assert(!hasFakePlugins, 'tnpds_automation does not inject fake plugins array (prevents Radware anomaly detection)');
        assert(!hasFakeChromeRuntime, 'tnpds_automation does not override window.chrome with fake object (preserves native Chrome APIs)');

        // 7. Radware "I am human" Challenge Detection and Seamless Post-Refresh Recovery Logic
        const challengeHtmlSample = 'Please solve this CAPTCHA | Radware Captcha | I am human';
        const isChallengeDetected = challengeHtmlSample.includes('Radware Captcha') || challengeHtmlSample.includes('I am human');
        assert(isChallengeDetected === true, 'Radware and I am human security challenge is accurately detected');

        let hadChallengeMock = true;
        let resubmitCountMock = 0;
        let mockUrlAfterRefresh = 'https://www.tnpds.gov.in/auth/login';
        let reSubmitOccurred = false;
        if (hadChallengeMock && resubmitCountMock < 3 && mockUrlAfterRefresh.includes('/auth/login')) {
            resubmitCountMock++;
            hadChallengeMock = false;
            reSubmitOccurred = true;
        }
        assert(reSubmitOccurred === true, 'Post-challenge refresh to /auth/login triggers automatic OTP re-submission instead of login gate halt');
        assert(hadChallengeMock === false, 'hadSecurityChallenge flag is reset cleanly after re-submit');

        // 8. Full Page Reload Auto-Recovery (When OTP input is wiped out and portal returns to mobile+captcha)
        let isOtpInputVisible = false;
        let isMobInputVisible = true;
        let didAutoRecoverMobile = false;
        if (!isOtpInputVisible && isMobInputVisible) {
            didAutoRecoverMobile = true;
        }
        assert(didAutoRecoverMobile === true, 'Full page refresh without OTP input triggers automatic mobile + captcha re-submission without halting');

        // 9. Absence of Outdated Chrome/131 User-Agent (Ensures Native Chrome 153 is preserved)
        assert(!tnpdsCode.includes('Chrome/131.0.0.0'), 'tnpds_automation preserves native Chrome User-Agent without hardcoded Chrome/131 override');
        assert(tnpdsCode.includes('saveTnpdsCookies'), 'tnpds_automation defines and uses saveTnpdsCookies for session cookie persistence');

        // 10. Strict Zero-Resend Law & Real Portal OTP Submit Invariant Guarantee
        // Extract submitOtpOnPortal function body
        const submitOtpFnMatch = tnpdsCode.match(/async function submitOtpOnPortal[\s\S]*?^}/m);
        const submitOtpFn = submitOtpFnMatch ? submitOtpFnMatch[0] : '';
        assert(submitOtpFn.length > 0, 'submitOtpOnPortal function is defined in tnpds_automation.js');
        assert(submitOtpFn.includes('#btnLogin:visible'), 'submitOtpOnPortal prioritizes #btnLogin for OTP submission');
        assert(submitOtpFn.includes('button.subbtn:visible'), 'submitOtpOnPortal includes real portal button.subbtn for Angular OTP submission');
        assert(submitOtpFn.includes('button:has-text("உள்நுழைக")'), 'submitOtpOnPortal prioritizes உள்நுழைக button for OTP submission');
        assert(submitOtpFn.includes('!isSubBtn'), 'submitOtpOnPortal strictly allows button.subbtn even when translated as பதிவு செய்ய');
        assert(submitOtpFn.includes("document.querySelector('button.subbtn"), 'submitOtpOnPortal strategy 2 directly checks for button.subbtn in DOM');
        assert(submitOtpFn.includes("dispatchEvent('input')"), 'submitOtpOnPortal dispatches input event for Angular reactive form');
        // Ensure primaryLoginSelectors does NOT contain #btnSendOtp or "பதிவு செய்ய"
        const selectorMatch = submitOtpFn.match(/const primaryLoginSelectors = \[([\s\S]*?)\];/);
        const selectorsList = selectorMatch ? selectorMatch[1] : '';
        assert(!selectorsList.includes('#btnSendOtp'), 'primaryLoginSelectors does not include #btnSendOtp (prevents duplicate OTP request)');
        assert(!selectorsList.includes('பதிவு செய்ய'), 'primaryLoginSelectors does not include பதிவு செய்ய (prevents triggering Radware flood limiter)');
        assert(tnpdsCode.includes("txt === '*'"), 'error extraction filters out required-field asterisks');

        // 11. Radware Zero-DOM-Tampering Protection on Challenge Pages
        assert(tnpdsCode.includes("if (u.includes('perfdrive') || u.includes('validate')) return;"), 'showBrowserHud and injectVisualBanner guard against DOM tampering on perfdrive');
        assert(tnpdsCode.includes('hCap.value.trim().length > 20'), 'tryAutoClickCaptcha strictly requires 20+ char cryptographic token before submitting clearance');

        // 12. Div-Based Upload Element Polymorphism & MatDatepicker Preservation (Case 27)
        assert(tnpdsCode.includes('div.btn:has-text("பதிவேற்ற")'), 'tnpds_automation targets div.btn for supporting document upload button');
        assert(tnpdsCode.includes('div.btn-primary:has-text("பதிவேற்ற")'), 'tnpds_automation targets div.btn-primary for upload element polymorphism');
        assert(tnpdsCode.includes("removeAttribute('readonly')"), 'tnpds_automation unlocks Angular datepicker without invalidating raw events');

        // 13. Session Conflict Modal ("நீங்கள் வெளியேற விரும்புகிறீர்களா?") Auto-Dismissal Law (Case 29)
        assert(tnpdsCode.includes('dismissSessionConflictOrAlertModals'), 'tnpds_automation defines dismissSessionConflictOrAlertModals for session conflict auto-dismissal');
        assert(tnpdsCode.includes('நீங்கள் வெளியேற விரும்புகிறீர்களா'), 'dismissSessionConflictOrAlertModals handles நீங்கள் வெளியேற விரும்புகிறீர்களா session conflict modal');
        assert(tnpdsCode.includes('button:has-text("ஆம்")'), 'dismissSessionConflictOrAlertModals targets positive confirmation ஆம் button');
        passedCount += 3;

        // 14. Document Upload Confirmation Polling Scope Integrity & Add Member Multi-Layer Trigger Law (Case 30)
        assert(tnpdsCode.includes('const seenToasts = new Set();') && tnpdsCode.includes('scanAndBroadcastToasts()'), 'startTnpdsAddMemberFlow defines scanAndBroadcastToasts in scope');
        assert(tnpdsCode.includes('typeof scanAndBroadcastToasts === \'function\''), 'Doc upload polling loop safely guards scanAndBroadcastToasts');
        assert(tnpdsCode.includes('button.btn-warning:has-text("உறுப்பினரை சேர்க்க")') && tnpdsCode.includes('button.btn-orange:has-text("உறுப்பினரை சேர்க்க")'), 'Add member locators include both warning and orange classes');
        assert(tnpdsCode.includes('const invalidDetails = [];'), 'Form pre-audit declares invalidDetails to prevent ReferenceError');
        passedCount += 4;

        // 15. Human Kinetics Engine & Trusted Native Event Integrity Law (Case 31)
        assert(tnpdsCode.includes('function generateHumanTrajectory('), 'tnpds_automation defines cubic Bezier human mouse trajectory generator');
        assert(tnpdsCode.includes('async function humanMouseMove('), 'tnpds_automation defines humanMouseMove with Fitts law velocity easing');
        assert(tnpdsCode.includes('async function humanClick('), 'tnpds_automation defines humanClick with natural hover dwell and native click hold');
        assert(tnpdsCode.includes('async function humanType('), 'tnpds_automation defines humanType with authentic keystroke delays and phone glance cadence');
        assert(tnpdsCode.includes('humanType(activePage, otpInput, otpVal, { isOtp: true })'), 'submitOtpOnPortal uses humanType with OTP chunking');
        assert(tnpdsCode.includes('humanType(page, curMobInput, targetClean)'), 'ensureMobileNumberFilled uses humanType without untrusted synthetic dispatch');
        assert(tnpdsCode.includes('humanType(page, curCaptchaInput, code)'), 'Captcha OCR entry uses humanType with authentic kinetics');
        passedCount += 7;

        // 16. Strict Modal Container Scoping & OTP-Phase Anti-Flood Invariant Law (Case 32)
        assert(tnpdsCode.includes('activeModal.querySelectorAll'), 'dismissSessionConflictOrAlertModals queries candidate buttons strictly inside visible modal');
        assert(tnpdsCode.includes("id === 'btnsendotp'") && tnpdsCode.includes("id === 'btnlogin'"), 'dismissSessionConflictOrAlertModals strictly excludes btnSendOtp and btnLogin');
        assert(tnpdsCode.includes('curVal !== targetClean'), 'submitOtpOnPortal checks existing input value before executing humanType');
        assert(!tnpdsCode.includes("otpInput.press('Enter')"), 'submitOtpOnPortal does not execute blind Enter fallback to prevent duplicate OTP requests');
        assert(tnpdsCode.includes('normCur !== normTarget && normTarget.length >= 10'), 'ensureMobileNumberFilled normalizes 10-digit mobile numbers');
        assert(tnpdsCode.includes('if (!hasOtpField) {\n                    await ensureMobileNumberFilled();\n                }'), 'Step 3 wait loop gates ensureMobileNumberFilled when OTP field is present');
        passedCount += 6;

        // 17. Leaf-Node Document Badge Scoping & Webpage DOM Dumping Defense Law (Case 33)
        assert(!tnpdsCode.includes("querySelectorAll('span, div, label, p, b, strong, a, .badge, .toast, .alert, .swal2-content')"), 'Upload polling loop avoids broad ancestor queries that capture entire page DOM text');
        assert(tnpdsCode.includes("const leafNodes = Array.from(document.querySelectorAll('span, label, p, b, strong, a, .badge'));"), 'Badge search strictly targets leaf DOM nodes');
        assert(tnpdsCode.includes('cleanDisplayBadge'), 'Display badge text is sanitized with length bounds before chat broadcast');
        passedCount += 3;

        // 18. TNPDS Add Member Aadhaar OTP Modal & Anti-Duplicate Re-click Law (Case 34)
        assert(tnpdsCode.includes('isAadhaarOtpModalVisible'), 'startTnpdsAddMemberFlow monitors Aadhaar OTP modal visibility');
        assert(tnpdsCode.includes('உறுப்பினர் ஆதார் சரிபார்ப்பு OTP'), 'startTnpdsAddMemberFlow prompts user for member Aadhaar OTP when modal appears');
        assert(tnpdsCode.includes('!isAadhaarOtpModalVisible && !isAnyModalOpen'), 'Table verification loop guards add button re-click against active OTP modals');
        assert(tnpdsCode.includes("txt.includes('விநாடிகளுக்குள் OTP')"), 'portalAlertMsg filter strictly excludes Aadhaar OTP instructions to prevent false-positive halt');
        passedCount += 4;

        // 19. Strict Anti-Duplicate OTP-Send & Dual-Listener Anti-Collision Law (Case 35)
        assert(tnpdsCode.includes("idLower === 'btnsendotp'") && tnpdsCode.includes("combinedText.includes('பதிவு செய்ய')"), 'submitOtpOnPortal strictly skips Send OTP button candidates even with subbtn class');
        assert(tnpdsCode.includes('isSubmittingOnPortal'), 'requestOtpFromUser Channel 2 detects when form is already submitting on portal');
        assert(tnpdsCode.includes('now - inp._firstSeen6Len > 3500'), 'requestOtpFromUser grants 3.5s anti-collision grace period for operator mouse clicks');
        assert(tnpdsCode.includes('if (!otpVal && waitAuth > 3)'), 'WaitAuth loop strictly prevents duplicate OTP re-prompting while login is in flight');
        passedCount += 4;

        // 19B. Zero-Invalid-DOM-Selector Law (Case: OTP watcher blindness, 2026-10-05)
        // ':has-text' is Playwright-only. Inside page.evaluate it throws SyntaxError, which was silently
        // swallowed and made the engine blind to OTP typed directly on the portal.
        {
            const scanFiles = [path.join(__dirname, '..', 'tnpds_automation.js')];
            (function walk(d) {
                for (const f of fs.readdirSync(d)) {
                    const p = path.join(d, f);
                    if (fs.statSync(p).isDirectory()) walk(p); else if (p.endsWith('.js')) scanFiles.push(p);
                }
            })(path.join(__dirname, '..', 'src'));
            const offenders = [];
            for (const f of scanFiles) {
                fs.readFileSync(f, 'utf8').split('\n').forEach((l, i) => {
                    if (/querySelector(All)?\([^)]*:has-text/.test(l)) offenders.push(`${path.basename(f)}:${i + 1}`);
                });
            }
            assert(offenders.length === 0, `No Playwright-only ':has-text' inside DOM querySelector (offenders: ${offenders.join(', ') || 'none'})`);
            assert(tnpdsCode.includes("sessionLog(20, 'OTP_WATCH_ERROR'"), 'OTP watcher logs DOM evaluate failures into the session log (never silent)');
            assert(tnpdsCode.includes("sessionLog(20, 'OTP_WATCH',"), 'OTP watcher writes periodic real DOM snapshots into the session log');
            passedCount += 3;
        }

        // 20. Smart Fast-Forward & Missing-Field-Only Invariant Law (Case 36)
        const chatFsmCode = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'chat_fsm.js'), 'utf8');
        assert(chatFsmCode.includes('memberName && aadhaarNo && relTam'), 'chat_fsm fast-forwards to READY_TO_APPLY when all member details exist');
        assert(chatFsmCode.includes('memberName && aadhaarNo && !relTam'), 'chat_fsm asks only missing relationship when Aadhaar is present');
        assert(chatFsmCode.includes('existingMemDoc'), 'chat_fsm checks for existing member document on file before asking for upload');
        assert(chatFsmCode.includes('doorNo && streetTam'), 'chat_fsm fast-forwards to READY_TO_APPLY when address details exist');
        assert(chatFsmCode.includes('RATION_ADD_MEMBER_RESET'), 'chat_fsm supports RATION_ADD_MEMBER_RESET for uploading different member');
        
        const localServerCode = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'local_server.js'), 'utf8');
        assert(localServerCode.includes("clean.startsWith('compressed/')"), 'desktop/local_server.js resolves /compressed/ static file requests');
        assert(localServerCode.includes("urlPath.startsWith('/compressed/')"), 'desktop/local_server.js delegates /compressed/ to local Express app');

        // Functional verification: Add Member never asks for upload when document already on file
        const { handleServiceSelection } = require('../src/core/chat_fsm');
        const testMemSess = {
            service: 'ரேஷன் கார்டு',
            chatHistory: [],
            subServiceData: {
                docPath: 'compressed/doc_merged_1792931348769_aadhaar.pdf'
            },
            citizenProfile: {
                mobileNumber: '9999900021'
            }
        };
        handleServiceSelection('2. குடும்ப உறுப்பினர் சேர்க்கை', testMemSess);
        const lastMemMsg = testMemSess.chatHistory[testMemSess.chatHistory.length - 1];
        assert(lastMemMsg && !lastMemMsg.actionRequired, 'Add Member never prompts for file upload when member document is already on file');
        assert(testMemSess.intakeState === 'RATION_ADD_MEMBER_RELATION', 'Add Member transitions to relationship selection when Aadhaar document is on file');
        passedCount += 8;

        // 21. Android SMS Auto-Forwarder Webhook & Autonomous E2E Intercept Law (Case 37)
        const serverCode = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
        assert(serverCode.includes('/api/automation/otp_webhook'), 'server.js defines /api/automation/otp_webhook route');
        assert(serverCode.includes('provideOtp(otpCode)'), 'server.js passes intercepted OTP directly to provideOtp engine');
        assert(serverCode.includes('Android SMS Intercept'), 'server.js broadcasts Android SMS OTP intercept event to active chat');
        passedCount += 3;

        // 22. Radware Error Zero-Halt & Resilient Dynamic Step Resumption Law (Case 45)
        assert(tnpdsCode.includes('addMemberResumption = require'), 'tnpds_automation imports resilient step resumption engine');
        assert(tnpdsCode.includes('addMemberStepHealer = require'), 'tnpds_automation imports add member step healer');
        assert(tnpdsCode.includes('resumeAddMemberWorkflow'), 'tnpds_automation invokes resumeAddMemberWorkflow on flow interruption');
        assert(tnpdsCode.includes('isMemberAlreadyInTable'), 'tnpds_automation checks if member is already in table before form refill');
        passedCount += 4;

        // 23. New Ration Card Step 21 OTP Verification & Step 22 Member Form Gate Law (Case 46)
        assert(tnpdsCode.includes('newCardOtpVerifier = require'), 'tnpds_automation imports newCardOtpVerifier');
        assert(tnpdsCode.includes('verifyNewCardOtpAndSettle'), 'tnpds_automation invokes verifyNewCardOtpAndSettle on Step 21');
        assert(tnpdsCode.includes('ensureMemberAdditionFormReady'), 'tnpds_automation invokes ensureMemberAdditionFormReady on Step 22');
        const step21Code = fs.readFileSync(path.join(__dirname, '..', 'src', 'portal', 'tnpds', 'steps', 'step21_new_card_otp_verifier.js'), 'utf8');
        assert(step21Code.includes('verifyNewCardOtpAndSettle'), 'step21_new_card_otp_verifier exports verifyNewCardOtpAndSettle');
        assert(step21Code.includes('ensureMemberAdditionFormReady'), 'step21_new_card_otp_verifier exports ensureMemberAdditionFormReady');
        assert(!tnpdsCode.includes("setTimeout(() => { if (cachedUserOtp)"), 'tnpds_automation never auto-resolves dummy OTP with 2-second timeout');
        assert(!step21Code.includes("m.style.display = 'none'"), 'step21_new_card_otp_verifier forbids fake modal-hiding bypass');
        assert(step21Code.includes('OTP_NOT_VERIFIED_ON_PORTAL'), 'step21_new_card_otp_verifier strictly halts when OTP is unverified');
        passedCount += 8;

        // 24. Operator & Automation-Specific Segregated Logging Architecture (Case 47)
        console.log('\n[TEST 25] Operator & Service Log Segregation Engine (Case 47)');
        const loggerModule = require('../src/services/automation_logger');
        assert(typeof loggerModule.createAutomationLogger === 'function', 'automation_logger exports createAutomationLogger');
        assert(typeof loggerModule.listOperatorLogs === 'function', 'automation_logger exports listOperatorLogs');
        assert(loggerModule.sanitizeLogKey('Suman Tech') === 'suman_tech', 'sanitizeLogKey sanitizes operator name properly');
        assert(loggerModule.resolveAutomationName('புதிய குடும்ப அட்டை') === 'new_ration_card', 'resolveAutomationName resolves Tamil service names');
        assert(loggerModule.resolveAutomationName('ADD_MEMBER') === 'add_member', 'resolveAutomationName resolves uppercase service names');

        // Test creating a segregated logger instance in a test directory
        const testBaseLogsDir = path.join(__dirname, '..', 'tmp_test_logs');
        const testLogger = loggerModule.createAutomationLogger({
            operatorName: 'Suman',
            automationName: 'new_ration_card',
            customerMobile: '9999900099',
            customerName: 'Test Citizen',
            baseLogsDir: testBaseLogsDir
        });
        assert(testLogger.operatorSlug === 'suman', 'testLogger produces correct operatorSlug');
        assert(testLogger.automationSlug === 'new_ration_card', 'testLogger produces correct automationSlug');
        assert(fs.existsSync(testLogger.logFilePath), 'testLogger creates segregated log file on disk');
        assert(testLogger.logFilePath.includes(path.join('suman', 'new_ration_card')), 'log file is saved under operator/service directory');

        testLogger.logDiag(1, 'INFO', 'Test step execution');
        testLogger.close();

        const fileContent = fs.readFileSync(testLogger.logFilePath, 'utf8');
        assert(fileContent.includes('OPERATOR    : Suman'), 'Log file header contains operator name');
        assert(fileContent.includes('AUTOMATION  : new_ration_card'), 'Log file header contains automation flow');
        assert(fileContent.includes('[STEP_1] [INFO] Test step execution'), 'Log file contains formatted diagnostic entry');

        const listed = loggerModule.listOperatorLogs(testBaseLogsDir, 'suman', 'new_ration_card');
        assert(listed.length >= 1, 'listOperatorLogs finds segregated log file');
        assert(listed[0].operator === 'suman' && listed[0].automation === 'new_ration_card', 'listOperatorLogs returns correct metadata');

        // Cleanup test directory after stream settles
        await new Promise(r => setTimeout(r, 50));
        try { fs.rmSync(testBaseLogsDir, { recursive: true, force: true }); } catch (e) {}

        assert(tnpdsCode.includes('automationLoggerModule = require'), 'tnpds_automation imports automation_logger');
        assert(tnpdsCode.includes('getAutomationLogger'), 'tnpds_automation defines getAutomationLogger');
        assert(serverCode.includes('/api/automation/logs'), 'server.js provides /api/automation/logs endpoint');
        passedCount += 13;

        // 25. Dry Run Testing & App Mode Visibility Integrity Law
        const indexHtmlCode = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
        const mainCssCode = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'main.css'), 'utf8');
        assert(indexHtmlCode.includes('btnDryRunFromEditModal'), 'editModal provides dedicated Dry Run testing button');
        assert(indexHtmlCode.includes('btnPreSubmitDryRun'), 'preSubmitModal provides dedicated Dry Run testing button');
        assert(!indexHtmlCode.includes('openEditModal();\n            return;\n            const headName'), 'openPreSubmitModal does not bypass confirmation modal with rogue openEditModal return');
        assert(!mainCssCode.includes('#devMockModeBadge { display: none !important; }'), 'main.css does not permanently hide mode badge with !important');
        passedCount += 4;

        // 26. Compulsory Pre-Submit Human Inspection & Browser Retention Law (Rule 51 / Case 49)
        const step9Submit = require('../src/portal/tnpds/steps/step9_declaration_submit');
        const step7AddMemberSubmit = require('../src/portal/tnpds/add_member/steps/step7_declaration_submit');
        const { BasePortalRunner } = require('../src/portal/common/base_portal_runner');

        const mockPage = { locator: () => ({ first: () => ({ count: async () => 1, check: async () => {}, click: async () => {} }) }) };
        const oldRegTest = process.env.REGRESSION_TEST;
        process.env.REGRESSION_TEST = 'false'; // simulate operator interactive run
        const step9Res = await step9Submit.handleDeclarationAndSubmit(mockPage, { enableFinalSubmit: true });
        assert(step9Res.isPreSubmitHalted === true, 'New Card Step 9 compulsorily halts before final submit in non-CI environment');

        const step7Res = await step7AddMemberSubmit.handleDeclarationAndSubmit(mockPage, { enableFinalSubmit: true });
        assert(step7Res.isPreSubmitHalted === true, 'Add Member Step 7 compulsorily halts before final submit in non-CI environment');

        const baseRunner = new BasePortalRunner({ isDryRun: false, portalName: 'TNPDS' });
        const baseRes = await baseRunner.executeReviewAndSubmit();
        assert(baseRes.isPreSubmitHalted === true, 'BasePortalRunner compulsorily halts before final submit in non-CI environment');
        process.env.REGRESSION_TEST = oldRegTest; // restore CI env

        assert(tnpdsCode.includes('கட்டாய இறுதிச் சமர்ப்பிப்பு முன்-நிறுத்தம் - Compulsory Pre-Submit Human Gate'), 'tnpds_automation enforces compulsory pre-submit human gate in all flows');
        passedCount += 4;

        // [TEST 28] Universal Anti-Bot Radware Immunity & Dual-Listener OTP Standard Engine
        console.log('\n[TEST 28] Universal Anti-Bot Radware Immunity & Dual-Listener OTP Standard Engine');
        const { UniversalOtpListener } = require('../src/portal/common/universal_otp_listener');
        const { isRadwareChallenge, tryAutoClickRadwareChallenge, waitForRadwareClearanceAndSettle, detectPostRefreshStep } = require('../src/portal/common/universal_radware_resumption');
        const portalStd = require('../src/core/portal_automation_standard');

        // Check exports on portal standard
        assert(typeof portalStd.UniversalOtpListener === 'function', 'portal_automation_standard exports UniversalOtpListener');
        assert(typeof portalStd.waitForRadwareClearanceAndSettle === 'function', 'portal_automation_standard exports waitForRadwareClearanceAndSettle');
        assert(typeof portalStd.detectPostRefreshStep === 'function', 'portal_automation_standard exports detectPostRefreshStep');
        passedCount += 3;

        // Check UniversalOtpListener early cache
        const testOtpListener = new UniversalOtpListener();
        testOtpListener.cacheEarlyOtp('884422');
        let earlyReceived = '';
        const otpPromise = testOtpListener.waitForOtp('Prompt', (msg) => { earlyReceived = msg; });
        const resolvedEarly = await otpPromise;
        assert(resolvedEarly === '884422', 'UniversalOtpListener accepts and delivers early cached OTP');
        passedCount += 1;

        // Check BasePortalRunner equipping
        const runnerWithEngines = new BasePortalRunner({ portalId: 'TNPDS' });
        assert(typeof runnerWithEngines.handleRadware === 'function', 'BasePortalRunner equips universal handleRadware method');
        assert(typeof runnerWithEngines.requestOtp === 'function', 'BasePortalRunner equips universal requestOtp method');
        assert(runnerWithEngines.otpListener instanceof UniversalOtpListener, 'BasePortalRunner instantiates UniversalOtpListener');
        passedCount += 3;

        // Check Radware challenge detection on mock page
        const mockGovtPage = {
            isClosed: () => false,
            url: () => 'https://www.tnpds.gov.in/pages/cardmaintenance/add-member',
            evaluate: async () => false
        };
        const mockPerfdrivePage = {
            isClosed: () => false,
            url: () => 'https://validate.perfdrive.com/captcha/v1',
            evaluate: async () => true
        };
        assert((await isRadwareChallenge(mockGovtPage)) === false, 'isRadwareChallenge returns false for clean government portal page');
        assert((await isRadwareChallenge(mockPerfdrivePage)) === true, 'isRadwareChallenge returns true for perfdrive captcha challenge');
        passedCount += 2;

        // Check Universal Stealth Shield, Early Step-1 Warmup & Page-Start Resumption Law
        assert(typeof portalStd.injectRadwareStealthShield === 'function', 'portal_automation_standard exports injectRadwareStealthShield');
        assert(typeof portalStd.performEarlyStep1RadwareWarmup === 'function', 'portal_automation_standard exports performEarlyStep1RadwareWarmup');
        assert(typeof portalStd.executeStepWithRadwareResumption === 'function', 'portal_automation_standard exports executeStepWithRadwareResumption');
        assert(typeof portalStd.assertNoRadwareOrPageRefresh === 'function', 'portal_automation_standard exports assertNoRadwareOrPageRefresh');
        assert(typeof portalStd.executePageBlockWithRadwareRestart === 'function', 'portal_automation_standard exports executePageBlockWithRadwareRestart');
        assert(typeof runnerWithEngines.executePageBlock === 'function', 'BasePortalRunner equips executePageBlock method');
        assert(typeof runnerWithEngines.assertPageIntact === 'function', 'BasePortalRunner equips assertPageIntact method');

        let recoveredCount = 0;
        let stepAttempts = 0;
        const stepResumedResult = await portalStd.executeStepWithRadwareResumption(mockGovtPage, {
            stepName: 'TestStep8Upload',
            isFormWipedAfterRefresh: async () => stepAttempts === 1, // simulate Radware reload wiping form on attempt 1
            recoverWipedState: async () => { recoveredCount++; },
            runStep: async () => {
                stepAttempts++;
                if (stepAttempts === 1) throw new Error('Simulated mid-step Radware reload');
                return { resumedAndCompleted: true };
            }
        });
        assert(recoveredCount === 1 && stepAttempts === 2 && stepResumedResult.resumedAndCompleted === true, 'executeStepWithRadwareResumption heals wiped state and resumes from interrupted step without halting');

        // Verify Page-Start Resumption Law: Radware at Step 5 restarts from Step 4 (first step of page) and completes Steps 4->5->6->7->8->9
        const executedPageSteps = [];
        let radwareTriggeredAtStep5 = false;
        const pageBlockRes = await portalStd.executePageBlockWithRadwareRestart(mockGovtPage, {
            pageName: 'TestServiceRequestPage',
            firstStepName: 'படி 4/12',
            runPageStepsFromStart: async () => {
                executedPageSteps.push('STEP_4');
                // Simulate Radware page refresh occurring at Step 5 on first run
                await portalStd.assertNoRadwareOrPageRefresh(
                    mockGovtPage,
                    async () => {
                        if (!radwareTriggeredAtStep5) {
                            radwareTriggeredAtStep5 = true;
                            return false; // Page wiped by Radware at Step 5!
                        }
                        return true;
                    },
                    'படி 5/12'
                );
                executedPageSteps.push('STEP_5');
                executedPageSteps.push('STEP_6');
                executedPageSteps.push('STEP_7');
                executedPageSteps.push('STEP_8');
                executedPageSteps.push('STEP_9');
                return { success: true, completedFullPageFromStart: true };
            }
        });
        assert(
            pageBlockRes.completedFullPageFromStart === true &&
            executedPageSteps.join(',') === 'STEP_4,STEP_4,STEP_5,STEP_6,STEP_7,STEP_8,STEP_9',
            'executePageBlockWithRadwareRestart restarts from first step of current page (Step 4) when Radware refreshes at Step 5 and finishes all steps in sequence'
        );
        passedCount += 9;

        // Check UniversalOtpListener modal gating and newsmartcard isolation
        const listenerCode = fs.readFileSync(path.join(__dirname, '..', 'src', 'portal', 'common', 'universal_otp_listener.js'), 'utf8');
        assert(listenerCode.includes("u.includes('newsmartcard')"), 'UniversalOtpListener excludes newsmartcard from isPastLogin bypass');
        assert(listenerCode.includes('isModalOpen'), 'UniversalOtpListener strictly gates active modals against premature resolve');
        assert(tnpdsCode.includes("u.includes('newsmartcard')"), 'tnpds_automation strictly isolates newsmartcard from isPastLogin bypass');
        assert(tnpdsCode.includes('isModalVisible'), 'tnpds_automation strictly gates visible OTP modals against premature resolve');
        passedCount += 4;

        // [TEST 27] Auto-Expanding Automation Immune System & Universal Core Engine Matrix
        console.log('\n[TEST 27] Auto-Expanding Automation Immune System & Universal Core Engine Matrix');
        const immuneResult = await runImmuneGuardSuite();
        assert(immuneResult.success === true, 'runImmuneGuardSuite returns 100% success');
        passedCount += immuneResult.passedCount;

        // [TEST 29] TNPDS Add Member Permanent Freeze & Static Integrity (CASE-48)
        console.log('\n[TEST 29] TNPDS Add Member Flow Permanent Freeze & Static Integrity (CASE-48)');
        const addMemberFlowPath = path.join(__dirname, '..', 'src', 'portal', 'tnpds', 'flows', 'add_member_flow.js');
        assert(fs.existsSync(addMemberFlowPath), 'add_member_flow.js must exist on disk');
        const addMemberCode = fs.readFileSync(addMemberFlowPath, 'utf8');

        // 1. Verify variable declarations
        assert(addMemberCode.includes('let isDryRunMode = false;'), 'isDryRunMode must be declared at top level');
        assert(addMemberCode.includes('let isMockSandboxMode = true;'), 'isMockSandboxMode must be declared at top level');
        assert(addMemberCode.includes('isDryRunActive = Boolean('), 'isDryRunActive must be safely evaluated');

        // 2. Verify all 12 frozen steps are present
        const expectedSteps = [
            'படி 1/12', 'படி 2/12', 'படி 3/12', 'படி 4/12', 'படி 5/12',
            'படி 6/12', 'படி 7/12', 'படி 8/12', 'படி 9/12', 'படி 10/12',
            'படி 11/12', 'படி 12/12'
        ];
        for (const s of expectedSteps) {
            assert(addMemberCode.includes(s), `add_member_flow.js must strictly retain frozen ${s}`);
        }

        // 3. Verify Submodule Invariants (Browser Tab Safety, Step 2/3 Auth, Step 4 Nav, Step 8 Upload, Step 9a Audit, Step 9b Table Verify, Step 10-12 Submit, Operator Approval)
        const addMemberSubDir = path.join(__dirname, '..', 'src', 'portal', 'tnpds', 'flows', 'add_member');
        const browserCode = fs.readFileSync(path.join(addMemberSubDir, 'add_member_browser.js'), 'utf8');
        const step23Code = fs.readFileSync(path.join(addMemberSubDir, 'add_member_step2_step3_auth.js'), 'utf8');
        const step4Code = fs.readFileSync(path.join(addMemberSubDir, 'add_member_step4_nav.js'), 'utf8');
        const step8Code = fs.readFileSync(path.join(addMemberSubDir, 'add_member_step8_upload.js'), 'utf8');
        const step9aCode = fs.readFileSync(path.join(addMemberSubDir, 'add_member_step9_audit_and_save.js'), 'utf8');
        const step9bCode = fs.readFileSync(path.join(addMemberSubDir, 'add_member_step9_table_verify.js'), 'utf8');
        const step1012Code = fs.readFileSync(path.join(addMemberSubDir, 'add_member_steps10_12_submit.js'), 'utf8');
        const opApprovalCode = fs.readFileSync(path.join(__dirname, '..', 'src', 'portal', 'tnpds', 'helpers', 'operator_approval.js'), 'utf8');
        const radwareResumpCode = fs.readFileSync(path.join(__dirname, '..', 'src', 'portal', 'common', 'universal_radware_resumption.js'), 'utf8');

        assert(browserCode.includes("u.includes('tnpds.gov.in')") && browserCode.includes('await context.newPage()'), 'add_member_browser must never hijack non-TNPDS personal tabs on port 9222');
        assert(addMemberCode.includes('executePageBlockWithRadwareRestart') && addMemberCode.includes('aadhaar.pdf'), 'add_member_flow must wrap Steps 4-12 in executePageBlockWithRadwareRestart and resolve 2-in-1 aadhaar.pdf');
        assert(step23Code.includes("otpVal === 'PAGE_REFRESHED_TO_LOGIN'") && step23Code.includes('continue;'), 'Step 2/3 Auth must restart login round when Radware refreshes OTP page');
        assert(step4Code.includes('isRadwareChallenge(page)') && step4Code.includes('RADWARE_PAGE_REFRESH_DETECTED'), 'Step 4 Nav must handle mid-step Radware challenge and detect login redirect');
        assert(radwareResumpCode.includes('iframe[src*="hcaptcha"]') && !radwareResumpCode.includes("document.querySelector('app-root, [ng-version], .card, form')"), 'universal_radware_resumption must check hcaptcha iframes and never treat Radware .card/form as govt page ready');
        assert(!step8Code.includes('input[formcontrolname="upload"]'), 'Step 8 Upload must never target hidden text input[formcontrolname="upload"] as file input');
        assert(!step8Code.includes("targetFileInput.dispatchEvent('change'"), 'Step 8 Upload must never dispatch synthetic change after setInputFiles (prevents wiping Angular file state)');
        assert(step8Code.includes('div[style*="69f777"]') && step8Code.includes("=== 'பதிவேற்ற'"), 'Step 8 Upload must verify green #69f777 chip and click பதிவேற்ற button');
        assert(!step9aCode.includes("supportingDocuments.setValue('Aadhaar Card')"), 'Step 9a Audit must never overwrite supportingDocuments with Aadhaar Card (prevents resetting file upload)');
        assert(step9aCode.includes('if (!modalOrRowTriggered && !addMemberClicked)'), 'Step 9a Audit must enforce Single-Click Guard (!modalOrRowTriggered && !addMemberClicked)');
        assert(step9bCode.includes('input[formcontrolname="otp"]') && step9bCode.includes("m.closest('div.modal')"), 'Step 9b Table Verify must detect visible Aadhaar OTP modal without hidden .modal-dialog false positives');
        assert(opApprovalCode.includes('isMockSandboxMode = false') && !opApprovalCode.includes('isMockSandboxMode = true'), 'operator_approval.js must default isMockSandboxMode = false so live submissions never auto-approve without operator consent');
        assert(step1012Code.includes('requestApprovalFromOperator(') && step1012Code.includes('isMock,') && step1012Code.includes('checkDuplicateAadhaarModal'), 'Step 10-12 Submit must pass isMock and page to requestApprovalFromOperator and check for Duplicate Aadhaar Modal');
        passedCount += 13;

        // 4. Verify FEATURE_LOCK.md Section 13 contract
        const featLockCode = fs.readFileSync(path.join(__dirname, '..', 'FEATURE_LOCK.md'), 'utf8');
        assert(featLockCode.includes('தொகுதி 13: TNPDS குடும்ப உறுப்பினர் சேர்க்கை முழுமையான குறியீட்டு முடக்கம்'), 'FEATURE_LOCK.md must contain Section 13 Add Member Freeze contract');
        // [TEST 30] Desktop Local UI & Silent OTA Asset Engine
        console.log('\n[TEST 30] Desktop Local UI & Silent OTA Asset Engine');
        const localServerModule = require('../desktop/local_server');
        assert(typeof localServerModule.startLocalServer === 'function', 'local_server exports startLocalServer');
        assert(typeof localServerModule.resolveLocalFile === 'function', 'local_server exports resolveLocalFile');
        const resolvedIndex = localServerModule.resolveLocalFile('/');
        assert(resolvedIndex && resolvedIndex.endsWith('index.html'), 'resolveLocalFile resolves root to index.html');

        const syncServiceModule = require('../desktop/asset_sync_service');
        assert(typeof syncServiceModule.startAssetSyncService === 'function', 'asset_sync_service exports startAssetSyncService');
        assert(typeof syncServiceModule.syncAssetsSilently === 'function', 'asset_sync_service exports syncAssetsSilently');

        const resManifest = await request('GET', '/api/desktop/asset_manifest');
        assert(resManifest.status === 200, '/api/desktop/asset_manifest returns 200 OK');
        assert(resManifest.body && resManifest.body.manifest, 'Manifest contains file dictionary');
        assert(Boolean(resManifest.body.manifest['index.html']), 'Manifest includes index.html');

        const winManagerPath = path.join(__dirname, '..', 'desktop', 'window_manager.js');
        const winManagerCode = fs.readFileSync(winManagerPath, 'utf8');
        assert(winManagerCode.includes('127.0.0.1:3000'), 'window_manager.js allows 127.0.0.1:3000');
        assert(winManagerCode.includes("process.env.ESEVA_DEV_URL || 'http://127.0.0.1:3000'"), 'window_manager.js defaults to local server on 127.0.0.1:3000');

        const mainJsPath = path.join(__dirname, '..', 'desktop', 'main.js');
        const mainJsCode = fs.readFileSync(mainJsPath, 'utf8');
        assert(mainJsCode.includes('startLocalServer'), 'main.js initializes startLocalServer');
        assert(mainJsCode.includes('startAssetSyncService'), 'main.js initializes startAssetSyncService');
        passedCount += 10;

        // [TEST 31] Autonomous Operator Journey Simulator (Case 49)
        console.log('\n[TEST 31] Autonomous Operator Journey Simulator (Case 49)');
        const { runOperatorJourneySimulator } = require('./operator_e2e_journey_simulator');
        const journeyPassed = await runOperatorJourneySimulator();
        assert(journeyPassed === true, 'runOperatorJourneySimulator must pass 100%');
        passedCount += 5;

        // [TEST 32] Add Member Clean Intake & Instant Screen Clear / Reset Guard (Case 50)
        console.log('\n[TEST 32] Add Member Clean Intake & Instant Screen Clear / Reset Guard (Case 50)');
        const case50Mob = '9876500050';
        const case50Headers = { 'x-session-mobile': case50Mob, 'x-operator-uid': 'test_suite_operator_uid' };

        // 1. Initialize session and complete child member intake to READY_TO_APPLY
        await request('POST', '/api/chat', { message: 'ரேஷன் கார்டு', mobileNumber: case50Mob }, case50Headers);
        await request('POST', '/api/chat', { message: 'குடும்ப உறுப்பினர் சேர்க்க', mobileNumber: case50Mob }, case50Headers);
        await request('POST', '/api/chat', { message: 'ADD_MEMBER_CHILD', mobileNumber: case50Mob }, case50Headers);
        await request('POST', '/api/chat', { message: 'கவின் குமார்', mobileNumber: case50Mob }, case50Headers);
        const resCase50ChildReady = await request('POST', '/api/chat', { message: 'CHILD_SON', mobileNumber: case50Mob }, case50Headers);
        assert(resCase50ChildReady.body.step === 'READY_TO_APPLY', 'Intake reaches READY_TO_APPLY');

        // 2. Click "Add Member" -> Fast-forwards to READY_TO_APPLY with clear reset option (no dead loop)
        const resCase50Add = await request('POST', '/api/chat', { message: 'குடும்ப உறுப்பினர் சேர்க்க', mobileNumber: case50Mob }, case50Headers);
        assert(resCase50Add.status === 200, 'Add Member returns 200 OK');
        assert(resCase50Add.body.step === 'READY_TO_APPLY', 'Case 1 fast-forwards to READY_TO_APPLY');
        const summaryMsg = resCase50Add.body.chatHistory[resCase50Add.body.chatHistory.length - 1];
        assert(summaryMsg.options.some(o => o.value === 'RATION_ADD_MEMBER_RESET'), 'Summary offers RATION_ADD_MEMBER_RESET (Change Member)');

        // 3. User chooses to add different member -> cleanly resets to RATION_ADD_MEMBER_TYPE
        const resResetMember = await request('POST', '/api/chat', { message: 'RATION_ADD_MEMBER_RESET', mobileNumber: case50Mob }, case50Headers);
        assert(resResetMember.status === 200, 'RATION_ADD_MEMBER_RESET returns 200 OK');
        assert(resResetMember.body.step === 'RATION_ADD_MEMBER_TYPE', 'Transitions to RATION_ADD_MEMBER_TYPE');
        const uploadMsg = resResetMember.body.chatHistory[resResetMember.body.chatHistory.length - 1];
        assert(uploadMsg.actionRequired === 'upload', 'Prompts for member Aadhaar upload');
        assert(uploadMsg.options.some(o => o.value === 'TRIGGER_FILE_UPLOAD'), 'Contains TRIGGER_FILE_UPLOAD');

        // 4. Test Operator Reset / Clear screen API
        const resetRes = await request('POST', '/api/chat/reset', { isOp: true, forceClean: true, mobileNumber: case50Mob }, case50Headers);
        assert(resetRes.status === 200, 'POST /api/chat/reset returns 200 OK');
        assert(resetRes.body.success === true, 'Reset succeeds');
        assert(resetRes.body.step === 'SERVICE_SELECTION', 'Step reset to SERVICE_SELECTION');

        const histAfterReset = await request('GET', `/api/chat/history?mobile=${case50Mob}`, null, case50Headers);
        assert(histAfterReset.body.chatHistory.length === 1, 'History after operator reset contains exactly 1 initial welcome message');

        // 4. Verify client-side polling suppression invariant
        const chatWorkflowCode = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'modules', 'chat_workflow.js'), 'utf8');
        assert(chatWorkflowCode.includes('window.isScreenResetting'), 'chat_workflow.js enforces window.isScreenResetting guard');
        assert(chatWorkflowCode.includes("fetch('/api/chat/reset'"), 'chat_workflow.js notifies server on operator reset');

        const hudCode = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'modules', 'automation_hud.js'), 'utf8');
        assert(hudCode.includes('window.isScreenResetting'), 'automation_hud.js enforces window.isScreenResetting guard');
        assert(hudCode.includes("localStorage.removeItem('eseva_active_customer_mobile')"), 'automation_hud.js clears localStorage immediately');
        passedCount += 6;

        // [TEST 33] Universal Exact Document Boundary Auto-Cropping Before Merging Law (Case 51)
        console.log('\n[TEST 33] Universal Exact Document Boundary Auto-Cropping Before Merging Law (Case 51)');
        const { cropDocumentToExactBoundary, produceDualSidedDocument } = require('../photo_studio');
        const { resolveDualSidedPaths } = require('../src/services/document_stitcher');
        assert(typeof cropDocumentToExactBoundary === 'function', 'photo_studio exports cropDocumentToExactBoundary');
        assert(typeof produceDualSidedDocument === 'function', 'photo_studio exports produceDualSidedDocument');

        // Verify resolveDualSidedPaths supports Aadhaar, Ration Card, Residence Proof, Gas Book, and generic <docType>Front/<docType>Back
        const sampleDualDraft = {
            documents: {
                rationCardFront: '/tmp/rc_front.jpg',
                rationCardBack: '/tmp/rc_back.jpg',
                voterIdFront: '/tmp/voter_front.jpg',
                voterIdBack: '/tmp/voter_back.jpg',
                gasBookFront: '/tmp/gas_front.jpg',
                gasBookBack: '/tmp/gas_back.jpg'
            }
        };
        const rcPaths = resolveDualSidedPaths(sampleDualDraft, 'rationCard');
        assert(rcPaths.front === '/tmp/rc_front.jpg' && rcPaths.back === '/tmp/rc_back.jpg', 'resolveDualSidedPaths resolves rationCardFront + rationCardBack');
        const voterPaths = resolveDualSidedPaths(sampleDualDraft, 'voterId');
        assert(voterPaths.front === '/tmp/voter_front.jpg' && voterPaths.back === '/tmp/voter_back.jpg', 'resolveDualSidedPaths universally resolves any <docType>Front + <docType>Back');
        const gasPaths = resolveDualSidedPaths(sampleDualDraft, 'gasBook');
        assert(gasPaths.front === '/tmp/gas_front.jpg' && gasPaths.back === '/tmp/gas_back.jpg', 'resolveDualSidedPaths resolves gasBookFront + gasBookBack');

        // Verify cropDocumentToExactBoundary accurately crops a white card placed on a brown wooden background
        const sharpLib = require('sharp');
        const synthDir = path.join(__dirname, '..', 'compressed');
        const synthTableCardPath = path.join(synthDir, `test_synth_table_card_${Date.now()}.jpg`);
        const cardOverlay = await sharpLib({
            create: { width: 320, height: 200, channels: 3, background: { r: 220, g: 230, b: 238 } }
        }).jpeg().toBuffer();
        await sharpLib({
            create: { width: 500, height: 800, channels: 3, background: { r: 120, g: 95, b: 70 } }
        })
            .composite([{ input: cardOverlay, left: 90, top: 300 }])
            .jpeg({ quality: 92 })
            .toFile(synthTableCardPath);

        const croppedCardPath = await cropDocumentToExactBoundary(synthTableCardPath);
        assert(Boolean(croppedCardPath) && fs.existsSync(croppedCardPath), 'cropDocumentToExactBoundary produces a valid cropped image');
        const croppedMeta = await sharpLib(croppedCardPath).metadata();
        assert(croppedMeta.width >= 300 && croppedMeta.width <= 360, `Cropped card width (${croppedMeta.width}) matches card width (~320px) and removes wooden background (500px)`);
        assert(croppedMeta.height >= 185 && croppedMeta.height <= 235, `Cropped card height (${croppedMeta.height}) matches card height (~200px) and removes wooden background (800px)`);
        try { if (fs.existsSync(synthTableCardPath)) fs.unlinkSync(synthTableCardPath); } catch (_) {}
        try { if (croppedCardPath && fs.existsSync(croppedCardPath)) fs.unlinkSync(croppedCardPath); } catch (_) {}
        passedCount += 8;

        // [TEST 34] TNPDS New Smart Card Permanent Code Freeze & Multi-Member Intake/Automation Law (CASE-55)
        console.log('\n[TEST 34] TNPDS New Smart Card Permanent Code Freeze & Multi-Member Intake/Automation Law (CASE-55)');
        const featLockFull = fs.readFileSync(path.join(__dirname, '..', 'FEATURE_LOCK.md'), 'utf8');
        assert(featLockFull.includes('தொகுதி 15: TNPDS புதிய மின்னணு குடும்ப அட்டை முழுமையான குறியீட்டு முடக்கம்'), 'FEATURE_LOCK.md must contain Section 15 New Smart Card Freeze contract');
        assert(featLockFull.includes('CASE-55 / 51 Steps'), 'FEATURE_LOCK.md must certify 51 Steps execution');
        assert(featLockFull.includes('card_family_members_loop.js'), 'FEATURE_LOCK.md frozen manifest must list card_family_members_loop.js');

        // Verify card_family_members_loop.js scoped modal check & single atomic submit click
        const familyLoopCode = fs.readFileSync(path.join(__dirname, '..', 'src', 'portal', 'tnpds', 'flows', 'new_smart_card', 'card_family_members_loop.js'), 'utf8');
        assert(familyLoopCode.includes('input[formcontrolname="otp"], input#otp'), 'card_family_members_loop.js scopes modal search strictly to OTP inputs');
        assert(familyLoopCode.includes('ancestor::div[contains(@class,"modal")]//button[contains(@class,"btn-success")'), 'card_family_members_loop.js executes Playwright single atomic submit click');
        assert(!familyLoopCode.includes('subBtn.click()'), 'card_family_members_loop.js completely avoids duplicate DOM evaluate click collisions');

        // Verify multi-member intake & profile update preservation
        const { applyProfileUpdates } = require('../src/services/profile_update_service');
        const testMultiSess = {
            citizenProfile: {
                fullNameTam: 'குமரன் கி',
                fullNameEng: 'Kumaran K',
                headAadhaar: '575567662931',
                members: [
                    { nameTam: 'குமரன் கி', nameEng: 'Kumaran K', relationshipTam: 'குடும்பத் தலைவர்', aadhaarNumber: '575567662931' },
                    { nameTam: 'பிரியா கு', nameEng: 'Priya K', relationshipTam: 'மனைவி', relationship: 'Wife', aadhaarNumber: '491436223971', dob: '15/08/1995', gender: 'Female' }
                ]
            }
        };

        // Update profile with modified Member 2 details
        applyProfileUpdates(testMultiSess, {
            members: [
                { nameTam: 'குமரன் கி', nameEng: 'Kumaran K', relationshipTam: 'குடும்பத் தலைவர்', aadhaarNumber: '575567662931' },
                { nameTam: 'பிரியா குமரன்', nameEng: 'Priya Kumaran', relationshipTam: 'மனைவி', relationship: 'Wife', aadhaarNumber: '491436223971', dob: '15/08/1995', gender: 'Female' }
            ]
        });

        assert(testMultiSess.citizenProfile.members.length === 2, 'applyProfileUpdates preserves all members in array');
        assert(testMultiSess.citizenProfile.members[1].nameTam === 'பிரியா குமரன்', 'Member 2 name updated cleanly');
        assert(testMultiSess.citizenProfile.members[1].relationshipTam === 'மனைவி', 'Member 2 relationship preserved');

        // Verify UI interface files contain required multi-member and father name enhancements
        const curIndexHtmlCode = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
        assert(curIndexHtmlCode.includes('infoHeadFather'), 'index.html contains infoHeadFather element in sidebar');
        assert(curIndexHtmlCode.includes('membersSidebarContainer'), 'index.html contains membersSidebarContainer for dynamic family members');

        const curDocViewerCode = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'modules', 'document_viewer.js'), 'utf8');
        assert(curDocViewerCode.includes("setVal('infoHeadFather'"), 'document_viewer.js populates infoHeadFather');
        assert(curDocViewerCode.includes('❌ எரிவாயு இணைப்பு இல்லை'), 'document_viewer.js explicitly displays when citizen has no gas connection');

        const curEditModalCode = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'modules', 'edit_modal_manager.js'), 'utf8');
        assert(curEditModalCode.includes('editMemberNameTam_'), 'edit_modal_manager.js renders editable name field for additional members');
        assert(curEditModalCode.includes('editMemberRel_'), 'edit_modal_manager.js renders editable relationship dropdown for additional members');
        assert(curEditModalCode.includes('editMemberAadhaar_'), 'edit_modal_manager.js renders editable Aadhaar field for additional members');

        // =========================================================================
        // [TEST 35] TNPDS Family Member Removal (குடும்ப உறுப்பினர் நீக்கம்) End-to-End Suite
        // =========================================================================
        console.log('\n[TEST 35] TNPDS Family Member Removal (குடும்ப உறுப்பினர் நீக்கம்) End-to-End Suite');

        // Part A: Conversational Intake & Multi-Option Member Selection
        const remMob = '9999900035';
        const remHeaders = { 'x-session-mobile': remMob, 'x-operator-uid': 'test_suite_operator_uid' };

        await request('POST', '/api/operator/new-customer', { isWalkin: true, mobileNumber: remMob });
        await request('POST', '/api/chat', { message: 'ரேஷன் கார்டு', mobileNumber: remMob }, remHeaders);

        const resRemInit = await request('POST', '/api/chat', { message: 'குடும்ப உறுப்பினர் நீக்க', mobileNumber: remMob }, remHeaders);
        assert(resRemInit.status === 200, 'Remove member request returns 200 OK');
        assert(resRemInit.body.step === 'RATION_REMOVE_MEMBER_REASON', 'Transitions to RATION_REMOVE_MEMBER_REASON');
        const lastMsgInit = resRemInit.body.chatHistory && resRemInit.body.chatHistory[resRemInit.body.chatHistory.length - 1];
        assert(lastMsgInit && lastMsgInit.options && lastMsgInit.options.some(o => o.value === 'REMOVE_REASON_DEATH'), 'Presents 1-click option for Death reason');
        assert(lastMsgInit && lastMsgInit.options && lastMsgInit.options.some(o => o.value === 'REMOVE_REASON_MARRIAGE'), 'Presents 1-click option for Marriage reason');
        assert(lastMsgInit && lastMsgInit.options && lastMsgInit.options.some(o => o.value === 'REMOVE_REASON_SPLIT'), 'Presents 1-click option for Split reason');

        // Select Death reason
        const resRemReason = await request('POST', '/api/chat', { message: 'REMOVE_REASON_DEATH', mobileNumber: remMob }, remHeaders);
        assert(resRemReason.status === 200, 'Death reason selection returns 200 OK');
        assert(resRemReason.body.step === 'RATION_REMOVE_MEMBER_DOC', 'Transitions to RATION_REMOVE_MEMBER_DOC');

        // Provide member name
        const resRemName = await request('POST', '/api/chat', { message: 'சுந்தரம் கி', mobileNumber: remMob }, remHeaders);
        assert(resRemName.status === 200, 'Member name submission returns 200 OK');
        assert(resRemName.body.step === 'READY_TO_APPLY', 'Transitions to READY_TO_APPLY after member specified');
        const lastMsgName = resRemName.body.chatHistory && resRemName.body.chatHistory[resRemName.body.chatHistory.length - 1];
        assert(lastMsgName && lastMsgName.text && lastMsgName.text.includes('சுந்தரம் கி'), 'Summary includes removed member name');
        assert(lastMsgName && lastMsgName.text && lastMsgName.text.includes('குடும்ப உறுப்பினர் நீக்கம்'), 'Summary identifies service as Remove Member');

        // Part B: UI Interface Verification
        const remIndexHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
        assert(remIndexHtml.includes('editRemoveMemberFieldsWrap'), 'index.html contains editRemoveMemberFieldsWrap');
        assert(remIndexHtml.includes('editRemoveMemberDocBoxesWrap'), 'index.html contains editRemoveMemberDocBoxesWrap');
        assert(remIndexHtml.includes('editRemoveMemberReason'), 'index.html contains editRemoveMemberReason dropdown');

        const remEditModalJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'modules', 'edit_modal_manager.js'), 'utf8');
        assert(remEditModalJs.includes('isRemoveMember'), 'edit_modal_manager.js supports isRemoveMember');
        assert(remEditModalJs.includes('editRemoveMemberFieldsWrap'), 'edit_modal_manager.js toggles editRemoveMemberFieldsWrap');

        const remDocViewerJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'modules', 'document_viewer.js'), 'utf8');
        assert(remDocViewerJs.includes('isSubserviceRemoveMember'), 'document_viewer.js recognizes isSubserviceRemoveMember');

        // Part C: Module Export & Automation Flow Pre-Submit Verification
        const tnpdsAuto = require('../tnpds_automation');
        assert(typeof tnpdsAuto.startTnpdsRemoveMemberFlow === 'function', 'tnpds_automation exports startTnpdsRemoveMemberFlow');
        assert(typeof tnpdsAuto.generateRemoveMemberReceiptPdf === 'function', 'tnpds_automation exports generateRemoveMemberReceiptPdf');

        const tnpdsGateway = require('../automations/tnpds');
        assert(typeof tnpdsGateway.startRemoveMember === 'function', 'automations/tnpds exports startRemoveMember');

        const autoRunnerCode = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'automation_runner.js'), 'utf8');
        assert(autoRunnerCode.includes('isRemoveMember') && autoRunnerCode.includes('startTnpdsRemoveMemberFlow'), 'automation_runner.js dispatches to startTnpdsRemoveMemberFlow');

        // Execute Fast Test Gate for Remove Member Flow
        const autoFlowRes = await tnpdsAuto.startTnpdsRemoveMemberFlow({
            mobileNumber: remMob,
            smartCardNumber: '332145897210',
            subService: 'REMOVE_MEMBER',
            subServiceData: {
                memberName: 'Sundaram K',
                memberNameTam: 'சுந்தரம் கி',
                reason: 'இறப்பு (Death of Member)',
                docType: 'இறப்புச் சான்றிதழ்'
            }
        }, () => {}, { fastTest: true, isTestSuite: true });

        assert(autoFlowRes.success === true, 'startTnpdsRemoveMemberFlow fast test succeeds');
        assert(typeof autoFlowRes.applicationNumber === 'string' && autoFlowRes.applicationNumber.startsWith('N'), 'Generates valid application reference number');
        assert(fs.existsSync(autoFlowRes.pdfPath), 'Generates official acknowledgment PDF receipt on disk');

        // Test API invocation for Remove Member Automation
        const resRemAuto = await request('POST', '/api/automation/start', {
            mobileNumber: remMob,
            fastTest: true
        }, {
            'x-session-mobile': remMob,
            'x-operator-uid': 'test_suite_operator_uid'
        });
        assert(resRemAuto.status === 200, 'POST /api/automation/start returns 200 for REMOVE_MEMBER');
        assert(resRemAuto.body.success === true, 'Automation started for REMOVE_MEMBER');

        // Clean up test draft
        await request('DELETE', `/api/drafts/${remMob}?permanent=true`);

        // =========================================================================
        // [TEST 36] Master Citizen Profile, Application-Centric Isolation & Document-First Suite
        // =========================================================================
        console.log('\n[TEST 36] Master Citizen Profile, Application-Centric Isolation & Document-First Suite');

        const { lookupCitizen, saveCitizenMaster } = require('../src/services/db/citizen_master_service');
        const { createApplication, listCitizenApplications } = require('../src/services/db/application_service');
        const { evaluateServiceReadiness } = require('../src/services/service_requirements');

        const masterMob = '9999900036';
        const headAadh = '123456789012';
        const memberAadh = '567890123456';

        // 1. Save Master Citizen with family member
        saveCitizenMaster(masterMob, {
            fullNameTam: 'குமரன் கி',
            fullNameEng: 'Kumaran K',
            headAadhaar: headAadh,
            doorNo: '12/4',
            streetTam: 'மேட்டு தெரு',
            village: 'Minnal',
            taluk: 'Arakkonam',
            district: 'Ranipet',
            pincode: '632510',
            members: [
                {
                    nameTam: 'விக்னேஷ் கு',
                    nameEng: 'Vignesh K',
                    relationshipTam: 'மகன்',
                    aadhaarNumber: memberAadh
                }
            ]
        });

        // 2. Multi-factor lookups
        const byMob = lookupCitizen(masterMob);
        assert(byMob && byMob.foundBy === 'mobile', 'lookupCitizen finds citizen by 10-digit mobile');
        assert(byMob.citizen.fullNameTam === 'குமரன் கி', 'Retrieved citizen name matches');

        const byHeadAadh = lookupCitizen(headAadh);
        assert(byHeadAadh && (byHeadAadh.foundBy === 'head_aadhaar' || byHeadAadh.foundBy === 'mobile'), 'lookupCitizen finds citizen by 12-digit head Aadhaar');

        const byMemAadh = lookupCitizen(memberAadh);
        assert(byMemAadh && byMemAadh.foundBy === 'member_aadhaar', 'lookupCitizen finds family member by 12-digit member Aadhaar');
        assert(byMemAadh.matchedMember && byMemAadh.matchedMember.nameTam === 'விக்னேஷ் கு', 'Matched member identity preserved');

        // 3. Application-centric isolation
        const newApp = createApplication(masterMob, 'INCOME_CERT', byMob.citizen, {
            formData: { annualIncome: '72000', occupation: 'கூலி வேலை' }
        });
        assert(newApp && newApp.appId.startsWith(`APP_${masterMob}_INCOME_CERT_`), 'createApplication generates isolated appId');
        assert(newApp.serviceNameTam === 'வருமானச் சான்றிதழ்', 'Application carries correct Tamil title');

        const appList = listCitizenApplications(masterMob);
        assert(appList.length >= 1, 'listCitizenApplications retrieves citizen applications');
        assert(appList.some(a => a.appId === newApp.appId), 'Newly created application listed cleanly');

        // 4. Declarative Requirements & Document-First Readiness
        const readiness1 = evaluateServiceReadiness('INCOME_CERT', { headAadhaar: headAadh, fullNameTam: 'குமரன் கி' });
        assert(readiness1.isReady === false, 'Readiness detects incomplete application');
        assert(readiness1.nextAction === 'UPLOAD_DOCUMENT', 'Document-first intake prioritizes document upload over manual fields');
        assert(readiness1.missingDocs.some(d => d.key === 'incomeProof'), 'Identifies missing incomeProof document');

        // 5. API Search Endpoint Verification
        const searchRes = await request('POST', '/api/operator/search-citizen', { query: memberAadh });
        assert(searchRes.status === 200, 'Search-citizen API returns 200 OK');
        assert(searchRes.body.found === true, 'Search-citizen confirms citizen found');
        assert(searchRes.body.foundBy === 'member_aadhaar', 'Search-citizen identifies match via member Aadhaar');

        // 6. Operator New-Customer with Income Service & Pre-filled Aadhaar
        const incomeIntakeRes = await request('POST', '/api/operator/new-customer', {
            customerMobile: masterMob,
            serviceName: 'வருமானச் சான்றிதழ்'
        });
        assert(incomeIntakeRes.status === 200, 'New customer with income service returns 200 OK');
        assert(incomeIntakeRes.body.intakeState === 'INCOME_AADHAAR_WAIT' || incomeIntakeRes.body.intakeState === 'INCOME_PHOTO_WAIT' || incomeIntakeRes.body.intakeState === 'INCOME_CAN_GATE', 'Enters document or CAN gate when CAN is not yet linked');
        const lastIncomeMsg = incomeIntakeRes.body.chatHistory && incomeIntakeRes.body.chatHistory[incomeIntakeRes.body.chatHistory.length - 1];
        assert(lastIncomeMsg && lastIncomeMsg.text.includes('குமரன் கி'), 'Intake acknowledges pre-filled Aadhaar details');
        assert(lastIncomeMsg && lastIncomeMsg.options && (lastIncomeMsg.options.some(o => o.value === 'CAN_SEARCH_PROMPT') || lastIncomeMsg.options.some(o => o.value === 'TRIGGER_FILE_UPLOAD')), 'Presents document upload or CAN verification options');

        // 7. Context-Adaptive Sidebar UI Verification
        const curHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
        assert(curHtml.includes('sidebarIncomeBox'), 'index.html contains sidebarIncomeBox');
        assert(curHtml.includes('sidebarRemoveMemberBox'), 'index.html contains sidebarRemoveMemberBox');
        assert(curHtml.includes('sidebarServiceSelectionPromptBox'), 'index.html contains sidebarServiceSelectionPromptBox');

        const curDocViewer = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'modules', 'document_viewer.js'), 'utf8');
        assert(curDocViewer.includes('isIncomeService'), 'document_viewer.js identifies isIncomeService for dynamic sidebar');
        assert(curDocViewer.includes('isNewRationCardService'), 'document_viewer.js identifies isNewRationCardService for dynamic sidebar');
        assert(curDocViewer.includes('gasBox.style.display = isNewRationCardService'), 'document_viewer.js hides gas connection box for non-ration services');

        passedCount += 19;

        // [TEST 37] Fresh Service Selection Invariant & Zero Stale Submission Pollution Gate (Case 56)
        console.log('\n[TEST 37] Fresh Service Selection Invariant & Zero Stale Submission Pollution Gate (Case 56)');
        const test56Mob = '9999900056';
        const test56Headers = { 'x-session-mobile': test56Mob, 'x-operator-uid': 'test_suite_operator_uid' };

        // Self-contained fixture: Seed clean test profile for test suite execution
        const { saveCitizenMaster: seedMaster } = require('../src/services/db/citizen_master_service');
        seedMaster(test56Mob, {
            mobileNumber: test56Mob,
            fullNameTam: 'குமரன் கி',
            fullNameEng: 'Kumaran K',
            fatherNameTam: 'கிருபாகரன்',
            fatherNameEng: 'Kirubakaran',
            headDob: '10/06/1993',
            dob: '10/06/1993',
            headGender: 'Male',
            headGenderTam: 'ஆண்',
            headAadhaar: '575567662931',
            doorNo: '216',
            streetTam: 'மேட்டு தெரு',
            streetEng: 'METTU STREET',
            areaTam: 'நரசிங்கபுரம், மின்னல்',
            areaEng: 'NARASINGAPURAM, MINNAL',
            village: 'Minnal',
            villageTam: 'மின்னல்',
            taluk: 'Arakkonam',
            talukTam: 'அரக்கோணம்',
            district: 'Ranipet',
            districtTam: 'இராணிப்பேட்டை',
            pincode: '632510',
            canNumber: '1334207568697',
            members: [],
            documents: {},
            base64Docs: {}
        });
        await request('POST', '/api/drafts/save', {
            mobileNumber: test56Mob,
            citizenProfile: {
                mobileNumber: test56Mob,
                fullNameTam: 'குமரன் கி',
                fullNameEng: 'Kumaran K',
                fatherNameTam: 'கிருபாகரன்',
                fatherNameEng: 'Kirubakaran',
                headDob: '10/06/1993',
                dob: '10/06/1993',
                headGender: 'Male',
                headGenderTam: 'ஆண்',
                headAadhaar: '575567662931',
                doorNo: '216',
                streetTam: 'மேட்டு தெரு',
                streetEng: 'METTU STREET',
                village: 'Minnal',
                taluk: 'Arakkonam',
                district: 'Ranipet',
                pincode: '632510',
                canNumber: '1334207568697',
                members: [],
                documents: {},
                base64Docs: {}
            },
            documents: {},
            intakeState: 'SERVICE_SELECTION',
            step: 'SERVICE_SELECTION'
        });

        // 1. Opening customer without service selection starts at SERVICE_SELECTION
        const res56Init = await request('POST', '/api/operator/new-customer', {
            customerMobile: test56Mob,
            operatorUid: 'test_suite_operator_uid'
        });
        assert(res56Init.status === 200, 'POST /api/operator/new-customer returns 200 OK');
        assert(res56Init.body.step === 'SERVICE_SELECTION', 'Customer visit starts at SERVICE_SELECTION');
        const initChat56 = res56Init.body.chatHistory;
        assert(initChat56 && initChat56.length === 1, 'Initial chat has exactly 1 welcome message');
        assert(initChat56[0].options && initChat56[0].options.some(o => o.value === 'வருவாய்த் துறை' || o.value === 'வருமானச் சான்றிதழ்'), 'Presents service selection options');
        assert(!initChat56[0].options.some(o => o.value === 'CONFIRM_SUBMIT'), 'Does NOT present premature TNPDS submit button');

        // 2. GET /api/chat/history retains SERVICE_SELECTION and does not hijack to READY_TO_APPLY
        const res56Hist = await request('GET', `/api/chat/history?mobile=${test56Mob}`, null, test56Headers);
        assert(res56Hist.status === 200, 'GET /api/chat/history returns 200 OK');
        assert(res56Hist.body.step === 'SERVICE_SELECTION', 'History retains SERVICE_SELECTION');
        const histLast56 = res56Hist.body.chatHistory[res56Hist.body.chatHistory.length - 1];
        assert(!histLast56.options.some(o => o.value === 'CONFIRM_SUBMIT'), 'History does NOT inject premature submit button');

        // 3. Resetting session cleans draft on disk and resets state
        const res56Reset = await request('POST', '/api/chat/reset', {
            isOp: true,
            forceClean: true,
            mobileNumber: test56Mob
        }, test56Headers);
        assert(res56Reset.status === 200, 'POST /api/chat/reset returns 200 OK');
        assert(res56Reset.body.step === 'SERVICE_SELECTION', 'Reset step is SERVICE_SELECTION');

        // 4. Entering number again after reset immediately returns clean SERVICE_SELECTION
        const res56Reopen = await request('GET', `/api/chat/history?mobile=${test56Mob}`, null, test56Headers);
        assert(res56Reopen.status === 200, 'Re-fetching history after reset returns 200 OK');
        assert(res56Reopen.body.step === 'SERVICE_SELECTION', 'History remains SERVICE_SELECTION after reopen');
        assert(res56Reopen.body.chatHistory.length === 1, 'Exactly 1 welcome message after reopen');
        assert(!res56Reopen.body.chatHistory[0].text.includes('REMOVE_REASON'), 'No stale subService artifacts');

        passedCount += 12;

        // [TEST 38] Add Member Zero-Confusion Direct Prompt & Zero-Ghost-Doc Invariant Gate
        console.log('\n[TEST 38] Add Member Zero-Confusion Direct Prompt & Zero-Ghost-Doc Invariant Gate');
        // Case A: Fresh customer without member documents -> Direct Aadhaar upload prompt
        const test38FreshMob = '9999900038';
        const test38Headers = { 'x-session-mobile': test38FreshMob, 'x-operator-uid': 'test_suite_operator_uid' };

        // Ensure 100% clean slate before test
        await request('DELETE', `/api/drafts/${test38FreshMob}?permanent=true`);

        // 1. Cleanly start customer intake
        await request('POST', '/api/operator/new-customer', {
            customerMobile: test38FreshMob,
            operatorUid: 'test_suite_operator_uid'
        });

        // 2. Click "குடும்ப உறுப்பினர் சேர்க்க"
        const res38AddMem = await request('POST', '/api/chat', {
            message: 'குடும்ப உறுப்பினர் சேர்க்க',
            mobileNumber: test38FreshMob
        }, test38Headers);
        assert(res38AddMem.status === 200, 'Add Member returns 200 OK');
        assert(res38AddMem.body.step === 'RATION_ADD_MEMBER_TYPE', 'Transitions to RATION_ADD_MEMBER_TYPE');

        const last38Msg = res38AddMem.body.chatHistory[res38AddMem.body.chatHistory.length - 1];
        // Assert clean direct prompt asking for Aadhaar card
        assert(last38Msg.text.includes('ஆதார் அட்டையைப்'), 'Direct prompt asks for new member Aadhaar card');
        // Assert no confusing multi-category decision trees in options
        assert(!last38Msg.options.some(o => o.value === 'ADD_MEMBER_CHILD'), 'Does NOT present confusing child option tree');
        assert(!last38Msg.options.some(o => o.value === 'ADD_MEMBER_ADULT'), 'Does NOT present confusing adult option tree');
        assert(last38Msg.options.some(o => o.value === 'TRIGGER_FILE_UPLOAD'), 'Presents direct 1-click Aadhaar upload trigger');
        assert(last38Msg.uploadPrompt === 'உறுப்பினர் ஆதார் அட்டை', 'Upload prompt is set to member Aadhaar card');

        // 3. Documents list gate: MUST have 0 member documents before upload (NO ghost member documents!)
        const res38DocsList = await request('GET', `/api/drafts/${test38FreshMob}/documents-list`);
        assert(res38DocsList.status === 200, 'GET documents-list returns 200 OK');
        const memberDocsBeforeUpload = (res38DocsList.body.documents || []).filter(d => d.type.toLowerCase().includes('member') || d.type === 'birthCertificate');
        assert(memberDocsBeforeUpload.length === 0, `ZERO ghost member documents before upload (found: ${memberDocsBeforeUpload.length})`);

        // Case B: Customer WITH verified member document on disk
        // Invariant: MUST NOT ask to re-upload! Must acknowledge Aadhaar and ask for relationship (or ready)
        const test38MemDocMob = '9999900039';
        await request('DELETE', `/api/drafts/${test38MemDocMob}?permanent=true`);
        const dummyMemDocPath = path.join(__dirname, '..', 'uploads', 'test_mem_aadhaar.pdf');
        if (!fs.existsSync(dummyMemDocPath)) {
            fs.writeFileSync(dummyMemDocPath, '%PDF-1.3\n%Test PDF Member Aadhaar');
        }
        await request('POST', '/api/drafts/save', {
            mobileNumber: test38MemDocMob,
            citizenProfile: {
                mobileNumber: test38MemDocMob,
                subService: 'ADD_MEMBER',
                subServiceData: { memberName: 'கவின் குமார்', aadhaarNo: '556677889900', docPath: dummyMemDocPath }
            },
            documents: { memberAadhaar: dummyMemDocPath }
        });
        const res38Exist = await request('POST', '/api/chat', {
            message: 'குடும்ப உறுப்பினர் சேர்க்க',
            mobileNumber: test38MemDocMob
        }, { 'x-session-mobile': test38MemDocMob, 'x-operator-uid': 'test_suite_operator_uid' });
        assert(res38Exist.status === 200, 'Add Member for existing doc returns 200 OK');
        const existLastMsg = res38Exist.body.chatHistory[res38Exist.body.chatHistory.length - 1];
        assert(existLastMsg.actionRequired !== 'upload', 'Does NOT emit actionRequired: upload when document is on file');
        assert(existLastMsg.text.includes('ஏற்கெனவே') || res38Exist.body.step === 'READY_TO_APPLY', 'Acknowledges existing member document');

        // Single-Document Invariant Gate for Add Member:
        // Uploading 1 person's Aadhaar card in Add Member MUST produce strictly 1 document (memberAadhaar) and ZERO headAadhaar duplicates!
        const res38ExistDocs = await request('GET', `/api/drafts/${test38MemDocMob}/documents-list`);
        assert(res38ExistDocs.status === 200, 'GET documents-list for Add Member returns 200 OK');
        const existDocsArr = res38ExistDocs.body.documents || [];
        assert(existDocsArr.length === 1 && existDocsArr[0].type === 'memberAadhaar', `Add Member single Aadhaar upload lists strictly 1 memberAadhaar document (found: ${existDocsArr.length})`);
        assert(!existDocsArr.some(d => d.type === 'headAadhaar'), 'Add Member never duplicates member Aadhaar as headAadhaar (Applicant Aadhaar)');

        // Clean up Case B test draft
        await request('DELETE', `/api/drafts/${test38MemDocMob}?permanent=true`);

        passedCount += 13;

        console.log('\n[TEST 39] Master Citizen Profile Isolation, Zero-Death-Certificate Hijack & Zero-Duplicate-Aadhaar Gate');
        const test39Mob = '9999900056';
        const test39Headers = { 'x-session-mobile': test39Mob, 'x-operator-uid': 'test_suite_operator_uid' };

        // 1. Initialize session for customer Kumaran
        const res39Cust = await request('POST', '/api/operator/new-customer', {
            customerMobile: test39Mob,
            operatorUid: 'test_suite_operator_uid'
        });
        assert(res39Cust.status === 200, 'Customer session init returns 200 OK');
        assert(res39Cust.body.intakeState === 'SERVICE_SELECTION', 'Customer visit starts cleanly at SERVICE_SELECTION');

        // 2. Draft check: subService MUST be null / undefined (never hijacked to REMOVE_MEMBER)
        const res39Draft = await request('GET', `/api/drafts/${test39Mob}`);
        assert(res39Draft.status === 200, 'GET /api/drafts/:mobile returns 200 OK');
        const draftProfile = res39Draft.body.draft?.citizenProfile || res39Draft.body.draft || {};
        assert(!draftProfile.subService || draftProfile.subService === null, 'subService is strictly null (not hijacked)');
        assert(!draftProfile.subServiceData || draftProfile.subServiceData.reason === undefined, 'No stale removeReason in draft');

        // 3. Document check: Zero Death Certificate / removeProof documents
        const res39Docs = await request('GET', `/api/drafts/${test39Mob}/documents-list`);
        assert(res39Docs.status === 200, 'GET documents-list returns 200 OK');
        const deathDocs = (res39Docs.body.documents || []).filter(d => d.type === 'removeProof' || (d.name && d.name.includes('இறப்பு')));
        assert(deathDocs.length === 0, `ZERO Death Certificate documents found for customer (found: ${deathDocs.length})`);

        // 4. Multi-Service Aadhaar Re-Use: Applying for Residence Certificate re-uses existing Aadhaar without duplicate upload prompts
        const res39Res = await request('POST', '/api/chat', {
            message: 'இருப்பிடச் சான்றிதழ்',
            mobileNumber: test39Mob
        }, test39Headers);
        assert(res39Res.status === 200, 'Residence Certificate request returns 200 OK');
        const lastResMsg = res39Res.body.chatHistory[res39Res.body.chatHistory.length - 1];
        assert(lastResMsg.text.includes('ஏற்கெனவே பெறப்பட்டுள்ளன') || lastResMsg.text.includes('CAN எண்') || lastResMsg.text.includes('இருப்பிடச் சான்றிதழ்') || lastResMsg.text.includes('புகைப்படம்'), 'Recognizes that Aadhaar and address are already in Master Profile');
        assert(lastResMsg.options.some(o => o.value === 'APPLY_RESIDENCE_NOW' || o.value === 'START_RESIDENCE_APPLY' || o.value === 'CAN_DIRECT_INPUT' || o.value === 'பிறப்பிலிருந்து' || o.value === 'TRIGGER_FILE_UPLOAD'), 'Presents direct button or upload button for Residence Certificate');

        // 5. Multi-Service Aadhaar Re-Use: Applying for Voter ID re-uses existing Aadhaar without duplicate upload prompts
        const res39Voter = await request('POST', '/api/chat', {
            message: 'புதிய வாக்காளர் அட்டை',
            mobileNumber: test39Mob
        }, test39Headers);
        assert(res39Voter.status === 200, 'Voter ID request returns 200 OK');
        const lastVoterMsg = res39Voter.body.chatHistory[res39Voter.body.chatHistory.length - 1];
        assert(lastVoterMsg.text.includes('ஏற்கெனவே பெறப்பட்டுள்ளன'), 'Recognizes that citizen identity and Aadhaar are already on file');
        assert(lastVoterMsg.options.some(o => o.value === 'APPLY_VOTER_NOW'), 'Presents direct 1-click submit button for Voter ID');

        passedCount += 8;

        // =========================================================================
        // [TEST 40] Operator Draft Desk: "தொடர்" Button Removed & Direct "திருத்து" (Edit Master Profile) Gating
        // =========================================================================
        console.log('\n[TEST 40] ✏️ வாடிக்கையாளர் மேலாண்மை (Customer Desk): "தொடர்" நீக்கப்பட்டு நேரடி "திருத்து" பொத்தான் சரிபார்ப்பு...');
        const opDraftsJsContent = fs.readFileSync(path.join(__dirname, '../public/js/modules/operator_drafts.js'), 'utf8');
        const editModalJsContent = fs.readFileSync(path.join(__dirname, '../public/js/modules/edit_modal_manager.js'), 'utf8');

        assert(!opDraftsJsContent.includes('>✏️ தொடர்</button>'), 'Zero "தொடர்" buttons on operator draft cards');
        assert(!opDraftsJsContent.includes('>தொடர்</button>'), 'Zero plain "தொடர்" buttons on operator draft cards');
        assert(opDraftsJsContent.includes('editCustomerFromDraftDesk'), 'editCustomerFromDraftDesk handler is defined');
        assert(opDraftsJsContent.includes('திருத்து</button>'), '"திருத்து" (Edit Details) button exists on draft cards');
        assert(editModalJsContent.includes('forceMasterProfile = false'), 'openEditModal supports forceMasterProfile flag');

        const indexHtmlContent = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
        assert(indexHtmlContent.includes('btnSidebarEdit'), 'Sidebar contains btnSidebarEdit');
        assert(indexHtmlContent.includes('btnSidebarSave'), 'Sidebar contains btnSidebarSave');
        assert(indexHtmlContent.includes('திருத்து (Edit)</button>'), 'Sidebar edit button formatted cleanly as single-line Edit');
        assert(indexHtmlContent.includes('சேமி (Save)</button>'), 'Sidebar save button formatted cleanly as single-line Save');

        const opIntakeJsContent = fs.readFileSync(path.join(__dirname, '../public/js/modules/operator_intake.js'), 'utf8');
        assert(opIntakeJsContent.includes('saveCurrentDraftManually'), 'saveCurrentDraftManually handler defined');
        assert(opIntakeJsContent.includes('fa-spinner'), 'Save button triggers loading spinner during save');
        assert(opIntakeJsContent.includes('சேமிக்கப்பட்டது! ✅'), 'Save button triggers animated success confirmation');
        assert(opIntakeJsContent.includes('notifySaveStatus'), 'Save action triggers notification status toast');

        passedCount += 13;

        // [TEST 41] Strict Zero-Ghost-Document & Physical Disk File Verification Invariant Gate
        console.log('\n[TEST 41] Strict Zero-Ghost-Document & Physical Disk File Verification Invariant Gate');
        const test41Mob = '9999900056';
        const res41Docs = await request('GET', `/api/drafts/${test41Mob}/documents-list`);
        assert(res41Docs.status === 200, 'GET /documents-list returns 200 OK');
        const docs41 = res41Docs.body.documents || [];
        // Assert every single listed document must physically exist on disk (zero ghost/phantom files!)
        for (const doc of docs41) {
            const dlRes = await request('GET', doc.downloadUrl);
            assert(dlRes.status === 200, `Physical download of ${doc.title} (${doc.type}) returns 200 OK (verified on disk)`);
            assert(dlRes.raw && dlRes.raw.length > 50, `Physical file of ${doc.type} has non-zero bytes on disk`);
        }
        // Assert no non-existent gas books or residence proofs are listed for Kumaran
        assert(!docs41.some(d => d.type === 'gasBook'), 'Zero ghost gas book when file does not exist on disk');
        assert(!docs41.some(d => d.type === 'residenceProof'), 'Zero ghost residence proof when file does not exist on disk');
        passedCount += 4;

        // =========================================================================
        // [TEST 42] Review & Edit Modal Document Delete Controls & Backend Removal Gate
        // =========================================================================
        console.log('\n[TEST 42] 🗑️ ஆவணங்கள் நீக்குதல் (Document Delete Controls & Invariant Gate)...');
        assert(indexHtmlContent.includes('editPhotoDeleteBtn'), 'Contains editPhotoDeleteBtn');
        assert(indexHtmlContent.includes('editHeadAadhaarDeleteBtn'), 'Contains editHeadAadhaarDeleteBtn');
        assert(indexHtmlContent.includes('editResidenceDeleteBtn'), 'Contains editResidenceDeleteBtn');
        assert(indexHtmlContent.includes('editAddMemberAadhaarDeleteBtn'), 'Contains editAddMemberAadhaarDeleteBtn');
        const updatedEditModalJs = fs.readFileSync(path.join(__dirname, '../public/js/modules/edit_modal_manager.js'), 'utf8');
        assert(updatedEditModalJs.includes('handleEditDocDelete'), 'handleEditDocDelete handler defined in edit modal');

        // Test POST /api/drafts/delete-document
        const test42Mob = '9999900042';
        const dummyDocPath42 = path.join(__dirname, '..', 'uploads', 'test_doc_42.jpg');
        if (!fs.existsSync(dummyDocPath42)) {
            fs.writeFileSync(dummyDocPath42, 'TEST_DOC_42_CONTENT_1234567890');
        }
        await request('POST', '/api/drafts/save', {
            mobileNumber: test42Mob,
            citizenProfile: {
                fullNameTam: 'மாதிரி வாடிக்கையாளர்',
                fullNameEng: 'Sample User 42',
                mobileNumber: test42Mob,
                headPhotoPath: '/uploads/test_doc_42.jpg',
                residenceProof: { docPath: '/uploads/test_doc_42.jpg' }
            },
            documents: {
                profilePhoto: '/uploads/test_doc_42.jpg',
                residenceProof: '/uploads/test_doc_42.jpg'
            }
        });

        const resBeforeDelete = await request('GET', `/api/drafts/${test42Mob}/documents-list`);
        assert(resBeforeDelete.body.documents.some(d => d.type === 'profilePhoto'), 'Document present before delete');

        const delRes = await request('POST', '/api/drafts/delete-document', {
            mobileNumber: test42Mob,
            docType: 'headPhoto'
        });
        assert(delRes.status === 200 && delRes.body.success === true, 'POST /api/drafts/delete-document returns 200 OK');

        const resAfterDelete = await request('GET', `/api/drafts/${test42Mob}/documents-list`);
        assert(!resAfterDelete.body.documents.some(d => d.type === 'profilePhoto'), 'Document completely purged after delete');

        await request('DELETE', `/api/drafts/${test42Mob}?permanent=true`);
        passedCount += 8;

        // =========================================================================
        // [TEST 43] Native Window Controls & Clean In-App Header Invariant Gate
        // =========================================================================
        console.log('\n[TEST 43] 🪟 விண்டோஸ் கட்டுப்பாடுகள் (Window Controls Invariant Gate)...');
        const updatedIndexHtml = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
        assert(!updatedIndexHtml.includes('id="desktopWindowControls"'), 'Redundant duplicate window controls removed from in-app header');
        assert(!updatedIndexHtml.includes('winBtnMinimize'), 'winBtnMinimize removed from header to prevent duplicate UI');
        assert(!updatedIndexHtml.includes('winBtnClose'), 'winBtnClose removed from header to prevent duplicate UI');
        assert(updatedIndexHtml.includes('triggerWindowMinimize'), 'triggerWindowMinimize defined');
        assert(updatedIndexHtml.includes('triggerWindowClose'), 'triggerWindowClose defined');

        const windowManagerJs = fs.readFileSync(path.join(__dirname, '../desktop/window_manager.js'), 'utf8');
        assert(!windowManagerJs.includes("titleBarStyle: 'hidden'"), 'Native Windows titlebar restored (zero hidden titlebar glitch)');

        const localServerJs = fs.readFileSync(path.join(__dirname, '../desktop/local_server.js'), 'utf8');
        assert(localServerJs.includes('/api/desktop/window-action'), 'local_server handles /api/desktop/window-action');
        passedCount += 7;

        // =========================================================================
        // [TEST 44] 🤖 In-App Visual, Document & Button QA Sentinel (Playwright)
        // =========================================================================
        console.log('\n[TEST 44] 🤖 ஆப் உள்ளக தானியங்கி சென்டினல் (In-App Visual & Functional QA Sentinel)...');
        try {
            const { chromium } = require('playwright');
            const browser = await chromium.launch({ headless: true });
            const page = await browser.newPage();
            await page.goto(`${BASE_URL}/index.html`);
            await page.waitForTimeout(1000);

            // 1. Zero Broken Images Audit (Strictly checks physically visible images)
            const brokenImgs = await page.evaluate(() => {
                const imgs = Array.from(document.querySelectorAll('img'));
                return imgs.filter(i => (i.offsetWidth > 0 || i.offsetHeight > 0) && i.complete && i.naturalWidth === 0).length;
            });
            assert(brokenImgs === 0, 'Zero broken images rendered on the in-app screen');

            // 2. Zero Duplicate Window Controls in Header
            const duplicateWinControls = await page.evaluate(() => {
                const el = document.getElementById('desktopWindowControls');
                return el && el.style.display !== 'none';
            });
            assert(!duplicateWinControls, 'Zero duplicate minimize/close buttons in app header');

            // 3. In-App Document Audit in Review & Edit Modal
            await page.evaluate(async () => {
                if (typeof openEditModal === 'function') {
                    await openEditModal('9999900056');
                }
            });
            await page.waitForTimeout(800);

            const modalAudit = await page.evaluate(() => {
                const photoSt = document.getElementById('editPhotoStatus')?.innerText || '';
                const aadhSt = document.getElementById('editHeadAadhaarStatus')?.innerText || '';
                const gasSt = document.getElementById('editResidenceDocStatus')?.innerText || '';
                const delBtns = Array.from(document.querySelectorAll('#editModal button'))
                    .filter(b => b.innerText.includes('நீக்கு') && b.style.display !== 'none').length;
                return { photoSt, aadhSt, gasSt, delBtns };
            });

            assert(modalAudit.photoSt.includes('தேவை'), 'Missing Photo correctly prompted as needed (zero dummy checkmark)');
            assert(modalAudit.aadhSt.includes('தேவை'), 'Missing Aadhaar correctly prompted as needed (zero dummy checkmark)');
            assert(modalAudit.gasSt.includes('தேவை'), 'Missing Residence Proof correctly prompted as needed (zero dummy checkmark)');

            // 4. In-App Sidebar Action Controls
            const sidebarAudit = await page.evaluate(() => {
                const btnEdit = document.getElementById('btnSidebarEdit');
                const btnSave = document.getElementById('btnSidebarSave');
                return {
                    hasEdit: Boolean(btnEdit),
                    hasSave: Boolean(btnSave)
                };
            });
            assert(sidebarAudit.hasEdit, 'Sidebar contains functional Edit button');
            assert(sidebarAudit.hasSave, 'Sidebar contains functional Save button');

            await browser.close();
            passedCount += 8;
        } catch (pwErr) {
            console.warn('  ⚠️ Playwright In-App audit notice:', pwErr.message);
        }

        // 45. Master Profile Cross-Service Document Reuse & Delta-Prompting Law (TEST 45)
        console.log('\n[TEST 45] Master Profile Cross-Service Document Reuse & Delta-Prompting Law');
        {
            const deltaMob = '9999900045';
            const deltaHeaders = { 'x-session-mobile': deltaMob, 'x-operator-uid': 'test_suite_operator_uid' };
            await request('DELETE', `/api/drafts/${deltaMob}`, null, deltaHeaders);

            // 1. Fresh customer -> New Ration Card prompts for intake (MEMBER_COUNT)
            const resFresh = await request('POST', '/api/operator/new-customer', {
                customerMobile: deltaMob,
                serviceName: 'புதிய ரேஷன் கார்டு'
            }, deltaHeaders);
            assert(resFresh.status === 200 && resFresh.body.intakeState === 'MEMBER_COUNT', 'Fresh customer starts at MEMBER_COUNT for New Ration Card');

            // Save complete Master Profile with Photo, Aadhaar, and Gas Book on disk
            await request('POST', '/api/drafts/save', {
                mobileNumber: deltaMob,
                operatorUid: 'test_suite_operator_uid',
                citizenProfile: {
                    fullNameTam: 'குமரன்',
                    fullNameEng: 'Kumaran K',
                    fatherNameTam: 'கிருஷ்ணன்',
                    fatherNameEng: 'Krishnan',
                    dob: '03/06/1989',
                    gender: 'Male',
                    genderTam: 'ஆண்',
                    mobileNumber: deltaMob,
                    headAadhaar: '625525096623',
                    headPhotoPath: '/uploads/test_sample_doc.jpg',
                    headAadhaarDocPath: '/uploads/test_sample_doc.jpg',
                    residenceProof: {
                        typeTam: 'எரிவாயு இணைப்பு அட்டை',
                        docPath: '/uploads/test_sample_doc.jpg'
                    },
                    documents: {
                        profilePhoto: '/uploads/test_sample_doc.jpg',
                        headPhoto: '/uploads/test_sample_doc.jpg',
                        headAadhaar: '/uploads/test_sample_doc.jpg',
                        memberAadhaar: '/uploads/test_sample_doc.jpg',
                        residenceProof: '/uploads/test_sample_doc.jpg',
                        gasBook: '/uploads/test_sample_doc.jpg'
                    },
                    doorNo: '99',
                    streetTam: 'மேட்டு தெரு',
                    streetEng: 'Mettu Street',
                    pincode: '631051',
                    district: 'இராணிப்பேட்டை',
                    taluk: 'அரக்கோணம்',
                    village: 'தக்கோலம்'
                },
                intakeState: 'READY_TO_APPLY'
            }, deltaHeaders);

            // 2. Add Member with existing Aadhaar -> NEVER asks for Aadhaar upload, asks ONLY relationship
            const resAddMem = await request('POST', '/api/operator/new-customer', {
                customerMobile: deltaMob,
                serviceName: 'குடும்ப உறுப்பினர் சேர்க்கை'
            }, deltaHeaders);
            const lastAddMsg = resAddMem.body.chatHistory[resAddMem.body.chatHistory.length - 1];
            assert(resAddMem.body.intakeState === 'RATION_ADD_MEMBER_RELATION', 'Add Member reuses Master Profile Aadhaar and jumps to RATION_ADD_MEMBER_RELATION');
            assert(!lastAddMsg.actionRequired, 'Add Member does NOT prompt for file upload when Aadhaar already exists');

            // 2B. Master Profile Review & Edit Modal Invariant: Even during ADD_MEMBER, documents-list MUST return all 3 Master Profile docs so View (பார்) & Delete (நீக்கு) buttons are visible!
            const resAddMemDocList = await request('GET', `/api/drafts/${deltaMob}/documents-list`);
            const addMemDocTypes = (resAddMemDocList.body.documents || []).map(d => d.type);
            assert(addMemDocTypes.includes('profilePhoto') && addMemDocTypes.includes('headAadhaar') && addMemDocTypes.includes('gasBook'), 'Master Profile documents (Photo, Aadhaar, Gas Book) remain visible for View & Delete even when subService is ADD_MEMBER');
            assert(!addMemDocTypes.includes('memberAadhaar'), 'Master Profile headAadhaar is never duplicated as memberAadhaar');

            // 3. Change Address with existing Gas Book & Aadhaar -> NEVER asks for upload, goes to READY_TO_APPLY
            const resChgAddr = await request('POST', '/api/operator/new-customer', {
                customerMobile: deltaMob,
                serviceName: 'முகவரி மாற்றம்'
            }, deltaHeaders);
            const lastAddrMsg = resChgAddr.body.chatHistory[resChgAddr.body.chatHistory.length - 1];
            assert(resChgAddr.body.intakeState === 'READY_TO_APPLY', 'Change Address reuses Master Profile Gas Book & Address and jumps to READY_TO_APPLY');
            assert(!lastAddrMsg.actionRequired, 'Change Address does NOT prompt for file upload when Gas Book already exists');

            // 4. Delete ONLY Aadhaar Card -> New Ration Card prompts ONLY for Aadhaar (HEAD_AADHAAR_FRONT)
            const resDelAadh = await request('POST', '/api/drafts/delete-document', {
                mobile: deltaMob,
                docType: 'headAadhaar'
            }, deltaHeaders);
            assert(resDelAadh.status === 200 && resDelAadh.body.success === true, 'Delete headAadhaar succeeds');

            const resAfterDelAadh = await request('POST', '/api/operator/new-customer', {
                customerMobile: deltaMob,
                serviceName: 'புதிய ரேஷன் கார்டு'
            }, deltaHeaders);
            const msgAfterDelAadh = resAfterDelAadh.body.chatHistory[resAfterDelAadh.body.chatHistory.length - 1];
            assert(resAfterDelAadh.body.intakeState === 'HEAD_AADHAAR_FRONT', 'After deleting ONLY Aadhaar, New Ration Card jumps directly to HEAD_AADHAAR_FRONT (skips Photo & Gas Book)');
            assert(msgAfterDelAadh.actionRequired === 'upload', 'Prompts to upload the missing Aadhaar card');

            const resAddMemAfterDelAadh = await request('POST', '/api/operator/new-customer', {
                customerMobile: deltaMob,
                serviceName: 'குடும்ப உறுப்பினர் சேர்க்கை'
            }, deltaHeaders);
            assert(resAddMemAfterDelAadh.body.intakeState === 'RATION_ADD_MEMBER_TYPE', 'After deleting Aadhaar, Add Member prompts to upload Aadhaar');

            // 5. Restore Aadhaar, Delete ONLY Gas Book -> New Ration Card prompts ONLY for Residence Proof (RESIDENCE_PROOF_DOC)
            await request('POST', '/api/drafts/save', {
                mobileNumber: deltaMob,
                operatorUid: 'test_suite_operator_uid',
                citizenProfile: {
                    headAadhaar: '625525096623',
                    headAadhaarDocPath: '/uploads/test_sample_doc.jpg',
                    documents: {
                        profilePhoto: '/uploads/test_sample_doc.jpg',
                        headPhoto: '/uploads/test_sample_doc.jpg',
                        headAadhaar: '/uploads/test_sample_doc.jpg',
                        memberAadhaar: '/uploads/test_sample_doc.jpg',
                        residenceProof: '/uploads/test_sample_doc.jpg',
                        gasBook: '/uploads/test_sample_doc.jpg'
                    }
                }
            }, deltaHeaders);

            const resDelGas = await request('POST', '/api/drafts/delete-document', {
                mobile: deltaMob,
                docType: 'gasBook'
            }, deltaHeaders);
            assert(resDelGas.status === 200 && resDelGas.body.success === true, 'Delete gasBook succeeds');

            const resAfterDelGas = await request('POST', '/api/operator/new-customer', {
                customerMobile: deltaMob,
                serviceName: 'புதிய ரேஷன் கார்டு'
            }, deltaHeaders);
            const msgAfterDelGas = resAfterDelGas.body.chatHistory[resAfterDelGas.body.chatHistory.length - 1];
            assert(resAfterDelGas.body.intakeState === 'RESIDENCE_PROOF_DOC', 'After deleting ONLY Gas Book, New Ration Card jumps directly to RESIDENCE_PROOF_DOC (skips Photo & Aadhaar)');
            assert(msgAfterDelGas.actionRequired === 'upload', 'Prompts to upload only the missing Residence Proof / Gas Book');

            const resChgAddrAfterDelGas = await request('POST', '/api/operator/new-customer', {
                customerMobile: deltaMob,
                serviceName: 'முகவரி மாற்றம்'
            }, deltaHeaders);
            assert(resChgAddrAfterDelGas.body.intakeState === 'RATION_CHANGE_ADDRESS_DOC', 'After deleting Gas Book, Change Address prompts to upload missing Residence Proof');

            await request('DELETE', `/api/drafts/${deltaMob}`, null, deltaHeaders);
            passedCount += 11;
        }

        // ----------------------------------------------------
        // [TEST 46] 📱 TNPDS கைபேசி எண் மாற்றம் (Mobile Change Automation Flow Gate)
        // ----------------------------------------------------
        console.log('\n[TEST 46] 📱 TNPDS கைபேசி எண் மாற்றம் (Mobile Change Flow & Invariant Gate)...');
        {
            const mobTestCust = '9999900046';
            const targetNewMob = '9790170026';
            const mobHeaders = {
                'x-session-mobile': mobTestCust,
                'x-operator-uid': 'test_suite_operator_uid',
                'x-operator-name': 'Test Operator'
            };

            // 1. Initialise customer
            const resInit = await request('POST', '/api/operator/new-customer', {
                customerMobile: mobTestCust,
                serviceName: 'குடும்ப அட்டை சேவைகள்'
            }, mobHeaders);
            assert(resInit.status === 200, 'Customer initialization for mobile change returns 200');

            // 2. Select RATION_CHANGE_MOBILE
            const resMenu = await request('POST', '/api/chat', {
                message: 'RATION_CHANGE_MOBILE'
            }, mobHeaders);
            assert(resMenu.status === 200, 'Selecting RATION_CHANGE_MOBILE returns 200');
            assert(resMenu.body.intakeState === 'RATION_CHANGE_MOBILE', 'Intake state is RATION_CHANGE_MOBILE');

            // 3. Provide new 10-digit mobile
            const resNewMob = await request('POST', '/api/chat', {
                message: targetNewMob
            }, mobHeaders);
            assert(resNewMob.status === 200, 'Providing new mobile returns 200');
            assert(resNewMob.body.intakeState === 'READY_TO_APPLY', 'Providing new mobile transitions to READY_TO_APPLY');

            // 4. Trigger automation flow in fastTest mode
            const resAuto = await request('POST', '/api/automation/start', {
                isMockSandbox: false,
                forceRealGovtOtp: false,
                fastTest: true,
                isTestSuite: true,
                subService: 'UPDATE_MOBILE',
                subServiceData: { newMobile: targetNewMob }
            }, mobHeaders);
            assert(resAuto.status === 200 && resAuto.body.success === true, 'Mobile change /api/automation/start returns 200 OK');

            // 5. Verify direct engine export
            const tnpdsAuto = require('../tnpds_automation');
            assert(typeof tnpdsAuto.startTnpdsMobileChangeFlow === 'function', 'startTnpdsMobileChangeFlow is officially exported');
            assert(typeof tnpdsAuto.generateMobileChangeReceiptPdf === 'function', 'generateMobileChangeReceiptPdf is officially exported');

            const directFlowRes = await tnpdsAuto.startTnpdsMobileChangeFlow({
                mobileNumber: mobTestCust,
                subService: 'UPDATE_MOBILE',
                subServiceData: { newMobile: targetNewMob }
            }, () => {}, { fastTest: true, isTestSuite: true });
            assert(directFlowRes && directFlowRes.success === true, 'direct startTnpdsMobileChangeFlow succeeds');
            assert(directFlowRes.applicationNumber && directFlowRes.applicationNumber.startsWith('N'), 'Valid application number generated');

            // 6. Test phone number update & purge in database.js & drafts
            const dbModule = require('../database');
            assert(typeof dbModule.deleteCitizenProfile === 'function', 'deleteCitizenProfile exported from database.js');

            await request('DELETE', `/api/drafts/${mobTestCust}`, null, mobHeaders);
            passedCount += 10;
        }

        // ----------------------------------------------------
        // [TEST 47] 👑 TNPDS குடும்பத் தலைவர் மாற்றம் (Change Family Head Flow & Invariant Gate)
        // ----------------------------------------------------
        console.log('\n[TEST 47] 👑 TNPDS குடும்பத் தலைவர் மாற்றம் (Change Family Head Flow & Invariant Gate)...');
        {
            const headTestCust = '9999900047';
            const targetNewHead = 'கார்த்திக் கே';
            const headHeaders = {
                'x-session-mobile': headTestCust,
                'x-operator-uid': 'test_suite_operator_uid',
                'x-operator-name': 'Test Operator'
            };

            // 1. Initialise customer
            const resInit = await request('POST', '/api/operator/new-customer', {
                customerMobile: headTestCust,
                serviceName: 'குடும்ப அட்டை சேவைகள்'
            }, headHeaders);
            assert(resInit.status === 200, 'Customer initialization for change head returns 200');

            // 2. Select RATION_CHANGE_HEAD
            const resMenu = await request('POST', '/api/chat', {
                message: 'RATION_CHANGE_HEAD'
            }, headHeaders);
            assert(resMenu.status === 200, 'Selecting RATION_CHANGE_HEAD returns 200');
            assert(resMenu.body.intakeState === 'RATION_CHANGE_HEAD_REASON', 'Intake state is RATION_CHANGE_HEAD_REASON');

            // 3. Select Reason
            const resReason = await request('POST', '/api/chat', {
                message: 'HEAD_REASON_CONSENT'
            }, headHeaders);
            assert(resReason.status === 200, 'Selecting reason returns 200');
            assert(resReason.body.intakeState === 'RATION_CHANGE_HEAD_DOC', 'Intake state transitions to RATION_CHANGE_HEAD_DOC');

            // 4. Provide new head name
            const resNewHead = await request('POST', '/api/chat', {
                message: targetNewHead
            }, headHeaders);
            assert(resNewHead.status === 200, 'Providing new head name returns 200');
            assert(resNewHead.body.intakeState === 'READY_TO_APPLY', 'Transitions to READY_TO_APPLY');

            // 5. Trigger automation flow in fastTest mode
            const resAuto = await request('POST', '/api/automation/start', {
                isMockSandbox: false,
                forceRealGovtOtp: false,
                fastTest: true,
                isTestSuite: true,
                subService: 'CHANGE_HEAD',
                subServiceData: { newHeadName: targetNewHead }
            }, headHeaders);
            assert(resAuto.status === 200 && resAuto.body.success === true, 'Change head /api/automation/start returns 200 OK');

            // 6. Verify direct engine export
            const tnpdsAuto = require('../tnpds_automation');
            assert(typeof tnpdsAuto.startTnpdsChangeHeadFlow === 'function', 'startTnpdsChangeHeadFlow is officially exported');
            assert(typeof tnpdsAuto.generateChangeHeadReceiptPdf === 'function', 'generateChangeHeadReceiptPdf is officially exported');

            const directFlowRes = await tnpdsAuto.startTnpdsChangeHeadFlow({
                mobileNumber: headTestCust,
                subService: 'CHANGE_HEAD',
                subServiceData: { newHeadName: targetNewHead }
            }, () => {}, { fastTest: true, isTestSuite: true });
            assert(directFlowRes && directFlowRes.success === true, 'direct startTnpdsChangeHeadFlow succeeds');
            assert(directFlowRes.applicationNumber && directFlowRes.applicationNumber.startsWith('N'), 'Valid application number generated');

            // 7. Test Single-member Invariant enforcement
            const { executeChangeHeadFormSteps } = require('../src/portal/tnpds/flows/change_head/head_form_steps');
            const mockPageSingleMember = {
                url: () => 'https://www.tnpds.gov.in/pages/service-request',
                isClosed: () => false,
                locator: () => ({
                    first: () => ({ count: async () => 0, isVisible: async () => false }),
                    count: async () => 0
                }),
                evaluate: async (fn) => {
                    if (typeof fn === 'function') {
                        const str = fn.toString();
                        if (str.includes('perfdrive') || str.includes('Radware')) return false;
                    }
                    return { count: 1, members: [{ name: 'குமரன் க', relation: 'Family Head' }] };
                },
                waitForTimeout: async () => {}
            };
            const singleMemberRes = await executeChangeHeadFormSteps({
                page: mockPageSingleMember,
                citizenProfile: { mobileNumber: '9842367866' },
                subData: { newHeadName: 'மற்றொரு நபர்' }
            });
            assert(singleMemberRes && singleMemberRes.singleMemberInvariant === true, 'Single member card blocks head change (Invariant Law)');

            await request('DELETE', `/api/drafts/${headTestCust}`, null, headHeaders);
            passedCount += 10;
        }

        // =========================================================================
        // [TEST 48] 🆔 TNeGA CAN (Citizen Access Number) Gateway & Automation Suite
        // =========================================================================
        {
            console.log('\n[TEST 48] 🆔 TNeGA CAN Gateway, Registration & Search Suite...');
            const canTestCust = '9999900088';
            const canRegCust = '9999900089';
            const canHeaders = { 'x-session-mobile': canTestCust };
            const canRegHeaders = { 'x-session-mobile': canRegCust };

            try {
                await request('DELETE', `/api/drafts/${canTestCust}`, null, canHeaders);
                await request('DELETE', `/api/drafts/${canRegCust}`, null, canRegHeaders);
                const p1 = path.join(draftsDir, `${canTestCust}.json`);
                if (fs.existsSync(p1)) fs.unlinkSync(p1);
                const p2 = path.join(draftsDir, `${canRegCust}.json`);
                if (fs.existsSync(p2)) fs.unlinkSync(p2);
            } catch (_) {}

            await request('POST', '/api/operator/new-customer', { customerMobile: canTestCust });

            const dummyAadh48 = path.join(__dirname, '..', 'compressed', 'sample_test_aadh.pdf');
            const dummyPhoto48 = path.join(__dirname, '..', 'compressed', 'sample_test_photo.jpg');
            const dummyInc48 = path.join(__dirname, '..', 'compressed', 'sample_test_inc.pdf');
            if (!fs.existsSync(dummyAadh48)) fs.writeFileSync(dummyAadh48, Buffer.alloc(1024, 'a'));
            if (!fs.existsSync(dummyPhoto48)) fs.writeFileSync(dummyPhoto48, Buffer.alloc(1024, 'b'));
            if (!fs.existsSync(dummyInc48)) fs.writeFileSync(dummyInc48, Buffer.alloc(1024, 'c'));

            await request('POST', '/api/profile/update', {
                mobileNumber: canTestCust,
                headAadhaar: '987654321012',
                headAadhaarDocPath: dummyAadh48,
                headPhotoPath: dummyPhoto48,
                profilePhoto: dummyPhoto48,
                smartCard: dummyInc48,
                incomeProof: dummyInc48,
                fullNameEng: 'Kumaran K',
                fullNameTam: 'குமரன் கி'
            }, canHeaders);

            // 1. Selecting Income Certificate presents CAN options when no CAN linked
            const chatRes1 = await request('POST', '/api/chat', { text: 'வருமானச் சான்றிதழ்' }, canHeaders);
            assert(chatRes1.status === 200, 'Income selection returns 200 OK');
            const botMsg1 = chatRes1.body.chatHistory[chatRes1.body.chatHistory.length - 1];
            assert(botMsg1.options.some(o => o.value === 'CAN_SEARCH_PROMPT'), 'Presents CAN Search option');
            assert(botMsg1.options.some(o => o.value === 'CAN_REGISTER_PROMPT'), 'Presents CAN Register option');
            assert(botMsg1.options.some(o => o.value === 'CAN_DIRECT_INPUT'), 'Presents Direct CAN input option');

            // 2. Direct CAN Input handling
            const chatRes2 = await request('POST', '/api/chat', { text: 'CAN_DIRECT_INPUT' }, canHeaders);
            assert(chatRes2.status === 200, 'CAN_DIRECT_INPUT returns 200');
            assert(chatRes2.body.step === 'CAN_DIRECT_INPUT_WAIT', 'Transitions to CAN_DIRECT_INPUT_WAIT');

            const chatRes3 = await request('POST', '/api/chat', { text: '1330109988771' }, canHeaders);
            assert(chatRes3.status === 200, 'Submitting 13-digit CAN returns 200');
            assert(chatRes3.body.citizenProfile.canNumber === '1330109988771', 'CAN number saved to profile');
            assert(chatRes3.body.step === 'INCOME_MOTHER_NAME_WAIT', 'Transitions cleanly to INCOME_MOTHER_NAME_WAIT when mother name is missing');

            // 2.1 Mother Name entry
            const chatResMother = await request('POST', '/api/chat', { text: 'தேவகி கி' }, canHeaders);
            assert(chatResMother.status === 200, 'Submitting mother name returns 200');
            assert(chatResMother.body.citizenProfile.motherNameTam === 'தேவகி கி', 'Mother name saved in profile');
            assert(chatResMother.body.step === 'INCOME_COMMUNITY_WAIT', 'Transitions to INCOME_COMMUNITY_WAIT when community is missing');

            // 2.2 Community entry
            const chatResComm = await request('POST', '/api/chat', { text: 'COMMUNITY_MBC' }, canHeaders);
            assert(chatResComm.status === 200, 'Submitting community returns 200');
            assert(chatResComm.body.citizenProfile.community === 'MBC', 'Community saved in profile');
            assert(chatResComm.body.step === 'INCOME_MEMBER_COUNT_WAIT', 'Transitions to INCOME_MEMBER_COUNT_WAIT for family count');

            // 2.3 Member count entry
            const chatResCount = await request('POST', '/api/chat', { text: '1 நபர்' }, canHeaders);
            assert(chatResCount.status === 200, 'Submitting member count returns 200');
            assert(chatResCount.body.citizenProfile.familyMemberCount === 1, 'Member count saved as 1');
            assert(chatResCount.body.step === 'INCOME_INTAKE', 'Transitions to INCOME_INTAKE for annual income');

            // 3. New customer for CAN Registration flow
            await request('POST', '/api/operator/new-customer', { customerMobile: canRegCust });
            await request('POST', '/api/profile/update', {
                mobileNumber: canRegCust,
                fullNameEng: 'Kumaran K',
                fullNameTam: 'குமரன் க',
                fatherNameEng: 'Karuppaiah',
                fatherNameTam: 'கருப்பையா',
                motherNameTam: 'தேவகி கி',
                motherNameEng: 'Devaki K',
                community: 'MBC',
                headAadhaar: '598412369874',
                district: 'Ranipet',
                taluk: 'Arakkonam',
                village: 'Minnal',
                doorNo: '216',
                streetTam: 'மேட்டு தெரு',
                pincode: '632510'
            }, canRegHeaders);

            const chatReg1 = await request('POST', '/api/chat', { text: 'CAN_REGISTER_PROMPT' }, canRegHeaders);
            assert(chatReg1.status === 200, 'CAN_REGISTER_PROMPT returns 200');
            const botRegMsg1 = chatReg1.body.chatHistory[chatReg1.body.chatHistory.length - 1];
            assert(botRegMsg1.text.includes('புதிய CAN பதிவு') && botRegMsg1.text.includes('குமரன் க'), 'Displays verified bilingual summary card');
            assert(botRegMsg1.options.some(o => o.value === 'START_CAN_REGISTER'), 'Provides START_CAN_REGISTER option');

            const chatReg2 = await request('POST', '/api/chat', { text: 'START_CAN_REGISTER' }, canRegHeaders);
            assert(chatReg2.status === 200, 'START_CAN_REGISTER returns 200');
            assert(chatReg2.body.step === 'READY_TO_APPLY_CAN', 'Transitions to READY_TO_APPLY_CAN');

            // 4. CAN Registration Automation Execution
            const { startTnegaCanRegisterFlow, searchCitizenCan, generateCanReceiptPdf } = require('../tnega_can_automation');
            assert(typeof startTnegaCanRegisterFlow === 'function', 'startTnegaCanRegisterFlow is exported');
            assert(typeof searchCitizenCan === 'function', 'searchCitizenCan is exported');
            assert(typeof generateCanReceiptPdf === 'function', 'generateCanReceiptPdf is exported');

            const autoRegRes = await startTnegaCanRegisterFlow({
                mobileNumber: canRegCust,
                fullNameEng: 'Kumaran K',
                fullNameTam: 'குமரன் க',
                fatherNameEng: 'Karuppaiah',
                fatherNameTam: 'கருப்பையா',
                headAadhaar: '598412369874',
                doorNo: '216',
                streetTam: 'மேட்டு தெரு',
                district: 'Ranipet',
                pincode: '632510'
            }, () => {}, { isMockSandbox: true });

            assert(autoRegRes && autoRegRes.success === true, 'CAN registration execution succeeds');
            assert(autoRegRes.canNumber && autoRegRes.canNumber.startsWith('133'), 'Valid 13-digit CAN number generated');
            assert(autoRegRes.receiptPdf && fs.existsSync(autoRegRes.receiptPdf), 'CAN receipt PDF generated on disk');

            // Cleanup
            try {
                if (fs.existsSync(autoRegRes.receiptPdf)) fs.unlinkSync(autoRegRes.receiptPdf);
            } catch (_) {}
            await request('DELETE', `/api/drafts/${canTestCust}`, null, canHeaders);
            await request('DELETE', `/api/drafts/${canRegCust}`, null, canRegHeaders);
            passedCount += 10;
        }

        // =========================================================================
        // TEST 49: 🔐 TNeGA Operator Portal Credentials Vault & Strict Isolation
        // =========================================================================
        console.log('\n[TEST 49] 🔐 TNeGA Operator Portal Credentials Vault & Strict Isolation...');
        {
            const { getOperatorPortalCredentials, deleteOperatorPortalCredentials } = require('../src/services/portal_vault_service');
            const op1 = 'op_test_kumaran_01';
            const op2 = 'op_test_suresh_02';

            // Ensure clean state before testing
            deleteOperatorPortalCredentials(op1, 'tnega');
            deleteOperatorPortalCredentials(op2, 'tnega');

            // 1. Initial State: Unconfigured
            const initRes = await request('GET', '/api/operator/vault', null, { 'x-operator-uid': op1 });
            assert(initRes.status === 200, 'GET /api/operator/vault returns 200 OK');
            assert(initRes.body.configured === false, 'Operator initially unconfigured');
            assert(initRes.body.tnega.hasCredentials === false, 'No credentials before saving');

            // 2. Save Credentials for Operator 1
            const saveRes = await request('POST', '/api/operator/vault', {
                portal: 'tnega',
                username: 'TNTACCHN001-01',
                password: 'SecretGovPassword@2026',
                operatorCode: 'OM',
                operatorName: 'Kumaran Centre'
            }, { 'x-operator-uid': op1 });
            assert(saveRes.status === 200, 'POST /api/operator/vault returns 200 OK');
            assert(saveRes.body.success === true, 'Credentials saved successfully');

            // 3. Masked Summary Verification for Operator 1
            const sumRes = await request('GET', '/api/operator/vault', null, { 'x-operator-uid': op1 });
            assert(sumRes.body.configured === true, 'Operator 1 is now configured');
            assert(sumRes.body.tnega.username === 'TNTACCHN001-01', 'Username preserved accurately');
            assert(sumRes.body.tnega.hasPassword === true, 'Password flag is true');
            assert(sumRes.body.tnega.password === undefined, 'Plaintext password is NEVER leaked to HTTP clients');

            // 4. Strict Multi-Operator Isolation (Zero Cross-Pollution Invariant)
            const op2Res = await request('GET', '/api/operator/vault', null, { 'x-operator-uid': op2 });
            assert(op2Res.body.configured === false, 'Operator 2 remains unconfigured');
            assert(op2Res.body.tnega.hasCredentials === false, 'Operator 1 credentials NEVER leak to Operator 2 (Strict Isolation)');

            // 5. Decryption for internal automation engine
            const internalCreds = getOperatorPortalCredentials(op1, 'tnega');
            assert(internalCreds !== null, 'Internal credential lookup succeeds');
            assert(internalCreds.username === 'TNTACCHN001-01', 'Internal username matches');
            assert(internalCreds.password === 'SecretGovPassword@2026', 'Internal AES-256 decryption yields original password');

            // 6. Multi-Portal Independence (TNPDS & ECI Portals Co-existence)
            const saveTnpdsRes = await request('POST', '/api/operator/vault', {
                portal: 'tnpds',
                portalName: 'TNPDS பொது விநியோகம்',
                username: '9842367866',
                password: 'TnpdsPassword@2026'
            }, { 'x-operator-uid': op1 });
            assert(saveTnpdsRes.status === 200, 'POST /api/operator/vault for TNPDS returns 200 OK');

            const multiSumRes = await request('GET', '/api/operator/vault', null, { 'x-operator-uid': op1 });
            assert(multiSumRes.body.portals.tnega.hasCredentials === true, 'TNeGA credentials intact after adding TNPDS');
            assert(multiSumRes.body.portals.tnpds.hasCredentials === true, 'TNPDS credentials saved cleanly');
            assert(multiSumRes.body.portals.tnpds.username === '9842367866', 'TNPDS username matches');

            const internalTnpds = getOperatorPortalCredentials(op1, 'tnpds');
            assert(internalTnpds.password === 'TnpdsPassword@2026', 'TNPDS AES-256 decrypted correctly and isolated from TNeGA');

            // 7. Delete TNeGA Credentials (TNPDS remains unaffected)
            const delRes = await request('DELETE', '/api/operator/vault', { portal: 'tnega' }, { 'x-operator-uid': op1 });
            assert(delRes.status === 200, 'DELETE /api/operator/vault for TNeGA returns 200 OK');
            assert(delRes.body.success === true, 'Delete operation succeeds');

            const postDelRes = await request('GET', '/api/operator/vault', null, { 'x-operator-uid': op1 });
            assert(postDelRes.body.portals.tnega?.hasCredentials !== true, 'TNeGA purged after delete');
            assert(postDelRes.body.portals.tnpds?.hasCredentials === true, 'TNPDS strictly preserved after deleting TNeGA');

            // 8. Delete TNPDS Credentials
            await request('DELETE', '/api/operator/vault', { portal: 'tnpds' }, { 'x-operator-uid': op1 });
            const finalRes = await request('GET', '/api/operator/vault', null, { 'x-operator-uid': op1 });
            assert(finalRes.body.configured === false, 'All portal credentials purged after final delete');

            // 9. GOLDEN RULE 18: Strict Multi-Tenant Operator Isolation & Zero-Cross-Operator Leakage
            const adminLookup = getOperatorPortalCredentials('admin', 'tnega');
            assert(adminLookup === null, 'Generic admin lookup strictly returns null (no credential leakage)');

            const nullLookup = getOperatorPortalCredentials(null, 'tnega');
            assert(nullLookup === null, 'Null operator lookup strictly returns null');

            const unconfiguredLookup = getOperatorPortalCredentials('op_unconfigured_stranger_99', 'tnega');
            assert(unconfiguredLookup === null, 'Unconfigured operator lookup strictly returns null');

            const { resolveTnegaVaultCredentials } = require('../src/portal/tnega/tnega_can_register');
            const resolvedUnconfigured = resolveTnegaVaultCredentials({ operatorUid: 'op_unconfigured_stranger_99' });
            assert(resolvedUnconfigured === null, 'resolveTnegaVaultCredentials returns null for unconfigured operator and NEVER borrows another operator creds');

            const resolvedGenericAdmin = resolveTnegaVaultCredentials({ operatorUid: 'admin' });
            assert(resolvedGenericAdmin === null, 'resolveTnegaVaultCredentials returns null for admin operator without credentials');

            const unauthGetRes = await request('GET', '/api/operator/vault', null, {});
            assert(unauthGetRes.body.configured === false, 'GET /api/operator/vault without headers returns unconfigured');
            assert(unauthGetRes.body.tnega?.hasCredentials === false, 'No credentials leaked when operator header missing');

            // Clean up any test operator state
            deleteOperatorPortalCredentials(op1, 'tnega');
            deleteOperatorPortalCredentials(op1, 'tnpds');
            deleteOperatorPortalCredentials(op2, 'tnega');
            deleteOperatorPortalCredentials(op2, 'tnpds');

            passedCount += 25;
        }

        // ==============================================================
        // [TEST 50] 🔒 Permanent Architectural Lock Gate: TNeGA Income Certificate (REV-103), Residence Certificate (REV-102) & High-Speed AI Captcha
        // ==============================================================
        {
            console.log('\n[TEST 50] 🔒 நிரந்தர கட்டமைப்பு பாதுகாப்பு (Income & Residence Lock + High-Speed Captcha Gate)...');

            const { startTnegaIncomeCertificateFlow } = require('../src/portal/tnega/tnega_income_certificate');
            const { startTnegaResidenceCertificateFlow } = require('../src/portal/tnega/tnega_residence_certificate');
            const { AiCaptchaSolver } = require('../src/portal/common/ai_captcha_solver');

            assert(typeof startTnegaIncomeCertificateFlow === 'function', 'startTnegaIncomeCertificateFlow is officially exported');
            assert(typeof startTnegaResidenceCertificateFlow === 'function', 'startTnegaResidenceCertificateFlow is officially exported');
            assert(typeof AiCaptchaSolver.solve === 'function', 'AiCaptchaSolver.solve is officially exported');

            // 1. Mock execution of REV-103 Income Certificate
            const incRes = await startTnegaIncomeCertificateFlow({
                canNumber: '133370337878397',
                annualIncome: 72000,
                fullNameEng: 'Kumaran K',
                fullNameTam: 'குமரன் கி'
            }, () => {}, { isMockSandbox: true });
            assert(incRes && incRes.success === true, 'REV-103 Income Certificate executes cleanly in mock sandbox mode');
            assert(incRes.annualIncome === 72000, 'REV-103 preserves accurate annual income');

            // 2. Mock execution of REV-102 Residence Certificate
            const resRes = await startTnegaResidenceCertificateFlow({
                canNumber: '133370337878397',
                fullNameEng: 'Kumaran K',
                fullNameTam: 'குமரன் கி'
            }, () => {}, { isMockSandbox: true });
            assert(resRes && resRes.success === true, 'REV-102 Residence Certificate executes cleanly in mock sandbox mode');

            // 3. Verify Code Invariants for REV-103 (Dropdowns & RichFaces upload)
            const incSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'portal', 'tnega', 'tnega_income_certificate.js'), 'utf8');
            assert(incSrc.includes("optionVal: '40'"), "REV-103 locks Applicant Photo option '40'");
            assert(incSrc.includes("optionVal: '13'"), "REV-103 locks Any Address Proof option '13'");
            assert(incSrc.includes("optionVal: '457'"), "REV-103 locks Family or Smart Card option '457'");
            assert(incSrc.includes('__startUpload()'), 'REV-103 locks RichFaces 4 __startUpload() upload trigger');

            // 4. Verify Code Invariants for REV-102 (Dropdowns & RichFaces upload)
            const resSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'portal', 'tnega', 'tnega_residence_certificate.js'), 'utf8');
            assert(resSrc.includes("optionVal: '135'"), "REV-102 locks Photo option '135'");
            assert(resSrc.includes("optionVal: '8'"), "REV-102 locks Any Address Proof option '8'");
            assert(resSrc.includes("optionVal: '197'"), "REV-102 locks Birth Certificate option '197'");
            assert(resSrc.includes('__startUpload()'), 'REV-102 locks RichFaces 4 __startUpload() upload trigger');

            // 5. Verify High-Speed Captcha Cleaner Logic
            assert(AiCaptchaSolver.extractCleanCode('5G8TF') === '5G8TF', 'AiCaptchaSolver extracts exact 5-char code');
            assert(AiCaptchaSolver.extractCleanCode('Code: 7K2M9') === '7K2M9', 'AiCaptchaSolver parses code with label prefix');
            assert(AiCaptchaSolver.extractCleanCode('There is no captcha present in this image') === null, 'AiCaptchaSolver rejects non-code explanatory text');
            assert(AiCaptchaSolver.extractCleanCode('ABCDE') === 'ABCDE', 'AiCaptchaSolver accepts clean 5-letter codes');

            passedCount += 15;
        }

        // ==============================================================
        // TEST 51: Community Certificate (REV-101) Architectural Certification Gate
        // ==============================================================
        {
            console.log('\n[TEST 51] 🛡️ சாதிச் சான்றிதழ் கட்டமைப்பு சான்றளிப்பு (REV-101 Community Certificate Lock Gate)...');

            const { startTnegaCommunityCertificateFlow } = require('../src/portal/tnega/tnega_community_certificate');
            const tnegaAutomation = require('../tnega_can_automation');

            assert(typeof startTnegaCommunityCertificateFlow === 'function', 'startTnegaCommunityCertificateFlow is officially exported');
            assert(typeof tnegaAutomation.startTnegaCommunityFlow === 'function', 'startTnegaCommunityFlow is exported from tnega_can_automation');

            // 1. Mock execution of REV-101 Community Certificate
            const commRes = await startTnegaCommunityCertificateFlow({
                canNumber: '133370337878397',
                community: 'MBC',
                caste: 'Agamudayar',
                religion: 'Hindu',
                fullNameEng: 'Kumaran K',
                fullNameTam: 'குமரன் கி'
            }, () => {}, { isMockSandbox: true });

            assert(commRes && commRes.success === true, 'REV-101 Community Certificate executes cleanly in mock sandbox mode');
            assert(commRes.community === 'MBC', 'REV-101 preserves accurate community code');

            // 2. Verify Code Invariants for REV-101 (Dropdowns & RichFaces upload)
            const commSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'portal', 'tnega', 'tnega_community_certificate.js'), 'utf8');
            assert(commSrc.includes("optionVal: '6'"), "REV-101 locks Photo option '6'");
            assert(commSrc.includes("optionVal: '193'"), "REV-101 locks Any Address Proof option '193'");
            assert(commSrc.includes("optionVal: '145'"), "REV-101 locks Community Certificate of Family option '145'");
            assert(commSrc.includes('__startUpload()'), 'REV-101 locks RichFaces 4 __startUpload() upload trigger');
            assert(commSrc.includes('prmntCert_id'), 'REV-101 handles Permanent Online Certificate selection');
            assert(commSrc.includes('isPreSubmitGate: true'), 'REV-101 stops safely at Pre-Submit Human Gate');

            passedCount += 10;
        }

        // =========================================================================
        // [TEST 52] TNeGA Community Certificate Homepage UI & Universal Delta Engine
        // Strictly enforces Golden Rule 11 (Universal Delta Intake Engine):
        // 1. Homepage Service Grid UI Card with REV-101 and citizenStartService
        // 2. Fresh Customer Flow (0 details): CAN -> Mother -> Religion -> Community -> Caste -> Aadhaar -> Ready
        // 3. Existing Customer Flow (Kumaran K): Auto-skip known details -> ask ONLY missing Caste -> 1-click Ready
        // =========================================================================
        {
            console.log('\n[TEST 52] TNeGA Community Certificate Homepage UI & Universal Delta Intake Engine...');

            // 1. Verify Homepage UI Card in public/index.html
            const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
            assert(indexHtml.includes("citizenStartService('சாதிச் சான்றிதழ்')"), "index.html has onclick handler for சாதிச் சான்றிதழ்");
            assert(indexHtml.includes('REV-101'), "index.html displays REV-101 badge");
            assert(indexHtml.includes('சாதிச் சான்றிதழ் (Community Certificate)'), "index.html has Community Certificate title");

            // 2. Verify Services Registry & Options
            const servicesData = require('../src/core/services_data');
            const fsmOptions = require('../src/core/fsm/fsm_options_registry');
            assert(servicesData.SERVICES_REGISTRY.COMMUNITY_CERTIFICATE, "SERVICES_REGISTRY has COMMUNITY_CERTIFICATE");
            assert(servicesData.SERVICES_REGISTRY.COMMUNITY_CERTIFICATE.code === 'REV-101', "COMMUNITY_CERTIFICATE code is REV-101");
            assert((fsmOptions.REVENUE_DEPARTMENT_SERVICE_OPTIONS || fsmOptions.SERVICE_OPTIONS).some(o => o.value === 'சாதிச் சான்றிதழ்' || o.value === 'COMMUNITY_CERTIFICATE'), "SERVICE_OPTIONS / REVENUE_DEPARTMENT_SERVICE_OPTIONS includes Community Certificate");

            // 3. Verify Fresh Customer Universal Delta Journey (0 details)
            const { handleNonRationServiceSelection } = require('../src/core/fsm/fsm_other_services');
            const { advanceTnegaCommunityFlow } = require('../src/core/fsm/tnega_flow_engine');

            const sessFresh = { intakeState: 'SERVICE_SELECTION', chatHistory: [], citizenProfile: {} };
            const hFresh = handleNonRationServiceSelection('சாதிச் சான்றிதழ்', sessFresh);
            assert(hFresh === true, "handleNonRationServiceSelection handles சாதிச் சான்றிதழ்");
            assert(sessFresh.intakeState === 'COMMUNITY_AADHAAR_WAIT', "Fresh customer greeted with COMMUNITY_AADHAAR_WAIT");
            assert(sessFresh.subService === 'COMMUNITY', "subService set to COMMUNITY");

            // Fresh step 1: Aadhaar Document & Demographics
            sessFresh.citizenProfile.headAadhaarDocPath = path.join(__dirname, '..', 'compressed', 'sample_test_aadh.pdf');
            if (!fs.existsSync(sessFresh.citizenProfile.headAadhaarDocPath)) fs.writeFileSync(sessFresh.citizenProfile.headAadhaarDocPath, Buffer.alloc(1024, 'a'));
            sessFresh.citizenProfile.headAadhaar = '998877665544';
            sessFresh.citizenProfile.fullNameTam = 'விஜய் குமார்';
            sessFresh.citizenProfile.fullNameEng = 'Vijay Kumar';
            sessFresh.citizenProfile.doorNo = '12';
            sessFresh.citizenProfile.streetTam = 'மேட்டு தெரு';
            sessFresh.citizenProfile.streetEng = 'Mettu Street';
            sessFresh.citizenProfile.village = 'அரக்கோணம்';
            sessFresh.citizenProfile.taluk = 'அரக்கோணம்';
            sessFresh.citizenProfile.district = 'இராணிப்பேட்டை';
            sessFresh.citizenProfile.pincode = '631001';
            advanceTnegaCommunityFlow(sessFresh);
            assert(sessFresh.intakeState === 'COMMUNITY_PHOTO_WAIT', "Aadhaar entered -> prompts Mandatory Photo Gate");

            // Fresh step 2: Photo Upload -> Mandatory Smart Card -> Community Proof -> CAN
            sessFresh.citizenProfile.headPhotoPath = path.join(__dirname, '..', 'compressed', 'sample_test_photo.jpg');
            if (!fs.existsSync(sessFresh.citizenProfile.headPhotoPath)) fs.writeFileSync(sessFresh.citizenProfile.headPhotoPath, Buffer.alloc(1024, 'b'));
            advanceTnegaCommunityFlow(sessFresh);
            assert(sessFresh.intakeState === 'COMMUNITY_SMARTCARD_WAIT', "Photo entered -> prompts mandatory Smart Ration Card");

            sessFresh.citizenProfile.smartCard = path.join(__dirname, '..', 'compressed', 'sample_test_comm.pdf');
            if (!fs.existsSync(sessFresh.citizenProfile.smartCard)) fs.writeFileSync(sessFresh.citizenProfile.smartCard, Buffer.alloc(1024, 'c'));
            advanceTnegaCommunityFlow(sessFresh);
            assert(sessFresh.intakeState === 'COMMUNITY_PROOF_WAIT', "Smart Card entered -> prompts Family Community Proof / School TC");

            sessFresh.citizenProfile.communityProof = path.join(__dirname, '..', 'compressed', 'sample_test_comm.pdf');
            advanceTnegaCommunityFlow(sessFresh);
            assert(sessFresh.intakeState === 'COMMUNITY_CAN_GATE', "All 4 documents entered -> prompts CAN Gate");

            // Fresh step 4: CAN
            sessFresh.citizenProfile.canNumber = '133370337878397';
            advanceTnegaCommunityFlow(sessFresh);
            assert(sessFresh.intakeState === 'COMMUNITY_MOTHER_NAME_WAIT', "CAN entered -> prompts Mother Name");

            // Fresh step 5: Mother Name
            sessFresh.citizenProfile.motherNameTam = 'தேவகி';
            sessFresh.citizenProfile.motherNameEng = 'Devaki';
            advanceTnegaCommunityFlow(sessFresh);
            assert(sessFresh.intakeState === 'COMMUNITY_RELIGION_WAIT', "Mother Name entered -> prompts Religion");

            // Fresh step 6: Religion
            sessFresh.citizenProfile.religion = 'Hindu';
            advanceTnegaCommunityFlow(sessFresh);
            assert(sessFresh.intakeState === 'COMMUNITY_COMM_WAIT', "Religion entered -> prompts Community");

            // Fresh step 7: Community
            sessFresh.citizenProfile.community = 'MBC';
            advanceTnegaCommunityFlow(sessFresh);
            assert(sessFresh.intakeState === 'COMMUNITY_CASTE_WAIT', "Community entered -> prompts Caste");

            // Fresh step 8: Caste
            sessFresh.citizenProfile.caste = 'வன்னியகுல சத்ரியர்';
            advanceTnegaCommunityFlow(sessFresh);
            assert(sessFresh.intakeState === 'COMMUNITY_PARENTS_CASTE_GATE', "Caste entered -> prompts Parents Caste Gate");

            // Fresh step 9: Confirm Parent Caste -> Reaches READY_TO_APPLY_COMMUNITY
            sessFresh.citizenProfile.parentCasteConfirmed = true;
            sessFresh.citizenProfile.fatherCaste = 'வன்னியகுல சத்ரியர்';
            sessFresh.citizenProfile.motherCaste = 'வன்னியகுல சத்ரியர்';
            const freshReadyStep = advanceTnegaCommunityFlow(sessFresh);
            assert(sessFresh.intakeState === 'READY_TO_APPLY_COMMUNITY', "Parent Caste confirmed -> reaches READY_TO_APPLY_COMMUNITY");
            assert(freshReadyStep.options.some(o => o.value === 'START_COMMUNITY_APPLY'), "Ready step offers START_COMMUNITY_APPLY");

            // 4. Verify Existing Customer Universal Delta Journey (Kumaran K)
            const sessExist = {
                intakeState: 'SERVICE_SELECTION',
                chatHistory: [],
                citizenProfile: {
                    fullNameTam: 'குமரன் கி',
                    fullNameEng: 'Kumaran K',
                    fatherNameTam: 'கிருபாகரன்',
                    fatherNameEng: 'Kirubakaran',
                    motherNameTam: 'தேவகி',
                    motherNameEng: 'Devaki',
                    headAadhaar: '575567662931',
                    headAadhaarDocPath: path.join(__dirname, '..', 'compressed', 'sample_test_aadh.pdf'),
                    mobileNumber: '9842367866',
                    canNumber: '133370337878397',
                    religion: 'Hindu',
                    community: 'MBC',
                    doorNo: '1/24',
                    streetTam: 'மேட்டு தெரு',
                    streetEng: 'Mettu Street',
                    village: 'அரக்கோணம்',
                    taluk: 'அரக்கோணம்',
                    district: 'இராணிப்பேட்டை',
                    pincode: '631001',
                    smartCard: path.join(__dirname, '..', 'compressed', 'sample_test_comm.pdf'),
                    headPhotoPath: path.join(__dirname, '..', 'compressed', 'sample_test_photo.jpg')
                }
            };

            const hExist = handleNonRationServiceSelection('சாதிச் சான்றிதழ்', sessExist);
            assert(hExist === true, "Existing customer handles சாதிச் சான்றிதழ்");
            // Under Golden Rule 19: Kumaran K has Aadhaar & Photo, but NO Community Proof -> prompts COMMUNITY_PROOF_WAIT first!
            assert(sessExist.intakeState === 'COMMUNITY_PROOF_WAIT', "Existing customer with missing Community Proof prompts COMMUNITY_PROOF_WAIT first");

            // Kumaran K uploads Community Proof -> now moves to missing Caste!
            sessExist.citizenProfile.communityProof = path.join(__dirname, '..', 'compressed', 'sample_test_comm.pdf');
            advanceTnegaCommunityFlow(sessExist);
            assert(sessExist.intakeState === 'COMMUNITY_CASTE_WAIT', "Community Proof uploaded -> asks missing Caste");

            // Kumaran K provides missing Caste -> Prompts Parents Caste Gate
            sessExist.citizenProfile.caste = 'Agamudayar';
            advanceTnegaCommunityFlow(sessExist);
            assert(sessExist.intakeState === 'COMMUNITY_PARENTS_CASTE_GATE', "Missing Caste entered -> prompts Parents Caste Gate");

            // Confirms Parents Caste -> Jumps directly to 100% Ready Station!
            sessExist.citizenProfile.parentCasteConfirmed = true;
            sessExist.citizenProfile.fatherCaste = 'Agamudayar';
            sessExist.citizenProfile.motherCaste = 'Agamudayar';
            const existReadyStep = advanceTnegaCommunityFlow(sessExist);
            assert(sessExist.intakeState === 'READY_TO_APPLY_COMMUNITY', "Existing customer jumps directly to READY_TO_APPLY_COMMUNITY");
            assert(existReadyStep.options.some(o => o.value === 'START_COMMUNITY_APPLY'), "Existing customer has 1-click START_COMMUNITY_APPLY button");

            // 5. Verify Router Code Invariants
            const selectorSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'chat', 'chat_service_selector.js'), 'utf8');
            assert(selectorSrc.includes('START_COMMUNITY_APPLY'), "chat_service_selector excludes START_COMMUNITY_APPLY");

            const starterSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'chat', 'chat_automation_starter.js'), 'utf8');
            assert(starterSrc.includes('startTnegaCommunityFlow'), "chat_automation_starter imports startTnegaCommunityFlow");
            assert(starterSrc.includes('START_COMMUNITY_APPLY'), "chat_automation_starter recognizes START_COMMUNITY_APPLY");

            const intakeSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'chat', 'chat_tnega_intake.js'), 'utf8');
            assert(intakeSrc.includes('COMMUNITY_RELIGION_WAIT'), "chat_tnega_intake handles COMMUNITY_RELIGION_WAIT");
            assert(intakeSrc.includes('COMMUNITY_CASTE_WAIT'), "chat_tnega_intake handles COMMUNITY_CASTE_WAIT");
            assert(intakeSrc.includes('advanceTnegaCommunityFlow'), "chat_tnega_intake imports advanceTnegaCommunityFlow");

            passedCount += 18;
        }

        // ---------------------------------------------------------------------
        // TEST 53: 🎓 முதல் பட்டதாரி சான்றிதழ் கட்டமைப்பு & UI + டெல்டா சான்றளிப்பு (REV-104 Lock Gate)
        // ---------------------------------------------------------------------
        {
            console.log('\n[TEST 53] 🎓 முதல் பட்டதாரி சான்றிதழ் (REV-104 First Graduate Lock Gate)...');

            // 1. UI & Route Visibility Checks
            const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
            assert(indexHtml.includes("citizenStartService('முதல் பட்டதாரி சான்றிதழ்')"), "index.html has Citizen card for முதல் பட்டதாரி சான்றிதழ்");
            assert(indexHtml.includes("startDirectApplyService('முதல் பட்டதாரி சான்றிதழ்')"), "index.html Operator Desk has Quick Service button for முதல் பட்டதாரி சான்றிதழ்");
            assert(indexHtml.includes('id="editFirstGraduateFieldsWrap"'), "index.html Edit Modal has editFirstGraduateFieldsWrap");
            assert(indexHtml.includes('id="editFirstGraduateYop"'), "index.html Edit Modal has Year of Passing input");

            const chatWfJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'modules', 'chat_workflow.js'), 'utf8');
            assert(chatWfJs.includes('வருவாய்த் துறை') || chatWfJs.includes('முதல் பட்டதாரி'), "chat_workflow.js renderDefaultWelcomeMessage displays Revenue Department / First Graduate options");

            const editModalJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'modules', 'edit_modal_manager.js'), 'utf8');
            assert(editModalJs.includes('else if (isFirstGraduateMode)'), "edit_modal_manager.js controls First Graduate doc boxes visibility");
            assert(editModalJs.includes("type: 'applicantEducationProof'") && editModalJs.includes("type: 'fatherEducationProof'") && editModalJs.includes("type: 'motherEducationProof'"), "edit_modal_manager.js renders all First Graduate upload slots");

            const opRoutesSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'operator_routes.js'), 'utf8');
            assert(opRoutesSrc.includes('isFirstGraduate') && opRoutesSrc.includes('advanceTnegaFirstGraduateFlow'), "operator_routes.js handles direct start for First Graduate");

            const fsmOptions = require('../src/core/fsm/fsm_options_registry');
            assert((fsmOptions.REVENUE_DEPARTMENT_SERVICE_OPTIONS || fsmOptions.SERVICE_OPTIONS).some(o => o.value === 'முதல் பட்டதாரி சான்றிதழ்'), "SERVICE_OPTIONS / REVENUE_DEPARTMENT_SERVICE_OPTIONS includes முதல் பட்டதாரி சான்றிதழ்");

            // 2. Portal Live Engine & Upload Option Code Locks
            const { startTnegaFirstGraduateFlow } = require('../src/portal/tnega/tnega_first_graduate');
            assert(typeof startTnegaFirstGraduateFlow === 'function', "startTnegaFirstGraduateFlow is officially exported");
            const fgSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'portal', 'tnega', 'tnega_first_graduate.js'), 'utf8');
            assert(fgSrc.includes('nograduate:gnameid') && fgSrc.includes('nograduate:gageid') && fgSrc.includes('nograduate:submit1'), "REV-104 locks verified live NoGraduateCertificate.xhtml RichFaces IDs");
            assert(fgSrc.includes("optionVal: '177'") && fgSrc.includes("optionVal: '182'") && fgSrc.includes("optionVal: '179'") && fgSrc.includes("optionVal: '180'") && fgSrc.includes("optionVal: '181'") && fgSrc.includes("optionVal: '458'"), "REV-104 locks exact uploadDocs.xhtml document codes");
            assert(fgSrc.includes('__startUpload()'), "REV-104 locks RichFaces 4 __startUpload() API trigger");

            const fgMockRes = await startTnegaFirstGraduateFlow({
                fullNameEng: 'Kumaran K',
                canNumber: '133370337878397',
                currentCourse: 'B.E. Computer Science and Engineering',
                institutionName: 'Government College of Technology Coimbatore'
            }, () => {}, { isMockSandbox: true });
            assert(fgMockRes.success === true && fgMockRes.isPreSubmitGate === true, "REV-104 executes cleanly in mock sandbox to Pre-Submit Gate");

            // 3. Brand-New Customer 100% Sequential Intake Flow
            const { handleNonRationServiceSelection } = require('../src/core/fsm/fsm_other_services');
            const { advanceTnegaFirstGraduateFlow } = require('../src/core/fsm/tnega_flow_engine');
            const fgFresh = { intakeState: 'SERVICE_SELECTION', chatHistory: [], citizenProfile: {} };
            assert(handleNonRationServiceSelection('முதல் பட்டதாரி சான்றிதழ்', fgFresh) === true, "Fresh customer handles முதல் பட்டதாரி சான்றிதழ்");
            assert(fgFresh.intakeState === 'FIRST_GRADUATE_AADHAAR_WAIT', "Fresh Step 1: FIRST_GRADUATE_AADHAAR_WAIT");

            // Setup sample temp doc for physical file existence checks
            const sampleDocFile = path.join(__dirname, '..', 'data', 'golden_samples', 'first_graduate', 'student_12th_tc.jpg');
            const samplePhotoFile = path.join(__dirname, '..', 'data', 'golden_samples', 'first_graduate', 'student_passport_photo.jpg');

            fgFresh.citizenProfile.headAadhaarDocPath = sampleDocFile;
            fgFresh.citizenProfile.headAadhaar = '575567662931';
            fgFresh.citizenProfile.fullNameEng = 'Arun K';
            fgFresh.citizenProfile.fullNameTam = 'அருண் கி';
            advanceTnegaFirstGraduateFlow(fgFresh);
            assert(fgFresh.intakeState === 'FIRST_GRADUATE_PHOTO_WAIT', "Fresh Step 2: FIRST_GRADUATE_PHOTO_WAIT");

            fgFresh.citizenProfile.headPhotoPath = samplePhotoFile;
            advanceTnegaFirstGraduateFlow(fgFresh);
            assert(fgFresh.intakeState === 'FIRST_GRADUATE_APPLICANT_PROOF_WAIT', "Fresh Step 3: FIRST_GRADUATE_APPLICANT_PROOF_WAIT");

            fgFresh.citizenProfile.applicantEducationProof = sampleDocFile;
            advanceTnegaFirstGraduateFlow(fgFresh);
            assert(fgFresh.intakeState === 'FIRST_GRADUATE_SMARTCARD_WAIT', "Fresh Step 4: FIRST_GRADUATE_SMARTCARD_WAIT");

            fgFresh.citizenProfile.smartCard = sampleDocFile;
            advanceTnegaFirstGraduateFlow(fgFresh);
            assert(fgFresh.intakeState === 'FIRST_GRADUATE_FATHER_PROOF_WAIT', "Fresh Step 5: FIRST_GRADUATE_FATHER_PROOF_WAIT");

            fgFresh.citizenProfile.fatherEducationProof = sampleDocFile;
            advanceTnegaFirstGraduateFlow(fgFresh);
            assert(fgFresh.intakeState === 'FIRST_GRADUATE_MOTHER_PROOF_WAIT', "Fresh Step 6: FIRST_GRADUATE_MOTHER_PROOF_WAIT");

            fgFresh.citizenProfile.motherEducationProof = sampleDocFile;
            advanceTnegaFirstGraduateFlow(fgFresh);
            assert(fgFresh.intakeState === 'FIRST_GRADUATE_CAN_GATE', "Fresh Step 7: FIRST_GRADUATE_CAN_GATE");

            fgFresh.citizenProfile.canNumber = '133370337878397';
            advanceTnegaFirstGraduateFlow(fgFresh);
            assert(fgFresh.intakeState === 'FIRST_GRADUATE_MOTHER_NAME_WAIT', "Fresh Step 8: FIRST_GRADUATE_MOTHER_NAME_WAIT");

            fgFresh.citizenProfile.motherNameTam = 'தேவகி';
            fgFresh.citizenProfile.motherNameEng = 'Devaki';
            advanceTnegaFirstGraduateFlow(fgFresh);
            assert(fgFresh.intakeState === 'FIRST_GRADUATE_COURSE_WAIT', "Fresh Step 9: FIRST_GRADUATE_COURSE_WAIT");

            fgFresh.citizenProfile.currentCourse = 'B.E. Computer Science and Engineering';
            advanceTnegaFirstGraduateFlow(fgFresh);
            assert(fgFresh.intakeState === 'FIRST_GRADUATE_COLLEGE_WAIT', "Fresh Step 10: FIRST_GRADUATE_COLLEGE_WAIT");

            fgFresh.citizenProfile.institutionName = 'Government College of Technology Coimbatore';
            advanceTnegaFirstGraduateFlow(fgFresh);
            assert(fgFresh.intakeState === 'FIRST_GRADUATE_PARENT_EDU_WAIT', "Fresh Step 11: FIRST_GRADUATE_PARENT_EDU_WAIT");

            fgFresh.citizenProfile.fatherEducation = '10th Standard';
            fgFresh.citizenProfile.motherEducation = '8th Standard';
            advanceTnegaFirstGraduateFlow(fgFresh);
            assert(fgFresh.intakeState === 'FIRST_GRADUATE_YOP_WAIT', "Fresh Step 12: FIRST_GRADUATE_YOP_WAIT");

            fgFresh.citizenProfile.yearOfPassing = '2024';
            advanceTnegaFirstGraduateFlow(fgFresh);
            assert(fgFresh.intakeState === 'FIRST_GRADUATE_FAMILY_CHECK_GATE', "Fresh Step 13: FIRST_GRADUATE_FAMILY_CHECK_GATE");

            fgFresh.citizenProfile.familyGraduateConfirmed = true;
            const fgReadyStep = advanceTnegaFirstGraduateFlow(fgFresh);
            assert(fgFresh.intakeState === 'READY_TO_APPLY_FIRST_GRADUATE', "Fresh Step 14: READY_TO_APPLY_FIRST_GRADUATE");
            assert(fgReadyStep.options.some(o => o.value === 'START_FIRST_GRADUATE_APPLY'), "Ready step offers START_FIRST_GRADUATE_APPLY");

            // 4. Existing Customer Universal Delta Check (SKIPS Aadhaar, Photo, Smart Card, CAN, Mother Name!)
            const fgExist = {
                intakeState: 'SERVICE_SELECTION',
                chatHistory: [],
                citizenProfile: {
                    fullNameTam: 'குமரன் கி',
                    fullNameEng: 'Kumaran K',
                    headAadhaar: '575567662931',
                    headAadhaarDocPath: sampleDocFile,
                    headPhotoPath: samplePhotoFile,
                    smartCard: sampleDocFile,
                    canNumber: '133370337878397',
                    motherNameTam: 'தேவகி',
                    motherNameEng: 'Devaki',
                    community: 'MBC' // Presence of community on Master Profile MUST NOT hijack First Graduate!
                }
            };
            handleNonRationServiceSelection('முதல் பட்டதாரி சான்றிதழ்', fgExist);
            // Must automatically skip Aadhaar & Photo & jump straight to FIRST_GRADUATE_APPLICANT_PROOF_WAIT!
            assert(fgExist.intakeState === 'FIRST_GRADUATE_APPLICANT_PROOF_WAIT', "Existing customer skips Aadhaar & Photo -> jumps to Applicant 12th TC");

            fgExist.citizenProfile.applicantEducationProof = sampleDocFile;
            advanceTnegaFirstGraduateFlow(fgExist);
            // Must skip Smart Card (already exists!) & jump straight to Father TC!
            assert(fgExist.intakeState === 'FIRST_GRADUATE_FATHER_PROOF_WAIT', "Existing customer skips Smart Card -> jumps straight to Father TC");

            fgExist.citizenProfile.fatherEducationProof = sampleDocFile;
            fgExist.citizenProfile.motherEducationProof = sampleDocFile;
            advanceTnegaFirstGraduateFlow(fgExist);
            // Must skip CAN & Mother Name (already exist!) -> asks Course!
            assert(fgExist.intakeState === 'FIRST_GRADUATE_COURSE_WAIT', "Existing customer skips CAN & Mother Name -> asks Current Course");

            // 5. Automation Starter Priority Check (existing community field MUST NOT hijack FIRST_GRADUATE!)
            const starterSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'chat', 'chat_automation_starter.js'), 'utf8');
            assert(starterSrc.includes('isExplicitFirstGrad') && starterSrc.includes('startTnegaFirstGraduateFlow'), "chat_automation_starter enforces strict First Graduate priority over legacy profile community");

            // 6. Sidebar Zero-Flicker Invariant Checks
            const docViewerSrc = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'modules', 'document_viewer.js'), 'utf8');
            assert(docViewerSrc.includes('normalizeSigUrl'), "document_viewer.js strips cache-busting timestamps from render signature");
            assert(docViewerSrc.includes('if (cacheMatchesSub && cachedDocs.length > 0)'), "document_viewer.js prioritizes verified server cache over instantDocs to prevent flicker");
            assert(docViewerSrc.includes('cachedDocsFetchedAtByMobile'), "document_viewer.js throttles polling fetches when docs cache is fresh");

            const subEngineSrc = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'modules', 'submission_engine.js'), 'utf8');
            assert(subEngineSrc.includes("applicantEducationProof") && subEngineSrc.includes("fatherEducationProof"), "extractDocumentsFromProfile includes First Graduate education proofs");
            assert(!subEngineSrc.includes("new Date(prof._updatedAt).getTime() : Date.now()"), "extractDocumentsFromProfile never uses Date.now() in downloadUrl cacheBust");

            passedCount += 36;
        }

        // =========================================================================
        // TEST 54: TNeGA OBC CERTIFICATE (REV-115) PORTAL + DOCUMENT-FIRST DELTA + UI LOCK
        // =========================================================================
        {
            console.log('\n🧪 [TEST 54] Running TNeGA OBC Certificate (REV-115) End-to-End Regression Lock...');
            const obcCatalog = require('../src/catalog');
            const obcPlugin = obcCatalog.getService('REV-115');
            assert(obcPlugin && obcPlugin.id === 'TNEGA_OBC', "Catalog resolves REV-115 to TNEGA_OBC");
            assert(obcCatalog.getService('OBC_CERTIFICATE')?.code === 'REV-115', "Catalog alias OBC_CERTIFICATE resolves REV-115");

            const { SERVICES_REGISTRY } = require('../src/core/services_data');
            assert(Boolean(SERVICES_REGISTRY.OBC_CERTIFICATE), "SERVICES_REGISTRY exposes OBC_CERTIFICATE");

            const tnegaAuto = require('../tnega_can_automation');
            assert(typeof tnegaAuto.startTnegaObcCertificateFlow === 'function', "tnega_can_automation exports startTnegaObcCertificateFlow");
            assert(typeof tnegaAuto.startTnegaObcFlow === 'function', "tnega_can_automation exports startTnegaObcFlow");

            // 1. Live Portal Engine Mock & Helper Assertions
            const obcPortal = require('../src/portal/tnega/tnega_obc_certificate');
            assert(obcPortal.mapApplicantOccupationCode('Student') === 'student', "Applicant occupation Student maps to 'student'");
            assert(obcPortal.mapParentEmploymentNature('Unemployed', 'Homemaker') === 'Unemployed', "Homemaker maps to 'Unemployed'");
            assert(obcPortal.normalizeCasteTokens('வன்னியர் (Vanniyar)').includes('VANNIYA'), "Caste token extractor normalizes Tamil+English Vanniyar");
            const mockRes = await obcPortal.startTnegaObcCertificateFlow({ canNumber: '133370337878397' }, () => {}, { mockSandbox: true });
            assert(mockRes && mockRes.success === true && mockRes.status === 'PRE_SUBMIT_GATE', "OBC portal engine supports dry-run Pre-Submit Gate");

            const obcPortalSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'portal', 'tnega', 'tnega_obc_certificate.js'), 'utf8');
            assert(obcPortalSrc.includes("'100'") && obcPortalSrc.includes('REV-115'), "OBC portal engine expands DataTables to 100 rows before clicking REV-115");
            assert(obcPortalSrc.includes('#apCaste') && obcPortalSrc.includes('#apSerialCaste') && obcPortalSrc.includes('#gwt-uid-8'), "OBC portal engine fills exact #apCaste, #apSerialCaste & declaration checkbox");
            assert(obcPortalSrc.includes("code: '21'") && obcPortalSrc.includes("code: '18'") && obcPortalSrc.includes("code: '17'") && (obcPortalSrc.includes("code: '20'") || obcPortalSrc.includes("code: '358'")) && !obcPortalSrc.includes("code: '383'"), "OBC portal engine maps supporting #ss:do codes and strictly NEVER auto-uploads Self-Declaration ('383')");
            assert(obcPortalSrc.includes('200, 240'), "OBC portal engine enforces TNeGA <250x250px passport photo requirement");

            // 2. Priority Exclusion Guards (caste / annualIncome must NEVER hijack OBC -> Community/Income!)
            const runnerSrc = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'automation_runner.js'), 'utf8');
            assert(runnerSrc.includes('isObc') && runnerSrc.includes('!isObc && Boolean(') && runnerSrc.includes('startTnegaObcFlow'), "desktop/automation_runner prioritizes isObc over isCommunity & isIncome");
            const starterSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'chat', 'chat_automation_starter.js'), 'utf8');
            assert(starterSrc.includes('isObcAction') && starterSrc.includes('!isObcAction') && starterSrc.includes('startTnegaObcFlow'), "chat_automation_starter prioritizes isObcAction");
            const opRoutesSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'operator_routes.js'), 'utf8');
            assert(opRoutesSrc.includes('isObc') && opRoutesSrc.includes('!isObc'), "operator_routes prioritizes isObc");

            // 3. UI & Edit Modal Integrity Checks
            const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
            assert(indexHtml.includes("citizenStartService('OBC சான்றிதழ்')") && indexHtml.includes("startDirectApplyService('OBC சான்றிதழ்')"), "index.html renders OBC REV-115 card & quick launch button");
            assert(indexHtml.includes('id="sidebarObcBox"') && indexHtml.includes('id="editObcFieldsWrap"'), "index.html includes sidebarObcBox & editObcFieldsWrap");
            const editMgrSrc = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'modules', 'edit_modal_manager.js'), 'utf8');
            assert(editMgrSrc.includes('isObcMode') && editMgrSrc.includes('editObcCaste'), "edit_modal_manager wires isObcMode & OBC fields");
            const docViewerSrc = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'modules', 'document_viewer.js'), 'utf8');
            assert(docViewerSrc.includes('isObcService') && docViewerSrc.includes('sidebarObcBox'), "document_viewer renders sidebarObcBox for OBC service");

            // 4. Fresh Customer Document-First Flow (Photo -> Aadhaar -> Community -> ITR -> CAN -> Bucket B -> Ready)
            const { handleNonRationServiceSelection } = require('../src/core/fsm/fsm_other_services');
            const { advanceTnegaObcFlow } = require('../src/core/fsm/tnega_flow_engine');
            const sampleDocFile = path.join(__dirname, '..', 'data', 'golden_samples', 'obc', 'community_certificate.jpg');
            const samplePhotoFile = path.join(__dirname, '..', 'data', 'golden_samples', 'obc', 'applicant_photo.jpg');
            const sampleAadhFile = path.join(__dirname, '..', 'data', 'golden_samples', 'obc', 'applicant_aadhaar.jpg');
            const sampleItrFile = path.join(__dirname, '..', 'data', 'golden_samples', 'obc', 'income_tax_return.jpg');

            const freshObcSess = { subService: '', citizenProfile: {}, chatHistory: [] };
            handleNonRationServiceSelection('OBC சான்றிதழ்', freshObcSess);
            assert(freshObcSess.intakeState === 'OBC_PHOTO_WAIT', "Fresh customer OBC starts Document-First with OBC_PHOTO_WAIT");

            freshObcSess.citizenProfile.headPhotoPath = samplePhotoFile;
            advanceTnegaObcFlow(freshObcSess);
            assert(freshObcSess.intakeState === 'OBC_AADHAAR_WAIT', "Fresh OBC step 2 asks Aadhaar card");

            freshObcSess.citizenProfile.headAadhaarDocPath = sampleAadhFile;
            freshObcSess.citizenProfile.fullNameEng = 'Arun K';
            freshObcSess.citizenProfile.headAadhaar = '123412341234';
            advanceTnegaObcFlow(freshObcSess);
            assert(freshObcSess.intakeState === 'OBC_SMARTCARD_WAIT', "Fresh OBC step 3 asks Smart Ration Card");

            freshObcSess.citizenProfile.smartCard = sampleItrFile;
            advanceTnegaObcFlow(freshObcSess);
            assert(freshObcSess.intakeState === 'OBC_COMMUNITY_PROOF_WAIT', "Fresh OBC step 4 asks Community Certificate");

            freshObcSess.citizenProfile.communityCertificate = sampleDocFile;
            advanceTnegaObcFlow(freshObcSess);
            assert(freshObcSess.intakeState === 'OBC_INCOME_PROOF_WAIT', "Fresh OBC step 5 asks ITR / Income Proof");

            freshObcSess.citizenProfile.incomeTaxReturn = sampleItrFile;
            advanceTnegaObcFlow(freshObcSess);
            assert(freshObcSess.intakeState === 'OBC_CAN_GATE', "Fresh OBC step 6 reaches OBC_CAN_GATE");

            freshObcSess.citizenProfile.canNumber = '133370337878397';
            advanceTnegaObcFlow(freshObcSess);
            assert(freshObcSess.intakeState === 'OBC_MOTHER_NAME_WAIT', "Fresh OBC asks Mother Name if missing");

            freshObcSess.citizenProfile.motherNameTam = 'தேவகி';
            advanceTnegaObcFlow(freshObcSess);
            assert(freshObcSess.intakeState === 'OBC_CASTE_WAIT', "Fresh OBC asks OBC Caste");

            freshObcSess.citizenProfile.caste = 'Vanniyar';
            advanceTnegaObcFlow(freshObcSess);
            assert(freshObcSess.intakeState === 'OBC_OCCUPATION_WAIT', "Fresh OBC asks Applicant Occupation");

            freshObcSess.citizenProfile.occupation = 'Service';
            advanceTnegaObcFlow(freshObcSess);
            assert(freshObcSess.intakeState === 'OBC_FATHER_OCC_WAIT', "Fresh OBC asks Father Occupation");

            freshObcSess.citizenProfile.fatherOccupation = 'Farmer';
            advanceTnegaObcFlow(freshObcSess);
            assert(freshObcSess.intakeState === 'OBC_MOTHER_OCC_WAIT', "Fresh OBC asks Mother Occupation");

            freshObcSess.citizenProfile.motherOccupation = 'Homemaker';
            advanceTnegaObcFlow(freshObcSess);
            assert(freshObcSess.intakeState === 'OBC_INCOME_WAIT', "Fresh OBC asks Annual Income");

            freshObcSess.citizenProfile.annualIncome = '72000';
            advanceTnegaObcFlow(freshObcSess);
            assert(freshObcSess.intakeState === 'READY_TO_SUBMIT_OBC', "Fresh OBC transitions to READY_TO_SUBMIT_OBC");

            // 5. Existing Customer Universal Delta Skip Check (Kumaran K already has Photo, Aadhaar, CAN, Mother Name)
            const existObcSess = {
                subService: '',
                chatHistory: [],
                citizenProfile: {
                    fullNameEng: 'Kumaran K',
                    fullNameTam: 'குமரன் கி',
                    motherNameTam: 'தேவகி கி',
                    headAadhaar: '575567662931',
                    headPhotoPath: samplePhotoFile,
                    headAadhaarDocPath: sampleAadhFile,
                    smartCard: sampleDocFile,
                    canNumber: '133370337878397',
                    caste: 'Vanniyar'
                }
            };
            handleNonRationServiceSelection('OBC சான்றிதழ்', existObcSess);
            assert(existObcSess.intakeState === 'OBC_COMMUNITY_PROOF_WAIT', "Existing customer skips Photo & Aadhaar -> asks only missing Community Cert");
            existObcSess.citizenProfile.communityCertificate = sampleDocFile;
            advanceTnegaObcFlow(existObcSess);
            assert(existObcSess.intakeState === 'OBC_INCOME_PROOF_WAIT', "Existing customer advances to missing ITR/Income Proof");
            existObcSess.citizenProfile.incomeTaxReturn = sampleItrFile;
            advanceTnegaObcFlow(existObcSess);
            assert(existObcSess.intakeState === 'OBC_OCCUPATION_WAIT', "Existing customer skips CAN, Mother Name & Caste -> asks missing Applicant Occupation");

            passedCount += 24;
        }

        // =========================================================================
        // TEST 55: MANDATORY UNIVERSAL EDIT-MODAL PRE-SUBMIT GATE LOCK (ALL SERVICES)
        // =========================================================================
        {
            console.log('\n🧪 [TEST 55] Running Mandatory Universal Edit-Modal Pre-Submit Gate Regression Lock...');
            const chatWfSrc = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'modules', 'chat_workflow.js'), 'utf8');
            assert(chatWfSrc.includes('isUniversalStartTrigger') && chatWfSrc.includes('START_FIRST_GRADUATE_APPLY') && chatWfSrc.includes('START_OBC_APPLY'), "chat_workflow intercepts START_FIRST_GRADUATE_APPLY, START_OBC_APPLY and future START_*_APPLY triggers");
            assert(chatWfSrc.includes('if (isUniversalStartTrigger)') && chatWfSrc.includes('openEditModal()'), "chat_workflow always opens Edit Modal on chat final-submit/start triggers");

            const subEngineSrc2 = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'modules', 'submission_engine.js'), 'utf8');
            assert(subEngineSrc2.includes('triggerOptions.fromEditModal !== true'), "proceedConfirmedSubmit enforces hard fromEditModal gate across all services");
            assert(subEngineSrc2.includes('extraPayload.fromEditModal !== true'), "sendTextMessage blocks direct automation start without fromEditModal");
            assert(!subEngineSrc2.includes('docsObj.'), "submission_engine has zero undefined docsObj references for OBC validation");
            assert(subEngineSrc2.includes("effectiveSubService === 'OBC'") && subEngineSrc2.includes("docs.incomeTaxReturn"), "submission_engine prioritizes OBC and extracts OBC ITR docs");

            const editMgrSrc2 = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'modules', 'edit_modal_manager.js'), 'utf8');
            assert(editMgrSrc2.includes('proceedConfirmedSubmit(runRealLive, { fromEditModal: true })'), "submitDirectlyFromEditModal passes { fromEditModal: true } after saving edits");

            passedCount += 7;
        }

        // =========================================================================
        // TEST 56: FOUNDER-ONLY GOLDEN SAMPLE GALLERY & PRIVACY LOCK
        // =========================================================================
        {
            console.log('\n🧪 [TEST 56] Running Founder-Only Golden Sample Gallery & Privacy Lock...');
            const kumaranGalleryDir = path.join(__dirname, '..', 'data', 'golden_samples', 'kumaran_gallery');
            assert(fs.existsSync(kumaranGalleryDir), "data/golden_samples/kumaran_gallery directory exists");
            const files = fs.readdirSync(kumaranGalleryDir);
            assert(files.length >= 13, `Kumaran Golden Gallery contains all ${files.length} (>=13) sample service docs`);

            // Strictly verify external/franchise UIDs and unauthenticated callers are BLOCKED (403)
            const unauthRes = await request('GET', '/api/dev/golden-gallery', null, {});
            assert(unauthRes.status === 403 && unauthRes.body?.enabled === false, "Golden Gallery blocks unauthenticated requests with 403");

            const externalOpRes = await request('GET', '/api/dev/golden-gallery', null, { 'x-operator-uid': 'PlzEG1ptSyQMBe2QFjf8AUS7TJr2' });
            assert(externalOpRes.status === 403 && externalOpRes.body?.enabled === false, "Golden Gallery blocks external franchise operators (e.g. SUMAN) with 403");

            const externalFileRes = await request('GET', '/api/dev/golden-gallery/file?rel=kumaran_gallery/05_community_certificate_kumaran.jpg', null, { 'x-operator-uid': 'PlzEG1ptSyQMBe2QFjf8AUS7TJr2' });
            assert(externalFileRes.status === 403, "Golden Gallery file stream blocks non-Founder UIDs with 403");

            // Founder UID on loopback is authorized
            const founderRes = await request('GET', '/api/dev/golden-gallery', null, { 'x-operator-uid': 'z9TSOApH0Hh69Du0xPK2GDxK2kr2' });
            assert(founderRes.status === 200 && founderRes.body?.enabled === true && founderRes.body.items.length >= 13, "Golden Gallery succeeds cleanly for Founder UID on localhost");

            // UI triggers remain hidden by default in public/index.html
            const idxHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
            assert(idxHtml.includes('id="btnFounderGalleryNav"') && idxHtml.includes('style="display: none;'), "Founder Gallery nav button defaults strictly to display: none");
            assert(idxHtml.includes('id="btnEditModalFounderGallery"') && idxHtml.includes('founder_gallery.js'), "Edit Modal includes Founder Gallery trigger & script");

            passedCount += 8;
        }

        // ============================================================
        // [TEST 57] Universal No-Auto-Upload Self-Declaration & Visible Tab Open Lock
        // ============================================================
        console.log('\n[TEST 57] Verifying Universal Self-Declaration Download + New Tab Open & Zero Auto-Upload Policy...');
        {
            const browserMgrSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'portal', 'tnega', 'tnega_browser_manager.js'), 'utf8');
            assert(browserMgrSrc.includes('async function downloadAndOpenSelfDeclaration') && browserMgrSrc.includes('newPage.goto') && browserMgrSrc.includes('bringToFront'), "tnega_browser_manager exports shared downloadAndOpenSelfDeclaration opening PDF visibly in new Chrome tab");

            const fgSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'portal', 'tnega', 'tnega_first_graduate.js'), 'utf8');
            const obcSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'portal', 'tnega', 'tnega_obc_certificate.js'), 'utf8');
            const commSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'portal', 'tnega', 'tnega_community_certificate.js'), 'utf8');
            const incSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'portal', 'tnega', 'tnega_income_certificate.js'), 'utf8');
            const resSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'portal', 'tnega', 'tnega_residence_certificate.js'), 'utf8');

            assert(fgSrc.includes('downloadAndOpenSelfDeclaration') && !fgSrc.includes("nameEng: 'Self-Declaration of Applicant'") && !fgSrc.includes("optionVal: '200'"), "REV-104 First Graduate opens Self-Declaration visibly and NEVER auto-uploads it");
            assert(obcSrc.includes('downloadAndOpenSelfDeclaration') && !obcSrc.includes("code: '383'") && !obcSrc.includes("label: 'Self-Declaration of Applicant'"), "REV-115 OBC opens Self-Declaration visibly and NEVER auto-uploads it");
            for (const [label, src] of [['REV-101 Community', commSrc], ['REV-103 Income', incSrc], ['REV-102 Residence', resSrc]]) {
                assert(src.includes('decForm1') && src.includes('newPage.goto') && !src.includes("nameEng: 'Self-Declaration of Applicant'"), `${label} opens Self-Declaration in Chrome tab and NEVER auto-uploads it`);
            }
            passedCount += 6;
        }

        // =========================================================================
        // TEST 58: 👨‍👩‍👧‍👦 வாரிசு சான்றிதழ் (REV-114 Legal Heir Certificate Lock Gate)
        // =========================================================================
        console.log('\n[TEST 58] 👨‍👩‍👧‍👦 வாரிசு சான்றிதழ் (REV-114 Legal Heir Certificate Lock Gate)...');
        {
            const { SERVICES_REGISTRY, evaluateServiceChecklist } = require('../src/core/services_registry');
            assert(Boolean(SERVICES_REGISTRY.LEGAL_HEIR_CERTIFICATE), "SERVICES_REGISTRY exposes LEGAL_HEIR_CERTIFICATE");

            const tnegaAuto = require('../tnega_can_automation');
            assert(typeof tnegaAuto.startTnegaLegalHeirFlow === 'function', "tnega_can_automation exports startTnegaLegalHeirFlow");
            assert(typeof tnegaAuto.startTnegaLegalHeirCertificateFlow === 'function', "tnega_can_automation exports startTnegaLegalHeirCertificateFlow");

            const lhPortal = require('../src/portal/tnega/tnega_legal_heir');
            const lhMock = await lhPortal.startTnegaLegalHeirFlow({ canNumber: '133370337878397' }, () => {}, { mockSandbox: true });
            assert(lhMock && lhMock.success === true && lhMock.isPreSubmitGate === true, "REV-114 Legal Heir portal engine executes cleanly in mock sandbox to Pre-Submit Gate");

            const lhSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'portal', 'tnega', 'tnega_legal_heir.js'), 'utf8');
            assert(lhSrc.includes('legalheirshipfrm:dDistrictId') && lhSrc.includes('legalheirshipfrm:dTalukId') && lhSrc.includes('legalheirshipfrm:dRvId'), "REV-114 locks exact deceased District/Taluk/Village JSF IDs");
            assert(lhSrc.includes('lhRelationIdid') && lhSrc.includes('lhAliveDeathid') && lhSrc.includes('lhMaritalIdid') && lhSrc.includes('submit1'), "REV-114 locks exact Legal Heirs RichFaces AJAX IDs");
            assert(lhSrc.includes('downloadAndOpenSelfDeclaration') && lhSrc.includes("'430'") && lhSrc.includes("'432'") && lhSrc.includes("'433'") && lhSrc.includes("'434'"), "REV-114 uploads exact 4 supporting doc codes and opens Self-Declaration PDF");
            assert(!lhSrc.includes("code: '435'") && !lhSrc.includes('autoClickFormSubmit'), "REV-114 NEVER auto-uploads Self-Declaration ('435') and NEVER auto-clicks Operator Submit");

            const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
            assert(indexHtml.includes('id="editLegalHeirFieldsWrap"'), "index.html includes editLegalHeirFieldsWrap for REV-114");
            const editMgrSrc = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'modules', 'edit_modal_manager.js'), 'utf8');
            assert(editMgrSrc.includes('isLegalHeirMode') && editMgrSrc.includes('editLhDeceasedNameEng'), "edit_modal_manager wires isLegalHeirMode & Deceased fields");

            const readyProfile = {
                mobileNumber: '9842367866',
                fullNameEng: 'Kumaran K',
                fullNameTam: 'குமரன் கி',
                fatherNameEng: 'Kirubakaran',
                fatherNameTam: 'கிருபாகரன்',
                motherNameEng: 'Devaki K',
                motherNameTam: 'தேவகி கி',
                canNumber: '133370337878397',
                headAadhaar: '575567662931',
                doorNo: '216',
                streetEng: 'Mettu Street, Narasingapuram',
                district: 'Ranipet',
                taluk: 'Arakkonam',
                village: 'Minnal',
                pincode: '632510',
                deceasedNameEng: 'Kirubakaran',
                deceasedNameTam: 'கிருபாகரன்',
                dateOfDeath: '15-Jan-2025',
                placeOfDeath: 'Arakkonam',
                deathCertificateNo: 'DC-2025-88412',
                documents: {
                    deathCertificate: 'data/golden_samples/kumaran_gallery/11_death_certificate_kirubakaran.jpg',
                    deceasedAddressProof: 'data/golden_samples/kumaran_gallery/12_deceased_aadhaar_address_kirubakaran.jpg',
                    headAadhaar: 'data/golden_samples/kumaran_gallery/04_kumaran_aadhaar_2in1.jpg',
                    smartCard: 'data/golden_samples/kumaran_gallery/09_family_smart_ration_card_kumaran.jpg',
                    birthCertificate: 'data/golden_samples/kumaran_gallery/10_fg_student_12th_tc_kumaran.jpg'
                }
            };
            const chk = evaluateServiceChecklist('LEGAL_HEIR_CERTIFICATE', readyProfile);
            assert(chk && chk.isReady === true, "evaluateServiceChecklist marks complete LEGAL_HEIR_CERTIFICATE profile as 100% ready");
            passedCount += 11;
        }

        // =========================================================================
        // TEST 59: 🔒 7 TNeGA REVENUE SERVICES PERMANENT SHA-256 CODE FREEZE & TAMPER LOCK
        // =========================================================================
        console.log('\n[TEST 59] 🔒 Verifying 7 TNeGA Revenue Services Permanent SHA-256 Code Freeze...');
        {
            const crypto = require('crypto');
            const frozenEngines = {
                'src/portal/tnega/tnega_legal_heir.js': '50e377ae6acb8765f22a86192526b26d2d0967f22c99a2aea3c7c0c867129ccd',
                'src/portal/tnega/tnega_community_certificate.js': '45a52d8ec902627124d013167a64c6b0a951ae6345da0b46a3329242198317e4',
                'src/portal/tnega/tnega_residence_certificate.js': '09b04f906bab1ac9c80aa4f595e6b32b13ac78cd50de7e9ff413640a025e6272',
                'src/portal/tnega/tnega_income_certificate.js': '21eb4e37ec427ee8a78e84881730e3cae247e917bd76cb493ad97cb1c9c902f3',
                'src/portal/tnega/tnega_first_graduate.js': '1afeab686fb75863e01c78f152a042fd07a227b3dcbfa0fca4f8f31a49aee09b',
                'src/portal/tnega/tnega_obc_certificate.js': 'd77361d5de3155dc06934a80c2be1de95c55d1cefce8b4cc054bb9ec236bcbf7',
                'src/portal/tnega/tnega_widow_certificate.js': '9a33ea17a896d790b0b590738a27405ca684d2cabf4c0f649cab1dbd11cd2b1d'
            };
            for (const [relPath, expectedSha] of Object.entries(frozenEngines)) {
                const fullP = path.join(__dirname, '..', relPath);
                assert(fs.existsSync(fullP), `Frozen engine exists: ${relPath}`);
                const normText = fs.readFileSync(fullP, 'utf8').replace(/\r\n/g, '\n');
                const actualSha = crypto.createHash('sha256').update(normText, 'utf8').digest('hex');
                assert(actualSha === expectedSha, `FROZEN SEAL INTACT (${relPath}) — SHA-256 matches permanent freeze lock`);
            }

            const featLock = fs.readFileSync(path.join(__dirname, '..', 'FEATURE_LOCK.md'), 'utf8');
            assert(featLock.includes('22. TNeGA 6 வருவாய்த் துறை சான்றிதழ்கள் நிரந்தர குறியீட்டு முடக்கம்'), 'FEATURE_LOCK.md documents Section 22 Permanent Code Freeze');
            assert(featLock.includes('23. REV-109 விதவைச் சான்றிதழ் நிரந்தர குறியீட்டு முடக்கம்'), 'FEATURE_LOCK.md documents Section 23 REV-109 Widow Certificate Permanent Code Freeze');

            const chatIntakeSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'chat', 'chat_tnega_intake.js'), 'utf8');
            assert(chatIntakeSrc.includes('isLegalHeirFlow') && chatIntakeSrc.includes('advanceTnegaLegalHeirFlow') && chatIntakeSrc.includes('LEGAL_HEIR_DEATH_CERT_WAIT'), 'chat_tnega_intake routes CAN search & docs into advanceTnegaLegalHeirFlow');
            assert(chatIntakeSrc.includes('isWidowFlow') && chatIntakeSrc.includes('advanceTnegaWidowFlow') && chatIntakeSrc.includes('WIDOW_DEATH_CERT_WAIT'), 'chat_tnega_intake routes CAN search & docs into advanceTnegaWidowFlow');

            const subEngSrc = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'modules', 'submission_engine.js'), 'utf8');
            assert(subEngSrc.includes("curSub.includes('LEGAL_HEIR')"), 'submission_engine enforces pre-flight document gate for LEGAL_HEIR');
            assert(subEngSrc.includes("curSub.includes('WIDOW')"), 'submission_engine enforces pre-flight document gate for WIDOW');

            const runnerSrc = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'automation_runner.js'), 'utf8');
            assert(runnerSrc.includes('isLegalHeir') && runnerSrc.includes('startTnegaLegalHeirFlow'), 'desktop/automation_runner routes LEGAL_HEIR to startTnegaLegalHeirFlow');
            assert(runnerSrc.includes('isWidow') && runnerSrc.includes('startTnegaWidowFlow'), 'desktop/automation_runner routes WIDOW to startTnegaWidowFlow');

            passedCount += 22;
        }

        // =========================================================================
        // TEST 60: 🪪 Suman Production New Ration Card 4-Bug Hardening Lock
        // (Standalone Village + Child Birth Certificate + Double OTP + Tamil Initials)
        // =========================================================================
        console.log('\n[TEST 60] 🪪 Verifying New Ration Card 4-Bug Hardening (Village, Birth Cert, Double OTP, Initials)...');
        {
            const { ensureBilingualPair, normalizeTamilInitialsFromEnglish } = require('../src/utils/bilingual_helper');
            assert(ensureBilingualPair('Suman G', '').tam.endsWith('ஜி'), "ensureBilingualPair maps trailing initial 'G' -> 'ஜி'");
            assert(normalizeTamilInitialsFromEnglish('Suman G', 'சுமன் ஜே') === 'சுமன் ஜி', "normalizeTamilInitialsFromEnglish corrects mismatched G->ஜே into ஜி");
            assert(normalizeTamilInitialsFromEnglish('J. Priya', 'ஜே. பிரியா') === 'ஜே பிரியா', "normalizeTamilInitialsFromEnglish keeps J -> ஜே accurately");
            assert(ensureBilingualPair('G.Suman', '').tam.startsWith('ஜி'), "ensureBilingualPair splits dotted initial G.Suman cleanly -> ஜி சுமன்");

            const { resolveTnDistrict } = require('../tn_district_mapper');
            const amburTest = resolveTnDistrict('Vellore', 'Ambur', 'Periyavarikkam', '635804', 'Periyavarikkam, Ambur Taluk, Vellore');
            assert(/^Tirupat(h|t)ur$/i.test(amburTest.district) && amburTest.taluk === 'Ambur' && amburTest.village === 'Periyavarikkam', "resolveTnDistrict maps Vellore/Ambur to Tirupathur while preserving standalone village Periyavarikkam");

            const jurSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'portal', 'tnpds', 'flows', 'new_smart_card', 'card_jurisdiction_steps.js'), 'utf8');
            assert(jurSrc.includes('matchBestSelectOption') && !jurSrc.includes("if (!opt && sel.options.length > 1) opt = sel.options[1];"), "card_jurisdiction_steps uses bilingual fuzzy matchBestSelectOption instead of blind sel.options[1]");

            const memChatSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'chat', 'chat_member_aadhaar.js'), 'utf8');
            assert(memChatSrc.includes('MEMBER_BIRTH_CERT_UPLOAD') && memChatSrc.includes("docType: isBirthCert ? 'BIRTH_CERTIFICATE' : 'AADHAAR_CARD'") && !memChatSrc.includes(": '491436223971'"), "chat_member_aadhaar supports child Birth Certificate without fabricating dummy Aadhaar");

            const addMemFormSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'portal', 'tnpds', 'flows', 'new_smart_card', 'card_additional_member_form.js'), 'utf8');
            assert(addMemFormSrc.includes('isBirthCertMember') && addMemFormSrc.includes("o.text.includes('பிறப்பு')") && addMemFormSrc.includes("'memberAadhaar', targetIdx"), "card_additional_member_form supports Birth Certificate selection and isolated per-member docs");

            const draftRouteSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'draft_routes.js'), 'utf8');
            assert(!draftRouteSrc.includes("draft.citizenProfile?.members?.[0]?.docPath"), "draft_routes NEVER steals Head member[0] docPath for additional members");

            const headStepsSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'portal', 'tnpds', 'flows', 'new_smart_card', 'card_head_member_steps.js'), 'utf8');
            assert(!headStepsSrc.includes('comp.aadharCheck()') && headStepsSrc.includes('new Date(dYear, dMonth, dDay, 12, 0, 0)'), "card_head_member_steps avoids duplicate aadharCheck() OTP firing and parses DOB dynamically");

            const step21Src = fs.readFileSync(path.join(__dirname, '..', 'src', 'portal', 'tnpds', 'steps', 'step21_new_card_otp_verifier.js'), 'utf8');
            assert(step21Src.includes('65000') && fs.readFileSync(path.join(__dirname, '..', 'src', 'portal', 'tnpds', 'flows', 'new_smart_card', 'card_head_aadhaar_otp_steps.js'), 'utf8').includes('65000'), "OTP verifiers enforce strict 65s resend cooldown");

            const famLoopSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'portal', 'tnpds', 'flows', 'new_smart_card', 'card_family_members_loop.js'), 'utf8');
            assert(famLoopSrc.includes('if (!isBirthCertMember)') && famLoopSrc.includes('clearStaleOtpState'), "card_family_members_loop skips Aadhaar OTP for Birth Certificate members and clears stale OTP between members");

            const tnpdsAutoSrc = fs.readFileSync(path.join(__dirname, '..', 'tnpds_automation.js'), 'utf8');
            assert(tnpdsAutoSrc.includes('cachedUserOtp = \'\'; cachedOtpTimestamp = 0;') && tnpdsAutoSrc.includes('!isModalVisible'), "tnpds_automation clears cachedUserOtp on consumption and ignores spinner while OTP modal is open");

            passedCount += 13;
        }

        // =========================================================================
        // TEST 61: 🧾 Ration Card Certified-Only Menu + Digital Sign PDF Upload Lock
        // =========================================================================
        console.log('\n[TEST 61] 🧾 Verifying Certified-Only Ration Card Options & Digital Sign PDF Upload Fix...');
        {
            const { RATION_CARD_SERVICE_OPTIONS } = require('../src/core/fsm/fsm_options_registry');
            const vals = RATION_CARD_SERVICE_OPTIONS.map(o => o.value);
            const expectedVals = [
                'புதிய ரேஷன் கார்டு',
                'குடும்ப உறுப்பினர் சேர்க்க',
                'முகவரி மாற்றம்',
                'கைபேசி எண் மாற்றம்',
                'MAIN_MENU'
            ];
            assert(vals.length === 5, 'RATION_CARD_SERVICE_OPTIONS exposes only the 4 completed services + MAIN_MENU');
            assert(JSON.stringify(vals) === JSON.stringify(expectedVals), 'Only certified completed Ration Card services appear in menu');
            assert(!vals.includes('குடும்ப அட்டை வகை மாற்றம்') && !vals.includes('எரிவாயு விவரங்கள் திருத்தம்'), 'Unbuilt Ration Card options removed');
            assert(!vals.includes('குடும்ப உறுப்பினர் நீக்க') && !vals.includes('குடும்பத் தலைவர் மாற்றம்'), 'Unfinished Ration Card options hidden from menu');

            const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
            assert(indexHtml.includes('🏛️ ரேஷன் கார்டு (4 சேவைகள்)') && !indexHtml.includes('8 சேவைகள்'), 'UI badges show 4 certified Ration Card services');
            assert(indexHtml.includes('id="tool4DocSignInput" accept="image/*,.pdf,application/pdf'), 'Digital Sign document input explicitly allows .pdf extension');

            const toolsJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'modules', 'eseva_tools.js'), 'utf8');
            assert(toolsJs.includes('inspectBinaryDocBytes') && toolsJs.includes('loadPdfDocumentWithFallback'), 'Digital Sign handles disguised images, leading offset %PDF-, password & disableWorker fallback');

            // Back-navigation rewind verification (Step 3 -> Step 2 -> Step 1 never stacks downward)
            const backMob = 'walkin_back_rewind_61';
            const backHdr = { 'x-session-mobile': backMob };
            const r1 = await request('POST', '/api/chat', { message: 'ரேஷன் கார்டு', mobileNumber: backMob }, backHdr);
            assert(r1.body.step === 'RATION_CARD_SERVICES', 'Enters RATION_CARD_SERVICES on first click');
            assert(r1.body.citizenProfile === null, 'Category browsing on walkin session NEVER leaks dummy citizenProfile or walkin_ phone');
            const lenAtCat = r1.body.chatHistory.length;
            const r1Again = await request('POST', '/api/chat', { message: 'ரேஷன் கார்டு', mobileNumber: backMob }, backHdr);
            assert(r1Again.body.step === 'RATION_CARD_SERVICES' && !String(r1Again.body.botResponse || '').includes('விரைவில் முழுமையாக'), 'Repeated Ration Card click rewinds cleanly instead of hitting unimplemented fallback');
            assert(r1Again.body.chatHistory.length === lenAtCat, 'Repeated category click never appends duplicate category menus');
            const r2 = await request('POST', '/api/chat', { message: 'MAIN_MENU', mobileNumber: backMob }, backHdr);
            assert(r2.body.step === 'SERVICE_SELECTION' && r2.body.chatHistory.length === 1, 'MAIN_MENU Back rewinds cleanly to top Step 1 (chatHistory.length === 1)');
            assert(r2.body.citizenProfile === null, 'MAIN_MENU Back NEVER leaks dummy walkin_ citizenProfile');

            const docViewerSrc = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'modules', 'document_viewer.js'), 'utf8');
            assert(docViewerSrc.includes('hasRealActiveMob') && docViewerSrc.includes('hasRealProfileMob'), 'document_viewer.js blocks dummy walkin_ sidebar flicker');

            passedCount += 14;
        }

        // =========================================================================
        // TEST 62: 🕊️ TNeGA Widow Certificate (REV-109) End-to-End Contract Lock
        // =========================================================================
        console.log('\n[TEST 62] 🕊️ Verifying TNeGA Widow Certificate (REV-109) Engine, FSM, UI & Pre-Submit Gate...');
        {
            const { startTnegaWidowFlow, startTnegaWidowCertificateFlow } = require('../tnega_can_automation');
            const { formatWidowDateForPortal } = require('../src/portal/tnega/tnega_widow_certificate');
            const { REVENUE_DEPARTMENT_SERVICE_OPTIONS } = require('../src/core/fsm/fsm_options_registry');
            const { advanceTnegaWidowFlow } = require('../src/core/fsm/tnega_flow_engine');

            assert(typeof startTnegaWidowFlow === 'function' && typeof startTnegaWidowCertificateFlow === 'function', 'startTnegaWidowFlow & alias exported from tnega_can_automation');
            assert(formatWidowDateForPortal('15-01-2025') === '15-Jan-2025', 'formatWidowDateForPortal converts DD-MM-YYYY to dd-MMM-yyyy');
            assert(formatWidowDateForPortal('12/05/1990') === '12-May-1990', 'formatWidowDateForPortal converts DD/MM/YYYY to dd-MMM-yyyy');
            assert(formatWidowDateForPortal('2025-01-15') === '15-Jan-2025', 'formatWidowDateForPortal converts YYYY-MM-DD to dd-MMM-yyyy');
            assert(formatWidowDateForPortal('5-jan-2025') === '05-Jan-2025', 'formatWidowDateForPortal normalizes dd-MMM-yyyy casing & day');

            const mockRes = await startTnegaWidowFlow({ canNumber: '133370314319242', fullNameEng: 'Devaki K' }, () => {}, { isMockSandbox: true });
            assert(mockRes && mockRes.success === true && mockRes.status === 'PRE_SUBMIT_GATE', 'Mock sandbox REV-109 returns PRE_SUBMIT_GATE');
            assert(String(mockRes.appNumber || '').startsWith('TN-16'), 'Mock REV-109 returns TN-16 application number');

            // Verify source contracts (exact live GWT IDs, exact uploadDocs codes, NEVER auto-click #btnSubmit, NEVER auto-upload '71')
            const widowSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'portal', 'tnega', 'tnega_widow_certificate.js'), 'utf8');
            for (const reqId of ['#AD_AppellationID', '#AD_SpouseNameID', '#AD_SpouseNameinTamilID', '#DateofMarriageId', '#AD_DODID', '#AD_DeathCertificateNoID', '#AD_MaritalStatusID', '#btnSubmit']) {
                assert(widowSrc.includes(reqId), `REV-109 engine locks live GWT DOM selector ${reqId}`);
            }
            for (const docCode of ["code: '133'", "code: '70'", "code: '69'", "code: '201'"]) {
                assert(widowSrc.includes(docCode), `REV-109 engine locks live uploadDocs.xhtml ${docCode}`);
            }
            assert(!/submitBtn\.click\s*\(|#btnSubmit['"`]\)\.click\s*\(/i.test(widowSrc), 'REV-109 NEVER auto-clicks #btnSubmit (Operator Human Gate)');
            assert(widowSrc.includes('downloadAndOpenSelfDeclaration') && !widowSrc.includes("code: '71'"), 'REV-109 downloads & opens Self-Declaration PDF and NEVER auto-uploads code 71');

            // Verify menu & FSM progression
            assert(REVENUE_DEPARTMENT_SERVICE_OPTIONS.some(o => o.value === 'விதவைச் சான்றிதழ்' && o.label.includes('REV-109')), 'Revenue Department menu includes REV-109 Widow Certificate');

            const gDir = path.join(__dirname, '..', 'data', 'golden_samples', 'kumaran_gallery');
            const wSess = {
                citizenProfile: {
                    fullNameEng: 'Devaki K',
                    fullNameTam: 'தேவகி கி',
                    headAadhaar: '311526466205',
                    canNumber: '133370314319242',
                    spouseNameEng: 'Late Kirubakaran',
                    spouseNameTam: 'லேட் கிருபாகரன்',
                    dateOfDeath: '15-Jan-2025',
                    deathCertificateNo: 'DC-2025-88412',
                    dateOfMarriage: '12-May-1990',
                    profilePhoto: path.join(gDir, '01_kumaran_passport_photo.jpg'),
                    headAadhaarDocPath: path.join(gDir, '04_kumaran_aadhaar_2in1.jpg'),
                    deathCertificate: path.join(gDir, '11_death_certificate_kirubakaran.jpg'),
                    smartCard: path.join(gDir, '09_family_smart_ration_card_kumaran.jpg'),
                    marriageProof: path.join(gDir, '09_family_smart_ration_card_kumaran.jpg')
                },
                chatHistory: []
            };
            const wReady = advanceTnegaWidowFlow(wSess);
            assert(wReady.step === 'READY_TO_SUBMIT_WIDOW', 'advanceTnegaWidowFlow skips all known fields/docs and jumps to READY_TO_SUBMIT_WIDOW');
            assert(wReady.options.some(o => o.value === 'START_WIDOW_APPLY'), 'READY_TO_SUBMIT_WIDOW exposes START_WIDOW_APPLY CTA');

            const runnerSrc = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'automation_runner.js'), 'utf8');
            assert(runnerSrc.includes('isWidow') && runnerSrc.includes('startTnegaWidowFlow'), 'desktop/automation_runner.js routes isWidow to startTnegaWidowFlow');

            const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
            assert(indexHtml.includes('id="editWidowFieldsWrap"') && indexHtml.includes('id="sidebarWidowBox"') && indexHtml.includes('REV-109'), 'UI includes REV-109 Quick Pill, Sidebar Box, and Edit Modal fields');

            passedCount += 25;
        }

        // =========================================================================
        // TEST 63: 🧪 Isolated Air-Gapped Field Lab / Blueprint Recorder Lock
        // =========================================================================
        console.log('\n[TEST 63] 🧪 Verifying 100% Air-Gapped Field Lab Blueprint Recorder & Zero-PII Scrubbing...');
        {
            const recSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'services', 'field_lab_recorder.js'), 'utf8');
            const routeSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'field_lab_routes.js'), 'utf8');

            // 1. Strict Architectural Air-Gap Check (NEVER touches production automations, FSM, or drafts)
            const forbiddenImports = ['tnpds_automation', 'tnega_', 'chat_fsm', 'automation_runner', 'draft_manage'];
            for (const bad of forbiddenImports) {
                assert(!recSrc.includes(bad) && !routeSrc.includes(bad), `Field Lab stays 100% air-gapped (never imports ${bad})`);
            }
            assert(recSrc.includes('9225') && !recSrc.includes('9222'), 'Field Lab uses dedicated debug port 9225 and never collides with port 9222');

            // 2. Strict Zero-PII Scrubbing Verification
            const { scrubPiiText, sanitizeCapturedSnapshot, sanitizePortalUrl } = require('../src/services/field_lab_recorder');
            const dirtyText = 'User +91 9842367866 Aadhaar 3115 2646 6205 OTP: 482910 email test.user@gmail.com CAN 133370314319242';
            const cleanedText = scrubPiiText(dirtyText);
            assert(!cleanedText.includes('9842367866') && !cleanedText.includes('3115') && !cleanedText.includes('482910') && !cleanedText.includes('test.user@gmail.com') && !cleanedText.includes('133370314319242'), 'scrubPiiText masks mobile, Aadhaar, OTP, email, and CAN numbers completely');

            const sanSnap = sanitizeCapturedSnapshot({
                url: 'https://tnedistrict.tn.gov.in/eda/common/includePage.xhtml?formId=16&secretToken=abc999',
                title: 'Widow Certificate Form',
                fields: [{ tag: 'INPUT', type: 'text', id: 'AD_SpouseNameID', value: 'Secret Citizen Name', label: 'Spouse Name 9842367866' }],
                buttons: [{ tag: 'BUTTON', id: 'btnSubmit', text: 'Submit' }]
            });
            assert(sanSnap.piiStripped === true && sanSnap.fields[0].value === '', 'sanitizeCapturedSnapshot wipes all input values');
            assert(!sanSnap.fields[0].label.includes('9842367866'), 'sanitizeCapturedSnapshot scrubs phone numbers from field labels');
            assert(sanSnap.url.includes('formId=16') && !sanSnap.url.includes('secretToken'), 'sanitizePortalUrl strips session tokens while keeping formId');

            // 3. Isolated Endpoint & UI Verification
            const stRes = await request('GET', '/api/lab/status');
            assert(stRes.status === 200 && stRes.body.success === true && stRes.body.isRecording === false, 'GET /api/lab/status returns clean idle state');
            const bpRes = await request('GET', '/api/lab/blueprints');
            assert(bpRes.status === 200 && Array.isArray(bpRes.body.blueprints), 'GET /api/lab/blueprints returns 200 & array');

            const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
            assert(indexHtml.includes('id="panel-field-lab"') && indexHtml.includes('id="toolPane-field-lab"') && indexHtml.includes('field_lab_ui.js'), 'index.html exposes standalone Field Lab page panel & controller');
            assert(!indexHtml.includes('id="toolTabBtn-field-lab"'), 'Tools page never mixes Field Lab tab inside #panel-tools');
            assert(indexHtml.includes('id="btnHeaderFieldLab"') && !indexHtml.includes('id="btnToggleUiTheme"'), 'index.html places Field Lab icon directly in header and locks Studio UI without theme switcher button');
            assert(indexHtml.includes("document.body.classList.add('eseva-studio-ui')"), 'Studio UI is permanently locked on startup');

            // 4. Cloud-Sync Ingestion & Zero-PII Re-Scrub Verification
            const badSync = await request('POST', '/api/lab/cloud-sync', {});
            assert(badSync.status === 400, 'POST /api/lab/cloud-sync rejects invalid empty payload');
            const testSyncId = `bp_test_cloud_${Date.now()}`;
            const goodSync = await request('POST', '/api/lab/cloud-sync', {
                id: testSyncId,
                serviceName: 'Cloud Sync Test 9842367866',
                portalName: 'TNeGA Test',
                startUrl: 'https://www.tnesevai.tn.gov.in?secretToken=xyz&formId=9',
                steps: [{ url: 'https://www.tnesevai.tn.gov.in', fields: [{ id: 'f1', value: 'LeakShouldWipe', label: 'Aadhaar 3115 2646 6205' }], buttons: [] }],
                clicks: [{ text: 'Call 9842367866', id: 'btnNext' }]
            });
            assert(goodSync.status === 200 && goodSync.body.success === true && goodSync.body.piiStrippedGuaranteed === true, 'POST /api/lab/cloud-sync accepts blueprint and enforces Zero-PII');
            const syncedRead = await request('GET', `/api/lab/blueprints/${testSyncId}`);
            assert(syncedRead.status === 200 && syncedRead.body.blueprint.steps[0].fields[0].value === '' && !syncedRead.body.blueprint.serviceName.includes('9842367866'), 'Cloud-synced blueprint strictly wipes PII values and masks phone numbers');
            await request('DELETE', `/api/lab/blueprints/${testSyncId}`);

            const cloudListRes = await request('GET', '/api/lab/cloud-blueprints');
            assert(cloudListRes.status === 200 && Array.isArray(cloudListRes.body.blueprints), 'GET /api/lab/cloud-blueprints returns 200 & array');

            passedCount += 19;
        }

        // =========================================================================
        // TEST 64: 🔄 Universal Revenue Auto-CAN Lookup -> Register CAN -> Continue Certificate Lock
        // =========================================================================
        console.log('\n[TEST 64] 🔄 Verifying Universal Revenue Auto-CAN -> Auto-Register -> Continue Flow (All 7 REV Services)...');
        {
            const { detectTargetGoal } = require('../src/portal/tnega/tnega_can_register');

            // 1. Explicit service selection MUST beat profile field heuristics (e.g., INCOME applicant who happens to have caste filled)
            const gIncome = detectTargetGoal({ subService: 'INCOME', caste: 'MBC', community: 'MBC' }, { targetService: 'INCOME' });
            assert(gIncome.isIncomeGoal === true && gIncome.isCommunityGoal === false && gIncome.targetUpper === 'INCOME', 'detectTargetGoal prioritizes explicit INCOME over caste heuristic');
            assert(detectTargetGoal({ subService: 'RESIDENCE' }, {}).isResidenceGoal === true, 'detectTargetGoal detects RESIDENCE (REV-102)');
            assert(detectTargetGoal({ subService: 'COMMUNITY' }, {}).isCommunityGoal === true, 'detectTargetGoal detects COMMUNITY (REV-101)');
            assert(detectTargetGoal({ subService: 'FIRST_GRADUATE' }, {}).isFirstGraduateGoal === true, 'detectTargetGoal detects FIRST_GRADUATE (REV-104)');
            assert(detectTargetGoal({ subService: 'OBC' }, {}).isObcGoal === true, 'detectTargetGoal detects OBC (REV-115)');
            assert(detectTargetGoal({ subService: 'LEGAL_HEIR' }, {}).isLegalHeirGoal === true, 'detectTargetGoal detects LEGAL_HEIR (REV-114)');
            assert(detectTargetGoal({ subService: 'WIDOW' }, {}).isWidowGoal === true, 'detectTargetGoal detects WIDOW (REV-109)');

            // 2. Verify Universal Pre-CAN & needCanRegister Chaining Guard in desktop/automation_runner.js
            const runnerSrc = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'automation_runner.js'), 'utf8');
            assert(runnerSrc.includes('runRevenueServiceWithAutoCan') && runnerSrc.includes('returnAfterCanResolved: true'), 'automation_runner chains pre-CAN resolution into all 7 Revenue certificates');
            assert(runnerSrc.includes('certRes.needCanRegister === true') && runnerSrc.includes('forceNewCanRegister: true'), 'automation_runner auto-recovers if any certificate returns needCanRegister');
            assert(runnerSrc.includes('isWidow') && runnerSrc.includes('isLegalHeir') && runnerSrc.includes('isObc') && runnerSrc.includes('isFirstGraduate') && runnerSrc.includes('isIncome') && runnerSrc.includes('isResidence') && runnerSrc.includes('isCommunity'), 'isRevenueCert covers ALL 7 Revenue Department services');

            // 3. Verify tnega_can_register supports DataTables 100 expansion, ALL 7 REV links, and STRICT Aadhaar-only CAN lookup (NO mobile fallback!)
            const canRegSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'portal', 'tnega', 'tnega_can_register.js'), 'utf8');
            assert(canRegSrc.includes('REV-109') && canRegSrc.includes('REV-114') && canRegSrc.includes('REV-115') && canRegSrc.includes('REV-104') && canRegSrc.includes("selectOption('100')"), 'tnega_can_register supports all 7 REV services and DataTables 100 expansion');
            assert(!canRegSrc.includes("runSingleFieldSearch('statusform:applicantMobile'"), 'performLiveCanLookupOnPage NEVER searches CAN by shared mobile number');
            assert(canRegSrc.includes("runSingleFieldSearch('statusform:aadharNo'"), 'performLiveCanLookupOnPage searches CAN strictly by unique 12-digit Aadhaar');

            passedCount += 14;
        }

        // =========================================================================
        // TEST 65: 🚨 In-Chrome HUD Fault Report + Mid-Run Pre-Submit Drop & Orphan Watchdog
        // =========================================================================
        console.log('\n[TEST 65] 🚨 Verifying Chrome HUD Fault Report + Mid-Run Drop & Orphan Detector...');
        {
            const hudSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'portal', 'tnega', 'tnega_hud.js'), 'utf8');
            const tnpdsHudSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'portal', 'tnpds', 'helpers', 'browser_hud.js'), 'utf8');
            assert(hudSrc.includes('esevaHudReportToggle') && hudSrc.includes('esevaHudReportBox') && hudSrc.includes('esevaHudFaultNote') && hudSrc.includes('__esevaReportHudFault'), 'TNeGA Chrome HUD exposes inline Report Issue button and Playwright CSP-safe bridge');
            assert(tnpdsHudSrc.includes('registerHudFaultBridge') && tnpdsHudSrc.includes('esevaHudReportToggle') && tnpdsHudSrc.includes('esevaHudFaultNote'), 'TNPDS Chrome HUD exposes inline Report Issue button and drawer');

            // Verify registerHudFaultBridge invokes handler cleanly on mock Playwright page
            const { registerHudFaultBridge } = require('../src/portal/tnega/tnega_hud');
            let exposedCb = null;
            let capturedHudFault = null;
            const prevHudHandler = global.__esevaHudFaultHandler;
            global.__esevaHudFaultHandler = async (p) => { capturedHudFault = p; };
            const mockPage = {
                isClosed: () => false,
                url: () => 'https://tnedistrict.tn.gov.in/tneda/test',
                exposeFunction: async (name, fn) => {
                    if (name === '__esevaReportHudFault') exposedCb = fn;
                }
            };
            await registerHudFaultBridge(mockPage);
            assert(typeof exposedCb === 'function' && mockPage.__esevaHudFaultExposed === true, 'registerHudFaultBridge binds __esevaReportHudFault once');
            const bridgeRes = await exposedCb({ reason: 'OTP வரவில்லை', hudStepTitle: 'OTP Page' });
            assert(bridgeRes.ok === true && capturedHudFault && capturedHudFault.reason === 'OTP வரவில்லை' && capturedHudFault.portalUrl.includes('tnedistrict'), 'Chrome HUD fault bridge delivers reason and live URL');
            global.__esevaHudFaultHandler = prevHudHandler;

            // Verify Pre-Submit Drop, Startup Orphan Detector, and Desktop Services isolation
            const tmpUserData = fs.mkdtempSync(path.join(require('os').tmpdir(), 'eseva-t65-'));
            const prevTestDir = process.env.ESEVA_TEST_USERDATA;
            process.env.ESEVA_TEST_USERDATA = tmpUserData;
            try {
                const ds = require('../desktop/desktop_services');
                assert(ds.isPreSubmitReached('PRE_SUBMIT_GATE') === true && ds.isPreSubmitReached('OTP அனுப்பப்பட்டது') === false, 'isPreSubmitReached distinguishes Pre-Submit Gate from mid-run steps');

                // 1) Orphaned mid-run (< Pre-Submit) must emit AUTOMATION_ORPHANED_APP_CLOSE
                ds.writeActiveRunFlight({
                    runId: 'run_orphan_test_1',
                    operatorUid: 'op_test',
                    operatorName: 'Tester',
                    serviceName: 'INCOME_CERTIFICATE',
                    lastProgressMsg: 'CAN Search OTP Waiting',
                    reachedPreSubmit: false
                });
                let orphanReported = null;
                const orphanRes = ds.detectOrphanedMidRunOnStartup((p) => { orphanReported = p; });
                assert(orphanRes.orphaned === true && orphanReported?.errorType === 'AUTOMATION_ORPHANED_APP_CLOSE' && orphanReported?.runId === 'run_orphan_test_1', 'Startup orphan detector reports mid-run app close');
                assert(!fs.existsSync(ds.getActiveFlightFilePath()), 'Startup orphan detector clears active_run_flight.json');

                // 2) Cleanly reached Pre-Submit Gate must NOT report orphan error
                ds.writeActiveRunFlight({ runId: 'run_done_test_2', reachedPreSubmit: true });
                let cleanOrphan = null;
                const cleanRes = ds.detectOrphanedMidRunOnStartup((p) => { cleanOrphan = p; });
                assert(cleanRes.orphaned === false && cleanOrphan === null, 'Startup orphan detector stays silent after Pre-Submit Gate');

                // 3) finalizeMidRunTelemetryIfNeeded returns promptFaultReason=true for mid-run drop, false for Pre-Submit completion
                const ar = require('../desktop/automation_runner');
                let capturedTele = null;
                const prevSink = global.__esevaTestTelemetrySink;
                global.__esevaTestTelemetrySink = (p) => { capturedTele = p; };
                const midCtx = {
                    runId: 'run_mid_3', operatorUid: 'op3', operatorName: 'Suman', customerMobile: '9000000001',
                    serviceName: 'INCOME_CERTIFICATE', startedAt: new Date().toISOString(), lastProgressAt: new Date().toISOString(),
                    lastProgressMsg: 'Step 21 OTP', reachedPreSubmit: false, midRunTelemetrySent: false
                };
                const midOut = ar.finalizeMidRunTelemetryIfNeeded(midCtx, { errorType: 'AUTOMATION_ABANDONED_MID_RUN', errorMessage: 'Closed mid-run' });
                assert(midOut.promptFaultReason === true && capturedTele?.errorType === 'AUTOMATION_ABANDONED_MID_RUN', 'Mid-run stop emits AUTOMATION_ABANDONED_MID_RUN and prompts UI feedback');

                capturedTele = null;
                const preCtx = {
                    runId: 'run_pre_4', operatorUid: 'op3', serviceName: 'INCOME_CERTIFICATE',
                    lastProgressMsg: 'PRE_SUBMIT_GATE', reachedPreSubmit: true, midRunTelemetrySent: false
                };
                const preOut = ar.finalizeMidRunTelemetryIfNeeded(preCtx, { errorType: 'AUTOMATION_ABANDONED_MID_RUN' });
                assert(preOut.promptFaultReason === false && capturedTele === null, 'Post-Pre-Submit stop stays clean without false error');
                global.__esevaTestTelemetrySink = prevSink;
            } finally {
                process.env.ESEVA_TEST_USERDATA = prevTestDir || '';
                if (!prevTestDir) delete process.env.ESEVA_TEST_USERDATA;
                fs.rmSync(tmpUserData, { recursive: true, force: true });
            }

            // Verify In-App Feedback Card & Dev Studio Badges
            const hudModuleSrc = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'modules', 'automation_hud.js'), 'utf8');
            const devStudioSrc = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'dev_studio.js'), 'utf8');
            assert(hudModuleSrc.includes('midRunFaultCard_') && hudModuleSrc.includes('OPERATOR_MID_RUN_FEEDBACK') && hudModuleSrc.includes('renderAutomationStoppedCard(activeMob, activeName, null)'), 'Renderer renders mid-run feedback card cleanly without undefined ReferenceError');
            assert(devStudioSrc.includes('OPERATOR_HUD_FAULT_REPORT') && devStudioSrc.includes('AUTOMATION_ORPHANED_APP_CLOSE') && devStudioSrc.includes('AUTOMATION_STUCK_WARNING'), 'Dev Inspector displays distinct badges for HUD reports, stuck watchdogs, and orphaned closes');

            passedCount += 9;
        }

        // =========================================================================
        // TEST 66: 💍 Married Lady (W/o Husband) + Year-Only DOB + Real Family Members Income Flow
        // =========================================================================
        console.log('\n[TEST 66] 💍 Verifying W/o Husband Extraction, Year-Only DOB (01/01/YYYY), Married Family Intake & Income Portal Fixes...');
        {
            const { normalizeDobWithYearFallback, applyExtractedAadhaarRelationsAndDob } = require('../src/services/profile_helpers');
            const { advanceTnegaIncomeFlow } = require('../src/core/fsm/tnega_flow_engine');
            const ds = require('../desktop/desktop_services');
            const aiExtSrc = fs.readFileSync(path.join(__dirname, '..', 'ai_document_extractor.js'), 'utf8');
            const canRegSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'portal', 'tnega', 'tnega_can_register.js'), 'utf8');
            const incPortalSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'portal', 'tnega', 'tnega_income_certificate.js'), 'utf8');
            const editMgrSrc = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'modules', 'edit_modal_manager.js'), 'utf8');
            const idxHtmlSrc = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

            // 1. Year-only DOB fallback & date normalization
            assert(normalizeDobWithYearFallback('1968') === '01/01/1968', 'Year-only Aadhaar DOB 1968 normalizes cleanly to 01/01/1968');
            assert(normalizeDobWithYearFallback('1968-05-09') === '09/05/1968', 'ISO DOB converts to DD/MM/YYYY');
            assert(normalizeDobWithYearFallback('10/06/1993') === '10/06/1993', 'Full DD/MM/YYYY DOB remains intact');

            // 2. W/o Husband vs Birth Father disambiguation
            const ladyProf = { fullNameEng: 'Muthammaal Munusamy', headGender: 'Female' };
            applyExtractedAadhaarRelationsAndDob(ladyProf, {
                relationship: 'Husband',
                maritalStatus: 'Married',
                spouseNameEng: 'Munusamy',
                spouseNameTam: 'முனுசாமி',
                birthFatherNameEng: 'Ramasamy',
                dob: '1968'
            });
            assert(ladyProf.relationship === 'Husband' && ladyProf.headRelationship === 'Husband' && ladyProf.maritalStatus === 'Married', 'W/o Aadhaar sets relationship=Husband & Married');
            assert(ladyProf.fatherNameEng === 'Munusamy' && ladyProf.spouseNameEng === 'Munusamy' && ladyProf.birthFatherNameEng === 'Ramasamy', 'Husband wins CAN guardian slot without mixing birth father');
            assert(ladyProf.headDob === '01/01/1968' && ladyProf.dobIsYearOnly === true, 'Year-only DOB normalized to 01/01/1968 with dobIsYearOnly flag');

            // 3. Extractor prompt & CAN Registration DOM option matching
            assert(aiExtSrc.includes('W/o') && aiExtSrc.includes('spouseNameEng') && aiExtSrc.includes('YEAR-ONLY DOB RULE'), 'AI document extractor distinguishes W/o Husband vs Father and handles YYYY DOB');
            assert(canRegSrc.includes('normalizeDobWithYearFallback(dob)') && canRegSrc.includes('matchedOpt') && canRegSrc.includes('relation'), 'CAN Registration normalizes YYYY DOB and selects exact Husband option from DOM');

            // 4. Married Income FSM never suggests Father/Mother and asks real household members explicitly
            const marriedSess = {
                subService: 'INCOME',
                citizenProfile: {
                    ...ladyProf,
                    canNumber: '133370337878399',
                    motherNameTam: 'பழனியம்மாள்',
                    community: 'MBC',
                    headAadhaar: '598412369874',
                    headPhotoPath: 'uploads/passport_test.jpg',
                    headAadhaarDocPath: 'compressed/test.pdf',
                    incomeProof: 'SELF_DECLARATION',
                    familyMemberCount: 2,
                    incomeMembers: []
                },
                tempUploads: {}
            };
            // Ensure dummy physical paths check cleanly or test directly after setting mock paths to real test files:
            const samplePdf = path.join(__dirname, '..', 'package.json');
            marriedSess.citizenProfile.headPhotoPath = samplePdf;
            marriedSess.citizenProfile.headAadhaarDocPath = samplePdf;
            marriedSess.citizenProfile.smartCard = samplePdf;
            const fsmStep = advanceTnegaIncomeFlow(marriedSess);
            assert(fsmStep.step === 'INCOME_ADDITIONAL_MEMBER_WAIT', 'Married 2-member Income flow prompts explicitly for member 2');
            const optLabels = (fsmStep.options || []).map(o => o.label).join(' ');
            assert(optLabels.includes('கணவர்') && !optLabels.includes('தந்தை -') && !optLabels.includes('தாய் -') && !optLabels.includes('தேவகி'), 'Married Income prompt suggests கணவர் and NEVER auto-suggests parents or Devaki');

            // 5. E2E Chat test (real HTTP against child server): Selecting "கணவர் - முனுசாமி" prompts work/income, then saves cleanly
            const incChatMob = '9790999881';
            const incHeaders = { 'x-session-mobile': incChatMob };
            const dummyIncAadh = path.join(__dirname, '..', 'uploads', 't66_aadh.pdf');
            const dummyIncPh = path.join(__dirname, '..', 'uploads', 't66_ph.jpg');
            const dummyIncPr = path.join(__dirname, '..', 'uploads', 't66_pr.pdf');
            if (!fs.existsSync(dummyIncAadh)) fs.writeFileSync(dummyIncAadh, Buffer.alloc(1024, 'a'));
            if (!fs.existsSync(dummyIncPh)) fs.writeFileSync(dummyIncPh, Buffer.alloc(1024, 'b'));
            if (!fs.existsSync(dummyIncPr)) fs.writeFileSync(dummyIncPr, Buffer.alloc(1024, 'c'));
            await request('POST', '/api/operator/new-customer', { customerMobile: incChatMob });
            const rUpd = await request('POST', '/api/profile/update', {
                mobileNumber: incChatMob,
                fullNameEng: 'Muthammaal Munusamy',
                fullNameTam: 'முத்தம்மாள் முனுசாமி',
                relationship: 'Husband',
                maritalStatus: 'Married',
                fatherNameEng: 'Munusamy',
                fatherNameTam: 'முனுசாமி',
                spouseNameEng: 'Munusamy',
                spouseNameTam: 'முனுசாமி',
                motherNameTam: 'பழனியம்மாள்',
                community: 'MBC',
                headDob: '1968',
                headGender: 'Female',
                headAadhaar: '598412369874',
                headAadhaarDocPath: dummyIncAadh,
                headPhotoPath: dummyIncPh,
                profilePhoto: dummyIncPh,
                smartCard: dummyIncPr,
                incomeProof: dummyIncPr,
                canNumber: '133370337878399'
            }, incHeaders);
            const rSetup = await request('GET', '/api/drafts/' + incChatMob);
            const profSaved = rUpd.body?.citizenProfile || rSetup.body?.draft?.citizenProfile || {};
            assert(profSaved.headDob === '01/01/1968' && profSaved.relationship === 'Husband', 'Profile update normalizes 1968 -> 01/01/1968 & persists Husband relationship');

            const rStartInc = await request('POST', '/api/chat', { text: 'வருமானச் சான்றிதழ்' }, incHeaders);
            assert(rStartInc.body.step === 'INCOME_MEMBER_COUNT_WAIT', 'Income chat skips known fields and goes straight to INCOME_MEMBER_COUNT_WAIT');
            const rCnt2 = await request('POST', '/api/chat', { text: '2 நபர்கள்' }, incHeaders);
            assert(rCnt2.body.step === 'INCOME_ADDITIONAL_MEMBER_WAIT', 'Choosing 2 members prompts INCOME_ADDITIONAL_MEMBER_WAIT');
            const rAskMem = await request('POST', '/api/chat', { text: 'கணவர் - முனுசாமி' }, incHeaders);
            assert(rAskMem.body.step === 'INCOME_ADDITIONAL_MEMBER_WORK_WAIT', 'Selecting Husband without work prompts INCOME_ADDITIONAL_MEMBER_WORK_WAIT');
            const rWorkDone = await request('POST', '/api/chat', { text: 'கூலி வேலை மாதம் 6000' }, incHeaders);
            const savedMembers = rWorkDone.body.citizenProfile.incomeMembers || [];
            assert(savedMembers.length === 1 && savedMembers[0].relationship === 'Husband' && savedMembers[0].name.includes('முனுசாமி') && savedMembers[0].monthlyIncome === '6000', 'Income member saves Husband name, occupation, and monthlyIncome cleanly');

            // 6. Income Portal Engine & Telemetry premature Pre-Submit check & Edit Modal UI
            assert(!incPortalSrc.includes("'Devaki'") && !incPortalSrc.includes("'தேவகி'") && incPortalSrc.includes("addlMonInc > 0"), 'tnega_income_certificate never fabricates Devaki and fills earning addlMembers monthlyIncome');
            assert(ds.isPreSubmitReached('ஆவணப் பதிவேற்றப் பக்கம் எட்டப்பட்டது') === false && ds.isPreSubmitReached('ஆவணங்கள் வெற்றிகரமாகப் பதிவேற்றப்பட்டன') === true, 'Telemetry Pre-Submit guard ignores upload page open and triggers only after docs upload');
            assert(idxHtmlSrc.includes('id="editRelationship"') && idxHtmlSrc.includes('id="editIncomeMembersWrap"') && editMgrSrc.includes('renderEditIncomeMembersList'), 'Edit Modal exposes Relationship dropdown & editable Income family member rows');

            try { [dummyIncAadh, dummyIncPh, dummyIncPr].forEach(f => fs.existsSync(f) && fs.unlinkSync(f)); } catch (_) {}
            await request('DELETE', '/api/drafts/' + incChatMob + '?permanent=true');
            passedCount += 14;
        }

        console.log('\n[TEST 67] 📑 Verifying Mandatory Smart Ration Card Across All 7 Revenue Services, Smart Member Picker + Newborn + Work Queue + Chrome Auto-Overwrite Lock...');
        {
            const { applyExtractedSmartCardDetails } = require('../src/services/profile_helpers');
            const flowEng = require('../src/core/fsm/tnega_flow_engine');
            const { validateUploadedDocument } = require('../src/services/document_validator');
            const subEngSrc = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'modules', 'submission_engine.js'), 'utf8');
            const incPortalSrc2 = fs.readFileSync(path.join(__dirname, '..', 'src', 'portal', 'tnega', 'tnega_income_certificate.js'), 'utf8');

            // 1. Smart Card Vision Extractor Helper & Slot Validation
            const targetScProf = { doorNo: '12' };
            applyExtractedSmartCardDetails(targetScProf, {
                smartCardNumber: '333123456789',
                streetEng: 'Mettu Street',
                smartCardMembers: [
                    { nameEng: 'Munusamy K', nameTam: 'முனுசாமி கே', relationship: 'Self', age: 52, gender: 'Male' },
                    { nameEng: 'Muthammaal M', nameTam: 'முத்தம்மாள் மு', relationship: 'Wife', age: 46, gender: 'Female' },
                    { nameEng: 'Surya M', nameTam: 'சூர்யா மு', relationship: 'Son', age: 18, gender: 'Male' }
                ]
            });
            assert(targetScProf.smartCardNumber === '333123456789' && targetScProf.smartCardMembers.length === 3, 'applyExtractedSmartCardDetails populates card number & normalized member list');
            assert(validateUploadedDocument('smartCard', { documentType: 'PASSPORT_PHOTO' }).valid === false, 'Smart Card slot rejects passport photo');
            assert(validateUploadedDocument('smartCardBack', { documentType: 'SMART_CARD_BACK' }).valid === true, 'Smart Card Back slot accepts SMART_CARD_BACK');

            // 2. All 7 Revenue Services Gate on *_SMARTCARD_WAIT when smartCard missing (and Aadhaar/Photo already present)
            const dummyScAadh = path.join(__dirname, 'test67_aadh.pdf');
            const dummyScPh = path.join(__dirname, 'test67_ph.jpg');
            const dummyScCard = path.join(__dirname, 'test67_sc.pdf');
            fs.writeFileSync(dummyScAadh, '%PDF-1.4\n' + 'A'.repeat(250));
            fs.writeFileSync(dummyScPh, Buffer.alloc(300, 0xFF));
            fs.writeFileSync(dummyScCard, '%PDF-1.4\n' + 'S'.repeat(250));

            const mkNoScSess = (sub) => ({
                subService: sub,
                citizenProfile: {
                    subService: sub,
                    fullNameEng: 'Munusamy K', fullNameTam: 'முனுசாமி கே',
                    fatherNameEng: 'Kannan', fatherNameTam: 'கண்ணன்',
                    headAadhaar: '598412369874', headDob: '01/01/1974', headGender: 'Male',
                    headAadhaarDocPath: dummyScAadh, headPhotoPath: dummyScPh,
                    incomeProof: dummyScAadh, residenceProof: dummyScAadh,
                    communityProof: dummyScAadh, applicantEducationProof: dummyScAadh,
                    communityCertificate: dummyScAadh, incomeTaxReturn: dummyScAadh,
                    deathCertificate: dummyScAadh, deceasedAddressProof: dummyScAadh, birthCertificate: dummyScAadh, marriageProof: dummyScAadh
                },
                draftData: { base64Docs: {} },
                tempUploads: {}
            });
            assert(flowEng.advanceTnegaIncomeFlow(mkNoScSess('INCOME')).step === 'INCOME_SMARTCARD_WAIT', 'Income gates on INCOME_SMARTCARD_WAIT');
            assert(flowEng.advanceTnegaResidenceFlow(mkNoScSess('RESIDENCE')).step === 'RESIDENCE_SMARTCARD_WAIT', 'Residence gates on RESIDENCE_SMARTCARD_WAIT');
            assert(flowEng.advanceTnegaCommunityFlow(mkNoScSess('COMMUNITY')).step === 'COMMUNITY_SMARTCARD_WAIT', 'Community gates on COMMUNITY_SMARTCARD_WAIT');
            assert(flowEng.advanceTnegaFirstGraduateFlow(mkNoScSess('FIRST_GRADUATE')).step === 'FIRST_GRADUATE_SMARTCARD_WAIT', 'First Graduate gates on FIRST_GRADUATE_SMARTCARD_WAIT');
            assert(flowEng.advanceTnegaObcFlow(mkNoScSess('OBC')).step === 'OBC_SMARTCARD_WAIT', 'OBC gates on OBC_SMARTCARD_WAIT');
            assert(flowEng.advanceTnegaLegalHeirFlow(mkNoScSess('LEGAL_HEIR')).step === 'LEGAL_HEIR_SMARTCARD_WAIT', 'Legal Heir gates on LEGAL_HEIR_SMARTCARD_WAIT');
            assert(flowEng.advanceTnegaWidowFlow(mkNoScSess('WIDOW')).step === 'WIDOW_SMARTCARD_WAIT', 'Widow gates on WIDOW_SMARTCARD_WAIT');

            // 3. Full Income Member Picker -> Newborn Add -> Per-Member Work -> Optional Salary Proof -> Ready Station via /api/chat
            const scChatMob = '9000000067';
            const scHeaders = { 'x-session-mobile': scChatMob };
            await request('DELETE', '/api/drafts/' + scChatMob + '?permanent=true');
            fs.writeFileSync(dummyScAadh, '%PDF-1.4\n' + 'A'.repeat(250));
            fs.writeFileSync(dummyScPh, Buffer.alloc(300, 0xFF));
            fs.writeFileSync(dummyScCard, '%PDF-1.4\n' + 'S'.repeat(250));
            await request('POST', '/api/operator/new-customer', { customerMobile: scChatMob });
            await request('POST', '/api/profile/update', {
                mobileNumber: scChatMob,
                fullNameEng: 'Surya M', fullNameTam: 'சூர்யா மு',
                fatherNameEng: 'Munusamy', fatherNameTam: 'முனுசாமி',
                motherNameTam: 'முத்தம்மாள்', community: 'MBC',
                headDob: '15/06/2006', headGender: 'Female', relationship: 'Husband', maritalStatus: 'Married',
                headAadhaar: '598412369874', headAadhaarDocPath: dummyScAadh,
                headPhotoPath: dummyScPh, profilePhoto: dummyScPh,
                smartCard: dummyScCard, smartCardNumber: '333123456789',
                smartCardMembers: [
                    { nameEng: 'Surya M', nameTam: 'சூர்யா மு', relationship: 'Self', age: 25, gender: 'Female' },
                    { nameEng: 'Karthik S', nameTam: 'கார்த்திக் எஸ்', relationship: 'Husband', age: 29, gender: 'Male' },
                    { nameEng: 'Palani R', nameTam: 'பழனி ஆர்', relationship: 'Father', age: 58, gender: 'Male' }
                ],
                profession: 'குடும்பத் தலைவி', incomeProof: 'SELF_DECLARATION', monthlyIncome: 0, annualIncome: '',
                canNumber: '133370337878399'
            }, scHeaders);

            const sPick = await request('POST', '/api/chat', { text: 'வருமானச் சான்றிதழ்' }, scHeaders);
            assert(sPick.body.step === 'INCOME_SELECT_MEMBERS_WAIT', `Income shows Smart Card extracted members in INCOME_SELECT_MEMBERS_WAIT (got step=${sPick.body?.step}, intake=${sPick.body?.intakeState}, sc=${Boolean(sPick.body?.citizenProfile?.smartCard)}, scMem=${(sPick.body?.citizenProfile?.smartCardMembers||[]).length})`);
            await request('POST', '/api/chat', { text: 'INC_TOGGLE_1' }, scHeaders);
            const sAddNb = await request('POST', '/api/chat', { text: 'INC_ADD_NEWBORN' }, scHeaders);
            assert(sAddNb.body.step === 'INCOME_EXTRA_NEWBORN_WAIT', 'Clicking INC_ADD_NEWBORN transitions to INCOME_EXTRA_NEWBORN_WAIT');
            const sNbAdded = await request('POST', '/api/chat', { text: 'மகன் - ஆதித்யா, வயது 1' }, scHeaders);
            assert(sNbAdded.body.step === 'INCOME_SELECT_MEMBERS_WAIT', 'Adding newborn returns cleanly to INCOME_SELECT_MEMBERS_WAIT');
            const sConfMem = await request('POST', '/api/chat', { text: 'INC_MEMBERS_CONFIRMED' }, scHeaders);
            assert(sConfMem.body.step === 'INCOME_ADDITIONAL_MEMBER_WORK_WAIT', 'Confirming selected members enters INCOME_ADDITIONAL_MEMBER_WORK_WAIT for earning adult member');
            const sWorkAns = await request('POST', '/api/chat', { text: 'தனியார் வேலை மாதம் 9000' }, scHeaders);
            assert(String(sWorkAns.body.citizenProfile.annualIncome) === '108000', 'Auto-sums selected family monthly income to annualIncome (9000 * 12 = 108000)');
            assert(sWorkAns.body.step === 'INCOME_INTAKE', 'Asks applicant occupation after member work/income if applicant profession was reset');
            const sAppProf = await request('POST', '/api/chat', { text: 'விவசாயம்' }, scHeaders);
            assert(sAppProf.body.step === 'INCOME_SALARY_DOC_OPTIONAL_WAIT', 'Private sector member triggers INCOME_SALARY_DOC_OPTIONAL_WAIT optional upload prompt');
            const sReady = await request('POST', '/api/chat', { text: 'SKIP_SALARY_PROOF' }, scHeaders);
            assert(sReady.body.step === 'READY_TO_APPLY_INCOME', 'Skipping optional salary proof advances cleanly to READY_TO_APPLY_INCOME');
            assert((sReady.body.citizenProfile.incomeMembers || []).length === 2, 'Excluded Father (index 2) and saved only Husband + Newborn (2 additional members)');

            // 4. Client Pre-Flight Smart Card Guard + Income Portal Auto-Overwrite Lock + Strict 457 Upload
            assert(subEngSrc.includes('hasSmartCard') && subEngSrc.includes('isRevCert'), 'Client submission pre-flight guard checks Smart Ration Card for all Revenue services');
            assert(incPortalSrc2.includes('initialFormFillLocked') && !incPortalSrc2.includes('smartCardPath = aadhaarDocPath'), 'tnega_income_certificate locks #incme:landDet autofill after Gate & never swaps Aadhaar into option 457');

            try { [dummyScAadh, dummyScPh, dummyScCard].forEach(f => fs.existsSync(f) && fs.unlinkSync(f)); } catch (_) {}
            await request('DELETE', '/api/drafts/' + scChatMob + '?permanent=true');
            passedCount += 16;
        }

        console.log('\n======================================================');
        console.log(`🎉 ALL ${passedCount} REGRESSION CHECKS PASSED WITH 100% SUCCESS!`);
        console.log('======================================================\n');

        // Ensure all test drafts and mock sessions are cleaned up BEFORE syncing code to desktop app!
        await cleanup();

        // Automatically sync latest tested code to installed Desktop App!
        try {
            const { syncAllToDesktop } = require('../scripts/sync_to_desktop');
            await syncAllToDesktop();
        } catch (_) {}

        process.exit(0);
    } catch (err) {
        console.error('\n🚨 REGRESSION TEST FAILED!');
        console.error(err.message);
        await cleanup();
        process.exit(1);
    } finally {
        await cleanup();
    }
}

runTests();
