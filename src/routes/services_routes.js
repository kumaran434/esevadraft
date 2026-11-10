const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const { getAllServices, evaluateServiceChecklist } = require('../core/services_registry');
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

// 2. GET /api/desktop/asset/:name
router.get('/api/desktop/asset/:name', (req, res) => {
    const allowed = ['tnpds_automation.js', 'govt_automation_core.js', 'photo_studio.js', 'tn_district_mapper.js'];
    const assetName = req.params.name;
    if (!allowed.includes(assetName)) {
        return res.status(403).send('Asset not allowed.');
    }
    const assetPath = path.join(__dirname, '..', '..', assetName);
    if (fs.existsSync(assetPath)) {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        return res.sendFile(assetPath);
    }
    return res.status(404).send('Asset not found.');
});

// 3. GET /api/services
router.get('/api/services', (req, res) => {
    res.json({ success: true, services: getAllServices() });
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
    return res.redirect('https://github.com/kumaran434/esevadraft/releases/download/v1.1.13/eSevaDraft-Desktop-Setup-1.1.13.exe');
});

// 8. GET /api/download/version - Returns latest available desktop application version info
router.get('/api/download/version', (req, res) => {
    res.json({
        success: true,
        latestVersion: '1.1.13',
        downloadUrl: '/api/download/desktop-app',
        releaseName: 'eSevaDraft Desktop Suite v1.1.13'
    });
});

module.exports = router;
