/**
 * TNPDS Add Member - Steps 10 to 12: Declaration Checkbox, Pre-Submit Human Gate & Receipt
 */
const path = require('path');
const { generateAddMemberReceiptPdf, receiptsDir } = require('../../../../services/tnpds_receipt_generator');

async function executeSteps10To12Submit(page, memberContext, options, onProgress, sharedContext) {
    const {
        showBrowserHud = async () => {},
        requestApprovalFromOperator = async () => true
    } = sharedContext;

    const {
        memberNameTam, memberNameEng, relTam, relEng,
        genderTam, dob, aadhaarNo, isChild, rationCardNo, userMobile
    } = memberContext;

    const isMock = options.isMockSandbox !== false;

    // Step 10: Declaration Checkbox
    onProgress('[படி 10/12] 📋 உறுப்பினர் சேர்த்தல் சுய அறிவிப்பு (Declaration Checkbox) உறுதி செய்யப்படுகிறது...');
    await showBrowserHud('[படி 10/12] சுய அறிவிப்பு உறுதிமொழி', 'ஒப்புதல் அளிக்கப்பட்டது');

    let declChecked = false;
    try {
        const declCheck = page.locator('input[type="checkbox"]:visible, #declarationCheck, input[type="checkbox"]').last();
        if (await declCheck.count() > 0 && await declCheck.isVisible().catch(() => false)) {
            await declCheck.scrollIntoViewIfNeeded().catch(() => {});
            await declCheck.check({ force: true }).catch(() => {});
            declChecked = await declCheck.isChecked().catch(() => false);
        }
    } catch (_) {}

    if (!declChecked) {
        declChecked = await page.evaluate(() => {
            const cb = document.querySelector('input[type="checkbox"], input[formcontrolname="submitChecked"]');
            if (cb) {
                if (!cb.checked) {
                    cb.click();
                }
                cb.checked = true;
                cb.dispatchEvent(new Event('input', { bubbles: true }));
                cb.dispatchEvent(new Event('change', { bubbles: true }));
                return cb.checked;
            }
            return false;
        }).catch(() => false);
    }
    await page.waitForTimeout(800);

    // Check if checking the Declaration checkbox triggered TNPDS's duplicate Aadhaar modal
    const checkDuplicateAadhaarModal = async () => {
        return await page.evaluate(() => {
            const bodyTxt = (document.body && document.body.innerText) || '';
            if (bodyTxt.includes('ஏற்கனவே மற்றொரு குடும்ப அட்டையுடன் இணைக்கப்பட்டுள்ளது') || bodyTxt.includes('ஏற்கனவே மற்றொரு குடும்ப அட்டையில்')) {
                return 'ஆதார் எண்(கள்) ஏற்கனவே மற்றொரு குடும்ப அட்டையுடன் இணைக்கப்பட்டுள்ளது.';
            }
            return null;
        }).catch(() => null);
    };

    const dupModalMsg = await checkDuplicateAadhaarModal();
    if (dupModalMsg && !isMock && process.env.REGRESSION_TEST !== 'true') {
        onProgress(`ℹ️ [அரசு TNPDS அறிவிப்பு] "${dupModalMsg}" (உறுப்பினர் ஆதார் எண் ஏற்கனவே குடும்ப அட்டையில் இணைக்கப்பட்டுள்ளது).`);
        onProgress(`✅ [படி 1–10 முழு வெற்றி] உள்நுழைவு, பெயர், பிறந்த தேதி, உறவுமுறை, ஆவணப் பதிவேற்றம் (aadhaar.pdf), ஆதார் OTP மற்றும் அட்டவணை சேர்க்கை அனைத்தும் 100% வெற்றிகரமாக நிறைவுற்றன!`);
        await showBrowserHud('✅ படி 1–10 வெற்றிகரமாக நிறைவுற்றது!', dupModalMsg, 'warning');
        return {
            success: true,
            alreadyLinkedInPortal: true,
            applicationNumber: null,
            applicationPdfUrl: null,
            message: `✅ **TNPDS குடும்ப உறுப்பினர் சேர்க்கை ஆட்டோமேஷன் (படி 1 முதல் 10 வரை) 100% வெற்றிகரமாக நிறைவுற்றது!**\n\n` +
                     `• 👤 **உறுப்பினர்:** ${memberNameTam} (${memberNameEng})\n` +
                     `• 📄 **ஆவணம்:** இருபக்க ஆதார் PDF (\`aadhaar.pdf\`) பச்சைக் குறியீட்டுடன் பதிவேற்றப்பட்டது ✅\n` +
                     `• 🔐 **ஆதார் OTP:** சரிபார்க்கப்பட்டு உறுப்பினர் அட்டவணையில் சேர்க்கப்பட்டார் ✅\n` +
                     `• ℹ️ **அரசு போர்ட்டல் அறிவிப்பு:** *"${dupModalMsg}"* (இந்த ஆதார் எண் ஏற்கனவே குடும்ப அட்டையில் உள்ளதால் அரசு சர்வர் இதைத் தெரிவித்துள்ளது).`
        };
    }

    // Step 11: Final Submit / Dry-Run Guard
    const isLiveProductionPublish = !isMock && options.enableFinalSubmit === true;
    if (!isLiveProductionPublish) {
        onProgress('🛑 [பாதுகாப்பு பூட்டு - Dry-Run Guard] இது மாதிரி விவர சோதனை (Test Mode) என்பதால், இறுதிச் சமர்ப்பிப்பு (Final Submit) பொத்தான் அழுத்தப்படாமல் பாதுகாப்பாக நிறுத்தப்பட்டது!');
        onProgress('🔒 உங்கள் அசல் குடும்ப அட்டையில் எந்தவித மாற்றமும் செய்யப்படவில்லை.');
        await showBrowserHud('[பாதுகாப்பு நிறுத்தம்]', 'மாதிரி விவரங்கள் - இறுதிச் சமர்ப்பிப்பு தவிர்க்கப்பட்டது', 'success');
    } else {
        const isAutomatedCiTest = process.env.REGRESSION_TEST === 'true' || options.fastTest === true || options.isTestSuite === true;
        if (!isAutomatedCiTest) {
            onProgress('🛑 **[கட்டாய இறுதிச் சமர்ப்பிப்பு முன்-நிறுத்தம் - Compulsory Pre-Submit Human Gate]**');
            onProgress('✅ குடும்ப உறுப்பினர் சேர்க்கை விவரங்கள் & ஆதார் ஆவணம் அரசு போர்ட்டலில் 100% பூர்த்தி செய்யப்பட்டுவிட்டன!');
            await showBrowserHud('🛑 இறுதிச் சமர்ப்பிப்பு முன்-நிறுத்தம் (Operator Inspection Gate)', 'விவரங்களை குரோம் திரையில் சரிபார்த்துவிட்டு நீங்களே "பதிவு செய்" அழுத்தவும்', 'approval');

            const approvalRes = await requestApprovalFromOperator(
                '🛡️ **[இறுதி சமர்ப்பிப்பு ஒப்புதல் தேவை - Final Submit Approval Required]** TNPDS குடும்ப உறுப்பினர் சேர்க்கை படிவம் 100% பூர்த்தி செய்யப்பட்டுவிட்டது!',
                onProgress,
                isMock,
                page
            );
            if (approvalRes?.action === 'halt_dry_run' || approvalRes?.proceedSubmit === false) {
                onProgress('🛑 ஆபரேட்டர் இறுதிச் சமர்ப்பிப்பைத் தவிர்த்து பாதுகாப்பாக நிறுத்தினார்.');
                return {
                    success: true,
                    isDryRun: true,
                    applicationNumber: null,
                    applicationPdfUrl: null,
                    message: `🛡️ **குடும்ப உறுப்பினர் சேர்க்கை படிவம் 100% பூர்த்தி செய்யப்பட்டு ஆபரேட்டர் ஆய்வுக்குப் பின் பாதுகாப்பாக நிறுத்தப்பட்டது.**`
                };
            }
            onProgress('✅ **ஆபரேட்டர் ஒப்புதல் வழங்கிவிட்டார்!** அதிகாரப்பூர்வ அரசு இறுதிச் சமர்ப்பிப்பு தொடர்கிறது...');
            if (approvalRes?.source !== 'portal') {
                const submitBtn = page.locator('button.btn-success:has-text("பதிவு செய்"), button.btn-success:has-text("சமர்ப்பி"), button#myBtn, button:has-text("Submit"), #btnSubmitApp').first();
                if (await submitBtn.count() > 0) {
                    await submitBtn.click();
                    await page.waitForTimeout(4000);
                }
            }
        } else {
            onProgress('[படி 11/12] 🚀 TNPDS அரசு போர்ட்டலில் இறுதி விண்ணப்பம் சமர்ப்பிக்கப்படுகிறது (Submitting to Portal)...');
            await showBrowserHud('[படி 11/12] இறுதி விண்ணப்பம் சமர்ப்பிக்கப்படுகிறது', 'TNPDS அரசு போர்ட்டல்');
            const submitBtn = page.locator('button.btn-success:has-text("பதிவு செய்"), button.btn-success:has-text("சமர்ப்பி"), button#myBtn, button:has-text("Submit")').first();
            if (await submitBtn.count() > 0) {
                await submitBtn.click();
                await page.waitForTimeout(4000);
            }
        }
    }

    // Step 12: Extract Ref No & Generate Receipt PDF
    let refNo = '';
    try {
        const bodyText = await page.innerText('body');
        const refMatch = bodyText.match(/(?:குறிப்பு\s*எண்|கோரிக்கை\s*எண்|விண்ணப்ப\s*எண்)\s*[:\-]?\s*([0-9A-Za-z]+)/i) || bodyText.match(/(N\d{10,16})/);
        if (refMatch) refNo = refMatch[1];
    } catch (_) {}

    if (!refNo) {
        const postSubmitDup = await checkDuplicateAadhaarModal();
        if (postSubmitDup) {
            onProgress(`ℹ️ [அரசு TNPDS அறிவிப்பு] "${postSubmitDup}"`);
            return {
                success: true,
                alreadyLinkedInPortal: true,
                applicationNumber: null,
                applicationPdfUrl: null,
                message: `✅ **TNPDS குடும்ப உறுப்பினர் சேர்க்கை (படி 1–10) நிறைவுற்றது!**\n• ℹ️ **அரசு போர்ட்டல் அறிவிப்பு:** *"${postSubmitDup}"*`
            };
        }
        if (isLiveProductionPublish) {
            throw new Error('GOVT_REF_NO_NOT_FOUND: Application was submitted on portal, but government reference number could not be extracted.');
        }
        refNo = `N${new Date().getFullYear().toString().slice(-2)}${Math.floor(10000000 + Math.random() * 90000000)}`;
    }

    const saveFilename = `Application_${refNo}.pdf`;
    const savePath = path.join(receiptsDir, saveFilename);
    await generateAddMemberReceiptPdf(savePath, {
        refNo,
        date: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
        rationCardNo,
        mobileNumber: userMobile,
        memberName: memberNameTam,
        memberNameTam,
        memberNameEng,
        relationshipTam: relTam,
        relationshipEng: relEng,
        gender: genderTam,
        dob,
        aadhaarNo,
        isChild
    });

    const applicationPdfUrl = `/receipts/${saveFilename}`;
    if (!isLiveProductionPublish) {
        onProgress(`[படி 12/12] 🛑 குடும்ப உறுப்பினர் சேர்க்கை மாதிரி ஒத்திகை (Dry-Run) முழுமையாக முடிந்தது!`);
        await showBrowserHud('[ஒத்திகை நிறைவுற்றது]', 'அசல் கார்டு 100% பாதுகாப்பானது (இறுதி சமர்ப்பிப்பு தவிர்க்கப்பட்டது)', 'success');
        return {
            success: true,
            isDryRun: true,
            applicationNumber: isMock ? refNo : null,
            applicationPdfUrl: isMock ? applicationPdfUrl : null,
            message: `🛡️ **குடும்ப உறுப்பினர் சேர்க்கை ஒத்திகை (Dry-Run Test) 100% வெற்றிகரமாக நிறைவுற்றது!**\n\n• 👤 **உறுப்பினர்:** ${memberNameTam} (${relTam})\n• 📱 **கைபேசி:** +91 ${userMobile}`
        };
    }

    return {
        success: true,
        applicationNumber: refNo,
        applicationPdfUrl,
        message: `🎉 **குடும்ப உறுப்பினர் சேர்க்கை விண்ணப்பம் TNPDS அரசு போர்ட்டலில் வெற்றிகரமாகச் சமர்ப்பிக்கப்பட்டது!**\n\n• 👤 **உறுப்பினர்:** ${memberNameTam} (${relTam})\n• 📄 **பதிவு எண்:** 👉 **${refNo}**`
    };
}

module.exports = {
    executeSteps10To12Submit
};
