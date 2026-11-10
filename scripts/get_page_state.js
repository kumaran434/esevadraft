const { chromium } = require('playwright');

async function run() {
    const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
    const context = browser.contexts()[0];
    const page = context.pages().find(p => p.url().includes('3000')) || context.pages()[0];

    const state = await page.evaluate(() => {
        return {
            currentCitizenData: window.currentCitizenData || null,
            lastSubServiceData: window.lastSubServiceData || null,
            localStorage_active_mob: localStorage.getItem('eseva_active_customer_mobile'),
            aadhaarSrc: document.getElementById('editAddMemberAadhaarPreview')?.src,
            aadhaarDisplay: document.getElementById('editAddMemberAadhaarPreview')?.style.display,
            pdfBadgeDisplay: document.getElementById('editAddMemberAadhaarPdfBadge')?.style.display,
            aadhaarStatus: document.getElementById('editAddMemberAadhaarStatus')?.innerText,
            viewBtnHref: document.getElementById('editAddMemberAadhaarViewBtn')?.href
        };
    });

    console.log('State:', JSON.stringify(state, null, 2));
    await browser.close();
}

run().catch(console.error);
