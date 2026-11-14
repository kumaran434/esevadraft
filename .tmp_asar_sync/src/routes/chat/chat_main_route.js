const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../../../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf'
]);
const ALLOWED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.pdf']);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const cleanBase = path.basename(file.originalname || 'upload').replace(/[^a-zA-Z0-9._-]/g, '_');
        const uniqueSuffix = Date.now() + '-' + cleanBase;
        cb(null, uniqueSuffix);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 15 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        const mime = (file.mimetype || '').toLowerCase();
        if (ALLOWED_MIME_TYPES.has(mime) || ALLOWED_EXTS.has(ext)) {
            cb(null, true);
        } else {
            cb(new Error(`அனுமதிக்கப்படாத கோப்பு வகை (${ext || mime}). JPG, PNG அல்லது PDF மட்டுமே பதிவேற்ற முடியும்.`));
        }
    }
});

const { resolveChatContext } = require('./chat_context');
const { handlePhoneBind } = require('./chat_phone_bind');
const { handleChatCommands } = require('./chat_commands');
const { handleAutomationStarter } = require('./chat_automation_starter');
const { handleServiceSelector } = require('./chat_service_selector');
const { handleDraftResume } = require('./chat_draft_resume');
const { handleTnegaIntake } = require('./chat_tnega_intake');
const { handleMemberCount } = require('./chat_member_count');
const { handleHeadPhoto } = require('./chat_head_photo');
const { handleHeadAadhaar } = require('./chat_head_aadhaar');
const { handleMemberAadhaar } = require('./chat_member_aadhaar');
const { handleMemberVerification } = require('./chat_member_verification');
const { handleAddressAndMobile } = require('./chat_address_and_mobile');
const { handleResidenceProof } = require('./chat_residence_proof');
const { handleFallbackResponse } = require('./chat_fallback_responder');

router.post('/api/chat', (req, res, next) => {
    upload.any()(req, res, (err) => {
        if (err) {
            return res.status(400).json({ error: err.message, success: false });
        }
        next();
    });
}, async (req, res) => {
    try {
        const text = (req.body.text || req.body.message || '').trim();
        const uploadedFile = (req.files && req.files.length > 0) ? req.files[0] : null;

        console.log(`\n📨 Received - Text: "${text}", File: ${uploadedFile ? uploadedFile.filename : 'None'}`);

        const ctx = await resolveChatContext(req, text, uploadedFile);

        if (await handlePhoneBind(ctx, req, res)) return;
        if (await handleChatCommands(ctx, req, res)) return;
        if (await handleAutomationStarter(ctx, req, res)) return;
        if (await handleServiceSelector(ctx, req, res)) return;
        if (await handleDraftResume(ctx, req, res)) return;
        if (await handleTnegaIntake(ctx, req, res)) return;
        if (await handleMemberCount(ctx, req, res)) return;
        if (await handleHeadPhoto(ctx, req, res)) return;
        if (await handleHeadAadhaar(ctx, req, res)) return;
        if (await handleMemberAadhaar(ctx, req, res)) return;
        if (await handleMemberVerification(ctx, req, res)) return;
        if (await handleAddressAndMobile(ctx, req, res)) return;
        if (await handleResidenceProof(ctx, req, res)) return;

        return handleFallbackResponse(ctx, req, res);
    } catch (err) {
        console.error('Server error in /api/chat:', err);
        return res.status(500).json({ error: err.message });
    }
});

module.exports = router;
