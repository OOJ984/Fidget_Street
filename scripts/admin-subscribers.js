/**
 * Admin Subscribers Page
 * Email list management
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
let subscribers = [];
let filteredSubscribers = [];
let unsubscribingEmail = null;

// Fetch subscribers
async function fetchSubscribers() {
    try {
        const response = await fetch('/api/subscribers', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/admin/index.html';
                return;
            }
            throw new Error('Failed to fetch subscribers');
        }

        subscribers = await response.json();
        updateStats();
        applyFilters();

    } catch (error) {
        console.error('Error:', error);
        document.getElementById('subscribers-container').innerHTML = `
            <div class="text-center py-12 text-red-400">Failed to load subscribers. Make sure the newsletter_subscribers table exists in Supabase.</div>
        `;
    }
}

function updateStats() {
    const total = subscribers.length;
    const active = subscribers.filter(s => s.is_active !== false).length;
    const inactive = subscribers.filter(s => s.is_active === false).length;

    document.getElementById('total-count').textContent = total;
    document.getElementById('active-count').textContent = active;
    document.getElementById('inactive-count').textContent = inactive;
}

function applyFilters() {
    const statusFilter = document.getElementById('filter-status').value;
    const searchQuery = document.getElementById('search-input').value.toLowerCase();

    filteredSubscribers = subscribers.filter(sub => {
        // Status filter
        if (statusFilter === 'active' && sub.is_active === false) return false;
        if (statusFilter === 'inactive' && sub.is_active !== false) return false;

        // Search filter
        if (searchQuery && !sub.email.toLowerCase().includes(searchQuery)) return false;

        return true;
    });

    renderSubscribers();
}

function renderSubscribers() {
    if (filteredSubscribers.length === 0) {
        document.getElementById('subscribers-container').innerHTML = `
            <div class="text-center py-12 text-navy-500">No subscribers found</div>
        `;
        return;
    }

    document.getElementById('subscribers-container').innerHTML = `
        <table class="w-full">
            <thead>
                <tr class="text-left text-sm text-navy-500 border-b border-navy/10">
                    <th class="px-6 py-4 font-medium">Email</th>
                    <th class="px-6 py-4 font-medium">Status</th>
                    <th class="px-6 py-4 font-medium">Source</th>
                    <th class="px-6 py-4 font-medium">Subscribed</th>
                    <th class="px-6 py-4 font-medium">Unsubscribed</th>
                    <th class="px-6 py-4 font-medium"></th>
                </tr>
            </thead>
            <tbody class="text-sm">
                ${filteredSubscribers.map(sub => `
                    <tr class="border-b border-navy/5 hover:bg-navy-100/50">
                        <td class="px-6 py-4 font-medium">${sub.email}</td>
                        <td class="px-6 py-4">
                            ${sub.is_active !== false
                                ? '<span class="px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">Active</span>'
                                : '<span class="px-2 py-1 rounded-full text-xs bg-red-100 text-red-600">Unsubscribed</span>'}
                        </td>
                        <td class="px-6 py-4 text-navy-500">${sub.source || 'website'}</td>
                        <td class="px-6 py-4 text-navy-500">${formatDate(sub.subscribed_at)}</td>
                        <td class="px-6 py-4 text-navy-500">${sub.unsubscribed_at ? formatDate(sub.unsubscribed_at) : '-'}</td>
                        <td class="px-6 py-4">
                            ${sub.is_active !== false ? `
                                <button onclick="unsubscribeUser('${sub.email}')" class="text-red-500 hover:text-red-600 text-sm">
                                    Unsubscribe
                                </button>
                            ` : ''}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Unsubscribe functions
function unsubscribeUser(email) {
    unsubscribingEmail = email;
    document.getElementById('unsubscribe-email').textContent = email;
    document.getElementById('unsubscribe-modal').classList.remove('hidden');
}

async function confirmUnsubscribe() {
    if (!unsubscribingEmail) return;

    try {
        const response = await fetch('/api/subscribers', {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email: unsubscribingEmail })
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to unsubscribe');
        }

        document.getElementById('unsubscribe-modal').classList.add('hidden');
        unsubscribingEmail = null;
        fetchSubscribers();

    } catch (error) {
        alert(error.message);
    }
}

// Export to CSV
function exportCSV() {
    const activeSubscribers = subscribers.filter(s => s.is_active !== false);

    if (activeSubscribers.length === 0) {
        alert('No active subscribers to export');
        return;
    }

    const csv = [
        'Email,Subscribed Date,Source',
        ...activeSubscribers.map(s =>
            `${s.email},${s.subscribed_at || ''},${s.source || 'website'}`
        )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fidget-street-subscribers-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// Copy all emails
function copyEmails() {
    const activeEmails = subscribers
        .filter(s => s.is_active !== false)
        .map(s => s.email)
        .join(', ');

    if (!activeEmails) {
        alert('No active subscribers to copy');
        return;
    }

    navigator.clipboard.writeText(activeEmails).then(() => {
        const btn = document.getElementById('copy-emails-btn');
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> Copied!';
        setTimeout(() => {
            btn.innerHTML = originalHTML;
        }, 2000);
    }).catch(() => {
        alert('Failed to copy to clipboard');
    });
}

// Event listeners
document.getElementById('filter-status').addEventListener('change', applyFilters);
document.getElementById('search-input').addEventListener('input', applyFilters);
document.getElementById('export-btn').addEventListener('click', exportCSV);
document.getElementById('copy-emails-btn').addEventListener('click', copyEmails);

document.getElementById('cancel-unsubscribe').addEventListener('click', () => {
    document.getElementById('unsubscribe-modal').classList.add('hidden');
    unsubscribingEmail = null;
});
document.getElementById('confirm-unsubscribe').addEventListener('click', confirmUnsubscribe);

// Initial load
fetchSubscribers();
