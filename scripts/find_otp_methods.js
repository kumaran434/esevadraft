const fs = require('fs');
const content = fs.readFileSync('scratch/chunk-BG9H0A5i.js', 'utf8');

// Find all occurrences of "otp" case-insensitive
let idx = 0;
let results = [];
while ((idx = content.toLowerCase().indexOf('otp', idx)) !== -1) {
    const start = Math.max(0, idx - 100);
    const end = Math.min(content.length, idx + 150);
    results.push(content.substring(start, end));
    idx += 3;
    if (results.length > 30) break;
}

results.forEach((r, i) => {
    console.log(`\n--- RESULT ${i + 1} ---`);
    console.log(r);
});
