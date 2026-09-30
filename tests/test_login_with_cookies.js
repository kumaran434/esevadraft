const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const cookiePath = path.join(__dirname, '..', 'data', 'tnpds_cookies.json');
    const browser = await chromium.launch({ channel: 'chrome', headless: false });
    const context = await browser.newContext({ storageState: cookiePath });
    const page = await context.newPage();
    await page.goto('https://www.tnpds.gov.in', { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(3000);
    console.log('Page 1 URL:', page.url());

    const link = page.locator('a:has-text("உறுப்பினரை சேர்க்க"), a.cust-login').first();
    if (await link.count() > 0) {
        await link.click();
        await page.waitForTimeout(4000);
    }
    console.log('Page 2 URL:', page.url());

    // Print all inputs and buttons on Page 2
    const elements = await page.evaluate(() => {
        return {
            title: document.title,
            url: window.location.href,
            inputs: Array.from(document.querySelectorAll('input, select, textarea')).map(i => ({
                id: i.id,
                name: i.name,
                type: i.type,
                placeholder: i.placeholder,
                formControlName: i.getAttribute('formcontrolname'),
                visible: i.offsetParent !== null
            })),
            buttons: Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]')).map(b => ({
                id: b.id,
                type: b.type,
                text: (b.innerText || b.value || '').trim(),
                className: b.className,
                visible: b.offsetParent !== null
            }))
        };
    });
    console.log('Elements on page:', JSON.stringify(elements, null, 2));

    await page.waitForTimeout(5000);
    await browser.close();
})().catch(e => console.error(e));
