/**
 * TNPDS Strict Human-Only Final Submit Gate & Official Post-Submit Application PDF Downloader
 *
 * Golden Rule 25 (Absolute Pre-Submit Human Separation):
 * 1. Automation NEVER clicks TNPDS's Final Submit / Confirm button in live production!
 * 2. Only the human operator reviews the filled Chrome form and clicks Final Submit directly on Chrome.
 * 3. Once the human operator submits and TNPDS displays the Reference / Application Number,
 *    automation captures that exact Reference Number and automatically downloads the official
 *    TNPDS Application PDF (direct button if present, or via TNPDS Application Status lookup).
 */
const fs = require('fs');
const path = require('path');

/**
 * Extracts a genuine TNPDS Government Reference / Application Number from the live DOM.
 * Guards against false positives (e.g. mobile numbers, Aadhaar numbers, static labels).
 */
function parseTnpdsRefFromText(bodyText) {
    const text = String(bodyText || '').replace(/\s+/g, ' ');
    if (!text) return '';

    const labeledPatterns = [
        /(?:குறிப்பு\s*எண்|கோரிக்கை\s*எண்|கோரிக்கை\s*எண்|விண்ணப்ப\s*(?:குறிப்பு\s*)?எண்|Reference\s*(?:No|Number)|Application\s*(?:No|Number)|Acknowledgement\s*(?:No|Number))\s*[:\-–]?\s*([A-Z]?\d{9,18}|[A-Z]{1,3}\d{8,16})/i
    ];
    for (const re of labeledPatterns) {
        const m = text.match(re);
        if (m && m[1]) return m[1].trim();
    }

    const knownPrefixMatch = text.match(/\b(352\d{11}|N\d{10,16})\b/);
    if (knownPrefixMatch && knownPrefixMatch[1]) {
        return knownPrefixMatch[1].trim();
    }

    // 14-digit TNPDS numeric reference number (only when submission confirmation text is visible)
    if (/வெற்றிகரமாக|சமர்ப்பிக்கப்பட்டது|பதிவு\s*செய்யப்பட்டது|submitted\s*successfully|acknowledgement|குறிப்பு\s*எண்|விண்ணப்ப\s*எண்/i.test(text)) {
        const longNum = text.match(/\b(\d{13,16})\b/);
        if (longNum && longNum[1]) return longNum[1].trim();
    }

    return '';
}

async function extractTnpdsReferenceNumber(page) {
    if (!page || (typeof page.isClosed === 'function' && page.isClosed())) return '';
    try {
        const domSnapshot = await page.evaluate(() => {
            const hud = document.getElementById('esevadraft-browser-hud');
            const hudText = hud ? (hud.innerText || '') : '';
            const bodyText = (document.body ? document.body.innerText : '').replace(hudText, '');
            const refEl = document.querySelector('span.ref-number, .app-no, .swal2-html-container, .alert-success, .modal.show .modal-body');
            const refElText = refEl ? (refEl.innerText || '') : '';
            return { bodyText, refElText };
        }).catch(() => ({ bodyText: '', refElText: '' }));

        return parseTnpdsRefFromText(domSnapshot.refElText) || parseTnpdsRefFromText(domSnapshot.bodyText) || '';
    } catch (_) {
        return '';
    }
}

/**
 * Strictly waits for the HUMAN OPERATOR to inspect and click Final Submit directly in Chrome.
 * NEVER clicks Submit or Confirm itself in live production!
 */
