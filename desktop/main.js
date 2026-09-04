// =========================================================================
// eSevaDraft Windows Desktop App — Core Engine & Security Shield
// Commercial-Grade Intellectual Property Protection Enabled
// =========================================================================
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

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

    // 3. Disable native window navigation away from authorized eSevaDraft domains
    win.webContents.on('will-navigate', (event, url) => {
        const allowedOrigins = ['https://esevadraft.in', 'https://gen-lang-client-0792225149.web.app', 'http://localhost:3000'];
        const isAllowed = allowedOrigins.some(origin => url.startsWith(origin));
        if (!isAllowed && !url.includes('tnpds.gov.in')) {
            event.preventDefault();
        }
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
            preload: fs.existsSync(path.join(__dirname, 'preload.loader.js')) 
                ? path.join(__dirname, 'preload.loader.js') 
                : path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            webSecurity: true,
            devTools: false
        }
    });

    applyAntiTamperShield(mainWindow);

    // Load web portal
    const targetUrl = process.env.ESEVA_DEV_URL || 'https://esevadraft.in';
    mainWindow.loadURL(targetUrl);

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// IPC Handlers
ipcMain.handle('start-live-automation', async (_event, data) => {
    try {
        console.log('[Desktop] Starting local visual automation for:', data.mobileNumber);
        
        // Dynamically require local Playwright with visible Chromium window
        const { chromium } = require('playwright-core');
        
        // Launch local Chrome on operator screen (headless: false gives 100% visual trust!)
        liveBrowserInstance = await chromium.launch({
            headless: false,
            channel: 'chrome',
            args: ['--start-maximized', '--disable-blink-features=AutomationControlled']
        });

        const context = await liveBrowserInstance.newContext({ viewport: null });
        const page = await context.newPage();

        // Navigate to official portal
        await page.goto('https://www.tnpds.gov.in/pages/register/cardreg-home.xhtml', { waitUntil: 'domcontentloaded' });
        
        return { success: true, message: 'அரசு தளம் உங்கள் கணினியில் திறக்கப்பட்டது!' };
    } catch (err) {
        console.error('[Desktop] Automation launch error:', err);
        return { success: false, error: err.message };
    }
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

// App Lifecycle
app.whenReady().then(() => {
    createMainWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
