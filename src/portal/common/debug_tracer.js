// ============================================================================
// eSevaDraft Automated Visual Failure Tracer & DOM Inspector
// Captures full screenshot, DOM dump, and error diagnostics on portal failure
// ============================================================================

const fs = require('fs');
const path = require('path');

const FAILURES_DIR = path.join(process.cwd(), 'public', 'logs', 'failures');
if (!fs.existsSync(FAILURES_DIR)) {
    fs.mkdirSync(FAILURES_DIR, { recursive: true });
}

/**
 * Captures an instantaneous post-mortem snapshot of the Playwright page
 * @param {object} page - Playwright page instance
 * @param {string} stepName - e.g. 'STEP_8_DOC_UPLOAD', 'STEP_3_OTP_SUBMIT'
 * @param {Error|string} error - The caught error
 * @returns {object} { screenshotPath, domPath, tracePath }
 */
async function captureFailureSnapshot(page, stepName = 'UNKNOWN_STEP', error = null) {
    const timestamp = Date.now();
    const cleanStep = String(stepName).replace(/[^a-zA-Z0-9_-]/g, '_');
    const baseName = `${cleanStep}_${timestamp}`;

    const screenshotPath = path.join(FAILURES_DIR, `${baseName}.png`);
    const domPath = path.join(FAILURES_DIR, `${baseName}.html`);
    const tracePath = path.join(FAILURES_DIR, `${baseName}.json`);

    const result = {
        timestamp,
        stepName,
        errorMessage: error?.message || String(error || 'Unknown failure'),
        screenshotPath: null,
        domPath: null,
        tracePath: null
    };

    if (!page || typeof page.isClosed === 'function' && page.isClosed()) {
        console.warn(`[DebugTracer] Page is closed or invalid for ${stepName}`);
        return result;
    }

    try {
        // 1. Capture Full Page Screenshot
        await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
        if (fs.existsSync(screenshotPath)) result.screenshotPath = screenshotPath;
    } catch (e) {}

    try {
        // 2. Capture Full HTML DOM Dump
        const content = await page.content().catch(() => null);
        if (content) {
            fs.writeFileSync(domPath, content, 'utf8');
            result.domPath = domPath;
        }
    } catch (e) {}

    try {
        // 3. Save JSON Diagnostics Trace
        const diagnostics = {
            stepName,
            timestamp: new Date().toISOString(),
            currentUrl: page.url ? page.url() : 'unknown',
            errorMessage: error?.message || String(error || ''),
            errorStack: error?.stack || null,
            screenshotFile: result.screenshotPath ? path.basename(result.screenshotPath) : null,
            domFile: result.domPath ? path.basename(result.domPath) : null
        };
        fs.writeFileSync(tracePath, JSON.stringify(diagnostics, null, 2), 'utf8');
        result.tracePath = tracePath;
    } catch (e) {}

    console.log(`🚨 [DebugTracer] Captured Failure Diagnostics for ${stepName}:`);
    if (result.screenshotPath) console.log(`   📸 Screenshot: ${result.screenshotPath}`);
    if (result.domPath) console.log(`   📄 DOM Dump:   ${result.domPath}`);
    return result;
}

module.exports = {
    captureFailureSnapshot,
    FAILURES_DIR
};
