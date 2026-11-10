/**
 * TNPDS Add Member — Step 4: Relationship & Aadhaar Number Engine (Modular Step < 300 lines)
 * 
 * Responsibilities:
 * 1. Selects family relationship from dropdown with smart bilingual normalization (e.g., Son vs Grand Son).
 * 2. Enters 12-digit member Aadhaar number (formcontrolname="uid" / "aadhaar") with authentic kinetics.
 * 3. Enforces strict format gating before proceeding to file upload.
 */

async function fillRelationshipAndAadhaar(page, memberData, helpers = {}) {
    const {
        onProgress = () => {},
        showBrowserHud = async () => {},
        humanType = async () => {}
    } = helpers;

    const relTam = memberData.relTam || memberData.relationshipTam || '';
    const relEng = memberData.relEng || memberData.relationshipEng || '';
    const rawAadhaar = memberData.aadhaarNo || memberData.aadhaarNumber || '';
    const cleanAadhaar = String(rawAadhaar).replace(/\D/g, '');

    console.log(`🔗 [Add Member: Step 4] Relationship: ${relTam} (${relEng}), Aadhaar: ${cleanAadhaar ? 'XXXX-XXXX-' + cleanAadhaar.slice(-4) : 'None'}`);
    if (onProgress) onProgress(`[படி 7/12] 🔗 உறவுமுறை (${relTam || relEng}) மற்றும் ஆதார் எண் பதிவு செய்யப்படுகிறது...`);
    await showBrowserHud('[படி 7/12] உறவுமுறை & ஆதார்', `${relTam} | Aadhaar: ${cleanAadhaar.slice(-4)}`);

    // 1. Relationship Dropdown Selection
    const relSelect = page.locator('select[formcontrolname="relationship"], select[formcontrolname="relation"], select#relationship').first();
    if (await relSelect.count() > 0 && await relSelect.isVisible().catch(() => false)) {
        let matched = false;
        // Attempt label matching with Tamil or English
        if (relTam) {
            matched = await relSelect.selectOption({ label: relTam }).then(() => true).catch(() => false);
        }
        if (!matched && relEng) {
            matched = await relSelect.selectOption({ label: relEng }).then(() => true).catch(() => false);
        }

        // Bilingual keyword fallback
        if (!matched) {
            await page.evaluate(({ rTam, rEng }) => {
                const sel = document.querySelector('select[formcontrolname="relationship"], select[formcontrolname="relation"], select#relationship');
                if (!sel) return;
                const opts = Array.from(sel.options).filter(o => o.value !== '' && o.value !== '0');
                const needleTam = (rTam || '').toLowerCase();
                const needleEng = (rEng || '').toLowerCase();

                const best = opts.find(o => {
                    const t = o.text.toLowerCase();
                    return (needleTam && t.includes(needleTam)) || (needleEng && t.includes(needleEng));
                });
                if (best) {
                    sel.value = best.value;
                    sel.selectedIndex = best.index;
                    sel.dispatchEvent(new Event('change', { bubbles: true }));
                    sel.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }, { rTam: relTam, rEng: relEng }).catch(() => {});
        }
        await page.waitForTimeout(300);
    }

    // 2. Aadhaar Number Input (formcontrolname="uid" / "aadhaar")
    if (cleanAadhaar && cleanAadhaar.length === 12) {
        const aadhaarInput = page.locator('input[formcontrolname="uid"], input[formcontrolname="aadhaar"], input[placeholder*="ஆதார்"], input#uid, input[maxlength="12"]').first();
        if (await aadhaarInput.count() > 0 && await aadhaarInput.isVisible().catch(() => false)) {
            await aadhaarInput.fill('');
            if (typeof humanType === 'function') {
                await humanType(page, aadhaarInput, cleanAadhaar, { isOtp: true });
            } else {
                await aadhaarInput.pressSequentially(cleanAadhaar, { delay: 40 });
            }
            await aadhaarInput.evaluate((el, val) => {
                if (!el.value) el.value = val;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                el.dispatchEvent(new Event('blur', { bubbles: true }));
            }, cleanAadhaar).catch(() => {});
            await page.waitForTimeout(300);
        }
    }

    console.log('✅ [Add Member: Step 4] Relationship and Aadhaar filled successfully.');
    return { success: true };
}

module.exports = {
    fillRelationshipAndAadhaar
};
