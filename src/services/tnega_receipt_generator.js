const fs = require('fs');
const path = require('path');

function hasTamilChars(str) {
    if (!str || typeof str !== 'string') return false;
    return /[\u0B80-\u0BFF]/.test(str);
}

function getTamilFontPaths() {
    const fontDir = path.join(__dirname, '..', '..', 'public', 'vendor', 'fonts');
    const regFont = path.join(fontDir, 'NotoSansTamil-Regular.ttf');
    const boldFont = path.join(fontDir, 'NotoSansTamil-Bold.ttf');
    return {
        regular: fs.existsSync(regFont) ? regFont : null,
        bold: fs.existsSync(boldFont) ? boldFont : null
    };
}

function generateCanReceiptPdf(destPath, data = {}) {
    return new Promise((resolve) => {
        let PDFDoc = null;
        try { PDFDoc = require('pdfkit'); } catch (e) {}

        const canNo = data.canNumber || '1330109988771';
        const citizenName = data.fullNameTam ? `${data.fullNameTam} (${data.fullNameEng || ''})` : (data.fullNameEng || 'விண்ணப்பதாரர்');
        const fatherName = data.fatherNameTam ? `${data.fatherNameTam} (${data.fatherNameEng || ''})` : (data.fatherNameEng || '—');
        const mobile = data.mobile || data.mobileNumber || '—';
        const aadhaar = (data.aadhaar || data.headAadhaar || '').replace(/\D/g, '');
        const maskedAadhaar = aadhaar ? `XXXX-XXXX-${aadhaar.slice(-4)}` : '—';
        const address = data.address || `${data.doorNo || ''} ${data.streetTam || data.streetEng || ''}, ${data.village || ''}, ${data.taluk || ''}, ${data.district || ''} - ${data.pincode || ''}`.trim();
        const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        if (!PDFDoc) {
            const minimalPdf = Buffer.from(
                `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 595 842]/Parent 2 0 R/Contents 4 0 R>>endobj\n4 0 obj<</Length 150>>stream\nBT /F1 14 Tf 50 750 Td (TNeGA CAN Registration Acknowledgment Receipt) Tj /F1 12 Tf 50 720 Td (CAN Number: ${canNo}) Tj /F1 10 Tf 50 690 Td (Name: ${data.fullNameEng || 'Applicant'} | Mobile: ${mobile}) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000204 00000 n \ntrailer<</Size 5/Root 1 0 R>>\nstartxref\n410\n%%EOF\n`
            );
            fs.writeFileSync(destPath, minimalPdf);
            return resolve(destPath);
        }

        try {
            const doc = new PDFDoc({ margin: 40, size: 'A4' });
            const dir = path.dirname(destPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
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

            // Header Banner
            doc.rect(40, 40, 515, 70).fillAndStroke('#1e3a8a', '#172554');
            doc.fillColor('#ffffff').fontSize(13).font('Helvetica-Bold').text('GOVERNMENT OF TAMIL NADU', 40, 48, { align: 'center' });
            doc.fontSize(10).font('Helvetica-Bold').text('TAMIL NADU e-GOVERNANCE AGENCY (TNeGA)', 40, 64, { align: 'center' });
            drawText('தமிழ்நாடு மின்னாளுமை முகமை (இ-சேவை)', 40, 78, { align: 'center' }, true);
            drawText('குடிமக்கள் அணுகல் எண் (CAN) பதிவு ஒப்புதல் ரசீது', 40, 93, { align: 'center' }, true);

            doc.moveDown(3);
            doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold').text('CITIZEN ACCESS NUMBER (CAN) ACKNOWLEDGEMENT RECEIPT', 40, 125, { align: 'center', underline: true });

            // Highlighted CAN Number Box
            doc.rect(40, 145, 515, 36).fillAndStroke('#eff6ff', '#3b82f6');
            doc.fillColor('#1e40af').fontSize(11).font('Helvetica-Bold').text('13-DIGIT CAN NUMBER / குடிமக்கள் அணுகல் எண்:', 50, 152);
            doc.fillColor('#b91c1c').fontSize(16).font('Helvetica-Bold').text(canNo, 360, 150);

            let currentY = 190;
            const startX = 40;
            const drawRow = (label, val, highlight = false) => {
                doc.rect(startX, currentY, 515, 24).fillAndStroke(highlight ? '#f8fafc' : '#ffffff', '#cbd5e1');
                doc.fillColor('#334155').fontSize(9);
                drawText(label, startX + 10, currentY + 6, {}, true);
                doc.fillColor('#0f172a');
                drawText(val || '—', startX + 220, currentY + 6);
                currentY += 24;
            };

            drawRow('Citizen Full Name / விண்ணப்பதாரர் பெயர்', citizenName, true);
            drawRow('Father / Husband Name / தந்தை அல்லது கணவர்', fatherName);
            drawRow('Mobile Number / பதிவு செய்த கைபேசி எண்', '+91 ' + mobile, true);
            drawRow('Aadhaar Number / ஆதார் எண்', maskedAadhaar);
            drawRow('Gender / பாலினம்', data.genderTam || data.gender || 'ஆண்', true);
            drawRow('Date of Birth / பிறந்த தேதி', data.dob || data.headDob || '—');
            drawRow('District & Taluk / மாவட்டம் மற்றும் வட்டம்', `${data.district || '—'} / ${data.taluk || '—'}`, true);
            drawRow('Revenue Village / வருவாய் கிராமம்', data.village || '—');
            drawRow('Door No & Street / கதவு எண், தெரு முகவரி', `${data.doorNo ? data.doorNo + ', ' : ''}${data.streetTam || data.streetEng || '—'}`, true);
            drawRow('Pincode / அஞ்சல் குறியீட்டு எண்', data.pincode || '—');
            drawRow('Registration Date & Time / பதிவு தேதி', `${dateStr} ${timeStr}`, true);
            drawRow('Issuing Authority / வழங்கிய முகமை', 'TNeGA Revenue Services e-Portal');

            currentY += 15;
            doc.rect(40, currentY, 515, 45).fillAndStroke('#f0fdf4', '#86efac');
            doc.fillColor('#166534').fontSize(8.5);
            drawText('முக்கிய குறிப்பு: இந்த 13-இலக்க CAN எண் தமிழ்நாடு அரசின் அனைத்து வருவாய்த் துறை சான்றிதழ்களுக்கும் (வருமானம், இருப்பிடம், சாதிச் சான்றிதழ் உள்ளிட்ட REV சேவைகள்) கட்டாயமானது. இதனைப் பாதுகாப்பாக வைத்துக்கொள்ளவும்.', 50, currentY + 8, { width: 495 }, true);

            currentY += 60;
            doc.fillColor('#64748b').fontSize(8).font('Helvetica-Oblique').text('This is a system generated acknowledgement receipt issued by eSevaDraft via TNeGA Integration. No physical signature required.', 40, currentY, { align: 'center' });

            doc.end();
            stream.on('finish', () => resolve(destPath));
            stream.on('error', () => resolve(destPath));
        } catch (e) {
            resolve(destPath);
        }
    });
}

module.exports = {
    generateCanReceiptPdf
};
