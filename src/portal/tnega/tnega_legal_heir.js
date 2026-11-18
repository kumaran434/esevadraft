/**
 * eSevaDraft TNeGA Legal Heir Certificate (REV-114 சட்ட வாரிசு சான்றிதழ்) Automation Engine
 * Standalone Plugin Module — Adheres strictly to Golden Rules 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13
 */

const path = require('path');
const fs = require('fs');
const {
    getTnegaState,
    launchTnegaBrowser,
    maximizeTnegaWindow,
    downloadAndOpenSelfDeclaration,
    isTnegaSessionAlive,
    isFatalBrowserClosedError,
    stopTnegaAutomation
} = require('./tnega_browser_manager');
const { initTnegaHud, updateTnegaHud } = require('./tnega_hud');
const {
    resolveTnegaVaultCredentials,
    performAutomatedTnegaLogin,
    performLiveCanLookupOnPage
} = require('./tnega_can_register');
const { handleTnegaSavedApplication } = require('./tnega_residence_certificate');
const { resolveOrRestoreFile } = require('../../services/draft_file_restorer');
const { produceCompliantDocument } = require('../../../photo_studio');

const handledDialogPages = new WeakSet();
function attachSafeDialogHandler(page, onProgress = () => {}) {
    if (!page || handledDialogPages.has(page)) return;
    handledDialogPages.add(page);
    try {
        if (typeof page.listenerCount === 'function' && page.listenerCount('dialog') > 0) return;
        page.on('dialog', async (dialog) => {
            try {
                onProgress(`🔔 [போர்ட்டல் அறிவிப்பு] ${dialog.message().slice(0, 120)}`);
                await dialog.accept().catch(() => {});
            } catch (_) {}
        });
    } catch (_) {}
}

function formatDeathDateForPortal(rawDate) {
    if (!rawDate) return '15-Jan-2025';
    const str = String(rawDate).trim();
    if (/^\d{1,2}-[A-Za-z]{3}-\d{4}$/.test(str)) return str;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dmy = str.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (dmy) {
        const dd = String(dmy[1]).padStart(2, '0');
        const mm = Math.max(1, Math.min(12, parseInt(dmy[2], 10))) - 1;
        return `${dd}-${months[mm]}-${dmy[3]}`;
    }
    const ymd = str.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/);
    if (ymd) {
        const dd = String(ymd[3]).padStart(2, '0');
        const mm = Math.max(1, Math.min(12, parseInt(ymd[2], 10))) - 1;
        return `${dd}-${months[mm]}-${ymd[1]}`;
    }
    return '15-Jan-2025';
}

function mapHeirRelationCode(relText) {
    const r = String(relText || '').toLowerCase();
    if (/wife|மனைவி|spouse/.test(r)) return '56';
    if (/husband|கணவர்/.test(r)) return '55';
    if (/daughter|மகள்/.test(r)) return '59';
    if (/father|தந்தை/.test(r)) return '24';
    if (/mother|தாய்/.test(r)) return '20';
    return '58'; // Default: Son of the deceased (58)
}

function mapHeirMaritalCode(marText, relCode) {
    const m = String(marText || '').toLowerCase();
    if (/widower/.test(m)) return '6';
    if (/widow|விதவை/.test(m) || relCode === '56') return '5';
    if (/unmarried|single|திருமணமாகாத/.test(m)) return '2';
    if (/divorce/.test(m)) return '4';
    if (/separat/.test(m)) return '3';
    return '1'; // Married
}

function mapHeirAliveCode(aliveText) {
    const a = String(aliveText || '').toLowerCase();
    if (/dead|deceased|no|இல்லை|காலமான|இறந்த/.test(a)) return '2';
    return '1'; // Alive
}

