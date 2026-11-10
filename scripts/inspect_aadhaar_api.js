const fs = require('fs');
const bundle = fs.readFileSync('scratch/tnpds_main.js', 'utf8');

function searchFullContext(query) {
    console.log(`\n=================== SEARCH: ${query} ===================`);
    let idx = 0;
    while ((idx = bundle.indexOf(query, idx)) !== -1) {
        console.log(`--- Match at ${idx} ---`);
        console.log(bundle.substring(Math.max(0, idx - 300), Math.min(bundle.length, idx + 600)));
        idx += query.length;
    }
}

searchFullContext('request_Aadhar_otp');
searchFullContext('verify_Aadhar_otp');
