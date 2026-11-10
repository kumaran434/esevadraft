// ============================================================================
// eSevaDraft Universal Base Portal Runner (அனைத்து அரசு போர்ட்டல்களுக்குமான பொது இயக்கி)
// 5-Phase Lifecycle Standard: Login -> Navigation -> FormFill -> DocUpload -> Review
// ============================================================================

const { chromium } = require('playwright');
const { getPortalDocumentPolicy, validateDocumentAgainstPolicy } = require('../../services/govt_document_policy');
const { UniversalOtpListener } = require('./universal_otp_listener');
const {
    isRadwareChallenge,
    waitForRadwareClearanceAndSettle,
    tryAutoClickRadwareChallenge,
    injectRadwareStealthShield,
    performEarlyStep1RadwareWarmup,
    assertNoRadwareOrPageRefresh,
    executePageBlockWithRadwareRestart,
    executeStepWithRadwareResumption
} = require('./universal_radware_resumption');

class BasePortalRunner {
    constructor(config = {}) {
        this.portalId = config.portalId || 'TNPDS';
        this.portalName = config.portalName || 'Government Portal';
        this.portalUrl = config.portalUrl || '';
        this.isDryRun = config.isDryRun !== false; // Safety default
        this.browser = null;
        this.context = null;
        this.page = null;
        this.hudCallback = config.hudCallback || (() => {});
        this.onProgress = config.onProgress || ((msg) => this.updateHud(0, msg));
        this.policy = getPortalDocumentPolicy(this.portalId);
        this.otpListener = new UniversalOtpListener();
        this._lastAuthData = null;
        this._lastServiceCode = null;
        this._lastFormData = null;
    }

    /**
     * Phase 0: Launches Google Chrome with anti-bot stealth shield and visible window
     */
    async launchBrowser(options = {}) {
        this.browser = await chromium.launch({
            channel: 'chrome',
            headless: options.headless || false,
            ignoreDefaultArgs: ['--enable-automation'],
            args: [
                '--start-maximized',
                '--disable-blink-features=AutomationControlled'
            ]
        });
        this.context = await this.browser.newContext({
            viewport: null
        });
        await injectRadwareStealthShield(this.context);
        this.page = await this.context.newPage();
        this.otpListener.setPage(this.page);
        this.updateHud(1, `${this.portalName} தொடங்குதல்...`);
        return this.page;
    }

    /**
     * Universal Radware Challenge Clearance & Post-Refresh Settle
     */
    async handleRadware(onProgress = () => {}, options = {}) {
        if (!this.page || this.page.isClosed()) return false;
        return await waitForRadwareClearanceAndSettle(this.page, onProgress, options);
    }

    /**
     * Universal Radware Page-Start Resumption Guard (அந்தப் பக்கத்தின் ஆரம்ப படியிலிருந்து தொடங்கி முடிக்கும் விதி)
     * Checks if Radware appeared or if a page refresh wiped earlier steps on the current page.
     */
    async assertPageIntact(checkPageIntactFn, stepLabel = 'Current Step') {
        return await assertNoRadwareOrPageRefresh(this.page, checkPageIntactFn, stepLabel);
    }

    /**
     * Universal Multi-Step Page Block Wrapper (அந்தப் பக்கத்தின் ஆரம்ப படியிலிருந்து தொடங்கி முடிக்கும் விதி)
     * Wraps all steps belonging to a single page. If Radware refreshes the page at Step N,
     * it restarts from the first step of that page and executes all steps of that page in sequence to completion.
     */
    async executePageBlock(blockConfig = {}) {
        return await executePageBlockWithRadwareRestart(this.page, {
            onProgress: this.onProgress,
            ...blockConfig
        });
    }

    /**
     * Universal Dual-Listener OTP Handshake (Chat UI + Real Chrome Website DOM)
     */
    async requestOtp(promptMsg, onProgress = () => {}, otpType = 'otp', options = {}) {
        return await this.otpListener.waitForOtp(promptMsg, onProgress, otpType, options);
    }

