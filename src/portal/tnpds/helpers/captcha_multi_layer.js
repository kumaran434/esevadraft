/**
 * eSevaDraft TNPDS Multi-Layer AI Captcha Solver & Auto-Clicker
 */
const path = require('path');
const { humanClick, humanType } = require('./human_kinetics');
const { showBrowserHud } = require('./browser_hud');

let lastCaptchaClickTime = 0;

function getActiveGeminiApiKey(options = {}) {
    if (options && options.geminiApiKey) return options.geminiApiKey;
    if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
    try {
        require('dotenv').config({ path: path.join(__dirname, '..', '..', '..', '..', '.env') });
        if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
        const appDataEnv = path.join(process.env.APPDATA || '', 'esevadraft-desktop', '.env');
        require('dotenv').config({ path: appDataEnv });
        if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
    } catch (_) {}
    return process.env.GEMINI_API_KEY || '';
}

async function solveCaptchaWithMultiLayerAi(imgInput, apiKey, options = {}) {
    let rawB64 = '';
    let isJpeg = false;

    if (typeof imgInput === 'string') {
        rawB64 = imgInput.includes('base64,') ? imgInput.split('base64,')[1] : imgInput;
        isJpeg = imgInput.toLowerCase().includes('jpeg') || imgInput.toLowerCase().includes('jpg') || rawB64.startsWith('/9j/');
    } else if (Buffer.isBuffer(imgInput)) {
        rawB64 = imgInput.toString('base64');
        isJpeg = rawB64.startsWith('/9j/');
    }

    if (!rawB64) return null;
    const mimeType = isJpeg ? 'image/jpeg' : 'image/png';

    if (apiKey) {
        try {
            const { GoogleGenAI } = require('@google/genai');
            const ai = new GoogleGenAI({ apiKey });
            for (const mName of ['gemini-flash-latest', 'gemini-3.8-flash']) {
                try {
                    const ocrRes = await ai.models.generateContent({
                        model: mName,
                        contents: [
                            {
                                role: 'user',
                                parts: [
                                    { inlineData: { mimeType, data: rawB64 } },
                                    { text: 'Extract the 6 alphanumeric characters from this captcha image. Output ONLY the code, nothing else.' }
                                ]
                            }
                        ],
                        config: { systemInstruction: 'You are an automated OCR tool for reading CAPTCHAs. Your output must strictly be only the alphanumeric characters in the image. No formatting, no words, no explanations.' }
                    });
                    if (ocrRes && ocrRes.text) {
                        const rawText = ocrRes.text.trim();
                        const match = rawText.match(/(\*\*|`|"|')?([a-zA-Z0-9]{4,8})(\*\*|`|"|')?/);
                        if (match && match[2]) return match[2];
                        const stripped = rawText.replace(/[^a-zA-Z0-9]/g, '');
                        if (stripped.length >= 4 && stripped.length <= 8) return stripped;
                    }
                } catch (_) {}
            }
        } catch (_) {}
    }

    const rawTargetUrls = [];
    if (options.serverUrl) rawTargetUrls.push(`${options.serverUrl.replace(/\/$/, '')}/api/ocr/captcha`);
    rawTargetUrls.push('https://esevadraft.in/api/ocr/captcha', 'http://localhost:3000/api/ocr/captcha');
    const targetUrls = Array.from(new Set(rawTargetUrls));

    for (const url of targetUrls) {
        try {
            if (typeof fetch === 'function') {
                const resp = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ imageBase64: rawB64 }),
                    signal: AbortSignal.timeout(28000)
                });
                if (resp.ok) {
                    const data = await resp.json();
                    if (data && data.success && data.code) return data.code;
                }
            }
        } catch (netErr) {
            console.warn(`[Cloud OCR] Notice on ${url}:`, netErr.message);
        }
    }
    return null;
}

async function tryAutoClickCaptcha(targetPage = null) {
    if (!targetPage || targetPage.isClosed()) return false;
    try {
        const curUrl = targetPage.url().toLowerCase();
        const isPerfdrivePage = curUrl.includes('perfdrive') || curUrl.includes('validate') || curUrl.includes('captcha');

        const isPuzzleOpen = await targetPage.evaluate(() => {
            const iframes = Array.from(document.querySelectorAll('iframe'));
            return iframes.some(f => {
                const src = (f.src || '').toLowerCase();
                const title = (f.title || '').toLowerCase();
                return src.includes('challenge') || src.includes('captcha/v1') || title.includes('challenge') || title.includes('captcha');
            });
        }).catch(() => false);
        if (isPuzzleOpen) return false;

        const isCaptchaSolved = await targetPage.evaluate(() => {
            const hCap = document.querySelector('[name="h-captcha-response"], textarea[id*="h-captcha-response"]');
            if (hCap && hCap.value && hCap.value.trim().length > 20) return true;
            const cfi = document.querySelector('#cf_input, [name="cfi"]');
            if (cfi && cfi.value && cfi.value.trim().length > 20) return true;
            return false;
        }).catch(() => false);

        if (isCaptchaSolved && isPerfdrivePage) {
            const isAlreadySubmitting = await targetPage.evaluate(() => {
                const s = document.querySelector('.spinner-border, .loading, input[type="submit"]:disabled, button[disabled]');
                return Boolean(s);
            }).catch(() => false);
            if (isAlreadySubmitting) return true;

            const submitSelectors = ['input[type="submit"][value*="Submit"]', 'button[type="submit"]:has-text("Submit")', 'input.btn-success', 'button.btn-success'];
            for (const sSel of submitSelectors) {
                try {
                    const subBtn = targetPage.locator(sSel).first();
                    if (await subBtn.count() > 0 && await subBtn.isVisible().catch(() => false)) {
                        const hClicked = await humanClick(targetPage, subBtn);
                        if (!hClicked) await subBtn.click({ force: true, delay: 80 }).catch(() => {});
                        await targetPage.waitForTimeout(1000);
                        return true;
                    }
                } catch (e) {}
            }
            return true;
        }

        const now = Date.now();
        if (now - lastCaptchaClickTime < 12000) return false;

        const selectors = ['#checkbox', '[role="checkbox"]', 'input[type="checkbox"]#cf_input', '#anchor', 'div[aria-checked="false"]', '.recaptcha-checkbox-border', 'label.cb-lb', 'button:has-text("I am human")', 'label:has-text("I am human")'];
        for (const f of targetPage.frames()) {
            for (const sel of selectors) {
                try {
                    const cb = f.locator(sel).first();
                    if (await cb.count() > 0 && await cb.isVisible().catch(() => false)) {
                        lastCaptchaClickTime = Date.now();
                        await cb.click({ force: true, delay: 100 }).catch(() => {});
                        return true;
                    }
                } catch (e) {}
            }
        }
        for (const sel of selectors) {
            try {
                const cb = targetPage.locator(sel).first();
                if (await cb.count() > 0 && await cb.isVisible().catch(() => false)) {
                    lastCaptchaClickTime = Date.now();
                    const hDone = await humanClick(targetPage, cb);
                    if (!hDone) await cb.click({ force: true, delay: 100 }).catch(() => {});
                    return true;
                }
            } catch (e) {}
        }
        return false;
    } catch (e) {
        return false;
    }
}

