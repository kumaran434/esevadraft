/**
 * TNPDS New Smart Card - Additional Member Form Filling & Document Upload
 */
const fs = require('fs');
const path = require('path');
const { normalizeTamilInitialsFromEnglish, ensureBilingualPair } = require('../../../../utils/bilingual_helper');
const { fillAndVerifyInput, selectAndVerifyOption } = require('../../../common/strict_step_gate');

let produceCompliantDocument;
for (const candidate of [
    '../../../../../photo_studio',
    path.join(__dirname, '..', '..', '..', '..', '..', 'photo_studio.js'),
    process.resourcesPath ? path.join(process.resourcesPath, 'photo_studio.js') : ''
].filter(Boolean)) {
    try {
        const ps = require(candidate);
        if (ps && ps.produceCompliantDocument) {
            produceCompliantDocument = ps.produceCompliantDocument;
            break;
        }
    } catch (_) {}
}
if (!produceCompliantDocument) produceCompliantDocument = async (p) => p;

async function fillAdditionalMemberForm(page, mem, memNum, citizenProfile, sanitizedProfile, options, onProgress, sharedContext, logDiag, scanAndBroadcastToasts) {
    const {
        selectDateInMatCalendar,
        requestReplacementFileFromUser = async () => null,
        showBrowserHud = async () => {},
        resolveDocFromOptions = async () => null
    } = sharedContext;
    const isMockSandboxMode = options?.mockSandbox !== false && options?.isMockSandboxMode !== false;
    const { engName, tamName } = sanitizedProfile;

    const isStrictLive = !isMockSandboxMode;

    // 2. பெயர் (ஆங்கிலம்) & 3. பெயர் (தமிழில்) கடுமையான சரிபார்ப்பு (Strict Step Gate)
    const targetMemEng = (mem.nameEng || mem.name || '').trim();
    onProgress(`📍 [உறுப்பினர் ${memNum}] பெயர் ஆங்கிலம் (${targetMemEng}) உள்ளிடப்படுகிறது...`);
    const nameEngInp = page.locator('input[formcontrolname="NameOfFamilyHead"]').nth(1);
    await fillAndVerifyInput(page, nameEngInp, targetMemEng, `உறுப்பினர் ${memNum} (பெயர் - ஆங்கிலம்)`, { required: isStrictLive });
    await page.waitForTimeout(300);

    let targetMemTam = (mem.nameTam || mem.name || '').trim();
    if (targetMemEng && targetMemTam) {
        targetMemTam = normalizeTamilInitialsFromEnglish(targetMemEng, targetMemTam);
    } else if (targetMemEng && !targetMemTam) {
        targetMemTam = ensureBilingualPair(targetMemEng, '').tam;
    }
    onProgress(`📍 [உறுப்பினர் ${memNum}] பெயர் தமிழ் (${targetMemTam}) உள்ளிடப்படுகிறது...`);
    const nameTamInp = page.locator('input[formcontrolname="குடும்பதலைவர்பெயர்"]').nth(1);
    await fillAndVerifyInput(page, nameTamInp, targetMemTam, `உறுப்பினர் ${memNum} (பெயர் - தமிழ்)`, { required: isStrictLive });
    await page.waitForTimeout(300);

    // 1.5 தலைப்பு தேர்வு (Salutation)
    const salEng = page.locator('select[formcontrolname="salutation"]').nth(1);
    if (await salEng.count() > 0) {
        await selectAndVerifyOption(salEng, `உறுப்பினர் ${memNum} (தலைப்பு - ஆங்கிலம்)`, { index: mem.gender === 'Female' ? 2 : 1, required: false });
    }
    const salTam = page.locator('select[formcontrolname="lsalutation"]').nth(1);
    if (await salTam.count() > 0) {
        await selectAndVerifyOption(salTam, `உறுப்பினர் ${memNum} (தலைப்பு - தமிழ்)`, { index: mem.gender === 'Female' ? 2 : 1, required: false });
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

    // 4. பிறந்த தேதி உள்ளீடு + கடுமையான சரிபார்ப்பு
    const memDobVal = mem.dob || '03/06/2000';
    onProgress(`📍 [உறுப்பினர் ${memNum}] பிறந்த தேதி (${memDobVal}) காலண்டர் மூலம் தேர்வு செய்யப்படுகிறது...`);
    await selectDateInMatCalendar(page, memDobVal, true);
    const dobInpMem = page.locator('input[formcontrolname="dateOfBirth"]').last();
    let memDobActual = (await dobInpMem.inputValue().catch(() => '')).trim();
    if (!memDobActual && isStrictLive) {
        await selectDateInMatCalendar(page, memDobVal, true);
        memDobActual = (await dobInpMem.inputValue().catch(() => '')).trim();
        if (!memDobActual) {
            throw new Error(`உறுப்பினர் ${memNum} பிறந்த தேதி (${memDobVal}) காலண்டரில் தேர்வு செய்யப்படவில்லை!`);
        }
    }
    await page.waitForTimeout(400);

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
        await selectAndVerifyOption(genSelect, `உறுப்பினர் ${memNum} (பாலினம்)`, {
            value: targetOpt ? targetOpt.value : null,
            index: targetOpt ? null : (isMemFemale ? 2 : 1),
            required: isStrictLive
        });
        await page.waitForTimeout(250);
    }

    // 6. தேசிய இனம் (இந்தியன்)
    const natSelect = page.locator('select[formcontrolname="nationality"]').last();
    if (await natSelect.count() > 0) {
        await selectAndVerifyOption(natSelect, `உறுப்பினர் ${memNum} (தேசிய இனம்)`, { value: 'Indian', required: isStrictLive }).catch(async () => {
            await selectAndVerifyOption(natSelect, `உறுப்பினர் ${memNum} (தேசிய இனம்)`, { index: 1, required: isStrictLive });
        });
        await page.waitForTimeout(250);
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

    const cleanMemAadhaar = String(mem.aadhaarNumber || '').replace(/\D/g, '');
    const isBirthCertMember = Boolean(
        mem.docType === 'BIRTH_CERTIFICATE' ||
        mem.proofType === 'BIRTH_CERTIFICATE' ||
        mem.hasAadhaar === false ||
        (!cleanMemAadhaar && mem.birthCertificatePath)
    );

    // Compute approximate age from DOB (DD/MM/YYYY) for minor/child detection
    let memAge = 30;
    if (memDobVal && /\d{4}/.test(memDobVal)) {
        const yrMatch = memDobVal.match(/(\d{4})/);
        if (yrMatch) memAge = Math.max(0, new Date().getFullYear() - parseInt(yrMatch[1], 10));
    }

    // 8. தொழில் & வருமானம் (Strict Step Gate)
    const profSelect = page.locator('select[formcontrolname="profession"]').last();
    if (await profSelect.count() > 0) {
        const pOpts = await profSelect.evaluate(s => Array.from(s.options).map(o => ({ value: o.value, text: (o.text || '').trim() }))).catch(() => []);
        if (isBirthCertMember || memAge < 15) {
            const childOpt = pOpts.find(o => /student|child|none|not applicable|மாணவ|குழந்தை|பொருந்தாது|இல்லை/i.test(o.text + ' ' + o.value));
            await selectAndVerifyOption(profSelect, `உறுப்பினர் ${memNum} (தொழில்)`, {
                value: childOpt ? childOpt.value : null,
                index: childOpt ? null : (pOpts.length > 1 ? pOpts.length - 1 : 1),
                required: isStrictLive
            });
        } else {
            await selectAndVerifyOption(profSelect, `உறுப்பினர் ${memNum} (தொழில்)`, { index: 1, required: isStrictLive });
        }
        await page.waitForTimeout(250);
    }

    const incInp = page.locator('input[formcontrolname="monthlyIncome"]').last();
    const memInc = (isBirthCertMember || memAge < 18) ? '0' : String(mem.monthlyIncome || '3000');
    await fillAndVerifyInput(page, incInp, memInc, `உறுப்பினர் ${memNum} (மாத வருமானம்)`, { required: isStrictLive });
    await page.waitForTimeout(250);

    // 9. மற்ற ஆவணங்கள் * (பிறப்புச் சான்றிதழ் vs ஆதார் அட்டை — உறுப்பினருக்கு ஏற்ப 1-to-1 தேர்வு)
    onProgress(`📍 [உறுப்பினர் ${memNum}] ஆவண வகை (${isBirthCertMember ? 'பிறப்புச் சான்றிதழ் - ஆதார் இல்லை' : 'ஆதார் அட்டை'}) தேர்ந்தெடுக்கப்படுகிறது...`);
    const docSelect = page.locator('select[formcontrolname="supportingDocument"]').last();
    if (await docSelect.count() > 0) {
        const dOptions = await docSelect.evaluate(s => Array.from(s.options).map(o => ({ value: o.value, text: o.text }))).catch(() => []);
        const targetDocOpt = isBirthCertMember
            ? dOptions.find(o => o.text.includes('பிறப்பு') || o.text.toLowerCase().includes('birth') || o.value.toLowerCase().includes('birth'))
            : dOptions.find(o => o.text.includes('ஆதார்') || o.text.toLowerCase().includes('aadhaar') || o.value.toLowerCase().includes('aadhaar'));
        await selectAndVerifyOption(docSelect, `உறுப்பினர் ${memNum} (ஆவண வகை)`, {
            value: targetDocOpt ? targetDocOpt.value : null,
            index: targetDocOpt ? null : 1,
            required: isStrictLive
        });
        await page.waitForTimeout(900);
    }

    // 10. 12-இலக்க ஆதார் எண் உள்ளீடு (பிறப்புச் சான்றிதழ் உறுப்பினருக்கு ஆதார் எண் ஒருபோதும் நிரப்பப்படாது!)
    const a1 = page.locator('input[formcontrolname="aadhaarNumber"]').last();
    const a2 = page.locator('input[formcontrolname="aadhaarNumber1"]').last();
    const a3 = page.locator('input[formcontrolname="aadhaarNumber2"]').last();

    if (isBirthCertMember) {
        onProgress(`👶 [உறுப்பினர் ${memNum}] பிறப்புச் சான்றிதழ் உறுப்பினர் — ஆதார் எண் பெட்டிகள் காலியாக வைக்கப்படுகின்றன.`);
        if (await a1.count() > 0 && await a1.isVisible().catch(() => false)) {
            await a1.fill('').catch(() => {});
            await a2.fill('').catch(() => {});
            await a3.fill('').catch(() => {});
        }
    } else {
        let validMemAadhaar = cleanMemAadhaar;
        if (validMemAadhaar.length !== 12 && isMockSandboxMode) {
            validMemAadhaar = '491436223971';
        }
        if (validMemAadhaar.length !== 12) {
            const errMsg = `உறுப்பினர் ${memNum} (${targetMemTam || targetMemEng}) 12-இலக்க ஆதார் எண் இல்லை! வேறொருவரின் ஆதார் எண்ணைப் பயன்படுத்தாமல், Edit Modal-ல் சரியான ஆதார் எண் (அல்லது குழந்தை எனில் பிறப்புச் சான்றிதழ்) தேர்ந்தெடுக்கவும்.`;
            onProgress(`🛑 **பிழை:** ${errMsg}`);
            return { success: false, message: errMsg };
        }
        const mPart1 = validMemAadhaar.substring(0, 4);
        const mPart2 = validMemAadhaar.substring(4, 8);
        const mPart3 = validMemAadhaar.substring(8, 12);

        onProgress(`📍 [உறுப்பினர் ${memNum}] 12-இலக்க ஆதார் எண் (${mPart1} ${mPart2} ${mPart3}) உள்ளிடப்படுகிறது...`);
        await fillAndVerifyInput(page, a1, mPart1, `உறுப்பினர் ${memNum} (ஆதார் பகுதி 1)`, { required: isStrictLive });
        await fillAndVerifyInput(page, a2, mPart2, `உறுப்பினர் ${memNum} (ஆதார் பகுதி 2)`, { required: isStrictLive });
        await fillAndVerifyInput(page, a3, mPart3, `உறுப்பினர் ${memNum} (ஆதார் பகுதி 3)`, { required: isStrictLive });
    }
    await page.waitForTimeout(500);

    // 11. உறுப்பினர் ஆவண PDF தேர்வு செய்து இணைத்தல் (Strict Per-Member Resolution — NEVER steal Head/Other Member doc!)
    const targetIdx = Math.max(0, memNum - 2);
    const indexedSlotDoc = citizenProfile.documents?.[`memberDoc_${memNum - 1}`] || citizenProfile.documents?.[`memberAadhaar${targetIdx}`];
    let rawMemDoc = null;
    if (mem.docPath && fs.existsSync(mem.docPath)) rawMemDoc = mem.docPath;
    else if (mem.birthCertificatePath && fs.existsSync(mem.birthCertificatePath)) rawMemDoc = mem.birthCertificatePath;
    else if (indexedSlotDoc && fs.existsSync(indexedSlotDoc)) rawMemDoc = indexedSlotDoc;
    if (!rawMemDoc) {
        rawMemDoc = await resolveDocFromOptions(mem.docPath || indexedSlotDoc || null, options, citizenProfile, 'memberAadhaar', targetIdx);
    }
    if (!rawMemDoc && isMockSandboxMode) rawMemDoc = path.join(__dirname, 'uploads', 'priya_sister_aadhaar.pdf');

    if (!rawMemDoc || !fs.existsSync(rawMemDoc)) {
        if (!isMockSandboxMode) {
            const docLabel = isBirthCertMember ? 'பிறப்புச் சான்றிதழ் (Birth Certificate)' : 'ஆதார்';
            onProgress(`⚠️ **[கடும் புலக் கட்டுப்பாடு]** உறுப்பினர் ${memNum} (${targetMemTam || targetMemEng || ''}) அசல் ${docLabel} PDF தேவைப்படுகிறது...`);
            const replacement = await requestReplacementFileFromUser(
                `⚠️ உறுப்பினர் ${memNum} (${targetMemTam || targetMemEng || ''}) ${docLabel} PDF ஆவணத்தைத் தேர்ந்தெடுக்கவும்:`,
                onProgress, isBirthCertMember ? `MEMBER_${memNum}_BIRTH_CERT` : `MEMBER_${memNum}_AADHAAR`
            );
            if (replacement && fs.existsSync(replacement)) rawMemDoc = replacement;
            else {
                const gateErrorMsg = `கடுமையான புலக் கட்டுப்பாடு (Field Gate): உறுப்பினர் ${memNum} ${docLabel} ஆவணம் இணைக்கப்படவில்லை!`;
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
    onProgress(`📍 [உறுப்பினர் ${memNum}] ${isBirthCertMember ? 'பிறப்புச் சான்றிதழ்' : 'ஆதார்'} PDF கோப்பு (${path.basename(memPdf)}) இணைக்கப்படுகிறது...`);
    await showBrowserHud(`📄 [உறுப்பினர் ${memNum}] ${isBirthCertMember ? 'பிறப்புச் சான்றிதழ்' : 'ஆதார்'} PDF இணைக்கப்படுகிறது...`, 'தயவுசெய்து காத்திருக்கவும் • நீங்கள் எதுவும் செய்ய வேண்டாம்!', 'warning');
    
    const aadhaarFileInput = page.locator('input[formcontrolname="supportingDocumentProof"]').last();
    if (await aadhaarFileInput.count() > 0) {
        await aadhaarFileInput.evaluate(el => {
            el.disabled = false; el.removeAttribute('disabled');
            el.removeAttribute('readonly'); el.readOnly = false;
            el.style.display = 'block'; el.style.opacity = '1'; el.style.visibility = 'visible';
        }).catch(() => {});
        try {
            await aadhaarFileInput.setInputFiles(memPdf, { timeout: 2000 });
            await aadhaarFileInput.dispatchEvent('change').catch(() => {});
        } catch (e) {
            console.warn('[Member Aadhaar Upload] setInputFiles timed out or failed:', e.message);
        }
        await page.waitForTimeout(500);
    } else {
        onProgress(`⚠️ **பிழை:** உறுப்பினர் ${memNum} ஆதார் கோப்பு உள்ளீட்டுக் களம் கிடைக்கவில்லை!`);
        return { success: false, message: `உறுப்பினர் ${memNum} கோப்பு உள்ளீட்டுக் களம் இல்லை.` };
    }

    return { success: true, memPdf, targetRelTam, targetRelEng, isBirthCertMember };
}

module.exports = {
    fillAdditionalMemberForm
};
