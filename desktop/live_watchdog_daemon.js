const playwright = require('playwright');
const fs = require('fs');

(async () => {
    console.log('--- STARTING LIVE BACKGROUND WATCHDOG ---');
    let prevLog = '';
    
    for (let loop = 0; loop < 1800; loop++) {
        await new Promise(r => setTimeout(r, 2000));
        
        // 1. Read latest log
        try {
            if (fs.existsSync('public/logs/latest_run.log')) {
                const lines = fs.readFileSync('public/logs/latest_run.log', 'utf8').trim().split('\n');
                const lastLine = lines[lines.length - 1];
                if (lastLine !== prevLog) {
                    prevLog = lastLine;
                    console.log('[ENGINE PROGRESS]', lastLine);
                }
            }
        } catch (_) {}

        // 2. Connect to Chrome tab and check DOM state
        try {
            const browser = await playwright.chromium.connectOverCDP('http://127.0.0.1:9222').catch(() => null);
            if (!browser) continue;
            const pages = browser.contexts()[0]?.pages() || [];
            const page = pages.find(p => p.url().includes('tnpds'));
            if (page) {
                const domState = await page.evaluate(() => {
                    const modal = document.querySelector('.modal.show');
                    if (modal) {
                        const mText = modal.innerText.replace(/\s+/g, ' ');
                        const inp = modal.querySelector('input[formcontrolname="mobileOtp"]');
                        const resendBtn = Array.from(modal.querySelectorAll('button')).find(b => b.innerText.includes('மீண்டும்'));
                        const verifyBtn = Array.from(modal.querySelectorAll('button')).find(b => b.innerText.includes('பதிவு செய்') || b.classList.contains('btn-success'));
                        
                        // Autonomous Self-Healing: If user typed 6 digits in Chrome and verify button is visible, click it!
                        if (inp && inp.value && inp.value.replace(/\D/g, '').length >= 6 && verifyBtn) {
                            inp.dispatchEvent(new Event('input', { bubbles: true }));
                            inp.dispatchEvent(new Event('change', { bubbles: true }));
                            inp.dispatchEvent(new Event('blur', { bubbles: true }));
                            verifyBtn.disabled = false;
                            verifyBtn.removeAttribute('disabled');
                            verifyBtn.click();
                            return { action: 'AUTO_CLICKED_VERIFY', val: inp.value };
                        }

                        // Autonomous Self-Healing for Aadhaar OTP Modal:
                        const aadhaarInp = modal.querySelector('input[formcontrolname="otp"], input#otp');
                        if (aadhaarInp) {
                            const subBtn = Array.from(modal.querySelectorAll('button')).find(b => b.innerText.includes('சமர்ப்பிக்கவும்') || b.classList.contains('btn-success'));
                            if (aadhaarInp.value && aadhaarInp.value.replace(/\D/g, '').length === 6 && subBtn) {
                                aadhaarInp.dispatchEvent(new Event('input', { bubbles: true }));
                                aadhaarInp.dispatchEvent(new Event('change', { bubbles: true }));
                                subBtn.disabled = false;
                                subBtn.removeAttribute('disabled');
                                subBtn.click();
                                return { action: 'AUTO_CLICKED_AADHAAR_SUBMIT', val: aadhaarInp.value };
                            }
                            return { action: 'WAITING_AADHAAR_OTP', modal: true };
                        }

                        // Autonomous Self-Healing: If countdown is 0 and only resend button is visible, click it!
                        if (mText.includes('0 நொடிகள்') && resendBtn && !resendBtn.disabled && !verifyBtn) {
                            resendBtn.click();
                            return { action: 'AUTO_CLICKED_RESEND' };
                        }

                        return { modalOpen: true, text: mText.slice(0, 100), inputVal: inp ? inp.value : null };
                    }
                    
                    const memberSec = document.querySelector('#memberFormSection, input[formcontrolname="dateOfBirth"]');
                    const isAddMemBtn = Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('உறுப்பினரை சேர்க்க'));
                    const isSaveMemBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('உறுப்பினர் விவரம் சேமி'));
                    
                    return { modalOpen: false, memberSecReady: !!memberSec, hasAddMemBtn: isAddMemBtn, hasSaveMemBtn: !!isSaveMemBtn };
                }).catch(() => null);

                if (domState && domState.action) {
                    console.log('[WATCHDOG SELF-HEAL]', JSON.stringify(domState));
                }
            }
            await browser.close().catch(() => {});
        } catch (_) {}
    }
})();

