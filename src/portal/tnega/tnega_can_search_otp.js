const { getTnegaState, launchTnegaBrowser } = require('./tnega_browser_manager');
const { initTnegaHud, updateTnegaHud } = require('./tnega_hud');

async function loginTnegaOperator(credentials = {}, onProgress = () => {}, options = {}) {
    const state = getTnegaState();
    const isMock = options.isMockSandbox !== false;
    state.isMockSandboxMode = isMock;
    state.currentTnegaStep = 'OPERATOR_LOGIN';
    state.lastTnegaError = null;

    onProgress('🌐 TNeGA இ-சேவை போர்ட்டல் லாகின் தொடங்குகிறது...');

    if (state.isMockSandboxMode) {
        onProgress('🛡️ [Safe Mock Sandbox] மாதிரி போர்ட்டல் லாகின் உருவகப்படுத்தப்படுகிறது...');
        await new Promise(r => setTimeout(r, 800));
        onProgress('✅ ஆப்ரேட்டர் பயனர் குறியீடு சரிபார்க்கப்பட்டது (Operator: TNTACCHN001-01)');
        await new Promise(r => setTimeout(r, 600));
        onProgress('🎉 TNeGA இ-சேவை மையம் வெற்றிகரமாக உள்நுழைந்தது (Session Active)');
        state.currentTnegaStep = 'LOGGED_IN';
        return { success: true, isMockSandbox: true, sessionActive: true };
    }

    try {
        const { page } = await launchTnegaBrowser(options.headless || false, options);
        await initTnegaHud(page);
        await updateTnegaHud(page, {
            title: '🌐 TNeGA போர்ட்டல் தயாராகிறது...',
            desc: 'https://www.tnesevai.tn.gov.in/Default.aspx',
            badge: 'தயார் நிலை',
            type: 'working'
        });

        onProgress('🌐 https://www.tnesevai.tn.gov.in/Default.aspx பக்கத்திற்குச் செல்கிறது...');
        
        await page.goto('https://www.tnesevai.tn.gov.in/Default.aspx', {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });

        let opUsername = credentials.username || '';
        let opPassword = credentials.password || '';
        let opCode = credentials.operatorCode || 'OM';

        if (!opUsername || !opPassword) {
            try {
                const { getOperatorPortalCredentials } = require('../../services/portal_vault_service');
                const vaultCreds = getOperatorPortalCredentials(options.operatorUid || options.operatorName || 'admin', 'tnega');
                if (vaultCreds) {
                    opUsername = opUsername || vaultCreds.username;
                    opPassword = opPassword || vaultCreds.password;
                    opCode = opCode || vaultCreds.operatorCode;
                    onProgress(`🔐 [அரசு பெட்டகம்] சேமிக்கப்பட்ட ஆப்ரேட்டர் விவரங்கள் பெறப்பட்டன (${opUsername})`);
                }
            } catch (_) {}
        }

        const username = opUsername || process.env.TNEGA_USERNAME || '';
        const password = opPassword || process.env.TNEGA_PASSWORD || '';

        if (username && password) {
            const { performAutomatedTnegaLogin } = require('./tnega_can_register');
            await performAutomatedTnegaLogin(page, { username, password, operatorCode: opCode }, onProgress, options);
        } else {
            const userInp = page.locator('#txtuserName, input[name*="txtuserName"]').first();
            if (await userInp.count() > 0 && username) {
                await userInp.fill(username);
            }
            const passInp = page.locator('#txtpassword, input[type="password"]').first();
            if (await passInp.count() > 0 && password) {
                await passInp.fill(password);
            }
            const ddlOp = page.locator('#ContentPlaceHolderTop_OuterContentPlaceHolderBody_ddloperator, select[name*="ddloperator"]').first();
            if (await ddlOp.count() > 0) {
                await ddlOp.selectOption(opCode).catch(() => {});
            }
            state.isWaitingForCaptcha = true;
            onProgress('⌨️ தயவுசெய்து பிரவுசர் திரையில் தெரியும் Captcha குறியீட்டை உள்ளிட்டு Login செய்யவும்...');
        }

        await page.waitForFunction(() => {
            const u = window.location.href.toLowerCase();
            return !u.includes('default.aspx') || document.querySelector('#btnLogout, a[href*="Logout"]');
        }, { timeout: 120000 });

        state.isWaitingForCaptcha = false;
        state.currentTnegaStep = 'LOGGED_IN';
        onProgress('🎉 TNeGA இ-சேவை போர்ட்டலில் வெற்றிகரமாக உள்நுழைந்தது!');
        return { success: true, sessionActive: true };
    } catch (err) {
        state.isWaitingForCaptcha = false;
        state.lastTnegaError = err.message;
        onProgress(`❌ லாகின் பிழை: ${err.message}`);
        return { success: false, error: err.message };
    }
}

