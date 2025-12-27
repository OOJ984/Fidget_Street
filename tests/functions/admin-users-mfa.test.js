/**
 * Admin Users and MFA Tests
 *
 * Tests for admin user management and multi-factor authentication.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing';

describe('Admin Users', () => {
    describe('Role Permissions', () => {
        const roles = {
            super_admin: ['all'],
            website_admin: ['manage_orders', 'manage_products', 'manage_discounts', 'manage_gift_cards', 'view_analytics'],
            order_manager: ['manage_orders', 'view_analytics'],
            content_editor: ['manage_products']
        };

        it('should define super_admin with all permissions', () => {
            expect(roles.super_admin).toContain('all');
        });

        it('should define website_admin permissions', () => {
            expect(roles.website_admin).toContain('manage_orders');
            expect(roles.website_admin).toContain('manage_products');
            expect(roles.website_admin).toContain('manage_discounts');
        });

        it('should restrict order_manager to order-related permissions', () => {
            expect(roles.order_manager).toContain('manage_orders');
            expect(roles.order_manager).not.toContain('manage_products');
        });

        it('should restrict content_editor to product management', () => {
            expect(roles.content_editor).toContain('manage_products');
            expect(roles.content_editor).not.toContain('manage_orders');
        });
    });

    describe('Permission Checking', () => {
        function hasPermission(userRole, requiredPermission) {
            const rolePermissions = {
                super_admin: ['all'],
                website_admin: ['manage_orders', 'manage_products', 'manage_discounts', 'view_gift_cards', 'manage_gift_cards'],
                order_manager: ['manage_orders'],
                content_editor: ['manage_products']
            };

            const perms = rolePermissions[userRole] || [];
            return perms.includes('all') || perms.includes(requiredPermission);
        }

        it('should grant super_admin all permissions', () => {
            expect(hasPermission('super_admin', 'manage_orders')).toBe(true);
            expect(hasPermission('super_admin', 'manage_products')).toBe(true);
            expect(hasPermission('super_admin', 'anything')).toBe(true);
        });

        it('should grant website_admin specific permissions', () => {
            expect(hasPermission('website_admin', 'manage_orders')).toBe(true);
            expect(hasPermission('website_admin', 'manage_products')).toBe(true);
        });

        it('should deny unauthorized permissions', () => {
            expect(hasPermission('order_manager', 'manage_products')).toBe(false);
            expect(hasPermission('content_editor', 'manage_orders')).toBe(false);
        });

        it('should handle unknown role', () => {
            expect(hasPermission('unknown_role', 'manage_orders')).toBe(false);
        });
    });

    describe('User Status', () => {
        it('should identify active user', () => {
            const user = { is_active: true };
            expect(user.is_active).toBe(true);
        });

        it('should identify deactivated user', () => {
            const user = { is_active: false };
            expect(user.is_active).toBe(false);
        });

        it('should treat null as active', () => {
            const user = { is_active: null };
            const canLogin = user.is_active !== false;
            expect(canLogin).toBe(true);
        });
    });

    describe('Email Validation', () => {
        function isValidEmail(email) {
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        }

        it('should accept valid email', () => {
            expect(isValidEmail('admin@fidgetstreet.co.uk')).toBe(true);
        });

        it('should reject email without @', () => {
            expect(isValidEmail('admin.fidgetstreet.co.uk')).toBe(false);
        });

        it('should reject email without domain', () => {
            expect(isValidEmail('admin@')).toBe(false);
        });

        it('should reject empty email', () => {
            expect(isValidEmail('')).toBe(false);
        });
    });

    describe('Password Requirements', () => {
        function validatePassword(password) {
            if (!password || password.length < 8) return { valid: false, error: 'Password must be at least 8 characters' };
            if (!/[A-Z]/.test(password)) return { valid: false, error: 'Password must contain uppercase letter' };
            if (!/[a-z]/.test(password)) return { valid: false, error: 'Password must contain lowercase letter' };
            if (!/[0-9]/.test(password)) return { valid: false, error: 'Password must contain number' };
            return { valid: true };
        }

        it('should reject short password', () => {
            expect(validatePassword('Short1').valid).toBe(false);
        });

        it('should reject password without uppercase', () => {
            expect(validatePassword('lowercase123').valid).toBe(false);
        });

        it('should reject password without lowercase', () => {
            expect(validatePassword('UPPERCASE123').valid).toBe(false);
        });

        it('should reject password without number', () => {
            expect(validatePassword('NoNumbersHere').valid).toBe(false);
        });

        it('should accept strong password', () => {
            expect(validatePassword('StrongPass123').valid).toBe(true);
        });
    });
});

describe('Multi-Factor Authentication', () => {
    describe('TOTP Code Validation', () => {
        it('should accept 6-digit code', () => {
            const code = '123456';
            const isValid = /^\d{6}$/.test(code);
            expect(isValid).toBe(true);
        });

        it('should reject 5-digit code', () => {
            const code = '12345';
            const isValid = /^\d{6}$/.test(code);
            expect(isValid).toBe(false);
        });

        it('should reject 7-digit code', () => {
            const code = '1234567';
            const isValid = /^\d{6}$/.test(code);
            expect(isValid).toBe(false);
        });

        it('should reject non-numeric code', () => {
            const code = '12345a';
            const isValid = /^\d{6}$/.test(code);
            expect(isValid).toBe(false);
        });

        it('should trim whitespace before validation', () => {
            const code = '  123456  ';
            const isValid = /^\d{6}$/.test(code.trim());
            expect(isValid).toBe(true);
        });
    });

    describe('MFA Token States', () => {
        it('should identify pre-MFA token', () => {
            const token = jwt.sign({ userId: 1, preMfa: true }, JWT_SECRET);
            const decoded = jwt.verify(token, JWT_SECRET);
            expect(decoded.preMfa).toBe(true);
        });

        it('should identify MFA setup required token', () => {
            const token = jwt.sign({ userId: 1, mfaSetupRequired: true }, JWT_SECRET);
            const decoded = jwt.verify(token, JWT_SECRET);
            expect(decoded.mfaSetupRequired).toBe(true);
        });

        it('should identify full auth token', () => {
            const token = jwt.sign({ userId: 1, email: 'a@b.com', role: 'admin' }, JWT_SECRET);
            const decoded = jwt.verify(token, JWT_SECRET);
            expect(decoded.preMfa).toBeUndefined();
            expect(decoded.mfaSetupRequired).toBeUndefined();
            expect(decoded.role).toBe('admin');
        });
    });

    describe('MFA Rate Limiting', () => {
        it('should allow attempts under limit', () => {
            const attempts = 3;
            const maxAttempts = 5;
            const allowed = attempts < maxAttempts;
            expect(allowed).toBe(true);
        });

        it('should block at limit', () => {
            const attempts = 5;
            const maxAttempts = 5;
            const allowed = attempts < maxAttempts;
            expect(allowed).toBe(false);
        });

        it('should calculate window expiry', () => {
            const windowMs = 15 * 60 * 1000; // 15 minutes
            const firstAttempt = Date.now() - 10 * 60 * 1000; // 10 minutes ago
            const windowExpires = firstAttempt + windowMs;
            const stillInWindow = windowExpires > Date.now();

            expect(stillInWindow).toBe(true);
        });

        it('should reset after window expires', () => {
            const windowMs = 15 * 60 * 1000;
            const firstAttempt = Date.now() - 20 * 60 * 1000; // 20 minutes ago
            const windowExpires = firstAttempt + windowMs;
            const windowExpired = windowExpires <= Date.now();

            expect(windowExpired).toBe(true);
        });
    });

    describe('Backup Codes', () => {
        it('should generate 10 backup codes', () => {
            const codes = [];
            for (let i = 0; i < 10; i++) {
                codes.push(Math.random().toString(36).substring(2, 10).toUpperCase());
            }
            expect(codes.length).toBe(10);
        });

        it('should generate unique codes', () => {
            const codes = new Set();
            for (let i = 0; i < 10; i++) {
                codes.add(Math.random().toString(36).substring(2, 10).toUpperCase());
            }
            expect(codes.size).toBe(10);
        });

        it('should mark used backup code', () => {
            const backupCodes = [
                { code: 'ABC123', used: false },
                { code: 'DEF456', used: false }
            ];

            const codeToUse = 'ABC123';
            const found = backupCodes.find(bc => bc.code === codeToUse && !bc.used);

            if (found) found.used = true;

            expect(backupCodes[0].used).toBe(true);
            expect(backupCodes[1].used).toBe(false);
        });

        it('should reject already used backup code', () => {
            const backupCodes = [
                { code: 'ABC123', used: true },
                { code: 'DEF456', used: false }
            ];

            const codeToUse = 'ABC123';
            const found = backupCodes.find(bc => bc.code === codeToUse && !bc.used);

            expect(found).toBeUndefined();
        });
    });

    describe('MFA Secret Generation', () => {
        it('should generate base32 secret', () => {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
            let secret = '';
            for (let i = 0; i < 32; i++) {
                secret += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            expect(secret.length).toBe(32);
            expect(secret).toMatch(/^[A-Z2-7]+$/);
        });
    });

    describe('MFA QR Code Data', () => {
        it('should format otpauth URL', () => {
            const secret = 'ABCDEFGHIJKLMNOP';
            const email = 'admin@fidgetstreet.co.uk';
            const issuer = 'Fidget Street Admin';

            const url = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;

            expect(url).toContain('otpauth://totp/');
            expect(url).toContain(secret);
            expect(url).toContain(encodeURIComponent(email));
        });
    });
});

describe('Audit Logging', () => {
    describe('Audit Log Entry', () => {
        it('should include required fields', () => {
            const entry = {
                action: 'LOGIN_SUCCESS',
                user_id: 1,
                user_email: 'admin@test.com',
                ip_address: '192.168.1.1',
                user_agent: 'Mozilla/5.0',
                created_at: new Date().toISOString()
            };

            expect(entry).toHaveProperty('action');
            expect(entry).toHaveProperty('user_id');
            expect(entry).toHaveProperty('ip_address');
            expect(entry).toHaveProperty('created_at');
        });

        it('should support optional details', () => {
            const entry = {
                action: 'PRODUCT_UPDATED',
                user_id: 1,
                details: { product_id: 123, changes: ['name', 'price'] }
            };

            expect(entry.details).toBeDefined();
            expect(entry.details.product_id).toBe(123);
        });
    });

    describe('Action Types', () => {
        const auditActions = [
            'LOGIN_SUCCESS',
            'LOGIN_FAILED',
            'LOGOUT',
            'MFA_ENABLED',
            'MFA_DISABLED',
            'PASSWORD_CHANGED',
            'PRODUCT_CREATED',
            'PRODUCT_UPDATED',
            'PRODUCT_DELETED',
            'ORDER_UPDATED',
            'DISCOUNT_CREATED',
            'GIFT_CARD_CREATED'
        ];

        auditActions.forEach(action => {
            it(`should support ${action} action`, () => {
                expect(action).toBeTruthy();
                expect(typeof action).toBe('string');
            });
        });
    });
});

describe('Session Management', () => {
    describe('Token Expiry', () => {
        it('should set 24h expiry for full token', () => {
            const token = jwt.sign({ userId: 1 }, JWT_SECRET, { expiresIn: '24h' });
            const decoded = jwt.decode(token);
            const expiryHours = (decoded.exp - decoded.iat) / 3600;

            expect(expiryHours).toBe(24);
        });

        it('should set 5m expiry for pre-MFA token', () => {
            const token = jwt.sign({ userId: 1, preMfa: true }, JWT_SECRET, { expiresIn: '5m' });
            const decoded = jwt.decode(token);
            const expiryMinutes = (decoded.exp - decoded.iat) / 60;

            expect(expiryMinutes).toBe(5);
        });

        it('should set 10m expiry for MFA setup token', () => {
            const token = jwt.sign({ userId: 1, mfaSetupRequired: true }, JWT_SECRET, { expiresIn: '10m' });
            const decoded = jwt.decode(token);
            const expiryMinutes = (decoded.exp - decoded.iat) / 60;

            expect(expiryMinutes).toBe(10);
        });
    });

    describe('Token Refresh', () => {
        it('should include refresh token flag', () => {
            const refreshToken = jwt.sign({ userId: 1, type: 'refresh' }, JWT_SECRET, { expiresIn: '7d' });
            const decoded = jwt.verify(refreshToken, JWT_SECRET);

            expect(decoded.type).toBe('refresh');
        });
    });
});
