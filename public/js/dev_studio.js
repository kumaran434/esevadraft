function switchDevTab(tabName) {
    document.querySelectorAll('.dev-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.dev-panel').forEach(p => p.classList.remove('active-panel'));

    const btn = Array.from(document.querySelectorAll('.dev-tab')).find(b => b.getAttribute('onclick').includes(tabName));
    if (btn) btn.classList.add('active');

    const panel = document.getElementById('panel-' + tabName);
    if (panel) panel.classList.add('active-panel');

    if (tabName === 'inspector') loadOperatorErrors();
    if (tabName === 'publisher') loadGitStatus();
}

function handlePortalPreset(val) {
    const urlInput = document.getElementById('trainUrlInput');
    const svcInput = document.getElementById('trainServiceName');
    if (val === 'custom') {
        urlInput.value = '';
        urlInput.focus();
    } else {
        urlInput.value = val;
        if (val.includes('tnesevai')) svcInput.value = 'revenue_certificate';
        else if (val.includes('edistricts')) svcInput.value = 'edistrict_service';
        else if (val.includes('eservices')) svcInput.value = 'patta_chitta';
        else if (val.includes('tnpds')) svcInput.value = 'ration_card';
    }
}

async function startVisualTraining() {
    const url = document.getElementById('trainUrlInput').value.trim();
    const serviceName = document.getElementById('trainServiceName').value.trim() || 'custom_service';
    const btn = document.getElementById('btnStartTraining');
    const status = document.getElementById('trainStatusIndicator');
    const consoleBox = document.getElementById('trainConsoleOutput');

    if (!url) return alert('சரியான இணையதள URL-ஐ உள்ளிடவும்.');

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> கூகுள் குரோம் திறக்கிறது...';
    status.innerText = 'Chrome திறக்கப்படுகிறது... நீங்கள் முடித்ததும் பிரவுசரை மூடவும்.';
    consoleBox.style.display = 'block';
    consoleBox.innerText = 'Starting Playwright Recorder session for: ' + url + '...\n';

    try {
        const res = await fetch('/api/dev/train-start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, serviceName })
        });
        const data = await res.json();
        if (data.success) {
            consoleBox.innerText += '\n✅ பயிற்சி முடிவடைந்தது! பதிவான கோப்பு: ' + data.outputFile + '\n';
            status.innerText = '✅ பயிற்சி முடிந்தது!';
        } else {
            consoleBox.innerText += '\n❌ பிழை: ' + data.error + '\n';
            status.innerText = 'பிழை ஏற்பட்டது.';
        }
    } catch (e) {
        consoleBox.innerText += '\n❌ இணைப்புப் பிழை: ' + e.message + '\n';
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-play"></i> குரோம் பிரவுசரைத் திறந்து பயிற்சியைத் தொடங்கு (Start Training)';
    }
}

async function runLocalTest(type) {
    const consoleBox = document.getElementById('simConsoleOutput');
    consoleBox.innerText = '🚀 Starting local visible test [' + type + ']...\nஉங்கள் கணினித் திரையில் பிரவுசர் திறக்கும், கவனியுங்கள்...\n';

    try {
        const res = await fetch('/api/dev/test-run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type })
        });
        const data = await res.json();
        consoleBox.innerText += (data.output || data.message || JSON.stringify(data)) + '\n';
    } catch (e) {
        consoleBox.innerText += '❌ டெஸ்ட் தோல்வியடைந்தது: ' + e.message + '\n';
    }
}

function clearConsole(id) {
    const el = document.getElementById(id);
    if (el) el.innerText = '';
}

