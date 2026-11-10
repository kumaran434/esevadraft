const fs = require('fs');
const bundle = fs.readFileSync('scratch/tnpds_main.js', 'utf8');

function searchMatches(query, max = 5) {
    console.log(`\n=================== SEARCH: ${query} ===================`);
    let idx = 0;
    let count = 0;
    while ((idx = bundle.indexOf(query, idx)) !== -1) {
        count++;
        console.log(`--- Match ${count} at ${idx} ---`);
        console.log(bundle.substring(Math.max(0, idx - 150), Math.min(bundle.length, idx + 250)));
        idx += query.length;
        if (count >= max) break;
    }
}

searchMatches('XSD');
searchMatches('newsmartcard');
searchMatches('otp');
