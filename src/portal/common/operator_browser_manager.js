// =========================================================================
// eSevaDraft — Universal Persistent Operator Profile & Browser Manager
// =========================================================================
const fs = require('fs');
const path = require('path');
const os = require('os');

function getOperatorProfilePath() {
    const appData = process.env.APPDATA || (
        process.platform === 'darwin'
            ? path.join(os.homedir(), 'Library', 'Application Support')
            : path.join(os.homedir(), 'AppData', 'Roaming')
    );
    const profileDir = path.join(appData, 'esevadraft-desktop', 'chrome-operator-profile');
    if (!fs.existsSync(profileDir)) {
        try {
            fs.mkdirSync(profileDir, { recursive: true });
        } catch (_) {}
    }
    return profileDir;
}

module.exports = {
    getOperatorProfilePath
};
