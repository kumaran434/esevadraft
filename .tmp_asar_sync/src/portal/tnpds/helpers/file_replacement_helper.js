/**
 * eSevaDraft TNPDS Aadhaar Verhoeff & File Replacement Helper
 */
const verhoeffD = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
    [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
    [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
    [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
    [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
];

const verhoeffP = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
    [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
    [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
    [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
];

const verhoeffInv = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

let isWaitingForReplacementFile = false;
let currentReplacementType = '';
let pendingFileResolver = null;

function isValidAadhaarVerhoeff(num) {
    if (!num) return false;
    const clean = String(num).replace(/\D/g, '');
    if (clean.length !== 12) return false;
    if (/^(\d)\1{11}$/.test(clean)) return false;
    let c = 0;
    const rev = clean.split('').reverse().map(Number);
    for (let i = 0; i < rev.length; i++) {
        c = verhoeffD[c][verhoeffP[i % 8][rev[i]]];
    }
    return c === 0;
}

function fixAadhaarVerhoeffChecksum(num11or12) {
    const clean = String(num11or12).replace(/\D/g, '').slice(0, 11);
    if (clean.length < 11) return num11or12;
    let c = 0;
    const rev = clean.split('').reverse().map(Number);
    for (let i = 0; i < rev.length; i++) {
        c = verhoeffD[c][verhoeffP[(i + 1) % 8][rev[i]]];
    }
    return clean + verhoeffInv[c];
}

function requestReplacementFileFromUser(promptMsg, onProgress, fileType = 'HEAD_PHOTO', isMockSandboxMode = true) {
    if (isMockSandboxMode) {
        onProgress(promptMsg);
        onProgress(`🤖 [Mock Sandbox] மாற்று ஆவணம் தானாக உருவகப்படுத்தப்பட்டு தொடர்கிறது...`);
        return Promise.resolve(null);
    }
    isWaitingForReplacementFile = true;
    currentReplacementType = fileType;
    return new Promise((resolve) => {
        onProgress(promptMsg);
        pendingFileResolver = (filePath) => {
            isWaitingForReplacementFile = false;
            currentReplacementType = '';
            resolve(filePath);
        };
    });
}

function provideReplacementFile(filePath) {
    if (pendingFileResolver) {
        pendingFileResolver(filePath);
        pendingFileResolver = null;
        isWaitingForReplacementFile = false;
        currentReplacementType = '';
        return true;
    }
    return false;
}

function getLiveReplacementStatus() {
    return {
        isWaitingForFile: isWaitingForReplacementFile,
        fileType: currentReplacementType
    };
}

module.exports = {
    isValidAadhaarVerhoeff,
    fixAadhaarVerhoeffChecksum,
    requestReplacementFileFromUser,
    provideReplacementFile,
    getLiveReplacementStatus
};
