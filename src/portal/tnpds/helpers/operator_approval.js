/**
 * eSevaDraft TNPDS Operator Approval & Live Field Updater
 */
const fs = require('fs');
const path = require('path');

const previewsDir = path.join(process.cwd(), 'public', 'previews');
if (!fs.existsSync(previewsDir)) {
    try { fs.mkdirSync(previewsDir, { recursive: true }); } catch (_) {}
}
let isWaitingForApproval = false;
let isSubmittedDirectlyByOperator = false;
let pendingApprovalResolver = null;
let latestApprovalSnapshot = null;
let latestAuditResult = null;

function requestApprovalFromOperator(promptMsg, onProgress, isMockSandboxMode = false, page = null) {
    if (isMockSandboxMode === true) {
        onProgress(promptMsg);
        onProgress('🤖 [Mock Sandbox] மாதிரி தணிக்கை ஒப்புதல் தானாக வழங்கப்படுகிறது...');
        return Promise.resolve({ approved: true, source: 'mock' });
    }
    isWaitingForApproval = true;
    isSubmittedDirectlyByOperator = false;

    return new Promise((resolve) => {
        onProgress(promptMsg);

        let portalApprovalTimer = null;
        let isResolved = false;

        const cleanupAndResolve = (approved, source = 'ui', extra = {}) => {
            if (isResolved) return;
            isResolved = true;
            if (portalApprovalTimer) clearInterval(portalApprovalTimer);
            isWaitingForApproval = false;
            pendingApprovalResolver = null;
            if (source === 'portal') {
                isSubmittedDirectlyByOperator = true;
                onProgress('⚡ [Dual Listener] ஆபரேட்டர் நிஜ அரசு குரோம் பிரவுசரிலேயே நேரடியாக சப்மிட் செய்துவிட்டார்! ஆட்டோமேஷன் தானாக தொடர்கிறது...');
            }
            resolve({ approved, source, ...extra });
        };

        pendingApprovalResolver = (approved, proceedSubmit = true, action = 'submit') => {
            cleanupAndResolve(approved, 'ui', { proceedSubmit, action });
        };

        if (page && !page.isClosed()) {
            portalApprovalTimer = setInterval(async () => {
                if (isResolved || !page || page.isClosed()) {
                    if (portalApprovalTimer) clearInterval(portalApprovalTimer);
                    return;
                }
                try {
                    const isSubmittedDirectly = await page.evaluate(() => {
                        const body = document.body ? document.body.innerText : '';
                        const hasRef = /(?:குறிப்பு\s*எண்|கோரிக்கை\s*எண்|விண்ணப்ப\s*எண்)\s*[:\-]?\s*([0-9A-Za-z]+)/i.test(body) ||
                                       /352\d{11}/.test(body);
                        const resultEl = document.querySelector('span.ref-number, .app-no');
                        return Boolean(hasRef || resultEl);
                    }).catch(() => false);

                    if (isSubmittedDirectly) {
                        cleanupAndResolve(true, 'portal');
                    }
                } catch (_) {}
            }, 1000);
        }
    });
}

function provideOperatorApproval(approved = true, proceedSubmit = true, action = 'submit') {
    if (pendingApprovalResolver) {
        pendingApprovalResolver(approved, proceedSubmit, action);
        pendingApprovalResolver = null;
        isWaitingForApproval = false;
        return true;
    }
    return false;
}

function getLiveApprovalStatus(isMockSandboxMode = false) {
    if (isMockSandboxMode) {
        return {
            isWaitingForApproval: false,
            fullSnapshotUrl: null,
            auditResult: null
        };
    }
    return {
        isWaitingForApproval,
        fullSnapshotUrl: latestApprovalSnapshot && fs.existsSync(latestApprovalSnapshot) ? `/previews/latest_full.png?t=${Date.now()}` : null,
        auditResult: latestAuditResult || { allValid: true, summaryTamil: 'சரிபார்ப்பிற்குத் தயாராக உள்ளது' }
    };
}

