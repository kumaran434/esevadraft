// =========================================================================
// eSevaDraft Windows Desktop App — Core Engine & Security Shield
// Commercial-Grade Intellectual Property Protection Enabled
// =========================================================================
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Load environment variables (GEMINI_API_KEY) in desktop main process
try { require('dotenv').config({ path: path.join(__dirname, '..', '.env') }); } catch (e) {}
try { require('dotenv').config(); } catch (e) {}


let mainWindow = null;
let liveBrowserInstance = null;

// Anti-Tampering & Anti-Reverse-Engineering Shield
function applyAntiTamperShield(win) {
    // 1. Prevent DevTools from opening
    win.webContents.on('devtools-opened', () => {
        win.webContents.closeDevTools();
    });

    // 2. Block inspection key shortcuts (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U)
    win.webContents.on('before-input-event', (event, input) => {
        if (input.key === 'F12' ||
            (input.control && input.shift && (input.key.toLowerCase() === 'i' || input.key.toLowerCase() === 'j')) ||
            (input.control && input.key.toLowerCase() === 'u')) {
            event.preventDefault();
        }
    });

    // 3. Navigation guard: keep eSevaDraft inside Electron; open govt portals in system browser
    win.webContents.on('will-navigate', (event, url) => {
        const allowedOrigins = ['https://esevadraft.in', 'https://gen-lang-client-0792225149.web.app', 'http://localhost:3000'];
        const isAllowed = allowedOrigins.some(origin => url.startsWith(origin));
        const isGovtPortal = url.includes('tnpds.gov.in') || url.includes('esevai.elcot.in') || url.includes('tnreginet.gov.in');
        if (!isAllowed) {
            event.preventDefault();
            // Open government portals in the operator's system browser (Chrome/Edge) so they can see & interact
            if (isGovtPortal) {
                shell.openExternal(url);
            }
        }
    });

    // 4. window.open() calls (target="_blank") — open govt portals in system browser
    win.webContents.setWindowOpenHandler(({ url }) => {
        const isGovtPortal = url.includes('tnpds.gov.in') || url.includes('esevai.elcot.in') || url.includes('tnreginet.gov.in');
        const isEsevaDraft = url.includes('esevadraft.in') || url.includes('localhost');
        if (isGovtPortal) {
            // Open in operator's default system browser so CAPTCHA & form are fully visible
            shell.openExternal(url);
            return { action: 'deny' }; // Don't open a new Electron window
        }
        if (isEsevaDraft) {
            return { action: 'allow' }; // Allow new Electron window for eSevaDraft pages
        }
        // Block all other external URLs
        return { action: 'deny' };
    });
}

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1366,
        height: 850,
        minWidth: 1024,
        minHeight: 700,
        title: 'eSevaDraft — தமிழ்நாடு அரசு சேவைகள் ஏஐ டெஸ்க்டாப்',
        backgroundColor: '#0f172a',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
            webSecurity: true,
            devTools: false
        }
    });

    applyAntiTamperShield(mainWindow);

    // Clear HTTP cache on every launch so server-side updates always take effect immediately
    mainWindow.webContents.session.clearCache().then(() => {
        // Load web portal fresh after cache is cleared
        const targetUrl = process.env.ESEVA_DEV_URL || 'https://esevadraft.in';
        mainWindow.loadURL(targetUrl);
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Background sync of latest automation engine and support modules from cloud server
async function syncLatestAutomationEngine() {
    try {
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

// Zero-Cost Centralized Error Telemetry (Remote Diagnostics)
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

        req.on('error', () => {}); // Non-blocking: silent on network timeout/offline
        req.on('timeout', () => { req.destroy(); });
        req.write(postData);
        req.end();
    } catch (e) {
        // Telemetry must never crash desktop app
    }
}

// Helper to launch visible Chrome or Edge on operator desktop
async function launchVisibleBrowser() {
    const { chromium } = require('playwright-core');
    const launchArgs = ['--start-maximized', '--disable-blink-features=AutomationControlled', '--no-sandbox'];
    // 1. Try Google Chrome
    try {
        console.log('[Desktop] Launching Google Chrome...');
        return await chromium.launch({ headless: false, channel: 'chrome', args: launchArgs });
    } catch (e1) {
        console.warn('[Desktop] Chrome launch failed, trying Microsoft Edge:', e1.message);
    }
    // 2. Try Microsoft Edge (available on 100% of Windows 10/11)
    try {
        console.log('[Desktop] Launching Microsoft Edge...');
        return await chromium.launch({ headless: false, channel: 'msedge', args: launchArgs });
    } catch (e2) {
        console.warn('[Desktop] Edge launch failed, trying default chromium:', e2.message);
    }
    // 3. Fallback to default chromium
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

let activeAutomationModule = null;

// IPC Handlers
ipcMain.handle('start-live-automation', async (_event, draftData) => {
    try {
        console.log('[Desktop] Starting LOCAL visible automation for:', draftData?.mobileNumber);

        // Attempt fresh sync before launching
        await syncLatestAutomationEngine().catch(() => {});

        let playwrightChromium = null;
        try {
            playwrightChromium = require('playwright-core').chromium;
        } catch (e) {
            try {
                const unpackedPath = path.join(process.resourcesPath || '', 'app.asar.unpacked', 'node_modules', 'playwright-core');
                if (fs.existsSync(unpackedPath)) {
                    playwrightChromium = require(unpackedPath).chromium;
                }
            } catch (e2) {}
        }

        // Try to load full TNPDS 51-step automation engine
        let automationModule = null;
        let loadError = null;
        try {
            // 1. In development, ALWAYS load local workspace engine directly
            if (!app.isPackaged) {
                const localAutomationPath = path.join(__dirname, '..', 'tnpds_automation.js');
                if (fs.existsSync(localAutomationPath)) {
                    delete require.cache[require.resolve(localAutomationPath)];
                    automationModule = require(localAutomationPath);
                    console.log('[Desktop] Loaded local workspace automation engine.');
                }
            }

            // 2. In production packaged app, check updated engine in userData first
            if (!automationModule) {
                const userEnginePath = path.join(app.getPath('userData'), 'tnpds_automation.js');
                if (fs.existsSync(userEnginePath)) {
                    try {
                        delete require.cache[require.resolve(userEnginePath)];
                        automationModule = require(userEnginePath);
                        console.log('[Desktop] Loaded updated automation engine from userData.');
                    } catch (ue) {
                        console.warn('[Desktop] UserData engine failed, unlinking corrupted cache and fallback to bundled:', ue.message);
                        try { fs.unlinkSync(userEnginePath); } catch (_) {}
                    }
                }
            }

            // 3. Fallback to bundled packaged engine
            if (!automationModule) {
                const bundledCandidates = [
                    path.join(process.resourcesPath || '', 'tnpds_automation.js'),
                    path.join(process.resourcesPath || '', 'app.asar.unpacked', 'tnpds_automation.js'),
                    path.join(__dirname, '..', 'tnpds_automation.js'),
                    path.join(__dirname, 'tnpds_automation.js')
                ];
                for (const bc of bundledCandidates) {
                    if (fs.existsSync(bc)) {
                        try {
                            delete require.cache[require.resolve(bc)];
                            automationModule = require(bc);
                            console.log('[Desktop] Loaded bundled automation engine from:', bc);
                            if (automationModule) break;
                        } catch (be) {
                            console.warn('[Desktop] Bundled candidate failed:', bc, be.message);
                        }
                    }
                }
            }

            activeAutomationModule = automationModule;

            if (automationModule && automationModule.setChromiumInstance && playwrightChromium) {
                automationModule.setChromiumInstance(playwrightChromium);
            }
        } catch (e) {
            loadError = e;
            console.error('[Desktop] Automation module load error:', e);
            reportOperatorTelemetry({
                operatorMobile: draftData?.operatorMobile || '',
                step: 'LOAD_AUTOMATION_MODULE',
                errorType: 'ENGINE_LOAD_FAIL',
                errorMessage: e.message,
                errorStack: e.stack,
                customerMobile: draftData?.mobileNumber || draftData?.citizenProfile?.mobileNumber || ''
            });
        }

        if (automationModule && (automationModule.startTnpdsRationCardFlow || automationModule.startTnpdsAddMemberFlow)) {
            process.env.HEADLESS = 'false';
            process.env.NODE_ENV = 'development'; // Ensure visible browser

            const onProgress = (msg) => {
                console.log('[Automation]', msg);
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('automation-step-update', msg);
                }
            };

            const isAddMember = draftData?.subService === 'ADD_MEMBER' || 
                                draftData?.citizenProfile?.subService === 'ADD_MEMBER' ||
                                (draftData?.intakeState && draftData.intakeState.startsWith('RATION_ADD_MEMBER')) ||
                                Boolean(draftData?.subServiceData?.memberName) ||
                                Boolean(draftData?.citizenProfile?.subServiceData?.memberName);
            const isChangeAddress = draftData?.subService === 'CHANGE_ADDRESS' ||
                                    draftData?.citizenProfile?.subService === 'CHANGE_ADDRESS' ||
                                    (draftData?.intakeState && draftData.intakeState.startsWith('RATION_CHANGE_ADDRESS')) ||
                                    Boolean(draftData?.subServiceData?.doorNo) ||
                                    Boolean(draftData?.citizenProfile?.subServiceData?.doorNo);

            let runner = automationModule.startTnpdsRationCardFlow;
            if (isAddMember && automationModule.startTnpdsAddMemberFlow) {
                runner = automationModule.startTnpdsAddMemberFlow;
            } else if (isChangeAddress && automationModule.startTnpdsAddressChangeFlow) {
                runner = automationModule.startTnpdsAddressChangeFlow;
            }

            const targetProfile = {
                ...(draftData || {}),
                ...(draftData?.citizenProfile || {}),
                mobileNumber: draftData?.mobileNumber || draftData?.citizenProfile?.mobileNumber || '',
                subService: isAddMember ? 'ADD_MEMBER' : (isChangeAddress ? 'CHANGE_ADDRESS' : draftData?.subService),
                subServiceData: draftData?.subServiceData || draftData?.citizenProfile?.subServiceData || {},
                intakeState: draftData?.intakeState || draftData?.citizenProfile?.intakeState || ''
            };

            // Run automation locally in visible Chrome
            runner(targetProfile, onProgress, { 
                isMockSandbox: false, 
                headless: false,
                chromium: playwrightChromium,
                draftData: draftData,
                subServiceData: targetProfile.subServiceData,
                operatorMobile: draftData?.operatorMobile || '',
                base64Docs: draftData?.base64Docs || draftData?.citizenProfile?.base64Docs,
                geminiApiKey: process.env.GEMINI_API_KEY || ''
            })
                .then(res => {
                    console.log('[Desktop] Automation finished:', res);
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('automation-finished', res);
                    }
                    if (res && !res.success && res.message) {
                        if (mainWindow && !mainWindow.isDestroyed()) {
                            mainWindow.webContents.send('automation-step-update', `⚠️ ${res.message}`);
                        }
                        reportOperatorTelemetry({
                            operatorMobile: draftData?.operatorMobile || '',
                            step: 'AUTOMATION_RESULT_UNSUCCESSFUL',
                            errorType: 'PORTAL_STEP_REJECTED',
                            errorMessage: res.message,
                            customerMobile: draftData?.mobileNumber || draftData?.citizenProfile?.mobileNumber || ''
                        });
                    }
                })
                .catch(err => {
                    console.error('[Desktop] Automation error:', err);
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('automation-step-update', `⚠️ ஆட்டோமேஷன் பிழை: ${err.message}`);
                    }
                    reportOperatorTelemetry({
                        operatorMobile: draftData?.operatorMobile || '',
                        step: 'AUTOMATION_RUN_EXCEPTION',
                        errorType: 'CRASH_OR_UNHANDLED_EXCEPTION',
                        errorMessage: err.message,
                        errorStack: err.stack,
                        customerMobile: draftData?.mobileNumber || draftData?.citizenProfile?.mobileNumber || ''
                    });
                });

            return { success: true, message: 'TNPDS Chrome திறக்கப்பட்டது — படிவம் தானாக நிரப்பப்படுகிறது!' };
        }

        // If automation module failed to load, report error explicitly instead of opening an unautomated blank browser
        console.error('[Desktop] Automation engine missing or failed:', loadError);
        reportOperatorTelemetry({
            operatorMobile: draftData?.operatorMobile || '',
            step: 'AUTOMATION_MODULE_MISSING',
            errorType: 'MODULE_MISSING',
            errorMessage: loadError ? loadError.message : 'tnpds_automation தொகுதி கிடைக்கவில்லை',
            errorStack: loadError ? loadError.stack : null,
            customerMobile: draftData?.mobileNumber || draftData?.citizenProfile?.mobileNumber || ''
        });

        return { success: false, error: 'tnpds_automation தொகுதி ஏற்ற முடியவில்லை.' };
    } catch (err) {
        console.error('[Desktop] Handler exception:', err);
        reportOperatorTelemetry({
            operatorMobile: draftData?.operatorMobile || '',
            step: 'START_LIVE_AUTOMATION_HANDLER',
            errorType: 'IPC_HANDLER_ERROR',
            errorMessage: err.message,
            errorStack: err.stack,
            customerMobile: draftData?.mobileNumber || draftData?.citizenProfile?.mobileNumber || ''
        });
        return { success: false, error: err.message };
    }
});

