const { chromium } = require('playwright');
const path = require('path');

async function test() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  const page = context.pages().find(p => p.url().includes('3000')) || context.pages()[0];
  
  console.log('Page Title:', await page.title());
  
  // 1. Reset / Clear to clean screen
  await page.evaluate(() => {
    localStorage.removeItem('eseva_active_customer_mobile');
    localStorage.removeItem('eseva_active_customer_name');
    window.location.reload();
  });
  await page.waitForTimeout(2000);

  // 2. Click 'ரேஷன் கார்டு'
  console.log('Clicking ரேஷன் கார்டு...');
  await page.locator('button:has-text("ரேஷன் கார்டு"), .chat-option-btn:has-text("ரேஷன்")').first().click();
  await page.waitForTimeout(1000);

  // 3. Enter mobile 9790170026
  console.log('Entering 9790170026...');
  const mobileInput = page.locator('#newCustomerMobileInput');
  if (await mobileInput.isVisible()) {
    await mobileInput.fill('9790170026');
    await page.waitForTimeout(500);
    await page.locator('#modalStartCustomerBtn, button:has-text("வாடிக்கையாளர் சேவையைத் தொடங்கு")').first().click();
  } else {
    await page.locator('#chatInput').fill('9790170026');
    await page.locator('#sendMessageBtn').click();
  }
  await page.waitForTimeout(2500);

  // 4. Click 'குடும்ப உறுப்பினர் சேர்க்க'
  console.log('Clicking குடும்ப உறுப்பினர் சேர்க்க...');
  await page.locator('button:has-text("உறுப்பினர் சேர்க்க"), .chat-option-btn:has-text("உறுப்பினர் சேர்க்க")').first().click();
  await page.waitForTimeout(2000);

  // 5. Check Chat & Sidebar
  const chatText = await page.evaluate(() => {
    const bubbles = Array.from(document.querySelectorAll('.msg-bubble, .msg-bot'));
    return bubbles.map(b => b.innerText.trim()).slice(-2);
  });
  console.log('Last Chat Message:\n', chatText[chatText.length - 1]);

  const options = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.chat-option-btn, .option-btn')).map(b => b.innerText.trim());
  });
  console.log('Available Options:\n', options);

  const sidebarDocs = await page.evaluate(() => {
    const docItems = Array.from(document.querySelectorAll('#sidebarDocsList .doc-card, #sidebarDocsList .doc-item-title, #sidebarDocsList div'));
    return docItems.map(d => d.innerText.trim()).filter(Boolean);
  });
  console.log('Sidebar Documents:\n', sidebarDocs);

  // Capture screen
  const ssPath = path.join('C:\\Users\\ADMIN\\.gemini\\antigravity\\brain\\7275b959-cc05-4d20-98fc-29e1ebc6efb1', 'live_desktop_screen.png');
  await page.screenshot({ path: ssPath });
  console.log('Screenshot saved to', ssPath);

  await browser.close();
}

test().catch(console.error);
