/**
 * eSevaDraft - Desktop Asset Manifest & Live Synchronization API
 * Allows installed Desktop Apps to check for updated UI and engine files.
 */
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

function getFileHash(filePath) {
    try {
        const buf = fs.readFileSync(filePath);
        return crypto.createHash('md5').update(buf).digest('hex');
    } catch (_) {
        return null;
    }
}

// 1. GET /api/desktop/asset_manifest
router.get('/api/desktop/asset_manifest', (req, res) => {
    try {
        const publicDir = path.join(__dirname, '..', '..', 'public');
        const manifest = {};

        function scan(dir, base = '') {
            if (!fs.existsSync(dir)) return;
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const ent of entries) {
                const full = path.join(dir, ent.name);
                const rel = base ? `${base}/${ent.name}` : ent.name;
                if (ent.isDirectory()) {
                    if (['node_modules', '.git', 'previews', 'receipts', 'recordings'].includes(ent.name)) continue;
                    scan(full, rel);
                } else if (ent.isFile()) {
                    if (/\.(js|css|html|json|png|svg)$/.test(ent.name)) {
                        manifest[rel] = getFileHash(full);
                    }
                }
            }
        }

        scan(publicDir);
        // Include core automation files
        const coreFiles = ['tnpds_automation.js', 'govt_automation_core.js', 'photo_studio.js', 'tn_district_mapper.js'];
        coreFiles.forEach(f => {
            const full = path.join(__dirname, '..', '..', f);
            if (fs.existsSync(full)) manifest[`__core__/${f}`] = getFileHash(full);
        });

        res.json({ success: true, timestamp: Date.now(), manifest });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 2. GET /api/desktop/asset/*
router.use('/api/desktop/asset', (req, res) => {
    try {
        const reqPath = (req.path || '').replace(/^\//, '');
        if (!reqPath || reqPath.includes('..')) return res.status(400).send('Invalid path');

        if (reqPath.startsWith('__core__/')) {
            const coreFile = reqPath.replace('__core__/', '');
            const safeCore = ['tnpds_automation.js', 'govt_automation_core.js', 'photo_studio.js', 'tn_district_mapper.js'];
            if (!safeCore.includes(coreFile)) return res.status(403).send('Forbidden');
            const target = path.join(__dirname, '..', '..', coreFile);
            return res.sendFile(target);
        }

        const target = path.join(__dirname, '..', '..', 'public', reqPath);
        if (fs.existsSync(target)) {
            return res.sendFile(target);
        }
        res.status(404).send('Not found');
    } catch (e) {
        res.status(500).send(e.message);
    }
});

module.exports = router;
