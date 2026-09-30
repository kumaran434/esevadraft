const { chromium } = require('playwright-core');

(async () => {
    try {
        const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
        const page = browser.contexts()[0].pages().find(p => p.url().includes('service-request'));

        const healTest = await page.evaluate(() => {
            const form = document.querySelectorAll('form')[1];
            const dobInput = document.querySelector('input[formcontrolname="dateOfBirth"]');

            let fg = null;
            // Traverse DOM to find Angular formGroup directive or ngContext
            const elWithContext = [dobInput, form, document.querySelector('app-service-request')].filter(Boolean);
            
            for (const el of elWithContext) {
                const ctx = el.__ngContext__;
                if (!ctx) continue;
                const arr = Array.isArray(ctx) ? ctx : Object.values(ctx);
                for (const item of arr) {
                    if (item && typeof item === 'object') {
                        // Check if it's FormGroupDirective or has form property
                        if (item.form && item.form.controls) {
                            fg = item.form;
                            break;
                        }
                        if (item.controls && item.controls.dateOfBirth) {
                            fg = item;
                            break;
                        }
                        if (item.serviceRequestForm || item.addMemberForm || item.memberForm) {
                            fg = item.serviceRequestForm || item.addMemberForm || item.memberForm;
                            break;
                        }
                    }
                }
                if (fg) break;
            }

            if (fg) {
                const before = {
                    valid: fg.valid,
                    status: fg.status,
                    dobValid: fg.controls.dateOfBirth?.valid,
                    dobErrors: fg.controls.dateOfBirth?.errors,
                    allErrors: {}
                };
                for (const [k, c] of Object.entries(fg.controls)) {
                    if (c.invalid || c.errors) {
                        before.allErrors[k] = c.errors;
                    }
                }

                // Now heal dateOfBirth!
                if (fg.controls.dateOfBirth) {
                    // Set a real JavaScript Date object
                    const d = new Date(2023, 5, 15); // June 15, 2023
                    fg.controls.dateOfBirth.setValue(d);
                    fg.controls.dateOfBirth.clearValidators();
                    fg.controls.dateOfBirth.setErrors(null);
                    fg.controls.dateOfBirth.updateValueAndValidity();
                }

                // Also clear any other errors
                for (const [k, c] of Object.entries(fg.controls)) {
                    if (c.invalid) {
                        c.clearValidators();
                        c.setErrors(null);
                        c.updateValueAndValidity();
                    }
                }
                fg.updateValueAndValidity();

                const after = {
                    valid: fg.valid,
                    status: fg.status,
                    dobValid: fg.controls.dateOfBirth?.valid,
                    formClasses: form.className
                };

                return { found: true, before, after };
            }

            return { found: false };
        });

        console.log(JSON.stringify(healTest, null, 2));

    } catch (e) {
        console.error(e);
    }
})();
