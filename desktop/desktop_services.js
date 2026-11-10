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

function setupAutoUpdater(getMainWindow) {
    if (!app.isPackaged && process.env.NODE_ENV !== 'production') {
        console.log('[AutoUpdater] Development mode: skipping automatic update check.');
        return;
    }
    if (!autoUpdater) {
        try {
            autoUpdater = require('electron-updater').autoUpdater;
        } catch (e) {
            console.warn('[AutoUpdater] init bypassed:', e.message);
            return;
        }
    }
    if (!autoUpdater) return;

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('update-downloaded', (info) => {
        console.log('[AutoUpdater] New update downloaded:', info.version);
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
        });
    }, 5000);

    setInterval(() => {
        autoUpdater.checkForUpdatesAndNotify().catch((err) => {
            console.warn('[AutoUpdater] Periodic check notice:', err.message);
        });
    }, 60 * 60 * 1000);
}

const { startLocalServer } = require('./local_server');

module.exports = {
    syncLatestAutomationEngine,
    reportOperatorTelemetry,
    launchVisibleBrowser,
    setupAutoUpdater,
    startLocalOtpWebhookServer: startLocalServer
};
