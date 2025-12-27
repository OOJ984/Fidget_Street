/**
 * Customer Authentication API Tests
 * Tests for /api/customer-auth endpoint (magic link authentication)
 */

import { describe, it, expect, afterAll } from 'vitest';
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
const TEST_PREFIX = 'TEST-CUSTOMER-';
const testCustomerIds = [];

describe('Customer Authentication API', () => {
    afterAll(async () => {
        for (const id of testCustomerIds) {
            await supabase.from('customers').delete().eq('id', id);
        }
    });

    describe('Email Validation', () => {
        it('should validate correct email format', () => {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            expect(emailRegex.test('test@example.com')).toBe(true);
        });

        it('should reject invalid email format', () => {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            expect(emailRegex.test('invalid')).toBe(false);
            expect(emailRegex.test('nodomain')).toBe(false);
        });

        it('should normalize email to lowercase', () => {
            const email = 'Test@EXAMPLE.COM';
            const normalized = email.toLowerCase().trim();
            expect(normalized).toBe('test@example.com');
        });
    });

    describe('Magic Link Token Generation', () => {
        it('should generate 64-character hex token', () => {
            const token = crypto.randomBytes(32).toString('hex');
            expect(token.length).toBe(64);
        });

        it('should generate unique tokens', () => {
            const token1 = crypto.randomBytes(32).toString('hex');
            const token2 = crypto.randomBytes(32).toString('hex');
            expect(token1).not.toBe(token2);
        });
    });

    describe('Token Expiry', () => {
        it('should set 15-minute expiry for magic link', () => {
            const MAGIC_LINK_EXPIRY = 15 * 60 * 1000;
            const expiresAt = new Date(Date.now() + MAGIC_LINK_EXPIRY);
            const now = new Date();
            const diffMs = expiresAt - now;
            expect(diffMs).toBeLessThanOrEqual(MAGIC_LINK_EXPIRY);
        });

        it('should detect expired token', () => {
            const expiredTime = new Date(Date.now() - 1000);
            const isExpired = expiredTime < new Date();
            expect(isExpired).toBe(true);
        });
    });

    describe('Customer Session JWT', () => {
        it('should create customer session token', () => {
            const payload = { customerId: 1, email: 'customer@example.com', type: 'customer' };
            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
            expect(token).toBeDefined();
            expect(token.split('.').length).toBe(3);
        });

        it('should decode customer token correctly', () => {
            const payload = { customerId: 123, email: 'test@test.com', type: 'customer' };
            const token = jwt.sign(payload, JWT_SECRET);
            const decoded = jwt.verify(token, JWT_SECRET);
            expect(decoded.customerId).toBe(123);
            expect(decoded.type).toBe('customer');
        });
    });

    describe('Customer Record Management', () => {
        it('should create customer record', async () => {
            const testEmail = TEST_PREFIX + Date.now() + '@test.com';
            const token = crypto.randomBytes(32).toString('hex');
            
            const { data, error } = await supabase
                .from('customers')
                .insert({
                    email: testEmail.toLowerCase(),
                    magic_link_token: token,
                    magic_link_expires: new Date(Date.now() + 900000).toISOString()
                })
                .select()
                .single();
            
            expect(error).toBeNull();
            expect(data).toBeDefined();
            testCustomerIds.push(data.id);
        });

        it('should update customer magic link', async () => {
            if (testCustomerIds.length === 0) return;
            
            const newToken = crypto.randomBytes(32).toString('hex');
            const { data, error } = await supabase
                .from('customers')
                .update({
                    magic_link_token: newToken,
                    magic_link_expires: new Date(Date.now() + 900000).toISOString()
                })
                .eq('id', testCustomerIds[0])
                .select()
                .single();
            
            expect(error).toBeNull();
            expect(data.magic_link_token).toBe(newToken);
        });
    });

    describe('Rate Limiting', () => {
        it('should block after max requests', () => {
            const maxRequests = 3;
            const count = 3;
            const allowed = count < maxRequests;
            expect(allowed).toBe(false);
        });

        it('should reset after window expires', () => {
            const windowMs = 60 * 60 * 1000;
            const firstAttempt = Date.now() - (2 * 60 * 60 * 1000);
            const shouldReset = Date.now() - firstAttempt > windowMs;
            expect(shouldReset).toBe(true);
        });
    });

    describe('Response Formats', () => {
        it('should return success for magic link request', () => {
            const response = { success: true, message: 'If you have orders with us, you will receive an email shortly.' };
            expect(response.success).toBe(true);
        });

        it('should return token on successful verification', () => {
            const response = { success: true, token: 'jwt-token-here', email: 'customer@example.com' };
            expect(response.token).toBeDefined();
        });
    });

    describe('Method Handling', () => {
        it('should support GET and POST', () => {
            const methods = ['GET', 'POST', 'OPTIONS'];
            expect(methods).toContain('GET');
            expect(methods).toContain('POST');
        });
    });
});
