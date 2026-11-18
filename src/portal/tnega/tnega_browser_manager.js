const path = require('path');
const fs = require('fs');

let chromium = null;
function getChromium() {
    if (chromium) return chromium;
    try {
        chromium = require('playwright').chromium;
    } catch (e) {
        try {
            chromium = require('playwright-core').chromium;
        } catch (e2) {
            const searchPaths = [
                path.join(process.resourcesPath || '', 'app.asar.unpacked', 'node_modules', 'playwright-core'),
                path.join(process.resourcesPath || '', 'node_modules', 'playwright-core'),
                path.join(__dirname, '..', '..', '..', 'app.asar.unpacked', 'node_modules', 'playwright-core'),
                path.join(__dirname, '..', '..', '..', '..', 'desktop', 'node_modules', 'playwright-core')
            ];
            for (const sp of searchPaths) {
                try {
                    if (fs.existsSync(sp)) {
                        chromium = require(sp).chromium;
                        if (chromium) break;
                    }
                } catch (err) {}
            }
        }
    }
    return chromium;
}

let tnegaBrowser = null;
let tnegaContext = null;
let tnegaPage = null;

let isMockSandboxMode = true;
let isWaitingForCanOtp = false;
let isWaitingForCaptcha = false;
let pendingCanOtpResolver = null;
let activeCanNumber = null;
let currentTnegaStep = 'IDLE';
let lastTnegaError = null;

let pendingCanOtpValue = null;

function setTnegaChromiumInstance(inst) {
    if (inst) chromium = inst;
}

function getTnegaState() {
    return {
        get browser() { return tnegaBrowser; },
        set browser(v) { tnegaBrowser = v; },
        get context() { return tnegaContext; },
        set context(v) { tnegaContext = v; },
        get page() { return tnegaPage; },
        set page(v) { tnegaPage = v; },
        get isMockSandboxMode() { return isMockSandboxMode; },
        set isMockSandboxMode(v) { isMockSandboxMode = v; },
        get isWaitingForCanOtp() { return isWaitingForCanOtp; },
        set isWaitingForCanOtp(v) { isWaitingForCanOtp = v; },
        get isWaitingForCaptcha() { return isWaitingForCaptcha; },
        set isWaitingForCaptcha(v) { isWaitingForCaptcha = v; },
        get pendingCanOtpResolver() { return pendingCanOtpResolver; },
        set pendingCanOtpResolver(v) { pendingCanOtpResolver = v; },
        get pendingCanOtpValue() { return pendingCanOtpValue; },
        set pendingCanOtpValue(v) { pendingCanOtpValue = v; },
        get activeCanNumber() { return activeCanNumber; },
        set activeCanNumber(v) { activeCanNumber = v; },
        get currentTnegaStep() { return currentTnegaStep; },
        set currentTnegaStep(v) { currentTnegaStep = v; },
        get lastTnegaError() { return lastTnegaError; },
        set lastTnegaError(v) { lastTnegaError = v; }
    };
}

function getLiveTnegaStatus() {
    return {
        step: currentTnegaStep,
        isWaitingForCanOtp,
        isWaitingForCaptcha,
        isMockSandbox: isMockSandboxMode,
        activeCanNumber,
        lastError: lastTnegaError
    };
}

async function maximizeTnegaWindow(page) {
    if (!page || page.isClosed()) return;
    try {
        const cdp = await page.context().newCDPSession(page);
        const { windowId } = await cdp.send('Browser.getWindowForTarget');
        if (windowId) {
            await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'maximized' } });
            console.log('🖥️ [CDP] Chrome சாளரம் முழுத் திரையாக (100% Maximized) மாற்றப்பட்டது.');
        }
    } catch (_) {}
}

