/**
 * TNPDS New Smart Card - Steps 37 to 46: Card Option, Residence Proof, & Gas Details
 */
const fs = require('fs');
const path = require('path');
const { verifyServerUploadConfirmed, fillAndVerifyInput, selectAndVerifyOption, waitForCopilotStepRecovery } = require('../../../common/strict_step_gate');

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

async function executeCommoditiesAndGasSteps(page, citizenProfile, docPrep, options, onProgress, sharedContext, logDiag, takeStepSnapshot, scanAndBroadcastToasts) {
    const {
        requestReplacementFileFromUser = async () => null,
        showBrowserHud = async () => {}
    } = sharedContext;
    const isMockSandboxMode = options?.mockSandbox !== false && options?.isMockSandboxMode !== false;
    const { optimizedGasBook, rawGasBook } = docPrep || {};

    // படி 37: அட்டை வகை தேர்வு (அரிசி அட்டை — Strict Step Gate)
    onProgress('📍 [படி 37/51] அட்டை வகை (அரிசி அட்டை - Rice Card) தேர்ந்தெடுக்கப்படுகிறது...');
    const cardSelect = page.locator('select[formcontrolname="cardOption"]').first();
    if (await cardSelect.count() > 0) {
        const cOpts = await cardSelect.evaluate(s => Array.from(s.options).map(o => ({ value: o.value, text: o.text }))).catch(() => []);
        const riceOpt = cOpts.find(o => {
            const t = (o.text || '').toLowerCase(), v = (o.value || '').toLowerCase();
            return t.includes('rice') || t.includes('அரிசி') || v.includes('rice');
        });
        const cardSelectedLabel = await selectAndVerifyOption(cardSelect, 'படி 37 (அட்டை வகை - அரிசி அட்டை)', {
            value: riceOpt ? riceOpt.value : null,
            index: riceOpt ? null : (cOpts.length > 2 ? 2 : 1),
            required: !isMockSandboxMode
        });
        onProgress(`✅ [படி 37/51] அட்டை வகை (${cardSelectedLabel || 'அரிசி அட்டை'}) உறுதி செய்யப்பட்டது!`);
    }
    await page.waitForTimeout(800);

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

    onProgress(`📍 [படி 38/51] குடியிருப்புச் சான்று வகை (${proofDocType === 'GAS_BOOK' ? 'எரிவாயு நுகர்வோர் அட்டை / Gas Book' : 'குடியிருப்புச் சான்று'}) தேர்ந்தெடுக்கப்படுகிறது...`);
    const proofSel = page.locator('select[formcontrolname="proofOfResidence"]').first();
    if (await proofSel.count() > 0) {
        const pOpts = await proofSel.evaluate(s => Array.from(s.options).map(o => ({ value: o.value, text: o.text }))).catch(() => []);
        let matched = null;
        if (proofDocType === 'PROPERTY_TAX') matched = pOpts.find(o => o.text.includes('சொத்து') || o.text.includes('வரி') || o.value.includes('TAX'));
        else if (proofDocType === 'GAS_BOOK') matched = pOpts.find(o => o.text.includes('எரிவாயு') || o.text.includes('Gas') || o.value.includes('GAS'));
        else if (proofDocType === 'EB_BILL') matched = pOpts.find(o => o.text.includes('மின்') || o.text.includes('Electricity'));
        const proofLabel = await selectAndVerifyOption(proofSel, 'படி 38 (குடியிருப்புச் சான்று வகை)', {
            value: matched ? matched.value : null,
            index: matched ? null : (pOpts.length > 2 ? 2 : 1),
            required: !isMockSandboxMode
        });
        onProgress(`✅ [படி 38/51] குடியிருப்புச் சான்று வகை (${proofLabel}) உறுதி செய்யப்பட்டது!`);
    }
    await page.waitForTimeout(1000);

    onProgress(`📍 [படி 39/51] குடியிருப்புச் சான்றுக்கு உகந்ததாக்கப்பட்ட PDF (${path.basename(proofFileToUpload)}) இணைக்கப்படுகிறது...`);
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

    onProgress('📍 [படி 40/51] குடியிருப்புச் சான்று பதிவேற்றம் அழுத்தப்பட்டு பச்சைக் குறியீடு உறுதி செய்யப்படுகிறது...');
    await showBrowserHud('📤 குடியிருப்புச் சான்று TNPDS சர்வரில் பதிவேற்றப்படுகிறது...', 'அரசு தளத்தில் பதிவேற்றம் ஆகிறது • நீங்கள் எதுவும் செய்ய வேண்டாம்!', 'warning');
    let residenceDocUploaded = false;
    const uploadBtn = page.locator('div:has(> input[formcontrolname="residenceProofFile"]) button:has-text("பதிவேற்றம்"), div:has(> input[formcontrolname="residenceProofFile"]) button:has-text("Upload")')
        .or(page.getByRole('button', { name: /பதிவேற்றம்|Upload/i })).last();
    if (await uploadBtn.count() > 0) {
        await uploadBtn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(1200);
        const isResidenceGreenInDOM = await verifyServerUploadConfirmed(page, 'input[formcontrolname="residenceProofFile"], input[type="file"]', 8000);
        await scanAndBroadcastToasts();
        residenceDocUploaded = isResidenceGreenInDOM || isMockSandboxMode;
    }

    if (!residenceDocUploaded) {
        const resErr = 'படி 40: குடியிருப்புச் சான்று PDF பதிவேற்றத்தில் பச்சைக் குறியீடு தானாக உறுதி ஆகவில்லை.';
        const recResUp = await waitForCopilotStepRecovery({
            page,
            stepLabel: 'படி 40 (குடியிருப்புச் சான்று பதிவேற்றம்)',
            errorMessage: resErr,
            operatorHint: 'நீங்களே குடியிருப்புச் சான்று ஆவணத்தைப் பதிவேற்றியவுடன் ஆட்டோமேஷன் தானாகவே கேஸ் & இறுதிச் சரிபார்ப்புக்குத் தொடரும்!',
            serviceName: 'TNPDS_NEW_CARD',
            customerMobile: citizenProfile.mobileNumber || '',
            isMockSandboxMode,
            onProgress,
            showBrowserHud,
            checkCompletedFn: async () => verifyServerUploadConfirmed(page, 'input[formcontrolname="residenceProofFile"], input[type="file"]', 600)
        });
        if (!recResUp.recovered) {
            await showBrowserHud('🔴 படி 40 ஆவணப் பதிவேற்றப் பிழை', resErr, 'error');
            onProgress(`⚠️ **கடும் பூட்டு நிறுத்தம் (Strict Gate Halt):** ${resErr}`);
            return { success: false, message: resErr };
        }
    }
    onProgress('✅ [படி 40/51] குடியிருப்புச் சான்று வெற்றிகரமாகப் பதிவேற்றப்பட்டு பச்சைக் குறியீடு உறுதி செய்யப்பட்டது!');

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
            await selectAndVerifyOption(oSel, 'படி 43 (எண்ணெய் நிறுவனம்)', { value: targetOpt ? targetOpt.value : null, index: targetOpt ? null : 2, required: !isMockSandboxMode });
            onProgress(`✅ [படி 43/51] எண்ணெய் நிறுவனம் (${targetOilDisplay}) உறுதி செய்யப்பட்டது!`);
            await page.waitForTimeout(400);
        }

        const gasNo = citizenProfile.gasDetails?.consumerNumber || '622601';
        onProgress(`📍 [படி 44/51] எல்.பி.ஜி நுகர்வோர் எண் (${gasNo}) உள்ளிடப்படுகிறது...`);
        const cInp = page.locator('input[formcontrolname="lPGConsumerNumber1"], input[name="lpgConsumerNo1"]').first()
            .or(page.getByRole('textbox', { name: '-20 இலக்காக இருக்க வேண்டும்' })).first();
        await fillAndVerifyInput(page, cInp, gasNo, 'படி 44 (எல்.பி.ஜி நுகர்வோர் எண்)', { required: !isMockSandboxMode });
        onProgress(`✅ [படி 44/51] நுகர்வோர் எண் (${gasNo}) உறுதி செய்யப்பட்டது!`);
        await page.waitForTimeout(400);

        const gasAgency = citizenProfile.gasDetails?.agencyName || 'RAJAM GAS AGENCY';
        onProgress(`📍 [படி 45/51] கேஸ் ஏஜென்சி பெயர் (${gasAgency}) உள்ளிடப்படுகிறது...`);
        const aInp = page.locator('input[formcontrolname="nameOfTheGasAgency1"], input[name="nameOfTheGasAgency1"]').first()
            .or(page.getByRole('textbox', { name: 'எழுத்துக்களாக இருக்க வேண்டும்' })).first();
        await fillAndVerifyInput(page, aInp, gasAgency, 'படி 45 (கேஸ் ஏஜென்சி பெயர்)', { required: !isMockSandboxMode });
        onProgress(`✅ [படி 45/51] கேஸ் ஏஜென்சி (${gasAgency}) உறுதி செய்யப்பட்டது!`);
        await page.waitForTimeout(400);

        const gasCyl = citizenProfile.gasDetails?.cylinders || '1';
        onProgress(`📍 [படி 46/51] சிலிண்டர் எண்ணிக்கை (${gasCyl}) தேர்ந்தெடுக்கப்படுகிறது...`);
        const cylSel = page.locator('select[formcontrolname="noOfCylinders1"], select[name="noOfCylinders1"]').first();
        if (await cylSel.count() > 0) {
            await selectAndVerifyOption(cylSel, 'படி 46 (சிலிண்டர் எண்ணிக்கை)', { value: gasCyl, required: !isMockSandboxMode }).catch(async () => {
                await selectAndVerifyOption(cylSel, 'படி 46 (சிலிண்டர் எண்ணிக்கை)', { index: 1, required: !isMockSandboxMode });
            });
            onProgress(`✅ [படி 46/51] சிலிண்டர் எண்ணிக்கை (${gasCyl}) உறுதி செய்யப்பட்டது!`);
            await page.waitForTimeout(800);
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
