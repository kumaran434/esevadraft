// ============================================================================
// eSevaDraft Government Document Policy Engine (Golden Rule 26)
// Service-Wise & Portal-Wise HD Document & Photo Compliance Matrix
// Zero Universal Low-Size Crunch — each service uses the maximum crisp quality
// safely accepted by its target government portal.
// ============================================================================

const fs = require('fs');
const path = require('path');

const PORTAL_DOCUMENT_POLICIES = {
    TNPDS: {
        portal: 'TNPDS',
        portalName: 'Tamil Nadu Public Distribution System (TNPDS)',
        govtDocLimitKB: 1024, // 1 MB govt ceiling
        maxSizeBytes: 850 * 1024, // 850 KB crisp HD ceiling safely under 1 MB
        maxSizeKB: 850,
        govtPhotoLimitKB: 5120, // 5 MB govt photo ceiling
        photoMaxBytes: 250 * 1024, // 250 KB crisp HD portrait for Smart Card print clarity
        photoMaxKB: 250,
        photoWidth: 400,
        photoHeight: 460,
        photoQualityTarget: 92,
        docMaxWidth: 1600,
        docMaxHeight: 2200,
        dualSideWidth: 1400,
        dualSideHeight: 950,
        allowedFormats: ['pdf', 'jpeg', 'jpg', 'png'],
        preferredFormat: 'pdf',
        dualSidedLayout: 'A4_2IN1',
        jpegQualityTarget: 90,
        allowMultiPage: true
    },
    TNEGA: {
        portal: 'TNEGA',
        portalName: 'Tamil Nadu e-Governance Agency (TNeGA e-Sevai)',
        govtDocLimitKB: 200, // 200 KB strict govt ceiling
        maxSizeBytes: 185 * 1024, // 185 KB safe ceiling under 200 KB
        maxSizeKB: 185,
        govtPhotoLimitKB: 50, // 50 KB strict govt photo ceiling
        photoMaxBytes: 46 * 1024, // 46 KB max sharpness safely under 50 KB
        photoMaxKB: 46,
        photoWidth: 200,
        photoHeight: 230,
        photoQualityTarget: 86,
        docMaxWidth: 1100,
        docMaxHeight: 1480,
        dualSideWidth: 1000,
        dualSideHeight: 680,
        allowedFormats: ['pdf', 'jpeg', 'jpg', 'png'],
        preferredFormat: 'pdf',
        dualSidedLayout: 'A4_2IN1',
        jpegQualityTarget: 84,
        allowMultiPage: false
    },
    NVSP: {
        portal: 'NVSP',
        portalName: 'National Voters Service Portal (Election Commission)',
        govtDocLimitKB: 2048, // 2 MB ceiling
        maxSizeBytes: 1800 * 1024,
        maxSizeKB: 1800,
        govtPhotoLimitKB: 2048,
        photoMaxBytes: 200 * 1024,
        photoMaxKB: 200,
        photoWidth: 400,
        photoHeight: 460,
        photoQualityTarget: 90,
        docMaxWidth: 1600,
        docMaxHeight: 2200,
        dualSideWidth: 1400,
        dualSideHeight: 950,
        allowedFormats: ['jpeg', 'jpg', 'png', 'pdf'],
        preferredFormat: 'jpeg',
        dualSidedLayout: 'STANDARD',
        jpegQualityTarget: 90,
        allowMultiPage: true
    },
    PATTA_CHITTA: {
        portal: 'PATTA_CHITTA',
        portalName: 'Anytime Anywhere e-Services (Revenue Administration)',
        govtDocLimitKB: 500,
        maxSizeBytes: 460 * 1024,
        maxSizeKB: 460,
        govtPhotoLimitKB: 150,
        photoMaxBytes: 100 * 1024,
        photoMaxKB: 100,
        photoWidth: 300,
        photoHeight: 345,
        photoQualityTarget: 88,
        docMaxWidth: 1400,
        docMaxHeight: 1900,
        dualSideWidth: 1200,
        dualSideHeight: 820,
        allowedFormats: ['pdf'],
        preferredFormat: 'pdf',
        dualSidedLayout: 'STANDARD',
        jpegQualityTarget: 88,
        allowMultiPage: true
    }
};

