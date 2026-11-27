/**
 * eSevaDraft TNPDS Material Datepicker Selector
 */
async function selectDateInMatCalendar(targetPage, dobStr, isAdditional = false) {
    if (!dobStr) return;
    let day = 1, month = 1, year = 1990;
    const cleanDob = String(dobStr).trim();
    if (cleanDob.includes('/')) {
        const parts = cleanDob.split('/');
        if (parts[0].length === 4) {
            year = parseInt(parts[0], 10); month = parseInt(parts[1], 10); day = parseInt(parts[2], 10);
        } else {
            day = parseInt(parts[0], 10); month = parseInt(parts[1], 10); year = parseInt(parts[2], 10);
        }
    } else if (cleanDob.includes('-')) {
        const parts = cleanDob.split('-');
        if (parts[0].length === 4) {
            year = parseInt(parts[0], 10); month = parseInt(parts[1], 10); day = parseInt(parts[2], 10);
        } else {
            day = parseInt(parts[0], 10); month = parseInt(parts[1], 10); year = parseInt(parts[2], 10);
        }
    }

    try {
        // Self-Heal: If the member form was accidentally toggled closed, re-open it once so dateOfBirth is visible
        await targetPage.evaluate(() => {
            const dobEl = document.querySelector('input[formcontrolname="dateOfBirth"], input[formcontrolname="date"]');
            if (dobEl && (dobEl.offsetWidth > 0 || dobEl.offsetHeight > 0)) return;
            const addBtn = Array.from(document.querySelectorAll('button')).find(b => {
                const t = (b.innerText || '').trim().toLowerCase();
                return t.includes('உறுப்பினரை சேர்க்க') || t.includes('add member');
            });
            if (addBtn) {
                addBtn.disabled = false;
                addBtn.removeAttribute('disabled');
                addBtn.click();
            }
        }).catch(() => {});

        const toggleBtn = isAdditional 
            ? targetPage.locator('mat-form-field:has(input[formcontrolname="dateOfBirth"], input[formcontrolname="date"], input#mat-input-0) mat-datepicker-toggle button, mat-datepicker-toggle button, button[aria-label="Open calendar"], .mat-datepicker-toggle-default-icon, button:has(.fa-calendar), span.input-group-addon').last()
            : targetPage.locator('mat-form-field:has(input[formcontrolname="dateOfBirth"], input[formcontrolname="date"], input#mat-input-0) mat-datepicker-toggle button, mat-datepicker-toggle button, button[aria-label="Open calendar"], .mat-datepicker-toggle-default-icon, button:has(.fa-calendar), span.input-group-addon').first();
        await toggleBtn.scrollIntoViewIfNeeded({ timeout: 2500 }).catch(() => {});
        await toggleBtn.click({ force: true, timeout: 3000 });
        await targetPage.waitForSelector('mat-calendar, .mat-calendar', { timeout: 5000 });

        const periodBtn = targetPage.locator('.mat-calendar-period-button').last();
        if (await periodBtn.count() > 0) {
            await periodBtn.click();
            await targetPage.waitForTimeout(400);
            const periodText = await periodBtn.innerText().catch(() => '');
            if (!/\d{4}\s*[–\-]\s*\d{4}/.test(periodText) && !periodText.includes('–') && !periodText.includes('-')) {
                await periodBtn.click().catch(() => {});
                await targetPage.waitForTimeout(400);
            }
        }

        const targetYearStr = String(year);
        const targetYearInt = parseInt(year, 10);
        for (let i = 0; i < 16; i++) {
            const yearCell = targetPage.locator('.mat-calendar-body-cell').filter({ hasText: new RegExp(`^\\s*${targetYearStr}\\s*$`) }).last();
            if (await yearCell.count() > 0 && await yearCell.isVisible()) {
                await yearCell.click();
                break;
            }
            const periodText = await periodBtn.innerText().catch(() => '');
            const matchYears = periodText.match(/\d{4}/g);
            if (matchYears && matchYears.length >= 2) {
                const startY = parseInt(matchYears[0], 10);
                const endY = parseInt(matchYears[1], 10);
                if (targetYearInt < startY) {
                    const prevBtn = targetPage.locator('.mat-calendar-previous-button').last();
                    if (await prevBtn.count() > 0) await prevBtn.click();
                } else if (targetYearInt > endY) {
                    const nextBtn = targetPage.locator('.mat-calendar-next-button').last();
                    if (await nextBtn.count() > 0) await nextBtn.click();
                } else {
                    const prevBtn = targetPage.locator('.mat-calendar-previous-button').last();
                    if (await prevBtn.count() > 0) await prevBtn.click();
                }
            } else {
                const prevBtn = targetPage.locator('.mat-calendar-previous-button').last();
                if (await prevBtn.count() > 0) await prevBtn.click();
            }
            await targetPage.waitForTimeout(350);
        }
        await targetPage.waitForTimeout(500);

        const monthIndex = month - 1;
        const monthCell = targetPage.locator('.mat-calendar-body-cell').nth(monthIndex);
        if (await monthCell.count() > 0 && await monthCell.isVisible()) {
            await monthCell.click();
        } else {
            const monthNamesShort = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
            const targetMonthShort = monthNamesShort[month - 1];
            await targetPage.locator(`.mat-calendar-body-cell:has-text("${targetMonthShort}")`).last().click().catch(() => {});
        }
        await targetPage.waitForTimeout(500);

        const targetDayStr = String(parseInt(day, 10));
        let dayClicked = false;
        dayClicked = await targetPage.evaluate((dStr) => {
            const cells = Array.from(document.querySelectorAll('.mat-calendar-body-cell:not(.mat-calendar-body-disabled)'));
            const cell = cells.find(el => {
                const content = (el.querySelector('.mat-calendar-body-cell-content')?.innerText || el.innerText || '').trim();
                return content === dStr;
            });
            if (cell) {
                cell.scrollIntoView({ block: 'nearest' });
                cell.click();
                return true;
            }
            return false;
        }, targetDayStr).catch(() => false);

        if (!dayClicked) {
            const dayCell = targetPage.locator('.mat-calendar-body-cell:not(.mat-calendar-body-disabled)').filter({
                hasText: new RegExp(`^\\s*${targetDayStr}(\\s|$)`, 'm')
            }).first();
            if (await dayCell.count() > 0) {
                await dayCell.click();
            }
        }
        await targetPage.waitForTimeout(800);

        // Verify the selected DOB actually contains the target 4-digit year (prevents < 5 years age bug!)
        const verifyDobInp = isAdditional
            ? targetPage.locator('input[formcontrolname="dateOfBirth"], input[formcontrolname="date"], input#mat-input-0').last()
            : targetPage.locator('input[formcontrolname="dateOfBirth"], input[formcontrolname="date"], input#mat-input-0').first();
        const actualAfterCal = (await verifyDobInp.inputValue().catch(() => '')).trim();
        if (!actualAfterCal || !actualAfterCal.includes(targetYearStr)) {
            await targetPage.evaluate(({ y, m, d, formatted }) => {
                const nativeDate = new Date(y, m - 1, d, 12, 0, 0);
                try {
                    if (window.ng && window.ng.getComponent) {
                        for (const el of document.querySelectorAll('*')) {
                            const c = window.ng.getComponent(el);
                            if (c && c.addmemberForm && c.addmemberForm.get && c.addmemberForm.get('dateOfBirth')) {
                                c.addmemberForm.get('dateOfBirth').setValue(nativeDate);
                                c.addmemberForm.get('dateOfBirth').setErrors(null);
                                c.addmemberForm.updateValueAndValidity();
                                break;
                            }
                        }
                    }
                } catch (_) {}
                const allDob = Array.from(document.querySelectorAll('input[formcontrolname="dateOfBirth"], input[formcontrolname="date"]'));
                const el = allDob[allDob.length - 1];
                if (el && (!el.value || !el.value.includes(String(y)))) {
                    el.value = formatted;
                }
            }, { y: year, m: month, d: day, formatted: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}` }).catch(() => {});
        }
    } catch (calErr) {
        console.warn('Calendar picker fallback to direct input fill:', calErr.message);
        const targetDobInput = isAdditional 
            ? targetPage.locator('input[formcontrolname="dateOfBirth"], input[formcontrolname="date"], input#mat-input-0, input[placeholder*="DD/MM"]').last() 
            : targetPage.locator('input[formcontrolname="dateOfBirth"], input[formcontrolname="date"], input#mat-input-0, input[placeholder*="DD/MM"]').first();
        if (await targetDobInput.count() > 0) {
            const jsDate = new Date(year, month - 1, day);
            await targetDobInput.evaluate(el => {
                el.disabled = false;
                el.removeAttribute('disabled');
                el.removeAttribute('readonly');
            }).catch(() => {});
            await targetDobInput.click({ force: true, timeout: 2500 }).catch(() => {});
            await targetDobInput.fill('', { timeout: 2500 }).catch(() => {});
            await targetDobInput.pressSequentially(cleanDob, { delay: 40, timeout: 3000 }).catch(() => {});
            await targetDobInput.evaluate((el, { cleanDob, jsDateIso }) => {
                el.value = cleanDob;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                const dObj = new Date(jsDateIso);
                el.dispatchEvent(new CustomEvent('dateInput', { bubbles: true, detail: { value: dObj } }));
                el.dispatchEvent(new CustomEvent('dateChange', { bubbles: true, detail: { value: dObj } }));
                el.dispatchEvent(new Event('blur', { bubbles: true }));
            }, { cleanDob, jsDateIso: jsDate.toISOString() }).catch(() => {});
            await targetPage.keyboard.press('Tab').catch(() => {});
        }
    }
}

module.exports = { selectDateInMatCalendar };
