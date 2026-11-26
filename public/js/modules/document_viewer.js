// eSevaDraft Domain Module: document_viewer.js

        let lastRenderedDocsSignature = '';
        let lastRenderedMembersJson = '';

        function renderSidebarDocuments(documents) {
            const docsList = document.getElementById('sidebarDocsList');
            const docsCount = document.getElementById('sidebarDocsCount');
            if (!docsList) return;

            const curState = (currentCitizenData && (currentCitizenData.step || currentCitizenData.intakeState)) || '';
            const curSub = String(currentCitizenData?.subService || window.lastSubService || '').toUpperCase();
            const svcName = String(currentCitizenData?.serviceName || window.pendingSelectedService || '').toUpperCase();

            const isAddMem = curSub === 'ADD_MEMBER' || curState.startsWith('RATION_ADD_MEMBER') || svcName.includes('உறுப்பினர் சேர்க்கை') || svcName.includes('ADD_MEMBER');
            const isRemMem = curSub === 'REMOVE_MEMBER' || curState.startsWith('RATION_REMOVE_MEMBER') || svcName.includes('உறுப்பினர் நீக்க') || svcName.includes('REMOVE_MEMBER');
            const isAddrChange = curSub === 'CHANGE_ADDRESS' || curState.startsWith('RATION_CHANGE_ADDRESS') || svcName.includes('முகவரி மாற்றம்') || svcName.includes('CHANGE_ADDRESS');
            const isUpdateMob = curSub === 'UPDATE_MOBILE' || curSub === 'CHANGE_MOBILE' || curState.startsWith('RATION_CHANGE_MOBILE');

            const rawList = Array.isArray(documents) ? [...documents] : [];
            let filteredDocs = [];

            if (isAddMem) {
                // ADD_MEMBER: Government portal requires strictly ONLY Member Aadhaar or Birth Certificate, Surrender Proof, and Smart Card.
                // NEVER Applicant Passport Photo, Head Aadhaar, or Gas Consumer Book!
                const memDoc = rawList.find(d => d.type === 'memberAadhaar' || (d.type && d.type.startsWith('memberAadhaar')) || d.type === 'birthCertificate');
                if (memDoc) {
                    filteredDocs.push(memDoc);
                }

                // Check for surrender proof or marriage proof
                const surrenderDoc = rawList.find(d => d.type === 'surrenderProof');
                if (surrenderDoc) filteredDocs.push(surrenderDoc);

                // Check for smart card
                const smartCardDoc = rawList.find(d => d.type === 'smartCard');
                if (smartCardDoc) filteredDocs.push(smartCardDoc);

            } else if (isRemMem) {
                // REMOVE_MEMBER: Only removal proof and smart card
                const remDoc = rawList.find(d => d.type === 'removeProof');
                if (remDoc) filteredDocs.push(remDoc);
                const smartCardDoc = rawList.find(d => d.type === 'smartCard');
                if (smartCardDoc) filteredDocs.push(smartCardDoc);

            } else if (isAddrChange) {
                // CHANGE_ADDRESS: Only new address proof (or explicitly confirmed address proof) and smart card
                const sData = currentCitizenData?.subServiceData || window.lastSubServiceData || {};
                const addrDoc = rawList.find(d => d.type === 'newAddressProof') ||
                    (sData.addressProofDocPath ? rawList.find(d => d.type === 'residenceProof' || d.type === 'gasBook') : null);
                if (addrDoc) filteredDocs.push(addrDoc);
                const smartCardDoc = rawList.find(d => d.type === 'smartCard');
                if (smartCardDoc) filteredDocs.push(smartCardDoc);

            } else if (isUpdateMob) {
                // UPDATE_MOBILE: Only Smart Card (optional reference) & Application PDF — never unrelated Head/Gas/Address docs
                const smartCardDoc = rawList.find(d => d.type === 'smartCard' || d.type === 'rationCard');
                if (smartCardDoc) filteredDocs.push(smartCardDoc);
                const appPdfDoc = rawList.find(d => d.type === 'applicationPdf');
                if (appPdfDoc) filteredDocs.push(appPdfDoc);

            } else {
                // Master Profile / New Ration Card / default
                // Zero-Duplication: If gasBook or residenceProof is present, never show redundant newAddressProof!
                filteredDocs = rawList.filter((doc, idx, arr) => {
                    if (doc.type === 'newAddressProof' && arr.some(d => d.type === 'gasBook' || d.type === 'residenceProof')) {
                        return false;
                    }
                    return true;
                });
            }

            const normalizeSigUrl = (u) => {
                const clean = String(u || '').replace(/([?&])_t=\d+/g, '$1').replace(/[?&]$/, '');
                const m = clean.match(/\/api\/drafts\/[^/]+\/doc\/(.+)$/);
                return m ? `/doc/${m[1]}` : clean;
            };
            const signature = `${curSub}::` + filteredDocs.map(d => `${d.type || ''}|${d.title || ''}|${Boolean(d.isPdf)}|${normalizeSigUrl(d.downloadUrl)}`).join(';;');
            if (signature === lastRenderedDocsSignature && docsList.children.length > 0) {
                return; // ZERO FLICKER: Prevents unnecessary DOM thrashing & scroll jumps!
            }
            lastRenderedDocsSignature = signature;

            if (filteredDocs.length === 0) {
                const emptyHtml = '<div style="font-size: 11px; color: #94a3b8; padding: 4px 0;">பதிவேற்றப்பட்ட ஆவணங்கள் எதுவும் இல்லை.</div>';
                if (docsList.innerHTML !== emptyHtml) docsList.innerHTML = emptyHtml;
                if (docsCount && docsCount.innerText !== '0') docsCount.innerText = '0';
                return;
            }

            if (docsCount && docsCount.innerText !== String(filteredDocs.length)) docsCount.innerText = filteredDocs.length;
            docsList.innerHTML = filteredDocs.map((doc, dIdx) => {
                const iconClass = (doc.icon && doc.icon.startsWith('fa-')) ? doc.icon : 'fa-file-lines';
                const docType = doc.type || '';
                const mIdx = (doc.memberIndex !== undefined) ? doc.memberIndex : (docType.match(/\d+/) ? Number(docType.match(/\d+/)[0]) + 1 : '');
                const cleanTitle = (doc.titleEng || doc.title || doc.type || 'document').replace(/[/\\?%*:|"<>]/g, '_');
                const fileExt = doc.isPdf ? 'pdf' : 'jpg';
                const dlName = `${cleanTitle}.${fileExt}`;
                let previewTargetUrl = doc.previewUrl || doc.downloadUrl;
                if (previewTargetUrl && !previewTargetUrl.includes('_t=')) {
                    previewTargetUrl += (previewTargetUrl.includes('?') ? '&' : '?') + `_t=${Date.now()}`;
                }
                return `
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 8px; gap: 8px; margin-bottom: 5px; transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1); cursor: pointer !important;"
                         onclick="if (typeof window.openEditModalForDoc === 'function') { window.openEditModalForDoc('${docType}', '${mIdx}'); } else if (typeof openEditModal === 'function') { openEditModal(); }"
                         onmouseover="this.style.background='#f1f5f9'; this.style.borderColor='#93c5fd'; this.style.boxShadow='0 2px 6px rgba(2,132,199,0.12)';"
                         onmouseout="this.style.background='#f8fafc'; this.style.borderColor='#e2e8f0'; this.style.boxShadow='none';"
                         title="${doc.title} — திருத்த / மாற்ற கிளிக் செய்யவும்">
                        <div style="display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1;">
                            <div style="width: 28px; height: 28px; border-radius: 6px; background: #eff6ff; color: #0284c7; display: flex; align-items: center; justify-content: center; font-size: 13px; flex-shrink: 0;">
                                <i class="fa-solid ${iconClass}"></i>
                            </div>
                            <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0;">
                                <div style="font-weight: 700; font-size: 11.5px; color: #0f172a; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${doc.title}">${doc.title}</div>
                                <div style="font-size: 10px; color: #64748b; margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${doc.titleEng || doc.type} ${doc.isPdf ? '<span style=\"color: #dc2626; font-weight: 700;\">(PDF)</span>' : '<span style=\"color: #059669; font-weight: 600;\">(IMG)</span>'}</div>
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
                            <a href="${previewTargetUrl}" target="_blank"
                               onclick="event.stopPropagation(); window.open('${previewTargetUrl}', '_blank'); return false;"
                               title="${doc.title} — ஆவணத்தைப் பார் (View Document)"
                               style="height: 30px; width: 30px; border-radius: 7px; background: #f0fdf4; border: 1.5px solid #bbf7d0; color: #16a34a; display: flex; align-items: center; justify-content: center; text-decoration: none; font-size: 12px; cursor: pointer !important; transition: all 0.15s; box-shadow: 0 1px 2px rgba(22,163,74,0.12);"
                               onmouseover="this.style.background='#dcfce7'; this.style.transform='scale(1.08)';"
                               onmouseout="this.style.background='#f0fdf4'; this.style.transform='none';">
                                <i class="fa-solid fa-eye"></i>
                            </a>
                            <button type="button"
                                    onclick="event.preventDefault(); event.stopPropagation(); if (typeof window.openEditModalForDoc === 'function') { window.openEditModalForDoc('${docType}', '${mIdx}'); } else if (typeof openEditModal === 'function') { openEditModal(); }"
                                    title="${doc.title} — திருத்து / மாற்று (Edit/Replace)"
                                    style="height: 30px; width: 30px; border-radius: 7px; background: #eff6ff; border: 1.5px solid #bfdbfe; color: #2563eb; display: flex; align-items: center; justify-content: center; font-size: 11.5px; cursor: pointer !important; transition: all 0.15s; box-shadow: 0 1px 2px rgba(37,99,235,0.12);"
                                    onmouseover="this.style.background='#dbeafe'; this.style.transform='scale(1.08)';"
                                    onmouseout="this.style.background='#eff6ff'; this.style.transform='none';">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                            <a href="${doc.downloadUrl}" download="${dlName}"
                               onclick="event.preventDefault(); event.stopPropagation(); window.downloadDocumentFile('${doc.downloadUrl}', '${dlName}', ${Boolean(doc.isPdf)});"
                               title="${doc.title} — பதிவிறக்கு (${fileExt.toUpperCase()})"
                               style="height: 30px; width: 30px; border-radius: 7px; background: #ecfdf5; border: 1.5px solid #a7f3d0; color: #059669; display: flex; align-items: center; justify-content: center; text-decoration: none; font-size: 12px; box-shadow: 0 1px 2px rgba(16,185,129,0.15); transition: all 0.15s; cursor: pointer !important;"
                               onmouseover="this.style.background='#d1fae5'; this.style.transform='scale(1.08)';"
                               onmouseout="this.style.background='#ecfdf5'; this.style.transform='none';">
                                <i class="fa-solid fa-download"></i>
                            </a>
                        </div>
                    </div>
                `;
            }).join('');
        }

        let cachedServerDocsByMobile = {};
        let cachedDocsFetchedAtByMobile = {};
        let cachedDocsSubByMobile = {};
        let cachedDocKeysSigByMobile = {};
        let inFlightSidebarDocsPromise = {};

        function downloadDocumentFile(url, suggestedName, isPdf) {
            let filename = suggestedName || 'document';
            const hasExt = /\.(pdf|jpg|jpeg|png)$/i.test(filename);
            if (!hasExt) {
                filename += (isPdf ? '.pdf' : '.jpg');
            } else if (!isPdf && filename.toLowerCase().endsWith('.pdf')) {
                filename = filename.replace(/\.pdf$/i, '.jpg');
            }
            if (typeof window.triggerDownloadUrl === 'function') {
                return window.triggerDownloadUrl(url, filename);
            }
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => a.remove(), 500);
        }
        window.downloadDocumentFile = downloadDocumentFile;

        function resetSidebarDocsCache() {
            cachedServerDocsByMobile = {};
            cachedDocsFetchedAtByMobile = {};
            cachedDocsSubByMobile = {};
            cachedDocKeysSigByMobile = {};
            inFlightSidebarDocsPromise = {};
            lastRenderedDocsSignature = '';
        }
        window.resetSidebarDocsCache = resetSidebarDocsCache;

        function clearCustomerDocCache(mobile) {
            if (!mobile) return;
            const raw = String(mobile).trim();
            const clean = raw.split('_')[0].replace(/\D/g, '').slice(-10);
            const activeDraftId = (localStorage.getItem('eseva_active_draft_id') || '').trim();
            for (const k of [raw, clean, activeDraftId]) {
                if (k) {
                    delete cachedServerDocsByMobile[k];
                    delete cachedDocsFetchedAtByMobile[k];
                    delete cachedDocsSubByMobile[k];
                    delete cachedDocKeysSigByMobile[k];
                }
            }
            lastRenderedDocsSignature = '';
        }
        window.clearCustomerDocCache = clearCustomerDocCache;

        async function fetchSidebarDocuments(mobile) {
            const activeDraftId = (localStorage.getItem('eseva_active_draft_id') || '').trim();
            const opUid = localStorage.getItem('eseva_operator_uid') || '';
            const cleanMob = (mobile && String(mobile).includes('_')) ? mobile : (activeDraftId || mobile || (currentCitizenData && currentCitizenData.mobileNumber) || 'active_session');
            const curSub = currentCitizenData?.subService || window.lastSubService || '';
            const inFlightKey = `${cleanMob}::${curSub}`;
            if (inFlightSidebarDocsPromise[inFlightKey]) {
                return inFlightSidebarDocsPromise[inFlightKey];
            }
            const subQuery = curSub ? `?subService=${encodeURIComponent(curSub)}&liveOnly=1` : '?liveOnly=1';
            cachedDocsFetchedAtByMobile[cleanMob] = Date.now();
            cachedDocsSubByMobile[cleanMob] = curSub;
            const reqHeaders = {};
            if (opUid) reqHeaders['x-operator-uid'] = opUid;
            if (activeDraftId) reqHeaders['x-draft-id'] = activeDraftId;
            const p = (async () => {
                try {
                    const res = await fetch(`/api/drafts/${encodeURIComponent(cleanMob)}/documents-list${subQuery}`, { headers: reqHeaders });
                    const data = await res.json();
                    if (data && data.success && Array.isArray(data.documents) && data.documents.length > 0) {
                        let filteredDocs = data.documents;
                        const activePluginForDocs = (window.ESEVA_PLUGINS && typeof window.ESEVA_PLUGINS.resolveServicePlugin === 'function' && currentCitizenData)
                            ? window.ESEVA_PLUGINS.resolveServicePlugin(currentCitizenData)
                            : null;
                        const allowedDocTypes = activePluginForDocs?.uiCartridge?.ownedDocTypes;
                        if (Array.isArray(allowedDocTypes) && allowedDocTypes.length > 0 && (currentCitizenData?.subService || currentCitizenData?.service || currentCitizenData?.pluginId)) {
                            filteredDocs = data.documents.filter(d => {
                                const t = String(d?.type || '');
                                if (t.startsWith('memberAadhaar')) return allowedDocTypes.includes('memberAadhaar');
                                return allowedDocTypes.includes(t);
                            });
                        }
                        cachedServerDocsByMobile[cleanMob] = filteredDocs;
                        renderSidebarDocuments(filteredDocs);
                    } else {
                        const localDocs = currentCitizenData ? extractDocumentsFromProfile(currentCitizenData, cleanMob) : [];
                        if (localDocs.length > 0) {
                            cachedServerDocsByMobile[cleanMob] = localDocs;
                            renderSidebarDocuments(localDocs);
                        } else {
                            cachedServerDocsByMobile[cleanMob] = [];
                            renderSidebarDocuments([]);
                        }
                    }
                } catch (err) {
                    console.error('Failed to fetch sidebar documents:', err);
                    if (!cachedServerDocsByMobile[cleanMob]) {
                        cachedServerDocsByMobile[cleanMob] = [];
                        renderSidebarDocuments([]);
                    }
                } finally {
                    delete inFlightSidebarDocsPromise[inFlightKey];
                }
            })();
            inFlightSidebarDocsPromise[inFlightKey] = p;
            return p;
        }

        function resolveCustomerDisplayName(profile, fallbackName = '') {
            if (!profile && !fallbackName) return 'வாடிக்கையாளர்';
            const cleanFallback = (fallbackName && fallbackName !== 'வாடிக்கையாளர்' && !String(fallbackName).startsWith('வாடிக்கையாளர் (+91')) ? String(fallbackName).trim() : '';

            if (profile) {
                // 1. Direct Head Name (if not generic placeholder)
                const nameTam = profile.fullNameTam && profile.fullNameTam !== 'வாடிக்கையாளர்' ? profile.fullNameTam.trim() : '';
                const nameEng = profile.fullNameEng && profile.fullNameEng !== 'வாடிக்கையாளர்' ? profile.fullNameEng.trim() : '';
                if (nameTam && nameEng) return `${nameTam} (${nameEng})`;
                if (nameTam) return nameTam;
                if (nameEng) return nameEng;

                // 2. Sub-Service Member (e.g. Addition of Family Member)
                const sub = profile.subServiceData || profile.tempMember || window.lastSubServiceData;
                if (sub) {
                    const subTam = (sub.memberNameTam || sub.nameTam) && (sub.memberNameTam !== 'வாடிக்கையாளர்' && sub.nameTam !== 'வாடிக்கையாளர்') ? (sub.memberNameTam || sub.nameTam).trim() : '';
                    const subEng = (sub.memberNameEng || sub.nameEng || sub.memberName || sub.name) && (sub.memberNameEng !== 'வாடிக்கையாளர்' && sub.nameEng !== 'வாடிக்கையாளர்') ? (sub.memberNameEng || sub.nameEng || sub.memberName || sub.name).trim() : '';
                    if (subTam && subEng) return `${subTam} (${subEng})`;
                    if (subTam) return subTam;
                    if (subEng) return subEng;
                }

                // 3. Family Members list
                if (Array.isArray(profile.members) && profile.members.length > 0) {
                    for (const m of profile.members) {
                        const mTam = (m.nameTam && m.nameTam !== 'வாடிக்கையாளர்') ? m.nameTam.trim() : '';
                        const mEng = (m.nameEng || m.name) && (m.nameEng !== 'வாடிக்கையாளர்' && m.name !== 'வாடிக்கையாளர்') ? (m.nameEng || m.name).trim() : '';
                        if (mTam && mEng) return `${mTam} (${mEng})`;
                        if (mTam) return mTam;
                        if (mEng) return mEng;
                    }
                }
            }

            return cleanFallback || 'வாடிக்கையாளர்';
        }
        window.resolveCustomerDisplayName = resolveCustomerDisplayName;

        function renderActiveCustomerHeader(custName, mob) {
            const titleEl = document.getElementById('activeCustomerTitle');
            if (!titleEl) return;
            const cleanMob = mob ? String(mob).split('_')[0].replace(/\D/g, '').slice(-10) : '';
            const phoneText = cleanMob ? `(+91 ${cleanMob})` : '';

            if (custName && custName !== 'வாடிக்கையாளர்') {
                titleEl.innerHTML = `<i class="fa-solid fa-user-check" style="color: #16a34a; flex-shrink: 0;"></i> <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">வாடிக்கையாளர்: <b>${custName}</b> ${phoneText}</span>`;
            } else if (cleanMob) {
                titleEl.innerHTML = `<i class="fa-solid fa-user-check" style="color: #16a34a; flex-shrink: 0;"></i> <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">வாடிக்கையாளர்: <b>+91 ${cleanMob}</b></span>`;
            } else {
                titleEl.innerHTML = `<i class="fa-solid fa-robot" style="flex-shrink: 0;"></i> <span>eSevaDraft ஏஐ உரையாடல் மையம்</span>`;
            }
        }
        window.renderActiveCustomerHeader = renderActiveCustomerHeader;

        function updateSidebar(data) {
            const isOp = localStorage.getItem('eseva_user_role') === 'operator';
            const activeCustMob = localStorage.getItem('eseva_active_customer_mobile') || '';
            const rawProfMob = String(data?.citizenProfile?.mobileNumber || data?.applicantData?.mobileNumber || '');
            const hasRealActiveMob = Boolean(activeCustMob && !/^walkin_/i.test(activeCustMob));
            const cleanProfMob = rawProfMob.replace(/\D/g, '').slice(-10);
            const hasRealProfileMob = Boolean(rawProfMob && !/^walkin_/i.test(rawProfMob) && /^[6-9]\d{9}$/.test(cleanProfMob));

            // CRITICAL: Keep right sidebar in Operator Ready view until an exact service + real phone number is chosen!
            if (isOp && !hasRealActiveMob && !hasRealProfileMob) {
                currentCitizenData = null;
                resetSidebarToOperatorView();
                return;
            }

            const a = data ? (data.citizenProfile || data.applicantData) : null;
            if (!a) {
                if (isOp && !hasRealActiveMob) resetSidebarToOperatorView();
                return;
            }

            const rawTargetMob = (hasRealActiveMob ? activeCustMob : '') || (!/^walkin_/i.test(String(a.mobileNumber || '')) ? a.mobileNumber : '') || localStorage.getItem('eseva_user_mobile') || (!/^walkin_/i.test(String(currentCitizenData?.mobileNumber || '')) ? currentCitizenData?.mobileNumber : '') || '';
            const targetMobile = rawTargetMob || 'active_session';
            const appNo = data.applicationNumber || (a && a.applicationNumber);
            const pdfUrl = data.applicationPdfUrl || (a && a.applicationPdfUrl);

            if (a) {
                if (data && 'subService' in data) a.subService = data.subService;
                if (data && 'subServiceData' in data) a.subServiceData = data.subServiceData;
                if (data && 'pluginId' in data) a.pluginId = data.pluginId;
                if (data && 'intakeState' in data) a.intakeState = data.intakeState;
                if (data?.step) a.step = data.step;
                if (data?.documents) a.documents = { ...(a.documents || {}), ...data.documents };
                window.lastSubService = (data && 'subService' in data) ? (data.subService || null) : (a.subService || null);
                window.lastSubServiceData = (data && 'subServiceData' in data) ? (data.subServiceData || null) : (a.subServiceData || null);
                currentCitizenData = a;
            }

            // Reveal customer profile and hide empty operator desk card
            const opCard = document.getElementById('sidebarOperatorDeskCard');
            const custBox = document.getElementById('sidebarCustomerDetailsBox');
            if (custBox) custBox.style.display = 'flex';
            if (opCard) opCard.style.display = 'none';
            const sidebarTitle = document.getElementById('sidebarTitleText');
            if (sidebarTitle) sidebarTitle.innerText = '📋 சரிபார்க்கப்பட்ட விவரங்கள்';

            // 1. Immediately render documents without bouncing counts (Server Cache First = ZERO FLICKER):
            // If we are at SERVICE_SELECTION (no service selected yet), hide documents box entirely!
            const curStateEarly = (data && (data.step || data.intakeState)) || (currentCitizenData && currentCitizenData.intakeState) || '';
            const isServiceSelectionOnlyEarly = (curStateEarly === 'SERVICE_SELECTION' || curStateEarly === 'RATION_CARD_SERVICES' || curStateEarly === 'REVENUE_DEPARTMENT_SERVICES' || (!curStateEarly && !window.pendingSelectedService));
            const docsBoxEarly = document.getElementById('sidebarDocumentsBox');
            const setDispIfChanged = (el, val) => { if (el && el.style.display !== val) el.style.display = val; };

            if (isServiceSelectionOnlyEarly) {
                setDispIfChanged(docsBoxEarly, 'none');
            } else {
                setDispIfChanged(docsBoxEarly, 'block');
                const activeDraftIdEarly = (localStorage.getItem('eseva_active_draft_id') || '').trim();
                const docCacheKey = activeDraftIdEarly || targetMobile;
                const activeSubNow = (a && a.subService) || window.lastSubService || '';
                const incomingDocKeysSig = data?.documents ? Object.entries(data.documents).filter(([, v]) => Boolean(v)).map(([k, v]) => `${k}:${v}`).sort().join('|') : '';
                if (incomingDocKeysSig && cachedDocKeysSigByMobile[docCacheKey] && incomingDocKeysSig !== cachedDocKeysSigByMobile[docCacheKey]) {
                    delete cachedServerDocsByMobile[docCacheKey];
                    delete cachedDocsFetchedAtByMobile[docCacheKey];
                }
                if (incomingDocKeysSig) cachedDocKeysSigByMobile[docCacheKey] = incomingDocKeysSig;
                if (Array.isArray(data?.documentsList)) {
                    cachedServerDocsByMobile[docCacheKey] = data.documentsList;
                    cachedDocsFetchedAtByMobile[docCacheKey] = Date.now();
                    cachedDocsSubByMobile[docCacheKey] = activeSubNow;
                }
                const cachedDocs = cachedServerDocsByMobile[docCacheKey];
                const cachedSub = cachedDocsSubByMobile[docCacheKey] || '';
                const fetchedAt = cachedDocsFetchedAtByMobile[docCacheKey] || 0;
                const cacheMatchesSub = Array.isArray(cachedDocs) && cachedSub === activeSubNow;
                const cacheIsFresh = cacheMatchesSub && cachedDocs.length > 0 && (Date.now() - fetchedAt < 30000);

                if (Array.isArray(data?.documentsList)) {
                    renderSidebarDocuments(data.documentsList);
                } else if (cacheMatchesSub && cachedDocs.length > 0) {
                    renderSidebarDocuments(cachedDocs);
                } else {
                    const instantDocs = extractDocumentsFromProfile(a, docCacheKey, appNo, pdfUrl);
                    renderSidebarDocuments(instantDocs);
                }

                // 2. Refresh from server when cache is missing, service switched, new docs arrived, or stale (> 30s)
                if (docCacheKey && !cacheIsFresh && !Array.isArray(data?.documentsList)) {
                    fetchSidebarDocuments(docCacheKey);
                }
            }

            const statusBox = document.getElementById('sidebarAppStatusBox');
            if (statusBox) {
                if (appNo) {
                    statusBox.style.display = 'block';
                    document.getElementById('sidebarAppRefNo').innerText = appNo;
                    const dl = document.getElementById('sidebarDlPdfBtn');
                    if (dl) {
                        dl.onclick = (e) => {
                            e.preventDefault();
                            downloadTnpdsPdfFromInput(appNo);
                        };
                        dl.style.display = 'flex';
                    }
                } else {
                    statusBox.style.display = 'none';
                }
            }

            if (a) {
                const subData = a.subServiceData || null;
                const isSubserviceAddMember = a.subService === 'ADD_MEMBER';
                const isSubserviceRemoveMember = a.subService === 'REMOVE_MEMBER';

                const hasRealHead = (a.fullNameEng || a.fullNameTam) && (a.fullNameTam !== 'வாடிக்கையாளர்' && a.fullNameEng !== 'வாடிக்கையாளர்');
                if (hasRealHead) {
                    const headDisplay = a.fullNameTam ? (a.fullNameEng ? `${a.fullNameTam} (${a.fullNameEng})` : a.fullNameTam) : a.fullNameEng;
                    setVal('infoHeadName', headDisplay);
                } else if (isSubserviceAddMember && subData) {
                    const memberName = subData.memberNameTam ? (subData.memberNameEng ? `${subData.memberNameTam} (${subData.memberNameEng})` : subData.memberNameTam) : (subData.memberName || '');
                    setVal('infoHeadName', memberName ? `${memberName} (சேர்க்கப்படும் உறுப்பினர்)` : (a.rationCardNo ? `அட்டை: ${a.rationCardNo}` : 'குடும்ப அட்டை சேவை'));
                } else if (isSubserviceRemoveMember && subData) {
                    const memberName = subData.memberNameTam ? (subData.memberNameEng ? `${subData.memberNameTam} (${subData.memberNameEng})` : subData.memberNameTam) : (subData.memberName || '');
                    setVal('infoHeadName', memberName ? `${memberName} (நீக்கப்படும் உறுப்பினர்)` : (a.rationCardNo ? `அட்டை: ${a.rationCardNo}` : 'குடும்ப உறுப்பினர் நீக்கம்'));
                } else {
                    setVal('infoHeadName', '');
                }
                
                // Dynamically sync active customer title & localStorage ONLY from the live session profile (NEVER stale localStorage fallback!)
                if (activeCustMob && !/^walkin_/i.test(activeCustMob)) {
                    const resolvedName = resolveCustomerDisplayName(a, '');
                    if (resolvedName && resolvedName !== 'வாடிக்கையாளர்') {
                        localStorage.setItem('eseva_active_customer_name', resolvedName);
                        renderActiveCustomerHeader(resolvedName, activeCustMob);
                    } else {
                        localStorage.removeItem('eseva_active_customer_name');
                        renderActiveCustomerHeader('', activeCustMob);
                    }
                }

                // Ensure clear buttons in header and sidebar are visible
                const clearHeader = document.getElementById('btnClearScreenHeader') || document.getElementById('btnDeleteDraftHeader');
                if (clearHeader) clearHeader.style.display = 'inline-flex';
                const clearSidebar = document.getElementById('btnClearScreenSidebar') || document.getElementById('btnDeleteDraftSidebar');
                if (clearSidebar) clearSidebar.style.display = 'inline-flex';
                const headFather = a.fatherNameTam ? (a.fatherNameEng ? `${a.fatherNameTam} (${a.fatherNameEng})` : a.fatherNameTam) : (a.fatherNameEng || '');
                setVal('infoHeadFather', headFather);
                setVal('infoHeadDob', a.headDob);
                setVal('infoHeadGender', a.headGenderTam || a.headGender);
                setVal('infoHeadAadhaar', a.headAadhaar ? a.headAadhaar.replace(/(\d{4})/g, '$1 ').trim() : '');
                const cleanHeadMob = (a.mobileNumber && !/^walkin_/i.test(String(a.mobileNumber))) ? a.mobileNumber : ((activeCustMob && !/^walkin_/i.test(String(activeCustMob))) ? activeCustMob : '');
                setVal('infoHeadMobile', cleanHeadMob ? `+91 ${cleanHeadMob}` : '');
                const addrParts = [a.doorNo, a.streetTam || a.streetEng, a.areaTam || a.areaEng].filter(Boolean);
                const addr = addrParts.join(', ');
                setVal('infoAddress', addr);
                setVal('infoPin', a.pincode);
                const regionStr = [a.district, a.taluk, a.village].filter(Boolean).join(' / ');
                setVal('infoAreaRegion', regionStr);
                setVal('infoResidenceProof', a.residenceProof ? (a.residenceProof.typeTam || a.residenceProof.type) : '');
                setVal('infoCardType', a.cardTypeTam || (a.cardType ? 'அரிசி அட்டை' : 'அரிசி அட்டை (பச்சை)'));

                // Authoritative Per-Service Cartridge Sidebar Resolution (Zero cross-service ladders)
                const curState = (data && (data.step || data.intakeState)) || (currentCitizenData && currentCitizenData.intakeState) || '';
                const svcHint = window.pendingSelectedService || a.serviceName || data?.serviceName || '';
                const isServiceSelectionOnly = (curState === 'SERVICE_SELECTION' || curState === 'RATION_CARD_SERVICES' || curState === 'REVENUE_DEPARTMENT_SERVICES' || (!curState && !window.pendingSelectedService));
                const viewerPlugin = (!isServiceSelectionOnly && window.ESEVA_PLUGINS && typeof window.ESEVA_PLUGINS.resolveServicePlugin === 'function')
                    ? window.ESEVA_PLUGINS.resolveServicePlugin({ ...a, intakeState: curState || a.intakeState }, { overrideHint: svcHint })
                    : null;
                const vpId = viewerPlugin?.id || '';
                const uiCart = viewerPlugin?.uiCartridge || null;
                const sbCfg = uiCart?.sidebar || {};

                const isAddMemberService = !isServiceSelectionOnly && vpId === 'TNPDS_ADD_MEMBER';
                const isNewRationCardService = !isServiceSelectionOnly && (vpId === 'TNPDS_NEW_CARD' || (!viewerPlugin && (
                    curState.includes('MEMBER') || curState.includes('HEAD_') || curState.includes('RESIDENCE_PROOF') || curState.includes('GAS_') || curState.includes('CARD_TYPE') || curState === 'READY_TO_APPLY' || curState === 'MOBILE_NUMBER' || curState === 'ADDRESS_CHOICE'
                )));

                // 1. Sidebar Head Title & Box Visibility (Zero-Flicker: skip unchanged DOM writes!)
                const headBoxEl = document.getElementById('sidebarHeadBox');
                setDispIfChanged(headBoxEl, (isAddMemberService && !hasRealHead) ? 'none' : 'block');
                const headTitleEl = document.getElementById('sidebarHeadTitle');
                const nextHeadTitle = sbCfg.headTitle || (isNewRationCardService ? '👤 1. குடும்பத் தலைவர்' : '👤 வாடிக்கையாளர் விவரங்கள்');
                if (headTitleEl && headTitleEl.innerHTML !== nextHeadTitle) {
                    headTitleEl.innerHTML = nextHeadTitle;
                }

                // 2. Show & populate active Cartridge Box FIRST, then hide only other boxes (ZERO hide->show flicker!)
                const allSidebarBoxIds = [
                    'sidebarIncomeBox', 'sidebarResidenceBox', 'sidebarCommunityBox',
                    'sidebarFirstGraduateBox', 'sidebarObcBox', 'sidebarWidowBox',
                    'sidebarAddMemberBox', 'sidebarChangeAddressBox', 'sidebarUpdateMobileBox',
                    'sidebarRemoveMemberBox', 'sidebarDynamicServiceBox'
                ];
                let activeBoxIdToShow = null;
                if (!isServiceSelectionOnly && typeof uiCart?.renderDynamicSidebar === 'function') {
                    const dynBoxEl = document.getElementById('sidebarDynamicServiceBox');
                    if (dynBoxEl && uiCart.renderDynamicSidebar(dynBoxEl, a, subData, { setVal, activeCustMob }) !== false) {
                        activeBoxIdToShow = 'sidebarDynamicServiceBox';
                        setDispIfChanged(dynBoxEl, 'block');
                    }
                } else if (!isServiceSelectionOnly && sbCfg.boxId) {
                    const activeBoxEl = document.getElementById(sbCfg.boxId);
                    if (activeBoxEl) {
                        let populated = true;
                        if (typeof uiCart.populateSidebar === 'function') {
                            populated = uiCart.populateSidebar(a, subData, { setVal, activeCustMob }) !== false;
                        }
                        if (populated) {
                            activeBoxIdToShow = sbCfg.boxId;
                            setDispIfChanged(activeBoxEl, 'block');
                        }
                    }
                }
                for (const boxId of allSidebarBoxIds) {
                    if (boxId === activeBoxIdToShow) continue;
                    setDispIfChanged(document.getElementById(boxId), 'none');
                }

                // 3.5 Address Box (2-Lane Rule: hide old Master Address on ALL 5 TNPDS card modification services!)
                const isTnpdsModService = [
                    'TNPDS_ADD_MEMBER',
                    'TNPDS_REMOVE_MEMBER',
                    'TNPDS_CHANGE_ADDRESS',
                    'TNPDS_UPDATE_MOBILE',
                    'TNPDS_CHANGE_HEAD'
                ].includes(vpId);
                setDispIfChanged(document.getElementById('sidebarAddressBox'), (isServiceSelectionOnly || isTnpdsModService) ? 'none' : 'block');

                // 3.6 Documents Box (Shown only when a specific service is chosen, NEVER during service selection!)
                setDispIfChanged(document.getElementById('sidebarDocumentsBox'), isServiceSelectionOnly ? 'none' : 'block');

                // 4. Gas Connection Box (Shown strictly ONLY for New Ration Card!)
                const gasBox = document.getElementById('gasSidebarBox');
                const nextGasDisp = isNewRationCardService ? 'block' : 'none';
                if (gasBox && gasBox.style.display !== nextGasDisp) {
                    gasBox.style.display = isNewRationCardService ? 'block' : 'none';
                }

                // 5. Residence Proof and Card Type Rows (Shown strictly ONLY for New Ration Card!)
                setDispIfChanged(document.getElementById('rowResidenceProof'), isNewRationCardService ? 'flex' : 'none');
                setDispIfChanged(document.getElementById('rowCardType'), isNewRationCardService ? 'flex' : 'none');

                // 6. Service Selection Prompt Box
                setDispIfChanged(document.getElementById('sidebarServiceSelectionPromptBox'), isServiceSelectionOnly ? 'block' : 'none');

                if (a.gasDetails && isNewRationCardService) {
                    if (a.gasDetails.hasGas === false) {
                        setVal('infoGasCompany', '❌ எரிவாயு இணைப்பு இல்லை');
                        setVal('infoGasNo', 'இல்லை (None)');
                        setVal('infoGasAgency', 'இல்லை (None)');
                        setVal('infoGasCyl', '0 சிலிண்டர்');
                    } else if (a.gasDetails.hasGas === true || a.gasDetails.consumerNumber || a.gasDetails.oilCompany) {
                        setVal('infoGasCompany', a.gasDetails.oilCompanyDisplay || a.gasDetails.oilCompany || 'Indane Gas (IOCL)');
                        setVal('infoGasNo', a.gasDetails.consumerNumber || '—');
                        setVal('infoGasAgency', a.gasDetails.agencyName || '—');
                        setVal('infoGasCyl', a.gasDetails.cylinders ? `${a.gasDetails.cylinders} சிலிண்டர்` : '1 சிலிண்டர்');
                    } else {
                        setVal('infoGasCompany', '');
                        setVal('infoGasNo', '');
                        setVal('infoGasAgency', '');
                        setVal('infoGasCyl', '');
                    }
                } else {
                    setVal('infoGasCompany', '');
                    setVal('infoGasNo', '');
                    setVal('infoGasAgency', '');
                    setVal('infoGasCyl', '');
                }

                // Dynamic Family Members Rendering
                // In ADD_MEMBER subservice, #sidebarAddMemberBox already renders the single new member card;
                // rendering #membersSidebarContainer too caused 3 duplicate member cards for 1 upload!
                const membersContainer = document.getElementById('membersSidebarContainer');
                if (membersContainer) {
                    if (!isNewRationCardService || isAddMemberService) {
                        membersContainer.innerHTML = '';
                        membersContainer.style.display = 'none';
                    } else {
                        membersContainer.style.display = 'block';
                        const additionalMembers = (a.members && a.members.length > 1) ? a.members.slice(1) : [];
                        const allAdditionalMembers = [...additionalMembers];
                        if (a.tempMember && (a.tempMember.nameTam || a.tempMember.nameEng || a.tempMember.aadhaarNumber || a.tempMember.docPath)) {
                            const alreadyInList = allAdditionalMembers.some(m => 
                                (m.aadhaarNumber && a.tempMember.aadhaarNumber && m.aadhaarNumber.replace(/\s+/g,'') === a.tempMember.aadhaarNumber.replace(/\s+/g,'')) ||
                                (m.nameTam && a.tempMember.nameTam && m.nameTam === a.tempMember.nameTam)
                            );
                            if (!alreadyInList) {
                                allAdditionalMembers.push({
                                    ...a.tempMember,
                                    isInProgress: true
                                });
                            }
                        }
                        const membersSnapshot = JSON.stringify({ isSubserviceAddMember, subData, allAdditionalMembers });
                        if (membersSnapshot !== lastRenderedMembersJson || membersContainer.children.length === 0) {
                            lastRenderedMembersJson = membersSnapshot;
                            membersContainer.innerHTML = '';

                        // 1. If in Subservice Add Member workflow, render the member being added prominently
                        if (isSubserviceAddMember && subData && subData.memberName) {
                            const sName = subData.memberNameTam ? (subData.memberNameEng ? `${subData.memberNameTam} (${subData.memberNameEng})` : subData.memberNameTam) : (subData.memberName || 'புதிய உறுப்பினர்');
                            const sRel = subData.relationshipTam || subData.relationship || (subData.isChild ? 'மகன்' : 'உறுப்பினர்');
                            const sDob = subData.dob || '—';
                            const sGender = subData.genderTam || subData.gender || '—';
                            const sAadh = subData.aadhaarNo ? subData.aadhaarNo.replace(/(\d{4})/g, '$1 ').trim() : '—';
                            const sDocLabel = subData.isChild ? 'பிறப்புச் சான்றிதழ் (Birth Certificate)' : 'ஆதார் அட்டை (Aadhaar Card)';

                            const sMob = (a.mobileNumber || activeCustMob) ? `+91 ${a.mobileNumber || activeCustMob}` : '—';
                            const sBox = document.createElement('div');
                            sBox.className = 'card-box';
                            sBox.style.borderLeft = '4px solid #16a34a';
                            sBox.style.background = '#f0fdf4';
                            sBox.style.marginBottom = '10px';
                            sBox.innerHTML = `
                                <h4 style="color: #166534; margin-bottom: 6px;"><i class="fa-solid fa-user-plus"></i> சேர்க்கப்படும் புதிய உறுப்பினர் (${sRel})</h4>
                                <div class="card-row">பெயர்: <strong class="badge-green">${sName}</strong></div>
                                <div class="card-row">உறவுமுறை: <strong class="badge-green">${sRel}</strong></div>
                                <div class="card-row">பிறந்த தேதி & பாலினம்: <strong class="badge-green">${sDob} | ${sGender}</strong></div>
                                <div class="card-row">ஆதார் எண்: <strong class="badge-green">${sAadh}</strong></div>
                                <div class="card-row">கைபேசி எண்: <strong class="badge-green">${sMob}</strong></div>
                                <div class="card-row">இணைக்கப்பட்ட ஆவணம்: <strong class="badge-green">${sDocLabel} ✅</strong></div>
                            `;
                            membersContainer.appendChild(sBox);
                        }

                        // 2. Normal intake additional members starting from index 1
                        allAdditionalMembers.forEach((m, idx) => {
                            const mBox = document.createElement('div');
                            mBox.className = 'card-box';
                            mBox.style.borderLeft = m.isInProgress ? '4px solid #eab308' : '4px solid var(--accent)';
                            mBox.innerHTML = `
                                <h4>👥 ${idx + 2}. குடும்ப உறுப்பினர் (${m.relationshipTam || m.relationship || 'உறுப்பினர்'})${m.isInProgress ? ' <span style="font-size: 10px; background: #fef08a; color: #854d0e; padding: 2px 6px; border-radius: 4px; font-weight: 700;">நேரலை சரிபார்ப்பு</span>' : ''}</h4>
                                <div class="card-row">பெயர்: <strong class="badge-green">${m.nameTam ? `${m.nameTam} (${m.nameEng})` : (m.nameEng || '—')}</strong></div>
                                <div class="card-row">உறவுமுறை: <strong class="badge-green">${m.relationshipTam || m.relationship || (m.isInProgress ? 'தேர்வு செய்யப்படுகிறது...' : '—')}</strong></div>
                                <div class="card-row">பிறந்த தேதி: <strong class="badge-green">${m.dob || '—'} | ${m.genderTam || m.gender || '—'}</strong></div>
                                <div class="card-row">ஆதார் எண்: <strong class="badge-green">${(m.aadhaarNumber || '').replace(/(\d{4})/g, '$1 ').trim()}</strong></div>
                                <div class="card-row">ஆதார் ஆவணம்: <strong class="${m.docPath ? 'badge-green' : 'badge-empty'}">${m.docPath ? 'இணைக்கப்பட்டது ✅' : 'தேவை ⚠️'}</strong></div>
                            `;
                            membersContainer.appendChild(mBox);
                        });
                    }
                }
            }
            } else {
                ['infoHeadName', 'infoHeadFather', 'infoHeadDob', 'infoHeadGender', 'infoHeadAadhaar', 'infoHeadMobile', 'infoAddress', 'infoPin', 'infoResidenceProof', 'infoCardType', 'infoGasCompany', 'infoGasNo', 'infoGasAgency', 'infoGasCyl'].forEach(id => setVal(id, ''));
                const membersContainer = document.getElementById('membersSidebarContainer');
                if (membersContainer) membersContainer.innerHTML = '';
            }

            if (!isOp) {
                updateCitizenServicesDraftCard();
                if (typeof currentCitizenSubTab !== 'undefined' && currentCitizenSubTab === 'docs') {
                    renderCitizenDocsView();
                }
            }
        }


        async function fetchDocuments() {
            try {
                const res = await fetch('/api/documents');
                const data = await res.json();
                const grid = document.getElementById('lockerGrid');
                grid.innerHTML = '';

                if (data.documents && data.documents.length > 0) {
                    data.documents.forEach(doc => {
                        const card = document.createElement('div');
                        card.className = 'doc-item-card';
                        card.innerHTML = `
                            <div class="doc-icon-title">
                                <div class="doc-icon"><i class="fa-solid ${doc.type.includes('pdf') ? 'fa-file-pdf' : 'fa-image'}"></i></div>
                                <div>
                                    <strong style="font-size: 13px; color: var(--text-main); display: block;">${doc.title}</strong>
                                    <span style="font-size: 10.5px; color: var(--text-muted);">${doc.filename}</span>
                                </div>
                            </div>
                            <a href="/api/documents/download/${doc.filename}" class="btn-download-doc" download>
                                <i class="fa-solid fa-download"></i> பதிவிறக்கு (Download)
                            </a>
                        `;
                        grid.appendChild(card);
                    });
                } else {
                    grid.innerHTML = '<p style="color: var(--text-muted); font-size: 12px;">ஆவணங்கள் எதுவும் இன்னும் சேமிக்கப்படவில்லை.</p>';
                }
            } catch (e) {
                console.error('Fetch docs failed:', e);
            }
        }

        async function fetchAdminStats() {
            try {
                const res = await fetch('/api/admin/stats');
                const data = await res.json();
                if (data.stats) {
                    document.getElementById('adminTotalUsers').innerText = data.stats.totalCitizens || 0;
                    document.getElementById('adminTotalApps').innerText = data.stats.totalApplicationsSubmitted || 0;
                    document.getElementById('adminRevenue').innerText = `₹${data.stats.todayRevenue || 0}`;
                    document.getElementById('adminHealth').innerText = `🟢 ${data.stats.systemHealth}`;
                    if (document.getElementById('adminUptime')) {
                        const upSecs = data.stats.uptime || 0;
                        const m = Math.floor(upSecs / 60);
                        const s = upSecs % 60;
                        document.getElementById('adminUptime').innerText = `${m}m ${s}s`;
                    }
                    if (document.getElementById('adminActiveSessions')) {
                        document.getElementById('adminActiveSessions').innerText = data.stats.activeSessions || 1;
                    }
                    const tableContainer = document.getElementById('adminSessionTable');
                    if (tableContainer && data.stats.sessionDetails) {
                        if (data.stats.sessionDetails.length === 0) {
                            tableContainer.innerHTML = '<p style="color: var(--text-muted);">செயலில் உள்ள அமர்வுகள் இல்லை.</p>';
                        } else {
                            let rows = data.stats.sessionDetails.map(s => `
                                <tr style="border-bottom: 1px solid #f1f5f9;">
                                    <td style="padding: 6px 8px; font-weight: 700;">+91 ${s.mobile}</td>
                                    <td style="padding: 6px 8px;">${s.name}</td>
                                    <td style="padding: 6px 8px;"><span class="badge-green">${s.state}</span></td>
                                    <td style="padding: 6px 8px;">${s.members} நபர்</td>
                                    <td style="padding: 6px 8px;">${s.appNo ? `<b style="color: var(--success);">${s.appNo}</b>` : '—'}</td>
                                </tr>
                            `).join('');
                            tableContainer.innerHTML = `
                                <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">
                                    <thead style="background: #f8fafc; font-weight: 700; color: #475569;">
                                        <tr>
                                            <th style="padding: 6px 8px; text-align: left;">மொபைல்</th>
                                            <th style="padding: 6px 8px; text-align: left;">பெயர்</th>
                                            <th style="padding: 6px 8px; text-align: left;">நிலை</th>
                                            <th style="padding: 6px 8px; text-align: left;">உறுப்பினர்கள்</th>
                                            <th style="padding: 6px 8px; text-align: left;">விண்ணப்ப எண்</th>
                                        </tr>
                                    </thead>
                                    <tbody>${rows}</tbody>
                                </table>
                            `;
                        }
                    }
                }
                if (typeof refreshFlightRecorderLogs === 'function') {
                    refreshFlightRecorderLogs();
                }
            } catch (e) {
                console.error('Fetch admin stats failed:', e);
            }
        }

        // ==========================================
        // HITL VALIDATION STATION JAVASCRIPT HANDLERS
        // ==========================================
        let hitlZoomLevel = 1.0;
        let isHitlModalOpen = false;

        function zoomHitlImg(factor) {
            hitlZoomLevel = Math.max(0.5, Math.min(3.0, hitlZoomLevel * factor));
            const img = document.getElementById('hitlSnapshotImg');
            if (img) img.style.transform = `scale(${hitlZoomLevel})`;
        }

        function resetHitlImgZoom() {
            hitlZoomLevel = 1.0;
            const img = document.getElementById('hitlSnapshotImg');
            if (img) img.style.transform = 'scale(1.0)';
        }

        function openHitlApprovalModal(approvalData) {
            approvalData = approvalData || {};
            if (isDevMockModeActive()) {
                isHitlModalOpen = false;
                const modal = document.getElementById('hitlApprovalModal');
                if (modal) modal.style.display = 'none';
                return;
            }
            isHitlModalOpen = true;
            const modal = document.getElementById('hitlApprovalModal');
            if (!modal) return;
            modal.style.display = 'flex';

            const img = document.getElementById('hitlSnapshotImg');
            if (img) {
                img.src = approvalData.approvalSnapshotUrl || `/previews/latest_full.png?t=${Date.now()}`;
                img.style.display = 'block';
            }

            const badgeText = document.getElementById('hitlAuditBadgeText');
            const badge = document.getElementById('hitlAuditBadge');
            const summaryText = document.getElementById('hitlAuditSummaryText');
            const auditCard = document.getElementById('hitlAuditCard');

            if (approvalData.auditResult) {
                const ar = approvalData.auditResult;
                if (ar.allValid) {
                    if (badgeText) badgeText.innerText = 'Gemini Vision AI: 0 பிழைகள் (All Clear)';
                    if (badge) {
                        badge.style.background = 'rgba(16, 185, 129, 0.25)';
                        badge.style.color = '#6ee7b7';
                        badge.style.borderColor = '#10b981';
                    }
                    if (auditCard) {
                        auditCard.style.background = '#f0fdf4';
                        auditCard.style.borderColor = '#86efac';
                    }
                    if (summaryText) {
                        summaryText.innerText = ar.summaryTamil || 'அரசு படிவத்தில் அனைத்து கட்டாயப் புலங்களும் விதிகளுக்கு ஏற்ப சரியாக நிரப்பப்பட்டுள்ளன. சிகப்பு எச்சரிக்கை பிழைகள் எதுவும் கண்டறியப்படவில்லை.';
                        summaryText.style.color = '#15803d';
                    }
                } else {
                    const errCount = (ar.redErrorsFound?.length || 0) + (ar.missingFields?.length || 0) || 1;
                    if (badgeText) badgeText.innerText = `Gemini Vision AI: ⚠️ ${errCount} பிழைகள் கண்டறியப்பட்டன`;
                    if (badge) {
                        badge.style.background = 'rgba(239, 68, 68, 0.25)';
                        badge.style.color = '#fca5a5';
                        badge.style.borderColor = '#ef4444';
                    }
                    if (auditCard) {
                        auditCard.style.background = '#fef2f2';
                        auditCard.style.borderColor = '#fca5a5';
                    }
                    if (summaryText) {
                        summaryText.innerText = ar.summaryTamil || 'அரசு இணையதளத்தில் சில புலங்களில் எச்சரிக்கை பிழை உள்ளது. தயவுசெய்து சரிபார்த்து திருத்தவும்.';
                        summaryText.style.color = '#b91c1c';
                    }
                }
            }

            const data = currentCitizenData || {};
            const dNo = document.getElementById('hitlDoorNo');
            const st = document.getElementById('hitlStreet');
            const tlk = document.getElementById('hitlTaluk');
            const vil = document.getElementById('hitlVillage');
            if (dNo) dNo.value = data.doorNo || '';
            if (st) st.value = data.streetTam || data.streetEng || '';
            if (tlk) tlk.value = data.taluk || '';
            if (vil) vil.value = data.village || '';
            resetHitlImgZoom();
        }


        function closeHitlApprovalModal() {
            isHitlModalOpen = false;
            const modal = document.getElementById('hitlApprovalModal');
            if (modal) modal.style.display = 'none';
        }

        async function approveAndSubmitApplication() {
            closeHitlApprovalModal();
            const btn = document.getElementById('btnHitlApproveSubmit');
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> அரசு போர்ட்டலில் பதிவு எண் பெறப்படுகிறது... காத்திருக்கவும்';
            }
            await approveFinalPortalSubmit();
        }

        async function confirmFinalSubmit() {
            const btn = document.getElementById('btnChatFinalConfirmSubmit');
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> அரசு போர்ட்டலில் பதிவு எண் பெறப்படுகிறது...';
            }
            await approveFinalPortalSubmit();
        }

        function openImageZoomModal(imgUrl) {
            const modal = document.getElementById('imageZoomModal');
            const img = document.getElementById('imageZoomModalImg');
            if (img && imgUrl) {
                img.src = imgUrl;
                img.style.display = 'block';
            }
            if (modal) modal.style.display = 'flex';
        }

        function closeImageZoomModal() {
            const modal = document.getElementById('imageZoomModal');
            if (modal) modal.style.display = 'none';
        }

        function openDesktopDownloadModal() {
            const modal = document.getElementById('desktopDownloadModal');
            if (modal) modal.style.display = 'flex';
        }

        function closeDesktopDownloadModal() {
            const modal = document.getElementById('desktopDownloadModal');
            if (modal) modal.style.display = 'none';
        }

        async function updatePortalFieldLive() {
            const btn = document.getElementById('btnHitlUpdate');
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> அரசு தளத்தில் புதுப்பிக்கப்படுகிறது...';
            }

            const payload = {
                doorNo: document.getElementById('hitlDoorNo').value.trim(),
                street: document.getElementById('hitlStreet').value.trim(),
                taluk: document.getElementById('hitlTaluk').value.trim(),
                village: document.getElementById('hitlVillage').value.trim(),
                mobileNumber: localStorage.getItem('eseva_active_customer_mobile') || ''
            };

            try {
                const res = await fetch('/api/automation/update-portal-field', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-operator-uid': localStorage.getItem('eseva_operator_uid') || '' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (data.success) {
                    const img = document.getElementById('hitlSnapshotImg');
                    if (img && data.fullSnapshotUrl) {
                        img.src = data.fullSnapshotUrl;
                    }
                    if (data.auditResult) {
                        document.getElementById('hitlAuditSummaryText').innerText = data.auditResult.summaryTamil || 'அரசு தளத்தில் புலம் வெற்றிகரமாகப் புதுப்பிக்கப்பட்டது!';
                    }
                    alert('✅ அரசு இணையதளத்தில் புலம் புதுப்பிக்கப்பட்டுவிட்டது! புதிய ஸ்கிரீன்ஷாட்டைச் சரிபார்க்கவும்.');
                } else {
                    alert('பிழை: ' + (data.message || 'புதுப்பிக்க முடியவில்லை.'));
                }
            } catch (e) {
                alert('பிழை: ' + e.message);
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fa-solid fa-rotate"></i> மாற்றங்களை அரசு தளத்தில் புதுப்பி (Update on Govt Portal)';
                }
            }
        }

        async function submitOperatorFeedback() {
            const note = document.getElementById('hitlFeedbackNote').value.trim();
            if (!note) {
                alert('உங்கள் ஃபீட்பேக் அல்லது புகாரை டைப் செய்யவும்.');
                return;
            }
            const btn = document.getElementById('btnHitlFeedback');
            const status = document.getElementById('hitlFeedbackStatus');
            if (btn) btn.disabled = true;

            try {
                const res = await fetch('/api/automation/log-feedback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-operator-uid': localStorage.getItem('eseva_operator_uid') || '' },
                    body: JSON.stringify({
                        note,
                        issueType: 'OPERATOR_REVIEW_NOTE',
                        mobileNumber: localStorage.getItem('eseva_active_customer_mobile') || '',
                        screenshotUrl: '/previews/latest_full.png'
                    })
                });
                const data = await res.json();
                if (data.success) {
                    document.getElementById('hitlFeedbackNote').value = '';
                    if (status) {
                        status.innerText = '✅ Firebase-ல் பதிவானது!';
                        setTimeout(() => { status.innerText = ''; }, 3000);
                    }
                }
            } catch (e) {
                alert('ஃபீட்பேக் அனுப்புவதில் பிழை: ' + e.message);
            } finally {
                if (btn) btn.disabled = false;
            }
        }
