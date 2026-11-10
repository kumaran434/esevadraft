const { chromium } = require('playwright');

(async () => {
    try {
        const b = await chromium.connectOverCDP('http://127.0.0.1:9222');
        const p = b.contexts()[0].pages().find(x => x.url().includes('newsmartcard'));
        if (!p) {
            console.log('No newsmartcard page');
            process.exit(1);
        }

        const loc = p.locator('button:has-text("சமர்ப்பிக்கவும்")');
        const count = await loc.count();
        console.log('Count:', count);
        for (let i = 0; i < count; i++) {
            const isVis = await loc.nth(i).isVisible();
            const txt = await loc.nth(i).innerText();
            console.log(i, 'Visible:', isVis, 'Text:', txt);
            if (isVis) {
                console.log('CLICKING VISIBLE சமர்ப்பிக்கவும் BUTTON!');
                await loc.nth(i).click({ force: true });
                console.log('CLICKED!');
            }
        }

        await p.waitForTimeout(3000);
        await b.close();
    } catch (e) {
        console.error('Error:', e);
    }
})();
