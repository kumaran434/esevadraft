// =========================================================================
// eSevaDraft Autonomous Live Dry-Run Runner for Kumaran K (9790170026)
// STRICT SAFETY RULE: enableFinalSubmit is strictly FALSE (ZERO-SUBMIT GUARD)
// =========================================================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const { startTnpdsRationCardFlow, provideOtp } = require('../tnpds_automation');
const { getCitizenDraft, fileToBase64 } = require('../firestore_db');

const TARGET_MOBILE = '9790170026';

// 1. Start Local OTP Webhook Server on Port 3000 (Bridge for Chrome Extension)
function startWebhookServer() {
    const server = http.createServer((req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            return res.end();
        }

        if (req.url && (req.url.startsWith('/api/automation/otp_webhook') || req.url.startsWith('/api/automation/otp-webhook'))) {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
                try {
                    const data = JSON.parse(body || '{}');
                    const raw = data.text || data.message || data.otp || '';
                    console.log(`\n📲 [Runner Webhook] Incoming payload from extension: "${raw.substring(0, 80)}..."`);
                    
                    const match = String(raw).match(/\b\d{6,8}\b/);
                    if (match) {
                        const otpCode = match[0];
                        console.log(`🎯 [Runner Webhook] Extracted OTP Code: ${otpCode}`);

                        // Write to disk IPC files
                        const diskLocations = [
                            path.join(__dirname, '..', 'data', 'pending_otp.txt'),
                            path.join(process.env.APPDATA || '', 'esevadraft-desktop', 'data', 'pending_otp.txt'),
                            path.join(process.env.APPDATA || '', 'esevadraft-desktop', 'pending_otp.txt')
                        ];
                        for (const loc of diskLocations) {
                            try {
                                fs.mkdirSync(path.dirname(loc), { recursive: true });
                                fs.writeFileSync(loc, otpCode, 'utf8');
                            } catch (_) {}
                        }

                        // Also invoke memory resolver
                        const handled = provideOtp(otpCode);
                        console.log(`⚡ [Runner Webhook] provideOtp(${otpCode}) handled: ${handled}`);

                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        return res.end(JSON.stringify({ success: true, otp: otpCode, handled }));
                    } else {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        return res.end(JSON.stringify({ success: false, message: 'No 6-8 digit OTP found' }));
                    }
                } catch (e) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ success: false, error: e.message }));
                }
            });
            return;
        }

        res.writeHead(404);
        res.end();
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log('ℹ️ [Runner Webhook] Port 3000 already in use by server.js / desktop. Disk listener will handle incoming OTPs.');
        } else {
            console.warn('⚠️ [Runner Webhook Error]:', err.message);
        }
    });

    server.listen(3000, '127.0.0.1', () => {
        console.log('⚡ [Runner Webhook] Listening for Chrome Extension on http://127.0.0.1:3000/api/automation/otp_webhook');
    });

    return server;
}

// 2. Main Execution
async function run() {
    console.log('================================================================================');
    console.log(`🚀 STARTING LIVE TNPDS DRY-RUN AUTOMATION FOR: ${TARGET_MOBILE} (Kumaran K)`);
    console.log('🛡️ ZERO-SUBMIT SAFETY LAW: enableFinalSubmit is strictly set to FALSE');
    console.log('================================================================================\n');

    startWebhookServer();

    const photoPath = path.resolve('data/uploads/9790170026/photo.jpg');
    const aadhaarPath = path.resolve('data/uploads/9790170026/aadhaar.pdf');
    const gasPath = path.resolve('data/uploads/9790170026/gas.pdf');

    const citizenProfile = {
        mobileNumber: TARGET_MOBILE,
        fullNameEng: 'Kumaran K',
        fullNameTam: 'குமரன் கி',
        fatherNameEng: 'Kirubakaran',
        fatherNameTam: 'கிருபாகரன்',
        headGender: 'Male',
        headGenderTam: 'ஆண்',
        headDob: '10/06/1993',
        dob: '10/06/1993',
        headAadhaar: '575567662931',
        doorNo: '216',
        streetEng: 'Mettu Street',
        streetTam: 'மேட்டு தெரு',
        areaEng: 'Narasingapuram, Minnal',
        areaTam: 'நரசிங்கபுரம், மின்னல்',
        district: 'Ranipet',
        taluk: 'Arakkonam',
        village: 'Minnal',
        pincode: '632510',
        cardOption: 'rice',
        headPhotoPath: photoPath,
        residenceProof: {
            type: 'GAS_BOOK',
            docPath: gasPath
        },
        documents: {
            profilePhoto: photoPath,
            headAadhaar: aadhaarPath,
            residenceProof: gasPath,
            gasBook: gasPath
        },
        gasDetails: {
            hasGas: true,
            consumerName: 'TNCS A/C DEVAGI',
            consumerNumber: '622601',
            oilCompany: 'IOC',
            oilCompanyDisplay: 'Indane Gas (IOCL)',
            agencyName: 'RAJAM GAS AGENCY',
            cylinders: '1'
        },
        members: [
            {
                name: 'Kumaran K',
                nameEng: 'Kumaran K',
                nameTam: 'குமரன் கி',
                gender: 'Male',
                dob: '10/06/1993',
                relationship: 'Self',
                relationshipTam: 'குடும்ப தலைவர்',
                aadhaarNumber: '575567662931',
                docPath: aadhaarPath
            }
        ]
    };

    const options = {
        isMockSandbox: false,           // REAL TNPDS official website with REAL SMS OTP
        headless: false,                // VISIBLE Google Chrome window on desktop
        isDryRun: true,                 // DRY-RUN flag
        enableFinalSubmit: false,       // STRICT SAFETY GATE: NEVER click submit on TNPDS!
        operatorMobile: '9790170026',
        operatorName: 'Kumaran E-Seva',
        draftData: {
            mobileNumber: TARGET_MOBILE,
            citizenProfile: citizenProfile,
            base64Docs: {
                profilePhotoBase64: fileToBase64(photoPath),
                headAadhaarBase64: fileToBase64(aadhaarPath),
                gasBookBase64: fileToBase64(gasPath),
                residenceProofBase64: fileToBase64(gasPath)
            }
        }
    };

    const onProgress = (msg) => {
        const time = new Date().toLocaleTimeString('en-IN', { hour12: false });
        console.log(`[${time}] ${msg}`);
    };

    console.log('⏳ Checking / waiting up to 25 seconds for operator Google Chrome on port 9222...');
    for (let i = 0; i < 25; i++) {
        try {
            const res = await fetch('http://127.0.0.1:9222/json/version');
            if (res.ok) {
                console.log('✅ Google Chrome on port 9222 detected! Attaching immediately...');
                break;
            }
        } catch (_) {}
        await new Promise(r => setTimeout(r, 1000));
    }

    try {
        const result = await startTnpdsRationCardFlow(citizenProfile, onProgress, options);
        console.log('\n================================================================================');
        console.log('🎉 AUTOMATION RUN FINISHED:');
        console.log(JSON.stringify(result, null, 2));
        console.log('================================================================================');
        process.exit(0);
    } catch (err) {
        console.error('\n❌ AUTOMATION RUN ERROR:', err.message);
        console.error(err.stack);
        process.exit(1);
    }
}

if (require.main === module) {
    run();
}

module.exports = { run };