function buildServicePolicy(serviceId, portalKey, overrides = {}) {
    const base = PORTAL_DOCUMENT_POLICIES[portalKey] || PORTAL_DOCUMENT_POLICIES.TNPDS;
    const merged = {
        ...base,
        serviceId,
        portal: portalKey,
        ...overrides
    };
    merged.maxSizeBytes = merged.maxSizeKB * 1024;
    merged.photoMaxBytes = merged.photoMaxKB * 1024;
    return merged;
}

// Explicit per-service policy registry for all 14 existing services (easily extendable for #15..#100+)
const SERVICE_DOCUMENT_POLICIES = {
    // 6 TNPDS Ration Card Services (1 MB docs -> 850 KB HD | 5 MB photo -> 250 KB HD 400x460)
    TNPDS_NEW_CARD: buildServicePolicy('TNPDS_NEW_CARD', 'TNPDS'),
    TNPDS_ADD_MEMBER: buildServicePolicy('TNPDS_ADD_MEMBER', 'TNPDS'),
    TNPDS_CHANGE_ADDRESS: buildServicePolicy('TNPDS_CHANGE_ADDRESS', 'TNPDS'),
    TNPDS_REMOVE_MEMBER: buildServicePolicy('TNPDS_REMOVE_MEMBER', 'TNPDS'),
    TNPDS_CHANGE_HEAD: buildServicePolicy('TNPDS_CHANGE_HEAD', 'TNPDS'),
    TNPDS_CHANGE_MOBILE: buildServicePolicy('TNPDS_CHANGE_MOBILE', 'TNPDS'),

    // 8 TNeGA Revenue Services (200 KB docs -> 185 KB | 50 KB photo -> 46 KB 200x230)
    TNEGA_CAN_REGISTER: buildServicePolicy('TNEGA_CAN_REGISTER', 'TNEGA'),
    TNEGA_COMMUNITY: buildServicePolicy('TNEGA_COMMUNITY', 'TNEGA'),
    TNEGA_INCOME: buildServicePolicy('TNEGA_INCOME', 'TNEGA'),
    TNEGA_RESIDENCE: buildServicePolicy('TNEGA_RESIDENCE', 'TNEGA'),
    TNEGA_FIRST_GRADUATE: buildServicePolicy('TNEGA_FIRST_GRADUATE', 'TNEGA'),
    TNEGA_OBC: buildServicePolicy('TNEGA_OBC', 'TNEGA'),
    TNEGA_WIDOW: buildServicePolicy('TNEGA_WIDOW', 'TNEGA'),
    TNEGA_LEGAL_HEIR: buildServicePolicy('TNEGA_LEGAL_HEIR', 'TNEGA')
};

function detectServiceIdFromToken(rawToken) {
    if (!rawToken) return null;
    const clean = String(rawToken).trim().toUpperCase();
    if (!clean) return null;

    if (SERVICE_DOCUMENT_POLICIES[clean]) return clean;

    // TNeGA 8 services (check specific revenue identifiers BEFORE generic checks)
    if (clean.includes('LEGAL_HEIR') || clean.includes('LEGALHEIR') || clean.includes('REV-114') || clean.includes('வாரிசு')) return 'TNEGA_LEGAL_HEIR';
    if (clean.includes('WIDOW') || clean.includes('REV-109') || clean.includes('விதவை')) return 'TNEGA_WIDOW';
    if (clean.includes('FIRST_GRADUATE') || clean.includes('FIRSTGRADUATE') || clean.includes('REV-104') || clean.includes('முதல் பட்டதாரி')) return 'TNEGA_FIRST_GRADUATE';
    if (clean.includes('OBC') || clean.includes('REV-105')) return 'TNEGA_OBC';
    if (clean.includes('COMMUNITY') || clean.includes('REV-101') || clean.includes('சாதி')) return 'TNEGA_COMMUNITY';
    if (clean.includes('INCOME') || clean.includes('REV-103') || clean.includes('வருமான')) return 'TNEGA_INCOME';
    if ((clean.includes('RESIDENCE') || clean.includes('NATIVITY') || clean.includes('REV-102') || clean.includes('இருப்பிட')) &&
        !clean.includes('RESIDENCE_PROOF_TYPE') && !clean.includes('RESIDENCE_PROOF_DOC')) {
        return 'TNEGA_RESIDENCE';
    }
    if (clean.includes('CAN_REGISTER') || clean.includes('CAN_SEARCH') || clean === 'CAN' || clean.includes('TNEGA_CAN')) return 'TNEGA_CAN_REGISTER';

    // TNPDS 6 services
    if (clean.includes('ADD_MEMBER')) return 'TNPDS_ADD_MEMBER';
    if (clean.includes('REMOVE_MEMBER')) return 'TNPDS_REMOVE_MEMBER';
    if (clean.includes('CHANGE_ADDRESS') || clean.includes('ADDRESS_CHANGE')) return 'TNPDS_CHANGE_ADDRESS';
    if (clean.includes('CHANGE_HEAD') || clean.includes('HEAD_CHANGE')) return 'TNPDS_CHANGE_HEAD';
    if (clean.includes('CHANGE_MOBILE') || clean.includes('MOBILE_CHANGE')) return 'TNPDS_CHANGE_MOBILE';
    if (clean.includes('NEW_CARD') || clean.includes('NEW_RATION') || clean.includes('SMART_CARD') || clean.includes('RATION_CARD') || clean === 'RESIDENCE_PROOF_TYPE' || clean === 'RESIDENCE_PROOF_DOC') {
        return 'TNPDS_NEW_CARD';
    }

    return null;
}

