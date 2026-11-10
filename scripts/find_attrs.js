const fs = require('fs');
const content = fs.readFileSync('scratch/chunk-BG9H0A5i.js', 'utf8');

// Search for `const ... = [` or `var ... = [` containing 144 or 273 or "btn-success"
let idx = content.indexOf('const ');
let matches = [];
const regex = /const\s+([a-zA-Z0-9_$]+)\s*=\s*\[(.*?)\];/gs;
// Or let's search for "CARD_MUTATIONS_PAGE.OTP_MODAL.SUBMIT"
let submitIdx = content.indexOf('CARD_MUTATIONS_PAGE.OTP_MODAL.SUBMIT');
console.log('Near submit string:', content.substring(submitIdx - 200, submitIdx + 300));

// Also search for classes around modal buttons
let btnSuccessIdx = 0;
while ((btnSuccessIdx = content.indexOf('btn-success', btnSuccessIdx)) !== -1) {
    console.log('btn-success context:', content.substring(btnSuccessIdx - 100, btnSuccessIdx + 150));
    btnSuccessIdx += 11;
    if (matches.length > 5) break;
}
