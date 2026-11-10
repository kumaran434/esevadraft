/**
 * eSevaDraft - TNPDS Add Member Resilient Step Resumption & Radware Immunity Engine
 * Zero-Monolith Architecture: Isolated step recovery & checkpoint state machine (< 300 lines)
 * 
 * Enforces Zero-Halt Policy:
 * 1. Never stops or aborts when Radware error or page refresh occurs.
 * 2. Detects current DOM state after page reload.
 * 3. Resumes execution directly from the interrupted step ("விட்ட படியிலிருந்து தொடங்குதல்").
 */

const fs = require('fs');
const path = require('path');

const ADD_MEMBER_STATES = {
    RADWARE_CHALLENGE: 'RADWARE_CHALLENGE',
    LOGIN_REQUIRED: 'LOGIN_REQUIRED',
    NAVIGATE_TO_SERVICE: 'NAVIGATE_TO_SERVICE',
    SELECT_SERVICE_TYPE: 'SELECT_SERVICE_TYPE',
    FILL_FORM_FIELDS: 'FILL_FORM_FIELDS',
    AADHAAR_OTP_MODAL: 'AADHAAR_OTP_MODAL',
    MEMBER_IN_TABLE: 'MEMBER_IN_TABLE',
    DECLARATION_AND_SUBMIT: 'DECLARATION_AND_SUBMIT'
};

/**
 * Checks if Radware / Perfdrive / Anomaly challenge is active.
 */
async function isRadwareChallengeActive(page) {
    if (!page || page.isClosed()) return false;
    try {
        const curUrl = page.url().toLowerCase();
        if (curUrl.includes('perfdrive') || curUrl.includes('validate.perfdrive')) {
            return true;
        }
        return await page.evaluate(() => {
            // If legitimate TNPDS form inputs or logged-in indicators exist, Radware is NOT active!
            const isTnpdsActive = Boolean(
                document.querySelector('input[formcontrolname="mobNumber"], input[formcontrolname="otp"], input[placeholder*="கைபேசி"], input[placeholder*="OTP"], #nameTam, select[formcontrolname="serviceType"], select[formcontrolname="service"], #btnLogout, a[href*="logout"]')
            );
            if (isTnpdsActive) return false;

            const bodyText = (document.body && document.body.innerText) || '';
            const pageTitle = document.title || '';
            const isPerfdrive = window.location.hostname.includes('perfdrive') || window.location.href.includes('validate.perfdrive');
            const hasPerfdriveFrame = Boolean(document.querySelector('iframe[src*="perfdrive"], iframe[src*="validate."], iframe[src*="hcaptcha"]'));
            return isPerfdrive || hasPerfdriveFrame || bodyText.includes('ANOMALY DETECTED') || bodyText.includes('Radware Captcha') || bodyText.includes('think that you are a bot') || pageTitle.includes('Radware');
        }).catch(() => false);
    } catch (e) {
        return false;
    }
}

/**
 * Waits for Radware challenge to clear and page to settle without halting automation.
 */
async function clearRadwareAndSettle(page, onProgress = () => {}, tryAutoClickCaptcha = null, saveTnpdsCookies = null) {
    if (!page || page.isClosed()) return false;
    
    let hadChallenge = await isRadwareChallengeActive(page);
    if (!hadChallenge) return false;

    onProgress('🛡️ [பாதுகாப்பு சோதனை - Zero-Halt] Radware மனித சரிபார்ப்பு திரையில் உள்ளது. ஆட்டோமேஷன் நிறுத்தப்படாமல் காத்திருக்கிறது...');
    
    if (typeof tryAutoClickCaptcha === 'function') {
        await tryAutoClickCaptcha(page).catch(() => {});
    }

    // Wait patiently up to 150s for challenge to clear
    for (let w = 0; w < 150; w++) {
        await page.waitForTimeout(1000).catch(() => {});
        const stillActive = await isRadwareChallengeActive(page);
        if (!stillActive) {
            onProgress('✅ [பாதுகாப்பு தீர்வு] Radware சரிபார்ப்பு முடிந்தது! அரசு தளம் நிலைபெற காத்திருக்கிறது...');
            break;
        }
        if (typeof tryAutoClickCaptcha === 'function' && w % 5 === 0) {
            await tryAutoClickCaptcha(page).catch(() => {});
        }
    }

    // Allow page to settle after post-challenge redirect / refresh
    try {
        await page.waitForURL(url => !url.href.includes('perfdrive') && !url.href.includes('validate.'), { timeout: 15000 }).catch(() => {});
        await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
    } catch (eNav) {}
    await page.waitForTimeout(2500).catch(() => {});

    if (typeof saveTnpdsCookies === 'function') {
        await saveTnpdsCookies().catch(() => {});
    }
    return true;
}

