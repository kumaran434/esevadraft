// =========================================================================
// TNPDS Remove Member — Form Filling & Document Upload (Steps 4 to 8)
// Reverse-Engineered & Modular Production Implementation
// =========================================================================
const fs = require('fs');
const path = require('path');
const { assertNoRadwareOrPageRefresh } = require('../../../common/universal_radware_resumption');

async function executeRemoveMemberFormSteps({
    page,
    subData = {},
    citizenProfile = {},
    options = {},
    onProgress = () => {},
    sharedContext = {}
}) {
    const {
        showBrowserHud = async () => {},
        humanType = async () => {},
        humanClick = async () => false,
        produceCompliantDocument = async (p) => p
    } = sharedContext;

    const userMobile = (citizenProfile.mobileNumber || citizenProfile.mobile || '').replace(/\D/g, '');
    const memberNameTam = (subData.memberNameTam || subData.memberName || citizenProfile.memberNameTam || citizenProfile.fullNameTam || '').trim();
    const memberNameEng = (subData.memberNameEng || subData.memberName || citizenProfile.memberNameEng || citizenProfile.fullNameEng || '').trim();
    const reason = (subData.reason || 'இறப்பு (Death of Member)').trim();
    const docType = (subData.docType || 'இறப்புச் சான்றிதழ்').trim();
    const targetAadhaar = (subData.aadhaarNo || '').replace(/\D/g, '');

    // -------------------------------------------------------------------------
    // Step 4: Navigate to Service Request Page and Select "குடும்ப உறுப்பினர் நீக்க"
    // -------------------------------------------------------------------------
    onProgress('[படி 4/10] 🔗 "குடும்ப உறுப்பினர் நீக்க" சேவை பக்கத்திற்கு செல்கிறது (service-request)...');
    await showBrowserHud('[படி 4/10] சேவை தேர்வு', 'குடும்ப உறுப்பினர் நீக்கம்');

    const curUrl = page.url();
    if (!curUrl.includes('service-request')) {
        const navMenuSelectors = [
            'a:has-text("உறுப்பினர் நீக்க")',
            'button:has-text("உறுப்பினர் நீக்க")',
            'li:has-text("உறுப்பினர் நீக்க") a',
            'span:has-text("உறுப்பினர் நீக்க")',
            '[routerlink*="service-request"]',
            'a[href*="service-request"]'
        ];
        for (const mSel of navMenuSelectors) {
            try {
                const mEl = page.locator(mSel).first();
                if (await mEl.count() > 0 && await mEl.isVisible().catch(() => false)) {
                    await mEl.click({ timeout: 5000 }).catch(() => {});
                    await page.waitForTimeout(2500);
                    if (page.url().includes('service-request')) break;
                }
            } catch (_) {}
        }
        if (!page.url().includes('service-request')) {
            try {
                await page.goto('https://www.tnpds.gov.in/pages/service-request', { waitUntil: 'domcontentloaded', timeout: 25000 });
                await page.waitForTimeout(2500);
            } catch (_) {}
        }
    }

    try {
        const serviceDropdown = page.locator('select[formcontrolname="selectService"], select#inputGroupSelect02, select[formcontrolname="serviceType"], select').first();
        if (await serviceDropdown.count() > 0 && await serviceDropdown.isVisible().catch(() => false)) {
            const opts = await serviceDropdown.locator('option').allInnerTexts().catch(() => []);
            const removeOpt = opts.find(o => o.includes('நீக்க') || o.includes('Remove'));
            if (removeOpt) {
                await serviceDropdown.selectOption({ label: removeOpt }).catch(() => {});
            } else {
                await serviceDropdown.selectOption({ value: 'REMOVE_FAMILY_MEMBER' }).catch(() => {});
            }
            await serviceDropdown.dispatchEvent('change').catch(() => {});
            await page.waitForTimeout(2000);
        }
    } catch (_) {}

    await assertNoRadwareOrPageRefresh(page, null, 'படி 5/10');

    // -------------------------------------------------------------------------
    // Step 5: Table Inspection & Selecting Target Member
    // -------------------------------------------------------------------------
    onProgress(`[படி 5/10] 👥 குடும்ப உறுப்பினர்கள் அட்டவணை சரிபார்க்கப்படுகிறது...`);
    await showBrowserHud('[படி 5/10] அட்டவணை ஆய்வு', 'உறுப்பினர் சரிபார்ப்பு');

    // Live DOM Inspection of Members Table
    const memberAudit = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('table tbody tr')).map((r, i) => {
            const cells = Array.from(r.querySelectorAll('td')).map(c => c.innerText.trim());
            const chk = r.querySelector('input[type="checkbox"]');
            return {
                index: i,
                siNo: cells[0] || String(i + 1),
                nameEng: cells[1] || '',
                nameTam: cells[2] || '',
                gender: cells[3] || '',
                age: cells[4] || '',
                relation: cells[5] || '',
                status: cells[6] || '',
                isHead: (cells[5] || '').includes('தலைவர்') || (cells[5] || '').toLowerCase().includes('head'),
                hasCheckbox: Boolean(chk),
                isCheckboxDisabled: chk ? chk.disabled : false,
                isCheckboxChecked: chk ? chk.checked : false
            };
        });
        return {
            totalMembers: rows.length,
            rows
        };
    }).catch(() => ({ totalMembers: 0, rows: [] }));

    onProgress(`📊 [குடும்ப அட்டை விவரம்] அட்டவணையில் உள்ள மொத்த உறுப்பினர்கள்: ${memberAudit.totalMembers} நபர்(கள்).`);

    // TNPDS Portal Rule: Single-member ration card cannot remove the only member (Family Head)
    if (memberAudit.totalMembers === 1 && memberAudit.rows[0]?.isHead) {
        const headMember = memberAudit.rows[0];
        onProgress(`⚠️ **[TNPDS அரசு போர்ட்டல் கட்டுப்பாடு — Single Member Card]**`);
        onProgress(`📌 இந்த குடும்ப அட்டையில் 1 நபர் (${headMember.nameTam || headMember.nameEng}) மட்டுமே உள்ளார். அவர் குடும்பத் தலைவர் (Family Head) ஆவார்.`);
        onProgress(`🛑 தமிழ்நாடு அரசு TNPDS விதிகளின்படி, குடும்பத் தலைவரை "உறுப்பினர் நீக்கம்" (REMOVE_MEMBER) மூலம் நீக்க முடியாது! (போர்ட்டலில் தேர்வுப் பெட்டி முடக்கப்பட்டுள்ளது - Disabled).`);
        onProgress(`💡 குடும்பத் தலைவரை மாற்ற "குடும்பத் தலைவர் மாற்றம்" (Family Head Change) அல்லது அட்டை இரத்து செய்ய "அட்டை ஒப்படைப்பு" சேவையையே பயன்படுத்த வேண்டும்.`);
        await showBrowserHud('⚠️ குடும்பத் தலைவரை நீக்க முடியாது', 'TNPDS அரசு விதி: குடும்பத் தலைவரை நீக்க முடியாது', 'warning');

        return {
            success: true,
            isBlockedBySingleMemberHead: true,
            totalMembers: 1,
            headMemberName: headMember.nameTam || headMember.nameEng,
            message: 'TNPDS அரசு போர்ட்டல் கட்டுப்பாடு: குடும்பத் தலைவரை (Family Head) உறுப்பினர் நீக்கம் செய்ய முடியாது. குடும்ப அட்டையில் குறைந்தபட்சம் 2 உறுப்பினர்கள் இருக்க வேண்டும்.'
        };
    }

    // Find the member to remove (strictly non-head member)
    let targetRowIndex = -1;
    for (let i = 0; i < memberAudit.rows.length; i++) {
        const row = memberAudit.rows[i];
        if (row.isHead) continue; // Family Head cannot be removed

        const matchesNameTam = memberNameTam && row.nameTam.includes(memberNameTam);
        const matchesNameEng = memberNameEng && row.nameEng.toLowerCase().includes(memberNameEng.toLowerCase());
        const matchesAadhaar = targetAadhaar && targetAadhaar.length >= 4 && (row.nameTam + row.nameEng).includes(targetAadhaar.slice(-4));

        if (matchesNameTam || matchesNameEng || matchesAadhaar) {
            targetRowIndex = i;
            break;
        }
    }

    // Default to the first eligible non-head member if no specific match
    if (targetRowIndex === -1) {
        targetRowIndex = memberAudit.rows.findIndex(r => !r.isHead);
    }

    if (targetRowIndex === -1) {
        onProgress('⚠️ [உறுப்பினர் நீக்க இயலாது] அட்டவணையில் நீக்குவதற்கு தகுதியான பிற உறுப்பினர்கள் எவரும் இல்லை (குடும்பத் தலைவர் மட்டுமே உள்ளார்).');
        return {
            success: false,
            message: 'நீக்குவதற்கு தகுதியான உறுப்பினர் அட்டவணையில் இல்லை.'
        };
    }

    const selectedMember = memberAudit.rows[targetRowIndex];
    onProgress(`✅ [உறுப்பினர் தேர்வு] நீக்கப்பட உள்ள உறுப்பினர்: "${selectedMember.nameTam || selectedMember.nameEng}" (உறவு: ${selectedMember.relation})...`);
    await showBrowserHud('[படி 5/10] உறுப்பினர் தேர்வு', `${selectedMember.nameTam || selectedMember.nameEng}`);

    // Click target member's checkbox to open TNPDS RemoveMemberModal
    const rowLocator = page.locator('table tbody tr').nth(targetRowIndex);
    const rowCheckbox = rowLocator.locator('input[type="checkbox"]').first();

    if (await rowCheckbox.count() > 0) {
        await rowCheckbox.scrollIntoViewIfNeeded().catch(() => {});
        await rowCheckbox.click({ force: true }).catch(() => {});
        await page.waitForTimeout(1500);
    }

    // -------------------------------------------------------------------------
    // Step 6: Handle TNPDS RemoveMemberModal (Reason Selection)
    // -------------------------------------------------------------------------
    onProgress(`[படி 6/10] 📋 நீக்குவதற்கான காரணம் மற்றும் விவரங்கள் பாப்-அப் மாடலில் பூர்த்தி செய்யப்படுகிறது...`);
    await showBrowserHud('[படி 6/10] காரணம் தேர்வு', reason);

    // Wait for the modal container
    const modalDialog = page.locator('.custom-modal-dialog, div:has(h5:has-text("உறுப்பினர் நீக்க")), div.modal-dialog').first();
    let isModalOpen = false;
    for (let w = 0; w < 10; w++) {
        if (await modalDialog.count() > 0 && await modalDialog.isVisible().catch(() => false)) {
            isModalOpen = true;
            break;
        }
        await page.waitForTimeout(500);
    }

    if (isModalOpen) {
        onProgress('✅ [பாப்-அப் மாடல் திறக்கப்பட்டது] உறுப்பினர் நீக்க விவரங்கள் படிவம் நிரப்பப்படுகிறது...');
        
        // Select Reason Dropdown inside modal
        const modalReasonSelect = modalDialog.locator('select').first();
        if (await modalReasonSelect.count() > 0 && await modalReasonSelect.isVisible().catch(() => false)) {
            const opts = await modalReasonSelect.locator('option').allInnerTexts().catch(() => []);
            let targetOpt = null;
            if (reason.includes('இறப்பு') || reason.toLowerCase().includes('death')) {
                targetOpt = opts.find(o => o.includes('இறப்பு') || o.includes('Death'));
            } else if (reason.includes('திருமணம்') || reason.toLowerCase().includes('marriage')) {
                targetOpt = opts.find(o => o.includes('திருமணம்') || o.includes('Marriage'));
            } else if (reason.includes('தத்தெடுப்பு') || reason.toLowerCase().includes('adoption')) {
                targetOpt = opts.find(o => o.includes('தத்தெடுப்பு') || o.includes('Adoption'));
            } else if (reason.includes('விவாகரத்து') || reason.toLowerCase().includes('divorce')) {
                targetOpt = opts.find(o => o.includes('விவாகரத்து') || o.includes('Divorce'));
            } else {
                targetOpt = opts.find(o => o.includes('இதர') || o.includes('Others') || o.includes('மற்றவை'));
            }

            if (targetOpt) {
                await modalReasonSelect.selectOption({ label: targetOpt }).catch(() => {});
            } else {
                await modalReasonSelect.selectOption({ index: 1 }).catch(() => {});
            }
            await modalReasonSelect.dispatchEvent('change').catch(() => {});
            await page.waitForTimeout(1000);
        }

        // If 'Others' reason selected, fill Reason details
        const engReasonInput = modalDialog.locator('input[formcontrolname="Removemember_reason"], input[name*="reasonEng"]').first();
        const tamReasonInput = modalDialog.locator('input[formcontrolname="TamilReason"], input[name*="reasonTam"]').first();
        if (await engReasonInput.count() > 0 && await engReasonInput.isVisible().catch(() => false)) {
            await humanType(page, engReasonInput, reason);
            if (await tamReasonInput.count() > 0 && await tamReasonInput.isVisible().catch(() => false)) {
                await humanType(page, tamReasonInput, subData.reasonTam || 'பிற காரணங்கள்');
            }
        }

        // -------------------------------------------------------------------------
        // Step 7: Document Upload (<100KB Compliant Proof) inside Modal
        // -------------------------------------------------------------------------
        onProgress(`[படி 7/10] 📁 நீக்கல் சான்றிதழ் ஆவணம் பதிவேற்றப்படுகிறது (<100KB அரசு தரம்)...`);
        await showBrowserHud('[படி 7/10] ஆவணம் பதிவேற்றம்', docType);

        let localDocPath = subData.docPath || subData.removeProofDocPath || citizenProfile.documents?.removeProof || '';
        if (!localDocPath || !fs.existsSync(localDocPath)) {
            const appDataUploads = process.env.APPDATA ? path.join(process.env.APPDATA, 'esevadraft-desktop', 'data', 'uploads', userMobile) : '';
            const wsUploads = path.join(__dirname, '..', '..', '..', '..', 'data', 'uploads', userMobile);
            const candidates = [
                appDataUploads && path.join(appDataUploads, 'remove_proof.pdf'),
                path.join(wsUploads, 'remove_proof.pdf'),
                appDataUploads && path.join(appDataUploads, 'aadhaar.pdf'),
                path.join(wsUploads, 'aadhaar.pdf'),
                appDataUploads && path.join(appDataUploads, 'death.pdf'),
                path.join(wsUploads, 'death.pdf')
            ].filter(Boolean);
            for (const cand of candidates) {
                if (fs.existsSync(cand)) { localDocPath = cand; break; }
            }
        }

        if (localDocPath && fs.existsSync(localDocPath)) {
            try {
                const compliantDoc = await produceCompliantDocument(localDocPath);
                const fileInput = modalDialog.locator('input[type="file"]').first();
                if (await fileInput.count() > 0) {
                    await fileInput.setInputFiles(compliantDoc).catch(() => {});
                    await page.waitForTimeout(1000);
                    onProgress('✅ [ஆவணம் பதிவேற்றம்] சான்றிதழ் பாப்-அப் மாடலில் பதிவேற்றப்பட்டது!');
                }
            } catch (eUp) {
                onProgress(`⚠️ ஆவண பதிவேற்றம் குறிப்பு: ${eUp.message}`);
            }
        }

        // Click Modal Submit Button (RemoveMember_ModalSubmit)
        const modalSubmitBtn = modalDialog.locator('button:has-text("சமர்ப்பிக்க"), button:has-text("Submit"), button.btn-primary').last();
        if (await modalSubmitBtn.count() > 0) {
            onProgress('💾 [மாடல் சமர்ப்பிப்பு] உறுப்பினர் நீக்க விவரங்கள் சேமிக்கப்படுகின்றன...');
            await modalSubmitBtn.click({ force: true }).catch(() => {});
            await page.waitForTimeout(2000);
        }
    } else {
        onProgress('ℹ️ பாப்-அப் மாடல் கண்டறியப்படவில்லை; முதன்மை படிவத்தில் நேரடியாக தொடரப்படுகிறது...');
    }

    await assertNoRadwareOrPageRefresh(page, null, 'படி 8/10');

    // -------------------------------------------------------------------------
    // Step 8: Self Declaration Checkbox on Main Page
    // -------------------------------------------------------------------------
    onProgress('[படி 8/10] ✍️ சுய உறுதிமொழி (Declaration Checkbox) தேர்வு செய்யப்படுகிறது...');
    await showBrowserHud('[படி 8/10] சுய உறுதிமொழி', 'விதிமுறைகள் ஏற்றுக்கொள்ளப்பட்டது');
    try {
        const declCheckbox = page.locator('input[type="checkbox"]:not([disabled])').last();
        if (await declCheckbox.count() > 0) {
            await declCheckbox.scrollIntoViewIfNeeded().catch(() => {});
            const isChecked = await declCheckbox.isChecked().catch(() => false);
            if (!isChecked) {
                await declCheckbox.check({ force: true }).catch(() => {});
                await declCheckbox.dispatchEvent('change').catch(() => {});
                await page.waitForTimeout(1000);
            }
        }
    } catch (_) {}

    return { success: true };
}

module.exports = {
    executeRemoveMemberFormSteps
};
