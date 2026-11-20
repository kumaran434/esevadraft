/**
 * eSevaDraft Enterprise In-Browser HUD Overlay for TNeGA
 * Module: src/portal/tnega/tnega_hud.js
 * 
 * Injects and updates a high-visibility, glassmorphic HUD directly on the portal's Chrome page.
 * Keeps operator informed of AI OCR, field filling, and OTP wait in real time.
 * Features Immortal Persistence: Survives page reloads (F5), redirects, and ASP.NET postbacks via sessionStorage.
 */

const HUD_STYLE = `
#eseva-automation-hud {
    position: fixed !important;
    top: 10px !important;
    right: 12px !important;
    z-index: 2147483647 !important;
    width: 285px !important;
    max-width: 88vw !important;
    background: rgba(15, 23, 42, 0.94) !important;
    backdrop-filter: blur(12px) !important;
    -webkit-backdrop-filter: blur(12px) !important;
    border: 1px solid rgba(59, 130, 246, 0.5) !important;
    border-radius: 10px !important;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.55), 0 0 12px rgba(59, 130, 246, 0.25) !important;
    color: #ffffff !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Tamil Sangam MN", sans-serif !important;
    padding: 9px 12px !important;
    pointer-events: auto !important;
    user-select: none !important;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
    line-height: 1.35 !important;
}

#eseva-automation-hud .hud-header {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    margin-bottom: 6px !important;
    border-bottom: 1px solid rgba(255, 255, 255, 0.12) !important;
    padding-bottom: 5px !important;
}

#eseva-automation-hud .hud-brand {
    display: flex !important;
    align-items: center !important;
    gap: 6px !important;
    font-size: 11px !important;
    font-weight: 700 !important;
    color: #60a5fa !important;
    letter-spacing: 0.2px !important;
}

#eseva-automation-hud .hud-pulse-dot {
    width: 8px !important;
    height: 8px !important;
    border-radius: 50% !important;
    background: #10b981 !important;
    box-shadow: 0 0 6px #10b981 !important;
    display: inline-block !important;
    animation: esevaPulse 1.5s infinite !important;
}

#eseva-automation-hud .hud-pulse-dot.working {
    background: #3b82f6 !important;
    box-shadow: 0 0 8px #3b82f6 !important;
}

#eseva-automation-hud .hud-pulse-dot.waiting {
    background: #f59e0b !important;
    box-shadow: 0 0 8px #f59e0b !important;
}

@keyframes esevaPulse {
    0% { transform: scale(0.92); opacity: 0.75; }
    50% { transform: scale(1.25); opacity: 1; }
    100% { transform: scale(0.92); opacity: 0.75; }
}

#eseva-automation-hud .hud-step-title {
    font-size: 12px !important;
    font-weight: 600 !important;
    color: #f8fafc !important;
    margin-bottom: 4px !important;
    display: flex !important;
    align-items: center !important;
    gap: 5px !important;
}

#eseva-automation-hud .hud-step-desc {
    font-size: 11px !important;
    color: #cbd5e1 !important;
    margin-bottom: 2px !important;
    line-height: 1.35 !important;
}

#eseva-automation-hud .hud-badge {
    display: inline-block !important;
    font-size: 10px !important;
    padding: 2px 7px !important;
    border-radius: 5px !important;
    background: rgba(59, 130, 246, 0.25) !important;
    color: #93c5fd !important;
    border: 1px solid rgba(59, 130, 246, 0.35) !important;
    font-weight: 600 !important;
}

#eseva-automation-hud .hud-badge.otp-waiting {
    background: rgba(245, 158, 11, 0.25) !important;
    color: #fde68a !important;
    border-color: rgba(245, 158, 11, 0.45) !important;
}

#eseva-automation-hud .hud-badge.success {
    background: rgba(16, 185, 129, 0.25) !important;
    color: #a7f3d0 !important;
    border-color: rgba(16, 185, 129, 0.45) !important;
}
`;

