const { chromium } = require('playwright');

async function run() {
    const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
    const context = browser.contexts()[0];
    const page = context.pages().find(p => p.url().includes('3000')) || context.pages()[0];

    // Scroll modal to bottom
    await page.evaluate(() => {
        const modalContainer = document.querySelector('#editModal > div');
        if (modalContainer) {
            modalContainer.scrollTop = modalContainer.scrollHeight;
        }
    });

    await page.waitForTimeout(500);
    await browser.close();
}

run().catch(console.error);
