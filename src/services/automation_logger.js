/**
 * src/services/automation_logger.js - Segregated & Real-Time Automation Logger (<300 lines)
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

// Standardized automation service slug map
const SERVICE_NAME_MAP = {
    new_ration_card: 'new_ration_card', 'new-card': 'new_ration_card', newcard: 'new_ration_card', ration_card: 'new_ration_card', ration_new: 'new_ration_card', 'புதிய குடும்ப அட்டை': 'new_ration_card',
    add_member: 'add_member', addmember: 'add_member', 'add-member': 'add_member', ration_add_member: 'add_member', 'உறுப்பினர் சேர்க்கை': 'add_member',
    change_address: 'change_address', changeaddress: 'change_address', 'change-address': 'change_address', ration_change_address: 'change_address', 'முகவரி மாற்றம்': 'change_address',
    tnega_income: 'tnega_income', 'வருமானச் சான்றிதழ்': 'tnega_income', tnega_community: 'tnega_community', 'சாதிச் சான்றிதழ்': 'tnega_community',
    tnega_nativity: 'tnega_nativity', 'இருப்பிடச் சான்றிதழ்': 'tnega_nativity', tnega_first_graduate: 'tnega_first_graduate', nvsp_voter: 'nvsp_voter', patta_chitta: 'patta_chitta'
};

function sanitizeLogKey(key, fallback = 'general') {
    if (!key || typeof key !== 'string') return fallback;
    const sanitized = key.trim().toLowerCase()
        .replace(/[^a-z0-9_-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
    return sanitized || fallback;
}

function resolveAutomationName(serviceKey, fallback = 'new_ration_card') {
    if (!serviceKey || typeof serviceKey !== 'string') return fallback;
    const clean = serviceKey.trim().toLowerCase();
    if (SERVICE_NAME_MAP[clean]) return SERVICE_NAME_MAP[clean];
    for (const [pattern, canonical] of Object.entries(SERVICE_NAME_MAP)) {
        if (clean.includes(pattern.toLowerCase())) return canonical;
    }
    return sanitizeLogKey(serviceKey, fallback);
}

function updateLatestRunPointer(meta = {}) {
    try {
        const payload = JSON.stringify(meta, null, 2);
        const candidates = [
            path.join('d:', 'downloads', 'ai assitant 2', 'data', 'latest_automation_run.json'),
            path.join(__dirname, '..', '..', 'data', 'latest_automation_run.json'),
            path.join(process.env.APPDATA || '', 'esevadraft-desktop', 'data', 'latest_automation_run.json')
        ];
        for (const p of candidates) {
            try {
                if (fs.existsSync(path.dirname(p))) fs.writeFileSync(p, payload, 'utf8');
            } catch (_) {}
        }
    } catch (_) {}
}

function resolveBaseLogsDirs(customDir) {
    const dirs = [];
    if (customDir && typeof customDir === 'string') {
        try {
            if (!fs.existsSync(customDir)) fs.mkdirSync(customDir, { recursive: true });
            dirs.push(customDir);
        } catch (e) {}
    }
    const appDataDir = path.join(process.env.APPDATA || 'C:\\Users\\ADMIN\\AppData\\Roaming', 'esevadraft-desktop', 'logs');
    try {
        if (!fs.existsSync(appDataDir)) fs.mkdirSync(appDataDir, { recursive: true });
        if (!dirs.includes(appDataDir)) dirs.push(appDataDir);
    } catch (e) {}

    const wsDir = path.join('d:', 'downloads', 'ai assitant 2', 'public', 'logs');
    try {
        if (!fs.existsSync(wsDir)) fs.mkdirSync(wsDir, { recursive: true });
        if (!dirs.includes(wsDir)) dirs.push(wsDir);
    } catch (e) {}

    return dirs;
}

function createAutomationLogger(options = {}) {
    const rawOperator = options.operatorName || options.draftData?.operatorName || options.draftData?.operatorDisplayName || options.operatorMobile || options.operatorUid || 'admin';
    const rawAutomation = options.automationName || options.serviceName || options.subService || options.draftData?.subService || 'new_ration_card';
    const customerMobile = (options.customerMobile || options.citizenProfile?.mobileNumber || options.draftData?.mobileNumber || 'unknown').toString().replace(/[^0-9]/g, '') || 'unknown';
    const customerName = options.customerName || options.citizenProfile?.fullNameEng || options.citizenProfile?.fullNameTam || options.draftData?.customerName || 'Customer';
    const isMock = Boolean(options.isMockSandbox);

    const operatorSlug = sanitizeLogKey(rawOperator, 'general_operator');
    const automationSlug = resolveAutomationName(rawAutomation, 'new_ration_card');
    const baseLogsDirs = resolveBaseLogsDirs(options.baseLogsDir);

    const timestamp = Date.now();
    const fileName = `${customerMobile}_${timestamp}.log`;
    const targetFilePaths = [];

    for (const bDir of baseLogsDirs) {
        try {
            const tDir = path.join(bDir, operatorSlug, automationSlug);
            if (!fs.existsSync(tDir)) fs.mkdirSync(tDir, { recursive: true });
            targetFilePaths.push(path.join(tDir, fileName));
            targetFilePaths.push(path.join(bDir, 'latest_run.log'));
        } catch (_) {}
    }

    const logFilePath = targetFilePaths[0] || path.join(process.env.APPDATA || '', 'esevadraft-desktop', 'logs', fileName);
    const relativeLogPath = path.join(operatorSlug, automationSlug, fileName).replace(/\\/g, '/');

    // Write metadata header synchronously so file exists immediately on disk
    const isoStart = new Date().toISOString();
    const localStart = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const header = [
        '================================================================================',
        'eSeva Automation Session Log',
        '--------------------------------------------------------------------------------',
        `OPERATOR    : ${rawOperator} [slug: ${operatorSlug}]`,
        `AUTOMATION  : ${rawAutomation} [canonical: ${automationSlug}]`,
        `CUSTOMER    : ${customerMobile} (${customerName})`,
        `STARTED AT  : ${isoStart} (${localStart} IST)`,
        `MODE        : ${isMock ? 'MOCK SANDBOX (Test)' : 'LIVE PRODUCTION (Govt Portal)'}`,
        '================================================================================\n'
    ].join('\n');

    for (const fp of targetFilePaths) {
        try { fs.writeFileSync(fp, header, 'utf8'); } catch (_) {}
    }

    updateLatestRunPointer({
        timestamp: isoStart,
        localTime: localStart,
        operator: rawOperator,
        operatorSlug,
        automation: rawAutomation,
        automationSlug,
        customerMobile,
        customerName,
        isMock,
        isDryRun: Boolean(options.isDryRun),
        logFilePath,
        status: 'RUNNING'
    });

    function logDiag(stepNo, type, msg, data = null) {
        const time = new Date().toISOString();
        const typeStr = (type || 'INFO').toUpperCase();
        const dataStr = data ? ` ${typeof data === 'string' ? data : JSON.stringify(data)}` : '';
        const entry = `[${time}] [STEP_${stepNo}] [${typeStr}] ${msg}${dataStr}\n`;
        console.log(`[Step ${stepNo}] [${typeStr}] ${msg}`);
        for (const fp of targetFilePaths) {
            try { fs.appendFileSync(fp, entry); } catch (_) {}
        }
        if (typeStr === 'FAIL' || typeStr === 'ERROR' || typeStr === 'FATAL_ERROR' || typeStr === 'HALT') {
            updateLatestRunPointer({
                timestamp: time,
                operator: rawOperator,
                operatorSlug,
                automation: rawAutomation,
                automationSlug,
                customerMobile,
                lastStep: stepNo,
                status: 'ERROR',
                lastMessage: msg,
                logFilePath
            });
        }
        if (typeof options.onTelemetry === 'function' && (typeStr === 'FAIL' || typeStr === 'ERROR' || typeStr === 'FATAL_ERROR')) {
            try {
                options.onTelemetry(stepNo, typeStr, msg, data);
            } catch (te) {}
        }
    }

    function log(msg) {
        const time = new Date().toISOString();
        const entry = `[${time}] ${msg}\n`;
        for (const fp of targetFilePaths) {
            try { fs.appendFileSync(fp, entry); } catch (_) {}
        }
    }

    function close() {
        try {
            if (logStream) {
                if (typeof logStream.end === 'function') logStream.end();
                if (typeof logStream.destroy === 'function') logStream.destroy();
            }
        } catch (e) {}
    }

    const logStream = {
        write: (chunk) => {
            for (const fp of targetFilePaths) {
                try { fs.appendFileSync(fp, chunk); } catch (_) {}
            }
        },
        end: () => {}
    };

    return {
        operatorSlug,
        automationSlug,
        logFilePath,
        relativeLogPath,
        logStream,
        logDiag,
        log,
        close
    };
}

function listOperatorLogs(baseLogsDir = null, operatorFilter = null, serviceFilter = null) {
    const rootDir = resolveBaseLogsDir(baseLogsDir);
    const results = [];
    if (!fs.existsSync(rootDir)) return results;

    const opDirs = fs.readdirSync(rootDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);

    for (const op of opDirs) {
        if (operatorFilter && op.toLowerCase() !== operatorFilter.toLowerCase()) continue;
        const opPath = path.join(rootDir, op);
        let srvDirs = [];
        try {
            srvDirs = fs.readdirSync(opPath, { withFileTypes: true })
                .filter(d => d.isDirectory())
                .map(d => d.name);
        } catch (e) {
            continue;
        }

        for (const srv of srvDirs) {
            if (serviceFilter && srv.toLowerCase() !== serviceFilter.toLowerCase()) continue;
            const srvPath = path.join(opPath, srv);
            let files = [];
            try {
                files = fs.readdirSync(srvPath).filter(f => f.endsWith('.log'));
            } catch (e) {
                continue;
            }

            for (const f of files) {
                const fullP = path.join(srvPath, f);
                try {
                    const stat = fs.statSync(fullP);
                    results.push({
                        operator: op,
                        automation: srv,
                        fileName: f,
                        filePath: fullP,
                        relativeUrl: `/logs/${op}/${srv}/${f}`,
                        size: stat.size,
                        modifiedAt: stat.mtime
                    });
                } catch (e) {}
            }
        }
    }

    results.sort((a, b) => b.modifiedAt - a.modifiedAt);
    return results;
}

function getLatestAutomationRun(operatorFilter = null) {
    const logs = listOperatorLogs(null, operatorFilter);
    if (!logs || logs.length === 0) {
        const candidates = [
            path.join('d:', 'downloads', 'ai assitant 2', 'data', 'latest_automation_run.json'),
            path.join(__dirname, '..', '..', 'data', 'latest_automation_run.json'),
            path.join(process.env.APPDATA || '', 'esevadraft-desktop', 'data', 'latest_automation_run.json')
        ];
        for (const p of candidates) {
            try { if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) {}
        }
        return null;
    }
    const top = logs[0];
    let recentLines = [];
    try {
        recentLines = fs.readFileSync(top.filePath, 'utf8').split('\n').filter(Boolean).slice(-30);
    } catch (_) {}
    return { ...top, recentLines };
}

function resolveBaseLogsDir(customDir) {
    const dirs = resolveBaseLogsDirs(customDir);
    return dirs[0] || path.join(process.env.APPDATA || 'C:\\Users\\ADMIN\\AppData\\Roaming', 'esevadraft-desktop', 'logs');
}

module.exports = {
    SERVICE_NAME_MAP,
    sanitizeLogKey,
    resolveAutomationName,
    resolveBaseLogsDirs,
    resolveBaseLogsDir,
    updateLatestRunPointer,
    createAutomationLogger,
    listOperatorLogs,
    getLatestAutomationRun
};
