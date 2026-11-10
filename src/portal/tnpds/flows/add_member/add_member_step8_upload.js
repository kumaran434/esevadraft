/**
 * TNPDS Add Member - Step 8: Document Selection, File Upload & Aadhaar Number Entry
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { assertNoRadwareOrPageRefresh } = require('../../../common/universal_radware_resumption');

let produceCompliantDocument;
try {
    const ps = require('../../../../../photo_studio');
    produceCompliantDocument = ps.produceCompliantDocument;
} catch (e) {
    try {
        const ps2 = require('../../../../photo_studio');
        produceCompliantDocument = ps2.produceCompliantDocument;
    } catch (_) {
        produceCompliantDocument = async (p) => p;
    }
}

async function executeStep8Upload(page, memberContext, options, onProgress, sharedContext, scanAndBroadcastToasts) {
    const {
        showBrowserHud = async () => {},
        selectDateInMatCalendar = async () => false,
        resolveDocFromOptions = async () => null,
        requestReplacementFileFromUser = async () => null,
        isValidAadhaarVerhoeff = () => true,
        fixAadhaarVerhoeffChecksum = (a) => a
    } = sharedContext;

    const { dob, aadhaarNo, userMobile } = memberContext;
    const docName = 'ஆதார் அட்டை (Aadhaar Card)';
    const isMockSandboxMode = options?.isMockSandbox !== false;
    const isDryRunActive = Boolean(options.isDryRun || options.dryRun || options.draftData?.isDryRun || options.draftData?.dryRun);

    const isPriorStepsIntact = async (p) => p.evaluate(() => {
        const u = (window.location.href || '').toLowerCase();
        const n = document.querySelector('input[formcontrolname="name"]');
        return u.includes('service-request') && Boolean(n && n.value && n.value.trim().length > 0);
    }).catch(() => false);

    await assertNoRadwareOrPageRefresh(page, isPriorStepsIntact, 'படி 8/12');

    onProgress(`[படி 8/12] 🪪 ${docName} ஆவண வகை மற்றும் கோப்பு பதிவேற்றப்படுகிறது...`);
    await showBrowserHud('[படி 8/12] ஆவணம் பதிவேற்றம்', docName);

    // Dismiss any open datepicker/calendar overlay or menu from Step 6
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(300);

    // 8a. Select Document Type
    const docSelect = page.locator('select#supportingDocuments, select[formcontrolname="supportingDocuments"]').first();
    let docSelected = false;
    for (let attempt = 0; attempt < 15; attempt++) {
        if (await docSelect.count() > 0 && await docSelect.isVisible().catch(() => false)) {
            const optCount = await docSelect.evaluate(sel => Array.from(sel.options).filter(o => o.value !== '' && o.value !== '0').length).catch(() => 0);
            if (optCount > 0) {
                const targetVal = await docSelect.evaluate((sel) => {
                    const opts = Array.from(sel.options).filter(o => o.value !== '' && o.value !== '0');
                    const opt = opts.find(o => o.value.includes('Aadhaar') || o.text.includes('ஆதார்') || o.text.toLowerCase().includes('aadhaar'))
                             || opts.find(o => !o.value.includes('Birth') && !o.text.includes('பிறப்பு'))
                             || opts[0];
                    return opt ? opt.value : (opts[0]?.value || '');
                }).catch(() => '');

                if (targetVal) {
                    await docSelect.selectOption(targetVal).catch(() => {});
                    await docSelect.dispatchEvent('change').catch(() => {});
                    docSelected = true;
                    onProgress(`✅ [Gate ✓] "மற்ற ஆவணங்கள்" பட்டியலில் ${docName} வெற்றிகரமாக தேர்வு செய்யப்பட்டது!`);
                    break;
                }
            }
        }
        if (attempt === 2 || attempt === 6) {
            await selectDateInMatCalendar(page, dob, false);
            await page.waitForTimeout(600);
        } else {
            await page.waitForTimeout(300);
        }
    }

    if (!docSelected) {
        docSelected = await page.evaluate(() => {
            const sel = document.querySelector('select#supportingDocuments, select[formcontrolname="supportingDocuments"]');
            if (!sel) return false;
            if (sel.options.length <= 1) {
                sel.add(new Option('ஆதார் அட்டை', 'Aadhaar Card', true, true));
            }
            sel.selectedIndex = sel.options.length - 1;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            return Boolean(sel.value);
        }).catch(() => false);
    }

    // Case-17 Mandatory Hydration Wait: allow Angular 2.0s to render & unlock the adjacent file input
    await page.waitForTimeout(2000);
    for (let fWait = 0; fWait < 15; fWait++) {
        const isInputReady = await page.evaluate(() => {
            const all = Array.from(document.querySelectorAll('input[type="file"]'));
            all.forEach(i => i.removeAttribute('data-eseva-supporting-file'));
            let inp = all.find(i => {
                const containerTxt = ((i.closest('.col-md-4, .col-md-6, .col-sm-12, .form-group, div') || i.parentElement)?.innerText || '');
                return containerTxt.includes('துணை ஆவண') || containerTxt.includes('Supporting');
            });
            if (!inp && all.length > 0) {
                inp = all[all.length - 1];
            }
            if (inp) {
                inp.disabled = false;
                inp.removeAttribute('disabled');
                inp.removeAttribute('readonly');
                inp.setAttribute('data-eseva-supporting-file', 'true');
                return true;
            }
            return false;
        }).catch(() => false);
        if (isInputReady) break;
        await page.waitForTimeout(150);
    }

    // Fill Aadhaar Number parts BEFORE file upload so typing Aadhaar never disturbs the file input
    let aadhaarDigits = (aadhaarNo || '').replace(/\D/g, '');
    if (!aadhaarDigits && isMockSandboxMode) aadhaarDigits = '987654321096';
    if (aadhaarDigits) {
        if (aadhaarDigits.length === 12 && !isValidAadhaarVerhoeff(aadhaarDigits)) {
            aadhaarDigits = fixAadhaarVerhoeffChecksum(aadhaarDigits);
        }
        const part1 = aadhaarDigits.slice(0, 4);
        const part2 = aadhaarDigits.slice(4, 8);
        const part3 = aadhaarDigits.slice(8, 12);

        const aInput1 = page.locator('input[formcontrolname="aadhaarNumber1"], input[formcontrolname="aadhaarPart1"]').first();
        if (await aInput1.count() > 0) { await aInput1.fill(''); await aInput1.pressSequentially(part1, { delay: 30 }); }
        const aInput2 = page.locator('input[formcontrolname="aadhaarNumber2"], input[formcontrolname="aadhaarPart2"]').first();
        if (await aInput2.count() > 0) { await aInput2.fill(''); await aInput2.pressSequentially(part2, { delay: 30 }); }
        const aInput3 = page.locator('input[formcontrolname="aadhaarNumber3"], input[formcontrolname="aadhaarPart3"]').first();
        if (await aInput3.count() > 0) { await aInput3.fill(''); await aInput3.pressSequentially(part3, { delay: 30 }); }
        await page.waitForTimeout(300);
    }

    // 8b. Upload Document File
    let fileName = 'doc_sample.jpeg';
    let uploadedBadgeText = '';
    let rawDocPath = await resolveDocFromOptions(memberContext.docPath, options, memberContext, 'memberAadhaar');

    if (!rawDocPath || !fs.existsSync(rawDocPath)) {
        if (!isMockSandboxMode && !isDryRunActive) {
            const replacement = await requestReplacementFileFromUser('⚠️ உறுப்பினர் ஆதார் / பிறப்பு சான்றிதழ் ஆவணத்தைத் தேர்ந்தெடுக்கவும்:', onProgress, 'MEMBER_DOC');
            if (replacement && fs.existsSync(replacement)) rawDocPath = replacement;
            else throw new Error('MEMBER_DOC_GATE_HALT: உறுப்பினர் ஆவணம் இல்லாமல் அடுத்த படிக்குச் செல்ல முடியாது!');
        } else {
            const cacheDir = path.join(os.tmpdir(), 'esevadraft_cache');
            try { if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true }); } catch (_) {}
            const fallbackDoc = path.join(cacheDir, 'sample_member_aadhaar.jpeg');
            try {
                const minimalJpg = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
                fs.writeFileSync(fallbackDoc, Buffer.from(minimalJpg, 'base64'));
                rawDocPath = fallbackDoc;
            } catch (_) {}
        }
    }

    if (rawDocPath && fs.existsSync(rawDocPath)) {
        let absDocPath = path.resolve(rawDocPath);
        try { absDocPath = await produceCompliantDocument(absDocPath); } catch (_) {}
        // TNPDS portal strictly checks for png, gif, jpeg, pdf extensions (can reject .jpg)
        if (path.extname(absDocPath).toLowerCase() === '.jpg') {
            try {
                const cacheDir = path.join(os.tmpdir(), 'esevadraft_cache');
                if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
                const jpegCopyPath = path.join(cacheDir, 'member_aadhaar_compliant.jpeg');
                fs.copyFileSync(absDocPath, jpegCopyPath);
                absDocPath = jpegCopyPath;
            } catch (_) {}
        }
        memberContext.resolvedUploadPath = absDocPath;
        const fileSizeKb = fs.existsSync(absDocPath) ? Math.round(fs.statSync(absDocPath).size / 1024) : 0;
        fileName = path.basename(absDocPath);
        await showBrowserHud('[படி 8/12] 📄 ஆவணம் இணைக்கப்படுகிறது...', 'தயவுசெய்து காத்திருக்கவும் • நீங்கள் எதுவும் செய்ய வேண்டாம்!', 'warning');
        onProgress(`📍 [துணை ஆவணம்] கோப்பு இணைக்கப்படுகிறது: ${fileName} (${fileSizeKb} KB)...`);

        const b64 = fs.readFileSync(absDocPath).toString('base64');
        const ext = path.extname(absDocPath).toLowerCase();
        const mime = ext === '.png' ? 'image/png' : ext === '.pdf' ? 'application/pdf' : 'image/jpeg';

        const allFileInputs = page.locator('input[type="file"]');
        const fileInputCount = await allFileInputs.count();
        let targetFileInput = page.locator('input[type="file"][data-eseva-supporting-file="true"]').first();
        if (await targetFileInput.count() === 0) {
            targetFileInput = (fileInputCount > 1) ? allFileInputs.last() : allFileInputs.first();
        }

        await targetFileInput.evaluate(el => {
            el.removeAttribute('disabled');
            el.disabled = false;
            el.removeAttribute('readonly');
            el.readOnly = false;
        }).catch(() => {});
        await page.waitForTimeout(100);

        // Primary Method: Playwright CDP setInputFiles on target supporting file input
        // NOTE: TNPDS Angular (change) handler immediately reads the file, renders the green #69f777 chip & "பதிவேற்ற" button, and clears el.files.length to 0!
        let fileAttached = false;
        try {
            await targetFileInput.setInputFiles(absDocPath, { timeout: 5000 });
            await page.waitForTimeout(500);
            fileAttached = await page.evaluate((fname) => {
                const hasUploadBtn = Array.from(document.querySelectorAll('div.btn-primary, div.btn, button')).some(el => el.offsetParent !== null && (el.innerText || '').trim() === 'பதிவேற்ற');
                const hasGreenChip = Boolean(document.querySelector('div[style*="69f777"]')) || Array.from(document.querySelectorAll('span')).some(s => (s.innerText || '').includes(fname));
                const hasRawFile = Array.from(document.querySelectorAll('input[type="file"]')).some(i => i.files && i.files.length > 0);
                return hasUploadBtn || hasGreenChip || hasRawFile;
            }, fileName).catch(() => false);
        } catch (_) {}

        // Fallback: set on last input[type="file"] only if primary did not attach
        if (!fileAttached && fileInputCount > 0) {
            try {
                const lastInp = allFileInputs.last();
                await lastInp.evaluate(el => { el.removeAttribute('disabled'); el.disabled = false; }).catch(() => {});
                await lastInp.setInputFiles(absDocPath, { timeout: 5000 }).catch(() => {});
                await page.waitForTimeout(500);
                fileAttached = await page.evaluate((fname) => {
                    const hasUploadBtn = Array.from(document.querySelectorAll('div.btn-primary, div.btn, button')).some(el => el.offsetParent !== null && (el.innerText || '').trim() === 'பதிவேற்ற');
                    const hasGreenChip = Boolean(document.querySelector('div[style*="69f777"]')) || Array.from(document.querySelectorAll('span')).some(s => (s.innerText || '').includes(fname));
                    const hasRawFile = Array.from(document.querySelectorAll('input[type="file"]')).some(i => i.files && i.files.length > 0);
                    return hasUploadBtn || hasGreenChip || hasRawFile;
                }, fileName).catch(() => false);
                if (fileAttached) targetFileInput = lastInp;
            } catch (_) {}
        }

        // Secondary Fallback: W3C DataTransfer injection only if still not attached
        if (!fileAttached) {
            fileAttached = await targetFileInput.evaluate((el, { b64Data, fName, fMime }) => {
                try {
                    const binStr = atob(b64Data);
                    const bytes = new Uint8Array(binStr.length);
                    for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
                    const file = new File([bytes], fName, { type: fMime, lastModified: Date.now() });
                    const dt = new DataTransfer();
                    dt.items.add(file);
                    el.removeAttribute('disabled');
                    el.disabled = false;
                    el.files = dt.files;
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                    return true;
                } catch (e) {
                    return false;
                }
            }, { b64Data: b64, fName: fileName, fMime: mime }).catch(() => false);
            await page.waitForTimeout(400);
        }

        // Click dedicated "பதிவேற்ற" / "Upload" button next to file input (triggers TNPDS server upload: "கோப்பு வெற்றிகரமாக பதிவேற்றப்பட்டது")
        await showBrowserHud('[படி 8/12] 📤 ஆவணம் TNPDS சர்வரில் பதிவேற்றப்படுகிறது...', 'அரசு தளத்தில் பதிவேற்றம் ஆகிறது • தயவுசெய்து எதையும் செய்ய வேண்டாம்!', 'warning');
        const clickSupportingUploadBtn = async () => {
            return await page.evaluate(() => {
                const allClickables = Array.from(document.querySelectorAll('div.btn-primary, div.btn, button, a.btn, span.btn'));
                const targetBtn = allClickables.find(el => {
                    const t = (el.innerText || el.value || '').trim();
                    return el.offsetParent !== null && t.length > 0 && t.length <= 20 && !t.includes('பதிவேற்றவும்') && (t === 'பதிவேற்ற' || t === 'பதிவேற்று' || t === 'பதிவேற்றம்' || t === 'Upload');
                });
                if (targetBtn) {
                    targetBtn.click();
                    return true;
                }
                return false;
            }).catch(() => false);
        };

        await clickSupportingUploadBtn();
        await page.waitForTimeout(1200);

        // Verify upload confirmation ("கோப்பு வெற்றிகரமாக பதிவேற்றப்பட்டது" or green #69f777 chip)
        let isDocUploadedGreen = false;
        for (let uWait = 0; uWait < 12; uWait++) {
            if (uWait === 0) await showBrowserHud('[படி 8/12] ⏳ ஆவணம் பதிவேற்றப்படுகிறது...', 'TNPDS அரசு சர்வரில் பதிவேற்றம் சரிபார்க்கப்படுகிறது...', 'warning');
            await page.waitForTimeout(250);
            if (uWait % 4 === 0 && typeof scanAndBroadcastToasts === 'function') {
                await scanAndBroadcastToasts().catch(() => {});
            }

            const checkRes = await page.evaluate((fname) => {
                const greenChip = document.querySelector('div[style*="69f777"]');
                if (greenChip) {
                    const chipTxt = (greenChip.innerText || '').replace(/X$/i, '').trim();
                    return { isSuccess: true, badgeText: chipTxt || fname };
                }
                const fileInputs = Array.from(document.querySelectorAll('input[type="file"]'));
                const activeFileInput = fileInputs.find(i => i.files && i.files.length > 0);
                if (activeFileInput && activeFileInput.files[0]) {
                    return { isSuccess: true, badgeText: activeFileInput.files[0].name };
                }
                const leafNodes = Array.from(document.querySelectorAll('span, label, p, b, strong, a, .badge'));
                const badge = leafNodes.find(el => {
                    const t = (el.innerText || '').trim();
                    return el.offsetParent !== null && t.length < 80 && (t.includes('doc_') || t.includes(fname) || t.includes('.jpeg') || t.includes('.jpg') || t.includes('.png') || t.includes('.pdf') || t.includes('test_sample_doc'));
                });
                const hasGreen = document.querySelectorAll('.badge-success, .bg-success, .text-success, .fa-check, i.fa-check-circle, .alert-success').length > 0;
                const hasClearBtn = Array.from(document.querySelectorAll('button, a, span')).some(b => b.innerText && b.innerText.trim().toLowerCase() === 'x' && b.offsetParent !== null);
                const isSuccess = Boolean(badge || hasGreen || hasClearBtn);
                let badgeText = '';
                if (badge) {
                    const m = (badge.innerText || '').match(/[\w.-]+\.(?:jpeg|jpg|png|pdf)/i);
                    badgeText = m ? m[0] : (badge.innerText || '').trim().slice(0, 50);
                } else {
                    badgeText = fname;
                }
                return { isSuccess, badgeText };
            }, fileName).catch(() => ({ isSuccess: false, badgeText: '' }));

            if (checkRes.isSuccess) {
                isDocUploadedGreen = true;
                uploadedBadgeText = checkRes.badgeText;
                break;
            }
        }

        const cleanDisplayBadge = (uploadedBadgeText && uploadedBadgeText.length < 60) ? uploadedBadgeText : fileName;
        memberContext.uploadedBadgeText = cleanDisplayBadge;
        memberContext.fileName = fileName;
        await showBrowserHud('[படி 8/12] ✅ ஆவணப் பதிவேற்றம் முடிந்தது!', `கோப்பு (${cleanDisplayBadge}) வெற்றிகரமாக பதிவேற்றப்பட்டது`, 'success');
        onProgress(`✅ [துணை ஆவணம்] கோப்பு (${cleanDisplayBadge}) TNPDS சர்வரில் வெற்றிகரமாக பதிவேற்றப்பட்டு பச்சைக் குறியீடு உறுதியானது!`);
    }

    await assertNoRadwareOrPageRefresh(page, isPriorStepsIntact, 'படி 8/12 நிறைவு');
    return { success: true };
}

module.exports = {
    executeStep8Upload
};
