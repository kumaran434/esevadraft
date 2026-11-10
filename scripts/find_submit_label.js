const fs = require('fs');
const content = fs.readFileSync('scratch/tnpds_main.js', 'utf8');

let idx = content.indexOf('CARD_MUTATIONS_PAGE.OTP_MODAL.SUBMIT');
if (idx !== -1) {
    console.log(content.substring(idx - 50, idx + 200));
} else {
    console.log('Not in tnpds_main.js, searching other files...');
    const files = fs.readdirSync('scratch').filter(f => f.endsWith('.js'));
    for (const f of files) {
        const c = fs.readFileSync('scratch/' + f, 'utf8');
        let i = c.indexOf('CARD_MUTATIONS_PAGE.OTP_MODAL.SUBMIT');
        if (i !== -1) {
            console.log(`Found in ${f}:`, c.substring(i - 50, i + 200));
        }
    }
}