ipcMain.handle('stop-live-automation', async () => {
    try {
        console.log('[Desktop] Stopping live automation requested by operator...');
        if (activeAutomationModule && activeAutomationModule.stopTnpdsAutomation) {
            await activeAutomationModule.stopTnpdsAutomation();
        } else {
            const userEnginePath = path.join(app.getPath('userData'), 'tnpds_automation.js');
            const autoMod = fs.existsSync(userEnginePath) 
                ? require(userEnginePath) 
                : (app.isPackaged ? require(path.join(process.resourcesPath, 'tnpds_automation.js')) : require('../tnpds_automation'));
            if (autoMod && autoMod.stopTnpdsAutomation) {
                await autoMod.stopTnpdsAutomation();
            }
        }
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('automation-step-update', '🛑 ஆட்டோமேஷன் நிறுத்தப்பட்டது.');
            mainWindow.webContents.send('automation-finished', { success: false, stopped: true, message: 'ஆட்டோமேஷன் நிறுத்தப்பட்டது.' });
        }
        return { success: true };
    } catch (e) {
        console.warn('[Desktop] Stop automation error:', e.message);
        return { success: false, error: e.message };
    }
});

ipcMain.handle('approve-final-submit', async () => {
    try {
        if (activeAutomationModule && activeAutomationModule.provideOperatorApproval) {
            return activeAutomationModule.provideOperatorApproval(true);
        }
        const userEnginePath = path.join(app.getPath('userData'), 'tnpds_automation.js');
        const autoMod = fs.existsSync(userEnginePath) ? require(userEnginePath) : (app.isPackaged ? require(path.join(process.resourcesPath, 'tnpds_automation.js')) : require('../tnpds_automation'));
        if (autoMod && autoMod.provideOperatorApproval) {
            return autoMod.provideOperatorApproval(true);
        }
    } catch (e) {
        console.warn('Approve submit error in main:', e.message);
    }
    return false;
});

