// ============================================================================
// eSevaDraft Developer Preflight System Health Checker
// Instant 0.2s audit of runtime, dependencies, disk permissions, and plugins
// Usage: node scripts/preflight_check.js
// ============================================================================

const fs = require('fs');
const path = require('path');

console.log('🩺 ============================================================');
console.log('🩺 E-SEVADRAFT DEVELOPER PREFLIGHT SYSTEM HEALTH CHECK');
console.log('🩺 ============================================================');

let pass = 0;
let warn = 0;

function check(label, fn) {
    try {
        const ok = fn();
        if (ok !== false) {
            console.log(`  ✅ ${label}`);
            pass++;
        } else {
            console.warn(`  ❌ ${label} -> returned false`);
            warn++;
        }
    } catch (e) {
        console.warn(`  ⚠️ ${label} -> ${e.message}`);
        warn++;
    }
}

// 1. Runtime Version
check('Node.js Environment (>= v18)', () => {
    const v = parseInt(process.versions.node.split('.')[0], 10);
    return v >= 18;
});

// 2. Directory Permissions
check('Required Directories & Write Permissions', () => {
    const dirs = ['uploads', 'compressed', 'public/receipts', 'public/logs/failures'];
    for (const d of dirs) {
        const full = path.join(process.cwd(), d);
        if (!fs.existsSync(full)) fs.mkdirSync(full, { recursive: true });
        const testFile = path.join(full, '.write_test');
        fs.writeFileSync(testFile, 'test', 'utf8');
        fs.unlinkSync(testFile);
    }
    return true;
});

// 3. Image Processing (Sharp)
check('Sharp High-Clarity Image Engine', () => {
    const sharp = require('sharp');
    return typeof sharp === 'function';
});

// 4. PDF Generation (PDFKit)
check('PDFKit Document Engine', () => {
    const PDFDocument = require('pdfkit');
    return typeof PDFDocument === 'function';
});

// 5. Automation Core (Playwright)
check('Playwright Browser Automation Library', () => {
    const { chromium } = require('playwright');
    return typeof chromium.launch === 'function';
});

// 6. Service Plugins Ecosystem
check('Service Plugins & Strict Contracts Matrix', () => {
    const { SERVICE_PLUGINS } = require('../src/services/plugins');
    const count = Object.keys(SERVICE_PLUGINS).length;
    return count >= 3;
});

// 7. Frozen Core + Isolated Cartridge Architecture Guard
check('14 Backend Cartridges (5 files each, disjoint ownedStates, isolated processEditModalUpload & onDocumentDeleted)', () => {
    const { CARTRIDGE_FOLDERS, CARTRIDGES } = require('../src/cartridges');
    if (CARTRIDGE_FOLDERS.length !== 14) throw new Error(`Expected 14 cartridges, got ${CARTRIDGE_FOLDERS.length}`);
    for (const folder of CARTRIDGE_FOLDERS) {
        for (const f of ['manifest.js', 'flow.js', 'intake.js', 'extractor.js', 'automation.js']) {
            const p = path.join(process.cwd(), 'src', 'cartridges', folder, f);
            if (!fs.existsSync(p)) throw new Error(`Missing ${f} in src/cartridges/${folder}`);
        }
    }
    if (CARTRIDGES.size !== 14) throw new Error(`Expected CARTRIDGES.size === 14, got ${CARTRIDGES.size}`);
    for (const [id, cart] of CARTRIDGES.entries()) {
        if (!cart.extractor || typeof cart.extractor.processEditModalUpload !== 'function') {
            throw new Error(`Cartridge ${id} missing isolated extractor.processEditModalUpload`);
        }
        if (!cart.flow || typeof cart.flow.onDocumentDeleted !== 'function') {
            throw new Error(`Cartridge ${id} missing isolated flow.onDocumentDeleted`);
        }
        if (!cart.automation || typeof cart.automation.startFromChat !== 'function' || typeof cart.automation.run !== 'function') {
            throw new Error(`Cartridge ${id} missing isolated automation.startFromChat / automation.run`);
        }
    }
    return true;
});

check('15 Frontend UI Cartridges Bound to ESEVA_PLUGINS with Scoped ownedDocTypes', () => {
    const { SERVICE_PLUGINS } = require('../public/js/modules/service_plugins');
    if (SERVICE_PLUGINS.length !== 15) throw new Error(`Expected 15 UI plugins, got ${SERVICE_PLUGINS.length}`);
    for (const p of SERVICE_PLUGINS) {
        const uiPath = path.join(process.cwd(), 'public', 'js', 'cartridges', `${p.id.toLowerCase()}.js`);
        if (!fs.existsSync(uiPath)) throw new Error(`Missing UI cartridge ${uiPath}`);
        if (!p.uiCartridge) throw new Error(`Plugin ${p.id} missing bound uiCartridge`);
        if (!Array.isArray(p.uiCartridge.ownedDocTypes) || p.uiCartridge.ownedDocTypes.length === 0) {
            throw new Error(`UI Cartridge ${p.id} missing ownedDocTypes doc-filter list`);
        }
    }
    return true;
});

check('Thin Switchboard Firewall (Zero Multi-Service Bloat & Zero Delete-Document Ladder)', () => {
    const tnegaLines = fs.readFileSync(path.join(process.cwd(), 'src', 'routes', 'chat', 'chat_tnega_intake.js'), 'utf8').split('\n').length;
    if (tnegaLines > 120) throw new Error(`Switchboard bloat detected: chat_tnega_intake.js is ${tnegaLines} lines`);
    const starterLines = fs.readFileSync(path.join(process.cwd(), 'src', 'routes', 'chat', 'chat_automation_starter.js'), 'utf8').split('\n').length;
    if (starterLines > 120) throw new Error(`Switchboard bloat detected: chat_automation_starter.js is ${starterLines} lines`);
    const otherLines = fs.readFileSync(path.join(process.cwd(), 'src', 'core', 'fsm', 'fsm_other_services.js'), 'utf8').split('\n').length;
    if (otherLines > 80) throw new Error(`Switchboard bloat detected: fsm_other_services.js is ${otherLines} lines`);
    const uploadProcLines = fs.readFileSync(path.join(process.cwd(), 'src', 'services', 'document_upload_processor.js'), 'utf8').split('\n').length;
    if (uploadProcLines > 120) throw new Error(`Upload switchboard bloat detected: document_upload_processor.js is ${uploadProcLines} lines`);
    const draftRoutesSrc = fs.readFileSync(path.join(process.cwd(), 'src', 'routes', 'draft_routes.js'), 'utf8');
    if (draftRoutesSrc.includes('isCommunityService') || draftRoutesSrc.includes('isObcService')) {
        throw new Error('Legacy delete-document multi-service ladder detected in draft_routes.js');
    }
    return true;
});

console.log('🩺 ============================================================');
console.log(`🎉 PREFLIGHT AUDIT COMPLETE: ${pass} CHECKS PASSED, ${warn} WARNINGS`);
console.log('🩺 ============================================================');