const HUD_FAULT_STYLE = `
#eseva-automation-hud .hud-fault-wrap,
#eseva-automation-hud .hud-fault-wrap * {
    pointer-events: auto !important;
    box-sizing: border-box !important;
}
#eseva-automation-hud .hud-fault-wrap {
    margin-top: 8px !important;
    padding-top: 7px !important;
    border-top: 1px solid rgba(148, 163, 184, 0.22) !important;
}
#eseva-automation-hud .hud-fault-bar {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    gap: 8px !important;
}
#eseva-automation-hud .hud-report-btn {
    background: rgba(239, 68, 68, 0.20) !important;
    color: #fecaca !important;
    border: 1px solid rgba(248, 113, 113, 0.48) !important;
    border-radius: 7px !important;
    padding: 4px 9px !important;
    font-size: 11px !important;
    font-weight: 700 !important;
    cursor: pointer !important;
    line-height: 1.3 !important;
}
#eseva-automation-hud .hud-report-btn:hover {
    background: rgba(239, 68, 68, 0.36) !important;
}
#eseva-automation-hud .hud-fault-toast {
    font-size: 10.5px !important;
    font-weight: 700 !important;
    color: #86efac !important;
}
#eseva-automation-hud .hud-fault-box {
    margin-top: 7px !important;
    background: rgba(2, 6, 23, 0.78) !important;
    border: 1px solid rgba(148, 163, 184, 0.30) !important;
    border-radius: 9px !important;
    padding: 8px !important;
}
#eseva-automation-hud .hud-fault-chips {
    display: flex !important;
    flex-wrap: wrap !important;
    gap: 4px !important;
    margin-bottom: 6px !important;
}
#eseva-automation-hud .hud-fault-chip {
    background: rgba(30, 41, 59, 0.96) !important;
    color: #e2e8f0 !important;
    border: 1px solid rgba(100, 116, 139, 0.5) !important;
    border-radius: 6px !important;
    padding: 3px 6px !important;
    font-size: 10.5px !important;
    font-weight: 600 !important;
    cursor: pointer !important;
    line-height: 1.25 !important;
}
#eseva-automation-hud .hud-fault-chip:hover {
    background: rgba(51, 65, 85, 0.98) !important;
    border-color: #f87171 !important;
}
#eseva-automation-hud .hud-fault-row {
    display: flex !important;
    gap: 5px !important;
    align-items: center !important;
}
#eseva-automation-hud .hud-fault-input {
    flex: 1 !important;
    min-width: 0 !important;
    background: rgba(15, 23, 42, 0.96) !important;
    color: #f8fafc !important;
    border: 1px solid rgba(148, 163, 184, 0.45) !important;
    border-radius: 6px !important;
    padding: 5px 7px !important;
    font-size: 11px !important;
    outline: none !important;
}
#eseva-automation-hud .hud-fault-send {
    background: #dc2626 !important;
    color: #ffffff !important;
    border: none !important;
    border-radius: 6px !important;
    padding: 5px 9px !important;
    font-size: 11px !important;
    font-weight: 700 !important;
    cursor: pointer !important;
    white-space: nowrap !important;
}
`;

const HUD_FAULT_FOOTER_HTML = `
    <div class="hud-fault-wrap">
        <div class="hud-fault-bar">
            <button type="button" id="esevaHudReportToggle" class="hud-report-btn">🚨 பிழை தெரிவி</button>
            <span id="esevaHudFaultToast" class="hud-fault-toast"></span>
        </div>
        <div id="esevaHudReportBox" class="hud-fault-box" style="display:none;">
            <div class="hud-fault-chips">
                <button type="button" class="hud-fault-chip" data-msg="OTP வரவில்லை">OTP வரவில்லை</button>
                <button type="button" class="hud-fault-chip" data-msg="பக்கம் சுற்றிக்கொண்டே உள்ளது">பக்கம் சுற்றிக்கொண்டே உள்ளது</button>
                <button type="button" class="hud-fault-chip" data-msg="தவறான விவரம் / CAN பிழை">தவறான விவரம் / CAN பிழை</button>
                <button type="button" class="hud-fault-chip" data-msg="ஆவணம் அப்லோட் ஆகவில்லை">ஆவணம் அப்லோட் ஆகவில்லை</button>
            </div>
            <div class="hud-fault-row">
                <input type="text" id="esevaHudFaultNote" class="hud-fault-input" placeholder="என்ன பிரச்சனை? (தமிழ் / English)..." />
                <button type="button" id="esevaHudFaultSend" class="hud-fault-send">📤 அனுப்பு</button>
            </div>
        </div>
    </div>
`;

