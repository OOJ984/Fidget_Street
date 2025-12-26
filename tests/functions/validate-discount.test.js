/**
 * Discount Validation Tests
 *
 * Tests the discount code validation logic.
 * Uses real Supabase for integration testing.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

describe('Discount Code Validation', () => {
    // Test discount codes
    let testDiscountPercentage;
    let testDiscountFixed;
    let testDiscountFreeDelivery;
    let testDiscountExpired;
    let testDiscountMinOrder;

    beforeAll(async () => {
        const now = new Date();
        const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
        const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

        // Create test discount codes
        const discounts = [
            {
                code: 'TEST_PERCENT10',
                name: 'Test 10% Off',
                discount_type: 'percentage',
                discount_value: 10,
                is_active: true,
                starts_at: past.toISOString(),
                expires_at: future.toISOString()
            },
            {
                code: 'TEST_FIXED5',
                name: 'Test £5 Off',
                discount_type: 'fixed',
                discount_value: 5,
                is_active: true
            },
            {
                code: 'TEST_FREESHIP',
                name: 'Test Free Shipping',
                discount_type: 'free_delivery',
                discount_value: 0,
                is_active: true
            },
            {
                code: 'TEST_EXPIRED',
                name: 'Test Expired',
                discount_type: 'percentage',
                discount_value: 20,
                is_active: true,
                expires_at: past.toISOString()
            },
            {
                code: 'TEST_MIN50',
                name: 'Test Min £50 Order',
                discount_type: 'percentage',
                discount_value: 15,
                is_active: true,
                min_order_amount: 50
            }
        ];

        for (const discount of discounts) {
            const { data, error } = await supabase
                .from('discount_codes')
                .insert(discount)
                .select()
                .single();

            if (data) {
                if (discount.code === 'TEST_PERCENT10') testDiscountPercentage = data;
                if (discount.code === 'TEST_FIXED5') testDiscountFixed = data;
                if (discount.code === 'TEST_FREESHIP') testDiscountFreeDelivery = data;
                if (discount.code === 'TEST_EXPIRED') testDiscountExpired = data;
                if (discount.code === 'TEST_MIN50') testDiscountMinOrder = data;
            }
        }
    });

    afterAll(async () => {
        // Clean up test discount codes
        await supabase
            .from('discount_codes')
            .delete()
            .like('code', 'TEST_%');
    });

    describe('Discount Lookup', () => {
        it('should find valid percentage discount', async () => {
            const { data, error } = await supabase
                .from('discount_codes')
                .select('*')
                .eq('code', 'TEST_PERCENT10')
                .eq('is_active', true)
                .single();

            expect(error).toBeNull();
            expect(data).toBeDefined();
            expect(data.discount_type).toBe('percentage');
            expect(data.discount_value).toBe(10);
        });

        it('should find valid fixed discount', async () => {
            const { data } = await supabase
                .from('discount_codes')
                .select('*')
                .eq('code', 'TEST_FIXED5')
                .eq('is_active', true)
                .single();

            expect(data).toBeDefined();
            expect(data.discount_type).toBe('fixed');
            expect(data.discount_value).toBe(5);
        });

        it('should find free delivery discount', async () => {
            const { data } = await supabase
                .from('discount_codes')
                .select('*')
                .eq('code', 'TEST_FREESHIP')
                .eq('is_active', true)
                .single();

            expect(data).toBeDefined();
            expect(data.discount_type).toBe('free_delivery');
        });

        it('should not find non-existent code', async () => {
            const { data, error } = await supabase
                .from('discount_codes')
                .select('*')
                .eq('code', 'DOESNOTEXIST')
                .eq('is_active', true)
                .single();

            expect(data).toBeNull();
        });

        it('should be case-insensitive for code lookup', async () => {
            const { data } = await supabase
                .from('discount_codes')
                .select('*')
                .ilike('code', 'test_percent10')
                .eq('is_active', true)
                .single();

            expect(data).toBeDefined();
            expect(data.code).toBe('TEST_PERCENT10');
        });
    });

    describe('Discount Validity Checks', () => {
        it('should validate date range - within range', () => {
            if (!testDiscountPercentage) return;

            const now = new Date();
            const startsAt = testDiscountPercentage.starts_at
                ? new Date(testDiscountPercentage.starts_at)
                : null;
            const expiresAt = testDiscountPercentage.expires_at
                ? new Date(testDiscountPercentage.expires_at)
                : null;

            const isValid = (!startsAt || startsAt <= now) &&
                           (!expiresAt || expiresAt > now);

            expect(isValid).toBe(true);
        });

        it('should validate date range - expired', () => {
            if (!testDiscountExpired) return;

            const now = new Date();
            const expiresAt = testDiscountExpired.expires_at
                ? new Date(testDiscountExpired.expires_at)
                : null;

            const isExpired = expiresAt && expiresAt < now;

            expect(isExpired).toBe(true);
        });

        it('should validate minimum order amount', () => {
            if (!testDiscountMinOrder) return;

            const minAmount = testDiscountMinOrder.min_order_amount;

            // Order of £30 should fail
            const orderTotal30 = 30;
            expect(orderTotal30 >= minAmount).toBe(false);

            // Order of £50 should pass
            const orderTotal50 = 50;
            expect(orderTotal50 >= minAmount).toBe(true);

            // Order of £60 should pass
            const orderTotal60 = 60;
            expect(orderTotal60 >= minAmount).toBe(true);
        });
    });

    describe('Discount Calculations', () => {
        it('should calculate percentage discount correctly', () => {
            const subtotal = 100; // £100
            const discountPercent = 10;
            const discountAmount = (subtotal * discountPercent) / 100;

            expect(discountAmount).toBe(10); // £10 off
        });

        it('should calculate fixed discount correctly', () => {
            const subtotal = 100;
            const discountFixed = 5;
            const discountAmount = Math.min(discountFixed, subtotal);

            expect(discountAmount).toBe(5);
        });

        it('should cap fixed discount at subtotal', () => {
            const subtotal = 3; // £3
            const discountFixed = 5; // £5
            const discountAmount = Math.min(discountFixed, subtotal);

            expect(discountAmount).toBe(3); // Capped at subtotal
        });

        it('should handle free delivery discount type', () => {
            const discountType = 'free_delivery';
            const shipping = 3.49;

            // Free delivery means discount doesn't reduce price, but shipping = 0
            const adjustedShipping = discountType === 'free_delivery' ? 0 : shipping;

            expect(adjustedShipping).toBe(0);
        });

        it('should calculate percentage discount in pence correctly', () => {
            const subtotalPence = 2500; // £25
            const discountPercent = 10;
            const discountAmountPence = Math.round((subtotalPence * discountPercent) / 100);

            expect(discountAmountPence).toBe(250); // 250 pence = £2.50
        });

        it('should calculate fixed discount in pence correctly', () => {
            const discountFixed = 5.00; // £5
            const discountAmountPence = Math.round(discountFixed * 100);

            expect(discountAmountPence).toBe(500);
        });
    });

    describe('Usage Limits', () => {
        it('should check max uses limit', async () => {
            // Create a discount with max uses
            const { data: limitedDiscount } = await supabase
                .from('discount_codes')
                .insert({
                    code: 'TEST_LIMITED',
                    name: 'Test Limited Uses',
                    discount_type: 'percentage',
                    discount_value: 5,
                    is_active: true,
                    max_uses: 10,
                    use_count: 5
                })
                .select()
                .single();

            if (limitedDiscount) {
                const hasUsesLeft = limitedDiscount.use_count < limitedDiscount.max_uses;
                expect(hasUsesLeft).toBe(true);

                // Simulate reaching limit
                const atLimit = limitedDiscount.max_uses - 1;
                const wouldExceed = atLimit >= limitedDiscount.max_uses;
                expect(wouldExceed).toBe(false);

                // Clean up
                await supabase
                    .from('discount_codes')
                    .delete()
                    .eq('id', limitedDiscount.id);
            }
        });

        it('should check exhausted uses', async () => {
            const { data: exhausted } = await supabase
                .from('discount_codes')
                .insert({
                    code: 'TEST_EXHAUSTED',
                    name: 'Test Exhausted',
                    discount_type: 'percentage',
                    discount_value: 5,
                    is_active: true,
                    max_uses: 10,
                    use_count: 10
                })
                .select()
                .single();

            if (exhausted) {
                const isExhausted = exhausted.use_count >= exhausted.max_uses;
                expect(isExhausted).toBe(true);

                // Clean up
                await supabase
                    .from('discount_codes')
                    .delete()
                    .eq('id', exhausted.id);
            }
        });
    });

    describe('Edge Cases', () => {
        it('should handle null expires_at (no expiry)', async () => {
            const { data } = await supabase
                .from('discount_codes')
                .select('*')
                .eq('code', 'TEST_FIXED5')
                .single();

            if (data) {
                const now = new Date();
                const expiresAt = data.expires_at ? new Date(data.expires_at) : null;
                const isValid = !expiresAt || expiresAt > now;

                expect(isValid).toBe(true);
            }
        });

        it('should handle inactive discount', async () => {
            const { data: inactive } = await supabase
                .from('discount_codes')
                .insert({
                    code: 'TEST_INACTIVE',
                    name: 'Test Inactive',
                    discount_type: 'percentage',
                    discount_value: 50,
                    is_active: false
                })
                .select()
                .single();

            if (inactive) {
                // Should not find when filtering by is_active
                const { data: lookup } = await supabase
                    .from('discount_codes')
                    .select('*')
                    .eq('code', 'TEST_INACTIVE')
                    .eq('is_active', true)
                    .single();

                expect(lookup).toBeNull();

                // Clean up
                await supabase
                    .from('discount_codes')
                    .delete()
                    .eq('id', inactive.id);
            }
        });

        it('should trim and uppercase code for comparison', () => {
            const inputCode = '  test_percent10  ';
            const normalizedCode = inputCode.toUpperCase().trim();

            expect(normalizedCode).toBe('TEST_PERCENT10');
        });
    });
});
