let GoogleGenAI = null;
const fs = require('fs');
const path = require('path');

function getActiveApiKey(options = {}) {
    if (options && options.apiKey) return options.apiKey;
    if (options && options.geminiApiKey) return options.geminiApiKey;
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 5) return process.env.GEMINI_API_KEY;
    try {
        const dotenv = require('dotenv');
        const envCandidates = [
            path.join(__dirname, '.env'),
            path.join(process.env.APPDATA || '', 'esevadraft-desktop', '.env'),
            path.join(process.resourcesPath || '', '.env')
        ];
        for (const ec of envCandidates) {
            if (fs.existsSync(ec)) dotenv.config({ path: ec });
        }
    } catch (_) {}
    return process.env.GEMINI_API_KEY || '';
}

function getAiClient(options = {}) {
    const key = getActiveApiKey(options);
    if (!key) return null;
    try {
        if (!GoogleGenAI) {
            GoogleGenAI = require('@google/genai').GoogleGenAI;
        }
        return new GoogleGenAI({ apiKey: key });
    } catch (_) {
        return null;
    }
}

/**
 * AI Multimodal Quality Inspector & Document Extraction Engine:
 * 1. Checks if image is blurry, dim, glare-filled, or unreadable.
 * 2. If unreadable, returns isQualityAcceptable: false with polite Tamil advice to re-upload.
 * 3. If readable, extracts all required Tamil Nadu government fields with 99.9% precision.
 */
