const storageService = require('../../services/storage_service');
const { ensureBilingualPair } = require('../../utils/bilingual_helper');
const { saveCitizenProfile } = require('../../../database');
const { advanceFlow } = require('./flow');
const { handleTnegaAadhaarUploadHelper, handleCanActionsForCartridge } = require('../_tnega_upload_utils');

const persistSessions = (...a) => storageService.persistSessions(...a);

async function handleIntake(ctx, req, res) {
    const { text, uploadedFile, sess } = ctx;
    if (!sess) return false;

    if (text === 'CAN_REGISTER_PROMPT' || text === 'START_CAN_REGISTER' || ['CAN_REGISTER_INTAKE', 'CAN_AADHAAR_BACK_WAIT', 'CAN_MOTHER_NAME_WAIT', 'CAN_COMMUNITY_WAIT'].includes(sess.intakeState)) {
        const activeMobile = ctx.targetMobile || sess.mobileNumber || sess.citizenProfile?.mobileNumber || storageService.getActiveMobile();

        if (!sess.targetService) {
            if (sess.subService && sess.subService !== 'CAN_REGISTER' && sess.subService !== 'CAN_SEARCH') {
                sess.targetService = sess.subService;
            } else if (sess.intakeState && sess.intakeState.includes('COMMUNITY')) {
                sess.targetService = 'COMMUNITY';
            } else if (sess.intakeState && sess.intakeState.includes('RESIDENCE')) {
                sess.targetService = 'RESIDENCE';
            } else if (sess.intakeState && sess.intakeState.includes('INCOME')) {
                sess.targetService = 'INCOME';
            }
        }
        if (sess.citizenProfile) {
            sess.citizenProfile.targetService = sess.targetService || sess.citizenProfile.targetService;
        }

        if (text === 'START_CAN_REGISTER') {
            sess.intakeState = 'READY_TO_APPLY_CAN';
            sess.subService = 'CAN_REGISTER';
            if (sess.citizenProfile) {
                sess.citizenProfile.subService = 'CAN_REGISTER';
                sess.citizenProfile.targetService = sess.targetService || sess.citizenProfile.targetService;
            }
            persistSessions();
            const p = sess.citizenProfile || {};
            const mob = p.mobileNumber || sess.mobileNumber || '';
            const nameTam = p.fullNameTam || p.headNameTam || '';
            const nameEng = p.fullNameEng || p.headNameEng || '';
            const aadh = p.headAadhaar || p.aadhaar || '';
            const aadhDisp = aadh ? aadh.replace(/(\d{4})/g, '$1 ').trim() : '—';
            const targetNameTam = sess.targetService === 'COMMUNITY' ? 'சாதிச் சான்றிதழ்' : (sess.targetService === 'RESIDENCE' ? 'இருப்பிடச் சான்றிதழ்' : (sess.targetService === 'INCOME' ? 'வருமானச் சான்றிதழ்' : 'CAN பதிவு'));
            sess.chatHistory.push({
                sender: 'bot',
                text: `📋 **விண்ணப்ப விவரங்களை ஒருமுறை சரிபார்க்கவும்:** 🛡️\n\n` +
                      `அரசு TNeGA போர்ட்டலில் ${targetNameTam} ஆட்டோமேஷன் தொடங்குவதற்கு முன், அனைத்து விவரங்களையும் (பெயர், முகவரி, ஆவணங்கள்) ஒருமுறை சரிபார்த்து உறுதிப்படுத்த **'விவரங்களைச் சரிபார்' (Edit / Review)** சாளரம் திறக்கப்பட்டுள்ளது.\n\n` +
                      (sess.targetService ? `💡 **முதன்மை இலக்கு:** போர்ட்டலில் CAN எண் உள்ளதா என முதலில் சரிபார்க்கப்பட்டு, CAN இருப்பின் நேரடியாக **${targetNameTam}** விண்ணப்பப் படிவத்திற்குச் செல்லும்!\n\n` : '') +
                      `• விண்ணப்பதாரர்: ${nameTam || nameEng}\n` +
                      `• கைபேசி: +91 ${mob}\n` +
                      `• ஆதார்: ${aadhDisp}\n\n` +
                      `சாளரத்தில் விவரங்கள் சரியாக உள்ளதா எனப் பார்த்துவிட்டு, அதில் உள்ள **'🚀 ஆட்டோமேஷன் தொடங்கு'** பொத்தானை அழுத்தவும்:`,
                actionRequired: 'open_edit_modal',
                options: [
                    { label: `🚀 ${targetNameTam} ஆட்டோமேஷன் தொடங்கு`, value: "LAUNCH_CAN_AUTOMATION" },
                    { label: "✏️ விவரங்களை மாற்று (Edit Details)", value: "TRIGGER_EDIT_MODAL" }
                ]
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState, actionRequired: 'open_edit_modal' });
            return true;
        }

        if (uploadedFile || sess.intakeState === 'CAN_AADHAAR_BACK_WAIT') {
            const handled = await handleTnegaAadhaarUploadHelper({
                ctx, req, res,
                backWaitState: 'CAN_AADHAAR_BACK_WAIT',
                advanceFlowFn: advanceFlow
            });
            if (handled) return true;
        }

        if (sess.intakeState === 'CAN_MOTHER_NAME_WAIT' && text && !text.startsWith('CAN_') && !text.startsWith('START_') && !text.startsWith('TRIGGER_') && !text.startsWith('LAUNCH_')) {
            const { eng, tam } = ensureBilingualPair(text.trim(), text.trim());
            sess.citizenProfile.motherNameEng = eng;
            sess.citizenProfile.motherNameTam = tam;
        }
        if (sess.intakeState === 'CAN_COMMUNITY_WAIT' && text && text.startsWith('COMMUNITY_')) {
            sess.citizenProfile.community = text.replace('COMMUNITY_', '');
        }
        if (activeMobile) saveCitizenProfile(activeMobile, sess.citizenProfile);
        persistSessions();

        const flowStep = advanceFlow(sess);
        sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    if (await handleCanActionsForCartridge({ ctx, req, res, advanceFlowFn: advanceFlow })) return true;

    return false;
}

module.exports = { handleIntake };
