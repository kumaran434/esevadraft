// =========================================================================
// eSevaDraft Desktop App — Support Services & Telemetry
// =========================================================================
const { app, dialog } = require('electron');
let autoUpdater = null;
const path = require('path');
const fs = require('fs');

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

function reportOperatorTelemetry(errorData = {}) {
    try {
        const baseUrl = process.env.ESEVA_DEV_URL || 'https://esevadraft.in';
        const targetUrl = `${baseUrl}/api/telemetry/error`;
        const payload = {
            appVersion: app.getVersion() || '1.1.12',
            platform: process.platform,
            arch: process.arch,
            timestamp: new Date().toISOString(),
            ...errorData
        };

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
                'Content-Length': Buffer.byteLength(postData)
            },
            timeout: 4000
        }, (res) => {
            res.resume();
        });

        req.on('error', () => {});
        req.on('timeout', () => { req.destroy(); });
        req.write(postData);
        req.end();
    } catch (e) {
        // Telemetry must never crash desktop app
    }
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
        const currentVer = (typeof app !== 'undefined' && app.getVersion) ? app.getVersion() : '1.1.19';
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

        autoUpdater.on('update-downloaded', (info) => {
            console.log('[AutoUpdater] New update downloaded:', info.version);
            promptShown = true;
            const mainWindow = getMainWindow ? getMainWindow() : null;
            if (mainWindow && !mainWindow.isDestroyed()) {
                dialog.showMessageBox(mainWindow, {
                    type: 'info',
                    title: 'புதிய பதிப்பு தயார் (Update Ready)',
                    message: `eSevaDraft புதிய பதிப்பு (v${info.version}) தயார் நிலையில் உள்ளது.`,
                    detail: 'செயலியை இப்போது மறுதொடக்கம் (Restart) செய்து புதிய பதிப்பிற்கு மாறவா?',
                    buttons: ['இப்போதே Restart செய் (Restart Now)', 'பின்னர் (Later)'],
                    defaultId: 0,
                    cancelId: 1
                }).then((result) => {
                    if (result.response === 0) {
                        autoUpdater.quitAndInstall();
                    }
                });
            }
        });

        setTimeout(() => {
            autoUpdater.checkForUpdatesAndNotify().catch((err) => {
                console.warn('[AutoUpdater] Check notice:', err.message);
                checkRemoteVersionFallback(getMainWindow, () => promptShown, (v) => { promptShown = v; });
            });
        }, 3000);

        setInterval(() => {
            autoUpdater.checkForUpdatesAndNotify().catch((err) => {
                console.warn('[AutoUpdater] Periodic check notice:', err.message);
            });
        }, 60 * 60 * 1000);
    }

    // Fallback GitHub release check after 12s in case electron-updater blockmap/yml check is slow or blocked
    setTimeout(() => {
        if (!promptShown) {
            checkRemoteVersionFallback(getMainWindow, () => promptShown, (v) => { promptShown = v; });
        }
    }, 12000);
}

module.exports = {
    syncLatestAutomationEngine,
    reportOperatorTelemetry,
    launchVisibleBrowser,
    setupAutoUpdater
};
