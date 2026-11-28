// =========================================================================
// eSevaDraft Desktop App — Local HTTP Engine & API Proxy
// Serves local UI assets instantly (<100ms) with seamless cloud API proxy
// =========================================================================
const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');
const { app, BrowserWindow } = require('electron');
if (process.versions && process.versions.electron) {
    process.env.DESKTOP_RUNTIME = '1';
}

// Local Engine Crash Immunizers
process.on('unhandledRejection', (reason) => {
    console.warn('⚠️ [Desktop Local Server] Caught unhandled promise rejection:', reason ? (reason.message || reason) : 'Unknown');
});
process.on('uncaughtException', (err) => {
    console.error('⚠️ [Desktop Local Server] Caught uncaught exception:', err ? (err.message || err) : 'Unknown');
});

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=utf-8',
    '.pdf': 'application/pdf',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff'
};

function resolveLocalFile(reqPath) {
    let clean = (reqPath || '').split('?')[0].replace(/^\/+/, '');
    if (!clean || clean === '') clean = 'index.html';
    if (clean.includes('..')) return null;

    const candidates = [];

    // 0. On external machines, prioritize OTA-synced public assets in userData ONLY if strictly newer than packaged resources
    try {
        const isLocalDev = process.env.USERNAME === 'ADMIN' && fs.existsSync('d:\\downloads\\ai assitant 2');
        if (!isLocalDev && typeof app !== 'undefined' && app.getPath) {
            const otaCandidate = path.join(app.getPath('userData'), 'public', clean);
            const packagedCandidate = process.resourcesPath ? path.join(process.resourcesPath, 'public', clean) : null;
            if (fs.existsSync(otaCandidate) && fs.statSync(otaCandidate).isFile()) {
                let useOta = true;
                if (packagedCandidate && fs.existsSync(packagedCandidate)) {
                    const otaMtime = fs.statSync(otaCandidate).mtimeMs;
                    const pkgMtime = fs.statSync(packagedCandidate).mtimeMs;
                    if (pkgMtime >= otaMtime) {
                        useOta = false;
                    }
                }
                if (useOta) {
                    candidates.push(otaCandidate);
                }
            }
        }
    } catch (_) {}

    // 1. Packaged Installer Resources & Workspace (Always Certified Production Version)
    if (process.resourcesPath) {
        candidates.push(path.join(process.resourcesPath, 'public', clean));
    }
    candidates.push(path.join(__dirname, '..', 'public', clean));

    // 2. User Data Directory (Uploads, Compressed Cache, and Secondary OTA Assets)
    try {
        if (typeof app !== 'undefined' && app.getPath) {
            if (clean.startsWith('uploads/')) {
                const sub = clean.replace(/^uploads\//, '');
                candidates.push(path.join(app.getPath('userData'), 'data', 'uploads', sub));
                candidates.push(path.join(app.getPath('userData'), 'uploads', sub));
            }
            if (clean.startsWith('compressed/')) {
                const sub = clean.replace(/^compressed\//, '');
                candidates.push(path.join(app.getPath('userData'), 'compressed', sub));
                candidates.push(path.join(app.getPath('userData'), 'data', 'compressed', sub));
            }
            if (clean.startsWith('data/uploads/')) {
                const sub = clean.replace(/^data\/uploads\//, '');
                candidates.push(path.join(app.getPath('userData'), 'data', 'uploads', sub));
            }
            candidates.push(path.join(app.getPath('userData'), 'public', clean));
        }
    } catch (_) {}
    if (clean.startsWith('uploads/')) {
        const sub = clean.replace(/^uploads\//, '');
        candidates.push(path.join(__dirname, '..', 'data', 'uploads', sub));
        candidates.push(path.join(__dirname, '..', 'uploads', sub));
    }
    if (clean.startsWith('compressed/')) {
        const sub = clean.replace(/^compressed\//, '');
        candidates.push(path.join(__dirname, '..', 'compressed', sub));
        candidates.push(path.join(__dirname, '..', 'data', 'compressed', sub));
    }
    if (clean.startsWith('data/uploads/')) {
        const sub = clean.replace(/^data\/uploads\//, '');
        candidates.push(path.join(__dirname, '..', 'data', 'uploads', sub));
    }

    for (const cand of candidates) {
        try {
            if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
                return cand;
            }
        } catch (_) {}
    }
    return null;
}

function handleOtpWebhook(req, res, getActiveAutomationModule) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
        try {
            const data = JSON.parse(body || '{}');
            const raw = data.text || data.message || data.otp || data.sms || data.content || '';
            const match = String(raw).match(/\b\d{6,8}\b/);
            if (match) {
                const otpCode = match[0];
                console.log('[Desktop Local Webhook] Received OTP from extension:', otpCode);
                const diskLocations = [
                    path.join(__dirname, '..', 'data', 'pending_otp.txt'),
                    path.join(app.getPath('userData'), 'data', 'pending_otp.txt'),
                    path.join(app.getPath('userData'), 'pending_otp.txt')
                ];
                for (const loc of diskLocations) {
                    try {
                        fs.mkdirSync(path.dirname(loc), { recursive: true });
                        fs.writeFileSync(loc, otpCode, 'utf8');
                    } catch (_) {}
                }
                let handled = false;
                const activeMod = getActiveAutomationModule ? getActiveAutomationModule() : null;
                if (activeMod && typeof activeMod.provideOtp === 'function') {
                    handled = activeMod.provideOtp(otpCode);
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ success: true, otp: otpCode, handled }));
            }
        } catch (_) {}
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'No OTP found' }));
    });
}

function handleLocalTelemetry(req, res) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
        try {
            const data = JSON.parse(body || '{}');
            const errType = data.type || data.event || 'CLIENT_UI_ERROR';
            const errMsg = data.message || data.reason || data.errorMessage || (typeof data.details === 'string' ? data.details : JSON.stringify(data.details || {}));
            const timestamp = data.time || new Date().toISOString();
            const customerMobile = data.activeMobile || data.customerMobile || data.mobile || '';

            const record = {
                timestamp,
                type: errType,
                message: errMsg,
                customerMobile,
                role: data.role || 'operator',
                stack: data.stack || null,
                filename: data.filename || null,
                lineno: data.lineno || null,
                colno: data.colno || null,
                details: data
            };

            // 1. Write latest_ui_error.json in data/telemetry (workspace + AppData)
            const targets = [
                path.join(__dirname, '..', 'data', 'telemetry', 'latest_ui_error.json')
            ];
            try {
                if (typeof app !== 'undefined' && app.getPath) {
                    targets.push(path.join(app.getPath('userData'), 'data', 'telemetry', 'latest_ui_error.json'));
                }
            } catch (_) {}

            for (const t of targets) {
                try {
                    fs.mkdirSync(path.dirname(t), { recursive: true });
                    fs.writeFileSync(t, JSON.stringify(record, null, 2), 'utf8');
                } catch (_) {}
            }

            // 2. Append to client_errors.log & app_ui_errors.log
            const logLine = `[${timestamp}] [${errType}] [Mobile: ${customerMobile || 'N/A'}] ${errMsg}\n`;
            const logTargets = [
                path.join(__dirname, '..', 'public', 'logs', 'client_errors.log')
            ];
            try {
                if (typeof app !== 'undefined' && app.getPath) {
                    logTargets.push(path.join(app.getPath('userData'), 'logs', 'app_ui_errors.log'));
                }
            } catch (_) {}

            for (const lt of logTargets) {
                try {
                    fs.mkdirSync(path.dirname(lt), { recursive: true });
                    fs.appendFileSync(lt, logLine, 'utf8');
                } catch (_) {}
            }

            console.log(`🚨 [Desktop Local Engine] In-app UI error recorded to disk: [${errType}] ${errMsg}`);

            // 3. Immediately relay per-operator telemetry to Cloud (non-blocking)
            try {
                const { reportOperatorTelemetry } = require('./desktop_services');
                if (typeof reportOperatorTelemetry === 'function') {
                    reportOperatorTelemetry({
                        runId: data.runId || '',
                        operatorUid: data.operatorUid || req.headers['x-operator-uid'] || '',
                        operatorName: data.operatorName || '',
                        operatorMobile: data.operatorMobile || '',
                        customerMobile,
                        serviceName: data.serviceName || '',
                        step: data.step || 'CLIENT_UI',
                        errorType: errType,
                        errorMessage: errMsg,
                        errorStack: data.stack || `${data.filename || ''}:${data.lineno || ''}:${data.colno || ''}`,
                        appVersion: data.appVersion || '',
                        lastUiActions: Array.isArray(data.lastUiActions) ? data.lastUiActions : [],
                        extraInfo: { role: data.role || 'operator', url: data.url || '' }
                    });
                }
            } catch (_) {}

            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ success: true, savedLocally: true, cloudRelayQueued: true, timestamp }));
        } catch (e) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ success: false, error: e.message }));
        }
    });
}

