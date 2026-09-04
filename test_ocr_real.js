require('dotenv').config();
const { extractDocumentDetails } = require('./ocr');
const path = require('path');

async function testRealUploads() {
    const uploadsDir = path.join(__dirname, 'uploads');
    
    console.log('\n--- 1. Testing Family Head Aadhaar ---');
    const headAadhaar = path.join(uploadsDir, '1788072275810-family_head_aagarcard_.jpeg');
    const headResult = await extractDocumentDetails(headAadhaar);
    console.log('Head Result:', JSON.stringify(headResult, null, 2));

    console.log('\n--- 2. Testing Member Aadhaar ---');
    const memberAadhaar = path.join(uploadsDir, '1788072280463-family_mebers_aadarcard_.jpeg');
    const memberResult = await extractDocumentDetails(memberAadhaar);
    console.log('Member Result:', JSON.stringify(memberResult, null, 2));

    console.log('\n--- 3. Testing Gas Book ---');
    const gasBook = path.join(uploadsDir, '1788072284153-gasbook_photo.jpeg');
    const gasResult = await extractDocumentDetails(gasBook);
    console.log('Gas Result:', JSON.stringify(gasResult, null, 2));
}

testRealUploads();
