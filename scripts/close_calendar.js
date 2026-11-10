const { chromium } = require('playwright');

async function closeCalendar() {
    const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
    const page = browser.contexts()[0].pages()[0];

    // Click on the backdrop or press Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    const isStillOpen = await page.evaluate(() => {
        const bd = document.querySelector('.cdk-overlay-backdrop');
        if (bd) bd.click();
        const cal = document.querySelector('mat-calendar');
        if (cal) {
            // Also blur the date input
            const inp = document.querySelector('input.mat-datepicker-input');
            if (inp) inp.blur();
        }
        return Boolean(document.querySelector('mat-calendar'));
    });

    console.log('Calendar still open?', isStillOpen);
    await browser.close();
}

closeCalendar().catch(console.error);
