const storageService = require('../services/storage_service');
const { inspectAndExtractDocument } = require('../../ai_document_extractor');

const persistSessions = (...a) => storageService.persistSessions(...a);

async function runTnpdsSubserviceTurn({ ctx, req, res, handleFlowFn, onUploadedFn, afterFlowFn }) {
    const { text, uploadedFile, sess } = ctx;
    let extractedDoc = null;
    if (uploadedFile) {
        try {
            extractedDoc = await inspectAndExtractDocument(uploadedFile.path, {
                skipFaceExtraction: true,
                subService: sess.subService || 'SUBSERVICE'
            });
        } catch (ocrErr) {
            console.warn(`⚠️ [Subservice AI OCR] Extraction error:`, ocrErr.message);
        }
    }

    const handled = await handleFlowFn(text, sess, uploadedFile, extractedDoc);
    if (!handled) return false;

    if (uploadedFile && typeof onUploadedFn === 'function') {
        await onUploadedFn(sess, uploadedFile, extractedDoc);
    }
    if (typeof afterFlowFn === 'function') {
        await afterFlowFn(sess, uploadedFile, extractedDoc);
    }

    sess.citizenProfile = sess.citizenProfile || {};
    sess.citizenProfile.subService = sess.subService;
    sess.citizenProfile.subServiceData = sess.subServiceData;
    sess.citizenProfile.documents = sess.tempUploads || {};

    persistSessions();
    const lastBotMsg = sess.chatHistory[sess.chatHistory.length - 1];
    res.json({
        chatHistory: sess.chatHistory,
        citizenProfile: sess.citizenProfile,
        step: sess.intakeState,
        intakeState: sess.intakeState,
        subService: sess.subService,
        subServiceData: sess.subServiceData,
        documents: sess.tempUploads || {},
        botResponse: lastBotMsg ? lastBotMsg.text : ''
    });
    return true;
}

function ensureValidTnpdsChatMobile({ sess, activeMobile, isMockTest, res }) {
    let finalMobile = (sess.citizenProfile?.mobileNumber || activeMobile || '').replace(/\D/g, '');
    if (finalMobile.length === 12 && finalMobile.startsWith('91')) finalMobile = finalMobile.slice(2);
    let hasValidMobile = finalMobile.length === 10 && ['6', '7', '8', '9'].includes(finalMobile[0]);
    if (!hasValidMobile && isMockTest) {
        finalMobile = '9876543210';
        hasValidMobile = true;
        if (sess.citizenProfile) sess.citizenProfile.mobileNumber = finalMobile;
    }
    if (!hasValidMobile) {
        sess.chatHistory.push({
            sender: 'bot',
            text: `📱 **வாடிக்கையாளர் கைபேசி எண் தேவை (Customer Mobile Required)!**\n\n` +
                  `அரசு TNPDS போர்ட்டலில் விண்ணப்பிக்க மற்றும் நேரலை OTP பெற, வாடிக்கையாளரின் 10-இலக்க மொபைல் எண்ணை உள்ளிடவும்.\n\n` +
                  `*(கீழே உள்ள உள்ளீட்டுப் பெட்டியில் 10-இலக்க மொபைல் எண்ணைத் தட்டச்சு செய்து அனுப்பவும் அல்லது விவரங்கள் திருத்து பொத்தானைப் பயன்படுத்தவும்)*`
        });
        persistSessions();
        res.json({
            chatHistory: sess.chatHistory,
            citizenProfile: sess.citizenProfile,
            step: sess.intakeState
        });
        return false;
    }
    return true;
}

function ensureTnpdsSharedContext(payload = {}, options = {}, sharedContext = null) {
    if (sharedContext && typeof sharedContext.setBrowser === 'function' && typeof sharedContext.requestOtpFromUser === 'function') {
        return sharedContext;
    }
    try {
        const tnpdsAuto = require('../../tnpds_automation');
        if (tnpdsAuto && typeof tnpdsAuto.createScopedSessionContext === 'function') {
            const sessId = options?.sessionId || payload?.mobileNumber || 'default';
            return tnpdsAuto.createScopedSessionContext(sessId);
        }
    } catch (_) {}
    return sharedContext || {};
}

module.exports = { runTnpdsSubserviceTurn, persistSessions, ensureValidTnpdsChatMobile, ensureTnpdsSharedContext };
