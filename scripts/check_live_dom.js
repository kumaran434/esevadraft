const { chromium } = require('playwright');

(async () => {
    try {
        const b = await chromium.connectOverCDP('http://127.0.0.1:9222');
        const p = b.contexts()[0].pages().find(x => x.url().includes('newsmartcard'));
        if (!p) {
            console.log('No newsmartcard page found');
            await b.close();
            return;
        }

        const info = await p.evaluate(() => {
            const modal = document.querySelector('.modal.show, div.modal.d-block');
            const toasts = Array.from(document.querySelectorAll('.p-toast-message, .toast, .alert')).map(t => (t.innerText || '').trim());
            
            const memberTable = Array.from(document.querySelectorAll('table')).find(t => {
                const txt = (t.innerText || '').toLowerCase();
                return (txt.includes('உறுப்பினர்') || txt.includes('member')) && !txt.includes('எண்ணெய்');
            });
            const tableRows = memberTable ? Array.from(memberTable.querySelectorAll('tbody tr')).map(r => r.innerText.trim()) : [];

            const applicantName = document.querySelector('input[formcontrolname="NameOfFamilyHead"]')?.value || '';
            const mob = document.querySelector('input[formcontrolname="mobNumber"]')?.value || '';

            if (!modal) {
                return { modalOpen: false, applicantName, mob, tableRows, toasts };
            }
            const otpInp = modal.querySelector('input[formcontrolname="otp"]') || modal.querySelector('input[type="text"]:last-of-type');
            const btns = Array.from(modal.querySelectorAll('button')).map(b => ({
                text: b.innerText.trim(),
                disabled: b.disabled,
                class: b.className
            }));
            return {
                modalOpen: true,
                applicantName,
                mob,
                otpValue: otpInp ? otpInp.value : '',
                btns,
                text: modal.innerText,
                tableRows,
                toasts
            };
        });

        console.log('LIVE STATE:', JSON.stringify(info, null, 2));
        await b.close();
    } catch (e) {
        console.error('Error:', e);
    }
})();


