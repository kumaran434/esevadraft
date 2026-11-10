const express = require('express');
const router = express.Router();

const { 
    getUserProfile, 
    saveUserProfile, 
    deleteUserProfile,
    getCitizenDraft, 
    saveCitizenDraft,
    logOperatorError 
} = require('../../firestore_db');

const {
    SERVICE_OPTIONS,
    RATION_CARD_SERVICE_OPTIONS,
    MEMBER_COUNT_OPTIONS,
    handleServiceSelection
} = require('../core/chat_fsm');
const { handleNewRationCardIntake } = require('../core/fsm/fsm_new_card_intake');
const { advanceTnegaIncomeFlow } = require('../core/fsm/tnega_flow_engine');

const storageService = require('../services/storage_service');
const { 
    sessions, 
    createFreshProfile, 
    setActiveSession, 
    persistSessions 
} = storageService;

const { downloadTnpdsApplicationPdf } = require('../../tnpds_automation');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getCitizenProfile, saveCitizenProfile } = require('../../database');
const { inspectAndExtractDocument } = require('../../ai_document_extractor');
const { lookupCitizen, saveCitizenMaster, normalizeCleanMobile, normalizeCleanAadhaar } = require('../services/db/citizen_master_service');
const { createApplication, listCitizenApplications, saveApplication } = require('../services/db/application_service');
const { evaluateServiceReadiness } = require('../services/service_requirements');

const { 
    saveOperatorPortalCredentials,
    getOperatorVaultSummary,
    deleteOperatorPortalCredentials,
    getOperatorPortalCredentials
} = require('../services/portal_vault_service');

const uploadDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + file.originalname.replace(/\s+/g, '_');
        cb(null, uniqueSuffix);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 15 * 1024 * 1024 }
});

function normalizeOperatorUid(uid) {
    if (!uid) return null;
    return String(uid).trim();
}

// 0. POST /api/operator/search-citizen (Universal Multi-Factor: Mobile, Aadhaar, Smart Card)
router.post('/api/operator/search-citizen', async (req, res) => {
    try {
        const query = (req.body.query || req.body.mobileNumber || req.body.aadhaarNumber || '').trim();
        if (!query) return res.status(400).json({ success: false, error: 'தேடல் எண் தேவை (10-இலக்க மொபைல் அல்லது 12-இலக்க ஆதார்)' });
        
        const lookup = lookupCitizen(query);
        if (!lookup || !lookup.citizen) {
            return res.json({ success: true, found: false });
        }

        const citizen = lookup.citizen;
        const mob = lookup.mobileNumber;
        const apps = listCitizenApplications(mob);

        return res.json({
            success: true,
            found: true,
            foundBy: lookup.foundBy,
            mobileNumber: mob,
            matchedMember: lookup.matchedMember || null,
            citizenProfile: citizen,
            applications: apps,
            displayName: citizen.fullNameTam || citizen.fullNameEng || 'வாடிக்கையாளர்',
            aadhaarNumber: citizen.headAadhaar || citizen.aadhaarNumber || (lookup.matchedMember ? lookup.matchedMember.aadhaarNumber : '')
        });
    } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
    }
});

