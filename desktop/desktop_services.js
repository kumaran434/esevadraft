// =========================================================================
// eSevaDraft Desktop App — Support Services & Telemetry
// =========================================================================
let app = null;
let dialog = null;
try { ({ app, dialog } = require('electron')); } catch (_) {}
let autoUpdater = null;
const path = require('path');
const fs = require('fs');

function getSafeUserDataDir() {
    if (process.env.ESEVA_TEST_USERDATA) return process.env.ESEVA_TEST_USERDATA;
    try {
        if (app && typeof app.getPath === 'function') return app.getPath('userData');
    } catch (_) {}
    return path.join(__dirname, '..', 'data');
}

function getActiveFlightFilePath() {
    return path.join(getSafeUserDataDir(), 'data', 'active_run_flight.json');
}

function isPreSubmitReached(textOrRes) {
    if (!textOrRes) return false;
    if (typeof textOrRes === 'object') {
        if (
            textOrRes.status === 'PRE_SUBMIT_GATE' ||
            textOrRes.preSubmitGate === true ||
            textOrRes.isPreSubmitGate === true ||
            Boolean(textOrRes.applicationNumber) ||
            Boolean(textOrRes.canNumber)
        ) {
            return true;
        }
        const combined = `${textOrRes.step || ''} ${textOrRes.message || ''}`;
        return /PRE_SUBMIT_GATE|Pre-Submit\s*Gate|ஆவணங்கள்\s*வெற்றிகரமாகப்\s*பதிவேற்றப்பட்டன|பதிவேற்றத்திற்குத்\s*தயார்|இறுதிச்?\s*சமர்ப்பிப்புக்கு\s*முன்/i.test(combined);
    }
    return /PRE_SUBMIT_GATE|Pre-Submit\s*Gate|ஆவணங்கள்\s*வெற்றிகரமாகப்\s*பதிவேற்றப்பட்டன|பதிவேற்றத்திற்குத்\s*தயார்|இறுதிச்?\s*சமர்ப்பிப்புக்கு\s*முன்/i.test(String(textOrRes));
}

function writeActiveRunFlight(data = {}) {
    try {
        const filePath = getActiveFlightFilePath();
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify({
            updatedAt: new Date().toISOString(),
            ...data
        }, null, 2), 'utf8');
        return true;
    } catch (_) {
        return false;
    }
}

function clearActiveRunFlight() {
    try {
        const filePath = getActiveFlightFilePath();
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return true;
    } catch (_) {
        return false;
    }
}

async function syncLatestAutomationEngine() {
    try {
        const workspaceEngine = 'd:\\downloads\\ai assitant 2\\tnpds_automation.js';
        if (fs.existsSync(workspaceEngine)) {
            console.log('[Desktop] Local workspace detected. Skipping cloud sync to preserve latest code.');
            return;
        }

        const https = require('https');
        const http = require('http');
        const userDataDir = app.getPath('userData');
        const baseUrl = process.env.ESEVA_DEV_URL || 'https://esevadraft.in';
        const filesToSync = ['tnpds_automation.js', 'govt_automation_core.js', 'photo_studio.js', 'tn_district_mapper.js'];

        for (const file of filesToSync) {
            const targetPath = path.join(userDataDir, file);
            const targetUrl = `${baseUrl}/api/desktop/asset/${file}`;
            const urlObj = new URL(targetUrl);
            const client = urlObj.protocol === 'https:' ? https : http;

            await new Promise((resolve) => {
                const req = client.get(targetUrl, (res) => {
                    if (res.statusCode === 200) {
                        const chunks = [];
                        res.on('data', (c) => chunks.push(c));
                        res.on('end', () => {
                            const code = Buffer.concat(chunks).toString('utf8');
                            if (code && code.length > 50) {
                                fs.writeFileSync(targetPath, code, 'utf8');
                            }
                            resolve(true);
                        });
                    } else {
                        resolve(false);
                    }
                });
                req.on('error', () => resolve(false));
                req.setTimeout(5000, () => { req.abort(); resolve(false); });
            });
        }
    } catch (e) {
        // Non-blocking sync
    }
}

function readLocalOperatorSessionFallback() {
    try {
        const sessFile = path.join(getSafeUserDataDir(), 'data', 'active_operator_session.json');
        if (fs.existsSync(sessFile)) {
            return JSON.parse(fs.readFileSync(sessFile, 'utf8')) || {};
        }
    } catch (_) {}
    return {};
}

