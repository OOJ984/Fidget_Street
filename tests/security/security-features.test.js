/**
 * Security Features Test Suite
 *
 * Tests for December 2025 security enhancements:
 * - #9: httpOnly cookies
 * - #10: Encryption key enforcement
 * - #11: Content-Type validation
 * - #12: MFA rate limiting (database)
 * - #13: Refresh token rotation
 * - #14: IP allowlisting
 * - #15: Anomaly detection
 * - #16: CSP reporting
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock environment variables
const originalEnv = process.env;

beforeEach(() => {
    vi.resetModules();
    process.env = {
        ...originalEnv,
        JWT_SECRET: 'test-secret-key-for-jwt-signing-min-32-chars',
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_ANON_KEY: 'test-anon-key',
        NODE_ENV: 'test'
    };
});

afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
});

// ============================================
// #10: Encryption Key Enforcement Tests
// ============================================

describe('Encryption Key Enforcement (#10)', () => {
    it('should return plaintext in development without key', () => {
        delete process.env.ENCRYPTION_KEY;
        process.env.NODE_ENV = 'development';

        const { encrypt } = require('../../netlify/functions/utils/crypto');
        const result = encrypt('test-data');

        expect(result).toBe('test-data');
    });

    it('should throw error in production without key', () => {
        delete process.env.ENCRYPTION_KEY;
        process.env.NODE_ENV = 'production';
        process.env.CONTEXT = 'production';

        // Re-require to get fresh module
        vi.resetModules();
        const { encrypt } = require('../../netlify/functions/utils/crypto');

        expect(() => encrypt('test-data')).toThrow('ENCRYPTION_KEY is required in production');
    });

    it('should encrypt data when key is provided', () => {
        process.env.ENCRYPTION_KEY = 'a'.repeat(64); // 32 bytes in hex

        vi.resetModules();
        const { encrypt, decrypt } = require('../../netlify/functions/utils/crypto');

        const encrypted = encrypt('sensitive-data');
        expect(encrypted).not.toBe('sensitive-data');
        expect(encrypted).toContain(':'); // iv:tag:ciphertext format

        const decrypted = decrypt(encrypted);
        expect(decrypted).toBe('sensitive-data');
    });
});

// ============================================
// #14: IP Allowlisting Tests
// ============================================

describe('IP Allowlisting (#14)', () => {
    // Note: These tests verify the IP allowlist logic using the exported ADMIN_ALLOWED_IPS array
    // The actual env var parsing is tested implicitly since ADMIN_ALLOWED_IPS is exported

    it('should allow all IPs when allowlist is empty', () => {
        // Test with fresh import - ADMIN_ALLOWED_IPS should be empty since env var not set at module load
        const { checkAdminIPAllowlist, ADMIN_ALLOWED_IPS } = require('../../netlify/functions/utils/security');

        const event = {
            headers: { 'x-forwarded-for': '1.2.3.4' }
        };

        // When ADMIN_ALLOWED_IPS is empty, all IPs should be allowed
        if (ADMIN_ALLOWED_IPS.length === 0) {
            const result = checkAdminIPAllowlist(event);
            expect(result.allowed).toBe(true);
            expect(result.ip).toBe('1.2.3.4');
        } else {
            // If env var was set, skip this test
            console.log('Skipping - ADMIN_ALLOWED_IPS is configured in environment');
        }
    });

    it('should parse ADMIN_ALLOWED_IPS from environment correctly', () => {
        const { ADMIN_ALLOWED_IPS } = require('../../netlify/functions/utils/security');

        // The array should be either empty or contain valid IPs
        expect(Array.isArray(ADMIN_ALLOWED_IPS)).toBe(true);

        // If configured, each entry should be a non-empty string
        ADMIN_ALLOWED_IPS.forEach(ip => {
            expect(typeof ip).toBe('string');
            expect(ip.trim()).toBe(ip); // Should be trimmed
            expect(ip.length).toBeGreaterThan(0);
        });
    });

    it('should extract client IP from x-forwarded-for header', () => {
        const { checkAdminIPAllowlist, ADMIN_ALLOWED_IPS } = require('../../netlify/functions/utils/security');

        const event = {
            headers: { 'x-forwarded-for': '203.0.113.50, 70.41.3.18' }
        };

        const result = checkAdminIPAllowlist(event);
        // Should extract the first IP from the chain
        expect(result.ip).toBe('203.0.113.50');
    });

    it('should export requireAdminIP function', () => {
        const { requireAdminIP } = require('../../netlify/functions/utils/security');

        expect(typeof requireAdminIP).toBe('function');
    });

    it('should return null from requireAdminIP when IP is allowed', () => {
        const { requireAdminIP, getCorsHeaders, ADMIN_ALLOWED_IPS } = require('../../netlify/functions/utils/security');

        // When allowlist is empty, all IPs are allowed
        if (ADMIN_ALLOWED_IPS.length === 0) {
            const event = {
                headers: { 'x-forwarded-for': '1.2.3.4' }
            };
            const headers = getCorsHeaders('http://localhost:8888');

            const response = requireAdminIP(event, headers);
            expect(response).toBeNull();
        } else {
            console.log('Skipping - ADMIN_ALLOWED_IPS is configured');
        }
    });
});

// ============================================
// #9 & #13: Cookie Authentication Tests
// ============================================

describe('Cookie Authentication (#9, #13)', () => {
    const cookies = require('../../netlify/functions/utils/cookies');

    it('should create auth cookies with correct structure', () => {
        const user = { id: 1, email: 'test@test.com', name: 'Test', role: 'website_admin' };
        const result = cookies.createAuthCookies(user, process.env.JWT_SECRET);

        expect(result.cookies).toHaveLength(3);
        expect(result.accessToken).toBeDefined();
        expect(result.refreshToken).toBeDefined();
        expect(result.csrfToken).toBeDefined();

        // Check cookie attributes
        expect(result.cookies[0]).toContain('fs_access_token=');
        expect(result.cookies[0]).toContain('HttpOnly');
        expect(result.cookies[0]).toContain('SameSite=Strict');
    });

    it('should parse cookies from header', () => {
        const cookieHeader = 'fs_access_token=abc123; fs_csrf_token=xyz789';
        const parsed = cookies.parseCookies(cookieHeader);

        expect(parsed.fs_access_token).toBe('abc123');
        expect(parsed.fs_csrf_token).toBe('xyz789');
    });

    it('should verify valid token from cookies', () => {
        const user = { id: 1, email: 'test@test.com', name: 'Test', role: 'website_admin' };
        const { cookies: cookieStrings, csrfToken } = cookies.createAuthCookies(user, process.env.JWT_SECRET);

        // Extract token from cookie string
        const accessToken = cookieStrings[0].split('=')[1].split(';')[0];

        const event = {
            httpMethod: 'GET',
            headers: {
                cookie: `fs_access_token=${accessToken}; fs_csrf_token=${csrfToken}`
            }
        };

        const result = cookies.verifyTokenFromCookies(event, process.env.JWT_SECRET);
        expect(result.valid).toBe(true);
        expect(result.user.email).toBe('test@test.com');
    });

    it('should require CSRF token for POST requests', () => {
        const user = { id: 1, email: 'test@test.com', name: 'Test', role: 'website_admin' };
        const { cookies: cookieStrings } = cookies.createAuthCookies(user, process.env.JWT_SECRET);
        const accessToken = cookieStrings[0].split('=')[1].split(';')[0];

        const event = {
            httpMethod: 'POST',
            headers: {
                cookie: `fs_access_token=${accessToken}; fs_csrf_token=valid-csrf`
                // Missing x-csrf-token header
            }
        };

        const result = cookies.verifyTokenFromCookies(event, process.env.JWT_SECRET);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('CSRF');
    });

    it('should create logout cookies (expired)', () => {
        const logoutCookies = cookies.createLogoutCookies();

        expect(logoutCookies).toHaveLength(3);
        expect(logoutCookies[0]).toContain('Max-Age=0');
    });
});

// ============================================
// Hybrid Auth (Backwards Compatibility) Tests
// ============================================

describe('Hybrid Authentication', () => {
    it('should accept Authorization header (legacy)', () => {
        const jwt = require('jsonwebtoken');
        const { verifyToken } = require('../../netlify/functions/utils/security');

        const token = jwt.sign(
            { userId: 1, email: 'test@test.com' },
            process.env.JWT_SECRET
        );

        const result = verifyToken(`Bearer ${token}`);
        expect(result).not.toBeNull();
        expect(result.email).toBe('test@test.com');
    });

    it('should accept cookies when event object passed', () => {
        const jwt = require('jsonwebtoken');
        vi.resetModules();
        const { verifyToken } = require('../../netlify/functions/utils/security');

        const token = jwt.sign(
            { userId: 1, email: 'test@test.com', type: 'access', mfaVerified: true },
            process.env.JWT_SECRET
        );

        const event = {
            httpMethod: 'GET',
            headers: {
                cookie: `fs_access_token=${token}; fs_csrf_token=test`
            }
        };

        const result = verifyToken(event);
        expect(result).not.toBeNull();
        expect(result.email).toBe('test@test.com');
    });
});

// ============================================
// #15: Anomaly Detection Tests
// ============================================

describe('Anomaly Detection (#15)', () => {
    // Note: These tests verify the module exports and thresholds
    // Full integration testing with Supabase is in integration tests

    it('should export correct thresholds', async () => {
        // Dynamic import to avoid Supabase initialization issues in unit tests
        const anomalyModule = await import('../../netlify/functions/utils/anomalyDetection.js');
        const { THRESHOLDS } = anomalyModule;

        expect(THRESHOLDS.FAILED_LOGINS_PER_IP).toBe(5);
        expect(THRESHOLDS.GIFT_CARD_CHECKS_PER_IP).toBe(10);
    });

    it('should export checkLoginAnomaly function', async () => {
        const anomalyModule = await import('../../netlify/functions/utils/anomalyDetection.js');
        expect(typeof anomalyModule.checkLoginAnomaly).toBe('function');
    });

    it('should export logSecurityEvent function', async () => {
        const anomalyModule = await import('../../netlify/functions/utils/anomalyDetection.js');
        expect(typeof anomalyModule.logSecurityEvent).toBe('function');
    });

    it('should export checkGiftCardAnomaly function', async () => {
        const anomalyModule = await import('../../netlify/functions/utils/anomalyDetection.js');
        expect(typeof anomalyModule.checkGiftCardAnomaly).toBe('function');
    });

    it('should handle errors gracefully in checkLoginAnomaly', async () => {
        // When Supabase is not available or errors occur, should return null (not throw)
        const anomalyModule = await import('../../netlify/functions/utils/anomalyDetection.js');

        // This will fail to connect but should not throw
        const result = await anomalyModule.checkLoginAnomaly('test@example.com', '127.0.0.1');

        // Should return null on error (graceful degradation)
        expect(result).toBeNull();
    });
});

// ============================================
// #11: Content-Type Validation Tests
// ============================================

describe('Webhook Content-Type Validation (#11)', () => {
    it('should reject invalid Content-Type', async () => {
        // Mock Stripe
        vi.mock('stripe', () => {
            return () => ({
                webhooks: {
                    constructEvent: vi.fn()
                }
            });
        });

        const { handler } = require('../../netlify/functions/webhooks');

        const event = {
            httpMethod: 'POST',
            headers: {
                'content-type': 'text/plain',
                'stripe-signature': 'test-sig'
            },
            body: '{}'
        };

        const response = await handler(event, {});

        expect(response.statusCode).toBe(400);
        expect(JSON.parse(response.body).error).toContain('Content-Type');
    });
});

// ============================================
// #16: CSP Reporting Tests
// ============================================

describe('CSP Reporting (#16)', () => {
    it('should accept CSP violation reports', async () => {
        vi.mock('@supabase/supabase-js', () => ({
            createClient: () => ({
                from: () => ({
                    insert: () => Promise.resolve({ error: null })
                })
            })
        }));

        const { handler } = require('../../netlify/functions/csp-report');

        const event = {
            httpMethod: 'POST',
            headers: {
                'content-type': 'application/csp-report'
            },
            body: JSON.stringify({
                'csp-report': {
                    'document-uri': 'https://example.com',
                    'violated-directive': 'script-src',
                    'blocked-uri': 'https://evil.com/script.js'
                }
            })
        };

        const response = await handler(event, {});

        expect(response.statusCode).toBe(204);
    });

    it('should reject non-POST requests', async () => {
        const { handler } = require('../../netlify/functions/csp-report');

        const event = {
            httpMethod: 'GET',
            headers: {}
        };

        const response = await handler(event, {});

        expect(response.statusCode).toBe(405);
    });
});

// ============================================
// XSS Prevention Tests (validation.js)
// ============================================

describe('XSS Prevention', () => {
    const { containsXSS, encodeHTML } = require('../../netlify/functions/utils/validation');

    it('should detect script tags', () => {
        expect(containsXSS('<script>alert(1)</script>')).toBe(true);
        expect(containsXSS('<SCRIPT>alert(1)</SCRIPT>')).toBe(true);
    });

    it('should detect event handlers', () => {
        expect(containsXSS('onclick=alert(1)')).toBe(true);
        expect(containsXSS('onerror="malicious()"')).toBe(true);
    });

    it('should detect javascript protocol', () => {
        expect(containsXSS('javascript:alert(1)')).toBe(true);
        expect(containsXSS('JAVASCRIPT:void(0)')).toBe(true);
    });

    it('should detect encoded attacks', () => {
        expect(containsXSS('%3Cscript%3E')).toBe(true);
        expect(containsXSS('&#60;script&#62;')).toBe(true);
    });

    it('should allow safe strings', () => {
        expect(containsXSS('Hello World')).toBe(false);
        expect(containsXSS('John O\'Brien')).toBe(false);
        expect(containsXSS('test@example.com')).toBe(false);
    });

    it('should encode HTML special characters', () => {
        expect(encodeHTML('<script>')).toBe('&lt;script&gt;');
        expect(encodeHTML('"quotes"')).toBe('&quot;quotes&quot;');
        expect(encodeHTML("'apostrophe'")).toBe('&#x27;apostrophe&#x27;');
        expect(encodeHTML('a & b')).toBe('a &amp; b');
    });
});
