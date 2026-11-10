const fs = require('fs');
const content = fs.readFileSync('scratch/chunk-BG9H0A5i.js', 'utf8');

// Search for the translation key or words
let idx = content.indexOf('CARD_MUTATIONS_PAGE.OTP_MODAL.SUBMIT');
console.log(content.substring(idx - 100, idx + 100));