function readTailLinesSafe(filePath, maxLines = 25) {
    try {
        if (!fs.existsSync(filePath)) return [];
        const raw = fs.readFileSync(filePath, 'utf8');
        const lines = raw.split(/\r?\n/).filter(Boolean);
        return lines.slice(-maxLines);
    } catch (_) {
        return [];
    }
}

function readFlightActionsSafe(maxItems = 10) {
    try {
        const candidates = [
            path.join(getSafeUserDataDir(), 'data', 'telemetry', 'app_flight_recorder.json'),
            path.join(__dirname, '..', 'data', 'telemetry', 'app_flight_recorder.json')
        ];
        for (const p of candidates) {
            if (fs.existsSync(p)) {
                const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
                if (parsed && Array.isArray(parsed.timeline)) {
                    return parsed.timeline.slice(-maxItems);
                }
            }
        }
    } catch (_) {}
    return [];
}

function buildBaseTelemetryPayload(data = {}, includeDiagnostics = true) {
    const sess = readLocalOperatorSessionFallback();
    const base = {
        appVersion: (app && typeof app.getVersion === 'function') ? (app.getVersion() || '1.1.31') : '1.1.31',
        platform: process.platform,
        arch: process.arch,
        timestamp: new Date().toISOString(),
        ...data,
        operatorUid: data.operatorUid || sess.operatorUid || '',
        operatorName: data.operatorName || sess.displayName || 'unknown',
        operatorMobile: data.operatorMobile || sess.mobileNumber || '',
        __fromCloudRelay: true
    };
    if (includeDiagnostics) {
        base.runLogTail = Array.isArray(data.runLogTail) && data.runLogTail.length
            ? data.runLogTail
            : readTailLinesSafe(path.join(getSafeUserDataDir(), 'logs', 'latest_run.log'), 25);
        base.lastUiActions = Array.isArray(data.lastUiActions) && data.lastUiActions.length
            ? data.lastUiActions
            : readFlightActionsSafe(10);
    }
    return base;
}

function sendCloudTelemetryPost(endpointPath, data = {}, includeDiagnostics = true) {
    try {
        const payload = buildBaseTelemetryPayload(data, includeDiagnostics);
        if (typeof global.__esevaTestTelemetrySink === 'function') {
            try { global.__esevaTestTelemetrySink({ ...payload, __endpoint: endpointPath }); } catch (_) {}
            return payload;
        }

        const isTestEnv = Boolean(
            process.env.NODE_ENV === 'test' ||
            process.env.ESEVA_SKIP_CLOUD_SYNC === '1' ||
            process.env.REGRESSION_TEST === 'true' ||
            process.env.ESEVA_TEST_USERDATA ||
            process.argv.some(a => a.includes('regression_suite') || a.includes('test_'))
        );
        if (isTestEnv) return payload;

        const baseUrl = process.env.ESEVA_DEV_URL || 'https://esevadraft.in';
        const targetUrl = `${baseUrl}${endpointPath}`;
        const postData = JSON.stringify(payload);
        const urlObj = new URL(targetUrl);
        const client = urlObj.protocol === 'https:' ? require('https') : require('http');

        const req = client.request({
            hostname: urlObj.hostname,
            port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
            path: urlObj.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData, 'utf8'),
                'User-Agent': 'eSevaDraft-Desktop-Telemetry/1.0'
            },
            timeout: 6000
        }, (res) => {
            res.resume();
        });

        req.on('error', () => {});
        req.on('timeout', () => { req.destroy(); });
        req.write(postData);
        req.end();
        return payload;
    } catch (_) {
        // Telemetry must never crash desktop app
        return null;
    }
}

function reportOperatorTelemetry(errorData = {}) {
    return sendCloudTelemetryPost('/api/telemetry/error', errorData, true);
}

function reportOperatorCorrection(correctionData = {}) {
    return sendCloudTelemetryPost('/api/telemetry/correction', correctionData, false);
}

async function launchVisibleBrowser() {
    const { chromium } = require('playwright-core');
    const launchArgs = ['--start-maximized', '--disable-blink-features=AutomationControlled', '--no-sandbox'];
    try {
        console.log('[Desktop] Launching Google Chrome...');
        return await chromium.launch({ headless: false, channel: 'chrome', args: launchArgs });
    } catch (e1) {
        console.warn('[Desktop] Chrome launch failed, trying Microsoft Edge:', e1.message);
    }
    try {
        console.log('[Desktop] Launching Microsoft Edge...');
        return await chromium.launch({ headless: false, channel: 'msedge', args: launchArgs });
    } catch (e2) {
        console.warn('[Desktop] Edge launch failed, trying default chromium:', e2.message);
    }
    try {
        return await chromium.launch({ headless: false, args: launchArgs });
    } catch (e3) {
        reportOperatorTelemetry({
            step: 'LAUNCH_VISIBLE_BROWSER',
            errorType: 'BROWSER_LAUNCH_FAIL',
            errorMessage: `Neither Chrome nor Edge launched: ${e3.message}`,
            chromeFound: false
        });
        throw e3;
    }
}

