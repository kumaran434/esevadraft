const { chromium } = require('playwright');
const path = require('path');

async function testUpload() {
    const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
    const page = browser.contexts()[0].pages()[0];

    const docPath = path.resolve('data/uploads/9842367866/aadhaar.jpg');
    console.log('Testing upload of:', docPath);

    const fileInput = page.locator('input[type="file"]:not([disabled])').first();
    await fileInput.setInputFiles(docPath);
    await fileInput.dispatchEvent('change');
    await page.waitForTimeout(500);

    const result = await page.evaluate(() => {
        const fi = document.querySelectorAll('input[type="file"]')[1];
        return {
            value: fi?.value,
            files: fi?.files?.length ? fi.files[0].name : 'none'
        };
    });

    console.log('Upload result:', JSON.stringify(result, null, 2));
    await browser.close();
}

testUpload().catch(console.error);
