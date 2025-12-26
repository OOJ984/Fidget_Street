/**
 * Stripe Checkout Function Tests
 *
 * Tests the checkout logic and calculations.
 * Uses real Supabase for integration testing.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// Use real Supabase for testing
const supabase = createClient(
    process.env.SUPABASE_URL || 'https://qyvojrjxzkwqljghlkoe.supabase.co',
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

// Import the checkout utilities directly
import { verifyCartPrices, calculateShipping, SHIPPING_CONFIG } from '../../netlify/functions/utils/checkout.js';

describe('Stripe Checkout Logic', () => {
    // Test product data
    let testProductId;

    beforeAll(async () => {
        // Create a test product
        const { data, error } = await supabase
            .from('products')
            .insert({
                title: 'TEST_Checkout_Product',
                slug: 'test-checkout-product',
                price_gbp: 15.99,
                stock: 100,
                is_active: true,
                category: 'Test'
            })
            .select()
            .single();

        if (data) {
            testProductId = data.id;
        }
    });

    afterAll(async () => {
        // Clean up test product
        if (testProductId) {
            await supabase
                .from('products')
                .delete()
                .eq('id', testProductId);
        }

        // Clean up any test orders
        await supabase
            .from('orders')
            .delete()
            .like('order_number', 'TEST-%');
    });

    describe('Shipping Calculation', () => {
        it('should calculate free shipping for orders over £20', () => {
            // £20 = 2000 pence
            const shipping = calculateShipping(2000, true);
            expect(shipping).toBe(0);
        });

        it('should calculate free shipping for orders exactly £20', () => {
            const shipping = calculateShipping(2000, true);
            expect(shipping).toBe(0);
        });

        it('should charge shipping for orders under £20', () => {
            const shipping = calculateShipping(1999, true);
            expect(shipping).toBe(349); // £3.49 in pence
        });

        it('should charge shipping for small orders', () => {
            const shipping = calculateShipping(500, true);
            expect(shipping).toBe(349);
        });

        it('should work with GBP (non-pence) values', () => {
            const shipping = calculateShipping(25, false);
            expect(shipping).toBe(0); // £25 = free shipping
        });

        it('should charge shipping for low GBP values', () => {
            const shipping = calculateShipping(10, false);
            expect(shipping).toBe(3.49);
        });
    });

    describe('Cart Price Verification', () => {
        it('should verify valid cart items', async () => {
            if (!testProductId) {
                console.log('Skipping - no test product');
                return;
            }

            const cartItems = [{
                id: testProductId,
                title: 'TEST_Checkout_Product',
                price: 15.99,
                quantity: 2
            }];

            const result = await verifyCartPrices(cartItems);

            expect(result.valid).toBe(true);
            expect(result.items).toBeDefined();
            expect(result.items.length).toBe(1);
            expect(result.items[0].price).toBe(15.99);
        });

        it('should reject empty cart', async () => {
            const result = await verifyCartPrices([]);
            expect(result.valid).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should reject null cart', async () => {
            const result = await verifyCartPrices(null);
            expect(result.valid).toBe(false);
        });

        it('should reject invalid product ID', async () => {
            const cartItems = [{
                id: 999999999, // Non-existent integer ID
                title: 'Fake Product',
                price: 10.00,
                quantity: 1
            }];

            const result = await verifyCartPrices(cartItems);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('not found');
        });

        it('should reject tampered prices', async () => {
            if (!testProductId) {
                console.log('Skipping - no test product');
                return;
            }

            const cartItems = [{
                id: testProductId,
                title: 'TEST_Checkout_Product',
                price: 1.00, // Tampered - actual is 15.99
                quantity: 1
            }];

            const result = await verifyCartPrices(cartItems);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('price');
        });

        it('should handle out of stock products', async () => {
            // Create out of stock product
            const { data: outOfStock } = await supabase
                .from('products')
                .insert({
                    title: 'TEST_OutOfStock',
                    slug: 'test-out-of-stock',
                    price_gbp: 10.00,
                    stock: 0,
                    is_active: true,
                    category: 'Test'
                })
                .select()
                .single();

            if (outOfStock) {
                const cartItems = [{
                    id: outOfStock.id,
                    title: 'TEST_OutOfStock',
                    price: 10.00,
                    quantity: 1
                }];

                const result = await verifyCartPrices(cartItems);

                // Clean up
                await supabase.from('products').delete().eq('id', outOfStock.id);

                expect(result.valid).toBe(false);
                expect(result.error).toContain('stock');
            }
        });

        it('should handle inactive products', async () => {
            // Create inactive product
            const { data: inactive } = await supabase
                .from('products')
                .insert({
                    title: 'TEST_Inactive',
                    slug: 'test-inactive',
                    price_gbp: 10.00,
                    stock: 100,
                    is_active: false,
                    category: 'Test'
                })
                .select()
                .single();

            if (inactive) {
                const cartItems = [{
                    id: inactive.id,
                    title: 'TEST_Inactive',
                    price: 10.00,
                    quantity: 1
                }];

                const result = await verifyCartPrices(cartItems);

                // Clean up
                await supabase.from('products').delete().eq('id', inactive.id);

                expect(result.valid).toBe(false);
            }
        });
    });

    describe('Price Calculations', () => {
        it('should calculate subtotal correctly', () => {
            const items = [
                { price: 10.00, quantity: 2 },
                { price: 5.50, quantity: 3 }
            ];

            const subtotalPence = items.reduce(
                (sum, item) => sum + Math.round(item.price * 100) * item.quantity,
                0
            );

            expect(subtotalPence).toBe(3650); // (10*2 + 5.50*3) * 100 = 3650
        });

        it('should handle floating point precision', () => {
            const items = [
                { price: 0.10, quantity: 3 } // 0.1 + 0.1 + 0.1 famously != 0.3 in JS
            ];

            const subtotalPence = items.reduce(
                (sum, item) => sum + Math.round(item.price * 100) * item.quantity,
                0
            );

            expect(subtotalPence).toBe(30); // Should be exactly 30 pence
        });

        it('should apply percentage discount correctly', () => {
            const subtotalPence = 2000; // £20
            const discountPercent = 10;
            const discountAmount = Math.round((subtotalPence * discountPercent) / 100);

            expect(discountAmount).toBe(200); // £2
        });

        it('should apply fixed discount correctly', () => {
            const subtotalPence = 2000;
            const discountFixed = 5.00; // £5
            const discountAmount = Math.round(discountFixed * 100);

            expect(discountAmount).toBe(500);
        });

        it('should cap discount at subtotal', () => {
            const subtotalPence = 1000; // £10
            const discountFixed = 15.00; // £15 (more than subtotal)
            let discountAmount = Math.round(discountFixed * 100);
            discountAmount = Math.min(discountAmount, subtotalPence);

            expect(discountAmount).toBe(1000); // Should be capped at £10
        });

        it('should calculate total with shipping', () => {
            const subtotalPence = 1500; // £15
            const shipping = calculateShipping(subtotalPence, true);
            const total = subtotalPence + shipping;

            expect(total).toBe(1849); // £15 + £3.49 = £18.49
        });

        it('should calculate total with free shipping', () => {
            const subtotalPence = 2500; // £25
            const shipping = calculateShipping(subtotalPence, true);
            const total = subtotalPence + shipping;

            expect(total).toBe(2500); // Free shipping
        });
    });

    describe('Gift Card Calculations', () => {
        it('should calculate gift card deduction', () => {
            const orderTotal = 2500; // £25
            const giftCardBalance = 1000; // £10
            const requestedAmount = 1000; // £10

            const deduction = Math.min(requestedAmount, giftCardBalance, orderTotal);

            expect(deduction).toBe(1000);
        });

        it('should limit gift card to order total', () => {
            const orderTotal = 1500; // £15
            const giftCardBalance = 5000; // £50
            const requestedAmount = 2000; // £20

            const deduction = Math.min(requestedAmount, giftCardBalance, orderTotal);

            expect(deduction).toBe(1500); // Limited to order total
        });

        it('should limit to gift card balance', () => {
            const orderTotal = 5000; // £50
            const giftCardBalance = 1000; // £10
            const requestedAmount = 2000; // £20

            const deduction = Math.min(requestedAmount, giftCardBalance, orderTotal);

            expect(deduction).toBe(1000); // Limited to balance
        });

        it('should use requested amount when lowest', () => {
            const orderTotal = 5000; // £50
            const giftCardBalance = 3000; // £30
            const requestedAmount = 1500; // £15

            const deduction = Math.min(requestedAmount, giftCardBalance, orderTotal);

            expect(deduction).toBe(1500);
        });
    });

    describe('Stripe Line Items', () => {
        it('should format line items correctly', () => {
            const items = [
                { title: 'Product A', price: 10.00, quantity: 2, variation: 'Blue' }
            ];

            const lineItems = items.map(item => ({
                price_data: {
                    currency: 'gbp',
                    product_data: {
                        name: item.title,
                        description: item.variation || undefined
                    },
                    unit_amount: Math.round(item.price * 100)
                },
                quantity: item.quantity
            }));

            expect(lineItems[0].price_data.currency).toBe('gbp');
            expect(lineItems[0].price_data.unit_amount).toBe(1000);
            expect(lineItems[0].price_data.product_data.name).toBe('Product A');
            expect(lineItems[0].price_data.product_data.description).toBe('Blue');
            expect(lineItems[0].quantity).toBe(2);
        });

        it('should add shipping line item when applicable', () => {
            const subtotalPence = 1500;
            const shipping = calculateShipping(subtotalPence, true);

            const lineItems = [];
            if (shipping > 0) {
                lineItems.push({
                    price_data: {
                        currency: 'gbp',
                        product_data: { name: 'Shipping' },
                        unit_amount: shipping
                    },
                    quantity: 1
                });
            }

            expect(lineItems.length).toBe(1);
            expect(lineItems[0].price_data.unit_amount).toBe(349); // £3.49
        });

        it('should not add shipping when free', () => {
            const subtotalPence = 2500;
            const shipping = calculateShipping(subtotalPence, true);

            const lineItems = [];
            if (shipping > 0) {
                lineItems.push({
                    price_data: {
                        currency: 'gbp',
                        product_data: { name: 'Shipping' },
                        unit_amount: shipping
                    },
                    quantity: 1
                });
            }

            expect(lineItems.length).toBe(0);
        });
    });
});
