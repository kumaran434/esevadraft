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

    function triggerDownloadUrl(url, filename) {
        const a = document.createElement('a');
        a.href = url;
        if (filename) a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => a.remove(), 300);
    }

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
                statusEl.innerHTML = `<span style="color:#15803d; font-weight:800;">✅ சுருக்கப்பட்டது: ${origKb} KB ➔ ${newKb} KB (${savedPct}% குறைப்பு)</span>`;
            }

            if (resultsBox) {
                resultsBox.innerHTML = `
                    <div style="background:#f0fdf4; border:1.5px solid #86efac; border-radius:10px; padding:12px 14px; margin-top:10px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                        <div>
                            <div style="font-size:13px; font-weight:800; color:#065f46;">
                                <i class="fa-solid fa-file-circle-check" style="color:#16a34a;"></i> ${data.mainFile.filename} (${newKb} KB)
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
                btn.innerHTML = '<i class="fa-solid fa-compress"></i> சுருக்கு (Compress PDF)';
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
                statusEl.innerHTML = `<span style="color:#1d4ed8; font-weight:800;">✅ ${parts.length} பாகங்களாகப் பிரிக்கப்பட்டது!</span>`;
            }
            if (resultsBox) {
                resultsBox.innerHTML = renderSplitPartsCardsHtml(parts, `✂️ பிரிக்கப்பட்ட ${parts.length} PDF பாகங்கள்`);
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
    // TOOL 2: TWO-WAY JPG ⇄ PDF CONVERTER (UPLOAD-PREVIEW-FIRST UI)
    // =========================================================================
    let tool2State = {
        direction: 'jpg_to_pdf',
        images: [],
        pdfToJpgPages: []
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

        let loaded = 0;
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                tool2State.images.push({
                    name: file.name,
                    size: file.size,
                    dataUrl: e.target.result
                });
                loaded++;
                if (loaded === files.length) {
                    renderTool2ImagesList();
                }
            };
            reader.readAsDataURL(file);
        });
        input.value = '';
    };

    window.removeTool2Image = function (idx) {
        tool2State.images.splice(idx, 1);
        renderTool2ImagesList();
    };

    window.moveTool2Image = function (idx, delta) {
        const target = idx + delta;
        if (target < 0 || target >= tool2State.images.length) return;
        const temp = tool2State.images[idx];
        tool2State.images[idx] = tool2State.images[target];
        tool2State.images[target] = temp;
        renderTool2ImagesList();
    };

    window.clearTool2Images = function () {
        tool2State.images = [];
        renderTool2ImagesList();
        const res = document.getElementById('tool2JpgToPdfResult');
        if (res) res.innerHTML = '';
    };

    function renderTool2ImagesList() {
        const emptyPrompt = document.getElementById('tool2JpgEmptyPrompt');
        const uploadedWrap = document.getElementById('tool2JpgUploadedWrap');
        const grid = document.getElementById('tool2ImagesPreviewGrid');
        const countEl = document.getElementById('tool2ImagesCountBadge');

        if (countEl) countEl.innerText = `${tool2State.images.length} படங்கள்`;

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

        grid.innerHTML = tool2State.images.map((img, i) => `
            <div style="background:white; border:1.5px solid #cbd5e1; border-radius:8px; padding:6px; display:flex; flex-direction:column; gap:5px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="background:#ecfdf5; color:#047857; font-size:10.5px; font-weight:800; padding:1px 6px; border-radius:4px;">#${i + 1}</span>
                    <div style="display:flex; gap:3px;">
                        <button type="button" onclick="moveTool2Image(${i}, -1)" style="border:1px solid #cbd5e1; background:#f8fafc; border-radius:4px; width:20px; height:20px; font-size:9px; cursor:pointer;">◀</button>
                        <button type="button" onclick="moveTool2Image(${i}, 1)" style="border:1px solid #cbd5e1; background:#f8fafc; border-radius:4px; width:20px; height:20px; font-size:9px; cursor:pointer;">▶</button>
                        <button type="button" onclick="removeTool2Image(${i})" style="border:1px solid #fecaca; background:#fef2f2; color:#dc2626; border-radius:4px; width:20px; height:20px; font-size:9px; cursor:pointer;">✕</button>
                    </div>
                </div>
                <img src="${img.dataUrl}" style="width:100%; height:110px; object-fit:contain; background:#f8fafc; border-radius:4px;">
                <div style="font-size:10.5px; font-weight:700; color:#334155; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${img.name}</div>
            </div>
        `).join('');
    }

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

            if (resBox) {
                resBox.innerHTML = `
                    <div style="background:#f0fdf4; border:1.5px solid #86efac; border-radius:10px; padding:12px 14px; margin-top:10px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                        <div style="font-size:13px; font-weight:800; color:#065f46;">
                            ✅ ${data.output.filename} (${data.output.sizeKb} KB)
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
    }

})(window);