async function searchCitizenCan(searchCriteria = {}, onProgress = () => {}, options = {}) {
    const state = getTnegaState();
    const isMock = options.isMockSandbox !== false && options.forceRealGovtOtp !== true;
    state.currentTnegaStep = 'CAN_SEARCH';
    state.lastTnegaError = null;

    const aadhaar = String(searchCriteria.aadhaar || searchCriteria.headAadhaar || '').replace(/\s+/g, '');
    const mobile = String(searchCriteria.mobile || searchCriteria.mobileNumber || '').replace(/\D+/g, '');

    onProgress(`🔍 வாடிக்கையாளர் CAN எண் தேடல் தொடங்குகிறது (ஆதார்: ${aadhaar ? aadhaar.slice(0,4) + ' **** ' + aadhaar.slice(-4) : '—'}, மொபைல்: +91 ${mobile || '—'})...`);

    if (isMock) {
        await new Promise(r => setTimeout(r, 1000));

        if (mobile === '9790170026' || aadhaar === '987654321012' || aadhaar.endsWith('1012') || mobile.endsWith('70026')) {
            state.activeCanNumber = '1330109988771';
            onProgress(`🎉 [Safe Mock Sandbox] பதிவு செய்யப்பட்ட CAN எண் கண்டறியப்பட்டது: 1330109988771`);
            onProgress(`👤 பெயர்: குமரன் கி | தந்தை: கிருஷ்ணன் | மாவட்டம்: இராணிப்பேட்டை | வட்டம்: அரக்கோணம்`);
            state.currentTnegaStep = 'CAN_FOUND';
            return {
                success: true,
                found: true,
                canNumber: state.activeCanNumber,
                citizenName: 'குமரன் கி (Kumaran K)',
                fatherName: 'கிருஷ்ணன் (Krishnan)',
                mobile: mobile || '9790170026',
                aadhaar: aadhaar || '987654321012',
                district: 'இராணிப்பேட்டை',
                taluk: 'அரக்கோணம்',
                village: 'மின்னல்',
                isMockSandbox: true
            };
        } else {
            onProgress(`ℹ️ [Safe Mock Sandbox] இந்த ஆதார்/மொபைல் எண்ணுக்கு முன் பதிவு எதுவும் இல்லை (No records found).`);
            onProgress(`👉 அடுத்த கட்டமாக "புதிய CAN பதிவு (Register CAN)" செய்யலாம்.`);
            state.currentTnegaStep = 'CAN_NOT_FOUND';
            return {
                success: true,
                found: false,
                canNumber: null,
                message: 'பதிவு எதுவும் இல்லை (No records found)',
                isMockSandbox: true
            };
        }
    }

    try {
        const { registerNewCan } = require('./tnega_can_register');
        return await registerNewCan(
            {
                ...searchCriteria,
                aadhaar,
                headAadhaar: aadhaar,
                mobileNumber: mobile,
                mobile,
                subService: 'CAN_SEARCH'
            },
            onProgress,
            {
                ...options,
                isMockSandbox: false,
                searchOnly: true
            }
        );
    } catch (err) {
        state.lastTnegaError = err.message;
        onProgress(`❌ CAN தேடலில் பிழை: ${err.message}`);
        return { success: false, error: err.message };
    }
}

