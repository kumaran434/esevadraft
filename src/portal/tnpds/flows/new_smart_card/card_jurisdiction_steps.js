/**
 * TNPDS New Smart Card - Steps 14 to 20: Jurisdiction (District, Taluk, Village, Pin) & Mobile OTP
 */
const { waitForNewCardMobileOtp } = require('./new_card_otp_config');
let resolveTnDistrict;
try {
    const dm = require('../../../../tn_district_mapper');
    resolveTnDistrict = dm.resolveTnDistrict;
} catch (e) {
    resolveTnDistrict = (d, t, v) => ({ district: d, taluk: t, village: v, wasAutoCorrected: false });
}
let transliterateToTamil = (s) => s;
let transliterateToEnglish = (s) => s;
try {
    const bh = require('../../../../utils/bilingual_helper');
    transliterateToTamil = bh.transliterateToTamil || transliterateToTamil;
    transliterateToEnglish = bh.transliterateToEnglish || transliterateToEnglish;
} catch (_) {}

function buildGeoCandidates(primaryEng, primaryTam, extras = []) {
    const raw = [primaryEng, primaryTam, ...extras].filter(Boolean).map(s => String(s).trim()).filter(Boolean);
    const expanded = new Set();
    for (const r of raw) {
        expanded.add(r);
        if (/[a-zA-Z]/.test(r)) {
            const t = transliterateToTamil(r);
            if (t) expanded.add(t);
            if (/tirupathur/i.test(r)) expanded.add(r.replace(/tirupathur/ig, 'Tirupattur'));
            if (/tirupattur/i.test(r)) expanded.add(r.replace(/tirupattur/ig, 'Tirupathur'));
        }
        if (/[\u0B80-\u0BFF]/.test(r)) {
            const e = transliterateToEnglish(r);
            if (e) expanded.add(e);
        }
    }
    return Array.from(expanded);
}

/**
 * Selects the best matching <option> inside a <select> dropdown across Tamil & English variants
 * using normalized exact, substring, phonetic skeleton, and Dice bigram similarity (NEVER blind index[1]!).
 */
async function matchBestSelectOption(selectLoc, candidates = [], translitFn = null) {
    const rawOpts = await selectLoc.evaluate(sel => {
        if (!sel || !sel.options) return [];
        return Array.from(sel.options).map((o, idx) => ({ idx, value: o.value, text: (o.text || '').trim() }));
    }).catch(() => []);

    const validOpts = rawOpts.filter(o => o.value && !o.text.includes('தேர்ந்தெடுக்கவும்') && !o.text.toLowerCase().includes('select'));
    if (validOpts.length === 0) return null;

    const norm = (s) => String(s || '').toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^a-z0-9\u0B80-\u0BFF]/g, '');
    const phonSkel = (s) => String(s || '').toLowerCase()
        .replace(/[^a-z]/g, '')
        .replace(/aa/g, 'a').replace(/ee|ii/g, 'i').replace(/oo|uu/g, 'u')
        .replace(/th|dh/g, 't').replace(/tt/g, 't').replace(/kk/g, 'k').replace(/pp/g, 'p').replace(/nn/g, 'n').replace(/ll/g, 'l')
        .replace(/ph/g, 'f').replace(/v|w/g, 'v').replace(/g/g, 'k');

    const bigrams = (s) => {
        const out = [];
        for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
        return out;
    };
    const dice = (a, b) => {
        if (!a || !b) return 0;
        if (a === b) return 1;
        if (a.length < 2 || b.length < 2) return 0;
        const ba = bigrams(a), bb = bigrams(b);
        let hits = 0;
        const used = new Array(bb.length).fill(false);
        for (const x of ba) {
            const idx = bb.findIndex((y, j) => !used[j] && y === x);
            if (idx !== -1) { used[idx] = true; hits++; }
        }
        return (2 * hits) / (ba.length + bb.length);
    };

    const candForms = candidates.map(c => {
        const cStr = String(c || '').trim();
        const extraEng = (/[\u0B80-\u0BFF]/.test(cStr) && translitFn) ? translitFn(cStr) : '';
        return { raw: cStr, n: norm(cStr), skel: phonSkel(cStr), extraN: norm(extraEng), extraSkel: phonSkel(extraEng) };
    }).filter(c => c.n);

    let best = null;
    let bestScore = 0;

    for (const o of validOpts) {
        const oN = norm(o.text);
        const oEngFromTam = (/[\u0B80-\u0BFF]/.test(o.text) && translitFn) ? translitFn(o.text) : '';
        const oEngN = norm(oEngFromTam);
        const oSkel = phonSkel(o.text);
        const oTamSkel = phonSkel(oEngFromTam);

        for (const c of candForms) {
            let s = 0;
            if (c.n && oN && (oN === c.n || (oEngN && oEngN === c.n))) s = 1.0;
            else if (c.n.length >= 3 && (oN.includes(c.n) || c.n.includes(oN) || (oEngN && (oEngN.includes(c.n) || c.n.includes(oEngN))))) s = 0.9;
            else if (c.skel.length >= 3 && ((oSkel && oSkel === c.skel) || (oTamSkel && oTamSkel === c.skel))) s = 0.85;
            else {
                const d1 = dice(c.n, oN);
                const d2 = c.skel && oSkel ? dice(c.skel, oSkel) : 0;
                const d3 = c.skel && oTamSkel ? dice(c.skel, oTamSkel) : 0;
                const d4 = c.extraN && oN ? dice(c.extraN, oN) : 0;
                s = Math.max(d1, d2 * 0.92, d3 * 0.92, d4 * 0.88);
            }
            if (s > bestScore) {
                bestScore = s;
                best = o;
            }
        }
    }

    if (best && bestScore >= 0.58) {
        return { value: best.value, text: best.text, score: bestScore };
    }
    return null;
}

