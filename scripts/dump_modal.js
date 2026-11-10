const { chromium } = require('playwright');
const fs = require('fs');

async function run() {
    const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
    const context = browser.contexts()[0];
    const page = context.pages().find(p => p.url().includes('3000')) || context.pages()[0];

    const html = await page.evaluate(() => {
        const modal = document.querySelector('#editModal');
        return modal ? modal.innerHTML : 'No modal found';
    });

    fs.writeFileSync('scratch/edit_modal_dom.html', html, 'utf8');

    // Also find the scrollable container inside editModal
    await page.evaluate(() => {
        const scrollable = document.querySelector('#editModal .max-h-\\[90vh\\]') || 
                           document.querySelector('#editModal .overflow-y-auto') ||
                           document.querySelector('#editModalForm')?.parentElement ||
                           document.querySelector('#editModal > div > div');
        if (scrollable) {
            scrollable.scrollTop = 9999;
        }
    });

    await page.waitForTimeout(500);
}

run().catch(console.error);
