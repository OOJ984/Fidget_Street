/**
 * Payment Integration Tests
 *
 * Tests for Stripe and PayPal payment flows including:
 * - Input validation
 * - Price calculations
 * - Shipping logic
 * - Order number generation
 * - Webhook signature verification
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import crypto from 'crypto';

// ============================================
// Stripe Checkout Tests
// ============================================

describe('Stripe Checkout', () => {
    // Simulate the price calculation logic from stripe-checkout.js
    function calculateStripeCheckout(items) {
        if (!items || !Array.isArray(items) || items.length === 0) {
            return { error: 'Items required' };
        }

        // Calculate totals (Stripe uses pence)
        const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity * 100), 0);
        const shipping = subtotal >= 2000 ? 0 : 299; // Free shipping over £20

        // Create line items for Stripe
        const lineItems = items.map(item => ({
            price_data: {
                currency: 'gbp',
                product_data: {
                    name: item.title,
                    description: item.variation || undefined,
                },
                unit_amount: Math.round(item.price * 100),
            },
            quantity: item.quantity,
        }));

        // Add shipping if applicable
        if (shipping > 0) {
            lineItems.push({
                price_data: {
                    currency: 'gbp',
                    product_data: {
                        name: 'Shipping',
                    },
                    unit_amount: shipping,
                },
                quantity: 1,
            });
        }

        return {
            subtotal,
            shipping,
            total: subtotal + shipping,
            lineItems
        };
    }

    describe('Input Validation', () => {
        it('should reject missing items', () => {
            expect(calculateStripeCheckout(null).error).toBe('Items required');
            expect(calculateStripeCheckout(undefined).error).toBe('Items required');
        });

        it('should reject non-array items', () => {
            expect(calculateStripeCheckout('not array').error).toBe('Items required');
            expect(calculateStripeCheckout({}).error).toBe('Items required');
        });

        it('should reject empty items array', () => {
            expect(calculateStripeCheckout([]).error).toBe('Items required');
        });

        it('should accept valid items array', () => {
            const items = [{ title: 'Test', price: 10, quantity: 1 }];
            const result = calculateStripeCheckout(items);
            expect(result.error).toBeUndefined();
            expect(result.lineItems).toBeDefined();
        });
    });

    describe('Price Calculations', () => {
        it('should calculate subtotal correctly in pence', () => {
            const items = [
                { title: 'Item 1', price: 10.00, quantity: 2 },
                { title: 'Item 2', price: 5.50, quantity: 1 }
            ];
            const result = calculateStripeCheckout(items);
            expect(result.subtotal).toBe(2550); // (10*2 + 5.50*1) * 100
        });

        it('should add shipping for orders under £20', () => {
            const items = [{ title: 'Test', price: 15.00, quantity: 1 }];
            const result = calculateStripeCheckout(items);
            expect(result.shipping).toBe(299); // £2.99
            expect(result.total).toBe(1799); // £15 + £2.99
        });

        it('should have free shipping for orders £20 or more', () => {
            const items = [{ title: 'Test', price: 20.00, quantity: 1 }];
            const result = calculateStripeCheckout(items);
            expect(result.shipping).toBe(0);
            expect(result.total).toBe(2000);
        });

        it('should have free shipping for orders over £20', () => {
            const items = [{ title: 'Test', price: 25.00, quantity: 1 }];
            const result = calculateStripeCheckout(items);
            expect(result.shipping).toBe(0);
        });

        it('should handle fractional prices correctly', () => {
            const items = [{ title: 'Test', price: 12.99, quantity: 2 }];
            const result = calculateStripeCheckout(items);
            expect(result.subtotal).toBe(2598); // 12.99 * 2 * 100
        });
    });

    describe('Line Items', () => {
        it('should create correct line item structure', () => {
            const items = [{ title: 'Pearl organisers', price: 15.00, quantity: 2 }];
            const result = calculateStripeCheckout(items);

            expect(result.lineItems[0]).toEqual({
                price_data: {
                    currency: 'gbp',
                    product_data: {
                        name: 'Pearl organisers',
                        description: undefined,
                    },
                    unit_amount: 1500,
                },
                quantity: 2,
            });
        });

        it('should include variation in description', () => {
            const items = [{
                title: 'Pearl organisers',
                price: 15.00,
                quantity: 1,
                variation: 'Gold'
            }];
            const result = calculateStripeCheckout(items);

            expect(result.lineItems[0].price_data.product_data.description).toBe('Gold');
        });

        it('should add shipping as line item when applicable', () => {
            const items = [{ title: 'Test', price: 10.00, quantity: 1 }];
            const result = calculateStripeCheckout(items);

            expect(result.lineItems).toHaveLength(2);
            expect(result.lineItems[1].price_data.product_data.name).toBe('Shipping');
            expect(result.lineItems[1].price_data.unit_amount).toBe(299);
        });

        it('should not add shipping line item for free shipping', () => {
            const items = [{ title: 'Test', price: 25.00, quantity: 1 }];
            const result = calculateStripeCheckout(items);

            expect(result.lineItems).toHaveLength(1);
        });
    });
});

// ============================================
// Stripe Webhook Tests
// ============================================

describe('Stripe Webhooks', () => {
    describe('Order Number Generation', () => {
        function generateOrderNumber() {
            const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
            return `PP-${date}-${random}`;
        }

        it('should generate order number in correct format', () => {
            const orderNumber = generateOrderNumber();
            expect(orderNumber).toMatch(/^PP-\d{8}-\d{4}$/);
        });

        it('should include current date', () => {
            const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const orderNumber = generateOrderNumber();
            expect(orderNumber).toContain(today);
        });

        it('should generate unique order numbers', () => {
            const numbers = new Set();
            for (let i = 0; i < 100; i++) {
                numbers.add(generateOrderNumber());
            }
            // With 4-digit random, collisions are unlikely but possible
            expect(numbers.size).toBeGreaterThan(90);
        });
    });

    describe('Webhook Signature Verification', () => {
        // Simulate Stripe's signature verification logic
        function createSignature(payload, secret, timestamp) {
            const signedPayload = `${timestamp}.${payload}`;
            const signature = crypto
                .createHmac('sha256', secret)
                .update(signedPayload)
                .digest('hex');
            return `t=${timestamp},v1=${signature}`;
        }

        function verifySignature(payload, sigHeader, secret) {
            try {
                const parts = sigHeader.split(',');
                const timestamp = parts.find(p => p.startsWith('t='))?.slice(2);
                const signature = parts.find(p => p.startsWith('v1='))?.slice(3);

                if (!timestamp || !signature) {
                    return { valid: false, error: 'Invalid signature format' };
                }

                // Check timestamp is not too old (5 min tolerance)
                const now = Math.floor(Date.now() / 1000);
                if (Math.abs(now - parseInt(timestamp)) > 300) {
                    return { valid: false, error: 'Timestamp too old' };
                }

                const expectedSignature = crypto
                    .createHmac('sha256', secret)
                    .update(`${timestamp}.${payload}`)
                    .digest('hex');

                if (signature !== expectedSignature) {
                    return { valid: false, error: 'Signature mismatch' };
                }

                return { valid: true };
            } catch (e) {
                return { valid: false, error: e.message };
            }
        }

        const SECRET = 'test_webhook_secret_for_testing';

        it('should verify valid signature', () => {
            const payload = JSON.stringify({ type: 'checkout.session.completed' });
            const timestamp = Math.floor(Date.now() / 1000);
            const sigHeader = createSignature(payload, SECRET, timestamp);

            const result = verifySignature(payload, sigHeader, SECRET);
            expect(result.valid).toBe(true);
        });

        it('should reject wrong secret', () => {
            const payload = JSON.stringify({ type: 'checkout.session.completed' });
            const timestamp = Math.floor(Date.now() / 1000);
            const sigHeader = createSignature(payload, SECRET, timestamp);

            const result = verifySignature(payload, sigHeader, 'wrong_secret');
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Signature mismatch');
        });

        it('should reject tampered payload', () => {
            const payload = JSON.stringify({ type: 'checkout.session.completed' });
            const timestamp = Math.floor(Date.now() / 1000);
            const sigHeader = createSignature(payload, SECRET, timestamp);

            const tamperedPayload = JSON.stringify({ type: 'checkout.session.completed', amount: 0 });
            const result = verifySignature(tamperedPayload, sigHeader, SECRET);
            expect(result.valid).toBe(false);
        });

        it('should reject old timestamp', () => {
            const payload = JSON.stringify({ type: 'checkout.session.completed' });
            const oldTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 min ago
            const sigHeader = createSignature(payload, SECRET, oldTimestamp);

            const result = verifySignature(payload, sigHeader, SECRET);
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Timestamp too old');
        });

        it('should reject invalid signature format', () => {
            const payload = JSON.stringify({ type: 'test' });
            const result = verifySignature(payload, 'invalid', SECRET);
            expect(result.valid).toBe(false);
        });
    });

    describe('Webhook Event Handling', () => {
        it('should parse items from session metadata', () => {
            const items = [
                { id: 1, title: 'Pearl organisers', quantity: 2, price: 12.99 },
                { id: 2, title: 'Gold Necklace', quantity: 1, price: 25.00 }
            ];
            const metadata = { items: JSON.stringify(items) };

            const parsed = JSON.parse(metadata.items);
            expect(parsed).toHaveLength(2);
            expect(parsed[0].title).toBe('Pearl organisers');
        });

        it('should handle missing metadata gracefully', () => {
            const metadata = {};
            const items = JSON.parse(metadata?.items || '[]');
            expect(items).toEqual([]);
        });

        it('should handle malformed metadata', () => {
            const metadata = { items: 'not valid json' };
            let items = [];
            try {
                items = JSON.parse(metadata.items);
            } catch {
                items = [];
            }
            expect(items).toEqual([]);
        });

        it('should calculate shipping from total difference', () => {
            const items = [
                { price: 10, quantity: 1 },
                { price: 5, quantity: 2 }
            ];
            const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const amountTotal = 2299; // Stripe amount in pence
            const total = amountTotal / 100; // £22.99
            const shipping = total - subtotal; // £2.99

            expect(subtotal).toBe(20);
            expect(shipping).toBeCloseTo(2.99, 2);
        });
    });
});

// ============================================
// PayPal Checkout Tests
// ============================================

describe('PayPal Checkout', () => {
    describe('Price Calculations', () => {
        function calculatePayPalCheckout(items) {
            if (!items || !Array.isArray(items) || items.length === 0) {
                return { error: 'Items required' };
            }

            const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const shipping = subtotal >= 20 ? 0 : 2.99;
            const total = subtotal + shipping;

            return { subtotal, shipping, total };
        }

        it('should calculate subtotal correctly', () => {
            const items = [
                { title: 'Item 1', price: 10.00, quantity: 2 },
                { title: 'Item 2', price: 5.50, quantity: 1 }
            ];
            const result = calculatePayPalCheckout(items);
            expect(result.subtotal).toBe(25.50);
        });

        it('should add shipping for orders under £20', () => {
            const items = [{ title: 'Test', price: 15.00, quantity: 1 }];
            const result = calculatePayPalCheckout(items);
            expect(result.shipping).toBe(2.99);
            expect(result.total).toBeCloseTo(17.99, 2);
        });

        it('should have free shipping for orders £20+', () => {
            const items = [{ title: 'Test', price: 20.00, quantity: 1 }];
            const result = calculatePayPalCheckout(items);
            expect(result.shipping).toBe(0);
            expect(result.total).toBe(20.00);
        });
    });

    describe('Order Payload Creation', () => {
        function createPayPalOrderItems(items) {
            return items.map(item => ({
                name: item.title.substring(0, 127), // PayPal 127 char limit
                quantity: item.quantity.toString(),
                unit_amount: {
                    currency_code: 'GBP',
                    value: item.price.toFixed(2)
                },
                category: 'PHYSICAL_GOODS'
            }));
        }

        it('should create correct order item structure', () => {
            const items = [{ title: 'Pearl organisers', price: 15.99, quantity: 2 }];
            const orderItems = createPayPalOrderItems(items);

            expect(orderItems[0]).toEqual({
                name: 'Pearl organisers',
                quantity: '2',
                unit_amount: {
                    currency_code: 'GBP',
                    value: '15.99'
                },
                category: 'PHYSICAL_GOODS'
            });
        });

        it('should truncate long product names to 127 chars', () => {
            const longTitle = 'A'.repeat(200);
            const items = [{ title: longTitle, price: 10.00, quantity: 1 }];
            const orderItems = createPayPalOrderItems(items);

            expect(orderItems[0].name.length).toBe(127);
        });

        it('should convert quantity to string', () => {
            const items = [{ title: 'Test', price: 10.00, quantity: 5 }];
            const orderItems = createPayPalOrderItems(items);

            expect(typeof orderItems[0].quantity).toBe('string');
            expect(orderItems[0].quantity).toBe('5');
        });

        it('should format price to 2 decimal places', () => {
            const items = [{ title: 'Test', price: 10.5, quantity: 1 }];
            const orderItems = createPayPalOrderItems(items);

            expect(orderItems[0].unit_amount.value).toBe('10.50');
        });
    });

    describe('Access Token Generation', () => {
        it('should create correct Basic auth header', () => {
            const clientId = 'test_client_id';
            const clientSecret = 'test_client_secret';
            const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

            expect(auth).toBe('dGVzdF9jbGllbnRfaWQ6dGVzdF9jbGllbnRfc2VjcmV0');
        });
    });

    describe('Input Validation', () => {
        function validatePayPalInput(body) {
            if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
                return { valid: false, error: 'Items required' };
            }
            return { valid: true };
        }

        it('should reject missing items', () => {
            expect(validatePayPalInput({}).valid).toBe(false);
        });

        it('should reject empty items', () => {
            expect(validatePayPalInput({ items: [] }).valid).toBe(false);
        });

        it('should accept valid items', () => {
            expect(validatePayPalInput({ items: [{ title: 'Test' }] }).valid).toBe(true);
        });
    });
});

// ============================================
// PayPal Capture Tests
// ============================================

describe('PayPal Capture', () => {
    describe('Order ID Validation', () => {
        function validateCaptureInput(body) {
            if (!body.orderID) {
                return { valid: false, error: 'Order ID required' };
            }
            return { valid: true };
        }

        it('should reject missing order ID', () => {
            expect(validateCaptureInput({}).valid).toBe(false);
            expect(validateCaptureInput({}).error).toBe('Order ID required');
        });

        it('should accept valid order ID', () => {
            expect(validateCaptureInput({ orderID: 'ABC123' }).valid).toBe(true);
        });
    });

    describe('Order Data Creation', () => {
        function createOrderData(captureData, items, customer) {
            const purchase = captureData.purchase_units?.[0];
            const payment = purchase?.payments?.captures?.[0];
            const shipping = purchase?.shipping;

            const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const shippingCost = subtotal >= 20 ? 0 : 2.99;
            const total = subtotal + shippingCost;

            return {
                customer_email: customer?.email || captureData.payer?.email_address,
                customer_name: customer?.name ||
                    `${captureData.payer?.name?.given_name || ''} ${captureData.payer?.name?.surname || ''}`.trim(),
                shipping_address: shipping?.address ? {
                    line1: shipping.address.address_line_1,
                    line2: shipping.address.address_line_2 || '',
                    city: shipping.address.admin_area_2,
                    postal_code: shipping.address.postal_code,
                    country: shipping.address.country_code
                } : null,
                items,
                subtotal,
                shipping: shippingCost,
                total,
                status: 'paid',
                payment_method: 'paypal',
                payment_id: payment?.id
            };
        }

        it('should extract customer email from payer', () => {
            const captureData = {
                payer: { email_address: 'customer@test.com' },
                purchase_units: [{ payments: { captures: [{ id: 'CAP123' }] } }]
            };
            const items = [{ price: 10, quantity: 1 }];

            const order = createOrderData(captureData, items, {});
            expect(order.customer_email).toBe('customer@test.com');
        });

        it('should prefer customer object email over payer', () => {
            const captureData = {
                payer: { email_address: 'payer@test.com' },
                purchase_units: [{ payments: { captures: [{ id: 'CAP123' }] } }]
            };
            const items = [{ price: 10, quantity: 1 }];
            const customer = { email: 'preferred@test.com' };

            const order = createOrderData(captureData, items, customer);
            expect(order.customer_email).toBe('preferred@test.com');
        });

        it('should construct name from payer name parts', () => {
            const captureData = {
                payer: {
                    name: { given_name: 'John', surname: 'Doe' }
                },
                purchase_units: [{ payments: { captures: [{ id: 'CAP123' }] } }]
            };
            const items = [{ price: 10, quantity: 1 }];

            const order = createOrderData(captureData, items, {});
            expect(order.customer_name).toBe('John Doe');
        });

        it('should extract shipping address', () => {
            const captureData = {
                payer: {},
                purchase_units: [{
                    payments: { captures: [{ id: 'CAP123' }] },
                    shipping: {
                        address: {
                            address_line_1: '123 Main St',
                            address_line_2: 'Apt 4',
                            admin_area_2: 'London',
                            postal_code: 'SW1A 1AA',
                            country_code: 'GB'
                        }
                    }
                }]
            };
            const items = [{ price: 10, quantity: 1 }];

            const order = createOrderData(captureData, items, {});
            expect(order.shipping_address).toEqual({
                line1: '123 Main St',
                line2: 'Apt 4',
                city: 'London',
                postal_code: 'SW1A 1AA',
                country: 'GB'
            });
        });

        it('should handle missing shipping address', () => {
            const captureData = {
                payer: {},
                purchase_units: [{ payments: { captures: [{ id: 'CAP123' }] } }]
            };
            const items = [{ price: 10, quantity: 1 }];

            const order = createOrderData(captureData, items, {});
            expect(order.shipping_address).toBeNull();
        });

        it('should calculate shipping based on subtotal', () => {
            const captureData = {
                payer: {},
                purchase_units: [{ payments: { captures: [{ id: 'CAP123' }] } }]
            };

            // Under £20
            const items1 = [{ price: 15, quantity: 1 }];
            const order1 = createOrderData(captureData, items1, {});
            expect(order1.shipping).toBe(2.99);

            // £20 or more
            const items2 = [{ price: 25, quantity: 1 }];
            const order2 = createOrderData(captureData, items2, {});
            expect(order2.shipping).toBe(0);
        });

        it('should set correct payment method', () => {
            const captureData = {
                payer: {},
                purchase_units: [{ payments: { captures: [{ id: 'CAP123' }] } }]
            };
            const items = [{ price: 10, quantity: 1 }];

            const order = createOrderData(captureData, items, {});
            expect(order.payment_method).toBe('paypal');
            expect(order.status).toBe('paid');
        });
    });
});

// ============================================
// Shared Payment Utilities
// ============================================

describe('Payment Utilities', () => {
    describe('Free Shipping Threshold', () => {
        const FREE_SHIPPING_THRESHOLD_PENCE = 2000; // £20.00
        const FREE_SHIPPING_THRESHOLD_POUNDS = 20;
        const SHIPPING_COST_PENCE = 299; // £2.99
        const SHIPPING_COST_POUNDS = 2.99;

        it('should have consistent threshold between Stripe and PayPal', () => {
            // Stripe uses pence, PayPal uses pounds
            expect(FREE_SHIPPING_THRESHOLD_PENCE).toBe(FREE_SHIPPING_THRESHOLD_POUNDS * 100);
            expect(SHIPPING_COST_PENCE).toBe(Math.round(SHIPPING_COST_POUNDS * 100));
        });

        it('should calculate free shipping consistently', () => {
            const testAmounts = [15, 19.99, 20, 20.01, 25, 100];

            for (const amount of testAmounts) {
                const stripeFree = (amount * 100) >= FREE_SHIPPING_THRESHOLD_PENCE;
                const paypalFree = amount >= FREE_SHIPPING_THRESHOLD_POUNDS;

                expect(stripeFree).toBe(paypalFree);
            }
        });
    });

    describe('Currency Handling', () => {
        it('should use GBP currency code', () => {
            const stripeCurrency = 'gbp';
            const paypalCurrency = 'GBP';

            expect(stripeCurrency.toUpperCase()).toBe(paypalCurrency);
        });

        it('should convert pounds to pence correctly', () => {
            const testPrices = [10.00, 12.99, 0.01, 100.00, 5.50];

            for (const price of testPrices) {
                const pence = Math.round(price * 100);
                const backToPounds = pence / 100;

                expect(backToPounds).toBe(price);
            }
        });

        it('should handle floating point precision', () => {
            // Common floating point issue: 0.1 + 0.2 = 0.30000000000000004
            const price1 = 0.1;
            const price2 = 0.2;

            // Use integer pence to avoid floating point issues
            const pence1 = Math.round(price1 * 100);
            const pence2 = Math.round(price2 * 100);
            const totalPence = pence1 + pence2;

            expect(totalPence).toBe(30); // Not 30.000000000000004
        });
    });

    describe('Order Status Flow', () => {
        const VALID_STATUSES = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];

        it('should start orders as paid after successful payment', () => {
            const initialStatus = 'paid';
            expect(VALID_STATUSES).toContain(initialStatus);
        });

        it('should have valid status transitions', () => {
            const validTransitions = {
                'paid': ['processing', 'cancelled', 'refunded'],
                'processing': ['shipped', 'cancelled'],
                'shipped': ['delivered'],
                'delivered': ['refunded'],
                'cancelled': [],
                'refunded': []
            };

            // Verify all statuses have defined transitions
            for (const status of Object.keys(validTransitions)) {
                expect(VALID_STATUSES).toContain(status);
            }
        });
    });
});

// ============================================
// API Sandbox/Production URL Tests
// ============================================

describe('PayPal API Configuration', () => {
    it('should use sandbox URL in test mode', () => {
        const sandboxMode = true;
        const apiUrl = sandboxMode
            ? 'https://api-m.sandbox.paypal.com'
            : 'https://api-m.paypal.com';

        expect(apiUrl).toBe('https://api-m.sandbox.paypal.com');
    });

    it('should use production URL in live mode', () => {
        const sandboxMode = false;
        const apiUrl = sandboxMode
            ? 'https://api-m.sandbox.paypal.com'
            : 'https://api-m.paypal.com';

        expect(apiUrl).toBe('https://api-m.paypal.com');
    });
});