/**
 * Checks if member is already added to the bottom table on the service request page.
 */
async function isMemberAlreadyInTable(page, memberNameTam, memberNameEng) {
    if (!page || page.isClosed()) return false;
    try {
        if (await isAadhaarOtpModalOpen(page)) return false;
        return await page.evaluate(({ nameTam, nameEng }) => {
            const tables = Array.from(document.querySelectorAll('table, mat-table, .table, .mat-table'));
            if (tables.length === 0) return false;
            // If only 1 table exists on page, it is the existing cardholders table
            const tbl = tables[tables.length - 1];
            const rows = Array.from(tbl.querySelectorAll('tbody tr, tr, mat-row'));
            const firstTam = (nameTam || '').split(' ')[0] || '';
            const firstEng = (nameEng || '').split(' ')[0] || '';
            return rows.some(r => {
                const txt = r.innerText || '';
                // STRICT GUARD: Never match existing Head of Household (குடும்ப தலைவர்)
                if (txt.includes('குடும்ப தலைவர்') || txt.includes('குடும்பத் தலைவர்') || txt.includes('Head of Family')) return false;
                return ((nameTam && txt.includes(nameTam)) || 
                        (nameEng && txt.includes(nameEng)) || 
                        (firstTam && firstTam.length > 2 && txt.includes(firstTam)) || 
                        (firstEng && firstEng.length > 2 && txt.includes(firstEng))) && 
                       !txt.includes('காணப்படவில்லை') && !txt.includes('ஆவணங்கள் காணப்படவில்லை');
            });
        }, { nameTam: memberNameTam, nameEng: memberNameEng }).catch(() => false);
    } catch (e) {
        return false;
    }
}

/**
 * Checks if an Aadhaar OTP modal is visible.
 */
async function isAadhaarOtpModalOpen(page) {
    if (!page || page.isClosed()) return false;
    try {
        return await page.evaluate(() => {
            const modals = Array.from(document.querySelectorAll('div.modal.show, div.modal[style*="display: block"], div[role="dialog"], .modal'));
            const visibleModal = modals.find(m => {
                const style = window.getComputedStyle(m);
                return style.display !== 'none' && style.visibility !== 'hidden' && m.offsetParent !== null;
            }) || modals.find(el => (el.innerText || '').includes('OTP சரிபார்ப்பு'));
            if (!visibleModal) return false;
            const txt = visibleModal.innerText || '';
            return txt.includes('OTP சரிபார்ப்பு') || txt.includes('கடவுச்சொல்') || Boolean(visibleModal.querySelector('input[placeholder*="ஒருமுறை"], input[placeholder*="கடவுச்சொல்"]'));
        }).catch(() => false);
    } catch (e) {
        return false;
    }
}

/**
 * Detects the current execution state from the live DOM and URL.
 * Enables 100% resilient step resumption after page refresh.
 */