async function executeJurisdictionSteps(page, citizenProfile, sanitizedProfile, onProgress, sharedContext, logDiag, takeStepSnapshot, scanAndBroadcastToasts) {
    const { requestOtpFromUser } = sharedContext;
    const { pincode, userMobile, engStreet, engArea, tamStreet, tamArea } = sanitizedProfile;

    const rawAddr = [engStreet, tamStreet, engArea, tamArea].filter(Boolean).join(' ');
    const resolvedLoc = resolveTnDistrict(citizenProfile.district, citizenProfile.taluk, citizenProfile.village, pincode, rawAddr);
    let targetDist = resolvedLoc.district || citizenProfile.district || 'Ranipet';
    let targetTaluk = resolvedLoc.taluk || citizenProfile.taluk || 'Nemili';
    let targetVillage = resolvedLoc.village || citizenProfile.village || 'Kaveripakkam';
    if (resolvedLoc.wasAutoCorrected) {
        onProgress(`💡 **மாவட்ட தானியங்கி சரிபார்ப்பு:** ${resolvedLoc.reason}`);
    }

    async function locateDropdown(type) {
        if (type === 'district') {
            const loc = page.locator('select[formcontrolname="district"], select[formcontrolname*="district" i]').first();
            if (await loc.count() > 0) return loc;
        } else if (type === 'taluk') {
            const loc = page.locator('select[formcontrolname="taluk"], select[formcontrolname="talukId"], select[formcontrolname*="taluk" i]').first();
            if (await loc.count() > 0) return loc;
        } else if (type === 'village') {
            const loc = page.locator('select[formcontrolname="village"], select[formcontrolname="villageId"], select[formcontrolname*="village" i]').first();
            if (await loc.count() > 0) return loc;
        }
        const roleIdx = type === 'district' ? 2 : (type === 'taluk' ? 3 : 4);
        const allSelects = page.locator('select');
        if (await allSelects.count() > roleIdx) return allSelects.nth(roleIdx);
        return allSelects.first();
    }

    // படி 14: மாவட்டம் தேர்வு
    onProgress(`📍 [படி 14/51] மாவட்டம் (${targetDist}) தேர்ந்தெடுக்கப்படுகிறது...`);
    const distSelect = await locateDropdown('district');
    await distSelect.waitFor({ state: 'attached', timeout: 15000 }).catch(() => {});
    await page.waitForFunction(() => {
        const sel = document.querySelector('select[formcontrolname="district"]');
        return Boolean(sel && sel.options && sel.options.length > 1);
    }, { timeout: 15000 }).catch(() => {});

    const distCands = buildGeoCandidates(targetDist, citizenProfile.districtTam, [citizenProfile.district]);
    const distOpt = await matchBestSelectOption(distSelect, distCands, transliterateToEnglish) || await distSelect.evaluate((sel, { dName, dTam }) => {
        const dLower = (dName || '').toLowerCase();
        let opt = Array.from(sel.options).find(o => {
            const txt = (o.text || '').toLowerCase();
            return (dLower && txt.includes(dLower)) || (dTam && o.text.includes(dTam));
        });
        if (!opt && (dLower.includes('ranipet') || (dTam && dTam.includes('ராணிப்பேட்டை')))) {
            opt = Array.from(sel.options).find(o => o.text.includes('Ranipet') || o.text.includes('ராணிப்பேட்டை') || o.text.includes('இராணிப்பேட்டை'));
        }
        return opt ? { value: opt.value, text: opt.text } : null;
    }, { dName: targetDist, dTam: citizenProfile.districtTam });

    if (distOpt) {
        await distSelect.selectOption(distOpt.value);
        await distSelect.dispatchEvent('input').catch(() => {});
        await distSelect.dispatchEvent('change').catch(() => {});
        await page.evaluate((val) => {
            const sel = document.querySelector('select[formcontrolname="district"]');
            if (sel) {
                sel.value = val;
                sel.dispatchEvent(new Event('input', { bubbles: true }));
                sel.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }, distOpt.value).catch(() => {});
    }
    await page.waitForTimeout(1000);

    const isDistVerified = await distSelect.evaluate(sel => sel && sel.value && !sel.options[sel.selectedIndex]?.text.includes('தேர்ந்தெடுக்கவும்'));
    if (!isDistVerified) return { success: false, message: `படி 14 மாவட்டம் (${targetDist}) தேர்வு தோல்வி.` };
    const verifiedDistName = await distSelect.evaluate(sel => sel.options[sel.selectedIndex]?.text || '');
    onProgress(`✅ [படி 14/51] மாவட்டம் (${verifiedDistName.trim() || targetDist}) வெற்றிகரமாகத் தேர்ந்தெடுக்கப்பட்டு பூட்டப்பட்டது!`);

    // படி 15: வட்டம் தேர்வு
    onProgress(`📍 [படி 15/51] வட்டம் (${targetTaluk}) தேர்ந்தெடுக்கப்படுகிறது...`);
    const talukSelect = await locateDropdown('taluk');
    await talukSelect.waitFor({ state: 'attached', timeout: 15000 }).catch(() => {});

    // Wait for taluk options to load, re-triggering district change if needed
    for (let waitT = 0; waitT < 20; waitT++) {
        const optCount = await talukSelect.evaluate(sel => (sel && sel.options ? sel.options.length : 0)).catch(() => 0);
        if (optCount > 1) break;
        if (waitT === 3 || waitT === 8) {
            await distSelect.dispatchEvent('change').catch(() => {});
        }
        await page.waitForTimeout(1000);
    }

    const talukCands = buildGeoCandidates(targetTaluk, citizenProfile.talukTam, [citizenProfile.taluk]);
    const talukOpt = await matchBestSelectOption(talukSelect, talukCands, transliterateToEnglish) || await talukSelect.evaluate((sel, { tName, tTam }) => {
        const tLower = (tName || '').toLowerCase();
        let opt = Array.from(sel.options).find(o => {
            const txt = (o.text || '').toLowerCase();
            return (tLower && txt.includes(tLower)) || (tTam && o.text.includes(tTam));
        });
        if (!opt && (tLower.includes('arakkonam') || (tTam && tTam.includes('அரக்கோணம்')))) {
            opt = Array.from(sel.options).find(o => o.text.includes('Arakkonam') || o.text.includes('அரக்கோணம்'));
        }
        if (!opt && (tLower.includes('nemili') || (tTam && tTam.includes('நெமிலி')))) {
            opt = Array.from(sel.options).find(o => o.text.includes('Nemili') || o.text.includes('நெமிலி'));
        }
        return opt ? { value: opt.value, text: opt.text } : null;
    }, { tName: targetTaluk, tTam: citizenProfile.talukTam });

    if (talukOpt) {
        await talukSelect.selectOption(talukOpt.value);
        await talukSelect.dispatchEvent('input').catch(() => {});
        await talukSelect.dispatchEvent('change').catch(() => {});
        await page.evaluate((val) => {
            const sel = document.querySelector('select[formcontrolname="taluk"]');
            if (sel) {
                sel.value = val;
                sel.dispatchEvent(new Event('input', { bubbles: true }));
                sel.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }, talukOpt.value).catch(() => {});
    }
    await page.waitForTimeout(1000);

    const isTalukVerified = await talukSelect.evaluate(sel => sel && sel.value && !sel.options[sel.selectedIndex]?.text.includes('தேர்ந்தெடுக்கவும்'));
    if (!isTalukVerified) return { success: false, message: `படி 15 வட்டம் (${targetTaluk}) தேர்வு தோல்வி.` };
    const verifiedTalukName = await talukSelect.evaluate(sel => sel.options[sel.selectedIndex]?.text || '');
    onProgress(`✅ [படி 15/51] வட்டம் (${verifiedTalukName.trim() || targetTaluk}) வெற்றிகரமாகத் தேர்ந்தெடுக்கப்பட்டு பூட்டப்பட்டது!`);

    // படி 16: கிராமம் தேர்வு
    onProgress(`📍 [படி 16/51] கிராமம் (${targetVillage}) தேர்ந்தெடுக்கப்படுகிறது...`);
    const villageSelect = await locateDropdown('village');
    await villageSelect.waitFor({ state: 'attached', timeout: 15000 }).catch(() => {});

    // Wait for village options to load, re-triggering taluk change if needed
    for (let waitV = 0; waitV < 20; waitV++) {
        const optCount = await villageSelect.evaluate(sel => (sel && sel.options ? sel.options.length : 0)).catch(() => 0);
        if (optCount > 1) break;
        if (waitV === 3 || waitV === 8) {
            await talukSelect.dispatchEvent('change').catch(() => {});
        }
        await page.waitForTimeout(1000);
    }

    const villageCands = buildGeoCandidates(
        targetVillage,
        citizenProfile.villageTam,
        [citizenProfile.village, citizenProfile.areaEng, citizenProfile.areaTam, engArea, tamArea]
    );
    const villageOpt = await matchBestSelectOption(villageSelect, villageCands, transliterateToEnglish) || await villageSelect.evaluate((sel, { vName, vTam }) => {
        if (!sel || sel.options.length <= 1) return null;
        const cleanV = (vName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const cleanVTam = (vTam || '').trim();
        let opt = Array.from(sel.options).find(o => {
            const txt = (o.text || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            return (cleanV && txt.includes(cleanV)) || (cleanVTam && o.text.includes(cleanVTam));
        });
        // ONLY fall back to index[1] if no targetVillage was provided at all; NEVER pick wrong alphabetical village!
        if (!opt && !cleanV && !cleanVTam && sel.options.length > 1) opt = sel.options[1];
        return opt ? { value: opt.value, text: opt.text } : null;
    }, { vName: targetVillage, vTam: citizenProfile.villageTam });

    if (villageOpt) {
        await villageSelect.selectOption(villageOpt.value);
        await villageSelect.dispatchEvent('input').catch(() => {});
        await villageSelect.dispatchEvent('change').catch(() => {});
        await page.evaluate((val) => {
            const sel = document.querySelector('select[formcontrolname="village"]');
            if (sel) {
                sel.value = val;
                sel.dispatchEvent(new Event('input', { bubbles: true }));
                sel.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }, villageOpt.value).catch(() => {});
    }
    await page.waitForTimeout(1000);

    const isVillageVerified = await villageSelect.evaluate(sel => sel && sel.value && !sel.options[sel.selectedIndex]?.text.includes('தேர்ந்தெடுக்கவும்'));
    if (!isVillageVerified) return { success: false, message: `படி 16 கிராமம் (${targetVillage}) தேர்வு தோல்வி.` };
    const verifiedVillageName = await villageSelect.evaluate(sel => sel.options[sel.selectedIndex]?.text || '');
    onProgress(`✅ [படி 16/51] கிராமம் (${verifiedVillageName.trim() || targetVillage}) வெற்றிகரமாகத் தேர்ந்தெடுக்கப்பட்டு பூட்டப்பட்டது!`);

    // படி 17: பின்கோடு
    onProgress(`📍 [படி 17/51] அஞ்சல் குறியீடு (${pincode}) உள்ளிடப்படுகிறது...`);
    const pinInp = page.locator('input[formcontrolname="pinCode"]').first();
    if (await pinInp.count() > 0) {
        await pinInp.click();
        await pinInp.fill(pincode);
        await pinInp.dispatchEvent('change');
        await page.waitForTimeout(300);
    }
    const verifiedPin = (await pinInp.inputValue().catch(() => '')).trim();
    if (verifiedPin.length !== 6) return { success: false, message: `படி 17 அஞ்சல் குறியீடு (${pincode}) உள்ளீடு தோல்வி.` };
    onProgress(`✅ [படி 17/51] அஞ்சல் குறியீடு (${verifiedPin}) வெற்றிகரமாக உள்ளிடப்பட்டு பூட்டப்பட்டது!`);

    // படி 18: மொபைல் எண்
    onProgress(`📍 [படி 18/51] கைபேசி எண் (${userMobile}) உள்ளிடப்படுகிறது...`);
    const mobileInp = page.locator('input[formcontrolname="mobileNumber"]').first();
    await mobileInp.click();
    await mobileInp.fill(userMobile);
    await mobileInp.dispatchEvent('change');
    await page.waitForTimeout(500);

    const verifiedMob = (await mobileInp.inputValue().catch(() => '')).replace(/\D/g, '');
    if (verifiedMob.length !== 10) return { success: false, message: `படி 18 கைபேசி எண் (${userMobile}) உள்ளீடு தோல்வி.` };
    onProgress(`✅ [படி 18/51] கைபேசி எண் (${verifiedMob}) வெற்றிகரமாக உள்ளிடப்பட்டு பூட்டப்பட்டது!`);

    // Auto-dismiss accidental exit confirmation modal if present
    await page.evaluate(() => {
        const modals = Array.from(document.querySelectorAll('.modal, div[role="dialog"]'));
        for (const m of modals) {
            const txt = (m.innerText || '').trim();
            if (txt.includes('வெளியேற விரும்புகிறீர்களா') || txt.includes('நீங்கள் வெளியேற')) {
                const noBtn = Array.from(m.querySelectorAll('button, a')).find(b => {
                    const bt = (b.innerText || '').trim();
                    return bt === 'இல்லை' || bt === 'No' || bt.includes('இல்லை');
                });
                if (noBtn) noBtn.click();
            }
        }
    }).catch(() => {});

    // Check if OTP modal is already open
    const isModalAlreadyOpen = await page.evaluate(() => {
        const m = document.querySelector('.modal.show, div[role="dialog"]');
        return Boolean(m && (m.offsetParent !== null || getComputedStyle(m).display !== 'none'));
    }).catch(() => false);

    if (isModalAlreadyOpen) {
        // If countdown timer expired (0 நொடிகள்), auto-click Resend button inside modal
        const isTimerExpired = await page.evaluate(() => {
            const m = document.querySelector('.modal.show, div[role="dialog"]');
            if (!m) return false;
            const txt = (m.innerText || '').trim();
            return txt.includes('0 நொடிகள்') || txt.includes('0 seconds') || txt.includes('காலாவதி');
        }).catch(() => false);

        if (isTimerExpired) {
            onProgress('🔄 [OTP மீட்சி] முந்தைய OTP காலம் முடிந்துவிட்டதால், "மீண்டும் அனுப்புங்கள்" தானாக அழுத்தப்படுகிறது...');
            await page.evaluate(() => {
                const m = document.querySelector('.modal.show, div[role="dialog"]');
                if (!m) return;
                const btns = Array.from(m.querySelectorAll('button, a'));
                const resendBtn = btns.find(b => {
                    const t = (b.innerText || '').toLowerCase();
                    return t.includes('மீண்டும்') || t.includes('மறுமுறை') || t.includes('resend') || t.includes('generate');
                });
                if (resendBtn) resendBtn.click();
            }).catch(() => {});
            await page.waitForTimeout(2500);
            await scanAndBroadcastToasts();
        }
    } else {
        // படி 19: OTP உருவாக்கு
        onProgress('📍 [படி 19/51] OTP உருவாக்கு பொத்தான் அழுத்தப்படுகிறது...');
        const otpBtn = page.getByRole('button', { name: /OTP ஐ உருவாக்கு|Generate OTP|மறுமுறை அனுப்பவும்/i }).first();
        await otpBtn.scrollIntoViewIfNeeded().catch(() => {});
        await otpBtn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(2500);
        await scanAndBroadcastToasts();
    }

    // படி 20: மொபைல் OTP பெறுதல் (புதிய ரேஷன் கார்டுக்கான தனி 6-இலக்க OTP கட்டுப்பாடு — new_card_otp_config.js)
    const receivedOtp = await waitForNewCardMobileOtp(page, userMobile, onProgress, sharedContext);
    if (receivedOtp === 'RADWARE_PAGE_REFRESH_DETECTED') {
        const err = new Error('RADWARE_PAGE_REFRESH_DETECTED:படி 20 மொபைல் OTP');
        err.isRadwarePageRefresh = true;
        err.stepLabel = 'படி 20 மொபைல் OTP';
        throw err;
    }

    return { success: true, receivedOtp };
}

module.exports = {
    executeJurisdictionSteps
};
