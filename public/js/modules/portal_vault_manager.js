/**
 * public/js/modules/portal_vault_manager.js
 * 
 * Multi-Portal Operator Credentials Vault UI & State Manager
 * (அரசு இணையதள லாகின் பெட்டக மேலாளர்)
 * 
 * Supports:
 * - TNeGA (tnesevai.tn.gov.in)
 * - TNPDS (tnpds.gov.in)
 * - ECI / NVSP (voters.eci.gov.in)
 * - Custom Government Websites / Portals
 * 
 * Strictly compliant with Golden Rules 1, 3, 4, 6
 */

(function (window) {
    'use strict';

    let currentVaultSummary = null;

    const PORTAL_CONFIG = {
        tnega: {
            key: 'tnega',
            name: 'TNeGA இ-சேவை',
            title: '🏛️ TNeGA இ-சேவை (tnesevai.tn.gov.in)',
            userLabel: 'TNeGA பயனர் பெயர் / ஆப்ரேட்டர் குறியீடு (User ID / Operator Code):',
            userPlaceholder: 'எ.கா: TNTACCHN001-01 அல்லது OM12345',
            hasRole: true
        },
        tnpds: {
            key: 'tnpds',
            name: 'TNPDS பொது விநியோகம்',
            title: '🌾 TNPDS பொது விநியோகத் திட்டம் (tnpds.gov.in)',
            userLabel: 'TNPDS பயனர் பெயர் / பதிவுசெய்த கைபேசி எண் (User ID / Registered Mobile):',
            userPlaceholder: 'எ.கா: 9842367866 அல்லது Operator ID',
            hasRole: false
        },
        eci: {
            key: 'eci',
            name: 'ECI வாக்காளர் சேவை',
            title: '🗳️ ECI வாக்காளர் சேவை (voters.eci.gov.in)',
            userLabel: 'ECI பயனர் பெயர் / மின்னஞ்சல் / மொபைல் (Voter Portal User ID / Mobile):',
            userPlaceholder: 'எ.கா: 9842367866 அல்லது operator@gmail.com',
            hasRole: false
        },
        custom: {
            key: 'custom',
            name: 'பிற அரசு இணையதளம்',
            title: '🌐 பிற அரசு இணையதளம் / Other Website',
            userLabel: 'பயனர் பெயர் (Login User ID / Operator Code):',
            userPlaceholder: 'உங்கள் இணையதள பயனர் பெயர் அல்லது ID',
            hasRole: false
        }
    };

    function toSafeHttpHeader(val) {
        const s = String(val || '').trim();
        return /[^\x00-\xFF]/.test(s) ? encodeURIComponent(s) : s;
    }

    function getActiveOperatorUid() {
        const rawUid = localStorage.getItem('eseva_operator_uid') || 
                       localStorage.getItem('eseva_user_id') || 
                       localStorage.getItem('eseva_operator_mobile') || 
                       'admin';
        return toSafeHttpHeader(rawUid);
    }

    function getActiveOperatorName() {
        const rawUid = localStorage.getItem('eseva_operator_uid') || '';
        let name = localStorage.getItem('eseva_operator_name') || 
                   localStorage.getItem('eseva_user_name') || 
                   'இ-சேவை மையம்';
        if (rawUid && rawUid !== 'z9TSOApH0Hh69Du0xPK2GDxK2kr2' && name === 'குமரன் இ-சேவை மையம்') {
            name = (rawUid.toLowerCase() === 'plzeg1ptsyqmbe2qfjf8aus7tjr2') ? 'SUMAN' : 'இ-சேவை மையம்';
            localStorage.setItem('eseva_operator_name', name);
        }
        return name;
    }

    async function fetchPortalVaultSummary() {
        const opUid = getActiveOperatorUid();
        try {
            const res = await fetch(`/api/operator/vault?operatorUid=${encodeURIComponent(opUid)}`, {
                method: 'GET',
                headers: {
                    'x-operator-uid': encodeURIComponent(String(opUid || 'admin').trim())
                }
            });
            const data = await res.json();
            if (data && (data.portals || data.tnega)) {
                currentVaultSummary = data;
                try {
                    localStorage.setItem('eseva_vault_summary_' + opUid, JSON.stringify(data));
                } catch (_) {}
                return data;
            }
        } catch (e) {
            console.error('[Portal Vault UI] Fetch error:', e);
        }
        try {
            const cached = localStorage.getItem('eseva_vault_summary_' + opUid);
            if (cached) {
                currentVaultSummary = JSON.parse(cached);
                return currentVaultSummary;
            }
        } catch (_) {}
        return null;
    }

    function renderPortalPillBadges() {
        if (!currentVaultSummary) return;
        const portals = currentVaultSummary.portals || {};

        const badgeMap = {
            tnega: document.getElementById('pillBadge_tnega'),
            tnpds: document.getElementById('pillBadge_tnpds'),
            eci: document.getElementById('pillBadge_eci')
        };

        ['tnega', 'tnpds', 'eci'].forEach(k => {
            const badgeEl = badgeMap[k];
            if (!badgeEl) return;
            const pData = portals[k] || (k === 'tnega' ? currentVaultSummary.tnega : null);
            if (pData && pData.hasCredentials) {
                badgeEl.textContent = '✅';
                badgeEl.style.color = '#10b981';
            } else {
                badgeEl.textContent = '⚪';
                badgeEl.style.color = '#94a3b8';
            }
        });
    }

    function highlightActivePill(activeKey) {
        ['tnega', 'tnpds', 'eci', 'custom'].forEach(k => {
            const btn = document.getElementById('pillPortal_' + k);
            if (!btn) return;
            if (k === activeKey) {
                btn.style.borderColor = '#2563eb';
                btn.style.background = '#eff6ff';
                btn.style.color = '#1d4ed8';
            } else {
                btn.style.borderColor = '#cbd5e1';
                btn.style.background = '#f8fafc';
                btn.style.color = '#475569';
            }
        });
    }

    function onVaultPortalChange() {
        const selector = document.getElementById('vaultPortalSelector');
        if (!selector) return;
        const selectedKey = selector.value || 'tnega';

        highlightActivePill(selectedKey);

        const config = PORTAL_CONFIG[selectedKey] || PORTAL_CONFIG.custom;
        const userLabel = document.getElementById('vaultUsernameLabel');
        const userInp = document.getElementById('vaultTnegaUsername');
        const passInp = document.getElementById('vaultTnegaPassword');
        const roleWrap = document.getElementById('vaultTnegaRoleWrap');
        const roleSelect = document.getElementById('vaultTnegaRole');
        const customWrap = document.getElementById('vaultCustomPortalWrap');
        const customNameInp = document.getElementById('vaultCustomPortalName');
        const customUrlInp = document.getElementById('vaultCustomPortalUrl');
        const badge = document.getElementById('vaultExistingStatusBadge');
        const btnDelete = document.getElementById('btnVaultDeleteCreds');
        const msgBox = document.getElementById('vaultStatusMessage');

        if (msgBox) msgBox.style.display = 'none';

        if (userLabel) userLabel.textContent = config.userLabel;
        if (userInp) userInp.placeholder = config.userPlaceholder;

        // Custom portal inputs toggle
        if (customWrap) {
            customWrap.style.display = (selectedKey === 'custom') ? 'flex' : 'none';
        }

        // Role code toggle (only TNeGA uses OM role code)
        if (roleWrap) {
            roleWrap.style.display = config.hasRole ? 'block' : 'none';
        }

        // Get saved data for this portal
        const portals = (currentVaultSummary && currentVaultSummary.portals) || {};
        let pData = portals[selectedKey] || null;
        if (!pData && selectedKey === 'tnega' && currentVaultSummary && currentVaultSummary.tnega) {
            pData = currentVaultSummary.tnega;
        }

        if (pData && pData.hasCredentials) {
            if (userInp) userInp.value = pData.username || '';
            if (passInp) {
                passInp.value = '';
                passInp.placeholder = '•••••••••••• (ஏற்கெனவே சேமிக்கப்பட்டுள்ளது)';
            }
            if (roleSelect && pData.operatorCode) roleSelect.value = pData.operatorCode;
            if (customNameInp && pData.portalName) customNameInp.value = pData.portalName;
            if (customUrlInp && pData.customUrl) customUrlInp.value = pData.customUrl;

            if (badge) {
                badge.style.display = 'inline-flex';
                badge.innerHTML = `<i class="fa-solid fa-circle-check" style="color: #10b981;"></i> ${config.name} விவரங்கள் சேமிக்கப்பட்டுள்ளன`;
                badge.className = 'vault-status-badge active';
            }
            if (btnDelete) btnDelete.style.display = 'inline-flex';
        } else {
            if (userInp) userInp.value = '';
            if (passInp) {
                passInp.value = '';
                passInp.placeholder = 'உங்கள் கடவுச்சொல் (Password)';
            }
            if (customNameInp) customNameInp.value = '';
            if (customUrlInp) customUrlInp.value = '';

            if (badge) {
                badge.style.display = 'inline-flex';
                badge.innerHTML = `<i class="fa-solid fa-circle-info" style="color: #f59e0b;"></i> ${config.name} இன்னும் சேமிக்கப்படவில்லை`;
                badge.className = 'vault-status-badge inactive';
            }
            if (btnDelete) btnDelete.style.display = 'none';
        }
    }

    function selectVaultPortal(portalKey) {
        const selector = document.getElementById('vaultPortalSelector');
        if (selector) {
            selector.value = portalKey;
            onVaultPortalChange();
        }
    }

    async function openPortalVaultModal(initialPortal = 'tnega') {
        const modal = document.getElementById('tnegaPortalVaultModal');
        if (!modal) return;

        const opUid = getActiveOperatorUid();
        const opName = getActiveOperatorName();

        const opDisplay = document.getElementById('vaultCurrentOperatorDisplay');
        if (opDisplay) opDisplay.textContent = `${opName} (${opUid})`;

        const msgBox = document.getElementById('vaultStatusMessage');
        if (msgBox) {
            msgBox.style.display = 'none';
            msgBox.textContent = '';
        }

        // Fetch full summary from server
        await fetchPortalVaultSummary();
        renderPortalPillBadges();

        const selector = document.getElementById('vaultPortalSelector');
        if (selector) selector.value = initialPortal || 'tnega';

        onVaultPortalChange();

        modal.style.display = 'flex';
    }

    function closePortalVaultModal() {
        const modal = document.getElementById('tnegaPortalVaultModal');
        if (modal) modal.style.display = 'none';
    }

    function toggleVaultPasswordVisibility() {
        const passInp = document.getElementById('vaultTnegaPassword');
        const eyeIcon = document.getElementById('vaultEyeIcon');
        if (!passInp) return;
        if (passInp.type === 'password') {
            passInp.type = 'text';
            if (eyeIcon) {
                eyeIcon.classList.remove('fa-eye');
                eyeIcon.classList.add('fa-eye-slash');
            }
        } else {
            passInp.type = 'password';
            if (eyeIcon) {
                eyeIcon.classList.remove('fa-eye-slash');
                eyeIcon.classList.add('fa-eye');
            }
        }
    }

    async function saveCurrentPortalVault() {
        const selector = document.getElementById('vaultPortalSelector');
        const selectedKey = selector ? selector.value : 'tnega';
        const userInp = document.getElementById('vaultTnegaUsername');
        const passInp = document.getElementById('vaultTnegaPassword');
        const roleSelect = document.getElementById('vaultTnegaRole');
        const customNameInp = document.getElementById('vaultCustomPortalName');
        const customUrlInp = document.getElementById('vaultCustomPortalUrl');
        const msgBox = document.getElementById('vaultStatusMessage');
        const btnSave = document.getElementById('btnVaultSaveCreds');

        const username = userInp ? userInp.value.trim() : '';
        const password = passInp ? passInp.value.trim() : '';
        const operatorCode = roleSelect ? roleSelect.value : 'OM';
        const customName = customNameInp ? customNameInp.value.trim() : '';
        const customUrl = customUrlInp ? customUrlInp.value.trim() : '';
        const opUid = getActiveOperatorUid();
        const opName = getActiveOperatorName();

        let portalKey = selectedKey;
        let portalName = (PORTAL_CONFIG[selectedKey] && PORTAL_CONFIG[selectedKey].name) || selectedKey;

        if (selectedKey === 'custom') {
            if (!customName) {
                if (msgBox) {
                    msgBox.style.display = 'block';
                    msgBox.style.background = '#fef2f2';
                    msgBox.style.color = '#dc2626';
                    msgBox.style.border = '1px solid #fecaca';
                    msgBox.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> தயவுசெய்து இணையதளப் பெயரை (Website Name) உள்ளிடவும்.';
                }
                return;
            }
            portalKey = 'custom_' + customName.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
            portalName = customName;
        }

        if (!username) {
            if (msgBox) {
                msgBox.style.display = 'block';
                msgBox.style.background = '#fef2f2';
                msgBox.style.color = '#dc2626';
                msgBox.style.border = '1px solid #fecaca';
                msgBox.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> பயனர் பெயர் (User ID / Operator Code) கட்டாயம் தேவை.';
            }
            return;
        }

        if (btnSave) {
            btnSave.disabled = true;
            btnSave.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> சேமிக்கப்படுகிறது...';
        }

        try {
            const res = await fetch('/api/operator/vault', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-operator-uid': encodeURIComponent(String(opUid || 'admin').trim())
                },
                body: JSON.stringify({
                    portal: portalKey,
                    portalName: portalName,
                    customUrl: customUrl,
                    username: username,
                    password: password,
                    operatorCode: operatorCode,
                    operatorUid: opUid,
                    operatorName: opName
                })
            });

            const data = await res.json();
            if (btnSave) {
                btnSave.disabled = false;
                btnSave.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> விவரங்களைச் சேமி (Save)';
            }

            if (data.success) {
                currentVaultSummary = data.vault || currentVaultSummary;
                try {
                    if (currentVaultSummary) {
                        localStorage.setItem('eseva_vault_summary_' + opUid, JSON.stringify(currentVaultSummary));
                    }
                } catch (_) {}
                renderPortalPillBadges();
                onVaultPortalChange();

                if (msgBox) {
                    msgBox.style.display = 'block';
                    msgBox.style.background = '#ecfdf5';
                    msgBox.style.color = '#059669';
                    msgBox.style.border = '1px solid #a7f3d0';
                    msgBox.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${data.message || 'விவரங்கள் வெற்றிகரமாகப் பாதுகாக்கப்பட்டன!'}`;
                }

                setTimeout(() => {
                    closePortalVaultModal();
                }, 1300);
            } else {
                if (msgBox) {
                    msgBox.style.display = 'block';
                    msgBox.style.background = '#fef2f2';
                    msgBox.style.color = '#dc2626';
                    msgBox.style.border = '1px solid #fecaca';
                    msgBox.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> ' + (data.error || 'சேமிப்பதில் பிழை ஏற்பட்டது.');
                }
            }
        } catch (err) {
            if (btnSave) {
                btnSave.disabled = false;
                btnSave.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> விவரங்களைச் சேமி (Save)';
            }
            if (msgBox) {
                msgBox.style.display = 'block';
                msgBox.style.background = '#fef2f2';
                msgBox.style.color = '#dc2626';
                msgBox.style.border = '1px solid #fecaca';
                msgBox.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> நெட்வொர்க் பிழை: ' + err.message;
            }
        }
    }

    async function deleteCurrentPortalVault() {
        const selector = document.getElementById('vaultPortalSelector');
        const selectedKey = selector ? selector.value : 'tnega';
        const config = PORTAL_CONFIG[selectedKey] || PORTAL_CONFIG.custom;
        const portalName = config.name || selectedKey;

        if (!confirm(`உங்கள் ${portalName} லாகின் விவரங்களை நிச்சயமாக நீக்க விரும்புகிறீர்களா?`)) return;
        const opUid = getActiveOperatorUid();
        const msgBox = document.getElementById('vaultStatusMessage');

        try {
            const res = await fetch('/api/operator/vault', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'x-operator-uid': toSafeHttpHeader(opUid)
                },
                body: JSON.stringify({ portal: selectedKey, operatorUid: opUid })
            });
            const data = await res.json();
            if (data.success) {
                currentVaultSummary = data.vault || currentVaultSummary;
                renderPortalPillBadges();
                onVaultPortalChange();

                if (msgBox) {
                    msgBox.style.display = 'block';
                    msgBox.style.background = '#fef2f2';
                    msgBox.style.color = '#dc2626';
                    msgBox.style.border = '1px solid #fecaca';
                    msgBox.innerHTML = `<i class="fa-solid fa-trash-can"></i> ${portalName} விவரங்கள் நீக்கப்பட்டன.`;
                }
            }
        } catch (e) {
            console.error('[Portal Vault UI] Delete error:', e);
        }
    }

    // Export to global scope
    window.openPortalVaultModal = openPortalVaultModal;
    window.closePortalVaultModal = closePortalVaultModal;
    window.toggleVaultPasswordVisibility = toggleVaultPasswordVisibility;
    window.onVaultPortalChange = onVaultPortalChange;
    window.selectVaultPortal = selectVaultPortal;
    window.saveCurrentPortalVault = saveCurrentPortalVault;
    window.deleteCurrentPortalVault = deleteCurrentPortalVault;

    // Backward compatibility aliases
    window.saveTnegaPortalVault = saveCurrentPortalVault;
    window.deleteTnegaPortalVault = deleteCurrentPortalVault;

})(window);
