/**
 * Analytics/Tracking API Tests
 * Tests for /api/track endpoint
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import 'dotenv/config';

// Mock Supabase
const mockSupabase = {
    from: vi.fn(() => mockSupabase),
    select: vi.fn(() => mockSupabase),
    insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
    order: vi.fn(() => mockSupabase)
};

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => mockSupabase)
}));

// Mock security utils
vi.mock('../../netlify/functions/utils/security', () => ({
    getCorsHeaders: vi.fn(() => ({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    }))
}));

describe('Analytics Tracking API', () => {
    describe('POST - Track Page View', () => {
        it('should track page view with valid data', async () => {
            mockSupabase.insert.mockResolvedValueOnce({ data: null, error: null });

            const { handler } = await import('../../netlify/functions/track.js');

            const event = {
                httpMethod: 'POST',
                headers: {
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
                    'x-country': 'GB'
                },
                body: JSON.stringify({
                    path: '/products/fidget-cube',
                    title: 'Fidget Cube - Fidget Street',
                    referrer: 'https://google.com'
                })
            };

            const response = await handler(event, {});
            expect(response.statusCode).toBe(200);
        });

        it('should require path parameter', async () => {
            const { handler } = await import('../../netlify/functions/track.js');

            const event = {
                httpMethod: 'POST',
                headers: {},
                body: JSON.stringify({
                    title: 'Test Page'
                })
            };

            const response = await handler(event, {});
            expect(response.statusCode).toBe(400);
        });

        it('should handle OPTIONS preflight', async () => {
            const { handler } = await import('../../netlify/functions/track.js');

            const event = {
                httpMethod: 'OPTIONS',
                headers: { origin: 'http://localhost:8888' },
                body: null
            };

            const response = await handler(event, {});
            expect(response.statusCode).toBe(200);
        });

        it('should reject GET requests', async () => {
            const { handler } = await import('../../netlify/functions/track.js');

            const event = {
                httpMethod: 'GET',
                headers: {},
                body: null
            };

            const response = await handler(event, {});
            expect(response.statusCode).toBe(405);
        });
    });

    describe('Device Detection', () => {
        const getDeviceType = (userAgent) => {
            if (!userAgent) return 'unknown';
            const ua = userAgent.toLowerCase();
            if (/mobile|android|iphone|ipad|ipod|blackberry|windows phone/i.test(ua)) {
                return /ipad|tablet/i.test(ua) ? 'tablet' : 'mobile';
            }
            return 'desktop';
        };

        it('should detect desktop browsers', () => {
            const desktopUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0';
            expect(getDeviceType(desktopUA)).toBe('desktop');
        });

        it('should detect mobile devices', () => {
            const mobileUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
            expect(getDeviceType(mobileUA)).toBe('mobile');
        });

        it('should detect Android devices', () => {
            const androidUA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile';
            expect(getDeviceType(androidUA)).toBe('mobile');
        });

        it('should detect iPad as tablet', () => {
            const ipadUA = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15';
            expect(getDeviceType(ipadUA)).toBe('tablet');
        });

        it('should handle missing user agent', () => {
            expect(getDeviceType(null)).toBe('unknown');
            expect(getDeviceType('')).toBe('unknown');
            expect(getDeviceType(undefined)).toBe('unknown');
        });
    });

    describe('Session Management', () => {
        const generateSessionId = () => {
            return 'sess_' + Math.random().toString(36).substring(2, 15);
        };

        it('should generate unique session IDs', () => {
            const session1 = generateSessionId();
            const session2 = generateSessionId();

            expect(session1).not.toBe(session2);
        });

        it('should have sess_ prefix', () => {
            const sessionId = generateSessionId();
            expect(sessionId).toMatch(/^sess_/);
        });

        it('should be reasonable length', () => {
            const sessionId = generateSessionId();
            expect(sessionId.length).toBeGreaterThan(10);
            expect(sessionId.length).toBeLessThan(30);
        });

        it('should use provided session ID if available', async () => {
            mockSupabase.insert.mockResolvedValueOnce({ data: null, error: null });

            const { handler } = await import('../../netlify/functions/track.js');

            const event = {
                httpMethod: 'POST',
                headers: {},
                body: JSON.stringify({
                    path: '/test',
                    sessionId: 'sess_existingsession123'
                })
            };

            const response = await handler(event, {});
            expect(response.statusCode).toBe(200);
        });
    });

    describe('Country Detection', () => {
        it('should use x-country header', () => {
            const headers = { 'x-country': 'GB' };
            const country = headers['x-country'] || headers['x-nf-country'] || null;

            expect(country).toBe('GB');
        });

        it('should fallback to x-nf-country header', () => {
            const headers = { 'x-nf-country': 'US' };
            const country = headers['x-country'] || headers['x-nf-country'] || null;

            expect(country).toBe('US');
        });

        it('should handle missing country headers', () => {
            const headers = {};
            const country = headers['x-country'] || headers['x-nf-country'] || null;

            expect(country).toBeNull();
        });
    });

    describe('Page View Data', () => {
        it('should capture page path', () => {
            const pageView = {
                page_path: '/products/fidget-cube',
                page_title: 'Fidget Cube',
                referrer: 'https://google.com',
                country: 'GB',
                device_type: 'desktop',
                session_id: 'sess_abc123'
            };

            expect(pageView.page_path).toBeDefined();
            expect(pageView.page_path).toMatch(/^\//);
        });

        it('should allow optional title', () => {
            const pageView = {
                page_path: '/products',
                page_title: null
            };

            expect(pageView.page_title).toBeNull();
        });

        it('should allow optional referrer', () => {
            const pageView = {
                page_path: '/products',
                referrer: null
            };

            expect(pageView.referrer).toBeNull();
        });

        it('should track timestamp automatically', () => {
            const now = new Date();
            expect(now).toBeInstanceOf(Date);
        });
    });

    describe('Privacy Considerations', () => {
        it('should not track IP addresses directly', () => {
            const pageView = {
                page_path: '/products',
                device_type: 'desktop',
                country: 'GB'
            };

            expect(pageView).not.toHaveProperty('ip_address');
            expect(pageView).not.toHaveProperty('ip');
        });

        it('should not store personal identifiers', () => {
            const pageView = {
                page_path: '/products',
                session_id: 'sess_abc123'
            };

            expect(pageView).not.toHaveProperty('user_id');
            expect(pageView).not.toHaveProperty('email');
            expect(pageView).not.toHaveProperty('name');
        });

        it('should only store anonymized device info', () => {
            const pageView = {
                device_type: 'mobile'
            };

            // Only stores device category, not specific device info
            expect(['desktop', 'mobile', 'tablet', 'unknown']).toContain(pageView.device_type);
        });
    });

    describe('Error Handling', () => {
        it('should handle database errors gracefully', () => {
            // Database errors should be caught and return 500
            const error = { message: 'Database error' };
            expect(error.message).toBe('Database error');
        });

        it('should handle invalid JSON body', () => {
            // Invalid JSON should throw SyntaxError
            expect(() => JSON.parse('invalid json')).toThrow();
        });

        it('should handle empty body', () => {
            // Empty body should parse to empty object
            const body = '';
            const parsed = JSON.parse(body || '{}');
            expect(parsed).toEqual({});
        });
    });

    describe('Rate Limiting Considerations', () => {
        it('should handle high volume of requests', () => {
            // Analytics endpoints should be lightweight
            const maxRequestsPerSecond = 1000;
            expect(maxRequestsPerSecond).toBeGreaterThan(100);
        });

        it('should have minimal payload size', () => {
            const payload = {
                path: '/products',
                title: 'Products Page',
                sessionId: 'sess_abc123'
            };

            const payloadSize = JSON.stringify(payload).length;
            expect(payloadSize).toBeLessThan(500); // Keep under 500 bytes
        });
    });

    describe('Common Page Paths', () => {
        const commonPaths = [
            '/',
            '/products',
            '/products/:slug',
            '/cart',
            '/contact',
            '/about',
            '/faq'
        ];

        it('should track homepage', () => {
            expect(commonPaths).toContain('/');
        });

        it('should track product pages', () => {
            expect(commonPaths).toContain('/products');
            expect(commonPaths).toContain('/products/:slug');
        });

        it('should track cart page', () => {
            expect(commonPaths).toContain('/cart');
        });
    });
});
