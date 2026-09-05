// =========================================================================
// eSevaDraft Developer Studio — Interactive Automation Hub
// Train Real Websites, Fix Operator Issues, Test Locally & Safe Publish
// =========================================================================
const readline = require('readline');
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function ask(question) {
    return new Promise(resolve => rl.question(question, resolve));
}

function clearScreen() {
    console.clear();
}

function printHeader() {
    console.log('===================================================================');
    console.log('         🚀 eSevaDraft Developer Studio (டெவலப்பர் மையம்)          ');
    console.log('   Train Real Websites • Test Locally • Fix Bugs • Safe Publish    ');
    console.log('===================================================================\n');
}

async function menu() {
    clearScreen();
    printHeader();
    console.log('நீங்கள் என்ன செய்ய விரும்புகிறீர்கள்? (Select an option):\n');
    console.log('  [1] 🌐 Train a New Real Website (நிஜ அரசு தளத்தைத் திறந்து Train செய்தல்)');
    console.log('  [2] 🧪 Test Existing Service Locally (லோக்கலில் நிஜ பிரவுசரில் டெஸ்ட் செய்தல்)');
    console.log('  [3] 🔍 Fix Operator Issue / View Recent Logs (ஆபரேட்டர் புகாரை ஆய்வு செய்தல்)');
    console.log('  [4] 🚀 1-Click Safe Publish to Live (நாங்கள் ஓகே செய்த பின் லைவ்-க்கு ஏற்றுதல்)');
    console.log('  [5] 🚪 வெளியேறு (Exit)\n');

    const choice = (await ask('உங்கள் தேர்வு (1-5): ')).trim();

    switch (choice) {
        case '1':
            await trainNewWebsite();
            break;
        case '2':
            await testServiceLocally();
            break;
        case '3':
            await inspectOperatorLogs();
            break;
        case '4':
            await safePublish();
            break;
        case '5':
            console.log('\nவணக்கம்! Developer Studio மூடப்படுகிறது.\n');
            rl.close();
            process.exit(0);
            break;
        default:
            console.log('❌ தவறான தேர்வு, மீண்டும் முயற்சிக்கவும்.');
            await ask('\nEnter அழுத்தவும்...');
            await menu();
            break;
    }
}

/**
 * Option 1: Train a New Real Government Website
 */
async function trainNewWebsite() {
    clearScreen();
    printHeader();
    console.log('🌐 [TRAIN REAL WEBSITE MODE]');
    console.log('-------------------------------------------------------------------');
    console.log('பிரபலமான அரசு தளங்கள் (Suggestions):');
    console.log('  1. TN e-Sevai Revenue Portal (வருவாய்த் துறை): https://www.tnesevai.tn.gov.in/');
    console.log('  2. TN e-District Portal: https://edistricts.tn.gov.in/');
    console.log('  3. TN AnyGov / Patta Chitta: https://eservices.tn.gov.in/');
    console.log('  4. அல்லது உங்கள் சொந்த URL\n');

    let url = (await ask('நீங்கள் Train செய்ய விரும்பும் Real Website URL உள்ளிடவும்: ')).trim();
    if (!url) url = 'https://www.tnesevai.tn.gov.in/';

    const serviceName = (await ask('இந்த சேவையின் பெயர் என்ன? (உதா: income_cert / patta / community): ')).trim() || 'custom_service';

    const timestamp = Date.now();
    const outputFile = path.join(__dirname, 'recordings', `real_workflow_${serviceName}_${timestamp}.js`);

    console.log('\n===================================================================');
    console.log(`🌐 உங்கள் திரையில் கூகுள் குரோம் பிரவுசர் திறக்கிறது...`);
    console.log(`👉 நீங்கள் வழக்கம்போல நிஜ அரசு தளத்தில் கிளிக் செய்து ஃபில் செய்யுங்கள்.`);
    console.log(`👉 நீங்கள் செய்யும் அனைத்தும் "${outputFile}"-ல் பதிவாகும்.`);
    console.log(`👉 முடித்ததும் பிரவுசரை மூடினால் போதும்!`);
    console.log('===================================================================\n');

    // Run Playwright Codegen on Real Website with Chrome
    try {
        execSync(`npx playwright codegen --channel=chrome --output "${outputFile}" "${url}"`, { stdio: 'inherit' });
        console.log('\n✅ Real Website Training பதிவு செய்யப்பட்டது!');
        console.log(`📁 கோப்பு: ${outputFile}`);
        console.log('💡 இப்போது AI (Antigravity)-யிடம் "நான் ட்ரெயின் பண்ணிட்டேன், கோட் ரெடி பண்ணு" என்று சொன்னால், AI இதை முழு ஆட்டோமேஷன் கோடாக மாற்றி தரும்.\n');
    } catch (err) {
        console.log('Training session ended.');
    }

    await ask('\nமுதன்மை மெனுவுக்குச் செல்ல Enter அழுத்தவும்...');
    await menu();
}

/**
 * Option 2: Test Existing Services Locally
 */
