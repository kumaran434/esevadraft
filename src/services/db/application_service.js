/**
 * eSevaDraft Application Service
 * Manages isolated government service application instances.
 * Adheres to Golden Rule 1 (Purpose-Driven Functional Modularity).
 */

const fs = require('fs');
const path = require('path');
const { normalizeCleanMobile } = require('./citizen_master_service');

const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data');
const APPS_DIR = path.join(DATA_DIR, 'applications');

if (!fs.existsSync(APPS_DIR)) {
    try { fs.mkdirSync(APPS_DIR, { recursive: true }); } catch (_) {}
}

const SERVICE_TITLES_TAMIL = {
    'RATION_NEW': 'புதிய குடும்ப அட்டை',
    'INCOME_CERT': 'வருமானச் சான்றிதழ்',
    'COMMUNITY_CERT': 'சாதிச் சான்றிதழ்',
    'RESIDENCE_CERT': 'இருப்பிடச் சான்றிதழ்',
    'FIRST_GRADUATE': 'முதல் பட்டதாரி சான்றிதழ்',
    'REMOVE_MEMBER': 'குடும்ப உறுப்பினர் நீக்கம்',
    'ADD_MEMBER': 'குடும்ப உறுப்பினர் சேர்க்கை',
    'CHANGE_ADDRESS': 'குடும்ப அட்டை முகவரி மாற்றம்',
    'CHANGE_HEAD': 'குடும்பத் தலைவர் மாற்றம்',
    'VOTER_ID': 'புதிய வாக்காளர் அட்டை'
};

function generateAppId(mobileNumber, serviceCode) {
    const cleanMob = normalizeCleanMobile(mobileNumber) || 'anonymous';
    const sCode = (serviceCode || 'SERVICE').toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    return `APP_${cleanMob}_${sCode}_${Date.now()}`;
}

function getAppFilePath(appId) {
    if (!appId) return null;
    return path.join(APPS_DIR, `${appId}.json`);
}

/**
 * Creates a brand new, isolated application for a citizen.
 */
function createApplication(mobileNumber, serviceCode, masterProfile = {}, initialData = {}) {
    const cleanMob = normalizeCleanMobile(mobileNumber);
    const appId = generateAppId(cleanMob, serviceCode);
    const serviceNameTam = SERVICE_TITLES_TAMIL[serviceCode] || serviceCode || 'அரசு சேவை';

    const app = {
        appId,
        mobileNumber: cleanMob,
        serviceCode: serviceCode.toUpperCase(),
        serviceNameTam,
        status: 'DRAFT',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        portalReferenceNumber: null,
        receiptPdfPath: null,
        // Inherit standard master profile fields without polluting them
        citizenName: masterProfile.fullNameTam || masterProfile.fullNameEng || '',
        headAadhaar: masterProfile.headAadhaar || masterProfile.aadhaarNumber || '',
        address: {
            doorNo: masterProfile.doorNo || '',
            streetTam: masterProfile.streetTam || masterProfile.streetEng || '',
            village: masterProfile.village || '',
            taluk: masterProfile.taluk || '',
            district: masterProfile.district || '',
            pincode: masterProfile.pincode || ''
        },
        // Isolated documents & form data strictly for THIS application
        documents: { ...(initialData.documents || {}) },
        formData: { ...(initialData.formData || {}) }
    };

    saveApplication(appId, app);
    return app;
}

function saveApplication(appId, appData) {
    if (!appId || !appData) return null;
    const filePath = getAppFilePath(appId);
    const updated = {
        ...appData,
        appId,
        updatedAt: new Date().toISOString()
    };
    try {
        fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), 'utf8');
        return updated;
    } catch (_) {
        return null;
    }
}

function getApplication(appId) {
    if (!appId) return null;
    const filePath = getAppFilePath(appId);
    if (!filePath || !fs.existsSync(filePath)) return null;
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (_) {
        return null;
    }
}

function listCitizenApplications(mobileNumber) {
    const cleanMob = normalizeCleanMobile(mobileNumber);
    if (!cleanMob || !fs.existsSync(APPS_DIR)) return [];
    const list = [];
    try {
        const files = fs.readdirSync(APPS_DIR);
        for (const f of files) {
            if (f.startsWith(`APP_${cleanMob}_`) && f.endsWith('.json')) {
                try {
                    const data = JSON.parse(fs.readFileSync(path.join(APPS_DIR, f), 'utf8'));
                    if (data && data.appId) list.push(data);
                } catch (_) {}
            }
        }
    } catch (_) {}
    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

module.exports = {
    SERVICE_TITLES_TAMIL,
    generateAppId,
    createApplication,
    saveApplication,
    getApplication,
    listCitizenApplications
};
