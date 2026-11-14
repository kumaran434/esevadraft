/**
 * src/routes/tools_routes.js
 * Dedicated Backend Engine for e-Seva Operator Utility Tools (#panel-tools):
 *  1. PDF Compressor & 5-Part Splitter (supports 20MB+ to 100MB PDFs, exact KB targets)
 *  2. Two-Way JPG ⇄ PDF Converter (Multi-page, 2-in-1 Aadhaar Front+Back single page, PDF-to-JPG)
 *  3. Photo Cropper, Exact Pixel Resizer & Strict KB Compressor (<20KB, <50KB, <100KB)
 *  4. Digital Signature Studio (White-paper background remover to Transparent PNG + PDF/Image Signer)
 */

const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const { PDFDocument } = require('pdf-lib');
const crypto = require('crypto');

const router = express.Router();

// High-capacity memory upload for operator tools (up to 100 MB for large 20MB+ PDFs)
const uploadTools = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 100 * 1024 * 1024, // 100 MB per file
        fieldSize: 100 * 1024 * 1024 // 100 MB for base64 page payloads
    }
});

// Zero-pollution ephemeral memory store for downloadable tool outputs (auto-expires after 20 mins)
const tempToolFiles = new Map();

function storeTempOutput(buffer, filename, mimeType = 'application/pdf') {
    const id = crypto.randomBytes(12).toString('hex');
    tempToolFiles.set(id, {
        buffer,
        filename,
        mimeType,
        sizeBytes: buffer.length,
        createdAt: Date.now()
    });
    // Cleanup files older than 20 minutes
    const cutoff = Date.now() - (20 * 60 * 1000);
    for (const [k, v] of tempToolFiles.entries()) {
        if (v.createdAt < cutoff) tempToolFiles.delete(k);
    }
    return {
        id,
        filename,
        mimeType,
        sizeBytes: buffer.length,
        sizeKb: Number((buffer.length / 1024).toFixed(1)),
        downloadUrl: `/api/tools/download/${id}`
    };
}

// GET /api/tools/download/:id — Instant file download with proper Content-Disposition
router.get('/api/tools/download/:id', (req, res) => {
    const item = tempToolFiles.get(req.params.id);
    if (!item) {
        return res.status(404).send('கோப்பு காலாவதியானது. தயவுசெய்து மீண்டும் உருவாக்கவும் (File expired).');
    }
    res.setHeader('Content-Type', item.mimeType);
    res.setHeader('Content-Length', item.buffer.length);
    const safeName = encodeURIComponent(item.filename);
    if (req.query.inline === '1') {
        res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${safeName}`);
    } else {
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${safeName}`);
    }
    return res.send(item.buffer);
});

/**
 * Helper: Build a PDF from an array of image buffers and binary-search compress to <= targetKb
 */
