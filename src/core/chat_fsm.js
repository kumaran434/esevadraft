/**
 * eSevaDraft Finite State Machine (FSM) Thin Cartridge Switchboard
 * Handles Category Menus & delegates ALL 14 Active Services strictly to isolated Cartridges.
 */

const {
    SERVICE_OPTIONS,
    REVENUE_DEPARTMENT_SERVICE_OPTIONS,
    RATION_CARD_SERVICE_OPTIONS,
    MEMBER_COUNT_OPTIONS,
    RESIDENCE_PROOF_OPTIONS,
    RELATIONSHIP_OPTIONS,
    getRelationshipOptions,
    mapRelationshipToEng,
    getInitialWelcomeMessage
} = require('./fsm/fsm_options_registry');

const { renderSubserviceReadySummary } = require('./fsm/fsm_summary_formatter');
const { handleNonRationServiceSelection } = require('./fsm/fsm_other_services');
const { handleRationSubserviceMenuPrompts } = require('./fsm/fsm_subservice_prompts');
const { handleMinorRationSubservices } = require('./fsm/fsm_minor_subservices');

function rewindChatToCategoryMenu(sess, categoryMarker, userLabel, botMenuPayload) {
    if (!Array.isArray(sess.chatHistory)) sess.chatHistory = [];
    const existingCatIdx = sess.chatHistory.findIndex(
        m => m && m.sender === 'bot' && typeof m.text === 'string' && m.text.includes(categoryMarker) && Array.isArray(m.options)
    );
    if (existingCatIdx >= 0) {
        sess.chatHistory = sess.chatHistory.slice(0, existingCatIdx + 1);
        sess.chatHistory[existingCatIdx] = botMenuPayload;
        return;
    }
    const welcomeIdx = sess.chatHistory.findIndex(
        m => m && m.sender === 'bot' && Array.isArray(m.options) && m.options.some(o => o && o.value === 'ரேஷன் கார்டு')
    );
    if (welcomeIdx >= 0) {
        sess.chatHistory = sess.chatHistory.slice(0, welcomeIdx + 1);
        if (userLabel) sess.chatHistory.push({ sender: 'user', text: userLabel });
        sess.chatHistory.push(botMenuPayload);
        return;
    }
    sess.chatHistory.push(botMenuPayload);
}

