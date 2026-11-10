const { chromium } = require('playwright');

(async () => {
    try {
        const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
        const pages = browser.contexts()[0].pages();
        for (const p of pages) {
            console.log('Page:', p.url());
            const scripts = await p.evaluate(() => {
                return Array.from(document.querySelectorAll('script[src]')).map(s => s.src);
            });
            console.log('Scripts:', scripts);
        }
        await browser.close();
    } catch (e) {
        console.error(e.message);
    }
})();
