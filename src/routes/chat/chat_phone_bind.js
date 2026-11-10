const storageService = require('../../services/storage_service');
const { getCitizenDraft, saveCitizenDraft } = require('../../../firestore_db');
const { saveCitizenProfile } = require('../../../database');
const { 
    SERVICE_OPTIONS, 
    RATION_CARD_SERVICE_OPTIONS, 
    MEMBER_COUNT_OPTIONS, 
    RESIDENCE_PROOF_OPTIONS 
} = require('../../core/chat_fsm');

const { sessions, createFreshProfile, persistSessions } = storageService;

async function handlePhoneBind(ctx, req, res) {
    const { text, reqOpUid, sess } = ctx;
    let cleanPhoneDigits = text.replace(/\D/g, '');
    if (cleanPhoneDigits.length === 12 && cleanPhoneDigits.startsWith('91')) {
        cleanPhoneDigits = cleanPhoneDigits.slice(2);
    }
    const is10DigitMobile = cleanPhoneDigits.length === 10 && ['6', '7', '8', '9'].includes(cleanPhoneDigits[0]);
    const activeMob = storageService.getActiveMobile();
    const isWalkinSession = (!activeMob || activeMob.startsWith('walkin_') || !sess.citizenProfile?.mobileNumber || sess.citizenProfile?.mobileNumber.startsWith('walkin_'));
    const canSwitchCustomer = isWalkinSession || sess.intakeState === 'SERVICE_SELECTION' || sess.intakeState === 'RATION_CARD_SERVICES' || sess.intakeState === 'READY_TO_APPLY';

    if (is10DigitMobile && (isWalkinSession || (canSwitchCustomer && cleanPhoneDigits !== activeMob))) {
        const oldKey = activeMob;
        const newMobile = cleanPhoneDigits;
        const isSwitchingCustomer = oldKey && oldKey !== newMobile && !oldKey.startsWith('walkin_');

        if (isSwitchingCustomer) {
            sess.citizenProfile = createFreshProfile(newMobile);
            sess.tempUploads = {};
            sess.subService = null;
            sess.subServiceData = null;
            sess.chatHistory = [];
        } else {
            sess.citizenProfile.mobileNumber = newMobile;
        }

        sessions.set(newMobile, sess);
        if (oldKey && oldKey !== newMobile && sessions.has(oldKey)) {
            sessions.delete(oldKey);
        }
        storageService.setActiveMobile(newMobile);
        ctx.targetMobile = newMobile;
        saveCitizenProfile(newMobile, sess.citizenProfile);

        try {
            const existingDraft = await getCitizenDraft(newMobile);
            if (existingDraft && existingDraft.citizenProfile && (existingDraft.citizenProfile.fullNameTam || existingDraft.citizenProfile.fullNameEng || existingDraft.subService || existingDraft.citizenProfile?.subService)) {
                sess.citizenProfile = { ...createFreshProfile(newMobile), ...existingDraft.citizenProfile };
                sess.tempUploads = existingDraft.documents || {};
                if (existingDraft.subService || existingDraft.citizenProfile?.subService) {
                    sess.subService = existingDraft.subService || existingDraft.citizenProfile?.subService;
                }
                if (existingDraft.subServiceData || existingDraft.citizenProfile?.subServiceData) {
                    sess.subServiceData = existingDraft.subServiceData || existingDraft.citizenProfile?.subServiceData;
                }
                if (existingDraft.intakeState) {
                    sess.intakeState = existingDraft.intakeState;
                }
            } else {
                sess.subService = null;
                sess.subServiceData = null;
                sess.tempUploads = {};
            }
        } catch (e) {
            console.warn('Draft restore error on phone bind:', e.message);
        }

        try {
            await saveCitizenDraft(newMobile, {
                operatorUid: reqOpUid || sess.operatorUid || null,
                operatorName: sess.operatorName || null,
                operatorMobile: sess.operatorMobile || null,
                citizenProfile: sess.citizenProfile,
                documents: sess.tempUploads || {},
                chatHistory: sess.chatHistory,
                intakeState: sess.intakeState,
                status: 'DRAFT_SAVED'
            });
        } catch (e) {
            console.error('Draft save failed on phone bind:', e);
        }

        const currentName = sess.citizenProfile.fullNameTam 
            ? `${sess.citizenProfile.fullNameTam} (${sess.citizenProfile.fullNameEng || ''})` 
            : (sess.citizenProfile.fullNameEng || '');

        let nextMsg = '';
        let nextOpts = null;
        let nextAct = null;
        let nextPrompt = null;

        if (sess.intakeState === 'RATION_CARD_SERVICES') {
            nextMsg = `🏛️ **குடும்ப அட்டை (Ration Card) சேவைகள்**\n\n` +
                      `நீங்கள் குடும்ப அட்டையில் எந்த சேவையைச் செய்ய விரும்புகிறீர்கள்?\n\n` +
                      `கீழே உள்ள விருப்பங்களில் ஒன்றைத் தேர்ந்தெடுக்கவும்:`;
            nextOpts = RATION_CARD_SERVICE_OPTIONS;
        } else if (sess.intakeState === 'SERVICE_SELECTION') {
            nextMsg = `நீங்கள் இன்று எந்த அரசு சேவைக்கு விண்ணப்பிக்க விரும்புகிறீர்கள்?\n\n` +
                      `கீழே உள்ள விருப்பங்களில் ஒன்றைத் தேர்ந்தெடுக்கவும்:`;
            nextOpts = SERVICE_OPTIONS;
        } else if (sess.intakeState === 'MEMBER_COUNT') {
            nextMsg = `உங்கள் குடும்பத்தில் மொத்தம் எத்தனை நபர்களை (குடும்பத் தலைவர் உட்பட) உறுப்பினர்களாகச் சேர்க்க வேண்டும்?\n\n` +
                      `கீழே உள்ள எண்ணிக்கையைத் தேர்வு செய்யவும் அல்லது தட்டச்சு செய்யவும்:`;
            nextOpts = MEMBER_COUNT_OPTIONS;
        } else if (sess.intakeState === 'HEAD_PHOTO') {
            nextMsg = `📸 **படி 1/6: குடும்பத் தலைவரின் பாஸ்போர்ட் புகைப்படம்**\n\n` +
                      `குடும்பத் தலைவரின் பாஸ்போர்ட் அளவிலான புகைப்படத்தைப் பதிவேற்றவும் (அல்லது ஆதார் அட்டை பதிவேற்றவும்):`;
            nextAct = 'upload';
            nextPrompt = 'குடும்பத் தலைவர் புகைப்படம் பதிவேற்றவும்';
        } else if (sess.intakeState === 'HEAD_AADHAAR_FRONT') {
            nextMsg = `🪪 **படி 2/6: குடும்பத் தலைவரின் ஆதார் அட்டை**\n\n` +
                      `குடும்பத் தலைவரின் ஆதார் அட்டையைப் பதிவேற்றவும்:`;
            nextAct = 'upload';
            nextPrompt = 'குடும்பத் தலைவர் ஆதார் பதிவேற்றவும்';
        } else if (sess.intakeState === 'HEAD_DETAILS_VERIFY') {
            nextMsg = `🔍 குடும்பத் தலைவரின் விவரங்களைச் சரிபார்த்து உறுதிப்படுத்தவும்:`;
            nextOpts = [
                { label: "✅ விவரங்கள் அனைத்தும் சரி (All Correct - Continue)", value: "HEAD_DETAILS_CONFIRMED" },
                { label: "✏️ விவரங்களைச் சரிபார் / திருத்து (Review / Edit Details)", value: "TRIGGER_EDIT_MODAL" }
            ];
        } else if (sess.intakeState === 'MOBILE_NUMBER') {
            sess.intakeState = 'RESIDENCE_PROOF_TYPE';
            nextMsg = `🏠 **படி 5/6: குடும்பத்தின் குடியிருப்புச் சான்று (Residence Proof)**\n\n` +
                      `உங்கள் குடும்பத்தின் முகவரிச் சான்றாக கீழே உள்ளவற்றில் எந்த ஆவணத்தைப் பதிவேற்ற விரும்புகிறீர்கள்?`;
            nextOpts = RESIDENCE_PROOF_OPTIONS;
        } else if (sess.subService === 'INCOME' || (sess.intakeState && sess.intakeState.startsWith('INCOME_'))) {
            const { advanceTnegaIncomeFlow } = require('../../core/fsm/tnega_flow_engine');
            const flowStep = advanceTnegaIncomeFlow(sess);
            nextMsg = flowStep.text;
            nextOpts = flowStep.options;
        } else {
            nextMsg = `தொடர்ந்து விவரங்களை உள்ளிடலாம்.`;
        }

        sess.chatHistory.push({
            sender: 'bot',
            text: `📱 **வாடிக்கையாளர் கைபேசி எண் (+91 ${newMobile}) வெற்றிகரமாகப் பதிவு செய்யப்பட்டது!** ✅\n\n` +
                  (currentName ? `• வாடிக்கையாளர்: **${currentName}**\n` : '') +
                  `• வரைவு நிலை: **சேமிக்கப்பட்டது (Draft Saved)**\n\n` +
                  nextMsg,
            options: nextOpts,
            actionRequired: nextAct,
            uploadPrompt: nextPrompt
        });
        persistSessions();

        res.json({
            chatHistory: sess.chatHistory,
            citizenProfile: sess.citizenProfile,
            step: sess.intakeState,
            customerMobile: newMobile,
            activeMobile: newMobile
        });
        return true;
    }
    return false;
}

module.exports = {
    handlePhoneBind
};
