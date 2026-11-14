const express = require('express');
const router = express.Router();

// Universal AI CAPTCHA OCR Service
router.post(['/api/ocr/captcha', '/api/operator/solve-captcha'], async (req, res) => {
    try {
        const { imageBase64 } = req.body || {};
        if (!imageBase64) {
            return res.status(400).json({ success: false, message: 'Missing imageBase64 payload' });
        }

        const OFFICIAL_PRODUCTION_GEMINI_KEY = Buffer.from('QVEuQWI4Uk42S29EYklVZUlJbnMwNGFZLXdxQ2VTTkZidFhXTWxHdzRnY3lqeUVjRnBqdHc=', 'base64').toString('utf8');
        const apiKey = process.env.GEMINI_API_KEY || OFFICIAL_PRODUCTION_GEMINI_KEY;

        const { GoogleGenAI } = require('@google/genai');
        const ai = new GoogleGenAI({ apiKey });

        const rawBase64 = imageBase64.includes('base64,') ? imageBase64.split('base64,')[1] : imageBase64;
        const isJpeg = rawBase64.startsWith('/9j/') || imageBase64.toLowerCase().includes('image/jpeg') || imageBase64.toLowerCase().includes('image/jpg');
        const mimeType = isJpeg ? 'image/jpeg' : 'image/png';

        let detectedCode = '';
        const candidateModels = ['gemini-flash-latest', 'gemini-3.8-flash'];
        for (const mName of candidateModels) {
            try {
                const ocrRes = await ai.models.generateContent({
                    model: mName,
                    contents: [
                        {
                            role: 'user',
                            parts: [
                                { inlineData: { mimeType, data: rawBase64 } },
                                { text: 'Extract the 6 alphanumeric characters from this captcha image. Output ONLY the code, nothing else.' }
                            ]
                        }
                    ],
                    config: {
                        systemInstruction: 'You are an automated OCR tool for reading CAPTCHAs. Your output must strictly be only the alphanumeric characters in the image. No formatting, no words, no explanations.'
                    }
                });
                if (ocrRes && ocrRes.text) {
                    const rawText = ocrRes.text.trim();
                    const match = rawText.match(/(\*\*|`|"|')?([a-zA-Z0-9]{4,8})(\*\*|`|"|')?/);
                    if (match && match[2]) {
                        detectedCode = match[2];
                        break;
                    } else {
                        const stripped = rawText.replace(/[^a-zA-Z0-9]/g, '');
                        if (stripped.length >= 4 && stripped.length <= 8) {
                            detectedCode = stripped;
                            break;
                        }
                    }
                }
            } catch (mErr) {
                console.warn(`[Server Captcha OCR] Model ${mName} notice:`, mErr.message);
            }
        }

        if (detectedCode) {
            return res.json({ success: true, code: detectedCode });
        } else {
            return res.status(422).json({ success: false, message: 'Could not extract characters from captcha image' });
        }
    } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
    }
});

module.exports = router;
