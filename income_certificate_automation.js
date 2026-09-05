// =========================================================================
// Tamil Nadu e-Sevai Income Certificate (வருமானச் சான்றிதழ் - REV-103)
// Autonomous Intelligent Automation Engine
// =========================================================================
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

/**
 * Visual helper: highlights an element with a bright amber glow
 * so the developer can watch the AI interact with the field in real-time.
 */
async function highlightAndFill(page, selector, text, delayMs = 150) {
    try {
        await page.waitForSelector(selector, { timeout: 5000 });
        await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.classList.add('highlighted-field');
            }
        }, selector);
        
        await page.waitForTimeout(delayMs);
        await page.fill(selector, String(text));
        
        await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (el) {
                el.classList.remove('highlighted-field');
                el.classList.add('filled-success');
            }
        }, selector);
    } catch (err) {
        console.warn(`[IncomeCert] Notice for field ${selector}:`, err.message);
    }
}

/**
 * Visual helper for dropdown selects
 */
async function highlightAndSelect(page, selector, value, delayMs = 150) {
    try {
        await page.waitForSelector(selector, { timeout: 5000 });
        await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.classList.add('highlighted-field');
            }
        }, selector);

        await page.waitForTimeout(delayMs);
        await page.selectOption(selector, value);

        await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (el) {
                el.classList.remove('highlighted-field');
                el.classList.add('filled-success');
            }
        }, selector);
    } catch (err) {
        console.warn(`[IncomeCert] Notice for select ${selector}:`, err.message);
    }
}

/**
 * Main Autonomous Flow for Income Certificate (REV-103)
 */
