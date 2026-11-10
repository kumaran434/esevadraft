const { chromium } = require('playwright');

async function run() {
    console.log('Connecting to TNPDS...');
    const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
    const pages = browser.contexts()[0].pages();
    const page = pages.find(p => p.url().includes('tnpds')) || pages[0];

    const result = await page.evaluate(() => {
        const modal = document.querySelector('.modal.show, .modal-dialog, div[role="dialog"]');
        if (!modal) return { success: false, reason: 'No modal found' };
        
        const inp = modal.querySelector('input:not([type="hidden"])');
        const otpVal = inp ? (inp.value || '').replace(/\D/g, '') : '';
        
        const btns = Array.from(modal.querySelectorAll('button'));
        const verifyBtn = btns.find(b => {
            const t = (b.innerText || '').trim();
            return t.includes('பதிவு செய்') || t.includes('Verify') || t.includes('சமர்ப்பிக்கவும்') || (b.className || '').includes('btn-success');
        });

        if (inp) {
            inp.dispatchEvent(new Event('input', { bubbles: true }));
            inp.dispatchEvent(new Event('change', { bubbles: true }));
            inp.dispatchEvent(new Event('blur', { bubbles: true }));
        }

        if (verifyBtn) {
            verifyBtn.disabled = false;
            verifyBtn.removeAttribute('disabled');
            verifyBtn.click();
            return { success: true, otpVal, btnText: verifyBtn.innerText };
        }
        return { success: false, reason: 'No verify button found', buttons: btns.map(b => b.innerText) };
    });

    console.log('Result:', JSON.stringify(result, null, 2));
    await page.waitForTimeout(2000);
    await browser.close();
}

run().catch(console.error);
