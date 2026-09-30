/**
 * eSevaDraft - Universal Government Automations Master Registry
 * (அனைத்து அரசு சேவைகளுக்குமான முதன்மை கட்டமைப்பு)
 * 
 * Every government portal service is isolated in its own dedicated directory.
 */

const tnpds = require('./tnpds');
const govtCore = require('../govt_automation_core');

module.exports = {
    // Portals
    tnpds,
    
    // Core Engine & Immunity
    core: govtCore,

    // Service Registry Metadata
    services: [
        {
            id: 'TNPDS_NEW_SMART_CARD',
            nameTam: 'புதிய மின்னணு குடும்ப அட்டை',
            nameEng: 'New Smart Ration Card',
            portal: 'TNPDS',
            status: 'FROZEN_PRODUCTION',
            modulePath: 'automations/tnpds/new_smart_card/'
        },
        {
            id: 'TNPDS_ADD_MEMBER',
            nameTam: 'குடும்ப உறுப்பினர் சேர்க்கை',
            nameEng: 'Add Family Member',
            portal: 'TNPDS',
            status: 'ACTIVE_DEVELOPMENT',
            modulePath: 'automations/tnpds/add_family_member/'
        },
        {
            id: 'TNPDS_CHANGE_ADDRESS',
            nameTam: 'குடும்ப அட்டை முகவரி மாற்றம்',
            nameEng: 'Change of Address in Smart Card',
            portal: 'TNPDS',
            status: 'ACTIVE_DEVELOPMENT',
            modulePath: 'automations/tnpds/change_address/'
        },
        {
            id: 'TNEGA_CERTIFICATES',
            nameTam: 'வருமானம் / சாதி / இருப்பிடச் சான்றிதழ்',
            nameEng: 'Income / Community / Nativity Certificates',
            portal: 'TNeGA',
            status: 'BLUEPRINT_READY',
            modulePath: 'automations/tnega/'
        },
        {
            id: 'NVSP_VOTER',
            nameTam: 'வாக்காளர் அடையாள அட்டை',
            nameEng: 'Voter ID Card',
            portal: 'NVSP',
            status: 'BLUEPRINT_READY',
            modulePath: 'automations/nvsp_voter/'
        },
        {
            id: 'PATTA_CHITTA',
            nameTam: 'பட்டா / சிட்டா பார்வையிடல்',
            nameEng: 'Patta Chitta Land Records',
            portal: 'Revenue Department',
            status: 'BLUEPRINT_READY',
            modulePath: 'automations/patta_chitta/'
        }
    ]
};