/**
 * Resolves the government portal/service policy for a given identifier, options object, or session.
 * Priority: explicit documentLimits -> matched service policy -> cartridge manifest limits -> portal fallback.
 */
function resolveServiceDocumentPolicy(input) {
    // Safe fallback for legacy untagged calls (e.g. SHA-256 frozen TNeGA engines) stays safely within TNeGA ceiling;
    // every TNPDS, NVSP, Patta, and future service explicitly passes service/portal/sess/documentLimits for HD sizing.
    if (!input) return PORTAL_DOCUMENT_POLICIES.TNEGA;

    if (typeof input === 'string') {
        const svcId = detectServiceIdFromToken(input);
        if (svcId && SERVICE_DOCUMENT_POLICIES[svcId]) return SERVICE_DOCUMENT_POLICIES[svcId];
        return getPortalDocumentPolicy(input);
    }

    if (typeof input === 'object') {
        // Direct explicit custom limits (e.g. from future Cartridge #15..#100+ manifest.documentLimits)
        const customLimits = input.documentLimits || null;
        const sess = input.sess || null;
        const cp = input.citizenProfile || sess?.citizenProfile || null;

        const candidateTokens = [
            input.serviceId,
            input.service,
            input.subService,
            input.pluginId,
            input.portal,
            input.intakeState,
            sess?.pluginId,
            sess?.subService,
            sess?.service,
            sess?.intakeState,
            cp?.subService,
            cp?.service
        ].filter(Boolean);

        let basePolicy = null;
        for (const tok of candidateTokens) {
            const svcId = detectServiceIdFromToken(tok);
            if (svcId && SERVICE_DOCUMENT_POLICIES[svcId]) {
                basePolicy = SERVICE_DOCUMENT_POLICIES[svcId];
                break;
            }
        }
        if (!basePolicy) {
            for (const tok of candidateTokens) {
                const up = String(tok).trim().toUpperCase();
                if (PORTAL_DOCUMENT_POLICIES[up]) {
                    basePolicy = PORTAL_DOCUMENT_POLICIES[up];
                    break;
                }
                if (up.includes('TNEGA') || up.includes('REV-') || up.includes('CAN_')) {
                    basePolicy = PORTAL_DOCUMENT_POLICIES.TNEGA;
                    break;
                }
                if (up.includes('TNPDS') || up.includes('RATION')) {
                    basePolicy = PORTAL_DOCUMENT_POLICIES.TNPDS;
                    break;
                }
                if (up.includes('NVSP') || up.includes('VOTER') || up.includes('ECI')) {
                    basePolicy = PORTAL_DOCUMENT_POLICIES.NVSP;
                    break;
                }
                if (up.includes('PATTA') || up.includes('CHITTA')) {
                    basePolicy = PORTAL_DOCUMENT_POLICIES.PATTA_CHITTA;
                    break;
                }
            }
        }

        const resolved = { ...(basePolicy || PORTAL_DOCUMENT_POLICIES.TNEGA) };
        if (customLimits && typeof customLimits === 'object') {
            if (Number(customLimits.docMaxKB) > 0) resolved.maxSizeKB = Number(customLimits.docMaxKB);
            if (Number(customLimits.photoMaxKB) > 0) resolved.photoMaxKB = Number(customLimits.photoMaxKB);
            if (Number(customLimits.photoWidth) > 0) resolved.photoWidth = Number(customLimits.photoWidth);
            if (Number(customLimits.photoHeight) > 0) resolved.photoHeight = Number(customLimits.photoHeight);
        }
        if (Number(input.maxKb) > 0) resolved.maxSizeKB = Number(input.maxKb);
        if (Number(input.maxPhotoKb) > 0) resolved.photoMaxKB = Number(input.maxPhotoKb);
        if (Number(input.photoWidth) > 0) resolved.photoWidth = Number(input.photoWidth);
        if (Number(input.photoHeight) > 0) resolved.photoHeight = Number(input.photoHeight);

        resolved.maxSizeBytes = resolved.maxSizeKB * 1024;
        resolved.photoMaxBytes = resolved.photoMaxKB * 1024;
        return resolved;
    }

    return PORTAL_DOCUMENT_POLICIES.TNEGA;
}