async function buildCompressedPdfFromImages(imageBuffers, options = {}) {
    const targetKb = Number(options.targetKb) || 0;
    const targetBytes = targetKb > 0 ? Math.floor(targetKb * 1024 * 0.96) : 0;
    const layoutMode = options.layoutMode || 'multi_page'; // 'multi_page' | 'two_in_one_vertical' | 'two_in_one_horizontal' | 'fit_image'

    // Compression profiles from highest quality down to ultra-compact
    const profiles = [
        { maxDim: 1650, quality: 84 },
        { maxDim: 1400, quality: 74 },
        { maxDim: 1200, quality: 64 },
        { maxDim: 1050, quality: 54 },
        { maxDim: 900,  quality: 45 },
        { maxDim: 780,  quality: 38 },
        { maxDim: 660,  quality: 32 },
        { maxDim: 550,  quality: 26 },
        { maxDim: 450,  quality: 20 }
    ];

    // If no targetKb limit, use high quality first profile
    const activeProfiles = targetBytes > 0 ? profiles : [profiles[0]];
    let lastPdfBuffer = null;

    for (let pIdx = 0; pIdx < activeProfiles.length; pIdx++) {
        const { maxDim, quality } = activeProfiles[pIdx];
        const pdfDoc = await PDFDocument.create();

        // Process all input images with sharp at current profile
        const processedJpegs = [];
        for (const rawBuf of imageBuffers) {
            const jpgBuf = await sharp(rawBuf)
                .rotate() // Auto-orient EXIF
                .flatten({ background: { r: 255, g: 255, b: 255 } })
                .resize({ width: maxDim, height: maxDim, fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality, mozjpeg: true })
                .toBuffer();
            const meta = await sharp(jpgBuf).metadata();
            processedJpegs.push({ buffer: jpgBuf, width: meta.width || 800, height: meta.height || 1000 });
        }

        if (layoutMode === 'two_in_one_vertical' && processedJpegs.length >= 2) {
            // Pair every 2 images vertically on a single A4 page (595 x 842 pt) — Ideal for Aadhaar Front + Back!
            for (let i = 0; i < processedJpegs.length; i += 2) {
                const page = pdfDoc.addPage([595.28, 841.89]);
                const margin = 28;
                const boxW = 595.28 - margin * 2;
                const boxH = (841.89 - margin * 3) / 2;

                // Top image
                const img1 = await pdfDoc.embedJpg(processedJpegs[i].buffer);
                const scale1 = Math.min(boxW / processedJpegs[i].width, boxH / processedJpegs[i].height);
                const w1 = processedJpegs[i].width * scale1;
                const h1 = processedJpegs[i].height * scale1;
                page.drawImage(img1, {
                    x: margin + (boxW - w1) / 2,
                    y: margin * 2 + boxH + (boxH - h1) / 2,
                    width: w1,
                    height: h1
                });

                // Bottom image (if exists)
                if (processedJpegs[i + 1]) {
                    const img2 = await pdfDoc.embedJpg(processedJpegs[i + 1].buffer);
                    const scale2 = Math.min(boxW / processedJpegs[i + 1].width, boxH / processedJpegs[i + 1].height);
                    const w2 = processedJpegs[i + 1].width * scale2;
                    const h2 = processedJpegs[i + 1].height * scale2;
                    page.drawImage(img2, {
                        x: margin + (boxW - w2) / 2,
                        y: margin + (boxH - h2) / 2,
                        width: w2,
                        height: h2
                    });
                }
            }
        } else if (layoutMode === 'two_in_one_horizontal' && processedJpegs.length >= 2) {
            // Pair every 2 images side-by-side on A4 Landscape (842 x 595 pt)
            for (let i = 0; i < processedJpegs.length; i += 2) {
                const page = pdfDoc.addPage([841.89, 595.28]);
                const margin = 24;
                const boxW = (841.89 - margin * 3) / 2;
                const boxH = 595.28 - margin * 2;

                const img1 = await pdfDoc.embedJpg(processedJpegs[i].buffer);
                const scale1 = Math.min(boxW / processedJpegs[i].width, boxH / processedJpegs[i].height);
                const w1 = processedJpegs[i].width * scale1;
                const h1 = processedJpegs[i].height * scale1;
                page.drawImage(img1, {
                    x: margin + (boxW - w1) / 2,
                    y: margin + (boxH - h1) / 2,
                    width: w1,
                    height: h1
                });

                if (processedJpegs[i + 1]) {
                    const img2 = await pdfDoc.embedJpg(processedJpegs[i + 1].buffer);
                    const scale2 = Math.min(boxW / processedJpegs[i + 1].width, boxH / processedJpegs[i + 1].height);
                    const w2 = processedJpegs[i + 1].width * scale2;
                    const h2 = processedJpegs[i + 1].height * scale2;
                    page.drawImage(img2, {
                        x: margin * 2 + boxW + (boxW - w2) / 2,
                        y: margin + (boxH - h2) / 2,
                        width: w2,
                        height: h2
                    });
                }
            }
        } else if (layoutMode === 'all_in_one_page' && processedJpegs.length >= 1) {
            // Arrange all uploaded/cropped images neatly on a single A4 page (e.g. 5 cropped photos on 1 page)
            const pageW = 595.28;
            const pageH = 841.89;
            const page = pdfDoc.addPage([pageW, pageH]);
            const margin = 22;
            const gap = 14;
            const n = processedJpegs.length;
            const cols = n <= 3 ? 1 : (n <= 6 ? 2 : 3);
            const rows = Math.ceil(n / cols);
            const cellW = (pageW - margin * 2 - gap * (cols - 1)) / cols;
            const cellH = (pageH - margin * 2 - gap * (rows - 1)) / rows;

            for (let idx = 0; idx < n; idx++) {
                const item = processedJpegs[idx];
                const col = idx % cols;
                const row = Math.floor(idx / cols);
                const img = await pdfDoc.embedJpg(item.buffer);
                const scale = Math.min(cellW / item.width, cellH / item.height);
                const w = item.width * scale;
                const h = item.height * scale;
                const cellX = margin + col * (cellW + gap);
                // PDF coordinates start from bottom-left
                const cellY = pageH - margin - (row + 1) * cellH - row * gap;
                page.drawImage(img, {
                    x: cellX + (cellW - w) / 2,
                    y: cellY + (cellH - h) / 2,
                    width: w,
                    height: h
                });
            }
        } else if (layoutMode === 'fit_image') {
            for (const item of processedJpegs) {
                const img = await pdfDoc.embedJpg(item.buffer);
                const page = pdfDoc.addPage([item.width, item.height]);
                page.drawImage(img, { x: 0, y: 0, width: item.width, height: item.height });
            }
        } else {
            // Standard A4 multi-page (1 image per A4 page, auto portrait/landscape)
            for (const item of processedJpegs) {
                const isLandscape = item.width > item.height * 1.15;
                const pw = isLandscape ? 841.89 : 595.28;
                const ph = isLandscape ? 595.28 : 841.89;
                const margin = 20;
                const boxW = pw - margin * 2;
                const boxH = ph - margin * 2;
                const scale = Math.min(boxW / item.width, boxH / item.height);
                const w = item.width * scale;
                const h = item.height * scale;

                const page = pdfDoc.addPage([pw, ph]);
                const img = await pdfDoc.embedJpg(item.buffer);
                page.drawImage(img, {
                    x: margin + (boxW - w) / 2,
                    y: margin + (boxH - h) / 2,
                    width: w,
                    height: h
                });
            }
        }

        const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
        lastPdfBuffer = Buffer.from(pdfBytes);

        if (targetBytes <= 0 || lastPdfBuffer.length <= targetBytes) {
            break;
        }
    }

    return lastPdfBuffer;
}

