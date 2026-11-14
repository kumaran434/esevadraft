let _sharp = null;
function getSharp() {
    if (_sharp === null) {
        try { _sharp = require('sharp'); } catch (e) { _sharp = false; }
    }
    return _sharp;
}
let _PDFDocument = null;
function getPDFDocument() {
    if (_PDFDocument === null) {
        try { _PDFDocument = require('pdfkit'); } catch (e) { _PDFDocument = false; }
    }
    return _PDFDocument;
}
const fs = require('fs');
const path = require('path');
const os = require('os');

let _cachedStudioDir = null;
function getSafeStudioDir() {
    if (_cachedStudioDir) return _cachedStudioDir;
    const localDir = path.join(__dirname, '..', '..', 'compressed');
    try {
        if (!fs.existsSync(localDir)) {
            fs.mkdirSync(localDir, { recursive: true });
        }
        fs.accessSync(localDir, fs.constants.W_OK);
        _cachedStudioDir = localDir;
        return localDir;
    } catch (e) {
        const fallbackDir = path.join(os.tmpdir(), 'esevadraft', 'compressed');
        try {
            if (!fs.existsSync(fallbackDir)) {
                fs.mkdirSync(fallbackDir, { recursive: true });
            }
        } catch (e2) {}
        _cachedStudioDir = fallbackDir;
        return fallbackDir;
    }
}

const studioDir = getSafeStudioDir();

async function compressHeavyPdf(inputPdfPath) {
    try {
        let chromium;
        try { chromium = require('playwright').chromium; } catch(e) { chromium = require('playwright-core').chromium; }
        const pdfBuf = fs.readFileSync(inputPdfPath);
        const pdfBase64 = pdfBuf.toString('base64');
        const outputPdfPath = path.join(studioDir, `compressed_${Date.now()}_${path.basename(inputPdfPath)}`);

        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        await page.setContent(`
            <!DOCTYPE html>
            <html>
            <head>
                <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js"></script>
            </head>
            <body style="margin:0; padding:0; background:white;">
                <canvas id="pdfCanvas"></canvas>
                <script>
                    window.renderPdf = async function(base64Data) {
                        const raw = atob(base64Data);
                        const uint8 = new Uint8Array(raw.length);
                        for (let i = 0; i < raw.length; i++) uint8[i] = raw.charCodeAt(i);
                        const loadingTask = pdfjsLib.getDocument({ data: uint8 });
                        const pdf = await loadingTask.promise;
                        const p = await pdf.getPage(1);
                        const viewport = p.getViewport({ scale: 1.5 });
                        const canvas = document.getElementById('pdfCanvas');
                        canvas.width = viewport.width;
                        canvas.height = viewport.height;
                        const ctx = canvas.getContext('2d');
                        await p.render({ canvasContext: ctx, viewport: viewport }).promise;
                        return true;
                    };
                </script>
            </body>
            </html>
        `);

        await page.waitForFunction(() => typeof window.renderPdf === 'function', { timeout: 15000 });
        await page.evaluate((b64) => window.renderPdf(b64), pdfBase64);
        await page.waitForTimeout(1000);

        const canvas = page.locator('#pdfCanvas');
        const imgBuf = await canvas.screenshot({ type: 'jpeg', quality: 80 });
        await browser.close();

        return new Promise((resolve) => {
            const PDFDocument = getPDFDocument();
            const doc = new PDFDocument({ size: 'A4', margin: 20 });
            const writeStream = fs.createWriteStream(outputPdfPath);
            doc.pipe(writeStream);
            doc.image(imgBuf, 20, 20, { fit: [555, 800], align: 'center', valign: 'center' });
            doc.end();

            writeStream.on('finish', () => {
                const szKB = (fs.statSync(outputPdfPath).size / 1024).toFixed(1);
                console.log(`✨ Heavy PDF compressed to Government Standard: ${outputPdfPath} (${szKB} KB)`);
                resolve(outputPdfPath);
            });

            writeStream.on('error', () => resolve(inputPdfPath));
        });
    } catch (e) {
        console.error('Heavy PDF compression fallback:', e.message);
        return inputPdfPath;
    }
}

