const { chromium } = require('playwright');

async function run() {
    console.log('Connecting to app on 9222...');
    const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
    const context = browser.contexts()[0];
    const page = context.pages().find(p => p.url().includes('3000')) || context.pages()[0];

    // Scroll down to submit button
    await page.evaluate(() => {
        const modalContainer = document.querySelector('#editModal > div');
        if (modalContainer) {
            modalContainer.scrollTop = modalContainer.scrollHeight;
        }
    });
    await page.waitForTimeout(500);

    console.log('Clicking "🚀 அரசு போர்ட்டலில் சமர்ப்பி (Submit Application)" button...');
    const submitBtn = page.locator('#btnSubmitFromEditModal');
    await submitBtn.waitFor({ state: 'visible', timeout: 5000 });
    await submitBtn.click();
    console.log('✅ Clicked Submit Application button successfully!');

    await page.waitForTimeout(2000);
    await browser.close();
    console.log('CDP connection closed cleanly.');
}

run().catch(console.error);
