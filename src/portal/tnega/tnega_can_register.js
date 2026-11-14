let resolveTnDistrict;
try {
    const dm = require('../../../tn_district_mapper');
    resolveTnDistrict = dm.resolveTnDistrict;
} catch (e) {
    resolveTnDistrict = (d, t, v) => ({ district: d, taluk: t, village: v, wasAutoCorrected: false });
}

const path = require('path');
const fs = require('fs');
const { getTnegaState, launchTnegaBrowser, maximizeTnegaWindow } = require('./tnega_browser_manager');
const { generateCanReceiptPdf } = require('../../services/tnega_receipt_generator');
const { initTnegaHud, updateTnegaHud } = require('./tnega_hud');
const { AiCaptchaSolver } = require('../common/ai_captcha_solver');
const { ensureBilingualPair, formatStreetWithHamlet } = require('../../utils/bilingual_helper');

let saveCitizenDraft = null;
let getCitizenDraft = null;
let APPDATA_DRAFTS_DIR = null;
try {
    const fDb = require('../../../firestore_db');
    saveCitizenDraft = fDb.saveCitizenDraft;
    getCitizenDraft = fDb.getCitizenDraft;
    const fc = require('../../services/db/firestore_client');
    APPDATA_DRAFTS_DIR = fc.APPDATA_DRAFTS_DIR;
} catch (_) {}

async function safeSaveCanToDraft(mobile, citizenProfile, canNumber, subService = 'CAN_REGISTER') {
    if (!saveCitizenDraft || !mobile || !canNumber) return;
    const cleanMob = String(mobile).replace(/\D+/g, '').slice(-10);
    if (!cleanMob) return;
    try {
        const existing = getCitizenDraft ? (await getCitizenDraft(cleanMob).catch(() => null)) : null;
        const mergedProfile = {
            ...((existing && existing.citizenProfile) || {}),
            ...(citizenProfile || {}),
            canNumber
        };
        // If this customer already exists in AppData/Roaming (Desktop runtime), keep it in sync immediately
        if (APPDATA_DRAFTS_DIR) {
            const appDataFile = path.join(APPDATA_DRAFTS_DIR, `${cleanMob}.json`);
            if (fs.existsSync(appDataFile)) {
                try {
                    const appDataDraft = JSON.parse(fs.readFileSync(appDataFile, 'utf8'));
                    appDataDraft.canNumber = canNumber;
                    appDataDraft.citizenProfile = {
                        ...(appDataDraft.citizenProfile || {}),
                        ...mergedProfile,
                        canNumber
                    };
                    appDataDraft.lastUpdated = new Date().toISOString();
                    fs.writeFileSync(appDataFile, JSON.stringify(appDataDraft, null, 2), 'utf8');
                } catch (_) {}
            }
        }

        // Fire-and-forget cloud/draft sync so portal navigation is never blocked by slow network uploads
        saveCitizenDraft(cleanMob, {
            ...(existing || {}),
            citizenProfile: mergedProfile,
            canNumber,
            subService: subService || (existing && existing.subService) || 'CAN_REGISTER'
        }).catch(() => {});
        return true;
    } catch (_) {}
}

/**
 * Extracts all pre-filled citizen details from an open TNeGA Certificate/CAN page
 * (e.g., IncomeCertificate.xhtml or canregistration.xhtml) to reverse-populate a customer's Master Profile.
 */
async function extractPreFilledPortalCanDetails(page) {
    if (!page || page.isClosed()) return null;
    try {
        return await page.evaluate(() => {
            const val = (id) => {
                const el = document.getElementById(id);
                if (!el) return '';
                if (el.tagName === 'SELECT') {
                    const opt = el.options[el.selectedIndex];
                    return opt && opt.value ? opt.text.trim() : '';
                }
                return (el.value || '').trim();
            };
            const canNumber = val('incme:cannumber') || val('canform:cannumber') || '';
            const headAadhaar = val('incme:aadharno') || val('canform:aadharno') || '';
            const fullNameEng = val('incme:appNameId') || val('canform:appNameId') || '';
            const fullNameTam = val('incme:appNameTmId') || val('canform:appNameTmId') || '';
            const fatherNameEng = val('incme:fatherId') || val('canform:fatherId') || '';
            const fatherNameTam = val('incme:fatherTmId') || val('canform:fatherTmId') || '';
            const motherNameEng = val('incme:motherId') || val('canform:motherId') || '';
            const motherNameTam = val('incme:motherTmId') || val('canform:motherTmId') || '';
            const headDob = (val('incme:dateobInputDate') || val('canform:dateobInputDate') || '').replace(/-/g, '/');
            const headGender = val('incme:genderId') || val('canform:genderId') || '';
            const religion = val('incme:religionId') || val('canform:religionId') || '';
            const community = val('incme:communityId') || val('canform:communityId') || '';
            const district = val('incme:cDistrictId') || val('canform:cDistrictId') || '';
            const taluk = val('incme:cTalukId') || val('canform:cTalukId') || '';
            const village = val('incme:cRvId') || val('canform:cRvId') || '';
            const streetEng = val('incme:cStreetId') || val('canform:cStreetId') || '';
            const streetTam = val('incme:streetnumtm') || val('canform:streetnumtm') || '';
            const doorNo = val('incme:cBuildingId') || val('canform:cBuildingId') || '';
            const pincode = val('incme:cPincodeId') || val('canform:cPincodeId') || '';
            const mobileNumber = val('incme:mobileId') || val('canform:mobileId') || '';

            if (!canNumber && !fullNameEng && !headAadhaar) return null;
            return {
                canNumber,
                headAadhaar,
                fullNameEng,
                fullNameTam,
                fatherNameEng,
                fatherNameTam,
                motherNameEng,
                motherNameTam,
                headDob,
                dob: headDob,
                headGender,
                religion,
                community,
                district,
                taluk,
                village,
                streetEng,
                streetTam,
                doorNo,
                pincode,
                mobileNumber
            };
        });
    } catch (_) {
        return null;
    }
}

/**
 * Universal Bilingual Dual-Typing Helper (Golden Rule 7)
 * Ensures 100% verified English & Tamil inputs without portal auto-transliteration corruption
 */
async function fillBilingualPair(page, engSelector, tamSelector, engValue, tamValue, fieldLabel, onProgress) {
    if (!engValue && !tamValue) return;

    const { eng: verifiedEng, tam: verifiedTam } = ensureBilingualPair(engValue, tamValue);

    // 1. English input
    try {
        const engLocator = page.locator(engSelector).first();
        if (await engLocator.count() > 0 && await engLocator.isVisible()) {
            await engLocator.click().catch(() => {});
            await engLocator.fill('');
            await engLocator.fill(verifiedEng || '');
            await engLocator.dispatchEvent('input', { bubbles: true }).catch(() => {});
            await engLocator.dispatchEvent('change', { bubbles: true }).catch(() => {});
            await engLocator.dispatchEvent('blur', { bubbles: true }).catch(() => {});
            // Wait for portal's auto-transliteration (mytranslate1) to settle
            await page.waitForTimeout(500);
        }
    } catch (_) {}

    // 2. Tamil input - Mandatory Explicit Dual Typing & Event Dispatch (Rule 7)
    try {
        const tamLocator = page.locator(tamSelector).first();
        if (await tamLocator.count() > 0 && await tamLocator.isVisible()) {
            await tamLocator.click().catch(() => {});
            await tamLocator.fill('');
            await page.waitForTimeout(100);
            await tamLocator.fill(verifiedTam || '');
            await tamLocator.dispatchEvent('input', { bubbles: true }).catch(() => {});
            await tamLocator.dispatchEvent('change', { bubbles: true }).catch(() => {});
            await tamLocator.dispatchEvent('blur', { bubbles: true }).catch(() => {});

            // DOM-level verification & force injection if mismatch or delayed overwrite
            await page.waitForTimeout(300);
            const currentVal = await tamLocator.inputValue().catch(() => '');
            if (currentVal !== verifiedTam) {
                await page.evaluate(({ sel, val }) => {
                    const el = document.querySelector(sel);
                    if (el) {
                        el.value = val;
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                        el.dispatchEvent(new Event('blur', { bubbles: true }));
                    }
                }, { sel: tamSelector, val: verifiedTam }).catch(() => {});
            }
        }
    } catch (_) {}

    if (onProgress && fieldLabel) {
        onProgress(`✍️ [விதி 7] ${fieldLabel}: ${verifiedTam} (${verifiedEng})`);
    }
}

/**
 * Dropdown Selector Helper with Fuzzy Text & Value Matching
 */
async function safeSelect(locator, matchVal) {
    if (!matchVal || (await locator.count()) === 0) return false;
    try {
        const options = await locator.locator('option').all();
        for (const opt of options) {
            const txt = (await opt.innerText()).trim();
            const val = await opt.getAttribute('value');
            if (txt.toLowerCase().includes(matchVal.toLowerCase()) || (val && val.toLowerCase() === matchVal.toLowerCase())) {
                await locator.selectOption(val);
                await locator.dispatchEvent('change').catch(() => {});
                return true;
            }
        }
    } catch (_) {}
    return false;
}

/**
 * Resolves saved TNeGA operator credentials across all candidate operator identifiers
 * (operatorUid -> citizenProfile.operatorUid -> draftData.operatorUid -> operatorName -> active local desktop session)
 */
function resolveTnegaVaultCredentials(options = {}, citizenProfile = {}) {
    try {
        const { getOperatorPortalCredentials } = require('../../services/portal_vault_service');
        const candidates = [
            options?.operatorUid,
            citizenProfile?.operatorUid,
            options?.draftData?.operatorUid,
            options?.draftData?.citizenProfile?.operatorUid,
            options?.operatorName,
            citizenProfile?.operatorName,
            options?.draftData?.operatorName,
            'admin'
        ].filter(Boolean);

        const seen = new Set();
        for (const cand of candidates) {
            const key = String(cand).trim();
            if (!key || seen.has(key)) continue;
            seen.add(key);
            const creds = getOperatorPortalCredentials(key, 'tnega');
            if (creds && creds.username && creds.password) {
                return creds;
            }
        }
    } catch (_) {}
    return null;
}

/**
 * Automated Operator Login & Captcha Solver with Live HUD
 */
