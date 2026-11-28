let _sharp = null;
function getSharp() {
    if (_sharp === null) {
        try { _sharp = require('sharp'); } catch (e) { _sharp = false; }
    }
    return _sharp;
}
const fs = require('fs');
const path = require('path');

const {
    getSafeStudioDir,
    compressHeavyPdf,
    cropDocumentToExactBoundary,
    produceDualSidedDocument: coreProduceDualSided,
    generatePreviewFromPdf
} = require('./src/services/document_pdf_generator');
const { resolveServiceDocumentPolicy } = require('./src/services/govt_document_policy');

const studioDir = getSafeStudioDir();

/**
 * Service-Wise HD Passport Photo Studio (Golden Rule 26)
 * - TNPDS Ration Card Services: Crisp HD 400x460 portrait up to 250 KB (Govt limit: 5 MB)
 * - TNeGA Revenue Services: Crisp 200x230 portrait strictly <= 46 KB (Govt limit: 50 KB)
 * - Future Services: Respects exact service/portal policy or manifest.documentLimits
 */
async function produceCompliantPassportPhoto(inputPath, options = {}) {
    if (!fs.existsSync(inputPath)) {
        console.warn(`File not found for photo studio: ${inputPath}`);
        return inputPath;
    }
    const sharp = getSharp();
    if (!sharp) {
        return inputPath;
    }

    const policy = resolveServiceDocumentPolicy(options);
    const targetMaxKb = Number(options.maxPhotoKb || options.maxKb || policy.photoMaxKB || 250);
    const targetMaxBytes = targetMaxKb * 1024;
    const baseW = Number(options.photoWidth || policy.photoWidth || (targetMaxKb >= 100 ? 400 : 200));
    const baseH = Number(options.photoHeight || policy.photoHeight || (targetMaxKb >= 100 ? 460 : 230));
    const baseQuality = Number(policy.photoQualityTarget || (targetMaxKb >= 100 ? 92 : 86));

    const outputPath = path.join(studioDir, `studio_passport_${Date.now()}.jpeg`);

    try {
        // 1. Inspect image dimensions with EXIF rotation
        const rotMeta = await sharp(inputPath).rotate().metadata();
        const imgW = rotMeta.width || 600;
        const imgH = rotMeta.height || 800;

        // 2. Discover Face Bounding Box if not provided
        let faceBox = options.faceBoundingBox || options.boundingBox || null;
        if (!faceBox && !options.skipFaceExtraction) {
            try {
                const { inspectAndExtractDocument } = require('./ai_document_extractor');
                const extracted = await inspectAndExtractDocument(inputPath);
                if (extracted && extracted.faceDetected && Array.isArray(extracted.faceBoundingBox)) {
                    faceBox = extracted.faceBoundingBox;
                }
            } catch (_) {}
        }

        let extractLeft = 0;
        let extractTop = 0;
        let extractW = imgW;
        let extractH = imgH;
        let hasFaceCrop = false;

        if (Array.isArray(faceBox) && faceBox.length === 4) {
            const [ymin, xmin, ymax, xmax] = faceBox;
            const faceTop = (ymin / 1000) * imgH;
            const faceBottom = (ymax / 1000) * imgH;
            const faceLeft = (xmin / 1000) * imgW;
            const faceRight = (xmax / 1000) * imgW;
            const faceW = faceRight - faceLeft;
            const faceH = faceBottom - faceTop;
            const faceCenterX = faceLeft + faceW / 2;
            const faceCenterY = faceTop + faceH / 2;

            if (faceW > 30 && faceH > 30) {
                // Indian Passport Standard aspect ratio (200:230 = 0.8696)
                let targetH = faceH / 0.65;
                let targetW = targetH * (baseW / baseH);

                if (targetW < faceW * 1.35) {
                    targetW = faceW * 1.35;
                    targetH = targetW * (baseH / baseW);
                }

                let cropTop = faceCenterY - (targetH * 0.42);
                let cropLeft = faceCenterX - (targetW / 2);

                if (cropTop < 0) cropTop = 0;
                if (cropLeft < 0) cropLeft = 0;
                if (cropTop + targetH > imgH) cropTop = Math.max(0, imgH - targetH);
                if (cropLeft + targetW > imgW) cropLeft = Math.max(0, imgW - targetW);

                extractLeft = Math.max(0, Math.round(cropLeft));
                extractTop = Math.max(0, Math.round(cropTop));
                extractW = Math.min(imgW - extractLeft, Math.max(40, Math.round(targetW)));
                extractH = Math.min(imgH - extractTop, Math.max(40, Math.round(targetH)));
                hasFaceCrop = true;
            }
        }

        // 3. Build Sharp pipeline with proper rotation and face-centered crop
        let pipeline = sharp(inputPath).rotate();

        if (hasFaceCrop && extractW > 40 && extractH > 40 && (extractW < imgW || extractH < imgH)) {
            pipeline = pipeline.extract({
                left: extractLeft,
                top: extractTop,
                width: extractW,
                height: extractH
            });
        }

        const resizeStrategy = hasFaceCrop ? 'center' : (sharp.strategy ? sharp.strategy.attention : 'attention');

        await pipeline
            .flatten({ background: { r: 255, g: 255, b: 255 } })
            .resize(baseW, baseH, {
                fit: 'cover',
                position: resizeStrategy
            })
            .modulate({
                brightness: 1.04,
                saturation: 1.05
            })
            .sharpen({
                sigma: 1.2,
                m1: 1.5,
                m2: 0.5
            })
            .jpeg({
                quality: baseQuality,
                chromaSubsampling: targetMaxKb >= 100 ? '4:4:4' : '4:2:0'
            })
            .toFile(outputPath);

        let fileSizeBytes = fs.statSync(outputPath).size;
        // Service-Wise Step-Down Ladder (ONLY steps down if output exceeds this specific service's limit!)
        const photoSteps = targetMaxKb >= 100
            ? [
                { w: baseW, h: baseH, q: 84 },
                { w: Math.round(baseW * 0.85), h: Math.round(baseH * 0.85), q: 78 },
                { w: 300, h: 345, q: 72 },
                { w: 240, h: 276, q: 64 }
            ]
            : [
                { w: baseW, h: baseH, q: 74 },
                { w: baseW, h: baseH, q: 60 },
                { w: Math.round(baseW * 0.9), h: Math.round(baseH * 0.9), q: 48 },
                { w: 160, h: 184, q: 38 }
            ];

        for (const ps of photoSteps) {
            if (fileSizeBytes <= targetMaxBytes) break;
            let rePipeline = sharp(inputPath).rotate();
            if (hasFaceCrop && extractW > 40 && extractH > 40 && (extractW < imgW || extractH < imgH)) {
                rePipeline = rePipeline.extract({
                    left: extractLeft,
                    top: extractTop,
                    width: extractW,
                    height: extractH
                });
            }
            await rePipeline
                .flatten({ background: { r: 255, g: 255, b: 255 } })
                .resize(ps.w, ps.h, { fit: 'cover', position: resizeStrategy })
                .jpeg({ quality: ps.q, chromaSubsampling: '4:2:0' })
                .toFile(outputPath);
            fileSizeBytes = fs.statSync(outputPath).size;
        }

        const fileSizeKB = (fileSizeBytes / 1024).toFixed(1);
        console.log(`✨ AI Passport Studio Photo [${policy.serviceId || policy.portal} <= ${targetMaxKb} KB]: ${outputPath} (${fileSizeKB} KB, ${baseW}x${baseH}, faceCropped: ${hasFaceCrop})`);
        return outputPath;
    } catch (e) {
        console.error('Photo Studio notice:', e.message);
        return inputPath;
    }
}

