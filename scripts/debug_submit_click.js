const { chromium } = require('playwright');

(async () => {
    try {
        const b = await chromium.connectOverCDP('http://127.0.0.1:9222');
        const p = b.contexts()[0].pages().find(x => x.url().includes('newsmartcard'));
        const requests = [];
        const responses = [];
        p.on('request', r => requests.push(r.method() + ' ' + r.url()));
        p.on('response', async r => {
            let txt = '';
            try { txt = await r.text(); } catch (_) {}
            responses.push({ url: r.url(), status: r.status(), body: txt.substring(0, 200) });
        });

        const btn = p.locator('button:has-text("சமர்ப்பிக்கவும்")').first();
        console.log('Visible:', await btn.isVisible());
        if (await btn.isVisible()) {
            await btn.click({ force: true });
            console.log('Clicked!');
        } else {
            console.log('Button not visible');
        }

        await p.waitForTimeout(3000);
        console.log('Requests:', requests);
        console.log('Responses:', JSON.stringify(responses, null, 2));
        await b.close();
    } catch (e) {
        console.error(e);
    }
})();

