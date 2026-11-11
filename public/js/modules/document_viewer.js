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

            const rawList = Array.isArray(documents) ? [...documents] : [];
            let filteredDocs = [];

            if (isAddMem) {
                // ADD_MEMBER: Government portal requires strictly ONLY Member Aadhaar or Birth Certificate, Surrender Proof, and Smart Card.
                // NEVER Applicant Passport Photo or Gas Consumer Book!
                const subData = currentCitizenData?.subServiceData || window.lastSubServiceData;
                const memberName = subData?.memberNameTam || subData?.memberName || currentCitizenData?.fullNameTam || '';
                const memberLabel = memberName ? ` (${memberName})` : '';

                // Look for memberAadhaar or birthCertificate
                const memDoc = rawList.find(d => d.type === 'memberAadhaar' || (d.type && d.type.startsWith('memberAadhaar')) || d.type === 'birthCertificate');
                if (memDoc) {
                    filteredDocs.push(memDoc);
                } else {
                    // If no explicit memberAadhaar in list, check if headAadhaar was passed/uploaded for this session
                    const headAadhaarDoc = rawList.find(d => d.type === 'headAadhaar');
                    if (headAadhaarDoc) {
                        filteredDocs.push({
                            ...headAadhaarDoc,
                            type: 'memberAadhaar',
                            title: `உறுப்பினர் ஆதார் அட்டை${memberLabel}`,
                            titleEng: `Member Aadhaar Card${memberLabel}`,
                            downloadUrl: headAadhaarDoc.downloadUrl.replace('/doc/headAadhaar', '/doc/memberAadhaar'),
                            previewUrl: headAadhaarDoc.previewUrl ? headAadhaarDoc.previewUrl.replace('/doc/headAadhaar', '/doc/memberAadhaar') : undefined
                        });
                    }
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
                // CHANGE_ADDRESS: Only new address proof, residence proof, or gas book (as address proof), and smart card
                const addrDoc = rawList.find(d => d.type === 'newAddressProof' || d.type === 'residenceProof' || d.type === 'gasBook');
                if (addrDoc) filteredDocs.push(addrDoc);
                const smartCardDoc = rawList.find(d => d.type === 'smartCard');
                if (smartCardDoc) filteredDocs.push(smartCardDoc);

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

            const signature = `${curSub}::` + filteredDocs.map(d => `${d.type || ''}|${d.title || ''}|${d.downloadUrl || ''}`).join(';;');
            if (signature === lastRenderedDocsSignature && docsList.children.length > 0) {
                return; // ZERO FLICKER: Prevents unnecessary DOM thrashing & scroll jumps!
            }
            lastRenderedDocsSignature = signature;

            if (filteredDocs.length === 0) {
                docsList.innerHTML = '<div style="font-size: 11px; color: #94a3b8; padding: 4px 0;">பதிவேற்றப்பட்ட ஆவணங்கள் எதுவும் இல்லை.</div>';
                if (docsCount) docsCount.innerText = '0';
                return;
            }

            if (docsCount) docsCount.innerText = filteredDocs.length;
            docsList.innerHTML = filteredDocs.map(doc => {
                const iconClass = (doc.icon && doc.icon.startsWith('fa-')) ? doc.icon : 'fa-file-lines';
                return `
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; gap: 8px; margin-bottom: 4px; transition: background 0.15s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='#f8fafc'">
                        <div style="display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1;">
                            <div style="width: 28px; height: 28px; border-radius: 6px; background: #eff6ff; color: #0284c7; display: flex; align-items: center; justify-content: center; font-size: 13px; flex-shrink: 0;">
                                <i class="fa-solid ${iconClass}"></i>
                            </div>
                            <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0;">
                                <div style="font-weight: 700; font-size: 11.5px; color: #0f172a; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${doc.title}">${doc.title}</div>
                                <div style="font-size: 10px; color: #64748b; margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${doc.titleEng || doc.type}</div>
                            </div>
                        </div>
                        <a href="${doc.downloadUrl}" download onclick="event.preventDefault(); window.downloadDocumentFile('${doc.downloadUrl}', '${(doc.titleEng || doc.title || doc.type || 'document').replace(/[/\\\\?%*:|\"<>]/g, '_')}.pdf');" title="${doc.title} பதிவிறக்கு (Download)" style="height: 32px; width: 32px; border-radius: 8px; background: #ecfdf5; border: 1.5px solid #a7f3d0; color: #059669; display: flex; align-items: center; justify-content: center; text-decoration: none; font-size: 13px; flex-shrink: 0; box-shadow: 0 1px 2px rgba(16,185,129,0.15); transition: all 0.15s;" onmouseover="this.style.background='#d1fae5'; this.style.transform='scale(1.05)';" onmouseout="this.style.background='#ecfdf5'; this.style.transform='none';">
                            <i class="fa-solid fa-download"></i>
                        </a>
                    </div>
                `;
            }).join('');
        }

        let cachedServerDocsByMobile = {};

        function downloadDocumentFile(url, filename) {
            if (typeof window.triggerDownloadUrl === 'function') {
                return window.triggerDownloadUrl(url, filename);
            }
            const a = document.createElement('a');
            a.href = url;
            a.download = filename || 'document.pdf';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => a.remove(), 500);
        }
        window.downloadDocumentFile = downloadDocumentFile;

        function resetSidebarDocsCache() {
            cachedServerDocsByMobile = {};
            lastRenderedDocsSignature = '';
        }
        window.resetSidebarDocsCache = resetSidebarDocsCache;

        function clearCustomerDocCache(mobile) {
            if (!mobile) return;
            const raw = String(mobile).trim();
            const clean = raw.replace(/\D/g, '').slice(-10);
            if (raw) delete cachedServerDocsByMobile[raw];
            if (clean) delete cachedServerDocsByMobile[clean];
            lastRenderedDocsSignature = '';
        }
        window.clearCustomerDocCache = clearCustomerDocCache;

        async function fetchSidebarDocuments(mobile) {
            const cleanMob = mobile || (currentCitizenData && currentCitizenData.mobileNumber) || 'active_session';
            const curSub = currentCitizenData?.subService || window.lastSubService || '';
            const subQuery = curSub ? `?subService=${encodeURIComponent(curSub)}` : '';
            try {
                const res = await fetch(`/api/drafts/${encodeURIComponent(cleanMob)}/documents-list${subQuery}`);
                const data = await res.json();
                if (data && data.success && Array.isArray(data.documents) && data.documents.length > 0) {
                    cachedServerDocsByMobile[cleanMob] = data.documents;
                    renderSidebarDocuments(data.documents);
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
                cachedServerDocsByMobile[cleanMob] = [];
                renderSidebarDocuments([]);
            }
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
            const cleanMob = mob ? String(mob).replace(/\D/g, '').slice(-10) : '';
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
            const activeCustMob = localStorage.getItem('eseva_active_customer_mobile');

            // CRITICAL: If operator is logged in and has NO customer selected, keep sidebar blank!
            if (isOp && !activeCustMob && !data?.citizenProfile && !currentCitizenData) {
                resetSidebarToOperatorView();
                return;
            }

            const a = data ? (data.citizenProfile || data.applicantData) : null;
            if (!a) {
                if (isOp && !activeCustMob) resetSidebarToOperatorView();
                return;
            }

            const targetMobile = activeCustMob || (a && a.mobileNumber) || localStorage.getItem('eseva_user_mobile') || (currentCitizenData && currentCitizenData.mobileNumber) || 'active_session';
            const appNo = data.applicationNumber || (a && a.applicationNumber);
            const pdfUrl = data.applicationPdfUrl || (a && a.applicationPdfUrl);

            // Reveal customer profile and hide empty operator desk card
            const opCard = document.getElementById('sidebarOperatorDeskCard');
            const custBox = document.getElementById('sidebarCustomerDetailsBox');
            if (custBox) custBox.style.display = 'flex';
            if (opCard) opCard.style.display = 'none';
            const sidebarTitle = document.getElementById('sidebarTitleText');
            if (sidebarTitle) sidebarTitle.innerText = '📋 சரிபார்க்கப்பட்ட விவரங்கள்';

            // 1. Immediately render documents without bouncing counts:
            // If we are at SERVICE_SELECTION (no service selected yet), hide documents box entirely!
            const curStateEarly = (data && (data.step || data.intakeState)) || (currentCitizenData && currentCitizenData.intakeState) || '';
            const isServiceSelectionOnlyEarly = (curStateEarly === 'SERVICE_SELECTION' || curStateEarly === 'RATION_CARD_SERVICES' || (!curStateEarly && !window.pendingSelectedService));
            const docsBoxEarly = document.getElementById('sidebarDocumentsBox');

            if (isServiceSelectionOnlyEarly) {
                if (docsBoxEarly) docsBoxEarly.style.display = 'none';
            } else {
                if (docsBoxEarly) docsBoxEarly.style.display = 'block';
                const cachedDocs = cachedServerDocsByMobile[targetMobile];
                const instantDocs = extractDocumentsFromProfile(a, targetMobile, appNo, pdfUrl);

                if (instantDocs.length > 0) {
                    renderSidebarDocuments(instantDocs);
                } else if (cachedDocs && cachedDocs.length > 0) {
                    renderSidebarDocuments(cachedDocs);
                }

                // 2. Refresh in parallel from server
                if (targetMobile) {
                    fetchSidebarDocuments(targetMobile);
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
                if (data?.subService) a.subService = data.subService;
                if (data?.subServiceData) a.subServiceData = data.subServiceData;
                if (data?.documents) a.documents = { ...(a.documents || {}), ...data.documents };
                window.lastSubService = a.subService || null;
                window.lastSubServiceData = a.subServiceData || null;

                currentCitizenData = a;
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
                
                // Dynamically sync active customer title & localStorage with extracted official name
                if (activeCustMob) {
                    const resolvedName = resolveCustomerDisplayName(a, localStorage.getItem('eseva_active_customer_name'));
                    if (resolvedName && resolvedName !== 'வாடிக்கையாளர்') {
                        localStorage.setItem('eseva_active_customer_name', resolvedName);
                    }
                    renderActiveCustomerHeader(resolvedName, activeCustMob);
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
                setVal('infoHeadMobile', (a.mobileNumber || activeCustMob) ? `+91 ${a.mobileNumber || activeCustMob}` : '');
                const addrParts = [a.doorNo, a.streetTam || a.streetEng, a.areaTam || a.areaEng].filter(Boolean);
                const addr = addrParts.join(', ');
                setVal('infoAddress', addr);
                setVal('infoPin', a.pincode);
                const regionStr = [a.district, a.taluk, a.village].filter(Boolean).join(' / ');
                setVal('infoAreaRegion', regionStr);
                setVal('infoResidenceProof', a.residenceProof ? (a.residenceProof.typeTam || a.residenceProof.type) : '');
                setVal('infoCardType', a.cardTypeTam || (a.cardType ? 'அரிசி அட்டை' : 'அரிசி அட்டை (பச்சை)'));

                // Active Service Identification for Context-Adaptive Sidebar
                const curState = (data && (data.step || data.intakeState)) || (currentCitizenData && currentCitizenData.intakeState) || '';
                const svcName = (window.pendingSelectedService || a.serviceName || data?.serviceName || '').toLowerCase();
                const isServiceSelectionOnly = (curState === 'SERVICE_SELECTION' || curState === 'RATION_CARD_SERVICES' || (!curState && !window.pendingSelectedService));
                const isIncomeService = !isServiceSelectionOnly && (curState.includes('INCOME') || svcName.includes('வருமானம்') || svcName.includes('income'));
                const isResidenceService = !isServiceSelectionOnly && (curState.includes('RESIDENCE') || svcName.includes('இருப்பிடம்') || svcName.includes('residence'));
                const isCommunityService = !isServiceSelectionOnly && (curState.includes('COMMUNITY') || svcName.includes('சாதி') || svcName.includes('community'));
                const isRemoveMemberService = !isServiceSelectionOnly && isSubserviceRemoveMember;
                const isAddMemberService = !isServiceSelectionOnly && isSubserviceAddMember;
                const isAddressChangeService = !isServiceSelectionOnly && (a.subService === 'CHANGE_ADDRESS' || a.subService === 'ADDRESS_CHANGE' || curState.includes('CHANGE_ADDRESS') || svcName.includes('முகவரி'));
                const isNewRationCardService = !isServiceSelectionOnly && !isIncomeService && !isResidenceService && !isCommunityService && !isRemoveMemberService && !isAddMemberService && !isAddressChangeService && (
                    curState.includes('MEMBER') || curState.includes('HEAD_') || curState.includes('RESIDENCE_PROOF') || curState.includes('GAS_') || curState.includes('CARD_TYPE') || curState === 'READY_TO_APPLY' || curState === 'MOBILE_NUMBER' || curState === 'ADDRESS_CHOICE' ||
                    a.service === 'new_smart_card' || a.service === 'ration' || a.service === 'புதிய ரேஷன் கார்டு' || a.service === 'புதிய குடும்ப அட்டை' || a.subService === 'NEW_CARD' ||
                    window.pendingSelectedService === 'ration' || window.pendingSelectedService === 'new_smart_card' ||
                    svcName.includes('புதிய ரேஷன்') || svcName.includes('புதிய குடும்ப') || svcName.includes('ration') || svcName.includes('smart_card')
                );

                // 1. Sidebar Head Title & Box Visibility
                const headBoxEl = document.getElementById('sidebarHeadBox');
                if (headBoxEl) {
                    headBoxEl.style.display = (isAddMemberService && !hasRealHead) ? 'none' : 'block';
                }
                const headTitleEl = document.getElementById('sidebarHeadTitle');
                if (headTitleEl) {
                    if (isIncomeService) headTitleEl.innerHTML = '👤 விண்ணப்பதாரர் விவரங்கள்';
                    else if (isResidenceService) headTitleEl.innerHTML = '👤 விண்ணப்பதாரர் விவரங்கள் (இருப்பிடம்)';
                    else if (isCommunityService) headTitleEl.innerHTML = '👤 விண்ணப்பதாரர் விவரங்கள் (சாதிச் சான்றிதழ்)';
                    else if (isRemoveMemberService) headTitleEl.innerHTML = '👤 குடும்பத் தலைவர் / அட்டை விவரங்கள்';
                    else if (isAddressChangeService) headTitleEl.innerHTML = '👤 குடும்பத் தலைவர் / அட்டை விவரங்கள்';
                    else if (isAddMemberService) headTitleEl.innerHTML = '👤 குடும்பத் தலைவர் விவரங்கள்';
                    else if (isNewRationCardService) headTitleEl.innerHTML = '👤 1. குடும்பத் தலைவர்';
                    else headTitleEl.innerHTML = '👤 வாடிக்கையாளர் விவரங்கள்';
                }

                // 2. Income Certificate Box
                const incomeBox = document.getElementById('sidebarIncomeBox');
                if (incomeBox) {
                    if (isIncomeService) {
                        incomeBox.style.display = 'block';
                        setVal('infoAnnualIncome', a.annualIncome ? `₹${Number(a.annualIncome).toLocaleString('en-IN')}` : '—');
                        setVal('infoProfession', a.profession || '—');
                        setVal('infoCanNo', a.canNumber || '—');
                    } else {
                        incomeBox.style.display = 'none';
                    }
                }

                // 2.2 Residence Certificate Box
                const residenceBox = document.getElementById('sidebarResidenceBox');
                if (residenceBox) {
                    if (isResidenceService) {
                        residenceBox.style.display = 'block';
                        setVal('infoResidenceCanNo', a.canNumber || '—');
                        setVal('infoResidenceYears', a.yearsOfResidence || '—');
                        setVal('infoResidencePurpose', a.purposeOfCertificate || '—');
                    } else {
                        residenceBox.style.display = 'none';
                    }
                }

                // 2.3 Community Certificate Box
                const communityBox = document.getElementById('sidebarCommunityBox');
                if (communityBox) {
                    if (isCommunityService) {
                        communityBox.style.display = 'block';
                        setVal('infoCommunityCanNo', a.canNumber || '—');
                        setVal('infoCommunityMother', a.motherNameTam || a.motherNameEng || a.motherName || '—');
                        setVal('infoCommunityReligion', a.religion || '—');
                        setVal('infoCommunityCategory', a.community || a.socialCategory || '—');
                        setVal('infoCommunityCaste', a.caste || a.subCaste || a.casteName || '—');
                    } else {
                        communityBox.style.display = 'none';
                    }
                }

                // 3. Remove Member Box
                const removeBox = document.getElementById('sidebarRemoveMemberBox');
                if (removeBox) {
                    if (isRemoveMemberService) {
                        removeBox.style.display = 'block';
                        const remName = subData?.memberNameTam || subData?.memberNameEng || subData?.memberName || '—';
                        setVal('infoRemoveMemberName', remName);
                        setVal('infoRemoveReason', subData?.reason || '—');
                        setVal('infoRemoveSmartCard', a.smartCardNumber || a.rationCardNo || subData?.smartCardNumber || '—');
                    } else {
                        removeBox.style.display = 'none';
                    }
                }

                // 3.5 Address Box (Shown only when a specific service is chosen and relevant, NEVER empty in Add Member or Service Selection!)
                const addrBox = document.getElementById('sidebarAddressBox');
                if (addrBox) {
                    addrBox.style.display = (isServiceSelectionOnly || (isAddMemberService && !addr)) ? 'none' : 'block';
                }

                // 3.6 Documents Box (Shown only when a specific service is chosen, NEVER during service selection!)
                const docsBox = document.getElementById('sidebarDocumentsBox');
                if (docsBox) {
                    docsBox.style.display = isServiceSelectionOnly ? 'none' : 'block';
                }

                // 4. Gas Connection Box (Shown strictly ONLY for New Ration Card!)
                const gasBox = document.getElementById('gasSidebarBox');
                if (gasBox) {
                    gasBox.style.display = isNewRationCardService ? 'block' : 'none';
                }

                // 5. Residence Proof and Card Type Rows (Shown strictly ONLY for New Ration Card!)
                const rowRes = document.getElementById('rowResidenceProof');
                if (rowRes) rowRes.style.display = isNewRationCardService ? 'flex' : 'none';
                const rowCard = document.getElementById('rowCardType');
                if (rowCard) rowCard.style.display = isNewRationCardService ? 'flex' : 'none';

                // 6. Service Selection Prompt Box
                const promptBox = document.getElementById('sidebarServiceSelectionPromptBox');
                if (promptBox) {
                    promptBox.style.display = isServiceSelectionOnly ? 'block' : 'none';
                }

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
                const membersContainer = document.getElementById('membersSidebarContainer');
                if (membersContainer) {
                    if (!isNewRationCardService && !isAddMemberService) {
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
            if (img && imgUrl) img.src = imgUrl;
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