function escapeDevHtml(str) {
    return String(str || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function loadOperatorErrors() {
    const container = document.getElementById('snapshotContainer');
    const cloudContainer = document.getElementById('cloudTelemetryContainer');
    const loading = document.getElementById('inspectorLoading');
    const opFilter = document.getElementById('telemetryOpFilterInput')?.value?.trim() || '';
    if (loading) loading.style.display = 'block';

    try {
        const teleQuery = `/api/telemetry/errors?limit=40${opFilter ? `&operator=${encodeURIComponent(opFilter)}` : ''}`;
        const [snapRes, teleRes] = await Promise.all([
            fetch('/api/dev/errors'),
            fetch(teleQuery)
        ]);
        const data = await snapRes.json();
        const teleData = await teleRes.json();
        if (loading) loading.style.display = 'none';

        if (cloudContainer) {
            const teleErrors = (teleData && Array.isArray(teleData.errors)) ? teleData.errors : [];
            if (teleErrors.length === 0) {
                cloudContainer.innerHTML = '<div style="padding:12px;border-radius:8px;background:#0f172a;border:1px solid #334155;color:#94a3b8;font-size:12px;">Cloud Telemetry-இல் எரர்கள் எதுவும் இல்லை ✅</div>';
            } else {
                const badgeMap = {
                    OPERATOR_HUD_FAULT_REPORT: { label: '🚨 Chrome HUD புகார்', bg: '#7f1d1d', fg: '#fecaca' },
                    OPERATOR_MID_RUN_FEEDBACK: { label: '💬 ஆபரேட்டர் காரணம்', bg: '#78350f', fg: '#fde68a' },
                    AUTOMATION_ABANDONED_MID_RUN: { label: '⛔ Pre-Submit முன் நின்றது', bg: '#991b1b', fg: '#fee2e2' },
                    AUTOMATION_STUCK_WARNING: { label: '⏰ 120s Stuck Watchdog', bg: '#713f12', fg: '#fef08a' },
                    AUTOMATION_ORPHANED_APP_CLOSE: { label: '🔌 App பாதியில் மூடப்பட்டது', bg: '#581c87', fg: '#e9d5ff' }
                };
                cloudContainer.innerHTML = teleErrors.map(e => {
                    const b = badgeMap[e.errorType] || { label: e.errorType || 'ERROR', bg: '#1e293b', fg: '#fca5a5' };
                    return `
                    <div style="padding:12px;border-radius:8px;background:#0f172a;border:1px solid #475569;color:#e2e8f0;font-size:12px;">
                        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;margin-bottom:4px;">
                            <span style="font-weight:800;color:#fbbf24;">👤 ${escapeDevHtml(e.operatorName || 'unknown')} (${escapeDevHtml(e.operatorMobile || e.operatorKey || '-')})</span>
                            <span style="color:#94a3b8;font-size:11px;">v${escapeDevHtml(e.appVersion || '')} • ${escapeDevHtml((e.timestamp || '').replace('T', ' ').slice(0, 19))}</span>
                        </div>
                        <div style="display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:3px;">
                            <span style="background:${b.bg};color:${b.fg};padding:2px 7px;border-radius:5px;font-size:10.5px;font-weight:800;">${escapeDevHtml(b.label)}</span>
                            <span style="color:#f87171;font-weight:700;">${escapeDevHtml(e.serviceName ? e.serviceName + ' • ' : '')}${escapeDevHtml(e.step)}</span>
                        </div>
                        <div style="margin-top:4px;color:#fecaca;word-break:break-word;">${escapeDevHtml(e.errorMessage)}</div>
                        ${e.runId ? `<div style="margin-top:3px;font-size:10.5px;color:#64748b;">Run: ${escapeDevHtml(e.runId)}${e.portalUrl ? ` • URL: ${escapeDevHtml(e.portalUrl)}` : ''}</div>` : ''}
                        ${Array.isArray(e.lastUiActions) && e.lastUiActions.length ? `<div style="margin-top:6px;font-size:11px;color:#94a3b8;">கடைசி செயல்கள்: ${e.lastUiActions.slice(-4).map(a => escapeDevHtml(`${a.cat}:${a.action}`)).join(' → ')}</div>` : ''}
                    </div>
                `;
                }).join('');
            }
        }

        if (!data.errors || data.errors.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted); font-size: 13px;">ஸ்கிரீன்ஷாட் பிழைகள் எதுவும் இல்லை ✅</p>';
            return;
        }

        container.innerHTML = data.errors.map(err => `
            <div class="snapshot-card">
                <img class="snapshot-thumb" src="${err.imageUrl}" alt="Error Snapshot" onclick="openLightbox('${err.imageUrl}')">
                <div class="snapshot-info">
                    <div class="snapshot-title" title="${err.title}">${err.title}</div>
                    <div class="snapshot-time">📅 ${err.time}</div>
                    <div style="margin-top: 6px; font-size: 11.5px; color: #fca5a5;">${err.message || 'பிழை விவரம்'}</div>
                </div>
            </div>
        `).join('');
    } catch (e) {
        if (loading) loading.style.display = 'none';
        container.innerHTML = '<p style="color: #f87171;">பிழைகளைப் பெறுவதில் தோல்வி: ' + e.message + '</p>';
    }
}

function openLightbox(url) {
    const modal = document.getElementById('imgLightbox');
    const img = document.getElementById('lightboxImg');
    if (modal && img) {
        img.src = url;
        modal.style.display = 'flex';
    }
}

function closeLightbox() {
    const modal = document.getElementById('imgLightbox');
    if (modal) modal.style.display = 'none';
}

async function loadGitStatus() {
    try {
        const res = await fetch('/api/dev/status');
        const data = await res.json();
        document.getElementById('gitBranchDisplay').innerText = data.branch || 'main';
        document.getElementById('gitCommitHash').innerText = data.commitHash || '—';
        document.getElementById('gitStatusSummary').innerHTML = data.isClean 
            ? '<span style="color: #4ade80;">✅ அனைத்து மாற்றங்களும் சேமிக்கப்பட்டுள்ளன (Working tree clean)</span>' 
            : '<span style="color: #fbbf24;">⚠️ ' + (data.modifiedCount || 'சில') + ' புதிய மாற்றங்கள் பதிவேற்றத்திற்கு தயார் நிலையில் உள்ளன.</span>';
    } catch (e) {}
}

async function executeSafePublish() {
    const commitMsg = document.getElementById('publishCommitMsg').value.trim() || 'chore: live update';
    const btn = document.getElementById('btnPublishLive');
    const status = document.getElementById('publishStatusIndicator');
    const consoleBox = document.getElementById('publishConsoleOutput');

    const confirmed = confirm('🚀 நீங்கள் செய்த மாற்றங்களை Git-ல் சேமித்து Firebase Live Server-க்கு உடனே ஏற்ற விரும்புகிறீர்களா?');
    if (!confirmed) return;

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> நேரலையில் பதிவேற்றப்படுகிறது... காத்திருக்கவும்';
    status.innerText = 'Publishing to GitHub and Firebase Hosting...';
    consoleBox.style.display = 'block';
    consoleBox.innerText = 'Starting Safe Publish Pipeline...\n';

    try {
        const res = await fetch('/api/dev/publish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: commitMsg })
        });
        const data = await res.json();
        consoleBox.innerText += data.output || JSON.stringify(data);
        if (data.success) {
            status.innerHTML = '<span style="color: #4ade80; font-weight: 700;">🎉 நேரலையில் வெற்றிகரமாக பதிவேற்றப்பட்டது!</span>';
            loadGitStatus();
        } else {
            status.innerHTML = '<span style="color: #f87171;">❌ பதிவேற்றத்தில் பிழை ஏற்பட்டது.</span>';
        }
    } catch (e) {
        consoleBox.innerText += '\n❌ Error: ' + e.message;
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-rocket"></i> நேரலைக்கு ஏற்று (Publish to Live Server)';
    }
}

// Initialize status on load
loadGitStatus();
