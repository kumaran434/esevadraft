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
 * Accurately detects whether the citizen/draft goal is any of the 7 TNeGA Revenue Department Certificates.
 * Strictly checks explicit service hints FIRST (Rule 6 & Rule 11) before any profile-field heuristics.
 */
function detectTargetGoal(citizenProfile = {}, options = {}) {
    const candidates = [
        options.targetService,
        options.subService,
        options.serviceId,
        options.draftData?.targetService,
        options.draftData?.subService,
        options.draftData?.serviceId,
        options.draftData?.service,
        options.draftData?.citizenProfile?.targetService,
        options.draftData?.citizenProfile?.subService,
        citizenProfile.targetService,
        citizenProfile.subService,
        citizenProfile.serviceId,
        citizenProfile.service,
        citizenProfile.parentService,
        options.parentService
    ].filter(Boolean).map(v => String(v).toUpperCase());

    const combinedExplicit = candidates.join(' | ');
    const intakeState = String(citizenProfile.intakeState || options.draftData?.intakeState || options.intakeState || '').toUpperCase();
    const explicitStr = `${combinedExplicit} | ${intakeState}`;

    const isWidowGoal = /WIDOW|REV-109|விதவை/.test(explicitStr);
    const isLegalHeirGoal = !isWidowGoal && /LEGAL_HEIR|LEGAL HEIR|REV-114|வாரிசு/.test(explicitStr);
    const isObcGoal = !isWidowGoal && !isLegalHeirGoal && /\bOBC\b|OBC_|REV-115|OTHER BACKWARD/.test(explicitStr);
    const isFirstGraduateGoal = !isWidowGoal && !isLegalHeirGoal && !isObcGoal && /FIRST_GRADUATE|FIRST GRADUATE|REV-104|முதல் பட்டதாரி/.test(explicitStr);
    const isIncomeGoalExplicit = !isWidowGoal && !isLegalHeirGoal && !isObcGoal && !isFirstGraduateGoal && /INCOME|REV-103|வருமான/.test(explicitStr);
    const isResidenceGoalExplicit = !isWidowGoal && !isLegalHeirGoal && !isObcGoal && !isFirstGraduateGoal && !isIncomeGoalExplicit && /RESIDENCE|NATIVITY|REV-102|இருப்பிட/.test(explicitStr);
    const isCommunityGoalExplicit = !isWidowGoal && !isLegalHeirGoal && !isObcGoal && !isFirstGraduateGoal && !isIncomeGoalExplicit && !isResidenceGoalExplicit && /COMMUNITY|REV-101|சாதி/.test(explicitStr);

    const anyExplicitCert = isWidowGoal || isLegalHeirGoal || isObcGoal || isFirstGraduateGoal || isIncomeGoalExplicit || isResidenceGoalExplicit || isCommunityGoalExplicit;
    const isExplicitCanOnly = !anyExplicitCert && /\bCAN_REGISTER\b|\bCAN_SEARCH\b/.test(explicitStr);

    // Fallback field heuristics ONLY when no explicit certificate/CAN-only goal was declared
    const isCommunityGoal = isCommunityGoalExplicit || (!anyExplicitCert && !isExplicitCanOnly && Boolean(citizenProfile.caste || citizenProfile.community || options.draftData?.citizenProfile?.caste || options.draftData?.caste));
    const isResidenceGoal = isResidenceGoalExplicit || (!anyExplicitCert && !isExplicitCanOnly && !isCommunityGoal && Boolean(citizenProfile.yearsOfResidence || options.draftData?.citizenProfile?.yearsOfResidence));
    const isIncomeGoal = isIncomeGoalExplicit || (!anyExplicitCert && !isExplicitCanOnly && !isCommunityGoal && !isResidenceGoal && Boolean(citizenProfile.annualIncome || options.draftData?.citizenProfile?.annualIncome));

    const hasCertificateGoal = (isWidowGoal || isLegalHeirGoal || isObcGoal || isFirstGraduateGoal || isCommunityGoal || isResidenceGoal || isIncomeGoal) && options.searchOnly !== true;
    const resolvedTarget = isWidowGoal ? 'WIDOW'
        : (isLegalHeirGoal ? 'LEGAL_HEIR'
        : (isObcGoal ? 'OBC'
        : (isFirstGraduateGoal ? 'FIRST_GRADUATE'
        : (isCommunityGoal ? 'COMMUNITY'
        : (isResidenceGoal ? 'RESIDENCE'
        : (isIncomeGoal ? 'INCOME'
        : (explicitStr.includes('CAN_SEARCH') ? 'CAN_SEARCH' : 'CAN_REGISTER')))))));

    return {
        isWidowGoal,
        isLegalHeirGoal,
        isObcGoal,
        isFirstGraduateGoal,
        isCommunityGoal,
        isResidenceGoal,
        isIncomeGoal,
        hasCertificateGoal,
        targetUpper: resolvedTarget
    };
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
 * Dedicated Location Dropdown Selector for District, Taluk & Village (Golden Rule 9 & 14)
 * Matches applicant's real candidates (English, Tamil, normalized) against actual dropdown options.
 * Never defaults to hardcoded fallback IDs.
 */
async function safeSelectLocation(locator, candidates = []) {
    if ((await locator.count()) === 0) return false;
    const validCandidates = (Array.isArray(candidates) ? candidates : [candidates])
        .filter(Boolean)
        .map(c => String(c).trim());
    if (validCandidates.length === 0) return false;

    try {
        const options = await locator.locator('option').all();
        // Pass 1: Exact or Substring match on option text (Case-insensitive)
        for (const candidate of validCandidates) {
            const candLower = candidate.toLowerCase();
            for (const opt of options) {
                const txt = (await opt.innerText()).trim();
                const val = (await opt.getAttribute('value')) || '';
                if (!val || val === '0' || val === '-1' || txt.includes('தேர்ந்தெடு') || txt.toLowerCase().includes('select')) continue;
                
                const txtLower = txt.toLowerCase();
                if (txtLower === candLower || txtLower.includes(candLower) || candLower.includes(txtLower)) {
                    await locator.selectOption(val);
                    await locator.dispatchEvent('input').catch(() => {});
                    await locator.dispatchEvent('change').catch(() => {});
                    return { success: true, selectedValue: val, selectedText: txt };
                }
            }
        }

        // Pass 2: Cleaned alphanumeric + Tamil unicode match (strips dots, spaces, parenthetical codes like "37 - Ranipet")
        for (const candidate of validCandidates) {
            const cleanCand = candidate.toLowerCase().replace(/[^a-z0-9\u0B80-\u0BFF]/g, '');
            if (cleanCand.length < 3) continue;
            for (const opt of options) {
                const txt = (await opt.innerText()).trim();
                const val = (await opt.getAttribute('value')) || '';
                if (!val || val === '0' || val === '-1' || txt.includes('தேர்ந்தெடு') || txt.toLowerCase().includes('select')) continue;
                
                const cleanTxt = txt.toLowerCase().replace(/[^a-z0-9\u0B80-\u0BFF]/g, '');
                if (cleanTxt.includes(cleanCand) || cleanCand.includes(cleanTxt)) {
                    await locator.selectOption(val);
                    await locator.dispatchEvent('input').catch(() => {});
                    await locator.dispatchEvent('change').catch(() => {});
                    return { success: true, selectedValue: val, selectedText: txt };
                }
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
        let vaultSvc = null;
        try {
            vaultSvc = require('../../services/portal_vault_service');
        } catch (_) {}

        const inlineCreds = options?.tnegaVaultCredentials ||
                            citizenProfile?.tnegaVaultCredentials ||
                            options?.draftData?.tnegaVaultCredentials ||
                            options?.draftData?.citizenProfile?.tnegaVaultCredentials;
        if (inlineCreds && inlineCreds.username && inlineCreds.password) {
            return {
                username: String(inlineCreds.username).trim(),
                password: String(inlineCreds.password).trim(),
                operatorCode: String(inlineCreds.operatorCode || 'OM').trim()
            };
        }

        if (vaultSvc && typeof vaultSvc.getOperatorPortalCredentials === 'function') {
            const { getOperatorPortalCredentials, getActiveLocalDesktopOperatorUid, isGenericOperatorIdentity } = vaultSvc;
            // GOLDEN RULE 18: Strict Multi-Tenant Operator Isolation
            // NEVER include 'admin' or citizen mobile as operator candidates!
            const isGeneric = (id) => isGenericOperatorIdentity ? isGenericOperatorIdentity(id) : (!id || ['admin', 'default_operator', 'local_op_dev', 'operator'].includes(id));

            const candidates = [
                options?.operatorUid,
                options?.draftData?.operatorUid,
                citizenProfile?.operatorUid,
                options?.draftData?.citizenProfile?.operatorUid
            ].filter(cand => cand && !isGeneric(cand));

            // If no explicit operatorUid provided in options, check active local desktop session
            if (candidates.length === 0 && typeof getActiveLocalDesktopOperatorUid === 'function') {
                const activeSessUid = getActiveLocalDesktopOperatorUid();
                if (activeSessUid && !isGeneric(activeSessUid)) {
                    candidates.push(activeSessUid);
                }
            }

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
        }
    } catch (_) {}
    return null;
}

/**
 * Automated Operator Login & Captcha Solver with Immortal Live HUD & Operator Co-Pilot
 */
async function performAutomatedTnegaLogin(page, vaultCreds, onProgress, options = {}) {
    if (!vaultCreds || !vaultCreds.username || !vaultCreds.password) {
        onProgress('⚠️ [அரசு பெட்டகம்] சேமிக்கப்பட்ட லாகின் விவரங்கள் இல்லை. நீங்களே உள்நுழையவும்.');
        await initTnegaHud(page).catch(() => {});
        await updateTnegaHud(page, {
            title: '🔐 TNeGA ஆப்ரேட்டர் உள்நுழைவு',
            desc: '⚠️ உங்கள் லாகின் பெட்டகத்தில் விவரங்கள் இல்லை. நீங்களே பயனர் பெயர் & கடவுச்சொல்லை உள்ளிட்டு நுழையவும் ⌨️',
            badge: 'Manual Login',
            type: 'attention'
        });
        return false;
    }

    onProgress(`🔐 [அரசு பெட்டகம்] சேமிக்கப்பட்ட TNeGA ஆப்ரேட்டர் லாகின் (${vaultCreds.username}) தொடங்குகிறது...`);
    await initTnegaHud(page).catch(() => {});
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

    const isStillLoginUrl = (u) => {
        if (!u) return true;
        const lower = u.toLowerCase();
        return lower.includes('default.aspx') || lower.includes('portallogin.aspx') || /^https?:\/\/(www\.)?tnesevai\.tn\.gov\.in\/?(\?.*)?$/.test(lower);
    };

    // Ensure login input fields are rendered before starting attempt loop
    const userInp = page.locator('#txtuserName, input[name*="txtuserName"]').first();
    const passInp = page.locator('#txtpassword, input[name*="txtpassword"], input[type="password"]').first();
    const ddlOp = page.locator('#ContentPlaceHolderTop_OuterContentPlaceHolderBody_ddloperator, select[name*="ddloperator"]').first();

    if (!(await userInp.isVisible().catch(() => false))) {
        const franchiseeBtn = page.locator('a:has-text("Franchisee Login"), #btnFranchiseeLogin, a[href*="Franchisee"]').first();
        if (await franchiseeBtn.count().catch(() => 0) > 0 && await franchiseeBtn.isVisible().catch(() => false)) {
            await franchiseeBtn.click().catch(() => {});
            await page.waitForTimeout(600);
        }
    }
    await userInp.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});

    // Check if an orphaned session exists and close it (TNeGA 1-session lock rule)
    const btnCloseSession = page.locator('#ContentPlaceHolderTop_OuterContentPlaceHolderBody_btnCloseSession, input[value="Close Logged Session"]').first();
    if (await btnCloseSession.count().catch(() => 0) > 0 && await btnCloseSession.isVisible().catch(() => false)) {
        onProgress('🔄 [அமர்வு மீட்டமைப்பு] முந்தைய திறந்த அமர்வு கண்டறியப்பட்டது — Close Logged Session அழுத்தப்படுகிறது...');
        await btnCloseSession.click().catch(() => {});
        await page.waitForLoadState('domcontentloaded').catch(() => {});
        await page.waitForTimeout(1500);
    }

    // Captcha Solve & Login Retry Loop (Golden Rule 5 & 13 Operator Co-Pilot: up to 10 attempts, non-stop)
    let loginSuccess = false;
    for (let attempt = 1; attempt <= 10; attempt++) {
        try {
            if (page.isClosed()) break;
            const currentUrl = page.url() ? page.url().toLowerCase() : '';
            const hasLoginInput = (await userInp.count().catch(() => 0) > 0) && (await userInp.isVisible().catch(() => false));
            if (!isStillLoginUrl(currentUrl) && !hasLoginInput) {
                loginSuccess = true;
                break;
            }

            // 1. Golden Rule 8: Close any disclaimer / maintenance popup modal
            const closeDisclaimerBtn = page.locator('button:has-text("Close"), input[value*="Close"], a:has-text("Close"), button:has-text("Proceed"), input[value*="Proceed"], button:has-text("OK"), input[value="OK"], .modal-footer button, #btnClose, .close, div.modal:has-text("maintenance") button').first();
            if (await closeDisclaimerBtn.count().catch(() => 0) > 0 && await closeDisclaimerBtn.isVisible().catch(() => false)) {
                onProgress('ℹ️ [விதி 8] தகவல் அறிவிப்பு பாப்-அப் கண்டறியப்பட்டது — Close பொத்தான் அழுத்தப்படுகிறது...');
                await closeDisclaimerBtn.click().catch(() => {});
                await page.waitForTimeout(500);
            }

            // 2. Mandatory Explicit Re-filling & Invariant Check (ASP.NET postback / F5 reload wipes password!)
            await page.evaluate(({ u, p, op }) => {
                const userEl = document.querySelector('#txtuserName, input[name*="txtuserName"]');
                const passEl = document.querySelector('#txtpassword, input[name*="txtpassword"], input[type="password"]');
                const opEl = document.querySelector('#ContentPlaceHolderTop_OuterContentPlaceHolderBody_ddloperator, select[name*="ddloperator"]');

                if (userEl && (!userEl.value || userEl.value.trim() !== u)) {
                    userEl.value = u;
                    userEl.dispatchEvent(new Event('input', { bubbles: true }));
                    userEl.dispatchEvent(new Event('change', { bubbles: true }));
                }
                if (passEl && (!passEl.value || passEl.value.trim() !== p)) {
                    passEl.value = p;
                    passEl.dispatchEvent(new Event('input', { bubbles: true }));
                    passEl.dispatchEvent(new Event('change', { bubbles: true }));
                }
                if (opEl && op && (!opEl.value || opEl.value !== op)) {
                    for (let i = 0; i < opEl.options.length; i++) {
                        if (opEl.options[i].value === op || opEl.options[i].text.includes(op)) {
                            opEl.selectedIndex = i;
                            opEl.dispatchEvent(new Event('change', { bubbles: true }));
                            break;
                        }
                    }
                }
            }, { u: vaultCreds.username, p: vaultCreds.password, op: vaultCreds.operatorCode || 'OM' }).catch(() => {});

            const captchaImg = page.locator('img[src*="CaptchaImage"], img[src*="Captcha"], #imgCaptcha').first();
            const captchaInp = page.locator('#txtCaptcha, input[name*="txtCaptcha"]').first();

            await captchaImg.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
            if (await captchaImg.count().catch(() => 0) === 0 || !(await captchaImg.isVisible().catch(() => false))) {
                await page.waitForTimeout(800);
                continue;
            }

            // Ensure captcha image is fully rendered and downloaded with valid dimensions
            await captchaImg.evaluate((img) => img.complete && img.naturalWidth > 0).catch(() => false);

            // Update HUD to show active captcha analysis with Co-Pilot notification
            await updateTnegaHud(page, {
                title: `⚡ AI கேப்ட்சா பகுப்பாய்வு (முயற்சி ${attempt}/10)`,
                desc: 'குறியீடு ஆய்வு செய்யப்படுகிறது... (நீங்களே உள்ளிட்டாலும் தொடரும் ⌨️)',
                badge: 'AI Captcha ⚡',
                type: 'working'
            });

            onProgress(`⚡ [AI Captcha OCR] கேப்ட்சா படம் ஆய்வு செய்யப்படுகிறது (முயற்சி ${attempt}/10)... (நீங்களே நேரடியாக உள்ளிட்டாலும் தொடரும் ⌨️)`);

            // Extract Captcha image via canvas
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
                await page.waitForTimeout(500);
                continue;
            }

            // =========================================================================
            // OPERATOR CO-PILOT: Race AI OCR against Operator Manual Input
            // =========================================================================
            const aiSolvePromise = AiCaptchaSolver.solve(captchaBuf, {
                ...options,
                isTnega: true,
                portal: 'tnega',
                captchaLen: 5
            }).catch(() => null);

            let watcherActive = true;
            const operatorWatcherPromise = (async () => {
                const startWait = Date.now();
                while (Date.now() - startWait < 12000 && watcherActive) {
                    if (page.isClosed()) return null;

                    const u = page.url() ? page.url().toLowerCase() : '';
                    if (!isStillLoginUrl(u)) {
                        return { source: 'navigated', code: '__NAVIGATED__' };
                    }

                    // Check if operator typed captcha in #txtCaptcha
                    const userVal = await page.evaluate(() => {
                        const inp = document.querySelector('#txtCaptcha, input[name*="txtCaptcha"]');
                        return inp ? inp.value.trim() : '';
                    }).catch(() => '');

                    if (userVal && userVal.length >= 4) {
                        return { source: 'operator', code: userVal };
                    }

                    // Auto-repair empty password field continuously (protects against ASP.NET postback wiping)
                    await page.evaluate(({ p }) => {
                        const passEl = document.querySelector('#txtpassword, input[name*="txtpassword"], input[type="password"]');
                        if (passEl && !passEl.value.trim()) {
                            passEl.value = p;
                            passEl.dispatchEvent(new Event('input', { bubbles: true }));
                            passEl.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    }, { p: vaultCreds.password }).catch(() => {});

                    await new Promise(r => setTimeout(r, 200));
                }
                return null;
            })();

            const raceWinner = await Promise.race([
                aiSolvePromise.then(code => ({ source: 'ai', code })),
                operatorWatcherPromise
            ]);
            watcherActive = false;

            if (raceWinner && raceWinner.source === 'navigated') {
                loginSuccess = true;
                break;
            }

            let finalCaptchaCode = '';
            if (raceWinner && raceWinner.source === 'operator' && raceWinner.code) {
                finalCaptchaCode = raceWinner.code;
                onProgress(`⌨️ [ஆப்ரேட்டர் நேரடி உள்ளீடு] கேப்ட்சா குறியீடு மனிதரால் உள்ளிட்டது கண்டறியப்பட்டது: "${finalCaptchaCode}" ✅`);
                await updateTnegaHud(page, {
                    title: '⌨️ கேப்ட்சா பெறப்பட்டது',
                    desc: `ஆப்ரேட்டர் குறியீடு ஏற்கப்பட்டது: ${finalCaptchaCode}`,
                    badge: 'Manual Code',
                    type: 'working'
                });
            } else {
                // Check if user typed while AI was solving
                const userManualEntry = await page.evaluate(() => {
                    const inp = document.querySelector('#txtCaptcha, input[name*="txtCaptcha"]');
                    return inp ? inp.value.trim() : '';
                }).catch(() => '');

                if (userManualEntry && userManualEntry.length >= 4) {
                    finalCaptchaCode = userManualEntry;
                    onProgress(`⌨️ [ஆப்ரேட்டர் நேரடி உள்ளீடு] குறியீடு ஏற்கப்பட்டது: "${finalCaptchaCode}" ✅`);
                } else if (raceWinner && raceWinner.source === 'ai' && raceWinner.code && raceWinner.code.length >= 4) {
                    finalCaptchaCode = raceWinner.code;
                    onProgress(`⚡ [AI Captcha OCR] குறியீடு பெறப்பட்டது: ${finalCaptchaCode} ✅`);
                    // Fill into input field
                    await page.evaluate((c) => {
                        const inp = document.querySelector('#txtCaptcha, input[name*="txtCaptcha"]');
                        if (inp) {
                            inp.value = c;
                            inp.dispatchEvent(new Event('input', { bubbles: true }));
                            inp.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    }, finalCaptchaCode).catch(() => {});
                }
            }

            if (!finalCaptchaCode || finalCaptchaCode.length < 4) {
                onProgress(`⚠️ [AI Captcha] முயற்சி ${attempt}: குறியீடு தெளிவாகப் பெறப்படவில்லை, மீண்டும் முயற்சிக்கிறது...`);
                const refreshBtn = page.locator('a[id*="Captcha"], img[src*="refresh"], a:has-text("Refresh")').first();
                if (await refreshBtn.count().catch(() => 0) > 0) {
                    await refreshBtn.click().catch(() => {});
                }
                await page.waitForTimeout(500);
                continue;
            }

            // =========================================================================
            // PRE-SUBMIT INTEGRITY CHECK: Re-verify Username & Password Are Never Empty!
            // =========================================================================
            await page.evaluate(({ u, p }) => {
                const userEl = document.querySelector('#txtuserName, input[name*="txtuserName"]');
                const passEl = document.querySelector('#txtpassword, input[name*="txtpassword"], input[type="password"]');
                if (userEl && (!userEl.value || userEl.value.trim() !== u)) {
                    userEl.value = u;
                    userEl.dispatchEvent(new Event('input', { bubbles: true }));
                    userEl.dispatchEvent(new Event('change', { bubbles: true }));
                }
                if (passEl && (!passEl.value || passEl.value.trim() !== p)) {
                    passEl.value = p;
                    passEl.dispatchEvent(new Event('input', { bubbles: true }));
                    passEl.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }, { u: vaultCreds.username, p: vaultCreds.password }).catch(() => {});

            lastDialogMessage = '';
            const btnLogin = page.locator('#ContentPlaceHolderTop_OuterContentPlaceHolderBody_btnLogin, input[value="Login"]').first();
            if (await btnLogin.count().catch(() => 0) > 0) {
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
                await page.waitForTimeout(500);
            }

            const postUrl = page.url() ? page.url().toLowerCase() : '';
            const postHasLoginInput = (await userInp.count().catch(() => 0) > 0) && (await userInp.isVisible().catch(() => false));
            if (!isStillLoginUrl(postUrl) && !postHasLoginInput) {
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
            await page.waitForTimeout(400);
        } catch (attemptErr) {
            onProgress(`⚠️ [மீட்பு நிலை] பக்க மறுஏற்றம்/மாற்றம் கண்டறியப்பட்டது (${attemptErr.message || attemptErr}) — தொடர்கிறது...`);
            await page.waitForTimeout(1000);
        }
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

    // 1. Try CAN Number directly if provided (100% Unique)
    if (cleanCan.length >= 10) {
        const resCan = await runSingleFieldSearch('statusform:aadhar', cleanCan, 'CAN எண்');
        if (resCan.records && resCan.records.length > 0) {
            allRecords = resCan.records;
            matchedRecord = pickMatchingRecord(resCan.records, true);
        }
    }

    // 2. Strictly Search ONLY by 12-digit Aadhaar Number (#statusform:aadharNo) — 100% Unique per person.
    // NEVER search by mobile number (a single family mobile can share up to 5 different CAN numbers!).
    if (!matchedRecord && cleanAadhaar.length === 12) {
        const resAadhaar = await runSingleFieldSearch('statusform:aadharNo', cleanAadhaar, 'ஆதார் எண்');
        if (resAadhaar.records && resAadhaar.records.length > 0) {
            allRecords = resAadhaar.records;
            matchedRecord = pickMatchingRecord(resAadhaar.records, true);
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

    const rawAddr = [
        citizenProfile.streetEng,
        citizenProfile.streetTam,
        citizenProfile.areaEng,
        citizenProfile.areaTam,
        citizenProfile.village,
        citizenProfile.taluk,
        citizenProfile.district,
        citizenProfile.address
    ].filter(Boolean).join(' ');

    const geo = resolveTnDistrict(
        citizenProfile.district || '',
        citizenProfile.taluk || '',
        citizenProfile.village || '',
        citizenProfile.pincode || '',
        rawAddr
    );

    const namePair = ensureBilingualPair(
        citizenProfile.fullNameEng || citizenProfile.headNameEng || citizenProfile.name || '',
        citizenProfile.fullNameTam || citizenProfile.headNameTam || citizenProfile.nameTam || ''
    );
    const fullNameEng = namePair.eng || citizenProfile.fullNameEng || citizenProfile.headNameEng || '';
    const fullNameTam = namePair.tam || citizenProfile.fullNameTam || citizenProfile.headNameTam || '';

    const fatherPair = ensureBilingualPair(
        citizenProfile.fatherNameEng || citizenProfile.relativeNameEng || '',
        citizenProfile.fatherNameTam || citizenProfile.relativeNameTam || ''
    );
    const fatherNameEng = fatherPair.eng || citizenProfile.fatherNameEng || citizenProfile.relativeNameEng || '';
    const fatherNameTam = fatherPair.tam || citizenProfile.fatherNameTam || citizenProfile.relativeNameTam || '';

    const rawMotherEng = citizenProfile.motherNameEng || citizenProfile.motherName || '';
    const rawMotherTam = citizenProfile.motherNameTam || citizenProfile.motherName || '';
    const motherPair = ensureBilingualPair(rawMotherEng, rawMotherTam);
    const motherNameEng = motherPair.eng;
    const motherNameTam = motherPair.tam;

    const dob = citizenProfile.dob || citizenProfile.headDob || '';
    const gender = citizenProfile.gender || citizenProfile.headGender || 'Male';
    const genderTam = citizenProfile.genderTam || citizenProfile.headGenderTam || (gender === 'Female' ? 'பெண்' : 'ஆண்');
    const mobile = (citizenProfile.mobileNumber || citizenProfile.mobile || '').replace(/\D+/g, '');
    const aadhaar = (citizenProfile.headAadhaar || citizenProfile.aadhaar || citizenProfile.aadhaarNumber || '').replace(/\s+/g, '');
    const community = citizenProfile.community || citizenProfile.caste || 'MBC';
    const religion = citizenProfile.religion || 'Hindu';
    const doorNo = citizenProfile.doorNo || '';
    const pincode = citizenProfile.pincode || geo.pincode || '';

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

        const goal = detectTargetGoal(citizenProfile, options);
        const { isWidowGoal, isLegalHeirGoal, isObcGoal, isFirstGraduateGoal, isCommunityGoal, isResidenceGoal, isIncomeGoal, hasCertificateGoal } = goal;

        if (options.returnAfterCanResolved === true) {
            return {
                success: true,
                newlyRegistered: true,
                canNumber: mockNewCan,
                applicationNumber: mockNewCan,
                citizenName: fullNameTam,
                mobile: mobile,
                aadhaar: aadhaar,
                receiptPdf: receiptPath,
                isMockSandbox: true,
                message: `🎉 [Safe Mock Sandbox] புதிய 13-இலக்க CAN எண் உருவாக்கப்பட்டது (${mockNewCan}) — சான்றிதழ் விண்ணப்பம் தொடர்கிறது...`
            };
        }

        if (hasCertificateGoal) {
            const goalNameTam = isWidowGoal ? 'விதவைச் சான்றிதழ் (REV-109)'
                : (isLegalHeirGoal ? 'வாரிசு சான்றிதழ் (REV-114)'
                : (isObcGoal ? 'OBC சான்றிதழ் (REV-115)'
                : (isFirstGraduateGoal ? 'முதல் பட்டதாரி சான்றிதழ் (REV-104)'
                : (isCommunityGoal ? 'சாதிச் சான்றிதழ் (REV-101)'
                : (isResidenceGoal ? 'இருப்பிடச் சான்றிதழ் (REV-102)' : 'வருமானச் சான்றிதழ் (REV-103)')))));
            onProgress(`🎉 [Safe Mock Sandbox] புதிய CAN எண் (${mockNewCan}) உருவாக்கப்பட்டது! ${goalNameTam} படிவத்திற்குத் தானாகத் தொடர்கிறது...`);
            if (isWidowGoal) {
                const { startTnegaWidowFlow } = require('./tnega_widow_certificate');
                return await startTnegaWidowFlow(citizenProfile, onProgress, { ...options, canNumber: mockNewCan });
            } else if (isLegalHeirGoal) {
                const { startTnegaLegalHeirFlow } = require('./tnega_legal_heir');
                return await startTnegaLegalHeirFlow(citizenProfile, onProgress, { ...options, canNumber: mockNewCan });
            } else if (isObcGoal) {
                const { startTnegaObcCertificateFlow } = require('./tnega_obc_certificate');
                return await startTnegaObcCertificateFlow(citizenProfile, onProgress, { ...options, canNumber: mockNewCan });
            } else if (isFirstGraduateGoal) {
                const { startTnegaFirstGraduateFlow } = require('./tnega_first_graduate');
                return await startTnegaFirstGraduateFlow(citizenProfile, onProgress, { ...options, canNumber: mockNewCan });
            } else if (isCommunityGoal) {
                const { startTnegaCommunityCertificateFlow } = require('./tnega_community_certificate');
                return await startTnegaCommunityCertificateFlow(citizenProfile, onProgress, { ...options, canNumber: mockNewCan });
            } else if (isResidenceGoal) {
                const { startTnegaResidenceCertificateFlow } = require('./tnega_residence_certificate');
                return await startTnegaResidenceCertificateFlow(citizenProfile, onProgress, { ...options, canNumber: mockNewCan });
            } else {
                const { startTnegaIncomeCertificateFlow } = require('./tnega_income_certificate');
                return await startTnegaIncomeCertificateFlow(citizenProfile, onProgress, { ...options, canNumber: mockNewCan });
            }
        }

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
        const hasLoginBox = await tnegaPage.locator('#txtuserName, input[name*="txtuserName"]').first().isVisible().catch(() => false);
        const isRootLoginUrl = /^https?:\/\/(www\.)?tnesevai\.tn\.gov\.in\/?(\?.*)?$/.test(existingUrl);
        const isAlreadyLoggedIn = !hasLoginBox && !isRootLoginUrl &&
                                  (existingUrl.includes('tnesevai.tn.gov.in') || existingUrl.includes('tnedistrict.tn.gov.in')) && 
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
                    await initTnegaHud(tnegaPage).catch(() => {});
                    await updateTnegaHud(tnegaPage, {
                        title: '🔐 TNeGA ஆப்ரேட்டர் உள்நுழைவு',
                        desc: '⚠️ உங்கள் லாகின் பெட்டகத்தில் விவரங்கள் இல்லை. நீங்களே பயனர் பெயர் & கடவுச்சொல்லை உள்ளிட்டு நுழையவும் ⌨️',
                        badge: 'Manual Login',
                        type: 'attention'
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
                const isLoopLoginUrl = currentUrl.includes('default.aspx') || currentUrl.includes('portallogin.aspx') || /^https?:\/\/(www\.)?tnesevai\.tn\.gov\.in\/?(\?.*)?$/.test(currentUrl);
                if (isLoopLoginUrl) {
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
                if (!isLoopLoginUrl) {
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

                            // Expand DataTables pagination ("10" -> "100") so REV-104/REV-109/REV-114/REV-115 are always visible
                            const dtLenSel = tnegaPage.locator('.dataTables_length select, select[name*="Length"], select[aria-controls]').first();
                            if (await dtLenSel.count() > 0 && await dtLenSel.isVisible().catch(() => false)) {
                                const curLen = await dtLenSel.inputValue().catch(() => '');
                                if (curLen !== '100') {
                                    await dtLenSel.selectOption('100').catch(async () => {
                                        await dtLenSel.selectOption({ label: '100' }).catch(() => {});
                                    });
                                    await tnegaPage.waitForTimeout(800);
                                }
                            }

                            // Click matching service link based on target service (All 7 Revenue Services)
                            const goal = detectTargetGoal(citizenProfile, options);
                            const { isWidowGoal, isLegalHeirGoal, isObcGoal, isFirstGraduateGoal, isCommunityGoal, isResidenceGoal, isIncomeGoal } = goal;

                            let certLink = null;
                            if (isWidowGoal) {
                                certLink = tnegaPage.locator('a[href*="eDistrict.aspx"]:has-text("REV-109"), a:has-text("REV-109"), a:has-text("Widow Certificate"), a:has-text("Widow certificate"), td:has-text("REV-109") a').first();
                                onProgress('🔍 [DOM பகுப்பாய்வு] விதவைச் சான்றிதழ் சேவை கண்டறியப்பட்டது (REV-109) — CAN சரிபார்ப்பிற்காகக் கிளிக் செய்யப்படுகிறது...');
                            } else if (isLegalHeirGoal) {
                                certLink = tnegaPage.locator('a[href*="eDistrict.aspx"]:has-text("REV-114"), a:has-text("REV-114"), a:has-text("Legal Heir"), td:has-text("REV-114") a').first();
                                onProgress('🔍 [DOM பகுப்பாய்வு] வாரிசு சான்றிதழ் சேவை கண்டறியப்பட்டது (REV-114) — CAN சரிபார்ப்பிற்காகக் கிளிக் செய்யப்படுகிறது...');
                            } else if (isObcGoal) {
                                certLink = tnegaPage.locator('a[href*="eDistrict.aspx"]:has-text("REV-115"), a:has-text("REV-115"), a:has-text("Other Backward Classes"), a:has-text("OBC Certificate"), td:has-text("REV-115") a').first();
                                onProgress('🔍 [DOM பகுப்பாய்வு] OBC சான்றிதழ் சேவை கண்டறியப்பட்டது (REV-115) — CAN சரிபார்ப்பிற்காகக் கிளிக் செய்யப்படுகிறது...');
                            } else if (isFirstGraduateGoal) {
                                certLink = tnegaPage.locator('a[href*="eDistrict.aspx"]:has-text("REV-104"), a:has-text("REV-104"), a:has-text("First Graduate"), td:has-text("REV-104") a').first();
                                onProgress('🔍 [DOM பகுப்பாய்வு] முதல் பட்டதாரி சான்றிதழ் சேவை கண்டறியப்பட்டது (REV-104) — CAN சரிபார்ப்பிற்காகக் கிளிக் செய்யப்படுகிறது...');
                            } else if (isCommunityGoal) {
                                certLink = tnegaPage.locator('a[href*="eDistrict.aspx"]:has-text("REV-101"), a:has-text("REV-101 Community certificate"), a:has-text("REV-101"), a:has-text("Community certificate"), td:has-text("REV-101") a').first();
                                onProgress('🔍 [DOM பகுப்பாய்வு] சாதிச் சான்றிதழ் சேவை கண்டறியப்பட்டது (REV-101 Community certificate) — கிளிக் செய்யப்படுகிறது...');
                            } else if (isResidenceGoal) {
                                certLink = tnegaPage.locator('a[href*="eDistrict.aspx"]:has-text("REV-102"), a:has-text("REV-102 Residence certificate"), a:has-text("REV-102"), a:has-text("Residence certificate"), td:has-text("REV-102") a').first();
                                onProgress('🔍 [DOM பகுப்பாய்வு] இருப்பிடச் சான்றிதழ் சேவை கண்டறியப்பட்டது (REV-102 Residence certificate) — கிளிக் செய்யப்படுகிறது...');
                            } else if (isIncomeGoal) {
                                certLink = tnegaPage.locator('a[href*="eDistrict.aspx"]:has-text("REV-103"), a:has-text("REV-103 Income Certificate"), a:has-text("REV-103"), a:has-text("Income Certificate"), td:has-text("REV-103") a').first();
                                onProgress('🔍 [DOM பகுப்பாய்வு] வருமானச் சான்றிதழ் சேவை கண்டறியப்பட்டது (REV-103 Income Certificate) — கிளிக் செய்யப்படுகிறது...');
                            } else {
                                certLink = tnegaPage.locator('a[href*="eDistrict.aspx"]:has-text("REV-101"), a:has-text("REV-101 Community certificate"), a:has-text("REV-101"), a:has-text("Community certificate"), td:has-text("REV-101") a').first();
                                onProgress('🔍 [DOM பகுப்பாய்வு] சேவை தேர்ந்தெடுக்கப்படுகிறது (REV-101 Community certificate)...');
                            }

                            if (certLink && await certLink.count() > 0 && await certLink.isVisible().catch(() => false)) {
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

                    // 3.5 If browser was left on canregistration.xhtml, IncomeCertificate.xhtml, community_certificate.xhtml, or residence_certificate.xhtml from a previous run
                    // and we haven't done the validateAadhar.xhtml CAN pre-search yet, navigate to validateAadhar.xhtml via matching service menu
                    if (!preSearchDone && options.forceNewCanRegister !== true && (currentUrl.includes('canregistration.xhtml') || currentUrl.includes('incomecertificate.xhtml') || currentUrl.includes('community_certificate.xhtml') || currentUrl.includes('residence_certificate.xhtml'))) {
                        const curGoal = detectTargetGoal(citizenProfile, options);
                        const revMenuLink = curGoal.isCommunityGoal 
                            ? tnegaPage.locator('a:has-text("REV-101 Community certificate"), a:has-text("REV-101"), a[href*="instruction.xhtml"]').first()
                            : (curGoal.isResidenceGoal 
                                ? tnegaPage.locator('a:has-text("REV-102 Residence certificate"), a:has-text("REV-102"), a[href*="instruction.xhtml"]').first()
                                : tnegaPage.locator('a:has-text("REV-103 Income Certificate"), a:has-text("REV-103"), a[href*="instruction.xhtml"]').first());
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
                    const btnReg = tnegaPage.locator('a:has-text("Register Can"), a:has-text("Register CAN"), a[href*="canregistration"], input#btnRegisterCAN, button#btnRegisterCAN, input[value*="Register CAN" i], input[value*="Register Can" i]').first();
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
                                    const canGoal = detectTargetGoal(citizenProfile, options);
                                    const { isCommunityGoal, isResidenceGoal, isIncomeGoal, hasCertificateGoal, targetUpper } = canGoal;
                                    await safeSaveCanToDraft(mobile, citizenProfile, foundCan, targetUpper || citizenProfile.subService || options.subService || 'CAN_REGISTER');

                                    if (hasCertificateGoal && options.returnAfterCanResolved !== true) {
                                        const goalNameTam = isCommunityGoal ? 'சாதிச் சான்றிதழ் (REV-101)' : (isResidenceGoal ? 'இருப்பிடச் சான்றிதழ் (REV-102)' : 'வருமானச் சான்றிதழ் (REV-103)');
                                        onProgress(`🎉 ஏற்கனவே பதிவு செய்யப்பட்ட CAN எண் (${foundCan}) தேர்ந்தெடுக்கப்பட்டது! ${goalNameTam} படிவத்திற்கு (Proceed) செல்கிறது...`);
                                        await updateTnegaHud(tnegaPage, {
                                            title: `🎉 CAN எண் கண்டறியப்பட்டது: ${foundCan}`,
                                            desc: `${foundRec.name} — ${goalNameTam} படிவத்திற்கு (Proceed) செல்கிறது...`,
                                            badge: 'CAN Found ✅',
                                            type: 'success'
                                        });

                                        // Safety check: If we are on REV-103 page while user requested Community (REV-101) or Residence (REV-102)
                                        const isRev103Page = currentUrl.includes('rev-103') || (await tnegaPage.locator('text="REV-103 Income Certificate"').count() > 0);
                                        if (isCommunityGoal && isRev103Page) {
                                            onProgress('🔄 [சேவை பொருத்தம்] தற்போது REV-103 பக்கத்தில் உள்ளது. சாதிச் சான்றிதழ் (REV-101) பக்கத்திற்கு மாறுகிறது...');
                                            const rev101Left = tnegaPage.locator('a:has-text("REV-101"), a:has-text("Community certificate"), td:has-text("REV-101") a').first();
                                            if (await rev101Left.count() > 0 && await rev101Left.isVisible()) {
                                                await rev101Left.click().catch(() => {});
                                                await tnegaPage.waitForLoadState('domcontentloaded').catch(() => {});
                                                await tnegaPage.waitForTimeout(1500);
                                            } else {
                                                await tnegaPage.goto('https://tnedistrict.tn.gov.in/web/common/dashboard.xhtml?faces-redirect=true').catch(() => {});
                                                await tnegaPage.waitForTimeout(1500);
                                            }
                                            const { startTnegaCommunityCertificateFlow } = require('./tnega_community_certificate');
                                            return await startTnegaCommunityCertificateFlow(citizenProfile, onProgress, options);
                                        }

                                        if (isResidenceGoal && isRev103Page) {
                                            onProgress('🔄 [சேவை பொருத்தம்] தற்போது REV-103 பக்கத்தில் உள்ளது. இருப்பிடச் சான்றிதழ் (REV-102) பக்கத்திற்கு மாறுகிறது...');
                                            const rev102Left = tnegaPage.locator('a:has-text("REV-102"), a:has-text("Residence certificate"), td:has-text("REV-102") a').first();
                                            if (await rev102Left.count() > 0 && await rev102Left.isVisible()) {
                                                await rev102Left.click().catch(() => {});
                                                await tnegaPage.waitForLoadState('domcontentloaded').catch(() => {});
                                                await tnegaPage.waitForTimeout(1500);
                                            } else {
                                                await tnegaPage.goto('https://tnedistrict.tn.gov.in/web/common/dashboard.xhtml?faces-redirect=true').catch(() => {});
                                                await tnegaPage.waitForTimeout(1500);
                                            }
                                            const { startTnegaResidenceCertificateFlow } = require('./tnega_residence_certificate');
                                            return await startTnegaResidenceCertificateFlow(citizenProfile, onProgress, options);
                                        }

                                        // Click Proceed on validateAadhar.xhtml
                                        const proceedCanBtn = tnegaPage.locator('#statusform input[value*="Proceed"], #statusform input[type="submit"][value*="Proceed"], input[value="Proceed"]').first();
                                        if (await proceedCanBtn.count() > 0 && await proceedCanBtn.isVisible()) {
                                            await proceedCanBtn.click().catch(() => {});
                                            await tnegaPage.waitForLoadState('domcontentloaded').catch(() => {});
                                            await tnegaPage.waitForTimeout(2000);
                                            const extracted = await extractPreFilledPortalCanDetails(tnegaPage);
                                            if (extracted) {
                                                for (const [ek, ev] of Object.entries(extracted)) {
                                                    if (ev && !citizenProfile[ek]) citizenProfile[ek] = ev;
                                                }
                                                await safeSaveCanToDraft(mobile, citizenProfile, foundCan, targetUpper);
                                                onProgress(`💾 போர்ட்டலின் CAN விவரங்கள் வாடிக்கையாளரின் Master Profile-ல் தானாகவே சேமிக்கப்பட்டன!`);
                                            }
                                        }

                                        // Hand off directly to the target Certificate Engine
                                        if (isCommunityGoal) {
                                            try {
                                                const { startTnegaCommunityCertificateFlow } = require('./tnega_community_certificate');
                                                return await startTnegaCommunityCertificateFlow(citizenProfile, onProgress, options);
                                            } catch (flowErr) {
                                                onProgress(`⚠️ சாதிச் சான்றிதழ் படிவ நிரப்புதலில் பிழை: ${flowErr.message}`);
                                                return {
                                                    success: false,
                                                    error: flowErr.message,
                                                    canNumber: foundCan
                                                };
                                            }
                                        } else if (isResidenceGoal) {
                                            try {
                                                const { startTnegaResidenceCertificateFlow } = require('./tnega_residence_certificate');
                                                return await startTnegaResidenceCertificateFlow(citizenProfile, onProgress, options);
                                            } catch (flowErr) {
                                                onProgress(`⚠️ இருப்பிடச் சான்றிதழ் படிவ நிரப்புதலில் பிழை: ${flowErr.message}`);
                                                return {
                                                    success: false,
                                                    error: flowErr.message,
                                                    canNumber: foundCan
                                                };
                                            }
                                        } else {
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
                                        desc: 'இந்த ஆதார் எண்ணிற்கு CAN எண் இல்லை. "Register Can" மூலம் புதிய CAN பதிவு செய்யலாம்.',
                                        badge: 'No CAN Found',
                                        type: 'waiting'
                                    });
                                    onProgress('ℹ️ போர்ட்டலில் இந்த ஆதார் எண்ணிற்கு CAN எண் எதுவும் இல்லை (No records found).');
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
        const relStr = (citizenProfile.relationship || citizenProfile.headRelationship || (citizenProfile.spouseName ? 'Husband' : 'Father')).toLowerCase();
        let relCode = '4';
        let relName = 'Father';
        if (relStr.includes('husband') || relStr.includes('கணவர்') || relStr.includes('spouse')) {
            relCode = '2';
            relName = 'Husband';
        } else if (relStr.includes('mother') || relStr.includes('தாய்')) {
            relCode = '1';
            relName = 'Mother';
        } else if (relStr.includes('guardian') || relStr.includes('பாதுகாவலர்')) {
            relCode = '3';
            relName = 'Guardian';
        }
        const relSelect = tnegaPage.locator('#canreg\\:relation, select#ddlRelationship, select[name*="relation"], select#ddlRelation').first();
        if (await relSelect.count() > 0 && await relSelect.isVisible()) {
            await safeSelect(relSelect, relCode) || await safeSelect(relSelect, relName);
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
        const maritalStr = (citizenProfile.maritalStatus || (citizenProfile.spouseName || relCode === '2' ? 'Married' : 'Unmarried')).toLowerCase();
        let mCode = '2';
        let mName = 'Unmarried';
        if (maritalStr.includes('married') || maritalStr.includes('திருமணமானவர்')) {
            mCode = '1';
            mName = 'Married';
        } else if (maritalStr.includes('widow') || maritalStr.includes('கைம்பெண்')) {
            mCode = '3';
            mName = 'Widowed';
        } else if (maritalStr.includes('divorce') || maritalStr.includes('விவாகரத்து')) {
            mCode = '4';
            mName = 'Divorced';
        }
        const maritalSelect = tnegaPage.locator('#canreg\\:maritalid, select#ddlMaritalStatus, select[name*="maritalid"]').first();
        if (await maritalSelect.count() > 0 && await maritalSelect.isVisible()) {
            await safeSelect(maritalSelect, mCode) || await safeSelect(maritalSelect, mName);
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

        // 9. District, Taluk, Village (Golden Rule 9 & 14: Dynamic Exact Candidate Matching)
        const distSelect = tnegaPage.locator('#canreg\\:cdistrictid, select#ddlDistrict, select[name*="cdistrictid"]').first();
        if (await distSelect.count() > 0 && await distSelect.isVisible()) {
            const distCandidates = [geo.district, geo.districtTam, citizenProfile.district, citizenProfile.districtTam];
            const distResult = await safeSelectLocation(distSelect, distCandidates);
            if (distResult) {
                onProgress(`🏛️ மாவட்டம் தேர்வு செய்யப்பட்டது: ${distResult.selectedText}`);
            }
            await tnegaPage.waitForTimeout(1200); // Wait for taluk ajax
        }
        const talukSelect = tnegaPage.locator('#canreg\\:ctalukaid, select#ddlTaluk, select[name*="ctalukaid"]').first();
        if (await talukSelect.count() > 0 && await talukSelect.isVisible()) {
            // Wait for taluk options to populate via ajax
            for (let waitT = 0; waitT < 20; waitT++) {
                const optCount = await talukSelect.evaluate(sel => (sel && sel.options ? sel.options.length : 0)).catch(() => 0);
                if (optCount > 1) break;
                await tnegaPage.waitForTimeout(500);
            }
            const talukCandidates = [geo.taluk, geo.talukTam, citizenProfile.taluk, citizenProfile.talukTam];
            const talukResult = await safeSelectLocation(talukSelect, talukCandidates);
            if (talukResult) {
                onProgress(`🏛️ வட்டம் தேர்வு செய்யப்பட்டது: ${talukResult.selectedText}`);
            }
            await tnegaPage.waitForTimeout(1200); // Wait for village ajax
        }
        const villSelect = tnegaPage.locator('#canreg\\:cvillageid, select#ddlVillage, select[name*="cvillageid"]').first();
        if (await villSelect.count() > 0 && await villSelect.isVisible()) {
            // Wait for village options to populate via ajax
            for (let waitV = 0; waitV < 20; waitV++) {
                const optCount = await villSelect.evaluate(sel => (sel && sel.options ? sel.options.length : 0)).catch(() => 0);
                if (optCount > 1) break;
                await tnegaPage.waitForTimeout(500);
            }
            const villageCandidates = [
                geo.village,
                geo.villageTam,
                citizenProfile.village,
                citizenProfile.villageTam,
                geo.areaEng,
                geo.areaTam,
                citizenProfile.areaEng,
                citizenProfile.areaTam
            ];
            const villResult = await safeSelectLocation(villSelect, villageCandidates);
            if (villResult) {
                onProgress(`🏛️ வருவாய் கிராமம் தேர்வு செய்யப்பட்டது: ${villResult.selectedText}`);
            }
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

                        const goal = detectTargetGoal(citizenProfile, options);
                        const { isWidowGoal, isLegalHeirGoal, isObcGoal, isFirstGraduateGoal, isCommunityGoal, isResidenceGoal, isIncomeGoal, hasCertificateGoal, targetUpper } = goal;

                        await safeSaveCanToDraft(mobile, citizenProfile, newCan, hasCertificateGoal ? targetUpper : 'CAN_REGISTER');

                        onProgress(`🎉 [நேரலை உற்பத்தி முறை] புதிய 13-இலக்க CAN எண் வெற்றிகரமாக உருவாக்கப்பட்டது!`);
                        onProgress(`🌟 புதிய CAN எண்: ${newCan}`);
                        onProgress(`📄 ஒப்புதல் ரசீது PDF தயாராக உள்ளது.`);

                        if (options.returnAfterCanResolved === true) {
                            try {
                                await tnegaPage.goto('https://www.tnesevai.tn.gov.in/Home/Services.aspx', { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
                                await tnegaPage.waitForTimeout(1200);
                            } catch (_) {}
                            return resolve({
                                success: true,
                                newlyRegistered: true,
                                canNumber: newCan,
                                applicationNumber: newCan,
                                citizenName: fullNameTam,
                                mobile,
                                aadhaar,
                                receiptPdf: receiptPath,
                                message: `🎉 புதிய 13-இலக்க CAN எண் உருவாக்கப்பட்டது (${newCan}) — சான்றிதழ் விண்ணப்பத்திற்குத் தொடர்கிறது...`
                            });
                        }

                        if (hasCertificateGoal) {
                            const goalNameTam = isWidowGoal ? 'விதவைச் சான்றிதழ் (REV-109)'
                                : (isLegalHeirGoal ? 'வாரிசு சான்றிதழ் (REV-114)'
                                : (isObcGoal ? 'OBC சான்றிதழ் (REV-115)'
                                : (isFirstGraduateGoal ? 'முதல் பட்டதாரி சான்றிதழ் (REV-104)'
                                : (isCommunityGoal ? 'சாதிச் சான்றிதழ் (REV-101)'
                                : (isResidenceGoal ? 'இருப்பிடச் சான்றிதழ் (REV-102)' : 'வருமானச் சான்றிதழ் (REV-103)')))));
                            onProgress(`🎉 [முதன்மை இலக்கு தொடர்ச்சி] புதிய CAN எண் (${newCan}) பதிவு செய்யப்பட்டது! ${goalNameTam} விண்ணப்பத்திற்குத் தானாகத் தொடர்கிறது...`);
                            try {
                                await tnegaPage.goto('https://www.tnesevai.tn.gov.in/Home/Services.aspx', { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
                                await tnegaPage.waitForTimeout(1500);
                            } catch (_) {}
                            if (isWidowGoal) {
                                const { startTnegaWidowFlow } = require('./tnega_widow_certificate');
                                return resolve(await startTnegaWidowFlow(citizenProfile, onProgress, { ...options, canNumber: newCan }));
                            } else if (isLegalHeirGoal) {
                                const { startTnegaLegalHeirFlow } = require('./tnega_legal_heir');
                                return resolve(await startTnegaLegalHeirFlow(citizenProfile, onProgress, { ...options, canNumber: newCan }));
                            } else if (isObcGoal) {
                                const { startTnegaObcCertificateFlow } = require('./tnega_obc_certificate');
                                return resolve(await startTnegaObcCertificateFlow(citizenProfile, onProgress, { ...options, canNumber: newCan }));
                            } else if (isFirstGraduateGoal) {
                                const { startTnegaFirstGraduateFlow } = require('./tnega_first_graduate');
                                return resolve(await startTnegaFirstGraduateFlow(citizenProfile, onProgress, { ...options, canNumber: newCan }));
                            } else if (isCommunityGoal) {
                                const { startTnegaCommunityCertificateFlow } = require('./tnega_community_certificate');
                                return resolve(await startTnegaCommunityCertificateFlow(citizenProfile, onProgress, { ...options, canNumber: newCan }));
                            } else if (isResidenceGoal) {
                                const { startTnegaResidenceCertificateFlow } = require('./tnega_residence_certificate');
                                return resolve(await startTnegaResidenceCertificateFlow(citizenProfile, onProgress, { ...options, canNumber: newCan }));
                            } else {
                                const { startTnegaIncomeCertificateFlow } = require('./tnega_income_certificate');
                                return resolve(await startTnegaIncomeCertificateFlow(citizenProfile, onProgress, { ...options, canNumber: newCan }));
                            }
                        }

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
    detectTargetGoal,
    resolveTnegaVaultCredentials,
    performAutomatedTnegaLogin,
    performLiveCanLookupOnPage,
    safeSaveCanToDraft,
    extractPreFilledPortalCanDetails,
    registerNewCan,
    startTnegaCanRegisterFlow
};
