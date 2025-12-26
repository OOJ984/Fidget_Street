/**
 * Gift Cards Purchase Page Script
 * Handles gift card amount selection and checkout
 */

(function() {
    'use strict';

    let selectedAmount = 25;

    function init() {
        setupAmountButtons();
        setupCustomAmount();
        setupCharacterCount();
        setupForm();
    }

    function setupAmountButtons() {
        const buttons = document.querySelectorAll('.amount-btn');
        const customInput = document.getElementById('custom-amount');

        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                // Clear custom input
                if (customInput) customInput.value = '';

                // Update button states
                buttons.forEach(b => {
                    b.classList.remove('border-soft-blue', 'bg-soft-blue-50', 'text-soft-blue');
                    b.classList.add('border-gray-200', 'text-gray-700');
                });
                btn.classList.remove('border-gray-200', 'text-gray-700');
                btn.classList.add('border-soft-blue', 'bg-soft-blue-50', 'text-soft-blue');

                // Update selected amount
                selectedAmount = parseInt(btn.dataset.amount);
                updateDisplay();
            });
        });
    }

    function setupCustomAmount() {
        const customInput = document.getElementById('custom-amount');
        const buttons = document.querySelectorAll('.amount-btn');

        if (!customInput) return;

        customInput.addEventListener('input', () => {
            const value = parseInt(customInput.value);

            if (value && value >= 5 && value <= 500) {
                // Clear button selections
                buttons.forEach(b => {
                    b.classList.remove('border-soft-blue', 'bg-soft-blue-50', 'text-soft-blue');
                    b.classList.add('border-gray-200', 'text-gray-700');
                });

                selectedAmount = value;
                updateDisplay();
            }
        });

        customInput.addEventListener('blur', () => {
            const value = parseInt(customInput.value);

            if (customInput.value && (value < 5 || value > 500)) {
                showError('Custom amount must be between £5 and £500');
                customInput.value = '';
            }
        });
    }

    function setupCharacterCount() {
        const textarea = document.getElementById('personal-message');
        const counter = document.getElementById('message-char-count');

        if (!textarea || !counter) return;

        textarea.addEventListener('input', () => {
            counter.textContent = textarea.value.length;
        });
    }

    function updateDisplay() {
        // Update preview
        const previewAmount = document.getElementById('gift-card-preview-amount');
        if (previewAmount) {
            previewAmount.textContent = `£${selectedAmount}`;
        }

        // Update hidden input
        const hiddenInput = document.getElementById('selected-amount');
        if (hiddenInput) {
            hiddenInput.value = selectedAmount;
        }

        // Update button text
        const btnText = document.getElementById('btn-text');
        if (btnText) {
            btnText.textContent = `Buy Gift Card - £${selectedAmount}`;
        }

        // Clear any errors
        hideError();
    }

    function setupForm() {
        const form = document.getElementById('gift-card-form');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const btn = document.getElementById('buy-gift-card-btn');
            const btnText = document.getElementById('btn-text');
            const btnLoading = document.getElementById('btn-loading');

            // Validate
            const purchaserName = document.getElementById('purchaser-name').value.trim();
            const purchaserEmail = document.getElementById('purchaser-email').value.trim();

            if (!purchaserName) {
                showError('Please enter your name');
                return;
            }

            if (!purchaserEmail || !isValidEmail(purchaserEmail)) {
                showError('Please enter a valid email address');
                return;
            }

            // Check recipient email if provided
            const recipientEmail = document.getElementById('recipient-email').value.trim();
            if (recipientEmail && !isValidEmail(recipientEmail)) {
                showError('Please enter a valid recipient email address');
                return;
            }

            // Validate amount
            if (selectedAmount < 5 || selectedAmount > 500) {
                showError('Amount must be between £5 and £500');
                return;
            }

            // Show loading state
            btn.disabled = true;
            btnText.classList.add('hidden');
            btnLoading.classList.remove('hidden');
            hideError();

            try {
                // Prepare data
                const formData = {
                    amount: selectedAmount,
                    purchaser_name: purchaserName,
                    purchaser_email: purchaserEmail,
                    recipient_name: document.getElementById('recipient-name').value.trim() || null,
                    recipient_email: recipientEmail || null,
                    personal_message: document.getElementById('personal-message').value.trim() || null
                };

                // Call checkout API
                const response = await fetch('/api/gift-card-checkout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Failed to create checkout session');
                }

                // Redirect to Stripe checkout
                if (data.url) {
                    window.location.href = data.url;
                } else {
                    throw new Error('No checkout URL returned');
                }

            } catch (error) {
                console.error('Gift card checkout error:', error);
                showError(error.message || 'Something went wrong. Please try again.');

                // Reset button
                btn.disabled = false;
                btnText.classList.remove('hidden');
                btnLoading.classList.add('hidden');
            }
        });
    }

    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function showError(message) {
        const errorEl = document.getElementById('gift-card-error');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.classList.remove('hidden');
        }
    }

    function hideError() {
        const errorEl = document.getElementById('gift-card-error');
        if (errorEl) {
            errorEl.classList.add('hidden');
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
