const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    const page = await browser.newPage();
    await page.goto('https://www.tnpds.gov.in/auth/login', { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(3000);
    console.log('URL:', page.url());
    const formInfo = await page.evaluate(() => {
        const f = document.querySelector('form');
        if (!f) return 'No form found';
        return {
            action: f.action,
            method: f.method,
            inputs: Array.from(f.querySelectorAll('input, textarea, select')).map(i => ({
                name: i.name,
                id: i.id,
                type: i.type,
                value: i.value ? (i.value.length > 30 ? i.value.substring(0, 30) + '...' : i.value) : ''
            }))
        };
    });
    console.log('Form Info:', JSON.stringify(formInfo, null, 2));
    await browser.close();
})().catch(e => console.error(e));
