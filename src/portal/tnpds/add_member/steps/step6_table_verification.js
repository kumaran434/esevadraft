/**
 * TNPDS Add Member — Step 6: Aadhaar OTP & Table Verification Gate (< 300 lines)
 */

async function forceClickModalSubmit(page) {
    const clickedInModal = await page.evaluate(() => {
        const modals = Array.from(document.querySelectorAll('div.modal.show, div.modal[style*="display: block"], div[role="dialog"], .modal-dialog, .modal'));
        const modal = modals.find(el => {
            const s = window.getComputedStyle(el);
            const isVis = (el.offsetParent !== null || s.display !== 'none' || el.classList.contains('show')) && !el.classList.contains('hidden');
            return isVis && Boolean(el.querySelector('input'));
        });
        if (!modal) return false; // Strict Scoping Guard: Never touch document outside modal!

        const btns = Array.from(modal.querySelectorAll('button, input[type="button"], input[type="submit"], a.btn, [role="button"]'));
        const subBtn = btns.find(b => {
            const t = (b.innerText || b.value || '').trim();
            const isNotCancel = !t.includes('ரத்து') && !t.includes('Cancel');
            const isSubmit = t.includes('சமர்ப்பிக்கவும்') || t.includes('Submit') || t.includes('சரிபார்') || t.includes('உறுதி');
            const isGreen = (b.className || '').includes('btn-success') && isNotCancel;
            return (isSubmit || isGreen) && b.offsetParent !== null;
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

    if (clickedInModal) return;

    const modalLoc = page.locator('div.modal:has(input) button.btn-success, div.modal:has(input) button:has-text("சமர்ப்பிக்கவும்"), div.modal:has(input) button:has-text("சரிபார்க்கவும்"), div.modal:has(input) .modal-footer button:last-child').first();
    if (await modalLoc.count() > 0 && await modalLoc.isVisible().catch(() => false)) {
        await modalLoc.click({ force: true, delay: 50 }).catch(() => {});
    }
}

async function isAadhaarModalOpen(page) {
    if (!page || page.isClosed()) return false;
    if (!page.url().includes('service-request')) return false;
    return await page.evaluate(() => {
        const modals = Array.from(document.querySelectorAll('div.modal.show, div.modal[style*="display: block"], div[role="dialog"], .modal-dialog, .modal'));
        return modals.some(m => {
            const s = window.getComputedStyle(m);
            const isVis = s.display !== 'none' && s.visibility !== 'hidden' && m.offsetWidth > 0 && m.offsetHeight > 0;
            const hasOtpInp = Boolean(m.querySelector('input[placeholder*="ஒருமுறை"], input[placeholder*="கடவுச்சொல்"], input[placeholder*="OTP"], input[placeholder*="otp"], input[formcontrolname*="otp"], input#otp'));
            return isVis && hasOtpInp;
        });
    }).catch(() => false);
}

async function hasModal6Digits(page) {
    return await page.evaluate(() => {
        const inps = Array.from(document.querySelectorAll('div.modal input#otp, div.modal input[formcontrolname="otp"], div.modal input[placeholder*="கடவுச்சொல்"], div.modal input[placeholder*="ஒருமுறை"]'));
        return Boolean(inps.find(i => !(i.getAttribute('formcontrolname') || '').toLowerCase().includes('aadhaar') && (i.value || '').replace(/\D/g, '').length === 6));
    }).catch(() => false);
}

async function addAndVerifyMemberInTable(page, memberDetails, helpers = {}) {
    const { onProgress = () => {}, showBrowserHud = async () => {}, humanType = async () => {}, humanClick = async () => {}, requestOtpFromUser = async () => '', scanAndBroadcastToasts = async () => {}, addMemberResumption = null, addMemberStepHealer = null, tryAutoClickCaptcha = async () => {}, saveTnpdsCookies = async () => {}, isTestSuite = false } = helpers;

    const memberNameTam = memberDetails.nameTam || memberDetails.memberNameTam || '';
    const memberNameEng = memberDetails.nameEng || memberDetails.memberNameEng || '';
    const relTam = memberDetails.relTam || memberDetails.relationshipTam || '';

    console.log(`➕ [Add Member: Step 6] Clicking Add Member and verifying table for ${memberNameTam} (${memberNameEng})...`);
    if (onProgress) onProgress('[படி 9/12] ➕ "உறுப்பினரைச் சேர்க்க" பொத்தான் அழுத்தப்பட்டு பட்டியலில் சரிபார்க்கப்படுகிறது...');
    await showBrowserHud('[படி 9/12] உறுப்பினரை சேர்க்க', `${memberNameTam} சேர்க்கப்படுகிறது...`);

    // 1. Click "உறுப்பினரை சேர்க்க" button
    const addBtnLocators = [
        page.locator('button.btn-warning:has-text("உறுப்பினரை சேர்க்க"), button:has-text("உறுப்பினரை சேர்க்க"), button.btn-orange:has-text("உறுப்பினரை சேர்க்க"), button:has-text("சேர்க்க")').first()
    ];

    let clicked = false;
    for (const loc of addBtnLocators) {
        if (await loc.count() > 0 && await loc.isVisible().catch(() => false)) {
            await loc.scrollIntoViewIfNeeded().catch(() => {});
            clicked = await humanClick(page, loc);
            if (!clicked) {
                await loc.click({ force: true, delay: 50 }).catch(() => {});
                clicked = true;
            }
            break;
        }
    }

    if (!clicked) {
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button, a.btn, [role="button"], input[type="button"]'));
            const b = btns.find(el => (el.innerText || el.value || '').includes('உறுப்பினரை சேர்க்க'));
            if (b) b.click();
        }).catch(() => {});
    }

    await page.waitForTimeout(1000);

    // 2. Check for Aadhaar OTP Modal (for adult members)
    let isAadhaarOtpModalVisible = false;
    for (let mWait = 0; mWait < 12; mWait++) {
        const modalFound = await page.evaluate(() => {
            const modals = Array.from(document.querySelectorAll('div.modal.show, div.modal[style*="display: block"], div[role="dialog"], .modal'));
            const m = modals.find(el => {
                const style = window.getComputedStyle(el);
                return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
            }) || modals.find(el => (el.innerText || '').includes('OTP சரிபார்ப்பு'));
            if (!m) return false;
            const txt = m.innerText || '';
            return txt.includes('OTP சரிபார்ப்பு') || txt.includes('சரியான OTP') || txt.includes('கடவுச்சொல்') || Boolean(m.querySelector('input[placeholder*="ஒருமுறை"], input[placeholder*="கடவுச்சொல்"]'));
        }).catch(() => false);

        if (modalFound) {
            isAadhaarOtpModalVisible = true;
            break;
        }

        // Check if member already appeared in table (e.g. child under 5)
        const tableHasMember = await page.evaluate(({ nameTam, nameEng }) => {
            const tables = Array.from(document.querySelectorAll('table, mat-table, .table, .mat-table'));
            if (tables.length === 0) return false;
            const tbl = tables[tables.length - 1];
            const rows = Array.from(tbl.querySelectorAll('tbody tr, tr, mat-row'));
            const firstTam = (nameTam || '').split(' ')[0] || '';
            const firstEng = (nameEng || '').split(' ')[0] || '';
            return rows.some(r => {
                const txt = r.innerText || '';
                return ((nameTam && txt.includes(nameTam)) || (nameEng && txt.includes(nameEng)) || (firstTam && firstTam.length > 2 && txt.includes(firstTam)) || (firstEng && firstEng.length > 2 && txt.includes(firstEng))) && !txt.includes('காணப்படவில்லை');
            });
        }, { nameTam: memberNameTam, nameEng: memberNameEng }).catch(() => false);

        if (tableHasMember) break;
        await page.waitForTimeout(500);
    }

    // 3. Handle Aadhaar OTP if modal appeared
    if (isAadhaarOtpModalVisible) {
        if (onProgress) onProgress(`🔐 [ஆதார் OTP தேவை] உறுப்பினர் "${memberNameTam}" (${memberNameEng}) அவர்களின் ஆதார் எண்ணிற்கு அரசு SMS OTP அனுப்பியுள்ளது!`);
        await showBrowserHud('[ஆதார் OTP தேவை]', `${memberNameTam} ஆதார் OTP உள்ளிடவும்`, 'warning');

        let aadhaarOtp = await requestOtpFromUser(
            `🔐 **உறுப்பினர் ஆதார் சரிபார்ப்பு OTP (${memberNameTam} - ${relTam}):**\n\n` +
            `அரசு TNPDS தளம் மூலம் **${memberNameTam}** அவர்களின் ஆதார் இணைக்கப்பட்ட கைபேசி எண்ணிற்கு 6-இலக்க ஆதார் OTP அனுப்பப்பட்டுள்ளது.\n\n` +
            `அந்த OTP எண்ணை இங்கே Chat-ல் தட்டச்சு செய்யவும் (அல்லது உங்கள் Chrome திரையில் உள்ள சாளரத்தில் நேரடியாகவும் உள்ளிடலாம்):`,
            onProgress,
            'aadhaar_otp'
        );

        let targetOtp = (aadhaarOtp && aadhaarOtp !== 'ALREADY_VERIFIED_ON_PORTAL') ? String(aadhaarOtp).replace(/\D/g, '') : '';
        if (!targetOtp) {
            targetOtp = await page.evaluate(() => {
                const modal = document.querySelector('div.modal.show, div.modal[style*="display: block"], div[role="dialog"], .modal-dialog') || document;
                const inps = Array.from(modal.querySelectorAll('input'));
                const otpInp = inps.find(i => (i.value || '').replace(/\D/g, '').length === 6);
                return otpInp ? otpInp.value.replace(/\D/g, '') : '';
            }).catch(() => '');
        }

        if (targetOtp && targetOtp.length === 6) {
            if (onProgress) onProgress(`⚡ [Aadhaar OTP] உறுப்பினர் ஆதார் OTP (${targetOtp}) சாளரத்தில் நிரப்பப்பட்டு சமர்ப்பிக்கப்படுகிறது...`);
            const modalOtpInput = page.locator('div.modal.show input[placeholder*="ஒருமுறை"], div.modal input[placeholder*="ஒருமுறை"], div.modal.show input[placeholder*="கடவுச்சொல்"], div.modal input[placeholder*="கடவுச்சொல்"], div.modal.show input[formcontrolname*="otp"], div.modal input[formcontrolname*="otp"]').first();

            if (await modalOtpInput.count() > 0) {
                await modalOtpInput.scrollIntoViewIfNeeded().catch(() => {});
                await modalOtpInput.click().catch(() => {});
                await modalOtpInput.fill(targetOtp).catch(() => {});
                await modalOtpInput.dispatchEvent('input', { bubbles: true }).catch(() => {});
                await modalOtpInput.dispatchEvent('change', { bubbles: true }).catch(() => {});
                await modalOtpInput.dispatchEvent('blur', { bubbles: true }).catch(() => {});
            } else {
                await page.evaluate((otpVal) => {
                    const modals = Array.from(document.querySelectorAll('div.modal.show, div.modal[style*="display: block"], div[role="dialog"], .modal'));
                    const m = modals.find(el => el.offsetParent !== null || window.getComputedStyle(el).display !== 'none') || document;
                    const inps = Array.from(m.querySelectorAll('input'));
                    const otpInp = inps.find(i => {
                        const p = (i.placeholder || '').toLowerCase();
                        const n = (i.name || i.id || i.getAttribute('formcontrolname') || '').toLowerCase();
                        return p.includes('ஒருமுறை') || p.includes('கடவுச்சொல்') || p.includes('otp') || n.includes('otp');
                    }) || inps[inps.length - 1];
                    if (otpInp) {
                        otpInp.value = otpVal;
                        otpInp.dispatchEvent(new Event('input', { bubbles: true }));
                        otpInp.dispatchEvent(new Event('change', { bubbles: true }));
                        otpInp.dispatchEvent(new Event('blur', { bubbles: true }));
                    }
                }, targetOtp).catch(() => {});
            }
            await page.waitForTimeout(400);
        }

        const hasDigits = (targetOtp && targetOtp.length === 6) || (await hasModal6Digits(page));
        if (hasDigits) await forceClickModalSubmit(page);

        // Wait for modal to dismiss with active re-clicking ONLY when 6 digits are typed
        if (onProgress) onProgress('⏳ [சரிபார்ப்பு] ஆதார் OTP அரசு போர்ட்டலில் சரிபார்க்கப்படுகிறது...');
        for (let w = 0; w < 12; w++) {
            if (!(await isAadhaarModalOpen(page))) break;
            if ((await hasModal6Digits(page)) && w >= 2 && w % 3 === 0) {
                if (onProgress) onProgress(`⚡ [Aadhaar OTP] சமர்ப்பிக்கவும் பொத்தான் மீண்டும் அழுத்தப்படுகிறது (${w} விநாடி)...`);
                await forceClickModalSubmit(page);
            }
            await page.waitForTimeout(1000);
        }
        await page.waitForTimeout(1500);
        await scanAndBroadcastToasts().catch(() => {});
    }

    // 4. Table Verification Gate (Strict Inspection of Added Members Table)
    if (onProgress) onProgress('🔍 [சரிபார்ப்பு] புதிய உறுப்பினர் அட்டவணையில் சேர்க்கப்பட்டுள்ளாரா என சரிபார்க்கப்படுகிறது...');
    let memberAddedToTable = false;

    for (let t = 0; t < 30; t++) {
        if (addMemberResumption && await addMemberResumption.isRadwareChallengeActive(page)) {
            if (onProgress) onProgress('🛡️ [பாதுகாப்பு சோதனை - Zero-Halt] Radware மனித சரிபார்ப்பு திரையில் உள்ளது. காத்திருக்கிறது...');
            await addMemberResumption.clearRadwareAndSettle(page, onProgress, tryAutoClickCaptcha, saveTnpdsCookies);
            t = 0;
        }

        const isAdded = await page.evaluate(({ nameTam, nameEng }) => {
            const tables = Array.from(document.querySelectorAll('table, mat-table, .table, .mat-table'));
            if (tables.length === 0) return false;
            const tbl = tables[tables.length - 1];
            const rows = Array.from(tbl.querySelectorAll('tbody tr, tr, mat-row'));
            const firstTamWord = (nameTam || '').split(' ')[0] || '';
            const firstEngWord = (nameEng || '').split(' ')[0] || '';
            return rows.some(r => {
                const txt = r.innerText || '';
                if (txt.includes('குடும்ப தலைவர்') || txt.includes('குடும்பத் தலைவர்') || txt.includes('Head of')) return false;
                const hasName = (nameTam && txt.includes(nameTam)) || 
                                (nameEng && txt.includes(nameEng)) ||
                                (firstTamWord && firstTamWord.length > 2 && txt.includes(firstTamWord)) ||
                                (firstEngWord && firstEngWord.length > 2 && txt.includes(firstEngWord));
                return hasName && !txt.includes('ஆவணங்கள் காணப்படவில்லை') && !txt.includes('பதிவுகள் காணப்படவில்லை');
            });
        }, { nameTam: memberNameTam, nameEng: memberNameEng }).catch(() => false);

        const modalOpen = isAadhaarOtpModalVisible ? await isAadhaarModalOpen(page) : false;
        if (isAdded && !modalOpen) {
            memberAddedToTable = true;
            if (onProgress) onProgress(`✅ [Gate ✓] உறுப்பினர் "${memberNameTam}" (${memberNameEng}) அட்டவணையில் வெற்றிகரமாக சேர்க்கப்பட்டார்!`);
            break;
        }

        const rowCount = await page.locator(`table:last-of-type tr:not(:has-text("தலைவர்")):has-text("${memberNameTam}"), table:last-of-type tr:not(:has-text("தலைவர்")):has-text("${memberNameEng}")`).count().catch(() => 0);
        if (rowCount > 0 && !modalOpen) {
            memberAddedToTable = true;
            if (onProgress) onProgress(`✅ [Gate ✓] உறுப்பினர் "${memberNameTam}" (${memberNameEng}) அட்டவணை வரிசையில் வெற்றிகரமாக கண்டறியப்பட்டார்!`);
            break;
        }

        // If Aadhaar OTP modal is still on screen during table check, submit ONLY if 6 digits are typed!
        if (isAadhaarOtpModalVisible) {
            const stillOpen = await isAadhaarModalOpen(page);
            if (stillOpen) {
                if ((await hasModal6Digits(page)) && t % 3 === 0) {
                    if (onProgress) onProgress('⚡ [Aadhaar OTP] ஆதார் சரிபார்ப்பு சாளரம் திரையில் உள்ளது — சமர்ப்பிக்கவும் பொத்தான் அழுத்தப்படுகிறது...');
                    await forceClickModalSubmit(page);
                }
                if (t >= 28) {
                    if (onProgress) onProgress('⏳ [Aadhaar OTP] உறுப்பினர் ஆதார் OTP உள்ளிடப்படுவதற்கு காத்திருக்கிறது...');
                    t = 15; // Extend waiting while modal is active on screen
                }
            }
        }

        await page.waitForTimeout(1000);
    }

    if (!memberAddedToTable) {
        const stillOpen = isAadhaarOtpModalVisible ? await isAadhaarModalOpen(page) : false;
        const msg = stillOpen ? 'உறுப்பினர் ஆதார் OTP இன்னும் உள்ளிடப்படவில்லை. சரியான OTP-ஐ உள்ளிடவும்.' : 'அட்டவணையில் பெயர் வரவில்லை';
        if (onProgress) onProgress(`❌ [கட்டாய நிறுத்தம்] உறுப்பினர் "${memberNameTam}" அட்டவணையில் சேர்க்கப்படவில்லை! (${msg})`);
        await showBrowserHud('❌ உறுப்பினர் சேர்க்கப்படவில்லை', msg, 'error');
        throw new Error(`ADD_MEMBER_TABLE_GATE_HALT: Member ${memberNameTam} (${memberNameEng}) was not added to table after clicking button. ${msg} Zero-Step-Skip enforced.`);
    }

    console.log(`✅ [Add Member: Step 6] Member ${memberNameTam} verified in table successfully.`);
    return { success: true, memberAddedToTable: true };
}

module.exports = {
    addAndVerifyMemberInTable
};
