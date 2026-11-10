const { chromium } = require('playwright');

async function run() {
    const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
    const context = browser.contexts()[0];
    const page = context.pages().find(p => p.url().includes('3000')) || context.pages()[0];

    console.log('Reloading page to fetch latest synced scripts...');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    console.log('Opening Edit Modal with latest code...');
    await page.evaluate(async () => {
        if (typeof window.openEditModal === 'function') {
            await window.openEditModal();
        }
    });

    await page.waitForTimeout(2000);
    await browser.close();
    console.log('Done.');
}

run().catch(console.error);
