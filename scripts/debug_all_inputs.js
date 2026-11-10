const { chromium } = require('playwright');
const path = require('path');

async function debugAllInputs() {
    const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
    const page = browser.contexts()[0].pages()[0];

    const count = await page.locator('input[type="file"]').count();
    console.log('Total file inputs count:', count);

    const docPath = path.resolve('data/uploads/9842367866/aadhaar.jpg');

    for (let i = 0; i < count; i++) {
        const inp = page.locator('input[type="file"]').nth(i);
        const isDisabled = await inp.isDisabled();
        console.log(`Input ${i}: disabled=${isDisabled}`);
        if (!isDisabled) {
            console.log(`Setting files on input ${i}...`);
            await inp.setInputFiles(docPath);
            await inp.dispatchEvent('change');
            await inp.dispatchEvent('input');
        }
    }

    await page.waitForTimeout(1000);

    const check = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('input[type="file"]')).map((el, i) => ({
            index: i,
            val: el.value,
            file: el.files && el.files[0] ? el.files[0].name : 'none'
        }));
    });

    console.log('Result after trying all inputs:', JSON.stringify(check, null, 2));
    await browser.close();
}

debugAllInputs().catch(console.error);
