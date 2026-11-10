/**
 * eSevaDraft - Universal Automation Step Checkpoint Service
 * 
 * 🔒 ZERO-DATA-LOSS CONTRACT:
 * Saves every single automation step individually to disk as it completes.
 * If the portal refreshes, disconnects, or halts, the operator can resume
 * directly from the exact saved step without restarting from Step 1.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

function getCheckpointDir() {
    const localDir = path.join(__dirname, '..', '..', 'data', 'checkpoints');
    try {
        if (!fs.existsSync(localDir)) {
            fs.mkdirSync(localDir, { recursive: true });
        }
        return localDir;
    } catch (e) {
        const fallbackDir = path.join(os.tmpdir(), 'esevadraft', 'checkpoints');
        try {
            if (!fs.existsSync(fallbackDir)) {
                fs.mkdirSync(fallbackDir, { recursive: true });
            }
        } catch (e2) {}
        return fallbackDir;
    }
}

/**
 * Saves an individual automation step checkpoint to disk.
 */
function saveStepCheckpoint(mobile, serviceName, stepNumber, stepName, extraData = {}) {
    try {
        const cleanMobile = String(mobile || '').replace(/\D/g, '') || 'default';
        const cleanService = String(serviceName || 'automation').toLowerCase().replace(/[^a-z0-9_]/g, '_');
        const dir = getCheckpointDir();
        const filePath = path.join(dir, `${cleanMobile}_${cleanService}.json`);

        let history = [];
        if (fs.existsSync(filePath)) {
            try {
                const prev = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                if (Array.isArray(prev.history)) {
                    history = prev.history;
                }
            } catch (_) {}
        }

        const stepRecord = {
            stepNumber: Number(stepNumber) || 0,
            stepName: String(stepName || ''),
            savedAt: new Date().toISOString(),
            ...extraData
        };

        // Add to history if not duplicate of last
        const last = history[history.length - 1];
        if (!last || last.stepNumber !== stepRecord.stepNumber || last.stepName !== stepRecord.stepName) {
            history.push(stepRecord);
            if (history.length > 100) history.shift();
        }

        const checkpointData = {
            mobile: cleanMobile,
            service: cleanService,
            lastCompletedStep: Number(stepNumber) || 0,
            lastCompletedStepName: String(stepName || ''),
            lastUpdated: new Date().toISOString(),
            history
        };

        fs.writeFileSync(filePath, JSON.stringify(checkpointData, null, 2), 'utf8');

        // Also duplicate to AppData for Desktop App persistence
        const appDataDir = path.join(process.env.APPDATA || 'C:\\Users\\ADMIN\\AppData\\Roaming', 'esevadraft-desktop', 'data', 'checkpoints');
        try {
            if (!fs.existsSync(appDataDir)) fs.mkdirSync(appDataDir, { recursive: true });
            fs.writeFileSync(path.join(appDataDir, `${cleanMobile}_${cleanService}.json`), JSON.stringify(checkpointData, null, 2), 'utf8');
        } catch (_) {}

        return { success: true, checkpoint: checkpointData };
    } catch (err) {
        console.warn(`⚠️ [Checkpoint] Could not save step checkpoint: ${err.message}`);
        return { success: false, error: err.message };
    }
}

/**
 * Retrieves the last saved step checkpoint for a customer & service.
 */
function getStepCheckpoint(mobile, serviceName) {
    try {
        const cleanMobile = String(mobile || '').replace(/\D/g, '') || 'default';
        const cleanService = String(serviceName || 'automation').toLowerCase().replace(/[^a-z0-9_]/g, '_');
        
        const candidatePaths = [
            path.join(getCheckpointDir(), `${cleanMobile}_${cleanService}.json`),
            path.join(process.env.APPDATA || 'C:\\Users\\ADMIN\\AppData\\Roaming', 'esevadraft-desktop', 'data', 'checkpoints', `${cleanMobile}_${cleanService}.json`)
        ];

        for (const p of candidatePaths) {
            if (fs.existsSync(p)) {
                try {
                    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
                    return { success: true, exists: true, checkpoint: data };
                } catch (_) {}
            }
        }

        return { success: true, exists: false, checkpoint: null };
    } catch (err) {
        return { success: false, exists: false, error: err.message };
    }
}

/**
 * Clears the checkpoint after successful application submission.
 */
function clearStepCheckpoint(mobile, serviceName) {
    try {
        const cleanMobile = String(mobile || '').replace(/\D/g, '') || 'default';
        const cleanService = String(serviceName || 'automation').toLowerCase().replace(/[^a-z0-9_]/g, '_');
        
        const candidatePaths = [
            path.join(getCheckpointDir(), `${cleanMobile}_${cleanService}.json`),
            path.join(process.env.APPDATA || 'C:\\Users\\ADMIN\\AppData\\Roaming', 'esevadraft-desktop', 'data', 'checkpoints', `${cleanMobile}_${cleanService}.json`)
        ];

        for (const p of candidatePaths) {
            try {
                if (fs.existsSync(p)) fs.unlinkSync(p);
            } catch (_) {}
        }
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

module.exports = {
    saveStepCheckpoint,
    getStepCheckpoint,
    clearStepCheckpoint,
    getCheckpointDir
};