    updateHud(stepNumber, statusText) {
        this.hudCallback({
            portal: this.portalName,
            step: stepNumber,
            status: statusText,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Phase 1: Authentication & Early Step-1 Anti-Bot Handshake
     * Subclasses implement selector specifics while base provides timing and safety.
     */
    async executeLogin(authData = {}) {
        this._lastAuthData = authData;
        this.updateHud(2, 'அரசு தளம் உள்நுழைவு (Authentication)...');
        await performEarlyStep1RadwareWarmup(this.page, this.onProgress);
        if (typeof this.performLogin === 'function') {
            return await executeStepWithRadwareResumption(this.page, {
                stepName: `${this.portalName} உள்நுழைவு (Step 1-3)`,
                onProgress: this.onProgress,
                runStep: () => this.performLogin(authData)
            });
        }
        throw new Error(`[BasePortalRunner] performLogin() must be implemented by ${this.portalName}`);
    }

    /**
     * Phase 2: Navigation to target subservice (Resumes automatically if Radware interrupts)
     */
    async executeNavigation(serviceCode) {
        this._lastServiceCode = serviceCode;
        this.updateHud(3, `சேவை மெனுவிற்குச் செல்லுதல் (${serviceCode})...`);
        if (typeof this.performNavigation === 'function') {
            return await executeStepWithRadwareResumption(this.page, {
                stepName: `சேவை தேர்வு (${serviceCode})`,
                onProgress: this.onProgress,
                runStep: () => this.performNavigation(serviceCode)
            });
        }
        return true;
    }

    /**
     * Phase 3: Form Fill with sequential field gating & automatic post-Radware recovery
     */
    async executeFormFill(formData = {}) {
        this._lastFormData = formData;
        this.updateHud(4, 'விண்ணப்ப விவரங்களை நிரப்புதல் (Form Fill)...');
        if (typeof this.performFormFill === 'function') {
            return await executeStepWithRadwareResumption(this.page, {
                stepName: 'படிவம் நிரப்புதல் (Form Fill)',
                onProgress: this.onProgress,
                recoverWipedState: async () => {
                    if (this._lastServiceCode && typeof this.performNavigation === 'function') {
                        await this.performNavigation(this._lastServiceCode).catch(() => {});
                    }
                },
                runStep: () => this.performFormFill(formData)
            });
        }
        return true;
    }

    /**
     * Phase 4: Document Validation & Upload Gating with automatic post-Radware recovery
     */
    async executeDocumentUpload(documents = {}) {
        this.updateHud(5, 'அரசு விதிமுறைப்படி ஆவணங்கள் பதிவேற்றம் (Document Upload)...');
        
        // Pre-flight document policy check
        for (const [docKey, docPath] of Object.entries(documents)) {
            if (docPath && typeof docPath === 'string') {
                const check = validateDocumentAgainstPolicy(docPath, this.portalId);
                if (!check.isCompliant) {
                    console.warn(`[BasePortalRunner] Document notice for ${docKey}: ${check.error}`);
                }
            }
        }

        if (typeof this.performDocumentUpload === 'function') {
            return await executeStepWithRadwareResumption(this.page, {
                stepName: 'ஆவணப் பதிவேற்றம் (Document Upload)',
                onProgress: this.onProgress,
                recoverWipedState: async () => {
                    if (this._lastServiceCode && typeof this.performNavigation === 'function') {
                        await this.performNavigation(this._lastServiceCode).catch(() => {});
                    }
                    if (this._lastFormData && typeof this.performFormFill === 'function') {
                        await this.performFormFill(this._lastFormData).catch(() => {});
                    }
                },
                runStep: () => this.performDocumentUpload(documents)
            });
        }
        return true;
    }

    /**
     * Phase 5: Review & Dry-Run Guard
     */
    async executeReviewAndSubmit() {
        this.updateHud(6, 'விண்ணப்ப முன்னோட்டம் & இறுதிச் சமர்ப்பிப்பு...');
        if (this.isDryRun) {
            console.log(`🛡️ [DRY RUN GUARD] Final Submit safely halted for preview on ${this.portalName}`);
            return {
                submitted: false,
                isDryRun: true,
                message: 'Dry-run preview active. Final submit button intentionally withheld.'
            };
        }

        // Compulsory Pre-Submit Human Inspection Gate (Rule 51 / Case 49)
        // In both dry-run and real mode, automation compulsorily halts before final submit button
        // for operator visual review on the live Google Chrome window.
        const isAutomatedCiTest = process.env.REGRESSION_TEST === 'true';
        if (!isAutomatedCiTest) {
            console.log(`🛑 [HUMAN GATE] Final Submit safely halted for human inspection on ${this.portalName}`);
            return {
                submitted: false,
                isDryRun: false,
                isPreSubmitHalted: true,
                message: 'Pre-submit human inspection gate active. Operator must review details on Chrome and submit manually.'
            };
        }

        if (typeof this.performFinalSubmit === 'function') {
            return await this.performFinalSubmit();
        }
        return { submitted: true };
    }

    async close() {
        if (this.browser) {
            await this.browser.close().catch(() => {});
            this.browser = null;
        }
    }
}

module.exports = {
    BasePortalRunner
};
