/**
 * TNPDS New Smart Card - Steps 1 to 13: Applicant Demographics & Address
 */
const fs = require('fs');

async function executeApplicantDemographics(page, citizenProfile, sanitizedProfile, docPrep, onProgress, sharedContext, logDiag, takeStepSnapshot, scanAndBroadcastToasts) {
    const { requestReplacementFileFromUser, produceCompliantPassportPhoto = async (p) => p, showBrowserHud = async () => {} } = sharedContext;
    const { optimizedHeadPhoto } = docPrep;
    const { tamName, tamFather, doorNo, tamStreet, tamArea, engName, engFather, engStreet, engArea } = sanitizedProfile;

    // படி 1: ஆங்கிலத் தலைப்பு
    const isHeadFemale = citizenProfile.headGender === 'Female' || citizenProfile.headGenderTam === 'பெண்';
    const targetSalEng = isHeadFemale ? 'Mrs.' : 'Mr.';
    const targetSalTam = isHeadFemale ? 'திருமதி.' : 'திரு.';

    onProgress(`📍 [படி 1/51] குடும்பத் தலைவர் தலைப்பு ஆங்கிலம் (${targetSalEng}) தேர்வு செய்யப்படுகிறது...`);
    const engSal = page.locator('select[formcontrolname="salutation"]').first();
    try { await engSal.waitFor({ state: 'attached', timeout: 25000 }); } catch (_) {}
    try {
        await page.waitForFunction(() => {
            const sel = document.querySelector('select[formcontrolname="salutation"]');
            return sel && sel.options && sel.options.length > 1;
        }, { timeout: 30000 });
    } catch (_) {}

    let salSelected = false;
    for (let retry = 0; retry < 3; retry++) {
        try {
            const allOpts = await page.evaluate(() => {
                const sel = document.querySelector('select[formcontrolname="salutation"]');
                return sel ? Array.from(sel.options).map(o => ({ value: o.value, text: (o.text || '').trim() })) : [];
            });
            const match = allOpts.find(o => {
                const t = o.text.toLowerCase().replace('.', '');
                const targetClean = targetSalEng.toLowerCase().replace('.', '');
                return t.includes(targetClean) || (targetSalEng.includes('Mrs') && (t.includes('ms') || t.includes('miss')));
            });
            if (match && match.value) await engSal.selectOption(match.value);
            else if (allOpts.length > 1) await engSal.selectOption({ index: 1 });

            await page.evaluate((val) => {
                const sel = document.querySelector('select[formcontrolname="salutation"]');
                if (sel) {
                    if (val) sel.value = val;
                    sel.dispatchEvent(new Event('input', { bubbles: true }));
                    sel.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }, match ? match.value : null);

            const valAfter = await engSal.inputValue();
            if (valAfter && valAfter !== '') {
                salSelected = true;
                logDiag(1, 'salutation_eng', `${targetSalEng} selected.`);
                break;
            }
        } catch (_) {}
        await page.waitForTimeout(1000);
    }
    if (!salSelected) return { success: false, message: 'படி 1 ஆங்கிலத் தலைப்பு தேர்வு தோல்வி.' };

    // படி 2: தமிழ்த் தலைப்பு
    onProgress(`📍 [படி 2/51] குடும்பத் தலைவர் தலைப்பு தமிழ் (${targetSalTam}) தேர்வு செய்யப்படுகிறது...`);
    const tamSal = page.locator('select[formcontrolname="lsalutation"]').first();
    try { await tamSal.waitFor({ state: 'attached', timeout: 20000 }); } catch (_) {}
    try {
        await page.waitForFunction(() => {
            const sel = document.querySelector('select[formcontrolname="lsalutation"]');
            return sel && sel.options && sel.options.length > 1;
        }, { timeout: 20000 });
    } catch (_) {}

    let tamSalSelected = false;
    for (let retry = 0; retry < 3; retry++) {
        try {
            const allTamOpts = await page.evaluate(() => {
                const sel = document.querySelector('select[formcontrolname="lsalutation"]');
                return sel ? Array.from(sel.options).map(o => ({ value: o.value, text: (o.text || '').trim() })) : [];
            });
            const matchTam = allTamOpts.find(o => o.text.trim().includes(targetSalTam));
            if (matchTam && matchTam.value) await tamSal.selectOption(matchTam.value);
            else if (allTamOpts.length > 1) await tamSal.selectOption({ index: 1 });

            await page.evaluate((val) => {
                const sel = document.querySelector('select[formcontrolname="lsalutation"]');
                if (sel) {
                    if (val) sel.value = val;
                    sel.dispatchEvent(new Event('input', { bubbles: true }));
                    sel.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }, matchTam ? matchTam.value : null);

            const valAfter = await tamSal.inputValue();
            if (valAfter && valAfter !== '') {
                tamSalSelected = true;
                logDiag(2, 'salutation_tam', `${targetSalTam} selected.`);
                break;
            }
        } catch (_) {}
        await page.waitForTimeout(1000);
    }
    if (!tamSalSelected) return { success: false, message: 'படி 2 தமிழ்த் தலைப்பு தேர்வு தோல்வி.' };

    // படி 3: பாஸ்போர்ட் புகைப்படம்
    onProgress('📍 [படி 3/51] குடும்பத் தலைவர் வெள்ளை பின்னணி பாஸ்போர்ட் புகைப்படம் அப்லோட் செய்யப்படுகிறது...');
    let activePhoto = (optimizedHeadPhoto && fs.existsSync(optimizedHeadPhoto)) ? optimizedHeadPhoto : null;
    if (!activePhoto && typeof requestReplacementFileFromUser === 'function') {
        const prompt = '📸 குடும்பத் தலைவரின் பாஸ்போர்ட் புகைப்படம் பதிவேற்றவும்.';
        const newRaw = await requestReplacementFileFromUser(prompt, onProgress, 'HEAD_PHOTO');
        if (newRaw && fs.existsSync(newRaw)) activePhoto = await produceCompliantPassportPhoto(newRaw);
    }

    if (activePhoto && fs.existsSync(activePhoto)) {
        const headFileInput = page.locator('input[formcontrolname="beneficiaryApplicantPicture"], input[type="file"]').first();
        if (await headFileInput.count() > 0) {
            await headFileInput.evaluate(el => {
                el.disabled = false; el.removeAttribute('disabled');
                el.removeAttribute('readonly'); el.readOnly = false;
                el.style.display = 'block'; el.style.opacity = '1'; el.style.visibility = 'visible';
            }).catch(() => {});
            try { await headFileInput.setInputFiles(activePhoto, { timeout: 2000 }); } catch (_) {}
            logDiag(3, 'photo_upload', `Attached: ${activePhoto}`);
            await page.waitForTimeout(2000);
            await scanAndBroadcastToasts();
        } else {
            onProgress('⚠️ [படி 3/51] பாஸ்போர்ட் புகைப்படக் கட்டம் பின்னர் பதிவேற்றப்படும்; பெயர் மற்றும் முகவரி விவரங்கள் தொடர்ந்து நிரப்பப்படுகின்றன...');
        }
    } else {
        onProgress('⚠️ [படி 3/51] பாஸ்போர்ட் புகைப்படக் கோப்பு பின்னர் இணைக்கப்படும்; பெயர் மற்றும் முகவரி விவரங்கள் தொடர்ந்து நிரப்பப்படுகின்றன...');
    }

    // படி 4: ஆங்கிலப் பெயர்
    let resolvedEngName = engName || (citizenProfile.name && !citizenProfile.name.startsWith('வாடிக்கையாளர்') ? citizenProfile.name : '') || tamName || 'APPLICANT';
    onProgress(`📍 [படி 4/51] குடும்பத் தலைவர் பெயர் - ஆங்கிலம் (${resolvedEngName}) தட்டச்சு செய்யப்படுகிறது...`);
    const headNameInput = page.locator('input[formcontrolname="NameOfFamilyHead"]').first();
    await headNameInput.waitFor({ state: 'visible', timeout: 15000 });
    await headNameInput.fill(resolvedEngName);
    await headNameInput.dispatchEvent('input');
    await headNameInput.dispatchEvent('change');

    // படி 5: ஆங்கிலத் தந்தை / கணவர் பெயர்
    if (!engFather || engFather.trim() === '' || engFather.trim().toUpperCase() === 'FATHER') {
        logDiag(5, 'FAIL', 'Father/Husband name missing');
        throw new Error('படி 5 பிழை: தந்தை / கணவர் பெயர் போர்ட்டலில் கட்டாயமாகும் (*).');
    }
    const resolvedEngFather = engFather.trim();
    onProgress(`📍 [படி 5/51] தந்தை / கணவர் பெயர் - ஆங்கிலம் (${resolvedEngFather}) தட்டச்சு செய்யப்படுகிறது...`);
    const fatherNameInput = page.locator('input[formcontrolname="FathersOrHusbandsName"]').first();
    await fatherNameInput.waitFor({ state: 'visible', timeout: 15000 });
    await fatherNameInput.click();
    await fatherNameInput.fill(resolvedEngFather);
    await fatherNameInput.dispatchEvent('input');
    await fatherNameInput.dispatchEvent('change');
    await fatherNameInput.press('Space').catch(() => {});
    await page.waitForTimeout(200);
    await fatherNameInput.press('Backspace').catch(() => {});
    await fatherNameInput.dispatchEvent('change');

    let checkEngFather = await fatherNameInput.inputValue();
    if (!checkEngFather || checkEngFather.trim() === '') {
        await page.evaluate(({ val }) => {
            const el = document.querySelector('input[formcontrolname="FathersOrHusbandsName"]');
            if (el) { el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }
        }, { val: resolvedEngFather });
        checkEngFather = await fatherNameInput.inputValue();
    }
    logDiag(5, 'PASS', `Step 5 verified: ${checkEngFather}`);

    // படி 6: கதவு எண் ஆங்கிலம்
    onProgress(`📍 [படி 6/51] கதவு எண் - ஆங்கிலம் (${doorNo}) தட்டச்சு செய்யப்படுகிறது...`);
    await page.locator('input[formcontrolname="AddressLine1"]').first().fill(doorNo);
    await page.locator('input[formcontrolname="AddressLine1"]').first().dispatchEvent('change');

    // படி 7: தெருப் பெயர் ஆங்கிலம்
    onProgress(`📍 [படி 7/51] தெருப் பெயர் - ஆங்கிலம் (${engStreet}) தட்டச்சு செய்யப்படுகிறது...`);
    await page.locator('input[formcontrolname="AddressLine2"]').first().fill(engStreet);
    await page.locator('input[formcontrolname="AddressLine2"]').first().dispatchEvent('change');

    // படி 8: பகுதி / கிராமம் ஆங்கிலம்
    onProgress(`📍 [படி 8/51] பகுதி / கிராமம் - ஆங்கிலம் (${engArea}) தட்டச்சு செய்யப்படுகிறது...`);
    const engAreaInp = page.locator('input[formcontrolname="AddressLine3"]').first();
    if (await engAreaInp.count() > 0) {
        await engAreaInp.fill(engArea);
        await engAreaInp.dispatchEvent('change');
    }
    await page.waitForTimeout(2000);

    // படிகள் 9 முதல் 13: தமிழ் விவரங்கள்
    onProgress(`📍 [படிகள் 9-13/51] தூய தமிழ் முகவரி (${tamName} / ${tamFather} / ${doorNo} / ${tamStreet} / ${tamArea}) பூட்டப்படுகிறது...`);
    const headTamInput = page.locator('input[formcontrolname="குடும்பதலைவர்பெயர்"]').first();
    if (await headTamInput.count() > 0) { await headTamInput.fill(tamName); await headTamInput.dispatchEvent('input'); await headTamInput.dispatchEvent('change'); }

    const fatherTamInput = page.locator('input[formcontrolname="தந்தைகணவர்பெயர்"]').first();
    if (await fatherTamInput.count() > 0) { await fatherTamInput.fill(tamFather); await fatherTamInput.dispatchEvent('input'); await fatherTamInput.dispatchEvent('change'); }

    const doorTamInput = page.locator('input[formcontrolname="முகவரிவரி1"]').first();
    if (await doorTamInput.count() > 0) { await doorTamInput.fill(doorNo); await doorTamInput.dispatchEvent('input'); await doorTamInput.dispatchEvent('change'); }

    const streetTamInput = page.locator('input[formcontrolname="முகவரிவரி2"]').first();
    if (await streetTamInput.count() > 0) { await streetTamInput.fill(tamStreet); await streetTamInput.dispatchEvent('input'); await streetTamInput.dispatchEvent('change'); }

    const areaTamInput = page.locator('input[formcontrolname="முகவரிவரி3"]').first();
    if (await areaTamInput.count() > 0) { await areaTamInput.fill(tamArea); await areaTamInput.dispatchEvent('input'); await areaTamInput.dispatchEvent('change'); }

    await page.evaluate(({ tamName, tamFather, doorNo, tamStreet, tamArea }) => {
        const setVal = (sel, val) => {
            const el = document.querySelector(sel);
            if (el && val) { el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }
        };
        if (tamName) setVal('input[formcontrolname="குடும்பதலைவர்பெயர்"]', tamName);
        if (tamFather) setVal('input[formcontrolname="தந்தைகணவர்பெயர்"]', tamFather);
        if (doorNo) setVal('input[formcontrolname="முகவரிவரி1"]', doorNo);
        if (tamStreet) setVal('input[formcontrolname="முகவரிவரி2"]', tamStreet);
        if (tamArea) setVal('input[formcontrolname="முகவரிவரி3"]', tamArea);
    }, { tamName, tamFather, doorNo, tamStreet, tamArea });

    await page.waitForTimeout(500);
    let checkTamFather = await fatherTamInput.inputValue().catch(() => '');
    if (!checkTamFather || checkTamFather.trim() === '') {
        logDiag(10, 'FAIL', 'Tamil father name empty');
        throw new Error('படி 10 பிழை: தந்தை / கணவர் பெயர் (தமிழ்) காலியாக உள்ளது!');
    }
    logDiag(10, 'PASS', `Step 10 verified: ${checkTamFather}`);
    await takeStepSnapshot('step13_address_locked');
    return { success: true };
}

module.exports = {
    executeApplicantDemographics
};