function handleServiceSelection(text, sess) {
    const isAlreadyInRationMenu = sess.intakeState === 'RATION_CARD_SERVICES';

    const isMainMenuNav = text === 'MAIN_MENU' || text === 'முதன்மைப் பட்டியல்' || text.includes('முதன்மைப் பட்டியல்');
    if (isMainMenuNav) {
        sess.intakeState = 'SERVICE_SELECTION';
        sess.step = 'SERVICE_SELECTION';
        sess.service = null;
        sess.subService = null;
        sess.subServiceData = null;
        if (sess.citizenProfile) sess.citizenProfile.subService = null;
        const mob = sess.mobileNumber || sess.citizenProfile?.mobileNumber || '';
        const cleanMob = /^walkin_/i.test(String(mob)) ? '' : mob;
        sess.chatHistory = [getInitialWelcomeMessage(sess.citizenProfile, cleanMob)];
        return true;
    }

    const isRevenueCategory = (
        text === 'வருவாய்த் துறை' ||
        text === 'வருவாய்த் துறை சான்றிதழ்கள்' ||
        text === 'வருவாய் துறை' ||
        text === 'REVENUE_DEPARTMENT' ||
        text === 'REVENUE_DEPARTMENT_SERVICES' ||
        text.toLowerCase() === 'revenue department' ||
        text.includes('வருவாய்த் துறை') ||
        text.includes('வருவாய் துறை')
    );
    if (isRevenueCategory) {
        sess.intakeState = 'REVENUE_DEPARTMENT_SERVICES';
        sess.step = 'REVENUE_DEPARTMENT_SERVICES';
        sess.service = 'வருவாய்த் துறை';
        sess.subService = null;
        if (sess.citizenProfile) sess.citizenProfile.subService = null;
        rewindChatToCategoryMenu(sess, 'வருவாய்த் துறை சான்றிதழ்கள்', text, {
            sender: 'bot',
            text: `🏛️ **வருவாய்த் துறை சான்றிதழ்கள் (Revenue Department - e-Sevai / TNeGA)**\n\n` +
                  `நீங்கள் எந்த சான்றிதழுக்கு விண்ணப்பிக்க விரும்புகிறீர்கள்?\n\n` +
                  `கீழே உள்ள சான்றிதழ்களில் ஒன்றைத் தேர்ந்தெடுக்கவும்:`,
            options: REVENUE_DEPARTMENT_SERVICE_OPTIONS
        });
        return true;
    }

    const { resolveCartridgeForSelection } = require('../cartridges');
    const matchedCartridge = resolveCartridgeForSelection(text, sess);
    if (matchedCartridge && matchedCartridge.flow && typeof matchedCartridge.flow.enterService === 'function') {
        return matchedCartridge.flow.enterService(sess);
    }

    const isRationCardCategory = (
        text === 'ரேஷன் கார்டு' ||
        text === 'ரேஷன்' ||
        text.toLowerCase() === 'ration' ||
        text.toLowerCase() === 'ration card' ||
        text.includes('குடும்ப அட்டை சேவைகள்') ||
        text === '1'
    );
    if (isRationCardCategory) {
        sess.intakeState = 'RATION_CARD_SERVICES';
        sess.step = 'RATION_CARD_SERVICES';
        sess.service = 'ரேஷன் கார்டு';
        sess.subService = null;
        if (sess.citizenProfile) sess.citizenProfile.subService = null;
        rewindChatToCategoryMenu(sess, 'குடும்ப அட்டை (Ration Card) சேவைகள்', text, {
            sender: 'bot',
            text: `🏛️ **குடும்ப அட்டை (Ration Card) சேவைகள்**\n\n` +
                  `நீங்கள் குடும்ப அட்டையில் எந்த சேவையைச் செய்ய விரும்புகிறீர்கள்?\n\n` +
                  `கீழே உள்ள விருப்பங்களில் ஒன்றைத் தேர்ந்தெடுக்கவும்:`,
            options: RATION_CARD_SERVICE_OPTIONS
        });
        return true;
    }

    if (handleRationSubserviceMenuPrompts(text, sess, isAlreadyInRationMenu)) {
        return true;
    }

    return handleNonRationServiceSelection(text, sess);
}

async function handleRationSubserviceWorkflow(text, sess, uploadedDoc = null, extractedDoc = null) {
    if (!sess) return false;
    const currentState = sess.intakeState;
    const { resolveCartridge, getCartridgeById } = require('../cartridges');

    let cartridge = null;
    if (text === 'RATION_ADD_MEMBER_RESET' || (text && text.includes('புதிய ஆவணம் மாற்று'))) {
        cartridge = getCartridgeById('TNPDS_ADD_MEMBER');
    } else if (text === 'RATION_CHANGE_ADDRESS_RESET' || (text && text.includes('முகவரியை மாற்று'))) {
        cartridge = getCartridgeById('TNPDS_CHANGE_ADDRESS');
    } else if (text === 'RATION_REMOVE_MEMBER_RESET' || (text && text.includes('உறுப்பினர் நீக்கத்தை மாற்று'))) {
        cartridge = getCartridgeById('TNPDS_REMOVE_MEMBER');
    } else {
        cartridge = resolveCartridge({ subService: sess.subService, intakeState: currentState });
    }

    if (cartridge && cartridge.portal === 'TNPDS' && cartridge.id !== 'TNPDS_NEW_CARD') {
        if (cartridge.flow && typeof cartridge.flow.handleFlow === 'function') {
            if (await cartridge.flow.handleFlow(text, sess, uploadedDoc, extractedDoc)) {
                return true;
            }
        }
    }

    return handleMinorRationSubservices(text, sess, currentState, uploadedDoc, extractedDoc);
}

module.exports = {
    SERVICE_OPTIONS,
    REVENUE_DEPARTMENT_SERVICE_OPTIONS,
    RATION_CARD_SERVICE_OPTIONS,
    MEMBER_COUNT_OPTIONS,
    RESIDENCE_PROOF_OPTIONS,
    RELATIONSHIP_OPTIONS,
    getRelationshipOptions,
    mapRelationshipToEng,
    getInitialWelcomeMessage,
    handleServiceSelection,
    handleRationSubserviceWorkflow,
    renderSubserviceReadySummary
};
