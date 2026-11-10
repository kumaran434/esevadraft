/**
 * eSevaDraft Enterprise Automation Standard
 * Module: ai_captcha_solver.js
 * 
 * Standalone Multimodal OCR Service
 * - Active Google Gemini Models: gemini-flash-latest, gemini-3.8-flash
 * - Dynamic JPEG / PNG byte inspection
 * - Local SDK first -> Local API -> Cloud /api/ocr/captcha fallback
 */

const path = require('path');
const fs = require('fs');

class AiCaptchaSolver {
    static _cachedApiKey = null;
    static _cachedGoogleGenAI = null;
    static _cachedAiClient = null;

    static resolveGenAiPackage() {
        if (this._cachedGoogleGenAI) return this._cachedGoogleGenAI;
        try {
            const pkg = require('@google/genai').GoogleGenAI;
            if (pkg) {
                this._cachedGoogleGenAI = pkg;
                return pkg;
            }
        } catch (_) {}

        const candidatePaths = [
            path.join(__dirname, '..', '..', '..', 'node_modules', '@google', 'genai'),
            'd:/downloads/ai assitant 2/node_modules/@google/genai',
            path.join(process.resourcesPath || '', 'node_modules', '@google', 'genai'),
            path.join(process.resourcesPath || '', 'app.asar.unpacked', 'node_modules', '@google', 'genai')
        ];
        for (const cp of candidatePaths) {
            try {
                if (fs.existsSync(cp)) {
                    const mod = require(cp);
                    if (mod && mod.GoogleGenAI) {
                        this._cachedGoogleGenAI = mod.GoogleGenAI;
                        return mod.GoogleGenAI;
                    }
                }
            } catch (_) {}
        }
        return null;
    }

