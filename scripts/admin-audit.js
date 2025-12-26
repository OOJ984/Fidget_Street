/**
 * Admin Audit Logs Page
 * View and export security audit logs (website_admin only)
 */

// Check auth
const token = localStorage.getItem('admin_token');
const user = JSON.parse(localStorage.getItem('admin_user') || '{}');

if (!token) {
    window.location.href = '/admin/index.html';
}

// Check if user has VIEW_AUDIT_LOGS permission (website_admin only)
if (user.role !== 'website_admin') {
    window.location.href = '/admin/dashboard.html';
}

// Display user info
document.getElementById('user-name').textContent = user.name || user.email;

// Logout
document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    window.location.href = '/admin/index.html';
});

// State
let currentPage = 1;
let totalPages = 1;
let currentLogs = [];

// Action type labels and colors
const actionLabels = {
    login_success: { label: 'Login Success', color: 'bg-green-500/20 text-green-400' },
    login_failed: { label: 'Login Failed', color: 'bg-red-500/20 text-red-400' },
    logout: { label: 'Logout', color: 'bg-gray-500/20 text-gray-400' },
    mfa_setup: { label: 'MFA Setup', color: 'bg-blue-500/20 text-blue-400' },
    mfa_verified: { label: 'MFA Verified', color: 'bg-blue-500/20 text-blue-400' },
    password_changed: { label: 'Password Changed', color: 'bg-yellow-500/20 text-yellow-400' },
    product_created: { label: 'Product Created', color: 'bg-green-500/20 text-green-400' },
    product_updated: { label: 'Product Updated', color: 'bg-blue-500/20 text-blue-400' },
    product_deleted: { label: 'Product Deleted', color: 'bg-red-500/20 text-red-400' },
    order_status_updated: { label: 'Order Updated', color: 'bg-purple-500/20 text-purple-400' },
    media_uploaded: { label: 'Media Uploaded', color: 'bg-green-500/20 text-green-400' },
    media_deleted: { label: 'Media Deleted', color: 'bg-red-500/20 text-red-400' },
    media_renamed: { label: 'Media Renamed', color: 'bg-blue-500/20 text-blue-400' },
    settings_updated: { label: 'Settings Updated', color: 'bg-yellow-500/20 text-yellow-400' },
    settings_reset: { label: 'Settings Reset', color: 'bg-orange-500/20 text-orange-400' },
    user_created: { label: 'User Created', color: 'bg-green-500/20 text-green-400' },
    user_updated: { label: 'User Updated', color: 'bg-blue-500/20 text-blue-400' },
    user_deactivated: { label: 'User Deactivated', color: 'bg-red-500/20 text-red-400' },
    user_role_changed: { label: 'Role Changed', color: 'bg-purple-500/20 text-purple-400' }
};

