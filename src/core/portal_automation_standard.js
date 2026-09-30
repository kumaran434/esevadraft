// ============================================================================
// eSevaDraft Universal Portal Automation Standard Engine
// Implements Single-Engine Dual-Mode Law (FEATURE_LOCK Module 8 & GEMINI.md)
// ============================================================================

const path = require('path');
const fs = require('fs');

/**
 * Standard Browser Launch Configuration
 * Guarantees visible Chrome on localhost and correct flags across all services.
 */
function getStandardBrowserConfig(options = {}) {
    const isProduction = options.headless !== undefined
        ? Boolean(options.headless)
        : (process.env.HEADLESS === 'false' ? false : (process.env.HEADLESS === 'true' || process.env.NODE_ENV === 'production'));

    return {
        launchOptions: {
            channel: 'chrome',
            headless: isProduction,
            args: [
                '--start-maximized',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled'
            ]
        },
        contextOptions: {
            viewport: null,
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            permissions: ['geolocation'],
            geolocation: { latitude: 13.0827, longitude: 80.2707 } // Chennai TN Geolocation
        }
    };
}

/**
 * Standard Stealth Injection for anti-bot compliance on government portals (Radware/Perfdrive/Cloudflare)
 */
async function applyStandardStealth(context) {
    if (!context) return;
    await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en', 'ta'] });
        window.chrome = { runtime: {} };
    });
}

/**
 * Standard Route Interceptor for Demo OTP on real government portals
 */
async function setupStandardOtpBypass(page, isMock = true) {
    if (!page || !isMock) return;
    await page.route('**/*', async (route) => {
        const req = route.request();
        const url = req.url().toLowerCase();
        const postData = req.postData() ? req.postData().toLowerCase() : '';
        const isExternalSecurity = url.includes('hcaptcha') || url.includes('perfdrive') || url.includes('recaptcha') || url.includes('cloudflare');
        const isGovtService = (url.includes('tnpds.gov.in') || url.includes('tnesevai') || url.includes('voters.eci') || url.includes('portalwebservice')) && !isExternalSecurity;
        const isOtpOrVerify = isGovtService && req.method() === 'POST' && (
            url.includes('otp') ||
            url.includes('verifymobilenumber') ||
            url.includes('validate') ||
            postData.includes('otp') ||
            postData.includes('mobilenumber')
        );
        if (isOtpOrVerify) {
            console.log('  🎯 [Standard Engine] அரசு OTP/கைபேசி சரிபார்ப்பு அழைப்பு இடைமறிக்கப்பட்டது:', req.url());
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    statusCode: 0,
                    message: 'OTP Verified Successfully',
                    status: 'SUCCESS',
                    trackId: 'MOCK_TRACK_' + Date.now(),
                    valid: true,
                    data: { isVerified: true }
                })
            });
            return;
        }
        await route.continue();
    });
}

/**
 * Standard Floating in-browser HUD for visual tracking across all government portals
 */
async function showStandardBrowserHud(page, currentStep, totalSteps, title, detail = '', status = 'info') {
    if (!page || page.isClosed()) return;
    try {
        await page.evaluate(({ currentStep, totalSteps, title, detail, status }) => {
            let hud = document.getElementById('esevadraft-browser-hud');
            if (!hud) {
                hud = document.createElement('div');
                hud.id = 'esevadraft-browser-hud';
                hud.style.cssText = 'position:fixed; top:12px; right:16px; z-index:2147483647; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; background:rgba(15, 23, 42, 0.95); backdrop-filter:blur(10px); color:white; padding:12px 18px; border-radius:12px; box-shadow:0 8px 32px rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.15); display:flex; flex-direction:column; gap:6px; min-width:280px; max-width:380px; transition:all 0.3s cubic-bezier(0.16, 1, 0.3, 1); pointer-events:none;';
                document.body.appendChild(hud);
            }
            const badgeColor = status === 'success' ? '#10b981' : (status === 'warning' ? '#f59e0b' : '#3b82f6');
            const percent = Math.min(100, Math.round((currentStep / Math.max(1, totalSteps)) * 100));
            hud.innerHTML = `
                <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
                    <span style="font-size:11px; font-weight:800; letter-spacing:0.5px; text-transform:uppercase; color:#94a3b8;">eSevaDraft AI</span>
                    <span style="font-size:11px; font-weight:700; background:${badgeColor}; color:white; padding:2px 8px; border-radius:12px;">படி ${currentStep}/${totalSteps} (${percent}%)</span>
                </div>
                <div style="font-size:13px; font-weight:700; color:#f8fafc; line-height:1.3;">${title}</div>
                ${detail ? `<div style="font-size:12px; color:#cbd5e1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${detail}</div>` : ''}
                <div style="width:100%; height:4px; background:rgba(255,255,255,0.15); border-radius:2px; overflow:hidden; margin-top:4px;">
                    <div style="width:${percent}%; height:100%; background:${badgeColor}; transition:width 0.4s ease;"></div>
                </div>
            `;
            hud.style.opacity = '1';
        }, { currentStep, totalSteps, title, detail, status });
    } catch (e) {}
}

/**
 * Standard Demo Profile Presets for Localhost testing
 */
function getStandardDemoProfile(serviceId = 'TNPDS') {
    const sampleDocPath = path.join(__dirname, '..', '..', 'uploads', 'test_sample_doc.jpg');
    return {
        fullNameEng: 'KUMARAN M',
        fullNameTam: 'குமரன் மா',
        fatherNameEng: 'MANICKAM S',
        fatherNameTam: 'மாணிக்கம் ச',
        mobileNumber: '9999900089',
        headDob: '12/04/1988',
        headGender: 'Male',
        doorNo: '14/B',
        streetEng: 'Anna Street',
        streetTam: 'அண்ணா தெரு',
        village: 'Arakkonam',
        taluk: 'Arakkonam',
        district: 'Ranipet',
        pincode: '631001',
        headAadhaar: '234567890123',
        rationCardNo: '332145897210',
        tempMember: {
            fullNameEng: 'MATHIVANAN K',
            fullNameTam: 'மதிவாணன் கு',
            relationshipEng: 'Son',
            relationshipTam: 'மகன்',
            dob: '15/06/2023',
            gender: 'Male',
            genderTam: 'ஆண்',
            isChild: true,
            docPath: sampleDocPath
        }
    };
}

module.exports = {
    getStandardBrowserConfig,
    applyStandardStealth,
    setupStandardOtpBypass,
    showStandardBrowserHud,
    getStandardDemoProfile
};