// 1. POST /api/operator/new-customer
router.post('/api/operator/new-customer', async (req, res) => {
    const customerMobile = req.body.customerMobile || req.body.mobileNumber || req.body.mobile;
    const serviceName = req.body.serviceName || req.body.service;
    const { customerName, operatorName, operatorMobile, isWalkin } = req.body;
    const operatorUid = req.body.operatorUid || req.headers['x-operator-uid'] || req.query.operatorUid || null;
    const isTempWalkin = isWalkin === true || !customerMobile || String(customerMobile).startsWith('walkin_');
    let cleanMobile = '';

    if (isTempWalkin) {
        cleanMobile = (customerMobile && String(customerMobile).startsWith('walkin_')) ? customerMobile : `walkin_${Date.now()}`;
    } else {
        cleanMobile = (customerMobile || '').replace(/\D/g, '');
        if (cleanMobile.length === 12 && cleanMobile.startsWith('91')) {
            cleanMobile = cleanMobile.slice(2);
        }
        if (cleanMobile.length !== 10 || !['6', '7', '8', '9'].includes(cleanMobile[0])) {
            return res.status(400).json({ error: 'சரியான 10-இலக்க வாடிக்கையாளர் மொபைல் எண்ணை உள்ளிடவும்.' });
        }
    }

    const initialName = (customerName || '').trim();
    if (cleanMobile && sessions.has(cleanMobile)) {
        sessions.delete(cleanMobile);
    }
    const sess = setActiveSession(cleanMobile);
    sess.operatorUid = operatorUid || null;
    sess.operatorName = operatorName || null;
    sess.operatorMobile = operatorMobile || null;
    sess.role = 'citizen';
    sess.isTempWalkin = isTempWalkin;

    let existingDraft = null;
    if (!isTempWalkin && cleanMobile) {
        try {
            existingDraft = await getCitizenDraft(cleanMobile);
        } catch (e) {}
    }

    let masterCitizen = null;
    if (!isTempWalkin && cleanMobile) {
        try {
            const masterLookup = lookupCitizen(cleanMobile);
            if (masterLookup && masterLookup.citizen) {
                masterCitizen = masterLookup.citizen;
            }
        } catch (_) {}
    }

    if (existingDraft && !existingDraft.isDeleted && existingDraft.status !== 'TRASHED' && existingDraft.citizenProfile) {
        const existingOp = normalizeOperatorUid(existingDraft.operatorUid);
        const incomingOp = normalizeOperatorUid(operatorUid);
        const existingMob = (existingDraft.operatorMobile || '').trim();
        const incomingMob = (operatorMobile || '').trim();
        const existingName = (existingDraft.operatorName || '').trim().toLowerCase();
        const incomingName = (operatorName || '').trim().toLowerCase();

        // STRICT TENANT BOUNDARY:
        // If the draft has an owner and the incoming operator UID does not match, ACCESS IS STRICTLY FORBIDDEN!
        let isSameOperator = true;
        if (existingOp && incomingOp && existingOp !== incomingOp) {
            isSameOperator = false;
        } else if (existingOp && !incomingOp) {
            // Draft belongs to an operator, but requester is unauthenticated
            isSameOperator = false;
        }

        if (!isSameOperator) {
            return res.status(403).json({ 
                error: `இந்த வாடிக்கையாளர் (${cleanMobile}) ஏற்கெனவே மற்றொரு இ-சேவை மையத்தால் (${existingDraft.operatorName || 'வேறு மையம்'}) பதிவு செய்யப்பட்டுள்ளது. விவரங்கள் பாதுகாக்கப்பட்டுள்ளன.` 
            });
        }

        if (incomingOp) sess.operatorUid = incomingOp;
        if (operatorName) sess.operatorName = operatorName;
        if (operatorMobile) sess.operatorMobile = operatorMobile;

        sess.citizenProfile = { ...(masterCitizen || {}), ...existingDraft.citizenProfile };
        if (!serviceName) {
            sess.subService = null;
            sess.subServiceData = null;
            sess.citizenProfile.subService = null;
            sess.citizenProfile.subServiceData = null;
        }
        if (initialName && !sess.citizenProfile.fullNameTam) {
            sess.citizenProfile.fullNameTam = initialName;
        }
        if (existingDraft.applicationNumber && !serviceName) {
            sess.applicationNumber = existingDraft.applicationNumber;
        } else {
            sess.applicationNumber = null;
            sess.applicationPdfUrl = null;
        }
    } else if (masterCitizen) {
        sess.citizenProfile = {
            ...createFreshProfile(cleanMobile),
            ...masterCitizen,
            mobileNumber: cleanMobile
        };
        if (initialName && !sess.citizenProfile.fullNameTam) {
            sess.citizenProfile.fullNameTam = initialName;
        }
        sess.subService = null;
        sess.subServiceData = null;
        sess.applicationNumber = null;
        sess.applicationPdfUrl = null;
        if (masterCitizen.documents) {
            sess.tempUploads = { ...masterCitizen.documents, ...sess.tempUploads };
        }
    } else {
        sess.citizenProfile = createFreshProfile(cleanMobile);
        sess.subService = null;
        sess.subServiceData = null;
        sess.citizenProfile.fullNameTam = initialName;
        sess.citizenProfile.fullNameEng = initialName;
        sess.citizenProfile.mobileNumber = isTempWalkin ? '' : cleanMobile;
        sess.applicationNumber = null;
        sess.applicationPdfUrl = null;
    }
    sess.targetMemberCount = (sess.citizenProfile.members && sess.citizenProfile.members.length) || 1;
    sess.currentMemberIdx = 1;
    sess.step = 'intake';
    sess.tempUploads = { ...((existingDraft && existingDraft.documents) || (existingDraft && existingDraft.citizenProfile && existingDraft.citizenProfile.documents) || (masterCitizen && masterCitizen.documents) || {}) };
    sess.tempMember = null;
    if (sess.citizenProfile) sess.citizenProfile.tempMember = null;

    const phoneDisplay = isTempWalkin ? '' : ` (+91 ${cleanMobile})`;
    const resolvedName = (sess.citizenProfile && (sess.citizenProfile.fullNameTam || sess.citizenProfile.fullNameEng)) || initialName || '';
    const displayName = resolvedName ? `திரு/திருமதி **${resolvedName}**` : `வாடிக்கையாளர்`;

    const sLower = (serviceName || '').toLowerCase();
    const isAddMember = serviceName === 'உறுப்பினர் சேர்க்கை' || serviceName === 'குடும்ப உறுப்பினர் சேர்க்கை' || serviceName === 'ADD_MEMBER' || sLower.includes('add member') || sLower.includes('உறுப்பினர்');
    const isChangeAddress = serviceName === 'முகவரி மாற்றம்' || serviceName === 'குடும்ப அட்டை முகவரி மாற்றம்' || serviceName === 'CHANGE_ADDRESS' || sLower.includes('change address') || sLower.includes('முகவரி');
    const isNewRation = !isAddMember && !isChangeAddress && (serviceName === 'புதிய ரேஷன் கார்டு' || serviceName === 'புதிய குடும்ப அட்டை' || sLower.includes('new ration') || (serviceName && serviceName.includes('புதிய ரேஷன்')));
    const isRationGeneric = !isAddMember && !isChangeAddress && !isNewRation && (serviceName === 'ரேஷன் கார்டு' || sLower === 'ration' || sLower === 'ration card' || (serviceName && serviceName.includes('ரேஷன்')));
    const isIncome = serviceName === 'வருமானச் சான்றிதழ்' || sLower.includes('income') || (serviceName && serviceName.includes('வருமானம்'));
    const isResidence = serviceName === 'இருப்பிடச் சான்றிதழ்' || sLower.includes('residence') || (serviceName && serviceName.includes('இருப்பிடம்'));
    const isCommunity = serviceName === 'சாதிச் சான்றிதழ்' || sLower.includes('community') || (serviceName && serviceName.includes('சாதி'));
    const isVoter = serviceName === 'புதிய வாக்காளர் அட்டை' || sLower.includes('voter') || (serviceName && serviceName.includes('வாக்காளர்'));

    const { isProfileDataComplete } = require('../services/profile_helpers');
    const isProfileComplete = isProfileDataComplete(sess.citizenProfile, sess.tempUploads);

    if (isAddMember) {
        sess.subService = 'ADD_MEMBER';
        sess.subServiceData = sess.subServiceData || {};
        if (sess.citizenProfile?.rationCardNo) {
            sess.subServiceData.rationCardNo = sess.citizenProfile.rationCardNo;
        }
        if (sess.citizenProfile?.district) sess.subServiceData.district = sess.citizenProfile.district;
        if (sess.citizenProfile?.taluk) sess.subServiceData.taluk = sess.citizenProfile.taluk;
        if (sess.citizenProfile?.village) sess.subServiceData.village = sess.citizenProfile.village;
        sess.chatHistory = [];
        handleServiceSelection('குடும்ப உறுப்பினர் சேர்க்க', sess);
    } else if (isChangeAddress) {
        sess.subService = 'CHANGE_ADDRESS';
        sess.subServiceData = sess.subServiceData || {};
        sess.chatHistory = [];
        handleServiceSelection('முகவரி மாற்றம்', sess);
    } else if (isNewRation) {
        sess.subService = 'NEW_CARD';
        sess.subServiceData = null;
        if (sess.citizenProfile) {
            sess.citizenProfile.subService = 'NEW_CARD';
            sess.citizenProfile.subServiceData = null;
        }
        sess.chatHistory = [];
        handleNewRationCardIntake(sess);
        if (sess.intakeState === 'MEMBER_COUNT' && sess.chatHistory.length > 0) {
            sess.chatHistory[0].text = `வணக்கம் ${displayName}!${phoneDisplay} 🙏\n\n` + sess.chatHistory[0].text;
        }
    } else if (isRationGeneric) {
        sess.intakeState = 'RATION_CARD_SERVICES';
        sess.step = 'RATION_CARD_SERVICES';
        sess.chatHistory = [{
            sender: 'bot',
            text: `வணக்கம் ${displayName}!${phoneDisplay} 🙏\n\n` +
                  `🏛️ **குடும்ப அட்டை (Ration Card) சேவைகள்**\n\n` +
                  `நீங்கள் குடும்ப அட்டையில் எந்த சேவையைச் செய்ய விரும்புகிறீர்கள்?\n\n` +
                  `கீழே உள்ள விருப்பங்களில் ஒன்றைத் தேர்ந்தெடுக்கவும்:`,
            options: RATION_CARD_SERVICE_OPTIONS
        }];
    } else if (isIncome) {
        sess.subService = 'INCOME';
        if (sess.citizenProfile) {
            sess.citizenProfile.subService = 'INCOME';
            delete sess.citizenProfile.familyMemberCount;
            delete sess.citizenProfile.annualIncome;
            delete sess.citizenProfile.profession;
            delete sess.citizenProfile.incomeMembers;
        }
        delete sess.annualIncome;
        delete sess.profession;
        delete sess.familyMemberCount;
        delete sess.incomeMembers;
        sess.intakeState = 'INCOME_INTAKE';
        try { createApplication(cleanMobile, 'INCOME_CERT', sess.citizenProfile); } catch (_) {}
        const flowStep = advanceTnegaIncomeFlow(sess, `வணக்கம் ${displayName}!${phoneDisplay} 🙏`);
        sess.chatHistory = [{
            sender: 'bot',
            text: flowStep.text,
            options: flowStep.options
        }];
    } else if (isResidence) {
        sess.subService = 'RESIDENCE';
        if (sess.citizenProfile) {
            sess.citizenProfile.subService = 'RESIDENCE';
            delete sess.citizenProfile.yearsOfResidence;
            delete sess.citizenProfile.purposeOfCertificate;
        }
        delete sess.yearsOfResidence;
        delete sess.purposeOfCertificate;
        sess.intakeState = 'RESIDENCE_INTAKE';
        try { createApplication(cleanMobile, 'RESIDENCE_CERT', sess.citizenProfile); } catch (_) {}
        const { advanceTnegaResidenceFlow } = require('../core/fsm/tnega_flow_engine');
        const flowStep = advanceTnegaResidenceFlow(sess, `வணக்கம் ${displayName}!${phoneDisplay} 🙏`);
        sess.chatHistory = [{
            sender: 'bot',
            text: flowStep.text,
            options: flowStep.options
        }];
    } else if (isCommunity) {
        sess.subService = 'COMMUNITY';
        if (sess.citizenProfile) {
            sess.citizenProfile.subService = 'COMMUNITY';
            delete sess.citizenProfile.caste;
            delete sess.citizenProfile.communityProof;
            delete sess.citizenProfile.communityProofSkipped;
        }
        delete sess.caste;
        delete sess.communityProof;
        delete sess.communityProofSkipped;
        sess.intakeState = 'COMMUNITY_INTAKE';
        try { createApplication(cleanMobile, 'COMMUNITY_CERT', sess.citizenProfile); } catch (_) {}
        const { advanceTnegaCommunityFlow } = require('../core/fsm/tnega_flow_engine');
        const flowStep = advanceTnegaCommunityFlow(sess, `வணக்கம் ${displayName}!${phoneDisplay} 🙏`);
        sess.chatHistory = [{
            sender: 'bot',
            text: flowStep.text,
            options: flowStep.options
        }];
    } else if (isVoter) {
        sess.intakeState = 'VOTER_INTAKE';
        sess.chatHistory = [{
            sender: 'bot',
            text: `வணக்கம் ${displayName}!${phoneDisplay} 🙏\n\n` +
                  `🗳️ **புதிய வாக்காளர் அட்டை (New Voter ID) விண்ணப்பத்திற்கு வரவேற்கிறோம்!**\n\n` +
                  `விண்ணப்பதாரரின் ஆதார் அட்டை அல்லது பிறப்புச் சான்றிதழைப் பதிவேற்றவும்:`,
            options: [
                { label: "📷 ஆதார் அட்டை பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" }
            ]
        }];
    } else {
        sess.subService = null;
        sess.subServiceData = null;
        if (sess.citizenProfile) {
            sess.citizenProfile.subService = null;
            sess.citizenProfile.subServiceData = null;
        }
        sess.intakeState = 'SERVICE_SELECTION';
        sess.step = 'SERVICE_SELECTION';
        sess.chatHistory = [{
            sender: 'bot',
            text: `வணக்கம் ${displayName}!${phoneDisplay} 🙏\n\n` +
                  `🏛️ **eSevaDraft தமிழ்நாடு அரசு சேவைகள் ஏஐ நேரடி மையத்திற்கு வரவேற்கிறோம்!**\n\n` +
                  `வாடிக்கையாளர் இன்று எந்த அரசு சேவைக்கு விண்ணப்பிக்க விரும்புகிறார்?\n\n` +
                  `கீழே உள்ள அரசு சேவைகளில் ஒன்றைத் தேர்ந்தெடுக்கவும்:`,
            options: SERVICE_OPTIONS
        }];
    }

    if (!isTempWalkin) {
        try {
            await saveCitizenDraft(cleanMobile, {
                operatorUid,
                operatorName,
                operatorMobile,
                citizenProfile: sess.citizenProfile,
                subService: sess.subService || null,
                subServiceData: sess.subServiceData || null,
                documents: (existingDraft && existingDraft.documents) || {},
                chatHistory: sess.chatHistory,
                intakeState: sess.intakeState || 'SERVICE_SELECTION',
                step: sess.intakeState || sess.step || 'SERVICE_SELECTION',
                status: 'DRAFT_SAVED'
            });
            saveCitizenMaster(cleanMobile, sess.citizenProfile);
            persistSessions();
        } catch (e) {}
    }

    const lastBotMsg = (sess.chatHistory && sess.chatHistory.length > 0) ? sess.chatHistory[sess.chatHistory.length - 1] : {};
    res.json({
        success: true,
        customerMobile: cleanMobile,
        isWalkin: isTempWalkin,
        customerName: initialName,
        citizenProfile: sess.citizenProfile,
        chatHistory: sess.chatHistory,
        intakeState: sess.intakeState,
        step: sess.intakeState || sess.step,
        actionRequired: lastBotMsg.actionRequired,
        uploadType: lastBotMsg.uploadType,
        uploadPrompt: lastBotMsg.uploadPrompt,
        options: lastBotMsg.options
    });
});

