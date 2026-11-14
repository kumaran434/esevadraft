// =========================================================================
// eSevaDraft Windows Desktop App — Core Orchestrator
// Commercial-Grade Intellectual Property Protection Enabled
// =========================================================================
const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

// Strip default Windows application menu
Menu.setApplicationMenu(null);

// Load environment variables across potential runtimes
const OFFICIAL_PRODUCTION_GEMINI_KEY = Buffer.from('QVEuQWI4Uk42S29EYklVZUlJbnMwNGFZLXdxQ2VTTkZidFhXTWxHdzRnY3lqeUVjRnBqdHc=', 'base64').toString('utf8');
try { require('dotenv').config({ path: path.join(__dirname, '..', '.env') }); } catch (_) {}
try { require('dotenv').config({ path: path.join(process.resourcesPath || '', '.env') }); } catch (_) {}
try {
    const uData = (typeof app !== 'undefined' && app.getPath) ? app.getPath('userData') : '';
    if (uData) {
        if (!fs.existsSync(uData)) fs.mkdirSync(uData, { recursive: true });
        const userEnv = path.join(uData, '.env');
        if (!fs.existsSync(userEnv)) {
            fs.writeFileSync(userEnv, `PORT=3000\nGEMINI_API_KEY=${OFFICIAL_PRODUCTION_GEMINI_KEY}\n`, 'utf-8');
        }
        require('dotenv').config({ path: userEnv });
    }
} catch (_) {}
try { require('dotenv').config(); } catch (_) {}
if (!process.env.GEMINI_API_KEY) {
    process.env.GEMINI_API_KEY = OFFICIAL_PRODUCTION_GEMINI_KEY;
}

const { createMainWindow, getMainWindow } = require('./window_manager');
const { setupAutoUpdater } = require('./desktop_services');
const { startLocalServer } = require('./local_server');
const { startAssetSyncService } = require('./asset_sync_service');
const { registerIpcHandlers } = require('./ipc_handlers');
const { startDesktopRuntimeWatchdog } = require('./app_runtime_watchdog');

let activeAutomationModule = null;

// Register all Desktop IPC channels
registerIpcHandlers({
    getMainWindow,
    getActiveModule: () => activeAutomationModule,
    setActiveModule: (mod) => { activeAutomationModule = mod; }
});

// Single-Instance Mutex Enforcement: Prevents duplicate process race conditions
const gotTheLock = (typeof app !== 'undefined' && app.requestSingleInstanceLock) ? app.requestSingleInstanceLock() : true;

