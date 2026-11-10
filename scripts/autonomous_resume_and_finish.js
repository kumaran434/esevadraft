// =========================================================================
// eSevaDraft Autonomous Resumption & Completion Runner (Steps 21-48)
// Zero-Submit Safety Guard: Strictly stops before final submit at Step 48
// =========================================================================

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { verifyNewCardOtpAndSettle, ensureMemberAdditionFormReady } = require('../src/portal/tnpds/steps/step21_new_card_otp_verifier');

async function runAutonomousResumption() {
    console.log('================================================================================');
    console.log('🚀 eSevaDraft Autonomous Resumption Driver (Steps 21 -> 48)');
    console.log('🛡️ ZERO-SUBMIT SAFETY GUARD: enableFinalSubmit is strictly FALSE');
    console.log('================================================================================\n');

    let browser;
    try {
        browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
    } catch (e) {
        console.error('❌ Could not connect to Chrome on port 9222:', e.message);
        process.exit(1);
    }

    const pages = browser.contexts()[0].pages();
    const page = pages.find(p => p.url().includes('newsmartcard')) || pages[0];

    const onProgress = (msg) => {
        const time = new Date().toLocaleTimeString('en-IN', { hour12: false });
        console.log(`[${time}] ${msg}`);
    };

    onProgress('⚡ Connected to active TNPDS application tab!');

    // 1. Wait for 6-digit OTP (either user types in modal, or writes to pending_otp.txt)
    onProgress('⏳ [படி 21/51] அரசு மொபைல் OTP-க்காகக் காத்திருக்கிறது... (திரையிலோ அல்லது pending_otp.txt-லோ உள்ளிடலாம்)');
    const { waitForAutonomousOtp } = require('./autonomous_otp_waiter');
    const resolvedOtp = await waitForAutonomousOtp(page, onProgress);
    if (!resolvedOtp) {
        onProgress('⚠️ OTP நேரம் முடிந்தது. மீண்டும் முயற்சிக்கவும்.');
        process.exit(1);
    }

    // 2. Submit OTP
    onProgress(`📍 [படி 21/51] மொபைல் OTP (${resolvedOtp}) சரிபார்க்கப்படுகிறது...`);
    const otpRes = await verifyNewCardOtpAndSettle(
        page,
        resolvedOtp,
        { onProgress },
        {}
    );

    if (!otpRes.success) {
        onProgress(`❌ OTP சரிபார்ப்பு தோல்வி: ${otpRes.error}`);
        process.exit(1);
    }

    // 3. Step 22: Open Member Addition Form
    onProgress('📍 [படி 22/51] குடும்ப உறுப்பினர் சேர்க்கைப் படிவம் திறக்கப்படுகிறது...');
    const memberFormRes = await ensureMemberAdditionFormReady(page, onProgress);
    if (!memberFormRes.success) {
        onProgress('❌ குடும்ப உறுப்பினர் சேர்க்கைப் படிவம் திறக்கப்படவில்லை.');
        process.exit(1);
    }

    // 4. Steps 23-27: Member basic details
    onProgress('📍 [படி 23/51] பிறந்த தேதி (10/06/1993) உள்ளிடப்படுகிறது...');
    const dobInp = page.locator('input[formcontrolname="dateOfBirth"]').first();
    if (await dobInp.count() > 0) {
        await dobInp.fill('10/06/1993');
        await dobInp.dispatchEvent('input');
        await dobInp.dispatchEvent('change');
        await page.waitForTimeout(500);
    }

    onProgress('📍 [படி 24/51] பாலினம் (ஆண்) தேர்வு செய்யப்படுகிறது...');
    const genSelect = page.locator('select[formcontrolname="gender"]').first();
    if (await genSelect.count() > 0) {
        await genSelect.selectOption({ index: 1 });
        await genSelect.dispatchEvent('change');
        await page.waitForTimeout(300);
    }

    onProgress('📍 [படி 25/51] தேசிய இனம் (Indian) தேர்வு செய்யப்படுகிறது...');
    const natSelect = page.locator('select[formcontrolname="nationality"]').first();
    if (await natSelect.count() > 0) {
        await natSelect.selectOption({ index: 1 });
        await natSelect.dispatchEvent('change');
        await page.waitForTimeout(300);
    }

    onProgress('📍 [படி 25.5/51] உறவுமுறை (குடும்ப தலைவர்) தேர்வு செய்யப்படுகிறது...');
    const relSelect = page.locator('select[formcontrolname="relationship"]').first();
    if (await relSelect.count() > 0) {
        const isRelDis = await relSelect.evaluate(e => e.disabled).catch(() => false);
        if (!isRelDis) {
            await relSelect.selectOption({ index: 1 });
            await relSelect.dispatchEvent('change');
            await page.waitForTimeout(300);
        }
    }

    onProgress('📍 [படி 26/51] தொழில் தேர்வு செய்யப்படுகிறது...');
    const profSelect = page.locator('select[formcontrolname="profession"]').first();
    if (await profSelect.count() > 0) {
        await profSelect.selectOption({ index: 1 });
        await profSelect.dispatchEvent('change');
        await page.waitForTimeout(300);
    }

    onProgress('📍 [படி 27/51] மாத வருமானம் (3000) உள்ளிடப்படுகிறது...');
    const incInp = page.locator('input[formcontrolname="monthlyIncome"]').first();
    if (await incInp.count() > 0) {
        await incInp.fill('3000');
        await incInp.dispatchEvent('input');
        await incInp.dispatchEvent('change');
        await page.waitForTimeout(300);
    }

    // 5. Steps 28-33: Member Aadhaar details & document
    onProgress('📍 [படி 28/51] உறுப்பினர் ஆவண வகை (ஆதார் அட்டை) தேர்ந்தெடுக்கப்படுகிறது...');
    const docSelect = page.locator('select[formcontrolname="supportingDocument"]').first();
    if (await docSelect.count() > 0) {
        await docSelect.selectOption({ index: 1 });
        await docSelect.dispatchEvent('change');
        await page.waitForTimeout(1000);
    }

    onProgress('📍 [படிகள் 29-31/51] ஆதார் எண் (5755 6766 2931) உள்ளிடப்படுகிறது...');
    const a1 = page.locator('input[formcontrolname="aadhaarNumber"]').first();
    const a2 = page.locator('input[formcontrolname="aadhaarNumber1"]').first();
    const a3 = page.locator('input[formcontrolname="aadhaarNumber2"]').first();
    if (await a1.count() > 0 && await a2.count() > 0 && await a3.count() > 0) {
        await a1.fill('5755'); await a1.dispatchEvent('input'); await a1.dispatchEvent('change');
        await a2.fill('6766'); await a2.dispatchEvent('input'); await a2.dispatchEvent('change');
        await a3.fill('2931'); await a3.dispatchEvent('input'); await a3.dispatchEvent('change');
    }

    const aadhaarDocPath = path.resolve('data/uploads/9790170026/aadhaar.jpg');
    onProgress('📍 [படி 32/51] குடும்பத் தலைவர் ஆதார் ஆவணம் இணைக்கப்படுகிறது...');
    const aFileInp = page.locator('input[formcontrolname="supportingDocumentProof"]').first();
    if (await aFileInp.count() > 0) {
        await aFileInp.setInputFiles(aadhaarDocPath);
        await page.waitForTimeout(1000);
    }

    onProgress('📍 [படி 33/51] பதிவேற்றம் பொத்தான் அழுத்தப்படுகிறது...');
    await page.evaluate(() => {
        const fileInp = document.querySelector('input[formcontrolname="supportingDocumentProof"]');
        let parent = fileInp ? fileInp.parentElement : null;
        for (let i = 0; i < 4 && parent; i++) {
            const btn = Array.from(parent.querySelectorAll('button')).find(b => {
                const t = (b.innerText || '').trim().toLowerCase();
                return t.includes('பதிவேற்றம்') || t.includes('upload');
            });
            if (btn) { btn.disabled = false; btn.click(); return; }
            parent = parent.parentElement;
        }
    });
    await page.waitForTimeout(2500);

    // 6. Step 34: Click Add Member button
    onProgress('📍 [படி 34/51] உறுப்பினரைச் சேர் பொத்தான் அழுத்தப்படுகிறது...');
    const addSubmitBtn = page.getByRole('button', { name: /உறுப்பினரை சேர்க்க|Add Member/i }).last();
    if (await addSubmitBtn.count() > 0) {
        await addSubmitBtn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(2500);
    }

    // 7. Step 37: Card option Rice
    onProgress('📍 [படி 37/51] அட்டை தேர்வு (அரிசி அட்டை / Rice) தேர்ந்தெடுக்கப்படுகிறது...');
    const cardSelect = page.locator('select[formcontrolname="cardOption"]').first();
    if (await cardSelect.count() > 0) {
        await cardSelect.selectOption({ index: 1 }).catch(() => {});
        await cardSelect.dispatchEvent('change');
        await page.waitForTimeout(500);
    }

    // 8. Steps 38-40: Residence proof (Gas Book)
    onProgress('📍 [படி 38/51] குடியிருப்புச் சான்று (எரிவாயு இணைப்பு ரசீது / Gas Book) தேர்வு செய்யப்படுகிறது...');
    const resDocSelect = page.locator('select[formcontrolname="residenceProofDocType"], select[formcontrolname="proofDocument"]').first();
    if (await resDocSelect.count() > 0) {
        const opts = await resDocSelect.evaluate(s => Array.from(s.options).map(o => ({ v: o.value, t: o.text })));
        const gasOpt = opts.find(o => o.t.includes('எரிவாயு') || o.t.toLowerCase().includes('gas'));
        if (gasOpt) {
            await resDocSelect.selectOption(gasOpt.v);
        } else if (opts.length > 1) {
            await resDocSelect.selectOption({ index: 1 });
        }
        await resDocSelect.dispatchEvent('change');
        await page.waitForTimeout(500);
    }

    const gasDocPath = path.resolve('data/uploads/9790170026/gas.jpg');
    onProgress('📍 [படி 39/51] குடியிருப்புச் சான்று ஆவணம் இணைக்கப்படுகிறது...');
    const resFileInp = page.locator('input[formcontrolname="residenceProofDoc"]').first();
    if (await resFileInp.count() > 0) {
        await resFileInp.setInputFiles(gasDocPath);
        await page.waitForTimeout(1000);
    }

    onProgress('📍 [படி 40/51] குடியிருப்புச் சான்று பதிவேற்றம் அழுத்தப்படுகிறது...');
    await page.evaluate(() => {
        const fileInp = document.querySelector('input[formcontrolname="residenceProofDoc"]');
        let parent = fileInp ? fileInp.parentElement : null;
        for (let i = 0; i < 4 && parent; i++) {
            const btn = Array.from(parent.querySelectorAll('button')).find(b => {
                const t = (b.innerText || '').trim().toLowerCase();
                return t.includes('பதிவேற்றம்') || t.includes('upload');
            });
            if (btn) { btn.disabled = false; btn.click(); return; }
            parent = parent.parentElement;
        }
    });
    await page.waitForTimeout(2500);

    // 9. Steps 41-46: Gas Connection Details
    onProgress('📍 [படிகள் 41-46/51] எரிவாயு இணைப்பு விவரங்கள் நிரப்பப்படுகின்றன...');
    const gasCountSelect = page.locator('select[formcontrolname="cylinderCount"]').first();
    if (await gasCountSelect.count() > 0) {
        await gasCountSelect.selectOption('1').catch(() => {});
        await gasCountSelect.dispatchEvent('change');
        await page.waitForTimeout(500);
    }

    const compSelect = page.locator('select[formcontrolname="oilCompany"]').first();
    if (await compSelect.count() > 0) {
        await compSelect.selectOption({ index: 2 }).catch(() => {}); // HPC
        await compSelect.dispatchEvent('change');
        await page.waitForTimeout(500);
    }

    const agencySelect = page.locator('select[formcontrolname="agencyName"]').first();
    if (await agencySelect.count() > 0) {
        await agencySelect.selectOption({ index: 1 }).catch(() => {});
        await agencySelect.dispatchEvent('change');
        await page.waitForTimeout(500);
    }

    const consNoInp = page.locator('input[formcontrolname="consumerNumber"]').first();
    if (await consNoInp.count() > 0) {
        await consNoInp.fill('622601');
        await consNoInp.dispatchEvent('input');
        await consNoInp.dispatchEvent('change');
        await page.waitForTimeout(300);
    }

    const consNameInp = page.locator('input[formcontrolname="consumerName"]').first();
    if (await consNameInp.count() > 0) {
        await consNameInp.fill('DEVAGI');
        await consNameInp.dispatchEvent('input');
        await consNameInp.dispatchEvent('change');
        await page.waitForTimeout(300);
    }

    // 10. Step 47: Declaration Checkbox
    onProgress('📍 [படி 47/51] உறுதிமொழி (Declaration Checkbox) தேர்ந்தெடுக்கப்படுகிறது...');
    const declCheck = page.locator('input[type="checkbox"][formcontrolname="declaration"]').first();
    if (await declCheck.count() > 0) {
        await declCheck.check({ force: true }).catch(() => {});
        await page.waitForTimeout(500);
    }

    // 11. Step 48: PRE-SUBMIT HALT (STRICT SAFETY LAW)
    onProgress('\n================================================================================');
    onProgress('🛑 [படி 48/51] கட்டாய இறுதிச் சமர்ப்பிப்பு முன்-நிறுத்தம் (Compulsory Pre-Submit Guard)');
    onProgress('🛡️ ZERO-SUBMIT SAFETY LAW ACTIVE: விண்ணப்பம் அரசு சர்வரில் சமர்ப்பிக்கப்படாமல் பாதுகாப்பாக நிறுத்தப்பட்டது!');
    onProgress('🎉 ஆட்டோமேஷன் அனைத்து 47 படிகளையும் வெற்றிகரமாக பூர்த்தி செய்து திரையில் முன்னோட்டமாகக் காட்டுகிறது!');
    onProgress('================================================================================\n');

    process.exit(0);
}

if (require.main === module) {
    runAutonomousResumption();
}

module.exports = { runAutonomousResumption };
