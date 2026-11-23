/**
 * src/routes/chat/chat_tnega_intake.js
 *
 * Frozen Thin Switchboard Router for TNeGA Revenue Services.
 * Strictly dispatches ONLY to the owning Cartridge in src/cartridges/tnega_<service>/intake.js.
 * Zero service-specific intake logic or if/else ladders live here.
 */
const { getCartridgeById, resolveCartridge } = require('../../cartridges');

async function handleTnegaIntake(ctx, req, res) {
    const { text, sess } = ctx;
    if (!sess) return false;

    const nonTnegaCartridge = resolveCartridge(sess, text);
    if (nonTnegaCartridge && nonTnegaCartridge.portal !== 'TNEGA' && !(text && (
        text === 'CAN_REGISTER_PROMPT' ||
        text === 'CAN_SEARCH_PROMPT' ||
        text === 'CAN_DIRECT_INPUT' ||
        text === 'CAN_DIRECT' ||
        text === 'என்னிடம் CAN உள்ளது' ||
        text.startsWith('START_CAN_') ||
        text.startsWith('LAUNCH_CAN_') ||
        text.startsWith('CAN_SEARCH')
    ))) {
        return false;
    }

    // Dedicated CAN Registration transitions take explicit ownership when triggered
    const isCanRegisterTransition = text === 'CAN_REGISTER_PROMPT' ||
        text === 'START_CAN_REGISTER' ||
        (sess.intakeState && ['CAN_REGISTER_INTAKE', 'CAN_AADHAAR_BACK_WAIT', 'CAN_MOTHER_NAME_WAIT', 'CAN_COMMUNITY_WAIT'].includes(sess.intakeState));

    if (isCanRegisterTransition) {
        const canCartridge = getCartridgeById('TNEGA_CAN_REGISTER');
        if (canCartridge && await canCartridge.intake.handleIntake(ctx, req, res)) {
            return true;
        }
    }

    // Authoritative Cartridge Lookup: route ONLY to owning TNeGA Cartridge
    let activeCartridge = resolveCartridge(sess, text);
    if (activeCartridge && activeCartridge.portal === 'TNEGA') {
        const handled = await activeCartridge.intake.handleIntake(ctx, req, res);
        if (handled) return true;
    }

    // Standalone CAN Direct/Search fallback when no parent certificate subService is active
    if (text === 'CAN_DIRECT_INPUT' || text === 'என்னிடம் CAN உள்ளது' || text === 'CAN_DIRECT' ||
        sess.intakeState === 'CAN_DIRECT_INPUT_WAIT' || text === 'CAN_SEARCH_PROMPT' ||
        text === 'START_CAN_SEARCH' || sess.intakeState === 'CAN_SEARCH_INTAKE') {
        const fallbackCartridge = getCartridgeById('TNEGA_INCOME');
        if (fallbackCartridge && await fallbackCartridge.intake.handleIntake(ctx, req, res)) {
            return true;
        }
    }

    return false;
}

module.exports = { handleTnegaIntake };
