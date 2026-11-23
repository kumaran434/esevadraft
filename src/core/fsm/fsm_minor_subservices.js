/**
 * eSevaDraft FSM Minor Subservices Switchboard
 * Active Cartridges (REMOVE_MEMBER, CHANGE_HEAD, CHANGE_ADDRESS, UPDATE_MOBILE) execute in their own folders.
 */

const { renderSubserviceReadySummary } = require('./fsm_summary_formatter');

function handleMinorRationSubservices(text, sess, currentState, uploadedDoc = null, extractedDoc = null) {
    const { resolveCartridge } = require('../../cartridges');
    const matched = resolveCartridge({
        subService: sess?.subService,
        intakeState: currentState
    });
    if (matched && matched.portal === 'TNPDS' && matched.id !== 'TNPDS_NEW_CARD' && matched.id !== 'TNPDS_ADD_MEMBER') {
        if (matched.flow && typeof matched.flow.handleFlow === 'function') {
            if (matched.flow.handleFlow(text, sess, uploadedDoc, extractedDoc)) {
                return true;
            }
        }
    }

    // Placeholders without dedicated portal automation
    if (currentState === 'RATION_CHANGE_CARD_TYPE') {
        sess.subService = 'CHANGE_CARD_TYPE';
        let cardType = 'அரிசி அட்டை (Rice Card - PHH/NPHH)';
        if (text === 'CARD_TYPE_SUGAR' || text.includes('சர்க்கரை')) cardType = 'சர்க்கரை அட்டை (Sugar Card - NPHHS)';
        else if (text === 'CARD_TYPE_NO_COMMODITY' || text.includes('பண்டமில்லா')) cardType = 'பண்டமில்லா அட்டை (No Commodity - NC)';
        sess.subServiceData = { ...(sess.subServiceData || {}), cardType };
        sess.intakeState = 'READY_TO_APPLY';
        sess.step = 'READY';
        sess.chatHistory.push(renderSubserviceReadySummary(sess));
        return true;
    }

    if (currentState === 'RATION_LPG_UPDATE') {
        sess.subService = 'LPG_UPDATE';
        let cyl = '1 சிலிண்டர் (Single Cylinder)';
        if (text === 'LPG_CYL_0' || text.includes('இல்லை')) cyl = '0 சிலிண்டர் (No Cylinder)';
        else if (text === 'LPG_CYL_2' || text.includes('இரண்டு')) cyl = '2 சிலிண்டர்கள் (Double Cylinders)';
        sess.subServiceData = { ...(sess.subServiceData || {}), cylinders: cyl };
        sess.intakeState = 'READY_TO_APPLY';
        sess.step = 'READY';
        sess.chatHistory.push(renderSubserviceReadySummary(sess));
        return true;
    }

    return false;
}

module.exports = { handleMinorRationSubservices };
