const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function run() {
    console.log('Connecting to active TNPDS tab on 9222...');
    const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
    const context = browser.contexts()[0];
    const page = context.pages().find(p => p.url().includes('service-request') || p.url().includes('tnpds')) || context.pages()[0];

    console.log('Active Page:', await page.title(), page.url());

    // 1. Fill English Name: Kumaran K
    console.log('Filling English Name: Kumaran K');
    const nameEngInput = page.locator('input#name, input[formcontrolname="name"]').first();
    await nameEngInput.fill('Kumaran K');
    await page.waitForTimeout(300);

    // 2. Fill Tamil Name: குமரன் கி
    console.log('Filling Tamil Name: குமரன் கி');
    const nameTamInput = page.locator('input[formcontrolname="nameTamil"], input[name="nameTamil"]').first();
    if (await nameTamInput.count() > 0) {
        await nameTamInput.fill('குமரன் கி');
    } else {
        // Find input next to English name
        await page.evaluate(() => {
            const inputs = Array.from(document.querySelectorAll('input[type="text"]'));
            const tamInput = inputs.find(i => i.id !== 'name' && !i.id.includes('mat'));
            if (tamInput) {
                tamInput.value = 'குமரன் கி';
                tamInput.dispatchEvent(new Event('input', { bubbles: true }));
                tamInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    }
    await page.waitForTimeout(300);

    // 3. Fill Gender: Male (ஆண்)
    console.log('Selecting Gender: Male');
    const genderSel = page.locator('select#genderSelect, select[formcontrolname="gender"]').first();
    if (await genderSel.count() > 0) {
        await genderSel.selectOption('Male');
        await genderSel.dispatchEvent('change');
    }
    await page.waitForTimeout(300);

    // 4. Fill Relationship: Son / மகன்
    console.log('Selecting Relationship: Son / மகன்');
    const relSel = page.locator('select#relationship, select[formcontrolname="relationship"]').first();
    if (await relSel.count() > 0) {
        await page.evaluate(() => {
            const sel = document.querySelector('select#relationship, select[formcontrolname="relationship"]');
            if (sel) {
                const opt = Array.from(sel.options).find(o => o.value.includes('Son') || o.text.includes('மகன்'));
                if (opt) {
                    sel.value = opt.value;
                    sel.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        });
    }
    await page.waitForTimeout(300);

    // 5. Fill DOB: 10/06/1993
    console.log('Filling DOB: 10/06/1993');
    const dobInput = page.locator('input.mat-datepicker-input, input#mat-input-0').first();
    if (await dobInput.count() > 0) {
        await dobInput.fill('10/06/1993');
        await dobInput.dispatchEvent('input');
        await dobInput.dispatchEvent('change');
    }
    await page.waitForTimeout(400);

    // 6. Select Document Type: Aadhaar Card (ஆதார் அட்டை)
    console.log('Selecting Document: Aadhaar Card');
    const docSel = page.locator('select#supportingDocuments2, select#supportingDocuments, select[formcontrolname="supportingDocuments"]').first();
    if (await docSel.count() > 0) {
        await page.evaluate(() => {
            const sel = document.querySelector('select#supportingDocuments2, select#supportingDocuments, select[formcontrolname="supportingDocuments"]');
            if (sel) {
                const opt = Array.from(sel.options).find(o => o.value.includes('Aadhaar') || o.text.includes('ஆதார்'));
                if (opt) {
                    sel.value = opt.value;
                    sel.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        });
    }
    await page.waitForTimeout(400);

    // 7. Fill Aadhaar 12-digit: 5755 6766 2931
    console.log('Filling Aadhaar Number: 5755 6766 2931');
    await page.evaluate(() => {
        // Look for the 3 aadhaar input boxes
        const aadhInputs = Array.from(document.querySelectorAll('input[maxlength="4"]'));
        if (aadhInputs.length >= 3) {
            aadhInputs[0].value = '5755';
            aadhInputs[0].dispatchEvent(new Event('input', { bubbles: true }));
            aadhInputs[1].value = '6766';
            aadhInputs[1].dispatchEvent(new Event('input', { bubbles: true }));
            aadhInputs[2].value = '2931';
            aadhInputs[2].dispatchEvent(new Event('input', { bubbles: true }));
        } else {
            // General aadhaar input
            const genAadh = document.querySelector('input[formcontrolname="aadhaarNumber"], input#aadhaarNumber');
            if (genAadh) {
                genAadh.value = '575567662931';
                genAadh.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
    });
    await page.waitForTimeout(400);

    // 8. Upload File: aadhaar.jpg
    const docPath = path.resolve('data/uploads/9842367866/aadhaar.jpg');
    console.log('Uploading document file:', docPath);
    if (fs.existsSync(docPath)) {
        const fileInput = page.locator('input[type="file"]').first();
        if (await fileInput.count() > 0) {
            await fileInput.setInputFiles(docPath);
            await fileInput.dispatchEvent('change');
            console.log('✅ File input set to:', docPath);
        }
    }
    await page.waitForTimeout(1000);

    // 9. Click "உறுப்பினரை சேர்க்க" button
    console.log('Clicking "உறுப்பினரை சேர்க்க" (Add Member) button...');
    const addBtn = page.locator('button.btn-warning:has-text("உறுப்பினரை சேர்க்க"), button:has-text("உறுப்பினரை சேர்க்க")').first();
    if (await addBtn.count() > 0) {
        await addBtn.click();
        console.log('✅ Clicked "உறுப்பினரை சேர்க்க"!');
    }

    await page.waitForTimeout(3000);
    await browser.close();
    console.log('TNPDS form submission completed cleanly.');
}

run().catch(console.error);
