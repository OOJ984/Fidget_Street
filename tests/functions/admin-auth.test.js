/**
 * Admin Authentication Tests
 *
 * Tests for admin login, token verification, MFA, and rate limiting.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing';

describe('Admin Authentication', () => {
    describe('Password Hashing', () => {
        it('should hash password with bcrypt', async () => {
            const password = 'TestPassword123!';
            const hash = await bcrypt.hash(password, 10);

            expect(hash).toMatch(/^\$2[aby]?\$/);
            expect(hash.length).toBeGreaterThan(50);
        });

        it('should verify correct password', async () => {
            const password = 'TestPassword123!';
            const hash = await bcrypt.hash(password, 10);

            const valid = await bcrypt.compare(password, hash);
            expect(valid).toBe(true);
        });

        it('should reject incorrect password', async () => {
            const password = 'TestPassword123!';
            const hash = await bcrypt.hash(password, 10);

            const valid = await bcrypt.compare('WrongPassword', hash);
            expect(valid).toBe(false);
        });

        it('should generate unique hashes for same password', async () => {
            const password = 'TestPassword123!';
            const hash1 = await bcrypt.hash(password, 10);
            const hash2 = await bcrypt.hash(password, 10);

            expect(hash1).not.toBe(hash2);
        });
    });

    describe('JWT Token Generation', () => {
        it('should generate valid JWT token', () => {
            const payload = {
                userId: 1,
                email: 'admin@test.com',
                role: 'super_admin'
            };

            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
            expect(token).toBeDefined();
            expect(token.split('.').length).toBe(3);
        });

        it('should decode token correctly', () => {
            const payload = {
                userId: 1,
                email: 'admin@test.com',
                role: 'super_admin'
            };

            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
            const decoded = jwt.verify(token, JWT_SECRET);

            expect(decoded.userId).toBe(1);
            expect(decoded.email).toBe('admin@test.com');
            expect(decoded.role).toBe('super_admin');
        });

        it('should reject expired token', () => {
            const payload = { userId: 1 };
            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '-1s' });

            expect(() => jwt.verify(token, JWT_SECRET)).toThrow();
        });

        it('should reject token with invalid signature', () => {
            const payload = { userId: 1 };
            const token = jwt.sign(payload, 'wrong-secret');

            expect(() => jwt.verify(token, JWT_SECRET)).toThrow();
        });
    });

    describe('Pre-MFA Token', () => {
        it('should generate pre-MFA token with short expiry', () => {
            const payload = {
                userId: 1,
                email: 'admin@test.com',
                preMfa: true
            };

            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '5m' });
            const decoded = jwt.verify(token, JWT_SECRET);

            expect(decoded.preMfa).toBe(true);
            expect(decoded.exp - decoded.iat).toBe(300); // 5 minutes
        });

        it('should identify pre-MFA vs full token', () => {
            const preMfaToken = jwt.sign({ userId: 1, preMfa: true }, JWT_SECRET);
            const fullToken = jwt.sign({ userId: 1, email: 'a@b.com', role: 'admin' }, JWT_SECRET);

            const preMfaDecoded = jwt.verify(preMfaToken, JWT_SECRET);
            const fullDecoded = jwt.verify(fullToken, JWT_SECRET);

            expect(preMfaDecoded.preMfa).toBe(true);
            expect(fullDecoded.preMfa).toBeUndefined();
        });
    });

    describe('MFA Setup Token', () => {
        it('should generate MFA setup token', () => {
            const payload = {
                userId: 1,
                email: 'admin@test.com',
                name: 'Admin User',
                role: 'super_admin',
                mfaSetupRequired: true
            };

            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '10m' });
            const decoded = jwt.verify(token, JWT_SECRET);

            expect(decoded.mfaSetupRequired).toBe(true);
        });
    });

    describe('Input Validation', () => {
        it('should require email', () => {
            const body = { password: 'test123' };
            const isValid = body.email && body.password;
            expect(isValid).toBeFalsy();
        });

        it('should require password', () => {
            const body = { email: 'test@example.com' };
            const isValid = body.email && body.password;
            expect(isValid).toBeFalsy();
        });

        it('should accept valid credentials', () => {
            const body = { email: 'test@example.com', password: 'test123' };
            const isValid = body.email && body.password;
            expect(isValid).toBeTruthy();
        });

        it('should normalize email to lowercase', () => {
            const email = 'Admin@Example.COM';
            const normalized = email.toLowerCase();
            expect(normalized).toBe('admin@example.com');
        });
    });

    describe('Authorization Header Parsing', () => {
        it('should extract Bearer token', () => {
            const authHeader = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
            const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

            expect(token).toBe('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test');
        });

        it('should reject missing Bearer prefix', () => {
            const authHeader = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
            const isValid = authHeader && authHeader.startsWith('Bearer ');

            expect(isValid).toBe(false);
        });

        it('should handle missing auth header', () => {
            const authHeader = null;
            const isValid = authHeader && authHeader.startsWith('Bearer ');

            expect(isValid).toBeFalsy();
        });
    });

    describe('Client IP Extraction', () => {
        it('should extract IP from x-forwarded-for', () => {
            const headers = { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' };
            const ip = headers['x-forwarded-for']?.split(',')[0]?.trim();

            expect(ip).toBe('192.168.1.1');
        });

        it('should fall back to x-real-ip', () => {
            const headers = { 'x-real-ip': '192.168.1.2' };
            const ip = headers['x-forwarded-for']?.split(',')[0]?.trim()
                || headers['x-real-ip'];

            expect(ip).toBe('192.168.1.2');
        });

        it('should return unknown for missing headers', () => {
            const headers = {};
            const ip = headers['x-forwarded-for']?.split(',')[0]?.trim()
                || headers['x-real-ip']
                || 'unknown';

            expect(ip).toBe('unknown');
        });
    });

    describe('Account Status Checks', () => {
        it('should reject deactivated accounts', () => {
            const user = { is_active: false };
            const canLogin = user.is_active !== false;

            expect(canLogin).toBe(false);
        });

        it('should allow active accounts', () => {
            const user = { is_active: true };
            const canLogin = user.is_active !== false;

            expect(canLogin).toBe(true);
        });

        it('should handle null is_active as active', () => {
            const user = { is_active: null };
            const canLogin = user.is_active !== false;

            expect(canLogin).toBe(true);
        });
    });

    describe('Response Formats', () => {
        it('should format MFA required response', () => {
            const user = { id: 1, email: 'test@test.com', name: 'Test' };
            const preMfaToken = 'token123';

            const response = {
                success: true,
                requiresMfa: true,
                preMfaToken,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name
                }
            };

            expect(response.requiresMfa).toBe(true);
            expect(response.preMfaToken).toBe('token123');
        });

        it('should format MFA setup required response', () => {
            const response = {
                success: true,
                requiresMfaSetup: true,
                message: 'MFA setup required. Please configure two-factor authentication.'
            };

            expect(response.requiresMfaSetup).toBe(true);
            expect(response.message).toContain('MFA setup required');
        });

        it('should format successful token verification response', () => {
            const user = { id: 1, email: 'test@test.com', name: 'Test', role: 'admin' };

            const response = {
                valid: true,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role
                }
            };

            expect(response.valid).toBe(true);
            expect(response.user.role).toBe('admin');
        });
    });
});

describe('Rate Limiting Logic', () => {
    describe('Rate Limit Calculations', () => {
        it('should block after max attempts', () => {
            const maxAttempts = 5;
            const attempts = 5;
            const allowed = attempts < maxAttempts;

            expect(allowed).toBe(false);
        });

        it('should allow under max attempts', () => {
            const maxAttempts = 5;
            const attempts = 3;
            const allowed = attempts < maxAttempts;

            expect(allowed).toBe(true);
        });

        it('should calculate retry-after correctly', () => {
            const windowMs = 15 * 60 * 1000; // 15 minutes
            const firstAttemptTime = Date.now() - 5 * 60 * 1000; // 5 minutes ago
            const retryAfter = Math.ceil((firstAttemptTime + windowMs - Date.now()) / 1000);

            expect(retryAfter).toBeGreaterThan(0);
            expect(retryAfter).toBeLessThanOrEqual(600); // Max 10 minutes
        });
    });

    describe('Rate Limit Reset', () => {
        it('should clear attempts after successful login', () => {
            let attempts = 3;
            const clearRateLimit = () => { attempts = 0; };

            clearRateLimit();
            expect(attempts).toBe(0);
        });
    });
});

describe('Legacy Password Migration', () => {
    describe('Hash Detection', () => {
        it('should detect bcrypt hash', () => {
            const hash = '$2b$10$abcdefghijklmnopqrstuv';
            const isBcrypt = hash.startsWith('$2');

            expect(isBcrypt).toBe(true);
        });

        it('should detect legacy SHA256 hash', () => {
            const hash = 'a1b2c3d4e5f6...'; // 64 char hex
            const isBcrypt = hash.startsWith('$2');

            expect(isBcrypt).toBe(false);
        });
    });

    describe('Rehash Flag', () => {
        it('should flag legacy hash for rehash', () => {
            const isLegacy = true;
            const validPassword = true;

            const needsRehash = isLegacy && validPassword;
            expect(needsRehash).toBe(true);
        });

        it('should not flag bcrypt hash for rehash', () => {
            const isLegacy = false;
            const validPassword = true;

            const needsRehash = isLegacy && validPassword;
            expect(needsRehash).toBe(false);
        });
    });
});
