const fs = require('fs');
const content = fs.readFileSync('scratch/chunk-BG9H0A5i.js', 'utf8');

let idx = 0;
while ((idx = content.indexOf('verify_Aadhar_otp', idx)) !== -1) {
    console.log(content.substring(idx - 100, idx + 200));
    idx += 17;
}
