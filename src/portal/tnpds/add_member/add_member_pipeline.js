/**
 * TNPDS Add Member Pipeline Runner (Modular Orchestrator < 300 lines)
 * 
 * Chains the 7 isolated Add Member steps:
 * 1. step1_login_session
 * 2. step2_navigate_service
 * 3. step3_member_demographics
 * 4. step4_relationship_aadhaar
 * 5. step5_document_upload
 * 6. step6_table_verification
 * 7. step7_declaration_submit
 */

const { ensureAuthenticatedSession } = require('./steps/step1_login_session');
const { navigateToAddMemberForm } = require('./steps/step2_navigate_service');
const { fillMemberDemographics } = require('./steps/step3_member_demographics');
const { fillRelationshipAndAadhaar } = require('./steps/step4_relationship_aadhaar');
const { selectAndUploadMemberDocument } = require('./steps/step5_document_upload');
const { addAndVerifyMemberInTable } = require('./steps/step6_table_verification');
const { handleDeclarationAndSubmit } = require('./steps/step7_declaration_submit');

class AddMemberPipeline {
    constructor(config = {}) {
        this.config = config;
    }

    async executeStep(name, fn) {
        const start = Date.now();
        console.log(`⏱️ [AddMemberPipeline] Executing: ${name}...`);
        const result = await fn();
        console.log(`✅ [AddMemberPipeline] ${name} done in ${Date.now() - start}ms`);
        return result;
    }

    async runPipeline(page, memberData, helpers = {}, options = {}) {
        await this.executeStep('Step 1: Session & Authentication', () =>
            ensureAuthenticatedSession(page, memberData.mobileNumber || memberData.userMobile, helpers)
        );
        await this.executeStep('Step 2: Service Navigation', () =>
            navigateToAddMemberForm(page, helpers)
        );
        await this.executeStep('Step 3: Member Demographics', () =>
            fillMemberDemographics(page, memberData, helpers)
        );
        await this.executeStep('Step 4: Relationship & Aadhaar', () =>
            fillRelationshipAndAadhaar(page, memberData, helpers)
        );
        await this.executeStep('Step 5: Document Upload', () =>
            selectAndUploadMemberDocument(page, memberData, helpers)
        );
        await this.executeStep('Step 6: Table Verification & Aadhaar OTP', () =>
            addAndVerifyMemberInTable(page, memberData, helpers)
        );
        return await this.executeStep('Step 7: Declaration & Submit Guard', () =>
            handleDeclarationAndSubmit(page, options, helpers)
        );
    }
}

module.exports = {
    AddMemberPipeline,
    ensureAuthenticatedSession,
    navigateToAddMemberForm,
    fillMemberDemographics,
    fillRelationshipAndAadhaar,
    selectAndUploadMemberDocument,
    addAndVerifyMemberInTable,
    handleDeclarationAndSubmit
};
