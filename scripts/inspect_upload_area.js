const { chromium } = require('playwright');

async function inspectUploadArea() {
    const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
    const page = browser.contexts()[0].pages()[0];

    const html = await page.evaluate(() => {
        const fi = document.querySelectorAll('input[type="file"]')[1];
        return fi ? fi.closest('.d-flex')?.outerHTML || fi.parentElement?.parentElement?.outerHTML : 'Not found';
    });

    console.log('Upload Area HTML:', html);
    await browser.close();
}

inspectUploadArea().catch(console.error);
