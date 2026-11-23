const storageService = require('../../services/storage_service');
const { runAutomationTask } = require('./chat_automation_runner');
const { listCartridges, resolveCartridge, getCartridgeById, getCartridgeByAlias } = require('../../cartridges');

const { persistSessions } = storageService;

const EXPLICIT_START_TOKENS = [
    'start', 'தொடங்கு', 'fill', '🚀 தொடங்கு', 'சமர்ப்பிக்கவும்',
    'start_income_apply', 'launch_can_automation', 'start_residence_apply', 'apply_residence_now',
    'start_community_apply', 'apply_community_now', 'start_first_graduate_apply', 'start_obc_apply',
    'start_legal_heir_apply', 'start_widow_apply'
];

async function handleAutomationStarter(ctx, req, res) {
    const { text, sess, targetMobile } = ctx;
    const activeMobile = storageService.getActiveMobile();

    const isExplicitMock = req.body.forceRealGovtOtp === false || req.body.isMockSandbox === true || text.toLowerCase().includes('mock') || text.includes('சோதனை');
    const isExplicitLiveText = text.toLowerCase().includes('real_live_otp') || text.toLowerCase().includes('real') || text.includes('நேரலை') || text.includes('உண்மையான') || text.toLowerCase().includes('unmai') || text.toLowerCase().includes('unmya');

    let isStartCommand = false;
    let isRealGovtOtpRequested = false;
    const isStartToken = EXPLICIT_START_TOKENS.some(tok => text.toLowerCase() === tok || (tok.length > 5 && text.includes(tok)));

    if (isExplicitMock) {
        sess.enableRealGovtOtp = false;
        if (isStartToken || text.includes('mock') || text.includes('சோதனை')) isStartCommand = true;
        isRealGovtOtpRequested = false;
    } else if (isExplicitLiveText) {
        sess.enableRealGovtOtp = true;
        isStartCommand = true;
        isRealGovtOtpRequested = true;
    } else if (isStartToken) {
        isStartCommand = true;
        if (req.body.forceRealGovtOtp === true || req.body.isMockSandbox === false) sess.enableRealGovtOtp = true;
        const isRegressionEnv = process.env.NODE_ENV === 'test' || process.env.REGRESSION_TEST === 'true' || req.headers['x-operator-uid'] === 'test_suite_operator_uid';
        isRealGovtOtpRequested = isRegressionEnv ? Boolean(sess.enableRealGovtOtp) : (sess.enableRealGovtOtp !== false);
    }

    if (!isStartCommand) return false;

    const isMockTest = !isRealGovtOtpRequested;
    const pProfile = sess.citizenProfile || {};
    const hasCan = Boolean(sess.canNumber || pProfile.canNumber || pProfile.can);

    // 1. Match explicit START_*_APPLY / LAUNCH_CAN_AUTOMATION trigger owned by a specific Cartridge
    let targetCartridge = null;
    for (const c of listCartridges()) {
        const auto = c.automation;
        if (auto && Array.isArray(auto.chatStartTriggers) && auto.chatStartTriggers.includes(text)) {
            targetCartridge = c;
            break;
        }
    }

    // 2. Otherwise resolve from active session Cartridge binding (with NEW_CARD fallback)
    if (!targetCartridge) {
        targetCartridge = resolveCartridge(sess);
        if (targetCartridge?.id === 'TNEGA_CAN_REGISTER' && hasCan && (sess.targetService || pProfile.targetService)) {
            targetCartridge = getCartridgeByAlias(sess.targetService || pProfile.targetService) || targetCartridge;
        }
        if (!targetCartridge && !sess.subService) {
            if (pProfile.currentCourse || pProfile.institutionName) targetCartridge = getCartridgeById('TNEGA_FIRST_GRADUATE');
            else if (pProfile.caste || pProfile.community) targetCartridge = getCartridgeById('TNEGA_COMMUNITY');
            else if (sess.subServiceData?.doorNo || pProfile.subServiceData?.doorNo) targetCartridge = getCartridgeById('TNPDS_CHANGE_ADDRESS');
            else if (sess.subServiceData?.memberName || sess.subServiceData?.isChild !== undefined || pProfile.subServiceData?.memberName) targetCartridge = getCartridgeById('TNPDS_ADD_MEMBER');
        }
        if (!targetCartridge) {
            targetCartridge = getCartridgeById('TNPDS_NEW_CARD');
        }
    }

    if (targetCartridge && targetCartridge.automation && typeof targetCartridge.automation.startFromChat === 'function') {
        return targetCartridge.automation.startFromChat({
            sess,
            text,
            req,
            res,
            targetMobile,
            activeMobile,
            isMockTest,
            runAutomationTask,
            persistSessions
        });
    }

    return false;
}

module.exports = { handleAutomationStarter };
