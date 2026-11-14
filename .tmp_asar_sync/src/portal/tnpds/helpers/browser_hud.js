/**
 * Browser HUD & Visual Banners for Operator Feedback
 */
const { exec } = require('child_process');

let defaultHudPage = null;
function setDefaultHudPage(p) { if (p && !p.isClosed()) defaultHudPage = p; }

async function showBrowserHud(title, subtitle = '', type = 'info', targetPage = null) {
    const activePage = targetPage || defaultHudPage;
    if (!activePage || activePage.isClosed()) return;
    try {
        await activePage.evaluate(({ title, subtitle, type }) => {
            const u = window.location.href.toLowerCase();
            if (u.includes('perfdrive') || u.includes('validate')) return;
            let hud = document.getElementById('esevadraft-browser-hud');
            const borderColor = type === 'success' ? '#22c55e' : (type === 'approval' || type === 'warning' ? '#f59e0b' : (type === 'error' ? '#ef4444' : '#38bdf8'));
            const iconSvg = type === 'success'
                ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>'
                : (type === 'approval' || type === 'warning'
                    ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>'
                    : (type === 'error'
                        ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>'
                        : '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle><path d="M12 2a10 10 0 0 1 10 10" stroke="#38bdf8"></path></svg>'
                    )
                );

            if (!hud) {
                hud = document.createElement('div');
                hud.id = 'esevadraft-browser-hud';
                hud.style.cssText = `
                    position: fixed; top: 12px; right: 24px; z-index: 2147483647;
                    height: 36px; box-sizing: border-box; background: rgba(15, 23, 42, 0.94);
                    backdrop-filter: blur(8px); border: 1.5px solid ${borderColor};
                    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35); border-radius: 8px; padding: 0 12px;
                    color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    display: inline-flex; align-items: center; gap: 8px; pointer-events: none;
                    transition: border-color 0.2s ease, opacity 0.2s ease; max-width: 60vw; white-space: nowrap;
                `;
                hud.innerHTML = `
                    <span id="eseva-hud-icon" style="display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px;">${iconSvg}</span>
                    <span id="eseva-hud-step-badge" style="display: none; font-size: 11px; font-weight: 800; background: #2563eb; color: #ffffff; padding: 2px 8px; border-radius: 6px;"></span>
                    <span id="eseva-hud-title" style="font-size: 12px; font-weight: 700; color: #f8fafc; letter-spacing: 0.1px;"></span>
                    <span id="eseva-hud-sub" style="font-size: 11.5px; font-weight: 500; color: #94a3b8; max-width: 700px; overflow: hidden; text-overflow: ellipsis;"></span>
                    <span style="font-size: 9.5px; font-weight: 700; background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); padding: 1px 6px; border-radius: 4px; text-transform: uppercase; margin-left: 4px;">eSeva</span>
                `;
                document.body.appendChild(hud);
            } else {
                hud.style.borderColor = borderColor;
                const iconEl = document.getElementById('eseva-hud-icon');
                if (iconEl) iconEl.innerHTML = iconSvg;
            }

            // Extract step if present e.g. [படி 18/51] or [படிகள் 9-13/51]
            const combined = `${title} ${subtitle}`;
            const stepMatch = combined.match(/(?:\[படி\s*|\bStep\s*)(\d+)(?:\s*-\s*\d+)?\s*\/\s*(\d+)\]/i);
            const badgeEl = document.getElementById('eseva-hud-step-badge');
            if (badgeEl) {
                if (stepMatch) {
                    badgeEl.innerText = `படி ${stepMatch[1]}/${stepMatch[2] || 51}`;
                    badgeEl.style.display = 'inline-block';
                } else {
                    badgeEl.style.display = 'none';
                }
            }

            const titleEl = document.getElementById('eseva-hud-title');
            if (titleEl) titleEl.textContent = title || '';
            const subEl = document.getElementById('eseva-hud-sub');
            if (subEl) subEl.textContent = subtitle ? ` • ${subtitle}` : '';

            hud.style.opacity = '1';
            hud.style.display = 'inline-flex';
        }, { title, subtitle, type }).catch(() => {});
    } catch (e) {}
}

async function hideBrowserHud(targetPage = null) {
    if (!targetPage || targetPage.isClosed()) return;
    try {
        await targetPage.evaluate(() => {
            const hud = document.getElementById('esevadraft-browser-hud');
            if (hud) {
                hud.style.opacity = '0';
                setTimeout(() => { if (hud) hud.style.display = 'none'; }, 200);
            }
        }).catch(() => {});
    } catch (e) {}
}

function forceWindowToFront() {
    try {
        exec('powershell -Command "$wshell = New-Object -ComObject WScript.Shell; $wshell.AppActivate(\'Public Distribution\'); $wshell.AppActivate(\'Home\'); $wshell.AppActivate(\'TNPDS\'); $wshell.AppActivate(\'Chrome\'); $wshell.AppActivate(\'eSevaDraft\')"');
    } catch (e) {}
}

async function injectVisualBanner(targetPage = null) {
    const activePage = targetPage || defaultHudPage;
    if (!activePage || activePage.isClosed()) return;
    try {
        await activePage.evaluate(() => {
            const u = window.location.href.toLowerCase();
            if (u.includes('perfdrive') || u.includes('validate')) return;
            if (document.getElementById('eseva-captcha-guide')) return;
            const b = document.createElement('div');
            b.id = 'eseva-captcha-guide';
            b.style.cssText = 'position:fixed; top:52px; right:24px; z-index:2147483647; height:34px; box-sizing:border-box; background:rgba(15,23,42,0.95); backdrop-filter:blur(8px); color:#f8fafc; padding:0 14px; border-radius:8px; box-shadow:0 4px 14px rgba(0,0,0,0.35); font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; font-size:12px; font-weight:700; display:inline-flex; align-items:center; gap:8px; border:1px solid #38bdf8; pointer-events:none; white-space:nowrap;';
            b.innerHTML = '<span style="color:#38bdf8;">🛡️</span> <span>"I am human" கட்டத்தைத் திக் செய்யவும்</span>';
            document.body.appendChild(b);
        });
    } catch (e) {}
}

module.exports = {
    showBrowserHud,
    hideBrowserHud,
    forceWindowToFront,
    injectVisualBanner,
    setDefaultHudPage
};
