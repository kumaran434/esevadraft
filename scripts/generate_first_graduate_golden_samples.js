/**
 * Script: generate_first_graduate_golden_samples.js
 * Generates realistic Tamil Nadu educational certificates, Smart Card, and student profile assets
 * strictly inside `data/golden_samples/first_graduate/` (Zero pollution of user app data).
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const targetDir = path.join(__dirname, '..', 'data', 'golden_samples', 'first_graduate');
if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

async function generateAllGoldenSamples() {
    console.log('🎨 Generating authentic Tamil Nadu First Graduate Golden Sample Documents...\n');

    // 1. Student Passport Photo (200x230 standard Indian passport photo)
    const studentPhotoPath = path.join(targetDir, 'student_passport_photo.jpg');
    const photoSvg = `
    <svg width="600" height="690" xmlns="http://www.w3.org/2000/svg">
        <rect width="600" height="690" fill="#e0e7ff" />
        <!-- Person body -->
        <path d="M 120 690 C 120 520, 220 480, 300 480 C 380 480, 480 520, 480 690 Z" fill="#1e3a8a" />
        <!-- Shirt collar -->
        <polygon points="260,480 300,560 340,480" fill="#ffffff" />
        <!-- Neck -->
        <rect x="260" y="380" width="80" height="120" rx="20" fill="#d4a373" />
        <!-- Head -->
        <ellipse cx="300" cy="270" rx="130" ry="160" fill="#d4a373" />
        <!-- Hair -->
        <path d="M 170 240 C 170 120, 430 120, 430 240 C 430 170, 390 140, 300 140 C 210 140, 170 170, 170 240 Z" fill="#1c1917" />
        <!-- Eyes -->
        <ellipse cx="250" cy="260" rx="14" ry="8" fill="#1c1917" />
        <ellipse cx="350" cy="260" rx="14" ry="8" fill="#1c1917" />
        <!-- Eyebrows -->
        <path d="M 230 240 Q 250 230 270 240" stroke="#1c1917" stroke-width="5" fill="none" stroke-linecap="round" />
        <path d="M 330 240 Q 350 230 370 240" stroke="#1c1917" stroke-width="5" fill="none" stroke-linecap="round" />
        <!-- Nose -->
        <path d="M 300 260 L 295 305 L 310 305" stroke="#b08968" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round" />
        <!-- Smile -->
        <path d="M 270 340 Q 300 365 330 340" stroke="#7f4f24" stroke-width="4" fill="none" stroke-linecap="round" />
    </svg>`;

    await sharp(Buffer.from(photoSvg))
        .resize(200, 230)
        .jpeg({ quality: 88 })
        .toFile(studentPhotoPath);
    console.log(`  ✅ 1. Student Photo: ${studentPhotoPath} (${(fs.statSync(studentPhotoPath).size / 1024).toFixed(1)} KB)`);

    // 2. Student Aadhaar Card (Tamil & English Dual Sided)
    const studentAadhaarPath = path.join(targetDir, 'student_aadhaar.jpg');
    const aadhaarSvg = `
    <svg width="1000" height="650" xmlns="http://www.w3.org/2000/svg">
        <!-- Card Background -->
        <rect width="1000" height="650" rx="20" fill="#ffffff" stroke="#cbd5e1" stroke-width="4" />
        
        <!-- Header Tricolor Bar -->
        <rect x="20" y="20" width="960" height="15" fill="#f97316" rx="4" />
        <rect x="20" y="35" width="960" height="15" fill="#ffffff" />
        <rect x="20" y="50" width="960" height="15" fill="#16a34a" rx="4" />
        
        <!-- Govt Titles -->
        <text x="500" y="100" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#991b1b" text-anchor="middle">இந்திய தனித்துவ அடையாள ஆணையம்</text>
        <text x="500" y="128" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#1e3a8a" text-anchor="middle">Unique Identification Authority of India</text>
        
        <!-- Left Photo Box -->
        <rect x="60" y="160" width="220" height="260" rx="10" fill="#e2e8f0" stroke="#94a3b8" stroke-width="2" />
        <circle cx="170" cy="250" r="60" fill="#cbd5e1" />
        <path d="M 80 400 C 80 330, 130 320, 170 320 C 210 320, 260 330, 260 400 Z" fill="#94a3b8" />
        
        <!-- Details Area -->
        <text x="320" y="195" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="#0f172a">பெயர்: சூர்யா கி</text>
        <text x="320" y="228" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="#0f172a">Name: SURYA K</text>
        
        <text x="320" y="270" font-family="Arial, sans-serif" font-size="19" fill="#334155">பிறந்த தேதி / DOB: 12/05/2006</text>
        <text x="320" y="305" font-family="Arial, sans-serif" font-size="19" fill="#334155">பாலினம் / Gender: ஆண் / Male</text>
        <text x="320" y="340" font-family="Arial, sans-serif" font-size="19" fill="#334155">தந்தை: கிருபாகரன் (Kirubakaran)</text>
        <text x="320" y="375" font-family="Arial, sans-serif" font-size="17" fill="#475569">முகவரி: 216, மேட்டு தெரு, மின்னல், அரக்கோணம், ராணிப்பேட்டை - 632510</text>
        
        <!-- Aadhaar Number -->
        <rect x="250" y="470" width="500" height="70" rx="10" fill="#f8fafc" stroke="#e2e8f0" stroke-width="2" />
        <text x="500" y="518" font-family="Arial, sans-serif" font-size="34" font-weight="bold" fill="#0f172a" text-anchor="middle" letter-spacing="4">5755 6766 2931</text>
        
        <text x="500" y="590" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#991b1b" text-anchor="middle">எனது ஆதார், எனது அடையாளம்</text>
    </svg>`;

    await sharp(Buffer.from(aadhaarSvg))
        .resize(1000, 650)
        .jpeg({ quality: 85 })
        .toFile(studentAadhaarPath);
    console.log(`  ✅ 2. Student Aadhaar: ${studentAadhaarPath} (${(fs.statSync(studentAadhaarPath).size / 1024).toFixed(1)} KB)`);

    // 3. Student 12th Transfer Certificate (TC) (Authentic Tamil Nadu State Board Format)
    const student12thTcPath = path.join(targetDir, 'student_12th_tc.jpg');
    const studentTcSvg = `
    <svg width="1200" height="1600" xmlns="http://www.w3.org/2000/svg">
        <!-- Border & Background -->
        <rect width="1200" height="1600" fill="#fcfbf7" />
        <rect x="30" y="30" width="1140" height="1540" fill="none" stroke="#78350f" stroke-width="6" />
        <rect x="42" y="42" width="1116" height="1516" fill="none" stroke="#78350f" stroke-width="2" />
        
        <!-- Header -->
        <text x="600" y="110" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#1e3a8a" text-anchor="middle">தமிழ்நாடு அரசு - பள்ளிக் கல்வித்துறை</text>
        <text x="600" y="148" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="#0f172a" text-anchor="middle">GOVERNMENT OF TAMIL NADU - DEPARTMENT OF SCHOOL EDUCATION</text>
        
        <!-- School Name -->
        <text x="600" y="200" font-family="Arial, sans-serif" font-size="26" font-weight="bold" fill="#78350f" text-anchor="middle">அரசு ஆண்கள் மேல்நிலைப் பள்ளி, அரக்கோணம்</text>
        <text x="600" y="235" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#334155" text-anchor="middle">GOVERNMENT BOYS HIGHER SECONDARY SCHOOL, ARAKKONAM - 631001</text>
        
        <rect x="400" y="260" width="400" height="45" fill="#fef3c7" stroke="#b45309" stroke-width="2" rx="6" />
        <text x="600" y="292" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="#92400e" text-anchor="middle">மாற்றுச் சான்றிதழ் / TRANSFER CERTIFICATE</text>
        
        <!-- Metadata -->
        <text x="80" y="350" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#0f172a">வரிசை எண் / S.No: TC/2024/0482</text>
        <text x="750" y="350" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#0f172a">சேர்க்கை எண் / Admission No: 4821</text>
        <text x="80" y="385" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#0f172a">EMIS எண்: 3304010010112345</text>
        <text x="750" y="385" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#0f172a">தேதி / Date: 18/05/2024</text>
        
        <line x1="60" y1="410" x2="1140" y2="410" stroke="#78350f" stroke-width="2" />
        
        <!-- Fields Table -->
        <g font-family="Arial, sans-serif" font-size="18" fill="#0f172a">
            <text x="80" y="460">1. மாணவர் பெயர் / Name of the Pupil</text>
            <text x="560" y="460" font-weight="bold">: SURYA K (சூர்யா கி)</text>
            
            <text x="80" y="520">2. தந்தை பெயர் / Name of the Father</text>
            <text x="560" y="520" font-weight="bold">: KIRUBAKARAN (கிருபாகரன்)</text>
            
            <text x="80" y="580">3. தாய் பெயர் / Name of the Mother</text>
            <text x="560" y="580" font-weight="bold">: DEVAKI (தேவகி)</text>
            
            <text x="80" y="640">4. பிறந்த தேதி / Date of Birth</text>
            <text x="560" y="640" font-weight="bold">: 12/05/2006 (பன்னிரண்டு மே இரண்டாயிரத்து ஆறு)</text>
            
            <text x="80" y="700">5. இனம் மற்றும் மதம் / Nationality &amp; Religion</text>
            <text x="560" y="700">: இந்தியன் - இந்து (Indian - Hindu)</text>
            
            <text x="80" y="760">6. சமூகம் / Community &amp; Caste</text>
            <text x="560" y="760" font-weight="bold">: MBC - Vanniyakula Kshatriya</text>
            
            <text x="80" y="820">7. பள்ளிக்கு வந்த தேதி / Date of Admission</text>
            <text x="560" y="820">: 05/06/2022 (Standard XI)</text>
            
            <text x="80" y="880">8. பள்ளியை விட்டு விலகும்போது படித்த வகுப்பு</text>
            <text x="560" y="880" font-weight="bold">: பன்னிரண்டாம் வகுப்பு (Standard XII - Passed)</text>
            <text x="100" y="905" font-size="15" fill="#475569">Class in which the pupil was studying</text>
            <text x="560" y="905" font-size="16" fill="#1e3a8a">Group: Mathematics, Physics, Chemistry, Computer Science</text>
            
            <text x="80" y="965">9. பொதுத்தேர்வு எழுதிய மாதம் / ஆண்டு</text>
            <text x="560" y="965" font-weight="bold">: மார்ச் 2024 (March 2024 Higher Secondary Examination)</text>
            
            <text x="80" y="1025">10. மேற்படிப்பிற்கு தகுதி பெற்றவரா?</text>
            <text x="560" y="1025" font-weight="bold">: ஆம் / QUALIFIED FOR HIGHER EDUCATION</text>
            <text x="100" y="1050" font-size="15" fill="#475569">Whether qualified for promotion to college</text>
            
            <text x="80" y="1110">11. பள்ளியை விட்டு விலகுவதற்கான காரணம்</text>
            <text x="560" y="1110">: பள்ளிப் படிப்பு நிறைவு / Higher Studies (College)</text>
            
            <text x="80" y="1170">12. மாணவரின் ஒழுக்கமும் நடத்தையும்</text>
            <text x="560" y="1170" font-weight="bold">: நன்று / GOOD</text>
        </g>
        
        <!-- Signatures & Seals -->
        <g font-family="Arial, sans-serif" font-size="17" font-weight="bold" fill="#0f172a">
            <text x="120" y="1420">தயாரித்தவர்</text>
            <text x="110" y="1445" font-size="14" font-weight="normal">Prepared by</text>
            
            <text x="480" y="1420">சரிபார்த்தவர்</text>
            <text x="475" y="1445" font-size="14" font-weight="normal">Checked by</text>
            
            <!-- School Seal Stamp -->
            <circle cx="530" cy="1330" r="65" fill="none" stroke="#1d4ed8" stroke-width="3" stroke-dasharray="6,4" />
            <text x="530" y="1325" font-size="13" fill="#1d4ed8" text-anchor="middle">GOVT BOYS HR SEC SCHOOL</text>
            <text x="530" y="1345" font-size="13" fill="#1d4ed8" text-anchor="middle">ARAKKONAM</text>
            
            <text x="840" y="1420">தலைமை ஆசிரியர் கையொப்பம்</text>
            <text x="870" y="1445" font-size="14" font-weight="normal">Signature of Headmaster</text>
        </g>
    </svg>`;

    await sharp(Buffer.from(studentTcSvg))
        .resize(1000, 1333)
        .jpeg({ quality: 82 })
        .toFile(student12thTcPath);
    console.log(`  ✅ 3. Student 12th TC: ${student12thTcPath} (${(fs.statSync(student12thTcPath).size / 1024).toFixed(1)} KB)`);

    // 4. Father's Transfer Certificate (Showing 10th Standard / Non-Graduate)
    const fatherTcPath = path.join(targetDir, 'father_tc.jpg');
    const fatherTcSvg = `
    <svg width="1200" height="1500" xmlns="http://www.w3.org/2000/svg">
        <rect width="1200" height="1500" fill="#fefce8" />
        <rect x="30" y="30" width="1140" height="1440" fill="none" stroke="#713f12" stroke-width="4" />
        
        <text x="600" y="100" font-family="Arial, sans-serif" font-size="26" font-weight="bold" fill="#713f12" text-anchor="middle">தமிழ்நாடு அரசு - பள்ளிக் கல்வித்துறை</text>
        <text x="600" y="140" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="#0f172a" text-anchor="middle">அரசு உயர்நிலைப் பள்ளி, மின்னல், அரக்கோணம் வட்டம்</text>
        
        <rect x="420" y="170" width="360" height="40" fill="#fef08a" stroke="#ca8a04" stroke-width="2" rx="5" />
        <text x="600" y="198" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#854d0e" text-anchor="middle">பள்ளி மாற்றுச் சான்றிதழ் (TC)</text>
        
        <text x="80" y="260" font-family="Arial, sans-serif" font-size="18">வரிசை எண்: TC/1991/118</text>
        <text x="800" y="260" font-family="Arial, sans-serif" font-size="18">ஆண்டு: மார்ச் 1991</text>
        
        <line x1="60" y1="285" x2="1140" y2="285" stroke="#713f12" stroke-width="2" />
        
        <g font-family="Arial, sans-serif" font-size="19" fill="#0f172a">
            <text x="80" y="340">1. மாணவர் பெயர் / Name of the Pupil</text>
            <text x="560" y="340" font-weight="bold">: KIRUBAKARAN (கிருபாகரன்)</text>
            
            <text x="80" y="410">2. தந்தை பெயர் / Father's Name</text>
            <text x="560" y="410">: சண்முகம் (Shanmugam)</text>
            
            <text x="80" y="480">3. பிறந்த தேதி / Date of Birth</text>
            <text x="560" y="480" font-weight="bold">: 15/06/1974</text>
            
            <text x="80" y="550">4. சமூகம் / Community</text>
            <text x="560" y="550">: MBC - Vanniyar</text>
            
            <text x="80" y="620">5. பள்ளியை விட்டு விலகும்போது முடித்த வகுப்பு</text>
            <text x="560" y="620" font-weight="bold" fill="#15803d">: பத்தாம் வகுப்பு தேர்ச்சி (SSLC / 10th Passed)</text>
            <text x="100" y="645" font-size="15" fill="#475569">Educational Status: School Level (Non-Graduate)</text>
            
            <text x="80" y="710">6. பள்ளியை விட்டு விலகுவதற்கான காரணம்</text>
            <text x="560" y="710">: குடும்ப சூழ்நிலை / பள்ளிப் படிப்பு நிறைவு</text>
            
            <text x="80" y="780">7. நடத்தை மற்றும் ஒழுக்கம்</text>
            <text x="560" y="780" font-weight="bold">: நன்று (Good)</text>
        </g>
        
        <circle cx="500" cy="1150" r="60" fill="none" stroke="#047857" stroke-width="3" stroke-dasharray="5,4" />
        <text x="500" y="1155" font-size="13" font-family="Arial" fill="#047857" text-anchor="middle">GOVT HIGH SCHOOL MINNAL</text>
        
        <text x="850" y="1250" font-family="Arial, sans-serif" font-size="18" font-weight="bold">தலைமை ஆசிரியர்</text>
        <text x="820" y="1275" font-family="Arial, sans-serif" font-size="15">அரசு உயர்நிலைப் பள்ளி, மின்னல்</text>
    </svg>`;

    await sharp(Buffer.from(fatherTcSvg))
        .resize(1000, 1250)
        .jpeg({ quality: 82 })
        .toFile(fatherTcPath);
    console.log(`  ✅ 4. Father TC: ${fatherTcPath} (${(fs.statSync(fatherTcPath).size / 1024).toFixed(1)} KB)`);

    // 5. Mother's Transfer Certificate (Showing 8th Standard / Non-Graduate)
    const motherTcPath = path.join(targetDir, 'mother_tc.jpg');
    const motherTcSvg = `
    <svg width="1200" height="1500" xmlns="http://www.w3.org/2000/svg">
        <rect width="1200" height="1500" fill="#fff7ed" />
        <rect x="30" y="30" width="1140" height="1440" fill="none" stroke="#9a3412" stroke-width="4" />
        
        <text x="600" y="100" font-family="Arial, sans-serif" font-size="26" font-weight="bold" fill="#9a3412" text-anchor="middle">தமிழ்நாடு அரசு - தொடக்கக் கல்வித்துறை</text>
        <text x="600" y="140" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="#0f172a" text-anchor="middle">அரசு நடுநிலைப் பள்ளி, நரசிங்கபுரம்</text>
        
        <rect x="420" y="170" width="360" height="40" fill="#ffedd5" stroke="#ea580c" stroke-width="2" rx="5" />
        <text x="600" y="198" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#c2410c" text-anchor="middle">பள்ளி மாற்றுச் சான்றிதழ் (TC)</text>
        
        <text x="80" y="260" font-family="Arial, sans-serif" font-size="18">வரிசை எண்: TC/1995/074</text>
        <text x="800" y="260" font-family="Arial, sans-serif" font-size="18">ஆண்டு: ஏப்ரல் 1995</text>
        
        <line x1="60" y1="285" x2="1140" y2="285" stroke="#9a3412" stroke-width="2" />
        
        <g font-family="Arial, sans-serif" font-size="19" fill="#0f172a">
            <text x="80" y="340">1. மாணவி பெயர் / Name of the Pupil</text>
            <text x="560" y="340" font-weight="bold">: DEVAKI (தேவகி)</text>
            
            <text x="80" y="410">2. தந்தை பெயர் / Father's Name</text>
            <text x="560" y="410">: கோவிந்தன் (Govindan)</text>
            
            <text x="80" y="480">3. பிறந்த தேதி / Date of Birth</text>
            <text x="560" y="480" font-weight="bold">: 08/04/1979</text>
            
            <text x="80" y="550">4. சமூகம் / Community</text>
            <text x="560" y="550">: MBC</text>
            
            <text x="80" y="620">5. பள்ளியை விட்டு விலகும்போது முடித்த வகுப்பு</text>
            <text x="560" y="620" font-weight="bold" fill="#15803d">: எட்டாம் வகுப்பு (8th Standard)</text>
            <text x="100" y="645" font-size="15" fill="#475569">Educational Status: Middle School (Non-Graduate)</text>
            
            <text x="80" y="710">6. பள்ளியை விட்டு விலகுவதற்கான காரணம்</text>
            <text x="560" y="710">: படிப்பு நிறைவு / இல்லப் பணி</text>
            
            <text x="80" y="780">7. நடத்தை மற்றும் ஒழுக்கம்</text>
            <text x="560" y="780" font-weight="bold">: நன்று (Good)</text>
        </g>
        
        <circle cx="500" cy="1150" r="60" fill="none" stroke="#c2410c" stroke-width="3" stroke-dasharray="5,4" />
        <text x="500" y="1155" font-size="13" font-family="Arial" fill="#c2410c" text-anchor="middle">GOVT MIDDLE SCHOOL</text>
        
        <text x="850" y="1250" font-family="Arial, sans-serif" font-size="18" font-weight="bold">தலைமை ஆசிரியை</text>
        <text x="800" y="1275" font-family="Arial, sans-serif" font-size="15">அரசு நடுநிலைப் பள்ளி, நரசிங்கபுரம்</text>
    </svg>`;

    await sharp(Buffer.from(motherTcSvg))
        .resize(1000, 1250)
        .jpeg({ quality: 82 })
        .toFile(motherTcPath);
    console.log(`  ✅ 5. Mother TC: ${motherTcPath} (${(fs.statSync(motherTcPath).size / 1024).toFixed(1)} KB)`);

    // 6. Family Smart Ration Card
    const smartCardPath = path.join(targetDir, 'family_smart_card.jpg');
    const smartCardSvg = `
    <svg width="1000" height="650" xmlns="http://www.w3.org/2000/svg">
        <rect width="1000" height="650" rx="15" fill="#ffffff" stroke="#047857" stroke-width="4" />
        <rect x="0" y="0" width="1000" height="90" fill="#047857" rx="15" />
        <text x="500" y="40" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="#ffffff" text-anchor="middle">உணவுப்பொருள் வழங்கல் மற்றும் நுகர்வோர் பாதுகாப்புத் துறை</text>
        <text x="500" y="70" font-family="Arial, sans-serif" font-size="18" fill="#a7f3d0" text-anchor="middle">TAMIL NADU CIVIL SUPPLIES &amp; CONSUMER PROTECTION DEPARTMENT</text>
        
        <!-- Card Number -->
        <text x="50" y="130" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#0f172a">ஸ்மார்ட் அட்டை எண் / Smart Card No: 33/W/0482109</text>
        <text x="650" y="130" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#047857">அரிசி அட்டை (PHH - Rice)</text>
        
        <!-- Family Head -->
        <text x="50" y="170" font-family="Arial, sans-serif" font-size="18" fill="#334155">குடும்பத் தலைவர் பெயர்: <b>கிருபாகரன் (Kirubakaran)</b></text>
        <text x="50" y="200" font-family="Arial, sans-serif" font-size="16" fill="#475569">முகவரி: 216, மேட்டு தெரு, மின்னல், அரக்கோணம், ராணிப்பேட்டை - 632510</text>
        
        <!-- Family Members Table -->
        <rect x="40" y="230" width="920" height="350" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2" rx="8" />
        <line x1="40" y1="280" x2="960" y2="280" stroke="#cbd5e1" stroke-width="2" />
        
        <!-- Table Header -->
        <text x="60" y="262" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#0f172a">வ.எண்</text>
        <text x="140" y="262" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#0f172a">உறுப்பினர் பெயர் (Member Name)</text>
        <text x="500" y="262" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#0f172a">உறவுமுறை (Relation)</text>
        <text x="720" y="262" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#0f172a">பிறந்த தேதி / வயது</text>
        <text x="870" y="262" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#0f172a">ஆதார் நிலை</text>
        
        <!-- Member 1 -->
        <text x="70" y="320" font-family="Arial, sans-serif" font-size="16">1</text>
        <text x="140" y="320" font-family="Arial, sans-serif" font-size="16" font-weight="bold">கிருபாகரன் (Kirubakaran)</text>
        <text x="500" y="320" font-family="Arial, sans-serif" font-size="16">குடும்பத் தலைவர்</text>
        <text x="720" y="320" font-family="Arial, sans-serif" font-size="16">15/06/1974 (50)</text>
        <text x="880" y="320" font-family="Arial, sans-serif" font-size="15" fill="#15803d">இணைக்கப்பட்டது ✅</text>
        <line x1="40" y1="345" x2="960" y2="345" stroke="#e2e8f0" stroke-width="1" />
        
        <!-- Member 2 -->
        <text x="70" y="380" font-family="Arial, sans-serif" font-size="16">2</text>
        <text x="140" y="380" font-family="Arial, sans-serif" font-size="16" font-weight="bold">தேவகி (Devaki)</text>
        <text x="500" y="380" font-family="Arial, sans-serif" font-size="16">மனைவி (Mother)</text>
        <text x="720" y="380" font-family="Arial, sans-serif" font-size="16">08/04/1979 (45)</text>
        <text x="880" y="380" font-family="Arial, sans-serif" font-size="15" fill="#15803d">இணைக்கப்பட்டது ✅</text>
        <line x1="40" y1="405" x2="960" y2="405" stroke="#e2e8f0" stroke-width="1" />
        
        <!-- Member 3 -->
        <text x="70" y="440" font-family="Arial, sans-serif" font-size="16">3</text>
        <text x="140" y="440" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#1e40af">சூர்யா (Surya K - Applicant)</text>
        <text x="500" y="440" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#1e40af">மகன் (Son)</text>
        <text x="720" y="440" font-family="Arial, sans-serif" font-size="16">12/05/2006 (18)</text>
        <text x="880" y="440" font-family="Arial, sans-serif" font-size="15" fill="#15803d">இணைக்கப்பட்டது ✅</text>
        <line x1="40" y1="465" x2="960" y2="465" stroke="#e2e8f0" stroke-width="1" />
        
        <!-- Member 4 -->
        <text x="70" y="500" font-family="Arial, sans-serif" font-size="16">4</text>
        <text x="140" y="500" font-family="Arial, sans-serif" font-size="16">பவித்ரா (Pavithra K)</text>
        <text x="500" y="500" font-family="Arial, sans-serif" font-size="16">மகள் (Sister)</text>
        <text x="720" y="500" font-family="Arial, sans-serif" font-size="16">20/09/2009 (15)</text>
        <text x="880" y="500" font-family="Arial, sans-serif" font-size="15" fill="#15803d">இணைக்கப்பட்டது ✅</text>
    </svg>`;

    await sharp(Buffer.from(smartCardSvg))
        .resize(1000, 650)
        .jpeg({ quality: 85 })
        .toFile(smartCardPath);
    console.log(`  ✅ 6. Family Smart Card: ${smartCardPath} (${(fs.statSync(smartCardPath).size / 1024).toFixed(1)} KB)`);

    console.log('\n🎉 ALL FIRST GRADUATE GOLDEN ASSETS SUCCESSFULLY GENERATED IN:');
    console.log(`   ${targetDir}\n`);
}

generateAllGoldenSamples().catch(err => {
    console.error('❌ Error generating golden samples:', err);
    process.exit(1);
});