/**
 * Registers Playwright exposeFunction bridge so Chrome HUD fault reports bypass govt portal CSP/CORS cleanly.
 */
async function registerHudFaultBridge(page) {
    if (!page || (typeof page.isClosed === 'function' && page.isClosed())) return;
    if (page.__esevaHudFaultExposed || typeof page.exposeFunction !== 'function') return;
    try {
        await page.exposeFunction('__esevaReportHudFault', async (payload = {}) => {
            try {
                let safeUrl = payload.url || '';
                if (!safeUrl && typeof page.url === 'function') {
                    try { safeUrl = page.url(); } catch (_) {}
                }
                const enriched = {
                    ...payload,
                    portalUrl: safeUrl,
                    timestamp: new Date().toISOString()
                };
                if (typeof global.__esevaHudFaultHandler === 'function') {
                    await global.__esevaHudFaultHandler(enriched);
                    return { ok: true };
                }
                const { logOperatorError } = require('../../services/db/telemetry_store');
                await logOperatorError({
                    errorType: 'OPERATOR_HUD_FAULT_REPORT',
                    step: enriched.hudStepTitle || 'CHROME_HUD_REPORT',
                    serviceName: enriched.serviceName || '',
                    portalUrl: enriched.portalUrl,
                    errorMessage: enriched.reason || enriched.note || 'Operator reported issue via Chrome HUD',
                    timestamp: enriched.timestamp
                });
                return { ok: true };
            } catch (err) {
                return { ok: false, error: err?.message || 'HUD fault relay error' };
            }
        });
        page.__esevaHudFaultExposed = true;
    } catch (err) {
        if (/already been registered/i.test(err?.message || '')) {
            page.__esevaHudFaultExposed = true;
        }
    }
}

/**
 * Initializes the in-browser HUD on the page and binds it to automatic reload persistence.
 */
