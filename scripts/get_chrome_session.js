const { chromium } = require('playwright');
(async () => {
    try {
        const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
        const context = browser.contexts()[0];
        const page = context.pages().find(p => p.url().includes('tnpds'));
        if (!page) { console.log('No page'); process.exit(0); }

        const res = await page.evaluate(() => {
            const tr = window.__tnpdsComp?.translate;
            return {
                submitText: tr ? tr.instant('CARD_MUTATIONS_PAGE.OTP_MODAL.SUBMIT') : null,
                cancelText: tr ? tr.instant('CARD_MUTATIONS_PAGE.OTP_MODAL.CANCEL') : null,
                sessionToken: sessionStorage.getItem('token'),
                allSessionStorage: Object.keys(sessionStorage).map(k => ({ key: k, val: sessionStorage.getItem(k)?.substring(0, 50) })),
                url: window.location.href
            };
        });
        console.log(JSON.stringify(res, null, 2));
    } catch (e) {
        console.error('Error:', e.message);
    }
})();
