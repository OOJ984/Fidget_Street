/**
 * Admin Gift Cards Page
 * Gift card management
 */

// Check auth
const token = localStorage.getItem('admin_token');
const currentUser = JSON.parse(localStorage.getItem('admin_user') || '{}');

if (!token) {
    window.location.href = '/admin/index.html';
}

// Display user info
document.getElementById('user-name').textContent = currentUser.name || currentUser.email;

// Logout
document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    window.location.href = '/admin/index.html';
});

// State
let giftCards = [];
let stats = {};

// Fetch gift cards
async function fetchGiftCards() {
    try {
        const params = new URLSearchParams();
        const statusFilter = document.getElementById('status-filter').value;
        const unsentFilter = document.getElementById('unsent-filter').checked;
        const searchQuery = document.getElementById('search-input').value.trim();

        if (statusFilter) params.set('status', statusFilter);
        if (unsentFilter) params.set('unsent', 'true');
        if (searchQuery) params.set('search', searchQuery);

        const response = await fetch(`/api/admin-gift-cards?${params}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/admin/index.html';
                return;
            }
            throw new Error('Failed to fetch gift cards');
        }

        const data = await response.json();
        giftCards = data.giftCards || [];
        stats = data.stats || {};
        updateStats();
        renderGiftCards();

    } catch (error) {
        console.error('Error:', error);
        document.getElementById('gift-cards-list').innerHTML = `
            <div class="text-center py-12 text-red-400">Failed to load gift cards. Please run the database migration first.</div>
        `;
    }
}

function updateStats() {
    document.getElementById('stat-active').textContent = stats.active || 0;
    document.getElementById('stat-unsent').textContent = stats.unsent || 0;
    document.getElementById('stat-issued').textContent = `£${(stats.total_issued || 0).toFixed(2)}`;
    document.getElementById('stat-remaining').textContent = `£${(stats.total_remaining || 0).toFixed(2)}`;
}

function renderGiftCards() {
    const container = document.getElementById('gift-cards-list');

    if (giftCards.length === 0) {
        container.innerHTML = '<p class="text-navy-600 text-center py-8">No gift cards found.</p>';
        return;
    }

    const html = `
        <table class="w-full text-sm">
            <thead>
                <tr class="border-b border-navy/20">
                    <th class="text-left py-3 px-2 font-medium text-navy-600">Code</th>
                    <th class="text-left py-3 px-2 font-medium text-navy-600">Balance</th>
                    <th class="text-left py-3 px-2 font-medium text-navy-600">Purchaser</th>
                    <th class="text-left py-3 px-2 font-medium text-navy-600">Recipient</th>
                    <th class="text-left py-3 px-2 font-medium text-navy-600">Status</th>
                    <th class="text-left py-3 px-2 font-medium text-navy-600">Sent</th>
                    <th class="text-left py-3 px-2 font-medium text-navy-600">Created</th>
                    <th class="text-right py-3 px-2 font-medium text-navy-600">Actions</th>
                </tr>
            </thead>
            <tbody>
                ${giftCards.map(gc => renderGiftCardRow(gc)).join('')}
            </tbody>
        </table>
    `;

    container.innerHTML = html;

    // Add event listeners
    container.querySelectorAll('.view-details-btn').forEach(btn => {
        btn.addEventListener('click', () => viewDetails(btn.dataset.id));
    });

    container.querySelectorAll('.mark-sent-btn').forEach(btn => {
        btn.addEventListener('click', () => markAsSent(btn.dataset.id));
    });

    container.querySelectorAll('.copy-code-btn').forEach(btn => {
        btn.addEventListener('click', () => copyCode(btn.dataset.code));
    });
}

function renderGiftCardRow(gc) {
    const statusColors = {
        'active': 'bg-green-100 text-green-700',
        'pending': 'bg-yellow-100 text-yellow-700',
        'depleted': 'bg-gray-100 text-gray-600',
        'expired': 'bg-red-100 text-red-700',
        'cancelled': 'bg-red-100 text-red-700'
    };

    const statusClass = statusColors[gc.status] || 'bg-gray-100 text-gray-600';
    const createdDate = new Date(gc.created_at).toLocaleDateString('en-GB');
    const balance = parseFloat(gc.current_balance);
    const initial = parseFloat(gc.initial_balance);

    return `
        <tr class="border-b border-navy/10 hover:bg-white/50">
            <td class="py-3 px-2">
                <div class="flex items-center gap-2">
                    <span class="font-mono font-medium">${gc.code}</span>
                    <button class="copy-code-btn text-navy-400 hover:text-soft-blue" data-code="${gc.code}" title="Copy code">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                    </button>
                </div>
                ${gc.source === 'promotional' ? '<span class="text-xs text-purple-600">Promo</span>' : ''}
            </td>
            <td class="py-3 px-2">
                <div class="font-semibold ${balance < initial ? 'text-orange-600' : 'text-navy'}">£${balance.toFixed(2)}</div>
                ${balance < initial ? `<div class="text-xs text-navy-400">of £${initial.toFixed(2)}</div>` : ''}
            </td>
            <td class="py-3 px-2">
                <div class="text-navy-600">${gc.purchaser_email || '-'}</div>
                ${gc.purchaser_name ? `<div class="text-xs text-navy-400">${gc.purchaser_name}</div>` : ''}
            </td>
            <td class="py-3 px-2">
                <div class="text-navy-600">${gc.recipient_email || '-'}</div>
                ${gc.recipient_name ? `<div class="text-xs text-navy-400">${gc.recipient_name}</div>` : ''}
            </td>
            <td class="py-3 px-2">
                <span class="px-2 py-1 rounded text-xs font-medium ${statusClass}">${gc.status}</span>
            </td>
            <td class="py-3 px-2">
                ${gc.is_sent
                    ? '<span class="text-green-600">Yes</span>'
                    : gc.status === 'active'
                        ? `<button class="mark-sent-btn text-orange-600 hover:text-orange-700 text-sm underline" data-id="${gc.id}">Mark Sent</button>`
                        : '<span class="text-navy-400">-</span>'
                }
            </td>
            <td class="py-3 px-2 text-navy-600">${createdDate}</td>
            <td class="py-3 px-2 text-right">
                <button class="view-details-btn text-soft-blue hover:text-soft-blue/80" data-id="${gc.id}">View</button>
            </td>
        </tr>
    `;
}

async function viewDetails(id) {
    try {
        const response = await fetch(`/api/admin-gift-cards?id=${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to fetch gift card');

        const gc = await response.json();
        showDetailModal(gc);

    } catch (error) {
        console.error('Error:', error);
        alert('Failed to load gift card details');
    }
}

function showDetailModal(gc) {
    const modal = document.getElementById('detail-modal');
    const content = document.getElementById('gift-card-details');

    const balance = parseFloat(gc.current_balance);
    const initial = parseFloat(gc.initial_balance);
    const createdDate = new Date(gc.created_at).toLocaleString('en-GB');
    const activatedDate = gc.activated_at ? new Date(gc.activated_at).toLocaleString('en-GB') : '-';

    let transactionsHtml = '';
    if (gc.transactions && gc.transactions.length > 0) {
        transactionsHtml = `
            <div class="mt-6">
                <h3 class="font-semibold text-navy mb-3">Transaction History</h3>
                <div class="space-y-2">
                    ${gc.transactions.map(tx => `
                        <div class="flex items-center justify-between py-2 border-b border-navy/10 text-sm">
                            <div>
                                <span class="font-medium ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}">
                                    ${tx.amount > 0 ? '+' : ''}£${Math.abs(tx.amount).toFixed(2)}
                                </span>
                                <span class="text-navy-500 ml-2">${tx.transaction_type}</span>
                                ${tx.order_number ? `<span class="text-navy-400 ml-2">Order ${tx.order_number}</span>` : ''}
                            </div>
                            <div class="text-navy-400">${new Date(tx.created_at).toLocaleString('en-GB')}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    content.innerHTML = `
        <div class="space-y-4">
            <div class="bg-white p-4 rounded-lg text-center">
                <div class="text-sm text-navy-500 mb-1">Gift Card Code</div>
                <div class="font-mono text-2xl font-bold text-soft-blue mb-2">${gc.code}</div>
                <div class="text-lg">Balance: <span class="font-semibold">£${balance.toFixed(2)}</span> / £${initial.toFixed(2)}</div>
            </div>

            <div class="grid grid-cols-2 gap-4">
                <div>
                    <div class="text-sm text-navy-500">Status</div>
                    <div class="font-medium capitalize">${gc.status}</div>
                </div>
                <div>
                    <div class="text-sm text-navy-500">Source</div>
                    <div class="font-medium capitalize">${gc.source}</div>
                </div>
                <div>
                    <div class="text-sm text-navy-500">Created</div>
                    <div class="font-medium">${createdDate}</div>
                </div>
                <div>
                    <div class="text-sm text-navy-500">Activated</div>
                    <div class="font-medium">${activatedDate}</div>
                </div>
            </div>

            <div class="border-t border-navy/20 pt-4">
                <h3 class="font-semibold text-navy mb-2">Purchaser</h3>
                <div class="text-sm">
                    <div>${gc.purchaser_name || '-'}</div>
                    <div class="text-navy-500">${gc.purchaser_email}</div>
                </div>
            </div>

            ${gc.recipient_email ? `
                <div class="border-t border-navy/20 pt-4">
                    <h3 class="font-semibold text-navy mb-2">Recipient</h3>
                    <div class="text-sm">
                        <div>${gc.recipient_name || '-'}</div>
                        <div class="text-navy-500">${gc.recipient_email}</div>
                    </div>
                </div>
            ` : ''}

            ${gc.personal_message ? `
                <div class="border-t border-navy/20 pt-4">
                    <h3 class="font-semibold text-navy mb-2">Personal Message</h3>
                    <div class="text-sm italic text-navy-600">"${gc.personal_message}"</div>
                </div>
            ` : ''}

            ${transactionsHtml}

            <div class="border-t border-navy/20 pt-4 flex gap-2">
                ${gc.status === 'active' ? `
                    <button onclick="openAdjustModal(${gc.id}, '${gc.code}', ${balance})" class="px-4 py-2 bg-navy-100 text-navy-700 rounded-lg hover:bg-navy-200 transition-colors text-sm">Adjust Balance</button>
                    ${!gc.is_sent ? `
                        <button onclick="markAsSent(${gc.id})" class="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm">Mark as Sent</button>
                    ` : ''}
                    <button onclick="cancelGiftCard(${gc.id})" class="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm">Cancel</button>
                ` : ''}
            </div>
        </div>
    `;

    modal.classList.remove('hidden');
}

async function markAsSent(id) {
    if (!confirm('Mark this gift card as sent? This indicates you have emailed the code to the customer.')) return;

    try {
        const response = await fetch('/api/admin-gift-cards', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ id, action: 'mark_sent' })
        });

        if (!response.ok) throw new Error('Failed to update');

        fetchGiftCards();
        document.getElementById('detail-modal').classList.add('hidden');

    } catch (error) {
        console.error('Error:', error);
        alert('Failed to mark as sent');
    }
}