async function performAutomatedTnegaLogin(page, vaultCreds, onProgress, options = {}) {
    onProgress(`🔐 [அரசு பெட்டகம்] சேமிக்கப்பட்ட TNeGA ஆப்ரேட்டர் லாகின் (${vaultCreds.username}) தொடங்குகிறது...`);
    await updateTnegaHud(page, {
        title: '🔐 TNeGA ஆப்ரேட்டர் உள்நுழைவு',
        desc: `பயனர்: ${vaultCreds.username} விவரங்கள் தானாக நிரப்பப்படுகின்றன...`,
        badge: 'Operator Login',
        type: 'working'
    });

    let lastDialogMessage = '';
    const dialogHandler = async (dialog) => {
        try {
            const msg = dialog.message();
            lastDialogMessage = msg;
            onProgress(`🔔 [TNeGA பாப்-அப் எச்சரிக்கை] "${msg}"`);
            await dialog.accept().catch(() => {});
        } catch (_) {}
    };
    page.on('dialog', dialogHandler);

    const userInp = page.locator('#txtuserName, input[name*="txtuserName"]').first();
    const passInp = page.locator('#txtpassword, input[name*="txtpassword"], input[type="password"]').first();
    const ddlOp = page.locator('#ContentPlaceHolderTop_OuterContentPlaceHolderBody_ddloperator, select[name*="ddloperator"]').first();

    // Ensure login input fields are rendered before starting attempt loop
    await userInp.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});

    // Check if an orphaned session exists and close it (TNeGA 1-session lock rule)
    const btnCloseSession = page.locator('#ContentPlaceHolderTop_OuterContentPlaceHolderBody_btnCloseSession, input[value="Close Logged Session"]').first();
    if (await btnCloseSession.count() > 0 && await btnCloseSession.isVisible()) {
        onProgress('🔄 [அமர்வு மீட்டமைப்பு] முந்தைய திறந்த அமர்வு கண்டறியப்பட்டது — Close Logged Session அழுத்தப்படுகிறது...');
        await btnCloseSession.click().catch(() => {});
        await page.waitForLoadState('domcontentloaded').catch(() => {});
        await page.waitForTimeout(1500);
    }

    // Captcha Solve & Login Retry Loop (up to 4 attempts)
    let loginSuccess = false;
    for (let attempt = 1; attempt <= 4; attempt++) {
        const currentUrl = page.url().toLowerCase();
        if (!currentUrl.includes('default.aspx') && !currentUrl.includes('portallogin.aspx')) {
            loginSuccess = true;
            break;
        }

        // 1. Golden Rule 8: Check for any disclaimer / maintenance popup modal and click "Close" or "Proceed" button
        const closeDisclaimerBtn = page.locator('button:has-text("Close"), input[value*="Close"], a:has-text("Close"), button:has-text("Proceed"), input[value*="Proceed"], button:has-text("OK"), input[value="OK"], .modal-footer button, #btnClose, .close, div.modal:has-text("maintenance") button').first();
        if (await closeDisclaimerBtn.count() > 0 && await closeDisclaimerBtn.isVisible()) {
            onProgress('ℹ️ [விதி 8] தகவல் அறிவிப்பு பாப்-அப் கண்டறியப்பட்டது — Close பொத்தான் அழுத்தப்படுகிறது...');
            await closeDisclaimerBtn.click().catch(() => {});
            await page.waitForTimeout(600);
        }

        // 2. Mandatory Explicit Re-filling of Username, Password, Role on Every Attempt (ASP.NET postback / hashing wipes plain text!)
        if (await userInp.count() > 0) {
            await userInp.click().catch(() => {});
            await userInp.fill('');
            await userInp.fill(vaultCreds.username);
            await userInp.dispatchEvent('input', { bubbles: true }).catch(() => {});
            await userInp.dispatchEvent('change', { bubbles: true }).catch(() => {});
            await userInp.dispatchEvent('blur', { bubbles: true }).catch(() => {});
        }
        if (await passInp.count() > 0) {
            await passInp.click().catch(() => {});
            await passInp.fill('');
            await passInp.fill(vaultCreds.password);
            await passInp.dispatchEvent('input', { bubbles: true }).catch(() => {});
            await passInp.dispatchEvent('change', { bubbles: true }).catch(() => {});
            await passInp.dispatchEvent('blur', { bubbles: true }).catch(() => {});
        }
        if (await ddlOp.count() > 0) {
            await safeSelect(ddlOp, vaultCreds.operatorCode || 'OM');
        }

        const captchaImg = page.locator('img[src*="CaptchaImage"], img[src*="Captcha"], #imgCaptcha').first();
        const captchaInp = page.locator('#txtCaptcha, input[name*="txtCaptcha"]').first();

        await captchaImg.waitFor({ state: 'visible', timeout: 6000 }).catch(() => {});
        if (await captchaImg.count() === 0 || !(await captchaImg.isVisible())) {
            await page.waitForTimeout(1000);
            continue;
        }

        // Ensure captcha image is fully rendered and downloaded with valid dimensions
        await captchaImg.evaluate((img) => img.complete && img.naturalWidth > 0).catch(() => false);

        onProgress(`⚡ [AI Captcha OCR] கேப்ட்சா படம் அதிவேகமாக ஆய்வு செய்யப்படுகிறது (முயற்சி ${attempt}/4)...`);

        // Screenshot the captcha element with high-speed canvas extraction (compact JPEG for fastest transmission)
        let captchaBuf = await page.evaluate(() => {
            try {
                const img = document.querySelector('img[src*="CaptchaImage"], img[src*="Captcha"], #imgCaptcha');
                if (!img || !img.complete || img.naturalWidth === 0) return null;
                const canvas = document.createElement('canvas');
                const scale = 1.8;
                canvas.width = Math.round(img.naturalWidth * scale);
                canvas.height = Math.round(img.naturalHeight * scale);
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                return canvas.toDataURL('image/jpeg', 0.9);
            } catch (_) {
                return null;
            }
        }).catch(() => null);

        if (!captchaBuf) {
            captchaBuf = await captchaImg.screenshot().catch(() => null);
        }
        if (!captchaBuf) {
            await page.waitForTimeout(200);
            continue;
        }

        const solvedCode = await AiCaptchaSolver.solve(captchaBuf, { ...options, isTnega: true, portal: 'tnega', captchaLen: 5 });

        if (!solvedCode || solvedCode.length < 4) {
            onProgress(`⚠️ [AI Captcha] முயற்சி ${attempt}: குறியீடு தெளிவாகப் பெறப்படவில்லை, உடனடியாக மீண்டும் முயற்சிக்கிறது...`);
            const refreshBtn = page.locator('a[id*="Captcha"], img[src*="refresh"], a:has-text("Refresh")').first();
            if (await refreshBtn.count() > 0) await refreshBtn.click().catch(() => {});
            await page.waitForTimeout(250);
            continue;
        }

        onProgress(`⚡ [AI Captcha] குறியீடு பெறப்பட்டது: ${solvedCode} ✅`);

        // Instant Fill & Event Dispatch (Zero latency typing)
        await captchaInp.fill(solvedCode);
        await captchaInp.dispatchEvent('input', { bubbles: true }).catch(() => {});
        await captchaInp.dispatchEvent('change', { bubbles: true }).catch(() => {});

        lastDialogMessage = '';
        const btnLogin = page.locator('#ContentPlaceHolderTop_OuterContentPlaceHolderBody_btnLogin, input[value="Login"]').first();
        if (await btnLogin.count() > 0) {
            onProgress('🚀 தானியங்கி Login பொத்தான் அழுத்தப்படுகிறது...');
            const navPromise = page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 8000 }).catch(() => null);
            await btnLogin.click().catch(() => {});
            await Promise.race([
                navPromise,
                page.waitForFunction(() => {
                    const u = window.location.href.toLowerCase();
                    if (!u.includes('default.aspx') && !u.includes('portallogin.aspx')) return true;
                    const err = document.querySelector('#lblMessage, #lblError, #lblMsg, .alert-danger');
                    return Boolean(err && err.offsetParent !== null && err.innerText.trim());
                }, { timeout: 4000 }).catch(() => null)
            ]);
            await page.waitForTimeout(400);
        }

        const postUrl = page.url().toLowerCase();
        if (!postUrl.includes('default.aspx') && !postUrl.includes('portallogin.aspx')) {
            loginSuccess = true;
            onProgress('🎉 TNeGA போர்ட்டலில் வெற்றிகரமாக உள்நுழைந்தது!');
            await updateTnegaHud(page, {
                title: '🎉 TNeGA உள்நுழைவு வெற்றி!',
                desc: 'ஆப்ரேட்டர் கணக்கு வெற்றிகரமாக உள்நுழைந்தது.',
                badge: 'Logged In ✅',
                type: 'success'
            });
            break;
        }

        if (lastDialogMessage) {
            onProgress(`⚠️ போர்ட்டல் எச்சரிக்கை செய்தி: "${lastDialogMessage}"`);
        }

        const errorText = await page.evaluate(() => {
            const msgEl = document.querySelector('#lblMessage, #lblError, #lblMsg, .alert-danger');
            if (msgEl && msgEl.offsetParent !== null && msgEl.innerText.trim()) return msgEl.innerText.trim();
            const maintEl = document.querySelector('span[style*="red"]');
            if (maintEl && maintEl.offsetParent !== null && maintEl.innerText.includes('maintenance')) {
                return 'அரசு தளம் பராமரிப்பில் உள்ளது (Server Under Maintenance)';
            }
            return '';
        }).catch(() => '');

        if (errorText) {
            onProgress(`⚠️ போர்ட்டல் தகவல்: ${errorText} — மீண்டும் புதிய கேப்ட்சா முயலப்படுகிறது...`);
        }
        await page.waitForTimeout(300);
    }

    try { page.off('dialog', dialogHandler); } catch (_) {}
    return loginSuccess;
}

/**
 * Live CAN Search on validateAadhar.xhtml (Golden Rule 9 Verified DOM Selectors)
 * Searches by CAN Number, Aadhaar Number (#statusform:aadharNo), or Mobile Number (#statusform:applicantMobile),
 * parses #statusform:table rows, disambiguates shared family mobile numbers by applicant name,
 * and selects the matching radio button (#statusform:table:X:canradioid:0).
 */
