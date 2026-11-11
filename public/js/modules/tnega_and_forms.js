// eSevaDraft Domain Module: tnega_and_forms.js

        async function deleteActiveCustomerDraft(forcedMob) {
            const mob = forcedMob || localStorage.getItem('eseva_active_customer_mobile') || (currentCitizenData && currentCitizenData.mobileNumber) || '';
            const name = localStorage.getItem('eseva_active_customer_name') || currentCitizenData?.fullNameTam || currentCitizenData?.fullNameEng || 'வாடிக்கையாளர்';

            if (!mob) {
                alert('செயலில் உள்ள வாடிக்கையாளர் வரைவு எதுவும் இல்லை.');
                return;
            }

            const confirmed = confirm(`வாடிக்கையாளர் "${name}" (+91 ${mob}) வரைவு விண்ணப்பத்தை முற்றிலும் நீக்க வேண்டுமா?\n\n(Do you want to permanently delete this customer draft?)`);
            if (!confirmed) return;

            try {
                // 1. Terminate local Playwright browser via Desktop Bridge
                if (window.esevaDesktopBridge && window.esevaDesktopBridge.stopLiveAutomation) {
                    await window.esevaDesktopBridge.stopLiveAutomation().catch(e => console.warn('[Desktop Bridge] Stop warn:', e));
                }

                // 2. Terminate server automation & TNeGA automation
                await fetch('/api/automation/stop', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-session-mobile': mob },
                    body: JSON.stringify({ mobileNumber: mob })
                }).catch(() => {});

                await fetch('/api/tnega/stop', { method: 'POST' }).catch(() => {});

                // 3. Delete draft from server
                const res = await fetch(`/api/drafts/${encodeURIComponent(mob)}`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' }
                });

                if (!res.ok) {
                    await fetch('/api/drafts/delete', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ mobileNumber: mob })
                    }).catch(() => {});
                }

                // 4. Clear client session
                localStorage.removeItem('eseva_active_customer_mobile');
                localStorage.removeItem('eseva_active_customer_name');
                currentCitizenData = null;

                // 5. Hide progress bar and header/sidebar action buttons
                const pBar = document.getElementById('automationProgressBar');
                if (pBar) pBar.classList.remove('active');
                const headerStopBtn = document.getElementById('btnStopAutomationHeader');
                if (headerStopBtn) headerStopBtn.style.display = 'none';
                const headerClearBtn = document.getElementById('btnClearScreenHeader') || document.getElementById('btnDeleteDraftHeader');
                if (headerClearBtn) headerClearBtn.style.display = 'none';
                const sidebarClearBtn = document.getElementById('btnClearScreenSidebar') || document.getElementById('btnDeleteDraftSidebar');
                if (sidebarClearBtn) sidebarClearBtn.style.display = 'none';

                if (typeof resetSidebarToOperatorView === 'function') {
                    resetSidebarToOperatorView();
                }
                if (typeof fetchOperatorDrafts === 'function') {
                    fetchOperatorDrafts();
                }

                const chatBox = document.getElementById('chatMessages') || chatMessages;
                if (chatBox) {
                    const successCard = document.createElement('div');
                    successCard.className = 'msg-bubble msg-bot';
                    successCard.innerHTML = `
                        <div style="background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 10px; padding: 12px 14px; margin: 6px 0;">
                            <div style="display: flex; align-items: center; gap: 8px; color: #166534; font-weight: 800; font-size: 12.5px;">
                                <i class="fa-solid fa-circle-check" style="color: #16a34a; font-size: 16px;"></i>
                                <span>விண்ணப்ப வரைவு வெற்றிகரமாக நீக்கப்பட்டது! (Draft Deleted)</span>
                            </div>
                            <div style="font-size: 11.5px; color: #15803d; margin-top: 4px;">
                                வாடிக்கையாளர் (${mob}) விவரங்கள் முழுமையாக நீக்கப்பட்டுவிட்டன.
                            </div>
                            <div style="margin-top: 10px;">
                                <button onclick="goToHomePage()" style="height: 32px; padding: 0 14px; background: #16a34a; color: white; border: none; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">
                                    <i class="fa-solid fa-house"></i> புதிய வாடிக்கையாளர் விண்ணப்பம் தொடங்குக ▶
                                </button>
                            </div>
                        </div>
                    `;
                    chatBox.appendChild(successCard);
                    scrollToChatBottom(true);
                }

            } catch (e) {
                console.error('[Delete Draft Error]', e);
                alert('வரைவை நீக்குவதில் பிழை: ' + e.message);
            }
        }

        async function deleteStoppedAutomationDraft(mobileNumber) {
            await deleteActiveCustomerDraft(mobileNumber);
        }

        let currentCanTargetMobile = '';

        function openTnegaCanModal(prefillValue = '', targetMobile = '') {
            const modal = document.getElementById('tnegaCanModal');
            if (!modal) return;
            const inp = document.getElementById('tnegaCanSearchInput');
            if (inp && prefillValue) inp.value = prefillValue;

            currentCanTargetMobile = targetMobile || (prefillValue && prefillValue.length === 10 ? prefillValue : '');
            const mobInp = document.getElementById('tnegaCanTargetMobile');
            if (mobInp) mobInp.value = currentCanTargetMobile;

            const resBox = document.getElementById('tnegaCanResultBox');
            if (resBox) resBox.style.display = 'none';
            modal.style.display = 'flex';
        }


        async function linkCanToCustomerMaster(mobile, canNumber) {
            if (!mobile || !canNumber) {
                alert('மொபைல் எண் மற்றும் CAN எண் தேவை.');
                return;
            }
            try {
                const res = await fetch('/api/operator/link-can', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mobileNumber: mobile, canNumber: canNumber })
                });
                const data = await res.json();
                if (data.success) {
                    alert('🎉 வாடிக்கையாளரின் (+91 ' + mobile + ') Master Profile-ல் CAN எண் (' + canNumber + ') நிரந்தரமாக இணைக்கப்பட்டது!');
                    fetchOperatorDrafts();
                } else {
                    alert('இணைப்பதில் பிழை: ' + (data.error || 'தெரியாத பிழை'));
                }
            } catch (e) {
                alert('பிழை: ' + e.message);
            }
        }

        async function handleCanAadhaarUpload(inputEl) {
            if (!inputEl.files || !inputEl.files[0]) return;
            const file = inputEl.files[0];
            const mobInp = document.getElementById('tnegaCanTargetMobile');
            const mobile = mobInp ? mobInp.value.trim().replace(/\D/g, '') : currentCanTargetMobile;

            const resBox = document.getElementById('tnegaCanResultBox');
            if (resBox) {
                resBox.style.display = 'block';
                resBox.innerHTML = '<div style="text-align:center; padding: 12px; font-size: 12.5px; color: #0891b2;"><i class="fa-solid fa-spinner fa-spin"></i> ஆதார் படம் ஸ்கேன் செய்யப்பட்டு Master Profile உருவாக்கப்படுகிறது...</div>';
            }

            const formData = new FormData();
            formData.append('file', file);
            if (mobile) formData.append('mobileNumber', mobile);

            try {
                const res = await fetch('/api/operator/scan-aadhaar', {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();

                if (data.success && data.extracted) {
                    const ext = data.extracted;
                    const searchInp = document.getElementById('tnegaCanSearchInput');
                    if (searchInp && ext.headAadhaar) searchInp.value = ext.headAadhaar;

                    resBox.innerHTML = `
                        <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 10px; margin-bottom: 10px;">
                            <div style="color: #166534; font-weight: 800; font-size: 12.5px; margin-bottom: 4px;">✅ ஆதார் விவரங்கள் கண்டறியப்பட்டது!</div>
                            <div style="font-size: 12px; color: #334155; line-height: 1.5;">
                                <div>👤 <b>${ext.fullNameTam || ext.fullNameEng || 'விண்ணப்பதாரர்'}</b></div>
                                <div>👨 தந்தை: ${ext.fatherNameTam || ext.fatherNameEng || '—'}</div>
                                <div>🪪 ஆதார்: ${ext.headAadhaar || '—'}</div>
                                <div>🏛️ ${ext.taluk ? ext.taluk + ', ' : ''}${ext.district || '—'}</div>
                            </div>
                        </div>
                        <button onclick="executeTnegaCanSearch()" style="width: 100%; height: 34px; background: #0891b2; color: white; border: none; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
                            <i class="fa-solid fa-magnifying-glass"></i> இந்த ஆதாரை வைத்து CAN தேடு
                        </button>
                    `;
                    fetchOperatorDrafts();
                } else {
                    resBox.innerHTML = `<div style="color: #dc2626; font-size: 12px;">ஆதார் ஸ்கேன் பிழை: ${data.error || 'தெரியாத பிழை'}</div>`;
                }
            } catch (e) {
                resBox.innerHTML = `<div style="color: #dc2626; font-size: 12px;">பிழை: ${e.message}</div>`;
            } finally {
                inputEl.value = '';
            }
        }

        function closeTnegaCanModal() {
            const modal = document.getElementById('tnegaCanModal');
            if (modal) modal.style.display = 'none';
        }

        async function executeTnegaCanSearch() {
            const inp = document.getElementById('tnegaCanSearchInput');
            const val = inp ? inp.value.trim().replace(/\s+/g, '') : '';
            if (!val) {
                alert('தயவுசெய்து ஆதார் எண் அல்லது மொபைல் எண்ணை உள்ளிடவும்.');
                return;
            }

            const btn = document.getElementById('btnExecuteCanSearch');
            const resBox = document.getElementById('tnegaCanResultBox');
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> தேடுகிறது...';
            }

            try {
                const isAadhaar = val.length === 12;
                const isMock = typeof isDevMockModeActive === 'function' ? isDevMockModeActive() : false;
                const res = await fetch('/api/tnega/can/search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        aadhaar: isAadhaar ? val : '',
                        mobile: !isAadhaar ? val : '',
                        isMockSandbox: isMock
                    })
                });
                const data = await res.json();
                resBox.style.display = 'block';

                if (data.success && data.found) {
                    const familyRowsHtml = (Array.isArray(data.records) && data.records.length > 1)
                        ? `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed #cbd5e1; font-size: 11px;">
                             <div style="font-weight: 700; color: #0f172a; margin-bottom: 4px;">👨‍👩‍👧‍👦 இந்த மொபைல் எண்ணில் உள்ள அனைத்து CAN பதிவுகள் (${data.records.length}):</div>
                             ${data.records.map(r => `
                               <div style="display:flex; justify-content:space-between; align-items:center; padding: 4px 6px; background:#f8fafc; border-radius:4px; margin-bottom:3px;">
                                 <span><b>${r.name}</b> (தந்தை/கணவர்: ${r.fatherName}) — <b style="color:#0891b2;">${r.canNumber}</b></span>
                                 <button onclick="const m = document.getElementById('tnegaCanTargetMobile')?.value.trim() || currentCanTargetMobile; linkCanToCustomerMaster(m, '${r.canNumber}')" style="background:#16a34a; color:#fff; border:none; border-radius:4px; padding:2px 6px; font-size:10px; cursor:pointer;">சேமி</button>
                               </div>
                             `).join('')}
                           </div>`
                        : '';
                    resBox.innerHTML = `
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <span style="background: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 700;">✅ CAN எண் உள்ளது</span>
                            <button onclick="navigator.clipboard.writeText('${data.canNumber}'); alert('CAN எண் காப்பி செய்யப்பட்டது: ${data.canNumber}')" style="background: none; border: 1px solid #cbd5e1; padding: 2px 8px; border-radius: 4px; font-size: 11px; cursor: pointer; color: #475569;">📋 காப்பி</button>
                        </div>
                        <div style="font-size: 15px; font-weight: 800; color: #0891b2; letter-spacing: 0.5px; margin-bottom: 6px;">
                            CAN: ${data.canNumber}
                        </div>
                        <div style="font-size: 12px; color: #334155; line-height: 1.6;">
                            <div>👤 <b>${data.citizenName || '—'}</b></div>
                            <div>👨 தந்தை: ${data.fatherName || '—'}</div>
                            <div>🏛️ ${data.taluk ? data.taluk + ', ' : ''}${data.district || '—'}</div>
                        </div>
                        ${familyRowsHtml}
                        <div style="display: flex; gap: 6px; margin-top: 10px;">
                            <button onclick="const m = document.getElementById('tnegaCanTargetMobile')?.value.trim() || currentCanTargetMobile; linkCanToCustomerMaster(m, '${data.canNumber}')" style="flex: 1; height: 32px; background: #16a34a; color: white; border: none; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;">
                                <i class="fa-solid fa-floppy-disk"></i> Master Profile-ல் சேமி
                            </button>
                            <button onclick="closeTnegaCanModal(); startDirectApplyService('வருமானச் சான்றிதழ்');" style="flex: 1; height: 32px; background: #0284c7; color: white; border: none; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;">
                                📜 வருமானச் சான்றிதழ்
                            </button>
                        </div>
                    `;
                } else {
                    resBox.innerHTML = `
                        <div style="text-align: center; color: #64748b; font-size: 12px; padding: 6px 0;">
                            <div style="font-size: 20px; margin-bottom: 4px;">⚠️</div>
                            <div style="font-weight: 700; color: #1e293b;">பதிவு எதுவும் இல்லை (No CAN Record Found)</div>
                            <p style="margin: 4px 0 10px 0;">இந்த எண்ணுக்கு இன்னும் CAN உருவாக்கப்படவில்லை. இப்போது புதிய CAN பதிவு செய்யலாம்.</p>
                            <button onclick="startAutoCanRegistration('${val}')" style="height: 32px; padding: 0 14px; background: #16a34a; color: white; border: none; border-radius: 6px; font-size: 11.5px; font-weight: 700; cursor: pointer;">
                                📝 புதிய CAN பதிவு செய்க (Auto-Register)
                            </button>
                        </div>
                    `;
                }
            } catch (e) {
                resBox.style.display = 'block';
                resBox.innerHTML = `<div style="color: #dc2626; font-size: 12px;">பிழை: ${e.message}</div>`;
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> தேடு';
                }
            }
        }


        async function startAutoCanRegistration(inputVal) {
            const resBox = document.getElementById('tnegaCanResultBox');
            if (resBox) resBox.innerHTML = '<div style="text-align:center; padding: 10px; font-size: 12px; color: #0891b2;"><i class="fa-solid fa-spinner fa-spin"></i> புதிய CAN எண் பதிவு செய்யப்பட்டு வருகிறது...</div>';

            try {
                const isAadhaar = inputVal.length === 12;
                const res = await fetch('/api/tnega/can/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        citizenProfile: {
                            headAadhaar: isAadhaar ? inputVal : '987654321012',
                            mobile: !isAadhaar ? inputVal : '9790170026',
                            fullNameTam: 'சுரேஷ் வி',
                            fullNameEng: 'Suresh V',
                            fatherNameTam: 'வெங்கடேசன்',
                            fatherNameEng: 'Venkatesan',
                            district: 'Ranipet',
                            taluk: 'Arakkonam',
                            village: 'Minnal',
                            pincode: '631001'
                        },
                        isMockSandbox: true
                    })
                });
                const data = await res.json();
                if (data.success && data.canNumber) {
                    resBox.innerHTML = `
                        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px; text-align: center;">
                            <div style="color: #16a34a; font-weight: 800; font-size: 13px;">🎉 புதிய CAN எண் உருவாக்கப்பட்டது!</div>
                            <div style="font-size: 16px; font-weight: 900; color: #065f46; margin: 6px 0;">CAN: ${data.canNumber}</div>
                            <button onclick="closeTnegaCanModal(); startDirectApplyService('வருமானச் சான்றிதழ்');" style="margin-top: 6px; height: 32px; padding: 0 12px; background: #0284c7; color: white; border: none; border-radius: 6px; font-size: 11.5px; font-weight: 700; cursor: pointer;">
                                📜 வருமானச் சான்றிதழ் விண்ணப்பிக்க
                            </button>
                        </div>
                    `;
                } else {
                    resBox.innerHTML = `<div style="color: #dc2626; font-size: 12px;">பதிவில் பிழை: ${data.error || 'தெரியாத பிழை'}</div>`;
                }
            } catch (e) {
                resBox.innerHTML = `<div style="color: #dc2626; font-size: 12px;">பிழை: ${e.message}</div>`;
            }
        }

        async function triggerTnegaOperatorLoginUI() {
            const user = localStorage.getItem('eseva_tnega_user') || 'TNTACCHN001-01';
            const pass = localStorage.getItem('eseva_tnega_pass') || '';
            try {
                const res = await fetch('/api/tnega/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: user, password: pass, isMockSandbox: true })
                });
                const data = await res.json();
                if (data.success) {
                    alert('✅ TNeGA e-Sevai போர்ட்டல் லாகின் அமர்வு தயாராக உள்ளது! (Session Active)');
                } else {
                    alert('லாகின் பிழை: ' + (data.error || 'தெரியாத பிழை'));
                }
            } catch (e) {
                alert('பிழை: ' + e.message);
            }
        }

        function promptDownloadTnpdsPdf() {
            const defaultRef = localStorage.getItem('eseva_last_app_ref') || '';
            const ref = prompt('14-இலக்க TNPDS விண்ணப்ப குறிப்பு எண்ணை (Application Ref No) உள்ளிடவும்:\n(எடுத்துக்காட்டு: 04260902721244)', defaultRef);
            if (ref) {
                downloadTnpdsPdfFromInput(ref);
            }
        }

        function toggleGasFields(hasGas) {
            const wrap = document.getElementById('gasFieldsWrap');
            if (wrap) wrap.style.display = hasGas ? 'grid' : 'none';
        }

        let pendingDocUploads = {};

        function formatDocUrl(docPath) {
            if (!docPath || typeof docPath !== 'string') return '';
            if (docPath.startsWith('http://') || docPath.startsWith('https://') || docPath.startsWith('data:') || docPath.startsWith('/api/')) return docPath;
            const clean = docPath.replace(/\\/g, '/').replace(/^\/app\//, '');
            const upIdx = clean.toLowerCase().indexOf('uploads/');
            if (upIdx !== -1) {
                return '/' + clean.substring(upIdx);
            }
            const compIdx = clean.toLowerCase().indexOf('compressed/');
            if (compIdx !== -1) {
                return '/' + clean.substring(compIdx);
            }
            const stripped = clean.startsWith('/') ? clean.substring(1) : clean;
            return '/uploads/' + stripped;
        }

        function isPdfPath(docPath) {
            if (!docPath || typeof docPath !== 'string') return false;
            return docPath.toLowerCase().endsWith('.pdf') || docPath.includes('application/pdf');
        }

        function renderDocPreview(docPath, imgId, phId, pdfId, statusId, viewBtnId, defaultPrompt, deleteBtnId = null, forcedIsPdf = false) {
            const imgEl = document.getElementById(imgId);
            const phEl = document.getElementById(phId);
            const pdfEl = pdfId ? document.getElementById(pdfId) : null;
            const stEl = document.getElementById(statusId);
            const vbEl = viewBtnId ? document.getElementById(viewBtnId) : null;
            const delEl = deleteBtnId ? document.getElementById(deleteBtnId) : null;

            if (docPath) {
                const url = formatDocUrl(docPath);
                const isPdf = Boolean(forcedIsPdf) || isPdfPath(docPath) || isPdfPath(url);
                if (isPdf) {
                    if (imgEl) imgEl.style.display = 'none';
                    if (phEl) phEl.style.display = 'none';
                    if (pdfEl) {
                        pdfEl.style.display = 'flex';
                        pdfEl.style.cursor = 'pointer';
                        pdfEl.title = 'ஆவணத்தைப் பார்க்க கிளிக் செய்யவும் (Click to view PDF)';
                        pdfEl.onclick = () => window.open(url, '_blank');
                    }
                } else {
                    if (imgEl) {
                        imgEl.style.cursor = 'pointer';
                        imgEl.title = 'ஆவணத்தைப் பார்க்க கிளிக் செய்யவும் (Click to view document)';
                        imgEl.onclick = () => window.open(url, '_blank');
                        imgEl.onerror = function() {
                            imgEl.style.display = 'none';
                            // If image fails to decode (e.g. PDF file misnamed as .jpg, or TIFF),
                            // switch to PDF badge or placeholder, but NEVER hide the View or Delete buttons!
                            if (pdfEl) {
                                pdfEl.style.display = 'flex';
                                pdfEl.style.cursor = 'pointer';
                                pdfEl.onclick = () => window.open(url, '_blank');
                                if (phEl) phEl.style.display = 'none';
                            } else if (phEl) {
                                phEl.style.display = 'block';
                            }
                            if (stEl) {
                                const fname = docPath.split('/').pop().split('\\').pop();
                                stEl.innerText = `✅ ஆவணம்: ${fname.length > 20 ? fname.substring(0, 18) + '...' : fname}`;
                                stEl.style.color = '#16a34a';
                                stEl.style.fontWeight = '600';
                            }
                            if (vbEl) {
                                vbEl.href = url;
                                vbEl.style.display = 'inline-flex';
                            }
                            if (delEl) delEl.style.display = 'inline-flex';
                        };
                        imgEl.src = url;
                        imgEl.style.display = 'block';
                    }
                    if (phEl) phEl.style.display = 'none';
                    if (pdfEl) pdfEl.style.display = 'none';
                }
                if (stEl) {
                    const fname = docPath.split('/').pop().split('\\').pop();
                    stEl.innerText = `✅ ${fname.length > 20 ? fname.substring(0, 18) + '...' : fname}`;
                    stEl.style.color = '#16a34a';
                    stEl.style.fontWeight = '600';
                }
                if (vbEl) {
                    vbEl.href = url;
                    vbEl.style.display = 'inline-flex';
                }
                if (delEl) {
                    delEl.style.display = 'inline-flex';
                }
            } else {
                if (imgEl) imgEl.style.display = 'none';
                if (phEl) phEl.style.display = 'block';
                if (pdfEl) pdfEl.style.display = 'none';
                if (stEl) {
                    stEl.innerText = defaultPrompt;
                    stEl.style.color = '#64748b';
                    stEl.style.fontWeight = 'normal';
                }
                if (vbEl) vbEl.style.display = 'none';
                if (delEl) delEl.style.display = 'none';
            }
        }

        window.formatDocUrl = formatDocUrl;
        window.isPdfPath = isPdfPath;
        window.renderDocPreview = renderDocPreview;
