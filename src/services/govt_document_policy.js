// ============================================================================
// eSevaDraft Government Document Policy Engine
// Centralized, portal-specific document compliance constraints matrix
// ============================================================================

const fs = require('fs');
const path = require('path');

const PORTAL_DOCUMENT_POLICIES = {
    TNPDS: {
        portalName: 'Tamil Nadu Public Distribution System (TNPDS)',
        maxSizeBytes: 240 * 1024, // 240 KB strict ceiling (Govt 250 KB limit)
        maxSizeKB: 240,
        allowedFormats: ['pdf', 'jpeg', 'jpg', 'png'],
        preferredFormat: 'pdf',
        dualSidedLayout: 'A4_2IN1',
        jpegQualityTarget: 84,
        allowMultiPage: true
    },
    TNEGA: {
        portalName: 'Tamil Nadu e-Governance Agency (TNeGA e-Sevai)',
        maxSizeBytes: 190 * 1024, // 190 KB strict ceiling (Govt 200 KB limit)
        maxSizeKB: 190,
        allowedFormats: ['pdf'],
        preferredFormat: 'pdf',
        dualSidedLayout: 'A4_2IN1',
        jpegQualityTarget: 82,
        allowMultiPage: false
    },
    NVSP: {
        portalName: 'National Voters Service Portal (Election Commission)',
        maxSizeBytes: 2000 * 1024, // 2 MB ceiling
        maxSizeKB: 2000,
        allowedFormats: ['jpeg', 'jpg', 'png', 'pdf'],
        preferredFormat: 'jpeg',
        dualSidedLayout: 'STANDARD',
        jpegQualityTarget: 88,
        allowMultiPage: true
    },
    PATTA_CHITTA: {
        portalName: 'Anytime Anywhere e-Services (Revenue Administration)',
        maxSizeBytes: 490 * 1024, // 500 KB ceiling
        maxSizeKB: 490,
        allowedFormats: ['pdf'],
        preferredFormat: 'pdf',
        dualSidedLayout: 'STANDARD',
        jpegQualityTarget: 85,
        allowMultiPage: true
    }
};

/**
 * Resolves the government portal policy for a given service or portal identifier
 * @param {string} identifier - e.g. 'TNPDS', 'ADD_MEMBER', 'NEW_RATION_CARD', 'TNEGA', 'VOTER_ID'
 * @returns {object} Portal document policy
 */
function getPortalDocumentPolicy(identifier) {
    if (!identifier) return PORTAL_DOCUMENT_POLICIES.TNPDS;
    const clean = String(identifier).trim().toUpperCase();

    if (clean.includes('TNPDS') || clean.includes('RATION') || clean.includes('ADD_MEMBER') || clean.includes('CHANGE_ADDRESS')) {
        return PORTAL_DOCUMENT_POLICIES.TNPDS;
    }
    if (clean.includes('TNEGA') || clean.includes('INCOME') || clean.includes('COMMUNITY') || clean.includes('RESIDENCE') || clean.includes('REV-')) {
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
 * Validates whether a file on disk strictly adheres to the target portal's rules
 * @param {string} filePath - Absolute path to document on disk
 * @param {string} identifier - Target portal or service ID
 * @returns {object} { isCompliant: boolean, error?: string, sizeKB: number }
 */
function validateDocumentAgainstPolicy(filePath, identifier) {
    if (!filePath || !fs.existsSync(filePath)) {
        return { isCompliant: false, error: 'கோப்பு கணினியில் கிடைக்கவில்லை (File does not exist).', sizeKB: 0 };
    }

    const policy = getPortalDocumentPolicy(identifier);
    const stats = fs.statSync(filePath);
    const sizeKB = Math.round(stats.size / 1024);
    const ext = path.extname(filePath).replace('.', '').toLowerCase();

    // 1. Format check
    if (!policy.allowedFormats.includes(ext)) {
        return {
            isCompliant: false,
            error: `அனுமதிக்கப்படாத வடிவம் (.${ext}). ${policy.portalName}-க்கு ${policy.allowedFormats.join(', ')} மட்டுமே தேவை.`,
            sizeKB
        };
    }

    // 2. File size ceiling check
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
    getPortalDocumentPolicy,
    validateDocumentAgainstPolicy
};
