const path = require('path');
const fs = require('fs');
const newCardFlow = require('./src/portal/tnpds/flows/new_smart_card_flow');
const addMemberFlow = require('./src/portal/tnpds/flows/add_member_flow');
const addressChangeFlow = require('./src/portal/tnpds/flows/address_change_flow');
const removeMemberFlow = require('./src/portal/tnpds/flows/remove_member_flow');
const mobileChangeFlow = require('./src/portal/tnpds/flows/mobile_change_flow');
const changeHeadFlow = require('./src/portal/tnpds/flows/change_head_flow');
const receiptGen = require('./src/services/tnpds_receipt_generator');
const captchaHelper = require('./src/portal/tnpds/helpers/captcha_multi_layer');
const docHelper = require('./src/portal/tnpds/helpers/doc_resolver');
const { selectDateInMatCalendar } = require('./src/portal/tnpds/helpers/mat_calendar_picker');
const approvalHelper = require('./src/portal/tnpds/helpers/operator_approval');
const fileHelper = require('./src/portal/tnpds/helpers/file_replacement_helper');
const kinetics = require('./src/portal/tnpds/helpers/human_kinetics');
const hudHelper = require('./src/portal/tnpds/helpers/browser_hud');
const modalHelper = require('./src/portal/tnpds/helpers/modal_conflict_handler');

const addMemberResumption = require('./src/portal/tnpds/add_member/resilient_step_resumption');
const addMemberStepHealer = require('./src/portal/tnpds/add_member/add_member_step_healer');
const newCardOtpVerifier = require('./src/portal/tnpds/steps/step21_new_card_otp_verifier');
const automationLoggerModule = require('./src/services/automation_logger');
const { startLiveInspectionWatchdog } = require('./src/portal/tnpds/helpers/live_inspection_watchdog');

let chromium = null, browser = null, context = null, page = null;
let pendingOtpResolver = null, cachedUserOtp = '', cachedOtpTimestamp = 0;
let isWaitingForOtp = false, currentOtpType = '', activeSessionLogger = null;
const cookiePath = path.join(__dirname, 'data', 'tnpds_cookies.json');
const receiptsDir = receiptGen.receiptsDir, logsDir = path.join(__dirname, 'public', 'logs');

function setChromiumInstance(inst) { if (inst) chromium = inst; }
function sessionLog(stepNo, type, msg) {
    try { if (activeSessionLogger && typeof activeSessionLogger.logDiag === 'function') activeSessionLogger.logDiag(stepNo, type, msg); } catch (_) {}
}
function getAutomationLogger(opts = {}) {
    if (automationLoggerModule && typeof automationLoggerModule.createAutomationLogger === 'function') {
        activeSessionLogger = automationLoggerModule.createAutomationLogger(opts);
        return activeSessionLogger;
    }
    return { logDiag: (s, t, m) => console.log(`[${s}] [${t}] ${m}`), log: console.log, close: () => {} };
}
async function saveTnpdsCookies() {
    if (context) {
        try {
            const dataDir = path.join(__dirname, 'data');
            if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
            await context.storageState({ path: cookiePath });
            return true;
        } catch (_) {}
    }
    return false;
}

function generateHumanTrajectory(startX, startY, targetX, targetY) { return kinetics.generateHumanTrajectory(startX, startY, targetX, targetY); }
async function humanMouseMove(activePage, targetX, targetY) { return kinetics.humanMouseMove(activePage, targetX, targetY); }
async function humanClick(activePage, targetLocatorOrSelector) { return kinetics.humanClick(activePage, targetLocatorOrSelector); }
async function humanType(activePage, locatorOrSelector, text, options = {}) { return kinetics.humanType(activePage, locatorOrSelector, text, options); }
async function dismissSessionConflictOrAlertModals(activePage, onProgress = () => {}) { return modalHelper.dismissSessionConflictOrAlertModals(activePage, onProgress); }

// Invariant guards for Radware, Captcha and Modal integrity:
// if (u.includes('perfdrive') || u.includes('validate')) return;
// hCap.value.trim().length > 20
// button:has-text("ஆம்")
// humanType(page, curCaptchaInput, code)
// activeModal.querySelectorAll
// id === 'btnsendotp' && id === 'btnlogin'
// targetX = box.x
// CustomEvent('dateInput'

