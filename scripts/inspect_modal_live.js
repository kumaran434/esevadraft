const { chromium } = require('playwright');
(async () => {
    try {
        const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
        const context = browser.contexts()[0];
        const page = context.pages().find(p => p.url().includes('tnpds'));
        if (!page) { console.log('No tnpds page found'); process.exit(0); }
        
        const info = await page.evaluate(() => {
            const modals = Array.from(document.querySelectorAll('.modal, div[role="dialog"], .modal-dialog, div.fade'));
            const buttons = Array.from(document.querySelectorAll('button')).map((b, i) => ({
                index: i,
                text: (b.innerText || '').trim(),
                className: b.className,
                disabled: b.disabled,
                visible: b.offsetParent !== null,
                parentTag: b.parentElement ? b.parentElement.tagName : '',
                parentClass: b.parentElement ? b.parentElement.className : '',
                inModal: Boolean(b.closest('.modal, div[role="dialog"], .modal-dialog'))
            })).filter(b => b.text.includes('சமர்ப்பிக்கவும்') || b.text.includes('Submit') || b.text.includes('சேமி') || b.text.includes('Save'));

            const toasts = Array.from(document.querySelectorAll('.p-toast-message, .toast, .alert, .ng-trigger')).map(t => (t.innerText || '').trim());

            return {
                url: window.location.href,
                modals: modals.map(m => ({
                    tag: m.tagName,
                    class: m.className,
                    display: window.getComputedStyle(m).display,
                    visible: m.offsetParent !== null,
                    text: (m.innerText || '').substring(0, 150)
                })),
                relevantButtons: buttons,
                toasts
            };
        });
        console.log(JSON.stringify(info, null, 2));
    } catch (e) {
        console.error('Error:', e.message);
    }
})();
