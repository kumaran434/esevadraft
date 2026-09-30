/**
 * eSevaDraft - Dedicated New Smart Ration Card Automation Engine
 * Service: TNPDS New Ration Card Application (புதிய மின்னணு குடும்ப அட்டை)
 * 
 * 🔒 PRODUCTION-LOCKED: 100% Frozen & Isolated
 */

const path = require('path');
const rootAutomation = require('../../../tnpds_automation');

/**
 * Runs the isolated 51-step New Smart Card flow.
 */
async function runNewSmartCardAutomation(citizenProfile, onProgress, options) {
    return await rootAutomation.startTnpdsRationCardFlow(citizenProfile, onProgress, options);
}

module.exports = {
    runNewSmartCardAutomation,
    startTnpdsRationCardFlow: rootAutomation.startTnpdsRationCardFlow,
    provideOtp: rootAutomation.provideOtp,
    stopTnpdsAutomation: rootAutomation.stopTnpdsAutomation
};
