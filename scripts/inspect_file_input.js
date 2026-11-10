const { chromium } = require('playwright');

async function inspectFileInput() {
    const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
    const page = browser.contexts()[0].pages()[0];

    const fileInputs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('input[type="file"]')).map(el => ({
            id: el.id,
            name: el.name,
            formControlName: el.getAttribute('formcontrolname'),
            className: el.className,
            accept: el.accept,
            disabled: el.disabled,
            outerHTML: el.outerHTML
        }));
    });

    console.log('File inputs:', JSON.stringify(fileInputs, null, 2));
    await browser.close();
}

inspectFileInput().catch(console.error);