/**
 * 1A. POST /api/tools/pdf-compress
 * Compresses rendered PDF pages (sent as base64 JPEGs or multipart images) into a strict target-KB PDF,
 * AND optionally splits them into N parts (e.g., 5 parts) where each part is also compressed!
 */
router.post('/api/tools/pdf-compress', uploadTools.array('pages', 200), async (req, res) => {
    try {
        const targetKb = Number(req.body.targetKb) || 200;
        const originalName = (req.body.originalName || 'document.pdf').replace(/\.pdf$/i, '');
        const splitPartsCount = Number(req.body.splitParts) || 1;

        let imageBuffers = [];
        if (req.files && req.files.length > 0) {
            imageBuffers = req.files.map(f => f.buffer);
        } else if (req.body.pageDataUrls) {
            const urls = typeof req.body.pageDataUrls === 'string' ? JSON.parse(req.body.pageDataUrls) : req.body.pageDataUrls;
            if (Array.isArray(urls)) {
                imageBuffers = urls.map(u => {
                    const b64 = String(u).replace(/^data:image\/\w+;base64,/, '');
                    return Buffer.from(b64, 'base64');
                });
            }
        }

        if (imageBuffers.length === 0) {
            return res.status(400).json({ success: false, error: 'PDF பக்கங்கள் எதுவும் கிடைக்கவில்லை (No pages provided).' });
        }

        // Full compressed PDF
        const compressedBuffer = await buildCompressedPdfFromImages(imageBuffers, {
            targetKb,
            layoutMode: 'multi_page'
        });
        const mainFile = storeTempOutput(compressedBuffer, `${originalName}_compressed_${targetKb}KB.pdf`, 'application/pdf');

        // If user also requested splitting into N parts (e.g. 5 parts):
        const splitOutputs = [];
        if (splitPartsCount > 1 && imageBuffers.length > 1) {
            const actualParts = Math.min(splitPartsCount, imageBuffers.length);
            const basePerPart = Math.floor(imageBuffers.length / actualParts);
            let remainder = imageBuffers.length % actualParts;
            let cursor = 0;

            for (let p = 0; p < actualParts; p++) {
                const count = basePerPart + (remainder > 0 ? 1 : 0);
                if (remainder > 0) remainder--;
                const slice = imageBuffers.slice(cursor, cursor + count);
                const startPage = cursor + 1;
                const endPage = cursor + count;
                cursor += count;

                const partPdfBuf = await buildCompressedPdfFromImages(slice, {
                    targetKb,
                    layoutMode: 'multi_page'
                });
                const savedPart = storeTempOutput(
                    partPdfBuf,
                    `${originalName}_Part_${p + 1}_of_${actualParts}_(Pages_${startPage}-${endPage}).pdf`,
                    'application/pdf'
                );
                splitOutputs.push({
                    ...savedPart,
                    partNumber: p + 1,
                    totalParts: actualParts,
                    pageRange: startPage === endPage ? `பக்கம் ${startPage}` : `பக்கங்கள் ${startPage} – ${endPage}`,
                    pageCount: count
                });
            }
        }

        return res.json({
            success: true,
            totalPages: imageBuffers.length,
            targetKb,
            mainFile,
            splitOutputs
        });
    } catch (err) {
        console.error('[Tools PDF Compress Error]:', err);
        return res.status(500).json({ success: false, error: err.message || 'PDF சுருக்குவதில் பிழை ஏற்பட்டது.' });
    }
});

