const { chromium } = require('playwright');

async function inspectFeedback() {
    const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
    const pages = browser.contexts()[0].pages();
    const page = pages.find(p => p.url().includes('tnpds')) || pages[0];

    // Scroll up
    await page.evaluate(() => window.scrollTo(0, 200));

    const feedback = await page.evaluate(() => {
        const alerts = Array.from(document.querySelectorAll('.alert, .toast, .snack-bar, .mat-snack-bar-container, .error-message, .invalid-feedback, .text-danger, mat-error')).map(e => e.innerText.trim()).filter(Boolean);
        const invalidInputs = Array.from(document.querySelectorAll('.ng-invalid')).map(e => ({
            tag: e.tagName,
            id: e.id,
            name: e.name,
            classes: e.className
        }));
        return { alerts, invalidInputs };
    });

    console.log('Feedback on page:', JSON.stringify(feedback, null, 2));
    await browser.close();
}

inspectFeedback().catch(console.error);
