/**
 * Crypto Utility Tests
 *
 * Tests for PII encryption/decryption functions.
 * These are CRITICAL tests - encryption failures can expose customer PII.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Store original env
const originalEnv = { ...process.env };

describe('crypto.js', () => {
    let crypto;

    beforeEach(() => {
        // Reset modules to pick up fresh env vars
        vi.resetModules();
        // Set valid encryption key
        process.env.ENCRYPTION_KEY = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
    });

    afterEach(() => {
        // Restore original env
        process.env = { ...originalEnv };
    });

    describe('encrypt()', () => {
        it('should encrypt plaintext and return encrypted format', async () => {
            crypto = await import('../../../netlify/functions/utils/crypto.js');

            const plaintext = 'sensitive customer data';
            const encrypted = crypto.encrypt(plaintext);

            expect(encrypted).not.toBe(plaintext);
            expect(encrypted).toContain(':'); // Format: iv:authTag:ciphertext
            expect(encrypted.split(':').length).toBe(3);
        });

        it('should return different ciphertext for same plaintext (random IV)', async () => {
            crypto = await import('../../../netlify/functions/utils/crypto.js');

            const plaintext = 'test data';
            const encrypted1 = crypto.encrypt(plaintext);
            const encrypted2 = crypto.encrypt(plaintext);

            // IVs should be different, so entire encrypted strings differ
            expect(encrypted1).not.toBe(encrypted2);
        });

        it('should return original value if plaintext is null or undefined', async () => {
            crypto = await import('../../../netlify/functions/utils/crypto.js');

            expect(crypto.encrypt(null)).toBeNull();
            expect(crypto.encrypt(undefined)).toBeUndefined();
            expect(crypto.encrypt('')).toBe('');
        });

        it('should return plaintext if encryption key not configured', async () => {
            delete process.env.ENCRYPTION_KEY;
            crypto = await import('../../../netlify/functions/utils/crypto.js');

            const plaintext = 'unprotected data';
            const result = crypto.encrypt(plaintext);

            expect(result).toBe(plaintext);
        });

        it('should return plaintext if encryption key is wrong length', async () => {
            process.env.ENCRYPTION_KEY = 'tooshort';
            crypto = await import('../../../netlify/functions/utils/crypto.js');

            const plaintext = 'test data';
            const result = crypto.encrypt(plaintext);

            expect(result).toBe(plaintext);
        });

        it('should handle unicode characters correctly', async () => {
            crypto = await import('../../../netlify/functions/utils/crypto.js');

            const plaintext = 'Test with émojis 🎉 and ñ characters';
            const encrypted = crypto.encrypt(plaintext);
            const decrypted = crypto.decrypt(encrypted);

            expect(decrypted).toBe(plaintext);
        });

        it('should handle very long strings', async () => {
            crypto = await import('../../../netlify/functions/utils/crypto.js');

            const plaintext = 'x'.repeat(10000);
            const encrypted = crypto.encrypt(plaintext);
            const decrypted = crypto.decrypt(encrypted);

            expect(decrypted).toBe(plaintext);
        });
    });

    describe('decrypt()', () => {
        it('should decrypt encrypted text back to original', async () => {
            crypto = await import('../../../netlify/functions/utils/crypto.js');

            const plaintext = 'My secret address: 123 Main St';
            const encrypted = crypto.encrypt(plaintext);
            const decrypted = crypto.decrypt(encrypted);

            expect(decrypted).toBe(plaintext);
        });

        it('should return original if text is not in encrypted format', async () => {
            crypto = await import('../../../netlify/functions/utils/crypto.js');

            const plaintext = 'not encrypted text without colons';
            const result = crypto.decrypt(plaintext);

            expect(result).toBe(plaintext);
        });

        it('should return original if text has only one colon', async () => {
            crypto = await import('../../../netlify/functions/utils/crypto.js');

            const text = 'only:one:separator:actually:three';
            const result = crypto.decrypt(text);

            // Has more than 3 parts when split by ':'
            expect(result).toBe(text);
        });

        it('should return null/undefined for null/undefined input', async () => {
            crypto = await import('../../../netlify/functions/utils/crypto.js');

            expect(crypto.decrypt(null)).toBeNull();
            expect(crypto.decrypt(undefined)).toBeUndefined();
            expect(crypto.decrypt('')).toBe('');
        });

        it('should return encrypted text if key not available', async () => {
            crypto = await import('../../../netlify/functions/utils/crypto.js');

            const plaintext = 'secret';
            const encrypted = crypto.encrypt(plaintext);

            // Remove key and re-import
            delete process.env.ENCRYPTION_KEY;
            vi.resetModules();
            const cryptoNoKey = await import('../../../netlify/functions/utils/crypto.js');

            const result = cryptoNoKey.decrypt(encrypted);
            expect(result).toBe(encrypted);
        });

        it('should return original on tampered ciphertext (authentication failure)', async () => {
            crypto = await import('../../../netlify/functions/utils/crypto.js');

            const encrypted = crypto.encrypt('secret data');
            // Tamper with the ciphertext portion
            const parts = encrypted.split(':');
            parts[2] = 'TAMPERED' + parts[2].substring(8);
            const tampered = parts.join(':');

            const result = crypto.decrypt(tampered);
            // Should return tampered string (decryption fails)
            expect(result).toBe(tampered);
        });

        it('should return original on tampered auth tag', async () => {
            crypto = await import('../../../netlify/functions/utils/crypto.js');

            const encrypted = crypto.encrypt('secret data');
            const parts = encrypted.split(':');
            // Tamper with auth tag
            parts[1] = 'AAAAAAAAAAAAAAAAAAAAAA==';
            const tampered = parts.join(':');

            const result = crypto.decrypt(tampered);
            expect(result).toBe(tampered);
        });
    });

    describe('encryptOrderPII()', () => {
        it('should encrypt phone and address fields', async () => {
            crypto = await import('../../../netlify/functions/utils/crypto.js');

            const order = {
                id: 1,
                customer_email: 'test@example.com',
                customer_name: 'John Doe',
                customer_phone: '07123456789',
                shipping_address: {
                    line1: '123 Main St',
                    city: 'London',
                    postcode: 'SW1A 1AA'
                },
                total: 29.99
            };

            const encrypted = crypto.encryptOrderPII(order);

            // Email and name should NOT be encrypted
            expect(encrypted.customer_email).toBe('test@example.com');
            expect(encrypted.customer_name).toBe('John Doe');
            expect(encrypted.total).toBe(29.99);

            // Phone and address SHOULD be encrypted
            expect(encrypted.customer_phone).not.toBe('07123456789');
            expect(encrypted.customer_phone).toContain(':');
            expect(typeof encrypted.shipping_address).toBe('string');
            expect(encrypted.shipping_address).toContain(':');
        });

        it('should handle null order', async () => {
            crypto = await import('../../../netlify/functions/utils/crypto.js');

            expect(crypto.encryptOrderPII(null)).toBeNull();
            expect(crypto.encryptOrderPII(undefined)).toBeUndefined();
        });

        it('should handle order without sensitive fields', async () => {
            crypto = await import('../../../netlify/functions/utils/crypto.js');

            const order = {
                id: 1,
                customer_email: 'test@example.com',
                total: 10.00
            };

            const encrypted = crypto.encryptOrderPII(order);

            expect(encrypted.id).toBe(1);
            expect(encrypted.customer_email).toBe('test@example.com');
            expect(encrypted.total).toBe(10.00);
        });

        it('should not modify original order object', async () => {
            crypto = await import('../../../netlify/functions/utils/crypto.js');

            const order = {
                customer_phone: '07123456789'
            };

            crypto.encryptOrderPII(order);

            // Original should be unchanged
            expect(order.customer_phone).toBe('07123456789');
        });
    });

    describe('decryptOrderPII()', () => {
        it('should decrypt phone and address fields back to original', async () => {
            crypto = await import('../../../netlify/functions/utils/crypto.js');

            const order = {
                id: 1,
                customer_email: 'test@example.com',
                customer_phone: '07123456789',
                shipping_address: {
                    line1: '123 Main St',
                    city: 'London'
                }
            };

            const encrypted = crypto.encryptOrderPII(order);
            const decrypted = crypto.decryptOrderPII(encrypted);

            expect(decrypted.customer_email).toBe('test@example.com');
            expect(decrypted.customer_phone).toBe('07123456789');
            expect(decrypted.shipping_address).toEqual({
                line1: '123 Main St',
                city: 'London'
            });
        });

        it('should handle already-decrypted orders gracefully', async () => {
            crypto = await import('../../../netlify/functions/utils/crypto.js');

            const order = {
                customer_phone: '07123456789',
                shipping_address: { line1: '123 Main St' }
            };

            // Decrypting unencrypted data should not break
            const result = crypto.decryptOrderPII(order);

            expect(result.customer_phone).toBe('07123456789');
            // shipping_address is already an object, not string, so unchanged
            expect(result.shipping_address).toEqual({ line1: '123 Main St' });
        });
    });

    describe('decryptOrders()', () => {
        it('should decrypt array of orders', async () => {
            crypto = await import('../../../netlify/functions/utils/crypto.js');

            const orders = [
                { id: 1, customer_phone: '111' },
                { id: 2, customer_phone: '222' }
            ].map(o => crypto.encryptOrderPII(o));

            const decrypted = crypto.decryptOrders(orders);

            expect(decrypted[0].customer_phone).toBe('111');
            expect(decrypted[1].customer_phone).toBe('222');
        });

        it('should return non-array input unchanged', async () => {
            crypto = await import('../../../netlify/functions/utils/crypto.js');

            expect(crypto.decryptOrders(null)).toBeNull();
            expect(crypto.decryptOrders('not an array')).toBe('not an array');
        });
    });

    describe('isEncryptionEnabled()', () => {
        it('should return true when valid key is set', async () => {
            crypto = await import('../../../netlify/functions/utils/crypto.js');
            expect(crypto.isEncryptionEnabled()).toBe(true);
        });

        it('should return false when key not set', async () => {
            delete process.env.ENCRYPTION_KEY;
            vi.resetModules();
            crypto = await import('../../../netlify/functions/utils/crypto.js');

            expect(crypto.isEncryptionEnabled()).toBe(false);
        });
    });

    describe('generateEncryptionKey()', () => {
        it('should generate a 64 character hex string', async () => {
            crypto = await import('../../../netlify/functions/utils/crypto.js');

            const key = crypto.generateEncryptionKey();

            expect(key).toHaveLength(64);
            expect(/^[0-9a-f]{64}$/.test(key)).toBe(true);
        });

        it('should generate unique keys each time', async () => {
            crypto = await import('../../../netlify/functions/utils/crypto.js');

            const key1 = crypto.generateEncryptionKey();
            const key2 = crypto.generateEncryptionKey();

            expect(key1).not.toBe(key2);
        });
    });
});