/**
 * 1B. POST /api/tools/pdf-split
 * Fast lossless splitting of large PDFs (even 20MB - 100MB) into 5 parts, N parts, custom page ranges, or individual pages.
 */
router.post('/api/tools/pdf-split', uploadTools.single('pdfFile'), async (req, res) => {
    try {
        if (!req.file || !req.file.buffer) {
            return res.status(400).json({ success: false, error: 'PDF கோப்பைத் தேர்ந்தெடுக்கவும்.' });
        }

        const originalName = (req.file.originalname || 'document.pdf').replace(/\.pdf$/i, '');
        const splitMode = req.body.splitMode || '5_parts'; // '5_parts' | 'n_parts' | 'each_page' | 'custom_range'
        const requestedParts = Math.max(1, Math.min(100, Number(req.body.numParts) || 5));
        const customRangeStr = (req.body.customRanges || '').trim();

        const srcDoc = await PDFDocument.load(req.file.buffer, { ignoreEncryption: true });
        const totalPages = srcDoc.getPageCount();

        if (totalPages === 0) {
            return res.status(400).json({ success: false, error: 'இந்த PDF-ல் பக்கங்கள் எதுவும் இல்லை.' });
        }

        // Determine page index groups (0-indexed)
        const groups = [];

        if (splitMode === 'each_page') {
            for (let i = 0; i < totalPages; i++) {
                groups.push([i]);
            }
        } else if (splitMode === 'custom_range' && customRangeStr) {
            // Parse ranges like "1-4, 5-8, 9-12" or "1, 2, 3-5"
            const tokens = customRangeStr.split(',').map(s => s.trim()).filter(Boolean);
            for (const tok of tokens) {
                if (tok.includes('-')) {
                    const [sRaw, eRaw] = tok.split('-').map(n => parseInt(n.trim(), 10));
                    if (!isNaN(sRaw) && !isNaN(eRaw)) {
                        const start = Math.max(1, Math.min(totalPages, Math.min(sRaw, eRaw)));
                        const end = Math.max(1, Math.min(totalPages, Math.max(sRaw, eRaw)));
                        const indices = [];
                        for (let p = start; p <= end; p++) indices.push(p - 1);
                        if (indices.length > 0) groups.push(indices);
                    }
                } else {
                    const p = parseInt(tok, 10);
                    if (!isNaN(p) && p >= 1 && p <= totalPages) {
                        groups.push([p - 1]);
                    }
                }
            }
        } else {
            // '5_parts' or 'n_parts'
            const targetParts = splitMode === '5_parts' ? 5 : requestedParts;
            const actualParts = Math.min(targetParts, totalPages);
            const basePerPart = Math.floor(totalPages / actualParts);
            let remainder = totalPages % actualParts;
            let cursor = 0;

            for (let p = 0; p < actualParts; p++) {
                const count = basePerPart + (remainder > 0 ? 1 : 0);
                if (remainder > 0) remainder--;
                const indices = [];
                for (let idx = cursor; idx < cursor + count; idx++) {
                    indices.push(idx);
                }
                cursor += count;
                if (indices.length > 0) groups.push(indices);
            }
        }

        if (groups.length === 0) {
            return res.status(400).json({ success: false, error: 'சரியான பக்க வரம்பை (Page Range) உள்ளிடவும்.' });
        }

        const splitOutputs = [];
        for (let gIdx = 0; gIdx < groups.length; gIdx++) {
            const pageIndices = groups[gIdx];
            const partDoc = await PDFDocument.create();
            const copiedPages = await partDoc.copyPages(srcDoc, pageIndices);
            for (const cp of copiedPages) {
                partDoc.addPage(cp);
            }
            const partBytes = await partDoc.save({ useObjectStreams: true });
            const partBuf = Buffer.from(partBytes);
            const firstPage = pageIndices[0] + 1;
            const lastPage = pageIndices[pageIndices.length - 1] + 1;
            const rangeLabel = firstPage === lastPage ? `பக்கம் ${firstPage}` : `பக்கங்கள் ${firstPage}–${lastPage}`;
            const fileRangeSuffix = firstPage === lastPage ? `Page_${firstPage}` : `Pages_${firstPage}-${lastPage}`;

            const savedPart = storeTempOutput(
                partBuf,
                `${originalName}_Part_${gIdx + 1}_(${fileRangeSuffix}).pdf`,
                'application/pdf'
            );

            splitOutputs.push({
                ...savedPart,
                partNumber: gIdx + 1,
                totalParts: groups.length,
                pageRange: rangeLabel,
                pageCount: pageIndices.length
            });
        }

        return res.json({
            success: true,
            originalName: req.file.originalname,
            originalSizeKb: Number((req.file.buffer.length / 1024).toFixed(1)),
            totalPages,
            requestedParts: splitMode === '5_parts' ? 5 : requestedParts,
            splitOutputs
        });
    } catch (err) {
        console.error('[Tools PDF Split Error]:', err);
        return res.status(500).json({ success: false, error: err.message || 'PDF பிரிப்பதில் பிழை ஏற்பட்டது.' });
    }
});

