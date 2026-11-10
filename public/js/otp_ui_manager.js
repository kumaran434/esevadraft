/**
 * otp_ui_manager.js
 * Ultra-Compact, Single-Row 6-Digit OTP Input Component.
 * Strictly compliant with: < 300 lines modular architecture.
 */

(function (window) {
    'use strict';

    /**
     * Renders a compact, sleek inline OTP verification box.
     * @param {HTMLElement} targetContainer - The container element to append into
     * @param {Function} onVerifyCallback - Callback with 6-digit OTP string
     * @param {Function} onResendCallback - Callback when resend button is clicked
     * @param {Object} options - Configuration options (digits, type, etc.)
     */
    function renderGlobalOtpCard(targetContainer, onVerifyCallback, onResendCallback, options = {}) {
        if (!targetContainer) return;

        // Prevent duplicate OTP cards
        const existingCard = targetContainer.querySelector('.compact-otp-card, .global-otp-card');
        if (existingCard) return;

        const isAadhaar = Boolean(options && options.type === 'aadhaar_otp');
        const numDigits = (options && options.digits) ? options.digits : 6;
        const cardTitle = (options && options.title) ? options.title : (isAadhaar ? 'ஆதார் SMS OTP' : 'TNPDS கைபேசி SMS OTP');

        const card = document.createElement('div');
        card.className = 'compact-otp-card';
        card.id = 'globalOtpCardContainer';
        card.style.cssText = 'background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 8px 12px; margin-top: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);';

        card.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                <span style="font-size: 12px; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 6px;">
                    <i class="fa-solid fa-key" style="color: #d97706;"></i> ${cardTitle} (${numDigits} இலக்கங்கள்)
                </span>
                <span id="compactOtpTimer" style="font-size: 11px; font-weight: 700; color: #dc2626; font-family: monospace; background: #ffffff; padding: 2px 6px; border-radius: 4px; border: 1px solid #fecaca;">01:00</span>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
                <input type="text" id="compactOtpInput" inputmode="numeric" pattern="[0-9]*" maxlength="${numDigits}" placeholder="• • • • • •" autocomplete="one-time-code" style="height: 32px; width: 130px; text-align: center; font-size: 16px; font-weight: 800; letter-spacing: 4px; border: 1.5px solid #94a3b8; border-radius: 6px; outline: none; background: #ffffff; color: #0f172a; transition: border-color 0.2s;" />
                <button type="button" id="btnSubmitOtpPin" style="height: 32px; padding: 0 16px; background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); color: #ffffff; border: none; border-radius: 6px; font-weight: 700; font-size: 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; box-shadow: 0 2px 6px rgba(22,163,74,0.25);">
                    <i class="fa-solid fa-circle-check"></i> சரிபார்
                </button>
            </div>
        `;

        targetContainer.appendChild(card);

        const input = card.querySelector('#compactOtpInput');
        const verifyBtn = card.querySelector('#btnSubmitOtpPin');

        function triggerSubmit() {
            const code = (input.value || '').trim().replace(/\D/g, '');
            if (code.length >= (numDigits === 7 ? 6 : numDigits)) {
                verifyBtn.disabled = true;
                verifyBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> சரிபார்க்கப்படுகிறது...`;
                if (typeof onVerifyCallback === 'function') {
                    onVerifyCallback(code);
                }
            } else {
                input.focus();
            }
        }

        if (input) {
            input.addEventListener('input', (e) => {
                const val = e.target.value.replace(/[^0-9]/g, '');
                e.target.value = val;
                if (val.length === numDigits) {
                    setTimeout(triggerSubmit, 100);
                }
            });

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    triggerSubmit();
                }
            });

            input.addEventListener('focus', () => {
                input.style.borderColor = '#2563eb';
                input.style.background = '#ffffff';
            });

            input.addEventListener('blur', () => {
                input.style.borderColor = '#94a3b8';
            });

            setTimeout(() => { input.focus(); }, 150);
        }

        if (verifyBtn) {
            verifyBtn.addEventListener('click', triggerSubmit);
        }

        // 60-second countdown timer
        let timeLeft = 60;
        const timerSpan = card.querySelector('#compactOtpTimer');
        const interval = setInterval(() => {
            timeLeft--;
            if (!timerSpan || !card.parentNode) {
                clearInterval(interval);
                return;
            }
            if (timeLeft > 0) {
                const m = Math.floor(timeLeft / 60);
                const s = timeLeft % 60;
                timerSpan.innerText = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
            } else {
                clearInterval(interval);
                timerSpan.innerText = 'காலாவதியானது';
                timerSpan.style.color = '#dc2626';
                timerSpan.style.background = '#fef2f2';
                timerSpan.style.borderColor = '#fca5a5';
                if (!card.querySelector('#btnResendOtpInline')) {
                    const resendBtn = document.createElement('button');
                    resendBtn.id = 'btnResendOtpInline';
                    resendBtn.type = 'button';
                    resendBtn.style.cssText = 'background: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; font-size: 11px; font-weight: 700; border-radius: 4px; padding: 2px 8px; cursor: pointer; margin-left: 6px;';
                    resendBtn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> மீண்டும் அனுப்பு';
                    resendBtn.onclick = () => {
                        if (typeof onResendCallback === 'function') onResendCallback();
                        else if (typeof window.requestResendOtp === 'function') window.requestResendOtp();
                        resendBtn.remove();
                        timeLeft = 60;
                        timerSpan.innerText = '01:00';
                        timerSpan.style.color = '#dc2626';
                        timerSpan.style.background = '#ffffff';
                        timerSpan.style.borderColor = '#fecaca';
                    };
                    timerSpan.parentNode.appendChild(resendBtn);
                }
            }
        }, 1000);
    }

    function updateOtpTimerElements() {}

    window.renderGlobalOtpCard = renderGlobalOtpCard;
    window.updateOtpTimerElements = updateOtpTimerElements;
})(window);