/**
 * Resolves the government portal policy for a given service or portal identifier
 * @param {string} identifier - e.g. 'TNPDS', 'ADD_MEMBER', 'NEW_RATION_CARD', 'TNEGA', 'VOTER_ID'
 * @returns {object} Portal document policy
 */
function getPortalDocumentPolicy(identifier) {
    if (!identifier) return PORTAL_DOCUMENT_POLICIES.TNPDS;
    const clean = String(identifier).trim().toUpperCase();

    if (clean.includes('TNPDS') || clean.includes('RATION') || clean.includes('NEW_CARD') || clean.includes('ADD_MEMBER') || clean.includes('REMOVE_MEMBER') || clean.includes('CHANGE_ADDRESS') || clean.includes('CHANGE_HEAD') || clean.includes('CHANGE_MOBILE') || clean === 'RESIDENCE_PROOF_TYPE' || clean === 'RESIDENCE_PROOF_DOC') {
        return PORTAL_DOCUMENT_POLICIES.TNPDS;
    }
    if (clean.includes('TNEGA') || clean.includes('INCOME') || clean.includes('COMMUNITY') || clean.includes('RESIDENCE') || clean.includes('FIRST_GRADUATE') || clean.includes('OBC') || clean.includes('WIDOW') || clean.includes('LEGAL_HEIR') || clean.includes('CAN_') || clean.includes('REV-')) {
        return PORTAL_DOCUMENT_POLICIES.TNEGA;
    }
    if (clean.includes('NVSP') || clean.includes('VOTER') || clean.includes('ECI')) {
        return PORTAL_DOCUMENT_POLICIES.NVSP;
    }
    if (clean.includes('PATTA') || clean.includes('CHITTA')) {
        return PORTAL_DOCUMENT_POLICIES.PATTA_CHITTA;
    }

    return PORTAL_DOCUMENT_POLICIES.TNPDS;
}

/**
 * Validates whether a file on disk strictly adheres to the target service/portal rules
 * @param {string} filePath - Absolute path to document on disk
 * @param {string|object} identifier - Target service ID, portal, or session
 * @returns {object} { isCompliant: boolean, error?: string, sizeKB: number }
 */
function validateDocumentAgainstPolicy(filePath, identifier) {
    if (!filePath || !fs.existsSync(filePath)) {
        return { isCompliant: false, error: 'கோப்பு கணினியில் கிடைக்கவில்லை (File does not exist).', sizeKB: 0 };
    }

    const policy = resolveServiceDocumentPolicy(identifier);
    const stats = fs.statSync(filePath);
    const sizeKB = Math.round(stats.size / 1024);
    const ext = path.extname(filePath).replace('.', '').toLowerCase();

    if (!policy.allowedFormats.includes(ext)) {
        return {
            isCompliant: false,
            error: `அனுமதிக்கப்படாத வடிவம் (.${ext}). ${policy.portalName}-க்கு ${policy.allowedFormats.join(', ')} மட்டுமே தேவை.`,
            sizeKB
        };
    }

    if (stats.size > policy.maxSizeBytes) {
        return {
            isCompliant: false,
            error: `அரசு உச்சவரம்பை (${policy.maxSizeKB} KB) விட அளவு அதிகமாக உள்ளது (${sizeKB} KB).`,
            sizeKB
        };
    }

    return {
        isCompliant: true,
        sizeKB,
        policy
    };
}

module.exports = {
    PORTAL_DOCUMENT_POLICIES,
    SERVICE_DOCUMENT_POLICIES,
    resolveServiceDocumentPolicy,
    getPortalDocumentPolicy,
    validateDocumentAgainstPolicy
};
