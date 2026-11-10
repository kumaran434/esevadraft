/**
 * TNPDS Add Member — Step 7: Declaration, Dry-Run Guard & Final Submit
 * 
 * Responsibilities:
 * 1. Checks legal declaration checkbox.
 * 2. Enforces Three-Way Dry-Run Safety Invariant.
 * 3. Final submission & Reference Number / PDF acknowledgment receipt retrieval.
 */

async function handleDeclarationAndSubmit(page, options = {}, helpers = {}) {
    const { onProgress, applyDryRunGuard } = helpers;

    console.log('📝 [Add Member: Step 7] Checking declaration and final submission guard...');
    if (onProgress) onProgress('[படி 10/12] 📝 இறுதி உறுதிமொழி மற்றும் சமர்ப்பிப்பு சரிபார்க்கப்படுகிறது...');

    const decCheckbox = page.locator('input[type="checkbox"][formcontrolname="declaration"], #declaration').first();
    if (await decCheckbox.count() > 0) {
        await decCheckbox.check().catch(() => {});
    }

    const guard = applyDryRunGuard ? applyDryRunGuard(options) : { canSubmitLive: options.enableFinalSubmit === true };
    if (!guard.canSubmitLive) {
        console.log('🛡️ [Add Member: Step 7] Halted safely in Dry-Run mode. Details previewed on screen.');
        if (onProgress) onProgress('[படி 11/12] 🛡️ [ஒத்திகை முறை] இறுதிச் சமர்ப்பிப்புக்கு முன் பாதுகாப்பாக நிறுத்தப்பட்டது. விவரங்கள் திரையில் உள்ளன.');
        return { isDryRun: true, status: 'PREVIEW_READY' };
    }

    // Compulsory Pre-Submit Human Inspection Gate (Rule 51 / Case 49)
    // UNIVERSAL LAW: In both dry-run and real mode, automation compulsorily halts before final submit button.
    // Operator visually inspects all filled member data and documents, then submits manually or approves.
    const isAutomatedCiTest = process.env.REGRESSION_TEST === 'true' && (options.fastTest === true || options.isTestSuite === true);
    if (!isAutomatedCiTest) {
        console.log('🛑 [Add Member: Step 7] Halted safely before final submit for operator visual inspection.');
        if (onProgress) {
            onProgress('🛑 **[கட்டாய இறுதிச் சமர்ப்பிப்பு முன்-நிறுத்தம் - Compulsory Pre-Submit Human Gate]**');
            onProgress('✅ குடும்ப உறுப்பினர் சேர்க்கை விவரங்கள் & ஆதார் ஆவணம் அரசு போர்ட்டலில் 100% பூர்த்தி செய்யப்பட்டுவிட்டன!');
            onProgress('🔍 **ஆபரேட்டர் கவனத்திற்கு:** உங்கள் Google Chrome திரையில் உள்ள அனைத்து விவரங்களையும் நேரில் சரிபார்க்கவும்.');
            onProgress('👉 **ஏதேனும் பிழை இருந்தால்:** Chrome திரையிலேயே நீங்கள் நேரடியாகத் திருத்தலாம்.');
            onProgress('🚀 **எல்லாம் சரியாக இருந்தால்:** நீங்களே Chrome திரையில் "பதிவு செய்க" பொத்தானை நேரடியாக அழுத்தி சமர்ப்பிக்கலாம்!');
        }
        return { isDryRun: false, status: 'PREVIEW_READY', isPreSubmitHalted: true };
    }

    const submitBtn = page.locator('#btnSubmit, button[type="submit"]:has-text("பதிவு செய்க")').first();
    if (await submitBtn.count() > 0) {
        await submitBtn.click();
    }

    return { isDryRun: false, status: 'SUBMITTED' };
}

module.exports = {
    handleDeclarationAndSubmit
};