/**
 * Service-Wise HD Document Compliance Processor (Golden Rule 26)
 * - Smart No-Downgrade: PDFs already <= service's maxKb are NEVER degraded!
 * - TNPDS Ration Card Services: Up to 850 KB HD (1600x2200, q=90) under 1 MB limit.
 * - TNeGA Revenue Services: Strictly <= 185 KB under 200 KB limit.
 * - Explicit options.maxKb always respected when provided.
 */
async function produceCompliantDocument(inputPath, options = {}, legacyMaxKb = null) {
    if (!fs.existsSync(inputPath)) return inputPath;

    // Gracefully normalize legacy 3-arg callers (inputPath, destPathString, maxKbNumber)
    const normalizedOpts = (options && typeof options === 'object')
        ? { ...options }
        : { ...(Number(legacyMaxKb) > 0 ? { maxKb: Number(legacyMaxKb) } : {}) };

    const policy = resolveServiceDocumentPolicy(normalizedOpts);
    const maxKb = Number(normalizedOpts.maxKb || policy.maxSizeKB || 850);
    const maxBytes = maxKb * 1024;

    if (inputPath.toLowerCase().endsWith('.pdf')) {
        const sz = fs.statSync(inputPath).size;
        if (sz > maxBytes) {
            console.log(`📄 Large PDF detected (${(sz / 1024).toFixed(1)} KB > ${maxKb} KB for ${policy.serviceId || policy.portal}). Compressing cleanly under ${maxKb} KB...`);
            return await compressHeavyPdf(inputPath, maxKb);
        }
        console.log(`📄 Crisp PDF kept at original quality (${(sz / 1024).toFixed(1)} KB <= ${maxKb} KB for ${policy.serviceId || policy.portal}) — Zero unnecessary compression!`);
        return inputPath;
    }

    const sharp = getSharp();
    if (!sharp) return inputPath;
    const outputJpg = path.join(studioDir, `doc_${Date.now()}_${path.basename(inputPath, path.extname(inputPath))}.jpeg`);
    let croppedPath = inputPath;

    try {
        croppedPath = await cropDocumentToExactBoundary(inputPath, normalizedOpts);
        const isHighResProfile = maxKb >= 400;
        const passSpecs = isHighResProfile
            ? [
                { w: policy.docMaxWidth || 1600, h: policy.docMaxHeight || 2200, q: policy.jpegQualityTarget || 90 },
                { w: 1400, h: 1900, q: 84 },
                { w: 1200, h: 1600, q: 76 },
                { w: 1000, h: 1350, q: 66 },
                { w: 860, h: 1160, q: 54 },
                { w: 720, h: 980, q: 42 }
            ]
            : [
                { w: policy.docMaxWidth || 1100, h: policy.docMaxHeight || 1480, q: policy.jpegQualityTarget || 84 },
                { w: 1000, h: 1350, q: 74 },
                { w: 860, h: 1160, q: 64 },
                { w: 760, h: 1020, q: 52 },
                { w: 660, h: 880, q: 42 },
                { w: 560, h: 760, q: 32 }
            ];

        let fileSizeBytes = 0;
        for (const spec of passSpecs) {
            await sharp(croppedPath)
                .rotate()
                .resize({ width: spec.w, height: spec.h, fit: 'inside', withoutEnlargement: true })
                .flatten({ background: { r: 255, g: 255, b: 255 } })
                .normalize()
                .gamma(1.1)
                .modulate({ brightness: 1.05, saturation: spec.q >= 70 ? 1.15 : 1.08 })
                .sharpen({ sigma: spec.q >= 70 ? 1.6 : 1.3, m1: 1.8, m2: 0.5 })
                .jpeg({ quality: spec.q, chromaSubsampling: '4:2:0' })
                .toFile(outputJpg);
            fileSizeBytes = fs.statSync(outputJpg).size;
            if (fileSizeBytes <= maxBytes) break;
        }
        const fileSizeKB = (fileSizeBytes / 1024).toFixed(1);
        console.log(`✨ AI Enhanced Compliant Document [${policy.serviceId || policy.portal} <= ${maxKb} KB]: ${outputJpg} (${fileSizeKB} KB)`);
        return outputJpg;
    } catch (e) {
        console.error('Doc optimizer error:', e.message);
        return inputPath;
    } finally {
        try { if (croppedPath && croppedPath !== inputPath && fs.existsSync(croppedPath)) fs.unlinkSync(croppedPath); } catch (_) {}
    }
}

