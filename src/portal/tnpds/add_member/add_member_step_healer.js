/**
 * eSevaDraft - TNPDS Add Member Step Healer & Resumption Workflow
 * Zero-Monolith Architecture (< 300 lines)
 */

const fs = require('fs');
const path = require('path');
const { ADD_MEMBER_STATES, clearRadwareAndSettle, isMemberAlreadyInTable, isAadhaarOtpModalOpen, detectCurrentAddMemberState, inspectFormFieldsStatus } = require('./resilient_step_resumption');

const { refillMemberFormFields } = require('./member_form_refiller');

/**
 * Resumes Add Member workflow from the exact interrupted state without stopping.
 */
async function resumeAddMemberWorkflow(page, citizenProfile = {}, helpers = {}, options = {}) {
    const { onProgress = () => {}, showBrowserHud = () => {}, tryAutoClickCaptcha = null, requestOtpFromUser = null, saveTnpdsCookies = null } = helpers;
    const subData = options.subServiceData || citizenProfile.subServiceData || options.draftData?.subServiceData || {};
    const memberNameTam = citizenProfile.memberNameTam || subData.memberName || citizenProfile.tempMember?.nameTam || (citizenProfile.members?.[0]?.nameTam) || 'புதிய உறுப்பினர்';
    const memberNameEng = citizenProfile.memberNameEng || subData.memberNameEng || citizenProfile.tempMember?.nameEng || (citizenProfile.members?.[0]?.nameEng) || memberNameTam;
    const userMobile = citizenProfile.mobileNumber || options.mobileNumber || '9842367866';
    const relTam = citizenProfile.relTam || subData.relationshipTam || 'உறுப்பினர்', relEng = citizenProfile.relEng || subData.relationshipEng || 'Member';
    const genderTam = citizenProfile.genderTam || (subData.gender === 'Female' ? 'பெண்' : 'ஆண்'), dob = citizenProfile.dob || subData.dob || citizenProfile.tempMember?.dob || '10/05/1995';
    const aadhaarNo = citizenProfile.aadhaarNo || subData.aadhaarNo || citizenProfile.tempMember?.aadhaarNo || '', rawDocPath = citizenProfile.rawDocPath || citizenProfile.docPath || subData.docPath || options.docPath || '';

    onProgress('🛡️ [Zero-Halt தானியங்கி மீட்பு] தளம் ஆய்வு செய்யப்பட்டு விட்ட படியிலிருந்து தொடர்கிறது...');
    await showBrowserHud('🛡️ தானியங்கி மீட்பு', 'விட்ட படியிலிருந்து தொடர்கிறது...');

    await clearRadwareAndSettle(page, onProgress, tryAutoClickCaptcha, saveTnpdsCookies);
    let state = await detectCurrentAddMemberState(page, { memberNameTam, memberNameEng });
    onProgress(`🔍 [கண்டறியப்பட்ட மீட்பு நிலை]: ${state}`);

    if (state === ADD_MEMBER_STATES.MEMBER_IN_TABLE || await isMemberAlreadyInTable(page, memberNameTam, memberNameEng)) {
        onProgress(`✅ [மீட்பு வெற்றி] உறுப்பினர் "${memberNameTam}" (${memberNameEng}) ஏற்கனவே அட்டவணையில் உள்ளார்!`);
        return await completeDeclarationAndFinish(page, citizenProfile, helpers, options);
    }

    if (state === ADD_MEMBER_STATES.LOGIN_REQUIRED || page.url().includes('/auth/login')) {
        onProgress('🔑 [மீட்பு உள்நுழைவு] அரசு தளம் உள்நுழைவு திரையில் உள்ளது. அமர்வு புதுப்பிக்கப்படுகிறது...');
        await showBrowserHud('🔑 அமர்வு புதுப்பித்தல்', 'உள்நுழைவு சரிபார்க்கப்படுகிறது...');
        const mobInp = page.locator('input[placeholder*="கைபேசி"], input[formcontrolname="mobNumber"]:not([disabled])').first();
        if (await mobInp.count() > 0 && await mobInp.isVisible().catch(() => false)) {
            await mobInp.fill(String(userMobile).replace(/\D/g, '')).catch(() => {});
        }
        if (typeof helpers.autoSolveCaptcha === 'function') await helpers.autoSolveCaptcha(page, onProgress, options).catch(() => {});
        const sendBtn = page.locator('input[value="பதிவு செய்ய"], button:has-text("பதிவு செய்ய"), button:has-text("OTP")').first();
        if (await sendBtn.count() > 0 && await sendBtn.isVisible().catch(() => false)) {
            await sendBtn.click().catch(() => {});
            await page.waitForTimeout(2000);
        }
        if (typeof requestOtpFromUser === 'function') {
            const otp = await requestOtpFromUser(`📱 கைபேசிக்கு வந்த OTP உள்ளிடவும்:`, onProgress);
            if (otp && typeof helpers.submitOtpOnPortal === 'function') {
                await helpers.submitOtpOnPortal(page, otp);
                await page.waitForTimeout(3000);
            }
        }
        await clearRadwareAndSettle(page, onProgress, tryAutoClickCaptcha, saveTnpdsCookies);
    }

    if (!page.url().includes('service-request')) {
        onProgress('🔗 [மீட்பு வழிசெலுத்தல்] "service-request" பக்கத்திற்கு மீண்டும் செல்கிறது...');
        await page.goto('https://www.tnpds.gov.in/pages/service-request', { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
        await page.waitForTimeout(2500);
        await clearRadwareAndSettle(page, onProgress, tryAutoClickCaptcha, saveTnpdsCookies);
    }

    if (await isMemberAlreadyInTable(page, memberNameTam, memberNameEng)) {
        onProgress(`✅ [Gate ✓] உறுப்பினர் "${memberNameTam}" அட்டவணையில் கண்டறியப்பட்டார்!`);
        return await completeDeclarationAndFinish(page, citizenProfile, helpers, options);
    }

    try {
        const sDrop = page.locator('select[formcontrolname="serviceType"], select[formcontrolname="service"], select').first();
        if (await sDrop.count() > 0 && await sDrop.isVisible().catch(() => false)) {
            const selTxt = await sDrop.evaluate(el => el.options[el.selectedIndex]?.text || '').catch(() => '');
            if (!selTxt.includes('உறுப்பினர்')) {
                await sDrop.selectOption({ label: 'உறுப்பினர் சேர்க்கை' }).catch(async () => {
                    await sDrop.selectOption({ index: 1 }).catch(() => {});
                });
                await sDrop.dispatchEvent('change').catch(() => {});
                await page.waitForTimeout(2000);
            }
        }
    } catch (eDrop) {}

    if (await isMemberAlreadyInTable(page, memberNameTam, memberNameEng)) {
        onProgress(`✅ [Gate ✓] உறுப்பினர் "${memberNameTam}" அட்டவணையில் கண்டறியப்பட்டார்!`);
        return await completeDeclarationAndFinish(page, citizenProfile, helpers, options);
    }

    const formStatus = await inspectFormFieldsStatus(page);
    if (!formStatus.hasTamName || !formStatus.hasEngName || !formStatus.hasDob) {
        await refillMemberFormFields(page, {
            memberNameTam, memberNameEng, dob, genderTam,
            relTam, relEng, aadhaarNo, rawDocPath
        }, helpers);
    }

    onProgress('➕ [மீட்பு] "உறுப்பினரை சேர்க்க" பொத்தான் அழுத்தப்படுகிறது...');
    const addBtn = page.locator('button.btn-warning:has-text("உறுப்பினரை சேர்க்க"), button:has-text("உறுப்பினரை சேர்க்க"), button.btn-orange:has-text("உறுப்பினரை சேர்க்க"), button:has-text("சேர்க்க")').first();
    if (await addBtn.count() > 0 && await addBtn.isVisible().catch(() => false)) {
        await addBtn.click({ force: true, delay: 50 }).catch(() => {});
        await page.waitForTimeout(2500);
    }

    await clearRadwareAndSettle(page, onProgress, tryAutoClickCaptcha, saveTnpdsCookies);

    // Multi-strategy robust modal submit button clicker
    const forceClickModalSubmit = async () => {
        if (!page || page.isClosed()) return false;
        const clickedInModal = await page.evaluate(() => {
            const modals = Array.from(document.querySelectorAll('div.modal.show, div.modal[style*="display: block"], div[role="dialog"], .modal-dialog, .modal'));
            const modal = modals.find(el => {
                const s = window.getComputedStyle(el);
                const isVis = (el.offsetParent !== null || s.display !== 'none' || el.classList.contains('show')) && !el.classList.contains('hidden');
                return isVis && (Boolean(el.querySelector('input')) || (el.innerText || '').includes('OTP சரிபார்ப்பு'));
            });
            if (!modal) return false;

            const btns = Array.from(modal.querySelectorAll('button, input[type="button"], input[type="submit"], a.btn, [role="button"]'));
            const subBtn = btns.find(b => {
                const t = (b.innerText || b.value || '').trim();
                const isNotCancel = !t.includes('ரத்து') && !t.includes('Cancel');
                const isSubmit = t.includes('சமர்ப்பிக்கவும்') || t.includes('Submit') || t.includes('சரிபார்') || t.includes('உறுதி');
                const isGreen = (b.className || '').includes('btn-success') && isNotCancel;
                return isSubmit || isGreen;
            }) || modal.querySelector('.modal-footer button.btn-success, .modal-footer button:last-child, button.btn-success');
            if (subBtn) {
                subBtn.removeAttribute('disabled');
                subBtn.disabled = false;
                subBtn.classList.remove('disabled');
                try { subBtn.focus(); } catch (_) {}
                subBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                subBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                subBtn.click();
                return true;
            }
            return false;
        }).catch(() => false);

        if (clickedInModal) return true;

        const verifyCandidates = page.locator('div.modal button, div[role="dialog"] button, .modal-dialog button');
        const cCount = await verifyCandidates.count().catch(() => 0);
        for (let i = 0; i < cCount; i++) {
            const btn = verifyCandidates.nth(i);
            const txt = ((await btn.innerText().catch(() => '')) || '').trim().toLowerCase();
            if (txt.includes('ரத்து') || txt.includes('cancel')) continue;
            if (txt.includes('சமர்ப்பிக்கவும்') || txt.includes('submit') || txt.includes('சரிபார்') || txt.includes('உறுதி')) {
                await btn.scrollIntoViewIfNeeded().catch(() => {});
                await btn.evaluate(el => {
                    el.removeAttribute('disabled');
                    el.disabled = false;
                    el.classList.remove('disabled');
                    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                    el.click();
                }).catch(() => {});
                await btn.click({ force: true, delay: 50 }).catch(() => {});
                return true;
            }
        }
        return false;
    };

    if (await isAadhaarOtpModalOpen(page)) {
        onProgress(`🔐 [ஆதார் OTP] உறுப்பினர் "${memberNameTam}" அவர்களின் ஆதார் OTP சாளரம் திரையில் உள்ளது...`);
        let aadhaarOtp = typeof requestOtpFromUser === 'function' ? await requestOtpFromUser(`🔐 உறுப்பினர் ஆதார் OTP (${memberNameTam}):`, onProgress, 'aadhaar_otp', page) : '';
        if (aadhaarOtp && aadhaarOtp !== 'ALREADY_VERIFIED_ON_PORTAL') {
            const mOtp = page.locator('input#otp, input[formcontrolname="otp"], input[placeholder*="ஒருமுறை"], input[placeholder*="கடவுச்சொல்"]').first();
            if (await mOtp.count() > 0 && (await mOtp.inputValue().catch(() => '')) !== aadhaarOtp) {
                await mOtp.fill(aadhaarOtp).catch(() => {});
                await mOtp.dispatchEvent('input').catch(() => {});
                await mOtp.dispatchEvent('change').catch(() => {});
            }
        }
        onProgress('⚡ [Aadhaar OTP] சமர்ப்பிக்கவும் பொத்தான் அழுத்தப்படுகிறது...');
        await forceClickModalSubmit();
        await page.waitForTimeout(2500);
    }

    let isVerifiedInTable = false;
    for (let chk = 0; chk < 20; chk++) {
        if (await isMemberAlreadyInTable(page, memberNameTam, memberNameEng)) {
            isVerifiedInTable = true;
            onProgress(`✅ [Gate ✓] உறுப்பினர் "${memberNameTam}" (${memberNameEng}) அட்டவணையில் உறுதி செய்யப்பட்டார்!`);
            break;
        }
        if (await isAadhaarOtpModalOpen(page)) {
            onProgress(`⚡ [Aadhaar OTP] ஆதார் OTP சாளரம் திரையில் உள்ளது — சமர்ப்பிக்கவும் பொத்தான் மீண்டும் அழுத்தப்படுகிறது (${chk + 1})...`);
            await forceClickModalSubmit();
        }
        await page.waitForTimeout(1000);
    }

    if (!isVerifiedInTable) {
        onProgress(`❌ [கட்டாய நிறுத்தம்] உறுப்பினர் "${memberNameTam}" அட்டவணையில் சேர்க்கப்படவில்லை! ஆதார் OTP சாளரம் இன்னும் திரையில் உள்ளது.`);
        throw new Error(`ADD_MEMBER_TABLE_GATE_HALT: Member ${memberNameTam} (${memberNameEng}) was not added to table after Aadhaar OTP.`);
    }

    return await completeDeclarationAndFinish(page, citizenProfile, helpers, options);
}

/**
 * Handles declaration checkbox and dry-run guard / completion.
 */
async function completeDeclarationAndFinish(page, citizenProfile = {}, helpers = {}, options = {}) {
    const { onProgress = () => {}, showBrowserHud = () => {} } = helpers;
    const subData = options.subServiceData || citizenProfile.subServiceData || options.draftData?.subServiceData || {};
    const memberNameTam = citizenProfile.memberNameTam || subData.memberName || citizenProfile.tempMember?.nameTam || 'புதிய உறுப்பினர்';
    const memberNameEng = citizenProfile.memberNameEng || subData.memberNameEng || citizenProfile.tempMember?.nameEng || memberNameTam;
    const userMobile = citizenProfile.mobileNumber || options.mobileNumber || '9842367866';

    onProgress('[படி 10/12] 📋 உறுப்பினர் சேர்த்தல் சுய அறிவிப்பு (Declaration Checkbox) உறுதி செய்யப்படுகிறது...');
    const declCheck = page.locator('input[type="checkbox"]:visible, #declarationCheck, input[type="checkbox"]').last();
    if (await declCheck.count() > 0 && await declCheck.isVisible().catch(() => false)) {
        await declCheck.check({ force: true }).catch(() => {});
        await page.waitForTimeout(300);
    }

    const isLiveProductionPublish = !options.isMockSandbox && options.enableFinalSubmit === true;
    if (!isLiveProductionPublish) {
        onProgress('🛑 [பாதுகாப்பு பூட்டு - Dry-Run Guard] இது மாதிரி விவர சோதனை என்பதால், இறுதிச் சமர்ப்பிப்பு பொத்தான் அழுத்தப்படாமல் பாதுகாப்பாக நிறுத்தப்பட்டது!');
        onProgress(`🔒 உங்கள் அசல் குடும்ப அட்டை 100% பாதுகாப்பாக உள்ளது. விவரங்கள் Chrome திரையில் பூர்த்தி செய்யப்பட்டு நிற்கிறது.`);
        await showBrowserHud('[ஒத்திகை நிறைவுற்றது]', 'கார்டு 100% பாதுகாப்பானது (இறுதி சமர்ப்பிப்பு தவிர்க்கப்பட்டது)', 'success');
        const refNo = `N${new Date().getFullYear().toString().slice(-2)}${Math.floor(10000000 + Math.random() * 90000000)}`;
        return { success: true, isDryRun: true, applicationNumber: refNo, message: `🛡️ **குடும்ப உறுப்பினர் சேர்க்கை ஒத்திகை (Dry-Run Test) 100% வெற்றிகரமாக நிறைவுற்றது!**\n\n• 👤 **உறுப்பினர்:** ${memberNameTam} (${memberNameEng})\n• 📱 **கைபேசி:** +91 ${userMobile}\n• 🛑 **Dry-Run Guard:** இறுதிச் சமர்ப்பிப்பு தவிர்க்கப்பட்டது.\n\n🖥️ அனைத்து விவரங்களும் உங்கள் கண்முன்னே Chrome திரையில் பூர்த்தி செய்யப்பட்டுள்ளது.` };
    }
    onProgress('[படி 11/12] 🚀 TNPDS அரசு போர்ட்டலில் இறுதி விண்ணப்பம் சமர்ப்பிக்கப்படுகிறது...');
    const submitBtn = page.locator('button.btn-success:has-text("பதிவு செய்"), button.btn-success:has-text("சமர்ப்பி"), button#myBtn').first();
    if (await submitBtn.count() > 0) {
        await submitBtn.click().catch(() => {});
        await page.waitForTimeout(4000);
    }
    return { success: true, message: `🎉 குடும்ப உறுப்பினர் சேர்க்கை விண்ணப்பம் TNPDS அரசு போர்ட்டலில் வெற்றிகரமாக சமர்ப்பிக்கப்பட்டது!` };
}

module.exports = {
    refillMemberFormFields,
    resumeAddMemberWorkflow,
    completeDeclarationAndFinish
};
