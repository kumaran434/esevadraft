/**
 * public/js/modules/field_lab_ui.js
 *
 * Isolated Frontend UI Controller for #toolPane-field-lab inside #panel-tools.
 * Strictly communicates ONLY with /api/lab/* endpoints.
 * Zero interference with active drafts, chat workflow, or production runners.
 */

(function (window) {
    'use strict';

    let labPollTimer = null;

    const PRESETS = {
        'tnpds-head-change': {
            portalName: 'TNPDS ரேஷன் போர்ட்டல்',
            serviceName: 'குடும்பத் தலைவர் மாற்றம் (Head Change)',
            portalUrl: 'https://www.tnpds.gov.in'
        },
        'tnpds-remove-member': {
            portalName: 'TNPDS ரேஷன் போர்ட்டல்',
            serviceName: 'குடும்ப உறுப்பினர் நீக்கம் (Remove Member)',
            portalUrl: 'https://www.tnpds.gov.in'
        },
        'tnega-revenue-new': {
            portalName: 'TNeGA இ-சேவை போர்ட்டல்',
            serviceName: 'புதிய வருவாய்த் துறை சான்றிதழ்',
            portalUrl: 'https://www.tnesevai.tn.gov.in'
        },
        'eci-voter-new': {
            portalName: 'ECI வாக்காளர் போர்ட்டல்',
            serviceName: 'புதிய வாக்காளர் அட்டை (Form 6)',
            portalUrl: 'https://voters.eci.gov.in'
        }
    };

    window.applyFieldLabPreset = function (key) {
        const preset = PRESETS[key];
        if (!preset) return;
        const nameEl = document.getElementById('labServiceNameInput');
        const urlEl = document.getElementById('labPortalUrlInput');
        const portalEl = document.getElementById('labPortalNameInput');
        if (nameEl) nameEl.value = preset.serviceName;
        if (urlEl) urlEl.value = preset.portalUrl;
        if (portalEl) portalEl.value = preset.portalName;
    };

    function setLabStatusBanner(st) {
        const box = document.getElementById('labLiveStatusBox');
        const btnStart = document.getElementById('btnLabStartRec');
        const btnCap = document.getElementById('btnLabCaptureNow');
        const btnStop = document.getElementById('btnLabStopRec');
        if (!box) return;

        if (st && st.isRecording) {
            box.style.background = '#fef2f2';
            box.style.borderColor = '#fca5a5';
            box.innerHTML = `
                <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
                    <div style="display:flex;align-items:center;gap:8px;">
                        <span style="width:10px;height:10px;border-radius:50%;background:#dc2626;display:inline-block;"></span>
                        <strong style="color:#991b1b;font-size:12.5px;">🔴 பதிவு நடக்கிறது: ${escapeLabHtml(st.serviceName || 'Portal')}</strong>
                    </div>
                    <span style="font-size:11.5px;font-weight:700;color:#7f1d1d;">
                        பக்கங்கள்: ${st.stepsCaptured || 0} | கிளிக்குகள்: ${st.clicksCaptured || 0} | Zero-PII ✅
                    </span>
                </div>
                <div style="font-size:11px;color:#7f1d1d;margin-top:4px;word-break:break-all;">
                    🌐 கடைசிப் பக்கம்: ${escapeLabHtml(st.lastUrl || '—')}
                </div>`;
            if (btnStart) btnStart.style.display = 'none';
            if (btnCap) btnCap.style.display = 'inline-flex';
            if (btnStop) btnStop.style.display = 'inline-flex';
        } else {
            box.style.background = '#f8fafc';
            box.style.borderColor = '#cbd5e1';
            box.innerHTML = `
                <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
                    <strong style="color:#0f172a;font-size:12.5px;">🧪 தனிமைப்படுத்தப்பட்ட Lab தயார் நிலை (Main App-உடன் தொடர்பில்லை)</strong>
                    <span style="font-size:11px;font-weight:700;color:#059669;">🔒 Aadhaar / OTP / Phone எதுவும் சேமிக்கப்படாது</span>
                </div>`;
            if (btnStart) btnStart.style.display = 'inline-flex';
            if (btnCap) btnCap.style.display = 'none';
            if (btnStop) btnStop.style.display = 'none';
        }
    }

    function escapeLabHtml(str) {
        return String(str || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    window.openFieldLabPanel = function () {
        const modals = [
            'operatorDraftsModal',
            'newCustomerModal',
            'tnegaCanSearchModal',
            'directApplyServiceModal',
            'tnegaPortalVaultModal',
            'operatorProfileModal'
        ];
        modals.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
        if (typeof window.switchTab === 'function') {
            window.switchTab('field-lab');
        } else {
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active-panel'));
            const panel = document.getElementById('panel-field-lab');
            if (panel) panel.classList.add('active-panel');
        }
        if (typeof window.refreshFieldLabState === 'function') {
            window.refreshFieldLabState();
        }
    };

    window.refreshFieldLabState = async function () {
        try {
            const [stRes, bpRes] = await Promise.all([
                fetch('/api/lab/status'),
                fetch('/api/lab/blueprints?includeCloud=1')
            ]);
            const st = await stRes.json();
            const bp = await bpRes.json();
            setLabStatusBanner(st);
            renderFieldLabBlueprints(bp.blueprints || []);
            if (st.isRecording && !labPollTimer) {
                labPollTimer = setInterval(() => window.refreshFieldLabState(), 3000);
            } else if (!st.isRecording && labPollTimer) {
                clearInterval(labPollTimer);
                labPollTimer = null;
            }
        } catch (_) {}
    };

    window.startFieldLabSession = async function () {
        const serviceName = document.getElementById('labServiceNameInput')?.value?.trim() || 'New Portal Service';
        const portalUrl = document.getElementById('labPortalUrlInput')?.value?.trim() || 'https://www.tnesevai.tn.gov.in';
        const portalName = document.getElementById('labPortalNameInput')?.value?.trim() || 'Government Portal';
        const operatorLabel = (localStorage.getItem('eseva_center_name') || localStorage.getItem('eseva_last_auth_email') || 'Operator Lab').trim();
        try {
            const res = await fetch('/api/lab/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ portalUrl, portalName, serviceName, operatorLabel })
            });
            const data = await res.json();
            if (!data.success) {
                alert('⚠️ Lab தொடங்க முடியவில்லை: ' + (data.error || 'Unknown error'));
                return;
            }
            setLabStatusBanner(data.status);
            if (!labPollTimer) {
                labPollTimer = setInterval(() => window.refreshFieldLabState(), 3000);
            }
        } catch (e) {
            alert('⚠️ Lab பிழை: ' + e.message);
        }
    };

    window.captureFieldLabPage = async function () {
        try {
            const res = await fetch('/api/lab/capture', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                setLabStatusBanner(data.status);
            } else {
                alert('⚠️ ' + (data.error || 'பக்கத்தைக் கைப்பற்ற முடியவில்லை'));
            }
        } catch (e) {
            alert('⚠️ ' + e.message);
        }
    };

    window.stopFieldLabSession = async function () {
        try {
            const res = await fetch('/api/lab/stop', { method: 'POST' });
            const data = await res.json();
            if (labPollTimer) {
                clearInterval(labPollTimer);
                labPollTimer = null;
            }
            await window.refreshFieldLabState();
            if (data.success && data.blueprint) {
                const cloudNote = data.blueprint.cloudSynced
                    ? '☁️ Cloud-ல் வெற்றிகரமாக சேமிக்கப்பட்டது ✅'
                    : '💾 Local-ல் சேமிக்கப்பட்டது (Offline — இணையம் வந்ததும் Cloud Sync அழுத்தவும்)';
                alert(`✅ Blueprint சேமிக்கப்பட்டது!\n\nசேவை: ${data.blueprint.serviceName}\nபக்கங்கள்: ${data.blueprint.stepsCount}\nகிளிக்குகள்: ${data.blueprint.clicksCount}\nZero-PII பாதுகாப்பு: 100% ✅\n${cloudNote}`);
            }
        } catch (e) {
            alert('⚠️ ' + e.message);
        }
    };

    window.downloadFieldLabBlueprint = function (id) {
        window.open(`/api/lab/blueprints/${encodeURIComponent(id)}`, '_blank');
    };

    window.retryCloudSyncFieldLabBlueprint = async function (id) {
        try {
            const res = await fetch(`/api/lab/blueprints/${encodeURIComponent(id)}/retry-sync`, { method: 'POST' });
            const data = await res.json();
            await window.refreshFieldLabState();
            if (data.success && data.cloudSynced) {
                alert('☁️ Blueprint வெற்றிகரமாக Cloud-ல் சேமிக்கப்பட்டது ✅');
            } else {
                alert('⚠️ Cloud Sync முடியவில்லை: ' + (data.error || 'இணைய இணைப்பைச் சரிபார்க்கவும்'));
            }
        } catch (e) {
            alert('⚠️ ' + e.message);
        }
    };

    window.deleteFieldLabBlueprint = async function (id) {
        if (!confirm('இந்த Blueprint-ஐ நீக்கவா?')) return;
        await fetch(`/api/lab/blueprints/${encodeURIComponent(id)}`, { method: 'DELETE' });
        window.refreshFieldLabState();
    };

    function renderFieldLabBlueprints(items) {
        const listEl = document.getElementById('labBlueprintsList');
        if (!listEl) return;
        if (!items || items.length === 0) {
            listEl.innerHTML = `<div style="text-align:center;padding:18px;color:#64748b;font-size:12px;background:#f8fafc;border-radius:10px;border:1px dashed #cbd5e1;">இன்னும் எந்த Blueprint-ம் பதிவு செய்யப்படவில்லை. மேலே "🔴 பதிவு தொடங்கு" அழுத்தி Chrome-ல் சாதாரணமாகப் படிவம் நிரப்பினால் போதும்!</div>`;
            return;
        }
        listEl.innerHTML = items.map(item => `
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 12px;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;flex-wrap:wrap;">
                <div>
                    <div style="font-size:12.5px;font-weight:800;color:#0f172a;">
                        📋 ${escapeLabHtml(item.serviceName)}
                        <span style="margin-left:6px;background:#ecfdf5;color:#047857;border:1px solid #a7f3d0;font-size:10px;padding:1px 7px;border-radius:999px;">Zero-PII ✅</span>
                        ${item.cloudSynced
                            ? '<span style="margin-left:4px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;font-size:10px;padding:1px 7px;border-radius:999px;">☁️ Cloud Synced ✅</span>'
                            : '<span style="margin-left:4px;background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;font-size:10px;padding:1px 7px;border-radius:999px;">💾 Local Only</span>'}
                    </div>
                    <div style="font-size:11px;color:#64748b;margin-top:2px;">
                        ${escapeLabHtml(item.portalName)} • பக்கங்கள்: <b>${item.stepsCount}</b> • கிளிக்குகள்: <b>${item.clicksCount}</b> • ${escapeLabHtml((item.completedAt || '').slice(0, 19).replace('T', ' '))}
                    </div>
                </div>
                <div style="display:flex;gap:6px;">
                    ${!item.cloudSynced ? `<button type="button" onclick="retryCloudSyncFieldLabBlueprint('${escapeLabHtml(item.id)}')" style="height:30px;padding:0 10px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:7px;font-size:11px;font-weight:700;cursor:pointer;">☁️ Cloud Sync</button>` : ''}
                    <button type="button" onclick="downloadFieldLabBlueprint('${escapeLabHtml(item.id)}')" style="height:30px;padding:0 11px;background:#eef2ff;color:#4f46e5;border:1px solid #c7d2fe;border-radius:7px;font-size:11px;font-weight:700;cursor:pointer;">
                        📥 JSON பார் / சேமி
                    </button>
                    <button type="button" onclick="deleteFieldLabBlueprint('${escapeLabHtml(item.id)}')" style="height:30px;padding:0 10px;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:7px;font-size:11px;font-weight:700;cursor:pointer;">
                        🗑️
                    </button>
                </div>
            </div>
        `).join('');
    }
})(window);