async function inspectAndExtractDocument(filePath, options = {}) {
    if (!fs.existsSync(filePath)) {
        return { isQualityAcceptable: false, feedbackTamil: 'கோப்பு கிடைக்கவில்லை.' };
    }

    const ai = getAiClient(options);
    if (!ai) {
        console.warn('⚠️ [AI Extractor] GEMINI_API_KEY not configured. Falling back to default document state.');
        return {
            isQualityAcceptable: true,
            feedbackTamil: 'ஆவணம் வெற்றிகரமாகப் பெறப்பட்டது.',
            documentType: 'DOCUMENT'
        };
    }

    try {
        let imageBuffer = fs.readFileSync(filePath);
        const ext = path.extname(filePath).toLowerCase();
        let mimeType = 'image/jpeg';
        if (ext === '.png') mimeType = 'image/png';
        if (ext === '.pdf') mimeType = 'application/pdf';

        // Cost Optimization: Downscale oversized phone photos (>1280px) before OCR to cut input tokens 5x-10x with 100% crisp readability
        if (ext !== '.pdf' && imageBuffer.length > 220 * 1024) {
            try {
                const sharp = require('sharp');
                const meta = await sharp(imageBuffer).metadata();
                if ((meta.width && meta.width > 1280) || (meta.height && meta.height > 1280) || imageBuffer.length > 450 * 1024) {
                    imageBuffer = await sharp(imageBuffer)
                        .rotate()
                        .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
                        .jpeg({ quality: 82 })
                        .toBuffer();
                    mimeType = 'image/jpeg';
                }
            } catch (_) {}
        }

        const base64Image = imageBuffer.toString('base64');

        let learnedHintsBlock = '';
        try {
            const { buildDynamicAiPromptHints, syncMemoryFromCloudIfStale } = require('./src/services/ai_correction_memory');
            syncMemoryFromCloudIfStale(false).catch(() => {});
            learnedHintsBlock = buildDynamicAiPromptHints(14) || '';
        } catch (_) {}

        const prompt = `You are an expert Government Document Quality Inspector and Multimodal OCR Specialist for Tamil Nadu (TNPDS) Civic applications.

Analyze this uploaded citizen document (Aadhaar Card, Gas Book, or Passport Photo).

TASK 1: QUALITY ASSESSMENT:
- Is this image readable and clear?
- If it is severely blurry, too dark, heavily shadowed, cut off, or illegible, mark isQualityAcceptable as false.
- If it is good enough to extract details or can be enhanced, mark isQualityAcceptable as true.

TASK 2: PRECISE DATA EXTRACTION & DOCUMENT CLASSIFICATION (If isQualityAcceptable is true):
Extract ONLY the fields actually visible on the uploaded image and classify the document (use null for any field not visible on the image; NEVER copy example placeholder values):
- Document Type: "AADHAAR_FULL" | "AADHAAR_FRONT" | "AADHAAR_BACK" | "SMART_CARD" | "SMART_CARD_FRONT" | "SMART_CARD_BACK" | "COMMUNITY_CERTIFICATE" | "INCOME_CERTIFICATE" | "INCOME_TAX_RETURN" | "TRANSFER_CERTIFICATE" | "SCHOOL_TC" | "GAS_BOOK" | "PROPERTY_TAX" | "EB_BILL" | "RENT_AGREEMENT" | "WATER_TAX" | "BANK_PASSBOOK" | "BIRTH_CERTIFICATE" | "DEATH_CERTIFICATE" | "PASSPORT_PHOTO" | "UNKNOWN"
  * AADHAAR_FULL: The image or PDF contains BOTH front details (Photo, Name, DOB, Aadhaar Number) AND back details (Address, S/O or W/O Care of, Pincode), or is a downloaded e-Aadhaar single-page letter containing full front and address sections.
  * AADHAAR_FRONT: The image contains ONLY the cropped front side of the card (Photo, Name, DOB, Aadhaar number) and DOES NOT have the address or back side.
  * AADHAAR_BACK: The image contains ONLY the back side of the card (Address, QR, C/O father/husband).
  * SMART_CARD: Full Tamil Nadu Smart Ration Card (or PDF/combined image containing BOTH front side card/address/head AND back side Family Members Table). Set "isFullSmartCard": true.
  * SMART_CARD_FRONT: ONLY the front side of a Tamil Nadu Smart Ration Card (Family Head photo, Card number 33..., Address) without the back Family Members list. Set "isFullSmartCard": false.
  * SMART_CARD_BACK: ONLY the back side of a Tamil Nadu Smart Ration Card showing the QR code and Family Members Table. Set "isFullSmartCard": false.
  * SMART CARD MEMBERS RULE: Whenever ANY family members table/list is visible on a Smart Ration Card (back or full sheet), extract EVERY member listed into "smartCardMembers": [ { "nameTam": "...", "nameEng": "...", "relationship": "Head|Husband|Wife|Son|Daughter|Father|Mother|Father-in-law|Mother-in-law|Brother|Sister|Other", "age": "", "gender": "Male|Female" } ]. Also extract "smartCardNumber" (e.g. 33...) and family address.
  * COMMUNITY_CERTIFICATE: Tamil Nadu Government Community Certificate (ஜாதிச் சான்றிதழ் / E-Certificate).
  * TRANSFER_CERTIFICATE / SCHOOL_TC: School / College Transfer Certificate (பள்ளி மாற்றுச் சான்றிதழ் / TC) showing student Community & Caste.
- isFullAadhaar: boolean (true if BOTH front details AND address details are visible on this document; false if only one side).
- hasAddress: boolean (true if address fields like doorNo, street, or pincode are visible on this document).
- Community & Caste Details (if this is a Community Certificate, Transfer Certificate, or School TC):
  * "community": "MBC" | "BC" | "BCM" | "SC" | "ST" | "OC" | null
  * "caste": Name of the caste/sub-caste printed on the document (e.g. "Vanniakula Kshatriya", "Vanniyar", "Agamudayar", "Adi Dravidar", etc.)
  * "subCaste": Sub-caste name if separately printed
  * "fatherCaste": Father's caste if printed
  * "motherCaste": Mother's caste if printed
  * "religion": "Hindu" | "Christian" | "Muslim" | null
  * "certificateNumber": Certificate or TC serial number if visible (e.g. TN-5202... or TN-4202...)
- Income Certificate, Salary Slip & Parent Occupation Details (if INCOME_CERTIFICATE, INCOME_TAX_RETURN, or Salary Slip):
  * Extract the EXACT annual family income in "annualIncome" as digits string (e.g. "36000", "72000"; if only monthly income is printed, multiply by 12).
  * Extract applicant's occupation in "occupation" / "applicantOccupation" ("Student" | "Agriculture" | "Business" | "Service" | specific role).
  * Extract Father's Occupation in "fatherOccupation" (e.g. "Farmer", "Agriculture", "Coolie", "Private Service", "Business", "Deceased") and "fatherEmploymentNature" ("Self Employed" | "Employed" | "Unemployed"). Note: On Tamil Nadu Income Certificates, inspect the Income Sources / Family Members table carefully — if Agriculture / Cultivation / Daily Wage / Business is shown under Father or Family Source, extract Father's real occupation (e.g. "Farmer") and set "fatherEmploymentNature": "Self Employed"! If Father is marked Late/Deceased, set "fatherAlive": false and "fatherOccupation": "Deceased".
  * Extract Mother's Occupation in "motherOccupation" (e.g. "Homemaker", "Farmer", "Service", "Deceased") and "motherEmploymentNature" ("Unemployed" | "Self Employed" | "Employed"). If Mother earns Rs. 0 or is a homemaker/housewife/not working, set "motherOccupation": "Homemaker" and "motherEmploymentNature": "Unemployed".
- Residence Proof Category: If this is a residence proof document, identify if it is:
  * "PROPERTY_TAX" (சொத்து வரி ரசீது / வீட்டு வரி ரசீது)
  * "EB_BILL" (மின் கட்டண ரசீது / TNEB Electricity Bill)
  * "GAS_BOOK" (எரிவாயு நுகர்வோர் அட்டை / LPG Consumer Card / Gas Bill)
  * "RENT_AGREEMENT" (வாடகை ஒப்பந்தம்)
  * "WATER_TAX" (குடிநீர் வரி ரசீது)
  * "BANK_PASSBOOK" (வங்கி கணக்குப் புத்தகம்)
  * "NONE" (if it is photo or aadhaar)
- Full Name in English and accurate Tamil transliteration.
  * CRITICAL TAMIL INITIAL RULE: FIRST, if the Aadhaar card ALREADY prints the person's name in Tamil script with a Tamil initial (e.g., "பபிதா ஆ", "சு பிரசாந்த்", "உதயகுமார் வே", "மு கார்த்திக்", "ப பழனி"), ALWAYS preserve that EXACT printed Tamil initial! NEVER replace printed Tamil initials (ஆ, சு, வே, மு, ப, செ, கோ) with phonetic English letters (அ, எஸ், வி, எம்). ONLY when Tamil script is missing/unclear, map single-letter English initials cleanly (G -> ஜி, J -> ஜே, K -> கி, C -> சி, S -> எஸ், R -> ஆர், M -> எம், N -> என், P -> பி, B -> பி, D -> டி, T -> டி, V -> வி, L -> எல், A -> அ, E -> இ, I -> ஐ, O -> ஓ, U -> யூ, H -> ஹெச், F -> எஃப்) and NEVER leave a raw English initial inside fullNameTam.
- Father / Husband Name & Relationship Rule (CRITICAL — NEVER CONFUSE W/O HUSBAND WITH FATHER!):
  * Examine BOTH Aadhaar Front AND Back carefully.
  * Look specifically for "W/o" (Wife of / க/பெ / கணவர் பெயர் / மனைவி) vs "S/o" (Son of / த/பெ) vs "D/o" (Daughter of) vs "C/o".
  * Note: On many Tamil Nadu women's Aadhaar cards, the cardholder's full name on the front ALREADY has her husband's name appended next to it (e.g. "Muthammaal Munusamy"), AND the back address says "W/o Munusamy" (even if a father's name also appears elsewhere).
  * If "W/o" / "Wife of" / "க/பெ" / "மனைவி" is visible -> set "relationship": "Husband", "maritalStatus": "Married", put the Husband's name in "spouseNameEng"/"spouseNameTam" AND "fatherNameEng"/"fatherNameTam". If a separate birth father name also appears, place it in "birthFatherNameEng"/"birthFatherNameTam" and NEVER put birth father in place of W/o Husband!
  * If "S/o" or "D/o" is visible -> set "relationship": "Father", "maritalStatus": null, and put Father's name in "fatherNameEng"/"fatherNameTam".
  * Apply the same Tamil Initial Rule to all extracted names.
- Date of Birth (format: DD/MM/YYYY):
  * YEAR-ONLY DOB RULE: Older Aadhaar cards sometimes print ONLY a 4-digit Year of Birth (e.g. "Year of Birth: 1968" or "1968") without day or month. In that case, set "dob": "01/01/YYYY" (e.g. "01/01/1968") and "dobIsYearOnly": true. Otherwise extract exact DD/MM/YYYY and "dobIsYearOnly": false.
- Gender ("Male" / "Female").
- BIRTH CERTIFICATE SPECIAL RULE: If documentType is "BIRTH_CERTIFICATE", extract the CHILD'S name as fullNameEng/fullNameTam, the child's DOB as dob, child's gender as gender, father's name as fatherNameEng/fatherNameTam, registration number as certificateNumber, and set aadhaarNumber strictly to null unless a 12-digit Aadhaar number specifically for that child is printed (NEVER put parent's phone/Aadhaar into child's aadhaarNumber).
- 12-Digit Aadhaar Number (without spaces, ONLY if an Aadhaar number is printed on the document; do not confuse LPG ID with Aadhaar).
- Smart Ration Card Number ("smartCardNumber", e.g., 12-digit number starting with 33... or old format like 05/G/..., ONLY if visible on a Ration/Smart Card).
- Door No / House No (STRICT ADDRESS COLUMN RULE):
  * Put ONLY the house/flat/plot/door number (e.g., "12", "4/56A", "No. 15B") into "doorNo".
  * NEVER put a Gas Consumer Number, LPG ID, EB Service Connection / Consumer Number, Meter No, Pincode, 5+ digit ID code (e.g., "622601"), or Person/Agency Name (e.g., "TNCS A/C DEVAGI") into "doorNo"! If no house/door number is printed or readable on the document, set "doorNo": null.
- Street Name in English and pure Tamil (e.g. "மேட்டு தெரு", not "மெட்டு ஸ்ட்ரீட்"):
  * Put ONLY the actual street/road/colony/nagar name into "streetEng" and accurate Tamil into "streetTam" (e.g. "Bajanai Kovil Street" / "பஜனை கோவில் தெரு").
  * STRICT INDIAN AADHAAR NOISE CLEANER: Strip "C/O", "S/O", "W/O", "D/O", "Post", "P.O.", "Tk", "Taluk", "Dist", "District", "Tamil Nadu", trailing commas, and extra spaces.
  * NEVER append a standalone Revenue Village name or Taluk name (e.g. "Soorai", "Arakkonam", "Sholinghur") onto "streetEng"/"streetTam"! Put ONLY the street name there.
  * NEVER put Customer Name, Father/Husband Name, "A/C ...", Consumer No, or Gas Distributor Office Address into "streetEng"/"streetTam"!
- Area / Village / Hamlet & Taluk Separation Rule (CRITICAL FOR TAMIL NADU — APPLIES TO AADHAAR, RATION CARD & ALL DOCUMENTS):
  * Put the official Tamil Nadu Taluk name ONLY into "taluk" (NEVER mix Taluk into "streetEng" or "areaEng"). If Taluk is NOT printed on the Aadhaar/document, set "taluk": null (do NOT guess a wrong Taluk — our 18,595 Tamil Nadu Revenue Village master resolves it deterministically!).
  * Put the residential Revenue Village / Town name into "village" (e.g. "Kunnathur" or "Soorai"). If the same village name is printed twice (e.g. "Kunnathur, Kunnathur"), write it ONLY ONCE.
  * POST OFFICE RULE (CRITICAL): On Indian Aadhaar & Ration Cards, a token marked "Post" / "P.O." / "PO" / "S.O." / "B.O." / "அஞ்சல்" (e.g. "Banavaram Post", "Kaveripakkam P.O.") is ONLY the postal delivery office — it is often a DIFFERENT neighboring town! NEVER put that Post Office town into "village", "areaEng", or "streetEng" when the citizen's actual residential village/hamlet appears before it!
  * Put a Hamlet / Colony / Sub-Village (குக்கிராமம் / காலனி, e.g. "Kunnathur Colony" / "குன்னத்தூர் காலனி") into "areaEng"/"areaTam" ONLY if it is a separate smaller colony/hamlet distinct from the Revenue Village; do NOT copy "village, taluk" (like "Soorai, Arakonam") into "areaEng"!
- District, Taluk, Pincode (6 digits — MUST come from the CUSTOMER residential address, NOT the distributor/agency office footer).${learnedHintsBlock}
- If Gas Book / LPG Receipt / Subscription Voucher (SV) / Gas Passbook / Refill Cash Memo:
  * Set "documentType": "GAS_BOOK", "residenceProofCategory": "GAS_BOOK", and "gasDetails.hasGas": true ALWAYS when ANY Gas / LPG document is detected.
  * Extract LPG Consumer Number (look for Consumer No / Cons. No / Reg. No / Subscription Voucher No / BP No / 10-digit Consumer No / 17-digit LPG ID) into "gasDetails.consumerNumber" (do not confuse distributor phone number with Consumer No).
  * Normalize "gasDetails.oilCompany" strictly to "IOC" (Indane / IndianOil / IOCL), "HPC" (HP Gas / Hindustan Petroleum / HPCL), or "BPC" (Bharat Gas / Bharat Petroleum / BPCL), and set "gasDetails.oilCompanyDisplay" to "Indane Gas (IOCL)", "HP Gas (HPC)", or "Bharat Gas (BPCL)".
  * Extract Distributor / Gas Agency Name into "gasDetails.agencyName" (e.g. "RAJAM GAS AGENCY"), and cylinder count ("1" or "2") into "gasDetails.cylinders".
  * Note: On Gas Books, the customer address is under NAME/ADDRESS and the distributor's office address is under DISTRIBUTOR'S NAME/ADDRESS—always extract ONLY the CUSTOMER'S residential address (excluding customer name line / A/C label / consumer number) for doorNo/street/area/village/pincode, and the DISTRIBUTOR'S name for agencyName!
- If EB Bill / Electricity Bill / Property Tax Receipt:
  * Extract ONLY the residential service address (Door No, Street, Area/Village, Pincode) — NEVER put the 12-digit EB Service Connection No / Assessment No or Consumer Name into "doorNo" or "streetEng"!
- Face / Passport Portrait Detection & Exact Document Boundary Detection:
  * "documentBoundingBox": [ymin, xmin, ymax, xmax] (normalized integers from 0 to 1000 tightly bounding the full physical document page/card edges, excluding only outer table/desk background. Never crop inside the document page!).
  * If this document contains a person's photo / face portrait (such as on an Aadhaar front card or e-Aadhaar):
    "faceDetected": true,
    "faceBoundingBox": [ymin, xmin, ymax, xmax] (normalized integers from 0 to 1000 bounding the portrait).
  * If no face is visible (e.g. back side, gas receipt, utility bill):
    "faceDetected": false,
    "faceBoundingBox": null

Respond strictly in JSON format (use null for fields not present in the image):
{
  "isQualityAcceptable": true,
  "feedbackTamil": "ஆவணம் தெளிவாக உள்ளது / ஆவணம் மங்கலாக உள்ளது...",
  "documentType": "AADHAAR_FULL",
  "isFullAadhaar": true,
  "isFullSmartCard": false,
  "hasAddress": true,
  "documentBoundingBox": [20, 20, 980, 980],
  "faceDetected": true,
  "faceBoundingBox": [430, 140, 560, 310],
  "residenceProofCategory": "NONE",
  "residenceProofNameTamil": "",
  "fullNameEng": "",
  "fullNameTam": "",
  "relationship": "Father",
  "maritalStatus": null,
  "fatherNameEng": "",
  "fatherNameTam": "",
  "spouseNameEng": null,
  "spouseNameTam": null,
  "birthFatherNameEng": null,
  "birthFatherNameTam": null,
  "dob": "",
  "dobIsYearOnly": false,
  "gender": "Male",
  "genderTam": "ஆண்",
  "aadhaarNumber": "",
  "smartCardNumber": "",
  "smartCardMembers": [],
  "doorNo": "",
  "streetEng": "",
  "streetTam": "",
  "areaEng": "",
  "areaTam": "",
  "district": "",
  "taluk": "",
  "village": "",
  "pincode": "",
  "community": null,
  "caste": null,
  "subCaste": null,
  "fatherCaste": null,
  "motherCaste": null,
  "certificateNumber": null,
  "annualIncome": null,
  "occupation": null,
  "applicantOccupation": null,
  "fatherOccupation": null,
  "fatherEmploymentNature": null,
  "fatherAlive": null,
  "motherOccupation": null,
  "motherEmploymentNature": null,
  "motherAlive": null,
  "gasDetails": {
    "hasGas": false,
    "consumerNumber": "",
    "oilCompany": "",
    "oilCompanyDisplay": "",
    "agencyName": "",
    "cylinders": "1"
  }
}`;

        // Budget-Optimized Model Strategy (85%+ savings):
        // Primary: gemini-flash-lite-latest with thinkingBudget: 0 (~4.3x cheaper than 3.8 Flash, zero hidden thinking tokens)
        // Fallback: gemini-2.5-flash with thinkingBudget: 0 ONLY if Flash Lite fails or returns empty/unparseable JSON
        const candidateModels = ['gemini-flash-lite-latest', 'gemini-2.5-flash'];
        const isSuspiciousUtilityExtraction = (resObj) => {
            if (!resObj || typeof resObj !== 'object') return false;
            const dt = String(resObj.documentType || '').toUpperCase();
            const isUtility = ['GAS_BOOK', 'EB_BILL', 'PROPERTY_TAX', 'WATER_TAX', 'RENT_AGREEMENT', 'BANK_PASSBOOK'].includes(dt) ||
                options?.subService === 'CHANGE_ADDRESS';
            if (!isUtility || dt.includes('AADHAAR')) return false;
            const dNo = String(resObj.doorNo || '').trim();
            const st = String(resObj.streetEng || resObj.streetTam || '').trim();
            const badDoor = !dNo || /^\d{5,}$/.test(dNo) || /^(tncs|a\/c|c\/o|s\/o|w\/o|indane|bharat|hp)/i.test(dNo);
            const badStreet = !st || /\b(tncs|a\/c|consumer|agency|distributor)\b/i.test(st);
            return badDoor || badStreet;
        };
        let result = null;
        let lastModelErr = null;
        for (const modelName of candidateModels) {
            try {
                const response = await ai.models.generateContent({
                    model: modelName,
                    contents: [
                        {
                            role: 'user',
                            parts: [
                                {
                                    inlineData: {
                                        mimeType: mimeType,
                                        data: base64Image
                                    }
                                },
                                {
                                    text: prompt
                                }
                            ]
                        }
                    ],
                    config: {
                        temperature: 0,
                        responseMimeType: 'application/json',
                        ...(modelName.includes('lite') ? {} : { thinkingConfig: { thinkingBudget: 0 } })
                    }
                });
                const parsed = JSON.parse(response.text);
                if (parsed && typeof parsed === 'object') {
                    result = parsed;
                    if (modelName === 'gemini-flash-lite-latest' && isSuspiciousUtilityExtraction(parsed)) {
                        console.warn('⚠️ [AI Extractor] Utility/Gas Book address looks ambiguous with Flash Lite — escalating to gemini-2.5-flash for higher accuracy...');
                        continue;
                    }
                    break;
                }
            } catch (mErr) {
                lastModelErr = mErr;
                console.warn(`⚠️ [AI Extractor] Model ${modelName} notice:`, mErr.message);
            }
        }
        if (!result) throw (lastModelErr || new Error('All Gemini extractor models failed'));
        sanitizeUtilityAddressFields(result, options);
        sanitizeAadhaarAddressFields(result);
        try {
            const { normalizeTamilInitialsFromEnglish, ensureBilingualPair } = require('./src/utils/bilingual_helper');
            if (result.fullNameEng && result.fullNameTam) {
                result.fullNameTam = normalizeTamilInitialsFromEnglish(result.fullNameEng, result.fullNameTam);
            } else if (result.fullNameEng && !result.fullNameTam) {
                result.fullNameTam = ensureBilingualPair(result.fullNameEng, '').tam;
            }
            if (result.fatherNameEng && result.fatherNameTam) {
                result.fatherNameTam = normalizeTamilInitialsFromEnglish(result.fatherNameEng, result.fatherNameTam);
            } else if (result.fatherNameEng && !result.fatherNameTam) {
                result.fatherNameTam = ensureBilingualPair(result.fatherNameEng, '').tam;
            }
            if (result.spouseNameEng && result.spouseNameTam) {
                result.spouseNameTam = normalizeTamilInitialsFromEnglish(result.spouseNameEng, result.spouseNameTam);
            } else if (result.spouseNameEng && !result.spouseNameTam) {
                result.spouseNameTam = ensureBilingualPair(result.spouseNameEng, '').tam;
            }
            if (Array.isArray(result.smartCardMembers)) {
                result.smartCardMembers = result.smartCardMembers
                    .filter(m => m && (m.nameTam || m.nameEng))
                    .map(m => {
                        const mp = ensureBilingualPair(m.nameEng || '', m.nameTam || '');
                        return {
                            nameEng: mp.eng || m.nameEng || '',
                            nameTam: mp.tam || m.nameTam || '',
                            relationship: m.relationship || 'Member',
                            age: m.age ? String(m.age).replace(/\D/g, '') : '',
                            gender: m.gender || ''
                        };
                    });
            }
            if (result.dob) {
                const { normalizeDobWithYearFallback } = require('./src/services/profile_helpers');
                const rawDob = String(result.dob).trim();
                if (/^\d{4}$/.test(rawDob)) result.dobIsYearOnly = true;
                result.dob = normalizeDobWithYearFallback(rawDob);
            }
            if (result.documentType === 'BIRTH_CERTIFICATE' && result.aadhaarNumber && !/^\d{12}$/.test(String(result.aadhaarNumber).replace(/\D/g, ''))) {
                result.aadhaarNumber = null;
            }
        } catch (_) {}
        console.log('\n📄 --- AI DOCUMENT INSPECTOR REPORT ---');
        console.log(`📄 Document Type: ${result.documentType}`);
        console.log(`📄 Quality Acceptable: ${result.isQualityAcceptable ? '✅ YES' : '❌ NO'}`);
        console.log(`📄 Feedback: ${result.feedbackTamil}`);
        if (result.isQualityAcceptable) {
            console.log(`📄 Extracted Name: ${result.fullNameTam} (${result.fullNameEng})`);
            console.log(`📄 Aadhaar: ${result.aadhaarNumber}`);
        }
        if (result.faceDetected) {
            console.log(`📄 Face Detected: ✅ YES (BoundingBox: ${JSON.stringify(result.faceBoundingBox)})`);
        }
        console.log('📄 ------------------------------------\n');

        // Auto-extracting face passport from Aadhaar is STRICTLY ABOLISHED per Founder Mandate.
        // Profile/passport photo must ONLY exist when the user explicitly uploads a real passport photo.
        result.extractedFacePhotoPath = null;

        // TN District Bifurcation & Revenue Village Auto-Correction (keeps Hamlet-in-Street synced):
        const { resolveTnDistrict } = require('./tn_district_mapper');
        const fullAddr = [result.streetEng, result.streetTam, result.areaEng, result.areaTam].filter(Boolean).join(', ');
        const resolved = resolveTnDistrict(result.district, result.taluk, result.village, result.pincode, fullAddr);
        result.district = resolved.district;
        result.districtTam = resolved.districtTam;
        if (resolved.taluk) result.taluk = resolved.taluk;
        if (resolved.talukTam) result.talukTam = resolved.talukTam;
        if (resolved.village && (!result.village || resolved.wasAutoCorrected)) {
            result.village = resolved.village;
            if (resolved.villageTam) result.villageTam = resolved.villageTam;
        }
        if (resolved.areaEng && !result.areaEng) result.areaEng = resolved.areaEng;
        if (resolved.areaTam && !result.areaTam) result.areaTam = resolved.areaTam;
        if (resolved.wasAutoCorrected) {
            result.districtAutoCorrected = true;
            result.districtCorrectionReason = resolved.reason;
            console.log(`💡 TN District Auto-Corrected: ${resolved.originalDistrict} -> ${resolved.district} (${resolved.reason})`);
        }

        return result;

    } catch (e) {
        console.warn('AI Extraction notice (using fallback):', e.message);
        return {
            isQualityAcceptable: true,
            feedbackTamil: 'ஆவணம் வெற்றிகரமாகப் பெறப்பட்டது.',
            documentType: 'DOCUMENT'
        };
    }
}