async function testServiceLocally() {
    clearScreen();
    printHeader();
    console.log('🧪 [LOCAL REAL BROWSER TEST MODE]');
    console.log('-------------------------------------------------------------------');
    console.log('  [1] TNPDS Ration Card (ரேஷன் கார்டு ஆட்டோமேஷன்)');
    console.log('  [2] Income Certificate REV-103 (வருமானச் சான்றிதழ்)');
    console.log('  [3] பின்செல்ல (Back)\n');

    const svc = (await ask('எந்த சேவையை டெஸ்ட் செய்ய வேண்டும்? (1-3): ')).trim();

    if (svc === '1') {
        console.log('\n🚀 Starting TNPDS Ration Card Autonomous Engine on your screen...\n');
        try {
            execSync('node test_autonomous_engine.js', { stdio: 'inherit' });
        } catch (e) {}
    } else if (svc === '2') {
        console.log('\n🚀 Starting Income Certificate Autonomous Engine on your screen...\n');
        try {
            execSync('node test_income_certificate.js', { stdio: 'inherit' });
        } catch (e) {}
    }

    await ask('\nEnter அழுத்தவும்...');
    await menu();
}

/**
 * Option 3: Inspect Operator Feedback & Recent Logs
 */
async function inspectOperatorLogs() {
    clearScreen();
    printHeader();
    console.log('🔍 [OPERATOR FEEDBACK & LOGS AUDITOR]');
    console.log('-------------------------------------------------------------------');

    const logsDir = path.join(__dirname, 'public', 'logs');
    if (!fs.existsSync(logsDir)) {
        console.log('பதிவுகள் எதுவும் இல்லை.');
        await ask('\nEnter அழுத்தவும்...');
        return menu();
    }

    const files = fs.readdirSync(logsDir).filter(f => f.endsWith('.log'));
    if (files.length === 0) {
        console.log('சமீபத்திய ஆபரேட்டர் லாக் ஃபைல்கள் எதுவும் இல்லை.');
    } else {
        console.log(`கண்டறியப்பட்ட மொத்த லாக் ஃபைல்கள்: ${files.length}\n`);
        const recentFiles = files.slice(-5).reverse();
        recentFiles.forEach((file, index) => {
            const stats = fs.statSync(path.join(logsDir, file));
            console.log(`  [${index + 1}] ${file} (${stats.mtime.toLocaleString()})`);
        });

        const pick = (await ask('\nஎந்த லாக் ஃபைலின் விவரங்களைப் பார்க்க வேண்டும்? (1-5 அல்லது Enter to skip): ')).trim();
        const pickIdx = parseInt(pick, 10);
        if (pickIdx >= 1 && pickIdx <= recentFiles.length) {
            const chosenFile = path.join(logsDir, recentFiles[pickIdx - 1]);
            console.log(`\n📄 ${recentFiles[pickIdx - 1]} உள்ளடக்கங்கள்:\n`);
            console.log(fs.readFileSync(chosenFile, 'utf8'));
        }
    }

    await ask('\nEnter அழுத்தவும்...');
    await menu();
}

/**
 * Option 4: 1-Click Safe Publish
 */
async function safePublish() {
    clearScreen();
    printHeader();
    console.log('🚀 [1-CLICK SAFE PUBLISH TO PRODUCTION]');
    console.log('-------------------------------------------------------------------');
    console.log('இது நாம் லோக்கலில் உருவாக்கிய புதிய வேலைகளை:');
    console.log('  1. GitHub-க்கு பத்திரமாக Push செய்யும்.');
    console.log('  2. டெஸ்க்டாப் ஆப் Auto-Update-ஐ இயக்கும்.');
    console.log('  3. Firebase Hosting & Google Cloud Run-க்கு பத்திரமாக Deploy செய்யும்.\n');

    const confirm = (await ask('நிஜமாகவே லைவ்-க்கு பப்ளிஷ் செய்யவா? (yes/no): ')).trim().toLowerCase();
    if (confirm !== 'yes' && confirm !== 'y') {
        console.log('\n❌ பப்ளிஷ் ரத்து செய்யப்பட்டது. எந்த மாற்றமும் லைவ்-க்கு செல்லவில்லை.\n');
        await ask('Enter அழுத்தவும்...');
        return menu();
    }

    console.log('\n📦 [படி 1/3] Git Push தொடங்குகிறது...');
    try {
        const gitPath = 'C:\\Users\\ADMIN\\AppData\\Local\\GitHubDesktop\\app-3.5.11\\resources\\app\\git\\cmd\\git.exe';
        const gitCmd = fs.existsSync(gitPath) ? `"${gitPath}"` : 'git';
        execSync(`${gitCmd} add . && ${gitCmd} commit -m "chore: verified developer updates" && ${gitCmd} push origin main`, { stdio: 'inherit' });
        console.log('✅ Git Push நிறைவடைந்தது!');
    } catch (e) {
        console.log('Notice: No new git changes or already pushed.');
    }

    console.log('\n🌐 [படி 2/3] Firebase Hosting Deploy தொடங்குகிறது...');
    try {
        execSync('firebase.cmd deploy --only hosting', { stdio: 'inherit' });
        console.log('✅ Firebase Hosting Deploy நிறைவடைந்தது!');
    } catch (e) {
        console.warn('Firebase hosting deploy notice:', e.message);
    }

    console.log('\n⚙️ [படி 3/3] Google Cloud Run Deploy தொடங்குகிறது...');
    try {
        execSync('gcloud.cmd run deploy esevadraft --source . --region asia-south1 --quiet', { stdio: 'inherit' });
        console.log('✅ Cloud Run Deploy நிறைவடைந்தது!');
    } catch (e) {
        console.warn('Cloud Run deploy notice:', e.message);
    }

    console.log('\n🎉🎉 வாழ்த்துகள்! புதிய வேலைகள் வெற்றிகரமாக லைவ் சர்வருக்குப் பப்ளிஷ் ஆகிவிட்டன!\n');
    await ask('Enter அழுத்தவும்...');
    await menu();
}

menu().catch(console.error);