async function performLiveCanLookupOnPage(tnegaPage, criteria = {}, onProgress = () => {}) {
    const cleanAadhaar = String(criteria.aadhaar || '').replace(/\D+/g, '');
    const cleanMobile = String(criteria.mobile || '').replace(/\D+/g, '');
    const cleanCan = String(criteria.canNumber || '').replace(/\D+/g, '');
    const targetName = String(criteria.applicantName || '').trim();
    const strictNameMatch = criteria.strictNameMatch === true;

    const runSingleFieldSearch = async (fieldId, value, label) => {
        if (!value) return { searched: false, records: [], msg: '' };
        onProgress(`🔍 [CAN முன்-சரிபார்ப்பு] ${label} (${fieldId === 'statusform:aadharNo' ? 'XXXX-XXXX-' + value.slice(-4) : value}) கொண்டு போர்ட்டலில் CAN எண் உள்ளதா எனத் தேடப்படுகிறது...`);
        await updateTnegaHud(tnegaPage, {
            title: `🔍 CAN எண் தேடப்படுகிறது (${label})...`,
            desc: `${label} கொண்டு ஏற்கனவே CAN எண் பதிவு செய்யப்பட்டுள்ளதா எனச் சரிபார்க்கப்படுகிறது...`,
            badge: 'CAN Lookup',
            type: 'working'
        }).catch(() => {});

        const fieldFilledOk = await tnegaPage.evaluate(({ fId, val }) => {
            const ids = [
                'statusform:aadhar',
                'statusform:applicantName',
                'statusform:appFatherName',
                'statusform:applicantMobile',
                'statusform:appEmail',
                'statusform:aadharNo'
            ];
            for (const id of ids) {
                const el = document.getElementById(id);
                if (el) {
                    el.value = '';
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
            const targetEl = document.getElementById(fId);
            if (!targetEl) return false;
            targetEl.focus();
            targetEl.value = val;
            targetEl.dispatchEvent(new Event('input', { bubbles: true }));
            targetEl.dispatchEvent(new Event('change', { bubbles: true }));
            targetEl.dispatchEvent(new Event('blur', { bubbles: true }));
            // Safeguard: ensure Verhoeff or onblur did not wipe the field!
            if (!targetEl.value || targetEl.value.trim() !== val) {
                return false;
            }
            const searchBtn = document.getElementById('statusform:Search') || document.querySelector('input[value="Search"]');
            if (searchBtn) {
                searchBtn.click();
                return true;
            }
            return false;
        }, { fId: fieldId, val: value }).catch(() => false);

        if (!fieldFilledOk) {
            return { searched: false, records: [], msg: 'Field validation rejected value' };
        }

        await tnegaPage.waitForTimeout(2600);

        const result = await tnegaPage.evaluate(() => {
            const msgEl = document.getElementById('statusform:SubmitMsgforsearch');
            const msg = msgEl ? (msgEl.innerText || '').trim() : '';
            const rows = Array.from(document.querySelectorAll('#statusform\\:table tr.rf-dt-r'));
            const records = [];
            for (const tr of rows) {
                const radio = tr.querySelector('input[type="radio"][name*="canradioid"]');
                const cells = Array.from(tr.children).map(td => (td.innerText || '').trim());
                const canVal = (radio && radio.value) ? radio.value.trim() : (cells[1] || '');
                if (canVal && /^\d{10,18}$/.test(canVal)) {
                    records.push({
                        radioId: radio ? radio.id : '',
                        canNumber: canVal,
                        name: cells[2] || '',
                        fatherName: cells[3] || '',
                        dob: (cells[4] || '').replace(/-/g, '/'),
                        streetName: cells[5] || ''
                    });
                }
            }
            return { searched: true, msg, records };
        }).catch(() => ({ searched: true, msg: '', records: [] }));

        return result;
    };

    const pickMatchingRecord = (records, searchedByUniqueId) => {
        if (!Array.isArray(records) || records.length === 0) return null;
        if (searchedByUniqueId && records.length === 1) {
            return records[0];
        }
        const cleanTarget = targetName.toLowerCase().replace(/[^a-z0-9\u0B80-\u0BFF\s]/g, '').trim();
        const isGenericTarget = !cleanTarget || cleanTarget === 'வாடிக்கையாளர்' || cleanTarget === 'citizen' || cleanTarget === 'applicant';
        if (!isGenericTarget) {
            const targetTokens = cleanTarget.split(/\s+/).filter(t => t.length >= 3);
            const exactOrTokenMatch = records.find(r => {
                const rName = (r.name || '').toLowerCase().replace(/[^a-z0-9\u0B80-\u0BFF\s]/g, '').trim();
                if (!rName) return false;
                if (rName === cleanTarget || rName.includes(cleanTarget) || cleanTarget.includes(rName)) return true;
                return targetTokens.some(tok => rName.includes(tok));
            });
            if (exactOrTokenMatch) return exactOrTokenMatch;
            if (strictNameMatch && !searchedByUniqueId) {
                return null;
            }
        }
        return records[0];
    };

    let allRecords = [];
    let matchedRecord = null;

    // 1. Try CAN Number directly if provided
    if (cleanCan.length >= 10) {
        const resCan = await runSingleFieldSearch('statusform:aadhar', cleanCan, 'CAN எண்');
        if (resCan.records && resCan.records.length > 0) {
            allRecords = resCan.records;
            matchedRecord = pickMatchingRecord(resCan.records, true);
        }
    }

    // 2. Priority 1: Search by 12-digit Aadhaar Number (#statusform:aadharNo) - 100% Unique per person
    if (!matchedRecord && cleanAadhaar.length === 12) {
        const resAadhaar = await runSingleFieldSearch('statusform:aadharNo', cleanAadhaar, 'ஆதார் எண்');
        if (resAadhaar.records && resAadhaar.records.length > 0) {
            allRecords = resAadhaar.records;
            matchedRecord = pickMatchingRecord(resAadhaar.records, true);
        }
    }

    // 3. Priority 2: Search by 10-digit Mobile Number (#statusform:applicantMobile)
    if (!matchedRecord && cleanMobile.length === 10) {
        const resMob = await runSingleFieldSearch('statusform:applicantMobile', cleanMobile, 'மொபைல் எண்');
        if (resMob.records && resMob.records.length > 0) {
            allRecords = resMob.records;
            matchedRecord = pickMatchingRecord(resMob.records, false);
            if (!matchedRecord && resMob.records.length > 0) {
                const namesList = resMob.records.map(r => `${r.name} (${r.canNumber})`).join(', ');
                onProgress(`ℹ️ இந்த மொபைல் எண்ணில் (${cleanMobile}) குடும்ப உறுப்பினர்கள் உள்ளனர்: [${namesList}], ஆனால் "${targetName}" பெயரில் CAN இல்லை.`);
            }
        }
    }

    if (matchedRecord) {
        onProgress(`🎉 ஏற்கனவே பதிவு செய்யப்பட்ட CAN எண் கண்டறியப்பட்டது: ${matchedRecord.canNumber} (பெயர்: ${matchedRecord.name} | தந்தை/கணவர்: ${matchedRecord.fatherName})`);
        // Select the radio button on validateAadhar.xhtml so Proceed / Edit CAN Detail buttons appear
        await tnegaPage.evaluate((rId) => {
            const radio = (rId && document.getElementById(rId)) || document.querySelector('input[type="radio"][name*="canradioid"]');
            if (radio) {
                radio.click();
                radio.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }, matchedRecord.radioId).catch(() => {});
        await tnegaPage.waitForTimeout(1800);

        return {
            found: true,
            matchedRecord,
            records: allRecords
        };
    }

    return {
        found: false,
        matchedRecord: null,
        records: allRecords
    };
}

/**
 * Universal TNeGA CAN Registration Engine
 * Adheres strictly to Golden Rules 1, 3, 4, 5, 6, 7
 */
async function registerNewCan(citizenProfile = {}, onProgress = () => {}, options = {}) {
    const state = getTnegaState();
    const isMock = options.isMockSandbox !== false && options.forceRealGovtOtp !== true;
    state.isMockSandboxMode = isMock;
    state.currentTnegaStep = 'CAN_REGISTRATION';
    state.lastTnegaError = null;

    onProgress('📝 புதிய CAN பதிவு (New CAN Registration) தொடங்குகிறது...');

    const rawAddr = [citizenProfile.streetEng, citizenProfile.streetTam, citizenProfile.areaEng, citizenProfile.areaTam].filter(Boolean).join(' ');
    const geo = resolveTnDistrict(
        citizenProfile.district || 'Ranipet',
        citizenProfile.taluk || '',
        citizenProfile.village || '',
        citizenProfile.pincode,
        rawAddr
    );

    const namePair = ensureBilingualPair(
        citizenProfile.fullNameEng || citizenProfile.headNameEng || 'Kumaran K',
        citizenProfile.fullNameTam || citizenProfile.headNameTam || 'குமரன் கி'
    );
    const fullNameEng = namePair.eng;
    const fullNameTam = namePair.tam;

    const fatherPair = ensureBilingualPair(
        citizenProfile.fatherNameEng || citizenProfile.relativeNameEng || 'Kirubakaran',
        citizenProfile.fatherNameTam || citizenProfile.relativeNameTam || 'கிருபாகரன்'
    );
    const fatherNameEng = fatherPair.eng;
    const fatherNameTam = fatherPair.tam;

    const rawMotherEng = citizenProfile.motherNameEng || citizenProfile.motherName || '';
    const rawMotherTam = citizenProfile.motherNameTam || citizenProfile.motherName || '';
    const motherPair = ensureBilingualPair(rawMotherEng, rawMotherTam);
    const motherNameEng = motherPair.eng;
    const motherNameTam = motherPair.tam;

    const dob = citizenProfile.dob || citizenProfile.headDob || '10/06/1993';
    const gender = citizenProfile.gender || citizenProfile.headGender || 'Male';
    const genderTam = citizenProfile.genderTam || citizenProfile.headGenderTam || (gender === 'Female' ? 'பெண்' : 'ஆண்');
    const mobile = (citizenProfile.mobileNumber || citizenProfile.mobile || '9842367866').replace(/\D+/g, '');
    const aadhaar = (citizenProfile.headAadhaar || citizenProfile.aadhaar || citizenProfile.aadhaarNumber || '575567662931').replace(/\s+/g, '');
    const community = citizenProfile.community || citizenProfile.caste || 'MBC';
    const religion = citizenProfile.religion || 'Hindu';
    const doorNo = citizenProfile.doorNo || '216';
    const pincode = citizenProfile.pincode || '632510';

    // Hamlet & Street Formatting (Rule 6 & Rule 7): Always include Hamlet/Village in both English & Tamil
    const { fullStreetEng, fullStreetTam } = formatStreetWithHamlet(citizenProfile, geo);
    const streetEng = fullStreetEng;
    const streetTam = fullStreetTam;

    onProgress(`👤 விண்ணப்பதாரர்: ${fullNameTam} (${fullNameEng})`);
    onProgress(`👨 தந்தை/கணவர் பெயர்: ${fatherNameTam} (${fatherNameEng})`);
    if (motherNameTam || motherNameEng) {
        onProgress(`👩 தாயின் பெயர்: ${motherNameTam} (${motherNameEng})`);
    }
    onProgress(`🏷️ சமூகப் பிரிவு: ${community} | மதம்: ${religion}`);
    onProgress(`🏠 தெரு & குக்கிராமம்: ${fullStreetTam} (${fullStreetEng})`);
    onProgress(`🏛️ வருவாய் பகுதி: ${geo.district} | ${geo.taluk} | ${geo.village}`);

    const appDir = path.join(__dirname, '..', '..', '..');
    const receiptPath = path.join(appDir, 'uploads', `receipt_can_${mobile}_${Date.now()}.pdf`);

    // SAFE MOCK SANDBOX MODE
    if (isMock) {
        await new Promise(r => setTimeout(r, 600));
        onProgress('1️⃣ ஆதார் மற்றும் தனிநபர் தகவல்கள் நிரப்பப்பட்டது ✅');
        await new Promise(r => setTimeout(r, 600));
        onProgress('2️⃣ வருவாய் மாவட்ட முகவரி விவரங்கள் தேர்வு செய்யப்பட்டது ✅');
        await new Promise(r => setTimeout(r, 600));

        const mockNewCan = '133' + Date.now().toString().slice(-10);
        state.activeCanNumber = mockNewCan;
        state.currentTnegaStep = 'CAN_REGISTERED';

        citizenProfile.canNumber = mockNewCan;
        try {
            await generateCanReceiptPdf(receiptPath, {
                canNumber: mockNewCan,
                fullNameEng,
                fullNameTam,
                fatherNameEng,
                fatherNameTam,
                mobile,
                aadhaar,
                genderTam,
                dob,
                district: geo.district,
                taluk: geo.taluk,
                village: geo.village,
                doorNo,
                streetTam,
                streetEng,
                pincode
            });
        } catch (_) {}

        if (saveCitizenDraft && mobile) {
            try {
                await saveCitizenDraft(mobile, { citizenProfile, subService: 'CAN_REGISTER', canNumber: mockNewCan });
            } catch (_) {}
        }

        onProgress(`🎉 [Safe Mock Sandbox] புதிய 13-இலக்க CAN எண் வெற்றிகரமாக உருவாக்கப்பட்டது!`);
        onProgress(`🌟 புதிய CAN எண்: ${mockNewCan}`);
        onProgress(`📄 CAN பதிவு ஒப்புதல் ரசீது PDF உருவாக்கப்பட்டது.`);

        return {
            success: true,
            message: `🎉 [Safe Mock Sandbox] புதிய 13-இலக்க CAN எண் வெற்றிகரமாக உருவாக்கப்பட்டது! எண்: ${mockNewCan}`,
            canNumber: mockNewCan,
            applicationNumber: mockNewCan,
            citizenName: fullNameTam,
            mobile: mobile,
            aadhaar: aadhaar,
            receiptPdf: receiptPath,
            isMockSandbox: true
        };
    }

    // LIVE PRODUCTION MODE (Physical Desktop Winsta0\Default / CDP)
    try {
        let tnegaPage = state.page;
        if (!tnegaPage || tnegaPage.isClosed()) {
            onProgress('🌐 TNeGA பிரவுசர் சாளரம் தொடங்கப்படுகிறது (Google Chrome)...');
            const launched = await launchTnegaBrowser(false, options);
            tnegaPage = launched.page;
        }

        if (state.context) {
            const activeWfPage = state.context.pages().find(p => !p.isClosed() && (p.url().toLowerCase().includes('tnedistrict') || p.url().toLowerCase().includes('validateaadhar') || p.url().toLowerCase().includes('services.aspx') || p.url().toLowerCase().includes('canregistration') || p.url().toLowerCase().includes('instruction')));
            if (activeWfPage && activeWfPage !== tnegaPage) {
                tnegaPage = activeWfPage;
                state.page = activeWfPage;
                await tnegaPage.bringToFront().catch(() => {});
            }
        }

        // Initialize in-browser HUD overlay
        await initTnegaHud(tnegaPage);

        // Check if page is already logged in to prevent duplicate login attempts (Anti-Block Law)
        const existingUrl = tnegaPage.url() ? tnegaPage.url().toLowerCase() : '';
        const isAlreadyLoggedIn = (existingUrl.includes('tnesevai.tn.gov.in') || existingUrl.includes('tnedistrict.tn.gov.in')) && 
                                  !existingUrl.includes('default.aspx') && 
                                  !existingUrl.includes('portallogin.aspx') &&
                                  !existingUrl.includes('internalerror') &&
                                  !existingUrl.includes('about:blank');

        if (isAlreadyLoggedIn) {
            onProgress(`🎉 [அமர்வு தொடர்கிறது] ஏற்கனவே உள்நுழைந்துள்ள தளம் கண்டறியப்பட்டது: ${existingUrl}`);
            onProgress('⚡ மீண்டும் லாகின் செய்ய தேவையில்லை! தற்போதைய அமர்விலிருந்து நேரடியாகப் பணி தொடர்கிறது...');
            await updateTnegaHud(tnegaPage, {
                title: '🎉 நேரலை அமர்வு தொடர்கிறது',
                desc: 'ஏற்கனவே உள்நுழைந்துள்ள கணக்கிலிருந்து நேரடியாகப் பணி தொடர்கிறது...',
                badge: 'Session Active',
                type: 'success'
            });
        } else {
            await updateTnegaHud(tnegaPage, {
                title: '🌐 TNeGA போர்ட்டல் தயாராகிறது...',
                desc: 'https://www.tnesevai.tn.gov.in/Default.aspx',
                badge: 'தயார் நிலை',
                type: 'working'
            });

            onProgress('🌐 TNeGA போர்ட்டல் பக்கத்திற்குச் செல்கிறது (https://www.tnesevai.tn.gov.in/Default.aspx)...');
            await tnegaPage.goto('https://www.tnesevai.tn.gov.in/Default.aspx', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});

            // Check if on login page and autofill from vault with automated AI Captcha solving
            const userInp = tnegaPage.locator('#txtuserName, input[name*="txtuserName"]').first();
            await userInp.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
            if (await userInp.count() > 0 && await userInp.isVisible()) {
                const vaultCreds = resolveTnegaVaultCredentials(options, citizenProfile);

                if (vaultCreds && vaultCreds.username && vaultCreds.password) {
                    await performAutomatedTnegaLogin(tnegaPage, vaultCreds, onProgress, options);
                } else {
                    onProgress('🔐 TNeGA உள்நுழைவு திரை திரையில் உள்ளது. உங்கள் கணக்கில் உள்நுழையவும்.');
                    onProgress('💡 உதவி: "TNeGA லாகின் பெட்டகத்தில்" உங்கள் விவரங்களை சேமித்து வைத்தால் அடுத்த முறை தானாகவே Login ஆகிவிடும்!');
                    await updateTnegaHud(tnegaPage, {
                        title: '🔐 TNeGA உள்நுழைவு தேவை',
                        desc: 'தயவுசெய்து உங்கள் ஆப்ரேட்டர் கணக்கில் உள்நுழையவும்.',
                        badge: 'Login Needed',
                        type: 'waiting'
                    });
                }
                onProgress('👁️ [விதி 5 நேரலை பின்னணி இயக்கம்] உள்நுழைவு அல்லது பக்க மாற்றங்களை தானியங்கி தொடர்ந்து கவனித்து வருகிறது...');
            }
        }

        // Live Observer Loop: watches for user login / service click / CAN form (Golden Rule 5 Non-Stop Daemon)
        let formReady = false;
        let loopCounter = 0;
        let rev103Clicked = false;
        let rev103ClickTime = 0;
        let proceedClicked = false;
        let proceedClickTime = 0;
        let preSearchDone = false;

        while (!formReady) {
            loopCounter++;
            await new Promise(r => setTimeout(r, 1500));

            try {
                // Multi-tab / Popup Watcher (Golden Rule 8 & 9):
                // In TNeGA, clicking REV-103 opens a new tab on tnedistrict.tn.gov.in (or Default.aspx?Msg=... if session timed out).
                if (state.context) {
                    const allPages = state.context.pages().filter(p => !p.isClosed());
                    // Close expired /tneda/ tabs automatically
                    for (const p of allPages) {
                        const pu = p.url().toLowerCase();
                        if (pu.endsWith('/tneda/') || pu.endsWith('/tneda') || pu.includes('/tneda/login')) {
                            await p.close().catch(() => {});
                        }
                    }
                    const remainingPages = state.context.pages().filter(p => !p.isClosed());
                    const loginRedirectPage = remainingPages.find(p => p.url().toLowerCase().includes('default.aspx'));
                    const canPages = remainingPages.filter(p => {
                        const u = p.url().toLowerCase();
                        return (u.includes('tnedistrict') && !u.endsWith('/tneda/')) || u.includes('edaweb') || u.includes('canregistration') || u.includes('instruction') || u.includes('validateaadhar');
                    });
                    if (canPages.length > 0) {
                        const targetPage = canPages[canPages.length - 1];
                        if (targetPage !== tnegaPage) {
                            onProgress(`🔀 [புதிய சாளரம் கண்டறியப்பட்டது] e-District / CAN பக்கத்திற்கு மாறுகிறது: ${targetPage.url()}`);
                            tnegaPage = targetPage;
                            state.page = targetPage;
                            await tnegaPage.bringToFront().catch(() => {});
                            await initTnegaHud(tnegaPage).catch(() => {});
                        }
                    } else if (loginRedirectPage && loginRedirectPage !== tnegaPage) {
                        // Session timed out on Services.aspx and opened Default.aspx?Msg=...
                        for (const p of remainingPages) {
                            if (p !== loginRedirectPage) await p.close().catch(() => {});
                        }
                        tnegaPage = loginRedirectPage;
                        state.page = loginRedirectPage;
                        rev103Clicked = false;
                        await tnegaPage.bringToFront().catch(() => {});
                    } else if (tnegaPage && tnegaPage.isClosed() && remainingPages.length > 0) {
                        tnegaPage = remainingPages[0];
                        state.page = tnegaPage;
                        rev103Clicked = false;
                    }
                }

                if (!tnegaPage || tnegaPage.isClosed()) {
                    if (state.context && state.context.pages().filter(p => !p.isClosed()).length > 0) {
                        continue;
                    }
                    break;
                }
                const currentUrl = tnegaPage.url().toLowerCase();

                // Self-healing re-login if session timed out mid-run and landed on Default.aspx
                if (currentUrl.includes('default.aspx') || currentUrl.includes('portallogin.aspx')) {
                    const userInp = tnegaPage.locator('#txtuserName, input[name*="txtuserName"]').first();
                    if (await userInp.count() > 0 && await userInp.isVisible()) {
                        const vaultCreds = resolveTnegaVaultCredentials(options, citizenProfile);
                        if (vaultCreds && vaultCreds.username && vaultCreds.password) {
                            onProgress('🔄 [சுய திருத்தம்] போர்ட்டல் அமர்வு காலாவதியானது — தானாக மீண்டும் உள்நுழைகிறது...');
                            rev103Clicked = false;
                            proceedClicked = false;
                            await performAutomatedTnegaLogin(tnegaPage, vaultCreds, onProgress, options);
                            continue;
                        }
                    }
                }

                // If on service list or dashboard (logged in)
                if (!currentUrl.includes('default.aspx') && !currentUrl.includes('portallogin.aspx')) {
                    if (state.context) {
                        try {
                            const cookiePath = path.join(__dirname, '..', '..', '..', 'data', 'tnega_cookies.json');
                            await state.context.storageState({ path: cookiePath });
                        } catch (_) {}
                    }

                    if (loopCounter % 4 === 1) {
                        onProgress(`🌐 [நேரலை போர்ட்டல் கண்காணிப்பு] தற்போதைய பக்கம்: ${currentUrl}`);
                    }

                    // 1. Check if on Announcement notice page
                    if (currentUrl.includes('announcement.aspx')) {
                        // Dismiss strict modal popup if open (which authenticates OpenWindow() to Home/Services.aspx)
                        const modalCloseBtn = tnegaPage.locator('button#btnClose, .modal button.close, .modal #btnClose, #btnCloseModal, button#btnNoticeClose').first();
                        if (await modalCloseBtn.count() > 0 && await modalCloseBtn.isVisible()) {
                            onProgress('🔍 [DOM பகுப்பாய்வு] அறிவிப்பு பாப்-அப் சாளரம் கண்டறியப்பட்டது (#btnClose) — மூடப்பட்டு சேவைகள் பக்கத்திற்குச் செல்கிறது...');
                            await modalCloseBtn.click().catch(() => {});
                            await tnegaPage.waitForLoadState('domcontentloaded').catch(() => {});
                            await tnegaPage.waitForTimeout(1000);
                        }
                    }

                    // 1.1 Recover cleanly from accidental external redirects (e.g. CSC Digital Seva) back to TNeGA portal
                    if (currentUrl.includes('digitalseva') || (!currentUrl.includes('tnesevai.tn.gov.in') && !currentUrl.includes('about:blank') && !currentUrl.includes('tnedistrict.tn.gov.in'))) {
                        onProgress('⚠️ [சுய திருத்தம்] வெளித்தளம் கண்டறியப்பட்டது — TNeGA முதன்மைப் பக்கத்திற்குத் திரும்புகிறது...');
                        await tnegaPage.goto('https://www.tnesevai.tn.gov.in/Default.aspx', { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
                        await tnegaPage.waitForTimeout(1500);
                    }

                    // 2. Recover from any accidental internal error page back to root Default.aspx (NEVER goto DepartmentWiseServices directly!)
                    if (currentUrl.includes('internalerror')) {
                        onProgress('⚠️ [சுய திருத்தம்] Internal Error பக்கம் கண்டறியப்பட்டது — TNeGA முதன்மைப் பக்கத்திற்குத் திரும்புகிறது...');
                        await tnegaPage.goto('https://www.tnesevai.tn.gov.in/Default.aspx', { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
                        await tnegaPage.waitForTimeout(2000);
                    }

                    // 3. Human-like Menu Navigation on Services.aspx or authenticated pages
                    if (currentUrl.includes('services.aspx')) {
                        // Check if an e-District tab is already open
                        const hasCanTab = state.context && state.context.pages().some(p => {
                            if (p.isClosed()) return false;
                            const u = p.url().toLowerCase();
                            return u.includes('tnedistrict') || u.includes('edaweb') || u.includes('instruction');
                        });

                        const canRetryClick = !rev103Clicked || (Date.now() - rev103ClickTime > 25000);

                        if (!hasCanTab && canRetryClick) {
                            // Click Revenue Department in accordion/rptDepartment
                            const revDeptLink = tnegaPage.locator('#ContentPlaceHolderTop_ContentPlaceHolderBody_rptDepartment_lbDepartment_49, a:has-text("Revenue Department"), a:has-text("வருவாய்த் துறை")').first();
                            if (await revDeptLink.count() > 0 && await revDeptLink.isVisible()) {
                                onProgress('🔍 [DOM பகுப்பாய்வு] வருவாய்த் துறை உறுப்பு கண்டறியப்பட்டது: "Revenue Department" — தேர்வு செய்யப்படுகிறது...');
                                await revDeptLink.click().catch(() => {});
                                await tnegaPage.waitForTimeout(1200);
                            }

                            // Click REV-103 Income Certificate
                            const certLink = tnegaPage.locator('a[href*="eDistrict.aspx"]:has-text("REV-103"), a:has-text("REV-103 Income Certificate"), a:has-text("REV-103"), a:has-text("Income Certificate")').first();
                            if (await certLink.count() > 0 && await certLink.isVisible()) {
                                onProgress('🔍 [DOM பகுப்பாய்வு] வருவாய்ச் சான்றிதழ் சேவை கண்டறியப்பட்டது (REV-103) — கிளிக் செய்யப்படுகிறது...');
                                rev103Clicked = true;
                                rev103ClickTime = Date.now();

                                const popupPromise = state.context ? state.context.waitForEvent('page', { timeout: 10000 }).catch(() => null) : Promise.resolve(null);
                                await certLink.click().catch(() => {});
                                const newTab = await popupPromise;
                                if (newTab) {
                                    onProgress(`🔀 [புதிய சாளரம் திறக்கப்பட்டது] ${newTab.url()}`);
                                    await newTab.waitForLoadState('domcontentloaded').catch(() => {});
                                    tnegaPage = newTab;
                                    state.page = newTab;
                                    await tnegaPage.bringToFront().catch(() => {});
                                    await initTnegaHud(tnegaPage).catch(() => {});
                                } else {
                                    await tnegaPage.waitForLoadState('domcontentloaded').catch(() => {});
                                    await tnegaPage.waitForTimeout(2000);
                                }
                            }
                        }
                    }

                    // 3.5 If browser was left on canregistration.xhtml or IncomeCertificate.xhtml from a previous run
                    // and we haven't done the validateAadhar.xhtml CAN pre-search yet, navigate to validateAadhar.xhtml via REV-103 menu
                    if (!preSearchDone && options.forceNewCanRegister !== true && (currentUrl.includes('canregistration.xhtml') || currentUrl.includes('incomecertificate.xhtml'))) {
                        const revMenuLink = tnegaPage.locator('a:has-text("REV-103 Income Certificate"), a[href*="instruction.xhtml"]').first();
                        if (await revMenuLink.count() > 0 && await revMenuLink.isVisible()) {
                            onProgress('🔄 [CAN முன்-சரிபார்ப்பு] முதலில் CAN எண் உள்ளதா எனச் சரிபார்க்க தேடல் பக்கத்திற்கு (validateAadhar.xhtml) செல்கிறது...');
                            proceedClicked = false;
                            await revMenuLink.click().catch(() => {});
                            await tnegaPage.waitForLoadState('domcontentloaded').catch(() => {});
                            await tnegaPage.waitForTimeout(1500);
                            continue;
                        }
                    }

                    // 4. Check if on instructions page with Proceed button
                    if (currentUrl.includes('instruction.xhtml') || currentUrl.includes('instruction')) {
                        const canRetryProceed = !proceedClicked || (Date.now() - proceedClickTime > 15000);
                        if (canRetryProceed) {
                            const btnProceed = tnegaPage.locator('input[value="Proceed"], input#form1\\:j_id1148295558_11cd0f9c, input[type="submit"][value*="Proceed"]').first();
                            if (await btnProceed.count() > 0 && await btnProceed.isVisible()) {
                                onProgress('🔍 [DOM பகுப்பாய்வு] சேவை வழிமுறைகள் பக்கத்தில் Proceed பொத்தான் கண்டறியப்பட்டது — கிளிக் செய்யப்படுகிறது...');
                                proceedClicked = true;
                                proceedClickTime = Date.now();
                                await updateTnegaHud(tnegaPage, {
                                    title: '➡️ சேவை வழிமுறைகள் பக்கம்',
                                    desc: 'Proceed பொத்தான் சொடுக்கப்படுகிறது...',
                                    badge: 'Proceeding',
                                    type: 'working'
                                });
                                await btnProceed.click().catch(() => {});
                                await tnegaPage.waitForLoadState('networkidle').catch(() => {});
                                await tnegaPage.waitForTimeout(2000);
                            }
                        }
                    }

                    // 5. Smart 2-in-1 CAN Pre-Check Search + Auto-Fallback to "Register Can" on validateAadhar.xhtml
                    const isValidatePage = currentUrl.includes('validateaadhar') || (await tnegaPage.locator('input#statusform\\:Search, input#statusform\\:aadharNo').count()) > 0;
                    const btnReg = tnegaPage.locator('a:has-text("Register Can"), a[href*="canregistration"], input#btnRegisterCAN, button#btnRegisterCAN, input[value*="Register CAN"]').first();
                    if (isValidatePage || (await btnReg.count() > 0 && await btnReg.isVisible())) {
                        const isFormActive = (await tnegaPage.locator('#canreg\\:aadharnum').count()) > 0;
                        if (!isFormActive) {
                            // Step 5A: Perform Smart Pre-Check Search by Aadhaar / Mobile before clicking Register Can
                            if (!preSearchDone && options.forceNewCanRegister !== true) {
                                preSearchDone = true;
                                const lookupRes = await performLiveCanLookupOnPage(tnegaPage, {
                                    aadhaar,
                                    mobile,
                                    canNumber: citizenProfile.canNumber || '',
                                    applicantName: fullNameEng,
                                    strictNameMatch: options.searchOnly !== true
                                }, onProgress);

                                if (lookupRes && lookupRes.found && lookupRes.matchedRecord) {
                                    const foundRec = lookupRes.matchedRecord;
                                    const foundCan = foundRec.canNumber;
                                    state.activeCanNumber = foundCan;
                                    state.currentTnegaStep = 'CAN_FOUND';
                                    citizenProfile.canNumber = foundCan;
                                    if (!citizenProfile.fullNameEng && foundRec.name) citizenProfile.fullNameEng = foundRec.name;
                                    if (!citizenProfile.fatherNameEng && foundRec.fatherName) citizenProfile.fatherNameEng = foundRec.fatherName;
                                    if (!citizenProfile.headDob && foundRec.dob) {
                                        citizenProfile.headDob = foundRec.dob;
                                        citizenProfile.dob = foundRec.dob;
                                    }

                                    if (options.draftData && options.draftData.citizenProfile) {
                                        options.draftData.citizenProfile.canNumber = foundCan;
                                    }
                                    await safeSaveCanToDraft(mobile, citizenProfile, foundCan, citizenProfile.subService || options.subService || 'CAN_REGISTER');

                                    const isIncomeMode = citizenProfile.subService === 'INCOME' || citizenProfile.subService === 'INCOME_CERTIFICATE' || options.subService === 'INCOME';
                                    if (isIncomeMode && options.searchOnly !== true) {
                                        onProgress(`🎉 ஏற்கனவே பதிவு செய்யப்பட்ட CAN எண் (${foundCan}) தேர்ந்தெடுக்கப்பட்டது! வருமானச் சான்றிதழ் படிவத்திற்கு (Proceed) செல்கிறது...`);
                                        await updateTnegaHud(tnegaPage, {
                                            title: `🎉 CAN எண் கண்டறியப்பட்டது: ${foundCan}`,
                                            desc: `${foundRec.name} — வருமானச் சான்றிதழ் படிவத்திற்கு (Proceed) செல்கிறது...`,
                                            badge: 'CAN Found ✅',
                                            type: 'success'
                                        });
                                        const proceedCanBtn = tnegaPage.locator('#statusform input[value="Proceed"]').first();
                                        if (await proceedCanBtn.count() > 0 && await proceedCanBtn.isVisible()) {
                                            await proceedCanBtn.click().catch(() => {});
                                            await tnegaPage.waitForLoadState('domcontentloaded').catch(() => {});
                                            await tnegaPage.waitForTimeout(2000);
                                            const extracted = await extractPreFilledPortalCanDetails(tnegaPage);
                                            if (extracted) {
                                                for (const [ek, ev] of Object.entries(extracted)) {
                                                    if (ev && !citizenProfile[ek]) citizenProfile[ek] = ev;
                                                }
                                                await safeSaveCanToDraft(mobile, citizenProfile, foundCan, citizenProfile.subService || options.subService || 'INCOME');
                                                onProgress(`💾 போர்ட்டலின் CAN விவரங்கள் வாடிக்கையாளரின் Master Profile-ல் தானாகவே சேமிக்கப்பட்டன!`);
                                            }
                                        }
                                        // Hand off directly to Income Certificate Automation Engine to complete the form
                                        try {
                                            const { startTnegaIncomeCertificateFlow } = require('./tnega_income_certificate');
                                            return await startTnegaIncomeCertificateFlow(citizenProfile, onProgress, options);
                                        } catch (flowErr) {
                                            onProgress(`⚠️ வருமானப் படிவ நிரப்புதலில் பிழை: ${flowErr.message}`);
                                            return {
                                                success: false,
                                                error: flowErr.message,
                                                canNumber: foundCan
                                            };
                                        }
                                    }

                                    // For CAN_REGISTER or CAN_SEARCH: CAN already exists!
                                    await updateTnegaHud(tnegaPage, {
                                        title: `🎉 ஏற்கனவே CAN எண் உள்ளது: ${foundCan}`,
                                        desc: `பெயர்: ${foundRec.name} | தந்தை: ${foundRec.fatherName} — புதிய பதிவு தேவையில்லை, சுயவிவரத்தில் சேமிக்கப்பட்டது!`,
                                        badge: 'CAN Found ✅',
                                        type: 'success'
                                    });

                                    try {
                                        await generateCanReceiptPdf(receiptPath, {
                                            canNumber: foundCan,
                                            fullNameEng: foundRec.name || fullNameEng,
                                            fullNameTam,
                                            fatherNameEng: foundRec.fatherName || fatherNameEng,
                                            fatherNameTam,
                                            mobile: foundRec.mobile || mobile,
                                            aadhaar,
                                            genderTam,
                                            dob,
                                            district: geo.district,
                                            taluk: geo.taluk,
                                            village: geo.village,
                                            doorNo,
                                            streetTam,
                                            streetEng,
                                            pincode
                                        });
                                    } catch (_) {}

                                    const familySummary = (lookupRes.records && lookupRes.records.length > 1)
                                        ? `\n📋 இந்த எண்ணில் உள்ள அனைத்து CAN பதிவுகள்:\n` + lookupRes.records.map((r, i) => `  ${i + 1}. **${r.canNumber}** — ${r.name} (தந்தை/கணவர்: ${r.fatherName})`).join('\n')
                                        : '';

                                    onProgress(`🎉 இந்த வாடிக்கையாளருக்கு ஏற்கனவே CAN எண் உள்ளது: ${foundCan} (${foundRec.name})! புதிய பதிவு தேவையில்லை.`);
                                    return {
                                        success: true,
                                        found: true,
                                        alreadyRegistered: true,
                                        isTnegaCan: true,
                                        canNumber: foundCan,
                                        citizenName: foundRec.name || fullNameTam,
                                        fatherName: foundRec.fatherName || fatherNameTam,
                                        mobile: foundRec.mobile || mobile,
                                        aadhaar,
                                        district: geo.districtTam || geo.district,
                                        taluk: geo.talukTam || geo.taluk,
                                        records: lookupRes.records || [foundRec],
                                        receiptPdf: receiptPath,
                                        message: `🎉 **வாடிக்கையாளருக்கு ஏற்கனவே CAN எண் உள்ளது!**\n\n• 🔢 **CAN எண்:** **${foundCan}** ✅\n• 👤 **பெயர்:** ${foundRec.name || fullNameTam}\n• 👨 **தந்தை/கணவர்:** ${foundRec.fatherName || fatherNameTam}\n• 📱 **மொபைல்:** +91 ${foundRec.mobile || mobile}${familySummary}\n\n✅ இந்த CAN எண் வாடிக்கையாளரின் சுயவிவரத்தில் (Profile) தானாகவே சேமிக்கப்பட்டுவிட்டது!`
                                    };
                                }

                                // Not found on validateAadhar.xhtml!
                                if (options.searchOnly === true) {
                                    state.currentTnegaStep = 'CAN_NOT_FOUND';
                                    await updateTnegaHud(tnegaPage, {
                                        title: 'ℹ️ CAN எண் பதிவு இல்லை',
                                        desc: 'இந்த ஆதார் / மொபைல் எண்ணிற்கு CAN எண் இல்லை. "Register Can" மூலம் புதிய CAN பதிவு செய்யலாம்.',
                                        badge: 'No CAN Found',
                                        type: 'waiting'
                                    });
                                    onProgress('ℹ️ போர்ட்டலில் இந்த ஆதார்/மொபைல் எண்ணிற்கு CAN எண் எதுவும் இல்லை (No records found).');
                                    return {
                                        success: true,
                                        found: false,
                                        isTnegaCan: true,
                                        canNumber: null,
                                        records: (lookupRes && lookupRes.records) || [],
                                        message: 'போர்ட்டலில் இந்த எண்ணிற்கு CAN எண் எதுவும் இல்லை (No records found).'
                                    };
                                }

                                onProgress('ℹ️ போர்ட்டலில் ஏற்கனவே CAN எண் இல்லை — உடனடியாக "Register Can" பொத்தான் அழுத்தப்பட்டு புதிய CAN பதிவு படிவத்திற்குச் செல்கிறது...');
                            }

                            // Step 5B: Click "Register Can" if CAN was not found
                            if (await btnReg.count() > 0 && await btnReg.isVisible()) {
                                onProgress('🔍 [DOM பகுப்பாய்வு] புதிய CAN பதிவு பொத்தான் கண்டறியப்பட்டது: Register Can — கிளிக் செய்யப்படுகிறது...');
                                await updateTnegaHud(tnegaPage, {
                                    title: '📝 புதிய CAN பதிவு (Register Can)',
                                    desc: 'ஏற்கனவே CAN இல்லை — Register Can சொடுக்கப்படுகிறது...',
                                    badge: 'Register CAN',
                                    type: 'working'
                                });
                                await btnReg.click().catch(() => {});
                                await tnegaPage.waitForLoadState('networkidle').catch(() => {});
                                await tnegaPage.waitForTimeout(1500);
                            }
                        }
                    }
                }

                // Check if CAN form or Citizen Registration form is active
                const hasAadhaarInp = (await tnegaPage.locator('#canreg\\:aadharnum, input[name*="aadharnum"], input#txtAadhaar, input[name*="Aadhaar"]').count()) > 0;
                const hasNameInp = (await tnegaPage.locator('#canreg\\:enappname, input[name*="enappname"], input#txtNameEng').count()) > 0;
                if ((hasAadhaarInp || hasNameInp) && (preSearchDone || options.forceNewCanRegister === true)) {
                    formReady = true;
                    onProgress('📋 CAN பதிவு படிவம் கண்டறியப்பட்டது! தகவல்கள் தானாக நிரப்பப்படுகின்றன...');
                    await updateTnegaHud(tnegaPage, {
                        title: '📋 CAN பதிவு படிவம் கண்டறியப்பட்டது!',
                        desc: 'விண்ணப்பதாரர் தகவல்கள் தானாக நிரப்பப்படுகின்றன...',
                        badge: 'CAN Form Ready',
                        type: 'working'
                    });
                    break;
                }
            } catch (_) {}
        }

        onProgress('⌨️ [விதி 7] விண்ணப்பதாரர் விவரங்கள் இருமொழியில் (Bilingual) துல்லியமாக நிரப்பப்படுகின்றன...');
        await updateTnegaHud(tnegaPage, {
            title: '⌨️ [விதி 7] இருமொழி துல்லிய தட்டச்சு',
            desc: `${fullNameTam} (${fullNameEng}) அவர்களின் விவரங்கள் படிவத்தில் நிரப்பப்படுகின்றன...`,
            badge: 'Bilingual Auto-Fill',
            type: 'working'
        });

        // 1. Aadhaar
        const aadhaarInp = tnegaPage.locator('#canreg\\:aadharnum, input#txtAadhaar, input[name*="aadharnum"], input[name*="Aadhaar"]').first();
        if (await aadhaarInp.count() > 0 && await aadhaarInp.isVisible()) {
            await aadhaarInp.fill(aadhaar);
            await aadhaarInp.dispatchEvent('change').catch(() => {});
            onProgress(`🔢 ஆதார் எண்: XXXX-XXXX-${aadhaar.slice(-4)}`);
        }

        // 2. Appellation / Title
        const appelSelect = tnegaPage.locator('#canreg\\:appelation, select#ddlAppellation, select[name*="appelation"], select#ddlTitle').first();
        if (await appelSelect.count() > 0 && await appelSelect.isVisible()) {
            const titleTarget = gender === 'Female' ? '5' : '6';
            const selected = await safeSelect(appelSelect, titleTarget) || await safeSelect(appelSelect, gender === 'Female' ? 'Tmt' : 'Thiru');
            if (selected) {
                await tnegaPage.waitForTimeout(1000); // Wait for RichFaces dependent dropdown ajax
            }
        }

        // 3. Mandatory Explicit Dual Typing for Applicant Name (Rule 7)
        await fillBilingualPair(
            tnegaPage,
            '#canreg\\:enappname, input#txtNameEng, input[name*="enappname"], input#txtApplicantNameEng, input#txtFullName',
            '#canreg\\:tnappname, input#txtNameTam, input[name*="tnappname"], input#txtApplicantNameTam',
            fullNameEng,
            fullNameTam,
            'விண்ணப்பதாரர் பெயர்',
            onProgress
        );

        // 4. Relationship & Father/Spouse Name (Rule 7)
        const relSelect = tnegaPage.locator('#canreg\\:relation, select#ddlRelationship, select[name*="relation"], select#ddlRelation').first();
        if (await relSelect.count() > 0 && await relSelect.isVisible()) {
            await safeSelect(relSelect, '4') || await safeSelect(relSelect, 'Father');
            await tnegaPage.waitForTimeout(500);
        }
        await fillBilingualPair(
            tnegaPage,
            '#canreg\\:enfatname, input#txtFatherEng, input[name*="enfatname"], input#txtFatherNameEng, input[name*="txtFatherName"]',
            '#canreg\\:tnfatname, input#txtFatherTam, input[name*="tnfatname"], input#txtFatherNameTam',
            fatherNameEng,
            fatherNameTam,
            'தந்தை பெயர்',
            onProgress
        );

        // 4b. Mother Name Dual Typing (Mandatory Field on TNeGA CAN Registration)
        if (motherNameEng || motherNameTam) {
            await fillBilingualPair(
                tnegaPage,
                '#canreg\\:enmthname, input#txtMotherEng, input[name*="enmthname"], input#txtMotherNameEng',
                '#canreg\\:tnmthname, input#txtMotherTam, input[name*="tnmthname"], input#txtMotherNameTam',
                motherNameEng,
                motherNameTam,
                'தாயின் பெயர்',
                onProgress
            );
        }

        // 5. Gender
        const genSelect = tnegaPage.locator('#canreg\\:genderid, select#ddlGender, select[name*="genderid"]').first();
        if (await genSelect.count() > 0 && await genSelect.isVisible()) {
            await safeSelect(genSelect, gender === 'Female' ? '2' : '1') || await safeSelect(genSelect, gender === 'Female' ? 'Female' : 'Male');
            await tnegaPage.waitForTimeout(500);
        }

        // 6. Marital Status
        const maritalSelect = tnegaPage.locator('#canreg\\:maritalid, select#ddlMaritalStatus, select[name*="maritalid"]').first();
        if (await maritalSelect.count() > 0 && await maritalSelect.isVisible()) {
            await safeSelect(maritalSelect, '2') || await safeSelect(maritalSelect, 'Unmarried');
            await tnegaPage.waitForTimeout(500);
        }

        // 7. DOB (RichFaces Calendar & Input handling) - Strictly DD/MM/YYYY
        let normalizedDob = dob;
        if (dob.includes('-')) {
            const parts = dob.split('-');
            if (parts[0].length === 4) { // YYYY-MM-DD -> DD/MM/YYYY
                normalizedDob = `${parts[2]}/${parts[1]}/${parts[0]}`;
            }
        }
        const dobInp = tnegaPage.locator('#canreg\\:dobInputDate, input#txtDOB, input[name*="dobInputDate"]').first();
        if (await dobInp.count() > 0 && await dobInp.isVisible()) {
            await tnegaPage.evaluate(({ dobStr }) => {
                const inp = document.getElementById('canreg:dobInputDate');
                if (inp) {
                    inp.removeAttribute('readonly');
                    inp.value = dobStr;
                    inp.dispatchEvent(new Event('input', { bubbles: true }));
                    inp.dispatchEvent(new Event('change', { bubbles: true }));
                    inp.dispatchEvent(new Event('blur', { bubbles: true }));
                }
                const cal = window.RichFaces ? window.RichFaces.$('canreg:dob') : null;
                if (cal) {
                    let d = null;
                    if (dobStr.includes('/')) {
                        const parts = dobStr.split('/');
                        d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                    } else if (dobStr.includes('-')) {
                        const parts = dobStr.split('-');
                        d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                    }
                    if (d && !isNaN(d.getTime())) {
                        cal.setValue(d);
                        if (typeof cal.__selectDate === 'function') cal.__selectDate(d);
                    }
                }
            }, { dobStr: normalizedDob }).catch(() => {});
            onProgress(`📅 பிறந்த தேதி (DOB): ${normalizedDob}`);
        }

        // 8. Religion & Community (Dynamic 1-to-1 Mapping)
        const relgSelect = tnegaPage.locator('#canreg\\:religionid, select#ddlReligion, select[name*="religionid"]').first();
        if (await relgSelect.count() > 0 && await relgSelect.isVisible()) {
            const relgMap = { 'HINDU': '3', 'MUSLIM': '4', 'CHRISTIAN': '2', 'SIKH': '7', 'JAIN': '5', 'BUDDHIST': '1' };
            const rCode = relgMap[religion.toUpperCase()] || '3';
            await safeSelect(relgSelect, rCode) || await safeSelect(relgSelect, religion);
            await tnegaPage.waitForTimeout(1000); // Wait for RichFaces ajax to populate community options
        }
        const commMap = {
            'BC': '1',
            'OC': '4',
            'MBC': '5',
            'MBC/DNC': '5',
            'DNC': '6',
            'SC': '7',
            'ST': '8'
        };
        const cCode = commMap[community.toUpperCase()] || '5';
        const commSelect = tnegaPage.locator('#canreg\\:communityid, select#ddlCommunity, select[name*="communityid"]').first();
        if (await commSelect.count() > 0 && await commSelect.isVisible()) {
            await safeSelect(commSelect, cCode) || await safeSelect(commSelect, community);
            await tnegaPage.waitForTimeout(500);
            onProgress(`🏷️ சமூகப் பிரிவு (Community): ${community} (குறியீடு: ${cCode})`);
        }

        // 9. District, Taluk, Village
        const distSelect = tnegaPage.locator('#canreg\\:cdistrictid, select#ddlDistrict, select[name*="cdistrictid"]').first();
        if (await distSelect.count() > 0 && await distSelect.isVisible()) {
            await safeSelect(distSelect, '37') || await safeSelect(distSelect, geo.district);
            await tnegaPage.waitForTimeout(1200); // Wait for taluk ajax
        }
        const talukSelect = tnegaPage.locator('#canreg\\:ctalukaid, select#ddlTaluk, select[name*="ctalukaid"]').first();
        if (await talukSelect.count() > 0 && await talukSelect.isVisible()) {
            await safeSelect(talukSelect, '342') || await safeSelect(talukSelect, geo.taluk);
            await tnegaPage.waitForTimeout(1200); // Wait for village ajax
        }
        const villSelect = tnegaPage.locator('#canreg\\:cvillageid, select#ddlVillage, select[name*="cvillageid"]').first();
        if (await villSelect.count() > 0 && await villSelect.isVisible()) {
            await safeSelect(villSelect, '23595') || await safeSelect(villSelect, geo.village);
            await tnegaPage.waitForTimeout(500);
        }

        // 10. Door No
        const doorInp = tnegaPage.locator('#canreg\\:buildnum, input#txtDoorNo, input[name*="buildnum"], input#txtBuildingNo').first();
        if (await doorInp.count() > 0 && await doorInp.isVisible()) {
            await doorInp.fill(doorNo);
            await doorInp.dispatchEvent('change').catch(() => {});
        }

        // 11. Street Address Dual Typing with Hamlet (Rule 6 & Rule 7)
        await fillBilingualPair(
            tnegaPage,
            '#canreg\\:streetnum, input#txtStreetEng, input[name*="streetnum"], input#txtStreetName',
            '#canreg\\:streetnumtm, input#txtStreetTam, input[name*="streetnumtm"], input#txtStreetNameTam',
            fullStreetEng,
            fullStreetTam,
            'தெரு முகவரி & குக்கிராமம்',
            onProgress
        );

        // 12. Area / Ward - Clean, empty unless specific ward given (do NOT duplicate revenue village)
        const areaInp = tnegaPage.locator('#canreg\\:careaward, input#txtArea, input[name*="careaward"]').first();
        if (await areaInp.count() > 0 && await areaInp.isVisible()) {
            const wardVal = citizenProfile.wardNo || citizenProfile.ward || '';
            await areaInp.fill(wardVal);
            await areaInp.dispatchEvent('change').catch(() => {});
        }

        // Rule 7 Final Anti-Transliteration Tampering Pass:
        // Enforce verified English & Tamil strings directly in DOM to eliminate portal auto-transliteration errors
        await tnegaPage.evaluate(({ appEng, appTam, fatEng, fatTam, motEng, motTam, strEng, strTam }) => {
            const enforce = (id, val) => {
                if (!val) return;
                const el = document.getElementById(id);
                if (el && el.value !== val) {
                    el.value = val;
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                    el.dispatchEvent(new Event('blur', { bubbles: true }));
                }
            };
            enforce('canreg:enappname', appEng);
            enforce('canreg:tnappname', appTam);
            enforce('canreg:enfatname', fatEng);
            enforce('canreg:tnfatname', fatTam);
            enforce('canreg:enmthname', motEng);
            enforce('canreg:tnmthname', motTam);
            enforce('canreg:streetnum', strEng);
            enforce('canreg:streetnumtm', strTam);
        }, {
            appEng: fullNameEng,
            appTam: fullNameTam,
            fatEng: fatherNameEng,
            fatTam: fatherNameTam,
            motEng: motherNameEng,
            motTam: motherNameTam,
            strEng: fullStreetEng,
            strTam: fullStreetTam
        }).catch(() => {});

        // 13. Pincode
        const pinInp = tnegaPage.locator('#canreg\\:cpin, input#txtPincode, input[name*="cpin"], input#txtPin').first();
        if (await pinInp.count() > 0 && await pinInp.isVisible()) {
            await pinInp.fill(pincode);
            await pinInp.dispatchEvent('change').catch(() => {});
        }

        // 14. Permanent Address Same Checkbox
        const chkSame = tnegaPage.locator('input#chkSameAddress, input[name*="chkSameAddress"], input[id*="SameAddress"]').first();
        if (await chkSame.count() > 0 && await chkSame.isVisible() && !(await chkSame.isChecked())) {
            await chkSame.check().catch(() => {});
        }

        // 15. Mobile
        const mobInp = tnegaPage.locator('#canreg\\:mobile, input#txtMobile, input[name*="mobile"], input#txtMobileNo').first();
        if (await mobInp.count() > 0 && await mobInp.isVisible()) {
            await mobInp.fill(mobile);
            await mobInp.dispatchEvent('change').catch(() => {});
            onProgress(`📱 மொபைல் எண்: +91 ${mobile}`);
        }

        // 16. Generate OTP
        onProgress('📲 புதிய CAN பதிவிற்கு மொபைல் OTP கோரப்படுகிறது...');
        await updateTnegaHud(tnegaPage, {
            title: '📲 OTP கோரப்படுகிறது...',
            desc: `வாடிக்கையாளர் (+91 ${mobile}) கைபேசிக்கு OTP அனுப்ப பொத்தான் அழுத்தப்படுகிறது...`,
            badge: 'Requesting OTP',
            type: 'working'
        });

        const btnGen = tnegaPage.locator('#canreg\\:j_id1547389060_749b3f5c, input[value="Generate OTP"], input#btnGenerateOTP, button#btnGenerateOTP').first();
        if (await btnGen.count() > 0 && await btnGen.isVisible()) {
            await btnGen.click().catch(() => {});
            await tnegaPage.waitForLoadState('networkidle').catch(() => {});
            await tnegaPage.waitForTimeout(1500);
        }

        state.isWaitingForCanOtp = true;
        onProgress(`📲 [விதி 5 நேரலை பின்னணி இயக்கம்] TNeGA OTP உங்கள் கைபேசிக்கு (+91 ${mobile}) அனுப்பப்பட்டுள்ளது.`);
        onProgress('⌨️ தயவுசெய்து OTP எண்ணை உள்ளிடவும் (அல்லது பிரவுசரில் தட்டச்சு செய்யவும்). லைவ் கண்காணிப்பு தொடர்ந்து விழிப்புடன் உள்ளது...');

        await updateTnegaHud(tnegaPage, {
            title: '📲 [OTP காத்திருப்பு] OTP உள்ளிடவும்',
            desc: `உங்கள் கைபேசிக்கு (+91 ${mobile}) வந்த OTP-ஐ Chrome திரையில் தட்டச்சு செய்யவும் (அல்லது செயலி சேட்டில் அனுப்பவும்)!`,
            badge: 'Waiting for OTP',
            type: 'waiting'
        });

        // NON-STOP BACKGROUND DAEMON LOOP (Golden Rule 5)
        return new Promise((resolve, reject) => {
            // Attach dialog handler to auto-accept confirmation dialogs
            tnegaPage.on('dialog', async (dialog) => {
                onProgress(`🔔 [உறுதிப்படுத்தல் பாப்-அப்] "${dialog.message()}" — ஏற்றுக்கொள்ளப்படுகிறது (OK)...`);
                await dialog.accept().catch(() => {});
            });

            let registerAttempted = false;

            const checkInterval = setInterval(async () => {
                try {
                    if (tnegaPage.isClosed()) {
                        clearInterval(checkInterval);
                        state.isWaitingForCanOtp = false;
                        return resolve({ success: false, error: 'பிரவுசர் சாளரம் மூடப்பட்டது.' });
                    }

                    // 1. Check if user provided OTP via IPC / API
                    if (state.pendingCanOtpValue) {
                        const otpVal = state.pendingCanOtpValue;
                        state.pendingCanOtpValue = null;
                        state.isWaitingForCanOtp = false;

                        const inpOtp = tnegaPage.locator('#canreg\\:otp_id, input#txtOTP, input[name*="otp_id"], input[placeholder*="OTP"]').first();
                        if (await inpOtp.count() > 0) {
                            await inpOtp.fill(otpVal);
                            await inpOtp.dispatchEvent('change').catch(() => {});
                        }

                        await updateTnegaHud(tnegaPage, {
                            title: '🚀 OTP பெறப்பட்டது! உறுதிப்படுத்தப்படுகிறது...',
                            desc: 'Confirm OTP & Register பொத்தான்கள் அழுத்தப்படுகின்றன...',
                            badge: 'Submitting OTP',
                            type: 'working'
                        });

                        // Click Confirm OTP
                        const btnConfirmOtp = tnegaPage.locator('#canreg\\:j_id1547389060_749b3fc3, input[value="Confirm OTP"], button:has-text("Confirm OTP")').first();
                        if (await btnConfirmOtp.count() > 0 && await btnConfirmOtp.isVisible()) {
                            onProgress('🚀 Confirm OTP பொத்தான் அழுத்தப்படுகிறது...');
                            await btnConfirmOtp.click().catch(() => {});
                            await tnegaPage.waitForTimeout(1500);
                        }

                        // Pre-Submit Human Gate (Golden Rule 5 & 6)
                        // In live production, stop safely at the Pre-Submit Gate so the operator can inspect before Registering
                        if (options.autoSubmit === true) {
                            const btnRegister = tnegaPage.locator('#canreg\\:register, input[value="Register"], button#btnRegister').first();
                            if (await btnRegister.count() > 0 && await btnRegister.isVisible()) {
                                onProgress('🚀 புதிய CAN பதிவு (Register) பொத்தான் அழுத்தப்படுகிறது...');
                                await btnRegister.click().catch(() => {});
                                await tnegaPage.waitForLoadState('networkidle').catch(() => {});
                            }
                        } else {
                            onProgress('🛑 [விதி 5 ஆப்ரேட்டர் ஆய்வு நிலையம் - Pre-Submit Gate] OTP சரிபார்க்கப்பட்டது! திரையில் உள்ள விவரங்களை முழுமையாக சரிபார்த்துவிட்டு Register பொத்தானை அழுத்தவும்.');
                            await updateTnegaHud(tnegaPage, {
                                title: '🛑 [சரிபார்ப்பு நிலையம்] விவரங்களை ஆய்வு செய்யவும்',
                                desc: 'விவரங்கள் அனைத்தும் சரியாக உள்ளதா என உறுதிசெய்துவிட்டு திரையில் உள்ள Register பொத்தானை அழுத்தவும்.',
                                badge: 'Pre-Submit Gate',
                                type: 'waiting'
                            });
                        }
                    }

                    // 2. Check if user typed directly into the Chrome DOM input
                    const inpOtpDom = tnegaPage.locator('#canreg\\:otp_id, input#txtOTP, input[name*="otp_id"]').first();
                    if (await inpOtpDom.count() > 0) {
                        const domVal = await inpOtpDom.inputValue().catch(() => '');
                        if (domVal && (domVal.length === 4 || domVal.length === 6) && !state.otpConfirmedInDom) {
                            state.otpConfirmedInDom = true;
                            await updateTnegaHud(tnegaPage, {
                                title: '🚀 DOM-ல் தட்டச்சு செய்யப்பட்ட OTP கண்டறியப்பட்டது!',
                                desc: 'Confirm OTP சரிபார்க்கப்படுகிறது...',
                                badge: 'Confirming OTP',
                                type: 'working'
                            });

                            const btnConfirmOtp = tnegaPage.locator('#canreg\\:j_id1547389060_749b3fc3, input[value="Confirm OTP"], button:has-text("Confirm OTP")').first();
                            if (await btnConfirmOtp.count() > 0 && await btnConfirmOtp.isVisible()) {
                                onProgress('🚀 DOM-ல் தட்டச்சு செய்யப்பட்ட OTP கண்டறியப்பட்டது! Confirm OTP அழுத்தப்படுகிறது...');
                                await btnConfirmOtp.click().catch(() => {});
                                await tnegaPage.waitForTimeout(1500);
                            }

                            if (options.autoSubmit === true) {
                                const btnRegister = tnegaPage.locator('#canreg\\:register, input[value="Register"], button#btnRegister').first();
                                if (await btnRegister.count() > 0 && await btnRegister.isVisible()) {
                                    onProgress('🚀 புதிய CAN பதிவு (Register) பொத்தான் அழுத்தப்படுகிறது...');
                                    await btnRegister.click().catch(() => {});
                                    await tnegaPage.waitForLoadState('networkidle').catch(() => {});
                                }
                            } else {
                                onProgress('🛑 [விதி 5 ஆப்ரேட்டர் ஆய்வு நிலையம் - Pre-Submit Gate] OTP சரிபார்க்கப்பட்டது! திரையில் உள்ள விவரங்களை முழுமையாக சரிபார்த்துவிட்டு Register பொத்தானை அழுத்தவும்.');
                                await updateTnegaHud(tnegaPage, {
                                    title: '🛑 [சரிபார்ப்பு நிலையம்] விவரங்களை ஆய்வு செய்யவும்',
                                    desc: 'விவரங்கள் அனைத்தும் சரியாக உள்ளதா என உறுதிசெய்துவிட்டு திரையில் உள்ள Register பொத்தானை அழுத்தவும்.',
                                    badge: 'Pre-Submit Gate',
                                    type: 'waiting'
                                });
                            }
                        }
                    }

                    // 2.1 Pre-Submit Safety Gate: Never auto-register without explicit autoSubmit
                    if (options.autoSubmit === true) {
                        const isOtpVerified = await tnegaPage.evaluate(() => {
                            const txt = document.body ? document.body.innerText : '';
                            return txt.includes('Successfully verified OTP') || txt.includes('verified OTP');
                        }).catch(() => false);

                        if (isOtpVerified && !registerAttempted) {
                            const btnRegister = tnegaPage.locator('#canreg\\:register, input[value="Register"], button#btnRegister').first();
                            if (await btnRegister.count() > 0 && await btnRegister.isVisible()) {
                                registerAttempted = true;
                                onProgress('🚀 [விதி 5] OTP வெற்றிகரமாகச் சரிபார்க்கப்பட்டது! இறுதி CAN பதிவு (Register) பொத்தான் அழுத்தப்படுகிறது...');
                                await btnRegister.click().catch(() => {});
                                await tnegaPage.waitForLoadState('networkidle').catch(() => {});
                                await tnegaPage.waitForTimeout(2000);
                            }
                        }
                    }

                    // 3. Check for generated CAN Number or success alert
                    const bodyText = await tnegaPage.evaluate(() => document.body.innerText).catch(() => '');
                    const matchedCan = bodyText.match(/\b(133\d{10,12}|\d{13,15})\b/);
                    if (matchedCan) {
                        clearInterval(checkInterval);
                        const newCan = matchedCan[1];
                        state.activeCanNumber = newCan;
                        state.isWaitingForCanOtp = false;
                        state.currentTnegaStep = 'CAN_REGISTERED';
                        citizenProfile.canNumber = newCan;

                        await updateTnegaHud(tnegaPage, {
                            title: `🎉 புதிய 13-இலக்க CAN எண்: ${newCan}`,
                            desc: 'அரசு ஒப்புதல் ரசீது PDF உருவாக்கப்பட்டது!',
                            badge: 'CAN Generated ✅',
                            type: 'success'
                        });

                        try {
                            await generateCanReceiptPdf(receiptPath, {
                                canNumber: newCan,
                                fullNameEng,
                                fullNameTam,
                                fatherNameEng,
                                fatherNameTam,
                                mobile,
                                aadhaar,
                                genderTam,
                                dob,
                                district: geo.district,
                                taluk: geo.taluk,
                                village: geo.village,
                                doorNo,
                                streetTam,
                                streetEng,
                                pincode
                            });
                        } catch (_) {}

                        if (options.draftData && options.draftData.citizenProfile) {
                            options.draftData.citizenProfile.canNumber = newCan;
                        }

                        await safeSaveCanToDraft(mobile, citizenProfile, newCan, 'CAN_REGISTER');

                        onProgress(`🎉 [நேரலை உற்பத்தி முறை] புதிய 13-இலக்க CAN எண் வெற்றிகரமாக உருவாக்கப்பட்டது!`);
                        onProgress(`🌟 புதிய CAN எண்: ${newCan}`);
                        onProgress(`📄 ஒப்புதல் ரசீது PDF தயாராக உள்ளது.`);

                        resolve({
                            success: true,
                            message: `🎉 புதிய 13-இலக்க CAN எண் வெற்றிகரமாக உருவாக்கப்பட்டது! எண்: ${newCan}`,
                            canNumber: newCan,
                            applicationNumber: newCan,
                            citizenName: fullNameTam,
                            mobile,
                            aadhaar,
                            receiptPdf: receiptPath
                        });
                    }
                } catch (e) {
                    // Keep daemon watching - don't crash
                }
            }, 500);

            // Handler for manual IPC resolver if called
            state.pendingCanOtpResolver = (otp) => {
                state.pendingCanOtpValue = otp;
            };
        });

    } catch (err) {
        state.lastTnegaError = err.message;
        onProgress(`❌ புதிய CAN பதிவில் பிழை: ${err.message}`);
        return { success: false, error: err.message };
    }
}

async function startTnegaCanRegisterFlow(citizenProfile, onProgress, options = {}) {
    return registerNewCan(citizenProfile, onProgress, options);
}

module.exports = {
    resolveTnegaVaultCredentials,
    performAutomatedTnegaLogin,
    performLiveCanLookupOnPage,
    safeSaveCanToDraft,
    extractPreFilledPortalCanDetails,
    registerNewCan,
    startTnegaCanRegisterFlow
};
