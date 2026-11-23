/**
 * src/cartridges/index.js
 *
 * Central Plugin Switchboard & Contract Guard for eSevaDraft.
 * Manifests load eagerly at startup with strict disjoint ownedStates validation.
 * Service handlers (flow, intake, extractor, automation) lazy-load per cartridge
 * so there are ZERO circular dependencies even at 2,000+ services!
 */
const path = require('path');

const CARTRIDGE_FOLDERS = [
    'tnpds_new_card',
    'tnpds_add_member',
    'tnpds_remove_member',
    'tnpds_change_address',
    'tnpds_update_mobile',
    'tnpds_change_head',
    'tnega_can_register',
    'tnega_community',
    'tnega_residence',
    'tnega_income',
    'tnega_first_graduate',
    'tnega_obc',
    'tnega_legal_heir',
    'tnega_widow'
];

const CARTRIDGES = new Map();
const BY_ALIAS = new Map();
const BY_STATE = new Map();

function defineLazyPart(target, prop, modulePath) {
    let cached = null;
    Object.defineProperty(target, prop, {
        enumerable: true,
        get() {
            if (!cached) cached = require(modulePath);
            return cached;
        }
    });
}

for (const folder of CARTRIDGE_FOLDERS) {
    const baseDir = path.join(__dirname, folder);
    const manifest = require(path.join(baseDir, 'manifest.js'));

    const cartridge = {
        id: manifest.id,
        folder,
        portal: manifest.portal,
        subService: manifest.subService,
        code: manifest.code,
        manifest
    };
    defineLazyPart(cartridge, 'flow', path.join(baseDir, 'flow.js'));
    defineLazyPart(cartridge, 'intake', path.join(baseDir, 'intake.js'));
    defineLazyPart(cartridge, 'extractor', path.join(baseDir, 'extractor.js'));
    defineLazyPart(cartridge, 'automation', path.join(baseDir, 'automation.js'));

    CARTRIDGES.set(manifest.id.toUpperCase(), cartridge);
    BY_ALIAS.set(manifest.id.toUpperCase(), cartridge);
    if (manifest.subService) BY_ALIAS.set(String(manifest.subService).trim().toUpperCase(), cartridge);
    if (manifest.code) BY_ALIAS.set(String(manifest.code).trim().toUpperCase(), cartridge);
    if (Array.isArray(manifest.aliases)) {
        for (const a of manifest.aliases) {
            BY_ALIAS.set(String(a).trim().toUpperCase(), cartridge);
        }
    }
    if (Array.isArray(manifest.ownedStates)) {
        for (const st of manifest.ownedStates) {
            const up = String(st).trim().toUpperCase();
            if (BY_STATE.has(up)) {
                throw new Error(`Cartridge State Collision: "${up}" claimed by both ${BY_STATE.get(up).id} and ${manifest.id}`);
            }
            BY_STATE.set(up, cartridge);
        }
    }
}

function getCartridgeById(id) {
    if (!id) return null;
    return CARTRIDGES.get(String(id).trim().toUpperCase()) || null;
}

function getCartridgeByAlias(raw) {
    if (!raw) return null;
    const up = String(raw).trim().toUpperCase();
    return BY_ALIAS.get(up) || BY_ALIAS.get(up.replace(/^\d+\.\s*/, '').trim()) || null;
}

function getCartridgeByState(state) {
    if (!state) return null;
    const up = String(state).trim().toUpperCase();
    if (BY_STATE.has(up)) return BY_STATE.get(up);
    if (up.startsWith('RATION_ADD_MEMBER')) return CARTRIDGES.get('TNPDS_ADD_MEMBER');
    if (up.startsWith('RATION_REMOVE_MEMBER')) return CARTRIDGES.get('TNPDS_REMOVE_MEMBER');
    if (up.startsWith('RATION_CHANGE_ADDRESS')) return CARTRIDGES.get('TNPDS_CHANGE_ADDRESS');
    if (up.startsWith('RATION_CHANGE_MOBILE')) return CARTRIDGES.get('TNPDS_UPDATE_MOBILE');
    if (up.startsWith('RATION_CHANGE_HEAD')) return CARTRIDGES.get('TNPDS_CHANGE_HEAD');
    return null;
}

function resolveCartridge(input = {}, overrideHint = '') {
    const src = input || {};
    const prof = src.citizenProfile || {};
    const bySub = getCartridgeByAlias(src.subService || prof.subService);
    if (bySub) return bySub;
    const byId = getCartridgeById(src.pluginId || prof.pluginId);
    if (byId) return byId;
    const byState = getCartridgeByState(src.intakeState || prof.intakeState || src.step);
    if (byState) return byState;
    for (const h of [overrideHint, src.targetService, prof.targetService, src.serviceId, prof.serviceId, src.service, prof.service]) {
        const found = getCartridgeByAlias(h);
        if (found) return found;
    }
    return null;
}

/**
 * Pure Switchboard mapper for service selection text & operator quick-launch buttons.
 * Returns matching Cartridge (never matches category menus or Voter/LPG placeholders).
 */
