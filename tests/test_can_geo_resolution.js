const assert = require('assert');
const { resolveTnDistrict } = require('../tn_district_mapper');

console.log('==================================================');
console.log('🧪 TESTING CAN & TN DISTRICT RESOLUTION ENGINE');
console.log('==================================================');

// 1. Salem District Citizen Test
console.log('\n[TEST 1] Salem District Citizen: Attur Taluk');
const salemRes = resolveTnDistrict('Salem', 'Attur', 'Attur', '636102', '12, Gandhi Road, Attur, Salem - 636102');
console.log('  Salem Result:', salemRes);
assert.strictEqual(salemRes.district, 'Salem', 'Must retain Salem district');
assert.strictEqual(salemRes.taluk, 'Attur', 'Must retain Attur taluk');
assert.strictEqual(salemRes.village, 'Attur', 'Must retain Attur village');
assert.strictEqual(salemRes.wasAutoCorrected, false, 'Salem should NOT be auto-corrected');
console.log('  ✅ PASS: Salem citizen accurately preserved (NO Tirupathur or Ranipet false positive)');

// 2. Coimbatore District Citizen Test
console.log('\n[TEST 2] Coimbatore District Citizen: Pollachi Taluk');
const cbeRes = resolveTnDistrict('Coimbatore', 'Pollachi', 'Pollachi', '642001', '55, Main Road, Pollachi, Coimbatore - 642001');
console.log('  Coimbatore Result:', cbeRes);
assert.strictEqual(cbeRes.district, 'Coimbatore', 'Must retain Coimbatore district');
assert.strictEqual(cbeRes.taluk, 'Pollachi', 'Must retain Pollachi taluk');
assert.strictEqual(cbeRes.village, 'Pollachi', 'Must retain Pollachi village');
assert.strictEqual(cbeRes.wasAutoCorrected, false, 'Coimbatore should NOT be auto-corrected');
console.log('  ✅ PASS: Coimbatore citizen accurately preserved (NO Arakkonam or Minnal)');

// 3. Chennai District Citizen Test
console.log('\n[TEST 3] Chennai District Citizen: Mylapore');
const chnRes = resolveTnDistrict('Chennai', 'Mylapore', 'Mylapore', '600004', '10, North Mada Street, Mylapore, Chennai - 600004');
console.log('  Chennai Result:', chnRes);
assert.strictEqual(chnRes.district, 'Chennai', 'Must retain Chennai district');
assert.strictEqual(chnRes.taluk, 'Mylapore', 'Must retain Mylapore taluk');
assert.strictEqual(chnRes.wasAutoCorrected, false, 'Chennai should NOT be auto-corrected to Chengalpattu');
console.log('  ✅ PASS: Chennai citizen accurately preserved (NO Chengalpattu false positive)');

// 4. Madurai District Citizen Test
console.log('\n[TEST 4] Madurai District Citizen: Madurai North / Anuppanadi');
const mduRes = resolveTnDistrict('Madurai', 'Madurai North', 'Anuppanadi', '625009');
console.log('  Madurai Result:', mduRes);
assert.strictEqual(mduRes.district, 'Madurai', 'Must retain Madurai district');
assert.strictEqual(mduRes.taluk, 'Madurai North', 'Must retain Madurai North taluk');
assert.strictEqual(mduRes.village, 'Anuppanadi', 'Must retain Anuppanadi village');
assert.strictEqual(mduRes.wasAutoCorrected, false, 'Madurai should NOT be auto-corrected');
console.log('  ✅ PASS: Madurai citizen accurately preserved');

// 5. Bifurcated District Auto-Correction Test: Vellore -> Ranipet (Kaveripakkam)
console.log('\n[TEST 5] Bifurcated District: Vellore -> Ranipet (Kaveripakkam)');
const ranipetRes = resolveTnDistrict('Vellore', '', 'Kaveripakkam', '632508');
console.log('  Bifurcation Result:', ranipetRes);
assert.strictEqual(ranipetRes.district, 'Ranipet', 'Must auto-correct Vellore to Ranipet');
assert.strictEqual(ranipetRes.taluk, 'Nemili', 'Must map to Nemili taluk');
assert.strictEqual(ranipetRes.village, 'Kaveripakkam', 'Must retain Kaveripakkam village');
assert.strictEqual(ranipetRes.wasAutoCorrected, true, 'Must flag auto-corrected');
console.log('  ✅ PASS: Bifurcated parent district auto-corrected to Ranipet cleanly');

// 6. Hamlet Auto-Correction Test: Narasingapuram Hamlet under Minnal Revenue Village
console.log('\n[TEST 6] Hamlet Auto-Resolution: Narasingapuram -> Minnal');
const hamletRes = resolveTnDistrict('Ranipet', 'Arakkonam', 'Narasingapuram', '631002');
console.log('  Hamlet Result:', hamletRes);
assert.strictEqual(hamletRes.village, 'Minnal', 'Must map hamlet to parent revenue village Minnal');
assert.strictEqual(hamletRes.areaTam, 'நரசிங்கபுரம்', 'Must preserve Tamil hamlet name for address line 3');
assert.strictEqual(hamletRes.areaEng, 'NARASINGAPURAM', 'Must preserve English hamlet name');
console.log('  ✅ PASS: Hamlet correctly mapped to revenue village Minnal with hamlet in address');

// 7. Verify CAN Automation Form Filling Logic does not hardcode IDs
console.log('\n[TEST 7] CAN Automation Code Inspection for Zero-Hardcoded Location IDs');
const fs = require('fs');
const path = require('path');
const canCode = fs.readFileSync(path.join(__dirname, '../src/portal/tnega/tnega_can_register.js'), 'utf8');

assert(!canCode.includes("safeSelect(distSelect, '37')"), 'Must NOT contain hardcoded Ranipet ID 37 in distSelect');
assert(!canCode.includes("safeSelect(talukSelect, '342')"), 'Must NOT contain hardcoded Arakkonam ID 342 in talukSelect');
assert(!canCode.includes("safeSelect(villSelect, '23595')"), 'Must NOT contain hardcoded Minnal ID 23595 in villSelect');
assert(canCode.includes('safeSelectLocation(distSelect, distCandidates)'), 'Must use dynamic safeSelectLocation for district');
assert(canCode.includes('safeSelectLocation(talukSelect, talukCandidates)'), 'Must use dynamic safeSelectLocation for taluk');
assert(canCode.includes('safeSelectLocation(villSelect, villageCandidates)'), 'Must use dynamic safeSelectLocation for village');
console.log('  ✅ PASS: Zero hardcoded location IDs in tnega_can_register.js');

console.log('\n==================================================');
console.log('🎉 ALL 7 CAN & TN DISTRICT TESTS PASSED WITH 100% SUCCESS!');
console.log('==================================================\n');
