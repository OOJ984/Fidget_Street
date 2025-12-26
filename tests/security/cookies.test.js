/**
 * Cookie Utilities Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Store original env
const originalEnv = { ...process.env };

describe('cookies.js', () => {
    let cookies;

    beforeEach(async () => {
        vi.resetModules();
        process.env.JWT_SECRET = 'test-secret-key-for-jwt-signing-min-32-chars';
        process.env.NODE_ENV = 'test';
        cookies = await import('../../netlify/functions/utils/cookies.js');
    });

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    describe('Cookie Configuration', () => {
        it('should have correct cookie names', () => {
            expect(cookies.COOKIE_CONFIG.ACCESS_TOKEN_NAME).toBe('fs_access_token');
            expect(cookies.COOKIE_CONFIG.REFRESH_TOKEN_NAME).toBe('fs_refresh_token');
            expect(cookies.COOKIE_CONFIG.CSRF_TOKEN_NAME).toBe('fs_csrf_token');
        });

        it('should have reasonable token lifetimes', () => {
            expect(cookies.COOKIE_CONFIG.ACCESS_TOKEN_MAX_AGE).toBe(15 * 60); // 15 minutes
            expect(cookies.COOKIE_CONFIG.REFRESH_TOKEN_MAX_AGE).toBe(7 * 24 * 60 * 60); // 7 days
        });
    });

    describe('CSRF Token Generation', () => {
        it('should generate 64-character hex string', () => {
            const token = cookies.generateCSRFToken();
            expect(token).toHaveLength(64);
            expect(/^[a-f0-9]+$/.test(token)).toBe(true);
        });

        it('should generate unique tokens', () => {
            const token1 = cookies.generateCSRFToken();
            const token2 = cookies.generateCSRFToken();
            expect(token1).not.toBe(token2);
        });
    });

    describe('Cookie Creation', () => {
        it('should create cookie with required attributes', () => {
            const cookie = cookies.createCookie('test', 'value', 3600);

            expect(cookie).toContain('test=value');
            expect(cookie).toContain('Max-Age=3600');
            expect(cookie).toContain('Path=/');
            expect(cookie).toContain('HttpOnly');
            expect(cookie).toContain('SameSite=Strict');
        });
    });

    describe('Expired Cookie Creation', () => {
        it('should create cookie with Max-Age=0', () => {
            const cookie = cookies.createExpiredCookie('test');
            expect(cookie).toContain('test=');
            expect(cookie).toContain('Max-Age=0');
        });
    });

    describe('Cookie Parsing', () => {
        it('should parse single cookie', () => {
            const result = cookies.parseCookies('name=value');
            expect(result.name).toBe('value');
        });

        it('should parse multiple cookies', () => {
            const result = cookies.parseCookies('a=1; b=2; c=3');
            expect(result.a).toBe('1');
            expect(result.b).toBe('2');
            expect(result.c).toBe('3');
        });

        it('should handle cookies with = in value', () => {
            const result = cookies.parseCookies('token=abc=def=ghi');
            expect(result.token).toBe('abc=def=ghi');
        });

        it('should return empty object for null/undefined', () => {
            expect(cookies.parseCookies(null)).toEqual({});
            expect(cookies.parseCookies(undefined)).toEqual({});
        });
    });

    describe('Auth Cookie Creation', () => {
        const testUser = {
            id: 1,
            email: 'test@example.com',
            name: 'Test User',
            role: 'website_admin'
        };

        it('should create three cookies', () => {
            const result = cookies.createAuthCookies(testUser, process.env.JWT_SECRET);
            expect(result.cookies).toHaveLength(3);
        });

        it('should return access, refresh, and CSRF tokens', () => {
            const result = cookies.createAuthCookies(testUser, process.env.JWT_SECRET);
            expect(result.accessToken).toBeDefined();
            expect(result.refreshToken).toBeDefined();
            expect(result.csrfToken).toBeDefined();
        });

        it('should create HttpOnly access token cookie', () => {
            const result = cookies.createAuthCookies(testUser, process.env.JWT_SECRET);
            const accessCookie = result.cookies[0];

            expect(accessCookie).toContain('fs_access_token=');
            expect(accessCookie).toContain('HttpOnly');
        });

        it('should create HttpOnly refresh token cookie', () => {
            const result = cookies.createAuthCookies(testUser, process.env.JWT_SECRET);
            const refreshCookie = result.cookies[1];

            expect(refreshCookie).toContain('fs_refresh_token=');
            expect(refreshCookie).toContain('HttpOnly');
        });

        it('should create non-HttpOnly CSRF cookie (readable by JS)', () => {
            const result = cookies.createAuthCookies(testUser, process.env.JWT_SECRET);
            const csrfCookie = result.cookies[2];

            expect(csrfCookie).toContain('fs_csrf_token=');
            expect(csrfCookie).not.toContain('HttpOnly');
        });
    });

    describe('Logout Cookies', () => {
        it('should create three expired cookies', () => {
            const logoutCookies = cookies.createLogoutCookies();
            expect(logoutCookies).toHaveLength(3);
            logoutCookies.forEach(cookie => {
                expect(cookie).toContain('Max-Age=0');
            });
        });
    });

    describe('Token Verification from Cookies', () => {
        const testUser = {
            id: 1,
            email: 'test@example.com',
            name: 'Test User',
            role: 'website_admin'
        };

        it('should return error when no access token', () => {
            const event = {
                httpMethod: 'GET',
                headers: { cookie: 'other=value' }
            };

            const result = cookies.verifyTokenFromCookies(event, process.env.JWT_SECRET);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('No access token');
        });

        it('should verify valid access token for GET request', () => {
            const auth = cookies.createAuthCookies(testUser, process.env.JWT_SECRET);
            const accessToken = auth.cookies[0].split('=')[1].split(';')[0];

            const event = {
                httpMethod: 'GET',
                headers: {
                    cookie: `fs_access_token=${accessToken}; fs_csrf_token=${auth.csrfToken}`
                }
            };

            const result = cookies.verifyTokenFromCookies(event, process.env.JWT_SECRET);
            expect(result.valid).toBe(true);
            expect(result.user.email).toBe('test@example.com');
        });

        it('should require CSRF header for POST requests', () => {
            const auth = cookies.createAuthCookies(testUser, process.env.JWT_SECRET);
            const accessToken = auth.cookies[0].split('=')[1].split(';')[0];

            const event = {
                httpMethod: 'POST',
                headers: {
                    cookie: `fs_access_token=${accessToken}; fs_csrf_token=${auth.csrfToken}`
                    // No x-csrf-token header
                }
            };

            const result = cookies.verifyTokenFromCookies(event, process.env.JWT_SECRET);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('CSRF');
        });

        it('should pass CSRF check when header matches cookie', () => {
            const auth = cookies.createAuthCookies(testUser, process.env.JWT_SECRET);
            const accessToken = auth.cookies[0].split('=')[1].split(';')[0];

            const event = {
                httpMethod: 'POST',
                headers: {
                    cookie: `fs_access_token=${accessToken}; fs_csrf_token=${auth.csrfToken}`,
                    'x-csrf-token': auth.csrfToken
                }
            };

            const result = cookies.verifyTokenFromCookies(event, process.env.JWT_SECRET);
            expect(result.valid).toBe(true);
        });
    });

    describe('Refresh Token Verification', () => {
        const testUser = {
            id: 1,
            email: 'test@example.com',
            name: 'Test User',
            role: 'website_admin'
        };

        it('should return error when no refresh token', () => {
            const event = {
                headers: { cookie: 'other=value' }
            };

            const result = cookies.verifyRefreshToken(event, process.env.JWT_SECRET);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('No refresh token');
        });

        it('should verify valid refresh token', () => {
            const auth = cookies.createAuthCookies(testUser, process.env.JWT_SECRET);
            const refreshToken = auth.cookies[1].split('=')[1].split(';')[0];

            const event = {
                headers: {
                    cookie: `fs_refresh_token=${refreshToken}`
                }
            };

            const result = cookies.verifyRefreshToken(event, process.env.JWT_SECRET);
            expect(result.valid).toBe(true);
            expect(result.payload.email).toBe('test@example.com');
            expect(result.payload.type).toBe('refresh');
        });
    });

    describe('Response Cookie Helper', () => {
        it('should add cookies to response', () => {
            const response = {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: '{}'
            };

            const cookieArray = ['cookie1=value1', 'cookie2=value2'];
            const result = cookies.addCookiesToResponse(response, cookieArray);

            expect(result.multiValueHeaders['Set-Cookie']).toEqual(cookieArray);
            expect(result.statusCode).toBe(200);
        });

        it('should handle single cookie', () => {
            const response = { statusCode: 200 };
            const result = cookies.addCookiesToResponse(response, 'single=cookie');

            expect(result.multiValueHeaders['Set-Cookie']).toEqual(['single=cookie']);
        });
    });
});
