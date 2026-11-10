const { chromium } = require('playwright');

async function run() {
    console.log('Connecting to TNPDS...');
    const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
    const page = browser.contexts()[0].pages()[0];

    // 1. Remove calendar overlay completely
    await page.evaluate(() => {
        document.querySelectorAll('.cdk-overlay-container, mat-calendar, .cdk-overlay-backdrop').forEach(el => el.remove());
    });
    console.log('✅ Calendar overlay removed.');

    // 2. Set file using DataTransfer & native fetch
    const uploadResult = await page.evaluate(async () => {
        try {
            const resp = await fetch('http://127.0.0.1:3000/uploads/9842367866/aadhaar.jpg');
            const blob = await resp.blob();
            const file = new File([blob], 'aadhaar.jpg', { type: 'image/jpeg' });
            const dt = new DataTransfer();
            dt.items.add(file);

            const fileInputs = document.querySelectorAll('input[type="file"]');
            const fileInput = fileInputs[1] || Array.from(fileInputs).find(i => !i.disabled);
            if (!fileInput) return { success: false, error: 'No active file input' };

            fileInput.files = dt.files;
            fileInput.dispatchEvent(new Event('input', { bubbles: true }));
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));

            return {
                success: true,
                fileName: fileInput.files[0]?.name,
                fileSize: fileInput.files[0]?.size
            };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    console.log('Native upload result:', JSON.stringify(uploadResult, null, 2));
    await page.waitForTimeout(1000);

    // 3. Click "உறுப்பினரை சேர்க்க" (Add Member) button
    console.log('Clicking "உறுப்பினரை சேர்க்க"...');
    const addBtn = page.locator('button.btn-warning:has-text("உறுப்பினரை சேர்க்க"), button:has-text("உறுப்பினரை சேர்க்க")').first();
    await addBtn.click();
    console.log('✅ Clicked "உறுப்பினரை சேர்க்க"!');

    await page.waitForTimeout(3000);
    await browser.close();
}

run().catch(console.error);
