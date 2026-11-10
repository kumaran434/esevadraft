const fs = require('fs');
const content = fs.readFileSync('scratch/chunk-BG9H0A5i.js', 'utf8');

// Look for where Mn is referenced in the component definition
let idx = content.indexOf('Mn,');
if (idx === -1) idx = content.indexOf('Mn');
console.log('Mn reference:', content.substring(idx - 100, idx + 400));
