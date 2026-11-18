/**
 * src/catalog/index.js
 * 
 * eSevaDraft Universal Service Catalog & Plugin Registry.
 * Central single source of truth for all government service definitions across TNPDS and TNeGA.
 */

const tnpdsNewCard = require('./services/tnpds_new_card');
const tnpdsAddMember = require('./services/tnpds_add_member');
const tnpdsRemoveMember = require('./services/tnpds_remove_member');
const tnpdsChangeAddress = require('./services/tnpds_change_address');

const tnegaCanRegister = require('./services/tnega_can_register');
const tnegaIncome = require('./services/tnega_income');
const tnegaResidence = require('./services/tnega_residence');
const tnegaCommunity = require('./services/tnega_community');
const tnegaFirstGraduate = require('./services/tnega_first_graduate');
const tnegaObc = require('./services/tnega_obc');

const { evaluateServiceDelta } = require('./universal_delta_engine');

const ALL_SERVICES = [
    tnpdsNewCard,
    tnpdsAddMember,
    tnpdsRemoveMember,
    tnpdsChangeAddress,
    tnegaCanRegister,
    tnegaIncome,
    tnegaResidence,
    tnegaCommunity,
    tnegaFirstGraduate,
    tnegaObc
];

// Build Fast Map by ID and by Alias (case-insensitive)
const REGISTRY_BY_ID = new Map();
const REGISTRY_BY_ALIAS = new Map();

for (const svc of ALL_SERVICES) {
    REGISTRY_BY_ID.set(svc.id, svc);
    REGISTRY_BY_ALIAS.set(svc.id.toLowerCase(), svc);
    if (svc.code) REGISTRY_BY_ALIAS.set(svc.code.toLowerCase(), svc);
    if (Array.isArray(svc.aliases)) {
        for (const alias of svc.aliases) {
            REGISTRY_BY_ALIAS.set(alias.toLowerCase(), svc);
        }
    }
}

function getService(idOrAlias) {
    if (!idOrAlias) return null;
    const clean = String(idOrAlias).trim().toLowerCase();
    return REGISTRY_BY_ALIAS.get(clean) || REGISTRY_BY_ID.get(idOrAlias) || null;
}

function listServices() {
    return ALL_SERVICES;
}

function listServicesByPortal(portal) {
    const cleanPortal = String(portal || '').toUpperCase();
    return ALL_SERVICES.filter(s => s.portal.toUpperCase() === cleanPortal);
}

function evaluateDelta(idOrAlias, citizenProfile, documents) {
    const svc = getService(idOrAlias);
    if (!svc) {
        return { isReady: false, status: 'UNKNOWN_SERVICE', error: `Service "${idOrAlias}" not found in catalog.` };
    }
    return evaluateServiceDelta(svc, citizenProfile, documents);
}

function getAutomationRunner(idOrAlias) {
    const svc = getService(idOrAlias);
    if (!svc || typeof svc.getRunner !== 'function') return null;
    return svc.getRunner();
}

module.exports = {
    getService,
    listServices,
    listServicesByPortal,
    evaluateDelta,
    getAutomationRunner,
    SERVICES: ALL_SERVICES
};
