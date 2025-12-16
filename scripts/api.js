/**
 * Wicka - API Client
 * Handles communication with backend API
 * Falls back to static JSON for local development
 */

const API_BASE = '/api';

// Detect if we're running locally without Netlify functions
const isLocalDev = window.location.hostname === 'localhost' ||
                   window.location.hostname === '127.0.0.1' ||
                   window.location.protocol === 'file:';

// Products cache to avoid duplicate fetches
let productsCache = null;
let productsCachePromise = null;

/**
 * Fetch products from API or fallback to JSON
 * @param {Object} options - Query options
 * @param {string} options.slug - Get single product by slug
 * @param {string} options.category - Filter by category
 * @param {string} options.tag - Filter by tag
 * @param {boolean} options.featured - Get featured products only
 * @param {number} options.limit - Limit results
 * @returns {Promise<Array|Object>} Products array or single product
 */
async function fetchProducts(options = {}) {
    try {
        let products;

        // Use cache for unfiltered requests (most common case)
        const needsFullList = !options.slug || options.category || options.tag || options.featured;

        if (needsFullList && productsCache) {
            products = productsCache;
        } else if (needsFullList && productsCachePromise) {
            // Another fetch is in progress, wait for it
            products = await productsCachePromise;
        } else {
            // Fetch from API
            const fetchPromise = fetch('/api/products').then(r => r.json());

            if (needsFullList) {
                productsCachePromise = fetchPromise;
                products = await fetchPromise;
                productsCache = products;
                productsCachePromise = null;
            } else {
                products = await fetchPromise;
            }
        }

        // Apply filters
        if (options.slug) {
            return products.find(p => p.slug === options.slug) || null;
        }

        let filtered = [...products];
        if (options.category) {
            filtered = filtered.filter(p => p.category === options.category);
        }
        if (options.tag) {
            filtered = filtered.filter(p => p.tags && p.tags.includes(options.tag));
        }
        if (options.featured) {
            filtered = filtered.filter(p => p.tags && p.tags.includes('featured'));
        }
        if (options.limit) {
            filtered = filtered.slice(0, options.limit);
        }

        return filtered;

    } catch (error) {
        console.error('Error fetching products:', error);
        return [];
    }
}

/**
 * Create a new order
 * @param {Object} orderData - Order details
 * @returns {Promise<Object>} Order confirmation
 */
async function createOrder(orderData) {
    try {
        const response = await fetch(`${API_BASE}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(orderData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create order');
        }

        return await response.json();

    } catch (error) {
        console.error('Error creating order:', error);
        throw error;
    }
}

/**
 * Get order status
 * @param {string} orderNumber - Order number (PP-YYYYMMDD-XXXX)
 * @returns {Promise<Object>} Order details
 */
async function getOrderStatus(orderNumber) {
    try {
        const response = await fetch(`${API_BASE}/orders?order_number=${encodeURIComponent(orderNumber)}`);

        if (!response.ok) {
            throw new Error('Order not found');
        }

        return await response.json();

    } catch (error) {
        console.error('Error fetching order:', error);
        throw error;
    }
}

/**
 * Create checkout session (Stripe or PayPal)
 * @param {Object} data - Cart items and payment method
 * @returns {Promise<Object>} Checkout URL or session info
 */
async function createCheckout(data) {
    try {
        const endpoint = data.payment_method === 'paypal'
            ? `${API_BASE}/paypal-checkout`
            : `${API_BASE}/stripe-checkout`;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Checkout failed');
        }

        return await response.json();

    } catch (error) {
        console.error('Checkout error:', error);
        throw error;
    }
}

// Make functions globally available
window.API = {
    fetchProducts,
    createOrder,
    getOrderStatus,
    createCheckout
};
