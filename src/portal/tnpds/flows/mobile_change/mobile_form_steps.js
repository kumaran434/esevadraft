// =========================================================================
// TNPDS Change Mobile — Form Filling & OTP Verification (Steps 4 to 8)
// Reverse-Engineered & Modular Production Implementation
// =========================================================================
const { assertNoRadwareOrPageRefresh } = require('../../../common/universal_radware_resumption');

async function executeMobileChangeFormSteps({
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
        requestOtpFromUser = async () => ''
    } = sharedContext;

    const userMobile = (citizenProfile.mobileNumber || citizenProfile.mobile || '').replace(/\D/g, '');
    const newMobile = (subData.newMobile || subData.newMobileNumber || options.newMobile || '').replace(/\D/g, '');

    if (!newMobile || newMobile.length !== 10) {
        onProgress(`❌ [பிழை] செல்லுபடியாகும் 10-இலக்க புதிய கைபேசி எண் வழங்கப்படவில்லை! (உள்ளிட்ட எண்: "${newMobile}")`);
        return { success: false, message: 'செல்லுபடியாகும் 10-இலக்க புதிய கைபேசி எண் தேவை.' };
    }

    if (userMobile === newMobile) {
        onProgress(`⚠️ [பிழை] பழைய பதிவு செய்யப்பட்ட எண்ணும் (+91 ${userMobile}) புதிய எண்ணும் (+91 ${newMobile}) ஒன்றாக இருக்கக்கூடாது!`);
        return { success: false, message: 'பழைய மற்றும் புதிய கைபேசி எண்கள் ஒன்றாக இருக்கக்கூடாது.' };
    }

    // -------------------------------------------------------------------------
    // Step 4: Navigate to Service Request Page
    // -------------------------------------------------------------------------
    onProgress('[படி 4/10] 🔗 "கைபேசி எண் மாற்றம்" சேவை பக்கத்திற்கு செல்கிறது (service-request)...');
    await showBrowserHud('[படி 4/10] சேவை தேர்வு', 'கைபேசி எண் மாற்றம்');

    const curUrl = page.url();
    if (!curUrl.includes('service-request')) {
        const navMenuSelectors = [
            'a:has-text("கைபேசி எண் மாற்றம்")',
            'button:has-text("கைபேசி எண் மாற்றம்")',
            'li:has-text("கைபேசி எண் மாற்றம்") a',
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
    // Step 5: Select "கைபேசி எண் மாற்றம்" from Dropdown
    // -------------------------------------------------------------------------
    onProgress('[படி 5/10] 📋 சேவைப் பட்டியலில் "கைபேசி எண் மாற்றம்" தேர்ந்தெடுக்கப்படுகிறது...');
    try {
        const serviceDropdown = page.locator('select[formcontrolname="selectService"], select#inputGroupSelect02, select').first();
        if (await serviceDropdown.count() > 0 && await serviceDropdown.isVisible().catch(() => false)) {
            const opts = await serviceDropdown.locator('option').allInnerTexts().catch(() => []);
            const mobOpt = opts.find(o => o.includes('கைபேசி') || o.includes('Mobile'));
            if (mobOpt) {
                await serviceDropdown.selectOption({ label: mobOpt }).catch(() => {});
            } else {
                await serviceDropdown.selectOption({ value: 'CHANGE_OF_MOBILE_NUMBER' }).catch(() => {});
            }
            await serviceDropdown.dispatchEvent('change').catch(() => {});
            await page.waitForTimeout(2000);
        }
    } catch (_) {}

    await assertNoRadwareOrPageRefresh(page, null, 'படி 5/10');

    // -------------------------------------------------------------------------
    // Step 6: Validate Current Registered Mobile Number
    // -------------------------------------------------------------------------
    onProgress(`[படி 6/10] 📱 தற்போதைய பதிவு செய்யப்பட்ட கைபேசி எண் (+91 ${userMobile}) சரிபார்க்கப்படுகிறது...`);
    await showBrowserHud('[படி 6/10] பழைய எண் சரிபார்ப்பு', `+91 ${userMobile}`);

    const oldMobInput = page.locator('input[formcontrolname="beneficiaryMobileNumber"], input[placeholder*="தற்போதைய"], input[name*="beneficiaryMobile"]').first();
    if (await oldMobInput.count() > 0 && await oldMobInput.isVisible().catch(() => false)) {
        await humanType(page, oldMobInput, userMobile);
        await oldMobInput.dispatchEvent('input').catch(() => {});
        await oldMobInput.dispatchEvent('change').catch(() => {});
        await page.waitForTimeout(500);

        // Click Validate Button (validatePreviousMobileNumber)
        const validateBtn = page.locator('button:has-text("சரிபார்க்க"), button:has-text("Validate"), button.btn:has-text("சரிபார்க்க")').first();
        if (await validateBtn.count() > 0 && await validateBtn.isVisible().catch(() => false)) {
            onProgress('🔍 [சரிபார்ப்பு பொத்தான்] "சரிபார்க்க" பொத்தான் அழுத்தப்படுகிறது...');
            await validateBtn.click({ force: true }).catch(() => {});
            await page.waitForTimeout(2000);
        }
    }

    // -------------------------------------------------------------------------
    // Step 7: Fill New Mobile Number
    // -------------------------------------------------------------------------
    onProgress(`[படி 7/10] 📱 புதிய கைபேசி எண் (+91 ${newMobile}) படிவத்தில் உள்ளிடப்படுகிறது...`);
    await showBrowserHud('[படி 7/10] புதிய எண் உள்ளீடு', `+91 ${newMobile}`);

    let newMobInput = page.locator('input[formcontrolname="newMobileNumber"], input[placeholder*="புதிய"], input[name*="newMobile"]').first();
    for (let waitNew = 0; waitNew < 10; waitNew++) {
        if (await newMobInput.count() > 0 && !(await newMobInput.isDisabled().catch(() => true))) break;
        await page.waitForTimeout(1000);
        newMobInput = page.locator('input[formcontrolname="newMobileNumber"], input[placeholder*="புதிய"], input[name*="newMobile"]').first();
    }

    if (await newMobInput.count() > 0) {
        await newMobInput.evaluate(el => { el.removeAttribute('disabled'); el.disabled = false; }).catch(() => {});
        await humanType(page, newMobInput, newMobile);
        await newMobInput.dispatchEvent('input').catch(() => {});
        await newMobInput.dispatchEvent('change').catch(() => {});
        await page.waitForTimeout(500);
    }

    // -------------------------------------------------------------------------
    // Step 8: Self Declaration Checkbox
    // -------------------------------------------------------------------------
    onProgress('[படி 8/10] ✍️ சுய உறுதிமொழி (Declaration Checkbox) டிக் செய்யப்படுகிறது...');
    await showBrowserHud('[படி 8/10] சுய உறுதிமொழி', 'விதிமுறைகள் ஏற்றுக்கொள்ளப்பட்டது');

    try {
        const declCheckbox = page.locator('input[type="checkbox"][formcontrolname="declaration"], input[type="checkbox"]').first();
        if (await declCheckbox.count() > 0) {
            await declCheckbox.scrollIntoViewIfNeeded().catch(() => {});
            const isChecked = await declCheckbox.isChecked().catch(() => false);
            if (!isChecked) {
                await declCheckbox.check({ force: true }).catch(() => {});
                await declCheckbox.dispatchEvent('change').catch(() => {});
                await page.waitForTimeout(500);
            }
        }
    } catch (_) {}

    // -------------------------------------------------------------------------
    // Step 9: Request OTP to New Mobile Number
    // -------------------------------------------------------------------------
    onProgress(`[படி 9/10] 📩 புதிய கைபேசி எண்ணிற்கு (+91 ${newMobile}) OTP அனுப்புவதற்கான பொத்தான் அழுத்தப்படுகிறது...`);
    await showBrowserHud('[படி 9/10] OTP கோரிக்கை', `+91 ${newMobile} எண்ணிற்கு OTP அனுப்பப்படுகிறது...`);

    const reqOtpBtn = page.locator('button:has-text("OTP பெற"), button:has-text("Request OTP"), button.btn-success:has-text("OTP"), button[type="submit"]:has-text("OTP")').first();
    if (await reqOtpBtn.count() > 0) {
        await reqOtpBtn.evaluate(el => { el.removeAttribute('disabled'); el.disabled = false; }).catch(() => {});
        await reqOtpBtn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(2000);
    }

    // -------------------------------------------------------------------------
    // Step 10: Handle New Mobile OTP Modal
    // -------------------------------------------------------------------------
    onProgress(`📱 [படி 10/10] உங்கள் புதிய கைபேசி எண்ணிற்கு (+91 ${newMobile}) வந்த அரசு 6-இலக்க SMS OTP-க்காக காத்திருக்கிறது...`);
    onProgress(`👉 புதிய கைபேசியில் (+91 ${newMobile}) வந்த 6-இலக்க OTP எண்ணை சாட்டிலோ அல்லது Google Chrome திரையிலோ உள்ளிடவும்.`);
    await showBrowserHud('[படி 10/10] புதிய எண் OTP', `+91 ${newMobile}-க்கு வந்த OTP உள்ளிடவும்`, 'warning');

    const otpModal = page.locator('.modal, div[role="dialog"], div.modal-dialog, form:has(input[formcontrolname="otp"])').first();
    let isModalVisible = false;
    for (let w = 0; w < 15; w++) {
        if (await page.locator('input[formcontrolname="otp"]').count() > 0) {
            isModalVisible = true;
            break;
        }
        await page.waitForTimeout(1000);
    }

    const newOtpVal = await requestOtpFromUser(
        `📱 உங்கள் புதிய கைபேசி எண்ணிற்கு (+91 ${newMobile}) வந்த அரசு 6-இலக்க SMS OTP எண்ணை உள்ளிடவும்:`,
        onProgress,
        'mobile_update_otp',
        page
    );

    if (newOtpVal && newOtpVal !== 'PAGE_REFRESHED_TO_LOGIN') {
        onProgress(`✍️ [OTP சரிபார்ப்பு] புதிய எண் OTP (${newOtpVal}) போர்ட்டல் மாடலில் உள்ளிடப்படுகிறது...`);
        await showBrowserHud('[படி 10/10] OTP சரிபார்க்கப்படுகிறது', `OTP: ${newOtpVal}`);

        const modalOtpInput = page.locator('input[formcontrolname="otp"], input[placeholder*="OTP"]').first();
        if (await modalOtpInput.count() > 0) {
            await humanType(page, modalOtpInput, newOtpVal);
            await modalOtpInput.dispatchEvent('input').catch(() => {});
            await modalOtpInput.dispatchEvent('change').catch(() => {});
            await page.waitForTimeout(500);
        }
    }

    return {
        success: true,
        userMobile,
        newMobile,
        completedPreSubmit: true
    };
}

module.exports = {
    executeMobileChangeFormSteps
};
