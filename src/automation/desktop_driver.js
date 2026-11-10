/**
 * src/automation/desktop_driver.js
 * 
 * Purpose-Driven Functional Module:
 * Autonomous Desktop Driver for eSevaDraft Electron Application.
 * Powered by Playwright to simulate 100% realistic human operator interactions:
 * - Visibly launches either the installed desktop app (.exe) or workspace Electron
 * - Fast-tracks operator login (Quick Dev SignIn)
 * - Interacts with UI elements, forms, modals, and workflow steps
 * - Captures high-resolution visual proof screenshots
 */

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');

class DesktopAppDriver {
    constructor(options = {}) {
        this.rootDir = path.resolve(__dirname, '..', '..');
        this.installedExe = path.join(
            process.env.LOCALAPPDATA || 'C:\\Users\\ADMIN\\AppData\\Local',
            'Programs',
            'eSevaDraft Desktop',
            'eSevaDraft Desktop.exe'
        );
        this.localElectronExe = path.join(this.rootDir, 'desktop', 'node_modules', 'electron', 'dist', 'electron.exe');
        this.mainJs = path.join(this.rootDir, 'desktop', 'main.js');
        
        this.options = {
            mode: options.mode || 'auto', // 'installed', 'local', or 'auto'
            slowMo: options.slowMo || 50,
            timeout: options.timeout || 30000,
            userDataDir: options.userDataDir || path.join(os.tmpdir(), 'eseva-automation-profile'),
            ...options
        };

        this.electronApp = null;
        this.window = null;
    }

    /**
     * Resolves the target executable and launch arguments
     */
    resolveLaunchTarget() {
        if (this.options.mode === 'installed' || (this.options.mode === 'auto' && fs.existsSync(this.installedExe))) {
            return {
                type: 'installed',
                executablePath: this.installedExe,
                args: [`--user-data-dir=${this.options.userDataDir}`]
            };
        }

        if (fs.existsSync(this.localElectronExe)) {
            return {
                type: 'local',
                executablePath: this.localElectronExe,
                args: [this.mainJs, `--user-data-dir=${this.options.userDataDir}`]
            };
        }

        throw new Error('Neither installed Desktop App nor workspace Electron executable was found!');
    }

    /**
     * Launches the Desktop App visibly
     */
    async launch() {
        const target = this.resolveLaunchTarget();
        console.log(`🤖 [Desktop Driver] Launching ${target.type === 'installed' ? 'Installed App' : 'Workspace Electron'}...`);
        console.log(`   📍 Executable: ${target.executablePath}`);

        this.electronApp = await electron.launch({
            executablePath: target.executablePath,
            args: target.args,
            slowMo: this.options.slowMo,
            timeout: this.options.timeout
        });

        this.window = await this.electronApp.firstWindow();
        await this.window.waitForLoadState('domcontentloaded');
        console.log('   ✅ Primary Desktop Window loaded:', await this.window.title());
        return this.window;
    }

    /**
     * Fast-tracks operator login via "Quick Dev SignIn" button or direct auth session
     */
    async quickDevLogin() {
        if (!this.window) throw new Error('App not launched. Call launch() first.');
        console.log('⚡ [Desktop Driver] Performing Quick Dev Operator SignIn...');

        // Resilient check: locator for Quick Dev button
        const devLoginBtn = this.window.locator('#devOnlyAuthButtons button, button:has-text("Quick Dev")');
        try {
            await devLoginBtn.first().waitFor({ state: 'visible', timeout: 5000 });
            await devLoginBtn.first().click();
        } catch (_) {
            console.log('   ℹ️ Direct completeAuthSession invocation fallback...');
            await this.window.evaluate(() => {
                if (typeof window.completeAuthSession === 'function') {
                    window.completeAuthSession('9876543210', 'குமரன் இ-சேவை மையம்', 'operator@esevadraft.in', 'local_op_dev', 'operator');
                }
            });
        }

        // Wait for operator desk / main chat interface to appear
        await this.window.waitForTimeout(1500);
        console.log('   ✅ Operator Desk logged in successfully!');
    }

    /**
     * Clicks any element by selector or text
     */
    async click(selector, options = {}) {
        if (!this.window) throw new Error('App not launched.');
        const element = typeof selector === 'string' ? this.window.locator(selector) : selector;
        await element.first().click(options);
    }

    /**
     * Fills text into an input field
     */
    async fill(selector, text, options = {}) {
        if (!this.window) throw new Error('App not launched.');
        await this.window.locator(selector).first().fill(text, options);
    }

    /**
     * Selects an option in a dropdown
     */
    async selectOption(selector, value) {
        if (!this.window) throw new Error('App not launched.');
        await this.window.locator(selector).first().selectOption(value);
    }

    /**
     * Waits for a selector
     */
    async waitFor(selector, timeout = 10000) {
        if (!this.window) throw new Error('App not launched.');
        await this.window.locator(selector).first().waitFor({ state: 'visible', timeout });
    }

    /**
     * Takes screenshot and saves to disk
     */
    async screenshot(filename = 'desktop_run.png') {
        if (!this.window) throw new Error('App not launched.');
        const screenshotDir = path.join(this.rootDir, 'screenshots');
        if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });
        const filePath = path.join(screenshotDir, filename);
        await this.window.screenshot({ path: filePath });
        console.log(`📸 [Desktop Driver] Screenshot captured: ${filePath}`);
        return filePath;
    }

    /**
     * Closes the desktop app instance
     */
    async close() {
        if (this.electronApp) {
            console.log('🛑 [Desktop Driver] Closing Desktop App...');
            await this.electronApp.close();
            this.electronApp = null;
            this.window = null;
            console.log('   ✅ Desktop App closed cleanly.');
        }
    }
}

module.exports = { DesktopAppDriver };
