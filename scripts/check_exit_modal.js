const fs = require('fs');
const content = fs.readFileSync('scratch/chunk-BG9H0A5i.js', 'utf8');

let idx = content.indexOf('வெளியேறுதல்');
if (idx !== -1) {
    console.log(content.substring(idx - 100, idx + 400));
} else {
    console.log('Not in chunk-BG, checking tnpds_main...');
    const m = fs.readFileSync('scratch/tnpds_main.js', 'utf8');
    let idx2 = m.indexOf('வெளியேறுதல்');
    if (idx2 !== -1) console.log(m.substring(idx2 - 100, idx2 + 400));
}
