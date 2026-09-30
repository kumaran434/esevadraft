/**
 * eSevaDraft — Operator Error Telemetry Viewer
 * Usage:
 *   node scripts/view_operator_errors.js
 *   node scripts/view_operator_errors.js --limit 50
 *   node scripts/view_operator_errors.js --remote  (queries https://esevadraft.in/api/telemetry/errors)
 */

require('dotenv').config();
const { listOperatorErrors } = require('../firestore_db');

async function main() {
    const args = process.argv.slice(2);
    const limitArg = args.indexOf('--limit') !== -1 ? parseInt(args[args.indexOf('--limit') + 1], 10) : 25;
    const isRemote = args.includes('--remote');

    console.log('\n===============================================================');
    console.log('📡 eSevaDraft — Operator Error Telemetry & Live Diagnostics');
    console.log(`🔍 Fetching latest ${limitArg} operator errors... [Mode: ${isRemote ? 'Remote Production API' : 'Direct Firestore / Local'}]`);
    console.log('===============================================================\n');

    let errors = [];

    if (isRemote) {
        try {
            const baseUrl = process.env.ESEVA_DEV_URL || 'https://esevadraft.in';
            const res = await fetch(`${baseUrl}/api/telemetry/errors?limit=${limitArg}`);
            const data = await res.json();
            errors = data.errors || [];
        } catch (e) {
            console.warn('⚠️ Remote API query failed, falling back to direct db:', e.message);
            errors = await listOperatorErrors(limitArg);
        }
    } else {
        errors = await listOperatorErrors(limitArg);
    }

    if (!errors || errors.length === 0) {
        console.log('✅ அருமை! தற்போது எந்த ஆபரேட்டருக்கும் பிழைகள் இல்லை (No operator errors found).');
        console.log('All operator desks are running clean and healthy!\n');
        return;
    }

    console.log(`Found ${errors.length} error record(s):\n`);

    const tableData = errors.map((err, idx) => {
        const timeStr = err.timestamp ? new Date(err.timestamp).toLocaleTimeString('en-IN', { hour12: true }) : '—';
        const dateStr = err.timestamp ? new Date(err.timestamp).toISOString().split('T')[0] : '—';
        return {
            '#': idx + 1,
            'Time': `${dateStr} ${timeStr}`,
            'Operator': err.operatorMobile || err.operatorName || 'unknown',
            'Customer': err.customerMobile || '—',
            'Step': err.step || '—',
            'Type': err.errorType || 'ERROR',
            'Version': err.appVersion || '—',
            'Message': (err.errorMessage || '').substring(0, 60)
        };
    });

    console.table(tableData);

    console.log('\n💡 Full Details for the most recent error:');
    const latest = errors[0];
    console.log(JSON.stringify(latest, null, 2));
    console.log('\n===============================================================\n');
}

main().catch(err => {
    console.error('Diagnostic error:', err);
    process.exit(1);
});