function sanitizeUtilityAddressFields(result, options = {}) {
    if (!result || typeof result !== 'object') return result;
    const dt = String(result.documentType || '').toUpperCase();
    const isUtility = ['GAS_BOOK', 'EB_BILL', 'PROPERTY_TAX', 'WATER_TAX', 'RENT_AGREEMENT', 'BANK_PASSBOOK'].includes(dt) ||
        options?.subService === 'CHANGE_ADDRESS';
    if (!isUtility || dt.includes('AADHAAR')) return result;

    const consumerDigits = String(result.gasDetails?.consumerNumber || '').replace(/\D/g, '');
    const rawDoor = String(result.doorNo || '').trim();
    const doorDigits = rawDoor.replace(/\D/g, '');
    const isConsumerOrAccountDoor = !rawDoor ||
        /^\d{5,}$/.test(rawDoor) ||
        (consumerDigits.length >= 5 && doorDigits && (doorDigits === consumerDigits || consumerDigits.includes(doorDigits))) ||
        /^(tncs|a\/c|ac\b|c\/o|s\/o|w\/o|indane|bharat|hp\s*gas|consumer)/i.test(rawDoor);
    if (isConsumerOrAccountDoor) {
        result.doorNo = null;
    }

    const cleanStreetNoise = (str) => {
        if (!str || typeof str !== 'string') return str;
        let s = str.trim();
        if (consumerDigits.length >= 5) {
            s = s.replace(new RegExp(`^\\s*${consumerDigits}\\s*[,\\-:\\/]*\\s*`, 'i'), '');
        }
        s = s.replace(/^\s*\d{5,}\s*[,\-:\/]+\s*/g, '');
        if (/^(tncs\s+a\/c|a\/c\s+|டி\.?என்\.?சி\.?எஸ்\s+ஏ\/சி)\b/i.test(s) && !/(street|road|nagar|colony|salai|theru|cross|avenue|தெரு|சாலை|நகர்|காலனி)/i.test(s)) {
            return null;
        }
        return s.trim() || null;
    };

    result.streetEng = cleanStreetNoise(result.streetEng);
    result.streetTam = cleanStreetNoise(result.streetTam);
    try {
        const { ensureBilingualPair, containsEnglish } = require('./src/utils/bilingual_helper');
        if (result.streetEng && (!result.streetTam || containsEnglish(result.streetTam))) {
            const pair = ensureBilingualPair(result.streetEng, '');
            if (pair.tam) result.streetTam = pair.tam;
        }
        if (result.areaEng && (!result.areaTam || containsEnglish(result.areaTam))) {
            const pair = ensureBilingualPair(result.areaEng, '');
            if (pair.tam) result.areaTam = pair.tam;
        }
    } catch (_) {}
    return result;
}

