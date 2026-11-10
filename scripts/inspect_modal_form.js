const { chromium } = require('playwright');

(async () => {
    try {
        const b = await chromium.connectOverCDP('http://127.0.0.1:9222');
        const p = b.contexts()[0].pages().find(x => x.url().includes('newsmartcard'));
        const info = await p.evaluate(() => {
            const modal = document.querySelector('.modal.show, div.modal.d-block');
            const form = modal?.querySelector('form');
            const inp = modal?.querySelector('input[formcontrolname="otp"]');
            return {
                formValid: form?.className,
                inpValid: inp?.className,
                inpVal: inp?.value,
                errors: Array.from(modal?.querySelectorAll('.text-danger, .invalid-feedback, .error') || []).map(e => e.innerText)
            };
        });
        console.log(JSON.stringify(info, null, 2));
        await b.close();
    } catch (e) {
        console.error(e);
    }
})();
