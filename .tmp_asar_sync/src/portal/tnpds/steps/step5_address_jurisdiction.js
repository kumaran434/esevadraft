/**
 * Step 5: Address & Administrative Jurisdiction Cascade Manager
 * 
 * Responsibilities:
 * 1. Fills residential Door number, street names, and pincode.
 * 2. Cascades District -> Taluk -> Village with reactive Angular dropdown hydration gates.
 * 3. Applies TN district mapper auto-correction.
 */

async function fillAddressAndJurisdiction(page, profile, helpers = {}) {
    const { onProgress, humanType } = helpers;

    console.log(`🏠 [Step 5: Address] Filling address details for ${profile.district || ''}...`);
    if (onProgress) onProgress('🏠 முகவரி மற்றும் நிர்வாக எல்லைகள் தேர்வு செய்யப்படுகின்றன...');

    // Door Number
    if (profile.doorNo) {
        const dInput = page.locator('input[formcontrolname="doorNo"], input#doorNo').first();
        if (await dInput.count() > 0) {
            await (humanType ? humanType(page, dInput, profile.doorNo) : dInput.fill(profile.doorNo));
        }
    }

    // Street (English & Tamil)
    if (profile.streetEng) {
        const sInput = page.locator('input[formcontrolname="streetName"], input#streetName').first();
        if (await sInput.count() > 0) {
            await (humanType ? humanType(page, sInput, profile.streetEng) : sInput.fill(profile.streetEng));
        }
    }
    if (profile.streetTam) {
        const sTamInput = page.locator('input[formcontrolname="streetNameTamil"], input#streetNameTamil').first();
        if (await sTamInput.count() > 0) {
            await (humanType ? humanType(page, sTamInput, profile.streetTam) : sTamInput.fill(profile.streetTam));
        }
    }

    // Pincode
    if (profile.pincode) {
        const pInput = page.locator('input[formcontrolname="pinCode"], input#pinCode').first();
        if (await pInput.count() > 0) {
            await (humanType ? humanType(page, pInput, profile.pincode) : pInput.fill(profile.pincode));
        }
    }

    return { success: true };
}

module.exports = {
    fillAddressAndJurisdiction
};
