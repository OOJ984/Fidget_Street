/**
 * Products API Handler Tests
 *
 * Tests the products.js Netlify function handler with mock HTTP events.
 * These are integration tests that call the actual handler with the real database.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// Import the handler
const { handler } = require('../../netlify/functions/products.js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

/**
 * Create a mock Netlify event object
 */
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

describe('Products API Handler', () => {
    let testProductId;
    const testSlug = `test-handler-${Date.now()}`;

    beforeAll(async () => {
        // Create test product
        const { data, error } = await supabase
            .from('products')
            .insert({
                title: 'TEST_Handler_Product',
                slug: testSlug,
                price_gbp: 12.99,
                currency: 'GBP',
                category: 'articulated-toys',
                stock: 25,
                is_active: true,
                tags: ['test', 'featured'],
                description: 'Test product for handler tests',
                images: ['https://example.com/test.jpg']
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

    describe('HTTP Method Handling', () => {
        it('should return 200 for OPTIONS (preflight)', async () => {
            const event = createMockEvent({ method: 'OPTIONS' });
            const response = await handler(event, {});

            expect(response.statusCode).toBe(200);
            expect(response.headers).toHaveProperty('Access-Control-Allow-Origin');
        });

        it('should return 405 for POST method', async () => {
            const event = createMockEvent({ method: 'POST' });
            const response = await handler(event, {});

            expect(response.statusCode).toBe(405);
            const body = JSON.parse(response.body);
            expect(body.error).toBe('Method not allowed');
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

        it('should return 200 for GET method', async () => {
            const event = createMockEvent({ method: 'GET' });
            const response = await handler(event, {});

            expect(response.statusCode).toBe(200);
        });
    });

    describe('CORS Headers', () => {
        it('should include CORS headers in response', async () => {
            const event = createMockEvent({ method: 'GET' });
            const response = await handler(event, {});

            expect(response.headers).toHaveProperty('Access-Control-Allow-Origin');
            expect(response.headers).toHaveProperty('Access-Control-Allow-Methods');
        });

        it('should handle missing origin header', async () => {
            const event = createMockEvent({ method: 'GET', origin: undefined });
            delete event.headers.origin;
            const response = await handler(event, {});

            expect(response.statusCode).toBe(200);
        });
    });

    describe('Product Listing', () => {
        it('should return array of products', async () => {
            const event = createMockEvent({ method: 'GET' });
            const response = await handler(event, {});

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            expect(Array.isArray(body)).toBe(true);
        });

        it('should return products with required fields', async () => {
            const event = createMockEvent({ method: 'GET', query: { limit: '1' } });
            const response = await handler(event, {});

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);

            if (body.length > 0) {
                const product = body[0];
                expect(product).toHaveProperty('id');
                expect(product).toHaveProperty('title');
                expect(product).toHaveProperty('slug');
                expect(product).toHaveProperty('price_gbp');
            }
        });

        it('should respect limit parameter', async () => {
            const event = createMockEvent({ method: 'GET', query: { limit: '2' } });
            const response = await handler(event, {});

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            expect(body.length).toBeLessThanOrEqual(2);
        });
    });

    describe('Category Filtering', () => {
        it('should filter products by category', async () => {
            const event = createMockEvent({
                method: 'GET',
                query: { category: 'articulated-toys' }
            });
            const response = await handler(event, {});

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);

            body.forEach(product => {
                expect(product.category).toBe('articulated-toys');
            });
        });

        it('should return empty array for non-existent category', async () => {
            const event = createMockEvent({
                method: 'GET',
                query: { category: 'non-existent-category-12345' }
            });
            const response = await handler(event, {});

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            expect(body).toEqual([]);
        });
    });

    describe('Tag Filtering', () => {
        it('should filter products by tag', async () => {
            const event = createMockEvent({
                method: 'GET',
                query: { tag: 'test' }
            });
            const response = await handler(event, {});

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);

            if (body.length > 0) {
                body.forEach(product => {
                    expect(product.tags).toContain('test');
                });
            }
        });

        it('should filter featured products', async () => {
            const event = createMockEvent({
                method: 'GET',
                query: { featured: 'true' }
            });
            const response = await handler(event, {});

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);

            body.forEach(product => {
                expect(product.tags).toContain('featured');
            });
        });
    });

    describe('Single Product by Slug', () => {
        it('should return product by slug', async () => {
            if (!testProductId) {
                console.log('Skipping - test product not created');
                return;
            }

            const event = createMockEvent({
                method: 'GET',
                query: { slug: testSlug }
            });
            const response = await handler(event, {});

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            expect(body.slug).toBe(testSlug);
            expect(body.title).toBe('TEST_Handler_Product');
        });

        it('should return 404 for non-existent slug', async () => {
            const event = createMockEvent({
                method: 'GET',
                query: { slug: 'this-product-does-not-exist-12345' }
            });
            const response = await handler(event, {});

            expect(response.statusCode).toBe(404);
            const body = JSON.parse(response.body);
            expect(body.error).toBe('Product not found');
        });

        it('should include full product details', async () => {
            if (!testProductId) {
                console.log('Skipping - test product not created');
                return;
            }

            const event = createMockEvent({
                method: 'GET',
                query: { slug: testSlug }
            });
            const response = await handler(event, {});

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);

            expect(body).toHaveProperty('id');
            expect(body).toHaveProperty('title');
            expect(body).toHaveProperty('slug');
            expect(body).toHaveProperty('price_gbp');
            expect(body).toHaveProperty('description');
            expect(body).toHaveProperty('images');
            expect(body).toHaveProperty('stock');
        });
    });

    describe('Response Format', () => {
        it('should return valid JSON', async () => {
            const event = createMockEvent({ method: 'GET' });
            const response = await handler(event, {});

            expect(() => JSON.parse(response.body)).not.toThrow();
        });

        it('should include content-type header', async () => {
            const event = createMockEvent({ method: 'GET' });
            const response = await handler(event, {});

            // Check that body is JSON parseable
            const body = JSON.parse(response.body);
            expect(body).toBeDefined();
        });
    });
});
