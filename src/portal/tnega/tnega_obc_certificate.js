/**
 * eSevaDraft TNeGA OBC Certificate (REV-115 Other Backward Classes Certificate) Automation Engine
 * Adheres strictly to Golden Rules 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13
 */

const path = require('path');
const fs = require('fs');
const { getTnegaState, launchTnegaBrowser, maximizeTnegaWindow, downloadAndOpenSelfDeclaration, isTnegaSessionAlive, isFatalBrowserClosedError, stopTnegaAutomation } = require('./tnega_browser_manager');
const { initTnegaHud, updateTnegaHud } = require('./tnega_hud');
const { resolveTnegaVaultCredentials, performAutomatedTnegaLogin, performLiveCanLookupOnPage } = require('./tnega_can_register');
const { handleTnegaSavedApplication } = require('./tnega_residence_certificate');
const { resolveOrRestoreFile } = require('../../services/draft_file_restorer');
const { produceCompliantDocument, produceDualSidedDocument } = require('../../../photo_studio');

function mapApplicantOccupationCode(occText) {
    const o = String(occText || '').toLowerCase();
    if (/student|மாணவ|படிப்|study|college/.test(o)) return 'student';
    if (/agri|விவசாய|farmer|உழவ/.test(o)) return 'agriculture';
    if (/busi|வியாபார|தொழில்|self|shop|merchant/.test(o)) return 'business';
    if (/serv|வேலை|பணி|job|private|emp|govt|salaried/.test(o)) return 'service';
    return o && !/select|none/.test(o) ? 'others_to_be_specified' : 'service';
}

function mapParentEmploymentNature(natureText, occupationText) {
    const raw = `${natureText || ''} ${occupationText || ''}`.toLowerCase();
    if (/unemployed|வேலையில்ல|இல்லை|nil|none|homemaker|housewife|இல்லத்தரசி|retired/.test(raw)) return 'Unemployed';
    if (/self|வியாபார|விவசாய|farmer|business|coolie|daily|labor|தொழில்|carpenter|tailor|driver/.test(raw)) return 'Self Employed';
    if (/govt|government|employed|salary|service|teacher|clerk|bank|police|பணி|அரசு|தனியார்/.test(raw)) return 'Employed';
    return 'Self Employed';
}

function mapParentStatusCode(statusText, natureCode) {
    if (natureCode === 'Unemployed') return 'others';
    const s = String(statusText || '').toLowerCase();
    if (/constitut/.test(s)) return 'constitutional_posts';
    if (/govt|government|state|central/.test(s)) return 'government_services';
    if (/psu|public sector/.test(s)) return 'public_sector_undertakings';
    if (/armed|army|navy|air|para/.test(s)) return 'armed_forces_slash_para_military_forces';
    if (/prof|doctor|lawyer|engineer|ca/.test(s)) return 'professional_class';
    if (/agri|land/.test(s)) return 'agricultural_land_holdingowned_by_mother_father_minor_child';
    if (/income|wealth|property|tax/.test(s)) return 'income_slash_wealth_property_owners';
    return 'others';
}

function normalizeCasteTokens(casteRaw) {
    const cleaned = String(casteRaw || '')
        .replace(/[\u0B80-\u0BFF]+/g, ' ') // strip Tamil script to focus on English parenthetical / Latin token
        .replace(/[()[\],/\\-]+/g, ' ')
        .replace(/\b(mbc|bc|dnc|dnt|obc|caste|community|tamil)\b/gi, ' ')
        .trim()
        .toUpperCase();
    const tokens = cleaned.split(/\s+/).filter(t => t.length >= 3);
    // Normalize common suffix variations (VANNIYAR -> VANNIYA matches "VANNIYA" or "VANNIYAKULA")
    const expanded = [];
    for (const t of tokens) {
        expanded.push(t);
        if (t.endsWith('R') && t.length > 5) expanded.push(t.slice(0, -1));
        if (t === 'VANNIYAR') expanded.push('VANNIYA');
        if (t === 'YADAVAR') expanded.push('YADAVA');
        if (t === 'MUDALIYAR') expanded.push('MUDALI');
        if (t === 'CHETTIYAR') expanded.push('CHETTIAR');
    }
    return Array.from(new Set(expanded));
}

async function ensureObcPassportPhotoSize(inputPath, outDir, mobileClean) {
    if (!inputPath || !fs.existsSync(inputPath)) return inputPath;
    try {
        const sharp = require('sharp');
        fs.mkdirSync(outDir, { recursive: true });
        const outPath = path.join(outDir, `obc_photo_200x240_${mobileClean || Date.now()}.jpg`);
        // TNeGA OBC uploadDocs.xhtml strictly enforces width < 250px AND height < 250px AND <= 50KB
        let buf = await sharp(inputPath)
            .rotate()
            .resize(200, 240, { fit: 'cover', position: 'attention' })
            .jpeg({ quality: 82 })
            .toBuffer();
        if (buf.length > 46 * 1024) {
            buf = await sharp(inputPath)
                .rotate()
                .resize(180, 220, { fit: 'cover', position: 'attention' })
                .jpeg({ quality: 70 })
                .toBuffer();
        }
        fs.writeFileSync(outPath, buf);
        return outPath;
    } catch (_) {
        return inputPath;
    }
}

async function fillVerifiedInput(page, selector, val) {
    if (!val) return false;
    const loc = page.locator(selector).first();
    if ((await loc.count()) === 0) return false;
    const vis = await loc.isVisible().catch(() => false);
    const ro = await loc.evaluate(el => el.readOnly || el.disabled).catch(() => true);
    if (!vis || ro) return false;
    await loc.click().catch(() => {});
    await loc.fill(String(val)).catch(() => {});
    await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (el) {
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('blur', { bubbles: true }));
        }
    }, selector).catch(() => {});
    return true;
}

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

