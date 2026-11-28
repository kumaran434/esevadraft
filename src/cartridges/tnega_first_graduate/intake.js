const fs = require('fs');
const storageService = require('../../services/storage_service');
const { inspectAndExtractDocument } = require('../../../ai_document_extractor');
const { validateUploadedDocument } = require('../../services/document_validator');
const { ensureBilingualPair } = require('../../utils/bilingual_helper');
const { produceCompliantDocument } = require('../../../photo_studio');
const { advanceFlow } = require('./flow');
const { extractStudentTcFields } = require('./extractor');
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

    if (await handleCanActionsForCartridge({ ctx, req, res, advanceFlowFn: advanceFlow, isFirstGraduate: true })) return true;

    if (sess.intakeState === 'FIRST_GRADUATE_AADHAAR_WAIT' || sess.intakeState === 'FIRST_GRADUATE_AADHAAR_BACK_WAIT' || sess.intakeState === 'FIRST_GRADUATE_INTAKE') {
        if (uploadedFile || sess.intakeState === 'FIRST_GRADUATE_AADHAAR_BACK_WAIT') {
            const handled = await handleTnegaAadhaarUploadHelper({
                ctx, req, res,
                backWaitState: 'FIRST_GRADUATE_AADHAAR_BACK_WAIT',
                advanceFlowFn: advanceFlow
            });
            if (handled) return true;
        }
        if (text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
            persistSessions();
            const flowStep = advanceFlow(sess);
            sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }
    }

    if (sess.intakeState === 'FIRST_GRADUATE_SMARTCARD_WAIT' || sess.intakeState === 'FIRST_GRADUATE_SMARTCARD_BACK_WAIT') {
        const handled = await handleTnegaSmartCardUploadHelper({
            ctx, req, res,
            backWaitState: 'FIRST_GRADUATE_SMARTCARD_BACK_WAIT',
            advanceFlowFn: advanceFlow
        });
        if (handled !== null) return handled;
    }

    if (await handleTnegaPassportPhotoUpload({
        ctx, req, res,
        photoWaitState: 'FIRST_GRADUATE_PHOTO_WAIT',
        advanceFlowFn: advanceFlow,
        bannerText: `✨ **ஏஐ போட்டோ ஸ்டுடியோ:** மாணவர் பாஸ்போர்ட் புகைப்படம் அரசு விதிகளுக்கு ஏற்ப (<50KB) தயார் செய்யப்பட்டு சேமிக்கப்பட்டது! 📸`
    })) return true;

    if (sess.intakeState === 'FIRST_GRADUATE_APPLICANT_PROOF_WAIT' && uploadedFile) {
        let extracted = null;
        try { extracted = await inspectAndExtractDocument(uploadedFile.path, { isTnega: true }); } catch (_) {}

        const validation = validateUploadedDocument('applicantEducationProof', extracted);
        if (!validation.valid) {
            try { if (fs.existsSync(uploadedFile.path)) fs.unlinkSync(uploadedFile.path); } catch (_) {}
            delete sess.citizenProfile.applicantEducationProof;
            delete sess.citizenProfile.studentTc;
            if (sess.tempUploads) delete sess.tempUploads.applicantEducationProof;
            if (sess.citizenProfile.documents) delete sess.citizenProfile.documents.applicantEducationProof;
            persistSessions();
            sess.chatHistory.push({
                sender: 'bot',
                text: validation.errorTamil,
                options: [
                    { label: "📷 மாணவர் 12th TC பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                    { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
                ]
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }

        const compliantProof = await produceCompliantDocument(uploadedFile.path, { service: 'TNEGA_FIRST_GRADUATE', portal: 'TNEGA' });
        sess.citizenProfile.applicantEducationProof = compliantProof;
        sess.citizenProfile.studentTc = compliantProof;
        if (!sess.tempUploads) sess.tempUploads = {};
        sess.tempUploads.applicantEducationProof = compliantProof;
        if (!sess.citizenProfile.documents) sess.citizenProfile.documents = {};
        sess.citizenProfile.documents.applicantEducationProof = compliantProof;

        const extraInfo = extractStudentTcFields(sess.citizenProfile, extracted);
        persistSessions();
        const flowStep = advanceFlow(sess, `✅ **மாணவரின் 12-ஆம் வகுப்பு மாற்றுச் சான்றிதழ் (TC) வெற்றிகரமாகப் பெறப்பட்டது!** 🛡️${extraInfo}`);
        sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    if ((sess.intakeState === 'FIRST_GRADUATE_FATHER_PROOF_WAIT' || sess.intakeState === 'FIRST_GRADUATE_PARENTS_PROOF_WAIT') && uploadedFile) {
        let extracted = null;
        try { extracted = await inspectAndExtractDocument(uploadedFile.path, { isTnega: true }); } catch (_) {}
        const validation = validateUploadedDocument('fatherEducationProof', extracted);
        if (!validation.valid) {
            try { if (fs.existsSync(uploadedFile.path)) fs.unlinkSync(uploadedFile.path); } catch (_) {}
            delete sess.citizenProfile.fatherEducationProof;
            if (sess.tempUploads) delete sess.tempUploads.fatherEducationProof;
            if (sess.citizenProfile.documents) delete sess.citizenProfile.documents.fatherEducationProof;
            persistSessions();
            sess.chatHistory.push({
                sender: 'bot',
                text: validation.errorTamil,
                options: [
                    { label: "📷 தந்தையின் TC / ஆவணம் பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                    { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
                ]
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }
        const compliantProof = await produceCompliantDocument(uploadedFile.path, { service: 'TNEGA_FIRST_GRADUATE', portal: 'TNEGA' });
        sess.citizenProfile.fatherEducationProof = compliantProof;
        sess.citizenProfile.fatherTc = compliantProof;
        if (!sess.tempUploads) sess.tempUploads = {};
        sess.tempUploads.fatherEducationProof = compliantProof;
        if (!sess.citizenProfile.documents) sess.citizenProfile.documents = {};
        sess.citizenProfile.documents.fatherEducationProof = compliantProof;
        if (sess.intakeState === 'FIRST_GRADUATE_PARENTS_PROOF_WAIT') {
            sess.citizenProfile.motherEducationProof = compliantProof;
            sess.citizenProfile.documents.motherEducationProof = compliantProof;
        }
        persistSessions();
        const flowStep = advanceFlow(sess, `✅ **தந்தையின் கல்வி ஆவணம் (Father TC) வெற்றிகரமாகப் பெறப்பட்டது!** 🛡️`);
        sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    if (sess.intakeState === 'FIRST_GRADUATE_MOTHER_PROOF_WAIT' && uploadedFile) {
        let extracted = null;
        try { extracted = await inspectAndExtractDocument(uploadedFile.path, { isTnega: true }); } catch (_) {}
        const validation = validateUploadedDocument('motherEducationProof', extracted);
        if (!validation.valid) {
            try { if (fs.existsSync(uploadedFile.path)) fs.unlinkSync(uploadedFile.path); } catch (_) {}
            delete sess.citizenProfile.motherEducationProof;
            if (sess.tempUploads) delete sess.tempUploads.motherEducationProof;
            if (sess.citizenProfile.documents) delete sess.citizenProfile.documents.motherEducationProof;
            persistSessions();
            sess.chatHistory.push({
                sender: 'bot',
                text: validation.errorTamil,
                options: [
                    { label: "📷 தாயாரின் TC / ஆவணம் பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                    { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
                ]
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }
        const compliantProof = await produceCompliantDocument(uploadedFile.path, { service: 'TNEGA_FIRST_GRADUATE', portal: 'TNEGA' });
        sess.citizenProfile.motherEducationProof = compliantProof;
        sess.citizenProfile.motherTc = compliantProof;
        if (!sess.tempUploads) sess.tempUploads = {};
        sess.tempUploads.motherEducationProof = compliantProof;
        if (!sess.citizenProfile.documents) sess.citizenProfile.documents = {};
        sess.citizenProfile.documents.motherEducationProof = compliantProof;
        persistSessions();
        const flowStep = advanceFlow(sess, `✅ **தாயாரின் கல்வி ஆவணம் (Mother TC) வெற்றிகரமாகப் பெறப்பட்டது!** 🛡️`);
        sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    if (sess.intakeState === 'FIRST_GRADUATE_MOTHER_NAME_WAIT' && text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
        const { eng, tam } = ensureBilingualPair(text.trim(), text.trim());
        sess.citizenProfile.motherNameEng = eng;
        sess.citizenProfile.motherNameTam = tam;
        persistSessions();
        const flowStep = advanceFlow(sess, `✅ தாயின் பெயர் **${sess.citizenProfile.motherNameTam || sess.citizenProfile.motherNameEng}** எனப் பதிவானது!`);
        sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    if (sess.intakeState === 'FIRST_GRADUATE_COURSE_WAIT' && text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
        sess.citizenProfile.currentCourse = text.trim();
        sess.citizenProfile.degreeCourse = text.trim();
        persistSessions();
        const flowStep = advanceFlow(sess, `✅ படிப்பு **${text.trim()}** எனப் பதிவானது!`);
        sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    if (sess.intakeState === 'FIRST_GRADUATE_COLLEGE_WAIT' && text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
        sess.citizenProfile.institutionName = text.trim();
        sess.citizenProfile.collegeName = text.trim();
        persistSessions();
        const flowStep = advanceFlow(sess, `✅ கல்லூரி **${text.trim()}** எனப் பதிவானது!`);
        sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    if ((sess.intakeState === 'FIRST_GRADUATE_PARENT_EDU_WAIT' || (text && text.startsWith('PARENT_EDU:'))) && text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
        let fEdu = '10th Standard', mEdu = '8th Standard';
        if (text.startsWith('PARENT_EDU:')) {
            const parts = text.replace('PARENT_EDU:', '').split('|');
            if (parts[0]) fEdu = parts[0].trim();
            if (parts[1]) mEdu = parts[1].trim();
        } else {
            fEdu = text.trim();
            mEdu = text.trim();
        }
        sess.citizenProfile.fatherEducation = fEdu;
        sess.citizenProfile.motherEducation = mEdu;
        persistSessions();
        const flowStep = advanceFlow(sess, `✅ பெற்றோர் கல்வி: **தந்தை (${fEdu}) | தாய் (${mEdu})** எனப் பதிவானது!`);
        sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    if (sess.intakeState === 'FIRST_GRADUATE_YOP_WAIT' && text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
        const yopMatch = text.match(/\b(19|20)\d{2}\b/);
        const cleanYop = yopMatch ? yopMatch[0] : text.trim();
        sess.citizenProfile.yearOfPassing = cleanYop;
        sess.citizenProfile.passingYear = cleanYop;
        persistSessions();
        const flowStep = advanceFlow(sess, `✅ 12-ஆம் வகுப்பு தேர்ச்சி ஆண்டு **${cleanYop}** எனப் பதிவானது!`);
        sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    if (sess.intakeState === 'FIRST_GRADUATE_FAMILY_CHECK_GATE' || text === 'FIRST_GRADUATE_CONFIRMED' || text === 'FIRST_GRADUATE_INELIGIBLE') {
        const lowFg = String(text || '').toLowerCase().trim();
        const isIneligible = text === 'FIRST_GRADUATE_INELIGIBLE' ||
            /^(no|ineligible)$/i.test(lowFg) ||
            (text !== 'FIRST_GRADUATE_CONFIRMED' && (text.includes('ஏற்கனவே') || text.includes('பட்டதாரி உள்ளார்') || text.includes('படித்துள்ளார்') || text.includes('இருக்கிறார்') || lowFg === 'உள்ளது'));
        if (isIneligible) {
            sess.chatHistory.push({
                sender: 'bot',
                text: `⚠️ **அரசு விதிப்படி (TNeGA REV-104 Rule):**\n\nகுடும்பத்தில் ஏற்கனவே ஒருவர் பட்டப்படிப்பு முடித்திருந்தால் முதல் பட்டதாரி கல்விக் கட்டணச் சலுகை பெற இயலாது.\n\nவேறு ஏதேனும் சான்றிதழ் சேவை தேவைப்படுகிறதா?`,
                options: [
                    { label: "📜 சாதிச் சான்றிதழ்", value: "சாதிச் சான்றிதழ்" },
                    { label: "💰 வருமானச் சான்றிதழ்", value: "வருமானச் சான்றிதழ்" },
                    { label: "🏠 இருப்பிடச் சான்றிதழ்", value: "இருப்பிடச் சான்றிதழ்" },
                    { label: "🔄 மீண்டும் சேவைகளைத் தேர்ந்தெடு", value: "reset" }
                ]
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }
        sess.citizenProfile.familyGraduateConfirmed = true;
        persistSessions();
        const flowStep = advanceFlow(sess, `✅ குடும்பத்தில் முதல் பட்டதாரி தகுதி உறுதிப்படுத்தப்பட்டது! 🛡️`);
        sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    return false;
}

module.exports = { handleIntake };
