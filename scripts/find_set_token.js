const fs = require('fs');
const content = fs.readFileSync('scratch/tnpds_main.js', 'utf8');

let idx = 0;
while ((idx = content.indexOf(`setItem('token'`, idx)) !== -1) {
    console.log(content.substring(idx - 50, idx + 200));
    idx += 15;
}
idx = 0;
while ((idx = content.indexOf(`setItem(\`token\``, idx)) !== -1) {
    console.log(content.substring(idx - 50, idx + 200));
    idx += 15;
}
