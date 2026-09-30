/**
 * eSevaDraft Enterprise Automation Standard
 * Module: ai_captcha_solver.js
 * 
 * Standalone Multimodal OCR Service
 * - Active Google Gemini Models: gemini-3.8-flash, gemini-3.5-flash, gemini-flash-latest
 * - Dynamic JPEG / PNG byte inspection
 * - Local SDK first -> Cloud /api/ocr/captcha fallback
 */

const path = require('path');
const fs = require('fs');

class AiCaptchaSolver {
    static getApiKey(options = {}) {
        if (options.geminiApiKey) return options.geminiApiKey;
        if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
        try {
            require('dotenv').config({ path: path.join(__dirname, '..', '..', '..', '.env') });
            if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
        } catch (_) {}
        return '';
    }

    /**
     * Solves a captcha image (base64 string or Buffer).
     */
    static async solve(imgInput, options = {}) {
        let rawB64 = '';
        let isJpeg = false;

        if (typeof imgInput === 'string') {
            rawB64 = imgInput.includes('base64,') ? imgInput.split('base64,')[1] : imgInput;
            isJpeg = imgInput.toLowerCase().includes('jpeg') || imgInput.toLowerCase().includes('jpg') || rawB64.startsWith('/9j/');
        } else if (Buffer.isBuffer(imgInput)) {
            rawB64 = imgInput.toString('base64');
            isJpeg = rawB64.startsWith('/9j/');
        }

        if (!rawB64 || rawB64.length < 50) return null;
        const mimeType = isJpeg ? 'image/jpeg' : 'image/png';

        // Strategy 1: Local Gemini SDK (if apiKey present)
        const apiKey = this.getApiKey(options);
        if (apiKey) {
            try {
                const { GoogleGenAI } = require('@google/genai');
                const ai = new GoogleGenAI({ apiKey });
                const models = ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash'];

                for (const mName of models) {
                    try {
                        const ocrRes = await ai.models.generateContent({
                            model: mName,
                            contents: [{
                                role: 'user',
                                parts: [
                                    { inlineData: { mimeType, data: rawB64 } },
                                    { text: 'Extract the 6 alphanumeric characters from this captcha image. Output ONLY the code, nothing else.' }
                                ]
                            }],
                            config: {
                                systemInstruction: 'You are an automated OCR tool for reading CAPTCHAs. Your output must strictly be only the alphanumeric characters in the image. No formatting, no words, no explanations.'
                            }
                        });

                        if (ocrRes && ocrRes.text) {
                            const rawText = ocrRes.text.trim();
                            const match = rawText.match(/(\*\*|`|"|')?([a-zA-Z0-9]{4,8})(\*\*|`|"|')?/);
                            if (match && match[2]) return match[2];
                            const stripped = rawText.replace(/[^a-zA-Z0-9]/g, '');
                            if (stripped.length >= 4 && stripped.length <= 8) return stripped;
                        }
                    } catch (mErr) {
                        // try next candidate model
                    }
                }
            } catch (localErr) {}
        }

        // Strategy 2: Backend Cloud OCR Endpoint (Zero-Key fallback)
        const targetUrls = [
            options.serverUrl ? `${options.serverUrl.replace(/\/$/, '')}/api/ocr/captcha` : null,
            'https://esevadraft.in/api/ocr/captcha',
            'http://localhost:3000/api/ocr/captcha'
        ].filter(Boolean);

        for (const url of targetUrls) {
            try {
                if (typeof fetch === 'function') {
                    const resp = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ imageBase64: rawB64 }),
                        signal: AbortSignal.timeout(8000)
                    });
                    if (resp.ok) {
                        const data = await resp.json();
                        if (data && data.success && data.code) {
                            return String(data.code).trim();
                        }
                    }
                }
            } catch (netErr) {}
        }

        return null;
    }
}

module.exports = { AiCaptchaSolver };
