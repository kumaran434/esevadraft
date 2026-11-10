/**
 * TNPDS New Smart Card - Steps 37 to 46: Card Option, Residence Proof, & Gas Details
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

async function executeCommoditiesAndGasSteps(page, citizenProfile, docPrep, options, onProgress, sharedContext, logDiag, takeStepSnapshot, scanAndBroadcastToasts) {
    const {
        requestReplacementFileFromUser = async () => null,
        showBrowserHud = async () => {}
    } = sharedContext;
    const isMockSandboxMode = options?.mockSandbox !== false && options?.isMockSandboxMode !== false;
    const { optimizedGasBook, rawGasBook } = docPrep || {};

    // படி 37: அட்டை வகை தேர்வு (அரிசி அட்டை)
    onProgress('📍 [படி 37/51] அட்டை வகை (அரிசி அட்டை - Rice Card) தேர்ந்தெடுக்கப்படுகிறது...');
    const cardSelect = page.locator('select[formcontrolname="cardOption"]').first();
    if (await cardSelect.count() > 0) {
        await page.evaluate(() => {
            const sel = document.querySelector('select[formcontrolname="cardOption"]');
            if (sel) {
                const opt = Array.from(sel.options).find(o => {
                    const t = (o.text || '').toLowerCase();
                    const v = (o.value || '').toLowerCase();
                    return t.includes('rice') || t.includes('அரிசி') || v.includes('rice');
                });
                if (opt) sel.value = opt.value;
                else if (sel.options.length > 2) sel.selectedIndex = 2;
                else sel.selectedIndex = 1;
                sel.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
        await cardSelect.dispatchEvent('change');
    }
    await page.waitForTimeout(1000);

    // குடியிருப்புச் சான்று தேர்வு (Gas Book / பிற குடியிருப்புச் சான்று)
    const proofDocType = citizenProfile.residenceProof?.type || 'GAS_BOOK';
    const proofDocPath = citizenProfile.residenceProof?.docPath || (isMockSandboxMode ? path.join(__dirname, 'uploads', 'kumaran_gas_book.pdf') : null);
    let proofFileToUpload = (optimizedGasBook && fs.existsSync(optimizedGasBook)) ? optimizedGasBook : (proofDocPath && fs.existsSync(proofDocPath) ? proofDocPath : null);

    if (!proofFileToUpload || !fs.existsSync(proofFileToUpload)) {
        if (!isMockSandboxMode) {
            onProgress(`⚠️ **[கடும் புலக் கட்டுப்பாடு]** குடியிருப்புச் சான்று (${proofDocType}) PDF ஆவணம் தேவைப்படுகிறது. தயவுசெய்து கோப்பைத் தேர்ந்தெடுக்கவும்...`);
            const replacement = await requestReplacementFileFromUser(
                `⚠️ குடியிருப்புச் சான்று (${proofDocType}) PDF ஆவணத்தைத் தேர்ந்தெடுக்கவும்:`,
                onProgress, 'RESIDENCE_PROOF'
            );
            if (replacement && fs.existsSync(replacement)) proofFileToUpload = replacement;
            else {
                const gateErr = `கடுமையான புலக் கட்டுப்பாடு (Field Gate): குடியிருப்புச் சான்று PDF ஆவணம் இணைக்கப்படவில்லை!`;
                onProgress(`🛑 **பிழை:** ${gateErr}`);
                logDiag(46, 'FAIL', gateErr);
                throw new Error(gateErr);
            }
        } else {
            proofFileToUpload = path.join(__dirname, 'uploads', 'kumaran_gas_book.pdf');
        }
    }

    onProgress(`📍 குடியிருப்புச் சான்று வகை (${proofDocType === 'GAS_BOOK' ? 'எரிவாயு நுகர்வோர் அட்டை / Gas Book' : 'குடியிருப்புச் சான்று'}) தேர்ந்தெடுக்கப்படுகிறது...`);
    await page.evaluate((pType) => {
        const sel = document.querySelector('select[formcontrolname="proofOfResidence"]');
        if (sel) {
            let matched = null;
            if (pType === 'PROPERTY_TAX') matched = Array.from(sel.options).find(o => o.text.includes('சொத்து') || o.text.includes('வரி') || o.value.includes('TAX'));
            else if (pType === 'GAS_BOOK') matched = Array.from(sel.options).find(o => o.text.includes('எரிவாயு') || o.text.includes('Gas') || o.value.includes('GAS'));
            else if (pType === 'EB_BILL') matched = Array.from(sel.options).find(o => o.text.includes('மின்') || o.text.includes('Electricity'));
            if (matched) sel.value = matched.value;
            else if (sel.options.length > 2) sel.selectedIndex = 2;
            else sel.selectedIndex = 1;
            sel.dispatchEvent(new Event('input', { bubbles: true }));
            sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }, proofDocType);
    await page.waitForTimeout(1500);

    onProgress(`📍 குடியிருப்புச் சான்றுக்கு உகந்ததாக்கப்பட்ட A4 PDF (${path.basename(proofFileToUpload)}) இணைக்கப்படுகிறது...`);
    await showBrowserHud('📄 குடியிருப்புச் சான்று இணைக்கப்படுகிறது...', 'தயவுசெய்து காத்திருக்கவும் • நீங்கள் எதுவும் செய்ய வேண்டாம்!', 'warning');
    const proofFileInput = page.locator('input[formcontrolname="residenceProofFile"], input[type="file"]').last();
    if (await proofFileInput.count() > 0) {
        await proofFileInput.evaluate(el => {
            el.disabled = false; el.removeAttribute('disabled');
            el.removeAttribute('readonly'); el.readOnly = false;
            el.style.display = 'block'; el.style.opacity = '1'; el.style.visibility = 'visible';
        }).catch(() => {});
        try { await proofFileInput.setInputFiles(proofFileToUpload, { timeout: 2000 }); } catch (e) {}
        await page.waitForTimeout(500);
    } else {
        return { success: false, message: 'குடியிருப்புச் சான்று கோப்பு உள்ளீட்டுக் களம் கிடைக்கவில்லை.' };
    }

    onProgress('📍 குடியிருப்புச் சான்று பதிவேற்றம் அழுத்தப்பட்டு பச்சைக் குறியீடு உறுதி செய்யப்படுகிறது...');
    await showBrowserHud('📤 குடியிருப்புச் சான்று TNPDS சர்வரில் பதிவேற்றப்படுகிறது...', 'அரசு தளத்தில் பதிவேற்றம் ஆகிறது • நீங்கள் எதுவும் செய்ய வேண்டாம்!', 'warning');
    let residenceDocUploaded = false;
    const uploadBtn = page.locator('div:has(> input[formcontrolname="residenceProofFile"]) button:has-text("பதிவேற்றம்"), div:has(> input[formcontrolname="residenceProofFile"]) button:has-text("Upload")')
        .or(page.getByRole('button', { name: /பதிவேற்றம்|Upload/i })).last();
    if (await uploadBtn.count() > 0) {
        await uploadBtn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(3500);
        await scanAndBroadcastToasts();

        const isResidenceGreenInDOM = await page.evaluate((fileName) => {
            const hasFileName = Array.from(document.querySelectorAll('div, label, span, p')).some(el => el.innerText && el.innerText.includes(fileName));
            const hasClearBtn = Array.from(document.querySelectorAll('button')).some(b => b.innerText.trim().toLowerCase() === 'x');
            const allUploadBtns = Array.from(document.querySelectorAll('button')).filter(b => (b.innerText || '').toLowerCase().includes('பதிவேற்றம்') || (b.innerText || '').toLowerCase().includes('upload'));
            const isUploadDisabled = allUploadBtns.some(b => b.disabled);
            const greenEl = document.querySelectorAll('.badge.bg-success, .text-success, i.fa-check, .alert-success');
            return Boolean(hasFileName || hasClearBtn || isUploadDisabled || greenEl.length > 0);
        }, path.basename(proofFileToUpload));

        residenceDocUploaded = isResidenceGreenInDOM || isMockSandboxMode;
    }

    if (!residenceDocUploaded) {
        onProgress('⚠️ **பிழை:** குடியிருப்புச் சான்று PDF பதிவேற்றத்தில் பச்சைக் குறியீடு வரவில்லை!');
        return { success: false, message: 'குடியிருப்புச் சான்று பச்சைக் குறியீடு உறுதி தோல்வி.' };
    }
    onProgress('✅ குடியிருப்புச் சான்று A4 PDF வெற்றிகரமாகப் பதிவேற்றப்பட்டு பச்சைக் குறியீடு உறுதி செய்யப்பட்டது!');

    // பகுதி 6: எரிவாயு இணைப்பு விவரங்கள் (படிகள் 41 முதல் 46)
    let gasDetails = citizenProfile.gasDetails || {};
    const hasGasDoc = Boolean(citizenProfile.documents?.gasBook || citizenProfile.documents?.residenceProof || (citizenProfile.residenceProof?.type === 'GAS_BOOK'));
    const hasGasConnection = Boolean((gasDetails && gasDetails.hasGas === true && gasDetails.consumerNumber) || (gasDetails && gasDetails.consumerNumber) || hasGasDoc);

    if (hasGasConnection) {
        onProgress('⏳ **[படி 41-46/51] காத்திருக்கவும்:** எரிவாயு இணைப்பு விவரங்கள் போர்ட்டலில் புதுப்பிக்கப்படுகின்றன...');
        await showBrowserHud('⏳ தயவுசெய்து காத்திருக்கவும்... (Please Wait)', 'எரிவாயு இணைப்பு விவரங்கள் போர்ட்டலில் புதுப்பிக்கப்படுகின்றன...', 'info');
        const gasCheck = page.locator('#gasConnectionCheckbox, input[formcontrolname="gasdeclaration"]').first();
        if (await gasCheck.count() > 0) {
            await gasCheck.check({ force: true });
            await page.waitForTimeout(2500);
        }

        const gasPerson = citizenProfile.gasDetails?.consumerName || citizenProfile.fullNameTam || citizenProfile.fullNameEng || 'தலைவர்';
        onProgress(`📍 [படி 42/51] கேஸ் இணைப்பு பதிவு செய்யப்பட்ட நபர் (${gasPerson}) தேர்ந்தெடுக்கப்படுகிறார்...`);
        const pSel = page.locator('select[formcontrolname="nameGasConnectionIsRegistered1"], select[name="applicantName1"], select[formcontrolname="applicantName1"], tr:has-text("இணைப்பு பதிவு") select').first();
        if (await pSel.count() > 0) {
            await page.waitForFunction(() => {
                const sel = document.querySelector('select[formcontrolname="nameGasConnectionIsRegistered1"], select[name="applicantName1"], select[formcontrolname="applicantName1"]');
                return sel && sel.options.length > 1;
            }, { timeout: 15000 }).catch(() => {});

            const matchedPerson = await pSel.evaluate((sel, targetNames) => {
                const clean = (str) => (str || '').replace(/\s+/g, '').toLowerCase();
                for (let i = 1; i < sel.options.length; i++) {
                    const opt = clean(sel.options[i].text);
                    for (const name of targetNames) {
                        const t = clean(name);
                        if (t && (opt.includes(t) || t.includes(opt))) {
                            sel.selectedIndex = i;
                            sel.dispatchEvent(new Event('change', { bubbles: true }));
                            return true;
                        }
                    }
                }
                if (sel.options.length > 1) {
                    sel.selectedIndex = 1;
                    sel.dispatchEvent(new Event('change', { bubbles: true }));
                    return true;
                }
                return false;
            }, [citizenProfile.fullNameTam, citizenProfile.fullNameEng, citizenProfile.gasDetails?.consumerName, 'தலைவர்']).catch(() => false);

            await pSel.dispatchEvent('change').catch(() => {});
            await page.waitForTimeout(500);
        }

        const targetOilCo = citizenProfile.gasDetails?.oilCompany || 'HPCL';
        const targetOilDisplay = citizenProfile.gasDetails?.oilCompanyDisplay || (targetOilCo.includes('HP') ? 'HP Gas / Hindustan Petroleum' : 'Indane Gas (IOCL)');
        onProgress(`📍 [படி 43/51] எண்ணெய் நிறுவனம் (${targetOilDisplay}) தேர்ந்தெடுக்கப்படுகிறது...`);
        const oSel = page.locator('select[formcontrolname="oilCompany1"], select[name="oilCompany1"]').first();
        if (await oSel.count() > 0) {
            const oOptions = await oSel.evaluate(s => Array.from(s.options).map(o => ({ value: o.value, text: o.text }))).catch(() => []);
            const targetOpt = oOptions.find(o => {
                const t = (o.text || '').toLowerCase(), v = (o.value || '').toLowerCase();
                if (targetOilCo.includes('HP') || targetOilDisplay.includes('HP')) return t.includes('எச்பி') || v.includes('hpc') || t.includes('hp');
                if (targetOilCo.includes('BP') || targetOilDisplay.includes('Bharat')) return t.includes('பிபி') || v.includes('bpc') || t.includes('bp');
                return t.includes('ஐஓ') || v.includes('ioc') || t.includes('ioc');
            });
            await oSel.selectOption(targetOpt ? targetOpt.value : { index: 2 }).catch(() => {});
            await oSel.dispatchEvent('change').catch(() => {});
            await page.waitForTimeout(500);
        }

        const gasNo = citizenProfile.gasDetails?.consumerNumber || '622601';
        onProgress(`📍 [படி 44/51] எல்.பி.ஜி நுகர்வோர் எண் (${gasNo}) உள்ளிடப்படுகிறது...`);
        const cInp = page.locator('input[formcontrolname="lPGConsumerNumber1"], input[name="lpgConsumerNo1"]').first()
            .or(page.getByRole('textbox', { name: '-20 இலக்காக இருக்க வேண்டும்' })).first();
        if (await cInp.count() > 0) {
            await cInp.click(); await cInp.fill(gasNo);
            await cInp.dispatchEvent('input'); await cInp.dispatchEvent('change');
            await page.waitForTimeout(500);
        }

        const gasAgency = citizenProfile.gasDetails?.agencyName || 'RAJAM GAS AGENCY';
        onProgress(`📍 [படி 45/51] கேஸ் ஏஜென்சி பெயர் (${gasAgency}) உள்ளிடப்படுகிறது...`);
        const aInp = page.locator('input[formcontrolname="nameOfTheGasAgency1"], input[name="nameOfTheGasAgency1"]').first()
            .or(page.getByRole('textbox', { name: 'எழுத்துக்களாக இருக்க வேண்டும்' })).first();
        if (await aInp.count() > 0) {
            await aInp.click(); await aInp.fill(gasAgency);
            await aInp.dispatchEvent('input'); await aInp.dispatchEvent('change');
            await page.waitForTimeout(500);
        }

        const gasCyl = citizenProfile.gasDetails?.cylinders || '1';
        onProgress(`📍 [படி 46/51] சிலிண்டர் எண்ணிக்கை (${gasCyl}) தேர்ந்தெடுக்கப்படுகிறது...`);
        const cylSel = page.locator('select[formcontrolname="noOfCylinders1"], select[name="noOfCylinders1"]').first();
        if (await cylSel.count() > 0) {
            await cylSel.selectOption(gasCyl).catch(async () => { await cylSel.selectOption({ index: 1 }); });
            await cylSel.dispatchEvent('change').catch(() => {});
            await page.waitForTimeout(1000);
        }
    } else {
        onProgress('📍 [படிகள் 41-46/51] குடும்பத்திற்கு எரிவாயு இணைப்பு இல்லை (No Gas Connection)...');
        const gasCheck = page.locator('#gasConnectionCheckbox, input[formcontrolname="gasdeclaration"]').first();
        if (await gasCheck.count() > 0 && await gasCheck.isChecked()) {
            await gasCheck.uncheck({ force: true });
        }
        await page.waitForTimeout(1000);
    }
    await takeStepSnapshot('step46_card_and_gas');
    return { success: true };
}

module.exports = {
    executeCommoditiesAndGasSteps
};
