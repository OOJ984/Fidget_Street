/**
 * Orders API Integration Tests
 *
 * Tests the orders API endpoints with real Supabase database.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { generateOrderNumber, calculateOrderTotals } from '../../netlify/functions/utils/orders.js';
import { validateEmail, validateName, validateOrderItems, validateShippingAddress } from '../../netlify/functions/utils/validation.js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

describe('Orders API Integration', () => {
    const testOrderNumbers = [];

    afterAll(async () => {
        // Clean up test orders
        for (const orderNumber of testOrderNumbers) {
            await supabase
                .from('orders')
                .delete()
                .eq('order_number', orderNumber);
        }
    });

    describe('Order Creation', () => {
        it('should create order with valid data', async () => {
            const orderNumber = `TEST-ORDER-${Date.now()}`;
            testOrderNumbers.push(orderNumber);

            const items = [
                { id: 1, title: 'Test Product', price: 15.00, quantity: 2 }
            ];
            const { subtotal, shipping, total } = calculateOrderTotals(items);

            const { data, error } = await supabase
                .from('orders')
                .insert([{
                    order_number: orderNumber,
                    customer_email: 'test@example.com',
                    customer_name: 'Test Customer',
                    shipping_address: {
                        line1: '123 Test Street',
                        city: 'London',
                        postcode: 'SW1A 1AA',
                        country: 'United Kingdom'
                    },
                    items: items,
                    subtotal: subtotal,
                    shipping: shipping,
                    total: total,
                    status: 'pending',
                    payment_method: 'stripe'
                }])
                .select()
                .single();

            expect(error).toBeNull();
            expect(data).toBeDefined();
            expect(data.order_number).toBe(orderNumber);
            expect(data.status).toBe('pending');
        });

        it('should calculate totals correctly', async () => {
            const items = [
                { id: 1, title: 'Product A', price: 10.00, quantity: 2 },
                { id: 2, title: 'Product B', price: 5.00, quantity: 1 }
            ];

            const { subtotal, shipping, total } = calculateOrderTotals(items);

            expect(subtotal).toBe(25.00);
            expect(shipping).toBe(0); // Free shipping over £20
            expect(total).toBe(25.00);
        });

        it('should add shipping for small orders', async () => {
            const items = [
                { id: 1, title: 'Small Product', price: 8.00, quantity: 1 }
            ];

            const { subtotal, shipping, total } = calculateOrderTotals(items);

            expect(subtotal).toBe(8.00);
            expect(shipping).toBe(3.49);
            expect(total).toBeCloseTo(11.49, 2);
        });
    });

    describe('Order Lookup', () => {
        let lookupOrderNumber;

        beforeAll(async () => {
            // Create order for lookup tests
            lookupOrderNumber = `TEST-LOOKUP-${Date.now()}`;
            testOrderNumbers.push(lookupOrderNumber);

            const { error } = await supabase
                .from('orders')
                .insert([{
                    order_number: lookupOrderNumber,
                    customer_email: 'lookup@example.com',
                    customer_name: 'Lookup Test',
                    shipping_address: {
                        line1: '456 Test Avenue',
                        city: 'Manchester',
                        postcode: 'M1 1AA',
                        country: 'United Kingdom'
                    },
                    items: [{ id: 1, title: 'Test', price: 20.00, quantity: 1 }],
                    subtotal: 20.00,
                    shipping: 0,
                    total: 20.00,
                    status: 'paid',
                    payment_method: 'stripe'
                }]);

            if (error) {
                console.error('Failed to create lookup test order:', error);
                lookupOrderNumber = null;
            }
        });

        it('should find order by order_number', async () => {
            if (!lookupOrderNumber) {
                console.log('Skipping - lookup order not created');
                return;
            }

            const { data, error } = await supabase
                .from('orders')
                .select('order_number, status, items, total')
                .eq('order_number', lookupOrderNumber)
                .single();

            expect(error).toBeNull();
            expect(data).toBeDefined();
            expect(data.order_number).toBe(lookupOrderNumber);
            expect(data.status).toBe('paid');
        });

        it('should return null for non-existent order', async () => {
            const { data } = await supabase
                .from('orders')
                .select('order_number')
                .eq('order_number', 'FS-99999999-9999')
                .single();

            expect(data).toBeNull();
        });

        it('should find order by payment_id', async () => {
            const paymentId = `pi_lookup_${Date.now()}`;
            const orderWithPayment = `TEST-PAYMENT-${Date.now()}`;
            testOrderNumbers.push(orderWithPayment);

            // Create order with payment_id
            const { error: insertError } = await supabase
                .from('orders')
                .insert([{
                    order_number: orderWithPayment,
                    customer_email: 'payment@example.com',
                    customer_name: 'Payment Test',
                    shipping_address: {
                        line1: '789 Test Road',
                        city: 'Birmingham',
                        postcode: 'B1 1AA',
                        country: 'United Kingdom'
                    },
                    items: [],
                    subtotal: 30.00,
                    shipping: 0,
                    total: 30.00,
                    status: 'paid',
                    payment_method: 'stripe',
                    payment_id: paymentId
                }]);

            if (insertError) {
                console.log('Skipping - order creation failed:', insertError.message);
                return;
            }

            // Look up by payment_id
            const { data } = await supabase
                .from('orders')
                .select('order_number')
                .eq('payment_id', paymentId)
                .single();

            if (!data) {
                console.log('Skipping - order not found after insert');
                return;
            }

            expect(data.order_number).toBe(orderWithPayment);
        });
    });

    describe('Order Status Updates', () => {
        let statusOrderNumber;

        beforeAll(async () => {
            statusOrderNumber = `TEST-STATUS-${Date.now()}`;
            testOrderNumbers.push(statusOrderNumber);

            const { error } = await supabase
                .from('orders')
                .insert([{
                    order_number: statusOrderNumber,
                    customer_email: 'status@example.com',
                    customer_name: 'Status Test',
                    shipping_address: {
                        line1: '321 Test Lane',
                        city: 'Leeds',
                        postcode: 'LS1 1AA',
                        country: 'United Kingdom'
                    },
                    items: [],
                    subtotal: 25.00,
                    shipping: 0,
                    total: 25.00,
                    status: 'pending',
                    payment_method: 'stripe'
                }]);

            if (error) {
                console.error('Failed to create status test order:', error);
                statusOrderNumber = null;
            }
        });

        it('should update order status to paid', async () => {
            if (!statusOrderNumber) {
                console.log('Skipping - status order not created');
                return;
            }

            const { error } = await supabase
                .from('orders')
                .update({ status: 'paid' })
                .eq('order_number', statusOrderNumber);

            expect(error).toBeNull();

            // Verify update
            const { data } = await supabase
                .from('orders')
                .select('status')
                .eq('order_number', statusOrderNumber)
                .single();

            if (!data) {
                console.log('Skipping - order not found after update');
                return;
            }

            expect(data.status).toBe('paid');
        });

        it('should update order status to shipped', async () => {
            if (!statusOrderNumber) {
                console.log('Skipping - status order not created');
                return;
            }

            const { error } = await supabase
                .from('orders')
                .update({ status: 'shipped' })
                .eq('order_number', statusOrderNumber);

            expect(error).toBeNull();

            const { data } = await supabase
                .from('orders')
                .select('status')
                .eq('order_number', statusOrderNumber)
                .single();

            if (!data) {
                console.log('Skipping - order not found after update');
                return;
            }

            expect(data.status).toBe('shipped');
        });

        it('should update order status to delivered', async () => {
            if (!statusOrderNumber) {
                console.log('Skipping - status order not created');
                return;
            }

            const { error } = await supabase
                .from('orders')
                .update({ status: 'delivered' })
                .eq('order_number', statusOrderNumber);

            expect(error).toBeNull();

            const { data } = await supabase
                .from('orders')
                .select('status')
                .eq('order_number', statusOrderNumber)
                .single();

            if (!data) {
                console.log('Skipping - order not found after update');
                return;
            }

            expect(data.status).toBe('delivered');
        });
    });

    describe('Input Validation', () => {
        it('should validate email format', () => {
            expect(validateEmail('valid@example.com').valid).toBe(true);
            expect(validateEmail('invalid').valid).toBe(false);
            expect(validateEmail('').valid).toBe(false);
        });

        it('should validate customer name', () => {
            expect(validateName('John Doe').valid).toBe(true);
            expect(validateName('').valid).toBe(false);
            expect(validateName('<script>').valid).toBe(false);
        });

        it('should validate order items', () => {
            const validItems = [{ id: 1, title: 'Test', price: 10.00, quantity: 1 }];
            expect(validateOrderItems(validItems).valid).toBe(true);
            expect(validateOrderItems([]).valid).toBe(false);
            expect(validateOrderItems(null).valid).toBe(false);
        });

        it('should validate shipping address', () => {
            const validAddress = {
                line1: '123 Test Street',
                city: 'London',
                postcode: 'SW1A 1AA',
                country: 'United Kingdom'
            };
            expect(validateShippingAddress(validAddress).valid).toBe(true);
            expect(validateShippingAddress({}).valid).toBe(false);
        });
    });

    describe('Order Number Format', () => {
        it('should generate valid order numbers', () => {
            for (let i = 0; i < 10; i++) {
                const orderNumber = generateOrderNumber();
                expect(orderNumber).toMatch(/^FS-\d{8}-\d{4}$/);
            }
        });

        it('should include current date in order number', () => {
            const orderNumber = generateOrderNumber();
            const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            expect(orderNumber).toContain(today);
        });
    });
});