async function launchTnegaBrowser(headless = false, options = {}) {
    if (tnegaPage && !tnegaPage.isClosed()) {
        await maximizeTnegaWindow(tnegaPage);
        return { browser: tnegaBrowser, context: tnegaContext, page: tnegaPage };
    }

    let activeChromium = options.chromium || chromium;
    if (!activeChromium) {
        activeChromium = getChromium();
    }
    if (!activeChromium) {
        throw new Error('Playwright Chromium browser engine not installed or found.');
    }

    const launchArgs = [
        '--disable-blink-features=AutomationControlled',
        '--start-maximized',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-infobars',
        '--remote-debugging-port=9222'
    ];

    // 1. Try connecting to existing visible Chrome on port 9222
    try {
        tnegaBrowser = await activeChromium.connectOverCDP('http://127.0.0.1:9222');
        const contexts = tnegaBrowser.contexts();
        tnegaContext = contexts[0] || (await tnegaBrowser.newContext());
        tnegaPage = tnegaContext.pages().find(p => !p.isClosed() && (p.url().toLowerCase().includes('services.aspx') || p.url().toLowerCase().includes('canregistration') || p.url().toLowerCase().includes('instruction')))
            || tnegaContext.pages().find(p => !p.isClosed() && (p.url().includes('tnesevai') || p.url().includes('tnega') || !p.url().includes('about:blank')))
            || (await tnegaContext.newPage());
        try {
            const cdp = await tnegaContext.newCDPSession(tnegaPage);
            const { windowId } = await cdp.send('Browser.getWindowForTarget');
            if (windowId) {
                await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'maximized' } });
            }
        } catch (_) {}
        return { browser: tnegaBrowser, context: tnegaContext, page: tnegaPage };
    } catch (_) {}

    try {
        tnegaBrowser = await activeChromium.launch({
            headless: headless,
            channel: 'chrome',
            args: launchArgs
        });
    } catch (_) {
        tnegaBrowser = await activeChromium.launch({
            headless: headless,
            args: launchArgs
        });
    }

    const contextOptions = {
        viewport: null,
        locale: 'ta-IN',
        timezoneId: 'Asia/Kolkata',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };

    const cookiePath = path.join(__dirname, '..', '..', '..', 'data', 'tnega_cookies.json');
    if (fs.existsSync(cookiePath)) {
        try {
            contextOptions.storageState = cookiePath;
        } catch (_) {}
    }

    tnegaContext = await tnegaBrowser.newContext(contextOptions);
    tnegaPage = await tnegaContext.newPage();
    tnegaPage.on('dialog', async (dialog) => {
        try {
            console.log(`🔔 [TNeGA Dialog] ${dialog.type()}: "${dialog.message()}"`);
            await dialog.accept().catch(() => {});
        } catch (_) {}
    });

    // Enforce 100% full-screen maximized window natively via CDP
    await maximizeTnegaWindow(tnegaPage);

    return { browser: tnegaBrowser, context: tnegaContext, page: tnegaPage };
}

function provideCanOtp(otp) {
    const clean = (otp || '').toString().trim();
    pendingCanOtpValue = clean;
    if (pendingCanOtpResolver) {
        const res = pendingCanOtpResolver;
        pendingCanOtpResolver = null;
        res(clean);
        return { success: true };
    }
    if (isWaitingForCanOtp) {
        return { success: true, message: 'CAN OTP பெறப்பட்டது.' };
    }
    return { success: false, message: 'எந்த ஒரு OTP சரிபார்ப்பும் காத்திருப்பில் இல்லை.' };
}

async function stopTnegaAutomation() {
    if (tnegaBrowser) {
        await tnegaBrowser.close().catch(() => {});
        tnegaBrowser = null;
        tnegaContext = null;
        tnegaPage = null;
    }
    isWaitingForCanOtp = false;
    isWaitingForCaptcha = false;
    pendingCanOtpResolver = null;
    currentTnegaStep = 'IDLE';
    return { success: true };
}

/**
 * Clicks #ss:decForm1 on TNeGA uploadDocs.xhtml, saves the Self-Declaration PDF
 * into the user's Downloads + data/downloads folder, and opens it visibly in a new Chrome tab.
 * NEVER auto-uploads the unsigned Self-Declaration form (operator must obtain citizen signature).
 */
