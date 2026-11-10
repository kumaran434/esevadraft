/**
 * header_nav_manager.js
 * Centralized, reliable header navigation and state manager for eSevaDraft.
 * Strictly compliant with: < 300 lines modular architecture.
 */

(function (window) {
    'use strict';

    /**
     * Updates the header buttons based on active tab, role, and active customer status.
     * @param {string} tab - Current active tab ('operator', 'citizen', 'locker', 'admin', 'auth')
     * @param {string} role - Current role ('operator', 'citizen')
     */
    function updateHeaderNavigationState(tab, role) {
        const isAuthScreenVisible = (function () {
            const auth = document.getElementById('authScreen');
            return auth && auth.style.display !== 'none';
        })();

        const currentRole = role || localStorage.getItem('eseva_user_role') || 'citizen';
        const isOp = currentRole === 'operator';
        const activeCustMob = localStorage.getItem('eseva_active_customer_mobile');
        const hasActiveCustomer = Boolean(activeCustMob && activeCustMob.trim().length >= 10);
        const currentTab = tab || (isOp ? 'operator' : 'citizen');

        const btnBackDesk = document.getElementById('btnBackToOperator');
        const btnSaveDraft = document.getElementById('btnSaveDraftTop');
        const btnHome = document.getElementById('btnHeaderHome');
        const btnTools = document.getElementById('btnHeaderTools');
        const btnReset = document.getElementById('btnHeaderReset');
        const btnCounterQr = document.getElementById('btnInstantCounterQr');
        const profileBadge = document.getElementById('authProfileBadge');
        const btnLogout = document.getElementById('btnLogoutNav');
        const devMockBadge = document.getElementById('devMockModeBadge');

        // 1. If Auth Screen is visible, hide all interactive header action buttons but KEEP window controls
        if (isAuthScreenVisible) {
            if (btnBackDesk) btnBackDesk.style.display = 'none';
            if (btnSaveDraft) btnSaveDraft.style.display = 'none';
            if (btnHome) btnHome.style.display = 'none';
            if (btnTools) btnTools.style.display = 'none';
            if (btnReset) btnReset.style.display = 'none';
            if (btnCounterQr) btnCounterQr.style.display = 'none';
            if (profileBadge) profileBadge.style.display = 'none';
            if (btnLogout) btnLogout.style.display = 'none';
            if (devMockBadge) devMockBadge.style.display = 'none';
            initDesktopWindowControls();
            return;
        }

        // 2. Profile Badge & Logout (Always visible when logged in)
        if (profileBadge) profileBadge.style.display = 'inline-flex';
        if (btnLogout) btnLogout.style.display = 'inline-flex';
        if (btnHome) btnHome.style.display = 'inline-flex';
        if (btnTools) btnTools.style.display = 'inline-flex';
        if (devMockBadge) devMockBadge.style.display = 'none';

        // 3. Tab-specific display logic
        if (currentTab === 'operator') {
            // Operator Dashboard / Table view:
            // Desk button: Hidden (already on desk)
            if (btnBackDesk) btnBackDesk.style.display = 'none';
            // Save Draft button: Hidden on main desk (no single draft active)
            if (btnSaveDraft) btnSaveDraft.style.display = 'none';
            // Counter QR button: Visible for instant customer scanning
            if (btnCounterQr) btnCounterQr.style.display = isOp ? 'inline-flex' : 'none';
            // Reset button: Hidden on desk overview (operator uses desk table controls)
            if (btnReset) btnReset.style.display = 'none';
        } else if (currentTab === 'citizen') {
            // Chat / Intake View:
            if (isOp) {
                // Operator in chat:
                if (btnBackDesk) btnBackDesk.style.display = 'inline-flex';
                if (btnSaveDraft) btnSaveDraft.style.display = hasActiveCustomer ? 'inline-flex' : 'none';
                if (btnCounterQr) btnCounterQr.style.display = 'inline-flex';
                if (btnReset) btnReset.style.display = 'inline-flex';
            } else {
                // Public Citizen in chat:
                if (btnBackDesk) btnBackDesk.style.display = 'none';
                if (btnSaveDraft) btnSaveDraft.style.display = 'none';
                if (btnCounterQr) btnCounterQr.style.display = 'none';
                if (btnReset) btnReset.style.display = 'inline-flex';
            }
        } else {
            // Other tabs (locker, admin):
            if (btnBackDesk) btnBackDesk.style.display = isOp ? 'inline-flex' : 'none';
            if (btnSaveDraft) btnSaveDraft.style.display = 'none';
            if (btnCounterQr) btnCounterQr.style.display = isOp ? 'inline-flex' : 'none';
            if (btnReset) btnReset.style.display = 'none';
        }

        // 4. Update dynamic button labels / tooltips
        if (btnBackDesk) {
            btnBackDesk.setAttribute('title', 'மையம் பணிப்பகுதிக்குத் திரும்பு (Operator Desk)');
            btnBackDesk.setAttribute('data-tooltip', 'மையம் பணிப்பகுதி (Desk)');
        }
        if (btnSaveDraft) {
            btnSaveDraft.setAttribute('title', 'வாடிக்கையாளர் வரைவாகச் சேமி (Save Draft)');
            btnSaveDraft.setAttribute('data-tooltip', 'வரைவாகச் சேமி (Save)');
        }
        if (btnReset) {
            btnReset.setAttribute('title', 'நடப்பு உரையாடலை மீட்டமை (Reset Session)');
            btnReset.setAttribute('data-tooltip', 'மீட்டமை (Reset)');
        }
        if (btnCounterQr) {
            btnCounterQr.setAttribute('title', 'வாடிக்கையாளர் QR குறியீடு (Counter QR)');
            btnCounterQr.setAttribute('data-tooltip', 'கவுண்டர் QR');
        }

        // 5. Ensure desktop window controls are initialized
        initDesktopWindowControls();
    }

    /**
     * Determines whether the app is executing inside the native Electron Desktop App container.
     */
    function isDesktopAppRuntime() {
        if (window.esevaDesktopBridge && window.esevaDesktopBridge.isDesktopApp) return true;
        const ua = (navigator.userAgent || '').toLowerCase();
        if (ua.includes('electron') || ua.includes('esevadraft')) return true;
        if (typeof window.process === 'object' && window.process && window.process.versions && window.process.versions.electron) return true;
        return false;
    }

    /**
     * Initializes integrated desktop app window controls (Minimize, Maximize, Close).
     * Shown exclusively when running inside the Electron Desktop App.
     */
    function initDesktopWindowControls() {
        const isDesktop = isDesktopAppRuntime();
        const winControls = document.getElementById('desktopWindowControls');
        if (!winControls) return;

        if (isDesktop) {
            winControls.style.display = 'inline-flex';

            const btnMin = document.getElementById('winBtnMinimize');
            const btnMax = document.getElementById('winBtnMaximize');
            const btnClose = document.getElementById('winBtnClose');
            const maxIcon = document.getElementById('winMaximizeIcon');

            if (btnMin && !btnMin.dataset.bound) {
                btnMin.dataset.bound = 'true';
                btnMin.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (window.esevaDesktopBridge && window.esevaDesktopBridge.minimizeWindow) {
                        window.esevaDesktopBridge.minimizeWindow();
                    }
                });
            }

            if (btnMax && !btnMax.dataset.bound) {
                btnMax.dataset.bound = 'true';
                btnMax.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (window.esevaDesktopBridge && window.esevaDesktopBridge.maximizeWindow) {
                        window.esevaDesktopBridge.maximizeWindow();
                    }
                });
            }

            if (btnClose && !btnClose.dataset.bound) {
                btnClose.dataset.bound = 'true';
                btnClose.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (window.esevaDesktopBridge && window.esevaDesktopBridge.closeWindow) {
                        window.esevaDesktopBridge.closeWindow();
                    }
                });
            }

            // Sync maximize / restore icon dynamically
            if (window.esevaDesktopBridge && window.esevaDesktopBridge.isWindowMaximized && maxIcon) {
                window.esevaDesktopBridge.isWindowMaximized().then((isMax) => {
                    if (isMax) {
                        maxIcon.className = 'fa-solid fa-clone';
                    } else {
                        maxIcon.className = 'fa-regular fa-square';
                    }
                }).catch(() => {});
            }

            if (window.esevaDesktopBridge && window.esevaDesktopBridge.onMaximizeChanged && maxIcon && !maxIcon.dataset.listening) {
                maxIcon.dataset.listening = 'true';
                window.esevaDesktopBridge.onMaximizeChanged((isMax) => {
                    if (isMax) {
                        maxIcon.className = 'fa-solid fa-clone';
                    } else {
                        maxIcon.className = 'fa-regular fa-square';
                    }
                });
            }
        } else {
            winControls.style.display = 'none';
        }
    }

    /**
     * Initializes universal web browser download cues (Top announcement banner on web).
     * Shown exclusively when browsing via standard web browsers (Chrome, Edge, Firefox),
     * and completely purged/removed when running inside the native Electron Desktop App.
     */
    function initWebDownloadTriggers() {
        const isDesktop = isDesktopAppRuntime();
        const navDlBtn = document.getElementById('btnDesktopDownloadNav');
        const webDlBanner = document.getElementById('universalWebDownloadBanner');

        if (isDesktop) {
            // Strictly inside Desktop App: NEVER show download button, banner, or download cards
            if (navDlBtn) navDlBtn.remove();
            if (webDlBanner) webDlBanner.remove();
            document.querySelectorAll('.web-only-download-card').forEach((el) => el.remove());
        } else {
            // On Web Browser: Show prominent banner
            if (webDlBanner) webDlBanner.style.display = 'flex';
        }
    }

    // Auto-init on page load
    function initHeaderNav() {
        initDesktopWindowControls();
        initWebDownloadTriggers();
        updateHeaderNavigationState();

        const authEl = document.getElementById('authScreen');
        if (authEl && window.MutationObserver) {
            const observer = new MutationObserver(() => {
                updateHeaderNavigationState();
            });
            observer.observe(authEl, { attributes: true, attributeFilter: ['style', 'class'] });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHeaderNav);
    } else {
        initHeaderNav();
    }

    window.updateHeaderNavigationState = updateHeaderNavigationState;
    window.initDesktopWindowControls = initDesktopWindowControls;
})(window);