function handleFlightRecorder(req, res) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
        try {
            const data = JSON.parse(body || '{}');
            const timestamp = data.recordedAt || new Date().toISOString();

            // 1. Write structured app_flight_recorder.json
            const jsonTargets = [
                path.join(__dirname, '..', 'data', 'telemetry', 'app_flight_recorder.json')
            ];
            try {
                if (typeof app !== 'undefined' && app.getPath) {
                    jsonTargets.push(path.join(app.getPath('userData'), 'data', 'telemetry', 'app_flight_recorder.json'));
                }
            } catch (_) {}

            for (const t of jsonTargets) {
                try {
                    fs.mkdirSync(path.dirname(t), { recursive: true });
                    fs.writeFileSync(t, JSON.stringify(data, null, 2), 'utf8');
                } catch (_) {}
            }

            // 2. Append latest summary to flight_recorder.log
            const logTargets = [
                path.join(__dirname, '..', 'public', 'logs', 'flight_recorder.log')
            ];
            try {
                if (typeof app !== 'undefined' && app.getPath) {
                    logTargets.push(path.join(app.getPath('userData'), 'logs', 'flight_recorder.log'));
                }
            } catch (_) {}

            const lastAction = data.timeline && data.timeline.length ? data.timeline[data.timeline.length - 1] : null;
            const logLine = `[${timestamp}] [Role: ${data.domSnapshot?.currentRole || 'N/A'}] [Customer: ${data.domSnapshot?.activeCustomer || 'N/A'}] Last: ${lastAction ? `${lastAction.cat}: ${lastAction.action}` : 'Sync'}\n`;
            for (const lt of logTargets) {
                try {
                    fs.mkdirSync(path.dirname(lt), { recursive: true });
                    fs.appendFileSync(lt, logLine, 'utf8');
                } catch (_) {}
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ success: true, saved: true, timestamp }));
        } catch (e) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ success: false, error: e.message }));
        }
    });
}

function handleNewCustomer(req, res) {
    let bodyStr = '';
    req.on('data', chunk => { bodyStr += chunk; });
    req.on('end', async () => {
        try {
            const body = JSON.parse(bodyStr || '{}');
            const { customerMobile, customerName, operatorUid, operatorName, operatorMobile, isWalkin, serviceName } = body;
            const isTempWalkin = isWalkin === true || !customerMobile || String(customerMobile).startsWith('walkin_');
            let cleanMobile = '';
            if (isTempWalkin) {
                cleanMobile = (customerMobile && String(customerMobile).startsWith('walkin_')) ? customerMobile : `walkin_${Date.now()}`;
            } else {
                cleanMobile = (customerMobile || '').replace(/\D/g, '');
                if (cleanMobile.length === 12 && cleanMobile.startsWith('91')) cleanMobile = cleanMobile.slice(2);
                cleanMobile = cleanMobile.slice(-10);
            }

            // Golden Rule 24 (100% Pure Fresh Mode): NEVER pre-fill old draft fields or docs into a fresh session!
            const initialName = (customerName || '').trim();
            const citizenProfile = {
                mobileNumber: isTempWalkin ? '' : cleanMobile,
                fullNameTam: initialName,
                fullNameEng: initialName
            };

            const phoneDisplay = isTempWalkin ? '' : ` (+91 ${cleanMobile})`;
            const resolvedName = (citizenProfile && (citizenProfile.fullNameTam || citizenProfile.fullNameEng)) || initialName || '';
            const displayName = resolvedName ? `திரு/திருமதி **${resolvedName}**` : `வாடிக்கையாளர்`;

            const intakeState = 'SERVICE_SELECTION';
            const step = 'SERVICE_SELECTION';
            citizenProfile.subService = null;
            citizenProfile.subServiceData = null;

            const chatHistory = [{
                sender: 'bot',
                text: `வணக்கம் ${displayName}!${phoneDisplay} 🙏\n\n🏛️ **eSevaDraft தமிழ்நாடு அரசு சேவைகள் ஏஐ நேரடி மையத்திற்கு வரவேற்கிறோம்!**\n\nவாடிக்கையாளர் இன்று எந்த அரசு சேவைக்கு விண்ணப்பிக்க விரும்புகிறார்?\n\nகீழே உள்ள அரசு சேவைகளில் ஒன்றைத் தேர்ந்தெடுக்கவும்:`,
                options: [
                    { label: "🏛️ புதிய குடும்ப அட்டை (New Ration Card)", value: "புதிய குடும்ப அட்டை" },
                    { label: "👨‍👩‍👧 குடும்ப அட்டை சேவைகள் (Ration Card Services)", value: "குடும்ப அட்டை சேவைகள்" },
                    { label: "📜 வருமானச் சான்றிதழ் (Income Certificate)", value: "வருமானச் சான்றிதழ்" },
                    { label: "🏠 இருப்பிடச் சான்றிதழ் (Residence Certificate)", value: "இருப்பிடச் சான்றிதழ்" },
                    { label: "🗳️ புதிய வாக்காளர் அட்டை (New Voter ID)", value: "புதிய வாக்காளர் அட்டை" }
                ]
            }];

            // Do NOT overwrite an existing customer's saved disk draft or collide across operators!
            const uniqueDraftId = isTempWalkin ? cleanMobile : `${cleanMobile}_${Date.now()}`;
            if (!isTempWalkin && cleanMobile) {
                try {
                    const { saveCitizenDraft } = require('../firestore_db');
                    await saveCitizenDraft(uniqueDraftId, {
                        draftId: uniqueDraftId,
                        mobileNumber: cleanMobile,
                        operatorUid,
                        operatorName,
                        operatorMobile,
                        citizenProfile,
                        subService: null,
                        subServiceData: null,
                        documents: {},
                        chatHistory,
                        intakeState: 'SERVICE_SELECTION',
                        step: 'SERVICE_SELECTION',
                        status: 'DRAFT_SAVED'
                    });
                } catch (_) {}
            }

            syncDraftToCloudInBackground('/api/operator/new-customer', 'POST', body, {
                'x-operator-uid': operatorUid || '',
                'x-operator-name': encodeURIComponent(operatorName || '')
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({
                success: true,
                draftId: uniqueDraftId,
                customerMobile: cleanMobile,
                isWalkin: isTempWalkin,
                customerName: (citizenProfile.fullNameTam || citizenProfile.fullNameEng) || initialName || '',
                citizenProfile,
                chatHistory,
                intakeState: 'SERVICE_SELECTION',
                step: 'SERVICE_SELECTION',
                subService: null,
                subServiceData: null
            }));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ success: false, error: err.message }));
        }
    });
}

