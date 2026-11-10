const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:3000/index.html');
    await page.waitForTimeout(1000);

    // 1. Audit Head Aadhaar in Normal Mode
    await page.evaluate(async () => {
        if (typeof openEditModal === 'function') {
            await openEditModal('9790170026');
        }
    });
    await page.waitForTimeout(1000);

    const normalModalAudit = await page.evaluate(() => {
        const headAadhBtn = document.getElementById('editHeadAadhaarViewBtn');
        return {
            visible: headAadhBtn && window.getComputedStyle(headAadhBtn).display !== 'none',
            href: headAadhBtn?.getAttribute('href')
        };
    });
    console.log('1. Normal Mode Head Aadhaar View Btn:', normalModalAudit);

    // Close modal
    await page.evaluate(() => {
        if (typeof closeEditModal === 'function') closeEditModal();
    });
    await page.waitForTimeout(500);

    // 2. Switch customer to "குடும்ப உறுப்பினர் சேர்க்கை" in chat
    const chatResult = await page.evaluate(async () => {
        await fetch('/api/operator/new-customer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ customerMobile: '9790170026', operatorUid: 'test_suite_operator_uid' })
        });
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-session-mobile': '9790170026' },
            body: JSON.stringify({ message: 'குடும்ப உறுப்பினர் சேர்க்க', mobileNumber: '9790170026' })
        });
        const data = await res.json();
        return data;
    });
    const lastMsg = chatResult.chatHistory[chatResult.chatHistory.length - 1];
    console.log('2. Chat Step:', chatResult.step);
    console.log('   Action Required:', lastMsg.actionRequired || 'none');
    console.log('   Text contains "ஏற்கெனவே":', lastMsg.text.includes('ஏற்கெனவே'));
    console.log('   Text contains "பதிவேற்றவும்":', lastMsg.text.includes('பதிவேற்றவும்'));

    // 3. Open Edit Modal while in Add Member mode
    await page.evaluate(async () => {
        if (typeof openEditModal === 'function') {
            await openEditModal('9790170026');
        }
    });
    await page.waitForTimeout(1000);

    const addMemModalAudit = await page.evaluate(() => {
        const addMemBox = document.getElementById('editAddMemberDocBoxesWrap');
        const addMemAadhBtn = document.getElementById('editAddMemberAadhaarViewBtn');
        const st = document.getElementById('editAddMemberAadhaarStatus');
        return {
            boxVisible: addMemBox && window.getComputedStyle(addMemBox).display !== 'none',
            btnVisible: addMemAadhBtn && window.getComputedStyle(addMemAadhBtn).display !== 'none',
            href: addMemAadhBtn?.getAttribute('href'),
            statusText: st?.innerText
        };
    });
    console.log('3. Add Member Mode Modal Audit:', addMemModalAudit);

    // 4. Test View URL via HTTP request
    if (addMemModalAudit.href && addMemModalAudit.href !== '#') {
        const fullUrl = `http://127.0.0.1:3000${addMemModalAudit.href.startsWith('/') ? '' : '/'}${addMemModalAudit.href}`;
        const res = await page.request.get(fullUrl);
        console.log(`4. Add Member Document HTTP Status: ${res.status()} ${res.status() === 200 ? '✅ 200 OK' : '❌ NOT 200'}`);
    }

    await browser.close();
})();