async function initTnegaHud(page) {
    if (!page || (typeof page.isClosed === 'function' && page.isClosed())) return;
    await registerHudFaultBridge(page).catch(() => {});
    try {
        await page.addInitScript(({ css, faultHtml }) => {
            window.__ESEVA_HUD_CSS__ = css;
            window.__ESEVA_HUD_FAULT_HTML__ = faultHtml;

            function attachHudFaultEvents(rootEl) {
                if (!rootEl || rootEl.dataset.faultWired === '1') return;
                rootEl.dataset.faultWired = '1';
                const toggleBtn = rootEl.querySelector('#esevaHudReportToggle');
                const box = rootEl.querySelector('#esevaHudReportBox');
                const noteInput = rootEl.querySelector('#esevaHudFaultNote');
                const sendBtn = rootEl.querySelector('#esevaHudFaultSend');
                const toastEl = rootEl.querySelector('#esevaHudFaultToast');

                try {
                    if (box && sessionStorage.getItem('__eseva_hud_report_open') === '1') {
                        box.style.display = 'block';
                    }
                    const savedNote = sessionStorage.getItem('__eseva_hud_fault_note');
                    if (noteInput && savedNote) noteInput.value = savedNote;
                } catch (_) {}

                async function sendFault(reasonText) {
                    const cleaned = String(reasonText || (noteInput ? noteInput.value : '') || '').trim() || 'ஆபரேட்டர் பிழை அறிவிப்பு (Chrome HUD)';
                    const stepTitle = rootEl.querySelector('.hud-step-title')?.textContent || '';
                    const stepDesc = rootEl.querySelector('.hud-step-desc')?.textContent || '';
                    if (sendBtn) sendBtn.disabled = true;
                    if (toastEl) toastEl.textContent = '⏳ அனுப்புகிறது...';
                    try {
                        if (typeof window.__esevaReportHudFault === 'function') {
                            await window.__esevaReportHudFault({
                                reason: cleaned,
                                note: cleaned,
                                hudStepTitle: stepTitle,
                                hudStepDesc: stepDesc,
                                url: window.location.href
                            });
                        }
                        if (noteInput) noteInput.value = '';
                        try {
                            sessionStorage.removeItem('__eseva_hud_fault_note');
                            sessionStorage.setItem('__eseva_hud_report_open', '0');
                        } catch (_) {}
                        if (toastEl) toastEl.textContent = '✅ டெவலப்பருக்கு அனுப்பப்பட்டது!';
                        setTimeout(() => {
                            if (box) box.style.display = 'none';
                            if (toastEl) toastEl.textContent = '';
                        }, 2200);
                    } catch (_) {
                        if (toastEl) toastEl.textContent = '⚠️ அனுப்ப முடியவில்லை';
                    } finally {
                        if (sendBtn) sendBtn.disabled = false;
                    }
                }

                if (toggleBtn && box) {
                    toggleBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const isOpen = box.style.display === 'block';
                        box.style.display = isOpen ? 'none' : 'block';
                        try { sessionStorage.setItem('__eseva_hud_report_open', isOpen ? '0' : '1'); } catch (_) {}
                        if (!isOpen && noteInput) setTimeout(() => noteInput.focus(), 30);
                    });
                }
                if (noteInput) {
                    noteInput.addEventListener('input', () => {
                        try { sessionStorage.setItem('__eseva_hud_fault_note', noteInput.value); } catch (_) {}
                    });
                    noteInput.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            sendFault(noteInput.value);
                        }
                    });
                }
                rootEl.querySelectorAll('.hud-fault-chip').forEach((chip) => {
                    chip.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const msg = chip.getAttribute('data-msg') || chip.textContent || '';
                        if (noteInput) noteInput.value = msg;
                        sendFault(msg);
                    });
                });
                if (sendBtn) {
                    sendBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        sendFault(noteInput ? noteInput.value : '');
                    });
                }
            }

            window.__esevaAttachHudFaultEvents = attachHudFaultEvents;

            function renderHud(title, desc, badge, type) {
                try {
                    let styleEl = document.getElementById('eseva-hud-style');
                    if (!styleEl) {
                        styleEl = document.createElement('style');
                        styleEl.id = 'eseva-hud-style';
                        styleEl.textContent = window.__ESEVA_HUD_CSS__ || '';
                        (document.head || document.documentElement).appendChild(styleEl);
                    }
                    let el = document.getElementById('eseva-automation-hud');
                    const dotClass = type === 'waiting' ? 'waiting' : (type === 'success' ? '' : 'working');
                    const badgeClass = type === 'waiting' ? 'otp-waiting' : (type === 'success' ? 'success' : '');
                    if (!el) {
                        el = document.createElement('div');
                        el.id = 'eseva-automation-hud';
                        el.innerHTML = `
                            <div class="hud-header">
                                <div class="hud-brand">
                                    <span class="hud-pulse-dot ${dotClass}"></span>
                                    <span>eSevaDraft AI ஆட்டோமேஷன்</span>
                                </div>
                                <span class="hud-badge ${badgeClass}">${badge || 'AI Active'}</span>
                            </div>
                            <div class="hud-step-title">${title || 'நேரலை இயக்கம்'}</div>
                            <div class="hud-step-desc">${desc || 'தானியங்கி செயல்முறை தொடர்கிறது...'}</div>
                            ${window.__ESEVA_HUD_FAULT_HTML__ || ''}
                        `;
                        (document.body || document.documentElement).appendChild(el);
                        attachHudFaultEvents(el);
                    } else {
                        const dot = el.querySelector('.hud-pulse-dot');
                        const bdg = el.querySelector('.hud-badge');
                        const tEl = el.querySelector('.hud-step-title');
                        const dEl = el.querySelector('.hud-step-desc');
                        if (dot) dot.className = `hud-pulse-dot ${dotClass}`;
                        if (bdg) {
                            bdg.className = `hud-badge ${badgeClass}`;
                            bdg.textContent = badge || 'AI Active';
                        }
                        if (tEl) tEl.textContent = title || 'நேரலை இயக்கம்';
                        if (dEl) dEl.textContent = desc || 'தானியங்கி செயல்முறை தொடர்கிறது...';
                        if (!el.querySelector('#esevaHudReportToggle') && window.__ESEVA_HUD_FAULT_HTML__) {
                            el.insertAdjacentHTML('beforeend', window.__ESEVA_HUD_FAULT_HTML__);
                        }
                        attachHudFaultEvents(el);
                    }
                } catch (_) {}
            }

            window.__injectEsevaHud = renderHud;

            // Auto-mount on load from sessionStorage cache so it NEVER disappears on F5 / reload
            const autoMount = () => {
                try {
                    let parsed = null;
                    try {
                        const raw = sessionStorage.getItem('__eseva_hud_state');
                        if (raw) parsed = JSON.parse(raw);
                    } catch (_) {}
                    if (parsed) {
                        renderHud(parsed.title, parsed.desc, parsed.badge, parsed.type);
                    } else {
                        renderHud('⚡ AI நேரலை ஆட்டோமேஷன்', 'செயல்முறை இயங்குகிறது...', 'AI Active', 'working');
                    }
                } catch (_) {}
            };

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', autoMount);
            } else {
                autoMount();
            }

            // Periodic watchdog: if ASP.NET update panels or document reloads wipe the DOM element, restore it!
            if (!window.__esevaHudWatchdog) {
                window.__esevaHudWatchdog = setInterval(() => {
                    try {
                        if (!document.getElementById('eseva-automation-hud')) {
                            autoMount();
                        }
                    } catch (_) {}
                }, 500);
            }
        }, { css: HUD_STYLE + HUD_FAULT_STYLE, faultHtml: HUD_FAULT_FOOTER_HTML }).catch(() => {});
    } catch (_) {}
}

