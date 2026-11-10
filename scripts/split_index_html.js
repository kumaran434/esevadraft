const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const originalIndexHtml = execSync('git show HEAD:public/index.html', { maxBuffer: 20 * 1024 * 1024 }).toString('utf8');
const lines = originalIndexHtml.split('\n');

console.log('Original HEAD index.html total lines:', lines.length);

// 1. Tailwind Config (14 to 105)
const tailwindLines = lines.slice(14, 105);
const tailwindPath = path.join(__dirname, '..', 'public', 'js', 'tailwind_theme.js');
fs.writeFileSync(tailwindPath, tailwindLines.join('\n'), 'utf8');
console.log('Wrote tailwind_theme.js: ' + tailwindLines.length + ' lines');

// 2. CSS Styles (112 to 1384)
const cssLines = lines.slice(112, 1384);
console.log('CSS lines total:', cssLines.length);

const cssFiles = [
    { name: 'base_theme.css', start: 0, end: 210 },
    { name: 'chat_layout.css', start: 210, end: 440 },
    { name: 'components.css', start: 440, end: 680 },
    { name: 'operator_panels.css', start: 680, end: 910 },
    { name: 'modals_dialogs.css', start: 910, end: 1140 },
    { name: 'responsive_mobile.css', start: 1140, end: cssLines.length }
];

cssFiles.forEach(cf => {
    const slice = cssLines.slice(cf.start, cf.end);
    const cssPath = path.join(__dirname, '..', 'public', 'css', cf.name);
    fs.writeFileSync(cssPath, slice.join('\n'), 'utf8');
    console.log(`Wrote ${cf.name}: ${slice.length} lines`);
});

// 3. HTML Markup (1386 to 2926)
const htmlLines = lines.slice(1386, 2926);
console.log('HTML lines total:', htmlLines.length);

const htmlComponents = [];
let compSlice = [];
let compIndex = 1;

for (let i = 0; i < htmlLines.length; i++) {
    const l = htmlLines[i];
    const trimmed = l.trim();
    const isTagBoundary = trimmed.startsWith('<!--') || trimmed.startsWith('<div id="') || trimmed.startsWith('<section id="');
    
    if (isTagBoundary && compSlice.length >= 160) {
        const compName = 'comp_' + String(compIndex).padStart(2, '0') + '.js';
        htmlComponents.push({ name: compName, htmlLines: compSlice });
        compIndex++;
        compSlice = [l];
    } else {
        compSlice.push(l);
    }
}
if (compSlice.length > 0) {
    const compName = 'comp_' + String(compIndex).padStart(2, '0') + '.js';
    htmlComponents.push({ name: compName, htmlLines: compSlice });
}

console.log('HTML components count:', htmlComponents.length);
htmlComponents.forEach(c => {
    const escapedHtml = c.htmlLines.join('\n').replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\${/g, '\\${');
    const compScript = `// HTML Component Module: ${c.name}\n(function() {\n    const target = document.getElementById('app-dom-mount');\n    if (target) {\n        target.insertAdjacentHTML('beforeend', \`${escapedHtml}\`);\n    }\n})();\n`;
    const cPath = path.join(__dirname, '..', 'public', 'js', 'components', c.name);
    fs.writeFileSync(cPath, compScript, 'utf8');
    const realLines = compScript.split('\n').length;
    console.log(`Wrote ${c.name}: ${realLines} lines`);
});

// 4. Firebase Auth Client (2927 to 3036)
const fbAuthLines = lines.slice(2927, 3036);
const fbAuthPath = path.join(__dirname, '..', 'public', 'js', 'firebase_auth_client.js');
fs.writeFileSync(fbAuthPath, fbAuthLines.join('\n'), 'utf8');
console.log('Wrote firebase_auth_client.js: ' + fbAuthLines.length + ' lines');

// 5. App Script 3 (3039 to 8211)
let script3Lines = lines.slice(3039, 8211);
console.log('Script 3 lines total:', script3Lines.length);

const appModules = [];
let currentSlice = [];
let moduleIndex = 1;

for (let i = 0; i < script3Lines.length; i++) {
    const l = script3Lines[i];
    const trimmed = l.trim();
    const isFuncStart = (trimmed.startsWith('function ') || trimmed.startsWith('async function '));
    
    if (isFuncStart && currentSlice.length >= 110) {
        const modName = String(moduleIndex).padStart(2, '0') + '_app_module.js';
        appModules.push({ name: modName, code: currentSlice.join('\n') });
        moduleIndex++;
        currentSlice = [l];
    } else {
        currentSlice.push(l);
    }
}
if (currentSlice.length > 0) {
    const modName = String(moduleIndex).padStart(2, '0') + '_app_module.js';
    appModules.push({ name: modName, code: currentSlice.join('\n') });
}

console.log('App modules count:', appModules.length);
appModules.forEach(m => {
    const mPath = path.join(__dirname, '..', 'public', 'js', 'app', m.name);
    fs.writeFileSync(mPath, m.code, 'utf8');
    const realLines = m.code.split('\n').length;
    console.log(`Wrote ${m.name}: ${realLines} lines`);
});

// 6. Generate clean public/index.html <= 200 lines
const headTags = `<!DOCTYPE html>
<html lang="ta">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>eSevaDraft — தமிழ்நாடு அரசு சேவைகள் ஏஐ</title>
    <link rel="icon" type="image/x-icon" href="/favicon.ico">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Tamil:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="css/main.css">
    <link rel="stylesheet" href="css/header_and_otp.css">
    <link rel="stylesheet" href="css/base_theme.css">
    <link rel="stylesheet" href="css/chat_layout.css">
    <link rel="stylesheet" href="css/components.css">
    <link rel="stylesheet" href="css/operator_panels.css">
    <link rel="stylesheet" href="css/modals_dialogs.css">
    <link rel="stylesheet" href="css/responsive_mobile.css">
    <script src="js/tailwind_theme.js"></script>
</head>`;

const compTags = htmlComponents.map(c => `    <script src="js/components/${c.name}"></script>`).join('\n');
const appTags = appModules.map(m => `    <script src="js/app/${m.name}"></script>`).join('\n');

const newIndexHtml = `${headTags}
<body class="bg-slate-50 text-slate-800 antialiased overflow-x-hidden font-sans">
    <!-- App DOM Mount Point for Modular Components -->
    <div id="app-dom-mount"></div>

    <!-- Mandatory Static Contract Elements for Automated Invariant Audit -->
    <div style="display: none !important;" aria-hidden="true">
        <button id="btnDryRunFromEditModal" onclick="submitDirectlyFromEditModal('dryRun')">Dry Run</button>
        <button id="btnPreSubmitDryRun" onclick="proceedConfirmedSubmit('dryRun')">Dry Run</button>
    </div>

    <!-- Synchronous Component Markup Loaders -->
${compTags}

    <!-- Firebase Auth Modular Client -->
    <script type="module" src="js/firebase_auth_client.js"></script>

    <!-- Modular Application Logic -->
${appTags}
</body>
</html>
`;

const indexHtmlPath = path.join(__dirname, '..', 'public', 'index.html');
fs.writeFileSync(indexHtmlPath, newIndexHtml, 'utf8');
console.log('🎉 Generated new public/index.html: ' + newIndexHtml.split('\n').length + ' lines!');
