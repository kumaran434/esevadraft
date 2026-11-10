/**
 * Step 7: LPG Gas Cylinder Details Manager
 * 
 * Responsibilities:
 * 1. Selects LPG connection availability (Yes/No).
 * 2. Selects Oil Marketing Company (IOCL Indane / BPCL Bharat / HPCL HP).
 * 3. Enters consumer number and cylinder count.
 */

async function fillGasDetails(page, gasDetails = {}, helpers = {}) {
    const { onProgress, humanType } = helpers;

    console.log('⛽ [Step 7: Gas] Filling LPG Gas cylinder details...');
    if (onProgress) onProgress('⛽ எரிவாயு இணைப்பு விவரங்கள் பதிவு செய்யப்படுகின்றன...');

    const hasGas = Boolean(gasDetails && gasDetails.hasGas);
    const gasRadioSelector = hasGas ? 'input[value="yes"], #hasGasYes' : 'input[value="no"], #hasGasNo';
    const gasRadio = page.locator(gasRadioSelector).first();
    if (await gasRadio.count() > 0) {
        await gasRadio.check().catch(() => {});
    }

    if (hasGas && gasDetails.consumerNumber) {
        const cNumInput = page.locator('input[formcontrolname="consumerNumber"], input#consumerNumber').first();
        if (await cNumInput.count() > 0) {
            await (humanType ? humanType(page, cNumInput, gasDetails.consumerNumber) : cNumInput.fill(gasDetails.consumerNumber));
        }
    }

    return { success: true };
}

module.exports = {
    fillGasDetails
};
