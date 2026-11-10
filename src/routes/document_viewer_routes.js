const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const { getCitizenDocuments } = require('../../database');
const storageService = require('../services/storage_service');
const { getActiveMobile } = storageService;

const uploadDir = path.join(__dirname, '..', '..', 'uploads');

// 1. GET /api/documents
router.get('/api/documents', (req, res) => {
    const mobile = req.query.mobile || getActiveMobile();
    const docs = getCitizenDocuments(mobile);
    res.json({ success: true, documents: docs, mobile });
});

// 2. GET /api/documents/download/:filename
router.get('/api/documents/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(uploadDir, filename);
    if (fs.existsSync(filePath)) {
        return res.download(filePath);
    }
    res.status(404).json({ error: 'File not found.' });
});

module.exports = router;
