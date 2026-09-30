/**
 * eSevaDraft Enterprise Automation Standard
 * Real Pre-Flight Live Portal Sanity Test (Zero-Mock Invariant)
 * Runs against live https://www.tnpds.gov.in/auth/login
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const assert = require('assert');
const { TnpdsLoginPage } = require('../src/portal/tnpds/tnpds_login_page');
const { PortalActionGuards } = require('../src/portal/common/portal_action_guards');

async function runLivePortalPreFlight() {
    console.log('======================================================');
    console.log('🚀 RUNNING ENTERPRISE LIVE PORTAL PRE-FLIGHT AUDIT');
    console.log('======================================================');

    const cookiePath = path.join(process.env.APPDATA, 'esevadraft-desktop', 'data', 'tnpds_cookies.json');
    let cookies = [];
    if (fs.existsSync(cookiePath)) {
        try { cookies = JSON.parse(fs.readFileSync(cookiePath, 'utf8')).cookies || []; } catch (_) {}
    }

    const browser = await chromium.launch({ channel: 'chrome', headless: false });
    const context = await browser.newContext();
    if (cookies.length) await context.addCookies(cookies);
    const page = await context.newPage();

    try {
        console.log('1. Loading live portal: https://www.tnpds.gov.in/auth/login ...');
        await page.goto('https://www.tnpds.gov.in/auth/login', { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForTimeout(3000);
        console.log('Current URL:', page.url());

        if (page.url().includes('/pages/home') || page.url().endsWith('.in/') || page.url().endsWith('.in')) {
            const link = page.locator('a:has-text("உறுப்பினரை சேர்க்க"), a:has-text("பயனாளர் நுழைவு"), a:has-text("முகவரி மாற்றம்")').first();
            if (await link.count() > 0) {
                console.log('Clicking login link from home...');
                await link.click();
                await page.waitForTimeout(3000);
            }
        }
        console.log('Final URL before POM check:', page.url());

        const loginPage = new TnpdsLoginPage(page, (m) => console.log('   [Live POM]', m));

        // Audit 1: Scoped Locators exist and are distinct
        const mobInput = loginPage.getMobileInput();
        const capInput = loginPage.getCaptchaInput();
        const capImg = loginPage.getCaptchaImage();
        const submitBtn = loginPage.getSubmitButton();

        assert(await mobInput.count() > 0, 'FAIL: Mobile input locator failed to find element');
        assert(await capInput.count() > 0, 'FAIL: Captcha input locator failed to find element');
        assert(await capImg.count() > 0, 'FAIL: Captcha image locator failed to find element');
        assert(await submitBtn.count() > 0, 'FAIL: Submit button locator failed to find element');
        console.log('✅ [PREFLIGHT-01] All 4 Scoped Locators found and verified on live DOM');

        // Audit 2: Mobile Input vs Captcha Input are distinct DOM elements
        const mobId = await mobInput.getAttribute('id');
        const capId = await capInput.getAttribute('id');
        assert(mobId !== capId, 'FAIL: Mobile input and Captcha input point to the same element!');
        assert(capId === 'captchaCode', 'FAIL: Captcha input is not #captchaCode!');
        console.log('✅ [PREFLIGHT-02] Element isolation verified: Mobile != Captcha (Zero-Cross-Contamination)');

        // Audit 3: Mobile fill preserves value
        const testMobile = '9842367866';
        await loginPage.ensureMobileFilled(testMobile);
        const mobVal = await mobInput.inputValue();
        assert.equal(mobVal, testMobile, `FAIL: Mobile input did not retain ${testMobile}`);
        console.log(`✅ [PREFLIGHT-03] Mobile fill verified: "${mobVal}"`);

        // Audit 4: Value Guard prevents submit when captcha is empty
        let guardCaught = false;
        try {
            await loginPage.submitLogin(testMobile);
        } catch (guardErr) {
            guardCaught = true;
            console.log('✅ [PREFLIGHT-04] Value Guard successfully blocked submit on empty captcha:', guardErr.message);
        }
        assert(guardCaught === true, 'FAIL: Value Guard failed to block empty captcha submit!');

        console.log('======================================================');
        console.log('🎉 ALL LIVE PORTAL PRE-FLIGHT AUDITS PASSED WITH 100% SUCCESS!');
        console.log('======================================================');
        return true;
    } finally {
        await browser.close().catch(() => {});
    }
}

if (require.main === module) {
    runLivePortalPreFlight()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('❌ PRE-FLIGHT FAILED:', err.message);
            process.exit(1);
        });
}

module.exports = { runLivePortalPreFlight };
