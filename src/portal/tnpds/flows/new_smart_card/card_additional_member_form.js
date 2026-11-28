/**
 * TNPDS New Smart Card - Additional Member Form Filling & Document Upload
 */
const fs = require('fs');
const path = require('path');
const { normalizeTamilInitialsFromEnglish, ensureBilingualPair } = require('../../../../utils/bilingual_helper');
const { fillAndVerifyInput, selectAndVerifyOption } = require('../../../common/strict_step_gate');
const { findBestRelationshipOption } = require('../../helpers/relationship_matcher');

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

    // 2. பெயர் (ஆங்கிலம்) & 3. பெயர் (தமிழில்) கடுமையான சரிபார்ப்பு (Strict Step Gate — collapse multi-spaces!)
    const targetMemEng = (mem.nameEng || mem.name || '').replace(/\s+/g, ' ').trim();
    onProgress(`📍 [உறுப்பினர் ${memNum}] பெயர் ஆங்கிலம் (${targetMemEng}) உள்ளிடப்படுகிறது...`);
    const nameEngInp = page.locator('input[formcontrolname="NameOfFamilyHead"]').nth(1);
    await fillAndVerifyInput(page, nameEngInp, targetMemEng, `உறுப்பினர் ${memNum} (பெயர் - ஆங்கிலம்)`, { required: isStrictLive });
    // Wait for TNPDS automatic phonetic Tamil transliterator to settle BEFORE writing verified Tamil name
    await page.waitForTimeout(500);

    let targetMemTam = (mem.nameTam || mem.name || '').replace(/\s+/g, ' ').trim();
    const isMemOperatorEdited = Boolean(mem._editedInModal || citizenProfile._editedInModalAt);
    const memHasBareLatinInit = /(?:^|\s|\.)[A-Za-z](?:\.|\s|$)/.test(targetMemTam);
    if (targetMemEng && targetMemTam) {
        if (!isMemOperatorEdited || !/[\u0B80-\u0BFF]/.test(targetMemTam) || memHasBareLatinInit) {
            targetMemTam = normalizeTamilInitialsFromEnglish(targetMemEng, targetMemTam);
        }
    } else if (targetMemEng && !targetMemTam) {
        targetMemTam = ensureBilingualPair(targetMemEng, '').tam;
    }
    onProgress(`📍 [உறுப்பினர் ${memNum}] பெயர் தமிழ் (${targetMemTam}) உள்ளிடப்படுகிறது...`);
    const nameTamInp = page.locator('input[formcontrolname="குடும்பதலைவர்பெயர்"]').nth(1);
    await fillAndVerifyInput(page, nameTamInp, targetMemTam, `உறுப்பினர் ${memNum} (பெயர் - தமிழ்)`, { required: isStrictLive });
    await page.waitForTimeout(350);
    // Golden Rule 7 Re-Lock: Re-verify TNPDS transliterator didn't overwrite our verified Tamil name!
    const tamAfterCheck = (await nameTamInp.inputValue().catch(() => '')).trim();
    if (targetMemTam && tamAfterCheck !== targetMemTam) {
        await fillAndVerifyInput(page, nameTamInp, targetMemTam, `உறுப்பினர் ${memNum} (பெயர் - தமிழ் மறு-பூட்டு)`, { required: false });
        await page.waitForTimeout(200);
    }

    // Derive member gender reliably (also respecting explicit Male/Female relationships like கணவர்/மனைவி)
    const relHintComb = `${mem.relationshipTam || ''} ${mem.relationshipEng || ''} ${mem.relationship || ''}`.toLowerCase();
    const isRelExplicitMale = /கணவர்|கணவன்|மகன்|தந்தை|மாமனார்|மருமகன்|பேரன்|சகோதரர்|\bhusband\b|\bson\b|\bfather\b|\bbrother\b/i.test(relHintComb)
        && !/மருமகள்|மகள்|மனைவி|தாய்|மாமியார்|பேத்தி|சகோதரி|\bwife\b|\bdaughter\b|\bmother\b|\bsister\b/i.test(relHintComb);
    const isRelExplicitFemale = /மனைவி|மகள்|தாய்|மாமியார்|மருமகள்|பேத்தி|சகோதரி|\bwife\b|\bdaughter\b|\bmother\b|\bsister\b/i.test(relHintComb);
    const isMemFemale = isRelExplicitFemale
        ? true
        : (isRelExplicitMale ? false : (mem.gender === 'Female' || Boolean(mem.genderTam && mem.genderTam.includes('பெண்'))));

    // 1.5 தலைப்பு தேர்வு (Salutation) — Match exact Mr./Mrs. and திரு./திருமதி. text, NEVER blind index!
    const salEng = page.locator('select[formcontrolname="salutation"]').nth(1);
    if (await salEng.count() > 0) {
        const sEngOpts = await salEng.evaluate(s => Array.from(s.options).map(o => ({ value: o.value, text: (o.text || '').trim() }))).catch(() => []);
        const targetEngSal = sEngOpts.find(o => {
            const t = o.text.toLowerCase().replace(/\./g, '').trim();
            return isMemFemale ? (t === 'mrs' || t === 'ms' || t === 'miss' || t.startsWith('mrs')) : (t === 'mr' || t === 'master');
        });
        await selectAndVerifyOption(salEng, `உறுப்பினர் ${memNum} (தலைப்பு - ஆங்கிலம்)`, {
            value: targetEngSal ? targetEngSal.value : null,
            index: targetEngSal ? null : (isMemFemale ? 2 : 1),
            required: false
        });
    }
    const salTam = page.locator('select[formcontrolname="lsalutation"]').nth(1);
    if (await salTam.count() > 0) {
        const sTamOpts = await salTam.evaluate(s => Array.from(s.options).map(o => ({ value: o.value, text: (o.text || '').trim() }))).catch(() => []);
        const targetTamSal = sTamOpts.find(o => {
            const t = o.text.trim();
            return isMemFemale ? (t.includes('திருமதி') || t.includes('செல்வி')) : (t.includes('திரு') && !t.includes('திருமதி'));
        });
        await selectAndVerifyOption(salTam, `உறுப்பினர் ${memNum} (தலைப்பு - தமிழ்)`, {
            value: targetTamSal ? targetTamSal.value : null,
            index: targetTamSal ? null : (isMemFemale ? 2 : 1),
            required: false
        });
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

    // 4. பிறந்த தேதி உள்ளீடு + ஆண்டு துல்லிய சரிபார்ப்பு (Strict Year Lock — prevents <5 years TNPDS popup!)
    const memDobVal = (mem.dob || '03/06/2000').trim();
    let resolvedDobParts = { day: 3, month: 6, year: 2000 };
    {
        const p = memDobVal.split(/[/\-]/);
        if (p.length === 3) {
            if (p[0].length === 4) {
                resolvedDobParts = { year: parseInt(p[0], 10), month: parseInt(p[1], 10), day: parseInt(p[2], 10) };
            } else {
                resolvedDobParts = { day: parseInt(p[0], 10), month: parseInt(p[1], 10), year: parseInt(p[2], 10) };
            }
        }
    }
    const targetDobYearStr = String(resolvedDobParts.year || '');
    onProgress(`📍 [உறுப்பினர் ${memNum}] பிறந்த தேதி (${memDobVal}) காலண்டர் மூலம் தேர்வு செய்யப்படுகிறது...`);
    await selectDateInMatCalendar(page, memDobVal, true);
    const dobInpMem = page.locator('input[formcontrolname="dateOfBirth"]').last();
    let memDobActual = (await dobInpMem.inputValue().catch(() => '')).trim();
    if ((!memDobActual || (targetDobYearStr.length === 4 && !memDobActual.includes(targetDobYearStr))) && isStrictLive) {
        onProgress(`🔄 [உறுப்பினர் ${memNum}] பிறந்த தேதி ஆண்டு (${targetDobYearStr}) பொருந்தாததால் (got: "${memDobActual}") மீண்டும் தேர்வு செய்யப்படுகிறது...`);
        await selectDateInMatCalendar(page, memDobVal, true);
        memDobActual = (await dobInpMem.inputValue().catch(() => '')).trim();
    }
    // Always sync native JS Date into Angular FormControl dateOfBirth so TNPDS age check computes exact true age!
    await page.evaluate(({ y, m, d }) => {
        if (!y || y < 1900) return;
        const nativeDate = new Date(y, m - 1, d, 12, 0, 0);
        try {
            if (window.ng && window.ng.getComponent) {
                for (const el of document.querySelectorAll('*')) {
                    const c = window.ng.getComponent(el);
                    if (c && c.addmemberForm && c.addmemberForm.get && c.addmemberForm.get('dateOfBirth')) {
                        c.addmemberForm.get('dateOfBirth').setValue(nativeDate);
                        c.addmemberForm.get('dateOfBirth').setErrors(null);
                        c.addmemberForm.updateValueAndValidity();
                        break;
                    }
                }
            }
        } catch (_) {}
    }, resolvedDobParts).catch(() => {});
    memDobActual = (await dobInpMem.inputValue().catch(() => '')).trim();
    if (!memDobActual && isStrictLive) {
        throw new Error(`உறுப்பினர் ${memNum} பிறந்த தேதி (${memDobVal}) காலண்டரில் தேர்வு செய்யப்படவில்லை!`);
    }
    await page.waitForTimeout(450);

    // 5. பாலினம் (Male / Female)
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
        const rOptions = await relSelect.evaluate(s => Array.from(s.options).map((o, idx) => ({ index: idx, value: o.value, text: o.text }))).catch(() => []);
        const targetOpt = findBestRelationshipOption(rOptions, targetRelTam, targetRelEng);

        if (targetOpt) {
            await relSelect.selectOption(targetOpt.value).catch(() => {});
            await relSelect.dispatchEvent('input').catch(() => {});
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
    let resolvedDocVal = isBirthCertMember ? 'BIRTH_CERTIFICATE' : 'AADHAAR_CARD';
    if (await docSelect.count() > 0) {
        // Wait briefly if Angular is still populating supportingDocument options after DOB change
        for (let dw = 0; dw < 8; dw++) {
            const optLen = await docSelect.evaluate(s => s ? s.options.length : 0).catch(() => 0);
            if (optLen > 1) break;
            await page.waitForTimeout(250);
        }
        const dOptions = await docSelect.evaluate(s => Array.from(s.options).map((o, idx) => ({ index: idx, value: String(o.value || ''), text: (o.text || '').trim() }))).catch(() => []);
        const targetDocOpt = isBirthCertMember
            ? dOptions.find(o => o.value === 'BIRTH_CERTIFICATE' || o.text.includes('பிறப்பு') || o.text.toLowerCase().includes('birth') || o.value.toLowerCase().includes('birth'))
            : (dOptions.find(o => o.value === 'AADHAAR_CARD')
                || dOptions.find(o => !o.text.includes('பிறப்பு') && !o.text.toLowerCase().includes('birth') && (o.text.includes('ஆதார்') || o.text.toLowerCase().includes('aadhaar') || o.value.toLowerCase().includes('aadhaar'))));
        if (targetDocOpt && targetDocOpt.value) {
            resolvedDocVal = targetDocOpt.value;
        }
        await selectAndVerifyOption(docSelect, `உறுப்பினர் ${memNum} (ஆவண வகை)`, {
            value: targetDocOpt ? targetDocOpt.value : (isBirthCertMember ? null : 'AADHAAR_CARD'),
            index: targetDocOpt ? null : (isBirthCertMember ? 1 : null),
            required: isStrictLive
        });
        await page.waitForTimeout(600);
        // Verify supportingDocument stayed selected and was not reset to "தேர்ந்தெடுக்கவும்"
        const curDocVal = await docSelect.evaluate(s => String(s?.value || '').trim()).catch(() => '');
        if ((!curDocVal || curDocVal === '0') && resolvedDocVal) {
            await selectAndVerifyOption(docSelect, `உறுப்பினர் ${memNum} (ஆவண வகை மறு-உறுதி)`, {
                value: resolvedDocVal,
                required: isStrictLive
            });
            await page.waitForTimeout(400);
        } else if (curDocVal) {
            resolvedDocVal = curDocVal;
        }
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
        try { memPdf = await produceCompliantDocument(rawMemDoc, { service: 'TNPDS_NEW_CARD', portal: 'TNPDS' }); } catch (e) { memPdf = rawMemDoc; }
    }
    onProgress(`📍 [உறுப்பினர் ${memNum}] ${isBirthCertMember ? 'பிறப்புச் சான்றிதழ்' : 'ஆதார்'} PDF கோப்பு (${path.basename(memPdf)}) இணைக்கப்படுகிறது...`);
    await showBrowserHud(`📄 [உறுப்பினர் ${memNum}] ${isBirthCertMember ? 'பிறப்புச் சான்றிதழ்' : 'ஆதார்'} PDF இணைக்கப்படுகிறது...`, 'தயவுசெய்து காத்திருக்கவும் • நீங்கள் எதுவும் செய்ய வேண்டாம்!', 'warning');
    
    const aadhaarFileInput = page.locator('input[formcontrolname="supportingDocumentProof"]').last();
    if (await aadhaarFileInput.count() > 0) {
        await aadhaarFileInput.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
        await aadhaarFileInput.evaluate(el => {
            el.disabled = false; el.removeAttribute('disabled');
            el.removeAttribute('readonly'); el.readOnly = false;
            el.style.display = 'block'; el.style.opacity = '1'; el.style.visibility = 'visible';
        }).catch(() => {});
        let attachedCount = 0;
        for (let attachTry = 1; attachTry <= 2; attachTry++) {
            try {
                await aadhaarFileInput.setInputFiles(memPdf, { timeout: 8000 });
                await aadhaarFileInput.dispatchEvent('input').catch(() => {});
                await aadhaarFileInput.dispatchEvent('change').catch(() => {});
                await page.waitForTimeout(400);
                attachedCount = await aadhaarFileInput.evaluate(el => (el.files ? el.files.length : 0)).catch(() => 0);
                if (attachedCount > 0) break;
            } catch (e) {
                console.warn(`[Member ${memNum} Doc Attach] Attempt ${attachTry} warning:`, e.message);
            }
            await page.waitForTimeout(400);
        }
        if (attachedCount === 0 && !isMockSandboxMode) {
            const attachErr = `உறுப்பினர் ${memNum} ஆவணம் (${path.basename(memPdf)}) கோப்பு உள்ளீட்டில் இணையவில்லை!`;
            onProgress(`⚠️ **கடும் பூட்டு நிறுத்தம்:** ${attachErr}`);
            return { success: false, message: attachErr };
        }
        await page.waitForTimeout(400);
    } else {
        onProgress(`⚠️ **பிழை:** உறுப்பினர் ${memNum} ஆதார் கோப்பு உள்ளீட்டுக் களம் கிடைக்கவில்லை!`);
        return { success: false, message: `உறுப்பினர் ${memNum} கோப்பு உள்ளீட்டுக் களம் இல்லை.` };
    }

    return {
        success: true,
        memPdf,
        targetRelTam,
        targetRelEng,
        isBirthCertMember,
        resolvedDocVal,
        resolvedDobParts,
        targetMemEng,
        targetMemTam,
        isMemFemale,
        memInc,
        cleanMemAadhaar
    };
}

module.exports = {
    fillAdditionalMemberForm
};
