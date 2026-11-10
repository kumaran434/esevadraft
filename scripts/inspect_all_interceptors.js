const fs = require('fs');
const content = fs.readFileSync('scratch/tnpds_main.js', 'utf8');

let idx = content.indexOf('var Qt=');
console.log('Interceptors around Qt:\n', content.substring(idx - 600, idx + 600));
