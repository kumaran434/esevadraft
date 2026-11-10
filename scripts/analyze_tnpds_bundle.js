const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
    try {
        const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
        const page = browser.contexts()[0].pages().find(p => p.url().includes('tnpds'));
        if (!page) {
            console.log('No tnpds page');
            return;
        }
        console.log('Fetching main bundle from page context...');
        const bundle = await page.evaluate(async () => {
            const res = await fetch('https://www.tnpds.gov.in/main-MRSUJIBS.js');
            return await res.text();
        });
        console.log('Bundle fetched! Length:', bundle.length);
        fs.writeFileSync('scratch/tnpds_main.js', bundle, 'utf8');

        // Search for Unauthorized
        let idx = 0;
        let count = 0;
        while ((idx = bundle.indexOf('Unauthorized', idx)) !== -1) {
            count++;
            console.log(`\n--- Match ${count} at ${idx} ---`);
            console.log(bundle.substring(Math.max(0, idx - 150), Math.min(bundle.length, idx + 250)));
            idx += 12;
            if (count > 10) break;
        }

        await browser.close();
    } catch (e) {
        console.error(e.message);
    }
})();
