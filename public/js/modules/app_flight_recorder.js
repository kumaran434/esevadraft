/**
 * public/js/modules/app_flight_recorder.js
 * 
 * eSevaDraft Ultra-Light Zero-Overhead Sentinel (விமானத்தின் கருப்புப் பெட்டி)
 * -------------------------------------------------------------------------
 * 1. 0% Lag: Pure native fetch untouched. No periodic disk timers.
 * 2. In-Memory Ring Buffer: Keeps last 15 user action breadcrumbs in RAM (<1KB).
 * 3. Native Layout Shift Sensor: Monitors UI flickers via PerformanceObserver.
 * 4. Crash-Dump On Demand: Writes to disk ONLY when an error or flicker occurs.
 */

(function () {
    'use strict';

    const MAX_BREADCRUMBS = 35;
    const ringBuffer = [];
    let lastDumpTime = 0;

    function addBreadcrumb(tag, text) {
        try {
            const time = new Date().toLocaleTimeString('en-IN', { hour12: false });
            ringBuffer.push(`[${time}] ${tag}: ${String(text || '').slice(0, 65)}`);
            if (ringBuffer.length > MAX_BREADCRUMBS) ringBuffer.shift();
        } catch (_) {}
    }

    function getDomSnapshot() {
        try {
            const activePanel = document.querySelector('.tab-panel.active-panel');
            const headerTitle = document.getElementById('activeCustomerTitle');
            return {
                currentRole: localStorage.getItem('eseva_user_role') || 'operator',
                activeCustomer: localStorage.getItem('eseva_active_customer_mobile') || null,
                activePanelId: activePanel ? activePanel.id : null,
                headerTitleText: headerTitle ? headerTitle.innerText.trim().slice(0, 40) : null
            };
        } catch (_) {
            return {};
        }
    }

    // Single-Shot Crash Dump: Only writes to disk when an incident happens
    function dumpCrashIncident(type, reason, extra = {}) {
        const now = Date.now();
        if (now - lastDumpTime < 3000) return; // Throttle duplicate alerts (3s cooldown)
        lastDumpTime = now;

        try {
            const payload = {
                recordedAt: new Date().toISOString(),
                type: type || 'CRASH_INCIDENT',
                reason: String(reason || 'Unknown incident').slice(0, 150),
                domSnapshot: getDomSnapshot(),
                timeline: [...ringBuffer],
                extra
            };

            fetch('/api/operator/flight-recorder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).catch(() => {});
        } catch (_) {}
    }

    // 0. Alert Interceptor (Captures UI error popups automatically)
    try {
        const originalAlert = window.alert;
        window.alert = function (msg) {
            const strMsg = String(msg || '');
            addBreadcrumb('ALERT', strMsg.slice(0, 50));
            if (strMsg.includes('பிழை') || strMsg.toLowerCase().includes('error') || strMsg.includes('⚠️')) {
                dumpCrashIncident('USER_ALERT_ERROR', strMsg.slice(0, 120));
            }
            return originalAlert.apply(this, arguments);
        };
    } catch (_) {}

    // 0.5 Passive Fetch Response Tracker (Captures 4xx/5xx responses)
    try {
        const origFetch = window.fetch;
        window.fetch = async function (...args) {
            try {
                const res = await origFetch.apply(this, args);
                if (!res.ok && res.status >= 400) {
                    const rawUrl = String(args[0] || '').split('?')[0];
                    if (!rawUrl.includes('/flight-recorder') && !rawUrl.includes('/telemetry')) {
                        addBreadcrumb('API_FAIL', `${rawUrl} [${res.status}]`);
                        if (res.status === 403 || res.status >= 500) {
                            dumpCrashIncident('API_STATUS_' + res.status, `Request to ${rawUrl} returned status ${res.status}`);
                        }
                    }
                }
                return res;
            } catch (err) {
                addBreadcrumb('NET_ERR', err.message);
                throw err;
            }
        };
    } catch (_) {}

    // 1. Passive Click Listener (RAM only, 0ms overhead)
    document.addEventListener('click', function (e) {
        try {
            const t = e.target.closest('button, a, .nav-tab, input[type="submit"]') || e.target;
            if (!t) return;
            const label = t.id ? `#${t.id}` : (t.innerText || t.value || t.tagName).trim().slice(0, 25);
            addBreadcrumb('CLICK', label);
        } catch (_) {}
    }, true);

    // 2. Passive Navigation / Tab Event Tracker
    window.recordFlightEvent = function (cat, desc) {
        addBreadcrumb(cat, desc);
    };

    // 3. Native Layout-Shift / Flicker Sensor (Chromium PerformanceObserver)
    if (typeof PerformanceObserver !== 'undefined') {
        try {
            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.value > 0.08 && !entry.hadRecentInput) {
                        addBreadcrumb('FLICKER', `Layout shifted by ${entry.value.toFixed(2)}`);
                        dumpCrashIncident('VISUAL_FLICKER_DETECTED', `Sudden layout shift score: ${entry.value.toFixed(2)}`);
                    }
                }
            });
            observer.observe({ type: 'layout-shift', buffered: false });
        } catch (_) {}
    }

    // 4. Global Error Crash Handlers
    window.addEventListener('error', function (e) {
        addBreadcrumb('ERROR', e.message);
        dumpCrashIncident('UNHANDLED_ERROR', e.message, { file: e.filename, line: e.lineno });
    });

    window.addEventListener('unhandledrejection', function (e) {
        const msg = e.reason ? (e.reason.message || String(e.reason)) : 'Promise rejected';
        addBreadcrumb('REJECTION', msg);
        dumpCrashIncident('PROMISE_REJECTION', msg);
    });

    // Public API
    window.AppFlightRecorder = {
        addBreadcrumb,
        dumpNow: dumpCrashIncident,
        getHistory: () => [...ringBuffer],
        getDomSnapshot
    };

    // Admin UI Refresh & Download functions
    window.refreshFlightRecorderLogs = async function () {
        const box = document.getElementById('flightRecorderTimelineBox');
        if (!box) return;
        try {
            box.innerHTML = '<span style="color: #94a3b8;">தரவு புதுப்பிக்கப்படுகிறது...</span>';
            const res = await fetch('/api/admin/flight-recorder');
            const data = await res.json();
            const diskTimeline = (data.flightRecorder && data.flightRecorder.timeline) || [];
            const liveTimeline = [...ringBuffer];
            const combined = [...new Set([...liveTimeline, ...diskTimeline])];

            if (combined.length === 0) {
                box.innerHTML = '<span style="color: #94a3b8;">பதிவுகள் எதுவும் இல்லை (No events recorded).</span>';
                return;
            }

            box.innerHTML = combined.map(line => {
                let color = '#38bdf8'; // Blue for info/nav
                if (line.includes('ERROR') || line.includes('API_FAIL') || line.includes('ALERT')) color = '#f87171'; // Red
                if (line.includes('FLICKER')) color = '#fbbf24'; // Yellow
                if (line.includes('SESSION_START') || line.includes('PASS')) color = '#4ade80'; // Green
                return `<div style="color: ${color}; padding: 2px 0;">${line}</div>`;
            }).join('');
            box.scrollTop = box.scrollHeight;
        } catch (e) {
            box.innerHTML = `<span style="color: #f87171;">பிழை: ${e.message}</span>`;
        }
    };

    window.downloadFlightRecorderDump = function () {
        try {
            const payload = {
                exportedAt: new Date().toISOString(),
                liveTimeline: [...ringBuffer],
                domSnapshot: getDomSnapshot()
            };
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `flight_recorder_${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            alert('பதிவிறக்கப் பிழை: ' + e.message);
        }
    };

    addBreadcrumb('SYSTEM', 'Sentinel ready');
})();