async function produceDualSidedDocument(frontPath, backPath, produceCompliantDocFallback = produceCompliantDocument, options = {}) {
    // Support convenience 3-arg signature: produceDualSidedDocument(front, back, optionsObj)
    if (produceCompliantDocFallback && typeof produceCompliantDocFallback === 'object') {
        options = produceCompliantDocFallback;
        produceCompliantDocFallback = produceCompliantDocument;
    }
    return coreProduceDualSided(frontPath, backPath, produceCompliantDocFallback || produceCompliantDocument, options);
}

async function extractFacePassportFromDocument(filePath, boundingBox = null, options = {}) {
    const sharp = getSharp();
    if (!fs.existsSync(filePath) || !sharp) return null;
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.pdf') return null;

    try {
        const meta = await sharp(filePath).metadata();
        const w = meta.width;
        const h = meta.height;
        let left, top, extractW, extractH;

        if (Array.isArray(boundingBox) && boundingBox.length === 4) {
            const [ymin, xmin, ymax, xmax] = boundingBox;
            const boxH = (ymax - ymin) * h / 1000;
            const boxW = (xmax - xmin) * w / 1000;
            const padY = Math.round(boxH * 0.18);
            const padX = Math.round(boxW * 0.18);
            top = Math.max(0, Math.round((ymin * h / 1000) - padY));
            left = Math.max(0, Math.round((xmin * w / 1000) - padX));
            extractW = Math.min(w - left, Math.round(boxW + padX * 2));
            extractH = Math.min(h - top, Math.round(boxH + padY * 2));
        } else {
            left = Math.round(w * 0.05);
            top = Math.round(h * 0.22);
            extractW = Math.round(w * 0.35);
            extractH = Math.round(h * 0.52);
        }

        if (extractW < 40 || extractH < 40) return null;

        const tempRawCrop = path.join(studioDir, `raw_face_crop_${Date.now()}.jpeg`);
        await sharp(filePath)
            .extract({ left, top, width: extractW, height: extractH })
            .toFile(tempRawCrop);

        const passportFinal = await produceCompliantPassportPhoto(tempRawCrop, { ...options, skipFaceExtraction: true });
        try { if (fs.existsSync(tempRawCrop) && tempRawCrop !== passportFinal) fs.unlinkSync(tempRawCrop); } catch (e) {}

        if (passportFinal && fs.existsSync(passportFinal)) {
            console.log(`✨ AI Auto-Extracted Passport Photo from Aadhaar: ${passportFinal}`);
            return passportFinal;
        }
        return null;
    } catch (e) {
        console.warn('Face extraction notice:', e.message);
        return null;
    }
}

module.exports = {
    produceCompliantPassportPhoto,
    produceCompliantDocument,
    produceDualSidedDocument,
    cropDocumentToExactBoundary,
    compressHeavyPdf,
    extractFacePassportFromDocument,
    generatePreviewFromPdf
};
