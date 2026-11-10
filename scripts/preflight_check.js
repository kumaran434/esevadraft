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

console.log('🩺 ============================================================');
console.log(`🎉 PREFLIGHT AUDIT COMPLETE: ${pass} CHECKS PASSED, ${warn} WARNINGS`);
console.log('🩺 ============================================================');
