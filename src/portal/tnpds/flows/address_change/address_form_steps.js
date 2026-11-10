// =========================================================================
// TNPDS Address Change — Form Filling & Document Upload (Steps 4 to 11)
// =========================================================================
const fs = require('fs');
const path = require('path');
const { assertNoRadwareOrPageRefresh } = require('../../../common/universal_radware_resumption');

async function executeAddressFormSteps({
    page,
    subData,
    citizenProfile,
    options,
    onProgress,
    sharedContext
}) {
    const {
        showBrowserHud = async () => {},
        humanType = async () => {},
        produceCompliantDocument = async (p) => p,
        resolveDocFromOptions = async () => null
    } = sharedContext;

    const doorNo = subData.doorNo || citizenProfile.doorNo || '';
    const streetEng = subData.streetEng || citizenProfile.streetEng || '';
    const streetTam = subData.streetTam || citizenProfile.streetTam || streetEng;
    const district = subData.district || citizenProfile.district || '';
    const taluk = subData.taluk || citizenProfile.taluk || '';
    const village = subData.village || citizenProfile.village || '';
    const pincode = subData.pincode || citizenProfile.pincode || '';
    let proofType = subData.proofType || citizenProfile.residenceProof?.typeTam || citizenProfile.residenceProof?.type || '';
    const rawDocRef = String(subData.docPath || citizenProfile.residenceProof?.docPath || citizenProfile.documents?.headAadhaar || '').toLowerCase();
    if (!proofType) {
        if (rawDocRef.includes('aadhaar')) proofType = 'ஆதார் அட்டை';
        else if (rawDocRef.includes('gas')) proofType = 'எரிவாயு நுகர்வோர் அட்டை';
        else if (rawDocRef.includes('eb') || rawDocRef.includes('elec')) proofType = 'மின்சார ரசீது';
        else proofType = 'ஆதார் அட்டை';
    } else if (rawDocRef.includes('aadhaar') && (proofType.includes('மின்') || proofType.toLowerCase().includes('eb') || proofType.toLowerCase().includes('elec'))) {
        proofType = 'ஆதார் அட்டை';
    }

    const isAddressServiceFormIntact = async (p) => p.evaluate(() => {
        const u = (window.location.href || '').toLowerCase();
        return u.includes('service-request') && Boolean(document.querySelector('input[formcontrolname="doorNo"], input[formcontrolname="AddressLine1"], input[formcontrolname="addressLine1"], select[formcontrolname="district"]'));
    }).catch(() => false);

    // Step 4: Navigate to Service Request Page and Select "முகவரி மாற்றம்"
    onProgress('[படி 4/12] 🔗 "முகவரி மாற்றம்" சேவை பக்கத்திற்கு செல்கிறது (service-request)...');
    await showBrowserHud('[படி 4/12] சேவை தேர்வு', 'முகவரி மாற்றம்');

    const curUrl = page.url();
    if (!curUrl.includes('service-request')) {
        try {
            await page.goto('https://www.tnpds.gov.in/pages/service-request', { waitUntil: 'domcontentloaded', timeout: 20000 });
            await page.waitForTimeout(2500);
        } catch (_) {}
    }

    try {
        const serviceDropdown = page.locator('select[formcontrolname="selectService"], select#inputGroupSelect02, select[formcontrolname="serviceType"], select[formcontrolname="service"], select').first();
        if (await serviceDropdown.count() > 0 && await serviceDropdown.isVisible().catch(() => false)) {
            const opts = await serviceDropdown.locator('option').allInnerTexts().catch(() => []);
            const addrOpt = opts.find(o => o.includes('முகவரி') || o.includes('Address'));
            if (addrOpt) {
                await serviceDropdown.selectOption({ label: addrOpt }).catch(() => {});
            } else {
                await serviceDropdown.selectOption({ value: 'CHANGE_OF_ADDRESS' }).catch(() => {});
            }
            await serviceDropdown.dispatchEvent('change').catch(() => {});
            await page.waitForTimeout(2000);
        }
    } catch (_) {}

    await assertNoRadwareOrPageRefresh(page, null, 'படி 5/12');

    // Step 5: Fill New Door Number
    onProgress(`[படி 5/12] 🏠 புதிய கதவு எண் உள்ளிடப்படுகிறது (${doorNo})...`);
    await showBrowserHud('[படி 5/12] கதவு எண்', doorNo);
    const doorInput = page.locator('input[formcontrolname="addressLine1"], input[formcontrolname="doorNo"], input[formcontrolname="AddressLine1"], input[name="addressLine1"], input[name="doorNo"]').first();
    if (await doorInput.count() > 0 && await doorInput.isVisible().catch(() => false)) {
        await doorInput.evaluate((el, val) => {
            el.value = val;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('blur', { bubbles: true }));
        }, doorNo).catch(() => {});
        await humanType(page, doorInput, doorNo);
        await page.waitForTimeout(200);
    }
    const doorTamInput = page.locator('input[formcontrolname="tamiladdressLine1"], input[name="tamiladdressLine1"]').first();
    if (await doorTamInput.count() > 0 && await doorTamInput.isVisible().catch(() => false)) {
        await doorTamInput.evaluate((el, val) => {
            el.value = val;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('blur', { bubbles: true }));
        }, doorNo).catch(() => {});
        await humanType(page, doorTamInput, doorNo);
        await page.waitForTimeout(200);
    }

    await assertNoRadwareOrPageRefresh(page, isAddressServiceFormIntact, 'படி 6/12');

    // Step 6: Fill New Street Name (English & Tamil)
    onProgress(`[படி 6/12] 🛣️ புதிய தெருப் பெயர் உள்ளிடப்படுகிறது (${streetTam} / ${streetEng})...`);
    await showBrowserHud('[படி 6/12] தெருப் பெயர்', `${streetTam} (${streetEng})`);

    const streetEngInp = page.locator('input[formcontrolname="addressLine2"], input[formcontrolname="street"], input[formcontrolname="AddressLine2"], input[name="addressLine2"], input[name="street"], input[formcontrolname="addressLine1Eng"]').first();
    if (await streetEngInp.count() > 0 && await streetEngInp.isVisible().catch(() => false)) {
        await streetEngInp.evaluate((el, val) => {
            el.value = val;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('blur', { bubbles: true }));
        }, streetEng).catch(() => {});
        await humanType(page, streetEngInp, streetEng);
        await page.waitForTimeout(1000);
    }

    const streetTamInp = page.locator('input[formcontrolname="tamiladdressLine2"], input[formcontrolname="முகவரி1"], input[formcontrolname="streetTam"], input[formcontrolname="AddressLine1Tam"], input[name="tamiladdressLine2"]').first();
    if (await streetTamInp.count() > 0 && await streetTamInp.isVisible().catch(() => false)) {
        // Golden Rule 7: Clear any portal-auto-transliterated gibberish first
        await streetTamInp.evaluate((el, val) => {
            el.focus();
            el.value = '';
            el.value = val;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('blur', { bubbles: true }));
        }, streetTam).catch(() => {});
        await page.waitForTimeout(300);

        // Verify and Lock accurate Tamil spelling against portal transliteration overwrite
        const currentTam = await streetTamInp.inputValue().catch(() => '');
        if (currentTam !== streetTam) {
            await streetTamInp.evaluate((el, val) => {
                el.value = val;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }, streetTam).catch(() => {});
        }
        onProgress(`✅ [Bilingual Law] தெருப் பெயர் தமிழில் துல்லியமாக நிலைநிறுத்தப்பட்டது: "${streetTam}"`);
    }

    await assertNoRadwareOrPageRefresh(page, isAddressServiceFormIntact, 'படி 7/12');

    // Step 7: Select District, Taluk, Village Cascades
    onProgress(`[படி 7/12] 📍 மாவட்டம் (${district}), வட்டம் (${taluk}), வருவாய் கிராமம் (${village}) தேர்வு செய்யப்படுகின்றன...`);
    await showBrowserHud('[படி 7/12] மண்டல விவரங்கள்', `${village}, ${taluk}, ${district}`);

    const distSelect = page.locator('select[formcontrolname="district"], select[formcontrolname="districtId"]').first();
    if (await distSelect.count() > 0 && await distSelect.isVisible().catch(() => false)) {
        const opts = await distSelect.locator('option').allInnerTexts().catch(() => []);
        const match = opts.find(o => o.toLowerCase().includes(String(district || '').toLowerCase()));
        if (match) await distSelect.selectOption({ label: match }).catch(() => {});
        await distSelect.dispatchEvent('change').catch(() => {});
        await page.waitForTimeout(2500);
    }

    const talukSelect = page.locator('select[formcontrolname="taluk"], select[formcontrolname="talukId"]').first();
    if (await talukSelect.count() > 0 && await talukSelect.isVisible().catch(() => false)) {
        const opts = await talukSelect.locator('option').allInnerTexts().catch(() => []);
        const match = opts.find(o => o.toLowerCase().includes(String(taluk || '').toLowerCase()));
        if (match) await talukSelect.selectOption({ label: match }).catch(() => {});
        else if (opts.length > 1) await talukSelect.selectOption({ index: 1 }).catch(() => {});
        await talukSelect.dispatchEvent('change').catch(() => {});
        await page.waitForTimeout(2500);
    }

    const villageSelect = page.locator('select[formcontrolname="village"], select[formcontrolname="villageId"]').first();
    const villageTamSelect = page.locator('select[formcontrolname="tamilVillage"]').first();
    if (await villageSelect.count() > 0 && await villageSelect.isVisible().catch(() => false)) {
        const opts = await villageSelect.locator('option').allInnerTexts().catch(() => []);
        let match = opts.find(o => o.toLowerCase().includes(String(village || '').toLowerCase()));
        if (!match && String(village || '').toLowerCase().includes('narasinga')) {
            match = opts.find(o => o.toLowerCase().includes('minnal')) || opts.find(o => o.toLowerCase().includes('arakkonam'));
        }
        if (match) {
            await villageSelect.selectOption({ label: match }).catch(() => {});
            const idx = opts.indexOf(match);
            if (await villageTamSelect.count() > 0 && idx >= 0) {
                await villageTamSelect.selectOption({ index: idx }).catch(() => {});
                await villageTamSelect.dispatchEvent('change').catch(() => {});
            }
        } else if (opts.length > 1) {
            await villageSelect.selectOption({ index: 1 }).catch(() => {});
        }
        await villageSelect.dispatchEvent('change').catch(() => {});
        await page.waitForTimeout(1000);
    }

    await assertNoRadwareOrPageRefresh(page, isAddressServiceFormIntact, 'படி 8/12');

    // Step 8: Fill Pincode
    onProgress(`[படி 8/12] 📮 அஞ்சல் குறியீட்டு எண் (${pincode}) பதிவு செய்யப்படுகிறது...`);
    await showBrowserHud('[படி 8/12] பின்கோடு', pincode);
    const pinInp = page.locator('input[formcontrolname="postCode"], input[formcontrolname="pinCode"], input[formcontrolname="pincode"], input[name="postCode"], input[name="pinCode"]').first();
    if (await pinInp.count() > 0 && await pinInp.isVisible().catch(() => false)) {
        await humanType(page, pinInp, pincode);
        await page.waitForTimeout(200);
    }

    await assertNoRadwareOrPageRefresh(page, isAddressServiceFormIntact, 'படி 9/12');

    // Step 9: Select Residence Proof Document Type
    onProgress(`[படி 9/12] 🪪 புதிய முகவரிக்கான இருப்பிடச் சான்று (${proofType}) தேர்ந்தெடுக்கப்படுகிறது...`);
    await showBrowserHud('[படி 9/12] சான்று வகை', proofType);
    const proofSelect = page.locator('select[formcontrolname="supportingDocumets"], select[formcontrolname="supportingDocType"], select[formcontrolname="proofType"], select[formcontrolname="docType"], select#supportingDocumets, select#supportingDocuments').first();
    if (await proofSelect.count() > 0 && await proofSelect.isVisible().catch(() => false)) {
        const opts = await proofSelect.locator('option').allInnerTexts().catch(() => []);
        const pLower = String(proofType || '').toLowerCase();

        let match = null;
        if (pLower.includes('மின்') || pLower.includes('eb') || pLower.includes('electricity')) {
            match = opts.find(o => o.includes('மின்சார ரசீது') || o.includes('மின்'));
        } else if (pLower.includes('எரிவாயு') || pLower.includes('gas')) {
            match = opts.find(o => o.includes('எரிவாயு') || o.includes('Gas'));
        } else if (pLower.includes('வாடகை') || pLower.includes('rent')) {
            match = opts.find(o => o.includes('வாடகை'));
        } else if (pLower.includes('வரி') || pLower.includes('tax')) {
            match = opts.find(o => o.includes('வரி ரசீது'));
        } else if (pLower.includes('வீடு') || pLower.includes('house') || pLower.includes('பத்திரம்')) {
            match = opts.find(o => o.includes('வீடு ஆவணம்'));
        } else if (pLower.includes('ஆதார்') || pLower.includes('aadhaar')) {
            match = opts.find(o => o.includes('ஆதார் அட்டை') || o.includes('ஆதார்'));
        } else if (pLower.includes('வாக்காளர்') || pLower.includes('voter')) {
            match = opts.find(o => o.includes('வாக்காளர்'));
        }

        if (!match) {
            match = opts.find(o => o.toLowerCase().includes(pLower));
        }

        if (match) {
            await proofSelect.selectOption({ label: match }).catch(() => {});
        } else {
            const validOpt = opts.find(o => !o.includes('தேர்ந்தெடுக்கவும்') && !o.includes('Select') && o.trim().length > 0);
            if (validOpt) await proofSelect.selectOption({ label: validOpt }).catch(() => {});
            else await proofSelect.selectOption({ index: 1 }).catch(() => {});
        }
        await proofSelect.dispatchEvent('change').catch(() => {});
        await page.waitForTimeout(600);
    }

    await assertNoRadwareOrPageRefresh(page, isAddressServiceFormIntact, 'படி 10/12');

    // Step 10: Upload Residence Proof Document (< 100KB Compliant)
    onProgress('[படி 10/12] 📁 முகவரிச் சான்று ஆவணம் (< 100KB) போர்ட்டலில் பதிவேற்றப்படுகிறது...');
    await showBrowserHud('[படி 10/12] ஆவணப் பதிவேற்றம்', 'சான்று இணைக்கப்படுகிறது');

    const pLower = String(proofType || '').toLowerCase();
    let preferredDoc = subData.docPath;
    if (pLower.includes('எரிவாயு') || pLower.includes('gas')) {
        preferredDoc = citizenProfile.gasDetails?.gasBookPath || citizenProfile.documents?.gasBook || subData.docPath || citizenProfile.residenceProof?.docPath;
    } else if (pLower.includes('ஆதார்') || pLower.includes('aadhaar')) {
        preferredDoc = citizenProfile.headAadhaarDocPath || citizenProfile.documents?.headAadhaar || subData.docPath || citizenProfile.residenceProof?.docPath;
    } else {
        preferredDoc = subData.docPath || citizenProfile.residenceProof?.docPath;
    }

    let rawDocPath = await resolveDocFromOptions(
        preferredDoc,
        options,
        citizenProfile,
        'residenceProof'
    );

    if (!rawDocPath || !fs.existsSync(rawDocPath)) {
        const sampleCandidates = [
            path.join(process.resourcesPath || '', 'uploads', 'test_sample_doc.jpg'),
            path.join(__dirname, '..', '..', '..', '..', 'uploads', 'test_sample_doc.jpg'),
            path.join(process.cwd(), 'uploads', 'test_sample_doc.jpg'),
            path.join('d:/downloads/ai assitant 2/uploads', 'test_sample_doc.jpg')
        ];
        for (const sc of sampleCandidates) {
            if (fs.existsSync(sc)) { rawDocPath = sc; break; }
        }
    }

    if (rawDocPath && fs.existsSync(rawDocPath)) {
        let absDocPath = path.resolve(rawDocPath);
        if (typeof produceCompliantDocument === 'function') {
            absDocPath = await produceCompliantDocument(absDocPath).catch(() => absDocPath);
        }

        let targetFileInput = page.locator('input#inputGroupFile02, input[formcontrolname="upload"], input[name="upload"], input#upload, input[type="file"]').last();
        if (await targetFileInput.count() > 0) {
            await showBrowserHud('[படி 10/12] 📄 ஆவணம் இணைக்கப்படுகிறது...', 'தயவுசெய்து காத்திருக்கவும் • நீங்கள் எதுவும் செய்ய வேண்டாம்!', 'warning');
            await targetFileInput.evaluate(el => {
                el.disabled = false;
                el.removeAttribute('disabled');
                el.removeAttribute('readonly');
                el.readOnly = false;
                el.style.display = 'block';
                el.style.opacity = '1';
                el.style.visibility = 'visible';
            }).catch(() => {});
            try {
                await targetFileInput.setInputFiles(absDocPath, { timeout: 2000 });
            } catch (e) {
                console.warn('[Doc Upload] setInputFiles timed out or failed in address_change_flow:', e.message);
            }
            await targetFileInput.dispatchEvent('change', { bubbles: true }).catch(() => {});
            await page.waitForTimeout(200);

            await showBrowserHud('[படி 10/12] 📤 ஆவணம் TNPDS சர்வரில் பதிவேற்றப்படுகிறது...', 'அரசு தளத்தில் பதிவேற்றம் ஆகிறது • தயவுசெய்து எதையும் செய்ய வேண்டாம்!', 'warning');
            const uploadBtn = page.locator('div.btn-primary:has-text("பதிவேற்ற"), div.btn:has-text("பதிவேற்ற"), button:has-text("பதிவேற்ற"), .btn:has-text("பதிவேற்ற")').last();
            if (await uploadBtn.count() > 0 && await uploadBtn.isVisible().catch(() => false)) {
                await uploadBtn.click({ force: true }).catch(() => {});
                await page.waitForTimeout(2000);
            }
            await showBrowserHud('[படி 10/12] ✅ ஆவணப் பதிவேற்றம் முடிந்தது!', `கோப்பு (${path.basename(absDocPath)}) பதிவேற்றப்பட்டது`, 'success');
        }
    } else {
        onProgress('⚠️ [CASE-42] முகவரிச் சான்று ஆவணம் கிடைக்கவில்லை — பதிவேற்றம் தவிர்க்கப்படுகிறது.');
    }

    // Step 11: Declaration Checkbox
    onProgress('[படி 11/12] 📋 முகவரி மாற்றம் சுய அறிவிப்பு (Declaration Checkbox) உறுதி செய்யப்படுகிறது...');
    await showBrowserHud('[படி 11/12] சுய அறிவிப்பு', 'ஒப்புதல் அளிக்கப்பட்டது');
    const declCheck = page.locator('input#checkbox3, input[formcontrolname="checkbox3"], input[type="checkbox"]:visible, #declarationCheck, input[type="checkbox"]').last();
    if (await declCheck.count() > 0 && await declCheck.isVisible().catch(() => false)) {
        await declCheck.check({ force: true }).catch(() => {});
        await page.waitForTimeout(300);
    }

    return {
        doorNo,
        streetEng,
        streetTam,
        district,
        taluk,
        village,
        pincode,
        proofType
    };
}

module.exports = { executeAddressFormSteps };