/**
 * 2. POST /api/tools/jpg-to-pdf
 * Converts 1 or multiple JPG/PNG/WebP images into a single PDF (supports Multi-page, 2-in-1 Vertical Aadhaar, 2-in-1 Horizontal, and strict KB compression)
 */
router.post('/api/tools/jpg-to-pdf', uploadTools.array('images', 100), async (req, res) => {
    try {
        const layoutMode = req.body.layoutMode || 'multi_page';
        const targetKb = Number(req.body.targetKb) || 200;
        const customName = (req.body.outputName || 'Converted_Document').replace(/\.pdf$/i, '');

        let imageBuffers = [];
        if (req.files && req.files.length > 0) {
            imageBuffers = req.files.map(f => f.buffer);
        } else if (req.body.imageDataUrls) {
            const urls = typeof req.body.imageDataUrls === 'string' ? JSON.parse(req.body.imageDataUrls) : req.body.imageDataUrls;
            if (Array.isArray(urls)) {
                imageBuffers = urls.map(u => {
                    const b64 = String(u).replace(/^data:image\/\w+;base64,/, '');
                    return Buffer.from(b64, 'base64');
                });
            }
        }

        if (imageBuffers.length === 0) {
            return res.status(400).json({ success: false, error: 'குறைந்தது 1 புகைப்படத்தைத் தேர்ந்தெடுக்கவும்.' });
        }

        const pdfBuffer = await buildCompressedPdfFromImages(imageBuffers, {
            targetKb,
            layoutMode
        });

        const saved = storeTempOutput(pdfBuffer, `${customName}.pdf`, 'application/pdf');
        return res.json({
            success: true,
            imageCount: imageBuffers.length,
            layoutMode,
            targetKb,
            output: saved
        });
    } catch (err) {
        console.error('[Tools JPG to PDF Error]:', err);
        return res.status(500).json({ success: false, error: err.message || 'JPG to PDF மாற்றத்தில் பிழை ஏற்பட்டது.' });
    }
});

