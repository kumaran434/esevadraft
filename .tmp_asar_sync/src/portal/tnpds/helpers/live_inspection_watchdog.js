/**
 * src/portal/tnpds/helpers/live_inspection_watchdog.js
 * 
 * Autonomous Live Inspection & Self-Healing Watchdog Engine (eSeva Guardian)
 * Continuously monitors the live Playwright browser during government portal automations.
 * 
 * Capabilities:
 *  1. Auto-detects and auto-dismisses Captcha error modals ("தவறான கேப்ட்சா", "Invalid Captcha")
 *  2. Auto-refreshes captcha and resets input fields without operator intervention
 *  3. Auto-resolves Radware "I am human" challenges and session conflicts ("நீங்கள் வெளியேற விரும்புகிறீர்களா")
 *  4. Cleans up stuck modal backdrops that freeze user interactions
 *  5. Emits live health telemetries so the operator is NEVER left with a frozen or silent screen
 */

const { tryAutoClickCaptcha } = require('./captcha_multi_layer');

function startLiveInspectionWatchdog(page, options = {}, onProgress = () => {}) {
    if (!page) {
        return { stop: () => {}, getTelemetry: () => ({ isRunning: false }) };
    }

    let isChecking = false;
    let isStopped = false;
    let tickCount = 0;
    let lastCaptchaRecoveredAt = 0;
    let lastHeartbeatAt = Date.now();
    let currentStage = 'INIT';

    const telemetry = {
        isRunning: true,
        startedAt: new Date().toISOString(),
        totalRecoveries: 0,
        lastIntervention: null
    };

    const watchdogTimer = setInterval(async () => {
        if (isStopped) {
            clearInterval(watchdogTimer);
            return;
        }
        if (isChecking || !page || page.isClosed()) return;

        isChecking = true;
        tickCount++;

        try {
            // 1. Radware / Anomaly Check
            const isRadware = await page.evaluate(() => {
                const u = (window.location.href || '').toLowerCase();
                const b = (document.body && document.body.innerText) || '';
                return u.includes('perfdrive') || u.includes('validate.') || b.includes('ANOMALY DETECTED') || b.includes('Radware Captcha');
            }).catch(() => false);

            if (isRadware) {
                telemetry.lastIntervention = 'RADWARE_CHALLENGE';
                await tryAutoClickCaptcha(page).catch(() => {});
                if (tickCount % 5 === 0) {
                    onProgress('🛡️ [Live Watchdog] அரசு பாதுகாப்பு சோதனை ("I am human") திரையில் தானாக கண்காணிக்கப்பட்டு தீர்க்கப்படுகிறது...');
                }
                isChecking = false;
                return;
            }

            // 2. DOM Modal & Popup Inspection (Captcha Error / Session Conflict / Stray Backdrops)
            const inspectionResult = await page.evaluate(() => {
                const modalContainers = Array.from(document.querySelectorAll(
                    '.modal.show, .modal.in, .modal[style*="block"], .swal2-container, div[role="dialog"], [role="alertdialog"], .ui-dialog, .ui-confirm-dialog, .cdk-overlay-pane'
                ));

                const activeModal = modalContainers.find(m => {
                    const style = window.getComputedStyle(m);
                    return style.display !== 'none' && style.visibility !== 'hidden' && (m.offsetWidth > 0 || m.offsetHeight > 0);
                });

                if (!activeModal) {
                    // Check for stuck backdrops that block user clicks
                    const backdrops = Array.from(document.querySelectorAll('.modal-backdrop, .swal2-backdrop, .cdk-overlay-backdrop, .ui-widget-overlay'));
                    if (backdrops.length > 0 && modalContainers.length === 0) {
                        backdrops.forEach(b => b.remove());
                        document.body.classList.remove('modal-open');
                        document.body.style.overflow = '';
                        document.body.style.pointerEvents = '';
                        return { action: 'CLEARED_STRAY_BACKDROPS' };
                    }
                    return null;
                }

                const modalText = (activeModal.innerText || activeModal.textContent || '').trim();

                // 2a. Captcha Error Detection
                const isCaptchaError = modalText.includes('தவறான கேப்ட்சா') ||
                                       modalText.includes('கேப்ட்சா தவறானது') ||
                                       modalText.includes('Invalid Captcha') ||
                                       modalText.includes('Captcha does not match') ||
                                       modalText.includes('தவறான குறியீடு') ||
                                       (modalText.includes('கேப்ட்சா') && (modalText.includes('பிழை') || modalText.includes('தவறு')));

                // 2b. Session Conflict Detection
                const isConflict = modalText.includes('நீங்கள் வெளியேற விரும்புகிறீர்களா') ||
                                   modalText.includes('வெளியேற விரும்புகிறீர்களா') ||
                                   modalText.includes('ஏற்கனவே உள்நுழைந்து') ||
                                   modalText.includes('Do you want to logout') ||
                                   modalText.includes('terminate existing session');

                if (!isCaptchaError && !isConflict) {
                    return null;
                }

                // Find candidate button to dismiss
                const candidateButtons = Array.from(activeModal.querySelectorAll('button, a.btn, a, input[type="button"], input[type="submit"], [role="button"]'));
                const confirmBtn = candidateButtons.find(b => {
                    const bt = (b.innerText || b.textContent || b.value || b.getAttribute('aria-label') || '').trim();
                    const id = (b.id || '').toLowerCase();
                    const cls = (b.className || '').toString();
                    if (id === 'btnsendotp' || id === 'btnlogin' || bt.includes('OTP') || bt.includes('பதிவு செய்ய')) return false;

                    const isExplicit = bt === 'ஆம்' || bt === 'சரி' || bt === 'Yes' || bt === 'OK' || bt === 'உறுதி' || bt === 'Close' ||
                                       (bt.includes('ஆம்') && !bt.includes('இல்லை')) || (bt.includes('சரி') && !bt.includes('சரிபார்'));
                    if (isExplicit) return true;
                    if (cls.includes('swal2-confirm') || cls.includes('ui-confirmdialog-yes') || id.includes('confirmyes')) {
                        if (!bt.includes('இல்லை') && !bt.includes('ரத்து') && !bt.includes('No') && !bt.includes('Cancel')) return true;
                    }
                    return false;
                });

                if (confirmBtn) {
                    confirmBtn.removeAttribute('disabled');
                    confirmBtn.disabled = false;
                    confirmBtn.click();

                    if (isCaptchaError) {
                        window._tnpdsLastDismissedCaptchaError = Date.now();
                        // Clear the captcha input so Angular registers fresh state
                        const capInput = document.querySelector('input#captchaCode, input[formcontrolname="captchaCode"], input[formcontrolname="captcha"], input[name="captchaCode"], #captcha');
                        if (capInput) {
                            capInput.value = '';
                            capInput.dispatchEvent(new Event('input', { bubbles: true }));
                            capInput.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                        // Click refresh button if present
                        const refresh = document.querySelector('img[title*="கேப்ட்சா"], .captcha-refresh, a.refresh, #refreshCaptcha');
                        if (refresh) refresh.click();
                    }

                    setTimeout(() => {
                        document.querySelectorAll('.modal-backdrop, .swal2-backdrop, .cdk-overlay-backdrop, .ui-widget-overlay').forEach(bd => bd.remove());
                        document.body.classList.remove('modal-open');
                        document.body.style.overflow = '';
                        document.body.style.pointerEvents = '';
                    }, 300);

                    return {
                        action: isCaptchaError ? 'DISMISSED_CAPTCHA_ERROR' : 'DISMISSED_SESSION_CONFLICT',
                        text: modalText.slice(0, 80)
                    };
                }

                return null;
            }).catch(() => null);

            if (inspectionResult) {
                telemetry.totalRecoveries++;
                telemetry.lastIntervention = inspectionResult.action;

                if (inspectionResult.action === 'DISMISSED_CAPTCHA_ERROR') {
                    lastCaptchaRecoveredAt = Date.now();
                    onProgress('🛡️ [Live Watchdog] போர்ட்டல் கேப்ட்சா பிழை பாப்-அப் உடனடியாகத் தானாக ஏற்கப்பட்டது ("சரி" அழுத்தப்பட்டது). புதிய கேப்ட்சா AI மூலம் மீண்டும் பெறப்படுகிறது...');
                } else if (inspectionResult.action === 'DISMISSED_SESSION_CONFLICT') {
                    onProgress('🛡️ [Live Watchdog] போர்ட்டல் முந்தைய அமர்வு நீக்க அறிவிப்பு தானாக ஏற்கப்பட்டது ("ஆம்" அழுத்தப்பட்டது).');
                } else if (inspectionResult.action === 'CLEARED_STRAY_BACKDROPS') {
                    onProgress('🛡️ [Live Watchdog] திரையை முடக்கிய பின்னணி அடுக்கு (Stray Backdrop) பாதுகாப்பாக நீக்கப்பட்டது.');
                }
            }

            // 3. Heartbeat: If idle for 30s, emit gentle supervision heartbeat
            if (Date.now() - lastHeartbeatAt > 30000) {
                lastHeartbeatAt = Date.now();
                const urlSnapshot = (page.url() || '').toLowerCase();
                if (!urlSnapshot.includes('about:blank')) {
                    // Engine is actively watching
                    telemetry.lastHealthyTick = new Date().toISOString();
                }
            }

        } catch (e) {
            // Watchdog must never throw or break caller flow
        } finally {
            isChecking = false;
        }
    }, 1200);

    return {
        stop: () => {
            isStopped = true;
            clearInterval(watchdogTimer);
            telemetry.isRunning = false;
        },
        getTelemetry: () => telemetry,
        setStage: (stageName) => { currentStage = stageName; }
    };
}

module.exports = {
    startLiveInspectionWatchdog
};
