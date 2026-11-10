/**
 * eSevaDraft Enterprise In-Browser HUD Overlay for TNeGA
 * Module: src/portal/tnega/tnega_hud.js
 * 
 * Injects and updates a high-visibility, glassmorphic HUD directly on the portal's Chrome page.
 * Keeps operator informed of AI OCR, field filling, and OTP wait in real time.
 */

const HUD_STYLE = `
#eseva-automation-hud {
    position: fixed !important;
    top: 10px !important;
    right: 12px !important;
    z-index: 2147483647 !important;
    width: 270px !important;
    max-width: 85vw !important;
    background: rgba(15, 23, 42, 0.92) !important;
    backdrop-filter: blur(10px) !important;
    -webkit-backdrop-filter: blur(10px) !important;
    border: 1px solid rgba(59, 130, 246, 0.45) !important;
    border-radius: 10px !important;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5), 0 0 12px rgba(59, 130, 246, 0.2) !important;
    color: #ffffff !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Tamil Sangam MN", sans-serif !important;
    padding: 8px 11px !important;
    pointer-events: auto !important;
    user-select: none !important;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
    line-height: 1.3 !important;
}

#eseva-automation-hud .hud-header {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    margin-bottom: 5px !important;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
    padding-bottom: 4px !important;
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
    width: 7px !important;
    height: 7px !important;
    border-radius: 50% !important;
    background: #10b981 !important;
    box-shadow: 0 0 6px #10b981 !important;
    display: inline-block !important;
    animation: esevaPulse 1.6s infinite !important;
}

#eseva-automation-hud .hud-pulse-dot.working {
    background: #3b82f6 !important;
    box-shadow: 0 0 6px #3b82f6 !important;
}

#eseva-automation-hud .hud-pulse-dot.waiting {
    background: #f59e0b !important;
    box-shadow: 0 0 8px #f59e0b !important;
}

@keyframes esevaPulse {
    0% { transform: scale(0.95); opacity: 0.8; }
    50% { transform: scale(1.2); opacity: 1; }
    100% { transform: scale(0.95); opacity: 0.8; }
}

#eseva-automation-hud .hud-step-title {
    font-size: 12px !important;
    font-weight: 600 !important;
    color: #f8fafc !important;
    margin-bottom: 3px !important;
    display: flex !important;
    align-items: center !important;
    gap: 5px !important;
}

#eseva-automation-hud .hud-step-desc {
    font-size: 11px !important;
    color: #94a3b8 !important;
    margin-bottom: 2px !important;
    line-height: 1.3 !important;
}

#eseva-automation-hud .hud-badge {
    display: inline-block !important;
    font-size: 10px !important;
    padding: 2px 6px !important;
    border-radius: 5px !important;
    background: rgba(59, 130, 246, 0.2) !important;
    color: #93c5fd !important;
    border: 1px solid rgba(59, 130, 246, 0.3) !important;
    font-weight: 500 !important;
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

/**
 * Initializes the in-browser HUD on the page and binds it to automatic reload persistence.
 */
async function initTnegaHud(page) {
    if (!page || page.isClosed()) return;
    try {
        await page.addInitScript(({ css }) => {
            window.__ESEVA_HUD_CSS__ = css;
            window.__injectEsevaHud = function(title = 'நேரலை இயக்கம்', desc = 'தயாராகிறது...', badge = 'AI Active', type = 'working') {
                try {
                    let styleEl = document.getElementById('eseva-hud-style');
                    if (!styleEl) {
                        styleEl = document.createElement('style');
                        styleEl.id = 'eseva-hud-style';
                        styleEl.textContent = window.__ESEVA_HUD_CSS__ || '';
                        document.head ? document.head.appendChild(styleEl) : document.documentElement.appendChild(styleEl);
                    }
                    let el = document.getElementById('eseva-automation-hud');
                    if (!el) {
                        el = document.createElement('div');
                        el.id = 'eseva-automation-hud';
                        document.body ? document.body.appendChild(el) : document.documentElement.appendChild(el);
                    }
                    const dotClass = type === 'waiting' ? 'waiting' : (type === 'success' ? '' : 'working');
                    const badgeClass = type === 'waiting' ? 'otp-waiting' : (type === 'success' ? 'success' : '');
                    el.innerHTML = `
                        <div class="hud-header">
                            <div class="hud-brand">
                                <span class="hud-pulse-dot ${dotClass}"></span>
                                <span>eSevaDraft AI ஆட்டோமேஷன்</span>
                            </div>
                            <span class="hud-badge ${badgeClass}">${badge}</span>
                        </div>
                        <div class="hud-step-title">${title}</div>
                        <div class="hud-step-desc">${desc}</div>
                    `;
                } catch (_) {}
            };
        }, { css: HUD_STYLE }).catch(() => {});
    } catch (_) {}
}

/**
 * Updates the in-browser HUD with fresh step details.
 */
async function updateTnegaHud(page, { title = '', desc = '', badge = 'AI Active', type = 'working' } = {}) {
    if (!page || page.isClosed()) return;
    try {
        await page.evaluate(({ css, title, desc, badge, type }) => {
            try {
                let styleEl = document.getElementById('eseva-hud-style');
                if (!styleEl) {
                    styleEl = document.createElement('style');
                    styleEl.id = 'eseva-hud-style';
                    styleEl.textContent = css;
                    document.head ? document.head.appendChild(styleEl) : document.documentElement.appendChild(styleEl);
                }
                let el = document.getElementById('eseva-automation-hud');
                if (!el) {
                    el = document.createElement('div');
                    el.id = 'eseva-automation-hud';
                    document.body ? document.body.appendChild(el) : document.documentElement.appendChild(el);
                }
                const dotClass = type === 'waiting' ? 'waiting' : (type === 'success' ? '' : 'working');
                const badgeClass = type === 'waiting' ? 'otp-waiting' : (type === 'success' ? 'success' : '');
                el.innerHTML = `
                    <div class="hud-header">
                        <div class="hud-brand">
                            <span class="hud-pulse-dot ${dotClass}"></span>
                            <span>eSevaDraft AI ஆட்டோமேஷன்</span>
                        </div>
                        <span class="hud-badge ${badgeClass}">${badge}</span>
                    </div>
                    <div class="hud-step-title">${title}</div>
                    <div class="hud-step-desc">${desc}</div>
                `;
            } catch (_) {}
        }, { css: HUD_STYLE, title, desc, badge, type }).catch(() => {});
    } catch (_) {}
}

module.exports = {
    initTnegaHud,
    updateTnegaHud
};
