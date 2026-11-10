const { chromium } = require('playwright');
(async () => {
    try {
        const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
        const pages = browser.contexts()[0].pages();
        const page = pages.find(p => p.url().includes('newsmartcard')) || pages[0];
        
        console.log('Connecting to page...');
        const result = await page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('button')).find(b => (b.innerText || '').includes('பதிவு செய்'));
            if (btn) {
                btn.click();
                return { success: true, text: btn.innerText };
            }
            return { success: false, reason: 'Button not found' };
        });
        console.log('Click result:', JSON.stringify(result));
    } catch (e) {
        console.error('Error:', e.message);
    }
})();
