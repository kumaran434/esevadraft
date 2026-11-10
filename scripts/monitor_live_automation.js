// =========================================================================
// Live Desktop Automation Trigger & Non-Stop Monitor
// =========================================================================
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const TARGET_MOBILE = process.argv[2] || '9790170026';
const appDataLogs = path.join(os.homedir(), 'AppData', 'Roaming', 'esevadraft-desktop', 'logs');
const localLogs = path.join(process.cwd(), 'data', 'logs');

async function triggerAutomation() {
    console.log(`🚀 [Launcher] Triggering Live Automation for ${TARGET_MOBILE} via Desktop App...`);
    
    let draftSubService = process.argv[3] || null;
    if (!draftSubService) {
        try {
            const draftPath = path.join(process.cwd(), 'data', 'drafts', `${TARGET_MOBILE}.json`);
            if (fs.existsSync(draftPath)) {
                const d = JSON.parse(fs.readFileSync(draftPath, 'utf8'));
                draftSubService = d.subService || d.citizenProfile?.subService || (d.intakeState === 'READY_TO_APPLY_CAN' ? 'CAN_REGISTER' : null);
            }
        } catch (_) {}
    }

    const postData = JSON.stringify({
        mobileNumber: TARGET_MOBILE,
        subService: draftSubService,
        autoStart: true,
        isDryRun: false
    });

    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: '127.0.0.1',
            port: 3000,
            path: '/api/desktop/launch-customer-automation',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                console.log(`📡 [Desktop Engine Response] HTTP ${res.statusCode}:`, data);
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve({ raw: data });
                }
            });
        });

        req.on('error', (err) => {
            console.error('❌ [Launcher] Request error:', err.message);
            reject(err);
        });

        req.write(postData);
        req.end();
    });
}

function findLatestLogFile() {
    const candidates = [];
    for (const dir of [appDataLogs, localLogs]) {
        if (!fs.existsSync(dir)) continue;
        const files = fs.readdirSync(dir);
        for (const f of files) {
            if (f.startsWith('live_desktop_' + TARGET_MOBILE) || f === 'latest_run.log') {
                const full = path.join(dir, f);
                try {
                    const st = fs.statSync(full);
                    candidates.push({ path: full, mtime: st.mtimeMs, size: st.size });
                } catch (_) {}
            }
        }
    }
    candidates.sort((a, b) => b.mtime - a.mtime);
    return candidates.length > 0 ? candidates[0] : null;
}

async function monitorLogs() {
    console.log('👀 [Monitor] Actively following live automation log stream...');
    let currentLog = findLatestLogFile();
    let lastSize = currentLog ? currentLog.size : 0;
    let targetPath = currentLog ? currentLog.path : null;

    const interval = setInterval(() => {
        // Check if a newer live_desktop log file appeared
        const latest = findLatestLogFile();
        if (latest && latest.path !== targetPath && latest.mtime > (currentLog?.mtime || 0)) {
            console.log(`\n📄 [Monitor] Switched to newer log file: ${latest.path}`);
            targetPath = latest.path;
            currentLog = latest;
            lastSize = 0;
        }

        if (!targetPath || !fs.existsSync(targetPath)) return;

        try {
            const st = fs.statSync(targetPath);
            if (st.size > lastSize) {
                const stream = fs.createReadStream(targetPath, { start: lastSize, end: st.size });
                stream.on('data', chunk => {
                    process.stdout.write(chunk.toString('utf8'));
                });
                lastSize = st.size;
            }
        } catch (_) {}
    }, 1000);

    // Keep process alive indefinitely (daemon monitor)
    return new Promise(() => {});
}

async function main() {
    try {
        await triggerAutomation();
    } catch (e) {
        console.error('Trigger failed:', e);
    }
    await monitorLogs();
}

main();
