const { chromium } = require('playwright');

async function inspectForm() {
    const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
    const page = browser.contexts()[0].pages()[0];

    const formData = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input, select, button')).map(el => {
            return {
                tag: el.tagName,
                id: el.id,
                name: el.name,
                type: el.type,
                value: el.value,
                text: (el.innerText || '').trim(),
                className: el.className
            };
        });
        return inputs.filter(i => i.id || i.name || i.text);
    });

    console.log('Form elements count:', formData.length);
    console.log(JSON.stringify(formData.slice(0, 30), null, 2));
    await browser.close();
}

inspectForm().catch(console.error);
