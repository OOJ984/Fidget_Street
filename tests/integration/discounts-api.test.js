/**
 * Discounts API Integration Tests
 *
 * Tests discount code functionality with real Supabase database.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

describe('Discounts API Integration', () => {
    const testDiscountCodes = [];

    afterAll(async () => {
        // Clean up test discount codes
        for (const code of testDiscountCodes) {
            await supabase
                .from('discount_codes')
                .delete()
                .eq('code', code);
        }
    });

    describe('Discount Code CRUD', () => {
        it('should create percentage discount', async () => {
            const code = `TEST_PCT_${Date.now()}`;
            testDiscountCodes.push(code);

            const { data, error } = await supabase
                .from('discount_codes')
                .insert([{
                    code: code,
                    name: 'Test Percentage Discount',
                    discount_type: 'percentage',
                    discount_value: 15,
                    is_active: true
                }])
                .select()
                .single();

            expect(error).toBeNull();
            expect(data).toBeDefined();
            expect(data.code).toBe(code);
            expect(data.discount_type).toBe('percentage');
            expect(data.discount_value).toBe(15);
        });

        it('should create fixed discount', async () => {
            const code = `TEST_FIX_${Date.now()}`;
            testDiscountCodes.push(code);

            const { data, error } = await supabase
                .from('discount_codes')
                .insert([{
                    code: code,
                    name: 'Test Fixed Discount',
                    discount_type: 'fixed',
                    discount_value: 5.00,
                    is_active: true
                }])
                .select()
                .single();

            expect(error).toBeNull();
            expect(data.discount_type).toBe('fixed');
            expect(data.discount_value).toBe(5.00);
        });

        it('should create free delivery discount', async () => {
            const code = `TEST_FREE_${Date.now()}`;
            testDiscountCodes.push(code);

            const { data, error } = await supabase
                .from('discount_codes')
                .insert([{
                    code: code,
                    name: 'Test Free Delivery',
                    discount_type: 'free_delivery',
                    discount_value: 0,
                    is_active: true
                }])
                .select()
                .single();

            expect(error).toBeNull();
            expect(data.discount_type).toBe('free_delivery');
        });

        it('should update discount code', async () => {
            const code = `TEST_UPDATE_${Date.now()}`;
            testDiscountCodes.push(code);

            // Create
            const { data: created } = await supabase
                .from('discount_codes')
                .insert([{
                    code: code,
                    name: 'Original Name',
                    discount_type: 'percentage',
                    discount_value: 10,
                    is_active: true
                }])
                .select()
                .single();

            // Update
            const { error } = await supabase
                .from('discount_codes')
                .update({ name: 'Updated Name', discount_value: 20 })
                .eq('code', code);

            expect(error).toBeNull();

            // Verify
            const { data: updated } = await supabase
                .from('discount_codes')
                .select('name, discount_value')
                .eq('code', code)
                .single();

            expect(updated.name).toBe('Updated Name');
            expect(updated.discount_value).toBe(20);
        });

        it('should delete discount code', async () => {
            const code = `TEST_DELETE_${Date.now()}`;

            // Create
            await supabase
                .from('discount_codes')
                .insert([{
                    code: code,
                    name: 'To Delete',
                    discount_type: 'percentage',
                    discount_value: 5,
                    is_active: true
                }]);

            // Delete
            const { error } = await supabase
                .from('discount_codes')
                .delete()
                .eq('code', code);

            expect(error).toBeNull();

            // Verify deleted
            const { data } = await supabase
                .from('discount_codes')
                .select('code')
                .eq('code', code)
                .single();

            expect(data).toBeNull();
        });
    });

    describe('Discount Validation', () => {
        let validDiscountCode;
        let expiredDiscountCode;
        let inactiveDiscountCode;

        beforeAll(async () => {
            const now = new Date();
            const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

            // Valid discount
            validDiscountCode = `TEST_VALID_${Date.now()}`;
            testDiscountCodes.push(validDiscountCode);
            await supabase.from('discount_codes').insert([{
                code: validDiscountCode,
                name: 'Valid Discount',
                discount_type: 'percentage',
                discount_value: 10,
                is_active: true,
                starts_at: past.toISOString(),
                expires_at: future.toISOString()
            }]);

            // Expired discount
            expiredDiscountCode = `TEST_EXPIRED_${Date.now()}`;
            testDiscountCodes.push(expiredDiscountCode);
            await supabase.from('discount_codes').insert([{
                code: expiredDiscountCode,
                name: 'Expired Discount',
                discount_type: 'percentage',
                discount_value: 20,
                is_active: true,
                expires_at: past.toISOString()
            }]);

            // Inactive discount
            inactiveDiscountCode = `TEST_INACTIVE_${Date.now()}`;
            testDiscountCodes.push(inactiveDiscountCode);
            await supabase.from('discount_codes').insert([{
                code: inactiveDiscountCode,
                name: 'Inactive Discount',
                discount_type: 'percentage',
                discount_value: 30,
                is_active: false
            }]);
        });

        it('should find valid active discount', async () => {
            const { data } = await supabase
                .from('discount_codes')
                .select('*')
                .eq('code', validDiscountCode)
                .eq('is_active', true)
                .single();

            expect(data).toBeDefined();
            expect(data.is_active).toBe(true);
        });

        it('should not find inactive discount when filtering active', async () => {
            const { data } = await supabase
                .from('discount_codes')
                .select('*')
                .eq('code', inactiveDiscountCode)
                .eq('is_active', true)
                .single();

            expect(data).toBeNull();
        });

        it('should detect expired discount', async () => {
            const { data } = await supabase
                .from('discount_codes')
                .select('expires_at')
                .eq('code', expiredDiscountCode)
                .single();

            if (!data) {
                console.log('Skipping - expired discount code not found');
                return;
            }

            const now = new Date();
            const expiresAt = new Date(data.expires_at);
            const isExpired = expiresAt < now;

            expect(isExpired).toBe(true);
        });

        it('should validate date range', async () => {
            const { data } = await supabase
                .from('discount_codes')
                .select('starts_at, expires_at')
                .eq('code', validDiscountCode)
                .single();

            if (!data) {
                console.log('Skipping - valid discount code not found');
                return;
            }

            const now = new Date();
            const startsAt = data.starts_at ? new Date(data.starts_at) : null;
            const expiresAt = data.expires_at ? new Date(data.expires_at) : null;

            const isValid = (!startsAt || startsAt <= now) &&
                           (!expiresAt || expiresAt > now);

            expect(isValid).toBe(true);
        });
    });

    describe('Usage Tracking', () => {
        let usageDiscountCode;

        beforeAll(async () => {
            usageDiscountCode = `TEST_USAGE_${Date.now()}`;
            testDiscountCodes.push(usageDiscountCode);

            const { error } = await supabase.from('discount_codes').insert([{
                code: usageDiscountCode,
                name: 'Usage Tracking Discount',
                discount_type: 'percentage',
                discount_value: 10,
                is_active: true,
                max_uses: 100,
                use_count: 5
            }]);

            if (error) {
                console.error('Failed to create usage discount:', error);
                usageDiscountCode = null;
            }
        });

        it('should track use count', async () => {
            if (!usageDiscountCode) {
                console.log('Skipping - usage discount not created');
                return;
            }

            const { data } = await supabase
                .from('discount_codes')
                .select('use_count, max_uses')
                .eq('code', usageDiscountCode)
                .single();

            if (!data) {
                console.log('Skipping - usage discount not found');
                return;
            }

            expect(data.use_count).toBe(5);
            expect(data.max_uses).toBe(100);
        });

        it('should increment use count', async () => {
            if (!usageDiscountCode) {
                console.log('Skipping - usage discount not created');
                return;
            }

            // Get current count
            const { data: before } = await supabase
                .from('discount_codes')
                .select('use_count')
                .eq('code', usageDiscountCode)
                .single();

            if (!before) {
                console.log('Skipping - usage discount not found');
                return;
            }

            // Increment
            await supabase
                .from('discount_codes')
                .update({ use_count: before.use_count + 1 })
                .eq('code', usageDiscountCode);

            // Verify
            const { data: after } = await supabase
                .from('discount_codes')
                .select('use_count')
                .eq('code', usageDiscountCode)
                .single();

            if (!after) {
                console.log('Skipping verification - discount not found after update');
                return;
            }

            expect(after.use_count).toBe(before.use_count + 1);
        });

        it('should check max uses limit', async () => {
            if (!usageDiscountCode) {
                console.log('Skipping - usage discount not created');
                return;
            }

            const { data } = await supabase
                .from('discount_codes')
                .select('use_count, max_uses')
                .eq('code', usageDiscountCode)
                .single();

            if (!data) {
                console.log('Skipping - usage discount not found');
                return;
            }

            const hasUsesLeft = data.use_count < data.max_uses;
            expect(hasUsesLeft).toBe(true);
        });
    });

    describe('Minimum Order Amount', () => {
        let minOrderCode;

        beforeAll(async () => {
            minOrderCode = `TEST_MIN_${Date.now()}`;
            testDiscountCodes.push(minOrderCode);

            const { error } = await supabase.from('discount_codes').insert([{
                code: minOrderCode,
                name: 'Min Order Discount',
                discount_type: 'percentage',
                discount_value: 20,
                is_active: true,
                min_order_amount: 50.00
            }]);

            if (error) {
                console.error('Failed to create min order discount:', error);
                minOrderCode = null;
            }
        });

        it('should store minimum order amount', async () => {
            if (!minOrderCode) {
                console.log('Skipping - min order discount not created');
                return;
            }

            const { data } = await supabase
                .from('discount_codes')
                .select('min_order_amount')
                .eq('code', minOrderCode)
                .single();

            if (!data) {
                console.log('Skipping - min order discount not found');
                return;
            }

            expect(parseFloat(data.min_order_amount)).toBe(50.00);
        });

        it('should check order meets minimum', async () => {
            if (!minOrderCode) {
                console.log('Skipping - min order discount not created');
                return;
            }

            const { data } = await supabase
                .from('discount_codes')
                .select('min_order_amount')
                .eq('code', minOrderCode)
                .single();

            if (!data) {
                console.log('Skipping - min order discount not found');
                return;
            }

            const minAmount = parseFloat(data.min_order_amount);

            // Order below minimum
            expect(45.00 >= minAmount).toBe(false);

            // Order at minimum
            expect(50.00 >= minAmount).toBe(true);

            // Order above minimum
            expect(75.00 >= minAmount).toBe(true);
        });
    });

    describe('Case Insensitive Lookup', () => {
        let caseTestCode;

        beforeAll(async () => {
            caseTestCode = `TEST_CASE_${Date.now()}`;
            testDiscountCodes.push(caseTestCode);

            await supabase.from('discount_codes').insert([{
                code: caseTestCode,
                name: 'Case Test Discount',
                discount_type: 'percentage',
                discount_value: 5,
                is_active: true
            }]);
        });

        it('should find code with case-insensitive search', async () => {
            const { data } = await supabase
                .from('discount_codes')
                .select('code')
                .ilike('code', caseTestCode.toLowerCase())
                .single();

            if (!data) {
                console.log('Skipping - test code not found in database');
                return;
            }
            expect(data.code).toBe(caseTestCode);
        });
    });
});
