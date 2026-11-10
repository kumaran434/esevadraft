const { chromium } = require('playwright');

(async () => {
    try {
        const b = await chromium.connectOverCDP('http://127.0.0.1:9222');
        const p = b.contexts()[0].pages().find(x => x.url().includes('newsmartcard'));
        const cdp = await p.context().newCDPSession(p);
        
        const evalRes = await cdp.send('Runtime.evaluate', {
            expression: 'document.querySelector("div.modal.show button.btn-warning, div.modal.show button.btn-success, div.modal.show button")'
        });
        
        if (evalRes && evalRes.result && evalRes.result.objectId) {
            const listeners = await cdp.send('DOMDebugger.getEventListeners', {
                objectId: evalRes.result.objectId
            });
            console.log('Listeners on button:', listeners.listeners.map(l => ({ type: l.type, scriptId: l.scriptId, lineNumber: l.lineNumber })));
        } else {
            console.log('No object found');
        }
        await b.close();
    } catch (e) {
        console.error(e);
    }
})();
