/**
 * TNPDS Add Member - Browser Launcher, CDP Connect, Telemetry & Listeners
 */
const fs = require('fs');
const path = require('path');
const { injectRadwareStealthShield } = require('../../../common/universal_radware_resumption');
const { getOperatorProfilePath } = require('../../../common/operator_browser_manager');

async function launchAddMemberBrowser(citizenProfile, options, onProgress, sharedContext) {
    const {
        chromium,
        setBrowser = () => {},
        setPage = () => {},
        setContext = () => {},
        forceWindowToFront = async () => {}
    } = sharedContext;

    const cookiePath = path.join(__dirname, '..', '..', '..', '..', 'data', 'tnpds_cookies.json');
    const isProduction = options.headless !== undefined 
        ? Boolean(options.headless)
        : (process.platform === 'linux' && !process.env.DISPLAY ? true : (process.env.HEADLESS === 'true'));

    const activeChromium = options.chromium || chromium || require('playwright-core').chromium;
    if (!activeChromium) throw new Error('Playwright Chromium module not found.');

    let browser = null;
    let context = null;
    let page = null;
    let isAttached = false;

    // Step 1: Check if operator already has Google Chrome running with remote debugging port 9222
    if (!isProduction) {
        try {
            console.log('🔍 [Chrome Tab Attach] Checking existing Chrome on port 9222...');
            const cdpBrowser = await activeChromium.connectOverCDP('http://127.0.0.1:9222', { timeout: 1500 });
            if (cdpBrowser && cdpBrowser.isConnected()) {
                const existingContexts = cdpBrowser.contexts();
                const firstCtx = existingContexts.length > 0 ? existingContexts[0] : null;
                const existingPages = firstCtx ? firstCtx.pages().filter(p => !p.isClosed()) : [];
                const isElectronWindow = existingPages.length === 1 && existingPages[0].url().includes('127.0.0.1:300');
                if (!isElectronWindow) {
                    onProgress('⚡ [நேரடி குரோம் இணைப்பு] உங்கள் கணினியில் ஏற்கனவே இயங்கும் Google Chrome சாளரத்துடன் இணைக்கப்படுகிறது...');
                    browser = cdpBrowser;
                    context = firstCtx || await browser.newContext();
                    page = existingPages.find(p => p.url().includes('newsmartcard')) ||
                           existingPages.find(p => p.url().includes('tnpds.gov.in') || p.url().includes('perfdrive')) ||
                           existingPages.find(p => p.url() === 'about:blank' || p.url().startsWith('chrome://newtab'));
                    if (!page) {
                        page = await context.newPage();
                    } else {
                        for (const p of existingPages) {
                            if (p !== page && !p.isClosed()) {
                                const u = p.url().toLowerCase();
                                if (u.includes('messages.google.com') || u.includes('google.com/messages') || u.includes('127.0.0.1:300') || u.includes('esevadraft')) continue;
                                if (u === 'about:blank' || (u.includes('tnpds.gov.in') && !u.includes('newsmartcard'))) {
                                    try { await p.close(); } catch (_) {}
                                }
                            }
                        }
                    }
                    await page.bringToFront().catch(() => {});
                    isAttached = true;
                    setBrowser(browser); setContext(context); setPage(page);
                }
            }
        } catch (cdpErr) {}
    }

    if (!isAttached) {
        const launchArgs = [
            '--start-maximized',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-blink-features=AutomationControlled',
            '--remote-debugging-port=9222'
        ];

        const persistentProfileDir = getOperatorProfilePath();
        onProgress(`🌐 [ஆபரேட்டர் குரோம்] உங்கள் நிரந்தர சுயவிவரத்துடன் Google Chrome திறக்கப்படுகிறது...`);

        const persistentOptions = {
            channel: 'chrome',
            headless: isProduction,
            ignoreDefaultArgs: ['--enable-automation'],
            args: launchArgs,
            viewport: null,
            permissions: ['geolocation'],
            geolocation: { latitude: 12.9716, longitude: 79.1586 }
        };

        try {
            context = await activeChromium.launchPersistentContext(persistentProfileDir, persistentOptions);
            browser = context.browser ? context.browser() : null;
            onProgress('✅ [Google Chrome தயார்] உங்கள் ஆபரேட்டர் சுயவிவரத்துடன் Chrome சாளரம் திறக்கப்பட்டது!');
        } catch (launchErr) {
            console.warn('Chrome persistent launch fallback:', launchErr.message);
            try {
                context = await activeChromium.launchPersistentContext(persistentProfileDir, {
                    ...persistentOptions,
                    channel: 'msedge'
                });
                browser = context.browser ? context.browser() : null;
                onProgress('✅ [Microsoft Edge தயார்] Edge சாளரம் வெற்றிகரமாக திறக்கப்பட்டது!');
            } catch (edgeErr) {
                try {
                    context = await activeChromium.launchPersistentContext(persistentProfileDir, {
                        ...persistentOptions,
                        channel: undefined
                    });
                    browser = context.browser ? context.browser() : null;
                    onProgress('✅ [Chromium தயார்] Chromium சாளரம் வெற்றிகரமாக திறக்கப்பட்டது!');
                } catch (persErr) {
                    console.warn('Persistent profile fallback to standard launch:', persErr.message);
                    browser = await activeChromium.launch({
                        channel: 'chrome',
                        headless: isProduction,
                        ignoreDefaultArgs: ['--enable-automation'],
                        args: launchArgs
                    });
                    context = await browser.newContext({
                        viewport: null,
                        permissions: ['geolocation'],
                        geolocation: { latitude: 12.9716, longitude: 79.1586 }
                    });
                }
            }
        }

        const existingPages = context.pages().filter(p => !p.isClosed());
        page = existingPages.length > 0 ? existingPages[0] : await context.newPage();
        setBrowser(browser); setContext(context); setPage(page);
    }

    const telemetryDir = path.join(__dirname, '..', '..', '..', '..', 'data', 'telemetry');
    if (!fs.existsSync(telemetryDir)) {
        try { fs.mkdirSync(telemetryDir, { recursive: true }); } catch (e) {}
    }

    const browserLogs = [];
    page.on('console', msg => {
        const text = msg.text();
        const type = msg.type();
        if (type === 'error' || type === 'warn' || text.includes('TNPDS') || text.includes('Error') || text.includes('perfdrive') || text.includes('captcha')) {
            browserLogs.push({ time: new Date().toISOString(), type, text });
            if (browserLogs.length > 50) browserLogs.shift();
            if (type === 'error') onProgress(`⚠️ [Chrome Console பிழை] ${text}`);
        }
    });

    page.on('dialog', async (dialog) => {
        console.log(`🔔 [TNPDS Portal Dialog] Type: ${dialog.type()} | Message: "${dialog.message()}"`);
        onProgress(`🔔 [அரசு அறிவிப்பு] ${dialog.message()}`);
        await dialog.accept().catch(() => {});
    });

    const workspaceTelemetryDir = 'd:\\downloads\\ai assitant 2\\data\\telemetry';
    const sessionStorePath = 'd:\\downloads\\ai assitant 2\\data\\tnpds_session_storage.json';
    if (!fs.existsSync(workspaceTelemetryDir)) {
        try { fs.mkdirSync(workspaceTelemetryDir, { recursive: true }); } catch (e) {}
    }

    let lastStepNum = 1;
    let lastStepName = 'LIVE_WATCH';
    const captureTelemetry = async (stepNum, stepName, status = 'INFO', extra = {}) => {
        if (!page || page.isClosed()) return;
        if (stepNum) lastStepNum = stepNum;
        if (stepName) lastStepName = stepName;
        try {
            const curUrl = page.url();
            if (curUrl.includes('tnpds.gov.in/pages/service-request') || curUrl.includes('tnpds.gov.in/pages/my-profile')) {
                const storageDump = await page.evaluate(() => {
                    const ss = {};
                    const ls = {};
                    try { for (let i = 0; i < sessionStorage.length; i++) { const k = sessionStorage.key(i); ss[k] = sessionStorage.getItem(k); } } catch (_) {}
                    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); ls[k] = localStorage.getItem(k); } } catch (_) {}
                    return { ss, ls, ts: Date.now() };
                }).catch(() => null);
                if (storageDump && (Object.keys(storageDump.ss).length > 0 || Object.keys(storageDump.ls).length > 0)) {
                    try { fs.writeFileSync(sessionStorePath, JSON.stringify(storageDump), 'utf8'); } catch (_) {}
                }
            }
            const latestShot = path.join(telemetryDir, 'latest_screenshot.png');
            const failureShot = path.join(telemetryDir, 'latest_failure.png');
            const diagFile = path.join(telemetryDir, 'latest_diagnostic.json');
            await page.screenshot({ path: latestShot, fullPage: false }).catch(() => {});
            try {
                if (path.resolve(telemetryDir) !== path.resolve(workspaceTelemetryDir)) {
                    fs.copyFileSync(latestShot, path.join(workspaceTelemetryDir, 'latest_screenshot.png'));
                }
            } catch (_) {}
            if (status === 'FATAL_ERROR' || status === 'ERROR') {
                try { fs.copyFileSync(latestShot, failureShot); } catch (e) {}
            }
            const diag = {
                timestamp: new Date().toISOString(),
                step: stepNum || lastStepNum,
                stepName: stepName || lastStepName,
                status,
                url: curUrl,
                ...extra,
                recentBrowserLogs: browserLogs.slice(-10)
            };
            const diagJson = JSON.stringify(diag, null, 2);
            fs.writeFileSync(diagFile, diagJson, 'utf8');
            try {
                if (path.resolve(telemetryDir) !== path.resolve(workspaceTelemetryDir)) {
                    fs.writeFileSync(path.join(workspaceTelemetryDir, 'latest_diagnostic.json'), diagJson, 'utf8');
                }
            } catch (_) {}
        } catch (e) {}
    };

    const liveSnapInterval = setInterval(async () => {
        if (!page || page.isClosed()) {
            clearInterval(liveSnapInterval);
            return;
        }
        await captureTelemetry(lastStepNum, lastStepName, 'LIVE_HEARTBEAT').catch(() => {});
    }, 3000);
    page.once('close', () => clearInterval(liveSnapInterval));

    try {
        await context.grantPermissions(['geolocation'], { origin: 'https://www.tnpds.gov.in' });
        await context.grantPermissions(['geolocation'], { origin: 'https://tnpds.gov.in' });
    } catch (e) {}

    let savedStorageDump = null;
    try {
        if (fs.existsSync(sessionStorePath)) {
            const parsed = JSON.parse(fs.readFileSync(sessionStorePath, 'utf8'));
            if (parsed && parsed.ts && (Date.now() - parsed.ts < 30 * 60 * 1000)) {
                savedStorageDump = parsed;
            }
        }
    } catch (_) {}

    await injectRadwareStealthShield(context);
    await context.addInitScript((storageData) => {
        try {
            if (storageData && window.location && window.location.hostname.includes('tnpds.gov.in')) {
                if (storageData.ss) {
                    Object.keys(storageData.ss).forEach(k => {
                        if (!sessionStorage.getItem(k)) sessionStorage.setItem(k, storageData.ss[k]);
                    });
                }
                if (storageData.ls) {
                    Object.keys(storageData.ls).forEach(k => {
                        if (!localStorage.getItem(k)) localStorage.setItem(k, storageData.ls[k]);
                    });
                }
            }
        } catch (_) {}
        try {
            Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => undefined });
            delete Object.getPrototypeOf(navigator).webdriver;
        } catch (e) {}
        try { Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en', 'ta'] }); } catch (e) {}
        try { Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 }); } catch (e) {}
        try { Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 }); } catch (e) {}

        const createW3CPosition = () => ({
            coords: { latitude: 12.9716, longitude: 79.1586, altitude: null, accuracy: 15, altitudeAccuracy: null, heading: null, speed: null },
            timestamp: Date.now()
        });

        if (navigator.geolocation && typeof navigator.geolocation.getCurrentPosition === 'function') {
            const origGet = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
            navigator.geolocation.getCurrentPosition = function(success, error, opts) {
                try {
                    origGet(
                        (p) => { if (typeof success === 'function') success(p || createW3CPosition()); },
                        (err) => { if (typeof success === 'function') success(createW3CPosition()); else if (typeof error === 'function') error(err); },
                        opts
                    );
                } catch (e) {
                    if (typeof success === 'function') success(createW3CPosition());
                }
            };
        }
    }, savedStorageDump);

    const isMock = options.isMockSandbox !== false;
    if (isMock || options.bypassOtp) {
        await page.route('**/*', async (route) => {
            const req = route.request();
            const url = req.url().toLowerCase();
            const postData = req.postData() ? req.postData().toLowerCase() : '';
            if (url.includes('captcha') || url.includes('hcaptcha') || url.includes('perfdrive') || url.includes('recaptcha') || url.includes('cloudflare')) {
                await route.continue();
                return;
            }
            const isGovtService = (url.includes('tnpds.gov.in') || url.includes('portalwebservice'));
            const isOtpOrMobileVerify = isGovtService && req.method() === 'POST' && (
                url.includes('/otp') || 
                url.includes('verifymobilenumber') || 
                url.includes('/validateotp') || 
                (url.includes('otp') && !url.includes('captcha')) ||
                (postData.includes('otp') && !postData.includes('captcha') && !url.includes('captcha'))
            );
            if (isOtpOrMobileVerify) {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ 
                        statusCode: 0, 
                        message: 'OTP Verified Successfully', 
                        status: 'SUCCESS', 
                        trackId: 'MOCK_TRACK_' + Date.now(),
                        valid: true,
                        data: { isVerified: true }
                    })
                });
                return;
            }
            await route.continue();
        });
    }

    return {
        success: true,
        browser,
        context,
        page,
        captureTelemetry,
        cookiePath
    };
}

module.exports = {
    launchAddMemberBrowser
};
