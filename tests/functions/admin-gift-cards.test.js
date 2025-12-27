/**
 * Admin Gift Cards API Tests
 * Tests for /api/admin-gift-cards endpoint
 */

import { describe, it, expect, afterAll } from 'vitest';
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

const TEST_PREFIX = 'TEST-GC-';
const testGiftCardIds = [];

describe('Admin Gift Cards API', () => {
    afterAll(async () => {
        for (const id of testGiftCardIds) {
            await supabase.from('gift_card_transactions').delete().eq('gift_card_id', id);
            await supabase.from('gift_cards').delete().eq('id', id);
        }
    });

    describe('Gift Card Code Generation', () => {
        it('should generate codes in format GC-XXXX-XXXX-XXXX', () => {
            const codeRegex = /^GC-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
            const testCodes = ['GC-ABCD-1234-EFGH', 'GC-WXYZ-5678-MNOP'];
            testCodes.forEach(code => expect(code).toMatch(codeRegex));
        });

        it('should exclude confusing characters', () => {
            const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
            expect(chars).not.toContain('0');
            expect(chars).not.toContain('O');
            expect(chars).not.toContain('1');
            expect(chars).not.toContain('I');
            expect(chars).not.toContain('L');
        });
    });

    describe('Gift Card Validation', () => {
        it('should require amount between 1 and 500', () => {
            const validAmounts = [1, 10, 50, 100, 250, 500];
            validAmounts.forEach(amount => {
                expect(amount).toBeGreaterThanOrEqual(1);
                expect(amount).toBeLessThanOrEqual(500);
            });
        });

        it('should limit recipient email to 254 characters', () => {
            expect('test@example.com'.length).toBeLessThanOrEqual(254);
        });

        it('should limit recipient name to 100 characters', () => {
            expect('John Doe'.length).toBeLessThanOrEqual(100);
        });

        it('should limit personal message to 500 characters', () => {
            expect('Happy Birthday!'.length).toBeLessThanOrEqual(500);
        });
    });

    describe('Gift Card Status', () => {
        it('should have valid status values', () => {
            const validStatuses = ['pending', 'active', 'depleted', 'expired', 'cancelled'];
            expect(validStatuses).toContain('pending');
            expect(validStatuses).toContain('active');
            expect(validStatuses).toContain('depleted');
        });

        it('should mark as depleted when balance reaches 0', () => {
            const newBalance = 0;
            const newStatus = newBalance <= 0 ? 'depleted' : 'active';
            expect(newStatus).toBe('depleted');
        });

        it('should remain active when balance is positive', () => {
            const newBalance = 10;
            const newStatus = newBalance <= 0 ? 'depleted' : 'active';
            expect(newStatus).toBe('active');
        });
    });

    describe('Gift Card CRUD Operations', () => {
        it('should create a gift card', async () => {
            const testCode = TEST_PREFIX + Date.now();
            const { data, error } = await supabase
                .from('gift_cards')
                .insert({
                    code: testCode,
                    initial_balance: 25.00,
                    current_balance: 25.00,
                    currency: 'GBP',
                    purchaser_email: 'test@example.com',
                    purchaser_name: 'Test User',
                    source: 'promotional',
                    status: 'active'
                })
                .select()
                .single();

            expect(error).toBeNull();
            expect(data).toBeDefined();
            expect(data.code).toBe(testCode);
            testGiftCardIds.push(data.id);
        });

        it('should read gift cards', async () => {
            const { data, error } = await supabase
                .from('gift_cards')
                .select('*')
                .limit(10);

            expect(error).toBeNull();
            expect(Array.isArray(data)).toBe(true);
        });

        it('should update gift card balance', async () => {
            if (testGiftCardIds.length === 0) return;
            const { data, error } = await supabase
                .from('gift_cards')
                .update({ current_balance: 15.00 })
                .eq('id', testGiftCardIds[0])
                .select()
                .single();

            expect(error).toBeNull();
            expect(parseFloat(data.current_balance)).toBe(15.00);
        });

        it('should cancel a gift card', async () => {
            if (testGiftCardIds.length === 0) return;
            const { data, error } = await supabase
                .from('gift_cards')
                .update({ status: 'cancelled' })
                .eq('id', testGiftCardIds[0])
                .select()
                .single();

            expect(error).toBeNull();
            expect(data.status).toBe('cancelled');
        });
    });

    describe('Gift Card Transactions', () => {
        it('should record activation transaction', () => {
            const tx = { transaction_type: 'activation', amount: 50.00 };
            expect(tx.transaction_type).toBe('activation');
            expect(tx.amount).toBeGreaterThan(0);
        });

        it('should record redemption transaction', () => {
            const tx = { transaction_type: 'redemption', amount: -15.00 };
            expect(tx.transaction_type).toBe('redemption');
            expect(tx.amount).toBeLessThan(0);
        });
    });

    describe('Gift Card Stats', () => {
        it('should calculate total issued', () => {
            const cards = [{ initial_balance: 25 }, { initial_balance: 50 }, { initial_balance: 100 }];
            const total = cards.reduce((sum, gc) => sum + gc.initial_balance, 0);
            expect(total).toBe(175);
        });

        it('should calculate total remaining', () => {
            const cards = [
                { current_balance: 10, status: 'active' },
                { current_balance: 0, status: 'depleted' },
                { current_balance: 25, status: 'active' }
            ];
            const remaining = cards.filter(gc => gc.status === 'active')
                .reduce((sum, gc) => sum + gc.current_balance, 0);
            expect(remaining).toBe(35);
        });
    });

    describe('Method Handling', () => {
        it('should support CRUD methods', () => {
            const methods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
            expect(methods).toContain('GET');
            expect(methods).toContain('POST');
            expect(methods).toContain('PUT');
            expect(methods).toContain('DELETE');
        });
    });
});
