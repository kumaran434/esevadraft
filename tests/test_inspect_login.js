const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ channel: 'chrome', headless: false });
    const page = await browser.newPage();
    await page.goto('https://www.tnpds.gov.in', { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(2000);
    const link = page.locator('a:has-text("உறுப்பினரை சேர்க்க"), a.cust-login').first();
    if (await link.count() > 0) {
        await link.click();
        await page.waitForTimeout(4000);
    }
    console.log('Current URL:', page.url());
    const btns = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"], a.btn')).map(b => ({
            tag: b.tagName,
            type: b.type,
            id: b.id,
            text: (b.innerText || b.value || '').trim(),
            className: b.className
        }));
    });
    console.log('Buttons found:', JSON.stringify(btns, null, 2));

    const inputs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('input, select, textarea')).map(i => ({
            tag: i.tagName,
            type: i.type,
            id: i.id,
            name: i.name,
            placeholder: i.placeholder,
            formControlName: i.getAttribute('formcontrolname')
        }));
    });
    console.log('Inputs found:', JSON.stringify(inputs, null, 2));
    await browser.close();
})().catch(e => console.error(e));
