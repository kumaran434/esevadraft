const fs = require('fs');
const bundle = fs.readFileSync('scratch/tnpds_main.js', 'utf8');

function findUsage(prop) {
    console.log(`\n=================== USAGE OF: ${prop} ===================`);
    let idx = 0;
    while ((idx = bundle.indexOf(prop, idx)) !== -1) {
        // Exclude the definition at 411471 / 411518
        if (idx !== 411471 && idx !== 411518) {
            console.log(`--- Call at ${idx} ---`);
            console.log(bundle.substring(Math.max(0, idx - 400), Math.min(bundle.length, idx + 600)));
        }
        idx += prop.length;
    }
}

findUsage('request_Aadhar_otp');
findUsage('verify_Aadhar_otp');
