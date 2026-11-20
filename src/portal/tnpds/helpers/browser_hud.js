/**
 * Browser HUD & Visual Banners for Operator Feedback
 */
const { exec } = require('child_process');
const { registerHudFaultBridge } = require('../../tnega/tnega_hud');

let defaultHudPage = null;
function setDefaultHudPage(p) { if (p && !p.isClosed()) defaultHudPage = p; }

async function showBrowserHud(title, subtitle = '', type = 'info', targetPage = null) {
    const activePage = targetPage || defaultHudPage;
    if (!activePage || activePage.isClosed()) return;
    try {
        await registerHudFaultBridge(activePage).catch(() => {});
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
                    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35); border-radius: 8px; padding: 0 10px 0 12px;
                    color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    display: inline-flex; align-items: center; gap: 8px; pointer-events: none;
                    transition: border-color 0.2s ease, opacity 0.2s ease; max-width: 72vw; white-space: nowrap;
                `;
                hud.innerHTML = `
                    <span id="eseva-hud-icon" style="display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px;">${iconSvg}</span>
                    <span id="eseva-hud-step-badge" style="display: none; font-size: 11px; font-weight: 800; background: #2563eb; color: #ffffff; padding: 2px 8px; border-radius: 6px;"></span>
                    <span id="eseva-hud-title" style="font-size: 12px; font-weight: 700; color: #f8fafc; letter-spacing: 0.1px;"></span>
                    <span id="eseva-hud-sub" style="font-size: 11.5px; font-weight: 500; color: #94a3b8; max-width: 520px; overflow: hidden; text-overflow: ellipsis;"></span>
                    <span style="font-size: 9.5px; font-weight: 700; background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); padding: 1px 6px; border-radius: 4px; text-transform: uppercase; margin-left: 2px;">eSeva</span>
                    <button type="button" id="esevaHudReportToggle" style="pointer-events: auto; background: rgba(239,68,68,0.22); color: #fecaca; border: 1px solid rgba(248,113,113,0.5); border-radius: 6px; padding: 3px 8px; font-size: 11px; font-weight: 700; cursor: pointer; margin-left: 4px;">🚨 பிழை தெரிவி</button>
                `;
                document.body.appendChild(hud);
            } else {
                hud.style.borderColor = borderColor;
                const iconEl = document.getElementById('eseva-hud-icon');
                if (iconEl) iconEl.innerHTML = iconSvg;
            }

            let drawer = document.getElementById('esevaHudReportBox');
            if (!drawer) {
                drawer = document.createElement('div');
                drawer.id = 'esevaHudReportBox';
                drawer.style.cssText = 'display:none; position:fixed; top:54px; right:24px; z-index:2147483647; width:330px; background:rgba(15,23,42,0.96); backdrop-filter:blur(10px); border:1px solid rgba(248,113,113,0.45); border-radius:10px; padding:10px; color:#f8fafc; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; box-shadow:0 10px 28px rgba(0,0,0,0.45); pointer-events:auto;';
                drawer.innerHTML = `
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;font-size:11.5px;font-weight:700;color:#fecaca;">
                        <span>🚨 பிழை / தாமதம் தெரிவிக்க</span>
                        <span id="esevaHudFaultToast" style="color:#86efac;font-size:10.5px;"></span>
                    </div>
                    <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:7px;">
                        <button type="button" class="eseva-tnpds-chip" data-msg="OTP வரவில்லை" style="background:#1e293b;color:#e2e8f0;border:1px solid #475569;border-radius:6px;padding:3px 6px;font-size:10.5px;cursor:pointer;">OTP வரவில்லை</button>
                        <button type="button" class="eseva-tnpds-chip" data-msg="பக்கம் சுற்றிக்கொண்டே உள்ளது" style="background:#1e293b;color:#e2e8f0;border:1px solid #475569;border-radius:6px;padding:3px 6px;font-size:10.5px;cursor:pointer;">பக்கம் சுற்றிக்கொண்டே உள்ளது</button>
                        <button type="button" class="eseva-tnpds-chip" data-msg="தவறான விவரம் / போர்ட்டல் பிழை" style="background:#1e293b;color:#e2e8f0;border:1px solid #475569;border-radius:6px;padding:3px 6px;font-size:10.5px;cursor:pointer;">தவறான விவரம் / பிழை</button>
                        <button type="button" class="eseva-tnpds-chip" data-msg="ஆவணம் அப்லோட் ஆகவில்லை" style="background:#1e293b;color:#e2e8f0;border:1px solid #475569;border-radius:6px;padding:3px 6px;font-size:10.5px;cursor:pointer;">ஆவணம் அப்லோட் ஆகவில்லை</button>
                    </div>
                    <div style="display:flex;gap:5px;">
                        <input type="text" id="esevaHudFaultNote" placeholder="என்ன பிரச்சனை? (தமிழ் / English)..." style="flex:1;min-width:0;background:#020617;color:#f8fafc;border:1px solid #475569;border-radius:6px;padding:5px 7px;font-size:11px;outline:none;">
                        <button type="button" id="esevaHudFaultSend" style="background:#dc2626;color:#fff;border:none;border-radius:6px;padding:5px 9px;font-size:11px;font-weight:700;cursor:pointer;">📤 அனுப்பு</button>
                    </div>
                `;
                document.body.appendChild(drawer);
            }

            if (hud && hud.dataset.faultWired !== '1') {
                hud.dataset.faultWired = '1';
                const btn = document.getElementById('esevaHudReportToggle');
                const noteEl = document.getElementById('esevaHudFaultNote');
                const sendEl = document.getElementById('esevaHudFaultSend');
                const toastEl = document.getElementById('esevaHudFaultToast');
                const sendFault = async (reasonText) => {
                    const cleaned = String(reasonText || (noteEl ? noteEl.value : '') || '').trim() || 'ஆபரேட்டர் பிழை அறிவிப்பு (TNPDS HUD)';
                    if (sendEl) sendEl.disabled = true;
                    if (toastEl) toastEl.textContent = '⏳ அனுப்புகிறது...';
                    try {
                        if (typeof window.__esevaReportHudFault === 'function') {
                            await window.__esevaReportHudFault({
                                reason: cleaned,
                                note: cleaned,
                                hudStepTitle: document.getElementById('eseva-hud-title')?.textContent || '',
                                hudStepDesc: document.getElementById('eseva-hud-sub')?.textContent || '',
                                url: window.location.href
                            });
                        }
                        if (noteEl) noteEl.value = '';
                        if (toastEl) toastEl.textContent = '✅ அனுப்பப்பட்டது!';
                        setTimeout(() => {
                            drawer.style.display = 'none';
                            if (toastEl) toastEl.textContent = '';
                        }, 2000);
                    } catch (_) {
                        if (toastEl) toastEl.textContent = '⚠️ தோல்வி';
                    } finally {
                        if (sendEl) sendEl.disabled = false;
                    }
                };
                if (btn) {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        drawer.style.display = drawer.style.display === 'block' ? 'none' : 'block';
                        if (drawer.style.display === 'block' && noteEl) setTimeout(() => noteEl.focus(), 30);
                    });
                }
                if (noteEl) {
                    noteEl.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') { e.preventDefault(); sendFault(noteEl.value); }
                    });
                }
                drawer.querySelectorAll('.eseva-tnpds-chip').forEach((ch) => {
                    ch.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const m = ch.getAttribute('data-msg') || ch.textContent || '';
                        if (noteEl) noteEl.value = m;
                        sendFault(m);
                    });
                });
                if (sendEl) {
                    sendEl.addEventListener('click', (e) => {
                        e.stopPropagation();
                        sendFault(noteEl ? noteEl.value : '');
                    });
                }
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
