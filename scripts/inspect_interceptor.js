const fs = require('fs');
const content = fs.readFileSync('scratch/tnpds_main.js', 'utf8');

// Find the eservice definition or http interceptor
let idx = content.indexOf('ShowError(`Unauthorized`)');
console.log('Interceptor area:', content.substring(idx - 300, idx + 200));