/**
 * Universal Exact Document Auto-Cropper (ஆவணத்தின் சரியான விளிம்பு வரை மட்டுமே நறுக்கும் விதி)
 * Automatically detects the exact physical boundary of any uploaded card or document
 * (Aadhaar, Ration Card, Voter ID, PAN, Gas Book, Residence Proof, etc.) sitting on a table,
 * desk, floor, or background, and crops out all surrounding background before merging or enhancing.
 */
async function cropDocumentToExactBoundary(inputPath, options = {}) {
    const sharp = getSharp();
    if (!inputPath || !fs.existsSync(inputPath) || !sharp) return inputPath;
    if (String(inputPath).toLowerCase().endsWith('.pdf')) return inputPath;

    try {
        const meta = await sharp(inputPath).rotate().metadata();
        const origW = meta.width;
        const origH = meta.height;
        if (!origW || !origH || origW < 80 || origH < 80) return inputPath;

        // If explicit AI boundingBox [ymin, xmin, ymax, xmax] (0-1000 scale) is provided and valid
        if (Array.isArray(options.boundingBox) && options.boundingBox.length === 4) {
            const [ymin, xmin, ymax, xmax] = options.boundingBox;
            const bw = Math.round(((xmax - xmin) / 1000) * origW);
            const bh = Math.round(((ymax - ymin) / 1000) * origH);
            if (bw >= origW * 0.88 && bh >= origH * 0.88) {
                return inputPath;
            }
            if (bw >= origW * 0.18 && bh >= origH * 0.12 && (bw < origW * 0.92 || bh < origH * 0.92)) {
                const padX = Math.round(bw * 0.015);
                const padY = Math.round(bh * 0.015);
                const left = Math.max(0, Math.round((xmin / 1000) * origW) - padX);
                const top = Math.max(0, Math.round((ymin / 1000) * origH) - padY);
                const width = Math.min(origW - left, bw + padX * 2);
                const height = Math.min(origH - top, bh + padY * 2);
                const outPath = path.join(studioDir, `cropped_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.jpeg`);
                await sharp(inputPath).rotate().extract({ left, top, width, height }).jpeg({ quality: 95 }).toFile(outPath);
                return outPath;
            }
        }

        const W = 240;
        const H = 240;
        const { data, info } = await sharp(inputPath)
            .rotate()
            .resize(W, H, { fit: 'fill' })
            .raw()
            .toBuffer({ resolveWithObject: true });
        const ch = info.channels;

        // 1. Sample outer perimeter background per column (top 6% + bottom 6%) and per row (left 6% + right 6%)
        const colBgB = new Float32Array(W);
        const colBgG = new Float32Array(W);
        const rowBgB = new Float32Array(H);
        const rowBgG = new Float32Array(H);
        let borderPaperPixels = 0;
        let borderTotal = 0;

        const marginY = Math.max(2, Math.round(H * 0.06));
        const marginX = Math.max(2, Math.round(W * 0.06));

        const isPaperLikePixel = (r, g, b) => {
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            const max = Math.max(r, g, b), min = Math.min(r, g, b);
            const sat = max === 0 ? 0 : (max - min) / max;
            return (lum >= 135 && sat <= 0.38) || (b >= 145 && g >= 145 && r >= 135 && Math.abs(r - b) <= 45);
        };

        for (let x = 0; x < W; x++) {
            const bVals = [];
            const gVals = [];
            for (let y = 0; y < H; y++) {
                if (y < marginY || y >= H - marginY) {
                    const idx = (y * W + x) * ch;
                    const r = data[idx], g = data[idx + 1], b = data[idx + 2];
                    bVals.push(b);
                    gVals.push(g);
                    borderTotal++;
                    if (isPaperLikePixel(r, g, b)) borderPaperPixels++;
                }
            }
            bVals.sort((a, b) => a - b);
            gVals.sort((a, b) => a - b);
            const mid = Math.floor(bVals.length / 2);
            colBgB[x] = bVals[mid] || 0;
            colBgG[x] = gVals[mid] || 0;
        }

        for (let y = 0; y < H; y++) {
            const bVals = [];
            const gVals = [];
            for (let x = 0; x < W; x++) {
                if (x < marginX || x >= W - marginX) {
                    const idx = (y * W + x) * ch;
                    const r = data[idx], g = data[idx + 1], b = data[idx + 2];
                    bVals.push(b);
                    gVals.push(g);
                    if (y >= marginY && y < H - marginY) {
                        borderTotal++;
                        if (isPaperLikePixel(r, g, b)) borderPaperPixels++;
                    }
                }
            }
            bVals.sort((a, b) => a - b);
            gVals.sort((a, b) => a - b);
            const mid = Math.floor(bVals.length / 2);
            rowBgB[y] = bVals[mid] || 0;
            rowBgG[y] = gVals[mid] || 0;
        }

        // If outer border is already mostly document paper (white, cream, warm, or light tinted), image already fills the frame
        if (borderPaperPixels / Math.max(1, borderTotal) >= 0.55) {
            return inputPath;
        }

        const getLum = (x, y) => {
            const idx = (y * W + x) * ch;
            return 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        };

        const isCardForeground = (x, y) => {
            const idx = (y * W + x) * ch;
            const r = data[idx], g = data[idx + 1], b = data[idx + 2];
            const dBCol = b - colBgB[x];
            const dGCol = g - colBgG[x];
            const dBRow = b - rowBgB[y];
            const isBrightPaper = isPaperLikePixel(r, g, b);
            const isAboveBg = (dBCol >= 24 && dGCol >= 18 && dBRow >= 16 && b >= 125 && (r - b) <= 55);
            // Also detect sharp ink/text edges on paper so headers/stamps are never cropped out
            let isTextOnPaper = false;
            if (x >= 2 && x < W - 2 && y >= 2 && y < H - 2) {
                const l0 = getLum(x, y);
                const lRight = getLum(x + 2, y);
                const lDown = getLum(x, y + 2);
                if ((Math.abs(l0 - lRight) >= 42 || Math.abs(l0 - lDown) >= 42) && Math.max(l0, lRight, lDown) >= 135) {
                    isTextOnPaper = true;
                }
            }
            return isBrightPaper || isAboveBg || isTextOnPaper;
        };

        const smooth = (arr, radius = 2) => {
            const out = new Float32Array(arr.length);
            for (let i = 0; i < arr.length; i++) {
                let s = 0, c = 0;
                for (let d = -radius; d <= radius; d++) {
                    if (i + d >= 0 && i + d < arr.length) {
                        s += arr[i + d];
                        c++;
                    }
                }
                out[i] = s / c;
            }
            return out;
        };

        const rowDensity = new Float32Array(H);
        for (let y = 0; y < H; y++) {
            let cnt = 0;
            for (let x = 0; x < W; x++) {
                if (isCardForeground(x, y)) cnt++;
            }
            rowDensity[y] = cnt / W;
        }

        const smoothRow = smooth(rowDensity, 2);
        const maxRow = Math.max(...smoothRow);
        if (maxRow < 0.20) return inputPath;

        // Span from the FIRST foreground row to the LAST foreground row so horizontal lines or colored headers never split the document
        const rowThresh = Math.max(0.22, maxRow * 0.35);
        let bestYStart = -1, bestYEnd = -1;
        for (let y = 0; y < H; y++) {
            if (smoothRow[y] >= rowThresh) {
                if (bestYStart === -1) bestYStart = y;
                bestYEnd = y;
            }
        }
        if (bestYStart === -1 || bestYEnd === -1) return inputPath;
        while (bestYStart > 0 && smoothRow[bestYStart - 1] >= Math.max(0.18, maxRow * 0.28)) bestYStart--;
        while (bestYEnd < H - 1 && smoothRow[bestYEnd + 1] >= Math.max(0.18, maxRow * 0.28)) bestYEnd++;

        const bandH = Math.max(1, bestYEnd - bestYStart + 1);
        const colDensity = new Float32Array(W);
        for (let x = 0; x < W; x++) {
            let cnt = 0;
            for (let y = bestYStart; y <= bestYEnd; y++) {
                if (isCardForeground(x, y)) cnt++;
            }
            colDensity[x] = cnt / bandH;
        }

        const smoothCol = smooth(colDensity, 2);
        const maxCol = Math.max(...smoothCol);
        if (maxCol < 0.20) return inputPath;

        // Span from the FIRST foreground column to the LAST foreground column
        const colThresh = Math.max(0.22, maxCol * 0.35);
        let bestXStart = -1, bestXEnd = -1;
        for (let x = 0; x < W; x++) {
            if (smoothCol[x] >= colThresh) {
                if (bestXStart === -1) bestXStart = x;
                bestXEnd = x;
            }
        }
        if (bestXStart === -1 || bestXEnd === -1) return inputPath;
        while (bestXStart > 0 && smoothCol[bestXStart - 1] >= Math.max(0.18, maxCol * 0.28)) bestXStart--;
        while (bestXEnd < W - 1 && smoothCol[bestXEnd + 1] >= Math.max(0.18, maxCol * 0.28)) bestXEnd++;

        const rawLeft = Math.round((bestXStart / W) * origW);
        const rawTop = Math.round((bestYStart / H) * origH);
        const rawRight = Math.round(((bestXEnd + 1) / W) * origW);
        const rawBottom = Math.round(((bestYEnd + 1) / H) * origH);
        const rawW = rawRight - rawLeft;
        const rawH = rawBottom - rawTop;

        if (rawW < origW * 0.18 || rawH < origH * 0.12) return inputPath;
        if (rawW >= origW * 0.90 && rawH >= origH * 0.90) return inputPath;

        // Add 0.6% card-relative margin so card border & text are preserved with zero table strip
        const padX = Math.round(rawW * 0.006);
        const padY = Math.round(rawH * 0.006);
        const left = Math.max(0, rawLeft - padX);
        const top = Math.max(0, rawTop - padY);
        const right = Math.min(origW, rawRight + padX);
        const bottom = Math.min(origH, rawBottom + padY);
        const cropW = right - left;
        const cropH = bottom - top;

        if (cropW >= origW * 0.92 && cropH >= origH * 0.92) return inputPath;

        const outPath = path.join(studioDir, `cropped_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.jpeg`);
        await sharp(inputPath)
            .rotate()
            .extract({ left, top, width: cropW, height: cropH })
            .jpeg({ quality: 95 })
            .toFile(outPath);

        console.log(`✂️ [AutoCrop] Exact card boundary cropped (${origW}x${origH} -> ${cropW}x${cropH}): ${path.basename(inputPath)}`);
        return outPath;
    } catch (e) {
        console.warn('Auto-crop fallback notice:', e.message);
        return inputPath;
    }
}

