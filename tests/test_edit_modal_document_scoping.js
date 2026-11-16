const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Edit Modal Document Scoping & Photo Deletion Fallback Immunity...\n');

// Test 1: Verify public/index.html sidebar edit buttons pass false (service scoped)
const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
assert(!indexHtml.includes('id="btnSidebarEdit" type="button" onclick="openEditModal(null, true)"'), 'btnSidebarEdit must not force master profile');
assert(indexHtml.includes('id="btnSidebarEdit" type="button" onclick="openEditModal(null, false)"'), 'btnSidebarEdit must open service-scoped modal');
console.log('✅ Test 1 Passed: public/index.html sidebar edit button correctly passes false (service-scoped).');

// Test 2: Verify edit_modal_manager.js initSidebarActionBindings passes false
const editModalJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'modules', 'edit_modal_manager.js'), 'utf8');
assert(editModalJs.includes('window.openEditModal(null, false);'), 'initSidebarActionBindings must pass false');
assert(!editModalJs.includes('window.openEditModal(null, true);'), 'initSidebarActionBindings must not force master profile');
console.log('✅ Test 2 Passed: edit_modal_manager.js initSidebarActionBindings passes false.');

// Test 3: Verify operator_drafts.js passes false
const operatorDraftsJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'modules', 'operator_drafts.js'), 'utf8');
assert(!operatorDraftsJs.includes('await openEditModal(mobileClean, true);'), 'operator_drafts.js must not force master profile');
assert(operatorDraftsJs.includes('await openEditModal(mobileClean, false);'), 'operator_drafts.js passes false for service-scoped editing');
console.log('✅ Test 3 Passed: operator_drafts.js correctly passes false for service-scoped editing.');

// Test 4: Verify profile_update_service.js explicitly clears headPhotoPath on null
const { applyProfileUpdates } = require('../src/services/profile_update_service');
const mockSess = {
    citizenProfile: {
        fullNameEng: 'Kumaran K',
        headPhotoPath: 'D:\\uploads\\9790170026\\photo.jpg',
        documents: {
            profilePhoto: 'D:\\uploads\\9790170026\\photo.jpg'
        }
    },
    tempUploads: {
        profilePhoto: 'D:\\uploads\\9790170026\\photo.jpg'
    }
};

applyProfileUpdates(mockSess, {
    fullNameEng: 'Kumaran K',
    headPhotoPath: null,
    profilePhoto: null
});

assert.strictEqual(mockSess.citizenProfile.headPhotoPath, undefined, 'headPhotoPath must be deleted on null update');
assert.strictEqual(mockSess.citizenProfile.profilePhoto, undefined, 'profilePhoto must be deleted on null update');
assert.strictEqual(mockSess.citizenProfile.documents.profilePhoto, undefined, 'documents.profilePhoto must be deleted on null update');
assert.strictEqual(mockSess.tempUploads.profilePhoto, undefined, 'tempUploads.profilePhoto must be deleted on null update');
console.log('✅ Test 4 Passed: applyProfileUpdates strictly purges headPhotoPath on null update (Zero Fallback Guarantee).');

// Test 5: Verify edit_modal_manager.js ALWAYS fetches fresh draft
assert(editModalJs.includes('const dRes = await fetch(`/api/drafts/${encodeURIComponent(activeCustMob)}`);'), 'openEditModal always fetches fresh draft from server API');
assert(!editModalJs.includes('if (activeCustMob && (!data.fullNameEng && !data.fullNameTam || targetMobile))'), 'Stale memory guard removed from openEditModal');
console.log('✅ Test 5 Passed: openEditModal unconditionally loads fresh draft state from server API.');

console.log('\n🎉 ALL EDIT MODAL SCOPING & PHOTO FALLBACK TESTS PASSED 100%!');