// Fetch logs
async function fetchLogs(page = 1) {
    const params = new URLSearchParams();
    params.set('page', page);
    params.set('limit', '25');

    const action = document.getElementById('filter-action').value;
    const email = document.getElementById('filter-email').value;
    const from = document.getElementById('filter-from').value;
    const to = document.getElementById('filter-to').value;

    if (action) params.set('action', action);
    if (email) params.set('user_email', email);
    if (from) params.set('from', from);
    if (to) params.set('to', to);

    try {
        const response = await fetch(`/api/admin-audit?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            if (response.status === 403) {
                window.location.href = '/admin/dashboard.html';
                return;
            }
            throw new Error('Failed to fetch logs');
        }

        const data = await response.json();
        currentLogs = data.logs;
        currentPage = data.pagination.page;
        totalPages = data.pagination.totalPages;

        renderLogs(data.logs);
        updatePagination(data.pagination);

    } catch (error) {
        console.error('Error:', error);
        document.getElementById('logs-container').innerHTML = `
            <div class="text-center py-12 text-red-400">Failed to load audit logs</div>
        `;
    }
}

function renderLogs(logs) {
    if (logs.length === 0) {
        document.getElementById('logs-container').innerHTML = `
            <div class="text-center py-12 text-gray-400">No audit logs found</div>
        `;
        return;
    }

    document.getElementById('logs-container').innerHTML = `
        <table class="w-full">
            <thead>
                <tr class="text-left text-sm text-gray-400 border-b border-white/10">
                    <th class="px-6 py-4 font-medium">Timestamp</th>
                    <th class="px-6 py-4 font-medium">Action</th>
                    <th class="px-6 py-4 font-medium">User</th>
                    <th class="px-6 py-4 font-medium">Resource</th>
                    <th class="px-6 py-4 font-medium">IP Address</th>
                    <th class="px-6 py-4 font-medium"></th>
                </tr>
            </thead>
            <tbody class="text-sm">
                ${logs.map(log => {
                    const action = actionLabels[log.action] || { label: log.action, color: 'bg-gray-500/20 text-gray-400' };
                    return `
                        <tr class="border-b border-white/5 hover:bg-white/5">
                            <td class="px-6 py-4 text-gray-400">${formatDate(log.created_at)}</td>
                            <td class="px-6 py-4">
                                <span class="px-2 py-1 rounded-full text-xs ${action.color}">
                                    ${action.label}
                                </span>
                            </td>
                            <td class="px-6 py-4">${log.user_email || '-'}</td>
                            <td class="px-6 py-4 text-gray-400">
                                ${log.resource_type ? `${log.resource_type}${log.resource_id ? `:${log.resource_id}` : ''}` : '-'}
                            </td>
                            <td class="px-6 py-4 text-gray-500 font-mono text-xs">${log.ip_address || '-'}</td>
                            <td class="px-6 py-4">
                                <button onclick="showDetails('${log.id}')" class="text-soft-blue hover:text-soft-blue/80">
                                    Details
                                </button>
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

function updatePagination(pagination) {
    const paginationEl = document.getElementById('pagination');
    paginationEl.classList.remove('hidden');

    const start = (pagination.page - 1) * pagination.limit + 1;
    const end = Math.min(pagination.page * pagination.limit, pagination.total);
    document.getElementById('page-info').textContent = `${start}-${end} of ${pagination.total}`;

    document.getElementById('prev-page').disabled = pagination.page <= 1;
    document.getElementById('next-page').disabled = pagination.page >= pagination.totalPages;
}

function showDetails(logId) {
    const log = currentLogs.find(l => l.id === logId);
    if (!log) return;

    const action = actionLabels[log.action] || { label: log.action, color: 'bg-gray-500/20 text-gray-400' };

    document.getElementById('modal-content').innerHTML = `
        <div class="grid grid-cols-2 gap-4">
            <div>
                <p class="text-gray-400">Timestamp</p>
                <p class="font-medium">${formatDate(log.created_at)}</p>
            </div>
            <div>
                <p class="text-gray-400">Action</p>
                <p><span class="px-2 py-1 rounded-full text-xs ${action.color}">${action.label}</span></p>
            </div>
            <div>
                <p class="text-gray-400">User Email</p>
                <p class="font-medium">${log.user_email || '-'}</p>
            </div>
            <div>
                <p class="text-gray-400">User ID</p>
                <p class="font-medium">${log.user_id || '-'}</p>
            </div>
            <div>
                <p class="text-gray-400">Resource Type</p>
                <p class="font-medium">${log.resource_type || '-'}</p>
            </div>
            <div>
                <p class="text-gray-400">Resource ID</p>
                <p class="font-medium">${log.resource_id || '-'}</p>
            </div>
            <div>
                <p class="text-gray-400">IP Address</p>
                <p class="font-mono text-sm">${log.ip_address || '-'}</p>
            </div>
            <div>
                <p class="text-gray-400">Log ID</p>
                <p class="font-mono text-xs text-gray-500">${log.id}</p>
            </div>
        </div>
        ${log.details ? `
            <div class="mt-4 pt-4 border-t border-white/10">
                <p class="text-gray-400 mb-2">Details</p>
                <pre class="bg-black p-3 rounded-lg text-xs overflow-x-auto">${JSON.stringify(log.details, null, 2)}</pre>
            </div>
        ` : ''}
        ${log.user_agent ? `
            <div class="mt-4 pt-4 border-t border-white/10">
                <p class="text-gray-400 mb-2">User Agent</p>
                <p class="text-xs text-gray-500 break-all">${log.user_agent}</p>
            </div>
        ` : ''}
    `;

    document.getElementById('details-modal').classList.remove('hidden');
}

// Export to CSV
document.getElementById('export-btn').addEventListener('click', async () => {
    const params = new URLSearchParams();
    params.set('limit', '1000'); // Max export

    const action = document.getElementById('filter-action').value;
    const email = document.getElementById('filter-email').value;
    const from = document.getElementById('filter-from').value;
    const to = document.getElementById('filter-to').value;

    if (action) params.set('action', action);
    if (email) params.set('user_email', email);
    if (from) params.set('from', from);
    if (to) params.set('to', to);

    try {
        const response = await fetch(`/api/admin-audit?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        // Build CSV
        const headers = ['Timestamp', 'Action', 'User Email', 'User ID', 'Resource Type', 'Resource ID', 'IP Address', 'Details'];
        const rows = data.logs.map(log => [
            log.created_at,
            log.action,
            log.user_email || '',
            log.user_id || '',
            log.resource_type || '',
            log.resource_id || '',
            log.ip_address || '',
            log.details ? JSON.stringify(log.details) : ''
        ]);

        const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);

    } catch (error) {
        console.error('Export error:', error);
        alert('Failed to export logs');
    }
});

// Event listeners
document.getElementById('apply-filters').addEventListener('click', () => fetchLogs(1));
document.getElementById('clear-filters').addEventListener('click', () => {
    document.getElementById('filter-action').value = '';
    document.getElementById('filter-email').value = '';
    document.getElementById('filter-from').value = '';
    document.getElementById('filter-to').value = '';
    fetchLogs(1);
});

document.getElementById('prev-page').addEventListener('click', () => {
    if (currentPage > 1) fetchLogs(currentPage - 1);
});

document.getElementById('next-page').addEventListener('click', () => {
    if (currentPage < totalPages) fetchLogs(currentPage + 1);
});

document.getElementById('close-modal').addEventListener('click', () => {
    document.getElementById('details-modal').classList.add('hidden');
});

document.getElementById('details-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
        document.getElementById('details-modal').classList.add('hidden');
    }
});

// Initial load
fetchLogs(1);
