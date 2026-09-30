/**
 * eSevaDraft - Dedicated Add Family Member Automation Engine
 * Service: TNPDS Add Family Member (குடும்ப உறுப்பினர் சேர்க்கை)
 * 
 * 🚀 ACTIVE ISOLATED SERVICE
 */

const path = require('path');
const rootAutomation = require('../../../tnpds_automation');

/**
 * Runs the isolated Add Family Member flow.
 */
async function runAddMemberAutomation(citizenProfile, onProgress, options) {
    return await rootAutomation.startTnpdsAddMemberFlow(citizenProfile, onProgress, options);
}

module.exports = {
    runAddMemberAutomation,
    startTnpdsAddMemberFlow: rootAutomation.startTnpdsAddMemberFlow,
    provideOtp: rootAutomation.provideOtp,
    stopTnpdsAutomation: rootAutomation.stopTnpdsAutomation
};