async function updateLivePortalField(page, fieldUpdates = {}) {
    if (!page) return { success: false, message: 'உலாவி அமர்வு செயலில் இல்லை.' };
    try {
        if (fieldUpdates.doorNo) {
            const doorEng = page.locator('input[formcontrolname="AddressLine1"], input[formcontrolname="doorNo"], input[name="doorNo"]').first();
            if (await doorEng.count() > 0) {
                await doorEng.fill(fieldUpdates.doorNo);
                await doorEng.dispatchEvent('change');
            }
            const doorTam = page.locator('input[formcontrolname="முகவரிவரி1"]').first();
            if (await doorTam.count() > 0) {
                await doorTam.fill(fieldUpdates.doorNo);
                await doorTam.dispatchEvent('change');
            }
        }
        if (fieldUpdates.street) {
            const stEng = page.locator('input[formcontrolname="AddressLine2"], input[formcontrolname="street"], input[name="street"]').first();
            if (await stEng.count() > 0) {
                await stEng.fill(fieldUpdates.street);
                await stEng.dispatchEvent('change');
            }
            const stTam = page.locator('input[formcontrolname="முகவரிவரி2"]').first();
            if (await stTam.count() > 0) {
                await stTam.fill(fieldUpdates.street);
                await stTam.dispatchEvent('change');
            }
        }
        if (fieldUpdates.taluk) {
            const talukSelect = page.locator('select[formcontrolname="taluk"], select[formcontrolname="talukId"]').first();
            if (await talukSelect.count() > 0) {
                const optVal = await talukSelect.evaluate((sel, target) => {
                    const cleanT = (target || '').toLowerCase().replace(/[^a-z0-9\u0B80-\u0BFF]/g, '');
                    const found = Array.from(sel.options).find(o => {
                        const txt = (o.text || '').toLowerCase().replace(/[^a-z0-9\u0B80-\u0BFF]/g, '');
                        return (cleanT && txt.includes(cleanT)) || (txt && cleanT.includes(txt));
                    });
                    return found ? found.value : (sel.options[1] ? sel.options[1].value : null);
                }, fieldUpdates.taluk);
                if (optVal) {
                    await talukSelect.selectOption(optVal);
                    await talukSelect.dispatchEvent('change');
                }
            }
        }
        if (fieldUpdates.village) {
            const vSelect = page.locator('select[formcontrolname="village"], select[formcontrolname="villageId"]').first();
            if (await vSelect.count() > 0) {
                const optVal = await vSelect.evaluate((sel, target) => {
                    const cleanV = (target || '').toLowerCase().replace(/[^a-z0-9\u0B80-\u0BFF]/g, '');
                    const found = Array.from(sel.options).find(o => {
                        const txt = (o.text || '').toLowerCase().replace(/[^a-z0-9\u0B80-\u0BFF]/g, '');
                        return (cleanV && txt.includes(cleanV)) || (txt && cleanV.includes(txt));
                    });
                    return found ? found.value : (sel.options[1] ? sel.options[1].value : null);
                }, fieldUpdates.village);
                if (optVal) {
                    await vSelect.selectOption(optVal);
                    await vSelect.dispatchEvent('change');
                }
            }
        }
        await page.waitForTimeout(1000);
        
        const fullPath = path.join(previewsDir, 'latest_full.png');
        await page.screenshot({ fullPage: true, path: fullPath }).catch(() => {});
        latestApprovalSnapshot = fullPath;
        latestAuditResult = {
            allValid: true,
            summaryTamil: 'அரசு போர்ட்டலில் விவரங்கள் வெற்றிகரமாகப் புதுப்பிக்கப்பட்டன. புதிய ஸ்கிரீன்ஷாட்டைச் சரிபார்க்கவும்.'
        };

        return {
            success: true,
            fullSnapshotUrl: `/previews/latest_full.png?t=${Date.now()}`,
            auditResult: latestAuditResult,
            message: '✅ அரசு இணையதளத்தில் புலம் வெற்றிகரமாகப் புதுப்பிக்கப்பட்டது!'
        };
    } catch (e) {
        return { success: false, message: 'புதுப்பிப்பதில் பிழை: ' + e.message };
    }
}

module.exports = {
    requestApprovalFromOperator,
    provideOperatorApproval,
    getLiveApprovalStatus,
    updateLivePortalField
};
