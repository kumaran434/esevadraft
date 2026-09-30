const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const outputDir = path.join(__dirname, '..', 'data', 'recorded_flows');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

const now = new Date();
const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}-${String(now.getMinutes()).padStart(2,'0')}`;
const outputFile = path.join(outputDir, `recorded_selectors_${dateStr}.json`);

(async () => {
    console.log('\n======================================================');
    console.log('  eSevaDraft - Smart Selector Recorder');
    console.log('======================================================');
    console.log('  Chrome opens now - do your work normally.');
    console.log('  When you reach the Add Member form page,');
    console.log('  ALL form field selectors will be auto-captured!');
    console.log('  Close Chrome when done.\n');

    const browser = await chromium.launch({
        channel: 'chrome',
        headless: false,
        args: ['--start-maximized']
    });

    const context = await browser.newContext({ viewport: null });
    const page = await context.newPage();

    // Track all pages including popups
    const allRecords = [];
    let captureInterval = null;

    // Inject selector capture on every page load
    const injectCapture = async (pg) => {
        try {
            await pg.evaluate(() => {
                // Track clicks
                if (!window.__esevaRecorder) {
                    window.__esevaRecorder = { clicks: [], inputs: [] };
                    document.addEventListener('click', (e) => {
                        const el = e.target;
                        const info = {
                            tag: el.tagName,
                            id: el.id || '',
                            name: el.name || '',
                            type: el.type || '',
                            formcontrolname: el.getAttribute('formcontrolname') || '',
                            className: el.className || '',
                            text: (el.innerText || '').slice(0, 50),
                            placeholder: el.placeholder || '',
                            href: el.href || '',
                            routerlink: el.getAttribute('routerlink') || '',
                            value: el.value || '',
                            timestamp: Date.now(),
                            url: window.location.href
                        };
                        window.__esevaRecorder.clicks.push(info);
                        console.log('[eSeva Click]', JSON.stringify(info));
                    }, true);

                    document.addEventListener('change', (e) => {
                        const el = e.target;
                        const info = {
                            tag: el.tagName,
                            id: el.id || '',
                            name: el.name || '',
                            type: el.type || '',
                            formcontrolname: el.getAttribute('formcontrolname') || '',
                            className: el.className || '',
                            placeholder: el.placeholder || '',
                            value: el.value || '',
                            selectedText: el.options ? (el.options[el.selectedIndex]?.text || '') : '',
                            timestamp: Date.now(),
                            url: window.location.href
                        };
                        window.__esevaRecorder.inputs.push(info);
                        console.log('[eSeva Input]', JSON.stringify(info));
                    }, true);
                }
            });
        } catch (e) {}
    };

    // Capture all form fields on page
    const captureFormFields = async (pg) => {
        try {
            const url = pg.url();
            const fields = await pg.evaluate(() => {
                const results = [];
                // All inputs
                document.querySelectorAll('input, select, textarea, button').forEach(el => {
                    if (el.type === 'hidden') return;
                    const rect = el.getBoundingClientRect();
                    if (rect.width === 0 && rect.height === 0) return;
                    results.push({
                        tag: el.tagName,
                        id: el.id || '',
                        name: el.name || '',
                        type: el.type || '',
                        formcontrolname: el.getAttribute('formcontrolname') || '',
                        className: el.className || '',
                        placeholder: el.placeholder || '',
                        label: (() => {
                            // Find associated label
                            if (el.id) {
                                const lbl = document.querySelector(`label[for="${el.id}"]`);
                                if (lbl) return lbl.innerText.trim();
                            }
                            // Check parent for label
                            const parent = el.closest('div, td, th');
                            if (parent) {
                                const lbl = parent.querySelector('label');
                                if (lbl) return lbl.innerText.trim();
                            }
                            return '';
                        })(),
                        text: (el.innerText || el.textContent || '').trim().slice(0, 80),
                        value: el.value || '',
                        options: el.tagName === 'SELECT' ? Array.from(el.options).map(o => ({ value: o.value, text: o.text })) : [],
                        visible: el.offsetParent !== null,
                        required: el.required || el.getAttribute('required') !== null
                    });
                });
                return results;
            }).catch(() => []);

            if (fields.length > 0) {
                allRecords.push({
                    url: url,
                    timestamp: new Date().toISOString(),
                    formFieldsCount: fields.length,
                    fields: fields
                });
                console.log(`[Captured] ${fields.length} form fields at ${url.slice(0, 60)}`);
            }
        } catch (e) {}
    };

    // Navigate to TNPDS
    await page.goto('https://www.tnpds.gov.in/auth/login', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    await injectCapture(page);

    // Re-inject on every navigation
    page.on('load', async () => {
        await injectCapture(page);
        await captureFormFields(page);
    });

    page.on('framenavigated', async () => {
        await injectCapture(page);
    });

    // Periodic capture every 5 seconds
    captureInterval = setInterval(async () => {
        try {
            await captureFormFields(page);
            // Also capture click/input history from page
            const recorder = await page.evaluate(() => window.__esevaRecorder || { clicks: [], inputs: [] }).catch(() => ({ clicks: [], inputs: [] }));
            if (recorder.clicks.length > 0 || recorder.inputs.length > 0) {
                // Save incrementally
                const data = {
                    capturedAt: new Date().toISOString(),
                    pages: allRecords,
                    userClicks: recorder.clicks,
                    userInputs: recorder.inputs
                };
                fs.writeFileSync(outputFile, JSON.stringify(data, null, 2), 'utf8');
            }
        } catch (e) {}
    }, 5000);

    // Wait for browser to close
    await new Promise(resolve => {
        browser.on('disconnected', resolve);
    });

    if (captureInterval) clearInterval(captureInterval);

    // Final save
    try {
        const recorder = await page.evaluate(() => window.__esevaRecorder || { clicks: [], inputs: [] }).catch(() => ({ clicks: [], inputs: [] }));
        const finalData = {
            capturedAt: new Date().toISOString(),
            pages: allRecords,
            userClicks: recorder.clicks || [],
            userInputs: recorder.inputs || []
        };
        fs.writeFileSync(outputFile, JSON.stringify(finalData, null, 2), 'utf8');
    } catch (e) {}

    // Save whatever we have
    if (allRecords.length > 0) {
        const finalData = {
            capturedAt: new Date().toISOString(),
            pages: allRecords,
            totalFieldsCaptured: allRecords.reduce((s, r) => s + r.formFieldsCount, 0)
        };
        fs.writeFileSync(outputFile, JSON.stringify(finalData, null, 2), 'utf8');
        console.log(`\n✅ SAVED! ${finalData.totalFieldsCaptured} fields captured to:\n   ${outputFile}\n`);
    } else {
        console.log('\nNo form fields were captured.\n');
    }
})();
