/**
 * Input Validation Utilities
 *
 * Server-side validation for API endpoints.
 * All user input must be validated before processing.
 */

// Email validation regex (RFC 5322 simplified)
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

// Phone validation - UK format or international (E.164)
// Accepts: +44..., 07..., 01..., 02..., with optional spaces/dashes
const PHONE_REGEX = /^(?:\+?44|0)[\s.-]?(?:\d[\s.-]?){9,10}$/;

// Order number format: FS-YYYYMMDD-XXXX (Fidget Street)
const ORDER_NUMBER_REGEX = /^FS-\d{8}-\d{4}$/;

// Limits
const MAX_QUANTITY_PER_ITEM = 99;
const MAX_ITEMS_PER_ORDER = 50;
const MAX_STRING_LENGTH = 500;
const MAX_EMAIL_LENGTH = 254;
const MAX_NAME_LENGTH = 100;
const MAX_PHONE_LENGTH = 20;
const MIN_ITEM_PRICE = 0.01;
const MAX_ITEM_PRICE = 10000;

/**
 * Validate email format
 * @param {string} email
 * @returns {{ valid: boolean, error?: string }}
 */
function validateEmail(email) {
    if (!email || typeof email !== 'string') {
        return { valid: false, error: 'Email is required' };
    }

    const trimmed = email.trim();

    if (trimmed.length > MAX_EMAIL_LENGTH) {
        return { valid: false, error: 'Email address is too long' };
    }

    if (!EMAIL_REGEX.test(trimmed)) {
        return { valid: false, error: 'Invalid email format' };
    }

    return { valid: true };
}

/**
 * Validate UK phone number (optional field)
 * @param {string} phone
 * @returns {{ valid: boolean, error?: string }}
 */
function validatePhone(phone) {
    // Phone is optional
    if (!phone || phone.trim() === '') {
        return { valid: true };
    }

    if (typeof phone !== 'string') {
        return { valid: false, error: 'Invalid phone format' };
    }

    const trimmed = phone.trim();

    if (trimmed.length > MAX_PHONE_LENGTH) {
        return { valid: false, error: 'Phone number is too long' };
    }

    // Remove spaces, dashes, dots for validation
    const normalized = trimmed.replace(/[\s.-]/g, '');

    if (!/^\+?\d{10,14}$/.test(normalized)) {
        return { valid: false, error: 'Invalid phone number format' };
    }

    return { valid: true };
}

/**
 * Validate customer name
 * @param {string} name
 * @returns {{ valid: boolean, error?: string }}
 */
function validateName(name) {
    if (!name || typeof name !== 'string') {
        return { valid: false, error: 'Name is required' };
    }

    const trimmed = name.trim();

    if (trimmed.length === 0) {
        return { valid: false, error: 'Name is required' };
    }

    if (trimmed.length > MAX_NAME_LENGTH) {
        return { valid: false, error: 'Name is too long' };
    }

    // Basic XSS prevention - no HTML tags
    if (/<[^>]*>/.test(trimmed)) {
        return { valid: false, error: 'Name contains invalid characters' };
    }

    return { valid: true };
}

/**
 * Validate order items array
 * @param {Array} items
 * @returns {{ valid: boolean, error?: string }}
 */
function validateOrderItems(items) {
    if (!Array.isArray(items)) {
        return { valid: false, error: 'Items must be an array' };
    }

    if (items.length === 0) {
        return { valid: false, error: 'Order must contain at least one item' };
    }

    if (items.length > MAX_ITEMS_PER_ORDER) {
        return { valid: false, error: `Order cannot contain more than ${MAX_ITEMS_PER_ORDER} items` };
    }

    for (let i = 0; i < items.length; i++) {
        const item = items[i];

        // Validate quantity
        if (!Number.isInteger(item.quantity) || item.quantity < 1) {
            return { valid: false, error: `Item ${i + 1}: quantity must be a positive integer` };
        }

        if (item.quantity > MAX_QUANTITY_PER_ITEM) {
            return { valid: false, error: `Item ${i + 1}: quantity cannot exceed ${MAX_QUANTITY_PER_ITEM}` };
        }

        // Validate price
        if (typeof item.price !== 'number' || isNaN(item.price)) {
            return { valid: false, error: `Item ${i + 1}: price must be a number` };
        }

        if (item.price < MIN_ITEM_PRICE || item.price > MAX_ITEM_PRICE) {
            return { valid: false, error: `Item ${i + 1}: invalid price` };
        }

        // Validate product ID exists
        if (!item.id && !item.product_id) {
            return { valid: false, error: `Item ${i + 1}: product ID is required` };
        }
    }

    return { valid: true };
}

/**
 * Validate shipping address
 * @param {object} address
 * @returns {{ valid: boolean, error?: string }}
 */
function validateShippingAddress(address) {
    if (!address || typeof address !== 'object') {
        return { valid: false, error: 'Shipping address is required' };
    }

    const requiredFields = ['line1', 'city', 'postcode', 'country'];

    for (const field of requiredFields) {
        if (!address[field] || typeof address[field] !== 'string' || address[field].trim() === '') {
            return { valid: false, error: `Shipping address: ${field} is required` };
        }
    }

    // Validate field lengths
    const fieldLimits = {
        line1: 200,
        line2: 200,
        city: 100,
        county: 100,
        postcode: 20,
        country: 100
    };

    for (const [field, maxLength] of Object.entries(fieldLimits)) {
        if (address[field] && address[field].length > maxLength) {
            return { valid: false, error: `Shipping address: ${field} is too long` };
        }
    }

    // Basic XSS prevention
    for (const field of Object.keys(address)) {
        if (typeof address[field] === 'string' && /<[^>]*>/.test(address[field])) {
            return { valid: false, error: `Shipping address: ${field} contains invalid characters` };
        }
    }

    return { valid: true };
}

/**
 * Validate order number format
 * @param {string} orderNumber
 * @returns {{ valid: boolean, error?: string }}
 */
function validateOrderNumber(orderNumber) {
    if (!orderNumber || typeof orderNumber !== 'string') {
        return { valid: false, error: 'Order number is required' };
    }

    if (!ORDER_NUMBER_REGEX.test(orderNumber)) {
        return { valid: false, error: 'Invalid order number format' };
    }

    return { valid: true };
}

/**
 * Sanitize string input (trim and limit length)
 * @param {string} str
 * @param {number} maxLength
 * @returns {string}
 */
function sanitizeString(str, maxLength = MAX_STRING_LENGTH) {
    if (!str || typeof str !== 'string') return '';
    return str.trim().substring(0, maxLength);
}

module.exports = {
    validateEmail,
    validatePhone,
    validateName,
    validateOrderItems,
    validateShippingAddress,
    validateOrderNumber,
    sanitizeString,
    // Export limits for testing
    MAX_QUANTITY_PER_ITEM,
    MAX_ITEMS_PER_ORDER,
    MAX_STRING_LENGTH
};
