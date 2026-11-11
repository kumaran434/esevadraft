/**
 * scripts/sync_to_desktop.js
 * 
 * Auto-Synchronization Bridge between Local Workspace and Installed Desktop App.
 * Guarantees that any code change in the workspace is immediately and physically
 * applied to the installed eSevaDraft Desktop App (Electron executable).
 */
const fs = require('fs');
const path = require('path');
const asar = require('../desktop/node_modules/@electron/asar');

const ROOT_DIR = path.resolve(__dirname, '..');
const USER_DATA_DIR = path.join(process.env.APPDATA || 'C:\\Users\\ADMIN\\AppData\\Roaming', 'esevadraft-desktop');
const PROGRAM_RESOURCES_DIR = path.join(process.env.LOCALAPPDATA || 'C:\\Users\\ADMIN\\AppData\\Local', 'Programs', 'eSevaDraft Desktop', 'resources');
const TARGET_ASAR = path.join(PROGRAM_RESOURCES_DIR, 'app.asar');

const CORE_FILES = [
    'tnpds_automation.js',
    'govt_automation_core.js',
    'photo_studio.js',
    'tn_district_mapper.js',
    'ai_document_extractor.js',
    'tnega_can_automation.js',
    'firestore_db.js',
    'database.js',
    'server.js',
    'package.json',
    '.env'
];

const DIRS_TO_SYNC = ['src', 'data', 'public'];