    static getApiKey(options = {}) {
        if (options.geminiApiKey) return options.geminiApiKey;
        if (this._cachedApiKey) return this._cachedApiKey;
        if (process.env.GEMINI_API_KEY) {
            this._cachedApiKey = process.env.GEMINI_API_KEY;
            return this._cachedApiKey;
        }

        const envCandidates = [
            path.join(__dirname, '..', '..', '..', '.env'),
            path.join(process.cwd(), '.env'),
            'd:/downloads/ai assitant 2/.env',
            path.join(process.env.APPDATA || '', 'esevadraft-desktop', '.env'),
            path.join(process.resourcesPath || '', '.env')
        ];

        for (const ep of envCandidates) {
            try {
                if (fs.existsSync(ep)) {
                    const content = fs.readFileSync(ep, 'utf8');
                    const match = content.match(/GEMINI_API_KEY\s*=\s*([^\r\n]+)/);
                    if (match && match[1]) {
                        const key = match[1].trim().replace(/^['"]|['"]$/g, '');
                        if (key) {
                            process.env.GEMINI_API_KEY = key;
                            this._cachedApiKey = key;
                            return key;
                        }
                    }
                }
            } catch (_) {}
        }

        try {
            require('dotenv').config();
            if (process.env.GEMINI_API_KEY) {
                this._cachedApiKey = process.env.GEMINI_API_KEY;
                return this._cachedApiKey;
            }
        } catch (_) {}

        return '';
    }

    static extractCleanCode(rawText, options = {}) {
        if (!rawText) return null;
        const trimmed = rawText.trim();
        const lower = trimmed.toLowerCase();

        // If the response is explanatory conversational text (e.g. "There is no captcha..."), reject immediately
        const rejectionPhrases = ['no captcha', 'cannot see', 'not visible', 'unable to', 'please provide', 'no text', 'no character', 'is empty'];
        if (rejectionPhrases.some(phrase => lower.includes(phrase))) {
            return null;
        }

        const cleanRaw = trimmed.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        if (cleanRaw.length === 5 && (/[0-9]/.test(cleanRaw) || !/^[A-Z]{5}$/.test(cleanRaw) || !['IMAGE', 'THERE', 'ERROR'].includes(cleanRaw))) {
            return cleanRaw;
        }

        const blackList = new Set([
            'CODE', 'HERE', 'CAPTCHA', 'IMAGE', 'SHOWN', 'PROVIDED', 'PLEASE', 'OUTPUT',
            'RESULT', 'TEXT', 'CHARS', 'EXACT', 'UPPER', 'LETTERS', 'DIGITS', 'READ',
            'EXTRACT', 'THERE', 'IS', 'NO', 'PRESENT', 'CANNOT', 'CHARACTERS', 'VISIBLE',
            'THIS', 'THAT', 'WITH', 'FROM', 'LOOKS', 'LIKE', 'WHICH', 'COULD', 'WOULD'
        ]);
        const tokens = trimmed.split(/\s+/).map(t => t.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()).filter(Boolean);

        // Priority 1: 5-char token with both letters and digits (classic Tamil Nadu portal captcha)
        const mixed5 = tokens.find(t => t.length === 5 && !blackList.has(t) && /[0-9]/.test(t) && /[A-Z]/.test(t));
        if (mixed5) return mixed5;

        // Priority 2: 5-char token not in blacklist with at least one digit or all uppercase
        const any5 = tokens.find(t => t.length === 5 && !blackList.has(t));
        if (any5) return any5;

        // Priority 3: 4-6 char token with digits
        const digitToken = tokens.find(t => t.length >= 4 && t.length <= 6 && !blackList.has(t) && /[0-9]/.test(t));
        if (digitToken) return digitToken;

        if (cleanRaw.length >= 4 && cleanRaw.length <= 6 && !blackList.has(cleanRaw)) return cleanRaw;
        return null;
    }

    /**
     * Solves a captcha image (base64 string or Buffer).
     * High-speed optimized: Direct lightweight REST -> Warm SDK -> Endpoints fallback
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
        const apiKey = this.getApiKey(options);

        // Fast Strategy 1: Ultra-Low Latency REST Call to gemini-flash-lite-latest (~1.2 - 1.5s)
        if (apiKey && typeof fetch === 'function') {
            try {
                const promptText = (options.isTnega || options.portal === 'tnega' || options.captchaLen === 5)
                    ? 'Extract the 5-character alphanumeric code from this Tamil Nadu government CAPTCHA. Distinguish 0 vs O, 1 vs I, 8 vs B, 5 vs S. Output strictly ONLY the 5 characters.'
                    : 'Extract the alphanumeric code from this government CAPTCHA image. Output strictly the code without any extra words.';

                const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${apiKey}`;
                const resp = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                { inline_data: { mime_type: mimeType, data: rawB64 } },
                                { text: promptText }
                            ]
                        }],
                        generationConfig: {
                            temperature: 0,
                            maxOutputTokens: 12
                        }
                    }),
                    signal: AbortSignal.timeout(3500)
                });

                if (resp.ok) {
                    const data = await resp.json();
                    const txt = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    const cleanCode = this.extractCleanCode(txt, options);
                    if (cleanCode) return cleanCode;
                }
            } catch (_) {}
        }

        // Fast Strategy 2: Local Gemini SDK (Warm Client Connection Pool)
        const GoogleGenAI = this.resolveGenAiPackage();
        if (apiKey && GoogleGenAI) {
            try {
                if (!this._cachedAiClient) {
                    this._cachedAiClient = new GoogleGenAI({ apiKey });
                }
                const ai = this._cachedAiClient;
                const models = ['gemini-flash-latest'];

                for (const mName of models) {
                    try {
                        const promptText = (options.isTnega || options.portal === 'tnega' || options.captchaLen === 5)
                            ? 'Extract the 5-character alphanumeric code from this Tamil Nadu e-Sevai (TNeGA) government CAPTCHA image. Distinguish carefully: 0 (digit) vs O (letter), 1 vs I, 8 vs B, 5 vs S, 2 vs Z. Output ONLY the 5 uppercase characters, nothing else.'
                            : 'Read and extract the clean alphanumeric code shown in this government portal CAPTCHA image (typically 5 to 6 uppercase letters and digits). Output ONLY the clean code without spaces, quotes, or formatting.';

                        const ocrRes = await ai.models.generateContent({
                            model: mName,
                            contents: [{
                                role: 'user',
                                parts: [
                                    { inlineData: { mimeType, data: rawB64 } },
                                    { text: promptText }
                                ]
                            }],
                            config: {
                                temperature: 0,
                                systemInstruction: 'You are an ultra-fast, high-precision CAPTCHA OCR engine for Tamil Nadu government portals. Output strictly the 5 uppercase alphanumeric characters without any spaces, quotes, or explanations.'
                            }
                        });

                        const rawText = ocrRes?.text || ocrRes?.candidates?.[0]?.content?.parts?.[0]?.text;
                        const cleanCode = this.extractCleanCode(rawText, options);
                        if (cleanCode) return cleanCode;
                    } catch (_) {}
                }
            } catch (_) {}
        }

        // Fast Strategy 3: Local & Backend Cloud OCR Endpoints (Fallback)
        const targetUrls = [
            'http://127.0.0.1:3000/api/ocr/captcha',
            'http://localhost:3000/api/ocr/captcha',
            options.serverUrl ? `${options.serverUrl.replace(/\/$/, '')}/api/ocr/captcha` : null,
            'https://esevadraft.in/api/ocr/captcha'
        ].filter(Boolean);

        for (const url of targetUrls) {
            try {
                if (typeof fetch === 'function') {
                    const resp = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ imageBase64: rawB64 }),
                        signal: AbortSignal.timeout(4000)
                    });
                    if (resp.ok) {
                        const data = await resp.json();
                        if (data && data.success && data.code) {
                            return String(data.code).trim();
                        }
                    }
                }
            } catch (_) {}
        }

        return null;
    }
}

module.exports = { AiCaptchaSolver };
