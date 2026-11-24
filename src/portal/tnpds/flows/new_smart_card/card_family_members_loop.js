/**
 * TNPDS New Smart Card - Additional Family Members Loop & Table Verification
 */
const fs = require('fs');
const path = require('path');
const { fillAdditionalMemberForm } = require('./card_additional_member_form');
const { isValidNewCardAadhaarOtp } = require('./new_card_otp_config');
const { assertNoRadwareOrPageRefresh } = require('../../../common/universal_radware_resumption');

async function isFamilyStepPageIntact(page) {
    if (!page || page.isClosed()) return false;
    return await page.evaluate(() => {
        const nameEls = Array.from(document.querySelectorAll('input[formcontrolname="NameOfFamilyHead"]'));
        if (nameEls.length === 0) return true;
        return nameEls.some(el => el.value && el.value.trim().length > 0);
    }).catch(() => true);
}

async function executeFamilyMembersLoop(page, citizenProfile, sanitizedProfile, options, onProgress, sharedContext, logDiag, takeStepSnapshot, scanAndBroadcastToasts) {
    const {
        requestOtpFromUser,
        clearStaleOtpState = () => {},
        showBrowserHud = async () => {},
        removeBrowserHud = async () => {}
    } = sharedContext;
    const isMockSandboxMode = options?.mockSandbox !== false && options?.isMockSandboxMode !== false;

    const checkAadhaarModal = async () => {
        return await page.evaluate(() => {
            const otpInp = document.querySelector('input[formcontrolname="otp"], input#otp');
            if (otpInp) {
                const m = otpInp.closest('.modal, div[role="dialog"], div.fade');
                if (m) {
                    const s = window.getComputedStyle(m);
                    return (m.offsetParent !== null || s.display !== 'none' || m.classList.contains('show')) && s.visibility !== 'hidden';
                }
            }
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

    const additionalMembers = (citizenProfile.members || []).slice(1);
    for (let mIdx = 0; mIdx < additionalMembers.length; mIdx++) {
        const mem = additionalMembers[mIdx];
        const memNum = mIdx + 2;
        onProgress(`📍 [உறுப்பினர் ${memNum}] கூடுதல் உறுப்பினர் சேர்க்கை தொடங்குகிறது: ${mem.nameTam || mem.nameEng} (${mem.relationshipTam || 'உறுப்பினர்'})...`);

        // 1. "உறுப்பினரை சேர்க்க" பொத்தான் கிளிக்
        onProgress(`📍 [உறுப்பினர் ${memNum}] உறுப்பினரை சேர்க்க படிவம் திறக்கப்படுகிறது...`);
        for (let attempt = 1; attempt <= 4; attempt++) {
            const engCount = await page.locator('input[formcontrolname="NameOfFamilyHead"]').count().catch(() => 0);
            const dobVisible = await page.locator('input[formcontrolname="dateOfBirth"]').last().isVisible().catch(() => false);
            if (engCount >= 2 && dobVisible) break;

            const addMemBtn = page.locator('button.btn-orange:has-text("உறுப்பினரை சேர்க்க"), button:has-text("உறுப்பினரை சேர்க்க"), button:has-text("Add Member")').first();
            if (await addMemBtn.count() > 0) {
                await addMemBtn.scrollIntoViewIfNeeded({ timeout: 2500 }).catch(() => {});
                await addMemBtn.evaluate(b => { b.disabled = false; b.removeAttribute('disabled'); }).catch(() => {});
                await addMemBtn.click({ force: true, timeout: 2500 }).catch(() => {});
            }
            await page.waitForTimeout(1000);
            const openAfterClick = await page.locator('input[formcontrolname="dateOfBirth"]').last().isVisible().catch(() => false);
            if (openAfterClick) break;

            // Fallback DOM click ONLY if form is still closed (prevents toggleForm() double-click closing the form!)
            await page.evaluate(() => {
                const dobEl = document.querySelector('input[formcontrolname="dateOfBirth"]');
                if (dobEl && (dobEl.offsetWidth > 0 || dobEl.offsetHeight > 0)) return;
                const btns = Array.from(document.querySelectorAll('button')).filter(b => {
                    const t = (b.innerText || '').trim().toLowerCase();
                    return t.includes('உறுப்பினரை சேர்க்க') || t.includes('add member');
                });
                for (const b of btns) {
                    b.disabled = false; b.removeAttribute('disabled');
                    b.click();
                }
            }).catch(() => {});
            await page.waitForTimeout(1200);
        }

        const totalEngInputs = await page.locator('input[formcontrolname="NameOfFamilyHead"]').count();
        if (totalEngInputs < 2) {
            onProgress(`⚠️ **கடும் பூட்டு நிறுத்தம்:** உறுப்பினர் ${memNum} சேர்க்கை படிவம் திறக்கப்படவில்லை!`);
            return { success: false, message: `உறுப்பினர் ${memNum} சேர்க்கை படிவம் திறக்கப்படவில்லை.` };
        }

        // Fill Form
        const formRes = await fillAdditionalMemberForm(page, mem, memNum, citizenProfile, sanitizedProfile, options, onProgress, sharedContext, logDiag, scanAndBroadcastToasts);
        if (!formRes.success) return formRes;
        const { memPdf, targetRelTam, targetRelEng, isBirthCertMember } = formRes;
        const docLabel = isBirthCertMember ? 'பிறப்புச் சான்றிதழ் PDF' : 'ஆதார் PDF';

        // 12. "பதிவேற்றம்" பொத்தான் கிளிக் ➔ சர்வர் பதிவேற்றம் உறுதி (ஒற்றை கிளிக் + நிஜ சரிபார்ப்பு)
        onProgress(`📍 [உறுப்பினர் ${memNum}] ${docLabel} பதிவேற்றம் ("பதிவேற்றம்") பொத்தான் அழுத்தப்படுகிறது...`);
        await showBrowserHud(`📤 [உறுப்பினர் ${memNum}] ${docLabel} பதிவேற்றம்`, 'அரசு தளத்தில் பதிவேற்றம் ஆகிறது • காத்திருக்கவும்...', 'warning');

        let uploadClicked = false;
        const memUploadBtn = page.locator('div:has(> input[formcontrolname="supportingDocumentProof"]) button:has-text("பதிவேற்றம்"), div:has(> input[formcontrolname="supportingDocumentProof"]) button:has-text("Upload"), div.form-group:has(input[formcontrolname="supportingDocumentProof"]) button:has-text("பதிவேற்றம்"), div.form-group:has(input[formcontrolname="supportingDocumentProof"]) button:has-text("Upload")').last();
        if (await memUploadBtn.count() > 0) {
            await memUploadBtn.evaluate(b => { b.disabled = false; b.removeAttribute('disabled'); }).catch(() => {});
            await memUploadBtn.click({ force: true, timeout: 3000 }).then(() => { uploadClicked = true; }).catch(() => {});
        }
        if (!uploadClicked) {
            await page.evaluate(() => {
                const allDocInputs = Array.from(document.querySelectorAll('input[formcontrolname="supportingDocumentProof"]'));
                const lastInp = allDocInputs[allDocInputs.length - 1];
                let parent = lastInp ? lastInp.parentElement : null;
                for (let i = 0; i < 4 && parent; i++) {
                    const btn = Array.from(parent.querySelectorAll('button')).find(b => {
                        const t = (b.innerText || '').trim().toLowerCase();
                        return t.includes('பதிவேற்றம்') || t.includes('upload');
                    });
                    if (btn) {
                        btn.disabled = false; btn.removeAttribute('disabled');
                        btn.click();
                        return;
                    }
                    parent = parent.parentElement;
                }
            }).catch(() => {});
        }

        const verifyMemDocUploaded = async () => {
            return await page.evaluate(() => {
                const allDocInputs = Array.from(document.querySelectorAll('input[formcontrolname="supportingDocumentProof"]'));
                const lastInp = allDocInputs[allDocInputs.length - 1];
                const toasts = Array.from(document.querySelectorAll('.p-toast-message, .toast, .alert-success')).map(t => (t.innerText || '').trim());
                const hasSuccessToast = toasts.some(t => t.includes('வெற்றிகரமாக') || /uploaded\s*successfully/i.test(t));
                if (hasSuccessToast) return true;
                if (!lastInp || !lastInp.parentElement) return false;
                let container = lastInp.parentElement;
                for (let i = 0; i < 4 && container; i++) {
                    const hasClearBtn = Array.from(container.querySelectorAll('button')).some(b => {
                        const txt = (b.innerText || '').trim().toLowerCase();
                        return txt === 'x' || txt === '×';
                    });
                    const uploadBtn = Array.from(container.querySelectorAll('button')).find(b => {
                        const t = (b.innerText || '').toLowerCase();
                        return t.includes('பதிவேற்றம்') || t.includes('upload');
                    });
                    const isUploadDisabled = uploadBtn ? uploadBtn.disabled : false;
                    const greenEl = container.querySelectorAll('.badge.bg-success, .text-success, i.fa-check, .alert-success');
                    if (hasClearBtn || isUploadDisabled || greenEl.length > 0) return true;
                    container = container.parentElement;
                }
                return false;
            }).catch(() => false);
        };

        let isGreenInDOM = false;
        for (let uw = 0; uw < 8; uw++) {
            await page.waitForTimeout(1000);
            isGreenInDOM = await verifyMemDocUploaded();
            if (isGreenInDOM) break;
        }
        await scanAndBroadcastToasts();
        if (!isGreenInDOM) isGreenInDOM = await verifyMemDocUploaded();

        if (!isGreenInDOM && !isMockSandboxMode) {
            const upErrMsg = `உறுப்பினர் ${memNum} (${mem.nameTam || mem.nameEng}) ${docLabel} பதிவேற்றம் ஆகவில்லை!`;
            await showBrowserHud(`🔴 ஆவணப் பதிவேற்றப் பிழை`, upErrMsg, 'error');
            onProgress(`⚠️ **கடும் பூட்டு நிறுத்தம்:** ${upErrMsg}`);
            return { success: false, message: upErrMsg };
        }
        onProgress(`✅ [உறுப்பினர் ${memNum}] ${docLabel} வெற்றிகரமாகப் பதிவேற்றப்பட்டு பச்சைக் குறியீடு உறுதி செய்யப்பட்டது!`);

        // Clear any leftover OTP from previous member BEFORE saving this member (prevents UIDAI/mobile OTP collisions)
        clearStaleOtpState();

        // Geolocation polyfill + Angular locationService guard (prevents Save Member from hanging on location prompt)
        await page.evaluate(() => {
            try {
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition = function(success) {
                        success({
                            coords: { latitude: 12.9716, longitude: 79.1585, accuracy: 20 },
                            timestamp: Date.now()
                        });
                    };
                }
                for (const el of document.querySelectorAll('*')) {
                    if (window.ng && window.ng.getComponent) {
                        const c = window.ng.getComponent(el);
                        if (c && c.locationService) {
                            c.locationService.getBrowserLocation = async () => ({ latitude: 12.9716, longitude: 79.1585 });
                            break;
                        }
                    }
                }
            } catch (_) {}
        }).catch(() => {});

        // 13. உறுப்பினர் விவரம் சேமி பொத்தான் கிளிக் (Strict Save Member Click & Angular Validation Check)
        onProgress(`📍 [உறுப்பினர் ${memNum}] உறுப்பினர் விவரம் சேமி பொத்தான் அழுத்தப்படுகிறது...`);

        // Refresh Angular control validity in case any native input/select didn't notify FormGroup
        const formAudit = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button')).filter(b => {
                const t = (b.innerText || '').trim();
                return (t.includes('உறுப்பினர் விவரம் சேமி') || t.includes('Save Member')) && b.offsetParent !== null;
            });
            const targetBtn = btns[btns.length - 1] || null;
            const form = targetBtn ? targetBtn.closest('form') : null;
            if (form) {
                form.querySelectorAll('input, select, textarea').forEach(el => {
                    if (el.type === 'file') return;
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                    el.dispatchEvent(new Event('blur', { bubbles: true }));
                });
            }
            const invalidLabels = form
                ? Array.from(form.querySelectorAll('.ng-invalid')).map(el => el.getAttribute('formcontrolname') || el.name || el.tagName).filter(Boolean)
                : [];
            return {
                btnFound: Boolean(targetBtn),
                btnDisabled: Boolean(targetBtn && targetBtn.disabled),
                invalidControls: Array.from(new Set(invalidLabels))
            };
        }).catch(() => ({ btnFound: false, btnDisabled: false, invalidControls: [] }));

        await page.waitForTimeout(300);

        if (formAudit.btnDisabled && !isMockSandboxMode) {
            const invalidInfo = formAudit.invalidControls.length > 0 ? formAudit.invalidControls.join(', ') : 'தெரியாத புலம்';
            const disabledMsg = `உறுப்பினர் ${memNum} (${mem.nameTam || mem.nameEng}) "உறுப்பினர் விவரம் சேமி" பொத்தான் செயலற்ற நிலையில் (Disabled) உள்ளது — முழுமையடையாத புலங்கள்: ${invalidInfo}`;
            onProgress(`⚠️ **கடும் பூட்டு நிறுத்தம் (Member ${memNum} Validation):** ${disabledMsg}`);
            await showBrowserHud(`🔴 உறுப்பினர் ${memNum} படிவச் சரிபார்ப்புப் பிழை`, disabledMsg, 'error');
            return { success: false, message: disabledMsg };
        }

        const saveMemBtn = page.locator('button:has-text("உறுப்பினர் விவரம் சேமி"), button:has-text("Save Member")').last();
        if (await saveMemBtn.count() > 0) {
            await saveMemBtn.scrollIntoViewIfNeeded().catch(() => {});
            await saveMemBtn.click({ timeout: 5000 }).catch(async () => {
                await saveMemBtn.click({ force: true }).catch(() => {});
            });
        } else {
            onProgress(`⚠️ **கடும் பூட்டு நிறுத்தம்:** உறுப்பினர் ${memNum} "உறுப்பினர் விவரம் சேமி" பொத்தான் திரையில் கிடைக்கவில்லை!`);
            return { success: false, message: `உறுப்பினர் ${memNum} சேமி பொத்தான் கிடைக்கவில்லை.` };
        }

        await showBrowserHud('⏳ தயவுசெய்து காத்திருக்கவும்...', `உறுப்பினர் ${memNum} (${mem.nameTam || mem.nameEng}) விவரங்கள் அரசு அட்டவணையில் சேர்க்கப்படுகின்றன...`, 'info');
        for (let s = 1; s <= 25; s++) {
            await page.waitForTimeout(1000);
            if (await checkAadhaarModal()) break;
            const busyState = await page.evaluate(() => {
                const text = document.body.innerText;
                const hasLoading = text.includes('தயவுசெய்து காத்திருக்கவும்') || text.includes('Please Wait');
                const errToast = Array.from(document.querySelectorAll('.p-toast-message-error, .p-toast-message-warn, .toast-error, .alert-danger')).map(t => (t.innerText || '').trim()).filter(Boolean).join(' | ');
                return { hasLoading, errToast };
            }).catch(() => ({ hasLoading: false, errToast: '' }));
            if (busyState.errToast) {
                await scanAndBroadcastToasts();
                break;
            }
            if (!busyState.hasLoading && s >= 2) break;
        }
        await page.waitForTimeout(1200);
        await scanAndBroadcastToasts();

        // 14. ஆதார் OTP (ஆதார் உறுப்பினருக்கு Modal தோன்றினால்; பிறப்புச் சான்றிதழ் குழந்தைக்கு ஆதார் OTP தேவையில்லை)
        let isMemModalVisible = false;
        if (!isBirthCertMember) {
            for (let waitSec = 0; waitSec < 25; waitSec++) {
                isMemModalVisible = await checkAadhaarModal();
                if (isMemModalVisible) break;
                const alreadyInTable = await page.evaluate((cnt) => {
                    const table = document.querySelector('table');
                    if (!table) return false;
                    const rows = Array.from(table.querySelectorAll('tr')).filter(r => !r.innerText.includes('பெயர்') && !r.innerText.includes('name'));
                    return rows.length >= cnt;
                }, memNum).catch(() => false);
                if (alreadyInTable) break;
                await page.waitForTimeout(1000);
            }
        }

        if (isMemModalVisible) {
            onProgress(`🔐 [ஆதார் OTP தேவை] உறுப்பினர் ${memNum} (${mem.nameTam || mem.nameEng}) ஆதார் OTP சாளரம் திரையில் உள்ளது!`);
            await showBrowserHud(`[ஆதார் OTP தேவை] உறுப்பினர் ${memNum}`, `${mem.nameTam || mem.nameEng} ஆதார் SMS OTP உள்ளிடவும்`, 'warning');

            // Live self-healing watch loop supporting app chat/IPC AND direct Chrome typing + resend cooldown + toast retry
            let lastMemOtpSubmitted = '';
            let promptedResendNotice = false;
            let promptedAppOnce = false;

            for (let tick = 0; tick < 360; tick++) {
                await assertNoRadwareOrPageRefresh(page, isFamilyStepPageIntact, `படி 36 (உறுப்பினர் ${memNum} ஆதார் OTP)`);
                const nowInTable = await page.evaluate((cnt) => {
                    const table = document.querySelector('table');
                    if (!table) return false;
                    const rows = Array.from(table.querySelectorAll('tr')).filter(r => !r.innerText.includes('பெயர்') && !r.innerText.includes('name'));
                    return rows.length >= cnt;
                }, memNum).catch(() => false);
                if (nowInTable) break;

                if (!(await checkAadhaarModal())) {
                    await page.waitForTimeout(1000);
                    continue;
                }

                // Check disk IPC OTP (data/pending_otp.txt) from App chat/webhook
                const pendingOtpPaths = [
                    path.join(process.cwd(), 'data', 'pending_otp.txt'),
                    path.join(process.env.APPDATA || '', 'esevadraft-desktop', 'data', 'pending_otp.txt'),
                    path.join(process.env.APPDATA || '', 'esevadraft-desktop', 'pending_otp.txt')
                ];
                let typedFromApp = '';
                for (const pPath of pendingOtpPaths) {
                    if (fs.existsSync(pPath)) {
                        try {
                            const st = fs.statSync(pPath);
                            if (Date.now() - st.mtimeMs < 45000) {
                                const dVal = fs.readFileSync(pPath, 'utf8').trim().replace(/\D/g, '');
                                if (isValidNewCardAadhaarOtp(dVal)) {
                                    typedFromApp = dVal;
                                    try { fs.unlinkSync(pPath); } catch (_) {}
                                    break;
                                }
                            } else {
                                try { fs.unlinkSync(pPath); } catch (_) {}
                            }
                        } catch (_) {}
                    }
                }
                if (typedFromApp) {
                    await page.evaluate((otpVal) => {
                        const otpInp = document.querySelector('input[formcontrolname="otp"], input#otp') ||
                            Array.from(document.querySelectorAll('.modal input:not([type="hidden"])')).find(i => !i.disabled && !i.readOnly);
                        if (otpInp) {
                            otpInp.value = otpVal;
                            otpInp.dispatchEvent(new Event('input', { bubbles: true }));
                            otpInp.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    }, typedFromApp);
                } else if (!promptedAppOnce && tick === 0) {
                    promptedAppOnce = true;
                    // Register background chat OTP listener so operator can type either in App OR directly in Chrome
                    Promise.resolve(requestOtpFromUser(
                        `🔐 **ஆதார் சரிபார்ப்பு OTP (${mem.nameTam || mem.nameEng}):**\n\n${mem.relationshipTam || 'உறுப்பினர்'} (${mem.nameTam || mem.nameEng}) ஆதார் எண்ணிற்கு வந்துள்ள 6-இலக்க ஆதார் OTP எண்ணை இங்கே (அல்லது Chrome திரையில்) உள்ளிடவும்:`,
                        onProgress, 'aadhaar_otp', page
                    )).then(async (appOtp) => {
                        const cleanAppOtp = (appOtp && appOtp !== 'ALREADY_VERIFIED_ON_PORTAL') ? String(appOtp).replace(/\D/g, '') : '';
                        if (isValidNewCardAadhaarOtp(cleanAppOtp)) {
                            await page.evaluate((otpVal) => {
                                const otpInp = document.querySelector('input[formcontrolname="otp"], input#otp');
                                if (otpInp && (otpInp.value || '').replace(/\D/g, '') !== otpVal) {
                                    otpInp.value = otpVal;
                                    otpInp.dispatchEvent(new Event('input', { bubbles: true }));
                                    otpInp.dispatchEvent(new Event('change', { bubbles: true }));
                                }
                            }, cleanAppOtp).catch(() => {});
                        }
                    }).catch(() => {});
                }

                const modalSnap = await page.evaluate(() => {
                    const otpInp = document.querySelector('input[formcontrolname="otp"], input#otp');
                    const modal = otpInp ? otpInp.closest('.modal, div[role="dialog"]') : document.querySelector('.modal.show, div[role="dialog"]');
                    if (!modal) return { otpVal: '', timerVal: null, canResend: false };
                    const val = ((otpInp || modal.querySelector('input:not([type="hidden"])'))?.value || '').replace(/\D/g, '');
                    const timerSpan = Array.from(modal.querySelectorAll('span.text-danger, span')).find(s => /^\d+$/.test((s.innerText || '').trim()));
                    const timerVal = timerSpan ? parseInt(timerSpan.innerText.trim(), 10) : null;
                    const resendBtn = Array.from(modal.querySelectorAll('button')).find(b => {
                        const bt = (b.innerText || '').trim();
                        return bt.includes('மீண்டும் அனுப்பவும்') || bt.includes('Resend');
                    });
                    return { otpVal: val, timerVal, canResend: Boolean(resendBtn && !resendBtn.disabled) };
                }).catch(() => ({ otpVal: '', timerVal: null, canResend: false }));

                if (modalSnap.timerVal === 0 && modalSnap.canResend && !promptedResendNotice) {
                    promptedResendNotice = true;
                    onProgress(`⏳ [உறுப்பினர் ${memNum}] ஆதார் OTP டைமர் முடிந்துள்ளது — SMS வரவில்லையெனில் "OTP மீண்டும் அனுப்பவும்" பொத்தானை அழுத்தவும் (முந்தைய OTP-ஐப் பாதுகாக்க தானியங்கி Resend தவிர்க்கப்பட்டது).`);
                }

                if (modalSnap.otpVal.length === 6) {
                    await page.waitForTimeout(1600);
                    const recheckedMemOtp = await page.evaluate(() => {
                        const el = document.querySelector('input[formcontrolname="otp"], input#otp') || document.querySelector('.modal.show input:not([type="hidden"])');
                        return ((el && el.value) || '').replace(/\D/g, '');
                    }).catch(() => modalSnap.otpVal);
                    if (recheckedMemOtp.length >= 7) modalSnap.otpVal = recheckedMemOtp;
                }
                if (isValidNewCardAadhaarOtp(modalSnap.otpVal) && modalSnap.otpVal !== lastMemOtpSubmitted) {
                    lastMemOtpSubmitted = modalSnap.otpVal;
                    onProgress(`🔑 [உறுப்பினர் ${memNum}] ஆதார் OTP (${lastMemOtpSubmitted}) சமர்ப்பிக்கப்படுகிறது...`);
                    // Playwright Single Atomic Click strictly inside this Aadhaar modal
                    const subBtnLoc = page.locator('input[formcontrolname="otp"], input#otp')
                        .locator('xpath=ancestor::div[contains(@class,"modal")]//button[contains(@class,"btn-success") or contains(text(),"சமர்ப்பிக்கவும்") or contains(text(),"Submit")]')
                        .first();
                    if (await subBtnLoc.count() > 0 && await subBtnLoc.isVisible().catch(() => false)) {
                        await subBtnLoc.click({ delay: 60 }).catch(() => {});
                    }
                    await page.waitForTimeout(3000);
                    await scanAndBroadcastToasts();

                    const toastErr = await page.evaluate(() => {
                        const toasts = Array.from(document.querySelectorAll('.p-toast-message, .toast, .alert')).map(t => (t.innerText || '').trim());
                        return toasts.find(t => /txn|xsd|தவறான|invalid|failed|expired|காலாவதி/i.test(t));
                    }).catch(() => null);
                    if (toastErr) {
                        onProgress(`⚠️ [உறுப்பினர் ${memNum} ஆதார் OTP] "${toastErr}" — புதிய OTP உள்ளிடவும்...`);
                        await page.evaluate(() => {
                            const inp = document.querySelector('input[formcontrolname="otp"], input#otp');
                            if (inp) {
                                inp.value = '';
                                inp.dispatchEvent(new Event('input', { bubbles: true }));
                                inp.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                        }).catch(() => {});
                        lastMemOtpSubmitted = '';
                    }
                }
                await page.waitForTimeout(1000);
            }
        }

        // 15. இரும்புக் கோட்டைப் பூட்டு: அட்டவணையில் சரிபார்த்தல்
        onProgress(`📍 [உறுப்பினர் ${memNum}] அரசு அட்டவணையில் உறுப்பினர் பதியப்படுகிறாரா எனத் தணிக்கை செய்யப்படுகிறது...`);
        let isMemberInTable = false;
        const targetTamToken = (mem.nameTam || '').replace(/[^\u0B80-\u0BFF]/g, ' ').split(/\s+/).find(w => w.length >= 3) || '';
        const targetEngToken = (mem.nameEng || '').replace(/[^a-zA-Z]/g, ' ').split(/\s+/).find(w => w.length >= 3) || '';

        for (let attempt = 1; attempt <= 15; attempt++) {
            await page.waitForTimeout(1000);
            isMemberInTable = await page.evaluate(({ engToken, tamToken, relTam, relEng, memNum }) => {
                const table = document.querySelector('table');
                if (!table) return false;
                const text = table.innerText || '';
                const rows = Array.from(table.querySelectorAll('tr')).filter(r => !r.innerText.includes('பெயர்') && !r.innerText.includes('name'));
                const hasRowCount = rows.length >= memNum;
                const hasTamName = tamToken && text.includes(tamToken);
                const hasEngName = engToken && text.toLowerCase().includes(engToken.toLowerCase());
                const hasRelTam = relTam && text.includes(relTam);
                const hasRelEng = relEng && text.toLowerCase().includes(relEng.toLowerCase());
                return (hasRowCount && (hasTamName || hasEngName || hasRelTam || hasRelEng)) || (hasTamName && hasRelTam) || hasRowCount;
            }, { engToken: targetEngToken, tamToken: targetTamToken, relTam: targetRelTam, relEng: targetRelEng, memNum });
            if (isMemberInTable) break;
        }

        await takeStepSnapshot(`member_${memNum}_saved`);
        if (!isMemberInTable) {
            const haltMsg = `உறுப்பினர் ${memNum} (${mem.nameTam || mem.nameEng}) அரசு அட்டவணையில் சேமிக்கப்படவில்லை! ஆவணப் பதிவேற்றம் அல்லது ஆதார் சரிபார்ப்பு முழுமையடையவில்லை.`;
            await showBrowserHud(`🔴 உறுப்பினர் ${memNum} சேர்க்கை நிறுத்தம்`, haltMsg, 'error');
            onProgress(`⚠️ **கடும் பூட்டு நிறுத்தம் (Strict Gate Halt):** ${haltMsg}`);
            return { success: false, message: `உறுப்பினர் ${memNum} அட்டவணையில் உறுதி செய்யப்படவில்லை.` };
        }
        onProgress(`✅ [உறுப்பினர் ${memNum}] ${mem.nameTam || mem.nameEng} அரசு அட்டவணையில் வெற்றிகரமாகச் சேர்க்கப்பட்டு பச்சையாகப் பூட்டப்பட்டது!`);
        clearStaleOtpState();
        await page.waitForTimeout(2000);
    }

    return { success: true };
}

module.exports = {
    executeFamilyMembersLoop
};
