/**
 * Order Utilities
 * Shared functions for order processing
 */

/**
 * Generate unique order number
 * Format: FS-YYYYMMDD-XXXX (e.g., FS-20251221-4829)
 * @returns {string}
 */
function generateOrderNumber() {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `FS-${date}-${random}`;
}

/**
 * Calculate order totals
 * @param {Array} items - Cart items with price and quantity
 * @param {number} freeShippingThreshold - Minimum for free shipping (default: 20)
 * @param {number} shippingCost - Shipping cost if below threshold (default: 2.99)
 * @returns {{ subtotal: number, shipping: number, total: number }}
 */
function calculateOrderTotals(items, freeShippingThreshold = 20, shippingCost = 2.99) {
    const subtotal = items.reduce((sum, item) => {
        return sum + (item.price * item.quantity);
    }, 0);
    const shipping = subtotal >= freeShippingThreshold ? 0 : shippingCost;
    const total = subtotal + shipping;

    return { subtotal, shipping, total };
}

module.exports = {
    generateOrderNumber,
    calculateOrderTotals
};
