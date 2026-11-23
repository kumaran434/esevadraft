const fs = require('fs');
const storageService = require('../../services/storage_service');
const { inspectAndExtractDocument } = require('../../../ai_document_extractor');
const { validateUploadedDocument } = require('../../services/document_validator');
const { ensureBilingualPair } = require('../../utils/bilingual_helper');
const { produceCompliantDocument } = require('../../../photo_studio');
const { advanceFlow } = require('./flow');
const { extractObcCommunityFields, extractObcIncomeFields } = require('./extractor');
const {
    handleTnegaAadhaarUploadHelper,
    handleTnegaSmartCardUploadHelper,
    handleTnegaPassportPhotoUpload,
    handleCanActionsForCartridge
} = require('../_tnega_upload_utils');

const persistSessions = (...a) => storageService.persistSessions(...a);

async function handleIntake(ctx, req, res) {
    const { text, uploadedFile, sess } = ctx;
    if (!sess) return false;

    if (await handleCanActionsForCartridge({ ctx, req, res, advanceFlowFn: advanceFlow })) return true;

    if (sess.intakeState === 'OBC_AADHAAR_WAIT' || sess.intakeState === 'OBC_AADHAAR_BACK_WAIT' || sess.intakeState === 'OBC_INTAKE') {
        if (uploadedFile || sess.intakeState === 'OBC_AADHAAR_BACK_WAIT') {
            const handled = await handleTnegaAadhaarUploadHelper({
                ctx, req, res,
                backWaitState: 'OBC_AADHAAR_BACK_WAIT',
                advanceFlowFn: advanceFlow
            });
            if (handled) return true;
        }
    }

    if (sess.intakeState === 'OBC_SMARTCARD_WAIT' || sess.intakeState === 'OBC_SMARTCARD_BACK_WAIT') {
        const handled = await handleTnegaSmartCardUploadHelper({
            ctx, req, res,
            backWaitState: 'OBC_SMARTCARD_BACK_WAIT',
            advanceFlowFn: advanceFlow
        });
        if (handled !== null) return handled;
    }

    if (await handleTnegaPassportPhotoUpload({
        ctx, req, res,
        photoWaitState: 'OBC_PHOTO_WAIT',
        advanceFlowFn: advanceFlow,
        bannerText: `✨ **ஏஐ போட்டோ ஸ்டுடியோ:** விண்ணப்பதாரர் பாஸ்போர்ட் புகைப்படம் (<50KB) தயார் செய்யப்பட்டு சேமிக்கப்பட்டது! 📸`
    })) return true;

    if (sess.intakeState === 'OBC_COMMUNITY_PROOF_WAIT' && uploadedFile) {
        let extracted = null;
        try { extracted = await inspectAndExtractDocument(uploadedFile.path, { isTnega: true }); } catch (_) {}

        const validation = validateUploadedDocument('communityProof', extracted);
        if (!validation.valid) {
            try { if (fs.existsSync(uploadedFile.path)) fs.unlinkSync(uploadedFile.path); } catch (_) {}
            sess.chatHistory.push({
                sender: 'bot',
                text: validation.errorTamil,
                options: [
                    { label: "📜 சாதிச் சான்றிதழ் பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                    { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
                ]
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }

        const compliantProof = await produceCompliantDocument(uploadedFile.path);
        sess.citizenProfile.communityProof = compliantProof;
        sess.citizenProfile.communityCertificate = compliantProof;
        sess.citizenProfile.communityCertificatePath = compliantProof;
        if (!sess.tempUploads) sess.tempUploads = {};
        sess.tempUploads.communityCertificate = compliantProof;
        sess.tempUploads.communityProof = compliantProof;
        if (!sess.citizenProfile.documents) sess.citizenProfile.documents = {};
        sess.citizenProfile.documents.communityCertificate = compliantProof;
        sess.citizenProfile.documents.communityProof = compliantProof;

        const extraInfo = extractObcCommunityFields(sess.citizenProfile, extracted);
        persistSessions();
        const flowStep = advanceFlow(sess, `✅ **சாதிச் சான்றிதழ் (Community Certificate) வெற்றிகரமாகப் பெறப்பட்டது!**${extraInfo}`);
        sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    if (sess.intakeState === 'OBC_INCOME_PROOF_WAIT' && uploadedFile) {
        let extracted = null;
        try { extracted = await inspectAndExtractDocument(uploadedFile.path, { isTnega: true }); } catch (_) {}

        const validation = validateUploadedDocument('incomeProof', extracted);
        if (!validation.valid) {
            try { if (fs.existsSync(uploadedFile.path)) fs.unlinkSync(uploadedFile.path); } catch (_) {}
            sess.chatHistory.push({
                sender: 'bot',
                text: validation.errorTamil,
                options: [
                    { label: "💰 வருமான / ITR சான்று பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                    { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
                ]
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }

        const compliantProof = await produceCompliantDocument(uploadedFile.path);
        sess.citizenProfile.incomeTaxReturn = compliantProof;
        sess.citizenProfile.incomeProof = compliantProof;
        if (!sess.tempUploads) sess.tempUploads = {};
        sess.tempUploads.incomeTaxReturn = compliantProof;
        sess.tempUploads.incomeProof = compliantProof;
        if (!sess.citizenProfile.documents) sess.citizenProfile.documents = {};
        sess.citizenProfile.documents.incomeTaxReturn = compliantProof;
        sess.citizenProfile.documents.incomeProof = compliantProof;

        const extraInc = extractObcIncomeFields(sess.citizenProfile, extracted);
        persistSessions();
        const flowStep = advanceFlow(sess, `✅ **வருமான வரி / வருமானச் சான்று வெற்றிகரமாகப் பெறப்பட்டது!**${extraInc}`);
        sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    if (sess.intakeState === 'OBC_MOTHER_NAME_WAIT' && text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
        const { eng, tam } = ensureBilingualPair(text.trim(), text.trim());
        sess.citizenProfile.motherNameEng = eng;
        sess.citizenProfile.motherNameTam = tam;
        persistSessions();
        const flowStep = advanceFlow(sess, `✅ தாயின் பெயர் **${sess.citizenProfile.motherNameTam || sess.citizenProfile.motherNameEng}** எனப் பதிவானது!`);
        sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    if ((sess.intakeState === 'OBC_CASTE_WAIT' || (text && text.startsWith('OBC_CASTE:'))) && text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
        const val = text.startsWith('OBC_CASTE:') ? text.replace('OBC_CASTE:', '').trim() : text.trim();
        sess.citizenProfile.caste = val;
        persistSessions();
        const flowStep = advanceFlow(sess, `✅ OBC சாதி **${val}** எனப் பதிவானது!`);
        sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    if ((sess.intakeState === 'OBC_OCCUPATION_WAIT' || (text && text.startsWith('OBC_OCC:'))) && text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
        const val = text.startsWith('OBC_OCC:') ? text.replace('OBC_OCC:', '').trim() : text.trim();
        sess.citizenProfile.occupation = val;
        sess.citizenProfile.applicantOccupation = val;
        persistSessions();
        const flowStep = advanceFlow(sess, `✅ விண்ணப்பதாரர் பணி **${val}** எனப் பதிவானது!`);
        sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    if ((sess.intakeState === 'OBC_FATHER_OCC_WAIT' || sess.intakeState === 'OBC_FATHER_OCCUPATION_WAIT' || (text && text.startsWith('OBC_FA_OCC:'))) && text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
        const raw = text.startsWith('OBC_FA_OCC:') ? text.replace('OBC_FA_OCC:', '').trim() : text.trim();
        if (/deceased|காலமான/i.test(raw)) {
            sess.citizenProfile.fatherAlive = false;
            sess.citizenProfile.fatherOccupation = 'Deceased';
        } else if (raw.includes('|')) {
            const [nat, occ] = raw.split('|');
            sess.citizenProfile.fatherAlive = true;
            sess.citizenProfile.fatherEmploymentNature = nat.trim();
            sess.citizenProfile.fatherOccupation = occ.trim();
        } else {
            sess.citizenProfile.fatherAlive = true;
            sess.citizenProfile.fatherOccupation = raw;
        }
        persistSessions();
        const flowStep = advanceFlow(sess, `✅ தந்தையின் பணி நிலை **${sess.citizenProfile.fatherOccupation}** எனப் பதிவானது!`);
        sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    if ((sess.intakeState === 'OBC_MOTHER_OCC_WAIT' || sess.intakeState === 'OBC_MOTHER_OCCUPATION_WAIT' || (text && text.startsWith('OBC_MO_OCC:'))) && text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
        const raw = text.startsWith('OBC_MO_OCC:') ? text.replace('OBC_MO_OCC:', '').trim() : text.trim();
        if (/deceased|காலமான/i.test(raw)) {
            sess.citizenProfile.motherAlive = false;
            sess.citizenProfile.motherOccupation = 'Deceased';
        } else if (raw.includes('|')) {
            const [nat, occ] = raw.split('|');
            sess.citizenProfile.motherAlive = true;
            sess.citizenProfile.motherEmploymentNature = nat.trim();
            sess.citizenProfile.motherOccupation = occ.trim();
        } else {
            sess.citizenProfile.motherAlive = true;
            sess.citizenProfile.motherOccupation = raw;
        }
        persistSessions();
        const flowStep = advanceFlow(sess, `✅ தாயின் பணி நிலை **${sess.citizenProfile.motherOccupation}** எனப் பதிவானது!`);
        sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    if ((sess.intakeState === 'OBC_INCOME_WAIT' || sess.intakeState === 'OBC_ANNUAL_INCOME_WAIT' || (text && text.startsWith('OBC_INCOME:'))) && text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
        const cleanInc = text.replace('OBC_INCOME:', '').replace(/\D+/g, '') || text.trim();
        sess.citizenProfile.annualIncome = cleanInc;
        persistSessions();
        const flowStep = advanceFlow(sess, `✅ குடும்ப ஆண்டு வருமானம் **₹${cleanInc}** எனப் பதிவானது!`);
        sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    return false;
}

module.exports = { handleIntake };
