// =========================================================================
// eSevaDraft Desktop App — Background OTA Asset Synchronizer
// Silently fetches latest UI & automation updates without installer re-downloads
// =========================================================================
const https = require('https');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { app } = require('electron');

function getLocalFileHash(filePath) {
    try {
        if (!fs.existsSync(filePath)) return null;
        const buf = fs.readFileSync(filePath);
        return crypto.createHash('md5').update(buf).digest('hex');
    } catch (_) {
        return null;
    }
}

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, { timeout: 15000 }, (res) => {
            if (res.statusCode !== 200) {
                res.resume();
                return reject(new Error(`HTTP ${res.statusCode}`));
            }
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        });
        req.on('timeout', () => { req.destroy(); reject(new Error('Manifest request timeout')); });
        req.on('error', reject);
    });
}

function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        const tmpPath = `${destPath}.tmp_${Date.now()}`;
        const dir = path.dirname(destPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const fileStream = fs.createWriteStream(tmpPath);
        const req = https.get(url, { timeout: 25000 }, (res) => {
            if (res.statusCode !== 200) {
                res.resume();
                fileStream.close();
                try { fs.unlinkSync(tmpPath); } catch (_) {}
                return reject(new Error(`Download failed: HTTP ${res.statusCode}`));
            }
            res.pipe(fileStream);
            fileStream.on('finish', () => {
                fileStream.close(() => {
                    try {
                        fs.renameSync(tmpPath, destPath);
                        resolve(true);
                    } catch (e) {
                        try { fs.unlinkSync(tmpPath); } catch (_) {}
                        reject(e);
                    }
                });
            });
        });

        req.on('timeout', () => {
            req.destroy();
            fileStream.close();
            try { fs.unlinkSync(tmpPath); } catch (_) {}
            reject(new Error('Download timeout'));
        });
        req.on('error', (err) => {
            fileStream.close();
            try { fs.unlinkSync(tmpPath); } catch (_) {}
            reject(err);
        });
    });
}

async function syncAssetsSilently() {
    try {
        const userData = (typeof app !== 'undefined' && app.getPath) ? app.getPath('userData') : null;
        if (!userData) return;

        // Skip in local development workspace to protect active edits
        const workspaceLock = 'd:\\downloads\\ai assitant 2\\tnpds_automation.js';
        if (fs.existsSync(workspaceLock) && !app.isPackaged) {
            return;
        }

        const baseUrl = process.env.ESEVA_DEV_URL || 'https://esevadraft.in';
        let data = null;
        try {
            data = await fetchJson(`${baseUrl}/api/desktop/asset_manifest`);
        } catch (_) {
            try {
                data = await fetchJson(`${baseUrl}/asset_manifest.json`);
            } catch (__) {}
        }
        if (!data || !data.success || !data.manifest) return;

        const manifest = data.manifest;
        const targetPublicDir = path.join(userData, 'public');
        let updatedCount = 0;

        for (const [relPath, remoteHash] of Object.entries(manifest)) {
            let targetFile;
            if (relPath.startsWith('__core__/')) {
                const coreFile = relPath.replace('__core__/', '');
                targetFile = path.join(userData, coreFile);
            } else {
                targetFile = path.join(targetPublicDir, relPath);
            }

            const localHash = getLocalFileHash(targetFile);
            if (localHash !== remoteHash) {
                const assetUrl = `${baseUrl}/api/desktop/asset/${encodeURI(relPath)}`;
                try {
                    await downloadFile(assetUrl, targetFile);
                    updatedCount++;
                } catch (dlErr) {
                    if (!relPath.startsWith('__core__/')) {
                        try {
                            await downloadFile(`${baseUrl}/${encodeURI(relPath)}`, targetFile);
                            updatedCount++;
                        } catch (_) {}
                    }
                }
            }
        }

        if (updatedCount > 0) {
            console.log(`✨ [OTA Sync] Successfully updated ${updatedCount} asset(s) to latest cloud version.`);
        }
    } catch (e) {
        // Silently tolerate offline / network failure
    }
}

function startAssetSyncService() {
    // Initial check 5 seconds after startup
    setTimeout(() => {
        syncAssetsSilently();
    }, 5000);

    // Periodic check every 30 minutes
    setInterval(() => {
        syncAssetsSilently();
    }, 30 * 60 * 1000);
}

module.exports = { startAssetSyncService, syncAssetsSilently };
