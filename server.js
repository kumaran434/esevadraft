const express = require('express');
const path = require('path');
const fs = require('fs');

// Universal Multi-Location Environment Variable Loader
const OFFICIAL_PRODUCTION_GEMINI_KEY = Buffer.from('QVEuQWI4Uk42S29EYklVZUlJbnMwNGFZLXdxQ2VTTkZidFhXTWxHdzRnY3lqeUVjRnBqdHc=', 'base64').toString('utf8');
try {
    const dotenv = require('dotenv');
    const envCandidates = [
        path.join(__dirname, '.env'),
        path.join(process.env.APPDATA || '', 'esevadraft-desktop', '.env'),
        path.join(process.resourcesPath || '', '.env')
    ];
    for (const ec of envCandidates) {
        if (fs.existsSync(ec)) {
            dotenv.config({ path: ec });
        }
    }
    dotenv.config();
} catch (_) {}
if (!process.env.GEMINI_API_KEY) {
    process.env.GEMINI_API_KEY = OFFICIAL_PRODUCTION_GEMINI_KEY;
}

// Global Process Crash Immunizers
process.on('unhandledRejection', (reason) => {
    console.warn('⚠️ [Server Runtime] Caught unhandled promise rejection:', reason ? (reason.message || reason) : 'Unknown');
});
process.on('uncaughtException', (err) => {
    console.error('⚠️ [Server Runtime] Caught uncaught exception:', err ? (err.stack || err.message || err) : 'Unknown');
});

// Lazy-load provideOtp inside /api/automation/otp_webhook to keep server.js startup ultra-fast
function getProvideOtp() {
    try {
        return require('./tnpds_automation').provideOtp;
    } catch (_) {
        return () => false;
    }
}
const storageService = require('./src/services/storage_service');
const { getOrCreateSession } = storageService;

// Modular Route Handlers
const authRoutes = require('./src/routes/auth_routes');
const operatorRoutes = require('./src/routes/operator_routes');
const servicesRoutes = require('./src/routes/services_routes');
const draftRoutes = require('./src/routes/draft_routes');
const chatRoutes = require('./src/routes/chat_routes');
const profileRoutes = require('./src/routes/profile_routes');
const documentViewerRoutes = require('./src/routes/document_viewer_routes');
const ocrRoutes = require('./src/routes/ocr_routes');
const automationRoutes = require('./src/routes/automation_routes');
const tnegaRoutes = require('./src/routes/tnega_routes');
const devRoutes = require('./src/routes/dev_routes');
const desktopAssetRoutes = require('./src/routes/desktop_asset_routes');
const toolsRoutes = require('./src/routes/tools_routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Security & Parsing Middleware
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-operator-uid, x-dev-mode, x-operator-name');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Static Assets
const staticSniffOptions = {
    setHeaders: (res, filePath) => {
        try {
            const fd = fs.openSync(filePath, 'r');
            const magic = Buffer.alloc(4);
            fs.readSync(fd, magic, 0, 4, 0);
            fs.closeSync(fd);
            if (magic.toString('utf8').startsWith('%PDF')) {
                res.setHeader('Content-Type', 'application/pdf');
            }
        } catch (_) {}
    }
};

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), staticSniffOptions));
app.use('/uploads', express.static(path.join(__dirname, 'data', 'uploads'), staticSniffOptions));
app.use('/data/uploads', express.static(path.join(__dirname, 'data', 'uploads'), staticSniffOptions));
const appDataUploads = path.join(process.env.APPDATA || 'C:\\Users\\ADMIN\\AppData\\Roaming', 'esevadraft-desktop', 'data', 'uploads');
if (fs.existsSync(appDataUploads)) {
    app.use('/uploads', express.static(appDataUploads, staticSniffOptions));
    app.use('/data/uploads', express.static(appDataUploads, staticSniffOptions));
}
app.use('/compressed', express.static(path.join(__dirname, 'compressed'), staticSniffOptions));

