const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const os = require('os');
const multer = require('multer');
const { processUploadedDocument } = require('../services/document_upload_processor');
const { generateDraftApplicationPdf } = require('../services/tnega_receipt_generator');

const uploadDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const uploadStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + file.originalname.replace(/\s+/g, '_');
        cb(null, uniqueSuffix);
    }
});
const upload = multer({
    storage: uploadStorage,
    limits: { fileSize: 15 * 1024 * 1024 }
});

const { 
    listAllDrafts, 
    getCitizenDraft, 
    saveCitizenDraft, 
    trashCitizenDraft, 
    restoreCitizenDraft, 
    deleteCitizenDraft 
} = require('../../firestore_db');

const { saveCitizenProfile } = require('../../database');
const storageService = require('../services/storage_service');
const { 
    sessions, 
    getOrCreateSession, 
    getActiveMobile, 
    setActiveMobile, 
    setSessionState, 
    persistSessions 
} = storageService;

const { 
    resolveDraftDocument, 
    extractDraftDocumentsList,
    removeDraftDocument
} = require('../services/draft_document_resolver');

function normalizeOperatorUid(uid) {
    if (!uid) return null;
    return String(uid).trim();
}

// 1. GET /api/drafts
router.get('/api/drafts', async (req, res) => {
    const opUid = req.query.operatorUid || req.headers['x-operator-uid'] || null;
    try {
        const drafts = await listAllDrafts(opUid);
        res.json({ success: true, drafts });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 2. GET /api/drafts/:mobileNumber
router.get('/api/drafts/:mobileNumber', async (req, res) => {
    const rawKey = req.params.mobileNumber || '';
    const cleanMob = String(rawKey).trim();
    if (!cleanMob) return res.status(400).json({ error: 'மொபைல் எண் தேவை.' });
    const opUid = req.query.operatorUid || req.headers['x-operator-uid'] || null;
    try {
        const draft = await getCitizenDraft(cleanMob, opUid);
        if (draft) {
            draft.base64Docs = draft.base64Docs || {};
            const memDocPath = draft.documents?.memberAadhaar || draft.citizenProfile?.subServiceData?.docPath || draft.citizenProfile?.tempMember?.docPath || draft.citizenProfile?.members?.[0]?.docPath;
            if (memDocPath && (!draft.base64Docs.memberAadhaarBase64 || !draft.base64Docs.memberAadhaarsBase64 || draft.base64Docs.memberAadhaarsBase64.length === 0)) {
                let resolvedP = fs.existsSync(memDocPath) ? memDocPath : path.join(__dirname, '..', '..', 'uploads', path.basename(memDocPath));
                if (fs.existsSync(resolvedP)) {
                    try {
                        const b64 = fs.readFileSync(resolvedP).toString('base64');
                        draft.base64Docs.memberAadhaarBase64 = b64;
                        draft.base64Docs.memberAadhaarName = path.basename(resolvedP);
                        draft.base64Docs.memberAadhaarsBase64 = [{ name: path.basename(resolvedP), base64: b64 }];
                    } catch (e) {}
                }
            }
            const draftOp = normalizeOperatorUid(draft.operatorUid);
            const reqOp = normalizeOperatorUid(opUid);
            if (reqOp && (!draftOp || draftOp !== reqOp)) {
                return res.status(403).json({ success: false, error: 'இந்த வாடிக்கையாளர் வரைவை அணுக உங்களுக்கு அனுமதி இல்லை.' });
            }
            const isTrashed = !!(draft.isDeleted || draft.status === 'TRASHED');
            if (isTrashed && req.query.includeTrashed !== 'true') {
                return res.status(404).json({ success: false, error: 'வரைவு குப்பைத்தொட்டியில் உள்ளது.' });
            }
            return res.json({ success: true, draft, isTrashed });
        }
        return res.status(404).json({ success: false, error: 'வரைவு கிடைக்கவில்லை.' });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// 3. GET /api/drafts/:mobileNumber/doc/:docType
router.get('/api/drafts/:mobileNumber/doc/:docType', async (req, res) => {
    const rawKey = req.params.mobileNumber || '';
    const cleanMob = String(rawKey).trim();
    const docType = req.params.docType || '';
    if (!cleanMob || !docType) return res.status(400).send('Missing parameters.');

    try {
        await resolveDraftDocument(cleanMob, docType, req, res);
    } catch (e) {
        return res.status(500).send(e.message);
    }
});

// 3.5. GET /api/drafts/:mobileNumber/application-pdf — Official Application Form / Summary PDF
router.get('/api/drafts/:mobileNumber/application-pdf', async (req, res) => {
    const rawKey = req.params.mobileNumber || '';
    const cleanMob = String(rawKey).trim().replace(/\D/g, '').slice(-10);
    if (!cleanMob) return res.status(400).send('Mobile number required');

    try {
        let draft = await getCitizenDraft(cleanMob).catch(() => null);
        const { getCitizenProfile } = require('../../database');
        let prof = (draft && draft.citizenProfile) || (getCitizenProfile ? getCitizenProfile(cleanMob) : {}) || {};

        const tmpPath = path.join(os.tmpdir(), `Application_Draft_${cleanMob}_${Date.now()}.pdf`);
        await generateDraftApplicationPdf(tmpPath, {
            ...prof,
            mobileNumber: cleanMob,
            applicationNumber: draft?.applicationNumber || null,
            service: draft?.service || prof?.service || 'புதிய ரேஷன் கார்டு',
            members: prof?.members || []
        });

        if (fs.existsSync(tmpPath)) {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="Application_Draft_${cleanMob}.pdf"`);
            const stream = fs.createReadStream(tmpPath);
            stream.pipe(res);
            stream.on('finish', () => {
                setTimeout(() => { try { fs.unlinkSync(tmpPath); } catch (_) {} }, 5000);
            });
            return;
        }
        res.status(404).send('PDF உருவாக்க முடியவில்லை');
    } catch (e) {
        res.status(500).send('பிழை: ' + e.message);
    }
});

// 4. GET /api/drafts/:mobileNumber/documents-list
router.get('/api/drafts/:mobileNumber/documents-list', async (req, res) => {
    const rawKey = req.params.mobileNumber || '';
    const cleanMob = String(rawKey).trim();
    if (!cleanMob) return res.status(400).json({ error: 'Missing mobile' });
    const opUid = req.query.operatorUid || req.headers['x-operator-uid'] || null;

    try {
        const digitsOnly = cleanMob.replace(/\D/g, '').slice(-10);
        let draft = (cleanMob !== 'active_session') ? await getCitizenDraft(cleanMob, opUid) : null;
        if (!draft && digitsOnly) {
            draft = await getCitizenDraft(digitsOnly, opUid);
        }
        const activeMob = typeof getActiveMobile === 'function' ? getActiveMobile() : null;
        if (!draft && activeMob && activeMob !== cleanMob) {
            draft = await getCitizenDraft(activeMob, opUid);
        }
        const sess = (cleanMob && cleanMob !== 'active_session' && sessions && sessions.has(cleanMob))
            ? sessions.get(cleanMob)
            : ((digitsOnly && sessions && sessions.has(digitsOnly)) ? sessions.get(digitsOnly) : ((sessions && sessions.get(activeMob)) || (storageService.getSessionState && storageService.getSessionState()) || null));

        if ((!draft || draft.isDeleted || draft.status === 'TRASHED') && !sess) {
            return res.json({ success: true, mobileNumber: cleanMob, count: 0, documents: [] });
        }
        const filterSubService = req.query.subService || req.query.service || null;
        const docs = extractDraftDocumentsList(sess, draft, cleanMob, filterSubService);
        res.json({ success: true, mobileNumber: cleanMob, count: docs.length, documents: docs });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 5. POST /api/drafts/save
router.post('/api/drafts/save', async (req, res) => {
    const targetMobile = req.body.mobileNumber || req.body.customerMobile || req.body.targetMobile || req.headers['x-session-mobile'] || getActiveMobile();
    const opUid = req.body.operatorUid || req.headers['x-operator-uid'] || null;
    const opName = req.body.operatorName || req.headers['x-operator-name'] || null;
    const opMobile = req.body.operatorMobile || req.headers['x-operator-mobile'] || null;

    if (!targetMobile) {
        return res.status(400).json({ error: 'செயலில் உள்ள வாடிக்கையாளர் எண் இல்லை.' });
    }

    const sess = getOrCreateSession(targetMobile);

    if (req.body.citizenProfile && typeof req.body.citizenProfile === 'object') {
        sess.citizenProfile = { ...sess.citizenProfile, ...req.body.citizenProfile };
        if (req.body.citizenProfile.documents && typeof req.body.citizenProfile.documents === 'object') {
            sess.tempUploads = { ...(sess.tempUploads || {}), ...req.body.citizenProfile.documents };
        }
    }
    if (req.body.applicationNumber) {
        sess.applicationNumber = req.body.applicationNumber;
        if (sess.citizenProfile) sess.citizenProfile.applicationNumber = req.body.applicationNumber;
    }
    if (req.body.applicationPdfUrl) {
        sess.applicationPdfUrl = req.body.applicationPdfUrl;
        if (sess.citizenProfile) sess.citizenProfile.applicationPdfUrl = req.body.applicationPdfUrl;
    }
    if (req.body.intakeState) sess.intakeState = req.body.intakeState;
    if (req.body.step) sess.step = req.body.step;
    if (Array.isArray(req.body.chatHistory) && req.body.chatHistory.length > 0) {
        sess.chatHistory = req.body.chatHistory;
    }
    if (req.body.documents && typeof req.body.documents === 'object') {
        sess.tempUploads = { ...sess.tempUploads, ...req.body.documents };
    }
    if (req.body.base64Docs && typeof req.body.base64Docs === 'object') {
        sess.base64Docs = { ...(sess.base64Docs || {}), ...req.body.base64Docs };
    }
    if (req.body.subService) {
        sess.subService = req.body.subService;
        if (sess.citizenProfile) sess.citizenProfile.subService = req.body.subService;
    }

    if (targetMobile.startsWith('walkin_')) {
        const prof = sess.citizenProfile || {};
        const hasRealName = !!((prof.fullNameTam && prof.fullNameTam.trim()) || (prof.fullNameEng && prof.fullNameEng.trim()));
        const hasAadhaar = !!(prof.headAadhaar && prof.headAadhaar.trim());
        const hasRealMobile = !!(prof.mobileNumber && /^[6-9]\d{9}$/.test(prof.mobileNumber));
        const hasMembers = Array.isArray(prof.members) && prof.members.length > 0;
        const hasDocs = sess.tempUploads && Object.keys(sess.tempUploads).some(k => !!sess.tempUploads[k]);
        if (!hasRealName && !hasAadhaar && !hasRealMobile && !hasMembers && !hasDocs) {
            console.log(`[DRAFT GATE] /api/drafts/save skipping empty walkin ${targetMobile}`);
            return res.json({ success: true, message: 'Skipped saving empty walkin', citizenProfile: sess.citizenProfile });
        }
    }

    try {
        await saveCitizenDraft(targetMobile, {
            operatorUid: opUid || sess.operatorUid || null,
            operatorName: opName || sess.operatorName || null,
            operatorMobile: opMobile || sess.operatorMobile || null,
            citizenProfile: sess.citizenProfile,
            documents: sess.tempUploads || {},
            base64Docs: sess.base64Docs || req.body.base64Docs || {},
            subService: req.body.subService || sess.subService || sess.citizenProfile?.subService || null,
            chatHistory: sess.chatHistory,
            intakeState: sess.intakeState,
            applicationNumber: sess.applicationNumber || (sess.citizenProfile && sess.citizenProfile.applicationNumber) || null,
            applicationPdfUrl: sess.applicationPdfUrl || (sess.citizenProfile && sess.citizenProfile.applicationPdfUrl) || null,
            step: 'WAITING_FOR_OTP',
            status: sess.applicationNumber ? 'SUBMITTED' : 'DRAFT_SAVED'
        });

        saveCitizenProfile(targetMobile, sess.citizenProfile);
        persistSessions();

        res.json({ success: true, message: 'Draft saved successfully', citizenProfile: sess.citizenProfile });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 6. DELETE /api/drafts/:mobileNumber
router.delete('/api/drafts/:mobileNumber', async (req, res) => {
    const rawKey = req.params.mobileNumber || '';
    const draftKey = String(rawKey).trim();
    if (!draftKey) return res.status(400).json({ error: 'வரைவு அடையாளம் அல்லது மொபைல் எண் தேவை.' });
    const isTrash = req.query.trash === 'true' || req.body?.trash === true;
    const cleanDigits = draftKey.replace(/\D/g, '');
    try {
        if (isTrash) {
            await trashCitizenDraft(draftKey);
            if (cleanDigits && cleanDigits !== draftKey) await trashCitizenDraft(cleanDigits).catch(() => {});
        } else {
            await deleteCitizenDraft(draftKey, { permanent: true });
            if (cleanDigits && cleanDigits !== draftKey) await deleteCitizenDraft(cleanDigits, { permanent: true }).catch(() => {});
        }
        if (sessions.has(draftKey)) sessions.delete(draftKey);
        if (cleanDigits && sessions.has(cleanDigits)) sessions.delete(cleanDigits);
        const activeMob = getActiveMobile();
        if (activeMob === draftKey || (cleanDigits && activeMob === cleanDigits)) {
            setActiveMobile(null);
            setSessionState(null);
        }
        persistSessions();
        res.json({ 
            success: true, 
            permanent: !isTrash,
            trashed: isTrash,
            message: isTrash ? 'வாடிக்கையாளர் வரைவு குப்பைத்தொட்டிக்கு (Trash) நகர்த்தப்பட்டது.' : 'வாடிக்கையாளர் வரைவு மற்றும் ஆவணங்கள் Firebase-லிருந்து நிரந்தரமாக அழிக்கப்பட்டன.' 
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 7. POST /api/drafts/delete
router.post('/api/drafts/delete', async (req, res) => {
    const rawKey = req.body?.mobileNumber || '';
    const draftKey = String(rawKey).trim();
    if (!draftKey) return res.status(400).json({ error: 'வரைவு அடையாளம் அல்லது மொபைல் எண் தேவை.' });
    const isTrash = req.query.trash === 'true' || req.body?.trash === true;
    const cleanDigits = draftKey.replace(/\D/g, '');
    try {
        if (isTrash) {
            await trashCitizenDraft(draftKey);
            if (cleanDigits && cleanDigits !== draftKey) await trashCitizenDraft(cleanDigits).catch(() => {});
        } else {
            await deleteCitizenDraft(draftKey, { permanent: true });
            if (cleanDigits && cleanDigits !== draftKey) await deleteCitizenDraft(cleanDigits, { permanent: true }).catch(() => {});
        }
        if (sessions.has(draftKey)) sessions.delete(draftKey);
        if (cleanDigits && sessions.has(cleanDigits)) sessions.delete(cleanDigits);
        const activeMob = getActiveMobile();
        if (activeMob === draftKey || (cleanDigits && activeMob === cleanDigits)) {
            setActiveMobile(null);
            setSessionState(null);
        }
        persistSessions();
        res.json({ 
            success: true, 
            permanent: !isTrash,
            trashed: isTrash,
            message: isTrash ? 'வாடிக்கையாளர் வரைவு குப்பைத்தொட்டிக்கு (Trash) நகர்த்தப்பட்டது.' : 'வாடிக்கையாளர் வரைவு மற்றும் ஆவணங்கள் Firebase-லிருந்து நிரந்தரமாக அழிக்கப்பட்டன.' 
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 8. POST /api/drafts/:mobileNumber/trash
router.post('/api/drafts/:mobileNumber/trash', async (req, res) => {
    const rawKey = req.params.mobileNumber || '';
    const draftKey = String(rawKey).trim();
    if (!draftKey) return res.status(400).json({ error: 'மொபைல் எண் தேவை.' });
    const opUid = req.query.operatorUid || req.headers['x-operator-uid'] || req.body?.operatorUid || null;
    const cleanDigits = draftKey.replace(/\D/g, '');
    try {
        const existing = await getCitizenDraft(draftKey);
        const exOpTrash = normalizeOperatorUid(existing?.operatorUid);
        const reqOpTrash = normalizeOperatorUid(opUid);
        if (exOpTrash && reqOpTrash && exOpTrash !== reqOpTrash) {
            return res.status(403).json({ error: 'மற்றொரு மையத்தின் வாடிக்கையாளர் வரைவை நீங்கள் நீக்க முடியாது.' });
        }
        await trashCitizenDraft(draftKey);
        if (cleanDigits && cleanDigits !== draftKey) await trashCitizenDraft(cleanDigits).catch(() => {});
        if (sessions.has(draftKey)) sessions.delete(draftKey);
        if (cleanDigits && sessions.has(cleanDigits)) sessions.delete(cleanDigits);
        const activeMob = getActiveMobile();
        if (activeMob === draftKey || (cleanDigits && activeMob === cleanDigits)) {
            setActiveMobile(null);
            setSessionState(null);
        }
        persistSessions();
        res.json({ success: true, message: 'வாடிக்கையாளர் வரைவு குப்பைத்தொட்டிக்கு (Trash) நகர்த்தப்பட்டது.' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 9. POST /api/drafts/:mobileNumber/restore
router.post('/api/drafts/:mobileNumber/restore', async (req, res) => {
    const rawKey = req.params.mobileNumber || '';
    const draftKey = String(rawKey).trim();
    if (!draftKey) return res.status(400).json({ error: 'மொபைல் எண் தேவை.' });
    const opUid = req.query.operatorUid || req.headers['x-operator-uid'] || req.body?.operatorUid || null;
    const cleanDigits = draftKey.replace(/\D/g, '');
    try {
        const existing = await getCitizenDraft(draftKey);
        const exOpRestore = normalizeOperatorUid(existing?.operatorUid);
        const reqOpRestore = normalizeOperatorUid(opUid);
        if (exOpRestore && reqOpRestore && exOpRestore !== reqOpRestore) {
            return res.status(403).json({ error: 'மற்றொரு மையத்தின் வாடிக்கையாளர் வரைவை நீங்கள் மீட்டெடுக்க முடியாது.' });
        }
        await restoreCitizenDraft(draftKey);
        if (cleanDigits && cleanDigits !== draftKey) await restoreCitizenDraft(cleanDigits).catch(() => {});
        res.json({ success: true, message: 'வாடிக்கையாளர் வரைவு வெற்றிகரமாக மீட்டெடுக்கப்பட்டது.' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 10. POST /api/drafts/:mobileNumber/permanent-delete
router.post('/api/drafts/:mobileNumber/permanent-delete', async (req, res) => {
    const rawKey = req.params.mobileNumber || '';
    const draftKey = String(rawKey).trim();
    if (!draftKey) return res.status(400).json({ error: 'மொபைல் எண் தேவை.' });
    const opUid = req.query.operatorUid || req.headers['x-operator-uid'] || req.body?.operatorUid || null;
    const cleanDigits = draftKey.replace(/\D/g, '');
    try {
        const existing = await getCitizenDraft(draftKey);
        const exOpDel = normalizeOperatorUid(existing?.operatorUid);
        const reqOpDel = normalizeOperatorUid(opUid);
        if (exOpDel && reqOpDel && exOpDel !== reqOpDel) {
            return res.status(403).json({ error: 'மற்றொரு மையத்தின் வாடிக்கையாளர் வரைவை நீங்கள் அழிக்க முடியாது.' });
        }
        await deleteCitizenDraft(draftKey, { permanent: true });
        if (cleanDigits && cleanDigits !== draftKey) await deleteCitizenDraft(cleanDigits, { permanent: true }).catch(() => {});
        if (sessions.has(draftKey)) sessions.delete(draftKey);
        if (cleanDigits && sessions.has(cleanDigits)) sessions.delete(cleanDigits);
        const activeMob = getActiveMobile();
        if (activeMob === draftKey || (cleanDigits && activeMob === cleanDigits)) {
            setActiveMobile(null);
            setSessionState(null);
        }
        persistSessions();
        res.json({ success: true, permanent: true, message: 'வாடிக்கையாளர் வரைவு மற்றும் ஆவணங்கள் Firebase-லிருந்து நிரந்தரமாக அழிக்கப்பட்டன.' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 11. POST /api/drafts/upload-document
router.post('/api/drafts/upload-document', upload.single('file'), async (req, res) => {
    try {
        const uploadedFile = req.file;
        if (!uploadedFile) {
            return res.status(400).json({ success: false, error: 'No file uploaded.' });
        }

        const docType = req.body.docType || 'headPhoto';
        const activeMob = getActiveMobile();
        const rawMobile = req.body.mobileNumber || req.headers['x-session-mobile'] || activeMob || '';
        const memberIndex = parseInt(req.body.memberIndex || '0', 10);
        const opUid = req.headers['x-operator-uid'] || req.body.operatorUid || null;

        let cleanMobile = String(rawMobile).replace(/\D/g, '');
        if (cleanMobile.length === 12 && cleanMobile.startsWith('91')) cleanMobile = cleanMobile.slice(2);
        const targetMobile = cleanMobile.length === 10 ? cleanMobile : (rawMobile || activeMob || 'walkin_session');

        const rawOldMobile = req.body.oldMobileNumber || req.headers['x-old-session-mobile'] || '';
        let cleanOldMobile = String(rawOldMobile).replace(/\D/g, '');
        if (cleanOldMobile.length === 12 && cleanOldMobile.startsWith('91')) cleanOldMobile = cleanOldMobile.slice(2);
        const fallbackOldMobile = cleanOldMobile.length === 10 ? cleanOldMobile : '';

        const sess = getOrCreateSession(targetMobile);
        if (opUid) sess.operatorUid = opUid;
        if (!sess.citizenProfile || !sess.citizenProfile.fullNameEng || !sess.citizenProfile.members || sess.citizenProfile.members.length === 0) {
            try {
                let existingDraft = await getCitizenDraft(targetMobile);
                if ((!existingDraft || !existingDraft.citizenProfile) && fallbackOldMobile) {
                    existingDraft = await getCitizenDraft(fallbackOldMobile);
                }
                if (existingDraft && existingDraft.citizenProfile && (existingDraft.citizenProfile.fullNameEng || existingDraft.citizenProfile.fullNameTam)) {
                    const existingMembers = existingDraft.citizenProfile.members || [];
                    const sessMembers = sess.citizenProfile?.members || [];
                    const mergedMembers = sessMembers.length > 0 ? sessMembers : existingMembers;
                    sess.citizenProfile = {
                        ...existingDraft.citizenProfile,
                        ...(sess.citizenProfile || {}),
                        members: mergedMembers,
                        gasDetails: { ...(existingDraft.citizenProfile.gasDetails || {}), ...(sess.citizenProfile?.gasDetails || {}) }
                    };
                    if (existingDraft.documents) sess.tempUploads = { ...existingDraft.documents, ...(sess.tempUploads || {}) };
                }
            } catch (e) {}
        }
        if (!sess.citizenProfile) {
            const { createFreshProfile } = require('../services/storage_service');
            sess.citizenProfile = createFreshProfile(targetMobile);
        }
        if (!sess.tempUploads) sess.tempUploads = {};
        if (!sess.citizenProfile.documents) sess.citizenProfile.documents = {};

        try {
            delete require.cache[require.resolve('../services/document_upload_processor')];
        } catch (_) {}
        const { processUploadedDocument: liveProcessDoc } = require('../services/document_upload_processor');
        const { optimizedPath, extractedData, fileSizeKB } = await liveProcessDoc(sess, docType, uploadedFile, memberIndex, targetMobile);
        let relativeUrl = null;

        const normPath = String(optimizedPath).replace(/\\/g, '/');
        if (normPath.includes('/compressed/')) {
            relativeUrl = normPath.substring(normPath.indexOf('/compressed/'));
        } else if (normPath.includes('/uploads/')) {
            relativeUrl = normPath.substring(normPath.indexOf('/uploads/'));
        } else {
            relativeUrl = '/' + path.basename(normPath);
        }

        saveCitizenProfile(targetMobile, sess.citizenProfile);
        await saveCitizenDraft(targetMobile, {
            operatorUid: sess.operatorUid || null,
            operatorName: sess.operatorName || null,
            operatorMobile: sess.operatorMobile || null,
            citizenProfile: sess.citizenProfile,
            documents: sess.tempUploads || {},
            base64Docs: sess.base64Docs || {},
            chatHistory: sess.chatHistory || [],
            intakeState: sess.intakeState || 'COMPLETED',
            step: sess.step || 'draft',
            status: sess.applicationNumber ? 'SUBMITTED' : 'DRAFT_SAVED'
        });
        persistSessions();

        return res.json({
            success: true,
            docType,
            filePath: optimizedPath,
            relativeUrl,
            fileSizeKB,
            citizenProfile: sess.citizenProfile,
            extracted: extractedData
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

// 12. POST /api/drafts/delete-document
router.post('/api/drafts/delete-document', async (req, res) => {
    const rawMobile = req.body.mobileNumber || req.body.mobile || req.headers['x-session-mobile'] || getActiveMobile() || '';
    const cleanMob = String(rawMobile).trim();
    const docType = req.body.docType || '';
    const memberIndex = parseInt(req.body.memberIndex || '0', 10);

    if (!cleanMob || !docType) {
        return res.status(400).json({ success: false, error: 'Missing mobileNumber or docType' });
    }

    try {
        await removeDraftDocument(cleanMob, docType, memberIndex);
        res.json({ success: true, message: 'Document deleted successfully', docType, memberIndex });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

module.exports = router;
