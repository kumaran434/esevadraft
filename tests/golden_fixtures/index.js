/**
 * tests/golden_fixtures/index.js
 * 
 * Central Golden Test Fixture Vault.
 * Provides immutable test profiles and document files for automated E2E testing.
 * Strictly isolated from live customer databases and desktop profile sync.
 */

const fs = require('fs');
const path = require('path');

const FIXTURES_DIR = __dirname;
const PROFILES = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'golden_profiles.json'), 'utf8'));

const DOC_PATHS = {
    headAadhaarFront: path.join(FIXTURES_DIR, 'sample_aadhaar_front.jpeg'),
    headAadhaarBack: path.join(FIXTURES_DIR, 'sample_aadhaar_back.jpeg'),
    profilePhoto: path.join(FIXTURES_DIR, 'sample_passport_photo.jpeg'),
    gasBook: path.join(FIXTURES_DIR, 'sample_gasbook.jpeg'),
    residenceProof: path.join(FIXTURES_DIR, 'sample_gasbook.jpeg'),
    communityProof: path.join(FIXTURES_DIR, 'sample_patta_community.jpeg')
};

function getGoldenProfile(personaKey) {
    if (!PROFILES[personaKey]) {
        throw new Error(`Golden persona "${personaKey}" not found in golden_profiles.json`);
    }
    return JSON.parse(JSON.stringify(PROFILES[personaKey]));
}

function getGoldenDocumentPath(docType) {
    const p = DOC_PATHS[docType];
    if (!p || !fs.existsSync(p)) {
        throw new Error(`Golden document fixture for "${docType}" not found at ${p}`);
    }
    return p;
}

function getGoldenDocumentBuffer(docType) {
    return fs.readFileSync(getGoldenDocumentPath(docType));
}

module.exports = {
    getGoldenProfile,
    getGoldenDocumentPath,
    getGoldenDocumentBuffer,
    PROFILES,
    DOC_PATHS
};
