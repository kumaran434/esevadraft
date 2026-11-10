const fs = require('fs');
const path = require('path');

const files = fs.readdirSync('scratch').filter(f => f.endsWith('.js'));
for (const file of files) {
    const full = path.join('scratch', file);
    const content = fs.readFileSync(full, 'utf8');
    let idx = 0;
    while ((idx = content.indexOf('Unauthorized', idx)) !== -1) {
        console.log(`\nFound "Unauthorized" in ${file} at ${idx}:`);
        console.log(content.substring(Math.max(0, idx - 150), Math.min(content.length, idx + 250)));
        idx += 12;
    }
}
