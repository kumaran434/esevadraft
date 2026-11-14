/**
 * TNPDS Session Conflict & Alert Modal Auto-Dismissal Handler
 * Handles: "நீங்கள் வெளியேற விரும்புகிறீர்களா?" (Do you want to log out / terminate previous session?)
 */
async function dismissSessionConflictOrAlertModals(activePage, onProgress = () => {}) {
    if (!activePage || activePage.isClosed()) return false;
    try {
        const handledInDom = await activePage.evaluate(() => {
            const modalContainers = Array.from(document.querySelectorAll('.modal.show, .modal.in, .modal[style*="block"], .swal2-container, div[role="dialog"], [role="alertdialog"], .ui-dialog, .ui-confirm-dialog, .cdk-overlay-pane'));
            const activeModal = modalContainers.find(m => {
                const style = window.getComputedStyle(m);
                return style.display !== 'none' && style.visibility !== 'hidden' && (m.offsetWidth > 0 || m.offsetHeight > 0);
            });
            if (!activeModal) return false;

            const modalText = (activeModal.innerText || activeModal.textContent || '').trim();
            const isConflict = modalText.includes('நீங்கள் வெளியேற விரும்புகிறீர்களா') ||
                               modalText.includes('வெளியேற விரும்புகிறீர்களா') ||
                               modalText.includes('ஏற்கனவே உள்நுழைந்து') ||
                               modalText.includes('Do you want to logout') ||
                               modalText.includes('terminate existing session');

            const isCaptchaError = modalText.includes('தவறான கேப்ட்சா') ||
                                   modalText.includes('கேப்ட்சா தவறானது') ||
                                   modalText.includes('Invalid Captcha') ||
                                   modalText.includes('Captcha does not match') ||
                                   modalText.includes('தவறான குறியீடு') ||
                                   (modalText.includes('கேப்ட்சா') && (modalText.includes('பிழை') || modalText.includes('தவறு')));

            if (!isConflict && !isCaptchaError) return false;

            const candidateButtons = Array.from(activeModal.querySelectorAll('button, a.btn, a, input[type="button"], input[type="submit"], [role="button"]'));
            const isNewCardForm = window.location.href.toLowerCase().includes('newsmartcard');
            if (isNewCardForm && (modalText.includes('வெளியேற விரும்புகிறீர்களா') || modalText.includes('நீங்கள் வெளியேற'))) {
                const noBtn = candidateButtons.find(b => {
                    const bt = (b.innerText || b.textContent || b.value || '').trim();
                    return bt === 'இல்லை' || bt === 'No' || bt.includes('இல்லை');
                });
                if (noBtn) {
                    noBtn.removeAttribute('disabled');
                    noBtn.disabled = false;
                    noBtn.click();
                    return true;
                }
            }

            const yesBtn = candidateButtons.find(b => {
                const bt = (b.innerText || b.textContent || b.value || b.getAttribute('aria-label') || '').trim();
                const id = (b.id || '').toLowerCase();
                const cls = (b.className || '').toString();
                if (id === 'btnsendotp' || id === 'btnlogin' || bt.includes('OTP') || bt.includes('பதிவு செய்ய')) return false;

                const isExplicitYes = bt === 'ஆம்' || bt === 'சரி' || bt === 'Yes' || bt === 'OK' || bt === 'உறுதி' || bt === 'Close' ||
                                     (bt.includes('ஆம்') && !bt.includes('இல்லை')) || (bt.includes('சரி') && !bt.includes('சரிபார்'));
                if (isExplicitYes) return true;
                if (cls.includes('swal2-confirm') || cls.includes('ui-confirmdialog-yes') || id.includes('confirmyes')) {
                    if (!bt.includes('இல்லை') && !bt.includes('ரத்து') && !bt.includes('No') && !bt.includes('Cancel')) return true;
                }
                return false;
            });

            if (yesBtn) {
                yesBtn.removeAttribute('disabled');
                yesBtn.disabled = false;
                yesBtn.click();
                if (isCaptchaError) {
                    window._tnpdsLastDismissedCaptchaError = Date.now();
                }
                setTimeout(() => {
                    document.querySelectorAll('.modal-backdrop, .swal2-backdrop, .cdk-overlay-backdrop, .ui-widget-overlay').forEach(bd => bd.remove());
                    document.body.classList.remove('modal-open');
                    document.body.style.overflow = '';
                    document.body.style.pointerEvents = '';
                }, 400);
                return isCaptchaError ? 'CAPTCHA_ERROR_DISMISSED' : true;
            }
            return false;
        }).catch(() => false);

        if (handledInDom) {
            if (typeof onProgress === 'function') {
                if (handledInDom === 'CAPTCHA_ERROR_DISMISSED') {
                    onProgress('⚠️ [Captcha பிழை நீக்கம்] "தவறான கேப்ட்சா" அறிவிப்பு தானாக ஏற்கப்பட்டது ("சரி" கிளிக் செய்யப்பட்டது). புதிய கேப்ட்சா தானாகப் பெறப்படுகிறது...');
                } else {
                    onProgress('⚡ [முந்தைய அமர்வு நீக்கம்] "நீங்கள் வெளியேற விரும்புகிறீர்களா?" அறிவிப்பு தானாக ஏற்கப்பட்டது ("ஆம்" கிளிக் செய்யப்பட்டது). போர்ட்டல் திறக்கப்படுகிறது...');
                }
            }
            return true;
        }

        const pLocators = [
            '.modal.show button:has-text("ஆம்")',
            '.modal[style*="block"] button:has-text("ஆம்")',
            'div[role="dialog"] button:has-text("ஆம்")',
            '.swal2-container button:has-text("ஆம்")',
            '.swal2-container button:has-text("சரி")',
            '.swal2-container button:has-text("OK")',
            '.modal.show button:has-text("சரி")',
            'button.swal2-confirm'
        ];
        for (const sel of pLocators) {
            try {
                const btn = activePage.locator(sel).first();
                if (await btn.count() > 0 && await btn.isVisible().catch(() => false)) {
                    await btn.click({ force: true, delay: 80 }).catch(() => {});
                    return true;
                }
            } catch (_) {}
        }
        return false;
    } catch (_) {
        return false;
    }
}

module.exports = {
    dismissSessionConflictOrAlertModals
};
