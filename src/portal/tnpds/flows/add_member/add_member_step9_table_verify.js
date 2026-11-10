/**
 * TNPDS Add Member - Step 9b: Aadhaar OTP Modal Handling & Table Verification
 */

async function executeStep9TableVerify(page, memberContext, options, onProgress, sharedContext, scanAndBroadcastToasts) {
    const {
        showBrowserHud = async () => {},
        requestOtpFromUser = async () => '',
        tryAutoClickCaptcha = async () => false,
        saveTnpdsCookies = async () => {}
    } = sharedContext;

    let addMemberResumption = sharedContext.addMemberResumption;
    if (!addMemberResumption) {
        try {
            addMemberResumption = require('../../add_member/resilient_step_resumption');
        } catch (_) {
            try {
                addMemberResumption = require('../../../add_member/resilient_step_resumption');
            } catch (_) {}
        }
    }

    const { memberNameTam, memberNameEng, relTam } = memberContext;

    const isAadhaarModalOpen = async () => {
        return await page.evaluate(() => {
            const otpInp = document.querySelector('input[formcontrolname="otp"]');
            if (otpInp && otpInp.offsetParent !== null) return true;
            const modals = Array.from(document.querySelectorAll('div.modal, div[role="dialog"], .modal-dialog'));
            return modals.some(m => {
                const rootModal = m.closest('div.modal') || m;
                const s = window.getComputedStyle(rootModal);
                const isVis = m.offsetParent !== null && s.display !== 'none' && s.visibility !== 'hidden';
                const txt = m.innerText || '';
                return isVis && (txt.includes('OTP சரிபார்ப்பு') || txt.includes('சரியான OTP') || txt.includes('OTP') || Boolean(m.querySelector('input[formcontrolname="otp"]')));
            });
        }).catch(() => false);
    };

    const clickAadhaarSubmit = async () => {
        return await page.evaluate(() => {
            const allBtns = Array.from(document.querySelectorAll('.modal button, .modal div.btn, button, input[type="button"], input[type="submit"]'));
            const subBtn = allBtns.find(b => {
                if (b.offsetParent === null) return false;
                const t = (b.innerText || b.value || '').trim();
                return (t === 'சமர்ப்பிக்கவும்' || t.includes('சமர்ப்பிக்கவும்') || t === 'Submit' || t.includes('சரிபார்')) && !t.includes('ரத்து') && !t.includes('Cancel');
            });
            if (subBtn) { subBtn.disabled = false; subBtn.click(); return true; }
            return false;
        }).catch(() => false);
    };

    let isAadhaarOtpModalVisible = false;
    let aadhaarOtpHandled = false;
    let memberAddedToTable = false;

    onProgress('🔍 [சரிபார்ப்பு] புதிய உறுப்பினர் அட்டவணையில் சேர்க்கப்பட்டுள்ளாரா / ஆதார் OTP சரிபார்க்கப்படுகிறது...');

    // Resilient Verification Loop (handles server latency, Aadhaar SMS delay, and Radware challenges)
    for (let t = 0; t < 180; t++) {
        // 1. Radware / Perfdrive challenge detection -> wait & trigger full Page-Start Restart from Step 4
        if (addMemberResumption && await addMemberResumption.isRadwareChallengeActive(page)) {
            onProgress('🛡️ [Radware சோதனை] பாதுகாப்பு சோதனை திரையில் உள்ளது — தீர்க்கப்பட்டதும் இப்பக்கத்தின் ஆரம்ப படியிலிருந்து (படி 4) மீண்டும் தொடங்கும்...');
            await addMemberResumption.clearRadwareAndSettle(page, onProgress, tryAutoClickCaptcha, saveTnpdsCookies);
            const rErr = new Error('RADWARE_PAGE_REFRESH_DETECTED:படி 9/12');
            rErr.isRadwarePageRefresh = true;
            rErr.stepLabel = 'படி 9/12';
            throw rErr;
        }

        // 1b. Check if portal redirected to home or login due to server timeout or Radware reload -> restart from Step 4
        const curUrl = page.url().toLowerCase();
        if (curUrl.includes('/pages/home') || curUrl.includes('/auth/login')) {
            onProgress(`⚠️ [அரசு அமர்வு மாற்றம்] அரசு தளம் (${curUrl}) பக்கத்திற்குச் சென்றுள்ளது. இப்பக்கத்தின் ஆரம்ப படியிலிருந்து (படி 4) மீண்டும் தொடங்கப்படுகிறது...`);
            const rErr = new Error('RADWARE_PAGE_REFRESH_DETECTED:படி 9/12');
            rErr.isRadwarePageRefresh = true;
            rErr.stepLabel = 'படி 9/12';
            throw rErr;
        }

        // 2. Check if member row is added to the table
        const isAdded = await page.evaluate(({ nameTam, nameEng }) => {
            const tables = Array.from(document.querySelectorAll('table, mat-table, .table, .mat-table'));
            if (tables.length === 0) return false;
            const tbl = tables[tables.length - 1];
            const rows = Array.from(tbl.querySelectorAll('tbody tr, tr, mat-row'));
            const firstTamWord = (nameTam || '').split(' ')[0] || '';
            const firstEngWord = (nameEng || '').split(' ')[0] || '';
            return rows.some(r => {
                const txt = r.innerText || '';
                if (txt.includes('குடும்ப தலைவர்') || txt.includes('Head of')) return false;
                const hasName = (nameTam && txt.includes(nameTam)) || (nameEng && txt.includes(nameEng)) || (firstTamWord && firstTamWord.length > 2 && txt.includes(firstTamWord)) || (firstEngWord && firstEngWord.length > 2 && txt.includes(firstEngWord));
                return hasName && !txt.includes('ஆவணங்கள் காணப்படவில்லை');
            });
        }, { nameTam: memberNameTam, nameEng: memberNameEng }).catch(() => false);

        const modalOpen = await isAadhaarModalOpen();
        if (isAdded && !modalOpen) {
            memberAddedToTable = true;
            onProgress(`✅ [Gate ✓] உறுப்பினர் "${memberNameTam}" (${memberNameEng}) அட்டவணையில் வெற்றிகரமாக சேர்க்கப்பட்டார்!`);
            break;
        }

        // 3. Dynamic Aadhaar OTP Modal Handler (triggers whenever government portal renders the OTP modal)
        if (modalOpen && !aadhaarOtpHandled) {
            isAadhaarOtpModalVisible = true;
            onProgress(`🔐 [ஆதார் OTP தேவை] உறுப்பினர் "${memberNameTam}" (${memberNameEng}) அவர்களின் ஆதார் எண்ணிற்கு அரசு SMS OTP அனுப்பியுள்ளது!`);
            await showBrowserHud('[ஆதார் OTP தேவை]', `${memberNameTam} ஆதார் OTP உள்ளிடவும் (Chrome அல்லது Chat)`, 'warning');

            // Dual-Listener: Chrome screen entry OR Chat entry
            let screenOtpSubmitted = false;
            const screenOtpCheckPromise = (async () => {
                for (let sCheck = 0; sCheck < 360; sCheck++) { // Up to 180 seconds for OTP typing
                    if (screenOtpSubmitted) break;
                    if (page.isClosed()) break;
                    // If Radware is active, wait without resolving prematurely
                    if (addMemberResumption && await addMemberResumption.isRadwareChallengeActive(page).catch(() => false)) {
                        await page.waitForTimeout(1000).catch(() => {});
                        continue;
                    }
                    const typedOtp = await page.evaluate(() => {
                        const otpInp = document.querySelector('input[formcontrolname="otp"]') ||
                                       Array.from(document.querySelectorAll('.modal input')).find(i => (i.value || '').replace(/\D/g, '').length === 6);
                        if (otpInp) {
                            const val = (otpInp.value || '').replace(/\D/g, '');
                            if (val.length === 6) return val;
                        }
                        return null;
                    }).catch(() => null);

                    if (typedOtp && typedOtp.length === 6) {
                        onProgress(`⚡ [Dual Listener] ஆபரேட்டர் குரோம் திரையிலேயே 6-இலக்க ஆதார் OTP (${typedOtp}) உள்ளிட்டுவிட்டார்! தானாக சமர்ப்பிக்கப்படுகிறது...`);
                        screenOtpSubmitted = true;
                        await clickAadhaarSubmit().catch(() => {});
                        return typedOtp;
                    }
                    await page.waitForTimeout(500).catch(() => {});
                }
                return null;
            })();

            const userOtpPromise = requestOtpFromUser(
                `🔐 **உறுப்பினர் ஆதார் சரிபார்ப்பு OTP (${memberNameTam} - ${relTam}):**\n\n` +
                `அரசு TNPDS தளம் மூலம் **${memberNameTam}** அவர்களின் ஆதார் இணைக்கப்பட்ட கைபேசி எண்ணிற்கு 6-இலக்க ஆதார் OTP அனுப்பப்பட்டுள்ளது.\n\n` +
                `அந்த OTP எண்ணை உள்ளிடவும் (Chrome திரையிலோ அல்லது இங்கேயோ உள்ளிடலாம்):`,
                onProgress, 'aadhaar_otp', page
            );

            const winnerOtp = await Promise.race([screenOtpCheckPromise, userOtpPromise]);
            let targetOtp = (winnerOtp && winnerOtp !== 'ALREADY_VERIFIED_ON_PORTAL') ? String(winnerOtp).replace(/\D/g, '') : '';
            if (targetOtp && targetOtp.length === 6) {
                aadhaarOtpHandled = true;
                if (!screenOtpSubmitted) {
                    await page.evaluate((otpVal) => {
                        const otpInp = document.querySelector('input[formcontrolname="otp"]') ||
                                       Array.from(document.querySelectorAll('.modal input')).find(i => !(i.getAttribute('formcontrolname') || '').toLowerCase().includes('aadhaar')) ||
                                       document.querySelector('input[type="text"]:not([readonly])');
                        if (otpInp) {
                            otpInp.value = otpVal;
                            otpInp.dispatchEvent(new Event('input', { bubbles: true }));
                            otpInp.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    }, targetOtp).catch(() => {});
                    await clickAadhaarSubmit().catch(() => {});
                }

                // Wait for government UIDAI server to validate OTP and close modal (up to 90s)
                onProgress('⏳ [சரிபார்க்கப்படுகிறது] அரசு TNPDS மற்றும் UIDAI சர்வர் ஆதார் OTP-ஐ சரிபார்க்கிறது... தயவுசெய்து காத்திருக்கவும்.');
                for (let w = 0; w < 90; w++) {
                    if (!(await isAadhaarModalOpen().catch(() => false))) break;
                    const checkUrl = (page.url() || '').toLowerCase();
                    if (checkUrl.includes('/pages/home')) break;
                    await page.waitForTimeout(1000).catch(() => {});
                }
                if (typeof scanAndBroadcastToasts === 'function') {
                    await scanAndBroadcastToasts().catch(() => {});
                }
                t = 0; // Reset counter after OTP verification to give server time to refresh table
            }
            continue;
        }

        // 4. Retry clicking "உறுப்பினரை சேர்க்க" (or trigger Page-Start Restart from Step 4 if page refreshed) when not added and no modal open
        const isAnyModalOpen = modalOpen;
        if (!memberAddedToTable && !isAadhaarOtpModalVisible && !isAnyModalOpen && t >= 4 && t % 6 === 0) {
            const isFormWipedNow = await page.evaluate(() => {
                const n = document.querySelector('input[formcontrolname="name"]');
                return !n || !n.value || n.value.trim().length === 0;
            }).catch(() => false);
            if (isFormWipedNow) {
                const rErr = new Error('RADWARE_PAGE_REFRESH_DETECTED:படி 9/12');
                rErr.isRadwarePageRefresh = true;
                rErr.stepLabel = 'படி 9/12';
                throw rErr;
            } else {
                const addBtn = page.locator('button.btn-warning:has-text("உறுப்பினரை சேர்க்க"), button.btn-orange:has-text("உறுப்பினரை சேர்க்க"), button:has-text("உறுப்பினரை சேர்க்க")').first();
                if (await addBtn.count() > 0 && await addBtn.isVisible().catch(() => false)) {
                    await addBtn.click({ force: true }).catch(() => {});
                }
            }
        }

        // 5. Fatal portal alerts check
        const portalAlertMsg = await page.evaluate(() => {
            const alerts = Array.from(document.querySelectorAll('.alert-danger, .error-msg, .toast-error, snack-bar-container, .alert'));
            const txt = alerts.map(a => a.innerText.trim()).join(' ');
            if (txt.includes('விநாடிகளுக்குள் OTP')) return '';
            return txt;
        }).catch(() => '');

        if (portalAlertMsg && portalAlertMsg.includes('ஏற்கனவே மற்றொரு குடும்ப அட்டையில்')) {
            onProgress(`🛑 [அரசு அறிவிப்பு] உறுப்பினர் ஏற்கனவே மற்றொரு குடும்ப அட்டையில் உள்ளார்: ${portalAlertMsg}`);
            return { success: false, message: portalAlertMsg };
        }

        await page.waitForTimeout(1000);
    }

    if (!memberAddedToTable) {
        throw new Error(`TABLE_GATE_HALT: உறுப்பினர் "${memberNameTam}" அட்டவணையில் உறுதி செய்யப்படவில்லை.`);
    }

    return { success: true };
}

module.exports = {
    executeStep9TableVerify
};