// 2. POST /api/operator/telemetry-log
router.post('/api/operator/telemetry-log', async (req, res) => {
    try {
        const body = req.body || {};
        const { event, details, mobile, type, message, filename, lineno, colno, stack, reason } = body;
        const errType = type || event || 'CLIENT_TELEMETRY';
        const errMsg = message || reason || (typeof details === 'string' ? details : JSON.stringify(details || {}));
        
        console.log(`📡 [Operator Telemetry] [${errType}] Customer: ${mobile || body.activeMobile || 'N/A'} - ${errMsg}`);
        
        // Write to persistent telemetry log file on disk
        const logLine = `[${new Date().toISOString()}] [${errType}] ${JSON.stringify(body)}\n`;
        const logFilePath = path.join(__dirname, '..', '..', 'public', 'logs', 'client_errors.log');
        try {
            fs.appendFileSync(logFilePath, logLine, 'utf8');
        } catch (_) {}

        // Write structured latest_ui_error.json for instant local AI error diagnostics
        const latestUiErrorPath = path.join(__dirname, '..', '..', 'data', 'telemetry', 'latest_ui_error.json');
        try {
            fs.mkdirSync(path.dirname(latestUiErrorPath), { recursive: true });
            fs.writeFileSync(latestUiErrorPath, JSON.stringify({
                timestamp: new Date().toISOString(),
                type: errType,
                message: errMsg,
                customerMobile: mobile || body.activeMobile || '',
                role: body.role || 'operator',
                stack: stack || null,
                details: body
            }, null, 2), 'utf8');
        } catch (_) {}

        if (typeof logOperatorError === 'function') {
            await logOperatorError({
                errorType: errType,
                errorMessage: errMsg,
                errorStack: stack || `${filename || ''}:${lineno || ''}:${colno || ''}`,
                customerMobile: mobile || body.activeMobile || '',
                operatorMobile: body.role === 'operator' ? (body.activeMobile || '') : '',
                extraInfo: body
            }).catch(() => {});
        }

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 2.5 POST /api/operator/flight-recorder
router.post('/api/operator/flight-recorder', async (req, res) => {
    try {
        const body = req.body || {};
        const timestamp = body.recordedAt || new Date().toISOString();

        // 1. Write structured app_flight_recorder.json
        const jsonTarget = path.join(__dirname, '..', '..', 'data', 'telemetry', 'app_flight_recorder.json');
        try {
            fs.mkdirSync(path.dirname(jsonTarget), { recursive: true });
            fs.writeFileSync(jsonTarget, JSON.stringify(body, null, 2), 'utf8');
        } catch (_) {}

        // 2. Append latest summary to flight_recorder.log
        const logTarget = path.join(__dirname, '..', '..', 'public', 'logs', 'flight_recorder.log');
        try {
            const lastAction = body.timeline && body.timeline.length ? body.timeline[body.timeline.length - 1] : null;
            const logLine = `[${timestamp}] [Role: ${body.domSnapshot?.currentRole || 'N/A'}] [Customer: ${body.domSnapshot?.activeCustomer || 'N/A'}] Last: ${lastAction ? `${lastAction.cat}: ${lastAction.action}` : 'Sync'}\n`;
            fs.mkdirSync(path.dirname(logTarget), { recursive: true });
            fs.appendFileSync(logTarget, logLine, 'utf8');
        } catch (_) {}

        res.json({ success: true, recorded: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 2.6 GET /api/admin/flight-recorder
router.get('/api/admin/flight-recorder', async (req, res) => {
    try {
        const jsonTarget = path.join(__dirname, '..', '..', 'data', 'telemetry', 'app_flight_recorder.json');
        const errTarget = path.join(__dirname, '..', '..', 'data', 'telemetry', 'latest_ui_error.json');
        
        let recorderData = {};
        if (fs.existsSync(jsonTarget)) {
            try {
                recorderData = JSON.parse(fs.readFileSync(jsonTarget, 'utf8'));
            } catch (_) {}
        }

        let latestError = null;
        if (fs.existsSync(errTarget)) {
            try {
                latestError = JSON.parse(fs.readFileSync(errTarget, 'utf8'));
            } catch (_) {}
        }

        res.json({
            success: true,
            flightRecorder: recorderData,
            latestError: latestError
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 3. GET /api/operator/profile
router.get('/api/operator/profile', async (req, res) => {
    try {
        const uid = req.query.uid || req.headers['x-operator-uid'];
        if (!uid) return res.status(400).json({ error: 'Operator UID required' });
        const profile = await getUserProfile(uid);
        res.json({ success: true, profile: profile || {} });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 4. POST /api/operator/profile
router.post('/api/operator/profile', async (req, res) => {
    try {
        const { operatorUid, centerName, displayName, operatorName, mobileNumber, district, taluk, upiId, address } = req.body;
        const uid = operatorUid || req.headers['x-operator-uid'];
        if (!uid) return res.status(400).json({ error: 'Operator UID required' });

        const existing = (await getUserProfile(uid)) || {};
        const updated = {
            ...existing,
            centerName: centerName || displayName || operatorName || existing.centerName || 'குமரன் இ-சேவை மையம்',
            displayName: centerName || displayName || operatorName || existing.displayName || 'குமரன் இ-சேவை மையம்',
            operatorName: operatorName || existing.operatorName || '',
            mobileNumber: mobileNumber || existing.mobileNumber || '',
            district: district || existing.district || '',
            taluk: taluk || existing.taluk || '',
            upiId: upiId || existing.upiId || '',
            address: address || existing.address || '',
            updatedAt: new Date().toISOString()
        };
        await saveUserProfile(uid, updated);
        console.log(`[PROFILE UPDATE] Operator profile updated successfully for UID: ${uid}`);
        res.json({ success: true, profile: updated });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 5. DELETE /api/operator/profile
router.delete('/api/operator/profile', async (req, res) => {
    try {
        const uid = req.query.uid || req.body.operatorUid || req.headers['x-operator-uid'];
        if (!uid) return res.status(400).json({ error: 'Operator UID required' });
        await deleteUserProfile(uid);
        console.log(`[PROFILE DELETE] Deleted operator profile for UID: ${uid}`);
        res.json({ success: true, message: 'Operator profile deleted successfully' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 6. POST /api/operator/submit-complete
router.post('/api/operator/submit-complete', async (req, res) => {
    const { mobileNumber, applicationNumber, applicationPdfUrl, customerName } = req.body;
    const cleanMob = String(mobileNumber || req.headers['x-session-mobile'] || '').replace(/\D/g, '');
    const cleanAppNo = String(applicationNumber || '').trim();
    const pdfUrl = applicationPdfUrl || (cleanAppNo ? `/receipts/Application_${cleanAppNo}.pdf` : null);

    if (!cleanAppNo) {
        return res.status(400).json({ error: 'விண்ணப்ப பதிவு குறிப்பு எண் (Application Number) தேவை.' });
    }

    let sess = sessions.get(cleanMob);
    if (!sess) {
        sess = setActiveSession(cleanMob);
    }

    sess.applicationNumber = cleanAppNo;
    sess.applicationPdfUrl = pdfUrl;
    sess.step = 'submitted';
    sess.intakeState = 'SUBMITTED';
    if (!sess.citizenProfile) sess.citizenProfile = createFreshProfile(cleanMob);
    sess.citizenProfile.applicationNumber = cleanAppNo;
    sess.citizenProfile.applicationPdfUrl = pdfUrl;
    sess.citizenProfile.submittedAt = new Date().toISOString();

    if (customerName) {
        if (!sess.citizenProfile.fullNameTam && !sess.citizenProfile.fullNameEng) {
            sess.citizenProfile.fullNameTam = customerName;
        }
    }

    const tamName = sess.citizenProfile.fullNameTam || sess.citizenProfile.fullNameEng || customerName || 'விண்ணப்பதாரர்';

    const celebratoryMsg = {
        sender: 'bot',
        text: `🎉 **அற்புதம்! புதிய ஸ்மார்ட் ரேஷன் கார்டு விண்ணப்பம் அரசு போர்ட்டலில் வெற்றிகரமாகச் சமர்ப்பிக்கப்பட்டுவிட்டது!** 📑\n\n` +
              `• 👤 **குடும்பத் தலைவர்:** ${tamName}\n` +
              `• 📄 **அரசு பதிவு எண் (Application Ref No):** 👉 **${cleanAppNo}**\n` +
              `• 📱 **கைபேசி எண்:** +91 ${cleanMob}\n\n` +
              `📥 **அதிகாரப்பூர்வ TNPDS விண்ணப்ப படிவம் (Application PDF) தயாராக உள்ளது!**\n\n` +
              `கீழே உள்ள பொத்தானை அழுத்தி விண்ணப்ப படிவத்தைப் பதிவிறக்கம் செய்து வாடிக்கையாளருக்கு வழங்கலாம்:`,
        applicationNumber: cleanAppNo,
        applicationPdfUrl: pdfUrl,
        options: [
            { label: "📥 விண்ணப்ப PDF பதிவிறக்கு (Download PDF)", value: `DOWNLOAD_PDF_${cleanAppNo}` }
        ]
    };

    sess.chatHistory = sess.chatHistory.filter(m => m && m.text && !m.text.includes('விண்ணப்பம் தயார்') && !m.text.includes('CONTINUE_INTAKE'));
    sess.chatHistory.push(celebratoryMsg);

    persistSessions();

    try {
        await saveCitizenDraft(cleanMob, {
            name: tamName,
            status: 'SUBMITTED',
            applicationNumber: cleanAppNo,
            applicationPdfUrl: pdfUrl,
            submittedAt: new Date().toISOString(),
            citizenProfile: sess.citizenProfile,
            chatHistory: sess.chatHistory,
            operatorUid: sess.operatorUid || req.headers['x-operator-uid'] || null
        });
    } catch (e) {
        console.warn('Draft save on submit complete warning:', e.message);
    }

    res.json({
        success: true,
        applicationNumber: cleanAppNo,
        applicationPdfUrl: pdfUrl,
        chatHistory: sess.chatHistory,
        citizenProfile: sess.citizenProfile
    });
});

// 7. Dedicated 1-Click TNPDS Application PDF Download
router.all(['/api/tnpds/download-pdf', '/api/operator/download-tnpds-pdf'], async (req, res) => {
    const rawRef = req.body?.appRefNo || req.body?.applicationNumber || req.body?.refNo || req.query?.refNo || req.query?.appRefNo || '';
    const cleanRef = String(rawRef).replace(/\D/g, '').trim();
    if (!cleanRef) {
        return res.status(400).json({ error: 'விண்ணப்ப குறிப்பு எண் தேவை.' });
    }
    try {
        const result = await downloadTnpdsApplicationPdf(cleanRef);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 8. Link verified CAN number directly to Customer Master Profile & Draft
router.post('/api/operator/link-can', async (req, res) => {
    const { mobileNumber, canNumber } = req.body || {};
    if (!mobileNumber || !canNumber) {
        return res.status(400).json({ success: false, error: 'mobileNumber and canNumber are required' });
    }
    const cleanMob = String(mobileNumber).trim().replace(/\D+/g, '');
    try {
        let draft = await getCitizenDraft(cleanMob);
        let prof = null;
        try { prof = getCitizenProfile(cleanMob); } catch (err) {}

        if (draft) {
            draft.canNumber = canNumber;
            if (draft.citizenProfile) {
                draft.citizenProfile.canNumber = canNumber;
            }
            await saveCitizenDraft(cleanMob, draft);
        } else {
            const custName = prof ? (prof.fullNameTam || prof.fullNameEng || prof.name || 'வாடிக்கையாளர்') : 'வாடிக்கையாளர்';
            draft = {
                mobileNumber: cleanMob,
                name: custName,
                canNumber: canNumber,
                citizenProfile: {
                    ...(prof || {}),
                    mobileNumber: cleanMob,
                    canNumber: canNumber
                },
                status: 'DRAFT_SAVED',
                lastUpdated: new Date().toISOString()
            };
            await saveCitizenDraft(cleanMob, draft);
        }

        if (sessions.has(cleanMob)) {
            const sess = sessions.get(cleanMob);
            if (sess.citizenProfile) sess.citizenProfile.canNumber = canNumber;
            if (sess.draftData) sess.draftData.canNumber = canNumber;
            persistSessions();
        }

        try {
            if (!prof) prof = { mobileNumber: cleanMob };
            prof.canNumber = canNumber;
            saveCitizenProfile(cleanMob, prof);
        } catch (err) {}

        console.log(`🌟 CAN (${canNumber}) linked permanently to Master Profile: +91 ${cleanMob}`);
        res.json({ success: true, message: 'CAN number successfully linked to master profile', canNumber, mobileNumber: cleanMob });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 9. AI OCR Aadhaar Scanner for Master Customer Profile Creation
router.post('/api/operator/scan-aadhaar', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'Aadhaar document file is required.' });
        }
        const rawMobile = req.body.mobileNumber || '';
        const cleanMob = String(rawMobile).replace(/\D/g, '');
        const targetMobile = cleanMob.length === 10 ? cleanMob : '';

        let extracted = null;
        try {
            extracted = await inspectAndExtractDocument(req.file.path);
        } catch (err) {
            console.warn('[SCAN_AADHAAR] Extraction warning:', err.message);
        }

        const profileData = {
            fullNameTam: extracted?.fullNameTam || '',
            fullNameEng: extracted?.fullNameEng || '',
            fatherNameTam: extracted?.fatherNameTam || '',
            fatherNameEng: extracted?.fatherNameEng || '',
            dob: extracted?.dob || '',
            gender: extracted?.gender || '',
            headAadhaar: extracted?.aadhaarNumber || '',
            doorNo: extracted?.doorNo || '',
            streetTam: extracted?.streetTam || '',
            streetEng: extracted?.streetEng || '',
            village: extracted?.village || '',
            taluk: extracted?.taluk || '',
            district: extracted?.district || '',
            pincode: extracted?.pincode || '',
            headAadhaarDocPath: req.file.path
        };

        if (targetMobile) {
            let existingDraft = await getCitizenDraft(targetMobile).catch(() => null);
            let mergedProfile = {
                ...(existingDraft?.citizenProfile || {}),
                ...profileData,
                mobileNumber: targetMobile
            };

            const draftPayload = {
                ...(existingDraft || {}),
                mobileNumber: targetMobile,
                name: mergedProfile.fullNameTam || mergedProfile.fullNameEng || 'வாடிக்கையாளர்',
                citizenProfile: mergedProfile,
                status: existingDraft?.status || 'DRAFT_SAVED',
                documents: {
                    ...(existingDraft?.documents || {}),
                    headAadhaar: req.file.path
                }
            };
            await saveCitizenDraft(targetMobile, draftPayload);
            try {
                saveCitizenProfile(targetMobile, mergedProfile);
            } catch (err) {}
        }

        res.json({
            success: true,
            extracted: profileData,
            mobileNumber: targetMobile,
            message: 'ஆதார் அட்டை விவரங்கள் வெற்றிகரமாக கண்டறியப்பட்டது!'
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// =========================================================================
// OPERATOR PORTAL CREDENTIALS VAULT (அரசு போர்ட்டல் லாகின் பெட்டகம்)
// =========================================================================

// GET /api/operator/vault
router.get('/api/operator/vault', (req, res) => {
    try {
        const opUid = req.headers['x-operator-uid'] || req.headers['x-operator-name'] || req.query.operatorUid || 'admin';
        const summary = getOperatorVaultSummary(opUid);
        res.json({ success: true, ...summary });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// POST /api/operator/vault
router.post('/api/operator/vault', (req, res) => {
    try {
        const body = req.body || {};
        const opUid = req.headers['x-operator-uid'] || req.headers['x-operator-name'] || body.operatorUid || 'admin';
        const portal = body.portal || 'tnega';
        const username = body.username || body.userId || '';
        const password = body.password || '';
        const operatorCode = body.operatorCode || 'OM';
        const operatorName = body.operatorName || req.headers['x-operator-name'] || opUid;
        const portalName = body.portalName || '';
        const customUrl = body.customUrl || '';

        if (!username) {
            return res.status(400).json({ success: false, error: 'பயனர் பெயர் (User ID / Operator Code) கட்டாயம் தேவை.' });
        }

        saveOperatorPortalCredentials(opUid, portal, {
            username,
            password,
            operatorCode,
            operatorName,
            portalName,
            customUrl
        });

        const portalDisplayNames = {
            tnega: 'TNeGA இ-சேவை',
            tnpds: 'TNPDS பொது விநியோகம்',
            eci: 'ECI வாக்காளர் சேவை'
        };
        const dispName = portalName || portalDisplayNames[portal] || portal.toUpperCase();

        res.json({
            success: true,
            message: `${dispName} லாகின் விவரங்கள் வெற்றிகரமாகப் பாதுகாக்கப்பட்டன!`,
            vault: getOperatorVaultSummary(opUid)
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// DELETE /api/operator/vault
router.delete('/api/operator/vault', (req, res) => {
    try {
        const body = req.body || {};
        const opUid = req.headers['x-operator-uid'] || req.headers['x-operator-name'] || body.operatorUid || req.query?.operatorUid || 'admin';
        const portal = body.portal || req.query?.portal || 'tnega';
        const result = deleteOperatorPortalCredentials(opUid, portal);
        res.json({
            success: true,
            message: result.message,
            vault: getOperatorVaultSummary(opUid)
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

module.exports = router;

