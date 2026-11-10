const { chromium } = require('playwright');

async function check() {
    const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
    const pages = browser.contexts()[0].pages();
    const p = pages.find(pg => pg.url().includes('tnpds')) || pages[0];
    const info = await p.evaluate(() => {
        const modal = document.querySelector('.modal.show, .modal-dialog, div[role="dialog"]');
        const mvis = modal && modal.offsetParent !== null;
        const addMemBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('உறுப்பினரை சேர்க்க'));
        const otpInp = document.querySelector('input[formcontrolname="mobileOtp"], input[placeholder*="OTP"]');
        return {
            title: document.title,
            url: window.location.href,
            modalVisible: mvis,
            modalText: modal ? (modal.innerText || '').replace(/\s+/g, ' ').slice(0, 200) : null,
            addMemBtn: addMemBtn ? { text: addMemBtn.innerText, disabled: addMemBtn.disabled, vis: addMemBtn.offsetParent !== null } : null,
            otpInput: otpInp ? { val: otpInp.value, vis: otpInp.offsetParent !== null } : null,
            toasts: Array.from(document.querySelectorAll('.toast, .alert, .snack-bar, .ui-toast')).map(t => (t.innerText || '').trim()).filter(Boolean)
        };
    });
    console.log(JSON.stringify(info, null, 2));
    await browser.close();
}

check().catch(console.error);
