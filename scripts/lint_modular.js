// ============================================================================
// eSevaDraft Zero-Monolith Modular Code Guard (< 300 Lines Law)
// Audits modular subfiles to prevent monolithic bloat in src/
// Usage: node scripts/lint_modular.js
// ============================================================================

const fs = require('fs');
const path = require('path');

const MAX_LINES = 300;
const SRC_DIR = path.join(process.cwd(), 'src');

// Exempt existing historical core orchestrators from previous phases if locked
const EXEMPT_FILES = new Set(['chat_fsm.js', 'services_registry.js']);

console.log('📏 ============================================================');
console.log('📏 E-SEVADRAFT ZERO-MONOLITH MODULAR CODE GUARD (<300 LINES)');
console.log('📏 ============================================================');

let scanned = 0;
let violations = 0;

function scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const ent of entries) {
        const fullPath = path.join(dir, ent.name);
        if (ent.isDirectory()) {
            scanDir(fullPath);
        } else if (ent.isFile() && ent.name.endsWith('.js')) {
            if (EXEMPT_FILES.has(ent.name)) continue;

            scanned++;
            const content = fs.readFileSync(fullPath, 'utf8');
            const lines = content.split('\n').length;
            const relPath = path.relative(process.cwd(), fullPath);

            if (lines > MAX_LINES) {
                console.warn(`  ⚠️ VIOLATION: ${relPath} (${lines} lines > ${MAX_LINES} limit)`);
                violations++;
            } else {
                console.log(`  ✅ OK (${lines.toString().padStart(3, ' ')} lines): ${relPath}`);
            }
        }
    }
}

scanDir(SRC_DIR);

console.log('📏 ============================================================');
if (violations === 0) {
    console.log(`🎉 PERFECT SCORE: All ${scanned} modular files adhere to the < ${MAX_LINES} lines policy!`);
} else {
    console.warn(`⚠️ NOTICE: ${violations} files exceed ${MAX_LINES} lines. Please split into smaller modules.`);
}
console.log('📏 ============================================================');
