// ============================================================================
// eSevaDraft Targeted Single-Service Fast Test Runner (< 0.1s)
// Usage: node tests/run_single.js --service=ADD_MEMBER
// ============================================================================

const assert = require('assert');
const { getServicePlugin, validateServiceContract } = require('../src/services/plugins');
const { getPortalDocumentPolicy } = require('../src/services/govt_document_policy');

const args = process.argv.slice(2);
let targetService = 'ADD_MEMBER';
for (const a of args) {
    if (a.startsWith('--service=')) targetService = a.split('=')[1].toUpperCase();
}

console.log(`🎯 Running Fast Targeted Test for: [${targetService}]`);
const start = Date.now();

const plugin = getServicePlugin(targetService);
if (!plugin) {
    console.error(`❌ Service plugin not found for: ${targetService}`);
    process.exit(1);
}

// 1. Verify Plugin Contract
assert.ok(plugin.id, 'Plugin must have id');
assert.ok(plugin.nameTamil, 'Plugin must have Tamil name');
assert.ok(plugin.portal, 'Plugin must specify portal');
console.log(`  ✅ [Plugin Contract] Validated metadata for: ${plugin.nameTamil} (${plugin.portal})`);

// 2. Verify Document Policy
const policy = getPortalDocumentPolicy(targetService);
assert.ok(policy.maxSizeKB > 0, 'Policy must have positive maxSizeKB');
console.log(`  ✅ [Document Policy] Ceiling: ${policy.maxSizeKB} KB | Format: ${policy.preferredFormat}`);

// 3. Service Invariant Validation
if (targetService === 'ADD_MEMBER' || targetService === 'RATION_ADD_MEMBER') {
    assert.strictEqual(plugin.contract.requiresHeadPhoto, false, 'Add Member must NOT require head photo');
    const sanitized = plugin.sanitizePayload({
        citizenProfile: { headPhotoPath: '/tmp/test.jpg' },
        documents: { profilePhoto: '/tmp/test.jpg', headAadhaar: '/tmp/test.pdf' }
    });
    assert.strictEqual(sanitized.citizenProfile.headPhotoPath, undefined);
    assert.strictEqual(sanitized.documents.profilePhoto, undefined);
    assert.strictEqual(sanitized.documents.headAadhaar, undefined);
    console.log('  ✅ [Zero-Head-Photo Invariant] Cleanse verified!');
}

const duration = Date.now() - start;
console.log(`🎉 SUCCESS: ${targetService} passed all checks in ${duration} ms!`);