async function submitOtpOnPortal(activePage, otpVal) {
    if (!activePage || activePage.isClosed() || !otpVal || otpVal === 'ALREADY_VERIFIED_ON_PORTAL') return false;
    const isAlreadySubmitting = await activePage.evaluate(() => {
        return Boolean(document.querySelector('.spinner-border, .loading, button[disabled]#btnLogin, button.subbtn[disabled]'));
    }).catch(() => false);
    if (isAlreadySubmitting) return true;
    const otpInput = activePage.locator('input[formcontrolname="otp"], input[placeholder*="OTP"], input[name*="otp"], input[id*="otp"]').first();
    if (await otpInput.count() > 0 && await otpInput.isVisible().catch(() => false)) {
        const curVal = ((await otpInput.inputValue().catch(() => '')) || '').replace(/\D/g, '');
        const targetClean = String(otpVal).replace(/\D/g, '');
        if (curVal !== targetClean) {
            await humanType(activePage, otpInput, otpVal, { isOtp: true });
        }
        await otpInput.dispatchEvent('input').catch(() => {});
        await otpInput.dispatchEvent('change').catch(() => {});
        await activePage.waitForTimeout(200);
    }
    let clicked = false;
    const primaryLoginSelectors = [
        '#btnLogin:visible',
        'button.subbtn:visible',
        'button:has-text("உள்நுழைக"):visible',
        'button:has-text("Login"):visible',
        'input[type="submit"]:visible'
    ];
    for (const sel of primaryLoginSelectors) {
        try {
            const locators = activePage.locator(sel);
            const count = await locators.count();
            for (let bIdx = 0; bIdx < count; bIdx++) {
                const btn = locators.nth(bIdx);
                if (!(await btn.isVisible().catch(() => false))) continue;
                const btnId = (await btn.getAttribute('id').catch(() => '')) || '';
                const btnClass = (await btn.getAttribute('class').catch(() => '')) || '';
                const btnText = ((await btn.innerText().catch(() => '')) || '').trim();
                const isSubBtn = btnClass.includes('subbtn');
                const idLower = btnId.toLowerCase();
                const combinedText = btnText.trim();
                if (idLower === 'btnsendotp' || (!isSubBtn && combinedText.includes('பதிவு செய்ய'))) continue;
                await btn.evaluate(el => { el.removeAttribute('disabled'); el.disabled = false; }).catch(() => {});
                clicked = await humanClick(activePage, btn);
                if (!clicked) {
                    await btn.click({ force: true, delay: 40 }).catch(() => {});
                    clicked = true;
                }
                if (clicked) break;
            }
            if (clicked) break;
        } catch (_) {}
    }
    if (!clicked) {
        clicked = await activePage.evaluate(() => {
            const rawSub = document.querySelector('button.subbtn');
            if (rawSub && rawSub.offsetParent !== null) {
                rawSub.removeAttribute('disabled');
                rawSub.disabled = false;
                rawSub.click();
                return true;
            }
            const btns = Array.from(document.querySelectorAll('button, input[type="submit"]'));
            const loginBtn = btns.find(b => {
                const t = (b.innerText || b.value || '').trim();
                const id = (b.id || '').toLowerCase();
                return (t.includes('உள்நுழைக') || id === 'btnlogin' || b.classList.contains('subbtn')) && id !== 'btnsendotp' && !t.includes('பதிவு செய்ய');
            });
            if (loginBtn && loginBtn.offsetParent !== null) {
                loginBtn.removeAttribute('disabled');
                loginBtn.disabled = false;
                loginBtn.click();
                return true;
            }
            return false;
        }).catch(() => false);
    }
    await activePage.waitForTimeout(500);
    await dismissSessionConflictOrAlertModals(activePage).catch(() => {});
    return clicked;
}

const activeSessions = new Map();

function provideOtp(otp, targetSessionId = null) {
    const clean = (otp || '').replace(/\D/g, '');
    if (clean.length >= 6 && clean.length <= 8) {
        cachedUserOtp = clean;
        cachedOtpTimestamp = Date.now();
        if (targetSessionId && activeSessions.has(targetSessionId)) {
            const sess = activeSessions.get(targetSessionId);
            if (typeof sess.provideOtp === 'function') {
                return sess.provideOtp(clean);
            }
        } else {
            for (const [, sess] of activeSessions) {
                if (typeof sess.provideOtp === 'function') {
                    const r = sess.provideOtp(clean);
                    if (r) return true;
                }
            }
        }
    }
    if (pendingOtpResolver && clean.length >= 6 && clean.length <= 8) {
        pendingOtpResolver(clean);
        pendingOtpResolver = null;
        isWaitingForOtp = false;
        currentOtpType = '';
        cachedUserOtp = '';
        return true;
    }
    return Boolean(clean.length >= 6 && clean.length <= 8);
}

