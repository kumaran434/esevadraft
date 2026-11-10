const { chromium } = require('playwright-core');

async function checkTnpdsState() {
    const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
    const pages = browser.contexts()[0].pages();
    const page = pages.find(p => p.url().includes('tnpds')) || pages[0];

    const state = await page.evaluate(() => {
        const u = window.location.href;
        const mobVal = document.querySelector('input[formcontrolname="mobNumber"]')?.value || '';
        const captchaVal = document.querySelector('input[formcontrolname="captchaCode"]')?.value || '';
        const otpInp = document.querySelector('input[formcontrolname="otp"], input[placeholder*="OTP"]');
        const isOtpVisible = otpInp ? (otpInp.offsetWidth > 0 || otpInp.offsetHeight > 0) : false;
        const otpVal = otpInp?.value || '';
        const modals = Array.from(document.querySelectorAll('.modal, div[role="dialog"]')).filter(m => m.offsetWidth > 0 || m.offsetHeight > 0).map(m => m.innerText.trim());
        const alerts = Array.from(document.querySelectorAll('.alert, .error, .toast, snack-bar-container')).map(e => e.innerText.trim()).filter(Boolean);
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]')).filter(b => b.offsetWidth > 0 || b.offsetHeight > 0).map(b => (b.innerText || b.value || '').trim());
        return { u, mobVal, captchaVal, isOtpVisible, otpVal, modals, alerts, buttons };
    });

    console.log('TNPDS state:', JSON.stringify(state, null, 2));
    await page.screenshot({ path: 'tnpds_live_current.png' });
    console.log('Screenshot saved to tnpds_live_current.png');
    process.exit(0);
}

checkTnpdsState().catch(err => {
    console.error(err);
    process.exit(1);
});
