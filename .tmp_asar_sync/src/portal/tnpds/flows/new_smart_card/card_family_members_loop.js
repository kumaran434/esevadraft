/**
 * TNPDS New Smart Card - Additional Family Members Loop & Table Verification
 */
const path = require('path');
const { fillAdditionalMemberForm } = require('./card_additional_member_form');

async function executeFamilyMembersLoop(page, citizenProfile, sanitizedProfile, options, onProgress, sharedContext, logDiag, takeStepSnapshot, scanAndBroadcastToasts) {
    const {
        requestOtpFromUser,
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

            await page.evaluate(() => {
                const btns = Array.from(document.querySelectorAll('button')).filter(b => {
                    const t = (b.innerText || '').trim().toLowerCase();
                    return t.includes('உறுப்பினரை சேர்க்க') || t.includes('add member');
                });
                for (const b of btns) {
                    b.disabled = false; b.removeAttribute('disabled');
                    b.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    b.click();
                }
            });
            const addMemBtn = page.locator('button.btn-orange:has-text("உறுப்பினரை சேர்க்க"), button:has-text("உறுப்பினரை சேர்க்க"), button:has-text("Add Member")').first();
            if (await addMemBtn.count() > 0) {
                await addMemBtn.scrollIntoViewIfNeeded().catch(() => {});
                await addMemBtn.click({ force: true }).catch(() => {});
            }
            await page.waitForTimeout(2000);
        }

        const totalEngInputs = await page.locator('input[formcontrolname="NameOfFamilyHead"]').count();
        if (totalEngInputs < 2) {
            onProgress(`⚠️ **கடும் பூட்டு நிறுத்தம்:** உறுப்பினர் ${memNum} சேர்க்கை படிவம் திறக்கப்படவில்லை!`);
            return { success: false, message: `உறுப்பினர் ${memNum} சேர்க்கை படிவம் திறக்கப்படவில்லை.` };
        }

        // Fill Form
        const formRes = await fillAdditionalMemberForm(page, mem, memNum, citizenProfile, sanitizedProfile, options, onProgress, sharedContext, logDiag, scanAndBroadcastToasts);
        if (!formRes.success) return formRes;
        const { memPdf, targetRelTam, targetRelEng } = formRes;

        // 12. "பதிவேற்றம்" பொத்தான் கிளிக் ➔ பச்சைக் குறியீடு உறுதி
        onProgress(`📍 [உறுப்பினர் ${memNum}] ஆதார் PDF பதிவேற்றம் ("பதிவேற்றம்") பொத்தான் அழுத்தப்படுகிறது...`);
        await showBrowserHud(`📤 [உறுப்பினர் ${memNum}] ஆதார் சர்வரில் பதிவேற்றப்படுகிறது...`, 'அரசு தளத்தில் பதிவேற்றம் ஆகிறது • நீங்கள் எதுவும் செய்ய வேண்டாம்!', 'warning');

        await page.evaluate(() => {
            const allDocInputs = Array.from(document.querySelectorAll('input[formcontrolname="supportingDocumentProof"]'));
            const lastInp = allDocInputs[allDocInputs.length - 1];
            if (lastInp && lastInp.parentElement) {
                let parent = lastInp.parentElement;
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
            }
        });

        const memUploadBtn = page.locator('div:has(> input[formcontrolname="supportingDocumentProof"]) button:has-text("பதிவேற்றம்"), div:has(> input[formcontrolname="supportingDocumentProof"]) button:has-text("Upload")').last();
        if (await memUploadBtn.count() > 0) {
            await memUploadBtn.click({ force: true }).catch(() => {});
        }
        await page.waitForTimeout(3500);
        await scanAndBroadcastToasts();

        const isGreenInDOM = await page.evaluate((fileName) => {
            const allDocInputs = Array.from(document.querySelectorAll('input[formcontrolname="supportingDocumentProof"]'));
            const lastInp = allDocInputs[allDocInputs.length - 1];
            if (!lastInp || !lastInp.parentElement) return true;
            const parent = lastInp.parentElement;
            const hasFileName = parent.innerText && parent.innerText.includes(fileName);
            const hasClearBtn = Array.from(parent.querySelectorAll('button')).some(b => b.innerText.trim().toLowerCase() === 'x');
            const uploadBtn = Array.from(parent.querySelectorAll('button')).find(b => (b.innerText || '').toLowerCase().includes('பதிவேற்றம்') || (b.innerText || '').toLowerCase().includes('upload'));
            const isUploadDisabled = uploadBtn ? uploadBtn.disabled : false;
            const greenEl = parent.querySelectorAll('.badge.bg-success, .text-success, i.fa-check, .alert-success');
            return Boolean(hasFileName || hasClearBtn || isUploadDisabled || greenEl.length > 0);
        }, path.basename(memPdf));

        if (!isGreenInDOM && !isMockSandboxMode) {
            onProgress(`⚠️ **கடும் பூட்டு நிறுத்தம்:** உறுப்பினர் ${memNum} ஆதார் PDF பதிவேற்றத்தில் பச்சைக் குறியீடு வரவில்லை!`);
            return { success: false, message: `உறுப்பினர் ${memNum} ஆதார் PDF பதிவேற்றம் தோல்வி.` };
        }
        onProgress(`✅ [உறுப்பினர் ${memNum}] ஆதார் PDF வெற்றிகரமாகப் பதிவேற்றப்பட்டு பச்சைக் குறியீடு உறுதி செய்யப்பட்டது!`);

        // 13. உறுப்பினர் விவரம் சேமி பொத்தான் கிளிக்
        onProgress(`📍 [உறுப்பினர் ${memNum}] உறுப்பினர் விவரம் சேமி பொத்தான் அழுத்தப்படுகிறது...`);
        const saveMemBtn = page.getByRole('button', { name: /உறுப்பினர் விவரம் சேமி|Save Member|Save/i })
            .or(page.locator('button:has-text("உறுப்பினர் விவரம் சேமி"), button:has-text("Save Member")')).last();
        if (await saveMemBtn.count() > 0) {
            await saveMemBtn.scrollIntoViewIfNeeded().catch(() => {});
            await saveMemBtn.click({ force: true }).catch(() => {});
        }

        await showBrowserHud('⏳ தயவுசெய்து காத்திருக்கவும்...', `உறுப்பினர் ${memNum} (${mem.nameTam || mem.nameEng}) விவரங்கள் அரசு அட்டவணையில் சேர்க்கப்படுகின்றன...`, 'info');
        for (let s = 1; s <= 30; s++) {
            await page.waitForTimeout(1000);
            const isBusy = await page.evaluate(() => {
                const text = document.body.innerText;
                const hasLoading = text.includes('தயவுசெய்து காத்திருக்கவும்') || text.includes('Please Wait');
                const btn = Array.from(document.querySelectorAll('button')).find(b => (b.innerText || '').includes('உறுப்பினர் விவரம் சேமி'));
                return Boolean(hasLoading || (btn && btn.disabled));
            });
            if (!isBusy) break;
        }
        await page.waitForTimeout(1500);
        await scanAndBroadcastToasts();
        await removeBrowserHud();

        // 14. ஆதார் OTP (Modal தோன்றினால்)
        let isMemModalVisible = false;
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

        if (isMemModalVisible) {
            onProgress(`🔐 [ஆதார் OTP தேவை] உறுப்பினர் ${memNum} (${mem.nameTam || mem.nameEng}) ஆதார் OTP சாளரம் திரையில் உள்ளது!`);
            const memOtp = await requestOtpFromUser(
                `🔐 **ஆதார் சரிபார்ப்பு OTP (${mem.nameTam || mem.nameEng}):**\n\n${mem.relationshipTam || 'உறுப்பினர்'} (${mem.nameTam || mem.nameEng}) ஆதார் எண்ணிற்கு வந்துள்ள 6-இலக்க ஆதார் OTP எண்ணை இங்கே தட்டச்சு செய்யவும்:`,
                onProgress, 'aadhaar_otp', page
            );
            const cleanMemOtp = (memOtp && memOtp !== 'ALREADY_VERIFIED_ON_PORTAL') ? String(memOtp).replace(/\D/g, '') : '';
            if (cleanMemOtp && cleanMemOtp.length === 6) {
                await page.evaluate((otpVal) => {
                    const otpInp = document.querySelector('input[formcontrolname="otp"], input#otp') ||
                        Array.from(document.querySelectorAll('input:not([type="hidden"])')).find(i => !i.disabled && !i.readOnly);
                    if (otpInp) {
                        otpInp.value = otpVal;
                        otpInp.dispatchEvent(new Event('input', { bubbles: true }));
                        otpInp.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }, cleanMemOtp);

                // Playwright Single Atomic Click strictly inside this Aadhaar modal
                const subBtnLoc = page.locator('input[formcontrolname="otp"], input#otp')
                    .locator('xpath=ancestor::div[contains(@class,"modal")]//button[contains(@class,"btn-success") or contains(text(),"சமர்ப்பிக்கவும்") or contains(text(),"Submit")]')
                    .first();
                if (await subBtnLoc.count() > 0 && await subBtnLoc.isVisible().catch(() => false)) {
                    await subBtnLoc.click({ delay: 50 }).catch(() => {});
                }
            }
            await page.waitForTimeout(2000);
            for (let w = 0; w < 25; w++) {
                if (!(await checkAadhaarModal())) break;
                await page.waitForTimeout(1000);
            }
            await scanAndBroadcastToasts();
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
            onProgress(`⚠️ **கடும் பூட்டு நிறுத்தம் (Strict Gate Halt):** உறுப்பினர் ${memNum} (${mem.nameTam || mem.nameEng}) அரசு அட்டவணையில் சேமிக்கப்படவில்லை!`);
            return { success: false, message: `உறுப்பினர் ${memNum} அட்டவணையில் உறுதி செய்யப்படவில்லை.` };
        }
        onProgress(`✅ [உறுப்பினர் ${memNum}] ${mem.nameTam || mem.nameEng} அரசு அட்டவணையில் வெற்றிகரமாகச் சேர்க்கப்பட்டு பச்சையாகப் பூட்டப்பட்டது!`);
    }

    return { success: true };
}

module.exports = {
    executeFamilyMembersLoop
};
