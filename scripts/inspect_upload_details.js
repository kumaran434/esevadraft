const { chromium } = require('playwright-core');

async function inspectDoc() {
    const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
    const page = browser.contexts()[0].pages()[0];
    const info = await page.evaluate(() => {
        const selectEl = document.querySelector('select[formcontrolname="documentType"], select[formcontrolname="proofType"], select');
        const allSelects = Array.from(document.querySelectorAll('select')).map(s => ({
            name: s.name,
            formcontrolname: s.getAttribute('formcontrolname'),
            selectedIndex: s.selectedIndex,
            selectedText: s.options[s.selectedIndex] ? s.options[s.selectedIndex].text : '',
            options: Array.from(s.options).map(o => o.text)
        }));
        const fileUploadAreas = Array.from(document.querySelectorAll('input[type="file"], .file-upload, [class*="upload"]')).map(el => ({
            tag: el.tagName,
            type: el.type,
            text: el.innerText || '',
            files: el.files ? Array.from(el.files).map(f => ({ name: f.name, size: f.size })) : []
        }));
        return { allSelects, fileUploadAreas };
    });
    console.log(JSON.stringify(info, null, 2));
    process.exit(0);
}

inspectDoc().catch(err => {
    console.error(err);
    process.exit(1);
});
