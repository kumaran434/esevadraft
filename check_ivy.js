const { chromium } = require('playwright-core');

(async () => {
    try {
        const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
        const page = browser.contexts()[0].pages().find(p => p.url().includes('service-request'));

        const ngInspect = await page.evaluate(() => {
            const form = document.querySelectorAll('form')[1];
            const ctx = form.__ngContext__;
            const res = {
                type: typeof ctx,
                isArray: Array.isArray(ctx),
                length: Array.isArray(ctx) ? ctx.length : 0,
                elements: []
            };

            if (Array.isArray(ctx)) {
                for (let i = 0; i < ctx.length; i++) {
                    const item = ctx[i];
                    if (item && typeof item === 'object') {
                        const keys = Object.keys(item);
                        const ctor = item.constructor ? item.constructor.name : 'unknown';
                        if (ctor.includes('Form') || ctor.includes('Directive') || ctor.includes('Component') || keys.includes('controls') || keys.includes('value')) {
                            res.elements.push({ index: i, ctor, keys });
                        }
                    }
                }
            }

            return res;
        });

        console.log(JSON.stringify(ngInspect, null, 2));

    } catch (e) {
        console.error(e);
    }
})();
