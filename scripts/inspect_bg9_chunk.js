const fs = require('fs');
const content = fs.readFileSync('scratch/chunk-BG9H0A5i.js', 'utf8');

function searchMatches(query, max = 5) {
    console.log(`\n=================== SEARCH: ${query} ===================`);
    let idx = 0;
    let count = 0;
    while ((idx = content.indexOf(query, idx)) !== -1) {
        count++;
        console.log(`--- Match ${count} at ${idx} ---`);
        console.log(content.substring(Math.max(0, idx - 200), Math.min(content.length, idx + 400)));
        idx += query.length;
        if (count >= max) break;
    }
}

searchMatches('verifyAadharOTP');
searchMatches('ShowError("Unauthorized")');
searchMatches('isAadharOTPsubmitting');
