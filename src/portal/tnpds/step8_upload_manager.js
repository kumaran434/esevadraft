/**
 * eSevaDraft TNPDS Step 8 Document Upload Manager (Modular Architecture)
 * 
 * Handles:
 * 1. Polymorphic targeted upload button clicks (div.btn, button.btn-primary, etc.).
 * 2. Rapid DOM verification of upload status badges, success indicators, and clear buttons.
 * 3. Safe retry on iteration delays.
 */

async function clickDocumentUploadButton(page, targetFileInput) {
    let docUploadBtnClicked = false;

    // Strategy 1: Immediate Targeted Click on blue "பதிவேற்ற" button next to file input
    try {
        const directUploadBtn = page.locator('div.btn-primary:has-text("பதிவேற்ற"), div.btn:has-text("பதிவேற்ற"), button:has-text("பதிவேற்ற"), .btn:has-text("பதிவேற்ற"), div.btn:has-text("பதிவேற்றவும்"), button:has-text("பதிவேற்றவும்")').last();
        if (await directUploadBtn.count() > 0 && await directUploadBtn.isVisible().catch(() => false)) {
            console.log('  🎯 [Doc Upload] Direct click on "பதிவேற்ற" button...');
            await directUploadBtn.scrollIntoViewIfNeeded().catch(() => {});
            await directUploadBtn.click({ force: true, delay: 50 }).catch(() => {});
            docUploadBtnClicked = true;
        }
    } catch (e) {}

    // Strategy 2: Check parent and grandparent container (d-flex align-items-center)
    if (!docUploadBtnClicked && targetFileInput) {
        try {
            const uploadContainer = targetFileInput.locator('xpath=./ancestor::div[contains(@class, "align-items-center") or contains(@class, "form-group")][1]');
            const localUploadBtn = uploadContainer.locator('div.btn, div.btn-primary, button, [class*="btn"]').filter({ hasText: /பதிவேற்ற|பதிவேற்று|பதிவேற்றம்|பதிவேற்றவும்|Upload/i }).first();
            if (await localUploadBtn.count() > 0 && await localUploadBtn.isVisible().catch(() => false)) {
                console.log('  🎯 [Doc Upload] Found local upload element next to file input. Clicking...');
                await localUploadBtn.scrollIntoViewIfNeeded().catch(() => {});
                await localUploadBtn.click({ force: true, delay: 50 }).catch(() => {});
                docUploadBtnClicked = true;
            }
        } catch (e) {}
    }

    // Strategy 3: Fast Selectors Fallback
    if (!docUploadBtnClicked) {
        const docUploadSelectors = [
            'div.btn:has-text("பதிவேற்ற")',
            'div.btn-primary:has-text("பதிவேற்ற")',
            'div[class*="btn"]:has-text("பதிவேற்ற")',
            '.btn:has-text("பதிவேற்ற"):visible',
            'button:has-text("பதிவேற்ற"):visible',
            'div.btn:has-text("பதிவேற்றவும்")',
            'button:has-text("பதிவேற்றவும்"):visible',
            'div.btn:has-text("பதிவேற்று")',
            'button:has-text("பதிவேற்று"):visible',
            'input[formcontrolname="upload"] ~ div.btn',
            'input[formcontrolname="upload"] ~ button'
        ];
        for (const uSel of docUploadSelectors) {
            try {
                const uBtn = page.locator(uSel).last();
                if (await uBtn.count() > 0 && await uBtn.isVisible().catch(() => false)) {
                    console.log(`  🎯 [Doc Upload] Clicking upload element with selector: ${uSel}...`);
                    await uBtn.scrollIntoViewIfNeeded().catch(() => {});
                    await uBtn.click({ force: true, delay: 50 }).catch(() => {});
                    docUploadBtnClicked = true;
                    break;
                }
            } catch (e) {}
        }
    }

    // Strategy 4: Targeted DOM evaluate search
    if (!docUploadBtnClicked) {
        docUploadBtnClicked = await page.evaluate(() => {
            const allClickables = Array.from(document.querySelectorAll('div.btn, div.btn-primary, button, a.btn, span.btn, div[class*="btn"]'));
            const targetBtn = allClickables.find(el => {
                const t = (el.innerText || el.value || '').trim();
                return (t.includes('பதிவேற்ற') || t.includes('பதிவேற்று') || t.includes('பதிவேற்றம்') || t.includes('பதிவேற்றவும்') || t.toLowerCase().includes('upload'));
            });
            if (targetBtn) {
                targetBtn.click();
                return true;
            }
            const anyEl = Array.from(document.querySelectorAll('div, button, a, span')).find(el => {
                const t = (el.innerText || '').trim();
                return (t === 'பதிவேற்ற' || t === 'பதிவேற்று' || t === 'பதிவேற்றவும்' || t.toLowerCase() === 'upload') && el.offsetParent !== null;
            });
            if (anyEl) {
                anyEl.click();
                return true;
            }
            return false;
        }).catch(() => false);
    }

    return docUploadBtnClicked;
}