// Directories initialization
['uploads', 'compressed', 'data'].forEach(dir => {
    const fullPath = path.join(__dirname, dir);
    if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });
});
try { require('./src/services/file_retention_service'); } catch (_) {}

// Mount Modular Router Domains
app.use(authRoutes);
app.use(operatorRoutes);
app.use(servicesRoutes);
app.use(draftRoutes);
app.use(chatRoutes);
app.use(profileRoutes);
app.use(documentViewerRoutes);
app.use(ocrRoutes);
// Automation & Logs Endpoints (including /api/automation/logs)
app.use(automationRoutes);
app.use(tnegaRoutes);
app.use(devRoutes);
app.use(desktopAssetRoutes);
app.use(toolsRoutes);

// Android SMS Auto-Forwarder Webhook & Autonomous E2E OTP Interception
app.all(['/api/automation/otp_webhook', '/api/automation/otp-webhook'], (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(200);

    try {
        const body = req.body || {};
        const query = req.query || {};
        const rawContent = body.text || body.body || body.message || body.sms || body.content || query.text || query.body || query.sms || query.content || '';
        const sender = body.from || body.sender || query.from || query.sender || 'Android SMS';

        console.log(`🔑 [OTP Webhook] Received incoming SMS from ${sender}: "${rawContent}"`);

        const otpMatch = String(rawContent).match(/\b\d{6,8}\b/);
        if (!otpMatch) {
            return res.status(400).json({
                success: false,
                message: 'No 6-8 digit OTP found in incoming payload',
                received: rawContent
            });
        }

        const otpCode = otpMatch[0];
        const provideOtp = getProvideOtp();
        const handled = provideOtp(otpCode);

        // Sync to pending_otp.txt for local Desktop Playwright engine
        const diskLocations = [
            path.join(__dirname, 'data', 'pending_otp.txt'),
            path.join(process.env.APPDATA || 'C:\\Users\\ADMIN\\AppData\\Roaming', 'esevadraft-desktop', 'data', 'pending_otp.txt'),
            path.join(process.env.APPDATA || 'C:\\Users\\ADMIN\\AppData\\Roaming', 'esevadraft-desktop', 'pending_otp.txt')
        ];
        for (const loc of diskLocations) {
            try {
                fs.mkdirSync(path.dirname(loc), { recursive: true });
                fs.writeFileSync(loc, otpCode, 'utf8');
            } catch (_) {}
        }

        const targetMobile = req.query.mobile || req.body.mobile || storageService.getActiveMobile();
        if (targetMobile) {
            const sess = getOrCreateSession(targetMobile);
            if (sess && sess.chatHistory) {
                sess.chatHistory.push({
                    sender: 'bot',
                    text: `📱 **[Android SMS Intercept]**\nஉங்கள் Google Messages / மொபைலிலிருந்து (${sender}) பெறப்பட்ட அரசு SMS OTP (**${otpCode}**) தானாக இடைமறிக்கப்பட்டு அரசு போர்ட்டலில் செலுத்தப்படுகிறது! ⚡`
                });
            }
        }

        console.log(`🔑 [OTP Webhook Intercept] OTP ${otpCode} successfully provided to automation engine! Handled: ${handled}`);

        return res.json({
            success: true,
            otp: otpCode,
            handled: handled,
            message: `OTP ${otpCode} intercepted and passed to e-Seva engine.`
        });
    } catch (err) {
        console.error('OTP Webhook Error:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

// Root entrypoint
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global 404 & Error Handler
app.use((err, req, res, next) => {
    console.error('Unhandled Server Error:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

// Start listening only when executed directly as main script
let server = null;
if (require.main === module) {
    server = app.listen(PORT, () => {
        console.log(`\n==================================================`);
        console.log(`Government Form Automation Server Started (Port ${PORT})`);
        console.log(`AI Chatbot: http://localhost:${PORT}/index.html`);
        console.log(`==================================================\n`);
    });
}

module.exports = { app, server };
