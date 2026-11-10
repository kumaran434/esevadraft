const fs = require('fs');
const content = fs.readFileSync('scratch/chunk-BG9H0A5i.js', 'utf8');

// Parse the consts array using JSON-like regex or vm
let compIdx = content.indexOf('function Mn(');
let constsIdx = content.lastIndexOf('consts:', compIdx);
let openBracket = content.indexOf('[', constsIdx);
// Let's grab the consts string until template:
let templateIdx = content.indexOf('template:', constsIdx);
let constsStr = content.substring(openBracket, templateIdx).trim();
if (constsStr.endsWith(',')) constsStr = constsStr.slice(0, -1);

try {
    const arr = eval(constsStr);
    console.log('Total consts items:', arr.length);
    console.log('144:', arr[144]);
    console.log('127:', arr[127]);
    console.log('271:', arr[271]);
    console.log('272:', arr[272]);
    console.log('273:', arr[273]);
    console.log('275:', arr[275]);
} catch (e) {
    console.log('Eval error:', e.message);
}