async function produceDualSidedDocument(frontPath, backPath, produceCompliantDocFallback, options = {}) {
    if (!fs.existsSync(frontPath)) return null;
    if (!backPath || !fs.existsSync(backPath)) {
        if (produceCompliantDocFallback) return produceCompliantDocFallback(frontPath);
        return frontPath;
    }

    let frontBox = options?.frontBoundingBox || options?.boundingBox || null;
    let backBox = options?.backBoundingBox || null;

    // Autonomous AI Document Boundary Auto-Resolution if not explicitly supplied
    if (!frontBox || !backBox) {
        try {
            const { inspectAndExtractDocument } = require('../../ai_document_extractor');
            if (!frontBox && fs.existsSync(frontPath)) {
                const exf = await inspectAndExtractDocument(frontPath).catch(() => null);
                if (exf && exf.documentBoundingBox) frontBox = exf.documentBoundingBox;
            }
            if (!backBox && fs.existsSync(backPath)) {
                const exb = await inspectAndExtractDocument(backPath, { skipFaceExtraction: true }).catch(() => null);
                if (exb && exb.documentBoundingBox) backBox = exb.documentBoundingBox;
            }
        } catch (_) {}
    }

    // Universal Exact Document Boundary Auto-Crop BEFORE merging Front + Back
    const croppedFrontPath = await cropDocumentToExactBoundary(frontPath, { boundingBox: frontBox });
    const croppedBackPath = await cropDocumentToExactBoundary(backPath, { boundingBox: backBox });

    async function generatePdfAtQuality(targetQuality) {
        const sharp = getSharp();
        const PDFDocument = getPDFDocument();
        const tempFrontJpg = path.join(studioDir, `enhanced_front_${Date.now()}_q${targetQuality}.jpeg`);
        const tempBackJpg = path.join(studioDir, `enhanced_back_${Date.now()}_q${targetQuality}.jpeg`);
        const outputPdfPath = path.join(studioDir, `doc_merged_${Date.now()}_aadhaar.pdf`);

        try {
            await sharp(croppedFrontPath)
                .rotate()
                .resize({ width: 1000, height: 680, fit: 'inside', withoutEnlargement: true })
                .flatten({ background: { r: 255, g: 255, b: 255 } })
                .normalize()
                .gamma(1.1)
                .modulate({ brightness: 1.05, saturation: 1.15 })
                .sharpen({ sigma: 1.6, m1: 2.0, m2: 0.6 })
                .jpeg({ quality: targetQuality, chromaSubsampling: '4:2:0' })
                .toFile(tempFrontJpg);

            await sharp(croppedBackPath)
                .rotate()
                .resize({ width: 1000, height: 680, fit: 'inside', withoutEnlargement: true })
                .flatten({ background: { r: 255, g: 255, b: 255 } })
                .normalize()
                .gamma(1.1)
                .modulate({ brightness: 1.05, saturation: 1.15 })
                .sharpen({ sigma: 1.6, m1: 2.0, m2: 0.6 })
                .jpeg({ quality: targetQuality, chromaSubsampling: '4:2:0' })
                .toFile(tempBackJpg);

            const resultPath = await new Promise((resolve) => {
                const doc = new PDFDocument({ size: 'A4', margin: 36 });
                const writeStream = fs.createWriteStream(outputPdfPath);

                doc.pipe(writeStream);
                doc.image(tempFrontJpg, 50, 45, { fit: [495, 340], align: 'center', valign: 'center' });
                doc.moveTo(50, 400).lineTo(545, 400).dash(4, { space: 4 }).strokeColor('#cbd5e1').stroke();
                doc.image(tempBackJpg, 50, 420, { fit: [495, 340], align: 'center', valign: 'center' });
                doc.end();

                writeStream.on('finish', () => {
                    try { if (fs.existsSync(tempFrontJpg)) fs.unlinkSync(tempFrontJpg); } catch (e) {}
                    try { if (fs.existsSync(tempBackJpg)) fs.unlinkSync(tempBackJpg); } catch (e) {}
                    resolve(outputPdfPath);
                });

                writeStream.on('error', (err) => {
                    console.error('2-in-1 PDF generation error:', err);
                    resolve(null);
                });
            });

            return resultPath;
        } catch (e) {
            console.error(`Dual-side merger error at quality ${targetQuality}:`, e.message);
            try { if (fs.existsSync(tempFrontJpg)) fs.unlinkSync(tempFrontJpg); } catch (e2) {}
            try { if (fs.existsSync(tempBackJpg)) fs.unlinkSync(tempBackJpg); } catch (e2) {}
            return null;
        }
    }

    try {
        let finalPdf = await generatePdfAtQuality(82);
        if (finalPdf && fs.existsSync(finalPdf)) {
            let fileSizeKB = fs.statSync(finalPdf).size / 1024;
            if (fileSizeKB > 240) {
                console.log(`⚠️ Merged PDF (${fileSizeKB.toFixed(1)} KB > 240 KB). Re-encoding at quality 72 for strict compliance...`);
                try { fs.unlinkSync(finalPdf); } catch (e) {}
                finalPdf = await generatePdfAtQuality(72);
                if (finalPdf && fs.existsSync(finalPdf)) {
                    fileSizeKB = fs.statSync(finalPdf).size / 1024;
                }
            }
            console.log(`✨ AI Merged 2-in-1 Government PDF Generated: ${finalPdf} (${fileSizeKB ? fileSizeKB.toFixed(1) : '?'} KB)`);
            return finalPdf;
        }
        return frontPath;
    } catch (e) {
        console.error('Dual-side merger fallback error:', e.message);
        return frontPath;
    } finally {
        try { if (croppedFrontPath && croppedFrontPath !== frontPath && fs.existsSync(croppedFrontPath)) fs.unlinkSync(croppedFrontPath); } catch (_) {}
        try { if (croppedBackPath && croppedBackPath !== backPath && fs.existsSync(croppedBackPath)) fs.unlinkSync(croppedBackPath); } catch (_) {}
    }
}

module.exports = {
    getSafeStudioDir,
    compressHeavyPdf,
    cropDocumentToExactBoundary,
    produceDualSidedDocument
};
