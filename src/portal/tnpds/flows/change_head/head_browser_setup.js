// =========================================================================
// TNPDS Change Family Head — Browser Setup & Window Verification
// =========================================================================
const path = require('path');

async function setupChangeHeadBrowser({ options, chromium, onProgress, isProduction, sharedContext }) {
    const {
        getExistingBrowserSession = () => null,
        setBrowser = () => {},
        setPage = () => {},
        setContext = () => {},
        showBrowserHud = async () => {},
        forceWindowToFront = () => {}
    } = sharedContext;

    let browser = null;
    let context = null;
    let page = null;

    let activeChromium = chromium || options?.chromium;
    if (!activeChromium) {
        try { activeChromium = require('playwright').chromium; } catch (_) {}
    }
    if (!activeChromium) {
        try { activeChromium = require('playwright-core').chromium; } catch (_) {}
    }

    const existingSession = getExistingBrowserSession();
    if (existingSession && existingSession.page && !existingSession.page.isClosed()) {
        browser = existingSession.browser;
        context = existingSession.context;
        page = existingSession.page;
        onProgress('🔄 [அமர்வு தொடர்ச்சி] ஏற்கனவே இயங்கும் Chrome உலாவி சாளரம் இணைக்கப்பட்டது.');
    } else {
        const isHeadless = options.headless === true;
        const chromeArgs = [
            '--disable-blink-features=AutomationControlled',
            '--start-maximized',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--window-position=0,0'
        ];

        // Try connecting to existing Chrome CDP on 9222
        try {
            browser = await activeChromium.connectOverCDP('http://127.0.0.1:9222');
            const contexts = browser.contexts();
            context = contexts[0] || (await browser.newContext());
            page = context.pages().find(p => !p.isClosed() && !p.url().includes('about:blank')) || (await context.newPage());
            onProgress('🌐 [Chrome நேரடி இணைப்பு] இயங்கிக் கொண்டிருக்கும் Google Chrome (Port 9222)-ல் ஆட்டோமேஷன் இணைக்கப்பட்டது.');
        } catch (_) {
            onProgress('🌐 [Chrome புதிய தொடக்கம்] அதிகாரப்பூர்வ Google Chrome உலாவி சாளரம் திறக்கப்படுகிறது...');
            browser = await activeChromium.launch({
                headless: isHeadless,
                args: chromeArgs,
                channel: 'chrome'
            });
            context = await browser.newContext({
                viewport: null,
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
            });
            page = await context.newPage();
        }
    }

    setBrowser(browser);
    setContext(context);
    setPage(page);

    await page.bringToFront().catch(() => {});
    forceWindowToFront();
    await showBrowserHud('🏛️ TNPDS குடும்பத் தலைவர் மாற்றம்', 'அரசு போர்ட்டல் தயாராகிறது...');

    return { browser, context, page };
}

module.exports = {
    setupChangeHeadBrowser
};
