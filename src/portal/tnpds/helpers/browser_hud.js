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
            const isErr = type === 'error';
            const isWarn = type === 'approval' || type === 'warning';
            const isOk = type === 'success';
            const borderColor = isOk ? '#22c55e' : (isWarn ? '#f59e0b' : (isErr ? '#ef4444' : '#38bdf8'));
            const bgColor = isErr ? 'rgba(69, 10, 10, 0.96)' : 'rgba(15, 23, 42, 0.94)';
            const subColor = isErr ? '#fecaca' : (isWarn ? '#fde68a' : (isOk ? '#bbf7d0' : '#cbd5e1'));
            const iconSvg = type === 'success'
                ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>'
                : (isWarn
                    ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>'
                    : (isErr
                        ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>'
                        : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle><path d="M12 2a10 10 0 0 1 10 10" stroke="#38bdf8"></path></svg>'
                    )
                );

            if (!hud) {
                hud = document.createElement('div');
                hud.id = 'esevadraft-browser-hud';
                hud.style.cssText = `
                    position: fixed; top: 10px; right: 12px; z-index: 2147483647;
                    width: 295px; max-width: 88vw; box-sizing: border-box;
                    background: ${bgColor}; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
                    border: ${isErr ? '2px' : '1.5px'} solid ${borderColor};
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.52); border-radius: 10px; padding: 9px 11px;
                    color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Tamil Sangam MN", sans-serif;
                    display: flex; flex-direction: column; gap: 6px; pointer-events: none;
                    transition: border-color 0.2s ease, background-color 0.2s ease, opacity 0.2s ease;
                    line-height: 1.35;
                `;
                hud.innerHTML = `
                    <div style="display:flex; align-items:center; justify-content:space-between; gap:6px; border-bottom:1px solid rgba(255,255,255,0.12); padding-bottom:5px;">
                        <div style="display:flex; align-items:center; gap:6px; min-width:0;">
                            <span id="eseva-hud-icon" style="display:inline-flex; align-items:center; justify-content:center; width:15px; height:15px; flex-shrink:0;">${iconSvg}</span>
                            <span id="eseva-hud-title" style="font-size:11.5px; font-weight:800; color:#f8fafc; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"></span>
                        </div>
                        <div style="display:flex; align-items:center; gap:4px; flex-shrink:0;">
                            <span id="eseva-hud-step-badge" style="display:none; font-size:10px; font-weight:800; background:#2563eb; color:#ffffff; padding:2px 6px; border-radius:5px;"></span>
                            <span id="eseva-hud-error-tag" style="display:none; font-size:10px; font-weight:800; background:#dc2626; color:#ffffff; padding:2px 6px; border-radius:5px;">🔴 பிழை</span>
                            <button type="button" id="esevaHudReportToggle" style="pointer-events:auto; background:rgba(239,68,68,0.22); color:#fecaca; border:1px solid rgba(248,113,113,0.55); border-radius:5px; padding:2px 7px; font-size:10.5px; font-weight:700; cursor:pointer;">🚨 பிழை</button>
                        </div>
                    </div>
                    <div id="eseva-hud-sub" style="font-size:11px; font-weight:600; color:${subColor}; white-space:normal; word-break:break-word; line-height:1.4; max-height:125px; overflow-y:auto;"></div>
                `;
                document.body.appendChild(hud);
            } else {
                hud.style.borderColor = borderColor;
                hud.style.borderWidth = isErr ? '2px' : '1.5px';
                hud.style.background = bgColor;
                hud.style.boxShadow = isErr
                    ? '0 8px 26px rgba(220, 38, 38, 0.45), 0 0 0 1px rgba(239,68,68,0.35)'
                    : '0 8px 24px rgba(0, 0, 0, 0.52)';
                const iconEl = document.getElementById('eseva-hud-icon');
                if (iconEl) iconEl.innerHTML = iconSvg;
                const subStyleEl = document.getElementById('eseva-hud-sub');
                if (subStyleEl) subStyleEl.style.color = subColor;
            }

            const errTagEl = document.getElementById('eseva-hud-error-tag');
            if (errTagEl) errTagEl.style.display = isErr ? 'inline-block' : 'none';

            let drawer = document.getElementById('esevaHudReportBox');
            if (!drawer) {
                drawer = document.createElement('div');
                drawer.id = 'esevaHudReportBox';
                drawer.style.cssText = 'display:none; position:fixed; top:112px; right:12px; z-index:2147483647; width:295px; max-width:88vw; box-sizing:border-box; background:rgba(15,23,42,0.97); backdrop-filter:blur(10px); border:1px solid rgba(248,113,113,0.5); border-radius:10px; padding:10px; color:#f8fafc; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; box-shadow:0 10px 28px rgba(0,0,0,0.48); pointer-events:auto;';
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
            const cleanSub = String(subtitle || '').replace(/\*\*/g, '').replace(/\s*\n\s*/g, ' ').trim();
            const subEl = document.getElementById('eseva-hud-sub');
            if (subEl) subEl.textContent = cleanSub;

            hud.style.opacity = '1';
            hud.style.display = 'flex';
            if (drawer && hud) {
                const rect = hud.getBoundingClientRect();
                if (rect && rect.bottom > 0) drawer.style.top = `${Math.round(rect.bottom + 6)}px`;
            }
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
            b.style.cssText = 'position:fixed; top:112px; right:12px; z-index:2147483647; width:295px; max-width:88vw; box-sizing:border-box; background:rgba(15,23,42,0.95); backdrop-filter:blur(8px); color:#f8fafc; padding:8px 12px; border-radius:10px; box-shadow:0 4px 14px rgba(0,0,0,0.35); font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; font-size:11.5px; font-weight:700; display:flex; align-items:center; gap:8px; border:1px solid #38bdf8; pointer-events:none; white-space:normal; line-height:1.35;';
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
