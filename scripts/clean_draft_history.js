const fs = require('fs');
const path = require('path');
const os = require('os');

const targetFiles = [
    path.join(__dirname, '..', 'data', 'sessions.json'),
    path.join(__dirname, '..', 'data', 'drafts', '9790170026.json'),
    path.join(os.homedir(), 'AppData', 'Roaming', 'esevadraft-desktop', 'data', 'sessions.json'),
    path.join(os.homedir(), 'AppData', 'Roaming', 'esevadraft-desktop', 'data', 'drafts', '9790170026.json')
];

function isStepLog(text) {
    if (!text || typeof text !== 'string') return false;
    return text.includes('[படி ') ||
           text.includes('[Step ') ||
           text.includes('Toast Message') ||
           text.includes('பூட்டப்பட்டது') ||
           text.includes('சரிபார்க்கப்படுகிறது...') ||
           text.includes('Google Chrome தயார்') ||
           text.includes('Strict Gate Halt') ||
           text.includes('OTP_NOT_VERIFIED') ||
           text.includes('தட்டச்சு செய்யப்படுகிறது') ||
           text.includes('அரசு TNPDS போர்ட்டல் உங்கள் கைபேசி எண்ணிற்கு');
}

for (const file of targetFiles) {
    if (!fs.existsSync(file)) continue;
    try {
        const raw = fs.readFileSync(file, 'utf8');
        const data = JSON.parse(raw);
        let modified = false;

        // If it's sessions.json
        if (typeof data === 'object' && !Array.isArray(data)) {
            for (const key of Object.keys(data)) {
                if (data[key] && Array.isArray(data[key].chatHistory)) {
                    const before = data[key].chatHistory.length;
                    data[key].chatHistory = data[key].chatHistory.filter(m => !isStepLog(m.text));
                    if (data[key].chatHistory.length !== before) modified = true;
                }
            }
        }

        // If it has chatHistory directly (draft file)
        if (Array.isArray(data.chatHistory)) {
            const before = data.chatHistory.length;
            data.chatHistory = data.chatHistory.filter(m => !isStepLog(m.text));
            if (data.chatHistory.length !== before) modified = true;
        }

        if (modified) {
            fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
            console.log(`✅ Cleaned: ${file}`);
        } else {
            console.log(`ℹ️ Already clean: ${file}`);
        }
    } catch (e) {
        console.error(`❌ Error cleaning ${file}:`, e.message);
    }
}
