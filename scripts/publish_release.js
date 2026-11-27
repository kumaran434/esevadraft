/**
 * scripts/publish_release.js
 * Publishes the current desktop build to GitHub Releases WITH latest.yml and .blockmap
 * so electron-updater auto-updates work reliably across all operator PCs.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const pkg = require(path.join(rootDir, 'package.json'));
const ver = pkg.version;
const tag = `v${ver}`;
const distDir = path.join(rootDir, 'desktop', 'dist');

const exePath = path.join(distDir, `eSevaDraft-Desktop-Setup-${ver}.exe`);
const latestYmlPath = path.join(distDir, 'latest.yml');
const blockmapPath = path.join(distDir, `eSevaDraft-Desktop-Setup-${ver}.exe.blockmap`);

const assets = [exePath, latestYmlPath, blockmapPath].filter(p => fs.existsSync(p));
if (!fs.existsSync(exePath)) {
    console.error(`❌ Missing installer: ${exePath}`);
    process.exit(1);
}
if (!fs.existsSync(latestYmlPath)) {
    console.error(`❌ Missing latest.yml for electron-updater: ${latestYmlPath}`);
    process.exit(1);
}

const ghArgs = ['release', 'create', tag, ...assets, '--title', `eSevaDraft Desktop Suite ${tag}`, '--notes', `eSevaDraft Desktop Suite ${tag} (includes latest.yml & blockmap for automatic updates)`];
try {
    execFileSync('gh', ghArgs, { cwd: rootDir, stdio: 'inherit' });
} catch (_) {
    console.log(`ℹ️ Release ${tag} exists — uploading updated assets with --clobber...`);
    execFileSync('gh', ['release', 'upload', tag, ...assets, '--clobber'], { cwd: rootDir, stdio: 'inherit' });
}
console.log(`✅ Published GitHub release ${tag} with ${assets.map(a => path.basename(a)).join(', ')}`);
