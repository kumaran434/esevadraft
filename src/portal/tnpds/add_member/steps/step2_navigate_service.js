/**
 * TNPDS Add Member — Step 2: Service Navigation & Form Load Gate (Modular Step < 300 lines)
 * 
 * Responsibilities:
 * 1. Navigates to Electronic Card Services / Service Request page (/pages/service-request).
 * 2. Clicks or selects "உறுப்பினர் சேர்க்கை" (Add Family Member).
 * 3. Auto-dismisses session conflict modals ("நீங்கள் வெளியேற விரும்புகிறீர்களா?").
 * 4. Selects serviceType in dropdown so Angular renders member input form.
 * 5. Enforces MEMBER_FORM_GATE to verify form hydration before proceeding.
 */

async function navigateToAddMemberForm(page, helpers = {}) {
    const {
        onProgress = () => {},
        showBrowserHud = async () => {},
        dismissSessionConflictOrAlertModals = async () => false,
        addMemberResumption = null,
        tryAutoClickCaptcha = async () => {},
        saveTnpdsCookies = async () => {}
    } = helpers;

    console.log('📑 [Add Member: Step 2] Navigating to Add Family Member service...');
    if (onProgress) onProgress('[படி 4/12] 📋 "குடும்ப உறுப்பினர் சேர்க்கை" படிவம் திறக்கப்படுகிறது...');
    await showBrowserHud('[படி 4/12] அட்டை தொடர்பான சேவை', 'உறுப்பினர் சேர்க்கை படிவம் திறக்கப்படுகிறது');

    const ADD_MEMBER_URL = 'https://www.tnpds.gov.in/pages/service-request';
    const isOnServiceRequest = () => page.url().toLowerCase().includes('service-request');

    // 1. Check if already on service request page
    let navigated = isOnServiceRequest();

    // 2. On-page navigation via Sidebar / Menu links
    if (!navigated) {
        const navMenuSelectors = [
            'a:has-text("உறுப்பினரை சேர்க்க")',
            'button:has-text("உறுப்பினரை சேர்க்க")',
            'li:has-text("உறுப்பினரை சேர்க்க") a',
            'a:has-text("மின்னணு அட்டை தொடர்பான சேவைகள்")',
            'a[href*="service-request"]'
        ];
        for (const sel of navMenuSelectors) {
            try {
                const el = page.locator(sel).first();
                if (await el.count() > 0 && await el.isVisible().catch(() => false)) {
                    await el.click().catch(() => {});
                    await page.waitForTimeout(1500);
                    if (isOnServiceRequest()) {
                        navigated = true;
                        break;
                    }
                }
            } catch (_) {}
        }
    }

    // 3. Direct URL fallback
    if (!navigated && !isOnServiceRequest()) {
        try {
            await page.goto(ADD_MEMBER_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
            await page.waitForTimeout(2000);
        } catch (eNav) {
            console.log('[Add Member Nav] Direct URL navigation notice:', eNav.message.slice(0, 80));
        }
    }

    // 4. Handle Radware challenge if it appeared after navigation
    if (addMemberResumption && await addMemberResumption.isRadwareChallengeActive(page)) {
        if (onProgress) onProgress('🛡️ [Radware பாதுகாப்பு] வழிசெலுத்தலுக்குப் பின் சவால் வந்துள்ளது — காத்திருக்கிறது...');
        await addMemberResumption.clearRadwareAndSettle(page, onProgress, tryAutoClickCaptcha, saveTnpdsCookies);
    }

    // 5. Select "உறுப்பினர் சேர்க்கை" in Service Dropdown
    try {
        const serviceDropdown = page.locator('select[formcontrolname="serviceType"], select[formcontrolname="service"], div:has(> label:has-text("சேவையை தேர்வு")) select, select').first();
        if (await serviceDropdown.count() > 0 && await serviceDropdown.isVisible().catch(() => false)) {
            await serviceDropdown.selectOption({ label: 'உறுப்பினர் சேர்க்கை' }).catch(async () => {
                await serviceDropdown.selectOption({ index: 1 }).catch(() => {});
            });
            await serviceDropdown.dispatchEvent('change').catch(() => {});
            await page.waitForTimeout(1500);
        }
    } catch (_) {}

    // 6. Verify Form Container Gate
    let memberFormFound = false;
    for (let w = 0; w < 20; w++) {
        await dismissSessionConflictOrAlertModals(page, onProgress);

        memberFormFound = await page.evaluate(() => {
            const checks = [
                Boolean(document.querySelector('input[formcontrolname="name"], input[formcontrolname="nameEng"], input[formcontrolname="nameTam"], input[formcontrolname="tamilName"], input[formcontrolname="lname"]')),
                Boolean(document.querySelector('select[formcontrolname="gender"]')),
                Boolean(document.querySelector('select[formcontrolname="relationship"], select[formcontrolname="relation"]')),
                Boolean(document.querySelector('select[formcontrolname="serviceType"], select[formcontrolname="service"]'))
            ];
            return checks.filter(Boolean).length >= 2;
        }).catch(() => false);

        if (memberFormFound) break;
        await page.waitForTimeout(1000);
    }

    if (!memberFormFound) {
        throw new Error(`MEMBER_FORM_GATE_HALT: Add Member form could not be loaded at ${page.url()}. Zero-Step-Skip enforced.`);
    }

    console.log('✅ [Add Member: Step 2] Service form successfully opened and hydrated.');
    if (onProgress) onProgress('✅ [படி 4/12] உறுப்பினர் சேர்க்கை படிவம் தயாராக உள்ளது!');
    return { success: true };
}

module.exports = {
    navigateToAddMemberForm
};
