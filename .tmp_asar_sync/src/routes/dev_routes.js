const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const { logOperatorError, listOperatorErrors } = require('../../firestore_db');

// 1. GET /dev
router.get('/dev', (req, res) => {
    res.sendFile(path.join(__dirname, '..', '..', 'public', 'dev.html'));
});

// 2. POST /api/dev/train-start
router.post('/api/dev/train-start', (req, res) => {
    const { url, serviceName } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    const safeName = (serviceName || 'service').replace(/[^a-zA-Z0-9_-]/g, '_');
    const recDir = path.join(__dirname, '..', '..', 'recordings');
    if (!fs.existsSync(recDir)) fs.mkdirSync(recDir, { recursive: true });

    const outputFile = path.join(recDir, `real_workflow_${safeName}_${Date.now()}.js`);
    console.log(`\n[Developer Studio] Launching visual Playwright trainer for: ${url}`);
    
    const cp = require('child_process');
    const proc = cp.spawn('npx.cmd', ['playwright', 'codegen', '--channel=chrome', '--output', `"${outputFile}"`, `"${url}"`], {
        shell: true,
        detached: true
    });

    proc.on('error', (err) => {
        console.error('[Developer Studio] Trainer spawn error:', err);
    });

    res.json({
        success: true,
        message: 'குரோம் பிரவுசர் திறக்கப்பட்டது. நீங்கள் முடித்ததும் பிரவுசரை மூடவும்.',
        outputFile: outputFile
    });
});

// 3. GET /api/dev/errors
router.get('/api/dev/errors', (req, res) => {
    try {
        const errors = [];
        const previewsDir = path.join(__dirname, '..', '..', 'public', 'previews');
        if (fs.existsSync(previewsDir)) {
            const files = fs.readdirSync(previewsDir).filter(f => f.endsWith('.png') || f.endsWith('.jpg'));
            files.sort((a, b) => {
                return fs.statSync(path.join(previewsDir, b)).mtimeMs - fs.statSync(path.join(previewsDir, a)).mtimeMs;
            });
            files.slice(0, 12).forEach(f => {
                const stat = fs.statSync(path.join(previewsDir, f));
                errors.push({
                    title: f,
                    imageUrl: `/previews/${f}`,
                    time: new Date(stat.mtimeMs).toLocaleString('ta-IN'),
                    message: f.includes('error') ? 'அரசு படிவ எச்சரிக்கை / பிழை படம்' : 'தானியங்கி படிவக் காட்சி'
                });
            });
        }
        res.json({ success: true, errors });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 4. POST /api/dev/test-run
router.post('/api/dev/test-run', (req, res) => {
    const cp = require('child_process');
    const scriptToRun = 'test_autonomous_engine.js';

    console.log(`[Developer Studio] Running test script: ${scriptToRun}`);
    try {
        cp.spawn('node', [scriptToRun], { shell: true, detached: true });
        res.json({
            success: true,
            message: `🚀 ${scriptToRun} சோதனை உங்கள் கம்ப்யூட்டரில் தொடங்கப்பட்டது! திரையைக் கவனிக்கவும்.`
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 5. GET /api/dev/status
router.get('/api/dev/status', (req, res) => {
    try {
        const cp = require('child_process');
        const gitBin = 'C:\\Users\\ADMIN\\AppData\\Local\\GitHubDesktop\\app-3.5.11\\resources\\app\\git\\cmd\\git.exe';
        let branch = 'main';
        let commitHash = '—';
        let isClean = true;
        let modifiedCount = 0;

        try {
            branch = cp.execSync(`"${gitBin}" rev-parse --abbrev-ref HEAD`, { encoding: 'utf8' }).trim();
            commitHash = cp.execSync(`"${gitBin}" rev-parse --short HEAD`, { encoding: 'utf8' }).trim();
            const statusOut = cp.execSync(`"${gitBin}" status --porcelain`, { encoding: 'utf8' }).trim();
            if (statusOut) {
                isClean = false;
                modifiedCount = statusOut.split('\n').filter(Boolean).length;
            }
        } catch (err) {}

        res.json({ success: true, branch, commitHash, isClean, modifiedCount });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

// 6. POST /api/dev/publish
router.post('/api/dev/publish', (req, res) => {
    const { message } = req.body;
    const cp = require('child_process');
    const gitBin = 'C:\\Users\\ADMIN\\AppData\\Local\\GitHubDesktop\\app-3.5.11\\resources\\app\\git\\cmd\\git.exe';
    const commitMsg = message || 'chore: safe publish from developer studio';

    let outputLog = '';
    try {
        outputLog += '1. Staging files (git add .)...\n';
        cp.execSync(`"${gitBin}" add .`, { stdio: 'pipe' });

        outputLog += `2. Committing changes: "${commitMsg}"...\n`;
        try {
            cp.execSync(`"${gitBin}" commit -m "${commitMsg.replace(/"/g, '')}"`, { stdio: 'pipe' });
        } catch (ce) {
            outputLog += '   (No new changes to commit)\n';
        }

        outputLog += '3. Pushing to GitHub origin main...\n';
        cp.execSync(`"${gitBin}" push origin main`, { stdio: 'pipe' });

        outputLog += '4. Deploying to Firebase Hosting (npx firebase deploy --only hosting)...\n';
        const deployOut = cp.execSync('npx.cmd -y firebase-tools deploy --only hosting', { encoding: 'utf8' });
        outputLog += deployOut + '\n';

        outputLog += '\n🎉 [SUCCESS] Live publish completed! Changes are now live on https://esevadraft.in\n';
        res.json({ success: true, output: outputLog });
    } catch (e) {
        outputLog += `\n❌ Publish Error: ${e.message}\n${e.stdout || ''}\n${e.stderr || ''}`;
        res.status(500).json({ success: false, output: outputLog });
    }
});

// 7. POST /api/telemetry/error
router.post('/api/telemetry/error', async (req, res) => {
    try {
        const payload = req.body || {};
        const logged = await logOperatorError(payload);
        res.json({ success: true, id: logged ? logged.id : null });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

// 8. GET /api/telemetry/errors
router.get('/api/telemetry/errors', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 30;
        const errors = await listOperatorErrors(limit);
        res.json({ success: true, count: errors.length, errors });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

module.exports = router;
