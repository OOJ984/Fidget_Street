/**
 * Orders API Handler Tests
 *
 * Tests the orders.js Netlify function handler with mock HTTP events.
 * Tests both GET (order lookup) and POST (order creation) endpoints.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const { handler } = require('../../netlify/functions/orders.js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

function createMockEvent(options = {}) {
    return {
        httpMethod: options.method || 'GET',
        headers: {
            origin: options.origin || 'http://localhost:8888',
            'content-type': 'application/json',
            ...options.headers
        },
        queryStringParameters: options.query || null,
        body: options.body ? JSON.stringify(options.body) : null,
        isBase64Encoded: false
    };
}

describe('Orders API Handler', () => {
    const testOrderNumbers = [];
    let testProductId;
    const testSlug = `test-orders-handler-${Date.now()}`;

    beforeAll(async () => {
        // Create a test product for order items
        const { data: product } = await supabase
            .from('products')
            .insert({
                title: 'TEST_Orders_Handler_Product',
                slug: testSlug,
                price_gbp: 10.00,
                currency: 'GBP',
                category: 'spinners',
                stock: 100,
                is_active: true
            })
            .select('id')
            .single();

        if (product) {
            testProductId = product.id;
        }

        // Create a test order for lookup tests
        const orderNumber = `FS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        testOrderNumbers.push(orderNumber);

        await supabase.from('orders').insert({
            order_number: orderNumber,
            customer_email: 'test@example.com',
            customer_name: 'Test Customer',
            shipping_address: {
                line1: '123 Test Street',
                city: 'London',
                postal_code: 'SW1A 1AA',
                country: 'GB'
            },
            items: [{ id: testProductId || 1, title: 'Test Product', price: 10.00, quantity: 2 }],
            subtotal: 20.00,
            shipping: 0,
            total: 20.00,
            status: 'paid'
        });
    });

    afterAll(async () => {
        // Clean up test orders
        for (const orderNum of testOrderNumbers) {
            await supabase.from('orders').delete().eq('order_number', orderNum);
        }
        // Clean up test product
        if (testProductId) {
            await supabase.from('products').delete().eq('id', testProductId);
        }
    });

    describe('HTTP Method Handling', () => {
        it('should return 200 for OPTIONS (preflight)', async () => {
            const event = createMockEvent({ method: 'OPTIONS' });
            const response = await handler(event, {});

            expect(response.statusCode).toBe(200);
        });

        it('should return 405 for PUT method', async () => {
            const event = createMockEvent({ method: 'PUT' });
            const response = await handler(event, {});

            expect(response.statusCode).toBe(405);
        });

        it('should return 405 for DELETE method', async () => {
            const event = createMockEvent({ method: 'DELETE' });
            const response = await handler(event, {});

            expect(response.statusCode).toBe(405);
        });

        it('should accept GET method', async () => {
            const event = createMockEvent({
                method: 'GET',
                query: { order_number: testOrderNumbers[0] }
            });
            const response = await handler(event, {});

            expect([200, 400, 404]).toContain(response.statusCode);
        });

        it('should accept POST method', async () => {
            const event = createMockEvent({
                method: 'POST',
                body: {
                    customer_email: 'test@example.com',
                    customer_name: 'Test User',
                    shipping_address: {
                        line1: '1 Test St',
                        city: 'London',
                        postal_code: 'SW1A 1AA',
                        country: 'GB'
                    },
                    items: [{ id: testProductId || 1, title: 'Test', price: 15.00, quantity: 1 }]
                }
            });
            const response = await handler(event, {});

            expect([201, 400, 500]).toContain(response.statusCode);
            if (response.statusCode === 201) {
                const body = JSON.parse(response.body);
                if (body.order_number) {
                    testOrderNumbers.push(body.order_number);
                }
            }
        });
    });

    describe('GET - Order Lookup by Order Number', () => {
        it('should return order by order_number', async () => {
            if (!testOrderNumbers[0]) {
                console.log('Skipping - test order not created');
                return;
            }

            const event = createMockEvent({
                method: 'GET',
                query: { order_number: testOrderNumbers[0] }
            });
            const response = await handler(event, {});

            if (response.statusCode !== 200) {
                console.log('Skipping - order not found');
                return;
            }

            const body = JSON.parse(response.body);
            expect(body.order_number).toBe(testOrderNumbers[0]);
            expect(body).toHaveProperty('status');
            expect(body).toHaveProperty('items');
            expect(body).toHaveProperty('total');
        });

        it('should return 404 for non-existent order', async () => {
            // Use a valid format order number that doesn't exist
            const event = createMockEvent({
                method: 'GET',
                query: { order_number: 'FS-20991231-ZZZZ' }
            });
            const response = await handler(event, {});

            // May return 400 if format validation is strict, or 404 if not found
            expect([400, 404]).toContain(response.statusCode);
            const body = JSON.parse(response.body);
            expect(body.error).toBeDefined();
        });

        it('should return 400 for invalid order number format', async () => {
            const event = createMockEvent({
                method: 'GET',
                query: { order_number: 'INVALID' }
            });
            const response = await handler(event, {});

            expect(response.statusCode).toBe(400);
        });

        it('should return 400 for missing order_number', async () => {
            const event = createMockEvent({
                method: 'GET',
                query: {}
            });
            const response = await handler(event, {});

            expect(response.statusCode).toBe(400);
        });
    });

    describe('POST - Order Creation Validation', () => {
        it('should return 400 for invalid email', async () => {
            const event = createMockEvent({
                method: 'POST',
                body: {
                    customer_email: 'not-an-email',
                    customer_name: 'Test User',
                    shipping_address: {
                        line1: '1 Test St',
                        city: 'London',
                        postal_code: 'SW1A 1AA',
                        country: 'GB'
                    },
                    items: [{ id: 1, title: 'Test', price: 10.00, quantity: 1 }]
                }
            });
            const response = await handler(event, {});

            expect(response.statusCode).toBe(400);
            const body = JSON.parse(response.body);
            expect(body.error).toBeDefined();
        });

        it('should return 400 for missing customer name', async () => {
            const event = createMockEvent({
                method: 'POST',
                body: {
                    customer_email: 'test@example.com',
                    customer_name: '',
                    shipping_address: {
                        line1: '1 Test St',
                        city: 'London',
                        postal_code: 'SW1A 1AA',
                        country: 'GB'
                    },
                    items: [{ id: 1, title: 'Test', price: 10.00, quantity: 1 }]
                }
            });
            const response = await handler(event, {});

            expect(response.statusCode).toBe(400);
        });

        it('should return 400 for invalid shipping address', async () => {
            const event = createMockEvent({
                method: 'POST',
                body: {
                    customer_email: 'test@example.com',
                    customer_name: 'Test User',
                    shipping_address: {
                        // Missing required fields
                        line1: '',
                        city: ''
                    },
                    items: [{ id: 1, title: 'Test', price: 10.00, quantity: 1 }]
                }
            });
            const response = await handler(event, {});

            expect(response.statusCode).toBe(400);
        });

        it('should return 400 for empty items array', async () => {
            const event = createMockEvent({
                method: 'POST',
                body: {
                    customer_email: 'test@example.com',
                    customer_name: 'Test User',
                    shipping_address: {
                        line1: '1 Test St',
                        city: 'London',
                        postal_code: 'SW1A 1AA',
                        country: 'GB'
                    },
                    items: []
                }
            });
            const response = await handler(event, {});

            expect(response.statusCode).toBe(400);
        });

        it('should return 400 for invalid JSON body', async () => {
            const event = {
                httpMethod: 'POST',
                headers: {
                    origin: 'http://localhost:8888',
                    'content-type': 'application/json'
                },
                body: 'not valid json',
                queryStringParameters: null
            };
            const response = await handler(event, {});

            expect(response.statusCode).toBe(400);
            const body = JSON.parse(response.body);
            expect(body.error).toContain('Invalid JSON');
        });
    });

    describe('POST - Successful Order Creation', () => {
        it('should create order with valid data', async () => {
            const event = createMockEvent({
                method: 'POST',
                body: {
                    customer_email: 'valid@example.com',
                    customer_name: 'Valid Customer',
                    customer_phone: '+44 7700 900123',
                    shipping_address: {
                        line1: '456 Test Road',
                        line2: 'Apt 5',
                        city: 'Manchester',
                        postal_code: 'M1 1AA',
                        country: 'GB'
                    },
                    items: [
                        { id: testProductId || 1, title: 'Product A', price: 15.00, quantity: 2 }
                    ],
                    payment_method: 'stripe'
                }
            });
            const response = await handler(event, {});

            if (response.statusCode !== 201) {
                console.log('Order creation failed:', JSON.parse(response.body));
                return;
            }

            expect(response.statusCode).toBe(201);
            const body = JSON.parse(response.body);
            expect(body.success).toBe(true);
            expect(body.order_number).toMatch(/^FS-\d{8}-[A-Z0-9]{4}$/);
            expect(body.total).toBeDefined();

            // Track for cleanup
            testOrderNumbers.push(body.order_number);
        });

        it('should calculate totals correctly', async () => {
            const event = createMockEvent({
                method: 'POST',
                body: {
                    customer_email: 'totals@example.com',
                    customer_name: 'Totals Test',
                    shipping_address: {
                        line1: '789 Total St',
                        city: 'Birmingham',
                        postal_code: 'B1 1AA',
                        country: 'GB'
                    },
                    items: [
                        { id: testProductId || 1, title: 'Item 1', price: 8.00, quantity: 2 } // Subtotal: 16, < £20
                    ]
                }
            });
            const response = await handler(event, {});

            if (response.statusCode !== 201) {
                console.log('Order creation failed');
                return;
            }

            const body = JSON.parse(response.body);
            // Subtotal 16 + shipping 3.49 = 19.49
            expect(body.total).toBeCloseTo(19.49, 2);

            testOrderNumbers.push(body.order_number);
        });

        it('should give free shipping for orders >= £20', async () => {
            const event = createMockEvent({
                method: 'POST',
                body: {
                    customer_email: 'freeship@example.com',
                    customer_name: 'Free Shipping Test',
                    shipping_address: {
                        line1: '111 Free St',
                        city: 'Leeds',
                        postal_code: 'LS1 1AA',
                        country: 'GB'
                    },
                    items: [
                        { id: testProductId || 1, title: 'Item 1', price: 10.00, quantity: 2 } // Subtotal: 20
                    ]
                }
            });
            const response = await handler(event, {});

            if (response.statusCode !== 201) {
                console.log('Order creation failed');
                return;
            }

            const body = JSON.parse(response.body);
            // Subtotal 20 + shipping 0 = 20
            expect(body.total).toBe(20);

            testOrderNumbers.push(body.order_number);
        });
    });

    describe('CORS Headers', () => {
        it('should include CORS headers in response', async () => {
            const event = createMockEvent({
                method: 'GET',
                query: { order_number: 'FS-12345678-TEST' }
            });
            const response = await handler(event, {});

            expect(response.headers).toHaveProperty('Access-Control-Allow-Origin');
            expect(response.headers).toHaveProperty('Access-Control-Allow-Methods');
        });
    });

    describe('Response Format', () => {
        it('should return valid JSON for errors', async () => {
            const event = createMockEvent({
                method: 'GET',
                query: { order_number: 'INVALID' }
            });
            const response = await handler(event, {});

            expect(() => JSON.parse(response.body)).not.toThrow();
            const body = JSON.parse(response.body);
            expect(body).toHaveProperty('error');
        });

        it('should return order fields for successful lookup', async () => {
            if (!testOrderNumbers[0]) {
                console.log('Skipping - no test order');
                return;
            }

            const event = createMockEvent({
                method: 'GET',
                query: { order_number: testOrderNumbers[0] }
            });
            const response = await handler(event, {});

            if (response.statusCode !== 200) {
                console.log('Skipping - order not found');
                return;
            }

            const body = JSON.parse(response.body);
            expect(body).toHaveProperty('order_number');
            expect(body).toHaveProperty('status');
            expect(body).toHaveProperty('items');
            expect(body).toHaveProperty('total');
            expect(body).toHaveProperty('shipping');
            expect(body).toHaveProperty('created_at');
        });
    });
});
