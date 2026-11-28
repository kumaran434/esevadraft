// Golden Cartridge Template: manifest.js (Copy & rename for Service #15..#50+)
// Golden Rule 26: Define exact per-service photo & document size ceilings matching the target government portal!
module.exports = {
    id: 'TEMPLATE_SERVICE',
    portal: 'TNEGA',
    subService: 'TEMPLATE_SERVICE',
    serviceKey: 'TEMPLATE_SERVICE',
    aliases: ['TEMPLATE_SERVICE'],
    ownedStates: ['TEMPLATE_INTAKE', 'TEMPLATE_AADHAAR_WAIT', 'READY_TO_APPLY_TEMPLATE'],
    documentLimits: {
        photoMaxKB: 46,
        photoWidth: 200,
        photoHeight: 230,
        docMaxKB: 185
    }
};
