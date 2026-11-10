const { chromium } = require('playwright');

async function run() {
    console.log('Connecting to live app on 9222...');
    const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
    const context = browser.contexts()[0];
    const page = context.pages().find(p => p.url().includes('3000')) || context.pages()[0];

    console.log('Clicking "TNPDS போர்ட்டலில் விண்ணப்பி (Submit to Portal)"...');
    const btn = page.locator('button:has-text("TNPDS போர்ட்டலில் விண்ணப்பி"), button:has-text("Submit to Portal")').first();
    await btn.waitFor({ state: 'visible', timeout: 5000 });
    await btn.click();
    console.log('✅ Clicked "TNPDS போர்ட்டலில் விண்ணப்பி"!');
    await page.waitForTimeout(3000);
}

run().catch(console.error);
