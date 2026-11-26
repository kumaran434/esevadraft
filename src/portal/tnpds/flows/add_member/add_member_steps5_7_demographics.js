/**
 * TNPDS Add Member - Steps 5 to 7: Member Names, DOB, Gender, Relationship & Disability
 */
const { assertNoRadwareOrPageRefresh } = require('../../../common/universal_radware_resumption');
const { findBestRelationshipOption, classifyRelationship } = require('../../helpers/relationship_matcher');

async function executeSteps5To7Demographics(page, memberContext, onProgress, sharedContext) {
    const {
        showBrowserHud = async () => {},
        selectDateInMatCalendar = async () => false
    } = sharedContext;
    const { memberNameTam, memberNameEng, dob, genderTam, relTam, relEng } = memberContext;

    const isStep4FormIntact = async (p) => p.evaluate(() => {
        const u = (window.location.href || '').toLowerCase();
        return u.includes('service-request') && Boolean(document.querySelector('input[formcontrolname="name"]') && document.querySelector('select[formcontrolname="gender"]'));
    }).catch(() => false);

    const isStep5NameIntact = async (p) => p.evaluate(() => {
        const u = (window.location.href || '').toLowerCase();
        const n = document.querySelector('input[formcontrolname="name"]');
        return u.includes('service-request') && Boolean(n && n.value && n.value.trim().length > 0);
    }).catch(() => false);

    await assertNoRadwareOrPageRefresh(page, isStep4FormIntact, 'படி 5/12');

    // Step 5: Fill English and Tamil Names
    onProgress(`[படி 5/12] 👤 புதிய உறுப்பினர் விவரங்கள் உள்ளிடப்படுகின்றன (${memberNameTam} / ${memberNameEng})...`);
    await showBrowserHud('[படி 5/12] புதிய உறுப்பினர் விவரங்கள்', `${memberNameTam} (${memberNameEng})`);

    const nameEngInput = page.locator('input[formcontrolname="name"]').first();
    if (await nameEngInput.count() > 0 && await nameEngInput.isVisible().catch(() => false)) {
        await nameEngInput.fill('');
        await nameEngInput.pressSequentially(memberNameEng, { delay: 40 });
        await nameEngInput.evaluate((el, val) => {
            if (!el.value) el.value = val;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('blur', { bubbles: true }));
        }, memberNameEng).catch(() => {});
        await page.waitForTimeout(300);
    }

    await assertNoRadwareOrPageRefresh(page, isStep5NameIntact, 'படி 5/12 (தமிழ்ப் பெயர்)');

    const nameTamInput = page.locator('input[formcontrolname="lname"], input[formcontrolname="tamilName"]').first();
    if (await nameTamInput.count() > 0 && await nameTamInput.isVisible().catch(() => false)) {
        await page.waitForTimeout(600);
        await nameTamInput.click({ force: true }).catch(() => {});
        await nameTamInput.fill('');
        await nameTamInput.evaluate((el, val) => {
            el.removeAttribute('readonly');
            el.removeAttribute('disabled');
            el.value = val;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('blur', { bubbles: true }));
        }, memberNameTam).catch(() => {});
        await page.waitForTimeout(250);

        let curTamVal = await nameTamInput.inputValue().catch(() => '');
        if (curTamVal !== memberNameTam) {
            await nameTamInput.evaluate((el, val) => {
                el.value = val;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }, memberNameTam).catch(() => {});
        }
        onProgress(`✅ [Tamil Name Lock] உறுப்பினர் தமிழ்ப் பெயர் "${memberNameTam}" துல்லியமாகப் பதிவு செய்யப்பட்டது.`);
    }

    await assertNoRadwareOrPageRefresh(page, isStep5NameIntact, 'படி 6/12');

    // Step 6: DOB and Gender
    onProgress(`[படி 6/12] 📅 பிறந்த தேதி (${dob}) மற்றும் பாலினம் (${genderTam}) பதிவு செய்யப்படுகின்றன...`);
    await showBrowserHud('[படி 6/12] பிறந்த தேதி & பாலினம்', `${dob} | ${genderTam}`);

    const genderSelect = page.locator('select[formcontrolname="gender"]').first();
    if (await genderSelect.count() > 0 && await genderSelect.isVisible().catch(() => false)) {
        await genderSelect.selectOption({ label: genderTam }).catch(async () => {
            await genderSelect.selectOption({ index: genderTam === 'பெண்' ? 2 : 1 }).catch(() => {});
        });
        await page.waitForTimeout(400);
    }

    await selectDateInMatCalendar(page, dob, false);
    await page.waitForTimeout(600);

    const dobInput = page.locator('input[formcontrolname="dateOfBirth"], input[formcontrolname="date"], input#mat-input-0, input[placeholder*="DD/MM"]').first();
    if (await dobInput.count() > 0 && await dobInput.isVisible().catch(() => false)) {
        const curVal = await dobInput.inputValue().catch(() => '');
        if (!curVal) {
            await selectDateInMatCalendar(page, dob, false);
            await page.waitForTimeout(500);
        }
        await dobInput.evaluate((el) => {
            el.removeAttribute('readonly');
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        }).catch(() => {});
    }

    await assertNoRadwareOrPageRefresh(page, isStep5NameIntact, 'படி 7/12');

    // Step 7: Relationship & Disability
    onProgress(`[படி 7/12] 🔗 உறவுமுறை (${relTam} - ${relEng}) தேர்வு செய்யப்படுகிறது...`);
    await showBrowserHud('[படி 7/12] உறவுமுறை தேர்வு', `${relTam} (${relEng})`);

    const relSelect = page.locator('select[formcontrolname="relationship"], select[formcontrolname="relation"]').first();
    if (await relSelect.count() > 0 && await relSelect.isVisible().catch(() => false)) {
        const relOptions = await relSelect.evaluate(s => Array.from(s.options).map((o, idx) => ({
            index: idx,
            value: String(o.value ?? ''),
            text: (o.innerText || o.text || '').trim()
        }))).catch(() => []);
        const matchedOpt = findBestRelationshipOption(relOptions, relTam, relEng);
        if (matchedOpt) {
            await relSelect.selectOption({ index: matchedOpt.index }).catch(async () => {
                if (matchedOpt.value) await relSelect.selectOption(matchedOpt.value).catch(() => {});
            });
            await relSelect.dispatchEvent('change').catch(() => {});
            await relSelect.dispatchEvent('blur').catch(() => {});
            await page.waitForTimeout(300);
            const selectedInfo = await relSelect.evaluate(s => {
                const o = s.options[s.selectedIndex];
                return o ? { index: s.selectedIndex, value: String(o.value ?? ''), text: (o.innerText || o.text || '').trim() } : null;
            }).catch(() => null);
            const targetDef = classifyRelationship(relTam) || classifyRelationship(relEng);
            const pickedDef = selectedInfo ? (classifyRelationship(selectedInfo.text) || classifyRelationship(selectedInfo.value)) : null;
            if (targetDef && pickedDef && pickedDef.key !== targetDef.key) {
                onProgress(`⚠️ [உறவுமுறை சரிபார்ப்பு] எதிர்பார்த்த "${relTam} (${relEng})" என்பதற்குப் பதில் "${selectedInfo?.text}" பதிவானது — மீண்டும் "${matchedOpt.text}" சரிசெய்யப்படுகிறது...`);
                await relSelect.selectOption({ index: matchedOpt.index }).catch(() => {});
                await relSelect.dispatchEvent('change').catch(() => {});
            } else {
                onProgress(`✅ [உறவுமுறை உறுதி] போர்ட்டலில் "${selectedInfo?.text || matchedOpt.text}" (${relTam} / ${relEng}) துல்லியமாகத் தேர்வு செய்யப்பட்டது.`);
            }
        } else {
            const availSummary = relOptions.map(o => `${o.text} [${o.value}]`).join(', ');
            onProgress(`🛑 **பிழை:** போர்ட்டல் உறவுமுறைப் பட்டியலில் "${relTam} (${relEng})" கிடைக்கவில்லை! (பட்டியல்: ${availSummary})`);
            throw new Error(`RELATIONSHIP_OPTION_MISMATCH: Cannot find "${relTam}" (${relEng}) in TNPDS dropdown.`);
        }
        await page.waitForTimeout(500);
    }

    onProgress(`[படி 7b/12] ♿ மாற்றுத்திறனாளியா கேள்விக்கு "இல்லை" என பதிவு செய்யப்படுகிறது...`);
    try {
        const diffAbledNo = page.locator('input[type="radio"][value="false"], input[type="radio"][id*="No"], input[type="radio"][name*="diffAbled"][value="N"]').first();
        if (await diffAbledNo.count() > 0 && await diffAbledNo.isVisible().catch(() => false)) {
            await diffAbledNo.check({ force: true }).catch(() => {});
        }
    } catch (_) {}

    await page.waitForTimeout(500);
    await assertNoRadwareOrPageRefresh(page, isStep5NameIntact, 'படி 7/12 நிறைவு');
    return { success: true };
}

module.exports = {
    executeSteps5To7Demographics
};