if (!gotTheLock) {
    console.log('🔒 [Single Instance] Another instance of eSevaDraft is already running. Quitting.');
    app.quit();
} else {
    if (typeof app !== 'undefined' && app.on) {
        app.on('second-instance', () => {
            let myWin = getMainWindow();
            if (myWin && !myWin.isDestroyed()) {
                if (myWin.isMinimized()) myWin.restore();
                myWin.show();
                myWin.setAlwaysOnTop(true);
                myWin.focus();
                setTimeout(() => {
                    if (myWin && !myWin.isDestroyed()) myWin.setAlwaysOnTop(false);
                }, 1000);
            } else {
                createMainWindow();
            }
        });
    }

    // Process-level crash immunizer
    process.on('unhandledRejection', (reason) => {
        console.warn('⚠️ [Desktop Runtime] Caught unhandled promise rejection:', reason ? (reason.message || reason) : 'Unknown');
    });
    process.on('uncaughtException', (err) => {
        console.error('⚠️ [Desktop Runtime] Caught uncaught exception:', err ? (err.message || err) : 'Unknown');
    });

    // App Lifecycle
    app.whenReady().then(() => {
        // Stale Cache Purge upon Version Upgrade: Prevents zombie UI cache across installer updates
        try {
            const userData = (typeof app !== 'undefined' && app.getPath) ? app.getPath('userData') : '';
            const currentVer = app.getVersion() || '1.1.19';
            if (userData) {
                const verFile = path.join(userData, '.installed_version');
                let prevVer = '';
                try { if (fs.existsSync(verFile)) prevVer = fs.readFileSync(verFile, 'utf8').trim(); } catch (_) {}
                if (prevVer !== currentVer) {
                    console.log(`🚀 [Version Transition] Upgraded from ${prevVer || 'prior'} to ${currentVer}. Purging stale cache...`);
                    const userPublic = path.join(userData, 'public');
                    if (fs.existsSync(userPublic)) {
                        try { fs.rmSync(userPublic, { recursive: true, force: true }); } catch (_) {}
                    }
                    // Self-heal any corrupted Chromium IndexedDB from legacy app.exit(0) while preserving Local Storage & user profiles
                    const userIndexedDb = path.join(userData, 'IndexedDB');
                    if (fs.existsSync(userIndexedDb)) {
                        try { fs.rmSync(userIndexedDb, { recursive: true, force: true }); } catch (_) {}
                    }
                    try { fs.writeFileSync(verFile, currentVer, 'utf8'); } catch (_) {}
                }
            }

            // Startup Leakage & Legacy Artifacts Purge: Completely wipes any leaked dev drafts or vault from older installers
            const resData = path.join(process.resourcesPath || '', 'data');
            if (fs.existsSync(resData)) {
                const resDrafts = path.join(resData, 'drafts');
                if (fs.existsSync(resDrafts)) {
                    try { fs.rmSync(resDrafts, { recursive: true, force: true }); } catch (_) {}
                }
                const resVault = path.join(resData, 'operator_vault.json');
                if (fs.existsSync(resVault)) {
                    try { fs.unlinkSync(resVault); } catch (_) {}
                }
                const resCitizens = path.join(resData, 'citizens.json');
                if (fs.existsSync(resCitizens)) {
                    try { fs.writeFileSync(resCitizens, '{}', 'utf8'); } catch (_) {}
                }
                const resSessions = path.join(resData, 'sessions.json');
                if (fs.existsSync(resSessions)) {
                    try { fs.writeFileSync(resSessions, '{}', 'utf8'); } catch (_) {}
                }
            }

            // If running on an external user's machine (not the dev machine with source repo), purge legacy test drafts from userData
            const isLocalDevPC = process.env.USERNAME === 'ADMIN' && fs.existsSync('d:\\downloads\\ai assitant 2');
            if (!isLocalDevPC && userData) {
                const uDrafts = path.join(userData, 'data', 'drafts');
                const leakedDraft = path.join(uDrafts, '9790170026.json');
                if (fs.existsSync(leakedDraft)) {
                    try { fs.unlinkSync(leakedDraft); } catch (_) {}
                }
                if (fs.existsSync(uDrafts)) {
                    try {
                        const dfList = fs.readdirSync(uDrafts);
                        for (const df of dfList) {
                            if (df.endsWith('.json')) {
                                const fullP = path.join(uDrafts, df);
                                try {
                                    const parsed = JSON.parse(fs.readFileSync(fullP, 'utf8'));
                                    if (!parsed.operatorUid && df === '9790170026.json') {
                                        fs.unlinkSync(fullP);
                                    }
                                } catch (_) {}
                            }
                        }
                    } catch (_) {}
                }
            }
        } catch (e) {
            console.warn('[Cache & Leakage Purge Error]:', e.message);
        }

        startLocalServer(() => activeAutomationModule, (mod) => { activeAutomationModule = mod; });
        createMainWindow();

        // Defer non-critical background services to ensure UI thread remains 100% responsive (<50ms) on startup
        setTimeout(() => {
            setupAutoUpdater(getMainWindow);
        }, 5000);

        setTimeout(() => {
            startDesktopRuntimeWatchdog(getMainWindow);
        }, 8000);

        setTimeout(() => {
            startAssetSyncService();
        }, 20000);

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
        });
    });
}

function flushAllBrowserStorage() {
    try {
        const { session } = require('electron');
        if (session && session.defaultSession && typeof session.defaultSession.flushStorageData === 'function') {
            session.defaultSession.flushStorageData();
        }
        BrowserWindow.getAllWindows().forEach(w => {
            try {
                if (!w.isDestroyed() && w.webContents && w.webContents.session) {
                    w.webContents.session.flushStorageData();
                }
            } catch (_) {}
        });
    } catch (_) {}
}

async function cleanupAutomation() {
    flushAllBrowserStorage();
    try {
        if (activeAutomationModule && typeof activeAutomationModule.stopTnpdsAutomation === 'function') {
            await activeAutomationModule.stopTnpdsAutomation();
        } else {
            const tnpds = require('../tnpds_automation');
            if (tnpds && typeof tnpds.stopTnpdsAutomation === 'function') {
                await tnpds.stopTnpdsAutomation();
            }
        }
    } catch (_) {}
}

app.on('before-quit', () => {
    flushAllBrowserStorage();
    cleanupAutomation();
});

app.on('window-all-closed', () => {
    flushAllBrowserStorage();
    try { cleanupAutomation(); } catch (_) {}
    if (process.platform !== 'darwin') {
        app.quit();
        setTimeout(() => {
            process.exit(0);
        }, 1200);
    }
});

process.on('SIGINT', () => { cleanupAutomation().finally(() => process.exit(0)); });
process.on('SIGTERM', () => { cleanupAutomation().finally(() => process.exit(0)); });
