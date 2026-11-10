const fs = require('fs');
const content = fs.readFileSync('scratch/chunk-BG9H0A5i.js', 'utf8');

let compIdx = content.indexOf('function Mn(');
let constsIdx = content.lastIndexOf('consts:', compIdx);
let openBracket = content.indexOf('[', constsIdx);
let endBracket = content.indexOf(']],template:', constsIdx) + 2;
let constsStr = content.substring(openBracket, endBracket);

const arr = eval(constsStr);
console.log('144:', JSON.stringify(arr[144]));
console.log('127:', JSON.stringify(arr[127]));
console.log('256:', JSON.stringify(arr[256]));
console.log('271:', JSON.stringify(arr[271]));
console.log('272:', JSON.stringify(arr[272]));
console.log('273:', JSON.stringify(arr[273]));
console.log('275:', JSON.stringify(arr[275]));
