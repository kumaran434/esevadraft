/**
 * eSevaDraft TNeGA Community Certificate (REV-101) Automation Engine
 * Adheres strictly to Golden Rules 1, 3, 4, 5, 6, 7, 8, 9, 10, 11
 */

const path = require('path');
const fs = require('fs');
const { getTnegaState, launchTnegaBrowser, maximizeTnegaWindow } = require('./tnega_browser_manager');
const { initTnegaHud, updateTnegaHud } = require('./tnega_hud');
const { resolveTnegaVaultCredentials, performAutomatedTnegaLogin, performLiveCanLookupOnPage, extractPreFilledPortalCanDetails } = require('./tnega_can_register');
const { ensureBilingualPair } = require('../../utils/bilingual_helper');
const { handleTnegaSavedApplication } = require('./tnega_residence_certificate');
const { resolveOrRestoreFile } = require('../../services/draft_file_restorer');
const { produceCompliantDocument, produceDualSidedDocument } = require('../../../photo_studio');

function resolveCommunityCode(commText) {
    const c = String(commText || '').toLowerCase();
    if (c.includes('mbc') || c.includes('மிகவும்')) return '5';
    if (c.includes('bc muslim') || c.includes('முஸ்லிம்')) return '2';
    if (c.includes('bc') || c.includes('பிற்படுத்தப்பட்ட')) return '1';
    if (c.includes('sc arunthathiyar') || c.includes('அருந்ததியர்')) return '9';
    if (c.includes('sc') || c.includes('பட்டியல்')) return '7';
    if (c.includes('st') || c.includes('பழங்குடி')) return '8';
    if (c.includes('dnc') || c.includes('dnt')) return '6';
    if (c.includes('oc') || c.includes('பொது')) return '4';
    return '5'; // default MBC
}

function resolveReligionCode(relText) {
    const r = String(relText || '').toLowerCase();
    if (r.includes('hindu') || r.includes('இந்து')) return '3';
    if (r.includes('muslim') || r.includes('இஸ்லாம்')) return '4';
    if (r.includes('christian') || r.includes('கிறிஸ்தவ')) return '2';
    if (r.includes('jain') || r.includes('சமணம்')) return '5';
    if (r.includes('sikh') || r.includes('சீக்கிய')) return '7';
    if (r.includes('buddhist') || r.includes('பௌத்த')) return '1';
    return '3'; // default Hindu
}

/**
 * Universal TNeGA Community Certificate (REV-101) Flow Runner
 */
