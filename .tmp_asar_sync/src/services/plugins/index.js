// ============================================================================
// eSevaDraft Service Plugins Index & Registry
// Clean unified access to all government service plugins
// ============================================================================

const RATION_NEW_CARD = require('./ration_new_card');
const RATION_ADD_MEMBER = require('./ration_add_member');
const RATION_CHANGE_ADDRESS = require('./ration_change_address');
const { validateServiceContract } = require('./service_contract_validator');

const SERVICE_PLUGINS = {
    NEW_RATION_CARD: RATION_NEW_CARD,
    NEW_CARD: RATION_NEW_CARD,
    TNPDS_NFC: RATION_NEW_CARD,
    ADD_MEMBER: RATION_ADD_MEMBER,
    RATION_ADD_MEMBER,
    TNPDS_ADD_MEM: RATION_ADD_MEMBER,
    CHANGE_ADDRESS: RATION_CHANGE_ADDRESS,
    RATION_CHANGE_ADDRESS,
    TNPDS_CHG_ADDR: RATION_CHANGE_ADDRESS
};

function getServicePlugin(serviceId) {
    if (!serviceId) return null;
    const key = String(serviceId).trim().toUpperCase();
    return SERVICE_PLUGINS[key] || null;
}

module.exports = {
    SERVICE_PLUGINS,
    getServicePlugin,
    validateServiceContract
};
