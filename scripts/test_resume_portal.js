const { chromium } = require('playwright-core');

(async () => {
    try {
        const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
        const ctx = browser.contexts()[0];
        
        // Close Logout tab
        const logoutPage = ctx.pages().find(p => p.url().includes('Logout.html'));
        if (logoutPage) {
            console.log('Closing Logout.html tab...');
            await logoutPage.close().catch(() => {});
        }

        const tnegaPage = ctx.pages().find(p => p.url().includes('tnesevai.tn.gov.in'));
        if (!tnegaPage) { console.log('TNeGA page not found'); return; }
        await tnegaPage.bringToFront();
        console.log('Brought to front:', tnegaPage.url());

        // Click Revenue Department
        console.log('Clicking Revenue Department...');
        await tnegaPage.click('a:has-text("Revenue Department"), td:has-text("Revenue Department")').catch(() => {});
        await tnegaPage.waitForTimeout(1200);

        // Click REV-102 Nativity certificate
        console.log('Clicking REV-102 Nativity certificate...');
        const newPagePromise = ctx.waitForEvent('page', { timeout: 8000 }).catch(() => null);
        await tnegaPage.click('a:has-text("REV-102"), a:has-text("Nativity"), td:has-text("REV-102") a').catch(() => {});
        
        const newPage = await newPagePromise;
        if (newPage) {
            await newPage.waitForLoadState('domcontentloaded');
            console.log('New page opened:', newPage.url());
        }
    } catch (e) {
        console.log('Error:', e.message);
    }
})();
