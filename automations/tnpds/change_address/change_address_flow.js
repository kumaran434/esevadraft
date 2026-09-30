/**
 * eSevaDraft - Dedicated Change Address Automation Engine
 * Service: TNPDS Change of Address (குடும்ப அட்டை முகவரி மாற்றம்)
 * 
 * 🚀 ACTIVE ISOLATED SERVICE
 */

const path = require('path');
const rootAutomation = require('../../../tnpds_automation');

/**
 * Runs the isolated Change Address flow.
 */
async function runChangeAddressAutomation(citizenProfile, onProgress, options) {
    return await rootAutomation.startTnpdsAddressChangeFlow(citizenProfile, onProgress, options);
}

module.exports = {
    runChangeAddressAutomation,
    startTnpdsAddressChangeFlow: rootAutomation.startTnpdsAddressChangeFlow,
    provideOtp: rootAutomation.provideOtp,
    stopTnpdsAutomation: rootAutomation.stopTnpdsAutomation
};
