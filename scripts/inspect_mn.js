const fs = require('fs');
const content = fs.readFileSync('scratch/chunk-BG9H0A5i.js', 'utf8');
let idx = content.indexOf('function Mn(');
console.log(content.substring(idx, idx + 2000));
