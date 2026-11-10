const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

(async () => {
    try {
        const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
        const ctx = browser.contexts()[0];
        const page = ctx.pages().find(p => p.url().includes('uploadDoc') || p.url().includes('edistrict'));
        if (!page) { console.log('Page not found'); return; }

        console.log('Testing Self-Declaration download on:', page.url());

        // Wait for download event or new tab
        const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 10000 }).catch(() => null),
            page.click('a#ss\\:decForm1, a:has-text("Download Self declaration form")').catch(e => console.log('Click err:', e.message))
        ]);

        if (download) {
            const dlPath = path.join(process.cwd(), 'data', 'downloads', 'self_declaration_TN-320261108167.pdf');
            await download.saveAs(dlPath);
            console.log('Successfully downloaded self-declaration to:', dlPath);
            console.log('Size:', (fs.statSync(dlPath).size / 1024).toFixed(2), 'KB');
        } else {
            console.log('No direct download event caught, checking new tab or popup...');
            const pages = ctx.pages();
            console.log('All pages:', pages.map(p => p.url()));
        }
    } catch (e) {
        console.log('Error:', e.message);
    }
})();
