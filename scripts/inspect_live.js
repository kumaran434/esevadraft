// =========================================================================
// eSevaDraft — Desktop App & Automation Live Inspector
// Directly queries running Electron process for visual screenshot & DOM dump
// =========================================================================
const http = require('http');
const fs = require('fs');
const path = require('path');

async function inspectLive(queryString = '') {
    return new Promise((resolve, reject) => {
        const url = 'http://127.0.0.1:3000/api/desktop/inspect-live' + (queryString ? `?${queryString}` : '');
        const req = http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed);
                } catch (e) {
                    reject(new Error(`Failed to parse response: ${e.message} — raw: ${data.slice(0, 200)}`));
                }
            });
        });
        req.on('error', (err) => {
            reject(new Error(`Cannot connect to local desktop server on port 3000: ${err.message}`));
        });
        req.setTimeout(5000, () => {
            req.destroy(new Error('Inspection request timed out'));
        });
    });
}

(async () => {
    try {
        console.log('🔍 [Live Inspector] Inspecting running desktop app & automation...\n');
        const query = process.argv.slice(2).join('&');
        const result = await inspectLive(query);

        if (!result.success) {
            console.error('❌ Inspection returned error:', result.error);
            process.exit(1);
        }

        console.log(`⏱️ TIMESTAMP        : ${result.timestamp}`);
        console.log(`📸 SCREENSHOT SAVED : ${result.screenshotSaved ? 'YES ✅' : 'NO ❌'}`);
        if (result.screenshotPath) console.log(`   Local File       : ${result.screenshotPath}`);
        if (result.brainScreenshotPath) console.log(`   Artifact File    : ${result.brainScreenshotPath}`);

        const dom = result.domData || {};
        console.log('\n📱 --- DESKTOP APP DOM STATE ---');
        console.log(`URL                 : ${dom.url || 'N/A'}`);
        console.log(`Customer Input      : ${dom.customerMobile || '(empty)'} ${dom.customerName ? `[${dom.customerName}]` : ''}`);
        console.log(`FSM / App State     : ${dom.appState || 'N/A'}`);

        console.log('\n💬 --- VISIBLE CHAT HISTORY (Last ${dom.chatBubbles ? dom.chatBubbles.length : 0}) ---');
        if (dom.chatBubbles && dom.chatBubbles.length > 0) {
            dom.chatBubbles.forEach((b, idx) => {
                const prefix = b.sender === 'bot' ? '🤖 BOT' : '👤 USER';
                console.log(`[${idx + 1}] ${prefix}: ${b.text.replace(/\n+/g, ' ')}`);
            });
        } else {
            console.log('   (No chat bubbles currently in DOM)');
        }

        console.log('\n🔘 --- VISIBLE OPTION BUTTONS ---');
        if (dom.optionButtons && dom.optionButtons.length > 0) {
            dom.optionButtons.forEach(b => {
                console.log(`   • [${b.label}] -> value: "${b.value}"`);
            });
        } else {
            console.log('   (No quick-reply option buttons visible)');
        }

        console.log('\n🚀 --- SUBMIT / ACTION BUTTONS ---');
        if (dom.submitButtons && dom.submitButtons.length > 0) {
            dom.submitButtons.forEach(b => {
                console.log(`   • ${b.text} [ID: ${b.id || 'N/A'}] -> Visible: ${b.visible ? 'YES ⚠️' : 'NO'}`);
            });
        } else {
            console.log('   (No submit buttons detected)');
        }

        console.log('\n📋 --- RIGHT SIDEBAR STATE ---');
        const sb = dom.sidebar || {};
        console.log(`Name                : ${sb.customerName || '(empty)'}`);
        console.log(`Mobile              : ${sb.mobile || '(empty)'}`);
        console.log(`Aadhaar             : ${sb.aadhaar || '(empty)'}`);
        console.log(`Active Service      : ${sb.activeService || '(none)'}`);
        console.log(`Income Box Visible  : ${sb.incomeBoxVisible ? 'YES ⚠️' : 'NO ✅'}`);
        console.log(`Remove Member Box   : ${sb.removeMemberBoxVisible ? 'YES ⚠️' : 'NO ✅'}`);
        console.log(`Gas Box Visible     : ${sb.gasBoxVisible ? 'YES' : 'NO'}`);

        console.log('\n🤖 --- PORTAL AUTOMATION ENGINE ---');
        const auto = result.automationInfo || {};
        console.log(`Automation Running  : ${auto.isRunning ? 'YES 🚀' : 'NO (Idle)'}`);
        if (auto.activePortalUrl) console.log(`Portal URL          : ${auto.activePortalUrl}`);
        if (auto.activePortalTitle) console.log(`Portal Title        : ${auto.activePortalTitle}`);
        if (auto.portalScreenshotSaved) console.log(`Portal Screenshot   : live_portal_screen.png saved ✅`);
        if (auto.status) console.log(`Portal Status       : ${JSON.stringify(auto.status)}`);

        console.log('\n======================================================');
    } catch (err) {
        console.error('❌ [Live Inspector Error]:', err.message);
        process.exit(1);
    }
})();
