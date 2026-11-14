/**
 * public/js/modules/eseva_tools.js
 * Dedicated e-Seva Operator Utility Suite (#panel-tools):
 *  1. PDF Compressor & N-Part Splitter (Upload-Preview-First UI, 20MB+ to 100MB support)
 *  2. Two-Way JPG ⇄ PDF Converter (Upload-Preview-First UI, 2-in-1 Aadhaar, PDF-to-JPG)
 *  3. Interactive Photo Cropper, Resizer & Strict KB Compressor (8-handle mouse crop, Icon-only toolbar)
 *  4. Digital Signature Studio (1. Draw, 2. Type Cursive Signature, 3. White-Paper Photo Auto-Clean)
 */

(function (window) {
    'use strict';

    function ensurePdfJsWorker() {
        if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
            if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
            }
        }
    }

    // Open the Tools Workspace from the Header Icon
    window.openEsevaToolsPage = function (initialToolTab) {
        ensurePdfJsWorker();
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
            window.switchTab('tools');
        } else {
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active-panel'));
            const panel = document.getElementById('panel-tools');
            if (panel) panel.classList.add('active-panel');
        }

        if (initialToolTab) {
            window.switchEsevaToolSubTab(initialToolTab);
        } else if (!window.__esevaToolsInitialized) {
            window.__esevaToolsInitialized = true;
            window.switchEsevaToolSubTab('pdf-comp-split');
            initPhotoCropCanvasEvents();
            initSignaturePadEvents();
        }
    };

    // Switch between the 4 Tools inside #panel-tools
    window.switchEsevaToolSubTab = function (toolKey) {
        ensurePdfJsWorker();
        const keys = ['pdf-comp-split', 'jpg-pdf', 'photo-crop', 'digital-sign'];
        keys.forEach(k => {
            const pane = document.getElementById(`toolPane-${k}`);
            const btn = document.getElementById(`toolTabBtn-${k}`);
            if (pane) pane.style.display = (k === toolKey) ? 'block' : 'none';
            if (btn) {
                if (k === toolKey) {
                    btn.classList.add('active-tool-tab');
                    btn.style.background = 'linear-gradient(135deg, #064e3b 0%, #059669 100%)';
                    btn.style.color = '#ffffff';
                    btn.style.borderColor = '#059669';
                    btn.style.boxShadow = '0 4px 12px rgba(5, 150, 105, 0.28)';
                } else {
                    btn.classList.remove('active-tool-tab');
                    btn.style.background = '#ffffff';
                    btn.style.color = '#334155';
                    btn.style.borderColor = '#cbd5e1';
                    btn.style.boxShadow = 'none';
                }
            }
        });

        if (!window.__esevaToolsEventsBound) {
            window.__esevaToolsEventsBound = true;
            initPhotoCropCanvasEvents();
            initSignaturePadEvents();
        }
    };

    function formatSizeLabel(bytes) {
        const kb = bytes / 1024;
        if (kb >= 1024) {
            return `${(kb / 1024).toFixed(2)} MB (${Math.round(kb)} KB)`;
        }
        return `${kb.toFixed(1)} KB`;
    }

    async function triggerDownloadUrl(url, filename) {
        if (!url) return;
        const safeName = filename || 'download.pdf';

        // 1. Electron Desktop Bridge: Direct native save to Windows Downloads folder + reveal in Explorer
        if (window.esevaDesktopBridge && typeof window.esevaDesktopBridge.saveFileDirect === 'function') {
            try {
                let base64Data = null;
                if (url.startsWith('data:')) {
                    base64Data = url;
                } else {
                    // Fetch blob, data, or relative API URL and convert to Base64
                    const resp = await fetch(url);
                    if (resp.ok) {
                        const blob = await resp.blob();
                        base64Data = await new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result);
                            reader.onerror = reject;
                            reader.readAsDataURL(blob);
                        });
                    }
                }

                if (base64Data) {
                    const res = await window.esevaDesktopBridge.saveFileDirect({ base64Data, filename: safeName });
                    if (res && res.success) {
                        if (typeof showInAppToast === 'function') {
                            showInAppToast(`✅ கோப்பு Downloads கோப்புறையில் சேமிக்கப்பட்டது: ${res.fileName}`);
                        }
                        return;
                    }
                }
            } catch (e) {
                console.warn('[Desktop Direct Downloader Warning]:', e);
            }
        }

        // 2. Standard Web Browser Fallback
        const a = document.createElement('a');
        a.href = url;
        a.download = safeName;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => a.remove(), 500);
    }
    window.triggerDownloadUrl = triggerDownloadUrl;
    window.downloadFileDirect = triggerDownloadUrl;

    // =========================================================================
    // TOOL 1: PDF COMPRESSOR & SPLITTER (UPLOAD-PREVIEW-FIRST UI)
    // =========================================================================
    let tool1State = {
        file: null,
        totalPages: 0,
        targetKb: 200,
        splitMode: 'n_parts'
    };

    window.handleTool1PdfSelected = async function (inputOrFile) {
        ensurePdfJsWorker();
        const file = inputOrFile instanceof File ? inputOrFile : (inputOrFile && inputOrFile.files && inputOrFile.files[0]);
        if (!file) return;

        tool1State.file = file;

        const emptyPrompt = document.getElementById('tool1EmptyPrompt');
        const uploadedWrap = document.getElementById('tool1UploadedPreviewWrap');
        const nameEl = document.getElementById('tool1FileName');
        const metaEl = document.getElementById('tool1FileMeta');
        const statusEl = document.getElementById('tool1StatusMsg');
        const resultsBox = document.getElementById('tool1ResultsContainer');
        const thumbsWrap = document.getElementById('tool1PageThumbsGrid');

        // Transform the Top Upload Box immediately into the Document Preview Box!
        if (emptyPrompt) emptyPrompt.style.display = 'none';
        if (uploadedWrap) uploadedWrap.style.display = 'flex';
        if (nameEl) nameEl.innerText = file.name;
        if (metaEl) metaEl.innerText = `${formatSizeLabel(file.size)} • பக்கங்கள் ஏற்றப்படுகிறது...`;
        if (resultsBox) resultsBox.innerHTML = '';
        if (statusEl) statusEl.innerText = '';
        if (thumbsWrap) thumbsWrap.innerHTML = '';

        try {
            const arrayBuf = await file.arrayBuffer();
            if (window.pdfjsLib) {
                const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(arrayBuf) }).promise;
                tool1State.totalPages = pdf.numPages;
                if (metaEl) {
                    metaEl.innerHTML = `${formatSizeLabel(file.size)} • <b>${pdf.numPages} பக்கங்கள்</b>`;
                }

                if (thumbsWrap) {
                    const previewCount = Math.min(pdf.numPages, 12);
                    for (let p = 1; p <= previewCount; p++) {
                        const page = await pdf.getPage(p);
                        const vp = page.getViewport({ scale: 0.48 });
                        const c = document.createElement('canvas');
                        c.width = vp.width;
                        c.height = vp.height;
                        const ctx = c.getContext('2d');
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, c.width, c.height);
                        await page.render({ canvasContext: ctx, viewport: vp }).promise;

                        const card = document.createElement('div');
                        card.style.cssText = 'background:white; border:1.5px solid #cbd5e1; border-radius:8px; padding:6px; text-align:center; font-size:11px; color:#334155; font-weight:800; box-shadow:0 1px 3px rgba(0,0,0,0.04);';
                        const img = document.createElement('img');
                        img.src = c.toDataURL('image/jpeg', 0.82);
                        img.style.cssText = 'width:100%; height:130px; object-fit:contain; border-radius:4px; background:#f8fafc; display:block; margin-bottom:4px; border:1px solid #e2e8f0;';
                        card.appendChild(img);
                        const lbl = document.createElement('span');
                        lbl.innerText = `பக்கம் ${p}`;
                        card.appendChild(lbl);
                        thumbsWrap.appendChild(card);
                    }
                    if (pdf.numPages > previewCount) {
                        const more = document.createElement('div');
                        more.style.cssText = 'background:#f1f5f9; border:1.5px dashed #94a3b8; border-radius:8px; padding:8px; display:flex; align-items:center; justify-content:center; font-size:11.5px; font-weight:800; color:#475569; text-align:center; min-height:130px;';
                        more.innerText = `+ மேலும் ${pdf.numPages - previewCount} பக்கங்கள்`;
                        thumbsWrap.appendChild(more);
                    }
                }
            } else if (window.PDFLib) {
                const doc = await window.PDFLib.PDFDocument.load(arrayBuf, { ignoreEncryption: true });
                tool1State.totalPages = doc.getPageCount();
                if (metaEl) {
                    metaEl.innerHTML = `${formatSizeLabel(file.size)} • <b>${tool1State.totalPages} பக்கங்கள்</b>`;
                }
            }
        } catch (err) {
            console.error('PDF load error:', err);
            if (metaEl) metaEl.innerText = `${formatSizeLabel(file.size)}`;
        }
    };

    window.setTool1TargetKb = function (kb, btnEl) {
        tool1State.targetKb = Number(kb) || 200;
        const customInput = document.getElementById('tool1CustomKbInput');
        if (customInput) customInput.value = tool1State.targetKb;
        document.querySelectorAll('.tool1-kb-pill').forEach(b => {
            b.style.background = '#ffffff';
            b.style.color = '#334155';
            b.style.borderColor = '#cbd5e1';
            b.style.fontWeight = '700';
        });
        if (btnEl) {
            btnEl.style.background = '#ecfdf5';
            btnEl.style.color = '#065f46';
            btnEl.style.borderColor = '#10b981';
            btnEl.style.fontWeight = '800';
        }
    };

    window.setTool1QuickSplitCount = function (count, btnEl) {
        tool1State.splitMode = 'n_parts';
        const numInput = document.getElementById('tool1NumPartsInput');
        if (numInput) numInput.value = Number(count) || 5;
        const nWrap = document.getElementById('tool1CustomPartsWrap');
        if (nWrap) nWrap.style.display = 'flex';

        document.querySelectorAll('.tool1-split-pill').forEach(b => {
            b.style.background = '#ffffff';
            b.style.color = '#334155';
            b.style.borderColor = '#cbd5e1';
            b.style.fontWeight = '700';
        });
        if (btnEl) {
            btnEl.style.background = '#eff6ff';
            btnEl.style.color = '#1e40af';
            btnEl.style.borderColor = '#3b82f6';
            btnEl.style.fontWeight = '800';
        }
    };

    window.setTool1SplitMode = function (mode, btnEl) {
        tool1State.splitMode = mode;
        document.querySelectorAll('.tool1-split-pill').forEach(b => {
            b.style.background = '#ffffff';
            b.style.color = '#334155';
            b.style.borderColor = '#cbd5e1';
            b.style.fontWeight = '700';
        });
        if (btnEl) {
            btnEl.style.background = '#eff6ff';
            btnEl.style.color = '#1e40af';
            btnEl.style.borderColor = '#3b82f6';
            btnEl.style.fontWeight = '800';
        }
        const nWrap = document.getElementById('tool1CustomPartsWrap');
        if (nWrap) nWrap.style.display = (mode === 'each_page') ? 'none' : 'flex';
    };

    async function renderAllPdfPagesToDataUrls(file, scale = 1.45, statusCallback) {
        ensurePdfJsWorker();
        if (!window.pdfjsLib) {
            throw new Error('PDF.js தயாராகவில்லை.');
        }
        const arrayBuf = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(arrayBuf) }).promise;
        const urls = [];
        for (let p = 1; p <= pdf.numPages; p++) {
            if (statusCallback) statusCallback(`⏳ பக்கம் ${p} / ${pdf.numPages} செயலாக்கப்படுகிறது...`);
            const page = await pdf.getPage(p);
            const vp = page.getViewport({ scale });
            const canvas = document.createElement('canvas');
            canvas.width = vp.width;
            canvas.height = vp.height;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            await page.render({ canvasContext: ctx, viewport: vp }).promise;
            urls.push(canvas.toDataURL('image/jpeg', 0.85));
        }
        return urls;
    }

    // Execute PDF Compression
    window.runTool1PdfCompress = async function () {
        if (!tool1State.file) {
            if (typeof showInAppToast === 'function') showInAppToast('⚠️ முதலில் மேலே உள்ள பெட்டியில் ஒரு PDF கோப்பை அப்லோட் செய்யவும்.', 'warn');
            return;
        }

        const customKbVal = Number(document.getElementById('tool1CustomKbInput')?.value);
        const targetKb = customKbVal > 10 ? customKbVal : (tool1State.targetKb || 200);
        const btn = document.getElementById('btnTool1CompressNow');
        const statusEl = document.getElementById('tool1StatusMsg');
        const resultsBox = document.getElementById('tool1ResultsContainer');

        try {
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> சுருக்கப்படுகிறது...';
            }

            const pageUrls = await renderAllPdfPagesToDataUrls(
                tool1State.file,
                targetKb <= 120 ? 1.15 : 1.45,
                (msg) => { if (statusEl) statusEl.innerText = msg; }
            );

            if (statusEl) statusEl.innerText = `⚡ ${targetKb} KB அளவிற்கு PDF சுருக்கப்படுகிறது...`;

            const res = await fetch('/api/tools/pdf-compress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    originalName: tool1State.file.name,
                    targetKb,
                    splitParts: 1,
                    pageDataUrls: pageUrls
                })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'PDF சுருக்குவதில் பிழை');

            const origKb = (tool1State.file.size / 1024).toFixed(1);
            const newKb = data.mainFile.sizeKb;
            const savedPct = Math.max(0, Math.round((1 - (data.mainFile.sizeBytes / tool1State.file.size)) * 100));

            if (statusEl) {
                statusEl.innerHTML = `<span style="color:#15803d; font-weight:800;">✅ சுருக்கப்பட்டது: ${origKb} KB ➔ ${newKb} KB (${savedPct}% குறைப்பு) — பதிவிறக்கம் தொடங்கியது!</span>`;
            }

            // Immediately auto-trigger the file download
            triggerDownloadUrl(data.mainFile.downloadUrl, data.mainFile.filename);

            if (resultsBox) {
                resultsBox.innerHTML = `
                    <div style="background:#f0fdf4; border:1.5px solid #86efac; border-radius:10px; padding:12px 14px; margin-top:10px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                        <div>
                            <div style="font-size:13px; font-weight:800; color:#065f46;">
                                <i class="fa-solid fa-file-circle-check" style="color:#16a34a;"></i> ${data.mainFile.filename} (${newKb} KB)
                            </div>
                            <div style="font-size:11px; color:#15803d; margin-top:2px;">
                                📥 கோப்பு உங்கள் கம்ப்யூட்டரில் தானாகவே பதிவிறக்கம் செய்யப்பட்டது. மீண்டும் பதிவிறக்க கீழே உள்ள பட்டனைப் பயன்படுத்தலாம்.
                            </div>
                        </div>
                        <div style="display:flex; gap:8px; align-items:center;">
                            <a href="${data.mainFile.downloadUrl}?inline=1" target="_blank" style="height:32px; padding:0 12px; background:white; border:1.5px solid #86efac; color:#166534; border-radius:6px; font-size:11.5px; font-weight:700; text-decoration:none; display:inline-flex; align-items:center; gap:5px;">
                                <i class="fa-solid fa-eye"></i> பார்
                            </a>
                            <a href="${data.mainFile.downloadUrl}" download="${data.mainFile.filename}" style="height:32px; padding:0 14px; background:#16a34a; color:white; border-radius:6px; font-size:11.5px; font-weight:800; text-decoration:none; display:inline-flex; align-items:center; gap:5px;">
                                <i class="fa-solid fa-download"></i> பதிவிறக்கு
                            </a>
                        </div>
                    </div>
                `;
            }
        } catch (err) {
            console.error('Compress error:', err);
            if (statusEl) statusEl.innerHTML = `<span style="color:#dc2626; font-weight:700;">⚠️ பிழை: ${err.message}</span>`;
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-download"></i> 📥 சுருக்கு & பதிவிறக்கு (Compress & Download)';
            }
        }
    };

    // Execute Combined PDF Compression + N-Part Split (Does BOTH at once!)
    window.runTool1CompressAndSplit = async function () {
        if (!tool1State.file) {
            if (typeof showInAppToast === 'function') showInAppToast('⚠️ முதலில் மேலே உள்ள பெட்டியில் ஒரு PDF கோப்பை அப்லோட் செய்யவும்.', 'warn');
            return;
        }

        const customKbVal = Number(document.getElementById('tool1CustomKbInput')?.value);
        const targetKb = customKbVal > 10 ? customKbVal : (tool1State.targetKb || 200);
        const numParts = Number(document.getElementById('tool1NumPartsInput')?.value) || 5;
        const btn = document.getElementById('btnTool1CompressAndSplit');
        const statusEl = document.getElementById('tool1StatusMsg');
        const resultsBox = document.getElementById('tool1ResultsContainer');

        try {
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> சுருக்கி & பிரிக்கப்படுகிறது...';
            }

            const pageUrls = await renderAllPdfPagesToDataUrls(
                tool1State.file,
                targetKb <= 120 ? 1.15 : 1.45,
                (msg) => { if (statusEl) statusEl.innerText = msg; }
            );

            if (statusEl) statusEl.innerText = `⚡ ${targetKb} KB அளவிற்கு PDF சுருக்கப்பட்டு ${numParts} பாகங்களாகப் பிரிக்கப்படுகிறது...`;

            const res = await fetch('/api/tools/pdf-compress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    originalName: tool1State.file.name,
                    targetKb,
                    splitParts: numParts,
                    pageDataUrls: pageUrls
                })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'PDF சுருக்கிப் பிரிப்பதில் பிழை');

            const origKb = (tool1State.file.size / 1024).toFixed(1);
            const newKb = data.mainFile.sizeKb;
            const parts = data.splitOutputs || [];

            if (statusEl) {
                statusEl.innerHTML = `<span style="color:#15803d; font-weight:800;">✅ சுருக்கப்பட்டது (${origKb} KB ➔ ${newKb} KB) மற்றும் ${parts.length} பாகங்களாகப் பிரிக்கப்பட்டது!</span>`;
            }

            // Auto-download the full compressed file
            triggerDownloadUrl(data.mainFile.downloadUrl, data.mainFile.filename);

            let partsHtml = '';
            if (parts.length > 0) {
                partsHtml = renderSplitPartsCardsHtml(parts, `✂️ பிரிக்கப்பட்ட ${parts.length} PDF பாகங்கள் (ஒவ்வொன்றும் சுருக்கப்பட்டது)`);
            }

            if (resultsBox) {
                resultsBox.innerHTML = `
                    <div style="background:#f0fdf4; border:1.5px solid #86efac; border-radius:10px; padding:12px 14px; margin-top:10px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                        <div>
                            <div style="font-size:13px; font-weight:800; color:#065f46;">
                                <i class="fa-solid fa-file-circle-check" style="color:#16a34a;"></i> முழு கோப்பு: ${data.mainFile.filename} (${newKb} KB)
                            </div>
                            <div style="font-size:11px; color:#15803d; margin-top:2px;">
                                📥 முழு கோப்பு பதிவிறக்கம் தொடங்கியது!
                            </div>
                        </div>
                        <div style="display:flex; gap:8px; align-items:center;">
                            <a href="${data.mainFile.downloadUrl}?inline=1" target="_blank" style="height:32px; padding:0 12px; background:white; border:1.5px solid #86efac; color:#166534; border-radius:6px; font-size:11.5px; font-weight:700; text-decoration:none; display:inline-flex; align-items:center; gap:5px;">
                                <i class="fa-solid fa-eye"></i> பார்
                            </a>
                            <a href="${data.mainFile.downloadUrl}" download="${data.mainFile.filename}" style="height:32px; padding:0 14px; background:#16a34a; color:white; border-radius:6px; font-size:11.5px; font-weight:800; text-decoration:none; display:inline-flex; align-items:center; gap:5px;">
                                <i class="fa-solid fa-download"></i> பதிவிறக்கு
                            </a>
                        </div>
                    </div>
                    ${partsHtml}
                `;
            }
        } catch (err) {
            console.error('Compress & Split error:', err);
            if (statusEl) statusEl.innerHTML = `<span style="color:#dc2626; font-weight:700;">⚠️ பிழை: ${err.message}</span>`;
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-bolt-lightning"></i> ⚡ சுருக்கி & பாகங்களாகப் பிரித்துப் பதிவிறக்கு (Compress + Split & Download)';
            }
        }
    };

    // Execute PDF Split
    window.runTool1PdfSplit = async function () {
        if (!tool1State.file) {
            if (typeof showInAppToast === 'function') showInAppToast('⚠️ முதலில் மேலே உள்ள பெட்டியில் ஒரு PDF கோப்பை அப்லோட் செய்யவும்.', 'warn');
            return;
        }

        const btn = document.getElementById('btnTool1SplitNow');
        const statusEl = document.getElementById('tool1StatusMsg');
        const resultsBox = document.getElementById('tool1ResultsContainer');
        const numParts = Number(document.getElementById('tool1NumPartsInput')?.value) || 5;

        try {
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> பிரிக்கப்படுகிறது...';
            }
            if (statusEl) statusEl.innerText = '✂️ PDF பக்கங்கள் பிரிக்கப்படுகின்றன...';

            const fd = new FormData();
            fd.append('pdfFile', tool1State.file);
            fd.append('splitMode', tool1State.splitMode === 'each_page' ? 'each_page' : 'n_parts');
            fd.append('numParts', String(numParts));

            const res = await fetch('/api/tools/pdf-split', {
                method: 'POST',
                body: fd
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'PDF பிரிப்பதில் பிழை');

            const parts = data.splitOutputs || [];
            if (statusEl) {
                statusEl.innerHTML = `<span style="color:#1d4ed8; font-weight:800;">✅ ${parts.length} பாகங்களாகப் பிரிக்கப்பட்டுப் பதிவிறக்கம் தொடங்கியது!</span>`;
            }
            if (resultsBox) {
                resultsBox.innerHTML = renderSplitPartsCardsHtml(parts, `✂️ பிரிக்கப்பட்ட ${parts.length} PDF பாகங்கள்`);
            }
            if (parts.length > 0) {
                downloadAllSplitParts();
            }
        } catch (err) {
            console.error('Split error:', err);
            if (statusEl) statusEl.innerHTML = `<span style="color:#dc2626; font-weight:700;">⚠️ பிழை: ${err.message}</span>`;
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-scissors"></i> பிரி (Split PDF)';
            }
        }
    };

    function renderSplitPartsCardsHtml(parts, headingTitle) {
        window.__lastSplitPartsList = parts;
        const cardsHtml = parts.map((pt, idx) => `
            <div style="background:white; border:1.5px solid #cbd5e1; border-radius:8px; padding:10px; display:flex; flex-direction:column; justify-content:space-between; gap:6px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; padding:2px 7px; border-radius:5px; font-size:11px; font-weight:800;">
                        பாகம் ${pt.partNumber || (idx + 1)}
                    </span>
                    <span style="background:#f0fdf4; color:#15803d; padding:2px 6px; border-radius:5px; font-size:10.5px; font-weight:800;">
                        ${pt.sizeKb} KB
                    </span>
                </div>
                <div style="font-size:11px; color:#64748b; font-weight:600;">
                    📄 ${pt.pageRange || ''} (${pt.pageCount || 1} பக்கம்)
                </div>
                <div style="display:flex; gap:5px;">
                    <a href="${pt.downloadUrl}?inline=1" target="_blank" style="height:30px; padding:0 8px; background:#f8fafc; border:1px solid #cbd5e1; color:#334155; border-radius:6px; font-size:11px; font-weight:700; text-decoration:none; display:inline-flex; align-items:center;">
                        <i class="fa-solid fa-eye"></i>
                    </a>
                    <a href="${pt.downloadUrl}" download="${pt.filename}" style="flex:1; height:30px; background:#2563eb; color:white; border-radius:6px; font-size:11px; font-weight:700; text-decoration:none; display:inline-flex; align-items:center; justify-content:center; gap:4px;">
                        <i class="fa-solid fa-download"></i> பதிவிறக்கு
                    </a>
                </div>
            </div>
        `).join('');

        return `
            <div style="background:#f8fafc; border:1.5px solid #cbd5e1; border-radius:10px; padding:12px; margin-top:10px;">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
                    <span style="font-size:12.5px; color:#0f172a; font-weight:800;">${headingTitle}</span>
                    <button type="button" onclick="downloadAllSplitParts()" style="height:30px; padding:0 12px; background:#0f172a; color:white; border:none; border-radius:6px; font-size:11.5px; font-weight:800; cursor:pointer;">
                        📥 அனைத்தையும் பதிவிறக்கு
                    </button>
                </div>
                <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(185px, 1fr)); gap:8px;">
                    ${cardsHtml}
                </div>
            </div>
        `;
    }

    window.downloadAllSplitParts = function () {
        const list = window.__lastSplitPartsList || [];
        list.forEach((pt, idx) => {
            setTimeout(() => {
                triggerDownloadUrl(pt.downloadUrl, pt.filename);
            }, idx * 350);
        });
    };

    // =========================================================================
    // TOOL 2: TWO-WAY JPG ⇄ PDF CONVERTER (UPLOAD-PREVIEW-FIRST UI + INLINE FREE CROP)
    // =========================================================================
    let tool2State = {
        direction: 'jpg_to_pdf',
        images: [],
        pdfToJpgPages: [],
        crop: {
            activeIndex: -1,
            imgElement: null,
            rotation: 0,
            cropBox: { x: 40, y: 25, w: 320, h: 240 },
            isDragging: false,
            dragMode: null,
            startX: 0,
            startY: 0,
            startBox: null,
            _lastImageBounds: null
        }
    };

    window.switchTool2Direction = function (dir) {
        tool2State.direction = dir;
        const paneJpgToPdf = document.getElementById('tool2PaneJpgToPdf');
        const panePdfToJpg = document.getElementById('tool2PanePdfToJpg');
        const btnA = document.getElementById('btnTool2DirJpgToPdf');
        const btnB = document.getElementById('btnTool2DirPdfToJpg');

        if (paneJpgToPdf) paneJpgToPdf.style.display = (dir === 'jpg_to_pdf') ? 'block' : 'none';
        if (panePdfToJpg) panePdfToJpg.style.display = (dir === 'pdf_to_jpg') ? 'block' : 'none';

        if (btnA && btnB) {
            if (dir === 'jpg_to_pdf') {
                btnA.style.background = '#059669';
                btnA.style.color = 'white';
                btnB.style.background = 'transparent';
                btnB.style.color = '#475569';
            } else {
                btnB.style.background = '#2563eb';
                btnB.style.color = 'white';
                btnA.style.background = 'transparent';
                btnA.style.color = '#475569';
            }
        }
    };

    window.handleTool2ImagesSelected = function (input) {
        const files = Array.from(input.files || []);
        if (files.length === 0) return;

        const firstAddedIdx = tool2State.images.length;
        let loaded = 0;
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                tool2State.images.push({
                    name: file.name,
                    size: file.size,
                    dataUrl: e.target.result,
                    originalDataUrl: e.target.result,
                    isCropped: false,
                    cropWidth: 0,
                    cropHeight: 0
                });
                loaded++;
                if (loaded === files.length) {
                    renderTool2ImagesList();
                    openTool2ImageCropper(firstAddedIdx);
                }
            };
            reader.readAsDataURL(file);
        });
        input.value = '';
    };

    window.removeTool2Image = function (idx) {
        tool2State.images.splice(idx, 1);
        if (tool2State.crop.activeIndex >= tool2State.images.length) {
            closeTool2ImageCropper();
        }
        renderTool2ImagesList();
    };

    window.moveTool2Image = function (idx, delta) {
        const target = idx + delta;
        if (target < 0 || target >= tool2State.images.length) return;
        const temp = tool2State.images[idx];
        tool2State.images[idx] = tool2State.images[target];
        tool2State.images[target] = temp;
        if (tool2State.crop.activeIndex === idx) tool2State.crop.activeIndex = target;
        else if (tool2State.crop.activeIndex === target) tool2State.crop.activeIndex = idx;
        renderTool2ImagesList();
    };

    window.clearTool2Images = function () {
        tool2State.images = [];
        closeTool2ImageCropper();
        renderTool2ImagesList();
        const res = document.getElementById('tool2JpgToPdfResult');
        if (res) res.innerHTML = '';
    };

    window.restoreTool2ImageByIndex = function (idx) {
        const item = tool2State.images[idx];
        if (!item || !item.originalDataUrl) return;
        item.dataUrl = item.originalDataUrl;
        item.isCropped = false;
        item.cropWidth = 0;
        item.cropHeight = 0;
        renderTool2ImagesList();
        if (tool2State.crop.activeIndex === idx) {
            openTool2ImageCropper(idx);
        }
    };

    function renderTool2ImagesList() {
        const emptyPrompt = document.getElementById('tool2JpgEmptyPrompt');
        const uploadedWrap = document.getElementById('tool2JpgUploadedWrap');
        const grid = document.getElementById('tool2ImagesPreviewGrid');
        const countEl = document.getElementById('tool2ImagesCountBadge');

        const croppedCount = tool2State.images.filter(x => x.isCropped).length;
        if (countEl) {
            countEl.innerText = croppedCount > 0
                ? `${tool2State.images.length} படங்கள் (${croppedCount} கிராப் செய்யப்பட்டது ✅)`
                : `${tool2State.images.length} படங்கள்`;
        }

        if (tool2State.images.length === 0) {
            if (emptyPrompt) emptyPrompt.style.display = 'block';
            if (uploadedWrap) uploadedWrap.style.display = 'none';
            if (grid) grid.innerHTML = '';
            return;
        }

        // Transform Top Box to show uploaded images immediately!
        if (emptyPrompt) emptyPrompt.style.display = 'none';
        if (uploadedWrap) uploadedWrap.style.display = 'flex';
        if (!grid) return;

        grid.innerHTML = tool2State.images.map((img, i) => {
            const isEditing = (tool2State.crop.activeIndex === i);
            const borderColor = isEditing ? '#d97706' : (img.isCropped ? '#10b981' : '#cbd5e1');
            return `
            <div style="background:white; border:2px solid ${borderColor}; border-radius:9px; padding:7px; display:flex; flex-direction:column; gap:5px; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; align-items:center; gap:4px;">
                        <span style="background:#ecfdf5; color:#047857; font-size:10.5px; font-weight:800; padding:1px 6px; border-radius:4px;">#${i + 1}</span>
                        ${img.isCropped ? `<span style="background:#dcfce7; color:#15803d; font-size:9.5px; font-weight:800; padding:1px 5px; border-radius:4px;">✂️ ${img.cropWidth}×${img.cropHeight}</span>` : ''}
                    </div>
                    <div style="display:flex; gap:3px;">
                        <button type="button" onclick="moveTool2Image(${i}, -1)" title="முன்னால் நகர்த்து" style="border:1px solid #cbd5e1; background:#f8fafc; border-radius:4px; width:20px; height:20px; font-size:9px; cursor:pointer;">◀</button>
                        <button type="button" onclick="moveTool2Image(${i}, 1)" title="பின்னால் நகர்த்து" style="border:1px solid #cbd5e1; background:#f8fafc; border-radius:4px; width:20px; height:20px; font-size:9px; cursor:pointer;">▶</button>
                        <button type="button" onclick="removeTool2Image(${i})" title="நீக்கு" style="border:1px solid #fecaca; background:#fef2f2; color:#dc2626; border-radius:4px; width:20px; height:20px; font-size:9px; cursor:pointer;">✕</button>
                    </div>
                </div>
                <img src="${img.dataUrl}" onclick="openTool2ImageCropper(${i})" title="கிராப் செய்ய கிளிக் செய்க" style="width:100%; height:105px; object-fit:contain; background:#f8fafc; border-radius:5px; cursor:pointer; border:1px solid #e2e8f0;">
                <div style="font-size:10.5px; font-weight:700; color:#334155; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${img.name}</div>
                <div style="display:flex; gap:4px;">
                    <button type="button" onclick="openTool2ImageCropper(${i})" style="flex:1; height:27px; background:${img.isCropped ? '#ecfdf5' : '#fffbeb'}; color:${img.isCropped ? '#047857' : '#b45309'}; border:1.5px solid ${img.isCropped ? '#6ee7b7' : '#fcd34d'}; border-radius:6px; font-size:11px; font-weight:800; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; gap:4px;">
                        <i class="fa-solid fa-crop-simple"></i> ${img.isCropped ? 'மீண்டும் கிராப்' : '✂️ கிராப் செய்'}
                    </button>
                    ${img.isCropped ? `<button type="button" onclick="restoreTool2ImageByIndex(${i})" title="அசல் படம் மீட்டமை" style="width:27px; height:27px; background:#f8fafc; color:#475569; border:1px solid #cbd5e1; border-radius:6px; font-size:11px; cursor:pointer;">↺</button>` : ''}
                </div>
            </div>
        `}).join('');
    }

    function renderTool2CropHeaderPills() {
        const pillsWrap = document.getElementById('tool2CropImagePills');
        const titleEl = document.getElementById('tool2CropHeaderTitle');
        const nextBtn = document.getElementById('btnTool2CropAndNext');
        const idx = tool2State.crop.activeIndex;
        const total = tool2State.images.length;

        if (titleEl && idx >= 0 && idx < total) {
            titleEl.innerText = `✂️ படம் #${idx + 1} / ${total} கிராப் செய்க (Free Crop): ${tool2State.images[idx].name}`;
        }
        if (nextBtn) {
            if (total > 1 && idx < total - 1) {
                nextBtn.style.display = 'inline-flex';
                nextBtn.innerHTML = `<i class="fa-solid fa-forward-step"></i> ✅ சேமி & அடுத்த படம் (#${idx + 2}) ➔`;
            } else if (total > 1 && idx === total - 1) {
                nextBtn.style.display = 'inline-flex';
                nextBtn.innerHTML = `<i class="fa-solid fa-check-double"></i> ✅ சேமி & முடி (Finish All)`;
            } else {
                nextBtn.style.display = 'none';
            }
        }
        if (!pillsWrap) return;
        pillsWrap.innerHTML = tool2State.images.map((item, i) => {
            const active = (i === idx);
            return `<button type="button" onclick="openTool2ImageCropper(${i})" style="height:26px; padding:0 9px; border-radius:6px; border:1.5px solid ${active ? '#d97706' : (item.isCropped ? '#10b981' : '#cbd5e1')}; background:${active ? '#f59e0b' : (item.isCropped ? '#ecfdf5' : '#f8fafc')}; color:${active ? '#ffffff' : (item.isCropped ? '#065f46' : '#334155')}; font-size:11px; font-weight:800; cursor:pointer;">
                #${i + 1} ${item.isCropped ? '✓' : ''}
            </button>`;
        }).join('');
    }

    window.openTool2ImageCropper = function (idx) {
        if (!tool2State.images.length) return;
        const safeIdx = Math.max(0, Math.min(tool2State.images.length - 1, Number(idx) || 0));
        const item = tool2State.images[safeIdx];
        if (!item) return;

        tool2State.crop.activeIndex = safeIdx;
        const wrap = document.getElementById('tool2InlineCropWrap');
        if (wrap) wrap.style.display = 'flex';

        const img = new Image();
        img.onload = () => {
            tool2State.crop.imgElement = img;
            tool2State.crop.rotation = 0;
            initTool2CropCanvasEvents();
            resetTool2CropBoxInternal();
            drawTool2CropStage();
            renderTool2CropHeaderPills();
            renderTool2ImagesList();
            if (wrap && typeof wrap.scrollIntoView === 'function') {
                wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        };
        img.src = item.dataUrl;
    };

    window.closeTool2ImageCropper = function () {
        tool2State.crop.activeIndex = -1;
        tool2State.crop.imgElement = null;
        const wrap = document.getElementById('tool2InlineCropWrap');
        if (wrap) wrap.style.display = 'none';
        renderTool2ImagesList();
    };

    window.rotateTool2CropPhoto = function (deg) {
        if (!tool2State.crop.imgElement) return;
        tool2State.crop.rotation = (tool2State.crop.rotation + deg + 360) % 360;
        resetTool2CropBoxInternal();
        drawTool2CropStage();
    };

    window.resetTool2CropBox = function () {
        if (!tool2State.crop.imgElement) return;
        resetTool2CropBoxInternal();
        drawTool2CropStage();
    };

    window.restoreTool2ActiveOriginal = function () {
        const idx = tool2State.crop.activeIndex;
        if (idx < 0 || idx >= tool2State.images.length) return;
        restoreTool2ImageByIndex(idx);
    };

    function resetTool2CropBoxInternal() {
        const canvas = document.getElementById('tool2CropCanvas');
        const img = tool2State.crop.imgElement;
        if (!canvas || !img) return;
        const bounds = getRotatedImageDrawBounds(canvas, img, tool2State.crop.rotation);
        const padX = Math.max(8, Math.round(bounds.dw * 0.06));
        const padY = Math.max(8, Math.round(bounds.dh * 0.06));
        tool2State.crop.cropBox = {
            x: Math.round(bounds.dx + padX),
            y: Math.round(bounds.dy + padY),
            w: Math.max(40, Math.round(bounds.dw - padX * 2)),
            h: Math.max(40, Math.round(bounds.dh - padY * 2))
        };
    }

    function drawTool2CropStage() {
        const canvas = document.getElementById('tool2CropCanvas');
        const img = tool2State.crop.imgElement;
        if (!canvas || !img) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const rot = tool2State.crop.rotation;
        const { dx, dy, dw, dh } = getRotatedImageDrawBounds(canvas, img, rot);

        const off = document.createElement('canvas');
        off.width = canvas.width;
        off.height = canvas.height;
        const octx = off.getContext('2d');
        octx.save();
        octx.translate(canvas.width / 2, canvas.height / 2);
        octx.rotate((rot * Math.PI) / 180);
        if (rot === 90 || rot === 270) {
            octx.drawImage(img, -dh / 2, -dw / 2, dh, dw);
        } else {
            octx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
        }
        octx.restore();
        tool2State.crop._lastImageBounds = { dx, dy, dw, dh };

        // Dimmed outside cropBox
        ctx.drawImage(off, 0, 0);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.62)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Bright inside cropBox
        const { x, y, w, h } = tool2State.crop.cropBox;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();
        ctx.drawImage(off, 0, 0);
        ctx.restore();

        // Border & Rule-of-Thirds Grid
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);

        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + w / 3, y); ctx.lineTo(x + w / 3, y + h);
        ctx.moveTo(x + (2 * w) / 3, y); ctx.lineTo(x + (2 * w) / 3, y + h);
        ctx.moveTo(x, y + h / 3); ctx.lineTo(x + w, y + h / 3);
        ctx.moveTo(x, y + (2 * h) / 3); ctx.lineTo(x + w, y + (2 * h) / 3);
        ctx.stroke();

        // 8 Interactive Handles (4 corners + 4 edges) for effortless Free Crop
        const hs = 10;
        ctx.fillStyle = '#10b981';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        const handles = [
            [x, y], [x + w / 2, y], [x + w, y],
            [x, y + h / 2], [x + w, y + h / 2],
            [x, y + h], [x + w / 2, y + h], [x + w, y + h]
        ];
        handles.forEach(([hx, hy]) => {
            ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
            ctx.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs);
        });

        // Update live pixel dimensions badge
        const dimBadge = document.getElementById('tool2CropDimBadge');
        if (dimBadge && dw > 0 && dh > 0) {
            const isSwap = (rot === 90 || rot === 270);
            const fullW = isSwap ? img.height : img.width;
            const fullH = isSwap ? img.width : img.height;
            const realW = Math.max(20, Math.round((w / dw) * fullW));
            const realH = Math.max(20, Math.round((h / dh) * fullH));
            dimBadge.innerText = `📐 Free Crop: ${realW} × ${realH} px`;
        }
    }

    function initTool2CropCanvasEvents() {
        const canvas = document.getElementById('tool2CropCanvas');
        if (!canvas || canvas.__tool2CropBound) return;
        canvas.__tool2CropBound = true;

        function getPos(e) {
            const rect = canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return {
                x: (clientX - rect.left) * (canvas.width / rect.width),
                y: (clientY - rect.top) * (canvas.height / rect.height)
            };
        }

        function onDown(e) {
            if (!tool2State.crop.imgElement) return;
            const pos = getPos(e);
            const b = tool2State.crop.cropBox;
            const zone = detectCropHitZone(pos, b);

            if (zone) {
                tool2State.crop.dragMode = zone;
            } else {
                // Allow clicking & dragging anywhere outside the box to draw a brand-new Free Crop box!
                tool2State.crop.dragMode = 'draw_new';
                b.x = Math.max(0, Math.min(canvas.width - 20, Math.round(pos.x)));
                b.y = Math.max(0, Math.min(canvas.height - 20, Math.round(pos.y)));
                b.w = 24;
                b.h = 24;
            }

            tool2State.crop.isDragging = true;
            tool2State.crop.startX = pos.x;
            tool2State.crop.startY = pos.y;
            tool2State.crop.startBox = { ...b };
            e.preventDefault();
            drawTool2CropStage();
        }

        function onMove(e) {
            if (!tool2State.crop.imgElement) return;
            const pos = getPos(e);

            if (!tool2State.crop.isDragging) {
                const zone = detectCropHitZone(pos, tool2State.crop.cropBox);
                const cursorMap = {
                    nw: 'nwse-resize', se: 'nwse-resize',
                    ne: 'nesw-resize', sw: 'nesw-resize',
                    n: 'ns-resize', s: 'ns-resize',
                    w: 'ew-resize', e: 'ew-resize',
                    move: 'move'
                };
                canvas.style.cursor = cursorMap[zone] || 'crosshair';
                return;
            }

            const dx = pos.x - tool2State.crop.startX;
            const dy = pos.y - tool2State.crop.startY;
            const sb = tool2State.crop.startBox;
            const b = tool2State.crop.cropBox;
            const minSize = 24;
            const mode = tool2State.crop.dragMode;

            if (mode === 'move') {
                b.x = Math.round(Math.max(0, Math.min(canvas.width - b.w, sb.x + dx)));
                b.y = Math.round(Math.max(0, Math.min(canvas.height - b.h, sb.y + dy)));
            } else if (mode === 'draw_new') {
                const x1 = Math.max(0, Math.min(canvas.width, Math.min(tool2State.crop.startX, pos.x)));
                const y1 = Math.max(0, Math.min(canvas.height, Math.min(tool2State.crop.startY, pos.y)));
                const x2 = Math.max(0, Math.min(canvas.width, Math.max(tool2State.crop.startX, pos.x)));
                const y2 = Math.max(0, Math.min(canvas.height, Math.max(tool2State.crop.startY, pos.y)));
                b.x = Math.round(x1);
                b.y = Math.round(y1);
                b.w = Math.max(minSize, Math.round(x2 - x1));
                b.h = Math.max(minSize, Math.round(y2 - y1));
            } else {
                let nx = sb.x;
                let ny = sb.y;
                let nw = sb.w;
                let nh = sb.h;

                if (mode.includes('e')) nw = Math.max(minSize, Math.min(canvas.width - sb.x, sb.w + dx));
                if (mode.includes('s')) nh = Math.max(minSize, Math.min(canvas.height - sb.y, sb.h + dy));
                if (mode.includes('w')) {
                    const maxDx = sb.w - minSize;
                    const clampedDx = Math.max(-sb.x, Math.min(maxDx, dx));
                    nx = sb.x + clampedDx;
                    nw = sb.w - clampedDx;
                }
                if (mode.includes('n')) {
                    const maxDy = sb.h - minSize;
                    const clampedDy = Math.max(-sb.y, Math.min(maxDy, dy));
                    ny = sb.y + clampedDy;
                    nh = sb.h - clampedDy;
                }

                b.x = Math.round(nx);
                b.y = Math.round(ny);
                b.w = Math.round(nw);
                b.h = Math.round(nh);
            }

            drawTool2CropStage();
        }

        function onUp() {
            tool2State.crop.isDragging = false;
            tool2State.crop.dragMode = null;
        }

        canvas.addEventListener('mousedown', onDown);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        canvas.addEventListener('touchstart', onDown, { passive: false });
        window.addEventListener('touchmove', onMove, { passive: false });
        window.addEventListener('touchend', onUp);
    }

    window.applyTool2ImageCrop = function (goNext = false) {
        const idx = tool2State.crop.activeIndex;
        const img = tool2State.crop.imgElement;
        const bounds = tool2State.crop._lastImageBounds;
        if (idx < 0 || idx >= tool2State.images.length || !img || !bounds) return;

        const rot = tool2State.crop.rotation;
        const b = tool2State.crop.cropBox;
        const isSwap = (rot === 90 || rot === 270);
        const fullW = isSwap ? img.height : img.width;
        const fullH = isSwap ? img.width : img.height;

        const fullOff = document.createElement('canvas');
        fullOff.width = fullW;
        fullOff.height = fullH;
        const fctx = fullOff.getContext('2d');
        fctx.fillStyle = '#ffffff';
        fctx.fillRect(0, 0, fullW, fullH);
        fctx.save();
        fctx.translate(fullW / 2, fullH / 2);
        fctx.rotate((rot * Math.PI) / 180);
        fctx.drawImage(img, -img.width / 2, -img.height / 2);
        fctx.restore();

        const scaleX = fullW / bounds.dw;
        const scaleY = fullH / bounds.dh;
        const sx = Math.max(0, (b.x - bounds.dx) * scaleX);
        const sy = Math.max(0, (b.y - bounds.dy) * scaleY);
        const sw = Math.max(20, Math.min(fullW - sx, b.w * scaleX));
        const sh = Math.max(20, Math.min(fullH - sy, b.h * scaleY));

        const croppedCanvas = document.createElement('canvas');
        croppedCanvas.width = Math.max(20, Math.round(sw));
        croppedCanvas.height = Math.max(20, Math.round(sh));
        const cctx = croppedCanvas.getContext('2d');
        cctx.fillStyle = '#ffffff';
        cctx.fillRect(0, 0, croppedCanvas.width, croppedCanvas.height);
        cctx.drawImage(fullOff, sx, sy, sw, sh, 0, 0, croppedCanvas.width, croppedCanvas.height);

        const croppedDataUrl = croppedCanvas.toDataURL('image/jpeg', 0.94);
        tool2State.images[idx].dataUrl = croppedDataUrl;
        tool2State.images[idx].isCropped = true;
        tool2State.images[idx].cropWidth = croppedCanvas.width;
        tool2State.images[idx].cropHeight = croppedCanvas.height;

        if (typeof showInAppToast === 'function') {
            showInAppToast(`✅ படம் #${idx + 1} கிராப் செய்யப்பட்டது (${croppedCanvas.width}×${croppedCanvas.height} px)`);
        }

        if (goNext) {
            if (idx + 1 < tool2State.images.length) {
                openTool2ImageCropper(idx + 1);
                return;
            } else {
                closeTool2ImageCropper();
                return;
            }
        }

        renderTool2ImagesList();
        renderTool2CropHeaderPills();
        openTool2ImageCropper(idx);
    };

    window.runTool2JpgToPdf = async function () {
        if (tool2State.images.length === 0) {
            if (typeof showInAppToast === 'function') showInAppToast('⚠️ முதலில் மேலே உள்ள பெட்டியில் படங்களை அப்லோட் செய்யவும்.', 'warn');
            return;
        }

        const layoutMode = document.getElementById('tool2LayoutSelect')?.value || 'two_in_one_vertical';
        const targetKb = Number(document.getElementById('tool2TargetKbSelect')?.value) || 200;
        const btn = document.getElementById('btnTool2ConvertJpgToPdf');
        const resBox = document.getElementById('tool2JpgToPdfResult');

        try {
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> உருவாக்கப்படுகிறது...';
            }

            const res = await fetch('/api/tools/jpg-to-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    layoutMode,
                    targetKb,
                    outputName: 'Converted_Document',
                    imageDataUrls: tool2State.images.map(i => i.dataUrl)
                })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'JPG to PDF மாற்றத்தில் பிழை');

            // Immediately auto-trigger PDF download to user's computer
            triggerDownloadUrl(data.output.downloadUrl, data.output.filename);

            if (resBox) {
                resBox.innerHTML = `
                    <div style="background:#f0fdf4; border:1.5px solid #86efac; border-radius:10px; padding:12px 14px; margin-top:10px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                        <div>
                            <div style="font-size:13px; font-weight:800; color:#065f46;">
                                ✅ ${data.output.filename} (${data.output.sizeKb} KB)
                            </div>
                            <div style="font-size:11px; color:#15803d; margin-top:2px;">
                                📥 PDF உங்கள் கணினியில் தானாகப் பதிவிறக்கப்பட்டது!
                            </div>
                        </div>
                        <div style="display:flex; gap:8px;">
                            <a href="${data.output.downloadUrl}?inline=1" target="_blank" style="height:32px; padding:0 12px; background:white; border:1.5px solid #86efac; color:#166534; border-radius:6px; font-size:11.5px; font-weight:700; text-decoration:none; display:inline-flex; align-items:center; gap:5px;">
                                <i class="fa-solid fa-eye"></i> பார்
                            </a>
                            <a href="${data.output.downloadUrl}" download="${data.output.filename}" style="height:32px; padding:0 14px; background:#16a34a; color:white; border-radius:6px; font-size:11.5px; font-weight:800; text-decoration:none; display:inline-flex; align-items:center; gap:5px;">
                                <i class="fa-solid fa-download"></i> PDF பதிவிறக்கு
                            </a>
                        </div>
                    </div>
                `;
            }
        } catch (err) {
            if (resBox) resBox.innerHTML = `<div style="color:#dc2626; font-weight:700; margin-top:8px;">⚠️ பிழை: ${err.message}</div>`;
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-file-pdf"></i> PDF உருவாக்கு';
            }
        }
    };

    // Mode B: PDF to High-Clarity JPG Images
    window.handleTool2PdfToJpgSelected = async function (input) {
        ensurePdfJsWorker();
        const file = input.files && input.files[0];
        if (!file) return;

        const emptyPrompt = document.getElementById('tool2PdfEmptyPrompt');
        const uploadedWrap = document.getElementById('tool2PdfUploadedWrap');
        const grid = document.getElementById('tool2PdfToJpgGrid');
        const statusEl = document.getElementById('tool2PdfToJpgStatus');
        const actionsBar = document.getElementById('tool2PdfToJpgBulkBar');
        const scaleVal = Number(document.getElementById('tool2PdfDpiSelect')?.value) || 2.0;

        if (emptyPrompt) emptyPrompt.style.display = 'none';
        if (uploadedWrap) uploadedWrap.style.display = 'flex';
        tool2State.pdfToJpgPages = [];
        if (grid) grid.innerHTML = '';
        if (actionsBar) actionsBar.style.display = 'none';
        if (statusEl) statusEl.innerText = '⏳ PDF பக்கங்கள் JPG படங்களாக மாற்றப்படுகின்றன...';

        try {
            const arrayBuf = await file.arrayBuffer();
            const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(arrayBuf) }).promise;
            const baseName = file.name.replace(/\.pdf$/i, '');

            for (let p = 1; p <= pdf.numPages; p++) {
                if (statusEl) statusEl.innerText = `⏳ பக்கம் ${p} / ${pdf.numPages} மாற்றப்படுகிறது...`;
                const page = await pdf.getPage(p);
                const vp = page.getViewport({ scale: scaleVal });
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(vp.width);
                canvas.height = Math.round(vp.height);
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                await page.render({ canvasContext: ctx, viewport: vp }).promise;

                const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
                const fname = `${baseName}_Page_${p}.jpg`;
                tool2State.pdfToJpgPages.push({
                    pageNum: p,
                    dataUrl,
                    filename: fname,
                    width: canvas.width,
                    height: canvas.height
                });
            }

            if (statusEl) {
                statusEl.innerHTML = `✅ ${file.name} (${pdf.numPages} JPG பக்கங்கள்)`;
            }
            if (actionsBar) actionsBar.style.display = 'flex';

            if (grid) {
                grid.innerHTML = tool2State.pdfToJpgPages.map(item => `
                    <div style="background:white; border:1.5px solid #cbd5e1; border-radius:8px; padding:8px; display:flex; flex-direction:column; gap:6px;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="background:#eff6ff; color:#1d4ed8; font-size:10.5px; font-weight:800; padding:2px 6px; border-radius:4px;">பக்கம் ${item.pageNum}</span>
                            <span style="font-size:10px; color:#64748b;">${item.width}×${item.height}</span>
                        </div>
                        <img src="${item.dataUrl}" style="width:100%; height:130px; object-fit:contain; background:#f8fafc; border-radius:4px; border:1px solid #e2e8f0;">
                        <a href="${item.dataUrl}" download="${item.filename}" style="height:30px; background:#2563eb; color:white; border-radius:6px; font-size:11px; font-weight:700; text-decoration:none; display:flex; align-items:center; justify-content:center; gap:4px;">
                            <i class="fa-solid fa-download"></i> JPG பதிவிறக்கு
                        </a>
                    </div>
                `).join('');
            }
        } catch (err) {
            console.error('PDF to JPG error:', err);
            if (statusEl) statusEl.innerHTML = `<span style="color:#dc2626; font-weight:700;">⚠️ பிழை: ${err.message}</span>`;
        }
    };

    window.downloadAllPdfToJpgPages = function () {
        tool2State.pdfToJpgPages.forEach((p, idx) => {
            setTimeout(() => {
                triggerDownloadUrl(p.dataUrl, p.filename);
            }, idx * 300);
        });
    };

    window.mergeFirstTwoPdfPagesAsSingleJpg = function () {
        if (tool2State.pdfToJpgPages.length < 2) {
            if (typeof showInAppToast === 'function') showInAppToast('⚠️ இணைக்க குறைந்தது 2 பக்கங்கள் தேவை.', 'warn');
            return;
        }
        const p1 = tool2State.pdfToJpgPages[0];
        const p2 = tool2State.pdfToJpgPages[1];
        const img1 = new Image();
        const img2 = new Image();
        img1.onload = () => {
            img2.onload = () => {
                const c = document.createElement('canvas');
                const w = Math.max(img1.width, img2.width);
                const pad = 24;
                c.width = w + pad * 2;
                c.height = img1.height + img2.height + pad * 3;
                const ctx = c.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, c.width, c.height);
                ctx.drawImage(img1, pad + (w - img1.width) / 2, pad);
                ctx.drawImage(img2, pad + (w - img2.width) / 2, pad * 2 + img1.height);
                const mergedUrl = c.toDataURL('image/jpeg', 0.90);
                triggerDownloadUrl(mergedUrl, 'Merged_2_in_1_Pages.jpg');
            };
            img2.src = p2.dataUrl;
        };
        img1.src = p1.dataUrl;
    };

    // =========================================================================
    // TOOL 3: PHOTO CROPPER (8-HANDLE MOUSE DRAG/RESIZE + ICON-ONLY TOOLBAR)
    // =========================================================================
    let tool3State = {
        imgElement: null,
        rotation: 0,
        cropBox: { x: 60, y: 30, w: 220, h: 250 },
        aspectRatio: null, // Free mouse crop by default so user can resize any edge/corner freely!
        isDragging: false,
        dragMode: null, // 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'w' | 'e'
        startX: 0,
        startY: 0,
        startBox: null,
        presetLabel: 'Custom_Crop'
    };

    window.handleTool3PhotoSelected = function (input) {
        const file = input.files && input.files[0];
        if (!file) return;

        const emptyPrompt = document.getElementById('tool3EmptyPrompt');
        const stageWrap = document.getElementById('tool3CropStageWrap');

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                if (emptyPrompt) emptyPrompt.style.display = 'none';
                if (stageWrap) stageWrap.style.display = 'flex';
                tool3State.imgElement = img;
                tool3State.rotation = 0;
                initPhotoCropCanvasEvents();
                resetTool3CropBoxForCurrentAspect();
                drawTool3CropStage();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    };

    window.resetTool3CropBox = function () {
        if (!tool3State.imgElement) return;
        resetTool3CropBoxForCurrentAspect();
        drawTool3CropStage();
    };

    window.applyTool3Preset = function (presetKey, btnEl) {
        document.querySelectorAll('.tool3-preset-pill').forEach(b => {
            b.style.background = '#ffffff';
            b.style.color = '#334155';
            b.style.borderColor = '#cbd5e1';
            b.style.fontWeight = '700';
        });
        if (btnEl) {
            btnEl.style.background = '#ecfdf5';
            btnEl.style.color = '#065f46';
            btnEl.style.borderColor = '#10b981';
            btnEl.style.fontWeight = '800';
        }

        const wInput = document.getElementById('tool3WidthInput');
        const hInput = document.getElementById('tool3HeightInput');
        const kbInput = document.getElementById('tool3TargetKbInput');

        if (presetKey === 'tnpds_photo') {
            if (wInput) wInput.value = 200;
            if (hInput) hInput.value = 230;
            if (kbInput) kbInput.value = 20;
            tool3State.aspectRatio = 200 / 230;
            tool3State.presetLabel = 'TNPDS_Photo_20KB';
        } else if (presetKey === 'tnega_photo') {
            if (wInput) wInput.value = 200;
            if (hInput) hInput.value = 230;
            if (kbInput) kbInput.value = 50;
            tool3State.aspectRatio = 200 / 230;
            tool3State.presetLabel = 'TNeGA_Photo_50KB';
        } else if (presetKey === 'passport_std') {
            if (wInput) wInput.value = 413;
            if (hInput) hInput.value = 531;
            if (kbInput) kbInput.value = 50;
            tool3State.aspectRatio = 35 / 45;
            tool3State.presetLabel = 'Passport_3.5x4.5cm';
        } else if (presetKey === 'signature') {
            if (wInput) wInput.value = 140;
            if (hInput) hInput.value = 60;
            if (kbInput) kbInput.value = 20;
            tool3State.aspectRatio = 140 / 60;
            tool3State.presetLabel = 'Signature_20KB';
        } else if (presetKey === 'pan_photo') {
            if (wInput) wInput.value = 213;
            if (hInput) hInput.value = 213;
            if (kbInput) kbInput.value = 50;
            tool3State.aspectRatio = 1;
            tool3State.presetLabel = 'PAN_Photo_213x213';
        } else {
            tool3State.aspectRatio = null;
            tool3State.presetLabel = 'Custom_Crop';
        }

        resetTool3CropBoxForCurrentAspect();
        drawTool3CropStage();
    };

    window.rotateTool3Photo = function (deg) {
        if (!tool3State.imgElement) return;
        tool3State.rotation = (tool3State.rotation + deg + 360) % 360;
        resetTool3CropBoxForCurrentAspect();
        drawTool3CropStage();
    };

    function resetTool3CropBoxForCurrentAspect() {
        const canvas = document.getElementById('tool3CropCanvas');
        if (!canvas) return;
        const cw = canvas.width || 520;
        const ch = canvas.height || 330;
        const ratio = tool3State.aspectRatio || (4 / 3);
        let bw = cw * 0.58;
        let bh = bw / ratio;
        if (bh > ch * 0.76) {
            bh = ch * 0.76;
            bw = bh * ratio;
        }
        tool3State.cropBox = {
            x: Math.round((cw - bw) / 2),
            y: Math.round((ch - bh) / 2),
            w: Math.round(bw),
            h: Math.round(bh)
        };
    }

    function getRotatedImageDrawBounds(canvas, img, rotation) {
        const isSwap = (rotation === 90 || rotation === 270);
        const iw = isSwap ? img.height : img.width;
        const ih = isSwap ? img.width : img.height;
        const pad = 16;
        const availW = canvas.width - pad * 2;
        const availH = canvas.height - pad * 2;
        const scale = Math.min(availW / iw, availH / ih);
        const dw = iw * scale;
        const dh = ih * scale;
        const dx = (canvas.width - dw) / 2;
        const dy = (canvas.height - dh) / 2;
        return { dx, dy, dw, dh, iw, ih };
    }

    function drawTool3CropStage() {
        const canvas = document.getElementById('tool3CropCanvas');
        if (!canvas || !tool3State.imgElement) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const img = tool3State.imgElement;
        const rot = tool3State.rotation;
        const { dx, dy, dw, dh } = getRotatedImageDrawBounds(canvas, img, rot);

        const off = document.createElement('canvas');
        off.width = canvas.width;
        off.height = canvas.height;
        const octx = off.getContext('2d');
        octx.save();
        octx.translate(canvas.width / 2, canvas.height / 2);
        octx.rotate((rot * Math.PI) / 180);
        if (rot === 90 || rot === 270) {
            octx.drawImage(img, -dh / 2, -dw / 2, dh, dw);
        } else {
            octx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
        }
        octx.restore();
        tool3State._lastOffscreenCanvas = off;
        tool3State._lastImageBounds = { dx, dy, dw, dh };

        // Dimmed outside
        ctx.drawImage(off, 0, 0);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.62)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Bright inside cropBox
        const { x, y, w, h } = tool3State.cropBox;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();
        ctx.drawImage(off, 0, 0);
        ctx.restore();

        // Border & grid
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);

        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + w / 3, y); ctx.lineTo(x + w / 3, y + h);
        ctx.moveTo(x + (2 * w) / 3, y); ctx.lineTo(x + (2 * w) / 3, y + h);
        ctx.moveTo(x, y + h / 3); ctx.lineTo(x + w, y + h / 3);
        ctx.moveTo(x, y + (2 * h) / 3); ctx.lineTo(x + w, y + (2 * h) / 3);
        ctx.stroke();

        // Draw 8 Interactive Handles (4 corners + 4 mid-edges) so mouse resizing is effortless
        const hs = 10;
        ctx.fillStyle = '#10b981';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        const handles = [
            [x, y],                 // NW
            [x + w / 2, y],         // N
            [x + w, y],             // NE
            [x, y + h / 2],         // W
            [x + w, y + h / 2],     // E
            [x, y + h],             // SW
            [x + w / 2, y + h],     // S
            [x + w, y + h]          // SE
        ];
        handles.forEach(([hx, hy]) => {
            ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
            ctx.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs);
        });
    }

    function detectCropHitZone(pos, b) {
        const pad = 14;
        const nearL = Math.abs(pos.x - b.x) <= pad;
        const nearR = Math.abs(pos.x - (b.x + b.w)) <= pad;
        const nearT = Math.abs(pos.y - b.y) <= pad;
        const nearB = Math.abs(pos.y - (b.y + b.h)) <= pad;
        const midX = Math.abs(pos.x - (b.x + b.w / 2)) <= pad;
        const midY = Math.abs(pos.y - (b.y + b.h / 2)) <= pad;

        if (nearL && nearT) return 'nw';
        if (nearR && nearT) return 'ne';
        if (nearL && nearB) return 'sw';
        if (nearR && nearB) return 'se';
        if (nearT && (midX || (pos.x > b.x && pos.x < b.x + b.w))) return 'n';
        if (nearB && (midX || (pos.x > b.x && pos.x < b.x + b.w))) return 's';
        if (nearL && (midY || (pos.y > b.y && pos.y < b.y + b.h))) return 'w';
        if (nearR && (midY || (pos.y > b.y && pos.y < b.y + b.h))) return 'e';
        if (pos.x >= b.x && pos.x <= b.x + b.w && pos.y >= b.y && pos.y <= b.y + b.h) return 'move';
        return null;
    }

    function initPhotoCropCanvasEvents() {
        const canvas = document.getElementById('tool3CropCanvas');
        if (!canvas || canvas.__cropEventsBound) return;
        canvas.__cropEventsBound = true;

        function getPos(e) {
            const rect = canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return {
                x: (clientX - rect.left) * (canvas.width / rect.width),
                y: (clientY - rect.top) * (canvas.height / rect.height)
            };
        }

        function onDown(e) {
            if (!tool3State.imgElement) return;
            const pos = getPos(e);
            const b = tool3State.cropBox;
            const zone = detectCropHitZone(pos, b);

            if (zone) {
                tool3State.dragMode = zone;
            } else {
                // Click outside box recenters box at mouse position
                b.x = Math.max(0, Math.min(canvas.width - b.w, pos.x - b.w / 2));
                b.y = Math.max(0, Math.min(canvas.height - b.h, pos.y - b.h / 2));
                tool3State.dragMode = 'move';
            }

            tool3State.isDragging = true;
            tool3State.startX = pos.x;
            tool3State.startY = pos.y;
            tool3State.startBox = { ...b };
            e.preventDefault();
            drawTool3CropStage();
        }

        function onMove(e) {
            if (!tool3State.imgElement) return;
            const pos = getPos(e);

            if (!tool3State.isDragging) {
                const zone = detectCropHitZone(pos, tool3State.cropBox);
                const cursorMap = {
                    nw: 'nwse-resize', se: 'nwse-resize',
                    ne: 'nesw-resize', sw: 'nesw-resize',
                    n: 'ns-resize', s: 'ns-resize',
                    w: 'ew-resize', e: 'ew-resize',
                    move: 'move'
                };
                canvas.style.cursor = cursorMap[zone] || 'crosshair';
                return;
            }

            const dx = pos.x - tool3State.startX;
            const dy = pos.y - tool3State.startY;
            const sb = tool3State.startBox;
            const b = tool3State.cropBox;
            const minSize = 36;
            const mode = tool3State.dragMode;

            if (mode === 'move') {
                b.x = Math.max(0, Math.min(canvas.width - b.w, sb.x + dx));
                b.y = Math.max(0, Math.min(canvas.height - b.h, sb.y + dy));
            } else {
                let nx = sb.x;
                let ny = sb.y;
                let nw = sb.w;
                let nh = sb.h;

                if (mode.includes('e')) nw = Math.max(minSize, Math.min(canvas.width - sb.x, sb.w + dx));
                if (mode.includes('s')) nh = Math.max(minSize, Math.min(canvas.height - sb.y, sb.h + dy));
                if (mode.includes('w')) {
                    const maxDx = sb.w - minSize;
                    const clampedDx = Math.max(-sb.x, Math.min(maxDx, dx));
                    nx = sb.x + clampedDx;
                    nw = sb.w - clampedDx;
                }
                if (mode.includes('n')) {
                    const maxDy = sb.h - minSize;
                    const clampedDy = Math.max(-sb.y, Math.min(maxDy, dy));
                    ny = sb.y + clampedDy;
                    nh = sb.h - clampedDy;
                }

                if (tool3State.aspectRatio) {
                    if (mode === 'n' || mode === 's') {
                        nw = nh * tool3State.aspectRatio;
                    } else {
                        nh = nw / tool3State.aspectRatio;
                    }
                    if (nx + nw > canvas.width) {
                        nw = canvas.width - nx;
                        nh = nw / tool3State.aspectRatio;
                    }
                    if (ny + nh > canvas.height) {
                        nh = canvas.height - ny;
                        nw = nh * tool3State.aspectRatio;
                    }
                }

                b.x = Math.round(nx);
                b.y = Math.round(ny);
                b.w = Math.round(nw);
                b.h = Math.round(nh);

                // In Free Crop mode, update W & H inputs live to reflect the cropped aspect/size
                if (!tool3State.aspectRatio && tool3State._lastImageBounds) {
                    const bounds = tool3State._lastImageBounds;
                    const isSwap = (tool3State.rotation === 90 || tool3State.rotation === 270);
                    const fullW = isSwap ? tool3State.imgElement.height : tool3State.imgElement.width;
                    const fullH = isSwap ? tool3State.imgElement.width : tool3State.imgElement.height;
                    const realW = Math.max(40, Math.round((b.w / bounds.dw) * fullW));
                    const realH = Math.max(40, Math.round((b.h / bounds.dh) * fullH));
                    const wIn = document.getElementById('tool3WidthInput');
                    const hIn = document.getElementById('tool3HeightInput');
                    if (wIn) wIn.value = realW;
                    if (hIn) hIn.value = realH;
                }
            }

            drawTool3CropStage();
        }

        function onUp() {
            tool3State.isDragging = false;
            tool3State.dragMode = null;
        }

        canvas.addEventListener('mousedown', onDown);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        canvas.addEventListener('touchstart', onDown, { passive: false });
        window.addEventListener('touchmove', onMove, { passive: false });
        window.addEventListener('touchend', onUp);
    }

    window.runTool3CropAndResize = async function () {
        if (!tool3State.imgElement) {
            if (typeof showInAppToast === 'function') showInAppToast('⚠️ முதலில் மேலே உள்ள பெட்டியில் புகைப்படத்தை அப்லோட் செய்யவும்.', 'warn');
            return;
        }

        const bounds = tool3State._lastImageBounds;
        const img = tool3State.imgElement;
        const rot = tool3State.rotation;
        const b = tool3State.cropBox;

        const isSwap = (rot === 90 || rot === 270);
        const fullW = isSwap ? img.height : img.width;
        const fullH = isSwap ? img.width : img.height;

        const fullOff = document.createElement('canvas');
        fullOff.width = fullW;
        fullOff.height = fullH;
        const fctx = fullOff.getContext('2d');
        fctx.fillStyle = '#ffffff';
        fctx.fillRect(0, 0, fullW, fullH);
        fctx.save();
        fctx.translate(fullW / 2, fullH / 2);
        fctx.rotate((rot * Math.PI) / 180);
        fctx.drawImage(img, -img.width / 2, -img.height / 2);
        fctx.restore();

        const scaleX = fullW / bounds.dw;
        const scaleY = fullH / bounds.dh;
        const sx = Math.max(0, (b.x - bounds.dx) * scaleX);
        const sy = Math.max(0, (b.y - bounds.dy) * scaleY);
        const sw = Math.min(fullW - sx, b.w * scaleX);
        const sh = Math.min(fullH - sy, b.h * scaleY);

        const croppedCanvas = document.createElement('canvas');
        croppedCanvas.width = Math.max(40, Math.round(sw));
        croppedCanvas.height = Math.max(40, Math.round(sh));
        const cctx = croppedCanvas.getContext('2d');
        cctx.fillStyle = '#ffffff';
        cctx.fillRect(0, 0, croppedCanvas.width, croppedCanvas.height);
        cctx.drawImage(fullOff, sx, sy, sw, sh, 0, 0, croppedCanvas.width, croppedCanvas.height);

        const croppedDataUrl = croppedCanvas.toDataURL('image/png');
        const targetWidth = Number(document.getElementById('tool3WidthInput')?.value) || 200;
        const targetHeight = Number(document.getElementById('tool3HeightInput')?.value) || 230;
        const targetKb = Number(document.getElementById('tool3TargetKbInput')?.value) || 20;
        const btn = document.getElementById('btnTool3ProcessNow');
        const resBox = document.getElementById('tool3ResultContainer');

        try {
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> சுருக்கப்படுகிறது...';
            }

            const res = await fetch('/api/tools/photo-process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageDataUrl: croppedDataUrl,
                    width: targetWidth,
                    height: targetHeight,
                    targetKb,
                    fitMode: 'fill',
                    format: 'jpeg',
                    presetLabel: tool3State.presetLabel || 'Photo'
                })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'புகைப்படம் சுருக்குவதில் பிழை');

            if (resBox) {
                resBox.innerHTML = `
                    <div style="background:#f0fdf4; border:1.5px solid #86efac; border-radius:10px; padding:12px 14px; display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap;">
                        <div style="display:flex; align-items:center; gap:12px;">
                            <img src="${data.dataUrl}" style="width:74px; height:86px; object-fit:contain; background:white; border:2px solid #16a34a; border-radius:6px; padding:2px;">
                            <div>
                                <div style="font-size:13px; font-weight:800; color:#065f46;">
                                    ✅ தயார்: ${data.width} × ${data.height} px • <span style="background:#dcfce7; padding:2px 7px; border-radius:5px;">${data.sizeKb} KB</span>
                                </div>
                            </div>
                        </div>
                        <a href="${data.output.downloadUrl}" download="${data.output.filename}" style="height:34px; padding:0 16px; background:#16a34a; color:white; border-radius:8px; font-size:12px; font-weight:800; text-decoration:none; display:inline-flex; align-items:center; gap:6px;">
                            <i class="fa-solid fa-download"></i> போட்டோ பதிவிறக்கு (${data.sizeKb} KB)
                        </a>
                    </div>
                `;
            }
        } catch (err) {
            if (resBox) resBox.innerHTML = `<div style="color:#dc2626; font-weight:700;">⚠️ பிழை: ${err.message}</div>`;
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-crop-simple"></i> கிராப் & சுருக்கு';
            }
        }
    };

    // =========================================================================
    // TOOL 4: DIGITAL SIGNATURE (1. DRAW, 2. TYPE, 3. PHOTO UPLOAD)
    // =========================================================================
    let tool4State = {
        mode: 'draw', // 'draw' | 'type' | 'upload'
        penColor: '#0f2996',
        penWidth: 3.2,
        isDrawing: false,
        selectedTypedStyleIdx: 0,
        activeSignatureDataUrl: null
    };

    const TYPED_SIGNATURE_STYLES = [
        { label: 'Classic Cursive', font: 'italic 44px "Brush Script MT", "Segoe Script", "Lucida Handwriting", cursive' },
        { label: 'Executive Script', font: 'italic 700 38px "Segoe Script", "Comic Sans MS", cursive' },
        { label: 'Official Serif', font: 'italic 700 40px Georgia, "Times New Roman", serif' },
        { label: 'Fluent Pen', font: 'italic 600 40px "Lucida Handwriting", "Palatino Linotype", cursive' }
    ];

    window.switchTool4SigMode = function (mode) {
        tool4State.mode = mode;
        const panes = {
            draw: document.getElementById('tool4PaneDraw'),
            type: document.getElementById('tool4PaneType'),
            upload: document.getElementById('tool4PaneUpload')
        };
        const btns = {
            draw: document.getElementById('btnTool4ModeDraw'),
            type: document.getElementById('btnTool4ModeType'),
            upload: document.getElementById('btnTool4ModeUpload')
        };

        Object.keys(panes).forEach(k => {
            if (panes[k]) panes[k].style.display = (k === mode) ? 'block' : 'none';
            if (btns[k]) {
                if (k === mode) {
                    btns[k].style.background = '#7e22ce';
                    btns[k].style.color = '#ffffff';
                } else {
                    btns[k].style.background = 'transparent';
                    btns[k].style.color = '#475569';
                }
            }
        });

        if (mode === 'type') {
            const input = document.getElementById('tool4TypeSigInput');
            window.renderTypedSignatures(input && input.value ? input.value : '');
        }
    };

    function createTypedSignatureDataUrl(text, fontSpec, color) {
        const c = document.createElement('canvas');
        c.width = 520;
        c.height = 150;
        const ctx = c.getContext('2d');
        ctx.clearRect(0, 0, c.width, c.height);

        ctx.save();
        ctx.font = fontSpec;
        ctx.fillStyle = color || '#0f2996';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // Slight natural slant for realistic signature look
        ctx.translate(c.width / 2, c.height / 2 - 4);
        ctx.rotate(-0.04);
        ctx.fillText(text, 0, 0);

        // Subtle signature flourish underline
        const textWidth = Math.min(440, Math.max(120, ctx.measureText(text).width));
        ctx.beginPath();
        ctx.strokeStyle = color || '#0f2996';
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.moveTo(-textWidth * 0.45, 26);
        ctx.quadraticCurveTo(0, 18, textWidth * 0.48, 28);
        ctx.stroke();
        ctx.restore();

        return c.toDataURL('image/png');
    }

    window.renderTypedSignatures = function (rawText) {
        const grid = document.getElementById('tool4TypedStylesGrid');
        if (!grid) return;
        const text = (rawText || '').trim();
        const displayStr = text || 'Kumaran K';

        grid.innerHTML = '';
        TYPED_SIGNATURE_STYLES.forEach((st, idx) => {
            const dataUrl = createTypedSignatureDataUrl(displayStr, st.font, tool4State.penColor);
            const isSelected = (idx === tool4State.selectedTypedStyleIdx);

            const card = document.createElement('div');
            card.style.cssText = `background:white; border:2px solid ${isSelected ? '#7e22ce' : '#cbd5e1'}; border-radius:10px; padding:8px; cursor:pointer; text-align:center; transition:all 0.15s; box-shadow:${isSelected ? '0 3px 10px rgba(126,34,206,0.18)' : 'none'};`;
            card.onclick = () => {
                tool4State.selectedTypedStyleIdx = idx;
                tool4State.activeSignatureDataUrl = dataUrl;
                updateActiveSignaturePreview(dataUrl);
                window.renderTypedSignatures(rawText);
            };

            const img = document.createElement('img');
            img.src = dataUrl;
            img.style.cssText = 'width:100%; height:68px; object-fit:contain; display:block;';
            card.appendChild(img);

            const lbl = document.createElement('div');
            lbl.style.cssText = `font-size:10.5px; font-weight:800; color:${isSelected ? '#7e22ce' : '#64748b'}; margin-top:2px;`;
            lbl.innerText = isSelected ? `✓ ${st.label}` : st.label;
            card.appendChild(lbl);

            grid.appendChild(card);

            if (isSelected && text) {
                tool4State.activeSignatureDataUrl = dataUrl;
                updateActiveSignaturePreview(dataUrl);
            }
        });
    };

    function initSignaturePadEvents() {
        const pad = document.getElementById('tool4SigDrawCanvas');
        if (!pad || pad.__sigEventsBound) return;
        pad.__sigEventsBound = true;

        const ctx = pad.getContext('2d');
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        function getPt(e) {
            const r = pad.getBoundingClientRect();
            const cx = e.touches ? e.touches[0].clientX : e.clientX;
            const cy = e.touches ? e.touches[0].clientY : e.clientY;
            return {
                x: (cx - r.left) * (pad.width / r.width),
                y: (cy - r.top) * (pad.height / r.height)
            };
        }

        function startDraw(e) {
            tool4State.isDrawing = true;
            const pt = getPt(e);
            ctx.beginPath();
            ctx.moveTo(pt.x, pt.y);
            e.preventDefault();
        }

        function moveDraw(e) {
            if (!tool4State.isDrawing) return;
            const pt = getPt(e);
            ctx.strokeStyle = tool4State.penColor;
            ctx.lineWidth = tool4State.penWidth;
            ctx.lineTo(pt.x, pt.y);
            ctx.stroke();
            e.preventDefault();
        }

        function endDraw() {
            if (!tool4State.isDrawing) return;
            tool4State.isDrawing = false;
            tool4State.activeSignatureDataUrl = pad.toDataURL('image/png');
            updateActiveSignaturePreview(tool4State.activeSignatureDataUrl);
        }

        pad.addEventListener('mousedown', startDraw);
        pad.addEventListener('mousemove', moveDraw);
        window.addEventListener('mouseup', endDraw);
        pad.addEventListener('touchstart', startDraw, { passive: false });
        pad.addEventListener('touchmove', moveDraw, { passive: false });
        window.addEventListener('touchend', endDraw);
    }

    window.setTool4PenColor = function (color, btnEl) {
        tool4State.penColor = color;
        document.querySelectorAll('.tool4-pen-btn').forEach(b => {
            b.style.outline = 'none';
            b.style.transform = 'scale(1)';
        });
        if (btnEl) {
            btnEl.style.outline = '3px solid #10b981';
            btnEl.style.transform = 'scale(1.1)';
        }
        if (tool4State.mode === 'type') {
            const input = document.getElementById('tool4TypeSigInput');
            window.renderTypedSignatures(input ? input.value : '');
        }
    };

    window.clearTool4SignaturePad = function () {
        const pad = document.getElementById('tool4SigDrawCanvas');
        if (pad) {
            const ctx = pad.getContext('2d');
            ctx.clearRect(0, 0, pad.width, pad.height);
        }
        const typeInput = document.getElementById('tool4TypeSigInput');
        if (typeInput) typeInput.value = '';
        if (tool4State.mode === 'type') {
            window.renderTypedSignatures('');
        }
        tool4State.activeSignatureDataUrl = null;
        updateActiveSignaturePreview(null);
    };

    window.downloadActiveTransparentSignature = function () {
        if (!tool4State.activeSignatureDataUrl) {
            if (typeof showInAppToast === 'function') showInAppToast('⚠️ முதலில் கையொப்பம் வரையவும், டைப் செய்யவும் அல்லது போட்டோ அப்லோட் செய்யவும்.', 'warn');
            return;
        }
        triggerDownloadUrl(tool4State.activeSignatureDataUrl, 'Digital_Signature_Transparent.png');
    };

    window.downloadActiveSignatureAsGovtJpg = async function () {
        if (!tool4State.activeSignatureDataUrl) {
            if (typeof showInAppToast === 'function') showInAppToast('⚠️ முதலில் கையொப்பம் வரையவும், டைப் செய்யவும் அல்லது போட்டோ அப்லோட் செய்யவும்.', 'warn');
            return;
        }
        try {
            // Composite transparent PNG onto pure white canvas first
            const img = new Image();
            await new Promise((resolve) => {
                img.onload = resolve;
                img.src = tool4State.activeSignatureDataUrl;
            });
            const c = document.createElement('canvas');
            c.width = img.width || 420;
            c.height = img.height || 140;
            const ctx = c.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, c.width, c.height);
            ctx.drawImage(img, 0, 0);

            const res = await fetch('/api/tools/photo-process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageDataUrl: c.toDataURL('image/png'),
                    width: 140,
                    height: 60,
                    targetKb: 20,
                    fitMode: 'contain',
                    format: 'jpeg',
                    presetLabel: 'Signature_20KB'
                })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'JPG மாற்றத்தில் பிழை');
            triggerDownloadUrl(data.output.downloadUrl, data.output.filename);
        } catch (err) {
            if (typeof showInAppToast === 'function') showInAppToast('⚠️ பிழை: ' + err.message, 'error');
        }
    };

    // Upload a photo of a signature on white paper -> Auto-extract transparent PNG
    window.handleTool4WhitePaperSigUpload = async function (input) {
        const file = input && input.files ? input.files[0] : window.__lastUploadedSigFile;
        if (!file) return;
        window.__lastUploadedSigFile = file;

        const inkColor = document.getElementById('tool4CleanInkSelect')?.value || 'blue';
        const threshold = Number(document.getElementById('tool4CleanThresholdRange')?.value) || 180;
        const statusEl = document.getElementById('tool4CleanSigStatus');

        try {
            if (statusEl) statusEl.innerText = '✨ வெள்ளை பின்னணி நீக்கப்படுகிறது...';
            const fd = new FormData();
            fd.append('signature', file);
            fd.append('inkColor', inkColor);
            fd.append('threshold', String(threshold));

            const res = await fetch('/api/tools/signature-clean', {
                method: 'POST',
                body: fd
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'கையொப்பம் பிரிப்பதில் பிழை');

            tool4State.activeSignatureDataUrl = data.dataUrl;
            updateActiveSignaturePreview(data.dataUrl);
            if (statusEl) {
                statusEl.innerHTML = `<span style="color:#15803d; font-weight:800;">✅ வெள்ளை பின்னணி நீக்கப்பட்டது (${data.sizeKb} KB)</span>`;
            }
        } catch (err) {
            if (statusEl) statusEl.innerHTML = `<span style="color:#dc2626; font-weight:700;">⚠️ பிழை: ${err.message}</span>`;
        }
    };

    function updateActiveSignaturePreview(dataUrl) {
        const previewImg = document.getElementById('tool4ActiveSigPreviewImg');
        const emptyHint = document.getElementById('tool4ActiveSigEmptyHint');
        if (previewImg && emptyHint) {
            if (dataUrl) {
                previewImg.src = dataUrl;
                previewImg.style.display = 'block';
                emptyHint.style.display = 'none';
            } else {
                previewImg.style.display = 'none';
                emptyHint.style.display = 'block';
            }
        }

        if (dataUrl) {
            const sImg = new Image();
            sImg.onload = () => {
                tool4State.sigImgObj = sImg;
                if (tool4State.docPages && tool4State.docPages.length > 0) {
                    const activePg = tool4State.docPages[tool4State.activePageIndex || 0];
                    if (activePg) {
                        if (!activePg.placements || activePg.placements.length === 0) {
                            ensureDefaultPlacementOnPage(activePg);
                        } else {
                            const selIdx = activePg.selectedPlacementIdx >= 0 ? activePg.selectedPlacementIdx : 0;
                            if (activePg.placements[selIdx]) {
                                activePg.placements[selIdx].sigDataUrl = dataUrl;
                                activePg.placements[selIdx].sigImg = sImg;
                            }
                        }
                    }
                    drawTool4DocSignStage();
                }
            };
            sImg.src = dataUrl;
        } else {
            tool4State.sigImgObj = null;
            if (tool4State.docPages && tool4State.docPages.length > 0) {
                drawTool4DocSignStage();
            }
        }
    }

    // =========================================================================
    // TOOL 4 PART B: DOCUMENT UPLOAD, INTERACTIVE SIGNATURE PLACEMENT & FULL DOWNLOAD
    // =========================================================================
    tool4State.docFileName = 'Signed_Document';
    tool4State.docPages = [];
    tool4State.activePageIndex = 0;
    tool4State.sigImgObj = null;
    tool4State.docDrag = {
        isDragging: false,
        mode: null,
        startX: 0,
        startY: 0,
        startBox: null
    };

    function ensureDefaultPlacementOnPage(pageObj) {
        if (!pageObj) return;
        if (!pageObj.placements) pageObj.placements = [];
        const canvas = document.getElementById('tool4DocSignCanvas');
        const cw = (canvas && canvas.width) || 640;
        const ch = (canvas && canvas.height) || 860;
        const defaultW = 160;
        const defaultH = 65;
        const newPlacement = {
            x: Math.max(20, Math.round(cw - defaultW - 45)),
            y: Math.max(20, Math.round(ch - defaultH - 55)),
            w: defaultW,
            h: defaultH,
            sigDataUrl: tool4State.activeSignatureDataUrl || null,
            sigImg: tool4State.sigImgObj || null
        };
        pageObj.placements.push(newPlacement);
        pageObj.selectedPlacementIdx = pageObj.placements.length - 1;
        const slider = document.getElementById('tool4SigScaleSlider');
        if (slider) slider.value = defaultW;
    }

    window.handleTool4DocSignSelected = async function (inputOrFile) {
        ensurePdfJsWorker();
        const file = inputOrFile instanceof File ? inputOrFile : (inputOrFile && inputOrFile.files && inputOrFile.files[0]);
        if (!file) return;

        const emptyPrompt = document.getElementById('tool4DocEmptyPrompt');
        const stageWrap = document.getElementById('tool4DocSignStageWrap');
        const changeBtn = document.getElementById('btnTool4ChangeDoc');
        const nameBadge = document.getElementById('tool4DocFileNameBadge');
        const copyAllBtn = document.getElementById('btnTool4CopySigAllPages');
        const resBox = document.getElementById('tool4SignedDocResult');

        tool4State.docFileName = file.name.replace(/\.(pdf|jpg|jpeg|png|webp)$/i, '') || 'Document';
        tool4State.docPages = [];
        tool4State.activePageIndex = 0;
        if (resBox) resBox.innerHTML = '';

        // If user hasn't created a signature yet in Step 1, auto-generate a default typed signature or prompt gently
        if (!tool4State.activeSignatureDataUrl) {
            const typeInput = document.getElementById('tool4TypeSigInput');
            const fallbackName = (typeInput && typeInput.value.trim()) || '';
            if (fallbackName) {
                const st = TYPED_SIGNATURE_STYLES[tool4State.selectedTypedStyleIdx || 0];
                const autoUrl = createTypedSignatureDataUrl(fallbackName, st.font, tool4State.penColor);
                tool4State.activeSignatureDataUrl = autoUrl;
                updateActiveSignaturePreview(autoUrl);
            }
        }

        const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);

        try {
            if (isPdf) {
                if (!window.pdfjsLib) throw new Error('PDF.js தயாராகவில்லை.');
                const arrayBuf = await file.arrayBuffer();
                const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(arrayBuf) }).promise;
                for (let p = 1; p <= pdf.numPages; p++) {
                    const page = await pdf.getPage(p);
                    const vp = page.getViewport({ scale: 2.0 });
                    const c = document.createElement('canvas');
                    c.width = Math.round(vp.width);
                    c.height = Math.round(vp.height);
                    const ctx = c.getContext('2d');
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, c.width, c.height);
                    await page.render({ canvasContext: ctx, viewport: vp }).promise;
                    const dataUrl = c.toDataURL('image/jpeg', 0.92);
                    const pImg = new Image();
                    await new Promise((r) => { pImg.onload = r; pImg.src = dataUrl; });
                    tool4State.docPages.push({
                        pageNum: p,
                        imgElement: pImg,
                        dataUrl,
                        width: c.width,
                        height: c.height,
                        placements: [],
                        selectedPlacementIdx: -1
                    });
                }
            } else {
                const dataUrl = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
                const pImg = new Image();
                await new Promise((r) => { pImg.onload = r; pImg.src = dataUrl; });
                tool4State.docPages.push({
                    pageNum: 1,
                    imgElement: pImg,
                    dataUrl,
                    width: pImg.width,
                    height: pImg.height,
                    placements: [],
                    selectedPlacementIdx: -1
                });
            }

            if (emptyPrompt) emptyPrompt.style.display = 'none';
            if (stageWrap) stageWrap.style.display = 'flex';
            if (changeBtn) changeBtn.style.display = 'inline-flex';
            if (nameBadge) {
                nameBadge.innerText = `📄 ${file.name} (${tool4State.docPages.length} பக்கம்)`;
            }
            if (copyAllBtn) {
                copyAllBtn.style.display = tool4State.docPages.length > 1 ? 'inline-flex' : 'none';
            }

            initTool4DocSignCanvasEvents();
            selectTool4DocPage(0);
        } catch (err) {
            console.error('Document sign load error:', err);
            if (typeof showInAppToast === 'function') showInAppToast('⚠️ ஆவணத்தை ஏற்றுவதில் பிழை: ' + err.message, 'error');
        }
        if (inputOrFile && !(inputOrFile instanceof File)) {
            inputOrFile.value = '';
        }
    };

    window.selectTool4DocPage = function (pageIdx) {
        if (!tool4State.docPages.length) return;
        const idx = Math.max(0, Math.min(tool4State.docPages.length - 1, Number(pageIdx) || 0));
        tool4State.activePageIndex = idx;
        const pageObj = tool4State.docPages[idx];
        const canvas = document.getElementById('tool4DocSignCanvas');
        if (canvas && pageObj && pageObj.imgElement) {
            const aspect = pageObj.width / pageObj.height;
            if (aspect > 1.1) {
                canvas.width = 760;
                canvas.height = Math.round(760 / aspect);
            } else {
                canvas.width = 640;
                canvas.height = Math.round(640 / aspect);
            }
        }
        if (pageObj && (!pageObj.placements || pageObj.placements.length === 0)) {
            ensureDefaultPlacementOnPage(pageObj);
        }
        renderTool4DocPagePills();
        drawTool4DocSignStage();
    };

    function renderTool4DocPagePills() {
        const wrap = document.getElementById('tool4DocPagePills');
        if (!wrap) return;
        if (tool4State.docPages.length <= 1) {
            wrap.innerHTML = '';
            return;
        }
        wrap.innerHTML = tool4State.docPages.map((pg, i) => {
            const active = (i === tool4State.activePageIndex);
            const hasSig = pg.placements && pg.placements.length > 0;
            return `<button type="button" onclick="selectTool4DocPage(${i})" style="height:26px; padding:0 9px; border-radius:6px; border:1.5px solid ${active ? '#7e22ce' : (hasSig ? '#10b981' : '#cbd5e1')}; background:${active ? '#7e22ce' : (hasSig ? '#ecfdf5' : '#f8fafc')}; color:${active ? '#ffffff' : (hasSig ? '#065f46' : '#334155')}; font-size:11px; font-weight:800; cursor:pointer;">
                பக்கம் ${i + 1} ${hasSig ? '✍️' : ''}
            </button>`;
        }).join('');
    }

    window.resizeTool4PlacedSignature = function (newWidthVal) {
        const pageObj = tool4State.docPages[tool4State.activePageIndex];
        if (!pageObj || !pageObj.placements || !pageObj.placements.length) return;
        const selIdx = pageObj.selectedPlacementIdx >= 0 ? pageObj.selectedPlacementIdx : 0;
        const pl = pageObj.placements[selIdx];
        if (!pl) return;
        const canvas = document.getElementById('tool4DocSignCanvas');
        const ratio = (pl.h && pl.w) ? (pl.h / pl.w) : 0.4;
        const nw = Math.max(40, Math.min((canvas ? canvas.width : 640) - 10, Number(newWidthVal) || 150));
        const nh = Math.max(20, Math.round(nw * ratio));
        pl.w = nw;
        pl.h = nh;
        if (canvas) {
            if (pl.x + pl.w > canvas.width) pl.x = Math.max(0, canvas.width - pl.w);
            if (pl.y + pl.h > canvas.height) pl.y = Math.max(0, canvas.height - pl.h);
        }
        drawTool4DocSignStage();
    };

    window.addAnotherTool4SignatureOnPage = function () {
        const pageObj = tool4State.docPages[tool4State.activePageIndex];
        if (!pageObj) return;
        if (!tool4State.activeSignatureDataUrl) {
            if (typeof showInAppToast === 'function') showInAppToast('⚠️ முதலில் படி 1-ல் கையொப்பம் வரையவும் அல்லது அப்லோட் செய்யவும்.', 'warn');
            return;
        }
        if (!pageObj.placements) pageObj.placements = [];
        const offset = (pageObj.placements.length * 24) % 140;
        pageObj.placements.push({
            x: 80 + offset,
            y: 120 + offset,
            w: 155,
            h: 62,
            sigDataUrl: tool4State.activeSignatureDataUrl,
            sigImg: tool4State.sigImgObj
        });
        pageObj.selectedPlacementIdx = pageObj.placements.length - 1;
        drawTool4DocSignStage();
        renderTool4DocPagePills();
    };

    window.removeSelectedTool4SignatureFromPage = function () {
        const pageObj = tool4State.docPages[tool4State.activePageIndex];
        if (!pageObj || !pageObj.placements || !pageObj.placements.length) return;
        const selIdx = pageObj.selectedPlacementIdx >= 0 ? pageObj.selectedPlacementIdx : (pageObj.placements.length - 1);
        pageObj.placements.splice(selIdx, 1);
        pageObj.selectedPlacementIdx = pageObj.placements.length - 1;
        drawTool4DocSignStage();
        renderTool4DocPagePills();
    };

    window.applyTool4SignatureToAllPages = function () {
        const activePg = tool4State.docPages[tool4State.activePageIndex];
        if (!activePg || !activePg.placements || !activePg.placements.length) return;
        const templatePlacements = activePg.placements.map(p => ({ ...p }));
        tool4State.docPages.forEach((pg, idx) => {
            if (idx !== tool4State.activePageIndex) {
                pg.placements = templatePlacements.map(p => ({ ...p }));
                pg.selectedPlacementIdx = pg.placements.length - 1;
            }
        });
        renderTool4DocPagePills();
        if (typeof showInAppToast === 'function') {
            showInAppToast(`✅ அனைத்து ${tool4State.docPages.length} பக்கங்களிலும் கையொப்பம் பொருத்தப்பட்டது!`);
        }
    };

    function drawTool4DocSignStage(hideGuides = false) {
        const canvas = document.getElementById('tool4DocSignCanvas');
        const pageObj = tool4State.docPages[tool4State.activePageIndex];
        if (!canvas || !pageObj || !pageObj.imgElement) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(pageObj.imgElement, 0, 0, canvas.width, canvas.height);

        const placements = pageObj.placements || [];
        placements.forEach((pl, idx) => {
            const sigImg = pl.sigImg || tool4State.sigImgObj;
            if (sigImg) {
                ctx.drawImage(sigImg, pl.x, pl.y, pl.w, pl.h);
            } else if (!hideGuides) {
                ctx.fillStyle = 'rgba(126, 34, 206, 0.08)';
                ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
                ctx.fillStyle = '#7e22ce';
                ctx.font = 'bold 12px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('✍️ கையொப்பம் இங்கே (படி 1-ல் வரைக)', pl.x + pl.w / 2, pl.y + pl.h / 2 + 4);
            }

            if (!hideGuides) {
                const isSelected = (idx === pageObj.selectedPlacementIdx || placements.length === 1);
                ctx.save();
                ctx.strokeStyle = isSelected ? '#7e22ce' : '#10b981';
                ctx.lineWidth = isSelected ? 2 : 1.5;
                ctx.setLineDash([5, 3]);
                ctx.strokeRect(pl.x, pl.y, pl.w, pl.h);
                ctx.restore();

                if (isSelected) {
                    const hs = 9;
                    ctx.fillStyle = '#7e22ce';
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 1.5;
                    const handles = [
                        [pl.x, pl.y], [pl.x + pl.w / 2, pl.y], [pl.x + pl.w, pl.y],
                        [pl.x, pl.y + pl.h / 2], [pl.x + pl.w, pl.y + pl.h / 2],
                        [pl.x, pl.y + pl.h], [pl.x + pl.w / 2, pl.y + pl.h], [pl.x + pl.w, pl.y + pl.h]
                    ];
                    handles.forEach(([hx, hy]) => {
                        ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
                        ctx.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs);
                    });
                }
            }
        });
    }

    function initTool4DocSignCanvasEvents() {
        const canvas = document.getElementById('tool4DocSignCanvas');
        if (!canvas || canvas.__tool4DocSignBound) return;
        canvas.__tool4DocSignBound = true;

        function getPos(e) {
            const rect = canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return {
                x: (clientX - rect.left) * (canvas.width / rect.width),
                y: (clientY - rect.top) * (canvas.height / rect.height)
            };
        }

        function onDown(e) {
            const pageObj = tool4State.docPages[tool4State.activePageIndex];
            if (!pageObj) return;
            if (!pageObj.placements || pageObj.placements.length === 0) {
                ensureDefaultPlacementOnPage(pageObj);
            }
            const pos = getPos(e);

            // Check hit against existing signature placements (top-most first)
            let hitIdx = -1;
            let hitZone = null;
            for (let i = pageObj.placements.length - 1; i >= 0; i--) {
                const z = detectCropHitZone(pos, pageObj.placements[i]);
                if (z) {
                    hitIdx = i;
                    hitZone = z;
                    break;
                }
            }

            if (hitIdx >= 0) {
                pageObj.selectedPlacementIdx = hitIdx;
                tool4State.docDrag.mode = hitZone;
            } else {
                // Clicking anywhere on the document moves the active signature directly to that spot!
                const selIdx = pageObj.selectedPlacementIdx >= 0 ? pageObj.selectedPlacementIdx : 0;
                const pl = pageObj.placements[selIdx];
                if (pl) {
                    pl.x = Math.round(Math.max(0, Math.min(canvas.width - pl.w, pos.x - pl.w / 2)));
                    pl.y = Math.round(Math.max(0, Math.min(canvas.height - pl.h, pos.y - pl.h / 2)));
                    pageObj.selectedPlacementIdx = selIdx;
                    tool4State.docDrag.mode = 'move';
                }
            }

            const activePl = pageObj.placements[pageObj.selectedPlacementIdx || 0];
            if (activePl) {
                tool4State.docDrag.isDragging = true;
                tool4State.docDrag.startX = pos.x;
                tool4State.docDrag.startY = pos.y;
                tool4State.docDrag.startBox = { ...activePl };
            }
            e.preventDefault();
            drawTool4DocSignStage();
        }

        function onMove(e) {
            const pageObj = tool4State.docPages[tool4State.activePageIndex];
            if (!pageObj || !pageObj.placements || !pageObj.placements.length) return;
            const pos = getPos(e);
            const selIdx = pageObj.selectedPlacementIdx >= 0 ? pageObj.selectedPlacementIdx : 0;
            const pl = pageObj.placements[selIdx];
            if (!pl) return;

            if (!tool4State.docDrag.isDragging) {
                const zone = detectCropHitZone(pos, pl);
                const cursorMap = {
                    nw: 'nwse-resize', se: 'nwse-resize',
                    ne: 'nesw-resize', sw: 'nesw-resize',
                    n: 'ns-resize', s: 'ns-resize',
                    w: 'ew-resize', e: 'ew-resize',
                    move: 'move'
                };
                canvas.style.cursor = cursorMap[zone] || 'pointer';
                return;
            }

            const dx = pos.x - tool4State.docDrag.startX;
            const dy = pos.y - tool4State.docDrag.startY;
            const sb = tool4State.docDrag.startBox;
            const minW = 36;
            const minH = 18;
            const mode = tool4State.docDrag.mode;

            if (mode === 'move') {
                pl.x = Math.round(Math.max(0, Math.min(canvas.width - pl.w, sb.x + dx)));
                pl.y = Math.round(Math.max(0, Math.min(canvas.height - pl.h, sb.y + dy)));
            } else {
                let nx = sb.x;
                let ny = sb.y;
                let nw = sb.w;
                let nh = sb.h;

                if (mode.includes('e')) nw = Math.max(minW, Math.min(canvas.width - sb.x, sb.w + dx));
                if (mode.includes('s')) nh = Math.max(minH, Math.min(canvas.height - sb.y, sb.h + dy));
                if (mode.includes('w')) {
                    const maxDx = sb.w - minW;
                    const clampedDx = Math.max(-sb.x, Math.min(maxDx, dx));
                    nx = sb.x + clampedDx;
                    nw = sb.w - clampedDx;
                }
                if (mode.includes('n')) {
                    const maxDy = sb.h - minH;
                    const clampedDy = Math.max(-sb.y, Math.min(maxDy, dy));
                    ny = sb.y + clampedDy;
                    nh = sb.h - clampedDy;
                }

                pl.x = Math.round(nx);
                pl.y = Math.round(ny);
                pl.w = Math.round(nw);
                pl.h = Math.round(nh);

                const slider = document.getElementById('tool4SigScaleSlider');
                if (slider) slider.value = pl.w;
            }

            drawTool4DocSignStage();
        }

        function onUp() {
            tool4State.docDrag.isDragging = false;
            tool4State.docDrag.mode = null;
        }

        canvas.addEventListener('mousedown', onDown);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        canvas.addEventListener('touchstart', onDown, { passive: false });
        window.addEventListener('touchmove', onMove, { passive: false });
        window.addEventListener('touchend', onUp);
    }

    function renderSignedPageFullResolutionDataUrl(pageObj) {
        const canvas = document.getElementById('tool4DocSignCanvas');
        const stageW = (canvas && canvas.width) || 640;
        const stageH = (canvas && canvas.height) || 860;

        const out = document.createElement('canvas');
        out.width = pageObj.width || stageW;
        out.height = pageObj.height || stageH;
        const ctx = out.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, out.width, out.height);
        ctx.drawImage(pageObj.imgElement, 0, 0, out.width, out.height);

        const scaleX = out.width / stageW;
        const scaleY = out.height / stageH;

        (pageObj.placements || []).forEach(pl => {
            const sigImg = pl.sigImg || tool4State.sigImgObj;
            if (sigImg) {
                ctx.drawImage(
                    sigImg,
                    Math.round(pl.x * scaleX),
                    Math.round(pl.y * scaleY),
                    Math.round(pl.w * scaleX),
                    Math.round(pl.h * scaleY)
                );
            }
        });

        return out.toDataURL('image/jpeg', 0.92);
    }

    window.downloadTool4SignedDocumentJpg = function () {
        if (!tool4State.docPages.length) {
            if (typeof showInAppToast === 'function') showInAppToast('⚠️ முதலில் ஆவணத்தை அப்லோட் செய்யவும்.', 'warn');
            return;
        }
        if (!tool4State.activeSignatureDataUrl && !tool4State.sigImgObj) {
            if (typeof showInAppToast === 'function') showInAppToast('⚠️ முதலில் மேலே கையொப்பம் வரையவும், டைப் செய்யவும் அல்லது போட்டோ அப்லோட் செய்யவும்.', 'warn');
            return;
        }

        const pageObj = tool4State.docPages[tool4State.activePageIndex] || tool4State.docPages[0];
        const signedDataUrl = renderSignedPageFullResolutionDataUrl(pageObj);
        const outName = `${tool4State.docFileName}_Signed_Page_${pageObj.pageNum}.jpg`;
        triggerDownloadUrl(signedDataUrl, outName);
    };

    window.downloadTool4SignedDocumentPdf = async function () {
        if (!tool4State.docPages.length) {
            if (typeof showInAppToast === 'function') showInAppToast('⚠️ முதலில் ஆவணத்தை அப்லோட் செய்யவும்.', 'warn');
            return;
        }
        if (!tool4State.activeSignatureDataUrl && !tool4State.sigImgObj) {
            if (typeof showInAppToast === 'function') showInAppToast('⚠️ முதலில் மேலே கையொப்பம் வரையவும், டைப் செய்யவும் அல்லது போட்டோ அப்லோட் செய்யவும்.', 'warn');
            return;
        }

        const btn = document.getElementById('btnTool4DownloadSignedPdf');
        const resBox = document.getElementById('tool4SignedDocResult');
        const targetKb = Number(document.getElementById('tool4SignedDocKbSelect')?.value) || 200;

        try {
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> கையொப்பமிட்ட PDF உருவாக்கப்படுகிறது...';
            }

            const signedPageUrls = tool4State.docPages.map(pg => renderSignedPageFullResolutionDataUrl(pg));

            const res = await fetch('/api/tools/jpg-to-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    layoutMode: 'multi_page',
                    targetKb,
                    outputName: `${tool4State.docFileName}_Signed`,
                    imageDataUrls: signedPageUrls
                })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'கையொப்பமிட்ட PDF உருவாக்குவதில் பிழை');

            triggerDownloadUrl(data.output.downloadUrl, data.output.filename);

            if (resBox) {
                resBox.innerHTML = `
                    <div style="background:#f0fdf4; border:1.5px solid #86efac; border-radius:10px; padding:12px 14px; margin-top:8px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                        <div>
                            <div style="font-size:13px; font-weight:800; color:#065f46;">
                                ✅ கையொப்பமிட்ட முழு ஆவணம் தயார்: ${data.output.filename} (${data.output.sizeKb} KB)
                            </div>
                            <div style="font-size:11px; color:#15803d; margin-top:2px;">
                                📥 உங்கள் கணினியில் தானாகப் பதிவிறக்கப்பட்டது!
                            </div>
                        </div>
                        <div style="display:flex; gap:8px;">
                            <a href="${data.output.downloadUrl}?inline=1" target="_blank" style="height:32px; padding:0 12px; background:white; border:1.5px solid #86efac; color:#166534; border-radius:6px; font-size:11.5px; font-weight:700; text-decoration:none; display:inline-flex; align-items:center; gap:5px;">
                                <i class="fa-solid fa-eye"></i> பார்
                            </a>
                            <a href="${data.output.downloadUrl}" download="${data.output.filename}" style="height:32px; padding:0 14px; background:#16a34a; color:white; border-radius:6px; font-size:11.5px; font-weight:800; text-decoration:none; display:inline-flex; align-items:center; gap:5px;">
                                <i class="fa-solid fa-download"></i> PDF பதிவிறக்கு
                            </a>
                        </div>
                    </div>
                `;
            }
        } catch (err) {
            if (resBox) resBox.innerHTML = `<div style="color:#dc2626; font-weight:700; margin-top:8px;">⚠️ பிழை: ${err.message}</div>`;
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-file-pdf"></i> 📥 கையொப்பமிட்ட முழு ஆவணம் (PDF) பதிவிறக்கு';
            }
        }
    };

})(window);