/**
 * 3. POST /api/tools/photo-process
 * Exact Pixel Resizer + Strict Target-KB Compressor (e.g., <20KB, <50KB, <100KB for TNPDS / TNeGA / PAN / Voter ID)
 */
router.post('/api/tools/photo-process', uploadTools.single('photo'), async (req, res) => {
    try {
        let inputBuffer = null;
        if (req.file && req.file.buffer) {
            inputBuffer = req.file.buffer;
        } else if (req.body.imageDataUrl) {
            const b64 = String(req.body.imageDataUrl).replace(/^data:image\/\w+;base64,/, '');
            inputBuffer = Buffer.from(b64, 'base64');
        }

        if (!inputBuffer) {
            return res.status(400).json({ success: false, error: 'புகைப்படம் எதுவும் வழங்கப்படவில்லை.' });
        }

        const targetWidth = Number(req.body.width) || 0;
        const targetHeight = Number(req.body.height) || 0;
        const targetKb = Number(req.body.targetKb) || 50;
        const targetBytes = targetKb > 0 ? Math.floor(targetKb * 1024 * 0.96) : 0;
        const fitMode = req.body.fitMode || 'fill'; // 'fill' (exact WxH after crop) or 'cover' or 'inside'
        const outputFormat = (req.body.format || 'jpeg').toLowerCase();
        const presetLabel = (req.body.presetLabel || 'Photo').replace(/[^a-zA-Z0-9_-]/g, '_');

        let basePipeline = sharp(inputBuffer).rotate().flatten({ background: { r: 255, g: 255, b: 255 } });
        if (targetWidth > 0 && targetHeight > 0) {
            basePipeline = basePipeline.resize({
                width: targetWidth,
                height: targetHeight,
                fit: fitMode === 'inside' ? 'inside' : (fitMode === 'cover' ? 'cover' : 'fill')
            });
        } else if (targetWidth > 0) {
            basePipeline = basePipeline.resize({ width: targetWidth, withoutEnlargement: true });
        }

        const resizedRawBuffer = await basePipeline.png().toBuffer();
        const meta = await sharp(resizedRawBuffer).metadata();
        const finalWidth = meta.width || targetWidth;
        const finalHeight = meta.height || targetHeight;

        let finalBuffer = null;
        let finalQuality = 90;

        if (outputFormat === 'png' && targetBytes <= 0) {
            finalBuffer = resizedRawBuffer;
        } else {
            // Binary search / step down JPEG quality (from 92 down to 12) to guarantee <= targetBytes
            for (let q = 92; q >= 12; q -= 4) {
                const candidate = await sharp(resizedRawBuffer)
                    .withMetadata({ density: 200 })
                    .jpeg({ quality: q, mozjpeg: true })
                    .toBuffer();
                finalBuffer = candidate;
                finalQuality = q;
                if (targetBytes <= 0 || candidate.length <= targetBytes) {
                    break;
                }
            }

            // If still larger than targetBytes (e.g. huge dimensions with <20KB limit), scale dimensions down progressively
            if (targetBytes > 0 && finalBuffer.length > targetBytes) {
                for (let scale = 0.85; scale >= 0.30; scale -= 0.1) {
                    const sw = Math.max(80, Math.round(finalWidth * scale));
                    const sh = Math.max(40, Math.round(finalHeight * scale));
                    const candidate = await sharp(resizedRawBuffer)
                        .resize(sw, sh, { fit: 'fill' })
                        .jpeg({ quality: 35, mozjpeg: true })
                        .toBuffer();
                    finalBuffer = candidate;
                    if (candidate.length <= targetBytes) break;
                }
            }
        }

        const outMeta = await sharp(finalBuffer).metadata();
        const ext = outputFormat === 'png' && targetBytes <= 0 ? 'png' : 'jpg';
        const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
        const saved = storeTempOutput(
            finalBuffer,
            `${presetLabel}_${outMeta.width || finalWidth}x${outMeta.height || finalHeight}_${Number((finalBuffer.length / 1024).toFixed(1))}KB.${ext}`,
            mime
        );

        return res.json({
            success: true,
            width: outMeta.width || finalWidth,
            height: outMeta.height || finalHeight,
            qualityUsed: finalQuality,
            sizeBytes: finalBuffer.length,
            sizeKb: Number((finalBuffer.length / 1024).toFixed(2)),
            dataUrl: `data:${mime};base64,${finalBuffer.toString('base64')}`,
            output: saved
        });
    } catch (err) {
        console.error('[Tools Photo Process Error]:', err);
        return res.status(500).json({ success: false, error: err.message || 'புகைப்படம் சீரமைப்பதில் பிழை ஏற்பட்டது.' });
    }
});