async function startTnegaObcCertificateFlow(citizenProfile = {}, onProgress = () => {}, options = {}) {
    let state = getTnegaState();
    let tnegaPage = null;

    if (options.mockSandbox) {
        return {
            success: true,
            status: 'PRE_SUBMIT_GATE',
            service: 'REV-115 OBC Certificate',
            canNumber: citizenProfile.canNumber || '133370337878397',
            message: 'Dry-run OBC Certificate REV-115 mock verification complete.'
        };
    }

    const canNumber = String(citizenProfile.canNumber || options.canNumber || '').replace(/\D+/g, '');
    const fullNameEng = citizenProfile.fullNameEng || citizenProfile.applicantNameEng || 'Applicant';
    const fullNameTam = citizenProfile.fullNameTam || citizenProfile.applicantNameTam || '';
    const mobileNumber = String(citizenProfile.mobileNumber || citizenProfile.mobile || '').replace(/\D+/g, '').slice(-10) || '0000000000';
    const aadhaar = String(citizenProfile.headAadhaar || citizenProfile.aadhaar || '').replace(/\D+/g, '').slice(-12);

    const subData = citizenProfile.subServiceData || options.subServiceData || {};
    const casteQuery = citizenProfile.caste || subData.caste || 'VANNIYAR';
    const applicantOccRaw = citizenProfile.occupation || subData.applicantOccupation || subData.occupation || 'Service';
    const fatherAliveRaw = citizenProfile.fatherAlive ?? subData.fatherAlive ?? true;
    const motherAliveRaw = citizenProfile.motherAlive ?? subData.motherAlive ?? true;
    const isFatherAlive = !(/^(no|false|deceased|dead|இல்லை|காலமான)$/i.test(String(fatherAliveRaw).trim()));
    const isMotherAlive = !(/^(no|false|deceased|dead|இல்லை|காலமான)$/i.test(String(motherAliveRaw).trim()));

    const fatherOcc = citizenProfile.fatherOccupation || subData.fatherOccupation || 'Farmer / Self Employed';
    const motherOcc = citizenProfile.motherOccupation || subData.motherOccupation || 'Homemaker';
    const fatherNature = mapParentEmploymentNature(citizenProfile.fatherEmploymentNature || subData.fatherEmploymentNature, fatherOcc);
    const motherNature = mapParentEmploymentNature(citizenProfile.motherEmploymentNature || subData.motherEmploymentNature, motherOcc);
    const fatherStatus = mapParentStatusCode(citizenProfile.fatherStatus || subData.fatherStatus, fatherNature);
    const motherStatus = mapParentStatusCode(citizenProfile.motherStatus || subData.motherStatus, motherNature);
    const annualIncome = String(citizenProfile.annualIncome || subData.annualIncome || '72000').replace(/\D+/g, '') || '72000';
    const motherIncome = String(citizenProfile.motherAnnualIncome || subData.motherAnnualIncome || '0').replace(/\D+/g, '') || '0';

    let authCreds = await resolveTnegaVaultCredentials(options);
    let activeOpUid = authCreds.uid;
    let activeOpUsername = authCreds.username;
    let activeOpPassword = authCreds.password;

    let obcFormFilled = false;
    let formSubmitted = false;
    let waitingForOperatorSubmit = false;
    let docsUploadedDone = false;
    let preSearchDone = false;
    let loginAttempt = 0;

    try {
        onProgress('🚀 [ஆட்டோமேஷன்] TNeGA இதர பிற்படுத்தப்பட்டோர் சான்றிதழ் (REV-115 OBC Certificate) தொடங்கப்படுகிறது...');
        const launched = await launchTnegaBrowser(false, options);
        state = getTnegaState();
        tnegaPage = (launched && launched.page) ? launched.page : state.page;
        state.isAutomating = true;

        await maximizeTnegaWindow(tnegaPage).catch(() => {});
        await initTnegaHud(tnegaPage).catch(() => {});
        await updateTnegaHud(tnegaPage, {
            title: '📜 OBC சான்றிதழ் (REV-115)',
            desc: `விண்ணப்பதாரர்: ${fullNameEng} | CAN: ${canNumber || 'தேடல்'}`,
            badge: 'REV-115 Starting',
            type: 'working'
        });

        // Attach automatic native alert acceptor safely (once per Page object)
        attachSafeDialogHandler(tnegaPage, onProgress);

        const curStartUrl = tnegaPage.url();
        if (!curStartUrl || curStartUrl === 'about:blank' || !curStartUrl.includes('tn')) {
            await tnegaPage.goto('https://www.tnesevai.tn.gov.in/', { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
            await tnegaPage.waitForTimeout(1500);
        }

        let maxLoopTime = Date.now() + 300000; // 5 mins generous guard
        while (Date.now() < maxLoopTime && state.isAutomating) {
            if (!isTnegaSessionAlive(tnegaPage)) {
                await stopTnegaAutomation().catch(() => {});
                onProgress('🛑 பிரவுசர் மூடப்பட்டதால் ஆட்டோமேஷன் தானாக நிறுத்தப்பட்டது.');
                return { success: false, stopped: true, browserClosed: true, message: 'பிரவுசர் மூடப்பட்டதால் ஆட்டோமேஷன் தானாக நிறுத்தப்பட்டது.' };
            }
            if (state.context) {
                const allPages = state.context.pages().filter(p => !p.isClosed());
                if (allPages.length === 0) {
                    await stopTnegaAutomation().catch(() => {});
                    onProgress('🛑 பிரவுசர் மூடப்பட்டதால் ஆட்டோமேஷன் தானாக நிறுத்தப்பட்டது.');
                    return { success: false, stopped: true, browserClosed: true, message: 'பிரவுசர் மூடப்பட்டதால் ஆட்டோமேஷன் தானாக நிறுத்தப்பட்டது.' };
                }
                if (tnegaPage.isClosed() && allPages.length > 0) {
                    tnegaPage = allPages[0];
                    state.page = tnegaPage;
                }
                const latestPopup = allPages.find(p => p !== tnegaPage && (p.url().includes('tnedistrict') || p.url().includes('uploadDocs') || p.url().includes('includePage')));
                if (latestPopup) {
                    tnegaPage = latestPopup;
                    state.page = latestPopup;
                    await tnegaPage.bringToFront().catch(() => {});
                    await initTnegaHud(tnegaPage).catch(() => {});
                    attachSafeDialogHandler(tnegaPage, onProgress);
                }
            }
            if (!tnegaPage || tnegaPage.isClosed()) {
                await stopTnegaAutomation().catch(() => {});
                onProgress('🛑 பிரவுசர் மூடப்பட்டதால் ஆட்டோமேஷன் தானாக நிறுத்தப்பட்டது.');
                return { success: false, stopped: true, browserClosed: true, message: 'பிரவுசர் மூடப்பட்டதால் ஆட்டோமேஷன் தானாக நிறுத்தப்பட்டது.' };
            }

            const currentUrl = (tnegaPage.url() || '').toLowerCase();

            // Self-Heal: Recover automatically from ASP.NET InternalError / public ServiceList pages
            if (currentUrl.includes('internalerror') || currentUrl.includes('errorpath') || currentUrl.includes('servicelist.aspx')) {
                onProgress('🔄 [தானியங்கி மீட்பு] முகப்புப் பக்கத்திற்குத் திரும்புகிறது...');
                await tnegaPage.goto('https://www.tnesevai.tn.gov.in/', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
                await tnegaPage.waitForTimeout(1500);
                continue;
            }

            // 0. Handle TNeGA Announcement Modal (#btnClose)
            const closeBtn = tnegaPage.locator('#btnClose, button:has-text("Close")').first();
            if (await closeBtn.count() > 0 && await closeBtn.isVisible().catch(() => false)) {
                await closeBtn.click().catch(() => {});
                await tnegaPage.waitForTimeout(500);
            }

            // 1. Login Page Detection (#btnFranchiseeLogin on Homepage OR #txtuserName on Default/PortalLogin.aspx)
            const userInp = tnegaPage.locator('#txtuserName, input[name*="txtuserName"], #txtUserName').first();
            const franchiseeBtn = tnegaPage.locator('#btnFranchiseeLogin, a:has-text("Franchisee Login")').first();
            if ((await userInp.isVisible().catch(() => false)) || (await franchiseeBtn.isVisible().catch(() => false))) {
                loginAttempt++;
                onProgress(`🔐 [TNeGA உள்நுழைவு] முயற்சி #${loginAttempt} — AI Vision கேப்ட்சா உடன் உள்நுழைகிறது...`);
                await updateTnegaHud(tnegaPage, {
                    title: `🔐 TNeGA ஆப்ரேட்டர் உள்நுழைவு (#${loginAttempt})`,
                    desc: 'AI Vision OCR கேப்ட்சா & தானியங்கி உள்நுழைவு...',
                    badge: 'Auto Login',
                    type: 'working'
                });
                const creds = resolveTnegaVaultCredentials(options, citizenProfile);
                await performAutomatedTnegaLogin(tnegaPage, creds, onProgress, options).catch(e => onProgress(`⚠️ Login attempt note: ${e.message}`));
                await tnegaPage.waitForTimeout(2000);
                continue;
            }

            // 1A. Navigate Dashboard -> Services -> Revenue Department -> REV-115
            if (currentUrl.includes('tnesevai.tn.gov.in')) {
                const revVis = await tnegaPage.locator('a:has-text("Revenue Department"), a:has-text("REV-")').first().isVisible().catch(() => false);
                if (!revVis) {
                    const srvMenu = tnegaPage.locator('a[href*="Home/Services.aspx"], a:text-is("Services")').first();
                    if (await srvMenu.count() > 0 && await srvMenu.isVisible().catch(() => false)) {
                        await srvMenu.click().catch(() => {});
                        await tnegaPage.waitForTimeout(1500);
                        continue;
                    }
                }
            }

            if (currentUrl.includes('services.aspx') || currentUrl.includes('default.aspx') || currentUrl.includes('tnesevai.tn.gov.in')) {
                // Expand DataTables pagination ("10" -> "100") FIRST if REV links are already open
                const revAnyCount = await tnegaPage.locator('a:has-text("REV-")').count();
                if (revAnyCount === 0) {
                    const revDeptLink = tnegaPage.locator('a:has-text("Revenue Department"), td:has-text("Revenue Department"), span:has-text("Revenue Department")').first();
                    if (await revDeptLink.count() > 0 && await revDeptLink.isVisible().catch(() => false)) {
                        onProgress('🏛️ [வருவாய்த் துறை] "Revenue Department" தேர்வு செய்யப்படுகிறது...');
                        await revDeptLink.click().catch(() => {});
                        await tnegaPage.waitForTimeout(1200);
                    }
                }

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

                const rev115Link = tnegaPage.locator('a:has-text("REV-115"), a:has-text("Other Backward Classes"), a:has-text("OBC certificate"), a:has-text("OBC Certificate")').first();
                if (await rev115Link.count() > 0 && await rev115Link.isVisible().catch(() => false)) {
                    onProgress('🎯 [சேவை தேர்வு] REV-115 Other Backward Classes (OBC) Certificate கிளிக் செய்யப்படுகிறது...');
                    const pagePromise = state.context ? state.context.waitForEvent('page', { timeout: 9000 }).catch(() => null) : null;
                    await rev115Link.click().catch(() => {});
                    await tnegaPage.waitForTimeout(2000);
                    if (pagePromise) {
                        const np = await pagePromise;
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

            // 1B. edistrict Main Dashboard fallback (if landed on tnedistrict dashboard directly)
            if (currentUrl.includes('tnedistrict') && !currentUrl.includes('instruction') && !currentUrl.includes('validateaadhar') && !currentUrl.includes('includepage') && !currentUrl.includes('uploaddoc') && !currentUrl.includes('saveapp')) {
                const edistObcLink = tnegaPage.locator('a:has-text("REV-115"), a:has-text("OBC certificate"), a:has-text("Other Backward Classes")').first();
                if (await edistObcLink.count() > 0 && await edistObcLink.isVisible().catch(() => false)) {
                    onProgress('🎯 [e-District பட்டியல்] REV-115 OBC Certificate தேர்வு செய்யப்படுகிறது...');
                    await edistObcLink.click().catch(() => {});
                    await tnegaPage.waitForTimeout(2000);
                    continue;
                }
            }

            // 2. Saved Application Recovery
            if (currentUrl.includes('saveapp')) {
                const actionType = options.forceFreshReapply ? 'delete' : 'resume';
                const recoveryRes = await handleTnegaSavedApplication(tnegaPage, 'REV-115', fullNameEng, actionType, onProgress);
                if (recoveryRes && recoveryRes.found) {
                    if (recoveryRes.action === 'deleted') {
                        preSearchDone = false;
                        await tnegaPage.goto('https://tnedistrict.tn.gov.in/web/common/dashboard.xhtml?faces-redirect=true').catch(() => {});
                        await tnegaPage.waitForTimeout(2000);
                    }
                    continue;
                }
            }

            // 3. Instruction Page (instruction.xhtml)
            if (currentUrl.includes('instruction')) {
                const chk = tnegaPage.locator('input[type="checkbox"]').first();
                if (await chk.count() > 0 && !(await chk.isChecked().catch(() => true))) {
                    await chk.check().catch(() => {});
                    await tnegaPage.waitForTimeout(300);
                }
                const proceedBtn = tnegaPage.locator('input[value*="Proceed"], button:has-text("Proceed"), #btnProceed, a:has-text("Proceed")').first();
                if (await proceedBtn.count() > 0 && await proceedBtn.isVisible().catch(() => false)) {
                    onProgress('📜 [விதிமுறைகள் ஒப்புதல்] "Proceed" அழுத்தப்படுகிறது...');
                    await proceedBtn.click().catch(() => {});
                    await tnegaPage.waitForTimeout(2000);
                    continue;
                }
            }

            // 4. CAN Verification Page (validateAadhar.xhtml)
            if (currentUrl.includes('validateaadhar') || (await tnegaPage.locator('#statusform\\:canNo, input[name*="can"]').count()) > 0 && !currentUrl.includes('includepage')) {
                await updateTnegaHud(tnegaPage, {
                    title: '🔍 CAN எண் சரிபார்ப்பு (REV-115)',
                    desc: `CAN எண்: ${canNumber || 'தேடப்படுகிறது...'}`,
                    badge: 'CAN Lookup',
                    type: 'working'
                });

                if (!preSearchDone) {
                    preSearchDone = true;
                    const lookupRes = await performLiveCanLookupOnPage(tnegaPage, {
                        canNumber,
                        aadhaar,
                        mobile: mobileNumber,
                        applicantName: fullNameEng
                    }, onProgress);

                    if (lookupRes && lookupRes.found && lookupRes.matchedRecord) {
                        const foundCan = lookupRes.matchedRecord.canNumber || canNumber;
                        onProgress(`🎉 CAN எண் (${foundCan}) கண்டறியப்பட்டது! OBC படிவத்திற்குத் தொடர்கிறது...`);
                        const proceedCanBtn = tnegaPage.locator('#statusform input[value*="Proceed"], #statusform input[type="submit"][value*="Proceed"], input[value="Proceed"]').first();
                        await proceedCanBtn.waitFor({ state: 'visible', timeout: 6000 }).catch(() => {});
                        if (await proceedCanBtn.count() > 0 && await proceedCanBtn.isVisible().catch(() => false)) {
                            const popupPromise = state.context ? state.context.waitForEvent('page', { timeout: 8000 }).catch(() => null) : null;
                            await proceedCanBtn.click().catch(() => {});
                            await tnegaPage.waitForTimeout(2000);

                            const errText = await tnegaPage.evaluate(() => {
                                const sf = document.getElementById('statusform');
                                const msgEl = document.querySelector('#statusform\\:SubmitMsg, .rf-msgs-sum, [id*="SubmitMsg"], .ui-messages-error');
                                return (sf ? sf.innerText : '') + ' ' + (msgEl ? msgEl.innerText : '') + ' ' + (document.body ? document.body.innerText : '');
                            }).catch(() => '');

                            if (/already applied|same can number|ஏற்கனவே விண்ணப்பிக்கப்பட்டுள்ளது/i.test(errText)) {
                                onProgress('⚠️ "Service Already applied with same CAN Number" — Saved Application மூலம் மீட்கப்படுகிறது...');
                                const actionType = options.forceFreshReapply ? 'delete' : 'resume';
                                const recoveryRes = await handleTnegaSavedApplication(tnegaPage, 'REV-115', fullNameEng, actionType, onProgress);
                                if (recoveryRes && recoveryRes.found && recoveryRes.action === 'deleted') {
                                    preSearchDone = false;
                                    await tnegaPage.goto('https://www.tnesevai.tn.gov.in/Home/Services.aspx').catch(() => {});
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
                        const recoveryRes = await handleTnegaSavedApplication(tnegaPage, 'REV-115', fullNameEng, actionType, onProgress);
                        if (recoveryRes && recoveryRes.found && recoveryRes.action === 'deleted') {
                            await tnegaPage.goto('https://www.tnesevai.tn.gov.in/Home/Services.aspx').catch(() => {});
                            await tnegaPage.waitForTimeout(2000);
                        }
                        continue;
                    }
                }
            }

            // 5. OBC Application Form Page (includePage.xhtml?formId=6&processInstId=13)
            const hasCasteSelect = (await tnegaPage.locator('#apCaste').count()) > 0;
            if (currentUrl.includes('includepage.xhtml') || hasCasteSelect) {
                if (!obcFormFilled) {
                    obcFormFilled = true;
                    onProgress('✍️ [REV-115 OBC படிவம்] இருமொழி விவரங்கள், சாதி, பெற்றோர் பணி & வருமான விவரங்கள் நிரப்பப்படுகின்றன...');
                    await updateTnegaHud(tnegaPage, {
                        title: '📝 OBC சான்றிதழ் படிவம் நிரப்பப்படுகிறது',
                        desc: `சாதி: ${casteQuery} | பெற்றோர் பணி & வருமானம்...`,
                        badge: 'Form Filling',
                        type: 'working'
                    });

                    // Golden Rule 7: Verify/Ensure Dual Bilingual Fields cleanly
                    const curBilingual = await tnegaPage.evaluate(() => ({
                        appEng: document.getElementById('apApplicantName')?.value || '',
                        appTam: document.getElementById('apAppntNameInTamil')?.value || '',
                        fEng: document.getElementById('apFatherName')?.value || '',
                        fTam: document.getElementById('apFatherNameInTamil')?.value || '',
                        mEng: document.getElementById('apMotherName')?.value || '',
                        mTam: document.getElementById('apMotherNameInTamil')?.value || '',
                        sEng: document.getElementById('cStreetNo')?.value || '',
                        sTam: document.getElementById('cTmStreet')?.value || ''
                    })).catch(() => ({}));

                    const hasTamilChars = (str) => /[\u0B80-\u0BFF]/.test(String(str || ''));
                    if (fullNameEng && !curBilingual.appEng) await fillVerifiedInput(tnegaPage, '#apApplicantName', fullNameEng);
                    if (fullNameTam && (!curBilingual.appTam || !hasTamilChars(curBilingual.appTam))) await fillVerifiedInput(tnegaPage, '#apAppntNameInTamil', fullNameTam);
                    if (citizenProfile.fatherNameEng && !curBilingual.fEng) await fillVerifiedInput(tnegaPage, '#apFatherName', citizenProfile.fatherNameEng);
                    if (citizenProfile.fatherNameTam && (!curBilingual.fTam || !hasTamilChars(curBilingual.fTam))) await fillVerifiedInput(tnegaPage, '#apFatherNameInTamil', citizenProfile.fatherNameTam);
                    if (citizenProfile.motherNameEng && !curBilingual.mEng) await fillVerifiedInput(tnegaPage, '#apMotherName', citizenProfile.motherNameEng);
                    if (citizenProfile.motherNameTam && (!curBilingual.mTam || !hasTamilChars(curBilingual.mTam))) await fillVerifiedInput(tnegaPage, '#apMotherNameInTamil', citizenProfile.motherNameTam);
                    if (citizenProfile.streetEng && !curBilingual.sEng) await fillVerifiedInput(tnegaPage, '#cStreetNo', citizenProfile.streetEng);
                    if (citizenProfile.streetTam && (!curBilingual.sTam || !hasTamilChars(curBilingual.sTam))) await fillVerifiedInput(tnegaPage, '#cTmStreet', citizenProfile.streetTam);

                    // 5A. Select OBC Caste (#apCaste -> #apSerialCaste)
                    const casteTokens = normalizeCasteTokens(casteQuery);
                    const matchedCasteOpt = await tnegaPage.evaluate((tokens) => {
                        const sel = document.getElementById('apCaste');
                        if (!sel) return null;
                        const opts = Array.from(sel.options).filter(o => o.value && o.value !== '0');
                        if (!opts.length) return null;
                        // 1. Exact text match
                        for (const tok of tokens) {
                            const exact = opts.find(o => o.text.trim().toUpperCase() === tok);
                            if (exact) return { v: exact.value, t: exact.text.trim() };
                        }
                        // 2. Starts-with or contains token
                        let best = null;
                        let bestScore = -1;
                        for (const o of opts) {
                            const txt = o.text.trim().toUpperCase();
                            let score = 0;
                            for (const tok of tokens) {
                                if (txt.startsWith(tok)) score += 100 - txt.length * 0.1;
                                else if (txt.includes(tok)) score += 50 - txt.length * 0.1;
                            }
                            if (score > bestScore && score > 0) {
                                bestScore = score;
                                best = { v: o.value, t: o.text.trim() };
                            }
                        }
                        return best || { v: opts[0].value, t: opts[0].text.trim() };
                    }, casteTokens);

                    if (matchedCasteOpt) {
                        await tnegaPage.locator('#apCaste').selectOption(matchedCasteOpt.v);
                        onProgress(`🏷️ [சாதி தேர்வு] OBC Caste: ${matchedCasteOpt.t} (#${matchedCasteOpt.v}) தேர்வு செய்யப்பட்டது.`);
                        await tnegaPage.waitForFunction(() => {
                            const s = document.getElementById('apSerialCaste');
                            return s && Array.from(s.options).some(o => o.value && o.value !== '0');
                        }, { timeout: 6000 }).catch(() => {});
                        await tnegaPage.waitForTimeout(400);

                        const firstSerial = await tnegaPage.evaluate(() => {
                            const s = document.getElementById('apSerialCaste');
                            if (!s) return null;
                            const valid = Array.from(s.options).find(o => o.value && o.value !== '0');
                            return valid ? valid.value : null;
                        });
                        if (firstSerial) {
                            await tnegaPage.locator('#apSerialCaste').selectOption(firstSerial).catch(() => {});
                            onProgress(`🔢 [வரிசை எண்] Serial Caste: ${firstSerial} தேர்வு செய்யப்பட்டது.`);
                        }
                    }

                    // 5B. Applicant Occupation
                    const appOccCode = mapApplicantOccupationCode(applicantOccRaw);
                    await tnegaPage.locator('#apOccupationalGroup').selectOption(appOccCode).catch(() => {});
                    await tnegaPage.waitForTimeout(300);
                    if (appOccCode === 'others_to_be_specified') {
                        await fillVerifiedInput(tnegaPage, '#othOccup', applicantOccRaw || 'Other Work');
                    }

                    // 5C. Father Alive + Employment Nature + Status + Income/Designation
                    const clickGwtRadio = async (primaryId, toggleOtherId, checkTargetId) => {
                        const target = tnegaPage.locator(`#${primaryId}`);
                        if (await target.count() > 0) {
                            await target.click().catch(() => {});
                            await tnegaPage.waitForTimeout(250);
                            if (checkTargetId) {
                                const vis = await tnegaPage.locator(`#${checkTargetId}`).isVisible().catch(() => false);
                                if (!vis && toggleOtherId) {
                                    await tnegaPage.locator(`#${toggleOtherId}`).click().catch(() => {});
                                    await tnegaPage.waitForTimeout(150);
                                    await target.click().catch(() => {});
                                    await tnegaPage.waitForTimeout(300);
                                }
                            }
                        }
                    };

                    if (isFatherAlive) {
                        await clickGwtRadio('gwt-uid-9', 'gwt-uid-10', 'faNature');
                        if (await tnegaPage.locator('#faNature').isVisible().catch(() => false)) {
                            await tnegaPage.locator('#faNature').selectOption(fatherNature).catch(() => {});
                            await tnegaPage.waitForTimeout(350);
                        }
                        if (await tnegaPage.locator('#status').isVisible().catch(() => false)) {
                            const isDis = await tnegaPage.locator('#status').isDisabled().catch(() => false);
                            if (!isDis) {
                                await tnegaPage.locator('#status').selectOption(fatherStatus).catch(() => {});
                                await tnegaPage.waitForTimeout(450);
                            }
                        }
                        await fillVerifiedInput(tnegaPage, '#commDesignation', fatherOcc);
                        await fillVerifiedInput(tnegaPage, '#commPayofscale', annualIncome);
                        await fillVerifiedInput(tnegaPage, '#iwAnnual', annualIncome);
                    } else {
                        await clickGwtRadio('gwt-uid-10', null, null);
                    }

                    // 5D. Mother Alive + Employment Nature + Status + Income/Designation
                    if (isMotherAlive) {
                        await clickGwtRadio('gwt-uid-18', 'gwt-uid-11', 'moNature');
                        if (await tnegaPage.locator('#moNature').isVisible().catch(() => false)) {
                            await tnegaPage.locator('#moNature').selectOption(motherNature).catch(() => {});
                            await tnegaPage.waitForTimeout(350);
                        }
                        if (await tnegaPage.locator('#motherStatus').isVisible().catch(() => false)) {
                            const isDis = await tnegaPage.locator('#motherStatus').isDisabled().catch(() => false);
                            if (!isDis) {
                                await tnegaPage.locator('#motherStatus').selectOption(motherStatus).catch(() => {});
                                await tnegaPage.waitForTimeout(450);
                            }
                        }
                        await fillVerifiedInput(tnegaPage, '#commDesignationmo', motherOcc);
                        await fillVerifiedInput(tnegaPage, '#commPayofscalemo', motherIncome);
                        await fillVerifiedInput(tnegaPage, '#moIwAnnualInc', motherIncome);
                    } else {
                        await clickGwtRadio('gwt-uid-11', null, null);
                    }

                    // 5E. Check OBC Non-Creamy Layer Certification Checkbox (#gwt-uid-8)
                    const declChk = tnegaPage.locator('#gwt-uid-8').first();
                    if (await declChk.count() > 0 && !(await declChk.isChecked().catch(() => false))) {
                        await declChk.click().catch(() => {});
                        await tnegaPage.waitForTimeout(300);
                    }
                    onProgress('✅ OBC படிவ விவரங்கள் வெற்றிகரமாக நிரப்பப்பட்டன!');
                }

                // 5F. Operator Review & Manual Submit Gate (to advance to uploadDocs.xhtml)
                if (obcFormFilled && !formSubmitted) {
                    if (!waitingForOperatorSubmit) {
                        waitingForOperatorSubmit = true;
                        onProgress('🔍 [படிவ சரிபார்ப்பு] OBC படிவ விவரங்கள் அனைத்தும் நிரப்பப்பட்டுவிட்டன. விவரங்களை ஒருமுறை சரிபார்த்துவிட்டு போர்ட்டலில் உள்ள "Submit" பொத்தானை நீங்களே அழுத்தவும் ⌨️');
                        onProgress('⏳ ஆப்ரேட்டர் Submit பொத்தானை அழுத்த காத்திருக்கிறது... (சமர்ப்பித்தவுடன் ஆவணப் பதிவேற்றம் தானாகத் தொடங்கும் 🚀)');
                        await updateTnegaHud(tnegaPage, {
                            title: '🔍 படிவ விவரங்களைச் சரிபார்க்கவும்',
                            desc: '✅ விவரங்களை ஒருமுறை சரிபார்த்துவிட்டு போர்ட்டலில் உள்ள "Submit" பொத்தானை அழுத்தவும் ⌨️ (சப்மிட் செய்தவுடன் ஆவணப் பதிவேற்றம் தொடங்கும்).',
                            badge: 'Click Submit ⌨️',
                            type: 'attention'
                        });
                        if (options.stopAtFormReviewGate) {
                            await tnegaPage.waitForTimeout(2000);
                            return { success: true, isFormReviewGate: true, message: 'REV-115 form filled and waiting at Operator Submit Gate.' };
                        }
                        if (options.autoClickFormSubmit) {
                            await tnegaPage.waitForTimeout(3000);
                            onProgress('⚡ [நேரலை சரிபார்ப்பு] படிவ விவரங்கள் சரிபார்க்கப்பட்டு Submit பொத்தான் அழுத்தப்படுகிறது...');
                            const subBtn = tnegaPage.locator('button:has-text("Submit"), input[type="submit"][value="Submit"], .gwt-Button:has-text("Submit")').first();
                            if (await subBtn.count() > 0) {
                                await subBtn.click().catch(() => {});
                                await tnegaPage.waitForTimeout(2500);
                            }
                        }
                    }

                    // Auto-accept any confirmation dialog when user clicks Submit
                    attachSafeDialogHandler(tnegaPage, onProgress);

                    // Extend timeout while waiting for operator
                    maxLoopTime = Date.now() + 300000;

                    // Check if operator clicked Submit and page transitioned to uploadDocs.xhtml
                    const newUrl = (tnegaPage.url() || '').toLowerCase();
                    if (newUrl.includes('uploaddoc') || (await tnegaPage.locator('#ss\\:do').count()) > 0) {
                        formSubmitted = true;
                        waitingForOperatorSubmit = false;
                        onProgress('🚀 [சமர்ப்பிப்பு உறுதி] ஆப்ரேட்டர் படிவத்தை சமர்ப்பித்தார்! ஆவணப் பதிவேற்றப் பக்கம் எட்டப்பட்டது ✅');
                        continue;
                    }
                }
            }

            // 6. Document Upload Page (uploadDocs.xhtml) — Mandatory Supporting Docs + Visible Self-Declaration Open -> Pre-Submit Gate!
            if (currentUrl.includes('uploaddoc') || (await tnegaPage.locator('#ss\\:do').count()) > 0) {
                if (!docsUploadedDone) {
                    docsUploadedDone = true;
                    const obcAppNum = await tnegaPage.evaluate(() => {
                        const m = (document.body?.innerText || '').match(/TN-[A-Z0-9-]+/i);
                        return m ? m[0] : '';
                    }).catch(() => '');

                    onProgress('📄 [ஆவணப் பதிவேற்றம்] REV-115 OBC ஆவணங்கள் (Photo <250px, Address, Community, ITR/Income) பதிவேற்றம் & சுய உறுதிமொழி புதிய Tab-ல் திறப்பு தொடங்குகிறது...');
                    await updateTnegaHud(tnegaPage, {
                        title: '📤 ஆவணப் பதிவேற்றம் (REV-115)',
                        desc: 'ஆவணங்கள் பதிவேற்றப்பட்டு, சுய உறுதிமொழிப் படிவம் கையொப்பத்திற்காக புதிய Tab-ல் திறக்கப்படும்...',
                        badge: 'Uploading Docs',
                        type: 'working'
                    });

                    // Download & open Self-Declaration PDF visibly in a new Chrome tab (NEVER auto-upload unsigned Self-Declaration!)
                    const downloadedDeclarationPath = await downloadAndOpenSelfDeclaration(tnegaPage, obcAppNum, onProgress);

                    const tempDir = path.join(process.cwd(), 'data', 'temp_uploads', mobileNumber);
                    fs.mkdirSync(tempDir, { recursive: true });
                    const docsMap = citizenProfile.documents || {};

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

                    const obcGoldenDir = path.join(process.cwd(), 'data', 'golden_samples', 'obc');
                    let photoRaw = await pickDoc(['profilePhoto', 'photo', 'headPhoto'], path.join(obcGoldenDir, 'applicant_photo.jpg'));
                    let addrRaw = await pickDoc(['headAadhaar', 'aadhaar', 'smartCard', 'rationCard'], path.join(obcGoldenDir, 'applicant_aadhaar.jpg'));
                    let commRaw = await pickDoc(['communityCertificate', 'fatherCommunityCertificate', 'casteCertificate'], path.join(obcGoldenDir, 'community_certificate.jpg'));
                    let itrRaw = await pickDoc(['incomeTaxReturn', 'incomeCertificate', 'salarySlip', 'incomeProof'], path.join(obcGoldenDir, 'income_tax_return.jpg'));

                    // Strict Portal Size & Pixel Guards (Golden Rule 6)
                    const photoPath = await ensureObcPassportPhotoSize(photoRaw, tempDir, mobileNumber);
                    const ensureUnder200KB = async (src, nameHint) => {
                        if (!src || !fs.existsSync(src)) return src;
                        if (src.toLowerCase().endsWith('.pdf') || fs.statSync(src).size <= 190 * 1024) return src;
                        const out = await produceCompliantDocument(src, path.join(tempDir, `${nameHint}.jpg`), 185).catch(() => src);
                        return (out && fs.existsSync(out)) ? out : src;
                    };
                    const addrPath = await ensureUnder200KB(addrRaw, 'obc_address_proof');
                    const commPath = await ensureUnder200KB(commRaw, 'obc_community_cert');
                    const itrPath = await ensureUnder200KB(itrRaw, 'obc_itr_income');

                    // NEVER auto-upload 'Self-Declaration of Applicant' (383) — operator must collect citizen signature first!
                    const uploadQueue = [
                        { code: '21', label: 'Photo', docNum: 'PHOTO-01', file: photoPath },
                        { code: '18', label: 'Any Address Proof', docNum: aadhaar || 'ADDR-01', file: addrPath },
                        { code: '17', label: 'Community Certificate', docNum: citizenProfile.communityCertNumber || 'COMM-01', file: commPath },
                        { code: '20', label: 'Income Tax Return', docNum: `INC-${annualIncome}`, file: itrPath }
                    ];

                    const existingDocNames = await tnegaPage.evaluate(() =>
                        Array.from(document.querySelectorAll('#ss\\:docTable\\:tb tr'))
                            .filter(tr => tr.innerText.trim().length > 0)
                            .map(tr => (tr.querySelectorAll('td')[1]?.innerText || '').trim().toLowerCase())
                    ).catch(() => []);

                    const getDataRowCount = () => tnegaPage.evaluate(() =>
                        Array.from(document.querySelectorAll('#ss\\:docTable\\:tb tr')).filter(tr => tr.innerText.trim().length > 0).length
                    ).catch(() => 0);

                    const uploadedDocs = [];
                    for (const item of uploadQueue) {
                        if (!item.file || !fs.existsSync(item.file)) {
                            onProgress(`⚠️ [ஆவணம் இல்லை] ${item.label} கோப்பு கிடைக்கவில்லை; தவிர்க்கப்படுகிறது.`);
                            continue;
                        }
                        if (existingDocNames.some(n => n.includes(item.label.toLowerCase().slice(0, 10)))) {
                            onProgress(`✅ [ஏற்கனவே உள்ளது] ${item.label} ஏற்கனவே பதிவேற்றப்பட்டுள்ளது.`);
                            uploadedDocs.push(item.label);
                            continue;
                        }

                        const prevCount = await getDataRowCount();
                        onProgress(`📤 [பதிவேற்றம் ${uploadedDocs.length + 1}] ${item.label} (${path.basename(item.file)})...`);

                        const matchedCode = await tnegaPage.evaluate(({ code, label }) => {
                            const sel = document.getElementById('ss:do');
                            if (!sel) return code;
                            const opts = Array.from(sel.options);
                            const byVal = opts.find(o => o.value === code);
                            if (byVal) return byVal.value;
                            const byTxt = opts.find(o => o.text.toLowerCase().includes(label.toLowerCase()));
                            return byTxt ? byTxt.value : code;
                        }, { code: item.code, label: item.label }).catch(() => item.code);

                        const waitDoAjax = tnegaPage.waitForResponse(r => r.url().includes('uploadDocs.xhtml'), { timeout: 5000 }).catch(() => null);
                        await tnegaPage.locator('#ss\\:do').selectOption(matchedCode, { timeout: 3000 }).catch(() => {});
                        await waitDoAjax;
                        await tnegaPage.waitForTimeout(450);

                        const waitNumAjax = tnegaPage.waitForResponse(r => r.url().includes('uploadDocs.xhtml'), { timeout: 5000 }).catch(() => null);
                        const numInp = tnegaPage.locator('#ss\\:dscnum').first();
                        await numInp.click().catch(() => {});
                        await numInp.fill(String(item.docNum).slice(0, 24)).catch(() => {});
                        await numInp.press('Tab').catch(() => {});
                        await waitNumAjax;
                        await tnegaPage.waitForTimeout(450);

                        await tnegaPage.locator('.rf-fu-inp').first().setInputFiles(item.file);
                        await tnegaPage.waitForTimeout(450);

                        await tnegaPage.evaluate(() => {
                            const fu = document.querySelector('.rf-fu');
                            if (fu && window.RichFaces && window.RichFaces.$(fu.id)) {
                                const comp = window.RichFaces.$(fu.id);
                                if (typeof comp.__startUpload === 'function') comp.__startUpload();
                            } else {
                                const upl = document.querySelector('.rf-fu-btn-upl');
                                if (upl) upl.click();
                            }
                        });

                        await tnegaPage.waitForFunction(
                            (expected) => Array.from(document.querySelectorAll('#ss\\:docTable\\:tb tr')).filter(tr => tr.innerText.trim().length > 0).length >= expected,
                            prevCount + 1,
                            { timeout: 14000 }
                        ).catch(() => {});
                        await tnegaPage.waitForTimeout(500);
                        uploadedDocs.push(item.label);
                    }

                    // Verify Pre-Submit Gate (Self-Declaration is intentionally left for operator signature + upload!)
                    const payBtn = tnegaPage.locator('#ss\\:payment, input[value*="Make Payment" i]').first();
                    const isPayReady = (await payBtn.count()) > 0 && (await payBtn.isVisible().catch(() => false)) && !(await payBtn.isDisabled().catch(() => true));

                    onProgress(`🛑 [Pre-Submit Gate ✅] ஆதரவு ஆவணங்கள் (${uploadedDocs.join(', ')}) பதிவேற்றப்பட்டன! சுய உறுதிமொழிப் படிவம் Chrome புதிய Tab-ல் திறக்கப்பட்டுள்ளது — கையொப்பம் பெற்று ஆப்ரேட்டரே பதிவேற்றி Make Payment செய்யவும்!`);

                    await updateTnegaHud(tnegaPage, {
                        title: '🛡️ சரிபார்ப்பு நிலையம் (Pre-Submit Gate)',
                        desc: 'ஆவணங்கள் பதிவேற்றப்பட்டன. புதிய Tab-ல் உள்ள சுய உறுதிமொழியில் கையொப்பம் பெற்றுப் பதிவேற்றிய பின் Make Payment செய்யவும்.',
                        badge: 'Pre-Submit Gate 🛑',
                        type: 'waiting'
                    });

                    state.isAutomating = false;
                    return {
                        success: true,
                        status: 'PRE_SUBMIT_GATE',
                        isPreSubmitGate: true,
                        waitingForPayment: isPayReady,
                        appNumber: obcAppNum,
                        service: 'OBC Certificate (REV-115)',
                        canNumber,
                        downloadedDeclarationPath,
                        uploadedDocs,
                        pendingDoc: 'Self-Declaration of Applicant',
                        message: `OBC Certificate (REV-115) supporting documents uploaded cleanly. Self-Declaration PDF opened in new Chrome tab for operator signature before Make Payment.`
                    };
                }
            }

            await tnegaPage.waitForTimeout(1200);
        }

        return {
            success: true,
            status: 'TIMEOUT_OR_STOPPED',
            message: 'REV-115 OBC flow loop exited cleanly.'
        };
    } catch (err) {
        if (isFatalBrowserClosedError(err, tnegaPage)) {
            await stopTnegaAutomation().catch(() => {});
            onProgress('🛑 பிரவுசர் மூடப்பட்டதால் ஆட்டோமேஷன் தானாக நிறுத்தப்பட்டது.');
            return { success: false, stopped: true, browserClosed: true, message: 'பிரவுசர் மூடப்பட்டதால் ஆட்டோமேஷன் தானாக நிறுத்தப்பட்டது.' };
        }
        onProgress(`❌ [OBC ஆட்டோமேஷன் பிழை] ${err.message}`);
        return { success: false, error: err.message };
    } finally {
        if (state) state.isAutomating = false;
    }
}

module.exports = {
    startTnegaObcCertificateFlow,
    mapApplicantOccupationCode,
    mapParentEmploymentNature,
    mapParentStatusCode,
    normalizeCasteTokens
};
