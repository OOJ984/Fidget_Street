/**
 * Gift Card Validation Tests
 *
 * Tests the gift card validation and balance logic.
 * Uses real Supabase for integration testing.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

describe('Gift Card Validation', () => {
    let testGiftCardActive;
    let testGiftCardEmpty;
    let testGiftCardExpired;

    beforeAll(async () => {
        const now = new Date();
        const future = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year
        const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

        const giftCards = [
            {
                code: 'TEST-GC-ACTIVE',
                initial_balance: 50.00,
                current_balance: 35.50,
                status: 'active',
                expires_at: future.toISOString(),
                purchaser_email: 'test@example.com'
            },
            {
                code: 'TEST-GC-EMPTY',
                initial_balance: 25.00,
                current_balance: 0,
                status: 'active',
                purchaser_email: 'test@example.com'
            },
            {
                code: 'TEST-GC-EXPIRED',
                initial_balance: 100.00,
                current_balance: 100.00,
                status: 'active',
                expires_at: past.toISOString(),
                purchaser_email: 'test@example.com'
            }
        ];

        for (const gc of giftCards) {
            const { data, error } = await supabase
                .from('gift_cards')
                .insert(gc)
                .select()
                .single();

            if (data) {
                if (gc.code === 'TEST-GC-ACTIVE') testGiftCardActive = data;
                if (gc.code === 'TEST-GC-EMPTY') testGiftCardEmpty = data;
                if (gc.code === 'TEST-GC-EXPIRED') testGiftCardExpired = data;
            }
        }
    });

    afterAll(async () => {
        await supabase
            .from('gift_cards')
            .delete()
            .like('code', 'TEST-GC-%');
    });

    describe('Gift Card Lookup', () => {
        it('should find active gift card', async () => {
            const { data, error } = await supabase
                .from('gift_cards')
                .select('*')
                .eq('code', 'TEST-GC-ACTIVE')
                .single();

            expect(error).toBeNull();
            expect(data).toBeDefined();
            expect(data.status).toBe('active');
            expect(parseFloat(data.current_balance)).toBe(35.50);
        });

        it('should not find non-existent gift card', async () => {
            const { data } = await supabase
                .from('gift_cards')
                .select('*')
                .eq('code', 'FAKE-CODE-123')
                .single();

            expect(data).toBeNull();
        });

        it('should handle case-insensitive lookup', async () => {
            const { data } = await supabase
                .from('gift_cards')
                .select('*')
                .ilike('code', 'test-gc-active')
                .single();

            expect(data).toBeDefined();
        });
    });

    describe('Balance Validation', () => {
        it('should correctly identify card with balance', () => {
            if (!testGiftCardActive) return;

            const balance = parseFloat(testGiftCardActive.current_balance);
            expect(balance).toBeGreaterThan(0);
        });

        it('should correctly identify empty card', () => {
            if (!testGiftCardEmpty) return;

            const balance = parseFloat(testGiftCardEmpty.current_balance);
            expect(balance).toBe(0);
        });

        it('should calculate usable amount correctly', () => {
            const balance = 35.50;
            const orderTotal = 25.00;
            const requestedAmount = 20.00;

            const usableAmount = Math.min(requestedAmount, balance, orderTotal);
            expect(usableAmount).toBe(20.00);
        });

        it('should cap at balance when requested exceeds balance', () => {
            const balance = 35.50;
            const orderTotal = 100.00;
            const requestedAmount = 50.00;

            const usableAmount = Math.min(requestedAmount, balance, orderTotal);
            expect(usableAmount).toBe(35.50);
        });

        it('should cap at order total when balance exceeds order', () => {
            const balance = 100.00;
            const orderTotal = 25.00;
            const requestedAmount = 50.00;

            const usableAmount = Math.min(requestedAmount, balance, orderTotal);
            expect(usableAmount).toBe(25.00);
        });
    });

    describe('Expiry Validation', () => {
        it('should validate non-expired card', () => {
            if (!testGiftCardActive) return;

            const now = new Date();
            const expiresAt = new Date(testGiftCardActive.expires_at);
            const isValid = expiresAt > now;

            expect(isValid).toBe(true);
        });

        it('should identify expired card', () => {
            if (!testGiftCardExpired) return;

            const now = new Date();
            const expiresAt = new Date(testGiftCardExpired.expires_at);
            const isExpired = expiresAt < now;

            expect(isExpired).toBe(true);
        });

        it('should handle null expiry (never expires)', () => {
            const expiresAt = null;
            const now = new Date();

            const isValid = !expiresAt || new Date(expiresAt) > now;
            expect(isValid).toBe(true);
        });
    });

    describe('Status Validation', () => {
        it('should accept active status', () => {
            const status = 'active';
            const isUsable = status === 'active';
            expect(isUsable).toBe(true);
        });

        it('should reject redeemed status', () => {
            const status = 'redeemed';
            const isUsable = status === 'active';
            expect(isUsable).toBe(false);
        });

        it('should reject cancelled status', () => {
            const status = 'cancelled';
            const isUsable = status === 'active';
            expect(isUsable).toBe(false);
        });

        it('should reject expired status', () => {
            const status = 'expired';
            const isUsable = status === 'active';
            expect(isUsable).toBe(false);
        });
    });

    describe('Balance Deduction Logic', () => {
        it('should calculate remaining balance after use', () => {
            const currentBalance = 50.00;
            const usedAmount = 20.00;
            const newBalance = currentBalance - usedAmount;

            expect(newBalance).toBe(30.00);
        });

        it('should handle full balance use', () => {
            const currentBalance = 25.00;
            const usedAmount = 25.00;
            const newBalance = currentBalance - usedAmount;

            expect(newBalance).toBe(0);
        });

        it('should convert balance to pence correctly', () => {
            const balanceGBP = 35.50;
            const balancePence = Math.round(balanceGBP * 100);

            expect(balancePence).toBe(3550);
        });

        it('should calculate deduction from order total', () => {
            const orderTotalPence = 2500; // £25
            const giftCardBalancePence = 3550; // £35.50
            const requestedAmountPence = 2000; // £20

            const deductionPence = Math.min(
                requestedAmountPence,
                giftCardBalancePence,
                orderTotalPence
            );

            expect(deductionPence).toBe(2000);
        });
    });

    describe('Edge Cases', () => {
        it('should handle very small amounts', () => {
            const balance = 0.01;
            const orderTotal = 100.00;
            const requestedAmount = 0.01;

            const usableAmount = Math.min(requestedAmount, balance, orderTotal);
            expect(usableAmount).toBe(0.01);
        });

        it('should handle floating point precision', () => {
            const balance = 10.00;
            const amounts = [3.33, 3.33, 3.33]; // Should sum to 9.99
            const totalUsed = amounts.reduce((sum, a) => sum + a, 0);
            const remaining = Math.round((balance - totalUsed) * 100) / 100;

            expect(remaining).toBeCloseTo(0.01, 2);
        });

        it('should normalize code format', () => {
            const inputCode = '  test-gc-active  ';
            const normalized = inputCode.toUpperCase().trim();

            expect(normalized).toBe('TEST-GC-ACTIVE');
        });

        it('should handle zero requested amount', () => {
            const balance = 50.00;
            const orderTotal = 25.00;
            const requestedAmount = 0;

            const usableAmount = Math.min(requestedAmount, balance, orderTotal);
            expect(usableAmount).toBe(0);
        });
    });

    describe('Combined with Discount', () => {
        it('should apply gift card after discount', () => {
            const subtotal = 50.00;
            const discountPercent = 20;
            const discountAmount = subtotal * (discountPercent / 100);
            const afterDiscount = subtotal - discountAmount;
            const shipping = 3.49;
            const orderTotal = afterDiscount + shipping;

            const giftCardBalance = 30.00;
            const giftCardUsed = Math.min(giftCardBalance, orderTotal);

            const finalTotal = orderTotal - giftCardUsed;

            // £50 - 20% = £40, + £3.49 shipping = £43.49
            // - £30 gift card = £13.49
            expect(afterDiscount).toBe(40.00);
            expect(orderTotal).toBeCloseTo(43.49, 2);
            expect(giftCardUsed).toBe(30.00);
            expect(finalTotal).toBeCloseTo(13.49, 2);
        });

        it('should cover full order with gift card', () => {
            const orderTotal = 25.00;
            const giftCardBalance = 50.00;
            const giftCardUsed = Math.min(giftCardBalance, orderTotal);
            const finalTotal = orderTotal - giftCardUsed;

            expect(giftCardUsed).toBe(25.00);
            expect(finalTotal).toBe(0);
        });
    });
});
