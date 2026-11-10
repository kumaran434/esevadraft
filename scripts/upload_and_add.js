const { chromium } = require('playwright');
const path = require('path');

async function uploadAndAdd() {
    console.log('Connecting to TNPDS...');
    const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
    const page = browser.contexts()[0].pages()[0];

    // 1. Close calendar popup by pressing Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // 2. Attach file to input[type="file"]:not([disabled])
    const docPath = path.resolve('data/uploads/9842367866/aadhaar.jpg');
    console.log('Uploading Aadhaar image to active input:', docPath);
    const activeFileInput = page.locator('input[type="file"]:not([disabled])').first();
    await activeFileInput.setInputFiles(docPath);
    await activeFileInput.dispatchEvent('change');
    await page.waitForTimeout(1000);

    // 3. Click "உறுப்பினரை சேர்க்க" button
    console.log('Clicking "உறுப்பினரை சேர்க்க"...');
    const addBtn = page.locator('button.btn-warning:has-text("உறுப்பினரை சேர்க்க"), button:has-text("உறுப்பினரை சேர்க்க")').first();
    await addBtn.click();
    console.log('✅ Clicked "உறுப்பினரை சேர்க்க"!');

    await page.waitForTimeout(3000);
    await browser.close();
}

uploadAndAdd().catch(console.error);