async function detectCurrentAddMemberState(page, memberData = {}) {
    if (!page || page.isClosed()) return ADD_MEMBER_STATES.LOGIN_REQUIRED;
    
    // 1. Check Radware challenge
    if (await isRadwareChallengeActive(page)) {
        return ADD_MEMBER_STATES.RADWARE_CHALLENGE;
    }

    const curUrl = page.url().toLowerCase();

    // 2. Check if logged out
    const isLoginScreen = curUrl.includes('/auth/login') || await page.evaluate(() => {
        return Boolean(document.querySelector('input[placeholder*="கைபேசி"], input[formcontrolname="mobNumber"]:not([disabled])')) &&
               !document.querySelector('#btnLogout, a[href*="logout"], .user-profile');
    }).catch(() => false);

    if (isLoginScreen) {
        return ADD_MEMBER_STATES.LOGIN_REQUIRED;
    }

    // 3. Check if on Home or non-service page
    if (!curUrl.includes('service-request')) {
        return ADD_MEMBER_STATES.NAVIGATE_TO_SERVICE;
    }

    // 4. On service-request: Check if Member is ALREADY in the Table
    const memberNameTam = memberData.memberNameTam || memberData.memberName || '';
    const memberNameEng = memberData.memberNameEng || '';
    if (await isMemberAlreadyInTable(page, memberNameTam, memberNameEng)) {
        return ADD_MEMBER_STATES.MEMBER_IN_TABLE;
    }

    // 5. Check if Aadhaar OTP modal is open
    if (await isAadhaarOtpModalOpen(page)) {
        return ADD_MEMBER_STATES.AADHAAR_OTP_MODAL;
    }

    // 6. Check if "உறுப்பினர் சேர்க்கை" service is selected
    const isServiceSelected = await page.evaluate(() => {
        const sel = document.querySelector('select[formcontrolname="serviceType"], select[formcontrolname="service"]');
        if (!sel) return false;
        const selectedText = sel.options[sel.selectedIndex]?.text || '';
        return selectedText.includes('உறுப்பினர்') || sel.value === '1';
    }).catch(() => false);

    if (!isServiceSelected) {
        return ADD_MEMBER_STATES.SELECT_SERVICE_TYPE;
    }

    // 7. Otherwise, on Add Member form: Ready to fill/complete fields
    return ADD_MEMBER_STATES.FILL_FORM_FIELDS;
}

/**
 * Inspects form fields and returns what needs to be filled.
 */
async function inspectFormFieldsStatus(page) {
    if (!page || page.isClosed()) return { isFormReady: false };
    return await page.evaluate(() => {
        const engNameInp = document.querySelector('input[formcontrolname="name"], input#name');
        const tamNameInp = document.querySelector('input[formcontrolname="lname"], input[formcontrolname="tamilName"]');
        const dobInp = document.querySelector('input[formcontrolname="dateOfBirth"], input[formcontrolname="date"], input#mat-input-0');
        const genderSel = document.querySelector('select[formcontrolname="gender"]');
        const relSel = document.querySelector('select#relationship, select[formcontrolname="relationship"]');
        const docSel = document.querySelector('select#supportingDocuments, select[formcontrolname="supportingDocuments"]');
        
        return {
            isFormReady: Boolean(engNameInp || tamNameInp || genderSel || relSel),
            hasEngName: Boolean(engNameInp && engNameInp.value),
            hasTamName: Boolean(tamNameInp && tamNameInp.value),
            hasDob: Boolean(dobInp && dobInp.value),
            hasGender: Boolean(genderSel && genderSel.value && genderSel.value !== '0'),
            hasRel: Boolean(relSel && relSel.value && relSel.value !== '0'),
            hasDocType: Boolean(docSel && docSel.value && docSel.value !== '0')
        };
    }).catch(() => ({ isFormReady: false }));
}

module.exports = {
    ADD_MEMBER_STATES,
    isRadwareChallengeActive,
    clearRadwareAndSettle,
    isMemberAlreadyInTable,
    isAadhaarOtpModalOpen,
    detectCurrentAddMemberState,
    inspectFormFieldsStatus
};
