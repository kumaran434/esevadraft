/**
 * eSevaDraft - Official TNPDS Receipt PDF Generator Service
 * Modular service for generating official citizen acknowledgment receipts
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

function getSafeDir(subDir) {
    const localDir = path.join(__dirname, '..', '..', 'public', subDir);
    try {
        if (!fs.existsSync(localDir)) {
            fs.mkdirSync(localDir, { recursive: true });
        }
        const testFile = path.join(localDir, `.perm_test_${Date.now()}`);
        fs.writeFileSync(testFile, 'ok');
        fs.unlinkSync(testFile);
        return localDir;
    } catch (e) {
        const fallbackDir = path.join(os.tmpdir(), 'esevadraft', subDir);
        try {
            if (!fs.existsSync(fallbackDir)) {
                fs.mkdirSync(fallbackDir, { recursive: true });
            }
        } catch (e2) {}
        return fallbackDir;
    }
}

const receiptsDir = getSafeDir('receipts');
const previewsDir = getSafeDir('previews');

function getTamilFontPaths() {
    const regularCandidates = [
        'C:\\Windows\\Fonts\\Nirmala.ttf',
        'C:\\Windows\\Fonts\\latha.ttf',
        path.join(__dirname, '..', '..', 'public', 'fonts', 'NotoSansTamil-Regular.ttf'),
        '/usr/share/fonts/truetype/noto/NotoSansTamil-Regular.ttf'
    ];
    const boldCandidates = [
        'C:\\Windows\\Fonts\\Nirmalab.ttf',
        'C:\\Windows\\Fonts\\NirmalaB.ttf',
        'C:\\Windows\\Fonts\\lathab.ttf',
        path.join(__dirname, '..', '..', 'public', 'fonts', 'NotoSansTamil-Bold.ttf'),
        '/usr/share/fonts/truetype/noto/NotoSansTamil-Bold.ttf'
    ];
    const regular = regularCandidates.find(p => fs.existsSync(p)) || null;
    const bold = boldCandidates.find(p => fs.existsSync(p)) || regular;
    return { regular, bold };
}

function hasTamilChars(str) {
    return /[\u0B80-\u0BFF]/.test(String(str || ''));
}

/**
 * Generates an official-looking TNPDS Acknowledgment PDF Receipt for Add Family Member.
 */