async function cancelGiftCard(id) {
    if (!confirm('Are you sure you want to cancel this gift card? This action cannot be undone.')) return;

    try {
        const response = await fetch(`/api/admin-gift-cards?id=${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to cancel');

        fetchGiftCards();
        document.getElementById('detail-modal').classList.add('hidden');

    } catch (error) {
        console.error('Error:', error);
        alert('Failed to cancel gift card');
    }
}

function copyCode(code) {
    navigator.clipboard.writeText(code).then(() => {
        // Could show a toast notification here
    });
}

function openAdjustModal(id, code, currentBalance) {
    document.getElementById('adjust-gc-id').value = id;
    document.getElementById('adjust-gc-code').textContent = code;
    document.getElementById('adjust-current-balance').textContent = `£${currentBalance.toFixed(2)}`;
    document.getElementById('adjust-new-balance').value = currentBalance.toFixed(2);
    document.getElementById('adjust-notes').value = '';
    document.getElementById('adjust-error').classList.add('hidden');
    document.getElementById('detail-modal').classList.add('hidden');
    document.getElementById('adjust-modal').classList.remove('hidden');
}

// Create promotional gift card
document.getElementById('create-promo-btn').addEventListener('click', () => {
    document.getElementById('promo-amount').value = '';
    document.getElementById('promo-recipient-email').value = '';
    document.getElementById('promo-recipient-name').value = '';
    document.getElementById('promo-message').value = '';
    document.getElementById('promo-notes').value = '';
    document.getElementById('create-error').classList.add('hidden');
    document.getElementById('create-modal').classList.remove('hidden');
});

document.getElementById('create-promo-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const amount = parseFloat(document.getElementById('promo-amount').value);
    if (!amount || amount < 1 || amount > 500) {
        document.getElementById('create-error').textContent = 'Amount must be between £1 and £500';
        document.getElementById('create-error').classList.remove('hidden');
        return;
    }

    try {
        const response = await fetch('/api/admin-gift-cards', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                amount,
                recipient_email: document.getElementById('promo-recipient-email').value.trim() || null,
                recipient_name: document.getElementById('promo-recipient-name').value.trim() || null,
                personal_message: document.getElementById('promo-message').value.trim() || null,
                notes: document.getElementById('promo-notes').value.trim() || null
            })
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to create gift card');
        }

        const gc = await response.json();
        document.getElementById('create-modal').classList.add('hidden');
        alert(`Gift card created!\nCode: ${gc.code}\nAmount: £${parseFloat(gc.initial_balance).toFixed(2)}`);
        fetchGiftCards();

    } catch (error) {
        document.getElementById('create-error').textContent = error.message;
        document.getElementById('create-error').classList.remove('hidden');
    }
});

// Adjust balance
document.getElementById('adjust-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = document.getElementById('adjust-gc-id').value;
    const newBalance = parseFloat(document.getElementById('adjust-new-balance').value);
    const notes = document.getElementById('adjust-notes').value.trim();

    if (isNaN(newBalance) || newBalance < 0) {
        document.getElementById('adjust-error').textContent = 'Please enter a valid balance';
        document.getElementById('adjust-error').classList.remove('hidden');
        return;
    }

    if (!notes) {
        document.getElementById('adjust-error').textContent = 'Please provide a reason for the adjustment';
        document.getElementById('adjust-error').classList.remove('hidden');
        return;
    }

    try {
        const response = await fetch('/api/admin-gift-cards', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                id,
                action: 'adjust_balance',
                new_balance: newBalance,
                notes
            })
        });

        if (!response.ok) throw new Error('Failed to adjust balance');

        document.getElementById('adjust-modal').classList.add('hidden');
        fetchGiftCards();

    } catch (error) {
        document.getElementById('adjust-error').textContent = error.message;
        document.getElementById('adjust-error').classList.remove('hidden');
    }
});

// Modal close handlers
document.getElementById('close-detail-modal').addEventListener('click', () => {
    document.getElementById('detail-modal').classList.add('hidden');
});
document.getElementById('detail-overlay').addEventListener('click', () => {
    document.getElementById('detail-modal').classList.add('hidden');
});

document.getElementById('close-create-modal').addEventListener('click', () => {
    document.getElementById('create-modal').classList.add('hidden');
});
document.getElementById('create-overlay').addEventListener('click', () => {
    document.getElementById('create-modal').classList.add('hidden');
});

document.getElementById('close-adjust-modal').addEventListener('click', () => {
    document.getElementById('adjust-modal').classList.add('hidden');
});
document.getElementById('adjust-overlay').addEventListener('click', () => {
    document.getElementById('adjust-modal').classList.add('hidden');
});

// Filter handlers
document.getElementById('status-filter').addEventListener('change', fetchGiftCards);
document.getElementById('unsent-filter').addEventListener('change', fetchGiftCards);

let searchTimeout;
document.getElementById('search-input').addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(fetchGiftCards, 300);
});

// Initial load
fetchGiftCards();
