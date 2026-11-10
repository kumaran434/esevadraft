// =========================================================================
// eSevaDraft Desktop App — IPC Handlers Bridge
// =========================================================================
const { ipcMain, shell, app } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { executeLiveDesktopAutomation, loadAutomationModule } = require('./automation_runner');

function registerIpcHandlers({ getMainWindow, getActiveModule, setActiveModule }) {
    // Custom frameless window controls
    ipcMain.on('window-minimize', () => {
        const win = getMainWindow();
        if (win && !win.isDestroyed()) win.minimize();
    });
    ipcMain.on('window-maximize', () => {
        const win = getMainWindow();
        if (win && !win.isDestroyed()) {
            if (win.isMaximized()) win.unmaximize();
            else win.maximize();
        }
    });
    ipcMain.on('window-close', () => {
        const win = getMainWindow();
        if (win && !win.isDestroyed()) win.close();
    });
    ipcMain.handle('window-is-maximized', () => {
        const win = getMainWindow();
        return win && !win.isDestroyed() ? win.isMaximized() : false;
    });

    // Start Live Automation
    ipcMain.handle('start-live-automation', async (_event, draftData) => {
        return executeLiveDesktopAutomation(draftData, getMainWindow(), getActiveModule, setActiveModule);
    });

    // Stop Live Automation
    ipcMain.handle('stop-live-automation', async (_event, payload) => {
        try {
            const isSilent = Boolean(payload && payload.silent);
            const activeMod = getActiveModule() || loadAutomationModule();
            let wasRunning = false;
            if (activeMod) {
                if (typeof activeMod.isAutomationRunning === 'function') {
                    wasRunning = activeMod.isAutomationRunning();
                } else if (activeMod.activeSessions && activeMod.activeSessions.size > 0) {
                    wasRunning = true;
                }
                if (activeMod.stopTnpdsAutomation) {
                    const stopRes = await activeMod.stopTnpdsAutomation();
                    if (stopRes && stopRes.wasRunning !== undefined) {
                        wasRunning = wasRunning || stopRes.wasRunning;
                    }
                }
            }
            const win = getMainWindow();
            // Invariant: ONLY send stopped broadcast if an automation was ACTUALLY running and it's NOT a silent reset!
            if (win && !win.isDestroyed() && !isSilent && wasRunning) {
                win.webContents.send('automation-step-update', '🛑 ஆட்டோமேஷன் நிறுத்தப்பட்டது.');
                win.webContents.send('automation-finished', { success: false, stopped: true, wasRunning: true, message: 'ஆட்டோமேஷன் நிறுத்தப்பட்டது.' });
            }
            return { success: true, wasRunning };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    // Approve Final Submit
    ipcMain.handle('approve-final-submit', async (_event, payload) => {
        try {
            const proceedSubmit = (payload && typeof payload === 'object') ? payload.proceedSubmit !== false : true;
            const action = (payload && payload.action) || (proceedSubmit ? 'submit' : 'halt_dry_run');
            const activeMod = getActiveModule() || loadAutomationModule();
            if (activeMod && activeMod.provideOperatorApproval) {
                return activeMod.provideOperatorApproval(true, proceedSubmit, action);
            }
        } catch (e) {
            console.warn('Approve submit error in main:', e.message);
        }
        return false;
    });

    // Provide Live OTP
    ipcMain.handle('provide-live-otp', async (_event, otp) => {
        try {
            const clean = String(otp || '').replace(/\D/g, '').trim();
            let handled = false;
            const activeMod = getActiveModule() || loadAutomationModule();
            if (activeMod && typeof activeMod.provideOtp === 'function') {
                handled = activeMod.provideOtp(clean);
            }
            const diskLocations = [
                path.join(__dirname, '..', 'data', 'pending_otp.txt'),
                path.join(app.getPath('userData'), 'data', 'pending_otp.txt'),
                path.join(app.getPath('userData'), 'pending_otp.txt')
            ];
            for (const loc of diskLocations) {
                try {
                    fs.mkdirSync(path.dirname(loc), { recursive: true });
                    fs.writeFileSync(loc, clean, 'utf8');
                } catch (_) {}
            }
            return { success: true, handled };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    // Download TNPDS PDF
    ipcMain.handle('download-tnpds-pdf', async (_event, refNo) => {
        try {
            const cleanRef = String(refNo || '').replace(/\D/g, '').trim();
            if (!cleanRef) return { success: false, message: 'சரியான விண்ணப்ப குறிப்பு எண் தேவை.' };

            const saveFilename = `Application_${cleanRef}.pdf`;
            const candidatePaths = [
                path.join(os.tmpdir(), 'esevadraft', 'receipts', saveFilename),
                path.join(app.getPath('userData'), 'receipts', saveFilename),
                path.join(process.resourcesPath || '', 'public', 'receipts', saveFilename),
                path.join(__dirname, '..', 'public', 'receipts', saveFilename)
            ];

            for (const p of candidatePaths) {
                if (fs.existsSync(p)) {
                    shell.openPath(p);
                    return { success: true, pdfPath: p, fromCache: true };
                }
            }

            const autoMod = getActiveModule() || loadAutomationModule();
            if (autoMod && autoMod.downloadTnpdsApplicationPdf) {
                const res = await autoMod.downloadTnpdsApplicationPdf(cleanRef);
                if (res && res.success && res.pdfPath) {
                    shell.openPath(res.pdfPath);
                }
                return res;
            }
        } catch (e) {
            return { success: false, message: e.message };
        }
        return { success: false, message: 'பதிவிறக்க தொகுதி கிடைக்கவில்லை.' };
    });

    ipcMain.handle('get-automation-status', async () => {
        return { isRunning: false, timestamp: Date.now() };
    });

    ipcMain.handle('scan-document-direct', async () => {
        return { success: true, message: 'ஸ்கேனர் தயார் நிலையில் உள்ளது.' };
    });

    ipcMain.handle('restore-focus', async () => {
        try {
            const win = getMainWindow();
            if (win && !win.isDestroyed()) {
                win.focus();
                if (win.webContents) win.webContents.focus();
            }
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });
}

module.exports = { registerIpcHandlers };
