/**
 * TNPDS Add Member - Step 4: Service Request Navigation & Service Type Selection
 */
const { isRadwareChallenge, waitAndClearRadwareChallenge } = require('../../../common/universal_radware_resumption');

async function executeStep4Nav(page, memberNameTam, memberNameEng, onProgress, sharedContext) {
    const {
        showBrowserHud = async () => {},
        tryAutoClickCaptcha = async () => false,
        saveTnpdsCookies = async () => {},
        addMemberResumption = null
    } = sharedContext;

    onProgress(`[படி 3/12 → 4] 🔗 "உறுப்பினரை சேர்க்க" பக்கத்திற்கு செல்கிறது (service-request)...`);
    await showBrowserHud('[படி 4/12] அட்டை தொடர்பான சேவை', 'உறுப்பினர் சேர்க்கை படிவம் திறக்கப்படுகிறது');

    const ADD_MEMBER_URL = 'https://www.tnpds.gov.in/pages/service-request';
    const isOnAddMemberPage = (u) => u.includes('service-request');
    let navigatedToForm = isOnAddMemberPage(page.url());

    if (!navigatedToForm) {
        onProgress('🔍 [பக்கம் மாறுதல்] முகப்பு பக்கத்தில் "உறுப்பினரை சேர்க்க" இணைப்பு தேடப்படுகிறது...');
        const navMenuSelectors = [
            'a:has-text("உறுப்பினரை சேர்க்க")',
            'button:has-text("உறுப்பினரை சேர்க்க")',
            'li:has-text("உறுப்பினரை சேர்க்க") a',
            'span:has-text("உறுப்பினரை சேர்க்க")',
            '[routerlink*="service-request"]',
            'a[href*="service-request"]'
        ];

        for (const mSel of navMenuSelectors) {
            try {
                const mEl = page.locator(mSel).first();
                if (await mEl.count() > 0 && await mEl.isVisible().catch(() => false)) {
                    await mEl.click({ timeout: 5000 }).catch(() => {});
                    await page.waitForTimeout(2500);
                    if (isOnAddMemberPage(page.url())) { navigatedToForm = true; break; }
                }
            } catch (_) {}
        }
    }

    if (!navigatedToForm && !isOnAddMemberPage(page.url())) {
        try {
            onProgress('🔗 [நேரடி முகவரி] https://www.tnpds.gov.in/pages/service-request திறக்கப்படுகிறது...');
            await page.goto(ADD_MEMBER_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
            await page.waitForTimeout(3000);
        } catch (eNav) {}
    }

    if (await isRadwareChallenge(page)) {
        await showBrowserHud('🛡️ Radware சரிபார்ப்பு', 'Submit பண்ணி தொடரவும்', 'warning');
        await waitAndClearRadwareChallenge(page, onProgress, saveTnpdsCookies);
    }

    // If navigating to service-request redirected to /auth/login (expired idle session), trigger page-start re-login recovery
    const checkLoginRedirect = async () => {
        const curU = (page.url() || '').toLowerCase();
        if (curU.includes('/auth/login')) return true;
        return await page.evaluate(() => Boolean(document.querySelector('input[formcontrolname="mobNumber"]:not([disabled]), input[placeholder*="கைபேசி"]'))).catch(() => false);
    };
    if (await checkLoginRedirect()) {
        const err = new Error('RADWARE_PAGE_REFRESH_DETECTED:படி 4/12 (உள்நுழைவு தேவை)');
        err.isRadwarePageRefresh = true;
        err.stepLabel = 'படி 4/12';
        throw err;
    }

    await page.waitForTimeout(2000);

    // Step 4: Select "உறுப்பினர் சேர்க்கை"
    onProgress(`[படி 4/12] 📄 "உறுப்பினர் சேர்க்கை" சேவை தேர்வு செய்யப்படுகிறது...`);
    await showBrowserHud('[படி 4/12] சேவை தேர்வு', 'உறுப்பினர் சேர்க்கை');
    try {
        const serviceDropdown = page.locator('select[formcontrolname="serviceType"], select[formcontrolname="service"], select').first();
        if (await serviceDropdown.count() > 0 && await serviceDropdown.isVisible().catch(() => false)) {
            await serviceDropdown.selectOption({ label: 'உறுப்பினர் சேர்க்கை' }).catch(async () => {
                await serviceDropdown.selectOption({ index: 1 }).catch(() => {});
            });
            await serviceDropdown.dispatchEvent('change').catch(() => {});
            await page.waitForTimeout(2000);
        }
    } catch (_) {}

    onProgress('[சரிபார்ப்பு] 🔍 TNPDS படிவம் திரையில் உள்ளதா என சரிபார்க்கப்படுகிறது...');
    let memberFormFound = false;
    let memberAlreadyInTable = false;
    if (addMemberResumption) {
        memberAlreadyInTable = await addMemberResumption.isMemberAlreadyInTable(page, memberNameTam, memberNameEng);
        if (memberAlreadyInTable) {
            onProgress(`✅ [Gate ✓] உறுப்பினர் "${memberNameTam}" (${memberNameEng}) ஏற்கனவே அட்டவணையில் கண்டறியப்பட்டார்!`);
            memberFormFound = true;
        }
    }

    for (let formWait = 0; formWait < 20; formWait++) {
        if (memberFormFound) break;
        if (await isRadwareChallenge(page)) {
            await waitAndClearRadwareChallenge(page, onProgress, saveTnpdsCookies);
            formWait = 0;
            continue;
        }
        if (await checkLoginRedirect()) {
            const err = new Error('RADWARE_PAGE_REFRESH_DETECTED:படி 4/12 (உள்நுழைவு தேவை)');
            err.isRadwarePageRefresh = true;
            err.stepLabel = 'படி 4/12';
            throw err;
        }

        memberFormFound = await page.evaluate(() => {
            const checks = [
                Boolean(document.querySelector('input[formcontrolname="name"], input[formcontrolname="nameEng"], input[formcontrolname="nameTam"]')),
                Boolean(document.querySelector('select[formcontrolname="gender"]')),
                Boolean(document.querySelector('input[formcontrolname="date"], input#mat-input-0')),
                Boolean(document.querySelector('select[formcontrolname="relationship"]'))
            ];
            return checks.filter(Boolean).length >= 2;
        }).catch(() => false);

        if (memberFormFound) break;
        if (formWait === 3 || formWait === 7 || formWait === 12) {
            try {
                if (!page.url().includes('service-request')) {
                    await page.goto(ADD_MEMBER_URL, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
                    await page.waitForTimeout(1500);
                }
                const sDrop = page.locator('select[formcontrolname="serviceType"], select[formcontrolname="service"], select').first();
                if (await sDrop.count() > 0) {
                    await sDrop.selectOption({ label: 'உறுப்பினர் சேர்க்கை' }).catch(async () => {
                        await sDrop.selectOption({ index: 1 }).catch(() => {});
                    });
                    await sDrop.dispatchEvent('change').catch(() => {});
                }
            } catch (_) {}
        }
        await page.waitForTimeout(1000);
    }

    if (!memberFormFound) {
        throw new Error(`MEMBER_FORM_GATE_HALT: Add Member form not found. Zero-Step-Skip enforced.`);
    }

    onProgress('✅ [Gate ✓] TNPDS Add Member படிவம் திரையில் உள்ளது! விவரங்கள் உள்ளிடுவது தொடங்குகிறது...');
    await showBrowserHud('✅ படிவம் உள்ளது', 'விவரங்கள் உள்ளிடப்படுகின்றன...');
    return { success: true, memberAlreadyInTable };
}

module.exports = {
    executeStep4Nav
};
