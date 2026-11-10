const { chromium } = require('playwright');
const path = require('path');

async function debugUpload() {
    const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
    const page = browser.contexts()[0].pages()[0];

    const inputInfo = await page.evaluate(() => {
        const fileInputs = Array.from(document.querySelectorAll('input[type="file"]'));
        return fileInputs.map((fi, idx) => ({
            index: idx,
            id: fi.id,
            disabled: fi.disabled,
            value: fi.value,
            filesCount: fi.files ? fi.files.length : 0,
            hasEventListener: typeof fi.onchange === 'function',
            parentHTML: fi.parentElement?.outerHTML
        }));
    });

    console.log('File inputs debug:', JSON.stringify(inputInfo, null, 2));
    await browser.close();
}

debugUpload().catch(console.error);