async function generateCanOtp(canNumber, onProgress = () => {}, options = {}) {
    const state = getTnegaState();
    const isMock = options.isMockSandbox !== false;
    state.currentTnegaStep = 'WAITING_FOR_CAN_OTP';
    state.isWaitingForCanOtp = true;
    state.lastTnegaError = null;

    onProgress(`📲 CAN (${canNumber}) சரிபார்ப்பிற்கு வாடிக்கையாளரின் பதிவு செய்யப்பட்ட கைபேசிக்கு OTP அனுப்பப்படுகிறது...`);

    if (isMock) {
        onProgress(`📞 [Safe Mock Sandbox] வாடிக்கையாளரின் மொபைலுக்கு மாதிரி OTP அனுப்பப்பட்டது!`);
        onProgress(`👉 ஆப்ரேட்டர் டெஸ்கில் ஏதேனும் 6-இலக்க OTP (எ.கா: 123456) அளிக்கவும்.`);

        return new Promise((resolve) => {
            state.pendingCanOtpResolver = (otp) => {
                state.isWaitingForCanOtp = false;
                onProgress(`✅ [Safe Mock Sandbox] OTP (${otp}) வெற்றிகரமாகச் சரிபார்க்கப்பட்டது! CAN உறுதி செய்யப்பட்டது.`);
                state.currentTnegaStep = 'CAN_VERIFIED';
                resolve({ success: true, canNumber, otpVerified: true, isMockSandbox: true });
            };
        });
    }

    try {
        const tnegaPage = state.page;
        if (!tnegaPage) throw new Error('உலாவி அமர்வு செயலில் இல்லை.');

        const rdoRow = tnegaPage.locator('input[name*="rdoSelectCAN"], input[type="radio"]').first();
        if (await rdoRow.count() > 0) {
            await rdoRow.check();
        }

        const btnGenOtp = tnegaPage.locator('input#btnGenerateOTP, button#btnGenerateOTP, input[value="Generate OTP"]').first();
        if (await btnGenOtp.count() > 0) {
            await btnGenOtp.click();
            await tnegaPage.waitForLoadState('networkidle').catch(() => {});
            onProgress('📱 போர்ட்டல் மூலம் OTP அனுப்பப்பட்டது. தயவுசெய்து OTP-யை உள்ளிடவும்.');
        }

        return new Promise((resolve, reject) => {
            state.pendingCanOtpResolver = async (otp) => {
                try {
                    state.isWaitingForCanOtp = false;
                    const inpOtp = tnegaPage.locator('input#txtOTP, input[name*="txtOTP"]').first();
                    if (await inpOtp.count() > 0) {
                        await inpOtp.fill(otp);
                    }
                    const btnSubmitOtp = tnegaPage.locator('input#btnConfirmOTP, button#btnConfirmOTP, input[value*="Confirm"]').first();
                    if (await btnSubmitOtp.count() > 0) {
                        await btnSubmitOtp.click();
                        await tnegaPage.waitForLoadState('networkidle').catch(() => {});
                    }
                    state.currentTnegaStep = 'CAN_VERIFIED';
                    onProgress('🎉 CAN OTP வெற்றிகரமாகச் சரிபார்க்கப்பட்டது!');
                    resolve({ success: true, canNumber, otpVerified: true });
                } catch (e) {
                    reject(e);
                }
            };
        });
    } catch (err) {
        state.isWaitingForCanOtp = false;
        state.lastTnegaError = err.message;
        onProgress(`❌ CAN OTP பிழை: ${err.message}`);
        return { success: false, error: err.message };
    }
}

module.exports = {
    loginTnegaOperator,
    searchCitizenCan,
    generateCanOtp
};
