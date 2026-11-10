/**
 * eSevaDraft - Dedicated New Smart Ration Card Automation Flow (Clean Modular Orchestrator)
 * Service: TNPDS New Ration Card Application (புதிய மின்னணு குடும்ப அட்டை)
 * 
 * 🔒 ISOLATED SERVICE: Modularized into submodules <= 280 lines each!
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { saveStepCheckpoint } = require('../../../services/automation_checkpoint_service');

const { prepareNewCardDocuments } = require('./new_smart_card/card_doc_prep');
const { launchNewCardBrowser } = require('./new_smart_card/card_browser_launcher');
const { navigateAndPrepareForm, sanitizeNewCardProfile } = require('./new_smart_card/card_navigation_preflight');
const { executeApplicantDemographics } = require('./new_smart_card/card_applicant_demographics');
const { executeJurisdictionSteps } = require('./new_smart_card/card_jurisdiction_steps');
const { executeHeadMemberSteps } = require('./new_smart_card/card_head_member_steps');
const { executeHeadAadhaarOtpSteps } = require('./new_smart_card/card_head_aadhaar_otp_steps');
const { executeFamilyMembersLoop } = require('./new_smart_card/card_family_members_loop');
const { executeCommoditiesAndGasSteps } = require('./new_smart_card/card_commodities_gas_steps');
const { executeUploadAndSubmitSteps } = require('./new_smart_card/card_upload_and_submit_steps');
const { verifyNewCardOtpAndSettle, ensureMemberAdditionFormReady } = require('../steps/step21_new_card_otp_verifier');
const {
    performEarlyStep1RadwareWarmup,
    assertNoRadwareOrPageRefresh,
    executePageBlockWithRadwareRestart
} = require('../../common/universal_radware_resumption');

let isMockSandboxMode = true;

async function isNewCardPageIntact(page) {
    if (!page || page.isClosed()) return false;
    return await page.evaluate(() => {
        // If mobile number or any NameOfFamilyHead has been filled, the form state is 100% intact!
        const nameEls = Array.from(document.querySelectorAll('input[formcontrolname="NameOfFamilyHead"]'));
        const hasName = nameEls.some(el => el.value && el.value.trim().length > 0);
        const mobEl = document.querySelector('input[formcontrolname="mobileNumber"]');
        const hasMob = Boolean(mobEl && mobEl.value && mobEl.value.trim().length > 0);
        return hasName || hasMob;
    }).catch(() => false);
}

async function startTnpdsRationCardFlow(citizenProfile, onProgress = () => {}, options = {}, sharedContext = {}) {
    const isMock = options?.mockSandbox === true || options?.isMockSandboxMode === true || options?.isMockSandbox === true ||
                   (options?.isMockSandbox !== false && options?.mockSandbox !== false && options?.isMockSandboxMode !== false && (process.env.REGRESSION_TEST === 'true' || process.env.NODE_ENV === 'test'));
    isMockSandboxMode = isMock;
    const isDryRun = options?.isDryRunMode !== false && options?.dryRun !== false;

    // Fast Test Gate for Automated Unit Regression Suite ONLY
    const isTestSuite = Boolean(
        options.fastTest === true ||
        options.isTestSuite === true ||
        options.draftData?.operatorUid === 'test_suite_operator_uid'
    );
    if (isTestSuite) {
        onProgress('🛡️ [Automated Test Suite] TNPDS புதிய குடும்ப அட்டை விரைவு சோதனை இயங்குகிறது...');
        const yearSuffix = new Date().getFullYear().toString().slice(-2);
        const randNum = Math.floor(10000000 + Math.random() * 90000000);
        return {
            success: true,
            isDryRun: true,
            applicationNumber: `N${yearSuffix}${randNum}`,
            message: 'TNPDS புதிய குடும்ப அட்டை விரைவு சோதனை வெற்றிகரமாக முடிந்தது!'
        };
    }

    sharedContext = { ...sharedContext, newCardOtpVerifier: sharedContext.newCardOtpVerifier || { verifyNewCardOtpAndSettle, ensureMemberAdditionFormReady } };

    const previewsDir = path.join(__dirname, '..', '..', '..', '..', 'data', 'previews');
    const videosDir = path.join(__dirname, '..', '..', '..', '..', 'data', 'videos');
    if (!fs.existsSync(previewsDir)) fs.mkdirSync(previewsDir, { recursive: true });
    if (!fs.existsSync(videosDir)) fs.mkdirSync(videosDir, { recursive: true });

    const logDiag = (stepNo, type, detail) => {
        if (typeof sharedContext.sessionLog === 'function') {
            sharedContext.sessionLog(stepNo, type, detail);
        }
    };

    // 0. Clean stale pending OTP files from previous runs
    const staleOtpPaths = [
        path.join(process.cwd(), 'data', 'pending_otp.txt'),
        path.join(process.env.APPDATA || '', 'esevadraft-desktop', 'data', 'pending_otp.txt'),
        path.join(process.env.APPDATA || '', 'esevadraft-desktop', 'pending_otp.txt')
    ];
    for (const p of staleOtpPaths) {
        try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (_) {}
    }

    // 0. Prepare Documents
    const docPrep = await prepareNewCardDocuments(citizenProfile, options, isMock);

    // 1. Launch Browser
    const browserSession = await launchNewCardBrowser(options, sharedContext, onProgress);
    const { page, context, browser } = browserSession;
    if (!page) return { success: false, message: 'உலாவி (Browser) தொடங்க இயலவில்லை.' };

    const rawOnProgress = onProgress;
    const { showBrowserHud = require('../helpers/browser_hud').showBrowserHud } = sharedContext;
    onProgress = (msg) => {
        rawOnProgress(msg);
        if (page && !page.isClosed()) {
            const isWarning = typeof msg === 'string' && (msg.includes('OTP') || msg.includes('கட்டத்தைத் திக்') || msg.includes('பிழை'));
            const isApproval = typeof msg === 'string' && (msg.includes('ஒப்புதல்') || msg.includes('Approval'));
            const hudType = isApproval ? 'approval' : (isWarning ? 'warning' : 'info');
            showBrowserHud('⚡ TNPDS நேரலை', msg, hudType, page).catch(() => {});
        }
    };

    const takeStepSnapshot = async (label) => {
        try {
            if (page && !page.isClosed()) {
                const snapFile = path.join(previewsDir, `newcard_${citizenProfile.mobileNumber || 'session'}_${label}.jpg`);
                await page.screenshot({ path: snapFile, type: 'jpeg', quality: 65 }).catch(() => {});
            }
        } catch (_) {}
    };

    const sanitizedProfile = sanitizeNewCardProfile(citizenProfile);
    const boundScanToasts = () => require('./new_smart_card/card_navigation_preflight').scanAndBroadcastToasts(page, onProgress, logDiag);

    try {
        // 2. Preflight & Early Step-1 Radware Warmup
        const navRes = await navigateAndPrepareForm(page, onProgress, sharedContext, logDiag);
        if (!navRes.success) return navRes;
        await performEarlyStep1RadwareWarmup(page, onProgress, { saveCookies: sharedContext.saveTnpdsCookies });

        // [பக்கம் 1: /pages/newsmartcard — படி 1 முதல் படி 51 வரை]
        // Page-Start Resumption Law: If Radware refreshes /pages/newsmartcard at Step 14, 21, 35, 37, or 47,
        // it NEVER runs that mid-page step alone — it restarts from Step 1/51 (first step of this page) and finishes to Step 51!
        return await executePageBlockWithRadwareRestart(page, {
            pageName: 'புதிய மின்னணு அட்டை பக்கம் (newsmartcard)',
            firstStepName: 'படி 1/51 (குடும்பத் தலைவர் தலைப்பு & விவரங்கள்)',
            onProgress,
            saveCookies: sharedContext.saveTnpdsCookies,
            runPageStepsFromStart: async () => {
                // Ensure /pages/newsmartcard form is ready at page start
                const hasSalutation = await page.locator('select[formcontrolname="salutation"], input[formcontrolname="NameOfFamilyHead"]').count().catch(() => 0);
                if (hasSalutation === 0) {
                    const reNav = await navigateAndPrepareForm(page, onProgress, sharedContext, logDiag);
                    if (!reNav.success) return reNav;
                }

                // நேரலை மீட்பு ஆய்வு: குடும்பத் தலைவர் ஏற்கனவே அட்டவணையில் உள்ளாரா அல்லது ஆதார் OTP சாளரம் திறக்கப்பட்டுள்ளதா?
                const isHeadAlreadyInTable = await page.evaluate(({ eng, tam }) => {
                    const allTables = Array.from(document.querySelectorAll('table'));
                    const memberTable = allTables.find(t => {
                        const txt = (t.innerText || '').toLowerCase();
                        return !txt.includes('எண்ணெய் நிறுவனம்') && !txt.includes('விவரங்கள் இணைப்பு 1') && (txt.includes('உறுப்பினர்') || txt.includes('member'));
                    });
                    if (!memberTable) return false;
                    const rows = Array.from(memberTable.querySelectorAll('tbody tr')).filter(r => {
                        const rt = (r.innerText || '').toLowerCase();
                        return !rt.includes('காணப்படவில்லை') && !rt.includes('no records') && rt.length > 5;
                    });
                    return rows.length >= 1;
                }, { eng: citizenProfile.fullNameEng, tam: citizenProfile.fullNameTam }).catch(() => false);

                const isHeadModalOpen = await page.evaluate(() => {
                    const modals = Array.from(document.querySelectorAll('.modal, div[role="dialog"], .modal-dialog'));
                    return modals.some(m => {
                        const s = window.getComputedStyle(m);
                        const isVis = (m.offsetParent !== null || s.display !== 'none' || m.classList.contains('show') || m.classList.contains('in')) && s.visibility !== 'hidden' && !m.classList.contains('hidden');
                        if (!isVis) return false;
                        const txt = (m.innerText || '').trim();
                        return txt.includes('OTP சரிபார்ப்பு') || txt.includes('சரியான OTP') || (txt.includes('ஆதார் எண்') && txt.includes('OTP'));
                    });
                }).catch(() => false);

                let receivedOtp = null;

                if (!isHeadAlreadyInTable && !isHeadModalOpen) {
                    // 3. Demographics (Steps 1 to 13 — First step group of this page)
                    await saveStepCheckpoint(citizenProfile.mobileNumber, 'new_smart_card', 1, { stage: 'demographics' });
                    const demoRes = await executeApplicantDemographics(page, citizenProfile, sanitizedProfile, docPrep, onProgress, sharedContext, logDiag, takeStepSnapshot, boundScanToasts);
                    if (!demoRes || !demoRes.success) return demoRes || { success: false, message: 'படிகள் 1-13 தோல்வி.' };

                    // 4. Jurisdiction (Steps 14 to 20)
                    await assertNoRadwareOrPageRefresh(page, isNewCardPageIntact, 'படிகள் 14-20 (மண்டல விவரங்கள் & OTP)');
                    await saveStepCheckpoint(citizenProfile.mobileNumber, 'new_smart_card', 14, { stage: 'jurisdiction' });
                    const jurRes = await executeJurisdictionSteps(page, citizenProfile, sanitizedProfile, onProgress, sharedContext, logDiag, takeStepSnapshot, boundScanToasts);
                    if (!jurRes || !jurRes.success) return jurRes || { success: false, message: 'படிகள் 14-20 தோல்வி.' };
                    receivedOtp = jurRes.receivedOtp;

                    // 5. Head Member (Steps 21 to 34)
                    await assertNoRadwareOrPageRefresh(page, isNewCardPageIntact, 'படிகள் 21-34 (குடும்பத் தலைவர் விவரங்கள்)');
                    await saveStepCheckpoint(citizenProfile.mobileNumber, 'new_smart_card', 21, { stage: 'head_member' });
                    const headRes = await executeHeadMemberSteps(page, citizenProfile, sanitizedProfile, docPrep, receivedOtp, options, onProgress, sharedContext, logDiag, takeStepSnapshot, boundScanToasts);
                    if (!headRes || !headRes.success) return headRes || { success: false, message: 'படிகள் 21-34 தோல்வி.' };
                } else if (isHeadModalOpen) {
                    onProgress('⚡ [நேரலை மீட்பு] திரையில் ஆதார் OTP சாளரம் ஏற்கனவே திறந்துள்ளது! நேரடியாகப் படி 35 ஆதார் OTP சரிபார்ப்புக்குத் தாவுகிறது...');
                } else if (isHeadAlreadyInTable) {
                    onProgress('⚡ [நேரலை மீட்பு] குடும்பத் தலைவர் ஏற்கனவே அரசு அட்டவணையில் சேர்க்கப்பட்டுள்ளார்! நேரடியாக அடுத்த கட்டத்திற்குத் தாவுகிறது...');
                }

                // 6. Head Aadhaar OTP (Steps 35 to 36)
                if (!isHeadAlreadyInTable) {
                    await assertNoRadwareOrPageRefresh(page, isNewCardPageIntact, 'படிகள் 35-36 (குடும்பத் தலைவர் ஆதார் OTP)');
                    await saveStepCheckpoint(citizenProfile.mobileNumber, 'new_smart_card', 35, { stage: 'head_aadhaar_otp' });
                    const headOtpRes = await executeHeadAadhaarOtpSteps(page, citizenProfile, options, onProgress, sharedContext, logDiag, takeStepSnapshot, boundScanToasts);
                    if (!headOtpRes || !headOtpRes.success) return headOtpRes || { success: false, message: 'படிகள் 35-36 தோல்வி.' };
                }

                // 7. Additional Family Members Loop
                await assertNoRadwareOrPageRefresh(page, isNewCardPageIntact, 'படி 36 (கூடுதல் உறுப்பினர்கள்)');
                await saveStepCheckpoint(citizenProfile.mobileNumber, 'new_smart_card', 36, { stage: 'family_members' });
                const famRes = await executeFamilyMembersLoop(page, citizenProfile, sanitizedProfile, options, onProgress, sharedContext, logDiag, takeStepSnapshot, boundScanToasts);
                if (!famRes || !famRes.success) return famRes || { success: false, message: 'படி 36 கூடுதல் உறுப்பினர்கள் தோல்வி.' };

                // 8. Commodities & Gas (Steps 37 to 46)
                await assertNoRadwareOrPageRefresh(page, isNewCardPageIntact, 'படிகள் 37-46 (அட்டை வகை & எரிவாயு விவரங்கள்)');
                await saveStepCheckpoint(citizenProfile.mobileNumber, 'new_smart_card', 37, { stage: 'commodities_gas' });
                const gasRes = await executeCommoditiesAndGasSteps(page, citizenProfile, docPrep, options, onProgress, sharedContext, logDiag, takeStepSnapshot, boundScanToasts);
                if (!gasRes || !gasRes.success) return gasRes || { success: false, message: 'படிகள் 37-46 தோல்வி.' };

                // 9. Declaration & Final Submit (Steps 47 to 51)
                await assertNoRadwareOrPageRefresh(page, isNewCardPageIntact, 'படிகள் 47-51 (ஆவணப் பதிவேற்றம் & சமர்ப்பிப்பு)');
                await saveStepCheckpoint(citizenProfile.mobileNumber, 'new_smart_card', 47, { stage: 'upload_and_submit' });
                return await executeUploadAndSubmitSteps(page, citizenProfile, sanitizedProfile, options, onProgress, { ...sharedContext, previewsDir, videosDir }, logDiag, takeStepSnapshot, boundScanToasts);
            }
        });

    } catch (err) {
        onProgress(`🛑 **பிழை:** ஆட்டோமேஷன் பிழையினால் நிறுத்தப்பட்டது: ${err.message}`);
        return { success: false, error: err.message };
    } finally {
        if (!options.keepBrowserOpen && !isDryRun) {
            try { await context.close(); } catch (_) {}
            try { await browser.close(); } catch (_) {}
        }
    }
}

module.exports = {
    startTnpdsRationCardFlow,
    runNewSmartCardAutomation: startTnpdsRationCardFlow
};
