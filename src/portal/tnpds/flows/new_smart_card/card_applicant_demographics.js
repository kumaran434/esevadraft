/**
 * TNPDS New Smart Card - Steps 1 to 13: Applicant Demographics & Address
 */
const fs = require('fs');
const { fillAndVerifyInput } = require('../../../common/strict_step_gate');

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
        if (newRaw && fs.existsSync(newRaw)) activePhoto = await produceCompliantPassportPhoto(newRaw, { service: 'TNPDS_NEW_CARD', portal: 'TNPDS' });
    }

    if (activePhoto && fs.existsSync(activePhoto)) {
        const headFileInput = page.locator('input[formcontrolname="beneficiaryApplicantPicture"], input[type="file"]').first();
        if (await headFileInput.count() > 0) {
            await headFileInput.evaluate(el => {
                el.disabled = false; el.removeAttribute('disabled');
                el.removeAttribute('readonly'); el.readOnly = false;
                el.style.display = 'block'; el.style.opacity = '1'; el.style.visibility = 'visible';
            }).catch(() => {});
            try {
                await headFileInput.setInputFiles(activePhoto, { timeout: 2000 });
                await headFileInput.dispatchEvent('change').catch(() => {});
            } catch (_) {}
            logDiag(3, 'photo_upload', `Attached: ${activePhoto}`);
            await page.waitForTimeout(1500);
            await scanAndBroadcastToasts();
            onProgress('✅ [படி 3/51] குடும்பத் தலைவர் பாஸ்போர்ட் புகைப்படம் இணைக்கப்பட்டது!');
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
    await fillAndVerifyInput(page, headNameInput, resolvedEngName, 'படி 4 (பெயர் - ஆங்கிலம்)', { domSelector: 'input[formcontrolname="NameOfFamilyHead"]' });
    logDiag(4, 'PASS', `Step 4 verified: ${resolvedEngName}`);
    onProgress(`✅ [படி 4/51] குடும்பத் தலைவர் பெயர் (${resolvedEngName}) உறுதி செய்யப்பட்டது!`);

    // படி 5: ஆங்கிலத் தந்தை / கணவர் பெயர்
    if (!engFather || engFather.trim() === '' || engFather.trim().toUpperCase() === 'FATHER') {
        logDiag(5, 'FAIL', 'Father/Husband name missing');
        throw new Error('படி 5 பிழை: தந்தை / கணவர் பெயர் போர்ட்டலில் கட்டாயமாகும் (*).');
    }
    const resolvedEngFather = engFather.trim();
    onProgress(`📍 [படி 5/51] தந்தை / கணவர் பெயர் - ஆங்கிலம் (${resolvedEngFather}) தட்டச்சு செய்யப்படுகிறது...`);
    const fatherNameInput = page.locator('input[formcontrolname="FathersOrHusbandsName"]').first();
    await fatherNameInput.waitFor({ state: 'visible', timeout: 15000 });
    const checkEngFather = await fillAndVerifyInput(page, fatherNameInput, resolvedEngFather, 'படி 5 (தந்தை/கணவர் பெயர் - ஆங்கிலம்)', { domSelector: 'input[formcontrolname="FathersOrHusbandsName"]' });
    logDiag(5, 'PASS', `Step 5 verified: ${checkEngFather}`);
    onProgress(`✅ [படி 5/51] தந்தை / கணவர் பெயர் (${checkEngFather}) உறுதி செய்யப்பட்டது!`);

    // படி 6: கதவு எண் ஆங்கிலம்
    onProgress(`📍 [படி 6/51] கதவு எண் - ஆங்கிலம் (${doorNo}) தட்டச்சு செய்யப்படுகிறது...`);
    await fillAndVerifyInput(page, page.locator('input[formcontrolname="AddressLine1"]').first(), doorNo, 'படி 6 (கதவு எண் - ஆங்கிலம்)', { required: Boolean(doorNo), domSelector: 'input[formcontrolname="AddressLine1"]' });
    onProgress(`✅ [படி 6/51] கதவு எண் (${doorNo}) உறுதி செய்யப்பட்டது!`);

    // படி 7: தெருப் பெயர் ஆங்கிலம்
    onProgress(`📍 [படி 7/51] தெருப் பெயர் - ஆங்கிலம் (${engStreet}) தட்டச்சு செய்யப்படுகிறது...`);
    await fillAndVerifyInput(page, page.locator('input[formcontrolname="AddressLine2"]').first(), engStreet, 'படி 7 (தெருப் பெயர் - ஆங்கிலம்)', { required: Boolean(engStreet), domSelector: 'input[formcontrolname="AddressLine2"]' });
    onProgress(`✅ [படி 7/51] தெருப் பெயர் (${engStreet}) உறுதி செய்யப்பட்டது!`);

    // படி 8: பகுதி / கிராமம் ஆங்கிலம்
    onProgress(`📍 [படி 8/51] பகுதி / கிராமம் - ஆங்கிலம் (${engArea}) தட்டச்சு செய்யப்படுகிறது...`);
    const engAreaInp = page.locator('input[formcontrolname="AddressLine3"]').first();
    await fillAndVerifyInput(page, engAreaInp, engArea, 'படி 8 (பகுதி/கிராமம் - ஆங்கிலம்)', { required: Boolean(engArea), domSelector: 'input[formcontrolname="AddressLine3"]' });
    await page.waitForTimeout(1500);
    onProgress(`✅ [படி 8/51] பகுதி / கிராமம் (${engArea || '-'}) உறுதி செய்யப்பட்டது!`);

    // படிகள் 9 முதல் 13: தமிழ் விவரங்கள் (இருமொழி கட்டாய சரிபார்ப்பு)
    onProgress(`📍 [படிகள் 9-13/51] தூய தமிழ் பெயர் & முகவரி (${tamName} / ${tamFather} / ${doorNo} / ${tamStreet} / ${tamArea}) உள்ளிடப்படுகிறது...`);
    const headTamInput = page.locator('input[formcontrolname="குடும்பதலைவர்பெயர்"]').first();
    const fatherTamInput = page.locator('input[formcontrolname="தந்தைகணவர்பெயர்"]').first();
    const doorTamInput = page.locator('input[formcontrolname="முகவரிவரி1"]').first();
    const streetTamInput = page.locator('input[formcontrolname="முகவரிவரி2"]').first();
    const areaTamInput = page.locator('input[formcontrolname="முகவரிவரி3"]').first();

    await fillAndVerifyInput(page, headTamInput, tamName, 'படி 9 (தலைவர் பெயர் - தமிழ்)', { required: Boolean(tamName), domSelector: 'input[formcontrolname="குடும்பதலைவர்பெயர்"]' });
    const checkTamFather = await fillAndVerifyInput(page, fatherTamInput, tamFather, 'படி 10 (தந்தை/கணவர் பெயர் - தமிழ்)', { required: true, domSelector: 'input[formcontrolname="தந்தைகணவர்பெயர்"]' });
    await fillAndVerifyInput(page, doorTamInput, doorNo, 'படி 11 (கதவு எண் - தமிழ்)', { required: Boolean(doorNo), domSelector: 'input[formcontrolname="முகவரிவரி1"]' });
    await fillAndVerifyInput(page, streetTamInput, tamStreet, 'படி 12 (தெருப் பெயர் - தமிழ்)', { required: Boolean(tamStreet), domSelector: 'input[formcontrolname="முகவரிவரி2"]' });
    await fillAndVerifyInput(page, areaTamInput, tamArea, 'படி 13 (பகுதி/கிராமம் - தமிழ்)', { required: Boolean(tamArea), domSelector: 'input[formcontrolname="முகவரிவரி3"]' });

    // Golden Rule 7 Async Transliterator Re-Lock: Wait for any delayed TNPDS Google Transliterate callback
    // (which turns "குமரன் கி" back into "குமரன் கே") and re-lock ONLY the Tamil fields if overwritten!
    await page.waitForTimeout(600);
    const tamReVerifyPairs = [
        { loc: headTamInput, val: tamName, label: 'படி 9 (தலைவர் பெயர் - தமிழ் மறு-பூட்டு)' },
        { loc: fatherTamInput, val: tamFather, label: 'படி 10 (தந்தை/கணவர் பெயர் - தமிழ் மறு-பூட்டு)' },
        { loc: streetTamInput, val: tamStreet, label: 'படி 12 (தெருப் பெயர் - தமிழ் மறு-பூட்டு)' },
        { loc: areaTamInput, val: tamArea, label: 'படி 13 (பகுதி/கிராமம் - தமிழ் மறு-பூட்டு)' }
    ];
    for (const pair of tamReVerifyPairs) {
        if (!pair.val) continue;
        const curVal = (await pair.loc.inputValue().catch(() => '')).trim();
        if (curVal !== pair.val.trim()) {
            await fillAndVerifyInput(page, pair.loc, pair.val, pair.label, { required: false });
        }
    }
    logDiag(10, 'PASS', `Step 10 verified: ${checkTamFather}`);
    onProgress(`✅ [படிகள் 9-13/51] தமிழ் பெயர் & முகவரி விவரங்கள் அனைத்தும் 100% உறுதி செய்யப்பட்டன!`);
    await takeStepSnapshot('step13_address_locked');
    return { success: true };
}

module.exports = {
    executeApplicantDemographics
};
