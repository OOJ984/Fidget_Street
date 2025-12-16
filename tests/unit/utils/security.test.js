/**
 * Security Utility Tests
 *
 * Tests for JWT verification and RBAC functions.
 * These are CRITICAL - security bypass = full system compromise.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import jwt from 'jsonwebtoken';

// Store original env
const originalEnv = { ...process.env };

describe('security.js', () => {
    let security;

    beforeEach(async () => {
        vi.resetModules();
        process.env.JWT_SECRET = 'test-secret-key';
        process.env.SUPABASE_URL = 'https://test.supabase.co';
        process.env.SUPABASE_SERVICE_KEY = 'test-key';
        security = await import('../../../netlify/functions/utils/security.js');
    });

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    describe('verifyToken()', () => {
        it('should return decoded payload for valid token', () => {
            const payload = {
                userId: 1,
                email: 'admin@test.com',
                role: 'website_admin'
            };
            const token = jwt.sign(payload, 'test-secret-key', { expiresIn: '1h' });

            const result = security.verifyToken(`Bearer ${token}`);

            expect(result.userId).toBe(1);
            expect(result.email).toBe('admin@test.com');
            expect(result.role).toBe('website_admin');
        });

        it('should return null for missing Authorization header', () => {
            expect(security.verifyToken(null)).toBeNull();
            expect(security.verifyToken(undefined)).toBeNull();
            expect(security.verifyToken('')).toBeNull();
        });

        it('should return null for non-Bearer token', () => {
            const token = jwt.sign({ userId: 1 }, 'test-secret-key');
            expect(security.verifyToken(token)).toBeNull(); // Missing "Bearer "
            expect(security.verifyToken(`Basic ${token}`)).toBeNull();
        });

        it('should return null for expired token', () => {
            const token = jwt.sign(
                { userId: 1 },
                'test-secret-key',
                { expiresIn: '-1h' } // Already expired
            );

            const result = security.verifyToken(`Bearer ${token}`);
            expect(result).toBeNull();
        });

        it('should return null for token signed with wrong secret', () => {
            const token = jwt.sign({ userId: 1 }, 'wrong-secret');
            const result = security.verifyToken(`Bearer ${token}`);
            expect(result).toBeNull();
        });

        it('should return null for malformed token', () => {
            expect(security.verifyToken('Bearer invalid.token.here')).toBeNull();
            expect(security.verifyToken('Bearer ')).toBeNull();
        });
    });

    describe('hasPermission()', () => {
        it('should return true for user with matching permission', () => {
            const user = { role: 'website_admin' };
            expect(security.hasPermission(user, security.PERMISSIONS.MANAGE_USERS)).toBe(true);
        });

        it('should return false for user without permission', () => {
            const user = { role: 'customer' };
            expect(security.hasPermission(user, security.PERMISSIONS.MANAGE_USERS)).toBe(false);
        });

        it('should return false for null/undefined user', () => {
            expect(security.hasPermission(null, security.PERMISSIONS.VIEW_PRODUCTS)).toBe(false);
            expect(security.hasPermission(undefined, security.PERMISSIONS.VIEW_PRODUCTS)).toBe(false);
        });

        it('should return false for user without role', () => {
            const user = { email: 'test@test.com' };
            expect(security.hasPermission(user, security.PERMISSIONS.VIEW_PRODUCTS)).toBe(false);
        });

        it('should return false for unknown role', () => {
            const user = { role: 'superadmin' };
            expect(security.hasPermission(user, security.PERMISSIONS.VIEW_PRODUCTS)).toBe(false);
        });
    });

    describe('hasAnyPermission()', () => {
        it('should return true if user has at least one permission', () => {
            const user = { role: 'business_processing' };
            const result = security.hasAnyPermission(user, [
                security.PERMISSIONS.MANAGE_USERS, // doesn't have
                security.PERMISSIONS.VIEW_ALL_ORDERS // has this
            ]);
            expect(result).toBe(true);
        });

        it('should return false if user has none of the permissions', () => {
            const user = { role: 'customer' };
            const result = security.hasAnyPermission(user, [
                security.PERMISSIONS.MANAGE_USERS,
                security.PERMISSIONS.EDIT_SETTINGS
            ]);
            expect(result).toBe(false);
        });
    });

    describe('hasAllPermissions()', () => {
        it('should return true only if user has all permissions', () => {
            const user = { role: 'website_admin' };
            const result = security.hasAllPermissions(user, [
                security.PERMISSIONS.VIEW_USERS,
                security.PERMISSIONS.MANAGE_USERS
            ]);
            expect(result).toBe(true);
        });

        it('should return false if missing any permission', () => {
            const user = { role: 'business_processing' };
            const result = security.hasAllPermissions(user, [
                security.PERMISSIONS.VIEW_ALL_ORDERS, // has
                security.PERMISSIONS.MANAGE_USERS // doesn't have
            ]);
            expect(result).toBe(false);
        });
    });

    describe('hasRole()', () => {
        it('should return true for matching role', () => {
            const user = { role: 'website_admin' };
            expect(security.hasRole(user, ['website_admin', 'business_processing'])).toBe(true);
        });

        it('should return false for non-matching role', () => {
            const user = { role: 'customer' };
            expect(security.hasRole(user, ['website_admin', 'business_processing'])).toBe(false);
        });

        it('should return false for null user', () => {
            expect(security.hasRole(null, ['website_admin'])).toBe(false);
        });

        it('should return false for user without role', () => {
            expect(security.hasRole({}, ['website_admin'])).toBe(false);
        });
    });

    describe('requirePermission()', () => {
        const headers = { 'Content-Type': 'application/json' };

        it('should return null (authorized) when user has permission', () => {
            const user = { role: 'website_admin' };
            const result = security.requirePermission(
                user,
                security.PERMISSIONS.MANAGE_USERS,
                headers
            );
            expect(result).toBeNull();
        });

        it('should return 403 response when user lacks permission', () => {
            const user = { role: 'customer' };
            const result = security.requirePermission(
                user,
                security.PERMISSIONS.MANAGE_USERS,
                headers
            );

            expect(result.statusCode).toBe(403);
            expect(JSON.parse(result.body).error).toContain('permission');
        });

        it('should accept array of permissions (any match = allowed)', () => {
            const user = { role: 'business_processing' };
            const result = security.requirePermission(
                user,
                [security.PERMISSIONS.MANAGE_USERS, security.PERMISSIONS.VIEW_ALL_ORDERS],
                headers
            );
            expect(result).toBeNull(); // Has VIEW_ALL_ORDERS
        });
    });

    describe('requireRole()', () => {
        const headers = { 'Content-Type': 'application/json' };

        it('should return null when user has required role', () => {
            const user = { role: 'website_admin' };
            const result = security.requireRole(user, 'website_admin', headers);
            expect(result).toBeNull();
        });

        it('should return 403 when user lacks required role', () => {
            const user = { role: 'customer' };
            const result = security.requireRole(user, 'website_admin', headers);

            expect(result.statusCode).toBe(403);
        });

        it('should accept array of roles', () => {
            const user = { role: 'business_processing' };
            const result = security.requireRole(
                user,
                ['website_admin', 'business_processing'],
                headers
            );
            expect(result).toBeNull();
        });
    });

    describe('Role Permission Mapping', () => {
        describe('WEBSITE_ADMIN role', () => {
            const admin = { role: 'website_admin' };

            it('should have admin permissions', () => {
                expect(security.hasPermission(admin, security.PERMISSIONS.VIEW_ALL_ORDERS)).toBe(true);
                expect(security.hasPermission(admin, security.PERMISSIONS.VIEW_SETTINGS)).toBe(true);
                expect(security.hasPermission(admin, security.PERMISSIONS.EDIT_SETTINGS)).toBe(true);
                expect(security.hasPermission(admin, security.PERMISSIONS.VIEW_USERS)).toBe(true);
                expect(security.hasPermission(admin, security.PERMISSIONS.MANAGE_USERS)).toBe(true);
                expect(security.hasPermission(admin, security.PERMISSIONS.VIEW_AUDIT_LOGS)).toBe(true);
            });

            it('should NOT have VIEW_OWN_ORDERS (that is customer-only)', () => {
                // Admins view ALL orders, not "own" orders
                expect(security.hasPermission(admin, security.PERMISSIONS.VIEW_OWN_ORDERS)).toBe(false);
            });
        });

        describe('BUSINESS_PROCESSING role', () => {
            const business = { role: 'business_processing' };

            it('should have order and product permissions', () => {
                expect(security.hasPermission(business, security.PERMISSIONS.VIEW_ALL_ORDERS)).toBe(true);
                expect(security.hasPermission(business, security.PERMISSIONS.UPDATE_ORDER_STATUS)).toBe(true);
                expect(security.hasPermission(business, security.PERMISSIONS.CREATE_PRODUCTS)).toBe(true);
                expect(security.hasPermission(business, security.PERMISSIONS.EDIT_PRODUCTS)).toBe(true);
                expect(security.hasPermission(business, security.PERMISSIONS.DELETE_PRODUCTS)).toBe(true);
            });

            it('should NOT have admin-only permissions', () => {
                expect(security.hasPermission(business, security.PERMISSIONS.MANAGE_USERS)).toBe(false);
                expect(security.hasPermission(business, security.PERMISSIONS.EDIT_SETTINGS)).toBe(false);
                expect(security.hasPermission(business, security.PERMISSIONS.VIEW_AUDIT_LOGS)).toBe(false);
            });
        });

        describe('CUSTOMER role', () => {
            const customer = { role: 'customer' };

            it('should only have VIEW_OWN_ORDERS permission', () => {
                expect(security.hasPermission(customer, security.PERMISSIONS.VIEW_OWN_ORDERS)).toBe(true);
            });

            it('should NOT have any admin permissions', () => {
                expect(security.hasPermission(customer, security.PERMISSIONS.VIEW_ALL_ORDERS)).toBe(false);
                expect(security.hasPermission(customer, security.PERMISSIONS.CREATE_PRODUCTS)).toBe(false);
                expect(security.hasPermission(customer, security.PERMISSIONS.MANAGE_USERS)).toBe(false);
            });
        });
    });

    describe('getCorsHeaders()', () => {
        it('should return allowed origin when in whitelist', () => {
            const headers = security.getCorsHeaders('http://localhost:8888');
            expect(headers['Access-Control-Allow-Origin']).toBe('http://localhost:8888');
        });

        it('should return first allowed origin for unknown origin', () => {
            const headers = security.getCorsHeaders('http://evil.com');
            // Should NOT return evil.com
            expect(headers['Access-Control-Allow-Origin']).not.toBe('http://evil.com');
        });

        it('should include required CORS headers', () => {
            const headers = security.getCorsHeaders('http://localhost:8888');

            expect(headers['Access-Control-Allow-Headers']).toContain('Authorization');
            expect(headers['Access-Control-Allow-Methods']).toContain('GET');
            expect(headers['Access-Control-Allow-Methods']).toContain('POST');
            expect(headers['Access-Control-Allow-Credentials']).toBe('true');
        });

        it('should allow custom methods', () => {
            const headers = security.getCorsHeaders('http://localhost:8888', ['GET']);
            expect(headers['Access-Control-Allow-Methods']).toBe('GET');
        });
    });

    describe('errorResponse()', () => {
        it('should return properly formatted error response', () => {
            const headers = { 'Content-Type': 'application/json' };
            const response = security.errorResponse(400, 'Bad request', headers);

            expect(response.statusCode).toBe(400);
            expect(response.headers).toBe(headers);
            expect(JSON.parse(response.body)).toEqual({ error: 'Bad request' });
        });
    });

    describe('successResponse()', () => {
        it('should return properly formatted success response', () => {
            const headers = { 'Content-Type': 'application/json' };
            const data = { id: 1, name: 'Test' };
            const response = security.successResponse(data, headers);

            expect(response.statusCode).toBe(200);
            expect(JSON.parse(response.body)).toEqual(data);
        });

        it('should allow custom status code', () => {
            const response = security.successResponse({ created: true }, {}, 201);
            expect(response.statusCode).toBe(201);
        });
    });

    describe('getClientIP()', () => {
        it('should extract IP from x-forwarded-for header', () => {
            const event = {
                headers: {
                    'x-forwarded-for': '192.168.1.1, 10.0.0.1'
                }
            };
            expect(security.getClientIP(event)).toBe('192.168.1.1');
        });

        it('should fallback to x-real-ip', () => {
            const event = {
                headers: {
                    'x-real-ip': '10.0.0.5'
                }
            };
            expect(security.getClientIP(event)).toBe('10.0.0.5');
        });

        it('should fallback to client-ip', () => {
            const event = {
                headers: {
                    'client-ip': '172.16.0.1'
                }
            };
            expect(security.getClientIP(event)).toBe('172.16.0.1');
        });

        it('should return unknown for missing headers', () => {
            expect(security.getClientIP({})).toBe('unknown');
            expect(security.getClientIP(null)).toBe('unknown');
        });
    });

    describe('isSecretConfigured()', () => {
        it('should return true when JWT_SECRET is set', async () => {
            process.env.JWT_SECRET = 'some-secret';
            vi.resetModules();
            security = await import('../../../netlify/functions/utils/security.js');
            expect(security.isSecretConfigured()).toBe(true);
        });
    });
});
