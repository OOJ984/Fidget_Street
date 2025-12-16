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
        // For Stripe, we might need to look up the order
        document.getElementById('order-number').textContent = 'Processing...';

        // Try to get order details from session storage
        try {
            // Order was created via webhook, show generic success
            document.getElementById('order-number').textContent = 'Confirmed';
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
