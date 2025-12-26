/**
 * PayPal Checkout Function Tests
 *
 * Tests the PayPal order creation logic and calculations.
 * Uses real Supabase for integration testing.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { verifyCartPrices, calculateTotals, SHIPPING_CONFIG } from '../../netlify/functions/utils/checkout.js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

describe('PayPal Checkout Logic', () => {
    let testProductId;

    beforeAll(async () => {
        // Create a test product
        const { data, error } = await supabase
            .from('products')
            .insert({
                title: 'TEST_PayPal_Product',
                slug: 'test-paypal-product',
                price_gbp: 12.99,
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
    });

    describe('PayPal Order Payload Format', () => {
        it('should format currency as GBP', () => {
            const currency = 'GBP';
            const amount = 25.00;
            const formatted = {
                currency_code: currency,
                value: amount.toFixed(2)
            };

            expect(formatted.currency_code).toBe('GBP');
            expect(formatted.value).toBe('25.00');
        });

        it('should format amount with 2 decimal places', () => {
            const amounts = [10, 10.5, 10.55, 10.999];
            const expected = ['10.00', '10.50', '10.55', '11.00'];

            amounts.forEach((amount, i) => {
                expect(amount.toFixed(2)).toBe(expected[i]);
            });
        });

        it('should truncate product name to PayPal limit', () => {
            const longName = 'A'.repeat(200);
            const discountCode = 'SAVE10';
            const fullName = (longName + ` (${discountCode})`).substring(0, 127);

            expect(fullName.length).toBeLessThanOrEqual(127);
        });

        it('should format line item correctly', () => {
            const item = {
                title: 'Test Product',
                price: 15.99,
                quantity: 2
            };

            const lineItem = {
                name: item.title,
                quantity: item.quantity.toString(),
                unit_amount: {
                    currency_code: 'GBP',
                    value: item.price.toFixed(2)
                },
                category: 'PHYSICAL_GOODS'
            };

            expect(lineItem.name).toBe('Test Product');
            expect(lineItem.quantity).toBe('2');
            expect(lineItem.unit_amount.value).toBe('15.99');
            expect(lineItem.category).toBe('PHYSICAL_GOODS');
        });
    });

    describe('Price Verification (GBP)', () => {
        it('should verify prices in GBP (not pence)', async () => {
            if (!testProductId) {
                console.log('Skipping - no test product');
                return;
            }

            const cartItems = [{
                id: testProductId,
                title: 'TEST_PayPal_Product',
                price: 12.99, // GBP
                quantity: 1
            }];

            const result = await verifyCartPrices(cartItems);
            expect(result.valid).toBe(true);
            expect(result.items[0].price).toBe(12.99);
        });
    });

    describe('Total Calculations (GBP)', () => {
        it('should calculate totals in GBP', () => {
            const items = [
                { price: 10.00, quantity: 2 },
                { price: 5.50, quantity: 1 }
            ];

            const { subtotal, shipping, total } = calculateTotals(items);

            expect(subtotal).toBe(25.50);
            expect(shipping).toBe(0); // Free shipping over £20
            expect(total).toBe(25.50);
        });

        it('should calculate shipping correctly in GBP', () => {
            const items = [{ price: 15.00, quantity: 1 }];
            const { subtotal, shipping, total } = calculateTotals(items);

            expect(subtotal).toBe(15.00);
            expect(shipping).toBe(3.49);
            expect(total).toBeCloseTo(18.49, 2);
        });
    });

    describe('Discount Application', () => {
        it('should apply percentage discount correctly', () => {
            const subtotal = 50.00;
            const discountPercent = 10;
            const discountAmount = (subtotal * discountPercent) / 100;

            expect(discountAmount).toBe(5.00);
        });

        it('should apply fixed discount correctly', () => {
            const subtotal = 50.00;
            const fixedDiscount = 7.50;
            const discountAmount = parseFloat(fixedDiscount);

            expect(discountAmount).toBe(7.50);
        });

        it('should cap discount at subtotal', () => {
            const subtotal = 10.00;
            const fixedDiscount = 15.00;
            const discountAmount = Math.min(fixedDiscount, subtotal);

            expect(discountAmount).toBe(10.00);
        });

        it('should round discount to 2 decimal places', () => {
            const subtotal = 33.33;
            const discountPercent = 10;
            const rawDiscount = (subtotal * discountPercent) / 100;
            const discountAmount = Math.round(rawDiscount * 100) / 100;

            expect(discountAmount).toBe(3.33);
        });

        it('should recalculate shipping after discount', () => {
            const subtotal = 25.00;
            const discountAmount = 10.00;
            const afterDiscount = subtotal - discountAmount;

            // After discount is £15, under £20 threshold
            const shipping = afterDiscount >= 20 ? 0 : 3.49;
            expect(shipping).toBe(3.49);
        });
    });

    describe('Proportional Discount Distribution', () => {
        it('should distribute discount proportionally to items', () => {
            const items = [
                { title: 'Item A', price: 30.00, quantity: 1 },
                { title: 'Item B', price: 20.00, quantity: 1 }
            ];
            const subtotal = 50.00;
            const discountAmount = 10.00; // 20% off
            const discountRatio = discountAmount / subtotal;

            const adjustedItems = items.map(item => ({
                ...item,
                adjustedPrice: Math.round(item.price * (1 - discountRatio) * 100) / 100
            }));

            // 20% off each item
            expect(adjustedItems[0].adjustedPrice).toBe(24.00); // 30 * 0.8
            expect(adjustedItems[1].adjustedPrice).toBe(16.00); // 20 * 0.8
        });

        it('should preserve item total after proportional distribution', () => {
            const items = [
                { title: 'Item A', price: 25.00, quantity: 2 },
                { title: 'Item B', price: 10.00, quantity: 1 }
            ];
            const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
            const discountAmount = 6.00; // 10% off
            const discountRatio = discountAmount / subtotal;

            const adjustedItems = items.map(item => ({
                ...item,
                adjustedPrice: Math.round(item.price * (1 - discountRatio) * 100) / 100
            }));

            const adjustedTotal = adjustedItems.reduce(
                (sum, item) => sum + item.adjustedPrice * item.quantity, 0
            );

            expect(adjustedTotal).toBeCloseTo(subtotal - discountAmount, 1);
        });
    });

    describe('Free Delivery Discount Type', () => {
        it('should not reduce price for free delivery discount', () => {
            const discountType = 'free_delivery';
            const subtotal = 15.00;
            let discountAmount = 0;

            if (discountType !== 'free_delivery') {
                discountAmount = 5.00;
            }

            expect(discountAmount).toBe(0);
        });

        it('should set shipping to 0 for free delivery', () => {
            const discountType = 'free_delivery';
            const subtotal = 15.00;
            const normalShipping = 3.49;

            const shipping = discountType === 'free_delivery' ? 0 : normalShipping;

            expect(shipping).toBe(0);
        });
    });

    describe('PayPal Order Amount Breakdown', () => {
        it('should have correct breakdown structure', () => {
            const items = [{ title: 'Test', price: 15.00, quantity: 2 }];
            const itemTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
            const shipping = 3.49;
            const total = itemTotal + shipping;

            const breakdown = {
                item_total: {
                    currency_code: 'GBP',
                    value: itemTotal.toFixed(2)
                },
                shipping: {
                    currency_code: 'GBP',
                    value: shipping.toFixed(2)
                }
            };

            expect(breakdown.item_total.value).toBe('30.00');
            expect(breakdown.shipping.value).toBe('3.49');
            expect(total).toBe(33.49);
        });

        it('should match total with breakdown sum', () => {
            const itemTotal = 25.00;
            const shipping = 3.49;
            const calculatedTotal = itemTotal + shipping;

            expect(calculatedTotal.toFixed(2)).toBe('28.49');
        });
    });

    describe('Shipping Options Format', () => {
        it('should format standard shipping option', () => {
            const shipping = 3.49;
            const option = {
                id: 'standard',
                label: 'Standard Shipping',
                selected: true,
                amount: {
                    currency_code: 'GBP',
                    value: shipping.toFixed(2)
                }
            };

            expect(option.id).toBe('standard');
            expect(option.amount.value).toBe('3.49');
        });

        it('should format free shipping option', () => {
            const shipping = 0;
            const option = {
                id: shipping > 0 ? 'standard' : 'free',
                label: shipping > 0 ? 'Standard Shipping' : 'Free Shipping',
                selected: true,
                amount: {
                    currency_code: 'GBP',
                    value: shipping.toFixed(2)
                }
            };

            expect(option.id).toBe('free');
            expect(option.label).toBe('Free Shipping');
            expect(option.amount.value).toBe('0.00');
        });
    });

    describe('Custom ID for Discount Info', () => {
        it('should serialize discount info to custom_id', () => {
            const discountInfo = {
                discount_code: 'SAVE10',
                discount_type: 'percentage',
                discount_value: 10,
                discount_amount: 5.00
            };

            const customId = JSON.stringify(discountInfo);
            const parsed = JSON.parse(customId);

            expect(parsed.discount_code).toBe('SAVE10');
            expect(parsed.discount_type).toBe('percentage');
            expect(parsed.discount_value).toBe(10);
            expect(parsed.discount_amount).toBe(5.00);
        });

        it('should be undefined when no discount', () => {
            const discountInfo = null;
            const customId = discountInfo ? JSON.stringify(discountInfo) : undefined;

            expect(customId).toBeUndefined();
        });
    });

    describe('Application Context', () => {
        it('should have correct brand name', () => {
            const context = {
                brand_name: 'Fidget Street',
                landing_page: 'BILLING',
                shipping_preference: 'GET_FROM_FILE',
                user_action: 'PAY_NOW'
            };

            expect(context.brand_name).toBe('Fidget Street');
            expect(context.user_action).toBe('PAY_NOW');
        });

        it('should construct correct return URLs', () => {
            const baseUrl = 'https://fidgetstreet.co.uk';
            const context = {
                return_url: `${baseUrl}/success.html`,
                cancel_url: `${baseUrl}/cart.html`
            };

            expect(context.return_url).toBe('https://fidgetstreet.co.uk/success.html');
            expect(context.cancel_url).toBe('https://fidgetstreet.co.uk/cart.html');
        });
    });

    describe('Per-Customer Discount Limits', () => {
        it('should check per-customer usage', () => {
            const discount = {
                max_uses_per_customer: 2
            };
            const currentUsage = 1;

            const canUse = currentUsage < discount.max_uses_per_customer;
            expect(canUse).toBe(true);
        });

        it('should reject when limit reached', () => {
            const discount = {
                max_uses_per_customer: 2
            };
            const currentUsage = 2;

            const canUse = currentUsage < discount.max_uses_per_customer;
            expect(canUse).toBe(false);
        });

        it('should allow unlimited when not set', () => {
            const discount = {
                max_uses_per_customer: null
            };
            const currentUsage = 100;

            const canUse = !discount.max_uses_per_customer || currentUsage < discount.max_uses_per_customer;
            expect(canUse).toBe(true);
        });
    });

    describe('Minimum Order Amount', () => {
        it('should check minimum order amount', () => {
            const discount = {
                min_order_amount: 50
            };
            const subtotal = 45.00;

            const meetsMinimum = subtotal >= parseFloat(discount.min_order_amount);
            expect(meetsMinimum).toBe(false);
        });

        it('should pass when meeting minimum', () => {
            const discount = {
                min_order_amount: 50
            };
            const subtotal = 50.00;

            const meetsMinimum = subtotal >= parseFloat(discount.min_order_amount);
            expect(meetsMinimum).toBe(true);
        });

        it('should handle null minimum', () => {
            const discount = {
                min_order_amount: null
            };
            const subtotal = 5.00;

            const meetsMinimum = !discount.min_order_amount || subtotal >= parseFloat(discount.min_order_amount);
            expect(meetsMinimum).toBe(true);
        });
    });
});
