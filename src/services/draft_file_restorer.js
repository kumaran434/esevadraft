const path = require('path');
const fs = require('fs');
const { downloadDocFromStorage } = require('../../firestore_db');

async function resolveOrRestoreFile(filePath, b64Data, fallbackName, storageUrl) {
    if (filePath && fs.existsSync(filePath)) return path.resolve(filePath);
    if (filePath && typeof filePath === 'string') {
        const bName = path.basename(filePath);
        const localUpload = path.join(__dirname, '..', '..', 'uploads', bName);
        if (fs.existsSync(localUpload)) return path.resolve(localUpload);
        const localComp = path.join(__dirname, '..', '..', 'compressed', bName);
        if (fs.existsSync(localComp)) return path.resolve(localComp);
        const cwdUpload = path.join(process.cwd(), 'uploads', bName);
        if (fs.existsSync(cwdUpload)) return path.resolve(cwdUpload);
    }
    const sUrl = (storageUrl && typeof storageUrl === 'string' && storageUrl.startsWith('gs://'))
        ? storageUrl
        : (filePath && typeof filePath === 'string' && filePath.startsWith('gs://') ? filePath : null);
    if (sUrl && typeof downloadDocFromStorage === 'function') {
        try {
            const fName = sUrl.split('/').pop() || `${fallbackName}.jpeg`;
            const target = path.join(__dirname, '..', '..', 'uploads', fName);
            const dl = await downloadDocFromStorage(sUrl, target);
            if (dl && fs.existsSync(dl)) return dl;
        } catch (e) {}
    }
    if (b64Data) {
        try {
            const clean = typeof b64Data === 'string' && b64Data.includes('base64,') ? b64Data.split('base64,')[1] : b64Data;
            const buf = Buffer.from(clean, 'base64');
            const compDir = path.join(__dirname, '..', '..', 'compressed');
            if (!fs.existsSync(compDir)) fs.mkdirSync(compDir, { recursive: true });
            const targetFile = path.join(compDir, `${fallbackName}_${Date.now()}.jpeg`);
            fs.writeFileSync(targetFile, buf);
            return targetFile;
        } catch (e) {}
    }
    return null;
}

module.exports = {
    resolveOrRestoreFile
};