/**
 * Updates the in-browser HUD with fresh step details and commits state to sessionStorage.
 */
async function updateTnegaHud(page, { title = '', desc = '', badge = 'AI Active', type = 'working' } = {}) {
    if (!page || (typeof page.isClosed === 'function' && page.isClosed())) return;
    await registerHudFaultBridge(page).catch(() => {});
    try {
        await page.evaluate(({ css, faultHtml, title, desc, badge, type }) => {
            try {
                try { sessionStorage.setItem('__eseva_hud_state', JSON.stringify({ title, desc, badge, type })); } catch (_) {}
                window.__ESEVA_HUD_CSS__ = css;
                window.__ESEVA_HUD_FAULT_HTML__ = faultHtml;
                if (typeof window.__injectEsevaHud === 'function') {
                    window.__injectEsevaHud(title, desc, badge, type);
                } else {
                    let styleEl = document.getElementById('eseva-hud-style');
                    if (!styleEl) {
                        styleEl = document.createElement('style');
                        styleEl.id = 'eseva-hud-style';
                        styleEl.textContent = css;
                        (document.head || document.documentElement).appendChild(styleEl);
                    }
                    let el = document.getElementById('eseva-automation-hud');
                    const dotClass = type === 'waiting' ? 'waiting' : (type === 'success' ? '' : 'working');
                    const badgeClass = type === 'waiting' ? 'otp-waiting' : (type === 'success' ? 'success' : '');
                    if (!el) {
                        el = document.createElement('div');
                        el.id = 'eseva-automation-hud';
                        el.innerHTML = `
                            <div class="hud-header">
                                <div class="hud-brand">
                                    <span class="hud-pulse-dot ${dotClass}"></span>
                                    <span>eSevaDraft AI ஆட்டோமேஷன்</span>
                                </div>
                                <span class="hud-badge ${badgeClass}">${badge || 'AI Active'}</span>
                            </div>
                            <div class="hud-step-title">${title || 'நேரலை இயக்கம்'}</div>
                            <div class="hud-step-desc">${desc || 'தானியங்கி செயல்முறை தொடர்கிறது...'}</div>
                            ${faultHtml}
                        `;
                        (document.body || document.documentElement).appendChild(el);
                    } else {
                        const dot = el.querySelector('.hud-pulse-dot');
                        const bdg = el.querySelector('.hud-badge');
                        const tEl = el.querySelector('.hud-step-title');
                        const dEl = el.querySelector('.hud-step-desc');
                        if (dot) dot.className = `hud-pulse-dot ${dotClass}`;
                        if (bdg) {
                            bdg.className = `hud-badge ${badgeClass}`;
                            bdg.textContent = badge || 'AI Active';
                        }
                        if (tEl) tEl.textContent = title || 'நேரலை இயக்கம்';
                        if (dEl) dEl.textContent = desc || 'தானியங்கி செயல்முறை தொடர்கிறது...';
                        if (!el.querySelector('#esevaHudReportToggle')) {
                            el.insertAdjacentHTML('beforeend', faultHtml);
                        }
                    }
                    if (!el.dataset.faultWired) {
                        el.dataset.faultWired = '1';
                        const toggleBtn = el.querySelector('#esevaHudReportToggle');
                        const box = el.querySelector('#esevaHudReportBox');
                        const noteInput = el.querySelector('#esevaHudFaultNote');
                        const sendBtn = el.querySelector('#esevaHudFaultSend');
                        const toastEl = el.querySelector('#esevaHudFaultToast');
                        const sendFault = async (reasonText) => {
                            const cleaned = String(reasonText || (noteInput ? noteInput.value : '') || '').trim() || 'ஆபரேட்டர் பிழை அறிவிப்பு (Chrome HUD)';
                            if (sendBtn) sendBtn.disabled = true;
                            if (toastEl) toastEl.textContent = '⏳ அனுப்புகிறது...';
                            try {
                                if (typeof window.__esevaReportHudFault === 'function') {
                                    await window.__esevaReportHudFault({
                                        reason: cleaned,
                                        note: cleaned,
                                        hudStepTitle: el.querySelector('.hud-step-title')?.textContent || '',
                                        hudStepDesc: el.querySelector('.hud-step-desc')?.textContent || '',
                                        url: window.location.href
                                    });
                                }
                                if (noteInput) noteInput.value = '';
                                if (toastEl) toastEl.textContent = '✅ டெவலப்பருக்கு அனுப்பப்பட்டது!';
                                setTimeout(() => {
                                    if (box) box.style.display = 'none';
                                    if (toastEl) toastEl.textContent = '';
                                }, 2200);
                            } catch (_) {
                                if (toastEl) toastEl.textContent = '⚠️ அனுப்ப முடியவில்லை';
                            } finally {
                                if (sendBtn) sendBtn.disabled = false;
                            }
                        };
                        if (toggleBtn && box) {
                            toggleBtn.addEventListener('click', (e) => {
                                e.stopPropagation();
                                box.style.display = box.style.display === 'block' ? 'none' : 'block';
                            });
                        }
                        if (noteInput) {
                            noteInput.addEventListener('keydown', (e) => {
                                if (e.key === 'Enter') { e.preventDefault(); sendFault(noteInput.value); }
                            });
                        }
                        el.querySelectorAll('.hud-fault-chip').forEach((chip) => {
                            chip.addEventListener('click', (e) => {
                                e.stopPropagation();
                                const msg = chip.getAttribute('data-msg') || chip.textContent || '';
                                if (noteInput) noteInput.value = msg;
                                sendFault(msg);
                            });
                        });
                        if (sendBtn) {
                            sendBtn.addEventListener('click', (e) => {
                                e.stopPropagation();
                                sendFault(noteInput ? noteInput.value : '');
                            });
                        }
                    }
                }
            } catch (_) {}
        }, { css: HUD_STYLE + HUD_FAULT_STYLE, faultHtml: HUD_FAULT_FOOTER_HTML, title, desc, badge, type }).catch(() => {});
    } catch (_) {}
}

module.exports = {
    initTnegaHud,
    updateTnegaHud,
    registerHudFaultBridge
};
