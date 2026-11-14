/**
 * Step 1: Browser Launcher & Anti-Bot Environment Initializer
 * 
 * Responsibilities:
 * 1. Launches visible Google Chrome window with native anti-bot configuration.
 * 2. Restores persistent session cookies to bypass repeat login when valid.
 * 3. Applies humanized viewport and screen kinetics.
 */

const path = require('path');
const fs = require('fs');

async function launchPortalBrowser(playwrightChromium, options = {}) {
    if (!playwrightChromium) {
        throw new Error('Chromium instance is not initialized');
    }

    const isHeadless = options.headless === true;
    const channel = options.channel || 'chrome';

    const launchArgs = [
        '--disable-blink-features=AutomationControlled',
        '--start-maximized',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-infobars',
        '--window-position=0,0'
    ];

    console.log(`🚀 [Step 1: Browser Launch] Launching Google Chrome (channel: ${channel}, headless: ${isHeadless})...`);

    const browser = await playwrightChromium.launch({
        headless: isHeadless,
        channel: channel,
        args: launchArgs
    });

    const contextOptions = {
        viewport: null,
        locale: 'ta-IN',
        timezoneId: 'Asia/Kolkata',
        userAgent: undefined // Preserves authentic native Chrome UA
    };

    // Restore persistent session cookies if present
    const cookiePath = path.join(__dirname, '..', '..', '..', 'data', 'tnpds_cookies.json');
    if (fs.existsSync(cookiePath)) {
        try {
            contextOptions.storageState = cookiePath;
            console.log('🍪 [Step 1: Cookies] Restoring cached session cookies from disk...');
        } catch (e) {}
    }

    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();

    return { browser, context, page };
}

module.exports = {
    launchPortalBrowser
};
