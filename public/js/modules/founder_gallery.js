// =========================================================================
// eSevaDraft Founder-Only Golden Sample Gallery (public/js/modules/founder_gallery.js)
// Strictly hidden unless backend verifies Founder PC + Founder UID + Local Golden Folder.
// Zero leakage to franchise operators, public web users, or customers.
// =========================================================================

(function initFounderSampleGallery() {
    let galleryEnabled = false;
    let galleryFolderPath = '';
    let galleryItems = [];
    let activeCategory = 'ALL';

    const SLOT_OPTIONS = [
        { v: 'profilePhoto', t: '📸 பாஸ்போர்ட் புகைப்படம் (Photo)' },
        { v: 'headAadhaar', t: '🪪 ஆதார் 2-in-1 (Aadhaar)' },
        { v: 'headAadhaarFront', t: '🪪 ஆதார் முன்பக்கம் (Aadhaar Front)' },
        { v: 'headAadhaarBack', t: '🪪 ஆதார் பின்பக்கம் (Aadhaar Back)' },
        { v: 'communityCertificate', t: '📜 சாதிச் சான்றிதழ் (OBC / Community)' },
        { v: 'communityProof', t: '📜 குடும்ப சாதிச் சான்று (REV-101)' },
        { v: 'incomeProof', t: '💰 வருமான ஆதாரம் / சம்பளச் சான்று (REV-103)' },
        { v: 'incomeTaxReturn', t: '💼 ITR / வருமான வரி சான்று (OBC REV-115)' },
        { v: 'residenceProof', t: '🏠 இருப்பிட ஆதாரம் / EB Bill (REV-102)' },
        { v: 'smartCard', t: '💳 குடும்ப ஸ்மார்ட் கார்டு (Smart Card)' },
        { v: 'applicantEducationProof', t: '🎓 மாணவர் 12th TC (REV-104)' },
        { v: 'fatherEducationProof', t: '👨 தந்தை பள்ளி TC (REV-104)' },
        { v: 'motherEducationProof', t: '👩 தாய் பள்ளி TC (REV-104)' },
        { v: 'gasBook', t: '⛽ எரிவாயு நுகர்வோர் புத்தகம் (Gas Book)' }
    ];

    function getFounderUid() {
        return localStorage.getItem('eseva_operator_uid') || '';
    }

    function setGalleryButtonsVisible(visible) {
        const navBtn = document.getElementById('btnFounderGalleryNav');
        if (navBtn) navBtn.style.display = visible ? 'inline-flex' : 'none';
        const editBtn = document.getElementById('btnEditModalFounderGallery');
        if (editBtn) editBtn.style.display = visible ? 'inline-flex' : 'none';
    }

    async function checkFounderGalleryAccess() {
        const uid = getFounderUid();
        if (!uid) {
            setGalleryButtonsVisible(false);
            return false;
        }
        try {
            const res = await fetch(`/api/dev/golden-gallery?uid=${encodeURIComponent(uid)}`, {
                headers: { 'x-operator-uid': uid }
            });
            if (!res.ok) {
                galleryEnabled = false;
                setGalleryButtonsVisible(false);
                return false;
            }
            const data = await res.json();
            if (data && data.enabled && Array.isArray(data.items)) {
                galleryEnabled = true;
                galleryFolderPath = data.folderPath || data.rootPath || '';
                galleryItems = data.items;
                setGalleryButtonsVisible(true);
                return true;
            }
        } catch (_) {}
        galleryEnabled = false;
        setGalleryButtonsVisible(false);
        return false;
    }

    function ensureGalleryModalDom() {
        let modal = document.getElementById('founderGalleryModal');
        if (modal) return modal;

        modal = document.createElement('div');
        modal.id = 'founderGalleryModal';
        modal.style.cssText = 'display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.72); z-index: 99999; align-items: center; justify-content: center; padding: 16px; backdrop-filter: blur(4px);';
        modal.innerHTML = `
            <div style="background: #ffffff; border-radius: 16px; width: 96%; max-width: 980px; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 50px rgba(0,0,0,0.35); border: 2px solid #f59e0b;">
                <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); color: white; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap;">
                    <div>
                        <div style="font-size: 15px; font-weight: 800; display: flex; align-items: center; gap: 8px;">
                            <span>🖼️ Founder Dev Sample Gallery (குமரன் கி — Golden Samples)</span>
                            <span style="background: #f59e0b; color: #0f172a; font-size: 10px; font-weight: 900; padding: 2px 8px; border-radius: 999px;">PRIVATE / FOUNDER ONLY</span>
                        </div>
                        <div id="founderGalleryFolderDisplay" style="font-size: 11px; color: #cbd5e1; margin-top: 3px; font-family: monospace;"></div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <button type="button" id="btnOpenGoldenFolder" style="height: 32px; padding: 0 12px; background: #0284c7; color: white; border: none; border-radius: 8px; font-size: 11.5px; font-weight: 700; cursor: pointer;">📂 Open Folder</button>
                        <button type="button" id="btnRefreshGoldenGallery" style="height: 32px; padding: 0 12px; background: #334155; color: #f8fafc; border: 1px solid #475569; border-radius: 8px; font-size: 11.5px; font-weight: 700; cursor: pointer;">🔄 Refresh</button>
                        <button type="button" id="btnCloseFounderGallery" style="height: 32px; width: 32px; background: #ef4444; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 800; cursor: pointer;">✕</button>
                    </div>
                </div>
                <div id="founderGalleryFilterBar" style="padding: 10px 18px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; gap: 6px; flex-wrap: wrap;"></div>
                <div id="founderGalleryGrid" style="padding: 16px 18px; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; background: #f1f5f9;"></div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('btnCloseFounderGallery').onclick = () => { modal.style.display = 'none'; };
        modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
        document.getElementById('btnRefreshGoldenGallery').onclick = async () => {
            await checkFounderGalleryAccess();
            renderGalleryContents();
        };
        document.getElementById('btnOpenGoldenFolder').onclick = async () => {
            const uid = getFounderUid();
            await fetch('/api/dev/golden-gallery/open-folder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-operator-uid': uid }
            }).catch(() => {});
        };
        return modal;
    }

    function renderGalleryContents() {
        const folderEl = document.getElementById('founderGalleryFolderDisplay');
        if (folderEl) folderEl.textContent = `📁 Folder: ${galleryFolderPath}`;

        const filters = [
            { k: 'ALL', l: 'அனைத்தும் (All)' },
            { k: 'OBC', l: 'OBC (REV-115)' },
            { k: 'FIRST_GRADUATE', l: 'முதல் பட்டதாரி (REV-104)' },
            { k: 'INCOME', l: 'வருமானம் (REV-103)' },
            { k: 'COMMUNITY', l: 'சாதி (REV-101)' },
            { k: 'RESIDENCE', l: 'இருப்பிடம் (REV-102)' },
            { k: 'RATION', l: 'ரேஷன் கார்டு' },
            { k: 'IDENTITY', l: 'Photo / Aadhaar' }
        ];

        const bar = document.getElementById('founderGalleryFilterBar');
        bar.innerHTML = '';
        filters.forEach(f => {
            const btn = document.createElement('button');
            btn.type = 'button';
            const active = activeCategory === f.k;
            btn.textContent = f.l;
            btn.style.cssText = `padding: 5px 11px; border-radius: 999px; font-size: 11px; font-weight: 700; cursor: pointer; border: 1.5px solid ${active ? '#d97706' : '#cbd5e1'}; background: ${active ? '#fef3c7' : '#ffffff'}; color: ${active ? '#92400e' : '#334155'};`;
            btn.onclick = () => { activeCategory = f.k; renderGalleryContents(); };
            bar.appendChild(btn);
        });

        const grid = document.getElementById('founderGalleryGrid');
        grid.innerHTML = '';
        const list = activeCategory === 'ALL' ? galleryItems : galleryItems.filter(it => it.category === activeCategory);

        if (list.length === 0) {
            grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 30px; color: #64748b; font-weight: 700;">இந்தப் பிரிவில் மாதிரி ஆவணங்கள் இல்லை.</div>';
            return;
        }

        list.forEach((item, idx) => {
            const card = document.createElement('div');
            card.style.cssText = 'background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 10px; display: flex; flex-direction: column; gap: 8px; box-shadow: 0 2px 6px rgba(15,23,42,0.06);';

            const thumbHtml = item.isPdf
                ? `<div style="height: 115px; background: #fee2e2; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #dc2626; font-size: 34px;"><i class="fa-solid fa-file-pdf"></i></div>`
                : `<img src="${item.previewUrl}" alt="${item.fileName}" style="width: 100%; height: 115px; object-fit: cover; border-radius: 8px; border: 1px solid #e2e8f0; background: #f8fafc;">`;

            const slotSelectId = `gallerySlotSelect_${idx}`;
            const optionsHtml = SLOT_OPTIONS.map(o => `<option value="${o.v}" ${o.v === item.docType ? 'selected' : ''}>${o.t}</option>`).join('');

            card.innerHTML = `
                ${thumbHtml}
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px;">
                    <span style="background: #e0f2fe; color: #0369a1; font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 6px;">${item.badge}</span>
                    <span style="font-size: 10.5px; color: #64748b; font-weight: 700;">${item.sizeKB} KB</span>
                </div>
                <div style="font-size: 12px; font-weight: 800; color: #0f172a; line-height: 1.3;">${item.title}</div>
                <div style="font-size: 10px; color: #64748b; font-family: monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${item.relPath}">${item.fileName}</div>
                <select id="${slotSelectId}" style="width: 100%; padding: 5px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 11px; font-weight: 600; background: #f8fafc;">
                    ${optionsHtml}
                </select>
                <div style="display: flex; gap: 6px; margin-top: auto;">
                    <button type="button" data-action="attach" style="flex: 1; height: 30px; background: #16a34a; color: white; border: none; border-radius: 7px; font-size: 11px; font-weight: 700; cursor: pointer;">⚡ Profile-ல் இணை</button>
                    <button type="button" data-action="chat" style="flex: 1; height: 30px; background: #2563eb; color: white; border: none; border-radius: 7px; font-size: 11px; font-weight: 700; cursor: pointer;">💬 Chat-ல் அனுப்பு</button>
                </div>
            `;

            const attachBtn = card.querySelector('button[data-action="attach"]');
            const chatBtn = card.querySelector('button[data-action="chat"]');

            attachBtn.onclick = async () => {
                const slotVal = document.getElementById(slotSelectId)?.value || item.docType || 'other';
                await attachSampleToActiveProfile(item, slotVal, attachBtn);
            };
            chatBtn.onclick = async () => {
                await sendSampleDirectlyToChat(item, chatBtn);
            };

            grid.appendChild(card);
        });
    }

    async function fetchSampleFileObject(item) {
        const res = await fetch(item.previewUrl);
        if (!res.ok) throw new Error('Sample file fetch failed');
        const blob = await res.blob();
        const mime = blob.type || (item.isPdf ? 'application/pdf' : 'image/jpeg');
        return new File([blob], item.fileName, { type: mime });
    }

    async function attachSampleToActiveProfile(item, slotKey, btnEl) {
        const activeMob = localStorage.getItem('eseva_active_customer_mobile') || localStorage.getItem('eseva_user_mobile') || '';
        const uid = getFounderUid();
        if (!activeMob || activeMob.startsWith('walkin_')) {
            alert('⚠️ முதலில் வாடிக்கையாளரை (எ.கா: குமரன் கி 9790170026) தேர்ந்தெடுக்கவும்.');
            return;
        }
        const orig = btnEl.innerHTML;
        btnEl.disabled = true;
        btnEl.innerHTML = '⏳...';
        try {
            const fileObj = await fetchSampleFileObject(item);
            const fd = new FormData();
            fd.append('document', fileObj);
            fd.append('docType', slotKey);
            fd.append('mobileNumber', activeMob);
            const res = await fetch(`/api/drafts/${encodeURIComponent(activeMob)}/upload-doc`, {
                method: 'POST',
                headers: { 'x-session-mobile': activeMob, 'x-operator-uid': uid },
                body: fd
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.error || 'Upload failed');
            }
            if (json.citizenProfile && typeof currentCitizenData !== 'undefined') {
                window.currentCitizenData = json.citizenProfile;
                currentCitizenData = json.citizenProfile;
            }
            if (typeof updateSidebar === 'function') {
                updateSidebar(json);
            }
            const editModal = document.getElementById('editModal');
            if (editModal && editModal.style.display === 'flex' && typeof openEditModal === 'function') {
                await openEditModal(activeMob, Boolean(window.currentEditModalIsMasterProfile));
            }
            if (typeof fetchHistory === 'function') fetchHistory();
            if (typeof showEsevaToast === 'function') {
                showEsevaToast(`✅ ${item.title} (${slotKey}) இணைக்கப்பட்டது!`, 'success');
            }
        } catch (e) {
            alert('❌ பிழை: ' + e.message);
        } finally {
            btnEl.disabled = false;
            btnEl.innerHTML = orig;
        }
    }

    async function sendSampleDirectlyToChat(item, btnEl) {
        if (typeof window.handleFileUpload !== 'function') {
            alert('Chat file uploader தயாராக இல்லை.');
            return;
        }
        const orig = btnEl.innerHTML;
        btnEl.disabled = true;
        btnEl.innerHTML = '⏳...';
        try {
            const fileObj = await fetchSampleFileObject(item);
            const modal = document.getElementById('founderGalleryModal');
            if (modal) modal.style.display = 'none';
            await window.handleFileUpload({ target: { files: [fileObj], value: '' } });
        } catch (e) {
            alert('❌ பிழை: ' + e.message);
        } finally {
            btnEl.disabled = false;
            btnEl.innerHTML = orig;
        }
    }

    window.openFounderGalleryModal = async function () {
        const ok = await checkFounderGalleryAccess();
        if (!ok) return;
        const modal = ensureGalleryModalDom();
        modal.style.display = 'flex';
        renderGalleryContents();
    };
    window.checkFounderGalleryAccess = checkFounderGalleryAccess;

    // Initial check & safe periodic sync when auth changes
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(checkFounderGalleryAccess, 800));
    } else {
        setTimeout(checkFounderGalleryAccess, 800);
    }
    setInterval(() => {
        const uid = getFounderUid();
        if (uid && !galleryEnabled) checkFounderGalleryAccess();
        if (!uid && galleryEnabled) {
            galleryEnabled = false;
            setGalleryButtonsVisible(false);
        }
    }, 3500);
})();
