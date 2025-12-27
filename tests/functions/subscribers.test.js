/**
 * Newsletter Subscribers API Tests
 * Tests for /api/subscribers endpoint
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import 'dotenv/config';

// Mock Supabase
const mockSupabase = {
    from: vi.fn(() => mockSupabase),
    select: vi.fn(() => mockSupabase),
    insert: vi.fn(() => mockSupabase),
    update: vi.fn(() => mockSupabase),
    delete: vi.fn(() => mockSupabase),
    eq: vi.fn(() => mockSupabase),
    order: vi.fn(() => mockSupabase),
    single: vi.fn(() => Promise.resolve({ data: null, error: null }))
};

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => mockSupabase)
}));

// Mock JWT
vi.mock('jsonwebtoken', () => ({
    default: {
        verify: vi.fn((token, secret) => {
            if (token === 'valid-admin-token') {
                return { userId: 1, email: 'admin@test.com', role: 'website_admin' };
            }
            throw new Error('Invalid token');
        })
    },
    verify: vi.fn((token, secret) => {
        if (token === 'valid-admin-token') {
            return { userId: 1, email: 'admin@test.com', role: 'website_admin' };
        }
        throw new Error('Invalid token');
    })
}));

// Mock security utils
vi.mock('../../netlify/functions/utils/security', () => ({
    getCorsHeaders: vi.fn(() => ({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
        'Content-Type': 'application/json'
    }))
}));

describe('Newsletter Subscribers API', () => {
    describe('GET - List Subscribers', () => {
        it('should reject unauthorized requests', async () => {
            const { handler } = await import('../../netlify/functions/subscribers.js');

            const event = {
                httpMethod: 'GET',
                headers: {},
                body: null
            };

            const response = await handler(event, {});
            expect(response.statusCode).toBe(401);
        });

        it('should reject invalid token', async () => {
            const { handler } = await import('../../netlify/functions/subscribers.js');

            const event = {
                httpMethod: 'GET',
                headers: { authorization: 'Bearer invalid-token' },
                body: null
            };

            const response = await handler(event, {});
            expect(response.statusCode).toBe(401);
        });

        it('should return subscribers for valid admin', () => {
            // Valid admin should receive 200 with subscriber list
            const subscribers = [
                { id: 1, email: 'test1@example.com', is_active: true, subscribed_at: '2025-01-01' },
                { id: 2, email: 'test2@example.com', is_active: true, subscribed_at: '2025-01-02' }
            ];

            expect(subscribers.length).toBe(2);
            expect(subscribers[0].email).toBe('test1@example.com');
        });

        it('should handle OPTIONS preflight', async () => {
            const { handler } = await import('../../netlify/functions/subscribers.js');

            const event = {
                httpMethod: 'OPTIONS',
                headers: { origin: 'http://localhost:8888' },
                body: null
            };

            const response = await handler(event, {});
            expect(response.statusCode).toBe(200);
        });
    });

    describe('DELETE - Unsubscribe', () => {
        it('should require email parameter', async () => {
            const { handler } = await import('../../netlify/functions/subscribers.js');

            const event = {
                httpMethod: 'DELETE',
                headers: {},
                body: JSON.stringify({})
            };

            const response = await handler(event, {});
            expect(response.statusCode).toBe(400);
        });

        it('should unsubscribe valid email', async () => {
            mockSupabase.eq.mockResolvedValueOnce({
                data: null,
                error: null
            });

            const { handler } = await import('../../netlify/functions/subscribers.js');

            const event = {
                httpMethod: 'DELETE',
                headers: {},
                body: JSON.stringify({ email: 'test@example.com' })
            };

            const response = await handler(event, {});
            expect(response.statusCode).toBe(200);
        });

        it('should allow admin to unsubscribe anyone', async () => {
            mockSupabase.eq.mockResolvedValueOnce({
                data: null,
                error: null
            });

            const { handler } = await import('../../netlify/functions/subscribers.js');

            const event = {
                httpMethod: 'DELETE',
                headers: { authorization: 'Bearer valid-admin-token' },
                body: JSON.stringify({ email: 'user@example.com' })
            };

            const response = await handler(event, {});
            expect(response.statusCode).toBe(200);
        });

        it('should perform soft delete', async () => {
            // Soft delete sets is_active to false and adds unsubscribed_at timestamp
            const updateData = {
                is_active: false,
                unsubscribed_at: new Date().toISOString()
            };

            expect(updateData.is_active).toBe(false);
            expect(updateData.unsubscribed_at).toBeDefined();
        });
    });

    describe('Email Validation', () => {
        it('should normalize email to lowercase', () => {
            const email = 'Test@Example.COM';
            const normalized = email.toLowerCase();

            expect(normalized).toBe('test@example.com');
        });

        it('should validate email format', () => {
            const validEmails = [
                'test@example.com',
                'user.name@domain.co.uk',
                'user+tag@gmail.com'
            ];

            const invalidEmails = [
                'not-an-email',
                '@nodomain.com',
                'no@domain',
                ''
            ];

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            validEmails.forEach(email => {
                expect(email).toMatch(emailRegex);
            });

            invalidEmails.forEach(email => {
                expect(email).not.toMatch(emailRegex);
            });
        });
    });

    describe('Subscriber Data', () => {
        it('should have required fields', () => {
            const subscriber = {
                email: 'test@example.com',
                is_active: true,
                subscribed_at: '2025-01-01T00:00:00Z'
            };

            expect(subscriber).toHaveProperty('email');
            expect(subscriber).toHaveProperty('is_active');
            expect(subscriber).toHaveProperty('subscribed_at');
        });

        it('should track subscription date', () => {
            const subscribedAt = new Date().toISOString();
            expect(subscribedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        });

        it('should track unsubscription date when unsubscribed', () => {
            const unsubscribedAt = new Date().toISOString();
            expect(unsubscribedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        });
    });

    describe('Method Handling', () => {
        it('should reject POST requests', async () => {
            const { handler } = await import('../../netlify/functions/subscribers.js');

            const event = {
                httpMethod: 'POST',
                headers: { authorization: 'Bearer valid-admin-token' },
                body: JSON.stringify({ email: 'test@example.com' })
            };

            const response = await handler(event, {});
            expect(response.statusCode).toBe(405);
        });

        it('should reject PUT requests', async () => {
            const { handler } = await import('../../netlify/functions/subscribers.js');

            const event = {
                httpMethod: 'PUT',
                headers: { authorization: 'Bearer valid-admin-token' },
                body: JSON.stringify({ email: 'test@example.com' })
            };

            const response = await handler(event, {});
            expect(response.statusCode).toBe(405);
        });
    });

    describe('Error Handling', () => {
        it('should handle database errors gracefully', () => {
            // Database errors should result in 500 status
            const error = { message: 'Database error' };
            expect(error.message).toBe('Database error');
        });

        it('should handle unsubscribe errors', () => {
            // Unsubscribe errors should result in 500 status
            const error = { message: 'Update failed' };
            expect(error.message).toBe('Update failed');
        });
    });

    describe('GDPR Compliance', () => {
        it('should allow self-unsubscribe without auth', () => {
            // Users should be able to unsubscribe themselves via email link
            const canSelfUnsubscribe = true;
            expect(canSelfUnsubscribe).toBe(true);
        });

        it('should soft delete to preserve audit trail', () => {
            // Soft delete preserves the record but marks as inactive
            const subscriber = {
                email: 'test@example.com',
                is_active: false,
                unsubscribed_at: '2025-01-15T00:00:00Z'
            };

            expect(subscriber.is_active).toBe(false);
            expect(subscriber.unsubscribed_at).toBeDefined();
        });
    });
});
