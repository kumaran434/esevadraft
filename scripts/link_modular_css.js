const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'public', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

const startTag = '<style>';
const endTag = '</style>';
const sIdx = html.indexOf(startTag);
const eIdx = html.indexOf(endTag, sIdx);

if (sIdx !== -1 && eIdx !== -1) {
    const before = html.substring(0, sIdx);
    const after = html.substring(eIdx + endTag.length);
    const replacement = '<link rel="stylesheet" href="/css/main.css">';
    fs.writeFileSync(indexPath, before + replacement + after, 'utf8');
    console.log('Successfully linked /css/main.css in public/index.html');
} else {
    console.error('Tags not found');
}