async function autoSolveCaptcha(page, onProgress = () => {}, options = {}) {
    const apiKey = getActiveGeminiApiKey(options);
    let curCaptchaInput = page.locator('input#captchaCode, input[formcontrolname="captchaCode"], input[formcontrolname="captcha"], input[placeholder*="எழுத்துக்களை"], #captcha').first();
    if (await curCaptchaInput.count() === 0 || !(await curCaptchaInput.isVisible().catch(() => false))) {
        const nonMob = page.locator('form input:not([type="hidden"]):not([type="submit"]):not([formcontrolname*="mob"]):not([id*="mob"])');
        if (await nonMob.count() > 0) curCaptchaInput = nonMob.first();
    }
    if (await curCaptchaInput.count() === 0 || !(await curCaptchaInput.isVisible().catch(() => false))) return null;

    let captchaImg = page.locator('img[src^="data:image"], img[title*="கேப்ட்சா"], img[alt="Captcha Code"], img[src*="captcha"]:not([src*="perfdrive"]), .captcha-img').first();
    if (await captchaImg.count() === 0 || !(await captchaImg.isVisible().catch(() => false))) {
        const formImgs = page.locator('form img:not([src*="logo"]):not([src*="perfdrive"])');
        if (await formImgs.count() > 0 && await formImgs.first().isVisible().catch(() => false)) captchaImg = formImgs.first();
    }
    if (await captchaImg.count() === 0 || !(await captchaImg.isVisible().catch(() => false))) return null;

    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            onProgress(`🤖 [AI Captcha OCR] TNPDS கேப்ட்சா படம் பகுப்பாய்வு செய்யப்படுகிறது (முயற்சி ${attempt}/2)...`);
            await showBrowserHud('🤖 AI கேப்ட்சா பகுப்பாய்வு செய்கிறது...', 'AI குறியீட்டைக் கண்டறிகிறது...', 'warning', page);
            let imgPayload = null;
            try {
                const srcAttr = await captchaImg.getAttribute('src');
                if (srcAttr && srcAttr.startsWith('data:image')) imgPayload = srcAttr;
            } catch (_) {}
            if (!imgPayload) imgPayload = await captchaImg.screenshot();

            const code = await solveCaptchaWithMultiLayerAi(imgPayload, apiKey, options);
            if (code) {
                onProgress(`🤖 [AI Captcha OCR] கேப்ட்சா குறியீடு தானாகக் கண்டறியப்பட்டது: "${code}"`);
                await showBrowserHud('✍️ கேப்ட்சா பதிவு செய்யப்படுகிறது', `குறியீடு: ${code}`, 'info', page);
                await humanType(page, curCaptchaInput, code);
                await curCaptchaInput.dispatchEvent('input', { bubbles: true }).catch(() => {});
                await curCaptchaInput.dispatchEvent('change', { bubbles: true }).catch(() => {});
                await page.waitForTimeout(400);

                const mobInput = page.locator('input[formcontrolname="mobNumber"]:not([disabled]), input[placeholder*="கைபேசி"]').first();
                const curMobVal = (await mobInput.inputValue().catch(() => '')).replace(/\D/g, '');
                const curCapVal = (await curCaptchaInput.inputValue().catch(() => '')).trim();

                if (curMobVal.length >= 10 && curMobVal !== curCapVal && curCapVal.length >= 4) {
                    const submitBtn = page.locator('input[type="submit"][value="பதிவு செய்ய"], input.btn-success[value*="பதிவு"], button:has-text("பதிவு செய்ய")').first();
                    if (await submitBtn.count() > 0 && await submitBtn.isVisible().catch(() => false)) {
                        const hClicked = await humanClick(page, submitBtn);
                        if (!hClicked) await submitBtn.click({ force: true, delay: 80 }).catch(() => {});
                    }
                }
                return code;
            }
        } catch (_) {}
    }
    return null;
}

module.exports = {
    getActiveGeminiApiKey,
    solveCaptchaWithMultiLayerAi,
    tryAutoClickCaptcha,
    autoSolveCaptcha
};
