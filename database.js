const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const dbFilePath = path.join(dataDir, 'citizens.json');

// Clean fresh initial database (no demo data)
const initialDatabase = {};

function loadDatabase() {
    try {
        if (!fs.existsSync(dbFilePath)) {
            fs.writeFileSync(dbFilePath, JSON.stringify(initialDatabase, null, 2), 'utf-8');
            return initialDatabase;
        }
        const data = fs.readFileSync(dbFilePath, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        console.error('Error loading database:', e.message);
        return initialDatabase;
    }
}

function saveDatabase(db) {
    try {
        fs.writeFileSync(dbFilePath, JSON.stringify(db, null, 2), 'utf-8');
        return true;
    } catch (e) {
        console.error('Error saving database:', e.message);
        return false;
    }
}

function getCitizenProfile(mobileNumber) {
    const db = loadDatabase();
    return db[mobileNumber] || null;
}

const { resolveTnDistrict } = require('./tn_district_mapper');

function saveCitizenProfile(mobileNumber, profileData) {
    const db = loadDatabase();
    const cleanData = { ...profileData };
    if (cleanData.district || cleanData.taluk || cleanData.village || cleanData.pincode) {
        const resolved = resolveTnDistrict(cleanData.district, cleanData.taluk, cleanData.village, cleanData.pincode);
        cleanData.district = resolved.district;
        cleanData.districtTam = resolved.districtTam;
        if (resolved.taluk) cleanData.taluk = resolved.taluk;
    }
    db[mobileNumber] = {
        ...(db[mobileNumber] || {}),
        ...cleanData,
        isExtracted: true,
        lastUpdated: new Date().toISOString()
    };
    saveDatabase(db);
    return db[mobileNumber];
}

function addFamilyMember(mobileNumber, memberData) {
    const db = loadDatabase();
    if (!db[mobileNumber]) return null;
    if (!db[mobileNumber].members) db[mobileNumber].members = [];
    db[mobileNumber].members.push(memberData);
    db[mobileNumber].lastUpdated = new Date().toISOString();
    saveDatabase(db);
    return db[mobileNumber];
}

function getCitizenDocuments(mobileNumber) {
    const profile = getCitizenProfile(mobileNumber);
    if (!profile) return [];
    
    const docs = [];
    if (profile.headPhotoPath && fs.existsSync(profile.headPhotoPath)) {
        docs.push({
            id: 'photo',
            title: 'அரசு பாஸ்போர்ட் புகைப்படம்',
            type: 'image/png',
            filename: path.basename(profile.headPhotoPath),
            path: profile.headPhotoPath
        });
    }

    const uploadsDir = path.join(__dirname, 'uploads');
    const files = fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir) : [];
    
    // Find generated A4 PDFs
    files.filter(f => f.endsWith('.pdf')).forEach((pdfFile, idx) => {
        docs.push({
            id: `pdf_${idx}`,
            title: pdfFile.includes('aadhaar') ? 'அதிகாரப்பூர்வ ஆதார் A4 PDF' : (pdfFile.includes('gas') ? 'எரிவாயு இணைப்பு PDF' : 'அரசு ஆவண PDF'),
            type: 'application/pdf',
            filename: pdfFile,
            path: path.join(uploadsDir, pdfFile)
        });
    });

    return docs;
}

function getAllCitizensSummary() {
    const db = loadDatabase();
    const citizens = Object.values(db);
    return {
        totalCitizens: citizens.length,
        totalApplicationsSubmitted: citizens.filter(c => c.applicationNumber || c.isSubmitted).length,
        citizensList: citizens.map(c => ({
            name: c.fullNameTam || c.fullNameEng,
            mobile: c.mobileNumber,
            aadhaar: c.headAadhaar,
            district: c.district,
            lastUpdated: c.lastUpdated
        }))
    };
}

module.exports = {
    getCitizenProfile,
    saveCitizenProfile,
    addFamilyMember,
    getCitizenDocuments,
    getAllCitizensSummary,
    loadDatabase
};
