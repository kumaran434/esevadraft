const https = require('https');

https.get('https://www.tnpds.gov.in/pages/home', res => {
    let html = '';
    res.on('data', c => html += c);
    res.on('end', () => {
        const matches = html.match(/src=["']([^"']+\.js[^"']*)["']/g) || [];
        matches.forEach(m => console.log(m));
    });
}).on('error', e => console.error(e));