/**
 * 4A. POST /api/tools/signature-clean
 * Extracts a crisp transparent PNG signature from a photo of a signature on white paper!
 */
router.post('/api/tools/signature-clean', uploadTools.single('signature'), async (req, res) => {
    try {
        let inputBuffer = null;
        if (req.file && req.file.buffer) {
            inputBuffer = req.file.buffer;
        } else if (req.body.imageDataUrl) {
            const b64 = String(req.body.imageDataUrl).replace(/^data:image\/\w+;base64,/, '');
            inputBuffer = Buffer.from(b64, 'base64');
        }

        if (!inputBuffer) {
            return res.status(400).json({ success: false, error: 'கையொப்பப் புகைப்படத்தைத் தேர்ந்தெடுக்கவும்.' });
        }

        const inkColor = req.body.inkColor || 'blue'; // 'blue' | 'black' | 'original'
        const threshold = Math.max(80, Math.min(245, Number(req.body.threshold) || 180));

        const { data, info } = await sharp(inputBuffer)
            .rotate()
            .resize({ width: 900, height: 450, fit: 'inside', withoutEnlargement: true })
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

        const outPixels = Buffer.alloc(data.length);
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            if (a < 25) {
                outPixels[i + 3] = 0;
                continue;
            }

            // Perceived luminance
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            if (lum >= threshold) {
                // Background paper -> 100% transparent
                outPixels[i] = 255;
                outPixels[i + 1] = 255;
                outPixels[i + 2] = 255;
                outPixels[i + 3] = 0;
            } else {
                // Smooth anti-aliased ink intensity
                const darkness = Math.min(1, (threshold - lum) / Math.max(30, threshold * 0.55));
                const alpha = Math.round(Math.min(255, darkness * 255));

                if (inkColor === 'blue') {
                    outPixels[i] = 15;      // R
                    outPixels[i + 1] = 42;  // G
                    outPixels[i + 2] = 168; // B (Rich Govt Stamp/Pen Blue)
                } else if (inkColor === 'black') {
                    outPixels[i] = 15;
                    outPixels[i + 1] = 23;
                    outPixels[i + 2] = 42;
                } else {
                    outPixels[i] = r;
                    outPixels[i + 1] = g;
                    outPixels[i + 2] = b;
                }
                outPixels[i + 3] = alpha;
            }
        }

        // Trim empty transparent margins around the signature
        let cleanPngBuffer = await sharp(outPixels, {
            raw: { width: info.width, height: info.height, channels: 4 }
        })
            .png()
            .toBuffer();

        try {
            cleanPngBuffer = await sharp(cleanPngBuffer).trim().png().toBuffer();
        } catch (_) {
            // If image is blank or trim fails, keep untrimmed buffer
        }

        const saved = storeTempOutput(cleanPngBuffer, 'Digital_Signature_Transparent.png', 'image/png');
        return res.json({
            success: true,
            sizeKb: Number((cleanPngBuffer.length / 1024).toFixed(1)),
            dataUrl: `data:image/png;base64,${cleanPngBuffer.toString('base64')}`,
            output: saved
        });
    } catch (err) {
        console.error('[Tools Signature Clean Error]:', err);
        return res.status(500).json({ success: false, error: err.message || 'கையொப்பப் பின்னணி நீக்குவதில் பிழை.' });
    }
});

/**
 * 4B. POST /api/tools/pdf-sign
 * Applies a transparent Digital Signature PNG onto a PDF document (or Image) at exact coordinates!
 */