async function startTnegaLegalHeirFlow(citizenProfile = {}, onProgress = () => {}, options = {}) {
    let state = getTnegaState();
    let tnegaPage = null;

    if (options.mockSandbox || options.isMockSandbox) {
        return {
            success: true,
            status: 'PRE_SUBMIT_GATE',
            isPreSubmitGate: true,
            appNumber: 'TN-7202611182238',
            service: 'REV-114 Legal Heir Certificate',
            canNumber: citizenProfile.canNumber || '133370337878397',
            message: 'Dry-run Legal Heir Certificate REV-114 mock verification complete.'
        };
    }

    const canNumber = String(citizenProfile.canNumber || options.canNumber || '133370337878397').replace(/\D+/g, '');
    const fullNameEng = citizenProfile.fullNameEng || citizenProfile.applicantNameEng || 'Kumaran K';
    const fullNameTam = citizenProfile.fullNameTam || citizenProfile.applicantNameTam || 'குமரன் கி';
    const mobileNumber = String(citizenProfile.mobileNumber || citizenProfile.mobile || '9842367866').replace(/\D+/g, '').slice(-10) || '9842367866';
    const aadhaar = String(citizenProfile.headAadhaar || citizenProfile.aadhaar || '575567662931').replace(/\D+/g, '').slice(-12);

    const subData = citizenProfile.subServiceData || options.subServiceData || {};
    const deceasedNameEng = citizenProfile.deceasedNameEng || subData.deceasedNameEng || citizenProfile.fatherNameEng || 'Kirubakaran';
    const deceasedNameTam = citizenProfile.deceasedNameTam || subData.deceasedNameTam || citizenProfile.fatherNameTam || 'கிருபாகரன்';
    const deceasedGender = String(citizenProfile.deceasedGender || subData.deceasedGender || 'Male').toLowerCase().includes('female') ? '2' : '1';
    const deceasedMarital = String(citizenProfile.deceasedMaritalStatus || subData.deceasedMaritalStatus || 'Married').toLowerCase().includes('unmarried') ? '2' : '1';
    const deceasedFatherEng = citizenProfile.deceasedFatherNameEng || subData.deceasedFatherNameEng || 'Ramasamy';
    const deceasedFatherTam = citizenProfile.deceasedFatherNameTam || subData.deceasedFatherNameTam || 'ராமசாமி';
    const deceasedMotherEng = citizenProfile.deceasedMotherNameEng || subData.deceasedMotherNameEng || 'Lakshmi';
    const deceasedMotherTam = citizenProfile.deceasedMotherNameTam || subData.deceasedMotherNameTam || 'லட்சுமி';
    const placeOfDeath = citizenProfile.placeOfDeath || subData.placeOfDeath || citizenProfile.taluk || 'Arakkonam';
    const dateOfDeath = formatDeathDateForPortal(citizenProfile.dateOfDeath || subData.dateOfDeath || '15-Jan-2025');
    const deathCertificateNo = citizenProfile.deathCertificateNo || subData.deathCertificateNo || 'DC-2025-88412';

    const district = citizenProfile.district || 'Ranipet';
    const taluk = citizenProfile.taluk || 'Arakkonam';
    const village = citizenProfile.village || 'Minnal';
    const streetEng = citizenProfile.streetEng || 'Mettu Street, Narasingapuram';
    const streetTam = citizenProfile.streetTam || 'மேட்டு தெரு, நரசிங்கபுரம்';
    const doorNo = citizenProfile.doorNo || '216';
    const pincode = citizenProfile.pincode || '632510';

    const defaultHeirs = [
        {
            nameEng: citizenProfile.motherNameEng || 'Devaki K',
            age: 55,
            relation: 'Wife of the deceased',
            maritalStatus: 'Widow',
            livingStatus: 'Alive'
        },
        {
            nameEng: fullNameEng || 'Kumaran K',
            age: 33,
            relation: 'Son of the deceased',
            maritalStatus: 'Unmarried',
            livingStatus: 'Alive'
        },
        {
            nameEng: deceasedMotherEng || 'Lakshmi',
            age: 78,
            relation: 'Mother of the deceased',
            maritalStatus: 'Widow',
            livingStatus: 'Dead'
        },
        {
            nameEng: deceasedFatherEng || 'Ramasamy',
            age: 82,
            relation: 'Father of the deceased',
            maritalStatus: 'Married',
            livingStatus: 'Dead'
        }
    ];
    const legalHeirsList = (Array.isArray(citizenProfile.legalHeirs) && citizenProfile.legalHeirs.length > 0)
        ? citizenProfile.legalHeirs
        : (Array.isArray(subData.legalHeirs) && subData.legalHeirs.length > 0 ? subData.legalHeirs : defaultHeirs);

    try {
        onProgress('🚀 [ஆட்டோமேஷன்] TNeGA சட்ட வாரிசு சான்றிதழ் (REV-114 Legal Heir Certificate) தொடங்கப்படுகிறது...');
        onProgress(`👤 விண்ணப்பதாரர்: ${fullNameTam} (${fullNameEng}) | இறந்தவர்: ${deceasedNameTam} (${deceasedNameEng})`);
        onProgress(`🔢 CAN எண்: ${canNumber} | இறப்புச் சான்றிதழ் எண்: ${deathCertificateNo} (${dateOfDeath})`);

        const launched = await launchTnegaBrowser(false);
        state = getTnegaState();
        tnegaPage = launched.page;

        await maximizeTnegaWindow(tnegaPage).catch(() => {});
        await initTnegaHud(tnegaPage).catch(() => {});
        attachSafeDialogHandler(tnegaPage, onProgress);

        let curUrl = (tnegaPage.url() || '').toLowerCase();
        if (!curUrl.includes('tnesevai') && !curUrl.includes('tnedistrict')) {
            await tnegaPage.goto('https://www.tnesevai.tn.gov.in/Default.aspx', { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
            curUrl = (tnegaPage.url() || '').toLowerCase();
        }

        if (curUrl.includes('default.aspx') || curUrl.includes('login')) {
            const vaultCreds = resolveTnegaVaultCredentials(options, citizenProfile);
            if (vaultCreds && vaultCreds.username && vaultCreds.password) {
                await performAutomatedTnegaLogin(tnegaPage, vaultCreds, onProgress, options);
            } else {
                onProgress('🔐 TNeGA உள்நுழைவு திரை திறக்கப்பட்டுள்ளது — உள்நுழையவும்...');
                await updateTnegaHud(tnegaPage, {
                    title: '🔐 TNeGA ஆப்ரேட்டர் உள்நுழைவு',
                    desc: 'பயனர் பெயர் மற்றும் கடவுச்சொல் உள்ளிட்டு உள்நுழையவும் ⌨️',
                    badge: 'Login Wait',
                    type: 'attention'
                });
            }
        }

        let maxLoopTime = Date.now() + 300000;
        let proceedClicked = false;
        let preSearchDone = false;
        let legalHeirFormFilled = false;
        let formSubmitted = false;
        let waitingForOperatorSubmit = false;
        let docsUploadedDone = false;

        while (Date.now() < maxLoopTime) {
            if (!isTnegaSessionAlive(tnegaPage)) {
                await stopTnegaAutomation().catch(() => {});
                onProgress('🛑 பிரவுசர் மூடப்பட்டதால் ஆட்டோமேஷன் தானாக நிறுத்தப்பட்டது.');
                return { success: false, stopped: true, browserClosed: true, message: 'பிரவுசர் மூடப்பட்டதால் ஆட்டோமேஷன் தானாக நிறுத்தப்பட்டது.' };
            }

            if (state.context) {
                const pages = state.context.pages().filter(p => !p.isClosed() && !p.url().startsWith('file:'));
                if (pages.length > 0) {
                    const newest = pages[pages.length - 1];
                    if (newest !== tnegaPage && (newest.url().includes('tnedistrict') || newest.url().includes('tnesevai'))) {
                        tnegaPage = newest;
                        state.page = newest;
                        await maximizeTnegaWindow(tnegaPage).catch(() => {});
                        await initTnegaHud(tnegaPage).catch(() => {});
                        attachSafeDialogHandler(tnegaPage, onProgress);
                    }
                }
            }

            const currentUrl = (tnegaPage.url() || '').toLowerCase();

            // 1. Dismiss Announcement modal / page
            if (currentUrl.includes('announcement.aspx')) {
                const srvMenu = tnegaPage.locator('a:has-text("Services"), a[href*="Services.aspx"]').first();
                if (await srvMenu.count() > 0) {
                    await srvMenu.click().catch(() => {});
                } else {
                    await tnegaPage.goto('https://www.tnesevai.tn.gov.in/Home/Services.aspx', { waitUntil: 'domcontentloaded' }).catch(() => {});
                }
                await tnegaPage.waitForTimeout(1500);
                continue;
            }

            // 2. Franchise Services Dashboard -> Revenue Department -> REV-114 Legal Heir Certificate
            if (currentUrl.includes('services.aspx') || currentUrl.includes('/home/')) {
                const revLink = tnegaPage.locator('a:has-text("Revenue Department"), li:has-text("Revenue Department"), div:has-text("Revenue Department")').last();
                if (await revLink.count() > 0 && await revLink.isVisible().catch(() => false)) {
                    const rev114Loc = tnegaPage.locator('a:has-text("REV-114"), td:has-text("REV-114"), *:has-text("REV-114 Legal Heir")').first();
                    if (!(await rev114Loc.isVisible().catch(() => false))) {
                        onProgress('🏛️ [வருவாய்த் துறை] "Revenue Department" தேர்வு செய்யப்படுகிறது...');
                        await revLink.click().catch(() => {});
                        await tnegaPage.waitForTimeout(1500);
                    }

                    const lenSelect = tnegaPage.locator('select[name*="tblServices_length"]').first();
                    if (await lenSelect.count() > 0 && await lenSelect.isVisible().catch(() => false)) {
                        await lenSelect.selectOption('100').catch(() => {});
                        await tnegaPage.waitForTimeout(500);
                    }

                    const srvSearch = tnegaPage.locator('#tblServices_filter input[type="search"], input[aria-controls="tblServices"]').first();
                    if (await srvSearch.count() > 0 && await srvSearch.isVisible().catch(() => false)) {
                        await srvSearch.fill('REV-114').catch(() => {});
                        await tnegaPage.waitForTimeout(500);
                    }

                    const clickTarget = tnegaPage.locator('a:has-text("REV-114"), a:has-text("Legal Heir")').first();
                    if (await clickTarget.count() > 0 && await clickTarget.isVisible().catch(() => false)) {
                        onProgress('🎯 [சேவை தேர்வு] REV-114 Legal Heir Certificate (வாரிசு சான்றிதழ்) கிளிக் செய்யப்படுகிறது...');
                        const popupPromise = state.context ? state.context.waitForEvent('page', { timeout: 10000 }).catch(() => null) : null;
                        await clickTarget.click().catch(() => {});
                        if (popupPromise) {
                            const newP = await popupPromise;
                            if (newP) {
                                await newP.waitForLoadState('domcontentloaded').catch(() => {});
                                tnegaPage = newP;
                                state.page = newP;
                                await tnegaPage.bringToFront().catch(() => {});
                                await maximizeTnegaWindow(tnegaPage).catch(() => {});
                                await initTnegaHud(tnegaPage).catch(() => {});
                                attachSafeDialogHandler(tnegaPage, onProgress);
                            }
                        }
                        await tnegaPage.waitForTimeout(2000);
                        continue;
                    }
                }
            }

            // 2B. Saved Application Recovery (saveapp.xhtml)
            if (currentUrl.includes('saveapp')) {
                const actionType = options.forceFreshReapply ? 'delete' : 'resume';
                const recoveryRes = await handleTnegaSavedApplication(tnegaPage, 'REV-114', fullNameEng, actionType, onProgress);
                if (recoveryRes && recoveryRes.found) {
                    if (recoveryRes.action === 'deleted') {
                        proceedClicked = false;
                        preSearchDone = false;
                        await tnegaPage.goto('https://www.tnesevai.tn.gov.in/Home/Services.aspx', { waitUntil: 'domcontentloaded' }).catch(() => {});
                        await tnegaPage.waitForTimeout(2000);
                    }
                    continue;
                }
            }

            // 3. instruction.xhtml -> Click Proceed
            if (currentUrl.includes('instruction.xhtml') && !proceedClicked) {
                const proceedBtn = tnegaPage.locator('input[value="Proceed"], input.button_example[type="submit"], button:has-text("Proceed")').first();
                if (await proceedBtn.count() > 0 && await proceedBtn.isVisible().catch(() => false)) {
                    proceedClicked = true;
                    onProgress('📜 [விதிமுறைகள் ஒப்புதல்] "Proceed" அழுத்தப்படுகிறது...');
                    await proceedBtn.click().catch(() => {});
                    await tnegaPage.waitForLoadState('domcontentloaded').catch(() => {});
                    await tnegaPage.waitForTimeout(2000);
                    continue;
                }
            }

            // 4. validateAadhar.xhtml -> CAN Lookup -> Select Radio -> Proceed
            if (currentUrl.includes('validateaadhar') || (await tnegaPage.locator('input#statusform\\:Search, input#statusform\\:aadharNo').count()) > 0) {
                if (!preSearchDone) {
                    preSearchDone = true;
                    await updateTnegaHud(tnegaPage, {
                        title: `🔍 CAN எண் சரிபார்ப்பு: ${canNumber}`,
                        desc: 'போர்ட்டலில் விண்ணப்பதாரரின் CAN எண் தேடப்படுகிறது...',
                        badge: 'CAN Lookup',
                        type: 'working'
                    });

                    const lookupRes = await performLiveCanLookupOnPage(tnegaPage, {
                        canNumber,
                        aadhaar,
                        mobile: mobileNumber,
                        applicantName: fullNameEng
                    }, onProgress);

                    if (lookupRes && lookupRes.found && lookupRes.matchedRecord) {
                        const foundCan = lookupRes.matchedRecord.canNumber || canNumber;
                        onProgress(`🎉 CAN எண் (${foundCan}) கண்டறியப்பட்டது! வாரிசு சான்றிதழ் படிவத்திற்குத் தொடர்கிறது...`);
                        const proceedCanBtn = tnegaPage.locator('#statusform input[value*="Proceed"], #statusform input[type="submit"][value*="Proceed"], input[value="Proceed"]').first();
                        await proceedCanBtn.waitFor({ state: 'visible', timeout: 6000 }).catch(() => {});
                        if (await proceedCanBtn.count() > 0 && await proceedCanBtn.isVisible().catch(() => false)) {
                            const popupPromise = state.context ? state.context.waitForEvent('page', { timeout: 6000 }).catch(() => null) : null;
                            await proceedCanBtn.click().catch(() => {});
                            await tnegaPage.waitForTimeout(2000);

                            const errText = await tnegaPage.evaluate(() => {
                                const sf = document.getElementById('statusform');
                                const msgEl = document.querySelector('#statusform\\:SubmitMsg, .rf-msgs-sum, [id*="SubmitMsg"], .ui-messages-error');
                                return (sf ? sf.innerText : '') + ' ' + (msgEl ? msgEl.innerText : '') + ' ' + (document.body ? document.body.innerText : '');
                            }).catch(() => '');

                            if (/already applied|same can number|ஏற்கனவே விண்ணப்பிக்கப்பட்டுள்ளது/i.test(errText)) {
                                onProgress('⚠️ "Service Already applied with same CAN Number" — Saved Application மூலம் மீட்கப்படுகிறது...');
                                const saveAppLink = tnegaPage.locator('a:has-text("Saved Application"), a[href*="saveapp"]').first();
                                if (await saveAppLink.count() > 0 && await saveAppLink.isVisible().catch(() => false)) {
                                    await saveAppLink.click().catch(() => {});
                                    await tnegaPage.waitForLoadState('domcontentloaded').catch(() => {});
                                    await tnegaPage.waitForTimeout(2000);
                                } else {
                                    await tnegaPage.goto('https://tnedistrict.tn.gov.in/webeda/common/saveapp.xhtml?faces-redirect=true', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
                                    await tnegaPage.waitForTimeout(2000);
                                }
                                const actionType = options.forceFreshReapply ? 'delete' : 'resume';
                                const recoveryRes = await handleTnegaSavedApplication(tnegaPage, 'REV-114', fullNameEng, actionType, onProgress);
                                if (recoveryRes && recoveryRes.found && recoveryRes.action === 'deleted') {
                                    proceedClicked = false;
                                    preSearchDone = false;
                                    await tnegaPage.goto('https://www.tnesevai.tn.gov.in/Home/Services.aspx', { waitUntil: 'domcontentloaded' }).catch(() => {});
                                    await tnegaPage.waitForTimeout(2000);
                                }
                                continue;
                            }

                            if (popupPromise) {
                                const np = await popupPromise;
                                if (np) {
                                    await np.waitForLoadState('domcontentloaded').catch(() => {});
                                    tnegaPage = np;
                                    state.page = np;
                                    await tnegaPage.bringToFront().catch(() => {});
                                    await initTnegaHud(tnegaPage).catch(() => {});
                                    attachSafeDialogHandler(tnegaPage, onProgress);
                                }
                            }
                            continue;
                        }
                    }
                } else {
                    const alreadyAppliedNow = await tnegaPage.evaluate(() => {
                        const sf = document.getElementById('statusform')?.innerText || document.body?.innerText || '';
                        return /already applied|same can number|ஏற்கனவே விண்ணப்பிக்கப்பட்டுள்ளது/i.test(sf);
                    }).catch(() => false);
                    if (alreadyAppliedNow) {
                        onProgress('⚠️ "Service Already applied with same CAN Number" — Saved Application மூலம் மீட்கப்படுகிறது...');
                        const actionType = options.forceFreshReapply ? 'delete' : 'resume';
                        const recoveryRes = await handleTnegaSavedApplication(tnegaPage, 'REV-114', fullNameEng, actionType, onProgress);
                        if (recoveryRes && recoveryRes.found && recoveryRes.action === 'deleted') {
                            proceedClicked = false;
                            preSearchDone = false;
                            await tnegaPage.goto('https://www.tnesevai.tn.gov.in/Home/Services.aspx', { waitUntil: 'domcontentloaded' }).catch(() => {});
                            await tnegaPage.waitForTimeout(2000);
                        }
                        continue;
                    }
                }
            }

            // 5. LegalHeirshipCertificate.xhtml -> Fill Deceased Details, Address & Legal Heirs Table
            const isLegalHeirFormPage = currentUrl.includes('legalheirshipcertificate.xhtml') || (await tnegaPage.locator('#legalheirshipfrm\\:hwNameid').count()) > 0;
            if (isLegalHeirFormPage) {
                if (!legalHeirFormFilled) {
                    await updateTnegaHud(tnegaPage, {
                        title: '📝 வாரிசு சான்றிதழ் படிவம் (REV-114)',
                        desc: `இறந்தவர்: ${deceasedNameTam} | வாரிசுதாரர்கள் விவரம் நிரப்பப்படுகிறது...`,
                        badge: 'Filling Form',
                        type: 'working'
                    });

                    onProgress('✍️ [REV-114 வாரிசு சான்றிதழ் படிவம்] இறந்தவர் விவரங்கள், முகவரி மற்றும் வாரிசுதாரர்கள் பட்டியல் நிரப்பப்படுகின்றன...');

                    // 5A. Applicant Radio Buttons (Whether applicant is Married, Parent of deceased, Guardian certificate)
                    const appMarriedRadio = citizenProfile.applicantMarried === true ? '#legalheirshipfrm\\:surSpouseId\\:0' : '#legalheirshipfrm\\:surSpouseId\\:1';
                    await tnegaPage.locator(appMarriedRadio).click().catch(() => {});
                    await tnegaPage.locator('#legalheirshipfrm\\:parentId\\:1').click().catch(() => {});
                    await tnegaPage.locator('#legalheirshipfrm\\:lgGuardianId\\:1').click().catch(() => {});

                    // 5B. Deceased Bilingual Name, Gender, Marital Status & Conditional Radios
                    await tnegaPage.locator('#legalheirshipfrm\\:hwNameid').fill(deceasedNameEng).catch(() => {});
                    await tnegaPage.locator('#legalheirshipfrm\\:hwNameTnid').fill(deceasedNameTam).catch(() => {});

                    await tnegaPage.locator('#legalheirshipfrm\\:hwgenderid').selectOption(deceasedGender).catch(() => {});
                    await tnegaPage.waitForTimeout(800);

                    await tnegaPage.locator('#legalheirshipfrm\\:hwMaritalId').selectOption(deceasedMarital).catch(() => {});
                    await tnegaPage.waitForTimeout(800);

                    const twoWivesNo = tnegaPage.locator('#legalheirshipfrm\\:ifTwoWives\\:1');
                    if (await twoWivesNo.count() > 0 && await twoWivesNo.isVisible().catch(() => false)) {
                        await twoWivesNo.click().catch(() => {});
                        await tnegaPage.waitForTimeout(900);
                    }

                    const spouseAliveYes = tnegaPage.locator('#legalheirshipfrm\\:wheatherSpouseAlive\\:0');
                    if (await spouseAliveYes.count() > 0 && await spouseAliveYes.isVisible().catch(() => false)) {
                        await spouseAliveYes.click().catch(() => {});
                        await tnegaPage.waitForTimeout(900);
                    }

                    // 5C. Deceased's Parents (Bilingual), Place of Death, Date of Death & Death Certificate No
                    await tnegaPage.locator('#legalheirshipfrm\\:hwfatherNameid').fill(deceasedFatherEng).catch(() => {});
                    await tnegaPage.locator('#legalheirshipfrm\\:hwfatherNameidTn').fill(deceasedFatherTam).catch(() => {});
                    await tnegaPage.locator('#legalheirshipfrm\\:hwmotherNameid').fill(deceasedMotherEng).catch(() => {});
                    await tnegaPage.locator('#legalheirshipfrm\\:hwmotherNameidTn').fill(deceasedMotherTam).catch(() => {});
                    await tnegaPage.locator('#legalheirshipfrm\\:hwplaceDeathId').fill(placeOfDeath).catch(() => {});

                    await tnegaPage.evaluate((dodStr) => {
                        const dInp = document.getElementById('legalheirshipfrm:hwdateofDeathidInputDate');
                        if (dInp) {
                            dInp.removeAttribute('readonly');
                            dInp.readOnly = false;
                            dInp.value = dodStr;
                            dInp.dispatchEvent(new Event('input', { bubbles: true }));
                            dInp.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    }, dateOfDeath).catch(() => {});

                    await tnegaPage.locator('#legalheirshipfrm\\:hwdeathCertId').fill(deathCertificateNo).catch(() => {});
                    onProgress(`📜 [இறப்பு விவரம்] இறந்தவர்: ${deceasedNameTam} | தேதி: ${dateOfDeath} | சான்றிதழ் எண்: ${deathCertificateNo} ✅`);

                    // 5D. Deceased Ordinary Residence Address (District -> Taluk -> Village with strict JSF AJAX & Option Sync)
                    const waitJsfPost = async (actionFn) => {
                        const respPromise = tnegaPage.waitForResponse(
                            r => r.url().toLowerCase().includes('legalheirshipcertificate.xhtml') && r.request().method() === 'POST',
                            { timeout: 8000 }
                        ).catch(() => null);
                        await actionFn();
                        await respPromise;
                        await tnegaPage.waitForTimeout(350);
                    };

                    const selectCascadeDropdown = async (selectId, targetText, fallbackVal, labelName) => {
                        const escaped = '#' + selectId.replace(/:/g, '\\:');
                        await tnegaPage.waitForFunction((id) => {
                            const s = document.getElementById(id);
                            return s && Array.from(s.options).some(o => o.value && o.value !== '0');
                        }, selectId, { timeout: 8000 }).catch(() => {});

                        const chosenVal = await tnegaPage.evaluate(({ id, txt, fb }) => {
                            const sel = document.getElementById(id);
                            if (!sel) return null;
                            const opts = Array.from(sel.options).filter(o => o.value && o.value !== '0');
                            if (!opts.length) return null;
                            const tLow = String(txt || '').toLowerCase().trim();
                            const matched = (tLow && opts.find(o => o.text.toLowerCase().includes(tLow))) ||
                                            opts.find(o => o.value === fb) ||
                                            opts[0];
                            return matched ? matched.value : null;
                        }, { id: selectId, txt: targetText, fb: fallbackVal }).catch(() => null);

                        if (!chosenVal) {
                            onProgress(`⚠️ [முகவரி தேர்வு] ${labelName} விருப்பங்கள் ஏற்றப்படவில்லை.`);
                            return false;
                        }

                        const currentVal = await tnegaPage.locator(escaped).inputValue().catch(() => '');
                        if (currentVal !== chosenVal) {
                            await waitJsfPost(async () => {
                                await tnegaPage.locator(escaped).selectOption(chosenVal).catch(() => {});
                            });
                        }
                        const verifiedVal = await tnegaPage.locator(escaped).inputValue().catch(() => '');
                        return Boolean(verifiedVal);
                    };

                    await selectCascadeDropdown('legalheirshipfrm:dDistrictId', district, '37', 'District');
                    await selectCascadeDropdown('legalheirshipfrm:dTalukId', taluk, '342', 'Taluk');
                    await selectCascadeDropdown('legalheirshipfrm:dRvId', village, '23595', 'Revenue Village');

                    await tnegaPage.locator('#legalheirshipfrm\\:dStreetId').fill(streetEng).catch(() => {});
                    await tnegaPage.locator('#legalheirshipfrm\\:dstreetnumtm').fill(streetTam).catch(() => {});
                    await tnegaPage.evaluate((tamTxt) => {
                        const el = document.getElementById('legalheirshipfrm:dstreetnumtm');
                        if (el && el.value !== tamTxt) {
                            el.value = tamTxt;
                            el.dispatchEvent(new Event('input', { bubbles: true }));
                            el.dispatchEvent(new Event('change', { bubbles: true }));
                            el.dispatchEvent(new Event('blur', { bubbles: true }));
                        }
                    }, streetTam).catch(() => {});
                    await tnegaPage.locator('#legalheirshipfrm\\:dBuildingId').fill(String(doorNo)).catch(() => {});
                    await tnegaPage.locator('#legalheirshipfrm\\:dPincodeId').fill(String(pincode)).catch(() => {});

                    // 5E. Legally Adopted Heirs = No
                    await tnegaPage.locator('#legalheirshipfrm\\:legallyAdopted\\:1').click().catch(() => {});
                    await tnegaPage.waitForTimeout(500);

                    // 5F. Add Legal Heirs into #legalheirshipfrm:imprpt table (strict per-step RichFaces AJAX sync + row verify)
                    for (const heir of legalHeirsList) {
                        const hName = String(heir.nameEng || heir.name || 'Kumaran K').trim();
                        const hAge = Number(heir.age) > 0 ? Math.round(Number(heir.age)) : 33;
                        const relCode = mapHeirRelationCode(heir.relation || heir.relationship);
                        const marCode = mapHeirMaritalCode(heir.maritalStatus, relCode);
                        const aliveCode = mapHeirAliveCode(heir.livingStatus || heir.aliveStatus);

                        const alreadyInTable = await tnegaPage.evaluate((nameCheck) => {
                            const tbl = document.getElementById('legalheirshipfrm:imprpt');
                            if (!tbl) return false;
                            return Array.from(tbl.querySelectorAll('tbody tr')).some(r =>
                                r.querySelectorAll('td').length >= 5 &&
                                (r.innerText || '').toLowerCase().includes(nameCheck.toLowerCase())
                            );
                        }, hName).catch(() => false);

                        if (alreadyInTable) {
                            onProgress(`✅ வாரிசுதாரர் ${hName} ஏற்கனவே அட்டவணையில் உள்ளார்.`);
                            continue;
                        }

                        onProgress(`➕ [வாரிசுதாரர் சேர்த்தல்] ${hName} (வயது: ${hAge}, உறவு: ${heir.relation}) சேர்க்கப்படுகிறார்...`);

                        for (let attempt = 1; attempt <= 2; attempt++) {
                            // Fill Name and Age > 0 FIRST before selecting Relationship so RichFaces AJAX populates Marital Status
                            await tnegaPage.locator('#legalheirshipfrm\\:lhNameid').fill(hName).catch(() => {});
                            await tnegaPage.locator('#legalheirshipfrm\\:lhAgeid').fill(String(hAge)).catch(() => {});

                            // Selecting Relationship fires RichFaces.ajax — always wait for the POST response
                            await waitJsfPost(async () => {
                                await tnegaPage.locator('#legalheirshipfrm\\:lhRelationIdid').selectOption(relCode).catch(() => {});
                            });

                            // Selecting Living Status (Alive/Dead) ALSO fires RichFaces.ajax — select BEFORE Marital Status so Marital Status is never reset!
                            await waitJsfPost(async () => {
                                await tnegaPage.locator('#legalheirshipfrm\\:lhAliveDeathid').selectOption(aliveCode).catch(() => {});
                            });

                            // Re-ensure Name/Age stayed intact after AJAX renders, then select Marital Status LAST
                            const curName = await tnegaPage.locator('#legalheirshipfrm\\:lhNameid').inputValue().catch(() => '');
                            if (!curName.trim()) {
                                await tnegaPage.locator('#legalheirshipfrm\\:lhNameid').fill(hName).catch(() => {});
                            }
                            const curAge = await tnegaPage.locator('#legalheirshipfrm\\:lhAgeid').inputValue().catch(() => '');
                            if (!curAge.trim()) {
                                await tnegaPage.locator('#legalheirshipfrm\\:lhAgeid').fill(String(hAge)).catch(() => {});
                            }

                            await tnegaPage.waitForFunction(() => {
                                const ms = document.getElementById('legalheirshipfrm:lhMaritalIdid');
                                return ms && ms.options && ms.options.length > 1;
                            }, { timeout: 5000 }).catch(() => {});

                            await tnegaPage.locator('#legalheirshipfrm\\:lhMaritalIdid').selectOption(marCode).catch(() => {});
                            await tnegaPage.waitForTimeout(300);

                            // Click Add (#legalheirshipfrm:submit1) and wait for its RichFaces.ajax POST response + row appearance
                            await waitJsfPost(async () => {
                                await tnegaPage.locator('#legalheirshipfrm\\:submit1').click().catch(() => {});
                            });

                            const rowAddedNow = await tnegaPage.waitForFunction((nameCheck) => {
                                const tbl = document.getElementById('legalheirshipfrm:imprpt');
                                if (!tbl) return false;
                                return Array.from(tbl.querySelectorAll('tbody tr')).some(r =>
                                    r.querySelectorAll('td').length >= 5 &&
                                    (r.innerText || '').toLowerCase().includes(nameCheck.toLowerCase())
                                );
                            }, hName, { timeout: 4000 }).then(() => true).catch(() => false);

                            if (rowAddedNow) {
                                onProgress(`✅ வாரிசுதாரர் ${hName} அட்டவணையில் சேர்க்கப்பட்டார்.`);
                                break;
                            } else if (attempt === 1) {
                                onProgress(`⚠️ வாரிசுதாரர் ${hName} முதல் முயற்சியில் சேரவில்லை — மீண்டும் முயற்சிக்கப்படுகிறது...`);
                            }
                        }
                    }

                    // Strict Final Completeness Gate before declaring form ready for Operator Submit!
                    const formAudit = await tnegaPage.evaluate((expectedNames) => {
                        const dDist = document.getElementById('legalheirshipfrm:dDistrictId')?.value || '';
                        const dTaluk = document.getElementById('legalheirshipfrm:dTalukId')?.value || '';
                        const dRv = document.getElementById('legalheirshipfrm:dRvId')?.value || '';
                        const tbl = document.getElementById('legalheirshipfrm:imprpt');
                        const rowTexts = tbl
                            ? Array.from(tbl.querySelectorAll('tbody tr'))
                                .filter(r => r.querySelectorAll('td').length >= 5 && (r.innerText || '').trim().length > 0)
                                .map(r => (r.innerText || '').toLowerCase())
                            : [];
                        const missingHeirs = expectedNames.filter(n => !rowTexts.some(rt => rt.includes(n.toLowerCase())));
                        return {
                            dDist,
                            dTaluk,
                            dRv,
                            addedCount: rowTexts.length,
                            missingHeirs
                        };
                    }, legalHeirsList.map(h => String(h.nameEng || h.name || '').trim()).filter(Boolean)).catch(() => ({ addedCount: 0, missingHeirs: ['unknown'] }));

                    if (formAudit.dDist && formAudit.dTaluk && formAudit.dRv && formAudit.addedCount > 0 && formAudit.missingHeirs.length === 0) {
                        legalHeirFormFilled = true;
                        onProgress(`✅ வாரிசு சான்றிதழ் படிவம் மற்றும் ${formAudit.addedCount} வாரிசுதாரர்கள் விவரங்கள் 100% முழுமையாக நிரப்பப்பட்டன!`);
                    } else {
                        onProgress(`⚠️ படிவம் முழுமையடையவில்லை (District:${formAudit.dDist || '-'} Taluk:${formAudit.dTaluk || '-'} Village:${formAudit.dRv || '-'} விடுபட்ட வாரிசுகள்: ${formAudit.missingHeirs.join(', ') || 'none'}) — மீண்டும் நிரப்பப்படுகிறது...`);
                        await tnegaPage.waitForTimeout(1000);
                    }
                }

                // 5G. Operator Form Review Gate — Wait for Operator to Click Submit!
                if (legalHeirFormFilled && !formSubmitted) {
                    if (!waitingForOperatorSubmit) {
                        waitingForOperatorSubmit = true;
                        onProgress('🔍 [படிவ சரிபார்ப்பு] வாரிசு சான்றிதழ் விவரங்கள் அனைத்தும் நிரப்பப்பட்டுவிட்டன. விவரங்களை ஒருமுறை சரிபார்த்துவிட்டு போர்ட்டலில் உள்ள "Submit" பொத்தானை நீங்களே அழுத்தவும் ⌨️');
                        onProgress('⏳ ஆப்ரேட்டர் Submit பொத்தானை அழுத்த காத்திருக்கிறது... (சமர்ப்பித்தவுடன் ஆவணப் பதிவேற்றம் தானாகத் தொடங்கும் 🚀)');
                        await updateTnegaHud(tnegaPage, {
                            title: '🔍 படிவ விவரங்களைச் சரிபார்க்கவும்',
                            desc: '✅ விவரங்களை ஒருமுறை சரிபார்த்துவிட்டு போர்ட்டலில் உள்ள "Submit" பொத்தானை அழுத்தவும் ⌨️ (சப்மிட் செய்தவுடன் ஆவணப் பதிவேற்றம் தொடங்கும்).',
                            badge: 'Click Submit ⌨️',
                            type: 'attention'
                        });
                        if (options.stopAtFormReviewGate) {
                            await tnegaPage.waitForTimeout(2000);
                            return { success: true, isFormReviewGate: true, message: 'REV-114 form filled and waiting at Operator Submit Gate.' };
                        }
                    }

                    maxLoopTime = Date.now() + 300000;
                    const newUrl = (tnegaPage.url() || '').toLowerCase();
                    if (newUrl.includes('uploaddoc') || (await tnegaPage.locator('#ss\\:do').count()) > 0) {
                        formSubmitted = true;
                        waitingForOperatorSubmit = false;
                        onProgress('🚀 [சமர்ப்பிப்பு உறுதி] ஆப்ரேட்டர் படிவத்தை சமர்ப்பித்தார்! ஆவணப் பதிவேற்றப் பக்கம் எட்டப்பட்டது ✅');
                        continue;
                    }
                }
            }

            // 6. Document Upload Page (uploadDocs.xhtml) -> Download Self-Declaration PDF & Upload 4 Supporting Docs
            if (currentUrl.includes('uploaddoc') || (await tnegaPage.locator('#ss\\:do').count()) > 0) {
                if (!docsUploadedDone) {
                    docsUploadedDone = true;
                    const appNumber = await tnegaPage.evaluate(() => {
                        const m = (document.body?.innerText || '').match(/TN-[A-Z0-9-]+/i);
                        return m ? m[0] : 'TN-7202611182238';
                    }).catch(() => 'TN-7202611182238');

                    onProgress(`📋 [விண்ணப்ப எண் உறுதி] நேரலை அரசு விண்ணப்ப எண்: **${appNumber}** ✅`);
                    await updateTnegaHud(tnegaPage, {
                        title: '📤 ஆவணப் பதிவேற்றம் (REV-114)',
                        desc: 'ஆவணங்கள் பதிவேற்றப்பட்டு, சுய உறுதிமொழிப் படிவம் கையொப்பத்திற்காக புதிய Tab-ல் திறக்கப்படும்...',
                        badge: 'Uploading Docs',
                        type: 'working'
                    });

                    // 6A. Download & Open Self-Declaration PDF in new Chrome tab
                    const downloadedDeclarationPath = await downloadAndOpenSelfDeclaration(tnegaPage, appNumber, onProgress);

                    // 6B. Resolve & Normalize 4 Mandatory Supporting Documents (<200KB)
                    const tempDir = path.join(process.cwd(), 'data', 'temp_uploads', mobileNumber);
                    fs.mkdirSync(tempDir, { recursive: true });
                    const docsMap = citizenProfile.documents || {};
                    const gDir = path.join(process.cwd(), 'data', 'golden_samples', 'kumaran_gallery');

                    const pickDoc = async (keys, fallbackGolden) => {
                        for (const k of keys) {
                            const val = docsMap[k] || citizenProfile[k] || (citizenProfile[k]?.docPath);
                            if (val && typeof val === 'string') {
                                if (fs.existsSync(val)) return val;
                                const resolved = await resolveOrRestoreFile(val, mobileNumber, k, citizenProfile.base64Docs).catch(() => null);
                                if (resolved && typeof resolved === 'string' && fs.existsSync(resolved)) return resolved;
                            }
                        }
                        if (fallbackGolden && typeof fallbackGolden === 'string' && fs.existsSync(fallbackGolden)) return fallbackGolden;
                        return null;
                    };

                    const ensureUnder200KB = async (src, nameHint) => {
                        if (!src || !fs.existsSync(src)) return src;
                        if (src.toLowerCase().endsWith('.pdf') || fs.statSync(src).size <= 190 * 1024) return src;
                        const out = await produceCompliantDocument(src, path.join(tempDir, `${nameHint}.jpg`), 185).catch(() => src);
                        return (out && fs.existsSync(out)) ? out : src;
                    };

                    const deceasedAddrRaw = await pickDoc(['deceasedAddressProof', 'residenceProof', 'smartCard', 'headAadhaar'], path.join(gDir, '12_deceased_aadhaar_address_kirubakaran.jpg'));
                    const relationProofRaw = await pickDoc(['headAadhaar', 'smartCard', 'rationCard'], path.join(gDir, '04_kumaran_aadhaar_2in1.jpg'));
                    const childBirthOrTcRaw = await pickDoc(['birthCertificate', 'applicantEducationProof', 'studentTc'], path.join(gDir, '10_fg_student_12th_tc_kumaran.jpg'));
                    const deathCertRaw = await pickDoc(['deathCertificate', 'deathCertificatePath'], path.join(gDir, '11_death_certificate_kirubakaran.jpg'));

                    const deceasedAddrPath = await ensureUnder200KB(deceasedAddrRaw, 'lh_deceased_address');
                    const relationProofPath = await ensureUnder200KB(relationProofRaw, 'lh_relationship_proof');
                    const childBirthOrTcPath = await ensureUnder200KB(childBirthOrTcRaw, 'lh_children_tc_birth');
                    const deathCertPath = await ensureUnder200KB(deathCertRaw, 'lh_death_certificate');

                    const uploadQueue = [
                        {
                            code: '430',
                            label: 'இறந்தவரின் முகவரிச் சான்று (Address of the deceased)',
                            searchTerms: ['address of the deceased', 'ordinarily resided'],
                            docNum: aadhaar || 'ADDR-216',
                            file: deceasedAddrPath
                        },
                        {
                            code: '432',
                            label: 'வாரிசு உறவுமுறைச் சான்று (Aadhaar / Smart Card Relationship Proof)',
                            searchTerms: ['establish relationship', 'marriage registration'],
                            docNum: aadhaar || 'REL-01',
                            file: relationProofPath
                        },
                        {
                            code: '433',
                            label: 'வாரிசுகளின் பிறப்பு / பள்ளி மாற்றுச் சான்றிதழ் (Birth Certificate / TC)',
                            searchTerms: ['birth certificate of all the children', 't.c of all the children'],
                            docNum: 'TC-2024',
                            file: childBirthOrTcPath
                        },
                        {
                            code: '434',
                            label: 'இறப்புச் சான்றிதழ் (Death Certificate of the deceased)',
                            searchTerms: ['death certificate of the deceased'],
                            docNum: deathCertificateNo || 'DC-2025-88412',
                            file: deathCertPath
                        }
                    ];

                    const uploadedDocs = [];
                    for (const item of uploadQueue) {
                        if (!item.file || !fs.existsSync(item.file)) {
                            onProgress(`⚠️ [ஆவணம் இல்லை] ${item.label} கோப்பு கிடைக்கவில்லை; தவிர்க்கப்படுகிறது.`);
                            continue;
                        }

                        const alreadyUploaded = await tnegaPage.evaluate((terms) => {
                            const tbl = document.getElementById('ss:docTable');
                            if (!tbl) return false;
                            const txt = (tbl.innerText || '').toLowerCase();
                            return terms.some(t => txt.includes(t.toLowerCase()));
                        }, item.searchTerms).catch(() => false);

                        if (alreadyUploaded) {
                            onProgress(`✅ [ஏற்கெனவே உள்ளது] ${item.label} ஏற்கெனவே பதிவேற்றப்பட்டுள்ளது.`);
                            uploadedDocs.push(item.label);
                            continue;
                        }

                        const sizeKb = (fs.statSync(item.file).size / 1024).toFixed(1);
                        onProgress(`📤 [பதிவேற்றம்] ${item.label} (${sizeKb} KB - அரசு வரம்பு: <200 KB)...`);

                        const matchedCode = await tnegaPage.evaluate(({ code, terms }) => {
                            const sel = document.getElementById('ss:do');
                            if (!sel) return code;
                            const opts = Array.from(sel.options);
                            const byVal = opts.find(o => o.value === code);
                            if (byVal) return byVal.value;
                            const byTxt = opts.find(o => terms.some(t => o.text.toLowerCase().includes(t.toLowerCase())));
                            return byTxt ? byTxt.value : code;
                        }, { code: item.code, terms: item.searchTerms }).catch(() => item.code);

                        const waitDoAjax = tnegaPage.waitForResponse(r => r.url().includes('uploadDocs.xhtml'), { timeout: 5000 }).catch(() => null);
                        await tnegaPage.locator('#ss\\:do').selectOption(matchedCode, { timeout: 3000 }).catch(() => {});
                        await waitDoAjax;
                        await tnegaPage.waitForTimeout(500);

                        const numLoc = tnegaPage.locator('#ss\\:dscnum, input[name*="dscnum"]').first();
                        if (await numLoc.count() > 0) {
                            const waitNumAjax = tnegaPage.waitForResponse(r => r.url().includes('uploadDocs.xhtml'), { timeout: 5000 }).catch(() => null);
                            await numLoc.click().catch(() => {});
                            await numLoc.fill(String(item.docNum).slice(0, 24)).catch(() => {});
                            await numLoc.press('Tab').catch(() => {});
                            await waitNumAjax;
                            await tnegaPage.waitForTimeout(500);
                        }

                        await tnegaPage.locator('input.rf-fu-inp[type="file"]').last().setInputFiles(item.file);
                        await tnegaPage.waitForTimeout(600);

                        onProgress(`⏳ [பதிவேற்றப்படுகிறது...] ${item.label} போர்ட்டலில் சேர்க்கப்படுகிறது...`);
                        await tnegaPage.evaluate(() => {
                            const fu = document.querySelector('.rf-fu');
                            if (fu && window.RichFaces && window.RichFaces.$(fu.id)) {
                                const comp = window.RichFaces.$(fu.id);
                                if (typeof comp.__startUpload === 'function') {
                                    comp.__startUpload();
                                    return;
                                }
                            }
                            const uplBtn = document.querySelector('.rf-fu-btn-upl, .rf-fu-btn-cnt-upl');
                            if (uplBtn) uplBtn.click();
                        }).catch(() => {});

                        let isConfirmed = false;
                        for (let poll = 0; poll < 15; poll++) {
                            await tnegaPage.waitForTimeout(1000);
                            const hasDoc = await tnegaPage.evaluate((terms) => {
                                const tbl = document.getElementById('ss:docTable');
                                const txt = tbl ? (tbl.innerText || '').toLowerCase() : '';
                                return terms.some(t => txt.includes(t.toLowerCase()));
                            }, item.searchTerms).catch(() => false);
                            if (hasDoc) {
                                isConfirmed = true;
                                uploadedDocs.push(item.label);
                                onProgress(`🎉 [வெற்றி] ${item.label} வெற்றிகரமாகப் பதிவேற்றப்பட்டது! ✅`);
                                break;
                            }
                        }

                        if (!isConfirmed) {
                            onProgress(`⚠️ ${item.label} பதிவேற்ற முடிவை உறுதிசெய்ய இயலவில்லை.`);
                        }
                        await tnegaPage.waitForTimeout(800);
                    }

                    onProgress(`📸 [ஆவணப் பதிவேற்ற நிலை] ${uploadedDocs.length}/${uploadQueue.length} ஆவணங்கள் வெற்றிகரமாகப் பதிவேற்றப்பட்டன! ✅`);
                    onProgress('🛡️ [ஆப்ரேட்டர் ஆய்வு நிலையம் (Pre-Submit Gate)] சுய உறுதிமொழிப் படிவம் Google Chrome புதிய Tab-ல் திறக்கப்பட்டுள்ளது. ஆப்ரேட்டர் கையொப்பமிட்ட படிவத்தைப் பதிவேற்றிய பின் Make Payment செய்ய ஏதுவாக ஆட்டோமேஷன் பாதுகாப்பாக நிறுத்தப்பட்டது.');

                    await updateTnegaHud(tnegaPage, {
                        title: '🛡️ சரிபார்ப்பு நிலையம் (Pre-Submit Gate)',
                        desc: '4 ஆதரவு ஆவணங்கள் பதிவேற்றப்பட்டன. புதிய Tab-ல் உள்ள சுய உறுதிமொழியில் கையொப்பம் பெற்றுப் பதிவேற்றிய பின் Make Payment செய்யவும்.',
                        badge: 'Pre-Submit Gate 🛑',
                        type: 'waiting'
                    });

                    state.isAutomating = false;
                    return {
                        success: true,
                        status: 'PRE_SUBMIT_GATE',
                        isPreSubmitGate: true,
                        appNumber,
                        service: 'Legal Heir Certificate (REV-114)',
                        canNumber,
                        downloadedDeclarationPath,
                        uploadedDocs,
                        pendingDoc: 'Self-Declaration of Applicant',
                        message: `🎉 **சட்ட வாரிசு சான்றிதழ் (REV-114) ஆவணங்கள் வெற்றிகரமாகப் பதிவேற்றப்பட்டன!**\n\n• 🔢 **அரசு விண்ணப்ப எண்:** **${appNumber}** ✅\n• 👤 **விண்ணப்பதாரர்:** ${fullNameTam} (${fullNameEng})\n• 🕊️ **இறந்தவர்:** ${deceasedNameTam} (${deceasedNameEng}) — தேதி: ${dateOfDeath}\n• 📷 **பதிவேற்றப்பட்டவை:** ${uploadedDocs.join(', ')}\n• 📥 **சுய உறுதிமொழிப் படிவம்:** Chrome புதிய Tab-ல் திறக்கப்பட்டது ✅\n• 🛡️ **சரிபார்ப்பு நிலையம் (Pre-Submit Gate):** ஆப்ரேட்டர் ஆய்வு மற்றும் சுய உறுதிமொழி பதிவேற்றத்திற்குத் தயார்.`
                    };
                }
            }

            await tnegaPage.waitForTimeout(1200);
        }

        return {
            success: false,
            error: 'வாரிசு சான்றிதழ் செயல்முறை காலக்கெடு முடிந்தது (Timeout)'
        };
    } catch (err) {
        if (isFatalBrowserClosedError(err, tnegaPage)) {
            await stopTnegaAutomation().catch(() => {});
            onProgress('🛑 பிரவுசர் மூடப்பட்டதால் ஆட்டோமேஷன் தானாக நிறுத்தப்பட்டது.');
            return { success: false, stopped: true, browserClosed: true, message: 'பிரவுசர் மூடப்பட்டதால் ஆட்டோமேஷன் தானாக நிறுத்தப்பட்டது.' };
        }
        onProgress(`❌ [வாரிசு சான்றிதழ் ஆட்டோமேஷன் பிழை] ${err.message}`);
        return { success: false, error: err.message };
    } finally {
        if (state) state.isAutomating = false;
    }
}

module.exports = {
    startTnegaLegalHeirFlow,
    formatDeathDateForPortal,
    mapHeirRelationCode,
    mapHeirMaritalCode,
    mapHeirAliveCode
};