function parseSemver(verStr) {
    const m = String(verStr || '').replace(/^v/i, '').match(/(\d+)\.(\d+)\.(\d+)/);
    if (!m) return 0;
    return parseInt(m[1], 10) * 1000000 + parseInt(m[2], 10) * 1000 + parseInt(m[3], 10);
}

function checkRemoteVersionFallback(getMainWindow, getPromptShown, setPromptShown) {
    try {
        const https = require('https');
        const { shell } = require('electron');
        const currentVer = (typeof app !== 'undefined' && app.getVersion) ? app.getVersion() : '1.1.24';
        const currentNum = parseSemver(currentVer);

        const req = https.get('https://api.github.com/repos/kumaran434/esevadraft/releases/latest', {
            headers: { 'User-Agent': 'eSevaDraft-Desktop-Updater' },
            timeout: 8000
        }, (res) => {
            if (res.statusCode !== 200) {
                res.resume();
                return;
            }
            let body = '';
            res.on('data', c => { body += c; });
            res.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    const latestTag = String(data.tag_name || '').replace(/^v/i, '');
                    const latestNum = parseSemver(latestTag);
                    if (latestNum > currentNum && !getPromptShown()) {
                        setPromptShown(true);
                        const mainWindow = getMainWindow ? getMainWindow() : null;
                        if (mainWindow && !mainWindow.isDestroyed()) {
                            const exeAsset = Array.isArray(data.assets) ? data.assets.find(a => a.name && a.name.endsWith('.exe')) : null;
                            const dlUrl = (exeAsset && exeAsset.browser_download_url) || `https://github.com/kumaran434/esevadraft/releases/download/v${latestTag}/eSevaDraft-Desktop-Setup-${latestTag}.exe`;
                            dialog.showMessageBox(mainWindow, {
                                type: 'info',
                                title: 'புதிய பதிப்பு வெளியாகியுள்ளது (New Update Available)',
                                message: `eSevaDraft புதிய பதிப்பு (v${latestTag}) வெளியாகியுள்ளது! (தற்போதைய பதிப்பு: v${currentVer})`,
                                detail: 'புதிய பதிப்பில் அனைத்து லாகின் மற்றும் ஆட்டோமேஷன் மேம்பாடுகளும் உள்ளன. இப்போதே பதிவிறக்கம் செய்து அப்டேட் செய்யவா?',
                                buttons: ['📥 இப்போதே பதிவிறக்கு (Download Update)', 'பின்னர் (Later)'],
                                defaultId: 0,
                                cancelId: 1
                            }).then((result) => {
                                if (result.response === 0) {
                                    shell.openExternal(dlUrl);
                                }
                            });
                        }
                    }
                } catch (_) {}
            });
        });
        req.on('error', () => {});
        req.on('timeout', () => { req.destroy(); });
    } catch (_) {}
}

