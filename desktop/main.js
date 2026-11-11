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
try { require('dotenv').config({ path: path.join(__dirname, '..', '.env') }); } catch (_) {}
try { require('dotenv').config({ path: path.join(process.resourcesPath || '', '.env') }); } catch (_) {}
try {
    const uData = (typeof app !== 'undefined' && app.getPath) ? app.getPath('userData') : '';
    if (uData) require('dotenv').config({ path: path.join(uData, '.env') });
} catch (_) {}
try { require('dotenv').config(); } catch (_) {}

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
            const currentVer = app.getVersion() || '1.1.16';
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
                    try { fs.writeFileSync(verFile, currentVer, 'utf8'); } catch (_) {}
                }
            }
        } catch (e) {
            console.warn('[Cache Purge Error]:', e.message);
        }

        startLocalServer(() => activeAutomationModule, (mod) => { activeAutomationModule = mod; });
        createMainWindow();

        // Defer non-critical background services until after the UI window is visible
        setTimeout(() => {
            startAssetSyncService();
            setupAutoUpdater(getMainWindow);
            startDesktopRuntimeWatchdog(getMainWindow);
        }, 1500);

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
        });
    });
}

async function cleanupAutomation() {
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
    cleanupAutomation();
});

app.on('window-all-closed', () => {
    try { cleanupAutomation(); } catch (_) {}
    if (process.platform !== 'darwin') {
        app.exit(0);
    }
});

process.on('SIGINT', () => { cleanupAutomation().finally(() => process.exit(0)); });
process.on('SIGTERM', () => { cleanupAutomation().finally(() => process.exit(0)); });
