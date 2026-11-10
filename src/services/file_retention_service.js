// =========================================================================
// eSevaDraft File Retention & Disk Hygiene Engine
// Automatically purges orphaned temp files older than 7 days to prevent disk bloat
// =========================================================================
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');
const COMPRESSED_DIR = path.join(ROOT_DIR, 'compressed');
const LOCAL_DRAFTS_DIR = path.join(ROOT_DIR, 'data', 'drafts');
const APPDATA_DRAFTS_DIR = path.join(process.env.APPDATA || 'C:\\Users\\ADMIN\\AppData\\Roaming', 'esevadraft-desktop', 'data', 'drafts');

function collectReferencedFilePaths() {
    const activePaths = new Set();
    const scanDirs = [LOCAL_DRAFTS_DIR, APPDATA_DRAFTS_DIR];

    for (const d of scanDirs) {
        if (!fs.existsSync(d)) continue;
        try {
            const files = fs.readdirSync(d).filter(f => f.endsWith('.json'));
            for (const f of files) {
                try {
                    const content = fs.readFileSync(path.join(d, f), 'utf8');
                    // Find all filenames or paths referenced in JSON
                    const matches = content.match(/[A-Za-z0-9_-]+\.(jpg|jpeg|png|pdf)/gi) || [];
                    for (const m of matches) activePaths.add(m.toLowerCase());
                } catch (_) {}
            }
        } catch (_) {}
    }
    return activePaths;
}

function cleanOldTempFiles(opts = {}) {
    const maxAgeDays = opts.maxAgeDays || 7;
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const referencedFiles = collectReferencedFilePaths();
    let cleanedCount = 0;
    let reclaimedBytes = 0;

    const targetDirs = [UPLOADS_DIR, COMPRESSED_DIR];

    for (const dir of targetDirs) {
        if (!fs.existsSync(dir)) continue;
        try {
            const files = fs.readdirSync(dir);
            for (const file of files) {
                const lower = file.toLowerCase();
                // Never delete test fixtures or active referenced documents
                if (lower.startsWith('test_') || lower.startsWith('sample') || referencedFiles.has(lower)) {
                    continue;
                }
                const fullPath = path.join(dir, file);
                try {
                    const stat = fs.statSync(fullPath);
                    if (stat.isFile() && (now - stat.mtimeMs > maxAgeMs)) {
                        reclaimedBytes += stat.size;
                        fs.unlinkSync(fullPath);
                        cleanedCount++;
                    }
                } catch (_) {}
            }
        } catch (_) {}
    }

    if (cleanedCount > 0) {
        console.log(`🧹 [Disk Hygiene] Cleaned ${cleanedCount} orphaned temp files (> ${maxAgeDays} days old). Reclaimed ${(reclaimedBytes / (1024 * 1024)).toFixed(2)} MB.`);
    }

    return { cleanedCount, reclaimedMB: (reclaimedBytes / (1024 * 1024)).toFixed(2) };
}

// Auto-run non-blocking on startup after 5 seconds
setTimeout(() => {
    try { cleanOldTempFiles({ maxAgeDays: 7 }); } catch (_) {}
}, 5000);

module.exports = { cleanOldTempFiles, collectReferencedFilePaths };