function setupAutoUpdater(getMainWindow) {
    let promptShown = false;
    let updateDownloading = false;
    const isLocalDev = process.env.USERNAME === 'ADMIN' && fs.existsSync('d:\\downloads\\ai assitant 2');
    if (!app.isPackaged && isLocalDev && process.env.NODE_ENV !== 'production') {
        console.log('[AutoUpdater] Development mode: skipping automatic update check.');
        return;
    }
    if (!autoUpdater) {
        try {
            autoUpdater = require('electron-updater').autoUpdater;
        } catch (e) {
            console.warn('[AutoUpdater] init bypassed:', e.message);
        }
    }

    if (autoUpdater) {
        autoUpdater.autoDownload = true;
        autoUpdater.autoInstallOnAppQuit = true;
        autoUpdater.disableWebInstaller = true;

        autoUpdater.on('update-available', (info) => {
            updateDownloading = true;
            console.log('[AutoUpdater] New update found on GitHub, downloading silently:', info?.version);
        });

        autoUpdater.on('download-progress', (progressObj) => {
            const pct = typeof progressObj?.percent === 'number' ? Math.max(0, Math.min(100, progressObj.percent)) : 0;
            try {
                const mainWindow = getMainWindow ? getMainWindow() : null;
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.setProgressBar(pct / 100);
                }
            } catch (_) {}
        });

        autoUpdater.on('error', (err) => {
            updateDownloading = false;
            try {
                const mainWindow = getMainWindow ? getMainWindow() : null;
                if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setProgressBar(-1);
            } catch (_) {}
            console.warn('[AutoUpdater] Updater error:', err?.message || err);
            if (!promptShown) {
                checkRemoteVersionFallback(getMainWindow, () => promptShown, (v) => { promptShown = v; });
            }
        });

        autoUpdater.on('update-downloaded', (info) => {
            console.log('[AutoUpdater] New update downloaded:', info.version);
            updateDownloading = false;
            promptShown = true;
            const mainWindow = getMainWindow ? getMainWindow() : null;
            if (mainWindow && !mainWindow.isDestroyed()) {
                try { mainWindow.setProgressBar(-1); } catch (_) {}
                dialog.showMessageBox(mainWindow, {
                    type: 'info',
                    title: 'புதிய பதிப்பு தயார் (Update Ready)',
                    message: `eSevaDraft புதிய பதிப்பு (v${info.version}) பதிவிறக்கம் செய்யப்பட்டு தயார் நிலையில் உள்ளது.`,
                    detail: 'செயலியை இப்போது மறுதொடக்கம் (Restart) செய்து புதிய பதிப்பிற்கு மாறவா?',
                    buttons: ['இப்போதே Restart செய் (Restart Now)', 'பின்னர் (Later)'],
                    defaultId: 0,
                    cancelId: 1
                }).then((result) => {
                    if (result.response === 0) {
                        global.__esevaUpdating = true;
                        try {
                            const { stopLocalServer } = require('./local_server');
                            if (typeof stopLocalServer === 'function') stopLocalServer();
                        } catch (_) {}
                        setImmediate(() => {
                            autoUpdater.quitAndInstall(false, true);
                        });
                    }
                });
            }
        });

        setTimeout(() => {
            autoUpdater.checkForUpdatesAndNotify().catch((err) => {
                console.warn('[AutoUpdater] Check notice:', err.message);
                if (!updateDownloading) {
                    checkRemoteVersionFallback(getMainWindow, () => promptShown, (v) => { promptShown = v; });
                }
            });
        }, 3000);

        setInterval(() => {
            autoUpdater.checkForUpdatesAndNotify().catch((err) => {
                console.warn('[AutoUpdater] Periodic check notice:', err.message);
            });
        }, 60 * 60 * 1000);
    }

    // Fallback GitHub release check after 18s ONLY if electron-updater is not actively downloading an update
    setTimeout(() => {
        if (!promptShown && !updateDownloading) {
            checkRemoteVersionFallback(getMainWindow, () => promptShown, (v) => { promptShown = v; });
        }
    }, 18000);
}

function detectOrphanedMidRunOnStartup(telemetryReporter = reportOperatorTelemetry) {
    try {
        const filePath = getActiveFlightFilePath();
        if (!fs.existsSync(filePath)) return { orphaned: false };
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8') || '{}');
        clearActiveRunFlight();
        if (parsed && parsed.runId && !parsed.reachedPreSubmit) {
            const payload = {
                runId: parsed.runId,
                operatorUid: parsed.operatorUid || '',
                operatorMobile: parsed.operatorMobile || '',
                operatorName: parsed.operatorName || '',
                customerMobile: parsed.customerMobile || '',
                serviceName: parsed.serviceName || '',
                step: parsed.lastProgressMsg || 'ORPHANED_MID_RUN',
                errorType: 'AUTOMATION_ORPHANED_APP_CLOSE',
                errorMessage: 'Desktop app closed or restarted mid-run before reaching Pre-Submit Gate',
                startedAt: parsed.startedAt || '',
                lastProgressAt: parsed.lastProgressAt || ''
            };
            if (typeof telemetryReporter === 'function') telemetryReporter(payload);
            return { orphaned: true, payload };
        }
        return { orphaned: false };
    } catch (_) {
        clearActiveRunFlight();
        return { orphaned: false };
    }
}

module.exports = {
    syncLatestAutomationEngine,
    reportOperatorTelemetry,
    reportOperatorCorrection,
    launchVisibleBrowser,
    setupAutoUpdater,
    getActiveFlightFilePath,
    writeActiveRunFlight,
    clearActiveRunFlight,
    detectOrphanedMidRunOnStartup,
    isPreSubmitReached
};
