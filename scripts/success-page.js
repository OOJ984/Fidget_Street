/**
 * Success Page Functionality
 * Handles order confirmation display after payment
 */

document.addEventListener('DOMContentLoaded', async () => {
    // Clear the cart after successful order
    clearCart();

    // Get order number from URL
    const params = new URLSearchParams(window.location.search);
    const orderNumber = params.get('order');
    const sessionId = params.get('session_id');

    if (orderNumber) {
        document.getElementById('order-number').textContent = orderNumber;
    } else if (sessionId) {
        // For Stripe, look up the order by session_id
        document.getElementById('order-number').textContent = 'Processing...';

        try {
            // Fetch order from API using session_id
            const response = await fetch(`/api/orders?session_id=${encodeURIComponent(sessionId)}`);

            if (response.ok) {
                const order = await response.json();
                document.getElementById('order-number').textContent = order.order_number;
            } else {
                // Order might still be processing via webhook, retry after delay
                await new Promise(resolve => setTimeout(resolve, 2000));
                const retryResponse = await fetch(`/api/orders?session_id=${encodeURIComponent(sessionId)}`);

                if (retryResponse.ok) {
                    const order = await retryResponse.json();
                    document.getElementById('order-number').textContent = order.order_number;
                } else {
                    // Show confirmed but order number unavailable
                    document.getElementById('order-number').textContent = 'Confirmed';
                }
            }
        } catch (error) {
            console.error('Error fetching order:', error);
            document.getElementById('order-number').textContent = 'Confirmed';
        }
    } else {
        document.getElementById('order-number').textContent = 'Confirmed';
    }

    // Clear session storage
    sessionStorage.removeItem('pending_cart');
    sessionStorage.removeItem('pending_customer');
});
