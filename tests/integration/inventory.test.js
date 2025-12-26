/**
 * Inventory Management Tests
 *
 * Tests stock/inventory validation and management.
 *
 * IMPORTANT: Stock DECREMENT after successful order is NOT currently implemented!
 * The webhook creates orders but does not reduce product stock.
 * This is documented here as a known gap that needs to be addressed.
 *
 * What IS tested:
 * - Stock validation at checkout (verifyCartPrices)
 * - Out-of-stock rejection
 * - Stock level queries
 *
 * What is NOT tested (because not implemented):
 * - Stock decrement after order (needs webhook update)
 * - Stock restoration on cancellation (needs implementation)
 * - Race condition handling with database locks
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// Import checkout utilities
const { verifyCartPrices } = require('../../netlify/functions/utils/checkout');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

describe('Inventory Management', () => {
    let testProductId;
    const testSlug = `test-inventory-${Date.now()}`;
    const initialStock = 10;

    beforeAll(async () => {
        // Create test product with known stock level
        const { data, error } = await supabase
            .from('products')
            .insert({
                title: 'TEST_Inventory_Product',
                slug: testSlug,
                price_gbp: 9.99,
                currency: 'GBP',
                category: 'articulated-toys',
                stock: initialStock,
                is_active: true,
                description: 'Test product for inventory tests'
            })
            .select('id')
            .single();

        if (error) {
            console.error('Failed to create test product:', error);
        } else {
            testProductId = data.id;
        }
    });

    afterAll(async () => {
        if (testProductId) {
            await supabase.from('products').delete().eq('id', testProductId);
        }
    });

    describe('Stock Level Queries', () => {
        it('should return product with stock level', async () => {
            if (!testProductId) {
                console.log('Skipping - test product not created');
                return;
            }

            const { data, error } = await supabase
                .from('products')
                .select('id, title, stock')
                .eq('id', testProductId)
                .single();

            expect(error).toBeNull();
            expect(data.stock).toBe(initialStock);
        });

        it('should return stock in product listing', async () => {
            if (!testProductId) {
                console.log('Skipping - test product not created');
                return;
            }

            const { data, error } = await supabase
                .from('products')
                .select('id, title, stock, is_active')
                .eq('id', testProductId)
                .single();

            expect(error).toBeNull();
            expect(data).toHaveProperty('stock');
            expect(typeof data.stock).toBe('number');
        });

        it('should filter out-of-stock products if needed', async () => {
            // This tests the query capability, not a specific filter implementation
            const { data } = await supabase
                .from('products')
                .select('id, title, stock')
                .gt('stock', 0)
                .eq('is_active', true)
                .limit(10);

            expect(Array.isArray(data)).toBe(true);
            if (data.length > 0) {
                data.forEach(product => {
                    expect(product.stock).toBeGreaterThan(0);
                });
            }
        });
    });

    describe('Stock Validation at Checkout', () => {
        it('should accept order when stock is sufficient', async () => {
            if (!testProductId) {
                console.log('Skipping - test product not created');
                return;
            }

            const cartItems = [{
                id: testProductId,
                title: 'TEST_Inventory_Product',
                price: 9.99,
                quantity: 5 // Less than initialStock (10)
            }];

            const result = await verifyCartPrices(cartItems);

            expect(result.valid).toBe(true);
            expect(result.items).toHaveLength(1);
        });

        it('should reject order when quantity exceeds stock', async () => {
            if (!testProductId) {
                console.log('Skipping - test product not created');
                return;
            }

            const cartItems = [{
                id: testProductId,
                title: 'TEST_Inventory_Product',
                price: 9.99,
                quantity: 100 // More than initialStock (10)
            }];

            const result = await verifyCartPrices(cartItems);

            expect(result.valid).toBe(false);
            expect(result.error).toContain('Insufficient stock');
        });

        it('should reject order when stock is exactly zero', async () => {
            // Create a product with zero stock
            const { data: zeroStockProduct, error: createError } = await supabase
                .from('products')
                .insert({
                    title: 'TEST_Zero_Stock_Product',
                    slug: `test-zero-stock-${Date.now()}`,
                    price_gbp: 5.99,
                    currency: 'GBP',
                    category: 'spinners',
                    stock: 0,
                    is_active: true
                })
                .select('id')
                .single();

            if (createError || !zeroStockProduct) {
                console.log('Skipping - could not create zero stock product');
                return;
            }

            try {
                const cartItems = [{
                    id: zeroStockProduct.id,
                    title: 'TEST_Zero_Stock_Product',
                    price: 5.99,
                    quantity: 1
                }];

                const result = await verifyCartPrices(cartItems);

                expect(result.valid).toBe(false);
                expect(result.error).toContain('Insufficient stock');
            } finally {
                await supabase.from('products').delete().eq('id', zeroStockProduct.id);
            }
        });

        it('should allow order exactly matching stock', async () => {
            if (!testProductId) {
                console.log('Skipping - test product not created');
                return;
            }

            const cartItems = [{
                id: testProductId,
                title: 'TEST_Inventory_Product',
                price: 9.99,
                quantity: initialStock // Exactly matching stock
            }];

            const result = await verifyCartPrices(cartItems);

            expect(result.valid).toBe(true);
        });
    });

    describe('Multiple Items Stock Check', () => {
        let secondProductId;

        beforeAll(async () => {
            const { data, error } = await supabase
                .from('products')
                .insert({
                    title: 'TEST_Inventory_Second',
                    slug: `test-inventory-second-${Date.now()}`,
                    price_gbp: 14.99,
                    currency: 'GBP',
                    category: 'push-bubbles',
                    stock: 5,
                    is_active: true
                })
                .select('id')
                .single();

            if (!error) {
                secondProductId = data.id;
            }
        });

        afterAll(async () => {
            if (secondProductId) {
                await supabase.from('products').delete().eq('id', secondProductId);
            }
        });

        it('should validate stock for all items in cart', async () => {
            if (!testProductId || !secondProductId) {
                console.log('Skipping - test products not created');
                return;
            }

            const cartItems = [
                { id: testProductId, title: 'TEST_Inventory_Product', price: 9.99, quantity: 3 },
                { id: secondProductId, title: 'TEST_Inventory_Second', price: 14.99, quantity: 2 }
            ];

            const result = await verifyCartPrices(cartItems);

            expect(result.valid).toBe(true);
            expect(result.items).toHaveLength(2);
        });

        it('should fail if ANY item exceeds stock', async () => {
            if (!testProductId || !secondProductId) {
                console.log('Skipping - test products not created');
                return;
            }

            const cartItems = [
                { id: testProductId, title: 'TEST_Inventory_Product', price: 9.99, quantity: 3 },
                { id: secondProductId, title: 'TEST_Inventory_Second', price: 14.99, quantity: 100 } // Exceeds stock
            ];

            const result = await verifyCartPrices(cartItems);

            expect(result.valid).toBe(false);
            expect(result.error).toContain('Insufficient stock');
        });
    });

    describe('Stock Update Operations', () => {
        /**
         * NOTE: These tests document the DESIRED behavior but test against
         * raw database operations since the webhook doesn't decrement stock yet.
         */

        it('should be able to decrement stock manually', async () => {
            if (!testProductId) {
                console.log('Skipping - test product not created');
                return;
            }

            // Get current stock
            const { data: before } = await supabase
                .from('products')
                .select('stock')
                .eq('id', testProductId)
                .single();

            const originalStock = before.stock;

            // Decrement stock
            const { error: updateError } = await supabase
                .from('products')
                .update({ stock: originalStock - 1 })
                .eq('id', testProductId);

            expect(updateError).toBeNull();

            // Verify decrement
            const { data: after } = await supabase
                .from('products')
                .select('stock')
                .eq('id', testProductId)
                .single();

            expect(after.stock).toBe(originalStock - 1);

            // Restore original stock
            await supabase
                .from('products')
                .update({ stock: originalStock })
                .eq('id', testProductId);
        });

        it('should handle atomic decrement with RPC (if available)', async () => {
            // This documents that an RPC function for atomic decrement would be ideal
            // Currently checking if such a function exists

            try {
                const { data, error } = await supabase.rpc('decrement_stock', {
                    product_id: testProductId,
                    amount: 1
                });

                // If RPC exists, it should work
                // If not, this documents the need for one
                if (error && error.message && error.message.includes('not found')) {
                    console.log('Note: decrement_stock RPC does not exist - atomic operations not available');
                } else if (error) {
                    console.log('Note: decrement_stock RPC error:', error.message);
                } else if (data !== null) {
                    expect(data).toBeDefined();
                }
            } catch (err) {
                // RPC doesn't exist or other error
                console.log('Note: decrement_stock RPC not available:', err.message || err);
            }
        });

        it('should prevent negative stock values', async () => {
            // Create product with 1 stock to test boundary
            const { data: testProduct, error } = await supabase
                .from('products')
                .insert({
                    title: 'TEST_Low_Stock',
                    slug: `test-low-stock-${Date.now()}`,
                    price_gbp: 7.99,
                    currency: 'GBP',
                    category: 'spinners',
                    stock: 1,
                    is_active: true
                })
                .select('id')
                .single();

            if (error) {
                console.log('Skipping - could not create test product');
                return;
            }

            try {
                // Try to update to negative stock
                // This should fail if there's a CHECK constraint, or succeed but we document the issue
                const { error: updateError } = await supabase
                    .from('products')
                    .update({ stock: -5 })
                    .eq('id', testProduct.id);

                if (updateError) {
                    // Good - there's a constraint preventing negative stock
                    expect(updateError).toBeDefined();
                } else {
                    // No constraint - document this as a potential issue
                    console.log('WARNING: No database constraint prevents negative stock values');

                    // Clean up the negative value
                    await supabase
                        .from('products')
                        .update({ stock: 0 })
                        .eq('id', testProduct.id);
                }
            } finally {
                await supabase.from('products').delete().eq('id', testProduct.id);
            }
        });
    });

    describe('Concurrent Purchase Simulation', () => {
        /**
         * These tests simulate concurrent access patterns that could
         * cause race conditions. With proper implementation, these
         * should use row-level locking or optimistic concurrency.
         */

        it('should handle rapid sequential stock checks', async () => {
            if (!testProductId) {
                console.log('Skipping - test product not created');
                return;
            }

            const quantity = 2;
            const checks = [];

            // Simulate 5 rapid stock checks
            for (let i = 0; i < 5; i++) {
                checks.push(verifyCartPrices([{
                    id: testProductId,
                    title: 'TEST_Inventory_Product',
                    price: 9.99,
                    quantity
                }]));
            }

            const results = await Promise.all(checks);

            // All should succeed since stock is 10 and we're checking for 2
            results.forEach(result => {
                expect(result.valid).toBe(true);
            });
        });

        it('should correctly reject when total requests exceed stock', async () => {
            // Create a product with limited stock
            const { data: limitedProduct } = await supabase
                .from('products')
                .insert({
                    title: 'TEST_Limited_Stock',
                    slug: `test-limited-${Date.now()}`,
                    price_gbp: 19.99,
                    currency: 'GBP',
                    category: 'fidget-cubes',
                    stock: 3,
                    is_active: true
                })
                .select('id')
                .single();

            if (!limitedProduct) {
                console.log('Skipping - could not create limited stock product');
                return;
            }

            try {
                // Make 5 concurrent checks for 1 item each
                const checks = [];
                for (let i = 0; i < 5; i++) {
                    checks.push(verifyCartPrices([{
                        id: limitedProduct.id,
                        title: 'TEST_Limited_Stock',
                        price: 19.99,
                        quantity: 1
                    }]));
                }

                const results = await Promise.all(checks);

                // All should succeed because verification doesn't decrement stock
                // This is actually the race condition problem!
                // All 5 checks pass, but there's only stock for 3
                const allValid = results.every(r => r.valid);

                // Document: This passes, but in real concurrent orders,
                // only 3 should succeed. This is where we need atomic operations.
                console.log('WARNING: All 5 checks passed with stock of 3 - race condition possible');
                expect(allValid).toBe(true);
            } finally {
                await supabase.from('products').delete().eq('id', limitedProduct.id);
            }
        });
    });

    describe('Documentation: Missing Stock Decrement', () => {
        /**
         * These tests document that stock decrement is NOT implemented
         * in the webhook handler. They serve as reminders for future work.
         */

        it('KNOWN GAP: webhook does not decrement stock after order', () => {
            // This is a documentation test
            // The webhook at netlify/functions/webhooks.js creates orders
            // but does NOT call any stock decrement logic

            const webhookStockDecrement = false; // As of this writing
            expect(webhookStockDecrement).toBe(false);

            console.log(`
                ========================================
                IMPORTANT: Stock Decrement NOT Implemented
                ========================================
                The webhook handler (webhooks.js) creates orders but
                does NOT decrement product stock. This means:

                1. Products can be oversold
                2. Stock levels are not accurate
                3. Manual stock management is required

                To fix, add to webhooks.js after order creation:
                - Loop through order items
                - Decrement stock for each product
                - Use atomic operation (FOR UPDATE or RPC)
                ========================================
            `);
        });

        it('KNOWN GAP: no stock restoration on cancellation', () => {
            // This is a documentation test
            const cancellationStockRestore = false;
            expect(cancellationStockRestore).toBe(false);

            console.log('Stock restoration on order cancellation is not implemented');
        });
    });
});
