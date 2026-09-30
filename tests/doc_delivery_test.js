const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { saveCitizenDraft, getCitizenDraft } = require('../firestore_db');

async function testDocDelivery() {
    console.log('Testing Universal Base64 Document Persistence...');
    const testMobile = '9998887766';
    
    // Create a dummy image file for test
    const dummyUploadsDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(dummyUploadsDir)) fs.mkdirSync(dummyUploadsDir, { recursive: true });
    const dummyFile = path.join(dummyUploadsDir, 'test_sample_photo.jpg');
    fs.writeFileSync(dummyFile, Buffer.from('FAKE_JPEG_BINARY_DATA_FOR_TESTING'));

    const sampleDraft = {
        name: 'முருகன்',
        citizenProfile: {
            fullNameTam: 'முருகன்',
            fullNameEng: 'MURUGAN',
            headAadhaar: '999988887777',
            headPhotoPath: dummyFile,
            members: [
                { fullNameTam: 'முருகன்', relationship: 'Family Head', docPath: dummyFile }
            ]
        },
        documents: {
            profilePhoto: dummyFile,
            headAadhaar: dummyFile
        }
    };

    // 1. Save draft
    const saved = await saveCitizenDraft(testMobile, sampleDraft);
    assert(saved, 'Draft should be saved');
    assert(saved.base64Docs, 'base64Docs must exist on saved draft');
    assert(saved.base64Docs.profilePhotoBase64, 'profilePhotoBase64 must exist on saved draft');
    assert(saved.base64Docs.profilePhotoName, 'profilePhotoName must exist on saved draft');
    console.log('  ✅ PASS: saveCitizenDraft preserved base64Docs');

    // 2. Retrieve draft
    const restored = await getCitizenDraft(testMobile);
    assert(restored, 'Draft should be retrieved');
    assert(restored.base64Docs, 'base64Docs must exist on restored draft');
    assert(restored.base64Docs.profilePhotoBase64, 'profilePhotoBase64 must exist on restored draft');
    console.log('  ✅ PASS: getCitizenDraft restored complete base64Docs');

    // Cleanup test files
    try {
        const localDraft = path.join(__dirname, '..', 'data', 'drafts', `${testMobile}.json`);
        if (fs.existsSync(localDraft)) fs.unlinkSync(localDraft);
        if (fs.existsSync(dummyFile)) fs.unlinkSync(dummyFile);
    } catch (e) {}

    console.log('🎉 Document Delivery test passed 100%!\n');
}

testDocDelivery().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
