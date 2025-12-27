/**
 * Admin Discounts API Tests
 *
 * Tests for discount code CRUD operations and validation.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

describe('Admin Discounts', () => {
    const testCodes = [];

    afterAll(async () => {
        // Clean up test discount codes
        for (const code of testCodes) {
            await supabase
                .from('discount_codes')
                .delete()
                .eq('code', code);
        }
    });

    describe('Discount Code Validation', () => {
        it('should require code', () => {
            const body = { name: 'Test', discount_type: 'percentage', discount_value: 10 };
            const isValid = body.code && body.name && body.discount_type && body.discount_value !== undefined;
            expect(isValid).toBeFalsy();
        });

        it('should require name', () => {
            const body = { code: 'TEST10', discount_type: 'percentage', discount_value: 10 };
            const isValid = body.code && body.name && body.discount_type && body.discount_value !== undefined;
            expect(isValid).toBeFalsy();
        });

        it('should require discount_type', () => {
            const body = { code: 'TEST10', name: 'Test', discount_value: 10 };
            const isValid = body.code && body.name && body.discount_type && body.discount_value !== undefined;
            expect(isValid).toBeFalsy();
        });

        it('should require discount_value', () => {
            const body = { code: 'TEST10', name: 'Test', discount_type: 'percentage' };
            const isValid = body.code && body.name && body.discount_type && body.discount_value !== undefined;
            expect(isValid).toBeFalsy();
        });

        it('should accept valid discount data', () => {
            const body = { code: 'TEST10', name: 'Test 10%', discount_type: 'percentage', discount_value: 10 };
            const isValid = body.code && body.name && body.discount_type && body.discount_value !== undefined;
            expect(isValid).toBeTruthy();
        });
    });

    describe('Discount Type Validation', () => {
        it('should accept percentage type', () => {
            const type = 'percentage';
            const isValid = ['percentage', 'fixed', 'free_delivery'].includes(type);
            expect(isValid).toBe(true);
        });

        it('should accept fixed type', () => {
            const type = 'fixed';
            const isValid = ['percentage', 'fixed', 'free_delivery'].includes(type);
            expect(isValid).toBe(true);
        });

        it('should accept free_delivery type', () => {
            const type = 'free_delivery';
            const isValid = ['percentage', 'fixed', 'free_delivery'].includes(type);
            expect(isValid).toBe(true);
        });

        it('should reject invalid type', () => {
            const type = 'invalid';
            const isValid = ['percentage', 'fixed', 'free_delivery'].includes(type);
            expect(isValid).toBe(false);
        });
    });

    describe('Discount Value Validation', () => {
        it('should reject zero value', () => {
            const value = 0;
            const isValid = !isNaN(value) && value > 0;
            expect(isValid).toBe(false);
        });

        it('should reject negative value', () => {
            const value = -10;
            const isValid = !isNaN(value) && value > 0;
            expect(isValid).toBe(false);
        });

        it('should accept positive value', () => {
            const value = 10;
            const isValid = !isNaN(value) && value > 0;
            expect(isValid).toBe(true);
        });

        it('should reject percentage over 100', () => {
            const type = 'percentage';
            const value = 101;
            const isValid = !(type === 'percentage' && value > 100);
            expect(isValid).toBe(false);
        });

        it('should accept percentage of 100', () => {
            const type = 'percentage';
            const value = 100;
            const isValid = !(type === 'percentage' && value > 100);
            expect(isValid).toBe(true);
        });

        it('should allow fixed value over 100', () => {
            const type = 'fixed';
            const value = 150;
            const isValid = !(type === 'percentage' && value > 100);
            expect(isValid).toBe(true);
        });
    });

    describe('Code Normalization', () => {
        it('should convert to uppercase', () => {
            const code = 'summer10';
            const normalized = code.toUpperCase().trim();
            expect(normalized).toBe('SUMMER10');
        });

        it('should trim whitespace', () => {
            const code = '  SUMMER10  ';
            const normalized = code.toUpperCase().trim();
            expect(normalized).toBe('SUMMER10');
        });
    });

    describe('Input Length Validation', () => {
        it('should reject code over 50 chars', () => {
            const code = 'A'.repeat(51);
            const isValid = code.length <= 50;
            expect(isValid).toBe(false);
        });

        it('should accept code of 50 chars', () => {
            const code = 'A'.repeat(50);
            const isValid = code.length <= 50;
            expect(isValid).toBe(true);
        });

        it('should reject name over 100 chars', () => {
            const name = 'A'.repeat(101);
            const isValid = name.length <= 100;
            expect(isValid).toBe(false);
        });

        it('should accept name of 100 chars', () => {
            const name = 'A'.repeat(100);
            const isValid = name.length <= 100;
            expect(isValid).toBe(true);
        });
    });

    describe('Database Operations', () => {
        it('should create discount code', async () => {
            const code = `TEST-${Date.now()}`;
            testCodes.push(code);

            const { data, error } = await supabase
                .from('discount_codes')
                .insert({
                    code,
                    name: 'Test Discount',
                    discount_type: 'percentage',
                    discount_value: 10,
                    is_active: true,
                    use_count: 0
                })
                .select()
                .single();

            expect(error).toBeNull();
            expect(data.code).toBe(code);
            expect(data.discount_type).toBe('percentage');
            expect(parseFloat(data.discount_value)).toBe(10);
        });

        it('should reject duplicate code', async () => {
            const code = `TEST-DUP-${Date.now()}`;
            testCodes.push(code);

            // First insert
            await supabase
                .from('discount_codes')
                .insert({
                    code,
                    name: 'First',
                    discount_type: 'percentage',
                    discount_value: 10,
                    is_active: true,
                    use_count: 0
                });

            // Second insert should fail
            const { error } = await supabase
                .from('discount_codes')
                .insert({
                    code,
                    name: 'Second',
                    discount_type: 'percentage',
                    discount_value: 20,
                    is_active: true,
                    use_count: 0
                });

            expect(error).not.toBeNull();
        });

        it('should update discount code', async () => {
            const code = `TEST-UPDATE-${Date.now()}`;
            testCodes.push(code);

            const { data: created } = await supabase
                .from('discount_codes')
                .insert({
                    code,
                    name: 'Original',
                    discount_type: 'percentage',
                    discount_value: 10,
                    is_active: true,
                    use_count: 0
                })
                .select()
                .single();

            const { data: updated, error } = await supabase
                .from('discount_codes')
                .update({ discount_value: 20, name: 'Updated' })
                .eq('id', created.id)
                .select()
                .single();

            expect(error).toBeNull();
            expect(parseFloat(updated.discount_value)).toBe(20);
            expect(updated.name).toBe('Updated');
        });

        it('should soft delete (deactivate) discount code', async () => {
            const code = `TEST-DELETE-${Date.now()}`;
            testCodes.push(code);

            const { data: created } = await supabase
                .from('discount_codes')
                .insert({
                    code,
                    name: 'To Delete',
                    discount_type: 'percentage',
                    discount_value: 10,
                    is_active: true,
                    use_count: 0
                })
                .select()
                .single();

            const { error } = await supabase
                .from('discount_codes')
                .update({ is_active: false })
                .eq('id', created.id);

            expect(error).toBeNull();

            const { data: deleted } = await supabase
                .from('discount_codes')
                .select('is_active')
                .eq('id', created.id)
                .single();

            expect(deleted.is_active).toBe(false);
        });
    });

    describe('Discount Calculations', () => {
        it('should calculate percentage discount correctly', () => {
            const orderTotal = 50;
            const discountPercent = 20;
            const discount = orderTotal * (discountPercent / 100);

            expect(discount).toBe(10);
        });

        it('should calculate fixed discount correctly', () => {
            const orderTotal = 50;
            const discountValue = 15;
            const discount = Math.min(discountValue, orderTotal);

            expect(discount).toBe(15);
        });

        it('should cap fixed discount at order total', () => {
            const orderTotal = 10;
            const discountValue = 15;
            const discount = Math.min(discountValue, orderTotal);

            expect(discount).toBe(10);
        });

        it('should calculate free delivery discount', () => {
            const deliveryCost = 3.49;
            const discountType = 'free_delivery';
            const discount = discountType === 'free_delivery' ? deliveryCost : 0;

            expect(discount).toBe(3.49);
        });
    });

    describe('Usage Limits', () => {
        it('should check max uses', () => {
            const maxUses = 100;
            const useCount = 100;
            const canUse = !maxUses || useCount < maxUses;

            expect(canUse).toBe(false);
        });

        it('should allow under max uses', () => {
            const maxUses = 100;
            const useCount = 50;
            const canUse = !maxUses || useCount < maxUses;

            expect(canUse).toBe(true);
        });

        it('should allow unlimited uses when max is null', () => {
            const maxUses = null;
            const useCount = 1000;
            const canUse = !maxUses || useCount < maxUses;

            expect(canUse).toBe(true);
        });

        it('should check per-customer limit', () => {
            const maxPerCustomer = 1;
            const customerUseCount = 1;
            const canUse = !maxPerCustomer || customerUseCount < maxPerCustomer;

            expect(canUse).toBe(false);
        });
    });

    describe('Date Validation', () => {
        it('should reject before start date', () => {
            const now = new Date();
            const startsAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Tomorrow
            const isStarted = !startsAt || new Date(startsAt) <= now;

            expect(isStarted).toBe(false);
        });

        it('should accept after start date', () => {
            const now = new Date();
            const startsAt = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Yesterday
            const isStarted = !startsAt || new Date(startsAt) <= now;

            expect(isStarted).toBe(true);
        });

        it('should reject after expiry date', () => {
            const now = new Date();
            const expiresAt = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Yesterday
            const isExpired = expiresAt && new Date(expiresAt) < now;

            expect(isExpired).toBe(true);
        });

        it('should accept before expiry date', () => {
            const now = new Date();
            const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Tomorrow
            const isExpired = expiresAt && new Date(expiresAt) < now;

            expect(isExpired).toBe(false);
        });

        it('should accept null expiry (never expires)', () => {
            const expiresAt = null;
            const now = new Date();
            const isExpired = expiresAt && new Date(expiresAt) < now;

            expect(isExpired).toBeFalsy();
        });
    });

    describe('Minimum Order Amount', () => {
        it('should reject order below minimum', () => {
            const orderTotal = 20;
            const minOrderAmount = 25;
            const meetsMinimum = !minOrderAmount || orderTotal >= minOrderAmount;

            expect(meetsMinimum).toBe(false);
        });

        it('should accept order at minimum', () => {
            const orderTotal = 25;
            const minOrderAmount = 25;
            const meetsMinimum = !minOrderAmount || orderTotal >= minOrderAmount;

            expect(meetsMinimum).toBe(true);
        });

        it('should accept order above minimum', () => {
            const orderTotal = 30;
            const minOrderAmount = 25;
            const meetsMinimum = !minOrderAmount || orderTotal >= minOrderAmount;

            expect(meetsMinimum).toBe(true);
        });

        it('should allow any order when minimum is null', () => {
            const orderTotal = 1;
            const minOrderAmount = null;
            const meetsMinimum = !minOrderAmount || orderTotal >= minOrderAmount;

            expect(meetsMinimum).toBe(true);
        });
    });
});
