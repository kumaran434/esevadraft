/**
 * TNPDS New Smart Card - Navigation, Challenge Detection, & Preflight Sanitization
 */
const { normalizeTamilInitialsFromEnglish, ensureBilingualPair } = require('../../../../utils/bilingual_helper');
const seenToasts = new Set();

const PORTAL_ALERT_SELECTORS = [
    '#toast-container .toast',
    '#toast-container .toast-message',
    '.toast',
    '.toast-message',
    '.toast-error',
    '.toast-warning',
    '.toast-info',
    '.p-toast',
    '.p-toast-message',
    '.p-toast-detail',
    '.p-dialog .p-dialog-content',
    '.ui-growl',
    '.ui-growl-message',
    '.mat-snack-bar-container',
    '.alert',
    '.alert-danger',
    '.alert-warning',
    '.swal2-popup',
    'div[role="alert"]'
].join(', ');

async function installRealtimePortalToastObserver(page) {
    if (!page || page.isClosed()) return;
    await page.evaluate((sel) => {
        try {
            window.__esevaCapturedPortalAlerts = window.__esevaCapturedPortalAlerts || [];
            if (window.__esevaToastObserverInstalled) return;
            window.__esevaToastObserverInstalled = true;
            const recordNode = (node) => {
                if (!node || node.nodeType !== 1) return;
                if (node.id === 'eseva-automation-hud' || (node.closest && node.closest('#eseva-automation-hud'))) return;
                const matches = [];
                if (node.matches && node.matches(sel)) matches.push(node);
                if (node.querySelectorAll) {
                    node.querySelectorAll(sel).forEach(el => matches.push(el));
                }
                for (const el of matches) {
                    if (el.id === 'eseva-automation-hud' || (el.closest && el.closest('#eseva-automation-hud'))) continue;
                    const txt = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
                    if (txt && txt.length > 3) {
                        const last = window.__esevaCapturedPortalAlerts[window.__esevaCapturedPortalAlerts.length - 1];
                        if (!last || last.text !== txt || (Date.now() - last.at) > 4000) {
                            window.__esevaCapturedPortalAlerts.push({ text: txt.slice(0, 400), at: Date.now() });
                            if (window.__esevaCapturedPortalAlerts.length > 40) {
                                window.__esevaCapturedPortalAlerts.shift();
                            }
                        }
                    }
                }
            };
            const obs = new MutationObserver((mutations) => {
                for (const m of mutations) {
                    if (m.addedNodes && m.addedNodes.length) {
                        m.addedNodes.forEach(recordNode);
                    }
                    if (m.type === 'characterData' && m.target && m.target.parentElement) {
                        recordNode(m.target.parentElement);
                    }
                }
            });
            obs.observe(document.body || document.documentElement, { childList: true, subtree: true, characterData: true });
        } catch (_) {}
    }, PORTAL_ALERT_SELECTORS).catch(() => {});
}

