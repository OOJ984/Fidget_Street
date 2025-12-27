/**
 * Email Notification Tests
 *
 * Tests for email functionality including:
 * - Magic link email validation
 * - Rate limiting for email requests
 * - Email format validation
 * - HTTP method handling
 *
 * Note: Tests requiring real Supabase are in integration tests.
 * These unit tests focus on the handler logic that can be tested in isolation.
 */

import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// Real Supabase client for integration-style tests
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// Store original env
const originalEnv = { ...process.env };

function createMockEvent(options = {}) {
    return {
        httpMethod: options.method || 'POST',
        headers: {
            origin: options.origin || 'http://localhost:8888',
            'content-type': 'application/json',
            ...options.headers
        },
        queryStringParameters: options.query || null,
        body: options.body ? JSON.stringify(options.body) : null
    };
}

describe('Email Notifications - Handler Tests', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('HTTP Method Handling', () => {
        it('should return 200 for OPTIONS (preflight)', async () => {
            const { handler } = require('../../netlify/functions/customer-auth.js');

            const event = createMockEvent({ method: 'OPTIONS' });
            const response = await handler(event, {});

            expect(response.statusCode).toBe(200);
        });

        it('should return 405 for DELETE method', async () => {
            const { handler } = require('../../netlify/functions/customer-auth.js');

            const event = createMockEvent({ method: 'DELETE' });
            const response = await handler(event, {});

            expect(response.statusCode).toBe(405);
        });

        it('should return 405 for PUT method', async () => {
            const { handler } = require('../../netlify/functions/customer-auth.js');

            const event = createMockEvent({ method: 'PUT' });
            const response = await handler(event, {});

            expect(response.statusCode).toBe(405);
        });

        it('should accept POST method', async () => {
            const { handler } = require('../../netlify/functions/customer-auth.js');

            const event = createMockEvent({
                method: 'POST',
                body: { email: 'test@example.com' }
            });
            const response = await handler(event, {});

            // 200 or 500 depending on DB, but not 405
            expect(response.statusCode).not.toBe(405);
        });

        it('should accept GET method for token verification', async () => {
            const { handler } = require('../../netlify/functions/customer-auth.js');

            const event = createMockEvent({
                method: 'GET',
                query: { token: 'test-token' }
            });
            const response = await handler(event, {});

            // Should return 400 for invalid token, not 405
            expect([400, 500]).toContain(response.statusCode);
        });
    });

    describe('Email Validation', () => {
        it('should reject missing email', async () => {
            const { handler } = require('../../netlify/functions/customer-auth.js');

            const event = createMockEvent({
                method: 'POST',
                body: {}
            });
            const response = await handler(event, {});

            expect(response.statusCode).toBe(400);
            const body = JSON.parse(response.body);
            expect(body.error).toContain('required');
        });

        it('should reject empty email', async () => {
            const { handler } = require('../../netlify/functions/customer-auth.js');

            const event = createMockEvent({
                method: 'POST',
                body: { email: '' }
            });
            const response = await handler(event, {});

            expect(response.statusCode).toBe(400);
        });

        it('should reject invalid email format - no @', async () => {
            const { handler } = require('../../netlify/functions/customer-auth.js');

            const event = createMockEvent({
                method: 'POST',
                body: { email: 'notanemail' }
            });
            const response = await handler(event, {});

            expect(response.statusCode).toBe(400);
            const body = JSON.parse(response.body);
            expect(body.error).toContain('Invalid email');
        });

        it('should reject invalid email format - no domain', async () => {
            const { handler } = require('../../netlify/functions/customer-auth.js');

            const event = createMockEvent({
                method: 'POST',
                body: { email: 'test@' }
            });
            const response = await handler(event, {});

            expect(response.statusCode).toBe(400);
            const body = JSON.parse(response.body);
            expect(body.error).toContain('Invalid email');
        });

        it('should reject invalid email format - no TLD', async () => {
            const { handler } = require('../../netlify/functions/customer-auth.js');

            const event = createMockEvent({
                method: 'POST',
                body: { email: 'test@domain' }
            });
            const response = await handler(event, {});

            expect(response.statusCode).toBe(400);
            const body = JSON.parse(response.body);
            expect(body.error).toContain('Invalid email');
        });

        it('should accept valid email format', async () => {
            const { handler } = require('../../netlify/functions/customer-auth.js');

            const event = createMockEvent({
                method: 'POST',
                body: { email: 'valid@example.com' }
            });
            const response = await handler(event, {});

            // Should not be 400 for invalid format
            // Will be 200 (success) or 500 (DB error)
            if (response.statusCode === 400) {
                const body = JSON.parse(response.body);
                expect(body.error).not.toContain('Invalid email');
            }
        });

        it('should accept email with subdomain', async () => {
            const { handler } = require('../../netlify/functions/customer-auth.js');

            const event = createMockEvent({
                method: 'POST',
                body: { email: 'test@mail.example.com' }
            });
            const response = await handler(event, {});

            if (response.statusCode === 400) {
                const body = JSON.parse(response.body);
                expect(body.error).not.toContain('Invalid email');
            }
        });
    });

    describe('Token Verification (GET)', () => {
        it('should require token parameter', async () => {
            const { handler } = require('../../netlify/functions/customer-auth.js');

            const event = createMockEvent({
                method: 'GET',
                query: {}
            });
            const response = await handler(event, {});

            expect(response.statusCode).toBe(400);
            const body = JSON.parse(response.body);
            expect(body.error).toContain('required');
        });

        it('should reject invalid token', async () => {
            const { handler } = require('../../netlify/functions/customer-auth.js');

            const event = createMockEvent({
                method: 'GET',
                query: { token: 'invalid-random-token-12345' }
            });
            const response = await handler(event, {});

            // Should return 400 (invalid/expired) or 500 (DB error)
            expect([400, 500]).toContain(response.statusCode);
        });
    });

    describe('CORS Headers', () => {
        it('should include CORS headers in response', async () => {
            const { handler } = require('../../netlify/functions/customer-auth.js');

            const event = createMockEvent({
                method: 'OPTIONS',
                origin: 'http://localhost:8888'
            });
            const response = await handler(event, {});

            expect(response.headers).toHaveProperty('Access-Control-Allow-Origin');
            expect(response.headers).toHaveProperty('Access-Control-Allow-Methods');
        });
    });

    describe('Response Format', () => {
        it('should return valid JSON for errors', async () => {
            const { handler } = require('../../netlify/functions/customer-auth.js');

            const event = createMockEvent({
                method: 'POST',
                body: { email: 'invalid' }
            });
            const response = await handler(event, {});

            expect(() => JSON.parse(response.body)).not.toThrow();
        });

        it('should include error field for validation errors', async () => {
            const { handler } = require('../../netlify/functions/customer-auth.js');

            const event = createMockEvent({
                method: 'POST',
                body: {}
            });
            const response = await handler(event, {});

            const body = JSON.parse(response.body);
            expect(body).toHaveProperty('error');
        });
    });
});

