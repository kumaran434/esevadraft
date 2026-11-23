const fs = require('fs');
const storageService = require('../../services/storage_service');
const { inspectAndExtractDocument } = require('../../../ai_document_extractor');
const { validateUploadedDocument } = require('../../services/document_validator');
const { produceCompliantDocument } = require('../../../photo_studio');
const { advanceFlow } = require('./flow');
const { applyResidenceProofFields } = require('./extractor');
const {
    handleTnegaAadhaarUploadHelper,
    handleTnegaSmartCardUploadHelper,
    handleTnegaPassportPhotoUpload,
    handleCanActionsForCartridge,
    handleMemberSelectForCartridge
} = require('../_tnega_upload_utils');

const persistSessions = (...a) => storageService.persistSessions(...a);

async function handleIntake(ctx, req, res) {
    const { text, uploadedFile, sess } = ctx;
    if (!sess) return false;

    if (await handleCanActionsForCartridge({ ctx, req, res, advanceFlowFn: advanceFlow })) return true;

    if (handleMemberSelectForCartridge({
        ctx, req, res,
        resetIntakeState: 'RESIDENCE_INTAKE',
        advanceFlowFn: advanceFlow
    })) return true;

    if (sess.intakeState === 'RESIDENCE_AADHAAR_WAIT' || sess.intakeState === 'RESIDENCE_AADHAAR_BACK_WAIT' || sess.intakeState === 'RESIDENCE_INTAKE') {
        if (uploadedFile || sess.intakeState === 'RESIDENCE_AADHAAR_BACK_WAIT') {
            const handled = await handleTnegaAadhaarUploadHelper({
                ctx, req, res,
                backWaitState: 'RESIDENCE_AADHAAR_BACK_WAIT',
                advanceFlowFn: advanceFlow
            });
            if (handled) return true;
        }
        if (text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
            if (!sess.citizenProfile.yearsOfResidence) {
                sess.citizenProfile.yearsOfResidence = text.trim();
            } else if (!sess.citizenProfile.purposeOfCertificate) {
                sess.citizenProfile.purposeOfCertificate = text.trim();
            }
            persistSessions();
            const flowStep = advanceFlow(sess);
            sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }
    }

    if (sess.intakeState === 'RESIDENCE_SMARTCARD_WAIT' || sess.intakeState === 'RESIDENCE_SMARTCARD_BACK_WAIT') {
        const handled = await handleTnegaSmartCardUploadHelper({
            ctx, req, res,
            backWaitState: 'RESIDENCE_SMARTCARD_BACK_WAIT',
            advanceFlowFn: advanceFlow
        });
        if (handled !== null) return handled;
    }

    if (await handleTnegaPassportPhotoUpload({
        ctx, req, res,
        photoWaitState: 'RESIDENCE_PHOTO_WAIT',
        advanceFlowFn: advanceFlow,
        bannerText: `✨ **ஏஐ போட்டோ ஸ்டுடியோ:** விண்ணப்பதாரர் பாஸ்போர்ட் புகைப்படம் அரசு விதிகளுக்கு ஏற்ப (<50KB) தயார் செய்யப்பட்டு சேமிக்கப்பட்டது! 📸`
    })) return true;

    // Strictly ONLY RESIDENCE_PROOF_WAIT (never TNPDS RESIDENCE_PROOF_DOC)
    if (sess.intakeState === 'RESIDENCE_PROOF_WAIT') {
        if (uploadedFile) {
            let extracted = null;
            try { extracted = await inspectAndExtractDocument(uploadedFile.path, { isTnega: true }); } catch (_) {}

            const validation = validateUploadedDocument('residenceProof', extracted);
            if (!validation.valid) {
                try { if (fs.existsSync(uploadedFile.path)) fs.unlinkSync(uploadedFile.path); } catch (_) {}
                delete sess.citizenProfile.residenceProof;
                if (sess.tempUploads) delete sess.tempUploads.residenceProof;
                if (sess.citizenProfile.documents) delete sess.citizenProfile.documents.residenceProof;
                persistSessions();

                sess.chatHistory.push({
                    sender: 'bot',
                    text: validation.errorTamil,
                    options: [
                        { label: "📷 இருப்பிட ஆதாரம் பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                        { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
                    ]
                });
                res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
                return true;
            }

            const compliantProof = await produceCompliantDocument(uploadedFile.path);
            applyResidenceProofFields(sess.citizenProfile, compliantProof);
            if (!sess.tempUploads) sess.tempUploads = {};
            sess.tempUploads.residenceProof = compliantProof;
            persistSessions();

            const flowStep = advanceFlow(sess, `✅ **இருப்பிட ஆதாரம் வெற்றிகரமாகப் பெறப்பட்டது!** 🛡️`);
            sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }
    }

    if ((sess.intakeState === 'RESIDENCE_YEARS_WAIT' || (text && (text.includes('ஆண்டு') || text.includes('பிறப்பிலிருந்து') || text.includes('Years') || /^\d{1,2}$/.test(text)))) && text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
        sess.citizenProfile.yearsOfResidence = text.trim();
        persistSessions();
        const flowStep = advanceFlow(sess, `✅ தமிழ்நாட்டில் வசிக்கும் காலம் **${text.trim()}** எனப் பதிவானது!`);
        sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    if ((sess.intakeState === 'RESIDENCE_PURPOSE_WAIT' || (text && (text.includes('பயன்பாடு') || text.includes('கல்வி') || text.includes('வேலை') || text.includes('நலத்திட்டம்') || text.includes('பொது')))) && text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
        sess.citizenProfile.purposeOfCertificate = text.trim();
        persistSessions();
        const flowStep = advanceFlow(sess, `✅ சான்றிதழ் நோக்கம் **${text.trim()}** எனப் பதிவானது!`);
        sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    return false;
}

module.exports = { handleIntake };
