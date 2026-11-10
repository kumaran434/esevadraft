const fs = require('fs');
const content = fs.readFileSync('scratch/chunk-BG9H0A5i.js', 'utf8');

// Find the attrs array that has index 144
// In Angular template compiler:
// xi$1(0, 'div', 144) means element 'div' with attributes at consts[144]
// Or let's search for "144" in the consts definition of this component
let compIdx = content.indexOf('function Mn(');
// Search backward for the consts definition or forward
let constsIdx = content.indexOf('consts:', compIdx);
if (constsIdx === -1) constsIdx = content.lastIndexOf('consts:', compIdx);
console.log('consts near Mn:', content.substring(constsIdx, constsIdx + 600));
