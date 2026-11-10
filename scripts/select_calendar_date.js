const { chromium } = require('playwright');

async function selectCalendarDate() {
    const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
    const page = browser.contexts()[0].pages()[0];

    const activeCell = page.locator('button.mat-calendar-body-active, button.mat-calendar-body-selected').first();
    if (await activeCell.count() > 0) {
        await activeCell.click();
        console.log('✅ Clicked active date in calendar!');
    } else {
        // Fallback: click any cell containing 10
        await page.evaluate(() => {
            const btn = document.querySelector('button.mat-calendar-body-active') || 
                        Array.from(document.querySelectorAll('.mat-calendar-body-cell-content')).find(c => c.innerText.trim() === '10')?.parentElement;
            if (btn) btn.click();
        });
    }

    await page.waitForTimeout(500);
    await browser.close();
}

selectCalendarDate().catch(console.error);
