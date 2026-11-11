/**
 * eSevaDraft - Dedicated Remove Family Member Automation Engine
 * Service: TNPDS Remove Member (குடும்ப உறுப்பினர் நீக்கம்)
 * 
 * 🚀 ACTIVE ISOLATED SERVICE
 */

const path = require('path');
const rootAutomation = require('../../../tnpds_automation');

/**
 * Runs the isolated Remove Family Member flow.
 */
async function runRemoveMemberAutomation(citizenProfile, onProgress, options) {
    return await rootAutomation.startTnpdsRemoveMemberFlow(citizenProfile, onProgress, options);
}

module.exports = {
    runRemoveMemberAutomation,
    startTnpdsRemoveMemberFlow: rootAutomation.startTnpdsRemoveMemberFlow,
    provideOtp: rootAutomation.provideOtp,
    stopTnpdsAutomation: rootAutomation.stopTnpdsAutomation
};
