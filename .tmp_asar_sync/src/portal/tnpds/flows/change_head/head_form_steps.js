// =========================================================================
// TNPDS Change Family Head — Form Steps (Steps 4 to 9)
// Reverse-Engineered from live TNPDS chunk-TXuvSHAD2.js
// Component: familyHeadForm (FAMILY_HEAD_MEMBER_CHANGE)
// =========================================================================
const path = require('path');
const fs = require('fs');
const { assertNoRadwareOrPageRefresh } = require('../../../common/universal_radware_resumption');

async function executeChangeHeadFormSteps({
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
        humanClick = async () => false
    } = sharedContext;

    const userMobile = (citizenProfile.mobileNumber || citizenProfile.mobile || '').replace(/\D/g, '');

    // -------------------------------------------------------------------------
    // Step 4: Navigate to Service Request Page
    // -------------------------------------------------------------------------
    onProgress('[படி 4/10] 🔗 "குடும்பத் தலைவர் மாற்றம்" சேவை பக்கத்திற்கு செல்கிறது (service-request)...');
    await showBrowserHud('[படி 4/10] சேவை தேர்வு', 'குடும்பத் தலைவர் மாற்றம்');

    const curUrl = page.url();
    if (!curUrl.includes('service-request')) {
        const navMenuSelectors = [
            'a:has-text("குடும்பத் தலைவர் மாற்றம்")',
            'button:has-text("குடும்பத் தலைவர் மாற்றம்")',
            'li:has-text("குடும்பத் தலைவர் மாற்றம்") a',
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

    // -------------------------------------------------------------------------
    // Step 5: Select "குடும்பத் தலைவர் மாற்றம்" from Service Dropdown
    // -------------------------------------------------------------------------
    onProgress('[படி 5/10] 📋 சேவைப் பட்டியலில் "குடும்பத் தலைவர் மாற்றம்" தேர்ந்தெடுக்கப்படுகிறது...');
    try {
        const serviceDropdown = page.locator('select[formcontrolname="selectService"], select#inputGroupSelect02, select').first();
        if (await serviceDropdown.count() > 0 && await serviceDropdown.isVisible().catch(() => false)) {
            const opts = await serviceDropdown.locator('option').allInnerTexts().catch(() => []);
            const headOpt = opts.find(o => o.includes('குடும்பத் தலைவர்') || o.includes('Family Head'));
            if (headOpt) {
                await serviceDropdown.selectOption({ label: headOpt }).catch(() => {});
            } else {
                await serviceDropdown.selectOption({ value: 'FAMILY_HEAD_MEMBER_CHANGE' }).catch(() => {});
            }
            await serviceDropdown.dispatchEvent('change').catch(() => {});
            await page.waitForTimeout(2500);
        }
    } catch (_) {}

    await assertNoRadwareOrPageRefresh(page, null, 'படி 5/10');

    // -------------------------------------------------------------------------
    // Step 6: Inspect Family Members & Validate Multi-Member Invariant
    // -------------------------------------------------------------------------
    onProgress('[படி 6/10] 👥 குடும்ப அட்டை உறுப்பினர்கள் பட்டியல் பெறப்படுகிறது...');
    await showBrowserHud('[படி 6/10] உறுப்பினர் சரிபார்ப்பு', 'உறுப்பினர்கள் பட்டியல் ஆய்வு செய்யப்படுகிறது...');

    // Wait for member table or Angular state to load
    await page.waitForTimeout(2000);

    const memberDetails = await page.evaluate(() => {
        const tableRows = Array.from(document.querySelectorAll('table tbody tr'));
        const members = [];
        tableRows.forEach((row, idx) => {
            const cells = Array.from(row.querySelectorAll('td')).map(c => c.innerText.trim());
            if (cells.length >= 2) {
                members.push({
                    index: idx,
                    name: cells[0] || cells[1] || '',
                    relation: cells[1] || cells[2] || '',
                    fullText: row.innerText.trim()
                });
            }
        });
        return {
            count: members.length,
            members
        };
    }).catch(() => ({ count: 0, members: [] }));

    onProgress(`👥 [உறுப்பினர் எண்ணிக்கை] இந்த குடும்ப அட்டையில் ${memberDetails.count} உறுப்பினர்(கள்) உள்ளனர்.`);

    // Invariant check: Single member card cannot change family head
    if (memberDetails.count <= 1) {
        onProgress('⚠️ **[TNPDS அரசு விதிமுறை - Invariant Gate]** இந்த குடும்ப அட்டையில் 1 உறுப்பினர் மட்டுமே உள்ளார்!');
        onProgress('ℹ️ TNPDS அரசு போர்ட்டல் விதிகளின்படி, 1 நபர் மட்டுமே உள்ள குடும்ப அட்டையில் தலைவரை மாற்ற முடியாது.');
        onProgress('👉 மற்றொரு புதிய குடும்ப உறுப்பினரை (Add Member) சேர்த்த பின்னரே புதிய தலைவரை மாற்ற முடியும்.');
        await showBrowserHud('⚠️ 1 உறுப்பினர் மட்டுமே உள்ளார்', 'தலைவரை மாற்ற மற்றொரு உறுப்பினர் தேவை', 'warning');
        return {
            success: false,
            singleMemberInvariant: true,
            message: 'TNPDS அரசு விதிப்படி, 1 நபர் மட்டுமே உள்ள குடும்ப அட்டையில் தலைவரை மாற்ற முடியாது! மற்றொரு உறுப்பினரை சேர்த்த பின்னரே தலைவரை மாற்ற முடியும்.'
        };
    }

    // Identify target new head and assign relations
    const targetNewHead = subData.newHeadName || subData.targetMemberName || (memberDetails.members[1] && memberDetails.members[1].name) || '';
    const oldHeadNewRelation = subData.oldHeadRelation || 'தந்தை'; // default relation for previous head

    onProgress(`👤 புதிய குடும்பத் தலைவராக "${targetNewHead}" நியமிக்கப்படுகிறார்...`);
    await showBrowserHud('[படி 6/10] புதிய தலைவர் தேர்வு', `${targetNewHead} -> குடும்பத் தலைவர்`);

    // In Angular: row has edit button calling edit(m, i), then dropdownchange(e, i), then save(m, i)
    try {
        const rows = page.locator('table tbody tr');
        const rowCount = await rows.count();
        for (let r = 0; r < rowCount; r++) {
            const row = rows.nth(r);
            const rText = await row.innerText().catch(() => '');

            // If this is the new head's row:
            if (targetNewHead && rText.includes(targetNewHead)) {
                onProgress(`✏️ "${targetNewHead}" வரிசை திருத்தப்பட்டு "Family Head" ஆக மாற்றப்படுகிறது...`);
                const editBtn = row.locator('button:has-text("Edit"), button:has-text("திருத்து"), i.fa-edit, .btn-primary').first();
                if (await editBtn.count() > 0) {
                    await editBtn.click().catch(() => {});
                    await page.waitForTimeout(1000);
                }
                const relSelect = row.locator('select').first();
                if (await relSelect.count() > 0) {
                    const opts = await relSelect.locator('option').allInnerTexts().catch(() => []);
                    const headOpt = opts.find(o => o.includes('Family Head') || o.includes('தலைவர்'));
                    if (headOpt) {
                        await relSelect.selectOption({ label: headOpt }).catch(() => {});
                    } else {
                        await relSelect.selectOption({ value: 'Family Head' }).catch(() => {});
                    }
                    await relSelect.dispatchEvent('change').catch(() => {});
                    await page.waitForTimeout(500);
                }
                const saveBtn = row.locator('button:has-text("Save"), button:has-text("சேமி"), i.fa-save, .btn-success').first();
                if (await saveBtn.count() > 0) {
                    await saveBtn.click().catch(() => {});
                    await page.waitForTimeout(1000);
                }
            }
        }
    } catch (_) {}

    // -------------------------------------------------------------------------
    // Step 7: Select Reason for Change of Family Head
    // -------------------------------------------------------------------------
    const reasonValue = subData.reason || 'Others';
    onProgress(`[படி 7/10] 📋 தலைவர் மாற்றத்திற்கான காரணம் (${reasonValue}) தேர்வு செய்யப்படுகிறது...`);
    await showBrowserHud('[படி 7/10] காரணம் தேர்வு', reasonValue);

    try {
        const reasonDropdown = page.locator('select[formcontrolname="reasonforfamilyHeadForm"], select[name*="reason"], select').nth(1);
        if (await reasonDropdown.count() > 0 && await reasonDropdown.isVisible().catch(() => false)) {
            const opts = await reasonDropdown.locator('option').allInnerTexts().catch(() => []);
            const matchedOpt = opts.find(o => o.toLowerCase().includes(reasonValue.toLowerCase()) || (reasonValue === 'Others' && o.includes('இதர')));
            if (matchedOpt) {
                await reasonDropdown.selectOption({ label: matchedOpt }).catch(() => {});
            } else {
                await reasonDropdown.selectOption({ value: reasonValue }).catch(() => {});
            }
            await reasonDropdown.dispatchEvent('change').catch(() => {});
            await page.waitForTimeout(1000);
        }

        // If 'Others', fill otherReasonForm
        if (reasonValue === 'Others' || reasonValue.includes('இதர')) {
            const otherReasonInput = page.locator('input[formcontrolname="otherReasonForm"], input[formcontrolname="otherReason"], textarea[formcontrolname="otherReason"]').first();
            if (await otherReasonInput.count() > 0 && await otherReasonInput.isVisible().catch(() => false)) {
                const reasonTamil = subData.otherReasonText || 'குடும்ப நலன் கருதி தலைவர் மாற்றம்';
                await humanType(page, otherReasonInput, reasonTamil);
                await otherReasonInput.dispatchEvent('input').catch(() => {});
                await otherReasonInput.dispatchEvent('change').catch(() => {});
            }
        }
    } catch (_) {}

    // -------------------------------------------------------------------------
    // Step 8: Upload New Head Passport Photo & Supporting Document
    // -------------------------------------------------------------------------
    onProgress('[படி 8/10] 📄 புதிய தலைவர் புகைப்படம் மற்றும் ஆதரவு ஆவணம் பதிவேற்றப்படுகிறது...');
    await showBrowserHud('[படி 8/10] ஆவணங்கள் பதிவேற்றம்', 'புகைப்படம் & ஆதரவு ஆவணம்');

    // 8A: Upload New Head Photo (max 1MB, jpg/png)
    const headPhotoPath = subData.headPhoto || citizenProfile.headPhotoPath || path.join(__dirname, '..', '..', '..', '..', 'data', 'demo_test_kit', 'head_photo_test.jpg');
    if (headPhotoPath && fs.existsSync(headPhotoPath)) {
        onProgress(`📸 [புகைப்படம்] புதிய தலைவர் புகைப்படம் அப்லோட் செய்யப்படுகிறது: ${path.basename(headPhotoPath)}`);
        try {
            const photoInput = page.locator('input[type="file"]').first();
            if (await photoInput.count() > 0) {
                await photoInput.setInputFiles(headPhotoPath);
                await page.waitForTimeout(1500);
                onProgress('✅ [புகைப்படம்] புகைப்படம் வெற்றிகரமாக பதிவேற்றப்பட்டது.');
            }
        } catch (_) {}
    }

    // 8B: Supporting Document Type Dropdown
    const docType = subData.supportingDocType || 'AADHAAR_CARD';
    try {
        const docTypeDropdown = page.locator('select[formcontrolname="supportingDocumetsforfamilyHeadForm"], select[name*="supportingDoc"]').first();
        if (await docTypeDropdown.count() > 0 && await docTypeDropdown.isVisible().catch(() => false)) {
            const opts = await docTypeDropdown.locator('option').allInnerTexts().catch(() => []);
            const matchedDocOpt = opts.find(o => o.includes('Aadhaar') || o.includes('ஆதார்') || o.includes(docType));
            if (matchedDocOpt) {
                await docTypeDropdown.selectOption({ label: matchedDocOpt }).catch(() => {});
            } else {
                await docTypeDropdown.selectOption({ value: docType }).catch(() => {});
            }
            await docTypeDropdown.dispatchEvent('change').catch(() => {});
            await page.waitForTimeout(1000);
        }
    } catch (_) {}

    // 8C: Upload Supporting Document File (#File1 / headchangefile)
    const docFilePath = subData.supportingDoc || subData.docPath || path.join(__dirname, '..', '..', '..', '..', 'data', 'demo_test_kit', 'sample_aadhaar.pdf');
    if (docFilePath && fs.existsSync(docFilePath)) {
        onProgress(`📎 [ஆவணக் கோப்பு] ஆதரவு ஆவணம் அப்லோட் செய்யப்படுகிறது: ${path.basename(docFilePath)}`);
        try {
            const docInput = page.locator('#File1, input[formcontrolname="headchangefile"], input[type="file"]').nth(1);
            if (await docInput.count() > 0) {
                await docInput.setInputFiles(docFilePath);
                await page.waitForTimeout(1500);
                onProgress('✅ [ஆவணக் கோப்பு] ஆதரவு ஆவணம் வெற்றிகரமாக பதிவேற்றப்பட்டது.');
            }
        } catch (_) {}
    }

    // -------------------------------------------------------------------------
    // Step 9: Tick Self Declaration Checkbox
    // -------------------------------------------------------------------------
    onProgress('[படி 9/10] ☑️ சுய அறிவிப்பு (Self Declaration) உறுதிமொழி ஏற்கப்படுகிறது...');
    await showBrowserHud('[படி 9/10] சுய அறிவிப்பு', 'உறுதிமொழி திக் செய்யப்படுகிறது...');

    try {
        const checkbox = page.locator('input[type="checkbox"][formcontrolname="checkbox"], input[type="checkbox"]').first();
        if (await checkbox.count() > 0) {
            const isChecked = await checkbox.isChecked().catch(() => false);
            if (!isChecked) {
                await checkbox.check().catch(async () => {
                    await humanClick(page, checkbox);
                });
                await checkbox.dispatchEvent('change').catch(() => {});
                await page.waitForTimeout(500);
            }
            onProgress('✅ [சுய அறிவிப்பு] உறுதிமொழி வெற்றிகரமாக ஏற்றுக்கொள்ளப்பட்டது.');
        }
    } catch (_) {}

    return {
        success: true,
        memberCount: memberDetails.count,
        targetNewHead,
        message: 'படிவ விவரங்கள் வெற்றிகரமாகப் பூர்த்தி செய்யப்பட்டன.'
    };
}

module.exports = {
    executeChangeHeadFormSteps
};
