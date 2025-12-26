/**
 * Gift Card Balance Check Page
 * Allows customers to check their gift card balance and transaction history
 */

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('balance-form');
    const codeInput = document.getElementById('gift-card-code');
    const checkBtn = document.getElementById('check-btn');
    const errorMsg = document.getElementById('error-message');
    const lookupForm = document.getElementById('lookup-form');
    const resultsSection = document.getElementById('results-section');
    const checkAnotherBtn = document.getElementById('check-another-btn');

    // Auto-format input as user types
    codeInput.addEventListener('input', function(e) {
        let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');

        // Add GC- prefix if not present
        if (!value.startsWith('GC')) {
            if (value.length > 0) {
                value = 'GC' + value;
            }
        }

        // Remove the GC prefix for formatting
        let code = value.replace(/^GC/, '');

        // Format as XXXX-XXXX-XXXX
        let formatted = 'GC-';
        for (let i = 0; i < code.length && i < 12; i++) {
            if (i > 0 && i % 4 === 0) {
                formatted += '-';
            }
            formatted += code[i];
        }

        e.target.value = formatted;
    });

    // Form submission
    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        const code = codeInput.value.trim();

        // Validate format
        if (!/^GC-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) {
            showError('Please enter a valid gift card code (GC-XXXX-XXXX-XXXX)');
            return;
        }

        // Show loading state
        checkBtn.disabled = true;
        checkBtn.innerHTML = '<svg class="w-5 h-5 animate-spin mx-auto" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';
        errorMsg.classList.add('hidden');

        try {
            const response = await fetch('/api/check-gift-card', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ code })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to check gift card');
            }

            // Show results
            displayResults(data);

        } catch (error) {
            showError(error.message);
        } finally {
            checkBtn.disabled = false;
            checkBtn.textContent = 'Check Balance';
        }
    });

    // Check another button
    checkAnotherBtn.addEventListener('click', function() {
        resultsSection.classList.add('hidden');
        lookupForm.classList.remove('hidden');
        codeInput.value = '';
        codeInput.focus();
    });

    function showError(message) {
        errorMsg.textContent = message;
        errorMsg.classList.remove('hidden');
    }

    function displayResults(data) {
        const { giftCard, transactions } = data;

        // Hide form, show results
        lookupForm.classList.add('hidden');
        resultsSection.classList.remove('hidden');

        // Update balance
        document.getElementById('current-balance').textContent = '£' + parseFloat(giftCard.current_balance).toFixed(2);
        document.getElementById('original-amount').textContent = '£' + parseFloat(giftCard.initial_balance).toFixed(2);
        document.getElementById('display-code').textContent = giftCard.code;

        // Expiry date - show countdown
        if (giftCard.expires_at) {
            const expiry = new Date(giftCard.expires_at);
            const now = new Date();
            const expiryEl = document.getElementById('expiry-date');

            if (expiry <= now) {
                // Already expired
                expiryEl.textContent = 'Expired';
                expiryEl.classList.add('text-red-600');
            } else {
                // Calculate time remaining
                const diffMs = expiry - now;
                const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                const diffMonths = Math.floor(diffDays / 30);
                const remainingDays = diffDays % 30;

                let timeText = '';
                if (diffMonths >= 12) {
                    timeText = '12 months';
                } else if (diffMonths > 0) {
                    timeText = diffMonths + ' month' + (diffMonths !== 1 ? 's' : '');
                    if (remainingDays > 0) {
                        timeText += ', ' + remainingDays + ' day' + (remainingDays !== 1 ? 's' : '');
                    }
                } else if (diffDays > 0) {
                    timeText = diffDays + ' day' + (diffDays !== 1 ? 's' : '');
                } else {
                    timeText = 'Less than 1 day';
                }

                expiryEl.textContent = timeText;

                // Add warning color if expiring soon (less than 30 days)
                if (diffDays < 30) {
                    expiryEl.classList.add('text-orange-600');
                }
            }
        } else {
            // No expiry set - show 12 months as default
            document.getElementById('expiry-date').textContent = '12 months';
        }

        // Status badge
        const statusEl = document.getElementById('balance-status');
        const status = giftCard.status;
        let statusClass = '';
        let statusText = '';

        switch (status) {
            case 'active':
                statusClass = 'bg-green-100 text-green-700';
                statusText = 'Active';
                break;
            case 'depleted':
                statusClass = 'bg-gray-100 text-gray-600';
                statusText = 'Fully Used';
                break;
            case 'expired':
                statusClass = 'bg-red-100 text-red-700';
                statusText = 'Expired';
                break;
            case 'cancelled':
                statusClass = 'bg-red-100 text-red-700';
                statusText = 'Cancelled';
                break;
            default:
                statusClass = 'bg-yellow-100 text-yellow-700';
                statusText = 'Pending';
        }

        statusEl.className = 'inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ' + statusClass;
        statusEl.textContent = statusText;

        // Transactions
        const transactionsList = document.getElementById('transactions-list');
        const noTransactions = document.getElementById('no-transactions');

        if (transactions && transactions.length > 0) {
            noTransactions.classList.add('hidden');
            transactionsList.innerHTML = transactions.map(function(tx) {
                const date = new Date(tx.created_at);
                const dateStr = date.toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });

                let icon = '';
                let amountColor = '';
                let amountPrefix = '';
                let description = '';

                switch (tx.transaction_type) {
                    case 'activation':
                        icon = '<svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>';
                        amountColor = 'text-green-600';
                        amountPrefix = '+';
                        description = 'Gift card activated';
                        break;
                    case 'redemption':
                        icon = '<svg class="w-5 h-5 text-soft-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>';
                        amountColor = 'text-red-600';
                        amountPrefix = '-';
                        description = tx.order_number ? 'Used on order #' + tx.order_number : 'Used on purchase';
                        break;
                    case 'refund':
                        icon = '<svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg>';
                        amountColor = 'text-green-600';
                        amountPrefix = '+';
                        description = 'Refund applied';
                        break;
                    case 'expiration':
                        icon = '<svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
                        amountColor = 'text-red-600';
                        amountPrefix = '-';
                        description = 'Gift card expired';
                        break;
                    default:
                        icon = '<svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
                        amountColor = 'text-gray-600';
                        amountPrefix = '';
                        description = tx.notes || 'Adjustment';
                }

                return '<div class="flex items-center gap-4 p-4 hover:bg-gray-50">' +
                    '<div class="flex-shrink-0">' + icon + '</div>' +
                    '<div class="flex-1 min-w-0">' +
                        '<p class="text-sm font-medium text-gray-900">' + description + '</p>' +
                        '<p class="text-xs text-gray-500">' + dateStr + '</p>' +
                    '</div>' +
                    '<div class="text-right">' +
                        '<p class="text-sm font-semibold ' + amountColor + '">' + amountPrefix + '£' + Math.abs(parseFloat(tx.amount)).toFixed(2) + '</p>' +
                        '<p class="text-xs text-gray-500">Balance: £' + parseFloat(tx.balance_after).toFixed(2) + '</p>' +
                    '</div>' +
                '</div>';
            }).join('');
        } else {
            transactionsList.innerHTML = '';
            noTransactions.classList.remove('hidden');
        }
    }

    // Check for code in URL params
    const urlParams = new URLSearchParams(window.location.search);
    const urlCode = urlParams.get('code');
    if (urlCode) {
        codeInput.value = urlCode.toUpperCase();
        form.dispatchEvent(new Event('submit'));
    }
});
