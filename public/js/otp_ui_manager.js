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
        const dotPlaceholder = Array(numDigits).fill('•').join(' ');

        card.innerHTML = `
            <div class="compact-otp-header">
                <div class="compact-otp-title-wrap">
                    <span class="compact-otp-icon-badge" aria-hidden="true">
                        <i class="fa-solid fa-shield-halved"></i>
                    </span>
                    <div class="compact-otp-title-meta">
                        <span class="compact-otp-title">${cardTitle}</span>
                        <span class="compact-otp-digit-pill">${numDigits} இலக்க குறியீடு</span>
                    </div>
                </div>
                <div class="compact-otp-timer-group">
                    <span id="compactOtpTimer" class="compact-otp-timer">01:00</span>
                </div>
            </div>
            <div class="compact-otp-progress" aria-hidden="true">
                <div class="compact-otp-progress-fill" style="width: 100%;"></div>
            </div>
            <div class="compact-otp-body">
                <div class="compact-otp-input-wrap">
                    <i class="fa-solid fa-key compact-otp-input-icon" aria-hidden="true"></i>
                    <input type="text" id="compactOtpInput" class="compact-otp-input" inputmode="numeric" pattern="[0-9]*" maxlength="${numDigits}" placeholder="${dotPlaceholder}" autocomplete="one-time-code" />
                </div>
                <button type="button" id="btnSubmitOtpPin" class="compact-otp-verify-btn">
                    <i class="fa-solid fa-circle-check"></i> <span>சரிபார்</span>
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
                input.closest('.compact-otp-input-wrap')?.classList.add('is-focused');
            });

            input.addEventListener('blur', () => {
                input.closest('.compact-otp-input-wrap')?.classList.remove('is-focused');
            });

            setTimeout(() => { input.focus(); }, 150);
        }

        if (verifyBtn) {
            verifyBtn.addEventListener('click', triggerSubmit);
        }

        // 60-second countdown timer
        const timerSpan = card.querySelector('#compactOtpTimer');
        const progressFill = card.querySelector('.compact-otp-progress-fill');
        function startOtpCountdown() {
            if (!card || !timerSpan) return;
            let timeLeft = 60;
            const interval = setInterval(() => {
                if (!document.body.contains(card) || !timerSpan || !card.parentNode) {
                    clearInterval(interval);
                    return;
                }
                if (timeLeft > 0) {
                    timeLeft--;
                    const m = String(Math.floor(timeLeft / 60)).padStart(2, '0');
                    const s = String(timeLeft % 60).padStart(2, '0');
                    timerSpan.innerText = `${m}:${s}`;
                    if (progressFill) {
                        progressFill.style.width = `${Math.max(0, Math.round((timeLeft / 60) * 100))}%`;
                    }
                } else {
                    clearInterval(interval);
                    timerSpan.innerText = 'காலாவதியானது';
                    timerSpan.classList.add('is-expired');
                    if (progressFill) {
                        progressFill.style.width = '0%';
                    }
                    if (!card.querySelector('#btnResendOtpInline')) {
                        const resendBtn = document.createElement('button');
                        resendBtn.id = 'btnResendOtpInline';
                        resendBtn.type = 'button';
                        resendBtn.className = 'btn-resend-otp-inline';
                        resendBtn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> மீண்டும் அனுப்பு';
                        resendBtn.onclick = () => {
                            if (typeof onResendCallback === 'function') onResendCallback();
                            else if (typeof window.requestResendOtp === 'function') window.requestResendOtp();
                            resendBtn.remove();
                            timerSpan.innerText = '01:00';
                            timerSpan.classList.remove('is-expired');
                            if (progressFill) {
                                progressFill.style.width = '100%';
                            }
                            startOtpCountdown();
                        };
                        timerSpan.parentNode.appendChild(resendBtn);
                    }
                }
            }, 1000);
        }
        startOtpCountdown();
    }

    function updateOtpTimerElements() {}

    window.renderGlobalOtpCard = renderGlobalOtpCard;
    window.updateOtpTimerElements = updateOtpTimerElements;
})(window);