async function downloadAndOpenSelfDeclaration(tnegaPage, appNumber = '', onProgress = () => {}) {
    const path = require('path');
    const fs = require('fs');
    const decLink = tnegaPage.locator('a[id="ss:decForm1"], #ss\\:decForm1, [id*="decForm"], a:has-text("Download Self declaration form")').first();
    if (await decLink.count() === 0 || !(await decLink.isVisible().catch(() => false))) {
        return null;
    }

    onProgress('📥 [சுய உறுதிமொழி பதிவிறக்கம்] விண்ணப்பதாரரின் சுய உறுதிமொழிப் படிவம் போர்ட்டலில் இருந்து பதிவிறக்கப்படுகிறது...');
    const userDownloadsDir = path.join(process.env.USERPROFILE || 'C:\\Users\\ADMIN', 'Downloads');
    fs.mkdirSync(userDownloadsDir, { recursive: true });
    const clickStartMs = Date.now() - 2500;

    try {
        const cdpClient = await tnegaPage.context().newCDPSession(tnegaPage);
        await cdpClient.send('Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: userDownloadsDir
        });
    } catch (_) {}

    const [dlEvent] = await Promise.all([
        tnegaPage.waitForEvent('download', { timeout: 7000 }).catch(() => null),
        decLink.click().catch(() => {})
    ]);
    await tnegaPage.waitForTimeout(2500);

    let downloadedFile = null;
    const cleanApp = String(appNumber || '').trim();
    if (dlEvent) {
        const suggested = dlEvent.suggestedFilename() || `SelfDeclarationForm_${cleanApp || Date.now()}.pdf`;
        const targetDlPath = path.join(userDownloadsDir, suggested);
        await dlEvent.saveAs(targetDlPath).catch(() => {});
        if (fs.existsSync(targetDlPath)) downloadedFile = targetDlPath;
    }

    if (!downloadedFile) {
        try {
            const candidates = fs.readdirSync(userDownloadsDir)
                .filter(f => f.toLowerCase().endsWith('.pdf') && (f.toLowerCase().includes('selfdeclaration') || (cleanApp && f.includes(cleanApp))))
                .map(f => ({ name: f, full: path.join(userDownloadsDir, f), time: fs.statSync(path.join(userDownloadsDir, f)).mtimeMs }))
                .sort((a, b) => b.time - a.time);
            const fresh = candidates.find(c => c.time >= clickStartMs) || candidates[0];
            if (fresh) downloadedFile = fresh.full;
        } catch (_) {}
    }

    if (!downloadedFile || !fs.existsSync(downloadedFile)) {
        onProgress('⚠️ சுய உறுதிமொழிப் படிவப் பதிவிறக்கம் கண்டறியப்படவில்லை; ஆப்ரேட்டர் Download இணைப்பைக் கிளிக் செய்யவும்.');
        return null;
    }

    const dlDir = path.join(process.cwd(), 'data', 'downloads');
    fs.mkdirSync(dlDir, { recursive: true });
    const savedCopy = path.join(dlDir, `self_declaration_${cleanApp || 'latest'}.pdf`);
    try { fs.copyFileSync(downloadedFile, savedCopy); } catch (_) {}

    onProgress(`✅ [சுய உறுதிமொழி தயார்] படிவம் பதிவிறக்கப்பட்டது: ${path.basename(downloadedFile)}`);
    try {
        const newPage = await tnegaPage.context().newPage();
        await newPage.goto('file:///' + downloadedFile.replace(/\\/g, '/'));
        await newPage.bringToFront().catch(() => {});
        onProgress('🌐 சுய உறுதிமொழிப் படிவம் Google Chrome புதிய Tab-ல் திறக்கப்பட்டது! (கையொப்பம் பெற்று ஆப்ரேட்டரே பதிவேற்றவும்) ✅');
    } catch (_) {}

    return savedCopy;
}

module.exports = {
    getTnegaState,
    getLiveTnegaStatus,
    launchTnegaBrowser,
    maximizeTnegaWindow,
    provideCanOtp,
    stopTnegaAutomation,
    setTnegaChromiumInstance,
    downloadAndOpenSelfDeclaration
};
