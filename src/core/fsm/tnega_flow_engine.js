/**
 * src/core/fsm/tnega_flow_engine.js
 *
 * Modular Cartridge Compatibility Facade (Zero Service Monolith).
 * Each TNeGA service owns its own flow in src/cartridges/tnega_<service>/flow.js.
 * Lazy-invoked so ZERO circular dependencies occur at module load time.
 */
const { getCartridgeById, getTnegaPortalSchemas } = require('../../cartridges');

const TNEGA_PORTAL_SCHEMAS = getTnegaPortalSchemas();

module.exports = {
    TNEGA_PORTAL_SCHEMAS,
    advanceTnegaIncomeFlow: (sess, prefixMessage = '') => getCartridgeById('TNEGA_INCOME').flow.advanceFlow(sess, prefixMessage),
    advanceTnegaCanRegisterFlow: (sess, prefixMessage = '') => getCartridgeById('TNEGA_CAN_REGISTER').flow.advanceFlow(sess, prefixMessage),
    advanceTnegaResidenceFlow: (sess, prefixMessage = '') => getCartridgeById('TNEGA_RESIDENCE').flow.advanceFlow(sess, prefixMessage),
    advanceTnegaCommunityFlow: (sess, prefixMessage = '') => getCartridgeById('TNEGA_COMMUNITY').flow.advanceFlow(sess, prefixMessage),
    advanceTnegaFirstGraduateFlow: (sess, prefixMessage = '') => getCartridgeById('TNEGA_FIRST_GRADUATE').flow.advanceFlow(sess, prefixMessage),
    advanceTnegaObcFlow: (sess, prefixMessage = '') => getCartridgeById('TNEGA_OBC').flow.advanceFlow(sess, prefixMessage),
    advanceTnegaLegalHeirFlow: (sess, prefixMessage = '') => getCartridgeById('TNEGA_LEGAL_HEIR').flow.advanceFlow(sess, prefixMessage),
    advanceTnegaWidowFlow: (sess, prefixMessage = '') => getCartridgeById('TNEGA_WIDOW').flow.advanceFlow(sess, prefixMessage)
};
