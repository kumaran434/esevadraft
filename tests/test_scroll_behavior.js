const { chromium } = require('playwright');

(async () => {
    console.log('🚀 Starting Chat Scroll Behavior Test...');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

    try {
        console.log('1. Navigating to http://127.0.0.1:3000 ...');
        await page.goto('http://127.0.0.1:3000', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1000);

        // Login as citizen or use default view
        const phoneInput = page.locator('#loginMobile');
        if (await phoneInput.isVisible()) {
            console.log('Logging in as citizen...');
            await phoneInput.fill('9876543210');
            await page.locator('#loginName').fill('ஸ்க்ரோல் டெஸ்ட் பயனர்');
            await page.locator('#btnSendLoginOtp').click();
            await page.waitForTimeout(500);
            await page.locator('#loginOtpInput').fill('123456');
            await page.locator('#btnVerifyLoginOtp').click();
            await page.waitForTimeout(1000);
        }

        // Switch to citizen chat tab
        const chatNav = page.locator('#btnCitizenNavChat');
        if (await chatNav.isVisible()) {
            await chatNav.click();
            await page.waitForTimeout(500);
        }

        // Start ration card intake to generate plenty of questions and messages
        console.log('2. Starting Ration Card service to generate message history...');
        const serviceOption = page.locator('button.chat-option-chip', { hasText: 'புதிய ரேஷன் கார்டு' }).first();
        if (await serviceOption.isVisible()) {
            await serviceOption.click();
            await page.waitForTimeout(1000);
        }

        // Answer member count: 2
        const countChip = page.locator('button.chat-option-chip', { hasText: '2 நபர்கள்' }).first();
        if (await countChip.isVisible()) {
            await countChip.click();
            await page.waitForTimeout(1000);
        }

        // Answer head Aadhaar
        const headAadhaarChip = page.locator('button.chat-option-chip', { hasText: 'டெமோ ஆதார்' }).first();
        if (await headAadhaarChip.isVisible()) {
            await headAadhaarChip.click();
            await page.waitForTimeout(1000);
        }

        // Confirm head details
        const confirmHead = page.locator('button.chat-option-chip', { hasText: 'விவரங்கள் அனைத்தும் சரி' }).first();
        if (await confirmHead.isVisible()) {
            await confirmHead.click();
            await page.waitForTimeout(1000);
        }

        // Member 2 Aadhaar
        const m2Aadhaar = page.locator('button.chat-option-chip', { hasText: 'டெமோ ஆதார்' }).first();
        if (await m2Aadhaar.isVisible()) {
            await m2Aadhaar.click();
            await page.waitForTimeout(1000);
        }

        // Member 2 Relationship
        const m2Rel = page.locator('button.chat-option-chip', { hasText: 'மகன்' }).first();
        if (await m2Rel.isVisible()) {
            await m2Rel.click();
            await page.waitForTimeout(1000);
        }

        // Verify there is enough content to scroll
        const scrollInfo = await page.evaluate(() => {
            const el = document.getElementById('chatMessages');
            return {
                scrollHeight: el.scrollHeight,
                clientHeight: el.clientHeight,
                scrollTop: el.scrollTop,
                isScrollable: (el.scrollHeight - el.clientHeight) > 100
            };
        });
        console.log('Scroll info before scroll up:', scrollInfo);

        // Now scroll to the TOP (scrollTop = 0)
        console.log('3. Scrolling to top (scrollTop = 0)...');
        await page.evaluate(() => {
            const el = document.getElementById('chatMessages');
            el.scrollTop = 0;
            // dispatch scroll event
            el.dispatchEvent(new Event('scroll'));
        });
        await page.waitForTimeout(500);

        const afterScrollTop = await page.evaluate(() => {
            const el = document.getElementById('chatMessages');
            const btn = document.getElementById('chatScrollBottomBtn');
            return {
                scrollTop: el.scrollTop,
                btnVisible: btn ? window.getComputedStyle(btn).display !== 'none' : false,
                btnText: btn ? btn.innerText.trim() : ''
            };
        });
        console.log('Scroll status after scrolling to top:', afterScrollTop);

        if (afterScrollTop.scrollTop !== 0) {
            throw new Error(`Expected scrollTop to be 0, but got ${afterScrollTop.scrollTop}`);
        }
        if (!afterScrollTop.btnVisible) {
            throw new Error('Expected #chatScrollBottomBtn to be visible when scrolled up!');
        }
        console.log('✅ Floating scroll-to-bottom button is visible!');

        // Wait 4.0 seconds (exceeding the 2500ms polling interval) to see if polling hijacks the scroll!
        console.log('4. Waiting 4.0 seconds across background polling cycles...');
        await page.waitForTimeout(4000);

        const afterPollScrollTop = await page.evaluate(() => {
            const el = document.getElementById('chatMessages');
            return el.scrollTop;
        });
        console.log('Scroll position after 4.0 seconds of polling:', afterPollScrollTop);

        if (afterPollScrollTop !== 0) {
            throw new Error(`FAIL: Polling hijacked scroll! Expected scrollTop to stay 0, but became ${afterPollScrollTop}`);
        }
        console.log('✅ PASS: Scroll position remained steady at top (0) without being hijacked by polling!');

        // 5. Test clicking the floating button
        console.log('5. Clicking the floating scroll-to-bottom button...');
        await page.locator('#chatScrollBottomBtn').click();
        await page.waitForTimeout(1000); // allow smooth scroll to finish

        const finalScrollInfo = await page.evaluate(() => {
            const el = document.getElementById('chatMessages');
            const btn = document.getElementById('chatScrollBottomBtn');
            const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
            return {
                scrollTop: el.scrollTop,
                scrollHeight: el.scrollHeight,
                clientHeight: el.clientHeight,
                distFromBottom,
                btnVisible: btn ? window.getComputedStyle(btn).display !== 'none' : false
            };
        });
        console.log('Final scroll info after clicking bottom button:', finalScrollInfo);

        if (finalScrollInfo.distFromBottom > 20) {
            throw new Error(`Expected to be at bottom, but distFromBottom is ${finalScrollInfo.distFromBottom}`);
        }
        if (finalScrollInfo.btnVisible) {
            throw new Error('Expected scroll button to hide when reaching bottom!');
        }
        console.log('✅ PASS: Smoothly scrolled to bottom and button hid cleanly!');

        console.log('\n🎉 ALL CHAT SCROLL VERIFICATION CHECKS PASSED WITH 100% SUCCESS!');
    } catch (err) {
        console.error('❌ Test failed:', err);
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