async function waitForHumanFinalSubmitOnly(page, {
    serviceLabel = 'TNPDS குடும்ப அட்டை விண்ணப்பம்',
    onProgress = () => {},
    showBrowserHud = async () => {},
    isMockSandboxMode = false,
    timeoutMs = 1800000, // 30 minutes generous human review window
    pollIntervalMs = 1000
} = {}) {
    if (isMockSandboxMode) {
        return { submitted: false, reason: 'mock_sandbox', refNo: '' };
    }
    if (!page || (typeof page.isClosed === 'function' && page.isClosed())) {
        return { submitted: false, reason: 'browser_closed', refNo: '' };
    }

    const hudTitle = '🛡️ இறுதிச் சமர்ப்பிப்பு மனிதப் பூட்டு (Pre-Submit Human Gate)';
    const hudSub = `${serviceLabel} 100% நிரப்பப்பட்டது! ஆட்டோமேஷன் இறுதிச் சமர்ப்பிப்பை அழுத்தாது — நீங்களே Chrome-ல் சரிபார்த்து "பதிவு செய்" அழுத்தவும். சமர்ப்பித்ததும் விண்ணப்ப PDF தானாகப் பதிவிறக்கப்படும்!`;

    await showBrowserHud(hudTitle, hudSub, 'approval', page).catch(() => {});
    onProgress(
        `🛡️ **[கட்டாய இறுதிச் சமர்ப்பிப்பு மனிதப் பூட்டு — Pre-Submit Human Gate]**\n` +
        `✅ ${serviceLabel} விவரங்கள் & ஆவணங்கள் 100% நிரப்பப்பட்டுவிட்டன!\n` +
        `🔒 **முக்கிய விதி:** ஆட்டோமேஷன் ஒருபோதும் இறுதிச் சமர்ப்பிப்பு (Final Submit) பொத்தானை அழுத்தாது.\n` +
        `👉 நீங்களே Chrome திரையில் விவரங்களைச் சரிபார்த்து இறுதி **"பதிவு செய் / சமர்ப்பி"** பொத்தானை அழுத்தவும் — நீங்கள் சமர்ப்பித்தவுடன் அரசு குறிப்பு எண்ணை எடுத்து **அதிகாரப்பூர்வ விண்ணப்ப PDF-ஐ ஆப் தானாகவே பதிவிறக்கித் தரும்!**`
    );

    const deadline = Date.now() + timeoutMs;
    const waitStep = Math.max(20, Math.min(pollIntervalMs, 1500));
    let lastHudRefreshAt = Date.now();

    while (Date.now() < deadline) {
        if (typeof page.isClosed === 'function' && page.isClosed()) {
            return { submitted: false, reason: 'browser_closed', refNo: '' };
        }

        // Check duplicate Aadhaar / portal refusal modal after human clicks Submit
        const dupMsg = await page.evaluate(() => {
            const hud = document.getElementById('esevadraft-browser-hud');
            const hudTxt = hud ? (hud.innerText || '') : '';
            const txt = (document.body ? document.body.innerText : '').replace(hudTxt, '');
            if (txt.includes('ஏற்கனவே வேறொரு குடும்ப அட்டையுடன் இணைக்கப்பட்டுள்ளது') ||
                txt.includes('ஏற்கனவே மற்றொரு குடும்ப அட்டையுடன் இணைக்கப்பட்டுள்ளது') ||
                txt.includes('ஏற்கனவே மற்றொரு குடும்ப அட்டையில்')) {
                return 'ஆதார் எண் ஏற்கனவே வேறொரு குடும்ப அட்டையுடன் இணைக்கப்பட்டுள்ளது.';
            }
            return '';
        }).catch(() => '');

        if (typeof dupMsg === 'string' && dupMsg) {
            return { submitted: false, reason: 'duplicate_aadhaar', duplicateMessage: dupMsg, refNo: '' };
        }

        // Check if official Reference / Application Number has appeared AFTER human clicked Final Submit
        const refNo = await extractTnpdsReferenceNumber(page);
        if (refNo) {
            onProgress(`⚡ **[ஆபரேட்டர் சமர்ப்பிப்பு உணரப்பட்டது]** அரசு குறிப்பு எண் 👉 **${refNo}** பெறப்பட்டது! இப்போது அதிகாரப்பூர்வ விண்ணப்ப PDF பதிவிறக்கப்படுகிறது...`);
            await showBrowserHud('🎉 சமர்ப்பிப்பு உறுதி — PDF பதிவிறக்கம்', `குறிப்பு எண்: ${refNo} • விண்ணப்ப PDF தானாகப் பதிவிறக்கப்படுகிறது...`, 'success', page).catch(() => {});
            return { submitted: true, reason: 'human_submitted_on_portal', refNo };
        }

        if (Date.now() - lastHudRefreshAt >= 20000) {
            lastHudRefreshAt = Date.now();
            await showBrowserHud(hudTitle, hudSub, 'approval', page).catch(() => {});
        }

        if (typeof page.waitForTimeout === 'function') {
            await page.waitForTimeout(waitStep).catch(() => {});
        } else {
            await new Promise((r) => setTimeout(r, waitStep));
        }
    }

    return { submitted: false, reason: 'timeout', refNo: '' };
}

