const storageService = require('../../services/storage_service');
const { inspectAndExtractDocument } = require('../../../ai_document_extractor');
const { ensureBilingualPair } = require('../../utils/bilingual_helper');
const { produceCompliantDocument, produceCompliantPassportPhoto } = require('../../../photo_studio');
const { advanceFlow } = require('./flow');
const { extractWidowDeathAndAadhaarFields } = require('./extractor');
const {
    handleTnegaAadhaarUploadHelper,
    handleTnegaSmartCardUploadHelper,
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
        resetIntakeState: 'WIDOW_INTAKE',
        advanceFlowFn: advanceFlow
    })) return true;

    if (sess.intakeState === 'WIDOW_AADHAAR_WAIT' || sess.intakeState === 'WIDOW_AADHAAR_BACK_WAIT') {
        const handled = await handleTnegaAadhaarUploadHelper({
            ctx, req, res,
            backWaitState: 'WIDOW_AADHAAR_BACK_WAIT',
            advanceFlowFn: advanceFlow
        });
        if (handled !== null) return handled;
    }

    if (sess.intakeState === 'WIDOW_SMARTCARD_WAIT' || sess.intakeState === 'WIDOW_SMARTCARD_BACK_WAIT') {
        const handled = await handleTnegaSmartCardUploadHelper({
            ctx, req, res,
            backWaitState: 'WIDOW_SMARTCARD_BACK_WAIT',
            advanceFlowFn: advanceFlow
        });
        if (handled !== null) return handled;
    }

    if (['WIDOW_DEATH_CERT_WAIT', 'WIDOW_PHOTO_WAIT', 'WIDOW_MARRIAGE_PROOF_WAIT'].includes(sess.intakeState)) {
        if (text === 'TRIGGER_FILE_UPLOAD') {
            const limitMsg = sess.intakeState === 'WIDOW_PHOTO_WAIT' ? '<50KB பாஸ்போர்ட் அளவிற்கு' : '<200KB அளவிற்கு';
            sess.chatHistory.push({
                sender: 'bot',
                text: `📤 தயவுசெய்து ஆவணத்தை கீழே உள்ள கோப்பு பொத்தானைப் பயன்படுத்திப் பதிவேற்றவும் (${limitMsg} தானாகச் சுருக்கப்படும் ✨):`,
                actionRequired: 'upload',
                uploadPrompt: 'ஆவணம் பதிவேற்றவும்'
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }
        if (text === 'WD_MAR_PROOF_USE_SMARTCARD' && sess.intakeState === 'WIDOW_MARRIAGE_PROOF_WAIT') {
            const p = sess.citizenProfile;
            const scPath = p.smartCard || p.rationCard || p.smartCardDocPath || p.documents?.smartCard || p.documents?.rationCard || sess.tempUploads?.smartCard;
            if (scPath) {
                if (!p.documents) p.documents = {};
                if (!sess.tempUploads) sess.tempUploads = {};
                p.marriageProof = scPath;
                p.documents.marriageProof = scPath;
                sess.tempUploads.marriageProof = scPath;
                persistSessions();
                const flowStep = advanceFlow(sess, `✅ குடும்ப ஸ்மார்ட் கார்டு திருமண ஆதாரமாக இணைக்கப்பட்டது! 🛡️`);
                sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
                res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
                return true;
            }
        }
        if (uploadedFile) {
            if (!sess.citizenProfile.documents) sess.citizenProfile.documents = {};
            if (!sess.tempUploads) sess.tempUploads = {};
            if (sess.intakeState === 'WIDOW_PHOTO_WAIT') {
                const compPhoto = await produceCompliantPassportPhoto(uploadedFile.path, { service: 'TNEGA_WIDOW', portal: 'TNEGA', skipFaceExtraction: true }).catch(() => uploadedFile.path);
                sess.citizenProfile.profilePhoto = compPhoto;
                sess.citizenProfile.headPhotoPath = compPhoto;
                sess.citizenProfile.documents.profilePhoto = compPhoto;
                sess.tempUploads.profilePhoto = compPhoto;
            } else {
                const compFile = await produceCompliantDocument(uploadedFile.path, { service: 'TNEGA_WIDOW', portal: 'TNEGA' }).catch(() => uploadedFile.path);
                if (sess.intakeState === 'WIDOW_DEATH_CERT_WAIT') {
                    sess.citizenProfile.deathCertificate = compFile;
                    sess.citizenProfile.documents.deathCertificate = compFile;
                    sess.tempUploads.deathCertificate = compFile;
                    try {
                        const ext = await inspectAndExtractDocument(uploadedFile.path, { isTnega: true }).catch(() => null);
                        extractWidowDeathAndAadhaarFields(sess.citizenProfile, ext, 'deathCertificate');
                    } catch (_) {}
                } else if (sess.intakeState === 'WIDOW_MARRIAGE_PROOF_WAIT') {
                    sess.citizenProfile.marriageProof = compFile;
                    sess.citizenProfile.documents.marriageProof = compFile;
                    sess.tempUploads.marriageProof = compFile;
                }
            }
            persistSessions();
            const flowStep = advanceFlow(sess, `✅ ஆவணம் வெற்றிகரமாகப் பெறப்பட்டு சேமிக்கப்பட்டது! 🛡️`);
            sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }
    }

    if (sess.intakeState === 'WIDOW_SPOUSE_NAME_WAIT' && text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
        const pair = ensureBilingualPair(text.trim(), text.trim());
        sess.citizenProfile.spouseNameEng = pair.eng || text.trim();
        sess.citizenProfile.spouseNameTam = pair.tam || text.trim();
        persistSessions();
        const flowStep = advanceFlow(sess, `✅ கணவரின் பெயர் **${sess.citizenProfile.spouseNameTam}** எனப் பதிவானது!`);
        sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    if ((sess.intakeState === 'WIDOW_DEATH_DATE_WAIT' || (text && text.startsWith('WD_DOD:'))) && text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
        sess.citizenProfile.dateOfDeath = text.replace('WD_DOD:', '').trim();
        persistSessions();
        const flowStep = advanceFlow(sess, `✅ கணவர் இறந்த தேதி **${sess.citizenProfile.dateOfDeath}** எனப் பதிவானது!`);
        sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    if ((sess.intakeState === 'WIDOW_DEATH_CERT_NO_WAIT' || (text && text.startsWith('WD_DCNO:'))) && text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
        sess.citizenProfile.deathCertificateNo = text.replace('WD_DCNO:', '').trim();
        persistSessions();
        const flowStep = advanceFlow(sess, `✅ இறப்புச் சான்றிதழ் எண் **${sess.citizenProfile.deathCertificateNo}** எனப் பதிவானது!`);
        sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    if ((sess.intakeState === 'WIDOW_MARRIAGE_DATE_WAIT' || text === 'WD_MAR_SKIP' || (text && text.startsWith('WD_MAR:'))) && text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
        if (text === 'WD_MAR_SKIP' || /தவிர்|skip|இல்லை|தெரியாது/i.test(text)) {
            sess.citizenProfile.dateOfMarriageSkipped = true;
            sess.citizenProfile.dateOfMarriage = '';
        } else {
            sess.citizenProfile.dateOfMarriage = text.replace('WD_MAR:', '').trim();
        }
        persistSessions();
        const banner = sess.citizenProfile.dateOfMarriage
            ? `✅ திருமணத் தேதி **${sess.citizenProfile.dateOfMarriage}** எனப் பதிவானது!`
            : `✅ திருமணத் தேதி தவிர்க்கப்பட்டது!`;
        const flowStep = advanceFlow(sess, banner);
        sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    return false;
}

module.exports = { handleIntake };
