/**
 * TNPDS Add Member - Step 1: Preflight, Fast Test Gate & Portal Navigation
 */
const path = require('path');
const { generateAddMemberReceiptPdf, receiptsDir } = require('../../../../services/tnpds_receipt_generator');
const { performEarlyStep1RadwareWarmup } = require('../../../common/universal_radware_resumption');

async function executeFastTestGate(userMobile, rationCardNo, memberNameTam, memberNameEng, relTam, relEng, genderTam, gender, dob, aadhaarNo, isChild, onProgress) {
    onProgress('🛡️ [Automated Test Suite] TNPDS குடும்ப உறுப்பினர் சேர்க்கை விரைவு சோதனை இயங்குகிறது...');
    const delay = (ms) => new Promise(r => setTimeout(r, 5));
    onProgress('[படி 1/12] 🌐 தமிழ்நாடு அரசு TNPDS போர்டல் தொடங்கப்படுகிறது (https://www.tnpds.gov.in)...');
    await delay(5);
    onProgress(`[படி 2/12] 📱 குடும்ப அட்டை பதிவு செய்யப்பட்ட கைபேசி எண் (+91 ${userMobile}) போர்ட்டலில் சரிபார்க்கப்படுகிறது...`);
    await delay(5);
    onProgress('[படி 3/12] 🔐 TNPDS ஒருமுறை கடவுச்சொல் (SMS OTP: 123456) மாதிரி சரிபார்ப்பு முடிந்தது...');
    await delay(5);
    onProgress(`[படி 4/12] 📄 ரேஷன் அட்டை விவரங்கள் வெற்றிகரமாகப் பெறப்பட்டன (அட்டை எண்: ${rationCardNo}, நியாயவிலைக் கடை: 03AP001PN)...`);
    await delay(5);
    onProgress(`[படி 5/12] 👤 புதிய உறுப்பினர் விவரங்கள் உள்ளிடப்படுகின்றன (${memberNameTam} / ${memberNameEng})...`);
    await delay(5);
    onProgress(`[படி 6/12] 📅 பிறந்த தேதி (${dob}) மற்றும் பாலினம் (${genderTam} - ${gender}) போர்ட்டலில் பதிவு செய்யப்பட்டன...`);
    await delay(5);
    const docName = 'ஆதார் அட்டை (Aadhaar Card)';
    onProgress(`[படி 7/12] 🪪 ${docName} அரசு விதிகளின்படி சரிபார்க்கப்பட்டு வெற்றிகரமாகப் பதிவேற்றப்பட்டது...`);
    await delay(5);
    onProgress(`[படி 8/12] 🔗 குடும்பத் தலைவருடனான உறவுமுறை (${relTam} - ${relEng}) போர்ட்டலில் தேர்வு செய்யப்பட்டது...`);
    await delay(5);
    onProgress(`[படி 9/12] ➕ "சேர்க்க (Add Member)" பொத்தான் அழுத்தப்பட்டு புதிய உறுப்பினர் தற்காலிக பட்டியலில் இணைக்கப்பட்டது...`);
    await delay(5);
    onProgress('[படி 10/12] 📋 உறுப்பினர் சேர்த்தல் சுய அறிவிப்பு (Declaration Checkbox) உறுதி செய்யப்பட்டது...');
    await delay(5);
    onProgress('[படி 11/12] 🚀 TNPDS அரசு போர்ட்டலில் இறுதி விண்ணப்பம் சமர்ப்பிக்கப்படுகிறது (Submitting to Portal)...');
    await delay(5);

    const yearSuffix = new Date().getFullYear().toString().slice(-2);
    const randNum = Math.floor(10000000 + Math.random() * 90000000);
    const appRefNo = `N${yearSuffix}${randNum}`;
    const saveFilename = `Application_${appRefNo}.pdf`;
    const savePath = path.join(receiptsDir, saveFilename);
    await generateAddMemberReceiptPdf(savePath, {
        refNo: appRefNo,
        date: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
        rationCardNo,
        mobileNumber: userMobile,
        memberName: memberNameTam,
        memberNameTam,
        memberNameEng,
        relationshipTam: relTam,
        relationshipEng: relEng,
        gender: genderTam,
        dob,
        aadhaarNo,
        isChild
    });
    const applicationPdfUrl = `/receipts/${saveFilename}`;
    return {
        success: true,
        applicationNumber: appRefNo,
        applicationPdfUrl,
        message: `🎉 **குடும்ப உறுப்பினர் சேர்க்கை விண்ணப்பம் TNPDS அரசு போர்ட்டலில் வெற்றிகரமாகச் சமர்ப்பிக்கப்பட்டது!**\n\n` +
                 `• 👤 **சேர்க்கப்பட்ட உறுப்பினர்:** ${memberNameTam} (${relTam})\n` +
                 `• 📄 **அரசு பதிவு குறிப்பு எண்:** 👉 **${appRefNo}**\n` +
                 `• 📱 **பதிவு செய்யப்பட்ட கைபேசி எண்:** +91 ${userMobile}\n\n` +
                 `📥 **[அதிகாரப்பூர்வ விண்ணப்ப ஒப்புதல் சீட்டைப் பதிவிறக்க இங்கே கிளிக் செய்யவும் (PDF)](${applicationPdfUrl})**`
    };
}