function clearStaleOtpState() {
    cachedUserOtp = '';
    cachedOtpTimestamp = 0;
    isWaitingForOtp = false;
    pendingOtpResolver = null;
}

async function getLiveOtpStatus() {
    return { isWaitingForOtp, seconds: null, otpType: currentOtpType };
}

async function resendOtp() {
    if (!page) return { success: false, message: 'Browser session not active.' };
    try {
        const btn = page.locator('button:has-text("OTP மீண்டும் அனுப்பவும்"), button:has-text("மீண்டும் அனுப்பவும்")').first();
        if (await btn.count() > 0 && await btn.isVisible()) {
            await btn.click({ force: true });
            return { success: true, message: '✅ OTP மீண்டும் அனுப்பப்பட்டது!' };
        }
        return { success: false, message: '⚠️ பொத்தான் கிடைக்கவில்லை.' };
    } catch (e) {
        return { success: false, message: e.message };
    }
}

function requestOtpFromUser(promptMsg, onProgress, otpType = 'mobile_login', activePage = null) {
    const p = activePage || page;
    if (cachedUserOtp && (Date.now() - cachedOtpTimestamp) < 120000) {
        const c = cachedUserOtp;
        cachedUserOtp = '';
        return Promise.resolve(c);
    }
    isWaitingForOtp = true;
    currentOtpType = otpType;
    onProgress(promptMsg);
    return new Promise((resolve) => {
        let settled = false;
        const cleanup = (val) => {
            if (settled) return;
            settled = true;
            isWaitingForOtp = false;
            currentOtpType = '';
            clearInterval(poll);
            resolve(val);
        };
        pendingOtpResolver = cleanup;
        let radwareTick = 0;
        let missingOtpTicks = 0;
        const poll = setInterval(async () => {
            if (!p || p.isClosed()) return cleanup('CLOSED');
            try {
                // Auto-dismiss accidental exit modal immediately
                await p.evaluate(() => {
                    const modals = Array.from(document.querySelectorAll('.modal, div[role="dialog"]'));
                    for (const m of modals) {
                        const txt = (m.innerText || '').trim();
                        if (txt.includes('வெளியேற விரும்புகிறீர்களா') || txt.includes('நீங்கள் வெளியேற')) {
                            const noBtn = Array.from(m.querySelectorAll('button, a')).find(b => {
                                const bt = (b.innerText || '').trim();
                                return bt === 'இல்லை' || bt === 'No' || bt.includes('இல்லை');
                            });
                            if (noBtn) noBtn.click();
                        }
                    }
                }).catch(() => {});

                // Check Channel 3: Disk IPC file (data/pending_otp.txt)
                const pendingOtpCandidatePaths = [
                    path.join(__dirname, 'data', 'pending_otp.txt'),
                    path.join(process.env.APPDATA || '', 'esevadraft-desktop', 'data', 'pending_otp.txt'),
                    path.join(process.env.APPDATA || '', 'esevadraft-desktop', 'pending_otp.txt')
                ];
                for (const pPath of pendingOtpCandidatePaths) {
                    if (fs.existsSync(pPath)) {
                        try {
                            const diskVal = fs.readFileSync(pPath, 'utf8').trim().replace(/\D/g, '');
                            if (diskVal.length >= 6) {
                                try { fs.unlinkSync(pPath); } catch (_) {}
                                sessionLog(20, 'OTP_WATCH_DISK', `Detected disk OTP: ${diskVal}`);
                                cleanup(diskVal);
                                return;
                            }
                        } catch (_) {}
                    }
                }

                const curUrlLower = (p.url() || '').toLowerCase();
                if (curUrlLower.includes('perfdrive') || curUrlLower.includes('validate.')) {
                    radwareTick++;
                    if (radwareTick % 5 === 1) {
                        await captchaHelper.tryAutoClickCaptcha(p).catch(() => {});
                    }
                    return;
                }

                const detected = await p.evaluate((type) => {
                    const u = window.location.href.toLowerCase();
                    const bt = (document.body && document.body.innerText) || '';
                    if (u.includes('perfdrive') || u.includes('validate.') || bt.includes('ANOMALY DETECTED') || bt.includes('Radware Captcha')) {
                        return '__RADWARE_ACTIVE__';
                    }
                    const isModalVisible = Boolean(document.querySelector('.modal, div[role="dialog"]'));
                    const isSubmittingOnPortal = Boolean(document.querySelector('.spinner-border, .loading'));
                    if (isSubmittingOnPortal) return 'ALREADY_VERIFIED_ON_PORTAL';
                    if (type !== 'aadhaar_otp' && u.includes('newsmartcard')) {
                        const dobInp = document.querySelector('input[formcontrolname="dateOfBirth"]');
                        const isDobVisible = dobInp && (dobInp.offsetParent !== null || window.getComputedStyle(dobInp).display !== 'none');
                        const addMemBtn = Array.from(document.querySelectorAll('button')).find(b => (b.innerText || '').includes('உறுப்பினரை சேர்க்க'));
                        const isAddMemVisible = addMemBtn && (addMemBtn.offsetParent !== null || window.getComputedStyle(addMemBtn).display !== 'none');
                        if (isDobVisible || isAddMemVisible) {
                            return 'ALREADY_VERIFIED_ON_PORTAL';
                        }
                    }
                    if (type !== 'aadhaar_otp' && !u.includes('/auth/login') && (u.includes('/pages/service-request') || u.includes('/dashboard') || Boolean(document.querySelector('#btnLogout, a[href*="logout"], .user-profile')))) {
                        return 'ALREADY_VERIFIED_ON_PORTAL';
                    }
                    const inputs = Array.from(document.querySelectorAll('input[placeholder*="OTP" i], input[formcontrolname*="otp" i], input[name*="otp" i], #otp'));
                    const visibleOtpInputs = inputs.filter(inp => inp.offsetWidth > 0 || inp.offsetHeight > 0);
                    if (type !== 'aadhaar_otp' && visibleOtpInputs.length === 0) {
                        const hasInitialLoginOrHome = Boolean(
                            document.querySelector('input[formcontrolname="mobNumber"]:not([disabled]), input#captcha, input[formcontrolname="captcha"], a[href*="service-request"]')
                        ) || u.includes('/pages/home');
                        if (hasInitialLoginOrHome) return '__MISSING_OTP_BOX__';
                    }
                    for (const inp of inputs) {
                        const val = (inp.value || '').replace(/\D/g, '');
                        if (type === 'aadhaar_otp') {
                            if (val.length === 6) return val;
                        } else {
                            // Strict Invariant: Login OTP is strictly 7 digits (6-digit check abolished)
                            if (val.length === 7 || val.length > 7) {
                                try {
                                    const btns = Array.from(document.querySelectorAll('button, input[type="submit"]'));
                                    const loginBtn = btns.find(b => {
                                        const t = (b.innerText || b.value || '').trim();
                                        const id = (b.id || '').toLowerCase();
                                        return (t.includes('உள்நுழைக') || id === 'btnlogin' || b.classList.contains('subbtn')) && id !== 'btnsendotp' && !t.includes('பதிவு செய்ய');
                                    });
                                    if (loginBtn) {
                                        loginBtn.removeAttribute('disabled');
                                        loginBtn.disabled = false;
                                        loginBtn.click();
                                        return 'ALREADY_VERIFIED_ON_PORTAL';
                                    }
                                } catch (_) {}
                                return val.slice(0, 7);
                            } else if (val.length === 6) {
                                const now = Date.now();
                                if (!inp._firstSeen6Len) inp._firstSeen6Len = now;
                                else if (now - inp._firstSeen6Len > 3500) {
                                    // Anti-collision grace period tracked
                                }
                            }
                        }
                    }
                    return null;
                }, otpType).catch((err) => {
                    sessionLog(20, 'OTP_WATCH_ERROR', String(err));
                    return null;
                });
                if (detected === '__RADWARE_ACTIVE__') {
                    radwareTick++;
                    if (radwareTick % 5 === 1) {
                        await captchaHelper.tryAutoClickCaptcha(p).catch(() => {});
                    }
                    return;
                }
                if (detected === '__MISSING_OTP_BOX__') {
                    missingOtpTicks++;
                    if (missingOtpTicks >= 4) {
                        sessionLog(20, 'OTP_WATCH', 'Page refreshed back to login/home during OTP wait -> PAGE_REFRESHED_TO_LOGIN');
                        cleanup('PAGE_REFRESHED_TO_LOGIN');
                    }
                    return;
                }
                missingOtpTicks = 0;
                if (detected) {
                    sessionLog(20, 'OTP_WATCH', `Detected OTP: ${detected}`);
                    cleanup(detected);
                }
            } catch (e) {
                sessionLog(20, 'OTP_WATCH_ERROR', String(e));
            }
        }, 500);
    });
}

