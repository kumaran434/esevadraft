const { chromium } = require('playwright');

async function checkOverlays() {
    const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
    const page = browser.contexts()[0].pages()[0];

    const overlays = await page.evaluate(() => {
        const backdrops = Array.from(document.querySelectorAll('.cdk-overlay-backdrop, .cdk-overlay-container, mat-calendar'));
        return backdrops.map(b => ({
            tag: b.tagName,
            className: b.className,
            visible: b.offsetParent !== null,
            html: b.outerHTML.slice(0, 150)
        }));
    });

    console.log('Overlays found:', JSON.stringify(overlays, null, 2));

    // Dismiss overlay by removing it or clicking body
    await page.evaluate(() => {
        const backdrops = document.querySelectorAll('.cdk-overlay-backdrop');
        backdrops.forEach(b => b.click());
    });

    await page.waitForTimeout(500);
    await browser.close();
}

checkOverlays().catch(console.error);
