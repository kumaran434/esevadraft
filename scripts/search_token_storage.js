const fs = require('fs');
const path = require('path');

const files = fs.readdirSync('scratch').filter(f => f.endsWith('.js'));
for (const file of files) {
    const full = path.join('scratch', file);
    const content = fs.readFileSync(full, 'utf8');
    let idx = 0;
    while ((idx = content.indexOf('token', idx)) !== -1) {
        let chunk = content.substring(Math.max(0, idx - 50), Math.min(content.length, idx + 80));
        if (chunk.includes('Storage') || chunk.includes('set')) {
            console.log(`In ${file}:`, chunk);
        }
        idx += 5;
    }
}
