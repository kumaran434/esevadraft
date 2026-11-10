const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
    const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
    const page = browser.contexts()[0].pages()[0];
    const chunkUrls = await page.evaluate(() => {
        return performance.getEntriesByType('resource').map(r => r.name).filter(n => n.includes('chunk-'));
    });

    console.log(`Found ${chunkUrls.length} chunks. Downloading and analyzing...`);

    for (const url of chunkUrls) {
        const name = path.basename(url);
        try {
            const content = await page.evaluate(async (u) => {
                const r = await fetch(u);
                return await r.text();
            }, url);

            if (content.includes('addmember') || content.includes('addMember') || content.includes('XSD') || content.includes('aadharCheck') || content.includes('newsmartcard')) {
                console.log(`\n=== MATCH IN ${name} ===`);
                if (content.includes('XSD')) console.log('  -> Contains XSD');
                if (content.includes('addmember') || content.includes('addMember')) console.log('  -> Contains addMember');
                if (content.includes('aadharCheck')) console.log('  -> Contains aadharCheck');
                if (content.includes('newsmartcard')) console.log('  -> Contains newsmartcard');
                fs.writeFileSync(path.join('scratch', name), content, 'utf8');
            }
        } catch (e) {
            console.error('Failed to fetch', name, e.message);
        }
    }

    await browser.close();
})();
