/**
 * Checkout Utilities Unit Tests
 *
 * Tests the checkout helper functions for price verification
 * and shipping calculations.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { SHIPPING_CONFIG, calculateShipping, calculateTotals, verifyCartPrices } from '../../../netlify/functions/utils/checkout.js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

describe('Checkout Utilities', () => {
    describe('SHIPPING_CONFIG', () => {
        it('should have correct GBP threshold', () => {
            expect(SHIPPING_CONFIG.FREE_THRESHOLD_GBP).toBe(20);
        });

        it('should have correct pence threshold', () => {
            expect(SHIPPING_CONFIG.FREE_THRESHOLD_PENCE).toBe(2000);
        });

        it('should have correct GBP shipping cost', () => {
            expect(SHIPPING_CONFIG.STANDARD_COST_GBP).toBe(3.49);
        });

        it('should have correct pence shipping cost', () => {
            expect(SHIPPING_CONFIG.STANDARD_COST_PENCE).toBe(349);
        });

        it('should have consistent pence/GBP conversions', () => {
            expect(SHIPPING_CONFIG.FREE_THRESHOLD_PENCE).toBe(SHIPPING_CONFIG.FREE_THRESHOLD_GBP * 100);
            expect(SHIPPING_CONFIG.STANDARD_COST_PENCE).toBe(Math.round(SHIPPING_CONFIG.STANDARD_COST_GBP * 100));
        });
    });

    describe('calculateShipping()', () => {
        it('should return 0 for orders at threshold (GBP)', () => {
            expect(calculateShipping(20)).toBe(0);
        });

        it('should return 0 for orders over threshold (GBP)', () => {
            expect(calculateShipping(25)).toBe(0);
            expect(calculateShipping(100)).toBe(0);
        });

        it('should return shipping cost for orders under threshold (GBP)', () => {
            expect(calculateShipping(19.99)).toBe(3.49);
            expect(calculateShipping(10)).toBe(3.49);
            expect(calculateShipping(0)).toBe(3.49);
        });

        it('should return 0 for orders at threshold (pence)', () => {
            expect(calculateShipping(2000, true)).toBe(0);
        });

        it('should return 0 for orders over threshold (pence)', () => {
            expect(calculateShipping(2500, true)).toBe(0);
            expect(calculateShipping(10000, true)).toBe(0);
        });

        it('should return shipping cost for orders under threshold (pence)', () => {
            expect(calculateShipping(1999, true)).toBe(349);
            expect(calculateShipping(1000, true)).toBe(349);
            expect(calculateShipping(0, true)).toBe(349);
        });

        it('should default to GBP mode', () => {
            expect(calculateShipping(10)).toBe(3.49);
            expect(calculateShipping(10, false)).toBe(3.49);
        });
    });

    describe('calculateTotals()', () => {
        it('should calculate subtotal correctly', () => {
            const items = [
                { price: 10, quantity: 2 },
                { price: 5, quantity: 3 }
            ];
            const { subtotal } = calculateTotals(items);
            expect(subtotal).toBe(35); // 20 + 15
        });

        it('should add shipping for orders under threshold', () => {
            const items = [{ price: 10, quantity: 1 }];
            const { subtotal, shipping, total } = calculateTotals(items);
            expect(subtotal).toBe(10);
            expect(shipping).toBe(3.49);
            expect(total).toBeCloseTo(13.49, 2);
        });

        it('should have free shipping for orders at threshold', () => {
            const items = [{ price: 20, quantity: 1 }];
            const { subtotal, shipping, total } = calculateTotals(items);
            expect(subtotal).toBe(20);
            expect(shipping).toBe(0);
            expect(total).toBe(20);
        });

        it('should have free shipping for orders over threshold', () => {
            const items = [{ price: 25, quantity: 1 }];
            const { subtotal, shipping, total } = calculateTotals(items);
            expect(subtotal).toBe(25);
            expect(shipping).toBe(0);
            expect(total).toBe(25);
        });

        it('should handle empty items array', () => {
            const { subtotal, shipping, total } = calculateTotals([]);
            expect(subtotal).toBe(0);
            expect(shipping).toBe(3.49);
            expect(total).toBeCloseTo(3.49, 2);
        });

        it('should handle decimal prices', () => {
            const items = [
                { price: 9.99, quantity: 2 },
                { price: 4.50, quantity: 1 }
            ];
            const { subtotal } = calculateTotals(items);
            expect(subtotal).toBeCloseTo(24.48, 2);
        });

        it('should handle large quantities', () => {
            const items = [{ price: 5, quantity: 100 }];
            const { subtotal, shipping } = calculateTotals(items);
            expect(subtotal).toBe(500);
            expect(shipping).toBe(0);
        });
    });

    describe('verifyCartPrices()', () => {
        let testProductId;
        const testSlug = `test-checkout-${Date.now()}`;

        beforeAll(async () => {
            // Create test product
            const { data, error } = await supabase
                .from('products')
                .insert({
                    title: 'TEST_Checkout_Product',
                    slug: testSlug,
                    price_gbp: 15.99,
                    currency: 'GBP',
                    category: 'articulated-toys',
                    stock: 100,
                    is_active: true
                })
                .select('id')
                .single();

            if (error) {
                console.error('Failed to create test product:', error);
            }
            if (data) {
                testProductId = data.id;
            }
        });

        afterAll(async () => {
            if (testProductId) {
                await supabase.from('products').delete().eq('id', testProductId);
            }
        });

        it('should reject empty items', async () => {
            const result = await verifyCartPrices([]);
            expect(result.valid).toBe(false);
            expect(result.error).toBe('No items provided');
        });

        it('should reject null items', async () => {
            const result = await verifyCartPrices(null);
            expect(result.valid).toBe(false);
            expect(result.error).toBe('No items provided');
        });

        it('should reject undefined items', async () => {
            const result = await verifyCartPrices(undefined);
            expect(result.valid).toBe(false);
            expect(result.error).toBe('No items provided');
        });

        it('should reject non-array items', async () => {
            const result = await verifyCartPrices('not an array');
            expect(result.valid).toBe(false);
            expect(result.error).toBe('No items provided');
        });

        it('should reject items without valid IDs', async () => {
            const result = await verifyCartPrices([{ quantity: 1 }]);
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Invalid item IDs');
        });

        it('should verify valid cart items', async () => {
            if (!testProductId) {
                console.log('Skipping - test product not created');
                return;
            }

            const items = [
                { id: testProductId, title: 'Test', price: 15.99, quantity: 2 }
            ];
            const result = await verifyCartPrices(items);

            expect(result.valid).toBe(true);
            expect(result.items).toBeDefined();
            expect(result.items.length).toBe(1);
            expect(result.items[0].price).toBe(15.99);
            expect(result.items[0].quantity).toBe(2);
        });

        it('should use database price over client price', async () => {
            if (!testProductId) {
                console.log('Skipping - test product not created');
                return;
            }

            const items = [
                { id: testProductId, title: 'Test', price: 999.99, quantity: 1 }
            ];
            const result = await verifyCartPrices(items);

            expect(result.valid).toBe(true);
            expect(result.items[0].price).toBe(15.99); // Database price, not 999.99
        });

        it('should reject non-existent products', async () => {
            const items = [
                { id: 999999, title: 'Fake Product', price: 10, quantity: 1 }
            ];
            const result = await verifyCartPrices(items);

            expect(result.valid).toBe(false);
            expect(result.error).toContain('Product not found');
        });

        it('should reject insufficient stock', async () => {
            if (!testProductId) {
                console.log('Skipping - test product not created');
                return;
            }

            const items = [
                { id: testProductId, title: 'Test', price: 15.99, quantity: 9999 }
            ];
            const result = await verifyCartPrices(items);

            expect(result.valid).toBe(false);
            expect(result.error).toContain('Insufficient stock');
        });

        it('should preserve variation in verified items', async () => {
            if (!testProductId) {
                console.log('Skipping - test product not created');
                return;
            }

            const items = [
                { id: testProductId, title: 'Test', price: 15.99, quantity: 1, variation: 'Blue' }
            ];
            const result = await verifyCartPrices(items);

            expect(result.valid).toBe(true);
            expect(result.items[0].variation).toBe('Blue');
        });

        it('should handle null variation', async () => {
            if (!testProductId) {
                console.log('Skipping - test product not created');
                return;
            }

            const items = [
                { id: testProductId, title: 'Test', price: 15.99, quantity: 1 }
            ];
            const result = await verifyCartPrices(items);

            expect(result.valid).toBe(true);
            expect(result.items[0].variation).toBeNull();
        });
    });
});
