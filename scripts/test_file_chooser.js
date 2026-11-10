const { chromium } = require('playwright');
const path = require('path');

async function testFileChooser() {
    const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
    const page = browser.contexts()[0].pages()[0];

    const docPath = path.resolve('data/uploads/9842367866/aadhaar.jpg');
    console.log('Testing file chooser with path:', docPath);

    try {
        const [fileChooser] = await Promise.all([
            page.waitForEvent('filechooser', { timeout: 3000 }),
            page.locator('input[type="file"]:not([disabled])').click({ force: true })
        ]);
        await fileChooser.setFiles(docPath);
        console.log('✅ File set via fileChooser successfully!');
    } catch (e) {
        console.log('FileChooser event failed:', e.message);
    }

    const check = await page.evaluate(() => {
        const fi = document.querySelectorAll('input[type="file"]')[1];
        return {
            val: fi?.value,
            file: fi?.files?.[0]?.name
        };
    });

    console.log('Check result:', JSON.stringify(check, null, 2));
    await browser.close();
}

testFileChooser().catch(console.error);
