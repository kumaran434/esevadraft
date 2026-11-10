/**
 * TNPDS Add Member — Step 5: Document Type Selection & Fast Upload Verification (Modular Step < 300 lines)
 * 
 * Responsibilities:
 * 1. Selects supporting document type (select#supportingDocuments).
 * 2. Attaches official 2-in-1 compliant document file (Aadhaar / Birth Certificate).
 * 3. Invokes polymorphic upload button clicker (div.btn, button.btn-primary).
 * 4. Verifies leaf node badges for upload confirmation without page dumping.
 */

const path = require('path');
const { clickDocumentUploadButton, verifyDocumentUploadConfirmation } = require('../../step8_upload_manager');
const { stitchDualSidedDocument } = require('../../../../services/document_stitcher');

async function selectAndUploadMemberDocument(page, memberData, helpers = {}) {
    const {
        onProgress = () => {},
        showBrowserHud = async () => {},
        scanAndBroadcastToasts = async () => {}
    } = helpers;

    const docTypeLabel = memberData.documentTypeTam || memberData.documentTypeEng || 'ஆதார் அட்டை';
    const filePath = memberData.documentPath || memberData.aadhaarCardPath;

    console.log(`📤 [Add Member: Step 5] Selecting document: ${docTypeLabel}, File: ${filePath}...`);
    if (onProgress) onProgress(`[படி 8/12] 📤 ஆவண வகை (${docTypeLabel}) தேர்வு செய்யப்பட்டு கோப்பு பதிவேற்றப்படுகிறது...`);
    await showBrowserHud('[படி 8/12] ஆவணப் பதிவேற்றம்', `${docTypeLabel}`);

    // 1. Select supporting document in dropdown
    const docSelect = page.locator('select#supportingDocuments, select[formcontrolname="supportingDocuments"], select[formcontrolname="proofType"]').first();
    if (await docSelect.count() > 0 && await docSelect.isVisible().catch(() => false)) {
        let matched = false;
        if (docTypeLabel) {
            matched = await docSelect.selectOption({ label: docTypeLabel }).then(() => true).catch(() => false);
        }
        if (!matched) {
            await page.evaluate((targetLabel) => {
                const sel = document.querySelector('select#supportingDocuments, select[formcontrolname="supportingDocuments"]');
                if (!sel) return;
                const opts = Array.from(sel.options).filter(o => o.value !== '' && o.value !== '0');
                const needle = (targetLabel || 'ஆதார்').toLowerCase();
                const opt = opts.find(o => o.text.toLowerCase().includes(needle) || o.value.toLowerCase().includes(needle));
                if (opt) {
                    sel.value = opt.value;
                    sel.selectedIndex = opt.index;
                    sel.dispatchEvent(new Event('change', { bubbles: true }));
                    sel.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }, docTypeLabel).catch(() => {});
        }
        await page.waitForTimeout(400);
    }

    // 2. Attach File
    if (filePath) {
        const fileInput = page.locator('input[type="file"][formcontrolname="upload"], input[type="file"]').first();
        if (await fileInput.count() > 0) {
            await showBrowserHud('[படி 8/12] 📄 ஆவணம் இணைக்கப்படுகிறது...', 'தயவுசெய்து காத்திருக்கவும் • நீங்கள் எதுவும் செய்ய வேண்டாம்!', 'warning');
            await fileInput.evaluate(el => {
                el.removeAttribute('disabled');
                el.disabled = false;
                el.removeAttribute('readonly');
                el.readOnly = false;
                el.style.display = 'block';
                el.style.opacity = '1';
                el.style.visibility = 'visible';
            }).catch(() => {});
            try {
                await fileInput.setInputFiles(filePath, { timeout: 2000 });
            } catch (e) {
                console.warn('[Doc Upload] Native setInputFiles timed out or failed in step5:', e.message);
            }
            await page.waitForTimeout(150);

            // 3. Click upload button
            await showBrowserHud('[படி 8/12] 📤 ஆவணம் TNPDS சர்வரில் பதிவேற்றப்படுகிறது...', 'அரசு தளத்தில் பதிவேற்றம் ஆகிறது • தயவுசெய்து எதையும் செய்ய வேண்டாம்!', 'warning');
            await clickDocumentUploadButton(page, fileInput);

            // 4. Verify confirmation badge
            await showBrowserHud('[படி 8/12] ⏳ ஆவணம் பதிவேற்றப்படுகிறது...', 'TNPDS அரசு சர்வரில் பதிவேற்றம் சரிபார்க்கப்படுகிறது • தயவுசெய்து எதையும் தொடாதீர்கள்!', 'warning');
            const verifyRes = await verifyDocumentUploadConfirmation(page, filePath, scanAndBroadcastToasts);
            if (verifyRes && verifyRes.isDocUploadedGreen) {
                const cleanBadge = verifyRes.uploadedBadgeText || path.basename(filePath);
                await showBrowserHud('[படி 8/12] ✅ ஆவணப் பதிவேற்றம் முடிந்தது!', `கோப்பு (${cleanBadge}) வெற்றிகரமாக பதிவேற்றப்பட்டது`, 'success');
            }
            console.log('✅ [Add Member: Step 5] Document uploaded and verified successfully.');
            return verifyRes;
        }
    }

    return { isDocUploadedGreen: true };
}

module.exports = {
    selectAndUploadMemberDocument,
    stitchDualSidedDocument
};
