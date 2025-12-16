/**
 * Admin Dashboard Page
 * Shows stats and recent orders
 */

document.addEventListener('DOMContentLoaded', async () => {
    // Check auth
    const user = await requireAuth();
    if (!user) return;

    document.getElementById('user-name').textContent = user.name || user.email;

    // Setup logout
    document.getElementById('logout-btn').addEventListener('click', logout);

    // Load dashboard data
    await loadDashboard();
});

async function loadDashboard() {
    const token = localStorage.getItem('admin_token');

    try {
        // Fetch stats - in a real app, create a dedicated stats endpoint
        // For now, we'll fetch products and orders directly
        const [productsRes, ordersRes] = await Promise.all([
            fetch('/api/products'),
            fetch('/api/admin-orders', {
                headers: { 'Authorization': `Bearer ${token}` }
            }).catch(() => ({ ok: false }))
        ]);

        // Products
        if (productsRes.ok) {
            const products = await productsRes.json();
            document.getElementById('stat-products').textContent = products.length;
        }

        // Orders (if endpoint exists)
        if (ordersRes.ok) {
            const orders = await ordersRes.json();
            const totalOrders = orders.length;
            const revenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
            const pending = orders.filter(o => o.status === 'pending' || o.status === 'paid').length;

            document.getElementById('stat-orders').textContent = totalOrders;
            document.getElementById('stat-revenue').textContent = `£${revenue.toFixed(2)}`;
            document.getElementById('stat-pending').textContent = pending;

            // Recent orders
            renderRecentOrders(orders.slice(0, 5));
        } else {
            // Fallback - show placeholder
            document.getElementById('stat-orders').textContent = '0';
            document.getElementById('stat-revenue').textContent = '£0.00';
            document.getElementById('stat-pending').textContent = '0';
            document.getElementById('recent-orders').innerHTML = '<p class="text-gray-400 text-center py-8">No orders yet</p>';
        }

    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

function renderRecentOrders(orders) {
    if (orders.length === 0) {
        document.getElementById('recent-orders').innerHTML = '<p class="text-gray-400 text-center py-8">No orders yet</p>';
        return;
    }

    const statusColors = {
        pending: 'bg-yellow-500/20 text-yellow-400',
        paid: 'bg-blue-500/20 text-blue-400',
        processing: 'bg-purple-500/20 text-purple-400',
        shipped: 'bg-green-500/20 text-green-400',
        delivered: 'bg-green-600/20 text-green-300',
        cancelled: 'bg-red-500/20 text-red-400'
    };

    document.getElementById('recent-orders').innerHTML = `
        <table class="w-full">
            <thead>
                <tr class="text-left text-sm text-gray-400">
                    <th class="pb-4 font-medium">Order</th>
                    <th class="pb-4 font-medium">Customer</th>
                    <th class="pb-4 font-medium">Total</th>
                    <th class="pb-4 font-medium">Status</th>
                    <th class="pb-4 font-medium">Date</th>
                </tr>
            </thead>
            <tbody class="text-sm">
                ${orders.map(order => `
                    <tr class="border-t border-white/10">
                        <td class="py-4 font-mono">${order.order_number}</td>
                        <td class="py-4">${order.customer_name || 'Unknown'}</td>
                        <td class="py-4">£${(order.total || 0).toFixed(2)}</td>
                        <td class="py-4">
                            <span class="px-2 py-1 rounded-full text-xs ${statusColors[order.status] || 'bg-gray-500/20 text-gray-400'}">
                                ${order.status}
                            </span>
                        </td>
                        <td class="py-4 text-gray-400">${new Date(order.created_at).toLocaleDateString()}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}