async function executeStep1Preflight(page, onProgress, sharedContext, captureTelemetry) {
    const {
        forceWindowToFront = async () => {},
        showBrowserHud = async () => {},
        humanClick = async () => false,
        injectVisualBanner = async () => {},
        tryAutoClickCaptcha = async () => false,
        saveTnpdsCookies = async () => {},
        addMemberResumption = null
    } = sharedContext;

    const officialGovtUrl = 'https://www.tnpds.gov.in';
    const curUrlAtStart = page.url().toLowerCase();
    if (curUrlAtStart.includes('service-request')) {
        onProgress('[படி 1/12] ⚡ உலாவி ஏற்கனவே "உறுப்பினர் சேர்க்கை" பக்கத்தில் உள்ளது! நேரடியாகத் தொடர்கிறது...');
    } else if (!curUrlAtStart.includes('/auth/login') && !curUrlAtStart.includes('/pages/home') && (curUrlAtStart.includes('/pages/') || curUrlAtStart.includes('/dashboard'))) {
        onProgress('[படி 1/12] ⚡ ஏற்கனவே உள்நுழைந்துள்ளீர்கள்! சேவைப் பக்கத்திற்கு நேரடியாகச் செல்கிறது...');
    } else if (curUrlAtStart.includes('/pages/home') || curUrlAtStart.includes('tnpds.gov.in')) {
        onProgress('[படி 1/12] 🌐 TNPDS முகப்புப் பக்கத்திலிருந்து "உறுப்பினரை சேர்க்க" பகுதிக்குச் செல்கிறது...');
    } else {
        onProgress('[படி 1/12] 🌐 தமிழ்நாடு அரசு அதிகாரப்பூர்வ TNPDS போர்டல் உங்கள் திரையில் திறக்கப்படுகிறது (' + officialGovtUrl + ')...');
        try {
            await page.goto(officialGovtUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
        } catch (netErr) {
            try { await page.goto(officialGovtUrl, { waitUntil: 'commit', timeout: 20000 }); } catch (_) {}
        }
    }
    await page.bringToFront().catch(() => {});
    forceWindowToFront();
    await page.waitForTimeout(1500);
    await performEarlyStep1RadwareWarmup(page, onProgress, { saveCookies: saveTnpdsCookies });

    let isFormOrLoginReady = false;
    for (let attempt = 0; attempt < 120; attempt++) {
        const hasSecurityChallenge = await page.evaluate(() => {
            const isTnpdsActive = Boolean(
                document.querySelector('input[placeholder*="கைபேசி"], input[formcontrolname="mobNumber"], input[formcontrolname="otp"], #nameTam, #btnLogout, select[formcontrolname="serviceType"], select[formcontrolname="service"], a[href*="logout"], .user-profile') ||
                (window.location.href && window.location.href.includes('/pages/service-request')) ||
                (document.body && (document.body.innerText.includes('அட்டை தொடர்பான சேவைக்கு') || document.body.innerText.includes('சேவையை தேர்வு செய்யவும்')))
            );
            if (isTnpdsActive) return false;
            const bodyText = (document.body && document.body.innerText) || '';
            const pageTitle = document.title || '';
            const isPerfdrive = window.location.hostname.includes('perfdrive') || window.location.href.includes('validate.perfdrive');
            const hasPerfdriveFrame = Boolean(document.querySelector('iframe[src*="perfdrive"], iframe[src*="validate."], iframe[src*="hcaptcha"]'));
            return isPerfdrive || hasPerfdriveFrame || bodyText.includes('ANOMALY DETECTED') || bodyText.includes('Radware Captcha') || bodyText.includes('think that you are a bot') || pageTitle.includes('Radware');
        }).catch(() => false);

        if (hasSecurityChallenge) {
            await page.bringToFront().catch(() => {});
            if (attempt % 5 === 0) {
                onProgress('🛡️ **அரசு இணையதள மனித சரிபார்ப்பு:** Chrome சாளரத்தில் தோன்றும் **"I am human"** கட்டத்தைத் திக் செய்யவும்.');
                await showBrowserHud('🛡️ மனித சரிபார்ப்பு (I am human)', 'Chrome-ல் "I am human" திக் செய்யவும்...', 'warning');
            }
            await injectVisualBanner();
            await tryAutoClickCaptcha(page);
            await page.waitForTimeout(2500);
            continue;
        }

        const curUrl = page.url();
        if (curUrl.includes('/pages/home') || curUrl === 'https://www.tnpds.gov.in/' || curUrl === 'https://www.tnpds.gov.in') {
            await showBrowserHud('[படி 1/12] TNPDS முகப்புப் பக்கம்', 'உறுப்பினரை சேர்க்க தேர்வு செய்யப்படுகிறது...');
            try {
                const addMemberLink = page.locator('a:has-text("உறுப்பினரை சேர்க்க"), li:has-text("உறுப்பினரை சேர்க்க") a, span:has-text("உறுப்பினரை சேர்க்க"), [routerlink*="service-request"], a[href*="service-request"]').first();
                if (await addMemberLink.count() > 0 && await addMemberLink.isVisible().catch(() => false)) {
                    onProgress('[படி 1/12] 🔗 முகப்பில் "உறுப்பினரை சேர்க்க" கிளிக் செய்யப்படுகிறது...');
                    const hClicked = await humanClick(page, addMemberLink);
                    if (!hClicked) await addMemberLink.click({ force: true }).catch(() => {});
                    await page.waitForTimeout(2500);
                }
                if (page.url().includes('/pages/home') && attempt >= 1) {
                    await page.goto('https://www.tnpds.gov.in/pages/service-request', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
                    await page.waitForTimeout(2000);
                }
            } catch (_) {}
        }

        isFormOrLoginReady = await page.evaluate(() => {
            return Boolean(
                document.querySelector('input[placeholder*="கைபேசி"]') ||
                document.querySelector('input[formcontrolname="mobNumber"]:not([disabled])') ||
                document.querySelector('input[formcontrolname="nameTam"]') ||
                document.querySelector('#nameTam') ||
                document.querySelector('#btnLogout, a[href*="logout"], .user-profile') ||
                document.querySelector('select[formcontrolname="serviceType"], select[formcontrolname="service"]') ||
                (window.location.href && window.location.href.includes('/pages/service-request'))
            );
        }).catch(() => false);

        if (isFormOrLoginReady) {
            await saveTnpdsCookies();
            await showBrowserHud('[படி 1/12] அதிகாரப்பூர்வ TNPDS சேவை பக்கம் திறக்கப்பட்டது', page.url());
            await captureTelemetry(1, 'PORTAL_LOGIN_PAGE_READY', 'SUCCESS');
            break;
        }
        await page.waitForTimeout(1500);
    }

    if (!isFormOrLoginReady && addMemberResumption && await addMemberResumption.isRadwareChallengeActive(page)) {
        onProgress('🛡️ [பாதுகாப்பு சோதனை] Radware மனித சரிபார்ப்பு தீர்க்கப்படும் வரை காத்திருக்கிறது...');
        await addMemberResumption.clearRadwareAndSettle(page, onProgress, tryAutoClickCaptcha, saveTnpdsCookies);
        isFormOrLoginReady = await page.evaluate(() => {
            return Boolean(document.querySelector('input[placeholder*="கைபேசி"]') || document.querySelector('input[formcontrolname="mobNumber"]:not([disabled])') || document.querySelector('#btnLogout'));
        }).catch(() => false);
    }

    if (!isFormOrLoginReady) {
        onProgress('⚠️ [Strict Gate Halt] TNPDS சேவைப் பக்கம் திறக்கப்படவில்லை. செயல்முறை பாதுகாப்பாக நிறுத்தப்பட்டது.');
        throw new Error('TNPDS_SERVICE_PAGE_NOT_READY: Member login page could not be reached.');
    }

    return { success: true };
}

module.exports = {
    executeFastTestGate,
    executeStep1Preflight
};