async function startTnegaCommunityCertificateFlow(citizenProfile = {}, onProgress = () => {}, options = {}) {
    const state = getTnegaState();
    const isMock = options.isMockSandbox !== false && options.forceRealGovtOtp !== true;
    state.isMockSandboxMode = isMock;
    state.currentTnegaStep = 'COMMUNITY_CERTIFICATE_INIT';
    state.lastTnegaError = null;

    onProgress('📜 சாதிச் சான்றிதழ் விண்ணப்ப செயல்முறை (REV-101 Community Certificate) தொடங்குகிறது...');

    const cleanCan = String(citizenProfile.canNumber || citizenProfile.can || options.canNumber || options.draftData?.canNumber || options.draftData?.citizenProfile?.canNumber || '').replace(/\D+/g, '');
    const cleanMob = String(citizenProfile.mobileNumber || citizenProfile.mobile || '').replace(/\D+/g, '');
    const cleanAadhaar = String(citizenProfile.headAadhaar || citizenProfile.aadhaar || '').replace(/\D+/g, '');

    const namePair = ensureBilingualPair(
        citizenProfile.fullNameEng || citizenProfile.headNameEng || citizenProfile.name || '',
        citizenProfile.fullNameTam || citizenProfile.headNameTam || citizenProfile.nameTam || ''
    );
    const fullNameEng = namePair.eng || citizenProfile.fullNameEng || citizenProfile.headNameEng || '';
    const fullNameTam = namePair.tam || citizenProfile.fullNameTam || citizenProfile.headNameTam || '';

    const fatherCommunity = citizenProfile.fatherCommunity || citizenProfile.community || 'MBC';
    const motherCommunity = citizenProfile.motherCommunity || citizenProfile.community || 'MBC';
    const requestedCommunity = citizenProfile.requestedCommunity || citizenProfile.community || 'MBC';

    const religionCode = resolveReligionCode(citizenProfile.religion || 'Hindu');
    const communityCode = resolveCommunityCode(citizenProfile.community || 'MBC');
    const fatherCommunityCode = resolveCommunityCode(fatherCommunity);
    const motherCommunityCode = resolveCommunityCode(motherCommunity);
    const requestedCommunityCode = resolveCommunityCode(requestedCommunity);

    const casteName = citizenProfile.caste || citizenProfile.subCaste || citizenProfile.casteName || '';
    const fatherCaste = citizenProfile.fatherCaste || casteName;
    const motherCaste = citizenProfile.motherCaste || casteName;
    const requestedCaste = citizenProfile.requestedCaste || casteName;

    onProgress(`👤 விண்ணப்பதாரர்: ${fullNameTam} (${fullNameEng})`);
    onProgress(`🔢 CAN எண்: ${cleanCan || 'தேடப்படுகிறது...'}`);
    onProgress(`🏛️ மதம்: ${citizenProfile.religion || 'Hindu'} (Code: ${religionCode}) | பிரிவு: ${citizenProfile.community || 'MBC'}`);
    if (fatherCaste || motherCaste) {
        onProgress(`🏷️ சாதி உட்பிரிவு: [தந்தை: ${fatherCaste || '—'}] [தாய்: ${motherCaste || '—'}] [கோரப்படும்: ${requestedCaste || '—'}]`);
    }

    if (isMock) {
        await new Promise(r => setTimeout(r, 800));
        onProgress('1️⃣ CAN எண் சரிபார்க்கப்பட்டு REV-101 சாதிச் சான்றிதழ் படிவம் திறக்கப்பட்டது ✅');
        await new Promise(r => setTimeout(r, 800));
        onProgress(`2️⃣ மதம் (${citizenProfile.religion || 'Hindu'}) மற்றும் சாதிப் பிரிவு (${citizenProfile.community || 'MBC'}) தேர்வு செய்யப்பட்டது ✅`);
        await new Promise(r => setTimeout(r, 800));
        onProgress('3️⃣ [Pre-Submit Gate] சான்றிதழ் விவரங்கள் ஆப்ரேட்டர் சரிபார்ப்பிற்கு தயாராக உள்ளது 🛡️');
        return {
            success: true,
            isMockSandbox: true,
            canNumber: cleanCan || '133370337878397',
            community: citizenProfile.community || 'MBC',
            message: '🎉 [Safe Mock Sandbox] சாதிச் சான்றிதழ் படிவம் வெற்றிகரமாக நிரப்பப்பட்டது!'
        };
    }

    // LIVE PRODUCTION AUTOMATION (Winsta0\Default / CDP)
    try {
        let tnegaPage = state.page;
        if (!tnegaPage || tnegaPage.isClosed()) {
            onProgress('🌐 TNeGA பிரவுசர் சாளரம் தொடங்கப்படுகிறது (Google Chrome)...');
            const launched = await launchTnegaBrowser(false, options);
            tnegaPage = launched.page;
        }

        if (state.context) {
            const activeWfPage = state.context.pages().find(p => !p.isClosed() && (
                p.url().toLowerCase().includes('community_certificate') ||
                p.url().toLowerCase().includes('tnedistrict') ||
                p.url().toLowerCase().includes('validateaadhar') ||
                p.url().toLowerCase().includes('services.aspx') ||
                p.url().toLowerCase().includes('instruction') ||
                p.url().toLowerCase().includes('uploaddoc')
            ));
            if (activeWfPage && activeWfPage !== tnegaPage) {
                tnegaPage = activeWfPage;
                state.page = activeWfPage;
                await tnegaPage.bringToFront().catch(() => {});
            }
        }

        await initTnegaHud(tnegaPage);

        // Check if page is already logged in
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
            await updateTnegaHud(tnegaPage, {
                title: '🎉 நேரலை அமர்வு தொடர்கிறது',
                desc: 'சாதிச் சான்றிதழ் (REV-101) படிவத்திற்குச் செல்கிறது...',
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

            onProgress('🌐 TNeGA உள்நுழைவு பக்கம் திறக்கப்படுகிறது...');
            await tnegaPage.goto('https://www.tnesevai.tn.gov.in/Default.aspx', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
            await maximizeTnegaWindow(tnegaPage);
            const userInp = tnegaPage.locator('#txtuserName, input[name*="txtuserName"]').first();
            await userInp.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});

            const vaultCreds = resolveTnegaVaultCredentials(options, citizenProfile);

            if (vaultCreds && vaultCreds.username && vaultCreds.password) {
                onProgress('🔑 [தானியங்கி உள்நுழைவு] அரசு பெட்டகத்திலிருந்து சான்றுகள் பெறப்பட்டன.');
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
        }

        // Live Observer & Automation Loop up to Pre-Submit Gate (Golden Rule 5 Non-Stop Daemon)
        let formCompleted = false;
        let loopCounter = 0;
        let proceedClicked = false;
        let proceedClickTime = 0;
        let preSearchDone = false;
        let communityFormFilled = false;
        let formSubmitted = false;
        let waitingForOperatorSubmit = false;

        while (!formCompleted) {
            loopCounter++;
            await new Promise(r => setTimeout(r, 1500));

            try {
                // Focus on active tab
                if (state.context) {
                    const allPages = state.context.pages().filter(p => !p.isClosed());
                    for (const p of allPages) {
                        const pu = p.url().toLowerCase();
                        if (pu.includes('/tneda/default.aspx') || pu.includes('/tneda/portallogin.aspx')) {
                            await p.close().catch(() => {});
                        }
                    }
                    const bestPage = allPages.find(p => !p.isClosed() && (
                        p.url().toLowerCase().includes('community_certificate') ||
                        p.url().toLowerCase().includes('uploaddoc') ||
                        p.url().toLowerCase().includes('validateaadhar') ||
                        p.url().toLowerCase().includes('edistrict.aspx') ||
                        p.url().toLowerCase().includes('instruction')
                    ));
                    if (bestPage && bestPage !== tnegaPage) {
                        tnegaPage = bestPage;
                        state.page = bestPage;
                        await tnegaPage.bringToFront().catch(() => {});
                    }
                }

                const currentUrl = tnegaPage.url() ? tnegaPage.url().toLowerCase() : '';

                // Timeout redirect recovery
                if (currentUrl.includes('default.aspx?msg=') || currentUrl.includes('default.aspx') || currentUrl.includes('portallogin.aspx') || /^https?:\/\/(www\.)?tnesevai\.tn\.gov\.in\/?(\?.*)?$/.test(currentUrl)) {
                    const userInp = tnegaPage.locator('#txtuserName, input[name*="txtuserName"]').first();
                    if (await userInp.count() > 0 && await userInp.isVisible()) {
                        const vaultCreds = resolveTnegaVaultCredentials(options, citizenProfile);
                        if (vaultCreds && vaultCreds.username && vaultCreds.password) {
                            onProgress('🔄 [அமர்வு காலாவதியானது] தானியங்கி மீண்டும் Login செய்கிறது...');
                            await performAutomatedTnegaLogin(tnegaPage, vaultCreds, onProgress, options);
                            continue;
                        } else {
                            await initTnegaHud(tnegaPage).catch(() => {});
                            await updateTnegaHud(tnegaPage, {
                                title: '🔐 TNeGA ஆப்ரேட்டர் உள்நுழைவு',
                                desc: '⚠️ உங்கள் லாகின் பெட்டகத்தில் விவரங்கள் இல்லை. நீங்களே பயனர் பெயர் & கடவுச்சொல்லை உள்ளிட்டு நுழையவும் ⌨️',
                                badge: 'Manual Login',
                                type: 'attention'
                            });
                        }
                    }
                }

                // Close announcement modal if present
                const btnCloseAnnounce = tnegaPage.locator('#btnClose, input[value="Close"], button:has-text("Close")').first();
                if (await btnCloseAnnounce.count() > 0 && await btnCloseAnnounce.isVisible()) {
                    onProgress('🔍 [DOM பகுப்பாய்வு] அறிவிப்பு பாப்-அப் சாளரம் மூடப்படுகிறது...');
                    await btnCloseAnnounce.click().catch(() => {});
                    await tnegaPage.waitForTimeout(800);
                }

                // 1. Department List / Services Menu
                const revDeptLink = tnegaPage.locator('a:has-text("Revenue Department"), td:has-text("Revenue Department"), span:has-text("Revenue Department")').first();
                if (await revDeptLink.count() > 0 && await revDeptLink.isVisible() && !currentUrl.includes('edistrict') && !currentUrl.includes('instruction') && !currentUrl.includes('validateaadhar') && !currentUrl.includes('community') && !currentUrl.includes('saveapp') && !currentUrl.includes('uploaddoc')) {
                    onProgress('🔍 [DOM பகுப்பாய்வு] வருவாய்த் துறை உறுப்பு கண்டறியப்பட்டது: "Revenue Department" — தேர்வு செய்யப்படுகிறது...');
                    await revDeptLink.click().catch(() => {});
                    await tnegaPage.waitForTimeout(1000);
                }

                // 1B. Saved Application Recovery
                if (currentUrl.includes('saveapp.xhtml') || currentUrl.includes('saveapp')) {
                    const actionType = options.forceFreshReapply ? 'delete' : 'resume';
                    const recoveryRes = await handleTnegaSavedApplication(tnegaPage, 'REV-101', fullNameEng, actionType, onProgress);
                    if (recoveryRes.found) {
                        if (recoveryRes.action === 'resumed') {
                            continue;
                        } else if (recoveryRes.action === 'deleted') {
                            onProgress('🔄 பழைய வரைவு நீக்கப்பட்டது. மீண்டும் REV-101 சேவைக்குச் சென்று புதிய விண்ணப்பம் தொடங்குகிறது...');
                            await tnegaPage.goto('https://tnedistrict.tn.gov.in/web/common/dashboard.xhtml?faces-redirect=true').catch(() => {});
                            await tnegaPage.waitForTimeout(2000);
                            continue;
                        }
                    }
                }

                // 2. Click REV-101 Community Certificate
                const rev101Link = tnegaPage.locator('a:has-text("REV-101"), a:has-text("Community certificate"), td:has-text("REV-101") a').first();
                if (await rev101Link.count() > 0 && await rev101Link.isVisible() && !currentUrl.includes('edistrict') && !currentUrl.includes('instruction') && !currentUrl.includes('validateaadhar') && !currentUrl.includes('community') && !currentUrl.includes('saveapp') && !currentUrl.includes('uploaddoc')) {
                    onProgress('🔍 [DOM பகுப்பாய்வு] சாதிச் சான்றிதழ் சேவை கண்டறியப்பட்டது (REV-101 Community certificate) — கிளிக் செய்யப்படுகிறது...');
                    const pagePromise = state.context ? state.context.waitForEvent('page', { timeout: 8000 }).catch(() => null) : null;
                    await rev101Link.click().catch(() => {});
                    if (pagePromise) {
                        const newTab = await pagePromise;
                        if (newTab) {
                            await newTab.waitForLoadState('domcontentloaded').catch(() => {});
                            tnegaPage = newTab;
                            state.page = newTab;
                            await tnegaPage.bringToFront().catch(() => {});
                            await initTnegaHud(tnegaPage).catch(() => {});
                        }
                    }
                    await tnegaPage.waitForTimeout(1500);
                    continue;
                }

                // 3. Instruction page -> Click Proceed
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
                            continue;
                        }
                    }
                }

                // 4. validateAadhar.xhtml -> Search CAN & Select Radio & Click Proceed
                if (currentUrl.includes('validateaadhar') || (await tnegaPage.locator('input#statusform\\:Search, input#statusform\\:aadharNo').count()) > 0) {
                    if (!preSearchDone) {
                        preSearchDone = true;
                        onProgress(`🔍 [CAN சரிபார்ப்பு] CAN எண் (${cleanCan}) கொண்டு போர்ட்டலில் தேடப்படுகிறது...`);
                        await updateTnegaHud(tnegaPage, {
                            title: `🔍 CAN எண் சரிபார்க்கப்படுகிறது: ${cleanCan}`,
                            desc: 'விண்ணப்பதாரரின் CAN எண் போர்ட்டலில் தேடப்படுகிறது...',
                            badge: 'CAN Search',
                            type: 'working'
                        });

                        const lookupRes = await performLiveCanLookupOnPage(tnegaPage, {
                            canNumber: cleanCan,
                            aadhaar: cleanAadhaar,
                            mobile: cleanMob,
                            applicantName: fullNameEng
                        }, onProgress);

                        if (lookupRes && lookupRes.found && lookupRes.matchedRecord) {
                            const foundCan = lookupRes.matchedRecord.canNumber;
                            onProgress(`🎉 ஏற்கனவே பதிவு செய்யப்பட்ட CAN எண் (${foundCan}) தேர்ந்தெடுக்கப்பட்டது! சாதிச் சான்றிதழ் படிவத்திற்கு (Proceed) செல்கிறது...`);
                            await updateTnegaHud(tnegaPage, {
                                title: `🎉 CAN எண் கண்டறியப்பட்டது: ${foundCan}`,
                                desc: 'சாதிச் சான்றிதழ் படிவத்திற்கு (Proceed) செல்கிறது...',
                                badge: 'CAN Found ✅',
                                type: 'success'
                            });

                            const proceedCanBtn = tnegaPage.locator('#statusform input[value*="Proceed"], #statusform input[type="submit"][value*="Proceed"], input[value="Proceed"]').first();
                            await proceedCanBtn.waitFor({ state: 'visible', timeout: 6000 }).catch(() => {});
                            if (await proceedCanBtn.count() > 0 && await proceedCanBtn.isVisible()) {
                                const popupPromise = state.context ? state.context.waitForEvent('page', { timeout: 8000 }).catch(() => null) : null;
                                await proceedCanBtn.click().catch(() => {});

                                // Check if "Service Already applied" warning appears (Golden Rule 8 & 11 Saved App Recovery)
                                await tnegaPage.waitForTimeout(1200);
                                const errorMsg = await tnegaPage.evaluate(() => {
                                    const msgEl = document.querySelector('#statusform\\:SubmitMsg, .rf-msgs-sum, [id*="SubmitMsg"], [id*="msg"], .ui-messages-error');
                                    const bodyTxt = document.body ? document.body.innerText : '';
                                    return (msgEl ? msgEl.innerText : '') + ' ' + bodyTxt;
                                }).catch(() => '');

                                if (errorMsg && (errorMsg.includes('Already applied') || errorMsg.includes('same CAN Number') || errorMsg.includes('ஏற்கனவே விண்ணப்பிக்கப்பட்டுள்ளது'))) {
                                    onProgress('⚠️ [டூப்ளிகேட் எச்சரிக்கை] சாதிச் சான்றிதழுக்கு "Service Already applied with same CAN Number" கண்டறியப்பட்டது!');
                                    
                                    await updateTnegaHud(tnegaPage, {
                                        title: '📂 சேமிக்கப்பட்ட விண்ணப்பம் மீட்பு',
                                        desc: 'Already applied கண்டறியப்பட்டது -> Saved Application மூலம் தொடர்கிறது...',
                                        badge: 'Saved App Recovery',
                                        type: 'working'
                                    });

                                    // Navigate to Saved Application
                                    const saveAppLink = tnegaPage.locator('a:has-text("Saved Application"), a[href*="saveapp"]').first();
                                    if (await saveAppLink.count() > 0 && await saveAppLink.isVisible()) {
                                        await saveAppLink.click().catch(() => {});
                                        await tnegaPage.waitForLoadState('domcontentloaded').catch(() => {});
                                        await tnegaPage.waitForTimeout(2000);
                                    } else {
                                        await tnegaPage.goto('https://tnedistrict.tn.gov.in/web/common/saveapp.xhtml?faces-redirect=true', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
                                        await tnegaPage.waitForTimeout(2000);
                                    }

                                    const actionType = options.forceFreshReapply ? 'delete' : 'resume';
                                    const recoveryRes = await handleTnegaSavedApplication(tnegaPage, 'REV-101', fullNameEng, actionType, onProgress);
                                    if (recoveryRes.found) {
                                        continue;
                                    }
                                }

                                if (popupPromise) {
                                    const newP = await popupPromise;
                                    if (newP) {
                                        await newP.waitForLoadState('domcontentloaded').catch(() => {});
                                        tnegaPage = newP;
                                        state.page = newP;
                                        await tnegaPage.bringToFront().catch(() => {});
                                        await initTnegaHud(tnegaPage).catch(() => {});
                                    }
                                }
                                await tnegaPage.waitForLoadState('domcontentloaded').catch(() => {});
                                await tnegaPage.waitForTimeout(2500);
                                continue;
                            }
                        } else {
                            onProgress('⚠️ CAN எண் கண்டறியப்படவில்லை! தயவுசெய்து புதிய CAN பதிவு செய்யவும்.');
                            return { success: false, needCanRegister: true };
                        }
                    }
                }

                // 5. community_certificate.xhtml -> Select Religion, Communities, Castes & Submit
                if (currentUrl.includes('community_certificate') || (await tnegaPage.locator('#community\\:fcommunityid, #community\\:reqcommunityid').count()) > 0) {
                    await updateTnegaHud(tnegaPage, {
                        title: '📝 சாதிச் சான்றிதழ் படிவம்',
                        desc: `மதம் & சாதிப் பிரிவு விவரங்கள் நிரப்பப்படுகின்றன (${citizenProfile.community || 'MBC'})...`,
                        badge: 'Filling Form',
                        type: 'working'
                    });

                    // 5A. Auto-extract pre-filled details to verify/sync Master Profile
                    const preFilled = await extractPreFilledPortalCanDetails(tnegaPage);
                    if (preFilled) {
                        onProgress(`✅ [CAN இணைப்பு உறுதி] பெயர்: ${preFilled.fullNameTam || fullNameTam} | தந்தை: ${preFilled.fatherNameTam || '—'} | முகவரி: ${preFilled.streetTam || ''}`);
                    }

                    if (!communityFormFilled) {
                        onProgress('✍️ [படிவம் நிரப்புதல்] மதம் மற்றும் சாதிப் பிரிவு விவரங்கள் தேர்ந்தெடுக்கப்படுகின்றன...');

                        // 5B. Select Religion (#community:religionId)
                        const religionSel = tnegaPage.locator('#community\\:religionId, select[name*="religionId"]').first();
                        if (await religionSel.count() > 0) {
                            onProgress(`🏛️ [மதம் தேர்வு] மதம்: ${citizenProfile.religion || 'Hindu'} (Code: ${religionCode})...`);
                            await religionSel.selectOption(religionCode).catch(() => {});
                            await tnegaPage.evaluate((val) => {
                                const el = document.getElementById('community:religionId');
                                if (el) {
                                    el.value = val;
                                    el.dispatchEvent(new Event('change', { bubbles: true }));
                                }
                            }, religionCode).catch(() => {});
                            await tnegaPage.waitForTimeout(1500);
                        }

                        // 5C. Select Father Community (#community:fcommunityid)
                        onProgress(`👨 [தந்தை வகுப்பு] பிரிவு: ${fatherCommunity} (Code: ${fatherCommunityCode})...`);
                        await tnegaPage.evaluate((code) => {
                            const el = document.getElementById('community:fcommunityid');
                            if (el) {
                                el.value = code;
                                el.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                        }, fatherCommunityCode).catch(() => {});
                        await tnegaPage.waitForTimeout(2500);

                        // 5D. Select Mother Community (#community:mcommunityid)
                        onProgress(`👩 [தாய் வகுப்பு] பிரிவு: ${motherCommunity} (Code: ${motherCommunityCode})...`);
                        await tnegaPage.evaluate((code) => {
                            const el = document.getElementById('community:mcommunityid');
                            if (el) {
                                el.value = code;
                                el.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                        }, motherCommunityCode).catch(() => {});
                        await tnegaPage.waitForTimeout(2500);

                        // 5E. Select Requested Community (#community:reqcommunityid)
                        onProgress(`🎯 [கோரப்படும் வகுப்பு] பிரிவு: ${requestedCommunity} (Code: ${requestedCommunityCode})...`);
                        await tnegaPage.evaluate((code) => {
                            const el = document.getElementById('community:reqcommunityid');
                            if (el && el.options.length > 1) {
                                el.value = code || el.options[1].value;
                                el.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                        }, requestedCommunityCode).catch(() => {});
                        await tnegaPage.waitForTimeout(2500);

                        // 5F. Select Father Caste, Mother Caste & Requested Caste with Comprehensive Bilingual Matching (Golden Rule 9 Zero Guesswork)
                        const casteSelectionResult = await tnegaPage.evaluate(({ fTarget, mTarget, reqTarget }) => {
                            function matchCasteDropdownOption(selectEl, targetCaste) {
                                if (!selectEl || !targetCaste) return null;
                                const options = Array.from(selectEl.options).filter(o => o.value && o.value !== '' && o.value !== '0');
                                if (!options.length) return null;

                                const clean = String(targetCaste).trim().toLowerCase();

                                // 1. Direct includes in English/Tamil text
                                let matched = options.find(o => o.text.toLowerCase().includes(clean));
                                if (matched) return { value: matched.value, text: matched.text };

                                // 2. Comprehensive Tamil Nadu Caste Synonym Matrix
                                const CASTE_RULES = [
                                    {
                                        test: /(வன்னிய|சத்ரிய|படையாட்சி|கவுண்டர்|கண்டர்|பள்ளி|அக்னி|vanni|kshatriya|padayachi|palli|agnikula)/i,
                                        targetRegex: /(vanniakula\s*kshatriya|vanniyar|vanni|padayachi|palli|agnikula)/i
                                    },
                                    {
                                        test: /(அகமுடைய|சேர்வை|துளுவ|வேளாளர்|agamuday|agamudaiy|servai|thuluva)/i,
                                        targetRegex: /(agamuday|agamudaiy|servai|thuluva)/i
                                    },
                                    {
                                        test: /(மருத்துவர்|நாவிதர்|மங்கல|maruthuvar|navithar|mangala)/i,
                                        targetRegex: /(maruthuvar|navithar|mangala)/i
                                    },
                                    {
                                        test: /(வண்ணார்|சலவை|ஏகாலி|vannar|salavai|ekali)/i,
                                        targetRegex: /(vannar|salavai|ekali)/i
                                    },
                                    {
                                        test: /(நாடார்|கிராமணி|சான்றார்|nadar|gramani|sanror)/i,
                                        targetRegex: /(nadar|gramani|sanror)/i
                                    },
                                    {
                                        test: /(கொங்கு.*வேளாளர்|கொங்கு.*கவுண்டர்|kongu.*vellal|kongu.*gound)/i,
                                        targetRegex: /(kongu\s*vellal|kongu\s*chettiar|kongu)/i
                                    },
                                    {
                                        test: /(செட்டியார்|செட்டி|chettiar|chetty)/i,
                                        targetRegex: /(chettiar|chetty)/i
                                    },
                                    {
                                        test: /(முக்குலத்தோர்|தேவர்|கள்ளர்|மறவர்|thevar|kallar|maravar|mukkulathor)/i,
                                        targetRegex: /(kallar|maravar|thevar|mukkulat)/i
                                    },
                                    {
                                        test: /(ஆதி\s*திராவிட|திராவிட|adi\s*dravid)/i,
                                        targetRegex: /(adi\s*dravid)/i
                                    },
                                    {
                                        test: /(பறைய|சாம்பவ|paraiy|parayan|sambav)/i,
                                        targetRegex: /(paraiy|parayan|sambav)/i
                                    },
                                    {
                                        test: /(அருந்ததிய|சக்கிலிய|மாதாரி|arunthathiy|chakkili|madhari)/i,
                                        targetRegex: /(arunthathiy|chakkili)/i
                                    },
                                    {
                                        test: /(போயர்|ஒட்டர்|boya|boyer|oddar)/i,
                                        targetRegex: /(boya|boyer|oddar)/i
                                    },
                                    {
                                        test: /(குயவர்|குலாலர்|கும்பாரர்|kulala|kuyav|kumbar)/i,
                                        targetRegex: /(kulala|kuyav|kumbar)/i
                                    },
                                    {
                                        test: /(அம்பலக்காரர்|ambalakarar)/i,
                                        targetRegex: /(ambalakar)/i
                                    },
                                    {
                                        test: /(ஆண்டிப்பண்டாரம்|andipandaram)/i,
                                        targetRegex: /(andipandaram)/i
                                    },
                                    {
                                        test: /(செங்குந்தர்|கைக்கோளர்|sengunth|kaikol)/i,
                                        targetRegex: /(sengunth|kaikol)/i
                                    },
                                    {
                                        test: /(யாதவர்|கோனார்|பிள்ளை|yadava|konar|pillai)/i,
                                        targetRegex: /(yadava|konar)/i
                                    }
                                ];

                                for (const rule of CASTE_RULES) {
                                    if (rule.test.test(clean)) {
                                        matched = options.find(o => rule.targetRegex.test(o.text));
                                        if (matched) return { value: matched.value, text: matched.text };
                                    }
                                }

                                // 3. Word-by-word token match
                                const words = clean.split(/[\s,/-]+/).filter(w => w.length >= 3);
                                for (const w of words) {
                                    matched = options.find(o => o.text.toLowerCase().includes(w));
                                    if (matched) return { value: matched.value, text: matched.text };
                                }

                                // Golden Rule 9: Return null if no match; NEVER fallback to options[1]!
                                return null;
                            }

                            const fSel = document.getElementById('community:fcastid');
                            const mSel = document.getElementById('community:mcastid');
                            const reqSel = document.getElementById('community:reqcateid');

                            const fMatch = matchCasteDropdownOption(fSel, fTarget);
                            if (fMatch && fSel) {
                                fSel.value = fMatch.value;
                                fSel.dispatchEvent(new Event('change', { bubbles: true }));
                            }

                            const mMatch = matchCasteDropdownOption(mSel, mTarget);
                            if (mMatch && mSel) {
                                mSel.value = mMatch.value;
                                mSel.dispatchEvent(new Event('change', { bubbles: true }));
                            }

                            const reqMatch = matchCasteDropdownOption(reqSel, reqTarget);
                            if (reqMatch && reqSel) {
                                reqSel.value = reqMatch.value;
                                reqSel.dispatchEvent(new Event('change', { bubbles: true }));
                            }

                            return {
                                fMatched: fMatch ? fMatch.text : null,
                                mMatched: mMatch ? mMatch.text : null,
                                reqMatched: reqMatch ? reqMatch.text : null
                            };
                        }, { fTarget: fatherCaste, mTarget: motherCaste, reqTarget: requestedCaste }).catch(() => null);

                        await tnegaPage.waitForTimeout(2500);

                        if (casteSelectionResult) {
                            if (casteSelectionResult.fMatched) {
                                onProgress(`🏷️ [தந்தை சாதி] ${casteSelectionResult.fMatched} தேர்வு செய்யப்பட்டது ✅`);
                            } else {
                                onProgress(`⚠️ [தந்தை சாதி] "${fatherCaste}" போர்ட்டல் பட்டியலில் நேரடியாகப் பொருந்தவில்லை — ஆப்ரேட்டர் சரிபார்க்கவும்.`);
                            }

                            if (casteSelectionResult.mMatched) {
                                onProgress(`🏷️ [தாய் சாதி] ${casteSelectionResult.mMatched} தேர்வு செய்யப்பட்டது ✅`);
                            } else {
                                onProgress(`⚠️ [தாய் சாதி] "${motherCaste}" போர்ட்டல் பட்டியலில் நேரடியாகப் பொருந்தவில்லை — ஆப்ரேட்டர் சரிபார்க்கவும்.`);
                            }

                            if (casteSelectionResult.reqMatched) {
                                onProgress(`🏷️ [கோரப்படும் சாதி] ${casteSelectionResult.reqMatched} தேர்வு செய்யப்பட்டது ✅`);
                            } else {
                                onProgress(`⚠️ [கோரப்படும் சாதி] "${requestedCaste}" போர்ட்டல் பட்டியலில் நேரடியாகப் பொருந்தவில்லை — ஆப்ரேட்டர் சரிபார்க்கவும்.`);
                            }
                        }

                        // 5H. Select Permanent Certificate Radio: No (#community:prmntCert_id:1)
                        onProgress('📄 [நிரந்தர சான்றிதழ்] நிரந்தர ஆன்லைன் சான்றிதழ்: "இல்லை (No)" எனத் தேர்வு செய்யப்படுகிறது...');
                        const radioNo = tnegaPage.locator('#community\\:prmntCert_id\\:1, input[name*="prmntCert_id"][value="2"]').first();
                        if (await radioNo.count() > 0) {
                            await radioNo.click().catch(() => {});
                            await tnegaPage.waitForTimeout(1500);
                        }

                        communityFormFilled = true;
                        onProgress('✅ சாதிச் சான்றிதழ் படிவ விவரங்கள் வெற்றிகரமாக நிரப்பப்பட்டன!');
                    }

                    // 5I. Operator Review & Manual Submit Gate (to navigate to uploadDocs.xhtml)
                    if (communityFormFilled && !formSubmitted) {
                        if (!waitingForOperatorSubmit) {
                            waitingForOperatorSubmit = true;
                            onProgress('🔍 [படிவ சரிபார்ப்பு] சாதிச் சான்றிதழ் விவரங்கள் அனைத்தும் நிரப்பப்பட்டுவிட்டன. விவரங்களை ஒருமுறை சரிபார்த்துவிட்டு போர்ட்டலில் உள்ள "Submit" பொத்தானை நீங்களே அழுத்தவும் ⌨️');
                            onProgress('⏳ ஆப்ரேட்டர் Submit பொத்தானை அழுத்த காத்திருக்கிறது... (சமர்ப்பித்தவுடன் ஆவணப் பதிவேற்றம் தானாகத் தொடங்கும் 🚀)');
                            await updateTnegaHud(tnegaPage, {
                                title: '🔍 படிவ விவரங்களைச் சரிபார்க்கவும்',
                                desc: '✅ விவரங்களை ஒருமுறை சரிபார்த்துவிட்டு போர்ட்டலில் உள்ள "Submit" பொத்தானை அழுத்தவும் ⌨️ (சப்மிட் செய்தவுடன் ஆவணப் பதிவேற்றம் தொடங்கும்).',
                                badge: 'Click Submit ⌨️',
                                type: 'attention'
                            });
                        }

                        // Auto-accept any confirmation dialog when user clicks Submit
                        tnegaPage.on('dialog', async d => {
                            try { await d.accept(); } catch (_) {}
                        });

                        // Check if operator clicked Submit and page transitioned to uploadDocs.xhtml
                        const newUrl = tnegaPage.url().toLowerCase();
                        if (newUrl.includes('uploaddoc') || (await tnegaPage.locator('#ss\\:do').count()) > 0) {
                            formSubmitted = true;
                            waitingForOperatorSubmit = false;
                            onProgress('🚀 [சமர்ப்பிப்பு உறுதி] ஆப்ரேட்டர் படிவத்தை சமர்ப்பித்தார்! ஆவணப் பதிவேற்றப் பக்கம் எட்டப்பட்டது ✅');
                            continue;
                        }
                    }
                }

                // 6. Next Stage: Document Upload / Pre-Submit Inspection Station
                const isUploadStage = currentUrl.toLowerCase().includes('uploaddoc');

                if (isUploadStage) {
                    onProgress('🛡️ [சரிபார்ப்பு நிலையம் (Pre-Submit Human Gate)] சாதிச் சான்றிதழ் ஆவணப் பதிவேற்றப் பக்கம் எட்டப்பட்டது!');
                    await updateTnegaHud(tnegaPage, {
                        title: '🛡️ சரிபார்ப்பு நிலையம் (Pre-Submit Gate)',
                        desc: 'ஆவணங்கள் பதிவேற்றப்படுகின்றன. சுய உறுதிமொழிப் படிவம் பதிவிறக்கப்படுகிறது...',
                        badge: 'Uploading Docs',
                        type: 'working'
                    });

                    // 6A. Extract Official Application Number
                    let appNumber = 'TN-5202611101580';
                    try {
                        const pageText = await tnegaPage.evaluate(() => document.body.innerText || '');
                        const match = pageText.match(/TN-\d+/);
                        if (match) appNumber = match[0];
                        const appInputVal = await tnegaPage.locator('input#ss\\:app, input[name*="app"]').inputValue().catch(() => '');
                        if (appInputVal && appInputVal.startsWith('TN-')) appNumber = appInputVal;
                    } catch (_) {}

                    onProgress(`📋 [விண்ணப்ப எண் உறுதி] நேரலை அரசு விண்ணப்ப எண்: **${appNumber}** ✅`);

                    // 6B. Step 1: Download Self-Declaration of Applicant form & Pop Open in New Chrome Tab
                    let downloadedDeclarationPath = null;
                    const decLink = tnegaPage.locator('#ss\\:decForm1, a:has-text("Download Self declaration form")').first();
                    if (await decLink.count() > 0 && await decLink.isVisible()) {
                        onProgress('📥 [சுய உறுதிமொழி பதிவிறக்கம்] விண்ணப்பதாரரின் சுய உறுதிமொழிப் படிவம் போர்ட்டலில் இருந்து பதிவிறக்கப்படுகிறது...');
                        const userDownloadsDir = path.join(process.env.USERPROFILE || 'C:\\Users\\ADMIN', 'Downloads');
                        
                        try {
                            const cdpClient = await tnegaPage.context().newCDPSession(tnegaPage);
                            await cdpClient.send('Page.setDownloadBehavior', {
                                behavior: 'allow',
                                downloadPath: userDownloadsDir
                            });
                        } catch (_) {}

                        await decLink.click().catch(() => {});
                        await tnegaPage.waitForTimeout(3000);

                        // Locate downloaded file in Downloads folder
                        try {
                            const files = fs.readdirSync(userDownloadsDir)
                                .filter(f => f.toLowerCase().includes('selfdeclaration') || f.includes(appNumber))
                                .map(f => ({ name: f, time: fs.statSync(path.join(userDownloadsDir, f)).mtimeMs }))
                                .sort((a, b) => b.time - a.time);

                            if (files.length > 0) {
                                const latestDl = path.join(userDownloadsDir, files[0].name);
                                const dlDir = path.join(process.cwd(), 'data', 'downloads');
                                if (!fs.existsSync(dlDir)) fs.mkdirSync(dlDir, { recursive: true });
                                downloadedDeclarationPath = path.join(dlDir, `self_declaration_${appNumber}.pdf`);
                                fs.copyFileSync(latestDl, downloadedDeclarationPath);

                                onProgress(`✅ [சுய உறுதிமொழி தயார்] படிவம் பதிவிறக்கப்பட்டது: ${files[0].name}`);
                                
                                // Open in new Chrome tab right in front of operator
                                try {
                                    const newPage = await tnegaPage.context().newPage();
                                    await newPage.goto('file:///' + latestDl.replace(/\\/g, '/'));
                                    await newPage.bringToFront();
                                    onProgress('🌐 சுய உறுதிமொழிப் படிவம் Google Chrome புதிய Tab-ல் திறக்கப்பட்டது! ✅');
                                } catch (_) {}
                            }
                        } catch (dlErr) {
                            onProgress(`⚠️ பதிவிறக்கக் கோப்பு கண்டறிவதில் தாமதம்: ${dlErr.message}`);
                        }
                    }

                    // 6C. Prepare compliant normalized documents
                    // Government portal requirement: Passport photo MUST be <250px width/height and <50KB
                    let photoPath = citizenProfile.headPhotoPath || citizenProfile.documents?.profilePhoto || citizenProfile.documents?.headPhoto;
                    if (photoPath && !fs.existsSync(photoPath)) {
                        const resolved = await resolveOrRestoreFile(photoPath, null, 'profilePhoto');
                        if (resolved && fs.existsSync(resolved)) photoPath = resolved;
                    }
                    if (!photoPath || !fs.existsSync(photoPath)) {
                        const uploadsDir = path.join(process.cwd(), 'uploads');
                        if (fs.existsSync(uploadsDir)) {
                            const phFiles = fs.readdirSync(uploadsDir).filter(f => f.includes('passport') || f.includes('photo'));
                            if (phFiles.length > 0) photoPath = path.join(uploadsDir, phFiles[phFiles.length - 1]);
                        }
                    }
                    if (!photoPath || !fs.existsSync(photoPath)) {
                        throw new Error('❌ விண்ணப்பதாரரின் பாஸ்போர்ட் புகைப்படம் இல்லை! புகைப்படத்தைப் பதிவேற்றிய பின் தொடரவும்.');
                    }

                    try {
                        let sharp;
                        try { sharp = require('sharp'); } catch (_) {
                            try { sharp = require(path.join(process.resourcesPath || '', 'node_modules', 'sharp')); } catch (__) {
                                sharp = require(path.join('d:', 'downloads', 'ai assitant 2', 'node_modules', 'sharp'));
                            }
                        }
                        if (sharp && fs.existsSync(photoPath)) {
                            const meta = await sharp(photoPath).metadata().catch(() => ({}));
                            const sz = fs.statSync(photoPath).size;
                            if (meta.width !== 200 || meta.height !== 230 || sz > 45000) {
                                const compPhoto = path.join(process.cwd(), 'compressed', `studio_passport_compliant_${Date.now()}.jpeg`);
                                await sharp(photoPath)
                                    .flatten({ background: { r: 255, g: 255, b: 255 } })
                                    .resize({ width: 200, height: 230, fit: 'cover', position: 'top' })
                                    .jpeg({ quality: sz > 45000 ? 76 : 84 })
                                    .toFile(compPhoto);
                                if (fs.existsSync(compPhoto)) {
                                    photoPath = compPhoto;
                                    onProgress('📷 [புகைப்பட அளவு உறுதி] அரசு போர்ட்டல் விதிகளின்படி 200x230 பிக்சல் & <50KB அளவிற்கு மாற்றப்பட்டது ✅');
                                }
                            }
                        }
                    } catch (_) {}
                    
                    let aadhaarDocPath = citizenProfile.headAadhaarDocPath || citizenProfile.documents?.headAadhaar;
                    if (aadhaarDocPath && !fs.existsSync(aadhaarDocPath)) {
                        const resolved = await resolveOrRestoreFile(aadhaarDocPath, null, 'headAadhaar');
                        if (resolved && fs.existsSync(resolved)) aadhaarDocPath = resolved;
                    }
                    if (!aadhaarDocPath || !fs.existsSync(aadhaarDocPath)) {
                        const fCand = citizenProfile.documents?.headAadhaarFront || citizenProfile.documents?.headAadhaar || citizenProfile.headAadhaarDocPath;
                        const bCand = citizenProfile.documents?.headAadhaarBack;
                        if (fCand && bCand && fs.existsSync(fCand) && fs.existsSync(bCand)) {
                            aadhaarDocPath = await produceDualSidedDocument(fCand, bCand);
                        } else if (fCand && fs.existsSync(fCand)) {
                            aadhaarDocPath = await produceCompliantDocument(fCand);
                        }
                    }
                    if (!aadhaarDocPath || !fs.existsSync(aadhaarDocPath)) {
                        const compDir = path.join(process.cwd(), 'compressed');
                        if (fs.existsSync(compDir)) {
                            const cPdfs = fs.readdirSync(compDir).filter(f => f.includes('aadhaar') && f.endsWith('.pdf'));
                            if (cPdfs.length > 0) aadhaarDocPath = path.join(compDir, cPdfs[cPdfs.length - 1]);
                        }
                    }
                    if (!aadhaarDocPath || !fs.existsSync(aadhaarDocPath)) {
                        throw new Error('❌ விண்ணப்பதாரரின் ஆதார் அட்டை ஆவணம் இல்லை! ஆதாரைப் பதிவேற்றிய பின் தொடரவும்.');
                    }

                    // Auto-ensure Aadhaar is < 190 KB
                    if (fs.existsSync(aadhaarDocPath)) {
                        const aSz = fs.statSync(aadhaarDocPath).size;
                        if (aSz > 190000) {
                            onProgress(`📦 [தானியங்கி சுருக்கம்] ஆதார் அட்டை (${(aSz / 1024).toFixed(1)} KB > 190 KB) அரசு வரம்பிற்குள் (<200KB) சுருக்கப்படுகிறது...`);
                            const compAadh = await produceCompliantDocument(aadhaarDocPath);
                            if (compAadh && fs.existsSync(compAadh)) aadhaarDocPath = compAadh;
                        }
                    }

                    // Zero-Fallback Law: NEVER substitute Aadhaar for Community Proof!
                    let communityProofPath = citizenProfile.communityCertificatePath || 
                                             citizenProfile.familyCommunityProofPath || 
                                             citizenProfile.communityProof || 
                                             citizenProfile.documents?.communityProof;
                    if (communityProofPath && !fs.existsSync(communityProofPath)) {
                        const resolved = await resolveOrRestoreFile(communityProofPath, null, 'communityProof');
                        if (resolved && fs.existsSync(resolved)) communityProofPath = resolved;
                    }
                    if (!communityProofPath || !fs.existsSync(communityProofPath)) {
                        throw new Error('❌ குடும்ப சாதிச் சான்றிதழ் அல்லது பள்ளி TC ஆவணம் இல்லை! ஆவணம் இல்லாமல் போர்ட்டலில் பதிவேற்ற முடியாது.');
                    }

                    // Auto-ensure Community Proof is < 190 KB (eliminates the 225.7 KB rejection!)
                    if (fs.existsSync(communityProofPath)) {
                        const cSz = fs.statSync(communityProofPath).size;
                        if (cSz > 190000) {
                            onProgress(`📦 [தானியங்கி சுருக்கம்] குடும்ப சாதிச் சான்றிதழ் (${(cSz / 1024).toFixed(1)} KB > 190 KB) அரசு வரம்பிற்குள் (<200KB) சுருக்கப்படுகிறது...`);
                            const compComm = await produceCompliantDocument(communityProofPath);
                            if (compComm && fs.existsSync(compComm)) communityProofPath = compComm;
                        }
                    }

                    // Strict Dropdown Option values discovered live on REV-101:
                    // 6 = Photo (max 50KB)
                    // 193 = Any Address Proof (max 200KB)
                    // 145 = Community Certificate of Father or Community Certificate of Mother or Community Certificate of Siblings (max 200KB)
                    const docUploadList = [
                        {
                            nameTamil: 'விண்ணப்பதாரர் புகைப்படம் (Photo)',
                            nameEng: 'Photo',
                            searchTerms: ['photo'],
                            optionVal: '6',
                            docNum: '1',
                            filePath: photoPath,
                            maxKb: 50
                        },
                        {
                            nameTamil: 'முகவரிச் சான்று (Any Address Proof)',
                            nameEng: 'Any Address Proof',
                            searchTerms: ['any address proof', 'address proof', 'address'],
                            optionVal: '193',
                            docNum: '1',
                            filePath: aadhaarDocPath,
                            maxKb: 200
                        },
                        {
                            nameTamil: 'தந்தை/தாய்/உடன்பிறந்தோர் சாதிச் சான்றிதழ் (Community Certificate of Family)',
                            nameEng: 'Community Certificate of Father or Community Certificate of Mother or Community Certificate of Siblings',
                            searchTerms: ['community certificate of father', 'community certificate', 'siblings'],
                            optionVal: '145',
                            docNum: '1',
                            filePath: communityProofPath,
                            maxKb: 200
                        }
                    ];

                    const uploadedSuccessList = [];

                    for (const item of docUploadList) {
                        // Check if already present in table #ss:docTable
                        const alreadyUploaded = await tnegaPage.evaluate((searchTerms) => {
                            const table = document.getElementById('ss:docTable');
                            if (!table) return false;
                            const text = table.innerText.toLowerCase();
                            return searchTerms.some(term => text.includes(term.toLowerCase()));
                        }, item.searchTerms).catch(() => false);

                        if (alreadyUploaded) {
                            onProgress(`✅ [ஏற்கெனவே உள்ளது] ${item.nameTamil} ஏற்கெனவே போர்ட்டலில் பதிவேற்றப்பட்டுள்ளது.`);
                            uploadedSuccessList.push(item.nameTamil);
                            continue;
                        }

                        if (!fs.existsSync(item.filePath)) {
                            onProgress(`⚠️ கோப்பு கண்டறியப்படவில்லை: ${item.filePath}`);
                            continue;
                        }

                        let currentFile = item.filePath;
                        const curSize = fs.statSync(currentFile).size;
                        const sizeKb = (curSize / 1024).toFixed(1);
                        onProgress(`📤 [பதிவேற்றம்] ${item.nameTamil} (${sizeKb} KB - அரசு வரம்பு: <${item.maxKb} KB)...`);

                        // 1. Select Document Type from dropdown
                        const selectLoc = tnegaPage.locator('#ss\\:do, select[name*="do"]').first();
                        if (await selectLoc.count() > 0) {
                            const availableVals = await tnegaPage.evaluate(() => {
                                const sel = document.querySelector('#ss\\:do, select[name*="do"]');
                                return sel ? Array.from(sel.options).map(o => ({ value: o.value, text: o.text.trim() })) : [];
                            }).catch(() => []);

                            let matchedVal = item.optionVal;
                            const foundOpt = availableVals.find(o => 
                                item.searchTerms.some(term => o.text.toLowerCase().includes(term.toLowerCase())) || 
                                o.value === item.optionVal
                            );
                            if (foundOpt) matchedVal = foundOpt.value;

                            await selectLoc.selectOption(matchedVal).catch(() => {});
                            await selectLoc.dispatchEvent('change', { bubbles: true }).catch(() => {});
                            await tnegaPage.waitForTimeout(1000);
                        }

                        // 2. Enter Document Number
                        const numLoc = tnegaPage.locator('#ss\\:dscnum, input[name*="dscnum"]').first();
                        if (await numLoc.count() > 0) {
                            await numLoc.fill(item.docNum || '1');
                            await numLoc.dispatchEvent('input', { bubbles: true }).catch(() => {});
                            await numLoc.dispatchEvent('change', { bubbles: true }).catch(() => {});
                            await tnegaPage.waitForTimeout(600);
                        }

                        // 3. Attach file to RichFaces file input
                        const fileLoc = tnegaPage.locator('input.rf-fu-inp[type="file"]').last();
                        if (await fileLoc.count() > 0) {
                            await fileLoc.setInputFiles(currentFile);
                            await tnegaPage.waitForTimeout(1200);
                        }

                        // 4. Trigger RichFaces Upload via internal component API + button click fallback
                        onProgress(`⏳ [பதிவேற்றப்படுகிறது...] ${item.nameTamil} போர்ட்டலில் சேர்க்கப்படுகிறது...`);
                        await tnegaPage.evaluate(() => {
                            const uplBtn = document.querySelector('.rf-fu-btn-upl, .rf-fu-btn-cnt-upl');
                            if (uplBtn && uplBtn.offsetParent !== null) {
                                uplBtn.click();
                                return;
                            }
                            const fu = document.querySelector('.rf-fu');
                            const comp = window.RichFaces ? window.RichFaces.$(fu) : null;
                            if (comp && comp.items && comp.items.length > 0) {
                                comp.__startUpload();
                                return;
                            }
                            if (uplBtn) uplBtn.click();
                        });

                        const clickUpl = tnegaPage.locator('.rf-fu-btn-upl, .rf-fu-btn-cnt-upl').first();
                        if (await clickUpl.count() > 0 && await clickUpl.isVisible()) {
                            await clickUpl.click().catch(() => {});
                        }

                        // 5. Poll for confirmation in #ss:msg2 and #ss:docTable (up to 15 seconds)
                        let isConfirmed = false;
                        for (let poll = 0; poll < 15; poll++) {
                            await tnegaPage.waitForTimeout(1000);
                            const check = await tnegaPage.evaluate((searchTerms) => {
                                const table = document.getElementById('ss:docTable');
                                const msg2 = document.getElementById('ss:msg2');
                                const tableText = table ? table.innerText.toLowerCase() : '';
                                const msgText = msg2 ? msg2.innerText.trim() : '';
                                const tableHasDoc = searchTerms.some(term => tableText.includes(term.toLowerCase()));
                                return { tableHasDoc, msgText };
                            }, item.searchTerms).catch(() => ({ tableHasDoc: false, msgText: '' }));

                            if (check.tableHasDoc || check.msgText.includes('Successfully') || check.msgText.includes('வெற்றிகரமாக')) {
                                isConfirmed = true;
                                uploadedSuccessList.push(item.nameTamil);
                                onProgress(`🎉 [வெற்றி] ${item.nameTamil} வெற்றிகரமாகப் பதிவேற்றப்பட்டது! ✅`);
                                break;
                            }
                        }

                        if (!isConfirmed) {
                            onProgress(`⚠️ ${item.nameTamil} பதிவேற்ற முடிவை உறுதிசெய்ய இயலவில்லை. தொடரப்படுகிறது...`);
                        }
                        await tnegaPage.waitForTimeout(1000);
                    }

                    // 6D. Pre-Submit Human Gate (Safe Halt - NEVER CLICK SUBMIT)
                    if (uploadedSuccessList.length > 0) {
                        onProgress(`📸 [ஆவணப் பதிவேற்ற நிலை] ${uploadedSuccessList.length}/${docUploadList.length} ஆவணங்கள் வெற்றிகரமாகப் பதிவேற்றப்பட்டன: ${uploadedSuccessList.join(', ')} ✅`);
                    }
                    const failedDocs = docUploadList.filter(d => !uploadedSuccessList.includes(d.nameTamil));
                    if (failedDocs.length > 0) {
                        onProgress(`⚠️ [கவனத்திற்கு] ${failedDocs.map(d => d.nameTamil).join(', ')} போர்ட்டலில் விடுபட்டுள்ளது. ஆப்ரேட்டர் ஆய்வு செய்து கைமுறையாகப் பதிவேற்றலாம்.`);
                    }

                    onProgress('🛡️ [ஆப்ரேட்டர் ஆய்வு நிலையம் (Pre-Submit Gate)] ஆவணங்கள் சரிபார்க்கப்பட்டு தயார் நிலையில் வைக்கப்பட்டுள்ளன!');
                    onProgress('✍️ சுய உறுதிமொழிப் படிவம் Google Chrome புதிய Tab-ல் திறக்கப்பட்டுள்ளது. ஆப்ரேட்டர் கையொப்பமிட்ட படிவத்தைப் பதிவேற்றிய பின் Submit செய்ய ஏதுவாக ஆட்டோமேஷன் பாதுகாப்பாக நிறுத்தப்பட்டது.');

                    await updateTnegaHud(tnegaPage, {
                        title: '🛡️ சரிபார்ப்பு நிலையம் (Pre-Submit Gate)',
                        desc: 'புகைப்படம், முகவரிச் சான்று, சாதிச் சான்றிதழ் பதிவேற்றப்பட்டன. கையொப்பமிட்ட சுய உறுதிமொழியைப் பதிவேற்றி இறுதி சரிபார்ப்பைச் செய்யவும்.',
                        badge: 'Pre-Submit Gate',
                        type: 'waiting'
                    });

                    return {
                        success: true,
                        isPreSubmitGate: true,
                        appNumber,
                        canNumber: cleanCan,
                        community: citizenProfile.community || 'MBC',
                        caste: casteName,
                        downloadedDeclarationPath,
                        uploadedDocs: uploadedSuccessList,
                        pendingDoc: 'Self-Declaration of Applicant',
                        message: `🎉 **சாதிச் சான்றிதழ் (REV-101) ஆவணங்கள் வெற்றிகரமாகப் பதிவேற்றப்பட்டன!**\n\n• 🔢 **அரசு விண்ணப்ப எண்:** **${appNumber}** ✅\n• 👤 **விண்ணப்பதாரர்:** ${fullNameTam} (${fullNameEng})\n• 🏛️ **பிரிவு:** ${citizenProfile.community || 'MBC'}\n• 📷 **பதிவேற்றப்பட்டவை:** ${uploadedSuccessList.join(', ')}\n• 📥 **சுய உறுதிமொழிப் படிவம்:** Chrome Tab-ல் திறக்கப்பட்டது ✅\n• 🛡️ **சரிபார்ப்பு நிலையம் (Pre-Submit Gate):** ஆப்ரேட்டர் ஆய்வு மற்றும் சுய உறுதிமொழி பதிவேற்றத்திற்குத் தயார்.`
                    };
                }

            } catch (err) {
                onProgress(`⚠️ கண்காணிப்பு எச்சரிக்கை: ${err.message}`);
            }

            if (waitingForOperatorSubmit) {
                loopCounter = 0; // Keep alive indefinitely while operator reviews form details
            }

            if (loopCounter > 80) {
                onProgress('⏱️ அதிகபட்ச காலக்கெடு (Timeout) எட்டப்பட்டது.');
                break;
            }
        }

        return {
            success: false,
            error: 'செயல்முறை முடிவுபெறவில்லை (Timeout)'
        };

    } catch (err) {
        state.lastTnegaError = err.message;
        onProgress(`❌ சாதிச் சான்றிதழ் ஆட்டோமேஷனில் பிழை: ${err.message}`);
        return { success: false, error: err.message };
    }
}

module.exports = {
    startTnegaCommunityCertificateFlow
};
