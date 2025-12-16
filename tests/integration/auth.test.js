/**
 * Admin Authentication Tests
 *
 * Tests for authentication logic including:
 * - Rate limiting
 * - Password hashing (bcrypt + legacy SHA256)
 * - JWT token handling
 * - MFA token flows
 *
 * Note: Full integration tests with Supabase require a test database.
 * These tests focus on the security-critical pure functions.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const JWT_SECRET = 'test-jwt-secret-key';

// ============================================
// Rate Limiting Tests
// ============================================

describe('Rate Limiting', () => {
    const MAX_ATTEMPTS_PER_EMAIL = 5;
    const MAX_ATTEMPTS_PER_IP = 20;
    const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

    function createRateLimiter() {
        const loginAttempts = new Map();

        return {
            checkRateLimit(email, ip) {
                const now = Date.now();
                const emailKey = `email:${email.toLowerCase()}`;
                const ipKey = `ip:${ip}`;

                for (const [key, data] of loginAttempts.entries()) {
                    if (data.resetAt < now) {
                        loginAttempts.delete(key);
                    }
                }

                const emailData = loginAttempts.get(emailKey);
                if (emailData && emailData.attempts >= MAX_ATTEMPTS_PER_EMAIL && emailData.resetAt > now) {
                    return {
                        allowed: false,
                        retryAfter: Math.ceil((emailData.resetAt - now) / 1000)
                    };
                }

                const ipData = loginAttempts.get(ipKey);
                if (ipData && ipData.attempts >= MAX_ATTEMPTS_PER_IP && ipData.resetAt > now) {
                    return {
                        allowed: false,
                        retryAfter: Math.ceil((ipData.resetAt - now) / 1000)
                    };
                }

                return { allowed: true, retryAfter: null };
            },

            recordFailedAttempt(email, ip) {
                const now = Date.now();
                const emailKey = `email:${email.toLowerCase()}`;
                const ipKey = `ip:${ip}`;

                const emailData = loginAttempts.get(emailKey) || { attempts: 0, resetAt: now + LOCKOUT_DURATION_MS };
                emailData.attempts++;
                if (emailData.attempts === 1) {
                    emailData.resetAt = now + LOCKOUT_DURATION_MS;
                }
                loginAttempts.set(emailKey, emailData);

                const ipData = loginAttempts.get(ipKey) || { attempts: 0, resetAt: now + LOCKOUT_DURATION_MS };
                ipData.attempts++;
                if (ipData.attempts === 1) {
                    ipData.resetAt = now + LOCKOUT_DURATION_MS;
                }
                loginAttempts.set(ipKey, ipData);
            },

            clearRateLimit(email) {
                const emailKey = `email:${email.toLowerCase()}`;
                loginAttempts.delete(emailKey);
            },

            getAttempts(email) {
                const emailKey = `email:${email.toLowerCase()}`;
                return loginAttempts.get(emailKey)?.attempts || 0;
            }
        };
    }

    it('should allow first login attempt', () => {
        const limiter = createRateLimiter();
        const result = limiter.checkRateLimit('test@test.com', '192.168.1.1');
        expect(result.allowed).toBe(true);
        expect(result.retryAfter).toBeNull();
    });

    it('should allow attempts under the limit', () => {
        const limiter = createRateLimiter();
        const email = 'test@test.com';
        const ip = '10.0.0.1';

        for (let i = 0; i < MAX_ATTEMPTS_PER_EMAIL - 1; i++) {
            limiter.recordFailedAttempt(email, ip);
        }

        const result = limiter.checkRateLimit(email, ip);
        expect(result.allowed).toBe(true);
    });

    it('should block after max email attempts', () => {
        const limiter = createRateLimiter();
        const email = 'blocked@test.com';
        const ip = '10.0.0.1';

        for (let i = 0; i < MAX_ATTEMPTS_PER_EMAIL; i++) {
            limiter.recordFailedAttempt(email, ip);
        }

        const result = limiter.checkRateLimit(email, ip);
        expect(result.allowed).toBe(false);
        expect(result.retryAfter).toBeGreaterThan(0);
        expect(result.retryAfter).toBeLessThanOrEqual(15 * 60); // Max 15 minutes
    });

    it('should block IP after max IP attempts', () => {
        const limiter = createRateLimiter();
        const ip = '192.168.1.100';

        for (let i = 0; i < MAX_ATTEMPTS_PER_IP; i++) {
            limiter.recordFailedAttempt(`user${i}@test.com`, ip);
        }

        const result = limiter.checkRateLimit('newuser@test.com', ip);
        expect(result.allowed).toBe(false);
    });

    it('should clear rate limit on successful login', () => {
        const limiter = createRateLimiter();
        const email = 'cleared@test.com';

        limiter.recordFailedAttempt(email, '10.0.0.1');
        limiter.recordFailedAttempt(email, '10.0.0.1');
        expect(limiter.getAttempts(email)).toBe(2);

        limiter.clearRateLimit(email);
        expect(limiter.getAttempts(email)).toBe(0);

        const result = limiter.checkRateLimit(email, '10.0.0.1');
        expect(result.allowed).toBe(true);
    });

    it('should handle case-insensitive email for rate limiting', () => {
        const limiter = createRateLimiter();

        limiter.recordFailedAttempt('Test@Example.com', '10.0.0.1');
        limiter.recordFailedAttempt('TEST@EXAMPLE.COM', '10.0.0.1');
        limiter.recordFailedAttempt('test@example.com', '10.0.0.1');

        expect(limiter.getAttempts('TEST@example.COM')).toBe(3);
    });

    it('should track email and IP independently', () => {
        const limiter = createRateLimiter();
        const email = 'multi@test.com';

        // Hit email limit from IP1
        for (let i = 0; i < MAX_ATTEMPTS_PER_EMAIL; i++) {
            limiter.recordFailedAttempt(email, '10.0.0.1');
        }

        // Same email should be blocked from any IP
        const result1 = limiter.checkRateLimit(email, '10.0.0.2');
        expect(result1.allowed).toBe(false);

        // Different email from IP1 should still work (under IP limit)
        const result2 = limiter.checkRateLimit('other@test.com', '10.0.0.1');
        expect(result2.allowed).toBe(true);
    });
});

// ============================================
// Password Hashing Tests
// ============================================

describe('Password Hashing', () => {
    const BCRYPT_ROUNDS = 12;

    describe('bcrypt', () => {
        it('should hash password with bcrypt', async () => {
            const password = 'MySecurePassword123!';
            const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

            expect(hash).toMatch(/^\$2[aby]?\$/);
            expect(hash.length).toBeGreaterThan(50);
        });

        it('should verify correct password', async () => {
            const password = 'CorrectPassword';
            const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

            const isValid = await bcrypt.compare(password, hash);
            expect(isValid).toBe(true);
        });

        it('should reject incorrect password', async () => {
            const password = 'CorrectPassword';
            const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

            const isValid = await bcrypt.compare('WrongPassword', hash);
            expect(isValid).toBe(false);
        });

        it('should generate unique hashes for same password', async () => {
            const password = 'SamePassword';
            const hash1 = await bcrypt.hash(password, BCRYPT_ROUNDS);
            const hash2 = await bcrypt.hash(password, BCRYPT_ROUNDS);

            expect(hash1).not.toBe(hash2);
            // But both should verify
            expect(await bcrypt.compare(password, hash1)).toBe(true);
            expect(await bcrypt.compare(password, hash2)).toBe(true);
        });

        it('should handle unicode passwords', async () => {
            const password = 'Пароль123!中文密码';
            const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

            expect(await bcrypt.compare(password, hash)).toBe(true);
            expect(await bcrypt.compare('wrong', hash)).toBe(false);
        });
    });

    describe('Legacy SHA256 verification', () => {
        function verifyLegacyPassword(password, storedHash, secret) {
            const sha256Hash = crypto.createHash('sha256')
                .update(password + secret)
                .digest('hex');
            return sha256Hash === storedHash;
        }

        it('should verify legacy SHA256 hash', () => {
            const password = 'legacyPassword123';
            const secret = 'my-jwt-secret';
            const legacyHash = crypto.createHash('sha256')
                .update(password + secret)
                .digest('hex');

            expect(verifyLegacyPassword(password, legacyHash, secret)).toBe(true);
        });

        it('should reject wrong password with legacy hash', () => {
            const password = 'legacyPassword123';
            const secret = 'my-jwt-secret';
            const legacyHash = crypto.createHash('sha256')
                .update(password + secret)
                .digest('hex');

            expect(verifyLegacyPassword('wrongPassword', legacyHash, secret)).toBe(false);
        });

        it('should detect bcrypt vs SHA256 hash format', () => {
            const bcryptHash = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.PA1/7P.woOuTmO';
            const sha256Hash = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';

            expect(bcryptHash.startsWith('$2')).toBe(true);
            expect(sha256Hash.startsWith('$2')).toBe(false);
        });
    });
});

// ============================================
// JWT Token Tests
// ============================================

describe('JWT Token Security', () => {
    describe('Token Generation', () => {
        it('should create valid JWT with required claims', () => {
            const token = jwt.sign(
                {
                    userId: 1,
                    email: 'admin@test.com',
                    name: 'Admin User',
                    role: 'website_admin',
                    mfaVerified: true
                },
                JWT_SECRET,
                { expiresIn: '24h' }
            );

            const decoded = jwt.verify(token, JWT_SECRET);
            expect(decoded.userId).toBe(1);
            expect(decoded.email).toBe('admin@test.com');
            expect(decoded.role).toBe('website_admin');
            expect(decoded.mfaVerified).toBe(true);
            expect(decoded.exp).toBeDefined();
            expect(decoded.iat).toBeDefined();
        });

        it('should set correct expiration time', () => {
            const token = jwt.sign({ userId: 1 }, JWT_SECRET, { expiresIn: '1h' });
            const decoded = jwt.verify(token, JWT_SECRET);

            const expectedExp = Math.floor(Date.now() / 1000) + 3600;
            expect(decoded.exp).toBeCloseTo(expectedExp, -1); // Within 10 seconds
        });
    });

    describe('Token Verification', () => {
        it('should verify valid token', () => {
            const token = jwt.sign({ userId: 1 }, JWT_SECRET);
            const decoded = jwt.verify(token, JWT_SECRET);
            expect(decoded.userId).toBe(1);
        });

        it('should reject token signed with different secret', () => {
            const token = jwt.sign({ userId: 1 }, 'wrong-secret');
            expect(() => jwt.verify(token, JWT_SECRET)).toThrow();
        });

        it('should reject expired token', async () => {
            const token = jwt.sign({ userId: 1 }, JWT_SECRET, { expiresIn: '1ms' });
            await new Promise(resolve => setTimeout(resolve, 10));
            expect(() => jwt.verify(token, JWT_SECRET)).toThrow(/expired/i);
        });

        it('should reject malformed token', () => {
            expect(() => jwt.verify('not.a.valid.token', JWT_SECRET)).toThrow();
            expect(() => jwt.verify('', JWT_SECRET)).toThrow();
            expect(() => jwt.verify('abc', JWT_SECRET)).toThrow();
        });

        it('should reject token with modified payload', () => {
            const token = jwt.sign(
                { userId: 1, role: 'customer' },
                JWT_SECRET
            );

            // Try to escalate privileges by modifying payload
            const parts = token.split('.');
            const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
            payload.role = 'website_admin';
            parts[1] = Buffer.from(JSON.stringify(payload)).toString('base64url');
            const modifiedToken = parts.join('.');

            expect(() => jwt.verify(modifiedToken, JWT_SECRET)).toThrow();
        });
    });

    describe('Pre-MFA Token', () => {
        it('should create short-lived pre-MFA token', () => {
            const preMfaToken = jwt.sign(
                {
                    userId: 1,
                    email: 'test@test.com',
                    preMfa: true
                },
                JWT_SECRET,
                { expiresIn: '5m' }
            );

            const decoded = jwt.verify(preMfaToken, JWT_SECRET);
            expect(decoded.preMfa).toBe(true);
            expect(decoded.userId).toBe(1);

            // Should expire in about 5 minutes
            const expectedExp = Math.floor(Date.now() / 1000) + 300;
            expect(decoded.exp).toBeCloseTo(expectedExp, -1);
        });

        it('pre-MFA token should NOT have full privileges', () => {
            const preMfaToken = jwt.sign(
                {
                    userId: 1,
                    email: 'test@test.com',
                    preMfa: true
                    // Note: no role, no mfaVerified
                },
                JWT_SECRET,
                { expiresIn: '5m' }
            );

            const decoded = jwt.verify(preMfaToken, JWT_SECRET);
            expect(decoded.preMfa).toBe(true);
            expect(decoded.role).toBeUndefined();
            expect(decoded.mfaVerified).toBeUndefined();
        });
    });

    describe('MFA Setup Token', () => {
        it('should include mfaSetupRequired flag', () => {
            const setupToken = jwt.sign(
                {
                    userId: 1,
                    email: 'newuser@test.com',
                    name: 'New User',
                    role: 'website_admin',
                    mfaSetupRequired: true
                },
                JWT_SECRET,
                { expiresIn: '30m' }
            );

            const decoded = jwt.verify(setupToken, JWT_SECRET);
            expect(decoded.mfaSetupRequired).toBe(true);
            expect(decoded.role).toBe('website_admin');
        });
    });
});

// ============================================
// MFA Backup Codes Tests
// ============================================

describe('MFA Backup Codes', () => {
    const BACKUP_CODE_COUNT = 10;

    function generateBackupCodes() {
        const codes = [];
        for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
            const code = crypto.randomBytes(4).toString('hex').toUpperCase();
            codes.push(code);
        }
        return codes;
    }

    function hashBackupCodes(codes) {
        return codes.map(code =>
            crypto.createHash('sha256').update(code).digest('hex')
        );
    }

    function verifyBackupCode(code, hashedCodes) {
        const hashedInput = crypto.createHash('sha256').update(code.toUpperCase()).digest('hex');
        return hashedCodes.indexOf(hashedInput);
    }

    it('should generate correct number of backup codes', () => {
        const codes = generateBackupCodes();
        expect(codes).toHaveLength(BACKUP_CODE_COUNT);
    });

    it('should generate 8-character hex codes', () => {
        const codes = generateBackupCodes();
        for (const code of codes) {
            expect(code).toMatch(/^[0-9A-F]{8}$/);
        }
    });

    it('should generate unique codes', () => {
        const codes = generateBackupCodes();
        const uniqueCodes = new Set(codes);
        expect(uniqueCodes.size).toBe(codes.length);
    });

    it('should hash backup codes for storage', () => {
        const codes = generateBackupCodes();
        const hashed = hashBackupCodes(codes);

        expect(hashed).toHaveLength(codes.length);
        for (const hash of hashed) {
            expect(hash).toMatch(/^[0-9a-f]{64}$/); // SHA256 produces 64 hex chars
        }
    });

    it('should verify valid backup code', () => {
        const codes = generateBackupCodes();
        const hashed = hashBackupCodes(codes);

        const index = verifyBackupCode(codes[3], hashed);
        expect(index).toBe(3);
    });

    it('should reject invalid backup code', () => {
        const codes = generateBackupCodes();
        const hashed = hashBackupCodes(codes);

        const index = verifyBackupCode('INVALID1', hashed);
        expect(index).toBe(-1);
    });

    it('should verify case-insensitively', () => {
        const codes = generateBackupCodes();
        const hashed = hashBackupCodes(codes);

        const lowerCode = codes[0].toLowerCase();
        const index = verifyBackupCode(lowerCode, hashed);
        expect(index).toBe(0);
    });

    it('should allow removing used codes', () => {
        const codes = generateBackupCodes();
        const hashed = hashBackupCodes(codes);

        // Verify and "use" a code
        const usedIndex = verifyBackupCode(codes[5], hashed);
        expect(usedIndex).toBe(5);

        // Remove it
        const remaining = [...hashed];
        remaining.splice(usedIndex, 1);

        expect(remaining).toHaveLength(BACKUP_CODE_COUNT - 1);

        // Used code should no longer verify
        const reusedIndex = verifyBackupCode(codes[5], remaining);
        expect(reusedIndex).toBe(-1);
    });
});

// ============================================
// CORS Origin Validation Tests
// ============================================

describe('CORS Origin Validation', () => {
    const ALLOWED_ORIGINS = [
        'https://production.example.com',
        'http://localhost:8888',
        'http://localhost:3000'
    ];

    function validateOrigin(requestOrigin) {
        return ALLOWED_ORIGINS.includes(requestOrigin)
            ? requestOrigin
            : ALLOWED_ORIGINS[0];
    }

    it('should allow localhost:8888', () => {
        expect(validateOrigin('http://localhost:8888')).toBe('http://localhost:8888');
    });

    it('should allow localhost:3000', () => {
        expect(validateOrigin('http://localhost:3000')).toBe('http://localhost:3000');
    });

    it('should allow production origin', () => {
        expect(validateOrigin('https://production.example.com')).toBe('https://production.example.com');
    });

    it('should reject and fallback for unknown origins', () => {
        const result = validateOrigin('https://evil.com');
        expect(result).not.toBe('https://evil.com');
        expect(result).toBe('https://production.example.com');
    });

    it('should reject HTTP version of HTTPS origin', () => {
        const result = validateOrigin('http://production.example.com');
        expect(result).not.toBe('http://production.example.com');
    });
});

// ============================================
// Client IP Extraction Tests
// ============================================

describe('Client IP Extraction', () => {
    function getClientIP(event) {
        return event?.headers?.['x-forwarded-for']?.split(',')[0]?.trim()
            || event?.headers?.['x-real-ip']
            || event?.headers?.['client-ip']
            || 'unknown';
    }

    it('should extract IP from x-forwarded-for', () => {
        const event = {
            headers: { 'x-forwarded-for': '192.168.1.1' }
        };
        expect(getClientIP(event)).toBe('192.168.1.1');
    });

    it('should extract first IP from x-forwarded-for chain', () => {
        const event = {
            headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1, 172.16.0.1' }
        };
        expect(getClientIP(event)).toBe('192.168.1.1');
    });

    it('should trim whitespace from IP', () => {
        const event = {
            headers: { 'x-forwarded-for': '  192.168.1.1  , 10.0.0.1' }
        };
        expect(getClientIP(event)).toBe('192.168.1.1');
    });

    it('should fallback to x-real-ip', () => {
        const event = {
            headers: { 'x-real-ip': '10.0.0.5' }
        };
        expect(getClientIP(event)).toBe('10.0.0.5');
    });

    it('should fallback to client-ip', () => {
        const event = {
            headers: { 'client-ip': '172.16.0.1' }
        };
        expect(getClientIP(event)).toBe('172.16.0.1');
    });

    it('should return unknown for missing headers', () => {
        expect(getClientIP({})).toBe('unknown');
        expect(getClientIP({ headers: {} })).toBe('unknown');
        expect(getClientIP(null)).toBe('unknown');
    });
});