/**
 * Automatically downloads the official TNPDS Application PDF using the captured Reference Number.
 * Strategy:
 *  1. First checks if a direct Download / Print button is already visible on the confirmation page.
 *  2. Otherwise navigates to TNPDS Application Status lookup ("மின்னணு அட்டை விண்ணப்பத்தின் நிலை"),
 *     enters the Reference Number, submits the status check, and clicks Download Application PDF.
 */
async function downloadOfficialTnpdsApplicationPdf(page, appRefNo, {
    receiptsDir,
    onProgress = () => {},
    showBrowserHud = async () => {},
    serviceType = 'NEW_CARD'
} = {}) {
    const cleanRef = String(appRefNo || '').trim();
    if (!cleanRef || !page || (typeof page.isClosed === 'function' && page.isClosed())) {
        return { downloaded: false, pdfUrl: null, pdfPath: null };
    }

    const targetDir = receiptsDir || path.join(process.cwd(), 'public', 'receipts');
    try { if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true }); } catch (_) {}
    const saveFilename = `Application_${cleanRef}.pdf`;
    const savePath = path.join(targetDir, saveFilename);

    const tryClickDownloadButton = async () => {
        const dlBtn = page.locator([
            'a:has-text("Download Application")',
            'button:has-text("Download Application")',
            'a:has-text("விண்ணப்ப பதிவிறக்கம்")',
            'button:has-text("விண்ணப்ப பதிவிறக்கம்")',
            'a:has-text("விண்ணப்பத்தைப் பதிவிறக்க")',
            'button:has-text("விண்ணப்பத்தைப் பதிவிறக்க")',
            'a:has-text("பதிவிறக்கம்")',
            'button:has-text("பதிவிறக்கம்")',
            'button:has-text("Download")',
            'a:has-text("Download")'
        ].join(', ')).first();

        if (await dlBtn.count().catch(() => 0) > 0 && await dlBtn.isVisible().catch(() => false)) {
            const [download] = await Promise.all([
                page.waitForEvent('download', { timeout: 15000 }).catch(() => null),
                dlBtn.click({ force: true }).catch(() => {})
            ]);
            if (download) {
                await download.saveAs(savePath);
                if (fs.existsSync(savePath) && fs.statSync(savePath).size > 200) {
                    return true;
                }
            }
        }
        return false;
    };

    try {
        onProgress(`📥 அரசு குறிப்பு எண் (**${cleanRef}**) மூலம் அதிகாரப்பூர்வ TNPDS விண்ணப்ப PDF பதிவிறக்கப்படுகிறது...`);
        await showBrowserHud('📥 அதிகாரப்பூர்வ PDF பதிவிறக்கம்', `குறிப்பு எண் ${cleanRef} — விண்ணப்ப PDF பெறப்படுகிறது...`, 'info', page).catch(() => {});

        // Fast path: direct download button on confirmation page
        if (await tryClickDownloadButton()) {
            onProgress(`✅ **அதிகாரப்பூர்வ TNPDS விண்ணப்ப PDF (${saveFilename}) நேரடியாகப் பதிவிறக்கப்பட்டது!** 📄`);
            await showBrowserHud('✅ விண்ணப்ப PDF பதிவிறக்கம் முடிந்தது!', `குறிப்பு எண்: ${cleanRef} • கோப்பு சேமிக்கப்பட்டது`, 'success', page).catch(() => {});
            return { downloaded: true, pdfUrl: `/receipts/${saveFilename}`, pdfPath: savePath };
        }

        // Standard TNPDS Post-Submit Schedule: Home -> Smart Card Application Status -> Enter Reference Number -> Download Application
        await page.goto('https://www.tnpds.gov.in/pages/home', { waitUntil: 'networkidle', timeout: 35000 }).catch(() => {});
        await page.waitForTimeout(1500).catch(() => {});

        const statusCardSelectors = serviceType === 'NEW_CARD'
            ? [
                'text=மின்னணு அட்டை விண்ணப்பத்தின் நிலை',
                'text=Smart Card Application Status',
                'text=அட்டை தொடர்பான சேவை நிலை',
                'text=Card Related Service Status'
            ]
            : [
                'text=அட்டை தொடர்பான சேவை நிலை',
                'text=Card Related Service Status',
                'text=மின்னணு அட்டை விண்ணப்பத்தின் நிலை',
                'text=Smart Card Application Status'
            ];

        for (const sel of statusCardSelectors) {
            const card = page.locator(sel).first();
            if (await card.count().catch(() => 0) > 0 && await card.isVisible().catch(() => false)) {
                await card.click({ force: true }).catch(() => {});
                await page.waitForTimeout(2500).catch(() => {});
                break;
            }
        }

        const refInput = page.locator([
            'input[formcontrolname="ReferencNumber"]',
            'input[formcontrolname="referenceNumber"]',
            'input[formcontrolname="refNo"]',
            'input[placeholder*="குறிப்பு"]',
            'input[placeholder*="Reference" i]',
            'input[type="text"]'
        ].join(', ')).first();

        if (await refInput.count().catch(() => 0) > 0 && await refInput.isVisible().catch(() => false)) {
            await refInput.fill(cleanRef).catch(() => {});
            await refInput.dispatchEvent('input').catch(() => {});
            await refInput.dispatchEvent('change').catch(() => {});
            await page.waitForTimeout(500).catch(() => {});

            const checkBtn = page.locator('button:has-text("பதிவு செய்ய"), button:has-text("சமர்ப்பி"), button:has-text("Submit"), button[type="submit"]').first();
            if (await checkBtn.count().catch(() => 0) > 0) {
                await checkBtn.click({ force: true }).catch(() => {});
                await page.waitForTimeout(4000).catch(() => {});
            }

            if (await tryClickDownloadButton()) {
                onProgress(`✅ **அதிகாரப்பூர்வ TNPDS விண்ணப்பப் படிவம் (${saveFilename}) வெற்றிகரமாகப் பதிவிறக்கப்பட்டது!** 📄`);
                await showBrowserHud('✅ விண்ணப்ப PDF பதிவிறக்கம் முடிந்தது!', `குறிப்பு எண்: ${cleanRef} • கோப்பு சேமிக்கப்பட்டது`, 'success', page).catch(() => {});
                return { downloaded: true, pdfUrl: `/receipts/${saveFilename}`, pdfPath: savePath };
            }
        }
    } catch (dlErr) {
        onProgress(`⚠️ [PDF பதிவிறக்க எச்சரிக்கை] அரசு நிலைப் பக்கத்தில் நேரடி PDF பதிவிறக்கம் கிடைக்கவில்லை (${dlErr.message}) — குறிப்பு எண் **${cleanRef}** பாதுகாப்பாகச் சேமிக்கப்பட்டது.`);
    }

    return { downloaded: false, pdfUrl: null, pdfPath: null };
}

module.exports = {
    parseTnpdsRefFromText,
    extractTnpdsReferenceNumber,
    waitForHumanFinalSubmitOnly,
    downloadOfficialTnpdsApplicationPdf
};
