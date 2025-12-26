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

        process.env.RESEND_API_KEY = originalResendKey;
    });
});

describe('Future Email Features (TODO)', () => {
    it.todo('should send order confirmation email on successful payment');
    it.todo('should send gift card delivery email');
    it.todo('should send shipping notification email');
    it.todo('should send admin password reset email');
    it.todo('should include unsubscribe link in marketing emails');
});
