const { startTnpdsRationCardFlow } = require('./tnpds_automation');
const { getCitizenProfile } = require('./database');

async function runMockSandboxTest() {
    console.log('\n======================================================');
    console.log('Starting TNPDS Real 51-Step Automation in Mock Sandbox');
    console.log('Watch the browser window open and fill every single field!');
    console.log('======================================================\n');

    const profile = getCitizenProfile('9790170026');
    if (!profile) {
        console.error('Citizen profile not found!');
        return;
    }

    const result = await startTnpdsRationCardFlow(
        profile,
        (progressMsg) => console.log(progressMsg),
        { isMockSandbox: true }
    );

    console.log('\n======================================================');
    console.log('Test Execution Result:');
    console.log(result);
    console.log('👀 பிரவுசரை நீங்கள் நேரில் ஆய்வு செய்வதற்காக 5 நிமிடங்கள் திறந்து வைக்கப்பட்டுள்ளது...');
    console.log('======================================================\n');
    await new Promise(r => setTimeout(r, 300000));
}

if (require.main === module) {
    runMockSandboxTest();
}

module.exports = { runMockSandboxTest };
