const fs = require('fs');
const path = require('path');

async function waitForAutonomousOtp(page, onProgress) {
    let resolvedOtp = '';
    const ipcPath = path.join(__dirname, '..', 'data', 'pending_otp.txt');

    for (let wait = 0; wait < 240; wait++) { // 2 minutes wait
        if (fs.existsSync(ipcPath)) {
            try {
                const diskOtp = fs.readFileSync(ipcPath, 'utf8').trim().replace(/\D/g, '');
                if (diskOtp.length === 6) {
                    resolvedOtp = diskOtp;
                    try { fs.unlinkSync(ipcPath); } catch (_) {}
                    onProgress(`⚡ [Disk IPC] OTP (${resolvedOtp}) பெறப்பட்டது!`);
                    return resolvedOtp;
                }
            } catch (_) {}
        }

        const detected = await page.evaluate(() => {
            const inps = Array.from(document.querySelectorAll('input[formcontrolname*="otp" i], input[placeholder*="OTP" i], input[placeholder*="கடவுச்சொல்" i], .modal input'));
            for (const i of inps) {
                const v = (i.value || '').replace(/\D/g, '');
                if (v.length === 6) return v;
            }
            return null;
        }).catch(() => null);

        if (detected) {
            resolvedOtp = detected;
            onProgress(`🎯 [Screen DOM] திரையில் நீங்கள் உள்ளிட்ட OTP (${resolvedOtp}) நேரடியாகப் பெறப்பட்டது!`);
            return resolvedOtp;
        }

        await new Promise(r => setTimeout(r, 500));
    }
    return null;
}

module.exports = {
    waitForAutonomousOtp
};
