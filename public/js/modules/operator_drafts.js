// eSevaDraft Domain Module: operator_drafts.js

        let allOperatorDrafts = [];
        let currentDraftFilter = 'ALL';

        async function fetchOperatorDrafts() {
            const authScreen = document.getElementById('authScreen');
            if (authScreen && authScreen.style.display !== 'none') return;
            const role = localStorage.getItem('eseva_user_role') || '';
            if (role !== 'operator' && !isRunningInDesktopApp()) return;

            try {
                const opUid = localStorage.getItem('eseva_operator_uid') || '';
                const url = opUid ? `/api/drafts?operatorUid=${encodeURIComponent(opUid)}` : '/api/drafts';
                const headers = opUid ? { 'x-operator-uid': opUid } : {};
                const res = await fetch(url, { headers });
                const data = await res.json();
                allOperatorDrafts = data.drafts || [];
                window.allOperatorDrafts = allOperatorDrafts;
                renderOperatorDrafts();
            } catch (e) {
                console.error('Failed to load drafts:', e);
            }
        }

        function setDraftFilter(filter, btn) {
            currentDraftFilter = filter;
            document.querySelectorAll('#operatorFilterButtons .filter-pill, #operatorFilterButtonsModal .filter-pill').forEach(b => {
                b.classList.remove('active');
                if (b.getAttribute('onclick') && b.getAttribute('onclick').includes(`'${filter}'`)) {
                    b.classList.add('active');
                }
            });
            renderOperatorDrafts();
        }

        function filterOperatorDrafts() {
            renderOperatorDrafts();
        }

        function openOperatorDraftsModal() {
            const modal = document.getElementById('operatorDraftsModal');
            if (modal) {
                modal.style.display = 'flex';
                fetchOperatorDrafts();
                renderOperatorDrafts();
            }
        }

        function closeOperatorDraftsModal() {
            const modal = document.getElementById('operatorDraftsModal');
            if (modal) modal.style.display = 'none';

            const activeCust = (localStorage.getItem('eseva_active_customer_mobile') || '').replace(/\D/g, '').slice(-10);
            const draftList = window.allOperatorDrafts || (typeof allOperatorDrafts !== 'undefined' ? allOperatorDrafts : []);
            if (!activeCust || (Array.isArray(draftList) && !draftList.some(d => (d.mobileNumber || '').replace(/\D/g, '').slice(-10) === activeCust))) {
                if (typeof clearAutomationScreenSession === 'function') {
                    clearAutomationScreenSession();
                } else if (typeof resetIntakeChat === 'function') {
                    resetIntakeChat();
                }
            }
        }

        function renderOperatorDrafts() {
            const grids = [
                document.getElementById('operatorDraftsGrid'),
                document.getElementById('operatorDraftsModalGrid')
            ].filter(Boolean);
            if (grids.length === 0) return;

            const query = (document.getElementById('operatorSearchInput')?.value || '').toLowerCase().trim();

            const isTrashView = currentDraftFilter === 'TRASH';

            let filtered = allOperatorDrafts.filter(d => {
                const isItemTrashed = !!(d.isDeleted || d.status === 'TRASHED');

                // If on Trash tab, ONLY show trashed items
                if (isTrashView) {
                    if (!isItemTrashed) return false;
                } else {
                    // On regular tabs, NEVER show trashed items!
                    if (isItemTrashed) return false;
                }

                const matchQuery = !query || 
                    (d.name && d.name.toLowerCase().includes(query)) || 
                    (d.mobileNumber && d.mobileNumber.includes(query)) ||
                    (d.applicationNumber && d.applicationNumber.includes(query));
                
                let matchFilter = true;
                const isSubmitted = (d.status === 'SUBMITTED' || !!d.applicationNumber);
                const isCompleted = d.status === 'COMPLETED' || d.certificateReady === true || (isSubmitted && !!d.certificateUrl);

                if (currentDraftFilter === 'SUBMITTED') {
                    matchFilter = isSubmitted && !isCompleted;
                } else if (currentDraftFilter === 'COMPLETED') {
                    matchFilter = isCompleted;
                }

                return matchQuery && matchFilter;
            });

            // Update counts for Desktop and Modal
            const nonTrashedDrafts = allOperatorDrafts.filter(d => !(d.isDeleted || d.status === 'TRASHED'));
            const trashedDrafts = allOperatorDrafts.filter(d => !!(d.isDeleted || d.status === 'TRASHED'));

            const countAll = nonTrashedDrafts.length;
            const countSubmitted = nonTrashedDrafts.filter(d => {
                const isSub = (d.status === 'SUBMITTED' || !!d.applicationNumber);
                const isComp = d.status === 'COMPLETED' || d.certificateReady === true || (isSub && !!d.certificateUrl);
                return isSub && !isComp;
            }).length;
            const countCompleted = nonTrashedDrafts.filter(d => d.status === 'COMPLETED' || d.certificateReady === true || ((d.status === 'SUBMITTED' || !!d.applicationNumber) && !!d.certificateUrl)).length;
            const countTrash = trashedDrafts.length;

            const countAllEl = document.getElementById('countAll');
            const countSubEl = document.getElementById('countSubmitted');
            const countCompEl = document.getElementById('countCompleted');
            const countTrashEl = document.getElementById('countTrash');
            const opDraftCountBadge = document.getElementById('opDraftCountBadge');

            if (countAllEl) countAllEl.innerText = countAll;
            if (countSubEl) countSubEl.innerText = countSubmitted;
            if (countCompEl) countCompEl.innerText = countCompleted;
            if (countTrashEl) countTrashEl.innerText = countTrash;
            if (opDraftCountBadge) opDraftCountBadge.innerText = countAll;

            document.querySelectorAll('.countAllSpan').forEach(el => el.innerText = countAll);
            document.querySelectorAll('.countSubmittedSpan').forEach(el => el.innerText = countSubmitted);
            document.querySelectorAll('.countCompletedSpan').forEach(el => el.innerText = countCompleted);
            document.querySelectorAll('.countTrashSpan').forEach(el => el.innerText = countTrash);

            if (filtered.length === 0) {
                const emptyMsg = isTrashView 
                    ? 'குப்பைத்தொட்டி காலியாக உள்ளது (Trash is empty)' 
                    : 'வாடிக்கையாளர் வரைவுகள் எதுவும் இல்லை';
                const emptySubMsg = isTrashView
                    ? 'நீக்கப்பட்ட வாடிக்கையாளர் வரைவுகள் எதுவும் இல்லை.'
                    : 'முகப்பு பக்கத்திற்குச் சென்று புதிய வாடிக்கையாளர் விண்ணப்பத்தை உடனே தொடங்கலாம்.';
                const emptyIcon = isTrashView ? '🗑️' : '📂';
                const emptyHtml = `
                    <div style="grid-column: 1 / -1; background: white; padding: 32px 20px; border-radius: 12px; text-align: center; border: 1.5px dashed #e2e8f0; color: #64748b;">
                        <div style="font-size: 32px; margin-bottom: 6px;">${emptyIcon}</div>
                        <h4 style="margin: 0; color: #1e293b; font-size: 14px; font-weight: 700;">${emptyMsg}</h4>
                        <p style="font-size: 12px; margin: 6px 0 0 0; color: #64748b;">${emptySubMsg}</p>
                    </div>
                `;
                grids.forEach(g => g.innerHTML = emptyHtml);
                return;
            }

            const cardsHtml = filtered.map(d => {
                const isItemTrashed = !!(d.isDeleted || d.status === 'TRASHED');
                let statusBadge = '';
                let actionBtn = '';

                if (isItemTrashed) {
                    statusBadge = `<span style="background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; padding: 3px 8px; border-radius: 8px; font-size: 11px; font-weight: 700;">🗑️ குப்பைத்தொட்டி</span>`;
                    actionBtn = `
                        <button onclick="restoreCustomerDraft('${d.mobileNumber}', '${(d.name || 'வாடிக்கையாளர்').replace(/'/g, "\\'")}')" 
                                title="♻️ வரைவை மீட்டெடு (Restore to Active Drafts)" 
                                aria-label="வரைவை மீட்டெடு"
                                style="height: 34px; width: 34px; padding: 0; background: #ecfdf5; color: #059669; border: 1.5px solid #a7f3d0; border-radius: 8px; font-size: 14px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 1px 2px rgba(16,185,129,0.12);" 
                                onmouseover="this.style.background='#d1fae5'; this.style.borderColor='#10b981'; this.style.transform='scale(1.05)';" 
                                onmouseout="this.style.background='#ecfdf5'; this.style.borderColor='#a7f3d0'; this.style.transform='none';">
                            <i class="fa-solid fa-rotate-left"></i>
                        </button>
                        <button onclick="permanentDeleteCustomerDraft('${d.mobileNumber}', '${(d.name || 'வாடிக்கையாளர்').replace(/'/g, "\\'")}')" 
                                title="❌ நிரந்தரமாக நீக்கு (Permanent Delete from Firebase)" 
                                aria-label="நிரந்தர நீக்கம்"
                                style="height: 34px; width: 34px; padding: 0; background: #fef2f2; color: #dc2626; border: 1.5px solid #fecaca; border-radius: 8px; font-size: 14px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 1px 2px rgba(220,38,38,0.12);" 
                                onmouseover="this.style.background='#fee2e2'; this.style.borderColor='#ef4444'; this.style.transform='scale(1.05)';" 
                                onmouseout="this.style.background='#fef2f2'; this.style.borderColor='#fecaca'; this.style.transform='none';">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    `;
                } else {
                    const isCompleted = d.status === 'COMPLETED' || d.certificateReady === true || ((d.status === 'SUBMITTED' || !!d.applicationNumber) && !!d.certificateUrl);

                    if (isCompleted) {
                        statusBadge = `<span style="background: #fdf4ff; color: #a21caf; border: 1px solid #f0abfc; padding: 3px 8px; border-radius: 8px; font-size: 11px; font-weight: 700;">🎉 சான்றிதழ் தயார்</span>`;
                        actionBtn = `
                            <button onclick="editCustomerFromDraftDesk('${d.mobileNumber}')" title="வாடிக்கையாளர் விவரங்களைத் திருத்த / பார்க்க (Edit / View)" style="height: 34px; padding: 0 12px; background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 11.5px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 4px;"><i class="fa-solid fa-pen-to-square"></i> திருத்து</button>
                            <button onclick="downloadCustomerApplicationForm('${d.mobileNumber}', '${d.applicationNumber || ''}')" title="சான்றிதழைப் பதிவிறக்கு (Download Certificate)" style="height: 34px; padding: 0 14px; background: #9333ea; color: white; border: none; border-radius: 8px; font-size: 11.5px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 5px; box-shadow: 0 1px 3px rgba(147,51,234,0.25);"><i class="fa-solid fa-certificate"></i> 📜 சான்றிதழ்</button>
                        `;
                    } else if (d.status === 'SUBMITTED' || d.applicationNumber) {
                        statusBadge = `<span style="background: #dcfce7; color: #15803d; border: 1px solid #86efac; padding: 3px 8px; border-radius: 8px; font-size: 11px; font-weight: 700;">✅ சமர்ப்பிக்கப்பட்டது</span>`;
                        actionBtn = `
                            <button onclick="editCustomerFromDraftDesk('${d.mobileNumber}')" title="வாடிக்கையாளர் விவரங்களைத் திருத்த / பார்க்க (Edit / View)" style="height: 34px; padding: 0 12px; background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 11.5px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 4px;"><i class="fa-solid fa-pen-to-square"></i> திருத்து</button>
                            <button onclick="downloadTnpdsPdfFromInput('${d.applicationNumber || ''}')" title="விண்ணப்ப PDF பதிவிறக்கு (Download PDF)" style="height: 34px; padding: 0 14px; background: #16a34a; color: white; border: none; border-radius: 8px; font-size: 11.5px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 5px; box-shadow: 0 1px 3px rgba(22,163,74,0.25);"><i class="fa-solid fa-file-pdf"></i> 📥 PDF</button>
                        `;
                    } else if (d.status === 'WAITING_FOR_OTP_CALL') {
                        statusBadge = `<span style="background: #fef9c3; color: #854d0e; border: 1px solid #fde047; padding: 3px 8px; border-radius: 8px; font-size: 11px; font-weight: 700;">📞 OTP அழைப்பு</span>`;
                        actionBtn = `
                            <button onclick="editCustomerFromDraftDesk('${d.mobileNumber}')" title="வாடிக்கையாளர் விவரங்களைத் திருத்த (Edit Details)" style="height: 34px; padding: 0 12px; background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 11.5px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 4px;"><i class="fa-solid fa-pen-to-square"></i> திருத்து</button>
                            <button onclick="resumeCustomerSession('${d.mobileNumber}', true)" title="வாடிக்கையாளர் OTP சமர்ப்பிக்க (Submit OTP)" style="height: 34px; padding: 0 14px; background: #eab308; color: #422006; border: none; border-radius: 8px; font-size: 11.5px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 5px; box-shadow: 0 1px 3px rgba(234,179,8,0.25);">🚀 OTP சமர்ப்பி</button>
                        `;
                    } else {
                        statusBadge = `<span style="background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; padding: 3px 8px; border-radius: 8px; font-size: 11px; font-weight: 700;">💾 வரைவு தயார்</span>`;
                        actionBtn = `
                            <button onclick="editCustomerFromDraftDesk('${d.mobileNumber}')" title="வாடிக்கையாளர் விவரங்களைத் திருத்த (Edit Master Details)" style="height: 34px; padding: 0 12px; background: #0284c7; color: white; border: none; border-radius: 8px; font-size: 11.5px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 5px; box-shadow: 0 1px 3px rgba(2,132,199,0.25);"><i class="fa-solid fa-pen-to-square"></i> திருத்து</button>
                        `;
                    }
                }

                const timeStr = d.lastUpdated ? new Date(d.lastUpdated).toLocaleDateString('ta-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
                
                let serviceTitle = d.serviceName || '';
                if (d.canNumber) {
                    serviceTitle = '📜 TNeGA வருவாய் சேவை';
                } else if (d.subService === 'ADD_MEMBER' || d.serviceName === 'குடும்ப உறுப்பினர் சேர்க்கை') {
                    serviceTitle = '👤+ குடும்ப உறுப்பினர் சேர்க்கை';
                } else if (d.subService === 'CHANGE_ADDRESS' || d.subService === 'ADDRESS_CHANGE' || d.serviceName === 'முகவரி மாற்றம்') {
                    serviceTitle = '🏠 குடும்ப அட்டை முகவரி மாற்றம்';
                } else if (d.subService === 'REMOVE_MEMBER' || d.serviceName === 'குடும்ப உறுப்பினர் நீக்கம்') {
                    serviceTitle = '➖ குடும்ப உறுப்பினர் நீக்கம்';
                } else if (!d.serviceName || d.serviceName === 'புதிய குடும்ப அட்டை' || d.serviceName === 'மாஸ்டர் சுயவிவரம்') {
                    if (d.membersCount > 0 && d.headAadhaar) {
                        serviceTitle = '👤 மாஸ்டர் சுயவிவரம் (Master Profile)';
                    } else {
                        serviceTitle = '🏛️ புதிய குடும்ப அட்டை';
                    }
                }

                const isMasterProfileBadge = serviceTitle.includes('மாஸ்டர் சுயவிவரம்');
                const badgeStyle = isMasterProfileBadge 
                    ? 'background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe;' 
                    : 'background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0;';

                return `
                    <div style="background: white; border-radius: 10px; padding: 14px; border: 1px solid ${isItemTrashed ? '#fca5a5' : '#e2e8f0'}; box-shadow: 0 1px 4px rgba(0,0,0,0.05); display: flex; flex-direction: column; justify-content: space-between;">
                        <div>
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                                <h4 style="margin: 0; font-size: 13.5px; color: #0f172a; font-weight: 700;">${d.name}</h4>
                                ${statusBadge}
                            </div>
                            <div style="margin-bottom: 6px;">
                                <span style="display: inline-flex; align-items: center; gap: 4px; ${badgeStyle} padding: 2px 7px; border-radius: 6px; font-weight: 700; font-size: 10.5px;">${serviceTitle}</span>
                            </div>
                            <div style="font-size: 11.5px; color: #64748b; line-height: 1.6;">
                                <div>📱 <b>+91 ${d.mobileNumber}</b></div>
                                ${d.headAadhaar ? `<div>🪪 ஆதார்: <b>${d.headAadhaar.replace(/(\d{4})/g, '$1 ').trim()}</b></div>` : ''}
                                <div>👥 உறுப்பினர்கள்: <b>${d.membersCount} நபர்(கள்)</b></div>
                                <div>🏛️ ${d.taluk ? d.taluk + ', ' : ''}${d.district || '—'}</div>
                                ${d.canNumber ? `<div style="margin-top: 5px; display: inline-flex; align-items: center; gap: 4px; background: #ecfeff; color: #0e7490; padding: 2px 7px; border-radius: 6px; font-weight: 800; font-size: 11px; border: 1px solid #a5f3fc;"><i class="fa-solid fa-address-card" style="font-size: 10px;"></i> 🌟 CAN: ${d.canNumber}</div>` : ''}
                                ${d.applicationNumber ? `<div style="margin-top: 4px; color: #166534; font-weight: 700;">பதிவு எண்: ${d.applicationNumber}</div>` : ''}
                            </div>
                        </div>
                        <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                            <span style="font-size: 10px; color: #94a3b8;">${timeStr}</span>
                            <div style="display: flex; gap: 6px; flex: 1; justify-content: flex-end; align-items: center;">
                                ${actionBtn}
                                ${!isItemTrashed ? `
                                <button onclick="downloadCustomerApplicationForm('${d.mobileNumber}', '${d.applicationNumber || ''}')" 
                                        title="📥 விண்ணப்பப் படிவம் / சான்றிதழ் / ஆவணங்களைப் பதிவிறக்கு (Download)" 
                                        style="height: 34px; width: 34px; padding: 0; background: #ecfdf5; color: #059669; border: 1.5px solid #a7f3d0; border-radius: 8px; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 1px 2px rgba(16,185,129,0.12);" 
                                        onmouseover="this.style.background='#d1fae5'; this.style.borderColor='#10b981'; this.style.transform='scale(1.05)';" 
                                        onmouseout="this.style.background='#ecfdf5'; this.style.borderColor='#a7f3d0'; this.style.transform='none';">
                                    <i class="fa-solid fa-download"></i>
                                </button>
                                <button onclick="trashCustomerDraft('${d.mobileNumber}', '${(d.name || 'வாடிக்கையாளர்').replace(/'/g, "\\'")}')" 
                                        title="🗑️ குப்பைத்தொட்டிக்கு நகர்த்து (Move to Trash)" 
                                        style="height: 34px; width: 34px; padding: 0; background: #fef2f2; color: #dc2626; border: 1.5px solid #fecaca; border-radius: 8px; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 1px 2px rgba(220,38,38,0.12);" 
                                        onmouseover="this.style.background='#fee2e2'; this.style.borderColor='#ef4444'; this.style.transform='scale(1.05)';" 
                                        onmouseout="this.style.background='#fef2f2'; this.style.borderColor='#fecaca'; this.style.transform='none';">
                                    <i class="fa-solid fa-trash-can"></i>
                                </button>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            grids.forEach(g => g.innerHTML = cardsHtml);
        }


        function showInAppToast(message, isError = false) {
            let toast = document.getElementById('esevaInAppToast');
            if (!toast) {
                toast = document.createElement('div');
                toast.id = 'esevaInAppToast';
                toast.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:100099;padding:12px 18px;border-radius:10px;font-size:13px;font-weight:700;color:#fff;box-shadow:0 10px 25px rgba(0,0,0,0.25);transition:opacity 0.2s,transform 0.2s;display:flex;align-items:center;gap:8px;max-width:420px;';
                document.body.appendChild(toast);
            }
            toast.style.background = isError ? '#dc2626' : '#059669';
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
            toast.innerHTML = `<span>${message}</span>`;
            clearTimeout(window.__esevaToastTimer);
            window.__esevaToastTimer = setTimeout(() => {
                if (toast) {
                    toast.style.opacity = '0';
                    toast.style.transform = 'translateY(10px)';
                }
            }, 3200);
        }
        window.showInAppToast = showInAppToast;

        function showInAppConfirmModal(title, message, confirmText = '🗑️ நீக்கு') {
            return new Promise((resolve) => {
                let overlay = document.getElementById('esevaInAppConfirmOverlay');
                if (overlay) overlay.remove();
                overlay = document.createElement('div');
                overlay.id = 'esevaInAppConfirmOverlay';
                overlay.style.cssText = 'position:fixed;inset:0;z-index:100098;background:rgba(15,23,42,0.55);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:16px;';
                overlay.innerHTML = `
                    <div style="background:#ffffff;border-radius:14px;max-width:420px;width:100%;padding:22px;box-shadow:0 20px 40px rgba(0,0,0,0.3);border:1.5px solid #fecdd3;font-family:inherit;">
                        <div style="font-size:15px;font-weight:800;color:#0f172a;margin-bottom:8px;display:flex;align-items:center;gap:8px;">
                            <span>${title}</span>
                        </div>
                        <div style="font-size:12.5px;color:#475569;line-height:1.55;margin-bottom:18px;white-space:pre-line;">${message}</div>
                        <div style="display:flex;justify-content:flex-end;gap:10px;">
                            <button type="button" id="esevaConfirmCancelBtn" style="height:36px;padding:0 16px;border-radius:8px;border:1px solid #cbd5e1;background:#f8fafc;color:#475569;font-size:12.5px;font-weight:700;cursor:pointer;">ரத்து</button>
                            <button type="button" id="esevaConfirmOkBtn" style="height:36px;padding:0 18px;border-radius:8px;border:none;background:#e11d48;color:#ffffff;font-size:12.5px;font-weight:700;cursor:pointer;box-shadow:0 2px 6px rgba(225,29,72,0.3);">${confirmText}</button>
                        </div>
                    </div>
                `;
                document.body.appendChild(overlay);
                const cleanup = (result) => {
                    overlay.remove();
                    fetch('/api/desktop/window-action?action=focus').catch(() => {});
                    resolve(result);
                };
                document.getElementById('esevaConfirmCancelBtn').onclick = () => cleanup(false);
                document.getElementById('esevaConfirmOkBtn').onclick = () => cleanup(true);
            });
        }
        window.showInAppConfirmModal = showInAppConfirmModal;

        async function permanentDeleteCustomerDraft(mobile, name) {
            const displayName = name && name !== '—' ? name : `+91 ${mobile}`;
            const confirmed = await showInAppConfirmModal(
                `🗑️ வாடிக்கையாளர் வரைவை நீக்கவா?`,
                `"${displayName}" (+91 ${mobile}) வாடிக்கையாளர் வரைவை முழுமையாக நீக்க விரும்புகிறீர்களா?\n\nFirebase மற்றும் கம்ப்யூட்டரிலிருந்து இந்த வாடிக்கையாளரின் தரவுகள் நிரந்தரமாக அழிக்கப்படும்.`,
                `🗑️ நிரந்தரமாக நீக்கு`
            );
            if (!confirmed) return;

            try {
                const res = await fetch(`/api/drafts/${mobile}?permanent=true`, {
                    method: 'DELETE'
                });
                const data = await res.json();
                if (data.success) {
                    showInAppToast('🗑️ வாடிக்கையாளர் வரைவு முழுமையாக அழிக்கப்பட்டது.');
                    
                    const activeMob = (localStorage.getItem('eseva_active_customer_mobile') || '').replace(/\D/g, '').slice(-10);
                    const targetMob = (mobile || '').replace(/\D/g, '').slice(-10);

                    // If the deleted customer was currently loaded/active, or if screen has no active customer, fully reset screen!
                    if (!activeMob || (activeMob && targetMob && activeMob === targetMob)) {
                        if (typeof clearAutomationScreenSession === 'function') {
                            clearAutomationScreenSession();
                        } else if (typeof resetIntakeChat === 'function') {
                            resetIntakeChat();
                        } else {
                            localStorage.removeItem('eseva_active_customer_mobile');
                            localStorage.removeItem('eseva_active_customer_name');
                            currentCitizenData = null;
                            lastRenderedChatHistoryJson = '';
                            lastRenderedChatHistoryLength = 0;
                            if (typeof resetSidebarToOperatorView === 'function') resetSidebarToOperatorView();
                            const titleEl = document.getElementById('activeCustomerTitle');
                            if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-robot"></i> eSevaDraft ஏஐ உரையாடல் மையம்`;
                            if (typeof renderDefaultWelcomeMessage === 'function') renderDefaultWelcomeMessage();
                        }
                    }

                    allOperatorDrafts = allOperatorDrafts.filter(d => (d.mobileNumber || '').replace(/\D/g, '').slice(-10) !== targetMob);
                    window.allOperatorDrafts = allOperatorDrafts;
                    renderOperatorDrafts();
                    fetchOperatorDrafts();
                } else {
                    showInAppToast('பிழை: ' + (data.error || 'நிரந்தரமாக நீக்க முடியவில்லை'), true);
                }
            } catch (e) {
                showInAppToast('பிழை: ' + e.message, true);
            }
        }

        async function trashCustomerDraft(mobile, name) {
            return permanentDeleteCustomerDraft(mobile, name);
        }

        // Backward-compatible alias
        const deleteCustomerDraft = permanentDeleteCustomerDraft;

        async function deleteAllOperatorDrafts() {
            if (!allOperatorDrafts || allOperatorDrafts.length === 0) {
                showInAppToast('நீக்குவதற்கு வாடிக்கையாளர் வரைவுகள் எதுவும் இல்லை.', true);
                return;
            }
            const confirmed = await showInAppConfirmModal(
                `⚠️ அனைத்து வரைவுகளையும் அழிக்கவா?`,
                `மொத்தம் ${allOperatorDrafts.length} வாடிக்கையாளர் வரைவுகள் உள்ளன. இவை அனைத்தும் Firebase மற்றும் கம்ப்யூட்டரிலிருந்து நிரந்தரமாக அழிக்கப்படும்.\n\nதொடரவா?`,
                `🗑️ அனைத்தையும் நீக்கு`
            );
            if (!confirmed) return;

            showCustomerLoading('வரைவுகள் அழிக்கப்படுகின்றன...', 'Firebase மற்றும் கம்ப்யூட்டரிலிருந்து நீக்கப்படுகிறது');
            try {
                for (const d of [...allOperatorDrafts]) {
                    await fetch(`/api/drafts/${d.mobileNumber}?permanent=true`, { method: 'DELETE' }).catch(() => {});
                }
                if (typeof clearAutomationScreenSession === 'function') {
                    clearAutomationScreenSession();
                } else if (typeof resetIntakeChat === 'function') {
                    resetIntakeChat();
                }
                localStorage.removeItem('eseva_active_customer_mobile');
                localStorage.removeItem('eseva_active_customer_name');
                currentCitizenData = null;
                lastRenderedChatHistoryJson = '';
                lastRenderedChatHistoryLength = 0;
                if (typeof resetSidebarToOperatorView === 'function') resetSidebarToOperatorView();
                const titleEl = document.getElementById('activeCustomerTitle');
                if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-robot"></i> eSevaDraft ஏஐ உரையாடல் மையம்`;
                if (typeof renderDefaultWelcomeMessage === 'function') renderDefaultWelcomeMessage();
                allOperatorDrafts = [];
                window.allOperatorDrafts = [];
                renderOperatorDrafts();
                showInAppToast('✅ அனைத்து வாடிக்கையாளர் வரைவுகளும் வெற்றிகரமாக அழிக்கப்பட்டன.');
            } catch (e) {
                showInAppToast('பிழை: ' + e.message, true);
            } finally {
                hideCustomerLoading();
                fetchOperatorDrafts();
            }
        }
        window.deleteAllOperatorDrafts = deleteAllOperatorDrafts;

        async function restoreCustomerDraft(mobile, name) {
            const displayName = name && name !== '—' ? name : `+91 ${mobile}`;
            try {
                const res = await fetch(`/api/drafts/${mobile}/restore`, {
                    method: 'POST'
                });
                const data = await res.json();
                if (data.success) {
                    showInAppToast(`✅ "${displayName}" வாடிக்கையாளர் வரைவு வெற்றிகரமாக மீட்டெடுக்கப்பட்டது!`);
                    currentDraftFilter = 'ALL';
                    document.querySelectorAll('#operatorFilterButtons .filter-pill, #operatorFilterButtonsModal .filter-pill').forEach(b => {
                        b.classList.remove('active');
                        if (b.getAttribute('onclick') && b.getAttribute('onclick').includes("'ALL'")) {
                            b.classList.add('active');
                        }
                    });
                    fetchOperatorDrafts();
                } else {
                    showInAppToast('பிழை: ' + (data.error || 'மீட்டெடுக்க முடியவில்லை'), true);
                }
            } catch (e) {
                showInAppToast('பிழை: ' + e.message, true);
            }
        }

        function showCustomerLoading(title, subtext) {
            const overlay = document.getElementById('customerLoadingOverlay');
            const titleEl = document.getElementById('customerLoadingTitle');
            const subEl = document.getElementById('customerLoadingSubtext');
            if (titleEl) titleEl.innerText = title || 'வாடிக்கையாளர் விவரங்கள் ஏற்றப்படுகின்றன...';
            if (subEl) subEl.innerText = subtext || 'ஆவணங்கள் மற்றும் தரவுகள் மீட்டெடுக்கப்படுகின்றன';
            if (overlay) {
                overlay.style.display = 'flex';
            }
        }

        function hideCustomerLoading() {
            const overlay = document.getElementById('customerLoadingOverlay');
            if (overlay) {
                overlay.style.display = 'none';
            }
        }

        async function resumeCustomerSession(mobile, autoSubmit) {
            closeOperatorDraftsModal();
            closeNewCustomerModal();

            const mobileClean = (mobile || '').replace(/\D/g, '');
            if (!mobileClean) return;

            const knownDraft = allOperatorDrafts.find(d => d.mobileNumber === mobileClean);
            const knownName = knownDraft ? knownDraft.name : '';
            showCustomerLoading(
                knownName ? `${knownName} விவரங்கள் மீட்டெடுக்கப்படுகின்றன...` : 'வாடிக்கையாளர் விவரங்கள் மீட்டெடுக்கப்படுகின்றன...',
                `+91 ${mobileClean} தரவுகள் திறக்கப்படுகின்றன`
            );

            localStorage.setItem('eseva_active_customer_mobile', mobileClean);
            const opUid = localStorage.getItem('eseva_operator_uid') || '';
            const opName = localStorage.getItem('eseva_operator_name') || '';
            const opMob = localStorage.getItem('eseva_operator_mobile') || '';

            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'x-operator-uid': opUid,
                        'x-session-mobile': mobileClean
                    },
                    body: JSON.stringify({ 
                        mobileNumber: mobileClean,
                        customerMobile: mobileClean,
                        isCustomerSession: true,
                        operatorUid: opUid,
                        operatorName: opName,
                        operatorMobile: opMob
                    })
                });
                const data = await res.json();
                if (data.success) {
                    hideCustomerLoading();
                    switchTab('citizen');
                    const custName = (typeof resolveCustomerDisplayName === 'function')
                        ? resolveCustomerDisplayName(data.citizenProfile, knownName || '')
                        : ((data.citizenProfile && (data.citizenProfile.fullNameTam || data.citizenProfile.fullNameEng)) || knownName || 'வாடிக்கையாளர்');
                    localStorage.setItem('eseva_active_customer_name', custName);

                    if (typeof renderActiveCustomerHeader === 'function') {
                        renderActiveCustomerHeader(custName, mobileClean);
                    } else {
                        const titleEl = document.getElementById('activeCustomerTitle');
                        if (titleEl) {
                            const nameDisplay = (custName && custName !== 'வாடிக்கையாளர்') ? `<b>${custName}</b> ` : '';
                            titleEl.innerHTML = `<i class="fa-solid fa-user-check" style="color: #16a34a; flex-shrink: 0;"></i> <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">வாடிக்கையாளர்: ${nameDisplay}(+91 ${mobileClean})</span>`;
                        }
                    }
                    if (data.chatHistory && data.chatHistory.length > 0) {
                        lastRenderedChatHistoryJson = '';
                        lastRenderedChatHistoryLength = 0;
                        renderMessages(data.chatHistory, true);
                        if (typeof updateSidebar === 'function') {
                            updateSidebar({ citizenProfile: data.citizenProfile, ...data });
                        }
                    } else {
                        await fetchHistory(true);
                    }
                    if (autoSubmit) {
                        setTimeout(() => openPreSubmitModal(), 400);
                    }
                } else {
                    // Clear fix: show error — no more silent no-reaction!
                    alert('⚠️ வாடிக்கையாளர் அமர்வைத் திறக்க முடியவில்லை: ' + (data.error || data.message || 'சேவையகப் பிழை'));
                }
            } catch (e) {
                alert('பிழை: ' + e.message);
            } finally {
                hideCustomerLoading();
            }
        }


        async function editCustomerFromDraftDesk(mobile) {
            const mobileClean = (mobile || '').replace(/\D/g, '');
            if (!mobileClean) return;

            closeOperatorDraftsModal();
            closeNewCustomerModal();
            localStorage.setItem('eseva_active_customer_mobile', mobileClean);

            const knownDraft = (allOperatorDrafts || []).find(d => d.mobileNumber === mobileClean);
            const knownName = knownDraft ? knownDraft.name : '';
            showCustomerLoading(
                knownName ? `${knownName} விவரங்கள் திறக்கப்படுகின்றன...` : 'வாடிக்கையாளர் விவரங்கள் திறக்கப்படுகின்றன...',
                `+91 ${mobileClean} விவரங்களைத் திருத்தும் படிவம் ஏற்றப்படுகிறது`
            );

            try {
                const res = await fetch(`/api/drafts/${mobileClean}`);
                const data = await res.json();
                if (data && data.draft) {
                    const profile = data.draft.citizenProfile || {};
                    currentCitizenData = Object.assign({}, profile, {
                        headPhotoPath: profile.headPhotoPath || data.draft.documents?.profilePhoto,
                        members: profile.members,
                        documents: data.draft.documents
                    });
                    const custName = (typeof resolveCustomerDisplayName === 'function')
                        ? resolveCustomerDisplayName(profile, knownName || '')
                        : (profile.fullNameTam || profile.fullNameEng || knownName || 'வாடிக்கையாளர்');
                    localStorage.setItem('eseva_active_customer_name', custName);
                    if (typeof renderActiveCustomerHeader === 'function') {
                        renderActiveCustomerHeader(custName, mobileClean);
                    }
                    if (typeof updateSidebar === 'function') {
                        updateSidebar({ citizenProfile: currentCitizenData, documents: data.draft.documents });
                    }
                }
                if (typeof openEditModal === 'function') {
                    await openEditModal(mobileClean, true);
                }
            } catch (e) {
                console.warn('Error opening edit modal for draft customer:', e);
                if (typeof openEditModal === 'function') {
                    await openEditModal(mobileClean, true);
                }
            } finally {
                hideCustomerLoading();
            }
        }
        window.editCustomerFromDraftDesk = editCustomerFromDraftDesk;

        function handleProfileBadgeClick() {
            const role = localStorage.getItem('eseva_user_role') || 'citizen';
            if (role === 'operator') {
                openOperatorProfileModal();
            }
        }

        function openOperatorProfileModal() {
            const modal = document.getElementById('operatorProfileModal');
            if (!modal) return;
            const currentName = localStorage.getItem('eseva_operator_name') || 'குமரன் இ-சேவை மையம்';
            const currentMob = localStorage.getItem('eseva_operator_mobile') || '';
            const nameInput = document.getElementById('opProfCenterName');
            const mobInput = document.getElementById('opProfMobile');
            const tnegaUserInput = document.getElementById('opProfTnegaUser');
            const tnegaPassInput = document.getElementById('opProfTnegaPass');
            if (nameInput) nameInput.value = currentName;
            if (mobInput) mobInput.value = currentMob;
            if (tnegaUserInput) tnegaUserInput.value = localStorage.getItem('eseva_tnega_user') || 'TNTACCHN001-01';
            if (tnegaPassInput) tnegaPassInput.value = localStorage.getItem('eseva_tnega_pass') || '';
            modal.style.display = 'flex';
        }

        function closeOperatorProfileModal() {
            const modal = document.getElementById('operatorProfileModal');
            if (modal) modal.style.display = 'none';
        }

        async function saveOperatorProfile() {
            const nameInput = document.getElementById('opProfCenterName');
            const mobInput = document.getElementById('opProfMobile');
            const newName = nameInput ? nameInput.value.trim() : '';
            const newMob = mobInput ? mobInput.value.replace(/\D/g, '') : '';

            if (!newName) {
                alert('மையம் அல்லது உரிமையாளர் பெயரை உள்ளிடவும்.');
                return;
            }

            const opUid = localStorage.getItem('eseva_operator_uid') || '';
            const btn = document.getElementById('btnSaveOpProf');
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> சேமிக்கிறது...';
            }

            try {
                const res = await fetch('/api/operator/profile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        operatorUid: opUid,
                        displayName: newName,
                        mobileNumber: newMob
                    })
                });
                const data = await res.json();
                if (data.success) {
                    localStorage.setItem('eseva_operator_name', newName);
                    if (newMob) localStorage.setItem('eseva_operator_mobile', newMob);
                    const tnegaU = document.getElementById('opProfTnegaUser')?.value.trim() || '';
                    const tnegaP = document.getElementById('opProfTnegaPass')?.value.trim() || '';
                    if (tnegaU) localStorage.setItem('eseva_tnega_user', tnegaU);
                    if (tnegaP) localStorage.setItem('eseva_tnega_pass', tnegaP);
                    const nameEl = document.getElementById('authProfileName');
                    if (nameEl) nameEl.innerHTML = `<i class="fa-solid fa-store" style="color: #fde047;"></i> ${newName} <i class="fa-solid fa-pen" style="font-size: 9px; opacity: 0.75; margin-left: 4px;"></i>`;
                    closeOperatorProfileModal();
                } else {
                    alert('பிழை: ' + (data.error || 'சேமிக்க முடியவில்லை'));
                }
            } catch (e) {
                alert('பிழை: ' + e.message);
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fa-solid fa-check"></i> 💾 சேமி';
                }
            }
        }

        function formatAndHandleCustomerMobileInput(input) {
            if (!input) return;
            let raw = input.value || '';
            let digits = raw.replace(/\D/g, '');
            if (digits.length > 10 && (digits.startsWith('91') || digits.startsWith('0'))) {
                digits = digits.slice(-10);
            } else if (digits.length > 10) {
                digits = digits.slice(0, 10);
            }
            input.value = digits;

            const clearBtn = document.getElementById('clearCustomerMobileBtn');
            if (clearBtn) {
                clearBtn.style.display = digits.length > 0 ? 'flex' : 'none';
            }

            handleNewCustomerMobileInput(digits);
        }

        function clearCustomerMobileInput() {
            const mobInput = document.getElementById('newCustomerMobileInput');
            if (mobInput) {
                mobInput.value = '';
                mobInput.focus();
            }
            const clearBtn = document.getElementById('clearCustomerMobileBtn');
            if (clearBtn) clearBtn.style.display = 'none';
            const box = document.getElementById('customerSuggestionsBox');
            if (box) { box.style.display = 'none'; box.innerHTML = ''; }
        }
