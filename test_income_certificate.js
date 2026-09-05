// =========================================================================
// Tamil Nadu e-Sevai Income Certificate (வருமானச் சான்றிதழ்)
// Developer Local Live Sandbox Test Runner
// =========================================================================
const { startIncomeCertificateFlow } = require('./income_certificate_automation');

async function runIncomeCertificateDemo() {
    console.log('\n===================================================================');
    console.log('       e-Sevai AI: வருமானச் சான்றிதழ் (REV-103) Autonomous Test');
    console.log('       Google Chrome will open on your screen in a moment!');
    console.log('===================================================================\n');

    // Demo Citizen Profile with complete Income & Family Details
    const demoCitizen = {
        canNumber: '133049281729012',
        salutation: 'Thiru',
        gender: 'Male',
        applicantNameEn: 'KUMARAN M',
        applicantNameTa: 'குமரன் எம்',
        relationshipType: 'Father',
        relationNameEn: 'MUTHUKUMAR R',
        relationNameTa: 'முத்துக்குமார் ஆர்',
        motherNameEn: 'LAKSHMI M',
        motherNameTa: 'லட்சுமி எம்',
        dob: '15/06/1992',
        religion: 'Hindu',
        community: 'BC',
        maritalStatus: 'Married',
        
        // Address
        district: 'Tiruvallur',
        taluk: 'Poonamallee',
        village: 'Kattupakkam',
        streetDoorEn: 'No. 12, Gandhi Street',
        streetDoorTa: 'எண். 12, காந்தி தெரு',
        pincode: '600056',

        // Annual Income Breakdown
        incomeSalary: 60000,
        incomeAgri: 0,
        incomeBusiness: 0,
        incomeOther: 12000,
        purpose: 'Education / Scholarship'
    };

    console.log('📋 [Demo Citizen Loaded]:', {
        name: demoCitizen.applicantNameEn,
        tamilName: demoCitizen.applicantNameTa,
        location: `${demoCitizen.village}, ${demoCitizen.taluk}`,
        totalIncome: `₹ ${(demoCitizen.incomeSalary + demoCitizen.incomeOther).toLocaleString('en-IN')}`
    });

    const result = await startIncomeCertificateFlow(demoCitizen, (msg) => {
        console.log(msg);
    }, { isMockSandbox: true });

    if (result.success) {
        console.log('===================================================================');
        console.log('✨ ஆட்டோமேஷன் நிறைவடைந்தது! பிரவுசரை நேரில் ஆய்வு செய்யுங்கள்.');
        console.log('👀 நீங்கள் பார்ப்பதற்காக பிரவுசர் இன்னும் 2 நிமிடங்கள் திறந்து வைக்கப்பட்டிருக்கும்...');
        console.log('===================================================================\n');
        
        // Keep open for inspection
        await new Promise(resolve => setTimeout(resolve, 120000));
        if (result.browser) await result.browser.close();
        console.log('Browser closed cleanly. Test complete.');
    } else {
        console.error('❌ Test failed:', result.error);
        if (result.browser) await result.browser.close();
    }
}

if (require.main === module) {
    runIncomeCertificateDemo().catch(console.error);
}

module.exports = { runIncomeCertificateDemo };
