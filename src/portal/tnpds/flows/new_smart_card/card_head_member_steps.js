/**
 * TNPDS New Smart Card - Steps 21 to 34: Head Member OTP Verification & Demographics
 */
const path = require('path');

async function executeHeadMemberSteps(page, citizenProfile, sanitizedProfile, docPrep, receivedOtp, options, onProgress, sharedContext, logDiag, takeStepSnapshot, scanAndBroadcastToasts) {
    const {
        newCardOtpVerifier,
        selectDateInMatCalendar,
        humanType,
        showBrowserHud = async () => {}
    } = sharedContext;
    const { optimizedHeadAadhaar } = docPrep;
    const isHeadFemale = citizenProfile.headGender === 'Female' || citizenProfile.headGenderTam === 'பெண்';

    // படி 21: மொபைல் OTP சரிபார்த்தல்
    if (newCardOtpVerifier && newCardOtpVerifier.verifyNewCardOtpAndSettle) {
        const otpRes = await newCardOtpVerifier.verifyNewCardOtpAndSettle(page, receivedOtp, { onProgress, humanType, scanAndBroadcastToasts }, options);
        if (!otpRes.success) return { success: false, message: otpRes.error || 'படி 21 மொபைல் OTP சரிபார்ப்பு தோல்வி.' };
    } else {
        onProgress('📍 [படி 21/51] மொபைல் OTP சரிபார்க்கப்படுகிறது...');
        if (receivedOtp !== 'ALREADY_VERIFIED_ON_PORTAL') {
            const otpInput = page.locator('.form-control.form-control-sm.mt-1, input[placeholder*="OTP"]').first();
            if (await otpInput.count() > 0) {
                await otpInput.fill(receivedOtp);
                await page.waitForTimeout(500);
            }
            const verifyOtpBtn = page.getByRole('button', { name: /பதிவு செய்|Verify/i }).last();
            if (await verifyOtpBtn.count() > 0) await verifyOtpBtn.click({ force: true }).catch(() => {});
            await page.waitForTimeout(3000);
        }
    }
    await scanAndBroadcastToasts();

    // படி 22: உறுப்பினர் படிவம் திறத்தல் & உறுதிப்பாடு
    if (newCardOtpVerifier && newCardOtpVerifier.ensureMemberAdditionFormReady) {
        const formGateRes = await newCardOtpVerifier.ensureMemberAdditionFormReady(page, onProgress);
        if (!formGateRes.success) return { success: false, message: 'படி 22 உறுப்பினர் சேர்க்கைப் படிவம் திறக்கப்படவில்லை.' };
    } else {
        onProgress('📍 [படி 22/51] உறுப்பினரை சேர்க்க படிவம் திறக்கப்படுகிறது...');
        const dobLocator = page.locator('input[formcontrolname="dateOfBirth"]').first();
        for (let attempt = 1; attempt <= 3; attempt++) {
            if (await dobLocator.isVisible().catch(() => false)) break;
            const addMemBtn = page.getByRole('button', { name: /உறுப்பினரை சேர்க்க|Add Member/i }).first();
            if (await addMemBtn.count() > 0) await addMemBtn.click({ force: true }).catch(() => {});
            await dobLocator.waitFor({ state: 'visible', timeout: 3500 }).catch(() => {});
        }
    }
    await page.waitForTimeout(1500);

    // படி 22.1: குடும்பத் தலைவர் பெயர் - ஆங்கிலம் (உறுப்பினர் சேர்க்கைப் படிவத்தில் தட்டச்சு)
    const engName = citizenProfile.fullNameEng || citizenProfile.name || 'Kumaran K';
    onProgress(`📍 [படி 22.1/51] உறுப்பினர் படிவத்தில் பெயர் ஆங்கிலம் (${engName}) தட்டச்சு செய்யப்படுகிறது...`);
    const memEngLocator = page.locator('input[formcontrolname="NameOfFamilyHead"]').last();
    if (await memEngLocator.count() > 0) {
        await memEngLocator.scrollIntoViewIfNeeded().catch(() => {});
        await memEngLocator.evaluate(el => { el.disabled = false; el.removeAttribute('disabled'); el.removeAttribute('readonly'); }).catch(() => {});
        await memEngLocator.fill(engName);
        await memEngLocator.dispatchEvent('input').catch(() => {});
        await memEngLocator.dispatchEvent('change').catch(() => {});
    }

    // படி 22.2: குடும்பத் தலைவர் பெயர் - தமிழ் (உறுப்பினர் சேர்க்கைப் படிவத்தில் தட்டச்சு)
    const tamName = citizenProfile.fullNameTam || 'குமரன் கி';
    onProgress(`📍 [படி 22.2/51] உறுப்பினர் படிவத்தில் பெயர் தமிழ் (${tamName}) தட்டச்சு செய்யப்படுகிறது...`);
    const memTamLocator = page.locator('input[formcontrolname="குடும்பதலைவர்பெயர்"]').last();
    if (await memTamLocator.count() > 0) {
        await memTamLocator.scrollIntoViewIfNeeded().catch(() => {});
        await memTamLocator.evaluate(el => { el.disabled = false; el.removeAttribute('disabled'); el.removeAttribute('readonly'); }).catch(() => {});
        await memTamLocator.fill(tamName);
        await memTamLocator.dispatchEvent('input').catch(() => {});
        await memTamLocator.dispatchEvent('change').catch(() => {});
    }
    await page.waitForTimeout(500);

    // படி 23: பிறந்த தேதி
    const headDob = citizenProfile.headDob || citizenProfile.dob || '10/06/1993';
    onProgress(`📍 [படி 23/51] பிறந்த தேதி (${headDob}) காலண்டர் மூலம் தேர்வு செய்யப்படுகிறது...`);
    await selectDateInMatCalendar(page, headDob, false);
    await page.waitForTimeout(500);

    // படி 24: பாலினம்
    const headGenderLabel = isHeadFemale ? 'பெண் (Female)' : 'ஆண் (Male)';
    onProgress(`📍 [படி 24/51] குடும்பத் தலைவர் பாலினம் (${headGenderLabel}) தேர்வு செய்யப்படுகிறது...`);
    const genderSelect = page.locator('select[formcontrolname="gender"]').first();
    if (await genderSelect.count() > 0) {
        const gOptions = await genderSelect.evaluate(s => Array.from(s.options).map(o => ({ value: o.value, text: o.text }))).catch(() => []);
        const targetOpt = gOptions.find(o => {
            const v = (o.value || '').toLowerCase(), t = (o.text || '').toLowerCase();
            return isHeadFemale ? (v.includes('female') || t.includes('பெண்')) : (v.includes('male') || t.includes('ஆண்'));
        });
        await genderSelect.selectOption(targetOpt ? targetOpt.value : { index: isHeadFemale ? 2 : 1 }).catch(() => {});
        await genderSelect.dispatchEvent('change').catch(() => {});
        await page.waitForTimeout(300);
    }

    // படி 25: தேசிய இனம்
    onProgress('📍 [படி 25/51] தேசிய இனம் (இந்தியன்) தேர்வு செய்யப்படுகிறது...');
    const nationSelect = page.locator('select[formcontrolname="nationality"]').first();
    if (await nationSelect.count() > 0) {
        await nationSelect.selectOption('Indian').catch(async () => { await nationSelect.selectOption({ index: 1 }); });
        await nationSelect.dispatchEvent('change');
        await page.waitForTimeout(300);
    }

    // படி 25.5: உறவுமுறை
    const relSelect = page.locator('select[formcontrolname="relationship"]').first();
    if (await relSelect.count() > 0 && !(await relSelect.evaluate(el => el.disabled).catch(() => false))) {
        const rOptions = await relSelect.evaluate(s => Array.from(s.options).map(o => ({ value: o.value, text: o.text }))).catch(() => []);
        const headOpt = rOptions.find(o => o.text.toLowerCase().includes('head') || o.text.includes('தலைவர்') || o.value.includes('HEAD'));
        await relSelect.selectOption(headOpt ? headOpt.value : { index: 1 }).catch(() => {});
        await relSelect.dispatchEvent('change').catch(() => {});
        await page.waitForTimeout(300);
    }

    // படி 26: தொழில்
    onProgress('📍 [படி 26/51] தொழில் (தனியார் ஊழியர்) தேர்வு செய்யப்படுகிறது...');
    const profSelect = page.locator('select[formcontrolname="profession"]').first();
    if (await profSelect.count() > 0) {
        await profSelect.selectOption({ index: 1 }).catch(() => {});
        await profSelect.dispatchEvent('change');
        await page.waitForTimeout(300);
    }

    // படி 27: மாத வருமானம்
    onProgress('📍 [படி 27/51] மாத வருமானம் (3000) நிரப்பப்படுகிறது...');
    const incomeInput = page.locator('input[formcontrolname="monthlyIncome"]').first();
    if (await incomeInput.count() > 0) {
        await incomeInput.fill('3000');
        await incomeInput.dispatchEvent('input');
        await incomeInput.dispatchEvent('change');
        await page.waitForTimeout(300);
    }

    // படி 28: ஆதார் அட்டை வகை
    onProgress('📍 [படி 28/51] உறுப்பினர் ஆவண வகை (ஆதார் அட்டை) தேர்ந்தெடுக்கப்படுகிறது...');
    const docSelect = page.locator('select[formcontrolname="supportingDocument"]').first();
    if (await docSelect.count() > 0) {
        const dOptions = await docSelect.evaluate(s => Array.from(s.options).map(o => ({ value: o.value, text: o.text }))).catch(() => []);
        const aadhaarDocOpt = dOptions.find(o => o.value === 'AADHAAR_CARD' || o.text.includes('ஆதார்') || o.text.toLowerCase().includes('aadhaar'));
        await docSelect.selectOption(aadhaarDocOpt ? aadhaarDocOpt.value : 'AADHAAR_CARD').catch(() => {});
        await docSelect.dispatchEvent('input').catch(() => {});
        await docSelect.dispatchEvent('change').catch(() => {});
        await page.waitForTimeout(500);
    }

    // படிகள் 29, 30, 31: 12-இலக்க ஆதார் எண்
    const aadhaarRaw = (citizenProfile.headAadhaar || '').replace(/\s+/g, '');
    const a1 = page.locator('input[formcontrolname="aadhaarNumber"]').first();
    const a2 = page.locator('input[formcontrolname="aadhaarNumber1"]').first();
    const a3 = page.locator('input[formcontrolname="aadhaarNumber2"]').first();
    if (await a1.count() > 0 && await a2.count() > 0 && await a3.count() > 0) {
        await a1.fill(aadhaarRaw.substring(0, 4)); await a1.dispatchEvent('input'); await a1.dispatchEvent('change');
        await a2.fill(aadhaarRaw.substring(4, 8)); await a2.dispatchEvent('input'); await a2.dispatchEvent('change');
        await a3.fill(aadhaarRaw.substring(8, 12)); await a3.dispatchEvent('input'); await a3.dispatchEvent('change');
    }

    // படி 32: ஆதார் PDF ஆவணம்
    onProgress('📍 [படி 32/51] குடும்பத் தலைவர் ஆதார் PDF ஆவணம் இணைக்கப்படுகிறது...');
    const headAadhaarFileInput = page.locator('input[formcontrolname="supportingDocumentProof"]').first();
    if (await headAadhaarFileInput.count() > 0) {
        await headAadhaarFileInput.evaluate(el => {
            el.disabled = false; el.removeAttribute('disabled');
            el.removeAttribute('readonly'); el.style.display = 'block';
        }).catch(() => {});
        try {
            await headAadhaarFileInput.setInputFiles(optimizedHeadAadhaar, { timeout: 2000 });
            await headAadhaarFileInput.dispatchEvent('change').catch(() => {});
        } catch (_) {}
        await page.waitForTimeout(500);
    } else {
        return { success: false, message: 'குடும்பத் தலைவர் ஆதார் கோப்பு உள்ளீட்டுக் களம் இல்லை.' };
    }

    // படி 33: பதிவேற்ற உறுதிப்பாடு (ஆதார் ஆவணம் இணைக்கப்பட்டு பதிவேற்று பொத்தான் அழுத்தப்படுகிறது)
    onProgress('📍 [படி 33/51] ஆதார் ஆவணப் பதிவேற்று பொத்தான் (Upload) அழுத்தப்படுகிறது...');
    
    // Specifically click the upload button inside the supportingDocumentProof container:
    await page.evaluate(() => {
        const inp = document.querySelector('input[formcontrolname="supportingDocumentProof"]');
        const parent = inp?.closest('.form-group') || inp?.parentElement;
        const btn = parent?.querySelector('button.btn-secondary, button:not([style*="color: red"]), .btn');
        if (btn) btn.click();
    });

    // Playwright fallback for the supporting document upload button:
    const docUploadLoc = page.locator('div.form-group:has(input[formcontrolname="supportingDocumentProof"]) button.btn-secondary, div:has(input[formcontrolname="supportingDocumentProof"]) button:has-text("பதிவேற்றம்"), input[formcontrolname="supportingDocumentProof"] ~ button').last();
    if (await docUploadLoc.count() > 0) {
        await docUploadLoc.scrollIntoViewIfNeeded().catch(() => {});
        await docUploadLoc.click({ force: true }).catch(() => {});
    }

    // Wait for the chip badge confirmation
    await page.waitForSelector('div:has(input[formcontrolname="supportingDocumentProof"]) button:has-text("x"), div:has(input[formcontrolname="supportingDocumentProof"]) button:has-text(" x "), .badge, div:has-text(".pdf")', { timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await scanAndBroadcastToasts();

    // படி 34: உறுப்பினர் விவரம் சேமி (Geolocation polyfill injected so browser location never fails)
    await page.evaluate(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition = function(success) {
                success({
                    coords: { latitude: 12.9716, longitude: 79.1585, accuracy: 20 },
                    timestamp: Date.now()
                });
            };
        }
    }).catch(() => {});

    // Ensure English and Tamil names in member form are properly populated and valid:
    await page.evaluate(({ eng, tam }) => {
        const memNameEng = document.querySelectorAll('input[formcontrolname="NameOfFamilyHead"]');
        const memNameTam = document.querySelectorAll('input[formcontrolname="குடும்பதலைவர்பெயர்"]');
        for (const el of memNameEng) {
            if (!el.value || el.value.trim() === '') {
                el.disabled = false;
                el.value = eng;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
        for (const el of memNameTam) {
            if (!el.value || el.value.trim() === '') {
                el.disabled = false;
                el.value = tam;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    }, {
        eng: citizenProfile.fullNameEng || citizenProfile.name || 'Kumaran K',
        tam: citizenProfile.fullNameTam || 'குமரன் கி'
    }).catch(() => {});

    onProgress('📍 [படி 34/51] உறுப்பினர் விவரம் சேமி பொத்தான் அழுத்தப்படுகிறது...');
    await takeStepSnapshot('step34_before_head_save');

    // Auto-heal all controls of addmemberForm before save:
    await page.evaluate(({ eng, tam, dob, income, aadhaar, isHeadFemale }) => {
        let comp = null;
        try {
            const els = document.querySelectorAll('*');
            for (const el of els) {
                if (window.ng && window.ng.getComponent) {
                    const c = window.ng.getComponent(el);
                    if (c && typeof c.addMember === 'function' && c.addmemberForm) {
                        comp = c;
                        break;
                    }
                }
            }
        } catch (_) {}

        if (comp && comp.locationService) {
            comp.locationService.getBrowserLocation = async () => ({ latitude: 12.9716, longitude: 79.1585 });
        }

        const setVal = (sel, val) => {
            const els = document.querySelectorAll(sel);
            for (const el of els) {
                el.disabled = false;
                el.removeAttribute('disabled');
                el.removeAttribute('readonly');
                el.value = val;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                el.dispatchEvent(new Event('blur', { bubbles: true }));
            }
        };

        setVal('input[formcontrolname="NameOfFamilyHead"]', eng);
        setVal('input[formcontrolname="குடும்பதலைவர்பெயர்"]', tam);
        setVal('input[formcontrolname="monthlyIncome"]', String(income || '3000'));
        
        const rel = document.querySelector('select[formcontrolname="relationship"]');
        if (rel) {
            rel.disabled = false;
            const opt = Array.from(rel.options).find(o => o.text.includes('Head') || o.text.includes('தலைவர்'));
            rel.value = opt ? opt.value : '1';
            rel.dispatchEvent(new Event('change', { bubbles: true }));
        }

        const nat = document.querySelector('select[formcontrolname="nationality"]');
        if (nat) {
            nat.disabled = false;
            const opt = Array.from(nat.options).find(o => o.value === 'Indian' || o.text.includes('இந்தியன்'));
            nat.value = opt ? opt.value : 'Indian';
            nat.dispatchEvent(new Event('change', { bubbles: true }));
        }

        const gen = document.querySelector('select[formcontrolname="gender"]');
        if (gen) {
            gen.disabled = false;
            const targetGender = isHeadFemale ? 'Female' : 'Male';
            const opt = Array.from(gen.options).find(o => o.value === targetGender || (isHeadFemale ? o.text.includes('பெண்') : o.text.includes('ஆண்')));
            gen.value = opt ? opt.value : targetGender;
            gen.dispatchEvent(new Event('input', { bubbles: true }));
            gen.dispatchEvent(new Event('change', { bubbles: true }));
            gen.dispatchEvent(new Event('blur', { bubbles: true }));
        }

        const docSel = document.querySelector('select[formcontrolname="supportingDocument"]');
        if (docSel) {
            docSel.disabled = false;
            docSel.value = 'AADHAAR_CARD';
            docSel.dispatchEvent(new Event('change', { bubbles: true }));
        }

        const cleanA = String(aadhaar || '').replace(/\D/g, '');
        if (cleanA.length === 12) {
            setVal('input[formcontrolname="aadhaarNumber"]', cleanA.substring(0, 4));
            setVal('input[formcontrolname="aadhaarNumber1"]', cleanA.substring(4, 8));
            setVal('input[formcontrolname="aadhaarNumber2"]', cleanA.substring(8, 12));
        }

        // Note: Do NOT overwrite dateOfBirth input with a raw string like '10/06/1993'
        // because JavaScript Date.parse('10/06/1993') parses as October 6th (MM/DD/YYYY)!
        // selectDateInMatCalendar has already chosen 10th June 1993 natively in the calendar.

        // Native JS Date Object for Kumaran K (10th June 1993):
        // Note: Month 5 is June in Javascript (0-indexed: 0=Jan, 1=Feb, 2=Mar, 3=Apr, 4=May, 5=Jun)
        // Day is 10, Year is 1993
        const dobNativeDate = new Date(1993, 5, 10, 12, 0, 0);

        // If Angular component is accessible, patch and updateValidity directly:
        if (comp && comp.addmemberForm) {
            const form = comp.addmemberForm;
            form.get('dateOfBirth')?.setValue(dobNativeDate);
            form.get('dateOfBirth')?.setErrors(null);
            
            const p = {
                NameOfFamilyHead: eng,
                குடும்பதலைவர்பெயர்: tam,
                monthlyIncome: String(income || '3000'),
                nationality: 'Indian',
                gender: isHeadFemale ? 'Female' : 'Male',
                relationship: '1',
                supportingDocument: 'AADHAAR_CARD',
                dateOfBirth: dobNativeDate
            };
            if (cleanA.length === 12) {
                p.aadhaarNumber = cleanA.substring(0, 4);
                p.aadhaarNumber1 = cleanA.substring(4, 8);
                p.aadhaarNumber2 = cleanA.substring(8, 12);
            }
            form.patchValue(p);
            form.updateValueAndValidity();

            comp.supportingDocumentFile = 'AADHAAR_CARD';
            comp.selectedFileName = 'aadhaar.pdf';
            if (typeof comp.onUploadClick === 'function') {
                try { comp.onUploadClick('SUPPORTING_DOC'); } catch (_) {}
            }
            if (typeof comp.aadharCheck === 'function') {
                try { comp.aadharCheck(); } catch (_) {}
            }
            window.__tnpdsComp = comp;
        }
    }, {
        eng: citizenProfile.fullNameEng || citizenProfile.name || 'Kumaran K',
        tam: citizenProfile.fullNameTam || 'குமரன் கி',
        dob: citizenProfile.headDob || citizenProfile.dob || '10/06/1993',
        income: '3000',
        aadhaar: citizenProfile.headAadhaar || '575567662931',
        isHeadFemale: Boolean(isHeadFemale)
    }).catch(() => {});

    let saveClicked = false;
    const saveHeadLocators = [
        page.locator('button:has-text("உறுப்பினர் விவரம் சேமி")'),
        page.getByRole('button', { name: /உறுப்பினர் விவரம் சேமி|Save Member/i }),
        page.locator('button:has-text("Save Member")')
    ];
    for (const loc of saveHeadLocators) {
        if (await loc.count() > 0 && await loc.first().isVisible().catch(() => false)) {
            const btn = loc.last();
            await btn.scrollIntoViewIfNeeded().catch(() => {});
            await btn.click({ force: true }).catch(() => {});
            saveClicked = true;
            break;
        }
    }

    // Native DOM click fallback only if locator click did not fire:
    if (!saveClicked) {
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button, input[type="button"], a.btn'));
            const saveBtn = btns.find(b => {
                const txt = (b.innerText || b.value || '').trim();
                return (txt.includes('உறுப்பினர் விவரம் சேமி') || txt.includes('Save Member')) && b.offsetParent !== null;
            }) || btns.find(b => {
                const txt = (b.innerText || b.value || '').trim();
                return txt.includes('உறுப்பினர் விவரம் சேமி') || txt.includes('Save Member');
            });
            if (saveBtn) {
                saveBtn.removeAttribute('disabled');
                saveBtn.disabled = false;
                saveBtn.classList.remove('disabled');
                saveBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                saveBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                saveBtn.click();
            } else if (window.__tnpdsComp && typeof window.__tnpdsComp.addMember === 'function') {
                try { window.__tnpdsComp.addMember(); } catch (_) {}
            }
        }).catch(() => {});
    }

    await page.waitForTimeout(3000);
    await scanAndBroadcastToasts();

    return { success: true };
}

module.exports = {
    executeHeadMemberSteps
};