router.post('/api/tools/pdf-sign', uploadTools.single('docFile'), async (req, res) => {
    try {
        if (!req.file || !req.file.buffer) {
            return res.status(400).json({ success: false, error: 'கையொப்பமிட வேண்டிய PDF அல்லது ஆவணத்தைத் தேர்ந்தெடுக்கவும்.' });
        }
        const sigDataUrl = req.body.signatureDataUrl;
        if (!sigDataUrl) {
            return res.status(400).json({ success: false, error: 'முதலில் கையொப்பத்தை வரையவும் அல்லது பதிவேற்றவும்.' });
        }

        const sigBuf = Buffer.from(String(sigDataUrl).replace(/^data:image\/\w+;base64,/, ''), 'base64');
        const sigPngBuffer = await sharp(sigBuf).png().toBuffer();

        // Ratios from visual preview (0.0 to 1.0 from top-left of page)
        const xRatio = Math.max(0, Math.min(0.95, Number(req.body.xRatio) ?? 0.65));
        const yRatio = Math.max(0, Math.min(0.95, Number(req.body.yRatio) ?? 0.80));
        const wRatio = Math.max(0.05, Math.min(0.80, Number(req.body.wRatio) ?? 0.24));
        const hRatio = Math.max(0.03, Math.min(0.50, Number(req.body.hRatio) ?? 0.09));
        const pageTarget = req.body.pageTarget || 'current'; // 'current' | 'all' | 'last'
        const currentPageNum = Math.max(1, Number(req.body.pageNumber) || 1);

        const isPdf = req.file.mimetype === 'application/pdf' || (req.file.originalname || '').toLowerCase().endsWith('.pdf');
        const baseName = (req.file.originalname || 'Document').replace(/\.(pdf|jpg|jpeg|png)$/i, '');

        let pdfDoc;
        if (isPdf) {
            pdfDoc = await PDFDocument.load(req.file.buffer, { ignoreEncryption: true });
        } else {
            // Convert uploaded image into a 1-page PDF first
            pdfDoc = await PDFDocument.create();
            const jpgBuf = await sharp(req.file.buffer).rotate().flatten({ background: { r: 255, g: 255, b: 255 } }).jpeg({ quality: 90 }).toBuffer();
            const meta = await sharp(jpgBuf).metadata();
            const page = pdfDoc.addPage([meta.width || 595, meta.height || 842]);
            const embeddedBg = await pdfDoc.embedJpg(jpgBuf);
            page.drawImage(embeddedBg, { x: 0, y: 0, width: meta.width || 595, height: meta.height || 842 });
        }

        const embeddedSig = await pdfDoc.embedPng(sigPngBuffer);
        const pages = pdfDoc.getPages();
        const totalPages = pages.length;

        const targetIndices = [];
        if (pageTarget === 'all') {
            for (let i = 0; i < totalPages; i++) targetIndices.push(i);
        } else if (pageTarget === 'last') {
            targetIndices.push(totalPages - 1);
        } else {
            targetIndices.push(Math.min(totalPages - 1, currentPageNum - 1));
        }

        for (const idx of targetIndices) {
            const page = pages[idx];
            const { width: pw, height: ph } = page.getSize();
            const drawW = pw * wRatio;
            const drawH = ph * hRatio;
            const drawX = pw * xRatio;
            // PDF coordinate system has Y=0 at bottom-left, whereas UI canvas has Y=0 at top-left
            const drawY = Math.max(0, ph - (ph * yRatio) - drawH);

            page.drawImage(embeddedSig, {
                x: drawX,
                y: drawY,
                width: drawW,
                height: drawH
            });
        }

        const signedPdfBytes = await pdfDoc.save({ useObjectStreams: true });
        const signedBuf = Buffer.from(signedPdfBytes);
        const saved = storeTempOutput(signedBuf, `${baseName}_Signed.pdf`, 'application/pdf');

        return res.json({
            success: true,
            totalPages,
            signedPages: targetIndices.map(i => i + 1),
            output: saved
        });
    } catch (err) {
        console.error('[Tools PDF Sign Error]:', err);
        return res.status(500).json({ success: false, error: err.message || 'ஆவணத்தில் கையொப்பமிடுவதில் பிழை ஏற்பட்டது.' });
    }
});

module.exports = router;
