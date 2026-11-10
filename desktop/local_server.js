// =========================================================================
// eSevaDraft Desktop App — Local HTTP Engine & API Proxy
// Serves local UI assets instantly (<100ms) with seamless cloud API proxy
// =========================================================================
const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');
const { app, BrowserWindow } = require('electron');
process.env.DESKTOP_RUNTIME = '1';

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
    try {
        if (typeof app !== 'undefined' && app.getPath) {
            candidates.push(path.join(app.getPath('userData'), 'public', clean));
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
        }
    } catch (_) {}
    if (process.resourcesPath) {
        candidates.push(path.join(process.resourcesPath, 'public', clean));
    }
    candidates.push(path.join(__dirname, '..', 'public', clean));
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
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ success: true, savedLocally: true, timestamp }));
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

            const { getCitizenDraft, saveCitizenDraft } = require('../firestore_db');
            let draft = null;
            if (!isTempWalkin && cleanMobile) {
                try { draft = await getCitizenDraft(cleanMobile); } catch (_) {}
            }

            let citizenProfile = (draft && draft.citizenProfile) || {
                mobileNumber: isTempWalkin ? '' : cleanMobile,
                fullNameTam: customerName || '',
                fullNameEng: customerName || ''
            };

            const initialName = (customerName || '').trim();
            if (initialName && !citizenProfile.fullNameTam) {
                citizenProfile.fullNameTam = initialName;
            }

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

            if (!isTempWalkin && cleanMobile) {
                try {
                    await saveCitizenDraft(cleanMobile, {
                        operatorUid,
                        operatorName,
                        operatorMobile,
                        citizenProfile,
                        subService: null,
                        subServiceData: null,
                        documents: (draft && draft.documents) || {},
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
            const candidates = [
                path.join('d:', 'downloads', 'ai assitant 2', 'server.js'),
                path.join(__dirname, '..', 'server.js'),
                path.join(__dirname, 'server.js'),
                path.join(process.resourcesPath || '', 'server.js'),
                path.join(process.resourcesPath || '', 'app.asar.unpacked', 'server.js')
            ];
            if (typeof app !== 'undefined' && app.getPath) {
                candidates.push(path.join(app.getPath('userData'), 'server.js'));
            }
            for (const cand of candidates) {
                if (fs.existsSync(cand)) {
                    try {
                        const mod = require(cand);
                        if (mod && mod.app) {
                            localExpressAppInstance = mod.app;
                            break;
                        }
                    } catch (_) {}
                }
            }
        } catch (_) {}
    }
    return localExpressAppInstance;
}

function proxyToCloud(req, res) {
    const cloudHost = 'esevadraft.in';
    const proxyHeaders = { ...req.headers, host: cloudHost };
    delete proxyHeaders['content-length'];

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
        const bodyStr = payload ? JSON.stringify(payload) : null;
        const reqHeaders = {
            'host': cloudHost,
            'content-type': 'application/json',
            ...customHeaders
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

let activePort = 3000;
let activeServerUrl = 'http://127.0.0.1:3000';
let serverReadyResolve = null;
const serverReadyPromise = new Promise((resolve) => { serverReadyResolve = resolve; });

function getActivePort() { return activePort; }
function getActiveServerUrl() { return activeServerUrl; }
function whenServerReady() { return serverReadyPromise; }

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

            // 2.05 Desktop Live Vision & State Inspector
            if (urlPath === '/api/desktop/inspect-live' || urlPath === '/api/desktop/live-state') {
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
                        const mob = String(body.mobileNumber || '').replace(/\D/g, '').slice(-10);
                        const autoStart = body.autoStart !== false;
                        const { getMainWindow } = require('./window_manager');
                        const { getCitizenDraft } = require('../firestore_db');
                        const { executeLiveDesktopAutomation } = require('./automation_runner');
                        const win = getMainWindow();
                        const draft = await getCitizenDraft(mob);

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
                    const mob = (parsedUrl.searchParams.get('mobile') || req.headers['x-session-mobile'] || '').replace(/\D/g, '').slice(-10);
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

            // 2.8 Local Desktop Drafts & Customer Desk Engine (Direct Local Disk + Firestore Dual-Store)
            if (urlPath === '/api/drafts' && req.method === 'GET') {
                try {
                    const parsedUrl = new URL(req.url, `http://127.0.0.1:${activePort}`);
                    const opUid = parsedUrl.searchParams.get('operatorUid') || req.headers['x-operator-uid'] || null;
                    const { listAllDrafts } = require('../firestore_db');
                    const drafts = await listAllDrafts(opUid);

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ success: true, drafts }));
                } catch (err) {
                    console.warn('⚠️ [Local Server] listAllDrafts fallback to cloud:', err.message);
                    return proxyToCloud(req, res);
                }
            }

            // Local Drafts Listing (0ms Instant Latency - Prevents 30s cloud timeout freezes)
            if ((urlPath === '/api/drafts' || urlPath.startsWith('/api/drafts?')) && req.method === 'GET') {
                try {
                    const { listAllDrafts } = require('../firestore_db');
                    const opUid = req.headers['x-operator-uid'] || null;
                    const drafts = await listAllDrafts(opUid);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ success: true, drafts: drafts || [] }));
                } catch (err) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ success: true, drafts: [] }));
                }
            }

            if (urlPath === '/api/drafts/save' && req.method === 'POST') {
                let bodyStr = '';
                req.on('data', chunk => { bodyStr += chunk; });
                req.on('end', async () => {
                    try {
                        const body = JSON.parse(bodyStr || '{}');
                        const targetMobile = body.mobileNumber || body.customerMobile || req.headers['x-session-mobile'];
                        if (targetMobile) {
                            const { saveCitizenDraft } = require('../firestore_db');
                            await saveCitizenDraft(targetMobile, body);
                            // Dual-Store Invariant: Silently back up to Cloud Firestore in background
                            syncDraftToCloudInBackground('/api/drafts/save', 'POST', body, {
                                'x-operator-uid': body.operatorUid || req.headers['x-operator-uid'] || '',
                                'x-operator-name': encodeURIComponent(body.operatorName || req.headers['x-operator-name'] || '')
                            });
                        }
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        return res.end(JSON.stringify({ success: true, saved: true }));
                    } catch (err) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        return res.end(JSON.stringify({ success: false, error: err.message }));
                    }
                });
                return;
            }

            if (urlPath === '/api/drafts/delete' && req.method === 'POST') {
                let bodyStr = '';
                req.on('data', chunk => { bodyStr += chunk; });
                req.on('end', async () => {
                    try {
                        const body = JSON.parse(bodyStr || '{}');
                        const mob = String(body.mobileNumber || '').trim();
                        if (mob) {
                            const { deleteCitizenDraft } = require('../firestore_db');
                            await deleteCitizenDraft(mob);
                            syncDraftToCloudInBackground(`/api/drafts/${mob}`, 'DELETE', null, {
                                'x-operator-uid': req.headers['x-operator-uid'] || ''
                            });
                        }
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        return res.end(JSON.stringify({ success: true, deleted: true }));
                    } catch (err) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        return res.end(JSON.stringify({ success: false, error: err.message }));
                    }
                });
                return;
            }

            if (urlPath === '/api/drafts/delete-document' && req.method === 'POST') {
                const expApp = getLocalExpressApp();
                if (expApp) return expApp(req, res);
                let bodyStr = '';
                req.on('data', chunk => { bodyStr += chunk; });
                req.on('end', async () => {
                    try {
                        const body = JSON.parse(bodyStr || '{}');
                        const mob = String(body.mobileNumber || body.mobile || req.headers['x-session-mobile'] || '').trim();
                        const docType = String(body.docType || '').trim();
                        const memberIndex = parseInt(body.memberIndex || '0', 10);
                        if (mob && docType) {
                            const { removeDraftDocument } = require('../src/services/draft_document_resolver');
                            await removeDraftDocument(mob, docType, memberIndex);
                        }
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        return res.end(JSON.stringify({ success: true, message: 'Document deleted successfully', docType }));
                    } catch (err) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        return res.end(JSON.stringify({ success: false, error: err.message }));
                    }
                });
                return;
            }

            const draftSingleMatch = urlPath.match(/^\/api\/drafts\/([a-zA-Z0-9_+]+)(\/.*)?$/);
            if (draftSingleMatch) {
                const mob = draftSingleMatch[1];
                const subAction = draftSingleMatch[2];

                if (!subAction && req.method === 'GET') {
                    try {
                        const { getCitizenDraft } = require('../firestore_db');
                        const draft = await getCitizenDraft(mob);
                        if (draft && !draft.isDeleted && draft.status !== 'TRASHED') {
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            return res.end(JSON.stringify({ success: true, draft }));
                        }
                    } catch (_) {}
                    return proxyToCloud(req, res);
                }

                if (subAction === '/documents-list' && req.method === 'GET') {
                    try {
                        const { getCitizenDraft } = require('../firestore_db');
                        let draft = await getCitizenDraft(mob);
                        if (!draft || draft.isDeleted || draft.status === 'TRASHED') {
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            return res.end(JSON.stringify({ success: true, mobileNumber: mob, count: 0, documents: [] }));
                        }
                        let docs = [];
                        try {
                            const { extractDraftDocumentsList } = require('../src/services/draft_document_list');
                            docs = extractDraftDocumentsList(mob, draft);
                        } catch (_) {
                            // Direct fallback document extraction if draft_document_list module path differs in asar
                            const prof = draft?.citizenProfile || draft || {};
                            const dMap = draft?.documents || prof.documents || {};
                            const b64Map = draft?.base64Docs || prof.base64Docs || {};
                            const checkExists = (p, b) => (b && b.length > 500) || (p && typeof p === 'string' && p.length > 3 && fs.existsSync(p) && fs.statSync(p).size > 100);
                            if (checkExists(dMap.profilePhoto || prof.headPhotoPath, b64Map.profilePhotoBase64)) {
                                docs.push({ type: 'profilePhoto', title: 'குடும்பத் தலைவர் புகைப்படம்', titleEng: 'Head Passport Photo', downloadUrl: `/api/drafts/${mob}/doc/profilePhoto?download=1`, previewUrl: `/api/drafts/${mob}/doc/profilePhoto`, icon: 'fa-user' });
                            }
                            if (checkExists(dMap.headAadhaar || prof.headAadhaarDocPath, b64Map.headAadhaarBase64)) {
                                const hName = prof.fullNameTam || prof.fullNameEng || 'தலைவர்';
                                docs.push({ type: 'headAadhaar', title: `குடும்பத் தலைவர் ஆதார் (${hName})`, titleEng: 'Head of Family Aadhaar', downloadUrl: `/api/drafts/${mob}/doc/headAadhaar?download=1`, previewUrl: `/api/drafts/${mob}/doc/headAadhaar`, icon: 'fa-id-card' });
                            }
                            const hasGas = checkExists(dMap.gasBook || prof.gasDetails?.gasBookPath, b64Map.gasBookBase64);
                            if (hasGas) {
                                docs.push({ type: 'gasBook', title: 'எரிவாயு இணைப்பு அட்டை / ரசீது', titleEng: 'Gas Consumer Book / Receipt', downloadUrl: `/api/drafts/${mob}/doc/gasBook?download=1`, previewUrl: `/api/drafts/${mob}/doc/gasBook`, icon: 'fa-fire' });
                            } else if (checkExists(dMap.residenceProof || prof.residenceProof?.docPath, b64Map.residenceProofBase64)) {
                                docs.push({ type: 'residenceProof', title: prof.residenceProof?.typeTam || 'குடியிருப்புச் சான்று', titleEng: 'Residence Proof', downloadUrl: `/api/drafts/${mob}/doc/residenceProof?download=1`, previewUrl: `/api/drafts/${mob}/doc/residenceProof`, icon: 'fa-house' });
                            }
                        }
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        return res.end(JSON.stringify({ success: true, mobileNumber: mob, count: docs.length, documents: docs }));
                    } catch (e) {
                        console.warn('⚠️ [Local Server] documents-list extraction error:', e.message);
                    }
                }

                if (subAction && subAction.startsWith('/doc/')) {
                    const docType = subAction.replace('/doc/', '').split('?')[0];
                    try {
                        const { getCitizenDraft } = require('../firestore_db');
                        const draft = await getCitizenDraft(mob);
                        const prof = draft?.citizenProfile || draft || {};
                        const dMap = draft?.documents || prof.documents || {};
                        let docPath = dMap[docType] || prof[docType];
                        if (docType === 'profilePhoto' && !docPath) docPath = prof.headPhotoPath;
                        if (docType === 'headAadhaar' && !docPath) docPath = prof.headAadhaarDocPath || prof.members?.[0]?.docPath;
                        if (docType === 'gasBook' && !docPath) docPath = prof.gasDetails?.gasBookPath || dMap.residenceProof || prof.residenceProof?.docPath;
                        if (docType === 'residenceProof' && !docPath) docPath = prof.residenceProof?.docPath || dMap.gasBook || prof.gasDetails?.gasBookPath;
                        if (docType === 'memberAadhaar' && !docPath) docPath = prof.subServiceData?.docPath || prof.members?.[0]?.docPath;

                        if ((docType === 'gasBook' || docType === 'residenceProof') && (!docPath || !fs.existsSync(docPath))) {
                            const candidateGasDirs = [
                                path.join(__dirname, '..', 'data', 'uploads', mob),
                                path.join(process.env.APPDATA || 'C:\\Users\\ADMIN\\AppData\\Roaming', 'esevadraft-desktop', 'data', 'uploads', mob)
                            ];
                            for (const d of candidateGasDirs) {
                                if (fs.existsSync(d)) {
                                    for (const gn of ['gas.jpg', 'gas.jpeg', 'gas.png', 'gasBook.jpg', 'residenceProof.jpg']) {
                                        const gp = path.join(d, gn);
                                        if (fs.existsSync(gp) && fs.statSync(gp).size > 100) {
                                            docPath = gp;
                                            break;
                                        }
                                    }
                                }
                                if (docPath && fs.existsSync(docPath)) break;
                            }
                        }

                        if (docPath && typeof docPath === 'string' && !fs.existsSync(docPath)) {
                            const relClean = docPath.replace(/^[/\\]+/, '');
                            const candidates = [
                                path.join('d:', 'downloads', 'ai assitant 2', relClean),
                                path.join(__dirname, '..', relClean),
                                path.join('d:', 'downloads', 'ai assitant 2', 'uploads', path.basename(docPath)),
                                path.join('d:', 'downloads', 'ai assitant 2', 'compressed', path.basename(docPath))
                            ];
                            for (const c of candidates) {
                                if (fs.existsSync(c)) {
                                    docPath = c;
                                    break;
                                }
                            }
                        }

                        if (docPath && typeof docPath === 'string' && fs.existsSync(docPath)) {
                            const ext = path.extname(docPath).toLowerCase();
                            let mime = MIME_TYPES[ext] || 'image/jpeg';
                            try {
                                const fd = fs.openSync(docPath, 'r');
                                const magic = Buffer.alloc(4);
                                fs.readSync(fd, magic, 0, 4, 0);
                                fs.closeSync(fd);
                                if (magic.toString('utf8').startsWith('%PDF')) {
                                    mime = 'application/pdf';
                                }
                            } catch (_) {}
                            res.writeHead(200, {
                                'Content-Type': mime,
                                'Content-Disposition': 'inline',
                                'Cache-Control': 'no-cache'
                            });
                            return fs.createReadStream(docPath).pipe(res);
                        }
                    } catch (_) {}
                }

                if (subAction === '/trash' && req.method === 'POST') {
                    try {
                        const { trashCitizenDraft } = require('../firestore_db');
                        await trashCitizenDraft(mob);
                        syncDraftToCloudInBackground(`/api/drafts/${mob}/trash`, 'POST', null, {
                            'x-operator-uid': req.headers['x-operator-uid'] || ''
                        });
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        return res.end(JSON.stringify({ success: true, trashed: true }));
                    } catch (err) {
                        return proxyToCloud(req, res);
                    }
                }

                if (subAction === '/restore' && req.method === 'POST') {
                    try {
                        const { restoreCitizenDraft } = require('../firestore_db');
                        await restoreCitizenDraft(mob);
                        syncDraftToCloudInBackground(`/api/drafts/${mob}/restore`, 'POST', null, {
                            'x-operator-uid': req.headers['x-operator-uid'] || ''
                        });
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        return res.end(JSON.stringify({ success: true, restored: true }));
                    } catch (err) {
                        return proxyToCloud(req, res);
                    }
                }

                if ((subAction === '/permanent-delete' && req.method === 'POST') || (!subAction && req.method === 'DELETE')) {
                    try {
                        const { deleteCitizenDraft } = require('../firestore_db');
                        await deleteCitizenDraft(mob);
                        syncDraftToCloudInBackground(`/api/drafts/${mob}`, 'DELETE', null, {
                            'x-operator-uid': req.headers['x-operator-uid'] || ''
                        });
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        return res.end(JSON.stringify({ success: true, deleted: true }));
                    } catch (err) {
                        return proxyToCloud(req, res);
                    }
                }
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
            // Pre-warm local Express asynchronously after UI static assets begin streaming
            setTimeout(() => {
                try { getLocalExpressApp(); } catch (_) {}
            }, 250);
        });

        localServer.listen(currentPort, '0.0.0.0');

        return localServer;
    } catch (e) {
        console.warn('[Desktop Local Engine Warning]:', e.message);
        return null;
    }
}

module.exports = {
    startLocalServer,
    resolveLocalFile,
    getActivePort,
    getActiveServerUrl,
    whenServerReady,
    getLocalExpressApp
};