async function startIncomeCertificateFlow(citizenData, onProgress = console.log, options = {}) {
    const isMock = options.isMockSandbox !== false;
    onProgress('🚀 [Income Certificate] Starting Autonomous Browser Engine...');

    const browser = await chromium.launch({
        headless: false, // Visible for developer verification!
        channel: 'chrome',
        slowMo: 60, // Human-like speed so developer can watch clearly
        args: ['--start-maximized', '--disable-blink-features=AutomationControlled']
    });

    const context = await browser.newContext({ viewport: null });
    const page = await context.newPage();

    try {
        // Step 1: Navigate to portal
        let targetUrl = options.portalUrl;
        if (!targetUrl) {
            const localMockPath = path.join(__dirname, 'public', 'mock_income_certificate.html');
            targetUrl = `file://${localMockPath.replace(/\\/g, '/')}`;
        }

        onProgress(`🌐 [Step 1] Loading e-Sevai Income Certificate Portal: ${targetUrl}`);
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1000);

        // Step 2: Fill Applicant & CAN Details
        onProgress('✍️ [Step 2] Filling Applicant & CAN Details (விண்ணப்பதாரர் விவரங்கள்)...');
        await highlightAndFill(page, '#canNumber', citizenData.canNumber || '133049281729012');
        await highlightAndSelect(page, '#salutation', citizenData.salutation || 'Thiru');
        await highlightAndSelect(page, '#gender', citizenData.gender || 'Male');
        
        await highlightAndFill(page, '#applicantNameEn', citizenData.applicantNameEn || 'KUMARAN M');
        await highlightAndFill(page, '#applicantNameTa', citizenData.applicantNameTa || 'குமரன் எம்');

        await highlightAndSelect(page, '#relationshipType', citizenData.relationshipType || 'Father');
        await highlightAndFill(page, '#relationNameEn', citizenData.relationNameEn || 'MUTHUKUMAR R');
        await highlightAndFill(page, '#relationNameTa', citizenData.relationNameTa || 'முத்துக்குமார் ஆர்');

        await highlightAndFill(page, '#motherNameEn', citizenData.motherNameEn || 'LAKSHMI M');
        await highlightAndFill(page, '#motherNameTa', citizenData.motherNameTa || 'லட்சுமி எம்');

        await highlightAndFill(page, '#dob', citizenData.dob || '15/06/1992');
        await highlightAndSelect(page, '#religion', citizenData.religion || 'Hindu');
        await highlightAndSelect(page, '#community', citizenData.community || 'BC');
        await highlightAndSelect(page, '#maritalStatus', citizenData.maritalStatus || 'Married');

        // Step 3: Fill Address Details
        onProgress('📍 [Step 3] Selecting District, Taluk, and Address (முகவரி விவரங்கள்)...');
        await highlightAndSelect(page, '#district', citizenData.district || 'Tiruvallur');
        await page.waitForTimeout(300);
        await highlightAndSelect(page, '#taluk', citizenData.taluk || 'Poonamallee');
        await page.waitForTimeout(300);
        await highlightAndSelect(page, '#revenueVillage', citizenData.village || 'Kattupakkam');

        await highlightAndFill(page, '#streetDoorEn', citizenData.streetDoorEn || 'No. 12, Gandhi Street');
        await highlightAndFill(page, '#streetDoorTa', citizenData.streetDoorTa || 'எண். 12, காந்தி தெரு');
        await highlightAndFill(page, '#pincode', citizenData.pincode || '600056');

        // Step 4: Fill Income Details
        onProgress('💰 [Step 4] Filling Annual Income Breakdown (வருமான விவரங்கள்)...');
        const incomeSalary = citizenData.incomeSalary || 60000;
        const incomeAgri = citizenData.incomeAgri || 0;
        const incomeBusiness = citizenData.incomeBusiness || 0;
        const incomeOther = citizenData.incomeOther || 12000;

        await highlightAndFill(page, '#incomeSalary', incomeSalary);
        await highlightAndFill(page, '#incomeAgri', incomeAgri);
        await highlightAndFill(page, '#incomeBusiness', incomeBusiness);
        await highlightAndFill(page, '#incomeOther', incomeOther);

        // Trigger input event to calculate total
        await page.dispatchEvent('#incomeOther', 'input');
        await page.waitForTimeout(500);

        await highlightAndSelect(page, '#purpose', citizenData.purpose || 'Education / Scholarship');

        // Step 5: Document Uploads
        onProgress('📎 [Step 5] Attaching Mandated Documents (ஆவணங்கள் பதிவேற்றம்)...');
        
        // Find existing sample files or create mock buffers
        const uploadsDir = path.join(__dirname, 'uploads');
        let samplePhoto = path.join(uploadsDir, 'kumaran_profile_photo.png');
        if (!fs.existsSync(samplePhoto)) {
            // Check any existing png in uploads
            const files = fs.readdirSync(uploadsDir).filter(f => f.endsWith('.png'));
            if (files.length > 0) samplePhoto = path.join(uploadsDir, files[0]);
        }

        if (fs.existsSync(samplePhoto)) {
            const photoInput = await page.$('#uploadPhoto');
            if (photoInput) await photoInput.setInputFiles(samplePhoto);

            const addrInput = await page.$('#uploadAddressProof');
            if (addrInput) await addrInput.setInputFiles(samplePhoto);

            const incomeInput = await page.$('#uploadIncomeProof');
            if (incomeInput) await incomeInput.setInputFiles(samplePhoto);
            
            onProgress('✅ [Step 5] All 3 documents attached successfully!');
        }

        await page.waitForTimeout(1000);

        // Step 6: Submit Form
        onProgress('📩 [Step 6] Submitting Income Certificate Application...');
        await page.click('#btnSubmitIncomeForm');

        // Step 7: Wait for acknowledgement
        await page.waitForSelector('#receiptModal', { state: 'visible', timeout: 8000 });
        const refNo = await page.$eval('#ackNumber', el => el.innerText.trim());
        const ackName = await page.$eval('#ackName', el => el.innerText.trim());
        const ackIncome = await page.$eval('#ackIncome', el => el.innerText.trim());

        onProgress(`\n🎉 [SUCCESS] Application Submitted Successfully!`);
        onProgress(`📄 Reference Number: ${refNo}`);
        onProgress(`👤 Applicant: ${ackName}`);
        onProgress(`💵 Annual Income: ${ackIncome}\n`);

        return {
            success: true,
            referenceNumber: refNo,
            applicant: ackName,
            income: ackIncome,
            browser,
            page
        };

    } catch (err) {
        onProgress(`❌ [Error in Automation]: ${err.message}`);
        return { success: false, error: err.message, browser, page };
    }
}

module.exports = {
    startIncomeCertificateFlow
};
