// =========================================================================
// TNPDS Address Change — Step 12: Dry-Run Guard, Submission & Receipt
// =========================================================================
const path = require('path');
const { generateAddressChangeReceiptPdf, receiptsDir } = require('../../../../services/tnpds_receipt_generator');
const { waitForHumanFinalSubmitOnly, downloadOfficialTnpdsApplicationPdf } = require('../../helpers/tnpds_post_submit_receipt');

async function executeAddressSubmitStep({
    page,
    formData,
    userMobile,
    rationCardNo,
    isMock,
    options,
    onProgress,
    sharedContext
}) {
    const {
        showBrowserHud = async () => {},
        requestApprovalFromOperator = async () => ({ approved: true }),
        isSubmittedDirectlyByOperator = false
    } = sharedContext;

    const {
        doorNo,
        streetEng,
        streetTam,
        district,
        taluk,
        village,
        pincode,
        proofType
    } = formData;

    const isLiveProductionPublish = !isMock && options.enableFinalSubmit === true;
    if (!isLiveProductionPublish) {
        onProgress('🛑 [பாதுகாப்பு பூட்டு - Dry-Run Guard] இது மாதிரி விவர சோதனை (Test Mode) என்பதால், இறுதிச் சமர்ப்பிப்பு (Final Submit) பொத்தான் அழுத்தப்படாமல் பாதுகாப்பாக நிறுத்தப்பட்டது!');
        onProgress('🔒 உங்கள் அசல் குடும்ப அட்டையில் எந்தவித மாற்றமும் செய்யப்படவில்லை. அனைத்து விவரங்களும் பூர்த்தி செய்யப்பட்டு உங்கள் கண்முன்னே Chrome திரையில் நிறுத்தப்பட்டுள்ளது.');
        await showBrowserHud('[பாதுகாப்பு நிறுத்தம்]', 'மாதிரி விவரங்கள் - இறுதிச் சமர்ப்பிப்பு தவிர்க்கப்பட்டது (கார்டு 100% பாதுகாப்பானது)', 'success');
    } else {
        const isAutomatedCiTest = process.env.REGRESSION_TEST === 'true' && (options.fastTest === true || options.isTestSuite === true);
        if (!isAutomatedCiTest) {
            // Golden Rule 25: NEVER auto-click Final Submit! Wait ONLY for the human operator to submit in Chrome.
            const humanRes = await waitForHumanFinalSubmitOnly(page, {
                serviceLabel: 'குடும்ப அட்டை முகவரி மாற்ற விண்ணப்பம்',
                onProgress,
                showBrowserHud,
                isMockSandboxMode: isMock
            });
            if (!humanRes.submitted || !humanRes.refNo) {
                return {
                    success: true,
                    isPreSubmitGate: true,
                    status: 'PRE_SUBMIT_GATE',
                    isDryRun: true,
                    applicationNumber: null,
                    applicationPdfUrl: null,
                    message: '🛡️ குடும்ப அட்டை முகவரி மாற்ற படிவம் 100% பூர்த்தி செய்யப்பட்டு ஆபரேட்டர் சரிபார்ப்பிற்காக பாதுகாப்பாக நிறுத்தப்பட்டது.'
                };
            }
            const officialDl = await downloadOfficialTnpdsApplicationPdf(page, humanRes.refNo, {
                receiptsDir,
                onProgress,
                showBrowserHud,
                serviceType: 'CHANGE_ADDRESS'
            });
            let applicationPdfUrl = officialDl.pdfUrl;
            if (!applicationPdfUrl) {
                const saveFilename = `Application_${humanRes.refNo}.pdf`;
                const savePath = path.join(receiptsDir, saveFilename);
                await generateAddressChangeReceiptPdf(savePath, {
                    refNo: humanRes.refNo,
                    date: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
                    rationCardNo,
                    mobileNumber: userMobile,
                    doorNo,
                    streetEng,
                    streetTam,
                    district,
                    taluk,
                    village,
                    pincode,
                    proofType
                });
                applicationPdfUrl = `/receipts/${saveFilename}`;
            }
            return {
                success: true,
                applicationNumber: humanRes.refNo,
                applicationPdfUrl,
                receiptPdfUrl: applicationPdfUrl,
                officialPortalPdfDownloaded: Boolean(officialDl.downloaded),
                message: `🎉 **குடும்ப அட்டை முகவரி மாற்ற விண்ணப்பம் TNPDS அரசு போர்ட்டலில் வெற்றிகரமாகச் சமர்ப்பிக்கப்பட்டது!**\n\n` +
                         `• 🏠 **புதிய முகவரி:** கதவு எண்: ${doorNo}, ${streetTam} (${streetEng}), ${village}, ${district} - ${pincode}\n` +
                         `• 📄 **அரசு பதிவு குறிப்பு எண்:** 👉 **${humanRes.refNo}**\n` +
                         `• 📱 **பதிவு செய்யப்பட்ட கைபேசி எண்:** +91 ${userMobile}\n\n` +
                         `📥 **[அதிகாரப்பூர்வ விண்ணப்ப ஒப்புதல் சீட்டைப் பதிவிறக்க இங்கே கிளிக் செய்யவும் (PDF)](${applicationPdfUrl})**`
            };
        } else {
            onProgress('[படி 12/12] 🚀 TNPDS அரசு போர்ட்டலில் இறுதி விண்ணப்பம் சமர்ப்பிக்கப்படுகிறது (Submitting to Portal)...');
            await showBrowserHud('[படி 12/12] இறுதி விண்ணப்பம் சமர்ப்பிக்கப்படுகிறது', 'TNPDS அரசு போர்ட்டல்');

            const submitBtn = page.locator('button.btn-success:has-text("பதிவு செய்"), button.btn-success:has-text("சமர்ப்பி"), button#myBtn, button:has-text("பதிவு செய்ய"), button:has-text("சமர்ப்பி"), button:has-text("Submit"), #btnSubmitApp').first();
            if (await submitBtn.count() > 0) {
                await submitBtn.click();
                await page.waitForTimeout(4000);
            }
        }
    }

    let refNo = '';
    try {
        const bodyText = await page.innerText('body');
        const refMatch = bodyText.match(/(?:குறிப்பு\s*எண்|கோரிக்கை\s*எண்|விண்ணப்ப\s*எண்)\s*[:\-]?\s*([0-9A-Za-z]+)/i) ||
                        bodyText.match(/(N\d{10,16})/);
        if (refMatch) refNo = refMatch[1];
    } catch (_) {}

    if (!refNo) {
        if (isLiveProductionPublish) {
            throw new Error('GOVT_REF_NO_NOT_FOUND: Application was submitted on portal, but government reference number could not be extracted.');
        }
        refNo = `N${new Date().getFullYear().toString().slice(-2)}${Math.floor(10000000 + Math.random() * 90000000)}`;
    }

    const saveFilename = `Application_${refNo}.pdf`;
    const savePath = path.join(receiptsDir, saveFilename);
    await generateAddressChangeReceiptPdf(savePath, {
        refNo,
        date: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
        rationCardNo,
        mobileNumber: userMobile,
        doorNo,
        streetEng,
        streetTam,
        district,
        taluk,
        village,
        pincode,
        proofType
    });

    const applicationPdfUrl = `/receipts/${saveFilename}`;

    if (!isLiveProductionPublish) {
        onProgress(`[படி 12/12] 🛑 குடும்ப அட்டை முகவரி மாற்றம் மாதிரி ஒத்திகை (Dry-Run) முழுமையாக முடிந்தது!`);
        onProgress(`🔒 உங்கள் அசல் குடும்ப அட்டை 100% பாதுகாப்பாக உள்ளது (அரசு சர்வரில் எந்த மாற்றமும் சேமிக்கப்படவில்லை).`);
        onProgress(`🖥️ முகவரி மாற்ற விவரங்கள் அனைத்தும் உங்கள் கண்முன்னே Chrome திரையில் பூர்த்தி செய்யப்பட்டு நிற்கிறது.`);
        await showBrowserHud('[ஒத்திகை நிறைவுற்றது]', 'அசல் கார்டு 100% பாதுகாப்பானது (இறுதி சமர்ப்பிப்பு தவிர்க்கப்பட்டது)', 'success');

        return {
            success: true,
            isDryRun: true,
            applicationNumber: isMock ? refNo : null,
            applicationPdfUrl: isMock ? applicationPdfUrl : null,
            message: isMock
                ? `🎉 **குடும்ப அட்டை முகவரி மாற்ற மாதிரி ஒத்திகை (Mock Mode) நிறைவுற்றது!**\n\n• 🏠 **புதிய முகவரி:** ${doorNo}, ${streetTam} (${streetEng}), ${village}\n• 📄 **மாதிரி எண்:** ${refNo}\n\n📥 [ஒப்புதல் சீட்டு (PDF)](${applicationPdfUrl})`
                : `🛡️ **குடும்ப அட்டை முகவரி மாற்ற ஒத்திகை (Dry-Run Test) 100% வெற்றிகரமாக நிறைவுற்றது!** 🎯\n\n` +
                  `• 🏠 **புதிய முகவரி:** கதவு எண்: ${doorNo}, ${streetTam} (${streetEng}), ${village}, ${district} - ${pincode}\n` +
                  `• 📱 **பதிவு செய்யப்பட்ட கைபேசி:** +91 ${userMobile}\n` +
                  `• 🛑 **பாதுகாப்பு நிறுத்தம் (Dry-Run Guard):** உங்கள் கோரிக்கைப்படி **அரசுக்கான இறுதிச் சமர்ப்பிப்பு (Final Submit) பொத்தான் அழுத்தப்படவில்லை!**\n` +
                  `• 🔒 **உங்கள் அசல் குடும்ப அட்டை 100% பாதுகாப்பாக உள்ளது (அரசு சர்வரில் எந்த மாற்றமும் செய்யப்படவில்லை).**\n\n` +
                  `🖥️ அனைத்து விவரங்களும் அரசு படிவத்தில் நிரப்பப்பட்டு உங்கள் கண்முன்னே Chrome திரையில் நிறுத்தப்பட்டுள்ளது.`
        };
    }

    return {
        success: true,
        applicationNumber: refNo,
        applicationPdfUrl,
        message: `🎉 **குடும்ப அட்டை முகவரி மாற்ற விண்ணப்பம் TNPDS அரசு போர்ட்டலில் வெற்றிகரமாகச் சமர்ப்பிக்கப்பட்டது!**\n\n` +
                 `• 🏠 **புதிய முகவரி:** கதவு எண்: ${doorNo}, ${streetTam} (${streetEng}), ${village}, ${district} - ${pincode}\n` +
                 `• 📄 **அரசு பதிவு குறிப்பு எண்:** 👉 **${refNo}**\n` +
                 `• 📱 **பதிவு செய்யப்பட்ட கைபேசி எண்:** +91 ${userMobile}\n\n` +
                 `📥 **[அதிகாரப்பூர்வ விண்ணப்ப ஒப்புதல் சீட்டைப் பதிவிறக்க இங்கே கிளிக் செய்யவும் (PDF)](${applicationPdfUrl})**`
    };
}

module.exports = { executeAddressSubmitStep };
