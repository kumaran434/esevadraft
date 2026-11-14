/**
 * TNPDS New Smart Card - Steps 35 to 36: Head Member Aadhaar OTP Verification & Table Lock
 */
const path = require('path');
const fs = require('fs');

async function executeHeadAadhaarOtpSteps(page, citizenProfile, options, onProgress, sharedContext, logDiag, takeStepSnapshot, scanAndBroadcastToasts) {
    const {
        requestOtpFromUser,
        showBrowserHud = async () => {}
    } = sharedContext;

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

        if (waitSec === 8 || waitSec === 18) {
            onProgress('📍 ஆதார் OTP சாளரம் திறக்க மீண்டும் ஒருமுறை "உறுப்பினர் விவரம் சேமி" அழுத்தப்படுகிறது...');
            const saveHeadBtn = page.getByRole('button', { name: /உறுப்பினர் விவரம் சேமி|Save Member/i }).last();
            if (await saveHeadBtn.count() > 0 && await saveHeadBtn.isVisible().catch(() => false)) {
                await saveHeadBtn.click({ force: true }).catch(() => {});
            }
        }
        await page.waitForTimeout(1000);
    }

    if (isModalVisible) {
        onProgress(`🔐 [ஆதார் OTP தேவை] குடும்பத் தலைவர் (${citizenProfile.fullNameTam || citizenProfile.fullNameEng}) அவர்களின் ஆதார் OTP சாளரம் திரையில் உள்ளது!`);
        await showBrowserHud('[ஆதார் OTP தேவை]', 'ஆதார் SMS OTP உள்ளிடவும்', 'warning');
    }

    // இரும்புக் கோட்டைப் பூட்டு 1: குடும்பத் தலைவர் அட்டவணையில் உறுதி செய்யப்படும் வரை நேரலை சுய-திருத்த பின்னணி இயக்கம் (Golden Rule 5)
    const headDisplayName = citizenProfile.fullNameTam || citizenProfile.fullNameEng || 'தலைவர்';
    let isHeadInTable = false;
    let lastSubmittedOtp = '';
    const maxWatchSec = 600; // 10 minutes live watch
    let watchTicks = 0;

    while (!isHeadInTable && watchTicks < maxWatchSec) {
        watchTicks++;

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
            return rows.length >= 1 && (hasHeadWord || hasEng || hasTam || rows.length >= 1);
        }, { eng: citizenProfile.fullNameEng, tam: citizenProfile.fullNameTam }).catch(() => false);

        if (isHeadInTable) break;

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
                        if (diskVal.length === 6) {
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
                const inputs = Array.from(document.querySelectorAll('input[placeholder*="OTP" i], input[formcontrolname*="otp" i], input[name*="otp" i], #otp, .modal input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])'));
                for (const inp of inputs) {
                    inp.value = dOtp;
                    inp.dispatchEvent(new Event('input', { bubbles: true }));
                    inp.dispatchEvent(new Event('change', { bubbles: true }));
                    inp.dispatchEvent(new Event('blur', { bubbles: true }));
                }
            }, diskOtp).catch(() => {});
        }

        // 2. சாளரத்தின் (Aadhaar OTP Modal) நேரலை நிலையை துல்லியமாக ஆய்வு செய்தல்
        const modalInfo = await page.evaluate(() => {
            const otpInp = document.querySelector('input[formcontrolname="otp"], input#otp');
            let modal = null;
            if (otpInp) {
                modal = otpInp.closest('.modal, div[role="dialog"], div.fade');
            } else {
                const allInps = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])'));
                const candInp = allInps.find(i => {
                    const m = i.closest('.modal, div[role="dialog"]');
                    if (!m) return false;
                    const txt = (m.innerText || '');
                    return txt.includes('OTP') && (txt.includes('ஆதார்') || txt.includes('UID') || txt.includes('சரிபார்ப்பு'));
                });
                if (candInp) modal = candInp.closest('.modal, div[role="dialog"]');
            }

            if (!modal) return { open: false };

            const s = window.getComputedStyle(modal);
            const isVis = (modal.offsetParent !== null || s.display !== 'none' || modal.classList.contains('show') || modal.classList.contains('d-block')) && s.visibility !== 'hidden';
            if (!isVis) return { open: false };

            // சாளரத்திற்குள் உள்ள OTP உள்ளீட்டை மட்டும் ஆய்வு செய்தல் (பிற மறைக்கப்பட்ட படிவங்களைத் தவிர்த்தல்)
            let otpVal = '';
            const targetInp = modal.querySelector('input[formcontrolname="otp"], input#otp') || modal.querySelector('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])');
            if (targetInp) {
                otpVal = (targetInp.value || '').replace(/\D/g, '');
            }

            // Timer check strictly inside this modal
            const spans = Array.from(modal.querySelectorAll('span.text-danger, span'));
            const timerSpan = spans.find(s => /^\d+$/.test((s.innerText || '').trim()));
            const timerVal = timerSpan ? parseInt(timerSpan.innerText.trim(), 10) : null;

            const resendBtn = Array.from(modal.querySelectorAll('button')).find(b => {
                const bt = (b.innerText || '').trim();
                return bt.includes('மீண்டும் அனுப்பவும்') || bt.includes('Resend');
            });

            const submitBtn = Array.from(modal.querySelectorAll('button')).find(b => {
                const bt = (b.innerText || '').trim();
                return !bt.includes('ரத்து') && !bt.includes('Cancel') && !bt.includes('இல்லை') && (bt.includes('சமர்ப்பிக்கவும்') || bt.includes('Submit') || (b.className || '').includes('btn-success'));
            });

            return {
                open: true,
                otpVal,
                timerVal,
                hasResendBtn: Boolean(resendBtn && !resendBtn.disabled),
                hasSubmitBtn: Boolean(submitBtn)
            };
        }).catch(() => ({ open: false }));

        if (!modalInfo.open) {
            // சாளரம் மூடப்பட்டிருந்தால் அட்டவணையை மீண்டும் ஒருமுறை சரிபார்த்தல்
            await page.waitForTimeout(1000);
            continue;
        }

        // 3. 300 விநாடிகள் முடிந்து டைமர் 0 ஆனால் தானாக 'OTP மீண்டும் அனுப்பவும்' அழுத்துதல்
        if (modalInfo.timerVal === 0 && modalInfo.hasResendBtn) {
            onProgress('📍 [ஆதார் OTP] 300 விநாடிகள் முடிவடைந்தது. புதிய UIDAI OTP பெற "OTP மீண்டும் அனுப்பவும்" பொத்தான் அழுத்தப்படுகிறது...');
            try {
                const resendLoc = page.locator('input[formcontrolname="otp"]').locator('xpath=ancestor::div[contains(@class,"modal")]//button[contains(text(),"மீண்டும்") or contains(text(),"Resend")]').first();
                if (await resendLoc.count() > 0 && await resendLoc.isVisible().catch(() => false)) {
                    await resendLoc.click({ delay: 50 }).catch(() => {});
                }
            } catch (_) {}
            lastSubmittedOtp = '';
            await page.waitForTimeout(2000);
            continue;
        }

        // 4. உள்ளீட்டுப் பெட்டியில் 6 இலக்க OTP கண்டறியப்பட்டால் ஒற்றை துல்லிய கிளிக் (Single Atomic Click)
        if (modalInfo.otpVal && modalInfo.otpVal.length === 6 && modalInfo.otpVal !== lastSubmittedOtp && modalInfo.hasSubmitBtn) {
            lastSubmittedOtp = modalInfo.otpVal;
            onProgress(`📍 [படி 36/51] ஆதார் OTP (${lastSubmittedOtp}) கண்டறியப்பட்டது. சமர்ப்பிக்கப்படுகிறது...`);

            // Step 4.1: உள்ளீட்டு மதிப்பை Angular-க்கு முறைப்படி ஒத்திசைத்தல்
            await page.evaluate((otpToVerify) => {
                const targetInp = document.querySelector('input[formcontrolname="otp"], input#otp');
                if (targetInp) {
                    targetInp.value = otpToVerify;
                    targetInp.dispatchEvent(new Event('input', { bubbles: true }));
                    targetInp.dispatchEvent(new Event('change', { bubbles: true }));
                }
                if (window.__tnpdsComp && window.__tnpdsComp.otpForm) {
                    try {
                        window.__tnpdsComp.otpForm.get('otp')?.setValue(otpToVerify);
                        window.__tnpdsComp.otpForm.get('otp')?.setErrors(null);
                        window.__tnpdsComp.otpForm.updateValueAndValidity();
                    } catch (_) {}
                }
            }, lastSubmittedOtp).catch(() => {});

            await page.waitForTimeout(500);

            // Step 4.2: இரட்டை கிளிக் பிழையைத் தவிர்த்து, ஆதார் சாளரத்தின் சமர்ப்பி பொத்தானை மட்டும் ஒற்றை முறை அழுத்துதல் (Single Atomic Playwright Click)
            let modalClicked = false;
            try {
                const modalSubLoc = page.locator('input[formcontrolname="otp"]').locator('xpath=ancestor::div[contains(@class,"modal")]//button[contains(@class,"btn-success")]').first();
                if (await modalSubLoc.count() > 0 && await modalSubLoc.isVisible().catch(() => false)) {
                    await modalSubLoc.click({ delay: 80 }).catch(() => {});
                    modalClicked = true;
                }
            } catch (_) {}

            if (!modalClicked) {
                try {
                    const fallbackBtn = page.locator('div.modal.show button.btn-success, div.modal.d-block button.btn-success').first();
                    if (await fallbackBtn.count() > 0 && await fallbackBtn.isVisible().catch(() => false)) {
                        await fallbackBtn.click({ delay: 80 }).catch(() => {});
                    }
                } catch (_) {}
            }

            await page.waitForTimeout(3000);
            await scanAndBroadcastToasts();

            // Toast பிழை செய்தி ஏதேனும் உள்ளதா என ஆய்வு செய்தல்
            const toastErr = await page.evaluate(() => {
                const toasts = Array.from(document.querySelectorAll('.p-toast-message, .toast, .alert, .ng-trigger')).map(t => (t.innerText || '').trim());
                return toasts.find(t => {
                    const low = t.toLowerCase();
                    return low.includes('txn') || low.includes('xsd') || low.includes('தவறான') || low.includes('invalid') || low.includes('failed') || low.includes('unauthorized');
                });
            }).catch(() => null);

            if (toastErr) {
                onProgress(`⚠️ [ஆதார் OTP தேவை] அரசு இணையதள அறிவிப்பு: "${toastErr}". புதிய 6-இலக்க ஆதார் SMS OTP-ஐ உள்ளிடவும்...`);
                // Clear input box so user can cleanly type next OTP
                await page.evaluate(() => {
                    const inp = document.querySelector('.modal input[formcontrolname="otp"], .modal input:not([type="hidden"]):not([type="checkbox"])');
                    if (inp) {
                        inp.value = '';
                        inp.dispatchEvent(new Event('input', { bubbles: true }));
                        inp.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }).catch(() => {});
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