async function verifyDocumentUploadConfirmation(page, fileName, scanAndBroadcastToasts) {
    let isDocUploadedGreen = false;
    let uploadedBadgeText = '';

    for (let uWait = 0; uWait < 32; uWait++) {
        await page.waitForTimeout(250);
        if (uWait % 4 === 0 && typeof scanAndBroadcastToasts === 'function') {
            await scanAndBroadcastToasts().catch(() => {});
        }

        const checkRes = await page.evaluate((fname) => {
            const leafNodes = Array.from(document.querySelectorAll('span, label, p, b, strong, a, .badge'));
            const badge = leafNodes.find(el => {
                const t = (el.innerText || '').trim();
                return el.offsetParent !== null && t.length < 80 && (t.includes('doc_') || t.includes(fname) || t.includes('.jpeg') || t.includes('.jpg') || t.includes('.png') || t.includes('.pdf') || t.includes('test_sample_doc'));
            });
            const hasGreen = document.querySelectorAll('.badge-success, .bg-success, .text-success, .fa-check, i.fa-check-circle, .alert-success').length > 0;
            const hasClearBtn = Array.from(document.querySelectorAll('button, a')).some(b => b.innerText && b.innerText.trim().toLowerCase() === 'x' && b.offsetParent !== null);
            const allUploadBtns = Array.from(document.querySelectorAll('button, div.btn')).filter(b => {
                const t = (b.innerText || '').trim();
                return t.includes('பதிவேற்ற') || t.includes('பதிவேற்று') || t.includes('பதிவேற்றம்') || t.includes('பதிவேற்றவும்') || t.toLowerCase().includes('upload');
            });
            const isUploadDisabled = allUploadBtns.some(b => b.disabled || b.getAttribute('disabled') !== null);
            const uploadInpVal = (document.querySelector('input[formcontrolname="upload"]')?.value || '').trim();
            const hasUploadText = leafNodes.some(el => {
                const txt = (el.innerText || '').trim();
                return txt.length < 100 && (txt.includes('கோப்பு பதிவேற்றப்பட்டது') || txt.includes('பதிவேற்றப்பட்டது') || txt.toLowerCase().includes('uploaded') || txt.includes('வெற்றிகரமாக'));
            });
            const isSuccess = Boolean(badge || hasGreen || hasClearBtn || (isUploadDisabled && uploadInpVal) || uploadInpVal || hasUploadText);
            let badgeText = '';
            if (badge) {
                const m = (badge.innerText || '').match(/[\w.-]+\.(?:jpeg|jpg|png|pdf)/i);
                badgeText = m ? m[0] : (badge.innerText || '').trim().slice(0, 50);
            } else if (uploadInpVal) {
                const m = uploadInpVal.match(/[\w.-]+\.(?:jpeg|jpg|png|pdf)/i);
                badgeText = m ? m[0] : uploadInpVal.slice(0, 50);
            } else {
                badgeText = fname;
            }
            return { isSuccess, badgeText };
        }, fileName).catch(() => ({ isSuccess: false, badgeText: '' }));

        if (checkRes.isSuccess) {
            isDocUploadedGreen = true;
            uploadedBadgeText = (checkRes.badgeText && checkRes.badgeText.length < 60) ? checkRes.badgeText : fileName;
            break;
        }

        // If not yet uploaded by iteration 6 (1.5s) or 14 (3.5s), retry clicking upload button once
        if (uWait === 6 || uWait === 14) {
            await page.locator('div.btn-primary:has-text("பதிவேற்ற"), div.btn:has-text("பதிவேற்ற"), button:has-text("பதிவேற்ற"), div.btn:has-text("பதிவேற்றவும்"), button:has-text("பதிவேற்றவும்"), button.btn-primary').last().click({ force: true }).catch(() => {});
        }
    }

    return { isDocUploadedGreen, uploadedBadgeText };
}

module.exports = {
    clickDocumentUploadButton,
    verifyDocumentUploadConfirmation
};
