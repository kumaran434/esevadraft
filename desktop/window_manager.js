// =========================================================================
// eSevaDraft Desktop App — Window Manager & Anti-Tamper Shield
// =========================================================================
const { BrowserWindow, shell } = require('electron');
const path = require('path');
const localServer = require('./local_server');

let mainWindow = null;

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
        const allowedOrigins = ['https://esevadraft.in', 'https://gen-lang-client-0792225149.web.app', 'http://localhost:3000', 'http://127.0.0.1:3000'];
        const isAllowed = allowedOrigins.some(origin => url.startsWith(origin)) || /^http:\/\/(127\.0\.0\.1|localhost):300\d/.test(url);
        const isGovtPortal = url.includes('tnpds.gov.in') || url.includes('esevai.elcot.in') || url.includes('tnreginet.gov.in');
        if (!isAllowed) {
            event.preventDefault();
            if (isGovtPortal) {
                shell.openExternal(url);
            }
        }
    });

    // 4. window.open() calls (target="_blank") — open govt portals in system browser, open documents in clean viewer
    win.webContents.setWindowOpenHandler(({ url }) => {
        const isGovtPortal = url.includes('tnpds.gov.in') || url.includes('esevai.elcot.in') || url.includes('tnreginet.gov.in');
        const isEsevaDraft = url.includes('esevadraft.in') || url.includes('localhost') || url.includes('127.0.0.1');
        if (isGovtPortal) {
            shell.openExternal(url);
            return { action: 'deny' };
        }
        if (isEsevaDraft) {
            return {
                action: 'allow',
                overrideBrowserWindowOptions: {
                    width: 920,
                    height: 780,
                    title: 'eSevaDraft — ஆவணப் பார்வை (Document Viewer)',
                    autoHideMenuBar: true,
                    backgroundColor: '#0f172a'
                }
            };
        }
        return { action: 'deny' };
    });
}

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1366,
        height: 850,
        minWidth: 1024,
        minHeight: 700,
        show: true,
        title: 'eSevaDraft — தமிழ்நாடு அரசு சேவைகள் ஏஐ',
        backgroundColor: '#0f172a',
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
            webSecurity: true,
            devTools: false
        }
    });

    mainWindow.removeMenu();
    mainWindow.setMenuBarVisibility(false);

    try {
        mainWindow.webContents.setUserAgent(mainWindow.webContents.getUserAgent() + ' eSevaDraft-Desktop/' + (app.getVersion() || '1.1.15'));
    } catch (_) {}

    const forceVisibleForeground = () => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.moveTop();
        mainWindow.setAlwaysOnTop(true);
        mainWindow.focus();
        setTimeout(() => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.setAlwaysOnTop(false);
            }
        }, 1500);
    };

    forceVisibleForeground();

    mainWindow.on('page-title-updated', (event, title) => {
        if (title && (title.includes('http://') || title.includes('https://') || title.includes('.in'))) {
            event.preventDefault();
            mainWindow.setTitle('eSevaDraft — தமிழ்நாடு அரசு சேவைகள் ஏஐ');
        }
    });

    mainWindow.on('maximize', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('window-maximize-changed', true);
        }
    });
    mainWindow.on('unmaximize', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('window-maximize-changed', false);
        }
    });

    applyAntiTamperShield(mainWindow);

    mainWindow.once('ready-to-show', () => {
        forceVisibleForeground();
    });

    mainWindow.webContents.on('did-finish-load', () => {
        forceVisibleForeground();
    });

    (async () => {
        let targetUrl = process.env.ESEVA_DEV_URL || 'http://127.0.0.1:3000';
        if (!process.env.ESEVA_DEV_URL && typeof localServer.whenServerReady === 'function') {
            try {
                targetUrl = await Promise.race([
                    localServer.whenServerReady(),
                    new Promise(r => setTimeout(() => r(localServer.getActiveServerUrl()), 3000))
                ]) || targetUrl;
            } catch (_) {}
        }
        if (mainWindow && !mainWindow.isDestroyed()) {
            try {
                await mainWindow.loadURL(targetUrl);
            } catch (err) {
                console.warn('[Window Manager] Local server initial load retry:', err.message);
                await new Promise(r => setTimeout(r, 200));
                if (mainWindow && !mainWindow.isDestroyed()) {
                    await mainWindow.loadURL(targetUrl).catch(() => {
                        mainWindow.loadURL('https://esevadraft.in');
                    });
                }
            }
        }
    })();

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    return mainWindow;
}

function getMainWindow() {
    return mainWindow;
}

module.exports = {
    createMainWindow,
    getMainWindow,
    applyAntiTamperShield
};