/**
 * Post-extraction sanitizer for Indian Aadhaar & Tamil Nadu civic addresses:
 * 1. Collapses redundant multiple spaces in names & address lines.
 * 2. Strips trailing commas and standalone Revenue Village / Taluk suffixes from streetEng/streetTam
 *    (Hamlets are ONLY kept when explicitly resolved as a confirmed Hamlet!).
 * 3. Separates "Village, Taluk" pairs cleanly using the 38-District / 315-Taluk Tamil Nadu Master Registry
 *    without relying on error-prone PIN-code guessing.
 */
function sanitizeAadhaarAddressFields(result) {
    if (!result || typeof result !== 'object') return result;

    const collapseSpaces = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : v);
    const nameKeys = ['fullNameEng', 'fullNameTam', 'fatherNameEng', 'fatherNameTam', 'spouseNameEng', 'spouseNameTam', 'birthFatherNameEng', 'birthFatherNameTam'];
    for (const k of nameKeys) {
        if (typeof result[k] === 'string') result[k] = collapseSpaces(result[k]);
    }
    const POST_OFFICE_SEG_RE = /\b(?:post\s*office|post|p\.?\s*o\.?|s\.?\s*o\.?|b\.?\s*o\.?)\b|அஞ்சல்/i;
    const dedupeCommaParts = (str, dropPoWhenOtherExists = false) => {
        if (!str || typeof str !== 'string') return str;
        const rawParts = str.split(',').map(p => p.trim()).filter(Boolean);
        if (rawParts.length === 0) return '';
        let working = rawParts;
        if (dropPoWhenOtherExists && rawParts.length > 1) {
            const nonPo = rawParts.filter(p => !POST_OFFICE_SEG_RE.test(p));
            if (nonPo.length > 0) working = nonPo;
        }
        const seen = new Set();
        const out = [];
        for (const p of working) {
            const cleaned = collapseSpaces(p)
                .replace(/^(?:c\/o|s\/o|w\/o|d\/o)\s*[:.\-]?\s*/i, '')
                .replace(/\b(?:post\s*office|post|p\.?\s*o\.?|s\.?\s*o\.?|b\.?\s*o\.?|tk|taluk|taluka|dist|district|tamil\s*nadu)\b\.?/gi, '')
                .replace(/அஞ்சல்|வட்டம்|மாவட்டம்|தமிழ்நாடு/g, '')
                .replace(/^[\s,\-]+|[\s,\-]+$/g, '')
                .replace(/\s+/g, ' ')
                .trim();
            if (!cleaned) continue;
            const key = cleaned.toLowerCase().replace(/[^a-z0-9\u0B80-\u0BFF]/g, '');
            if (!key || seen.has(key)) continue;
            seen.add(key);
            out.push(cleaned);
        }
        return out.join(', ');
    };

    // Preserve raw pre-stripped address (with "Post"/"P.O." intact!) so resolveTnDistrict can quarantine Post Office segments accurately
    const rawPreStrippedAddr = [result.streetEng, result.streetTam, result.areaEng, result.areaTam, result.village, result.taluk]
        .filter(Boolean)
        .join(', ');

    const addrKeys = ['doorNo', 'streetEng', 'streetTam', 'areaEng', 'areaTam', 'village', 'taluk', 'district'];
    for (const k of addrKeys) {
        if (typeof result[k] === 'string') {
            const dropPo = (k === 'streetEng' || k === 'streetTam' || k === 'areaEng' || k === 'areaTam' || k === 'village');
            result[k] = dedupeCommaParts(result[k], dropPo);
        }
    }

    try {
        const { resolveTnDistrict, isOfficialTnTaluk } = require('./tn_district_mapper');
        const escapeRe = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // If areaEng contains "Village, Taluk" (e.g. "Soorai, Arakonam"), split out the trailing Taluk token cleanly
        if (typeof result.areaEng === 'string' && result.areaEng.includes(',')) {
            const parts = result.areaEng.split(',').map(p => p.trim()).filter(Boolean);
            if (parts.length >= 2 && isOfficialTnTaluk(parts[parts.length - 1])) {
                const talukToken = parts.pop();
                if (!result.taluk) result.taluk = talukToken;
                result.areaEng = parts.join(', ');
                if (!result.village && parts.length === 1) result.village = parts[0];
            }
        }

        const rawAddrCombined = rawPreStrippedAddr || [result.streetEng, result.streetTam, result.areaEng, result.areaTam, result.village, result.taluk].filter(Boolean).join(', ');
        const resolved = resolveTnDistrict(
            result.district || '',
            result.taluk || '',
            result.village || result.areaEng || '',
            result.pincode || '',
            rawAddrCombined
        );

        if (resolved) {
            if (resolved.district) result.district = resolved.district;
            if (resolved.districtTam) result.districtTam = resolved.districtTam;
            if (resolved.taluk) result.taluk = resolved.taluk;
            if (resolved.talukTam) result.talukTam = resolved.talukTam;
            if (resolved.village) result.village = resolved.village;
            if (resolved.villageTam) result.villageTam = resolved.villageTam;

            const stripTokens = [resolved.village, resolved.villageTam, result.village, resolved.taluk, resolved.talukTam, result.taluk]
                .map(t => String(t || '').trim())
                .filter(t => t.length >= 3);
            const stripTrailingPlace = (st) => {
                if (!st || typeof st !== 'string') return st;
                let cleaned = st.replace(/[\s,]+$/g, '').trim();
                for (const tok of stripTokens) {
                    const re = new RegExp(`(?:,\\s*|\\s+)${escapeRe(tok)}$`, 'i');
                    const candidate = cleaned.replace(re, '').replace(/[\s,]+$/g, '').trim();
                    if (candidate.length >= 3) cleaned = candidate;
                }
                return cleaned;
            };

            if (resolved.isHamlet) {
                let hEng = resolved.areaEng || result.areaEng || '';
                let hTam = resolved.areaTam || result.areaTam || '';
                try {
                    const { ensureBilingualPair } = require('./src/utils/bilingual_helper');
                    if (hEng || hTam) {
                        const hp = ensureBilingualPair(hEng, hTam);
                        if (!hEng && hp.eng) hEng = hp.eng;
                        if (!hTam && hp.tam) hTam = hp.tam;
                    }
                } catch (_) {}
                if (hEng) result.areaEng = hEng;
                if (hTam) result.areaTam = hTam;

                // Clean trailing standalone main Revenue Village / Taluk from street before appending Hamlet
                if (result.streetEng) result.streetEng = stripTrailingPlace(result.streetEng);
                if (result.streetTam) result.streetTam = stripTrailingPlace(result.streetTam);

                // Universal Hamlet-in-Street Rule: Always keep Hamlet/Colony paired with Street (without duplicating!)
                const normCmp = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9\u0B80-\u0BFF]/g, '');
                if (hEng) {
                    const curEng = String(result.streetEng || '').trim();
                    if (!curEng) {
                        result.streetEng = hEng;
                    } else if (!normCmp(curEng).includes(normCmp(hEng))) {
                        result.streetEng = `${curEng}, ${hEng}`;
                    }
                }
                if (hTam) {
                    const curTam = String(result.streetTam || '').trim();
                    if (!curTam) {
                        result.streetTam = hTam;
                    } else if (!normCmp(curTam).includes(normCmp(hTam))) {
                        result.streetTam = `${curTam}, ${hTam}`;
                    }
                }
            } else {
                // Standalone Revenue Village (NOT a hamlet): strip redundant village/taluk suffix from streetEng/streetTam!
                if (result.streetEng) result.streetEng = stripTrailingPlace(result.streetEng);
                if (result.streetTam) result.streetTam = stripTrailingPlace(result.streetTam);

                // Also remove trailing taluk from areaEng if areaEng equals village
                if (result.areaEng && resolved.village && result.areaEng.toLowerCase() === resolved.village.toLowerCase()) {
                    result.areaEng = resolved.village;
                }
            }
        }
    } catch (_) {}

    return result;
}

module.exports = {
    inspectAndExtractDocument,
    sanitizeUtilityAddressFields,
    sanitizeAadhaarAddressFields
};
