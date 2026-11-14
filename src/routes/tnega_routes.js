const express = require('express');
const router = express.Router();

const { 
    loginTnegaOperator, 
    searchCitizenCan, 
    generateCanOtp, 
    provideCanOtp, 
    registerNewCan, 
    stopTnegaAutomation, 
    getLiveTnegaStatus 
} = require('../../tnega_can_automation');

// 1. POST /api/tnega/login
router.post('/api/tnega/login', async (req, res) => {
    const { username, password, isMockSandbox, operatorUid, operatorName } = req.body || {};
    const opUid = operatorUid || req.headers['x-operator-uid'] || '';
    const opName = operatorName || req.headers['x-operator-name'] || '';
    try {
        const result = await loginTnegaOperator({ username, password }, (msg) => {
            console.log('[TNeGA Login]', msg);
        }, { isMockSandbox: isMockSandbox !== false, operatorUid: opUid, operatorName: opName });
        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. POST /api/tnega/can/search
router.post('/api/tnega/can/search', async (req, res) => {
    const { aadhaar, mobile, isMockSandbox, operatorUid, operatorName } = req.body || {};
    const opUid = operatorUid || req.headers['x-operator-uid'] || '';
    const opName = operatorName || req.headers['x-operator-name'] || '';
    try {
        const result = await searchCitizenCan({ aadhaar, mobile }, (msg) => {
            console.log('[TNeGA CAN Search]', msg);
        }, { isMockSandbox: isMockSandbox !== false, operatorUid: opUid, operatorName: opName });
        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3. POST /api/tnega/can/otp/generate
router.post('/api/tnega/can/otp/generate', async (req, res) => {
    const { canNumber, isMockSandbox } = req.body || {};
    try {
        generateCanOtp(canNumber, (msg) => {
            console.log('[TNeGA CAN OTP]', msg);
        }, { isMockSandbox: isMockSandbox !== false }).then(otpRes => {
            console.log('[TNeGA CAN OTP Result]', otpRes);
        }).catch(err => {
            console.error('[TNeGA CAN OTP Err]', err);
        });
        res.json({ success: true, message: 'OTP generation initiated', isWaitingForOtp: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 4. POST /api/tnega/can/otp/verify
router.post('/api/tnega/can/otp/verify', (req, res) => {
    const { otp } = req.body || {};
    if (!otp) return res.status(400).json({ success: false, message: 'OTP is required' });
    const result = provideCanOtp(otp);
    res.json(result);
});

// 5. POST /api/tnega/can/register
router.post('/api/tnega/can/register', async (req, res) => {
    const { citizenProfile, isMockSandbox, operatorUid, operatorName } = req.body || {};
    const opUid = operatorUid || req.headers['x-operator-uid'] || citizenProfile?.operatorUid || '';
    const opName = operatorName || req.headers['x-operator-name'] || citizenProfile?.operatorName || '';
    try {
        const result = await registerNewCan(citizenProfile || {}, (msg) => {
            console.log('[TNeGA CAN Register]', msg);
        }, { isMockSandbox: isMockSandbox !== false, operatorUid: opUid, operatorName: opName });
        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 6. GET /api/tnega/status
router.get('/api/tnega/status', (req, res) => {
    res.json(getLiveTnegaStatus());
});

// 7. POST /api/tnega/stop
router.post('/api/tnega/stop', async (req, res) => {
    const result = await stopTnegaAutomation();
    res.json(result);
});

// 8. GET /api/tnega/screenshot
router.get('/api/tnega/screenshot', async (req, res) => {
    try {
        const { getTnegaState } = require('../../src/portal/tnega/tnega_browser_manager');
        const state = getTnegaState();
        if (state.page && !state.page.isClosed()) {
            const buf = await state.page.screenshot({ fullPage: false });
            res.setHeader('Content-Type', 'image/png');
            return res.send(buf);
        }
        res.status(404).json({ error: 'No active TNeGA page' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 9. GET /api/tnega/page-info
router.get('/api/tnega/page-info', async (req, res) => {
    try {
        const { getTnegaState } = require('../../src/portal/tnega/tnega_browser_manager');
        const state = getTnegaState();
        if (state.page && !state.page.isClosed()) {
            const url = state.page.url();
            const title = await state.page.title();
            return res.json({ url, title, isWaitingForOtp: state.isWaitingForCanOtp });
        }
        res.status(404).json({ error: 'No active TNeGA page' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
