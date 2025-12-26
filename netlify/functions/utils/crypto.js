/**
 * PII Encryption Utilities
 *
 * Provides AES-256-GCM encryption for sensitive customer data.
 * Requires ENCRYPTION_KEY environment variable (32-byte hex string).
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// Check if running in production
function isProduction() {
    return process.env.NODE_ENV === 'production' ||
           process.env.CONTEXT === 'production' ||  // Netlify production context
           (process.env.URL && !process.env.URL.includes('localhost'));
}

// Get encryption key from environment
function getEncryptionKey() {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
        // SECURITY: In production, encryption is mandatory
        if (isProduction()) {
            throw new Error('ENCRYPTION_KEY is required in production. PII cannot be stored without encryption.');
        }
        console.warn('ENCRYPTION_KEY not set - PII encryption disabled (development only)');
        return null;
    }
    // Key should be 32 bytes (64 hex characters)
    if (key.length !== 64) {
        console.error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
        if (isProduction()) {
            throw new Error('Invalid ENCRYPTION_KEY length. Must be 64 hex characters.');
        }
        return null;
    }
    return Buffer.from(key, 'hex');
}

/**
 * Encrypt a string value
 * @param {string} plaintext - The text to encrypt
 * @returns {string|null} Encrypted string (iv:authTag:ciphertext in base64) or null if encryption disabled
 */
function encrypt(plaintext) {
    if (!plaintext) return plaintext;

    const key = getEncryptionKey();
    if (!key) return plaintext; // Return unencrypted if no key

    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

        let encrypted = cipher.update(plaintext, 'utf8', 'base64');
        encrypted += cipher.final('base64');

        const authTag = cipher.getAuthTag();

        // Format: iv:authTag:ciphertext (all base64)
        return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
    } catch (error) {
        console.error('Encryption error:', error);
        return plaintext; // Fallback to unencrypted
    }
}

/**
 * Decrypt a string value
 * @param {string} encryptedText - The encrypted text (iv:authTag:ciphertext format)
 * @returns {string} Decrypted string or original if not encrypted/decryption fails
 */
function decrypt(encryptedText) {
    if (!encryptedText) return encryptedText;

    // Check if it's in encrypted format (contains two colons)
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
        return encryptedText; // Not encrypted, return as-is
    }

    const key = getEncryptionKey();
    if (!key) return encryptedText; // Can't decrypt without key

    try {
        const [ivBase64, authTagBase64, ciphertext] = parts;
        const iv = Buffer.from(ivBase64, 'base64');
        const authTag = Buffer.from(authTagBase64, 'base64');

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        console.error('Decryption error:', error);
        return encryptedText; // Return as-is if decryption fails
    }
}

/**
 * Encrypt PII fields in an order object
 *
 * Note: We encrypt phone and address (highly sensitive) but NOT email
 * because email is needed for order lookups and customer authentication.
 *
 * @param {object} order - Order object with PII fields
 * @returns {object} Order with encrypted PII fields
 */
function encryptOrderPII(order) {
    if (!order) return order;

    const encrypted = { ...order };

    // DO NOT encrypt email - it's needed for lookups and customer auth
    // DO NOT encrypt name - it's commonly displayed and searched

    // Encrypt highly sensitive fields only
    if (encrypted.customer_phone) {
        encrypted.customer_phone = encrypt(encrypted.customer_phone);
    }
    if (encrypted.shipping_address && typeof encrypted.shipping_address === 'object') {
        // Only stringify if encryption is enabled, otherwise keep as object for JSONB
        if (isEncryptionEnabled()) {
            encrypted.shipping_address = encrypt(JSON.stringify(encrypted.shipping_address));
        }
        // If no encryption, leave as object - Supabase will store as JSONB
    }

    return encrypted;
}

/**
 * Decrypt PII fields in an order object
 * @param {object} order - Order object with encrypted PII fields
 * @returns {object} Order with decrypted PII fields
 */
function decryptOrderPII(order) {
    if (!order) return order;

    const decrypted = { ...order };

    // Decrypt sensitive fields (phone and address only)
    if (decrypted.customer_phone) {
        decrypted.customer_phone = decrypt(decrypted.customer_phone);
    }
    if (decrypted.shipping_address && typeof decrypted.shipping_address === 'string') {
        const addressStr = decrypt(decrypted.shipping_address);
        // Try to parse as JSON, fallback to original if not JSON
        try {
            decrypted.shipping_address = JSON.parse(addressStr);
        } catch {
            decrypted.shipping_address = addressStr;
        }
    }

    return decrypted;
}

/**
 * Decrypt an array of orders
 * @param {object[]} orders - Array of order objects
 * @returns {object[]} Array of orders with decrypted PII
 */
function decryptOrders(orders) {
    if (!Array.isArray(orders)) return orders;
    return orders.map(decryptOrderPII);
}

/**
 * Check if encryption is enabled
 * @returns {boolean}
 */
function isEncryptionEnabled() {
    return !!getEncryptionKey();
}

/**
 * Generate a new encryption key (for setup)
 * @returns {string} 64 hex character key
 */
function generateEncryptionKey() {
    return crypto.randomBytes(32).toString('hex');
}

module.exports = {
    encrypt,
    decrypt,
    encryptOrderPII,
    decryptOrderPII,
    decryptOrders,
    isEncryptionEnabled,
    generateEncryptionKey
};