async function scanAndBroadcastToasts(page, onProgress = () => {}, logDiag = () => {}) {
    if (!page || page.isClosed()) return [];
    const newlyCaptured = [];
    try {
        const snapshot = await page.evaluate((sel) => {
            const drained = Array.isArray(window.__esevaCapturedPortalAlerts)
                ? window.__esevaCapturedPortalAlerts.splice(0, window.__esevaCapturedPortalAlerts.length).map(x => x.text).filter(Boolean)
                : [];
            const visible = [];
            const els = Array.from(document.querySelectorAll(sel));
            for (const el of els) {
                if (el.id === 'eseva-automation-hud' || (el.closest && el.closest('#eseva-automation-hud'))) continue;
                const st = window.getComputedStyle(el);
                if (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') continue;
                const txt = (el.innerText || '').replace(/\s+/g, ' ').trim();
                if (txt && txt.length > 3) visible.push(txt.slice(0, 400));
            }
            return { drained, visible };
        }, PORTAL_ALERT_SELECTORS).catch(() => ({ drained: [], visible: [] }));

        const currentlyVisible = new Set(snapshot.visible || []);
        const combined = [...(snapshot.drained || []), ...(snapshot.visible || [])];
        for (const text of combined) {
            if (text && text.length > 3 && !seenToasts.has(text)) {
                seenToasts.add(text);
                newlyCaptured.push(text);
                logDiag(0, 'portal_alert', text);
                onProgress(`📢 **அரசு இணையதள அறிவிப்பு (Toast Message):**\n"${text}"`);
            }
        }
        // Prune dismissed toasts so repeat OTP/portal alerts in subsequent attempts are ALWAYS logged!
        for (const prev of Array.from(seenToasts)) {
            if (!currentlyVisible.has(prev)) {
                seenToasts.delete(prev);
            }
        }
    } catch (_) {}
    return newlyCaptured;
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
                        await page.evaluate(() => { document.getElementById('eseva-captcha-guide')?.remove(); }).catch(() => {});
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
    let tamName = (citizenProfile.fullNameTam || citizenProfile.name || '').trim();
    let tamFather = (citizenProfile.fatherNameTam || citizenProfile.fatherOrHusbandNameTam || citizenProfile.husbandNameTam || '').trim();
    const doorNo = (citizenProfile.doorNo || '').trim();
    let tamStreet = (citizenProfile.streetTam || '').trim();
    let tamArea = (citizenProfile.areaTam || citizenProfile.village || '').trim();

    const engName = (citizenProfile.fullNameEng || citizenProfile.name || '').trim();
    let engFather = (citizenProfile.fatherNameEng || citizenProfile.fatherOrHusbandNameEng || citizenProfile.husbandNameEng || '').trim();
    let engStreet = (citizenProfile.streetEng || '').trim();
    let engArea = (citizenProfile.areaEng || '').trim();

    const editedFields = Array.isArray(citizenProfile._operatorEditedFields) ? citizenProfile._operatorEditedFields : [];
    const hasOperatorEdit = Boolean(citizenProfile._editedInModalAt || editedFields.length > 0);
    const hasBareLatinInitial = (s) => /(?:^|\s|\.)[A-Za-z](?:\.|\s|$)/.test(String(s || ''));

    if (engName && tamName) {
        if (!hasOperatorEdit || !/[\u0B80-\u0BFF]/.test(tamName) || hasBareLatinInitial(tamName)) {
            tamName = normalizeTamilInitialsFromEnglish(engName, tamName);
        }
    } else if (engName && !tamName) {
        tamName = ensureBilingualPair(engName, '').tam;
    }
    if (engFather && tamFather) {
        if (!hasOperatorEdit || !/[\u0B80-\u0BFF]/.test(tamFather) || hasBareLatinInitial(tamFather)) {
            tamFather = normalizeTamilInitialsFromEnglish(engFather, tamFather);
        }
    }
    if (engFather && !tamFather) tamFather = ensureBilingualPair(engFather, '').tam;
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

    // TNPDS New Smart Card Separation Rule (Founder Mandate):
    // TNPDS has a dedicated Address Line 3 (Area / Hamlet) right below Address Line 2 (Street).
    // Therefore, NEVER duplicate the Hamlet/Village name with a comma inside Address Line 2 (Street)!
    // (Hamlet-in-Street is ONLY for TNeGA CAN Registration which has no separate Address Line 3 box.)
    const stripTrailingHamletFromStreet = (streetVal, areaCandidates = []) => {
        if (!streetVal) return streetVal;
        let cleaned = String(streetVal).trim();
        const escapeRe = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        for (const cand of areaCandidates) {
            const tok = String(cand || '').trim();
            if (tok.length < 3) continue;
            // Strip trailing ", <Hamlet>" (or space-separated if comma-less and street remains non-empty)
            const commaRe = new RegExp(`\\s*,\\s*${escapeRe(tok)}\\s*$`, 'i');
            if (commaRe.test(cleaned)) {
                const without = cleaned.replace(commaRe, '').replace(/[\s,]+$/g, '').trim();
                if (without.length >= 2) cleaned = without;
            }
        }
        return cleaned;
    };
    if (engStreet && (engArea || citizenProfile.village)) {
        engStreet = stripTrailingHamletFromStreet(engStreet, [engArea, citizenProfile.areaEng, citizenProfile.village]);
    }
    if (tamStreet && (tamArea || citizenProfile.villageTam)) {
        tamStreet = stripTrailingHamletFromStreet(tamStreet, [tamArea, citizenProfile.areaTam, citizenProfile.villageTam]);
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
    installRealtimePortalToastObserver,
    scanAndBroadcastToasts,
    navigateAndPrepareForm,
    sanitizeNewCardProfile
};