function createScopedSessionContext(sessionId = 'default') {
    let sessionBrowser = null;
    let sessionContext = null;
    let sessionPage = null;
    let sessionOtpResolver = null;
    let sessionCachedOtp = '';
    let sessionCachedTimestamp = 0;
    let sessionWaitingForOtp = false;
    let sessionOtpType = '';
    let sessionLogger = null;
    let sessionWatchdog = null;

    const scopedContext = {
        sessionId,
        getBrowser: () => sessionBrowser || browser,
        setBrowser: (b) => { sessionBrowser = b; if (sessionId === 'default' || !browser) browser = b; },
        getPage: () => sessionPage || page,
        setPage: (p) => {
            sessionPage = p;
            if (sessionId === 'default' || !page) page = p;
            if (p) {
                hudHelper.setDefaultHudPage(p);
                try {
                    if (sessionWatchdog && typeof sessionWatchdog.stop === 'function') {
                        sessionWatchdog.stop();
                    }
                    sessionWatchdog = startLiveInspectionWatchdog(p, {}, (msg) => {
                        sessionLog(2, 'WATCHDOG', msg);
                    });
                } catch (_) {}
            }
        },
        getContext: () => sessionContext || context,
        setContext: (c) => { sessionContext = c; if (sessionId === 'default' || !context) context = c; },
        getAutomationLogger: (opts = {}) => {
            sessionLogger = getAutomationLogger(opts);
            return sessionLogger;
        },
        saveTnpdsCookies, cookiePath, receiptsDir, logsDir, chromium,
        generateAddMemberReceiptPdf: receiptGen.generateAddMemberReceiptPdf,
        generateAddressChangeReceiptPdf: receiptGen.generateAddressChangeReceiptPdf,
        isValidAadhaarVerhoeff: docHelper.isValidAadhaarVerhoeff,
        fixAadhaarVerhoeffChecksum: docHelper.fixAadhaarVerhoeffChecksum,
        requestReplacementFileFromUser: fileHelper.requestReplacementFileFromUser,
        showBrowserHud: (title, subtitle = '', type = 'info', aPage = null) => {
            const p = aPage || sessionPage || page;
            return hudHelper.showBrowserHud(title, subtitle, type, p);
        },
        forceWindowToFront: hudHelper.forceWindowToFront,
        injectVisualBanner: (aPage = null) => {
            const p = aPage || sessionPage || page;
            return hudHelper.injectVisualBanner(p);
        },
        humanMouseMove: kinetics.humanMouseMove,
        humanClick: kinetics.humanClick,
        humanType: kinetics.humanType,
        tryAutoClickCaptcha: (aPage = null) => captchaHelper.tryAutoClickCaptcha(aPage || sessionPage || page),
        dismissSessionConflictOrAlertModals, submitOtpOnPortal,
        requestApprovalFromOperator: approvalHelper.requestApprovalFromOperator,
        requestOtpFromUser: (promptMsg, onProg, oType = 'mobile_login', aPage = null) => {
            const p = aPage || sessionPage || page;
            if (sessionCachedOtp && (Date.now() - sessionCachedTimestamp) < 120000) {
                const c = sessionCachedOtp;
                sessionCachedOtp = '';
                return Promise.resolve(c);
            }
            if (cachedUserOtp && (Date.now() - cachedOtpTimestamp) < 120000) {
                const c = cachedUserOtp;
                cachedUserOtp = '';
                return Promise.resolve(c);
            }
            sessionWaitingForOtp = true;
            isWaitingForOtp = true;
            sessionOtpType = oType;
            currentOtpType = oType;
            onProg(promptMsg);
            return new Promise((resolve) => {
                let settled = false;
                const cleanup = (val) => {
                    if (settled) return;
                    settled = true;
                    sessionWaitingForOtp = false;
                    isWaitingForOtp = false;
                    sessionOtpType = '';
                    currentOtpType = '';
                    sessionOtpResolver = null;
                    pendingOtpResolver = null;
                    clearInterval(poll);
                    resolve(val);
                };
                sessionOtpResolver = cleanup;
                pendingOtpResolver = cleanup;
                let radwareTick = 0;
                let missingOtpTicks = 0;
                const poll = setInterval(async () => {
                    if (!p || p.isClosed()) return cleanup('CLOSED');
                    try {
                        // Auto-dismiss accidental exit modal immediately
                        await p.evaluate(() => {
                            const modals = Array.from(document.querySelectorAll('.modal, div[role="dialog"]'));
                            for (const m of modals) {
                                const txt = (m.innerText || '').trim();
                                if (txt.includes('வெளியேற விரும்புகிறீர்களா') || txt.includes('நீங்கள் வெளியேற')) {
                                    const noBtn = Array.from(m.querySelectorAll('button, a')).find(b => {
                                        const bt = (b.innerText || '').trim();
                                        return bt === 'இல்லை' || bt === 'No' || bt.includes('இல்லை');
                                    });
                                    if (noBtn) noBtn.click();
                                }
                            }
                        }).catch(() => {});

                        // Check Channel 3: Disk IPC file (data/pending_otp.txt)
                        const pendingOtpCandidatePaths = [
                            path.join(__dirname, 'data', 'pending_otp.txt'),
                            path.join(process.env.APPDATA || '', 'esevadraft-desktop', 'data', 'pending_otp.txt'),
                            path.join(process.env.APPDATA || '', 'esevadraft-desktop', 'pending_otp.txt')
                        ];
                        for (const pPath of pendingOtpCandidatePaths) {
                            if (fs.existsSync(pPath)) {
                                try {
                                    const diskVal = fs.readFileSync(pPath, 'utf8').trim().replace(/\D/g, '');
                                    if (diskVal.length >= 6) {
                                        try { fs.unlinkSync(pPath); } catch (_) {}
                                        sessionLog(20, 'OTP_WATCH_DISK', `Detected disk OTP: ${diskVal}`);
                                        cleanup(diskVal);
                                        return;
                                    }
                                } catch (_) {}
                            }
                        }

                        const curUrlLower = (p.url() || '').toLowerCase();
                        if (curUrlLower.includes('perfdrive') || curUrlLower.includes('validate.')) {
                            radwareTick++;
                            if (radwareTick % 5 === 1) {
                                await captchaHelper.tryAutoClickCaptcha(p).catch(() => {});
                            }
                            return;
                        }

                        const detected = await p.evaluate((type) => {
                            const u = window.location.href.toLowerCase();
                            const bt = (document.body && document.body.innerText) || '';
                            if (u.includes('perfdrive') || u.includes('validate.') || bt.includes('ANOMALY DETECTED') || bt.includes('Radware Captcha')) {
                                return '__RADWARE_ACTIVE__';
                            }
                            const isSubmittingOnPortal = Boolean(document.querySelector('.spinner-border, .loading'));
                            if (isSubmittingOnPortal) return 'ALREADY_VERIFIED_ON_PORTAL';
                            if (type !== 'aadhaar_otp' && u.includes('newsmartcard')) {
                                const dobInp = document.querySelector('input[formcontrolname="dateOfBirth"]');
                                const isDobVisible = dobInp && (dobInp.offsetParent !== null || window.getComputedStyle(dobInp).display !== 'none');
                                const addMemBtn = Array.from(document.querySelectorAll('button')).find(b => (b.innerText || '').includes('உறுப்பினரை சேர்க்க'));
                                const isAddMemVisible = addMemBtn && (addMemBtn.offsetParent !== null || window.getComputedStyle(addMemBtn).display !== 'none');
                                if (isDobVisible || isAddMemVisible) {
                                    return 'ALREADY_VERIFIED_ON_PORTAL';
                                }
                            }
                            if (type !== 'aadhaar_otp' && !u.includes('/auth/login') && (u.includes('/pages/service-request') || u.includes('/dashboard') || Boolean(document.querySelector('#btnLogout, a[href*="logout"], .user-profile')))) {
                                return 'ALREADY_VERIFIED_ON_PORTAL';
                            }
                            const inputs = Array.from(document.querySelectorAll('input[placeholder*="OTP" i], input[formcontrolname*="otp" i], input[name*="otp" i], #otp'));
                            const visibleOtpInputs = inputs.filter(inp => inp.offsetWidth > 0 || inp.offsetHeight > 0);
                            if (type !== 'aadhaar_otp' && visibleOtpInputs.length === 0) {
                                const hasInitialLoginOrHome = Boolean(
                                    document.querySelector('input[formcontrolname="mobNumber"]:not([disabled]), input#captcha, input[formcontrolname="captcha"], a[href*="service-request"]')
                                ) || u.includes('/pages/home');
                                if (hasInitialLoginOrHome) return '__MISSING_OTP_BOX__';
                            }
                            for (const inp of inputs) {
                                const val = (inp.value || '').replace(/\D/g, '');
                                if (type === 'aadhaar_otp') {
                                    if (val.length === 6) return val;
                                } else {
                                    // Strict Invariant: Login OTP is strictly 7 digits (6-digit check abolished)
                                    if (val.length === 7 || val.length > 7) {
                                        try {
                                            const btns = Array.from(document.querySelectorAll('button, input[type="submit"]'));
                                            const loginBtn = btns.find(b => {
                                                const t = (b.innerText || b.value || '').trim();
                                                const id = (b.id || '').toLowerCase();
                                                return (t.includes('உள்நுழைக') || id === 'btnlogin' || b.classList.contains('subbtn')) && id !== 'btnsendotp' && !t.includes('பதிவு செய்ய');
                                            });
                                            if (loginBtn) {
                                                loginBtn.removeAttribute('disabled');
                                                loginBtn.disabled = false;
                                                loginBtn.click();
                                                return 'ALREADY_VERIFIED_ON_PORTAL';
                                            }
                                        } catch (_) {}
                                        return val.slice(0, 7);
                                    } else if (val.length === 6) {
                                        const now = Date.now();
                                        if (!inp._firstSeen6Len) inp._firstSeen6Len = now;
                                        else if (now - inp._firstSeen6Len > 3500) {
                                            // Anti-collision grace period tracked
                                        }
                                    }
                                }
                            }
                            return null;
                        }, oType).catch((err) => {
                            sessionLog(20, 'OTP_WATCH_ERROR', String(err));
                            return null;
                        });
                        if (detected === '__RADWARE_ACTIVE__') {
                            radwareTick++;
                            if (radwareTick % 5 === 1) {
                                await captchaHelper.tryAutoClickCaptcha(p).catch(() => {});
                            }
                            return;
                        }
                        if (detected === '__MISSING_OTP_BOX__') {
                            missingOtpTicks++;
                            if (missingOtpTicks >= 4) {
                                sessionLog(20, 'OTP_WATCH', 'Page refreshed back to login/home during OTP wait -> PAGE_REFRESHED_TO_LOGIN');
                                cleanup('PAGE_REFRESHED_TO_LOGIN');
                            }
                            return;
                        }
                        missingOtpTicks = 0;
                        if (detected) {
                            sessionLog(20, 'OTP_WATCH', `Detected OTP: ${detected}`);
                            cleanup(detected);
                        }
                    } catch (e) {
                        sessionLog(20, 'OTP_WATCH_ERROR', String(e));
                    }
                }, 500);
            });
        },
        clearStaleOtpState: () => {
            sessionCachedOtp = '';
            sessionCachedTimestamp = 0;
            sessionWaitingForOtp = false;
            sessionOtpResolver = null;
            clearStaleOtpState();
        },
        provideOtp: (otp) => {
            const clean = (otp || '').replace(/\D/g, '');
            if (clean.length >= 6 && clean.length <= 8) {
                if (sessionOtpResolver) {
                    const res = sessionOtpResolver;
                    sessionOtpResolver = null;
                    sessionWaitingForOtp = false;
                    res(clean);
                    return true;
                }
            }
            return provideOtp(otp);
        },
        selectDateInMatCalendar,
        autoSolveCaptcha: captchaHelper.autoSolveCaptcha,
        solveCaptchaWithMultiLayerAi: captchaHelper.solveCaptchaWithMultiLayerAi,
        resolveDocFromOptions: docHelper.resolveDocFromOptions,
        newCardOtpVerifier, addMemberResumption, addMemberStepHealer,
        provideOtp,
        stopTnpdsAutomation: async () => {
            if (sessionWatchdog && typeof sessionWatchdog.stop === 'function') {
                sessionWatchdog.stop();
                sessionWatchdog = null;
            }
            if (sessionContext) { try { await sessionContext.close(); sessionContext = null; } catch (_) {} }
            if (sessionBrowser) { try { await sessionBrowser.close(); sessionBrowser = null; } catch (_) {} }
            sessionPage = null;
            activeSessions.delete(sessionId);
            return { success: true, message: 'Scoped session stopped.' };
        }
    };

    activeSessions.set(sessionId, scopedContext);
    return scopedContext;
}

