const { chromium } = require('playwright');

async function run() {
    const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
    const context = browser.contexts()[0];
    const page = context.pages().find(p => p.url().includes('3000')) || context.pages()[0];

    // Scroll the edit modal down
    await page.evaluate(() => {
        const modalBody = document.querySelector('#editModal .overflow-y-auto') || document.querySelector('#editModal > div > div') || document.querySelector('#editModal');
        if (modalBody) {
            modalBody.scrollTop = modalBody.scrollHeight;
        }
    });

    await page.waitForTimeout(1000);
}

run().catch(console.error);
