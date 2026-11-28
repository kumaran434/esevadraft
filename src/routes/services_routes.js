const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const { getAllServices, evaluateServiceChecklist } = require('../core/services_registry');
const { listCartridges, getCartridgeById } = require('../cartridges');
const storageService = require('../services/storage_service');
const { sessions, getActiveMobile } = storageService;
const { getCitizenDraft } = require('../../firestore_db');
const { getAllCitizensSummary } = require('../../database');

// 1. GET /api/desktop/engine
router.get('/api/desktop/engine', (req, res) => {
    const enginePath = path.join(__dirname, '..', '..', 'tnpds_automation.js');
    if (fs.existsSync(enginePath)) {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        return res.sendFile(enginePath);
    }
    return res.status(404).send('Engine file not found.');
});

// (Note: /api/desktop/asset/* is served cleanly by desktop_asset_routes.js)

// 3. GET /api/services
router.get('/api/services', (req, res) => {
    res.json({
        success: true,
        services: getAllServices(),
        cartridges: listCartridges().map(c => ({
            id: c.id,
            portal: c.portal,
            subService: c.subService,
            code: c.code,
            folder: c.folder,
            ownedStates: c.manifest?.ownedStates || [],
            schema: c.manifest?.schema || null
        }))
    });
});

// 3b. GET /api/cartridges & GET /api/cartridges/:cartridgeId
router.get('/api/cartridges', (req, res) => {
    res.json({
        success: true,
        cartridges: listCartridges().map(c => ({
            id: c.id,
            portal: c.portal,
            subService: c.subService,
            code: c.code,
            folder: c.folder,
            manifest: c.manifest
        }))
    });
});

router.get('/api/cartridges/:cartridgeId', (req, res) => {
    const c = getCartridgeById(req.params.cartridgeId);
    if (!c) return res.status(404).json({ success: false, error: 'Cartridge not found' });
    res.json({
        success: true,
        cartridge: {
            id: c.id,
            portal: c.portal,
            subService: c.subService,
            code: c.code,
            folder: c.folder,
            manifest: c.manifest
        }
    });
});

// 4. GET /api/services/:serviceId/checklist
router.get('/api/services/:serviceId/checklist', async (req, res) => {
    const serviceId = req.params.serviceId;
    const targetMobile = req.query.mobileNumber || req.headers['x-session-mobile'] || getActiveMobile();
    let profile = {};
    let b64Docs = {};

    if (targetMobile) {
        const cleanMob = String(targetMobile).trim();
        const sess = sessions.get(cleanMob);
        if (sess && sess.citizenProfile) {
            profile = sess.citizenProfile;
            b64Docs = sess.draftData?.base64Docs || {};
        } else {
            const draft = await getCitizenDraft(cleanMob);
            if (draft) {
                profile = draft.citizenProfile || draft;
                b64Docs = draft.base64Docs || {};
            }
        }
    }

    const checklist = evaluateServiceChecklist(serviceId, profile, b64Docs);
    res.json({ success: true, checklist });
});

// 5. GET /api/counter/qr-data
router.get('/api/counter/qr-data', (req, res) => {
    const opUid = req.query.operatorUid || req.headers['x-operator-uid'] || 'counter_desk';
    const host = req.get('host') || 'esevadraft.in';
    const proto = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const intakeUrl = `${proto}://${host}/?counter=${encodeURIComponent(opUid)}&mode=walkin`;
    res.json({
        success: true,
        intakeUrl,
        operatorUid: opUid,
        qrApiUrl: `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(intakeUrl)}`
    });
});

// 6. GET /api/admin/stats
router.get('/api/admin/stats', (req, res) => {
    const stats = getAllCitizensSummary();
    const sessionsArr = Array.from(sessions.entries()).map(([mobile, s]) => ({
        mobile,
        name: s.citizenProfile?.fullNameTam || s.citizenProfile?.fullNameEng || '—',
        state: s.intakeState,
        members: s.citizenProfile?.members?.length || 0,
        appNo: s.applicationNumber || null,
        lastChat: s.chatHistory?.length || 0
    }));
    res.json({
        success: true,
        stats: {
            ...stats,
            systemHealth: 'ONLINE (24/7)',
            uptime: Math.round(process.uptime()),
            todayRevenue: stats.totalApplicationsSubmitted * 50,
            activeMobile: getActiveMobile(),
            activeSessions: sessions.size,
            sessionDetails: sessionsArr
        }
    });
});

// 7. GET /api/download/desktop-app
router.get('/api/download/desktop-app', (req, res) => {
    const distDir = path.join(__dirname, '..', '..', 'desktop', 'dist');
    if (fs.existsSync(distDir)) {
        const files = fs.readdirSync(distDir).filter(f => f.endsWith('.exe') && !f.toLowerCase().includes('elevate') && !f.toLowerCase().includes('uninstall'));
        if (files.length > 0) {
            function parseVersion(filename) {
                const match = filename.match(/(\d+)\.(\d+)\.(\d+)/);
                if (match) return parseInt(match[1]) * 10000 + parseInt(match[2]) * 100 + parseInt(match[3]);
                return 0;
            }
            files.sort((a, b) => {
                const verA = parseVersion(a);
                const verB = parseVersion(b);
                if (verA !== verB) return verB - verA; // Highest version first
                return fs.statSync(path.join(distDir, b)).mtimeMs - fs.statSync(path.join(distDir, a)).mtimeMs;
            });
            const latestExe = files[0];
            return res.download(path.join(distDir, latestExe), latestExe);
        }
    }
    let latestVer = '1.1.58';
    try { latestVer = require('../../package.json').version || '1.1.58'; } catch (_) {}
    return res.redirect(`https://github.com/kumaran434/esevadraft/releases/download/v${latestVer}/eSevaDraft-Desktop-Setup-${latestVer}.exe`);
});

// 8. GET /api/download/version - Returns latest available desktop application version info
router.get('/api/download/version', (req, res) => {
    let latestVer = '1.1.58';
    try { latestVer = require('../../package.json').version || '1.1.58'; } catch (_) {}
    res.json({
        success: true,
        latestVersion: latestVer,
        downloadUrl: '/api/download/desktop-app',
        releaseName: `eSevaDraft Desktop Suite v${latestVer}`
    });
});

// 9. Shared Cloud AI Auto-Learning Memory Endpoints (Zero PII: only TN villages, initials & common street spellings)
router.get('/api/learning/memory', async (req, res) => {
    try {
        const aiMem = require('../services/ai_correction_memory');
        const memory = await aiMem.syncMemoryFromCloudIfStale(false);
        return res.json({ success: true, memory });
    } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
    }
});

router.post('/api/learning/memory', async (req, res) => {
    try {
        const aiMem = require('../services/ai_correction_memory');
        const payload = req.body || {};
        const merged = aiMem.applyIncomingCloudRelayUpdate(payload);
        return res.json({ success: true, counts: {
            villages: Object.keys(merged.villageToTaluk || {}).length,
            initials: Object.keys(merged.initialMap || {}).length
        } });
    } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
    }
});

module.exports = router;
