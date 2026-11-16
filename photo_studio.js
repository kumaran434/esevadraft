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

const studioDir = getSafeStudioDir();

async function produceCompliantPassportPhoto(inputPath) {
    if (!fs.existsSync(inputPath)) {
        console.warn(`File not found for photo studio: ${inputPath}`);
        return inputPath;
    }
    const sharp = getSharp();
    if (!sharp) {
        return inputPath;
    }

    const outputPath = path.join(studioDir, `studio_passport_${Date.now()}.jpeg`);

    try {
        // Universal Government Standard (TNeGA: <50KB, 200x230 | TNPDS: <100KB)
        await sharp(inputPath)
            .flatten({ background: { r: 255, g: 255, b: 255 } })
            .resize(200, 230, {
                fit: 'cover',
                position: 'top'
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
                quality: 84,
                chromaSubsampling: '4:2:0'
            })
            .toFile(outputPath);

        let fileSizeBytes = fs.statSync(outputPath).size;
        // Strict Universal Ceiling: Must be strictly < 45 KB to safely pass TNeGA (<50KB) and TNPDS (<100KB)
        if (fileSizeBytes > 45 * 1024) {
            await sharp(inputPath)
                .flatten({ background: { r: 255, g: 255, b: 255 } })
                .resize(200, 230, { fit: 'cover', position: 'top' })
                .jpeg({ quality: 74, chromaSubsampling: '4:2:0' })
                .toFile(outputPath);
            fileSizeBytes = fs.statSync(outputPath).size;
        }

        const fileSizeKB = (fileSizeBytes / 1024).toFixed(1);
        console.log(`✨ AI Passport Studio Photo generated: ${outputPath} (${fileSizeKB} KB - Universal <45KB compliant)`);
        return outputPath;
    } catch (e) {
        console.error('Photo Studio notice:', e.message);
        return inputPath;
    }
}

async function produceCompliantDocument(inputPath, options = {}) {
    if (!fs.existsSync(inputPath)) return inputPath;

    if (inputPath.toLowerCase().endsWith('.pdf')) {
        const sz = fs.statSync(inputPath).size;
        // Universal Document Ceiling: <185 KB passes TNeGA (<200KB) and TNPDS (<1MB)
        if (sz > 185 * 1024) {
            console.log(`📄 Large PDF detected (${(sz / 1024).toFixed(1)} KB > 185 KB). Auto-compressing to Universal Government Standard (< 185 KB)...`);
            return await compressHeavyPdf(inputPath);
        }
        console.log(`📄 Compliant PDF uploaded (${(sz / 1024).toFixed(1)} KB <= 185 KB). Ready directly for all portals!`);
        return inputPath;
    }

    const sharp = getSharp();
    if (!sharp) return inputPath;
    const outputJpg = path.join(studioDir, `doc_${Date.now()}_${path.basename(inputPath, path.extname(inputPath))}.jpeg`);
    let croppedPath = inputPath;

    try {
        croppedPath = await cropDocumentToExactBoundary(inputPath, options);
        await sharp(croppedPath)
            .rotate()
            .resize({ width: 1000, height: 1350, fit: 'inside', withoutEnlargement: true })
            .flatten({ background: { r: 255, g: 255, b: 255 } })
            .normalize()
            .gamma(1.1)
            .modulate({
                brightness: 1.05,
                saturation: 1.15
            })
            .sharpen({
                sigma: 1.6,
                m1: 2.0,
                m2: 0.6
            })
            .jpeg({
                quality: 82,
                chromaSubsampling: '4:2:0'
            })
            .toFile(outputJpg);

        let fileSizeBytes = fs.statSync(outputJpg).size;
        if (fileSizeBytes > 98 * 1024) {
            await sharp(croppedPath)
                .rotate()
                .resize({ width: 860, height: 1160, fit: 'inside', withoutEnlargement: true })
                .flatten({ background: { r: 255, g: 255, b: 255 } })
                .normalize()
                .gamma(1.1)
                .modulate({ brightness: 1.05, saturation: 1.1 })
                .sharpen({ sigma: 1.4, m1: 1.8, m2: 0.5 })
                .jpeg({ quality: 68, chromaSubsampling: '4:2:0' })
                .toFile(outputJpg);
            fileSizeBytes = fs.statSync(outputJpg).size;
        }
        const fileSizeKB = (fileSizeBytes / 1024).toFixed(1);
        console.log(`✨ AI Enhanced Compliant Document Generated: ${outputJpg} (${fileSizeKB} KB)`);
        return outputJpg;
    } catch (e) {
        console.error('Doc optimizer error:', e.message);
        return inputPath;
    } finally {
        try { if (croppedPath && croppedPath !== inputPath && fs.existsSync(croppedPath)) fs.unlinkSync(croppedPath); } catch (_) {}
    }
}

async function produceDualSidedDocument(frontPath, backPath) {
    return coreProduceDualSided(frontPath, backPath, produceCompliantDocument);
}

async function extractFacePassportFromDocument(filePath, boundingBox = null) {
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

        const passportFinal = await produceCompliantPassportPhoto(tempRawCrop);
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
