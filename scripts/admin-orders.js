/**
 * Admin Orders Page
 * Order management with status updates and detail view
 */

let orders = [];

const statusColors = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    paid: 'bg-blue-500/20 text-blue-400',
    processing: 'bg-purple-500/20 text-purple-400',
    shipped: 'bg-green-500/20 text-green-400',
    delivered: 'bg-green-600/20 text-green-300',
    cancelled: 'bg-red-500/20 text-red-400'
};

document.addEventListener('DOMContentLoaded', async () => {
    const user = await requireAuth();
    if (!user) return;

    document.getElementById('user-name').textContent = user.name || user.email;
    document.getElementById('logout-btn').addEventListener('click', logout);

    await loadOrders();
    setupEventListeners();
});

async function loadOrders(status = '') {
    try {
        const url = status ? `/api/admin-orders?status=${status}` : '/api/admin-orders';
        const response = await adminFetch(url);
        if (!response) return;

        orders = await response.json();
        renderOrders();
    } catch (error) {
        console.error('Error loading orders:', error);
        document.getElementById('orders-list').innerHTML = '<p class="text-red-400 text-center py-8">Error loading orders</p>';
    }
}

function renderOrders() {
    if (orders.length === 0) {
        document.getElementById('orders-list').innerHTML = '<p class="text-gray-400 text-center py-8">No orders found</p>';
        return;
    }

    document.getElementById('orders-list').innerHTML = `
        <table class="w-full">
            <thead>
                <tr class="text-left text-sm text-gray-400">
                    <th class="pb-4 font-medium">Order #</th>
                    <th class="pb-4 font-medium">Customer</th>
                    <th class="pb-4 font-medium">Items</th>
                    <th class="pb-4 font-medium">Total</th>
                    <th class="pb-4 font-medium">Status</th>
                    <th class="pb-4 font-medium">Date</th>
                    <th class="pb-4 font-medium">Actions</th>
                </tr>
            </thead>
            <tbody class="text-sm">
                ${orders.map(order => `
                    <tr class="border-t border-white/10">
                        <td class="py-4 font-mono">${order.order_number}</td>
                        <td class="py-4">
                            <div>${escapeHtml(order.customer_name) || 'Unknown'}</div>
                            <div class="text-xs text-gray-500">${escapeHtml(order.customer_email) || ''}</div>
                        </td>
                        <td class="py-4">${order.items?.length || 0} items</td>
                        <td class="py-4">£${(order.total || 0).toFixed(2)}</td>
                        <td class="py-4">
                            <select class="status-select bg-transparent border border-white/20 rounded px-2 py-1 text-xs ${statusColors[order.status] || ''}" data-id="${order.id}">
                                <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
                                <option value="paid" ${order.status === 'paid' ? 'selected' : ''}>Paid</option>
                                <option value="processing" ${order.status === 'processing' ? 'selected' : ''}>Processing</option>
                                <option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>Shipped</option>
                                <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Delivered</option>
                                <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                            </select>
                        </td>
                        <td class="py-4 text-gray-400">${new Date(order.created_at).toLocaleDateString()}</td>
                        <td class="py-4">
                            <button class="text-soft-blue hover:underline view-btn" data-id="${order.id}">View</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function setupEventListeners() {
    // Status filter
    document.getElementById('status-filter').addEventListener('change', (e) => {
        loadOrders(e.target.value);
    });

    // Close modal
    document.getElementById('close-modal').addEventListener('click', closeModal);
    document.getElementById('modal-overlay').addEventListener('click', closeModal);

    // Table interactions
    document.getElementById('orders-list').addEventListener('click', (e) => {
        const viewBtn = e.target.closest('.view-btn');
        if (viewBtn) {
            const order = orders.find(o => o.id === parseInt(viewBtn.dataset.id));
            if (order) showOrderDetail(order);
        }
    });

    document.getElementById('orders-list').addEventListener('change', async (e) => {
        const statusSelect = e.target.closest('.status-select');
        if (statusSelect) {
            const id = parseInt(statusSelect.dataset.id);
            const newStatus = statusSelect.value;
            await updateOrderStatus(id, newStatus);
        }
    });
}

async function updateOrderStatus(id, status) {
    try {
        const response = await adminFetch('/api/admin-orders', {
            method: 'PUT',
            body: JSON.stringify({ id, status })
        });

        if (!response || !response.ok) {
            throw new Error('Failed to update status');
        }

        // Update local data
        const order = orders.find(o => o.id === id);
        if (order) order.status = status;

    } catch (error) {
        alert(error.message);
        await loadOrders();
    }
}

function showOrderDetail(order) {
    const address = order.shipping_address || {};

    document.getElementById('order-details').innerHTML = `
        <div class="space-y-6">
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <h3 class="text-sm text-gray-400 mb-1">Order Number</h3>
                    <p class="font-mono">${order.order_number}</p>
                </div>
                <div>
                    <h3 class="text-sm text-gray-400 mb-1">Date</h3>
                    <p>${new Date(order.created_at).toLocaleString()}</p>
                </div>
                <div>
                    <h3 class="text-sm text-gray-400 mb-1">Status</h3>
                    <span class="px-2 py-1 rounded-full text-xs ${statusColors[order.status] || 'bg-gray-500/20 text-gray-400'}">${order.status}</span>
                </div>
                <div>
                    <h3 class="text-sm text-gray-400 mb-1">Payment Method</h3>
                    <p>${order.payment_method || 'N/A'}</p>
                </div>
            </div>

            <div class="border-t border-white/10 pt-6">
                <h3 class="font-semibold mb-4">Customer Information</h3>
                <div class="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <p class="text-gray-400">Name</p>
                        <p>${escapeHtml(order.customer_name) || 'N/A'}</p>
                    </div>
                    <div>
                        <p class="text-gray-400">Email</p>
                        <p>${escapeHtml(order.customer_email) || 'N/A'}</p>
                    </div>
                    <div>
                        <p class="text-gray-400">Phone</p>
                        <p>${escapeHtml(order.customer_phone) || 'N/A'}</p>
                    </div>
                    <div>
                        <p class="text-gray-400">Address</p>
                        <p>${escapeHtml(address.line1) || ''}</p>
                        ${address.line2 ? `<p>${escapeHtml(address.line2)}</p>` : ''}
                        <p>${escapeHtml(address.city) || ''} ${escapeHtml(address.postal_code) || ''}</p>
                    </div>
                </div>
            </div>

            <div class="border-t border-white/10 pt-6">
                <h3 class="font-semibold mb-4">Order Items</h3>
                <div class="space-y-3">
                    ${(order.items || []).map(item => `
                        <div class="flex items-center justify-between py-2 border-b border-white/5">
                            <div>
                                <p>${escapeHtml(item.title)}</p>
                                ${item.variation ? `<p class="text-xs text-gray-500">${escapeHtml(item.variation)}</p>` : ''}
                            </div>
                            <div class="text-right">
                                <p>x${item.quantity}</p>
                                <p class="text-soft-blue">£${(item.price || 0).toFixed(2)}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="border-t border-white/10 pt-6">
                <div class="flex justify-between mb-2">
                    <span class="text-gray-400">Subtotal</span>
                    <span>£${(order.subtotal || 0).toFixed(2)}</span>
                </div>
                <div class="flex justify-between mb-2">
                    <span class="text-gray-400">Shipping</span>
                    <span>${order.shipping === 0 ? 'FREE' : `£${(order.shipping || 0).toFixed(2)}`}</span>
                </div>
                <div class="flex justify-between font-semibold text-lg">
                    <span>Total</span>
                    <span class="text-soft-blue">£${(order.total || 0).toFixed(2)}</span>
                </div>
            </div>

            ${order.notes ? `
                <div class="border-t border-white/10 pt-6">
                    <h3 class="font-semibold mb-2">Notes</h3>
                    <p class="text-sm text-gray-400">${escapeHtml(order.notes)}</p>
                </div>
            ` : ''}
        </div>
    `;

    document.getElementById('order-modal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('order-modal').classList.add('hidden');
}
