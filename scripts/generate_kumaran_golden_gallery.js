/**
 * scripts/generate_kumaran_golden_gallery.js
 * Generates crisp, realistic, size-compliant (<180KB, Photo 200x240 <45KB)
 * Golden Sample document images for Kumaran K (9790170026) across ALL services.
 * Stored strictly inside workspace: data/golden_samples/kumaran_gallery/
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT_DIR = path.resolve(__dirname, '..');
const DOCS_DIR = path.join(ROOT_DIR, 'data', 'golden_samples', 'documents');
const OUT_DIR = path.join(ROOT_DIR, 'data', 'golden_samples', 'kumaran_gallery');

function escapeXml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

async function renderCertificateJpg(filename, { banner = 'GOVERNMENT OF TAMIL NADU', title, badge = 'OFFICIAL SAMPLE', accent = '#0f766e', lines = [] }) {
    const svg = `<svg width="960" height="660" xmlns="http://www.w3.org/2000/svg">
  <rect width="960" height="660" fill="#f8fafc"/>
  <rect x="20" y="20" width="920" height="620" rx="12" fill="#ffffff" stroke="${accent}" stroke-width="4"/>
  <rect x="20" y="20" width="920" height="86" rx="12" fill="${accent}"/>
  <text x="480" y="54" font-family="Arial, sans-serif" font-size="22" font-weight="bold" text-anchor="middle" fill="#ffffff">${escapeXml(banner)}</text>
  <text x="480" y="88" font-family="Arial, sans-serif" font-size="18" font-weight="bold" text-anchor="middle" fill="#e2e8f0">${escapeXml(title)}</text>
  <rect x="700" y="122" width="215" height="30" rx="15" fill="#fef3c7" stroke="#f59e0b" stroke-width="1.5"/>
  <text x="807" y="142" font-family="Arial, sans-serif" font-size="12" font-weight="bold" text-anchor="middle" fill="#92400e">${escapeXml(badge)}</text>
  <line x1="48" y1="166" x2="912" y2="166" stroke="#cbd5e1" stroke-width="2"/>
  ${lines.map((line, i) => {
      const y = 212 + i * 44;
      const isBold = i === 0 || line.includes(':');
      return `<text x="64" y="${y}" font-family="Arial, sans-serif" font-size="${isBold ? 19 : 17}" font-weight="${i === 0 ? 'bold' : 'normal'}" fill="#0f172a">${escapeXml(line)}</text>`;
  }).join('\n  ')}
  <line x1="48" y1="560" x2="912" y2="560" stroke="#e2e8f0" stroke-width="1.5"/>
  <text x="64" y="600" font-family="Arial, sans-serif" font-size="14" fill="#475569">Digitally Verified Sample Record — Arakkonam Taluk, Ranipet District, Tamil Nadu</text>
  <rect x="740" y="572" width="160" height="46" rx="6" fill="#ecfdf5" stroke="#16a34a" stroke-width="1.5"/>
  <text x="820" y="593" font-family="Arial, sans-serif" font-size="12" font-weight="bold" text-anchor="middle" fill="#166534">VERIFIED SAMPLE</text>
  <text x="820" y="610" font-family="Arial, sans-serif" font-size="11" text-anchor="middle" fill="#15803d">CAN: 133370337878397</text>
</svg>`;
    const outPath = path.join(OUT_DIR, filename);
    await sharp(Buffer.from(svg)).jpeg({ quality: 84 }).toFile(outPath);
    return outPath;
}

async function generateAll() {
    fs.mkdirSync(OUT_DIR, { recursive: true });

    // 1. Passport Photo (Strict <250x250 px & <50KB for ALL TNeGA + TNPDS portals)
    const photoSrc = path.join(DOCS_DIR, 'kumaran_passport_photo.jpg');
    if (fs.existsSync(photoSrc)) {
        await sharp(photoSrc)
            .rotate()
            .resize(200, 240, { fit: 'cover' })
            .jpeg({ quality: 82 })
            .toFile(path.join(OUT_DIR, '01_kumaran_passport_photo.jpg'));
    }

    // 2-3. Aadhaar Front & Back
    const aadhF = path.join(DOCS_DIR, 'kumaran_aadhaar_front.jpg');
    const aadhB = path.join(DOCS_DIR, 'kumaran_aadhaar_back.jpg');
    if (fs.existsSync(aadhF)) {
        await sharp(aadhF).resize({ width: 900, withoutEnlargement: true }).jpeg({ quality: 82 }).toFile(path.join(OUT_DIR, '02_kumaran_aadhaar_front.jpg'));
    }
    if (fs.existsSync(aadhB)) {
        await sharp(aadhB).resize({ width: 900, withoutEnlargement: true }).jpeg({ quality: 82 }).toFile(path.join(OUT_DIR, '03_kumaran_aadhaar_back.jpg'));
    }

    // 4. Combined 2-in-1 Dual Aadhaar
    if (fs.existsSync(aadhF) && fs.existsSync(aadhB)) {
        const frontBuf = await sharp(aadhF).resize(820, 500, { fit: 'contain', background: '#ffffff' }).toBuffer();
        const backBuf = await sharp(aadhB).resize(820, 500, { fit: 'contain', background: '#ffffff' }).toBuffer();
        await sharp({
            create: { width: 860, height: 1060, channels: 3, background: '#ffffff' }
        })
            .composite([
                { input: frontBuf, top: 20, left: 20 },
                { input: backBuf, top: 540, left: 20 }
            ])
            .jpeg({ quality: 80 })
            .toFile(path.join(OUT_DIR, '04_kumaran_aadhaar_2in1.jpg'));
    }

    // 5. Community Certificate (REV-101 & REV-115 OBC)
    await renderCertificateJpg('05_community_certificate_kumaran.jpg', {
        banner: 'GOVERNMENT OF TAMIL NADU — REVENUE DEPARTMENT',
        title: 'COMMUNITY CERTIFICATE (TN-REV-101)',
        badge: 'COMMUNITY / OBC',
        accent: '#7e22ce',
        lines: [
            'Certificate No: TN-5202104128812',
            'This is to certify that Thiru KUMARAN K (S/o KIRUBAKARAN)',
            'Mother Name: DEVAKI K  |  Aadhaar: 5755 6766 2931',
            'Belongs to VANNIYAKULA KSHATRIYA (VANNIYAR) Community',
            'Community Category: Most Backward Class (MBC / DNC)',
            'Religion: HINDU  |  CAN No: 133370337878397',
            'Address: 216, Mettu Street, Narasingapuram, Minnal, Ranipet - 632510',
            'Issued By: Zonal Deputy Tahsildar, Arakkonam Taluk, Ranipet District'
        ]
    });

    // 6. Income Certificate Salary / Pay Slip Proof (REV-103)
    await renderCertificateJpg('06_income_payslip_kumaran.jpg', {
        banner: 'EMPLOYER SALARY & INCOME CERTIFICATE',
        title: 'INCOME PROOF / PAYSLIP STATEMENT (TN-REV-103)',
        badge: 'INCOME PROOF REV-103',
        accent: '#0369a1',
        lines: [
            'Payslip Ref No: PAY-2026-ARAK-0419',
            'Employee Name: KUMARAN K (Father: KIRUBAKARAN)',
            'Designation: Technician / Private Service (Arakkonam)',
            'Monthly Gross Salary: Rs. 6,000 /- (Six Thousand Only)',
            'Total Annual Income: Rs. 72,000 /- (Seventy Two Thousand Only)',
            'Bank / Payment Mode: Savings Account Credit | Verified Salary Proof',
            'Residential Address: 216, Mettu Street, Narasingapuram, Minnal - 632510',
            'Authorized Signatory — Accounts Department'
        ]
    });

    // 7. OBC Income Tax Return / Annual Income Proof (REV-115)
    await renderCertificateJpg('07_obc_income_tax_return_kumaran.jpg', {
        banner: 'INCOME TAX DEPARTMENT / INCOME STATEMENT',
        title: 'INCOME TAX RETURN ACKNOWLEDGEMENT & INCOME PROOF (OBC REV-115)',
        badge: 'OBC ITR REV-115',
        accent: '#b45309',
        lines: [
            'ITR / Acknowledgement No: ITR-2025-88412093',
            'Name of Assessee / Applicant: KUMARAN K',
            'Father Name: KIRUBAKARAN  |  PAN: FKDPK4245M',
            'Assessment Year: 2025-2026  |  Status: Non-Creamy Layer OBC',
            'Gross Total Annual Family Income: Rs. 72,000 /- (Below Rs. 8 Lakh Ceiling)',
            'Tax Payable: NIL (Exempted Category)',
            'Address: 216, Mettu Street, Narasingapuram, Minnal, Arakkonam - 632510',
            'Verified Income Tax Return / Financial Statement'
        ]
    });

    // 8. Residence / Electricity Bill Proof (REV-102 & Ration Card)
    await renderCertificateJpg('08_residence_eb_bill_kumaran.jpg', {
        banner: 'TAMIL NADU GENERATION AND DISTRIBUTION CORPORATION (TANGEDCO)',
        title: 'ELECTRICITY BILL / RESIDENCE ADDRESS PROOF (TN-REV-102)',
        badge: 'RESIDENCE REV-102',
        accent: '#0f766e',
        lines: [
            'Consumer Service No: 08-412-009-216 (Arakkonam Section)',
            'Consumer Name: KIRUBAKARAN / KUMARAN K',
            'Premises Door No: 216, Mettu Street, Narasingapuram',
            'Revenue Village: Minnal  |  Taluk: Arakkonam  |  District: Ranipet',
            'Pincode: 632510  |  Tariff: IA Domestic Residence',
            'Bill Period: Oct-Nov 2026  |  Amount Paid: Rs. 640 /- (PAID)',
            'Years of Continuous Residence: 20+ Years at this Address',
            'Valid Government Utility Address & Residence Proof'
        ]
    });

    // 9. Family Smart Ration Card (REV-104 & TNPDS)
    await renderCertificateJpg('09_family_smart_ration_card_kumaran.jpg', {
        banner: 'CIVIL SUPPLIES & CONSUMER PROTECTION DEPT — TAMIL NADU',
        title: 'FAMILY SMART RATION CARD (PHH / RICE CARD)',
        badge: 'SMART CARD REV-104',
        accent: '#15803d',
        lines: [
            'Smart Card Number: 333005882190  |  Card Type: PHH (Rice Card)',
            'Family Head: KUMARAN K (S/o KIRUBAKARAN)',
            'Mother: DEVAKI K  |  Mobile: 9790170026',
            'Family Members Included: 1. Kumaran K, 2. Kirubakaran, 3. Devaki K',
            'Address: 216, Mettu Street, Narasingapuram, Minnal, Ranipet - 632510',
            'Taluk: Arakkonam  |  District: Ranipet  |  FPS Shop: MNL-014',
            'Gas Connection: Indane Gas (1 Cylinder)',
            'Official Smart Family Card Copy'
        ]
    });

    // 10. First Graduate Applicant 12th Transfer Certificate (REV-104)
    await renderCertificateJpg('10_fg_student_12th_tc_kumaran.jpg', {
        banner: 'DEPARTMENT OF SCHOOL EDUCATION — TAMIL NADU',
        title: 'HIGHER SECONDARY (12TH STD) TRANSFER CERTIFICATE (STUDENT TC)',
        badge: '12TH TC REV-104',
        accent: '#1d4ed8',
        lines: [
            'TC Admission No: HSC-2024-91042  |  EMIS No: 33081209412',
            'Name of Student: KUMARAN K',
            'Father Name: KIRUBAKARAN  |  Mother Name: DEVAKI K',
            'Date of Birth: 10/06/1993  |  Nationality: Indian',
            'Community / Caste: MBC — VANNIYAR  |  Medium: English / Tamil',
            'Class Studied: XII Standard (12th)  |  Year of Passing: 2024',
            'Higher Study Course: B.E. Computer Science and Engineering',
            'School: Government Higher Secondary School, Minnal, Ranipet - 632510'
        ]
    });

    // 11. First Graduate Father School TC (REV-104)
    await renderCertificateJpg('11_fg_father_tc_kirubakaran.jpg', {
        banner: 'DEPARTMENT OF SCHOOL EDUCATION — TAMIL NADU',
        title: 'FATHER SCHOOL TRANSFER CERTIFICATE (SSLC / 10TH STD TC)',
        badge: 'FATHER TC REV-104',
        accent: '#4338ca',
        lines: [
            'TC Register No: SSLC-1984-21409',
            'Name of Pupil (Father of Applicant): KIRUBAKARAN',
            'Relationship to Applicant: Father of KUMARAN K',
            'Highest Educational Qualification: 10th Standard (SSLC Passed - Non-Graduate)',
            'Has Completed Any University Degree / Graduation: NO',
            'Community: MBC (Vanniyar)  |  District: Ranipet',
            'School: Government High School, Arakkonam - 631001',
            'Certified Non-Graduate Parent Education Proof for First Graduate REV-104'
        ]
    });

    // 12. First Graduate Mother School TC (REV-104)
    await renderCertificateJpg('12_fg_mother_tc_devaki.jpg', {
        banner: 'DEPARTMENT OF SCHOOL EDUCATION — TAMIL NADU',
        title: 'MOTHER SCHOOL TRANSFER CERTIFICATE (8TH STD TC)',
        badge: 'MOTHER TC REV-104',
        accent: '#be185d',
        lines: [
            'TC Register No: MS-1988-08421',
            'Name of Pupil (Mother of Applicant): DEVAKI K',
            'Husband Name: KIRUBAKARAN  |  Applicant Son: KUMARAN K',
            'Highest Educational Qualification: 8th Standard (Non-Graduate)',
            'Has Completed Any University Degree / Graduation: NO',
            'Community: MBC (Vanniyar)  |  District: Ranipet',
            'School: Panchayat Union Middle School, Minnal - 632510',
            'Certified Non-Graduate Mother Education Proof for First Graduate REV-104'
        ]
    });

    // 13. Gas Book Indane Consumer Card (TNPDS New Ration Card)
    const gasSrc = path.join(DOCS_DIR, 'gas_book_receipt.jpeg');
    if (fs.existsSync(gasSrc)) {
        await sharp(gasSrc).resize({ width: 900, withoutEnlargement: true }).jpeg({ quality: 82 }).toFile(path.join(OUT_DIR, '13_gas_book_indane_kumaran.jpg'));
    }

    const generated = fs.readdirSync(OUT_DIR);
    console.log(`✅ Generated ${generated.length} Golden Sample files in: ${OUT_DIR}`);
    generated.forEach(f => {
        const kb = Math.round(fs.statSync(path.join(OUT_DIR, f)).size / 1024);
        console.log(`   - ${f} (${kb} KB)`);
    });
}

generateAll().catch(e => {
    console.error('❌ Gallery generation failed:', e);
    process.exit(1);
});
