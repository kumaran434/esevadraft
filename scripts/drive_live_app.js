/**
 * scripts/drive_live_app.js
 * 
 * Drives the LIVE interactive eSevaDraft app visible on user screen via CDP.
 */
const { chromium } = require('playwright');

async function run() {
    console.log('Connecting to live desktop app on http://127.0.0.1:9222 ...');
    const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
    const contexts = browser.contexts();
    if (!contexts.length) throw new Error('No contexts found in browser');
    
    const context = contexts[0];
    const pages = context.pages();
    console.log(`Found ${pages.length} pages in desktop app`);
    
    // Find the main app page (127.0.0.1:3000)
    let page = pages.find(p => p.url().includes('3000') || p.url().includes('esevadraft'));
    if (!page) page = pages[0];

    console.log('Target Page Title:', await page.title());
    console.log('Target Page URL:', page.url());

    // 1. Click "ரேஷன் கார்டு (Ration Card)"
    console.log('Step 1: Clicking "ரேஷன் கார்டு"...');
    const rationBtn = page.locator('button:has-text("ரேஷன் கார்டு"), .chat-option-btn:has-text("ரேஷன்")').first();
    await rationBtn.waitFor({ state: 'visible', timeout: 5000 });
    await rationBtn.click();
    console.log('   ✅ Clicked "ரேஷன் கார்டு"');
    await page.waitForTimeout(1000);

    // 2. Check if mobile modal is visible or prompt in chat
    const mobileInput = page.locator('#newCustomerMobileInput');
    if (await mobileInput.count() > 0 && await mobileInput.first().isVisible()) {
        console.log('Step 2: Entering mobile 9842367866 in modal...');
        await mobileInput.first().fill('9842367866');
        await page.waitForTimeout(600);
        
        const startBtn = page.locator('button[onclick="startCustomerSessionFromModal()"]');
        if (await startBtn.count() > 0 && await startBtn.first().isVisible()) {
            await startBtn.first().click();
        } else {
            await page.evaluate(() => {
                if (typeof window.startCustomerSessionFromModal === 'function') {
                    window.startCustomerSessionFromModal();
                }
            });
        }
        console.log('   ✅ Customer session started for 9842367866');
        await page.waitForTimeout(2000);
    } else {
        // Maybe mobile input in chat or already set
        console.log('Checking alternative mobile entry...');
        const chatInput = page.locator('#chatInput');
        if (await chatInput.isVisible()) {
            await chatInput.fill('9842367866');
            await page.waitForTimeout(400);
            const sendBtn = page.locator('#sendMessageBtn, button:has-text("அனுப்பு")');
            await sendBtn.first().click();
            await page.waitForTimeout(2000);
        }
    }

    // 3. In sub-service options, look for "குடும்ப உறுப்பினர் சேர்க்கை (Add Member)"
    console.log('Step 3: Looking for "குடும்ப உறுப்பினர் சேர்க்கை"...');
    const addMemberBtn = page.locator('button:has-text("உறுப்பினர் சேர்க்க"), .chat-option-btn:has-text("உறுப்பினர்"), button:has-text("Add Member")').first();
    try {
        await addMemberBtn.waitFor({ state: 'visible', timeout: 5000 });
        await addMemberBtn.click();
        console.log('   ✅ Clicked "குடும்ப உறுப்பினர் சேர்க்கை (Add Member)"');
        await page.waitForTimeout(2500);
    } catch (e) {
        console.log('   ℹ️ Add Member button not found immediately, checking existing profile / edit modal: ' + e.message);
    }

    // 4. Check if Edit Modal is open or if review details are displayed
    const editModal = page.locator('#editModal');
    if (await editModal.count() > 0 && await editModal.first().isVisible()) {
        console.log('   🌟 Edit/Review Modal is OPEN on screen!');
    }

    console.log('Live driving completed successfully!');
    // Do NOT disconnect or close the browser, keep it alive on screen
}

run().catch(err => {
    console.error('Error driving live app:', err);
    process.exit(1);
});