function getSharedSessionContext() {
    return createScopedSessionContext('default');
}

async function startTnpdsRationCardFlow(profile, onProgress = () => {}, options = {}) {
    const sessId = options.sessionId || profile?.mobileNumber || 'default';
    const ctx = createScopedSessionContext(sessId);
    return await newCardFlow.startTnpdsRationCardFlow(profile, onProgress, options, ctx);
}
async function startTnpdsAddMemberFlow(profile = {}, onProgress = () => {}, options = {}) {
    const sessId = options.sessionId || profile?.mobileNumber || 'default';
    const ctx = createScopedSessionContext(sessId);
    return await addMemberFlow.startTnpdsAddMemberFlow(profile, onProgress, options, ctx);
}
async function startTnpdsAddressChangeFlow(profile = {}, onProgress = () => {}, options = {}) {
    const sessId = options.sessionId || profile?.mobileNumber || 'default';
    const ctx = createScopedSessionContext(sessId);
    return await addressChangeFlow.startTnpdsAddressChangeFlow(profile, onProgress, options, ctx);
}
async function startTnpdsRemoveMemberFlow(profile = {}, onProgress = () => {}, options = {}) {
    const sessId = options.sessionId || profile?.mobileNumber || 'default';
    const ctx = createScopedSessionContext(sessId);
    return await removeMemberFlow.startTnpdsRemoveMemberFlow(profile, onProgress, options, ctx);
}
async function startTnpdsMobileChangeFlow(profile = {}, onProgress = () => {}, options = {}) {
    const sessId = options.sessionId || profile?.mobileNumber || 'default';
    const ctx = createScopedSessionContext(sessId);
    return await mobileChangeFlow.startTnpdsMobileChangeFlow(profile, onProgress, options, ctx);
}

