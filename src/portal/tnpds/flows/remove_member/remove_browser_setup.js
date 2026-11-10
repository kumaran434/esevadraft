// =========================================================================
// TNPDS Remove Member — Browser Setup & CDP Connection
// =========================================================================
const fs = require('fs');
const path = require('path');
const { injectRadwareStealthShield } = require('../../../common/universal_radware_resumption');
const { getOperatorProfilePath } = require('../../../common/operator_browser_manager');

const cookiePath = path.join(__dirname, '..', '..', '..', '..', 'data', 'tnpds_cookies.json');

async function setupRemoveMemberBrowser({ options, chromium, onProgress, isProduction, sharedContext }) {
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

    const isHeadless = options.headless !== undefined 
        ? Boolean(options.headless)
        : (process.platform === 'linux' && !process.env.DISPLAY ? true : (process.env.HEADLESS === 'true'));

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
                page = existingPages.find(p => p.url().includes('service-request')) ||
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
                            if (u === 'about:blank' || (u.includes('tnpds.gov.in') && !u.includes('service-request'))) {
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
        console.log(`🖥️ [TNPDS Remove Member] Launching persistent operator Google Chrome (headless: ${isHeadless}, profile: ${persistentProfileDir})...`);
        onProgress(`🌐 [ஆபரேட்டர் குரோம்] உங்கள் நிரந்தர சுயவிவரத்துடன் Google Chrome திறக்கப்படுகிறது...`);

        const persistentOptions = {
            channel: 'chrome',
            headless: isHeadless,
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
                delete persistentOptions.channel;
                context = await activeChromium.launchPersistentContext(persistentProfileDir, persistentOptions);
                browser = context.browser ? context.browser() : null;
            } catch (err2) {
                console.warn('Non-persistent launch fallback:', err2.message);
                browser = await activeChromium.launch({
                    channel: 'chrome',
                    headless: isHeadless,
                    args: launchArgs
                });
                context = await browser.newContext({
                    viewport: null,
                    permissions: ['geolocation'],
                    geolocation: { latitude: 12.9716, longitude: 79.1586 }
                });
            }
        }

        const pages = context.pages().filter(p => !p.isClosed());
        page = pages.length > 0 ? pages[0] : await context.newPage();
        setBrowser(browser);
        setContext(context);
        setPage(page);
    }

    // Set standard window timeouts and Radware stealth scripts
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(35000);

    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        window.chrome = { runtime: {} };
    }).catch(() => {});

    await injectRadwareStealthShield(page).catch(() => {});

    // Try loading saved TNPDS cookies
    if (fs.existsSync(cookiePath)) {
        try {
            const raw = fs.readFileSync(cookiePath, 'utf8');
            const parsed = JSON.parse(raw);
            if (parsed && Array.isArray(parsed.cookies)) {
                await context.addCookies(parsed.cookies).catch(() => {});
            }
        } catch (_) {}
    }

    forceWindowToFront();
    return { browser, context, page, isAttached };
}

module.exports = {
    setupRemoveMemberBrowser
};
