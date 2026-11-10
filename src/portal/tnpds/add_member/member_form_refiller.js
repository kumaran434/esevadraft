const fs = require('fs');

/**
 * Refills member form fields on live TNPDS portal with proper Angular Reactive Form events.
 */
async function refillMemberFormFields(page, memberData, helpers = {}) {
    const { onProgress = () => {} } = helpers;
    const {
        memberNameTam = '', memberNameEng = '', dob = '10/05/1995',
        genderTam = 'ஆண்', relTam = 'உறுப்பினர்', relEng = 'Member',
        aadhaarNo = '', rawDocPath = ''
    } = memberData;
    onProgress(`📝 [படிவம் நிரப்புதல்] உறுப்பினர் விவரங்கள் (${memberNameTam} / ${memberNameEng}) சரிபார்க்கப்பட்டு நிரப்பப்படுகின்றன...`);

    const fillInput = async (sel, val) => {
        const el = page.locator(sel).first();
        if (await el.count() > 0 && await el.isVisible().catch(() => false)) {
            await el.fill(val).catch(() => {});
            await el.evaluate((e, v) => {
                e.value = v;
                e.dispatchEvent(new Event('input', { bubbles: true }));
                e.dispatchEvent(new Event('change', { bubbles: true }));
                e.dispatchEvent(new Event('blur', { bubbles: true }));
            }, val).catch(() => {});
        }
    };

    await fillInput('input[formcontrolname="name"], input#name', memberNameEng);
    await fillInput('input[formcontrolname="lname"], input[formcontrolname="tamilName"]', memberNameTam);

    const genSel = page.locator('select[formcontrolname="gender"]').first();
    if (await genSel.count() > 0) {
        await genSel.selectOption({ label: genderTam }).catch(async () => {
            await genSel.selectOption({ index: genderTam === 'பெண்' ? 2 : 1 }).catch(() => {});
        });
        await genSel.dispatchEvent('change').catch(() => {});
    }

    const dobInp = page.locator('input[formcontrolname="dateOfBirth"], input[formcontrolname="date"], input#mat-input-0').first();
    if (await dobInp.count() > 0) {
        await dobInp.evaluate((el, d) => {
            el.removeAttribute('readonly');
            el.value = d;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('blur', { bubbles: true }));
        }, dob).catch(() => {});
    }

    const relSel = page.locator('select#relationship, select[formcontrolname="relationship"]').first();
    if (await relSel.count() > 0) {
        const opts = await relSel.locator('option').allInnerTexts().catch(() => []);
        const match = opts.find(o => o.includes(relTam) || (relEng && o.toLowerCase().includes(relEng.toLowerCase())));
        if (match) {
            await relSel.selectOption({ label: match }).catch(() => {});
        } else {
            await relSel.selectOption({ index: 1 }).catch(() => {});
        }
        await relSel.dispatchEvent('change').catch(() => {});
    }

    const pTypeSel = page.locator('select[formcontrolname="proofType"]').first();
    if (await pTypeSel.count() > 0) {
        const pOpts = await pTypeSel.locator('option').allInnerTexts().catch(() => []);
        const aOpt = pOpts.find(o => o.includes('ஆதார்') || o.toLowerCase().includes('aadhaar'));
        if (aOpt) {
            await pTypeSel.selectOption({ label: aOpt }).catch(() => {});
        } else {
            await pTypeSel.selectOption({ index: 1 }).catch(() => {});
        }
        await pTypeSel.dispatchEvent('change').catch(() => {});
    }

    if (rawDocPath && fs.existsSync(rawDocPath)) {
        const fInput = page.locator('input[type="file"]').last();
        if (await fInput.count() > 0) {
            await fInput.setInputFiles(rawDocPath).catch(() => {});
            await page.waitForTimeout(1000);
            const uploadBtn = page.locator('div.btn-primary:has-text("பதிவேற்ற"), div.btn:has-text("பதிவேற்ற"), button:has-text("பதிவேற்ற")').last();
            if (await uploadBtn.count() > 0 && await uploadBtn.isVisible().catch(() => false)) {
                await uploadBtn.click({ force: true }).catch(() => {});
                await page.waitForTimeout(1500);
            }
        }
    }

    if (aadhaarNo && aadhaarNo.length >= 12) {
        const clean = aadhaarNo.replace(/\D/g, '');
        const aParts = [clean.slice(0, 4), clean.slice(4, 8), clean.slice(8, 12)];
        const aSels = ['input[formcontrolname="aadhaarNumber1"], input[formcontrolname="aadhaarPart1"]', 'input[formcontrolname="aadhaarNumber2"], input[formcontrolname="aadhaarPart2"]', 'input[formcontrolname="aadhaarNumber3"], input[formcontrolname="aadhaarPart3"]'];
        for (let i = 0; i < 3; i++) {
            const aInp = page.locator(aSels[i]).first();
            if (await aInp.count() > 0) {
                await aInp.fill(aParts[i]).catch(() => {});
                await aInp.evaluate((el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, aParts[i]).catch(() => {});
            }
        }
    }
    return { success: true };
}

module.exports = {
    refillMemberFormFields
};
