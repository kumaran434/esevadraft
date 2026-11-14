/**
 * Step 21 & Step 22 OTP Verification & Member Form Readiness Gate for New Ration Card
 * 
 * Rules Enforced:
 * 1. Zero-Step-Skip Policy: An incomplete step NEVER proceeds to the next step.
 * 2. Absolute Modal & Backdrop Clearance: Waits for TNPDS server response and genuine modal dismissal.
 * 3. Zero-Fake-Bypass: NEVER forcibly hide the modal with style.display='none' when OTP is unverified!
 * 4. Government Error Detection: Flags invalid/expired OTP alerts before proceeding.
 * 5. Radware Zero-Halt Immunity: Handles "I am human" challenges and waits for clearance without aborting.
 * 6. Member Form Visibility Gate: Guarantees member addition form is open before Step 23.
 */

const fs = require('fs');
const path = require('path');
let resilientResumption = null;
try {
    resilientResumption = require('../add_member/resilient_step_resumption');
} catch (e) {
    try {
        resilientResumption = require(path.join(__dirname, '..', 'add_member', 'resilient_step_resumption.js'));
    } catch (e2) {}
}

async function verifyNewCardOtpAndSettle(page, receivedOtp, helpers = {}, options = {}) {
    const { onProgress, humanType, scanAndBroadcastToasts } = helpers;

    if (onProgress) {
        onProgress('📍 [படி 21/51] அரசு TNPDS மொபைல் OTP சரிபார்க்கப்படுகிறது...');
    }

    const isModalOpen = await page.evaluate(() => {
        const isShown = (el) => !!el && (el.offsetParent !== null || getComputedStyle(el).display !== 'none') && (el.offsetWidth > 0 || el.offsetHeight > 0);
        return Array.from(document.querySelectorAll('.modal, div[role="dialog"]')).some(isShown);
    }).catch(() => false);

    if (isModalOpen) {
        // STRICT SELECTOR: Specifically target editable OTP input, NEVER readonly prefix inputs like (+91)
        const otpInput = page.locator('input[formcontrolname="mobileOtp"], input[formcontrolname="otp"], input[name="mobileOtp"], .modal input[maxlength="6"]:not([readonly]):not([disabled]), .modal input[placeholder*="OTP"]:not([readonly]):not([disabled]), .modal input[placeholder*="கடவு"]:not([readonly]):not([disabled])').first();
        if (await otpInput.count() > 0 && await otpInput.isVisible().catch(() => false)) {
            const currentVal = (await otpInput.inputValue().catch(() => '')).replace(/\D/g, '');
            const targetOtp = (receivedOtp && receivedOtp !== 'ALREADY_VERIFIED_ON_PORTAL') ? String(receivedOtp).replace(/\D/g, '') : currentVal;
            if (targetOtp && targetOtp.length >= 6 && currentVal !== targetOtp) {
                await otpInput.scrollIntoViewIfNeeded().catch(() => {});
                await otpInput.click({ force: true }).catch(() => {});
                if (humanType) {
                    await humanType(page, otpInput, targetOtp, { isOtp: true });
                } else {
                    await otpInput.fill(targetOtp);
                }
                await page.waitForTimeout(400);
            }
        }

        // STRICT INVARIANT: Ensure OTP input contains at least 6 digits before proceeding to click verify!
        let activeVal = (await otpInput.inputValue().catch(() => '')).replace(/\D/g, '');
        if (activeVal.length < 6) {
            if (onProgress) {
                onProgress('⏳ [படி 21/51] அரசு TNPDS மொபைல் SMS OTP (6 அல்லது 7 இலக்கங்கள்) உள்ளிடப்படுவதற்காகக் காத்திருக்கிறது...');
            }
            for (let waitTick = 0; waitTick < 300; waitTick++) {
                await page.waitForTimeout(1000);

                // Auto-Heal: Check if user typed OTP into Chrome input directly and auto-click verify immediately!
                const liveTypeResult = await page.evaluate(() => {
                    const modal = document.querySelector('.modal.show, div[role="dialog"], .modal');
                    if (!modal) return null;
                    const inp = modal.querySelector('input[formcontrolname="mobileOtp"], input[formcontrolname="otp"], input[maxlength="6"]:not([readonly]):not([disabled]), input:not([readonly]):not([disabled]):not([type="hidden"])');
                    if (!inp) return null;
                    const val = (inp.value || '').replace(/\D/g, '');
                    if (val.length >= 6) {
                        inp.dispatchEvent(new Event('input', { bubbles: true }));
                        inp.dispatchEvent(new Event('change', { bubbles: true }));
                        inp.dispatchEvent(new Event('blur', { bubbles: true }));

                        const btns = Array.from(modal.querySelectorAll('button'));
                        const verifyBtn = btns.find(b => {
                            const t = (b.innerText || b.textContent || '').trim().toLowerCase();
                            const id = (b.id || '').toLowerCase();
                            const cls = (b.className || '').toLowerCase();
                            if (t.includes('மீண்டும்') || t.includes('resend') || t.includes('மறுமுறை')) return false;
                            if (t.includes('ரத்து') || t.includes('cancel') || t.includes('close') || t.includes('இல்லை')) return false;
                            if (t.includes('உருவாக்க') || t.includes('generate') || id.includes('send') || id.includes('resend')) return false;
                            if (t.includes('பதிவு செய்') || t.includes('சமர்ப்பி') || t.includes('submit') || t.includes('verify') || t.includes('சரிபார்') || cls.includes('btn-success')) return true;
                            if (b.closest('.modal-footer') && (cls.includes('btn-primary') || cls.includes('btn-success') || b.type === 'submit')) return true;
                            return false;
                        });
                        if (verifyBtn) {
                            verifyBtn.disabled = false;
                            verifyBtn.removeAttribute('disabled');
                            verifyBtn.classList.remove('disabled');
                            verifyBtn.click();
                            return { clicked: true, val };
                        }
                        return { clicked: false, val };
                    }
                    return null;
                }).catch(() => null);

                if (liveTypeResult && liveTypeResult.clicked) {
                    if (onProgress) onProgress(`🔑 [படி 21/51] அரசு மொபைல் OTP (${liveTypeResult.val}) தானாகக் கண்டறியப்பட்டது! 'சமர்ப்பிக்கவும் / பதிவு செய்' பொத்தான் வெற்றிகரமாக அழுத்தப்பட்டது!`);
                    await page.waitForTimeout(2500);
                    break;
                }

                // If modal naturally dismissed or verified outside, break immediately
                const modalStillOpen = await page.evaluate(() => {
                    const isShown = (el) => !!el && (el.offsetParent !== null || getComputedStyle(el).display !== 'none') && (el.offsetWidth > 0 || el.offsetHeight > 0);
                    return Array.from(document.querySelectorAll('.modal, div[role="dialog"]')).some(isShown);
                }).catch(() => false);
                const hasAddMemBtn = await page.locator('button:has-text("உறுப்பினரை சேர்க்க")').isVisible().catch(() => false);
                if (!modalStillOpen && (waitTick > 3 || hasAddMemBtn)) {
                    if (onProgress) onProgress('✅ [படி 21/51] அரசு போர்ட்டலில் OTP மாடல் வெற்றிகரமாக நிறைவுபெற்று மூடப்பட்டுவிட்டது!');
                    break;
                }

                // Auto-dismiss accidental exit modal
                await page.evaluate(() => {
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

                // Check Disk IPC file (data/pending_otp.txt) in case user or API provided OTP
                const pendingOtpCandidatePaths = [
                    path.join(__dirname, '..', '..', '..', '..', 'data', 'pending_otp.txt'),
                    path.join(process.env.APPDATA || '', 'esevadraft-desktop', 'data', 'pending_otp.txt'),
                    path.join(process.env.APPDATA || '', 'esevadraft-desktop', 'pending_otp.txt')
                ];
                for (const pPath of pendingOtpCandidatePaths) {
                    if (fs.existsSync(pPath)) {
                        try {
                            const diskVal = fs.readFileSync(pPath, 'utf8').trim().replace(/\D/g, '');
                            if (diskVal.length >= 6 && diskVal.length <= 8) {
                                try { fs.unlinkSync(pPath); } catch (_) {}
                                await otpInput.click({ force: true }).catch(() => {});
                                if (humanType) await humanType(page, otpInput, diskVal, { isOtp: true });
                                else await otpInput.fill(diskVal);
                                activeVal = diskVal;
                                break;
                            }
                        } catch (_) {}
                    }
                }

                // Check countdown expiry inside modal -> auto click resend to restore Submit button
                const resent = await page.evaluate(() => {
                    const modal = document.querySelector('.modal, div[role="dialog"]');
                    if (modal) {
                        const mText = (modal.innerText || '').trim();
                        const btns = Array.from(modal.querySelectorAll('button, a'));
                        const resendBtn = btns.find(b => {
                            const t = (b.innerText || '').toLowerCase();
                            return t.includes('மீண்டும்') || t.includes('மறுமுறை') || t.includes('resend') || t.includes('generate');
                        });
                        const hasVerifyBtn = btns.some(b => {
                            const t = (b.innerText || '').toLowerCase();
                            return t.includes('பதிவு செய்') || t.includes('சமர்ப்பி') || t.includes('submit') || t.includes('verify');
                        });

                        // If 0 seconds OR resend is present while verify is missing -> trigger fresh OTP
                        if ((mText.includes('0 நொடிகள்') || mText.includes('0 seconds') || mText.includes('காலாவதி') || (!hasVerifyBtn && resendBtn)) && resendBtn && !resendBtn.disabled) {
                            resendBtn.click();
                            return true;
                        }
                    }
                    return false;
                }).catch(() => false);

                if (resent && onProgress) {
                    onProgress('🔄 [OTP மீட்சி] முந்தைய OTP 60 நொடிகள் காலாவதியாகிவிட்டது! போர்ட்டலில் "மீண்டும் அனுப்புங்கள்" தானாக அழுத்தப்பட்டு புதிய OTP கோரப்பட்டது! புதிய SMS OTP-க்காகக் காத்திருக்கிறது...');
                }

                activeVal = (await otpInput.inputValue().catch(() => '')).replace(/\D/g, '');
                if (activeVal.length >= 6) {
                    if (onProgress) onProgress(`🔑 [படி 21/51] அரசு மொபைல் OTP (${activeVal}) உள்ளிடப்பட்டுவிட்டது! சரிபார்க்கப்படுகிறது...`);
                    break;
                }
            }
        }

        // Check if countdown expired inside modal -> auto click resend to re-enable submit button
        await page.evaluate(() => {
            const modal = document.querySelector('.modal.show, div[role="dialog"]');
            if (!modal) return;
            const resendBtn = Array.from(modal.querySelectorAll('button')).find(b => {
                const t = (b.innerText || '').trim();
                return t.includes('மீண்டும்') || t.includes('resend') || t.includes('மறுமுறை');
            });
            const verifyBtn = Array.from(modal.querySelectorAll('button')).find(b => {
                const t = (b.innerText || '').trim().toLowerCase();
                return t.includes('பதிவு செய்') || t.includes('சமர்ப்பி') || t.includes('submit') || t.includes('verify') || b.classList.contains('btn-success');
            });
            // If resend is visible and verify is missing, timer expired -> click resend
            if (resendBtn && !verifyBtn) {
                resendBtn.click();
            }
        }).catch(() => {});

        if (activeVal.length >= 6) {
            // Dispatch Angular reactive form events on mobileOtp input
            await page.evaluate((val) => {
                const inp = document.querySelector('.modal.show input[formcontrolname="mobileOtp"], div[role="dialog"] input[formcontrolname="mobileOtp"], input[formcontrolname="mobileOtp"], input:not([readonly]):not([disabled])');
                if (inp) {
                    inp.value = val;
                    inp.dispatchEvent(new Event('input', { bubbles: true }));
                    inp.dispatchEvent(new Event('change', { bubbles: true }));
                    inp.dispatchEvent(new Event('blur', { bubbles: true }));
                }
            }, activeVal).catch(() => {});
            await page.waitForTimeout(300);

            // Find verify button strictly inside active modal
            const verifyCandidates = page.locator('.modal button, div[role="dialog"] button');
            const cCount = await verifyCandidates.count();
            let clickedVerify = false;

            for (let i = 0; i < cCount; i++) {
                const btn = verifyCandidates.nth(i);
                const txt = ((await btn.innerText().catch(() => '')) || '').trim().toLowerCase();
                const bId = ((await btn.getAttribute('id').catch(() => '')) || '').toLowerCase();
                const cls = ((await btn.getAttribute('class').catch(() => '')) || '').toLowerCase();

                // Skip Generate / Resend / Cancel buttons
                if (bId.includes('send') || bId.includes('resend') || txt.includes('உருவாக்க') || txt.includes('generate') || txt.includes('மீண்டும்') || txt.includes('ரத்து') || txt.includes('cancel')) {
                    continue;
                }

                if (txt.includes('பதிவு செய்') || txt.includes('சமர்ப்பி') || txt.includes('submit') || txt.includes('verify') || txt.includes('சரிபார்') || cls.includes('btn-success') || cls.includes('btn-primary')) {
                    if (await btn.isVisible().catch(() => false)) {
                        await btn.scrollIntoViewIfNeeded().catch(() => {});
                        await btn.evaluate(b => { b.disabled = false; b.removeAttribute('disabled'); }).catch(() => {});
                        await btn.click({ force: true }).catch(() => {});
                        clickedVerify = true;
                        break;
                    }
                }
            }

            if (!clickedVerify) {
                // Fallback click via DOM strictly inside modal
                await page.evaluate(() => {
                    const modal = document.querySelector('.modal.show, div[role="dialog"], .modal');
                    if (!modal) return;
                    const btns = Array.from(modal.querySelectorAll('button'));
                    const vBtn = btns.find(b => {
                        const t = (b.innerText || b.textContent || '').trim().toLowerCase();
                        const id = (b.id || '').toLowerCase();
                        const cls = (b.className || '').toLowerCase();
                        if (id.includes('send') || id.includes('resend') || t.includes('உருவாக்க') || t.includes('generate') || t.includes('மீண்டும்') || t.includes('ரத்து') || t.includes('cancel')) return false;
                        if (t.includes('பதிவு செய்') || t.includes('சமர்ப்பி') || t.includes('submit') || t.includes('verify') || t.includes('சரிபார்') || cls.includes('btn-success')) return true;
                        if (b.closest('.modal-footer') && (cls.includes('btn-primary') || cls.includes('btn-success') || b.type === 'submit')) return true;
                        return false;
                    });
                    if (vBtn) {
                        vBtn.disabled = false;
                        vBtn.removeAttribute('disabled');
                        vBtn.classList.remove('disabled');
                        vBtn.click();
                    }
                }).catch(() => {});
            }
        }
    }

    if (scanAndBroadcastToasts) await scanAndBroadcastToasts();

    // STRICT GATE: Poll for server response, genuine modal dismissal or error (up to 15 seconds)
    let isModalDismissed = false;
    let otpErrorDetected = null;

    for (let poll = 0; poll < 30; poll++) {
        await page.waitForTimeout(500);

        // Auto-dismiss accidental exit confirmation dialog ("நீங்கள் வெளியேற விரும்புகிறீர்களா?") by clicking "இல்லை"
        await page.evaluate(() => {
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

        // 1. Radware Challenge Check (Zero-Halt Immunity)
        if (resilientResumption && typeof resilientResumption.isRadwareChallengeActive === 'function') {
            const isRad = await resilientResumption.isRadwareChallengeActive(page);
            if (isRad) {
                if (onProgress) {
                    onProgress('🛡️ [Radware மனித சரிபார்ப்பு] போர்ட்டலில் பாதுகாப்பு சவால் தோன்றியுள்ளது. சவால் முடியும் வரை காத்திருக்கிறது...');
                }
                await resilientResumption.clearRadwareAndSettle(page, onProgress);
            }
        }

        // 2. Check for government error alerts inside modal or DOM (Toasts, Alerts, Countdown expiry)
        const alertInfo = await page.evaluate(() => {
            // Check countdown timer expiry -> auto click resend button
            const modal = document.querySelector('.modal.show, div.modal[style*="display: block"], div[role="dialog"]:not([style*="display: none"]), .modal-dialog, .modal');
            if (modal) {
                const mText = (modal.innerText || modal.textContent || '').trim();
                if (mText.includes('0 நொடிகள்') || mText.includes('0 seconds') || mText.includes('காலாவதி')) {
                    const btns = Array.from(modal.querySelectorAll('button, a'));
                    const resendBtn = btns.find(b => {
                        const t = (b.innerText || '').toLowerCase();
                        return t.includes('மீண்டும்') || t.includes('மறுமுறை') || t.includes('resend') || t.includes('generate');
                    });
                    if (resendBtn && !resendBtn.disabled) {
                        resendBtn.click();
                        return '__OTP_RESENT_AUTOMATICALLY__';
                    }
                }
            }

            const errEls = Array.from(document.querySelectorAll('.p-toast-detail, .p-toast-message, .alert-danger, .alert-warning, .error-msg, .text-danger, .toast-error, .swal2-error, .swal2-html-container, span[style*="color: red"]'));
            for (const el of errEls) {
                const txt = (el.innerText || el.textContent || '').trim();
                if (txt.includes('அனுப்பப்பட்டுள்ளது') || txt.includes('கடவுச்சொல்லை உள்ளிடவும்')) continue;
                if (txt.includes('தவறான') || txt.includes('செல்லாது') || txt.includes('invalid') || txt.includes('தவறு') || txt.includes('ஏற்கனவே உள்ளது')) {
                    return txt;
                }
            }
            return null;
        }).catch(() => null);

        if (alertInfo === '__OTP_RESENT_AUTOMATICALLY__') {
            if (onProgress) {
                onProgress('🔄 [OTP மீட்சி] முந்தைய OTP காலம் முடிந்துவிட்டதால், போர்ட்டலில் "மீண்டும் அனுப்புங்கள்" தானாக அழுத்தப்பட்டது! புதிய OTP-க்காகக் காத்திருக்கிறது...');
            }
            await page.waitForTimeout(2000);
            continue;
        }

        if (alertInfo) {
            otpErrorDetected = alertInfo;
            break;
        }

        // 3. Genuine Modal Clearance Check
        const modalState = await page.evaluate(() => {
            const isShown = (el) => {
                if (!el) return false;
                const s = window.getComputedStyle(el);
                return s.display !== 'none' && s.visibility !== 'hidden' && (el.offsetWidth > 0 || el.offsetHeight > 0);
            };
            const visibleModals = Array.from(document.querySelectorAll('.modal, div[role="dialog"]')).filter(isShown);
            // Ignore exit confirmation modal if present
            const activeOtpModal = visibleModals.find(m => !((m.innerText || '').includes('வெளியேற விரும்புகிறீர்களா')));
            const hasVisibleModal = Boolean(activeOtpModal);
            const hasBackdrop = Boolean(document.querySelector('.modal-backdrop'));
            const memberSectionUnlocked = Boolean(document.querySelector('#memberFormSection, input[formcontrolname="dateOfBirth"]'));
            return { hasVisibleModal, hasBackdrop, memberSectionUnlocked };
        }).catch(() => ({ hasVisibleModal: false, hasBackdrop: false, memberSectionUnlocked: false }));

        // Genuine success: modal naturally closed AND no backdrop, OR member section is already open/unlocked
        if (modalState.memberSectionUnlocked || (!modalState.hasVisibleModal && !modalState.hasBackdrop)) {
            isModalDismissed = true;
            break;
        }

        // If modal naturally closed but a harmless transparent backdrop was left behind:
        if (!modalState.hasVisibleModal && modalState.hasBackdrop) {
            await page.evaluate(() => {
                document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
                document.body.classList.remove('modal-open');
            }).catch(() => {});
            isModalDismissed = true;
            break;
        }
    }

    if (otpErrorDetected) {
        if (onProgress) {
            onProgress(`🚨 **அரசு TNPDS பிழை கண்டறியப்பட்டது:**\n"${otpErrorDetected}"\nதயவுசெய்து சரியான OTP-ஐ உள்ளிடவும்.`);
        }
        return { success: false, error: otpErrorDetected };
    }

    if (!isModalDismissed) {
        // Inspect active modal DOM to diagnose exact reason for failure
        const diagInfo = await page.evaluate(() => {
            const isShown = (el) => {
                if (!el) return false;
                const s = window.getComputedStyle(el);
                return s.display !== 'none' && s.visibility !== 'hidden' && (el.offsetWidth > 0 || el.offsetHeight > 0);
            };
            const m = Array.from(document.querySelectorAll('.modal, div[role="dialog"]')).find(isShown);
            if (!m) return 'மாடல் மூடப்படவில்லை.';
            const text = (m.innerText || '').substring(0, 200).replace(/\s+/g, ' ');
            return 'மாடல் நிலை: ' + text;
        }).catch(() => 'மாடல் திறந்தே உள்ளது.');

        if (onProgress) {
            onProgress(`⚠️ **கடும் பூட்டு நிறுத்தம் (Strict Gate Halt):** அரசு போர்ட்டலில் OTP சரிபார்க்கப்படவில்லை! [${diagInfo}] அடுத்த படிக்குச் செல்லாமல் செயல்முறை பாதுகாப்பாக நிறுத்தப்படுகிறது.`);
        }
        return { success: false, error: 'OTP_NOT_VERIFIED_ON_PORTAL: ' + diagInfo };
    }

    // Clean up any lingering backdrops
    await page.evaluate(() => {
        document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
        document.body.classList.remove('modal-open');
    }).catch(() => {});

    if (onProgress) {
        onProgress('✅ [படி 21/51] அரசு TNPDS மொபைல் OTP வெற்றிகரமாகச் சரிபார்க்கப்பட்டு பூட்டப்பட்டது!');
    }

    return { success: true };
}

async function ensureMemberAdditionFormReady(page, onProgress = () => {}) {
    onProgress('📍 [படி 22/51] உறுப்பினரை சேர்க்க படிவம் திறக்கப்படுகிறது...');
    const dobLocator = page.locator('input[formcontrolname="dateOfBirth"], input[placeholder*="DD/MM/YYYY"]').first();

    for (let attempt = 1; attempt <= 5; attempt++) {
        const isVisible = await dobLocator.isVisible().catch(() => false);
        if (isVisible) {
            onProgress('✅ [படி 22/51] குடும்ப உறுப்பினர் சேர்க்கைப் படிவம் வெற்றிகரமாகத் திறக்கப்பட்டது!');
            return { success: true };
        }

        // Clean any lingering modal overlays and force-trigger the Add Member button via direct DOM + Angular events
        await page.evaluate(() => {
            document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
            document.body.classList.remove('modal-open');
            const btns = Array.from(document.querySelectorAll('button'));
            const btn = btns.find(b => {
                const t = (b.innerText || '').trim().toLowerCase();
                return t.includes('உறுப்பினரை சேர்க்க') || t.includes('add member');
            });
            if (btn) {
                btn.disabled = false;
                btn.removeAttribute('disabled');
                btn.classList.remove('disabled');
                btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                btn.click();
            }
        }).catch(() => {});

        const addMemBtn = page.getByRole('button', { name: /உறுப்பினரை சேர்க்க|Add Member/i })
            .or(page.locator('button:has-text("உறுப்பினரை சேர்க்க"), button:has-text("Add Member")'))
            .first();

        if (await addMemBtn.count() > 0) {
            await addMemBtn.scrollIntoViewIfNeeded().catch(() => {});
            await addMemBtn.evaluate(b => {
                b.disabled = false;
                b.removeAttribute('disabled');
                b.classList.remove('disabled');
            }).catch(() => {});
            await addMemBtn.click({ force: true }).catch(() => {});
        }

        await dobLocator.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
    }

    const finalCheck = await dobLocator.isVisible().catch(() => false);
    if (!finalCheck) {
        onProgress('⚠️ **கடும் பூட்டு நிறுத்தம் (Strict Gate Halt):** உறுப்பினர் சேர்க்கைப் படிவம் திரையில் திறக்கப்படவில்லை! அடுத்த படிக்குச் செல்லாமல் செயல்முறை பாதுகாப்பாக நிறுத்தப்படுகிறது.');
        return { success: false, error: 'MEMBER_FORM_NOT_OPEN' };
    }

    onProgress('✅ [படி 22/51] குடும்ப உறுப்பினர் சேர்க்கைப் படிவம் வெற்றிகரமாகத் திறக்கப்பட்டது!');
    return { success: true };
}

module.exports = {
    verifyNewCardOtpAndSettle,
    ensureMemberAdditionFormReady
};
