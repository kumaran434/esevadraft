/**
 * eSevaDraft - TNPDS Master Services Gateway
 * Routes requests to dedicated isolated service modules.
 */

const newSmartCard = require('./new_smart_card/new_smart_card_flow');
const addFamilyMember = require('./add_family_member/add_member_flow');
const changeAddress = require('./change_address/change_address_flow');

module.exports = {
    // Isolated Services
    newSmartCard,
    addFamilyMember,
    changeAddress,

    // Direct service execution shortcuts
    startNewSmartCard: newSmartCard.startTnpdsRationCardFlow,
    startAddMember: addFamilyMember.startTnpdsAddMemberFlow,
    startAddressChange: changeAddress.startTnpdsAddressChangeFlow,

    // Session controls
    provideOtp: newSmartCard.provideOtp,
    stopAutomation: newSmartCard.stopTnpdsAutomation
};