function resolveCartridgeForSelection(rawText, sess = {}) {
    const text = String(rawText || '').trim();
    if (!text) return null;

    const lower = text.toLowerCase();
    // Never hijack category-only menu requests or non-service commands
    if ([
        'ரேஷன் கார்டு', 'ரேஷன்', 'ration', 'ration card', 'குடும்ப அட்டை சேவைகள்',
        'வருவாய்த் துறை', 'வருவாய்த் துறை சான்றிதழ்கள்', 'வருவாய் துறை',
        'revenues', 'revenue_department', 'revenue_department_services', 'revenue department',
        'main_menu', 'முதன்மைப் பட்டியல்', 'reset', 'trigger_edit_modal',
        'continue_intake', 'confirm_submit', 'change_head_photo'
    ].includes(lower)) {
        return null;
    }
    if (lower.includes('வாக்காளர்') || lower.includes('voter')) return null;

    const exact = getCartridgeByAlias(text);
    if (exact) return exact;

    const inRationMenu = sess?.intakeState === 'RATION_CARD_SERVICES';
    if (text.includes('உறுப்பினர் சேர்க்க') || (inRationMenu && text === '2') || text.startsWith('2.') && text.includes('சேர்க்க')) {
        return getCartridgeById('TNPDS_ADD_MEMBER');
    }
    if (text.includes('உறுப்பினர் நீக்க')) {
        return getCartridgeById('TNPDS_REMOVE_MEMBER');
    }
    if (text.includes('தலைவர் மாற்றம்') || text === 'RATION_CHANGE_HEAD') {
        return getCartridgeById('TNPDS_CHANGE_HEAD');
    }
    if (text.includes('முகவரி மாற்றம்') || lower.includes('change address') || (inRationMenu && (text === '3' || text === '5'))) {
        return getCartridgeById('TNPDS_CHANGE_ADDRESS');
    }
    if (text.includes('கைபேசி') || text === 'RATION_CHANGE_MOBILE' || (inRationMenu && (text === '4' || text === '7'))) {
        return getCartridgeById('TNPDS_UPDATE_MOBILE');
    }
    if (text.includes('புதிய ரேஷன்') || text.includes('புதிய குடும்ப') || lower.includes('new ration') || (inRationMenu && (text === '1' || text.startsWith('1.')))) {
        return getCartridgeById('TNPDS_NEW_CARD');
    }
    if (text.includes('விதவை') || lower.includes('widow') || text.includes('REV-109')) {
        return getCartridgeById('TNEGA_WIDOW');
    }
    if (text.includes('வாரிசு') || lower.includes('legal heir') || text.includes('REV-114')) {
        return getCartridgeById('TNEGA_LEGAL_HEIR');
    }
    if (lower.includes('obc') || text.includes('இதர பிற்படுத்தப்பட்டோர்') || text.includes('REV-115')) {
        return getCartridgeById('TNEGA_OBC');
    }
    if (text.includes('முதல் பட்டதாரி') || lower.includes('first graduate') || lower.includes('first_graduate') || text.includes('REV-104')) {
        return getCartridgeById('TNEGA_FIRST_GRADUATE');
    }
    if (text.includes('வருமான') || lower.includes('income') || text.includes('REV-103')) {
        return getCartridgeById('TNEGA_INCOME');
    }
    if (text.includes('இருப்பிட') || lower.includes('residence') || text.includes('பிறப்பிட') || lower.includes('nativity') || text.includes('REV-102')) {
        return getCartridgeById('TNEGA_RESIDENCE');
    }
    if (!text.startsWith('COMMUNITY_') && !text.startsWith('RELIGION_') && (text.includes('சாதி') || lower.includes('community') || text.includes('REV-101'))) {
        return getCartridgeById('TNEGA_COMMUNITY');
    }
    if (text === 'CAN_REGISTER_PROMPT' || text === 'START_CAN_REGISTER') {
        return getCartridgeById('TNEGA_CAN_REGISTER');
    }
    return null;
}

function listCartridges() {
    return Array.from(CARTRIDGES.values());
}

function getTnegaPortalSchemas() {
    return {
        CAN_REGISTER: CARTRIDGES.get('TNEGA_CAN_REGISTER').manifest.schema,
        INCOME_CERTIFICATE: CARTRIDGES.get('TNEGA_INCOME').manifest.schema,
        RESIDENCE_CERTIFICATE: CARTRIDGES.get('TNEGA_RESIDENCE').manifest.schema,
        COMMUNITY_CERTIFICATE: CARTRIDGES.get('TNEGA_COMMUNITY').manifest.schema,
        FIRST_GRADUATE_CERTIFICATE: CARTRIDGES.get('TNEGA_FIRST_GRADUATE').manifest.schema,
        OBC_CERTIFICATE: CARTRIDGES.get('TNEGA_OBC').manifest.schema,
        LEGAL_HEIR_CERTIFICATE: CARTRIDGES.get('TNEGA_LEGAL_HEIR').manifest.schema,
        WIDOW_CERTIFICATE: CARTRIDGES.get('TNEGA_WIDOW').manifest.schema
    };
}

module.exports = {
    CARTRIDGE_FOLDERS,
    CARTRIDGES,
    BY_STATE,
    getCartridgeById,
    getCartridgeByAlias,
    getCartridgeByState,
    resolveCartridge,
    resolveCartridgeForSelection,
    listCartridges,
    getTnegaPortalSchemas
};
