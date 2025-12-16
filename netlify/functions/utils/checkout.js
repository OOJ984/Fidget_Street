/**
 * Checkout Utilities
 *
 * Shared utilities for payment checkout endpoints.
 * Handles price verification and cart validation.
 */

const { createClient } = require('@supabase/supabase-js');

// Shipping configuration
const SHIPPING_CONFIG = {
    FREE_THRESHOLD_GBP: 20,
    FREE_THRESHOLD_PENCE: 2000,
    STANDARD_COST_GBP: 2.99,
    STANDARD_COST_PENCE: 299
};

/**
 * Get Supabase client
 */
function getSupabase() {
    return createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
    );
}

/**
 * Verify cart items against database prices
 * Returns verified items with database prices, or null if verification fails
 *
 * @param {Array} items - Cart items from client
 * @returns {Promise<{valid: boolean, items?: Array, error?: string}>}
 */
async function verifyCartPrices(items) {
    if (!items || !Array.isArray(items) || items.length === 0) {
        return { valid: false, error: 'No items provided' };
    }

    const supabase = getSupabase();

    // Get all product IDs from cart
    const productIds = items.map(item => item.id).filter(Boolean);

    if (productIds.length === 0) {
        return { valid: false, error: 'Invalid item IDs' };
    }

    // Fetch products from database
    const { data: products, error } = await supabase
        .from('products')
        .select('id, title, price_gbp, stock, is_active')
        .in('id', productIds)
        .eq('is_active', true);

    if (error) {
        console.error('Database error during price verification:', error);
        return { valid: false, error: 'Unable to verify prices' };
    }

    // Create lookup map
    const productMap = new Map(products.map(p => [p.id, p]));

    // Verify each item
    const verifiedItems = [];
    for (const item of items) {
        const dbProduct = productMap.get(item.id);

        if (!dbProduct) {
            return { valid: false, error: `Product not found: ${item.title || item.id}` };
        }

        // Check stock
        if (dbProduct.stock < item.quantity) {
            return { valid: false, error: `Insufficient stock for ${dbProduct.title}` };
        }

        // Use database price instead of client price
        verifiedItems.push({
            id: dbProduct.id,
            title: dbProduct.title,
            price: parseFloat(dbProduct.price_gbp),
            quantity: item.quantity,
            variation: item.variation || null
        });
    }

    return { valid: true, items: verifiedItems };
}

/**
 * Calculate shipping cost
 * @param {number} subtotal - Subtotal in GBP
 * @param {boolean} inPence - Return value in pence (for Stripe)
 * @returns {number}
 */
function calculateShipping(subtotal, inPence = false) {
    const threshold = inPence ? SHIPPING_CONFIG.FREE_THRESHOLD_PENCE : SHIPPING_CONFIG.FREE_THRESHOLD_GBP;
    const cost = inPence ? SHIPPING_CONFIG.STANDARD_COST_PENCE : SHIPPING_CONFIG.STANDARD_COST_GBP;

    return subtotal >= threshold ? 0 : cost;
}

/**
 * Calculate cart totals
 * @param {Array} items - Verified cart items
 * @returns {{subtotal: number, shipping: number, total: number}}
 */
function calculateTotals(items) {
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shipping = calculateShipping(subtotal);
    const total = subtotal + shipping;

    return { subtotal, shipping, total };
}

module.exports = {
    SHIPPING_CONFIG,
    verifyCartPrices,
    calculateShipping,
    calculateTotals
};