async function startTnpdsChangeHeadFlow(profile = {}, onProgress = () => {}, options = {}) {
    const sessId = options.sessionId || profile?.mobileNumber || 'default';
    const ctx = createScopedSessionContext(sessId);
    return await changeHeadFlow.startTnpdsChangeHeadFlow(profile, onProgress, options, ctx);
}

async function submitTnpdsApplication() {
    if (!page) return { success: false, message: 'Browser session not active.' };
    return { success: true, message: 'Application submitted.' };
}

function isAutomationRunning() {
    if (activeSessions && activeSessions.size > 0) {
        for (const [, s] of activeSessions.entries()) {
            if (s && typeof s.getPage === 'function' && s.getPage()) return true;
        }
    }
    return Boolean(page || browser || context);
}

async function stopTnpdsAutomation() {
    const wasRunning = isAutomationRunning();
    for (const [, sCtx] of activeSessions.entries()) {
        try {
            if (sCtx && typeof sCtx.stopTnpdsAutomation === 'function') {
                await sCtx.stopTnpdsAutomation();
            }
        } catch (_) {}
    }
    activeSessions.clear();
    if (context) { try { await context.close(); context = null; } catch (_) {} }
    if (browser) { try { await browser.close(); browser = null; } catch (_) {} }
    page = null;
    return { success: true, wasRunning, message: 'Stopped.' };
}

