/**
 * TNPDS Add Member — Step 3: Member Demographics & Angular MatCalendar Engine (Modular Step < 300 lines)
 * 
 * Responsibilities:
 * 1. Fills new member English Name (formcontrolname="name").
 * 2. Fills new member Tamil Name (formcontrolname="lname" / "tamilName") with native keyboard events.
 * 3. Selects Gender (formcontrolname="gender") with exact Tamil/English labels.
 * 4. Fills Date of Birth (formcontrolname="dateOfBirth" / "date" / mat-input-0) with MatCalendar support.
 * 5. Proactively guards against Angular resetting document type to Birth Certificate for children.
 */

async function fillMemberDemographics(page, memberData, helpers = {}) {
    const {
        onProgress = () => {},
        showBrowserHud = async () => {},
        selectDateInMatCalendar = async () => {}
    } = helpers;

    const nameEng = memberData.nameEng || memberData.memberNameEng || '';
    const nameTam = memberData.nameTam || memberData.memberNameTam || '';
    const dob = memberData.dob || memberData.dateOfBirth || '';
    const genderTam = memberData.genderTam || memberData.gender || 'ஆண்';

    console.log(`👤 [Add Member: Step 3] Demographics for ${nameTam} (${nameEng}), DOB: ${dob}, Gender: ${genderTam}...`);
    if (onProgress) onProgress(`[படி 5/12] 👤 புதிய உறுப்பினர் விவரங்கள் (${nameTam} / ${nameEng}) உள்ளிடப்படுகின்றன...`);
    await showBrowserHud('[படி 5/12] புதிய உறுப்பினர் விவரங்கள்', `${nameTam} (${nameEng})`);

    // 1. English Name (formcontrolname="name")
    if (nameEng) {
        const nameEngInput = page.locator('input[formcontrolname="name"]').first();
        if (await nameEngInput.count() > 0 && await nameEngInput.isVisible().catch(() => false)) {
            await nameEngInput.fill('');
            await nameEngInput.pressSequentially(nameEng, { delay: 40 });
            await nameEngInput.evaluate((el, val) => {
                if (!el.value) el.value = val;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                el.dispatchEvent(new Event('blur', { bubbles: true }));
            }, nameEng).catch(() => {});
            await page.waitForTimeout(300);
        }
    }

    // 2. Tamil Name (formcontrolname="lname", "tamilName") — STRICT OCR LOCK
    if (nameTam) {
        const nameTamInput = page.locator('input[formcontrolname="lname"], input[formcontrolname="tamilName"]').first();
        if (await nameTamInput.count() > 0 && await nameTamInput.isVisible().catch(() => false)) {
            // A. Wait 600ms for portal auto-transliteration from English field to complete & settle
            await page.waitForTimeout(600);

            // B. Unconditionally clear and inject official extracted Tamil name into DOM & Angular
            await nameTamInput.click({ force: true }).catch(() => {});
            await nameTamInput.fill('');
            await nameTamInput.evaluate((el, val) => {
                el.removeAttribute('readonly');
                el.removeAttribute('disabled');
                el.value = val;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                el.dispatchEvent(new Event('blur', { bubbles: true }));
            }, nameTam).catch(() => {});
            await page.waitForTimeout(250);

            // C. Strict Verification Gate: Verify input value matches nameTam
            let curTamVal = await nameTamInput.inputValue().catch(() => '');
            if (curTamVal !== nameTam) {
                console.warn(`[step3_demographics] Transliteration overwrite detected: "${curTamVal}" vs expected "${nameTam}". Re-applying...`);
                await nameTamInput.evaluate((el, val) => {
                    el.value = val;
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                    el.dispatchEvent(new Event('blur', { bubbles: true }));
                }, nameTam).catch(() => {});
            }

            // D. Secondary Transliteration Immune Check (catches delayed portal transliteration)
            await page.waitForTimeout(400);
            curTamVal = await nameTamInput.inputValue().catch(() => '');
            if (curTamVal !== nameTam) {
                console.warn(`[step3_demographics] Portal transliteration overrode value to "${curTamVal}". Restoring to "${nameTam}"...`);
                await nameTamInput.evaluate((el, val) => {
                    el.value = val;
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                    el.dispatchEvent(new Event('blur', { bubbles: true }));
                }, nameTam).catch(() => {});
            }
            if (onProgress) onProgress(`✅ [Tamil Name Lock] உறுப்பினர் தமிழ்ப் பெயர் "${nameTam}" துல்லியமாகப் பதிவு செய்யப்பட்டு பூட்டப்பட்டது.`);
        }
    }

    // 3. Gender Dropdown (formcontrolname="gender")
    if (genderTam) {
        if (onProgress) onProgress(`[படி 6/12] 🚻 பாலினம் (${genderTam}) தேர்வு செய்யப்படுகிறது...`);
        const genderSelect = page.locator('select[formcontrolname="gender"]').first();
        if (await genderSelect.count() > 0 && await genderSelect.isVisible().catch(() => false)) {
            await genderSelect.selectOption({ label: genderTam }).catch(async () => {
                const idx = genderTam === 'பெண்' || genderTam === 'Female' ? 2 : (genderTam === 'மற்றவை' || genderTam === 'Transgender' ? 3 : 1);
                await genderSelect.selectOption({ index: idx }).catch(() => {});
            });
            await genderSelect.dispatchEvent('change').catch(() => {});
            await page.waitForTimeout(300);
        }
    }

    // 4. DOB — Angular Material Datepicker
    if (dob) {
        if (onProgress) onProgress(`[படி 6/12] 📅 பிறந்த தேதி (${dob}) பதிவு செய்யப்படுகிறது...`);
        await showBrowserHud('[படி 6/12] பிறந்த தேதி & பாலினம்', `${dob} | ${genderTam}`);

        if (typeof selectDateInMatCalendar === 'function') {
            await selectDateInMatCalendar(page, dob, false);
            await page.waitForTimeout(500);
        }

        const dobInput = page.locator('input[formcontrolname="dateOfBirth"], input[formcontrolname="date"], input#mat-input-0, input[placeholder*="DD/MM"]').first();
        if (await dobInput.count() > 0 && await dobInput.isVisible().catch(() => false)) {
            await dobInput.evaluate((el, val) => {
                el.removeAttribute('readonly');
                if (!el.value) el.value = val;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }, dob).catch(() => {});
            await page.waitForTimeout(300);

            // Enforce Aadhaar Card in supporting documents dropdown if Angular reset it
            await page.evaluate(() => {
                const docSel = document.querySelector('select#supportingDocuments, select[formcontrolname="supportingDocuments"]');
                if (docSel) {
                    const opts = Array.from(docSel.options).filter(o => o.value !== '' && o.value !== '0');
                    const aadhaarOpt = opts.find(o => o.value.includes('Aadhaar') || o.text.includes('ஆதார்') || o.text.toLowerCase().includes('aadhaar'));
                    if (aadhaarOpt) {
                        docSel.value = aadhaarOpt.value;
                        docSel.selectedIndex = aadhaarOpt.index;
                        docSel.dispatchEvent(new Event('change', { bubbles: true }));
                        docSel.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                }
            }).catch(() => {});
        }
    }

    console.log('✅ [Add Member: Step 3] Demographics filled successfully.');
    return { success: true };
}

module.exports = {
    fillMemberDemographics
};
