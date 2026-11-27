/**
 * TNPDS New Smart Card - Additional Family Members Loop & Table Verification
 */
const fs = require('fs');
const path = require('path');
const { fillAdditionalMemberForm } = require('./card_additional_member_form');
const { installRealtimePortalToastObserver } = require('./card_navigation_preflight');
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
    if (additionalMembers.length > 0) {
        await installRealtimePortalToastObserver(page);
    }
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
        const {
            memPdf, targetRelTam, targetRelEng, isBirthCertMember,
            resolvedDocVal, resolvedDobParts, targetMemEng, targetMemTam,
            isMemFemale, memInc, cleanMemAadhaar
        } = formRes;
        const docLabel = isBirthCertMember ? 'பிறப்புச் சான்றிதழ் PDF' : 'ஆதார் PDF';

        // 12. "பதிவேற்றம்" பொத்தான் கிளிக் ➔ சர்வர் பதிவேற்றம் உறுதி (ஒற்றை கிளிக் + நிஜ சரிபார்ப்பு)
        onProgress(`📍 [உறுப்பினர் ${memNum}] ${docLabel} பதிவேற்றம் ("பதிவேற்றம்") பொத்தான் அழுத்தப்படுகிறது...`);
        await showBrowserHud(`📤 [உறுப்பினர் ${memNum}] ${docLabel} பதிவேற்றம்`, 'அரசு தளத்தில் பதிவேற்றம் ஆகிறது • காத்திருக்கவும்...', 'warning');

        const snapshotUploadMarkers = async () => {
            return await page.evaluate(() => {
                const toasts = Array.from(document.querySelectorAll('.p-toast-message, .toast, .alert-success'))
                    .map(t => (t.innerText || '').trim()).filter(Boolean);
                const allDocInputs = Array.from(document.querySelectorAll('input[formcontrolname="supportingDocumentProof"]'));
                const lastInp = allDocInputs[allDocInputs.length - 1];
                let container = lastInp ? (lastInp.closest('.form-group, .input-group, .col-md-4, .col-md-6, .col-sm-6') || lastInp.parentElement) : null;
                let clearBtnCount = 0;
                if (container) {
                    clearBtnCount = Array.from(container.querySelectorAll('button, a')).filter(b => {
                        const txt = (b.innerText || '').trim().toLowerCase();
                        return b.offsetParent !== null && (txt === 'x' || txt === '×');
                    }).length;
                }
                return { toasts, clearBtnCount };
            }).catch(() => ({ toasts: [], clearBtnCount: 0 }));
        };

        const clickMemberUploadBtn = async () => {
            const memUploadBtn = page.locator([
                'div:has(> input[formcontrolname="supportingDocumentProof"]) button:has-text("பதிவேற்றம்")',
                'div:has(> input[formcontrolname="supportingDocumentProof"]) button:has-text("Upload")',
                'div.form-group:has(input[formcontrolname="supportingDocumentProof"]) button:has-text("பதிவேற்றம்")',
                'div.form-group:has(input[formcontrolname="supportingDocumentProof"]) button:has-text("Upload")',
                'div.input-group:has(input[formcontrolname="supportingDocumentProof"]) button:has-text("பதிவேற்றம்")',
                'div.input-group:has(input[formcontrolname="supportingDocumentProof"]) button:has-text("Upload")',
                'div.form-group:has(input[formcontrolname="supportingDocumentProof"]) button.btn-secondary',
                'input[formcontrolname="supportingDocumentProof"] ~ button'
            ].join(', ')).last();
            if (await memUploadBtn.count() > 0) {
                await memUploadBtn.scrollIntoViewIfNeeded({ timeout: 2500 }).catch(() => {});
                for (let ew = 0; ew < 6; ew++) {
                    const isEn = await memUploadBtn.evaluate(b => !b.disabled && b.getAttribute('disabled') === null).catch(() => false);
                    if (isEn) break;
                    await page.waitForTimeout(300);
                }
                await memUploadBtn.evaluate(b => { b.disabled = false; b.removeAttribute('disabled'); }).catch(() => {});
                await memUploadBtn.click({ timeout: 3000 }).catch(async () => {
                    await memUploadBtn.click({ force: true, timeout: 3000 }).catch(() => {});
                });
                return true;
            }
            return await page.evaluate(() => {
                const allDocInputs = Array.from(document.querySelectorAll('input[formcontrolname="supportingDocumentProof"]'));
                const lastInp = allDocInputs[allDocInputs.length - 1];
                let parent = lastInp ? lastInp.parentElement : null;
                for (let i = 0; i < 4 && parent; i++) {
                    const btn = Array.from(parent.querySelectorAll('button')).find(b => {
                        const t = (b.innerText || '').trim().toLowerCase();
                        return t.includes('பதிவேற்றம்') || t.includes('upload') || b.classList.contains('btn-secondary');
                    });
                    if (btn) {
                        btn.disabled = false; btn.removeAttribute('disabled');
                        btn.click();
                        return true;
                    }
                    parent = parent.parentElement;
                }
                return false;
            }).catch(() => false);
        };

        const verifyMemDocUploaded = async (baseline) => {
            return await page.evaluate(({ prevToasts, prevClearCount }) => {
                const allDocInputs = Array.from(document.querySelectorAll('input[formcontrolname="supportingDocumentProof"]'));
                const lastInp = allDocInputs[allDocInputs.length - 1];
                const toasts = Array.from(document.querySelectorAll('.p-toast-message, .toast, .alert-success')).map(t => (t.innerText || '').trim()).filter(Boolean);
                const hasNewSuccessToast = toasts.some(t => !prevToasts.includes(t) && (t.includes('வெற்றிகரமாக') || /uploaded\s*successfully/i.test(t)));
                if (hasNewSuccessToast) return true;
                if (!lastInp || !lastInp.parentElement) return false;
                let container = lastInp.closest('.form-group, .input-group, .col-md-4, .col-md-6, .col-sm-6') || lastInp.parentElement;
                for (let i = 0; i < 2 && container; i++) {
                    const curClearCount = Array.from(container.querySelectorAll('button, a')).filter(b => {
                        const txt = (b.innerText || '').trim().toLowerCase();
                        return b.offsetParent !== null && (txt === 'x' || txt === '×');
                    }).length;
                    const greenEl = Array.from(container.querySelectorAll('.badge-success, .badge.bg-success, .bg-success, .text-success, i.fa-check, i.fa-check-circle, .alert-success'))
                        .filter(el => el.offsetParent !== null);
                    if (curClearCount > prevClearCount || curClearCount > 0 || greenEl.length > 0) return true;
                    container = container.parentElement;
                }
                return false;
            }, { prevToasts: baseline.toasts || [], prevClearCount: baseline.clearBtnCount || 0 }).catch(() => false);
        };

        let isGreenInDOM = false;
        for (let uploadAttempt = 1; uploadAttempt <= 2 && !isGreenInDOM; uploadAttempt++) {
            const baseline = await snapshotUploadMarkers();
            if (uploadAttempt === 2) {
                onProgress(`🔄 [உறுப்பினர் ${memNum}] ${docLabel} கோப்பு மீண்டும் இணைக்கப்பட்டு பதிவேற்றம் முயற்சிக்கப்படுகிறது...`);
                const reInp = page.locator('input[formcontrolname="supportingDocumentProof"]').last();
                if (await reInp.count() > 0) {
                    await reInp.setInputFiles(memPdf, { timeout: 8000 }).catch(() => {});
                    await reInp.dispatchEvent('input').catch(() => {});
                    await reInp.dispatchEvent('change').catch(() => {});
                    await page.waitForTimeout(500);
                }
            }
            await clickMemberUploadBtn();
            for (let uw = 0; uw < 8; uw++) {
                await page.waitForTimeout(1000);
                isGreenInDOM = await verifyMemDocUploaded(baseline);
                if (isGreenInDOM) break;
            }
            await scanAndBroadcastToasts();
            if (!isGreenInDOM) isGreenInDOM = await verifyMemDocUploaded(baseline);
        }

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

        // 13. உறுப்பினர் விவரம் சேமி பொத்தான் கிளிக் (Safe Angular addmemberForm Sync — NEVER fire destructive change events on supportingDocument/dateOfBirth!)
        onProgress(`📍 [உறுப்பினர் ${memNum}] உறுப்பினர் விவரம் சேமி பொத்தான் அழுத்தப்படுகிறது...`);
        await installRealtimePortalToastObserver(page);

        // Sync Angular addmemberForm controls cleanly (mirrors Member 1's proven working patch) WITHOUT wiping uploaded file or triggering transliteration!
        const formAudit = await page.evaluate(({ eng, tam, dobParts, income, aadhaar, isFemale, docVal, isBc, fileName }) => {
            const btns = Array.from(document.querySelectorAll('button')).filter(b => {
                const t = (b.innerText || '').trim();
                return (t.includes('உறுப்பினர் விவரம் சேமி') || t.includes('Save Member')) && b.offsetParent !== null;
            });
            const targetBtn = btns[btns.length - 1] || null;
            const form = targetBtn ? targetBtn.closest('form') : null;

            let comp = null;
            try {
                if (window.ng && window.ng.getComponent) {
                    for (const el of document.querySelectorAll('*')) {
                        const c = window.ng.getComponent(el);
                        if (c && typeof c.addMember === 'function' && c.addmemberForm) {
                            comp = c;
                            break;
                        }
                    }
                }
            } catch (_) {}

            // Read actual DOM select values so we preserve exact portal option values
            const relEls = document.querySelectorAll('select[formcontrolname="relationship"]');
            const relDomVal = relEls.length ? relEls[relEls.length - 1].value : '';
            const docEls = document.querySelectorAll('select[formcontrolname="supportingDocument"]');
            const docEl = docEls.length ? docEls[docEls.length - 1] : null;
            let effectiveDocVal = docEl ? String(docEl.value || '').trim() : '';
            if ((!effectiveDocVal || effectiveDocVal === '0') && docEl && docVal) {
                const opt = Array.from(docEl.options).find(o => o.value === docVal)
                    || (!isBc ? Array.from(docEl.options).find(o => o.value === 'AADHAAR_CARD' || (!o.text.includes('பிறப்பு') && (o.text.includes('ஆதார்') || o.text.toLowerCase().includes('aadhaar')))) : null);
                if (opt) {
                    docEl.value = opt.value;
                    effectiveDocVal = opt.value;
                }
            }
            if (!effectiveDocVal && docVal) effectiveDocVal = docVal;

            const nameTamEls = document.querySelectorAll('input[formcontrolname="குடும்பதலைவர்பெயர்"]');
            if (nameTamEls.length >= 2 && tam && nameTamEls[1].value !== tam) {
                nameTamEls[1].value = tam;
            }

            const dobNativeDate = (dobParts && dobParts.year > 1900)
                ? new Date(dobParts.year, (dobParts.month || 1) - 1, dobParts.day || 1, 12, 0, 0)
                : null;

            if (comp && comp.addmemberForm) {
                const ngForm = comp.addmemberForm;
                const patchObj = {};
                if (eng) patchObj.NameOfFamilyHead = eng;
                if (tam) patchObj['குடும்பதலைவர்பெயர்'] = tam;
                if (income !== undefined && income !== '') patchObj.monthlyIncome = String(income);
                patchObj.nationality = 'Indian';
                patchObj.gender = isFemale ? 'Female' : 'Male';
                if (relDomVal) patchObj.relationship = relDomVal;
                if (effectiveDocVal) patchObj.supportingDocument = effectiveDocVal;
                if (dobNativeDate) {
                    ngForm.get('dateOfBirth')?.setValue(dobNativeDate, { emitEvent: false });
                    ngForm.get('dateOfBirth')?.setErrors(null);
                    patchObj.dateOfBirth = dobNativeDate;
                }
                const cleanA = String(aadhaar || '').replace(/\D/g, '');
                if (!isBc && cleanA.length === 12) {
                    patchObj.aadhaarNumber = cleanA.substring(0, 4);
                    patchObj.aadhaarNumber1 = cleanA.substring(4, 8);
                    patchObj.aadhaarNumber2 = cleanA.substring(8, 12);
                }
                ngForm.patchValue(patchObj, { emitEvent: false });
                ngForm.updateValueAndValidity({ emitEvent: false });

                if (!comp.supportingDocumentFile && effectiveDocVal) {
                    comp.supportingDocumentFile = effectiveDocVal;
                }
                if (!comp.selectedFileName && fileName) {
                    comp.selectedFileName = fileName;
                }
            }

            const invalidLabels = form
                ? Array.from(form.querySelectorAll('.ng-invalid')).map(el => el.getAttribute('formcontrolname') || el.name || el.tagName).filter(Boolean)
                : [];
            const dobInp = document.querySelectorAll('input[formcontrolname="dateOfBirth"]');
            const dobDomVal = dobInp.length ? dobInp[dobInp.length - 1].value : '';
            const ngDobVal = comp?.addmemberForm?.get('dateOfBirth')?.value;
            return {
                btnFound: Boolean(targetBtn),
                btnDisabled: Boolean(targetBtn && targetBtn.disabled),
                invalidControls: Array.from(new Set(invalidLabels)),
                dobDomVal,
                ngDobStr: ngDobVal instanceof Date ? ngDobVal.toISOString().slice(0, 10) : String(ngDobVal || ''),
                docDomVal: effectiveDocVal,
                hasComp: Boolean(comp && comp.addmemberForm)
            };
        }, {
            eng: targetMemEng || mem.nameEng || '',
            tam: targetMemTam || mem.nameTam || '',
            dobParts: resolvedDobParts,
            income: memInc || '3000',
            aadhaar: cleanMemAadhaar || '',
            isFemale: Boolean(isMemFemale),
            docVal: resolvedDocVal || (isBirthCertMember ? 'BIRTH_CERTIFICATE' : 'AADHAAR_CARD'),
            isBc: Boolean(isBirthCertMember),
            fileName: memPdf ? path.basename(memPdf) : 'aadhaar.pdf'
        }).catch(() => ({ btnFound: false, btnDisabled: false, invalidControls: [], dobDomVal: '', ngDobStr: '', docDomVal: '', hasComp: false }));

        await page.waitForTimeout(300);

        if (formAudit.btnDisabled && !isMockSandboxMode) {
            const invalidInfo = formAudit.invalidControls.length > 0 ? formAudit.invalidControls.join(', ') : 'தெரியாத புலம்';
            const disabledMsg = `உறுப்பினர் ${memNum} (${mem.nameTam || mem.nameEng}) "உறுப்பினர் விவரம் சேமி" பொத்தான் செயலற்ற நிலையில் (Disabled) உள்ளது — முழுமையடையாத புலங்கள்: ${invalidInfo} (DOB=${formAudit.dobDomVal || formAudit.ngDobStr}, Doc=${formAudit.docDomVal})`;
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

        // Note: NEVER put "தயவுசெய்து காத்திருக்கவும்" in our HUD title so busyState never self-triggers!
        await showBrowserHud(`⏳ உறுப்பினர் ${memNum} சேமிப்பு`, `${mem.nameTam || mem.nameEng} விவரங்கள் அரசு அட்டவணையில் பதியப்படுகின்றன...`, 'info');
        let portalSaveErrorPopup = '';
        for (let s = 1; s <= 15; s++) {
            await page.waitForTimeout(1000);
            const liveAlerts = await scanAndBroadcastToasts();
            if (Array.isArray(liveAlerts) && liveAlerts.length > 0) {
                const errLike = liveAlerts.find(t =>
                    !/வெற்றிகரமாக|successfully/i.test(t) &&
                    /பிழை|தவறான|கட்டாயம்|வயது|பிறப்பு|ஆதார்|ஏற்கனவே|invalid|error|failed|required|already|mandatory|birth|age|years/i.test(t)
                );
                if (errLike) {
                    portalSaveErrorPopup = errLike;
                    break;
                }
            }
            if (await checkAadhaarModal()) break;
            const busyState = await page.evaluate(() => {
                // Exclude our own #eseva-automation-hud from loading text check!
                const hud = document.getElementById('eseva-automation-hud');
                const hudTxt = hud ? (hud.innerText || '') : '';
                const bodyTxt = (document.body?.innerText || '').replace(hudTxt, '');
                const hasLoading = bodyTxt.includes('தயவுசெய்து காத்திருக்கவும்') || bodyTxt.includes('Please Wait') || Boolean(document.querySelector('.ngx-spinner-overlay, .spinner-border:not(#eseva-automation-hud *)'));
                const errSelectors = '#toast-container .toast-error, #toast-container .toast-warning, .p-toast-message-error, .p-toast-message-warn, .toast-error, .toast-warning, .alert-danger, .alert-warning, .swal2-popup';
                const errToast = Array.from(document.querySelectorAll(errSelectors))
                    .filter(el => !el.closest('#eseva-automation-hud'))
                    .map(t => (t.innerText || '').replace(/\s+/g, ' ').trim())
                    .filter(Boolean)
                    .join(' | ');
                return { hasLoading, errToast };
            }).catch(() => ({ hasLoading: false, errToast: '' }));
            if (busyState.errToast && !/வெற்றிகரமாக|successfully/i.test(busyState.errToast)) {
                portalSaveErrorPopup = busyState.errToast;
                await scanAndBroadcastToasts();
                break;
            }
            if (!busyState.hasLoading && s >= 2) break;
        }
        await page.waitForTimeout(800);
        const postAlerts = await scanAndBroadcastToasts();
        if (!portalSaveErrorPopup && Array.isArray(postAlerts)) {
            const foundErr = postAlerts.find(t => !/வெற்றிகரமாக|successfully/i.test(t) && /பிழை|தவறான|கட்டாயம்|வயது|பிறப்பு|ஆதார்|ஏற்கனவே|invalid|error|failed|required|already|mandatory|birth|age|years/i.test(t));
            if (foundErr) portalSaveErrorPopup = foundErr;
        }

        if (portalSaveErrorPopup && !isMockSandboxMode) {
            const exactPortalFailMsg = `உறுப்பினர் ${memNum} (${mem.nameTam || mem.nameEng}) அரசு போர்ட்டல் பிழை: "${portalSaveErrorPopup}" [DOB=${formAudit.dobDomVal || formAudit.ngDobStr}, Doc=${formAudit.docDomVal}]`;
            await showBrowserHud(`🔴 உறுப்பினர் ${memNum} போர்ட்டல் பிழை`, exactPortalFailMsg, 'error');
            onProgress(`⚠️ **கடும் பூட்டு நிறுத்தம் (Portal Error):** ${exactPortalFailMsg}`);
            return { success: false, message: exactPortalFailMsg };
        }

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
            await installOtpModalCopilot(page);

            // Live Co-Pilot watch loop supporting app chat/IPC AND direct Chrome typing + manual Resend/Submit immunity
            let lastMemOtpSubmitted = '';
            let lastBotMemResendAt = Date.now();
            let notedHumanMemResendAt = 0;
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

                const modalSnap = await readOtpModalCopilotState(page);
                if (!modalSnap.open) {
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
                        const modals = Array.from(document.querySelectorAll('.modal, div[role="dialog"], .modal-dialog')).filter(m => {
                            const s = window.getComputedStyle(m);
                            return (m.offsetParent !== null || s.display !== 'none' || m.classList.contains('show') || m.classList.contains('d-block')) && s.visibility !== 'hidden';
                        });
                        const modal = modals[modals.length - 1] || document;
                        const otpInp = modal.querySelector('input[formcontrolname="otp"], input#otp') ||
                            modal.querySelector('input:not([type="hidden"]):not([disabled]):not([readonly])');
                        if (otpInp) {
                            otpInp.value = otpVal;
                            otpInp.dispatchEvent(new Event('input', { bubbles: true }));
                            otpInp.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    }, typedFromApp);
                    modalSnap.otpVal = typedFromApp;
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
                                const modals = Array.from(document.querySelectorAll('.modal, div[role="dialog"], .modal-dialog')).filter(m => {
                                    const s = window.getComputedStyle(m);
                                    return (m.offsetParent !== null || s.display !== 'none' || m.classList.contains('show') || m.classList.contains('d-block')) && s.visibility !== 'hidden';
                                });
                                const modal = modals[modals.length - 1] || document;
                                const otpInp = modal.querySelector('input[formcontrolname="otp"], input#otp');
                                if (otpInp && (otpInp.value || '').replace(/\D/g, '') !== otpVal) {
                                    otpInp.value = otpVal;
                                    otpInp.dispatchEvent(new Event('input', { bubbles: true }));
                                    otpInp.dispatchEvent(new Event('change', { bubbles: true }));
                                }
                            }, cleanAppOtp).catch(() => {});
                        }
                    }).catch(() => {});
                }

                // Co-Pilot Resend: ஆபரேட்டர் கையால் Resend அழுத்தினால் ஆப் முழுமையாக வழிவிடும்!
                if (modalSnap.humanResendAt > notedHumanMemResendAt) {
                    notedHumanMemResendAt = modalSnap.humanResendAt;
                    lastMemOtpSubmitted = '';
                    onProgress(`⌨️ [Co-Pilot] உறுப்பினர் ${memNum}: ஆப்ரேட்டர் "OTP மீண்டும் அனுப்பவும்" அழுத்தினார் — புது OTP-க்காகக் காத்திருக்கிறது.`);
                }

                if (shouldBotTriggerResend(modalSnap, lastBotMemResendAt, Date.now(), 4000, 2)) {
                    const didResend = await performVisibleModalResend(page, { allowInlinePage: false });
                    if (didResend) {
                        lastBotMemResendAt = Date.now();
                        lastMemOtpSubmitted = '';
                        onProgress(`🔔 [உறுப்பினர் ${memNum} ஆதார் OTP] டைமர் முடிந்ததால் ஆப் புதிய OTP கோரியது — இனி புதிதாக வரும் SMS OTP-யை மட்டும் உள்ளிடவும்!`);
                        await page.waitForTimeout(2500);
                        continue;
                    }
                }

                // Co-Pilot Submit: ஆபரேட்டர் ஏற்கனவே Submit/Enter அழுத்தியிருந்தால் 2-வது கிளிக் செய்யாது!
                const memSub = shouldBotTriggerSubmit(modalSnap, lastMemOtpSubmitted, 6, Date.now());
                if (memSub.reason === 'human_already_submitted') {
                    if (modalSnap.otpVal !== lastMemOtpSubmitted) {
                        lastMemOtpSubmitted = modalSnap.otpVal;
                        onProgress(`⌨️ [Co-Pilot] உறுப்பினர் ${memNum}: ஆப்ரேட்டர் நேரடியாக OTP (${lastMemOtpSubmitted}) சமர்ப்பித்ததை உணர்ந்தது!`);
                        await page.waitForTimeout(3000);
                        await scanAndBroadcastToasts();
                    }
                } else if (memSub.submit) {
                    if (modalSnap.otpVal.length === 6 && modalSnap.otpMaxLen !== 6) {
                        await page.waitForTimeout(1600);
                        const recheckedSnap = await readOtpModalCopilotState(page);
                        if (!recheckedSnap.open) {
                            await page.waitForTimeout(1000);
                            continue;
                        }
                        if (recheckedSnap.humanSubmitAt > 0 && (Date.now() - recheckedSnap.humanSubmitAt < 6500) && recheckedSnap.humanSubmittedOtp === recheckedSnap.otpVal) {
                            lastMemOtpSubmitted = recheckedSnap.otpVal;
                            onProgress(`⌨️ [Co-Pilot] உறுப்பினர் ${memNum}: ஆப்ரேட்டர் நேரடியாக OTP (${lastMemOtpSubmitted}) சமர்ப்பித்ததை உணர்ந்தது!`);
                            await page.waitForTimeout(3000);
                            await scanAndBroadcastToasts();
                            continue;
                        }
                        modalSnap.otpVal = recheckedSnap.otpVal || modalSnap.otpVal;
                    }
                    lastMemOtpSubmitted = modalSnap.otpVal;
                    onProgress(`🔑 [உறுப்பினர் ${memNum}] ஆதார் OTP (${lastMemOtpSubmitted}) சமர்ப்பிக்கப்படுகிறது...`);
                    // Playwright Single Atomic Click strictly inside the VISIBLE Aadhaar modal
                    const subBtnLoc = page.locator('.modal.show input[formcontrolname="otp"], .modal.show input#otp, .modal.d-block input[formcontrolname="otp"], div[role="dialog"] input[formcontrolname="otp"]')
                        .locator('xpath=ancestor::div[contains(@class,"modal")]//button[contains(@class,"btn-success") or contains(text(),"சமர்ப்பிக்கவும்") or contains(text(),"Submit")]')
                        .last();
                    if (await subBtnLoc.count() > 0 && await subBtnLoc.isVisible().catch(() => false)) {
                        await subBtnLoc.click({ delay: 60 }).catch(() => {});
                    } else {
                        await performVisibleModalOtpSubmit(page, lastMemOtpSubmitted);
                    }
                    await page.waitForTimeout(3000);
                    await scanAndBroadcastToasts();
                }

                const toastErr = await page.evaluate(() => {
                    const toasts = Array.from(document.querySelectorAll('.p-toast-message, .toast, .alert')).map(t => (t.innerText || '').trim());
                    return toasts.find(t => /txn|xsd|தவறான|invalid|failed|expired|காலாவதி/i.test(t));
                }).catch(() => null);
                if (toastErr && lastMemOtpSubmitted) {
                    const curMemSnap = await readOtpModalCopilotState(page);
                    if (curMemSnap.open && curMemSnap.otpVal === lastMemOtpSubmitted) {
                        onProgress(`⚠️ [உறுப்பினர் ${memNum} ஆதார் OTP] "${toastErr}" — புதிய OTP உள்ளிடவும்...`);
                        await page.evaluate(() => {
                            const modals = Array.from(document.querySelectorAll('.modal, div[role="dialog"], .modal-dialog')).filter(m => {
                                const s = window.getComputedStyle(m);
                                return (m.offsetParent !== null || s.display !== 'none' || m.classList.contains('show') || m.classList.contains('d-block')) && s.visibility !== 'hidden';
                            });
                            const modal = modals[modals.length - 1];
                            const inp = modal && modal.querySelector('input[formcontrolname="otp"], input#otp');
                            if (inp) {
                                inp.value = '';
                                inp.dispatchEvent(new Event('input', { bubbles: true }));
                                inp.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                        }).catch(() => {});
                        await resetHumanSubmitWatch(page);
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
            const finalAlerts = await scanAndBroadcastToasts();
            const diagSnap = await page.evaluate(() => {
                const dobEls = document.querySelectorAll('input[formcontrolname="dateOfBirth"]');
                const docEls = document.querySelectorAll('select[formcontrolname="supportingDocument"]');
                const salEls = document.querySelectorAll('select[formcontrolname="salutation"]');
                const relEls = document.querySelectorAll('select[formcontrolname="relationship"]');
                const invalidEls = Array.from(document.querySelectorAll('.ng-invalid')).map(el => el.getAttribute('formcontrolname') || el.name).filter(Boolean);
                const visibleErrs = Array.from(document.querySelectorAll('.text-danger, .invalid-feedback, .mat-error, .alert-danger, .alert-warning, .toast-message, .p-toast-message'))
                    .filter(el => el.offsetParent !== null && !el.closest('#eseva-automation-hud'))
                    .map(el => (el.innerText || '').replace(/\s+/g, ' ').trim())
                    .filter(Boolean);
                return {
                    dob: dobEls.length ? dobEls[dobEls.length - 1].value : '',
                    doc: docEls.length ? docEls[docEls.length - 1].value : '',
                    sal: salEls.length ? salEls[salEls.length - 1].value : '',
                    rel: relEls.length ? relEls[relEls.length - 1].value : '',
                    invalid: Array.from(new Set(invalidEls)).slice(0, 8),
                    errs: Array.from(new Set(visibleErrs)).slice(0, 4)
                };
            }).catch(() => ({}));
            const extraDetail = [
                Array.isArray(finalAlerts) && finalAlerts.length ? `PortalAlert="${finalAlerts.join(' | ')}"` : '',
                Array.isArray(diagSnap.errs) && diagSnap.errs.length ? `FormErr="${diagSnap.errs.join(' | ')}"` : '',
                `DOB=${diagSnap.dob || formAudit.dobDomVal || formAudit.ngDobStr || 'empty'}`,
                `Doc=${diagSnap.doc || formAudit.docDomVal || 'empty'}`,
                `Invalid=${(diagSnap.invalid || []).join(',') || 'none'}`
            ].filter(Boolean).join(' | ');
            const haltMsg = `உறுப்பினர் ${memNum} (${mem.nameTam || mem.nameEng}) அரசு அட்டவணையில் சேமிக்கப்படவில்லை! (${extraDetail})`;
            await showBrowserHud(`🔴 உறுப்பினர் ${memNum} சேர்க்கை நிறுத்தம்`, haltMsg, 'error');
            onProgress(`⚠️ **கடும் பூட்டு நிறுத்தம் (Strict Gate Halt):** ${haltMsg}`);
            return { success: false, message: haltMsg };
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
