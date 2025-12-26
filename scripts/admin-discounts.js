/**
 * Admin Discounts Page
 * Discount code management
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
let discounts = [];
let filteredDiscounts = [];
let editingId = null;
let deletingId = null;

// Fetch discounts
async function fetchDiscounts() {
    try {
        const response = await fetch('/api/admin-discounts', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/admin/index.html';
                return;
            }
            throw new Error('Failed to fetch discounts');
        }

        discounts = await response.json();
        updateStats();
        applyFilters();

    } catch (error) {
        console.error('Error:', error);
        document.getElementById('discounts-container').innerHTML = `
            <div class="text-center py-12 text-red-400">Failed to load discount codes. Please run the database migration first.</div>
        `;
    }
}

function getCodeStatus(discount) {
    const now = new Date();
    const startsAt = discount.starts_at ? new Date(discount.starts_at) : null;
    const expiresAt = discount.expires_at ? new Date(discount.expires_at) : null;

    if (!discount.is_active) return 'inactive';
    if (expiresAt && expiresAt < now) return 'expired';
    if (startsAt && startsAt > now) return 'scheduled';
    if (discount.max_uses && discount.use_count >= discount.max_uses) return 'exhausted';
    return 'active';
}

function updateStats() {
    const total = discounts.length;
    const active = discounts.filter(d => getCodeStatus(d) === 'active').length;
    const scheduled = discounts.filter(d => getCodeStatus(d) === 'scheduled').length;
    const totalUses = discounts.reduce((sum, d) => sum + (d.use_count || 0), 0);

    document.getElementById('total-count').textContent = total;
    document.getElementById('active-count').textContent = active;
    document.getElementById('scheduled-count').textContent = scheduled;
    document.getElementById('uses-count').textContent = totalUses;
}

function applyFilters() {
    const statusFilter = document.getElementById('filter-status').value;
    const searchQuery = document.getElementById('search-input').value.toLowerCase();

    filteredDiscounts = discounts.filter(d => {
        const status = getCodeStatus(d);

        // Status filter
        if (statusFilter !== 'all' && status !== statusFilter) return false;

        // Search filter
        if (searchQuery) {
            const matchesCode = d.code.toLowerCase().includes(searchQuery);
            const matchesName = d.name.toLowerCase().includes(searchQuery);
            if (!matchesCode && !matchesName) return false;
        }

        return true;
    });

    renderDiscounts();
}

function renderDiscounts() {
    if (filteredDiscounts.length === 0) {
        document.getElementById('discounts-container').innerHTML = `
            <div class="text-center py-12 text-navy-500">No discount codes found</div>
        `;
        return;
    }

    document.getElementById('discounts-container').innerHTML = `
        <table class="w-full">
            <thead>
                <tr class="text-left text-sm text-navy-500 border-b border-navy/10">
                    <th class="px-6 py-4 font-medium">Code</th>
                    <th class="px-6 py-4 font-medium">Name</th>
                    <th class="px-6 py-4 font-medium">Discount</th>
                    <th class="px-6 py-4 font-medium">Status</th>
                    <th class="px-6 py-4 font-medium">Uses</th>
                    <th class="px-6 py-4 font-medium">Valid From</th>
                    <th class="px-6 py-4 font-medium">Valid Until</th>
                    <th class="px-6 py-4 font-medium"></th>
                </tr>
            </thead>
            <tbody class="text-sm">
                ${filteredDiscounts.map(d => {
                    const status = getCodeStatus(d);
                    return `
                    <tr class="border-b border-navy/5 hover:bg-navy-100/50">
                        <td class="px-6 py-4 font-mono font-medium">${escapeHtml(d.code)}</td>
                        <td class="px-6 py-4 text-navy-600">${escapeHtml(d.name)}</td>
                        <td class="px-6 py-4">
                            ${d.discount_type === 'percentage'
                                ? `${d.discount_value}%`
                                : d.discount_type === 'free_delivery'
                                    ? 'Free Delivery'
                                    : `£${parseFloat(d.discount_value).toFixed(2)}`}
                        </td>
                        <td class="px-6 py-4">${getStatusBadge(status)}</td>
                        <td class="px-6 py-4 text-navy-500">
                            ${d.use_count || 0}${d.max_uses ? ` / ${d.max_uses}` : ''}
                            ${d.max_uses_per_customer ? `<br><span class="text-xs">(${d.max_uses_per_customer}/person)</span>` : ''}
                        </td>
                        <td class="px-6 py-4 text-navy-500">${formatDate(d.starts_at)}</td>
                        <td class="px-6 py-4 text-navy-500">${d.expires_at ? formatDate(d.expires_at) : 'Never'}</td>
                        <td class="px-6 py-4">
                            <div class="flex items-center gap-2">
                                <button onclick="editDiscount(${d.id})" class="text-soft-blue hover:text-soft-blue/80 text-sm">
                                    Edit
                                </button>
                                ${d.is_active ? `
                                    <button onclick="deleteDiscount(${d.id}, '${escapeHtml(d.code)}')" class="text-red-500 hover:text-red-600 text-sm">
                                        Deactivate
                                    </button>
                                ` : ''}
                            </div>
                        </td>
                    </tr>
                `}).join('')}
            </tbody>
        </table>
    `;
}

function getStatusBadge(status) {
    const badges = {
        active: '<span class="px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">Active</span>',
        scheduled: '<span class="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700">Scheduled</span>',
        expired: '<span class="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600">Expired</span>',
        exhausted: '<span class="px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-600">Exhausted</span>',
        inactive: '<span class="px-2 py-1 rounded-full text-xs bg-red-100 text-red-600">Inactive</span>'
    };
    return badges[status] || badges.inactive;
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

function formatDateTimeLocal(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toISOString().slice(0, 16);
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Modal functions
function openModal(isEdit = false) {
    document.getElementById('modal-title').textContent = isEdit ? 'Edit Discount Code' : 'Add Discount Code';
    document.getElementById('active-field').classList.toggle('hidden', !isEdit);
    document.getElementById('discount-modal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('discount-modal').classList.add('hidden');
    resetForm();
}

function resetForm() {
    editingId = null;
    document.getElementById('discount-form').reset();
    document.getElementById('discount-id').value = '';
    document.getElementById('error-message').classList.add('hidden');

    // Reset toggles
    document.getElementById('schedule-toggle').checked = false;
    document.getElementById('expiry-toggle').checked = false;
    document.getElementById('limit-toggle').checked = false;

    // Hide conditional fields
    document.getElementById('schedule-fields').classList.add('hidden');
    document.getElementById('starts-now').classList.remove('hidden');
    document.getElementById('expiry-fields').classList.add('hidden');
    document.getElementById('never-expires').classList.remove('hidden');
    document.getElementById('limit-fields').classList.add('hidden');
    document.getElementById('unlimited-uses').classList.remove('hidden');
    document.getElementById('max-uses-custom').classList.add('hidden');

    // Reset value field visibility
    document.getElementById('value-field').classList.remove('hidden');
    document.getElementById('discount-value').setAttribute('required', 'required');

    // Reset expiry fields
    document.getElementById('expiry-value').value = '1';
    document.getElementById('expiry-unit').value = 'days';
    document.getElementById('expires-at').value = '';

    // Reset max uses
    document.getElementById('max-uses').value = '100';
    document.getElementById('max-uses-custom').value = '';

    // Reset per-person limit
    document.getElementById('per-person-toggle').checked = false;
    document.getElementById('per-person-fields').classList.add('hidden');
    document.getElementById('unlimited-per-person').classList.remove('hidden');
    document.getElementById('max-per-person').value = '1';

    // Reset minimum order amount
    document.getElementById('min-order-toggle').checked = false;
    document.getElementById('min-order-fields').classList.add('hidden');
    document.getElementById('no-min-order').classList.remove('hidden');
    document.getElementById('min-order-amount').value = '30';
    document.getElementById('min-order-custom').value = '';
    document.getElementById('min-order-custom').classList.add('hidden');
}

function editDiscount(id) {
    const discount = discounts.find(d => d.id === id);
    if (!discount) return;

    editingId = id;

    // Populate form
    document.getElementById('discount-id').value = id;
    document.getElementById('discount-code').value = discount.code;
    document.getElementById('discount-name').value = discount.name;
    document.getElementById('discount-type').value = discount.discount_type;
    document.getElementById('discount-value').value = discount.discount_value;
    document.getElementById('is-active').checked = discount.is_active;

    // Show/hide value field based on type
    const valueField = document.getElementById('value-field');
    const valueInput = document.getElementById('discount-value');
    if (discount.discount_type === 'free_delivery') {
        valueField.classList.add('hidden');
        valueInput.removeAttribute('required');
    } else {
        valueField.classList.remove('hidden');
        valueInput.setAttribute('required', 'required');
    }

    // Schedule
    if (discount.starts_at) {
        document.getElementById('schedule-toggle').checked = true;
        document.getElementById('schedule-fields').classList.remove('hidden');
        document.getElementById('starts-now').classList.add('hidden');
        document.getElementById('starts-at').value = formatDateTimeLocal(discount.starts_at);
    }

    // Expiry
    if (discount.expires_at) {
        document.getElementById('expiry-toggle').checked = true;
        document.getElementById('expiry-fields').classList.remove('hidden');
        document.getElementById('never-expires').classList.add('hidden');
        document.getElementById('expires-at').value = formatDateTimeLocal(discount.expires_at);
    }

    // Usage limit
    if (discount.max_uses) {
        document.getElementById('limit-toggle').checked = true;
        document.getElementById('limit-fields').classList.remove('hidden');
        document.getElementById('unlimited-uses').classList.add('hidden');

        // Check if value matches a preset option
        const presetValues = ['10', '25', '50', '100', '250', '500', '1000'];
        if (presetValues.includes(discount.max_uses.toString())) {
            document.getElementById('max-uses').value = discount.max_uses.toString();
        } else {
            document.getElementById('max-uses').value = 'custom';
            document.getElementById('max-uses-custom').value = discount.max_uses;
            document.getElementById('max-uses-custom').classList.remove('hidden');
        }
    }

    // Per-person limit
    if (discount.max_uses_per_customer) {
        document.getElementById('per-person-toggle').checked = true;
        document.getElementById('per-person-fields').classList.remove('hidden');
        document.getElementById('unlimited-per-person').classList.add('hidden');
        document.getElementById('max-per-person').value = discount.max_uses_per_customer.toString();
    }

    // Minimum order amount
    if (discount.min_order_amount) {
        document.getElementById('min-order-toggle').checked = true;
        document.getElementById('min-order-fields').classList.remove('hidden');
        document.getElementById('no-min-order').classList.add('hidden');

        // Check if value matches a preset option
        const presetAmounts = ['10', '15', '20', '25', '30', '35', '40', '50', '75', '100'];
        if (presetAmounts.includes(discount.min_order_amount.toString())) {
            document.getElementById('min-order-amount').value = discount.min_order_amount.toString();
        } else {
            document.getElementById('min-order-amount').value = 'custom';
            document.getElementById('min-order-custom').value = discount.min_order_amount;
            document.getElementById('min-order-custom').classList.remove('hidden');
        }
    }

    openModal(true);
}

function deleteDiscount(id, code) {
    deletingId = id;
    document.getElementById('delete-code').textContent = code;
    document.getElementById('delete-modal').classList.remove('hidden');
}

async function confirmDelete() {
    if (!deletingId) return;

    try {
        const response = await fetch(`/api/admin-discounts?id=${deletingId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to deactivate');
        }

        document.getElementById('delete-modal').classList.add('hidden');
        deletingId = null;
        fetchDiscounts();

    } catch (error) {
        alert(error.message);
    }
}

async function handleSubmit(e) {
    e.preventDefault();

    const errorEl = document.getElementById('error-message');
    errorEl.classList.add('hidden');

    const code = document.getElementById('discount-code').value.trim();
    const name = document.getElementById('discount-name').value.trim();
    const discount_type = document.getElementById('discount-type').value;
    const discount_value = discount_type === 'free_delivery' ? 0 : parseFloat(document.getElementById('discount-value').value);

    // Validation
    if (!code || !name || !discount_type) {
        errorEl.textContent = 'Please fill in all required fields';
        errorEl.classList.remove('hidden');
        return;
    }

    if (discount_type !== 'free_delivery' && isNaN(discount_value)) {
        errorEl.textContent = 'Please enter a discount value';
        errorEl.classList.remove('hidden');
        return;
    }

    if (discount_type === 'percentage' && discount_value > 100) {
        errorEl.textContent = 'Percentage cannot exceed 100%';
        errorEl.classList.remove('hidden');
        return;
    }

    // Build payload
    const payload = {
        code,
        name,
        discount_type,
        discount_value
    };

    // Schedule
    if (document.getElementById('schedule-toggle').checked) {
        const startsAt = document.getElementById('starts-at').value;
        if (startsAt) payload.starts_at = new Date(startsAt).toISOString();
    } else {
        payload.starts_at = null;
    }

    // Expiry
    if (document.getElementById('expiry-toggle').checked) {
        const expiresAt = document.getElementById('expires-at').value;
        const expiryValue = parseInt(document.getElementById('expiry-value').value, 10);
        const expiryUnit = document.getElementById('expiry-unit').value;

        // If specific date is set, use it; otherwise calculate from duration
        if (expiresAt) {
            payload.expires_at = new Date(expiresAt).toISOString();
        } else if (expiryValue > 0) {
            const expiryDate = new Date();
            if (expiryUnit === 'days') expiryDate.setDate(expiryDate.getDate() + expiryValue);
            else if (expiryUnit === 'weeks') expiryDate.setDate(expiryDate.getDate() + (expiryValue * 7));
            else if (expiryUnit === 'months') expiryDate.setMonth(expiryDate.getMonth() + expiryValue);
            else if (expiryUnit === 'years') expiryDate.setFullYear(expiryDate.getFullYear() + expiryValue);
            payload.expires_at = expiryDate.toISOString();
        }
    } else {
        payload.expires_at = null;
    }

    // Usage limit
    if (document.getElementById('limit-toggle').checked) {
        const maxUsesSelect = document.getElementById('max-uses').value;
        let maxUses;
        if (maxUsesSelect === 'custom') {
            maxUses = parseInt(document.getElementById('max-uses-custom').value, 10);
        } else {
            maxUses = parseInt(maxUsesSelect, 10);
        }
        if (maxUses > 0) payload.max_uses = maxUses;
    } else {
        payload.max_uses = null;
    }

    // Per-person limit
    if (document.getElementById('per-person-toggle').checked) {
        const maxPerPerson = parseInt(document.getElementById('max-per-person').value, 10);
        if (maxPerPerson > 0) payload.max_uses_per_customer = maxPerPerson;
    } else {
        payload.max_uses_per_customer = null;
    }

    // Minimum order amount
    if (document.getElementById('min-order-toggle').checked) {
        const minOrderSelect = document.getElementById('min-order-amount').value;
        let minOrderAmount;
        if (minOrderSelect === 'custom') {
            minOrderAmount = parseFloat(document.getElementById('min-order-custom').value);
        } else {
            minOrderAmount = parseFloat(minOrderSelect);
        }
        if (minOrderAmount > 0) payload.min_order_amount = minOrderAmount;
    } else {
        payload.min_order_amount = null;
    }

    // Active status (only for editing)
    if (editingId) {
        payload.id = editingId;
        payload.is_active = document.getElementById('is-active').checked;
    }

    try {
        const response = await fetch('/api/admin-discounts', {
            method: editingId ? 'PUT' : 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to save discount code');
        }

        closeModal();
        fetchDiscounts();

    } catch (error) {
        errorEl.textContent = error.message;
        errorEl.classList.remove('hidden');
    }
}

// Event listeners
document.getElementById('add-discount-btn').addEventListener('click', () => {
    resetForm();
    openModal(false);
});

document.getElementById('close-modal').addEventListener('click', closeModal);
document.getElementById('cancel-btn').addEventListener('click', closeModal);
document.getElementById('discount-form').addEventListener('submit', handleSubmit);

document.getElementById('filter-status').addEventListener('change', applyFilters);
document.getElementById('search-input').addEventListener('input', applyFilters);

// Toggle listeners
document.getElementById('schedule-toggle').addEventListener('change', (e) => {
    document.getElementById('schedule-fields').classList.toggle('hidden', !e.target.checked);
    document.getElementById('starts-now').classList.toggle('hidden', e.target.checked);
});

document.getElementById('expiry-toggle').addEventListener('change', (e) => {
    document.getElementById('expiry-fields').classList.toggle('hidden', !e.target.checked);
    document.getElementById('never-expires').classList.toggle('hidden', e.target.checked);
});

document.getElementById('limit-toggle').addEventListener('change', (e) => {
    document.getElementById('limit-fields').classList.toggle('hidden', !e.target.checked);
    document.getElementById('unlimited-uses').classList.toggle('hidden', e.target.checked);
});

// Max uses dropdown - show custom field when "custom" selected
document.getElementById('max-uses').addEventListener('change', (e) => {
    const customField = document.getElementById('max-uses-custom');
    if (e.target.value === 'custom') {
        customField.classList.remove('hidden');
        customField.focus();
    } else {
        customField.classList.add('hidden');
    }
});

// Per-person limit toggle
document.getElementById('per-person-toggle').addEventListener('change', (e) => {
    document.getElementById('per-person-fields').classList.toggle('hidden', !e.target.checked);
    document.getElementById('unlimited-per-person').classList.toggle('hidden', e.target.checked);
});

// Discount type change - show/hide value field
document.getElementById('discount-type').addEventListener('change', (e) => {
    const valueField = document.getElementById('value-field');
    const valueInput = document.getElementById('discount-value');
    if (e.target.value === 'free_delivery') {
        valueField.classList.add('hidden');
        valueInput.removeAttribute('required');
    } else {
        valueField.classList.remove('hidden');
        valueInput.setAttribute('required', 'required');
    }
});

// Minimum order toggle
document.getElementById('min-order-toggle').addEventListener('change', (e) => {
    document.getElementById('min-order-fields').classList.toggle('hidden', !e.target.checked);
    document.getElementById('no-min-order').classList.toggle('hidden', e.target.checked);
});

// Min order amount dropdown - show custom field when "custom" selected
document.getElementById('min-order-amount').addEventListener('change', (e) => {
    const customField = document.getElementById('min-order-custom');
    if (e.target.value === 'custom') {
        customField.classList.remove('hidden');
        customField.focus();
    } else {
        customField.classList.add('hidden');
    }
});

// Delete modal
document.getElementById('cancel-delete').addEventListener('click', () => {
    document.getElementById('delete-modal').classList.add('hidden');
    deletingId = null;
});
document.getElementById('confirm-delete').addEventListener('click', confirmDelete);

// Close modals on overlay click
document.getElementById('discount-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
});
document.getElementById('delete-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
        document.getElementById('delete-modal').classList.add('hidden');
        deletingId = null;
    }
});

// Initial load
fetchDiscounts();
