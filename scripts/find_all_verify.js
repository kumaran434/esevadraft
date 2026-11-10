const fs = require('fs');
const path = require('path');

const files = fs.readdirSync('scratch').filter(f => f.endsWith('.js'));
for (const file of files) {
    const full = path.join('scratch', file);
    const content = fs.readFileSync(full, 'utf8');
    let idx = 0;
    while ((idx = content.indexOf('verify_Aadhar_otp', idx)) !== -1) {
        console.log(`Found in ${file} at ${idx}:`, content.substring(idx - 100, idx + 200));
        idx += 17;
    }
}
