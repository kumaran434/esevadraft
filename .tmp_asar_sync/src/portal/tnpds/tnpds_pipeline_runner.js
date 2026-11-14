/**
 * eSevaDraft TNPDS Modular Step Pipeline Runner (World-Class Clean Architecture)
 * 
 * Executes government portal automation as a sequence of isolated, testable step modules:
 * Step 1: step1_browser_launcher
 * Step 2: step2_login_authenticator
 * Step 3: step3_otp_verifier
 * Step 4: step4_head_demographics
 * Step 5: step5_address_jurisdiction
 * Step 6: step6_family_members
 * Step 7: step7_gas_cylinder
 * Step 8: step8_document_uploader
 * Step 9: step9_declaration_submit
 */

const { launchPortalBrowser } = require('./steps/step1_browser_launcher');
const { navigateAndInitiateLogin } = require('./steps/step2_login_authenticator');
const { handleOtpVerification } = require('./steps/step3_otp_verifier');
const { fillHeadDemographics } = require('./steps/step4_head_demographics');
const { fillAddressAndJurisdiction } = require('./steps/step5_address_jurisdiction');
const { processFamilyMembers } = require('./steps/step6_family_members');
const { fillGasDetails } = require('./steps/step7_gas_cylinder');
const { uploadSupportingDocument } = require('./steps/step8_document_uploader');
const { handleDeclarationAndSubmit } = require('./steps/step9_declaration_submit');

class TnpdsPipelineRunner {
    constructor(config = {}) {
        this.config = config;
        this.stepTimes = {};
    }

    async runStep(stepName, stepFn) {
        const start = Date.now();
        console.log(`⏱️ [Pipeline] Running step: ${stepName}...`);
        try {
            const result = await stepFn();
            this.stepTimes[stepName] = Date.now() - start;
            console.log(`✅ [Pipeline] Step "${stepName}" completed in ${this.stepTimes[stepName]}ms`);
            return result;
        } catch (error) {
            console.error(`🚨 [Pipeline] Step "${stepName}" failed after ${Date.now() - start}ms:`, error.message);
            throw error;
        }
    }
}

module.exports = {
    TnpdsPipelineRunner,
    launchPortalBrowser,
    navigateAndInitiateLogin,
    handleOtpVerification,
    fillHeadDemographics,
    fillAddressAndJurisdiction,
    processFamilyMembers,
    fillGasDetails,
    uploadSupportingDocument,
    handleDeclarationAndSubmit
};