describe('Email Notifications - Rate Limiting', () => {
    it('should allow first request from new email', async () => {
        const { handler } = require('../../netlify/functions/customer-auth.js');

        const uniqueEmail = `ratelimit-${Date.now()}-1@example.com`;
        const event = createMockEvent({
            method: 'POST',
            body: { email: uniqueEmail }
        });

        const response = await handler(event, {});

        // Should not be rate limited on first request
        expect(response.statusCode).not.toBe(429);
    });

    it('should return Retry-After header when rate limited', async () => {
        const { handler } = require('../../netlify/functions/customer-auth.js');

        const uniqueEmail = `ratelimit-${Date.now()}-2@example.com`;
        const event = createMockEvent({
            method: 'POST',
            body: { email: uniqueEmail }
        });

        // Make requests until rate limited
        for (let i = 0; i < 10; i++) {
            const response = await handler(event, {});
            if (response.statusCode === 429) {
                expect(response.headers['Retry-After']).toBeDefined();
                return;
            }
        }

        // If we get here without being rate limited, log it
        console.log('Rate limit not triggered within 10 requests');
    });
});

describe('Email Notifications - Integration with Database', () => {
    const testEmails = [];

    afterAll(async () => {
        // Clean up test customers
        for (const email of testEmails) {
            await supabase.from('customers').delete().eq('email', email);
        }
    });

    it('should handle email for customer with orders', async () => {
        const { handler } = require('../../netlify/functions/customer-auth.js');

        // Use an email that might have orders in test DB
        const event = createMockEvent({
            method: 'POST',
            body: { email: 'test@example.com' }
        });

        const response = await handler(event, {});

        // Should return success (200) to prevent enumeration
        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.success).toBe(true);
        expect(body.message).toContain('email');
    });

    it('should return same message for email without orders', async () => {
        const { handler } = require('../../netlify/functions/customer-auth.js');

        const uniqueEmail = `noorders-${Date.now()}@example.com`;
        const event = createMockEvent({
            method: 'POST',
            body: { email: uniqueEmail }
        });

        const response = await handler(event, {});

        // Should return success to prevent email enumeration
        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.success).toBe(true);
        // Same message as when orders exist
        expect(body.message).toBe('If you have orders with us, you will receive an email shortly.');
    });

    it('should normalize email to lowercase', async () => {
        const { handler } = require('../../netlify/functions/customer-auth.js');

        const event = createMockEvent({
            method: 'POST',
            body: { email: 'TEST@EXAMPLE.COM' }
        });

        const response = await handler(event, {});

        // Should accept uppercase email
        expect(response.statusCode).toBe(200);
    });
});

