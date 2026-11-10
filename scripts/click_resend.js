const { chromium } = require('playwright');

(async () => {
    try {
        const b = await chromium.connectOverCDP('http://127.0.0.1:9222');
        const p = b.contexts()[0].pages().find(x => x.url().includes('newsmartcard'));
        const resendBtn = p.locator('button:has-text("OTP மீண்டும் அனுப்பவும்")').first();
        console.log('Count:', await resendBtn.count());
        if (await resendBtn.count() > 0) {
            await resendBtn.click();
            console.log('Clicked Resend via Playwright locator!');
        }
        await p.waitForTimeout(3000);
        await b.close();
    } catch (e) {
        console.error(e);
    }
})();