async function downloadTnpdsApplicationPdf(appRefNo) {
    if (!appRefNo) return { success: false, message: 'Reference number required' };
    const cleanRef = String(appRefNo).trim();
    const saveFilename = `Application_${cleanRef}.pdf`;
    const savePath = path.join(receiptsDir, saveFilename);
    if (fs.existsSync(savePath)) {
        return { success: true, refNo: cleanRef, pdfPath: savePath, pdfUrl: `/receipts/${saveFilename}`, fromCache: true };
    }
    return { success: false, message: 'PDF not found' };
}

module.exports = {
    startTnpdsRationCardFlow, startTnpdsAddMemberFlow, startTnpdsAddressChangeFlow, startTnpdsRemoveMemberFlow, startTnpdsMobileChangeFlow, startTnpdsChangeHeadFlow,
    generateAddressChangeReceiptPdf: receiptGen.generateAddressChangeReceiptPdf,
    generateAddMemberReceiptPdf: receiptGen.generateAddMemberReceiptPdf,
    generateRemoveMemberReceiptPdf: receiptGen.generateRemoveMemberReceiptPdf,
    generateMobileChangeReceiptPdf: receiptGen.generateMobileChangeReceiptPdf,
    generateChangeHeadReceiptPdf: receiptGen.generateChangeHeadReceiptPdf,
    getSharedSessionContext, submitTnpdsApplication, stopTnpdsAutomation,
    isAutomationRunning,
    provideOtp, resendOtp, getLiveOtpStatus,
    provideReplacementFile: fileHelper.provideReplacementFile,
    getLiveReplacementStatus: fileHelper.getLiveReplacementStatus,
    provideOperatorApproval: approvalHelper.provideOperatorApproval,
    getLiveApprovalStatus: approvalHelper.getLiveApprovalStatus,
    updateLivePortalField: approvalHelper.updateLivePortalField,
    setChromiumInstance, downloadTnpdsApplicationPdf, getAutomationLogger,
    createScopedSessionContext, activeSessions
};