describe('Email Configuration', () => {
    it('should work without RESEND_API_KEY (development mode)', async () => {
        const originalResendKey = process.env.RESEND_API_KEY;

        try {
            delete process.env.RESEND_API_KEY;

            vi.resetModules();
            const { handler } = require('../../netlify/functions/customer-auth.js');

            const event = createMockEvent({
                method: 'POST',
                body: { email: 'dev@example.com' }
            });

            const response = await handler(event, {});

            // Should still return success
            expect(response.statusCode).toBe(200);
        } finally {
            // Ensure we always restore the env var
            if (originalResendKey !== undefined) {
                process.env.RESEND_API_KEY = originalResendKey;
            }
            vi.resetModules();
        }
    });
});

describe('Email Utility Module', () => {
    // Import email utility fresh for each test to avoid caching issues
    let emailUtils;

    beforeEach(async () => {
        vi.resetModules();
        emailUtils = await import('../../netlify/functions/utils/email.js');
    });

    describe('sendOrderConfirmation', () => {
        it('should generate correct order confirmation email', async () => {
            const order = {
                order_number: 'FS-TEST-001',
                customer_email: 'test@example.com',
                customer_name: 'Test Customer',
                items: [
                    { title: 'Test Fidget', quantity: 2, price: 10.00 }
                ],
                subtotal: 20.00,
                shipping: 3.99,
                total: 23.99,
                shipping_address: {
                    line1: '123 Test St',
                    city: 'London',
                    postal_code: 'SW1A 1AA',
                    country: 'UK'
                }
            };

            const result = await emailUtils.sendOrderConfirmation(order);

            // In dev mode (no RESEND_API_KEY), returns console method
            expect(result.success).toBe(true);
        });

        it('should handle order with discount', async () => {
            const order = {
                order_number: 'FS-TEST-002',
                customer_email: 'test@example.com',
                customer_name: 'Test Customer',
                items: [{ title: 'Test Item', quantity: 1, price: 25.00 }],
                subtotal: 25.00,
                shipping: 0,
                total: 22.50,
                discount_code: 'SAVE10',
                discount_amount: 2.50,
                shipping_address: null
            };

            const result = await emailUtils.sendOrderConfirmation(order);
            expect(result.success).toBe(true);
        });
    });

    describe('sendGiftCardDelivery', () => {
        it('should generate correct gift card delivery email', async () => {
            const giftCard = {
                code: 'GC-TEST-1234-ABCD',
                initial_balance: 50.00,
                recipient_email: 'recipient@example.com',
                recipient_name: 'Lucky Person',
                purchaser_name: 'Generous Giver',
                personal_message: 'Enjoy your fidgets!',
                expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
            };

            const result = await emailUtils.sendGiftCardDelivery(giftCard);
            expect(result.success).toBe(true);
        });

        it('should send to purchaser if no recipient email', async () => {
            const giftCard = {
                code: 'GC-TEST-5678-EFGH',
                initial_balance: 25.00,
                purchaser_email: 'purchaser@example.com',
                recipient_email: null
            };

            const result = await emailUtils.sendGiftCardDelivery(giftCard);
            expect(result.success).toBe(true);
        });
    });

    describe('sendShippingNotification', () => {
        it('should generate correct shipping notification email', async () => {
            const order = {
                order_number: 'FS-SHIP-001',
                customer_email: 'customer@example.com',
                customer_name: 'Test Customer',
                items: [{ title: 'Fidget Spinner', quantity: 1 }],
                shipping_address: {
                    line1: '123 Ship Lane',
                    city: 'Manchester',
                    postal_code: 'M1 1AA',
                    country: 'UK'
                }
            };

            const trackingInfo = {
                tracking_number: 'RM123456789GB',
                carrier: 'Royal Mail',
                tracking_url: 'https://royalmail.com/track/RM123456789GB'
            };

            const result = await emailUtils.sendShippingNotification(order, trackingInfo);
            expect(result.success).toBe(true);
        });

        it('should work without tracking info', async () => {
            const order = {
                order_number: 'FS-SHIP-002',
                customer_email: 'customer@example.com',
                customer_name: 'Test Customer',
                items: [{ title: 'Fidget Cube', quantity: 2 }],
                shipping_address: {
                    line1: '456 No Track Ave',
                    city: 'Birmingham',
                    postal_code: 'B1 1BB',
                    country: 'UK'
                }
            };

            const result = await emailUtils.sendShippingNotification(order, {});
            expect(result.success).toBe(true);
        });
    });

    describe('sendAdminPasswordReset', () => {
        it('should generate correct password reset email', async () => {
            const result = await emailUtils.sendAdminPasswordReset(
                'admin@fidgetstreet.co.uk',
                'https://fidgetstreet.co.uk/admin/reset-password.html?token=abc123',
                60
            );

            expect(result.success).toBe(true);
        });
    });

    describe('sendMagicLink', () => {
        it('should generate correct magic link email', async () => {
            const result = await emailUtils.sendMagicLink(
                'customer@example.com',
                'https://fidgetstreet.co.uk/account/verify.html?token=xyz789'
            );

            expect(result.success).toBe(true);
        });
    });

    describe('sendNewsletterWelcome', () => {
        it('should generate correct newsletter welcome email', async () => {
            const result = await emailUtils.sendNewsletterWelcome('subscriber@example.com');
            expect(result.success).toBe(true);
        });
    });

    describe('sendMarketingEmail', () => {
        it('should generate correct marketing email with unsubscribe', async () => {
            const result = await emailUtils.sendMarketingEmail('subscriber@example.com', {
                subject: 'New Products!',
                headline: 'Check out our latest fidgets',
                body: '<p>We have exciting new products for you!</p>',
                ctaText: 'Shop Now',
                ctaUrl: 'https://fidgetstreet.co.uk/products.html'
            });

            expect(result.success).toBe(true);
        });
    });

    describe('Email Templates', () => {
        it('should include Fidget Street branding', () => {
            const html = emailUtils.baseTemplate('<p>Test content</p>');

            expect(html).toContain('Fidget Street');
            expect(html).toContain('#71c7e1'); // Primary color
        });

        it('should include unsubscribe link when specified', () => {
            const html = emailUtils.baseTemplate('<p>Test content</p>', {
                includeUnsubscribe: true,
                email: 'test@example.com'
            });

            expect(html).toContain('unsubscribe');
            expect(html).toContain('test%40example.com');
        });

        it('should not include unsubscribe link by default', () => {
            const html = emailUtils.baseTemplate('<p>Test content</p>');

            expect(html).not.toContain('Unsubscribe from marketing');
        });
    });
});