ipcMain.handle('download-tnpds-pdf', async (_event, refNo) => {
    try {
        const cleanRef = String(refNo || '').replace(/\D/g, '').trim();
        if (!cleanRef) return { success: false, message: 'சரியான விண்ணப்ப குறிப்பு எண் தேவை.' };

        const saveFilename = `Application_${cleanRef}.pdf`;
        const candidatePaths = [
            path.join(os.tmpdir(), 'esevadraft', 'receipts', saveFilename),
            path.join(app.getPath('userData'), 'receipts', saveFilename),
            path.join(process.resourcesPath, 'public', 'receipts', saveFilename),
            path.join(__dirname, '..', 'public', 'receipts', saveFilename)
        ];

        for (const p of candidatePaths) {
            if (fs.existsSync(p)) {
                shell.openPath(p); // Instantly open existing PDF on operator PC
                return { success: true, pdfPath: p, fromCache: true };
            }
        }

        const autoMod = (activeAutomationModule && activeAutomationModule.downloadTnpdsApplicationPdf)
            ? activeAutomationModule
            : (fs.existsSync(path.join(app.getPath('userData'), 'tnpds_automation.js'))
                ? require(path.join(app.getPath('userData'), 'tnpds_automation.js'))
                : (app.isPackaged ? require(path.join(process.resourcesPath, 'tnpds_automation.js')) : require('../tnpds_automation')));
        if (autoMod && autoMod.downloadTnpdsApplicationPdf) {
            const res = await autoMod.downloadTnpdsApplicationPdf(cleanRef);
            if (res && res.success && res.pdfPath) {
                shell.openPath(res.pdfPath); // Auto-opens PDF on operator PC
            }
            return res;
        }
    } catch (e) {
        console.error('Download PDF error in main:', e);
        return { success: false, message: e.message };
    }
    return { success: false, message: 'பதிவிறக்க தொகுதி கிடைக்கவில்லை.' };
});

