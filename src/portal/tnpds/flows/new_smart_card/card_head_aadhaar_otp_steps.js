/**
 * TNPDS New Smart Card - Steps 35 to 36: Head Member Aadhaar OTP Verification & Table Lock
 */
const path = require('path');
const fs = require('fs');
const { isValidNewCardAadhaarOtp } = require('./new_card_otp_config');
const { assertNoRadwareOrPageRefresh } = require('../../../common/universal_radware_resumption');
const {
    installOtpModalCopilot,
    resetHumanSubmitWatch,
    readOtpModalCopilotState,
    performVisibleModalOtpSubmit,
    performVisibleModalResend,
    shouldBotTriggerResend,
    shouldBotTriggerSubmit
} = require('../../../common/otp_copilot_watcher');

async function isAadhaarStepPageIntact(page) {
    if (!page || page.isClosed()) return false;
    return await page.evaluate(() => {
        const nameEls = Array.from(document.querySelectorAll('input[formcontrolname="NameOfFamilyHead"]'));
        if (nameEls.length === 0) return true;
        return nameEls.some(el => el.value && el.value.trim().length > 0);
    }).catch(() => true);
}

async function executeHeadAadhaarOtpSteps(page, citizenProfile, options, onProgress, sharedContext, logDiag, takeStepSnapshot, scanAndBroadcastToasts) {
    const {
        requestOtpFromUser,
        clearStaleOtpState = () => {},
        showBrowserHud = async () => {}
    } = sharedContext;

    // Clear previous Mobile OTP from cache/IPC BEFORE Head Aadhaar UIDAI OTP step!
    clearStaleOtpState();

    // படி 35: ஆதார் OTP சாளரம் (Modal) இடைமறிப்பு ➔ அரசு கண்டிப்பான OTP சரிபார்ப்பு
    onProgress('📍 [படி 35/51] அரசு சர்வரில் ஆதார் OTP கோரப்படுகிறது... உங்கள் கைபேசிக்கு SMS வரும் வரை காத்திருக்கிறது...');

    const checkAadhaarModal = async () => {
        return await page.evaluate(() => {
            const modals = Array.from(document.querySelectorAll('.modal, div[role="dialog"], .modal-dialog'));
            return modals.some(m => {
                const s = window.getComputedStyle(m);
                const isVis = (m.offsetParent !== null || s.display !== 'none' || m.classList.contains('show') || m.classList.contains('in')) && s.visibility !== 'hidden' && !m.classList.contains('hidden');
                if (!isVis) return false;
                const txt = (m.innerText || '').trim();
                const hasAadhaarOtpText = txt.includes('OTP சரிபார்ப்பு') || txt.includes('சரியான OTP') || (txt.includes('ஆதார் எண்') && txt.includes('OTP'));
                const hasEditableInput = Boolean(m.querySelector('input:not([type="hidden"]):not([disabled]):not([readonly]), input[formcontrolname*="otp"], input#otp'));
                return hasAadhaarOtpText || (txt.includes('OTP') && hasEditableInput);
            });
        }).catch(() => false);
    };

    let isModalVisible = false;
    for (let waitSec = 0; waitSec < 30; waitSec++) {
        isModalVisible = await checkAadhaarModal();
        if (isModalVisible) break;

        if (waitSec % 2 === 0) {
            await scanAndBroadcastToasts();
        }

        const inTable = await page.evaluate(({ eng, tam }) => {
            const allTables = Array.from(document.querySelectorAll('table'));
            const memberTable = allTables.find(t => {
                const txt = (t.innerText || '').toLowerCase();
                return !txt.includes('எண்ணெய் நிறுவனம்') && !txt.includes('விவரங்கள் இணைப்பு 1') && (txt.includes('உறுப்பினர்') || txt.includes('member') || txt.includes('தலைவர்') || txt.includes('action') || txt.includes('நடவடிக்கை'));
            });
            if (!memberTable) return false;
            const rows = Array.from(memberTable.querySelectorAll('tbody tr, tr')).filter(r => {
                const rt = (r.innerText || '').toLowerCase();
                return !rt.includes('பெயர்') && !rt.includes('name') && !rt.includes('நடவடிக்கை') && !rt.includes('action') && !rt.includes('காணப்படவில்லை') && !rt.includes('no records');
            });
            if (rows.length === 0) return false;
            const txt = (memberTable.innerText || '').toLowerCase();
            const hasHeadWord = txt.includes('தலைவர்') || txt.includes('head');
            const hasEng = eng && txt.includes(eng.toLowerCase());
            const hasTam = tam && (memberTable.innerText || '').includes(tam);
            return rows.length >= 1 && (hasHeadWord || hasEng || hasTam);
        }, { eng: citizenProfile.fullNameEng, tam: citizenProfile.fullNameTam }).catch(() => false);
        if (inTable) break;

        if (waitSec === 22) {
            // Only click Save Member once more if NO modal AND NO busy spinner appeared after 22s!
            const isBusyNow = await page.evaluate(() => Boolean(document.querySelector('.spinner-border, .loading'))).catch(() => false);
            if (!isBusyNow) {
                onProgress('📍 ஆதார் OTP சாளரம் இன்னும் திறக்கவில்லை — "உறுப்பினர் விவரம் சேமி" மீண்டும் ஒருமுறை அழுத்தப்படுகிறது...');
                const saveHeadBtn = page.getByRole('button', { name: /உறுப்பினர் விவரம் சேமி|Save Member/i }).last();
                if (await saveHeadBtn.count() > 0 && await saveHeadBtn.isVisible().catch(() => false)) {
                    await saveHeadBtn.click({ force: true }).catch(() => {});
                }
            }
        }
        await page.waitForTimeout(1000);
    }

    if (isModalVisible) {
        onProgress(`🔐 [ஆதார் OTP தேவை] குடும்பத் தலைவர் (${citizenProfile.fullNameTam || citizenProfile.fullNameEng}) அவர்களின் ஆதார் OTP சாளரம் திரையில் உள்ளது!`);
        await showBrowserHud('[ஆதார் OTP தேவை]', 'ஆதார் SMS OTP உள்ளிடவும்', 'warning');
        await installOtpModalCopilot(page);
    }

    // இரும்புக் கோட்டைப் பூட்டு 1: குடும்பத் தலைவர் அட்டவணையில் உறுதி செய்யப்படும் வரை நேரலை சுய-திருத்த பின்னணி இயக்கம் (Golden Rule 5 & 13)
    const headDisplayName = citizenProfile.fullNameTam || citizenProfile.fullNameEng || 'தலைவர்';
    let isHeadInTable = false;
    let lastSubmittedOtp = '';
    let lastBotResendAt = Date.now();
    let notedHumanResendAt = 0;
    let copilotInstalled = isModalVisible;
    const maxWatchSec = 600; // 10 minutes live watch
    let watchTicks = 0;

    while (!isHeadInTable && watchTicks < maxWatchSec) {
        watchTicks++;
        await assertNoRadwareOrPageRefresh(page, isAadhaarStepPageIntact, 'படி 35-36 (குடும்பத் தலைவர் ஆதார் OTP)');

        // 1. அட்டவணையில் குடும்பத் தலைவர் உறுதி செய்யப்பட்டுள்ளாரா எனச் சரிபார்த்தல்
        isHeadInTable = await page.evaluate(({ eng, tam }) => {
            const allTables = Array.from(document.querySelectorAll('table'));
            const memberTable = allTables.find(t => {
                const txt = (t.innerText || '').toLowerCase();
                return !txt.includes('எண்ணெய் நிறுவனம்') && !txt.includes('விவரங்கள் இணைப்பு 1') && (txt.includes('உறுப்பினர்') || txt.includes('member') || txt.includes('தலைவர்') || txt.includes('action') || txt.includes('நடவடிக்கை'));
            });
            if (!memberTable) return false;
            const rows = Array.from(memberTable.querySelectorAll('tbody tr, tr')).filter(r => {
                const rt = (r.innerText || '').toLowerCase();
                return !rt.includes('பெயர்') && !rt.includes('name') && !rt.includes('நடவடிக்கை') && !rt.includes('action') && !rt.includes('காணப்படவில்லை') && !rt.includes('no records');
            });
            if (rows.length === 0) return false;
            const txt = (memberTable.innerText || '').toLowerCase();
            const hasHeadWord = txt.includes('தலைவர்') || txt.includes('head');
            const hasEng = eng && txt.includes(eng.toLowerCase());
            const hasTam = tam && (memberTable.innerText || '').includes(tam);
            return rows.length >= 1 && (hasHeadWord || hasEng || hasTam);
        }, { eng: citizenProfile.fullNameEng, tam: citizenProfile.fullNameTam }).catch(() => false);

        if (isHeadInTable && !(await checkAadhaarModal())) break;

        if (!copilotInstalled && (await checkAadhaarModal())) {
            await installOtpModalCopilot(page);
            copilotInstalled = true;
        }

        // 1.5. IPC கோப்பிலிருந்து (data/pending_otp.txt) ஆப் மூலம் பெறப்பட்ட OTP-ஐ ஆய்வு செய்தல்
        const pendingOtpCandidatePaths = [
            path.join(process.cwd(), 'data', 'pending_otp.txt'),
            path.join(process.env.APPDATA || '', 'esevadraft-desktop', 'data', 'pending_otp.txt'),
            path.join(process.env.APPDATA || '', 'esevadraft-desktop', 'pending_otp.txt')
        ];
        let diskOtp = '';
        for (const pPath of pendingOtpCandidatePaths) {
            if (fs.existsSync(pPath)) {
                try {
                    const st = fs.statSync(pPath);
                    // Ensure the OTP file was created recently (within 45s) and not a stale leftover from previous sessions
                    if (Date.now() - st.mtimeMs < 45000) {
                        const diskVal = fs.readFileSync(pPath, 'utf8').trim().replace(/\D/g, '');
                        if (isValidNewCardAadhaarOtp(diskVal)) {
                            diskOtp = diskVal;
                            try { fs.unlinkSync(pPath); } catch (_) {}
                            break;
                        }
                    } else {
                        try { fs.unlinkSync(pPath); } catch (_) {}
                    }
                } catch (_) {}
            }
        }
        if (diskOtp) {
            onProgress(`📲 [ஆதார் OTP] ஆப் மூலம் பெறப்பட்ட ஆதார் OTP (${diskOtp}) தானாக உள்ளிடப்படுகிறது...`);
            await page.evaluate((dOtp) => {
                const modals = Array.from(document.querySelectorAll('.modal, div[role="dialog"], .modal-dialog')).filter(m => {
                    const s = window.getComputedStyle(m);
                    return (m.offsetParent !== null || s.display !== 'none' || m.classList.contains('show') || m.classList.contains('d-block')) && s.visibility !== 'hidden';
                });
                const modal = modals[modals.length - 1] || document;
                const inp = modal.querySelector('input[formcontrolname="otp"], input#otp, input[placeholder*="OTP" i], input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])');
                if (inp) {
                    inp.value = dOtp;
                    inp.dispatchEvent(new Event('input', { bubbles: true }));
                    inp.dispatchEvent(new Event('change', { bubbles: true }));
                    inp.dispatchEvent(new Event('blur', { bubbles: true }));
                }
            }, diskOtp).catch(() => {});
        }

        // 2. சாளரத்தின் (Aadhaar OTP Modal) நேரலை நிலை & Co-Pilot நிலை ஆய்வு
        const modalInfo = await readOtpModalCopilotState(page);

        if (!modalInfo.open) {
            await page.waitForTimeout(1000);
            continue;
        }

        // ஆப்ரேட்டர் கையால் Resend அழுத்தினால் உடனே உணர்ந்து புது OTP-க்குத் தயாராகுதல் (Co-Pilot)
        if (modalInfo.humanResendAt > notedHumanResendAt) {
            notedHumanResendAt = modalInfo.humanResendAt;
            lastSubmittedOtp = '';
            onProgress('⌨️ [Co-Pilot] ஆப்ரேட்டர் நேரடியாக "OTP மீண்டும் அனுப்பவும்" அழுத்தினார் — புது OTP-க்காகக் காத்திருக்கிறது (ஆப் இனி தானாக Resend அழுத்தாது).');
            await showBrowserHud('[Co-Pilot] புது OTP அனுப்பப்பட்டது', 'புதிய SMS OTP-ஐ உள்ளிடவும்', 'info');
        }

        // 3. Co-Pilot Resend: ஆபரேட்டர் Resend அழுத்தாமல், டைமர் 0 ஆகி 4s முடிந்தும் பெட்டி காலியாக இருந்தால் மட்டுமே ஆப் 1 முறை Resend அழுத்தும்!
        if (shouldBotTriggerResend(modalInfo, lastBotResendAt, Date.now(), 4000, 2)) {
            const didResend = await performVisibleModalResend(page, { allowInlinePage: false });
            if (didResend) {
                lastBotResendAt = Date.now();
                lastSubmittedOtp = '';
                onProgress('🔔 [ஆதார் OTP] டைமர் முடிந்ததால் ஆப் புதிய OTP கோரியது — இனி புதிதாக வரும் SMS OTP-யை மட்டும் உள்ளிடவும்!');
                await showBrowserHud('🔔 புதிய OTP கோரப்பட்டது', 'புதிய SMS OTP-ஐ மட்டும் உள்ளிடவும்!', 'warning');
                await page.waitForTimeout(2500);
                continue;
            }
        }

        // 4. Co-Pilot Submit: ஆபரேட்டர் ஏற்கனவே Submit/Enter அழுத்தியிருந்தால் ஆப் 2-வது முறை அழுத்தாது!
        const subDecision = shouldBotTriggerSubmit(modalInfo, lastSubmittedOtp, 6, Date.now());
        if (subDecision.reason === 'human_already_submitted') {
            if (modalInfo.otpVal !== lastSubmittedOtp) {
                lastSubmittedOtp = modalInfo.otpVal;
                onProgress(`⌨️ [Co-Pilot] ஆப்ரேட்டர் நேரடியாக OTP (${lastSubmittedOtp}) சமர்ப்பித்ததை உணர்ந்தது — இரட்டை கிளிக் தவிர்க்கப்பட்டது!`);
                await page.waitForTimeout(3000);
                await scanAndBroadcastToasts();
            }
        } else if (subDecision.submit) {
            if (modalInfo.otpVal.length >= 6 && modalInfo.otpVal.length === 6 && modalInfo.otpMaxLen !== 6) {
                await page.waitForTimeout(1600);
                const rechecked = await readOtpModalCopilotState(page);
                if (!rechecked.open) {
                    await page.waitForTimeout(1000);
                    continue;
                }
                if (rechecked.humanSubmitAt > 0 && (Date.now() - rechecked.humanSubmitAt < 6500) && rechecked.humanSubmittedOtp === rechecked.otpVal) {
                    lastSubmittedOtp = rechecked.otpVal;
                    onProgress(`⌨️ [Co-Pilot] ஆப்ரேட்டர் நேரடியாக OTP (${lastSubmittedOtp}) சமர்ப்பித்ததை உணர்ந்தது — இரட்டை கிளிக் தவிர்க்கப்பட்டது!`);
                    await page.waitForTimeout(3000);
                    await scanAndBroadcastToasts();
                    continue;
                }
                modalInfo.otpVal = rechecked.otpVal || modalInfo.otpVal;
            }
            lastSubmittedOtp = modalInfo.otpVal;
            onProgress(`📍 [படி 36/51] ஆதார் OTP (${lastSubmittedOtp}) கண்டறியப்பட்டது. சமர்ப்பிக்கப்படுகிறது...`);

            await performVisibleModalOtpSubmit(page, lastSubmittedOtp);
            await page.waitForTimeout(3000);
            await scanAndBroadcastToasts();
        }

        // 5. தவறான OTP / txn Toast எரர் வந்தால் மட்டுமே பெட்டியைத் தெளிவாக மீட்டமைத்தல்
        const toastErr = await page.evaluate(() => {
            const toasts = Array.from(document.querySelectorAll('.p-toast-message, .toast, .alert, .ng-trigger')).map(t => (t.innerText || '').trim());
            return toasts.find(t => {
                const low = t.toLowerCase();
                return low.includes('txn') || low.includes('xsd') || low.includes('தவறான') || low.includes('invalid') || low.includes('failed') || low.includes('unauthorized');
            });
        }).catch(() => null);

        if (toastErr && lastSubmittedOtp) {
            const liveCur = await readOtpModalCopilotState(page);
            if (liveCur.open && liveCur.otpVal === lastSubmittedOtp) {
                onProgress(`⚠️ [ஆதார் OTP தேவை] அரசு இணையதள அறிவிப்பு: "${toastErr}". புதிய SMS OTP-ஐ உள்ளிடவும்...`);
                await showBrowserHud('⚠️ OTP எரர் — மீண்டும் முயற்சிக்கவும்', toastErr, 'error');
                await page.evaluate(() => {
                    const modals = Array.from(document.querySelectorAll('.modal, div[role="dialog"], .modal-dialog')).filter(m => {
                        const s = window.getComputedStyle(m);
                        return (m.offsetParent !== null || s.display !== 'none' || m.classList.contains('show') || m.classList.contains('d-block')) && s.visibility !== 'hidden';
                    });
                    const modal = modals[modals.length - 1];
                    const inp = modal && modal.querySelector('input[formcontrolname="otp"], input#otp, input:not([type="hidden"]):not([type="checkbox"])');
                    if (inp) {
                        inp.value = '';
                        inp.dispatchEvent(new Event('input', { bubbles: true }));
                        inp.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }).catch(() => {});
                await resetHumanSubmitWatch(page);
                lastSubmittedOtp = '';
            }
        }

        // கால இடைவெளியில் அறிவிப்புகளை ஸ்கேன் செய்தல்
        if (watchTicks % 5 === 0) {
            await scanAndBroadcastToasts();
        }

        await page.waitForTimeout(1000);
    }

    if (!isHeadInTable) {
        onProgress(`⚠️ **கடும் பூட்டு நிறுத்தம் (Strict Gate Halt):** குடும்பத் தலைவர் (${headDisplayName}) அரசு அட்டவணையில் சேமிக்கப்படவில்லை (TNPDS அரசு சர்வரில் ஆதார் OTP சாளரம் திறக்கப்படவில்லை / UIDAI சர்வர் இணைப்பு தாமதம்). அடுத்த உறுப்பினருக்குச் செல்லாமல் செயல்முறை பாதுகாப்பாக நிறுத்தப்படுகிறது.`);
        return { success: false, message: 'குடும்பத் தலைவர் சேர்க்கை அட்டவணையில் உறுதி செய்யப்படவில்லை (TNPDS UIDAI ஆதார் OTP தாமதம்).' };
    }

    onProgress(`✅ [உறுப்பினர் 1] குடும்பத் தலைவர் (${headDisplayName}) அரசு அட்டவணையில் வெற்றிகரமாகச் சேர்க்கப்பட்டு பச்சையாகப் பூட்டப்பட்டது!`);
    return { success: true, checkAadhaarModal };
}

module.exports = {
    executeHeadAadhaarOtpSteps
};