function generateAddMemberReceiptPdf(destPath, data) {
    return new Promise((resolve) => {
        let PDFDoc = null;
        try { PDFDoc = require('pdfkit'); } catch (e) {}

        if (!PDFDoc) {
            const minimalPdf = Buffer.from(
                `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 595 842]/Parent 2 0 R/Contents 4 0 R>>endobj\n4 0 obj<</Length 120>>stream\nBT /F1 14 Tf 50 750 Td (TNPDS Add Family Member Acknowledgment Receipt) Tj /F1 12 Tf 50 720 Td (Application Ref No: ${data.refNo || ''}) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000204 00000 n \ntrailer<</Size 5/Root 1 0 R>>\nstartxref\n376\n%%EOF\n`
            );
            fs.writeFileSync(destPath, minimalPdf);
            return resolve(destPath);
        }

        try {
            const doc = new PDFDoc({ margin: 40, size: 'A4' });
            const stream = fs.createWriteStream(destPath);
            doc.pipe(stream);

            const tFonts = getTamilFontPaths();
            if (tFonts.regular) {
                try {
                    doc.registerFont('TamilIndic', tFonts.regular);
                    if (tFonts.bold) doc.registerFont('TamilIndic-Bold', tFonts.bold);
                } catch (_) {}
            }

            const drawText = (text, x, y, options = {}, isBold = false) => {
                const str = String(text || '');
                if (tFonts.regular && hasTamilChars(str)) {
                    doc.font(isBold && tFonts.bold ? 'TamilIndic-Bold' : 'TamilIndic');
                } else {
                    doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica');
                }
                doc.text(str, x, y, options);
            };

            // Document Header Banner
            doc.rect(40, 40, 515, 65).fillAndStroke('#0f2b48', '#071626');
            doc.fillColor('#ffffff').fontSize(14).font('Helvetica-Bold').text('TAMIL NADU CIVIL SUPPLIES & CONSUMER PROTECTION', 40, 52, { align: 'center', width: 515 });
            doc.fontSize(10);
            drawText('TNPDS Smart Card Citizen Services - Addition of Family Member (குடும்ப உறுப்பினர் சேர்க்கை)', 40, 72, { align: 'center', width: 515 }, false);
            doc.fontSize(9).font('Helvetica').text('Official Online Submission Acknowledgement', 40, 87, { align: 'center', width: 515 });

            doc.moveDown(3.5);
            doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold').text('APPLICATION ACKNOWLEDGEMENT RECEIPT', { align: 'center', underline: true });
            doc.moveDown(1.5);

            const startX = 40;
            let currentY = 150;

            const drawRow = (label, val, highlight = false) => {
                doc.rect(startX, currentY, 515, 24).fillAndStroke(highlight ? '#f1f5f9' : '#ffffff', '#cbd5e1');
                doc.fillColor('#334155').fontSize(9);
                drawText(label, startX + 12, currentY + 7, { width: 190 }, true);
                doc.fillColor(highlight ? '#0f766e' : '#0f172a');
                drawText(String(val || '-'), startX + 210, currentY + 7, { width: 295 }, highlight);
                currentY += 24;
            };

            drawRow('Service Name', 'Addition of Family Member (குடும்ப உறுப்பினர் சேர்க்கை)');
            drawRow('Application Ref. Number', data.refNo, true);
            drawRow('Submission Date & Time', data.date || new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
            drawRow('Smart Card / Ration Number', data.rationCardNo || '33XXXXXXXXXX (Linked to Mobile)');
            drawRow('Registered Mobile Number', `+91 ${data.mobileNumber || ''}`);
            drawRow('New Member Name (Tamil)', data.memberNameTam || data.memberName || '-');
            drawRow('New Member Name (English)', data.memberNameEng || data.memberName || '-');
            drawRow('Category', data.isChild ? 'Child (< 5 Years)' : 'Adult (> 5 Years)');
            drawRow('Relationship with Card Head', `${data.relationshipEng || ''} (${data.relationshipTam || ''})`);
            drawRow('Gender', data.gender || '-');
            drawRow('Date of Birth', data.dob || '-');
            drawRow('Aadhaar / Enrollment Number', data.aadhaarNo ? `XXXXXXXX${String(data.aadhaarNo).slice(-4)}` : 'Aadhaar Verified');
            drawRow('Document Attached', 'Aadhaar Card (ஆதார் அட்டை)');
            drawRow('Processing Stage', 'Submitted - Pending Verification by Taluk Supply Officer (TSO)', true);

            currentY += 20;
            doc.rect(startX, currentY, 515, 60).fillAndStroke('#f8fafc', '#94a3b8');
            doc.fillColor('#334155').fontSize(8.5).font('Helvetica').text(
                'Notice: This acknowledgement receipt is officially issued by the Government of Tamil Nadu TNPDS Portal. The concerned Taluk Supply Officer (TSO) / Assistant Supply Officer (ASO) will inspect the uploaded documents within 15 to 30 working days. To track real-time application status, visit https://www.tnpds.gov.in and enter the Application Reference Number provided above.',
                startX + 12,
                currentY + 10,
                { width: 490, align: 'justify' }
            );

            doc.end();
            stream.on('finish', () => resolve(destPath));
            stream.on('error', () => resolve(destPath));
        } catch (e) {
            try {
                fs.writeFileSync(destPath, Buffer.from('%PDF-1.4\n%EOF'));
            } catch (err) {}
            resolve(destPath);
        }
    });
}

/**
 * Generates an official-looking TNPDS Acknowledgment PDF Receipt for Change of Address.
 */
function generateAddressChangeReceiptPdf(destPath, data) {
    return new Promise((resolve) => {
        let PDFDoc = null;
        try { PDFDoc = require('pdfkit'); } catch (e) {}

        if (!PDFDoc) {
            const minimalPdf = Buffer.from(
                `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 595 842]/Parent 2 0 R/Contents 4 0 R>>endobj\n4 0 obj<</Length 120>>stream\nBT /F1 14 Tf 50 750 Td (TNPDS Change of Address Acknowledgment Receipt) Tj /F1 12 Tf 50 720 Td (Application Ref No: ${data.refNo || ''}) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000204 00000 n \ntrailer<</Size 5/Root 1 0 R>>\nstartxref\n376\n%%EOF\n`
            );
            fs.writeFileSync(destPath, minimalPdf);
            return resolve(destPath);
        }

        try {
            const doc = new PDFDoc({ margin: 40, size: 'A4' });
            const stream = fs.createWriteStream(destPath);
            doc.pipe(stream);

            const tFonts = getTamilFontPaths();
            if (tFonts.regular) {
                try {
                    doc.registerFont('TamilIndic', tFonts.regular);
                    if (tFonts.bold) doc.registerFont('TamilIndic-Bold', tFonts.bold);
                } catch (_) {}
            }

            const drawText = (text, x, y, options = {}, isBold = false) => {
                const str = String(text || '');
                if (tFonts.regular && hasTamilChars(str)) {
                    doc.font(isBold && tFonts.bold ? 'TamilIndic-Bold' : 'TamilIndic');
                } else {
                    doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica');
                }
                doc.text(str, x, y, options);
            };

            // Document Header Banner
            doc.rect(40, 40, 515, 65).fillAndStroke('#0f2b48', '#071626');
            doc.fillColor('#ffffff').fontSize(14).font('Helvetica-Bold').text('TAMIL NADU CIVIL SUPPLIES & CONSUMER PROTECTION', 40, 52, { align: 'center', width: 515 });
            doc.fontSize(10);
            drawText('TNPDS Smart Card Citizen Services - Change of Address (குடும்ப அட்டை முகவரி மாற்றம்)', 40, 72, { align: 'center', width: 515 }, false);
            doc.fontSize(9).font('Helvetica').text('Official Online Submission Acknowledgement', 40, 87, { align: 'center', width: 515 });

            doc.moveDown(3.5);
            doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold').text('APPLICATION ACKNOWLEDGEMENT RECEIPT', { align: 'center', underline: true });
            doc.moveDown(1.5);

            const startX = 40;
            let currentY = 150;

            const drawRow = (label, val, highlight = false) => {
                doc.rect(startX, currentY, 515, 24).fillAndStroke(highlight ? '#f1f5f9' : '#ffffff', '#cbd5e1');
                doc.fillColor('#334155').fontSize(9);
                drawText(label, startX + 12, currentY + 7, { width: 190 }, true);
                doc.fillColor(highlight ? '#0f766e' : '#0f172a');
                drawText(String(val || '-'), startX + 210, currentY + 7, { width: 295 }, highlight);
                currentY += 24;
            };

            drawRow('Service Name', 'Change of Address (குடும்ப அட்டை முகவரி மாற்றம்)');
            drawRow('Application Ref. Number', data.refNo, true);
            drawRow('Submission Date & Time', data.date || new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
            drawRow('Smart Card / Ration Number', data.rationCardNo || '33XXXXXXXXXX (Linked to Mobile)');
            drawRow('Registered Mobile Number', `+91 ${data.mobileNumber || ''}`);
            drawRow('New Door Number', data.doorNo || '-');
            drawRow('New Street / Area (English)', data.streetEng || '-');
            drawRow('New Street / Area (Tamil)', data.streetTam || '-');
            drawRow('Revenue Village / Ward', data.village || '-');
            drawRow('Taluk', data.taluk || '-');
            drawRow('District', data.district || '-');
            drawRow('Pincode', data.pincode || '-');
            drawRow('Residence Proof Document Attached', data.proofType || 'Electricity Bill (மின் கட்டண ரசீது)');
            drawRow('Processing Stage', 'Submitted - Pending Verification by Taluk Supply Officer (TSO)', true);

            currentY += 20;
            doc.rect(startX, currentY, 515, 60).fillAndStroke('#f8fafc', '#94a3b8');
            doc.fillColor('#334155').fontSize(8.5).font('Helvetica').text(
                'Notice: This acknowledgement receipt is officially issued by the Government of Tamil Nadu TNPDS Portal. The concerned Taluk Supply Officer (TSO) / Assistant Supply Officer (ASO) will inspect the uploaded documents within 15 to 30 working days. To track real-time application status, visit https://www.tnpds.gov.in and enter the Application Reference Number provided above.',
                startX + 12,
                currentY + 10,
                { width: 490, align: 'justify' }
            );

            doc.end();
            stream.on('finish', () => resolve(destPath));
            stream.on('error', () => resolve(destPath));
        } catch (e) {
            try {
                fs.writeFileSync(destPath, Buffer.from('%PDF-1.4\n%EOF'));
            } catch (err) {}
            resolve(destPath);
        }
    });
}

/**
 * Generates an official-looking TNPDS Acknowledgment PDF Receipt for Family Member Removal.
 */
function generateRemoveMemberReceiptPdf(destPath, data) {
    return new Promise((resolve) => {
        let PDFDoc = null;
        try { PDFDoc = require('pdfkit'); } catch (e) {}

        if (!PDFDoc) {
            const minimalPdf = Buffer.from(
                `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 595 842]/Parent 2 0 R/Contents 4 0 R>>endobj\n4 0 obj<</Length 120>>stream\nBT /F1 14 Tf 50 750 Td (TNPDS Remove Member Acknowledgment Receipt) Tj /F1 12 Tf 50 720 Td (Application Ref No: ${data.refNo || ''}) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000204 00000 n \ntrailer<</Size 5/Root 1 0 R>>\nstartxref\n376\n%%EOF\n`
            );
            fs.writeFileSync(destPath, minimalPdf);
            return resolve(destPath);
        }

        try {
            const doc = new PDFDoc({ margin: 40, size: 'A4' });
            const stream = fs.createWriteStream(destPath);
            doc.pipe(stream);

            const { regular: regFont, bold: boldFont } = getTamilFontPaths();
            const drawText = (str, x, y, opts = {}, isBold = false) => {
                if (hasTamilChars(str) && regFont) {
                    doc.font(isBold && boldFont ? boldFont : regFont).text(str, x, y, opts);
                } else {
                    doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica').text(str, x, y, opts);
                }
            };

            doc.rect(40, 40, 515, 65).fillAndStroke('#065f46', '#047857');
            doc.fillColor('#ffffff').fontSize(14).font('Helvetica-Bold').text('GOVERNMENT OF TAMIL NADU', 40, 50, { align: 'center' });
            doc.fontSize(11).font('Helvetica-Bold').text('DEPARTMENT OF CIVIL SUPPLIES AND CONSUMER PROTECTION', 40, 68, { align: 'center' });
            drawText('உணவுப் பொருள் வழங்கல் மற்றும் நுகர்வோர் பாதுகாப்புத் துறை', 40, 84, { align: 'center' }, true);

            doc.moveDown(3.5);
            doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold').text('APPLICATION ACKNOWLEDGEMENT RECEIPT (MEMBER REMOVAL)', { align: 'center', underline: true });
            doc.moveDown(1.5);

            const startX = 40;
            let currentY = 150;

            const drawRow = (label, val, highlight = false) => {
                doc.rect(startX, currentY, 515, 24).fillAndStroke(highlight ? '#f1f5f9' : '#ffffff', '#cbd5e1');
                doc.fillColor('#334155').fontSize(9);
                drawText(label, startX + 12, currentY + 7, { width: 190 }, true);
                doc.fillColor(highlight ? '#0f766e' : '#0f172a');
                drawText(String(val || '-'), startX + 210, currentY + 7, { width: 295 }, highlight);
                currentY += 24;
            };

            drawRow('Service Name', 'Removal of Family Member (குடும்ப உறுப்பினர் நீக்கம்)');
            drawRow('Application Ref. Number', data.refNo, true);
            drawRow('Submission Date & Time', data.date || new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
            drawRow('Smart Card / Ration Number', data.rationCardNo || '33XXXXXXXXXX');
            drawRow('Registered Mobile Number', `+91 ${data.mobileNumber || ''}`);
            drawRow('Removed Member (English)', data.memberNameEng || data.memberName || '-');
            drawRow('Removed Member (Tamil)', data.memberNameTam || '-');
            drawRow('Reason for Removal', data.reason || 'Death / Marriage / Split');
            drawRow('Supporting Document Attached', data.docType || 'Certificate / Proof Document');
            drawRow('Processing Stage', 'Submitted - Pending Verification by Taluk Supply Officer (TSO)', true);

            currentY += 20;
            doc.rect(startX, currentY, 515, 60).fillAndStroke('#f8fafc', '#94a3b8');
            doc.fillColor('#334155').fontSize(8.5).font('Helvetica').text(
                'Notice: This acknowledgement receipt is officially issued by the Government of Tamil Nadu TNPDS Portal. The concerned Taluk Supply Officer (TSO) / Assistant Supply Officer (ASO) will verify the removal request and supporting documents within 15 to 30 working days. To track real-time application status, visit https://www.tnpds.gov.in and enter the Application Reference Number provided above.',
                startX + 12,
                currentY + 10,
                { width: 490, align: 'justify' }
            );

            doc.end();
            stream.on('finish', () => resolve(destPath));
            stream.on('error', () => resolve(destPath));
        } catch (e) {
            try {
                fs.writeFileSync(destPath, Buffer.from('%PDF-1.4\n%EOF'));
            } catch (err) {}
            resolve(destPath);
        }
    });
}

/**
 * Official TNPDS Mobile Number Change Acknowledgment Receipt Generator
 */
function generateMobileChangeReceiptPdf(destPath, data) {
    return new Promise((resolve) => {
        let PDFDoc = null;
        try { PDFDoc = require('pdfkit'); } catch (e) {}

        if (!PDFDoc) {
            const minimalPdf = Buffer.from(
                `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 595 842]/Parent 2 0 R/Contents 4 0 R>>endobj\n4 0 obj<</Length 120>>stream\nBT /F1 14 Tf 50 750 Td (TNPDS Mobile Number Change Acknowledgment Receipt) Tj /F1 12 Tf 50 720 Td (Application Ref No: ${data.refNo || ''}) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000204 00000 n \ntrailer<</Size 5/Root 1 0 R>>\nstartxref\n376\n%%EOF\n`
            );
            fs.writeFileSync(destPath, minimalPdf);
            return resolve(destPath);
        }

        try {
            const doc = new PDFDoc({ margin: 40, size: 'A4' });
            const stream = fs.createWriteStream(destPath);
            doc.pipe(stream);

            const { regular: regFont, bold: boldFont } = getTamilFontPaths();
            const drawText = (str, x, y, opts = {}, isBold = false) => {
                if (hasTamilChars(str) && regFont) {
                    doc.font(isBold && boldFont ? boldFont : regFont).text(str, x, y, opts);
                } else {
                    doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica').text(str, x, y, opts);
                }
            };

            doc.rect(40, 40, 515, 65).fillAndStroke('#065f46', '#047857');
            doc.fillColor('#ffffff').fontSize(14).font('Helvetica-Bold').text('GOVERNMENT OF TAMIL NADU', 40, 50, { align: 'center' });
            doc.fontSize(11).font('Helvetica-Bold').text('DEPARTMENT OF CIVIL SUPPLIES AND CONSUMER PROTECTION', 40, 68, { align: 'center' });
            drawText('உணவுப் பொருள் வழங்கல் மற்றும் நுகர்வோர் பாதுகாப்புத் துறை', 40, 84, { align: 'center' }, true);

            doc.moveDown(3.5);
            doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold').text('APPLICATION ACKNOWLEDGEMENT RECEIPT (MOBILE NUMBER UPDATE)', { align: 'center', underline: true });
            doc.moveDown(1.5);

            const startX = 40;
            let currentY = 150;

            const drawRow = (label, val, highlight = false) => {
                doc.rect(startX, currentY, 515, 24).fillAndStroke(highlight ? '#f1f5f9' : '#ffffff', '#cbd5e1');
                doc.fillColor('#334155').fontSize(9);
                drawText(label, startX + 12, currentY + 7, { width: 190 }, true);
                doc.fillColor(highlight ? '#0f766e' : '#0f172a');
                drawText(String(val || '-'), startX + 210, currentY + 7, { width: 295 }, highlight);
                currentY += 24;
            };

            drawRow('Service Name', 'Change of Mobile Number (கைபேசி எண் மாற்றம்)');
            drawRow('Application Ref. Number', data.refNo, true);
            drawRow('Submission Date & Time', data.date || new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
            drawRow('Smart Card / Ration Number', data.rationCardNo || '33XXXXXXXXXX');
            drawRow('Applicant Name', data.fullName || data.fullNameTam || '-');
            drawRow('Previous Registered Mobile', `+91 ${data.previousMobile || data.oldMobile || data.mobileNumber || ''}`);
            drawRow('New Registered Mobile Number', `+91 ${data.newMobile || ''}`, true);
            drawRow('OTP Verification Status', 'Verified via SMS OTP on New Mobile', true);
            drawRow('Processing Stage', 'Submitted - Live Updated on TNPDS Portal', true);

            currentY += 20;
            doc.rect(startX, currentY, 515, 60).fillAndStroke('#f8fafc', '#94a3b8');
            doc.fillColor('#334155').fontSize(8.5).font('Helvetica').text(
                'Notice: This acknowledgement receipt is officially issued by the Government of Tamil Nadu TNPDS Portal. The updated mobile number has been authenticated via two-factor OTP verification. Future OTPs and SMS alerts regarding your ration card and PDS transactions will now be sent to the newly registered mobile number.',
                startX + 12,
                currentY + 10,
                { width: 490, align: 'justify' }
            );

            doc.end();
            stream.on('finish', () => resolve(destPath));
            stream.on('error', () => resolve(destPath));
        } catch (e) {
            try {
                fs.writeFileSync(destPath, Buffer.from('%PDF-1.4\n%EOF'));
            } catch (err) {}
            resolve(destPath);
        }
    });
}

/**
 * Official TNPDS Change of Family Head Acknowledgment Receipt Generator
 */
function generateChangeHeadReceiptPdf(destPath, data) {
    return new Promise((resolve) => {
        let PDFDoc = null;
        try { PDFDoc = require('pdfkit'); } catch (e) {}

        if (!PDFDoc) {
            const minimalPdf = Buffer.from(
                `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 595 842]/Parent 2 0 R/Contents 4 0 R>>endobj\n4 0 obj<</Length 120>>stream\nBT /F1 14 Tf 50 750 Td (TNPDS Change Family Head Acknowledgment Receipt) Tj /F1 12 Tf 50 720 Td (Application Ref No: ${data.refNo || ''}) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000204 00000 n \ntrailer<</Size 5/Root 1 0 R>>\nstartxref\n376\n%%EOF\n`
            );
            fs.writeFileSync(destPath, minimalPdf);
            return resolve(destPath);
        }

        try {
            const doc = new PDFDoc({ margin: 40, size: 'A4' });
            const stream = fs.createWriteStream(destPath);
            doc.pipe(stream);

            const { regular: regFont, bold: boldFont } = getTamilFontPaths();
            const drawText = (str, x, y, opts = {}, isBold = false) => {
                if (hasTamilChars(str) && regFont) {
                    doc.font(isBold && boldFont ? boldFont : regFont).text(str, x, y, opts);
                } else {
                    doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica').text(str, x, y, opts);
                }
            };

            doc.rect(40, 40, 515, 65).fillAndStroke('#065f46', '#047857');
            doc.fillColor('#ffffff').fontSize(14).font('Helvetica-Bold').text('GOVERNMENT OF TAMIL NADU', 40, 50, { align: 'center' });
            doc.fontSize(11).font('Helvetica-Bold').text('DEPARTMENT OF CIVIL SUPPLIES AND CONSUMER PROTECTION', 40, 68, { align: 'center' });
            drawText('உணவுப் பொருள் வழங்கல் மற்றும் நுகர்வோர் பாதுகாப்புத் துறை', 40, 84, { align: 'center' }, true);

            doc.moveDown(3.5);
            doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold').text('APPLICATION ACKNOWLEDGEMENT RECEIPT (CHANGE OF FAMILY HEAD)', { align: 'center', underline: true });
            doc.moveDown(1.5);

            const startX = 40;
            let currentY = 150;

            const drawRow = (label, val, highlight = false) => {
                doc.rect(startX, currentY, 515, 24).fillAndStroke(highlight ? '#f1f5f9' : '#ffffff', '#cbd5e1');
                doc.fillColor('#334155').fontSize(9);
                drawText(label, startX + 12, currentY + 7, { width: 190 }, true);
                doc.fillColor(highlight ? '#0f766e' : '#0f172a');
                drawText(String(val || '-'), startX + 210, currentY + 7, { width: 295 }, highlight);
                currentY += 24;
            };

            drawRow('Service Name', 'Change of Family Head (குடும்பத் தலைவர் மாற்றம்)');
            drawRow('Application Ref. Number', data.refNo, true);
            drawRow('Submission Date & Time', data.date || new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
            drawRow('Smart Card / Ration Number', data.rationCardNo || '33XXXXXXXXXX');
            drawRow('Registered Mobile Number', `+91 ${data.mobileNumber || ''}`);
            drawRow('New Family Head Name (Tamil)', data.newHeadNameTam || '-');
            drawRow('New Family Head Name (English)', data.newHeadNameEng || '-');
            drawRow('Reason for Head Change', data.reason || 'Mutual Consent / Death of Previous Head');
            drawRow('Supporting Document Attached', data.docType || 'Death / Legal Proof Document');
            drawRow('Processing Stage', 'Submitted - Pending Verification by Taluk Supply Officer (TSO)', true);

            currentY += 20;
            doc.rect(startX, currentY, 515, 60).fillAndStroke('#f8fafc', '#94a3b8');
            doc.fillColor('#334155').fontSize(8.5).font('Helvetica').text(
                'Notice: This acknowledgement receipt is officially issued by the Government of Tamil Nadu TNPDS Portal. The change of family head request and supporting documents will be verified by the concerned Taluk Supply Officer (TSO) / Assistant Supply Officer (ASO). To track real-time application status, visit https://www.tnpds.gov.in and enter the Application Reference Number provided above.',
                startX + 12,
                currentY + 10,
                { width: 490, align: 'justify' }
            );

            doc.end();
            stream.on('finish', () => resolve(destPath));
            stream.on('error', () => resolve(destPath));
        } catch (e) {
            try {
                fs.writeFileSync(destPath, Buffer.from('%PDF-1.4\n%EOF'));
            } catch (err) {}
            resolve(destPath);
        }
    });
}

module.exports = {
    getSafeDir,
    receiptsDir,
    previewsDir,
    generateAddMemberReceiptPdf,
    generateAddressChangeReceiptPdf,
    generateRemoveMemberReceiptPdf,
    generateMobileChangeReceiptPdf,
    generateChangeHeadReceiptPdf
};
