/**
 * TNPDS New Smart Card - Navigation, Challenge Detection, & Preflight Sanitization
 */
const seenToasts = new Set();

async function scanAndBroadcastToasts(page, onProgress = () => {}, logDiag = () => {}) {
    if (!page || page.isClosed()) return;
    try {
        const toastElements = await page.locator('.p-toast, .p-toast-message, .toast, .ui-growl, .ui-growl-message, .mat-snack-bar-container, .alert, .swal2-popup, div[role="alert"]').all();
        for (const el of toastElements) {
            const text = (await el.innerText()).trim();
            if (text && text.length > 3 && !seenToasts.has(text)) {
                seenToasts.add(text);
                logDiag(0, 'portal_alert', text);
                onProgress(`📢 **அரசு இணையதள அறிவிப்பு (Toast Message):**\n"${text}"`);
            }
        }
    } catch (_) {}
}

async function navigateAndPrepareForm(page, onProgress = () => {}, sharedContext = {}, logDiag = () => {}) {
    const { injectVisualBanner = async () => {}, showBrowserHud = async () => {} } = sharedContext;
    try {
        await page.goto('https://www.tnpds.gov.in', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000);
    } catch (_) {}

    const tnpdsUrl = 'https://www.tnpds.gov.in/pages/newsmartcard';
    onProgress('🌐 தமிழ்நாடு அரசு ரேஷன் கார்டு இணையதளம் (TNPDS) உங்கள் திரையில் திறக்கப்படுகிறது...');
    try {
        await page.goto(tnpdsUrl, { waitUntil: 'domcontentloaded', timeout: 40000 });
    } catch (e) {
        console.warn('Initial goto warning:', e.message);
    }
    await page.bringToFront().catch(() => {});

    onProgress('⏳ தமிழ்நாடு அரசு ரேஷன் கார்டு படிவம் திரையில் ஏற்றப்படுகிறது (Loading Form)...');
    let isFormReady = false;

    for (let attempt = 0; attempt < 45; attempt++) {
        isFormReady = await page.evaluate(() => {
            return Boolean(document.querySelector('select[formcontrolname="salutation"]') || document.querySelector('input[formcontrolname="NameOfFamilyHead"]'));
        }).catch(() => false);

        if (isFormReady) break;

        const hasSecurityChallenge = await page.evaluate(() => {
            const isTnpdsActive = Boolean(document.querySelector('select[formcontrolname="salutation"], input[formcontrolname="NameOfFamilyHead"], input[formcontrolname="name"], #nameTam'));
            if (isTnpdsActive) return false;
            const bodyText = (document.body && document.body.innerText) || '';
            const isPerfdrive = window.location.hostname.includes('perfdrive') || window.location.href.includes('validate.perfdrive');
            const hasPerfdriveFrame = Boolean(document.querySelector('iframe[src*="perfdrive"], iframe[src*="validate."]'));
            return isPerfdrive || hasPerfdriveFrame || bodyText.includes('ANOMALY DETECTED') || bodyText.includes('Radware Captcha');
        }).catch(() => false);

        if (hasSecurityChallenge) {
            await page.bringToFront().catch(() => {});
            onProgress('⚠️ **அரசு இணையதள பாதுகாப்பு சோதனை (Human Verification):**\n\nGoogle Chrome சாளரத்தில் தோன்றும் **"I am human"** என்ற கட்டத்தைத் திக் செய்யவும்.');
            await injectVisualBanner(page);

            for (let cAttempt = 0; cAttempt < 120; cAttempt++) {
                await injectVisualBanner(page);
                try {
                    const salCount = await page.locator('select[formcontrolname="salutation"], input[formcontrolname="NameOfFamilyHead"]').count().catch(() => 0);
                    if (salCount > 0) {
                        isFormReady = true;
                        onProgress('✅ **பாதுகாப்பு சோதனை முடிந்தது!** TNPDS படிவம் வெற்றிகரமாகத் திறக்கப்பட்டது.');
                        await showBrowserHud('படிவம் நிரப்பப்படுகிறது...', '', 'info', page);
                        break;
                    }
                } catch (_) {}
                await page.waitForTimeout(5000);
            }
            if (!isFormReady) return { success: false, message: 'அரசு தளம் கேப்ட்சா நிலையில் உள்ளது.' };
            break;
        }
        await page.waitForTimeout(1000);
    }

    if (!isFormReady) {
        try {
            await page.waitForSelector('select[formcontrolname="salutation"], input[formcontrolname="NameOfFamilyHead"]', { timeout: 15000, state: 'attached' });
            isFormReady = true;
        } catch (_) {}
    }
    return { success: isFormReady };
}

function sanitizeNewCardProfile(citizenProfile) {
    const tamName = (citizenProfile.fullNameTam || citizenProfile.name || '').trim();
    let tamFather = (citizenProfile.fatherNameTam || citizenProfile.fatherOrHusbandNameTam || citizenProfile.husbandNameTam || '').trim();
    const doorNo = (citizenProfile.doorNo || '').trim();
    const tamStreet = (citizenProfile.streetTam || '').trim();
    let tamArea = (citizenProfile.areaTam || citizenProfile.village || '').trim();

    const engName = (citizenProfile.fullNameEng || citizenProfile.name || '').trim();
    let engFather = (citizenProfile.fatherNameEng || citizenProfile.fatherOrHusbandNameEng || citizenProfile.husbandNameEng || '').trim();
    let engStreet = (citizenProfile.streetEng || '').trim();
    let engArea = (citizenProfile.areaEng || '').trim();

    if (engFather && !tamFather) tamFather = engFather;
    if (tamFather && !engFather) engFather = tamFather;

    if (!engArea || /[\u0B80-\u0BFF]/.test(engArea)) {
        if (tamArea.includes('நரசிங்க')) engArea = 'NARASINGAPURAM';
        else if (tamArea.includes('குன்னத்')) engArea = 'KUNNATHUR COLONY';
        else if (tamArea.includes('மின்னல்')) engArea = 'MINNAL';
        else if (tamArea.includes('அன்வர்தி')) engArea = 'ANVERTHIKANPETTAI';
        else if (citizenProfile.village) engArea = String(citizenProfile.village).toUpperCase();
        else if (tamArea) engArea = tamArea;
        else engArea = '';
    }

    if (/[\u0B80-\u0BFF]/.test(engStreet)) {
        if (engStreet.includes('பெரிய')) engStreet = 'BIG STREET';
        else if (engStreet.includes('காந்தி')) engStreet = 'GANDHI STREET';
        else engStreet = 'MAIN STREET';
    }
    const pincode = (citizenProfile.pincode || '').trim();
    const userMobile = (citizenProfile.mobileNumber || '').trim();

    return {
        tamName, tamFather, doorNo, tamStreet, tamArea,
        engName, engFather, engStreet, engArea, pincode, userMobile
    };
}

module.exports = {
    seenToasts,
    scanAndBroadcastToasts,
    navigateAndPrepareForm,
    sanitizeNewCardProfile
};
