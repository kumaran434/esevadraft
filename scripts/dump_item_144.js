const fs = require('fs');
const content = fs.readFileSync('scratch/chunk-BG9H0A5i.js', 'utf8');

// Search for `consts:[` and extract each element
let compIdx = content.indexOf('function Mn(');
let constsIdx = content.lastIndexOf('consts:', compIdx);
let open = content.indexOf('[', constsIdx);
let end = content.indexOf(']],template:', constsIdx) + 1;

let str = content.substring(open, end);
// Split by elements or find index 144
let items = [];
let depth = 0;
let current = '';
for (let i = 1; i < str.length - 1; i++) {
    let char = str[i];
    if (char === '[' && depth === 0) {
        current = '[';
        depth++;
    } else if (depth > 0) {
        current += char;
        if (char === '[') depth++;
        else if (char === ']') {
            depth--;
            if (depth === 0) {
                items.push(current);
                current = '';
            }
        }
    }
}

console.log('Total items parsed:', items.length);
console.log('Item 144:', items[144]);
console.log('Item 127:', items[127]);
console.log('Item 256:', items[256]);
console.log('Item 266:', items[266]);
console.log('Item 271:', items[271]);
console.log('Item 272:', items[272]);
console.log('Item 273:', items[273]);
console.log('Item 275:', items[275]);
