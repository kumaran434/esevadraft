const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function run() {
    console.log('Connecting to active TNPDS page on 9222...');
    const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
    const page = browser.contexts()[0].pages()[0];

    console.log('Active Page:', await page.title(), page.url());

    // 1. Dismiss calendar popup
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // 2. Fill Name
    console.log('1. Setting Name: Kumaran K / குமரன் கி');
    const nameEng = page.locator('input#name').first();
    await nameEng.fill('Kumaran K');
    await page.waitForTimeout(200);

    await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input[type="text"]'));
        const tamInput = inputs.find(i => i.id !== 'name' && !i.id.includes('mat') && !i.getAttribute('maxlength'));
        if (tamInput) {
            tamInput.value = 'குமரன் கி';
            tamInput.dispatchEvent(new Event('input', { bubbles: true }));
            tamInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });

    // 3. Set Gender: Male
    console.log('2. Setting Gender: Male');
    const genderSel = page.locator('select#genderSelect').first();
    if (await genderSel.count() > 0) {
        await genderSel.selectOption('Male');
        await genderSel.dispatchEvent('change');
    }

    // 4. Set Relationship: Son
    console.log('3. Setting Relationship: Son');
    await page.evaluate(() => {
        const sel = document.querySelector('select#relationship');
        if (sel) {
            const opt = Array.from(sel.options).find(o => o.value.includes('Son') || o.text.includes('மகன்'));
            if (opt) {
                sel.value = opt.value;
                sel.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    });

    // 5. Set DOB: 10/06/1993
    console.log('4. Setting DOB: 10/06/1993');
    const dobInput = page.locator('input.mat-datepicker-input, input#mat-input-0').first();
    if (await dobInput.count() > 0) {
        await dobInput.fill('10/06/1993');
        await dobInput.dispatchEvent('input');
        await dobInput.dispatchEvent('change');
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // 6. Set Supporting Document: Aadhaar Card
    console.log('5. Setting Supporting Document: Aadhaar Card');
    await page.evaluate(() => {
        const sel = document.querySelector('select#supportingDocuments2, select#supportingDocuments');
        if (sel) {
            const opt = Array.from(sel.options).find(o => o.value.includes('Aadhaar') || o.text.includes('ஆதார்'));
            if (opt) {
                sel.value = opt.value;
                sel.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    });

    // 7. Set Aadhaar Number: 5755 6766 2931
    console.log('6. Setting Aadhaar Number: 5755 6766 2931');
    await page.evaluate(() => {
        const aadhInputs = Array.from(document.querySelectorAll('input[maxlength="4"]'));
        if (aadhInputs.length >= 3) {
            aadhInputs[0].value = '5755'; aadhInputs[0].dispatchEvent(new Event('input', { bubbles: true }));
            aadhInputs[1].value = '6766'; aadhInputs[1].dispatchEvent(new Event('input', { bubbles: true }));
            aadhInputs[2].value = '2931'; aadhInputs[2].dispatchEvent(new Event('input', { bubbles: true }));
        }
    });

    // 8. Upload File: aadhaar.jpg to input[type="file"]:not([disabled])
    const docPath = path.resolve('data/uploads/9842367866/aadhaar.jpg');
    console.log('7. Attaching file:', docPath);
    const activeFileInput = page.locator('input[type="file"]:not([disabled])').first();
    await activeFileInput.setInputFiles(docPath);
    await activeFileInput.dispatchEvent('change');
    await page.waitForTimeout(500);

    // Check if there is an upload button (பதிவேற்ற)
    const uploadBtn = page.locator('div.btn:has-text("பதிவேற்ற"), button:has-text("பதிவேற்ற")').first();
    if (await uploadBtn.count() > 0 && await uploadBtn.isVisible()) {
        console.log('   Clicking "பதிவேற்ற" button...');
        await uploadBtn.click();
        await page.waitForTimeout(1500);
    }

    // 9. Click "உறுப்பினரை சேர்க்க" (Add Member)
    console.log('8. Clicking "உறுப்பினரை சேர்க்க"...');
    const addBtn = page.locator('button.btn-warning:has-text("உறுப்பினரை சேர்க்க"), button:has-text("உறுப்பினரை சேர்க்க")').first();
    if (await addBtn.count() > 0) {
        await addBtn.click();
        console.log('✅ Clicked "உறுப்பினரை சேர்க்க"!');
    }

    await page.waitForTimeout(3000);
    await browser.close();
    console.log('Script execution finished.');
}

run().catch(console.error);
