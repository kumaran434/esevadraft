// =========================================================================
// TNPDS Address Change — Browser Setup & CDP Connection
// =========================================================================
const fs = require('fs');
const path = require('path');
const { injectRadwareStealthShield } = require('../../../common/universal_radware_resumption');
const { getOperatorProfilePath } = require('../../../common/operator_browser_manager');

const cookiePath = path.join(__dirname, '..', '..', '..', '..', 'data', 'tnpds_cookies.json');

async function setupAddressChangeBrowser({ options, chromium, onProgress, isProduction, sharedContext }) {
    const {
        setBrowser = () => {},
        setPage = () => {},
        setContext = () => {},
        forceWindowToFront = () => {}
    } = sharedContext;

    let browser = null;
    let context = null;
    let page = null;
    let isAttached = false;

    const activeChromium = options.chromium || chromium || require('playwright-core').chromium;
    if (!activeChromium) {
        throw new Error('Playwright Chromium module not found.');
    }

    // Step 1: Check if operator already has Google Chrome running with remote debugging port 9222
    if (!isProduction) {
        try {
            console.log('🔍 [Chrome Tab Attach] Checking if operator already has Google Chrome running on port 9222...');
            const cdpBrowser = await activeChromium.connectOverCDP('http://127.0.0.1:9222', { timeout: 1500 });
            if (cdpBrowser && cdpBrowser.isConnected()) {
                console.log('⚡ [Chrome Tab Attach] CONNECTED to operator\'s EXISTING Chrome! Attaching to existing tab...');
                onProgress('⚡ [நேரடி குரோம் இணைப்பு] உங்கள் கணினியில் ஏற்கனவே இயங்கும் Google Chrome சாளரத்துடன் இணைக்கப்படுகிறது...');
                browser = cdpBrowser;
                const existingContexts = browser.contexts();
                context = existingContexts.length > 0 ? existingContexts[0] : await browser.newContext();
                const existingPages = context.pages().filter(p => !p.isClosed());
                page = existingPages.find(p => p.url().includes('cardmaintenance')) ||
                       existingPages.find(p => p.url().includes('tnpds.gov.in')) ||
                       existingPages[0];

                if (!page) {
                    page = await context.newPage();
                } else {
                    for (const p of existingPages) {
                        if (p !== page && !p.isClosed()) {
                            const u = p.url().toLowerCase();
                            if (u.includes('messages.google.com') || u.includes('google.com/messages')) {
                                continue;
                            }
                            if (u === 'about:blank' || (u.includes('tnpds.gov.in') && !u.includes('cardmaintenance'))) {
                                try { await p.close(); } catch (_) {}
                            }
                        }
                    }
                }
                await page.bringToFront().catch(() => {});
                isAttached = true;
                setBrowser(browser);
                setContext(context);
                setPage(page);
            }
        } catch (_) {
            console.log('ℹ️ [Chrome Tab Attach] Existing Chrome on port 9222 not found. Launching with port 9222 enabled...');
        }
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
        console.log(`🖥️ [TNPDS Change Address] Launching persistent operator Google Chrome (headless: ${isProduction}, profile: ${persistentProfileDir})...`);
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
        } catch (launchErr) {
            console.warn('Real Chrome persistent launch fallback:', launchErr.message);
            try {
                context = await activeChromium.launchPersistentContext(persistentProfileDir, {
                    ...persistentOptions,
                    channel: 'msedge'
                });
                browser = context.browser ? context.browser() : null;
            } catch (edgeErr) {
                try {
                    context = await activeChromium.launchPersistentContext(persistentProfileDir, {
                        ...persistentOptions,
                        channel: undefined
                    });
                    browser = context.browser ? context.browser() : null;
                } catch (persErr) {
                    // Fallback to standard launch if profile folder is locked by external process
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
        setBrowser(browser);
        setContext(context);
        setPage(page);
    }

    const telemetryDir = path.join(__dirname, '..', '..', '..', '..', 'data', 'telemetry');
    if (!fs.existsSync(telemetryDir)) {
        try { fs.mkdirSync(telemetryDir, { recursive: true }); } catch (_) {}
    }

    page.on('close', () => {
        setPage(null);
        onProgress('🛑 [சாளரம் மூடப்பட்டது] Google Chrome பக்கம் மூடப்பட்டது.');
    });

    if (browser) {
        browser.on('disconnected', () => {
            setBrowser(null);
            setContext(null);
            setPage(null);
            onProgress('🛑 [உலாவி துண்டிக்கப்பட்டது] Google Chrome உலாவி முழுமையாக மூடப்பட்டது.');
        });
    }

    await injectRadwareStealthShield(context || page);
    await page.addInitScript(() => {
        try { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); } catch (_) {}
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
                } catch (_) { if (typeof success === 'function') success(createW3CPosition()); }
            };
        }
    });

    await page.bringToFront().catch(() => {});
    forceWindowToFront();

    if (options.isMockSandbox !== false || options.bypassOtp) {
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
                console.log('  🎯 [Network Intercept] அரசு OTP / கைபேசி சரிபார்ப்பு அழைப்பு இடைமறிக்கப்பட்டது:', req.url());
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

    return { browser, context, page, isAttached, telemetryDir };
}

module.exports = { setupAddressChangeBrowser };
