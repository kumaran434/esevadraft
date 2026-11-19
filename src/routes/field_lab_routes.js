/**
 * src/routes/field_lab_routes.js
 *
 * Isolated Air-Gapped HTTP Router for Field Lab Blueprint Recording (/api/lab/*).
 * Strictly isolated from production automations, citizen drafts, and sessions.
 */

const express = require('express');
const router = express.Router();
const {
    sanitizeBlueprintPayload,
    saveBlueprintToLocalDisk,
    syncBlueprintToCloud,
    retryCloudSyncBlueprint,
    listCloudBlueprints,
    getCloudBlueprintById,
    listAllMergedBlueprints,
    deleteCloudBlueprintById,
    startFieldLabRecording,
    captureFieldLabSnapshotNow,
    stopFieldLabRecording,
    getFieldLabStatus,
    listSavedBlueprints,
    getBlueprintById,
    deleteBlueprintById
} = require('../services/field_lab_recorder');

router.get('/api/lab/status', (req, res) => {
    try {
        res.json({ success: true, ...getFieldLabStatus() });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

router.post('/api/lab/start', async (req, res) => {
    try {
        const { portalUrl, portalName, serviceName, operatorLabel } = req.body || {};
        const result = await startFieldLabRecording({ portalUrl, portalName, serviceName, operatorLabel });
        res.json(result);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

router.post('/api/lab/capture', async (req, res) => {
    try {
        const result = await captureFieldLabSnapshotNow();
        res.status(result.success ? 200 : 400).json(result);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

router.post('/api/lab/stop', async (req, res) => {
    try {
        const result = await stopFieldLabRecording();
        res.status(result.success ? 200 : 400).json(result);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

router.get('/api/lab/blueprints', async (req, res) => {
    try {
        const includeCloud = req.query.includeCloud === '1' || req.query.includeCloud === 'true';
        const blueprints = includeCloud
            ? await listAllMergedBlueprints({ includeCloud: true })
            : listSavedBlueprints();
        res.json({ success: true, blueprints });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

router.get('/api/lab/cloud-blueprints', async (req, res) => {
    try {
        const blueprints = await listCloudBlueprints(50);
        res.json({ success: true, blueprints });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Zero-PII Cloud Ingestion Endpoint (receives structural blueprints relayed from distributed friend Desktop Apps)
router.post('/api/lab/cloud-sync', async (req, res) => {
    try {
        const raw = req.body;
        if (!raw || typeof raw !== 'object' || (!raw.serviceName && !Array.isArray(raw.steps))) {
            return res.status(400).json({ success: false, error: 'Invalid blueprint payload' });
        }
        const cleanBp = sanitizeBlueprintPayload(raw);
        const syncRes = await syncBlueprintToCloud(cleanBp);
        cleanBp.cloudSynced = Boolean(syncRes.cloudSynced);
        cleanBp.cloudSyncedAt = syncRes.cloudSyncedAt || cleanBp.cloudSyncedAt || new Date().toISOString();
        saveBlueprintToLocalDisk(cleanBp);
        res.json({
            success: true,
            id: cleanBp.id,
            cloudSynced: Boolean(syncRes.cloudSynced),
            cloudSyncedAt: cleanBp.cloudSyncedAt,
            mode: syncRes.mode,
            error: syncRes.error || null,
            piiStrippedGuaranteed: true
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

router.post('/api/lab/blueprints/:id/retry-sync', async (req, res) => {
    try {
        const result = await retryCloudSyncBlueprint(req.params.id);
        res.status(result.success ? 200 : 400).json(result);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

router.get('/api/lab/blueprints/:id', async (req, res) => {
    try {
        let bp = getBlueprintById(req.params.id);
        if (!bp) {
            bp = await getCloudBlueprintById(req.params.id);
        }
        if (!bp) return res.status(404).json({ success: false, error: 'Blueprint not found' });
        res.json({ success: true, blueprint: bp });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

router.delete('/api/lab/blueprints/:id', async (req, res) => {
    try {
        const okLocal = deleteBlueprintById(req.params.id);
        const okCloud = await deleteCloudBlueprintById(req.params.id);
        if (!okLocal && !okCloud) return res.status(404).json({ success: false, error: 'Blueprint not found' });
        res.json({ success: true, deleted: true, deletedLocal: okLocal, deletedCloud: okCloud });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

module.exports = router;
