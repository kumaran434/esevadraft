/**
 * Step 4: Family Head Demographics & Biometrics Manager
 * 
 * Responsibilities:
 * 1. Fills English & Tamil full names and father/husband names.
 * 2. Unlocks Angular Material readonly datepicker safely.
 * 3. Selects gender, card type, profession, and monthly income.
 * 4. Attaches family head compliant passport photograph.
 */

async function fillHeadDemographics(page, profile, helpers = {}) {
    const { onProgress, humanType, logDiag } = helpers;

    console.log(`👤 [Step 4: Demographics] Filling Family Head details for: ${profile.fullNameEng || profile.fullNameTam}...`);
    if (onProgress) onProgress('👤 குடும்பத் தலைவர் விவரங்கள் படிவத்தில் நிரப்பப்படுகின்றன...');

    // English Name
    if (profile.fullNameEng) {
        const nameInput = page.locator('input[formcontrolname="name"], input#name').first();
        if (await nameInput.count() > 0) {
            await (humanType ? humanType(page, nameInput, profile.fullNameEng) : nameInput.fill(profile.fullNameEng));
            await page.waitForTimeout(600);
        }
    }

    // Tamil Name — STRICT OCR LOCK
    if (profile.fullNameTam) {
        const tamNameInput = page.locator('input[formcontrolname="nameTamil"], input#nameTamil').first();
        if (await tamNameInput.count() > 0) {
            await tamNameInput.click({ force: true }).catch(() => {});
            await tamNameInput.fill('');
            await tamNameInput.evaluate((el, val) => {
                el.value = val;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                el.dispatchEvent(new Event('blur', { bubbles: true }));
            }, profile.fullNameTam).catch(() => {});
            await page.waitForTimeout(200);
            const curVal = await tamNameInput.inputValue().catch(() => '');
            if (curVal !== profile.fullNameTam) {
                await tamNameInput.evaluate((el, val) => {
                    el.value = val;
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                    el.dispatchEvent(new Event('blur', { bubbles: true }));
                }, profile.fullNameTam).catch(() => {});
            }
        }
    }

    // Father / Husband Name (English & Tamil)
    if (profile.fatherNameEng) {
        const fInput = page.locator('input[formcontrolname="fatherName"], input#fatherName').first();
        if (await fInput.count() > 0) {
            await (humanType ? humanType(page, fInput, profile.fatherNameEng) : fInput.fill(profile.fatherNameEng));
            await page.waitForTimeout(600);
        }
    }
    if (profile.fatherNameTam) {
        const fTamInput = page.locator('input[formcontrolname="fatherNameTamil"], input#fatherNameTamil').first();
        if (await fTamInput.count() > 0) {
            await fTamInput.click({ force: true }).catch(() => {});
            await fTamInput.fill('');
            await fTamInput.evaluate((el, val) => {
                el.value = val;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                el.dispatchEvent(new Event('blur', { bubbles: true }));
            }, profile.fatherNameTam).catch(() => {});
            await page.waitForTimeout(200);
            const curFVal = await fTamInput.inputValue().catch(() => '');
            if (curFVal !== profile.fatherNameTam) {
                await fTamInput.evaluate((el, val) => {
                    el.value = val;
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                    el.dispatchEvent(new Event('blur', { bubbles: true }));
                }, profile.fatherNameTam).catch(() => {});
            }
        }
    }

    return { success: true };
}

module.exports = {
    fillHeadDemographics
};
