const fs = require('fs');
const content = fs.readFileSync('scratch/chunk-BG9H0A5i.js', 'utf8');

let idx = 0;
while ((idx = content.indexOf('verifyMobileOTP', idx)) !== -1) {
    console.log(`verifyMobileOTP at ${idx}:`);
    console.log(content.substring(idx - 50, idx + 800));
    idx += 15;
}
