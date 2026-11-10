const { chromium } = require('playwright-core');

(async () => {
    try {
        const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
        const ctx = browser.contexts()[0];
        const page = ctx.pages().find(p => p.url().includes('uploadDoc') || p.url().includes('edistrict'));
        if (!page) { console.log('Page not found'); return; }

        const rfFu = await page.evaluate(() => {
            const container = document.querySelector('.rf-fu, div[id*="upload"], div[class*="upload"]');
            if (!container) return 'No container';
            
            const buttons = Array.from(container.querySelectorAll('*')).map(el => ({
                tag: el.tagName,
                class: el.className,
                id: el.id,
                text: el.innerText ? el.innerText.trim() : '',
                onclick: el.getAttribute('onclick')
            })).filter(x => x.text.length > 0 || x.class.includes('btn') || x.tag === 'INPUT');

            return {
                containerId: container.id,
                containerClass: container.className,
                containerHTML: container.outerHTML.substring(0, 1500),
                buttons
            };
        });
        console.log('RichFaces Upload details:', JSON.stringify(rfFu, null, 2));
    } catch (e) {
        console.log('Error:', e.message);
    }
})();
