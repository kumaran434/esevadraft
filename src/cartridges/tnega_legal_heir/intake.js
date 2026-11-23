const storageService = require('../../services/storage_service');
const { inspectAndExtractDocument } = require('../../../ai_document_extractor');
const { ensureBilingualPair } = require('../../utils/bilingual_helper');
const { produceCompliantDocument } = require('../../../photo_studio');
const { advanceFlow } = require('./flow');
const { extractDeceasedDeathCertFields } = require('./extractor');
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
        resetIntakeState: 'LEGAL_HEIR_INTAKE',
        advanceFlowFn: advanceFlow
    })) return true;

    if (sess.intakeState === 'LEGAL_HEIR_AADHAAR_WAIT' || sess.intakeState === 'LEGAL_HEIR_AADHAAR_BACK_WAIT') {
        const handled = await handleTnegaAadhaarUploadHelper({
            ctx, req, res,
            backWaitState: 'LEGAL_HEIR_AADHAAR_BACK_WAIT',
            advanceFlowFn: advanceFlow
        });
        if (handled !== null) return handled;
    }

    if (sess.intakeState === 'LEGAL_HEIR_SMARTCARD_WAIT' || sess.intakeState === 'LEGAL_HEIR_SMARTCARD_BACK_WAIT') {
        const handled = await handleTnegaSmartCardUploadHelper({
            ctx, req, res,
            backWaitState: 'LEGAL_HEIR_SMARTCARD_BACK_WAIT',
            advanceFlowFn: advanceFlow
        });
        if (handled !== null) return handled;
    }

    if (['LEGAL_HEIR_DEATH_CERT_WAIT', 'LEGAL_HEIR_DECEASED_ADDR_WAIT', 'LEGAL_HEIR_CHILD_PROOF_WAIT', 'LEGAL_HEIR_BIRTH_TC_WAIT'].includes(sess.intakeState)) {
        if (text === 'TRIGGER_FILE_UPLOAD') {
            sess.chatHistory.push({
                sender: 'bot',
                text: `📤 தயவுசெய்து ஆவணத்தை கீழே உள்ள கோப்பு பொத்தானைப் பயன்படுத்திப் பதிவேற்றவும் (<200KB அளவிற்கு தானாகச் சுருக்கப்படும் ✨):`,
                actionRequired: 'upload',
                uploadPrompt: 'ஆவணம் பதிவேற்றவும்'
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }
        if (uploadedFile) {
            const compFile = await produceCompliantDocument(uploadedFile.path).catch(() => uploadedFile.path);
            if (!sess.citizenProfile.documents) sess.citizenProfile.documents = {};
            if (!sess.tempUploads) sess.tempUploads = {};
            if (sess.intakeState === 'LEGAL_HEIR_DEATH_CERT_WAIT') {
                sess.citizenProfile.deathCertificate = compFile;
                sess.citizenProfile.documents.deathCertificate = compFile;
                sess.tempUploads.deathCertificate = compFile;
                try {
                    const ext = await inspectAndExtractDocument(uploadedFile.path, { isTnega: true }).catch(() => null);
                    extractDeceasedDeathCertFields(sess.citizenProfile, ext);
                } catch (_) {}
            } else if (sess.intakeState === 'LEGAL_HEIR_DECEASED_ADDR_WAIT') {
                sess.citizenProfile.deceasedAddressProof = compFile;
                sess.citizenProfile.documents.deceasedAddressProof = compFile;
                sess.tempUploads.deceasedAddressProof = compFile;
            } else if (sess.intakeState === 'LEGAL_HEIR_CHILD_PROOF_WAIT' || sess.intakeState === 'LEGAL_HEIR_BIRTH_TC_WAIT') {
                sess.citizenProfile.birthCertificate = compFile;
                sess.citizenProfile.documents.birthCertificate = compFile;
                sess.tempUploads.birthCertificate = compFile;
            }
            persistSessions();
            const flowStep = advanceFlow(sess, `✅ ஆவணம் வெற்றிகரமாகப் பெறப்பட்டு சேமிக்கப்பட்டது! 🛡️`);
            sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }
    }

    if (sess.intakeState === 'LEGAL_HEIR_DECEASED_NAME_WAIT' && text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
        const pair = ensureBilingualPair(text.trim(), text.trim());
        sess.citizenProfile.deceasedNameEng = pair.eng || text.trim();
        sess.citizenProfile.deceasedNameTam = pair.tam || text.trim();
        persistSessions();
        const flowStep = advanceFlow(sess, `✅ இறந்தவர் பெயர் **${sess.citizenProfile.deceasedNameTam}** எனப் பதிவானது!`);
        sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    if ((sess.intakeState === 'LEGAL_HEIR_DEATH_DATE_WAIT' || (text && text.startsWith('LH_DOD:'))) && text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
        const raw = text.startsWith('LH_DOD:') ? text.replace('LH_DOD:', '').trim() : text.trim();
        if (raw.includes('|')) {
            const [d, pl] = raw.split('|');
            sess.citizenProfile.dateOfDeath = d.trim();
            sess.citizenProfile.placeOfDeath = pl.trim();
        } else {
            sess.citizenProfile.dateOfDeath = raw;
            if (!sess.citizenProfile.placeOfDeath) sess.citizenProfile.placeOfDeath = sess.citizenProfile.taluk || 'Arakkonam';
        }
        persistSessions();
        const flowStep = advanceFlow(sess, `✅ இறந்த தேதி **${sess.citizenProfile.dateOfDeath}** (${sess.citizenProfile.placeOfDeath}) எனப் பதிவானது!`);
        sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    if ((sess.intakeState === 'LEGAL_HEIR_DEATH_CERT_NO_WAIT' || (text && text.startsWith('LH_DCNO:'))) && text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
        sess.citizenProfile.deathCertificateNo = text.replace('LH_DCNO:', '').trim();
        persistSessions();
        const flowStep = advanceFlow(sess, `✅ இறப்புச் சான்றிதழ் எண் **${sess.citizenProfile.deathCertificateNo}** எனப் பதிவானது!`);
        sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    if ((sess.intakeState === 'LEGAL_HEIR_DECEASED_PARENTS_WAIT' || (text && text.startsWith('LH_PARENTS:'))) && text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
        const raw = text.startsWith('LH_PARENTS:') ? text.replace('LH_PARENTS:', '').trim() : text.trim();
        if (raw.includes('|')) {
            const parts = raw.split('|');
            sess.citizenProfile.deceasedFatherNameEng = parts[0] || 'Ramasamy';
            sess.citizenProfile.deceasedFatherNameTam = parts[1] || parts[0] || 'ராமசாமி';
            sess.citizenProfile.deceasedMotherNameEng = parts[2] || 'Lakshmi';
            sess.citizenProfile.deceasedMotherNameTam = parts[3] || parts[2] || 'லட்சுமி';
        } else {
            sess.citizenProfile.deceasedFatherNameEng = raw;
            sess.citizenProfile.deceasedFatherNameTam = raw;
            sess.citizenProfile.deceasedMotherNameEng = 'Lakshmi';
            sess.citizenProfile.deceasedMotherNameTam = 'லட்சுமி';
        }
        persistSessions();
        const flowStep = advanceFlow(sess, `✅ இறந்தவரின் பெற்றோர் பெயர்கள் பதிவானது!`);
        sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    return false;
}

module.exports = { handleIntake };
