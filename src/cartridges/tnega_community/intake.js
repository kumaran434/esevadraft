const fs = require('fs');
const storageService = require('../../services/storage_service');
const { inspectAndExtractDocument } = require('../../../ai_document_extractor');
const { validateUploadedDocument } = require('../../services/document_validator');
const { ensureBilingualPair } = require('../../utils/bilingual_helper');
const { produceCompliantDocument } = require('../../../photo_studio');
const { advanceFlow } = require('./flow');
const { extractCommunityProofFields } = require('./extractor');
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
        resetIntakeState: 'COMMUNITY_INTAKE',
        advanceFlowFn: advanceFlow
    })) return true;

    if (sess.intakeState === 'COMMUNITY_AADHAAR_WAIT' || sess.intakeState === 'COMMUNITY_AADHAAR_BACK_WAIT' || sess.intakeState === 'COMMUNITY_INTAKE') {
        if (uploadedFile || sess.intakeState === 'COMMUNITY_AADHAAR_BACK_WAIT') {
            const handled = await handleTnegaAadhaarUploadHelper({
                ctx, req, res,
                backWaitState: 'COMMUNITY_AADHAAR_BACK_WAIT',
                advanceFlowFn: advanceFlow
            });
            if (handled) return true;
        }
        if (text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
            const flowStep = advanceFlow(sess);
            sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }
    }

    if (sess.intakeState === 'COMMUNITY_SMARTCARD_WAIT' || sess.intakeState === 'COMMUNITY_SMARTCARD_BACK_WAIT') {
        const handled = await handleTnegaSmartCardUploadHelper({
            ctx, req, res,
            backWaitState: 'COMMUNITY_SMARTCARD_BACK_WAIT',
            advanceFlowFn: advanceFlow
        });
        if (handled !== null) return handled;
    }

    if (await handleTnegaPassportPhotoUpload({
        ctx, req, res,
        photoWaitState: 'COMMUNITY_PHOTO_WAIT',
        advanceFlowFn: advanceFlow,
        bannerText: `✨ **ஏஐ போட்டோ ஸ்டுடியோ:** விண்ணப்பதாரர் பாஸ்போர்ட் புகைப்படம் அரசு விதிகளுக்கு ஏற்ப (<50KB) தயார் செய்யப்பட்டு சேமிக்கப்பட்டது! 📸`
    })) return true;

    if (sess.intakeState === 'COMMUNITY_PROOF_WAIT') {
        if (uploadedFile) {
            let extracted = null;
            try { extracted = await inspectAndExtractDocument(uploadedFile.path, { isTnega: true }); } catch (_) {}

            const validation = validateUploadedDocument('communityProof', extracted);
            if (!validation.valid) {
                try { if (fs.existsSync(uploadedFile.path)) fs.unlinkSync(uploadedFile.path); } catch (_) {}
                delete sess.citizenProfile.communityProof;
                delete sess.citizenProfile.communityCertificatePath;
                delete sess.citizenProfile.familyCommunityProofPath;
                if (sess.tempUploads) delete sess.tempUploads.communityProof;
                if (sess.citizenProfile.documents) delete sess.citizenProfile.documents.communityProof;
                persistSessions();

                sess.chatHistory.push({
                    sender: 'bot',
                    text: validation.errorTamil,
                    options: [
                        { label: "📷 சாதிச் சான்றிதழ் / பள்ளி TC பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                        { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
                    ]
                });
                res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
                return true;
            }

            const compliantProof = await produceCompliantDocument(uploadedFile.path);
            sess.citizenProfile.communityProof = compliantProof;
            sess.citizenProfile.communityCertificatePath = compliantProof;
            sess.citizenProfile.familyCommunityProofPath = compliantProof;
            if (!sess.tempUploads) sess.tempUploads = {};
            sess.tempUploads.communityProof = compliantProof;
            if (!sess.citizenProfile.documents) sess.citizenProfile.documents = {};
            sess.citizenProfile.documents.communityProof = compliantProof;
            delete sess.citizenProfile.communityProofSkipped;

            let extraInfo = extractCommunityProofFields(sess.citizenProfile, extracted);
            if (!extraInfo && !sess.citizenProfile.caste) {
                extraInfo = `\n\n⚠️ **குறிப்பு:** பதிவேற்றப்பட்ட ஆவணத்தில் சாதி விவரங்கள் இல்லை. எனவே அடுத்த படியில் பெற்றோர் மற்றும் விண்ணப்பதாரரின் சாதி விவரங்களை உள்ளிடவும்.`;
            }

            persistSessions();
            const flowStep = advanceFlow(sess, `✅ **குடும்ப சாதிச் சான்றிதழ் / பள்ளி TC வெற்றிகரமாகப் பெறப்பட்டது!** 🛡️${extraInfo}`);
            sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }

        if (text === 'SKIP_COMMUNITY_PROOF' || text.includes('ஏற்கெனவே உள்ளது') || text.includes('பிறகு பதிவேற்றுக') || text === 'CONTINUE_WITHOUT_COMM_PROOF') {
            sess.chatHistory.push({
                sender: 'bot',
                text: `🛑 **கட்டாய ஆவணம் தேவை (Mandatory Document Gate):**\n\n` +
                      `அரசு விதிகளின்படி சாதிச் சான்றிதழ் (REV-101) விண்ணப்பிக்க **தந்தை / தாய் / உடன்பிறந்தோரின் சாதிச் சான்றிதழ்** அல்லது விண்ணப்பதாரரின் **பள்ளி மாற்றுச் சான்றிதழ் (School TC)** போர்ட்டலில் கட்டாயம் பதிவேற்றப்பட வேண்டும்.\n\n` +
                      `⚠️ *இந்த ஆவணம் இல்லாமல் விண்ணப்பத்தைத் தொடர முடியாது.*\n\n` +
                      `தயவுசெய்து சான்றிதழைப் பதிவேற்றவும்:`,
                options: [
                    { label: "📷 சாதிச் சான்றிதழ் / பள்ளி TC பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                    { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
                ]
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }
    }

    if (sess.intakeState === 'COMMUNITY_MOTHER_NAME_WAIT' && text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
        const { eng, tam } = ensureBilingualPair(text.trim(), text.trim());
        sess.citizenProfile.motherNameEng = eng;
        sess.citizenProfile.motherNameTam = tam;
        persistSessions();

        const p = sess.citizenProfile;
        const flowStep = advanceFlow(sess, `✅ தாயின் பெயர் **${p.motherNameTam || p.motherNameEng}** எனப் பதிவானது!`);
        sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    if ((sess.intakeState === 'COMMUNITY_RELIGION_WAIT' || (text && (text.startsWith('RELIGION_') || text.includes('இந்து') || text.includes('இஸ்லாம்') || text.includes('கிறிஸ்தவ')))) && text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
        let rel = 'Hindu';
        if (text.includes('HINDU') || text.includes('இந்து')) rel = 'Hindu';
        else if (text.includes('MUSLIM') || text.includes('இஸ்லாம்')) rel = 'Muslim';
        else if (text.includes('CHRISTIAN') || text.includes('கிறிஸ்தவ')) rel = 'Christian';
        else if (text.includes('SIKH') || text.includes('சீக்கிய')) rel = 'Sikh';
        else if (text.includes('JAIN') || text.includes('சமண')) rel = 'Jain';
        else rel = text.replace('RELIGION_', '');

        sess.citizenProfile.religion = rel;
        persistSessions();
        const flowStep = advanceFlow(sess, `✅ மதம் **${rel}** எனப் பதிவானது!`);
        sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    if ((sess.intakeState === 'COMMUNITY_COMM_WAIT' || (text && text.startsWith('COMMUNITY_'))) && text) {
        let comm = 'MBC';
        if (text.includes('MBC') || text === 'COMMUNITY_MBC') comm = 'MBC';
        else if (text.includes('BCM') || text === 'COMMUNITY_BCM') comm = 'BCM';
        else if (text.includes('BC') || text === 'COMMUNITY_BC') comm = 'BC';
        else if (text.includes('SC') || text === 'COMMUNITY_SC') comm = 'SC';
        else if (text.includes('ST') || text === 'COMMUNITY_ST') comm = 'ST';
        else if (text.includes('OC') || text === 'COMMUNITY_OC') comm = 'OC';

        sess.citizenProfile.community = comm;
        persistSessions();
        const flowStep = advanceFlow(sess, `✅ வகுப்பு / பிரிவு **${comm}** எனப் பதிவானது!`);
        sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    if (sess.intakeState === 'COMMUNITY_CASTE_WAIT' && text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
        sess.citizenProfile.caste = text.trim();
        persistSessions();
        const flowStep = advanceFlow(sess, `✅ சாதி உட்பிரிவு **${text.trim()}** எனப் பதிவானது!`);
        sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    if (sess.intakeState === 'COMMUNITY_PARENTS_CASTE_GATE' || text === 'PARENTS_SAME_CASTE' || text === 'PARENTS_DIFF_CASTE' || (text && (text.includes('இருவருமே') || text.includes('வெவ்வேறு சாதி')))) {
        if (text === 'PARENTS_SAME_CASTE' || text.includes('இருவருமே') || text.includes('ஆம்')) {
            const c = sess.citizenProfile.caste || sess.citizenProfile.subCaste || 'வன்னியகுல சத்ரியர்';
            sess.citizenProfile.fatherCaste = c;
            sess.citizenProfile.motherCaste = c;
            sess.citizenProfile.requestedCaste = c;
            sess.citizenProfile.fatherCommunity = sess.citizenProfile.community || 'MBC';
            sess.citizenProfile.motherCommunity = sess.citizenProfile.community || 'MBC';
            sess.citizenProfile.requestedCommunity = sess.citizenProfile.community || 'MBC';
            sess.citizenProfile.parentCasteConfirmed = true;
            persistSessions();

            const flowStep = advanceFlow(sess, `✅ தந்தை மற்றும் தாய் இருவரின் சாதியும் **${c}** எனப் பதிவானது!`);
            sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        } else if (text === 'PARENTS_DIFF_CASTE' || text.includes('வெவ்வேறு சாதி') || text.includes('இல்லை')) {
            sess.intakeState = 'COMMUNITY_FATHER_CASTE_WAIT';
            persistSessions();
            sess.chatHistory.push({
                sender: 'bot',
                text: `👨 **தந்தையின் சாதி உட்பிரிவு (Father's Caste) என்ன?**\n\nதட்டச்சு செய்யவும் அல்லது விருப்பத்தைத் தேர்ந்தெடுக்கவும்:`,
                options: [
                    { label: "வன்னியகுல சத்ரியர்", value: "FATHER_CASTE_வன்னியகுல சத்ரியர்" },
                    { label: "அகமுடையார்", value: "FATHER_CASTE_அகமுடையார்" },
                    { label: "கொங்கு வேளாளர்", value: "FATHER_CASTE_கொங்கு வேளாளர்" },
                    { label: "நாடார்", value: "FATHER_CASTE_நாடார்" }
                ]
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }
    }

    if (sess.intakeState === 'COMMUNITY_FATHER_CASTE_WAIT' && text && !text.startsWith('TRIGGER_')) {
        const cleaned = text.replace('FATHER_CASTE_', '').trim();
        sess.citizenProfile.fatherCaste = cleaned;
        sess.intakeState = 'COMMUNITY_MOTHER_CASTE_WAIT';
        persistSessions();
        sess.chatHistory.push({
            sender: 'bot',
            text: `✅ தந்தையின் சாதி: **${cleaned}** எனப் பதிவானது!\n\n👩 **தாயின் சாதி உட்பிரிவு (Mother's Caste) என்ன?**`,
            options: [
                { label: "வன்னியகுல சத்ரியர்", value: "MOTHER_CASTE_வன்னியகுல சத்ரியர்" },
                { label: "அகமுடையார்", value: "MOTHER_CASTE_அகமுடையார்" },
                { label: "கொங்கு வேளாளர்", value: "MOTHER_CASTE_கொங்கு வேளாளர்" },
                { label: "நாடார்", value: "MOTHER_CASTE_நாடார்" }
            ]
        });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    if (sess.intakeState === 'COMMUNITY_MOTHER_CASTE_WAIT' && text && !text.startsWith('TRIGGER_')) {
        const cleaned = text.replace('MOTHER_CASTE_', '').trim();
        sess.citizenProfile.motherCaste = cleaned;
        sess.citizenProfile.requestedCaste = sess.citizenProfile.caste || sess.citizenProfile.fatherCaste || cleaned;
        sess.citizenProfile.parentCasteConfirmed = true;
        persistSessions();
        const flowStep = advanceFlow(sess, `✅ தாயின் சாதி: **${cleaned}** எனப் பதிவானது!`);
        sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    return false;
}

module.exports = { handleIntake };