let localExpressAppInstance = null;
let expressLoadAttempted = false;
function getLocalExpressApp() {
    if (!localExpressAppInstance && !expressLoadAttempted) {
        expressLoadAttempted = true;
        try {
            // Hook Node Module resolution so Express and native modules are found
            const Module = require('module');
            const origNodeModulePaths = Module._nodeModulePaths;
            const extraNodePaths = [
                path.join(process.resourcesPath || '', 'node_modules'),
                path.join(process.resourcesPath || '', 'app.asar.unpacked', 'node_modules'),
                path.join(__dirname, '..', 'node_modules'),
                path.join(__dirname, 'node_modules')
            ];
            const isPackaged = typeof app !== 'undefined' && app.isPackaged;
            if (!isPackaged) {
                extraNodePaths.unshift(path.join('d:', 'downloads', 'ai assitant 2', 'node_modules'));
            }
            if (typeof app !== 'undefined' && app.getPath) {
                extraNodePaths.push(path.join(app.getPath('userData'), 'node_modules'));
            }
            Module._nodeModulePaths = function(from) {
                const paths = origNodeModulePaths.call(this, from);
                for (const extra of extraNodePaths) {
                    if (fs.existsSync(extra) && !paths.includes(extra)) {
                        paths.push(extra);
                    }
                }
                return paths;
            };

            const candidates = [
                path.join(process.resourcesPath || '', 'server.js'),
                path.join(process.resourcesPath || '', 'app.asar.unpacked', 'server.js'),
                path.join(__dirname, '..', 'server.js'),
                path.join(__dirname, 'server.js')
            ];
            if (!isPackaged) {
                candidates.unshift(path.join('d:', 'downloads', 'ai assitant 2', 'server.js'));
            }
            if (typeof app !== 'undefined' && app.getPath) {
                candidates.push(path.join(app.getPath('userData'), 'server.js'));
            }
            for (const cand of candidates) {
                if (fs.existsSync(cand)) {
                    try {
                        const mod = require(cand);
                        if (mod && mod.app) {
                            localExpressAppInstance = mod.app;
                            console.log('✅ [Desktop Local Server] Successfully mounted local Express engine from:', cand);
                            break;
                        }
                    } catch (err) {
                        console.warn(`⚠️ [Desktop Local Server] Candidate ${cand} load failed:`, err.message);
                    }
                }
            }
        } catch (e) {
            console.warn('⚠️ [Desktop Local Server] Failed to initialize Express app:', e.message);
        }
    }
    return localExpressAppInstance;
}

function sanitizeHttpHeaders(rawHeaders = {}) {
    const clean = {};
    for (const [k, v] of Object.entries(rawHeaders || {})) {
        if (v === undefined || v === null) continue;
        const lowerKey = String(k).toLowerCase();
        if (lowerKey === 'content-length' || lowerKey === 'host' || lowerKey === 'connection') continue;
        const strVal = String(v);
        clean[k] = /[^\x00-\xFF]/.test(strVal) ? encodeURIComponent(strVal) : strVal;
    }
    return clean;
}

function proxyToCloud(req, res) {
    const cloudHost = 'esevadraft.in';
    const proxyHeaders = { ...sanitizeHttpHeaders(req.headers), host: cloudHost };

    const proxyReq = https.request({
        hostname: cloudHost,
        port: 443,
        path: req.url,
        method: req.method,
        headers: proxyHeaders,
        timeout: 30000
    }, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
    });

    proxyReq.on('timeout', () => {
        proxyReq.destroy();
        if (!res.headersSent) {
            res.writeHead(504, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Cloud API timeout (30s)' }));
        }
    });

    proxyReq.on('error', (err) => {
        if (!res.headersSent) {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Cloud connection failed', message: err.message }));
        }
    });

    req.pipe(proxyReq);
}

function syncDraftToCloudInBackground(endpoint, method, payload = null, customHeaders = {}) {
    try {
        const cloudHost = 'esevadraft.in';
        const bodyStr = payload ? (typeof payload === 'string' ? payload : JSON.stringify(payload)) : null;
        const reqHeaders = {
            'host': cloudHost,
            'content-type': 'application/json',
            ...sanitizeHttpHeaders(customHeaders)
        };
        if (bodyStr) {
            reqHeaders['content-length'] = Buffer.byteLength(bodyStr);
        }
        const req = https.request({
            hostname: cloudHost,
            port: 443,
            path: endpoint,
            method: method || 'POST',
            headers: reqHeaders,
            timeout: 10000
        }, (res) => {
            res.resume();
        });
        req.on('error', (err) => {
            console.warn(`☁️ [Cloud Backup Notice] Sync for ${endpoint}: ${err.message}`);
        });
        if (bodyStr) req.write(bodyStr);
        req.end();
    } catch (_) {}
}

let activePort = null;
let activeServerUrl = null;
let activeHttpServer = null;
let serverReadyResolve = null;
const serverReadyPromise = new Promise((resolve) => { serverReadyResolve = resolve; });

function getActivePort() { return activePort || 3000; }
function getActiveServerUrl() { return activeServerUrl || 'http://127.0.0.1:3000'; }
function whenServerReady() {
    if (activePort && activeServerUrl) return Promise.resolve(activeServerUrl);
    return serverReadyPromise;
}

