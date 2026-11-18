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

// =========================================================================
// FOUNDER-ONLY GOLDEN SAMPLE GALLERY (STRICTLY LOCKED TO FOUNDER PC & UID)
// Never exposed to external franchise operators, citizens, or production hosts.
// =========================================================================
const FOUNDER_UIDS = new Set(['z9tsoaph0hh69du0xpk2gdxk2kr2', 'local_op_dev']);
const FOUNDER_GOLDEN_ROOT = path.resolve('d:\\downloads\\ai assitant 2\\data\\golden_samples');
const KUMARAN_GALLERY_DIR = path.join(FOUNDER_GOLDEN_ROOT, 'kumaran_gallery');

const GALLERY_ITEM_METADATA = {
    '01_kumaran_passport_photo.jpg': {
        title: 'விண்ணப்பதாரர் பாஸ்போர்ட் புகைப்படம் (<250px)',
        titleEng: 'Kumaran Passport Photo (<250x250px)',
        category: 'IDENTITY',
        badge: 'Photo (All Services)',
        docType: 'profilePhoto'
    },
    '02_kumaran_aadhaar_front.jpg': {
        title: 'ஆதார் அட்டை (முன்பக்கம்)',
        titleEng: 'Kumaran Aadhaar Front',
        category: 'IDENTITY',
        badge: 'Aadhaar Front',
        docType: 'headAadhaarFront'
    },
    '03_kumaran_aadhaar_back.jpg': {
        title: 'ஆதார் அட்டை (பின்பக்கம்)',
        titleEng: 'Kumaran Aadhaar Back',
        category: 'IDENTITY',
        badge: 'Aadhaar Back',
        docType: 'headAadhaarBack'
    },
    '04_kumaran_aadhaar_2in1.jpg': {
        title: 'ஆதார் அட்டை (2-in-1 முழு நகல்)',
        titleEng: 'Kumaran Aadhaar 2-in-1',
        category: 'IDENTITY',
        badge: 'Address / Aadhaar',
        docType: 'headAadhaar'
    },
    '05_community_certificate_kumaran.jpg': {
        title: 'சாதிச் சான்றிதழ் (வன்னியர் / MBC)',
        titleEng: 'Community Certificate (REV-101 / OBC)',
        category: 'COMMUNITY',
        badge: 'Community / OBC',
        docType: 'communityCertificate'
    },
    '06_income_payslip_kumaran.jpg': {
        title: 'சம்பளச் சான்று / வருமான ஆதாரம்',
        titleEng: 'Payslip / Income Proof (REV-103)',
        category: 'INCOME',
        badge: 'Income REV-103',
        docType: 'incomeProof'
    },
    '07_obc_income_tax_return_kumaran.jpg': {
        title: 'வருமான வரி / ITR சான்று (Non-Creamy Layer)',
        titleEng: 'ITR / Income Statement (OBC REV-115)',
        category: 'OBC',
        badge: 'OBC REV-115',
        docType: 'incomeTaxReturn'
    },
    '08_residence_eb_bill_kumaran.jpg': {
        title: 'மின் கட்டண ரசீது / இருப்பிட ஆதாரம்',
        titleEng: 'TANGEDCO EB Bill (Residence REV-102)',
        category: 'RESIDENCE',
        badge: 'Residence / Ration',
        docType: 'residenceProof'
    },
    '09_family_smart_ration_card_kumaran.jpg': {
        title: 'குடும்ப ஸ்மார்ட் ரேஷன் கார்டு',
        titleEng: 'Family Smart Ration Card (REV-104)',
        category: 'FIRST_GRADUATE',
        badge: 'Smart Card REV-104',
        docType: 'smartCard'
    },
    '10_fg_student_12th_tc_kumaran.jpg': {
        title: 'மாணவர் 12-ஆம் வகுப்பு TC',
        titleEng: 'Student 12th TC (First Grad REV-104)',
        category: 'FIRST_GRADUATE',
        badge: 'First Grad REV-104',
        docType: 'applicantEducationProof'
    },
    '11_fg_father_tc_kirubakaran.jpg': {
        title: 'தந்தை பள்ளி மாற்றுச் சான்றிதழ் (10th TC)',
        titleEng: 'Father School TC (First Grad REV-104)',
        category: 'FIRST_GRADUATE',
        badge: 'First Grad REV-104',
        docType: 'fatherEducationProof'
    },
    '12_fg_mother_tc_devaki.jpg': {
        title: 'தாய் பள்ளி மாற்றுச் சான்றிதழ் (8th TC)',
        titleEng: 'Mother School TC (First Grad REV-104)',
        category: 'FIRST_GRADUATE',
        badge: 'First Grad REV-104',
        docType: 'motherEducationProof'
    },
    '13_gas_book_indane_kumaran.jpg': {
        title: 'Indane எரிவாயு நுகர்வோர் புத்தகம்',
        titleEng: 'Indane Gas Book (New Ration Card)',
        category: 'RATION',
        badge: 'Ration Card',
        docType: 'gasBook'
    }
};

