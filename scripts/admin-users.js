/**
 * Admin Users Page
 * User management (website_admin only)
 */

// Check auth
const token = localStorage.getItem('admin_token');
const currentUser = JSON.parse(localStorage.getItem('admin_user') || '{}');

if (!token) {
    window.location.href = '/admin/index.html';
}

// Check if user has MANAGE_USERS permission (website_admin only)
if (currentUser.role !== 'website_admin') {
    window.location.href = '/admin/dashboard.html';
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
let users = [];
let editingUserId = null;
let deactivatingUserId = null;

// Role labels
const roleLabels = {
    website_admin: { label: 'Website Admin', color: 'bg-purple-500/20 text-purple-400' },
    business_processing: { label: 'Business Processing', color: 'bg-blue-500/20 text-blue-400' }
};

// Fetch users
async function fetchUsers() {
    try {
        const response = await fetch('/api/admin-users', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            if (response.status === 403) {
                window.location.href = '/admin/dashboard.html';
                return;
            }
            throw new Error('Failed to fetch users');
        }

        users = await response.json();
        renderUsers();

    } catch (error) {
        console.error('Error:', error);
        document.getElementById('users-container').innerHTML = `
            <div class="text-center py-12 text-red-400">Failed to load users</div>
        `;
    }
}

function renderUsers() {
    if (users.length === 0) {
        document.getElementById('users-container').innerHTML = `
            <div class="text-center py-12 text-gray-400">No users found</div>
        `;
        return;
    }

    document.getElementById('users-container').innerHTML = `
        <table class="w-full">
            <thead>
                <tr class="text-left text-sm text-gray-400 border-b border-white/10">
                    <th class="px-6 py-4 font-medium">Name</th>
                    <th class="px-6 py-4 font-medium">Email</th>
                    <th class="px-6 py-4 font-medium">Role</th>
                    <th class="px-6 py-4 font-medium">MFA</th>
                    <th class="px-6 py-4 font-medium">Status</th>
                    <th class="px-6 py-4 font-medium">Last Login</th>
                    <th class="px-6 py-4 font-medium"></th>
                </tr>
            </thead>
            <tbody class="text-sm">
                ${users.map(user => {
                    const role = roleLabels[user.role] || { label: user.role, color: 'bg-gray-500/20 text-gray-400' };
                    const isCurrentUser = user.id === currentUser.id;
                    return `
                        <tr class="border-b border-white/5 hover:bg-white/5">
                            <td class="px-6 py-4 font-medium">
                                ${user.name || '-'}
                                ${isCurrentUser ? '<span class="text-xs text-rose-gold ml-2">(you)</span>' : ''}
                            </td>
                            <td class="px-6 py-4">${user.email}</td>
                            <td class="px-6 py-4">
                                <span class="px-2 py-1 rounded-full text-xs ${role.color}">
                                    ${role.label}
                                </span>
                            </td>
                            <td class="px-6 py-4">
                                ${user.mfa_enabled
                                    ? '<span class="text-green-400">Enabled</span>'
                                    : '<span class="text-yellow-400">Not Set</span>'}
                            </td>
                            <td class="px-6 py-4">
                                ${user.is_active !== false
                                    ? '<span class="text-green-400">Active</span>'
                                    : '<span class="text-red-400">Inactive</span>'}
                            </td>
                            <td class="px-6 py-4 text-gray-400">
                                ${user.last_login ? formatDate(user.last_login) : 'Never'}
                            </td>
                            <td class="px-6 py-4">
                                <div class="flex gap-2">
                                    <button onclick="editUser(${user.id})" class="text-rose-gold hover:text-rose-gold/80">
                                        Edit
                                    </button>
                                    ${!isCurrentUser && user.is_active !== false ? `
                                        <button onclick="deactivateUser(${user.id})" class="text-red-400 hover:text-red-300">
                                            Deactivate
                                        </button>
                                    ` : ''}
                                    ${!isCurrentUser && user.is_active === false ? `
                                        <button onclick="reactivateUser(${user.id})" class="text-green-400 hover:text-green-300">
                                            Reactivate
                                        </button>
                                    ` : ''}
                                </div>
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
        minute: '2-digit'
    });
}

// Modal functions
function openModal(title = 'Add User', user = null) {
    editingUserId = user ? user.id : null;
    document.getElementById('modal-title').textContent = title;
    document.getElementById('user-id').value = user ? user.id : '';
    document.getElementById('user-name-input').value = user ? user.name || '' : '';
    document.getElementById('user-email').value = user ? user.email : '';
    document.getElementById('user-password').value = '';
    document.getElementById('user-role').value = user ? user.role : 'business_processing';
    document.getElementById('error-message').classList.add('hidden');

    // Password required for new users
    document.getElementById('user-password').required = !user;

    document.getElementById('user-modal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('user-modal').classList.add('hidden');
    editingUserId = null;
}

function editUser(userId) {
    const user = users.find(u => u.id === userId);
    if (user) {
        openModal('Edit User', user);
    }
}

function deactivateUser(userId) {
    deactivatingUserId = userId;
    document.getElementById('deactivate-modal').classList.remove('hidden');
}

async function confirmDeactivate() {
    if (!deactivatingUserId) return;

    try {
        const response = await fetch('/api/admin-users', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                id: deactivatingUserId,
                is_active: false
            })
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to deactivate user');
        }

        document.getElementById('deactivate-modal').classList.add('hidden');
        deactivatingUserId = null;
        fetchUsers();

    } catch (error) {
        alert(error.message);
    }
}

async function reactivateUser(userId) {
    try {
        const response = await fetch('/api/admin-users', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                id: userId,
                is_active: true
            })
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to reactivate user');
        }

        fetchUsers();

    } catch (error) {
        alert(error.message);
    }
}

// Form submission
document.getElementById('user-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const errorEl = document.getElementById('error-message');
    errorEl.classList.add('hidden');

    const name = document.getElementById('user-name-input').value.trim();
    const email = document.getElementById('user-email').value.trim();
    const password = document.getElementById('user-password').value;
    const role = document.getElementById('user-role').value;

    const body = { name, email, role };
    if (password) body.password = password;
    if (editingUserId) body.id = editingUserId;

    try {
        const response = await fetch('/api/admin-users', {
            method: editingUserId ? 'PUT' : 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to save user');
        }

        closeModal();
        fetchUsers();

    } catch (error) {
        errorEl.textContent = error.message;
        errorEl.classList.remove('hidden');
    }
});

// Event listeners
document.getElementById('add-user-btn').addEventListener('click', () => openModal());
document.getElementById('close-modal').addEventListener('click', closeModal);
document.getElementById('cancel-btn').addEventListener('click', closeModal);
document.getElementById('user-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
});

document.getElementById('cancel-deactivate').addEventListener('click', () => {
    document.getElementById('deactivate-modal').classList.add('hidden');
    deactivatingUserId = null;
});
document.getElementById('confirm-deactivate').addEventListener('click', confirmDeactivate);

// Initial load
fetchUsers();