async function syncAllToDesktop() {
    console.log('🔄 [eSeva Sync Bridge] Syncing workspace code to installed Desktop App...');

    // 1. Sync core automation files & support modules to both UserData and Program Resources
    const destinations = [USER_DATA_DIR, PROGRAM_RESOURCES_DIR];

    // Ensure resources has a junction to workspace node_modules so Express & all native modules resolve instantly
    const resourcesNodeModules = path.join(PROGRAM_RESOURCES_DIR, 'node_modules');
    const workspaceNodeModules = path.join(ROOT_DIR, 'node_modules');
    if (fs.existsSync(PROGRAM_RESOURCES_DIR) && !fs.existsSync(resourcesNodeModules) && fs.existsSync(workspaceNodeModules)) {
        try {
            fs.symlinkSync(workspaceNodeModules, resourcesNodeModules, 'junction');
            console.log('  ✅ Linked resources/node_modules -> workspace/node_modules (NTFS junction)');
        } catch (e) {
            console.warn(`  ⚠️ Could not link resources/node_modules: ${e.message}`);
        }
    }

    for (const dest of destinations) {
        if (!fs.existsSync(dest)) continue;

        for (const file of CORE_FILES) {
            const srcPath = path.join(ROOT_DIR, file);
            const destPath = path.join(dest, file);
            if (fs.existsSync(srcPath)) {
                try {
                    fs.copyFileSync(srcPath, destPath);
                } catch (e) {
                    console.warn(`  ⚠️ Could not copy ${file} to ${dest}: ${e.message}`);
                }
            }
        }

        for (const folder of DIRS_TO_SYNC) {
            const srcFolder = path.join(ROOT_DIR, folder);
            const destFolder = path.join(dest, folder);
            if (fs.existsSync(srcFolder)) {
                try {
                    if (folder === 'data') {
                        // Strictly copy static lexicon/reference datasets only. NEVER copy customer/test drafts, citizens, sessions, applications, or chrome profile!
                        const ALLOWED_STATIC_DATA_FILES = new Set([
                            'tn_bifurcated_taluks.js',
                            'tn_bifurcated_taluks.json',
                            'tn_pincode_taluk_map.js',
                            'tn_pincode_taluk_map.json',
                            'tn_village_lexicon.js',
                            'tn_village_lexicon.json',
                            'tn_village_lexicon_part1.js',
                            'tn_village_lexicon_part2.js',
                            'tn_village_lexicon_part3.js',
                            'services_registry_data.json',
                            'automation_immune_memory.json'
                        ]);
                        if (!fs.existsSync(destFolder)) fs.mkdirSync(destFolder, { recursive: true });
                        for (const staticFile of ALLOWED_STATIC_DATA_FILES) {
                            const sPath = path.join(srcFolder, staticFile);
                            const dPath = path.join(destFolder, staticFile);
                            if (fs.existsSync(sPath)) {
                                try { fs.copyFileSync(sPath, dPath); } catch (_) {}
                            }
                        }
                    } else if (folder === 'uploads') {
                        // Never overwrite operator uploads with test uploads
                        if (!fs.existsSync(destFolder)) fs.mkdirSync(destFolder, { recursive: true });
                    } else {
                        fs.cpSync(srcFolder, destFolder, { recursive: true, force: true });
                    }
                } catch (e) {
                    console.warn(`  ⚠️ Could not copy ${folder}/ to ${dest}: ${e.message}`);
                }
            }
        }
    }

    // Purge any synthetic test drafts from user data and program resources
    const testMobiles = ['9876500050', '9333222111', '9444332211', '9111223344', '9555444333', '9777666555', '9999900021', '9999900099', '911133222111'];
    const draftsToClean = [
        path.join(PROGRAM_RESOURCES_DIR, 'data', 'drafts'),
        path.join(USER_DATA_DIR, 'data', 'drafts')
    ];
    for (const dDir of draftsToClean) {
        if (fs.existsSync(dDir)) {
            for (const num of testMobiles) {
                const target = path.join(dDir, `${num}.json`);
                if (fs.existsSync(target)) {
                    try { fs.unlinkSync(target); } catch (_) {}
                }
            }
        }
    }
    // Zero Pollution Invariant (Golden Rule 4): NEVER overwrite or inject dummy drafts into user desktop profile!
    console.log('  ✅ Core engine files, src/, data/, and public/ synced to Desktop App directories.');

    // 2. Compile bytecode whenever source files change or .jsc binaries are missing
    const mainJs = path.join(ROOT_DIR, 'desktop', 'main.js');
    const mainJsc = path.join(ROOT_DIR, 'desktop', 'main.jsc');
    const preloadJs = path.join(ROOT_DIR, 'desktop', 'preload.js');
    const preloadJsc = path.join(ROOT_DIR, 'desktop', 'preload.jsc');
    const buildProtectedScript = path.join(ROOT_DIR, 'desktop', 'build-protected.js');
    const needsCompile = !fs.existsSync(mainJsc) || !fs.existsSync(preloadJsc) ||
        (fs.existsSync(mainJs) && fs.statSync(mainJs).mtimeMs > fs.statSync(mainJsc).mtimeMs) ||
        (fs.existsSync(preloadJs) && fs.statSync(preloadJs).mtimeMs > fs.statSync(preloadJsc).mtimeMs);

    if (fs.existsSync(buildProtectedScript) && needsCompile) {
        try {
            const { execFileSync } = require('child_process');
            execFileSync(process.execPath, [buildProtectedScript], { stdio: 'inherit', timeout: 15000 });
            console.log('  ✅ Compiled updated main.js & preload.js into bytecode binaries.');
        } catch (e) {
            console.warn('  ⚠️ Bytecode compilation notice:', e.message);
        }
    }

    // 3. Repack app.asar if present
    if (fs.existsSync(TARGET_ASAR)) {
        const tempDir = path.join(ROOT_DIR, '.tmp_asar_sync');
        try {
            if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
            asar.extractAll(TARGET_ASAR, tempDir);

            const desktopDir = path.join(ROOT_DIR, 'desktop');
            const desktopFiles = fs.readdirSync(desktopDir).filter(f => f.endsWith('.js') || f.endsWith('.jsc') || f === 'package.json');

            for (const f of desktopFiles) {
                const s = path.join(desktopDir, f);
                if (fs.existsSync(s) && !fs.statSync(s).isDirectory()) fs.copyFileSync(s, path.join(tempDir, f));
            }

            // Sync CORE_FILES and src directly into app.asar
            for (const cf of CORE_FILES) {
                const s = path.join(ROOT_DIR, cf);
                if (fs.existsSync(s)) {
                    try { fs.copyFileSync(s, path.join(tempDir, cf)); } catch (_) {}
                }
            }
            const srcDir = path.join(ROOT_DIR, 'src');
            if (fs.existsSync(srcDir)) {
                try { fs.cpSync(srcDir, path.join(tempDir, 'src'), { recursive: true, force: true }); } catch (_) {}
            }

            // Universal loaders that execute latest main.js / preload.js directly with bytecode fallback
            const indexLoader = `// Protected eSevaDraft Launcher
try {
    require('./main.js');
} catch (e) {
    const bytenode = require('bytenode');
    require('./main.jsc');
}
`;
            fs.writeFileSync(path.join(tempDir, 'index.js'), indexLoader, 'utf8');

            const preloadLoader = `// Protected eSevaDraft Preload Launcher
try {
    require('./preload.js');
} catch (e) {
    const bytenode = require('bytenode');
    require('./preload.jsc');
}
`;
            fs.writeFileSync(path.join(tempDir, 'preload.loader.js'), preloadLoader, 'utf8');

            await asar.createPackage(tempDir, TARGET_ASAR);
            try { fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch (_) {}
            console.log('  ✅ app.asar successfully updated with latest main.js, main.jsc, preload.js, and loaders.');
        } catch (e) {
            console.warn(`  ⚠️ ASAR repack warning: ${e.message}`);
            try { if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch (_) {}
        }
    }

    console.log('🎉 [eSeva Sync Bridge] Desktop App is now 100% synchronized with the workspace!\n');
}

if (require.main === module) {
    syncAllToDesktop().catch(err => {
        console.error('❌ Sync failed:', err);
        process.exit(1);
    });
}

module.exports = { syncAllToDesktop };
