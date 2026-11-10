/**
 * scripts/run_desktop_automation.js
 * 
 * Developer Command Line Runner:
 * Launches eSevaDraft Desktop App with Playwright automation to accelerate developer workflows.
 * 
 * Usage:
 *   node scripts/run_desktop_automation.js                # Default smoke check + screenshot
 *   node scripts/run_desktop_automation.js --login        # Fast-track Quick Dev Login
 *   node scripts/run_desktop_automation.js --keep-open    # Opens app, logs in, leaves window open for developer
 *   node scripts/run_desktop_automation.js --flow ration  # Runs automated Ration Card service selection check
 */

const { DesktopAppDriver } = require('../src/automation/desktop_driver');

async function main() {
    const args = process.argv.slice(2);
    const shouldLogin = args.includes('--login') || args.includes('--flow') || args.includes('--keep-open');
    const keepOpen = args.includes('--keep-open');
    const flowArgIndex = args.indexOf('--flow');
    const targetFlow = flowArgIndex !== -1 ? args[flowArgIndex + 1] : null;

    console.log('========================================================');
    console.log('🚀 eSevaDraft Desktop App Autonomous Developer Runner');
    console.log('========================================================\n');

    const driver = new DesktopAppDriver({
        slowMo: 100 // Smooth visible human interaction
    });

    try {
        const window = await driver.launch();
        await window.waitForTimeout(1000);

        if (shouldLogin) {
            await driver.quickDevLogin();
            await driver.screenshot('desktop_logged_in.png');
        }

        if (targetFlow === 'ration') {
            console.log('📋 [Workflow] Testing Ration Card Service Selection...');
            // In the chat / service buttons, search for Ration Card option
            const rationOption = window.locator('button:has-text("ரேஷன் கார்டு"), .chat-option-btn:has-text("ரேஷன்"), .option-btn:has-text("ரேஷன்")');
            await rationOption.first().waitFor({ state: 'visible', timeout: 5000 });
            await rationOption.first().click();
            console.log('   ✅ Clicked Ration Card service option!');
            await window.waitForTimeout(1000);

            // Check if Customer Mobile Modal opened
            const mobileInput = window.locator('#newCustomerMobileInput');
            if (await mobileInput.count() > 0 && await mobileInput.first().isVisible()) {
                console.log('📱 [Workflow] Customer Mobile Modal detected. Entering test mobile 9842367866...');
                await mobileInput.first().fill('9842367866');
                await window.waitForTimeout(500);

                const startBtn = window.locator('button[onclick="startCustomerSessionFromModal()"]');
                try {
                    await startBtn.first().click({ force: true, timeout: 3000 });
                } catch (_) {
                    await window.evaluate(() => {
                        if (typeof window.startCustomerSessionFromModal === 'function') {
                            window.startCustomerSessionFromModal();
                        }
                    });
                }
                console.log('   ✅ Submitted Customer Session!');
                await window.waitForTimeout(2000);
            }

            // In sub-service options, look for "குடும்ப உறுப்பினர் சேர்க்க" (Add Member)
            const addMemberBtn = window.locator('button:has-text("குடும்ப உறுப்பினர் சேர்க்க"), .chat-option-btn:has-text("உறுப்பினர்")');
            if (await addMemberBtn.count() > 0 && await addMemberBtn.first().isVisible()) {
                console.log('👨‍👩‍👧 [Workflow] Clicking "குடும்ப உறுப்பினர் சேர்க்க" (Add Member)...');
                await addMemberBtn.first().click();
                await window.waitForTimeout(2000);
            }

            await driver.screenshot('desktop_flow_ration.png');
        } else {
            await driver.screenshot('desktop_runner_ready.png');
        }

        console.log('\n🎉 [Success] Desktop Automation completed successfully!');

        if (keepOpen) {
            console.log('\n👀 App is left OPEN for developer inspection.');
            console.log('Press Ctrl+C in this terminal when finished to close.');
            await new Promise(() => {}); // Keep alive indefinitely until Ctrl+C
        } else {
            await driver.close();
        }

    } catch (err) {
        console.error('\n❌ [Automation Error]:', err.message);
        try { await driver.close(); } catch (_) {}
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}
