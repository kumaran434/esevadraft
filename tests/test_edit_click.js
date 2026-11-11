const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const express = require('express');

async function testEditButton() {
    const app = express();
    app.use(express.static(path.join(__dirname, '..', 'public')));
    app.use(express.json());
    
    // Mock endpoints needed
    app.get('/api/auth/session', (req, res) => res.json({ isLoggedIn: true, role: 'operator', operatorUid: 'test_op' }));
    app.get('/api/drafts', (req, res) => res.json({ success: true, drafts: [] }));
    app.get('/api/drafts/:mobile', (req, res) => {
        res.json({
            success: true,
            draft: {
                mobileNumber: '9790170026',
                operatorUid: 'test_op',
                service: 'புதிய ரேஷன் கார்டு',
                citizenProfile: {
                    fullNameTam: 'பாவனா',
                    fullNameEng: 'Bhavana',
                    headAadhaar: '367443820346',
                    members: [
                        { nameTam: 'பாவனா', nameEng: 'Bhavana', relationshipTam: 'குடும்பத் தலைவர்' },
                        { nameTam: 'சுரேஷ் வ', nameEng: 'Suresh V', relationshipTam: 'சகோதரர்', aadhaarNumber: '539088182578', docPath: 'uploads/suresh.jpg' },
                        { nameTam: 'குமரன் கி', nameEng: 'Kumaran K', relationshipTam: 'சகோதரர்', aadhaarNumber: '575567662931', docPath: 'uploads/kumaran.jpg' }
                    ]
                },
                documents: {
                    profilePhoto: 'uploads/photo.jpg',
                    headAadhaar: 'uploads/bhavana_aadhaar.pdf',
                    memberAadhaar: 'uploads/suresh.jpg',
                    gasBook: 'uploads/gas.jpg',
                    residenceProof: 'uploads/gas.jpg'
                }
            }
        });
    });
    app.get('/api/drafts/:mobile/documents-list', (req, res) => {
        res.json({
            success: true,
            count: 5,
            documents: [
                { type: 'profilePhoto', title: 'குடும்பத் தலைவர் புகைப்படம்', downloadUrl: '/doc/photo' },
                { type: 'headAadhaar', title: 'குடும்பத் தலைவர் ஆதார் (பாவனா)', downloadUrl: '/doc/aadhaar' },
                { type: 'memberAadhaar', title: 'உறுப்பினர் ஆதார் (சுரேஷ் வ)', downloadUrl: '/doc/m1' },
                { type: 'memberAadhaar', title: 'உறுப்பினர் ஆதார் (குமரன் கி)', downloadUrl: '/doc/m2' },
                { type: 'gasBook', title: 'எரிவாயு இணைப்பு அட்டை / ரசீது', downloadUrl: '/doc/gas' },
                { type: 'residenceProof', title: 'குடியிருப்புச் சான்று', downloadUrl: '/doc/res' }
            ]
        });
    });

    const server = http.createServer(app);
    await new Promise(r => server.listen(3009, r));
    console.log('Test server running on port 3009');

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => consoleMessages.push(`[${msg.type()}] ${msg.text()}`));
    page.on('pageerror', err => pageErrors.push(err.stack || err.message));

    await page.goto('http://127.0.0.1:3009/index.html');
    await page.waitForLoadState('networkidle');

    // Simulate loading the customer in localStorage & UI
    const evalRes = await page.evaluate(async () => {
        try {
            localStorage.setItem('eseva_user_role', 'operator');
            localStorage.setItem('eseva_operator_uid', 'test_op');
            localStorage.setItem('eseva_active_customer_mobile', '9790170026');

            // Fetch and set currentCitizenData
            const res = await fetch('/api/drafts/9790170026');
            const data = await res.json();
            window.currentCitizenData = data.draft.citizenProfile;
            window.currentCitizenData.documents = data.draft.documents;
            window.currentCitizenData.service = 'புதிய ரேஷன் கார்டு';

            if (typeof updateSidebar === 'function') {
                updateSidebar(data.draft);
            }
            if (typeof renderSidebarDocuments === 'function') {
                const docRes = await fetch('/api/drafts/9790170026/documents-list');
                const docData = await docRes.json();
                renderSidebarDocuments(docData.documents);
            }

            // Now test clicking the edit button!
            const btn = document.getElementById('btnSidebarEdit');
            if (!btn) return { error: 'btnSidebarEdit not found in DOM' };
            
            console.log('Clicking btnSidebarEdit...');
            btn.click();

            // Wait a tick for async openEditModal
            await new Promise(r => setTimeout(r, 200));

            const modal = document.getElementById('editModal');
            let disp = modal ? window.getComputedStyle(modal).display : 'null';
            const btnSidebarSuccess = disp === 'flex' || disp === 'block';

            // Close modal to test document row click
            if (typeof closeEditModal === 'function') closeEditModal();
            await new Promise(r => setTimeout(r, 100));

            // Test document row click
            const docsList = document.getElementById('sidebarDocsList');
            const firstDocRow = docsList?.firstElementChild;
            const rowCursor = firstDocRow ? window.getComputedStyle(firstDocRow).cursor : '';
            
            console.log('First doc row cursor:', rowCursor);
            if (firstDocRow) {
                firstDocRow.click();
                await new Promise(r => setTimeout(r, 200));
            }
            disp = modal ? window.getComputedStyle(modal).display : 'null';
            const docRowClickSuccess = disp === 'flex' || disp === 'block';

            // Close modal to test document edit button click
            if (typeof closeEditModal === 'function') closeEditModal();
            await new Promise(r => setTimeout(r, 100));

            const docEditBtn = firstDocRow?.querySelector('button[title*="திருத்து"]');
            const docBtnCursor = docEditBtn ? window.getComputedStyle(docEditBtn).cursor : '';
            console.log('Doc edit button cursor:', docBtnCursor);
            if (docEditBtn) {
                docEditBtn.click();
                await new Promise(r => setTimeout(r, 200));
            }
            disp = modal ? window.getComputedStyle(modal).display : 'null';
            const docEditBtnSuccess = disp === 'flex' || disp === 'block';

            return {
                btnSidebarSuccess,
                firstDocRowFound: Boolean(firstDocRow),
                rowCursor,
                docRowClickSuccess,
                docEditBtnFound: Boolean(docEditBtn),
                docBtnCursor,
                docEditBtnSuccess
            };
        } catch (e) {
            return { error: e.stack || e.message };
        }
    });

    console.log('Result:', evalRes);
    if (pageErrors.length > 0) {
        console.log('Page Errors:', pageErrors);
    }
    if (consoleMessages.length > 0) {
        console.log('Console Logs:\n' + consoleMessages.join('\n'));
    }

    await browser.close();
    server.close();
}

testEditButton().catch(console.error);