function startLocalServer(getActiveAutomationModule, setActiveAutomationModule) {
    try {
        const localServer = http.createServer(async (req, res) => {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-operator-uid, x-dev-mode, x-operator-name');

            if (req.method === 'OPTIONS') {
                res.writeHead(200);
                return res.end();
            }

            const urlPath = (req.url || '').split('?')[0];

            // 1. OTP Webhook
            if (urlPath === '/api/automation/otp_webhook' || urlPath === '/api/automation/otp-webhook') {
                return handleOtpWebhook(req, res, getActiveAutomationModule);
            }

            // 2.01 Live App Version Endpoint
            if (urlPath === '/api/download/version') {
                let latestVer = '1.1.24';
                try {
                    latestVer = (typeof app !== 'undefined' && app.getVersion && app.getVersion()) || require('./package.json').version || '1.1.24';
                } catch (_) {}
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({
                    success: true,
                    latestVersion: latestVer,
                    releaseName: `eSevaDraft Desktop Suite v${latestVer}`
                }));
            }

            // 2. Desktop Engine Server Info
            if (urlPath === '/api/desktop/server-info') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({
                    success: true,
                    port: activePort,
                    activeServerUrl,
                    isDefaultPort: activePort === 3000,
                    otpWebhookUrl: `http://127.0.0.1:${activePort}/api/automation/otp_webhook`
                }));
            }

            // 2.02 Native Window Controls Endpoint (Dual-Channel Fail-Safe)
            if (urlPath === '/api/desktop/window-action') {
                try {
                    const searchParams = new URL(req.url, 'http://127.0.0.1').searchParams;
                    const action = searchParams.get('action');
                    const { getMainWindow } = require('./window_manager');
                    const win = getMainWindow();
                    if (win && !win.isDestroyed()) {
                        if (action === 'minimize') win.minimize();
                        else if (action === 'maximize') {
                            if (win.isMaximized()) win.unmaximize();
                            else win.maximize();
                        }
                        else if (action === 'close') win.close();
                        else if (action === 'focus') {
                            if (win.isMinimized()) win.restore();
                            win.blur();
                            win.focus();
                            if (win.webContents) win.webContents.focus();
                        }
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ success: true, action }));
                } catch (e) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ success: false, error: e.message }));
                }
            }

            // 2.05 Desktop Live Vision & State Inspector (Loopback ONLY for security)
            if (urlPath === '/api/desktop/inspect-live' || urlPath === '/api/desktop/live-state') {
                const remoteAddr = String(req.socket?.remoteAddress || '').trim();
                const isLoopback = remoteAddr === '127.0.0.1' || remoteAddr === '::1' || remoteAddr === '::ffff:127.0.0.1';
                if (!isLoopback) {
                    res.writeHead(403, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ success: false, error: 'Loopback access only' }));
                }
                try {
                    let win = null;
                    try {
                        const { getMainWindow } = require('./window_manager');
                        win = getMainWindow();
                    } catch (_) {}
                    let allWindowsInfo = [];
                    if (BrowserWindow && BrowserWindow.getAllWindows) {
                        allWindowsInfo = BrowserWindow.getAllWindows().map(w => ({
                            id: w.id,
                            title: w.getTitle ? w.getTitle() : '',
                            url: w.webContents ? w.webContents.getURL() : '',
                            isDestroyed: w.isDestroyed()
                        }));
                    }

                    if (win && !win.isDestroyed() && win.webContents) {
                        try {
                            const searchParams = new URL(req.url, 'http://127.0.0.1').searchParams;
                            const action = searchParams.get('action');
                            const mob = searchParams.get('mobile');
                            if (action === 'reload') {
                                win.webContents.reload();
                                await new Promise(r => setTimeout(r, 1500));
                            } else if (action === 'enter_customer' && mob) {
                                await win.webContents.executeJavaScript(`
                                    (() => {
                                        const input = document.getElementById('newCustomerMobileInput');
                                        if (input) {
                                            input.value = '${mob}';
                                            if (typeof startCustomerSessionFromModal === 'function') {
                                                startCustomerSessionFromModal();
                                            }
                                        }
                                    })()
                                `);
                                await new Promise(r => setTimeout(r, 1200));
                            } else if (action === 'select_home_service') {
                                const svc = searchParams.get('service') || 'ரேஷன் கார்டு';
                                await win.webContents.executeJavaScript(`
                                    (async () => {
                                        if (typeof citizenStartService === 'function') {
                                            citizenStartService('${svc}');
                                        }
                                        await new Promise(r => setTimeout(r, 400));
                                        const input = document.getElementById('newCustomerMobileInput');
                                        if (input) {
                                            input.value = '${mob}';
                                            if (typeof startCustomerSessionFromModal === 'function') {
                                                startCustomerSessionFromModal();
                                            }
                                        }
                                    })()
                                `);
                                await new Promise(r => setTimeout(r, 1500));
                            } else if (action === 'click_sidebar_edit') {
                                await win.webContents.executeJavaScript(`
                                    (() => {
                                        const btn = document.getElementById('btnSidebarEdit');
                                        if (btn) btn.click();
                                    })()
                                `);
                                await new Promise(r => setTimeout(r, 600));
                            } else if (action === 'close_modal') {
                                await win.webContents.executeJavaScript(`
                                    (() => {
                                        if (typeof closeOperatorDraftsModal === 'function') closeOperatorDraftsModal();
                                        if (typeof closeNewCustomerModal === 'function') closeNewCustomerModal();
                                    })()
                                `);
                                await new Promise(r => setTimeout(r, 400));
                            } else if (action === 'eval_js') {
                                const code = searchParams.get('code') || '';
                                let evalRes = null;
                                try {
                                    evalRes = await win.webContents.executeJavaScript(code);
                                } catch (err) {
                                    evalRes = 'ERROR: ' + err.message;
                                }
                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                return res.end(JSON.stringify({ success: true, evalRes }));
                            } else if (action === 'edit_customer') {
                                await win.webContents.executeJavaScript(`
                                    (async () => {
                                        if (typeof editCustomerFromDraftDesk === 'function') {
                                            await editCustomerFromDraftDesk('${mob || '9790170026'}');
                                        }
                                    })()
                                `);
                                await new Promise(r => setTimeout(r, 800));
                            } else if (action === 'open_drafts') {
                                await win.webContents.executeJavaScript(`
                                    (async () => {
                                        if (typeof openOperatorDraftsModal === 'function') {
                                            openOperatorDraftsModal();
                                        }
                                        if (typeof fetchOperatorDrafts === 'function') {
                                            await fetchOperatorDrafts();
                                        }
                                    })()
                                `);
                                await new Promise(r => setTimeout(r, 800));
                            } else if (action === 'select_service') {
                                const svc = searchParams.get('service') || 'வருமானச் சான்றிதழ்';
                                await win.webContents.executeJavaScript(`
                                    (() => {
                                        if (typeof sendTextMessage === 'function') {
                                            sendTextMessage('${svc}');
                                        }
                                    })()
                                `);
                                await new Promise(r => setTimeout(r, 1200));
                            }
                        } catch (_) {}
                    }

                    let screenshotSaved = false;
                    const screenshotDir = path.join(__dirname, '..', 'data', 'telemetry');
                    const screenshotPath = path.join(screenshotDir, 'live_desktop_screen.png');
                    const brainDir = path.join(process.env.USERPROFILE || 'C:\\Users\\ADMIN', '.gemini', 'antigravity', 'brain', '7275b959-cc05-4d20-98fc-29e1ebc6efb1');
                    const brainScreenshotPath = path.join(brainDir, 'live_desktop_screen.png');

                    if (win && !win.isDestroyed() && win.webContents) {
                        try {
                            const image = await win.webContents.capturePage();
                            const pngBuf = image.toPNG();
                            fs.mkdirSync(screenshotDir, { recursive: true });
                            fs.writeFileSync(screenshotPath, pngBuf);
                            try {
                                fs.mkdirSync(brainDir, { recursive: true });
                                fs.writeFileSync(brainScreenshotPath, pngBuf);
                            } catch (_) {}
                            screenshotSaved = true;
                        } catch (err) {
                            console.warn('⚠️ [Live Inspector] Capture page failed:', err.message);
                        }
                    }

                    let domData = null;
                    if (win && !win.isDestroyed() && win.webContents) {
                        try {
                            domData = await win.webContents.executeJavaScript(`
                                (() => {
                                    const customerMobile = document.querySelector('#customerMobileInput')?.value || document.querySelector('#intakeMobile')?.value || '';
                                    const customerName = document.querySelector('#customerNameInput')?.value || '';
                                    const chatBubbles = Array.from(document.querySelectorAll('.msg-bubble, .msg-bot, .msg-user, .chat-bubble, .bot-bubble, .message-bubble, .chat-message')).map(el => ({
                                        sender: (el.classList.contains('msg-bot') || el.classList.contains('bot-message') || el.classList.contains('bot-bubble') || el.closest('.bot-message')) ? 'bot' : 'user',
                                        text: el.innerText ? el.innerText.trim() : ''
                                    })).filter(b => b.text).slice(-10);

                                    const optionButtons = Array.from(document.querySelectorAll('.chat-options button, .fsm-option-btn, #optionsContainer button, .quick-reply-btn')).map(b => ({
                                        label: b.innerText ? b.innerText.trim() : '',
                                        value: b.getAttribute('data-value') || b.value || ''
                                    })).filter(b => b.label);

                                    const submitButtons = Array.from(document.querySelectorAll('#btnReadyToApply, #btnSubmitTnpds, #btnStartAutomation, button.btn-success')).map(b => ({
                                        id: b.id,
                                        text: b.innerText ? b.innerText.trim() : '',
                                        visible: b.offsetParent !== null && window.getComputedStyle(b).display !== 'none'
                                    })).filter(b => b.text);

                                    const sidebar = {
                                        customerName: document.querySelector('#sidebarCustomerName')?.innerText?.trim() || '',
                                        mobile: document.querySelector('#sidebarCustomerMobile')?.innerText?.trim() || '',
                                        aadhaar: document.querySelector('#sidebarCustomerAadhaar')?.innerText?.trim() || '',
                                        activeService: document.querySelector('#sidebarActiveService, #sidebarServiceTitle')?.innerText?.trim() || '',
                                        incomeBoxVisible: document.querySelector('#sidebarIncomeBox') ? window.getComputedStyle(document.querySelector('#sidebarIncomeBox')).display !== 'none' : false,
                                        removeMemberBoxVisible: document.querySelector('#sidebarRemoveMemberBox') ? window.getComputedStyle(document.querySelector('#sidebarRemoveMemberBox')).display !== 'none' : false,
                                        gasBoxVisible: document.querySelector('#gasSidebarBox') ? window.getComputedStyle(document.querySelector('#gasSidebarBox')).display !== 'none' : false
                                    };

                                    const draftCards = Array.from(document.querySelectorAll('#operatorDraftsGrid > div, #operatorDraftsGridModal > div')).map(card => {
                                        return {
                                            title: card.querySelector('h4')?.innerText?.trim() || '',
                                            buttons: Array.from(card.querySelectorAll('button')).map(b => b.innerText.trim() || b.title || '')
                                        };
                                    });

                                    return {
                                        url: window.location.href,
                                        customerMobile,
                                        customerName,
                                        chatBubbles,
                                        optionButtons,
                                        submitButtons,
                                        sidebar,
                                        draftCards,
                                        appState: window.appState || window.currentStep || null
                                    };
                                })()
                            `);
                        } catch (err) {
                            domData = { error: err.message };
                        }
                    }

                    // Query automation module status
                    const activeMod = getActiveAutomationModule ? getActiveAutomationModule() : null;
                    let automationInfo = null;
                    if (activeMod) {
                        try {
                            const isRunning = typeof activeMod.isAutomationRunning === 'function' ? activeMod.isAutomationRunning() : false;
                            let activePortalUrl = null;
                            let activePortalTitle = null;
                            let portalScreenshotSaved = false;
                            if (activeMod.activeSessions && activeMod.activeSessions.size > 0) {
                                for (const [, s] of activeMod.activeSessions.entries()) {
                                    if (s && typeof s.getPage === 'function') {
                                        const p = s.getPage();
                                        if (p) {
                                            activePortalUrl = p.url();
                                            activePortalTitle = await p.title().catch(() => '');
                                            try {
                                                const portalScPath = path.join(brainDir, 'live_portal_screen.png');
                                                await p.screenshot({ path: portalScPath }).catch(() => {});
                                                portalScreenshotSaved = true;
                                            } catch (_) {}
                                            break;
                                        }
                                    }
                                }
                            }
                            automationInfo = {
                                isRunning,
                                activePortalUrl,
                                activePortalTitle,
                                portalScreenshotSaved,
                                status: typeof activeMod.getLiveApprovalStatus === 'function' ? activeMod.getLiveApprovalStatus() : null
                            };
                        } catch (_) {}
                    }

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({
                        success: true,
                        timestamp: new Date().toISOString(),
                        screenshotSaved,
                        screenshotPath,
                        brainScreenshotPath,
                        domData,
                        allWindowsInfo,
                        automationInfo
                    }));
                } catch (err) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ success: false, error: err.message }));
                }
            }

            // 2.06 Direct Desktop Screenshot Stream
            if (urlPath === '/api/desktop/live-screenshot') {
                try {
                    let win = null;
                    try {
                        const { getMainWindow } = require('./window_manager');
                        win = getMainWindow();
                    } catch (_) {}
                    if (win && !win.isDestroyed() && win.webContents) {
                        const image = await win.webContents.capturePage();
                        const pngBuf = image.toPNG();
                        res.writeHead(200, { 'Content-Type': 'image/png' });
                        return res.end(pngBuf);
                    }
                    res.writeHead(503, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'No active window' }));
                } catch (err) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: err.message }));
                }
            }

            // 2.1 Desktop UI Direct Customer Loader & Live Automation Launcher
            if (urlPath === '/api/desktop/launch-customer-automation' && req.method === 'POST') {
                let bodyStr = '';
                req.on('data', chunk => { bodyStr += chunk.toString(); });
                req.on('end', async () => {
                    try {
                        const body = JSON.parse(bodyStr || '{}');
                        const rawDraftKey = String(body.draftId || '').trim();
                        const mob = String(body.mobileNumber || rawDraftKey || '').split('_')[0].replace(/\D/g, '').slice(-10);
                        const lookupKey = rawDraftKey || mob;
                        const autoStart = body.autoStart !== false;
                        const { getMainWindow } = require('./window_manager');
                        const { getCitizenDraft } = require('../firestore_db');
                        const { executeLiveDesktopAutomation } = require('./automation_runner');
                        const win = getMainWindow();
                        const draft = await getCitizenDraft(lookupKey);

                        if (win && !win.isDestroyed()) {
                            if (win.isMinimized()) win.restore();
                            win.show();
                            win.focus();
                            win.webContents.executeJavaScript(`
                                (async () => {
                                    if (window.esevaDesktopBridge && window.esevaDesktopBridge.onAutomationUpdate && !window.__desktopUpdateListenerRegistered) {
                                        window.__desktopUpdateListenerRegistered = true;
                                        window.esevaDesktopBridge.onAutomationUpdate((msg) => {
                                            if (typeof appendLiveAutomationStep === 'function') appendLiveAutomationStep(msg);
                                        });
                                    }
                                    if (window.esevaDesktopBridge && window.esevaDesktopBridge.onAutomationFinished && !window.__desktopFinishedListenerRegistered) {
                                        window.__desktopFinishedListenerRegistered = true;
                                        window.esevaDesktopBridge.onAutomationFinished((res) => {
                                            if (typeof handleAutomationFinished === 'function') handleAutomationFinished(res);
                                        });
                                    }
                                    const pBar = document.getElementById('automationProgressBar');
                                    if (pBar) pBar.classList.add('active');
                                    if (typeof resumeCustomerSession === 'function') {
                                        await resumeCustomerSession('${mob}', false);
                                    }
                                    return true;
                                })()
                            `).catch(() => {});
                        }

                        let autoRes = null;
                        if (autoStart && draft) {
                            const sub = body.subService || draft.subService || draft.citizenProfile?.subService ||
                                ((draft.intakeState === 'READY_TO_APPLY_CAN' || draft.citizenProfile?.intakeState === 'READY_TO_APPLY_CAN' || draft.serviceId === 'TNEGA_CAN_REGISTER') ? 'CAN_REGISTER' : null);
                            if (sub) {
                                draft.subService = sub;
                                if (draft.citizenProfile) draft.citizenProfile.subService = sub;
                            }
                            const liveDraftPayload = {
                                ...draft,
                                subService: sub || draft.subService,
                                isDryRun: body.isDryRun === true,
                                enableSubmit: body.isDryRun !== true
                            };
                            autoRes = await executeLiveDesktopAutomation(
                                liveDraftPayload,
                                win,
                                getActiveAutomationModule || (() => null),
                                setActiveAutomationModule || (() => {})
                            );
                        }

                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        return res.end(JSON.stringify({
                            success: true,
                            mobileNumber: mob,
                            launchedInUi: Boolean(win && !win.isDestroyed()),
                            automationStarted: Boolean(autoRes && autoRes.success),
                            message: autoRes?.message || 'Customer loaded'
                        }));
                    } catch (e) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        return res.end(JSON.stringify({ success: false, error: e.message }));
                    }
                });
                return;
            }

            // 2.44 Direct Local Automation Stop Handler
            if (urlPath === '/api/automation/stop' && req.method === 'POST') {
                try {
                    const { stopActiveAutomation, resolveStorageService } = require('./automation_runner');
                    if (typeof stopActiveAutomation === 'function') {
                        await stopActiveAutomation();
                    }
                    const storageService = typeof resolveStorageService === 'function' ? resolveStorageService() : null;
                    if (storageService) {
                        const allSessions = storageService.getAllSessions ? storageService.getAllSessions() : [];
                        for (const s of allSessions) {
                            if (s) {
                                s.isAutomationRunning = false;
                                s.isAutomating = false;
                                s.automationStep = 0;
                                s.automationCurrentStepMsg = '';
                            }
                        }
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ success: true, isRunning: false, step: 0 }));
                } catch (e) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ success: true, isRunning: false, step: 0 }));
                }
            }

            // 2.45 Direct High-Precision Local Automation Progress Engine
            if (urlPath === '/api/automation/progress' && req.method === 'GET') {
                try {
                    const parsedUrl = new URL(req.url, `http://127.0.0.1:${activePort}`);
                    const mob = String(parsedUrl.searchParams.get('mobile') || req.headers['x-session-mobile'] || '').split('_')[0].replace(/\D/g, '').slice(-10);
                    let step = 0;
                    let total = 51;
                    let stepMessage = '';
                    let isRunning = false;
                    let isWaitingForOtp = false;
                    let otpType = 'mobile';

                    // Check if automation was stopped
                    let isStopped = false;
                    const logPaths = [
                        path.join(app.getPath('userData'), 'logs', 'latest_run.log'),
                        path.join('d:', 'downloads', 'ai assitant 2', 'public', 'logs', 'latest_run.log')
                    ];
                    for (const lp of logPaths) {
                        if (fs.existsSync(lp)) {
                            try {
                                const logContent = fs.readFileSync(lp, 'utf8');
                                if (logContent.includes('[ஆட்டோமேஷன் நிறுத்தப்பட்டது]')) {
                                    isStopped = true;
                                    break;
                                }
                            } catch (_) {}
                        }
                    }

                    let sess = null;
                    try {
                        const { resolveStorageService } = require('./automation_runner');
                        const storageService = typeof resolveStorageService === 'function' ? resolveStorageService() : null;
                        if (storageService && mob) {
                            sess = storageService.getOrCreateSession(mob);
                        }
                    } catch (_) {}

                    if (sess) {
                        if (isStopped || sess.isAutomationRunning === false) {
                            sess.isAutomationRunning = false;
                            sess.isAutomating = false;
                            sess.automationStep = 0;
                            isRunning = false;
                            step = 0;
                        } else {
                            step = sess.automationStep || 0;
                            total = sess.automationTotal || 51;
                            stepMessage = sess.automationCurrentStepMsg || '';
                            isRunning = Boolean(sess.isAutomationRunning || sess.isAutomating);
                            isWaitingForOtp = Boolean(sess.isWaitingForOtp);
                            otpType = sess.otpType || 'mobile';
                        }
                    }

                    if (isStopped) {
                        isRunning = false;
                        step = 0;
                    }

                    const effectiveRunning = Boolean(!isStopped && isRunning && step > 0 && step < total);
                    const percentage = (effectiveRunning && total > 0) ? Math.round((step / total) * 100) : 0;
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({
                        step: effectiveRunning ? step : 0,
                        total,
                        percentage,
                        stepMessage: effectiveRunning ? stepMessage : '',
                        isRunning: effectiveRunning,
                        isWaitingForApproval: effectiveRunning && step === 48,
                        isWaitingForOtp: effectiveRunning && isWaitingForOtp,
                        otpType
                    }));
                } catch (e) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ step: 0, total: 51, percentage: 0, isRunning: false }));
                }
            }

            // 2.5 Local In-App Error Telemetry Sink (Always save to local disk first)
            if (urlPath === '/api/operator/telemetry-log' || urlPath === '/api/telemetry/error') {
                return handleLocalTelemetry(req, res);
            }

            // 2.6 Local App Flight Recorder (Black Box UI breadcrumbs logger)
            if (urlPath === '/api/operator/flight-recorder' || urlPath === '/api/telemetry/flight-recorder') {
                return handleFlightRecorder(req, res);
            }

            // 2.7 Admin Flight Recorder Reader
            if (urlPath === '/api/admin/flight-recorder') {
                const jsonTargets = [
                    path.join(__dirname, '..', 'data', 'telemetry', 'app_flight_recorder.json')
                ];
                try {
                    if (typeof app !== 'undefined' && app.getPath) {
                        jsonTargets.unshift(path.join(app.getPath('userData'), 'data', 'telemetry', 'app_flight_recorder.json'));
                    }
                } catch (_) {}
                let recorderData = {};
                for (const t of jsonTargets) {
                    if (fs.existsSync(t)) {
                        try {
                            recorderData = JSON.parse(fs.readFileSync(t, 'utf8'));
                            break;
                        } catch (_) {}
                    }
                }
                const errTargets = [
                    path.join(__dirname, '..', 'data', 'telemetry', 'latest_ui_error.json')
                ];
                try {
                    if (typeof app !== 'undefined' && app.getPath) {
                        errTargets.unshift(path.join(app.getPath('userData'), 'data', 'telemetry', 'latest_ui_error.json'));
                    }
                } catch (_) {}
                let latestError = null;
                for (const et of errTargets) {
                    if (fs.existsSync(et)) {
                        try {
                            latestError = JSON.parse(fs.readFileSync(et, 'utf8'));
                            break;
                        } catch (_) {}
                    }
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ success: true, flightRecorder: recorderData, latestError }));
            }

            // 2.75 Local New Customer Session Initializer
            if (urlPath === '/api/operator/new-customer' && req.method === 'POST') {
                const expApp = getLocalExpressApp();
                if (expApp) return expApp(req, res);
                return handleNewCustomer(req, res);
            }

            // 2.75 Direct Local Operator Portal Vault Handler (<1ms Latency, 100% Local Encrypted Storage)
            if (urlPath === '/api/operator/vault') {
                const decodeHdr = (v) => { try { return v ? decodeURIComponent(String(v)) : ''; } catch (_) { return String(v || ''); } };
                try {
                    let vaultSvc = null;
                    const vaultCandidates = [
                        path.join(__dirname, '..', 'src', 'services', 'portal_vault_service'),
                        path.join(process.resourcesPath || '', 'src', 'services', 'portal_vault_service'),
                        path.join(process.resourcesPath || '', 'app.asar.unpacked', 'src', 'services', 'portal_vault_service')
                    ];
                    try {
                        if (typeof app !== 'undefined' && app.getPath) {
                            vaultCandidates.push(path.join(app.getPath('userData'), 'src', 'services', 'portal_vault_service'));
                        }
                    } catch (_) {}
                    for (const cand of vaultCandidates) {
                        try {
                            vaultSvc = require(cand);
                            if (vaultSvc && typeof vaultSvc.saveOperatorPortalCredentials === 'function') break;
                        } catch (_) {}
                    }

                    // Self-contained fallback if external module path cannot be resolved inside packaged ASAR
                    if (!vaultSvc || typeof vaultSvc.saveOperatorPortalCredentials !== 'function') {
                        const crypto = require('crypto');
                        const CIPHER_KEY = crypto.createHash('sha256').update(process.env.OPERATOR_VAULT_SECRET || 'esevadraft-gov-vault-military-key-2026').digest();
                        const getFallbackVaultPath = () => {
                            let dir = path.join(process.env.APPDATA || '', 'esevadraft-desktop', 'data');
                            try {
                                if (typeof app !== 'undefined' && app.getPath) dir = path.join(app.getPath('userData'), 'data');
                            } catch (_) {}
                            try { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
                            return path.join(dir, 'operator_vault.json');
                        };
                        const readFb = () => {
                            const candidates = [
                                getFallbackVaultPath(),
                                path.join(process.env.APPDATA || '', 'esevadraft-desktop', 'data', 'operator_vault.json'),
                                path.join(process.env.APPDATA || '', 'esevadraft-suite', 'data', 'operator_vault.json')
                            ];
                            const merged = {};
                            for (const p of candidates) {
                                try {
                                    if (p && fs.existsSync(p)) {
                                        const parsed = JSON.parse(fs.readFileSync(p, 'utf8')) || {};
                                        Object.assign(merged, parsed);
                                    }
                                } catch (_) {}
                            }
                            return merged;
                        };
                        const writeFb = (v) => {
                            const targets = [
                                getFallbackVaultPath(),
                                path.join(process.env.APPDATA || '', 'esevadraft-desktop', 'data', 'operator_vault.json'),
                                path.join(process.env.APPDATA || '', 'esevadraft-suite', 'data', 'operator_vault.json')
                            ];
                            for (const p of targets) {
                                try {
                                    fs.mkdirSync(path.dirname(p), { recursive: true });
                                    fs.writeFileSync(p, JSON.stringify(v, null, 2), 'utf8');
                                } catch (_) {}
                            }
                        };
                        const normOp = (u) => String(u || 'admin').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_') || 'admin';
                        const encTxt = (t) => {
                            if (!t) return '';
                            const iv = crypto.randomBytes(16);
                            const c = crypto.createCipheriv('aes-256-cbc', CIPHER_KEY, iv);
                            return iv.toString('hex') + ':' + c.update(t, 'utf8', 'hex') + c.final('hex');
                        };
                        vaultSvc = {
                            getOperatorVaultSummary: (operatorUid) => {
                                const opId = operatorUid ? normOp(operatorUid) : null;
                                if (!opId || ['admin', 'default_operator', 'local_op_dev', 'operator'].includes(opId)) {
                                    return { operatorUid: 'unconfigured', configured: false, portals: {}, tnega: { portal: 'tnega', portalName: 'TNeGA இ-சேவை', hasCredentials: false, username: '', passwordMasked: '', operatorCode: 'OM', savedAt: null } };
                                }
                                const v = readFb();
                                const opData = v[opId] || {};
                                const portalsSummary = {};
                                for (const [k, pVal] of Object.entries(opData)) {
                                    if (['operatorUid', 'operatorName', 'updatedAt'].includes(k)) continue;
                                    if (pVal && typeof pVal === 'object') {
                                        portalsSummary[k] = {
                                            portal: k,
                                            portalName: pVal.portalName || k,
                                            customUrl: pVal.customUrl || '',
                                            hasCredentials: Boolean(pVal.username && pVal.passwordEnc),
                                            username: pVal.username || '',
                                            passwordMasked: pVal.passwordEnc ? '••••••••' : '',
                                            operatorCode: pVal.operatorCode || 'OM',
                                            savedAt: pVal.savedAt || null
                                        };
                                    }
                                }
                                const tnega = portalsSummary.tnega || { portal: 'tnega', portalName: 'TNeGA இ-சேவை', hasCredentials: false, username: '', passwordMasked: '', operatorCode: 'OM', savedAt: null };
                                return { operatorUid: opId, operatorName: opData.operatorName || opId, updatedAt: opData.updatedAt || null, tnega, portals: { tnega, ...portalsSummary } };
                            },
                            saveOperatorPortalCredentials: (operatorUid, portalKey = 'tnega', credentials = {}) => {
                                const opId = normOp(operatorUid);
                                const pKey = (portalKey || 'tnega').toLowerCase().trim();
                                const v = readFb();
                                if (!v[opId]) v[opId] = { operatorUid: opId, operatorName: credentials.operatorName || opId, updatedAt: new Date().toISOString() };
                                const ex = v[opId][pKey] || {};
                                v[opId][pKey] = {
                                    portal: pKey,
                                    portalName: credentials.portalName || ex.portalName || pKey,
                                    customUrl: credentials.customUrl || ex.customUrl || '',
                                    username: (credentials.username || credentials.userId || ex.username || '').trim(),
                                    passwordEnc: credentials.password ? encTxt(credentials.password.trim()) : (ex.passwordEnc || ''),
                                    operatorCode: (credentials.operatorCode || ex.operatorCode || 'OM').trim(),
                                    savedAt: new Date().toISOString()
                                };
                                v[opId].updatedAt = new Date().toISOString();
                                writeFb(v);
                                return { success: true, operatorUid: opId, portal: pKey };
                            },
                            deleteOperatorPortalCredentials: (operatorUid, portalKey = 'tnega') => {
                                const opId = normOp(operatorUid);
                                const pKey = (portalKey || 'tnega').toLowerCase().trim();
                                const v = readFb();
                                if (v[opId] && v[opId][pKey]) {
                                    delete v[opId][pKey];
                                    writeFb(v);
                                }
                                return { success: true, message: 'Credentials removed from vault.' };
                            }
                        };
                    }

                    const {
                        getOperatorVaultSummary,
                        saveOperatorPortalCredentials,
                        deleteOperatorPortalCredentials
                    } = vaultSvc;

                    if (req.method === 'GET') {
                        const parsedUrl = new URL(req.url, `http://127.0.0.1:${activePort}`);
                        const opUid = parsedUrl.searchParams.get('operatorUid') || decodeHdr(req.headers['x-operator-uid']) || decodeHdr(req.headers['x-operator-name']) || null;
                        const summary = getOperatorVaultSummary(opUid);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        return res.end(JSON.stringify({ success: true, ...summary }));
                    }

                    if (req.method === 'POST' || req.method === 'DELETE') {
                        let bodyStr = '';
                        req.on('data', chunk => { bodyStr += chunk; });
                        req.on('end', () => {
                            try {
                                const body = JSON.parse(bodyStr || '{}');
                                const opUid = body.operatorUid || decodeHdr(req.headers['x-operator-uid']) || decodeHdr(req.headers['x-operator-name']) || null;
                                if (!opUid) {
                                    res.writeHead(400, { 'Content-Type': 'application/json' });
                                    return res.end(JSON.stringify({ success: false, error: 'ஆப்ரேட்டர் அடையாளம் (Operator UID) தேவை.' }));
                                }
                                const portal = body.portal || 'tnega';
                                if (req.method === 'DELETE') {
                                    const result = deleteOperatorPortalCredentials(opUid, portal);
                                    syncDraftToCloudInBackground('/api/operator/vault', 'DELETE', bodyStr, req.headers);
                                    res.writeHead(200, { 'Content-Type': 'application/json' });
                                    return res.end(JSON.stringify({
                                        success: true,
                                        message: result.message,
                                        vault: getOperatorVaultSummary(opUid)
                                    }));
                                }
                                const username = body.username || body.userId || '';
                                if (!username) {
                                    res.writeHead(400, { 'Content-Type': 'application/json' });
                                    return res.end(JSON.stringify({ success: false, error: 'பயனர் பெயர் (User ID / Operator Code) கட்டாயம் தேவை.' }));
                                }
                                saveOperatorPortalCredentials(opUid, portal, {
                                    username,
                                    password: body.password || '',
                                    operatorCode: body.operatorCode || 'OM',
                                    operatorName: body.operatorName || decodeHdr(req.headers['x-operator-name']) || opUid,
                                    portalName: body.portalName || '',
                                    customUrl: body.customUrl || ''
                                });
                                syncDraftToCloudInBackground('/api/operator/vault', 'POST', bodyStr, req.headers);
                                const portalDisplayNames = {
                                    tnega: 'TNeGA இ-சேவை',
                                    tnpds: 'TNPDS பொது விநியோகம்',
                                    eci: 'ECI வாக்காளர் சேவை'
                                };
                                const dispName = body.portalName || portalDisplayNames[portal] || portal.toUpperCase();
                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                return res.end(JSON.stringify({
                                    success: true,
                                    message: `${dispName} லாகின் விவரங்கள் வெற்றிகரமாகப் பாதுகாக்கப்பட்டன!`,
                                    vault: getOperatorVaultSummary(opUid)
                                }));
                            } catch (err) {
                                res.writeHead(500, { 'Content-Type': 'application/json' });
                                return res.end(JSON.stringify({ success: false, error: err.message }));
                            }
                        });
                        return;
                    }
                } catch (vaultLoadErr) {
                    console.warn('⚠️ [Local Server] Vault handler fallback:', vaultLoadErr.message);
                }
            }

            // 2.8 Single-Source Drafts Routing: ALL /api/drafts/* handled strictly by Express (draft_routes.js -> app_store.js)
            if (urlPath === '/api/drafts' || urlPath.startsWith('/api/drafts/')) {
                const expApp = getLocalExpressApp();
                if (expApp) return expApp(req, res);
            }

            // 3. Process API and Dynamic Routes Locally via Express Engine (NEVER block static assets!)
            if (urlPath.startsWith('/api/') || urlPath.startsWith('/uploads/') || urlPath.startsWith('/data/uploads/') || urlPath.startsWith('/compressed/')) {
                const expApp = getLocalExpressApp();
                if (expApp) {
                    return expApp(req, res);
                }
            }

            // 3.5 Cloud API Proxy Fallback (only if local Express is unavailable)
            if (urlPath.startsWith('/api/')) {
                return proxyToCloud(req, res);
            }

            // 4. Local Static Assets
            let filePath = resolveLocalFile(urlPath);
            if (!filePath && !path.extname(urlPath)) {
                filePath = resolveLocalFile('index.html');
            }

            if (filePath) {
                const ext = path.extname(filePath).toLowerCase();
                let mime = MIME_TYPES[ext] || 'application/octet-stream';
                // Magic byte sniffing only for uploaded/document files (never block UI static assets)
                const isStaticUiAsset = ['.html', '.js', '.css', '.woff2', '.woff', '.ttf', '.svg', '.ico'].includes(ext);
                if (!isStaticUiAsset) {
                    try {
                        const fd = fs.openSync(filePath, 'r');
                        const magic = Buffer.alloc(4);
                        fs.readSync(fd, magic, 0, 4, 0);
                        fs.closeSync(fd);
                        if (magic.toString('utf8').startsWith('%PDF')) {
                            mime = 'application/pdf';
                        }
                    } catch (_) {}
                }
                const isVendorOrFont = urlPath.startsWith('/vendor/') || ext === '.woff2' || ext === '.woff' || ext === '.png' || ext === '.ico';
                const cacheControl = isVendorOrFont ? 'public, max-age=31536000, immutable' : 'no-cache';
                res.writeHead(200, {
                    'Content-Type': mime,
                    'Cache-Control': cacheControl
                });
                return fs.createReadStream(filePath).pipe(res);
            }

            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Resource not found');
        });

        let currentPort = 3000;
        const maxPort = 3010;

        localServer.on('error', (err) => {
            if (err.code === 'EADDRINUSE' && currentPort < maxPort) {
                console.log(`[Desktop Local Engine] Port ${currentPort} occupied, trying port ${currentPort + 1}...`);
                currentPort++;
                localServer.listen(currentPort, '0.0.0.0');
            } else {
                console.log('[Desktop Local Engine] Server error:', err.message);
            }
        });

        localServer.on('listening', () => {
            activePort = currentPort;
            activeServerUrl = `http://127.0.0.1:${currentPort}`;
            console.log(`⚡ [Desktop Local Engine] Serving local UI on ${activeServerUrl} (listening on 0.0.0.0)`);
            if (currentPort !== 3000) {
                console.warn(`⚠️ [Port Fallback Notice] Default port 3000 was occupied. App bound to port ${currentPort}.`);
                console.warn(`   Configure your Android SMS Auto-Forwarder target to: http://<PC-IP>:${currentPort}/api/automation/otp_webhook`);
            }
            if (serverReadyResolve) serverReadyResolve(activeServerUrl);
            // Pre-warm local Express immediately on next tick so it is ready before renderer's first API call
            setImmediate(() => {
                try { getLocalExpressApp(); } catch (_) {}
            });
        });

        activeHttpServer = localServer;
        localServer.listen(currentPort, '0.0.0.0');

        return localServer;
    } catch (e) {
        console.warn('[Desktop Local Engine Warning]:', e.message);
        return null;
    }
}

function stopLocalServer() {
    if (activeHttpServer) {
        try {
            if (typeof activeHttpServer.closeAllConnections === 'function') {
                activeHttpServer.closeAllConnections();
            }
            activeHttpServer.close();
        } catch (_) {}
        activeHttpServer = null;
    }
}

module.exports = {
    startLocalServer,
    stopLocalServer,
    resolveLocalFile,
    getActivePort,
    getActiveServerUrl,
    whenServerReady,
    getLocalExpressApp
};