ipcMain.handle('get-automation-status', async () => {
    return {
        isRunning: !!liveBrowserInstance,
        timestamp: Date.now()
    };
});

ipcMain.handle('scan-document-direct', async () => {
    // Local flatbed scanner bridge
    return {
        success: true,
        message: 'ஸ்கேனர் தயார் நிலையில் உள்ளது.'
    };
});

// ==========================================
// AUTOMATIC UPDATES (GitHub Releases Pipeline)
// ==========================================
function setupAutoUpdater() {
    if (!app.isPackaged && process.env.NODE_ENV !== 'production') {
        console.log('[AutoUpdater] Development mode: skipping automatic update check.');
        return;
    }

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('checking-for-update', () => {
        console.log('[AutoUpdater] Checking GitHub Releases for updates...');
    });

    autoUpdater.on('update-available', (info) => {
        console.log('[AutoUpdater] New update available:', info.version);
    });

    autoUpdater.on('update-not-available', () => {
        console.log('[AutoUpdater] Desktop app is up to date.');
    });

    autoUpdater.on('error', (err) => {
        console.warn('[AutoUpdater] Update check notice:', err ? err.message : err);
    });

    autoUpdater.on('update-downloaded', (info) => {
        console.log('[AutoUpdater] New update downloaded:', info.version);
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

    // Check 5 seconds after launch
    setTimeout(() => {
        autoUpdater.checkForUpdatesAndNotify().catch((err) => {
            console.warn('[AutoUpdater] Check notice:', err.message);
        });
    }, 5000);

    // Check periodically every hour
    setInterval(() => {
        autoUpdater.checkForUpdatesAndNotify().catch((err) => {
            console.warn('[AutoUpdater] Periodic check notice:', err.message);
        });
    }, 60 * 60 * 1000);
}

// App Lifecycle
app.whenReady().then(() => {
    createMainWindow();
    setupAutoUpdater();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