function isFounderGalleryAuthorized(req) {
    try {
        const ip = String(req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress || '').toLowerCase();
        const host = String(req.headers?.host || '').toLowerCase();
        const isLoopback = ip.includes('127.0.0.1') || ip === '::1' || ip === '' || host.startsWith('127.0.0.1:') || host.startsWith('localhost:');
        if (!isLoopback) return false;

        const opUid = String(req.headers['x-operator-uid'] || req.query?.uid || '').trim().toLowerCase();
        if (!FOUNDER_UIDS.has(opUid)) return false;

        if (!fs.existsSync(FOUNDER_GOLDEN_ROOT)) return false;
        return true;
    } catch (_) {
        return false;
    }
}

function scanGoldenGalleryItems(opUid) {
    const items = [];
    const seenRel = new Set();
    const scanDir = (dirPath, folderLabel) => {
        if (!fs.existsSync(dirPath)) return;
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const ent of entries) {
            const full = path.join(dirPath, ent.name);
            if (ent.isDirectory()) {
                scanDir(full, ent.name);
                continue;
            }
            if (!/\.(jpg|jpeg|png|webp|pdf)$/i.test(ent.name)) continue;
            const rel = path.relative(FOUNDER_GOLDEN_ROOT, full).replace(/\\/g, '/');
            if (seenRel.has(rel)) continue;
            seenRel.add(rel);
            const stat = fs.statSync(full);
            const meta = GALLERY_ITEM_METADATA[ent.name] || {
                title: ent.name.replace(/[_-]+/g, ' ').replace(/\.\w+$/, ''),
                titleEng: ent.name,
                category: String(folderLabel || 'OTHER').toUpperCase(),
                badge: folderLabel || 'Sample',
                docType: ent.name.toLowerCase().includes('photo') ? 'profilePhoto' :
                         (ent.name.toLowerCase().includes('aadhaar') ? 'headAadhaar' :
                         (ent.name.toLowerCase().includes('community') ? 'communityCertificate' :
                         (ent.name.toLowerCase().includes('income_tax') || ent.name.toLowerCase().includes('itr') ? 'incomeTaxReturn' :
                         (ent.name.toLowerCase().includes('income') || ent.name.toLowerCase().includes('salary') ? 'incomeProof' : 'other'))))
            };
            items.push({
                id: rel,
                fileName: ent.name,
                relPath: rel,
                folder: folderLabel,
                sizeKB: Math.max(1, Math.round(stat.size / 1024)),
                isPdf: ent.name.toLowerCase().endsWith('.pdf'),
                title: meta.title,
                titleEng: meta.titleEng,
                category: meta.category,
                badge: meta.badge,
                docType: meta.docType,
                previewUrl: `/api/dev/golden-gallery/file?rel=${encodeURIComponent(rel)}&uid=${encodeURIComponent(opUid)}`
            });
        }
    };

    scanDir(KUMARAN_GALLERY_DIR, 'kumaran_gallery');
    const topEntries = fs.readdirSync(FOUNDER_GOLDEN_ROOT, { withFileTypes: true });
    for (const ent of topEntries) {
        if (ent.isDirectory() && ent.name !== 'kumaran_gallery') {
            scanDir(path.join(FOUNDER_GOLDEN_ROOT, ent.name), ent.name);
        }
    }
    return items;
}

// 9. GET /api/dev/golden-gallery
router.get('/api/dev/golden-gallery', (req, res) => {
    if (!isFounderGalleryAuthorized(req)) {
        return res.status(403).json({ success: false, enabled: false, items: [] });
    }
    const opUid = String(req.headers['x-operator-uid'] || req.query?.uid || '').trim();
    const items = scanGoldenGalleryItems(opUid);
    res.json({
        success: true,
        enabled: true,
        folderPath: KUMARAN_GALLERY_DIR,
        rootPath: FOUNDER_GOLDEN_ROOT,
        items
    });
});

// 10. GET /api/dev/golden-gallery/file
router.get('/api/dev/golden-gallery/file', (req, res) => {
    if (!isFounderGalleryAuthorized(req)) {
        return res.status(403).json({ error: 'Access denied' });
    }
    const rel = String(req.query.rel || '');
    const resolved = path.resolve(FOUNDER_GOLDEN_ROOT, rel);
    if (!resolved.startsWith(FOUNDER_GOLDEN_ROOT) || !fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
        return res.status(404).json({ error: 'Sample file not found' });
    }
    return res.sendFile(resolved);
});

// 11. POST /api/dev/golden-gallery/open-folder
router.post('/api/dev/golden-gallery/open-folder', (req, res) => {
    if (!isFounderGalleryAuthorized(req)) {
        return res.status(403).json({ success: false, error: 'Access denied' });
    }
    try {
        const target = fs.existsSync(KUMARAN_GALLERY_DIR) ? KUMARAN_GALLERY_DIR : FOUNDER_GOLDEN_ROOT;
        require('child_process').spawn('explorer.exe', [target], { detached: true, stdio: 'ignore' }).unref();
        return res.json({ success: true, folderPath: target });
    } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
    }
});

module.exports = router;
