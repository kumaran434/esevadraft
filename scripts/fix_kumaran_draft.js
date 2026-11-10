const fs = require('fs');
const path = require('path');
const { saveCitizenDraft } = require('../firestore_db');
let saveCitizenProfile;
try {
    saveCitizenProfile = require('../database').saveCitizenProfile;
} catch (_) {}

async function fixDraft() {
    const mobile = '9790170026';
    const appDataUploads = path.join(process.env.APPDATA || 'C:\\Users\\ADMIN\\AppData\\Roaming', 'esevadraft-desktop', 'data', 'uploads', mobile);
    const workspaceUploads = path.join(__dirname, '..', 'data', 'uploads', mobile);

    // Ensure uploads exist in both directories
    for (const d of [appDataUploads, workspaceUploads]) {
        if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    }

    const photoSrc = fs.existsSync(path.join(appDataUploads, 'photo.jpg')) ? path.join(appDataUploads, 'photo.jpg') : path.join(workspaceUploads, 'photo.jpg');
    const aadhaarSrc = fs.existsSync(path.join(appDataUploads, 'aadhaar.jpg')) ? path.join(appDataUploads, 'aadhaar.jpg') : path.join(workspaceUploads, 'aadhaar.jpg');
    const gasSrc = fs.existsSync(path.join(appDataUploads, 'gas.jpg')) ? path.join(appDataUploads, 'gas.jpg') : path.join(workspaceUploads, 'gas.jpg');

    // Cross-copy so both locations have all three files
    for (const [src, name] of [[photoSrc, 'photo.jpg'], [aadhaarSrc, 'aadhaar.jpg'], [gasSrc, 'gas.jpg']]) {
        if (fs.existsSync(src)) {
            const dest1 = path.join(appDataUploads, name);
            const dest2 = path.join(workspaceUploads, name);
            if (!fs.existsSync(dest1) || fs.statSync(dest1).size === 0) fs.copyFileSync(src, dest1);
            if (!fs.existsSync(dest2) || fs.statSync(dest2).size === 0) fs.copyFileSync(src, dest2);
        }
    }

    const photoPath = path.join(appDataUploads, 'photo.jpg');
    const aadhaarPath = path.join(appDataUploads, 'aadhaar.jpg');
    const gasPath = path.join(appDataUploads, 'gas.jpg');

    const photoB64 = fs.existsSync(photoPath) ? fs.readFileSync(photoPath).toString('base64') : '';
    const aadhaarB64 = fs.existsSync(aadhaarPath) ? fs.readFileSync(aadhaarPath).toString('base64') : '';
    const gasB64 = fs.existsSync(gasPath) ? fs.readFileSync(gasPath).toString('base64') : '';

    const citizenProfile = {
        fullNameTam: 'குமரன் கி',
        fullNameEng: 'Kumaran K',
        fatherNameTam: 'கிருபாகரன்',
        fatherNameEng: 'Kirubakaran',
        headDob: '10/06/1993',
        headGender: 'Male',
        headGenderTam: 'ஆண்',
        headAadhaar: '575567662931',
        mobileNumber: mobile,
        doorNo: '216',
        streetTam: 'மேட்டு தெரு',
        streetEng: 'METTU STREET',
        areaTam: 'நரசிங்கபுரம், மின்னல்',
        areaEng: 'NARASINGAPURAM, MINNAL',
        district: 'Ranipet',
        districtTam: 'இராணிப்பேட்டை',
        taluk: 'Arakkonam',
        talukTam: 'அரக்கோணம்',
        village: 'Minnal',
        villageTam: 'மின்னல்',
        pincode: '632510',
        monthlyIncome: '3000',
        occupation: 'தனியார் ஊழியர்',
        occupationTam: 'தனியார் ஊழியர்',
        cardType: 'Rice',
        cardTypeTam: 'அரிசி அட்டை',
        headPhotoPath: photoPath,
        headAadhaarDocPath: aadhaarPath,
        members: [
            {
                nameTam: 'குமரன் கி',
                nameEng: 'Kumaran K',
                dob: '10/06/1993',
                gender: 'Male',
                genderTam: 'ஆண்',
                relationship: 'Head',
                relationshipTam: 'குடும்பத் தலைவர்',
                aadhaarNumber: '575567662931',
                docPath: aadhaarPath
            }
        ],
        gasDetails: {
            hasGas: true,
            consumerName: 'குமரன் கி',
            oilCompany: 'IOC',
            oilCompanyDisplay: 'Indane Gas (IOCL)',
            consumerNumber: '216',
            agencyName: 'Indane Gas Agency',
            cylinders: '1',
            gasBookPath: gasPath
        },
        residenceProof: {
            type: 'GAS_BOOK',
            typeTam: 'எரிவாயு நுகர்வோர் அட்டை',
            docPath: gasPath
        },
        documents: {
            profilePhoto: photoPath,
            headAadhaar: aadhaarPath,
            gasBook: gasPath,
            residenceProof: gasPath
        },
        base64Docs: {
            profilePhotoBase64: photoB64,
            profilePhotoName: 'photo.jpg',
            headAadhaarBase64: aadhaarB64,
            headAadhaarName: 'aadhaar.jpg',
            gasBookBase64: gasB64,
            gasBookName: 'gas.jpg',
            residenceProofBase64: gasB64,
            residenceProofName: 'gas.jpg'
        }
    };

    const draftData = {
        name: 'குமரன் கி',
        mobileNumber: mobile,
        operatorUid: 'local_op_dev',
        operatorName: 'குமரன் இ-சேவை மையம்',
        citizenProfile: citizenProfile,
        documents: {
            profilePhoto: photoPath,
            headAadhaar: aadhaarPath,
            gasBook: gasPath,
            residenceProof: gasPath
        },
        base64Docs: citizenProfile.base64Docs,
        intakeState: 'SERVICE_SELECTION',
        step: 'SERVICE_SELECTION',
        status: 'DRAFT_SAVED',
        chatHistory: [
            {
                sender: 'bot',
                text: 'வணக்கம் திரு/திருமதி **குமரன் கி**! (+91 9790170026) 🙏\n\n🏛️ **eSevaDraft தமிழ்நாடு அரசு சேவைகள் ஏஐ நேரடி மையத்திற்கு வரவேற்கிறோம்!**\n\nவாடிக்கையாளர் இன்று எந்த அரசு சேவைக்கு விண்ணப்பிக்க விரும்புகிறார்?\n\nகீழே உள்ள அரசு சேவைகளில் ஒன்றைத் தேர்ந்தெடுக்கவும்:',
                options: [
                    { label: "🏛️ புதிய குடும்ப அட்டை (New Ration Card)", value: "புதிய ரேஷன் கார்டு" },
                    { label: "👨‍👩‍👧 குடும்ப அட்டை சேவைகள் (Ration Card Services)", value: "ரேஷன் கார்டு" },
                    { label: "📜 வருமானச் சான்றிதழ் (Income Certificate)", value: "வருமானச் சான்றிதழ்" },
                    { label: "🏠 இருப்பிடச் சான்றிதழ் (Residence Certificate)", value: "இருப்பிடச் சான்றிதழ்" },
                    { label: "🗳️ புதிய வாக்காளர் அட்டை (New Voter ID)", value: "புதிய வாக்காளர் அட்டை" }
                ]
            }
        ],
        lastUpdated: new Date().toISOString()
    };

    console.log('Saving profile...');
    if (typeof saveCitizenProfile === 'function') saveCitizenProfile(mobile, citizenProfile);

    console.log('Saving draft via saveCitizenDraft...');
    await saveCitizenDraft(mobile, draftData);

    // Save directly to AppData drafts as well
    const appDataDraftsDir = path.join(process.env.APPDATA || 'C:\\Users\\ADMIN\\AppData\\Roaming', 'esevadraft-desktop', 'data', 'drafts');
    if (!fs.existsSync(appDataDraftsDir)) fs.mkdirSync(appDataDraftsDir, { recursive: true });
    fs.writeFileSync(path.join(appDataDraftsDir, `${mobile}.json`), JSON.stringify(draftData, null, 2), 'utf8');

    // Save to workspace data/drafts
    const wsDraftsDir = path.join(__dirname, '..', 'data', 'drafts');
    if (!fs.existsSync(wsDraftsDir)) fs.mkdirSync(wsDraftsDir, { recursive: true });
    fs.writeFileSync(path.join(wsDraftsDir, `${mobile}.json`), JSON.stringify(draftData, null, 2), 'utf8');

    console.log('✅ Kumaran draft 100% saved to all locations with gas details & documents!');
}

fixDraft().catch(console.error);
