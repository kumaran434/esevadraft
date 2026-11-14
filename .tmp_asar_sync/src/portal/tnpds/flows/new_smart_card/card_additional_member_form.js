/**
 * TNPDS New Smart Card - Additional Member Form Filling & Document Upload
 */
const fs = require('fs');
const path = require('path');

let produceCompliantDocument;
try {
    const ps = require('../../../../photo_studio');
    produceCompliantDocument = ps.produceCompliantDocument;
} catch (e) {
    produceCompliantDocument = async (p) => p;
}

async function fillAdditionalMemberForm(page, mem, memNum, citizenProfile, sanitizedProfile, options, onProgress, sharedContext, logDiag, scanAndBroadcastToasts) {
    const {
        selectDateInMatCalendar,
        requestReplacementFileFromUser = async () => null,
        showBrowserHud = async () => {},
        resolveDocFromOptions = async () => null
    } = sharedContext;
    const isMockSandboxMode = options?.mockSandbox !== false && options?.isMockSandboxMode !== false;
    const { engName, tamName } = sanitizedProfile;

    // 2. பெயர் (ஆங்கிலம்) உள்ளீடு & சரிபார்ப்பு பூட்டு (STRICTLY nth(1) — NEVER touch nth(0) Section 1 Head!)
    const targetMemEng = (mem.nameEng || mem.name || '').trim();
    onProgress(`📍 [உறுப்பினர் ${memNum}] பெயர் (${targetMemEng}) உள்ளிடப்படுகிறது...`);
    const nameEngInp = page.locator('input[formcontrolname="NameOfFamilyHead"]').nth(1);
    
    await nameEngInp.evaluate(el => {
        el.disabled = false; el.removeAttribute('disabled');
        el.readOnly = false; el.removeAttribute('readonly');
    });
    await nameEngInp.click({ force: true });
    await nameEngInp.fill(targetMemEng);
    await nameEngInp.dispatchEvent('input');
    await nameEngInp.dispatchEvent('change');
    await page.waitForTimeout(600);

    // 3. பெயர் (தமிழில்) உள்ளீடு & சரிபார்ப்பு பூட்டு
    const targetMemTam = (mem.nameTam || mem.name || '').trim();
    onProgress(`📍 [உறுப்பினர் ${memNum}] பெயர் தமிழ் (${targetMemTam}) உள்ளிடப்படுகிறது...`);
    const nameTamInp = page.locator('input[formcontrolname="குடும்பதலைவர்பெயர்"]').nth(1);
    
    await nameTamInp.evaluate((el, val) => {
        el.disabled = false; el.removeAttribute('disabled');
        el.readOnly = false; el.removeAttribute('readonly');
        el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
    }, targetMemTam);
    await page.waitForTimeout(300);

    // 1.5 தலைப்பு தேர்வு (Salutation)
    const salEng = page.locator('select[formcontrolname="salutation"]').nth(1);
    if (await salEng.count() > 0) {
        await salEng.evaluate(el => { el.disabled = false; el.removeAttribute('disabled'); });
        const optIdx = mem.gender === 'Female' ? 2 : 1;
        await salEng.selectOption({ index: optIdx }).catch(() => {});
        await salEng.dispatchEvent('change');
    }
    const salTam = page.locator('select[formcontrolname="lsalutation"]').nth(1);
    if (await salTam.count() > 0) {
        await salTam.evaluate(el => { el.disabled = false; el.removeAttribute('disabled'); });
        const optIdx = mem.gender === 'Female' ? 2 : 1;
        await salTam.selectOption({ index: optIdx }).catch(() => {});
        await salTam.dispatchEvent('change');
    }

    // Ironclad Safeguard: Verify Section 1 Family Head was NOT modified!
    const curHeadEng = await page.locator('input[formcontrolname="NameOfFamilyHead"]').first().inputValue().catch(() => '');
    const curHeadTam = await page.locator('input[formcontrolname="குடும்பதலைவர்பெயர்"]').first().inputValue().catch(() => '');
    if (curHeadEng !== engName || curHeadTam !== tamName) {
        console.warn(`[Safeguard] Restoring Section 1 Head name: ${engName} / ${tamName}`);
        await page.locator('input[formcontrolname="NameOfFamilyHead"]').first().fill(engName);
        await page.evaluate(({ tamName }) => {
            const el = document.querySelector('input[formcontrolname="குடும்பதலைவர்பெயர்"]');
            if (el) {
                el.value = tamName;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }, { tamName });
    }

    // 4. பிறந்த தேதி உள்ளீடு (Calendar)
    const memDobVal = mem.dob || '03/06/2000';
    onProgress(`📍 [உறுப்பினர் ${memNum}] பிறந்த தேதி (${memDobVal}) காலண்டர் மூலம் தேர்வு செய்யப்படுகிறது...`);
    await selectDateInMatCalendar(page, memDobVal, true);
    await page.waitForTimeout(500);

    // 5. பாலினம் (Male / Female)
    const isMemFemale = mem.gender === 'Female' || (mem.genderTam && mem.genderTam.includes('பெண்'));
    const genSelect = page.locator('select[formcontrolname="gender"]').last();
    if (await genSelect.count() > 0) {
        const gOptions = await genSelect.evaluate(s => Array.from(s.options).map(o => ({ value: o.value, text: o.text }))).catch(() => []);
        const targetOpt = gOptions.find(o => {
            const t = (o.text || '').toLowerCase();
            const v = (o.value || '').toLowerCase();
            return isMemFemale ? (v.includes('female') || t.includes('பெண்') || t.includes('female')) : (v.includes('male') || t.includes('ஆண்') || t.includes('male'));
        });
        if (targetOpt) {
            await genSelect.selectOption(targetOpt.value).catch(() => {});
        } else {
            await genSelect.selectOption({ index: isMemFemale ? 2 : 1 }).catch(() => {});
        }
        await genSelect.dispatchEvent('change').catch(() => {});
        await page.waitForTimeout(300);
    }

    // 6. தேசிய இனம் (இந்தியன்)
    const natSelect = page.locator('select[formcontrolname="nationality"]').last();
    if (await natSelect.count() > 0) {
        await natSelect.selectOption('Indian').catch(async () => {
            await natSelect.selectOption({ index: 1 });
        });
        await natSelect.dispatchEvent('change');
        await page.waitForTimeout(300);
    }

    // 7. உறவுமுறை தேர்வு
    const targetRelTam = mem.relationshipTam || '';
    const targetRelEng = mem.relationshipEng || mem.relationship || '';
    onProgress(`📍 [உறுப்பினர் ${memNum}] உறவுமுறை (${targetRelTam || targetRelEng}) தேர்ந்தெடுக்கப்படுகிறது...`);
    const relSelect = page.locator('select[formcontrolname="relationship"]').last();
    if (await relSelect.count() > 0) {
        const rOptions = await relSelect.evaluate(s => Array.from(s.options).map(o => ({ value: o.value, text: o.text }))).catch(() => []);
        const rTamLower = (targetRelTam || '').toLowerCase();
        const rEngLower = (targetRelEng || '').toLowerCase();

        let targetOpt = rOptions.find(o => {
            const ot = (o.text || '').toLowerCase();
            const ov = (o.value || '').toLowerCase();
            return (rTamLower && ot.includes(rTamLower)) || (rEngLower && (ot.includes(rEngLower) || ov.includes(rEngLower)));
        });

        if (!targetOpt) {
            const keywords = [
                { keys: ['கணவர்', 'husband'], match: o => o.text.includes('கணவர்') || o.text.toLowerCase().includes('husband') || o.value.toLowerCase().includes('husband') },
                { keys: ['மனைவி', 'wife'], match: o => o.text.includes('மனைவி') || o.text.toLowerCase().includes('wife') || o.value.toLowerCase().includes('wife') },
                { keys: ['தந்தை', 'father'], match: o => o.text.includes('தந்தை') || o.text.toLowerCase().includes('father') || o.value.toLowerCase().includes('father') },
                { keys: ['தாய்', 'mother'], match: o => o.text.includes('தாய்') || o.text.toLowerCase().includes('mother') || o.value.toLowerCase().includes('mother') },
                { keys: ['மகன்', 'son'], match: o => o.text.includes('மகன்') || o.text.toLowerCase().includes('son') || o.value.toLowerCase().includes('son') },
                { keys: ['மகள்', 'daughter'], match: o => o.text.includes('மகள்') || o.text.toLowerCase().includes('daughter') || o.value.toLowerCase().includes('daughter') },
                { keys: ['சகோதரன்', 'brother'], match: o => o.text.includes('சகோதரன்') || o.text.toLowerCase().includes('brother') || o.value.toLowerCase().includes('brother') },
                { keys: ['சகோதரி', 'sister'], match: o => o.text.includes('சகோதரி') || o.text.toLowerCase().includes('sister') || o.value.toLowerCase().includes('sister') }
            ];
            for (const kw of keywords) {
                if (kw.keys.some(k => rTamLower.includes(k) || rEngLower.includes(k))) {
                    targetOpt = rOptions.find(kw.match);
                    if (targetOpt) break;
                }
            }
        }

        if (targetOpt) {
            await relSelect.selectOption(targetOpt.value).catch(() => {});
            await relSelect.dispatchEvent('change').catch(() => {});
        } else {
            onProgress(`⚠️ **கடும் பூட்டு நிறுத்தம்:** உறுப்பினர் ${memNum} உறவுமுறை (${targetRelTam || targetRelEng}) தேர்வு செய்யப்படவில்லை!`);
            return { success: false, message: `உறுப்பினர் ${memNum} உறவுமுறை தேர்வு தோல்வி.` };
        }
        await page.waitForTimeout(300);
    }

    // 8. தொழில் & வருமானம்
    const profSelect = page.locator('select[formcontrolname="profession"]').last();
    if (await profSelect.count() > 0) {
        await profSelect.selectOption({ index: 1 }).catch(() => {});
        await profSelect.dispatchEvent('change');
        await page.waitForTimeout(300);
    }

    const incInp = page.locator('input[formcontrolname="monthlyIncome"]').last();
    if (await incInp.count() > 0) {
        await incInp.fill('3000');
        await incInp.dispatchEvent('input');
        await incInp.dispatchEvent('change');
        await page.waitForTimeout(300);
    }

    // 9. மற்ற ஆவணங்கள் * (ஆதார் அட்டை) தேர்வு
    onProgress(`📍 [உறுப்பினர் ${memNum}] ஆவண வகை (ஆதார் அட்டை) தேர்ந்தெடுக்கப்பட்டு ஆதார் பெட்டிகள் திறக்கப்படுகின்றன...`);
    const docSelect = page.locator('select[formcontrolname="supportingDocument"]').last();
    if (await docSelect.count() > 0) {
        const dOptions = await docSelect.evaluate(s => Array.from(s.options).map(o => ({ value: o.value, text: o.text }))).catch(() => []);
        const aadhaarDocOpt = dOptions.find(o => o.text.includes('ஆதார்') || o.text.toLowerCase().includes('aadhaar') || o.value.toLowerCase().includes('aadhaar'));
        if (aadhaarDocOpt) {
            await docSelect.selectOption(aadhaarDocOpt.value).catch(() => {});
        } else if (dOptions.length > 1) {
            await docSelect.selectOption({ index: 1 }).catch(() => {});
        }
        await docSelect.dispatchEvent('change').catch(() => {});
        await page.waitForTimeout(1000);
    }

    // 10. 12-இலக்க ஆதார் எண் உள்ளீடு
    const mAadhaarRaw = (mem.aadhaarNumber || '491436223971').replace(/\D/g, '').padEnd(12, '1');
    const mPart1 = mAadhaarRaw.substring(0, 4);
    const mPart2 = mAadhaarRaw.substring(4, 8);
    const mPart3 = mAadhaarRaw.substring(8, 12);

    onProgress(`📍 [உறுப்பினர் ${memNum}] 12-இலக்க ஆதார் எண் (${mPart1} ${mPart2} ${mPart3}) உள்ளிடப்படுகிறது...`);
    const a1 = page.locator('input[formcontrolname="aadhaarNumber"]').last();
    const a2 = page.locator('input[formcontrolname="aadhaarNumber1"]').last();
    const a3 = page.locator('input[formcontrolname="aadhaarNumber2"]').last();

    if (await a1.count() > 0 && await a2.count() > 0 && await a3.count() > 0) {
        await a1.fill(mPart1); await a1.dispatchEvent('input'); await a1.dispatchEvent('change');
        await a2.fill(mPart2); await a2.dispatchEvent('input'); await a2.dispatchEvent('change');
        await a3.fill(mPart3); await a3.dispatchEvent('input'); await a3.dispatchEvent('change');
    }
    await page.waitForTimeout(500);

    // 11. ஆதார் PDF ஆவணம் தேர்வு செய்து இணைத்தல்
    const targetIdx = Math.max(0, memNum - 2);
    let rawMemDoc = null;
    if (mem.docPath && fs.existsSync(mem.docPath)) rawMemDoc = mem.docPath;
    if (!rawMemDoc) rawMemDoc = await resolveDocFromOptions(options, 'memberAadhaar', targetIdx);
    if (!rawMemDoc && isMockSandboxMode) rawMemDoc = path.join(__dirname, 'uploads', 'priya_sister_aadhaar.pdf');

    if (!rawMemDoc || !fs.existsSync(rawMemDoc)) {
        if (!isMockSandboxMode) {
            onProgress(`⚠️ **[கடும் புலக் கட்டுப்பாடு]** உறுப்பினர் ${memNum} (${mem.nameTam || mem.nameEng || ''}) அசல் ஆதார் PDF தேவைப்படுகிறது...`);
            const replacement = await requestReplacementFileFromUser(
                `⚠️ உறுப்பினர் ${memNum} (${mem.nameTam || mem.nameEng || ''}) ஆதார் PDF ஆவணத்தைத் தேர்ந்தெடுக்கவும்:`,
                onProgress, `MEMBER_${memNum}_AADHAAR`
            );
            if (replacement && fs.existsSync(replacement)) rawMemDoc = replacement;
            else {
                const gateErrorMsg = `கடுமையான புலக் கட்டுப்பாடு (Field Gate): உறுப்பினர் ${memNum} ஆதார் ஆவணம் இணைக்கப்படவில்லை!`;
                onProgress(`🛑 **பிழை:** ${gateErrorMsg}`);
                logDiag(11, 'FAIL', gateErrorMsg);
                throw new Error(gateErrorMsg);
            }
        } else {
            rawMemDoc = path.join(__dirname, 'uploads', 'priya_sister_aadhaar.pdf');
        }
    }

    let memPdf = rawMemDoc;
    if (rawMemDoc && fs.existsSync(rawMemDoc)) {
        try { memPdf = await produceCompliantDocument(rawMemDoc); } catch (e) { memPdf = rawMemDoc; }
    }
    onProgress(`📍 [உறுப்பினர் ${memNum}] ஆதார் PDF கோப்பு (${path.basename(memPdf)}) இணைக்கப்படுகிறது...`);
    await showBrowserHud(`📄 [உறுப்பினர் ${memNum}] ஆதார் PDF இணைக்கப்படுகிறது...`, 'தயவுசெய்து காத்திருக்கவும் • நீங்கள் எதுவும் செய்ய வேண்டாம்!', 'warning');
    
    const aadhaarFileInput = page.locator('input[formcontrolname="supportingDocumentProof"]').last();
    if (await aadhaarFileInput.count() > 0) {
        await aadhaarFileInput.evaluate(el => {
            el.disabled = false; el.removeAttribute('disabled');
            el.removeAttribute('readonly'); el.readOnly = false;
            el.style.display = 'block'; el.style.opacity = '1'; el.style.visibility = 'visible';
        }).catch(() => {});
        try {
            await aadhaarFileInput.setInputFiles(memPdf, { timeout: 2000 });
        } catch (e) {
            console.warn('[Member Aadhaar Upload] setInputFiles timed out or failed:', e.message);
        }
        await page.waitForTimeout(500);
    } else {
        onProgress(`⚠️ **பிழை:** உறுப்பினர் ${memNum} ஆதார் கோப்பு உள்ளீட்டுக் களம் கிடைக்கவில்லை!`);
        return { success: false, message: `உறுப்பினர் ${memNum} கோப்பு உள்ளீட்டுக் களம் இல்லை.` };
    }

    return { success: true, memPdf, targetRelTam, targetRelEng };
}

module.exports = {
    fillAdditionalMemberForm
};
