/**
 * TNPDS New Smart Card - Browser Launcher & Anti-Bot Stealth Configuration
 */
const fs = require('fs');
const path = require('path');
const { injectRadwareStealthShield } = require('../../../common/universal_radware_resumption');
const { getOperatorProfilePath } = require('../../../common/operator_browser_manager');

async function launchNewCardBrowser(options = {}, sharedContext = {}, onProgress = () => {}) {
    const {
        chromium,
        setBrowser = () => {},
        setContext = () => {},
        setPage = () => {},
        cookiePath = path.join(__dirname, '..', '..', '..', '..', 'data', 'tnpds_cookies.json')
    } = sharedContext;

    const isProduction = options.headless !== undefined 
        ? Boolean(options.headless)
        : (process.platform === 'linux' && !process.env.DISPLAY ? true : (process.env.HEADLESS === 'true'));

    const launchArgs = [
        '--start-maximized',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--remote-debugging-port=9222'
    ];

    let activeChromium = options.chromium || chromium;
    if (!activeChromium) {
        try {
            activeChromium = require('playwright').chromium;
        } catch (_) {}
    }
    if (!activeChromium) {
        try {
            const wsPath = path.join('d:', 'downloads', 'ai assitant 2', 'node_modules', 'playwright');
            if (fs.existsSync(wsPath)) activeChromium = require(wsPath).chromium;
        } catch (_) {}
    }
    if (!activeChromium) {
        throw new Error('Playwright Chromium module not found.');
    }


    let browser = null;
    let context = null;
    let page = null;
    let isAttachedToExisting = false;

    const isTest = process.env.NODE_ENV === 'test' || process.env.REGRESSION_TEST === 'true' || options.fastTest || options.isMockSandbox;
    if (!isProduction && !isTest) {
        try {
            const cdpBrowser = await activeChromium.connectOverCDP('http://127.0.0.1:9222', { timeout: 1500 });
            if (cdpBrowser && cdpBrowser.isConnected()) {
                onProgress('⚡ [நேரடி குரோம் இணைப்பு] உங்கள் கணினியில் ஏற்கனவே இயங்கும் Google Chrome சாளரத்துடன் இணைக்கப்படுகிறது...');
                browser = cdpBrowser;
                const existingContexts = browser.contexts();
                context = existingContexts.length > 0 ? existingContexts[0] : await browser.newContext();
                const existingPages = context.pages();
                const tnpdsPage = existingPages.find(p => {
                    const u = (p.url() || '').toLowerCase();
                    return u.includes('newsmartcard') || u.includes('tnpds.gov.in');
                });
                if (tnpdsPage) {
                    page = tnpdsPage;
                } else {
                    page = await context.newPage();
                }
                await context.grantPermissions(['geolocation'], { origin: 'https://www.tnpds.gov.in' }).catch(() => {});
                await context.setGeolocation({ latitude: 12.9716, longitude: 79.1585 }).catch(() => {});
                await page.addInitScript(() => {
                    if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition = function(success) {
                            success({
                                coords: { latitude: 12.9716, longitude: 79.1585, accuracy: 20 },
                                timestamp: Date.now()
                            });
                        };
                    }
                }).catch(() => {});
                await page.evaluate(() => {
                    if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition = function(success) {
                            success({
                                coords: { latitude: 12.9716, longitude: 79.1585, accuracy: 20 },
                                timestamp: Date.now()
                            });
                        };
                    }
                }).catch(() => {});
                await page.bringToFront().catch(() => {});
                isAttachedToExisting = true;
                setBrowser(browser);
                setContext(context);
                setPage(page);
            }
        } catch (_) {}
    }

    if (!isAttachedToExisting) {
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
            onProgress(`⚠️ [Google Chrome பிழை] குரோம் திறக்க இயலவில்லை — Microsoft Edge மூலம் முயற்சிக்கப்படுகிறது...`);
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
                    browser = await activeChromium.launch({
                        headless: isProduction,
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
    }

    try {
        await context.grantPermissions(['geolocation'], { origin: 'https://www.tnpds.gov.in' });
        await context.grantPermissions(['geolocation'], { origin: 'https://tnpds.gov.in' });
    } catch (_) {}

    await injectRadwareStealthShield(context);
    await context.addInitScript(() => {
        try {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            delete Object.getPrototypeOf(navigator).webdriver;
        } catch (_) {}
        try { Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en', 'ta'] }); } catch (_) {}
        try {
            Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
            Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
        } catch (_) {}
        if (navigator.permissions && navigator.permissions.query) {
            const origQuery = navigator.permissions.query.bind(navigator.permissions);
            navigator.permissions.query = (params) => {
                if (params && params.name === 'geolocation') return Promise.resolve({ state: 'granted', onchange: null });
                return origQuery(params);
            };
        }
    });

    if (!page || page.isClosed()) {
        page = await context.newPage();
    }
    setBrowser(browser);
    setContext(context);
    setPage(page);
    await page.bringToFront().catch(() => {});

    if (options.isMockSandbox !== false || options.bypassOtp) {
        await page.route('**/*', async (route) => {
            const req = route.request();
            const url = req.url().toLowerCase();
            const postData = req.postData() ? req.postData().toLowerCase() : '';
            if (url.includes('captcha') || url.includes('hcaptcha') || url.includes('perfdrive') || url.includes('recaptcha')) {
                await route.continue();
                return;
            }
            const isGovtService = (url.includes('tnpds.gov.in') || url.includes('portalwebservice'));
            const isOtpOrMobileVerify = isGovtService && req.method() === 'POST' && (
                url.includes('/otp') || url.includes('verifymobilenumber') || url.includes('/validateotp') ||
                (postData.includes('otp') && !postData.includes('captcha') && !url.includes('captcha'))
            );
            if (isOtpOrMobileVerify) {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ statusCode: 0, message: 'OTP Verified Successfully', status: 'SUCCESS', valid: true, data: { isVerified: true } })
                });
                return;
            }
            await route.continue();
        });
    }

    return { browser, context, page };
}

module.exports = {
    launchNewCardBrowser
};
